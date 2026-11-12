// A switch that is on draws its knob in the ink of the fill it sits on (GlimStone 4.4.0), not in
// white: on Sunflower a white knob reads 1.5:1. Every rule that moves a knob to its on position
// therefore paints it too. A switch that is off on the light themes keeps 3:1 against a card and
// against its own white knob.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const SHEETS = ['sheets', 'styles'].flatMap((d) => fs.readdirSync(path.join(DIR, d)).filter((f) => f.endsWith('.css')).map((f) => path.join(d, f)));
const KNOB = /(\.switch-button-button|\.tt-tgl-knob|\.tt-set-knob|checkbox[^,{]*:checked::(before|after)|\.tt-noswitch:checked::before|\.tt-cb:checked::before)/;
const ON = /(\.checked|:checked|\.tt-tgl-on|\.tt-set-toggle-on)/;

console.log('\nEvery knob that moves to its on position takes the fill\'s ink');
for (const rel of SHEETS) {
  const css = fs.readFileSync(path.join(DIR, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  const bare = [];
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), body = m[2];
    if (!KNOB.test(sel) || !ON.test(sel) || !/(^|;)\s*left:/.test(body)) continue;
    if (!/background(-color)?:\s*var\(--tt-[a-z-]*(ct|text)\b/.test(body)) bare.push(sel.replace(/\s+/g, ' ').slice(0, 90));
  }
  ok(rel, bare.length === 0, bare.join(' | '));
}

console.log('\nThe light themes\' off track');
const tokens = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const light = (/html\.Theme--white,\s*html\.Theme--azure\s*\{([^}]*)\}/.exec(tokens) || [])[1] || '';
const off = (/--tt-toggle-track-off:\s*(#[0-9a-f]{6})/i.exec(light) || [])[1] || '';
ok('is #8d8d8d', off.toLowerCase() === '#8d8d8d', off);
ok('reads 3:1 against the white card', off && ratio(off, '#ffffff') >= 3, off && ratio(off, '#ffffff').toFixed(2));
ok('reads 3:1 against the inset card', off && ratio(off, '#f4f4f4') >= 3, off && ratio(off, '#f4f4f4').toFixed(2));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
