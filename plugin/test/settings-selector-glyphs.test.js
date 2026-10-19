// Every choice of a selector on the settings page carries a small glyph before its label, as the
// settings of the other apps in the family do: GlimStone's drawing for that choice, named as in
// its glyphs.json. The temperature threshold offers a value of its own beside its presets.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = settings.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = settings.indexOf('{', i); k < settings.length; k++) { if (settings[k] === '{') d++; else if (settings[k] === '}') { d--; if (!d) return settings.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// The bracketed option list that starts at `from`, as text.
function listAt(from) {
  let d = 0;
  for (let k = from; k < settings.length; k++) { if (settings[k] === '[') d++; else if (settings[k] === ']') { d--; if (!d) return settings.slice(from, k + 1); } }
  return '';
}

const table = settings.slice(settings.indexOf('var SEG_GLYPHS = {'), settings.indexOf('\n  };', settings.indexOf('var SEG_GLYPHS = {')));
const glyphs = {};
for (const m of table.matchAll(/^\s+(Icon[A-Za-z]+): \["([^"]+)", '([^']+)'\]/gm)) glyphs[m[1]] = { box: m[2], svg: m[3] };

console.log('\nThe glyph set');
ok('it has glyphs', Object.keys(glyphs).length >= 30, Object.keys(glyphs).length);
const stroked = Object.keys(glyphs).filter((k) => /stroke|fill="none"/.test(glyphs[k].svg));
ok('every glyph is a filled shape', stroked.length === 0, stroked.join(' '));
const unsquare = Object.keys(glyphs).filter((k) => { const b = glyphs[k].box.split(' ').map(Number); return b.length !== 4 || b[2] !== b[3]; });
ok('every glyph keeps the square viewBox GlimStone crops to its ink', unsquare.length === 0, unsquare.join(' '));
ok('a glyph draws in its own viewBox on currentColor, hidden from a screen reader', /"viewBox", g\[0\]/.test(grabFn('segGlyph')) && /"fill", "currentColor"/.test(grabFn('segGlyph')) && /"aria-hidden", "true"/.test(grabFn('segGlyph')));
ok('motion and shape wear the Look settings glyphs the family shares', ['IconMotionOff', 'IconMotionSubtle', 'IconMotionWild', 'IconCornerRound', 'IconCornerSoft', 'IconCornerSquare'].every((n) => glyphs[n]));

console.log('\nEvery selector on the page names a glyph for each choice');
{
  const lists = [];
  // a row whose options live in a variable is picked up below
  for (const m of settings.matchAll(/(?:segRow|dropRow)\(T\("([^"]+)", "[^"]+"\),\s*\[\[/g)) lists.push({ name: m[1], text: listAt(m.index + m[0].length - 2) });
  for (const v of ['var modes = ', 'var opts = [["list"', 'var presets = ']) {
    const at = settings.indexOf(v);
    lists.push({ name: v, text: listAt(settings.indexOf('[[', at)) });
  }
  for (const p of ['modes.push(["flag"', 'opts.push(["folder"']) lists.push({ name: p, text: '[' + listAt(settings.indexOf('push(', settings.indexOf(p)) + 5) + ']' });
  const tuples = (txt) => [...txt.slice(1, -1).matchAll(/\[("[^"]*"), (?:T\([^)]*\)|"[^"]*")(?:, "(Icon[A-Za-z]+)")?\]/g)];
  const selectors = lists.filter((l) => tuples(l.text).length && tuples(l.text).length <= 6);
  ok('the selectors are found', selectors.length >= 12, selectors.map((l) => l.name).join(' | '));
  const bare = [];
  selectors.forEach((l) => tuples(l.text).forEach((t) => { if (!t[2] || !glyphs[t[2]]) bare.push(l.name + ' ' + t[1]); }));
  ok('every choice names a glyph the set has', bare.length === 0, bare.join(', '));
  const long = lists.filter((l) => tuples(l.text).length > 6);
  ok('a long list stays a dropdown without glyphs', long.every((l) => tuples(l.text).every((t) => !t[2])), long.map((l) => l.name).join(' '));
}

console.log('\nThe temperature threshold takes a value of its own');
{
  const valid = new Function('TEMP_MIN', 'TEMP_MAX', grabFn('tempWarnValid') + '\nreturn tempWarnValid;')(30, 110);
  ok('a value inside 30 to 110 °C is taken', valid('65') && valid('30') && valid('110'));
  ok('one outside it is not', !valid('29') && !valid('111') && !valid('0') && !valid('1000'));
  ok('nor is anything but a whole number', !valid('6.5') && !valid('') && !valid('abc') && !valid('-60'));
  const row = grabFn('tempWarnRow');
  ok('Eigene is the fourth choice, after the three presets', /presets\.concat\(\[\["custom", T\("Eigene", "Custom"\), "IconCustomValue"\]\]\)/.test(row));
  ok('a stored value that is no preset opens on Eigene with its field', /field\.hidden = isPreset\(stored\(\)\);/.test(row) && /field\.hidden \? stored\(\) : "custom"/.test(row));
  ok('a preset hides the field and stores the preset', /field\.hidden = v !== "custom";/.test(row) && /set\("cc\.tempwarn", v\); onChange\(\);/.test(row));
  ok('only a valid value is stored', /if \(ok\) \{ set\("cc\.tempwarn", String\(\+num\.value\)\); onChange\(\); \}/.test(row));
  ok('an invalid one says why and goes back to the stored value', /if \(tempWarnValid\(num\.value\)\) return;\s*failed\(num,/.test(row) && /num\.value = stored\(\);/.test(row));
  ok('the field stands right of the selector', /end\.appendChild\(row\.lastChild\); end\.appendChild\(field\);/.test(row));
  ok('the status island card uses it', /cI\.appendChild\(tempWarnRow\(syncHeaderBar\)\)/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
