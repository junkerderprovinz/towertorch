// The two windows behind Unraid's header buttons, the notification drawer behind the bell and the
// account menu behind the burger, wear GlimStone like every CC window: a 22px section badge for
// the title, the square close badge in the corner, the focus halo in place of Tailwind's ring, the
// colour chain on the highlighted menu entry and a neutral (i).
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const win = (e, prop) => { const c = candidates('every', Object.assign({ attrs: {}, states: {}, html: ['cc-popups-on', 'cc-header-on'] }, e), prop); return c.length ? c[c.length - 1] : null; };
const val = (e, prop) => { const w = win(e, prop); return w ? w.value : null; };
const SHEET = ['.unapi', '.fixed.z-50.bg-background'];
const CHAIN = /^var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-(hdr-)?accent/;

console.log('\nThe notification drawer');
{
  const h2 = { tag: 'h2', classes: [], inside: SHEET, outside: ['.shrink-0'] };
  ok('its title is a section badge of the one 22px height', val(h2, 'min-height') === 'var(--cc-sec-h)' && val(h2, 'padding') === 'var(--cc-sec-pad)');
  ok('in the section badge type', val(h2, 'font-size') === 'var(--cc-sec-fs)' && val(h2, 'font-weight') === 'var(--cc-sec-fw)' && val(h2, 'letter-spacing') === 'var(--cc-sec-ls)');
  const x = { tag: 'span', classes: ['cc-notif-x', 'inline-flex', 'justify-center'], attrs: { role: 'button', class: 'cc-notif-x inline-flex items-center justify-center', id: '' }, inside: SHEET, outside: ['.shrink-0'] };
  ok('its close control is the square icon badge of every CC window', val(x, 'width') === 'var(--cc-icon-badge, 26px)' && val(x, 'height') === 'var(--cc-icon-badge, 26px)' && val(x, 'border-radius') === 'var(--cc-radius-pill)' && val(x, 'min-height') === '0', val(x, 'min-height'));
  ok('on the chip grey at rest', /--cc-surface-chip/.test(val(x, 'background')));
  ok('and in the colour chain under the pointer', CHAIN.test(val(Object.assign({}, x, { states: { hover: true } }), 'background') || ''));
  const header = read('scripts/header.js');
  ok('header.js marks it and names it in a bubble, in both languages', /x\.classList\.add\("cc-notif-x"\)/.test(header) && /x\.setAttribute\("data-cc-tip", T\("Schließen", "Close"\)\)/.test(header));
  ok('also in the empty drawer, before the bulk actions bail out', header.indexOf('x.classList.add("cc-notif-x")') < header.indexOf('if (host.querySelector(".cc-notif-badge")) return;'));
  const tab = { tag: 'span', classes: [], attrs: { role: 'tab' }, inside: SHEET, outside: ['.shrink-0'], states: { 'focus-visible': true, focus: true } };
  ok('keyboard focus shows the halo', /^0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)$/.test(val(tab, 'box-shadow') || ''), val(tab, 'box-shadow'));
  const panel = { tag: 'div', classes: [], attrs: { role: 'tabpanel', tabindex: '0' }, inside: SHEET, outside: ['.shrink-0'], states: { 'focus-visible': true, focus: true } };
  ok('the focusable list panel draws no ring at all', val(panel, 'box-shadow') === 'none');
  const drawer = { tag: 'div', classes: ['fixed', 'z-50', 'bg-background'], inside: ['.unapi'] };
  ok('a long list runs down to the 16px margin above the viewport\'s bottom edge', /^74px 16px /.test(val(drawer, 'inset') || '') && val(drawer, 'max-height') === 'calc(100vh - 90px)', val(drawer, 'max-height'));
}

