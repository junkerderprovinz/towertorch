// A row is quiet at rest (GlimStone rules 6 and 33). Its buttons come in while the pointer is over
// the row or the focus is inside it, and stay on a touch screen, which has no hover; a running
// container or VM shows no state, since running is the normal case. This holds for the Docker list,
// the card and the folder view's tile, and for the VM rows. What can quietly break it:
//   · hiding the buttons with visibility or display, which takes them out of the Tab order, so the
//     keyboard can never bring them in
//   · buttons that are not focusable, so :focus-within never fires
//   · a heavier rule elsewhere that keeps the bar visible, or hides it on a touch screen
//   · the quiet rule catching the plan chip's readiness dot or an unhealthy container
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const flat = (css) => clean(css).replace(/\s+/g, ' ');
const docker = flat(read('styles/docker.css')), vm = flat(read('sheets/TowerTorch.VmTab.css'));

console.log('\nThe buttons come in on hover and on focus');
{
  ok('Docker: the bar and the single action rest invisible, by opacity', docker.includes('html.tt-docker-on :is(.tt-actbar, .tt-mrow-act) { opacity: 0; transition: opacity var(--tt-motion-fade-dur, 0s); }'));
  ok('Docker: a list row, a card or a tile brings them in on hover or focus',
    docker.includes('html.tt-docker-on :is(#docker_list tr, .tt-card):is(:hover, :focus-within) :is(.tt-actbar, .tt-mrow-act), html.tt-docker-on .tt-actbar.tt-act-flash { opacity: 1; }'));
  ok('Docker: a touch screen keeps them', docker.includes('@media (hover: none) { html.tt-docker-on :is(.tt-actbar, .tt-mrow-act) { opacity: 1; } }'));
  ok('VMs: the bar rests invisible, by opacity', vm.includes('html.tt-vms-on .tt-actbar { opacity: 0; transition: opacity var(--tt-motion-fade-dur, 0s); }'));
  ok('VMs: a row brings it in on hover or focus', vm.includes('html.tt-vms-on #kvm_list tr:is(:hover, :focus-within) .tt-actbar, html.tt-vms-on .tt-actbar.tt-act-flash { opacity: 1; }'));
  ok('VMs: a touch screen keeps it', vm.includes('@media (hover: none) { html.tt-vms-on .tt-actbar { opacity: 1; } }'));
  // Every rule that can reach the bar's opacity or visibility is one of the above, so nothing
  // heavier keeps it on screen or takes it off the Tab order.
  for (const [page, cls, html] of [['docker', 'tt-actbar', ['tt-docker-on']], ['docker', 'tt-mrow-act', ['tt-docker-on']], ['every', 'tt-actbar', ['tt-vms-on']]]) {
    const el = { tag: 'div', classes: [cls], attrs: {}, states: {}, html };
    const op = candidates(page, el, 'opacity').map((c) => c.selector);
    ok(cls + ' (' + page + '): only the reveal rules set its opacity', op.length >= 2 && op.every((s) => /tt-act-flash|:hover, :focus-within|^html\.tt-(docker|vms)-on (:is\(\.tt-actbar, \.tt-mrow-act\)|\.tt-actbar)$/.test(s)), op.join(' | '));
    const hide = candidates(page, el, 'visibility').concat(candidates(page, el, 'display').filter((c) => /none/.test(c.value)));
    ok(cls + ' (' + page + '): and nothing hides it from the keyboard', hide.length === 0, hide.map((c) => c.selector + ' ' + c.value).join(' | '));
  }
  for (const f of ['scripts/docker.js', 'scripts/vms.js']) {
    const src = read(f);
    const fn = /function actBtn\(icon, tip, fn\) \{[\s\S]*?\n  \}/.exec(src);
    ok(path.basename(f) + ': each live button is reachable by Tab and keyed like a button', !!fn && /window\.TTTheme\.pressable\(b\)/.test(fn[0]) && /aria-label/.test(fn[0]));
  }
  const theme = read('scripts/tt-theme.js');
  ok('pressable() gives the role, a tab stop and Enter and Space', /function pressable\(el\) \{[\s\S]*?setAttribute\("role", "button"\)[\s\S]*?setAttribute\("tabindex", "0"\)[\s\S]*?e\.key === "Enter" \|\| e\.key === " "/.test(theme));
}

console.log('\nA running container shows no state');
{
  const rule = /(html\.tt-docker-on \.tt-enh \.tt-ct-dotrow:has[^{]*)\{ display: none !important; \}/.exec(docker);
  ok('one rule hides the running state in every Docker view', !!rule);
  const sels = rule ? rule[1].split(/,(?![^(]*\))/).map((s) => s.trim()) : [];
  ok('list: the dot row under the name, while its dot says running', sels.includes('html.tt-docker-on .tt-enh .tt-ct-dotrow:has(> .tt-ct-statedot[data-name].tt-badge-running:not(.tt-badge-alert))'));
  ok('card: the state badge', sels.includes('html.tt-docker-on .tt-grid-holder .tt-card-state > .tt-badge-running:not(.tt-badge-alert)'));
  ok('tile: the dot and the word beside it', sels.includes('html.tt-docker-on .tt-grid-holder .tt-tile-dot.tt-badge-running:not(.tt-badge-alert)') && sels.includes('html.tt-docker-on .tt-grid-holder .tt-tile-dot.tt-badge-running:not(.tt-badge-alert) + .tt-tile-status'));
  ok('an unhealthy container keeps its state, every selector excludes the alert', sels.length === 4 && sels.every((s) => s.includes(':not(.tt-badge-alert)')));
  ok('the plan badge carries its dependency state itself, so no dot beside it competes with the reveal', !/depStateDot/.test(read('scripts/docker.js')) && sels[0].includes('[data-name]'));
  ok('VMs: a running VM\'s state badge goes', vm.includes('html.tt-vms-on #kvm_list td.vm-name .inner > span.state.tt-badge-running { display: none !important; }'));
  ok('a stopped one keeps it', !/span\.state\.tt-badge-(exited|paused)\s*\{[^}]*display: none/.test(vm));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
