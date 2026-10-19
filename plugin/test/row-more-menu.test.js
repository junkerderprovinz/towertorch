// A row's More opens a menu instead of unfolding more buttons in place (GlimStone, "Page actions"
// and rule 26). The menu is CCTheme.menu, shared by the Docker and VM rows: each item a glyph and
// its words, operable from the keyboard, closed by Escape, Tab, a press outside or a scroll of
// the page, with the focus back on More. What can quietly break it:
//   · focus left in the removed menu, so a keyboard user is dropped at the top of the page
//   · a scroll inside a long menu taken for a page scroll, closing it under the pointer
//   · two menus open at once, or a second press on More that opens a fresh one
//   · a delete item landing on the rainbow's red slot
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(src, name) {
  const m = new RegExp('\\n  var ' + name + ' = [^\\n]*').exec(src);
  if (!m) throw new Error('var not found: ' + name);
  return m[0];
}
function grabBlock(src, start, end) {
  const i = src.indexOf(start), j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('block not found: ' + start);
  return src.slice(i, j + end.length);
}

class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); } contains(c) { return this.s.has(c); }
}
let active = null;
class N {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentNode = null; this.classList = new CL();
    this.attrs = {}; this.listeners = {}; this.styleProps = {}; this._text = ''; this.innerHTML = ''; this.rect = { left: 600, right: 626, top: 300, bottom: 326 };
    const self = this;
    this.style = { setProperty: (k, v) => { self.styleProps[k] = String(v); }, removeProperty: (k) => { delete self.styleProps[k]; } };
  }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.childNodes.length ? this.childNodes.map((c) => c.textContent).join('') : this._text; }
  set textContent(v) { this._text = String(v); this.childNodes = []; }
  get offsetWidth() { return 200; } get offsetHeight() { return 120; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(type, init) {
    const ev = Object.assign({ type, target: this, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } }, init || {});
    for (let n = this; n && !ev.stopped; n = n.parentNode) (n.listeners[type] || []).slice().forEach((fn) => fn(ev));
    return ev;
  }
  click() { this.fire('click'); }
  focus() { active = this; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  getBoundingClientRect() { return this.rect; }
}
const html = new N('html');
html.clientWidth = 1000; html.clientHeight = 700;
const body = html.appendChild(new N('body'));
const docL = {}, winL = {};
global.document = {
  body, documentElement: html,
  createElement: (t) => new N(t),
  get activeElement() { return active || body; },
  addEventListener: (t, fn) => { (docL[t] = docL[t] || []).push(fn); },
  removeEventListener: (t, fn) => { docL[t] = (docL[t] || []).filter((x) => x !== fn); },
};
global.window = {
  innerWidth: 1000, innerHeight: 700,
  addEventListener: (t, fn) => { (winL[t] = winL[t] || []).push(fn); },
  removeEventListener: (t, fn) => { winL[t] = (winL[t] || []).filter((x) => x !== fn); },
};
const pointerdown = (target) => (docL.pointerdown || []).slice().forEach((fn) => fn({ target }));
const scroll = (target) => (winL.scroll || []).slice().forEach((fn) => fn({ target }));
const key = (k) => active.fire('keydown', { key: k });

const store = {};
const theme = read('scripts/cc-theme.js');
const CCTheme = new Function('localStorage',
  'function g(k, d) { return k in localStorage ? localStorage[k] : d; } function s(k, v) { localStorage[k] = v; }' +
  grabVar(theme, 'RB') + grabVar(theme, 'LUM_FLOOR') + grabVar(theme, 'rowMenu') + '\n' + grabBlock(theme, 'var GLYPHS = {', '\n  };') + '\n' +
  ['idealText', 'rbSeed', 'palette', 'lumOf', 'liftLight', 'lightTheme', 'surfacePalette', 'isRed', 'deleteSlot', 'glyph', 'edge', 'placeAt', 'menu'].map((n) => grabFn(theme, n)).join('\n') +
  '; return { RB: RB, isRed: isRed, glyph: glyph, menu: menu };')(store);

