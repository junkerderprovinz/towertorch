// Every setting on TowerTorch's settings page carries an (i) whose bubble says what it does
// (GlimStone rule 8), the page starts without a heading (rule 30), it sets its text in Unraid's own
// face, and at phone width a row's control moves under its name instead of pushing the page
// sideways.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// The top-level arguments of every call to fn, read with strings and brackets balanced.
function calls(fn) {
  const out = [], re = new RegExp('(^|[^\\w.])' + fn + '\\(', 'g');
  let m;
  while ((m = re.exec(settings))) {
    if (/function\s*$/.test(settings.slice(Math.max(0, m.index - 10), m.index + m[1].length))) continue;
    const args = []; let depth = 0, q = null, cur = '', k = m.index + m[0].length;
    for (; k < settings.length; k++) {
      const ch = settings[k];
      if (q) { cur += ch; if (ch === '\\') { cur += settings[++k]; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      if (ch === ')' || ch === ']' || ch === '}') { if (!depth) break; depth--; }
      if (ch === ',' && !depth) { args.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    args.push(cur.trim());
    out.push({ at: settings.slice(0, m.index).split('\n').length, args });
  }
  return out;
}
const blank = (a) => !a || a === 'null' || a === 'undefined' || a === '""';

console.log('\nEvery row helper is handed its explanation');
for (const [fn, idx] of [['toggleRow', 1], ['inlineRow', 1], ['lockRow', 4], ['dropRow', 4], ['segRow', 4], ['fieldRow', 1]]) {
  const missing = calls(fn).filter((c) => blank(c.args[idx]));
  ok(fn + ' always gets a help text', calls(fn).length > 0 && !missing.length, missing.map((c) => 'line ' + c.at).join(', '));
}
ok('the shared switch row puts the (i) beside its name', /function inlineRow\(labelText, help, control\) \{[\s\S]*?lw\.appendChild\(infoIcon\(help\)\);/.test(settings));

console.log('\nThe rows built by hand carry one too');
{
  const areas = /\[\s*\["tt\.enable\.main"[\s\S]*?\]\.forEach/.exec(settings)[0];
  const rows = [...areas.matchAll(/\["(tt\.enable\.\w+)", T\("[^"]+", "[^"]+"\), "[01]"(, T\("[^"]+", "[^"]+"\))?\]/g)];
  ok('every area switch but the favourites has its sentence', rows.length === 8 && rows.every((r) => r[1] === 'tt.enable.favorites' || r[2]), rows.filter((r) => !r[2]).map((r) => r[1]).join(' '));
  ok('the favourites rows build their own (i)', (/var natRow[\s\S]*?nlw\.appendChild\(infoIcon\(/.test(settings)) && /lw\.appendChild\(infoIcon\(T\("Gestaltet den Favoriten-Tab/.test(settings));
  for (const [what, list] of [['status island', /\["uptime"[\s\S]*?\]\.forEach/], ['header icon', /\["lang"[\s\S]*?\]\.forEach/]]) {
    const body = list.exec(settings)[0], items = body.split('\n').filter((l) => /^\s*\["\w+"/.test(l));
    ok('every ' + what + ' switch has its sentence', items.length >= 8 && items.every((l) => (l.match(/T\(/g) || []).length === 2), items.length + ' rows');
  }
  const cols = /var COLS = \[([\s\S]*?)\];/.exec(settings)[1].split('\n').filter((l) => /key:/.test(l));
  ok('every column of the matrix has its sentence', cols.length === 13 && cols.every((l) => /help: T\(/.test(l)));
  ok('and the column name carries it', /el\("td", "tt-set-cname", c\.label\)\)\.appendChild\(infoIcon\(c\.help\)\)/.test(settings));
  ok('an area set apart says how it goes back', /T\("Dieser Bereich hat eine eigene Farbe/.test(settings));
  for (const lbl of ['Ausnahme hinzufügen", "Add an exception', 'Webhook-URL", "Webhook URL', 'Schnittstelle", "Interface']) {
    const i = settings.indexOf('"tt-set-rl", T("' + lbl + '")');
    ok(lbl.split('"')[0] + ' has its (i)', i > 0 && /infoIcon\(/.test(settings.slice(i, i + 400)));
  }
}

console.log('\nA lock line reads as a pointer, not as a choice');
for (const c of calls('lockRow')) {
  ok('line ' + c.at + ' names what decides and offers to go there', /^T\("(Folgt|Übermalt|Liste)/.test(c.args[1]) && /^T\("Zu[ m]/.test(c.args[2]), c.args[1] + ' / ' + c.args[2]);
}

console.log('\nEveryday words on the selectors');
ok('the badge style is Flach and Glas', /\["flat", T\("Flach", "Flat"\), "IconBadgeFlat"\], \["glass", T\("Glas", "Glass"\), "IconBadgeGlass"\]/.test(settings));
ok('the icon colouring has no jargon', !/Ink-Flatten|Luminanz-Tint|Ink flatten|Luminance tint/.test(settings) && /T\("Nachzeichnen", "Redraw"\)/.test(settings) && /T\("Tönen", "Tone"\)/.test(settings));

console.log('\nThe page has no heading');
{
  const i = settings.indexOf('  function render() {'), top = settings.slice(i, settings.indexOf('var body = el("div", "tt-set-body")', i));
  ok('no logo, wordmark or claim above the tabs', !/tt-set-logo|tt-set-brand[^n]|tt-set-claim|Firepower/.test(top));
}

console.log('\nOne font and a phone-width page');
{
  const i = settings.indexOf('st.textContent ='), sheet = (settings.slice(i, settings.indexOf('document.head.appendChild(st)', i)).match(/"(?:[^"\\]|\\.)*"/g) || []).map((s) => JSON.parse(s)).join('\n');
  ok('the page takes the theme\'s face', /#tt-settings\{font-family:inherit\}/.test(sheet));
  const narrow = sheet.slice(sheet.indexOf('@media (max-width:1023px){'));
  ok('a row that is too narrow puts its control under its name, at the row\'s end', /\.tt-set-row\.tt-set-inline\{flex-wrap:wrap;row-gap:8px\}/.test(narrow) && /\.tt-set-row\.tt-set-inline > :last-child\{margin-left:auto;max-width:100%\}/.test(narrow));
  ok('a selector wider than the card keeps to one row and lets its segments shrink', /\.tt-seg\.tt-set-mode\{display:flex;flex-wrap:nowrap/.test(narrow) && /\.tt-set-mode \.tt-seg-btn\{flex:1 1 auto;min-width:0\}/.test(narrow));
  ok('so do the buttons at a row\'s end and the swatches', /\.tt-set-colend\{flex-wrap:wrap/.test(narrow) && /\.tt-set-swatches\.tt-fill\{flex-wrap:wrap\}/.test(narrow) && /\.tt-set-fieldrow\{flex-wrap:wrap/.test(narrow));
  ok('the narrow rules come last, after the selector\'s own grid', sheet.lastIndexOf('display:inline-grid') < sheet.indexOf('@media (max-width:1023px){'));
}

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
