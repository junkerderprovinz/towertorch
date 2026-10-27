// header.js rewrites a few cc.* keys on its first pass (the version it last announced, a shape or
// motion name from an older build). Each page's mirror wraps localStorage.setItem to push cc.* keys
// to the engine and adopts the engine's copy on load, and on the Docker and Settings pages that
// wrapper arrives after header.js has run. A write it never saw stays off the engine, the adopt
// puts the old value back, and the "updated" toast returns on every load. The early writes are
// handed over: the wrapper pushes them and its adopt leaves them alone. At the other end, a write
// made just before the page goes away leaves with the page in one request.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (f) => fs.readFileSync(path.join(DIR, 'scripts', f), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
// The methods sit on a prototype, as in a browser, since the mirrors hook Storage.prototype.
function store(init) {
  const m = Object.assign({}, init);
  function Storage() {}
  Storage.prototype.getItem = function (k) { return k in m ? m[k] : null; };
  Storage.prototype.setItem = function (k, v) { m[k] = String(v); };
  Storage.prototype.removeItem = function (k) { delete m[k]; };
  Storage.prototype.key = function (i) { return Object.keys(m)[i]; };
  Object.defineProperty(Storage.prototype, 'length', { get() { return Object.keys(m).length; } });
  const ls = new Storage();
  ls.m = m;
  return ls;
}

const header = read('header.js');
const syncedSet = (win, ls) => new Function('window', 'localStorage', grabFn(header, 'syncedSet') + '\nreturn syncedSet;')(win, ls);

console.log('\nheader.js marks a write the mirror has not seen');
ok('header.js has syncedSet()', !!grabFn(header, 'syncedSet'));
if (grabFn(header, 'syncedSet')) {
  const win = {}, ls = store({});
  syncedSet(win, ls)('cc.lastver', '1.0.0');
  ok('the value is stored', ls.getItem('cc.lastver') === '1.0.0');
  ok('and listed for the wrapper', win.__ccLSEarly && win.__ccLSEarly['cc.lastver'] === 1);
  const win2 = { __ccLS: () => {} };
  syncedSet(win2, ls)('cc.lastver', '1.0.0');
  ok('with a wrapper in place the write goes through it and is not listed', !win2.__ccLSEarly);
  ok('the boot-time rewrites all go this way', /syncedSet\("cc\.badgeshape", shpName\)/.test(header) && /syncedSet\("cc\.anim", level\)/.test(header) && /syncedSet\("cc\.lastver", CC_VER\)/.test(header));
  ok('and none writes past it', !/localStorage\.setItem\("cc\.(badgeshape|anim|lastver)"/.test(header));
}

// Each mirror is run from its own source: the wrapper install, then a config read that carries the
// engine's old values.
const MIRRORS = [
  ['docker.js', read('docker.js'), '  var uiSyncT = null, uiSeeded = false, uiPending = {};', 'adoptUISettings', 'pushUISettings'],
  ['settings.js', read('settings.js'), '  var uiSyncT = null, uiPending = {};', 'adoptUISettings', 'pushUISettings'],
  ['cc-theme.js', read('cc-theme.js'), '    var pending = {}, syncT = null;', 'adopt', 'push'],
];
for (const [file, src, start, adoptName] of MIRRORS) {
  console.log('\n' + file + ' takes the early writes over');
  const i = src.indexOf(start);
  const body = src.slice(i, src.indexOf(grabFn(src, adoptName)) + grabFn(src, adoptName).length);
  const ls = store({ 'cc.lastver': '1.0.0', 'cc.badgeshape': 'round', 'cc.accent': '#FCC419' });
  const on = {}, sent = [];
  const win = { __ccLSEarly: { 'cc.lastver': 1, 'cc.badgeshape': 1 }, addEventListener: (t, f) => { on[t] = f; } };
  const timers = [];
  const run = new Function('window', 'localStorage', 'Storage', 'setTimeout', 'clearTimeout', 'api', 'apiGet', 'apiPut', 'withConfigLock', 'PROXY', 'csrfToken', 'fetch',
    body + '\nreturn ' + adoptName + ';');
  const never = () => new Promise(() => {});
  const adopt = run(win, ls, ls.constructor, (f, ms) => { timers.push(ms); return timers.length; }, () => {}, never, never, never, never,
    '/ccapi.php', () => 'tok', (url, opts) => { sent.push({ url, opts }); return never(); });
  ok('a push is queued for them', timers.length === 1, String(timers));
  ok('the list is cleared', !('__ccLSEarly' in win));
  adopt({ 'cc.lastver': '0.9.0', 'cc.badgeshape': 'pill', 'cc.accent': '#1D99F3' }, {});
  ok('the engine\'s old version does not come back', ls.getItem('cc.lastver') === '1.0.0', ls.getItem('cc.lastver'));
  ok('nor the old shape name', ls.getItem('cc.badgeshape') === 'round', ls.getItem('cc.badgeshape'));
  ok('a key that was not written early is still adopted', ls.getItem('cc.accent') === '#1D99F3');

  // A change made just before the page goes away has no time for the debounce and the two round
  // trips of a push, so leaving the page sends it at once.
  ls.setItem('cc.view', 'grid');
  ls.removeItem('cc.rainbow');
  ok('leaving the page is watched', typeof on.pagehide === 'function');
  if (on.pagehide) on.pagehide();
  const req = sent[0] || { opts: {} };
  const form = new URLSearchParams(req.opts.body || '');
  const data = JSON.parse(form.get('data') || '{}');
  ok('one request goes out', sent.length === 1, String(sent.length));
  ok('to the merge endpoint, kept alive past the page', req.url === '/ccapi.php?path=uisettings' && req.opts.method === 'PUT' && req.opts.keepalive === true, req.url);
  ok('with the token emhttp asks for in the form body', form.get('csrf_token') === 'tok');
  ok('carrying the unsynced value', data['cc.view'] === 'grid', JSON.stringify(data));
  ok('and a removed key as null, so the engine deletes it', 'cc.rainbow' in data && data['cc.rainbow'] === null, JSON.stringify(data));
}

console.log('\nThe proxy lets the merge through');
ok('ccapi.php forwards PUT uisettings', /'uisettings' => \['PUT'\]/.test(fs.readFileSync(path.join(DIR, 'server', 'ccapi.php'), 'utf8')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