function anchor() { const a = body.appendChild(new N('span')); a.className = 'cc-actbtn'; return a; }
function items(log) {
  return [
    { glyph: 'Code', label: 'Console', run: () => log.push('console') },
    { glyph: 'Trash', label: 'Remove', del: true, run: () => log.push('remove') },
    { glyph: 'ExternalLink', label: 'Project page', run: () => log.push('project') },
  ];
}
const menuEl = () => body.childNodes.find((n) => n.classList.contains('cc-rowmenu'));
const its = () => menuEl().childNodes;

console.log('\nThe menu and its items');
{
  const a = anchor(), log = [];
  a.focus();
  CCTheme.menu(a, items(log));
  const m = menuEl();
  ok('a menu opens on the page', !!m && m.getAttribute('role') === 'menu');
  ok('one item per action, each a menuitem', its().length === 3 && its().every((n) => n.getAttribute('role') === 'menuitem'));
  ok('an item carries its glyph from the set and its words', its()[1].innerHTML === CCTheme.glyph('Trash') && its()[1].textContent === 'Remove', its()[1].innerHTML.slice(0, 40));
  ok('the glyph is GlimStone\'s filled drawing, sized by the item\'s text', /^<svg class="cc-glyph" viewBox="0 0 14 14" fill="currentColor"/.test(its()[1].innerHTML));
  ok('More says it has a menu and that it is open', a.getAttribute('aria-haspopup') === 'menu' && a.getAttribute('aria-expanded') === 'true');
  ok('the focus moves to the first item', active === its()[0]);
  ok('it stands under More, flush with its right edge', m.style.left === '426px' && m.style.top === '332px', m.style.left + ' ' + m.style.top);
  {
    const edgeAt = (w, rect) => {
      const b = anchor(); b.rect = rect; html.clientWidth = w; window.innerWidth = w;
      CCTheme.menu(b, items([])); const mm = menuEl(); const st = { left: mm.style.left, top: mm.style.top };
      CCTheme.menu(b, items([]));   // a second press closes it
      body.removeChild(b); return st;
    };
    const right = edgeAt(1000, { left: 974, right: 1000, top: 300, bottom: 326 });
    ok('from the right-most column it keeps 16px off the viewport edge', right.left === '784px', right.left);
    const wide = edgeAt(1600, { left: 1574, right: 1600, top: 300, bottom: 326 });
    ok('on a wide screen it keeps 24px', wide.left === '1376px', wide.left);
    const low = edgeAt(1000, { left: 600, right: 626, top: 660, bottom: 686 });
    ok('near the bottom it opens upward and stays off the bottom edge', low.top === (660 - 6 - 120) + 'px', low.top);
    html.clientWidth = 1000; window.innerWidth = 1000;
    a.focus(); CCTheme.menu(a, items(log));
  }

  key('ArrowDown'); ok('ArrowDown moves to the next item', active === its()[1]);
  key('End'); ok('End jumps to the last', active === its()[2]);
  key('ArrowDown'); ok('ArrowDown on the last wraps to the first', active === its()[0]);
  key('ArrowUp'); ok('ArrowUp on the first wraps to the last', active === its()[2]);
  key('Home'); ok('Home jumps to the first', active === its()[0]);
  key('ArrowDown'); key('Enter');
  ok('Enter runs the focused item', log.join() === 'remove', log.join());
  ok('and closes the menu', !menuEl());
  ok('with the focus back on More', active === a);
  ok('which says the menu is closed', a.getAttribute('aria-expanded') === 'false');
  ok('no listener is left behind on the page', !(docL.pointerdown || []).length && !(winL.scroll || []).length && !(winL.resize || []).length);
}

