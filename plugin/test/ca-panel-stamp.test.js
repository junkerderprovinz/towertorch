// A rule that reads --cc-rb-c only rotates under the rainbow if something stamps the
// variable on the element or an ancestor; without a stamp it falls to the flat accent.
// CA's Statistics, Credits and Change Log panel (#alternateView) colours its icons that
// way, so the Apps pass has to stamp them like the other CA panels.
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const stamped = (header.match(/ccAppsStamp\("([^"]+)"\)/g) || []).map((s) => /"([^"]+)"/.exec(s)[1]);
const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');

console.log('\nEvery #alternateView rule that reads the stamp has one');
const readers = [];
for (const r of parseRules(tokens)) {
  if (!r.decls.some((d) => /var\(--cc-rb-c\b/.test(d.value))) continue;
  for (const sel of r.selector.split(',').map((s) => s.trim())) if (/#alternateView/.test(sel)) readers.push(sel);
}
ok('the panel has rules that read --cc-rb-c', readers.length > 0);
for (const sel of readers) {
  // A stamp covers the rule if it names the same element under the panel, in any state, or an
  // ancestor of it.
  const tail = sel.slice(sel.indexOf('#alternateView'));
  const covered = stamped.some((s) => s.split(',').map((x) => x.trim()).some((x) => tail === x || tail.startsWith(x + ' ') || tail.startsWith(x + ':')));
  ok(sel, covered, 'stamped: ' + stamped.filter((s) => /alternateView/.test(s)).join(' | '));
}

console.log('\nThe stamp rotates through the palette');
{
  const i = header.indexOf('function ccAppsStamp(');
  const fn = header.slice(i, header.indexOf('\n  }\n', i) + 4);
  const els = [0, 1, 2].map(() => ({ css: {}, style: { setProperty(k, v) { this.owner.css[k] = v; } } }));
  els.forEach((e) => { e.style.owner = e; });
  const run = new Function('document', 'rbColor', 'idealText', fn + '\nreturn ccAppsStamp;')(
    { querySelectorAll: (s) => (s === '#alternateView i.fa' ? els : []) }, (n) => ['#FF8389', '#FF832B', '#FCC419'][n], () => '#161616');
  run('#alternateView i.fa');
  ok('each icon gets its own position colour', els.map((e) => e.css['--cc-rb-c']).join() === '#FF8389,#FF832B,#FCC419', els.map((e) => e.css['--cc-rb-c']).join());
  ok('with its ink', els.every((e) => e.css['--cc-rb-ct'] === '#161616'));
}

// The menu click only schedules a pass 60ms out, and CA fills the panel from a request that
// returns later, so a stamp tied to the click finds an empty panel. The panel itself is watched.
console.log('\nThe stamp follows the content, not the click');
{
  const i = header.indexOf('function ccAppsBoot(');
  const boot = header.slice(i, header.indexOf('\n  }\n', i));
  ok('the Apps boot watches #alternateView', /getElementById\("alternateView"\)/.test(boot));
  ok('for content arriving anywhere inside it', /ccAltObs = new MutationObserver\(ccAppsSoon\); ccAltObs\.observe\(av, \{ childList: true, subtree: true \}\)/.test(boot));
  ok('once per page', /if \(av && !ccAltObs\)/.test(boot));
  // The stamp writes style, not children, so the pass it runs cannot wake the observer again.
  const i2 = header.indexOf('function ccAppsStamp(');
  const stampFn = header.slice(i2, header.indexOf('\n  }\n', i2));
  ok('the stamp only writes custom properties', !/appendChild|insertBefore|innerHTML|textContent/.test(stampFn));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
