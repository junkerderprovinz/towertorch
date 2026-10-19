// Runs renderFolderView() out of docker.js against a synthetic organizer tree,
// with its collaborators (folderTile, ensureGridHolder, makeGear and the rest)
// stubbed, as in folder-mode-everywhere.test.js.
//
// It pins two things: every container, loose or in a folder, is a tile, with
// no density choice left to pick anything else, and a rebuild puts the page
// back at the scroll position it was at.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// A DOM shim for el()-built nodes and a stand-in gridHolder.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle() {}
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.dataset = {};
    this.listeners = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.draggable = false;
  }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
function el(tag, cls, txt) { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

function run(entries, opts) {
  opts = opts || {};
  const scrollCalls = [];
  const fakeGridHolder = new N('div');
  let removed = false;
  const fakeWindow = {
    _scrollY: opts.scrollY != null ? opts.scrollY : 0,
    get scrollY() { return this._scrollY; },
    scrollTo(x, y) { scrollCalls.push([x, y]); },
  };
  const ccOrgView = opts.noOrgView ? null : { rootId: 'root', flatEntries: entries };
  const containers = {}; (opts.containers || []).forEach(c => { containers[c.name.replace(/^\//, '').toLowerCase()] = c; });
  // Every collaborator renderFolderView() names resolves here; one not listed returns a bare node,
  // so the harness keeps working as the folder head gains parts.
  const given = Object.assign({
    el, window: fakeWindow, localStorage: { getItem: () => null }, gridHolder: fakeGridHolder, ccOrgView, filterText: '', mode: 'folder', folderDrag: null,
    removeGridHolder: () => { removed = true; },
    effc: () => '', iconBgOn: () => false, gridFocusKey: () => null, ccGlyph: (n) => '<glyph ' + n + '>', t: (k) => k, LANG: 'en',
    folderTile: (c, row) => { const n = el('div', 'cc-card cc-tile'); n.row = row; const h = el('div', 'cc-tile-head'); n.appendChild(h); n.querySelector = (sel) => (sel === '.cc-tile-head' ? h : null); return n; },
    findRows: () => (opts.rows || []), rowName: (r) => r.name,
    containerByName: (name) => containers[String(name).toLowerCase()] || null,
    ccFolderHidesContainer: () => false, ccEffectiveCollapsed: () => false, ccEntryMatches: () => true,
    folderHidesStopped: () => false, ccCollectFolderContainerNames: () => [],
    folderActBtn: (cls) => el('button', cls), stats: {},
  }, opts.given || {});
  const scope = new Proxy({}, {
    has: (o, k) => k in given || !(k in globalThis),
    get: (o, k) => (k in given ? given[k] : k === Symbol.unscopables ? undefined : () => el('span', 'cc-stub')),
    set: (o, k, v) => { given[k] = v; return true; },
  });
  const fn = new Function('scope', 'with (scope) { ' + grabFn('renderFolderView') + '\nreturn renderFolderView; }')(scope);
  fn();
  return { gridHolder: fakeGridHolder, scrollCalls: scrollCalls, removed: removed };
}

console.log('\nrenderFolderView() draws every container as a tile');
{
  const plex = { name: 'plex', state: 'running' }, sonarr = { name: 'sonarr', state: 'exited' };
  const entries = [
    { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 },
    { id: 'f1', type: 'folder', name: 'Media', parentId: 'root', position: 1 },
    { id: 'e2', type: 'container', name: '/sonarr', parentId: 'f1', position: 0 },
  ];
  const rowP = { name: 'plex' };
  const out = run(entries, { containers: [plex, sonarr], rows: [rowP] });
  const tiles = []; const walk = n => n.children.forEach(ch => { if (ch.classList.contains('cc-tile')) tiles.push(ch); walk(ch); }); walk(out.gridHolder);
  ok('the loose container and the one in the folder are both tiles', tiles.length === 2, tiles.length);
  ok('a tile gets its native row handed in, looked up once per render', tiles.some(t2 => t2.row === rowP));
  ok('a container without a native row still renders', tiles.some(t2 => t2.row === undefined));
  ok('the folder view root carries no density class', !/cc-folderview-(grid|list)/.test(out.gridHolder.children[0].className), out.gridHolder.children[0].className);
  ok('renderFolderView() reads no density', !/folderDensity|folderChip|folderListRow/.test(grabFn('renderFolderView')));
}

console.log('\nrenderFolderView() preserves the scroll position across a full rebuild');
{
  console.log('\n  ...with an empty organizer tree, where gridHolder is still torn down and rebuilt');
  const empty = run([], { scrollY: 842 });
  ok('window.scrollTo() was called once', empty.scrollCalls.length === 1, JSON.stringify(empty.scrollCalls));
  ok('...restoring the pre-render scrollY at x=0', JSON.stringify(empty.scrollCalls[0]) === JSON.stringify([0, 842]), JSON.stringify(empty.scrollCalls));

  console.log('\n  ...with real content re-rendered');
  const c = { name: '/plex', state: 'running' };
  const entry = { id: 'e1', type: 'container', name: '/plex', parentId: 'root', position: 0 };
  const withContent = run([entry], { containers: [c], scrollY: 1337 });
  ok('scroll is still restored to the pre-render value after a non-trivial rebuild', JSON.stringify(withContent.scrollCalls[0]) === JSON.stringify([0, 1337]), JSON.stringify(withContent.scrollCalls));

  console.log('\n  ...and on the early return taken while ccOrgView is not loaded yet');
  const guarded = run([], { noOrgView: true, scrollY: 55 });
  ok('the early return calls window.scrollTo() before it leaves', guarded.scrollCalls.length === 1 && JSON.stringify(guarded.scrollCalls[0]) === JSON.stringify([0, 55]), JSON.stringify(guarded.scrollCalls));
  ok('...and still tears the grid holder down through removeGridHolder()', guarded.removed === true);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
