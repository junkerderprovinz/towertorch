// The VM tiles on /VMs (vms.js, VmTab.css), drawn from Unraid's own table, which stays hidden as
// their source. What can quietly break it:
//   · the tiles drawn into the live table again, where tablesorter and the drag sorting fight them
//   · every pass rebuilding every tile, which drops hover and focus every few seconds
//   · a tile's autostart switch saving through anything but the row's own switchButton
//   · the vDisk size read as part of the CD count, or the guest agent sentence back on every row
//   · the tiles showing with theming off, or a second key for the view
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const src = fs.readFileSync(path.join(DIR, 'scripts/vms.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.VmTab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in vms.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// A small element tree with the selectors the tile code uses: tag, #id, .class, [attr="v"],
// descendant and child combinators.
class N {
  constructor(tag, doc) {
    this.nodeType = tag === '#text' ? 3 : 1; this.tagName = String(tag).toUpperCase(); this.ownerDocument = doc;
    this.childNodes = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this._text = '';
    const self = this, s = {};
    this.style = { setProperty: (k, v) => { s[k] = v; }, removeProperty: (k) => { delete s[k]; }, getPropertyValue: (k) => s[k] || '', _s: s };
    this.classList = {
      add: (...c) => c.forEach((x) => { if (!self.classList.contains(x)) self.className = (self.className + ' ' + x).trim(); }),
      remove: (...c) => { self.className = self.className.split(/\s+/).filter((x) => x && !c.includes(x)).join(' '); },
      contains: (c) => self.className.split(/\s+/).includes(c),
      toggle: (c, on) => { const want = on === undefined ? !self.classList.contains(c) : !!on; want ? self.classList.add(c) : self.classList.remove(c); return want; },
    };
  }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; }
  get textContent() { return this.nodeType === 3 ? this._text : this.childNodes.map((c) => c.textContent).join(''); }
  set textContent(v) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; if (v !== '' && v != null) { const t = new N('#text'); t._text = String(v); this.appendChild(t); } }
  set innerHTML(v) { this.textContent = ''; this.html = v; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.documentElement; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    c.parentNode = this; return c;
  }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  replaceChild(n, o) { this.insertBefore(n, o); this.removeChild(o); return o; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() {
    const ev = { preventDefault() {}, stopPropagation() {}, key: '' };
    (this.listeners.click || []).forEach((fn) => fn.call(this, ev));
    if (this.onclickNative) this.onclickNative();
  }
  cloneNode(deep) {
    const c = new N(this.tagName === '#TEXT' ? '#text' : this.tagName, this.ownerDocument);
    c.attrs = Object.assign({}, this.attrs); c._text = this._text;
    if (deep) this.childNodes.forEach((k) => c.appendChild(k.cloneNode(true)));
    return c;
  }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (sel.split(',').some((s) => matches(n, s.trim().split(/\s+/)))) return n; return null; }
  querySelectorAll(sel) { return all(this).filter((n) => sel.split(',').some((s) => matches(n, s.trim().replace(/^:scope\s*/, '').split(/\s+/), this))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function all(root) { const out = []; (function walk(n) { n.children.forEach((c) => { out.push(c); walk(c); }); })(root); return out; }
function compound(n, s) {
  const m = /^([a-z0-9]*)((?:[#.][\w-]+)*)((?:\[[^\]]+\])*)$/i.exec(s); if (!m) return false;
  if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
  for (const p of m[2].match(/[#.][\w-]+/g) || []) { if (p[0] === '#' ? n.id !== p.slice(1) : !n.classList.contains(p.slice(1))) return false; }
  for (const a of m[3].match(/\[[^\]]+\]/g) || []) { const q = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(a); if (!q || !(q[1] in n.attrs) || (q[2] != null && n.attrs[q[1]] !== q[2])) return false; }
  return true;
}
// Right to left over the parts; ">" binds the next part to the direct parent.
function matches(n, parts, scope) {
  if (!parts.length) return true;
  const last = parts[parts.length - 1];
  if (last === '>') return false;
  if (!compound(n, last)) return false;
  const rest = parts.slice(0, -1);
  if (!rest.length) return !scope || (n !== scope && scope.contains(n));
  if (rest[rest.length - 1] === '>') { const p = n.parentNode; return !!p && p.nodeType === 1 && p !== scope && matches(p, rest.slice(0, -1), scope); }
  for (let p = n.parentNode; p && p.nodeType === 1 && p !== scope; p = p.parentNode) if (matches(p, rest, scope)) return true;
  return false;
}
N.prototype.contains = function (n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; };

const store = {};
const ls = (k) => (k in store ? store[k] : null);
function setup() {
  const doc = {};
  doc.documentElement = new N('html', doc); doc.body = new N('body', doc); doc.documentElement.appendChild(doc.body);
  doc.createElement = (t) => new N(t, doc);
  doc.getElementById = (id) => all(doc.documentElement).find((n) => n.id === id) || null;
  doc.querySelectorAll = (s) => doc.documentElement.querySelectorAll(s);
  doc.querySelector = (s) => doc.documentElement.querySelector(s);
  return doc;
}
function make(doc, tag, attrs, kids) {
  const n = new N(tag, doc); Object.assign(n.attrs, attrs || {});
  (kids || []).forEach((k) => n.appendChild(typeof k === 'string' ? Object.assign(new N('#text', doc), { _text: k }) : k));
  return n;
}
// One native VM row as VMMachines.php writes it, reduced to what the tile reads.
function vmRow(doc, name, uuid, checked) {
  const input = make(doc, 'input', { class: 'autostart', uuid });
  input.checked = !!checked;
  const sw = make(doc, 'div', { class: 'switch-button-background' });
  sw.onclickNative = () => { input.checked = !input.checked; input.saved = (input.saved || 0) + 1; };
  return make(doc, 'tr', { class: 'sortable' }, [
    make(doc, 'td', { class: 'vm-name' }, [make(doc, 'span', { class: 'outer' }, [
      make(doc, 'span', { class: 'hand', id: 'vm-' + uuid }, [make(doc, 'img', { class: 'img', src: '/x.png', style: 'filter: url(#f)' })]),
      make(doc, 'span', { class: 'inner' }, [make(doc, 'a', {}, [name]), make(doc, 'i', { class: 'fa fa-warning orange-text' })]),
    ])]),
    make(doc, 'td', {}, [input, sw]),
  ]);
}

const doc = setup();
const win = { CCTheme: { infoIcon: (tip) => { const s = doc.createElement('span'); s.className = 'cc-info'; s.setAttribute('data-tip', tip); return s; } } };
let actionBars = 0;
const api = new Function('document', 'window', 'localStorage', 'ls', 'stubs',
  'var LANG = "de", VMVIEW_KEY = "cc.vmview", vmLims = {}, rowData = stubs.rowData;\n' +
  'function vmActionBars() { stubs.bars(); var b = el("div", "cc-actbar"); return { bar: b, sig: "" }; }\n' +
  'function vmGear(name, which) { return el("span", "cc-limbtn cc-lim-" + which); }\n' +
  'function vmResLine(b, g) { var l = el("div", "cc-resline"); l.appendChild(b); if (g) l.appendChild(g); return l; }\n' +
  'function limSet() { return { cpu: false, ram: false, bw: false }; }\n' +
  'function vmBwText() { return "-"; }\n' +
  'function vmRowData(tr) { return rowData(tr); }\n' +
  ['el', 'currentView', 'vmIpLines', 'vmNoIp', 'vmDiskParts', 'vmBadge', 'vmDiskBadges', 'removeVmGrid', 'vmCardSig', 'vmNativeAuto', 'vmAutoSwitch', 'vmCard', 'renderVmGrid'].map(grabFn).join('\n') +
  '\nvar vmGridHolder = null;\nreturn { currentView: currentView, vmIpLines: vmIpLines, vmDiskParts: vmDiskParts, vmCard: vmCard, vmCardSig: vmCardSig, renderVmGrid: renderVmGrid, removeVmGrid: removeVmGrid, holder: function () { return vmGridHolder; } };'
)(doc, win, { getItem: ls }, ls, {
  bars: () => { actionBars++; },
  rowData: (tr) => data[tr.querySelector('a').textContent],
});

console.log('\nThe view');
{
  ok('the list is the default', api.currentView() === 'list');
  store['cc.vmview'] = 'grid';
  ok('the stored choice brings the tiles', api.currentView() === 'grid');
  store['cc.theming'] = '0';
  ok('but never with theming off', api.currentView() === 'list');
  delete store['cc.theming']; delete store['cc.vmview'];
  ok('the switch writes the one key the view reads', /localStorage\.setItem\(VMVIEW_KEY, o\[0\]\)/.test(grabFn('ensureViewToggle')) && /var VMVIEW_KEY = "cc\.vmview"/.test(src));
  ok('and carries the shared list and tile glyphs', /"ViewList"\]/.test(grabFn('ensureViewToggle')) && /"ViewGrid"\]/.test(grabFn('ensureViewToggle')));
  ok('the switch is a pressed state, not a checkbox', /aria-pressed/.test(grabFn('applyView')) && !/checkbox/.test(grabFn('ensureViewToggle')));
}

console.log('\nWhat the tile reads from the row');
{
  const span = make(doc, 'span', { class: 'state' }, ['2 / 24G    0 / 2', make(doc, 'a', { class: 'hand', onclick: 'getisoimageboth()' }), make(doc, 'br'), '(Snapshots: Keine)']);
  const p = api.vmDiskParts(span);
  ok('the vDisk count keeps its size', p.disks === '2 / 24G', p.disks);
  ok('and the CD count stands on its own', p.cds === '0 / 2', p.cds);
  ok('the snapshots are read with their label', p.snapLabel === 'Snapshots' && p.snapVal === 'Keine');
  ok('the ISO picker is kept for the CD badge', p.link && p.link.getAttribute('onclick') === 'getisoimageboth()');
  const td = make(doc, 'td', {}, [make(doc, 'span', { class: 'vmgraphics' }, ['192.168.20.55/24', make(doc, 'br'), '2a02:8388::55/64'])]);
  ok('every address line is one IP', JSON.stringify(api.vmIpLines(td)) === '["192.168.20.55/24","2a02:8388::55/64"]');
  const none = make(doc, 'td', {}, [make(doc, 'span', { class: 'vmgraphics' }, ['Erfordert einen laufenden Gast-Agenten'])]);
  ok('the guest agent sentence is no IP', api.vmIpLines(none).length === 0);
  const cells = grabFn('vmCells');
  ok('the graphics and IP cells are found inside a badge too, so a second pass cannot take the IP cell for the graphics', /":scope > td span\.vmgraphics"/.test(cells) && /closest\("td"\)/.test(cells));
}

const table = make(doc, 'table', { id: 'kvm_table' });
const tbody = make(doc, 'tbody', { id: 'kvm_list' });
table.appendChild(tbody);
const box = make(doc, 'div', { class: 'TableContainer' }, [table]);
doc.body.appendChild(box);
const rows = { CasaOS: vmRow(doc, 'CasaOS', 'u1', false), MOS: vmRow(doc, 'MOS', 'u2', true) };
tbody.appendChild(rows.CasaOS); tbody.appendChild(rows.MOS);
const base = (name, uuid, state, ips) => ({ name, uuid, state, label: state === 'running' ? 'Gestartet' : 'Gestoppt', cpu: '2', ram: '3G', disks: { disks: '2 / 24G', cds: '0 / 2', link: null, snapLabel: 'Snapshots', snapVal: 'Keine' }, graphics: 'VNC:auto', ips, auto: false, ctx: state });
const data = { CasaOS: base('CasaOS', 'u1', 'exited', []), MOS: base('MOS', 'u2', 'running', ['192.168.20.55/24', '2a02:8388::55/64']) };
rows.CasaOS.style.setProperty('--cc-rb-c', '#FF8389');

console.log('\nThe tiles stand beside the table');
api.renderVmGrid();
const grid = api.holder() && api.holder().firstChild;
{
  ok('in a container of their own, ahead of the table', api.holder() && api.holder().nextSibling === table && api.holder().parentNode === box);
  ok('the table rows stay where Unraid put them', tbody.children.length === 2 && tbody.children[0] === rows.CasaOS);
  ok('one tile per VM, in the table order', grid.children.map((c) => c.getAttribute('data-name')).join() === 'CasaOS,MOS');
  ok('a tile takes its row\'s rainbow slot', grid.children[0].style.getPropertyValue('--cc-rb-c') === '#FF8389');
  ok('the CSS hides the table only in the tile view', /html\.cc-vms-on\.cc-vmgrid #displaybox #kvm_table \{ display: none !important; \}/.test(css));
  ok('and lays the tiles out on the Docker grid\'s column width', /\.cc-vm-grid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(min\(400px, 100%\), 1fr\)\); gap: var\(--cc-card-space\); \}/.test(css));
}

console.log('\nA tile');
{
  const [casa, mos] = grid.children;
  const ico = casa.querySelector('.cc-vmc-icobox > .img');
  ok('the logo box holds a copy of the row\'s icon', ico && ico.getAttribute('src') === '/x.png');
  ok('without the inline tint the row carries, so the icon pass paints it afresh', ico && ico.getAttribute('style') == null);
  ok('the icon pass reaches the tile icons', /\.cc-vm-grid \.cc-vmc-icobox > \.img/.test(grabFn('vmImgs')) && /closest\("tr, \.cc-vmc"\)/.test(grabFn('vmIconName')));
  ok('the name heads the tile with the row\'s warning beside it', casa.querySelector('.cc-vmc-title').textContent === 'CasaOS' && !!casa.querySelector('.cc-vmc-title > i.fa-warning'));
  ok('the addresses run as one line under the name', mos.querySelector('.cc-vmc-ip').textContent === '192.168.20.55/24 · 2a02:8388::55/64');
  const noip = casa.querySelector('.cc-vmc-ip .cc-vmb-noip');
  ok('without an address the line is a dash', noip && noip.querySelector('.cc-vmb-noip-dash').textContent === '-');
  ok('with the guest agent explained in its (i)', noip && /QEMU-Gast-Agent/.test(noip.querySelector('.cc-info').getAttribute('data-tip')));
  ok('a stopped VM shows its state in the corner', casa.querySelector('.cc-vmc-state .cc-badge-exited').textContent === 'Gestoppt');
  ok('a running one shows none, the normal case', !mos.querySelector('.cc-vmc-state'));
  ok('the actions stand in their own row', casa.children[1].classList.contains('cc-vmc-actbar') && !!casa.querySelector('.cc-vmc-actbar > .cc-actbar'));
  const res = casa.querySelector('.cc-vmc-res');
  ok('the resource badges sit at the foot', casa.children[casa.children.length - 1] === res && res.getAttribute('data-cc-vm') === 'CasaOS');
  const kinds = res.querySelectorAll('.cc-b-k').map((k) => k.textContent).join();
  ok('CPU, RAM, BW, vDisks, CD and Snapshots in that order', kinds === 'CPU,RAM,BW,vDisks,CD,Snapshots', kinds);
  ok('CPU, RAM, BW and vDisks each with their gear', ['cpu', 'ram', 'bw', 'disk'].every((w) => res.querySelector('.cc-lim-' + w)));
  ok('the graphics close the row', res.children[res.children.length - 1].textContent === 'VNC:auto');
}

console.log('\nThe autostart switch works the row\'s own control');
{
  const casa = grid.children[0], tg = casa.querySelector('.cc-vmc-auto');
  ok('it is a switch, not a checkbox', tg && tg.getAttribute('role') === 'switch' && tg.classList.contains('cc-set-toggle'));
  ok('it starts in the row\'s state', tg.getAttribute('aria-checked') === 'false' && grid.children[1].querySelector('.cc-vmc-auto').getAttribute('aria-checked') === 'true');
  tg.click();
  const input = rows.CasaOS.querySelector('input.autostart');
  ok('a click goes through Unraid\'s switchButton, whose change handler saves it', input.saved === 1 && input.checked === true);
  ok('and the switch follows the checkbox', tg.getAttribute('aria-checked') === 'true');
}

console.log('\nA pass redraws only what changed');
{
  const [casa, mos] = grid.children, built = actionBars;
  api.renderVmGrid();
  ok('an unchanged VM keeps its tile', grid.children[0] === casa && grid.children[1] === mos && actionBars === built);
  data.MOS = Object.assign({}, data.MOS, { state: 'exited', label: 'Gestoppt', ctx: 'exited' });
  api.renderVmGrid();
  ok('a VM that stopped gets a fresh tile', grid.children[1] !== mos && !!grid.children[1].querySelector('.cc-vmc-state'));
  ok('and the others stay as they were', grid.children[0] === casa);
  tbody.insertBefore(rows.MOS, rows.CasaOS);
  api.renderVmGrid();
  ok('a resorted table reorders the tiles without rebuilding them', grid.children.map((c) => c.getAttribute('data-name')).join() === 'MOS,CasaOS' && grid.children[1] === casa);
  tbody.removeChild(rows.CasaOS);
  api.renderVmGrid();
  ok('a removed VM loses its tile', grid.children.length === 1);
  api.removeVmGrid();
  ok('the list view takes the container away', !api.holder() && box.children.length === 1);
}

console.log('\nOn a phone');
{
  ok('the corner becomes one row under the name', /@media \(max-width: 540px\) \{ html\.cc-vms-on \.cc-vmc-corner \{ flex: 1 0 100%; flex-direction: row-reverse;/.test(css));
  ok('and the switch gets a line under the sub-tabs', /@media \(max-width: 600px\) \{\s*html\.cc-vms-on #displaybox > nav\.tabs \{ flex-wrap: wrap;/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
