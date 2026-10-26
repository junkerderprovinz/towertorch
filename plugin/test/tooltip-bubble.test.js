// The hover bubble (#cc-tipfloat, header.js ccWireTips) follows GlimStone's "The tooltip and
// info bubble":
//   · hover opens it, and focus opens it only when the keyboard was used last, tracked for
//     the whole page; a click focuses its control as a side effect, and a bubble opened by
//     that would stand where the pointer no longer is
//   · it fades in over 110ms at the default level and closes at once
//   · its text sits on the type scale in the host's font, with no font stack of its own
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
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

class El {
  constructor(attrs) { this.attrs = Object.assign({}, attrs); this.style = { display: 'none', setProperty() {}, }; this.id = ''; this.textContent = ''; this.classList = { toggle() {}, contains: () => false }; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  closest() { return this.attrs['data-tip'] || this.attrs.title ? this : null; }
  contains(o) { return o === this; }
  getBoundingClientRect() { return this.rect || { left: 100, top: 100, bottom: 120, width: 20, height: 20 }; }
  get isConnected() { return !this.gone; }
  get offsetWidth() { return 120; } get offsetHeight() { return 30; }
}
const listeners = {};
let bubble = null;
const document = {
  documentElement: { classList: { contains: (c) => c === 'cc-popups-on' }, clientWidth: 1200, clientHeight: 800 },
  body: { appendChild: (n) => { bubble = n; } },
  getElementById: (id) => (bubble && id === 'cc-tipfloat' ? bubble : null),
  createElement: () => new El(),
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
};
let frames = [];
const window = { addEventListener() {}, innerWidth: 1200, innerHeight: 800, requestAnimationFrame: (fn) => frames.push(fn), cancelAnimationFrame: () => { frames = []; } };
const tick = () => { const f = frames; frames = []; f.forEach((fn) => fn()); };
window.CCTheme = require('./theme-place')(window, document);
const header = read('scripts/header.js');
const decl = (/var ccTipBound = false, ccTipCur = null, ccTipKeys = false;\n  var ccTipFrame = 0, ccTipAt = "";/.exec(header) || [''])[0];
ok('the last-input flag is declared with the bubble state', !!decl);
const wire = new Function('document', 'window',
  decl + '\n' + grabFn(header, 'ccTipEl') + '\n' + grabFn(header, 'ccTipHide') + '\n' + grabFn(header, 'ccTipFollow') + '\n' + grabFn(header, 'ccTipShow') + '\n' + grabFn(header, 'ccWireTips') + '\nccWireTips(); return { hide: ccTipHide };')(document, window);
const fire = (type, e) => (listeners[type] || []).forEach((fn) => fn(Object.assign({ type }, e)));
const open = () => !!bubble && bubble.style.display === 'block';

console.log('\nHover always opens, focus only after the keyboard');
{
  const icon = new El({ 'data-tip': 'Explains the field' });
  fire('mouseover', { target: icon });
  ok('hover opens the bubble', open() && bubble.textContent === 'Explains the field');
  fire('mouseout', { target: icon, relatedTarget: null });
  ok('leaving closes it', !open());

  fire('pointerdown', { target: icon });
  fire('focusin', { target: icon });
  ok('focus that follows a press does not open it', !open());

  fire('keydown', { key: 'Tab' });
  fire('focusin', { target: icon });
  ok('focus after a key does', open());
  fire('focusout', { target: icon, relatedTarget: null });

  const other = new El({ 'data-tip': 'Another field' });
  fire('keydown', { key: 'Tab' });
  fire('pointerdown', { target: icon });
  fire('focusin', { target: other });
  ok('the last input counts page-wide: a press on one control, focus on another', !open());

  fire('keydown', { key: 'Escape' });
  ok('Escape still closes it and counts as keyboard use', !open());
}

console.log('\nThe bubble stays with its anchor');
{
  const icon = new El({ 'data-tip': 'In a window' });
  icon.rect = { left: 100, top: 100, bottom: 120, width: 20, height: 20 };
  fire('mouseover', { target: icon });
  const at = bubble.style.top;
  icon.rect = { left: 100, top: 40, bottom: 60, width: 20, height: 20 };
  tick();
  ok('a window that slides up takes the bubble along', open() && at === '128px' && bubble.style.top === '68px', at + ' ' + bubble.style.top);
  tick();
  ok('it keeps checking while the bubble stands', frames.length === 1);
  icon.gone = true;
  tick();
  ok('an anchor that leaves the page takes its bubble away', !open());
  ok('and the frame loop stops with it', frames.length === 0);
  const hidden = new El({ 'data-tip': 'Hidden' });
  fire('mouseover', { target: hidden });
  hidden.rect = { left: 0, top: 0, bottom: 0, width: 0, height: 0 };
  tick();
  ok('so does one that is hidden in place', !open());
}

console.log('\nA Dashboard tile keeps its title');
{
  const js = read('scripts/header.js');
  ok('the hover bubble leaves a tbody title alone, Unraid keys the tile by it', /e\.target\.closest\("\[data-cc-tip\], \[data-tip\], \[title\]"\) : null;[\s\S]{0,300}if \(!t \|\| t\.tagName === "TBODY"\) return;/.test(js));
}

console.log('\nThe sheet');
{
  const css = read('sheets/TowerTorch.Header.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const box = (/html\.cc-popups-on #cc-tipfloat \{([^}]*)\}/.exec(css) || [])[1] || '';
  ok('the bubble text is on the type scale', /font-size: var\(--cc-text-meta\);/.test(box));
  ok('the bubble sets no font stack of its own', !/font-family|font:/.test(box));
  const pinned = (/html\.cc-popups-on #cc-acctinfo-pop \{([^}]*)\}/.exec(css) || [])[1] || '';
  ok('the pinned bubble the account (i) opens matches it', /font-size: var\(--cc-text-meta\);/.test(pinned) && !/font-family/.test(pinned));
  const fade = /@media \(prefers-reduced-motion: no-preference\) \{\s*html\.cc-popups-on #cc-tipfloat \{ animation: cc-fade-in var\(--cc-motion-fade-dur, 110ms\) ease both; \}\s*\}/.test(css);
  ok('it fades in from the level token, inside the gate', fade);
  ok('closing has no transition', !/#cc-tipfloat[^{]*\{[^}]*transition/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
