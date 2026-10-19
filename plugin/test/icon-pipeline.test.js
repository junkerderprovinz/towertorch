// Pins the icon pipeline across cc-theme.js and docker.js.
//
// Ink-flattening turns a full-colour icon, a coloured background under a mark of
// another colour, into one illegible blob, while a flat glyph takes it perfectly.
// The pipeline decides between flattening and tinting, and every branch of that
// decision is pinned here, along with the darkness guard that keeps a very dark
// target from vanishing into the dark surfaces underneath it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');
const DOCKER = process.argv[3] || path.join(DIR, 'docker.js');

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
    this.dataset = {}; this.selected = false;
    this._style = {};
    this.style = {
      setProperty: (k, v) => { this._style[k] = v; },
      removeProperty: (k) => { delete this._style[k]; },
      cssText: ''
    };
  }
  get className() { return [this._cls, ...this.classList.s].filter(Boolean).join(' '); }
  set className(v) { this._cls = ''; this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: new N('html'),
  body: new N('body'),
  cookie: ''
};
document.body.appendChild = function (c) { N.prototype.appendChild.call(this, c); if (c.attrs.id || c.id) byId[c.id || c.attrs.id] = c; return c; };
global.document = document;
global.navigator = { language: 'en' };

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document, setTimeout, clearTimeout };
// cc-theme.js's cross-origin settings sync skips the two pages that already sync; pretend to
// be /Docker so that block returns immediately and the test only exercises the icon pipeline.
global.location = { pathname: '/Docker' };
global.fetch = () => new Promise(() => {});   // the batch lookup never resolves in this test

// Load cc-theme.js the way the browser does.
require(THEME);
const CCTheme = global.window.CCTheme;
if (!CCTheme || !CCTheme.icons) throw new Error('cc-theme.js did not export window.CCTheme.icons');

// Pull the filter builders and iconInk out of docker.js.
const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB_PAL and RB_OFFSET stand in for the module-level palette vars, normally
// window.CCTheme.RB and a persisted seed, pinned to the shipped palette at offset 0
// so ccRbColor(i) and iconAdoptTint() are deterministic.
const dockerApi = new Function('document', 'localStorage', 'window',
  'var RB_PAL = ["#d9433f","#f97316","#fcc419","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('effc') + '\n' + grabFn('iconBgAdopts') + '\n' + grabFn('iconBgOn') + '\n' + grabFn('themingOn') + '\n' +
  grabFn('idealText') + '\n' + grabFn('ccHex6') + '\n' + grabFn('tintOn') + '\n' + grabFn('ccPalStored') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' + grabFn('iconAdoptTint') + '\n' + grabFn('bgColor') + '\n' + grabFn('iconInk') + '\n' + grabFn('itemAdoptInk') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' + grabFn('ensureTintFilterAs') + '\n' + grabFn('ensureTintFilter') + '\n' + grabFn('ccLogoSizes') + '\n' + grabFn('glyphInkAndFilter') + '\n' +
  'return { iconInk: iconInk, iconBgOn: iconBgOn, itemAdoptInk: itemAdoptInk, tintOn: tintOn, bgColor: bgColor, ensureFlatFilter: ensureFlatFilter, ensureMonoFilter: ensureMonoFilter, ensureTintFilter: ensureTintFilter, ensureTintFilterAs: ensureTintFilterAs, ccLogoSizes: ccLogoSizes, glyphInkAndFilter: glyphInkAndFilter, idealText: idealText, effc: effc, iconAdoptTint: iconAdoptTint, ccRbColor: ccRbColor };'
)(document, global.localStorage, global.window);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const CI = CCTheme.icons;
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\nThe resolution chain: cheapest local check first, every step degrades into the next');
{
  const S = CI.SIMPLE_MAX;
  let p = CI.plan('auto', '', 4);
  ok('an already-simple icon flattens on its own pixels, with no network involved', p.treat === 'flat' && p.src === 'native', JSON.stringify(p));

  p = CI.plan('auto', 'glyph', 90);
  ok('a complex icon with a glyph match flattens the glyph, not the shipped art', p.treat === 'flat' && p.src === 'glyph', JSON.stringify(p));

  p = CI.plan('auto', 'color', 90);
  ok('a complex icon with only a colour match tints the curated colour icon', p.treat === 'tint' && p.src === 'color', JSON.stringify(p));

  p = CI.plan('auto', '', 90);
  ok('nothing anywhere: tint the native icon rather than flatten it to a blob', p.treat === 'tint' && p.src === 'native', JSON.stringify(p));

  p = CI.plan('auto', '', null);
  ok('not measured yet: tint, which the measurement can upgrade later', p.treat === 'tint' && p.src === 'native', JSON.stringify(p));

  ok('the simplicity threshold is a number on the 0-255 luminance scale', typeof S === 'number' && S > 0 && S < 255, String(S));
  ok('the threshold itself counts as complex, the boundary being exclusive', CI.plan('auto', '', S).treat === 'tint');
  ok('just under the threshold counts as simple', CI.plan('auto', '', S - 0.01).treat === 'flat');
}

