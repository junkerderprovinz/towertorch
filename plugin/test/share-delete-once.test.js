// The share settings page offers one Delete. Unraid's chkDelete renames Apply to Delete when the
// confirm switch goes on, and shares.js draws its own delete badge beside that switch, so without
// a rule both read Löschen at once. The badge stays and submits through Unraid's button.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Shares.css'), 'utf8');
const js = fs.readFileSync(path.join(DIR, 'scripts/shares.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nOne Delete on the share settings page');
{
  const hide = /html\.cc-shares-on\.cc-on-share-detail #displaybox dl:has\(> \.cc-del-wrap > \.cc-cb-del:checked\) #cmdEditShare \{ display: none !important; \}/;
  ok('Unraid\'s button steps aside while the switch is on', hide.test(css));
  ok('and only then, so Apply stays at rest', !/#cmdEditShare \{[^}]*display: none/.test(css.replace(hide, '')));
  ok('the badge submits through Unraid\'s button, which keeps its own onclick', /if \(cb\.checked && !cb\.disabled\) \{ var sub = document\.getElementById\("cmdEditShare"\); if \(sub\) sub\.click\(\); \}/.test(js));
  ok('the badge comes alive with the switch', /\.cc-del-wrap:has\(\.cc-cb-del:checked\) \.cc-b-del \{[^}]*pointer-events: auto !important;/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
