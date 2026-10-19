// Pins the repaint hooks of cc-theme.js's cross-browser cc.* settings sync, which
// is the only sync the VMs, Plugins, SettingsGrid, Header and Shares areas have;
// docker.js and settings.js carry their own loadConfig().
//
// The sync corrects localStorage from the server's ui_settings on every page load,
// by which time the page has already drawn itself with the old value, so adopt()
// calls whichever window.cc<Area>Apply hook the page happens to have, the same
// convention the Settings page's live toggle uses. A page that corrects itself
// silently also hides the problem on the retest, since the second load is right.
//
// Three cases: the hooks fire when adopt() changed something, they stay quiet
// when it did not, and one that throws neither breaks the sync nor its siblings.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const THEME = process.argv[2] || path.join(DIR, 'cc-theme.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The file is an IIFE holding the sync IIFE, so grabbing from the marker to the end
// of the file and dropping the outer closer leaves the inner one runnable on its own.
function grabSyncBlock(src) {
  const startMarker = '(function () {\n    if (/^\\/Docker(\\/|$)/.test(location.pathname)';
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  var rest = src.slice(s);
  var tail = '\n})();\n';
  if (!rest.endsWith(tail)) throw new Error('unexpected file tail, no outer IIFE closer');
  return rest.slice(0, rest.length - tail.length); // keeps the inner closer, drops the outer
}

function makeStorage(initial) {
  const store = Object.assign({}, initial);
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
  };
  return { store, localStorage };
}

// Runs the sync IIFE as if on /Plugins, since it skips /Docker and
// /Settings/TowerTorch, with a fetch stub answering the config GET.
function runSync(src, ui_settings, localStorage, win) {
  const code = grabSyncBlock(src);
  const fetchStub = (url) => Promise.resolve({ ok: true, json: () => Promise.resolve({ ui_settings: ui_settings }) });
  win.addEventListener = win.addEventListener || (() => {});
  const run = new Function('window', 'localStorage', 'location', 'fetch', 'document', 'setTimeout', 'clearTimeout', code);
  run(win, localStorage, { pathname: '/Plugins' }, fetchStub, { querySelector: () => null, cookie: '' }, setTimeout, clearTimeout);
}

const src = fs.readFileSync(THEME, 'utf8');

console.log('cc-theme.js: adopt() calls the area repaint hooks when it changed something');

// The local copy is stale and the server says "0", so every present hook fires.
{
  const { store, localStorage } = makeStorage({ 'cc.rainbow': '1' });
  const calls = { vms: 0, plugins: 0, header: 0 };
  const win = { ccVmsApply: () => { calls.vms++; }, ccPluginsApply: () => { calls.plugins++; }, ccHeaderApply: () => { calls.header++; } };
  runSync(src, { 'cc.rainbow': '0' }, localStorage, win);
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('the adopt corrects localStorage', store['cc.rainbow'] === '0', store['cc.rainbow']);
    ok('ccVmsApply fires', calls.vms === 1, calls.vms);
    ok('ccPluginsApply fires', calls.plugins === 1, calls.plugins);
    ok('ccHeaderApply fires too, a page being able to host several areas', calls.header === 1, calls.header);
  }).then(run2);
}

function run2() {
  console.log('\ncc-theme.js: nothing to correct, so no hook fires and no render loop starts');
  const { store, localStorage } = makeStorage({ 'cc.rainbow': '0' });
  const calls = { vms: 0 };
  const win = { ccVmsApply: () => { calls.vms++; } };
  runSync(src, { 'cc.rainbow': '0' }, localStorage, win);
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('localStorage already matched the server', store['cc.rainbow'] === '0');
    ok('ccVmsApply never fires when adopt() changed nothing', calls.vms === 0, calls.vms);
  }).then(run3);
}

function run3() {
  console.log('\ncc-theme.js: a missing or throwing hook never breaks the sync or its siblings');
  const { localStorage } = makeStorage({});
  const calls = { plugins: 0 };
  // ccVmsApply is absent, as on a page without that area; ccPluginsApply throws.
  const win = { ccHeaderApply: () => { throw new Error('boom'); }, ccPluginsApply: () => { calls.plugins++; } };
  let threw = false;
  try { runSync(src, { 'cc.rainbow': '1' }, localStorage, win); } catch (e) { threw = true; }
  return new Promise(r => setTimeout(r, 20)).then(() => {
    ok('a throwing hook does not escape the sync', !threw);
    ok('a sibling hook after the throwing one still runs', calls.plugins === 1, calls.plugins);
  }).then(finish);
}

function finish() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
