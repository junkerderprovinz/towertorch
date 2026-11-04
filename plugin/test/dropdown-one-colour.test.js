// A dropdown follows GlimStone's rainbow rule for selectors: its options rest neutral, and the
// hovered and the chosen one wear the dropdown's one colour. No option takes a palette slot of
// its own, in any of TowerTorch's dropdown widgets.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(clean(css)))) out.push({ sel: m[1].trim(), body: m[2] });
  return out;
}

const SHEETS = ['styles/docker.css', 'sheets/TowerTorch.Tools.css', 'sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.VmTab.css', 'sheets/TowerTorch.Header.css'];
const OPTION = /\.(tt-dsel-opt|tt-tsel-opt|tt-sel-opt|tt-drop-it|ui-dropdownchecklist-item)\b/;

console.log('\nAn option at rest wears no colour');
for (const f of SHEETS) {
  const coloured = rules(read(f)).filter((r) => {
    const rest = r.sel.split(',').map((s) => s.trim()).filter((s) => OPTION.test(s) && !/:hover|is-selected|:has\(input:checked\)|ui-state-|tt-drop-on|is-disabled|-avail|:not\(/.test(s) && /\b(tt-dsel-opt|tt-tsel-opt|tt-sel-opt|tt-drop-it|ui-dropdownchecklist-item)\s*$/.test(s));
    return rest.length && /background[^;]*var\(--tt-rb-c/.test(r.body);
  });
  ok(path.basename(f), coloured.length === 0, coloured.map((r) => r.sel.slice(0, 80)).join(' | '));
}

console.log('\nThe chosen option wears the dropdown\'s colour');
{
  const docker = clean(read('styles/docker.css'));
  ok('on the settings page', /#tt-settings \.tt-dsel-opt:hover, #tt-settings \.tt-dsel-opt\.is-selected \{\s*background: var\(--tt-rb-c, var\(--tt-rbaccent, var\(--tt-accent/.test(docker));
  ok('in a window', /\.tt-pop \.tt-dsel-opt:hover, \.tt-pop \.tt-dsel-opt\.is-selected \{\s*background: var\(--tt-rb-c/.test(docker));
  ok('in the dependency picker', /\.tt-drop-it:hover, \.tt-drop-on \{\s*background: var\(--tt-rb-c/.test(docker));
  ok('no colour mode sub-rule decides it any more', !/rbneutral[^{]*\.(tt-dsel-opt|tt-tsel-opt|tt-sel-opt|tt-drop-it)/.test(SHEETS.map((f) => clean(read(f))).join('\n')));
}

console.log('\nThe painters hand out one colour per dropdown');
{
  const theme = read('scripts/tt-theme.js');
  const i = theme.indexOf('function paintSelects(');
  const body = theme.slice(i, theme.indexOf('\n  }\n', i));
  ok('tt-theme.js clears every option stamp', /opts\[n\]\.style\.removeProperty\("--tt-rb-c"\)/.test(body) && !/opts\[n\]\.style\.setProperty/.test(body));
  ok('a panel outside a wrapper takes one slot for all its options', /panels\[p\]\.style\.setProperty\("--tt-rb-c", c\)/.test(body));
  const header = read('scripts/header.js');
  const j = header.indexOf('function ttPaintRotate(');
  const rot = header.slice(j, header.indexOf('// The notification drawer', j));
  ok('header.js gives a checklist\'s options their trigger\'s slot', /stamp\(opts\[oi\], slot >= 0 \? slot : pn\)/.test(rot) && !/stamp\(opts\[oi\], oi\)/.test(rot));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
