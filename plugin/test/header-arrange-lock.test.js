// The arrange lock in the header: exactly one lock on every page, and the lock stays a plain
// toggle while everything around it wiggles and drags.
const fs = require('fs');
const path = require('path');
const HEADER = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts', 'header.js');
const src = fs.readFileSync(process.argv[2] || HEADER, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const body = (name) => { const i = src.indexOf('function ' + name + '('); return i < 0 ? '' : src.slice(i, src.indexOf('\n  }\n', i)); };

console.log('\nOne lock per page');
{
  const lock = body('ccArrangeLock');
  ok('Unraid\'s own lock is found anywhere in the menu, so the Docker tab gets no second one', /var native = document\.querySelector\("#menu \.nav-item\.LockButton"\)/.test(lock));
  ok('the look-alike is only added where Unraid has none', /if \(native\) \{\s*if \(injected\) injected\.remove\(\);/.test(lock));
}

console.log('\nThe lock while arranging');
{
  ok('both locks are recognised', /function isNavLock\(it\) \{ return it\.id === "cc-lock-item" \|\| it\.classList\.contains\("LockButton"\); \}/.test(src));
  ok('the lock does not wiggle', /if \(!isNavLock\(it\)\) it\.classList\.add\("cc-nav-wiggle"\)/.test(body('enterReorder')));
  ok('a press on the lock never starts a drag', /if \(e\.button !== 0 \|\| isNavLock\(it\)\) return;/.test(body('wireNavItem')));
}

console.log('\nArranging moves nothing on the page');
{
  const { candidates } = require('./cascade');
  const win = (el, prop, arranging) => {
    const html = ['cc-header-on', 'cc-popups-on'].concat(arranging ? ['cc-arrange'] : []);
    const c = candidates('every', Object.assign({ attrs: {}, states: {}, html }, el), prop);
    return c.length ? c[c.length - 1].value : null;
  };
  const trig = { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'bell' }, inside: ['.cc-iconproxy'] };
  ok('the ghost takes the bell\'s and the burger\'s slot instead of sitting beside them', win(trig, 'display', true) === 'none');
  const island = { tag: 'span', classes: [], attrs: {}, id: 'cc-island' };
  ok('the island keeps its row gap', win(island, 'gap', true) === win(island, 'gap', false), win(island, 'gap', true));
  const row = { tag: 'span', classes: ['cc-isl-row'], inside: ['#cc-island'], states: { empty: true } };
  ok('an empty row keeps its height', win(row, 'min-height', true) === win(row, 'min-height', false), win(row, 'min-height', true));
  const lastTrig = { tag: 'span', classes: [], attrs: { 'data-cc-trig': 'burger' }, inside: ['.nav-tile', '.right', '.nav-item', '.util'], states: { 'last-child': true } };
  const end = candidates('every', Object.assign({ html: ['cc-header-on'] }, lastTrig), 'margin-right').filter((d) => d.value === '0' && d.selector.includes('[data-cc-trig]'));
  ok('a trailing bell or burger ends the row at its icon, as the ghost does', end.length > 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