console.log('\nThe threshold sits in the empty gap measured across a real 55-container box');
{
  // Spreads measured on a real box. Everything in `flatten` is a flat glyph, and
  // everything in `keep` has internal structure flattening would destroy, such as
  // question.png's "?" vanishing into a solid disc.
  const flatten = { Plex: 0.53, FileBot: 0.47, Immich: 0.57, Nginx: 0.79, Nextcloud: 0.94, Ollama: 0.74, CCWB: 3.4 };
  const keep = { CrowdSec: 17.33, StirlingPDF: 18.07, 'question.png': 19.78, Palworld: 32.99, OpenCloud: 39.02, BombVault: 45.87, featherdrop: 60.82 };
  Object.keys(flatten).forEach(n => ok(n + ' (' + flatten[n] + ') flattens', CI.plan('auto', '', flatten[n]).treat === 'flat'));
  Object.keys(keep).forEach(n => ok(n + ' (' + keep[n] + ') is not flattened', CI.plan('auto', '', keep[n]).treat === 'tint'));
  ok('the threshold sits inside the measured gap 3.4 to 17.33', CI.SIMPLE_MAX > 3.4 && CI.SIMPLE_MAX < 17.33, String(CI.SIMPLE_MAX));
}

console.log('\nStep 1 outranks step 2: a simple icon is never replaced by a downloaded glyph');
{
  const p = CI.plan('auto', 'glyph', 3);
  ok('own already-simple artwork wins over an external glyph', p.src === 'native' && p.treat === 'flat', JSON.stringify(p));
}

console.log('\nA glyph is only ever chosen when it will actually be INKED');
{
  ok('native mode never picks a glyph (an un-inked glyph would be a black square)', CI.plan('native', 'glyph', 90).src !== 'glyph');
  ok('tint mode never picks a glyph either', CI.plan('tint', 'glyph', 90).src !== 'glyph');
  ok('flat mode is the one that picks it', CI.plan('flat', 'glyph', 90).src === 'glyph');
}

console.log('\nThe manual overrides are overrides, not suggestions');
{
  let p = CI.plan('flat', '', 200);
  ok('flat flattens even artwork the heuristic calls complex', p.treat === 'flat' && p.src === 'native', JSON.stringify(p));
  p = CI.plan('tint', '', 1);
  ok('tint tints even artwork the heuristic calls simple', p.treat === 'tint', JSON.stringify(p));
  p = CI.plan('native', '', 1);
  ok('native leaves the pixels alone whatever the heuristic says', p.treat === 'native', JSON.stringify(p));
  p = CI.plan('native', 'color', 200);
  ok('native still prefers a curated colour icon over a poor shipped one', p.src === 'color', JSON.stringify(p));
  for (const kind of ['', 'glyph', 'color', 'none']) {
    for (const spread of [1, 200, null]) {
      p = CI.plan('original', kind, spread, { bg: 0.2, mk: 0.9, mark: 'light' });
      ok('original keeps the shipped icon untouched (' + (kind || 'unknown') + ', ' + spread + ')', p.treat === 'native' && p.src === 'native', JSON.stringify(p));
    }
  }
}

console.log('\nGlobal default + per-item pin');
{
  reset();
  ok('the default with nothing configured is "auto"', CI.globalMode() === 'auto', CI.globalMode());
  ok('an item with no pin follows the global default', CI.mode('docker', 'Plex') === 'auto');

  localStorage.setItem('cc.iconmode', 'tint');
  ok('the global default is read from cc.iconmode', CI.globalMode() === 'tint');
  ok('every item follows it', CI.mode('docker', 'Plex') === 'tint' && CI.mode('vm', 'Win11') === 'tint');

  CI.setOverride('docker', 'Plex', 'flat');
  ok('a pinned item uses its OWN mode', CI.mode('docker', 'Plex') === 'flat');
  ok('every OTHER item stays on the global default', CI.mode('docker', 'Nextcloud') === 'tint' && CI.mode('vm', 'Win11') === 'tint');
  ok('the pin is namespaced per scope, so a VM of the same name is untouched', CI.mode('vm', 'Plex') === 'tint');
  ok('the pin is case-insensitive on the name', CI.mode('docker', 'PLEX') === 'flat');

  CI.setOverride('docker', 'Plex', '');
  ok('clearing the pin returns the item to the global default', CI.mode('docker', 'Plex') === 'tint');

  CI.setOverride('docker', 'Plex', 'nonsense');
  ok('an unknown mode is not stored as a pin', CI.mode('docker', 'Plex') === 'tint');

  CI.setOverride('docker', 'Plex', 'original');
  ok('the original logo is a pin like the others', CI.mode('docker', 'Plex') === 'original' && CI.overrides()['docker:plex'] === 'original');
  CI.setOverride('docker', 'Plex', '');

  localStorage.setItem('cc.iconmode', 'nonsense');
  ok('an unknown global mode falls back to auto', CI.globalMode() === 'auto');

  localStorage.setItem('cc.iconov', '{ this is not json');
  ok('a corrupt pin map degrades to "no pins", it never throws', CI.mode('docker', 'Plex') === 'auto');
  reset();
}

