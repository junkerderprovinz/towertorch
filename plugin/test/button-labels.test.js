// GlimStone's label engine on the Unraid buttons TowerTorch draws as badges: labels.js gives a
// button whose caption it knows a glyph and draws it as the button's own background layer, in one
// of four modes from cc.labels.buttons, and TowerTorch.Labels.css lays each mode out. What can
// quietly break it:
//   · a caption that names a glyph the set does not hold, which draws nothing
//   · an unknown caption getting some glyph anyway, which then says the wrong thing
//   · Unraid renaming a button through its value, which no observer sees
//   · a mode the setting offers that the sheet does not draw, or a rule that runs with theming off
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('not found: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + head);
}

const js = read('scripts/labels.js');
const css = read('sheets/TowerTorch.Labels.css');
const theme = read('scripts/cc-theme.js');
const settings = read('scripts/settings.js');

const BY_GLYPH = new Function('return ' + grab(js, 'var BY_GLYPH = ').slice('var BY_GLYPH = '.length))();
const GLYPHS = {};
Object.keys(BY_GLYPH).forEach((g) => BY_GLYPH[g].forEach((c) => { GLYPHS[c] = g; }));
const glyphFor = new Function('GLYPHS', grab(js, 'function glyphFor(') + '\nreturn glyphFor;')(GLYPHS);
const SET = (() => { const s = theme.indexOf('var GLYPHS = {'), e = theme.indexOf('\n  };', s); return new Function('return ' + theme.slice(s + 'var GLYPHS = '.length, e + 4) + ';')(); })();

console.log('\nEvery caption Unraid prints on these pages has its glyph');
{
  const CAPTIONS = ['Anwenden', 'Apply', 'Fertig', 'Done', 'Zurücksetzen', 'Reset', 'Löschen', 'Delete', 'Hinzufügen', 'Add',
    'Lesen', 'Read', 'Schreiben', 'Write', 'Aktualisieren', 'Update', 'Refresh', 'Starten', 'Start', 'Stoppen', 'Stop',
    'Neustart', 'Restart', 'Abbrechen', 'Cancel', 'Speichern', 'Save', 'Herunterladen', 'Download', 'Hochladen', 'Upload',
    'Prüfen', 'Check', 'Bearbeiten', 'Edit', 'Entfernen', 'Remove', 'Installieren', 'Install', 'Durchsuchen', 'Browse',
    'Kopieren', 'Copy', 'Verschieben', 'Move', 'Umbenennen', 'Rename', 'Alle berechnen', 'Compute All', 'Berechnen',
    'Compute', 'Aufräumen', 'Clean Up', 'Freigabe hinzufügen', 'Add Share', 'Benutzer hinzufügen', 'Add User',
    'Stopp', 'Verlauf', 'Platten anlaufen lassen', 'Platten anhalten', 'Neu starten', 'Herunterfahren', 'Standard',
    'Aufträge', 'Suche', 'Eigentümer', 'Berechtigung', 'Erstellen', 'Ändern', 'Alle starten', 'Alle stoppen',
    'VM hinzufügen', 'Container hinzufügen', 'Nach Aktualisierungen suchen', 'Alle aktualisieren', 'Pool löschen',
    'Anzeigen', 'Info', 'Neu laden', 'Protokoll leeren', 'Protokoll anzeigen', 'Alles auswählen', 'Alles abwählen'];
  const missing = CAPTIONS.filter((c) => !glyphFor(c));
  ok('each one finds a glyph', missing.length === 0, missing.join(', '));
  const unknown = Object.keys(BY_GLYPH).filter((g) => !SET[g]);
  ok('each glyph the map names is in the set cc-theme.js draws', unknown.length === 0, unknown.join(' '));
  const all = [].concat(...Object.values(BY_GLYPH));
  const twice = all.filter((c, i) => all.indexOf(c) !== i);
  ok('no caption stands under two glyphs', twice.length === 0, twice.join(', '));
  ok('the map is kept in lower case, which is how captions are looked up', all.every((c) => c === c.toLowerCase()));
  ok('Apply and Done, side by side on every form, wear different glyphs', glyphFor('Anwenden') !== glyphFor('Fertig'));
  ok('a caption is matched whatever its case and a trailing colon or dots', glyphFor('ANWENDEN') === 'Apply' && glyphFor('Fertig:') === 'Confirm' && glyphFor('Hinzufügen …') === 'Add');
}

