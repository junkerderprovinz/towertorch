// Preclear (Next 2026.11.24) shows each running preclear as an icon in the footer's right part,
// whose tooltip carries the progress and the controls to open or stop it. TowerTorch hides the
// native footer by default, so while a preclear runs its icons stay on screen, in their native
// place, and the rest of the footer stays hidden.
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const rules = parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Header.css'), 'utf8'));
const find = (re) => rules.find((r) => r.selector.split(',').some((s) => re.test(s.trim())));
const decl = (r, prop) => { const d = r && r.decls.find((x) => x.prop === prop); return d ? d : {}; };

const RUNNING = '#footer:has(#preclear-footer > .exec)';
console.log('\nThe footer stays hidden without a preclear');
{
  const hide = rules.filter((r) => decl(r, 'display').value === 'none' && r.selector.split(',').some((s) => /^html\.tt-footer-off #footer\b/.test(s.trim())));
  ok('one rule hides it', hide.length === 1, hide.map((r) => r.selector).join(' | '));
  ok('with !important, over Unraid\'s own display', !!hide[0] && decl(hide[0], 'display').important);
  ok('unless a preclear icon is in it', !!hide[0] && hide[0].selector.trim() === 'html.tt-footer-off #footer:not(:has(#preclear-footer > .exec))', hide[0] && hide[0].selector);
}

console.log('\nA running preclear keeps its icons');
{
  const keep = find(new RegExp('^html\\.tt-footer-off ' + RUNNING.replace(/[()#.>]/g, '\\$&') + '$'));
  ok('the footer keeps Unraid\'s layout but is drawn only where the icons are', !!keep && decl(keep, 'visibility').value === 'hidden' && !decl(keep, 'display').value, keep && keep.selector);
  const icons = find(/^html\.tt-footer-off #preclear-footer$/);
  ok('the icons themselves are visible', !!icons && decl(icons, 'visibility').value === 'visible');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
