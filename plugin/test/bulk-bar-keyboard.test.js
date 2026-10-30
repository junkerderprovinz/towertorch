// The bulk bar's buttons are spans, so they need a role, a tab stop and Enter and Space to be
// reachable without a mouse. Once an action clears the selection the bar hides, and a focus left
// on a hidden button falls to <body>; it moves to the multi-select badge instead.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const theme = fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(text, name) {
  const i = text.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = text.indexOf('{', i); k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}') { d--; if (!d) return text.slice(i, k + 1); } }
  return null;
}

// A small element: children, attributes, listeners, a display style and focus.
const doc = { activeElement: null, body: null };
function node(tag, cls, txt) {
  const n = {
    tagName: tag.toUpperCase(), className: cls || '', textContent: txt || '', children: [], parent: null, attrs: {}, listeners: {}, hidden: false,
    style: { setProperty(k, v) { if (k === 'display') n.hidden = v === 'none'; }, removeProperty(k) { if (k === 'display') n.hidden = false; } },
    appendChild(c) { c.parent = n; n.children.push(c); return c; },
    setAttribute(k, v) { n.attrs[k] = String(v); }, hasAttribute(k) { return k in n.attrs; }, getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, f) { (n.listeners[t] = n.listeners[t] || []).push(f); },
    dispatch(t, e) { (n.listeners[t] || []).forEach((f) => f(Object.assign({ currentTarget: n, preventDefault() {}, stopPropagation() {} }, e))); },
    click() { n.dispatch('click', {}); },
    focus() { if (n.getClientRects().length) doc.activeElement = n; },
    contains(o) { for (let p = o; p; p = p.parent) if (p === n) return true; return false; },
    getClientRects() { for (let p = n; p; p = p.parent) if (p.hidden) return []; return n.inDoc ? [1] : []; },
    querySelector(sel) { const c = sel.replace('.', ''); const walk = (x) => { for (const k of x.children) { if (k.className.split(' ').includes(c)) return k; const r = walk(k); if (r) return r; } return null; }; return walk(n); },
  };
  return n;
}
const body = node('body'); body.inDoc = true; doc.body = body;
const markIn = (n) => { n.inDoc = true; n.children.forEach(markIn); };
body.appendChild = function (c) { c.parent = body; body.children.push(c); markIn(c); return c; };
const badge = node('span', 'cc-bulkmode-badge'); badge.inDoc = true; badge.parent = body;
doc.querySelector = (sel) => (sel === '.cc-bulkmode-badge' ? badge : null);
doc.querySelectorAll = () => [];
doc.documentElement = { classList: { toggle() {} } };

const pressable = new Function(grabFn(theme, 'pressable') + '\nreturn pressable;')();
const ran = [];
const bulk = new Function('document', 'el', 'window', 'LANG', 'ccBulkRun', 'ccBulkRemove', 'ccBulkClearMarks',
  'var ccBulkBarEl = null, ccBulkSel = {}, colorBulkButtons = function () {};\n' + grabFn(src, 'ccLabelled') + '\n' + grabFn(src, 'ccBulkBarSync') + '\nreturn { sync: ccBulkBarSync, pick: function (s) { ccBulkSel = s; } };')(
  doc, node, { CCTheme: { pressable } }, 'de', (a) => ran.push(a), () => ran.push('remove'), () => {});
const sync = bulk.sync;
bulk.pick({ web: {}, db: {} });

console.log('\nThe buttons answer the keyboard');
sync();
const bar = body.children.find((c) => c.className === 'cc-bulkbar');
const btns = bar.children.filter((c) => /cc-bulkbtn/.test(c.className));
ok('four buttons', btns.length === 4, btns.map((b) => b.textContent).join(', '));
ok('each is a button with a tab stop', btns.every((b) => b.attrs.role === 'button' && b.attrs.tabindex === '0'));
btns[0].dispatch('keydown', { key: 'Enter' });
btns[1].dispatch('keydown', { key: ' ' });
btns[2].dispatch('keydown', { key: 'Enter' });
ok('Enter on Starten starts, Space on Stoppen stops, Enter on Entfernen asks', ran.join() === 'start,stop,remove', ran.join());

console.log('\nThe focus survives the bar going away');
btns[3].focus();
ok('Aufheben has the focus', doc.activeElement === btns[3]);
btns[3].dispatch('keydown', { key: 'Enter' });
ok('clearing hides the bar', bar.hidden);
ok('and the focus lands on the multi-select badge', doc.activeElement === badge, doc.activeElement && doc.activeElement.className);
bulk.pick({ web: {} }); sync();
const other = node('span', 'x'); other.inDoc = true; other.focus();
bulk.pick({}); sync();
ok('a bar that hides while the focus is elsewhere leaves it there', doc.activeElement === other);

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
