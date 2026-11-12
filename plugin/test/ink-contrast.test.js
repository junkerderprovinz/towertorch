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
function accentInks(hex) {
  const acc = rgb(hex), light = mix(acc, [0, 0, 0], 0.45);
  return {
    light: ratioOf(light, [255, 255, 255]) >= 4.5 ? '' : pushed(light, [0, 0, 0], [255, 255, 255]),
    dark: ratioOf(acc, [38, 38, 38]) >= 4.5 ? '' : pushed(acc, [255, 255, 255], [38, 38, 38]),
  };
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
  const fn = new Function(grabFn(fs.readFileSync(path.join(DIR, 'tt-theme.js'), 'utf8'), 'accentInks') + '\nreturn accentInks;')();
  const PRESETS = ['#FCC419', '#1D99F3', '#6FDC8C', '#FF8389', '#BE95FF', '#FF832B', '#3DDBD9', '#FF7EB6'];
  ok('no preset needs an ink of its own', PRESETS.every((h) => fn(h).light === '' && fn(h).dark === ''), PRESETS.filter((h) => fn(h).light || fn(h).dark).join(', '));
  const PICKED = ['#0f62fe', '#5a1d8c', '#2b2b2b', '#ffff66', '#e0e0e0', '#00ff00', '#8a5a00', '#a0522d'];
  const off = PICKED.filter((h) => { const a = fn(h), b = accentInks(h); return a.light !== b.light || a.dark !== b.dark; });
  ok('a picked colour gets the inks GlimStone computes', off.length === 0, off.join(', '));
  ok('a deep blue gets a lighter ink for the dark ramp', fn('#0f62fe').dark !== '' && ratioOf(rgb(fn('#0f62fe').dark), [38, 38, 38]) >= 4.5, fn('#0f62fe').dark);
  ok('a pale yellow gets a darker ink for the light ramp', fn('#ffff66').light !== '' && ratioOf(rgb(fn('#ffff66').light), [255, 255, 255]) >= 4.5, fn('#ffff66').light);
  const css = fs.readFileSync(path.join(DIR, '..', 'sheets', 'TowerTorch.Tokens.css'), 'utf8');
  ok('the dark ramp reads --tt-accent-ink-dark first', /--tt-accent-ink:\s+var\(--tt-accent-ink-dark, color-mix\(in srgb, var\(--tt-accent\) var\(--tt-ink-mix\), black\)\);/.test(css));
  ok('the light ramp reads --tt-accent-ink-light first', /--tt-ink-mix: 55%;\s*--tt-accent-ink: var\(--tt-accent-ink-light, /.test(css));
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
