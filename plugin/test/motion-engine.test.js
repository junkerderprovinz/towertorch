// The motion engine follows GlimStone's: three levels, off, subtle and wild, subtle by
// default, stamped as data-cc-motion on <html> and read by the sheets. A level is a
// different number, never a different animation. What can quietly break it:
//   · a level block that leaves a dial out inherits the lively number from bare html
//   · a rule keyed on wild by name forgets the attribute before header.js stamps it
//   · a level rule outside the no-preference gate outranks the OS reduce-motion setting
//   · a saved digit from before the names (0, 1, 2) that no longer reads loses the choice
//   · the blanket "still everything" rules also still the toast and refusal stand-ins
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

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
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// Every rule in a sheet with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      stack.push(head);
    } else if (ch === '}') {
      const head = stack.pop();
      if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.filter((h) => h.startsWith('@media')).join(' ') });
      buf = '';
    } else buf += ch;
  }
  return out;
}

console.log('\nThe level names, and the digits from before them, in every copy');
{
  const theme = read('scripts/cc-theme.js'), header = read('scripts/header.js'), settings = read('scripts/settings.js');
  const page = read('TowerTorch.Header.page');
  const copies = {
    'cc-theme.js': new Function(grabFn(theme, 'motionLevel') + '\nreturn motionLevel;')(),
    'header.js': new Function(grabFn(header, 'motionLevel') + '\nreturn motionLevel;')(),
    'settings.js': new Function('window', grabFn(settings, 'motionLevel') + '\nreturn motionLevel;')({}),
  };
  const inline = /var anim = g\("cc\.anim", "subtle"\);[^\n]*\n\s*r\.setAttribute\("data-cc-motion", ([^;]+)\);/.exec(page);
  ok('the Header.page first paint stamps the level', !!inline);
  if (inline) copies['Header.page'] = new Function('anim', 'return ' + inline[1] + ';');
  const want = { '0': 'off', '1': 'subtle', '2': 'wild', off: 'off', subtle: 'subtle', wild: 'wild', storm: 'subtle', '': 'subtle', subtle2: 'subtle' };
  for (const [file, fn] of Object.entries(copies)) {
    const bad = Object.entries(want).filter(([v, l]) => fn(v) !== l).map(([v, l]) => `${v} -> ${fn(v)}, want ${l}`);
    ok(file + ' reads every stored value as its level', bad.length === 0, bad.join(' | '));
  }
}

console.log('\nheader.js rewrites a saved digit to its name, once');
{
  const header = read('scripts/header.js');
  const m = /var anim = g\("cc\.anim", "subtle"\), level = motionLevel\(anim\);[\s\S]*?root\.setAttribute\("data-cc-motion", level\);/.exec(header);
  ok('the stamp is found in apply()', !!m);
  const run = (stored) => {
    const store = {}; if (stored != null) store['cc.anim'] = stored;
    const writes = [];
    const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { writes.push(k + '=' + v); store[k] = String(v); } };
    const attrs = {};
    const root = { setAttribute: (k, v) => { attrs[k] = v; } };
    const g = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : v; };
    new Function('g', 'localStorage', 'root', 'window', grabFn(header, 'motionLevel') + '\n' + grabFn(header, 'syncedSet') + '\n' + m[0])(g, localStorage, root, {});
    return { attr: attrs['data-cc-motion'], writes, stored: store['cc.anim'] };
  };
  if (m) {
    for (const [d, n] of [['0', 'off'], ['1', 'subtle'], ['2', 'wild']]) {
      const r = run(d);
      ok(`"${d}" stamps ${n} and is stored as ${n}`, r.attr === n && r.stored === n && r.writes.length === 1, JSON.stringify(r));
    }
    const named = run('wild');
    ok('a name is left alone', named.attr === 'wild' && named.writes.length === 0, JSON.stringify(named));
    const unset = run(null);
    ok('unset stamps subtle and writes nothing', unset.attr === 'subtle' && unset.writes.length === 0, JSON.stringify(unset));
  }
}

console.log('\nThe settings picker offers the three names');
{
  const settings = read('scripts/settings.js');
  ok('off, subtle and wild are the values', /\[\["off", T\("Aus", "Off"\), "IconMotionOff"\], \["subtle", T\("Dezent", "Subtle"\), "IconMotionSubtle"\], \["wild", T\("Wild", "Wild"\), "IconMotionWild"\]\]/.test(settings));
  ok('the picker shows the stored level, digits included', /motionLevel\(get\("cc\.anim", "subtle"\)\),\s*function \(v\) \{ set\("cc\.anim", v\); applyAnim\(\); \}/.test(settings));
}

