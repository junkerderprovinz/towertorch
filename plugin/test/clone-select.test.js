// Runs shares.js's own ccWrapSelect, ccSyncOne and ccSyncGroup against the DOM
// shape Unraid renders on ShareEdit.page, where .relative holds the clone-settings
// block and the form as siblings, and replays the clicks a user makes on the
// "Read settings from" select.
const fs = require('fs');
const path = require('path');
const SHARES = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local',
  'emhttp', 'plugins', 'towertorch', 'scripts', 'shares.js');

class CL {
  constructor(n) { this.n = n; this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(this); this._cls = ''; this._txt = ''; this.attrs = {}; this.listeners = {};
    this.style = {}; this.disabled = false; this.selected = false;
  }
  get className() { return [this._cls, ...this.classList.s].filter(Boolean).join(' '); }
  set className(v) { this._cls = ''; this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.children.indexOf(ref) : -1;
    c.parentNode = this; i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach(fn => fn.call(this, ev)); let p = this.parentNode; if (ev.bubbles) while (p) { (p.listeners[ev.type] || []).forEach(fn => fn.call(p, ev)); p = p.parentNode; } return true; }
  walk(out = []) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  _match(sel) {
    // supports the selectors the tested code uses: tag, .class, [attr], combos
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!this.classList.contains(c.slice(1))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) { const k = a.slice(1, -1); if (!(k in this.attrs)) return false; }
    return true;
  }
  querySelectorAll(sel) { return this.walk().filter(n => sel.split(',').some(s => n._match(s.trim()))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  focus() {}
}
class OptionN extends N {                 // ccSyncOne reads .text off an option
  constructor() { super('option'); }
  get text() { return this.textContent; }
}
class SelectN extends N {
  constructor() { super('select'); this._si = -1; }
  get options() { return this.children.filter(c => c.tagName === 'OPTION'); }
  // Writing selectedIndex re-points option.selected, which ccSyncOne reads for the chips.
  get selectedIndex() { return this._si; }
  set selectedIndex(i) { this._si = i; this.options.forEach((o, k) => { o.selected = k === i; }); }
  // .form is the ancestor <form> or null, which is what the clone block trips over.
  get form() { let p = this.parentNode; while (p) { if (p.tagName === 'FORM') return p; p = p.parentNode; } return null; }
}
const document = {
  createElement: t => (t === 'select' ? new SelectN() : t === 'option' ? new OptionN() : new N(t)),
  documentElement: new N('html'),
  addEventListener() {}, querySelectorAll: () => [],
};
global.document = document;
global.window = {};   // no cc-theme.js here, so the trigger skips its keyboard wiring
global.navigator = { language: 'en' };
global.location = { pathname: '/Shares/Share' };
global.Event = class { constructor(t, o = {}) { this.type = t; this.bubbles = !!o.bubbles; } };

// Pull the functions under test out of shares.js.
const src = fs.readFileSync(SHARES, 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found in shares.js: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + name);
}
const code = ['el', 'ccWrapSelect', 'ccSyncOne', 'ccSyncGroup'].map(grab).join('\n');
const { ccWrapSelect, ccSyncOne } = new Function('document', 'Event', code + '\nreturn {ccWrapSelect, ccSyncOne};')(document, global.Event);

// The markup ShareEdit.page renders: a div.relative holding div.clone-settings
// with the readshare select, and the form beside it rather than around it.
function build() {
  const relative = new N('div'); relative.className = 'relative';
  const clone = new N('div'); clone.className = 'clone-settings shade'; relative.appendChild(clone);
  const dd = new N('dd'); clone.appendChild(dd);
  const span = new N('span'); span.className = 'flex flex-row items-center gap-4'; dd.appendChild(span);
  const sel = new SelectN(); sel.setAttribute('name', 'readshare'); span.appendChild(sel);
  const names = ['select...', 'appdata', 'domains', 'isos'];
  names.forEach((t, i) => { const o = new OptionN(); o.textContent = t; if (i === 0) { o.disabled = true; o.selected = true; sel.selectedIndex = 0; } sel.appendChild(o); });
  const form = new N('form'); form.setAttribute('name', 'share_edit'); relative.appendChild(form); // beside the clone block
  return { relative, sel };
}
const label = sel => sel.parentNode.querySelector('.cc-sel-trigger').textContent;
const chips = sel => sel.parentNode.querySelectorAll('.cc-sel-opt').map(c => c.textContent);
const pick = (sel, i) => { const chip = sel.parentNode.querySelector('.cc-sel-panel').children[i]; chip.listeners.click[0]({ stopPropagation() {} }); };
const openIt = sel => sel.parentNode.querySelector('.cc-sel-trigger').listeners.click[0]({ stopPropagation() {} });

// ShareEdit.page renders #direction ("Mover action") with empty option text and
// labels it later from updateScreen()'s jQuery .text() writes. shares.js is a
// defer script, so it wraps the select while the options are still blank.
function buildDirection() {
  const form = new N('form'); form.setAttribute('name', 'share_edit');
  const sel = new SelectN(); sel.setAttribute('id', 'direction'); form.appendChild(sel);
  ['', ''].forEach((t, i) => { const o = new OptionN(); o.textContent = t; sel.appendChild(o); });
  sel.selectedIndex = 0;
  return { form, sel };
}
const updateScreen = sel => { sel.options[0].textContent = 'cache -> Array'; sel.options[1].textContent = 'Array -> cache'; };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nThe clone block sits beside the form, so select.form is null');
{
  const { sel } = build();
  ok('readshare.form === null (clone-settings is outside <form>)', sel.form === null, 'got ' + sel.form);
}

