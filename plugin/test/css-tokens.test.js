// A custom property that names itself in its own value, such as --cc-ok: var(--cc-ok, #1f9d55),
// is a dependency cycle. The browser treats it as invalid, every consumer silently falls back to
// its own literal, and the token stops meaning anything. This pins that no sheet declares one,
// and that the call sites of the semantic tokens carry the token's own colour as their fallback,
// so a page without the token sheet looks the same.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'src');
const TOKENS = path.join(ROOT, 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'sheets', 'TowerTorch.Tokens.css');

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
function selfRefs(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  const re = /(--[\w-]+)\s*:\s*([^;{}]*)/g;
  let m;
  while ((m = re.exec(clean))) {
    const name = m[1].replace(/[-]/g, '\\-');
    if (new RegExp('var\\(\\s*' + name + '\\s*[,)]').test(m[2])) found.push(m[1] + ': ' + m[2].trim());
  }
  return found;
}

console.log('\nThe detector itself catches a self-reference and passes a plain value');
ok('a self-referencing declaration is found', selfRefs('html { --a: var(--a, red); }').length === 1);
ok('a reference to a longer name is not one', selfRefs('html { --a: var(--a-b, red); }').length === 0);
ok('a plain value is not one', selfRefs('html { --a: #fff; --b: var(--a); }').length === 0);

const sheets = files(ROOT, ['.css']);
console.log('\nNo sheet declares a custom property in terms of itself (' + sheets.length + ' sheets)');
for (const f of sheets) {
  const hits = selfRefs(fs.readFileSync(f, 'utf8'));
  ok(path.basename(f), hits.length === 0, hits.join(' | '));
}

console.log('\nEvery call site falls back to the colour its token holds');
{
  const tokens = fs.readFileSync(TOKENS, 'utf8');
  const sources = files(ROOT, ['.css', '.js', '.php', '.page']).map((f) => [f, fs.readFileSync(f, 'utf8')]);
  for (const name of ['--cc-ok', '--cc-warn', '--cc-err', '--cc-info']) {
    const m = new RegExp(name + ':\\s*(#[0-9a-fA-F]{6})\\s*;').exec(tokens);
    ok(name + ' is a plain colour in the token sheet', !!m);
    if (!m) continue;
    const want = m[1].toLowerCase(), off = [];
    for (const [f, src] of sources) {
      const re = new RegExp('var\\(\\s*' + name + '\\s*,\\s*(#[0-9a-fA-F]{3,6})', 'g');
      let c;
      while ((c = re.exec(src))) if (c[1].toLowerCase() !== want) off.push(path.basename(f) + ' ' + c[1]);
    }
    ok(name + ' call sites fall back to ' + want, off.length === 0, off.join(', '));
  }
}

