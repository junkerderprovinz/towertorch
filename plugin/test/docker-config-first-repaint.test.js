// Pins docker.js's cross-origin config sync, loadConfig(). cc-theme.js has its own,
// pinned in cc-theme-rerender-hook.test.js.
//
// docker.js's boot() paints synchronously off localStorage, before the async GET
// /config resolves. If the local copy happens to equal the server's, a repaint
// gated on adoptUISettings() finding a difference would never correct that first
// paint, so the first loadConfig() repaints unconditionally. The three cases:
//   1) the first call repaints even with nothing to adopt;
//   2) a second call with nothing changed does not repaint again;
//   3) a real adoption on any call repaints.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  const e = src.indexOf(endMarker, s);
  if (e < 0) throw new Error('end marker not found after start: ' + endMarker);
  return src.slice(s, e);
}

const src = fs.readFileSync(DOCKER, 'utf8');
const code = grabBetween(src,
  'function uiUnsynced() {',
  'function loadLimits()');

// Stubs everything loadConfig() and adoptUISettings() touch and counts the repaint
// calls, so a test can tell how many full passes each loadConfig() did. The server
// settings live in a mutable object, so a test can let a Rainbow toggle land
// between two polls.
function harness(initialLocal) {
  const store = Object.assign({}, initialLocal || {});
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const calls = { applySettings: 0, applyEnhanceClasses: 0, removeEnhanceClasses: 0, reinjectRowBadges: 0, renderGrid: 0 };
  const win = {};
  const serverRef = { ui_settings: {} };
  const fnBody = code + '\nreturn { loadConfig: loadConfig, adoptUISettings: adoptUISettings, get config() { return config; } };';
  const factory = new Function(
    'window', 'localStorage', 'api', 'applySettings', 'applyEnhanceClasses', 'removeEnhanceClasses',
    'reinjectRowBadges', 'renderGrid', 'themingOn', 'mode', 'uiSeeded', 'collectUISettings', 'uiPending', 'uiSending', 'pushUISettings',
    fnBody
  );
  const api = (method, path) => { if (method === 'GET' && path === 'config') return Promise.resolve({ ui_settings: serverRef.ui_settings }); return Promise.resolve(null); };
  const state = factory(
    win, localStorage, api,
    () => { calls.applySettings++; }, () => { calls.applyEnhanceClasses++; }, () => { calls.removeEnhanceClasses++; },
    () => { calls.reinjectRowBadges++; }, () => { calls.renderGrid++; },
    () => true, // themingOn(), so the list-mode branch takes applyEnhanceClasses
    'list', true, () => ({}), {}, {}, () => {}
  );
  return { state, store, calls, serverRef };
}

console.log('docker.js loadConfig(): the first call always repaints, even with nothing to adopt');
{
  // Local equals server, so adoptUISettings() alone would find nothing to do.
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => {
    ok('applySettings ran on the first loadConfig() despite no diff', h.calls.applySettings === 1, h.calls.applySettings);
    ok('applyEnhanceClasses ran too, the mode being "list"', h.calls.applyEnhanceClasses === 1, h.calls.applyEnhanceClasses);
    ok('reinjectRowBadges ran too', h.calls.reinjectRowBadges === 1, h.calls.reinjectRowBadges);
    ok('renderGrid stayed out of it, the mode being "list"', h.calls.renderGrid === 0, h.calls.renderGrid);
    run2();
  });
}

function run2() {
  console.log('\ndocker.js loadConfig(): a second call with nothing to adopt does not repaint again');
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => h.state.loadConfig()).then(() => {
    ok('one repaint pass across two identical calls',
      h.calls.applySettings === 1, h.calls.applySettings);
    run3();
  });
}

function run3() {
  console.log('\ndocker.js loadConfig(): a real adoption on a later call still repaints');
  const h = harness({ 'cc.rainbow': '0' });
  h.serverRef.ui_settings = { 'cc.rainbow': '0' };
  h.state.loadConfig().then(() => {
    ok('the first call repainted once', h.calls.applySettings === 1, h.calls.applySettings);
    // A Rainbow toggle lands server-side between two polls.
    h.serverRef.ui_settings = { 'cc.rainbow': '1' };
    return h.state.loadConfig();
  }).then(() => {
    ok('a cross-origin change on a later call triggers a second repaint', h.calls.applySettings === 2, h.calls.applySettings);
    ok('localStorage adopted the new value', h.store['cc.rainbow'] === '1', h.store['cc.rainbow']);
    return h.state.loadConfig();
  }).then(() => {
    ok('a third call with nothing new to adopt does not repaint again', h.calls.applySettings === 2, h.calls.applySettings);
    finish();
  });
}

function finish() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
