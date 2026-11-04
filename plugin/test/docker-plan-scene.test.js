// The start plan's window shows the plan as a scene: the stages are the engine's own, a station
// lights up when its stage and delay come round and draws its check when it is ready, the arrows
// run from each dependency to the container waiting for it. Only the window's own container and its
// chain stand in the scene; a container on its own gets a single station and a sentence. Under
// reduced motion the scene shows its end frame, and a change to the chain draws it again.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const go = fs.readFileSync(path.join(__dirname, '..', '..', 'internal', 'orchestrator', 'orchestrator.go'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Elements rich enough for the scene: class lists, single-class lookups, children and offsets,
// all of which read 0 here.
function Node(tag, cls, text) {
  const n = { tag, kids: [], parentNode: null, attrs: {}, dataset: {}, style: { setProperty() {}, removeProperty() {} }, textContent: text || '', isConnected: true, offsetLeft: 0, offsetTop: 0, offsetWidth: 40, offsetHeight: 40, offsetParent: null, clientWidth: 500, clientHeight: 200 };
  const classes = new Set((cls || '').split(' ').filter(Boolean));
  n.classList = {
    contains: (c) => classes.has(c), add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
    toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; },
  };
  n.appendChild = (k) => { n.kids.push(k); k.parentNode = n; return k; };
  n.removeChild = (k) => { n.kids.splice(n.kids.indexOf(k), 1); k.parentNode = null; return k; };
  Object.defineProperty(n, 'firstChild', { get: () => n.kids[0] || null });
  Object.defineProperty(n, 'children', { get: () => n.kids });
  Object.defineProperty(n, 'innerHTML', { set: () => { n.kids = []; } });
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); if (k === 'class') v.split(' ').forEach((c) => classes.add(c)); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.querySelectorAll = (sel) => { const c = sel.replace(/^\./, ''), out = []; const walk = (x) => x.kids.forEach((k) => { if (k.classList.contains(c)) out.push(k); walk(k); }); walk(n); return out; };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  return n;
}

const stubs = `
  var LANG = "de", workingPlan = {}, sceneRoot = null, tintCalls = 0, timers = [];
  var document = { createElementNS: function (ns, tag) { return Node(tag); } };
  var localStorage = { getItem: function () { return null; } };
  var performance = { now: function () { return 0; } };
  function setTimeout(f, ms) { timers.push({ f: f, ms: ms }); return timers.length; }
  function clearTimeout() {}
  function ResizeObserver() { this.observe = function () {}; this.disconnect = function () {}; }
  function el(tag, cls, text) { return Node(tag, cls, text); }
  function t(k) { return { sceneTitle: "Startablauf", sceneAlone: "Wartet auf niemanden.", sceneCycle: "Im Kreis." }[k] || k; }
  function infoBubble() { return el("span", "tt-info"); }
  function stampCardRainbow() {}
  function cardIcon() { return el("span", "tt-card-icobox"); }
  function iconBgOn() { return false; }
  function applyIconTint() { tintCalls++; }
  function collectPlan() { return { nodes: Object.keys(workingPlan).map(function (k) { return workingPlan[k]; }) }; }
`;
function make(still) {
  const P = { still: () => still, checks: [], flows: [] };
  P.drawCheck = (host) => { P.checks.push(host); host.appendChild(Node('svg', 'tt-check')); };
  P.flow = (svg, from, to) => { const g = Node('g', 'tt-flow'); svg.appendChild(g); P.flows.push([from, to]); return { el: g }; };
  const api = new Function('Node', 'window', stubs + ['planStages', 'planChain', 'sceneTimes', 'planScene'].map(grabFn).join('\n') +
    '\nvar SCENE_READY = 700, SCENE_GAP = 600, SCENE_DELAY = 1500;' +
    '\nreturn { planStages: planStages, planChain: planChain, sceneTimes: sceneTimes, planScene: planScene, plan: workingPlan, timers: timers, tint: function () { return tintCalls; } };')(Node, { TTPictures: P });
  return { api, P };
}
const node = (name, after, extra) => Object.assign({ name, after: after || [] }, extra || {});
const names = (st) => st.map((s) => s.map((n) => n.name).join(',')).join(' | ');
const shown = (fig) => fig.querySelectorAll('.tt-sn').map((s) => s.dataset.name).sort().join(',');

console.log('\nThe stages are the engine\'s');
{
  const { api } = make(true);
  ok('the engine forms stages the same way', /func TopoStages/.test(go) && /StartOrder only reorders peers within a stage/.test(go));
  const ps = api.planStages([node('Caddy', ['CrowdSec']), node('Nextcloud', ['MariaDB']), node('Plex', [], { start_order: 1 }), node('Nginx', ['Nextcloud'])]);
  ok('a dependency outside the plan joins it, and the start order sorts within a stage', names(ps.stages) === 'Plex,CrowdSec,MariaDB | Caddy,Nextcloud | Nginx', names(ps.stages));
  ok('nothing is stuck', ps.stuck.length === 0);
  const cyc = api.planStages([node('A', ['B']), node('B', ['A']), node('C')]);
  ok('a cycle leaves its nodes stuck and the rest staged', names(cyc.stages) === 'C' && cyc.stuck.map((n) => n.name).join(',') === 'A,B');
}

