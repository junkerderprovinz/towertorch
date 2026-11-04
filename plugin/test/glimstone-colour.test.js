// Pins TowerTorch's colour tokens to GlimStone: the accent presets, the
// default accent, the rainbow palette, the state colours with their light-theme
// variants, the accent ink for text on the page, and the scrim behind a window.
//
// The values are GlimStone's (docs/design-language.md, "The palette" and "Tokens").
// What the user saved is theirs: a stored tt.accent or tt.rbpal is read back as it
// was, and only what a user who never chose sees changes.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const SCRIPTS = path.join(DIR, 'scripts');
const TOKENS = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Tokens.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const GS_RAINBOW = ['#FF8389', '#FF832B', '#FCC419', '#6FDC8C', '#3DDBD9', '#1D99F3', '#BE95FF', '#FF7EB6'];
const GS_PRESETS = ['#FCC419', '#1D99F3', '#6FDC8C', '#FF8389', '#BE95FF', '#FF832B', '#3DDBD9', '#FF7EB6'];

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
// The declarations of the plain html { } blocks (the dark defaults) and of the light override.
function darkBlock(css) { let out = ''; const re = /(^|\})\s*html\s*\{([^}]*)\}/g; let m; while ((m = re.exec(clean(css)))) out += m[2]; return out; }
function lightBlock(css) { return (/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(clean(css)) || [])[1] || ''; }
function decl(block, name) { const m = new RegExp(name.replace(/-/g, '\\-') + ':\\s*([^;]+);').exec(block); return m ? m[1].trim() : null; }

const dark = darkBlock(TOKENS), light = lightBlock(TOKENS);

