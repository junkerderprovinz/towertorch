// A field's placeholder carries information, so it reads at 4.5:1 on every field fill. It takes
// GlimStone's --field-placeholder values: #c6c6c6 on a dark ramp, #525252 on a light one, and a
// step toward the text when the system asks for more contrast.
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const lum = (h) => { const n = parseInt(h.slice(1), 16); const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const tokens = read('sheets/TowerTorch.Tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (re) => (re.exec(tokens) || [])[1] || '';
const value = (b) => (/--tt-field-placeholder:\s*(#[0-9a-f]{6})/i.exec(b) || [])[1];
const dark = value(block(/(?:^|\})\s*html\s*\{([^}]*--tt-field-placeholder[^}]*)\}/));
const light = value(block(/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/));
const win = value(block(/\.tt-pop, \.tt-menu, \.tt-win,[^{]*\{([^}]*)\}/));

console.log('\nThe token');
ok('dark ramp #c6c6c6', dark === '#c6c6c6', dark);
ok('light ramp #525252', light === '#525252', light);
ok('TowerTorch\'s dark windows keep the dark value on a light page', win === '#c6c6c6', win);
ok('more contrast takes the next step', /@media \(prefers-contrast: more\) \{[^@]*html \{[^}]*--tt-field-placeholder: #e0e0e0;[^}]*\}\s*html\.Theme--white,\s*html\.Theme--azure \{[^}]*--tt-field-placeholder: #393939;/.test(tokens));
for (const [ramp, ink, fills] of [['dark', dark, ['#2e2e2e', '#383838', '#262626']], ['light', light, ['#ffffff', '#f4f4f4', '#ececec', '#e6e6e6']]]) {
  const low = fills.filter((f) => !ink || ratio(ink, f) < 4.5);
  ok(`${ramp}: 4.5:1 on every field fill`, low.length === 0, low.map((f) => `${f} ${ink ? ratio(ink, f).toFixed(2) : '?'}:1`).join(', '));
}

console.log('\nEvery placeholder reads it');
const SHEETS = ['sheets/TowerTorch.Header.css', 'sheets/TowerTorch.Pages.css', 'sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.Tokens.css',
  'sheets/TowerTorch.Tools.css', 'sheets/TowerTorch.VmTab.css', 'styles/docker.css', 'styles/login.css'];
for (const sheet of SHEETS) {
  const rules = parseRules(read(sheet)).filter((r) => /::placeholder/.test(r.selector) && r.decls.some((d) => d.prop === 'color'));
  const off = rules.filter((r) => !/^var\(--tt-field-placeholder, #c6c6c6\)$/.test(r.decls.find((d) => d.prop === 'color').value));
  ok(sheet, rules.length > 0 && off.length === 0, off.map((r) => r.selector + ' => ' + r.decls.find((d) => d.prop === 'color').value).join(' | '));
}
const login = read('styles/login.css');
ok('the login page carries the same two values', /html \{[^}]*--tt-field-placeholder: #c6c6c6;/.test(login) && /html\.Theme--azure \{[^}]*--tt-field-placeholder: #525252;/.test(login));
for (const f of ['#eceff3', '#e2e6ec']) ok(`login, light: 4.5:1 on ${f}`, ratio('#525252', f) >= 4.5, ratio('#525252', f).toFixed(2));
ok('the settings page\'s own sheet too', /"#tt-settings input::placeholder\{color:var\(--tt-field-placeholder,#c6c6c6\);opacity:1\}"/.test(read('scripts/settings.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