console.log('\nThe chain is everything above and below the container, in the engine\'s stages');
{
  const { api } = make(true);
  const plan = [node('Nextcloud', ['MariaDB', 'Redis']), node('Nginx', ['Nextcloud']), node('Collabora', ['Nextcloud']), node('Proxy', ['Nginx', 'Authelia']),
    node('Wiki', ['MariaDB']), node('Caddy', ['CrowdSec']), node('Plex')];
  const ch = (name) => { const c = api.planChain(api.planStages(plan), name); return c && names(c.stages); };
  ok('upwards and downwards, through every link', ch('Nextcloud') === 'MariaDB,Redis | Nextcloud | Nginx,Collabora | Proxy', ch('Nextcloud'));
  ok('a sibling\'s other dependency stays out, the one further down keeps its stage', ch('Nginx') === 'MariaDB,Redis | Nextcloud | Nginx | Proxy', ch('Nginx'));
  ok('a shared dependency carries everyone that waits for it', ch('MariaDB') === 'MariaDB | Nextcloud,Wiki | Nginx,Collabora | Proxy', ch('MariaDB'));
  ok('a container on its own is its own chain', ch('Plex') === 'Plex');
  ok('so is a container the plan does not know', ch('Tautulli') === 'Tautulli');
  const cyc = [node('A', ['B']), node('B', ['A']), node('C', ['D']), node('E', ['A'])];
  const chain = (name) => api.planChain(api.planStages(cyc), name);
  ok('a cycle in the chain comes along stuck', chain('E').stuck.map((n) => n.name).sort().join(',') === 'A,B,E' && names(chain('E').stages) === '');
  ok('a cycle elsewhere stays out', chain('C').stuck.length === 0 && names(chain('C').stages) === 'D | C');
}

console.log('\nA station lights when its stage and its delay come round');
{
  const { api } = make(true);
  const ps = api.planStages([node('Caddy', ['CrowdSec'], { delay_seconds: 50 }), node('Obsidian', ['CouchDB'], { delay_seconds: 20 })]);
  const at = api.sceneTimes(ps.stages);
  ok('a stage waits until every station before it is ready', at.Caddy.start >= Math.max(at.CrowdSec.ready, at.CouchDB.ready) && at.Obsidian.start >= at.CouchDB.ready);
  ok('the longer delay holds its station back longer, in proportion', Math.abs((at.Caddy.start - at.Obsidian.start) - (50 - 20) / 50 * 1500) < 141, String(at.Caddy.start - at.Obsidian.start));
  ok('a station is ready a moment after it lights', at.Caddy.ready - at.Caddy.start === 700);
}

