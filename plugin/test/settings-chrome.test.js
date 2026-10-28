// Pins four properties of the TowerTorch settings page's own chrome.
//
//  1. Every colour swatch is the same size. Rule 5 forbids a ring or a border on
//     the selected one, so it is marked with a tick and a brightness step. A
//     transform, or any other geometry, would leave one odd cell in a row of one
//     repeated shape.
//
//  2. The footer toggle lives in the Theming card. cc.footer is a global setting
//     like Dichte and Kachelgröße, not a property of the Kopfbereich area.
//
//  3. There is one logo preview, logoPreview, running the tabs' own icon pipeline.
//     Private copies painted things the real tabs never paint: a tint that ignored
//     cc.iconmode, and an feFlood badge that ignored the badge shape.
//
//  4. The previews show this box's real logos. /VMs and /Plugins ship an empty
//     table body and fill it from their own jQuery, and fetch() does not run a
//     page's scripts, so parsing the page shell finds nothing. Part 5 replays the
//     real bytes of both the shell and the row fragment through rowIcons().
//
// It uses no parser beyond its own, so it runs on the same bare Node as the other
// WebGUI tests.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const SETTINGS = process.argv[2] || path.join(DIR, 'scripts', 'settings.js');
const CSS = process.argv[3] || path.join(DIR, 'sheets', 'TowerTorch.Tokens.css');
const THEME = fs.readFileSync(path.join(DIR, 'scripts', 'cc-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(SETTINGS, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
// settings.js's comments quote some of the class names and filter primitives these
// assertions look for, so the assertions about code run against a copy with the
// comments blanked out, keeping the line numbers.
const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');

// The body of the rule whose selector list matches exactly, with the sheet's
// comments stripped first so a property named in one cannot satisfy an assertion.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
function declares(body, prop) {
  if (body == null) return false;
  return new RegExp('(^|;)\\s*' + prop + '\\s*:', 'i').test(body);
}

console.log('\nPart 1: the selected swatch is a mark, never a different size');
{
  const off = ruleBody(css, '.cc-set-sw');
  const on = ruleBody(css, '.cc-set-sw-on');
  ok('the base .cc-set-sw rule exists', off != null);
  ok('the .cc-set-sw-on rule exists', on != null);
  ok('the on-state declares no transform, which would scale the box', !declares(on, 'transform'), on || '');
  ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'padding', 'margin', 'flex', 'font-size', 'zoom', 'scale', 'border-width', 'border'].forEach(p => {
    ok('the on-state declares no ' + p, !declares(on, p), on || '');
  });
  ok('the base swatch pins both dimensions, so on and off share one box', declares(off, 'width') && declares(off, 'height'));
  ok('the base swatch is a positioning context for its mark', declares(off, 'position'), off || '');

  // The cue is a filled tick inside the swatch plus a brightness step, Rule 5
  // asking for a filled selection rather than an outlined one.
  const mark = ruleBody(css, '.cc-set-sw-on::after');
  ok('the on-state carries a ::after mark instead', mark != null);
  ok('the mark is a background image (the tick), not a drawn box', declares(mark, 'background-image'));
  ok('the mark never eats a click', declares(mark, 'pointer-events'));
  ok('the mark reads its ink from --cc-sw-tick, so it contrasts with the swatch colour', /--cc-sw-tick/.test(mark || ''));
  ok('the on-state still has its brightness step', declares(on, 'filter'));
  ['outline', 'box-shadow'].forEach(p => ok('neither state draws a ' + p, !declares(on, p) && !declares(mark, p)));

  // The page-local sheet settings.js injects must not undo any of this.
  const inline = src.slice(src.indexOf('cc-set-xtra'), src.indexOf('document.head.appendChild(st)'));
  ok('the page-local sheet does not re-declare a geometry on .cc-set-sw-on',
    !/\.cc-set-sw-on\{[^}]*(transform|width|height|padding|flex)\s*:/.test(inline.replace(/\s/g, '')), '');
}

console.log('\nPart 2: one helper marks the selected swatch everywhere');
{
  ok('swMark exists, holding the class and the contrast ink in one place', /function swMark\s*\(/.test(THEME) && /swMark = window\.CCTheme\.swMark\b/.test(src));
  ok('swMarkRow exists, marking one swatch in a row', /function swMarkRow\s*\(/.test(THEME) && /swMarkRow = window\.CCTheme\.swMarkRow\b/.test(src));
  // A write that goes round the helper loses the ink, and lets a card mark a
  // swatch its preview is not showing.
  const strays = code.split('\n').map((l, i) => ({ l, n: i + 1 }))
    .filter(o => /cc-set-sw-on/.test(o.l))
    .filter(o => !/function swMark|classList\.toggle\("cc-set-sw-on", !!on\)/.test(o.l));
  ok('every "cc-set-sw-on" write goes through swMark', strays.length === 0,
    strays.map(o => 'L' + o.n + ': ' + o.l.trim().slice(0, 90)).join(' | '));
  // Sweeping every swatch on the page against the global accent would un-mark each
  // area card's own pick, so syncSwOn is scoped to the global row.
  ok('syncSwOn touches the global accent row alone', /function syncSwOn\(\)[^\n]*cc-set-swrow-global/.test(src));
  ok('the global accent row is the one carrying that class', /colourField\(accent, [^\n]*\{ rowClass: "cc-set-swrow-global" \}\)/.test(src));
}

console.log('\nPart 3: the footer toggle is global and lives in the Theming card');
{
  const i = code.indexOf('cc.footer');
  ok('the footer toggle still exists', i > 0);
  const around = code.slice(Math.max(0, i - 1200), i + 1200);
  ok('it is appended to themingCard', /themingCard\.appendChild\(cHf\)/.test(around), around.slice(-200));
  ok('it is not appended to the Kopfbereich Stil card', !/cH\.appendChild\(cHf\)/.test(src));
  ok('it keeps its key, its default and its live sync',
    /get\("cc\.footer", "1"\) !== "0"/.test(src) && /set\("cc\.footer", v \? "1" : "0"\); syncHeaderBar\(\)/.test(src));
  // Dichte and Kachelgröße are global too, and share the card, so there is one
  // place for all three.
  ok('Dichte and Kachelgröße are in the same card', /themingCard\.appendChild\(segRow\(T\("Dichte"/.test(src) && /themingCard\.appendChild\(tileSizeRow\(\)\)/.test(src));
}

console.log('\nPart 4: one logo preview, running the tabs\' own icon pipeline');
{
  ok('logoPreview exists', /function logoPreview\s*\(/.test(src));
  ok('it asks the shared pipeline what to do', /Ci\.plan\(/.test(src));
  ok('it honours per-item pins through the pipeline scope', /Ci\.mode\(scope, it\.name\)/.test(src));
  ok('it repaints when a pending icon lookup lands', /onResolved\(paint\)/.test(src));
  ok('it can swap in the curated glyph/colour artwork like the real tabs do', /Ci\.svgUrl\(it\.name\)/.test(src));
  // The badge is a real box. An feFlood fills the whole filter region, ignoring
  // border-radius, and renders a square where the tab shows a rounded tile.
  ok('no feFlood badge is composited inside a filter', code.indexOf('feFlood') < 0);
  ok('the badge is a CSS tile with a real radius', /cc-set-tile/.test(src) && /it\.tile\.style\.borderRadius = rad/.test(src));
  ok('the tile takes the control radius, like the live logo tile', /function radius\(\) \{ return "var\(--cc-radius-control\)"; \}/.test(src));
  // Every card that shows logos uses it, so there is no third copy.
  ['docker', 'vm', 'plugin'].forEach(s => ok('the global card previews the ' + s + ' area', new RegExp('\\["' + s + '", T\\(').test(src)));
  ok('the Docker card uses the shared preview', /logoPreview\("docker", "cc-set-dockprev"\)/.test(src));
  ok('the per-area cards use the shared preview', /logoPreview\(PSCOPE,/.test(src));
  ok('the Docker area previews container names and their values, as the global card does',
    /mkName\("nextcloud"\), mkVal\("CPU", "2\/8"\), mkVal\("RAM", "1\.2G"\), mkName\("plex"\)/.test(src));
}

/* Part 5 lifts rowIcons() and ICON_SRC out of settings.js and replays them against
   markup taken from a live Unraid box: first the page skeleton fetch() returns,
   then the row fragment the page's own jQuery asks for. */

/* An HTML parser and selector engine covering what rowIcons uses, and enough of it
   to parse the real fragments, nested README tables and unclosed <tr> included. */
const VOID = new Set(['img', 'br', 'input', 'hr', 'meta', 'link', 'col', 'source']);
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.nodes = []; this.parentNode = null; this.attrs = {}; }
  get id() { return this.attrs.id || ''; }
  get className() { return this.attrs.class || ''; }
  get textContent() { return this.nodes.map(n => typeof n === 'string' ? n : n.textContent).join(''); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  append(n) { if (typeof n !== 'string') { n.parentNode = this; this.children.push(n); } this.nodes.push(n); }
  walk(out = []) { for (const c of this.children) { out.push(c); c.walk(out); } return out; }
  matches(sel) { return String(sel).split(',').some(s => matchOne(this, s.trim())); }
  querySelectorAll(sel) { const p = String(sel).split(',').map(s => s.trim()); return this.walk().filter(n => p.some(s => matchOne(n, s))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
// One compound of tag, classes and attributes, plus a single ">" child combinator.
function matchOne(node, sel) {
  const gt = sel.split('>').map(s => s.trim());
  if (gt.length === 2) return matchOne(node, gt[1]) && !!node.parentNode && matchOne(node.parentNode, gt[0]);
  const m = /^([a-zA-Z][\w-]*)?((?:\.[\w-]+)*)((?:\[[^\]]*\])*)$/.exec(sel);
  if (!m) return false;
  if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
  const have = new Set((node.attrs.class || '').split(/\s+/).filter(Boolean));
  for (const c of (m[2].match(/\.[\w-]+/g) || [])) if (!have.has(c.slice(1))) return false;
  for (const a of (m[3].match(/\[[^\]]*\]/g) || [])) {
    const p = /^\[([\w-]+)(?:([\^*$~|]?=)\s*(['"]?)([\s\S]*?)\3)?\]$/.exec(a);
    if (!p) return false;
    const v = node.attrs[p[1].toLowerCase()];
    if (v === undefined) return false;
    if (!p[2]) continue;
    if (p[2] === '=' && v !== p[4]) return false;
    if (p[2] === '^=' && !v.startsWith(p[4])) return false;
    if (p[2] === '*=' && v.indexOf(p[4]) < 0) return false;
    if (p[2] === '$=' && !v.endsWith(p[4])) return false;
  }
  return true;
}
function parseHTML(html) {
  const root = new El('#document'); const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  let last = 0, m;
  const top = () => stack[stack.length - 1].tagName;
  while ((m = re.exec(html))) {
    const text = html.slice(last, m.index); if (text) stack[stack.length - 1].append(text);
    last = re.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { const t = m[1].toUpperCase(); for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName === t) { stack.length = i; break; } continue; }
    const tag = m[2].toLowerCase();
    // The implied end tags these fragments rely on. A bare <tr> with no closing tag
    // is what the /Plugins skeleton below really ships.
    if (tag === 'tr') while (stack.length > 1 && ['TD', 'TH', 'TR'].includes(top())) stack.pop();
    if (tag === 'td' || tag === 'th') while (stack.length > 1 && ['TD', 'TH'].includes(top())) stack.pop();
    if (tag === 'p') while (stack.length > 1 && top() === 'P') stack.pop();
    const el = new El(tag);
    const ar = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a; while ((a = ar.exec(m[3] || ''))) el.attrs[a[1].toLowerCase()] = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : ''));
    stack[stack.length - 1].append(el);
    if (!VOID.has(tag)) stack.push(el);
  }
  const tail = html.slice(last); if (tail) stack[stack.length - 1].append(tail);
  return root;
}

// Markup taken from a live box. What fetch("/Plugins"), fetch("/VMs") and
// fetch("/Docker") return where the list belongs is an empty skeleton, which the
// page's own jQuery replaces afterwards.
const SKELETON = {
  plugin: `<table id="plugin_table" class="tablesorter"><tbody id="plugin_list"><tr><td colspan="6"></td><tr></tbody></table>`,
  vm: `<table id="kvm_table" class="tablesorter"><tbody id="kvm_list" class="js-fill-available-height"><tr><td colspan='8'></td></tr></tbody></table>`,
  docker: `<table id="docker_table" class="tablesorter"><tbody id="docker_list" class="js-fill-available-height"><tr><td colspan='10'></td></tr></tbody></table>`
};
// What the row-fragment endpoints return: bare <tr> rows with the real icons in
// them. VMMachines.php and DockerContainers.php append a \0-separated script block.
const FRAGMENT = {
  vm: `<tr parent-id='0' class='sortable'><td class='vm-name' style='width:220px;padding:8px'><i class='fa fa-arrows-v mover orange-text'></i><span class='outer'><span id='vm-e74020f2-769c-919b-a6b5-b5a440944d5a' onclick="addVMContext('Linux','e74020f2-769c-919b-a6b5-b5a440944d5a','Linux','shutoff','','VNC','','QEMU','both;no','', '', )" class='hand'><img src='/plugins/dynamix.vm.manager/templates/images/home_assistant.png' class='img'></span><span class='inner'><a href='#' onclick='return toggle_id("name-0")' title='click for more VM info'>Linux</a><br><i class='fa fa-square stopped red-text'></i><span class='state'>Stopped </span></span></span></td><td>Home Assistant</td></tr>`
    + `<tr><td colspan='8' style='margin:0;padding:0'><table class='tablesorter domdisk'><thead class='child'><tr><th><i class='fa fa-hdd-o'></i> <b>Disk/Volume</b></th></tr></thead></table></td></tr>`
    + `<tr parent-id='1' class='sortable'><td class='vm-name' style='width:220px;padding:8px'><i class='fa fa-arrows-v mover orange-text'></i><span class='outer'><span id='vm-b8e737d5-f911-c2c3-2b49-9020ed0f0e35' onclick="addVMContext('Ubuntu','b8e737d5-f911-c2c3-2b49-9020ed0f0e35','Ubuntu','shutoff','','VNC','','QEMU','both;no','', '', )" class='hand'><img src='/plugins/dynamix.vm.manager/templates/images/ubuntu_gelb.png' class='img'></span></span></td><td>Ubuntu</td></tr>`
    + `\0var kvm=[];kvm.push({id:'e74020f2-769c-919b-a6b5-b5a440944d5a',state:'shutoff'});`,
  // Row 2 carries a rendered README with a table and an image of its own, which a
  // logo hunt not anchored to the row's first cell would preview as the logo. Row 4
  // has no README heading, so its name falls back to the vid-<name> cell id.
  plugin: `<tr id="towertorch"><td><img src='/plugins/towertorch/images/towertorch.png' class='list'></td><td><span class='desc_readmore' style='display:block'><h1>TowerTorch</h1><p>Dependency-aware Docker start orchestration.</p></span> </td><td>junkerderprovinz</td><td id='vid-towertorch' data='43200'>4.32.0&nbsp;<span class='fa fa-info-circle fa-fw big blue-text'></span></td><td id='sid-towertorch' data='0'><span style='color:#267CA8'><i class='fa fa-refresh fa-spin fa-fw'></i>&nbsp;unknown</span></td><td></td></tr>`
    + `<tr id="unbalanced"><td><a href='/Settings/unbalanced' class='list'><img src='/plugins/unbalanced/unbalanced.png' class='list'></a></td><td><span class='desc_readmore' style='display:block'><h1>unbalanced</h1><table><tr><td><img src='/readme-screenshot-trap.png'></td></tr></table></span> </td><td>anonymous</td><td id='vid-unbalanced' data='202401'>2024.01&nbsp;<span class='fa fa-info-circle fa-fw big blue-text'></span></td><td id='sid-unbalanced' data='0'><span><i class='fa fa-refresh fa-spin fa-fw'></i></span></td><td></td></tr>`
    + `<tr id="unassigneddevicespreclear"><td><a href='/Tools/Preclear' class='list'><i class='icon-preclear list'></i></a></td><td><span class='desc_readmore' style='display:block'><h1>Unassigned Devices Preclear</h1></span> </td><td>anonymous</td><td id='vid-unassigned-devices-preclear' data='202401'>2024.01</td><td id='sid-unassigned-devices-preclear' data='0'><i class='fa fa-refresh fa-spin fa-fw'></i></td><td></td></tr>`
    + `<tr id="userscripts"><td><a href='/Settings/Userscripts' class='list'><i class='fa fa-file-text-o list'></i></a></td><td><span class='desc_readmore' style='display:block'><p>no heading in this readme</p></span> </td><td>anonymous</td><td id='vid-user-scripts' data='202401'>2024.01</td><td id='sid-user-scripts' data='0'></td><td></td></tr>`,
  // TrickWork has no cached icon, so Unraid serves its question.png stand-in, the
  // case a guessed "/state/…/<name>-icon.png" path would 404 on.
  docker: `<tr parent-id='0' class='sortable'><td class='ct-name' style='width:220px;padding:8px'><i class='fa fa-arrows-v mover orange-text'></i><span class='outer'><span id='0819ad48b1bf' onclick="addDockerContainerContext('TrickWork','c2456766162d','',1,0,3,false,'','','sh','0819ad48b1bf','','','', '','')" class='hand'><img src='/plugins/dynamix.docker.manager/images/question.png?1700089733' class='img'></span></span></td><td>trickwork</td></tr>`
    + `<tr parent-id='1' class='sortable'><td class='ct-name' style='width:220px;padding:8px'><span class='outer'><span id='b28258895c39' onclick="addDockerContainerContext('Crucible','23698dda16b6','',1,0,3,false,'','','bash','b28258895c39','','','', '','')" class='hand'><img src='/state/plugins/dynamix.docker.manager/images/Crucible-icon.png?1787174541' class='img'></span></span></td><td>crucible</td></tr>`
    + `\0var docker=[];`
};

/* Lift ICON_SRC and rowIcons out of the file, with the comments already blanked in
   `code`, and run them against a fetch and DOMParser shim. */
function lift(from, marker) {
  const i = from.indexOf(marker);
  if (i < 0) return null;
  let d = 0, started = false;
  for (let j = i; j < from.length; j++) {
    const c = from[j];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return from.slice(i, j + 1); }
  }
  return null;
}
const srcIconSrc = lift(code, 'var ICON_SRC = {');
const srcRowIcons = lift(code, 'function rowIcons(');

console.log('\nPart 5: the previews read the row fragment, never the page shell');
{
  ok('ICON_SRC was found in the shipped file', !!srcIconSrc);
  ok('rowIcons was found in the shipped file', !!srcRowIcons);
  if (!srcIconSrc || !srcRowIcons) {
    console.log('\nFAILED  ' + pass + ' passed, ' + fail + ' failed  (nothing to replay: the previews are not fragment-driven)');
    process.exit(1);
  }

  // Fetching a page for icons brings the empty skeleton back.
  ok('nothing fetches /VMs, /Plugins or /Docker for icons',
    !/fetch\(\s*["'](\/VMs|\/Plugins|\/Docker)["']/.test(code) && !/\bscrapeIcons\b/.test(code));
  // A Docker icon URL guessed from a container name 404s into a hidden tile.
  ok('the "/state/…/<name>-icon.png" URL guess is gone', code.indexOf('-icon.png') < 0);

  const urls = (srcIconSrc || '').match(/url:\s*"([^"]+)"/g) || [];
  ok('all three areas point at their page\'s own row-fragment include', urls.length === 3
    && /dynamix\.docker\.manager\/include\/DockerContainers\.php/.test(srcIconSrc)
    && /dynamix\.vm\.manager\/include\/VMMachines\.php/.test(srcIconSrc)
    && /dynamix\.plugin\.manager\/include\/ShowPlugins\.php/.test(srcIconSrc), urls.join(' | '));
  // ShowPlugins.php runs its remote version check in the non-init branch, so
  // init=1 renders the icon markup and check=1 keeps that branch shut.
  ok('ShowPlugins.php is asked for markup, never for a remote update check',
    /ShowPlugins\.php\?init=1&check=1/.test(srcIconSrc));
  // The two rules that let a bare-<tr> fragment survive DOMParser.
  ok('the fragment is wrapped in a table first, a loose <tr> being discarded otherwise',
    /parseFromString\("<table><tbody>"\s*\+\s*rows/.test(srcRowIcons));
  ok('only the first NUL-separated part is treated as markup', /split\("\\0"\)\[0\]/.test(srcRowIcons));

  let body = '';
  // The body is taken at fetch time rather than when .text() is awaited, or three
  // concurrent replays would all read whichever markup was assigned last.
  const fetchShim = () => { const b = body; return Promise.resolve({ ok: true, text: () => Promise.resolve(b) }); };
  const DOMParserShim = function () {
    this.parseFromString = html => { const r = parseHTML(html); return { querySelector: s => r.querySelector(s), querySelectorAll: s => r.querySelectorAll(s) }; };
  };
  const mod = new Function('fetch', 'DOMParser', srcIconSrc + ';\n' + srcRowIcons + '\nreturn { ICON_SRC: ICON_SRC, rowIcons: rowIcons };')(fetchShim, DOMParserShim);
  const run = (kind, markup, max) => { body = markup; return mod.rowIcons(kind, max); };

  const results = {};
  Promise.all(['docker', 'vm', 'plugin'].map(k =>
    run(k, SKELETON[k]).then(r => { results['skel_' + k] = r; })
      .then(() => run(k, FRAGMENT[k], 4)).then(r => { results['frag_' + k] = r; })
  )).then(() => {
    console.log('\n  the page shell yields nothing:');
    ['docker', 'vm', 'plugin'].forEach(k => ok('the ' + k + ' page skeleton yields no icons',
      results['skel_' + k].length === 0, JSON.stringify(results['skel_' + k])));

    console.log('\n  the row fragment yields this box\'s real logos:');
    const vm = results.frag_vm;
    ok('VMs: both VM rows are found, the disk/detail row is not', vm.length === 2, JSON.stringify(vm));
    ok('VMs: the real icon paths come through', vm[0] && vm[0].src === '/plugins/dynamix.vm.manager/templates/images/home_assistant.png'
      && vm[1] && vm[1].src === '/plugins/dynamix.vm.manager/templates/images/ubuntu_gelb.png', JSON.stringify(vm));
    ok('VMs: the name is the one addVMContext() carries, like vms.js vmNameOf()',
      vm[0] && vm[0].name === 'Linux' && vm[1] && vm[1].name === 'Ubuntu', JSON.stringify(vm));
    ok('VMs: the row-mover/state glyphs are never mistaken for a VM logo',
      vm.every(v => !/fa-arrows-v|fa-square/.test(v.src)), JSON.stringify(vm));

    const pl = results.frag_plugin;
    ok('Plugins: all four plugin rows are found', pl.length === 4, JSON.stringify(pl));
    ok('Plugins: a bare <img> and one wrapped in the launch <a> both resolve',
      pl[0] && pl[0].src === '/plugins/towertorch/images/towertorch.png'
      && pl[1] && pl[1].src === '/plugins/unbalanced/unbalanced.png', JSON.stringify(pl));
    ok('Plugins: an Unraid icon-* glyph comes back as its glyph class', pl[2] && pl[2].src === 'icon-preclear', JSON.stringify(pl));
    ok('Plugins: a FontAwesome glyph comes back as its fa-* class', pl[3] && pl[3].src === 'fa-file-text-o', JSON.stringify(pl));
    ok('Plugins: the name is the README heading, like plugins.js paintRow()',
      pl[0].name === 'TowerTorch' && pl[1].name === 'unbalanced' && pl[2].name === 'Unassigned Devices Preclear', JSON.stringify(pl));
    ok('Plugins: a heading-less README falls back to the vid-<name> cell id', pl[3].name === 'user-scripts', JSON.stringify(pl));
    ok('Plugins: an image inside a rendered README is never taken for a logo',
      pl.every(p => p.src.indexOf('readme-screenshot-trap') < 0), JSON.stringify(pl));
    ok('Plugins: the status spinner and the version info-circle are never taken for a logo',
      pl.every(p => !/fa-refresh|fa-info-circle/.test(p.src)), JSON.stringify(pl));

    const dk = results.frag_docker;
    ok('Docker: both container rows are found', dk.length === 2, JSON.stringify(dk));
    ok('Docker: a container without a cached icon gets Unraid\'s question.png, not a 404',
      dk[0] && dk[0].src === '/plugins/dynamix.docker.manager/images/question.png?1700089733', JSON.stringify(dk));
    ok('Docker: a container with a cached icon gets it, cache-buster and all',
      dk[1] && dk[1].src === '/state/plugins/dynamix.docker.manager/images/Crucible-icon.png?1787174541', JSON.stringify(dk));
    ok('Docker: the name is the one addDockerContainerContext() carries',
      dk[0].name === 'TrickWork' && dk[1].name === 'Crucible', JSON.stringify(dk));

    run('plugin', FRAGMENT.plugin, 2).then(two => {
      ok('the max argument caps the sample count', two.length === 2, JSON.stringify(two));
      return run('vm', '');
    }).then(none => {
      ok('an empty answer yields an empty list instead of throwing', none.length === 0);
      return mod.rowIcons('nosucharea', 4);
    }).then(unknown => {
      ok('an unknown area yields an empty list', unknown.length === 0);
      console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
      process.exit(fail ? 1 : 0);
    });
  }).catch(e => { console.log('  FAIL  Part 5 threw -> ' + (e && e.stack || e)); process.exit(1); });
}
