// The folder view's folder heads and the folder writes. renderFolderView() runs out
// of docker.js against a synthetic organizer tree, and the head's helpers and the
// editor's save plan run on their own. This pins:
//   1. the head counts running members, shows the members' logos only while folded,
//      and the combined CPU and RAM only while one of them runs;
//   2. restart all is always there, update all only with an update ready;
//   3. every folder can be edited, deleted and dragged, whoever created it;
//   4. the New folder tile closes the view, except while a search narrows it;
//   5. the editor's save sends exactly the organizer calls the change needs, in the
//      shape the organizer takes, and a removed container goes back to no folder;
//   6. update all runs Unraid's own update command once for every member that needs it;
//   7. a drop target wears the accent halo.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const src = fs.readFileSync(path.join(DIR, 'scripts', 'docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles', 'docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(name) { const m = src.match(new RegExp('var ' + name + ' = [^;]+;')); if (!m) throw new Error('var not found: ' + name); return m[0]; }

class CL { constructor() { this.s = new Set(); } add(c) { this.s.add(c); } remove(c) { this.s.delete(c); } contains(c) { return this.s.has(c); } toggle() {} }
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.classList = new CL(); this._cls = ''; this._txt = '';
    this.attrs = {}; this.dataset = {}; this.listeners = {}; this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
  }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(t) { (this.listeners[t] || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {} })); }
  querySelector(sel) { return sel === '.cc-tile-head' ? this.children[0] || null : null; }
  querySelectorAll() { return []; }
}
function el(tag, cls, txt) { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
const findAll = (n, cls, out = []) => { if (n.classList.contains(cls)) out.push(n); n.children.forEach(c => findAll(c, cls, out)); return out; };
const find = (n, cls) => findAll(n, cls)[0] || null;

const ENTRIES = [
  { id: 'root', type: 'folder', name: 'Root', parentId: null, position: 0 },
  { id: 'media', type: 'folder', name: 'Media', parentId: 'root', position: 0 },
  { id: 'c-plex', type: 'container', name: '/plex', parentId: 'media', position: 0 },
  { id: 'c-sonarr', type: 'container', name: '/sonarr', parentId: 'media', position: 1 },
  { id: 'c-web', type: 'container', name: '/web', parentId: 'root', position: 1 },
];
const CTS = { plex: { name: 'plex', state: 'running' }, sonarr: { name: 'sonarr', state: 'exited' }, web: { name: 'web', state: 'exited' } };

function render(opts) {
  opts = opts || {};
  const holder = new N('div');
  const given = Object.assign({
    el, window: { scrollY: 0, scrollTo() {}, openDocker: opts.openDocker === false ? undefined : () => {} },
    localStorage: { getItem: () => null }, gridHolder: holder, folderDrag: null, ccOrgView: { rootId: 'root', flatEntries: opts.entries || ENTRIES },
    filterText: opts.filterText || '', mode: 'folder', LANG: 'en', t: (k) => k, effc: () => '', iconBgOn: () => false, gridFocusKey: () => null,
    ccGlyph: (n) => '<glyph ' + n + '>', findRows: () => [], rowName: (r) => r.name,
    containerByName: (n) => CTS[String(n).toLowerCase()] || null,
    folderTile: (c) => { const n = el('div', 'cc-card cc-tile'); n.appendChild(el('div', 'cc-tile-head')); n.dataset.name = c.name; return n; },
    ccFolderHidesContainer: () => false, ccEntryMatches: () => true, ccEffectiveCollapsed: () => !!opts.collapsed,
    folderHidesStopped: () => false, folderActBtn: (cls, icon, title) => { const b = el('button', cls); b.title = title; b.icon = icon; return b; },
    folderLook: () => ({ color: '', icon: '' }), folderBadge: () => el('span', 'cc-folder-badge'),
    folderPeek: () => el('span', 'cc-folder-peek'), folderLoadBars: () => el('span', 'cc-folder-load'), newFolderTile: () => el('span', 'cc-tile-new'),
    updateReady: (n) => (opts.updates || []).includes(n),
  });
  ['ccCollectFolderContainerNames'].forEach(f => { given[f] = new Function('return ' + grabFn(f))(); });
  const scope = new Proxy({}, {
    has: (o, k) => k in given || !(k in globalThis),
    get: (o, k) => (k in given ? given[k] : k === Symbol.unscopables ? undefined : () => el('span', 'cc-stub')),
    set: (o, k, v) => { given[k] = v; return true; },
  });
  new Function('scope', 'with (scope) { ' + grabFn('renderFolderView') + '\nreturn renderFolderView; }')(scope)();
  return holder;
}
const actTitles = (h) => find(h, 'cc-folder-group-actions').children.map(b => b.title);

console.log('\nThe head says how many members run');
{
  const h = render();
  ok('"1/2 running" for one of two members up', find(h, 'cc-folder-count').textContent === '1/2 running', find(h, 'cc-folder-count').textContent);
  ok('the bare "(n)" count is gone from the label', find(h, 'cc-folder-group-label').textContent === 'Media');
  ok('the folder icon badge sits in the title', !!find(find(h, 'cc-folder-group-title'), 'cc-folder-badge'));
}

console.log('\nThe members\' logos only while folded, the load only while one runs');
{
  ok('an open folder shows no logos', !find(render(), 'cc-folder-peek'));
  ok('a folded one does', !!find(render({ collapsed: true }), 'cc-folder-peek'));
  ok('one running member brings the CPU and RAM bars', !!find(render(), 'cc-folder-load'));
  const allDown = ENTRIES.map(e => e);
  CTS.plex.state = 'exited';
  ok('with none running there are no bars', !find(render({ entries: allDown }), 'cc-folder-load'));
  CTS.plex.state = 'running';
}

console.log('\nThe folder actions');
{
  const plain = actTitles(render());
  ok('hide stopped, start, stop, restart all, edit and delete on any folder', JSON.stringify(plain) === JSON.stringify(['hideStopped', 'bulkStartAll', 'bulkStopAll', 'bulkRestartAll', 'editFolder', 'deleteFolder']), plain.join(', '));
  ok('update all appears once a member has an update', actTitles(render({ updates: ['sonarr'] })).includes('bulkUpdateAll'));
  ok('not without Unraid\'s update command to run it', !actTitles(render({ updates: ['sonarr'], openDocker: false })).includes('bulkUpdateAll'));
}

console.log('\nThe New folder tile');
{
  const root = render().children[0];
  ok('it is the view\'s last tile', root.children[root.children.length - 1].classList.contains('cc-tile-new'));
  ok('a search hides it', !find(render({ filterText: 'pl' }), 'cc-tile-new'));
  const tile = new Function('el', 'ccGlyph', 't', 'window', 'ccOrgCreateFolder', grabFn('newFolderTile') + '\nreturn newFolderTile;')(el, () => '', (k) => k, {}, () => { tile.created = true; })();
  tile.fire('click');
  ok('a click runs the same create path as the gear menu', tile.created === true);
  ok('the gear menu keeps its New folder button', /el\("button", "cc-btn cc-menu-newfolder"\)[\s\S]{0,200}t\("newFolder"\)[\s\S]{0,120}ccOrgCreateFolder\(\)/.test(src));
  const menu = grabFn('buildMenu');
  ok('which shows only in the folder view', /if \(ccOrgAvailable && mode === "folder"\) \{\s*var nrow/.test(menu));
  ok('and the folder view is offered before the first folder exists', /if \(ccOrgAvailable\) views\.push\(\["folder"/.test(menu) && !/ccOrgHasFolders/.test(src));
}

console.log('\nfolderLoad() adds up the running members');
{
  const folderLoad = new Function('containerByName', grabFn('folderLoad') + '\nreturn folderLoad;')((n) => CTS[n]);
  const st = { plex: { cpu_percent: 1.5, mem_used: 1024, mem_limit: 8192 }, sonarr: { cpu_percent: 9, mem_used: 4096, mem_limit: 8192 }, web: { cpu_percent: 0, mem_used: 0, mem_limit: 16384 } };
  const l = folderLoad(['plex', 'sonarr'], st);
  ok('a stopped member adds nothing', l.cpu === 1.5 && l.used === 1024, JSON.stringify(l));
  ok('RAM is measured against the largest limit any container reports', l.ramPct === 1024 / 16384 * 100, String(l.ramPct));
}

console.log('\nThe editor\'s save plan');
{
  const plan = new Function(grabVar('ORG_VIEW_SHAPE') + '\n' + grabVar('ORG_RENAME_MUT') + '\n' + grabVar('ORG_MOVE_MUT') + '\n' + grabFn('ccFolderEditSteps') + '\nreturn ccFolderEditSteps;')();
  const view = { rootId: 'root', flatEntries: ENTRIES.concat([{ id: 'tools', type: 'folder', name: 'Tools', parentId: 'root', position: 2 }, { id: 'c-git', type: 'container', name: '/git', parentId: 'tools', position: 0 }]) };
  ok('no change, no call', plan(view, 'media', 'Media', { 'c-plex': true, 'c-sonarr': true }).length === 0);
  const steps = plan(view, 'media', 'Films', { 'c-plex': true, 'c-web': true, 'c-git': true });
  ok('three calls: rename, the ones switched in, the one switched out', steps.length === 3, steps.map(s => s.m).join(', '));
  ok('the rename sends the folder id and the new name', steps[0].m === 'renameDockerFolder' && JSON.stringify(steps[0].v) === JSON.stringify({ folderId: 'media', newName: 'Films' }));
  ok('the ones switched in move here, from the root and from another folder alike', steps[1].m === 'moveDockerEntriesToFolder' && JSON.stringify(steps[1].v) === JSON.stringify({ sourceEntryIds: ['c-web', 'c-git'], destinationFolderId: 'media' }));
  ok('the one switched out goes to the root, which is no folder', JSON.stringify(steps[2].v) === JSON.stringify({ sourceEntryIds: ['c-sonarr'], destinationFolderId: 'root' }));
  ok('the calls are the organizer mutations the rest of the folder view uses', /renameDockerFolder\(folderId: \$folderId, newName: \$newName\)/.test(steps[0].q) && /moveDockerEntriesToFolder\(sourceEntryIds: \$sourceEntryIds, destinationFolderId: \$destinationFolderId\)/.test(steps[1].q));
  ok('the request body is the plain GraphQL shape ccGql() posts', JSON.parse(JSON.stringify({ query: steps[1].q, variables: steps[1].v })).variables.sourceEntryIds.length === 2);
}

console.log('\nThe editor stores colour and icon beside the other cc.* preferences');
{
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const api = new Function('localStorage', grabVar('FOLDER_LOOK_KEY') + '\n' + grabFn('readIdMap') + '\n' + grabFn('folderLook') + '\n' + grabFn('setFolderLook') + '\nreturn { folderLook: folderLook, setFolderLook: setFolderLook };')(ls);
  ok('an untouched folder follows the colour mode with the folder glyph', JSON.stringify(api.folderLook('media')) === JSON.stringify({ color: '', icon: '' }));
  api.setFolderLook('media', { color: '#2f6feb', icon: 'c:plex' });
  ok('a pick is kept under cc.folderLook by folder id', JSON.parse(store['cc.folderLook']).media.color === '#2f6feb' && api.folderLook('media').icon === 'c:plex');
  api.setFolderLook('media', null);
  ok('a deleted folder leaves nothing behind', JSON.parse(store['cc.folderLook']).media === undefined);
  ok('the delete path clears it', /setFolderLook\(id, null\)/.test(grabFn('ccOrgDeleteNow')));
  ok('the members are toggles, never checkboxes', /"cc-set-toggle"/.test(grabFn('openFolderEditor')) && !/checkbox/.test(grabFn('openFolderEditor')));
}

console.log('\nUpdate all');
{
  let cmd = null, asked = null;
  const run = new Function('ccOrgAsk', 'window', 't', 'LANG', grabFn('ccFolderUpdate') + '\nreturn ccFolderUpdate;')(
    (o) => { asked = o; }, { openDocker: (c) => { cmd = c; } }, (k) => k, 'en');
  run(['plex', 'my app'], null);
  ok('it asks once first', !!asked && asked.title === 'Update 2 containers?' && cmd === null);
  asked.onOk();
  ok('then runs Unraid\'s update command once for all of them, as Update All does', cmd === 'update_container plex*my%20app', cmd);
}

console.log('\nDrag and drop');
{
  ok('a drop target wears a 3px accent halo, never a border line', /\.cc-drop-target \{[^}]*box-shadow: 0 0 0 3px var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(css) && !/\.cc-drop-target \{[^}]*border:/.test(css));
  const view = grabFn('renderFolderView');
  ok('a container over a folder head moves into that folder while it is dragged', /head = t\.closest\("\.cc-folder-group-head"\)/.test(view) && /if \(body && d\.el\.parentNode !== body\) slideInto\(d\.el, body, null\);/.test(view));
  ok('the others slide aside from where they stood', /function slideInto\(node, parent, before\) \{[\s\S]*?getBoundingClientRect\(\)[\s\S]*?parent\.insertBefore\(node, before\);[\s\S]*?translate\(/.test(view));
  ok('the drop saves the place the item holds, among the folder\'s other entries', /function saveDrag\(d\) \{[\s\S]*?ccOrgMoveToPosition\(d\.entry\.id, dest, pos\);/.test(view));
  ok('a cancelled drag puts the saved order back', /if \(!d \|\| !d\.dropped \|\| !saveDrag\(d\)\) renderFolderView\(\);/.test(view));
  ok('no render tears the dragged item away mid-drag', /function renderFolderView\(\) \{\s*if \(folderDrag\) return;/.test(src));
  ok('a failed save puts the item back too', /moveDockerItemsToPosition"\); \}\)[\s\S]{0,140}\.catch\(function \(\) \{ flash\(t\("invalid"\), true\); if \(mode === "folder"\) renderFolderView\(\); \}\)/.test(src));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
