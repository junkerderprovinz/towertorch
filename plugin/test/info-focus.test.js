// The (i) glyph shows keyboard focus with TowerTorch's 3px accent halo. It has no fill
// of its own, so an opacity step alone reads exactly like hover (GlimStone asks for visible
// focus here; CC answers with its halo, since it draws no rings or borders anywhere).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\nThe halo');
const tokens = clean(read('sheets/TowerTorch.Tokens.css'));
const body = (/(^|\})\s*\.cc-info:focus-visible \{([^}]*)\}/.exec(tokens) || [])[2] || '';
ok('Tokens.css, loaded on every page, gives .cc-info a focus-visible rule', body.length > 0);
ok('it draws the 3px accent halo', /box-shadow: 0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\) !important;/.test(body));
ok('with a plain fallback for a browser without color-mix', /box-shadow: 0 0 0 3px rgba\(252, 196, 25, \.42\) !important;/.test(body));
ok('round, following the ring the glyph draws', /border-radius: 50%;/.test(body));
ok('and no outline ring', /outline: none !important;/.test(body));
ok('focused, the glyph is at full strength', /opacity: 1 !important;/.test(body));

// The halo has to win the whole cascade of every page the glyph appears on, not just
// stand in Tokens.css: a blanket focus rule elsewhere that is heavier, or as heavy and
// later, takes it away again.
console.log('\nNothing takes it away again, across every sheet a page loads');
const { candidates, cmp } = require('./cascade');
const INFO = { tag: 'span', classes: ['cc-info'], attrs: { class: 'cc-info', tabindex: '0', 'data-tip': 'x', 'aria-label': 'x' }, states: { focus: true, 'focus-visible': true } };
const HALO = /^0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)$/;
const winner = (page, prop, el) => { const c = candidates(page, el || INFO, prop); return c[c.length - 1]; };
{
  const sheets = [{ name: 'a.css', css: '.cc-info:focus-visible { box-shadow: 0 0 0 3px red !important; }' },
    { name: 'b.css', css: 'html.x :is(a, [tabindex]):focus-visible { box-shadow: none !important; }' }];
  ok('the resolver sees a heavier blanket rule in a later sheet win', winner(sheets, 'box-shadow').value === 'none');
  sheets[1].css = 'html.x :is(a, [tabindex]):where(:not(.cc-info)):focus-visible { box-shadow: none !important; }';
  ok('and lets the halo through once the rule leaves the glyph out', winner(sheets, 'box-shadow').value === '0 0 0 3px red');
}
for (const page of ['every', 'docker', 'settings']) {
  const w = winner(page, 'box-shadow');
  ok(page + ' page: the halo wins box-shadow', !!w && HALO.test(w.value), w && w.sheet + ' ' + w.selector + ' => ' + w.value);
  const o = winner(page, 'outline');
  ok(page + ' page: no outline ring', !!o && o.value === 'none', o && o.selector + ' => ' + o.value);
  const op = winner(page, 'opacity');
  ok(page + ' page: the focused glyph is at full strength', !!op && op.value === '1', op && op.selector + ' => ' + op.value);
  // Sheets with the same Menu number load in an order Unraid does not promise, so the halo
  // has to win on weight alone: nothing else that clears it may be as heavy.
  const all = candidates(page, INFO, 'box-shadow');
  const halo = all.filter((c) => HALO.test(c.value))[0];
  const rivals = all.filter((c) => c.selector !== halo.selector && c.important && cmp(c.spec, halo.spec) >= 0);
  ok(page + ' page: no rival as heavy as the halo, whatever the sheet order', rivals.length === 0, rivals.map((r) => r.sheet + ' ' + r.selector).join(' | '));
}
{
  const BTN = { tag: 'button', classes: [], attrs: {}, states: { focus: true, 'focus-visible': true } };
  ok('a plain button on the Docker page still loses its focus ring', winner('docker', 'box-shadow', BTN).value === 'none');
  const TAB = { tag: 'span', classes: [], attrs: { tabindex: '0' }, states: { focus: true, 'focus-visible': true } };
  ok('so does any other [tabindex] element', winner('docker', 'box-shadow', TAB).value === 'none');
}
ok('the shared infoIcon() makes the glyph reachable by Tab', /s\.setAttribute\("tabindex", "0"\)/.test(read('scripts/cc-theme.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
