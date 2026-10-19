// The shared pictures (TowerTorch.Pictures.page, .css, scripts/pictures.js), GlimStone's
// "Illustrations". What can quietly break them:
//   · a level that leaves a dial out, which then inherits the lively number
//   · an animation outside the no-preference gate, which keeps moving under reduced motion
//   · a resting state inside the gate, which leaves crests standing or bubbles hanging in a still frame
//   · a checkmark drawn undrawn by default, which stays invisible wherever the gate is not read
//   · a vessel that keeps its colour when the level crosses into warning
//   · a thin bar that sloshes like the vessel, where the surge only twitches
//   · a script that loads after the areas, which then draw without it
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const js = read('scripts/pictures.js');
const css = read('sheets/TowerTorch.Pictures.css');
const page = read('TowerTorch.Pictures.page');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function rules(src) {
  const out = []; const stack = []; let buf = '';
  for (const ch of src.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.filter((h) => h.startsWith('@media')).join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const all = rules(css);
function grabSlosh(src) {
  const i = src.indexOf('function slosh(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: slosh');
}

// A small DOM: enough tree for innerHTML, querySelector by tag or class, attributes, classList and style.
function node(tag) {
  const n = { tagName: tag.toUpperCase(), attrs: {}, children: [], parentNode: null, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.appendChild = (c) => { c.parentNode = n; n.children.push(c); return c; };
  n.removeChild = (c) => { n.children.splice(n.children.indexOf(c), 1); c.parentNode = null; return c; };
  Object.defineProperty(n, 'firstChild', { get: () => n.children[0] || null });
  Object.defineProperty(n, 'isConnected', { get: () => true });
  Object.defineProperty(n, 'className', { get: () => n.attrs.class || '', set: (v) => { n.attrs.class = v; } });
  n.classList = {
    contains: (c) => (' ' + (n.attrs.class || '') + ' ').includes(' ' + c + ' '),
    add: (c) => { if (!n.classList.contains(c)) n.attrs.class = ((n.attrs.class || '') + ' ' + c).trim(); },
    remove: (c) => { n.attrs.class = (' ' + (n.attrs.class || '') + ' ').replace(' ' + c + ' ', ' ').trim(); }
  };
  n.getBoundingClientRect = () => ({});
  const walk = (pred, direct) => { const hits = []; const go = (p) => p.children.forEach((c) => { if (pred(c)) hits.push(c); if (!direct) go(c); }); go(n); return hits; };
  const pred = (sel) => sel[0] === '.' ? (c) => c.classList.contains(sel.slice(1)) : (c) => c.tagName === sel.toUpperCase();
  n.querySelectorAll = (sel) => { const m = /^:scope > (.+)$/.exec(sel); return m ? walk(pred(m[1]), true) : walk(pred(sel), false); };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  Object.defineProperty(n, 'innerHTML', {
    set(html) {
      n.children = [];
      const re = /<\/([a-zA-Z]+)\s*>|<([a-zA-Z]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+/g;
      let cur = n, m;
      while ((m = re.exec(html))) {
        if (m[1]) { cur = cur.parentNode; continue; }
        if (!m[2]) continue;
        const c = node(m[2]);
        (m[3] || '').replace(/([^\s=]+)="([^"]*)"/g, (x, k, v) => { c.attrs[k] = v; });
        cur.appendChild(c);
        if (!m[4]) cur = c;
      }
    }
  });
  return n;
}
const document = { documentElement: node('html'), createElement: node, createElementNS: (ns, tag) => node(tag) };
const frames = [];
const window = { requestAnimationFrame: (f) => { frames.push(f); return frames.length; }, cancelAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), CCTheme: { slosh: function slosh() {} } };
function load(win) {
  new Function('window', 'document', 'MutationObserver', js)(win, document, function () { this.observe = () => {}; });
  return win.CCPictures;
}
const P = load(window);

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:(\d+)"/m.test(page));
ok('it loads before every area script, all at :97 or later', +/^Menu="Buttons:(\d+)"/m.exec(page)[1] < 97);
ok('it renders no icon and loads pictures.js', /^Link="cc-pictures-hook"/m.test(page) && /scripts\/pictures\.js/.test(page));
ok('the kit names the five pictures and the motion question', ['sloshBar', 'vessel', 'drawCheck', 'flow', 'ring', 'still'].every((k) => k in P));

console.log('\nA bar sloshes through the one engine Tokens.css already drives, and only a tall one');
{
  ok('sloshBar is CCTheme.slosh itself, no second engine', P.sloshBar === window.CCTheme.slosh);
  ok('the sheet draws nothing on a bar\'s fill', !all.some((r) => /cc-slosh/.test(r.sel)));
  const theme = read('scripts/cc-theme.js');
  global.performance = global.performance || { now: () => 0 };
  const kit = load(Object.assign({}, window, { CCTheme: { slosh: new Function(/var SLOSH_MIN = \d+;/.exec(theme)[0] + grabSlosh(theme) + '\nreturn slosh;')() } }));
  const bar = (high) => { const f = node('span'); f.style.width = '60%'; f.style.removeProperty = (k) => { delete f.style.props[k]; }; f.getBoundingClientRect = () => ({ height: high }); return f; };
  const thin = kit.sloshBar(bar(8)), tall = kit.sloshBar(bar(26));
  ok('a thin bar handed to the kit stands still, so the slosh stays with the vessel', !thin.classList.contains('cc-slosh-edge'));
  ok('a bar of 12px or more still sloshes', tall.classList.contains('cc-slosh-edge') && kit.sloshBar(bar(12)).classList.contains('cc-slosh-edge'));
}

console.log('\nThe vessel');
{
  const v = P.vessel({ share: 0.84, label: 'Array', tone: 'accent' });
  const svg = v.el.querySelector('svg');
  const level = v.el.querySelector('.cc-vessel-level');
  ok('34 units wide, a progressbar with its label', svg.getAttribute('viewBox') === '0 0 34 40' && svg.getAttribute('role') === 'progressbar' && svg.getAttribute('aria-label') === 'Array');
  ok('the liquid is clipped to the inside', /^url\(#cc-vessel-\d+\)$/.test(v.el.querySelectorAll('g')[0].getAttribute('clip-path')));
  ok('a front layer that tilts and a paler back layer', !!v.el.querySelector('.cc-vessel-tilt') && !!v.el.querySelector('.cc-vessel-back'));
  ok('two crests, a hump and the splash parts', !!v.el.querySelector('.cc-vessel-crest-left') && !!v.el.querySelector('.cc-vessel-crest-right') && !!v.el.querySelector('.cc-vessel-hump') && !!v.el.querySelector('.cc-vessel-splash-tilt') && !!v.el.querySelector('.cc-vessel-splash-crest') && !!v.el.querySelector('.cc-vessel-splash-ripple'));
  const pops = v.el.querySelectorAll('.cc-vessel-pop');
  ok('three bubbles, and three pops each with a bubble, a ring and three drops', v.el.querySelectorAll('.cc-vessel-bubble').length === 3 && pops.length === 3 && pops.every((p) => p.querySelectorAll('.cc-vessel-pop-bubble').length === 1 && p.querySelectorAll('.cc-vessel-pop-ring').length === 1 && p.querySelectorAll('.cc-vessel-pop-drop').length === 3));
  ok('a dashed line at the brim, where the place is full', v.el.querySelector('.cc-vessel-brim').getAttribute('d') === 'M2 8H32' && /\.cc-vessel-brim \{[^}]*stroke-dasharray: 2\.5 2\.5;/.test(css));
  ok('it starts below the floor, so it rises to its level', level.style.transform === 'translateY(38.50px)');
  frames.splice(0).forEach((f) => f());
  ok('then stands at its share: 84 % sits 22.8 units above the floor', level.style.transform === 'translateY(12.40px)' && svg.getAttribute('aria-valuenow') === '84', level.style.transform);
  ok('the depth below the surface rides on the svg for the bubbles', svg.style.props['--cc-vessel-depth'] === '23.10');
  v.setLevel(1.4);
  ok('a share past full stops at the brim', level.style.transform === 'translateY(8.00px)' && svg.getAttribute('aria-valuenow') === '100');
  v.setLevel(0);
  ok('an empty vessel stands at the floor', level.style.transform === 'translateY(35.50px)');
  ok('it starts in its tone', v.el.getAttribute('data-tone') === 'accent');
  v.setTone('warn');
  ok('warn turns it orange', v.el.getAttribute('data-tone') === 'warn' && /\.cc-vessel\[data-tone="warn"\] \{ --cc-vessel-liquid: var\(--cc-warn\); \}/.test(css));
  v.setTone('err');
  ok('err turns it red', v.el.getAttribute('data-tone') === 'err' && /\.cc-vessel\[data-tone="err"\] \{ --cc-vessel-liquid: var\(--cc-err\); \}/.test(css));
  v.setTone('nonsense');
  ok('anything else is the accent, the picture colour', v.el.getAttribute('data-tone') === 'accent' && /\.cc-vessel \{ --cc-vessel-liquid: var\(--cc-pic-c, var\(--cc-accent, #FCC419\)\);/.test(css));
  v.splash();
  ok('a splash puts the class on the svg', svg.classList.contains('cc-vessel-splashing'));
  ok('its corners follow the shape setting', /\.cc-vessel-wall \{[^}]*rx: var\(--cc-pic-corner, 6px\);/.test(css) && /html\[data-cc-shape="square"\] \{ --cc-pic-corner: 0px; \}/.test(css) && /html\[data-cc-shape="soft"\] \{ --cc-pic-corner: 3px; \}/.test(css));
  const w = P.vessel({ share: 0.5 });
  ok('every vessel has a clip of its own', w.el.querySelectorAll('g')[0].getAttribute('clip-path') !== v.el.querySelectorAll('g')[0].getAttribute('clip-path'));
}

console.log('\nThe drawn checkmark');
{
  const box = node('span');
  const first = P.drawCheck(box, 'Erledigt');
  const path0 = first.children[0];
  ok('one path with pathLength 1, so a 1 to 0 offset draws all of it', path0.getAttribute('pathLength') === '1' && path0.classList.contains('cc-check-draw'));
  ok('it is named when given a label', first.getAttribute('role') === 'img' && first.getAttribute('aria-label') === 'Erledigt');
  const again = P.drawCheck(box);
  ok('a second call puts a fresh node in, so it draws again', box.children.length === 1 && box.children[0] === again && again !== first && again.getAttribute('aria-hidden') === 'true');
  const base = all.find((r) => r.sel === '.cc-check-draw' && !r.media);
  ok('outside the gate it is fully drawn, in currentColor', base && /stroke-dashoffset: 0;/.test(base.body) && /stroke: currentColor;/.test(base.body) && !/animation/.test(base.body));
  const gated = all.find((r) => r.sel === '.cc-check-draw' && /no-preference/.test(r.media));
  ok('only the gate starts it undrawn and draws it', gated && /stroke-dashoffset: 1;/.test(gated.body) && /animation: cc-check-draw var\(--cc-motion-check-dur\) ease forwards;/.test(gated.body));
  const off = all.find((r) => r.sel === 'html[data-cc-motion="off"] .cc-check-draw');
  ok('at "off" it stands drawn without moving', off && /animation: none;/.test(off.body) && /stroke-dashoffset: 0;/.test(off.body));
}

console.log('\nEvery level answers every dial');
{
  const dials = [...new Set((all.find((r) => r.sel === 'html' && !r.media && /--cc-motion-vessel-tilt/.test(r.body)).body.match(/--cc-motion-[\w-]+(?=:)/g)))];
  const block = (sel) => all.find((r) => r.sel === sel && /no-preference/.test(r.media) && /--cc-motion-vessel-/.test(r.body));
  const levels = { wild: block('html'), subtle: block('html[data-cc-motion="subtle"]'), off: block('html[data-cc-motion="off"]') };
  ok('the still block names the dials', dials.length >= 15, dials.length);
  for (const [n, r] of Object.entries(levels)) ok(n + ' declares every one', r && dials.every((d) => new RegExp(d + ':').test(r.body)), r ? dials.filter((d) => !new RegExp(d + ':').test(r.body)).join(' ') : 'missing');
  const v = (r, d) => (new RegExp(d + ':\\s*([^;]+);').exec(r.body) || [])[1].trim();
  ok('wild tilts 5deg like GlimStone\'s default, subtle 3deg', v(levels.wild, '--cc-motion-vessel-tilt') === '5deg' && v(levels.subtle, '--cc-motion-vessel-tilt') === '3deg');
  ok('the check draws in 360ms on wild and 200ms on subtle', v(levels.wild, '--cc-motion-check-dur') === '360ms' && v(levels.subtle, '--cc-motion-check-dur') === '200ms');
  const still = all.find((r) => r.sel === 'html' && !r.media && /--cc-motion-vessel-tilt/.test(r.body));
  ok('off holds the still numbers', dials.every((d) => v(levels.off, d) === v(still, d)));
  ok('the swing runs on the bar\'s duration, one clock for both', /\.cc-vessel-tilt \{ animation: cc-vessel-tilt var\(--cc-motion-slosh-dur\)/.test(css) && !/--cc-motion-vessel-dur/.test(css));
}

console.log('\nThe resting state lives outside the gate, the motion inside it');
{
  const rest = (cls, prop) => all.some((r) => !r.media && r.sel.split(',').map((s) => s.trim()).includes(cls) && new RegExp(prop).test(r.body));
  for (const c of ['.cc-vessel-crest', '.cc-vessel-hump', '.cc-vessel-splash-crest', '.cc-vessel-splash-ripple']) ok(c + ' rests at zero height', rest(c, 'scale: 1 0;'));
  for (const c of ['.cc-vessel-bubble', '.cc-vessel-pop-bubble', '.cc-vessel-pop-ring', '.cc-vessel-pop-drop']) ok(c + ' rests hidden', rest(c, 'opacity: 0;'));
  ok('the liquid tilts about the middle, 17 units in', rest('.cc-vessel-tilt', 'transform-origin: 17px 0;'));
  const moving = all.filter((r) => /animation\s*:/.test(r.body) && !/animation:\s*none/.test(r.body));
  ok('there are animations', moving.length >= 12, moving.length);
  const loose = moving.filter((r) => !/prefers-reduced-motion:\s*no-preference/.test(r.media));
  ok('none sits outside the no-preference gate', loose.length === 0, loose.map((r) => r.sel).join(' | '));
  const eased = all.filter((r) => /transition\s*:/.test(r.body) && !/transition:\s*none/.test(r.body));
  ok('the rise and the ring ease only inside the gate', eased.length === 2 && eased.every((r) => /no-preference/.test(r.media)));
  const off = all.find((r) => /^html\[data-cc-motion="off"\] :is\(\.cc-vessel-tilt/.test(r.sel));
  const animated = [...new Set(moving.flatMap((r) => r.sel.split(',').map((s) => s.trim().replace(/:nth-child\(\d\)$/, '').replace(/^\.cc-vessel-splashing /, ''))))].filter((s) => /^\.cc-vessel/.test(s));
  ok('"off" stops every animated part with animation: none', off && /animation: none;/.test(off.body) && animated.every((s) => off.sel.includes(s) || (s === '.cc-vessel-crest-left' || s === '.cc-vessel-crest-right') && off.sel.includes('.cc-vessel-crest')), animated.filter((s) => !off.sel.includes(s)).join(' '));
}

console.log('\nThe packets move at one speed, and stand still when motion is off');
{
  const svgNode = node('svg');
  svgNode.getCurrentTime = () => 0;
  const still = load(Object.assign({}, window, { matchMedia: () => ({ matches: true, addEventListener() {} }) }));
  const f = still.flow(svgNode, [0, 0], [140, 0], { gap: 35 });
  const packets = f.el.querySelector('.cc-flow-packets');
  ok('a straight line 140 units long carries four packets 35 units apart', packets.getAttribute('data-packets') === '4');
  const dots = packets.children;
  ok('the still frame stands them evenly along it, without SMIL', dots.length === 4 && dots.every((d) => d.tagName === 'CIRCLE') && dots.map((d) => d.getAttribute('cx')).join(',') === '17.5,52.5,87.5,122.5');
  f.remove();
  ok('remove takes the line out', svgNode.children.length === 0);
  const moving = P.flow(svgNode, [0, 0], [140, 0], { gap: 35 });
  const one = moving.el.querySelector('.cc-flow-packets').children;
  ok('in motion each packet walks the path on SMIL, two seconds a loop at 70 units a second', one.length === 4 && one[0].children[0].tagName === 'ANIMATEMOTION' && one[0].children[0].getAttribute('dur') === '2s' && one[1].children[0].getAttribute('begin') === '0.5s');
}

console.log('\nThe progress ring');
{
  const r = P.ring('Paritätsprüfung');
  r.set(0.033);
  ok('3.3 % reads "3 %" and draws that much of the arc', r.el.querySelector('.cc-ring-pct').textContent === '3 %' && Math.abs(+r.el.querySelector('.cc-ring-arc').getAttribute('stroke-dashoffset') - 96.7) < 1e-9);
  r.set(0.9999);
  ok('it never reads 100 % before the end', r.el.querySelector('.cc-ring-pct').textContent === '99 %' && r.el.getAttribute('aria-valuenow') === '99');
  ok('a progressbar with its label', r.el.getAttribute('role') === 'progressbar' && r.el.getAttribute('aria-label') === 'Paritätsprüfung');
  ok('it draws in the ink of what it stands in, round in every shape', /\.cc-ring-arc \{[^}]*stroke: currentColor;/.test(css) && !/\.cc-ring[^{]*\{[^}]*radius/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
