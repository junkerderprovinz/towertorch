// Every font size in TowerTorch reads one of five sizes, one per role (GlimStone,
// "The type scale"): 22 status, 16 title, 14 body, 13 sub-line, 12 meta. The badge
// stages name a role rather than a number, so a stage and the scale cannot drift apart.
//
// Picture sizes stay outside the scale on purpose: a logo or glyph tile sized with the
// tile, an icon glyph larger than text, and the two brand wordmarks. They are listed
// here by selector, so a new literal size anywhere else fails.
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
// comments go, their line breaks stay, so a failure names the real line
const clean = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
const TOKENS = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Tokens.css'), 'utf8');
const dark = (() => { let o = ''; const re = /(^|\})\s*html\s*\{([^}]*)\}/g; let m; while ((m = re.exec(clean(TOKENS)))) o += m[2]; return o; })();

// A value is on the scale when it is a scale token, a stage token, or no size at all.
const ON_SCALE = /^(var\(--cc-text-(status|title|body|subline|meta)\)|var\(--cc-(sm|md|lg|lgb|sec|pagebadge)-fs\)|0|inherit)$/;
const PICTURES = [
  /td\.ct-name \.outer > span\.hand i\.img \{/,                 // the container logo glyph, sized with its tile
  /var\(--cc-(logo-img|sg-glyph|fav-glyph|md-icon),/,           // logo and glyph tiles, the header icon size
  /#cc-brand( \.cc-brand-name)? \{/, /\.cc-set-brand \{/,       // the two wordmarks
  /\.cc-ud-ctrls\) a :is\(i, img, span\[class\*="icon"\]\) \{/, // Unassigned Devices' 20px control glyphs
  /table\.indexer i\[id\^="check_"\] \{/,                       // the file browser's checkbox glyph
  /width: 40px !important; height: 40px !important;/,           // a 40px icon button's glyph
  /::before \{ margin-right: 5px; font-size: \.82em;/,          // the state glyph, relative to its badge
];

function offScale(src) {
  const out = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const re = /font-size\s*:\s*([^;"'}!]+)/g; let m;
    while ((m = re.exec(line))) {
      const v = m[1].trim();
      if (ON_SCALE.test(v)) continue;
      // a rule's selector can sit a few lines above its declaration
      const ctx = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
      if (PICTURES.some((p) => p.test(ctx))) continue;
      out.push((i + 1) + ': ' + v);
    }
    const sp = /setProperty\("font-size",\s*"([^"]+)"/.exec(line);
    if (sp && !ON_SCALE.test(sp[1]) && !/^(lgImg|LOGO)$/.test(sp[1])) out.push((i + 1) + ': setProperty ' + sp[1]);
    const sh = /\bfont\s*:\s*([0-9.]+px)\//.exec(line);
    if (sh) out.push((i + 1) + ': font shorthand ' + sh[1]);
  });
  return out;
}

console.log('\nThe detector passes the scale and catches a literal');
ok('a scale token passes', offScale('a { font-size: var(--cc-text-body); }').length === 0);
ok('a stage token passes', offScale('a { font-size: var(--cc-md-fs) !important; }').length === 0);
ok('a literal fails', offScale('a { font-size: 15px; }').length === 1);
ok('a stage token with a literal fallback fails', offScale('a { font-size: var(--cc-md-fs, 13px); }').length === 1);
ok('a shorthand size fails', offScale('a { font: 13px/1.45 sans-serif; }').length === 1);

console.log('\nThe five sizes');
const SCALE = { status: '22px', title: '16px', body: '14px', subline: '13px', meta: '12px' };
for (const [role, px] of Object.entries(SCALE)) ok(`--cc-text-${role} is ${px}`, new RegExp(`--cc-text-${role}:\\s*${px};`).test(dark));

console.log('\nThe badge stages name a role');
const STAGES = { sm: 'meta', md: 'subline', lg: 'title', lgb: 'body', sec: 'meta', pagebadge: 'subline' };
for (const [stage, role] of Object.entries(STAGES)) ok(`--cc-${stage}-fs reads --cc-text-${role}`, new RegExp(`--cc-${stage}-fs:\\s*var\\(--cc-text-${role}\\);`).test(dark));

console.log('\nNo font size off the scale');
for (const f of files(DIR, ['.css', '.js'])) {
  const src = fs.readFileSync(f, 'utf8');
  const hits = offScale(f.endsWith('.css') ? clean(src) : clean(src).replace(/(^|\s)\/\/.*$/gm, '$1'));
  ok(path.basename(f), hits.length === 0, hits.slice(0, 8).join(' | '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
