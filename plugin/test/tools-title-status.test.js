// A Tools or Settings page title that carries a status, or the page's own controls, against the
// real markup of Unraid 7.3's Docker settings and of Recycle Bin Next 2026.11.20, File Activity
// Next 2026.11.24 and UD Next 2026.11.09. What breaks:
//   · a status word coloured inline (.status-text > .status-value) instead of by class, which
//     stays a word in green or orange on the accent badge, where orange cannot be read
//   · a name in a plain span, a span.title-left or a div.page-title, which gets no badge of its
//     own once the row goes transparent
//   · a title holding a filter field and checkboxes, which the badge rule turns into one large
//     accent block with the controls inside it
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const tryFn = (src, name) => { try { return grabFn(src, name); } catch (e) { return null; } };
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }

// Elements with enough of the DOM for the dot pass: compound selectors (tag, .class, [attr],
// :not([attr])) joined by spaces or ">", listed with commas.
class Elem {
  constructor(tag, attrs, kids, style) {
    this.tagName = tag.toUpperCase(); this.attrs = Object.assign({}, attrs); this.children = []; this.parentNode = null;
    this.textContent = ''; this.props = {};
    this.style = Object.assign({ color: '' }, style, { setProperty: (k, v) => { this.props[k] = v; } });
    const self = this;
    this.classList = { contains: (c) => self.cls().includes(c), add: (c) => { if (!self.cls().includes(c)) self.attrs.class = self.cls().concat(c).join(' '); } };
    (kids || []).forEach((k) => { if (typeof k === 'string') this.textContent += k; else { k.parentNode = this; this.children.push(k); } });
  }
  get className() { return this.attrs.class || ''; }
  cls() { return (this.attrs.class || '').split(' ').filter(Boolean); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  all() { return this.children.flatMap((c) => [c].concat(c.all())); }
  querySelectorAll(sel) { return this.all().filter((e) => matches(e, sel)); }
}
const h = (tag, attrs, kids, style) => new Elem(tag, attrs, kids, style);
function compound(e, part) {
  const re = /(^[a-z]+)|#([\w-]+)|\.([\w-]+)|:not\(\[([\w-]+)\]\)|\[([\w-]+)\]/gi;
  let m, seen = 0;
  while ((m = re.exec(part))) {
    seen += m[0].length;
    if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && e.getAttribute('id') !== m[2]) return false;
    if (m[3] && !e.classList.contains(m[3])) return false;
    if (m[4] && e.getAttribute(m[4]) !== null) return false;
    if (m[5] && e.getAttribute(m[5]) === null) return false;
  }
  if (seen !== part.length) throw new Error('selector the shim cannot read: ' + part);
  return true;
}
function matchFrom(e, steps, i) {
  if (!compound(e, steps[i].part)) return false;
  if (i === 0) return true;
  if (steps[i].comb === '>') return !!e.parentNode && matchFrom(e.parentNode, steps, i - 1);
  for (let p = e.parentNode; p; p = p.parentNode) if (matchFrom(p, steps, i - 1)) return true;
  return false;
}
function matches(e, sel) {
  return sel.split(',').some((one) => {
    const toks = one.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/), steps = [];
    for (let i = 0; i < toks.length; i++) { if (toks[i] === '>') continue; steps.push({ part: toks[i], comb: toks[i - 1] === '>' ? '>' : ' ' }); }
    return matchFrom(e, steps, steps.length - 1);
  });
}

const header = read('scripts/header.js');
const tools = parseRules(read('sheets/TowerTorch.Tools.css'));
const rulesFor = (pred) => tools.filter((r) => splitTop(r.selector).some(pred));
const decl = (r, prop) => { const d = r && r.decls.find((x) => x.prop === prop); return d ? d.value : undefined; };

