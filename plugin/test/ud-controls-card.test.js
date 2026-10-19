// Unassigned Devices' controls (gear, refresh and three switches) leave UD's title bar on /Main.
// While UD's parts are tile cards they are a card of their own at the end of that row, under a
// badge, one line per control with its name and (i) at the start and the control at the end. They
// stay UD's own nodes, so UD's handlers keep answering, and no badge line keeps room for them.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const shares = read('scripts/shares.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// Every rule with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined && !head.startsWith('@')) out.push({ sel: head, body: buf.trim(), media: stack.join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}

// Elements with just enough of the DOM for the move: compound selectors with tag, id, classes and
// [attr], [attr*=], [attr^=], joined by spaces or ">" and listed with commas, plus :scope.
class Elem {
  constructor(tag, attrs, kids) {
    this.tagName = tag.toUpperCase(); this.attrs = Object.assign({}, attrs); this.children = []; this.parentNode = null; this.text = '';
    const self = this;
    this.classList = {
      contains: (c) => self.cls().includes(c),
      add: (c) => { if (!self.cls().includes(c)) self.attrs.class = self.cls().concat(c).join(' '); },
      remove: (c) => { self.attrs.class = self.cls().filter((x) => x !== c).join(' '); },
      toggle: (c, on) => { if (on === undefined) on = !self.classList.contains(c); on ? self.classList.add(c) : self.classList.remove(c); return on; },
    };
    (kids || []).forEach((k) => this.appendChild(typeof k === 'string' ? Object.assign(new Elem('#text'), { text: k }) : k));
  }
  cls() { return (this.attrs.class || '').split(' ').filter(Boolean); }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  get textContent() { return this.tagName === '#TEXT' ? this.text : this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this.text = String(v); }
  get firstChild() { return this.children[0] || null; }
  get lastElementChild() { return this.elems().slice(-1)[0] || null; }
  elems() { return this.children.filter((c) => c.tagName !== '#TEXT'); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(k) { return this.insertBefore(k, null); }
  insertBefore(k, ref) {
    if (k.parentNode) k.parentNode.removeChild(k);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(k); else this.children.splice(i, 0, k);
    k.parentNode = this; return k;
  }
  removeChild(k) { this.children = this.children.filter((c) => c !== k); k.parentNode = null; return k; }
  all() { return this.elems().flatMap((c) => [c].concat(c.all())); }
  querySelectorAll(sel) { return this.all().filter((e) => matches(e, sel, this)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { for (let e = this; e && e.tagName; e = e.parentNode) if (matches(e, sel, null)) return e; return null; }
}
const h = (tag, attrs, kids) => new Elem(tag, attrs, kids);
function compound(e, part, scope) {
  if (part === ':scope') return e === scope;
  const re = /(^[a-z]+|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([*^]?=)'([^']*)')?\]/gi;
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

const tips = {
  hist: 'Show/Hide Historical Unassigned Devices', shares: 'Show/Hide SMB/NFS/ISO Shares', disks: 'Show/Hide Unassiged Disk Devices',
};
const sw = (k, label) => h('div', { class: 'right ud ud_titleFix' }, [
  h('a', { title: tips[k] }), h('input', { type: 'checkbox', class: { hist: 'historical', shares: 'shares', disks: 'disks' }[k] + '-switch' }),
  h('span', { class: 'switch-button-label on' }, [label]), h('div', { class: 'switch-button-background checked' }, [h('div', { class: 'switch-button-button' })]), h('div'),
]);
// UD's markup on /Main as the live page has it once the tiles have drawn its three parts.
function page() {
  const bar = h('div', { class: 'title ud' }, [
    h('span', { class: 'left' }, ['Unassigned Devices']),
    h('div', { class: 'titleRight rightTitleUD' }, [
      h('div', { class: 'right ud ud_titleFix' }, [h('a', { class: 'info', href: '/Settings/UnassignedDevicesSettings' }, [h('i', { class: 'fa fa-gear' }), h('span', { class: 'help-content' }, ['Unassigned Devices Settings'])])]),
      h('div', { class: 'right ud ud_titleFix' }, [h('a', { class: 'info', onclick: 'rescan_disks()' }, [h('i', { class: 'fa fa-refresh' }), h('span', { class: 'help-content' }, ['Refresh Disks and Configuration'])])]),
      sw('hist', 'Historisch'), sw('shares', 'Freigaben'), sw('disks', 'Datenträger'),
    ]),
  ]);
  const row = h('div', { class: 'cc-dk-udrow' }, [h('div', { class: 'show-disks' }), h('div', { class: 'show-shares' }), h('div', { class: 'show-disks' }, [h('div', { class: 'show-historical' })])]);
  const head = h('div', { class: 'cc-card-head' }, [h('span', { class: 'left' }, ['Unassigned Devices'])]);
  const sec = h('section', { 'data-cc-card': '1', class: 'cc-dk-box', role: 'tabpanel' }, [head, bar, row]);
  const root = h('html', {}, [h('div', { id: 'displaybox' }, [sec])]);
  return { root, sec, head, bar, row, ctrls: bar.querySelectorAll('a.info, .switch-button-background') };
}
function load(lang) {
  const names = /var UD_NAMES = \[[\s\S]*?\n  \];/.exec(shares);
  if (!names) throw new Error('UD_NAMES not found');
  const body = [
    'function el(tag, cls, txt) { var n = new Elem(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }',
    'function ccInfoIcon(tip) { var s = el("span", "cc-info"); s.setAttribute("data-tip", tip); return s; }',
    'function g() { return "1"; } function idealText() { return "#161616"; } function mainAccent() { return "#FCC419"; }',
    names[0],
    ...['ccUdCtrlsMove', 'ccUdCtrlsGather', 'ccUdPanel', 'ccUdPanelDrop', 'ccUdName', 'ccUdLabels', 'ccUdCtrlsHome'].map((n) => grabFn(shares, n)),
    'return { move: ccUdCtrlsMove, home: ccUdCtrlsHome };',
  ].join('\n');
  return (doc) => new Function('Elem', 'document', 'LANG', body)(Elem, doc, lang);
}
const de = load('de'), en = load('en');

console.log('\nIn the tiles the controls are a card of their own');
{
  const P = page(), ud = de(P.root);
  ud.move();
  const panel = P.row.lastElementChild;
  ok('the card ends the row of UD\'s three cards', !!panel && panel.classList.contains('cc-ud-panel') && P.row.elems().length === 4);
  const badge = panel && panel.querySelector(':scope > div.title > span.left > span.cc-b.cc-ud-h');
  ok('under a badge built like theirs, named after the plugin', !!badge && badge.textContent === 'Unassigned Devices', badge && badge.textContent);
  ok('the controls sit in it and not in the section head', !!panel.querySelector(':scope > .cc-ud-ctrls') && !P.head.querySelector('.cc-ud-ctrls'));
  const units = panel.querySelectorAll('.cc-ud-unit');
  ok('one line per control', units.length === 5, units.length);
  const want = ['Unassigned-Devices-Einstellungen', 'Datenträger neu einlesen', 'Historische Geräte anzeigen', 'Freigaben anzeigen', 'Datenträger anzeigen'];
  const got = units.map((u) => { const l = u.firstChild; return l && l.classList.contains('cc-ud-lbl') ? l.firstChild.textContent : null; });
  ok('each line starts with its name, in German on a German page', JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  const infos = units.map((u) => u.querySelector(':scope > .cc-ud-lbl > .cc-info'));
  ok('each name carries an (i) that says what the control does', infos.every((i) => i && /\.$/.test(i.getAttribute('data-tip') || '')), infos.map((i) => i && i.getAttribute('data-tip')).join(' | '));
  ok('and the control comes after it, at the end of the line', units.every((u, k) => u.children.indexOf(u.firstChild) < u.children.indexOf(P.ctrls[k])));
  ok('they are UD\'s own gear, refresh and switch nodes, moved and not copied, so its handlers answer', P.ctrls.every((c, k) => c.closest('.cc-ud-unit') === units[k]) && !P.bar.querySelector('a, .switch-button-background'));
  ok('gear and refresh are icon buttons like CC\'s others', P.ctrls.slice(0, 2).every((a) => a.classList.contains('cc-ud-icon')) && !P.ctrls.slice(2).some((t) => t.closest('a.cc-ud-icon')));
  ud.move(); ud.move();
  ok('a later pass leaves one card with five names', P.root.querySelectorAll('.cc-ud-panel').length === 1 && panel.querySelectorAll('.cc-ud-lbl').length === 5);
  P.row.appendChild(h('div', { class: 'show-shares' }));
  ud.move();
  ok('and puts the card back at the end when a part lands after it', P.row.lastElementChild === panel);
}

console.log('\nOn an English page the names are English');
{
  const P = page(), ud = en(P.root);
  ud.move();
  const got = P.root.querySelectorAll('.cc-ud-lbl').map((l) => l.firstChild.textContent);
  ok('each control is named as its UD tooltip says', JSON.stringify(got) === JSON.stringify(['Unassigned Devices settings', 'Refresh disks', 'Show historical devices', 'Show shares', 'Show disks']), JSON.stringify(got));
  const unknown = page();
  unknown.bar.querySelector('input.shares-switch').setAttribute('class', 'iso-switch');
  en(unknown.root).move();
  ok('a switch a later UD build adds is named by its own tooltip', (unknown.root.querySelectorAll('.cc-ud-lbl')[3] || {}).textContent === tips.shares);
}

console.log('\nIn the list the controls go back to the section head');
{
  const P = page(), ud = de(P.root);
  ud.move();
  P.sec.classList.remove('cc-dk-box');
  ud.move();
  ok('the cluster stands in the head again', !!P.head.querySelector(':scope > .cc-ud-ctrls'));
  ok('without names or card', P.root.querySelectorAll('.cc-ud-lbl, .cc-ud-unit, .cc-ud-panel').length === 0);
  P.sec.classList.add('cc-dk-box');
  ud.move();
  ok('and back in the tiles they get their card again', P.row.lastElementChild.classList.contains('cc-ud-panel') && P.root.querySelectorAll('.cc-ud-lbl').length === 5);
  ud.home();
  ok('sending them home gives UD its bar back as it was', P.bar.querySelectorAll('div.right.ud').length === 5 && !P.bar.hasAttribute('data-cc-ud-moved') && P.root.querySelectorAll('.cc-ud-lbl, .cc-ud-unit, .cc-ud-panel, .cc-ud-ctrls').length === 0);
}

console.log('\nThe card is laid out like a settings card');
{
  const disks = rules(read('sheets/TowerTorch.Disks.css'));
  const find = (re, media) => disks.find((r) => re.test(r.sel) && (media ? re.test(r.sel) && media.test(r.media) : !r.media));
  const unit = find(/\.cc-ud-panel \.cc-ud-unit$/);
  const lbl = find(/\.cc-ud-panel \.cc-ud-lbl$/);
  ok('a line is one row', !!unit && /display: flex !important; flex-direction: row; align-items: center;/.test(unit.body), unit && unit.body);
  ok('its name takes the start and pushes the control to the end', !!lbl && /flex: 1 1 auto/.test(lbl.body) && /margin-right: \d+px/.test(lbl.body), lbl && lbl.body);
  const card = find(/\.cc-dk-udrow > \.cc-ud-panel$/);
  ok('the card is as wide as its lines beside the other three', !!card && /flex: none/.test(card.body));
  const phone = disks.find((r) => /\.cc-dk-udrow > \.cc-ud-panel/.test(r.sel) && /max-width: 600px/.test(r.media));
  ok('and on a phone as wide as the screen, like them', !!phone && /flex: 1 1 100%/.test(phone.body));
  const fill = rules(read('sheets/TowerTorch.Shares.css')).find((r) => r.sel.split(',').some((s) => /#displaybox \.cc-ud-panel > div\.title$/.test(s.trim())));
  ok('its badge line has no fill, like the badge lines of UD\'s parts', !!fill && /background: none !important/.test(fill.body));
}

console.log('\nNo badge line keeps room for the controls');
{
  const css = read('sheets/TowerTorch.Disks.css');
  ok('shares.js measures nothing', !/ResizeObserver|--cc-ud-ctrls-w|ccUdCtrlsMeasure/.test(shares));
  ok('no badge line keeps their width free', !/--cc-ud-ctrls-w/.test(css) && !rules(css).some((r) => /\.cc-dk-udrow.*div\.title/.test(r.sel) && /padding-right/.test(r.body)));
  const head = rules(css).find((r) => /section\.cc-dk-box:has\(> \.cc-dk-udrow\) > \.cc-card-head$/.test(r.sel) && !r.media);
  ok('the section head that held them goes, so nothing lies over the cards', !!head && /^display: none;?$/.test(head.body), head && head.body);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
