// The settings search matches the explanations in the bubbles as well as the visible text, shows
// an empty state when nothing matches, and opens with "/". Ctrl+K stays with the command palette.
// The search and the "Open" button are secondary, since a view has one filled accent button.
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
const settings = read('scripts/settings.js');
const header = read('scripts/header.js');

// A row: its visible text and the bubble texts on it and inside it.
class Row {
  constructor(text, tips, own) { this.textContent = text; this.tips = tips || []; this.own = own || null; this.style = { display: '', setProperty(k, v) { this[k] = v; }, removeProperty(k) { this[k] = ''; } }; }
  getAttribute(k) { return k === 'data-tip' ? this.own : null; }
  querySelectorAll() { return this.tips.map((t) => ({ getAttribute: () => t })); }
}
class Card {
  constructor(title, rows) { this.h = new Row(title); this.rows = rows; this.style = new Row('').style; }
  querySelector() { return this.h; }
  querySelectorAll() { return this.rows; }
}

console.log('\nBubble texts are searched too');
const searchText = new Function(grabFn(settings, 'searchText') + '\nreturn searchText;')();
ok('a word only in a bubble inside the row is found', /reloads the page/.test(searchText(new Row('Backup & transfer', ['Import writes them back and reloads the page.']))));
ok('a bubble on the row itself counts', /#fcc419/.test(searchText(new Row('', [], '#FCC419'))));
ok('the visible text still counts', /density/.test(searchText(new Row('Density'))));

console.log('\nThe filter and its empty state');
{
  const cards = [
    new Card('Theming', [new Row('Theming on'), new Row('Motion', ['Off: nothing moves. Wild: main-bar tabs hop on hover.'])]),
    new Card('Notifications', [new Row('Unraid notifications'), new Row('Webhook URL')])
  ];
  const empty = { style: { display: 'none' } }, hint = { textContent: '' };
  const tile = { cls: new Set(['cc-set-tab-on']), attrs: {}, classList: { remove(c) { tile.cls.delete(c); } }, setAttribute(k, v) { tile.attrs[k] = v; } };
  let restored = 0;
  const env = {
    root: { querySelectorAll: (sel) => sel === '.cc-set-card' ? cards : [] },
    tabBtns: [tile], SECS: [{ w: { style: {} } }], searchEmpty: empty, emptyHint: hint,
    T: (d, e) => e, searchText, restore: () => { restored++; }
  };
  const runFilter = new Function('env', 'with (env) { ' + grabFn(settings, 'runFilter') + '\nreturn runFilter; }')(env);
  runFilter('hop');
  ok('no tile stays chosen while the matches come from every tab', !tile.cls.has('cc-set-tab-on') && tile.attrs['aria-selected'] === 'false');
  ok('a card whose bubble matches stays', cards[0].style.display === '' && cards[0].rows[1].style.display === '');
  ok('its other rows go', cards[0].rows[0].style.display === 'none');
  ok('a card with no match goes', cards[1].style.display === 'none');
  ok('no empty state while something matches', empty.style.display === 'none');
  runFilter('zebra');
  ok('nothing matching shows the empty state', empty.style.display === '');
  ok('which names the query', /zebra/.test(hint.textContent));
  runFilter('  ');
  ok('an empty query restores the tabs', restored === 1);
  const restore = grabFn(settings, 'restore');
  ok('restoring hides the empty state again', /searchEmpty\.style\.display = "none";/.test(restore));
  ok('the empty state is no card, so it never takes a rainbow position or a filter pass', /el\("div", "cc-set-empty"\)/.test(settings) && !/"cc-set-card cc-set-empty"/.test(settings));
}

console.log('\nOpening and closing');
{
  ok('"/" opens the search', /if \(e\.key !== "\/" \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return;/.test(settings));
  ok('but not while typing in a field', /if \(tag === "INPUT" \|\| tag === "TEXTAREA" \|\| tag === "SELECT" \|\| \(t && t\.isContentEditable\)\) return;/.test(settings));
  ok('the key is bound once', /if \(!window\.__ccSetSearchKey\) \{/.test(settings));
  ok('Ctrl+K stays with the command palette', /e\.key === "k" \|\| e\.key === "K"/.test(header) && !/e\.key === "k"|e\.key === "K"/.test(settings));
  ok('Escape clears first and closes on a second press', /if \(setSearch\.value\) \{ setSearch\.value = ""; runFilter\(""\); \} else \{ searchBadge\.classList\.remove\("cc-open"\); setSearch\.blur\(\); \}/.test(settings));
  ok('closing the badge resets the filter', /setSearch\.value = ""; runFilter\(""\); \} \}\);/.test(settings) && !/typeof runFilter/.test(settings));
}

