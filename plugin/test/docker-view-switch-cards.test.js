// The Basic/Advanced switch in the action bar has to change the card view the way it changes the
// list: each detail on a card follows its list column's per-view setting, and a flip while the
// cards or folders are on screen draws them again for the new view.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Elements just rich enough for card() and ensureBarToggle(): single-class lookups, a class list,
// attributes and listeners.
function Node(tag, cls, text) {
  const n = { tag, kids: [], attrs: {}, dataset: {}, style: {}, on: {}, textContent: text || '' };
  const classes = new Set((cls || '').split(' ').filter(Boolean));
  n.classList = {
    contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c),
    toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; },
  };
  n.appendChild = (k) => { n.kids.push(k); return k; };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  n.addEventListener = (k, f) => { n.on[k] = f; };
  n.querySelectorAll = (sel) => { const c = sel.replace(/^\./, ''), out = []; const walk = (x) => x.kids.forEach((k) => { if (k.classList.contains(c)) out.push(k); walk(k); }); walk(n); return out; };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  return n;
}

const stubs = `
  var MARK = "data-tt", LANG = "de", ttAdvCache = null, ttEnhanceAt = 0, lastAdv = null, filterText = "";
  var limits = {}, stats = {}, gridHolder = null, mode = "list";
  var calls = { render: 0, enhance: 0 }, timers = [];
  function el(tag, cls, text) { return Node(tag, cls, text); }
  function t(k) { return k; }
  function norm(s) { return s.toLowerCase(); }
  function themingOn() { return true; }
  function stampCardRainbow() {}
  function cardIcon() { return el("span", "tt-card-icobox"); }
  function planBadge() { return el("a", "tt-b tt-plan"); }
  function autostartSwitch() { return el("span", "tt-set-toggle tt-card-auto"); }
  function stateBadge() { return el("span", "tt-badge"); }
  function lastRunPill() { return null; }
  function actionBars() { return { bar: el("div", "tt-actbar") }; }
  function badgeInfo(k) { return el("span", "tt-b", k); }
  function resLine(b, g) { var l = el("span", "tt-resline"); l.appendChild(b); l.appendChild(g); return l; }
  function limGear() { return el("span", "tt-limgear"); }
  function bwGear() { return el("span", "tt-limgear"); }
  function cpuLimited() { return false; } function cpuPinned() { return false; } function ramLimited() { return false; }
  function bandwidthFor() { return null; } function bwTitle() { return ""; } function bwHasLimit() { return false; }
  function updateResGroup() {}
  function renderCurrentView() { calls.render++; }
  function applyEnhanceClasses() { calls.enhance++; }
  function reinjectRowBadges() {} function removeEnhanceClasses() {}
  function setTimeout(f) { timers.push(f); }
`;
const api = new Function('Node', 'document', 'window', 'colview',
  stubs + [grabFn('isAdvancedView'), grabFn('isAdvancedViewReal'), grabFn('colOn'), grabFn('card'), grabFn('ensureBarToggle')].join('\n') +
  '\nreturn { card: card, bar: ensureBarToggle, calls: calls, timers: timers, setMode: function (m) { mode = m; } };');

function setup(colview) {
  const doc = { cookie: '', querySelector: () => null };
  return { doc, a: api(Node, doc, {}, colview) };
}
const box = { s: false, a: true };
const container = { name: 'ClamAV', ip: '192.168.10.31', network: 'br0.20', ports: ['3310/tcp'], state: 'running' };
const whereOf = (cd) => { const ip = cd.querySelector('.tt-card-ip'); return ip ? ip.textContent : ''; };

console.log('\nA card shows each detail in the views its list column shows in');
{
  const { doc, a } = setup({ port: box, res: box, plan: box, ip: { s: true, a: true }, net: { s: true, a: true } });
  doc.cookie = 'docker_listview_mode=basic';
  const basic = a.card(container);
  ok('the basic view leaves the ports out of the address line', !/3310/.test(whereOf(basic)) && /192\.168\.10\.31/.test(whereOf(basic)), whereOf(basic));
  ok('the basic view leaves out the CPU, RAM and BW row', !basic.querySelector('.tt-card-res'));
  ok('the basic view leaves out the plan chip', !basic.querySelector('.tt-plan'));
  ok('the autostart switch stays in both views', !!basic.querySelector('.tt-card-auto'));
  doc.cookie = 'docker_listview_mode=advanced';
  const adv = a.card(container);
  ok('the advanced view adds the ports', /3310\/tcp/.test(whereOf(adv)), whereOf(adv));
  ok('the advanced view adds the CPU, RAM and BW row', !!adv.querySelector('.tt-card-res'));
  ok('the advanced view adds the plan chip', !!adv.querySelector('.tt-plan'));
}

console.log('\nFlipping the switch draws the card and folder views again');
for (const m of ['grid', 'folder']) {
  const { doc, a } = setup({});
  doc.cookie = 'docker_listview_mode=basic';
  a.setMode(m);
  const bar = Node('div', 'js-actions');
  a.bar(bar);
  const tg = bar.querySelector('.tt-set-toggle');
  tg.on.click({ preventDefault() {}, stopPropagation() {} });
  ok(m + ': the cookie says advanced', /docker_listview_mode=advanced/.test(doc.cookie), doc.cookie);
  ok(m + ': the view is drawn again', a.calls.render === 1, String(a.calls.render));
  a.timers.forEach((f) => f());
  ok(m + ': the hidden table is not enhanced behind it', a.calls.enhance === 0, String(a.calls.enhance));
}
{
  const { doc, a } = setup({});
  doc.cookie = 'docker_listview_mode=basic';
  const bar = Node('div', 'js-actions');
  a.bar(bar);
  bar.querySelector('.tt-set-toggle').on.click({ preventDefault() {}, stopPropagation() {} });
  ok('list: no card view is drawn', a.calls.render === 0);
  a.timers.forEach((f) => f());
  ok('list: the fallback repaint still runs', a.calls.enhance === 1, String(a.calls.enhance));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
