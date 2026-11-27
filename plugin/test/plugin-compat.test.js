// TowerTorch beside FolderView Plus, Unassigned Devices Next and ZFS Master NG, against their real
// markup (FolderView Plus 2026.11.26.06, UD Next 2026.11.09, ZFS Master NG 2026.11.26). What can
// quietly break it:
//   · a click handler on the Docker list that swallows the clicks FolderView Plus answers on its
//     folder rows, or finds an action bar in a member stored inside a folder row
//   · the autostart switch patch, which leaves FolderView Plus's folder switch without its widget
//   · the grid, folder and tile views, the hidden native table or the Dashboard order, which
//     FolderView Plus's theme contract leaves to FolderView Plus
//   · UD Next's renamed tables and headings, which the old class names no longer reach
//   · ZFS Master NG's table, which carries disk_status and is taken for an array table
//   · a colour that only reads on the dark theme
const fs = require('fs');
const path = require('path');
const { candidates, tokens, resolve, DIR, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const tryFn = (src, name) => { try { return grabFn(src, name); } catch (e) { return null; } };
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }

// Elements with enough of the DOM for the handlers: compound selectors (tag, #id, .class, [attr],
// [attr*=], [attr^=]) joined by spaces or ">", listed with commas, plus :scope.
class Elem {
  constructor(tag, attrs, kids) {
    this.tagName = tag.toUpperCase(); this.attrs = Object.assign({}, attrs); this.children = []; this.parentNode = null; this.style = { display: '' };
    const self = this;
    this.classList = { contains: (c) => self.cls().includes(c), add: (...cs) => cs.forEach((c) => { if (!self.cls().includes(c)) self.attrs.class = self.cls().concat(c).join(' '); }) };
    (kids || []).forEach((k) => this.appendChild(k));
  }
  cls() { return (this.attrs.class || '').split(' ').filter(Boolean); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(k) { k.parentNode = this; this.children.push(k); return k; }
  all() { return this.children.flatMap((c) => [c].concat(c.all())); }
  querySelectorAll(sel) { return this.all().filter((e) => matches(e, sel, this)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { for (let e = this; e; e = e.parentNode) if (matches(e, sel, null)) return e; return null; }
}
const h = (tag, attrs, kids) => new Elem(tag, attrs, kids);
function compound(e, part, scope) {
  if (part === ':scope') return e === scope;
  const re = /(^[a-z]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^]?=)"([^"]*)")?\]/gi;
  let m, seen = 0;
  while ((m = re.exec(part))) {
    seen += m[0].length;
    if (m[1] && m[1] !== '*' && e.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && e.getAttribute('id') !== m[2]) return false;
    if (m[3] && !e.classList.contains(m[3])) return false;
    if (m[4]) {
      const v = e.getAttribute(m[4]);
      if (v === null) return false;
      if (m[5] === '=' && v !== m[6]) return false;
      if (m[5] === '*=' && !v.includes(m[6])) return false;
      if (m[5] === '^=' && !v.startsWith(m[6])) return false;
    }
  }
  if (seen !== part.length) throw new Error('selector the shim cannot read: ' + part);
  return true;
}
function matchFrom(e, steps, i, scope) {
  if (!compound(e, steps[i].part, scope)) return false;
  if (i === 0) return true;
  if (steps[i].comb === '>') return !!e.parentNode && matchFrom(e.parentNode, steps, i - 1, scope);
  for (let p = e.parentNode; p; p = p.parentNode) if (matchFrom(p, steps, i - 1, scope)) return true;
  return false;
}
function matches(e, sel, scope) {
  return sel.split(',').some((one) => {
    const toks = one.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/), steps = [];
    for (let i = 0; i < toks.length; i++) { if (toks[i] === '>') continue; steps.push({ part: toks[i], comb: toks[i - 1] === '>' ? '>' : ' ' }); }
    return matchFrom(e, steps, steps.length - 1, scope);
  });
}

const docker = read('scripts/docker.js');
const FVPLUS = h('script', { src: '/plugins/folderview.plus/scripts/docker.js?v=1764150000' });
const doc = (withFv, body) => ({ querySelector: (s) => (withFv && /folderview\.plus/.test(s) ? FVPLUS : (body ? body.querySelector(s) : null)) });

