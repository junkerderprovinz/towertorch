// One toast component for every area (GlimStone, "Toasts"): CCTheme.toast in cc-theme.js.
// Each toast lasts four seconds, a new one stacks instead of replacing the last, and hover
// or focus pauses the countdown and keeps what is left of it. docker.js's flash() and
// header.js's ccToast() go through it, and the two old single-node toasts are gone.
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

// A clock the test moves by hand, so four seconds take no time.
let now = 0, timers = [], seq = 0;
const setT = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
const clearT = (id) => { timers = timers.filter((t) => t.id !== id); };
function advance(ms) {
  const end = now + ms;
  for (;;) {
    timers.sort((a, b) => a.at - b.at);
    const t = timers[0];
    if (!t || t.at > end) break;
    timers.shift(); now = t.at; t.fn();
  }
  now = end;
}

class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.className = ''; this.textContent = ''; this.id = ''; }
  get classList() { const self = this; return { add: (c) => { if (!self.className.split(' ').includes(c)) self.className = (self.className + ' ' + c).trim(); }, contains: (c) => self.className.split(' ').includes(c) }; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(t) { (this.listeners[t] || []).forEach((fn) => fn({ type: t })); }
}
const body = new El('body');
const document = { body, createElement: (t) => new El(t), getElementById: (id) => body.children.find((c) => c.id === id) || null };
let fadeOut = '0.16s';
const getComputedStyle = () => ({ animationDuration: fadeOut });
const theme = read('scripts/cc-theme.js');
const toast = new Function('document', 'getComputedStyle', 'setTimeout', 'clearTimeout', 'Date',
  'var TOAST_MS = 4000;\n' + grabFn(theme, 'toast') + '\nreturn toast;')(document, getComputedStyle, setT, clearT, { now: () => now });
const stack = () => document.getElementById('cc-toasts');
const shown = () => (stack() ? stack().children.filter((c) => !c.classList.contains('cc-toast-out')) : []);
const reset = () => { if (stack()) stack().children = []; timers = []; now = 0; };

console.log('\nFour seconds, stacked');
{
  reset();
  toast('one'); toast('two', 'error');
  ok('a second toast stacks under the first', shown().length === 2 && shown()[1].textContent === 'two');
  ok('the stack is a polite live region', stack().attrs.role === 'status' && stack().attrs['aria-live'] === 'polite');
  ok('kind "error" marks the toast', shown()[1].className === 'cc-toast cc-toast-err');
  advance(3999);
  ok('both still stand just before four seconds', shown().length === 2);
  advance(1);
  ok('both fade out at four seconds', shown().length === 0 && stack().children.length === 2);
  advance(160);
  ok('and leave the page once the fade-out has run', stack().children.length === 0);
}

console.log('\nHover pauses and keeps the remaining time');
{
  reset();
  toast('held');
  const el = shown()[0];
  advance(3000);
  el.fire('mouseenter');
  advance(10000);
  ok('a hovered toast does not expire', shown().length === 1);
  el.fire('mouseleave');
  advance(999);
  ok('after the pointer leaves, only the second that was left remains', shown().length === 1);
  advance(1);
  ok('and then it goes', shown().length === 0);
}

console.log('\nFocus pauses too, and hover leaving does not resume a focused toast');
{
  reset();
  toast('focused');
  const el = shown()[0];
  advance(1000);
  el.fire('focus'); el.fire('mouseenter'); el.fire('mouseleave');
  advance(10000);
  ok('a focused toast stays while the pointer comes and goes', shown().length === 1);
  el.fire('blur');
  advance(3000);
  ok('blur resumes the three seconds that were left', shown().length === 0);
}

console.log('\nClick dismisses, and the handle rewrites a progress note');
{
  reset();
  toast('click me');
  shown()[0].fire('click');
  ok('a click closes the toast', shown().length === 0);
  reset();
  const h = toast('saving…');
  advance(3000);
  ok('the handle rewrites the toast in place', h.update('saved', 'ok') === true && shown().length === 1 && shown()[0].textContent === 'saved');
  advance(3999);
  ok('a rewritten toast starts a fresh four seconds', shown().length === 1);
  advance(1);
  ok('a closed toast cannot be rewritten', h.update('late') === false);
  reset(); fadeOut = '0s';
  toast('still'); advance(4000);
  ok('at "off" the toast leaves without waiting for a fade', stack().children.length === 0);
}

console.log('\nEvery call site goes through it');
{
  const header = read('scripts/header.js'), docker = read('scripts/docker.js');
  ok('header.js ccToast() calls CCTheme.toast', /function ccToast\(msg, kind\) \{\s*try \{ return window\.CCTheme && window\.CCTheme\.toast \? window\.CCTheme\.toast\(msg, kind\)/.test(header));
  ok('header.js builds no toast node of its own', !/cc-toast/.test(header));
  const flash = grabFn(docker, 'flash');
  ok('docker.js flash() calls CCTheme.toast', /window\.CCTheme\.toast\(msg, kind\)/.test(flash));
  ok('flash() rewrites a progress note instead of stacking', /flashToast\.update\(msg, kind\)/.test(flash) && /if \(!\/…\$\/\.test\(msg\)\) flashToast = null;/.test(flash));
  ok('docker.js builds no toast node of its own', !/el\("div", "cc-toast"\)/.test(docker));
  const css = read('styles/docker.css') + read('sheets/TowerTorch.Header.css');
  ok('the old toast styles are gone', !/#cc-toast\b|\.cc-toast-show/.test(css));
  ok('no toast sets its own font stack', !/\.cc-toast[^{]*\{[^}]*font-family/.test(css) && !/\.cc-toast[^{]*\{[^}]*font:/.test(css));
  ok('a toast has no border line', /\.cc-toast \{[^}]*border: none;/.test(css));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
