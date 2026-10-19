// Column widths saved on a wide screen shrink to fit a narrower page, so the last /Main columns are
// not cut off at its edge, but never below a header's whole label; where the labels need more than
// the page, the table scrolls in its own box. They grow back on a wider page. A drag still widens
// the table, and the drag starts from the widths as drawn, so nothing jumps under the pointer. On
// a narrow page the array operations stack and the unassigned-device tables scroll in their own
// box, so the page never scrolls sideways.
const fs = require('fs');
const path = require('path');
const { DIR, parseRules } = require('./cascade');
const shares = fs.readFileSync(path.join(DIR, 'scripts/shares.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const SAVED = [238, 131, 513, 91, 129, 131, 78, 82, 95, 200, 205];   // 1893px, saved on a wide screen
const HEADS = ['Gerät', 'Durchsuchen', 'Identifikation', 'Temp', 'Gelesen', 'Geschrieben', 'Fehler', 'DS', 'Größe', 'Benutzt', 'Frei'];
const CHAR = 8, PAD = 10;   // the canvas stub draws every character 8px wide; each header has 10px padding a side
const LABEL = HEADS.map((h) => h.toUpperCase().length * CHAR + 2 * PAD + 2);
const sum = (a) => a.reduce((x, y) => x + y, 0);
function rig(roomPx) {
  const store = { 'cc.main.colpx': JSON.stringify(SAVED) };
  let resize = null;
  const mk = (tag) => (tag === 'canvas'
    ? { getContext: () => ({ font: '', measureText: (s) => ({ width: s.length * CHAR }) }) }
    : { tag, children: [], style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; } });
  const head = { children: HEADS.map((h) => ({ textContent: ' ' + h + ' ' })), getClientRects: () => [1] };
  const table = {
    cls: new Set(), style: {}, cg: null, parentNode: { clientWidth: roomPx },
    classList: { add(c) { table.cls.add(c); }, remove(c) { table.cls.delete(c); }, toggle(c, on) { on ? table.cls.add(c) : table.cls.delete(c); }, contains: (c) => table.cls.has(c) },
    querySelector: (s) => (s === ':scope > colgroup[data-cc-colw]' ? table.cg : s === 'thead tr' ? head : null),
    insertBefore(cg) { table.cg = cg; },
    getBoundingClientRect: () => ({ width: roomPx }),
  };
  const document = { querySelectorAll: () => [table], createElement: mk, documentElement: { classList: { add() {}, remove() {} } } };
  const window = { addEventListener: (t, fn) => { if (t === 'resize') resize = fn; } };
  const getComputedStyle = () => ({ textTransform: 'uppercase', fontStyle: 'normal', fontWeight: '700', fontSize: '12px', fontFamily: 'sans-serif', letterSpacing: 'normal', paddingLeft: PAD + 'px', paddingRight: PAD + 'px' });
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
  const g = (k, d) => { const v = localStorage.getItem(k); return v == null ? d : v; };
  const make = new Function('document', 'window', 'getComputedStyle', 'localStorage', 'g', 'el', 'mtText', grabFn(shares, 'ccColFactory') + '\nreturn ccColFactory;')(document, window, getComputedStyle, localStorage, g, mk, (s) => s);
  const cols = make({ key: 'cc.main.colpx', n: 11, sel: 'table' });
  const widths = () => table.cg.children.map((c) => parseInt(c.style.width, 10));
  return { cols, table, widths, store, setRoom: (px) => { table.parentNode.clientWidth = px; }, resize: () => resize && resize() };
}

console.log('\nSaved widths on a narrower page');
{
  const r = rig(1575);
  r.cols.apply();
  const w = r.widths();
  ok('the table fits the 1575px the page has', sum(w) <= 1575 && sum(w) > 1560 && parseInt(r.table.style.width, 10) <= 1575, sum(w) + 'px, table ' + r.table.style.width);
  ok('no header loses part of its label, "GESCHRIEBEN" among them', w.every((v, i) => v >= Math.min(SAVED[i], LABEL[i])), w.map((v, i) => HEADS[i] + ' ' + v + '/' + LABEL[i]).join(', '));
  ok('and no column grows past its saved width', w.every((v, i) => v <= SAVED[i]));
  const free = w.map((v, i) => i).filter((i) => w[i] > LABEL[i] && w[i] > 40);
  const k = free.map((i) => w[i] / SAVED[i]);
  ok('the columns above their labels shrink in one proportion, so a wide name column stays wide', free.length > 3 && Math.max(...k) - Math.min(...k) < 0.01, k.map((x) => x.toFixed(3)).join(','));
  ok('the saved widths stay as they were', r.store['cc.main.colpx'] === JSON.stringify(SAVED));
  r.setRoom(2400); r.resize();
  ok('on a wider window they grow back to the saved widths', r.widths().join() === SAVED.join(), r.widths().join());
}

console.log('\nA page narrower than the labels need');
{
  const r = rig(743);
  r.cols.apply();
  const w = r.widths();
  ok('every header keeps its whole label, no column under 40px', w.every((v, i) => v === Math.min(SAVED[i], Math.max(40, LABEL[i]))), w.join(','));
  ok('and the table scrolls inside its box instead of cutting them', sum(w) > 743, sum(w) + 'px');
}


console.log('\nA drag');
{
  const down = grabFn(grabFn(shares, 'ccColFactory'), 'down');
  ok('starts from the header cells as drawn, not from the saved set', /var w = \[\]; for \(var k = 0; k < n; k\+\+\) w\.push\(Math\.max\(min, Math\.round\(h\.children\[k\]\.getBoundingClientRect\(\)\.width\)\)\);/.test(down) && !/read\(\)/.test(down));
  ok('and widens the table instead of fitting it', /set\(drag\.w\);/.test(grabFn(grabFn(shares, 'ccColFactory'), 'move')));
}

console.log('\nThe array operations on a narrow page');
{
  const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Shares.css'), 'utf8');
  const narrow = css.slice(css.indexOf('@media (max-width: 1023px)'));
  const body = narrow.slice(0, narrow.indexOf('\n}\n'));
  const rules = parseRules(body.slice(body.indexOf('{') + 1));
  const find = (re) => rules.find((r) => re.test(r.selector));
  const tr = find(/table\.array_status tr$/);
  ok('the label and the control stack in one track', tr && tr.decls.some((d) => d.prop === 'grid-template-columns' && d.value === 'minmax(0, 1fr)'));
  const pc = find(/\.cc-aop-pcard$/);
  ok('the parity card follows the buttons in the flow', pc && pc.decls.some((d) => d.prop === 'position' && d.value === 'static'));
  const brow = find(/\.cc-aop-brow$/), sw = find(/\.cc-aop-toggle$/);
  ok('a switch beside a button wraps under it', brow && brow.decls.some((d) => d.prop === 'flex-wrap' && d.value === 'wrap') && sw && sw.decls.some((d) => d.prop === 'white-space' && d.value === 'normal'));
  const ud = find(/:is\(\.show-disks, \.show-shares\)$/);
  ok('the unassigned-device tables scroll inside their own box', ud && ud.decls.some((d) => d.prop === 'overflow-x' && d.value === 'auto'));
}

console.log('\nThe header on a phone');
{
  const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Header.css'), 'utf8');
  const at = css.indexOf('/* On a phone the name and the island');
  const block = css.slice(css.indexOf('@media (max-width: 767.98px) {', at), css.indexOf('\n}\n', at));
  ok('the island goes under a long server name instead of past the edge', /#header \{ flex-wrap: wrap;/.test(block) && /#cc-island \{[^}]*order: 3; flex: 1 0 100%;/.test(block));
  ok('its three rows flow as one run of chips', /\.cc-isl-row:empty \{ display: contents; \}/.test(block));
  ok('only the values worth a glance stay', /\[data-cc-chip="up"\], \[data-cc-chip="os"\], \[data-cc-chip="ver"\], \[data-cc-chip="net"\], \[data-cc-chip="docker"\]\) \{ display: none; \}/.test(block));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
