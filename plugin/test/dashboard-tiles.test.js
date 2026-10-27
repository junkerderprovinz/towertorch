// The Dashboard tiles as GlimStone cards (TowerTorch.Dashboard.page, .css, dashboard.js).
// What can quietly break it:
//   · a rule that is not gated on html.cc-dash-on restyles the Dashboard with the header area off
//   · a block display with !important on a tile or row beats Unraid's inline display:none, so a
//     tile the person closed or a folded row comes back
//   · a stroked drawing slipping in among the filled tile glyphs
//   · the charts staying in the accent after the area is switched off
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
// Splits a selector list at its top-level commas, leaving the ones inside :is() and :not().
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = read('sheets/TowerTorch.Dashboard.css');
const js = read('scripts/dashboard.js');
const page = read('TowerTorch.Dashboard.page');

// Selectors of every rule, @media blocks unwrapped.
function selectors(sheet) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].trim(); if (!s.startsWith('@')) out.push([s.replace(/^@media[^{]*\{/, '').trim(), m[2]]); }
  return out;
}

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:\d+"/m.test(page));
ok('it renders no icon', /^Link="cc-dash-hook"/m.test(page));
ok('it loads dashboard.js', /scripts\/dashboard\.js/.test(page));

console.log('\nEvery rule waits for html.cc-dash-on');
{
  const rules = selectors(css);
  ok('the sheet has rules', rules.length > 20, rules.length);
  const loose = [];
  for (const [sel] of rules) for (const part of splitTop(sel)) if (!/html\.cc-dash-on/.test(part)) loose.push(part.trim());
  ok('no selector applies without the gate', loose.length === 0, loose.slice(0, 4).join(' | '));
}

console.log('\nUnraid keeps hiding tiles and rows');
{
  const rules = selectors(css);
  const tile = rules.find(([s]) => s === 'html.cc-dash-on table.dashboard > tbody');
  ok('a tile is a block without !important, so an inline display:none still wins', !!tile && /display:\s*block;/.test(tile[1]) && !/display:\s*block\s*!important/.test(tile[1]), tile && tile[1]);
  const row = rules.find(([s]) => /> tbody > tr:not\(\[style\*="none"\]\)/.test(s));
  ok('the forced row display skips every row whose inline style hides it', !!row && /display:\s*block !important/.test(row[1]), row && row[0]);
  ok('nothing else forces a display with !important on a row or tile', !rules.some(([s, b]) => s !== (row && row[0]) && /(tbody|> tr)\s*$/.test(s) && /display:[^;]*!important/.test(b)));
  const cell = rules.find(([s]) => s === 'html.cc-dash-on table.dashboard > tbody > tr > td');
  ok('a cell is a flow root, so the floated columns inside it stay inside the card', !!cell && /display:\s*flow-root/.test(cell[1]), cell && cell[1]);
}

