// The container form follows the house rules on Unraid's own markup: nothing unfolds in place, the
// row buttons rest out of sight and the going-ahead action stands on the right. What can quietly
// break it:
//   · the hidden paths and ports staying behind their fold
//   · the allocations unfolding in place again, or staying in the window once it closes
//   · Apply losing its place on the right, or a second filled button in the row
//   · uppercase labels, the Aus/An word beside a switch, square CPU boxes
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const js = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nNothing unfolds in place');
const unfold = grab('ctUnfold');
ok('ctApply runs it on every pass', /ctVarLabels\(\);[^\n]*\n\s*ctUnfold\(\);/.test(js));
ok('the hidden paths and ports are opened through Unraid\'s own toggle', /window\.toggleReadmore\(\)/.test(unfold) && /classList\.add\("cc-ct-foldrow"\)/.test(unfold));
ok('only once, so a second pass does not fold them again', /if \(rm && !rm\.hasAttribute\("data-cc-open"\)\)/.test(unfold));
ok('and the row that unfolded them goes', /#canvas dl\.cc-ct-foldrow \{ display: none !important; \}/.test(css));
ok('the allocations open in a CC window', /window\.CCTheme\.modal\(win/.test(unfold) && /el\("div", "cc-win cc-dlg cc-ct-allocwin"\)/.test(unfold));
ok('the link says what it opens with the show glyph, without a chevron or an ellipsis', /ccLabelled\(a, "Eye", LANG === "de" \? "Docker-Zuweisungen" : "Docker allocations"\);/.test(unfold));
ok('the list goes back where it was when the window closes', /home\.insertBefore\(list, next\)/.test(unfold) && /list\.style\.display = "none"/.test(unfold));
ok('ahead of Unraid\'s own onclick, which would unfold it', /at\.addEventListener\("click", [^\n]*, true\)/.test(unfold));

console.log('\nThe buttons');
ok('labels in sentence case', /#canvas button:not\(\[role="tab"\]\),\nhtml\.cc-docker-on\.cc-on-addct \.ui-dialog \.ui-dialog-buttonpane button \{[^}]*text-transform: none !important;/.test(css));
ok('Done, Save, Apply from left to right', /> input\[type="button"\] \{ order: 1; \}/.test(css) && /> button\[name="dryRun"\] \{ order: 2; \}/.test(css) && /> input\[type="submit"\] \{ order: 3; \}/.test(css));
ok('Save rests neutral, so Apply is the one filled button', /#canvas form button\[name="dryRun"\],\nhtml[^{]*\.buttons-no-margin button \{ background: var\(--cc-surface-3/.test(css));
ok('a path\'s buttons come in on hover and focus', /\.buttons-no-margin button \{ opacity: 0;/.test(css) && /dl:is\(:hover, :focus-within\) > dd \.buttons-no-margin button \{ opacity: 1; \}/.test(css) && /@media \(hover: none\) \{[^}]*\.buttons-no-margin button \{ opacity: 1; \}/.test(css));
ok('a form switch keeps its Aus/An word for a screen reader only', /#canvas form dl > dd \.switch-button-label \{\s*position: absolute !important;[^}]*clip-path: inset\(50%\)/.test(css));
ok('a CPU core is the round selection mark with the shared tick', /label\.checkbox \.checkmark \{[^}]*border-radius: var\(--cc-radius-pill\)/.test(css) && /input:checked ~ \.checkmark::after \{[^}]*mask: var\(--cc-tick-mask\)/.test(css));
ok('the categories text starts where every field\'s does', /#ddcl-catSelect > \.ui-dropdownchecklist-selector \{[^}]*padding: 0 10px !important;[^}]*align-items: center !important;/.test(css) && /#ddcl-catSelect \.ui-dropdownchecklist-text \{[^}]*padding: 0 !important;/.test(css));
ok('at phone width the title and the view switch take a line each', /@media \(max-width: 600px\) \{\n  html\.cc-docker-on\.cc-on-addct div\.title \{ flex-wrap: wrap;/.test(css));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
