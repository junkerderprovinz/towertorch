// The heading of a Settings or Tools sub-page is a badge in the colour mode, and its name sits in a
// span.left inside it. The section bars elsewhere give that span the page's text colour, which on
// the dark themes is near white and unreadable on a yellow or other light accent. Inside the badge
// the name takes the badge's own ink.
const { candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const show = (w) => w ? w.value + ' from ' + w.sheet + ' ' + w.selector : 'nothing';
const win = (el, prop) => { const all = candidates('every', el, prop); return all[all.length - 1]; };
const BADGE_INK = /^var\(--tt-rbaccent-text, var\(--tt-accent-text, #161616\)\)$/;

for (const theme of ['black', 'gray', 'white', 'azure']) {
  console.log('\nTheme ' + theme);
  const html = ['Theme--' + theme, 'tt-popups-on'];
  const badge = { tag: 'div', classes: ['title'], attrs: {}, states: {}, has: [], html: html.concat('tt-tools-on', 'tt-forms-on'), inside: ['#displaybox'] };
  const name = { tag: 'span', classes: ['left'], attrs: {}, states: {}, has: [], html: html.concat('tt-tools-on', 'tt-forms-on'), inside: ['#displaybox', '.title'] };
  const bar = { tag: 'span', classes: ['left'], attrs: {}, states: {}, has: [], html, inside: ['.title'], outside: ['#displaybox'] };

  const b = win(badge, 'color'), n = win(name, 'color'), s = win(bar, 'color');
  ok('the badge is drawn in the colour mode\'s ink', b && BADGE_INK.test(b.value), show(b));
  ok('the name inside the badge takes that ink', n && (n.value === 'inherit' || BADGE_INK.test(n.value)), show(n));
  ok('a section bar outside the sub-pages keeps the page text colour', s && /--tt-text\b/.test(s.value), show(s));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
