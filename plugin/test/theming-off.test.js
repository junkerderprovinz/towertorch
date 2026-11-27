// With the master theming switch off, Unraid looks as if TowerTorch's look were not installed,
// while TowerTorch's own Docker controls keep working. What can quietly break it:
//   · a rule in docker.css that names Unraid's own markup (the tab strip, the title bar, the
//     action bar, the view toggle, the plugin icons) or ShipLog's, with no gate, so it applies
//     on every page the sheet loads on whatever the switch says
//   · a motion rule keyed on data-tt-motion alone, which header.js stamps whatever the switch says
//   · docker.js folding, relabelling or docking Unraid's action bar and hiding its view toggle
//     with theming off, or leaving it that way when the switch flips live
const fs = require('fs');
const path = require('path');
const { candidates, withUnraid, parseRules, DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(' || ch === '[') depth++; else if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map((x) => x.trim()).filter(Boolean);
}
// A TowerTorch token outside :not() ties a selector to TowerTorch's own markup or to a class the
// area scripts stamp only while theming is on. data-tt-motion and data-tt-shape do not count:
// header.js stamps them on every page whatever the switch says.
const owned = (sel) => /(\.|#)tt-|\[class\*="tt-"\]|\[data-tt-(?!motion|shape)|\.glim-|data-oled/.test(sel.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, ''));

console.log('\nNo sheet reaches Unraid\'s markup past the master switch');
{
  const sheets = fs.readdirSync(path.join(DIR, 'sheets')).filter((f) => f.endsWith('.css')).map((f) => 'sheets/' + f)
    .concat(['styles/docker.css', 'styles/maintenance.css', 'styles/give.css', 'styles/fortress-card.css']);
  for (const f of sheets) {
    const loose = [];
    for (const r of parseRules(read(f), f)) {
      if (r.decls.every((d) => d.prop.startsWith('--'))) continue;
      for (const s of splitTop(r.selector)) if (!owned(s)) loose.push(s);
    }
    ok(f + ': every rule on Unraid\'s markup waits for theming', loose.length === 0, loose.slice(0, 6).join(' | ') + (loose.length > 6 ? ' (+' + (loose.length - 6) + ')' : ''));
  }
}

console.log('\nThe Docker and Plugins pages stay native with theming off');
{
  const on = ['tt-popups-on', 'tt-docker-on', 'tt-on-plugins', 'tt-header-on'];
  const off = [];
  const reach = (el, prop) => candidates(withUnraid('docker'), el, prop).filter((c) => c.sheet !== 'unraid default-base.css');
  const cases = [
    ['the tab button', (h) => ({ tag: 'button', classes: [], attrs: { role: 'tab', 'aria-selected': 'true' }, html: h, inside: ['.tabs-container'] }), 'background'],
    ['the radio tab of the Plugins page', (h) => ({ tag: 'label', classes: [], attrs: {}, html: h, inside: ['.tabbed'] }), 'border-radius'],
    ['the title bar', (h) => ({ tag: 'div', classes: ['title'], attrs: {}, html: h }), 'background'],
    ['the Basic/Advanced view toggle', (h) => ({ tag: 'div', classes: ['ToggleViewMode'], attrs: {}, html: h }), 'display'],
    ['the action bar', (h) => ({ tag: 'div', classes: ['js-actions'], attrs: {}, html: h }), 'position'],
    ['a native button in the action bar', (h) => ({ tag: 'input', classes: [], attrs: { type: 'button' }, html: h, inside: ['.js-actions'] }), 'background'],
    ['a plugin icon', (h) => ({ tag: 'img', classes: ['list'], attrs: {}, html: h, inside: ['#plugin_list'] }), 'width'],
    ['Unraid\'s check-for-updates button on /Plugins', (h) => ({ tag: 'span', classes: ['status', 'vhshift'], id: 'checkall', attrs: {}, html: h, inside: ['.tabs-container'] }), 'margin-right'],
    ['ShipLog\'s update-all pill', (h) => ({ tag: 'a', classes: ['sl-updall'], attrs: {}, html: h }), 'display'],
    ['ShipLog\'s update button', (h) => ({ tag: 'a', classes: ['sl-upd'], attrs: {}, html: h, inside: ['.sl-bubble'] }), 'background'],
  ];
  for (const [name, make, prop] of cases) {
    const offHits = reach(make(off), prop);
    ok(name + ' keeps Unraid\'s ' + prop + ' with theming off', offHits.length === 0, offHits.map((c) => c.sheet + ' ' + c.selector).slice(0, 3).join(' | '));
    ok(name + ' still takes TowerTorch\'s ' + prop + ' with theming on', reach(make(on), prop).length > 0);
  }
  const own = (h) => ({ tag: 'span', classes: ['tt-maintbtn'], attrs: { role: 'button' }, html: h, inside: ['.js-actions'] });
  ok('TowerTorch\'s own button in the bar keeps its look with theming off', reach(own(off), 'background').length > 0);
}

console.log('\nThe motion engine leaves Unraid\'s menu alone with theming off');
{
  const reach = (el, prop) => candidates('every', el, prop);
  const item = (h) => ({ tag: 'div', classes: ['nav-item'], attrs: {}, states: { hover: true }, html: h, inside: ['#menu', '.nav-tile'] });
  ok('a menu item does not bounce', reach(item([]), 'animation').length === 0, reach(item([]), 'animation').map((c) => c.selector).join(' | '));
  ok('it bounces with theming on at the wild level', reach(item(['tt-popups-on']), 'animation').length > 0);
  const nav = (h) => ({ tag: 'div', classes: ['sidenav', 'sidenavShow'], attrs: {}, html: h });
  ok('Unraid\'s info drawer does not slide in', reach(nav([]), 'animation').length === 0);
}

// A small element: enough of the DOM for foldBar and unfoldBar.
class El {
  constructor(tag, cls) { this.tag = tag; this.className = cls || ''; this.attrs = {}; this.kids = []; this.parentElement = null; this.listeners = {}; this.value = ''; this.disabled = false; this.textContent = ''; }
  get classList() { const self = this; return { add: (...cs) => cs.forEach((c) => { if (!self.has(c)) self.className = (self.className + ' ' + c).trim(); }), remove: (...cs) => { self.className = self.className.split(/\s+/).filter((x) => x && !cs.includes(x)).join(' '); }, contains: (c) => self.has(c) }; }
  has(c) { return this.className.split(/\s+/).includes(c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { this.listeners[t] = f; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    if (c.parentElement) c.parentElement.kids.splice(c.parentElement.kids.indexOf(c), 1);
    const i = ref ? this.kids.indexOf(ref) : -1;
    if (i < 0) this.kids.push(c); else this.kids.splice(i, 0, c);
    c.parentElement = this; return c;
  }
  remove() { if (this.parentElement) { this.parentElement.kids.splice(this.parentElement.kids.indexOf(this), 1); this.parentElement = null; } }
  all() { return this.kids.flatMap((k) => [k].concat(k.all())); }
  matches(sel) {
    return splitTop(sel).some((s) => {
      let m = /^input\[type=button\]\[onclick\^="(\w+)\("\]$/.exec(s);
      if (m) return this.tag === 'input' && (this.attrs.onclick || '').startsWith(m[1] + '(');
      m = /^(\w*)\.([-\w]+)$/.exec(s); if (m) return (!m[1] || this.tag === m[1]) && this.has(m[2]);
      m = /^(\w*)\[([-\w]+)\]$/.exec(s); if (m) return (!m[1] || this.tag === m[1]) && m[2] in this.attrs;
      throw new Error('unexpected selector ' + s);
    });
  }
  querySelectorAll(sel) { return this.all().filter((k) => k.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

console.log('\nUnraid\'s action bar stays as Unraid draws it with theming off');
{
  const js = read('scripts/docker.js');
  const grab = (name) => {
    const i = js.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('function not found: ' + name);
    let d = 0;
    for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
    throw new Error('unbalanced function: ' + name);
  };
  const grabVar = (name) => new RegExp('var ' + name + ' = [^\\n]+;').exec(js)[0];
  const T = { allContainers: 'Alle Container', barAdd: 'Container hinzufügen', barCheck: 'Nach Aktualisierungen suchen', barUpdateAll: 'Alle aktualisieren', barSizes: 'Containergröße', bulkStartAll: 'Alle starten', bulkStopAll: 'Alle stoppen', bulkPauseAll: 'Alle pausieren', bulkResumeAll: 'Alle fortsetzen' };
  const UNRAID_DE = [['addContainer', 'Container hinzufügen'], ['startAll', 'Alle starten'], ['stopAll', 'Alle stoppen'], ['pauseAll', 'Alle pausieren'], ['resumeAll', 'Alle fortsetzen'], ['checkAll', 'Nach Aktualisierungen suchen'], ['updateAll', 'Alle Aktualisieren'], ['contSizes', 'Containergröße']];
  const b = new El('div', 'js-actions');
  for (const [fn, v] of UNRAID_DE) { const i = new El('input'); i.attrs.type = 'button'; i.attrs.onclick = fn + '()'; i.value = v; b.appendChild(i); }
  const adv = new El('span', 'tt-bar-adv'); adv.appendChild(new El('span', 'tt-bar-adv-lbl')); adv.appendChild(new El('span', 'tt-set-toggle')); b.appendChild(adv);
  const env = { document: { documentElement: { lang: 'de' } }, window: { TTTheme: { menu() {} } } };
  let fns;
  try {
    fns = new Function('document', 'window', 'T', 'El',
      'var MARK = "data-tt"; function t(k) { return T[k]; } function el(tag, cls, txt) { var e = new El(tag, cls); if (txt) e.textContent = txt; return e; }\n' +
      grabVar('BAR_LABELS') + '\n' + grabVar('BAR_FOLD') + '\n' + grab('barNative') + '\n' + grab('ttLabelled') + '\n' + grab('foldBar') + '\n' + grab('unfoldBar') + '\nreturn { foldBar: foldBar, unfoldBar: unfoldBar };')(env.document, env.window, T, El);
  } catch (e) { ok('docker.js has an unfoldBar()', false, e.message); }
  if (fns) {
    fns.foldBar(b);
    ok('folded, Unraid\'s "Alle Aktualisieren" reads in sentence case', b.querySelector('input[type=button][onclick^="updateAll("]').value === 'Alle aktualisieren');
    fns.unfoldBar(b); fns.unfoldBar(b);
    const inputs = b.kids.filter((k) => k.tag === 'input');
    ok('every native button shows again', inputs.length === 8 && inputs.every((k) => !k.has('tt-folded') && !k.has('tt-bar-primary')), inputs.map((k) => k.className).join(','));
    ok('under Unraid\'s own labels', inputs.map((k) => k.value).join('|') === UNRAID_DE.map((x) => x[1]).join('|'), inputs.map((k) => k.value).join('|'));
    ok('the "Alle Container" menu and the replacement view switch are gone', !b.querySelector('.tt-allct') && !b.querySelector('.tt-bar-adv'));
    fns.foldBar(b);
    ok('switched back on, the bar folds again', b.querySelectorAll('.tt-folded').length === 4 && !!b.querySelector('.tt-allct'));
  }
  const relocate = grab('relocateTopBar');
  ok('relocateTopBar folds the bar and hides the view toggle only with theming on', /if \(themed\) \{ foldBar\(jsa\); ensureBarToggle\(jsa\); \} else unfoldBar\(jsa\);/.test(relocate) && /tv\.style\.removeProperty\("display"\)/.test(relocate), relocate.slice(0, 400));
  const dock = grab('syncFooterDock');
  ok('syncFooterDock leaves the bar in Unraid\'s flow with theming off', /if \(!themingOn\(\)\) \{[^}]*removeProperty/.test(dock), dock.slice(0, 300));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
