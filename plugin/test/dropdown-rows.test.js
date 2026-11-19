// An open dropdown lists plain rows, as GlimStone's select does: no fill and no pill at rest, the
// hover colour under the pointer and the keyboard, and the chosen entry in bold with GlimStone's
// check at the end. The check carries the dropdown's one colour.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(clean(css)))) out.push({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] });
  return out;
}
const bodyOf = (rs, tail) => rs.filter((r) => r.sels.some((s) => s.endsWith(tail))).map((r) => r.body).join(';');

const FAMILIES = [
  ['sheets/TowerTorch.Tools.css', '#displaybox .tt-tsel-opt', '.is-selected'],
  ['sheets/TowerTorch.Tools.css', '#displaybox .ui-dropdownchecklist-item', ':has(input:checked)'],
  ['sheets/TowerTorch.Shares.css', '#displaybox .tt-sel-opt', '.is-selected'],
  ['sheets/TowerTorch.Shares.css', '#displaybox .ui-dropdownchecklist-item', ':has(input:checked)'],
  ['sheets/TowerTorch.VmTab.css', '#tt-vmlim .tt-dsel-opt', '.is-selected'],
  ['styles/docker.css', '#tt-settings .tt-dsel-opt', '.is-selected'],
  ['styles/docker.css', '.tt-on-addct .tt-dsel-opt', '.is-selected'],
  ['styles/docker.css', '.tt-pop .tt-dsel-opt', '.is-selected'],
  ['styles/docker.css', '.tt-drop-it', null],
];

for (const [file, fam, picked] of FAMILIES) {
  console.log(`\n${fam} in ${path.basename(file)}`);
  const rs = rules(read(file));
  const rest = bodyOf(rs, fam);
  ok('rests without a fill', /background:\s*transparent/.test(rest) && !/rgba\(128, 128, 128/.test(rest), rest.slice(0, 120));
  ok('has a row\'s corners, not a pill', /border-radius:\s*var\(--tt-radius-control\)/.test(rest) && !/radius-pill/.test(rest));
  const hover = bodyOf(rs, fam + ':hover');
  ok('lights up in the hover colour', /background:\s*var\(--tt-hover(-dark)?\)/.test(hover), hover.slice(0, 120));
  ok('and the keyboard gets the same', /background:\s*var\(--tt-hover(-dark)?\)/.test(bodyOf(rs, fam + ':focus-visible')));
  const on = picked ? bodyOf(rs, fam + picked) : bodyOf(rs, '.tt-drop-on');
  ok('the chosen entry is bold', /font-weight:\s*600/.test(on), on.slice(0, 120));
  ok('the chosen entry takes no fill', !/background/.test(on), on.slice(0, 120));
  const mark = bodyOf(rs, fam + '::after');
  ok('every row keeps room for the check', /mask:\s*var\(--tt-check-mark\)/.test(mark) && /visibility:\s*hidden/.test(mark), mark.slice(0, 160));
  ok('the check wears the dropdown\'s colour', /background:\s*var\(--tt-rb-c,/.test(mark));
  const shown = picked ? bodyOf(rs, fam + picked + '::after') : bodyOf(rs, '.tt-drop-on::after');
  ok('and shows on the chosen entry', /visibility:\s*visible/.test(shown));
}

console.log('\nThe check is GlimStone\'s');
{
  const tokens = clean(read('sheets/TowerTorch.Tokens.css'));
  const m = /--tt-check-mark:\s*url\("([^"]+)"\)/.exec(tokens);
  ok('Tokens.css holds it as one mask', !!m);
  ok('drawn from GlimStone\'s check mark', !!m && /viewBox='0\.3 0\.549 13\.399 13\.399'/.test(m[1]) && /M4\.381 12\.219 L4\.574 12\.378/.test(m[1]));
  ok('with an ink that reads on a panel that stays dark', /--tt-ink-on-dark:\s*var\(--tt-accent-ink-dark,/.test(tokens));
}

console.log('\nThe settings page\'s list stays dark on the light themes, and so does its text');
{
  const rs = rules(read('styles/docker.css'));
  ok('the panel has no theme surface of its own', /background:\s*var\(--tt-surface, #303030\)/.test(bodyOf(rs, '#tt-settings .tt-dsel-panel')));
  ok('so its rows keep light text instead of the theme\'s', /color:\s*#e4e4e4/.test(bodyOf(rs, '#tt-settings .tt-dsel-opt')) && !/color:\s*var\(--tt-text/.test(bodyOf(rs, '#tt-settings .tt-dsel-opt')));
}

console.log('\nNo dropdown entry fills with the accent any more');
{
  const OPTION = /\.(tt-dsel-opt|tt-tsel-opt|tt-sel-opt|tt-drop-it|tt-drop-on|ui-dropdownchecklist-item)\b/;
  for (const f of ['styles/docker.css', 'sheets/TowerTorch.Tools.css', 'sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.VmTab.css']) {
    const filled = rules(read(f)).filter((r) => r.sels.some((s) => OPTION.test(s) && !/::after|:not\(:has\(input|input\[/.test(s)) && /background(-color)?:\s*(var\(--tt-rb-c|var\(--tt-accent|var\(--tt-shr-accent|color-mix)/.test(r.body));
    ok(path.basename(f), filled.length === 0, filled.map((r) => r.sels[0].slice(0, 80)).join(' | '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
