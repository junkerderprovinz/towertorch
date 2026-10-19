// Every confirmation Unraid and Community Applications ask through SweetAlert looks like a
// TowerTorch window: the title as a section badge notched into the top edge, the close badge
// in the top right corner, the buttons at the bottom right with the forward action last and the only
// filled one, Cancel grey, and never red for a delete. SweetAlert keeps one node for every dialog,
// the streaming install windows included, so the close badge shows on a confirmation only, and it
// closes the way Escape does, through SweetAlert's own Cancel.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const win = (el, prop) => { const c = candidates('every', el, prop); return c.length ? c[c.length - 1].value.replace(/\s*!important$/, '') : '(none)'; };
const HTML = ['cc-popups-on', 'cc-header-on'];
const inSa = (tag, classes, extra) => Object.assign({ tag, classes: classes || [], attrs: {}, states: {}, html: HTML, inside: ['.sweet-alert'], outside: ['.nchan', '.cc-only-loader'] }, extra);

console.log('\nThe frame and its title');
{
  const frame = { tag: 'div', classes: ['sweet-alert'], attrs: {}, states: {}, html: HTML };
  ok('the frame is as wide as a TowerTorch window', win(frame, 'width') === '420px', win(frame, 'width'));
  ok('and lets the notches stand over its edge', win(frame, 'overflow') === 'visible', win(frame, 'overflow'));
  const h2 = inSa('h2');
  ok('the title is notched into the top edge', win(h2, 'position') === 'absolute' && win(h2, 'transform') === 'translateY(-50%)', win(h2, 'position') + ' ' + win(h2, 'transform'));
  ok('at the height of a section badge', win(h2, 'min-height') === 'var(--cc-sec-h, 22px)' && win(h2, 'font-size') === 'var(--cc-sec-fs)', win(h2, 'min-height') + ' ' + win(h2, 'font-size'));
  ok('starting on the content\'s left edge', win(h2, 'left') === '24px' && win(h2, 'justify-content') === 'flex-start');
  const p = inSa('p');
  ok('the text sits on the window itself, read from the start', win(p, 'background') === 'none' && win(p, 'box-shadow') === 'none' && win(p, 'text-align') === 'start', win(p, 'background'));
}

console.log('\nThe buttons');
{
  const row = inSa('div', ['sa-button-container']);
  ok('they stand at the bottom right', win(row, 'justify-content') === 'flex-end', win(row, 'justify-content'));
  ok('the forward action comes last', win(inSa('div', ['sa-confirm-button-container']), 'order') === '2' && win(inSa('button', ['cancel']), 'order') === '1');
  ok('Cancel is grey', win(inSa('button', ['cancel']), 'background') === '#2e2e2e', win(inSa('button', ['cancel']), 'background'));
  ok('the forward action is the filled one', /^var\(--cc-rb-c, var\(--cc-rbaccent/.test(win(inSa('button', ['confirm']), 'background')), win(inSa('button', ['confirm']), 'background'));
  ok('in the window\'s button size, not as uppercase lg pills', win(inSa('button', ['confirm']), 'text-transform') === 'none' && win(inSa('button', ['confirm']), 'min-height') === '32px');
  const header = read('scripts/header.js');
  ok('a confirm button skips a red palette slot', /stamp\(b, false, b\.classList\.contains\("confirm"\)\)/.test(header) && /noRed && k < 8 && window\.CCTheme && window\.CCTheme\.isRed\(c\)/.test(header));
}

console.log('\nThe close badge');
{
  const x = inSa('span', ['cc-win-x']);
  ok('a confirmation shows it', win(x, 'display') === 'inline-flex', win(x, 'display'));
  ok('in the dark window\'s grey on every theme', win(x, 'background') === '#2e2e2e');
  ok('with popups off it stays hidden', win(Object.assign({}, x, { html: [] }), 'display') === 'none', win(Object.assign({}, x, { html: [] }), 'display'));
  const css = read('sheets/TowerTorch.Header.css').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('it is shown only where the frame is neither a stream nor the loader', /html\.cc-popups-on \.sweet-alert:not\(\.nchan, \.cc-only-loader\):not\(:has\(pre\)\) > \.cc-win-x \{ display: inline-flex; \}/.test(css));

  // swalClose() against a stand-in SweetAlert node.
  const header = read('scripts/header.js');
  const src = /function swalClose\(sa\) \{[\s\S]*?\n  \}/.exec(header)[0];
  let run = null;
  const window = { CCTheme: { closeBadge: (fn) => { run = fn; return { cls: 'cc-win-x' }; } } };
  const swalClose = new Function('window', src + '\nreturn swalClose;')(window);
  const kids = [], clicks = [];
  const sa = {
    appendChild: (n) => kids.push(n),
    querySelector: (sel) => (sel === ':scope > .cc-win-x' ? kids[0] || null : sel === 'button.cancel' ? { click: () => clicks.push('cancel') } : null),
  };
  swalClose(sa); swalClose(sa);
  ok('the node gets one badge, however often it is painted', kids.length === 1);
  run();
  ok('closing presses SweetAlert\'s Cancel, so the callback hears a cancel', clicks.join() === 'cancel');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
