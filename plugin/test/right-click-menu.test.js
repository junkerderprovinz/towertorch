// A plain right-click opens the browser's own menu everywhere, so a tab in the menu bar can be
// opened in a new tab or copied. Only a right-button hold that has turned the wheel over a row
// keeps the menu shut. Linux and macOS send the menu event on the press and Windows after the
// release, and both orders are replayed here.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const gesture = header.slice(header.indexOf('/* Holding the right mouse button'));

// The gesture's listeners in a minimal document, with the timer run by hand.
function load() {
  const on = {}, timers = [];
  const ctx = vm.createContext({
    document: { documentElement: {}, addEventListener: (type, fn) => { (on[type] = on[type] || []).push(fn); } },
    getComputedStyle: (el) => ({ overflowX: el.overflowX || 'visible' }),
    setTimeout: (f) => { timers.push(f); return timers.length; },
    clearTimeout: () => {},
  });
  vm.runInContext(gesture, ctx);
  const fire = (type, init) => {
    const e = Object.assign({ button: 0, shiftKey: false, ctrlKey: false, deltaX: 0, deltaY: 0, defaultPrevented: false, target: tab }, init, {
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
    });
    (on[type] || []).forEach((fn) => fn(e));
    return e;
  };
  return { fire, timers };
}
const bar = { scrollWidth: 300, clientWidth: 300, parentElement: null };
const tab = { scrollWidth: 120, clientWidth: 120, parentElement: bar };
const row = { scrollWidth: 2400, clientWidth: 900, scrollLeft: 0, overflowX: 'auto', parentElement: null };
const card = { scrollWidth: 200, clientWidth: 200, parentElement: row };

console.log('\nA plain right-click');
{
  const w = load();
  w.fire('mousedown', { button: 2 });
  const menu = w.fire('contextmenu', { button: 2 });
  w.fire('mouseup', { button: 2 });
  ok('opens the menu where it comes on the press', !menu.defaultPrevented);
}
{
  const w = load();
  w.fire('mousedown', { button: 2 });
  w.fire('mouseup', { button: 2 });
  const menu = w.fire('contextmenu', { button: 2 });
  ok('opens the menu where it comes after the release', !menu.defaultPrevented);
}
{
  const w = load();
  w.fire('mousedown', { button: 2 });
  w.fire('wheel', { target: tab, deltaY: 100 });
  w.fire('mouseup', { button: 2 });
  const menu = w.fire('contextmenu', { button: 2 });
  ok('opens the menu after a wheel turn over something that does not scroll sideways', !menu.defaultPrevented);
}

console.log('\nThe right-button wheel gesture');
{
  const w = load();
  row.scrollLeft = 0;
  w.fire('mousedown', { button: 2, target: card });
  const wheel = w.fire('wheel', { target: card, deltaY: 120 });
  w.fire('mouseup', { button: 2, target: card });
  const menu = w.fire('contextmenu', { button: 2, target: card });
  ok('scrolls the row sideways', row.scrollLeft === 120 && wheel.defaultPrevented, row.scrollLeft);
  ok('and keeps the menu shut once it has moved the row', menu.defaultPrevented);
  w.timers.forEach((f) => f());
  w.fire('mousedown', { button: 2 });
  w.fire('mouseup', { button: 2 });
  ok('the next plain right-click opens the menu again', !w.fire('contextmenu', { button: 2 }).defaultPrevented);
}
{
  const w = load();
  row.scrollLeft = 0;
  const wheel = w.fire('wheel', { target: card, deltaY: 80, shiftKey: true });
  ok('Shift with the wheel scrolls the row with no button held', row.scrollLeft === 80 && wheel.defaultPrevented, row.scrollLeft);
  const plain = w.fire('wheel', { target: card, deltaY: 80 });
  ok('a plain wheel turn is left to the page', row.scrollLeft === 80 && !plain.defaultPrevented, row.scrollLeft);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
