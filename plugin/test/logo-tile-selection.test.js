// Picking rows and switching a setting are two different questions, and GlimStone gives each its
// own control. In the Docker list a row's logo tile is its selection: picked, it fills with the
// row's colour and shows a filled tick over the faded logo in that colour's ink. An on/off setting
// (the Startplan window's watchdog and idle rows, the badge-visibility matrix) is the switch.
// What can quietly break it:
//   · a separate selection mark or checkbox coming back beside the logo
//   · the tick's ink baked into the CSS, so it vanishes on a light palette slot
//   · a tile background rule (logo background, rainbow, reactive) burying the picked fill
//   · a plain click on the tile picking while multi-select is off, which takes the click away
//     from pointing at the row's actions
//   · Ctrl and Shift on a row doing nothing, or a Shift range that ignores the list's order or the
//     rows a filter hides (GlimStone, "Lists")
//   · the tile out of reach for the keyboard, or without a halo when it has the focus
const fs = require('fs');
const path = require('path');
const { candidates, withUnraid, cmp } = require('./cascade');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rule(css, sel) {
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  const out = [];
  while ((m = re.exec(css))) if (m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const docker = clean(read('styles/docker.css'));
const js = read('scripts/docker.js');
const CHAIN = 'var(--tt-rb-c, var(--tt-rbaccent, var(--tt-accent, #FCC419)))';
const INK = 'var(--tt-rb-ct, var(--tt-rbaccent-text, var(--tt-accent-text, #161616)))';
const grab = (name) => { const i = js.indexOf('function ' + name + '('); if (i < 0) throw new Error(name); let d = 0; for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } } return ''; };

