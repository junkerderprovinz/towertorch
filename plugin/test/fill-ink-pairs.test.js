// Every fill reads a chain of colour tokens, and the ink on it has to read the matching
// chain, step for step: --tt-rb-c with --tt-rb-ct, --tt-rbaccent with --tt-rbaccent-text,
// --tt-accent with --tt-accent-text. Skipping a step pairs a fill with the ink of a
// different colour. In flag mode the shared --tt-rbaccent can be a red such as #D21034,
// whose ink is white, while the accent's ink is dark, so a fill of --tt-rbaccent with
// --tt-accent-text ink reads at 3.3:1.
const fs = require('fs');
const path = require('path');
const { DIR, PAGES, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The ink token for each fill token. A fill missing here has no ink of its own and is
// left alone.
function inkOf(v) {
  const fixed = { '--tt-rb-c': '--tt-rb-ct', '--tt-ok': '--tt-ok-fg', '--tt-warn': '--tt-warn-fg', '--tt-err': '--tt-err-fg', '--tt-info': '--tt-info-fg', '--tt-updall-bg': '--tt-updall-text' };
  if (fixed[v]) return fixed[v];
  if (/^--tt-rb-[a-z]+$/.test(v)) return v + '-t';
  if (/^--tt-([a-z]+-)?(accent|rbaccent)$/.test(v) && v !== '--tt-btn-accent') return v + '-text';
  return null;
}
const vars = (v) => (v.match(/var\(\s*(--[\w-]+)/g) || []).map((s) => s.replace(/var\(\s*/, ''));

function mismatches(rules) {
  const out = [];
  for (const r of rules) {
    const bg = r.decls.filter((d) => d.prop === 'background' || d.prop === 'background-color').pop();
    const ink = r.decls.filter((d) => d.prop === 'color').pop();
    if (!bg || !ink) continue;
    const fill = vars(bg.value).filter((v, i, a) => v !== a[i - 1]);
    if (!fill.length || !inkOf(fill[0])) continue;
    const want = fill.map(inkOf).filter(Boolean).join(' > ');
    const have = vars(ink.value).join(' > ');
    if (want !== have) out.push(r.selector.replace(/\s+/g, ' ').slice(0, 100) + '  [fill ' + fill.join(' > ') + ', ink ' + (have || ink.value) + ']');
  }
  return out;
}

console.log('\nThe detector');
ok('a skipped step is found', mismatches(parseRules('.a { background: var(--tt-rb-c, var(--tt-rbaccent, var(--tt-accent))); color: var(--tt-rb-ct, var(--tt-accent-text)); }')).length === 1);
ok('a matching chain passes', mismatches(parseRules('.a { background: var(--tt-rb-c, var(--tt-rbaccent, var(--tt-accent))); color: var(--tt-rb-ct, var(--tt-rbaccent-text, var(--tt-accent-text))); }')).length === 0);
ok('a state fill with a fixed white is found', mismatches(parseRules('.a { background: var(--tt-ok, #6fdc8c); color: #fff; }')).length === 1);
ok('a neutral fill is left alone', mismatches(parseRules('.a { background: var(--tt-chip); color: var(--tt-text-chip); }')).length === 0);

console.log('\nEvery sheet');
const settingsStyle = parseRules((fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8').match(/"#tt-settings [^"]*"/g) || []).map((s) => JSON.parse(s)).join('\n'));
for (const f of PAGES.docker) {
  const hits = mismatches(parseRules(fs.readFileSync(path.join(DIR, f), 'utf8')));
  ok(path.basename(f), hits.length === 0, '\n      ' + hits.join('\n      '));
}
{
  const hits = mismatches(settingsStyle);
  ok('the styles settings.js injects', hits.length === 0, '\n      ' + hits.join('\n      '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
