// Every glyph TowerTorch puts on a control of its own is a drawing from GlimStone's set
// (reference/glyphs.json, the "Icon glyphs" section), rendered as inline SVG by CCTheme.glyph.
// Unraid's and CA's own icons keep their Font Awesome, and so does the spinner in the process
// window, which matches the one Unraid shows over a busy container. What can quietly break it:
//   · a name asked for that the set does not hold, which renders an empty button
//   · a stroked drawing slipping in among the filled ones
//   · a viewBox that is not square, so one glyph reads smaller than its neighbours
//   · a script building a Font Awesome <i> of its own again
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const theme = read('scripts/cc-theme.js');
const start = theme.indexOf('var GLYPHS = {'), end = theme.indexOf('\n  };', start);
const GLYPHS = new Function('return ' + theme.slice(start + 'var GLYPHS = '.length, end + 4) + ';')();
const glyph = new Function('GLYPHS', /function glyph\(name\) \{[\s\S]*?\n  \}/.exec(theme)[0] + '\nreturn glyph;')(GLYPHS);

console.log('\nThe set');
{
  const names = Object.keys(GLYPHS);
  ok('cc-theme.js carries a set of drawings', names.length >= 20, names.length);
  for (const n of names) {
    const [vb, svg] = GLYPHS[n];
    const p = vb.split(/\s+/).map(Number);
    ok(n + ': a square viewBox cropped to the drawing', p.length === 4 && p.every((x) => !isNaN(x)) && Math.abs(p[2] - p[3]) < 1e-9, vb);
    ok(n + ': filled, never stroked', !/stroke/.test(svg) && !/fill="none"/.test(svg) && /^<(path|rect|circle)\b/.test(svg), svg.slice(0, 60));
  }
  const out = glyph('Play');
  ok('glyph() draws in currentColor, so a glyph takes its control\'s ink', /^<svg class="cc-glyph" viewBox="0\.01 0\.019 13\.981 13\.981" fill="currentColor"/.test(out), out.slice(0, 90));
  ok('and hides it from a screen reader, which reads the control\'s own name', /aria-hidden="true"/.test(out) && /focusable="false"/.test(out));
  ok('an unknown name draws nothing rather than a broken image', glyph('Nope') === '');
  ok('glyph() is published for the area scripts', /glyph: glyph,/.test(theme));
  const tokens = read('sheets/TowerTorch.Tokens.css');
  ok('a glyph is as tall as the text of what holds it', /\.cc-glyph \{[^}]*width: 1em; height: 1em;[^}]*fill: currentColor;/.test(tokens));
}

