// The create and update output window centres its content for the button row. A dry run prints
// the template and the docker command as <pre> blocks straight into that content, so they have to
// be set left and wrap their long lines, or the window cuts them off at its right edge.
const { candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const pre = { tag: 'pre', classes: [], attrs: {}, states: {}, has: [], html: ['tt-docker-on', 'tt-ctout-on'],
  inside: ['#displaybox', '.content'], outside: ['.sweet-alert', '.ui-dialog'] };
const win = (prop) => { const all = candidates('docker', pre, prop); return all[all.length - 1]; };
const show = (w) => w ? w.value + ' from ' + w.sheet + ' ' + w.selector : 'nothing';

console.log('\nThe dry run in the output window');
ok('the template and the command are set left', win('text-align') && win('text-align').value === 'left', show(win('text-align')));
ok('long lines wrap and keep their spaces', win('white-space') && win('white-space').value === 'pre-wrap', show(win('white-space')));
ok('an unbroken path or URL wraps too', win('overflow-wrap') && win('overflow-wrap').value === 'anywhere', show(win('overflow-wrap')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
