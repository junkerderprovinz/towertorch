// A strip that runs out of room wraps; it never scrolls or slides one part under another
// (GlimStone). At 1600px the menu's tabs ran on under the icon group and the Docker action bar
// scrolled, its pinned view switch covering "Containergröße" with "Mehrfachauswahl" off screen.
// A phone is the one exception, covered in header-phone.test.js, so the menu bar is read here with
// the phone rules taken out.
const fs = require('fs');
const path = require('path');
const { candidates, DIR, PAGES } = require('./cascade');

function withoutPhone(css) {
  const head = '@media (max-width: 767.98px) {';
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head)) {
    let d = 0, k = at + head.length - 1;
    for (; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}' && !--d) break; }
    css = css.slice(0, at) + css.slice(k + 1);
  }
  return css;
}
const DESKTOP = PAGES.every.map((f) => ({ name: f, css: withoutPhone(fs.readFileSync(path.join(DIR, f), 'utf8')) }));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const win = (page, el, prop) => { const c = candidates(page, el, prop); return c.length ? c[c.length - 1] : null; };
const val = (w) => (w ? w.value : '(none)');

console.log('\nThe menu bar');
{
  const html = ['tt-header-on', 'Theme--black'];
  const menu = { tag: 'div', classes: [], attrs: {}, states: {}, html, id: 'menu' };
  ok('the menu is a wrapping flex row, not Unraid\'s two-column grid', val(win(DESKTOP, menu, 'display')) === 'flex' && val(win(DESKTOP, menu, 'flex-wrap')) === 'wrap', val(win(DESKTOP, menu, 'display')));
  const tabs = { tag: 'div', classes: ['nav-tile'], attrs: {}, states: {}, html, inside: ['#menu'] };
  ok('the tab row wraps its tabs', val(win(DESKTOP, tabs, 'flex-wrap')) === 'wrap');
  ok('and never scrolls them', !/auto|scroll/.test(val(win(DESKTOP, tabs, 'overflow'))) && !/auto|scroll/.test(val(win(DESKTOP, tabs, 'overflow-x'))), val(win(DESKTOP, tabs, 'overflow-x')));
  ok('it takes the room it needs, up to the full width', val(win(DESKTOP, tabs, 'flex')) === '1 0 auto' && val(win(DESKTOP, tabs, 'max-width')) === '100%');
  ok('it grows with its rows instead of keeping Unraid\'s one-row height', val(win(DESKTOP, tabs, 'height')) === 'auto');
  const icons = { tag: 'div', classes: ['nav-tile', 'right'], attrs: {}, states: {}, html, inside: ['#menu'] };
  ok('the icon group keeps its size and moves to the right of its own line', val(win(DESKTOP, icons, 'flex')) === '0 0 auto' && val(win(DESKTOP, icons, 'margin-left')) === 'auto');
  ok('under the sidebar theme the menu is left alone', win(DESKTOP, Object.assign({}, menu, { html: ['tt-header-on', 'Theme--sidebar'] }), 'display') === null);
}

console.log('\nThe Docker action bar');
{
  const bar = { tag: 'div', classes: ['js-actions'], attrs: {}, states: {}, html: ['tt-docker-on'] };
  ok('it wraps its buttons onto a second row', val(win('docker', bar, 'flex-wrap')) === 'wrap');
  ok('and never scrolls', val(win('docker', bar, 'overflow')) === 'visible' && win('docker', bar, 'overflow-x') === null, val(win('docker', bar, 'overflow-x')));
  const adv = { tag: 'span', classes: ['tt-bar-adv'], attrs: {}, states: {}, html: ['tt-docker-on'], inside: ['.js-actions'] };
  ok('the view switch is pinned right on whichever row it lands', val(win('docker', adv, 'margin-left')) === 'auto');
  ok('and no longer sticks over the buttons', win('docker', adv, 'position') === null, val(win('docker', adv, 'position')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