// Header.css declares --cc-surface-card dark on :root. The Apps info card, the notification
// items and the Unraid API cards paint it behind text in --cc-text, which the light override
// turns dark, so the card has to turn light with it or the text sits dark on dark.
console.log('\nThe card surface follows the light themes like the text on it');
{
  const tokens = fs.readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const header = fs.readFileSync(path.join(path.dirname(TOKENS), 'TowerTorch.Header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = (/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(tokens) || [])[1] || '';
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); };
  ok('the light override block is found', light.length > 0);
  ok('Header.css declares the card dark on :root', /:root\s*\{[^}]*--cc-surface-card:\s*#1[0-9a-f]{5}/i.test(header));
  ok('the light override turns --cc-text dark', /--cc-text:\s*#[0-3][0-9a-f]{5}/i.test(light));
  const card = /--cc-surface-card:\s*(#[0-9a-f]{6})/i.exec(light);
  ok('the light override declares --cc-surface-card', !!card);
  ok('and it is a light surface', !!card && lum(card[1]) > 200, card && card[1]);
  ok('the info card reads the token', /#sidenavContent \.cc-ic-card\s*\{[^}]*background:\s*var\(--cc-surface-card/.test(tokens));
}

// Unraid paints its header bar with --header-background-color, which the white theme keeps dark
// and azure makes light, so chips on the bar read Unraid's paired --header-text-color there
// rather than a page ink that flips with the theme.
console.log('\nChips on the header bar take the header ink, not the page ink');
{
  const tokens = fs.readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const header = fs.readFileSync(path.join(path.dirname(TOKENS), 'TowerTorch.Header.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // the dark defaults are spread over every plain html { } block
  let dark = ''; const blocks = /(^|\})\s*html\s*\{([^}]*)\}/g; let b;
  while ((b = blocks.exec(tokens))) dark += b[2];
  const light = (/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(tokens) || [])[1] || '';
  const chipDark = (/--cc-text-chip:\s*(#[0-9a-f]{6})/i.exec(dark) || [])[1];
  const inkDark = (/--cc-header-ink:\s*(#[0-9a-f]{6})/i.exec(dark) || [])[1];
  ok('the dark chip ink is found', !!chipDark);
  ok('the dark header ink is the dark chip ink, so the dark themes look the same', !!inkDark && inkDark === chipDark, inkDark + ' vs ' + chipDark);
  ok('the light header ink is Unraid\'s header text colour', /--cc-header-ink:\s*var\(--header-text-color\b/.test(light));
  const rules = [];
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(header))) if (/#menu|\[data-cc-trig\]|unraid-header-os-version/.test(m[1]) && /(^|;)\s*color:/.test(m[2])) rules.push([m[1].trim(), m[2]]);
  ok('the header bar rules with a text colour are found', rules.length >= 5, String(rules.length));
  const flip = rules.filter(([, b]) => /color:\s*var\(--cc-text(-chip|-dim)?\b/.test(b)).map(([s]) => s.slice(0, 80));
  ok('none of them reads a page ink that flips with the theme', flip.length === 0, flip.join(' | '));
  ok('the menu tabs read --cc-header-ink', rules.some(([s, b]) => /\.nav-item:not\(\.util\):not\(\.gui_search\) > a$/.test(s) && /var\(--cc-header-ink/.test(b)));
}

// Tools.css paints fieldsets and the Unraid API cards with --cc-tl-surface and leaves their text
// to the page, so the surface needs a light value on the light themes.
console.log('\nThe Tools card surface turns light with the page text');
{
  const tools = fs.readFileSync(path.join(path.dirname(TOKENS), 'TowerTorch.Tools.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = (/html\.cc-tools-on\.Theme--white,\s*html\.cc-tools-on\.Theme--azure\s*\{([^}]*)\}/.exec(tools) || [])[1] || '';
  ok('the light block for the Tools pages is found', light.length > 0);
  ok('it gives --cc-tl-surface a light value', /--cc-tl-surface:\s*var\(--cc-surface-1\b/.test(light), light);
  ok('it leaves the dark control fill --cc-tl-surface2 alone', !/--cc-tl-surface2/.test(light));
}

// The Docker action bar is Unraid's footer colour and the CC settings hero sits on Unraid's page,
// both of which follow the theme, so their text cannot be a dark-theme literal.
console.log('\nText on Unraid\'s own surfaces follows the theme');
{
  const docker = fs.readFileSync(path.join(path.dirname(TOKENS), '..', 'styles', 'docker.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const lbl = (/div\.js-actions \.cc-bar-adv-lbl\s*\{([^}]*)\}/.exec(docker) || [])[1] || '';
  ok('the action bar label reads --cc-text-chip', /color:\s*var\(--cc-text-chip,\s*#cfcfcf\)/.test(lbl), lbl);
  const bar = []; const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(docker))) if (/div\.js-actions/.test(m[1]) && /(^|;)\s*color:\s*#[c-f]/i.test(m[2])) bar.push(m[1].trim().slice(0, 90));
  ok('no action bar rule hard-codes a light ink', bar.length === 0, bar.join(' | '));
}

console.log('\nEvery comment closes before the next one opens');
{
  // A comment that loses its closing slash runs on to the next comment's end and takes every rule
  // in between with it, without a parse error anywhere.
  for (const f of sheets) {
    const css = fs.readFileSync(f, 'utf8');
    const open = [];
    const re = /\/\*[\s\S]*?\*\//g; let m;
    while ((m = re.exec(css))) if (m[0].slice(2).includes('/*')) open.push(css.slice(0, m.index).split('\n').length);
    ok(path.basename(f) + ': no comment swallows the next', open.length === 0, 'unclosed near line ' + open.join(', '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
