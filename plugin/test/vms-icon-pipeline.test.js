// Pins the VMs-tab icon pipeline in vms.js, with the harness icon-pipeline.test.js
// uses pointed at this file. Three things:
//
//  1. effK() gates iconcolor, iconbg and iconstrength on cc.stylevms, and every
//     read goes through it rather than repeating the expression.
//  2. The cc.sgsize map to [--cc-logo-img, --cc-logo-box] is the one docker.js's
//     ccLogoSizes() and plugins.js's logoSize() use, so the three cannot drift.
//  3. A glyph never carries both a direct colour and a tint filter, which would
//     tint an already-inked glyph a second time.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const VMS = process.argv[2] || path.join(DIR, 'vms.js');

// The DOM and storage shim from icon-pipeline.test.js.
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.style = {
      _s: {},
      setProperty: function (k, v) { this._s[k] = v; },
      removeProperty: function (k) { delete this._s[k]; },
      getPropertyValue: function (k) { return this._s[k] || ''; },
      cssText: ''
    };
  }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); const id = this.id || this.attrs.id; if (id) delete byId[id]; }
}
const byId = {};
const document = {
  createElement: t => new N(t),
  getElementById: id => byId[id] || null,
  querySelectorAll: () => [],
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

// Pull the functions under test out of vms.js.
const src = fs.readFileSync(VMS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in vms.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB_PAL and RB_OFFSET stand in for the module-level palette vars, normally
// window.CCTheme.RB and a persisted seed, pinned to the shipped palette at offset 0
// so vmRbColor(i) and vmAdoptTint() are deterministic.
const vmsApi = new Function('document', 'localStorage', 'window',
  'var dead = false;\n' +
  'var RB_PAL = ["#d9433f","#f97316","#fcc419","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  grabFn('ls') + '\n' + grabFn('vmTintOff') + '\n' + grabFn('effK') + '\n' + grabFn('iconBgAdoptsV') + '\n' + grabFn('iconBgOnV') + '\n' + grabFn('ccIdeal') + '\n' + grabFn('ccAccent') + '\n' +
  grabFn('ccHex6') + '\n' + grabFn('ensureFlatFilter') + '\n' + grabFn('ensureMonoFilter') + '\n' +
  grabFn('vmPalStored') + '\n' + grabFn('vmPalActive') + '\n' + grabFn('vmRbColor') + '\n' + grabFn('vmAdoptTint') + '\n' +
  grabFn('vmTintOn') + '\n' + grabFn('vmBgColor') + '\n' + grabFn('vmIconInk') + '\n' + grabFn('vmItemAdoptInk') + '\n' +
  grabFn('ensureTintFilterAs') + '\n' + grabFn('ensureTintFilter') + '\n' + grabFn('vmLogoSizes') + '\n' + grabFn('glyphInkAndFilter') + '\n' +
  'return { iconBgOnV: iconBgOnV, effK: effK, vmTintOn: vmTintOn, vmBgColor: vmBgColor, vmIconInk: vmIconInk, vmItemAdoptInk: vmItemAdoptInk, ensureTintFilter: ensureTintFilter, ensureTintFilterAs: ensureTintFilterAs, vmLogoSizes: vmLogoSizes, glyphInkAndFilter: glyphInkAndFilter, ccIdeal: ccIdeal, ccAccent: ccAccent, vmRbColor: vmRbColor, vmAdoptTint: vmAdoptTint, ensureFlatFilter: ensureFlatFilter };'
)(document, global.localStorage, global.window);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\neffK() gates iconcolor, iconbg and iconstrength on cc.stylevms');
{
  reset();
  localStorage.setItem('cc.iconcolor', '#e5a00d'); localStorage.setItem('cc.iconbg', '0'); localStorage.setItem('cc.iconstrength', '100');
  localStorage.setItem('ccv.iconcolor', '#00aa00'); localStorage.setItem('ccv.iconbg', '1'); localStorage.setItem('ccv.iconstrength', '40');

  ok('adopt on, cc.stylevms unset: vmIconInk() follows the global colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  vmsApi.ensureTintFilter();
  const sigOn = document.getElementById('cc-vm-tint-svg') && document.getElementById('cc-vm-tint-svg').dataset.sig;

  localStorage.setItem('cc.stylevms', '0');
  ok('adopt off: vmIconInk() follows the VM-local ccv.iconbg instead', vmsApi.vmIconInk(false) !== '#e5a00d', vmsApi.vmIconInk(false));
  vmsApi.ensureTintFilter();
  const sigOff = document.getElementById('cc-vm-tint-svg') && document.getElementById('cc-vm-tint-svg').dataset.sig;
  ok('the tint strength differs between the two states as well, 40 against 100', sigOff !== sigOn, sigOn + ' vs ' + sigOff);
  reset();
}

console.log('\nHintergrund and Einfärben stay independent: the badge alone does not tint');
{
  reset();
  ok('nothing configured at all: no ink', vmsApi.vmIconInk(false) === '');

  localStorage.setItem('cc.iconbg', '1');
  ok('background on, Einfärben untouched, no colour picked: no ink', vmsApi.vmIconInk(false) === '');

  localStorage.setItem('cc.icontint', '0');
  ok('background on, Einfärben off: no ink even with the badge showing', vmsApi.vmIconInk(false) === '');

  localStorage.setItem('cc.icontint', '1');
  ok('background on, Einfärben on, no colour picked: no ink to lift', vmsApi.vmIconInk(false) === '');
  localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('background on, Einfärben on, colour picked: inked in that colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  reset();

  // On an install with cc.iconbg and cc.iconcolor and no cc.icontint, the colour's
  // presence is the tint signal, which vmTintOn()'s fallback keeps reading.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('no cc.icontint key at all: the icon is inked', vmsApi.vmTintOn() === true && vmsApi.vmIconInk(false) !== '');
  reset();

  // With both controls on and two different colours, the ink is the tint's own,
  // never a contrast colour derived from the badge box.
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#161616'); localStorage.setItem('cc.icontint', '0');
  ok('the background colour applies with Einfärben off', vmsApi.vmBgColor() === '#161616');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#e5a00d');
  ok('with both on, the ink is the tint colour', vmsApi.vmIconInk(false) === '#e5a00d', vmsApi.vmIconInk(false));
  ok('and the badge box keeps its own colour', vmsApi.vmBgColor() === '#161616', vmsApi.vmBgColor());
  reset();
}

console.log('\ncc.iconbgrainbow: "Badge-Farben übernehmen" takes over the colours only');
{
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('not adopting: vmBgColor() is the picked background colour', vmsApi.vmBgColor() === '#e5a00d', vmsApi.vmBgColor());
  ok('not adopting: vmIconInk() is the picked tint colour', vmsApi.vmIconInk(false) === '#00aa00', vmsApi.vmIconInk(false));

  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: vmBgColor() answers "", so no --cc-iconbg-color is stamped and VmTab.css falls through to the source every generic VM badge uses', vmsApi.vmBgColor() === '', JSON.stringify(vmsApi.vmBgColor()));

  localStorage.setItem('cc.rainbow', '0');
  ok('adopting with rainbow off: the ink is the contrast colour for the plain accent', vmsApi.vmIconInk(false) === vmsApi.ccIdeal(vmsApi.vmAdoptTint()), vmsApi.vmIconInk(false));

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting with rainbow on: the ink is the contrast colour for the vmRbColor(5) a generic badge resolves to', vmsApi.vmIconInk(false) === vmsApi.ccIdeal(vmsApi.vmRbColor(5)), vmsApi.vmIconInk(false) + ' vs ccIdeal(' + vmsApi.vmRbColor(5) + ')');
  ok('and not the picked colour', vmsApi.vmIconInk(false) !== '#00aa00');

  localStorage.setItem('cc.icontint', '0');
  ok('adopting with Tint icons off: no ink, the icons keep their own colours', vmsApi.vmIconInk(false) === '', vmsApi.vmIconInk(false));
  localStorage.setItem('cc.icontint', '1');

  localStorage.setItem('cc.iconbg', '0');
  ok('adopting with Logo tiles off: no tile', vmsApi.iconBgOnV() === false);
  ok('and the ink is the badge colour itself, with no tile to contrast against', !/^(#fff|#161616|)$/.test(vmsApi.vmIconInk(false)), vmsApi.vmIconInk(false));
  localStorage.setItem('cc.iconbg', '1');

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle off brings the picked colour back', vmsApi.vmIconInk(false) === '#00aa00', vmsApi.vmIconInk(false));
  reset();
}

console.log('\nvmItemAdoptInk(): the contrast ink per row, as docker.js\'s itemAdoptInk() does');
{
  // While adopting, vmIconInk() answers one colour for the whole page, taken from
  // palette slot 5, but enhanceCells() stamps a rotating --cc-rb-c and --cc-rb-ct
  // per row. Slot 2, the yellow, is the one that needs black ink instead of white,
  // so a row landing there would read white on yellow. vmItemAdoptInk() takes that
  // row's own --cc-rb-ct.
  reset();
  localStorage.setItem('cc.iconbgrainbow', '1');
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.icontint', '1');
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.accent', '#2f6feb');

  function fakeRow() {
    var s = {};
    return { style: { setProperty: function (k, v) { s[k] = v; }, getPropertyValue: function (k) { return s[k] || ''; } } };
  }

  ok('slot 5 is #2f6feb, which takes white ink', vmsApi.vmRbColor(5) === '#2f6feb' && vmsApi.ccIdeal(vmsApi.vmRbColor(5)) === '#fff');
  ok('slot 2 is the yellow #fcc419, which takes black ink', vmsApi.vmRbColor(2) === '#fcc419' && vmsApi.ccIdeal(vmsApi.vmRbColor(2)) === '#161616');

  var yellowRow = fakeRow();
  yellowRow.style.setProperty('--cc-rb-c', vmsApi.vmRbColor(2));
  yellowRow.style.setProperty('--cc-rb-ct', vmsApi.ccIdeal(vmsApi.vmRbColor(2)));

  ok('a row on the yellow slot gets black ink from vmItemAdoptInk()', vmsApi.vmItemAdoptInk(yellowRow) === '#161616', vmsApi.vmItemAdoptInk(yellowRow));
  ok('...which differs from the page-wide vmIconInk() answer for the same settings', vmsApi.vmItemAdoptInk(yellowRow) !== vmsApi.vmIconInk(false), vmsApi.vmItemAdoptInk(yellowRow) + ' vs ' + vmsApi.vmIconInk(false));

  var blueRow = fakeRow();
  blueRow.style.setProperty('--cc-rb-c', vmsApi.vmRbColor(5));
  blueRow.style.setProperty('--cc-rb-ct', vmsApi.ccIdeal(vmsApi.vmRbColor(5)));
  ok('a row on slot 5 gets white ink', vmsApi.vmItemAdoptInk(blueRow) === '#fff', vmsApi.vmItemAdoptInk(blueRow));

  localStorage.setItem('cc.rainbow', '0');
  ok('rainbow off: a stale --cc-rb-ct stamp is ignored for the uniform ink', vmsApi.vmItemAdoptInk(yellowRow) === vmsApi.vmIconInk(false), vmsApi.vmItemAdoptInk(yellowRow));
  localStorage.setItem('cc.rainbow', '1');

  ok('no row element: the uniform fallback, without throwing', vmsApi.vmItemAdoptInk(null) === vmsApi.vmIconInk(false));
  ok('a row with no --cc-rb-ct stamp yet: the same fallback', vmsApi.vmItemAdoptInk(fakeRow()) === vmsApi.vmIconInk(false));
  reset();
}

console.log('\nvmLogoSizes(): the cc.sgsize map docker.js and plugins.js use as well');
{
  reset();
  localStorage.setItem('cc.sgsize', 's'); ok('s -> [48px, 62px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['48px', '62px']));
  localStorage.setItem('cc.sgsize', 'm'); ok('m -> [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'l'); ok('l -> [76px, 94px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['76px', '94px']));
  localStorage.removeItem('cc.sgsize'); ok('unset defaults to m -> [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  localStorage.setItem('cc.sgsize', 'nonsense'); ok('a garbage value falls back to [62px, 78px]', JSON.stringify(vmsApi.vmLogoSizes()) === JSON.stringify(['62px', '78px']));
  reset();
}

console.log('\nA glyph never carries both a direct colour and the luminance-tint filter');
{
  ok('native treat: neither a colour nor a filter', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'native' }, false, '#2f6feb', '#e5a00d'); return !r.color && !r.filter; })());
  ok('Hintergrund on and treat "tint": the colour is the resolved ink, with no filter', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', '#e5a00d'); return !!r.color && !r.filter; })());
  ok('an ink colour with treat "tint": the colour is set, with no filter', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, false, '#2f6feb', '#e5a00d'); return r.color === '#e5a00d' && !r.filter; })());
  // The ink argument answers "" whenever Einfärben is off, badge or no badge, so
  // the badge state alone must not put a colour on a glyph.
  ok('Hintergrund on with no ink: no colour is forced onto the glyph', (function () { const r = vmsApi.glyphInkAndFilter({ treat: 'tint' }, true, '#2f6feb', ''); return !r.color; })());
}

console.log('\nThe strength slider reaches a redrawn VM icon');
{
  const vals = () => /values="([^"]+)"/.exec(byId['cc-vm-mono-svg'].innerHTML)[1].split(' ').map(Number);
  vmsApi.ensureFlatFilter('cc-vm-mono-svg', 'cc-vm-mono-tint', '#ffffff', 100);
  let v = vals();
  ok('at full strength every pixel takes the ink', v[0] === 0 && v[4] === 1 && v[6] === 0 && v[9] === 1 && v[12] === 0 && v[14] === 1 && v[18] === 1, v.join(' '));
  vmsApi.ensureFlatFilter('cc-vm-mono-svg', 'cc-vm-mono-tint', '#ffffff', 40);
  v = vals();
  ok('at 40 each channel keeps 60 per cent of the original', v[0] === 0.6 && v[6] === 0.6 && v[12] === 0.6, v.join(' '));
  ok('and takes 40 per cent of the ink, alpha untouched', v[4] === 0.4 && v[9] === 0.4 && v[14] === 0.4 && v[18] === 1, v.join(' '));
  vmsApi.ensureFlatFilter('cc-vm-mono-svg', 'cc-vm-mono-tint', '#ffffff');
  ok('a caller that names no strength gets the full flatten, as the action icons need', vals()[0] === 0 && vals()[4] === 1);
  ok('the page reads the slider for the icons', /var str = parseInt\(effK\("iconstrength"\) \|\| "100", 10\);/.test(src) && /ensureFlatFilter\("cc-vm-mono-svg", "cc-vm-mono-tint", vmInk, str\)/.test(src) && /CI\.knock\(thisInk, plan\.tile, str\)/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
