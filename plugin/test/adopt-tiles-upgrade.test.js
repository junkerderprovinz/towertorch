// An install that adopts the badge colours gets the logo tile and icon tint switches turned on
// once, in the browser (tt-theme.js) and in the engine's mirror (store.LoadConfig), so its logos
// look the same after the upgrade. A marker makes it run once, and a switch turned off later
// stays off.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const theme = fs.readFileSync(path.join(DIR, 'scripts/tt-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const step = new Function(grabFn(theme, 'keepAdoptedTiles') + '; return keepAdoptedTiles;')();
function store(init) {
  const s = Object.assign({}, init), writes = [];
  return { s, writes, getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); writes.push(k); } };
}

console.log('\nAn install that adopted keeps its tiles and its tint');
{
  const ls = store({ 'tt.iconbgrainbow': '1', 'tt.iconbg': '0', 'tt.icontint': '0', 'tt.styledocker': '0', 'ttd.iconbg': '0', 'tt.stylevms': '1', 'ttv.iconbg': '0', 'tt.styleplugin': '0' });
  step(ls);
  ok('both global switches go on', ls.s['tt.iconbg'] === '1' && ls.s['tt.icontint'] === '1');
  ok('an area with colours of its own gets them too', ls.s['ttd.iconbg'] === '1' && ls.s['ttd.icontint'] === '1' && ls.s['ttp.iconbg'] === '1' && ls.s['ttp.icontint'] === '1');
  ok('an area that follows the global keys keeps its own as they were', ls.s['ttv.iconbg'] === '0' && !('ttv.icontint' in ls.s));
  ok('the step is marked done', ls.s['tt.iconadoptsplit'] === '1');
  ls.s['tt.iconbg'] = '0'; ls.writes.length = 0;
  step(ls);
  ok('a second run writes nothing, so a switch turned off since stays off', ls.writes.length === 0 && ls.s['tt.iconbg'] === '0');
}

console.log('\nEvery other install is left as it is');
{
  const off = store({ 'tt.iconbgrainbow': '0', 'tt.iconbg': '0' });
  step(off);
  ok('adopting off: the switches stay, the step is marked done', off.s['tt.iconbg'] === '0' && !('tt.icontint' in off.s) && off.s['tt.iconadoptsplit'] === '1');
  const fresh = store({});
  step(fresh);
  ok('a fresh install gets no key at all', fresh.writes.length === 0);
  ok('it runs on every page, after the Tools split', /try \{ splitToolsKeys\(localStorage\); \} catch \(e\) \{\}\s*\/\/[\s\S]*?try \{ keepAdoptedTiles\(localStorage\); \} catch \(e\) \{\}/.test(theme));
}

console.log('\nThe Settings and Tools grids get the same step, also after the one above has run');
{
  const grid = new Function(grabFn(theme, 'keepAdoptedGridTiles') + '; return keepAdoptedGridTiles;')();
  const ls = store({ 'tt.iconbgrainbow': '1', 'tt.iconadoptsplit': '1', 'tt.iconbg': '0', 'tt.stylesettings': '0', 'tts.iconbg': '0', 'tt.styletools': '1', 'ttt.iconbg': '0' });
  grid(ls);
  ok('a grid with colours of its own gets tiles and tint', ls.s['tts.iconbg'] === '1' && ls.s['tts.icontint'] === '1');
  ok('a grid that follows the global keys keeps its own as they were', ls.s['ttt.iconbg'] === '0' && !('ttt.icontint' in ls.s));
  ok('the global switches stay as they are', ls.s['tt.iconbg'] === '0' && !('tt.icontint' in ls.s));
  ok('the step is marked done under its own marker', ls.s['tt.iconadoptgrid'] === '1');
  ls.s['tts.iconbg'] = '0'; ls.writes.length = 0;
  grid(ls);
  ok('a second run writes nothing', ls.writes.length === 0 && ls.s['tts.iconbg'] === '0');
  const fresh = store({});
  grid(fresh);
  ok('a fresh install gets no key at all', fresh.writes.length === 0);
  ok('it runs on every page, after the first step', /try \{ keepAdoptedTiles\(localStorage\); \} catch \(e\) \{\}[\s\S]*?try \{ keepAdoptedGridTiles\(localStorage\); \} catch \(e\) \{\}/.test(theme));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
