// A bar that shows a fill level sloshes at its end (GlimStone, "Illustrations") once it is at least
// 12px tall: the end surges out leaning forward and draws back. A thinner bar stands still. Nothing runs past the end or pops, and no dots drift in the
// liquid. The motion setting sets how lively it is, and at "off" or under reduced motion the liquid
// rests level. What can quietly break it:
//   · a level that leaves a slosh dial out inherits the lively number
//   · an animation outside the no-preference gate keeps moving under reduced motion
//   · a bar drawn again every few seconds starts its swing over each time
//   · a MutationObserver that calls the stamp wakes itself if the stamp writes twice
//   · a thin bar that sloshes, where the surge only twitches
//   · a tall bar that loses the class
//   · bubbles that run past the end and pop coming back into a bar
//   · GlimStone's drifting dots coming back into the liquid
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const tokens = read('sheets/TowerTorch.Tokens.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.filter((h) => h.startsWith('@media')).join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const all = rules(tokens);

console.log('\nEvery level answers the slosh dials');
{
  const DIALS = ['dur', 'surge', 'lean'].map((d) => '--cc-motion-slosh-' + d);
  const block = (sel, gated) => all.find((r) => r.sel === sel && /--cc-motion-slosh-/.test(r.body) && (gated ? /no-preference/.test(r.media) : !r.media));
  const v = (r, d) => ((new RegExp(d + ':\\s*([^;]+);').exec(r ? r.body : '') || [])[1] || '').trim();
  const levels = { still: block('html', false), wild: block('html', true), subtle: block('html[data-cc-motion="subtle"]', true), off: block('html[data-cc-motion="off"]', true) };
  for (const [name, r] of Object.entries(levels)) ok(name + ' declares every slosh dial', !!r && DIALS.every((d) => v(r, d) !== ''), r ? DIALS.filter((d) => !v(r, d)).join(' ') : 'block missing');
  ok('wild swings in 3.6s with a 5px surge, as GlimStone\'s default', v(levels.wild, '--cc-motion-slosh-dur') === '3.6s' && v(levels.wild, '--cc-motion-slosh-surge') === '5px');
  ok('subtle swings in 5s with a 3.5px surge', v(levels.subtle, '--cc-motion-slosh-dur') === '5s' && v(levels.subtle, '--cc-motion-slosh-surge') === '3.5px');
  for (const n of ['still', 'off']) ok(n + ' rests level: no surge, no lean', v(levels[n], '--cc-motion-slosh-surge') === '0px' && v(levels[n], '--cc-motion-slosh-lean') === '0deg');
}

console.log('\nThe motion lives inside the gate');
{
  const anim = all.filter((r) => /cc-slosh/.test(r.sel) && /animation\s*:/.test(r.body) && !/animation:\s*none/.test(r.body));
  ok('the end animates', anim.some((r) => r.sel === '.cc-slosh-edge::after'));
  const loose = anim.filter((r) => !/prefers-reduced-motion:\s*no-preference/.test(r.media));
  ok('no slosh animation sits outside the no-preference gate', loose.length === 0, loose.map((r) => r.sel).join(' | '));
  ok('every one starts at the bar\'s phase', anim.every((r) => /var\(--cc-slosh-phase, 0s\)/.test(r.body)));
  const off = all.find((r) => /html\[data-cc-motion="off"\][^,]*cc-slosh/.test(r.sel) && /animation:\s*none/.test(r.body));
  ok('at "off" it stops outright', !!off && /::after/.test(off.sel));
  ok('no dots drift in the liquid', !all.some((r) => /cc-slosh-edge::before/.test(r.sel)) && !/cc-slosh-fizz|--cc-motion-slosh-bubble-/.test(tokens));
  const restEnd = all.find((r) => r.sel === '.cc-slosh-edge::after' && !r.media);
  ok('at rest the end lies under the fill', restEnd && /translate: calc\(-100% \* var\(--cc-dir-sign, 1\)\) 0/.test(restEnd.body));
  ok('its corners follow the shape engine', restEnd && /border-start-end-radius: var\(--cc-radius-pill\)/.test(restEnd.body));
  for (const k of ['cc-slosh-surge']) ok('@keyframes ' + k, new RegExp('@keyframes ' + k + ' \\{').test(tokens));
}

console.log('\nCCTheme.slosh stamps a fill once');
{
  let clock = 12345.6789;
  global.performance = { now: () => clock };
  class F {
    constructor(width, high) { this.high = high || 0; this.kids = []; this.cls = new Set(); this.props = {}; this.appends = 0; const self = this; this.style = { width: width === undefined ? '40%' : width, setProperty: (k, v) => { self.props[k] = v; self.writes = (self.writes || 0) + 1; }, removeProperty: (k) => { delete self.props[k]; } }; }
    get classList() { const c = this.cls; return { add: (x) => c.add(x), remove: (x) => c.delete(x), contains: (x) => c.has(x) }; }
    appendChild(c) { this.kids.push(c); this.appends++; return c; }
    getBoundingClientRect() { return { height: this.high }; }
  }
  const document = { createElement: () => ({ className: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }) };
  const theme = read('scripts/cc-theme.js');
  const slosh = new Function('document', /var SLOSH_MIN = \d+;/.exec(theme)[0] + grabFn(theme, 'slosh') + '\nreturn slosh;')(document);
  const f = new F();
  slosh(f);
  ok('the fill takes the class', f.cls.has('cc-slosh-edge'));
  ok('and nothing inside it, so no bubble rides along', f.kids.length === 0);
  ok('its phase is the time since the page loaded, as a negative delay', f.props['--cc-slosh-phase'] === '-12.346s', f.props['--cc-slosh-phase']);
  clock = 99999;
  slosh(f);
  ok('a second call writes nothing, so an observer that calls it settles', f.appends === 0 && f.writes === 1 && f.props['--cc-slosh-phase'] === '-12.346s');
  slosh(f, false);
  ok('on === false takes the class and the phase off', !f.cls.has('cc-slosh-edge') && !('--cc-slosh-phase' in f.props));
  const g = new F(); slosh(g, false);
  ok('taking it off a bar that never sloshed writes nothing', !g.writes && !g.appends);
  const empty = new F('0%'); slosh(empty);
  ok('an empty bar does not slosh, since it holds no liquid', !empty.cls.has('cc-slosh-edge') && !empty.kids.length);
  const drained = new F(); slosh(drained); drained.style.width = '0%'; slosh(drained);
  ok('a bar that empties stops sloshing', !drained.cls.has('cc-slosh-edge') && !drained.kids.length);
  const thin = new F('60%', 8); slosh(thin);
  ok('an 8px bar stands still', !thin.cls.has('cc-slosh-edge') && !thin.writes);
  const edge = new F('60%', 11.5); slosh(edge);
  ok('so does one just under 12px', !edge.cls.has('cc-slosh-edge'));
  const tall = new F('60%', 12); slosh(tall);
  ok('from 12px it sloshes', tall.cls.has('cc-slosh-edge'));
  const squeezed = new F('60%', 26); slosh(squeezed); squeezed.high = 6; slosh(squeezed);
  ok('a bar that is drawn thinner stops sloshing', !squeezed.cls.has('cc-slosh-edge') && !('--cc-slosh-phase' in squeezed.props));
  const hidden = new F('60%', 0); slosh(hidden);
  ok('a bar that is not laid out yet keeps what the caller asked for', hidden.cls.has('cc-slosh-edge'));
  ok('no sheet or script draws a popping bubble', !/cc-slosh-pop|--cc-motion-slosh-pop-/.test(tokens + read('scripts/cc-theme.js')));
  ok('cc-theme.js publishes it', /slosh: slosh,/.test(read('scripts/cc-theme.js')));
}

console.log('\nThin bars stand still, only the tall ones are handed to the slosh');
{
  const disks = read('scripts/disks.js'), sht = read('scripts/sharetiles.js'), docker = read('scripts/docker.js'), header = read('scripts/header.js');
  const calls = (src) => (src.match(/\.slosh\(/g) || []).length;
  ok('no 8px bar on a /Main disk tile, the array card or a pool strip', calls(disks) === 0 && !/cc-slosh-edge/.test(disks));
  ok('none on a /Shares disk share tile', calls(sht) === 0);
  ok('none in the CPU and RAM gauges of a Docker card', calls(docker) === 0);
  ok('none in the status island\'s array, RAM and CPU chips', calls(grabFn(header, 'barChip')) === 0);
  const bars = grabFn(header, 'ccStateBars');
  ok('the 26px /Main usage bars still slosh while the Shares area restyles them', /CT\.slosh\(allBars\[s\], mainOn && !!allBars\[s\]\.closest\("#displaybox"\), highs\[s\]\)/.test(bars) && /rt\.contains\("cc-shares-on"\) && rt\.contains\("cc-on-main"\)/.test(bars) && /html\.cc-shares-on\.cc-on-main #displaybox \.usage-disk:not\(\.sys\):not\(\.mm\) \{[^}]*height: 26px !important;/.test(read('sheets/TowerTorch.Shares.css')));
  ok('and so does the 24px array meter in the menu while the header area is on', /CT\.slosh\(meter, rt\.contains\("cc-header-on"\), meterHigh\)/.test(bars) && /#menu \.usage-bar \{[^}]*height: var\(--cc-md-h, 30px\) !important;[^}]*padding: 3px !important;/.test(read('sheets/TowerTorch.Header.css')));
  ok('those are the only callers, so a thin bar elsewhere cannot pick it up again', calls(header) === 2 && calls(read('scripts/shares.js') + read('scripts/dashboard.js') + read('scripts/vms.js')) === 0);
  ok('the menu meter clips what runs past its end', /html\.cc-header-on #menu \.usage-bar \{[^}]*overflow: hidden;/.test(read('sheets/TowerTorch.Header.css')));
}

// Unraid writes the /Main table anew every second, and a bar measured after another was stamped
// lays the page out again. Twenty of those block the main thread long enough to stall every SVG
// animation on the page.
console.log('\nA refilled /Main table is laid out once, not once per bar');
{
  const theme = read('scripts/cc-theme.js'), header = read('scripts/header.js');
  const slosh = new Function(/var SLOSH_MIN = \d+;/.exec(theme)[0] + grabFn(theme, 'slosh') + '\nreturn slosh;')();
  const page = { dirty: true, layouts: 0 };
  const touch = () => { page.dirty = true; };
  class Bar {
    constructor() { this.cls = new Set(); this.style = { width: '50%', background: '', setProperty: touch, removeProperty: touch }; }
    get classList() { const c = this.cls; return { add: (x) => { c.add(x); touch(); }, remove: (x) => { c.delete(x); touch(); }, contains: (x) => c.has(x) }; }
    get className() { return [...this.cls].join(' '); }
    set className(v) { this.cls = new Set(v.split(/\s+/).filter(Boolean)); touch(); }
    closest() { return {}; }
    getBoundingClientRect() { if (page.dirty) { page.layouts++; page.dirty = false; } return { height: 26 }; }
  }
  const bars = Array.from({ length: 20 }, () => new Bar()), meter = new Bar();
  const document = {
    documentElement: { classList: { contains: (c) => ['cc-shares-on', 'cc-on-main', 'cc-header-on'].includes(c) } },
    querySelectorAll: () => bars,
    querySelector: (s) => (/#menu/.test(s) ? meter : null),
  };
  const run = new Function('document', 'window', 'g', grabFn(header, 'ccStateBars') + '\nreturn ccStateBars;')(document, { CCTheme: { slosh } }, (k, d) => d);
  run();
  ok('twenty fresh bars and the meter all slosh', bars.every((b) => b.cls.has('cc-slosh-edge')) && meter.cls.has('cc-slosh-edge'));
  ok('and the page is laid out once for all of them', page.layouts === 1, page.layouts + ' layouts');
  const thin = new Bar();
  slosh(thin, true, 8);
  ok('a height read beforehand still keeps a thin bar still', !thin.cls.has('cc-slosh-edge'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
