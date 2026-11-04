// Under rainbow every selector wears a palette colour of its own, counted in the order the
// selectors stand (GlimStone, "Every selector wears a colour of its own"), so the gear menu's view,
// density, Basic/Advanced, rainbow and icon selectors show different colours instead of one
// accent five times. Outside the rainbow they share the accent again.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const PAL = ['#FF8389', '#FF832B', '#FCC419', '#6FDC8C', '#3DDBD9'];
const seg = () => { const p = {}; return { props: p, style: { setProperty: (k, v) => { p[k] = v; }, removeProperty: (k) => { delete p[k]; } } }; };
function run(store, segs) {
  const localStorage = { getItem: (k) => (k in store ? store[k] : null) };
  const root = { querySelectorAll: (s) => (s === '.tt-seg' ? segs : []) };
  new Function('localStorage', 'ttRbColor', 'idealText', grabFn(docker, 'themingOn') + '\n' + grabFn(docker, 'paintSelectors') + '\nreturn paintSelectors;')(
    localStorage, (i) => PAL[i % PAL.length], () => '#161616')(root);
  return segs;
}

console.log('\nThe gear menu\'s selectors under rainbow');
{
  const segs = run({ 'tt.rainbow': '1' }, [seg(), seg(), seg()]);
  ok('each selector takes the next palette slot in the order they stand', segs.map((s) => s.props['--tt-rb-c']).join() === '#FF8389,#FF832B,#FCC419', segs.map((s) => s.props['--tt-rb-c']).join());
  ok('each with its own ink', segs.every((s) => s.props['--tt-rb-ct'] === '#161616'));
  const plain = run({}, segs);
  ok('without rainbow the stamps go and the accent applies', plain.every((s) => !('--tt-rb-c' in s.props) && !('--tt-rb-ct' in s.props)));
  const off = run({ 'tt.rainbow': '1', 'tt.theming': '0' }, [seg()]);
  ok('with theming off nothing is stamped', !('--tt-rb-c' in off[0].props));
  ok('the menu paints its selectors as it is built', /paintSelectors\(m\);\s*return m;/.test(grabFn(docker, 'buildMenu')));
}

console.log('\nThe sheet');
{
  const on = { tag: 'button', classes: ['tt-seg-btn', 'tt-seg-on'], inside: ['.tt-menu', '.tt-seg'], html: ['tt-docker-on'] };
  const page = withUnraid('docker');
  const bg = candidates(page, on, 'background').pop(), ink = candidates(page, on, 'color').pop();
  ok('the chosen segment is filled with its selector\'s slot, then the accent', bg && bg.value === 'var(--tt-rb-c, var(--tt-accent))', bg && bg.value);
  ok('and inked with the slot\'s ink', ink && ink.value === 'var(--tt-rb-ct, var(--tt-accent-text, #161616))', ink && ink.value);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