console.log('\nAll pins live in ONE cc.* key, so they ride the existing settings sync');
{
  reset();
  CI.setOverride('plugin', 'TowerTorch', 'native');
  const keys = Object.keys(store);
  ok('exactly one storage key is written', keys.length === 1, JSON.stringify(keys));
  ok('and it carries the cc. prefix the sync mirrors', /^cc[a-z]*\./.test(keys[0]), keys[0]);
  reset();
}

console.log('\nThe darkness guard, CCTheme.liftDark, shared with popBadge');
{
  ok('the floor is 28', CCTheme.LUM_FLOOR === 28, String(CCTheme.LUM_FLOOR));
  ok('pure black is lifted off the dark surface', CCTheme.liftDark('#000000', '#2f6feb') !== '#000000');
  ok('a bright colour is left as chosen', CCTheme.liftDark('#e5a00d', '#2f6feb') === '#e5a00d');
  ok('a dark flag green survives the badge floor', CCTheme.liftDark('#006233', '#2f6feb') === '#006233');
  ok('navy survives the badge floor too', CCTheme.liftDark('#002868', '#2f6feb') === '#002868');
  // A tint multiplies the pixel luminance by the target, landing near half the
  // target's luma, so it needs the doubled floor. #2a2a2a, at luma 42, clears the
  // badge floor and is still hard to make out on a card.
  ok('#2a2a2a clears the badge floor', CCTheme.liftDark('#2a2a2a', '#2f6feb') === '#2a2a2a');
  ok('#2a2a2a is lifted at the tint floor', CCTheme.liftDark('#2a2a2a', '#2f6feb', CCTheme.LUM_FLOOR * 2) !== '#2a2a2a');
  ok('with an all-dark palette the guard falls back to the accent', (() => {
    localStorage.setItem('cc.rbpal', JSON.stringify(['#000000', '#050505']));
    const got = CCTheme.liftDark('#000000', '#2f6feb');
    localStorage.removeItem('cc.rbpal');
    return got === '#2f6feb';
  })());
  ok('a swapped slot comes from the active palette, so it stays on theme', (() => {
    localStorage.setItem('cc.rbpal', JSON.stringify(['#000000', '#ffcc00']));
    const got = CCTheme.liftDark('#000000', '#2f6feb');
    localStorage.removeItem('cc.rbpal');
    return got === '#ffcc00';
  })());
}

