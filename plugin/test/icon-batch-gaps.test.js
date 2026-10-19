// A batch answer that leaves a name out must settle that name, or the queue drains straight back
// into another request for it and the page asks the engine for it as fast as the network allows.
const path = require('path');
const THEME = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts', 'cc-theme.js');

const node = () => ({ classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, getAttribute: () => null, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
global.document = Object.assign(node(), { createElement: node, getElementById: () => null, documentElement: node(), body: node(), cookie: '' });
global.navigator = { language: 'en' };
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout };
global.location = { pathname: '/Docker' };

let calls = 0;
// The engine leaves out a name it normalises to nothing, such as a lone dash.
global.fetch = (url, opts) => {
  calls++;
  const names = JSON.parse(decodeURIComponent(String(opts.body).split('data=')[1])).names;
  const out = {};
  names.filter((n) => n !== '-').forEach((n) => { out[n] = { kind: 'none' }; });
  return Promise.resolve({ ok: true, json: () => Promise.resolve(out) });
};

require(THEME);
const CI = global.window.CCTheme.icons;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nA name the answer leaves out');
CI.want(['plex', '-']);
setTimeout(() => {
  ok('is asked for once, not again and again', calls === 1, calls + ' requests');
  ok('settles on the native icon', CI.result('-') && CI.result('-').kind === 'none', JSON.stringify(CI.result('-')));
  ok('leaves the answered names as they came', CI.result('plex') && CI.result('plex').kind === 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
