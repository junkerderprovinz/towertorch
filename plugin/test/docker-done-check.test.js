// A finished action draws a check where its progress showed and takes it away again: beside the
// state badges after a start, stop or restart, on the Save button of the start plan's window
// before the window closes, on the plan's save in the menu, and in the update window's status
// badge once the update is through.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
function Node(tag, cls) {
  const n = { tag, kids: [], parentNode: null, dataset: {}, cls: new Set((cls || '').split(' ').filter(Boolean)) };
  n.insertBefore = (k, before) => { const i = before ? n.kids.indexOf(before) : -1; if (i < 0) n.kids.push(k); else n.kids.splice(i, 0, k); k.parentNode = n; return k; };
  n.removeChild = (k) => { n.kids.splice(n.kids.indexOf(k), 1); k.parentNode = null; return k; };
  Object.defineProperty(n, 'firstChild', { get: () => n.kids[0] || null });
  return n;
}
const has = (n, c) => n.kids.some((k) => k.cls.has(c));

const stubs = `
  var LANG = "de", pendingAction = {}, unpauseGrace = {}, openPop = null, mode = "grid", config = {}, timers = [], flashes = [], closed = 0, rendered = 0;
  function el(tag, cls) { return Node(tag, cls); }
  function t(k) { return k; }
  function setTimeout(f, ms) { timers.push({ f: f, ms: ms }); }
  function flash(m) { flashes.push(m); }
  function markTransient() {} function syncStateBadges() {}
  function load() { return Promise.resolve(); }
  function api() { return Promise.resolve({}); }
  function collectPlan() { return { nodes: [] }; }
  function setWatchdog() {} function setSchedules() {} function setIdleStop() {}
  function closePop() { closed++; openPop = null; }
  function renderCurrentView() { rendered++; } function reinjectRowBadges() {}
  var CSS = { escape: function (s) { return s; } };
`;
const badges = [];
const doc = { querySelectorAll: (sel) => badges.filter((b) => sel === '.tt-badge[data-name="' + b.dataset.name + '"]') };
const drawn = [];
const win = { TTPictures: { drawCheck: (host, label) => { drawn.push([host, label]); } } };
const api = new Function('Node', 'window', 'document', stubs + ['confirmCheck', 'confirmAction', 'doAction', 'saveEditor', 'savePlan', 'apply'].map(grabFn).join('\n') +
  '\nvar CHECK_HOLD = 1600, SAVE_HOLD = 700;' +
  '\nreturn { doAction: doAction, saveEditor: saveEditor, savePlan: savePlan, timers: timers, setPop: function (p) { openPop = p; }, closed: function () { return closed; }, rendered: function () { return rendered; } };')(Node, win, doc);
const tick = () => new Promise((r) => setImmediate(r));
const run = (ms) => { const due = api.timers.filter((x) => x.ms === ms); due.forEach((x) => { api.timers.splice(api.timers.indexOf(x), 1); x.f(); }); };

(async () => {
  console.log('\nA start draws its check beside the state badges');
  {
    const row = Node('div', 'tt-card-cornerrow'), dot = Node('span', 'tt-badge');
    dot.dataset.name = 'Plex'; row.insertBefore(dot); badges.push(dot);
    api.doAction('Plex', 'start');
    await tick(); await tick(); await tick();
    ok('the check stands right before the badge', row.kids[0].cls.has('tt-done-check') && row.kids[1] === dot);
    ok('it is drawn by the shared picture kit, named for the screen reader', drawn.length === 1 && drawn[0][0] === row.kids[0] && drawn[0][1] === 'done');
    run(1600);
    ok('and leaves again after a moment', !has(row, 'tt-done-check') && row.kids.length === 1);
  }

  console.log('\nSaving the plan\'s window draws on its button, then closes');
  {
    const pop = { id: 'pop' }, btn = Node('span', 'tt-btn'), label = Node('#text');
    btn.insertBefore(label);
    api.setPop(pop); drawn.length = 0;
    api.saveEditor('Plex', null, [], null, false, btn);
    await tick(); await tick(); await tick(); await tick();
    ok('the check comes before the label', btn.kids[0].cls.has('tt-done-check') && btn.kids[1] === label);
    ok('the window is still open while it draws', api.closed() === 0);
    ok('the view behind it is already redrawn', api.rendered() === 1);
    run(700);
    ok('then the window closes', api.closed() === 1);
    api.setPop({ id: 'other' });
    api.saveEditor('Plex', null, [], null, false, btn);
    await tick(); await tick(); await tick(); await tick();
    api.setPop({ id: 'another' });
    run(700);
    ok('a window opened in between stays open', api.closed() === 1);
  }

  console.log('\nThe plan\'s save in the menu draws on its button');
  {
    const btn = Node('button', 'tt-btn'); btn.insertBefore(Node('#text'));
    api.savePlan(false, btn);
    await tick(); await tick();
    ok('a plain save', btn.kids[0].cls.has('tt-done-check'));
    const fire = Node('button', 'tt-btn'); fire.insertBefore(Node('#text'));
    api.savePlan(true, fire);
    await tick(); await tick(); await tick(); await tick();
    ok('a save that starts the plan, once the start is through', fire.kids[0].cls.has('tt-done-check'));
  }

  console.log('\nThe update window draws its check in the status badge');
  {
    ok('a finished update draws instead of showing a still glyph', /sb\.setAttribute\("aria-label", "Fertig"\); sb\.innerHTML = ""; confirmCheck\(sb\);/.test(src));
    ok('the finished badge leaves with its check', /#tt-ctout-status\.tt-ctout-done:not\(:has\(\.tt-done-check\)\) \{ visibility: hidden; \}/.test(css));
    ok('a check in a button or the badge takes its ink', /:is\(\.tt-btn, #tt-ctout-status\) > \.tt-done-check \{ color: inherit;/.test(css));
  }

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
