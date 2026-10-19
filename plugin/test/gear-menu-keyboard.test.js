// The gear menu works from the keyboard: opened with Enter or Space it puts the focus on its first
// entry, Tab walks every entry in a loop, "+ Neuer Ordner" and the move targets among them, Enter
// or Space picks an entry, and Escape closes the menu with the focus back on the gear. A click
// with the pointer leaves the focus where it was.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const document = { activeElement: null, body: null, contains: (n) => { for (let p = n; p; p = p.parentNode) if (p === document.body) return true; return false; } };
class N {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.hidden = false; this.cls = ''; }
  set className(v) { this.cls = v; } get className() { return this.cls; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { const s = this.parentNode.children; s.splice(s.indexOf(this), 1); this.parentNode = null; } }
  contains(n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(type, init) { const ev = Object.assign({ type, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} }, init || {}); for (let n = this; n; n = n.parentNode) (n.listeners[type] || []).forEach((fn) => fn(ev)); return ev; }
  click() { this.fire('click', { detail: 0 }); }
  focus() { document.activeElement = this; }
  getClientRects() { return this.hidden ? [] : [1]; }
  all() { const out = []; const walk = (n) => n.children.forEach((c) => { out.push(c); walk(c); }); walk(this); return out; }
  querySelectorAll() { return this.all().filter((n) => (n.tagName === 'BUTTON' && !n.attrs.disabled) || (n.tagName === 'A' && n.attrs.href) || n.tagName === 'INPUT' || n.attrs.tabindex === '0'); }
}
document.body = new N('body');
const el = (tag, cls, txt) => { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.text = txt; return n; };

