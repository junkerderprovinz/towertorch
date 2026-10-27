// The login page takes its look from the cc.* settings the engine keeps for every browser, so a
// browser that clears its storage or never opened the interface still sees the chosen accent,
// shape and colour mode; the browser's own keys only fill what the engine does not have.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function run(server, stored) {
  const style = {}, attrs = {}, classes = new Set();
  const root = {
    style: { setProperty: (k, v) => { style[k] = v; } },
    setAttribute: (k, v) => { attrs[k] = v; },
    classList: { toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); } },
  };
  const window = { TT_LOGIN_UI: server };
  const localStorage = { getItem: (k) => (k in stored ? stored[k] : null) };
  const document = { documentElement: root, addEventListener() {}, getElementById: () => null };
  new Function('window', 'localStorage', 'document', read('scripts/login.js'))(window, localStorage, document);
  return { style, attrs, classes };
}

console.log('\nThe engine\'s settings win over an empty browser');
{
  const r = run({ 'cc.accent': '#fcef19', 'cc.badgeshape': 'soft', 'cc.rbmode': 'active' }, {});
  ok('the accent comes from the engine', r.style['--tt-accent'] === '#fcef19', r.style['--tt-accent']);
  ok('so does the shape', r.attrs['data-cc-shape'] === 'soft', r.attrs['data-cc-shape']);
  ok('the reactive mode rests the button grey', r.classes.has('tt-reactive'));
}

console.log('\nThe browser fills what the engine lacks');
{
  const r = run({}, { 'cc.accent': '#1d99f3', 'cc.badgeshape': 'square' });
  ok('a stored accent still applies', r.style['--tt-accent'] === '#1d99f3');
  ok('a stored shape still applies', r.attrs['data-cc-shape'] === 'square');
  ok('the active colour mode is the default', !r.classes.has('tt-reactive'));
}

console.log('\nThe page carries the engine\'s settings');
{
  const php = read('include/login-head.php');
  ok('login-head.php reads ui_settings from config.json', /config\.json/.test(php) && /\['ui_settings'\]/.test(php));
  ok('and writes them as TT_LOGIN_UI before the script', php.indexOf('TT_LOGIN_UI') > 0 && php.indexOf('TT_LOGIN_UI') < php.indexOf('scripts/login.js'));
  ok('only the look, no other setting', /cc\\\.\(theming\|accent\|badgeshape\|rbmode\|brand\\\.\[a-z\]\+\)/.test(php));
  const css = read('styles/login.css');
  ok('the sheet rests the reactive button on the field colour', /html\.tt-reactive body #login \.form button:not\(:hover\):not\(:focus-visible\) \{ background: var\(--tt-field\); color: var\(--tt-text\); \}/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