console.log('\nThe tile glyphs are filled');
{
  const start = js.indexOf('var P = {'), end = js.indexOf('\n  };', start);
  const P = new Function('return ' + js.slice(start + 'var P = '.length, end + 4) + ';')();
  const names = Object.keys(P);
  ok('there is a drawing for every icon the map names', /var BY_ICON = \{[\s\S]*?\};/.test(js) && [...js.match(/var BY_ICON = \{([\s\S]*?)\};/)[1].matchAll(/: "(\w+)"/g)].every((m) => m[1] === 'log' || names.includes(m[1])));
  for (const n of names) ok(n + ': paths only, never stroked', !/stroke/.test(P[n]) && !/fill="none"/.test(P[n]) && /^(<path d="[^"]+"\/>)+$/.test(P[n]), P[n].slice(0, 60));
  ok('the glyph svg draws in currentColor on a square box', /viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"/.test(js));
}

// A minimal browser around dashboard.js: no tiles, two Smoothie charts, localStorage as a map.
function run(store, dom = {}) {
  const classes = new Set();
  const listeners = {};
  const chart = (strokes) => ({
    options: { grid: { strokeStyle: '#2b2b2b', verticalSections: 4, borderVisible: true, millisPerLine: 5000 }, labels: { fillStyle: '#f2f2f2' } },
    seriesSet: strokes.map((s) => ({ options: { strokeStyle: s, lineWidth: 1, fillToBottom: true } })),
  });
  const win = {
    cpuchart: chart(['#ff8c2f']), netchart: chart(['#e22828', '#ff8c2f']),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const ctx = {
    window: win, location: { pathname: '/Dashboard' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null) },
    setTimeout: () => 0, clearTimeout: () => {},
    getComputedStyle: () => ({ getPropertyValue: (p) => (p === '--cc-accent' ? ' #1f9d55' : p === '--cc-text-dim' ? '#8a8a8a' : p === '--cc-text' ? '#e6e6e6' : '') }),
    document: {
      readyState: 'complete',
      documentElement: { lang: 'de', classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } },
      querySelectorAll: dom.querySelectorAll || (() => []),
      querySelector: dom.querySelector || (() => null),
      getElementById: () => null,
      addEventListener: () => {},
    },
  };
  if (dom.CCTheme) win.CCTheme = ctx.CCTheme = dom.CCTheme;
  vm.runInNewContext(js, ctx);
  return { classes, win, fire: () => (listeners.storage || []).forEach((f) => f({ key: 'cc.enable.header' })) };
}

console.log('\nThe area switch');
{
  const on = run({ 'cc.enable.header': '1' });
  ok('with the header area on the Dashboard is marked', on.classes.has('cc-dash-on'));
  const off = run({ 'cc.enable.header': '0' });
  ok('with it off it stays native', !off.classes.has('cc-dash-on'));
  const master = run({ 'cc.enable.header': '1', 'cc.theming': '0' });
  ok('master theming off wins', !master.classes.has('cc-dash-on'));
}

console.log('\nThe charts follow the area');
{
  const store = { 'cc.enable.header': '1' };
  const r = run(store);
  const cpu = r.win.cpuchart, net = r.win.netchart;
  ok('the CPU line is the accent', cpu.seriesSet[0].options.strokeStyle === '#1f9d55', cpu.seriesSet[0].options.strokeStyle);
  ok('the grid is gone', cpu.options.grid.strokeStyle === 'transparent' && cpu.options.grid.verticalSections === 0 && cpu.options.grid.borderVisible === false);
  ok('inbound takes the accent and outbound the text colour, unfilled', net.seriesSet[0].options.strokeStyle === '#1f9d55' && net.seriesSet[1].options.strokeStyle === '#e6e6e6' && net.seriesSet[1].options.fillStyle === undefined, net.seriesSet[1].options.strokeStyle);
  store['cc.enable.header'] = '0';
  r.fire();
  ok('switched off, the area class goes', !r.classes.has('cc-dash-on'));
  ok('and the charts get their own colours and grid back', cpu.seriesSet[0].options.strokeStyle === '#ff8c2f' && net.seriesSet[0].options.strokeStyle === '#e22828' && cpu.options.grid.strokeStyle === '#2b2b2b' && cpu.options.grid.verticalSections === 4);
}

// A stand-in element: classes, attributes and the few calls dashboard.js makes on a control.
function fake(tag, cls, attrs = {}, kids = []) {
  const set = new Set(cls.split(' ').filter(Boolean)), at = { ...attrs };
  return {
    tagName: tag, html: '', listeners: 0, set,
    classList: { contains: (c) => set.has(c), add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, on) => (on ? set.add(c) : set.delete(c)) },
    hasAttribute: (n) => n in at, getAttribute: (n) => (n in at ? at[n] : null), setAttribute: (n, v) => { at[n] = String(v); }, removeAttribute: (n) => { delete at[n]; },
    querySelector: (sel) => kids.find((k) => (sel === 'i.fa' ? k.set.has('fa') : /title/.test(sel) && (k.hasAttribute('title') || k.hasAttribute('data-cc-tip')))) || null,
    querySelectorAll: () => [], insertAdjacentHTML(_, h) { this.html += h; }, addEventListener() { this.listeners++; },
    style: { setProperty() {}, removeProperty() {} },
  };
}

console.log('\nThe server card names the server once');
{
  const dup = (name, desc) => {
    const span = fake('SPAN', ''); span.id = ''; span.textContent = desc;
    const h = { textContent: name, nextElementSibling: span };
    run({ 'cc.enable.header': '1' }, { querySelector: (s) => (/tbody\.system h3/.test(s) ? h : null) });
    return span.set.has('cc-dash-dup');
  };
  ok('a description that repeats the name is dropped', dup('Bottich', ' Bottich '));
  ok('in any letter case', dup('Bottich', 'BOTTICH'));
  ok('a description of its own stays', !dup('Bottich', 'Medienserver im Keller'));
  ok('an empty one is left alone', !dup('Bottich', ''));
  ok('the dropped description is hidden by the sheet', selectors(css).some(([s, b]) => /\.cc-dash-dup$/.test(s) && /display:\s*none/.test(b)));
}

