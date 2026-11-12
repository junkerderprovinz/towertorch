// While an item of a reorderable list is held, every other item trembles and the held one stays
// still (GlimStone 4.3.0, "Reordering by dragging"). Tabs and chips turn to and fro at the motion
// level's angle and beat, a full-width Docker row tilts and lifts instead, and neighbours start
// out of step. "off" and reduced motion keep them still.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const tokens = read('sheets/TowerTorch.Tokens.css'), header = read('sheets/TowerTorch.Header.css'), docker = read('styles/docker.css');
function level(sel) {
  const m = new RegExp(sel.replace(/[[\]()."=]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(tokens);
  const b = m ? m[1] : '';
  const v = (n) => { const x = new RegExp(n + ':\\s*([^;]+);').exec(b); return x ? x[1].trim() : null; };
  return { dur: v('--tt-motion-tremble-dur'), angle: v('--tt-motion-tremble-angle'), tilt: v('--tt-motion-tremble-tilt'), lift: v('--tt-motion-tremble-lift') };
}

console.log('\nThe numbers per motion level');
const gate = tokens.indexOf('@media (prefers-reduced-motion: no-preference)');
const outside = tokens.slice(0, gate);
ok('outside the gate nothing trembles', gate > 0 && /--tt-motion-tremble-dur:\s*0s;\s*--tt-motion-tremble-angle:\s*0deg;\s*--tt-motion-tremble-tilt:\s*0deg;\s*--tt-motion-tremble-lift:\s*0px;/.test(outside));
const subtle = level('html[data-tt-motion="subtle"]'), off = level('html[data-tt-motion="off"]');
ok('subtle: 1.4deg every 140ms, a row .1deg and 1px', subtle.dur === '140ms' && subtle.angle === '1.4deg' && subtle.tilt === '.1deg' && subtle.lift === '1px', JSON.stringify(subtle));
ok('off: still', off.dur === '0s' && off.angle === '0deg' && off.tilt === '0deg' && off.lift === '0px', JSON.stringify(off));
const wild = /--tt-motion-tremble-dur:\s*120ms;\s*--tt-motion-tremble-angle:\s*2deg;\s*--tt-motion-tremble-tilt:\s*\.15deg;\s*--tt-motion-tremble-lift:\s*1\.5px;/.test(tokens);
ok('wild: 2deg every 120ms, a row .15deg and 1.5px', wild);
ok('one keyframe turns through rotate', /@keyframes tt-tremble \{ from \{ rotate: calc\(var\(--tt-motion-tremble-angle, 0deg\) \* -1\); \} to \{ rotate: var\(--tt-motion-tremble-angle, 0deg\); \} \}/.test(tokens));

console.log('\nTabs and chips in arrange mode');
ok('the menu tabs tremble', /#menu \.tt-nav-wiggle \{\s*animation: tt-tremble var\(--tt-motion-tremble-dur, 0s\) ease-in-out infinite alternate;/.test(header));
ok('the island chips tremble', /\.tt-arrange #tt-island \.tt-isl-chip \{ animation: tt-tremble var\(--tt-motion-tremble-dur, 0s\) ease-in-out infinite alternate;/.test(header));
ok('neighbours start half and a third of a beat early', /\.tt-nav-wiggle:nth-child\(2n\) \{ animation-delay: calc\(var\(--tt-motion-tremble-dur, 0s\) \* -\.5\); \}/.test(header) && /\.tt-nav-wiggle:nth-child\(3n\) \{ animation-delay: calc\(var\(--tt-motion-tremble-dur, 0s\) \* -\.33\); \}/.test(header));
ok('the held tab and chip stay still', /#menu \.tt-dragging \{[^}]*animation: none !important;/.test(header) && /\.tt-isl-chip\.tt-isl-dragging \{ animation: none; \}/.test(header));
ok('the fixed wiggles that ignored the motion level are gone', !/tt-nav-wiggle \.32s|tt-isl-wiggle/.test(header));

console.log('\nDocker rows while one is held');
ok('docker.js marks the list while jQuery UI holds a row', /jQuery\(document\)\.on\("sortstart sortstop", "#docker_list", function \(e\) \{ this\.classList\.toggle\("tt-held", e\.type === "sortstart"\); \}\);/.test(read('scripts/docker.js')));
const held = /#docker_list\.ui-sortable\.tt-held > tr\.sortable:not\(\.ui-sortable-helper, \.ui-sortable-placeholder\) \{([^}]*)\}/.exec(docker);
ok('the other rows take the row tremble on a doubled beat', !!held && /--tt-motion-wiggle-tilt: var\(--tt-motion-tremble-tilt, 0deg\);/.test(held[1]) && /animation-duration: calc\(var\(--tt-motion-tremble-dur, 0s\) \* 2\);/.test(held[1]));
ok('and keep their phase offsets', !!held && !/animation:/.test(held[1]));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
