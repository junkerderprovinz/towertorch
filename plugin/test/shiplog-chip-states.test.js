// CC hides the dot on ShipLog's changelog chip and paints the chip itself, keyed on the dot's
// class. A state without its own rule falls to the grey of an up-to-date chip, so each coloured
// state needs a rule in the plain modes and one for the row hover of the reactive mode.
//
// A string-level check, with the helpers from settings-chrome.test.js.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const css = fs.readFileSync(path.join(DIR, 'styles', 'docker.css'), 'utf8');
const tokens = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Tokens.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}

const ROW = '.cc-enh #docker_list tr:is(.sortable, .folder-element) td.updatecolumn .sl-chip';
const HOVER = 'html.cc-shares-rbneutral.cc-docker-on .cc-enh #docker_list tr:is(.sortable, .folder-element):hover td.updatecolumn .sl-chip';
const STATES = { low: '--cc-ok', mid: '--cc-warn', high: '--cc-err', crit: '--cc-err', info: '--cc-info' };

console.log('\nEvery coloured ShipLog chip state has a colour at rest and on the reactive row hover');
for (const [cls, token] of Object.entries(STATES)) {
  const base = ruleBody(css, `${ROW}:has(.sl-${cls})`);
  const hover = ruleBody(css, `${HOVER}:has(.sl-${cls})`);
  ok(`sl-${cls}: the plain-mode rule reads var(${token}`, (base || '').includes(`var(${token},`), base);
  ok(`sl-${cls}: the reactive hover rule reads var(${token}`, (hover || '').includes(`var(${token},`), hover);
}

