// OLED (GlimStone 4.2.0 and 4.3.0): a switch under Dark mode puts the dark look on true black.
// data-oled on <html> asks for it, the same attribute ShipLog reads, and it counts only while
// Unraid shows a dark theme. The choice belongs to the screen, so it stays on the device under a
// key the engine's mirror never pushes, and under a light theme the switch refuses with a reason.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = read('sheets/TowerTorch.Tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (/html\[data-oled\]:is\(\.Theme--black, \.Theme--gray\),\s*html\[data-oled\]:is\(\.Theme--black, \.Theme--gray\) :is\(([^)]*)\) \{([^}]*)\}/.exec(css) || []);
const decl = (name) => { const m = new RegExp(name.replace(/-/g, '\\-') + ':\\s*([^;]+);').exec(block[2] || ''); return m ? m[1].trim() : null; };

console.log('\nThe tokens');
ok('an OLED block keyed on data-oled and a dark Unraid theme', !!block[2]);
ok('the page base is black', decl('--tt-surface-base') === '#000000', decl('--tt-surface-base'));
ok('a card steps down to #161616', decl('--tt-surface-1') === '#161616', decl('--tt-surface-1'));
ok('a field steps down to #262626', decl('--tt-surface-3') === '#262626', decl('--tt-surface-3'));
const lum = (h) => parseInt(h.slice(1, 3), 16);
const order = ['--tt-surface-base', '--tt-surface-1', '--tt-surface-2', '--tt-surface-3'].map(decl);
ok('the surfaces keep their order', order.every(Boolean) && order.every((v, i) => !i || lum(v) > lum(order[i - 1])), order.join(' < '));
ok('TowerTorch\'s windows step down with the page', /\.tt-pop/.test(block[1] || '') && /\.tt-win/.test(block[1] || '') && /\.tt-menu/.test(block[1] || ''));
ok('the text, accent and switch track stay as they are', !/--tt-text|--tt-accent|--tt-toggle/.test(block[2] || ''));
ok('the page itself goes black under the theming gate', /html\.tt-popups-on\[data-oled\]:is\(\.Theme--black, \.Theme--gray\) body \{ background-color: #000000 !important; \}/.test(css));
ok('a light theme never reads it', !/data-oled[^{]*Theme--(white|azure)/.test(css));

console.log('\nThe attribute, from the first frame');
const page = read('TowerTorch.Header.page'), header = read('scripts/header.js');
ok('the boot script sets data-oled from the device key', /if \(g\("towertorch\.oled", "0"\) === "1" && theming\) r\.setAttribute\("data-oled", ""\); else r\.removeAttribute\("data-oled"\);/.test(page));
ok('header.js keeps it in step with the theming switch', /g\("towertorch\.oled", "0"\) === "1" && g\("tt\.theming", "1"\) !== "0"\) root\.setAttribute\("data-oled", ""\)/.test(header));
const mirror = /\/\^tt\[a-z\]\*\\\.\//.exec(read('scripts/tt-theme.js'));
ok('the mirror only pushes tt keys, so towertorch.oled stays on the device', !!mirror && !/^tt[a-z]*\./.test('towertorch.oled'));

console.log('\nThe switch');
const settings = read('scripts/settings.js');
ok('sits right under Dark mode', /cCard\.appendChild\(darkRow\);[\s\S]{0,400}var oledWhy = /.test(settings) && /cCard\.appendChild\(oledRow\);/.test(settings));
ok('stores the choice under towertorch.oled and sets the attribute at once', /set\("towertorch\.oled", v \? "1" : "0"\);\s*if \(v\) document\.documentElement\.setAttribute\("data-oled", ""\)/.test(settings));
ok('refuses under a light theme with aria-disabled and a reason', /if \(dark\) \{ tg\.removeAttribute\("aria-disabled"\);[^}]*\}\s*else \{ tg\.setAttribute\("aria-disabled", "true"\); tg\.setAttribute\("data-tip", oledWhy\);/.test(settings));
ok('follows the dark mode switch both ways', /syncOled\(\);\s*postDisplay\(\{ theme: to \}\)/.test(settings) && /swapTheme\(to, from\); back\(\); syncOled\(\);/.test(settings));
ok('a press on an aria-disabled control is refused by the shared handler', /t\.closest\("\[aria-disabled=true\]"\)/.test(settings));
ok('the reason stands under the row on a touch screen', /@media \(hover:none\)\{#tt-settings \.tt-set-refused \.tt-set-why\{display:block\}\}/.test(settings));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
