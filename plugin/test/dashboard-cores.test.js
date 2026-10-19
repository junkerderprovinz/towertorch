// The processor tile's core grid on the Dashboard (dashboard.js, TowerTorch.Dashboard.css).
// What can quietly break it:
//   · grouping read from one CPU model instead of the rows Unraid prints, so another CPU loses cores
//   · a thread cell copied instead of moved, so Unraid's updates land in a hidden row
//   · the grid in a new row Unraid does not watch, so the per core values stop updating
//   · switching the area off leaving the rows rebuilt
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const js = fs.readFileSync(path.join(DIR, 'scripts', 'dashboard.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'sheets', 'TowerTorch.Dashboard.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabBlock(src, start) {
  const i = src.indexOf(start);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, src.indexOf(';', k) + 1); } }
  throw new Error('unbalanced block: ' + start);
}

// Elements and text with the handful of DOM calls the grid uses.
class Node {
  constructor(tag, cls, text) {
    this.nodeType = tag ? 1 : 3; this.tagName = tag ? tag.toUpperCase() : undefined;
    this.children = []; this.childNodes = []; this.parentNode = null; this.id = ''; this.cls = new Set();
    if (cls) this.className = cls;
    if (!tag) this.nodeValue = text;
    const self = this;
    this.classList = { add: (c) => self.cls.add(c), remove: (c) => self.cls.delete(c), contains: (c) => self.cls.has(c) };
  }
  get className() { return [...this.cls].join(' '); }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(v) { this.childNodes.forEach((n) => (n.parentNode = null)); this.childNodes = []; this.children = []; this.appendChild(new Node(null, null, String(v))); }
  appendChild(n) {
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this; this.childNodes.push(n); if (n.nodeType === 1) this.children.push(n);
    return n;
  }
  removeChild(n) {
    this.childNodes = this.childNodes.filter((x) => x !== n); this.children = this.children.filter((x) => x !== n);
    n.parentNode = null; return n;
  }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  byId(id) { return this.all().find((n) => n.id === id) || null; }
  byCls(c) { return this.all().filter((n) => n.cls.has(c)); }
  html() { return this.nodeType === 3 ? this.nodeValue : '<' + this.tagName + (this.id ? '#' + this.id : '') + (this.cls.size ? '.' + [...this.cls].join('.') : '') + '>' + this.childNodes.map((n) => n.html()).join('') + '</>'; }
}
const make = (tag, cls, kids) => { const n = new Node(tag, cls); (kids || []).forEach((k) => n.appendChild(typeof k === 'string' ? new Node(null, null, k) : k)); return n; };

// The processor tbody as DashStats.page prints it: the head rows, then per physical CPU an optional
// power line (more than one socket) and one row per core, a pair "a-b" when it has two threads.
function cpuTile(packages, types) {
  const tb = make('tbody');
  tb.appendChild(make('tr', '', [make('td', '', ['Prozessor'])]));
  const main = make('tr', '', [make('td', '', ['Details ausblenden'])]); main.id = 'cpu_main';
  tb.appendChild(main);
  tb.appendChild(make('tr'));
  const cell = (n, w) => { const bar = make('span'); bar.id = 'cpu' + n; return make('span', 'dashboard ' + w, [make('span', 'cpu' + n + ' load resize', ['0%']), make('div', 'usage-disk sys', [bar, make('span')])]); };
  packages.forEach((pairs, p) => {
    if (packages.length > 1) {
      tb.appendChild(make('tr', '', [make('td', 'thin')]));
      tb.appendChild(make('tr', '', [make('td', '', [make('span', 'cpu_open w72', ['Physical CPU ' + p + ' Power: N/A'])])]));
    }
    for (const pair of pairs) {
      const [a, b] = pair;
      const type = types && types[a] ? '(' + types[a] + ')' : '';
      const label = make('span', 'w26', [b != null ? `CPU ${a} ${type} - HT ${b} ` : `CPU ${a} ${type}`]);
      const td = b != null ? make('td', '', [label, cell(a, 'w36'), cell(b, 'w36')]) : make('td', '', [label, cell(a, 'w72')]);
      tb.appendChild(make('tr', 'cpu_open', [td]));
    }
  });
  const chart = make('tr', '', [make('td')]); chart.id = 'cpu_chart';
  tb.appendChild(chart);
  return tb;
}

