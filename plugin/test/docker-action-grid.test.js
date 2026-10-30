// A Docker row's actions stand in three rows that line up with the three badges of the network
// and limits columns: WebUI, Log, Bearbeiten; Neustart, Pause, Stoppen; Konsole, Aktualisieren,
// Entfernen and Mehr. What can quietly break it:
//   · an action that does not apply leaving a hole, so the rows of a list stop lining up
//   · a stopped container offering its WebUI or console
//   · Entfernen landing on the rainbow's red, or going red at all
//   · Mehr holding the console or the remove although both have a button of their own, or
//     losing the limit editors a stopped container has no gear for
//   · a bar that keeps its old buttons after a start or stop, or drops the keyboard focus
//   · a gap between the buttons other than the one between the badges beside them
const fs = require('fs');
const path = require('path');
const { candidates, PAGES } = require('./cascade');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const js = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const theme = fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

class El {
  constructor(tag, cls) { this.tag = tag; this.cls = new Set((cls || '').split(/\s+/).filter(Boolean)); this.attrs = {}; this.kids = []; this.parentNode = null; this.css = {}; this.dataset = {}; this.handlers = {}; this.innerHTML = ''; const self = this; this.style = { setProperty: (k, v) => { self.css[k] = v; }, removeProperty: (k) => { delete self.css[k]; } }; }
  get classList() { const c = this.cls; return { add: (x) => c.add(x), contains: (x) => c.has(x), remove: (x) => c.delete(x) }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, f) { this.handlers[t] = f; }
  appendChild(c) { this.kids.push(c); c.parentNode = this; return c; }
  replaceChild(n, o) { const i = this.kids.indexOf(o); this.kids[i] = n; n.parentNode = this; o.parentNode = null; return o; }
  all() { return this.kids.flatMap((k) => [k].concat(k.all())); }
  querySelectorAll(sel) { if (sel === '.cc-actbtn') return this.all().filter((k) => k.cls.has('cc-actbtn')); if (sel === '.cc-actrow') return this.all().filter((k) => k.cls.has('cc-actrow')); throw new Error(sel); }
  focus() { env.document.activeElement = this; }
  click() { this.handlers.click({ preventDefault() {}, stopPropagation() {} }); }
}
const store = { 'cc.rainbow': '0' };
const calls = [];
const env = {
  document: { createElement: (t) => new El(t), activeElement: null },
  window: {
    CCTheme: Object.assign(new Function('store', 'function g(k, d) { return k in store ? store[k] : d; }' + grab(theme, 'isRed') + grab(theme, 'deleteSlot') + 'return { isRed: isRed, deleteSlot: deleteSlot };')(store), { menu: (a, items) => calls.push(['menu', items.map((i) => i.label)]) }),
    open: (u) => calls.push(['open', u]),
    openTerminal: (...a) => calls.push(['term'].concat(a)),
    updateContainer: (n) => calls.push(['update', n]),
    rmContainer: (n, img, id) => calls.push(['rm', n, id]),
  },
  localStorage: { getItem: (k) => (k in store ? store[k] : null) },
};
let ctx = { webui: 'http://x', xml: '/t.xml', tswebui: 'http://ts', shell: 'bash', id: 'abc', image: 'img', links: [{ url: 'http://s', tip: 'Support', glyph: 'Help' }] };
let containers = {};
const RB = JSON.parse(/var RB = (\[[^\]]+\]);/.exec(theme)[1]);
const api = new Function('document', 'window', 'localStorage', 'getCtx', 'getC', 'RB', 'calls',
  'var LANG = "de", MARK = "data-cc", RB_PAL = RB, RB_OFFSET = 0, pendingAction = {};\n' +
  'function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls, n.cls = new Set(cls.split(" ")); if (txt != null) n.textContent = txt; return n; }\n' +
  'function t(k) { return { restart: "Neustart", pause: "Pause", resume: "Fortsetzen", stop: "Stoppen", start: "Starten", updateCt: "Aktualisieren", cpuLimit: "CPU-Limit", ramLimit: "RAM-Limit", bandwidth: "Bandbreite" }[k]; }\n' +
  'function openLimits(a, n, w) { calls.push(["limits", n, w]); } function openBandwidth(a, n) { calls.push(["bandwidth", n]); }\n' +
  'function ccGlyph(n) { return n; } function themingOn() { return true; } function effc() { return "#FCC419"; } function ccPalActive(p) { return p; }\n' +
  'function idealText(c) { return "#161616"; } function ctxFor() { return getCtx(); } function containerByName(n) { return getC()[n]; }\n' +
  'function glyphState() { return ""; } function doAction(n, a) { calls.push(["action", n, a]); }\n' +
  'function findRows() { return getC().__rows || []; } function rowName(tr) { return tr.name; }\n' +
  [grab(js, 'actBtn'), grab(js, 'actBtnOff'), grab(js, 'limitItems'), grab(js, 'tintAct'), grab(js, 'actionBars'), grab(js, 'syncActionBars')].join('\n') +
  '\nreturn { bars: actionBars, sync: syncActionBars };')(env.document, env.window, env.localStorage, () => ctx, () => containers, RB, calls);

