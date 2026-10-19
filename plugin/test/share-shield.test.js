// Unraid's protection orb on /Shares becomes a shield before the share's name, in the list
// (shares.js statusPill) and on the tiles (sharetiles.js shield) alike. What can quietly break it:
//   · the two views drawing a state with different glyphs, or one of them falling back to a dot
//   · a glyph name the set does not hold, which leaves an empty box before the name
//   · the bubble losing Unraid's own words, or a shield without any words at all
//   · the colours following the accent or rainbow instead of the state
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
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
function grabObj(src, start) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('not found: ' + start);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1) + ';'; } }
  throw new Error('unbalanced: ' + start);
}

const theme = read('scripts/cc-theme.js'), tiles = read('scripts/sharetiles.js'), shares = read('scripts/shares.js'), css = read('sheets/TowerTorch.Shares.css');
const gs = theme.indexOf('var GLYPHS = {'), ge = theme.indexOf('\n  };', gs);
const GLYPHS = new Function('return ' + theme.slice(gs + 'var GLYPHS = '.length, ge + 4) + ';')();
const glyph = new Function('GLYPHS', grabFn(theme, 'glyph') + '\nreturn glyph;')(GLYPHS);
const glyphOf = (html) => { const vb = /viewBox="([^"]+)"/.exec(html || ''); return Object.keys(GLYPHS).find((n) => vb && GLYPHS[n][0] === vb[1] && html.includes('>' + GLYPHS[n][1] + '</svg>')) || ''; };

// The tile's shield, built from sharetiles.js in the page language.
function tileShield(lang, sh) {
  const src = ['var LANG = "' + lang + '";', grabObj(tiles, 'var TXT = {'), grabFn(tiles, 't'), grabFn(tiles, 'esc'), grabFn(tiles, 'glyph'), grabFn(tiles, 'shield'), 'return shield;'].join('\n');
  const html = new Function('window', src)({ CCTheme: { glyph } })(sh);
  const at = (k) => { const m = new RegExp(' ' + k + '="([^"]*)"').exec(html); return m ? m[1].replace(/&amp;/g, '&') : null; };
  return { html, cls: at('class'), tip: at('data-tip'), label: at('aria-label'), tab: at('tabindex'), role: at('role'), glyph: glyphOf(html) };
}

// The list's shield, built by shares.js statusPill on a name cell with just enough DOM.
function node(tag, cls) {
  const n = { tagName: tag.toUpperCase(), className: cls || '', attrs: {}, children: [], parentNode: null, textContent: '', innerHTML: '', style: { props: {}, setProperty(k, v, p) { this.props[k] = v + (p ? ' !' + p : ''); } } };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.append = (c) => { c.parentNode = n; n.children.push(c); return n; };
  n.has = (c) => (' ' + n.className + ' ').includes(' ' + c + ' ');
  n.closest = (sel) => { for (let c = n; c; c = c.parentNode) if (c.tagName === sel.toUpperCase()) return c; return null; };
  n.all = () => n.children.flatMap((c) => [c, ...c.all()]);
  n.querySelector = (sel) => n.all().find((c) => sel.split(',').some((p) => { const [t, k] = p.trim().split('.'); return c.tagName === t.toUpperCase() && (!k || c.has(k)); })) || null;
  return n;
}
function nameCell(orbCls, words) {
  const td = node('td'), a = node('a', 'info nohand'), i = node('i', orbCls);
  a.append(i);
  if (words != null) { const sp = node('span'); sp.textContent = words; a.append(sp); }
  td.append(a);
  return { td, a, i };
}
function listShield(lang, cell) {
  const src = ['var LANG = "' + lang + '";', /var T = \{[^\n]+\};/.exec(shares)[0], grabFn(shares, 't'), grabFn(shares, 'el'), grabFn(shares, 'statusPill'), 'return statusPill;'].join('\n');
  const doc = { createElement: (t) => node(t) };
  const sb = new Function('window', 'document', src)({ CCTheme: { glyph } }, doc)(cell.td);
  if (!sb) return null;
  return { cls: sb.className, tip: sb.getAttribute('data-tip'), label: sb.getAttribute('aria-label'), tab: sb.getAttribute('tabindex'), role: sb.getAttribute('role'), glyph: glyphOf(sb.innerHTML) };
}

console.log('\nThe glyphs');
for (const n of ['ShieldOn', 'ShieldAlert', 'Shield']) ok(n + ' is in the set', n in GLYPHS);
{
  const outer = (svg) => / d="([^Z]+Z)/.exec(svg)[1];
  ok('all three wear the outline of GlimStone\'s IconShieldOn, so the states differ only in their mark', outer(GLYPHS.Shield[1]) === outer(GLYPHS.ShieldOn[1]) && outer(GLYPHS.ShieldAlert[1]) === outer(GLYPHS.ShieldOn[1]) && GLYPHS.Shield[0] === GLYPHS.ShieldOn[0] && GLYPHS.ShieldAlert[0] === GLYPHS.ShieldOn[0]);
  ok('the exclamation mark is two holes, a bar and a dot', (GLYPHS.ShieldAlert[1].match(/Z/g) || []).length === 3 && (GLYPHS.Shield[1].match(/Z/g) || []).length === 1);
}

