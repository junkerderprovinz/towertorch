// Pins the icon pipeline of the Settings and Tools category grid, settingsgrid.js,
// with the harness the three sibling icon-pipeline tests use, pointed at this file.
//
// Two things:
//  1. The adopt gate. A colour, tint or background is configured on the global
//     "Logos & Icons" card, so the area-local ccs.* keys are normally unset. With
//     cc.stylesettings on, every read has to resolve through the global cc.* keys
//     rather than falling back to the accent as if nothing were configured.
//  2. Hintergrund and Einfärben stay two independent controls here as well: a
//     background colour resolves with Einfärben off, and the tint state is not
//     inferred from the badge.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const SG = process.argv[2] || path.join(DIR, 'settingsgrid.js');

// The storage shim from icon-pipeline.test.js.
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

// Pull the functions under test out of settingsgrid.js.
const src = fs.readFileSync(SG, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in settingsgrid.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// RB and RB_OFF stand in for the module-level palette vars, normally window.CCTheme.RB
// and a persisted seed, pinned to the shipped palette at offset 0 so rbColor(i) is
// deterministic, as in the sibling tests.
const loc = { pathname: '/Settings' };
const sgApi = new Function('localStorage', 'location',
  'var RB = ["#d9433f","#f97316","#fcc419","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFF = 0;\n' +
  'var window = {};\n' +   // no CCTheme, so the palette readers answer the stored palette
  grabFn('g') + '\n' + grabFn('area') + '\n' + grabFn('eff') + '\n' + grabFn('accent') + '\n' +
  grabFn('bgAdopting') + '\n' + grabFn('bgColorEff') + '\n' + grabFn('badgeBg') + '\n' + grabFn('bgColorIsCustom') + '\n' + grabFn('tintOnEff') + '\n' +
  grabFn('rbOn') + '\n' + grabFn('rbNeutral') + '\n' + grabFn('storedPal') + '\n' + grabFn('pal') + '\n' + grabFn('rbColor') + '\n' + grabFn('tintColorEff') + '\n' +
  'return { g: g, eff: eff, accent: accent, bgAdopting: bgAdopting, bgColorEff: bgColorEff, badgeBg: badgeBg, bgColorIsCustom: bgColorIsCustom, tintOnEff: tintOnEff, rbColor: rbColor, tintColorEff: tintColorEff };'
)(global.localStorage, loc);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

console.log('\nbgColorEff() falls through to the global cc.* keys while cc.stylesettings is on');
{
  reset();
  // A global icon colour, adopt on, and the area-local ccs.* keys untouched, which
  // is where anyone who only opens the global "Logos & Icons" card ends up.
  localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  ok('adopt on, global colour set, area key untouched: bgColorEff() takes the global colour', sgApi.bgColorEff() === '#e5a00d', sgApi.bgColorEff());
  ok('badgeBg(), the alias apply() and paintGrid() call, agrees', sgApi.badgeBg() === '#e5a00d', sgApi.badgeBg());
  ok('bgColorIsCustom() reports a configured colour, so paintGrid() lets it win over the rainbow', sgApi.bgColorIsCustom() === true);

  // With adopt off, the global colour is out of reach and the unset area key falls
  // through to the accent.
  localStorage.setItem('cc.stylesettings', '0');
  ok('adopt off: bgColorEff() no longer takes the global colour', sgApi.bgColorEff() !== '#e5a00d', sgApi.bgColorEff());
  reset();
}

console.log('\n/Tools reads its own keys, apart from /Settings');
{
  reset();
  localStorage.setItem('cc.accent', '#fcc419');
  localStorage.setItem('cc.stylesettings', '0'); localStorage.setItem('ccs.accent', '#ff8389');
  localStorage.setItem('cct.accent', '#1d99f3');
  ok('/Settings with its own colour takes ccs.accent', sgApi.accent() === '#ff8389', sgApi.accent());
  loc.pathname = '/Tools';
  ok('/Tools follows the global colour while cc.styletools is unset', sgApi.accent() === '#fcc419', sgApi.accent());
  localStorage.setItem('cc.styletools', '0');
  ok('/Tools with its own colour takes cct.accent, not the Settings one', sgApi.accent() === '#1d99f3', sgApi.accent());
  loc.pathname = '/Settings';
  reset();
}

console.log('\nThe older iconcolor key and iconbgcolor go through the same adopt gate');
{
  reset();
  // An install from before iconbgcolor existed, with the shared iconcolor key alone.
  localStorage.setItem('cc.iconcolor', '#161616');
  ok('adopt on, only the global iconcolor set: bgColorEff() resolves it', sgApi.bgColorEff() === '#161616', sgApi.bgColorEff());
  localStorage.setItem('cc.stylesettings', '0');
  ok('adopt off: that global key is out of reach too', sgApi.bgColorEff() !== '#161616', sgApi.bgColorEff());
  reset();
}

console.log('\nHintergrund and Einfärben stay independent on this area as well');
{
  reset();
  ok('nothing configured at all: tint is off', sgApi.tintOnEff() === false);

  // On an install with iconcolor and no cc.icontint, the colour's presence is the
  // tint signal, which tintOnEff()'s fallback keeps reading that way.
  localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('no cc.icontint key at all: tint reads on from the colour being there', sgApi.tintOnEff() === true);
  reset();

  localStorage.setItem('cc.icontint', '0'); localStorage.setItem('cc.iconcolor', '#1f9d55');
  ok('Einfärben off with a tint colour set: tint stays off', sgApi.tintOnEff() === false);
  localStorage.setItem('cc.iconbgcolor', '#161616');
  ok('and the background colour resolves regardless', sgApi.bgColorEff() === '#161616', sgApi.bgColorEff());
  reset();
}

console.log('\ncc.iconbgrainbow: "Badge-Einstellungen übernehmen" as one master toggle');
{
  // Badge and tint are mutually exclusive on this area, unlike in docker.js, vms.js
  // and plugins.js, so the master toggle resolves tintColorEff() to a rotating or
  // accent hue: there is no badge behind a pure-tint tile to contrast against. Only
  // the storage key is shared with bgColorEff() and bgColorIsCustom().
  reset();
  localStorage.setItem('cc.iconbg', '1'); localStorage.setItem('cc.iconbgcolor', '#e5a00d');
  localStorage.setItem('cc.icontint', '1'); localStorage.setItem('cc.iconcolor', '#00aa00');
  localStorage.setItem('cc.accent', '#2f6feb');

  ok('not adopting: bgColorEff() is the picked background colour', sgApi.bgColorEff() === '#e5a00d', sgApi.bgColorEff());
  ok('not adopting: bgColorIsCustom() is true', sgApi.bgColorIsCustom() === true);
  ok('not adopting: tintColorEff() is the picked tint colour', sgApi.tintColorEff() === '#00aa00', sgApi.tintColorEff());

  localStorage.setItem('cc.rainbow', '0');
  localStorage.setItem('cc.iconbgrainbow', '1');
  ok('adopting: bgColorEff() answers "", so apply() stamps no --cc-iconbg-color', sgApi.bgColorEff() === '', JSON.stringify(sgApi.bgColorEff()));
  ok('adopting: bgColorIsCustom() is false, so paintGrid() falls through to its own per-tile rotation', sgApi.bgColorIsCustom() === false);
  ok('adopting with rainbow off: tintColorEff() follows the shared key to the plain accent', sgApi.tintColorEff() === '#2f6feb', sgApi.tintColorEff());

  localStorage.setItem('cc.rainbow', '1');
  ok('adopting with rainbow on: tintColorEff() is the rbColor(5) a rotating tile resolves to, not a frozen accent', sgApi.tintColorEff() === sgApi.rbColor(5), sgApi.tintColorEff() + ' vs ' + sgApi.rbColor(5));
  ok('and not the picked colour either', sgApi.tintColorEff() !== '#00aa00');

  localStorage.setItem('cc.iconbgrainbow', '0');
  ok('turning the master toggle off brings the picked tint colour back', sgApi.tintColorEff() === '#00aa00', sgApi.tintColorEff());
  ok('and the picked background colour too', sgApi.bgColorEff() === '#e5a00d', sgApi.bgColorEff());
  reset();
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exitCode = fail ? 1 : 0;
