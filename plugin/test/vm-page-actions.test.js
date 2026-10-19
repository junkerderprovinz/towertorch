// The VM tab's buttons under the list follow "Page actions": one filled button, the add, at the
// right end, the run-everything pair grey beside it. A VM's description is prose and keeps the
// page font, while the values in the other badges stay monospace.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.VmTab.css'), 'utf8');
const js = fs.readFileSync(path.join(DIR, 'scripts/vms.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const base = /html\.cc-vms-on #displaybox input\[type="button"\]:not\(\.autostart\) \{([^}]*)\}/.exec(css);
ok('the buttons rest grey', base && /background: var\(--cc-surface-3, #2e2e2e\) !important;/.test(base[1]), base && base[1]);
ok('in sentence case', base && /text-transform: none !important;/.test(base[1]) && !/uppercase/.test(base[1]));
ok('and take their palette slot under the pointer', /input\[type="button"\]:not\(\.autostart\):hover:not\(:disabled\) \{ background: var\(--cc-rb-c/.test(css));
ok('only VM hinzufügen is filled', /input#btnAddVM \{ background: var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(css));
ok('and it stands at the right end of the row', /div\.js-actions:has\(> #btnAddVM\) \{ display: flex;/.test(css) && /> #btnAddVM \{ order: 1; margin-left: auto !important; \}/.test(css));
ok('the description badge is marked', /vmCell\(c\.desc, "", "desc"\)/.test(js));
ok('and keeps the page font', /#kvm_list \.cc-b-desc \.cc-b-v \{ font-family: inherit; \}/.test(css));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
