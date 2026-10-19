// The mover and a parity check as pictures on /Main (disks.js, shares.js, CCPictures). Both show
// only while the work runs. What can quietly break them:
//   · reading the mover from the button texts, which change with the language
//   · a picture left standing after the work ended
//   · a ring on the array chip instead of the chip of the running check
//   · a ring that stays in the cell when the Start area is switched off
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const disks = read('scripts/disks.js');
const shares = read('scripts/shares.js');
const dcss = read('sheets/TowerTorch.Disks.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nThe mover');
{
  const flows = [], vessels = [];
  const pictures = {
    vessel(o) { const v = { o, el: { tag: 'vessel' }, setLevel(s) { v.level = s; return v; }, setTone(t) { v.tone = t; return v; } }; vessels.push(v); return v; },
    flow(svg, from, to, o) { const f = { svg, from, to, o, removed: false, remove() { f.removed = true; } }; flows.push(f); return f; }
  };
  const node = (html) => { const svg = { tag: 'svg' }, dest = { kids: [], insertBefore(n) { dest.kids.unshift(n); } }; return { html, querySelector: (s) => (s === 'svg' ? svg : dest) }; };
  const host = { kids: [], querySelector() { return this.kids[0] || null; }, appendChild(n) { this.kids.push(n); }, removeChild(n) { this.kids.splice(this.kids.indexOf(n), 1); } };
  const listeners = [];
  const win = { CCPictures: pictures, mymonitor: { on(ev, fn) { listeners.push([ev, fn]); } } };
  let soons = 0;
  const src = ['var TXT = ' + /var TXT = (\{[\s\S]*?\n  \});/.exec(disks)[1] + ';', grabFn(disks, 't'), grabFn(disks, 'esc'), grabFn(disks, 'fillTone'),
    'var moving = false, arrayUse = { pct: 84 }; var MOVE_W = 220, MOVE_PITCH = 34;', grabFn(disks, 'watchMover'), grabFn(disks, 'moverFlow'),
    'return { watchMover: watchMover, moverFlow: moverFlow, moving: function () { return moving; } };'].join('\n');
  const M = new Function('window', 'el', 'soon', 'LANG', src)(win, (tag, cls, html) => node(html), () => soons++, 'de');
  const pools = [{ key: 'cache', name: 'Cache', disks: [1] }, { key: 'fastcache', name: 'Fastcache', disks: [1] }, { key: 'gone', name: 'Leer', disks: [] }];
  M.moverFlow(host, pools);
  ok('nothing shows while the mover rests', host.kids.length === 0 && flows.length === 0);
  M.watchMover();
  ok('it listens to Unraid\'s own subscriber', listeners.length === 1 && listeners[0][0] === 'message');
  listeners[0][1]('2');
  ok('state 2 is the mover, and the tiles draw again', M.moving() === true && soons === 1);
  listeners[0][1]('2');
  ok('the same state twice draws nothing new', soons === 1);
  M.moverFlow(host, pools);
  const box = host.kids[0];
  ok('a strip with a line from each pool that has disks', host.kids.length === 1 && flows.length === 2 && /Cache/.test(box.html) && /Fastcache/.test(box.html) && !/Leer/.test(box.html));
  ok('every line runs to the array\'s vessel and splashes it', flows.every((f) => f.to[0] === 220 && f.o.land === vessels[0]) && box.querySelector('x').kids[0] === vessels[0].el);
  ok('the vessel holds the array\'s share in its tone', vessels[0].level === 0.84 && vessels[0].tone === 'accent');
  ok('it says so in plain words', /Mover läuft/.test(box.html) && /verschiebt gerade Dateien zwischen den Pools und dem Array/.test(box.html));
  M.moverFlow(host, pools);
  ok('a refill keeps the running picture', host.kids[0] === box && flows.length === 2 && vessels.length === 1);
  listeners[0][1]('0');
  M.moverFlow(host, pools);
  ok('when the mover ends the picture goes, lines and all', host.kids.length === 0 && flows.every((f) => f.removed));
  listeners[0][1]('1');
  ok('a parity check (state 1) is not the mover', M.moving() === false);
  ok('the pools draw it after their cards, and boot starts listening', /order\(wrap, boxes\);\s*moverFlow\(host, pools\);/.test(disks) && /watch\(\);\s*watchMover\(\);/.test(disks));
  ok('the strip does not widen the pools card', /\.cc-dk-move \{[^}]*contain: inline-size;/.test(dcss));
}

