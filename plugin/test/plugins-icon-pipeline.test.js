// Pins the Plugins-tab icon pipeline in plugins.js, with the harness the sibling
// icon-pipeline tests use pointed at this file.
//
// plugIconInk() and paintRow() read eff("iconbg") rather than the
// cc-plugins-iconbg class on <html>. paint() only rewrites that class after the
// row loop that has already read it, so the class is unset on the first load and
// one paint behind after a live settings change from another tab.
//
// It also pins that logoSize()'s cc.sgsize map matches docker.js's ccLogoSizes()
// and vms.js's vmLogoSizes(), and that a glyph never carries both a direct colour
// and a tint filter.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const PLUGINS = process.argv[2] || path.join(DIR, 'plugins.js');

class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this.attrs = {}; this.dataset = {};
    this.style = {
      setProperty: (k, v) => { this._s = this._s || {}; this._s[k] = v; },
      removeProperty: (k) => { if (this._s) delete this._s[k]; },
      cssText: ''
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  documentElement: new N('html'),
  body: new N('body'),
};
document.body.appendChild = function (c) { N.prototype.appendChild.call(this, c); if (c.attrs.id || c.id) byId[c.id || c.attrs.id] = c; return c; };
global.document = document;

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = { localStorage: global.localStorage, CCTheme: null };

// Pull the functions under test out of plugins.js.
const src = fs.readFileSync(PLUGINS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in plugins.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB_PAL and RB_OFFSET stand in for the module-level palette vars, normally
// window.CCTheme.RB and a persisted seed, pinned to the shipped palette at offset 0
// so colorFor(i) is deterministic.
const pluginsApi = new Function('document', 'localStorage', 'window',
  'var RB_PAL = ["#d9433f","#f97316","#fcc419","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('ls') + '\n' + grabFn('eff') + '\n' + grabFn('iconBgAdoptsP') + '\n' + grabFn('iconBgOnP') + '\n' + grabFn('idealText') + '\n' + grabFn('accent') + '\n' +
  grabFn('storedPal') + '\n' + grabFn('pal') + '\n' + grabFn('colorFor') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' +
  grabFn('plugTintOn') + '\n' + grabFn('plugBgColor') + '\n' +
  grabFn('plugIconInk') + '\n' + grabFn('logoSize') + '\n' + grabFn('plugGlyphInkAndFilter') + '\n' +
  'return { iconBgOnP: iconBgOnP, eff: eff, plugTintOn: plugTintOn, plugBgColor: plugBgColor, plugIconInk: plugIconInk, logoSize: logoSize, plugGlyphInkAndFilter: plugGlyphInkAndFilter, idealText: idealText, accent: accent, colorFor: colorFor };'
)(document, global.localStorage, global.window);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); document.documentElement.classList = new CL(); };