console.log('\nClose meanings wear different glyphs');
{
  ok('a reset goes back to the default, a refresh tries again', glyphFor('Reset') === 'Refresh' && glyphFor('Standard') === 'Refresh' && glyphFor('Refresh') === 'Retry' && glyphFor('Neu laden') === 'Retry');
  ok('Read and Write take settings in and out, Upload and Download move files', glyphFor('Read') === 'Import' && glyphFor('Schreiben') === 'Export' && glyphFor('Upload') === 'Upload' && glyphFor('Herunterladen') === 'Download');
  ok('Check tests, Done agrees, Apply takes over, Save saves', glyphFor('Prüfen') === 'Check' && glyphFor('OK') === 'Confirm' && glyphFor('Übernehmen') === 'Apply' && glyphFor('Speichern') === 'Save');
  ok('Install, Update and Restore each wear their own', glyphFor('Installieren') === 'Install' && glyphFor('Update All') === 'Update' && glyphFor('Restore') === 'Restore');
  ok('emptying a list is not deleting it', glyphFor('Clear Log') === 'Empty' && glyphFor('Delete') === 'Trash');
}

console.log('\nAn unknown caption keeps its text');
{
  for (const c of ['Unbekannt', 'FireSquire', 'Apply Fix', 'Containergröße', 'Anwenden und mehr', '']) ok(JSON.stringify(c) + ' gets no glyph', glyphFor(c) === '');
  const sweep = grab(js, 'function sweep(');
  ok('only a caption with a glyph is stamped', /var name = m === "text" \? "" : glyphFor\(el\.ccLblCap\);\s*if \(!name\) continue;\s*stamp\(el, name, m\);/.test(sweep));
  ok('a button that loses its glyph lets go of every mark', /if \(keep\.indexOf\(el\) < 0\) unstamp\(el\);/.test(sweep) && /removeAttribute\("data-cc-lbl"\)/.test(grab(js, 'function unstamp(')));
}

console.log('\nThe glyph follows a caption change');
{
  // Unraid's chkDelete renames Apply to Delete by setting the value, which no observer reports.
  class Input { constructor(v) { this._v = v; this.tagName = 'INPUT'; } }
  Object.defineProperty(Input.prototype, 'value', { configurable: true, get() { return this._v; }, set(v) { this._v = String(v); } });
  let calls = 0;
  const make = new Function('HTMLInputElement', 'later',
    'var hooked = [];\n' + grab(js, 'function caption(') + '\n' +
    'var VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");\n' +
    grab(js, 'function hook(') + '\n' + grab(js, 'function unhookAll(') + '\nreturn { hook: hook, unhookAll: unhookAll };');
  const api = make(Input, () => { calls++; });
  const b = new Input('Anwenden'); b.ccLblCap = 'Anwenden';
  api.hook(b);
  b.value = 'Löschen';
  ok('setting the value asks for a pass', calls === 1, calls);
  ok('and the button reads its new value as before', b.value === 'Löschen' && b._v === 'Löschen');
  ok('the new caption has its own glyph', glyphFor(b.value) === 'Trash' && glyphFor('Anwenden') === 'Apply');
  calls = 0; b.ccLblCap = 'Löschen'; b.value = 'Löschen';
  ok('writing the same caption again asks for nothing', calls === 0, calls);
  api.unhookAll();
  ok('with the engine off the input is the browser\'s own again', !Object.getOwnPropertyDescriptor(b, 'value') && b.value === 'Löschen');
  const rel = grab(js, 'function relevant(');
  ok('a <button> renamed through its text is seen by the observer', /r\.type === "characterData"\) return !!\(t\.parentElement && t\.parentElement\.closest\(TEXTUAL\)\)/.test(rel) && /attributeFilter: \["value", "class", "style", "disabled", "hidden", "title"\]/.test(js));
  ok('a caption change measures the button again', /var key = \[el\.ccLblCap, epoch, el\.className, el\.ccLblShown\]\.join/.test(js));
}

console.log('\nThe button stays Unraid\'s control');
{
  ok('no element is added beside or inside a button: the glyph is its background layer', !/insertBefore|appendChild|insertAdjacent|\.innerHTML\s*=/.test(js) && /"background-image": "var\(--cc-lbl-img\)"/.test(js));
  ok('the accessible name is the caption: no aria-label is written and the value is never set', !/aria-label/.test(js) && !/\.value\s*=[^=]/.test(js.replace(/VALUE\.set\.call\(this, v\)/, '')));
  ok('the glyph is drawn in the button\'s own ink', /var ink = getComputedStyle\(el\)\.color;/.test(js) && /fill="' \+ ink \+ '"/.test(js));
  ok('padding another script set inline is kept and given back', /el\.ccLblPad = sh \?/.test(js) && /\(el\.ccLblPad \|\| \[\]\)\.forEach\(function \(d\) \{ el\.style\.setProperty\(d\[0\], d\[1\], d\[2\]\); \}\);/.test(js));
}