console.log('\nThe Tools and Settings tables read on the light themes');
{
  const toks = (light) => tokens(light);
  for (const theme of ['Theme--white', 'Theme--azure']) {
    const td = { tag: 'td', classes: [], attrs: {}, states: {}, html: ['tt-tools-on', theme], inside: ['#displaybox'] };
    const c = candidates('every', td, 'color');
    const win = c[c.length - 1];
    ok('a foreign table cell is dark on ' + theme, !!win && resolve(win.value, toks(true)) === '#303030', win && (win.selector + ' -> ' + win.value));
  }
  const dark = candidates('every', { tag: 'td', classes: [], attrs: {}, states: {}, html: ['tt-tools-on'], inside: ['#displaybox'] }, 'color');
  ok('and stays light on the dark themes', resolve(dark[dark.length - 1].value, toks(false)) === '#d6d6d6');
}

console.log('\nFolderView Plus is found by its own assets');
{
  const fn = tryFn(docker, 'ttFvPlus');
  ok('docker.js has one check for it', !!fn);
  if (fn) {
    const run = (withFv) => new Function('document', fn + '\nreturn ttFvPlus();')(doc(withFv));
    ok('a FolderView Plus script on the page counts', run(true) === true);
    ok('and without one it does not', run(false) === false);
    ok('the check names the plugin directory of FolderView Plus alone, not the older folder.view*', /script\[src\*="\/plugins\/folderview\.plus\/"\]/.test(fn));
  }
}

console.log('\nFolderView Plus keeps its folder rows');
{
  // A folder row as FolderView Plus 2026.11.26.06 draws it (docker.js createFolder), with one member
  // stored in its .folder-storage, and a plain container row TowerTorch has enhanced.
  const member = () => h('tr', { class: 'sortable', id: 'ct-alpha' }, [h('td', { class: 'ct-name' }, [h('span', { class: 'outer' }, [h('span', { class: 'hand' }, [h('img', { class: 'img' })]), h('span', { class: 'tt-pick' })])]), h('td', { class: 'tt-actcell' }, [h('div', { class: 'tt-actbar' })])]);
  const folderHand = h('span', { id: 'f1', class: 'hand folder-hand' }, [h('img', { class: 'img folder-img' })]);
  const folder = h('tr', { class: 'sortable folder-id-f1 folder', 'data-fv-folder-id': 'f1' }, [
    h('td', { class: 'ct-name folder-name' }, [h('div', { class: 'folder-name-sub' }, [h('span', { class: 'outer folder-outer' }, [folderHand])])]),
    h('td', { class: 'updatecolumn folder-update' }),
    h('td', { class: 'folder-preview-cell' }, [h('div', { class: 'folder-storage' }, [member()]), h('div', { class: 'folder-preview' })]),
  ]);
  const plain = member();
  const list = h('tbody', { id: 'docker_list' }, [folder, plain]);
  const flashSrc = tryFn(docker, 'ttFlashBarFor');
  ok('docker.js keeps the flash lookup in one named function', !!flashSrc);
  if (flashSrc) {
    const flash = new Function(flashSrc + '\nreturn ttFlashBarFor;')();
    ok('a click on a folder\'s icon is left to FolderView Plus', flash({ target: folderHand }) === null);
    ok('a click on a plain container\'s icon still flashes its own actions', flash({ target: plain.querySelector('span.hand') }) === plain.querySelector('.tt-actbar'));
  }
  const bulkSrc = tryFn(docker, 'ttBulkRowFor');
  const bulk = new Function('mode', 'BULK_SKIP', bulkSrc + '\nreturn ttBulkRowFor;')('list', 'a[href], button');
  ok('a Ctrl click on a folder row picks nothing', bulk({ ctrlKey: true, button: 0, target: folder.querySelector('td.folder-update') }) === null);
  ok('a Ctrl click on a container row still picks it', bulk({ ctrlKey: true, button: 0, target: plain.querySelector('td.ct-name') }) === plain);
  const tileSrc = tryFn(docker, 'ttBulkTileFor');
  const tile = new Function('mode', 'ttBulkModeOn', 'ttBulkSel', tileSrc + '\nreturn ttBulkTileFor;')('list', true, {});
  ok('a tile stored inside a folder row is not picked', tile({ button: 0, target: folder.querySelector('span.tt-pick') }) === null);
  ok('a tile of a container row is', tile({ button: 0, target: plain.querySelector('span.tt-pick') }) === plain);
  ok('the capture listener asks the named function', /var bar2 = ttFlashBarFor\(e\);/.test(docker));
  const find = new Function('document', 'isFolderHeader', grabFn(docker, 'findRows') + '\nreturn findRows;')({ querySelectorAll: (q) => list.querySelectorAll(q) }, (tr) => tr.classList.contains('folder'));
  const rows = find();
  ok('the list\'s rows leave out the members FolderView Plus stores in a folder row', rows.length === 1 && rows[0] === plain, rows.length);
  ok('the page search leaves FolderView Plus\'s rows to it', /else if \(!ttFvPlus\(\)\) findRows\(\)\.forEach/.test(grabFn(docker, 'applyFilter')));
  void list;
}

