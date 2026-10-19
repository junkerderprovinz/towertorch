// Under the rainbow every action takes the palette slot of its position, and a delete
// can come round to red. A delete is never red, so it passes to the next slot that is
// not, here on the Plugins page's delete badge, which reads its row's colour. A flag's red is
// red too, so in flag mode a delete passes it the same way, while every other control keeps
// the flag's colours where they fall.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const theme = read('cc-theme.js');
const store = {};
const CCTheme = new Function('store', 'function g(k, d) { return k in store ? store[k] : d; }' + grabFn(theme, 'idealText') + grabFn(theme, 'isRed') + grabFn(theme, 'deleteSlot') +
  'return { idealText: idealText, isRed: isRed, deleteSlot: deleteSlot };')(store);
const RB = JSON.parse(/var RB = (\[[^\]]+\]);/.exec(theme)[1]);
const AUSTRIA = ['#ED2939', '#FFFFFF', '#ED2939'];

console.log('\nWhat counts as red');
ok('the palette\'s red slot is red', CCTheme.isRed('#FF8389'));
ok('a flag red is red', CCTheme.isRed('#D21034') && CCTheme.isRed('#ED2939'));
ok('the orange beside it is not', !CCTheme.isRed('#FF832B'));
ok('nor the magenta on its other side', !CCTheme.isRed('#FF7EB6'));
ok('nor a grey with a warm cast', !CCTheme.isRed('#8a7a7a'));
ok('the palette has exactly one red slot', RB.filter(CCTheme.isRed).length === 1);

console.log('\nThe slot a delete takes');
ok('a delete landing on red takes the next slot', CCTheme.deleteSlot(RB, 8) === RB[1], CCTheme.deleteSlot(RB, 8));
ok('a delete elsewhere keeps its own slot', CCTheme.deleteSlot(RB, 11) === RB[3]);
ok('in a red and white palette of the user\'s own it takes the white', CCTheme.deleteSlot(AUSTRIA, 0) === '#FFFFFF');
store['cc.flagmode'] = '1';
ok('in flag mode a delete on the flag\'s red takes the next colour', CCTheme.deleteSlot(AUSTRIA, 0) === '#FFFFFF', CCTheme.deleteSlot(AUSTRIA, 0));
ok('and a delete on a white slot keeps it', CCTheme.deleteSlot(AUSTRIA, 4) === '#FFFFFF');
ok('a flag that is all red keeps its colour, there being nothing else to take', CCTheme.deleteSlot(['#D21034', '#ED2939'], 0) === '#D21034');
delete store['cc.flagmode'];

function button(classes) {
  const b = { cls: new Set(classes), css: {} };
  b.classList = { contains: (c) => b.cls.has(c) };
  b.style = { setProperty: (k, v) => { b.css[k] = v; }, removeProperty: (k) => { delete b.css[k]; } };
  b.querySelector = () => null;
  return b;
}
function settings(extra) {
  const s = Object.assign({ 'cc.rainbow': '1', 'cc.rainbowrot': '0' }, extra);
  return { getItem: (k) => (k in s ? s[k] : null) };
}

// The Docker remove is a button of its row and docker-action-grid.test.js pins its slot; the VM
// removes stand in their row's More menu, which keeps a delete off red the same way, and
// row-more-menu.test.js pins it there.

console.log('\nThe delete badge on the Plugins page');
{
  const plugins = read('plugins.js');
  const paint = grabFn(plugins, 'paintRow');
  const i = paint.indexOf('var dc = '), j = paint.indexOf('// Column 2');
  ok('paintRow gives the delete badge a slot of its own', i > 0 && j > i);
  // the slot logic as paintRow runs it, against a row whose colour is the red slot
  const run = (extra) => {
    const ls = settings(Object.assign({ 'cc.rbpal': null }, extra));
    const b = button(['cc-b-del']);
    const td = { querySelectorAll: () => [b] };
    new Function('ls', 'window', 'pal', 'colorFor', 'idealText', 'RB_OFFSET', 'idx', 'tds', paint.slice(i, j))(
      (k) => ls.getItem(k), { CCTheme }, () => RB, (n) => RB[n % RB.length], CCTheme.idealText, 0, 8, [0, 0, 0, 0, 0, td]);
    return b.css['--cc-rb-c'];
  };
  const own = run();
  ok('a badge in a row on the red slot gets a colour that is not red', !!own && !CCTheme.isRed(own), own);
  ok('a badge in an accent-coloured row keeps the row\'s colour', run({ 'cc.rainbow': '0' }) === undefined);
  store['cc.flagmode'] = '1';
  const flag = run();
  ok('in flag mode it leaves the red slot too', !!flag && !CCTheme.isRed(flag), flag);
  delete store['cc.flagmode'];
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
