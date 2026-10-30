// The Docker tab's docked action bar (GlimStone rule 3 and "Page actions"): "Alle starten",
// "stoppen", "pausieren" and "fortsetzen" fold into one "Alle Container" menu, "Container
// hinzufügen" is the one filled button, and every label reads in sentence case. What can quietly
// break it:
//   · Unraid's uppercase transform on input[type=button] winning over CC's rule
//   · a folded native button showing again, since Unraid's loadlist() calls .show() on every one
//   · the menu calling a native button Unraid has disabled while an action runs
//   · CC's German or English labels written over another of Unraid's language packs
//   · a second filled button in the bar, or the filled one going grey in the reactive mode
const fs = require('fs');
const path = require('path');
const { candidates, withUnraid } = require('./cascade');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const js = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const grabVar = (name) => new RegExp('var ' + name + ' = [^\\n]+;').exec(js)[0];

// A small element: enough of the DOM for foldBar.
class El {
  constructor(tag, cls) { this.tag = tag; this.className = cls || ''; this.attrs = {}; this.kids = []; this.parentElement = null; this.listeners = {}; this.value = ''; this.disabled = false; this.clicks = 0; this.textContent = ''; }
  get classList() { const self = this; return { add: (c) => { if (!self.has(c)) self.className = (self.className + ' ' + c).trim(); }, contains: (c) => self.has(c) }; }
  has(c) { return this.className.split(/\s+/).includes(c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, f) { this.listeners[t] = f; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    if (c.parentElement) c.parentElement.kids.splice(c.parentElement.kids.indexOf(c), 1);
    const i = ref ? this.kids.indexOf(ref) : -1;
    if (i < 0) this.kids.push(c); else this.kids.splice(i, 0, c);
    c.parentElement = this; return c;
  }
  get firstChild() { return this.kids[0] || null; }
  get nextSibling() { const p = this.parentElement; return p ? p.kids[p.kids.indexOf(this) + 1] || null : null; }
  get previousElementSibling() { const p = this.parentElement; return p ? p.kids[p.kids.indexOf(this) - 1] || null : null; }
  click() { this.clicks++; }
  querySelector(sel) {
    let m = /^input\[type=button\]\[onclick\^="(\w+)\("\]$/.exec(sel);
    if (m) return this.kids.find((k) => k.tag === 'input' && (k.attrs.onclick || '').startsWith(m[1] + '(')) || null;
    if (sel === '.cc-allct') return this.kids.find((k) => k.has('cc-allct')) || null;
    throw new Error('unexpected selector ' + sel);
  }
}
function bar(lang, values) {
  const b = new El('div', 'js-actions');
  for (const [fn, v] of values) { const i = new El('input'); i.attrs.type = 'button'; i.attrs.onclick = fn + '()'; i.value = v; b.appendChild(i); }
  const menus = [];
  const T = { allContainers: 'Alle Container', barAdd: 'Container hinzufügen', barCheck: 'Nach Aktualisierungen suchen', barUpdateAll: 'Alle aktualisieren', barSizes: 'Containergröße', bulkStartAll: 'Alle starten', bulkStopAll: 'Alle stoppen', bulkPauseAll: 'Alle pausieren', bulkResumeAll: 'Alle fortsetzen' };
  const env = {
    document: { documentElement: { lang } },
    window: { CCTheme: { menu: (anchor, items) => menus.push(items) } },
  };
  const fold = new Function('document', 'window', 'T', 'El',
    'var MARK = "data-cc"; function t(k) { return T[k]; } function el(tag, cls, txt) { var e = new El(tag, cls); if (txt) e.textContent = txt; return e; }\n' +
    grabVar('BAR_LABELS') + '\n' + grabVar('BAR_FOLD') + '\n' + grab('barNative') + '\n' + grab('ccLabelled') + '\n' + grab('foldBar') + '\nreturn foldBar;')(env.document, env.window, T, El);
  return { b, fold, menus };
}
const UNRAID_DE = [['addContainer', 'Container hinzufügen'], ['startAll', 'Alle starten'], ['stopAll', 'Alle stoppen'], ['pauseAll', 'Alle pausieren'], ['resumeAll', 'Alle fortsetzen'], ['checkAll', 'Nach Aktualisierungen suchen'], ['updateAll', 'Alle Aktualisieren'], ['contSizes', 'Containergröße']];

console.log('\nThe four run-everything buttons fold into one menu');
{
  const { b, fold, menus } = bar('de', UNRAID_DE);
  fold(b); fold(b);
  const vis = b.kids.filter((k) => !k.has('cc-folded'));
  ok('the four natives are folded away', b.kids.filter((k) => k.has('cc-folded')).map((k) => k.attrs.onclick).join(' ') === 'startAll() stopAll() pauseAll() resumeAll()');
  ok('one menu button sits right after "Container hinzufügen", however often the pass runs', vis[1] && vis[1].has('cc-allct') && b.kids.filter((k) => k.has('cc-allct')).length === 1, vis.map((k) => k.value || k.textContent).join(' | '));
  const btn = b.querySelector('.cc-allct');
  ok('it is a keyboard button that announces a menu', btn.attrs.role === 'button' && btn.attrs.tabindex === '0' && btn.attrs['aria-haspopup'] === 'menu');
  ok('"Container hinzufügen" is the primary button', b.kids[0].has('cc-bar-primary') && b.kids.filter((k) => k.has('cc-bar-primary')).length === 1);
  ok('Unraid\'s "Alle Aktualisieren" reads in sentence case', b.querySelector('input[type=button][onclick^="updateAll("]').value === 'Alle aktualisieren');
  btn.listeners.click({ preventDefault() {}, stopPropagation() {} });
  ok('a click opens the menu with the four actions', menus.length === 1 && menus[0].map((i) => i.label).join(', ') === 'Alle starten, Alle stoppen, Alle pausieren, Alle fortsetzen');
  menus[0][2].run();
  ok('an entry clicks its native button', b.querySelector('input[type=button][onclick^="pauseAll("]').clicks === 1);
  btn.listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
  ok('Arrow down opens it from the keyboard', menus.length === 2);
  b.querySelector('input[type=button][onclick^="stopAll("]').disabled = true;
  btn.listeners.keydown({ key: 'Enter', preventDefault() {} });
  ok('a native Unraid has disabled stays out of the menu', menus[2].map((i) => i.label).join(', ') === 'Alle starten, Alle pausieren, Alle fortsetzen');
  b.kids.forEach((k) => { if (k.tag === 'input') k.disabled = true; });
  fold(b);
  ok('while Unraid runs an action the menu button is disabled too', btn.attrs['aria-disabled'] === 'true');
  btn.listeners.click({ preventDefault() {}, stopPropagation() {} });
  ok('and opens nothing', menus.length === 3);
  b.kids.forEach((k) => { k.disabled = false; });
  fold(b);
  ok('it comes back with them', btn.attrs['aria-disabled'] === 'false');
}

console.log('\nLabels');
{
  const en = bar('en-US', [['addContainer', 'Add Container'], ['startAll', 'Start All'], ['checkAll', 'Check for Updates'], ['updateAll', 'Update All'], ['contSizes', 'Container Size']]);
  // English strings come from the table, so feed the English ones in.
  const T = { barAdd: 'Add container', barCheck: 'Check for updates', barUpdateAll: 'Update all', barSizes: 'Container size' };
  const enJs = /en: \{[^\n]*\}/.exec(js)[0];
  ok('the English table has every bar label in sentence case', Object.entries(T).every(([k, v]) => enJs.includes(k + ': "' + v + '"')));
  const deJs = /de: \{ uptodate[^\n]*\}/.exec(js)[0];
  ok('the German table has the menu and its entries', ['allContainers: "Alle Container"', 'bulkPauseAll: "Alle pausieren"', 'bulkResumeAll: "Alle fortsetzen"', 'barUpdateAll: "Alle aktualisieren"'].every((p) => deJs.includes(p)));
  ok('and so has the English one', ['allContainers: "All containers"', 'bulkPauseAll: "Pause all"', 'bulkResumeAll: "Resume all"'].every((p) => enJs.includes(p)));
  const fr = bar('fr', [['addContainer', 'Ajouter un conteneur'], ['startAll', 'Tout démarrer'], ['contSizes', 'Taille des conteneurs']]);
  fr.fold(fr.b);
  ok('another of Unraid\'s language packs keeps its own labels', fr.b.kids[0].value === 'Ajouter un conteneur' && fr.b.querySelector('input[type=button][onclick^="contSizes("]').value === 'Taille des conteneurs');
  fr.b.querySelector('.cc-allct').listeners.click({ preventDefault() {}, stopPropagation() {} });
  ok('and so do the menu entries', fr.menus[0][0].label === 'Tout démarrer');
  ok('the view switch reads in sentence case', /function advWord\(on\) \{ return on \? \(LANG === "de" \? "Erweiterte Ansicht" : "Advanced view"\) : \(LANG === "de" \? "Einfache Ansicht" : "Basic view"\); \}/.test(js) && !/EINFACHE ANSICHT|BASIC VIEW/.test(js));
  ok('relocateTopBar folds the bar on every pass', /foldBar\(jsa\);\n\s*ensureBarToggle\(jsa\);/.test(js));
}

console.log('\nThe sheet');
{
  const html = ['cc-docker-on', 'cc-popups-on', 'cc-header-on'];
  const reactive = html.concat(['cc-shares-rbneutral']);
  const win = (el, prop) => { const c = candidates(withUnraid('docker'), el, prop); return c[c.length - 1]; };
  // The bar sits outside CA's install panel, the user list and CC's windows, whose button rules the
  // helper cannot rule out by itself.
  const away = ['.multi_installDiv', '#displaybox', '.cc-pop', '.cc-win', '#cc-settings'];
  const input = (cls, h, states) => ({ tag: 'input', classes: cls, attrs: { type: 'button' }, states: states || {}, html: h, inside: ['.js-actions'], outside: away });
  const span = (cls, h, states) => ({ tag: 'span', classes: cls, attrs: { role: 'button', tabindex: '0' }, states: states || {}, html: h, inside: ['.js-actions'], outside: away });
  for (const [n, e] of [['a native button', input([], html)], ['the menu button', span(['cc-allct'], html)], ['the multi-select badge', span(['cc-bulkmode-badge'], html)]]) {
    const tt = win(e, 'text-transform');
    ok(n + ' keeps its sentence case against Unraid\'s uppercase', !!tt && tt.value === 'none' && tt.important, tt && tt.selector);
    const ls = win(e, 'letter-spacing');
    ok(n + ' drops the tracking', !!ls && ls.value === 'normal');
  }
  const CHAIN = 'var(--cc-rb-c, var(--cc-rbaccent, var(--cc-accent, #FCC419)))';
  const bg = (e) => { const c = candidates(withUnraid('docker'), e, 'background').concat(candidates(withUnraid('docker'), e, 'background-color')); c.sort((a, b) => (a.important - b.important) || (a.spec[0] - b.spec[0]) || (a.spec[1] - b.spec[1]) || (a.spec[2] - b.spec[2]) || (a.order - b.order)); return c[c.length - 1]; };
  ok('"Container hinzufügen" is filled with the colour chain', bg(input(['cc-bar-primary'], html)).value === CHAIN);
  ok('and stays filled in the reactive mode', bg(input(['cc-bar-primary'], reactive)).value === CHAIN, bg(input(['cc-bar-primary'], reactive)).selector);
  ok('every other button rests grey', /^var\(--cc-surface-3/.test(bg(input([], html)).value) && /^var\(--cc-surface-3/.test(bg(span(['cc-allct'], html)).value));
  ok('and takes the mode colour under the pointer', bg(input([], html, { hover: true })).value === CHAIN && bg(span(['cc-allct'], html, { hover: true })).value === CHAIN);
  const d = win(input(['cc-folded'], html), 'display');
  ok('a folded native stays hidden whatever Unraid\'s .show() writes inline', !!d && d.value === 'none' && d.important);
}

console.log('\nThe bar that appears once rows are picked');
{
  const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');
  const island = /^\.cc-pop, \.cc-menu, \.cc-win, \.cc-rowmenu[^{]*\{/m.exec(tokens);
  ok('it floats as a dark window on every theme, so its count stays readable on white', !!island && /\.cc-bulkbar\b/.test(island[0]), island && island[0]);
  const win = (el, prop) => { const c = candidates(withUnraid('docker'), el, prop); return c[c.length - 1]; };
  const bar = { tag: 'div', classes: ['cc-bulkbar'], html: ['cc-docker-on', 'Theme--white'] };
  ok('its ground is the window surface', /^var\(--cc-surface-window/.test((win(bar, 'background') || {}).value || ''), (win(bar, 'background') || {}).value);
  const btn = (cls, states) => ({ tag: 'span', classes: ['cc-b', 'cc-bulkbtn'].concat(cls), attrs: { role: 'button', tabindex: '0' }, states: states || {}, inside: ['.cc-bulkbar'], html: ['cc-docker-on'] });
  for (const [n, e] of [['Starten', btn([])], ['Entfernen', btn(['cc-bulkbtn-del'])]]) {
    ok(n + ' reads in sentence case like the action bar', (win(e, 'text-transform') || {}).value === 'none' && (win(e, 'letter-spacing') || {}).value === 'normal');
    ok(n + ' rests grey', /^var\(--cc-surface-3/.test((win(e, 'background') || {}).value || ''), (win(e, 'background') || {}).value);
    const hb = (win(btn(e.classes.slice(2), { hover: true }), 'background') || {}).value || '';
    ok(n + ' takes its own palette slot or the accent under the pointer, never the area\'s rainbow accent', hb === 'var(--cc-rb-c, var(--cc-accent, #FCC419)) !important' || hb === 'var(--cc-rb-c, var(--cc-accent, #FCC419))', hb);
  }
  const sync = grab('ccBulkBarSync');
  ok('Entfernen is marked as the delete, so the palette passes its red on', /"cc-b cc-bulkbtn cc-bulkbtn-del"/.test(sync));
  ok('the slots are stamped each time the bar shows, through the delete-aware palette', /colorBulkButtons\(ccBulkBarEl\)/.test(sync) && /deleteSlot/.test(grab('colorBulkButtons')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
