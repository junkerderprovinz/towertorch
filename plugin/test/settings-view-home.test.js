// The Docker list, grid or folder view is chosen in two places, the Docker tab's gear menu and the
// Docker tile on the settings page. Both write cc.view and the organizer's saved view mode, so
// either one shows what the other picked.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const settings = read('scripts/settings.js');
const docker = read('scripts/docker.js');
function grab(src, name) { const i = src.indexOf('function ' + name + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }

console.log('\nThe gear menu sets the view');
ok('it offers the three views', /m\.appendChild\(menuHead\(t\("view"\)\)\)/.test(docker) && /\["list", t\("list"\), "ViewList"\], \["grid", t\("grid"\), "ViewGrid"\]/.test(docker) && /views\.push\(\["folder", /.test(docker) && /setMode\(v\[0\]\)/.test(docker));
ok('as the horizontal selector the settings page uses', /el\("div", "cc-seg cc-set-mode"\); seg\.setAttribute\("role", "radiogroup"\)/.test(docker));
ok('and saves a pick locally and on the server', /mode = m; localStorage\.setItem\(VIEW_KEY, m\);/.test(docker) && /if \(!fromServer\) ccOrgSavePrefs\(\{ ccViewMode: m \}\)/.test(docker));
ok('a view restored from the server is not written back to it', /setMode\(serverMode, true\)/.test(docker));

console.log('\nThe settings page sets the same view');
const block = settings.slice(settings.indexOf('var VIEW_ORG_Q'), settings.indexOf('function viewRow('));
async function viewRow(store, org) {
  const rows = [], sent = [];
  const mk = (tag, cls, txt) => {
    const n = { tag, cls: new Set((cls || '').split(' ').filter(Boolean)), textContent: txt || '', kids: [], _h: '', get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; this.kids = []; }, style: { setProperty() {}, removeProperty() {} }, appendChild(c) { this.kids.push(c); c.parentNode = this; return c; }, querySelector: () => null };
    n.classList = { toggle: (k, on) => (on ? n.cls.add(k) : n.cls.delete(k)) };
    return n;
  };
  const window = { ccGql: (q, v) => { sent.push({ q, v }); return Promise.resolve({ json: () => Promise.resolve(/^mutation/.test(q) ? { data: {} } : { data: { docker: { organizer: { views: org ? [org] : [] } } } }) }); } };
  const dropRow = (label, opts, cur, onChange) => { const r = { label, opts, cur, onChange }; rows.push(r); return r; };
  const lockRow = (label, by) => ({ lock: by });
  const c = mk('div');
  new Function('el', 'get', 'set', 'T', 'dropRow', 'lockRow', 'jumpTo', 'window', 'c', 'paintToggles', block + grab(settings, 'viewRow') + '\nviewRow(c);')
    .call(null, mk, (k, d) => (k in store ? store[k] : d), (k, v) => { store[k] = v; }, (de) => de, dropRow, lockRow, () => {}, window, c, () => {});
  await new Promise((r) => setTimeout(r, 10));
  return { c, rows, sent };
}
(async () => {
  const org = { id: 'default', prefs: { ccViewMode: 'folder', other: 1 }, flatEntries: [{ type: 'folder' }, { type: 'folder' }, { type: 'container' }] };
  const store = { 'cc.view': 'list' };
  const r = await viewRow(store, org);
  const row = r.rows[r.rows.length - 1];
  ok('with folders it offers Liste, Raster and Ordner', row && row.opts.map((o) => o[0]).join() === 'list,grid,folder', row && row.opts.map((o) => o[0]).join());
  ok('it shows the organizer\'s saved view, which the Docker tab opens with', row && row.cur === 'folder');
  const side = r.c.kids[1], preview = () => side.kids[side.kids.length - 1], shown = () => preview().kids[1].kids.map((k) => k.textContent).join();
  ok('right under it a preview of the chosen view alone, under its label', preview().kids.length === 2 && preview().kids[0].textContent === 'Vorschau' && shown() === 'Ordner' && /^<svg viewBox="0 0 60 36"/.test(preview().kids[1].innerHTML), shown());
  ok('the sketch wears the chosen segment\'s colour', preview().kids[1].cls.has('cc-set-vp-on'));
  row.onChange('grid');
  await new Promise((res) => setTimeout(res, 10));
  const save = r.sent.find((x) => /^mutation/.test(x.q));
  ok('a pick writes cc.view for this browser', store['cc.view'] === 'grid');
  ok('and the preview shows it at once', shown() === 'Raster', shown());
  ok('and the organizer\'s view mode, keeping its other prefs', !!save && save.v.prefs.ccViewMode === 'grid' && save.v.prefs.other === 1 && save.v.viewId === 'default', save && JSON.stringify(save.v));
  const bare = await viewRow({ 'cc.view': 'grid' }, { id: 'default', prefs: {}, flatEntries: [{ type: 'folder' }] });
  const brow = bare.rows[bare.rows.length - 1];
  ok('with the organizer and no folder yet Ordner can be picked, as on the Docker tab', brow && brow.opts.map((o) => o[0] + (o[3] ? '-off' : '')).join() === 'list,grid,folder' && brow.cur === 'grid', brow && JSON.stringify(brow.opts));
  const none = await viewRow({ 'cc.view': 'folder' }, null);
  const nrow = none.rows[none.rows.length - 1];
  ok('without the organizer Ordner stays in view but cannot be picked', nrow && nrow.opts.map((o) => o[0] + (o[3] ? '-off' : '')).join() === 'list,grid,folder-off', nrow && JSON.stringify(nrow.opts));
  ok('and a stored folder view shows the list', nrow && nrow.cur === 'list');
  const off = await viewRow({ 'cc.theming': '0' }, org);
  ok('with theming off a lock line says the list stays', off.rows.length === 0 && off.c.kids[0] && /Liste/.test(off.c.kids[0].lock));
  ok('the Docker tile carries the row', /var cV = card\(T\("Ansicht", "View"\)\);\s*viewRow\(cV\);/.test(settings));

// With no settings card, the gear has to be on screen in every view, or a user in the list
// view can never reach the grid, the folders or "New folder" again.
console.log('\nEvery view has a gear');
{
  const fn = (name) => { const i = docker.indexOf('function ' + name + '('); let d = 0; for (let k = docker.indexOf('{', i); k < docker.length; k++) { if (docker[k] === '{') d++; else if (docker[k] === '}') { d--; if (!d) return docker.slice(i, k + 1); } } return ''; };
  const top = fn('relocateTopBar');
  ok('list: the gear sits beside the view switch in the docked bar', /advGrp = jsa\.querySelector\("\.cc-bar-adv"\)/.test(top) && /advGrp\.appendChild\(makeGear\("cc-hgear-home"\)\)/.test(top));
  ok('list: never in a column header, which scrolls away with a wide table', !/th\d?\.appendChild\(makeGear/.test(top) && !/cc-hgear-th2/.test(docker));
  ok('list: the stale-gear sweep spares the bar\'s gear', /if \(!x9\.closest\("\.cc-bar-adv"\)\) x9\.remove\(\)/.test(top));
  const nonList = /if \(!listView\) \{([\s\S]*?)\} else if/.exec(top);
  ok('card and folder keep the bar\'s gear, so the way back to the list stays in one place', !!nonList && !/return|\.remove\(\);\s*\/\/ gear|cc-bar-adv \.cc-hgear/.test(nonList[1]), nonList && nonList[1]);
  ok('multi-select stays with the list', /if \(listView\) ensureBulkModeBadge\(jsa\)/.test(top));
  for (const [view, f] of [['card', 'renderGrid'], ['folder', 'renderFolderView']]) {
    ok(view + ' view rebuilds the bar and draws no gear of its own', /relocateTopBar\(\)/.test(fn(f)) && !/makeGear\(/.test(fn(f)));
  }
  // In the flow of the wrapping bar the gear takes its own room, so it cannot sit over a label.
  const { candidates } = require('./cascade');
  const gear = { tag: 'button', classes: ['cc-hgear', 'cc-hgear-home'], attrs: { type: 'button' }, states: {}, html: ['cc-docker-on'], inside: ['.js-actions', '.cc-bar-adv'] };
  const pos = candidates('docker', gear, 'position');
  ok('the list gear stays in the flow of the bar', !pos.length || pos[pos.length - 1].value === 'static', pos.length ? pos[pos.length - 1].selector + ' => ' + pos[pos.length - 1].value : '');
  const size = candidates('docker', gear, 'font-size');
  ok('and has a look of its own there', size.length > 0 && /\.cc-bar-adv \.cc-hgear-home/.test(size[size.length - 1].selector));

  // A gear near the bottom edge would hang its menu off screen.
  const place = new Function('window', 'document', 'menu', 'menuAnchor', fn('positionMenu') + '\npositionMenu(); return menu.style;');
  const win = { scrollX: 0, scrollY: 0, innerWidth: 1600, innerHeight: 900 }, doc = { documentElement: { clientWidth: 1600, clientHeight: 900 } };
  win.CCTheme = require('./theme-place')(win, doc);
  const at = (top, bottom, right) => ({ getBoundingClientRect: () => ({ top, bottom, left: (right || 1500) - 30, right: right || 1500 }) });
  const m = () => ({ offsetWidth: 240, offsetHeight: 400, style: {} });
  ok('a gear at the bottom opens its menu upward', place(win, doc, m(), at(860, 884)).top === (860 - 6 - 400) + 'px');
  ok('a gear near the top still opens downward', place(win, doc, m(), at(100, 124)).top === '130px');
  ok('a gear in the right-most column keeps its menu 24px off the edge of a wide viewport', place(win, doc, m(), at(100, 124, 1600)).left === (1600 - 240 - 24) + 'px');
  ok('and a menu that fits nowhere stays 24px off the bottom', place(win, doc, { offsetWidth: 240, offsetHeight: 880, style: {} }, at(100, 124)).top === '24px');
}


// The card and folder views draw no selection marks, so the multi-select badge leaves the bar
// with the list, and a selection mode left on in the list ends rather than waiting unseen.
console.log('\nMulti-select belongs to the list');
{
  const fnSrc = (() => { const i = docker.indexOf('function relocateTopBar('); let d = 0; for (let k = docker.indexOf('{', i); k < docker.length; k++) { if (docker[k] === '{') d++; else if (docker[k] === '}') { d--; if (!d) return docker.slice(i, k + 1); } } return ''; })();
  const run = (viewMode, bulkOn) => {
    const removed = [];
    const els = { '.cc-bar-adv .cc-hgear': { remove() { removed.push('gear'); } }, '.cc-bulkmode-badge': { remove() { removed.push('badge'); } } };
    const doc = { querySelector: (s) => els[s] || null, querySelectorAll: () => [] };
    const state = new Function('document', 'mode', 'on',
      'var ccBulkModeOn = on, toggled = 0; function ccBulkModeToggle() { ccBulkModeOn = !ccBulkModeOn; toggled++; }' +
      'function syncFooterDock() {} function findRows() { return []; }\n' + fnSrc + '\nrelocateTopBar(); return { on: ccBulkModeOn, toggled: toggled };')(doc, viewMode, bulkOn);
    return Object.assign(state, { removed });
  };
  for (const v of ['grid', 'folder']) {
    const r = run(v, false);
    ok(`${v}: the multi-select badge leaves the bar`, r.removed.includes('badge'), r.removed.join(' '));
    const on = run(v, true);
    ok(`${v}: a selection mode left on ends`, on.on === false && on.toggled === 1);
  }
  const list = run('list', false);
  ok('list: the badge stays', !list.removed.includes('badge'), list.removed.join(' '));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
})();
