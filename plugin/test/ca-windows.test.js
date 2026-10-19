// CA's Statistics, Credits and Change Log panel is a CC window with its title badge and close badge
// in a head row, and CA's multi-select checkbox on an app card is a round marker in the card's
// corner, never a checkbox.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const win = (el, prop) => { const c = candidates('every', Object.assign({ attrs: {}, states: {}, html: ['cc-popups-on'] }, el), prop); return c.length ? c[c.length - 1].value : null; };
const CHAIN = /^var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/;

console.log('\nThe Statistics, Credits and Change Log window');
{
  const fn = grabFn(header, 'ccAppsAltView');
  ok('CA\'s close button and content move into a window with a head row', /win\.appendChild\(head\); win\.appendChild\(content\);/.test(fn) && /head\.appendChild\(x\);/.test(fn));
  ok('the close button turns into the close glyph, named in both languages', /x\.appendChild\(ccGlyphEl\("Close"\)\)/.test(fn) && /T\("Schließen", "Close"\)/.test(fn));
  ok('the title is CA\'s own heading, written only when it changes, so the panel observer settles', /\.ca_center > font/.test(fn) && /if \(badge\.textContent !== title\) badge\.textContent = title;/.test(fn));
  const ccApps = grabFn(header, 'ccApps');
  ok('every Apps pass builds it once the CC look is on', ccApps.indexOf('ccAppsAltView();') > ccApps.indexOf('cc-popups-on'));

  const w = { tag: 'div', classes: ['cc-av-win'], inside: ['#alternateView'] };
  ok('the frame of a CC window', win(w, 'background') === '#1a1a1a' && win(w, 'border-radius') === 'var(--cc-radius-card)' && /--cc-elev-3/.test(win(w, 'box-shadow')));
  ok('never taller than the viewport, so the close badge stays in reach', /^calc\(100% - 2 \* var\(--cc-edge/.test(win(w, 'max-height') || ''));
  const content = { tag: 'div', classes: ['alternateViewContent'], inside: ['#alternateView', '.cc-av-win'] };
  ok('the content scrolls inside the window', win(content, 'overflow') === 'auto' && win(content, 'min-height') === '0');
  const title = { tag: 'span', classes: ['cc-av-title'], inside: ['#alternateView', '.cc-av-head'] };
  ok('the title is a section badge of the one 22px height', win(title, 'min-height') === 'var(--cc-sec-h)' && win(title, 'font-size') === 'var(--cc-sec-fs)' && CHAIN.test(win(title, 'background') || ''));
  const x = { tag: 'div', classes: ['caButton', 'alternateViewClose'], inside: ['#alternateView', '.cc-av-head'] };
  ok('the close control is the square badge inside the window, not pinned to the viewport', win(x, 'position') === 'static' && win(x, 'width') === 'var(--cc-icon-badge, 26px)' && win(x, 'height') === 'var(--cc-icon-badge, 26px)');
  ok('grey at rest, the colour chain under the pointer', /--cc-surface-3/.test(win(x, 'background')) && CHAIN.test(win(Object.assign({}, x, { states: { hover: true } }), 'background') || ''));
  ok('CA\'s heading leaves the content once the head row shows it', /#alternateView \.cc-av-win \.alternateViewContent \.ca_center:has\(> font\),/.test(tokens));
}

console.log('\nThe info drawer');
{
  const x = { tag: 'span', classes: ['popUpClose', 'caButton', 'cc-ic-close'], inside: ['.popupCloseArea'] };
  ok('its close badge has the size of every other CC close badge', win(x, 'width') === 'var(--cc-icon-badge, 26px)' && win(x, 'height') === 'var(--cc-icon-badge, 26px)');
}

console.log('\nThe selection marker on an app card');
{
  const make = (cls) => ({ className: cls || '', children: [], parentElement: null, classList: { contains(c) { return (this.owner.className || '').split(' ').includes(c); } },
    appendChild(n) { if (n.parentElement) n.parentElement.children.splice(n.parentElement.children.indexOf(n), 1); n.parentElement = this; this.children.push(n); return n; } });
  const el = (cls) => { const e = make(cls); e.classList.owner = e; return e; };
  const bottom = el('ca_bottomLine'), box = el('ca_multiselect ca_tooltip'), holder = el('ca_holder');
  holder.appendChild(bottom); bottom.appendChild(box);
  holder.querySelector = () => box;
  const run = new Function('ccMkEl', 'ccGlyphEl', grabFn(header, 'ccAppsSelectMark') + '\nreturn ccAppsSelectMark;')((tag, cls) => el(cls), (name) => el('glyph-' + name));
  run(holder);
  const mark = box.parentElement;
  ok('the checkbox leaves the button row for a marker on the card', mark.className === 'cc-ca-sel' && mark.parentElement === holder && !bottom.children.includes(box));
  ok('the marker carries the check glyph', mark.children.some((c) => c.className === 'glyph-Check'));
  run(holder);
  ok('a second pass leaves it alone', holder.children.filter((c) => c.className === 'cc-ca-sel').length === 1);
  const order = grabFn(header, 'ccAppsPositionTopBadges');
  ok('it takes the corner slot of the badge row', /var order = \[\s*holder\.querySelector\("\.cc-ca-sel"\),\s*holder\.querySelector\("\.cc-ca-menu-btn"\)/.test(order));

  const input = { tag: 'input', classes: ['ca_multiselect'], attrs: { type: 'checkbox' }, inside: ['.ca_holder', '.cc-ca-sel'] };
  ok('the checkbox itself is never seen, only its marker', win(input, 'appearance') === 'none' && win(input, 'opacity') === '0');
  ok('and still takes the click over the whole marker', win(input, 'position') === 'absolute' && win(input, 'inset') === '0');
  ok('the marker rests hidden', /html\.cc-popups-on \.ca_holder \.cc-ca-sel \{[^}]*opacity: 0;/.test(tokens));
  ok('and shows on the card under the pointer and while the app is selected', /\.ca_holder:hover \.cc-ca-sel,\s*html\.cc-popups-on \.ca_holder \.cc-ca-sel:has\(> input:checked\)/.test(tokens));
  ok('round, on the neutral badge surface at rest and in the colour mode when selected',
    /\.cc-ca-sel::before \{[^}]*border-radius: var\(--cc-radius-pill\);[^}]*background: var\(--cc-badge-neutral/.test(tokens) &&
    /\.cc-ca-sel:has\(> input:checked\)::before \{ background: var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(tokens));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
