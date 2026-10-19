// Pins the "Badge-Farben übernehmen" toggle in settings.js's logoToggles().
//
// A picked tile or icon colour beats Rainbow's rotating colour, which
// icon-rainbow-priority.test.js pins, so this toggle is how an icon is made to
// follow Rainbow or the accent the way every other badge does. It is one master
// toggle, not one per control: the tint is a single SVG filter for the whole page,
// so a separately adopted tint could only pick one flat hue and every logo would
// come out the same colour. With it on, the logo tile follows the per-item rainbow
// stamp and the ink becomes the automatic contrast colour for that tile. It takes
// over the colours only: the Logo tiles and Tint icons switches keep deciding
// whether there is a tile and whether the icons are tinted.
//
// What this pins:
//  1. logoToggles() builds one toggle, wired to io.getAdopt() and io.setAdopt(),
//     above the Logo tiles row, leaving both colour pickers out while adopting
//     and keeping both switches, and builds neither toggle nor row when
//     io.hideAdoptRow is set.
//  2. Its three call sites, the global "Logos & Icons" card, the Docker card and
//     the generic per-area card from buildStyleCards(), wire real getters and
//     setters against the storage keys the other tile and icon controls
//     use, so a change to one cannot leave another dead. Only the global card
//     shows the row; the other two hide it and read the global key, which makes
//     adopting a global matter and leaves the per-area setAdopt() unreachable.
//
// It is a string-level pin: logoToggles() is a heavy DOM builder, the colour
// resolution behind the toggle is covered by the four icon-pipeline tests, and
// whether the row reaches the DOM is covered by adopt-rainbow-row-dom.test.js.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const SETTINGS = process.argv[2] || path.join(DIR, 'settings.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(SETTINGS, 'utf8');
// A copy with the comments blanked out, so one quoting a key name cannot satisfy
// an assertion.
const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');

function fnBody(name) {
  const i = code.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = code.indexOf('{', i); k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}') { d--; if (!d) return code.slice(i, k + 1); } }
  return null;
}

console.log('\nThe two-toggle keys are gone from settings.js');
ok('no reference to cc.icontintrainbow is left', !/icontintrainbow/.test(code));
ok('no reference to the per-control getters and setters is left', !/getBgRainbow|setBgRainbow|getTintRainbow|setTintRainbow/.test(code));

console.log('\nThe two switches are named for what they do, in both languages');
ok('no "Einfärben" string is left', !/Einfärben/.test(code));
ok('no "Colourise" string is left', !/Colourise/.test(code));
ok('the tint row reads "Icons einfärben"', /T\("Icons einfärben", "Tint icons"\)/.test(code));
ok('the tile row reads "Logo-Kacheln"', /T\("Logo-Kacheln", "Logo tiles"\)/.test(code));
ok('no switch is called "Hintergrund" any more', !/T\("Hintergrund", "Background"\)/.test(code));

