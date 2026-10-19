// Ink on a coloured fill is dark (#161616) or white, whichever has the higher contrast ratio.
// Every area keeps its own fallback copy of idealText() for when cc-theme.js has not loaded, so
// every copy is held to the ratio computed here, and no script may pick ink by the old Rec-601
// brightness threshold of 150 inline.
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

// The ink with the higher WCAG contrast ratio against the fill.
function contrastOn(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '#fff';
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (n) => 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const fill = L(n), dark = L(0x161616);
  return (fill + 0.05) / (dark + 0.05) > 1.05 / (fill + 0.05) ? '#161616' : '#fff';
}

console.log('\nThe reference itself');
ok('Sunflower takes dark ink', contrastOn('#FCC419') === '#161616');
ok('every palette pastel takes dark ink', ['#FF8389', '#FF832B', '#6FDC8C', '#3DDBD9', '#1D99F3', '#BE95FF', '#FF7EB6'].every((h) => contrastOn(h) === '#161616'));
ok('a deep blue takes white', contrastOn('#0f62fe') === '#fff');
ok('the light-theme error red takes white', contrastOn('#da1e28') === '#fff');

const SAMPLES = ['#FF8389', '#FF832B', '#FCC419', '#6FDC8C', '#3DDBD9', '#1D99F3', '#BE95FF', '#FF7EB6',
  '#198038', '#da1e28', '#f1c21b', '#0f62fe', '#eab308', '#22c55e', '#06b6d4', '#a855f7', '#f97316',
  '#ffffff', '#000000', '#808080', '#bdbdbd', '#4a4a4a', '#c0c0c0', '#ffd700', '#00ff00', '#ff0000',
  '#0000ff', '#ffff00', '#00ffff', '#ff00ff', 'nonsense', '', '#abc'];

console.log('\nEvery copy answers like contrastOn()');
const COPIES = [['cc-theme.js', 'idealText'], ['header.js', 'idealText'], ['docker.js', 'idealText'], ['favorites.js', 'idealText'],
  ['plugins.js', 'idealText'], ['settings.js', 'idealText'], ['settingsgrid.js', 'idealText'], ['shares.js', 'idealText'], ['vms.js', 'ccIdeal']];
for (const [file, name] of COPIES) {
  const src = grabFn(fs.readFileSync(path.join(DIR, file), 'utf8'), name);
  if (!src) { ok(file + ' has ' + name + '()', false); continue; }
  const fn = new Function(src + '\nreturn ' + name + ';')();
  const off = SAMPLES.filter((h) => fn(h) !== contrastOn(h)).map((h) => `${h}: ${fn(h)} vs ${contrastOn(h)}`);
  ok(file + ' ' + name + '()', off.length === 0, off.slice(0, 5).join(' | '));
}

console.log('\nNo ink is picked by the old brightness threshold');
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /> 150 \? "#161616"/.test(l)).map(([i]) => i);
  ok(f, hits.length === 0, 'lines ' + hits.join(', '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