console.log('\nPicking a share, then picking a different one');
{
  const { sel } = build(); ccWrapSelect(sel);
  ok('starts on the placeholder', label(sel) === 'select...', JSON.stringify(label(sel)));

  openIt(sel); pick(sel, 1);                       // click "appdata"
  ok('picking a share shows it in the field', label(sel) === 'appdata',
     'field shows ' + JSON.stringify(label(sel)) + ' after picking "appdata"');
  ok('the native select moves with it, so the POST stays correct', sel.selectedIndex === 1);

  openIt(sel); pick(sel, 2);                       // click "domains"
  ok('picking another share does not show the previous one', label(sel) === 'domains',
     'field shows ' + JSON.stringify(label(sel)) + ' after picking "domains"');
  ok('selected chip tracks the pick', sel.parentNode.querySelectorAll('.cc-sel-opt')[2].classList.contains('is-selected'));
  ok('previous chip deselected', !sel.parentNode.querySelectorAll('.cc-sel-opt')[1].classList.contains('is-selected'));
}

console.log("\nUnraid's inline onchange still fires, so the LESEN button un-disables");
{
  const { sel } = build(); let fired = 0;
  sel.addEventListener('change', () => fired++);   // stands in for onchange="toggleButton('readshare',false)"
  ccWrapSelect(sel); openIt(sel); pick(sel, 1);
  ok('a real change event is dispatched', fired === 1, 'fired ' + fired + 'x');
}

console.log('\nA select inside the form, such as a disk dropdown');
{
  const relative = new N('div'); const form = new N('form'); relative.appendChild(form);
  const sel = new SelectN(); form.appendChild(sel);
  ['auto', 'disk1', 'disk2'].forEach((t, i) => { const o = new OptionN(); o.textContent = t; if (!i) sel.selectedIndex = 0; sel.appendChild(o); });
  ccWrapSelect(sel); openIt(sel); pick(sel, 2);
  ok('in-form select labels correctly', label(sel) === 'disk2', JSON.stringify(label(sel)));
  ok('in-form select.form resolves', sel.form === form);
}

console.log('\nDisabled placeholder is not pickable');
{
  const { sel } = build(); ccWrapSelect(sel);
  openIt(sel); pick(sel, 1); openIt(sel); pick(sel, 0);   // try to pick the disabled "select..."
  ok('clicking the disabled placeholder is ignored', label(sel) === 'appdata' && sel.selectedIndex === 1, JSON.stringify(label(sel)));
}

console.log('\n"Mover action" (#direction), whose option text Unraid writes after the wrap');
{
  const { sel } = buildDirection();
  ccWrapSelect(sel);
  ok('chips start blank, mirroring the empty options', chips(sel).join('|') === '|');

  updateScreen(sel);                                   // Unraid labels the options via jQuery .text()
  ccSyncOne(sel);                                      // what an observer tick, an open or a pick does
  ok('chip labels follow the option text', chips(sel).join('|') === 'cache -> Array|Array -> cache',
     'chips are ' + JSON.stringify(chips(sel)));
  ok('the closed field shows the selected label too', label(sel) === 'cache -> Array', JSON.stringify(label(sel)));

  // A Primary or Secondary change relabels the same options, and the chips follow.
  sel.options[0].textContent = 'disk1 -> Array'; sel.options[1].textContent = 'Array -> disk1';
  ccSyncOne(sel);
  ok('chips re-follow a later relabel', chips(sel).join('|') === 'disk1 -> Array|Array -> disk1',
     'chips are ' + JSON.stringify(chips(sel)));
}

console.log('\nccSyncOne is idempotent, so it cannot drive the observer in a loop');
{
  // ccSelects() re-syncs every wrapped select on each MutationObserver tick, so an
  // unconditional textContent write in ccSyncOne would replace a text node every
  // 150ms with nothing changed and keep the observer firing on its own output.
  const { sel } = buildDirection(); ccWrapSelect(sel); updateScreen(sel); ccSyncOne(sel);
  const trigger = sel.parentNode.querySelector('.cc-sel-trigger');
  const chip = sel.parentNode.querySelectorAll('.cc-sel-opt')[0];
  let writes = 0;
  const raw = Object.getOwnPropertyDescriptor(N.prototype, 'textContent');
  const instrument = n => Object.defineProperty(n, 'textContent', { get: raw.get, set(v) { writes++; raw.set.call(this, v); } });
  instrument(trigger); instrument(chip);
  ccSyncOne(sel); ccSyncOne(sel);
  ok('a sync of unchanged options writes no text at all', writes === 0, writes + ' write(s)');
}

console.log('\nA select the page-wide sweep wrapped first gets one dropdown, not two');
{
  const { sel } = build();
  const span = sel.parentNode;
  const tsel = new N('span'); tsel.className = 'cc-tsel'; span.insertBefore(tsel, sel);
  tsel.appendChild(sel); sel.setAttribute('data-cc-tsel', '1');
  const trig = new N('span'); trig.className = 'cc-tsel-trigger'; tsel.appendChild(trig);
  ccWrapSelect(sel);
  ok('the generic wrapper is gone', !span.querySelector('.cc-tsel') && !span.querySelector('.cc-tsel-trigger'));
  ok('and the page\'s own dropdown stands where it was', sel.parentNode.classList.contains('cc-sel') && sel.parentNode.parentNode === span && span.querySelectorAll('.cc-sel-trigger').length === 1);
  ok('the select drops the generic wrapper\'s marker', !sel.hasAttribute('data-cc-tsel'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
