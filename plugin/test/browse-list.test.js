// The file browser (/Shares/Browse, html.cc-on-browse) in the GlimStone look. The page deletes and
// moves files, so the look must never change what Unraid's own scripts see. What can quietly break it:
//   · a check glyph that is hidden or zero-sized, which selectAll() then skips through :visible
//   · a column added or removed, which shifts tablesorter's index-based setup
//   · a selected row marked by a rail, the vertical stripe GlimStone forbids
//   · blue text links among the badges, or every button filled with the accent
//   · a rule that reaches past html.cc-on-browse
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const js = read('scripts/shares.js');
const css = read('sheets/TowerTorch.Shares.css').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
{
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) rules.push({ sel: m[1].replace(/^\s*@media[^{]*\{/, '').trim(), body: m[2] });
}
const browse = rules.filter((r) => /cc-on-browse/.test(r.sel) && !/:is\(\.cc-on-shares/.test(r.sel));
const rule = (needle) => browse.filter((r) => r.sel.includes(needle)).map((r) => r.body).join(';');
const ruleFor = (end) => browse.filter((r) => r.sel.endsWith(end)).map((r) => r.body).join(';');
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

console.log('\nEvery rule waits for the page');
ok('the page has its rules', browse.length > 30, browse.length);
ok('each of them is gated on html.cc-shares-on.cc-on-browse', browse.every((r) => splitTop(r.sel).every((p) => /^html\.cc-shares-on\.cc-on-browse\b/.test(p.trim()))));

console.log('\nThe page\'s own scripts see what they saw');
{
  const check = ruleFor('table.indexer i[id^="check_"]');
  ok('a check glyph stays displayed and visible, with a size of its own', /display: inline-flex !important/.test(check) && /visibility: visible !important/.test(check) && /width: 18px; height: 18px/.test(check));
  ok('no rule hides a check glyph', !browse.some((r) => /check_/.test(r.sel) && /display:\s*none|visibility:\s*hidden|width:\s*0|height:\s*0/.test(r.body)));
  ok('the selection mark is round in every shape, like the Docker list\'s', /border-radius: 50%/.test(check));
  const fn = grabFn(js, 'enhanceBrowse');
  ok('enhanceBrowse adds and removes no cell', !/insertCell|createElement\("td"\)|removeChild|deleteCell/.test(fn));
  ok('a folder\'s size marker stays plain text, a file\'s size becomes a chip', /\/\^<\.\*>\$\/\.test\(\(size\.textContent \|\| ""\)\.trim\(\)\) \? "cc-b-size cc-b-dir" : "cc-b-size"/.test(fn));
}

console.log('\nThe look');
{
  ok('a selected row is tinted, never marked by a rail', !browse.some((r) => /inset 3px 0 0/.test(r.body)) && /color-mix\(in srgb, var\(--cc-shr-accent, #FCC419\) 22%, transparent\)/.test(rule('fa-check-square-o) > td')));
  ok('the listing is a card on the surface tokens', /background-color: var\(--cc-fm-list\)/.test(rule('.TableContainer')) && /border-radius: var\(--cc-radius-card\)/.test(rule('.TableContainer')));
  ok('the head is the eyebrow of the other tables', /color: var\(--cc-text-dim\)/.test(rule('thead th')) && /text-transform: uppercase; letter-spacing: 1\.2px/.test(rule('thead th')));
  ok('a name reads in the text ink, not as a blue link', /color: var\(--cc-text\); font-weight: 600; text-decoration: none/.test(rule('tbody td > a[href]')));
  ok('a row takes the chip shade under the pointer', /background-color: var\(--cc-chip\)/.test(rule('tbody tr:hover > td')));
  ok('the row action is an icon badge with the three dots, shown with its row', /width: var\(--cc-icon-badge, 26px\); height: var\(--cc-icon-badge, 26px\)/.test(rule('i[id^="row_"]')) && /content: "\\f141"/.test(rule('i[id^="row_"]::before')) && /opacity: 1/.test(rule('tr:hover i[id^="row_"]')));
  const btn = browse.find((r) => /#buttons input\[type="button"\]$/.test(r.sel.trim()));
  ok('the buttons rest neutral and take the accent only under the pointer', !!btn && /background: var\(--cc-surface-3\) !important/.test(btn.body) && /--cc-shr-accent/.test(rule(':hover:not(:disabled)')));
  ok('the breadcrumb is a row of badges, the open folder filled', /border-radius: var\(--cc-radius-pill\); background: var\(--cc-chip\)/.test(ruleFor('div.title > span.left > a')) && /background: var\(--cc-shr-accent, #FCC419\)/.test(rule('a:is(:hover, :last-of-type)')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