console.log('\nFolderView Plus keeps its folder autostart switch');
{
  const m = /\(function \(\) \{\n(?:\s*\/\/[^\n]*\n)*    if \(!window\.jQuery \|\| !jQuery\.fn\.switchButton[\s\S]*?\n  \}\)\(\);/.exec(docker);
  ok('the switch patch is found', !!m);
  if (m) {
    const run = (withFv) => {
      const real = function () { return 'widget'; };
      const jq = { fn: { switchButton: real } };
      new Function('window', 'jQuery', 'document', 'themingOn', grabFn(docker, 'ttFvPlus') + '\n' + m[0])({ jQuery: jq }, jq, doc(withFv), () => true);
      return jq.fn.switchButton === real;
    };
    ok('with FolderView Plus on the page Unraid\'s widget stays', run(true));
    ok('without it the fast path is patched in', !run(false));
  }
}

console.log('\nWhere FolderView Plus owns the page, TowerTorch\'s own views stand down');
{
  const views = tryFn(docker, 'ttViewsOn');
  ok('docker.js has one switch for its grid and folder views', !!views && /themingOn\(\) && !ttFvPlus\(\)/.test(views));
  ok('the list is where a page with FolderView Plus starts', /var mode = \(localStorage\.getItem\(VIEW_KEY\) === "grid" && ttViewsOn\(\)\)/.test(docker));
  ok('setMode keeps it there', /if \(!ttViewsOn\(\) && m !== "list"\) m = "list";/.test(grabFn(docker, 'setMode')));
  ok('the gear menu offers no other view there', /if \(ttViewsOn\(\)\) \{\n\s+m\.appendChild\(menuHead\(t\("view"\)\)\);/.test(docker));
  const hide = grabFn(docker, 'hideNative');
  const table = h('table', { id: 'docker_containers' });
  const run = (steps) => { new Function('nativeTable', hide + '\n' + steps)(() => table); return table.style.display; };
  table.style.display = 'none';
  ok('FolderView Plus\'s Command view keeps the native table hidden', run('hideNative(false);') === 'none');
  table.style.display = '';
  ok('a table TowerTorch hid for its cards comes back', run('hideNative(true); hideNative(false);') === '');
  const vms = read('scripts/vms.js');
  ok('the VM tiles stand down for FolderView Plus too', /function currentView\(\) \{ return \(ls\(VMVIEW_KEY\) === "grid" && ls\("tt\.theming"\) !== "0" && !ttFvPlus\(\)\) \? "grid" : "list"; \}/.test(vms));
  const rowSel = vms.match(/#kvm_list tr\.sortable[^"]*/g) || [];
  ok('and the VM rows skip FolderView Plus\'s folders and members', rowSel.length >= 2 && rowSel.every((s) => /:not\(\.folder\):not\(\.folder-element\)/.test(s)), rowSel.join(' | '));
}

console.log('\nThe Docker list rules leave a FolderView Plus folder row alone');
{
  const css = read('styles/docker.css');
  const all = css.match(/tr:is\(\.sortable, \.folder-element\)[^\s,{]*/g) || [];
  const loose = all.filter((s) => !/^tr:is\(\.sortable, \.folder-element\):where\(:not\(\.folder\)\)/.test(s));
  ok('every rule on a container row skips tr.folder', all.length > 50 && loose.length === 0, loose.slice(0, 3).join(' | ') + ' of ' + all.length);
}

console.log('\nThe Dashboard leaves FolderView Plus\'s folder cards where it put them');
{
  const dash = read('scripts/dashboard.js');
  ok('dashboard.js marks the page when FolderView Plus draws on it', /classList\.toggle\("tt-dash-fv", [^)]*folderview\.plus/.test(dash) || /classList\.toggle\("tt-dash-fv", fvPlus\(\)\)/.test(dash));
  const tiles = parseRules(read('sheets/TowerTorch.Dashboard.css')).flatMap((r) => splitTop(r.selector)).filter((s) => /#docker_view|#vm_view/.test(s));
  ok('every tile rule on the container and VM rows waits for its absence', tiles.length > 10 && tiles.every((s) => /^html\.tt-dash-on:not\(\.tt-dash-fv\)/.test(s)), tiles.filter((s) => !/tt-dash-fv/.test(s)).slice(0, 2).join(' | '));
}

console.log('\nUD Next\'s tables are reached under both spellings');
{
  const theme = read('scripts/tt-theme.js');
  const fn = tryFn(theme, 'stampUdTables');
  ok('tt-theme.js stamps them in one place', !!fn);
  if (fn) {
    const mk = (cls, body) => h('table', { class: cls }, [h('tbody', { id: body })]);
    const classic = h('div', { id: 'displaybox' }, [mk('usb_mounts', 'disk-table-body'), mk('samba_mounts', 'remotes-table-body'), mk('usb_absent', 'historical-table-body')]);
    const next = h('div', { id: 'displaybox' }, [mk('unraid usb-mounts', 'disk-table-body'), mk('unraid samba-mounts', 'remotes-table-body'), mk('unraid usb-absent', 'historical-table-body')]);
    for (const [name, root] of [['Unassigned Devices', classic], ['UD Next', next]]) {
      new Function('document', /var UD_PARTS = [^\n]+;/.exec(theme)[0] + '\n' + fn + '\nstampUdTables();')({ querySelectorAll: (s) => root.querySelectorAll(s) });
      const cls = root.children.map((t) => t.cls().filter((c) => /^tt-udt/.test(c)).join(' '));
      ok(name + ': each table carries tt-udt and its part', JSON.stringify(cls) === JSON.stringify(['tt-udt tt-udt-disks', 'tt-udt tt-udt-remotes', 'tt-udt tt-udt-historical']), JSON.stringify(cls));
    }
  }
  const old = /table\.(usb_mounts|samba_mounts|usb_absent)\b/;
  for (const f of ['sheets/TowerTorch.Shares.css', 'sheets/TowerTorch.Disks.css', 'scripts/shares.js', 'scripts/disks.js']) ok(f + ' names the tables by the stamp', !old.test(read(f)), (read(f).match(old) || [])[0]);
  const shares = read('scripts/shares.js');
  ok('the section headings are found under UD Next\'s span.title-left too', /div\.title\.shift :is\(span\.left, div\.left, span\.title-left\)/.test(shares));
  ok('and the sheet badges them there', /div\.title :is\(span\.left, div\.left, span\.title-left\)/.test(read('sheets/TowerTorch.Shares.css')));
  ok('the tile row takes UD Next\'s historical devices, which sit beside the other two parts', /hasCls\(c, "show-historical"\)/.test(grabFn(read('scripts/disks.js'), 'udRow')));
  ok('UD Next\'s Dashboard tile gets a glyph', /"fa-unlink": "database"/.test(read('scripts/dashboard.js')));
}

console.log('\nZFS Master NG\'s table is not an array table');
{
  const shares = read('scripts/shares.js'), header = read('scripts/header.js');
  ok('shares.js names the array tables in one selector that leaves zfs_table out', /var MAIN_DISKS = "table\.unraid\.disk_status:not\(\.zfs_table\)";/.test(shares));
  for (const [f, src] of [['shares.js', shares], ['header.js', header]]) {
    const raw = (src.match(/"[^"\n]*table(\.unraid)?\.disk_status[^"\n]*"/g) || []).filter((s) => !/:not\(\.zfs_table\)/.test(s));
    ok(f + ' never reaches disk_status without it', raw.length === 0, raw.slice(0, 3).join(' | '));
  }
  const css = parseRules(read('sheets/TowerTorch.Shares.css')).flatMap((r) => splitTop(r.selector)).filter((s) => /table\.unraid\.disk_status/.test(s));
  ok('neither does the sheet', css.length > 30 && css.every((s) => /table\.unraid\.disk_status:not\(\.zfs_table\)/.test(s)), css.filter((s) => !/zfs_table/.test(s)).slice(0, 2).join(' | '));
}

console.log('\nThe light themes, beyond the tables');
{
  const header = read('sheets/TowerTorch.Header.css');
  ok('the bell takes the dark header\'s ink on every theme', /html\.tt-header-on \[data-tt-trig="bell"\] \{ position: relative; --tt-ink-min: 0\.74; --tt-ink-max: 1; \}/.test(header));
  const info = { tag: 'span', classes: ['tt-info', 'tt-dk-info'], attrs: {}, states: {}, html: ['tt-shares-on', 'tt-on-main', 'tt-dk-on', 'Theme--white'], outside: ['.tt-win-title', '.ca_homeTemplatesHeader', '.tt-win'] };
  const page = ['sheets/TowerTorch.Tokens.css', 'sheets/TowerTorch.Disks.css', 'sheets/TowerTorch.Shares.css'];
  const c = candidates(page, info, 'color'), win = c[c.length - 1];
  ok('the (i) on /Main follows the theme\'s text colour', !!win && /^var\(--tt-text[,)]/.test(win.value), win && (win.selector + ' -> ' + win.value));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
