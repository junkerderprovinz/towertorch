// Unraid animates each load bar's width frame by frame on every CPU message and reads the width
// back before each step. In Firefox a changed bar lays out its ancestors again, which on the
// Dashboard are block rows and the core grids, so without containment every frame relaid the
// column and the live values fell seconds behind. Size and layout containment stop that at the bar.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Dashboard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push([m[1].replace(/^@media[^{]*\{/, '').trim(), m[2]]);
const bars = rules.filter(([s]) => /\.usage-disk\s*$/.test(s.split(',').pop()));

console.log('\nEvery load bar on the Dashboard is its own layout root');
{
  const root = rules.find(([s]) => s === 'html.tt-dash-on table.dashboard .usage-disk');
  const contain = root && (/contain:\s*([^;]+)/.exec(root[1]) || [])[1];
  ok('the bars are contained in size and layout', !!contain && /\bsize\b/.test(contain) && /\blayout\b/.test(contain), contain);
  ok('without paint containment, which would clip the label Unraid sets above the bar', !!contain && !/\b(paint|strict|content)\b/.test(contain), contain);
  ok('it waits for the Dashboard gate', !!root);
}

console.log('\nA contained bar takes no height from its content, so none is left to auto');
{
  ok('the sheet sizes some bar itself', bars.length > 1, bars.length);
  for (const [s, b] of bars) {
    const h = (/(?:^|;)\s*height:\s*([^;!]+)/.exec(b) || [])[1];
    ok(s.slice(s.indexOf('table.dashboard')), h === undefined || /^\d+(\.\d+)?(px|rem|em)$/.test(h.trim()), h);
  }
}

console.log('\nTowerTorch\'s own live bars carry the meter class');
{
  const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
  ok('.tt-meter contains size and layout, without paint', /\.tt-meter \{ contain: size layout; \}/.test(read('sheets/TowerTorch.Tokens.css')));
  ok('the Docker CPU and RAM gauges wear it', /el\("div", "tt-gauge tt-meter"\)/.test(read('scripts/docker.js')));
  ok('so do the header\'s usage bars', /ubar\.className = "tt-isl-bar tt-meter"/.test(read('scripts/header.js')));
  ok('both have a height of their own', /\.tt-gauge \{[^}]*height: 6px/.test(read('styles/docker.css')) && /\.tt-isl-bar \{\s*width: 46px; height: 8px/.test(read('sheets/TowerTorch.Header.css')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
