// Unraid's context menus (context.js, a ul.dropdown-menu.dropdown-context in <body>) look like CC's
// own row menu on every page: the disk menus on the Dashboard opened as a white list on the dark
// theme. Dark on every theme, an entry without a fill of its own that takes the mode colour under
// the pointer, and no pointer triangle drawn with borders.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const val = (e, prop, html) => { const c = candidates('every', Object.assign({ attrs: {}, states: {}, html: html || ['cc-popups-on', 'Theme--black'] }, e), prop); return c.length ? c[c.length - 1].value : null; };
const CHAIN = /^var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/;

const menu = { tag: 'ul', classes: ['dropdown-menu', 'dropdown-context', 'fa-ul'], id: 'dropdown-smart-disk4' };
ok('the menu is dark like the CC windows', val(menu, 'background') === '#1a1a1a');
ok('on a light theme as well', val(menu, 'background', ['cc-popups-on', 'Theme--white']) === '#1a1a1a');
ok('with no border', val(menu, 'border') === 'none');
ok('and the card radius', val(menu, 'border-radius') === 'var(--cc-radius-card)');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Header.css'), 'utf8');
ok('its pointer triangle is gone', css.includes('ul.dropdown-menu.dropdown-context::before,') && css.includes('ul.dropdown-menu.dropdown-context::after { display: none !important; }'));

const entry = { tag: 'a', classes: [], inside: ['.dropdown-context'] };
ok('an entry has no fill at rest', val(entry, 'background') === 'transparent');
ok('in light text', val(entry, 'color') === '#e6e6e6');
ok('and the colour chain under the pointer', CHAIN.test(val(Object.assign({}, entry, { states: { hover: true } }), 'background') || ''));
ok('and with the keyboard focus', CHAIN.test(val(Object.assign({}, entry, { states: { 'focus-visible': true } }), 'background') || ''));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
