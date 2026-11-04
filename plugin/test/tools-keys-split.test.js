// /Tools has its own badge and logo keys, tt.styletools and ttt.*, apart from /Settings. An
// install that only has tt.stylesettings and tts.* gets them copied once, in the browser
// (tt-theme.js) and in the engine's mirror (store.LoadConfig), and nothing changes on screen.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const theme = read('scripts/tt-theme.js');
const settings = read('scripts/settings.js');
const split = new Function(grabFn(theme, 'splitToolsKeys') + '\nreturn splitToolsKeys;')();
function store(init) {
  const m = Object.assign({}, init);
  return { m, get length() { return Object.keys(m).length; }, key: (i) => Object.keys(m)[i], getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

console.log('\nThe first load copies the Settings keys to Tools');
{
  const ls = store({ 'tt.stylesettings': '0', 'tts.accent': '#ff8389', 'tts.iconbg': '0', 'tt.accent': '#fcc419' });
  split(ls);
  ok('Tools keeps the exception Settings had', ls.m['tt.styletools'] === '0');
  ok('and every value of it', ls.m['ttt.accent'] === '#ff8389' && ls.m['ttt.iconbg'] === '0');
  ok('Settings keeps its own', ls.m['tts.accent'] === '#ff8389' && ls.m['tt.stylesettings'] === '0');
  ls.m['ttt.accent'] = '#1d99f3';
  split(ls);
  ok('a later load leaves a Tools colour alone', ls.m['ttt.accent'] === '#1d99f3');
  const fresh = store({});
  split(fresh);
  ok('a fresh install follows the global colour on Tools', fresh.m['tt.styletools'] === '1' && Object.keys(fresh.m).length === 1);
  ok('the copy runs as tt-theme.js loads, before any area script reads the keys', /try \{ splitToolsKeys\(localStorage\); \} catch \(e\) \{\}/.test(theme));
}

console.log('\nThe settings page edits the Tools keys on the Tools tab');
{
  ok('the Tools tab builds its cards on ttt.', /buildStyleCards\("ttt\.", wrapTools,/.test(settings));
  ok('its exception is its own key', /colourRow\("tt\.styletools"\)/.test(settings));
  ok('ttt. maps to tt.styletools', /"ttt\.": "tt\.styletools"/.test(settings) && /"tt\.styletools": "ttt\."/.test(settings));
  ok('Tools has its own line among the area colours', /\["tt\.styletools", "tools", T\("Werkzeuge", "Tools"\)\]/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
