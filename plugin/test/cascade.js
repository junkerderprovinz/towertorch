// A small CSS cascade for the tests: it parses CC's sheets in the order a page
// loads them, matches selectors against a described element and picks the
// declaration that wins. A test that only reads the rule it cares about misses
// the heavier rule in another sheet that overrides it.
//
// The element is described, not built: { tag, classes, attrs, states }, with
// optional html (the classes on <html>, to pick a colour mode or theme) and has
// (the selectors a :has() may name, such as '.sl-low'). Other ancestors
// are assumed to be whatever a selector asks for, so a rule counts as matching
// if it could match the element in some context. Pseudo-classes it cannot decide
// (structural ones, :has) count as possible too, which errs towards reporting.
// Rules that reach the element by its tag alone are left out, see keyed(), unless
// they name an ancestor listed in inside ('#cc-settings'); outside lists the
// classes and ids known not to be ancestors ('.cc-pop').
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');

// The Menu="Buttons:N" sheets load in <head> on every page in N order; docker.css
// follows on the pages that link it, and settings.js adds its own <style> last.
const HEAD = ['sheets/TowerTorch.Tokens.css', 'sheets/TowerTorch.Header.css', 'sheets/TowerTorch.SettingsGrid.css',
  'sheets/TowerTorch.Tools.css', 'sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.Forms.css', 'sheets/TowerTorch.VmTab.css', 'sheets/TowerTorch.Favorites.css'];
const PAGES = { every: HEAD, docker: HEAD.concat(['styles/docker.css']), settings: HEAD.concat(['styles/docker.css', 'scripts/settings.js']) };

function settingsStyle() {
  const src = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
  const i = src.indexOf('st.textContent =');
  const end = src.indexOf(';\n', i);
  return (src.slice(i, end).match(/"(?:[^"\\]|\\.)*"/g) || []).map((s) => JSON.parse(s)).join('\n');
}

function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }

// Rules in source order, with @media and @supports bodies flattened in place.
function parseRules(css, sheet) {
  const out = [];
  const src = strip(css);
  let i = 0;
  function block(endAt) {
    while (i < endAt) {
      const open = src.indexOf('{', i), close = src.indexOf('}', i);
      if (open < 0 || open > endAt || (close >= 0 && close < open)) { i = close < 0 ? endAt : close + 1; return; }
      const head = src.slice(i, open).trim();
      if (head.startsWith('@')) {
        if (/^@(media|supports|layer)\b/.test(head)) { i = open + 1; block(endAt); continue; }
        let d = 1, k = open + 1;
        for (; k < src.length && d; k++) { if (src[k] === '{') d++; else if (src[k] === '}') d--; }
        i = k; continue;
      }
      const end = src.indexOf('}', open);
      out.push({ sheet, selector: head, decls: parseDecls(src.slice(open + 1, end)) });
      i = end + 1;
    }
  }
  block(src.length);
  return out;
}

function parseDecls(body) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of body + ';') {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ';' && !depth) {
      const m = /^\s*([-\w]+)\s*:\s*([\s\S]*?)\s*$/.exec(cur);
      if (m) { const important = /!\s*important$/i.test(m[2]); out.push({ prop: m[1].toLowerCase(), value: m[2].replace(/\s*!\s*important$/i, ''), important }); }
      cur = '';
    } else cur += ch;
  }
  return out;
}

function splitTop(s, sep) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && !depth) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