console.log('\nThe tile controls are CC icon badges');
{
  const gearIcon = fake('I', 'fa fa-fw fa-cog control', { title: 'Gehe zu den Identifikations-Einstellungen' });
  const gear = fake('A', '', { href: '/Dashboard/Settings/Identification' }, [gearIcon]);
  const stop = fake('SPAN', 'fa fa-fw fa-stop-circle hand', { title: 'Array stoppen', onclick: 'StopArray()' });
  const busy = fake('SPAN', 'fa fa-fw fa-stop-circle busy', { title: 'Array stoppen' });
  const off = fake('SPAN', 'fa fa-fw fa-power-off hand', { title: 'Shutdown the system', onclick: 'Shutdown()' });
  const fold = fake('I', 'fa fa-fw fa-chevron-down control openclose', { title: 'Inhalt ein/ausblenden' });
  const plugin = fake('SPAN', 'fa fa-fw fa-fire hand', { title: 'FireSquire' });
  const all = [gear, stop, busy, off, fold, plugin];
  const store = { 'cc.enable.header': '1' };
  const r = run(store, {
    querySelectorAll: (s) => (/tile-ctrl/.test(s) ? all : /cc-dash-btn/.test(s) ? all.filter((b) => b.set.has('cc-dash-btn')) : []),
    CCTheme: { glyph: (n) => '<svg class="cc-glyph" data-n="' + n + '"></svg>' },
  });
  ok('each control is marked as a CC icon badge', all.every((b) => b.set.has('cc-actbtn') && b.set.has('cc-dash-btn')));
  ok('the power off badge is named in plain German', off.getAttribute('data-cc-tip') === 'Herunterfahren' && off.getAttribute('aria-label') === 'Herunterfahren');
  ok('the gear says where it leads, and its icon gives up the text a bubble would find first', gear.getAttribute('data-cc-tip') === 'Identifikation bearbeiten' && !gearIcon.hasAttribute('title'));
  ok('the fold arrow says what a press does', fold.getAttribute('data-cc-tip') === 'Karte ausklappen');
  ok('a plugin control keeps its own name', plugin.getAttribute('data-cc-tip') === 'FireSquire');
  ok('the glyphs come from the set where it has the meaning', /data-n="Stop"/.test(stop.html) && /data-n="Power"/.test(off.html) && /data-n="Gear"/.test(gear.html) && plugin.html === '' && fold.html === '');
  ok('a span control is reachable and pressable by keyboard', stop.getAttribute('role') === 'button' && stop.getAttribute('tabindex') === '0' && stop.listeners === 1);
  ok('Unraid keeps its handlers', stop.getAttribute('onclick') === 'StopArray()' && off.getAttribute('onclick') === 'Shutdown()');
  ok('a busy control rests greyed and takes no focus', busy.set.has('cc-actoff') && busy.getAttribute('aria-disabled') === 'true' && !busy.hasAttribute('tabindex'));
  store['cc.enable.header'] = '0';
  r.fire();
  ok('switched off, every control is Unraid\'s again', all.every((b) => !b.set.has('cc-dash-btn') && !b.set.has('cc-actbtn') && !b.hasAttribute('data-cc-tip') && !b.hasAttribute('role')));
  ok('with Unraid\'s own hover text back in place', gearIcon.getAttribute('title') === 'Gehe zu den Identifikations-Einstellungen' && stop.getAttribute('title') === 'Array stoppen');
}

console.log('\nThe badges and their corner in the sheet');
{
  const rules = selectors(css);
  const badge = rules.find(([s]) => s === 'html.cc-dash-on table.dashboard .cc-dash-btn');
  ok('a badge has the one icon badge size', !!badge && /width: var\(--cc-icon-badge, 26px\)/.test(badge[1]) && /height: var\(--cc-icon-badge, 26px\)/.test(badge[1]));
  ok('it is filled in the colour mode', !!badge && /background: var\(--cc-rb-c, var\(--cc-accent/.test(badge[1]));
  ok('the reactive mode rests it grey until the tile has the pointer or the focus', rules.some(([s]) => /cc-header-rbneutral table\.dashboard > tbody:not\(:hover, :focus-within\) \.cc-dash-btn/.test(s)));
  const corner = rules.find(([s]) => /tbody\.system:not\(:has\(\.openclose\.fa-chevron-down\)\) \.tile-ctrl/.test(s));
  ok('the power controls stand in the bottom right corner while the card is open', !!corner && /position: absolute/.test(corner[1]) && /bottom:/.test(corner[1]) && /right:/.test(corner[1]));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
