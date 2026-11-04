// The Docker tab has no search of its own: the header's page search filters the containers while
// it is open there, and the gear menu keeps to the view. The filter goes with the box once Unraid
// removes it on blur, but only after the pointer is up, so the click that blurred it still lands
// on the row it was aimed at. Closing the menu hands the caret back to its gear.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const docker = read('scripts/docker.js');
const css = read('styles/docker.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nThe header search filters the containers');
{
  const listeners = {};
  let box = { id: 'guiSearchBox', value: '' };
  const document = {
    addEventListener: (k, fn) => { (listeners[k] = listeners[k] || []).push(fn); },
    getElementById: (id) => (id === 'guiSearchBox' ? box : null),
  };
  const ticks = new Map();
  let nextId = 1;
  const env = { filterText: '', applied: 0 };
  const fire = (k, ev) => (listeners[k] || []).forEach((fn) => fn(ev || {}));
  const run = () => [...ticks.values()].forEach((fn) => fn());
  const follow = new Function('document', 'env', 'setInterval', 'clearInterval', 'norm',
    'var dead = false, filterText = "";\n' +
    'function applyFilter() { env.filterText = filterText; env.applied++; }\n' +
    'var headSearchWired = false;\n' + grabFn(docker, 'followHeaderSearch') + '\nreturn followHeaderSearch;')(
    document, env, (fn) => { ticks.set(nextId, fn); return nextId++; }, (id) => { ticks.delete(id); }, (v) => String(v || '').trim().toLowerCase());
  follow(); follow();
  ok('it wires its listeners once', (listeners.input || []).length === 1);
  box.value = 'Plex';
  fire('input', { target: box });
  ok('typing in the header box filters at once, case aside', env.filterText === 'plex' && env.applied === 1);
  fire('input', { target: { id: 'other', value: 'x' } });
  ok('another field on the page is left alone', env.filterText === 'plex' && env.applied === 1);
  run();
  ok('while the box is open the filter holds', env.filterText === 'plex');
  box = null;
  fire('pointerdown');
  run();
  ok('a press that blurred the box keeps the rows where they are', env.filterText === 'plex');
  fire('pointerup');
  run();
  ok('once the pointer is up the filter goes with the box', env.filterText === '' && env.applied === 2);
  ok('and the watch stops', ticks.size === 0);
}

console.log('\nThe gear menu has no search of its own');
{
  const menu = grabFn(docker, 'buildMenu');
  ok('no filter field and no Search button', !/tt-filter|searchToggle|tt-search/.test(menu) && !/function searchToggle/.test(docker));
  ok('and the sheet carries none of their rules', !/\.tt-search\b|\.tt-filter\b/.test(css));
  ok('init follows the header search', /followHeaderSearch\(\);/.test(docker));
}

console.log('\nClosing the menu hands focus back to its gear');
{
  const refindSrc = grabFn(read('scripts/tt-theme.js'), 'refind');
  const make = (focusInside, redrawn) => {
    const mkGear = () => ({ focused: 0, focus() { this.focused++; }, getAttribute: (k) => (k === 'data-tt-focus-key' ? 'tt-hgear-grid' : null) });
    const gear = mkGear(), fresh = redrawn ? mkGear() : null;
    const inner = {};
    const menu = { removed: false, remove() { this.removed = true; }, contains: (n) => n === inner };
    const live = redrawn ? fresh : gear;
    const document = { activeElement: focusInside ? inner : {}, contains: (n) => n === live, querySelector: (s) => (s === '[data-tt-focus-key="tt-hgear-grid"]' ? live : null) };
    const refind = new Function('document', refindSrc + '\nreturn refind;')(document);
    const close = new Function('document', 'window', 'menu', 'menuAnchor', 'menuStatusEl', grabFn(docker, 'closeMenu') + '\ncloseMenu(); return menu;');
    const left = close(document, { TTTheme: { refind } }, menu, gear, null);
    return { gear, fresh, menu, left };
  };
  const kb = make(true);
  ok('Escape from inside the menu puts the caret back on the gear', kb.menu.removed && kb.left === null && kb.gear.focused === 1);
  const mouse = make(false);
  ok('a click elsewhere leaves focus where the click put it', mouse.menu.removed && mouse.gear.focused === 0);
  const tick = make(true, true);
  ok('a gear the stats tick drew again in the meantime gets the caret instead', tick.fresh.focused === 1 && tick.gear.focused === 0);
  ok('every gear carries a key to be found again by', /g\.setAttribute\("data-tt-focus-key", extra \|\| "tt-hgear"\)/.test(grabFn(docker, 'makeGear')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