// Splits a complex selector into compounds, dropping the combinators: only the
// last compound has to match the element, the rest is ancestor context.
function compounds(sel) {
  const out = []; let depth = 0, cur = '', q = null;
  for (const ch of sel) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--;
    if (!depth && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) { if (cur) out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// The simple selectors of one compound: tag, #id, .class, [attr], :pseudo(args), ::element.
function simples(comp) {
  const out = []; let i = 0;
  while (i < comp.length) {
    const ch = comp[i];
    if (ch === '[') { const e = matchClose(comp, i, '[', ']'); out.push({ t: 'attr', v: comp.slice(i + 1, e) }); i = e + 1; continue; }
    if (ch === ':') {
      const el = comp[i + 1] === ':'; let j = i + (el ? 2 : 1);
      while (j < comp.length && /[-\w]/.test(comp[j])) j++;
      const name = comp.slice(i + (el ? 2 : 1), j).toLowerCase();
      let arg = null;
      if (comp[j] === '(') { const e = matchClose(comp, j, '(', ')'); arg = comp.slice(j + 1, e); j = e + 1; }
      out.push({ t: el || /^(before|after|first-line|first-letter)$/.test(name) ? 'pe' : 'pc', name, arg });
      i = j; continue;
    }
    let j = i + 1;
    while (j < comp.length && !/[.#\[:]/.test(comp[j])) j++;
    const tok = comp.slice(i, j);
    if (tok[0] === '.') out.push({ t: 'class', v: tok.slice(1) });
    else if (tok[0] === '#') out.push({ t: 'id', v: tok.slice(1) });
    else out.push({ t: 'tag', v: tok.toLowerCase() });
    i = j;
  }
  return out;
}
function matchClose(s, i, o, c) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === o) d++; else if (s[k] === c) { d--; if (!d) return k; } } return s.length; }

function specOfList(list) { return splitTop(list, ',').map(specificity).reduce((a, b) => (cmp(a, b) >= 0 ? a : b), [0, 0, 0]); }
function specificity(sel) {
  const s = [0, 0, 0];
  for (const comp of compounds(sel)) for (const x of simples(comp)) {
    if (x.t === 'id') s[0]++;
    else if (x.t === 'class' || x.t === 'attr') s[1]++;
    else if (x.t === 'tag' && x.v !== '*') s[2]++;
    else if (x.t === 'pe') s[2]++;
    else if (x.t === 'pc') {
      if (x.name === 'where') continue;
      if (/^(is|not|has|matches|any)$/.test(x.name)) { const t = specOfList(x.arg); s[0] += t[0]; s[1] += t[1]; s[2] += t[2]; }
      else if (/^nth-/.test(x.name) && / of /.test(x.arg || '')) { s[1]++; const t = specOfList(x.arg.split(/ of /)[1]); s[0] += t[0]; s[1] += t[1]; s[2] += t[2]; }
      else s[1]++;
    }
  }
  return s;
}
function cmp(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }

// Three-valued: true, false, or null for "cannot tell".
function and(a, b) { return a === false || b === false ? false : (a === null || b === null ? null : true); }
function anyOf(vals) { return vals.some((v) => v === true) ? true : (vals.some((v) => v === null) ? null : false); }
function not(v) { return v === null ? null : !v; }

function matchList(list, el) { return anyOf(splitTop(list, ',').map((s) => matchSubject(s, el))); }
function matchSubject(sel, el) { const c = compounds(sel); return matchCompound(c[c.length - 1], el); }
function matchCompound(comp, el) {
  let r = true;
  for (const x of simples(comp)) {
    let v;
    if (x.t === 'tag') v = x.v === '*' || x.v === el.tag;
    else if (x.t === 'class') v = el.classes.includes(x.v);
    else if (x.t === 'id') v = el.id === x.v;
    else if (x.t === 'attr') v = matchAttr(x.v, el.attrs || {});
    else if (x.t === 'pe') v = false;
    else v = matchPseudo(x, el);
    r = and(r, v);
    if (r === false) return false;
  }
  return r;
}
function matchAttr(expr, attrs) {
  const m = /^\s*([-\w]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*))\s*(i)?)?\s*$/.exec(expr);
  if (!m) return null;
  const name = m[1];
  if (!(name in attrs)) return false;
  if (!m[2]) return true;
  const want = m[3] != null ? m[3] : (m[4] != null ? m[4] : m[5]);
  const have = String(attrs[name]);
  switch (m[2]) {
    case '=': return have === want;
    case '~=': return have.split(/\s+/).includes(want);
    case '^=': return have.startsWith(want);
    case '$=': return have.endsWith(want);
    case '*=': return have.includes(want);
    case '|=': return have === want || have.startsWith(want + '-');
  }
  return null;
}
function matchPseudo(x, el) {
  const st = el.states || {};
  switch (x.name) {
    case 'is': case 'where': case 'matches': case 'any': return matchList(x.arg, el);
    // A complex argument such as Unraid's :not(.unapi *) turns on the ancestors, which are
    // not described, so it can go either way unless its subject cannot be the element at all.
    case 'not': return not(anyOf(splitTop(x.arg, ',').map((s) => (compounds(s).length > 1 && matchSubject(s, el) !== false ? null : matchSubject(s, el)))));
    case 'hover': case 'active': case 'focus': case 'focus-visible': case 'focus-within': case 'checked': case 'disabled':
      return !!st[x.name];
    case 'enabled': return !st.disabled;
    case 'root': return el.tag === 'html';
    case 'has': return el.has ? el.has.includes(x.arg.trim()) : null;
    default: return null;
  }
}

// Whether the subject reaches the element through a class, id or attribute it carries.
// A subject that names only a tag under some host container (.usage-disk > span)
// is about the host's markup, and counting it would flood every query; a bare
// page-wide tag rule (button:focus-visible) still counts.
function keyed(comp, el) {
  return simples(comp).some((x) => (x.t === 'class' && el.classes.includes(x.v)) || (x.t === 'id' && el.id === x.v) || (x.t === 'attr' && matchAttr(x.v, el.attrs || {}) === true) ||
    (x.t === 'pc' && /^(is|where|matches|any)$/.test(x.name) && splitTop(x.arg, ',').some((a) => { const c = compounds(a); return matchCompound(c[c.length - 1], el) !== false && keyed(c[c.length - 1], el); })));
}

// Parsed sheets by their text, since a test asks about many elements and properties.
const PARSED = new Map();

