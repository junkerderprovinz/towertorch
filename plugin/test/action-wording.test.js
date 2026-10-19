// GlimStone rule 23 and its Wording section: an action never ends in an ellipsis (progress texts
// and placeholders keep theirs), one thing has one name, and the start plan's run states are shown
// in the interface language rather than as the engine's raw word.
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
const docker = read('scripts/docker.js'), settings = read('scripts/settings.js'), header = read('scripts/header.js');

console.log('\nNo action ends in an ellipsis');
{
  // Every T("de", "en") pair, and every value of docker.js's own dictionary, that ends in one.
  const pairs = (src) => [...src.matchAll(/T\("((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)"\)/g)].map((m) => [m[1], m[2]]);
  const trailing = (s) => /(…|\.\.\.)\s*$/.test(s);
  // progress texts and field placeholders, which keep theirs
  const KEEP = new Set(['Einstellungen durchsuchen …', 'Search settings …', 'Suchen…', 'Search…', 'Prüfe …', 'Checking …', 'Lade Versionshinweise …', 'Loading the release notes …', 'Läuft…', 'Working…', 'Seite oder Aktion suchen…', 'Search a page or action…']);
  for (const [name, src] of [['settings.js', settings], ['header.js', header]]) {
    const bad = pairs(src).flat().filter((s) => trailing(s) && !KEEP.has(s));
    ok(name + ' has no action with an ellipsis', bad.length === 0, bad.join(' | '));
  }
  const dict = docker.slice(docker.indexOf('  var T = {'), docker.indexOf('  function t(k)'));
  const dictBad = [...dict.matchAll(/(\w+): "((?:[^"\\]|\\.)*)"/g)].filter((m) => trailing(m[2]) && !['filter', 'saving'].includes(m[1])).map((m) => m[1] + ': ' + m[2]);
  ok('docker.js keeps an ellipsis only on its filter placeholder and its saving note', dictBad.length === 0, dictBad.join(' | '));
  ok('the settings button in the gear menu has none', /LANG === "de" \? "Einstellungen" : "Settings"/.test(docker));
  ok('the categories list closes with a plain Close', /explicitClose: T\("Schließen", "Close"\)/.test(header));
}

console.log('\nOne name per thing');
{
  ok('the start plan is the start plan in English too', /plan: "Start plan"/.test(docker) && /en: "Start plan" \}/.test(docker) && /T\("Startplan", "Start plan"\)/.test(settings));
  ok('no English label calls it just "Plan"', !/"Plan"/.test(docker) && !/"Plan"/.test(settings));
  ok('its save button says what it saves', /save: "Startplan speichern"/.test(docker) && /save: "Save start plan"/.test(docker));
}

console.log('\nThe run state speaks the interface language');
{
  const labels = docker.slice(docker.indexOf('  var RUN_LABELS = {'), docker.indexOf('  function runLabel('));
  const run = (lang) => new Function('LANG', labels + '\n' + grabFn(docker, 'runLabel') + '\nreturn runLabel;')(lang);
  ok('German shows a German word', run('de')('failed') === 'fehlgeschlagen' && run('de')('skipped') === 'übersprungen');
  ok('English shows the English one', run('en')('degraded') === 'degraded');
  ok('every engine state has a German word', ['pending', 'starting', 'ready', 'degraded', 'failed', 'skipped'].every((s) => run('de')(s) !== s));
  ok('an unknown state falls back to itself', run('de')('mystery') === 'mystery');
  ok('the pill shows the label and keeps the raw state as its class', /el\("span", "cc-pill cc-pill-" \+ lr\.state, runLabel\(lr\.state\)\)/.test(grabFn(docker, 'lastRunPill')));
  ok('the dependency bubble uses the label too', /bad\.push\(d \+ " \(" \+ runLabel\(lr\.state\)/.test(docker));
}

console.log('\nThe two Docker views have one name each');
{
  ok('the action bar calls them Einfache and Erweiterte Ansicht', /"Einfache Ansicht"/.test(docker) && /"Erweiterte Ansicht"/.test(docker));
  ok('the badge matrix heads say Einfach and Erweitert in German, Basic and Advanced in English', /thc\(T\("Einfach", "Basic"\)\)/.test(settings) && /thc\(T\("Erweitert", "Advanced"\)\)/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