console.log('\nThe logo tile is the selection');
{
  ok('no separate selection mark is built', !/tt-bulk-cb/.test(js) && !/tt-bulk-cb/.test(docker));
  ok('the tile is Unraid\'s own span.hand, so no new cell shifts the columns', /var tile = nameCell && nameCell\.querySelector\("\.outer > span\.hand"\);/.test(js));
  ok('it is a checkbox to assistive tech, named for its container, with a tab stop',
    /tile\.classList\.add\("tt-pick"\); tile\.setAttribute\("role", "checkbox"\); tile\.setAttribute\("tabindex", "0"\);/.test(js) &&
    /tile\.setAttribute\("aria-label", \(LANG === "de" \? "Auswählen: " : "Select "\) \+ name\);/.test(js));
  ok('its state is aria-checked, kept on every pass', /tile\.setAttribute\("aria-checked", ttBulkSel\[name\] \? "true" : "false"\);/.test(js));
  ok('Space picks it, Shift and Space a range, and its key handler is added once', /if \(!tile\.ttPickKeys\) \{/.test(js) && /if \(e\.key !== " " \|\| !tile\.classList\.contains\("tt-pick"\)\) return;/.test(js) && /ttBulkClick\(row, \{ shiftKey: e\.shiftKey \}\)/.test(js));
  ok('taking TowerTorch away gives Unraid its span.hand back', /querySelectorAll\("\.tt-pick"\)\)\.forEach\(function \(n\) \{ n\.classList\.remove\("tt-pick"\); \["role", "tabindex", "aria-label", "aria-checked"\]/.test(grab('clearRowBadges')));
}

console.log('\nPicked, it fills and shows the tick');
{
  const fill = rule(docker, 'html td.ct-name span.tt-pick[aria-checked="true"]::before');
  ok('the fill is the row\'s colour chain', fill.includes('background: ' + CHAIN), fill);
  const tick = rule(docker, 'html td.ct-name span.tt-pick[aria-checked="true"]::after');
  ok('the tick is painted in the chain\'s ink', tick.includes('background: ' + INK), tick);
  const tickMask = (/:root \{ --tt-tick-mask: (url\("[^"]+"\)); \}/.exec(docker) || [])[1] || '';
  ok('the tick is GlimStone\'s filled IconCheck, as a mask', /^url\("data:image\/svg\+xml;utf8,<svg [^"]*viewBox='0\.3 0\.549 13\.399 13\.399'><path d='M4\.381 12\.219 /.test(tickMask) && !/stroke/.test(tickMask) && /-webkit-mask: var\(--tt-tick-mask\)/.test(tick) && /\bmask: var\(--tt-tick-mask\)/.test(tick));
  ok('it sits over the logo, the fill under it', /z-index: 2/.test(tick) && /z-index: 0/.test(rule(docker, 'html td.ct-name span.tt-pick::before')) && /z-index: 1/.test(rule(docker, 'html td.ct-name span.tt-pick > :is(img, i)')));
  ok('the logo fades so the tick reads', /opacity: \.18/.test(rule(docker, 'html td.ct-name span.tt-pick[aria-checked="true"] > :is(img, i)')));
  ok('the corners follow the shape engine', /border-radius: var\(--tt-radius-control\)/.test(rule(docker, 'html td.ct-name span.tt-pick')));
  ok('a picked tile steps 15% toward the text colour on hover', rule(docker, 'html td.ct-name span.tt-pick[aria-checked="true"]:hover::before').includes('color-mix(in srgb, ' + CHAIN + ' 85%, var(--tt-text, #e6e6e6))'));
  ok('while tiles pick, an unpicked one takes the hover wash', /background: var\(--tt-hover-wash\)/.test(rule(docker, 'html:is(.tt-bulkmode-on, .tt-bulk-picked) td.ct-name span.tt-pick:hover::before')));
  // The pseudo-elements carry the paint, so the tile backgrounds that stamp span.hand cannot bury
  // it: no other sheet draws on span.hand's ::before or ::after.
  const page = withUnraid('docker');
  const bare = page.map((f) => ({ name: typeof f === 'object' ? f.name : f, css: (typeof f === 'object' ? f.css : read(f)).replace(/::?(before|after)\b/g, (m, p) => '.tt-pe-' + p) }));
  const html = ['tt-docker-on', 'tt-popups-on', 'tt-enh', 'tt-tools-on', 'tt-shares-on', 'tt-header-on', 'tt-shares-rbneutral', 'tt-rb-on', 'tt-actbar-hot'];
  for (const pe of ['before', 'after']) {
    const el = { tag: 'span', classes: ['hand', 'tt-pick', 'tt-pe-' + pe], attrs: { role: 'checkbox', tabindex: '0', 'aria-checked': 'true' }, states: { hover: true }, html, inside: ['#docker_list', '.tt-enh', '.tt-docker-iconbg', '.ct-name', '.outer'], outside: ['.tt-loader'] };
    const all = candidates(bare, el, 'background').concat(candidates(bare, el, 'background-color'));
    const foreign = all.filter((r) => /\.tt-pe-/.test(r.selector) && !/span\.tt-pick/.test(r.selector));
    ok('nothing else paints the tile\'s ::' + pe, foreign.length === 0, foreign.map((r) => r.sheet + ': ' + r.selector).join(' | '));
  }
}

console.log('\nThe keyboard reaches it');
{
  const page = withUnraid('docker');
  for (const html of [['tt-docker-on', 'tt-shares-on', 'tt-popups-on', 'tt-header-on'], ['tt-docker-on', 'tt-shares-on', 'tt-popups-on', 'tt-header-on', 'tt-shares-rbneutral', 'Theme--white', 'tt-vms-on']]) {
    const el = { tag: 'span', classes: ['hand', 'tt-pick'], attrs: { role: 'checkbox', tabindex: '0' }, states: { focus: true, 'focus-visible': true }, html, inside: ['#displaybox', '#docker_list', '.ct-name', '.outer'] };
    const all = candidates(page, el, 'box-shadow'), w = all[all.length - 1];
    ok('a focused tile shows the accent halo' + (html.includes('Theme--white') ? ' on white, reactive' : ''), !!w && /^0 0 0 3px color-mix\(in srgb, var\(--tt-accent, #FCC419\) 45%, transparent\)$/.test(w.value), w && w.sheet + ': ' + w.selector + ' => ' + w.value);
  }
}

console.log('\nPicking rows the way a file manager does');
{
  const skip = /var BULK_SKIP = "[^"]+";/.exec(js)[0];
  class Row {
    constructor(name) { const self = this; this.name = name; this.style = { display: '' }; this.tile = { attrs: { 'aria-checked': 'false' }, setAttribute(k, v) { this.attrs[k] = v; }, closest: (sel) => (/tr$/.test(sel) ? self : null) }; }
    querySelector(sel) { return sel === '.tt-pick' ? this.tile : null; }
  }
  const rows = ['a', 'b', 'c', 'd', 'e'].map((n) => new Row(n));
  let syncs = 0;
  const api = new Function('rows', 'onSync',
    'var mode = "list", ttBulkSel = {}, ttBulkAnchor = null, ttBulkModeOn = false; ' + skip +
    'function findRows() { return rows; } function rowName(tr) { return tr.name; } function ctxFor(n) { return { id: "id-" + n, image: "img" }; } function ttBulkBarSync() { onSync(); }' +
    ['ttBulkRows', 'ttBulkRowFor', 'ttBulkTileFor', 'ttBulkInRange', 'ttBulkSet', 'ttBulkClick'].map(grab).join('\n') +
    '; return { click: ttBulkClick, rowFor: ttBulkRowFor, tileFor: ttBulkTileFor, sel: function () { return Object.keys(ttBulkSel).sort().join(""); }, setMode: function (m) { mode = m; }, bulk: function (on) { ttBulkModeOn = on; }, clear: function () { ttBulkSel = {}; } };')(rows, () => syncs++);
  const marks = () => rows.filter((r) => r.tile.attrs['aria-checked'] === 'true').map((r) => r.name).join('');
  api.click(rows[1], { ctrlKey: true });
  ok('Ctrl and a click picks a row and checks its tile', api.sel() === 'b' && marks() === 'b', api.sel());
  api.click(rows[3], { ctrlKey: true });
  ok('a second one adds to it', api.sel() === 'bd');
  api.click(rows[1], { ctrlKey: true });
  ok('Ctrl on a picked row takes it out again', api.sel() === 'd' && marks() === 'd');
  api.click(rows[0], { shiftKey: true });
  ok('Shift picks the rows from the anchor to this one, in the list\'s order, in place of the rest', api.sel() === 'ab' && marks() === 'ab', api.sel());
  api.click(rows[4], { shiftKey: true });
  ok('a second Shift moves the far end and keeps the anchor', api.sel() === 'bcde', api.sel());
  rows[2].style.display = 'none';
  api.click(rows[0], { shiftKey: true });
  ok('a range drops a row the filter hides, so a bulk action never reaches one out of sight', api.sel() === 'ab' && rows[2].tile.attrs['aria-checked'] === 'false', api.sel());
  rows[2].style.display = '';
  ok('every pick brings the bar up to date', syncs === 6, syncs);
  ok('the selection keeps what the bulk actions need', /ttBulkSel\[name\] = \{ id: cx\.id, image: cx\.image \}/.test(grab('ttBulkSet')));
  const target = (cls, inSkip) => ({ closest: (sel) => (sel === '#docker_list tr' ? rows[0] : inSkip && sel.indexOf(cls) >= 0 ? {} : null) });
  ok('a plain click is no Ctrl or Shift pick', api.rowFor({ target: target('x'), ctrlKey: false, metaKey: false, shiftKey: false, button: 0 }) === null);
  ok('Ctrl, Cmd and Shift with the main button are', ['ctrlKey', 'metaKey', 'shiftKey'].every((k) => api.rowFor(Object.assign({ target: target('x'), ctrlKey: false, metaKey: false, shiftKey: false, button: 0 }, { [k]: true })) === rows[0]));
  ok('a click on a control in the row keeps doing its own job', api.rowFor({ target: target('.tt-actcell', true), ctrlKey: true, button: 0 }) === null && api.rowFor({ target: target('a[href]', true), ctrlKey: true, button: 0 }) === null);
  const onTile = { button: 0, target: { closest: (sel) => (sel === '#docker_list td.ct-name span.tt-pick' ? rows[2].tile : null) } };
  const offTile = { button: 0, target: { closest: () => null } };
  api.clear();
  ok('with multi-select off and nothing picked, a plain click on the tile does not pick', api.tileFor(onTile) === null);
  api.bulk(true);
  ok('with multi-select on it picks that row', api.tileFor(onTile) === rows[2]);
  ok('a click beside the tile still does not', api.tileFor(offTile) === null);
  api.bulk(false);
  api.click(rows[4], { ctrlKey: true });
  ok('once a row is picked, a plain click on another tile picks too', api.tileFor(onTile) === rows[2]);
  api.setMode('grid');
  ok('only the list has tiles to pick', api.rowFor({ target: target('x'), ctrlKey: true, button: 0 }) === null && api.tileFor(onTile) === null);
  ok('the page\'s click handler picks before it flashes the actions', /var picked = ttBulkRowFor\(e\) \|\| ttBulkTileFor\(e\);\n\s*if \(picked\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); ttBulkClick\(picked, e\); return; \}\n\s*var hand = /.test(js));
  ok('a Shift and a press on a row starts no text selection', /document\.addEventListener\("mousedown", function \(e\) \{ try \{ if \(!dead && e\.shiftKey && ttBulkRowFor\(e\)\) e\.preventDefault\(\);/.test(js));
  ok('html.tt-bulk-picked follows whether anything is picked', /classList\.toggle\("tt-bulk-picked", names\.length > 0\)/.test(js));
}

console.log('\nAn on/off setting is the switch');
{
  const base = rule(docker, '.tt-cb');
  ok('the 44x24 track of .tt-set-toggle', /width:\s*44px/.test(base) && /height:\s*24px/.test(base), base);
  ok('it rests on the off track', /background:\s*var\(--tt-toggle-track-off, #3a3a3a\)/.test(base));
  const knob = rule(docker, '.tt-cb::before');
  ok('an 18px knob at the pill radius', /width:\s*18px/.test(knob) && /border-radius:\s*var\(--tt-radius-pill\)/.test(knob), knob);
  ok('on, the track takes the colour chain', rule(docker, '.tt-cb:checked').includes('background: ' + CHAIN));
  const on = rule(docker, '.tt-cb:checked::before');
  ok('on, the knob moves across and takes the chain\'s ink', /left:\s*23px/.test(on) && on.includes('background: ' + INK), on);
  ok('a TowerTorch window\'s checkbox is the same switch', rule(docker, '.tt-pop input[type="checkbox"]') === base);
}

console.log('\nThe square box and its tick stamp are gone');
for (const f of ['styles/docker.css', 'scripts/docker.js', 'scripts/settings.js']) {
  const src = read(f);
  ok(f + ': no --tt-cb-tick', !/--tt-cb-tick/.test(src));
}
ok('docker.js: no ttTickURL', !/ttTickURL/.test(js));
ok('settings.js: the matrix cells carry colour and ink only', /function chkCell[^\n]*if \(rainbow && color\) \{ cb\.style\.setProperty\("--tt-rb-c", color\); cb\.style\.setProperty\("--tt-rb-ct", idealText\(color\)\); \} cb\.addEventListener/.test(read('scripts/settings.js')));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
