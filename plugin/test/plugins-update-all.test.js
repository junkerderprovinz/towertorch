// Unraid shows "Update All Plugins" in the Plugins tab row only once two plugin updates are
// pending. TowerTorch shows it from one. What can quietly break it:
//   · the button staying hidden with exactly one update pending
//   · the button showing with nothing pending, or for the disabled Unraid OS row, which Unraid's
//     own count leaves out
//   · the button coming back while the update it started is still running, which would let a
//     second click start the same update again
//   · the check running with theming off, where the Plugins tab stays Unraid's own
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const js = fs.readFileSync(path.join(DIR, 'scripts/plugins.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const ua = { style: { display: 'none' } };
let pending = [];
const document = {
  getElementById: (id) => (id === 'updateall' ? ua : null),
  querySelectorAll: (sel) => (sel === '#plugin_list input.update:not(:disabled)' ? pending.filter((p) => !p.disabled).map((p) => ({ getAttribute: () => p.data })) : []),
};
const api = new Function('document', 'var uaHeld = null;\n' + grab('pendingUpdates') + '\n' + grab('showUpdateAll') +
  '\nreturn { tick: showUpdateAll, click: function () { uaHeld = pendingUpdates(); } };')(document);

console.log('\nUpdate All shows from one pending update');
api.tick();
ok('nothing pending, it stays hidden', ua.style.display === 'none');
pending = [{ data: 'unraid.plg', disabled: true }];
api.tick();
ok('the disabled Unraid OS row does not count', ua.style.display === 'none');
pending.push({ data: 'ca.plg' });
api.tick();
ok('one plugin update pending, it shows', ua.style.display === '');
ua.style.display = 'none';
api.tick();
ok('Unraid hiding it after its next list load does not stick', ua.style.display === '');

console.log('\nA started update keeps it hidden');
api.click();
ua.style.display = 'none';
api.tick();
ok('while the same update is pending it stays hidden', ua.style.display === 'none');
pending.push({ data: 'shiplog.plg' });
api.tick();
ok('a new pending update brings it back', ua.style.display === '');
ua.style.display = 'none';
api.click();
pending = [];
api.tick();
ok('once the updates are through it stays hidden', ua.style.display === 'none');

console.log('\nThe tick');
const tick = grab('plugPinTick');
ok('runs it behind the theming and area gate', /cc\.enable\.plugins"\) === "0"\) return;\n\s*showUpdateAll\(\);/.test(tick));
ok('a click on the button holds it', /closest\("#updateall"\)\) uaHeld = pendingUpdates\(\);/.test(js));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