console.log('\nA tile wears a shield whose glyph says the state');
{
  const okS = tileShield('de', { prot: 'ok', protTip: 'Alle Dateien geschützt' });
  ok('protected: the shield with the check, in the protected colour', okS.glyph === 'ShieldOn' && okS.cls === 'cc-shield cc-shield-ok', okS.html.slice(0, 80));
  ok('its bubble and its name are Unraid\'s own words', okS.tip === 'Alle Dateien geschützt' && okS.label === okS.tip);
  ok('it is a picture the keyboard can reach, so the bubble opens on focus too', okS.role === 'img' && okS.tab === '0');
  const warn = tileShield('de', { prot: 'warn', protTip: '' });
  ok('not fully protected: the shield with the exclamation mark', warn.glyph === 'ShieldAlert' && warn.cls === 'cc-shield cc-shield-warn');
  ok('without Unraid\'s words it says so itself, in German', warn.tip === 'Nicht alles geschützt');
  ok('and in English', tileShield('en', { prot: 'warn', protTip: '' }).tip === 'Not fully protected' && tileShield('en', { prot: 'ok', protTip: '' }).tip === 'Protected');
  const idle = tileShield('de', { prot: 'idle', protTip: '' });
  ok('any other orb: the plain shield, which claims nothing', idle.glyph === 'Shield' && idle.cls === 'cc-shield cc-shield-idle' && idle.tip === 'Schutz unbekannt');
  ok('a share without an orb has no shield', tileShield('de', { prot: '', protTip: '' }).html === '');
  ok('the tiles draw no dot', !/cc-sht-dot/.test(tiles) && !/cc-sht-dot/.test(css));
}

console.log('\nThe list wears the same shield');
{
  const g = nameCell('fa fa-circle orb green-orb', 'Alle Dateien geschützt');
  const okS = listShield('de', g);
  ok('protected: the same glyph and classes as on the tile', okS && okS.glyph === 'ShieldOn' && okS.cls === 'cc-shield cc-shield-ok', okS && okS.cls);
  ok('its bubble is the orb\'s own words, not a title', okS.tip === 'Alle Dateien geschützt' && okS.label === okS.tip && okS.role === 'img' && okS.tab === '0');
  ok('Unraid\'s orb steps aside', g.a.style.props.display === 'none !important');
  const y = listShield('de', nameCell('fa fa-warning orb yellow-orb', 'Einige oder alle Dateien sind ungeschützt'));
  ok('not fully protected: the shield with the exclamation mark', y.glyph === 'ShieldAlert' && y.cls === 'cc-shield cc-shield-warn' && y.tip === 'Einige oder alle Dateien sind ungeschützt');
  const bare = listShield('en', nameCell('fa fa-warning orb', null));
  ok('a warning orb without words still reads as not fully protected', bare.glyph === 'ShieldAlert' && bare.tip === 'Not fully protected');
  const grey = listShield('de', nameCell('fa fa-circle orb grey-orb', ''));
  ok('any other orb: the plain shield, as on the tile', grey.glyph === 'Shield' && grey.cls === 'cc-shield cc-shield-idle' && grey.tip === 'Schutz unbekannt');
  ok('a name cell without an orb gets nothing', listShield('de', { td: node('td') }) === null);
  ok('both views use the same fallback words', ['protected', 'partly', 'unknown'].every((k) => {
    const a = new Function(grabObj(tiles, 'var TXT = {') + 'return TXT;')(), b = new Function(/var T = \{[^\n]+\};/.exec(shares)[0] + 'return T;')();
    return a.de[k] && a.de[k] === b.de[k] && a.en[k] === b.en[k];
  }));
  ok('the list draws no dot', !/cc-dot-(un)?prot/.test(shares) && !/\.cc-dot\b/.test(css));
}

console.log('\nThe colours say the state in every mode');
{
  const rule = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css); return m ? m[1] : ''; };
  ok('protected draws in the ok ink, which the light themes darken', /color: var\(--cc-ok-ink, #6fdc8c\)/.test(rule('html.cc-shares-on #displaybox .cc-shield-ok')));
  ok('not fully protected in the warning ink', /color: var\(--cc-warn-ink, #ff832b\)/.test(rule('html.cc-shares-on #displaybox .cc-shield-warn')));
  ok('the plain shield stays dim', /color: var\(--cc-text-dim2\)/.test(rule('html.cc-shares-on #displaybox .cc-shield')));
  ok('the shield is as tall as the title text, in both views', /font-size: var\(--cc-text-title\)/.test(rule('html.cc-shares-on #displaybox .cc-shield')));
  ok('no accent or rainbow colour reaches it', !/\.cc-shield[^{]*\{[^}]*(--cc-rb|accent)[^}]*color/.test(css.replace(/:focus-visible[^}]*\}/g, '')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
