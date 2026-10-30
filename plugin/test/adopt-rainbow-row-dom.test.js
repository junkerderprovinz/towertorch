// Builds settings.js's logoToggles() against a DOM shim, for the two things the
// string-slice checks in adopt-rainbow-ui.test.js cannot see: that io.hideAdoptRow
// keeps the adopt row out of the built tree rather than hiding it with CSS, and
// that while the master toggle adopts, the Logo tiles and Tint icons switches
// stay while their pickers give way to one line that names what decides and
// jumps there, and come back the moment adopting stops.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const SETTINGS = process.argv[2] || path.join(DIR, 'settings.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The DOM shim from icon-pipeline.test.js.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.listeners = {};
    this.dataset = {};
    this.style = { setProperty: () => {}, removeProperty: () => {}, cssText: '' };
  }
  get className() { return [this._cls, ...this.classList.s].filter(Boolean).join(' '); }
  set className(v) { this._cls = ''; this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const document = { documentElement: { lang: 'en' }, createElement: t => new N(t), addEventListener: () => {}, removeEventListener: () => {} };

// Pull the builders out of settings.js.
const src = fs.readFileSync(SETTINGS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settings.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// The colour field comes from cc-theme.js, which the page reads as window.CCTheme.colorPicker.
const theme = fs.readFileSync(path.join(DIR, 'cc-theme.js'), 'utf8');
function grabTheme(name) {
  const i = theme.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in cc-theme.js: ' + name);
  let d = 0;
  for (let k = theme.indexOf('{', i); k < theme.length; k++) { if (theme[k] === '{') d++; else if (theme[k] === '}') { d--; if (!d) return theme.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const jumps = [];
const build = new Function('document', 'window', 'jumpTo',
  'var de = false;\n' +   // the English labels, so the assertions can search for ASCII text
  grabFn('el') + '\n' + grabFn('T') + '\n' + grabFn('infoIcon') + '\n' + grabFn('normHex') + '\n' + grabFn('toggle') + '\n' +
  grabFn('actionBtn') + '\n' + grabFn('labelled') + '\n' + grabFn('inlineRow') + '\n' + grabFn('lockRow') + '\n' + grabFn('fieldRow') + '\n' +
  ['hexToHsv', 'hsvToHex', 'div', 'german', 'pressable', 'inlinePicker', 'swTick', 'swMark', 'swMarkRow', 'idealText', 'colorPicker'].map(grabTheme).join('\n') + '\n' +
  'var PRESETS = ["#FCC419", "#1D99F3"], colourField = colorPicker;\n' + grabFn('logoToggles') + '\n' +
  'return { logoToggles: logoToggles };'
)(document, {}, (sec, title) => jumps.push([sec, title]));
const lockOf = (into) => into.children.find((c) => c.classList.contains('cc-set-locked'));

// An in-memory io in the shape the real call sites pass.
function makeIo(extra) {
  const state = { bg: false, bgColor: '#e5a00d', tint: false, color: '#00aa00', adopt: false, bgCalls: 0, tintCalls: 0 };
  return Object.assign({
    getBg: () => state.bg, setBg: v => { state.bg = v; state.bgCalls++; },
    getBgColor: () => state.bgColor, setBgColor: v => { state.bgColor = v; },
    getTint: () => state.tint, setTint: v => { state.tint = v; state.tintCalls++; },
    getColor: () => state.color, setColor: v => { state.color = v; },
    getAdopt: () => state.adopt, setAdopt: v => { state.adopt = v; },
    getAccent: () => '#2f6feb', onChange: () => {},
  }, extra, { _state: state });
}

console.log('\nio.hideAdoptRow keeps the adopt row out of the built DOM');
{
  const globalInto = document.createElement('div');
  build.logoToggles(globalInto, makeIo());
  ok('the global card, without hideAdoptRow, carries the adopt label', globalInto.textContent.indexOf('Use the badge colours') >= 0, globalInto.textContent);

  const areaInto = document.createElement('div');
  build.logoToggles(areaInto, makeIo({ hideAdoptRow: true }));
  ok('an area card, with hideAdoptRow, has no adopt label in its tree', areaInto.textContent.indexOf('Use the badge colours') < 0, areaInto.textContent);
  ok('and the area card still builds its own Logo tiles and Tint icons rows', areaInto.textContent.indexOf('Logo tiles') >= 0 && areaInto.textContent.indexOf('Tint icons') >= 0);
}

console.log('\nAdopting takes over the colours, and the switches stay');
{
  const into = document.createElement('div');
  const io = makeIo({ hideAdoptRow: true });
  const h = build.logoToggles(into, io);
  const lock = lockOf(into);
  const fields = into.children.filter((c) => c.classList.contains('cc-set-fieldrow'));

  ok('not adopting: the Logo tiles and Tint icons rows show', !h.bgToggle.parentNode.hidden && !h.tintToggle.parentNode.hidden);
  ok('not adopting: the line is hidden', lock && lock.hidden === true);
  h.bgToggle.listeners.click[0]();
  ok('not adopting: clicking the Logo tiles switch flips it', io._state.bgCalls === 1, io._state.bgCalls);
  ok('the tile on: its colour field shows', !fields[0].hidden);

  io._state.adopt = true; // as if the master row, hidden on this card, had been used elsewhere
  h.sync();
  ok('adopting: both switch rows stay', !h.bgToggle.parentNode.hidden && !h.tintToggle.parentNode.hidden);
  ok('adopting: the colour fields give way', fields.every((f) => f.hidden));
  ok('adopting: the line shows in their place', lock.hidden === false);
  ok('on an area card it names the global card', /Follows General/.test(lock.textContent) && /Go to Logos & icons/.test(lock.textContent), lock.textContent);
  const jump = lock.children[1].children.find((c) => c.attrs.role === 'button');
  jump.listeners.click[0]();
  ok('and its button jumps to that card', jumps.length === 1 && jumps[0][0] === 'general' && jumps[0][1] === 'Logos & icons', JSON.stringify(jumps));
  h.tintToggle.listeners.click[0]();
  ok('adopting: clicking the Tint icons switch still flips it', io._state.tintCalls === 1, io._state.tintCalls);
  ok('adopting: the strength still tunes the tint', h.strInput.parentNode.hidden === false);
  io._state.bg = false; io._state.tint = false; h.sync();
  ok('adopting with both switches off: no colour to name, so no line', lock.hidden === true);

  io._state.adopt = false; io._state.tint = true;
  h.sync();
  ok('adopting off again: the tint\'s colour field is back', !fields[1].hidden && lock.hidden);
}

console.log('\nA picker or the strength under a switch that is off is left out');
{
  const into = document.createElement('div');
  const io = makeIo();
  const h = build.logoToggles(into, io);
  // each colour field stands in a row of its own beside its name
  const pickers = into.children.filter((c) => c.classList.contains('cc-set-fieldrow') && c.children.some((k) => k.classList.contains('cc-set-pickrow')));
  ok('both colour fields are built, each with the presets and the hex field', pickers.length === 2 && pickers.every((p) => p.children[1].children[1].children.length === 3));
  ok('both switches off: no picker and no strength', pickers.every((p) => p.hidden) && h.strInput.parentNode.hidden);
  io._state.tint = true; h.sync();
  ok('the tint on: its picker and the strength come in', !pickers[1].hidden && !h.strInput.parentNode.hidden && pickers[0].hidden);
  const lock = lockOf(into);
  io._state.adopt = true; h.sync();
  ok('on the global card the line names the Badges card', /Badges/.test(lock.textContent), lock.textContent);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