console.log('\nEvery name the scripts ask for is in the set');
{
  const files = ['scripts/docker.js', 'scripts/vms.js', 'scripts/header.js', 'scripts/settings.js', 'scripts/shares.js', 'scripts/cc-theme.js', 'scripts/sortreset.js'];
  const asked = new Map();
  const patterns = [
    /\b(?:ccGlyph|glyph|ccGlyphEl)\("([A-Za-z]+)"/g,
    /\bactBtn(?:Off)?\((?:[^"()]*\? )?"([A-Za-z]+)"(?: : "([A-Za-z]+)")?/g,
    /\bfolderActBtn\([^\n]*?, (?:hsOn \? )?"([A-Za-z]+)"(?: : "([A-Za-z]+)")?, t\(/g,
    /\bglyph: "([A-Za-z]+)"/g,
    /\[q\[\d+ \+ off\], [^\n]*?, "([A-Za-z]+)"\]/g,
  ];
  for (const f of files) {
    const src = read(f);
    for (const re of patterns) { let m; while ((m = re.exec(src))) for (const g of m.slice(1)) if (g) asked.set(g, (asked.get(g) || new Set()).add(path.basename(f))); }
  }
  ok('the scan finds the glyphs the rows ask for', ['Play', 'Stop', 'Pause', 'More', 'Trash', 'Log', 'Restore', 'Star', 'Warning'].every((n) => asked.has(n)), [...asked.keys()].join(' '));
  for (const [n, where] of asked) ok(n + ' (' + [...where].join(', ') + ') is in the set', n in GLYPHS);
}

// Starting and resuming are two meanings, so a paused container or VM never offers the start glyph.
console.log('\nResume and start wear their own glyphs');
{
  const docker = read('scripts/docker.js'), vms = read('scripts/vms.js');
  const resumes = [...docker.matchAll(/actBtn\("([A-Za-z]+)", t\("resume"\)/g), ...vms.matchAll(/actBtn\("([A-Za-z]+)", de \? "Fortsetzen"/g)].map((m) => m[1]);
  const starts = [...docker.matchAll(/actBtn\("([A-Za-z]+)", t\("start"\)/g), ...vms.matchAll(/actBtn\("([A-Za-z]+)", de \? "Starten"/g)].map((m) => m[1]);
  ok('every resume button wears Resume', resumes.length >= 3 && resumes.every((g) => g === 'Resume'), resumes.join(' '));
  ok('every start button wears Play', starts.length >= 2 && starts.every((g) => g === 'Play'), starts.join(' '));
  ok('in the "Alle Container" menu too', /\["startAll", "bulkStartAll", "Play"\]/.test(docker) && /\["resumeAll", "bulkResumeAll", "Resume"\]/.test(docker));
  ok('Resume is in the set', 'Resume' in GLYPHS);
}

console.log('\nNo script builds a Font Awesome glyph of its own');
{
  for (const f of ['scripts/docker.js', 'scripts/vms.js', 'scripts/header.js', 'scripts/settings.js', 'scripts/shares.js', 'scripts/plugins.js', 'scripts/settingsgrid.js', 'scripts/favorites.js']) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
    const hits = code.split('\n').filter((l) => /["']fa fa-|className = ["']fa\b|\(["']i["'], ["']fa\b|class=["']fa\b/.test(l));
    ok(path.basename(f) + ': no <i class="fa ..."> is created', hits.length === 0, hits.map((l) => l.trim().slice(0, 90)).join(' | '));
  }
  const tokens = read('sheets/TowerTorch.Tokens.css');
  ok('CA\'s pin button wears GlimStone\'s Pin as a mask, not a Font Awesome codepoint', !/fontAwesome/i.test(tokens.replace(/\/\*[\s\S]*?\*\//g, '')) && /\.pinPopup::before \{[^}]*mask: url\("data:image\/svg\+xml;utf8,<svg [^"]*viewBox='2\.25 2\.5 15\.5 15\.5'><path d='M6 2\.5h8v2/.test(tokens));
  ok('the process window keeps the spinner that matches Unraid\'s', /\.cc-nchan-loader \.cc-nchan-fa \{/.test(read('sheets/TowerTorch.Header.css')));
}

// An emoji draws its own colours and shape, so it ignores the control's ink and every colour mode.
console.log('\nNo control wears an emoji');
{
  const docker = read('scripts/docker.js');
  ok('the move-to-folder button wears GlimStone\'s Folder', /btn\.innerHTML = ccGlyph\("Folder"\); btn\.setAttribute\("aria-label", t\("moveToFolder"\)\);/.test(docker));
  for (const f of ['scripts/docker.js', 'scripts/vms.js', 'scripts/header.js', 'scripts/settings.js', 'scripts/shares.js', 'scripts/plugins.js']) {
    const hits = read(f).split('\n').filter((l) => /el\("(button|span|a)", [^;]*"[^"]*[\u{1F300}-\u{1FAFF}]/u.test(l));
    ok(path.basename(f) + ': no emoji as a control\'s text', hits.length === 0, hits.map((l) => l.trim().slice(0, 90)).join(' | '));
  }
  // The text gear is a font's character, drawn in whatever shape and weight that font has.
  ok('the gear button wears GlimStone\'s Gear', /function makeGear\(extra\) \{[^\n]*g\.innerHTML = ccGlyph\("Gear"\);/.test(docker));
  ok('with a name of its own, since its picture is hidden from a screen reader', /function makeGear\(extra\) \{[^\n]*g\.setAttribute\("aria-label", tip\);/.test(docker));
  ok('so does the settings button in the gear menu', /var link = el\("a", "cc-btn cc-menu-settings"\); link\.innerHTML = ccGlyph\("Gear"\);/.test(docker));
  for (const f of ['scripts/docker.js', 'scripts/vms.js', 'scripts/header.js', 'scripts/settings.js', 'scripts/shares.js', 'scripts/plugins.js']) {
    const hits = read(f).split('\n').filter((l) => /"[^"\n]*⚙/.test(l));
    ok(path.basename(f) + ': no text gear in a string', hits.length === 0, hits.map((l) => l.trim().slice(0, 90)).join(' | '));
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
