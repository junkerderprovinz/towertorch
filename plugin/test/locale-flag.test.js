// Pins header.js's ttLocaleCountry and ttLangLabel, which drive the flag on the
// Display-Settings "Sprache/Language" dropdown: the explicit locale to ISO-country
// map, the packs whose Unraid locale code is no country code at all, the blank
// locale defaulting to English, and the parenthetical being stripped on the locale
// select alone, with every other select's label left as it is.
//
// The flag is a bundled SVG that ttLangFlagImg writes as an <img>, which is DOM
// wiring and not tested here. Windows draws a regional-indicator emoji pair as two
// letters rather than a flag, so the ISO code is all that has to be right.
const fs = require('fs');
const path = require('path');
const HEADER = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local',
  'emhttp', 'plugins', 'towertorch', 'scripts', 'header.js');

const src = fs.readFileSync(HEADER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(name) {
  const i = src.indexOf('var ' + name + ' = {');
  if (i < 0) throw new Error('var not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1) + ';'; } }
  throw new Error('unbalanced var: ' + name);
}
const code = [grabVar('TT_LOCALE_COUNTRY'), grabFn('ttLocaleCountry'), grabFn('ttLangLabel')].join('\n');
const api = new Function(code + '\nreturn { ttLocaleCountry: ttLocaleCountry, ttLangLabel: ttLangLabel };')();

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nttLocaleCountry: packs whose Unraid locale code carries a real ISO country code');
{
  ok('de_DE -> de, Germany', api.ttLocaleCountry('de_DE') === 'de', api.ttLocaleCountry('de_DE'));
  ok('fr_FR -> fr, France', api.ttLocaleCountry('fr_FR') === 'fr', api.ttLocaleCountry('fr_FR'));
  ok('pt_BR -> br, the suffix winning over the pt_PT entry', api.ttLocaleCountry('pt_BR') === 'br', api.ttLocaleCountry('pt_BR'));
  ok('pt_PT -> pt, Portugal', api.ttLocaleCountry('pt_PT') === 'pt', api.ttLocaleCountry('pt_PT'));
  ok('a blank value, Unraid\'s default, -> gb', api.ttLocaleCountry('') === 'gb', api.ttLocaleCountry(''));
}

console.log('\nttLocaleCountry: packs whose code repeats the language instead of naming a territory');
{
  ok('da_DA -> dk, "DA" being no ISO territory', api.ttLocaleCountry('da_DA') === 'dk', api.ttLocaleCountry('da_DA'));
  ok('ja_JA -> jp, "JA" being no ISO territory', api.ttLocaleCountry('ja_JA') === 'jp', api.ttLocaleCountry('ja_JA'));
  ok('ko_KO -> kr, "KO" being no ISO territory', api.ttLocaleCountry('ko_KO') === 'kr', api.ttLocaleCountry('ko_KO'));
  ok('ar_AR -> sa, where the suffix alone would give Argentina', api.ttLocaleCountry('ar_AR') === 'sa', api.ttLocaleCountry('ar_AR'));
  ok('bn_BN -> bd, where the suffix alone would give Brunei', api.ttLocaleCountry('bn_BN') === 'bd', api.ttLocaleCountry('bn_BN'));
}

console.log('\nttLocaleCountry: a value not in the explicit map falls back to the country-suffix heuristic');
{
  ok('unlisted "xx_NL" falls back to its own suffix (nl)', api.ttLocaleCountry('xx_NL') === 'nl', api.ttLocaleCountry('xx_NL'));
  ok('malformed value with no suffix at all falls back to gb', api.ttLocaleCountry('not-a-locale') === 'gb', api.ttLocaleCountry('not-a-locale'));
}

console.log('\nttLangLabel touches the locale <select> alone');
{
  const localeSel = { name: 'locale' };
  const otherSel = { name: 'colview' };
  const deOpt = { value: 'de_DE', text: 'Deutsch (German)' };
  const plainOpt = { value: 'x', text: 'Some other option' };
  // The trailing parenthetical goes from Unraid's own option text as well, not
  // only from the entries the plugin adds. The flag is a separate <img>.
  ok('locale select: the trailing parenthetical is stripped, with no prefix added', api.ttLangLabel(localeSel, deOpt) === 'Deutsch', api.ttLangLabel(localeSel, deOpt));
  ok('another select: the label passes through with its parenthetical', api.ttLangLabel(otherSel, plainOpt) === 'Some other option', api.ttLangLabel(otherSel, plainOpt));
}

console.log(fail ? '\nFAIL  ' + fail + ' of ' + (pass + fail) : '\nOK  ' + pass + ' passed');
process.exit(fail ? 1 : 0);
