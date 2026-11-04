// Cancel, Close and every other answer in a window's foot is a filled button (GlimStone rules 3
// and 15). Without a fill of its own it reads as a word next to the button it answers with, so no
// rule on any page may clear the ground of the buttons TowerTorch draws or dresses in a foot.
const { candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const CLEAR = /^(transparent|none|initial|unset|inherit)\b/;

const MODES = {
  normal: ['tt-popups-on', 'tt-docker-on'],
  reactive: ['tt-popups-on', 'tt-docker-on', 'tt-shares-rbneutral', 'tt-header-rbneutral'],
  light: ['tt-popups-on', 'tt-docker-on', 'Theme--white'],
};

const FEET = [
  ['Cancel in a .tt-win', 'settings', { tag: 'span', classes: ['tt-win-btn'], inside: ['.tt-win', '.tt-win-act'] }],
  ['a deleting answer in a .tt-win', 'settings', { tag: 'span', classes: ['tt-win-btn', 'tt-win-del'], inside: ['.tt-win', '.tt-win-act'] }],
  ['a link in a .tt-win foot', 'settings', { tag: 'a', classes: ['tt-win-btn', 'tt-win-link'], inside: ['.tt-win', '.tt-win-act'] }],
  ['Cancel in an editor', 'docker', { tag: 'span', classes: ['tt-btn'], inside: ['.tt-pop', '.tt-pop-act'] }],
  ['Cancel in the gear menu', 'docker', { tag: 'span', classes: ['tt-btn'], inside: ['.tt-menu'] }],
  ['Unraid\'s Cancel in a SweetAlert', 'every', { tag: 'button', classes: ['cancel'], inside: ['.sweet-alert', '.sa-button-container'] }],
  ['Unraid\'s Cancel in a SweetAlert 2', 'every', { tag: 'button', classes: ['swal-button', 'swal-button--cancel'], inside: ['.swal-modal', '.swal-footer'] }],
  ['Unraid\'s answers in a jQuery UI dialog', 'every', { tag: 'button', classes: [], inside: ['.ui-dialog', '.ui-dialog-buttonpane'] }],
];

for (const [mode, html] of Object.entries(MODES)) {
  console.log(`\n${mode}`);
  for (const [what, page, shape] of FEET) {
    const el = Object.assign({ attrs: {}, states: {}, has: [], html }, shape);
    const ground = candidates(page, el, 'background');
    const won = ground[ground.length - 1];
    const cleared = ground.concat(candidates(page, el, 'background-color')).filter((c) => CLEAR.test(c.value.trim()));
    ok(`${what} has a fill`, !!won && !CLEAR.test(won.value.trim()), won ? won.value : 'no rule');
    ok(`${what}: no rule clears it`, cleared.length === 0, cleared.map((c) => `${c.sheet.split('/').pop()} ${c.selector.slice(0, 80)}`).join(' | '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
