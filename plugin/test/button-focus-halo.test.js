// Every CC button, badge and field shows keyboard focus with the 3px accent halo. CC draws no
// rings or outlines, and a brightness step on a filled badge is too faint to see ("Öffnen" moved
// 1.12:1), so the halo has to win the whole cascade of each page: the blanket no-ring rules in
// docker.css, Shares.css and VmTab.css leave these controls out.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const HALO = /^0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)$/;

// The list the halo rule names, read from Tokens.css.
const haloRule = parseRules(read('sheets/TowerTorch.Tokens.css')).find((r) => /^:is\([^)]*\.cc-btn[^)]*\):focus-visible$/.test(r.selector.replace(/\s+/g, ' ').trim()));
const LIST = haloRule ? /^:is\(([^)]*)\)/.exec(haloRule.selector.replace(/\s+/g, ' '))[1].split(',').map((s) => s.trim().slice(1)) : [];

console.log('\nThe halo rule');
ok('Tokens.css has one halo rule for CC controls', !!haloRule);
for (const c of ['cc-btn', 'cc-b', 'cc-badge', 'cc-actbtn', 'cc-limbtn', 'cc-bulkbtn', 'cc-bulkmode-badge', 'cc-hgear', 'cc-day', 'cc-set-tab', 'cc-in']) {
  ok(`it covers .${c}`, LIST.includes(c));
}
ok('it carries !important, as the blanket rules it competes with do', !!haloRule && haloRule.decls.some((d) => d.prop === 'box-shadow' && d.important && HALO.test(d.value)));

console.log('\nThe blanket no-ring rules leave the same list out');
const BLANKETS = [['styles/docker.css', /^:is\(a, button, input, select, \[tabindex\]\):where\(:not\(/], ['sheets/TowerTorch.Shares.css', /^html\.cc-shares-on :is\(a, button/], ['sheets/TowerTorch.VmTab.css', /^html\.cc-vms-on #displaybox :is\(a, button/]];
for (const [sheet, re] of BLANKETS) {
  const r = parseRules(read(sheet)).find((x) => re.test(x.selector.replace(/\s+/g, ' ').trim()));
  const sel = r ? r.selector.replace(/\s+/g, ' ') : '';
  const missing = LIST.filter((c) => !new RegExp(':where\\(:not\\([^)]*\\.' + c.replace(/-/g, '\\-') + '[,)]').test(sel));
  ok(`${sheet}: every listed control is left out`, !!r && missing.length === 0, missing.join(' '));
}

console.log('\nThe halo wins on every page, in every mode');
const MODES = { dark: ['cc-docker-on', 'cc-shares-on', 'cc-popups-on', 'cc-header-on'], 'white, reactive, VMs': ['cc-docker-on', 'cc-shares-on', 'cc-popups-on', 'cc-header-on', 'cc-shares-rbneutral', 'Theme--white', 'cc-vms-on'] };
for (const page of ['every', 'docker', 'settings']) {
  for (const [mode, html] of Object.entries(MODES)) {
    const lost = [];
    for (const c of LIST) {
      for (const tag of ['button', 'span']) {
        const el = { tag, classes: [c], attrs: tag === 'span' ? { tabindex: '0', role: 'button' } : { type: 'button' }, states: { focus: true, 'focus-visible': true }, html, inside: ['#displaybox', '#cc-settings', '.js-actions'] };
        const all = candidates(page, el, 'box-shadow'), w = all[all.length - 1];
        if (!w || !HALO.test(w.value)) lost.push(`${tag}.${c} (${w ? w.sheet.split('/').pop() + ' ' + w.selector.slice(0, 60) : 'nothing'})`);
      }
    }
    ok(`${page} page, ${mode}`, lost.length === 0, lost.join(' | '));
  }
}

console.log('\nThe Docker action bar\'s native buttons are drawn by CC, so they take the halo too');
for (const [mode, html] of Object.entries(MODES)) {
  for (const cls of [[], ['cc-bar-primary']]) {
    const el = { tag: 'input', classes: cls, attrs: { type: 'button' }, states: { focus: true, 'focus-visible': true }, html, inside: ['.js-actions'], outside: ['#displaybox', '.cc-pop', '.cc-win', '#cc-settings', '.multi_installDiv'] };
    const bs = candidates('docker', el, 'box-shadow'), w = bs[bs.length - 1];
    ok(`${mode}: ${cls.length ? '"Container hinzufügen"' : 'a grey bar button'} shows the halo`, !!w && HALO.test(w.value), w && w.value + ' from ' + w.selector.slice(0, 70));
    const f = candidates('docker', el, 'filter'), wf = f[f.length - 1];
    ok(`${mode}: and no brightness step on top of it`, !wf || wf.value === 'none', wf && wf.value);
  }
}

console.log('\nThe trash badge on the Plugins page and on the install log');
for (const html of [['cc-on-plugins', 'cc-docker-on'], ['cc-tools-on']]) {
  const el = { tag: 'span', classes: ['cc-b-del', 'cc-b-delicon'], attrs: { tabindex: '0', role: 'button' }, states: { focus: true, 'focus-visible': true }, html };
  const bs = candidates('docker', el, 'box-shadow'), w = bs[bs.length - 1];
  ok(html[0] + ': it shows the halo', !!w && HALO.test(w.value), w && w.value + ' from ' + w.selector.slice(0, 70));
}

console.log('\nUnraid\'s own controls keep the brightness step');
{
  const plain = { tag: 'button', classes: [], attrs: {}, states: { focus: true, 'focus-visible': true }, html: MODES.dark };
  const w = candidates('docker', plain, 'box-shadow');
  ok('a plain button on the Docker page draws no ring', w.length > 0 && w[w.length - 1].value === 'none');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
