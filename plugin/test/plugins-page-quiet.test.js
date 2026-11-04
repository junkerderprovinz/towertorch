// The Plugins tab shows "Auf dem neusten Stand" as its pill like the Docker tab, offers one delete
// per row, keeps its buttons secondary and fits a phone. What can quietly break it:
//   · "Auf dem neusten Stand" hidden instead of shown
//   · Unraid's update check showing the native remove button beside TowerTorch's trash, since it writes an
//     inline display over anything set inline
//   · uppercase labels from Unraid's input styling on the status and bar buttons
//   · the bar buttons filled in two colours at rest
//   · the description justified, the rows or the bar cut off at phone width
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const js = fs.readFileSync(path.join(DIR, 'scripts/plugins.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nThe status shows as a pill');
ok('an up-to-date plugin is painted ok green or in the colour mode', /if \(\/up\.to\.date[^\n]*\{ pill\(stEl, stNative \? "var\(--tt-ok, #6fdc8c\)" : palC/.test(js));
ok('and nothing hides it', !/tt-plug-ok/.test(js + css));
ok('an update still shows as its pill', /else if \(\/update\|aktualis\|install\/\.test\(t2\)[^\n]*pill\(stEl/.test(js));

console.log('\nOne delete per row');
ok('the native remove button is hidden by class', /rm\.classList\.add\("tt-rm-native"\);/.test(js) && !/rm\.style\.setProperty\("display", "none"/.test(js));
ok('which outlasts Unraid writing an inline display', /html\.tt-on-plugins input\.tt-b-del\.tt-rm-native[^{]*\{ display: none !important; \}/.test(css));

console.log('\nButtons');
ok('every pill reads in sentence case', /function pill\([\s\S]*?"text-transform", "none", "important"[\s\S]*?"letter-spacing", "normal", "important"/.test(js));
ok('the bar buttons are not uppercase any more', !/"text-transform", "uppercase"/.test(js));
ok('they rest grey and take their slot on hover', /input\.tt-plugbar-btn \{ background: var\(--tt-surface-3/.test(css) && /input\.tt-plugbar-btn:hover:not\(:disabled\) \{ background: var\(--tt-rb-c/.test(css) && /b2\.classList\.add\("tt-plugbar-btn"\)/.test(js));
ok('descriptions are set ragged', /html\.tt-on-plugins \.tt-desc, html\.tt-on-plugins \.tt-desc \* \{ text-align: start !important; \}/.test(css));

console.log('\nPhone width');
const narrow = /@media \(max-width: 600px\) \{\n  html\.tt-on-plugins nav\.tabs[\s\S]*?\n\}/.exec(css);
ok('the tab strip wraps instead of scrolling', narrow && /\.tabs-container \{ flex-wrap: wrap !important; overflow: visible !important;/.test(narrow[0]));
ok('each plugin row becomes a block of wrapping cells', narrow && /#plugin_list > tr \{ display: flex; flex-wrap: wrap;/.test(narrow[0]) && /td:nth-child\(-n\+2\) \{ flex: 1 0 100%; \}/.test(narrow[0]));
ok('the bar buttons drop into the flow under the tabs', /matchMedia\("\(max-width: 600px\)"\)/.test(js) && /strip\.parentNode\.insertBefore\(host, strip\.nextSibling\)/.test(js));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
