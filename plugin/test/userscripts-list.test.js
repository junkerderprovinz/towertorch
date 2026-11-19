// The User Scripts list: the category badge draws its arrow in the badge's own ink, and a script
// row gives its name and description the free width instead of the plugin's fixed 300px column.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Pages.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = 'html.tt-tools-on[data-tt-page="userscripts"] #displaybox';
// The declarations of every rule whose selector list names the given selector.
function decls(sel) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).includes(sel)) out.push(m[2]);
  }
  return out.join(';');
}

console.log('\nThe category badge');
{
  const arrow = decls(PAGE + ' .category-header::before');
  ok('its arrow takes the ink of the badge, open and shut', /border-top-color:\s*currentColor\s*!important/.test(arrow) && /border-bottom-color:\s*currentColor\s*!important/.test(arrow), arrow);
  ok('the badge ink is the accent\'s own text colour', /color:\s*var\(--tt-rbaccent-text, var\(--tt-accent-text/.test(decls(PAGE + ' .category-header')));
}

console.log('\nA script row in the list view');
{
  const row = decls(PAGE + ' .category-scripts.vm-list tr');
  ok('is a grid as wide as the card', /display:\s*grid\s*!important/.test(row) && /width:\s*auto\s*!important/.test(row), row);
  ok('whose first column takes the free width', /grid-template-columns:\s*minmax\(\d+px,\s*1fr\)/.test(row), row);
  const cells = decls(PAGE + ' .category-scripts.vm-list tr > td');
  ok('the plugin\'s fixed cell widths are lifted', /min-width:\s*0\s*!important/.test(cells) && /max-width:\s*none\s*!important/.test(cells), cells);
  ok('a description keeps a readable line length', /max-width:\s*\d+ch/.test(decls(PAGE + ' .ca_descEdit')));
  ok('rows are parted by a hairline', /border-top:\s*1px solid/.test(decls(PAGE + ' .category-scripts.vm-list tr + tr')));
  ok('on a narrow screen the controls wrap under the name', /@media \(max-width: \d+px\)\s*\{[^}]*\.category-scripts\.vm-list tr\s*\{[^}]*grid-template-columns:\s*1fr/.test(css.replace(/\s+/g, ' ')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
