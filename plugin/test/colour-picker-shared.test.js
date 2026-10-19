// TowerTorch has one colour picker, CCTheme.colorPicker in cc-theme.js. The settings page
// builds every colour field with it, and a colour field of Unraid's own forms or of the container
// form gets a swatch that opens it in a panel instead of the system's picker window. What can
// quietly break it:
//   · a pick that changes the swatch but not the field, so the form submits the old colour
//   · a pick that fires no input or change, so Unraid's own handlers never hear it
//   · a hex field that gains a # it did not have, which Unraid's header fields refuse
//   · an <input type=color> that still opens the system's picker
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.dataset = {};
    this.listeners = {}; this.value = ''; this.type = ''; this.cls = new Set(); this.props = {};
    const self = this;
    this.classList = { add: (c) => self.cls.add(c), remove: (c) => self.cls.delete(c), contains: (c) => self.cls.has(c), toggle(c, f) { const w = f === undefined ? !self.cls.has(c) : !!f; w ? self.cls.add(c) : self.cls.delete(c); return w; } };
    this.style = { setProperty: (k, v) => { self.props[k] = v; }, removeProperty: (k) => { delete self.props[k]; } };
  }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.cls].join(' '); }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; return c; }
  insertBefore(c, ref) { c.parentNode = this; this.children.splice(Math.max(0, this.children.indexOf(ref)), 0, c); return c; }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  closest() { return null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  dispatchEvent(e) { (this.fired = this.fired || []).push(e.type); (this.listeners[e.type] || []).forEach((f) => f(e)); return true; }
  fire(t, extra) { const e = Object.assign({ type: t, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, extra); (this.listeners[t] || []).forEach((f) => f(e)); return e; }
  querySelectorAll(sel) { const want = sel.replace('.', ''), out = []; (function walk(n) { n.children.forEach((k) => { if (k.cls.has(want)) out.push(k); walk(k); }); })(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getBoundingClientRect() { return { left: 100, top: 100, right: 130, bottom: 130, width: 30, height: 30 }; }
  focus() { global.document.activeElement = this; }
  get offsetWidth() { return 420; }
  get offsetHeight() { return 200; }
}
const docListeners = {};
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 };
global.document = {
  documentElement: new N('html'), body: new N('body'), activeElement: null,
  createElement: (t) => new N(t), querySelectorAll: () => [], querySelector: () => null, contains: () => true,
  addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); },
  removeEventListener: (t, f) => { docListeners[t] = (docListeners[t] || []).filter((x) => x !== f); },
};
global.document.documentElement.lang = 'en';
global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout, innerWidth: 1200, innerHeight: 900, addEventListener() {}, removeEventListener() {} };
global.location = { pathname: '/Settings/DisplaySettings' };
global.navigator = { language: 'en' };
global.fetch = () => new Promise(() => {});
global.Event = function (type) { this.type = type; };
global.getComputedStyle = () => ({ zIndex: 'auto' });
require(path.join(DIR, 'scripts/cc-theme.js'));
const T = global.window.CCTheme;