console.log('\nThe ways out');
{
  const a = anchor(), log = [];
  CCTheme.menu(a, items(log)); key('Escape');
  ok('Escape closes it and puts the focus back on More', !menuEl() && active === a);
  CCTheme.menu(a, items(log)); key('Tab');
  ok('Tab closes it from More, so the Tab moves on from there', !menuEl() && active === a);
  CCTheme.menu(a, items(log));
  ok('a second press on More closes it rather than opening another', CCTheme.menu(a, items(log)) === null && !menuEl());
  CCTheme.menu(a, items(log)); const b = anchor(); CCTheme.menu(b, items(log));
  ok('opening another row\'s menu closes the first, so one stands at a time', body.childNodes.filter((n) => n.classList.contains('cc-rowmenu')).length === 1 && a.getAttribute('aria-expanded') === 'false');
  pointerdown(its()[0]);
  ok('a press inside the menu leaves it open', !!menuEl());
  pointerdown(b);
  ok('a press on its own More leaves the closing to the click', !!menuEl());
  const elsewhere = body.appendChild(new N('div')); active = elsewhere;
  pointerdown(elsewhere);
  ok('a press anywhere else closes it without taking the focus', !menuEl() && active === elsewhere);
  CCTheme.menu(b, items(log)); scroll(its()[0]);
  ok('a scroll inside the menu leaves it open', !!menuEl());
  scroll(body);
  ok('a scroll of the page closes it, since it would drift from its row', !menuEl());
  CCTheme.menu(b, items(log)); (winL.resize || []).slice().forEach((fn) => fn({}));
  ok('so does a resize', !menuEl());
  ok('none of them ran an action', log.length === 0);
}

console.log('\nColour modes');
{
  const a = anchor();
  CCTheme.menu(a, items([]));
  ok('with the accent no item is stamped, the sheet\'s accent chain applies', its().every((n) => !('--cc-rb-c' in n.styleProps)));
  CCTheme.menu(a, items([]));
  Object.assign(store, { 'cc.rainbow': '1', 'cc.rainbowrot': '0' });
  // Seven ordinary items push the delete onto slot 8, which wraps round to the red slot 0.
  const many = Array.from({ length: 8 }, (_, i) => ({ glyph: 'Info', label: 'Item ' + i, run() {} }));
  many.push({ glyph: 'Trash', label: 'Remove', del: true, run() {} });
  CCTheme.menu(a, many);
  ok('under the rainbow each item takes its own slot', its()[1].styleProps['--cc-rb-c'] === CCTheme.RB[1] && its()[7].styleProps['--cc-rb-c'] === CCTheme.RB[7]);
  ok('with its ink beside it', its()[1].styleProps['--cc-rb-ct'] === '#161616');
  const del = its()[8].styleProps['--cc-rb-c'];
  ok('a delete that comes round to red takes the next slot instead', !!del && !CCTheme.isRed(del) && del === CCTheme.RB[1], del);
  CCTheme.menu(a, many);
  store['cc.flagmode'] = '1'; store['cc.flagpal'] = JSON.stringify(['#ED2939', '#FFFFFF', '#ED2939']);
  CCTheme.menu(a, many);
  ok('in flag mode a delete leaves the flag\'s red for its next colour', its()[8].styleProps['--cc-rb-c'] === '#FFFFFF', its()[8].styleProps['--cc-rb-c']);
  CCTheme.menu(a, many);
}

console.log('\nThe sheet and the rows');
{
  const tokens = read('sheets/TowerTorch.Tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('the menu stays dark on a light theme, in the window token island', /\n\.cc-pop, \.cc-menu, \.cc-win, \.cc-rowmenu[, ]/.test(tokens));
  ok('an item takes the mode colour under the pointer and the keyboard focus',
    /\.cc-rowmenu-it:is\(:hover, :focus-visible\) \{\s*background: var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent, #FCC419\)\)\);\s*color: var\(--cc-rb-ct, var\(--cc-rbaccent-text, var\(--cc-accent-text, #161616\)\)\);/.test(tokens));
  const docker = read('scripts/docker.js'), vms = read('scripts/vms.js');
  for (const [name, src] of [['docker.js', docker], ['vms.js', vms]]) {
    ok(name + ': More opens the shared menu', /actBtn\("More", [^\n]*(\n[^\n]*){0,6}window\.CCTheme\.menu\(moreBtn, extras\)/.test(src));
    ok(name + ': no extra block of buttons unfolds in the row', src.indexOf('cc-actmore') < 0 && src.indexOf('cc-acttoggle') < 0);
  }
  ok('docker.js: Remove is a button of the row, which takes the delete slot', /actBtn\("Trash", rmLabel, function \(\) \{ window\.rmContainer\(/.test(docker) && /rm\.classList\.add\("cc-act-del"\)/.test(docker));
  ok('vms.js: both removes are delete items of the menu', (vms.match(/del: true, run: function \(\) \{ vmRemove\(uuid, name, (true|false)\); \}/g) || []).length === 2);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
