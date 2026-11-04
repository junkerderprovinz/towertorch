// A Docker card shows no value it does not have: a stopped container carries only its state, with
// no CPU, RAM or BW badge and no gear, and a running one shows its network rate once there has been
// traffic. The limit editors stay in reach through the card's and the tile's menu, and a list row
// of a stopped container quiets its column to one muted dash.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Elements just rich enough for card() and updateResGroup(): class lists, descendant class
// selectors, closest() and attributes.
function Node(tag, cls, text) {
  const n = { tag, kids: [], parentNode: null, attrs: {}, dataset: {}, style: {}, on: {}, textContent: text || '' };
  const classes = new Set((cls || '').split(' ').filter(Boolean));
  n.classList = {
    contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c),
    toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; },
  };
  n.appendChild = (k) => { n.kids.push(k); k.parentNode = n; return k; };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  n.addEventListener = (k, f) => { n.on[k] = f; };
  const has = (x, part) => part.split('.').filter(Boolean).every((c) => x.classList.contains(c));
  n.querySelectorAll = (sel) => {
    const parts = sel.trim().split(/\s+/), out = [];
    const walk = (x, i) => x.kids.forEach((k) => { if (has(k, parts[i])) { if (i === parts.length - 1) out.push(k); else walk(k, i + 1); } walk(k, i); });
    walk(n, 0);
    return Array.from(new Set(out));
  };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  n.closest = (sel) => { for (let x = n; x; x = x.parentNode) if (has(x, sel)) return x; return null; };
  return n;
}

const stubs = `
  var MARK = "data-tt", LANG = "de", filterText = "", limits = {}, stats = {}, netSeen = {}, menuCalls = [], opened = [];
  var config = { bandwidths: [] };
  function el(tag, cls, text) { return Node(tag, cls, text); }
  function t(k) { return { cpuLimit: "CPU-Limit", ramLimit: "RAM-Limit", bandwidth: "Bandbreite", pause: "Pause" }[k] || k; }
  function norm(s) { return String(s || "").toLowerCase(); }
  function colOn() { return true; }
  function stampCardRainbow() {}
  function cardIcon() { return el("span", "tt-card-icobox"); }
  function planBadge() { return el("a", "tt-b tt-plan"); }
  function autostartSwitch() { return null; }
  function stateBadge(c) { return el("span", "tt-badge tt-badge-" + c.state); }
  function lastRunPill() { return null; }
  function actionBars() { return { bar: el("div", "tt-actbar") }; }
  function badgeInfo(k, v, kind) { var b = el("span", "tt-b tt-b-info tt-b-" + kind); b.appendChild(el("span", "tt-b-k", k)); b.appendChild(el("span", "tt-b-v", v)); return b; }
  function limGear() { return el("span", "tt-limbtn"); }
  function bwGear() { return el("span", "tt-limbtn"); }
  function cpuLimited() { return false; } function cpuPinned() { return false; } function ramLimited() { return false; }
  function bwTitle() { return ""; }
  function humanBytes(b) { return String(b); }
  function netRate(s) { return s && s._rxr != null ? "↓" + s._rxr + " ↑" + s._txr : "…"; }
  function openLimits(a, n, w) { opened.push([a.tag, n, w]); }
  function openBandwidth(a, n) { opened.push([a.tag, n, "bw"]); }
  function ctxFor() { return { links: [] }; }
  function editTemplate() {} function doAction() {}
`;
const api = new Function('Node', 'window',
  stubs + ['card', 'resLine', 'updateResGroup', 'bandwidthFor', 'bwHasLimit', 'limitItems', 'containerMenu'].map(grabFn).join('\n') +
  '\nreturn { card: card, update: updateResGroup, containerMenu: containerMenu, netSeen: netSeen, stats: stats, config: config, opened: opened, menuCalls: menuCalls };');

const win = { TTTheme: { menu: (anchor, items) => win.last = { anchor, items } } };
const a = api(Node, win);
const bwLine = (cd) => { const b = cd.querySelector('.tt-b-bw'); return b && b.closest('tt-resline'); };

