// Parts of a surface are set off by space or a surface step, never by a rule line: the limit
// group at the foot of a Docker card.
const { candidates, withUnraid } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const SIDES = ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-block', 'border-block-start', 'border-block-end'];
const lines = (page, e) => SIDES.flatMap((p) => candidates(page, e, p).filter((c) => !/^(none|0|0px)$/.test(c.value.trim())).map((c) => p + ': ' + c.value + ' (' + c.selector + ')'));

const parts = [
  ['the limit group on a Docker card', 'docker', { tag: 'div', classes: ['cc-rowbadges', 'cc-resgroup', 'cc-card-res'], inside: ['.cc-card'], outside: ['#docker_list', '.cc-enh'], html: ['cc-docker-on'] }],
];
for (const [name, page, e] of parts) {
  const found = lines(withUnraid(page), e);
  ok(name + ' draws no line', !found.length, found.join(' | '));
}
// The card's own gap sets the limit group off from the action row above it.
const card = candidates(withUnraid('docker'), { tag: 'div', classes: ['cc-card'], inside: ['.cc-grid-holder'], outside: ['#docker_list', '.cc-enh'], html: ['cc-docker-on'] }, 'gap').pop();
const space = candidates(withUnraid('docker'), { tag: 'div', classes: ['cc-grid-holder'], html: ['cc-docker-on'] }, '--cc-card-space').pop();
ok('the limit group keeps its distance from the action row above', card && /var\(--cc-card-space\)/.test(card.value) && space && parseFloat(space.value) >= 8, (card && card.value) + ' / ' + (space && space.value));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