console.log('\nOne picker for every colour');
{
  ok('cc-theme.js publishes the picker, the swatch and the presets', typeof T.colorPicker === 'function' && typeof T.colorSwatch === 'function' && T.PRESETS.length === 8);
  const settings = read('scripts/settings.js');
  ok('the settings page builds its colour fields with it', /colourField = window\.CCTheme\.colorPicker/.test(settings) && !/function inlinePicker\(/.test(settings));
  ok('and marks its swatches with the same helpers', /swMark = window\.CCTheme\.swMark, swMarkRow = window\.CCTheme\.swMarkRow/.test(settings));
  ok('the container form hands its colour variables to the swatch', /window\.CCTheme\.colorSwatch\(inp, \{ hash: /.test(read('scripts/docker.js')));
  ok('so do the colour fields of Unraid\'s own settings pages', /window\.CCTheme\.colorSwatch\(inp, \{ hash: /.test(read('scripts/header.js')));
  ok('no script builds a native colour input of its own', ['scripts/docker.js', 'scripts/header.js', 'scripts/settings.js', 'scripts/forms.js'].every((f) => !/\.type = "color"/.test(read(f))));
}

console.log('\nA hex text field of Unraid\'s');
{
  const dd = new N('dd'), inp = new N('input'); inp.type = 'text'; inp.value = 'fff'; dd.appendChild(inp);
  const sw = T.colorSwatch(inp, { hash: false, label: 'Header text colour' });
  ok('a swatch stands before the field', dd.children[0] === sw && dd.children[1] === inp && sw.cls.has('cc-colpick'));
  ok('showing the field\'s colour, a short hex read in full', sw.props['--cc-cp'] === '#ffffff', sw.props['--cc-cp']);
  ok('a button the keyboard reaches, named after its field', sw.attrs.role === 'button' && sw.attrs.tabindex === '0' && sw.attrs['aria-label'] === 'Header text colour');
  sw.fire('click');
  const pop = global.document.body.children.find((c) => c.cls.has('cc-cpop'));
  ok('a press opens the picker in a panel', !!pop && sw.attrs['aria-expanded'] === 'true');
  const field = pop.children[0], row = field.children[1], hex = row.children[row.children.length - 1];
  ok('the panel holds the settings page\'s field: picker, presets and hex field', field.cls.has('cc-set-pickrow') && field.children[0].cls.has('cc-ip') && row.querySelectorAll('.cc-set-sw').length === 8 && hex.cls.has('cc-set-hexin'));
  ok('and takes the focus into the hex field', global.document.activeElement === hex);
  row.querySelectorAll('.cc-set-sw')[1].fire('click');
  ok('a preset writes the field without the # the field leaves out', inp.value === '1d99f3', inp.value);
  ok('and the field hears input and change, so the form submits it', JSON.stringify(inp.fired) === '["input","change"]', JSON.stringify(inp.fired));
  ok('the swatch follows', sw.props['--cc-cp'] === '#1d99f3');
  inp.value = 'ff8389'; inp.dispatchEvent(new Event('input'));
  ok('a value typed into the field repaints the swatch', sw.props['--cc-cp'] === '#ff8389');
  pop.fire('keydown', { key: 'Escape' });
  ok('Escape closes the panel and gives the focus back', !global.document.body.children.includes(pop) && global.document.activeElement === sw && sw.attrs['aria-expanded'] === 'false');
}

console.log('\nA colour variable of the container form, and a native colour input');
{
  const dd = new N('dd'), inp = new N('input'); inp.type = 'text'; inp.value = ''; dd.appendChild(inp);
  const sw = T.colorSwatch(inp, { hash: true });
  ok('an empty field shows the stand-in fill', !('--cc-cp' in sw.props));
  sw.fire('click');
  const pop = global.document.body.children.find((c) => c.cls.has('cc-cpop'));
  pop.children[0].children[1].querySelectorAll('.cc-set-sw')[2].fire('click');
  ok('a pick writes the # where the field takes one', inp.value === '#6fdc8c', inp.value);
  (docListeners.pointerdown || []).slice().forEach((f) => f({ target: global.document.body }));
  ok('a press outside closes the panel', !global.document.body.children.includes(pop));

  const nat = new N('input'); nat.type = 'color'; nat.value = '#123456'; dd.appendChild(nat);
  const nsw = T.colorSwatch(nat, {});
  ok('a native colour input becomes the swatch itself', nsw === nat && nat.cls.has('cc-colpick') && dd.children.filter((c) => c.cls.has('cc-colpick')).length === 2);
  const e = nat.fire('click');
  ok('its press opens TowerTorch\'s picker, not the system\'s', e.defaultPrevented && global.document.body.children.some((c) => c.cls.has('cc-cpop')));
  ok('and so do Enter and Space', nat.listeners.keydown && nat.listeners.keydown.length === 1);
}

console.log('\nThe panel looks like the settings page\'s field');
{
  const tokens = read('sheets/TowerTorch.Tokens.css');
  ok('the picker\'s look lives in the sheet every page loads', /\.cc-ip-sv \{/.test(tokens) && /\.cc-set-sw-on::after \{/.test(tokens) && !/\.cc-ip-sv \{/.test(read('styles/docker.css')));
  ok('the panel stays dark on a light theme', /\.cc-rowmenu, \.cc-cpop,/.test(tokens));
  const sw = candidates('every', { tag: 'span', classes: ['cc-colpick'] }, 'background').pop();
  ok('the swatch is filled with the field\'s colour', !!sw && /var\(--cc-cp/.test(sw.value), sw && sw.value);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
