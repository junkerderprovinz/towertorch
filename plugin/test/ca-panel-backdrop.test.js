// CA's Statistics, Credits and Change Log panel, #alternateView, is a modal: the backdrop TowerTorch gives
// it covers the whole viewport. CA's own rule stops the box 1.6rem and a 10px margin above the
// bottom edge, which leaves a strip of the page unblurred and still clickable.
const { candidates, PAGES } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// CA's rule from skins/Narrow/styles/community.applications.css, which loads before TowerTorch's sheets.
const CA = { name: 'community.applications.css', css: `
#alternateView { position: fixed; top: 0; right: 0; bottom: 1.6rem; margin-bottom: 10px; padding-top: 15rem; width: 100%; z-index: 10000;
  background-color: var(--sidebar-background); color: var(--sidebar-text); opacity: 0.9; display: none; overflow-x: scroll; overflow-y: scroll; }
` };
const box = { tag: 'div', id: 'alternateView', classes: [], attrs: {}, states: {}, html: ['tt-popups-on'] };
const win = (prop) => { const c = candidates([CA].concat(PAGES.every), box, prop); return c[c.length - 1]; };

console.log('\nThe backdrop reaches every edge');
for (const [prop, want] of [['top', '0'], ['bottom', '0'], ['margin-bottom', '0']]) {
  const w = win(prop);
  ok(`${prop} is ${want}`, !!w && w.value === want, w && `${w.sheet}: ${w.selector} => ${w.value}`);
}
const d = win('display');
ok('CA decides whether the panel shows', !!d && d.sheet === CA.name, d && d.sheet);

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