console.log('\nOne filled accent button per view');
{
  const badge = (/"#cc-settings \.cc-set-searchbadge\{([^}]*)\}"/.exec(settings) || [])[1] || '';
  ok('the search rests grey', /background:#2e2e2e/.test(badge), badge);
  ok('"Open" is a plain secondary button', /el\("button", "cc-btn", T\("Öffnen", "Open"\)\)/.test(settings) && !/cc-btn-accent/.test(settings));
}

// Ctrl+K belongs to the command palette on every page. On the settings page the palette leads
// with this page's search, whatever was typed, and hands the query over.
console.log('\nCtrl+K reaches the settings search through the palette');
{
  const header = read('scripts/header.js');
  const grab = (name) => { const i = header.indexOf('function ' + name + '('); let d = 0; for (let k = header.indexOf('{', i); k < header.length; k++) { if (header[k] === '{') d++; else if (header[k] === '}') { d--; if (!d) return header.slice(i, k + 1); } } return ''; };
  const si = { value: '', focused: false, events: [], focus() { this.focused = true; }, dispatchEvent(e) { this.events.push(e.type); } };
  const sb = { cls: new Set(), classList: { add: (c) => sb.cls.add(c) }, querySelector: () => si };
  const row = () => { const parts = {}; return { className: '', set innerHTML(v) {}, querySelector: (s) => (parts[s] = parts[s] || { textContent: '' }), on: {}, addEventListener(t, f) { this.on[t] = f; }, parts }; };
  const list = { children: [], set innerHTML(v) { this.children = []; }, appendChild(r) { this.children.push(r); } };
  const input = { value: '' };
  const later = [];
  const doc = { querySelector: (s) => (s === '#cc-settings .cc-set-searchbadge' ? sb : null), querySelectorAll: () => [], createElement: row };
  const api = new Function('document', 'T', 'setTimeout', 'Event', 'ccToggleArrange', 'ccCmdClose', 'ccCmdMark', 'location',
    'var ccCmdInput, ccCmdList, ccCmdItems = [], ccCmdSel = 0;\n' + grab('ccCmdSources') + '\n' + grab('ccCmdRender') +
    '\nreturn function (inp, lst) { ccCmdInput = inp; ccCmdList = lst; ccCmdItems = ccCmdSources(); ccCmdRender(); };')(
    doc, (d, e) => e, (f) => later.push(f), function (t) { this.type = t; }, () => {}, () => {}, () => {}, {});
  input.value = 'webhook';
  api(input, list);
  const first = list.children[0];
  ok('a query that matches no page still shows the settings search first', !!first && first.parts['.cc-cmd-lbl'].textContent === 'Search the settings', first && first.parts['.cc-cmd-lbl'].textContent);
  ok('it names the query it will search for', first && first.parts['.cc-cmd-sub'].textContent === '“webhook”');
  if (first) first.on.click();
  ok('choosing it opens the search a tick later, past the click that chose it', later.length === 1 && !sb.cls.has('cc-open'));
  later.forEach((f) => f());
  ok('the search opens with the query, filters and takes the focus', sb.cls.has('cc-open') && si.value === 'webhook' && si.events.includes('input') && si.focused);
  const away = { querySelector: () => null, querySelectorAll: () => [], createElement: row };
  const lst2 = { children: [], set innerHTML(v) { this.children = []; }, appendChild(r) { this.children.push(r); } };
  new Function('document', 'T', 'ccToggleArrange', 'location', grab('ccCmdSources') + '\nreturn ccCmdSources;')(away, (d, e) => e, () => {}, {})().forEach((it) => lst2.appendChild(it));
  ok('on other pages the palette has no such entry', !lst2.children.some((it) => it.pinned));
}

// The cards start right below the main menu. The search has no row of its own: it opens above
// the cards and is gone again once it closes.
console.log('\nThe search takes room only while it is open');
{
  ok('no head row sits between the main menu and the cards', !/"cc-set-head"|"cc-set-hero"/.test(settings) && !/\.cc-set-head|\.cc-set-hero/.test(read('styles/docker.css')));
  ok('the search stands first in the cards\' column', /main\.appendChild\(searchBadge\);\s*\[wrapMain,/.test(settings));
  ok('a closed search is not shown', /"#cc-settings \.cc-set-searchbadge:not\(\.cc-open\)\{display:none\}"/.test(settings));
  ok('the palette and "/" still open it', /sb\.classList\.add\("cc-open"\)/.test(header) && /sb\.classList\.add\("cc-open"\); si\.focus\(\);/.test(settings));
}

// The empty state stands in for the cards, dark like them on every theme, and its two lines
// are text: both read at 4.5:1 on its own fill, whatever the theme.
console.log('\nThe empty state reads, on every theme');
{
  const { candidates, tokens, resolve, parseRules, DIR: D } = require('./cascade');
  const island = parseRules(fs.readFileSync(path.join(D, 'sheets/TowerTorch.Tokens.css'), 'utf8')).filter((r) => r.selector.replace(/\s+/g, ' ').startsWith('.cc-pop, .cc-menu'))[0];
  ok('it is a dark token island', !!island && /#cc-settings \.cc-set-empty/.test(island.selector));
  const lum = (h) => { const n = parseInt(h.slice(1), 16), l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const win = (light) => { const m = tokens(light); if (island && /#cc-settings \.cc-set-empty/.test(island.selector)) island.decls.forEach((d) => { if (d.prop.startsWith('--')) m[d.prop] = d.value; }); return m; };
  const val = (classes, prop, m) => { const c = candidates('settings', { tag: 'div', classes, attrs: {}, states: {}, inside: ['#cc-settings'] }, prop); return c.length ? resolve(c[c.length - 1].value, m) : ''; };
  for (const light of [false, true]) {
    const m = win(light), bg = val(['cc-set-empty'], 'background', m);
    for (const [what, cls] of [['the "nothing found" line', 'cc-set-empty-t'], ['the hint below it', 'cc-set-empty-h']]) {
      const fg = val([cls], 'color', m);
      const r = /^#[0-9a-f]{6}$/i.test(fg) && /^#[0-9a-f]{6}$/i.test(bg) ? ratio(fg, bg) : 0;
      ok(`${what} on a ${light ? 'light' : 'dark'} theme`, r >= 4.5, `${fg} on ${bg} = ${r.toFixed(2)}:1`);
    }
  }
  ok('no literal fill or ink is left on it', !/\.cc-set-empty\{[^}]*#[0-9a-f]{3,6}/i.test(settings) && !/\.cc-set-empty-[th]\{[^}]*#[0-9a-f]{3,6}/i.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