console.log('\nThe scene draws the chain, and its end frame under reduced motion');
{
  const { api, P } = make(true);
  Object.assign(api.plan, { Caddy: node('Caddy', ['CrowdSec']), Nextcloud: node('Nextcloud', ['MariaDB']), Nginx: node('Nginx', ['Caddy', 'Redis']), Plex: node('Plex'), Tautulli: node('Tautulli') });
  const sc = api.planScene('Caddy');
  sc.update();
  const fig = sc.el, sn = fig.querySelectorAll('.tt-sn');
  const chain = fig.querySelector('.tt-plan-scene-chain');
  ok('only the chain is drawn, its outside dependency too', shown(fig) === 'Caddy,CrowdSec,Nginx', shown(fig));
  ok('the chain stands in stage columns', chain.querySelectorAll('.tt-plan-scene-stage').map((c) => c.querySelectorAll('.tt-sn').map((s) => s.dataset.name).join(',')).join(' | ') === 'CrowdSec | Caddy | Nginx');
  ok('no strip for the containers without dependencies', !fig.querySelector('.tt-plan-scene-free') && !fig.querySelector('.tt-plan-scene-sub'));
  ok('the sentence for a lone container is hidden', fig.querySelector('.tt-plan-scene-alone').classList.contains('tt-hidden'));
  ok('the window\'s own container is marked', fig.querySelectorAll('.tt-sn-focus').map((s) => s.dataset.name).join() === 'Caddy');
  ok('one arrow per dependency in the chain, none from outside it', P.flows.length === 2 && fig.querySelectorAll('.tt-plan-scene-edge').length === 2);
  ok('each arrow has its head', fig.querySelectorAll('.tt-plan-scene-head').length === 2);
  ok('the end frame shows every station lit and ready', sn.every((s) => s.classList.contains('tt-sn-on') && s.classList.contains('tt-sn-ready')));
  ok('with a drawn check on each', P.checks.length === 3 && fig.querySelectorAll('.tt-check').length === 3);
  ok('the arrows are drawn through and carry no packets', fig.querySelectorAll('.tt-plan-scene-on').length === 2 && fig.querySelectorAll('.tt-plan-scene-live').length === 0);
  ok('nothing waits on a timer', api.timers.length === 0);
  ok('the logos go through the icon pipeline', api.tint() === 1);
  ok('the label reads the chain\'s order', fig.getAttribute('aria-label') === 'Startablauf: CrowdSec, dann Caddy, dann Nginx', fig.getAttribute('aria-label'));
  sc.update();
  ok('an unchanged plan is not drawn again', P.checks.length === 3 && api.tint() === 1);
  api.plan.Tautulli = node('Tautulli', ['Plex']);
  sc.update();
  ok('a change outside the chain is not drawn either', api.tint() === 1);
  api.plan.Caddy = node('Caddy', ['CrowdSec', 'Nextcloud']);
  sc.update();
  ok('a new dependency of the container draws the chain again, longer', api.tint() === 2 && shown(fig) === 'Caddy,CrowdSec,MariaDB,Nextcloud,Nginx' && fig.querySelectorAll('.tt-plan-scene-stage').length === 4 && P.flows.length === 6, shown(fig));
  api.plan.Caddy = node('Caddy');
  delete api.plan.Nginx;
  sc.update();
  ok('dropping every link leaves the one station', api.tint() === 3 && shown(fig) === 'Caddy' && fig.querySelectorAll('.tt-sn-focus').length === 1, shown(fig));
  ok('with its sentence', fig.querySelector('.tt-plan-scene-chain').classList.contains('tt-plan-scene-lone') && !fig.querySelector('.tt-plan-scene-alone').classList.contains('tt-hidden') && /Wartet auf niemanden\.$/.test(fig.getAttribute('aria-label')));
  ok('and it still lights up and draws its check', fig.querySelector('.tt-sn').classList.contains('tt-sn-ready'));
  delete api.plan.Caddy;
  sc.update();
  ok('taking it out of the plan keeps it standing alone', !fig.classList.contains('tt-hidden') && shown(fig) === 'Caddy' && api.tint() === 3 && !fig.querySelector('.tt-plan-scene-alone').classList.contains('tt-hidden'));
  for (const k of Object.keys(api.plan)) delete api.plan[k];
  sc.update();
  ok('even an empty plan shows the container', !fig.classList.contains('tt-hidden') && shown(fig) === 'Caddy');
}

console.log('\nWith motion the stations wait grey for their turn');
{
  const { api, P } = make(false);
  Object.assign(api.plan, { Caddy: node('Caddy', ['CrowdSec']) });
  const sc = api.planScene('Caddy');
  sc.update();
  const st = (n) => sc.el.querySelectorAll('.tt-sn').filter((s) => s.dataset.name === n)[0];
  ok('before the first mark every station is grey', !st('CrowdSec').classList.contains('tt-sn-on') && !st('Caddy').classList.contains('tt-sn-on'));
  ok('timers carry the scene, a finite number of them', api.timers.length > 0 && api.timers.every((x) => isFinite(x.ms)));
  ok('no check is drawn yet', P.checks.length === 0);
}

console.log('\nA cycle stays grey and says why, when it is in the chain');
{
  const { api, P } = make(true);
  Object.assign(api.plan, { A: node('A', ['B']), B: node('B', ['A']), C: node('C', ['D']) });
  const sc = api.planScene('A');
  sc.update();
  ok('the stuck stations never light', shown(sc.el) === 'A,B' && sc.el.querySelectorAll('.tt-sn-on').length === 0 && P.checks.length === 0);
  ok('the note shows', !sc.el.querySelector('.tt-plan-scene-stuck').classList.contains('tt-hidden'));
  const other = api.planScene('C');
  other.update();
  ok('a cycle outside the chain neither shows nor greys anything', other.el.querySelector('.tt-plan-scene-stuck').classList.contains('tt-hidden') && shown(other.el) === 'C,D' && other.el.querySelectorAll('.tt-sn-ready').length === 2);
}

console.log('\nThe window carries the scene and redraws it on a change');
{
  const ed = grabFn('openEditor');
  ok('the scene sits under the manage switch', /pop\.appendChild\(mrow\);\s*\n\s*var scene = planScene\(name\); pop\.appendChild\(scene\.el\);/.test(ed));
  ok('every commit tells the scene', /function commit\(\) \{\s*\n\s*scene\.changed\(\);/.test(ed));
  ok('it plays once the window stands', /placePop\(pop, anchor, 320\);[^\n]*\n\s*scene\.update\(\);/.test(ed));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
