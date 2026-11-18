// The heading of a Settings or Tools sub-page is a badge in the colour mode, and its name sits in a
// span.left inside it. The section bars elsewhere give that span the page's text colour, which on
// the dark themes is near white and unreadable on a yellow or other light accent. Inside the badge
// the name takes the badge's own ink. So does the page's glyph in front of it, which the bars draw in
// the accent and which would vanish on the badge's accent.
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

  for (const classes of [['fa', 'fa-desktop', 'title'], ['fa', 'fa-wrench']]) {
    const glyph = { tag: 'i', classes, attrs: {}, states: {}, has: [], html: html.concat('tt-tools-on', 'tt-forms-on'), inside: ['#displaybox', '.title', '.left'], outside: ['#alternateView'] };
    const g = win(glyph, 'color');
    ok(`the glyph i.${classes.join('.')} in the badge takes the badge's ink`, g && (g.value === 'inherit' || BADGE_INK.test(g.value)), show(g));
    const m = win(glyph, 'margin-right');
    ok(`the glyph i.${classes.join('.')} keeps no margin of its own beside the name`, m && /^0(px)?$/.test(m.value), show(m));
  }
  const gap = win(name, 'gap');
  ok('the glyph and the name sit one small gap apart', gap && gap.value === '6px' && /div\.title > span\.left$/.test(gap.selector), show(gap));
  const right = { tag: 'span', classes: ['right'], attrs: {}, states: {}, has: [], html: html.concat('tt-tools-on', 'tt-forms-on'), inside: ['#displaybox', '.title'] };
  // The form rows' empty spans sit in a dd, which never holds the page heading.
  const rd = candidates('every', right, 'display').filter((c) => !/\bdd\b/.test(c.selector)).pop();
  ok('an empty right half leaves no gap at the badge\'s end', rd && rd.value === 'none' && /div\.title > span\.right:empty$/.test(rd.selector), show(rd));
  const barGlyph = { tag: 'i', classes: ['fa', 'fa-desktop', 'title'], attrs: {}, states: {}, has: [], html, inside: ['.title', '.left'], outside: ['#displaybox', '#alternateView'] };
  const bg = win(barGlyph, 'color');
  ok('a section bar\'s glyph keeps the accent', bg && /--tt-rbaccent/.test(bg.value) && !BADGE_INK.test(bg.value), show(bg));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