function load(tb) {
  const document = { createElement: (t) => new Node(t), getElementById: (id) => tb.byId(id) };
  const names = ['t', 'el', 'hasCls', 'threadsOf', 'coreHead', 'gridOf', 'buildCores', 'unbuildCores'];
  const src = 'var LANG = "de";\n' + grabBlock(js, 'var TXT = {') + '\nvar CORES = [];\n' + names.map((n) => grabFn(js, n)).join('\n') + '\nreturn { buildCores: buildCores, unbuildCores: unbuildCores };';
  return new Function('document', src)(document);
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const LAYOUTS = [
  {
    name: 'P and E cores, P cores with hyperthreading (i9-13900K)',
    packages: [[...range(0, 7).map((i) => [2 * i, 2 * i + 1]), ...range(16, 31).map((i) => [i])]],
    types: Object.fromEntries([...range(0, 15).map((i) => [i, 'P-Core']), ...range(16, 31).map((i) => [i, 'E-Core'])]),
    groups: [['P-Kerne', '8 Kerne, 16 Threads'], ['E-Kerne', '16 Kerne']],
  },
  {
    name: 'no core types, hyperthreading with distant siblings (8 core AMD)',
    packages: [range(0, 7).map((i) => [i, i + 8])],
    groups: [[null, null]],
  },
  {
    name: 'no core types, no hyperthreading (4 cores)',
    packages: [range(0, 3).map((i) => [i])],
    groups: [[null, null]],
  },
  {
    name: 'P cores without hyperthreading next to E cores',
    packages: [[...range(0, 5).map((i) => [i]), ...range(6, 13).map((i) => [i])]],
    types: Object.fromEntries([...range(0, 5).map((i) => [i, 'P-Core']), ...range(6, 13).map((i) => [i, 'E-Core'])]),
    groups: [['P-Kerne', '6 Kerne'], ['E-Kerne', '8 Kerne']],
  },
  {
    name: 'two sockets, 256 threads',
    packages: [range(0, 63).map((i) => [i, i + 128]), range(64, 127).map((i) => [i, i + 128])],
    groups: [[null, null]],
  },
];

for (const L of LAYOUTS) {
  console.log('\n' + L.name);
  const tb = cpuTile(L.packages, L.types);
  const before = tb.html();
  const coreRows = tb.children.filter((r) => r.cls.has('cpu_open') && r.byCls('usage-disk').length);
  const api = load(tb);
  api.buildCores();
  const grids = tb.byCls('cc-cores');
  ok('one grid per physical CPU', grids.length === L.packages.length, grids.length);
  grids.forEach((box, p) => {
    const groups = box.children;
    const heads = groups.map((g) => { const h = g.children.find((c) => c.cls.has('cc-cores-head')); return h ? [h.children[0].textContent, h.children[1].textContent] : [null, null]; });
    ok('CPU ' + p + ': the groups and their headings follow the core types Unraid prints', JSON.stringify(heads) === JSON.stringify(L.groups), JSON.stringify(heads));
    const pairs = L.packages[p];
    const cores = box.byCls('cc-core');
    ok('CPU ' + p + ': one tile per physical core', cores.length === pairs.length, cores.length);
    ok('CPU ' + p + ': a core with two threads spans two columns, one with one thread a single column',
      cores.every((c, i) => c.cls.has('cc-core-ht') === (pairs[i].length === 2) && c.children.length === pairs[i].length));
    const labels = box.byCls('cc-thr-n').map((n) => n.textContent);
    const want = pairs.flatMap((pr) => pr.map((n, k) => (k ? 'HT ' : 'CPU ') + n));
    ok('CPU ' + p + ': every thread once, in Unraid\'s order, named after its bar', JSON.stringify(labels) === JSON.stringify(want), labels.slice(0, 6).join(','));
  });
  const threads = L.packages.flat(2);
  const lost = threads.filter((n) => { const bar = tb.byId('cpu' + n); const load = tb.byCls('cpu' + n)[0]; return !bar || !load || !bar.parentNode.parentNode.parentNode.cls.has('cc-thr') || load.parentNode !== bar.parentNode.parentNode; });
  ok('Unraid still finds every load and bar by id and class, inside the grid', lost.length === 0, lost.slice(0, 5).join(','));
  ok('no load cell was copied', threads.every((n) => tb.byCls('cpu' + n).length === 1));
  const hosts = coreRows.filter((r) => r.cls.has('cc-cores-host'));
  ok('the grid sits in the first core row of each CPU, a row Unraid already watches', hosts.length === L.packages.length && hosts.every((r) => r.cls.has('cpu_open') && r.children.some((c) => c.cls.has('cc-cores-td'))));
  ok('every other core row is set aside', coreRows.filter((r) => r.cls.has('cc-cores-spent')).length === coreRows.length - L.packages.length);
  api.buildCores();
  ok('a second pass builds nothing twice', tb.byCls('cc-cores').length === L.packages.length);
  api.unbuildCores();
  ok('switched off, the rows are exactly as Unraid printed them', tb.html() === before);
}

console.log('\nThe sheet');
ok('set aside rows stay hidden even when Unraid shows the core rows again', /tr\.cpu_open\.cc-cores-spent \{ display: none !important; \}/.test(css));
ok('four columns at desktop width', /\.cc-cores-grid \{[^}]*repeat\(4, minmax\(0, 1fr\)\)/.test(css));
ok('a hyperthreaded pair keeps to one row', /\.cc-core-ht \{ grid-column: span 2;/.test(css));
ok('the live values use tabular figures', /\.cc-thr \.load \{[^}]*tabular-nums/.test(css));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
