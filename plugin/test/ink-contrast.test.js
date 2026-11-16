// Ink on a coloured fill is dark (#161616) or white, whichever has the higher contrast ratio, and
// never under 4.5:1: on a mid-tone where neither reaches it the dark ink goes on toward black.
// Every area keeps its own fallback copy of idealText() for when tt-theme.js has not loaded, so
// every copy is held to GlimStone's contrastOn() as written here, and no script may pick ink by the
// old Rec-601 brightness threshold of 150 inline. The accent read as text gets the same floor on
// each ramp's card through accentInks().
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// GlimStone's contrastOn() and accentInks() from packages/core/src/contrast.ts.
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratioOf = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function pushed(from, to, ground) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (ratioOf(mix(from, to, mid).map(Math.round), ground) >= 4.5) hi = mid; else lo = mid; }
  return hexOf(mix(from, to, hi));
}
function contrastOn(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '#fff';
  const fill = rgb(hex), onWhite = ratioOf(fill, [255, 255, 255]), onDark = ratioOf(fill, rgb('#161616'));
  if (onWhite > onDark && onWhite >= 4.5) return '#fff';
  if (onDark >= 4.5) return '#161616';
  return pushed(rgb('#161616'), [0, 0, 0], fill);
}
// GlimStone's oklab.ts: the ink is the accent moved onto a lightness step in OKLab.
const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function oklabOf(hex) {
  const [r, g, b] = rgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q];
}
function srgbOf([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, q = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const c = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q];
  return '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const darkenTo = (hex, to) => { const [l, a, b] = oklabOf(hex); return l <= to ? hex.toUpperCase() : srgbOf([to, a * to / l, b * to / l]); };
const lightenTo = (hex, to) => { const [l, a, b] = oklabOf(hex); return l >= to ? hex.toUpperCase() : srgbOf([to, a * (1 - to) / (1 - l), b * (1 - to) / (1 - l)]); };
// GlimStone's contrast.ts: the ink holds 4.5:1 on the card and on the accent's 14% wash there.
function accentInks(hex) {
  const acc = rgb(hex), light = rgb(darkenTo(hex, 0.5)), dark = rgb(lightenTo(hex, 0.74));
  const wash = (card) => mix(card, acc, 0.14).map(Math.round);
  const reads = (ink, card) => Math.min(ratioOf(ink, card), ratioOf(ink, wash(card))) >= 4.5;
  return {
    light: reads(light, [255, 255, 255]) ? '' : pushed(light, [0, 0, 0], wash([255, 255, 255])),
    dark: reads(dark, [38, 38, 38]) ? '' : pushed(dark, [255, 255, 255], wash([38, 38, 38])),
  };
}
// A fill's hover steps toward the ramp's text, or away from the fill's ink where that would take the ink under 4.5:1.
function accentHovers(hex, lightText, darkText) {
  const fill = rgb(hex), ink = rgb(contrastOn(hex) === '#fff' ? '#ffffff' : contrastOn(hex));
  const away = lum(ink) > lum(fill) ? [0, 0, 0] : [255, 255, 255];
  const hover = (text) => (ratioOf(ink, mix(fill, rgb(text), 0.15).map(Math.round)) >= 4.5 ? '' : hexOf(mix(fill, away, 0.15)));
  return { light: hover(lightText), dark: hover(darkText) };
}
const inkOf = (ink) => rgb(ink === '#fff' ? '#ffffff' : ink);

console.log('\nThe reference itself');
ok('Sunflower takes dark ink', contrastOn('#FCC419') === '#161616');
ok('every palette pastel takes dark ink', ['#FF8389', '#FF832B', '#6FDC8C', '#3DDBD9', '#1D99F3', '#BE95FF', '#FF7EB6'].every((h) => contrastOn(h) === '#161616'));
ok('a deep blue takes white', contrastOn('#0f62fe') === '#fff');
ok('the light-theme error red takes white', contrastOn('#da1e28') === '#fff');
ok('a mid grey where neither reaches 4.5:1 takes an ink pushed toward black',
  /^#0[0-9a-f]0[0-9a-f]0[0-9a-f]$/.test(contrastOn('#7a7a7a')) && ratioOf(inkOf(contrastOn('#7a7a7a')), rgb('#7a7a7a')) >= 4.5, contrastOn('#7a7a7a'));

const SAMPLES = ['#FF8389', '#FF832B', '#FCC419', '#6FDC8C', '#3DDBD9', '#1D99F3', '#BE95FF', '#FF7EB6',
  '#198038', '#da1e28', '#f1c21b', '#0f62fe', '#eab308', '#22c55e', '#06b6d4', '#a855f7', '#f97316',
  '#ffffff', '#000000', '#808080', '#bdbdbd', '#4a4a4a', '#c0c0c0', '#ffd700', '#00ff00', '#ff0000',
  '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#7a7a7a', '#777777', '#7f7f7f', '#8a5a00', '#0080a0', '#a0522d',
  'nonsense', '', '#abc'];

console.log('\nEvery copy answers like contrastOn()');
const COPIES = [['tt-theme.js', 'idealText'], ['header.js', 'idealText'], ['docker.js', 'idealText'], ['favorites.js', 'idealText'],
  ['plugins.js', 'idealText'], ['settings.js', 'idealText'], ['settingsgrid.js', 'idealText'], ['shares.js', 'idealText'], ['vms.js', 'ttIdeal']];
for (const [file, name] of COPIES) {
  const src = grabFn(fs.readFileSync(path.join(DIR, file), 'utf8'), name);
  if (!src) { ok(file + ' has ' + name + '()', false); continue; }
  const fn = new Function(src + '\nreturn ' + name + ';')();
  const off = SAMPLES.filter((h) => fn(h).toLowerCase() !== contrastOn(h)).map((h) => `${h}: ${fn(h)} vs ${contrastOn(h)}`);
  ok(file + ' ' + name + '()', off.length === 0, off.slice(0, 5).join(' | '));
}

console.log('\nEvery ink reaches 4.5:1 on its fill');
{
  const fn = new Function(grabFn(fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8'), 'idealText') + '\nreturn idealText;')();
  const low = [];
  for (let v = 0; v < 256; v += 3) {
    for (const h of [hexOf([v, v, v]), hexOf([v, 255 - v, 128]), hexOf([255 - v, 64, v])]) {
      if (ratioOf(inkOf(fn(h)), rgb(h)) < 4.5) low.push(h);
    }
  }
  ok('across a sweep of greys and hues', low.length === 0, low.slice(0, 5).join(', '));
}

console.log('\nThe accent as text reaches 4.5:1 on each ramp\'s card');
{
  const theme = fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8');
  const fn = new Function(['oklabOf', 'srgbOf', 'darkenTo', 'lightenTo', 'accentInks'].map((n) => grabFn(theme, n) || '').join('\n') + '\nreturn accentInks;')();
  const PRESETS = ['#FCC419', '#1D99F3', '#6FDC8C', '#FF8389', '#BE95FF', '#FF832B', '#3DDBD9', '#FF7EB6'];
  ok('no preset needs an ink of its own', PRESETS.every((h) => fn(h).light === '' && fn(h).dark === ''), PRESETS.filter((h) => fn(h).light || fn(h).dark).join(', '));
  const PICKED = ['#0f62fe', '#5a1d8c', '#2b2b2b', '#ffff66', '#e0e0e0', '#00ff00', '#8a5a00', '#a0522d'];
  const off = PICKED.filter((h) => { const a = fn(h), b = accentInks(h); return a.light !== b.light || a.dark !== b.dark; });
  ok('a picked colour gets the inks GlimStone computes', off.length === 0, off.join(', '));
  const darkInk = (h) => fn(h).dark || lightenTo(h, 0.74), lightInk = (h) => fn(h).light || darkenTo(h, 0.5);
  ok('every picked colour reads at 4.5:1 as ink on the dark card', PICKED.every((h) => ratioOf(rgb(darkInk(h)), [38, 38, 38]) >= 4.5), PICKED.map(darkInk).join(', '));
  ok('and on the light card', PICKED.every((h) => ratioOf(rgb(lightInk(h)), [255, 255, 255]) >= 4.5), PICKED.map(lightInk).join(', '));
  // Surface 4 is the darkest light ground accent text stands on, behind a section title's glyph.
  const LIGHT_GROUNDS = ['#ffffff', '#f4f4f4', '#f2f2f2', '#ececec', '#e6e6e6'];
  const low = PRESETS.flatMap((h) => LIGHT_GROUNDS.filter((g) => ratioOf(rgb(darkenTo(h, 0.5)), rgb(g)) < 4.5).map((g) => h + ' on ' + g));
  ok('every preset reads at 4.5:1 as ink on every light surface', low.length === 0, low.join(', '));
  const steps = new Function(['oklabOf', 'srgbOf', 'darkenTo', 'lightenTo'].map((n) => grabFn(fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8'), n) || '').join('\n') + '\nreturn [darkenTo, lightenTo];')();
  ok('Sunflower\'s ink on the light ramp is GlimStone\'s #7C5F07', steps[0]('#FCC419', 0.5) === '#7C5F07', steps[0]('#FCC419', 0.5));
  ok('Blue\'s ink on the dark ramp lifts to GlimStone\'s #62B1F8', steps[1]('#1D99F3', 0.74) === '#62B1F8', steps[1]('#1D99F3', 0.74));
  ok('and the steps answer like GlimStone\'s for any colour', PICKED.concat(PRESETS).every((h) => steps[0](h, 0.5) === darkenTo(h, 0.5) && steps[1](h, 0.74) === lightenTo(h, 0.74)));
  const css = fs.readFileSync(path.join(DIR, '..', 'sheets', 'TowerTorch.Tokens.css'), 'utf8');
  const INK = 'oklab(from var(--tt-accent) clamp(var(--tt-ink-min, 0), l, var(--tt-ink-max, 1)) calc(a * min(1, var(--tt-ink-max, 1) / l, (1 - var(--tt-ink-min, 0)) / (1 - l))) calc(b * min(1, var(--tt-ink-max, 1) / l, (1 - var(--tt-ink-min, 0)) / (1 - l))))';
  ok('the dark ramp reads --tt-accent-ink-dark first, then the OKLab step', css.includes('--tt-accent-ink:  var(--tt-accent-ink-dark, ' + INK + ');'));
  ok('the light ramp reads --tt-accent-ink-light first, then the OKLab step', css.includes('--tt-accent-ink: var(--tt-accent-ink-light, ' + INK + ');'));
  ok('no ink is mixed toward black in sRGB any more', !/var\(--tt-ink-mix[^)]*\), black\)/.test(css));
  const hovers = new Function(grabFn(fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8'), 'idealText') + '\n' + (grabFn(fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8'), 'accentHovers') || '') + '\nreturn accentHovers;')();
  ok('no preset needs a hover of its own', PRESETS.every((h) => { const v = hovers(h); return v.light === '' && v.dark === ''; }));
  const HOVERED = ['#777777', '#7a7a7a', '#808080', '#0f62fe', '#00a080', '#ffff66', '#5a1d8c'];
  const offHover = HOVERED.filter((h) => { const a = hovers(h), b = accentHovers(h, '#1c1c1c', '#e6e6e6'); return a.light !== b.light || a.dark !== b.dark; });
  ok('a mid-tone gets the hover GlimStone computes, away from its ink', offHover.length === 0 && hovers('#777777').light !== '', offHover.join(', ') || JSON.stringify(hovers('#777777')));
  ok('every place that sets the accent also stamps its inks',
    ['header.js', 'docker.js', 'vms.js', 'settings.js'].every((f) => /paintAccentInks\(/.test(fs.readFileSync(path.join(DIR, f), 'utf8'))));
}

console.log('\nNo ink is picked by the old brightness threshold');
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /> 150 \? "#161616"/.test(l)).map(([i]) => i);
  ok(f, hits.length === 0, 'lines ' + hits.join(', '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
