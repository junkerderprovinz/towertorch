// Every button and clickable badge gives way on press: :active scales it to .97 and it
// returns on release (GlimStone, "The motion engine"). The number comes from the motion
// level, so "off" and reduced motion press at 1. It goes through the scale property, which
// composes with a transform the control already has; a transform would replace the wild
// hover lift and anything a control positions itself with.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const tokens = clean(read('sheets/TowerTorch.Tokens.css'));
// the gate that holds the press rule
let gate = '';
for (let i = tokens.indexOf('@media (prefers-reduced-motion: no-preference)'); i >= 0; i = tokens.indexOf('@media (prefers-reduced-motion: no-preference)', i + 1)) {
  let d = 0, k = tokens.indexOf('{', i);
  for (; k < tokens.length; k++) { if (tokens[k] === '{') d++; else if (tokens[k] === '}' && !--d) break; }
  const block = tokens.slice(i, k + 1);
  if (/:active/.test(block)) gate = block;
}

console.log('\nThe press rule');
ok('it sits inside the no-preference gate', gate.length > 0);
const rule = (/(html :is\([\s\S]*?)\{([^}]*)\}/.exec(gate) || []);
const sel = rule[1] || '', body = rule[2] || '';
ok('it scales through the scale property, from the level token', /^\s*scale:\s*var\(--cc-motion-press-scale, 1\);\s*$/.test(body), body.trim());
ok('it sets no transform', !/transform/.test(body));
ok('it waits for :active', /\):active/.test(sel));
ok('a disabled control does not give way', /:not\(:disabled, \[aria-disabled="true"\], \.cc-actoff\)/.test(sel));

console.log('\nThe buttons and clickable badges it reaches');
const listed = (sel.match(/\.(cc|sl)-[a-z0-9-]+/g) || []).map((s) => s.slice(1));
for (const c of ['cc-btn', 'cc-abtn', 'cc-actbtn', 'cc-limbtn', 'cc-bulkbtn', 'cc-b-copy', 'cc-badge-toggle', 'cc-plan', 'cc-seg-btn', 'cc-set-tab', 'cc-sched-x', 'cc-b-del', 'sl-chip']) ok(c + ' is pressed', listed.includes(c));
const scripts = fs.readdirSync(path.join(DIR, 'scripts')).filter((f) => f.endsWith('.js')).map((f) => read('scripts/' + f)).join('\n');
const gone = listed.filter((c) => c.startsWith('cc-') && !new RegExp('[ "\']' + c + '(?![a-z0-9-])').test(scripts));
ok('every listed class is one a script still sets', gone.length === 0, gone.join(' '));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
