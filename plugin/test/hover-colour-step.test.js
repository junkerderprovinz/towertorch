// A filled control or clickable badge answers the pointer with one colour step toward
// the theme's text, never with filter: brightness(). The filter brightens the ink on top
// along with the fill and goes nowhere on a light theme, where a step has to darken
// (GlimStone, rule 21). The step is color-mix(fill 85%, text) where the fill is a known
// chain, or --tt-hover-wash laid over the fill as an inset shadow where it is painted
// inline or differs per badge; both land on the same colour.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function files(dir, exts) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p, exts));
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function hoverBrightness(src) {
  const out = []; const re = /([^{}"]*)\{([^{}"]*)\}/g; let m;
  while ((m = re.exec(clean(src)))) if (/:hover/.test(m[1]) && /filter\s*:\s*brightness\(/.test(m[2])) out.push(m[1].trim().replace(/\s+/g, ' '));
  return out;
}
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const TOKENS = read('sheets/TowerTorch.Tokens.css');
const darkBlock = (() => { let o = ''; const re = /(^|\})\s*html\s*\{([^}]*)\}/g; let m; while ((m = re.exec(clean(TOKENS)))) o += m[2]; return o; })();

console.log('\nThe detector finds a brightness hover and passes a colour step');
ok('a brightness hover is found', hoverBrightness('.a:hover { filter: brightness(1.1); }').length === 1);
ok('a colour step is not', hoverBrightness('.a:hover { background: color-mix(in srgb, red 85%, white); }').length === 0);
ok('a brightness focus is not a hover', hoverBrightness('.a:focus-visible { filter: brightness(1.18); }').length === 0);

console.log('\nThe hover tokens');
ok('--tt-accent-hover steps the accent toward the text', /--tt-accent-hover:\s*color-mix\(in srgb, var\(--tt-accent\) 85%, var\(--tt-text\)\);/.test(darkBlock));
for (const s of ['ok', 'warn', 'err']) ok(`--tt-${s}-hover steps the state fill toward the text`, new RegExp(`--tt-${s}-hover:\\s*color-mix\\(in srgb, var\\(--tt-${s}\\) 85%, var\\(--tt-text\\)\\);`).test(darkBlock));
ok('--tt-hover-wash is the same 15% of the text, laid over a fill', /--tt-hover-wash:\s*color-mix\(in srgb, var\(--tt-text\) 15%, transparent\);/.test(darkBlock));

console.log('\nNo hover on a filled control uses a brightness filter');
// What is left reads as text or a picture, not as a filled control: plain links, a user's
// avatar and the transparent CA search glyph.
const ALLOWED = [
  'html.tt-popups-on:has(.ca_homeTemplates) #displaybox a:hover',
  'html.tt-popups-on #alternateView a:hover',
  'html.tt-tools-on #displaybox a:not(.button):hover',
  'html.tt-header-on #displaybox .user-list > a:hover img.picture',
  'html.tt-popups-on .searchSubmit:hover',
];
for (const f of files(DIR, ['.css', '.js'])) {
  const hits = hoverBrightness(fs.readFileSync(f, 'utf8')).filter((s) => !ALLOWED.includes(s));
  ok(path.basename(f), hits.length === 0, hits.map((s) => s.slice(0, 90)).join(' | '));
}

console.log('\nThe step follows the fill it sits on');
{
  const docker = clean(read('styles/docker.css'));
  ok('the force-update link steps the accent', /td\.updatecolumn a\.exec:hover \{ background: var\(--tt-accent-hover\); \}/.test(docker));
  ok('the apply-update link steps the warning fill', /a\.exec:has\(span\.orange-text\):hover \{ background: var\(--tt-warn-hover\); \}/.test(docker));
  ok('the primary button steps its own colour chain', /\.tt-btn-primary:hover \{ background: color-mix\(in srgb, var\(--tt-rb-c, var\(--tt-rbaccent, var\(--tt-accent,/.test(docker));
  ok('a hover on a chosen dropdown entry is the same step, not a filter', /\.tt-pop \.tt-dsel-opt\.is-selected:hover \{ background: color-mix\(/.test(docker));
  ok('the plan chip, whose fill differs per mode, takes the wash', /\.tt-plan:hover \{ box-shadow: inset 0 0 0 100vmax var\(--tt-hover-wash\); \}/.test(docker));
  const shares = clean(read('sheets/TowerTorch.Shares.css'));
  ok('an empty slot\'s name label cancels the wash, as it cancelled the filter', /span\.tt-b\.tt-b-name:hover \{ box-shadow: none !important; \}/.test(shares));
  const settings = read('scripts/settings.js');
  ok('the settings page injects no brightness hover', !/:hover\{[^}]*brightness/.test(settings));
}

// The row actions and limit gears carry an inline !important background, so a hover
// background from a sheet loses to it; only the wash, resolved across every sheet the
// page loads, can show the step.
console.log('\nAn inline-painted control steps under the pointer, whatever else styles it');
{
  const { candidates } = require('./cascade');
  const WASH = 'inset 0 0 0 100vmax var(--tt-hover-wash)';
  const CTLS = {
    'a row action': ['tt-actbtn'],
    'an idle limit gear': ['tt-limbtn', 'tt-lim-cpu'],
    'a set limit gear': ['tt-limbtn', 'tt-limbtn-set', 'tt-lim-bw'],
  };
  for (const [what, classes] of Object.entries(CTLS)) for (const page of ['docker', 'every']) {
    const c = candidates(page, { tag: 'span', classes, attrs: { class: classes.join(' '), 'data-tip': 'x' }, states: { hover: true } }, 'box-shadow');
    const w = c[c.length - 1];
    ok(`${page === 'docker' ? 'Docker' : 'VMs and every other'} page: ${what} takes the wash on hover`, !!w && w.value === WASH, w && w.sheet + ' ' + w.selector + ' => ' + w.value);
  }
  const off = candidates('docker', { tag: 'span', classes: ['tt-actbtn', 'tt-actoff'], attrs: { class: 'tt-actbtn tt-actoff' }, states: { hover: true } }, 'box-shadow');
  ok('a greyed placeholder action does not answer the pointer', !off.some((x) => x.value === WASH));
}

// In the reactive mode a plugin row's badges take the row's colour once the row is hovered, so a
// clickable one needs a step of its own on top, or the pointer over it changes nothing.
console.log('\nA plugin row\'s delete badge steps under the pointer in the reactive mode');
{
  const { candidates } = require('./cascade');
  const html = ['tt-shares-rbneutral', 'tt-on-plugins'];
  for (const [what, tag, classes] of [['delete', 'span', ['tt-b-del']]]) {
    const at = (states) => { const c = candidates('docker', { tag, classes, attrs: {}, states, html, inside: ['#plugin_list'] }, 'background'); return c[c.length - 1]; };
    const row = at({}), hov = at({ hover: true });
    ok(`${what}: under the pointer it is a step off the row's colour`, !!hov && /^color-mix\(in srgb, var\(--tt-rb-c, var\(--tt-accent, #FCC419\)\) 85%, var\(--tt-text, #e6e6e6\)\)$/.test(hov.value), hov && hov.selector + ' => ' + hov.value);
    ok(`${what}: which differs from what it shows while only the row is hovered`, !!row && !!hov && row.value !== hov.value);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