console.log('\nThe lightness guard, CCTheme.liftLight, the mirror of liftDark for light themes');
{
  const html = document.documentElement.classList;
  const ALGERIA = ['#006233', '#FFFFFF', '#D21034'];
  const withPal = (p, fn) => { localStorage.setItem('cc.rbpal', JSON.stringify(p)); try { return fn(); } finally { localStorage.removeItem('cc.rbpal'); } };
  ok('pure white is lowered off the light surface', CCTheme.liftLight('#ffffff', '#2f6feb') !== '#ffffff');
  ok('a dark colour is left as chosen', CCTheme.liftLight('#006233', '#2f6feb') === '#006233');
  ok('a flag gold survives the badge ceiling', CCTheme.liftLight('#ffce00', '#2f6feb') === '#ffce00');
  // The ceiling is 255 minus liftDark's floor, 227: #e2e2e2 (luma 226) stays and
  // #e4e4e4 (228) does not, as #1c1c1c (28) stays and #1a1a1a (26) is lifted on the dark side.
  ok('#e2e2e2 sits just under the badge ceiling', CCTheme.liftLight('#e2e2e2', '#2f6feb') === '#e2e2e2');
  ok('#e4e4e4 is just over it', CCTheme.liftLight('#e4e4e4', '#2f6feb') !== '#e4e4e4');
  ok('#d5d5d5 clears the badge ceiling', CCTheme.liftLight('#d5d5d5', '#2f6feb') === '#d5d5d5');
  ok('#d5d5d5 is lowered at the tint ceiling', CCTheme.liftLight('#d5d5d5', '#2f6feb', CCTheme.LUM_FLOOR * 2) !== '#d5d5d5');
  ok('with an all-light palette the guard falls back to the accent',
    withPal(['#ffffff', '#fafafa'], () => CCTheme.liftLight('#ffffff', '#2f6feb')) === '#2f6feb');
  ok('a swapped slot is the darkest of the active palette, so it stays on theme',
    withPal(ALGERIA, () => CCTheme.liftLight('#FFFFFF', '#2f6feb')) === '#006233');

  html.remove('Theme--white'); html.remove('Theme--azure');
  ok('a dark theme is not a light theme', CCTheme.lightTheme() === false);
  ok('on a dark theme liftSurface is liftDark', CCTheme.liftSurface('#000000', '#2f6feb') === CCTheme.liftDark('#000000', '#2f6feb'));
  ok('on a dark theme white keeps its slot', CCTheme.liftSurface('#ffffff', '#2f6feb') === '#ffffff');
  ok('on a dark theme the palette comes back as stored', (() => { const p = ALGERIA.slice(); return CCTheme.surfacePalette(p, '#2f6feb') === p; })());
  ok('on a dark theme ccRbColor paints the white stripe as stored',
    withPal(ALGERIA, () => { localStorage.setItem('cc.rainbow', '1'); localStorage.setItem('cc.rainbowrot', '0'); const c = dockerApi.ccRbColor(1); localStorage.removeItem('cc.rainbow'); localStorage.removeItem('cc.rainbowrot'); return c; }) === '#FFFFFF');

  for (const theme of ['Theme--white', 'Theme--azure']) {
    html.add(theme);
    ok(theme + ' is a light theme', CCTheme.lightTheme() === true);
    ok(theme + ': liftSurface is liftLight', CCTheme.liftSurface('#ffffff', '#2f6feb') === CCTheme.liftLight('#ffffff', '#2f6feb'));
    ok(theme + ': black keeps its slot, as it reads on a light surface', CCTheme.liftSurface('#000000', '#2f6feb') === '#000000');
    ok(theme + ': the white stripe becomes the flag green, the other slots stay',
      JSON.stringify(CCTheme.surfacePalette(ALGERIA, '#2f6feb')) === JSON.stringify(['#006233', '#006233', '#D21034']));
    ok(theme + ': ccRbColor paints the white stripe in the flag green',
      withPal(ALGERIA, () => { localStorage.setItem('cc.rainbow', '1'); localStorage.setItem('cc.rainbowrot', '0'); const c = dockerApi.ccRbColor(1); localStorage.removeItem('cc.rainbow'); localStorage.removeItem('cc.rainbowrot'); return c; }) === '#006233');
    html.remove(theme);
  }
}