// The grey chip's white ink is !important, so a state rule that sets only its fill keeps
// that white on a pastel green or pink. Resolved across every sheet the Docker page loads,
// in both theme families, each state has to read at 4.5:1.
console.log('\nEvery chip state reads, with the cascade resolved and the tokens filled in');
{
  const { candidates, tokens, resolve } = require('./cascade');
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const six = (h) => (/^#[0-9a-f]{3}$/i.test(h) ? '#' + h.slice(1).split('').map((c) => c + c).join('') : h);
  const MODES = { plain: { html: ['cc-docker-on'], hover: false }, 'reactive row hover': { html: ['cc-docker-on', 'cc-shares-rbneutral'], hover: true } };
  for (const [theme, light] of [['dark', false], ['light', true]]) {
    const map = tokens(light);
    for (const [mode, m] of Object.entries(MODES)) for (const cls of Object.keys(STATES)) {
      const el = { tag: 'span', classes: ['sl-chip'], attrs: { class: 'sl-chip' }, states: { hover: m.hover }, html: m.html.concat(light ? ['Theme--white'] : []), has: ['.sl-' + cls] };
      const win = (prop) => { const c = candidates('docker', el, prop); return c[c.length - 1]; };
      const bg = win('background'), fg = win('color');
      const b = bg && six(resolve(bg.value, map)), f = fg && six(resolve(fg.value, map));
      const r = b && f && /^#[0-9a-f]{6}$/i.test(b) && /^#[0-9a-f]{6}$/i.test(f) ? ratio(b, f) : 0;
      ok(`${theme}, ${mode}: sl-${cls} reads at 4.5:1`, r >= 4.5, `${f} on ${b} = ${r.toFixed(2)}:1 (${fg && fg.selector.slice(-40)})`);
    }
  }
}

console.log('\nThe up-to-date chip stays the neutral grey the pinned one is told apart from');
{
  ok('sl-ok has no colour rule of its own', ruleBody(css, `${ROW}:has(.sl-ok)`) == null);
  ok('the plain chip rests on #4a4a4a', /background:\s*#4a4a4a/.test(ruleBody(css, ROW) || ''));
}

console.log('\n--cc-info resolves to a colour on <html>');
{
  const m = /--cc-info:\s*([^;]+);/.exec(tokens);
  ok('--cc-info is declared', !!m);
  ok('--cc-info is a literal, not a var() that could refer to itself', !!m && /^#[0-9a-fA-F]{6}$/.test(m[1].trim()), m && m[1]);
  ok('--cc-info-fg is the dark ink the blue takes', /--cc-info-fg:\s*#161616;/.test(tokens));
}

// enhanceShipLogBubble() stamps --cc-rb-c on all three window buttons in the reactive mode and
// leaves the paint to this rule, so a button missing from it stays grey under the pointer.
console.log('\nIn the reactive mode every button of the changelog window colours on hover');
{
  const HOVER_SEL = 'html.cc-shares-rbneutral .sl-bubble .sl-upd:not(.sl-upd-off):hover, html.cc-shares-rbneutral .sl-bubble .sl-gh:hover, html.cc-shares-rbneutral .sl-bubble .sl-x:hover';
  const body = ruleBody(css, HOVER_SEL);
  ok('one hover rule covers update, repository and close', body != null);
  ok('it paints the stamped --cc-rb-c', /background:\s*var\(--cc-rb-c,/.test(body || ''), body);
  ok('with the stamped ink', /color:\s*var\(--cc-rb-ct,/.test(body || ''), body);
  const js = fs.readFileSync(path.join(DIR, 'scripts', 'docker.js'), 'utf8');
  ok('docker.js stamps the close button and the auto-update switch too', /querySelectorAll\("\.sl-upd:not\(\.sl-upd-off\), \.sl-gh, \.sl-x, \.sl-au-track"\)/.test(js));
}

// Outside the reactive mode nothing stamps the close button while rainbow is off, so its hover
// falls through to the accent the repository button rests on.
console.log('\nThe close button hovers in the accent like the repository button rests');
{
  const body = ruleBody(css, '.sl-bubble .sl-x:hover');
  ok('a hover rule for the close button exists', body != null);
  ok('it reads the stamp, then the accent', /background:\s*var\(--cc-rb-c,\s*var\(--cc-accent,/.test(body || ''), body);
  ok('with the accent text', /color:\s*var\(--cc-rb-ct,\s*var\(--cc-accent-text,/.test(body || ''), body);
  ok('and outranks ShipLog\'s own neutral hover', /!important/.test(body || ''), body);
}

console.log('\nThe ShipLog window follows the shape engine');
{
  const { PAGES, candidates } = require('./cascade');
  // ShipLog's own radius rules, which read a --cc-b-radius CC never sets, loaded after CC's.
  const shiplog = { name: 'shiplog/styles/docker.css', css:
    '.sl-bubble{border-radius:min(var(--cc-b-radius,14px),14px)}' +
    'html.cc-header-on .sl-bubble .sl-sec{border-radius:min(var(--cc-b-radius,10px),10px)}' +
    'html.cc-header-on .sl-bubble .sl-aubar{border-radius:min(var(--cc-b-radius,10px),10px)}' +
    'html.cc-header-on .sl-bubble h4{border-radius:var(--cc-b-radius,999px)}' +
    'html.cc-header-on .sl-bubble .sl-unmaint-note h4{border-radius:var(--cc-b-radius,999px)}' +
    '.sl-bubble .sl-ai{border-radius:4px}' };
  const page = PAGES.docker.concat([shiplog]);
  const radius = (tag, classes, inside) => { const c = candidates(page, { tag, classes, attrs: { class: classes.join(' ') }, states: {}, html: ['cc-header-on', 'cc-docker-on'], inside }, 'border-radius'); return c.length ? c[c.length - 1].value : null; };
  ok('the window is a card', radius('div', ['sl-bubble'], []) === 'var(--cc-radius-card)');
  ok('its cards are controls', radius('div', ['sl-sec'], ['.sl-bubble']) === 'var(--cc-radius-control)' && radius('div', ['sl-aubar'], ['.sl-bubble']) === 'var(--cc-radius-control)' && radius('div', ['sl-unmaint-note'], ['.sl-bubble']) === 'var(--cc-radius-control)');
  ok('the section badges, "Neueste Releases" and the AI summary among them, are pills', radius('h4', [], ['.sl-bubble', '.sl-sec']) === 'var(--cc-radius-pill)' && radius('h4', [], ['.sl-bubble', '.sl-unmaint-note']) === 'var(--cc-radius-pill)', radius('h4', [], ['.sl-bubble', '.sl-sec']));
  ok('and so is the model tag inside the summary badge', radius('span', ['sl-ai'], ['.sl-bubble', 'h4']) === 'var(--cc-radius-pill)');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
