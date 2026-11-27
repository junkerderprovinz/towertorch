// A plugin can add a tab of its own to the menu bar, as Custom SMB Shares does with "SMB Shares"
// (Menu="Tasks:85"). TowerTorch has a glyph only for Unraid's own tabs, so in icon-only mode such a
// tab keeps its name and its width; hiding the name would leave an empty pill.
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }

const header = read('scripts/header.js');
const rules = parseRules(read('sheets/TowerTorch.Header.css'));
const iconOnly = rules.flatMap((r) => splitTop(r.selector).map((s) => ({ s, r }))).filter((x) => /^html\.tt-tabtext-off #menu /.test(x.s));

console.log('\nTowerTorch has glyphs for Unraid\'s tabs alone');
{
  const keys = (/var TT_TAB_ICONS = \{([\s\S]*?)\n  \};/.exec(header) || ['', ''])[1].match(/^\s*"(\/[A-Za-z]+)"/gm) || [];
  ok('the glyph table is keyed by Unraid\'s own top-level pages', keys.length >= 10, keys.join(' '));
  ok('and a plugin\'s page such as /SMBShares is not among them', !keys.some((k) => /SMBShares/.test(k)));
}

console.log('\nIn icon-only mode a tab without a glyph keeps its name');
{
  const hide = iconOnly.filter((x) => /span\.tt-tab-label$/.test(x.s) && x.r.decls.some((d) => d.prop === 'display' && d.value === 'none'));
  ok('the name is hidden by a rule', hide.length > 0);
  ok('only on a tab that has a glyph', hide.length > 0 && hide.every((x) => /> a:has\(> svg\.tt-tab-ico\) /.test(x.s)), hide.map((x) => x.s).join(' | '));
}

console.log('\nand its width');
{
  const shrink = iconOnly.filter((x) => /> a(:has\([^)]*\))?$/.test(x.s) && x.r.decls.some((d) => d.prop === 'width'));
  ok('the pill is made square by a rule', shrink.length > 0);
  ok('only where a glyph fills it', shrink.length > 0 && shrink.every((x) => /> a:has\(> svg\.tt-tab-ico\)$/.test(x.s)), shrink.map((x) => x.s).join(' | '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
