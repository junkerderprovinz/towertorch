// The bulk bar on the Apps page reads in German on a German page. Community Applications writes
// its button captions in English and rewrites the install button with the count on every pick,
// so header.js translates them on each pass and after each pick. TowerTorch's own delete prompt names
// the list the way the German sidebar does.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = header.match(/function ttAppsBulkDe\(v\) \{[\s\S]*?\n  \}/)[0];
const de = new Function('return ' + src)();

console.log('\nThe bulk bar captions');
ok('install with nothing picked', de('Install Selected Applications') === 'Ausgewählte installieren', de('Install Selected Applications'));
ok('update with nothing picked', de('Update Selected Applications') === 'Ausgewählte aktualisieren');
ok('one app picked', de('Install 1 Selected Application') === '1 App installieren', de('Install 1 Selected Application'));
ok('several apps picked', de('Update 3 Selected Applications') === '3 Apps aktualisieren', de('Update 3 Selected Applications'));
ok('select all on the page', de('Select all on page') === 'Alle auf der Seite auswählen');
ok('a caption it does not know is left alone', de('Auswahl zurücksetzen') === '' && de('Löschen') === '');

console.log('\nWhen the captions are translated');
const native = header.slice(header.indexOf('function ttAppsTranslateNative'), header.indexOf('function ttAppsRibbonRow'));
ok('only on a German page', native.indexOf('if (LANG !== "de") return;') >= 0 && native.indexOf('if (LANG !== "de") return;') < native.indexOf('ttAppsBulkDe('));
ok('again after a pick, since CA rewrites the caption then', /classList\.contains\("ca_multiselect"\)\) setTimeout\(ttAppsTranslateNative, 0\)/.test(header));
ok('and after a click in the bar itself', /closest\("\.multi_installDiv"\)\) setTimeout\(ttAppsTranslateNative, 0\)/.test(header));

console.log('\nTowerTorch\'s own delete prompt');
ok('names the list as the German sidebar does', header.includes('aus „Bisherige Apps“ entfernt') && !header.includes('aus „Previous Apps“'));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