const rows = (bar) => bar.querySelectorAll('.cc-actrow').map((r) => r.kids.map((b) => b.innerHTML + (b.cls.has('cc-actoff') ? '-' : '')).join(' '));

console.log('\nThree rows, three, three and four');
{
  const bar = api.bars('web', { state: 'running' }, null).bar;
  const r = rows(bar);
  ok('WebUI, Log, Bearbeiten', r[0] === 'ExternalLink Log Pencil', r[0]);
  ok('Neustart, Pause, Stoppen', r[1] === 'Retry Pause Stop', r[1]);
  ok('Konsole, Aktualisieren, Entfernen, Mehr', r[2] === 'Code Update Trash More', r[2]);
  ok('the bar knows the state it was drawn for', bar.dataset.ccState === 'running');
  const b = bar.querySelectorAll('.cc-actbtn');
  b[6].click(); b[7].click(); b[8].click();
  ok('Konsole opens the container\'s shell', JSON.stringify(calls.shift()) === JSON.stringify(['term', 'docker', 'web', 'bash']));
  ok('Aktualisieren hands the container to Unraid\'s own update, which asks first', JSON.stringify(calls.shift()) === JSON.stringify(['update', 'web']));
  ok('Entfernen goes through Unraid\'s own remove dialog', JSON.stringify(calls.shift()) === JSON.stringify(['rm', 'web', 'abc']));
  b[9].click();
  ok('Mehr holds the limit editors and what has no button of its own', JSON.stringify(calls.shift()) === JSON.stringify(['menu', ['CPU-Limit', 'RAM-Limit', 'Bandbreite', 'Tailscale WebUI', 'Support']]));
  ok('every live button carries its name', b.filter((x) => !x.cls.has('cc-actoff')).every((x) => x.attrs['aria-label'] && x.attrs['data-tip']));
}

console.log('\nAn action that does not apply keeps its slot');
{
  const stopped = rows(api.bars('web', { state: 'exited' }, null).bar);
  ok('a stopped container: WebUI, console and pause disabled, start in the stop slot', stopped.join(' / ') === 'ExternalLink- Log Pencil / Retry Pause- Play / Code- Update Trash More', stopped.join(' / '));
  ok('a paused one resumes from the pause slot', rows(api.bars('web', { state: 'paused' }, null).bar)[1] === 'Retry Resume Stop');
  ctx = { webui: '', xml: '', tswebui: '', shell: '', id: '', image: '', links: [] };
  const bare = rows(api.bars('bare', { state: 'running' }, null).bar);
  ok('no WebUI, no template, no id and no links: every slot stays, disabled', bare.join(' / ') === 'ExternalLink- Log Pencil- / Retry Pause Stop / Code Update Trash- More', bare.join(' / '));
  ok('so every row has three, three and four', bare.map((r) => r.split(' ').length).join('') === '334');
}