// Every declaration of prop that can reach the element, in cascade order with the
// winner last. Each carries its rule's selector, its sheet and its specificity.
function candidates(page, el, prop) {
  const files = Array.isArray(page) ? page : PAGES[page];
  const out = []; let order = 0;
  for (const f of files) {
    // A sheet is a path under the plugin, or { name, css } for a test's own snippet.
    const css = typeof f === 'object' ? f.css : (f.endsWith('.js') ? settingsStyle() : fs.readFileSync(path.join(DIR, f), 'utf8'));
    const name = typeof f === 'object' ? f.name : f;
    if (!PARSED.has(css)) PARSED.set(css, parseRules(css, name));
    for (const rule of PARSED.get(css)) {
      const hits = rule.decls.filter((d) => d.prop === prop);
      order++;
      if (!hits.length) continue;
      for (const sel of splitTop(rule.selector, ',')) {
        const m = matchSubject(sel, el);
        if (m === false) continue;
        const c = compounds(sel);
        const ctx = c.slice(0, -1).map((x) => simples(x).filter((t) => t.t === 'class' || t.t === 'id').map((t) => (t.t === 'id' ? '#' : '.') + t.v));
        if (el.outside && ctx.some((t) => t.some((v) => el.outside.includes(v)))) continue;
        if (c.length > 1 && !keyed(c[c.length - 1], el) && !(el.inside && ctx.some((t) => t.some((v) => el.inside.includes(v))))) continue;
        if (el.html && c.length > 1 && /^html\b/.test(c[0]) && matchCompound(c[0], { tag: 'html', classes: el.html, attrs: {}, states: {} }) === false) continue;
        hits.forEach((d, n) => out.push({ sheet: name, selector: sel, value: d.value, important: d.important, spec: specificity(sel), order: order + n / 100 }));
      }
    }
  }
  return out.sort((a, b) => (a.important - b.important) || cmp(a.spec, b.spec) || (a.order - b.order));
}

// The custom properties Tokens.css sets on <html>, for the dark themes or, with
// light, with the white and azure override on top.
function tokens(light) {
  const out = {};
  for (const r of parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8'))) {
    const sel = r.selector.replace(/\s+/g, ' ');
    if (sel === 'html' || (light && sel === 'html.Theme--white, html.Theme--azure')) for (const d of r.decls) if (d.prop.startsWith('--')) out[d.prop] = d.value;
  }
  return out;
}
// Substitutes var() references from a token map until a plain value is left.
function resolve(value, map) {
  let v = value, guard = 0;
  while (/var\(/.test(v) && guard++ < 20) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/, (m, name, fb) => (name in map ? map[name] : (fb != null ? fb.trim() : 'unset')));
  }
  return v.trim();
}

// Unraid's own control rules from webGui/styles/default-base.css, the ones that compete with
// CC's single-class rules: an attribute selector plus a tag outweighs one class. They load in
// <head> before any CC sheet, so a tie goes to CC. The values are the white theme's.
const UNRAID = { name: 'unraid default-base.css', css: `
input[type="checkbox"] { vertical-align: middle; margin-right: 6px; }
span.outer { margin-bottom: 20px; margin-right: 0px; }
input[type="text"]:where(:not(.unapi *)), input[type="number"]:where(:not(.unapi *)), textarea:where(:not(.unapi *)) {
  color: #1d1b1b; font-size: 1.3rem; background-color: transparent; border-width: 0; border-bottom-width: 1px;
  padding: .5rem; min-height: 2rem; line-height: 2rem; width: 100%; margin: 0; box-shadow: none; border-radius: 0; }
input:focus[type="text"]:where(:not(.unapi *)), input:focus[type="number"]:where(:not(.unapi *)), textarea:focus:where(:not(.unapi *)) { background-color: #ebebeb; outline: 0; }
input[type="button"]:where(:not(.unapi *)), button:where(:not(.unapi *)), button[type="button"]:where(:not(.unapi *)), a.button:where(:not(.unapi *)) {
  font-size: 1.1rem; font-weight: bold; letter-spacing: 1.8px; text-transform: uppercase; min-width: 86px; margin: 10px 12px 10px 0;
  padding: 8px; border-radius: 4px; border: none; color: #f15a2c;
  background: linear-gradient(90deg, #e22828 0, #f15a2c) 0 0 no-repeat; background-size: 100% 2px, 100% 2px, 2px 100%, 2px 100%; }
input:hover[type="button"]:where(:not(.unapi *)), button:hover:where(:not(.unapi *)), button:hover[type="button"]:where(:not(.unapi *)), a.button:hover:where(:not(.unapi *)) {
  color: #fff; background: linear-gradient(90deg, #e22828 0, #f15a2c); }
` };
const withUnraid = (page) => [UNRAID].concat(PAGES[page]);

module.exports = { UNRAID, withUnraid, tokens, resolve, DIR, PAGES, parseRules, parseDecls, specificity, matchSubject, candidates, cmp };
