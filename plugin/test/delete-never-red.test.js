// A delete is never painted red. The badge or button that removes something takes
// the colour its siblings take, and the confirmation says what is at stake, which a
// colour cannot say better (GlimStone, "Destructive and confirmable actions").
//
// This walks every rule that styles a delete control in TowerTorch's sheets and in the
// styles settings.js injects, and fails on the fault token or a red literal there.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function files(dir, exts) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p, exts));
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) { const out = []; const re = /([^{}]+)\{([^{}]*)\}/g; let m; while ((m = re.exec(clean(css)))) out.push([m[1].trim(), m[2]]); return out; }

const DELETE = /\.tt-b-del\b|\.tt-b-delicon|\.tt-sched-x|\.tt-notif-del|\.tt-prevapps-delbtn|\.multi_deleteButton|\.alternateViewClose|bg-destructive|from-unraid-red|\.tt-bulkbtn|doActions\(1,|input\[name="(reboot|shutdown)"\]|i\.fa-(remove|trash)/;
const RED = /var\(--tt-err\b|#(e5484d|d9433f|d9534f|ff6b6b|ff8a8a|5a2a2a|da1e28|ff8389)\b|rgba\(255, 107, 107/i;

console.log('\nThe detector catches a red delete and passes a sibling-coloured one');
ok('a fault-token delete is found', rules('.tt-b-del { background: var(--tt-err, #ff8389); }').some(([s, b]) => DELETE.test(s) && RED.test(b)));
ok('an accent delete is not', !rules('.tt-b-del { background: var(--tt-accent, #FCC419); }').some(([s, b]) => DELETE.test(s) && RED.test(b)));

console.log('\nNo rule paints a delete control red');
const sheets = files(DIR, ['.css']);
for (const f of sheets) {
  const hits = rules(fs.readFileSync(f, 'utf8')).filter(([s, b]) => DELETE.test(s) && RED.test(b)).map(([s]) => s.slice(0, 90));
  ok(path.basename(f), hits.length === 0, hits.join(' | '));
}
{
  // settings.js injects its own rules as JS strings, one per line
  const settings = read('scripts/settings.js');
  const injected = (settings.match(/"#tt-settings [^"]*"/g) || []).map((s) => s.slice(1, -1));
  const hits = injected.filter((r) => DELETE.test(r.split('{')[0]) && RED.test(r));
  ok('settings.js injected rules', hits.length === 0, hits.join(' | '));
  ok('"Reset all" is a plain .tt-btn like Export and Import', /labelled\(el\("span", "tt-btn tt-set-xbtn"\), "Refresh", T\("Alles zurücksetzen", "Reset all"\)\)/.test(settings));
  ok('the .tt-set-danger class is gone', !/tt-set-danger/.test(settings));
}

console.log('\nThe delete controls take their siblings\' colour');
{
  const docker = clean(read('styles/docker.css'));
  const del = /(^|\})\s*\.tt-b-del \{([^}]*)\}/.exec(docker);
  ok('.tt-b-del reads the row\'s colour chain', !!del && /background: var\(--tt-rb-c, var\(--tt-rbaccent, var\(--tt-accent,/.test(del[2]), del && del[2]);
  ok('with the matching ink', !!del && /color: var\(--tt-rb-ct, var\(--tt-rbaccent-text, var\(--tt-accent-text,/.test(del[2]));
  ok('the bulk Remove is an ordinary bulk button', !/tt-bulkbtn-danger/.test(docker) && !/tt-bulkbtn-danger/.test(read('scripts/docker.js')));
  ok('the icon-only delete draws no white background can, which would vanish on Sunflower', !/\.tt-b-delicon[^{]*\{[^}]*background-image/.test(docker));
  ok('its glyph is an SVG in currentColor', /\.tt-b-delicon svg \{/.test(docker) && /fill="currentColor"/.test(read('scripts/tt-theme.js')));
  const header = clean(read('sheets/TowerTorch.Header.css'));
  ok('the armed "Delete all" keeps the colour-mode fill', /\.tt-notif-del\.tt-notif-armed \{ background: var\(--tt-rb-c,/.test(header));
  ok('and its glyph follows the ink rather than a pinned white', !/\.tt-notif-del svg \{[^}]*#fff/.test(header));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
