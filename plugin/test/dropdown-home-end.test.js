// Home and End on a closed dropdown open it on its first or last option, as on GlimStone's Select,
// and the open list answers the arrows, Home, End, Enter, Space and Escape. Each of TowerTorch's
// five dropdown builders is run against a small DOM, the way a keyboard reaches it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + name);
}

class CL {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach((x) => this.s.add(x)); } remove(...c) { c.forEach((x) => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
let active = null;
class N {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.classList = new CL(); this._txt = ''; this.attrs = {}; this.listeners = {}; this.style = { setProperty() {}, removeProperty() {} }; this.disabled = false; }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classList.s].join(' '); }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); const i = ref ? this.children.indexOf(ref) : -1; c.parentNode = this; i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatchEvent(ev) {
    ev.target = ev.target || this;
    for (let n = this; n; n = ev.bubbles ? n.parentNode : null) { (n.listeners[ev.type] || []).forEach((fn) => fn.call(n, ev)); if (ev.stopped) break; }
    return !ev.defaultPrevented;
  }
  click() { this.dispatchEvent(new Ev('click', { bubbles: true })); }
  focus() { active = this; }
  closest(sel) { for (let n = this; n; n = n.parentNode) if (n._match && n._match(sel)) return n; return null; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  walk(out = []) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  _match(sel) {
    const m = String(sel).trim().match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!this.classList.contains(c.slice(1))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) if (!(a.slice(1, -1).split('=')[0] in this.attrs)) return false;
    return true;
  }
  querySelectorAll(sel) { const parts = String(sel).split(','); return this.walk().filter((n) => parts.some((s) => n._match(s))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }; }
  get offsetHeight() { return 100; }
}
class Opt extends N { constructor(t) { super('option'); this.textContent = t; this.selected = false; } get text() { return this.textContent; } }
class Sel extends N {
  constructor() { super('select'); this._si = -1; }
  get options() { return this.children.filter((c) => c.tagName === 'OPTION'); }
  get selectedIndex() { return this._si; }
  set selectedIndex(i) { this._si = i; this.options.forEach((o, k) => { o.selected = k === i; }); }
  get value() { return this._si >= 0 ? this.options[this._si].text : ''; }
  get form() { return null; }
}
class Ev { constructor(t, o = {}) { this.type = t; this.bubbles = !!o.bubbles; this.key = o.key; this.defaultPrevented = false; this.stopped = false; } preventDefault() { this.defaultPrevented = true; } stopPropagation() { this.stopped = true; } }
const body = new N('body');
const document = {
  createElement: (t) => (t === 'select' ? new Sel() : t === 'option' ? new Opt('') : new N(t)),
  documentElement: new N('html'), body,
  get activeElement() { return active; },
  addEventListener() {}, removeEventListener() {},
  querySelectorAll: (s) => body.querySelectorAll(s),
  querySelector: (s) => body.querySelector(s),
};
const window = { innerHeight: 800, addEventListener() {}, removeEventListener() {} };
const getComputedStyle = () => ({ transform: 'none', perspective: 'none', filter: 'none', willChange: '' });
const localStorage = { getItem: () => null, setItem() {} };

// tt-theme.js's helpers, as every builder reaches them through window.TTTheme.
const theme = read('tt-theme.js');
window.TTTheme = new Function('document', 'window', grab(theme, 'pressable') + '\n' + grab(theme, 'listKeys') + '\nreturn { pressable: pressable, listKeys: listKeys };')(document, window);

function select(names, disabled = []) {
  const s = new Sel();
  names.forEach((t, i) => { const o = new Opt(t); o.disabled = disabled.includes(i); s.appendChild(o); });
  s.selectedIndex = 1;
  const holder = new N('div'); holder.appendChild(s); body.appendChild(holder);
  return s;
}
const key = (node, k) => { const e = new Ev('keydown', { bubbles: true, key: k }); e.target = node; node.dispatchEvent(e); return e; };
const text = (n) => (n ? n.textContent : '(none)');