console.log('\nplugIconInk() resolves from eff("iconbg"), never from the DOM class');
{
  reset();
  // Both states the class can be in: never set, as on a first paint, and stale from
  // a previous paint after a settings change in another tab.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('cc.iconbg=1 with the class unset still resolves the ink', /^#[0-9a-f]{6}$/i.test(pluginsApi.plugIconInk(false)), pluginsApi.plugIconInk(false));
  ok('and it is the picked colour, the badge not overriding it', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();

  localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  document.documentElement.classList.add('cc-plugins-iconbg');
  ok('cc.iconbg=0 with the class set resolves the picked colour, not the badge ink', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();
}

console.log('\nHintergrund and Einfärben stay independent: the badge alone does not tint');
{
  reset();
  ok('nothing configured at all: no ink', pluginsApi.plugIconInk(false) === '');

  localStorage.setItem('cc.iconbg', '1');
  ok('background on, Einfärben untouched, no colour picked: no ink', pluginsApi.plugIconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background on, Einfärben off: no ink even with the badge showing', pluginsApi.plugIconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background on, Einfärben on, no colour picked: no ink to lift', pluginsApi.plugIconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background on, Einfärben on, colour picked: inked in that colour', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  reset();

  // On an install with cc.iconbg and cc.iconcolor and no cc.icontint, the colour's
  // presence is the tint signal, which plugTintOn()'s fallback keeps reading.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('no cc.icontint key at all: the icon is inked', pluginsApi.plugTintOn() === true && pluginsApi.plugIconInk(false) !== '');
  reset();

  // With both controls on and two different colours, the ink is the tint's own,
  // never a contrast colour derived from the badge box.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('the background colour applies with Einfärben off', pluginsApi.plugBgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('with both on, the ink is the tint colour', pluginsApi.plugIconInk(false) === '#e5a00d', pluginsApi.plugIconInk(false));
  ok('and the badge box keeps its own colour', pluginsApi.plugBgColor() === '#161616', pluginsApi.plugBgColor());
  reset();
}

console.log('\ncc.iconbgrainbow: "Badge-Farben übernehmen" takes over the colours only');
{
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('not adopting: plugBgColor() is the picked background colour', pluginsApi.plugBgColor() === '#e5a00d', pluginsApi.plugBgColor());
  ok('not adopting: plugIconInk() is the picked tint colour', pluginsApi.plugIconInk(false) === '#00aa00', pluginsApi.plugIconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: plugBgColor() answers "", so no --cc-iconbg-color is stamped and docker.css falls through to the source every generic plugin badge uses', pluginsApi.plugBgColor() === '', JSON.stringify(pluginsApi.plugBgColor()));

  localStorage.setItem('cc.rainbow', '0');
  ok('adopting with rainbow off: the ink is the contrast colour for the plain accent', pluginsApi.plugIconInk(false) === pluginsApi.idealText(pluginsApi.colorFor(5)), pluginsApi.plugIconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting with rainbow on: the ink is the contrast colour for the colorFor(5) a generic badge resolves to', pluginsApi.plugIconInk(false) === pluginsApi.idealText(pluginsApi.colorFor(5)), pluginsApi.plugIconInk(false) + ' vs idealText(' + pluginsApi.colorFor(5) + ')');
  ok('and not the picked colour', pluginsApi.plugIconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontint', '0');
  ok('adopting with Tint icons off: no ink, the icons keep their own colours', pluginsApi.plugIconInk(false) === '', pluginsApi.plugIconInk(false));
  localStorage.setItem('cc.icontint', '1');

  localStorage.setItem('cc.iconbg', '0');
  ok('adopting with Logo tiles off: no tile', pluginsApi.iconBgOnP() === false);
  ok('and the ink is the badge colour itself, with no tile to contrast against', !/^(#fff|#161616|)$/.test(pluginsApi.plugIconInk(false)), pluginsApi.plugIconInk(false));
  localStorage.setItem('cc.iconbg', '1');

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle off brings the picked colour back', pluginsApi.plugIconInk(false) === '#00aa00', pluginsApi.plugIconInk(false));
  reset();
}

console.log('\nThe contrast ink per row, rather than one colour for the page');
{
  // While adopting, plugIconInk() answers one colour for the whole page, taken from
  // palette slot 5, but paintRow() stamps a rotating colorFor(idx) per row. Slot 2,
  // the yellow, is the one that needs black ink instead of white, so a row landing
  // there would read white on yellow. paintRow() reuses idealText(colorFor(idx))
  // for that row's own ink.
  reset();
  localStorage.setItem('cc.iconbgrainbow', '1');
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.icontint', '1');
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('slot 5, the one plugIconInk() is fixed to, is #2f6feb and takes white ink', pluginsApi.colorFor(5) === '#2f6feb' && pluginsApi.idealText(pluginsApi.colorFor(5)) === '#fff');
  ok('slot 2 is the yellow #fcc419 and takes black ink', pluginsApi.colorFor(2) === '#fcc419' && pluginsApi.idealText(pluginsApi.colorFor(2)) === '#161616');

  var rowInkAtIdx2 = pluginsApi.idealText(pluginsApi.colorFor(2));
  ok('a row at index 2, whose own colour is the yellow, resolves to black ink', rowInkAtIdx2 === '#161616', rowInkAtIdx2);
  ok('...which differs from the page-wide plugIconInk() answer for the same settings', rowInkAtIdx2 !== pluginsApi.plugIconInk(false), rowInkAtIdx2 + ' vs ' + pluginsApi.plugIconInk(false));

  var rowInkAtIdx5 = pluginsApi.idealText(pluginsApi.colorFor(5));
  ok('a row at index 5 gets white ink', rowInkAtIdx5 === '#fff', rowInkAtIdx5);

  // With rainbow off, colorFor(i) is the flat accent at every index, so one colour
  // for the page is the right answer there.
  localStorage.setItem('cc.rainbow', '0');
  ok('rainbow off: colorFor(2) is the same flat accent as colorFor(5)', pluginsApi.colorFor(2) === pluginsApi.colorFor(5));
  ok('...so the per-row ink and plugIconInk()\'s answer agree', pluginsApi.idealText(pluginsApi.colorFor(2)) === pluginsApi.plugIconInk(false));
  reset();
}

console.log('\nlogoSize(): the cc.sgsize map docker.js and vms.js use as well');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> 48px', pluginsApi.logoSize() === '48px');
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> 62px', pluginsApi.logoSize() === '62px');
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> 76px', pluginsApi.logoSize() === '76px');
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> 62px', pluginsApi.logoSize() === '62px');
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to 62px', pluginsApi.logoSize() === '62px');
  reset();
}

console.log('\nA glyph never carries both a direct colour and the luminance-tint filter');
{
  const w = 'url(#cc-plug-tint)';
  ok('native treat: no colour, the filter set to "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d', w); return !r.color && r.filter === 'none'; })());
  // The caller resolves the badge-contrast ink into pInk before calling, so the
  // badge state changes nothing on its own.
  ok('Hintergrund on with treat "tint": the colour is the resolved ink, the filter "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d', w); return r.color === '#e5a00d' && r.filter === 'none'; })());
  ok('an ink colour with treat "tint": the colour is set, the filter "none"', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d', w); return r.color === '#e5a00d' && r.filter === 'none'; })());
  ok('no ink: the filter carries the treatment and the colour stays empty', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '', w); return !r.color && r.filter === w; })());
  // pInk answers "" whenever Einfärben is off, badge or no badge, so the badge
  // state alone must not put a colour on a glyph.
  ok('Hintergrund on with no ink: no colour is forced onto the glyph', (function () { const r = pluginsApi.plugGlyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '', w); return !r.color; })());
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
