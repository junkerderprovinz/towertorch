// Pins the cross-origin cc.* settings sync in all three copies of it: docker.js
// runs on /Docker, settings.js on /Settings/TowerTorch and cc-theme.js on
// every other page, with never more than one of them active at a time.
//
// Each patches localStorage so a cc.* write lands in a pending map that is pushed
// into the engine's ui_settings mirror, which is how a toggle set in one browser
// survives a reload in another. removeItem has to go through the same map: a
// deletion that only happens locally is resurrected by the next adopt.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');
const SETTINGS = process.argv[3] || path.join(DIR, 'settings.js');
const THEME = process.argv[4] || path.join(DIR, 'cc-theme.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
// The exported map is the object the sandboxed closure mutates, so a reassignment
// would only rebind the property on the wrapper. Clearing it in place is what
// gives a fresh debounce window.
const clearMap = (o) => Object.keys(o).forEach((k) => delete o[k]);

// The sync block is inline code rather than a function, so it is sliced between
// markers instead of by name as in icon-pipeline.test.js.
function grabBetween(src, startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  if (s < 0) throw new Error('start marker not found: ' + startMarker);
  const e = src.indexOf(endMarker, s);
  if (e < 0) throw new Error('end marker not found after start: ' + endMarker);
  return src.slice(s, e);
}

// A Storage with its methods on the prototype, as in a browser, since the hooks wrap the
// prototype rather than the instance.
function makeStorage() {
  const store = {};
  function Storage() {}
  Storage.prototype.getItem = function (k) { return k in store ? store[k] : null; };
  Storage.prototype.setItem = function (k, v) { store[k] = String(v); };
  Storage.prototype.removeItem = function (k) { delete store[k]; };
  Storage.prototype.key = function (i) { return Object.keys(store)[i]; };
  Object.defineProperty(Storage.prototype, 'length', { get() { return Object.keys(store).length; } });
  return { store, localStorage: new Storage(), Storage };
}

// docker.js patches unconditionally, since it only loads on /Docker.
{
  const src = fs.readFileSync(DOCKER, 'utf8');
  const code = grabBetween(src,
    'var uiSyncT = null, uiSeeded = false, uiPending = {};',
    'function collectUISettings()');
  const { store, localStorage, Storage } = makeStorage();
  const win = {};
  const run = new Function('window', 'localStorage', 'Storage', 'pushUISettings', 'setTimeout', 'clearTimeout',
    code + '\nreturn { uiPending: uiPending };');
  const state = run(win, localStorage, Storage, () => {}, setTimeout, clearTimeout);

  console.log('\ndocker.js: cc.* setItem and removeItem both reach uiPending');
  localStorage.setItem('cc.iconcolor', '#ff0000');
  ok('setItem queues the key', state.uiPending['cc.iconcolor'] === 1);
  ok('setItem writes through to the real store', store['cc.iconcolor'] === '#ff0000');
  clearMap(state.uiPending); // as a fresh debounce window would
  localStorage.removeItem('cc.iconcolor');
  ok('removeItem queues the same key for deletion', state.uiPending['cc.iconcolor'] === 1);
  ok('removeItem deletes from the real store', !('cc.iconcolor' in store));
  clearMap(state.uiPending);
  localStorage.setItem('other.key', '1');
  ok('a key outside cc.* is never queued', state.uiPending['other.key'] === undefined);
  clearMap(state.uiPending);
  localStorage.removeItem('cc.stateCache');
  ok('cc.stateCache stays out of the sync, being a paint cache', state.uiPending['cc.stateCache'] === undefined);
  ok('window.__ccLS exposes the raw setItem for writes that skip the debounce', typeof win.__ccLS === 'function');
  ok('window.__ccLSRemove exposes the raw removeItem the same way', typeof win.__ccLSRemove === 'function');
}

// settings.js patches the same way, and only loads on /Settings/TowerTorch.
{
  const src = fs.readFileSync(SETTINGS, 'utf8');
  const code = grabBetween(src,
    'var uiSyncT = null, uiPending = {};',
    'function collectUISettings()');
  const { store, localStorage, Storage } = makeStorage();
  const win = {};
  const run = new Function('window', 'localStorage', 'Storage', 'pushUISettings', 'setTimeout', 'clearTimeout',
    code + '\nreturn { uiPending: uiPending };');
  const state = run(win, localStorage, Storage, () => {}, setTimeout, clearTimeout);

  console.log('\nsettings.js: cc.* setItem and removeItem both reach uiPending');
  localStorage.setItem('cc.accent', '#2f6feb');
  ok('setItem queues the key', state.uiPending['cc.accent'] === 1);
  clearMap(state.uiPending);
  localStorage.removeItem('cc.accent');
  ok('removeItem queues the same key for deletion', state.uiPending['cc.accent'] === 1);
  ok('removeItem deletes from the real store', !('cc.accent' in store));
}

// cc-theme.js guards on the pathname and stands down on the other two pages.
{
  const src = fs.readFileSync(THEME, 'utf8');
  const code = grabBetween(src,
    'if (/^\\/Docker(\\/|$)/.test(location.pathname) || /^\\/Settings\\/TowerTorch(\\/|$)/.test(location.pathname)) return;',
    'function push() {');

  console.log('\ncc-theme.js: the same on every other page, such as Plugins, VMs or Shares');
  {
    const { store, localStorage, Storage } = makeStorage();
    const win = {};
    const run = new Function('window', 'localStorage', 'Storage', 'location', 'push', 'setTimeout', 'clearTimeout',
      code + '\nreturn { pending: pending };');
    const state = run(win, localStorage, Storage, { pathname: '/Plugins' }, () => {}, setTimeout, clearTimeout);
    localStorage.setItem('cc.rainbow', '1');
    ok('on /Plugins: setItem queues the key', state.pending['cc.rainbow'] === 1);
    clearMap(state.pending);
    localStorage.removeItem('cc.rainbow');
    ok('on /Plugins: removeItem queues the same key for deletion', state.pending['cc.rainbow'] === 1);
    ok('on /Plugins: removeItem deletes from the real store', !('cc.rainbow' in store));
  }
  {
    // The pathname guard is a bare return at the top of the block, ahead of both
    // patches, so on /Docker localStorage comes out of this untouched and
    // docker.js's copy is the only one that owns it.
    const { localStorage, Storage } = makeStorage();
    const win = {};
    const origSet = localStorage.setItem, origRemove = localStorage.removeItem;
    const run = new Function('window', 'localStorage', 'Storage', 'location', 'push', 'setTimeout', 'clearTimeout', code);
    run(win, localStorage, { pathname: '/Docker' }, () => {}, setTimeout, clearTimeout);
    ok('on /Docker: cc-theme.js leaves localStorage.setItem alone', localStorage.setItem === origSet);
    ok('on /Docker: cc-theme.js leaves localStorage.removeItem alone', localStorage.removeItem === origRemove);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