console.log('\nA status coloured inline becomes a state dot like a native one');
{
  const fn = tryFn(header, 'ttStatusDots');
  ok('header.js turns the status words into dots in one named pass', !!fn);
  ok('ttToolsEnhance runs it', /ttStatusDots\(\);/.test(grabFn(header, 'ttToolsEnhance')));
  if (fn) {
    const nativeWord = h('span', { class: 'green' }, ['Started']);
    const docker = h('div', { class: 'title' }, [h('span', { class: 'left' }, ['Docker']), h('span', { class: 'status' }, ['Status: ', nativeWord])]);
    const running = h('span', { class: 'status-value' }, ['Running'], { color: 'green' });
    const recycle = h('div', { class: 'latest title shift' }, [h('span', {}, ['Recycle Bin']), h('span', { class: 'status-text' }, ['Status: ', running])]);
    const stopped = h('span', { class: 'status-value' }, ['Stopped'], { color: 'darkorange' });
    const activity = h('div', { class: 'latest title shift' }, [h('span', { class: 'title-left' }, ['File Activity Settings']), h('span', { class: 'status-text' }, ['Status: ', stopped])]);
    const box = h('div', { id: 'displaybox' }, [docker, recycle, activity]);
    const consts = (/var TT_STCOLOR = [^\n]+;/.exec(header) || [''])[0];
    new Function('document', consts + '\n' + fn + '\nttStatusDots();')({ querySelectorAll: (s) => h('html', {}, [box]).querySelectorAll(s) });
    for (const [name, w, word, colour] of [['Unraid\'s class-coloured word', nativeWord, 'Started', 'var(--tt-ok'], ['Recycle Bin Next\'s green word', running, 'Running', 'var(--tt-ok'], ['File Activity Next\'s dark orange word', stopped, 'Stopped', 'var(--tt-warn']]) {
      ok(name + ' is a dot', w.classList.contains('tt-status-dot') && w.textContent === '', w.className + ' "' + w.textContent + '"');
      ok(name + ' keeps its word as the tip', w.getAttribute('data-tt-tip') === word);
      ok(name + ' takes the state colour', String(w.props['--tt-dotstate'] || '').startsWith(colour), w.props['--tt-dotstate']);
    }
  }
}

console.log('\nThe name beside a dot is the badge, whatever element holds it');
{
  const badge = rulesFor((s) => /div\.title:has\(\.tt-status-dot\) > /.test(s));
  const sels = badge.flatMap((r) => splitTop(r.selector)).filter((s) => /:has\(\.tt-status-dot\) > /.test(s));
  ok('the badge takes the first child of the row, not only span.left', sels.some((s) => /> :is\(span, div\):is\(\.left, :first-child\):not\(\.status, \.status-text\)$/.test(s)), sels.join(' | '));
  const r = badge.find((x) => decl(x, 'background'));
  ok('and paints it with the accent', !!r && /--tt-rbaccent/.test(decl(r, 'background')), r && decl(r, 'background'));
  const label = rulesFor((s) => /div\.title:has\(\.tt-status-dot\) :is\(\.status, \.status-text\)$/.test(s));
  ok('the "Status:" label is hidden for both spellings', label.some((x) => /^0( !important)?$/.test(decl(x, 'font-size') || '')), label.map((x) => x.selector).join(' | '));
}

console.log('\nA title that holds the page\'s controls is a toolbar, not a badge');
{
  const row = rulesFor((s) => /div\.title:has\(input:not\(\[type="hidden"\]\), select, textarea\)$/.test(s));
  const r = row.find((x) => decl(x, 'background'));
  ok('the row is found by a visible control in it', !!r);
  if (r) {
    ok('it stays a full row', decl(r, 'display') === 'flex' && decl(r, 'width') === 'auto', decl(r, 'display') + ' ' + decl(r, 'width'));
    ok('without the accent fill', decl(r, 'background') === 'transparent');
    ok('and the labels keep their own case', decl(r, 'text-transform') === 'none');
    ok('in the page\'s text colour', /^var\(--tt-text/.test(decl(r, 'color') || ''), decl(r, 'color'));
  }
  const name = rulesFor((s) => /div\.title:has\(input:not\(\[type="hidden"\]\), select, textarea\) > :is\(span, div\):first-child$/.test(s));
  const n = name.find((x) => decl(x, 'background'));
  ok('its first child, the page title, is the badge', !!n && /--tt-rbaccent/.test(decl(n, 'background')));
  ok('in the section badge\'s case and size', !!n && decl(n, 'text-transform') === 'uppercase' && /--tt-sec-fs/.test(decl(n, 'font-size') || ''));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
