// A running container shows no state dot. The hide rule is keyed on the dot's own class, and
// the state poll rewrites each badge's className every few seconds, so the poll has to carry
// that class over: a first render that looks right says nothing about the tenth.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

// Just enough of an element for the poll: className and classList stay in step.
function badge(cls, name) {
  const attrs = {};
  const b = {
    className: cls, textContent: '', dataset: { name },
    setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
  };
  const list = () => b.className.split(/\s+/).filter(Boolean);
  b.classList = new Proxy({}, {
    get: (t, k) => (k === 'contains' ? (c) => list().includes(c) : k === 'length' ? list().length : list()[k]),
    has: (t, k) => k in list(),
  });
  return b;
}

function poll(badges, containers) {
  const fn = new Function('document', 'pendingAction', 'containerByName', 'stateLabel', 'showUnhealthy', 'unhealthyTip', 't', 'syncActionBars',
    grabFn('syncStateBadges') + '\nreturn syncStateBadges;');
  const doc = { querySelectorAll: () => badges };
  fn(doc, {}, (n) => containers[n], (s) => s, (c) => !!c.unhealthy, () => 'unhealthy', (k) => k, () => {})();
}

const DOT = badge('tt-badge tt-badge-running tt-ct-statedot', 'web');
const TILE = badge('tt-badge tt-tile-dot tt-badge-running', 'web');
const TOGGLE = badge('tt-badge tt-badge-running tt-badge-toggle', 'web');
const box = { web: { name: 'web', state: 'running' } };

console.log('\nThe poll keeps the class the hide rule needs');
poll([DOT, TILE, TOGGLE], box);
ok('the list dot is still a statedot after a poll', DOT.classList.contains('tt-ct-statedot'), DOT.className);
ok('the tile dot is still a tile dot', TILE.classList.contains('tt-tile-dot'), TILE.className);
ok('the toggle stays a toggle', TOGGLE.classList.contains('tt-badge-toggle'), TOGGLE.className);
ok('the dot\'s tooltip is its state', DOT.getAttribute('data-tip') === 'running');

box.web.state = 'exited';
poll([DOT, TILE], box);
ok('a container that stops swaps the state class', DOT.classList.contains('tt-badge-exited') && !DOT.classList.contains('tt-badge-running'), DOT.className);
ok('without picking up a second state class', DOT.className.split(' ').filter((k) => /^tt-badge-(running|exited)$/.test(k)).length === 1, DOT.className);
box.web.state = 'running'; box.web.unhealthy = true;
poll([DOT], box);
ok('an unhealthy one gains the alert', DOT.classList.contains('tt-badge-alert'));
box.web.unhealthy = false;
poll([DOT], box);
ok('and loses it again once healthy', !DOT.classList.contains('tt-badge-alert') && DOT.classList.contains('tt-ct-statedot'), DOT.className);

console.log('\nAfter the poll the hide rule still catches a running dot');
{
  const dotrow = { tag: 'div', classes: ['tt-ct-dotrow'], attrs: {}, states: {}, html: ['tt-docker-on'], has: ['> .tt-ct-statedot[data-name].tt-badge-running:not(.tt-badge-alert)'] };
  const d = candidates('docker', dotrow, 'display');
  ok('the list dot row is hidden', d.length > 0 && d[d.length - 1].value === 'none');
  const tile = { tag: 'span', classes: TILE.className.split(' '), attrs: { 'data-name': 'web' }, states: {}, html: ['tt-docker-on'] };
  box.web.state = 'running'; poll([TILE], box); tile.classes = TILE.className.split(' ');
  const c = candidates('docker', tile, 'display');
  ok('the tile dot is hidden', c.length > 0 && c[c.length - 1].value === 'none', c.map((x) => x.selector).join(' | '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
