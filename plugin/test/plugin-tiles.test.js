// The plugin tiles on /Plugins (TowerTorch.Plugins.page, Plugins.css, plugintiles.js) and the
// compact rows they are read from (plugins.js). What can quietly break it:
//   · a tile rule that is not gated, restyling /Plugins with the tiles off
//   · a reader that loses a plugin once plugins.js has painted its row
//   · a card that carries Unraid's inline handlers and runs a command by itself
//   · an action that does anything but click the control the row itself carries
//   · a second key for the view, or a settings row that writes another one
//   · the icon colouring back as a badge under the name, or a gear a touch screen never shows
//   · full-colour logos inked to a blob on the badge
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = read('scripts/plugintiles.js');
const plugins = read('scripts/plugins.js');
const css = read('sheets/TowerTorch.Plugins.css');
const page = read('TowerTorch.Plugins.page');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(src, name) { const m = new RegExp('var ' + name + ' = [^\\n]+;').exec(src); if (!m) throw new Error('var not found: ' + name); return m[0]; }

// A small HTML tree with what the readers use, and outerHTML for the pieces a card copies. A node
// records its clicks, so the actions can be checked.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#\d+|\w+);/g, (m, e) => e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : (ENT[e] ?? m));
const VOID = new Set(['br', 'img', 'input']);
function serialize(n) {
  if (n.nodeType === 3) return n.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const t = n.tagName.toLowerCase();
  const at = Object.keys(n.attrs).map((k) => ' ' + k + '="' + n.attrs[k].replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"').join('');
  return '<' + t + at + '>' + (VOID.has(t) ? '' : n.childNodes.map(serialize).join('') + '</' + t + '>');
}
function el(tag, attrs, parent) {
  const n = { nodeType: 1, tagName: tag.toUpperCase(), attrs, children: [], childNodes: [], parentNode: parent, clicks: 0 };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.click = () => { n.clicks++; };
  n.closest = (sel) => { for (let c = n; c && c.nodeType === 1; c = c.parentNode) if (sel.split(',').some((p) => matches(c, p.trim()))) return c; return null; };
  n.disabled = 'disabled' in attrs;
  Object.defineProperty(n, 'outerHTML', { get: () => serialize(n) });
  return n;
}
function matches(n, sel) {
  if (sel[0] === '.') return (' ' + (n.attrs.class || '') + ' ').includes(' ' + sel.slice(1) + ' ');
  if (sel[0] === '[') return sel.slice(1, -1) in n.attrs;
  return n.tagName === sel.toUpperCase();
}
function parse(html) {
  const root = el('root', {}, null);
  const re = /<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/gi;
  let cur = root, m;
  while ((m = re.exec(html))) {
    if (m[1]) { let c = cur; while (c && c.tagName !== m[1].toUpperCase()) c = c.parentNode; if (c && c.parentNode) cur = c.parentNode; continue; }
    if (m[4]) { cur.childNodes.push({ nodeType: 3, nodeValue: decode(m[4]), parentNode: cur }); continue; }
    const attrs = {};
    (m[3] || '').replace(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (x, k, a, b, c) => { attrs[k] = decode(a ?? b ?? c ?? ''); });
    const n = el(m[2], attrs, cur);
    cur.children.push(n); cur.childNodes.push(n);
    if (!VOID.has(m[2].toLowerCase())) cur = n;
  }
  return root;
}
const tbody = (rows) => parse('<tbody>' + rows + '</tbody>').children[0];

const READERS = ['kids', 'tag', 'attr', 'hasCls', 'find', 'byCls', 'text', 'clean', 'esc', 'markup', 'readRow', 'readList', 'cardHtml', 'glyph', 't', 'run', 'target', 'onClick', 'view'];
function load(env) {
  const src = [grabVar(js, 'KEY'), grabVar(js, 'LANG'), grabFn(js, 'g')].concat(READERS.filter((n) => n !== 'g').map((n) => grabFn(js, n))).join('\n') +
    '\nvar TXT = ' + /var TXT = (\{[\s\S]*?\n {2}\});/.exec(js)[1] + ';\nreturn {' + READERS.join(',') + '};';
  const document = { documentElement: { lang: 'de' } };
  const localStorage = { getItem: (k) => (env.store && k in env.store ? env.store[k] : null) };
  return new Function('window', 'document', 'navigator', 'localStorage', src)(env.window || {}, document, {}, localStorage);
}

// Rows as plugins.js leaves them on a real server (made-up plugin names and links).
const OK_ROW = `<tr id="demo" style="--cc-rb-c: #24d971; --cc-rb-ct: #161616;"><td data-ccp="1" data-cc-pname="Demo Plugin"><div class="cc-plugname"><div class="cc-plugico"><a href="/Settings/Demo" class="list"><img src="/plugins/demo/images/demo.png" class="list" style="filter: url(&quot;#cc-plug-tint-wht&quot;) !important;"></a><span class="cc-plugicm" data-ccp="1" data-tip="Icon-Färbung"></span></div><div class="cc-plugtxt"><div class="cc-plugtitle">Demo Plugin</div><a class="cc-pluglink cc-plugsup" href="https://forums.example/demo" target="_blank" data-ccp="1">Support-Thread</a></div></div></td>` +
  `<td><span class="cc-desc" data-ccp="1"><div class="cc-descin"><p>Does a demo.</p></div></span></td>` +
  `<td><span class="cc-b cc-b-info cc-b-von cc-b-pauthor cc-plugauth" data-ccp="1" style="background: rgb(46, 46, 46) !important;"><span class="cc-b-k">Von</span><span class="cc-b-v">Someone</span></span></td>` +
  `<td id="vid-demo" data="20260519"><span class="fa fa-info-circle fa-fw big blue-text" onclick="openChanges('showchanges /tmp/plugins/demo.txt','Veröffentlichungshinweise')" style="display: none !important;"></span><div class="cc-plugver"><span class="cc-b cc-b-info cc-verb" data-ccp="1"><span class="cc-b-k">Version</span><span class="cc-b-v">2026.05.19</span></span><span class="cc-pluglink cc-plugchg" data-ccp="1" role="button" tabindex="0">Changelog</span></div></td>` +
  `<td id="sid-demo" data="4"><span class="green-text" data-ccp="1" onclick="checkPlugin()" style="background: var(--cc-ok, #6fdc8c) !important;"><i class="fa fa-check fa-fw"></i>&nbsp;Auf dem neusten Stand</span></td>` +
  `<td><input type="checkbox" data="demo.plg" class="remove cc-cb-del cc-cb-hidden" onclick="multiRemove()" data-ccp="1"><input type="button" id="demo:remove" data="demo.plg" class="remove cc-b-del cc-rm-native" value="Löschen" data-ccp="1"><span class="cc-b-del cc-b-delicon" role="button" tabindex="0" title="Plugin löschen" aria-label="Plugin löschen"><svg viewBox="0 0 14 14"></svg></span></td></tr>`;
const UPDATE_ROW = `<tr id="other"><td data-ccp="1" data-cc-pname="Other"><div class="cc-plugname"><div class="cc-plugico"><i class="fa fa-users list"></i></div><div class="cc-plugtxt"><div class="cc-plugtitle">Other</div></div></div></td><td></td>` +
  `<td><span class="cc-b cc-plugauth"><span class="cc-b-k">Von</span><span class="cc-b-v">Team</span></span></td>` +
  `<td id="vid-other"><div class="cc-plugver"><span class="cc-b cc-plugnew"><span class="cc-b-k">Neu</span><span class="cc-b-v">2.0</span></span><span class="cc-b cc-verb"><span class="cc-b-k">Version</span><span class="cc-b-v">1.0</span></span></div></td>` +
  `<td id="sid-other" data="0"><input type="button" id="other:update" data="other.plg" class="update" value="Aktualisieren" onclick='openInstall("plugin update other.plg","Plugin aktualisieren","other:update","loadlist");' style="background: var(--cc-warn, #ff832b) !important;" data-ccp="1"></td>` +
  `<td><input type="button" id="other:remove" data="other.plg" class="remove" value="Löschen"></td></tr>`;
const NONE = `<tr><td colspan='6' style='text-align:center;padding-top:12px'><i class='fa fa-check-square-o icon'></i> Keine Plugins installiert</td><tr>`;

console.log('\nThe hook');
ok('Plugins.page loads plugintiles.js after plugins.js', /scripts\/plugins\.js[\s\S]*scripts\/plugintiles\.js/.test(page));
ok('the sheet comes in by its basename, beside the page', fs.existsSync(path.join(DIR, 'sheets', 'TowerTorch.Plugins.css')) && !/TowerTorch\.Plugins\.css'\)/.test(page));
ok('plugins.js hands over to the tiles after painting the rows', /if \(typeof window\.ccPluginTilesApply === "function"\) window\.ccPluginTilesApply\(\);\s*\} catch \(e\) \{\}\s*\}\s*\n\s*\/\/ Adopts/.test(plugins));

