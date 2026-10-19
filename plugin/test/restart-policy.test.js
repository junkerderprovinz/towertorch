// Pins the per-container restart policy in docker.js: the DOM shape of the editor
// dropdown restartPolicySelect() builds, the warning badge restartWarnBadge()
// builds, and that every label exists in both languages.
const fs = require('fs');
const path = require('path');
const DOCKER = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local',
  'emhttp', 'plugins', 'towertorch', 'scripts', 'docker.js');

// A trimmed copy of the DOM shim in clone-select.test.js.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; this.listeners = {};
    this.style = { setProperty() {}, removeProperty() {} }; this.selected = false;
  }
  get className() { return [this._cls, ...this.classList.s].filter(Boolean).join(' '); }
  set className(v) { this._cls = ''; this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
}
class OptionN extends N { constructor() { super('option'); } get text() { return this.textContent; } }
class SelectN extends N {
  constructor() { super('select'); }
  get options() { return this.children.filter(c => c.tagName === 'OPTION'); }
}
const document = { createElement: t => (t === 'select' ? new SelectN() : t === 'option' ? new OptionN() : new N(t)) };
global.document = document;
global.navigator = { language: 'en' };

// Pull the code under test out of docker.js.
const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(name) {
  const key = 'var ' + name + ' = ';
  const i = src.indexOf(key);
  if (i < 0) throw new Error('var not found in docker.js: ' + name);
  const start = i + key.length, open = src[start], close = open === '{' ? '}' : ']';
  let d = 0;
  for (let k = start; k < src.length; k++) { if (src[k] === open) d++; else if (src[k] === close) { d--; if (!d) return src.slice(i, k + 1) + ';'; } }
  throw new Error('unbalanced var: ' + name);
}
const prelude = 'var LANG = "en";\n' + grabVar('T') + '\n' + grabVar('RESTART_POLICIES') + '\n';
const code = ['el', 't', 'badgeInfo', 'restartPolicyLabel', 'restartPolicySelect', 'restartWarnBadge'].map(grabFn).join('\n');
const api = new Function('document', 'navigator',
  prelude + code + '\nreturn { T: T, RESTART_POLICIES: RESTART_POLICIES, restartPolicyLabel: restartPolicyLabel, restartPolicySelect: restartPolicySelect, restartWarnBadge: restartWarnBadge, setLang: function (l) { LANG = l; } };'
)(document, global.navigator);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nThe editor dropdown offers exactly Docker\'s four restart policies, in order');
{
  ok('RESTART_POLICIES is the four canonical names', api.RESTART_POLICIES.join(',') === 'no,unless-stopped,always,on-failure', api.RESTART_POLICIES.join(','));
  const sel = api.restartPolicySelect('unless-stopped');
  ok('builds a <select>', sel.tagName === 'SELECT');
  ok('has exactly four options', sel.options.length === 4, 'got ' + sel.options.length);
  ok('option values match the four policies in order', sel.options.map(o => o.value).join(',') === 'no,unless-stopped,always,on-failure', sel.options.map(o => o.value).join(','));
  ok('every option has a non-empty label', sel.options.every(o => o.text && o.text.length > 0));
  const selected = sel.options.filter(o => o.selected);
  ok('the current policy is the one preselected', selected.length === 1 && selected[0].value === 'unless-stopped', JSON.stringify(selected.map(o => o.value)));
}

console.log('\nAn unknown or blank current policy preselects "no"');
{
  const sel = api.restartPolicySelect('no');
  const selected = sel.options.filter(o => o.selected);
  ok('"no" is the selected default', selected.length === 1 && selected[0].value === 'no', JSON.stringify(selected.map(o => o.value)));
}

console.log('\nThe warning badge is a semantic-warn info badge carrying the tooltip');
{
  const b = api.restartWarnBadge();
  ok('carries the base info-badge class', b.classList.contains('cc-b') && b.classList.contains('cc-b-info'));
  ok('carries the semantic warn class rather than an accent or rainbow one', b.classList.contains('cc-b-warn'));
  ok('carries the kind class the column system needs', b.classList.contains('cc-b-restart'));
  ok('shows the warn glyph and the label', b.textContent.indexOf('⚠') >= 0 && b.textContent.indexOf(api.T.en.rpWarn) >= 0, JSON.stringify(b.textContent));
  ok('the tooltip is the reboot warning', b.getAttribute('data-tip') === api.T.en.rpWarnTip, JSON.stringify(b.getAttribute('data-tip')));
}

console.log('\nEvery restart-policy key exists in German and English');
{
  const keys = ['restartPolicy', 'rpNo', 'rpUnlessStopped', 'rpAlways', 'rpOnFailure', 'rpWarn', 'rpWarnTip'];
  keys.forEach(k => {
    ok('de.' + k + ' present', typeof api.T.de[k] === 'string' && api.T.de[k].length > 0);
    ok('en.' + k + ' present', typeof api.T.en[k] === 'string' && api.T.en[k].length > 0);
  });
}

console.log('\nrestartPolicyLabel maps each policy to a distinct label, in both languages');
{
  ['en', 'de'].forEach(lang => {
    api.setLang(lang);
    const labels = api.RESTART_POLICIES.map(p => api.restartPolicyLabel(p));
    ok(lang + ': four labels, all non-empty', labels.every(l => l && l.length > 0), JSON.stringify(labels));
    ok(lang + ': all four labels are distinct', new Set(labels).size === 4, JSON.stringify(labels));
  });
  api.setLang('en');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