console.log('\nA running parity check turns its chip into a progress ring');
{
  const rings = [];
  const pictures = { ring(label) { const r = { label, el: { parentNode: null }, share: null, set(s) { r.share = s; return r; } }; rings.push(r); return r; } };
  const chip = (ref) => {
    const c = { ref, cls: new Set(['cc-aop-status']), kids: [], textContent: ' Paritätsprüfung läuft. ' };
    c.classList = { add: (x) => c.cls.add(x), remove: (x) => c.cls.delete(x), contains: (x) => c.cls.has(x) };
    c.insertBefore = (n) => { n.parentNode = c; c.kids.unshift(n); };
    c.removeChild = (n) => { n.parentNode = null; c.kids.splice(c.kids.indexOf(n), 1); };
    Object.defineProperty(c, 'firstChild', { get: () => c.kids[0] || null });
    return c;
  };
  const array = chip('1'), check = chip('2');
  let running = true;
  const home = { getAttribute: (k) => (k === 'data-cc-aop-pillhome' ? '2' : null) };
  const box = {
    querySelector(sel) {
      if (sel === 'table.array_status #pauseButton') return running ? { closest: () => ({ children: [home] }) } : null;
      const m = /data-cc-aop-pillref="(\d)"/.exec(sel);
      return m ? [array, check].find((c) => c.ref === m[1]) : null;
    },
    querySelectorAll() { return [array, check].filter((c) => c.cls.has('cc-aop-ringed')); }
  };
  const ring = new Function('window', grabFn(shares, 'ccAopParityRing') + '\nreturn ccAopParityRing;')({ CCPictures: pictures });
  ring(box, 33.3);
  ok('the chip of the row with the pause button gets the ring, the array chip none', check.cls.has('cc-aop-ringed') && check.kids[0] === rings[0].el && !array.cls.has('cc-aop-ringed'));
  ok('the ring shows the share done and is named after the chip', Math.abs(rings[0].share - 0.333) < 1e-9 && rings[0].label === 'Paritätsprüfung läuft.');
  ring(box, 34.1);
  ok('each tick moves the same ring', rings.length === 1 && Math.abs(rings[0].share - 0.341) < 1e-9);
  ring(box, null);
  ok('without a percentage the ring goes', !check.cls.has('cc-aop-ringed') && check.kids.length === 0);
  ring(box, 40);
  running = false;
  ring(box, 40);
  ok('when the check ends its chip loses the ring', !check.cls.has('cc-aop-ringed') && check.kids.length === 0);
  const card = grabFn(shares, 'ccAopParityCard');
  ok('the parity card feeds it the percentage it parses, and clears it with the card', /ccAopParityRing\(box, pct\);/.test(card) && /if \(card\) card\.parentNode\.removeChild\(card\); ccAopParityRing\(box, null\); return;/.test(card));
  ok('switching the area off takes the ring out before the chips unwrap', /ccAopParityRing\(dsp, null\);/.test(grabFn(shares, 'aopTeardown')));
  ok('the chip grows around the ring in the tiles as in the list', /\.cc-b\.cc-aop-status\.cc-aop-ringed \{ height: auto;/.test(dcss) && /\.cc-b\.cc-aop-status\.cc-aop-ringed \{ height: auto;/.test(read('sheets/TowerTorch.Shares.css')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