console.log('\nThe four modes');
{
  const lm = /\[\["text", T\("Text", "Text"\), "IconLabelText"\], \["textGlyph", T\("Text und Symbol", "Text and symbol"\), "IconLabelTextGlyph"\], \["glyph", T\("Symbol", "Symbol"\), "IconLabelGlyph"\], \["reactive", T\("Reaktiv", "Reactive"\), "IconLabelReactive"\]\]/;
  ok('the setting offers GlimStone\'s four, in its words', lm.test(settings));
  ok('it sits on the card after the main tabs\' icon and text switches', settings.indexOf('T("Beschriftungen", "Labels")') > settings.indexOf('T("Text anzeigen", "Show text")'));
  ok('glyph and text is the default, in the engine and on the settings page', /var v = get\(KEY, "textGlyph"\)/.test(js) && /get\("cc\.labels\.buttons", "textGlyph"\)/.test(settings));
  ok('the choice is a cc.* key, so the engine syncs it with the other settings', /var KEY = "cc\.labels\.buttons"/.test(js) && /\/\^cc\[a-z\]\*\\\.\//.test(theme));
  ok('a change redraws at once on this page and on every other open tab', /set\("cc\.labels\.buttons", v\); try \{ window\.ccLabelsApply && window\.ccLabelsApply\(\); \}/.test(settings) && /addEventListener\("storage"/.test(js));
  ok('text: nothing is stamped, so the buttons stay as the area sheets draw them', !/\[data-cc-labels-buttons="text"\]/.test(css) && /m === "text" \? ""/.test(js));
  ok('glyph and text: the caption moves over by the glyph and the gap',
    /--cc-lbl-ps: calc\(var\(--cc-lbl-pl\) \+ var\(--cc-lbl-gs\) \+ var\(--cc-lbl-gap\)\);/.test(css) && /--cc-lbl-bp: calc\(50% \+ \(var\(--cc-lbl-pl\) - var\(--cc-lbl-pr\) - var\(--cc-lbl-gap\) - var\(--cc-lbl-tw\)\) \/ 2\) center;/.test(css));
  ok('glyph: a square on the button\'s own height with the glyph at half of it',
    /\[data-cc-labels-buttons="glyph"\], \[data-cc-labels-buttons="reactive"\]\) \[data-cc-lbl\]:not\(\[data-cc-lbl-off\]\) \{\s*width: var\(--cc-lbl-h\) !important;/.test(css) && /--cc-lbl-bs: calc\(var\(--cc-lbl-h\) \/ 2\) calc\(var\(--cc-lbl-h\) \/ 2\);/.test(css));
  ok('the caption is only not painted, never removed', /-webkit-text-fill-color: transparent !important;/.test(css) && !/font-size/.test(css));
  ok('reactive: the words open under the pointer and on keyboard focus, never on a disabled button',
    /\[data-cc-labels-buttons="reactive"\] \[data-cc-lbl\]:not\(\[data-cc-lbl-off\]\):is\(:hover, :focus-visible\):not\(:disabled\) \{\s*width: var\(--cc-lbl-w\) !important; -webkit-text-fill-color: currentColor !important;/.test(css));
  ok('reactive opens on the motion engine and at once under reduced motion',
    /^html \{ --cc-motion-label-dur: 0s;/m.test(css) && /@media \(prefers-reduced-motion: no-preference\)/.test(css) && /html\[data-cc-motion="off"\] \{ --cc-motion-label-dur: 0s; \}/.test(css) && /transition: width var\(--cc-motion-label-dur\)/.test(css));
  ok('a measurement never replays the opening', /\[data-cc-lbl-still\] \{ transition: none !important; \}/.test(css) && /function settle\(/.test(js));
  ok('glyph mode puts the caption into the bubble, reactive only on a disabled button', /var want = m === "glyph" \|\| \(m === "reactive" && el\.disabled\);/.test(js));
}

console.log('\nThe off switch');
{
  const loose = [];
  for (const r of parseRules(css)) for (const s of r.selector.split(/,(?![^(]*\))/)) {
    const sel = s.trim();
    if (/^html(\[data-cc-motion="(subtle|off)"\])?$/.test(sel)) continue;   // the motion tokens, which draw nothing
    if (!/^html(\[data-cc-labels-buttons[^\]]*\]|:is\(\[data-cc-labels-buttons)/.test(sel)) loose.push(sel);
  }
  ok('every rule that draws starts at html[data-cc-labels-buttons]', loose.length === 0, loose.join(' | '));
  ok('labels.js sets that attribute only while theming is on', /function enabled\(\) \{ return get\("cc\.theming", "1"\) !== "0"/.test(js) && /var m = enabled\(\) \? mode\(\) : null;\s*if \(m\) \{[^}]*\} else root\.removeAttribute\(ATTR\);/.test(js));
  ok('and with theming off it takes back every mark and the value hooks', /if \(!m\) unhookAll\(\);/.test(js) && /PROPS\.forEach/.test(grab(js, 'function unstamp(')));
  const pg = read('TowerTorch.Labels.page');
  ok('the page hook loads the sheet by its basename and the script', /Menu="Buttons:\d+"/.test(pg) && /scripts\/labels\.js/.test(pg));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