console.log('\nThe account menu');
{
  ok('a dark frame like the CC windows', val({ tag: 'div', classes: ['bg-popover'] }, 'background') === '#1a1a1a');
  const item = { tag: 'span', classes: [], attrs: { 'data-highlighted': '' }, inside: ['.bg-popover'] };
  ok('the highlighted entry takes its own palette slot, the colour chain', CHAIN.test(val(item, 'background') || ''), val(item, 'background'));
  const info = { tag: 'span', classes: ['cc-acctinfo'], inside: ['.bg-popover'], states: { hover: true } };
  const c = val(info, 'color');
  ok('the (i) never takes the accent, not even under the pointer', !/accent/.test(c || ''), c);
  ok('and draws the outline (i) of every other info bubble, not a text character', /ic\.innerHTML = window\.CCTheme\.CC_INFO_SVG;/.test(read('scripts/header.js')) && !/"cc-acctinfo"; ic.textContent/.test(read('scripts/header.js')));
  const header = read('scripts/header.js');
  ok('it gets the close badge of every CC window, named in both languages', header.includes('mx.className = "cc-acct-x"; mx.innerHTML = window.CCTheme.glyph("Close");') && header.includes('mx.setAttribute("aria-label", T("Schließen", "Close"));'));
  ok('which closes the menu with Escape, the key reka listens for', header.includes('menu.insertBefore(mx, menu.firstChild);') && /mx\.addEventListener\("click"[\s\S]{0,160}key: "Escape"/.test(header));
  const x = { tag: 'span', classes: ['cc-acct-x'], inside: ['.cc-acctmenu'] };
  ok('a square badge in the top right corner, the drawer\'s size', val(x, 'width') === 'var(--cc-icon-badge, 26px)' && val(x, 'height') === 'var(--cc-icon-badge, 26px)' && val(x, 'position') === 'absolute' && val(x, 'right') === '6px' && val(x, 'top') === '6px');
  ok('on the chip grey at rest and in the colour chain under the pointer', /--cc-surface-chip/.test(val(x, 'background')) && CHAIN.test(val(Object.assign({}, x, { states: { hover: true } }), 'background') || ''));
  ok('on a strip of its own above the first entry', val({ tag: 'div', classes: ['bg-popover', 'cc-acctmenu'] }, 'padding-top') === '38px');
  ok('the strip carries the title, named in both languages', header.includes('mt.className = "cc-acct-title"; mt.textContent = T("Konto", "Account");'));
  const title = { tag: 'span', classes: ['cc-acct-title'], inside: ['.cc-acctmenu'] };
  ok('a section badge on the strip\'s left, as every window title', val(title, 'position') === 'absolute' && val(title, 'left') === '8px' && val(title, 'min-height') === 'var(--cc-sec-h, 22px)' && val(title, 'font-size') === 'var(--cc-sec-fs)' && val(title, 'text-transform') === 'uppercase');
  ok('always coloured, since a title is not a control', /var\(--cc-rbaccent, var\(--cc-accent/.test(val(title, 'background') || ''));
}

console.log('\nA notification card');
{
  const header = read('scripts/header.js');
  const css = read('sheets/TowerTorch.Header.css');
  ok('its buttons rest hidden, keeping their place', css.includes('[class~="group/item"] :is(a[class*="text-primary"], span[class*="rounded-md"][class*="inline-flex"]) { opacity: 0;'));
  ok('and come in with the pointer or the focus on the card', /\[class~="group\/item"\]:is\(:hover, :focus-within\) :is\(a\[class\*="text-primary"\], span\[class\*="rounded-md"\]\[class\*="inline-flex"\]\) \{ opacity: 1; \}/.test(css));
  ok('a touch screen keeps them', /@media \(hover: none\) \{\s*html\.cc-popups-on \.unapi div\.fixed\.z-50\.bg-background \[class~="group\/item"\] :is\([^)]*\)[^{]*\{ opacity: 1; \}/.test(css));
  ok('the archive button says what it does', header.includes('cbt.nodeValue.replace("Archiv", "Archivieren")'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
