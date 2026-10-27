// Every cc.* write is mirrored into the engine config, but a write of the value already stored
// changes nothing there. The settings page rewrites its tab and a few switches on every render,
// and each of those would otherwise send the whole config back unchanged on every load.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The hook's own source: from "Storage.prototype.setItem = function (k, v) {" to its closing "};".
function wrapperOf(src) {
  const i = src.indexOf('Storage.prototype.setItem = function (k, v) {');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

for (const [file, pend, timer, fn] of [['scripts/settings.js', 'uiPending', 'uiSyncT', 'pushUISettings'], ['scripts/docker.js', 'uiPending', 'uiSyncT', 'pushUISettings'], ['scripts/cc-theme.js', 'pending', 'syncT', 'push']]) {
  console.log('\n' + file);
  const w = wrapperOf(fs.readFileSync(path.join(DIR, file), 'utf8'));
  ok('has a mirroring setItem', !!w);
  if (!w) continue;
  const store = { 'cc.settab': 'docker' };
  const ls = { getItem: (k) => (k in store ? store[k] : null) };
  const orig = (k, v) => { store[k] = String(v); };
  const env = new Function('localStorage', 'orig', 'protoSet', 'setTimeout', 'clearTimeout',
    `var ${pend} = {}, ${timer} = null; function ${fn}() {}\n${w.replace(/^Storage\.prototype\.setItem = /, 'var hook = ')};\nreturn { set: function (k, v) { return hook.call(localStorage, k, v); }, pending: ${pend} };`)(ls, orig, orig, () => 1, () => {});
  env.set('cc.settab', 'docker');
  ok('a write of the stored value queues nothing', !('cc.settab' in env.pending), Object.keys(env.pending).join(' '));
  env.set('cc.settab', 'vms');
  ok('a changed value is queued for the engine', 'cc.settab' in env.pending);
  ok('and stored', store['cc.settab'] === 'vms');
  env.set('cc.newkey', '1');
  ok('a key stored for the first time is queued', 'cc.newkey' in env.pending);
}

console.log('\nThe hooks reach Firefox');
for (const file of fs.readdirSync(path.join(DIR, 'scripts')).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, 'scripts', file), 'utf8');
  ok(file + ' assigns nothing to localStorage.setItem or removeItem, which Firefox keeps as an item', !/localStorage\.(setItem|removeItem)\s*=[^=]/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