console.log('\ndocker.js iconInk(): the target colour both treatments paint with');
{
  reset();
  ok('no icon colour and no Logo-Hintergrund: no ink at all, so icons stay native', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('a bright picked colour is used verbatim', dockerApi.iconInk(false) === '#e5a00d');

  localStorage.setItem('cc.iconcolor', '#2a2a2a');
  ok('a near-black pick survives the flat floor, a flat fill being its target luminance', dockerApi.iconInk(false) === '#2a2a2a');
  ok('but is lifted for the tint, which renders darker still', dockerApi.iconInk(true) !== '#2a2a2a');

  // Badge and tint are separate controls, so the badge box colour must not reach
  // the ink. The two colours differ here, so a swap cannot hide.
  localStorage.setItem('cc.iconbg', '1');
  localStorage.setItem('cc.iconbgcolor', '#1030a0'); // badge box: dark blue
  localStorage.setItem('cc.iconcolor', '#e5a00d');   // tint pick: bright orange
  ok('Hintergrund on: the ink is the picked tint colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  ok('and it is the six-digit hex every filter regex expects', /^#[0-9a-f]{6}$/i.test(dockerApi.iconInk(false)), dockerApi.iconInk(false));
  ok('the badge box keeps its own colour', dockerApi.bgColor() === '#1030a0', dockerApi.bgColor());
  localStorage.setItem('cc.iconbg', '0');
  ok('turning the badge off leaves the ink where it was', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  reset();
}

console.log('\nHintergrund and Einfärben stay independent: the badge alone does not tint');
{
  reset();
  ok('nothing configured at all: no ink', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.iconbg', '1');
  ok('background on, Einfärben untouched, no colour picked: no ink', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background on, Einfärben off: no ink even with the badge showing', dockerApi.iconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background on, Einfärben on, no colour picked: no ink to lift', dockerApi.iconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background on, Einfärben on, colour picked: inked in that colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  reset();

  // On an install with cc.iconbg and cc.iconcolor and no cc.icontint, the colour's
  // presence is the tint signal, which tintOn()'s fallback keeps reading.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('no cc.icontint key at all: the icon is inked', dockerApi.tintOn() === true && dockerApi.iconInk(false) !== '');
  reset();

  // With both controls on and two different colours, the ink is the tint's own,
  // never a contrast colour derived from the badge box.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('the background colour applies with Einfärben off', dockerApi.bgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('with both on, the ink is the tint colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  ok('and the badge box keeps its own colour', dockerApi.bgColor() === '#161616', dockerApi.bgColor());
  reset();
}

console.log('\ndocker.js honours cc.styledocker for iconcolor, iconbg and iconstrength');
{
  // Reading cc.iconcolor and its siblings directly would bypass effc(), leaving
  // Docker's own "Adopt the global icon style" toggle without visible effect and
  // the ccd.* values the Stil card writes unread.
  reset();
  localStorage.setItem('cc.iconcolor', '#e5a00d'); localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconstrength', '100');
  localStorage.setItem('ccd.iconcolor', '#00aa00'); localStorage.setItem('ccd.iconbg', '1'); localStorage.setItem('ccd.iconstrength', '40');

  ok('adopt on, cc.styledocker unset: iconInk() follows the global colour', dockerApi.iconInk(false) === '#e5a00d', dockerApi.iconInk(false));
  dockerApi.ensureTintFilter();
  var sigAdoptOn = document.getElementById('cc-tint-svg').dataset.sig;

  localStorage.setItem('cc.styledocker', '0');
  ok('adopt off: iconInk() follows the Docker-local ccd.iconbg instead', dockerApi.iconInk(false) !== '#e5a00d', dockerApi.iconInk(false));
  dockerApi.ensureTintFilter();
  var sigAdoptOff = document.getElementById('cc-tint-svg').dataset.sig;
  ok('the tint strength differs between the two states as well, 40 against 100', sigAdoptOff !== sigAdoptOn, sigAdoptOn + ' vs ' + sigAdoptOff);
  reset();
}

console.log('\ncc.iconbgrainbow: "Badge-Farben übernehmen" as one master toggle');
{
  // One toggle adopts both colours: the tile follows Rainbow or the accent, and the
  // ink becomes the automatic black or white contrast colour for it. Two
  // independent toggles could not do that, the tint being a single page-wide filter
  // that can only hold one hue. It takes over colours only, so the Logo tiles and
  // Tint icons switches still decide whether there is a tile and a tint at all.
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('adopt OFF (default): bgColor() is the independently picked background colour', dockerApi.bgColor() === '#e5a00d', dockerApi.bgColor());
  ok('adopt OFF (default): iconInk() is the independently picked tint colour', dockerApi.iconInk(false) === '#00aa00', dockerApi.iconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: bgColor() answers "", so no --cc-iconbg-color is stamped and the var chain falls through to the source every generic badge uses', dockerApi.bgColor() === '', JSON.stringify(dockerApi.bgColor()));

  localStorage.setItem('cc.rainbow', '0');
  ok('adopting with rainbow off: the ink is the contrast colour for the plain accent', dockerApi.iconInk(false) === dockerApi.idealText(dockerApi.iconAdoptTint()), dockerApi.iconInk(false));
  ok('and that accent is dark enough for white ink', dockerApi.iconInk(false) === '#fff', dockerApi.iconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting with rainbow on: the ink is the contrast colour for the ccRbColor(5) a generic badge resolves to', dockerApi.iconInk(false) === dockerApi.idealText(dockerApi.ccRbColor(5)), dockerApi.iconInk(false) + ' vs idealText(' + dockerApi.ccRbColor(5) + ')');
  ok('and not the picked colour', dockerApi.iconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontint', '0');
  ok('adopting with Tint icons off: no ink, the icons keep their own colours', dockerApi.iconInk(false) === '', dockerApi.iconInk(false));
  localStorage.setItem('cc.icontint', '1');

  localStorage.setItem('cc.iconbg', '0');
  ok('adopting with Logo tiles off: no tile, whatever the adopt toggle says', dockerApi.iconBgOn() === false);
  ok('and the ink is the badge colour itself rather than a contrast for a tile that is not there', dockerApi.iconInk(false) !== '#fff' && dockerApi.iconInk(false) !== '#161616' && dockerApi.iconInk(false) !== '', dockerApi.iconInk(false));
  localStorage.setItem('cc.iconbg', '1');
  ok('adopting with Logo tiles on: the tile shows', dockerApi.iconBgOn() === true);

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle off brings the picked colour back', dockerApi.iconInk(false) === '#00aa00', dockerApi.iconInk(false));
  reset();
}

console.log('\nitemAdoptInk(): the contrast ink per item, rather than one for the page');
{
  // While adopting, iconInk() answers one colour for the whole page, taken from
  // palette slot 5, but with rainbow on each item's badge rotates: stampCardRainbow()
  // and applyRainbowPalette() stamp a --cc-rb-c and --cc-rb-ct per item. Slot 5, the
  // blue, takes white ink; slot 2, the yellow, is the one that takes black, so an
  // item landing there would read white on yellow, against the tooltip's promise of
  // "automatisch schwarz oder weiß". itemAdoptInk() takes that item's own stamp.
  reset();
  localStorage.setItem('cc.iconbgrainbow', '1');
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.icontint', '1');
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.accent', '#2f6feb');

  // A stand-in card or row carrying what itemAdoptInk() reads, which is what the
  // two stamping functions write on the real node.
  function fakeOwner() {
    var s = {};
    return { style: { setProperty: function (k, v) { s[k] = v; }, getPropertyValue: function (k) { return s[k] || ''; } } };
  }

  ok('slot 5, the one iconInk() is fixed to, is #2f6feb', dockerApi.ccRbColor(5) === '#2f6feb', dockerApi.ccRbColor(5));
  ok('and it takes white ink', dockerApi.idealText(dockerApi.ccRbColor(5)) === '#fff');
  ok('slot 2 is the yellow #fcc419', dockerApi.ccRbColor(2) === '#fcc419', dockerApi.ccRbColor(2));
  ok('and it is the slot that takes black ink', dockerApi.idealText(dockerApi.ccRbColor(2)) === '#161616', dockerApi.idealText(dockerApi.ccRbColor(2)));

  var yellowOwner = fakeOwner();
  yellowOwner.style.setProperty('--cc-rb-c', dockerApi.ccRbColor(2));
  yellowOwner.style.setProperty('--cc-rb-ct', dockerApi.idealText(dockerApi.ccRbColor(2)));

  ok('a card on the yellow slot gets black ink from itemAdoptInk()', dockerApi.itemAdoptInk(yellowOwner) === '#161616', dockerApi.itemAdoptInk(yellowOwner));
  ok('...which differs from the page-wide iconInk() answer for the same settings', dockerApi.itemAdoptInk(yellowOwner) !== dockerApi.iconInk(false), dockerApi.itemAdoptInk(yellowOwner) + ' vs ' + dockerApi.iconInk(false));

  var blueOwner = fakeOwner();
  blueOwner.style.setProperty('--cc-rb-c', dockerApi.ccRbColor(5));
  blueOwner.style.setProperty('--cc-rb-ct', dockerApi.idealText(dockerApi.ccRbColor(5)));
  ok('a card on slot 5 gets white ink', dockerApi.itemAdoptInk(blueOwner) === '#fff', dockerApi.itemAdoptInk(blueOwner));

  // With rainbow off every badge is the one flat accent, so the uniform ink is the
  // right answer there.
  localStorage.setItem('cc.rainbow', '0');
  ok('rainbow off: a stale --cc-rb-ct stamp is ignored for the uniform ink', dockerApi.itemAdoptInk(yellowOwner) === dockerApi.iconInk(false), dockerApi.itemAdoptInk(yellowOwner));
  localStorage.setItem('cc.rainbow', '1');

  // A repaint that outran the last rainbow pass finds no stamp, and the next pass
  // puts it right.
  ok('no owner element: the uniform fallback, without throwing', dockerApi.itemAdoptInk(null) === dockerApi.iconInk(false));
  ok('an owner with no --cc-rb-ct stamp yet: the same fallback', dockerApi.itemAdoptInk(fakeOwner()) === dockerApi.iconInk(false));
  reset();
}

console.log('\nccLogoSizes(): the cc.sgsize map to [--cc-logo-img, --cc-logo-box]');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> [48px, 62px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['48px', '62px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> [76px, 94px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['76px', '94px']), JSON.stringify(dockerApi.ccLogoSizes()));
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to [62px, 78px]', JSON.stringify(dockerApi.ccLogoSizes()) === JSON.stringify(['62px', '78px']));
  reset();
}

console.log('\nA glyph never carries both a direct colour and the luminance-tint filter');
{
  var w = 'url(#cc-icon-tint)';
  ok('native treat: neither a colour nor a filter', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d', w); return !r.color && !r.filter; })());
  ok('Hintergrund on: the colour is set and the filter cleared, even with treat "tint"', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d', w); return !!r.color && !r.filter; })());
  ok('an ink colour: the colour is set and the filter cleared, even with treat "tint"', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d', w); return !!r.color && !r.filter; })());
  ok('no ink: the filter carries the treatment and the colour stays empty', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '', w); return !r.color && r.filter === w; })());
  // The ink argument answers "" whenever Einfärben is off, badge or no badge, so
  // the badge state alone must not put a colour on a glyph.
  ok('Hintergrund on with no ink: no colour is forced onto the glyph', (function () { var r = dockerApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '', w); return !r.color; })());
}

console.log('\nThe flat filter flattens to one colour and keeps alpha');
{
  const url = dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#ff8800');
  ok('returns a url(#id) reference', url === 'url(#cc-test-flat-f)', url);
  const host = document.getElementById('cc-test-flat');
  ok('the filter host exists', !!host);
  const svg = host.innerHTML || '';
  ok('the matrix zeroes every input channel, giving a flat fill rather than a tint', /values="0 0 0 0 [\d.]+ 0 0 0 0 [\d.]+ 0 0 0 0 [\d.]+ 0 0 0 1 0"/.test(svg), svg);
  ok('alpha passes through untouched in the "0 0 0 1 0" row', svg.indexOf('0 0 0 1 0') > 0);
  ok('the offsets are the requested colour', svg.indexOf('1.0000') >= 0 && svg.indexOf('0.5333') >= 0 && svg.indexOf('0.0000') >= 0, svg);

  const sig = host.dataset.sig;
  dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#ff8800');
  ok('rebuilding with the same colour changes nothing, so no observer loop starts', host.dataset.sig === sig);
  dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#00ff00');
  ok('a colour change does rebuild', host.dataset.sig !== sig);
  dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '#ff8800', 30);
  ok('a strength of 30 keeps 70 % of the original pixel and adds 30 % of the ink', /values="0\.7000 0 0 0 0\.3000 0 0\.7000 0 0 0\.1600 0 0 0\.7000 0 0\.0000 0 0 0 1 0"/.test(host.innerHTML), host.innerHTML);

  ok('no colour removes the filter host entirely', dockerApi.ensureFlatFilter('cc-test-flat', 'cc-test-flat-f', '') === '');
}

console.log('\nensureMonoFilter stays the Logo-Hintergrund spelling of the same filter');
{
  const dark = dockerApi.ensureMonoFilter('cc-test-mono', 'cc-test-mono-f', '#161616');
  ok('a dark box yields a filter', dark === 'url(#cc-test-mono-f)');
  let svg = document.getElementById('cc-test-mono').innerHTML;
  ok('and inks WHITE on it', svg.indexOf('1.0000 0 0 0 0 1.0000 0 0 0 0 1.0000') > 0 || /0 0 0 0 1\.0000 0 0 0 0 1\.0000 0 0 0 0 1\.0000/.test(svg), svg);
  dockerApi.ensureMonoFilter('cc-test-mono', 'cc-test-mono-f', '#ffcc00');
  svg = document.getElementById('cc-test-mono').innerHTML;
  ok('a light box inks DARK instead', /0 0 0 0 0\.0863 0 0 0 0 0\.0863 0 0 0 0 0\.0863/.test(svg), svg);
}

console.log('\nThe engine URL the frontend points an <img> at');
{
  const u = CI.svgUrl('Stirling-PDF');
  ok('goes through the same-origin PHP proxy (so the canvas read is not tainted)', u.indexOf('/plugins/towertorch/server/ccapi.php') === 0, u);
  ok('asks the iconsvg path', u.indexOf('path=iconsvg') > 0, u);
  ok('carries the name, url-encoded and lowercased', u.indexOf('name=stirling-pdf') > 0, u);
}

console.log('\nA tile keeps its mark: flattening the plate whole would leave a blank square');
{
  // 48x48 RGBA pictures: a plate with a mark drawn on it, a glyph cut out of transparency, and a
  // plain plate with nothing on it.
  const W = 48;
  const picture = (fn) => { const d = new Uint8ClampedArray(W * W * 4); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const p = fn(x, y); if (p) d.set(p, (y * W + x) * 4); } return d; };
  const disc = (x, y) => (x - 23.5) ** 2 + (y - 23.5) ** 2 < 22 * 22;
  const tailscale = picture((x, y) => (x > 3 && x < 44 && y > 3 && y < 44) ? ((x - 12) ** 2 + (y - 24) ** 2 < 16 || (x - 24) ** 2 + (y - 24) ** 2 < 16 || (x - 36) ** 2 + (y - 24) ** 2 < 16 ? [240, 240, 240, 255] : [30, 30, 30, 255]) : null);
  const question = picture((x, y) => disc(x, y) ? (x > 20 && x < 28 && y > 10 && y < 38 ? [255, 255, 255, 255] : [190, 190, 190, 255]) : null);
  const darkMark = picture((x, y) => (x > 3 && x < 44 && y > 3 && y < 44) ? (x > 14 && x < 34 && y > 20 && y < 28 ? [20, 20, 20, 255] : [230, 230, 230, 255]) : null);
  const glyph = picture((x, y) => (x > 4 && x < 44 && ((y > 4 && y < 12) || (y > 20 && y < 28) || (y > 36 && y < 44))) ? [255, 255, 255, 255] : null);
  const plain = picture((x, y) => disc(x, y) ? [40, 120, 200, 255] : null);

  let t = CI.measurePixels(tailscale, W).t;
  ok('a dark plate with light dots is a tile with a light mark', t && t.mark === 'light' && t.bg < 0.2 && t.mk > 0.8, JSON.stringify(t));
  t = CI.measurePixels(question, W).t;
  ok('a grey disc with a white mark is a tile too, whatever the plate\'s outline', t && t.mark === 'light', JSON.stringify(t));
  t = CI.measurePixels(darkMark, W).t;
  ok('a light plate with a dark mark says so', t && t.mark === 'dark' && t.bg > 0.8, JSON.stringify(t));
  ok('a glyph with gaps between its strokes is no tile', CI.measurePixels(glyph, W).t === null);
  ok('a plain plate with nothing on it is no tile, it flattens as it always did', CI.measurePixels(plain, W).t === null);
  ok('the spread is measured in the same pass', CI.measurePixels(tailscale, W).s > CI.SIMPLE_MAX);

  const tile = { bg: 0.12, mk: 0.94, mark: 'light' };
  let p = CI.plan('flat', '', 57, tile);
  ok('flat mode knocks a tile out instead of flattening it to a square', p.treat === 'knock' && p.src === 'native' && p.tile === tile, JSON.stringify(p));
  p = CI.plan('flat', 'glyph', 57, tile);
  ok('a fetched glyph still wins in flat mode, it is no tile', p.treat === 'flat' && p.src === 'glyph', JSON.stringify(p));
  p = CI.plan('flat', '', null, null);
  ok('flat mode tints an icon that is not measured yet, so no square shows before the measurement lands', p.treat === 'tint', JSON.stringify(p));
  ok('a font glyph, measured as 0, still flattens in flat mode', CI.plan('flat', '', 0, null).treat === 'flat');
  ok('auto mode still tints a complex tile', CI.plan('auto', '', 57, tile).treat === 'tint');
  ok('tint and native ignore the tile', CI.plan('tint', '', 57, tile).treat === 'tint' && CI.plan('native', '', 57, tile).treat === 'native');

  const f = CI.knock('#fff', tile);
  ok('the knock filter is referenced by id', /^url\(#cc-knock-\d+-\d+-ffffff\)$/.test(f), f);
  const host = document.getElementById('cc-knock-svg');
  ok('and lives in one shared host', host && host.innerHTML.indexOf(f.slice(5, -1)) > 0);
  ok('its colour is the ink and its alpha comes from the luminance', /values="0 0 0 0 1\.0000 0 0 0 0 1\.0000 0 0 0 0 1\.0000 [\d.]+ [\d.]+ [\d.]+ 0 -[\d.]+"/.test(host.innerHTML), host.innerHTML.slice(0, 300));
  ok('masked by the picture\'s own alpha, so the transparent corners stay transparent', /<feComposite in="k" in2="SourceGraphic" operator="in"\/>/.test(host.innerHTML));
  const before = host.innerHTML;
  CI.knock('#ffffff', tile);
  ok('asking again for the same filter writes nothing', host.innerHTML === before);
  const dk = CI.knock('#161616', { bg: 0.9, mk: 0.1, mark: 'dark' });
  ok('a dark mark gets a falling ramp', /values="0 0 0 0 0\.0863 0 0 0 0 0\.0863 0 0 0 0 0\.0863 -[\d.]+ -[\d.]+ -[\d.]+ 0 [\d.]+"/.test(host.innerHTML) && dk !== f);
  ok('no ink, no filter: the icon stays native like the flat filter leaves it', CI.knock('', tile) === '');
  ok('full strength is the plain knock', CI.knock('#fff', tile, 100) === f);
  const weak = CI.knock('#fff', tile, 34);
  const weakDef = new RegExp('<filter id="' + weak.slice(5, -1) + '"[^]*?</filter>').exec(host.innerHTML)[0];
  ok('a lower strength is a filter of its own, in tenths', weak === 'url(#cc-knock-2-15-ffffff-s3)' && CI.knock('#fff', tile, 29) === weak, weak);
  ok('it lays the knocked mark over the faded original', /result="kk"/.test(weakDef) && /<feComponentTransfer in="kk" result="top"><feFuncA type="linear" slope="0\.3"\/>/.test(weakDef) && /<feComponentTransfer in="SourceGraphic" result="under"><feFuncA type="linear" slope="0\.7"\/>/.test(weakDef) && /<feMergeNode in="under"\/><feMergeNode in="top"\/>/.test(weakDef), weakDef);
}

console.log('\nA container without an icon shows the container glyph, not Unraid\'s question mark');
{
  const q = CI.placeholder('/plugins/dynamix.docker.manager/images/question.png?1700089733');
  ok('Unraid\'s question.png is replaced', /^data:image\/svg\+xml,/.test(q), q.slice(0, 40));
  ok('by the container glyph in a neutral grey the filters can recolour', decodeURIComponent(q).indexOf('fill="#8a8a8a"') > 0);
  ok('a real icon is left alone', CI.placeholder('/state/plugins/dynamix.docker.manager/images/Plex-icon.png') === '');
  const dsrc = fs.readFileSync(DOCKER, 'utf8');
  ok('docker.js plans the placeholder before it measures anything', /var stand = isGlyphEl \? "" : CI\.placeholder\(nativeSrc\);\s*if \(stand\) nativeSrc = stand;/.test(dsrc));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