console.log('\nThe default accent is Sunflower with its computed ink');
ok('--tt-accent defaults to #FCC419', /^#FCC419$/i.test(decl(dark, '--tt-accent') || ''), decl(dark, '--tt-accent'));
ok('--tt-accent-text defaults to the dark ink', decl(dark, '--tt-accent-text') === '#161616', decl(dark, '--tt-accent-text'));
// The login page is served without Tokens.css, so its sheet declares the accent itself.
ok('no other sheet redeclares the accent on :root', files(DIR, ['.css']).every((f) => f.endsWith('Tokens.css') || f.endsWith('login.css') || !/--tt-accent:\s*#/.test(clean(fs.readFileSync(f, 'utf8')))));
{
  const left = files(DIR, ['.css', '.js', '.page', '.php']).filter((f) => /#2f6feb/i.test(fs.readFileSync(f, 'utf8'))).map((f) => path.basename(f));
  ok('the old default blue is gone as a fallback everywhere', left.length === 0, left.join(', '));
}

console.log('\nThe accent as ink: derived from the accent, darker on a light ground');
ok('--tt-accent-ink mixes the accent toward black by --tt-ink-mix', /^color-mix\(in srgb, var\(--tt-accent\) var\(--tt-ink-mix\), black\)$/.test(decl(dark, '--tt-accent-ink') || ''), decl(dark, '--tt-accent-ink'));
ok('the dark themes do not darken it', decl(dark, '--tt-ink-mix') === '100%');
ok('the light themes mix it 55%', decl(light, '--tt-ink-mix') === '55%', decl(light, '--tt-ink-mix'));
ok('the light override does not redeclare the ink itself, so it keeps following the accent', decl(light, '--tt-accent-ink') == null);
{
  const fav = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Favorites.css'), 'utf8');
  const tools = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Tools.css'), 'utf8');
  const docker = fs.readFileSync(path.join(DIR, 'styles', 'docker.css'), 'utf8');
  ok('the empty-favourites line is accent text, so it reads the ink', /#nofavs \{ color: var\(--tt-accent-ink,/.test(fav));
  ok('links on the Tools pages read the ink', /#displaybox a:not\(\.button\) \{ color: var\(--tt-accent-ink,/.test(tools));
  ok('the Tools (i) hover reads the ink', /\.tt-toolsinfo:hover \{ color: var\(--tt-accent-ink,/.test(tools));
  ok('the Docker gear reads the ink', /\.tt-hgear:hover \{ color: var\(--tt-accent-ink,/.test(docker) && /\.tt-hgear-bar \{[^}]*color: var\(--tt-accent-ink,/.test(docker));
}

console.log('\nRainbow colours glyphs, never text');
{
  const stat = /#alternateView td\.ca_stat \{([^}]*)\}/.exec(clean(TOKENS));
  const link = /#alternateView a \{([^}]*)\}/.exec(clean(TOKENS));
  const glyph = /#alternateView i\.fa \{([^}]*)\}/.exec(clean(TOKENS));
  ok('the changelog figures keep the single accent', !!stat && /color: var\(--tt-accent,/.test(stat[1]) && !/--tt-rb-c/.test(stat[1]), stat && stat[1]);
  ok('the changelog links keep the single accent', !!link && /color: var\(--tt-accent,/.test(link[1]) && !/--tt-rb-c/.test(link[1]), link && link[1]);
  ok('the changelog glyphs take the position hue', !!glyph && /color: var\(--tt-rb-c,/.test(glyph[1]), glyph && glyph[1]);
  const ddText = /\.dropdown-menu li > a \.ca_green \{([^}]*)\}/.exec(clean(TOKENS));
  const ddIcon = /\.dropdown-menu li > a i\.ca_fa-checkmark \{([^}]*)\}/.exec(clean(TOKENS));
  ok('the page-size menu\'s active label is single-accent ink', !!ddText && /var\(--tt-accent-ink,/.test(ddText[1]) && !/--tt-rb-c/.test(ddText[1]));
  ok('and its tick is the position hue as ink', !!ddIcon && /color-mix\(in srgb, var\(--tt-rb-c,[^;]*var\(--tt-ink-mix/.test(ddIcon[1]));
}

console.log('\nThe state colours are GlimStone\'s, with light-theme variants');
const STATES = {
  ok:   { dark: ['#6fdc8c', '#161616', '#6fdc8c'], light: ['#198038', '#fff', '#0e6027'] },
  warn: { dark: ['#ff832b', '#161616', '#ff832b'], light: ['#ba4e00', '#fff', '#ba4e00'] },
  err:  { dark: ['#ff8389', '#161616', '#ff8389'], light: ['#da1e28', '#fff', '#da1e28'] },
};
for (const [s, v] of Object.entries(STATES)) {
  for (const [theme, block] of [['dark', dark], ['light', light]]) {
    const [fill, fg, ink] = v[theme];
    ok(`--tt-${s} on ${theme} is ${fill}`, (decl(block, '--tt-' + s) || '').toLowerCase() === fill, decl(block, '--tt-' + s));
    ok(`--tt-${s}-fg on ${theme} is ${fg}`, (decl(block, '--tt-' + s + '-fg') || '').toLowerCase() === fg, decl(block, '--tt-' + s + '-fg'));
    ok(`--tt-${s}-ink on ${theme} is ${ink}`, (decl(block, '--tt-' + s + '-ink') || '').toLowerCase() === ink, decl(block, '--tt-' + s + '-ink'));
  }
}
{
  // a state fill with a literal ink beside it is the bug the -fg tokens exist for: white on #6fdc8c
  const off = [];
  for (const f of files(DIR, ['.css'])) {
    const re = /([^{}]+)\{([^}]*)\}/g; let m; const css = clean(fs.readFileSync(f, 'utf8'));
    while ((m = re.exec(css))) {
      const st = /background(?:-color)?:\s*var\(--tt-(ok|warn|err),/.exec(m[2]);
      if (st && /(^|[;\s])color:\s*#/.test(m[2])) off.push(path.basename(f) + ': ' + m[1].trim().slice(0, 70));
    }
  }
  ok('every state fill takes its -fg ink, never a literal', off.length === 0, off.join(' | '));
}
{
  const left = [];
  for (const f of files(SCRIPTS, ['.js'])) {
    const src = fs.readFileSync(f, 'utf8');
    for (const hex of ['#1f9d55', '#e0912a', '#d9433f', '#3fae6a', '#d6a243']) if (src.toLowerCase().includes(hex)) left.push(path.basename(f) + ' ' + hex);
  }
  ok('no script paints an old state hex inline', left.length === 0, left.join(', '));
}

console.log('\nThe scrim behind a window');
ok('dark: black at .72', decl(dark, '--tt-backdrop-dim') === 'rgba(0, 0, 0, .72)', decl(dark, '--tt-backdrop-dim'));
ok('light: black at .62', decl(light, '--tt-backdrop-dim') === 'rgba(0, 0, 0, .62)', decl(light, '--tt-backdrop-dim'));
ok('a 6px blur', decl(dark, '--tt-backdrop-blur') === 'blur(6px)', decl(dark, '--tt-backdrop-blur'));

console.log('\nThe rainbow palette is GlimStone\'s Carbon 30 set, in every copy');
{
  const store = {};
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  global.document = { documentElement: { classList: { contains: () => false } }, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }), querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout };
  global.location = { pathname: '/Docker' };
  global.navigator = { language: 'en' };
  global.fetch = () => new Promise(() => {});
  require(path.join(SCRIPTS, 'tt-theme.js'));
  const T = global.window.TTTheme;
  ok('TTTheme.RB is the GlimStone palette in order', JSON.stringify(T.RB) === JSON.stringify(GS_RAINBOW), JSON.stringify(T.RB));

  // Every area keeps a local copy for a missed load order, and it has to be the same set.
  const stale = [];
  for (const f of files(SCRIPTS, ['.js'])) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /\[("#[0-9A-Fa-f]{6}"(?:,\s*"#[0-9A-Fa-f]{6}"){7})\]/g; let m;
    while ((m = re.exec(src))) {
      const pal = JSON.parse('[' + m[1] + ']');
      const isPresets = /PRESETS = $/.test(src.slice(Math.max(0, m.index - 10), m.index));
      if (!isPresets && JSON.stringify(pal) !== JSON.stringify(GS_RAINBOW)) stale.push(path.basename(f) + ' ' + m[1].slice(0, 40));
    }
  }
  ok('every local fallback palette is the same set', stale.length === 0, stale.join(' | '));

  console.log('\nA user\'s saved colours are read back as they were');
  store['tt.rainbow'] = '1'; store['tt.rainbowrot'] = '0';
  ok('with nothing saved the palette is the new default', T.rbColor(0, '#FCC419') === '#FF8389' && T.rbColor(5, '#FCC419') === '#1D99F3');
  const OLD = ['#d9433f', '#f97316', '#eab308', '#1f9d55', '#0ea5a4', '#2f6feb', '#8b5cf6', '#e05299'];
  store['tt.rbpal'] = JSON.stringify(OLD);
  ok('a palette saved from the old defaults keeps every colour', OLD.every((c, i) => T.rbColor(i, '#2f6feb') === c));
  store['tt.rainbow'] = '0';
  ok('an accent picked from the old presets comes back unchanged', T.rbColor(3, '#2f6feb') === '#2f6feb');
  ok('tt-theme.js writes neither key while it loads', !('tt.accent' in store) && store['tt.rbpal'] === JSON.stringify(OLD));
}

console.log('\nThe accent presets are the GlimStone eight, all of them offered');
{
  const settings = fs.readFileSync(path.join(SCRIPTS, 'settings.js'), 'utf8');
  const m = /var PRESETS = (\[[^\]]*\]);/.exec(fs.readFileSync(path.join(SCRIPTS, 'tt-theme.js'), 'utf8'));
  ok('PRESETS is declared once, in tt-theme.js beside the picker', !!m && /var PRESETS = window\.TTTheme\.PRESETS/.test(settings));
  ok('in GlimStone\'s order', !!m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(GS_PRESETS), m && m[1]);
  ok('no picker cuts the row short', !/PRESETS\.slice\(/.test(settings));
  ok('the column matrix takes palette positions rather than a list of its own', /window\.TTTheme\.rbColor\(i, accent\)/.test(settings) && !/var RB = \["#1f9d55"/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