console.log('\nEvery level answers every dial');
{
  const tokens = rules(read('sheets/TowerTorch.Tokens.css'));
  const dials = (r) => (r ? (r.body.match(/--cc-motion-[a-z-]+(?=\s*:)/g) || []).sort() : []);
  const still = tokens.find((r) => r.sel === 'html' && !r.media && /--cc-motion-/.test(r.body));
  const lively = tokens.find((r) => r.sel === 'html' && /no-preference/.test(r.media) && /--cc-motion-/.test(r.body));
  const subtle = tokens.find((r) => r.sel === 'html[data-cc-motion="subtle"]' && /no-preference/.test(r.media));
  const off = tokens.find((r) => r.sel === 'html[data-cc-motion="off"]' && /no-preference/.test(r.media) && /--cc-motion-/.test(r.body));
  ok('the still numbers sit outside the gate', !!still);
  ok('the lively numbers, subtle and off sit inside the gate', !!(lively && subtle && off));
  const all = dials(still);
  ok('the still block names the dials', all.length >= 6, all.join(' '));
  for (const [name, r] of [['lively', lively], ['subtle', subtle], ['off', off]]) {
    ok(name + ' declares every dial', JSON.stringify(dials(r)) === JSON.stringify(all), dials(r).join(' ') + ' vs ' + all.join(' '));
  }
  const val = (r, d) => ((new RegExp(d + ':\\s*([^;]+);').exec(r ? r.body : '') || [])[1] || '').trim();
  ok('a press gives way to .97 at subtle and wild', val(subtle, '--cc-motion-press-scale') === '.97' && val(lively, '--cc-motion-press-scale') === '.97');
  ok('off and reduced motion press at 1', val(off, '--cc-motion-press-scale') === '1' && val(still, '--cc-motion-press-scale') === '1');
  ok('the shake runs 360ms', val(subtle, '--cc-motion-shake-dur') === '360ms' && val(lively, '--cc-motion-shake-dur') === '360ms');
  ok('the bubble fades in 110ms at subtle, the default', val(subtle, '--cc-motion-fade-dur') === '110ms');
}

console.log('\nNo rule names a lively level, and every level rule sits in the gate');
for (const f of files(DIR, ['.css', '.js', '.page'])) {
  const src = fs.readFileSync(f, 'utf8');
  const name = path.basename(f);
  ok(name + ': no cc-anim-* class is left', !/cc-anim-(on|off|wild)/.test(src));
  ok(name + ': no selector keys on wild by name', !/data-cc-motion="wild"\]/.test(src));
  if (!f.endsWith('.css')) continue;
  const loose = rules(src).filter((r) => /:not\(\[data-cc-motion="(subtle|off)"\]\)/.test(r.sel) && !/prefers-reduced-motion:\s*no-preference/.test(r.media));
  ok(name + ': every subtle or wild rule is inside the no-preference gate', loose.length === 0, loose.map((r) => r.sel.slice(0, 80)).join(' | '));
}

console.log('\nThe stills spare the toast and the refusal stand-ins');
{
  const header = rules(read('sheets/TowerTorch.Header.css'));
  const blanket = header.filter((r) => /animation(-duration)?\s*:\s*(none|\.001ms)/.test(r.body) && /(\[class\*="cc-"\]|#displaybox \*|html\.cc-header-on \*|\) \*)/.test(r.sel));
  ok('the blanket stills are found', blanket.length >= 3, String(blanket.length));
  const misses = [];
  for (const r of blanket) for (const part of r.sel.split(/,(?![^(]*\))/)) {
    const p = part.trim();
    if (/(\[class\*="cc-"\]|#displaybox \*|#header \*|#menu \*|html\.cc-header-on, html\.cc-popups-on, html\.cc-tools-on[^)]*\) \*)/.test(p) && !/:not\(\.cc-toast, \.cc-shake\)/.test(p)) misses.push(p);
  }
  ok('each blanket still excludes .cc-toast and .cc-shake', misses.length === 0, misses.slice(0, 4).join(' | '));
  const shakeStill = header.find((r) => r.sel === '.cc-shake' && !r.media);
  ok('outside the gate a refusal pulses its opacity', !!shakeStill && /cc-shake-still/.test(shakeStill.body));
  const shakeMove = header.find((r) => /\.cc-shake$/.test(r.sel) && /no-preference/.test(r.media));
  ok('inside the gate, below off, it shakes', !!shakeMove && /html:not\(\[data-cc-motion="off"\]\)/.test(shakeMove.sel) && /cc-shake var\(--cc-motion-shake-dur/.test(shakeMove.body));
  const toastStill = header.find((r) => r.sel === '.cc-toast' && !r.media);
  ok('outside the gate a toast fades in', !!toastStill && /cc-fade-in/.test(toastStill.body));
}

console.log('\nThe engine mirror names the digits too');
{
  const store = fs.readFileSync(path.join(__dirname, '..', '..', 'internal', 'store', 'store.go'), 'utf8');
  ok('LoadConfig renames cc.anim 0, 1 and 2', /"cc\.anim":\s*\{"0": "off", "1": "subtle", "2": "wild"\}/.test(store) && /renameUIValues\(c\.UISettings\)/.test(store));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