console.log('\nlogoToggles(): one adopt toggle above both colour pickers, none when hidden');
{
  const lt = fnBody('logoToggles');
  ok('logoToggles() is found in source', !!lt);
  const body = lt || '';
  ok('reads io.getAdopt() to seed the master toggle', /io\.getAdopt\(\)/.test(body));
  ok('writes io.setAdopt(v) on change', /io\.setAdopt\(v\)/.test(body));
  ok('the German label appears once, so there is one toggle', (body.match(/T\("Badge-Farben übernehmen"/g) || []).length === 1);
  ok('the English label appears once', (body.match(/, "Use the badge colours"\)/g) || []).length === 1);
  ok('io.hideAdoptRow decides whether the toggle and row are built', /hideAdopt\s*=\s*!!io\.hideAdoptRow/.test(body));
  ok('adoptTg and adoptRow are built inside the !hideAdopt branch', /if \(!hideAdopt\) \{[\s\S]*adoptTg = toggle\(/.test(body));

  // The row goes into the card before bgRow, so the toggle sits above Hintergrund's
  // own row and both pickers, and only when it was built at all.
  const intoAppends = [...body.matchAll(/into\.appendChild\((\w+)\)/g)].map(m => m[1]);
  ok('the adopt row is appended into the card', intoAppends.includes('adoptRow'), intoAppends.join(','));
  ok('the append is guarded on the row having been built', /if \(adoptRow\) into\.appendChild\(adoptRow\)/.test(body));
  ok('the adopt row is appended first, above the two controls and their pickers', intoAppends[0] === 'adoptRow', intoAppends.join(','));
  ok('one adopt row exists, with no per-control rows left', intoAppends.filter(n => /Rb(Row)?$/i.test(n)).length === 0, intoAppends.join(','));

  // A control that has no effect is left out, the two switches as much as their
  // pickers, and one line says what decides instead.
  ok('sync() guards adoptTg._setOn, adoptTg being null when hidden', /if \(adoptTg\) adoptTg\._setOn/.test(body));
  ok('sync() never takes the switch rows out', !/(bgRow|tintRow)\.hidden/.test(body));
  ok('sync() leaves the tile colour out while adopting or while its switch is off', /bgColRow\.hidden = adopting \|\| !io\.getBg\(\);/.test(body));
  ok('sync() leaves the icon colour out while adopting or while its switch is off', /tintColRow\.hidden = adopting \|\| !io\.getTint\(\);/.test(body));
  ok('sync() shows the line that names what decides only while adopting, and only with a switch on', /lock\.hidden = !adopting \|\| \(!io\.getBg\(\) && !io\.getTint\(\)\);/.test(body));
  ok('sync() keeps the strength while the tint is on, adopting or not', /strRow\.hidden = !io\.getTint\(\);/.test(body));
  ok('no switch in the card is dimmed instead', !/_setDisabled|style\.opacity/.test(body));

  ok('the returned handle exposes adoptToggle', /adoptToggle: adoptTg/.test(body));
  ok('the returned handle carries no per-control toggle names', !/bgRainbowToggle|tintRainbowToggle/.test(body));
}

console.log('\nAll three logoToggles() call sites wire real getters and setters');
{
  // Each call site passes an io object, found by scanning from the call to the
  // balanced closing brace.
  function callSiteIoBody(fromIndex) {
    const open = code.indexOf('logoToggles(', fromIndex);
    if (open < 0) return null;
    const argsStart = code.indexOf('{', open);
    let d = 0;
    for (let k = argsStart; k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}') { d--; if (!d) return { body: code.slice(argsStart, k + 1), next: k }; } }
    return null;
  }

  const sites = [];
  // The scan starts after the function's own definition, whose header also contains
  // the text "logoToggles(".
  const def = fnBody('logoToggles');
  let cursor = def ? code.indexOf(def) + def.length : 0;
  for (let n = 0; n < 3; n++) {
    const hit = callSiteIoBody(cursor);
    if (!hit) break;
    sites.push(hit.body);
    cursor = hit.next + 1;
  }
  ok('logoToggles() is called three times', sites.length === 3, String(sites.length));

  const labels = ['global "Logos & Icons" card', 'Docker card', 'generic per-area card'];
  sites.forEach((body, i) => {
    ok(labels[i] + ': wires getAdopt', /getAdopt:/.test(body));
    ok(labels[i] + ': wires setAdopt', /setAdopt:/.test(body));
  });

  console.log('\n  the global card keeps the visible row, the other two hide it');
  ok(labels[0] + ': sets no hideAdoptRow', !/hideAdoptRow/.test(sites[0]), sites[0]);
  ok(labels[1] + ': sets hideAdoptRow: true', /hideAdoptRow:\s*true/.test(sites[1]), sites[1]);
  ok(labels[2] + ': sets hideAdoptRow: true', /hideAdoptRow:\s*true/.test(sites[2]), sites[2]);

  // All three read the global key, without the per-area gate, which is what makes
  // sync()'s dimming mean the same thing on every card.
  sites.forEach((body, i) => {
    ok(labels[i] + ': getAdopt reads the global cc.iconbgrainbow key', /getAdopt: function \(\) \{ return get\("cc\.iconbgrainbow", "0"\) === "1"; \}/.test(body), body);
  });
  // and marks the one-time tile step done, so a later flip never has its switches turned on
  const setsAdopt = /setAdopt: function \(v\) \{ set\("cc\.iconbgrainbow", v \? "1" : "0"\); set\("cc\.iconadoptsplit", "1"\); \}/;
  ok(labels[0] + ': setAdopt writes the global cc.iconbgrainbow key', setsAdopt.test(sites[0]), sites[0]);
  ok(labels[1] + ': setAdopt writes the global cc.iconbgrainbow key', setsAdopt.test(sites[1]), sites[1]);
  ok(labels[2] + ': setAdopt is a no-op, no UI reaching it', /setAdopt: function \(\) \{\}/.test(sites[2]), sites[2]);
  ok(labels[2] + ': setAdopt writes no area-local key', !/set\(P \+ "iconbgrainbow"/.test(sites[2]), sites[2]);

  // An area's own tile and icon colours stay its own; only whether they
  // follow rainbow is global, which the still-gated colour getters show.
  ok(labels[2] + ': getBgColor stays gated by ga()', /getBgColor: function \(\) \{ return ga\(\) \?/.test(sites[2]), sites[2]);
}

console.log('\nThe live preview follows the adopt state rather than the colour underneath it');
{
  // gpaint() on the global card, tintPrev() on the Docker card and tp() on the
  // generic one each build the object logoPreview().set() consumes. Each hands over the
  // adopt state, so the preview resolves the tile and the ink per logo as the area scripts
  // do, and leaves the tint to its own switch.
  ['gpaint', 'tintPrev', 'tp'].forEach(name => {
    const b = fnBody(name);
    ok(name + '() is found in source', !!b, name);
    ok(name + '() reads the master adopt state', /iconbgrainbow/.test(b || ''), name);
    ok(name + '() hands the adopt state to the preview', /adopt: (adopt9|get\("cc\.iconbgrainbow", "0"\) === "1")/.test(b || ''), name);
    ok(name + '() leaves the tint to its switch', !/tint: adopt9/.test(b || ''), name);
    ok(name + '() references no icontintrainbow key', !/icontintrainbow/.test(b || ''), name);
  });
  const tpBody = fnBody('tp') || '';
  ok('tp() reads cc.iconbgrainbow without the ga() gate, as the getAdopt above it does', /adopt: get\("cc\.iconbgrainbow", "0"\) === "1"/.test(tpBody), tpBody);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
