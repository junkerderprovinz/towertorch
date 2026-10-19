// The cc.* mirror pushes one change set at a time and never adopts the engine's
// copy of a key whose local value has not landed there yet, including from a
// config read that went out while the key's push was still on the wire.
//
// All three copies of the mirror are driven against a fake engine whose replies
// are released by hand, so the interleaving is exact.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const tick = () => new Promise((r) => setImmediate(r));

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// An engine that answers only when told to, and counts what is on the wire at once. A PUT to
// uisettings merges its keys into the stored map and deletes those sent as null, as the engine does;
// a PUT to config replaces the whole config.
function fakeEngine() {
  const e = { server: { ui_settings: {} }, waiting: [], open: 0, maxOpen: 0, puts: 0, paths: [] };
  e.request = (method, body, p) => new Promise((resolve) => {
    e.open++; e.maxOpen = Math.max(e.maxOpen, e.open); e.paths.push(method + ' ' + p);
    e.waiting.push({ method, body, release(fail) {
      e.open--;
      if (fail) return resolve(null);
      if (method === 'PUT' && p === 'uisettings') { e.puts++; Object.keys(body).forEach((k) => { if (body[k] === null) delete e.server.ui_settings[k]; else e.server.ui_settings[k] = body[k]; }); return resolve({ ok: true }); }
      if (method === 'PUT') { e.puts++; e.server = JSON.parse(JSON.stringify(body)); return resolve({ ok: true }); }
      resolve(JSON.parse(JSON.stringify(e.server)));
    } });
  });
  e.next = async (fail) => { await tick(); const w = e.waiting.shift(); if (!w) throw new Error('nothing on the wire'); w.release(fail); await tick(); return w; };
  return e;
}

function storage() {
  const store = {};
  return { store, ls: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
}

const COPIES = [
  {
    file: 'docker.js', push: 'pushUISettings', unsynced: 'uiUnsynced', adopt: 'adoptUISettings',
    vars: 'var uiPending = {}, uiSending = {}, uiPushing = false, uiQueued = false;', pending: 'uiPending',
    io: (e) => ({ api: (m, p, b) => e.request(m, b, p).then((r) => { if (r === null) throw new Error('HTTP 500'); return r; }) }),
  },
  {
    file: 'settings.js', push: 'pushUISettings', unsynced: 'uiUnsynced', adopt: 'adoptUISettings',
    vars: 'var uiPending = {}, uiSending = {}, uiPushing = false, uiQueued = false;' +
      'var cfgChain = Promise.resolve(); function withConfigLock(fn) { var p = cfgChain.then(fn, fn); cfgChain = p.catch(function () {}); return p; }',
    pending: 'uiPending',
    io: (e) => ({ api: (m, p, b) => e.request(m, b, p).then((r) => { if (r === null) throw new Error('HTTP 500'); return r; }) }),
  },
  {
    file: 'cc-theme.js', push: 'push', unsynced: 'unsynced', adopt: 'adopt',
    vars: 'var pending = {}, sending = {}, pushing = false, queued = false;', pending: 'pending',
    io: (e) => ({ apiGet: (p) => e.request('GET', null, p), apiPut: (p, b) => e.request('PUT', b, p) }),
  },
];

(async () => {
  for (const c of COPIES) {
    const src = fs.readFileSync(path.join(DIR, c.file), 'utf8');
    const boot = () => {
      const e = fakeEngine();
      const { store, ls } = storage();
      const io = c.io(e);
      const names = Object.keys(io);
      const m = new Function('localStorage', 'window', ...names,
        c.vars + '\n' + grabFn(src, c.push) + '\n' + grabFn(src, c.unsynced) + '\n' + grabFn(src, c.adopt) + '\n' +
        `return { push: ${c.push}, adopt: ${c.adopt}, unsynced: ${c.unsynced}, write: function (k, v) { localStorage.setItem(k, v); ${c.pending}[k] = 1; } };`
      )(ls, {}, ...names.map((n) => io[n]));
      return { e, store, m };
    };

    console.log('\n' + c.file + ': one push on the wire at a time');
    {
      const { e, m } = boot();
      m.write('cc.a', '1'); m.push();
      m.write('cc.b', '2'); m.push();
      await tick();
      ok('the second push waits for the first', e.waiting.length === 1, e.waiting.length + ' requests out');
      await e.next();
      ok('the first PUT carries the first key', e.server.ui_settings['cc.a'] === '1' && !('cc.b' in e.server.ui_settings), JSON.stringify(e.server.ui_settings));
      await e.next();
      ok('the queued key follows in a second push once the first has landed', e.server.ui_settings['cc.b'] === '2' && e.server.ui_settings['cc.a'] === '1', JSON.stringify(e.server.ui_settings));
      ok('never more than one request open at once', e.maxOpen === 1, 'max ' + e.maxOpen);
      ok('nothing is left on the wire', e.waiting.length === 0);
    }

    console.log('\n' + c.file + ': adopt leaves a key alone until its push has landed');
    {
      const { e, store, m } = boot();
      e.server.ui_settings = { 'cc.a': 'old' };
      m.write('cc.a', 'new');
      const busy = m.unsynced();
      m.push();
      m.adopt({ 'cc.a': 'old', 'cc.c': 'x' });
      ok('a pending key keeps its local value', store['cc.a'] === 'new', store['cc.a']);
      ok('a key with nothing pending is adopted as before', store['cc.c'] === 'x');
      await e.next();
      m.adopt({ 'cc.a': 'old' }, busy);
      ok('a read that went out while the key was unsynced cannot revert it after the push lands', store['cc.a'] === 'new', store['cc.a']);
      m.adopt({ 'cc.a': 'server' });
      ok('a read issued after the push landed is adopted again', store['cc.a'] === 'server', store['cc.a']);
    }

    console.log('\n' + c.file + ': a failed push keeps its keys unsynced');
    {
      const { e, store, m } = boot();
      m.write('cc.a', 'new'); m.push();
      await e.next(true);
      ok('a failed push ends it', e.waiting.length === 0);
      m.adopt({ 'cc.a': 'old' });
      ok('the key is still protected from adopt', store['cc.a'] === 'new', store['cc.a']);
      m.push(); await e.next();
      ok('the next push carries it', e.server.ui_settings['cc.a'] === 'new', JSON.stringify(e.server.ui_settings));
    }

    console.log('\n' + c.file + ': a fresh browser writes only what changed');
    {
      const { e, m } = boot();
      e.server = { schedules: [{ id: 's1' }], watchdogs: [{ name: 'CCWB' }], ui_settings: { 'cc.accent': '#FCC419', 'cc.flag': 'dz', 'cc.lastver': '1.2.0-rc5' } };
      m.write('cc.lastver', '1.2.0-rc8'); m.push();
      await tick();
      const w = e.waiting[0];
      ok('the push goes to the engine\'s merge, not over the whole config', w && w.method === 'PUT' && e.paths[0] === 'PUT uisettings', e.paths.join(','));
      ok('and carries the changed key alone', w && JSON.stringify(w.body) === '{"cc.lastver":"1.2.0-rc8"}', w && JSON.stringify(w.body));
      await e.next();
      ok('the rest of the engine\'s copy stays as it was', e.server.ui_settings['cc.accent'] === '#FCC419' && e.server.ui_settings['cc.flag'] === 'dz' && e.server.schedules.length === 1 && e.server.watchdogs.length === 1, JSON.stringify(e.server));
      ok('the change lands', e.server.ui_settings['cc.lastver'] === '1.2.0-rc8');
    }
  }
  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
