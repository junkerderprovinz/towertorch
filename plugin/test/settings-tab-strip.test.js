// The settings tabs are GlimStone's vertical tiles: the tab selector on its side, a column beside
// the cards, every tile with a filled glyph and the order of the main menu as it stands. Its colours follow the tab-strip colour rule: the idle glyph shows the tab's colour, the
// chosen tab is filled with it, and reactive mode rests the idle glyphs until hover or focus.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of clean(css)) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const sel = stack.pop(); if (sel !== undefined && !sel.startsWith('@')) out.push({ sel, body: buf.trim() }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const body = (all, sel) => (all.find((r) => r.sel.split(/,\s*(?![^(]*\))/).includes(sel)) || {}).body || '';
const decl = (b, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(b); return m ? m[1].trim() : null; };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const settings = read('scripts/settings.js');
const css = rules(read('styles/docker.css'));

console.log('\nEvery tab has a glyph, and every glyph is filled');
{
  const table = settings.slice(settings.indexOf('var TAB_GLYPHS = {'), settings.indexOf('\n  };', settings.indexOf('var TAB_GLYPHS = {')));
  const glyphs = {};
  for (const m of table.matchAll(/^\s+(\w+): \["([^"]+)", '([^']+)'\]/gm)) glyphs[m[1]] = { vb: m[2], svg: m[3] };
  const ids = [...settings.matchAll(/\{ id: "(\w+)", t: T\(/g)].map((m) => m[1]);
  ok('the strip has its sections', ids.length >= 10, ids.join(' '));
  const missing = ids.filter((id) => !glyphs[id]);
  ok('every section id has a glyph', missing.length === 0, missing.join(' '));
  const stroked = Object.keys(glyphs).filter((k) => /stroke=|fill="none"/.test(glyphs[k].svg));
  ok('no glyph is a stroked outline', stroked.length === 0, stroked.join(' '));
  ok('every glyph names a four-number viewBox', Object.values(glyphs).every((g) => g.vb.split(' ').length === 4));
  ok('each tab is built with its glyph and its label', /b\.appendChild\(tabGlyph\(sc\.id\)\); b\.appendChild\(el\("span", "cc-set-tablbl", sc\.t\)\);/.test(settings));
  ok('the glyph inks on currentColor and hides from screen readers', /svg\.setAttribute\("aria-hidden", "true"\);/.test(grabFn(settings, 'tabGlyph')) && /"fill", "currentColor"/.test(grabFn(settings, 'tabGlyph')));
}

console.log('\nThe tabs stand as vertical tiles beside the cards');
{
  const strip = body(css, '.cc-set-tabs');
  ok('the tiles stand in a column', decl(strip, 'display') === 'flex' && decl(strip, 'flex-direction') === 'column' && decl(strip, 'gap') === '4px', strip);
  ok('the column stays in view while the cards scroll, and scrolls itself past the window', decl(strip, 'position') === 'sticky' && decl(strip, 'max-height') === 'calc(100vh - 24px)');
  // Unraid sets the root font size to 10px, so GlimStone's 12.75rem and 3.25rem are written as
  // the 204px and 52px they mean.
  ok('the column is 204px wide with words', decl(strip, 'width') === '204px', decl(strip, 'width'));
  ok('the column may scroll, since the wheel moves it', decl(strip, 'overflow-y') === 'auto');
  ok('the column and the cards share a row', decl(body(css, '.cc-set-body'), 'display') === 'flex' && decl(body(css, '.cc-set-main'), 'min-width') === '0');
  const tab = body(css, '.cc-set-tab');
  ok('every tile is 66px tall and never grows', decl(tab, 'flex') === 'none' && decl(tab, 'height') === '66px !important' && decl(tab, 'min-height') === null, tab);
  ok('the column is as tall as its tiles', decl(strip, 'height') === null && decl(strip, 'flex') === 'none');
  ok('a tile takes the control radius, so a tall one stays a tile', /var\(--cc-radius-control\)/.test(decl(tab, 'border-radius') || ''));
  ok('a tile is the glyph, then the name, set as KnightLoader sets it', decl(tab, 'justify-content') === 'flex-start' && decl(tab, 'gap') === '12px' && decl(tab, 'font-weight') === '500 !important');
  ok('in the label\'s own case', decl(tab, 'text-transform') === 'none !important');
  ok('a long name takes a second line and no more', /-webkit-line-clamp:\s*2/.test(body(css, '.cc-set-tablbl')));
  ok('the glyph is 20px', decl(body(css, '.cc-set-tabico'), 'width') === '20px');
  ok('a switched-off area\'s tile is out of the column', decl(body(css, '.cc-set-tab[hidden]'), 'display') === 'none !important');
  const labels = [...settings.matchAll(/\{ id: "(\w+)", t: T\("([^"]+)", "([^"]+)"\)/g)].map((m) => m[2] + '|' + m[3]);
  ok('every tab carries the plain name of its Unraid tab', labels.every((l) => !/-Tab\b| tabs?\b/.test(l)), labels.join(' '));
  ok('no strip sizing is left', !/sizeSetTabs|tabsPerRow|TAB_GAP/.test(settings));
  ok('the column is a vertical tab list', /tabRow\.setAttribute\("role", "tablist"\); tabRow\.setAttribute\("aria-orientation", "vertical"\);/.test(settings));
}

console.log('\nNothing stretches the tiles while the page scrolls');
ok('no height is stamped on the column, on a render or a scroll', !/--cc-set-tabs-h|tabsHeight|tabsFrame/.test(settings));

console.log('\nBelow 1024px the column shows the glyphs alone');
{
  const narrow = rules(read('styles/docker.css').slice(read('styles/docker.css').indexOf('@media (max-width: 1023px)')));
  ok('the column narrows to 52px', decl(body(narrow, '.cc-set-tabs'), 'width') === '52px');
  ok('and the names leave the tiles', decl(body(narrow, '.cc-set-tablbl'), 'display') === 'none');
  const tips = /window\.__ccSetTabTips = function \(\) \{[\s\S]*?\n    \};/.exec(settings);
  ok('each name moves into the tile\'s bubble then', !!tips && /matchMedia\("\(max-width: 1023px\)"\)/.test(tips[0]) && /b\.setAttribute\("data-tip", SECS\[i\]\.t\)/.test(tips[0]) && /b\.removeAttribute\("data-tip"\)/.test(tips[0]));
}

console.log('\nThe arrows move the focus along the column, a press opens the tab');
{
  // The keydown handler on a column of four tiles, the third hidden.
  const tiles = [0, 1, 2, 3].map((i) => ({ i, hidden: i === 2, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() { doc.activeElement = this; } }));
  const doc = { activeElement: tiles[0] };
  let handler = null;
  const tabRow = { addEventListener: (t, f) => { handler = f; } };
  const m = /    tabRow\.addEventListener\("keydown", function \(e\) \{[\s\S]*?\n    \}\);/.exec(settings);
  new Function('tabRow', 'tabBtns', 'document', m[0])(tabRow, tiles, doc);
  const press = (key) => { let prevented = false; handler({ key, preventDefault: () => { prevented = true; } }); return prevented; };
  press('ArrowDown');
  ok('down moves the focus to the next tile', doc.activeElement === tiles[1] && tiles[1].attrs.tabindex === '0' && tiles[0].attrs.tabindex === '-1');
  press('ArrowDown');
  ok('a hidden tile is passed over', doc.activeElement === tiles[3]);
  press('ArrowDown');
  ok('the end of the column holds', doc.activeElement === tiles[3]);
  press('Home');
  ok('Home goes to the first tile', doc.activeElement === tiles[0]);
  ok('a key the column does not use passes through', press('a') === false);
  const show = grabFn(settings, 'showSec');
  ok('the chosen tile is the one tab stop', /tabBtns\[j\]\.setAttribute\("tabindex", on \? "0" : "-1"\);/.test(show) && /tabBtns\[j\]\.setAttribute\("aria-selected", on \? "true" : "false"\);/.test(show));
}

console.log('\nThe order follows the main menu as it stands');
{
  ok('the live menu order is read from the page', /document\.querySelectorAll\("#menu \.nav-tile \.nav-item:not\(\.util\) > a\[href\]"\)/.test(settings));
  ok('General comes first', /var SECS = \[\s*\{ id: "general"/.test(settings));
  ok('Info comes last', /SECS\.push\(\{ id: "info"/.test(settings));
  ok('a reordered menu rebuilds the column', /if \(ord9 && ord9 !== lastOrd9\) \{ lastOrd9 = ord9; render\(\); \}/.test(settings));
}

console.log('\nA tab shows only while its area is on');
{
  const off = (/  var OFF_BY_DEFAULT = [^;]+;/.exec(settings) || [''])[0];
  const areaOn = (store) => new Function('localStorage', off + '\n' + grabFn(settings, 'areaOn') + '\nreturn areaOn;')({ getItem: (k) => (k in store ? store[k] : null) });
  const fresh = areaOn({});
  ok('the start tab, the header and the shares are off until switched on', !fresh('cc.enable.main') && !fresh('cc.enable.header') && !fresh('cc.enable.shares'));
  ok('the other areas are on until switched off', fresh('cc.enable.docker') && fresh('cc.enable.plugins'));
  ok('General and Info have no switch and always show', fresh(null));
  const set = areaOn({ 'cc.enable.header': '1', 'cc.enable.docker': '0' });
  ok('a stored value wins either way', set('cc.enable.header') && !set('cc.enable.docker'));
  const defaults = [...settings.matchAll(/\["(cc\.enable\.\w+)", T\("[^"]+", "[^"]+"\), "0"[,\]]/g)].map((m) => m[1]).sort().join(' ');
  ok('the areas card agrees on which start off', defaults === 'cc.enable.header cc.enable.main cc.enable.shares', defaults);
}

console.log('\nThe tab-strip colour rule');
{
  ok('an idle glyph carries the tab colour', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(body(css, '.cc-set-tabico'), 'color') || ''));
  ok('the chosen tab is filled with it', /^var\(--cc-rb-c, var\(--cc-accent/.test(decl(body(css, '.cc-set-tab-on'), 'background') || ''));
  ok('the chosen glyph takes the fill ink', decl(body(css, '.cc-set-tab-on .cc-set-tabico'), 'color') === 'inherit');
  ok('reactive rests an idle glyph', decl(body(css, '#cc-settings.cc-set-reactive .cc-set-tab:not(.cc-set-tab-on) .cc-set-tabico'), 'color') === 'inherit');
  ok('reactive shows it again on hover and focus', /^var\(--cc-rb-c/.test(decl(body(css, '#cc-settings.cc-set-reactive .cc-set-tab:not(.cc-set-tab-on):is(:hover, :focus-visible) .cc-set-tabico'), 'color') || ''));
  ok('an idle tab answers the pointer by a colour step', /color-mix/.test(decl(body(css, '.cc-set-tab:not(.cc-set-tab-on):hover'), 'background') || ''));
  const paint = grabFn(settings, 'paintSetTabs');
  ok('the painter only stamps vars, never an inline fill', !/"background"|"color"/.test(paint));
  ok('the painter takes positions from the shared rbColor, flag palette included', /window\.CCTheme\.rbColor/.test(paint));
  ok('the painter marks reactive mode on the root', /root\.classList\.toggle\("cc-set-reactive", get\("cc\.rbmode", "all"\) === "active"\)/.test(paint));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
