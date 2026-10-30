// Every TowerTorch window is one kind of window (GlimStone rule 15): a title badge, a
// lighter content card, a close badge in the top right corner, a button row at the bottom with the
// forward action on the right, and the page darkened and blurred behind it. It is modal:
// focus moves in, Tab stays inside, Escape and the scrim dismiss it, and focus returns to the
// control that opened it. A question is asked in such a window rather than with
// window.prompt or window.confirm, its title says what happens, and a deleting answer looks
// like the Cancel beside it rather than red.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
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

// A DOM small enough to read: compound selectors only (tag, .class, [attr], [attr="v"],
// :not(...)), plus lists, which is all the window code asks for.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); } contains(c) { return this.s.has(c); }
  toggle(c, f) { const w = f === undefined ? !this.s.has(c) : !!f; w ? this.s.add(c) : this.s.delete(c); return w; }
}
let active = null;
class N {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentNode = null; this.classList = new CL();
    this.attrs = {}; this.listeners = {}; this.styleProps = {}; this._text = ''; this.value = ''; this.type = '';
    const self = this;
    this.style = { setProperty: (k, v) => { self.styleProps[k] = String(v); }, removeProperty: (k) => { delete self.styleProps[k]; } };
  }
  get children() { return this.childNodes; }
  get className() { return [...this.classList.s].join(' '); }
  set className(v) { this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.childNodes.length ? this.childNodes.map((c) => c.textContent).join('') : this._text; }
  set textContent(v) { this._text = String(v); this.childNodes = []; }
  get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = String(v); }
  set placeholder(v) { this.attrs.placeholder = v; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); const i = this.childNodes.indexOf(ref); c.parentNode = this; this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== fn); }
  fire(type, init) {
    const ev = Object.assign({ type, target: this, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } }, init || {});
    for (let n = this; n && !ev.stopped; n = n.parentNode) { ev.currentTarget = n; (n.listeners[type] || []).slice().forEach((fn) => fn(ev)); }
    return ev;
  }
  click() { this.fire('click'); }
  focus() { active = this; }
  select() {}
  getClientRects() { return [1]; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  closest(sel) { for (let n = this; n && n.tagName; n = n.parentNode) if (matches(n, sel)) return n; return null; }
  querySelectorAll(sel) { const out = []; const walk = (n) => n.childNodes.forEach((c) => { if (matches(c, sel)) out.push(c); walk(c); }); walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function matches(n, sel) { return sel.split(/,(?![^(]*\))/).some((s) => matchOne(n, s.trim())); }
function matchOne(n, s) {
  const re = /^([a-z]+)|\.([-\w]+)|\[([-\w]+)(?:="([^"]*)")?\]|:not\(([^)]*\)?)\)/gy;
  let m, i = 0;
  while (i < s.length) {
    re.lastIndex = i; m = re.exec(s); if (!m) throw new Error('selector the shim cannot read: ' + s);
    if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !n.classList.contains(m[2])) return false;
    if (m[3]) { const v = m[3] === 'type' ? n.type : n.getAttribute(m[3]); if (v == null || v === '' && m[4] === undefined && m[3] === 'type') return false; if (m[4] !== undefined && v !== m[4]) return false; }
    if (m[5] && matchOne(n, m[5])) return false;
    i = re.lastIndex;
  }
  return true;
}
const html = new N('html');
const body = html.appendChild(new N('body'));
const docListeners = {};
global.document = {
  body, documentElement: html,
  createElement: (t) => new N(t),
  get activeElement() { return active || body; },
  contains: (n) => html.contains(n),
  querySelector: (s) => html.querySelector(s),
  addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener: (t, fn) => { docListeners[t] = (docListeners[t] || []).filter((x) => x !== fn); },
};
global.getComputedStyle = (n) => ({ zIndex: n.classList.contains('cc-dlg') ? '1000001' : n.classList.contains('cc-win') ? '99999' : 'auto' });
function key(k, shift) {
  const ev = { key: k, shiftKey: !!shift, target: document.activeElement, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
  (docListeners.keydown || []).slice().forEach((fn) => fn(ev));
  if (!ev.defaultPrevented && ev.target.fire) ev.target.fire('keydown', { key: k, shiftKey: !!shift });
  return ev;
}
const store = {};

const theme = read('scripts/cc-theme.js');
const CCTheme = new Function('localStorage',
  'function g(k, d) { return k in localStorage ? localStorage[k] : d; } function s(k, v) { localStorage[k] = v; }' +
  grabVar(theme, 'RB') + grabVar(theme, 'LUM_FLOOR') + grabVar(theme, 'winStack') + grabVar(theme, 'FOCUSABLE') +
  'function glyph(name) { return "<svg>" + name + "</svg>"; }' +
  ['idealText', 'rbSeed', 'palette', 'lumOf', 'liftLight', 'lightTheme', 'surfacePalette', 'isRed', 'deleteSlot', 'shake',
    'pressable', 'labelled', 'labelTip', 'refind', 'focusables', 'onWinKey', 'german', 'closeBadge', 'modal', 'paintWin', 'ask'].map((n) => grabFn(theme, n)).join('\n') +
  '; return { RB: RB, isRed: isRed, modal: modal, ask: ask, paintWin: paintWin, pressable: pressable };')(store);

function win(cls) {
  const w = body.appendChild(new N('div')); w.className = cls || 'cc-win';
  const t = w.appendChild(new N('div')); t.className = 'cc-win-title'; t.textContent = 'Titel';
  const info = t.parentNode.appendChild(new N('span')); info.className = 'cc-info'; info.setAttribute('tabindex', '0');
  const card = w.appendChild(new N('div')); card.className = 'cc-win-card';
  const a = card.appendChild(new N('input')); a.type = 'text';
  const b = card.appendChild(new N('input')); b.type = 'text';
  const act = w.appendChild(new N('div')); act.className = 'cc-win-act';
  const c = CCTheme.pressable(act.appendChild(new N('span'))); c.className = 'cc-win-btn';
  return { w, info, a, b, c };
}

console.log('\nThe modal: scrim, focus, Tab and Escape');
{
  const opener = body.appendChild(new N('span')); opener.setAttribute('tabindex', '0'); opener.focus();
  const { w, info, a, b, c } = win();
  let dismissed = 0;
  const h = CCTheme.modal(w, { onDismiss: () => { dismissed++; h.close(); } });
  const scrim = w.parentNode.childNodes[w.parentNode.childNodes.indexOf(w) - 1];
  ok('a scrim goes in right before the window', scrim && scrim.classList.contains('cc-scrim'));
  ok('one step under the window\'s z-index', scrim.style.zIndex === '99998', scrim.style.zIndex);
  ok('the window says it is a modal dialog', w.getAttribute('role') === 'dialog' && w.getAttribute('aria-modal') === 'true');
  ok('named by its title badge', w.getAttribute('aria-labelledby') === w.querySelector('.cc-win-title').id && !!w.getAttribute('aria-labelledby'));
  ok('focus moves to the first field in the card, past the (i)', document.activeElement === a);
  const x = w.querySelector('.cc-win-x');
  ok('the modal puts a close badge into the window', !!x && x.parentNode === w);
  ok('named "Close" for a screen reader and in its bubble', x.getAttribute('aria-label') === 'Close' && x.getAttribute('data-tip') === 'Close');
  ok('it answers the keyboard like a button', x.getAttribute('role') === 'button' && x.getAttribute('tabindex') === '0');
  ok('it carries the close glyph', /Close/.test(x.innerHTML));
  x.focus(); key('Tab');
  ok('Tab on the last control, the close badge, wraps to the first', document.activeElement === info, document.activeElement.className);
  info.focus(); key('Tab', true);
  ok('Shift+Tab on the first wraps to the close badge', document.activeElement === x);
  opener.focus(); key('Tab');
  ok('Tab from outside comes back in', w.contains(document.activeElement));
  b.focus(); key('Escape');
  ok('Escape dismisses through onDismiss', dismissed === 1);
  ok('closing takes the scrim and the window away', !scrim.parentNode && !w.parentNode);
  ok('and gives focus back to the opener', document.activeElement === opener);
  ok('with no window open the keyboard listener is gone', !(docListeners.keydown || []).length);
}
{
  const { w } = win();
  let n = 0;
  const h = CCTheme.modal(w, { onDismiss: () => { n++; h.close(); } });
  const scrim = body.querySelector('.cc-scrim');
  scrim.click();
  ok('a click on the scrim dismisses the window', n === 1 && !w.parentNode);
}
{
  const { w } = win();
  let n = 0;
  const h = CCTheme.modal(w, { onDismiss: () => { n++; h.close(); } });
  w.querySelector('.cc-win-x').click();
  ok('the close badge dismisses through onDismiss, so unsaved work is still asked about', n === 1 && !w.parentNode);
  const plain = win();
  CCTheme.modal(plain.w);
  plain.w.querySelector('.cc-win-x').click();
  ok('without onDismiss it closes the window outright', !plain.w.parentNode);
}
{
  const w = body.appendChild(new N('div')); w.className = 'cc-win';
  const act = w.appendChild(new N('div')); act.className = 'cc-win-act';
  const go = CCTheme.pressable(act.appendChild(new N('span'))); go.className = 'cc-win-btn';
  const h = CCTheme.modal(w);
  ok('a window with nothing else to focus starts on its action, not on the close badge', document.activeElement === go);
  h.close();
}
{
  const outer = win();
  const h1 = CCTheme.modal(outer.w);
  const inner = win('cc-win cc-dlg');
  const h2 = CCTheme.modal(inner.w, { opener: outer.b });
  key('Escape');
  ok('Escape closes the window on top first', !inner.w.parentNode && !!outer.w.parentNode);
  ok('and focus returns into the window below', document.activeElement === outer.b);
  key('Escape');
  ok('a second Escape closes the one below', !outer.w.parentNode);
  void h1; void h2;
}

console.log('\nAn opener drawn again while its window is open');
{
  const old = body.appendChild(new N('button')); old.setAttribute('data-cc-focus-key', 'cc-hgear-grid'); old.focus();
  CCTheme.ask({ title: 'Neuen Ordner anlegen', input: { label: 'Name des Ordners' }, ok: 'Anlegen', cancel: 'Abbrechen', onOk: () => {} });
  old.remove();
  const fresh = body.appendChild(new N('button')); fresh.setAttribute('data-cc-focus-key', 'cc-hgear-grid');
  key('Escape');
  ok('the focus goes to the one drawn in its place, found by its key', document.activeElement === fresh);
  const gone = body.appendChild(new N('span')); gone.setAttribute('tabindex', '0'); gone.focus();
  CCTheme.ask({ title: 'Frage', ok: 'Ja', cancel: 'Nein', onOk: () => {} });
  gone.remove();
  key('Escape');
  ok('an opener without a key that is gone takes the focus nowhere', document.activeElement !== gone);
  fresh.remove();
}


console.log('\nA question in a window');
{
  let got = null;
  const opener = body.appendChild(new N('span')); opener.setAttribute('tabindex', '0'); opener.focus();
  CCTheme.ask({ title: 'Neuen Ordner anlegen', input: { label: 'Name des Ordners' }, ok: 'Anlegen', cancel: 'Abbrechen', onOk: (v) => { got = v; } });
  const w = body.querySelector('.cc-dlg');
  ok('it opens as a .cc-dlg window', !!w);
  ok('the title badge says what happens', w.querySelector('.cc-win-title').textContent === 'Neuen Ordner anlegen');
  const btns = w.querySelectorAll('.cc-win-btn');
  ok('Cancel on the left, the answer on the right', btns[0].textContent === 'Abbrechen' && btns[1].textContent === 'Anlegen');
  ok('a creating answer is the window\'s one filled button', btns[1].classList.contains('cc-win-go'));
  const input = w.querySelector('.cc-win-in');
  ok('the name field has the focus', document.activeElement === input);
  input.value = '   '; input.fire('keydown', { key: 'Enter' });
  ok('an empty name does not close the window', !!w.parentNode && got === null);
  input.value = '  Medien  '; input.fire('keydown', { key: 'Enter' });
  ok('Enter takes the name, trimmed', got === 'Medien');
  ok('and closes the window with its scrim', !w.parentNode && !body.querySelector('.cc-scrim'));
  ok('focus goes back to the opener', document.activeElement === opener);
}
{
  let ran = 0;
  CCTheme.ask({ title: 'Ordner „Medien“ löschen?', text: 'Der Ordner ist leer.', ok: 'Löschen', cancel: 'Abbrechen', danger: true, onOk: () => { ran++; } });
  const w = body.querySelector('.cc-dlg');
  const btns = w.querySelectorAll('.cc-win-btn');
  ok('a deleting answer is not the filled button', btns[1].classList.contains('cc-win-del') && !btns[1].classList.contains('cc-win-go'));
  ok('the focus starts on Cancel, the safe choice', document.activeElement === btns[0]);
  btns[0].fire('keydown', { key: 'Enter' });
  ok('Enter on Cancel cancels', ran === 0 && !w.parentNode);
}
{
  let ran = 0;
  CCTheme.ask({ title: '3 Container entfernen?', text: 'a, b, c', ok: 'Entfernen', cancel: 'Abbrechen', danger: true, onOk: () => { ran++; } });
  key('Escape');
  ok('Escape cancels without running the answer', ran === 0 && !body.querySelector('.cc-dlg'));
  CCTheme.ask({ title: '3 Container entfernen?', text: 'a, b, c', ok: 'Entfernen', cancel: 'Abbrechen', danger: true, onOk: () => { ran++; } });
  body.querySelector('.cc-dlg').querySelectorAll('.cc-win-btn')[1].click();
  ok('the answer button runs it', ran === 1);
}

console.log('\nThe colours of a window');
{
  const mk = (del) => { const w = new N('div'); w.className = 'cc-win'; const t = w.appendChild(new N('div')); t.className = 'cc-win-title'; ['a', 'b'].forEach((x, i) => { const b = w.appendChild(new N('span')); b.className = 'cc-win-btn' + (i === 1 && del ? ' cc-win-del' : ''); }); return w; };
  Object.assign(store, { 'cc.rainbow': '1', 'cc.rainbowrot': '0', 'cc.rbpal': JSON.stringify(['#3DDBD9', '#1D99F3', '#FF8389', '#6FDC8C']) });
  let w = mk(false); CCTheme.paintWin(w);
  const c = w.querySelectorAll('.cc-win-title, .cc-win-btn').map((e) => e.styleProps['--cc-rb-c']);
  ok('title first, then each button, one slot after another', c.join() === '#3DDBD9,#1D99F3,#FF8389', c.join());
  ok('each with its own ink', w.querySelector('.cc-win-title').styleProps['--cc-rb-ct'] === '#161616');
  w = mk(true); CCTheme.paintWin(w);
  const del = w.querySelectorAll('.cc-win-btn')[1].styleProps['--cc-rb-c'];
  ok('in rainbow a deleting answer keeps off the red slot', !CCTheme.isRed(del), del);
  store['cc.flagmode'] = '1'; store['cc.flagpal'] = JSON.stringify(['#ED2939', '#FFFFFF', '#ED2939']);
  w = mk(true); CCTheme.paintWin(w);
  ok('a flag\'s red passes to its next colour for a deleting answer too', w.querySelectorAll('.cc-win-btn')[1].styleProps['--cc-rb-c'] === '#FFFFFF', w.querySelectorAll('.cc-win-btn')[1].styleProps['--cc-rb-c']);
  delete store['cc.flagmode'];
  store['cc.rbmode'] = 'active'; w = mk(false); CCTheme.paintWin(w);
  ok('the reactive mode marks the window, so its main button rests grey', w.classList.contains('cc-win-reactive'));
  store['cc.rainbow'] = '0'; store['cc.rbmode'] = 'all'; w = mk(false); CCTheme.paintWin(w);
  ok('outside the rainbow nothing is stamped and the accent chain applies', !w.querySelector('.cc-win-title').styleProps['--cc-rb-c'] && !w.classList.contains('cc-win-reactive'));
}

console.log('\nThe sheet');
{
  const el = (classes) => ({ tag: 'span', classes, attrs: { class: classes.join(' ') }, states: {}, outside: ['.sweet-alert'] });   // a CC window, which the confirmation styles in Header.css do not reach
  const top = (classes, prop, states) => { const e = el(classes); if (states) e.states = states; const c = candidates('every', e, prop); return c[c.length - 1]; };
  const scrimBg = top(['cc-scrim'], 'background'), scrimBlur = top(['cc-scrim'], 'backdrop-filter');
  ok('the scrim darkens with the shared token', scrimBg && /var\(--cc-backdrop-dim\)/.test(scrimBg.value));
  ok('and blurs with it', scrimBlur && /var\(--cc-backdrop-blur\)/.test(scrimBlur.value));
  const cancel = top(['cc-win-btn'], 'background'), del = top(['cc-win-btn', 'cc-win-del'], 'background');
  ok('a deleting answer rests in the colour of Cancel', cancel && del && cancel.value === del.value, del && del.value);
  const delHover = top(['cc-win-btn', 'cc-win-del'], 'background', { hover: true }), cancelHover = top(['cc-win-btn'], 'background', { hover: true });
  ok('and hovers like it', delHover && cancelHover && delHover.value === cancelHover.value);
  ok('no rule paints it in the fault colour', !/--cc-err|#ff8389|#da1e28/i.test(del.value + delHover.value));
  const tokens = read('sheets/TowerTorch.Tokens.css');
  ok('the windows stay dark on a light theme, in the token island', /\n\.cc-pop, \.cc-menu, \.cc-win, \.cc-rowmenu[, ]/.test(tokens));
  const title = top(['cc-win-title'], 'background');
  ok('the title badge is filled with the colour chain', title && /var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(title.value));
  const frame = top(['cc-win'], 'background'), card = top(['cc-win-card'], 'background');
  ok('a dark frame', frame && frame.value === '#1a1a1a');
  ok('its content sits straight on it, with no lighter card', !card, card && card.value);
  const docker = read('styles/docker.css');
  ok('the editor windows share the frame', /\.cc-pop \{[^}]*background: #1a1a1a/.test(docker));
  ok('and its one surface, with no lighter card behind the content', /\.cc-pop-mid \{/.test(docker) && !/\.cc-pop-mid \{[^}]*(background|box-shadow)/.test(docker));
  ok('no rule draws a typed close in the corner any more', !/\.cc-pop-x/.test(docker + tokens));
  const xv = (prop, states) => { const r = top(['cc-win-x'], prop, states); return r && r.value; };
  ok('the close badge notches into the top right corner', xv('position') === 'absolute' && xv('top') === '0' && xv('right') === '16px' && xv('transform') === 'translateY(-50%)');
  ok('it is a square icon badge of the one icon-badge size', /var\(--cc-icon-badge/.test(xv('width')) && /var\(--cc-icon-badge/.test(xv('height')));
  const onDocker = candidates('docker', { tag: 'span', classes: ['cc-win-x'], attrs: { class: 'cc-win-x', 'data-tip': 'Schließen' }, states: {}, inside: ['.cc-pop'] }, 'position').pop();
  ok('on the Docker page the bubble anchors\' position:relative leaves it in the corner', onDocker && onDocker.value === 'absolute', onDocker && onDocker.selector);
  ok('it follows the shape engine', xv('border-radius') === 'var(--cc-radius-pill)');
  ok('it rests on the field grey and hovers in the colour chain', /--cc-surface-3/.test(xv('background')) && /var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent/.test(xv('background', { hover: true })));
  ok('the title badge leaves it room', top(['cc-win-title'], 'max-width').value === 'calc(100% - 74px)' && /\.cc-pop-head \{[^}]*max-width: calc\(100% - 74px\)/.test(docker));
}

console.log('\nThe windows that use it');
{
  const docker = read('scripts/docker.js'), vms = read('scripts/vms.js'), settings = read('scripts/settings.js'), plugins = read('scripts/plugins.js'), header = read('scripts/header.js');
  const all = { 'docker.js': docker, 'vms.js': vms, 'settings.js': settings, 'plugins.js': plugins, 'header.js': header };
  for (const [f, src] of Object.entries(all)) {
    ok(f + ': no window.prompt or window.confirm', !/\b(window\.)?(prompt|confirm)\(/.test(src.replace(/\/\/[^\n]*/g, '')));
    ok(f + ': no generic "Sicher?" or "Are you sure?" title', !/"Sicher\?"|"Are you sure\?"/.test(src));
    ok(f + ': no SweetAlert of its own', !/\bswal\(/.test(src));
  }
  for (const fn of ['openEditor', 'openBandwidth', 'openLimits']) {
    const body = grabFn(docker, fn);
    ok(fn + ': a title badge naming the container', /el\("span", "cc-win-title cc-pop-ttl", .*?\+ ": " \+ name\)/.test(body));
    ok(fn + ': no Close in the button row, the close badge stands in the corner', !/popCloseBtn|t\("close"\)/.test(body));
    ok(fn + ': no typed corner ✕', !/✕/.test(body));
  }
  ok('the Startplan keeps its own Save', /bSave = ccLabelled\(el\("span", "cc-btn cc-btn-primary"\), "Save", t\("saveShort"\)\)/.test(grabFn(docker, 'openEditor')));
  const place = grabFn(docker, 'placePop'), close = grabFn(docker, 'closePop');
  ok('placePop makes every editor modal, focus returning to its badge', /CCTheme\.modal\(pop, \{ opener: anchor, onDismiss: dismissPop \}\)/.test(place));
  ok('closePop, the funnel of every dismiss, closes the modal', /popModal = null; m\.close\(\)/.test(close));
  ok('the painter covers the title badge and the close badge', /var POP_PAINT_SEL = "[^"]*\.cc-pop-ttl, \.cc-win-x"/.test(docker) && !/cc-pop-x/.test(docker));
  ok('placePop paints again once the modal has added the close badge', /CCTheme\.modal\(pop, [^\n]*\n\s*paintPopChrome\(pop\);/.test(place));
  ok('the window buttons answer the keyboard', /CCTheme\.pressable\(b\)/.test(grabFn(docker, 'hardenPop')));
  ok('the gears that open the windows can be reached with Tab', /CCTheme\.pressable\(lb\)/.test(grabFn(docker, 'gearKeys')) && /return gearKeys\(lb\)/.test(grabFn(docker, 'limGear')) && /return gearKeys\(lb\)/.test(grabFn(docker, 'bwGear')));

  const vmEd = grabFn(vms, 'openVmEd');
  ok('the VM window is a .cc-win with a title badge', /el\("div", "cc-win"\)/.test(vmEd) && /el\("div", "cc-win-title", titleMap\[which\] \+ ": " \+ name\)/.test(vmEd));
  ok('its content has the scrolling content box',/el\("div", "cc-win-card"\)/.test(vmEd));
  ok('its button row holds Apply alone, the close badge comes from the modal', vmEd.indexOf('VMDE ? "Schließen"') < 0 && vmEd.indexOf('"cc-win-btn cc-win-go", VMDE ? "Anwenden"') > 0);
  ok('it is modal through the shared helper', /CT\.modal\(win, \{ opener: anchor/.test(vmEd));
  ok('no typed corner ✕ and no transparent click layer', !/✕/.test(vmEd) && !/cc-vmlim-ov/.test(vms + read('sheets/TowerTorch.VmTab.css')));

  const create = grabFn(docker, 'ccOrgCreateFolder'), edit = grabFn(docker, 'openFolderEditor'), del = grabFn(docker, 'ccOrgDeleteFolder');
  ok('a new folder is named in a window with a text field', /input: \{/.test(create) && /t\("newFolderTitle"\)/.test(create));
  ok('the folder editor is a CC window placed and made modal like the others, with its name prefilled', /el\("div", "cc-pop cc-pop-folder"\)/.test(edit) && /placePop\(pop, anchor, 360\)/.test(edit) && /nameIn\.value = self\.name/.test(edit));
  ok('it asks before unsaved changes are dropped', /pop\._unsaved = function/.test(edit));
  ok('a delete names the folder and counts what moves up', /t\("deleteFolderTitle"\)\.replace\("%s"/.test(del) && /n === 1/.test(del) && /danger: true/.test(del));
  const tde = /deleteFolderTitle: "([^"]+)"/.exec(docker);
  ok('the German delete title says what happens', tde && tde[1] === 'Ordner „%s“ löschen?', tde && tde[1]);
  const bulk = grabFn(docker, 'ccBulkRemove');
  ok('the bulk remove counts the containers in its title', /count \+ " Container entfernen\?"/.test(bulk) && /"Remove " \+ count \+ " container"/.test(bulk));
  ok('and its answer is a delete, never red', /danger: true/.test(bulk));
  ok('Reset all asks in a window instead of arming itself', /CCTheme\.ask\(\{\s*title: T\("Alle Einstellungen zurücksetzen\?"/.test(settings) && !/data-armed/.test(settings) && !/Nochmal klicken|Click again/.test(settings));
  ok('the plugin remove has no red confirm button', !/confirmButtonColor/.test(plugins) && /danger: true/.test(grabFn(plugins, 'ccPluginConfirm')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
