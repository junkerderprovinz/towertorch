// Closing the Startplan window with work in it, a new schedule, a changed watchdog or idle stop,
// asks "Ungespeicherte Änderungen verwerfen?" in a TowerTorch window instead of dropping the
// work. Every way out a user takes goes through that question: Close, Escape, the scrim and a click
// outside. An untouched window closes at once, and a save still closes without asking.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// dismissPop over a stubbed window and CCTheme.ask.
function harness(unsaved) {
  const asked = [], log = [];
  const win = { CCTheme: { ask: (o) => asked.push(o) } };
  const pop = { _unsaved: unsaved == null ? undefined : () => unsaved };
  const env = new Function('window', 'pop', 'log',
    'var openPop = pop; function t(k) { return { discardTitle: "Ungespeicherte Änderungen verwerfen?", discard: "Verwerfen", keepEditing: "Weiter bearbeiten" }[k]; }' +
    'function closePop() { log.push("closed"); openPop = null; }\n' + grabFn(docker, 'dismissPop') + '\nreturn { dismiss: dismissPop, open: function () { return openPop; } };')(win, pop, log);
  return { env, asked, log };
}

console.log('\nThe question');
{
  const h = harness(true);
  h.env.dismiss();
  ok('a window with unsaved work stays open', h.log.length === 0 && h.env.open() !== null);
  ok('and asks in a TowerTorch window', h.asked.length === 1);
  const q = h.asked[0] || {};
  ok('whose title says what happens', q.title === 'Ungespeicherte Änderungen verwerfen?', q.title);
  ok('with "Verwerfen" and "Weiter bearbeiten"', q.ok === 'Verwerfen' && q.cancel === 'Weiter bearbeiten');
  ok('as a discarding answer, so the focus starts on the safe one', q.danger === true);
  if (q.onOk) q.onOk();
  ok('"Verwerfen" closes the window', h.log.join() === 'closed');
}
{
  const h = harness(true);
  h.env.dismiss();
  ok('"Weiter bearbeiten" leaves the window and its work alone', h.log.length === 0 && h.env.open() !== null);
}
{
  const h = harness(false);
  h.env.dismiss();
  ok('an untouched window closes at once', h.log.join() === 'closed' && h.asked.length === 0);
  const plain = harness(null);
  plain.env.dismiss();
  ok('so does a window that keeps no draft', plain.log.join() === 'closed' && plain.asked.length === 0);
}

console.log('\nEvery way out asks');
ok('the close badge, Escape and the scrim, through the modal', /window\.CCTheme\.modal\(pop, \{ opener: anchor, onDismiss: dismissPop \}\)/.test(docker));
ok('a click outside, but not a click in the question itself', /!e\.target\.closest\("\.cc-plan, \.cc-drop, \.cc-dlg"\)\) dismissPop\(\);/.test(docker));
ok('Escape without a modal', /if \(e\.key === "Escape"\) \{ try \{ dismissPop\(\);/.test(docker));

console.log('\nThe Startplan window keeps a draft');
{
  const ed = grabFn(docker, 'openEditor');
  ok('it compares what Save would store with what it opened with', /function draft\(\) \{ return JSON\.stringify\(\[readWatchdog\(\), readNursery\(\), readSchedules\(\), sList\.children\.length\]\); \}/.test(ed) && /var opened = draft\(\);\s*pop\._unsaved = function \(\) \{ return draft\(\) !== opened; \};/.test(ed));
  ok('a new schedule row counts even before it has a time', /sList\.children\.length/.test(ed));
  ok('Save closes without asking', /function saveEditor\(/.test(docker) && !/dismissPop/.test(grabFn(docker, 'saveEditor')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