console.log('\nA stopped container\'s card carries only its state');
{
  const cd = a.card({ name: 'ClamAV', state: 'exited' });
  ok('no resource group', !cd.querySelector('.tt-card-res'));
  ok('no CPU, RAM or BW badge', !cd.querySelector('.tt-b-cpu') && !cd.querySelector('.tt-b-ram') && !cd.querySelector('.tt-b-bw'));
  ok('no gear', !cd.querySelector('.tt-limbtn'));
  ok('the state chip stays', !!cd.querySelector('.tt-badge-exited'));
  const paused = a.card({ name: 'Redis', state: 'paused' });
  ok('a paused one has no values either', !paused.querySelector('.tt-card-res'));
}

console.log('\nA running card shows the rate once there has been traffic');
{
  a.stats.CouchDB = { cpu_percent: 0.5, mem_used: 10, mem_limit: 20, _rxr: 0, _txr: 0 };
  const cd = a.card({ name: 'CouchDB', state: 'running' });
  ok('CPU and RAM show from the start', !!cd.querySelector('.tt-b-cpu') && !!cd.querySelector('.tt-b-ram'));
  ok('the BW line waits while the rate is zero', bwLine(cd).classList.contains('tt-hidden'));
  a.netSeen.CouchDB = true;
  a.update(cd.querySelector('.tt-card-res'), a.stats.CouchDB, 'running');
  ok('it shows once traffic has been seen, and stays at a zero sample', !bwLine(cd).classList.contains('tt-hidden'));
  a.config.bandwidths.push({ name: 'Plex', egress_kbit: 5000 });
  const capped = a.card({ name: 'Plex', state: 'running' });
  ok('a set cap keeps the BW line in view without traffic', !bwLine(capped).classList.contains('tt-hidden'));
  const rg = cd.querySelector('.tt-card-res');
  a.update(rg, null, 'exited');
  ok('a card whose container stops before the next draw drops the group', rg.classList.contains('tt-res-idle'));
}

console.log('\nA list row keeps its column but quiets a stopped container');
{
  const rg = Node('div', 'tt-rowbadges tt-resgroup'); rg.dataset.name = 'Redis';
  rg.appendChild(Node('div', 'tt-resline')).appendChild(Node('span', 'tt-b tt-b-bw')).appendChild(Node('span', 'tt-b-v', '…'));
  a.update(rg, { _rxr: 0, _txr: 0 }, 'running');
  ok('a running row shows its rate at zero', !rg.querySelector('.tt-resline').classList.contains('tt-hidden') && rg.querySelector('.tt-b-v').textContent === '↓0 ↑0');
  a.update(rg, null, 'exited');
  ok('a stopped row is marked idle', rg.classList.contains('tt-res-idle'));
  a.update(rg, null, 'running');
  ok('and comes back when it runs again', !rg.classList.contains('tt-res-idle'));
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  ok('idle hides the badges and their gears', /\.tt-resgroup\.tt-res-idle > \.tt-resline \{ display: none; \}/.test(flat));
  ok('idle shows one muted dash', /\.tt-resgroup\.tt-res-idle::before \{ content: "-"; color: var\(--tt-dim/.test(flat));
  ok('an idle card group is left out', /\.tt-card-res\.tt-resgroup\.tt-res-idle \{ display: none !important; \}/.test(flat));
}

console.log('\nThe menus open the limit editors');
{
  const tile = Node('span', 'tt-tile-icobtn');
  a.containerMenu(tile, { name: 'ClamAV', state: 'exited' }, { links: [] });
  const labels = win.last.items.map((i) => i.label);
  ok('the tile menu offers CPU-Limit, RAM-Limit and Bandbreite', ['CPU-Limit', 'RAM-Limit', 'Bandbreite'].every((l) => labels.includes(l)), labels.join(', '));
  win.last.items.filter((i) => /Limit|Bandbreite/.test(i.label)).forEach((i) => i.run());
  ok('each opens its own window from the menu\'s control', JSON.stringify(a.opened) === JSON.stringify([['span', 'ClamAV', 'cpu'], ['span', 'ClamAV', 'ram'], ['span', 'ClamAV', 'bw']]), JSON.stringify(a.opened));
  ok('the card\'s Mehr builds its menu from the same entries', /actBtn\("More"[\s\S]{0,200}limitItems\(moreBtn, name\)/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