console.log('\nEntfernen is never red');
{
  ctx = { webui: 'http://x', xml: '/t.xml', tswebui: '', shell: '', id: 'abc', image: 'img', links: [] };
  const bar = api.bars('web', { state: 'running' }, null).bar;
  const rm = bar.querySelectorAll('.cc-actbtn')[8];
  ok('in accent mode it takes the accent like its neighbours', rm.css.background === '#FCC419' && bar.querySelectorAll('.cc-actbtn')[7].css.background === '#FCC419');
  store['cc.rainbow'] = '1'; store['cc.rainbowrot'] = '0';
  // Slot 8 of the eight-colour palette is red again; the remove takes the next one.
  const rb = api.bars('web', { state: 'running' }, null).bar.querySelectorAll('.cc-actbtn')[8];
  ok('under the rainbow, where its slot comes round to red, it takes the next one', rb.css.background === RB[1] && !env.window.CCTheme.isRed(rb.css.background), rb.css.background);
  store['cc.rainbow'] = '0';
}

console.log('\nA start or stop redraws the bar');
{
  const tr = { name: 'web', cell: new El('td') };
  tr.querySelector = (sel) => (sel === '.cc-actbar' ? tr.cell.kids[0] || null : null);
  const first = api.bars('web', { state: 'running' }, tr).bar;
  tr.cell.appendChild(first);
  containers = { web: { state: 'running' }, __rows: [tr] };
  api.sync();
  ok('an unchanged state leaves the bar alone', tr.cell.kids[0] === first);
  first.querySelectorAll('.cc-actbtn')[5].focus();
  containers.web.state = 'exited';
  api.sync();
  const now = tr.cell.kids[0];
  ok('a stopped container gets a fresh bar', now !== first && now.dataset.ccState === 'exited' && rows(now)[0] === 'ExternalLink- Log Pencil');
  ok('the keyboard focus stays on its slot', env.document.activeElement === now.querySelectorAll('.cc-actbtn')[5]);
}

console.log('\nThe gaps are the badges\' gaps');
{
  const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const DENS = ['.cc-dens-compact', '.cc-dens-airy'];
  const win = (cls, dens, prop) => { const c = candidates('docker', { tag: 'div', classes: cls, attrs: {}, states: {}, html: ['cc-docker-on'], inside: ['.cc-enh'].concat(dens ? [dens] : []), outside: DENS.filter((d) => d !== dens) }, prop); return c[c.length - 1]; };
  const gap = { '': '5px', '.cc-dens-compact': '3px', '.cc-dens-airy': '8px' };
  for (const [dens, px] of Object.entries(gap)) {
    const decl = new RegExp('\\.cc-enh' + dens.replace(/\./g, '\\.') + ' \\{ --cc-badge-gap: ([\\d.]+px); \\}').exec(css);
    ok('density ' + (dens || 'normal') + ': the action gap is ' + px, !!decl && decl[1] === px);
    const net = win(['cc-rowbadges', 'cc-netgroup'], dens, 'gap');
    ok('density ' + (dens || 'normal') + ': as between the network badges', !!net && net.value === px, net && net.selector + ' => ' + net.value);
  }
  for (const cls of ['cc-actbar', 'cc-actrow']) {
    const w = win([cls], '', 'gap');
    ok('.' + cls + ' reads the shared gap', !!w && w.value === 'var(--cc-badge-gap, 5px)', w && w.value);
  }
  const btn = win(['cc-actbtn'], '', 'height'), gear = win(['cc-limbtn'], '', 'height');
  ok('a button row is as tall as a limits row, whose gear is the same icon badge', !!btn && !!gear && btn.value === gear.value && /--cc-icon-badge/.test(btn.value), (btn && btn.value) + ' vs ' + (gear && gear.value));
  ok('the column fits four buttons and three gaps', /th:nth-child\(2\) \{ width: calc\(4 \* var\(--cc-icon-badge, 26px\) \+ 3 \* var\(--cc-badge-gap, 5px\)\); \}/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