console.log('\nEvery rule waits for the Plugins page, the tile rules for the tiles');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].replace(/^\s*@media[^{]*\{/, '').trim(); if (s && !s.startsWith('@')) sels.push(s); }
  const parts = sels.flatMap((s) => splitTop(s).map((p) => p.trim()));
  ok('the sheet has rules', parts.length > 30, parts.length);
  const loose = parts.filter((p) => !/^html\.cc-on-plugins[.\s:]/.test(p));
  ok('no selector applies off the Plugins page', loose.length === 0, loose.slice(0, 3).join(' | '));
  const tile = parts.filter((p) => /cc-plt-/.test(p) && !/^html\.cc-on-plugins\.cc-plt-on/.test(p) && !/:is\(#plugin_list > tr, \.cc-plt-card\)/.test(p));
  ok('no tile selector applies with the tiles off', tile.length === 0, tile.slice(0, 3).join(' | '));
  ok('the script sets the gate on /Plugins alone, with the area on', /function live\(\) \{\s*return g\("cc\.theming", "1"\) !== "0" && g\("cc\.enable\.plugins", "1"\) !== "0" && pn\(\) === "\/Plugins" && !!document\.getElementById\("plugin_list"\);/.test(js));
  ok('the columns are the Docker raster\'s, at least 400px', /\.cc-plt-grid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(min\(400px, 100%\), 1fr\)\);/.test(css));
}

console.log('\nThe readers follow the painted rows');
{
  const R = load({ window: { CCTheme: { icons: {}, glyph: () => '<svg class="cc-glyph"></svg>' } } });
  const list = R.readList(tbody(OK_ROW + UPDATE_ROW));
  const [demo, other] = list.plugins;
  ok('two plugins', list.plugins.length === 2 && !list.notice);
  ok('name, settings page and support thread', demo.name === 'Demo Plugin' && demo.launch === '/Settings/Demo' && demo.support === 'https://forums.example/demo');
  ok('the logo is the painted one, inked as the row inks it', demo.logo && demo.logo.tagName === 'IMG' && /cc-plug-tint-wht/.test(demo.logo.getAttribute('style')));
  ok('author and version are the row\'s badges, the changelog its link', !!demo.author && R.clean(R.text(demo.version)) === 'Version2026.05.19' && !!demo.changelog && !demo.newer);
  ok('up to date: Unraid\'s words stay, no update button', !demo.update && /Auf dem neusten Stand/.test(R.text(demo.status)));
  ok('the trash is the row\'s TowerTorch trash', demo.remove && /cc-b-delicon/.test(demo.remove.getAttribute('class')));
  ok('a glyph logo is read too', other.logo && other.logo.tagName === 'I' && other.launch === '');
  ok('a pending update: the button and the new version', other.update && other.update.getAttribute('value') === 'Aktualisieren' && !!other.newer && !other.status);
  ok('without the trash the native remove button stands in', other.remove && other.remove.getAttribute('type') === 'button');
  const none = R.readList(tbody(NONE));
  ok('no plugins: Unraid\'s own line is kept', none.plugins.length === 0 && none.notice === 'Keine Plugins installiert');

  const card = R.cardHtml(demo), card2 = R.cardHtml(other);
  ok('a card carries no inline handler and no id of the row', !/\son[a-z]+=/i.test(card + card2) && !/\sid=/.test(card + card2));
  ok('the card shows the logo, the gear, the name as a link and the support link', /<img src="\/plugins\/demo\/images\/demo\.png"/.test(card) && /class="cc-plugicm"[^>]*data-act="icons"[^>]*data-tip="Icon-Färbung"/.test(card) && /<a class="cc-plt-name" href="\/Settings\/Demo"/.test(card) && /class="cc-pluglink cc-plugsup" href="https:\/\/forums\.example\/demo" target="_blank"/.test(card));
  ok('it keeps "Auf dem neusten Stand" visible', /Auf dem neusten Stand/.test(card));
  ok('version, changelog link and trash at its foot', /cc-verb/.test(card) && /data-act="changelog">Changelog</.test(card) && /<span data-act="remove" class="cc-b-del cc-b-delicon"/.test(card));
  ok('a pending update shows the button in the row\'s colour and the new version', /<span class="cc-plt-upd" role="button" tabindex="0" data-act="update" style="background: var\(--cc-warn, #ff832b\) !important;">Aktualisieren<\/span>/.test(card2) && /cc-plugnew/.test(card2));
}

console.log('\nThe actions click the row\'s own controls');
{
  let pop = null;
  const W = { CCTheme: { icons: { popover: (at, scope, name) => { pop = [at, scope, name]; } }, glyph: () => '' } };
  const R = load({ window: W });
  const [demo, other] = R.readList(tbody(OK_ROW + UPDATE_ROW)).plugins;
  const c = { __ccPlugin: demo }, c2 = { __ccPlugin: other };
  R.run('changelog', c);
  ok('Changelog clicks the row\'s link, whose handler opens Unraid\'s notes', demo.changelog.clicks === 1);
  R.run('remove', c);
  ok('the trash clicks the row\'s trash, which asks first', demo.remove.clicks === 1);
  R.run('update', c2);
  ok('the update clicks Unraid\'s own button', other.update.clicks === 1);
  R.run('update', c);
  ok('a plugin without an update has nothing to click', demo.changelog.clicks === 1 && demo.remove.clicks === 1);
  R.run('icons', c, 'anchor');
  ok('the gear opens the icon colouring of this plugin', pop && pop[0] === 'anchor' && pop[1] === 'plugin' && pop[2] === 'Demo Plugin');

  const tree = parse('<div class="cc-plt-card"><span data-act="changelog">x</span><b>y</b></div>');
  const card = tree.children[0];
  card.__ccPlugin = demo;
  let stopped = 0;
  const ev = (target) => ({ target, preventDefault() {}, stopPropagation() { stopped++; } });
  R.onClick(ev(card.children[0]));
  ok('a click on an action runs it', demo.changelog.clicks === 2 && stopped === 1);
  R.onClick(ev(card.children[1]));
  ok('a click anywhere else on the card does nothing', demo.changelog.clicks === 2 && demo.remove.clicks === 1 && stopped === 1);
}

console.log('\nThe view: one switch and one key');
{
  const store = {};
  const R = load({ store });
  ok('unset, the page shows tiles', R.view() === 'tiles');
  store['cc.pluginview'] = 'list';
  ok('cc.pluginview = list shows Unraid\'s list', R.view() === 'list');
  ok('the switch writes cc.pluginview', /var KEY = "cc\.pluginview";/.test(js) && /s\(KEY, o\[0\]\)/.test(js));
  ok('there is one switch, leading the buttons pinned to the tab bar', (js.match(/el\("span", "cc-plt-vsw"\)/g) || []).length === 1 && /document\.getElementById\("cc-plugbtns"\)/.test(js) && /host\.insertBefore\(sw, host\.firstChild\)/.test(js));
  ok('it offers Liste and Kacheln with the view glyphs', /\[\["list", "ViewList"\], \["tiles", "ViewGrid"\]\]/.test(js) && /list: "Liste", tiles: "Kacheln"/.test(js));
  const settings = read('scripts/settings.js');
  const row = grabFn(settings, 'pluginViewRow');
  ok('the settings row writes the same key and nothing else', /set\("cc\.pluginview", v\);/.test(row) && (row.match(/set\(/g) || []).length === 1);
  ok('it starts from tiles as the page does', /var cur = get\("cc\.pluginview", "tiles"\) === "list" \? "list" : "tiles";/.test(row));
  ok('it sits in the Plugins tab', /pluginViewRow\(cPV\);\s*wrapPlugin\.appendChild\(cPV\);/.test(settings));
  ok('a card writes its markup only when it changed', /function setHtml\(n, v\) \{ if \(n && n\.__ccHtml !== v\)/.test(js));
}

console.log('\nCompact rows with the gear on the logo');
{
  const row = grabFn(plugins, 'paintRow');
  ok('no Icon badge under the name any more', !/"Icon"/.test(plugins) && !/cc-b cc-plugicm/.test(plugins));
  ok('the gear sits in the logo box', /var gear = iconGear\(nm\);\s*if \(gear\) icoWrap\.appendChild\(gear\);/.test(row));
  const gear = grabFn(plugins, 'iconGear');
  ok('it carries the CC tooltip "Icon-Färbung" and opens the shared popover', /"Icon-Färbung"/.test(gear) && /g\.setAttribute\("data-tip", tip\)/.test(gear) && /icons\.popover\(g, "plugin", name/.test(gear) && /pressable\(g\)/.test(gear));
  ok('support and changelog are small links beside the name and the version', /el\("a", "cc-pluglink cc-plugsup"/.test(row) && /el\("span", "cc-pluglink cc-plugchg", "Changelog"\)/.test(row));
  ok('the gear shows on hover and focus, and always on a touch screen', /:is\(#plugin_list > tr, \.cc-plt-card\):is\(:hover, :focus-within\) \.cc-plugicm \{ opacity: 1; \}/.test(css) && /@media \(hover: none\) \{ html\.cc-on-plugins \.cc-plugicm \{ opacity: 1; \} \}/.test(css));
  ok('hidden by opacity, so Tab still reaches it', /\.cc-plugicm \{[^}]*opacity: 0;/.test(css) && !/\.cc-plugicm \{[^}]*(display: none|visibility: hidden)/.test(css));
  const docker = read('styles/docker.css');
  ok('the name and the support link share one line', /\.cc-plugtxt \{ display: flex; align-items: baseline; gap: 10px; min-width: 0; \}/.test(docker));
  ok('so do the version and the changelog link, a pending update above them', /\.cc-plugver \{ display: grid; grid-template-columns: auto auto;/.test(docker) && /\.cc-plugver > \.cc-plugnew \{ grid-column: 1 \/ -1;/.test(docker));
}

console.log('\nFull-colour logos keep their shading on the badge');
{
  const row = grabFn(plugins, 'paintRow');
  ok('the reactive badge rests grey, so its logos take the white ink', /var badgeInk = reactive\(\) \? "#fff" : rowInk/.test(row));
  ok('the adopt branch shades instead of inking', /ensureShadeAs\("cc-plug-tint-svg-blk", "cc-plug-tint-blk", false\)/.test(row) && /ensureShadeAs\("cc-plug-tint-svg-wht", "cc-plug-tint-wht", true\)/.test(row));
  // The matrix row a luminance L maps through, at full strength.
  let vals = '';
  const doc = { getElementById: () => null, createElement: () => ({ style: {}, dataset: {}, set innerHTML(v) { vals = /values="([^"]+)"/.exec(v)[1]; } }), body: { appendChild() {} } };
  const fns = new Function('document', 'eff', [grabFn(plugins, 'lumFilterAs'), grabFn(plugins, 'ensureShadeAs')].join('\n') + '\nreturn { ensureShadeAs };')(doc, () => '100');
  const map = (light) => { fns.ensureShadeAs('h', 'f', light); const v = vals.split(' ').map(Number); return [v[4], v[0] + v[1] + v[2] + v[4]]; };
  const [dk0, dk1] = map(false), [lt0, lt1] = map(true);
  ok('on a light badge the greys run from the ink up to half white', Math.abs(dk0 - 0x16 / 255) < 1e-3 && Math.abs(dk1 - (0x16 / 255 + 0.5)) < 1e-3, dk0 + '..' + dk1);
  ok('on a dark badge from 40 % grey up to white, so dark artwork stays readable', Math.abs(lt0 - 0.4) < 1e-3 && Math.abs(lt1 - 1) < 1e-3, lt0 + '..' + lt1);
  const sg = read('scripts/settingsgrid.js');
  ok('the Settings and Tools tiles use the same two ranges', /var k = light \? 0\.6 : 0\.5, off = light \? 0\.4 : c;/.test(sg));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
