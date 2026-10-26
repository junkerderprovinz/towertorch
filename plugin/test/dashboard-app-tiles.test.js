// The Docker and VM cards on the Dashboard list their items as small tiles (TowerTorch.Dashboard.css)
// and break Unraid's endless fallback for a container without an icon (dashboard.js).
// What can quietly break it:
//   · an item display with !important beats the inline display:none of "Started only"
//   · the icon's hit area no longer covering the tile, so a click on the name does nothing
//   · the fallback loop coming back: Unraid 7.3 has no question.png, and its onerror sets that
//     same address on every failure, a request every few milliseconds for as long as the page is open
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Dashboard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = fs.readFileSync(path.join(DIR, 'scripts/dashboard.js'), 'utf8');
const rules = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) rules.push([m[1].replace(/^@media[^{]*\{/, '').trim(), m[2]]);
const LIST = 'html.cc-dash-on table.dashboard :is(#docker_view, #vm_view)';
const rule = (tail) => rules.find(([s]) => s === LIST + ' ' + tail);
const decl = (r, p) => r && ((new RegExp('(?:^|;)\\s*' + p + ':\\s*([^;]+)').exec(r[1]) || [])[1] || '').trim();

console.log('\nThe items are tiles in a grid');
{
  const cell = rule('> tr.updated > td');
  ok('both lists lay their items out as a grid', /^grid$/.test(decl(cell, 'display')) && /auto-fill/.test(decl(cell, 'grid-template-columns')), cell && cell[1]);
  const item = rule('span.outer');
  ok('an item is a tile without Unraid\'s float', decl(item, 'display') === 'flex' && decl(item, 'float') === 'none');
  ok('its display never outranks the inline one "Started only" sets', !/display:[^;]*!important/.test(item[1]));
  ok('it rests on the chip and lightens under the pointer', /var\(--cc-chip\)/.test(decl(item, 'background')) && /var\(--cc-chip-hover\)/.test(decl(rule('span.outer:hover'), 'background')));
  ok('the corner reads the control radius', decl(item, 'border-radius') === 'var(--cc-radius-control)');
}

console.log('\nRunning ones lead and stay quiet');
{
  const started = +decl(rule('span.outer.started'), 'order'), paused = +decl(rule('span.outer.paused'), 'order');
  ok('running items come first, paused ones next, stopped ones last', started < paused && paused < 0, started + ' ' + paused);
  ok('a running item shows no state', decl(rule('span.outer.started .inner > :is(br, i.started, .state)'), 'display') === 'none');
  const dot = rule('span.outer .inner > i:is(.stopped, .paused)');
  ok('a stopped or paused item shows a round dot instead of Unraid\'s glyph', decl(dot, 'border-radius') === '50%' && decl(dot, 'font-size') === '0');
  ok('paused takes the warning colour', /--cc-warn/.test(decl(rule('span.outer .inner > i.paused'), 'background')));
  ok('a stopped item\'s icon rests grey', /grayscale\(1\)/.test(decl(rule('span.outer.stopped > span.hand > *'), 'filter')));
}

console.log('\nA click anywhere on the tile reaches Unraid\'s handler');
{
  ok('the tile is the positioning box', decl(rule('span.outer'), 'position') === 'relative');
  const hit = rule('span.outer > span.hand::after');
  ok('the icon\'s hit area spans it', decl(hit, 'position') === 'absolute' && decl(hit, 'inset') === '0', hit && hit[1]);
  ok('the hand itself is not positioned, so the area reaches the tile', !/position:/.test(rule('span.outer > span.hand')[1]));
}

// dashboard.js in a minimal browser: localStorage as a map, the document's listeners recorded with
// their capture flag, and an image that knows where it sits.
function run(store) {
  const listeners = [];
  const ctx = {
    window: { addEventListener() {} }, location: { pathname: '/Dashboard' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null) },
    setTimeout: () => 0,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: {
      readyState: 'complete',
      documentElement: { lang: 'de', classList: { toggle() {}, contains: () => false } },
      querySelectorAll: (s) => (/cc-dash-noicon-g/.test(s) ? glyphs : []), querySelector: () => null, getElementById: () => null,
      addEventListener: (t, f, cap) => listeners.push({ t, f, cap }),
    },
  };
  const glyphs = [];
  vm.runInNewContext(js, ctx);
  return { listeners, glyphs, fire: (e) => listeners.filter((l) => l.t === 'error').forEach((l) => l.f(e)) };
}
function picture(src, inDash) {
  const cls = new Set(['hand']);
  const hand = { html: '', classList: { contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c) }, insertAdjacentHTML(_, h) { this.html += h; }, removeChild() {} };
  const at = { onerror: "this.src='/plugins/dynamix.docker.manager/images/question.png';" };
  return {
    tagName: 'IMG', src, parentNode: hand, onerror: () => {}, cls,
    removeAttribute: (n) => { delete at[n]; }, hasAttribute: (n) => n in at,
    closest: (s) => (s === 'table.dashboard' && inDash ? {} : null),
  };
}

console.log('\nA container without an icon asks once');
{
  const r = run({ 'cc.enable.header': '1' });
  ok('the failure is caught on the way down, before the picture\'s own onerror', r.listeners.some((l) => l.t === 'error' && l.cap === true));
  const q = picture('https://tower/plugins/dynamix.docker.manager/images/question.png?1712345678', true);
  r.fire({ target: q });
  ok('the failed fallback loses its onerror, so it is not set again', q.onerror === null && !q.hasAttribute('onerror'));
  ok('the tile shows the Docker glyph in its place', q.cls.has('cc-dash-noicon') && /cc-dash-noicon-g/.test(q.parentNode.html) && /fill="currentColor"/.test(q.parentNode.html));
  r.fire({ target: q });
  ok('a second failure adds no second glyph', (q.parentNode.html.match(/<svg/g) || []).length === 1);
  const own = picture('https://tower/state/plugins/dynamix.docker.manager/images/Claper-icon.png?1712345678', true);
  r.fire({ target: own });
  ok('a missing icon of its own still falls back once, as Unraid intends', typeof own.onerror === 'function' && own.hasAttribute('onerror'));
  const away = picture('https://tower/plugins/dynamix.docker.manager/images/question.png', false);
  r.fire({ target: away });
  ok('a picture outside the Dashboard cards is left alone', typeof away.onerror === 'function');
  const off = run({ 'cc.enable.header': '0' });
  const native = picture('https://tower/plugins/dynamix.docker.manager/images/question.png', true);
  off.fire({ target: native });
  ok('with the area off the Dashboard stays Unraid\'s own', typeof native.onerror === 'function');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
