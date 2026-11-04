// The share settings page fills its fields and dropdowns with the field step of the surface ladder,
// which flips with the theme, and writes in the theme's ink, so they read on the white and azure
// pages as on the dark ones. A fixed light grey text on a light field disappears.
const { candidates, withUnraid, tokens, resolve } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const page = withUnraid('every');
const html = ['tt-shares-on', 'tt-on-share-detail', 'Theme--white'];
const win = (e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');
const inked = (v) => /^var\(--tt-text, #e[6a]e[6a]e[6a]\)$/.test(v);
const field = (v) => /^var\(--tt-surface-3, #2e2e2e\)$/.test(v);
const raised = (v) => /^color-mix\(in srgb, var\(--tt-surface-3, #2e2e2e\) 85%, var\(--tt-text, #e6e6e6\)\)$/.test(v);

console.log('\nThe fields follow the theme');
{
  const input = { tag: 'input', classes: [], attrs: { type: 'text' }, inside: ['#displaybox'], html };
  ok('a text field writes in the theme\'s ink', inked(val(win(input, 'color'))), val(win(input, 'color')));
  ok('on the field step of the surface ladder', field(val(win(input, 'background'))), val(win(input, 'background')));
  ok('and one step up on focus', raised(val(win(Object.assign({}, input, { states: { focus: true } }), 'background'))));
  const dd = { tag: 'span', classes: ['ui-dropdownchecklist'], inside: ['#displaybox'], html };
  ok('the disk picker takes the same fill', field(val(win(dd, 'background-color'))), val(win(dd, 'background-color')));
  const ddText = { tag: 'span', classes: ['ui-dropdownchecklist-text'], inside: ['#displaybox'], outside: ['.ui-dropdownchecklist-item'], html };
  ok('and the same ink', inked(val(win(ddText, 'color'))));
  const trig = { tag: 'span', classes: ['tt-sel-trigger'], inside: ['#displaybox', '.tt-sel'], outside: ['.tt-open'], html };
  ok('a single-select at rest too', field(val(win(trig, 'background'))) && inked(val(win(trig, 'color'))), val(win(trig, 'background')));
}

console.log('\nThe ink reads on both pages');
{
  const lum = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const light = tokens(true), dark = tokens(false);
  const lt = resolve('var(--tt-text)', light), dt = resolve('var(--tt-text)', dark);
  ok('dark ink on the white page, 4.5:1 at the least', ratio(lt, '#f2f2f2') >= 4.5, lt);
  ok('light ink on the black page, 4.5:1 at the least', ratio(dt, '#1c1b1b') >= 4.5, dt);

  // "Keine nicht zugewiesenen Geräte" and the like sit in a grey pill, a 14% wash over the page.
  const muted = { tag: 'span', classes: ['tt-muted'], inside: ['#displaybox'], html: ['tt-shares-on'] };
  const mc = val(win(muted, 'color'));
  for (const [name, scope, pill] of [['white', light, '#e2e2e2'], ['black', dark, '#2a2a2a']]) {
    const ink = resolve(mc, scope);
    ok('an empty-state notice reads at 4.5:1 on the ' + name + ' page', /^#[0-9a-f]{6}$/i.test(ink) && ratio(ink, pill) >= 4.5, ink + ' on ' + pill);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
