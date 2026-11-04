// Drives header.js's ttLoadState() spinner election against a DOM shim.
//
// The overlay's display comes from an inline override ttLoadState sets and clears,
// not from a stylesheet rule: an unconditional !important could never lose to
// Unraid's own inline display:none and left the dimmed overlay up for good. The
// same pass holds the overlay open through data-tt-held while docker.js is still
// painting, so the two assertions that matter are that the override is granted
// only while elected or held, and that it is released the moment it is not.
const fs = require('fs');
const path = require('path');
const HEADER = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local',
  'emhttp', 'plugins', 'towertorch', 'scripts', 'header.js');

// A trimmed copy of clone-select.test.js's DOM shim, with an inline-style model:
// setProperty, removeProperty and the plain .display alias share one value, so
// whichever of them wrote last wins, as in a real CSSOM declaration.
class CL {
  constructor() { this.s = new Set(); }
  add(c) { this.s.add(c); } remove(c) { this.s.delete(c); }
  contains(c) { return this.s.has(c); }
  toggle(c, f) { const want = f === undefined ? !this.s.has(c) : !!f; want ? this.s.add(c) : this.s.delete(c); return want; }
}
class Style {
  constructor() { this._v = {}; }
  setProperty(k, v) { this._v[k] = v; }
  getPropertyValue(k) { return this._v[k] || ''; }
  removeProperty(k) { delete this._v[k]; }
  get display() { return this._v.display || ''; }
  set display(v) { if (v === '') delete this._v.display; else this._v.display = v; }
}
class N {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null;
    this.classList = new CL(); this.attrs = {}; this.style = new Style();
    this.nativeDisplay = 'block'; // Unraid's own last write, what getComputedStyle falls back to
  }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; } hasAttribute(k) { return k in this.attrs; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  walk(out = []) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  _match(sel) {
    const m = sel.match(/^([a-zA-Z]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/); if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!this.classList.contains(c.slice(1))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) { const k = a.slice(1, -1); if (!(k in this.attrs)) return false; }
    return true;
  }
  querySelectorAll(sel) { return this.walk().filter(n => sel.split(',').some(s => n._match(s.trim()))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function computedDisplay(el) { return el.style.display || el.nativeDisplay; }

// Pull ttLoadState and its helpers out of header.js.
const src = fs.readFileSync(HEADER, 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in header.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const code = ['ttLoader', 'ttMountLoader', 'ttUnmountLoader', 'ttLoadState'].map(grab).join('\n');
const html = new N('html');
html.classList.add('tt-popups-on');
const document = {
  documentElement: html,
  querySelector: s => html._match(s.trim()) ? html : html.querySelector(s),
  querySelectorAll: s => html.querySelectorAll(s),
  getElementById: () => null,
};
const { ttLoadState } = new Function('document', 'getComputedStyle', code + '\nreturn {ttLoadState};')(
  document, el => ({ display: computedDisplay(el) }));

let failed = false;
function check(label, cond) { console.log((cond ? '  PASS  ' : '  FAIL  ') + label); if (!cond) failed = true; }

console.log('div.spinner.fixed is genuinely shown by Unraid (nativeDisplay=block, no TowerTorch involvement yet)');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); html.appendChild(sp);
  html.classList.remove('tt-enh-busy');
  ttLoadState();
  check('gets elected and forced to flex !important', sp.style.display === 'flex' && sp.style.getPropertyValue('display') === 'flex');
  check('root is marked tt-loading / data-tt-load=fixed', html.classList.contains('tt-loading') && html.getAttribute('data-tt-load') === 'fixed');
  html.children.length = 0; // reset
}

console.log('\ndiv.spinner.fixed already hidden by Unraid, with the enhancer idle');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.remove('tt-enh-busy');
  ttLoadState();
  check('is left alone: no inline display override at all', sp.style.getPropertyValue('display') === '');
  check('computed display stays none, not stuck visible', computedDisplay(sp) === 'none');
  check('root is not marked loading', !html.classList.contains('tt-loading'));
  html.children.length = 0;
}

console.log('\nUnraid already hid it, but docker.js is still painting (tt-enh-busy)');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.add('tt-enh-busy');
  ttLoadState();
  check('held element is marked data-tt-held', sp.getAttribute('data-tt-held') === '1');
  check('is force-elected to flex !important despite Unraid hiding it', sp.style.display === 'flex' && sp.style.getPropertyValue('display') === 'flex');
  check('root still reads as loading while held', html.classList.contains('tt-loading'));

  console.log('  -> the enhancer finishes and tt-enh-busy is cleared');
  html.classList.remove('tt-enh-busy');
  ttLoadState();
  check('data-tt-held is cleared', !sp.hasAttribute('data-tt-held'));
  check('the forced inline display is removed', sp.style.getPropertyValue('display') === '');
  check('root no longer reads as loading', !html.classList.contains('tt-loading'));
  html.children.length = 0;
}

console.log('\na hold sustained across several 60ms poll ticks neither flickers nor releases early');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'none'; html.appendChild(sp);
  html.classList.add('tt-enh-busy');
  for (let tick = 1; tick <= 3; tick++) {
    ttLoadState();
    check('tick ' + tick + ': still held and flex', sp.getAttribute('data-tt-held') === '1' && sp.style.display === 'flex');
  }
  html.classList.remove('tt-enh-busy');
  ttLoadState();
  check('released after the busy tick ends', !sp.hasAttribute('data-tt-held') && sp.style.getPropertyValue('display') === '');
  html.children.length = 0;
}

console.log('\nvisibility Unraid itself holds does not flicker off across several ticks');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.classList.add('fixed'); sp.nativeDisplay = 'block'; html.appendChild(sp);
  html.classList.remove('tt-enh-busy');
  for (let tick = 1; tick <= 3; tick++) {
    ttLoadState();
    check('tick ' + tick + ': stays elected and flex', sp.style.display === 'flex' && html.classList.contains('tt-loading'));
  }
  sp.nativeDisplay = 'none'; // Unraid hides it
  ttLoadState();
  check('releases once Unraid hides it', sp.style.getPropertyValue('display') === '' && !html.classList.contains('tt-loading'));
  html.children.length = 0;
}

console.log('\nan unrelated in-page spinner must never be force-elected as the fixed overlay');
{
  const sp = new N('div'); sp.classList.add('spinner'); sp.nativeDisplay = 'none'; html.appendChild(sp); // no .fixed
  html.classList.add('tt-enh-busy');
  ttLoadState();
  check('no held attribute: only div.spinner.fixed can be held', !sp.hasAttribute('data-tt-held'));
  check('root is not loading, with nothing up and nothing to hold', !html.classList.contains('tt-loading'));
  html.classList.remove('tt-enh-busy');
  html.children.length = 0;
}

console.log(failed ? '\nFAILED' : '\nOK  all spinner-election scenarios passed');
process.exit(failed ? 1 : 0);
