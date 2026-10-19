// Every card title on the settings page is a filled section badge sitting on the card's top
// edge, and stacked cards keep a 40px rhythm. Every section badge in TowerTorch has
// GlimStone's one size, and a window's title is the same badge notched into the window's top edge. The badge follows the
// colour engine: the accent, or in rainbow mode its position within its own tab. A heading is not
// a control, so reactive mode never greys it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const sel = stack.pop(); if (sel !== undefined && !sel.startsWith('@')) out.push({ sel, body: buf.trim() }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const body = (all, sel) => (all.find((r) => r.sel === sel) || {}).body || '';
const decl = (b, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(b); return m ? m[1].trim() : null; };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const css = rules(read('styles/docker.css'));
const settings = read('scripts/settings.js');

console.log('\nThe title badge sits on the top edge');
{
  const h = body(css, '.cc-set-h');
  ok('it is placed absolutely at the top', decl(h, 'position') === 'absolute' && decl(h, 'top') === '0', h);
  ok('it centres on the edge by its own height', decl(h, 'transform') === 'translateY(-50%)');
  ok('it sets no horizontal offset, so it lands on the content edge', !/(?:^|;)\s*(left|right|inset[\w-]*)\s*:/.test(h));
  ok('it is filled from the colour chain', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(h, 'background') || ''));
  ok('its ink comes from the same chain', /^var\(--cc-rb-ct, var\(--cc-accent-text/.test(decl(h, 'color') || ''));
  ok('it is a pill from the shape engine', decl(h, 'border-radius') === 'var(--cc-radius-pill)');
  ok('the card is its positioning context', decl(body(css, '.cc-set-card'), 'position') === 'relative');
  ok('the info bubble takes the badge ink', decl(body(css, '.cc-set-h .cc-info'), 'color') === 'inherit');
  const greying = css.filter((r) => /cc-set-h\b/.test(r.sel) && /rbneutral|reactive/.test(r.sel));
  ok('no reactive rule greys a heading', greying.length === 0, greying.map((r) => r.sel).join(' | '));
}

console.log('\nOne 40px rhythm');
{
  ok('stacked cards are 40px apart', /^40px\b/.test(decl(body(css, '.cc-set-wrap'), 'gap') || ''), decl(body(css, '.cc-set-wrap'), 'gap'));
}

console.log('\nOne section badge size');
{
  const tokens = read('sheets/TowerTorch.Tokens.css');
  ok('22px high, 12px type, weight 500, 1.2px tracking, 0 12px padding', /--cc-sec-h: 22px;\s+--cc-sec-fs: var\(--cc-text-meta\);\s+--cc-sec-fw: 500;\s+--cc-sec-ls: 1\.2px;\s+--cc-sec-pad: 0 12px;/.test(tokens));
  ok('the old head tier is gone', !/--cc-head-(fs|pad)/.test(tokens) && !/--cc-head-(fs|pad)/.test(read('sheets/TowerTorch.VmTab.css')));
  const h = body(css, '.cc-set-h');
  ok('a card title reads the section badge tokens', /--cc-sec-h/.test(decl(h, 'min-height') || '') && decl(h, 'font-size') === 'var(--cc-sec-fs)' && /--cc-sec-fw/.test(decl(h, 'font-weight') || '') && /--cc-sec-ls/.test(decl(h, 'letter-spacing') || '') && /--cc-sec-pad/.test(decl(h, 'padding') || ''), h);
  const heads = {
    'the Apps page sections': ['sheets/TowerTorch.Tokens.css', 'html.cc-popups-on .ca_homeTemplatesHeader .cc-sechead-badge'],
    'the VM sections': ['sheets/TowerTorch.VmTab.css', 'html.cc-vms-on.cc-sections-vms #displaybox .cc-card-head'],
    'the Plugins sections': ['styles/docker.css', 'html.cc-on-plugins.cc-sections-plugins #displaybox .cc-card-head'],
    'the category titles on /Settings and /Tools': ['sheets/TowerTorch.SettingsGrid.css', 'html.cc-settingsgrid-heads-on #displaybox div.title > span.left'],
    'the page titles on Unraid\'s own pages': ['sheets/TowerTorch.Tools.css', 'html.cc-tools-on #displaybox div.title'],
  };
  for (const [what, [file, sel]] of Object.entries(heads)) {
    const b = body(rules(read(file)), sel);
    ok(what + ' take the same size', /var\(--cc-sec-fs\)/.test(decl(b, 'font-size') || '') && /--cc-sec-h/.test(decl(b, 'min-height') || ''), b.slice(0, 120));
  }
  const main = rules(read('sheets/TowerTorch.Shares.css')).find((r) => /\.cc-on-main\.cc-sections-main\) #displaybox \.cc-card-head$/.test(r.sel));
  ok('and so do the sections on Main', !!main && /var\(--cc-sec-fs\)/.test(decl(main.body, 'font-size') || ''));
  // Unraid's section head is span.left with a glyph and the title, spaced by its own gap-1, which
  // is 2.5px on Unraid's 10px root. Every section badge sets the 6px a card title has instead.
  const gaps = {
    'Main and Shares': ['sheets/TowerTorch.Shares.css', /cc-on-main\.cc-sections-main\) #displaybox \.cc-card-head > span\.left$/, /cc-on-main\.cc-sections-main\) #displaybox \.cc-card-head i$/],
    'the VM sections': ['sheets/TowerTorch.VmTab.css', /cc-sections-vms #displaybox \.cc-card-head > span\.left$/, /cc-sections-vms #displaybox \.cc-card-head i$/],
    'the Plugins sections': ['styles/docker.css', /cc-sections-plugins #displaybox \.cc-card-head > span\.left$/, /cc-sections-plugins #displaybox \.cc-card-head i$/],
  };
  for (const [what, [file, spanSel, iconSel]] of Object.entries(gaps)) {
    const rs = rules(read(file));
    const span = rs.find((r) => r.sel.split(',').some((s) => spanSel.test(s.trim())));
    const icon = rs.find((r) => r.sel.split(',').some((s) => iconSel.test(s.trim())));
    ok(what + ': the glyph stands 6px from the title', !!span && decl(span.body, 'display') === 'inline-flex' && decl(span.body, 'gap') === '6px' && !!icon && /^0\b/.test(decl(icon.body, 'margin') || '') && !/8px/.test(decl(icon.body, 'margin') || ''), span ? span.body : 'no rule');
  }
}

console.log('\nA window title is a notch on the window\'s top edge');
{
  const tk = rules(read('sheets/TowerTorch.Tokens.css'));
  const t = body(tk, '.cc-win-title');
  ok('it is placed on the top edge, centred on it by its own height', decl(t, 'position') === 'absolute' && decl(t, 'top') === '0' && decl(t, 'transform') === 'translateY(-50%)', t);
  ok('on the content\'s left edge, 24px in', decl(t, 'left') === '24px');
  ok('it is the section badge, not a full-width bar', decl(t, 'font-size') === 'var(--cc-sec-fs)' && decl(t, 'min-height') === 'var(--cc-sec-h)' && !/width:\s*100%/.test(t));
  ok('the window leaves room under it', /^21px\b/.test(decl(body(tk, '.cc-win'), 'padding') || ''), decl(body(tk, '.cc-win'), 'padding'));
}

console.log('\nRainbow positions count per tab');
{
  const make = () => {
    const st = {}; return { st, style: { setProperty: (k, v) => { st[k] = v; }, removeProperty: (k) => { delete st[k]; } } };
  };
  const wraps = [[make(), make(), make()], [make(), make()]];
  const root = { querySelectorAll: () => wraps.map((hs) => ({ querySelectorAll: () => hs })) };
  const run = (rainbow) => new Function('window', 'root', 'rainbow', 'accent', 'idealText',
    grabFn(settings, 'paintCardHeads') + '\npaintCardHeads();')(
    { CCTheme: { rbColor: (i) => ['#ff8389', '#ff832b', '#fcc419'][i] } }, root, rainbow, '#1d99f3', () => '#161616');
  run(true);
  ok('the first card of each tab takes the first position', wraps[0][0].st['--cc-rb-c'] === '#ff8389' && wraps[1][0].st['--cc-rb-c'] === '#ff8389');
  ok('the next cards follow in order', wraps[0][1].st['--cc-rb-c'] === '#ff832b' && wraps[0][2].st['--cc-rb-c'] === '#fcc419');
  ok('each badge gets its ink with its fill', wraps[0][2].st['--cc-rb-ct'] === '#161616');
  run(false);
  ok('without rainbow every stamp is cleared', wraps.flat().every((h) => !('--cc-rb-c' in h.st) && !('--cc-rb-ct' in h.st)));
  ok('render paints the headings with the other colour passes', /paintSelects\(\); paintCardHeads\(\);/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
