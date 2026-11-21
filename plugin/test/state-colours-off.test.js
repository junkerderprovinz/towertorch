// With tt.statemono on, every state colour takes the accent: TowerTorch's own badges, dots, bars
// and chips, and the chips of other plugins that read the same tokens, so nothing on a
// page stands out in green, orange or red. The tokens are resolved the way a browser does, on
// <html> and inside the dark windows that declare their own state colours.
const fs = require('fs');
const path = require('path');
const { DIR, tokens, resolve, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const STATES = ['--tt-ok', '--tt-ok-fg', '--tt-ok-ink', '--tt-warn', '--tt-warn-fg', '--tt-warn-ink', '--tt-err', '--tt-err-fg', '--tt-err-ink'];
const ACCENT = { '': '--tt-accent', '-fg': '--tt-accent-text', '-ink': '--tt-accent-ink' };

const rules = parseRules(read('sheets/TowerTorch.Tokens.css'));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const monoRule = rules.find((r) => norm(r.selector).startsWith('html.tt-state-mono,'));
const windowRule = rules.find((r) => norm(r.selector).startsWith('.tt-pop, .tt-menu, .tt-win, .tt-rowmenu'));
const decls = (r) => { const o = {}; if (r) for (const d of r.decls) if (d.prop.startsWith('--')) o[d.prop] = d.value; return o; };
const mono = decls(monoRule), win = decls(windowRule);

console.log('\nThe override');
ok('Tokens.css has a rule for html.tt-state-mono', !!monoRule);
for (const k of STATES) ok(`${k} is set by it`, k in mono);

function check(label, scope) {
  for (const k of STATES) {
    const kind = k.replace(/^--tt-(ok|warn|err)/, '');
    const want = resolve(`var(${ACCENT[kind]})`, scope), got = resolve(scope[k], scope);
    ok(`${label}: ${k} reads as ${ACCENT[kind]}`, got === want, `${got} against ${want}`);
  }
  const hover = resolve(scope['--tt-err-hover'], scope);
  ok(`${label}: the hover mixes from the accent`, hover.includes(resolve('var(--tt-accent)', scope)) && !/#ff8389|#da1e28/i.test(hover), hover);
}

for (const light of [false, true]) {
  const theme = light ? 'light theme' : 'dark theme';
  const html = Object.assign({}, tokens(light), { '--tt-accent': '#1D99F3', '--tt-accent-text': '#161616' }, mono);
  check(`page, ${theme}`, html);
  // A window declares its own state colours, so the override has to win on the window itself.
  const covers = ['.tt-pop', '.tt-menu', '.tt-win', '.tt-rowmenu', '.tt-cpop', '.tt-bulkbar', '.tt-av-win', '.alternateViewContent'];
  ok(`the override reaches every dark window (${theme})`, covers.every((c) => monoRule && monoRule.selector.includes(c)));
  check(`window, ${theme}`, Object.assign({}, html, win, mono));
}

console.log('\nThe rule comes after the windows, so a tie goes to it');
ok('mono rule follows the window rule', rules.indexOf(monoRule) > rules.indexOf(windowRule));

console.log('\nThe switch');
const header = read('scripts/header.js'), settings = read('scripts/settings.js');
ok('header.js sets tt-state-mono from tt.statemono while theming is on',
  /root\.classList\.toggle\("tt-state-mono", g\("tt\.statemono", "0"\) === "1" && g\("tt\.theming", "1"\) !== "0"\)/.test(header));
ok('the settings carry a toggle for tt.statemono', /get\("tt\.statemono", "0"\) === "1"/.test(settings) && /set\("tt\.statemono", v \? "1" : "0"\)/.test(settings));
ok('the native-colour row is shut while the colours are off', /setRowEnabled\(snR, !monoOn\)|setRowEnabled\(snR, get\("tt\.statemono", "0"\) !== "1"\)/.test(settings));

console.log('\nNo state colour bypasses the tokens');
const maint = read('styles/maintenance.css');
ok('the maintenance dots and badges read the state tokens', !/background:\s*#(6fdc8c|ff832b|ff8389)/i.test(maint), (maint.match(/background:\s*#(6fdc8c|ff832b|ff8389)/gi) || []).join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
