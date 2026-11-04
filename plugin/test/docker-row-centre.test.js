// A Docker list row centres every cell on its middle, so the badges of one row line up and the row
// is no taller than its tallest stack. What can quietly break it:
//   · a badge group drawn inline, which hangs on the text baseline and adds the descent below it
//   · the <br> Unraid leaves between its hidden CPU and RAM spans opening an empty line on top
//   · a limit gear taller than the badge beside it, which stretches every CPU, RAM and BW line
//   · a margin on one side only, which shifts a group off the middle when it stands alone
const fs = require('fs');
const path = require('path');
const { candidates, withUnraid, DIR } = require('./cascade');
const docker = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const page = withUnraid('docker');
const win = (el, prop) => { const c = candidates(page, el, prop); return c[c.length - 1]; };
const html = ['tt-docker-on', 'tt-popups-on'];

console.log('\nEvery cell centres its content as one block');
{
  ok('docker.js centres each cell of a themed row', /td2\.style\.setProperty\("vertical-align", "middle", "important"\)/.test(js));
  for (const cls of ['tt-netgroup', 'tt-resgroup', 'tt-planholder', 'tt-restwarn']) {
    const w = win({ tag: 'div', classes: ['tt-rowbadges', cls], attrs: {}, states: {}, html, outside: ['.tt-grid-holder', '.tt-card'] }, 'display');
    ok('.' + cls + ' is a block, not a group on the text line', !!w && w.value === 'flex', w && w.selector + ' => ' + w.value);
  }
  // Unraid's span.outer carries a 20px bottom margin, which the logo cell would add to the row.
  for (const [where, html2] of [['Docker', ['tt-docker-on']], ['VM', ['tt-vms-on']]]) {
    const outer = { tag: 'span', classes: ['outer'], attrs: {}, states: {}, html: html2, inside: [where === 'Docker' ? '#docker_list' : '#kvm_list'], outside: ['.tt-grid-holder'] };
    const c = candidates(page, outer, 'margin-bottom').concat(candidates(page, outer, 'margin')).sort((x, y) => (x.important - y.important) || require('./cascade').cmp(x.spec, y.spec) || (x.order - y.order));
    const w = c[c.length - 1];
    ok('the ' + where + ' logo cell adds no margin under the logo', !!w && w.value === '0', w && w.sheet + ': ' + w.selector + ' => ' + w.value);
  }
  ok('the stray <br> beside the CPU and RAM badges takes no line',
    /#docker_list tr:is\(\.sortable, \.folder-element\) > td:has\(> \.tt-resgroup\) > br \{ display: none; \}/.test(docker));
}

console.log('\nA CPU, RAM or BW line is as tall as its badge');
{
  const gear = { tag: 'span', classes: ['tt-limbtn'], attrs: {}, states: {}, html };
  const h = win(gear, 'height'), m = win(gear, 'margin');
  ok('the gear is one icon badge high', !!h && /var\(--tt-icon-badge, 26px\)/.test(h.value), h && h.value);
  ok('with no margin on top of that', !!m && m.value === '0', m && m.selector + ' => ' + m.value);
}

console.log('\nNo group carries a margin on one side only');
{
  for (const sel of ['.tt-enh.tt-dens-compact .tt-rowbadges', '.tt-enh.tt-dens-airy .tt-rowbadges', '#docker_list td.updatecolumn .tt-rowbadges']) {
    const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(docker);
    ok(sel + ' keeps both sides even', !!m && /margin-block:/.test(m[1]) && !/margin-top:/.test(m[1]), m && m[1]);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
