// SweetAlert reuses one node for every dialog, so a progress window opened after another one
// finished has to start as running again.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
// The function holds braces inside strings and regexes, so it is cut at the declaration after it.
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  return src.slice(i, src.indexOf('\n  function ', i + 1));
}

// Just enough of a SweetAlert node: the title with Unraid's progress span, the log and the
// confirm button, and a way to swap in the next dialog's content the way swal() does.
function el(tag, props) {
  const e = Object.assign({ tagName: tag.toUpperCase(), children: [], attrs: {}, style: {}, dataset: {}, textContent: '', parentElement: null, offsetParent: {} }, props || {});
  e.classList = { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); }, toggle(c, f) { f ? this.s.add(c) : this.s.delete(c); } };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
  e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null);
  e.appendChild = (c) => { c.parentElement = e; e.children.push(c); return c; };
  e.remove = () => {};
  return e;
}
function dialog() {
  const sa = el('div', { scrollHeight: 0, clientHeight: 0 });
  sa.classList.add('sweet-alert');
  const parts = {};
  sa.open = () => {
    const progT = el('span', { id: 'pluginProgressTitle', textContent: 'In Progress', spinner: el('i') });
    progT.querySelector = (s) => (/fa/.test(s) ? progT.spinner : null);
    const h2 = el('h2', { textContent: 'Update Plugin - In Progress' });
    h2.querySelector = (s) => (s === '#pluginProgressTitle' ? progT : null);
    Object.assign(parts, { h2, progT, pre: el('pre', { id: 'swaltext' }), btn: el('button', { textContent: 'Close', disabled: false }) });
  };
  sa.finish = () => { parts.progT.spinner = null; parts.progT.textContent = 'Finished'; parts.btn.textContent = 'Done'; };
  sa.querySelector = (s) => {
    if (s === 'h2') return parts.h2;
    if (s === '#swaltext') return parts.pre;
    if (s === 'button.confirm') return parts.btn;
    if (s === '.tt-nchan-loader') return sa.loader || null;
    if (s === '.sa-button-container') return row;
    return null;
  };
  const row = el('div');
  row.appendChild = (c) => { c.parentElement = row; sa.loader = c; return c; };
  sa.querySelectorAll = (s) => (s === 'button' ? [parts.btn] : []);
  return sa;
}

const sa = dialog();
const docEl = el('html'); docEl.classList.add('tt-popups-on');
const doc = {
  documentElement: docEl,
  querySelectorAll: () => [sa],
  createElement: (t) => el(t),
  createTreeWalker: () => ({ nextNode: () => null })
};
const run = new Function('document', 'MutationObserver', 'NodeFilter', 'T', 'ttPopRestyleSoon', 'paintPopups',
  grabFn(header, 'ttNchanStyle') + '\nreturn ttNchanStyle;')(doc, class { observe() {} }, { SHOW_TEXT: 4 }, (de, en) => en, () => {}, () => {});

console.log('\nThe status beside the buttons of a progress window');
sa.open(); run();
ok('a fresh window runs', sa.dataset.ttState === 'run' && sa.loader.getAttribute('data-tt-mode') === 'run', sa.dataset.ttState);
sa.finish(); run();
ok('it turns into the check once Unraid reports the end', sa.dataset.ttState === 'done' && sa.loader.getAttribute('data-tt-mode') === 'done', sa.dataset.ttState);
run();
ok('and stays finished on the next pass', sa.dataset.ttState === 'done');
sa.open(); run();
ok('the next window in the same node runs again until its own end', sa.dataset.ttState === 'run' && sa.loader.getAttribute('data-tt-mode') === 'run', sa.dataset.ttState);
sa.finish(); run();
ok('and finishes on its own signal', sa.dataset.ttState === 'done');

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
