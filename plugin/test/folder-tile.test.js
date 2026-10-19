// The folder view draws every container as one tile of a fixed size. folderTile(),
// updateReady(), actBtn(), gauge() and their small helpers are sliced out of
// docker.js and run against a DOM shim, and this pins what a tile carries:
//   1. the icon behind a menu button, the name, the IP under it when there is one;
//   2. an update badge only while Unraid's list offers the apply link, running
//      updateContainer() like the list's own action;
//   3. CPU and RAM bars only while the container runs, in the order refreshStats()
//      updates them;
//   4. the state dot and word, and the actions WebUI, start or stop, restart;
//   5. the full name in the hover bubble only when the ellipsis cuts it;
//   6. no density choice left anywhere in the folder view.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const DOCKER = process.argv[2] || path.join(DIR, 'scripts', 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.listeners = {}; this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(t) { (this.listeners[t] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {} })); }
  querySelector() { return null; }
}
const find = (n, cls) => { if (n.classList.contains(cls)) return n; for (const c of n.children) { const f = find(c, cls); if (f) return f; } return null; };
const findAll = (n, cls, out = []) => { if (n.classList.contains(cls)) out.push(n); n.children.forEach(c => findAll(c, cls, out)); return out; };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const calls = [];
const env = {
  document: { createElement: t => new N(t) },
  window: { updateContainer: (n) => calls.push(['update', n]), open: (u) => calls.push(['open', u]) },
  LANG: 'en', T: { en: { update: 'Update', updateCt: 'Update', start: 'Start', stop: 'Stop', resume: 'Resume', restart: 'Restart' } },
  STATE_LABELS: { en: { running: 'running', exited: 'stopped', paused: 'paused' } },
  filterText: '', stats: {}, ctx: {},
};
const scope = new Proxy(env, {
  has: (o, k) => k in env || !(k in globalThis),
  get: (o, k) => (k in env ? env[k] : k === Symbol.unscopables ? undefined : () => {}),
  set: (o, k, v) => { env[k] = v; return true; },
});
const api = new Function('scope', 'with (scope) {\n' +
  ['el', 'norm', 't', 'stateLabel', 'humanBytes', 'gauge', 'actBtn', 'actBtnOff', 'cardIcon', 'folderTile', 'updateReady'].map(grabFn).join('\n') +
  '\nreturn { folderTile: folderTile, updateReady: updateReady }; }')(scope);
env.ctxFor = (name) => Object.assign({ webui: '', links: [] }, env.ctx[name] || {});
env.doAction = (name, action) => calls.push([action, name]);
env.containerMenu = (anchor, c) => calls.push(['menu', c.name]);
env.showUnhealthy = () => false;
env.iconFor = () => '/icons/x.png';
const row = (update) => ({ querySelector: (sel) => (update && sel === 'td.updatecolumn > a.exec' ? {} : null) });

console.log('\nThe tile\'s parts');
{
  env.stats = { plex: { cpu_percent: 12, mem_percent: 40, mem_used: 1024 * 1024 * 512, mem_limit: 1024 * 1024 * 1024 * 8 } };
  env.ctx = { plex: { webui: 'http://plex' } };
  const tile = api.folderTile({ name: 'plex', state: 'running', ip: '192.168.20.5' }, row(true));
  ok('it is a cc-card for the colour plumbing and a cc-tile for its fixed size', tile.classList.contains('cc-card') && tile.classList.contains('cc-tile'));
  ok('it is tagged with the container name, as refreshStats() looks it up', tile.dataset.name === 'plex');
  const icoBtn = find(tile, 'cc-tile-icobtn');
  ok('the icon sits in a button that opens the container menu', !!icoBtn && !!find(icoBtn, 'cc-card-ico'));
  icoBtn.fire('click');
  ok('a click on the icon opens the menu', calls.some(c => c[0] === 'menu' && c[1] === 'plex'));
  ok('the name is shown', find(tile, 'cc-tile-name').textContent === 'plex');
  ok('the IP sits under it', find(tile, 'cc-tile-ip').textContent === '192.168.20.5');
  const up = find(tile, 'cc-tile-up');
  ok('an update badge shows while the list offers the apply link', !!up && up.textContent === 'Update');
  calls.length = 0; up.fire('click');
  ok('it starts the update through updateContainer(), as the list does', calls.length === 1 && calls[0][0] === 'update' && calls[0][1] === 'plex');
  const bars = findAll(tile, 'cc-gauge-fill'), vals = findAll(tile, 'cc-stat-val');
  ok('two bars while it runs, CPU first and RAM second, as refreshStats() expects', bars.length === 2 && vals[0].textContent === '12%' && /512M/.test(vals[1].textContent), vals.map(v => v.textContent).join(' | '));
  ok('the CPU bar is filled to its value', bars[0].style.width === '12%');
  const dot = find(tile, 'cc-tile-dot');
  ok('the state dot is a badge the poll keeps in sync', dot.classList.contains('cc-badge') && dot.classList.contains('cc-badge-running') && dot.dataset.name === 'plex');
  const acts = find(tile, 'cc-tile-act');
  ok('the actions reveal like every other row\'s', acts.classList.contains('cc-mrow-act'));
  const tips = acts.children.map(b => b.getAttribute('data-tip'));
  ok('WebUI, Stop and Restart for a running container with a WebUI', JSON.stringify(tips) === JSON.stringify(['WebUI', 'Stop', 'Restart']), tips.join(', '));
  calls.length = 0; acts.children[0].fire('click');
  ok('WebUI opens the container\'s page', calls[0] && calls[0][0] === 'open' && calls[0][1] === 'http://plex');
  ok('no uptime and no image tag on the tile', !find(tile, 'cc-card-img') && !/uptime/i.test(JSON.stringify(tile.className)));
}

