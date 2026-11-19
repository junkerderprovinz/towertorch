// The Docker tab of the settings carries the switch for the apps' logos: on by default, saved the
// moment it flips, and shut with a way to Theming while theming is off, since the Docker tab then
// shows no logos at all.
const fs = require('fs');
const path = require('path');
const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts', 'settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = settings.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = settings.indexOf('{', i); k < settings.length; k++) { if (settings[k] === '{') d++; else if (settings[k] === '}') { d--; if (!d) return settings.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const store = {};
const get = (k, d) => (k in store ? store[k] : d);
const set = (k, v) => { store[k] = String(v); };
const rows = [];
const card = { children: [], appendChild(c) { this.children.push(c); return c; } };
const toggleRow = (label, help, on, onChange) => { const r = { kind: 'toggle', label, help, on, onChange }; rows.push(r); return r; };
const lockRow = (label, by, jump, onJump, help) => { const r = { kind: 'lock', label, by, jump, onJump, help }; rows.push(r); return r; };
const jumps = [];
const build = new Function('c', 'T', 'get', 'set', 'toggleRow', 'lockRow', 'jumpTo', grabFn('imageLogosRow') + '\nreturn imageLogosRow(c);');
const T = (de, en) => en;

console.log('\nThe switch');
build(card, T, get, set, toggleRow, lockRow, (a, b) => jumps.push([a, b]));
let r = rows[0];
ok('is a switch on the card', r && r.kind === 'toggle' && card.children[0] === r, JSON.stringify(r));
ok('is on by default', r.on === true);
ok('says what it does', /without an icon/.test(r.label) && /image/.test(r.help) && /name/.test(r.help) && /template/.test(r.help), r.help);
r.onChange(false);
ok('writes off at once', store['tt.imagelogos'] === '0');
r.onChange(true);
ok('and on again', store['tt.imagelogos'] === '1');

console.log('\nWhile theming is off');
rows.length = 0; card.children.length = 0;
store['tt.theming'] = '0';
build(card, T, get, set, toggleRow, lockRow, (a, b) => jumps.push([a, b]));
r = rows[0];
ok('the row is shut and says why', r && r.kind === 'lock', JSON.stringify(r));
r.onJump();
ok('with a way to Theming', jumps.length === 1 && jumps[0][0] === 'general' && jumps[0][1] === 'Theming', JSON.stringify(jumps));

console.log('\nOn the Docker tab, above the original logos');
{
  const a = settings.indexOf('imageLogosRow(cApps)'), b = settings.indexOf('var cOrig = card(');
  ok('the card comes before the original logos', a > 0 && a < b);
  ok('and is German too', /T\("App-Logos", "App logos"\)/.test(settings));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
