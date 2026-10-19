// Pins stampCardRainbow(), which gives a .cc-card the per-card rainbow colour that
// applyRainbowPalette() gives a list row. Without it the var chain in docker.css,
// var(--cc-iconbg-color, var(--cc-rb-c, var(--cc-accent))), falls straight to the
// flat accent and every tile in Grid and Folder view comes out the same colour.
// It sits inside card(), so renderGrid() and renderFolderView() both get it.
//
// What it pins:
//   1. different containers get different colours, from the same palette, offset
//      and rotation source list rows use;
//   2. the same container name always gets the same colour, so a badge does not
//      jump when switching between Grid and Folder view;
//   3. --cc-rb-ct is idealText() of its --cc-rb-c, never a hardcoded contrast;
//   4. rainbow or theming off clears both vars rather than leaving a stale stamp;
//   5. cc.rainbowrot=0 collapses the rotation to a fixed offset, as in list mode.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// Stands in for the .cc-card stampCardRainbow() writes onto, with only the two
// methods it calls, so a drift in what it expects shows up here.
function fakeWrap() {
  const w = { _s: {} };
  w.style = {
    setProperty: (k, v) => { w._s[k] = v; },
    removeProperty: (k) => { delete w._s[k]; }
  };
  return w;
}

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

// stampCardRainbow() reads docker.js's module-level containerNames, which
// indexState() keeps sorted, so the harness declares it rather than passing it in.
const dockerApi = new Function('localStorage',
  'var RB_PAL = ["#d9433f","#f97316","#fcc419","#1f9d55","#0ea5a4","#2f6feb","#8b5cf6","#e05299"];\n' +
  'var RB_OFFSET = 0;\n' +
  'var window = {};\n' +   // no CCTheme, so the palette readers answer the stored palette
  'var containerNames = [];\n' +
  grabFn('themingOn') + '\n' + grabFn('idealText') + '\n' + grabFn('ccPalStored') + '\n' + grabFn('ccPalActive') + '\n' + grabFn('ccRbColor') + '\n' + grabFn('stampCardRainbow') + '\n' +
  'return { stampCardRainbow: stampCardRainbow, ccRbColor: ccRbColor, idealText: idealText, setNames: function (n) { containerNames = n; } };'
)(global.localStorage);

console.log('\nRainbow or theming off: no stamp, and a stale one is cleared');
{
  reset();
  dockerApi.setNames(['alpha', 'beta', 'gamma']);
  const w = fakeWrap();
  w._s['--cc-rb-c'] = '#stale'; w._s['--cc-rb-ct'] = '#stale2';   // left over from a rainbow-on render
  dockerApi.stampCardRainbow(w, 'beta');
  ok('rainbow unset: --cc-rb-c is cleared', !('--cc-rb-c' in w._s));
  ok('rainbow unset: --cc-rb-ct is cleared too', !('--cc-rb-ct' in w._s));

  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.theming', '0');
  const w2 = fakeWrap(); w2._s['--cc-rb-c'] = '#stale';
  dockerApi.stampCardRainbow(w2, 'beta');
  ok('theming off with cc.rainbow=1: still no stamp', !('--cc-rb-c' in w2._s));
  reset();
}

console.log('\nRainbow on: different containers get different colours, matching ccRbColor()');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india'];
  dockerApi.setNames(names.slice().sort());   // indexState() keeps containerNames sorted

  const colours = names.map(n => { const w = fakeWrap(); dockerApi.stampCardRainbow(w, n); return w._s['--cc-rb-c']; });
  ok('every card received a --cc-rb-c value', colours.every(c => !!c), JSON.stringify(colours));

  const distinct = new Set(colours);
  ok('more than one colour across nine containers over an eight-colour palette', distinct.size > 1, JSON.stringify(colours));

  names.forEach((n) => {
    const idx = names.slice().sort().indexOf(n);
    const want = dockerApi.ccRbColor(idx);
    const w = fakeWrap();
    dockerApi.stampCardRainbow(w, n);
    ok('"' + n + '" at sorted index ' + idx + ' matches ccRbColor(' + idx + ')', w._s['--cc-rb-c'] === want, w._s['--cc-rb-c'] + ' vs ' + want);
  });
}

console.log('\nThe same container name always gets the same colour');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  dockerApi.setNames(['jdownloader', 'nextcloud', 'plex', 'sonarr']);
  const w1 = fakeWrap(); dockerApi.stampCardRainbow(w1, 'plex');
  const w2 = fakeWrap(); dockerApi.stampCardRainbow(w2, 'plex');
  ok('two stamping passes for one name produce the same colour', w1._s['--cc-rb-c'] === w2._s['--cc-rb-c'], w1._s['--cc-rb-c'] + ' vs ' + w2._s['--cc-rb-c']);
  ok('and the same contrast ink', w1._s['--cc-rb-ct'] === w2._s['--cc-rb-ct']);
}

console.log('\n--cc-rb-ct is idealText() of its paired --cc-rb-c');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  dockerApi.setNames(names);
  names.forEach(n => {
    const w = fakeWrap();
    dockerApi.stampCardRainbow(w, n);
    ok('"' + n + '": --cc-rb-ct === idealText(--cc-rb-c)', w._s['--cc-rb-ct'] === dockerApi.idealText(w._s['--cc-rb-c']), w._s['--cc-rb-ct'] + ' vs idealText(' + w._s['--cc-rb-c'] + ')');
  });
}

console.log('\nA container missing from containerNames still gets a valid colour');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  dockerApi.setNames(['known-one', 'known-two']);
  const w = fakeWrap();
  let threw = false;
  try { dockerApi.stampCardRainbow(w, 'totally-unknown-container'); } catch (e) { threw = true; }
  ok('a name absent from containerNames does not throw', !threw);
  ok('it still stamps a valid --cc-rb-c, falling back to index 0', /^#[0-9a-f]{6}$/i.test(w._s['--cc-rb-c'] || ''), w._s['--cc-rb-c']);
}

console.log('\ncc.rainbowrot=0 collapses the rotation to a fixed offset, as in list mode');
{
  reset();
  localStorage.setItem('cc.rainbow', '1');
  localStorage.setItem('cc.rainbowrot', '0');
  dockerApi.setNames(['zulu', 'yankee', 'xray'].slice().sort());   // indexState() keeps containerNames sorted
  const w1 = fakeWrap(); dockerApi.stampCardRainbow(w1, 'zulu');
  const w2 = fakeWrap(); dockerApi.stampCardRainbow(w2, 'yankee');
  // Sorted: xray 0, yankee 1, zulu 2. With RB_OFFSET pinned to 0 here, no rotation
  // and offset 0 look alike, so the assertion goes against ccRbColor(), which reads
  // cc.rainbowrot itself.
  ok('zulu, at sorted index 2, matches ccRbColor(2)', w1._s['--cc-rb-c'] === dockerApi.ccRbColor(2), w1._s['--cc-rb-c']);
  ok('yankee, at sorted index 1, matches ccRbColor(1)', w2._s['--cc-rb-c'] === dockerApi.ccRbColor(1), w2._s['--cc-rb-c']);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
