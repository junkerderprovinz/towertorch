// Loading the settings page renders it more than once: at once, again when the engine config
// arrives, and again when the menu order changes. Each render reads the engine state and the config,
// so those reads share one request, and a failed read is tried again once before the Info tab
// says the engine cannot be reached.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// apiRead over a stubbed api(): answers is a list of 'ok' or 'fail', one per request sent.
function harness(answers) {
  const sent = [];
  const api = (method, p) => { sent.push(method + ' ' + p); const a = answers.shift() || 'ok'; return a === 'ok' ? Promise.resolve({ path: p, n: sent.length }) : Promise.reject(new Error('net::ERR_FAILED')); };
  const fastTimeout = (fn) => setImmediate(fn);
  const read = new Function('api', 'setTimeout', 'var sharedReads = {};\n' + grabFn(settings, 'apiRead') + '\nreturn apiRead;')(api, fastTimeout);
  return { read, sent };
}
const settle = (p) => p.then((v) => ({ v }), (e) => ({ e }));

(async () => {
  console.log('\nThe reads render() makes are shared');
  {
    const h = harness([]);
    const [a, b, c] = await Promise.all([h.read('state'), h.read('state'), h.read('state')]);
    ok('three renders at once send one state request', h.sent.length === 1, h.sent.join(', '));
    ok('and all three get its answer', a === b && b === c);
    await h.read('state');
    ok('a render a moment later reuses the answer', h.sent.length === 1, h.sent.join(', '));
    await h.read('config');
    ok('another path has its own request', h.sent.length === 2 && h.sent[1] === 'GET config', h.sent.join(', '));
  }

  console.log('\nA failed read is tried once more');
  {
    const h = harness(['fail', 'ok']);
    const r = await settle(h.read('state'));
    ok('one failure is recovered by the retry', !r.e && h.sent.length === 2, h.sent.join(', '));
  }
  {
    const h = harness(['fail', 'fail', 'ok']);
    const r = await settle(h.read('state'));
    ok('two failures reach the page as unreachable', !!r.e && h.sent.length === 2, h.sent.join(', '));
    const again = await settle(h.read('state'));
    ok('a failure is not kept: the next render asks again', !again.e && h.sent.length === 3, h.sent.join(', '));
  }

  console.log('\nThe page uses it');
  ok('the Info tab reads the engine state through it', /apiRead\("state"\)\.then\(function \(st\) \{/.test(settings) && !/api\("GET", "state"\)/.test(settings));
  ok('the boot reads the config through it', /apiRead\("config"\)\.then\(function \(c\) \{\s*if \(!c \|\| typeof c !== "object"\) return;\s*fullConfig =/.test(settings));
  ok('the menu watcher starts from the order the first render read', /lastOrd9 = menuOrder\(\);/.test(settings));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
