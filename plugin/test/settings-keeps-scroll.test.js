// A pick that rebuilds the settings page, such as a colour mode, leaves the page where it was: the
// rebuild empties the root, which shortens the page and lets the scroll clamp to the top, and the
// focus that follows the pick lands on the colour mode itself rather than on the first selector.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = settings.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = settings.indexOf('{', i); k < settings.length; k++) { if (settings[k] === '{') d++; else if (settings[k] === '}') { d--; if (!d) return settings.slice(i, k + 1); } }
  return '';
}

const render = grabFn('render');
console.log('\nA rebuild keeps the scroll position');
ok('render notes the position before it empties the root', /var keepY = window\.scrollY;\s*root\.innerHTML = "";/.test(render));
ok('and scrolls back to it once the cards are in', /paintCardHeads\(\);\s*if \(window\.scrollY !== keepY\) window\.scrollTo\(0, keepY\);\s*\}$/.test(render));

console.log('\nThe colour mode keeps the focus on itself');
ok('its row carries a class of its own', /var modeRow = el\("div", "tt-set-row tt-set-inline tt-set-colourmode"\);/.test(settings));
ok('the pick focuses the chosen mode without scrolling', /root\.querySelector\("\.tt-set-colourmode \.tt-seg-on"\); if \(on\) on\.focus\(\{ preventScroll: true \}\);/.test(settings));
ok('and never the first selector on the page', !/root\.querySelector\("\.tt-set-mode \.tt-seg-on"\)/.test(settings));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
