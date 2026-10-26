// The shape engine follows GlimStone's: three radius tokens, card, control and pill, which the
// shape setting moves together (round 20/12/pill, soft 8/5/5, square 0), stamped as
// data-cc-shape on <html>. What can quietly break it:
//   · a shape block that leaves a token out inherits the round number from bare html
//   · a literal radius or a min() cap that stays behind does not move with the setting
//   · a name saved before the three shapes (pill, rounded, circle) that no longer reads loses the choice
//   · the old variables or the circle class coming back beside the tokens
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
// Every declaration in a sheet with the selector it belongs to.
function decls(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}' || ch === ';') {
      if (buf.trim()) out.push({ sel: stack[stack.length - 1] || '', decl: buf.trim().replace(/\s+/g, ' ') });
      if (ch === '}') stack.pop();
      buf = '';
    } else buf += ch;
  }
  return out;
}

// A radius reads one of the three tokens, or a calc() of one for a part drawn inside a control
// (a colour swatch inside its field, a text highlight). 0 and inherit are not shapes.
const TOKEN = /^(var\(--cc-radius-(card|control|pill)\)|calc\(var\(--cc-radius-(card|control|pill)\) \/ \d\)|0|0px|inherit)$/;
// The round things that have to stay round in every shape, being dots, rings or a photo:
// GlimStone keeps the colour picker's dot at 50% for the same reason.
const ROUND = [
  '.cc-ct-dotrow > .cc-badge', '.cc-tile-dot', '.cc-cfg', '.cc-ip-dot', '.cc-req::after', '#cc-ctout-status',
  '.cc-isl-dot', '.cc-nchan-loader', 'i.fa-circle.orb', '.cc-status-dot', '.cc-loader > span',
  '.cc-info:focus-visible', '.cc-acctinfo', '.cc-toolsinfo', '.popupAuthorIcon img', 'input[type="radio"]',
  '.inner > span.state.cc-badge', '.inner > i:is(.stopped, .paused)', '.cc-aop-ok::before', '.cc-dk-dot', '.cc-sn-ok', 'i[id^="check_"]',
];
function radiusOk(sel, value) {
  const v = value.replace(/\s*!important$/, '').trim();
  if (TOKEN.test(v)) return true;
  return v === '50%' && ROUND.some((r) => sel.includes(r));
}

console.log('\nThe detector itself');
ok('a token passes', radiusOk('.x', 'var(--cc-radius-pill) !important'));
ok('a calc of a token passes', radiusOk('.x', 'calc(var(--cc-radius-control) / 2)'));
ok('a literal fails', !radiusOk('.x', '6px'));
ok('a min() cap fails', !radiusOk('.x', 'min(var(--cc-radius-pill), 50%)'));
ok('50% on a dot passes', radiusOk('.cc-tile-dot', '50%'));
ok('50% on a badge fails', !radiusOk('.cc-b', '50%'));

console.log('\nThe three tokens, and every shape answers all three');
{
  const tokens = decls(read('sheets/TowerTorch.Tokens.css'));
  const block = (sel) => Object.fromEntries(tokens.filter((d) => d.sel === sel && /^--cc-radius-/.test(d.decl)).map((d) => d.decl.split(/:\s*/)));
  const want = {
    html: { '--cc-radius-card': '20px', '--cc-radius-control': '12px', '--cc-radius-pill': '9999px' },
    'html[data-cc-shape="soft"]': { '--cc-radius-card': '8px', '--cc-radius-control': '5px', '--cc-radius-pill': '5px' },
    'html[data-cc-shape="square"]': { '--cc-radius-card': '0px', '--cc-radius-control': '0px', '--cc-radius-pill': '0px' },
  };
  for (const [sel, vals] of Object.entries(want)) ok(sel + ' sets card, control and pill', JSON.stringify(block(sel)) === JSON.stringify(vals), JSON.stringify(block(sel)));
  ok('no rule keys on a round shape by name, round is the bare html', !/data-cc-shape="round"\]/.test(read('sheets/TowerTorch.Tokens.css')));
}

console.log('\nThe shape names, and the names from before them, in every copy');
{
  const theme = read('scripts/cc-theme.js'), header = read('scripts/header.js'), settings = read('scripts/settings.js');
  const copies = {
    'cc-theme.js': new Function(grabFn(theme, 'shapeName') + '\nreturn shapeName;')(),
    'header.js': new Function(grabFn(header, 'shapeName') + '\nreturn shapeName;')(),
    'settings.js': new Function('window', grabFn(settings, 'shapeName') + '\nreturn shapeName;')({}),
  };
  const inline = /var shape = g\("cc\.badgeshape", "round"\);[^\n]*\n\s*r\.setAttribute\("data-cc-shape", ([^;]+)\);/.exec(read('TowerTorch.Header.page'));
  ok('the Header.page first paint stamps the shape', !!inline);
  if (inline) copies['Header.page'] = new Function('shape', 'return ' + inline[1] + ';');
  const want = { pill: 'round', rounded: 'soft', square: 'square', circle: 'round', round: 'round', soft: 'soft', leaf: 'round', '': 'round' };
  for (const [file, fn] of Object.entries(copies)) {
    const bad = Object.entries(want).filter(([v, s]) => fn(v) !== s).map(([v, s]) => `${v} -> ${fn(v)}, want ${s}`);
    ok(file + ' reads every stored value as its shape', bad.length === 0, bad.join(' | '));
  }
}