function suite(name, build, cls) {
  console.log('\n' + name);
  const sel = select(['Alpha', 'Bravo', 'Charlie', 'Delta'], [3]);
  const wrap = build(sel) || sel.parentNode;
  const trig = wrap.querySelector('.' + cls + '-trigger'), panel = wrap.querySelector('.' + cls + '-panel');
  ok('the list is a listbox of options', panel.getAttribute('role') === 'listbox' && panel.querySelectorAll('.' + cls + '-opt').every((c) => c.getAttribute('role') === 'option'));
  active = trig;
  let e = key(trig, 'End');
  ok('End on the closed trigger opens the list', wrap.classList.contains('tt-open') && e.defaultPrevented);
  ok('on its last option that can be picked', text(active) === 'Charlie', text(active));
  key(active, 'ArrowUp');
  ok('ArrowUp moves up', text(active) === 'Bravo', text(active));
  key(active, 'Home');
  ok('Home in the list goes to the first', text(active) === 'Alpha', text(active));
  key(active, 'ArrowDown'); key(active, 'Enter');
  ok('Enter picks the option and closes', sel.selectedIndex === 1 && !wrap.classList.contains('tt-open'), sel.selectedIndex + ' ' + wrap.className);
  active = trig;
  key(trig, 'Home');
  ok('Home on the closed trigger opens it on the first option', wrap.classList.contains('tt-open') && text(active) === 'Alpha', text(active));
  key(active, 'Escape');
  ok('Escape closes it and gives the focus back', !wrap.classList.contains('tt-open') && active === trig);
  sel.disabled = true; active = trig;
  key(trig, 'End');
  ok('a disabled dropdown stays closed', !wrap.classList.contains('tt-open'));
  sel.disabled = false;
}

// docker.js: the container form's dropdowns.
{
  const src = read('docker.js');
  const fns = ['el', 'selTrigger', 'ctWrapSelect', 'ttPositionDsel', 'ctSyncOne'].map((n) => grab(src, n)).join('\n');
  const ctWrapSelect = new Function('document', 'window', 'Event', 'getComputedStyle', fns + '\nreturn ctWrapSelect;')(document, window, Ev, getComputedStyle);
  suite('docker.js, the container form', (s) => { ctWrapSelect(s); return s.parentNode; }, 'tt-dsel');
}
// shares.js: the share pages.
{
  const src = read('shares.js');
  const fns = ['el', 'ttWrapSelect', 'ttSyncOne', 'ttSyncGroup'].map((n) => grab(src, n)).join('\n');
  const ttWrapSelect = new Function('document', 'window', 'Event', fns + '\nreturn ttWrapSelect;')(document, window, Ev);
  suite('shares.js, the share pages', (s) => { ttWrapSelect(s); return s.parentNode; }, 'tt-sel');
}
// vms.js: the limits window.
{
  const src = read('vms.js');
  const fns = ['el', 'vmDsel', 'vmDselSync', 'vmDselPosition'].map((n) => grab(src, n)).join('\n');
  const vmDsel = new Function('document', 'window', 'Event', fns + '\nreturn vmDsel;')(document, window, Ev);
  suite('vms.js, the limits window', (s) => { const w = vmDsel(s); body.appendChild(w); return w; }, 'tt-dsel');
}
// settings.js: TowerTorch's settings page.
{
  const src = read('settings.js');
  const fns = ['el', 'ttDsel', 'ttDselSync', 'ttDselPosition'].map((n) => grab(src, n)).join('\n');
  const ttDsel = new Function('document', 'window', 'Event', fns + '\nreturn ttDsel;')(document, window, Ev);
  suite('settings.js, the settings page', (s) => { const w = ttDsel(s); body.appendChild(w); return w; }, 'tt-dsel');
}
// header.js: Unraid's own settings and tools pages.
{
  const src = read('header.js');
  const fns = ['ttMkEl', 'ttLangLabel', 'ttToolsWrapSelect', 'ttTselMove', 'ttTselEnd', 'ttToolsSyncSel', 'ttPositionTsel'].map((n) => grab(src, n)).join('\n');
  const ttToolsWrapSelect = new Function('document', 'window', 'Event', 'localStorage', 'ttTselSeq', 'ttBindTselDoc', 'ttLangAugmentPanel', fns + '\nreturn ttToolsWrapSelect;')(document, window, Ev, localStorage, 0, () => {}, () => {});
  suite('header.js, Unraid\'s settings and tools pages', (s) => { ttToolsWrapSelect(s); return s.parentNode; }, 'tt-tsel');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
