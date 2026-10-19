// A square icon badge has one size across the plugin, --cc-icon-badge, whatever its role: the
// row actions, the limit gear, the day chip and its delete, the Plugins trash, the /Main icon
// tiles and the sort reset in a list head. GlimStone tried a size per role and rejected it,
// because the roles meet on one card and read as three sizes. This fails if a badge falls back to
// its own number or a second stage appears.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const sel = stack.pop(); if (sel !== undefined && !sel.startsWith('@')) out.push({ sel, body: buf.trim() }); buf = ''; }
    else buf += ch;
  }
  return out;
}

const SHEETS = ['styles/docker.css', 'sheets/TowerTorch.VmTab.css', 'sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.Tokens.css'];
// The last compound of a selector that names one of the square icon badges.
const BADGE = /(\.cc-actbtn|\.cc-sortreset:not\(\[hidden\]\)|\.cc-limbtn|\.cc-day|\.cc-sched-x|\.cc-b-delicon|a\.cc-ud-icon|a\.cc-ibtn|i\.fa-gears(\[disabled\]|\.disabled)?|:is\(i\.fa-remove, i\.fa-times, i\.fa-trash, i\.fa-trash-o, i\.fa-ban\))$/;
const SIZE = /var\(--cc-icon-badge, 26px\)/;

console.log('\nOne token, one value');
{
  const tokens = read('sheets/TowerTorch.Tokens.css');
  const decl = clean(tokens).match(/--cc-icon-badge\s*:\s*[^;]+/g) || [];
  ok('Tokens.css declares --cc-icon-badge once, at 26px', decl.length === 1 && /26px$/.test(decl[0]), decl.join(' | '));
  const stages = new Set();
  for (const f of SHEETS.concat('sheets/TowerTorch.Tokens.css')) for (const m of clean(read(f)).matchAll(/--cc-[\w-]*icon-?badge[\w-]*(?=\s*:)/g)) stages.add(m[0]);
  ok('no second icon badge stage exists', stages.size === 1, [...stages].join(' '));
}

console.log('\nEvery square icon badge reads it, and nothing sizes one on its own');
const seen = new Set();
for (const f of SHEETS) {
  const bad = [];
  for (const r of rules(read(f))) {
    const parts = r.sel.split(/,(?![^(]*\))/).map((p) => p.trim());
    const hits = parts.filter((p) => !/:(hover|focus|active)/.test(p) && BADGE.test(p.split(/\s+(?![^(]*\))/).pop()));
    if (!hits.length) continue;
    for (const d of ['width', 'height']) {
      const m = new RegExp('(?:^|;)\\s*' + d + '\\s*:\\s*([^;]+)').exec(r.body);
      if (!m) continue;
      if (SIZE.test(m[1])) hits.forEach((h) => seen.add(path.basename(f) + ' ' + (BADGE.exec(h.split(/\s+(?![^(]*\))/).pop()) || [])[1]));
      else bad.push(hits[0].slice(0, 70) + ' ' + d + ': ' + m[1].trim());
    }
  }
  ok(path.basename(f) + ': no icon badge has its own size', bad.length === 0, bad.join(' | '));
}
for (const want of ['docker.css .cc-actbtn', 'docker.css .cc-limbtn', 'docker.css .cc-sched-x', 'docker.css .cc-day', 'docker.css .cc-b-delicon',
  'TowerTorch.VmTab.css .cc-actbtn', 'TowerTorch.VmTab.css .cc-limbtn', 'TowerTorch.Shares.css a.cc-ud-icon', 'TowerTorch.Shares.css i.fa-gears', 'TowerTorch.Tokens.css .cc-sortreset:not([hidden])']) {
  ok(want + ' is sized by the token', seen.has(want), [...seen].join(' | '));
}
{
  // More opens a menu, so no extra badges unfold inside the bar and nothing there needs a width.
  const docker = clean(read('styles/docker.css'));
  ok('no action bar unfolds a second block of badges', !/\.cc-actmore/.test(docker) && !/\.cc-actmore/.test(clean(read('sheets/TowerTorch.VmTab.css'))));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