console.log('\nheader.js rewrites an old name once and stamps the shape');
{
  const header = read('scripts/header.js');
  const m = /var shp = g\("cc\.badgeshape", "round"\), shpName = shapeName\(shp\);[\s\S]*?root\.setAttribute\("data-cc-shape", shpName\);/.exec(header);
  ok('the stamp is found in apply()', !!m);
  const run = (stored) => {
    const store = {}; if (stored != null) store['cc.badgeshape'] = stored;
    const writes = [];
    const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { writes.push(k + '=' + v); store[k] = String(v); } };
    const attrs = {};
    const root = { setAttribute: (k, v) => { attrs[k] = v; } };
    const g = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : v; };
    new Function('g', 'localStorage', 'root', 'window', grabFn(header, 'shapeName') + '\n' + grabFn(header, 'syncedSet') + '\n' + m[0])(g, localStorage, root, {});
    return { attr: attrs['data-cc-shape'], writes, stored: store['cc.badgeshape'] };
  };
  if (m) {
    for (const [old, name] of [['pill', 'round'], ['rounded', 'soft'], ['circle', 'round']]) {
      const r = run(old);
      ok(`"${old}" stamps ${name} and is stored as ${name}`, r.attr === name && r.stored === name && r.writes.length === 1, JSON.stringify(r));
    }
    for (const name of ['round', 'soft', 'square']) {
      const r = run(name);
      ok(`"${name}" is left alone`, r.attr === name && r.writes.length === 0, JSON.stringify(r));
    }
    const unset = run(null);
    ok('unset stamps round and writes nothing', unset.attr === 'round' && unset.writes.length === 0, JSON.stringify(unset));
  }
}

console.log('\nThe settings picker offers the three shapes');
{
  const settings = read('scripts/settings.js');
  ok('round, soft and square, as Rund, Weich and Eckig', /\[\["round", T\("Rund", "Round"\), "IconCornerRound"\], \["soft", T\("Weich", "Soft"\), "IconCornerSoft"\], \["square", T\("Eckig", "Square"\), "IconCornerSquare"\]\]/.test(settings));
  ok('circle is no longer offered', !/\["circle",/.test(settings));
  ok('the picker shows the stored shape, old names included', /shapeName\(get\("cc\.badgeshape", "round"\)\), function \(v\) \{ set\("cc\.badgeshape", v\); applyShape\(\);/.test(settings));
  ok('a change stamps the attribute at once', /function applyShape\(\) \{ document\.documentElement\.setAttribute\("data-cc-shape", shapeName\(get\("cc\.badgeshape", "round"\)\)\); \}/.test(settings));
}

console.log('\nThe engine mirror renames the old shapes too');
{
  const store = fs.readFileSync(path.join(__dirname, '..', '..', 'internal', 'store', 'store.go'), 'utf8');
  ok('LoadConfig renames pill, rounded and circle', /"cc\.badgeshape":\s*\{"pill": "round", "rounded": "soft", "circle": "round"\}/.test(store));
}

console.log('\nNothing reads the old variables or the circle class');
for (const f of files(DIR, ['.css', '.js', '.page'])) {
  const src = fs.readFileSync(f, 'utf8');
  const left = src.match(/--cc-b-radius|--cc-dot-r\b|--cc-r-[123]\b|cc-shape-circle/g);
  ok(path.basename(f) + ': none left', !left, left && [...new Set(left)].join(' '));
}

console.log('\nEvery radius in a sheet reads a token');
for (const f of files(DIR, ['.css'])) {
  const bad = decls(fs.readFileSync(f, 'utf8'))
    .filter((d) => /^border(-(top|bottom)-(left|right))?-radius\s*:/.test(d.decl))
    .filter((d) => !radiusOk(d.sel, d.decl.replace(/^[^:]+:\s*/, '')))
    .map((d) => d.sel.slice(0, 60) + ' { ' + d.decl + ' }');
  ok(path.basename(f) + ': no literal radius or cap', bad.length === 0, bad.slice(0, 5).join(' | '));
}

console.log('\nEvery radius a script writes reads a token');
for (const f of files(path.join(DIR, 'scripts'), ['.js'])) {
  const src = fs.readFileSync(f, 'utf8');
  const bad = [];
  // radii inside CSS text, as cssText or an injected sheet
  for (const m of src.matchAll(/border-radius\s*:\s*([^;"'}]*)/g)) {
    const v = m[1].trim();
    // the iframe sheet in header.js writes the parent's token values in, read just above it
    if (v === '' && /^border-radius\s*:\s*" \+ r(Ctl|Pill) \+ "/.test(src.slice(m.index))) continue;
    if (!radiusOk('', v)) bad.push(m[0]);
  }
  for (const m of src.matchAll(/setProperty\("border-radius", "([^"]*)"/g)) if (!radiusOk('', m[1])) bad.push(m[0]);
  ok(path.basename(f) + ': every written radius is a token', bad.length === 0, bad.slice(0, 4).join(' | '));
}
{
  const header = read('scripts/header.js');
  ok('the iframe sheet reads the control and pill tokens off the page', /rCtl = tok\("--cc-radius-control", "12px"\), rPill = tok\("--cc-radius-pill", "9999px"\)/.test(header));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