console.log('\nA stopped container');
{
  env.ctx = {};
  const tile = api.folderTile({ name: 'radarr', state: 'exited' }, row(false));
  ok('no bars, the space stays empty', findAll(tile, 'cc-gauge').length === 0 && !!find(tile, 'cc-tile-stats'));
  ok('no IP line without an IP', !find(tile, 'cc-tile-ip'));
  ok('no update badge without an apply link', !find(tile, 'cc-tile-up'));
  ok('the state word says stopped', find(tile, 'cc-tile-status').textContent === 'stopped');
  const tips = find(tile, 'cc-tile-act').children.map(b => b.getAttribute('data-tip'));
  ok('no WebUI button without a WebUI, then Start and Restart', JSON.stringify(tips) === JSON.stringify(['Start', 'Restart']), tips.join(', '));
  env.ctx = { radarr: { webui: 'http://radarr' } };
  const withUi = api.folderTile({ name: 'radarr', state: 'exited' }, row(false));
  ok('a stopped container with a WebUI shows it greyed out', find(withUi, 'cc-tile-act').children[0].classList.contains('cc-actoff'));
}

console.log('\nA paused container resumes');
{
  env.ctx = {};
  const tile = api.folderTile({ name: 'db', state: 'paused' }, row(false));
  const first = find(tile, 'cc-tile-act').children[0];
  calls.length = 0; first.fire('click');
  ok('the start and stop slot reads Resume and unpauses', first.getAttribute('data-tip') === 'Resume' && calls[0][0] === 'unpause');
}

console.log('\nThe full name in the bubble only when cut');
{
  const tile = api.folderTile({ name: 'a-very-long-container-name', state: 'exited' }, row(false));
  const nm = find(tile, 'cc-tile-name');
  nm.scrollWidth = 300; nm.clientWidth = 120; nm.fire('mouseover');
  ok('a cut name puts itself in data-tip', nm.getAttribute('data-tip') === 'a-very-long-container-name');
  nm.scrollWidth = 100; nm.fire('mouseover');
  ok('a name that fits drops it again', nm.getAttribute('data-tip') === null);
  ok('no title attribute, the bubble is CC\'s own', nm.getAttribute('title') === null);
}

console.log('\nThe live search hides a tile that does not match');
{
  env.filterText = 'son';
  ok('a miss is hidden', api.folderTile({ name: 'radarr', state: 'exited' }, row(false)).style.display === 'none');
  ok('a match stays', api.folderTile({ name: 'sonarr', state: 'exited' }, row(false)).style.display !== 'none');
  env.filterText = '';
}

console.log('\nThe density choice is gone');
{
  ok('no density reader or writer and no chip or list-row builder', !/function (folderDensity|setFolderDensity|folderChip|folderListRow)\(/.test(src));
  ok('the stored cc.folderDensity is not read', src.indexOf('cc.folderDensity') < 0);
  ok('the gear menu offers no folder content choice', !/folderContent|"Detailliert"/.test(src));
  const css = fs.readFileSync(path.join(DIR, 'styles', 'docker.css'), 'utf8');
  ok('docker.css has no rules left for the chip or the list row', !/\.cc-(chip|frow)\b|cc-folderview-(grid|list)|cc-folder-group-body-(grid|list)/.test(css));
  ok('every tile has the same size on one fixed grid column', /\.cc-card\.cc-tile \{[^}]*width: 264px; height: var\(--cc-tile-h\);/.test(css) && /\.cc-folderview, \.cc-folder-group-body \{ display: grid; grid-template-columns: repeat\(auto-fill, 264px\);/.test(css));
  ok('one height for the simple view and a taller one with the bars of the advanced view', /\.cc-grid-holder \{ --cc-tile-h: 84px; \}/.test(css) && /\.cc-grid-holder\.cc-adv \{ --cc-tile-h: 122px; \}/.test(css) && /\.cc-grid-holder:not\(\.cc-adv\) \.cc-tile-stats \{ display: none; \}/.test(css));
  ok('the logo box runs the tile\'s full height on its left', /\.cc-card\.cc-tile \{[^}]*flex-direction: row;/.test(css) && /\.cc-tile-icobtn \{[^}]*align-self: stretch;/.test(css));
  ok('the box carries the tile colour, never the logo the ink filter runs over', /\.cc-grid-holder\.cc-docker-iconbg \.cc-card-icobox \{/.test(css) && !/\.cc-card-ico \{[^}]*background/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