const src = ['openMenu', 'menuFocusables', 'menuItem', 'closeMenu', 'toggleMenu'].map((n) => grabFn(docker, n)).join('\n');
const refind = new Function('document', grabFn(fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8'), 'refind') + '\nreturn refind;')(document);
const api = new Function('document', 'window', 'el', 'buildMenu', 'positionMenu',
  'var menu = null, menuAnchor = null, menuStatusEl = null;\n' + src + '\nreturn { toggleMenu: toggleMenu, menuItem: menuItem, get menu() { return menu; } };');

let picked = 0;
let M;
function build() {
  const m = el('div', 'cc-menu');
  m.appendChild(el('div', 'cc-menu-status', 'engine up'));
  const seg = m.appendChild(el('div', 'cc-seg'));
  seg.appendChild(el('button', 'cc-seg-btn', 'Liste')); seg.appendChild(el('button', 'cc-seg-btn', 'Raster'));
  m.appendChild(M.menuItem('cc-menu-link', '+ Neuer Ordner', () => { picked++; }));
  const field = m.appendChild(el('input', 'cc-filter')); field.hidden = true;
  m.appendChild(el('button', 'cc-search-btn', 'Suche'));
  const a = m.appendChild(el('a', 'cc-menu-link', 'Einstellungen')); a.setAttribute('href', '/Settings/TowerTorch');
  return m;
}
M = api(document, { CCTheme: { refind } }, el, build, () => {});
const gear = document.body.appendChild(el('button', 'cc-hgear'));
const label = (n) => n && n.text;

console.log('\nOpened from the keyboard');
{
  gear.focus();
  M.toggleMenu(gear, null, { detail: 0 });
  ok('the focus moves onto the first entry', label(document.activeElement) === 'Liste', label(document.activeElement));
  const seen = [];
  for (let i = 0; i < 6; i++) {
    if (!document.activeElement || !M.menu.contains(document.activeElement)) break;
    const ev = document.activeElement.fire('keydown', { key: 'Tab' });
    if (!ev.prevented) { const f = M.menu.querySelectorAll().filter((n) => n.getClientRects().length); document.activeElement = f[f.indexOf(document.activeElement) + 1]; }
    seen.push(label(document.activeElement));
  }
  ok('Tab reaches every entry, "+ Neuer Ordner" among them, and skips the hidden field', seen.slice(0, 4).join(',') === 'Raster,+ Neuer Ordner,Suche,Einstellungen', seen.join(','));
  ok('and from the last entry goes round to the first', seen[4] === 'Liste' && seen[5] === 'Raster', seen.join(','));
  document.activeElement = M.menu.querySelectorAll()[0];
  document.activeElement.fire('keydown', { key: 'Tab', shiftKey: true });
  ok('Shift and Tab on the first entry goes to the last', label(document.activeElement) === 'Einstellungen', label(document.activeElement));
  const nf = M.menu.all().find((n) => n.text === '+ Neuer Ordner');
  ok('"+ Neuer Ordner" is a button for a screen reader', nf.getAttribute('role') === 'button' && nf.getAttribute('tabindex') === '0');
  nf.focus();
  const ev = nf.fire('keydown', { key: 'Enter' });
  ok('Enter picks it, closes the menu and hands the focus back to the gear', picked === 1 && ev.prevented && !M.menu && document.activeElement === gear);
  M.toggleMenu(gear, null, { detail: 0 });
  M.menu.all().find((n) => n.text === '+ Neuer Ordner').fire('keydown', { key: ' ' });
  ok('Space picks it too', picked === 2 && !M.menu);
}

console.log('\nOpened with the pointer');
{
  gear.focus();
  M.toggleMenu(gear, null, { detail: 1 });
  ok('the focus stays on the gear', !!M.menu && document.activeElement === gear);
  M.toggleMenu(gear, null, { detail: 1 });
  ok('a second click closes it', !M.menu);
}

console.log('\nThe callers');
{
  ok('the gear passes its click on', /toggleMenu\(g, null, e\)/.test(grabFn(docker, 'makeGear')));
  ok('the move button passes its click on', /toggleMenu\(btn, function \(\) \{ return buildMoveMenu\(entry\); \}, ev\)/.test(docker));
  ok('New folder is a button, which Tab and Enter reach on their own', /el\("button", "cc-btn cc-menu-newfolder"\); nb\.type = "button";/.test(grabFn(docker, 'buildMenu')));
  ok('every move target is a menu entry', (grabFn(docker, 'buildMoveMenu').match(/menuItem\(/g) || []).length === 2);
  const bm = grabFn(docker, 'buildMenu');
  ok('the menu keeps to the view: no rainbow and no icon colour switch, both live on the settings page', !/Rainbow (aus|an|off|on)|Icons (grau|farbig|grey|coloured)|cc\.actcolors|cc\.rainbow"/.test(bm));
  ok('and no second basic or advanced switch beside the one at the toolbar', !/"Einfach"|"Erweitert"|setAdvView|input\.advancedview/.test(bm));
  ok('the settings page opens from a secondary button with the gear glyph', /var link = el\("a", "cc-btn cc-menu-settings"\); link\.innerHTML = ccGlyph\("Gear"\);/.test(bm) && /link\.href = "\/Settings\/TowerTorch"/.test(bm) && !/cc-btn-primary cc-menu-settings/.test(bm));
  ok('in a button row of its own', /var srow = el\("div", "cc-menu-row cc-menu-plain"\);[\s\S]*srow\.appendChild\(link\); m\.appendChild\(srow\);/.test(bm));
}

console.log('\nThe sheet');
{
  const link = { tag: 'div', classes: ['cc-menu-link'], attrs: { role: 'button', tabindex: '0' }, inside: ['.cc-menu'], html: ['cc-docker-on'], states: { 'focus-visible': true, focus: true } };
  const bg = candidates(withUnraid('docker'), link, 'background').pop();
  ok('a focused entry fills like a hovered one, never a ring', bg && /^var\(--cc-rb-c, var\(--cc-accent, #FCC419\)\)$/.test(bg.value) && /:focus-visible/.test(bg.selector), bg && bg.selector);
  const btn = (states) => ({ tag: 'a', classes: ['cc-btn', 'cc-menu-settings'], attrs: { href: '/Settings/TowerTorch' }, inside: ['.cc-menu', '.cc-menu-plain'], html: ['cc-docker-on'], states: states || {} });
  const rest = candidates(withUnraid('docker'), btn(), 'background').pop(), hover = candidates(withUnraid('docker'), btn({ hover: true }), 'background').pop();
  ok('the settings button rests like its neighbours and fills in the colour chain on hover', rest && rest.value.indexOf('#2e2e2e') === 0 && hover && /var\(--cc-rb-c/.test(hover.value), (rest && rest.value) + ' | ' + (hover && hover.value));
  const deco = candidates(withUnraid('docker'), btn({ hover: true }), 'text-decoration').pop();
  ok('and never underlines like a link', deco && /^none/.test(deco.value), deco && deco.selector + ' ' + deco.value);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
