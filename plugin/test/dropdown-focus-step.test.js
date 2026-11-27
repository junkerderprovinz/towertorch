// A dropdown trigger is a field, so keyboard focus fills it one step up the ramp, the step the text
// fields beside it take, rather than a ring or the page's brightness step (GlimStone rule 14). The
// focus wins over the hover, so a focused trigger under the pointer still shows it has the keys.
const fs = require('fs');
const path = require('path');
const { candidates, DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const win = (page, e, prop) => { const c = candidates(page, e, prop); return c.length ? c[c.length - 1].value : '(none)'; };
const focused = (e, hover) => Object.assign({}, e, { states: Object.assign({ focus: true, 'focus-visible': true }, hover ? { hover: true } : {}) });
const ring = (v) => /var\(--tt-accent-ink/.test(v);

const TRIGGERS = [
  { name: 'the settings dropdown', page: 'settings', cls: 'tt-dsel-trigger', html: ['tt-popups-on'], inside: ['#tt-settings'], outside: ['.tt-pop', '#tt-vmlim'],
    fill: /^var\(--tt-surface-chip-hi, color-mix\(in srgb, var\(--tt-surface-chip, #383838\) 82%, #ffffff\)\)$/, prop: 'background-color' },
  { name: 'the add-container form dropdown', page: 'docker', cls: 'tt-dsel-trigger', html: ['tt-popups-on', 'tt-docker-on', 'tt-on-addct'], outside: ['.tt-pop', '#tt-settings', '#tt-vmlim'],
    fill: /^rgba\(255, 255, 255, \.11\)$/, prop: 'background' },
  { name: 'the same dropdown on the white theme', page: 'docker', cls: 'tt-dsel-trigger', html: ['tt-popups-on', 'tt-docker-on', 'tt-on-addct', 'Theme--white'], outside: ['.tt-pop', '#tt-settings', '#tt-vmlim'],
    fill: /^rgba\(0, 0, 0, \.1\)$/, prop: 'background' },
  { name: 'the plan editor dropdown', page: 'docker', cls: 'tt-dsel-trigger', html: ['tt-popups-on', 'tt-docker-on'], inside: ['.tt-pop'], outside: ['#tt-settings', '#tt-vmlim'],
    fill: /^#383838$/, prop: 'background' },
  { name: 'the page dropdown header.js wraps', page: 'docker', cls: 'tt-tsel-trigger', html: ['tt-popups-on', 'tt-docker-on'], inside: ['#displaybox'],
    fill: /^color-mix\(in srgb, var\(--tt-tl-surface2\) 85%, var\(--tt-text, #e6e6e6\)\)$/, prop: 'background' },
  { name: 'the share settings dropdown', page: 'every', cls: 'tt-sel-trigger', html: ['tt-popups-on', 'tt-shares-on', 'tt-on-share-detail'], inside: ['#displaybox'],
    fill: /^color-mix\(in srgb, var\(--tt-surface-3, #2e2e2e\) 85%, var\(--tt-text, #e6e6e6\)\)$/, prop: 'background' },
  { name: 'the VM limits dropdown', page: 'every', cls: 'tt-dsel-trigger', html: ['tt-popups-on', 'tt-vms-on'], inside: ['#tt-vmlim'], outside: ['#tt-settings', '.tt-pop'],
    fill: /^color-mix\(in srgb, var\(--tt-surface-3, #2e2e2e\) 85%, var\(--tt-text, #e6e6e6\)\)$/, prop: 'background-color' },
];

for (const t of TRIGGERS) {
  console.log('\n' + t.name);
  const el = { tag: 'span', classes: [t.cls], attrs: { tabindex: '0' }, html: t.html, inside: t.inside, outside: t.outside };
  const bg = win(t.page, focused(el), t.prop);
  ok('focus fills it one step up', t.fill.test(bg), bg);
  const under = win(t.page, focused(el, true), t.prop);
  ok('and keeps that fill under the pointer', t.fill.test(under), under);
  const shadow = win(t.page, focused(el), 'box-shadow');
  ok('with no ring', !ring(shadow), shadow);
  const filter = win(t.page, focused(el), 'filter');
  ok('and no brightness step on top', !/brightness/.test(filter), filter);
}

console.log('\nThe VM form');
{
  const pages = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Pages.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const ringed = (pages.match(/[^{}]+\{[^}]*var\(--tt-accent-ink[^}]*\}/g) || []).filter((r) => /tt-tsel-trigger/.test(r.split('{')[0]));
  ok('rings its text fields but not its dropdowns', ringed.length === 0, ringed.join(' | '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
