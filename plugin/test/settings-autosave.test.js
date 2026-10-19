// The Notifications and Bandwidth cards save as they change, with no Save button: the switch at
// once and back to its old value when the engine refuses, the text fields once typing has been
// quiet for 800ms, keeping what was typed. Every save is a locked read, change and write of the
// live config, so it never drops a field another card or the Docker tab wrote.
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

const settings = read('scripts/settings.js');

// The four save functions with a fake engine, fake timers and a recorder for failures.
function harness(engine) {
  const timers = []; const fails = []; const puts = [];
  const env = { notify: { unraid: false, webhook: '' }, shapeIface: '', fullConfig: null };
  const api = (method, p, body) => {
    if (method === 'GET') return engine.get ? Promise.reject(new Error('down')) : Promise.resolve(JSON.parse(JSON.stringify(engine.config)));
    if (engine.put) return Promise.reject(new Error(engine.put));
    puts.push(body); engine.config = body; return Promise.resolve({});
  };
  let chain = Promise.resolve();
  const withConfigLock = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const src = ['var quietT = {};', grabFn(settings, 'saveConfigField'), grabFn(settings, 'afterQuiet'), grabFn(settings, 'saveNotify'), grabFn(settings, 'saveShape'),
    'return { saveNotify: saveNotify, saveShape: saveShape, afterQuiet: afterQuiet };'].join('\n');
  const fns = new Function('api', 'withConfigLock', 'failed', 'T', 'setTimeout', 'clearTimeout', 'env',
    'with (env) {' + src + '}')(api, withConfigLock, (ctl, msg) => fails.push([ctl, msg]), (d, e) => e,
    (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length - 1; }, (id) => { if (timers[id]) timers[id].live = false; }, env);
  return { fns, env, timers, fails, puts, engine };
}

(async () => {
  console.log('\nA field save keeps everything else in the config');
  {
    const h = harness({ config: { schedules: [{ name: 'a' }], watchdogs: [1], notify: { unraid: false, webhook: '' }, shape_iface: 'eth1' } });
    h.env.notify.unraid = true;
    await h.fns.saveNotify('switch');
    ok('the notify block is written', h.puts[0] && h.puts[0].notify.unraid === true);
    ok('schedules, watchdogs and the interface survive', h.puts[0].schedules.length === 1 && h.puts[0].watchdogs.length === 1 && h.puts[0].shape_iface === 'eth1');
    h.env.shapeIface = 'eth2';
    await h.fns.saveShape('field');
    ok('the interface save keeps the notify block', h.puts[1].shape_iface === 'eth2' && h.puts[1].notify.unraid === true);
  }

  console.log('\nThe switch reverts when the engine refuses');
  {
    const h = harness({ config: { notify: {} }, put: 'HTTP 500' });
    let reverted = false;
    h.env.notify.unraid = true;
    await h.fns.saveNotify('switch', () => { reverted = true; });
    ok('the revert runs', reverted);
    ok('the switch itself is shaken and the reason toasted', h.fails.length === 1 && h.fails[0][0] === 'switch' && /Not saved/.test(h.fails[0][1]));
    const down = harness({ config: {}, get: true });
    await down.fns.saveNotify('switch', () => {});
    ok('a failed read writes nothing', down.puts.length === 0 && down.fails.length === 1);
  }

  console.log('\nA text field waits for 800ms of quiet and keeps its value');
  {
    const h = harness({ config: { notify: {} } });
    let saves = 0;
    h.fns.afterQuiet('notify', () => { saves++; });
    h.fns.afterQuiet('notify', () => { saves++; });
    h.fns.afterQuiet('shape', () => { saves++; });
    const live = h.timers.filter((t) => t.live);
    ok('every keystroke restarts its own field\'s wait', live.length === 2);
    ok('the wait is 800ms', live.every((t) => t.ms === 800));
    live.forEach((t) => t.fn());
    ok('one save per field once it is quiet', saves === 2);
    const bad = harness({ config: {}, put: 'bad shaping interface "x y"' });
    bad.env.shapeIface = 'x y';
    await bad.fns.saveShape('field');
    ok('a rejected interface is named as such', bad.fails[0] && bad.fails[0][1] === 'Invalid interface');
    ok('the typed value is kept', bad.env.shapeIface === 'x y');
  }

  console.log('\nThe page wires it up');
  {
    ok('no Save button is left on either card', !/cc-set-save/.test(settings) && !/saveNotify\(save5\)|saveShape\(save6\)/.test(settings));
    ok('the switch saves on change and reverts itself', /saveNotify\(ntg, function \(\) \{ notify\.unraid = !v; ntg\._setOn\(!v\); \}\)/.test(settings));
    ok('the webhook saves after quiet', /afterQuiet\("notify", function \(\) \{ saveNotify\(document\.getElementById\("cc-set-webhook"\)\); \}\)/.test(settings));
    ok('the interface saves after quiet', /afterQuiet\("shape", function \(\) \{ saveShape\(document\.getElementById\("cc-set-iface"\)\); \}\)/.test(settings));
    ok('the save goes through the config lock', /return withConfigLock\(function \(\) \{/.test(grabFn(settings, 'saveConfigField')));
  }

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
