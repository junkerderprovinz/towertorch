// The disk tiles on /Main (TowerTorch.Disks.page, .css, disks.js, server/disks.php).
// What can quietly break it:
//   · a rule that is not gated on html.cc-dk-on restyles /Main with the Start area off
//   · a reader that only knows the plain nchan rows and loses a disk once shares.js has badged them
//   · an action that runs anything other than the call Unraid's own control carries
//   · a second view switch, or a key per section that the page switch cannot take back
//   · a table control left in the tile view, where it does nothing
//   · an animation outside the motion gate, or one that keeps running at "off"
//   · a section or a pool folded into another, where it loses its own badge
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = read('scripts/disks.js');
const css = read('sheets/TowerTorch.Disks.css');
const page = read('TowerTorch.Disks.page');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(src, name) { const m = new RegExp('var ' + name + ' = [^\\n]+;').exec(src); if (!m) throw new Error('var not found: ' + name); return m[0]; }

// A small HTML tree with the parts of the DOM the readers use: children, childNodes, tagName,
// getAttribute, parentNode, and closest() for a class or an attribute.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', deg: '\u00b0' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));
function el(tag, attrs, parent) {
  const n = { nodeType: 1, tagName: tag.toUpperCase(), attrs, children: [], childNodes: [], parentNode: parent };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.closest = (sel) => { for (let c = n; c && c.nodeType === 1; c = c.parentNode) if (sel.split(',').some((p) => matches(c, p.trim()))) return c; return null; };
  return n;
}
function matches(n, sel) {
  if (sel[0] === '.') return (' ' + (n.attrs.class || '') + ' ').includes(' ' + sel.slice(1) + ' ');
  if (sel[0] === '[') return sel.slice(1, -1) in n.attrs;
  return n.tagName === sel.toUpperCase();
}
function parse(html) {
  const root = el('root', {}, null);
  const VOID = new Set(['br', 'img', 'input', 'hr', 'col']);
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

// The readers out of disks.js, with the helpers they call.
const READERS = ['kids', 'tag', 'attr', 'hasCls', 'find', 'text', 'clean', 'bytes', 'rate', 'temp', 'parseCall', 'run', 'cells', 'usage', 'fsInfo', 'linkName',
  'kindOf', 'orbState', 'splitId', 'ioText', 'readRow', 'readArray', 'readPool', 'readBoot', 'readUd', 'cardOf', 'act', 'onClick', 'view', 'order', 'cap'];
function load(env) {
  const src = [grabVar(js, 'POW'), grabVar(js, 'CALLS'), grabVar(js, 'KEY')].concat(READERS.map((n) => grabFn(js, n))).join('\n') + '\nreturn {' + READERS.join(',') + '};';
  return new Function('window', 'location', 'g', src)(env.window || {}, env.location || {}, env.g || (() => null));
}

// Rows as Unraid's devices channel sends them (serials made up).
const PARITY = `<tr><td><a class='view'></a><a class='info'><i id='dev-parity' class='fa fa-circle orb green-orb' style='cursor:pointer' onclick="toggle_state('Device','parity','down')"></i><span>Normaler Betrieb, Datenträger aktiv<br>Zum Herunterfahren des Datenträgers klicken</span></a><a href="/Main/Device?name=parity">Parität</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sde','')"><i class='icon-disk icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>WDC_WD181KRYZ-01AGBB0_TESTPAR1</span> - 18 TB (sde)</td><td>37&#8201;&#176;C</td><td><span class='diskio'>0.0 B/s</span><span class='number'>50,456,947</span></td><td><span class='diskio'>12.5 MB/s</span><span class='number'>44,641,755</span></td><td>0</td><td colspan='4'></td></tr>`;
const DISK1 = `<tr><td><a class='view' href="/Main/Browse?dir=/mnt/disk1"><i class="icon-u-tab" title="Durchsuchen /mnt/disk1"></i></a><a class='info'><i id='dev-disk1' class='fa fa-circle orb grey-orb' style='cursor:pointer' onclick="toggle_state('Device','disk1','up')"></i><span>Datenträger im Standby-Modus (heruntergefahren)<br>Zum Starten des Datenträgers klicken</span></a><a href="/Main/Device?name=disk1">Datenträger 1</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sdf','')"><i class='icon-disk icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>WDC_WD161KRYZ-01AGBB0_TESTDSK1</span> - 16 TB (sdf)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>75,282,084</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>11,703,195</span></td><td><a class='info'><i class='fa fa-exclamation-triangle orange-text'></i><span>Device errors: 3</span></a>&nbsp;3</td><td>xfs</td><td>16 TB</td><td><div class='usage-disk'><span style='width:87.711422734358%' class=''></span><span>14.0 TB</span></div></td><td><div class='usage-disk'><span style='width:12.288577265642%' class=''></span><span>1.97 TB</span></div></td></tr>`;
const TOTAL = `<tr class='tr_last'><td><a class='info'><i class='fa fa-toggle-down control' onclick="toggle_state('Device','disk*','down')"></i><span>Herunterfahren</span></a></td><td><a class='static'><i class='icon-disks icon'></i></a><span></span>Array aus zwei Datenträgern</td><td>37&#8201;&#176;C</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>12.5 MB/s</span><span class='number'>2</span></td><td>0</td><td></td><td>16 TB</td><td><div class='usage-disk'><span style='width:87.7%' class=''></span><span>14.0 TB</span></div></td><td><div class='usage-disk'><span style='width:12.3%' class=''></span><span>1.97 TB</span></div></td></tr>`;
// The same disk once shares.js has badged it: a Browse column, the link moved there, cells wrapped.
const DISK1_BADGED = `<tr data-cc-main="1" style="--cc-rb-c: #FF832B; --cc-rb-ct: #161616;"><td><a class="info" data-cc-tip="Datenträger im Standby-Modus (heruntergefahren)
Zum Starten des Datenträgers klicken"><i id="dev-disk1" class="fa fa-circle orb grey-orb" style="cursor:pointer" onclick="toggle_state('Device','disk1','up')"></i><span>Datenträger im Standby-Modus (heruntergefahren)<br>Zum Starten des Datenträgers klicken</span></a><a href="/Main/Device?name=disk1" class="cc-b cc-b-name">Datenträger 1</a></td><td class="cc-browse-col"><a class="view cc-b-browse" href="/Main/Browse?dir=/mnt/disk1"><span class="cc-b-lab">Durchsuchen</span></a></td><td class="desc cc-bcell"><span class="cc-b"><span class="cc-b-v"><a class="info hand" onclick="openTerminal('disklog','sdf','')" data-cc-tip="Datenträgerprotokoll"><i class="icon-disk icon"></i><span>Datenträgerprotokoll</span></a><span style="font-family:bitstream">WDC_WD161KRYZ-01AGBB0_TESTDSK1</span> - 16 TB (sdf)</span></span></td><td>*</td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><span class="diskio">0.0 B/s</span><span class="number" style="display: none;">75,282,084</span></span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><span class="diskio">0.0 B/s</span><span class="number" style="display: none;">11,703,195</span></span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v"><a class='info'><i class='fa fa-exclamation-triangle orange-text'></i><span>Device errors: 3</span></a>&nbsp;3</span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v">xfs</span></span></td><td class="cc-bcell"><span class="cc-b"><span class="cc-b-v">16 TB</span></span></td><td><div class="usage-disk"><span style="width: 87.7114%; --cc-slosh-phase: -10.227s;" class="cc-slosh-edge cc-fill-amber"></span><span>14.0 TB</span></div></td><td><div class="usage-disk"><span style="width: 12.2886%; --cc-slosh-phase: -10.227s;" class="cc-slosh-edge cc-fill-amber"></span><span>1.97 TB</span></div></td></tr>`;
const POOL = `<tr class='pool_header' id='pool_cache'><td><a class='view' href="/Main/Browse?dir=/mnt/cache"><i class="icon-u-tab"></i></a><a href="/Main/Device?name=cache">Cache</a></td><td class='desc'><i class="fa fa-bullseye title"></i> Data Partition <a href='/Main/Device?name=cache#poolsummary' title='View pool details'>(ONLINE)</a></td><td colspan='4'></td><td>btrfs</td><td>2 TB</td><td><div class='usage-disk'><span style='width:40.5%' class=''></span><span>811 GB</span></div></td><td><div class='usage-disk'><span style='width:59.5%' class=''></span><span>1.19 TB</span></div></td></tr><tr><td><span style='padding-left:16px'></span><a class='view'></a><a class='info'><i id='dev-cache' class='fa fa-circle orb green-orb' style='cursor:pointer' onclick="toggle_state('Device','cache','down')"></i><span>Normaler Betrieb</span></a><a href="/Main/Device?name=cache">Device 1</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','nvme0n1','')"><i class='icon-nvme icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>Samsung_SSD_9100_PRO_2TB_TESTNVME</span> - 2 TB (nvme0n1)</td><td>40&#8201;&#176;C</td><td><span class='diskio'>8.2 KB/s</span><span class='number'>4</span></td><td><span class='diskio'>53,5 KB/s</span><span class='number'>2</span></td><td>0</td><td colspan='4'></td></tr><tr><td><span style='padding-left:16px'></span><a class='view'></a><a class='info'><i id='dev-cache2' class='fa fa-circle orb grey-orb' style='cursor:pointer' onclick="toggle_state('Device','cache2','up')"></i><span>Standby</span></a><a href="/Main/Device?name=cache2">Device 2</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sdg','')"><i class='icon-nvme icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>Samsung_SSD_850_EVO_500GB_TESTSATA</span> - 500 GB (sdg)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td>0</td><td colspan='4'></td></tr>`;
const BOOT = `<tr><td><a class='view' href="/Main/Browse?dir=/boot"><i class="icon-u-tab"></i></a><a class='info'><i class='fa fa-circle orb green-orb'></i><span>Normaler Betrieb</span></a><a href="/Main/Boot?name=flash">Boot(Flash)</a></td><td class='desc'><a class='info hand' onclick="openTerminal('disklog','sda','')"><i class='icon-usb icon'></i><span>Datenträgerprotokoll</span></a><span style='font-family:bitstream'>SanDisk_Cruzer_Blade_TESTUSB-0:0</span> - 63.1 GB (sda)</td><td>*</td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td><span class='diskio'>0.0 B/s</span><span class='number'>1</span></td><td>0</td><td>vfat</td><td>63 GB</td><td><div class='usage-disk'><span style='width:5.9%' class=''></span><span>3.71 GB</span></div></td><td><div class='usage-disk'><span style='width:94.1%' class=''></span><span>59.3 GB</span></div></td></tr><tr><td><span class='left'><i class='fa fa-magic title'></i> Internal Boot</span></td><td class='desc'>No internal boot setup detected. Launch <a href="/Tools/Wizards/InternalBootWizard">Internal Boot</a> to configure one.</td><td colspan='8'></td></tr>`;
// A stopped array: the identification cell holds the assignment dropdown.
const STOPPED = `<tr class='offline'><td><a class='view'></a><a class='info'><i class='fa fa-circle orb green-orb'></i><span>x</span></a><a href="/Main/Device?name=disk1">Datenträger 1</a></td><td><form><select class='slot' name='slotId.1'><option value='a' selected>WDC_TEST - 16 TB (sdf)</option></select></form></td><td>*</td><td colspan='3'></td><td>xfs</td><td colspan='3'></td></tr>`;
// Unassigned Devices: a disk row with its partition row, which holds the browse link.
const UD = `<tr class='toggle-disk'><td><a style='cursor:pointer' class='exec info' onclick='spinDownDisk("sdh")'><i id='disk_orb-sdh' class='fa fa-circle green-orb orb'></i><span>Click to spin down device</span></a><a href='/Main/Device?name=sdh'>Elements</a></td><td><a class='info' href="#" onclick="openTerminal('disklog', 'sdh')"><i class='fa fa-hdd-o icon partition-log'></i><span>Disk Log Information</span></a><span class='toggle-hdd' hdd='sdh'></span>WD_Elements_TESTUD01 (sdh)<span id='preclear_x' style='display:block;'></span></td><td class='mount'><button class='mount' onclick='disk_op(this, "umount", "sdh")'>Unmount</button></td><td>31 &deg;C</td><td>1.2 MB/s</td><td>0.0 B/s</td><td><a class='info'><i class='fa fa-gears'></i><span>Settings</span></a></td><td>ntfs</td><td>5 TB</td><td><div class='usage-disk'><span style='margin:0;width:64%' class=''></span><span>3.12 TB</span></div></td><td><div class='usage-disk'><span style='margin:0;width:36%' class=''></span><span>1.76 TB</span></div></td></tr><tr class='toggle-parts toggle-sdh' name='toggle-sdh' style='display:none;'><td></td><td><span><a class='exec underline-icon' title='Browse Disk Share' href='/Main/Browse?dir=/mnt/disks/Elements'><i class='fa fa-external-link'></i> Elements</a></span></td></tr>`;
const UD_NONE = `<tr><td colspan='11' style='text-align:center;'>No Unassigned Disks available.</td></tr>`;

console.log('\nThe hook');
ok('the page is a Buttons hook, so its sheet loads on every page', /^Menu="Buttons:\d+"/m.test(page));
ok('it renders no icon', /^Link="cc-disks-hook"/m.test(page));
ok('it loads disks.js', /scripts\/disks\.js/.test(page));

console.log('\nEvery rule waits for html.cc-dk-on');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const sels = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].replace(/^\s*@media[^{]*\{/, '').trim(); if (s && !s.startsWith('@')) sels.push(s); }
  ok('the sheet has rules', sels.length > 40, sels.length);
  const loose = [];
  for (const s of sels) for (const part of splitTop(s)) if (!/^html\.cc-dk-on/.test(part.trim())) loose.push(part.trim());
  ok('no selector applies without the gate', loose.length === 0, loose.slice(0, 4).join(' | '));
  ok('the script sets the gate only where the Start area styles /Main', /function live\(\) \{\s*return g\("cc\.theming", "1"\) !== "0" && g\("cc\.enable\.main", "0"\) !== "0" && pn\(\) === "\/Main" && !!document\.querySelector\("#displaybox nav\.tabs"\);/.test(js));
}

console.log('\nThe motion stays inside the gate and stops at "off"');
{
  const media = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  html.cc-dk-on:not'));
  const anims = [...css.matchAll(/^\s*(html[^\n{]*)\{[^}\n]*\banimation:\s*cc-dk-/gm)].map((m) => m[1]);
  ok('there are animations', anims.length >= 6, anims.length);
  ok('each one names the quiet level and none the lively one', anims.every((s) => /:not\(\[data-cc-motion="off"\]\)/.test(s)) && !/data-cc-motion="(wild|subtle)"\]/.test(css));
  ok('they all sit in the no-preference block', anims.every((s) => media.includes(s)));
  const tokens = read('sheets/TowerTorch.Tokens.css');
  for (const d of ['spin', 'seek', 'swing', 'blink', 'flow', 'rise', 'stagger']) ok('the platter, arm, LED, data flow and entrance read --cc-motion-disk-' + d, (css.includes('var(--cc-motion-disk-' + d) || js.includes('getPropertyValue("--cc-motion-disk-' + d + '")')) && (tokens.match(new RegExp('--cc-motion-disk-' + d + ':', 'g')) || []).length === 4);
  ok('the entrance ends at transform: none', /@keyframes cc-dk-in \{[^}]*\}[^}]*to \{ transform: none;/.test(css));
  ok('no CSS animation turns the platter, so nothing can stop it dead', !/cc-dk-spin/.test(css) && !/\.cc-dk-plat \{[^}]*animation/.test(css));
  const outside = css.slice(0, css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  html.cc-dk-on:not'));
  ok('the LED blinks with every second the disk reads or writes, and outside the gate it is lit without blinking', /\.cc-dk-card\.cc-dk-access \.cc-dk-led \{ animation: cc-dk-blink/.test(media) && /html\.cc-dk-on #displaybox \.cc-dk-card\.cc-dk-access \.cc-dk-led \{ fill: var\(--cc-dk-c/.test(outside) && /c\.classList\.toggle\("cc-dk-access", busy\(d\)\);/.test(grabFn(js, 'patch')) && !/cc-dk-blink/.test(outside.replace(/@keyframes[^\n]*/g, '')));
  ok('a resting disk dims its LED, a waiting one glows faintly', /\.cc-dk-card\.cc-dk-down \.cc-dk-led \{ opacity: \.45; \}/.test(css) && /\.cc-dk-card:not\(\.cc-dk-down\) \.cc-dk-led \{ fill: color-mix\(/.test(css));
  const hdd = new Function('OWN', grabFn(js, 'drawHdd') + '\nreturn drawHdd;')({})({ parity: false });
  const platAt = hdd.indexOf('class="cc-dk-plat"');
  ok('the platter is an HTML layer between the case and the arm, so the compositor keeps it turning while the page is busy', /<div class="cc-dk-plat"><svg /.test(hdd) && !/<(?:g|svg|circle|path)\b[^>]*class="[^"]*cc-dk-plat/.test(hdd) && hdd.indexOf('r="55"') < platAt && platAt < hdd.indexOf('class="cc-dk-arm"') && /<\/svg><\/div><svg /.test(hdd.slice(platAt)) && !/:is\([^)]*\.cc-dk-plat/.test(css));
  ok('it takes the place and scale the case\'s viewBox gives it', /\.cc-dk-hdd \{ container-type: size; \}/.test(css) && /\.cc-dk-plat \{ --cc-dk-u: min\(100cqw \/ 194, 100cqh \/ 130\); position: absolute; left: calc\(50% - 75 \* var\(--cc-dk-u\)\); top: calc\(50% - 53 \* var\(--cc-dk-u\)\); width: calc\(106 \* var\(--cc-dk-u\)\); height: calc\(106 \* var\(--cc-dk-u\)\); \}/.test(css) && /viewBox="3 3 194 130"/.test(hdd) && /viewBox="25 15 106 106"/.test(hdd));
  ok('every drawing keeps its LED', ['drawHdd', 'drawSsd', 'drawNvme', 'drawUsb'].every((n) => /class="cc-dk-led"/.test(grabFn(js, n))));
  const flowDots = new Function(grabFn(js, 'flowDots') + '\nreturn flowDots;')();
  ok('an SSD has a light that passes over its lines, an NVMe stick three dots from its contacts, a USB stick three beside its label', /class="cc-dk-sweep"/.test(grabFn(js, 'drawSsd')) && /id="cc-dk-sweep"/.test(grabFn(js, 'defs')) && /flowDots\(22, \[60, 68, 76\]\)/.test(grabFn(js, 'drawNvme')) && /flowDots\(66, \[50, 86, 50\]\)/.test(grabFn(js, 'drawUsb')) && (flowDots(22, [60, 68, 76]).match(/class="cc-dk-flow cc-dk-st( cc-dk-n[23])?"/g) || []).length === 3);
  const busyOnly = ['cc-dk-sweep', 'cc-dk-bars', 'cc-dk-flow'].map((k) => [...media.matchAll(new RegExp('^\\s*(html[^\\n{]*)\\{[^}\\n]*animation: ' + k + ' ', 'gm'))].map((m) => m[1]));
  ok('the data flows only while the drive reads or writes', busyOnly.every((l) => l.length === 1 && /\.cc-dk-card\.cc-dk-busy /.test(l[0])), busyOnly.join(' | '));
  ok('each flow runs on the dial alone, and disks.js sets its pace', ['cc-dk-sweep var(--cc-motion-disk-flow) ', 'cc-dk-bars calc(var(--cc-motion-disk-flow) * .8) ', 'cc-dk-flow var(--cc-motion-disk-flow) '].every((k) => media.includes('animation: ' + k)) && !/--cc-dk-k/.test(media.split('\n').filter((l) => /cc-dk-(sweep|bar|flow)/.test(l)).join('\n')) && /"cc-dk-sweep": 1, "cc-dk-bars": 1, "cc-dk-flow": 1/.test(js));
  ok('outside the gate the light and the dots are hidden, so a still frame and an idle drive show neither', /html\.cc-dk-on #displaybox :is\(\.cc-dk-sweep, \.cc-dk-flow\) \{ opacity: 0; \}/.test(outside) && !/cc-dk-(sweep|bars|flow) /.test(outside.replace(/@keyframes[^\n]*/g, '')));
  const v = (lvl) => { const m = new RegExp(lvl + ' \\{[^}]*--cc-motion-disk-flow:\\s*([^;]+);').exec(tokens); return m && m[1].trim(); };
  ok('the flow dial moves at the lively levels and stands at "off" and outside the gate', v('html\\[data-cc-motion="off"\\]') === '60s' && /^html \{[^}]*--cc-motion-disk-flow:\s*60s;/m.test(tokens) && /--cc-motion-disk-flow:\s*\.9s;/.test(tokens) && /--cc-motion-disk-flow:\s*2\.4s;/.test(tokens));
}

console.log('\nThe readers follow Unraid\'s rows');
{
  const R = load({});
  const arr = R.readArray(tbody(PARITY + DISK1 + TOTAL));
  const [par, d1] = arr.disks;
  ok('two disks and the totals row', arr.disks.length === 2 && !!arr.total && !arr.offline);
  ok('parity: name, settings link, device and drive', par.key === 'parity' && par.parity && par.name === 'Parität' && par.href === '/Main/Device?name=parity' && par.dev === 'sde' && par.kind === 'hdd');
  ok('parity: capacity, temperature and rates', par.size === 18e12 && par.temp.c === 37 && par.wr === 12.5e6 && par.rd === 0 && par.wrText === '12.5 MB/s');
  ok('parity: model and serial from the identification', par.model === 'WDC WD181KRYZ-01AGBB0' && par.serial === 'TESTPAR1');
  ok('parity runs toggle_state with the row\'s own arguments', JSON.stringify(par.spin) === JSON.stringify({ fn: 'toggle_state', args: ['Device', 'parity', 'down'] }) && !par.down);
  ok('the disk log runs openTerminal as the row does', JSON.stringify(par.log) === JSON.stringify({ fn: 'openTerminal', args: ['disklog', 'sde', ''] }));
  ok('disk 1 is spun down and has no temperature', d1.down && d1.temp === null);
  ok('disk 1: file system, used, free and the bar width', d1.fs && d1.fs.fs === 'xfs' && d1.fs.used === '14.0 TB' && d1.fs.free === '1.97 TB' && Math.round(d1.fs.pct) === 88);
  ok('disk 1: errors and their tooltip, browse link', d1.errors === 3 && d1.errTip === 'Device errors: 3' && d1.browse === '/Main/Browse?dir=/mnt/disk1');
  ok('the state text keeps its line break', d1.stateTip === 'Datenträger im Standby-Modus (heruntergefahren)\nZum Starten des Datenträgers klicken');
  ok('the totals: label, rates and the array usage', arr.total.label === 'Array aus zwei Datenträgern' && arr.total.wrText === '12.5 MB/s' && arr.total.fs && arr.total.fs.used === '14.0 TB' && arr.total.fs.size === '16 TB');
  const badged = R.readArray(tbody(DISK1_BADGED)).disks[0];
  const keys = ['key', 'name', 'href', 'dev', 'kind', 'size', 'down', 'errors', 'errTip', 'browse', 'rdText', 'reads'];
  ok('a row shares.js has badged reads the same', !!badged && keys.every((k) => JSON.stringify(badged[k]) === JSON.stringify(d1[k])) && JSON.stringify(badged.fs.used) === '"14.0 TB"' && JSON.stringify(badged.spin) === JSON.stringify(d1.spin), badged && keys.filter((k) => JSON.stringify(badged[k]) !== JSON.stringify(d1[k])).join(','));
  ok('the state text comes from the bubble shares.js moved', !!badged && badged.stateTip === d1.stateTip);
  ok('a stopped array is left to the list, which holds the assignments', R.readArray(tbody(STOPPED)).offline);

  const pool = R.readPool(tbody(POOL));
  ok('a pool: its name, status, browse link and file system', pool.key === 'cache' && pool.name === 'Cache' && pool.status === 'ONLINE' && pool.browse === '/Main/Browse?dir=/mnt/cache' && pool.fs.fs === 'btrfs' && pool.fs.used === '811 GB');
  ok('its members, an NVMe stick and a SATA SSD', pool.disks.length === 2 && pool.disks[0].kind === 'nvme' && pool.disks[1].kind === 'ssd' && pool.disks[1].down);
  ok('a decimal comma reads as a decimal', pool.disks[0].wr === 53500);
  ok('the pool summary link is not taken for the settings link', pool.disks[0].href === '/Main/Device?name=cache');

  const boot = R.readBoot(tbody(BOOT));
  ok('the boot flash is a USB stick without a spin control', boot.disks.length === 1 && boot.disks[0].kind === 'usb' && !boot.disks[0].spin && boot.disks[0].href === '/Main/Boot?name=flash');
  ok('the internal boot hint is kept as a note', boot.notes.length === 1);

  const ud = R.readUd(tbody(UD));
  const u = ud.disks[0];
  ok('Unassigned Devices: one disk with its name and device', ud.disks.length === 1 && u.name === 'Elements' && u.dev === 'sdh' && u.kind === 'hdd' && !ud.unknown);
  ok('it spins down through UD\'s own call', JSON.stringify(u.spin) === JSON.stringify({ fn: 'spinDownDisk', args: ['sdh'] }) && !u.down);
  ok('the browse link comes from its partition row', u.browse === '/Main/Browse?dir=/mnt/disks/Elements');
  ok('usage, rate and temperature', u.fs && u.fs.fs === 'ntfs' && u.fs.used === '3.12 TB' && u.rd === 1.2e6 && u.temp.c === 31 && u.serial === 'TESTUD01');
  const none = R.readUd(tbody(UD_NONE));
  ok('no disks: UD\'s own notice is kept', none.disks.length === 0 && !none.unknown && none.notice === 'No Unassigned Disks available.');
  ok('an empty table is left to UD until it has answered', R.readUd(tbody('')).unknown);
}

console.log('\nThe actions run only the row\'s own calls');
{
  const calls = [];
  const win = { toggle_state: (...a) => calls.push(['toggle_state', ...a]), openTerminal: (...a) => calls.push(['openTerminal', ...a]), spinDownDisk: (...a) => calls.push(['spinDownDisk', ...a]), alert: () => calls.push(['alert']) };
  const loc = { href: '/Main' };
  const R = load({ window: win, location: loc });
  const d1 = R.readArray(tbody(DISK1)).disks[0];
  const card = { classList: { add() {} }, __ccDisk: d1 };
  R.act('spin', card);
  ok('spin calls toggle_state(\'Device\', \'disk1\', \'up\')', JSON.stringify(calls.pop()) === JSON.stringify(['toggle_state', 'Device', 'disk1', 'up']));
  R.act('log', card);
  ok('the log calls openTerminal(\'disklog\', \'sdf\', \'\')', JSON.stringify(calls.pop()) === JSON.stringify(['openTerminal', 'disklog', 'sdf', '']));
  R.act('browse', card);
  ok('browse goes where the row\'s browse link goes', loc.href === '/Main/Browse?dir=/mnt/disk1');
  const u = R.readUd(tbody(UD)).disks[0];
  R.act('spin', { classList: { add() {} }, __ccDisk: u });
  ok('a UD disk spins down through spinDownDisk(\'sdh\')', JSON.stringify(calls.pop()) === JSON.stringify(['spinDownDisk', 'sdh']));
  ok('a handler outside the list is never parsed', R.parseCall("alert('x')") === null && R.parseCall('disk_op(this, "umount", "sdh")') === null);

  // A click on the card opens the settings page; one on a badge runs the badge and not the link.
  const tree = parse('<div class="cc-dk-card"><span class="cc-dk-ib" data-act="spin">x</span><span class="cc-info">i</span><b>y</b></div>');
  const cardEl = tree.children[0];
  cardEl.__ccDisk = d1; cardEl.classList = { add() {} };
  const ev = (t) => ({ target: t, stopPropagation() {} });
  loc.href = '/Main';
  R.onClick(ev(cardEl.children[2]));
  ok('a click on the card opens the disk\'s settings', loc.href === '/Main/Device?name=disk1');
  loc.href = '/Main';
  R.onClick(ev(cardEl.children[0]));
  ok('a click on the spin badge spins and stays on the page', loc.href === '/Main' && JSON.stringify(calls.pop()) === JSON.stringify(['toggle_state', 'Device', 'disk1', 'up']));
  R.onClick(ev(cardEl.children[1]));
  ok('a click on the bubble stays on the page', loc.href === '/Main');
}

console.log('\nThe view: one switch and one key for the whole page');
{
  const store = {};
  const R = load({ g: (k, d) => (k in store ? store[k] : d) });
  ok('unset, the page shows tiles', R.view() === 'tiles');
  store['cc.diskview'] = 'list';
  ok('cc.diskview = list shows the list', R.view() === 'list');
  store['cc.diskview.pools'] = 'tiles';
  ok('a key left from a per-section switch changes nothing', R.view() === 'list');
  ok('the page switch writes cc.diskview', /s\(KEY, o\[0\]\)/.test(js) && /var KEY = "cc\.diskview";/.test(js) && !/KEY \+ "\."/.test(js));
  ok('there is one switch, at the right end of the tab bar before Unraid\'s own controls', /nav\.insertBefore\(sw, nav\.querySelector\(":scope > span\.status"\)\)/.test(js) && (js.match(/el\("div", "cc-dk-vsw"\)/g) || []).length === 1);
  const settings = read('scripts/settings.js');
  const row = grabFn(settings, 'diskViewRow');
  ok('the settings row writes the same key and nothing else', /set\("cc\.diskview", v\);/.test(row) && !/del\(/.test(row));
  ok('its bubble points to the switch on the page', /Der Schalter oben im Tab Start stellt dasselbe um\./.test(row) && /The switch at the top of the Main tab changes the same setting\./.test(row));
  ok('it offers Liste and Kacheln with the view glyphs', /\[\["list", T\("Liste", "List"\), "IconViewList"\], \["tiles", T\("Kacheln", "Tiles"\), "IconViewGrid"\]\]/.test(row));
  ok('it has a bubble and a preview right under its selector', /, help\)\);/.test(row) && /viewPreview\(opts, diskSketch\)/.test(row) && /c\.appendChild\(slot\); c\.appendChild\(prev\.el\);/.test(row));
  ok('a spun-down disk says "Ruht" once, where its temperature would be, never an active chip', /if \(d\.down\) return glyph\("Sleep"\) \+ esc\(t\("resting"\)\);/.test(js) && (js.match(/t\("resting"\)/g) || []).length === 1 && !/Aktiv/.test(js));
}

console.log('\nThe tile view hides the table controls');
{
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const hide = /([^{}]+)\{\s*display: none !important; \}/g;
  const hidden = [];
  let m;
  while ((m = hide.exec(rules))) hidden.push(...splitTop(m[1]).map((x) => x.trim()));
  ok('Unraid\'s span.status in the tab bar goes in the tile view', hidden.includes('html.cc-dk-on.cc-dk-tiled #displaybox nav.tabs > span.status'));
  // Shares.css shows it in section view with html.cc-shares-on.cc-on-main.cc-sections-main, four classes.
  ok('in section view the hide outranks Shares.css', hidden.includes('html.cc-dk-on.cc-dk-tiled.cc-on-main.cc-sections-main #displaybox .cc-card-head > span.status'));
  ok('only while no disk table of the array, the pools or the boot device shows', /root\.classList\.toggle\("cc-dk-tiled", tiles && !all\.some\(function \(S\) \{\s*return S\.key !== "ud"/.test(js));
  ok('Unassigned Devices keeps its controls, which still act on the tiles', !hidden.some((x) => /cc-ud-ctrls/.test(x)) && !/cc-ud-ctrls[^{}]*\{[^}]*(display: none|visibility: hidden|opacity: 0)/.test(rules));
}

console.log('\nEvery pool and section keeps its badge and stands beside the others where it fits');
{
  ok('each pool is headed by its own section badge', /'<span class="cc-dk-pb">' \+ esc\(p\.name\)/.test(js) && /\.cc-dk-pb \{[^}]*min-height: var\(--cc-sec-h, 22px\)[^}]*text-transform: uppercase/.test(css));
  ok('the boot device keeps its own section', !/cc-dk-merged/.test(js + css) && /function drawPools\(host, pools\)/.test(js));
  ok('the pools and the boot device are the sections that stand side by side', /S\.sec\.classList\.toggle\("cc-dk-side", tiles && !S\.data\.offline && \(S\.key === "pools" \|\| S\.key === "boot"\)\)/.test(js));
  ok('such a section is as wide as its content and as tall as its row, the page wraps the rest', /\.cc-sections-main #displaybox \{ display: flex; flex-wrap: wrap;/.test(css) && /#displaybox > section\.cc-dk-side \{ flex: 0 1 auto; align-self: stretch; width: auto; \}/.test(css));
  ok('a grid is as wide as its cards and wraps them when squeezed', /grid\.style\.setProperty\("--cc-dk-n", items\.length\)/.test(js) && /\.cc-dk-grid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(260px, 1fr\)\); gap: 12px; width: calc\(var\(--cc-dk-n, 1\) \* 272px - 12px\); max-width: 100%; \}/.test(css));
  ok('the array card hugs its row of disks', /\.cc-dk-host\[data-cc-dk="array"\] \{\s*box-sizing: border-box; width: fit-content; max-width: 100%;/.test(css));
  ok('the summary strips and the boot hint do not widen their card', /:is\(\.cc-dk-pool, \.cc-dk-host\) > :is\(\.cc-dk-sum, \.cc-dk-notes\) \{ contain: inline-size; \}/.test(css));
  ok('on a phone every card takes the full width', /@media \(max-width: 600px\) \{[^@]*\.cc-dk-grid \{ grid-template-columns: minmax\(0, 1fr\); width: auto; \}/.test(css));
  const ud = grabFn(js, 'udRow');
  ok('Unassigned Devices\' parts move into one wrapping row, and only those', /hasCls\(c, "show-disks"\) \|\| hasCls\(c, "show-shares"\)/.test(ud) && /el\("div", "cc-dk-udrow"\)/.test(ud) && /\.cc-dk-udrow \{ display: flex; flex-wrap: wrap;/.test(css));
  ok('each of the three is a card of its own with its badge on the edge', /\.cc-dk-box \.cc-dk-udrow > \* \{\s*box-sizing: border-box; padding: 0 16px 16px; background: var\(--cc-dk-sec\);/.test(css) && /margin: calc\(var\(--cc-sec-h, 22px\) \/ -2\) 0 13px !important;/.test(css));
  ok('beside the tables the disks are one card wide and take the rest of the row', /\.cc-dk-udrow > \.show-disks:not\(:has\(> \.show-historical\)\) \{ flex: 1 1 292px; max-width: max-content; \}/.test(css) && /\.usage-disk:not\(\.sys\):not\(\.mm\) \{ min-width: 72px; \}/.test(css));
  ok('every section badge sits on its card\'s top edge', /section\.cc-dk-box > \.cc-card-head \{\s*position: absolute; top: 0; left: 16px; z-index: 1; transform: translateY\(-50%\);/.test(css) && /\.cc-dk-aopt \{ position: absolute; top: 0; left: 16px; z-index: 1; display: flex; margin: 0; transform: translateY\(-50%\); \}/.test(css));
  ok('the array and parity states are chips filled in the state colour with its ink', /\.cc-aop-pills > \.cc-aop-status\.cc-aop-ok \{ background: var\(--cc-ok\); color: var\(--cc-ok-fg\); \}/.test(css) && /\.cc-aop-pills > \.cc-aop-status\.cc-aop-warn \{ background: var\(--cc-warn\); color: var\(--cc-warn-fg\); \}/.test(css) && /\.cc-aop-pills > \.cc-b\.cc-aop-status \{[^}]*background: var\(--cc-err\); color: var\(--cc-err-fg\);/.test(css));
  ok('the chips carry no state dot, not even the one Shares.css gives a green state', /\.cc-aop-pills > \.cc-aop-status::before \{ content: none; \}/.test(css));
  const lv = grabFn(js, 'level');
  ok('beside the pools the boot cards drop by a pool\'s badge row, wrapped below they do not', /pool\.closest\("section"\)\.getBoundingClientRect\(\)\.top - boot\.closest\("section"\)\.getBoundingClientRect\(\)\.top\) < 1/.test(lv) && /boot\.style\.paddingTop = lift > 0 \? lift \+ "px" : "";/.test(lv));
  ok('the levelling follows every render and a resize', /\n    level\(\);\n  \}/.test(js) && /window\.addEventListener\("resize", level\);/.test(js));
  ok('leaving the page puts them back where UD wrote them', /while \(r\.firstChild\) r\.parentNode\.insertBefore\(r\.firstChild, r\);/.test(grabFn(js, 'teardown')));

  const R = load({});
  const node = (id) => ({ id, parentNode: null });
  const parent = { children: [] };
  parent.insertBefore = (c, ref) => { if (c.parentNode) c.parentNode.removeChild(c); const i = ref ? parent.children.indexOf(ref) : parent.children.length; parent.children.splice(i, 0, c); c.parentNode = parent; };
  parent.removeChild = (c) => { parent.children.splice(parent.children.indexOf(c), 1); c.parentNode = null; };
  Object.defineProperty(parent, 'lastChild', { get: () => parent.children[parent.children.length - 1] });
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(node);
  [a, b, c].forEach((n) => parent.insertBefore(n, null));
  R.order(parent, [c, a, d]);
  ok('the rows keep the order they are given and lose what is left over', parent.children.map((n) => n.id).join('') === 'cad');
}

console.log('\nThe capacity has a badge of its own');
{
  ok('beside the name on every card that knows its size', /<span class="cc-dk-nb">' \+ esc\(d\.name\) \+ "<\/span>" \+ \(d\.size \? '<span class="cc-dk-cap">' \+ esc\(cap\(d\.size\)\)/.test(js));
  const R = load({});
  ok('whole sizes read as Unraid prints them', R.cap(18e12) === '18 TB' && R.cap(500e9) === '500 GB' && R.cap(63.1e9) === '63 GB');
  ok('a size under ten keeps its decimal', R.cap(1.5e12) === '1.5 TB' && R.cap(2e12) === '2 TB');
  ok('the drawing keeps a margin to the edge of its well', /\.cc-dk-art \{[^}]*height: 140px;/.test(css) && /\.cc-dk-art \.cc-dk-drive \{ position: absolute; inset: 14px 12px;/.test(css));
}

console.log('\nA card shows only what deviates');
{
  const src = ['var TXT = ' + /var TXT = (\{[\s\S]*?\n  \});/.exec(js)[1] + ';', grabFn(js, 't'), grabFn(js, 'esc'), grabFn(js, 'chipsHtml')].join('\n') + '\nreturn chipsHtml;';
  const extra = {};
  const chips = new Function('extra', 'LANG', 'nf', src)(extra, 'de', { format: String });
  const disk = (o) => Object.assign({ dev: 'sdf', state: 'ok', stateTip: '', parity: false, errors: 0, errTip: '' }, o);
  extra.sdf = { smart: 'ok' };
  ok('a healthy disk with SMART ok and no errors shows no chip', chips(disk({})) === '');
  extra.sdf = { smart: 'warn', tip: 'Reallocated sectors: 8' };
  ok('a SMART warning shows the moment disks.php reports it', /class="cc-dk-chip cc-dk-warn" data-tip="Reallocated sectors: 8"[^>]*>.*SMART-Warnung/.test(chips(disk({}))));
  extra.sdf = { smart: 'fail' };
  ok('a failed SMART test shows in red', /cc-dk-chip cc-dk-err[^>]*>.*SMART-Fehler/.test(chips(disk({}))));
  extra.sdf = { smart: 'ok' };
  const err = chips(disk({ errors: 3, errTip: 'Device errors: 3' }));
  ok('errors show in red with their count and Unraid\'s bubble', /^<span class="cc-dk-chip cc-dk-err" data-tip="Device errors: 3">3 Fehler<\/span>$/.test(err), err);
  ok('a disk Unassigned Devices counts no errors for shows none', chips(disk({ errors: null })) === '');
  ok('a state that is not normal keeps its chip', /cc-dk-chip cc-dk-err/.test(chips(disk({ state: 'err', stateTip: 'Datenträger deaktiviert' }))));
  ok('the chips are written again on every refill, so they follow the feed', /setHtml\(c\.querySelector\('\[data-f="chips"\]'\), chipsHtml\(d\)\);/.test(grabFn(js, 'patch')) && !/smartOk/.test(js));
  ok('an empty chip row takes no room', /html\.cc-dk-on #displaybox \.cc-dk-chips:empty,/.test(css) && !/\.cc-dk-chips \{[^}]*min-height/.test(css));
  ok('read and write show only while the disk is busy, the temperature always', /<div class="cc-dk-rate">' \+ esc\(t\("read"\)\)/.test(js) && /<div class="cc-dk-rate">' \+ esc\(t\("write"\)\)/.test(js) && /html\.cc-dk-on #displaybox \.cc-dk-card:not\(\.cc-dk-busy\) \.cc-dk-rate \{ display: none; \}/.test(css) && /<div>' \+ esc\(t\("temp"\)\)/.test(js));
}

console.log('\nThe array is a card of its own, first among its disks, with a vessel for its drawing');
{
  // A DOM just big enough for the card: innerHTML, a class or data-f lookup, classList and style.
  const dom = (tag) => {
    const n = { tagName: tag.toUpperCase(), attrs: {}, children: [], parentNode: null, textContent: '', listeners: {} };
    n.style = { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
    Object.defineProperty(n, 'className', { get: () => n.attrs.class || '', set: (v) => { n.attrs.class = v; } });
    const has = (c) => (' ' + (n.attrs.class || '') + ' ').includes(' ' + c + ' ');
    n.classList = { contains: has, add: (c) => { if (!has(c)) n.attrs.class = ((n.attrs.class || '') + ' ' + c).trim(); }, remove: (c) => { n.attrs.class = (' ' + (n.attrs.class || '') + ' ').replace(' ' + c + ' ', ' ').trim(); } };
    n.classList.toggle = (c, on) => { if (on) n.classList.add(c); else n.classList.remove(c); };
    n.appendChild = (c) => n.insertBefore(c, null);
    n.insertBefore = (c, ref) => { if (c.parentNode) c.parentNode.removeChild(c); const i = ref ? n.children.indexOf(ref) : n.children.length; n.children.splice(i, 0, c); c.parentNode = n; return c; };
    n.removeChild = (c) => { n.children.splice(n.children.indexOf(c), 1); c.parentNode = null; return c; };
    n.addEventListener = (k, f) => { n.listeners[k] = f; };
    const match = (sel) => { const m = /^\[data-f="(\w+)"\]$/.exec(sel); return m ? (c) => c.attrs['data-f'] === m[1] : (c) => c.classList.contains(sel.slice(1)); };
    n.querySelector = (sel) => {
      const direct = /^:scope > (.+)$/.exec(sel), pred = match(direct ? direct[1] : sel);
      const go = (p) => { for (const c of p.children) { if (pred(c)) return c; if (!direct) { const r = go(c); if (r) return r; } } return null; };
      return go(n);
    };
    Object.defineProperty(n, 'innerHTML', {
      set(html) {
        n.children = [];
        const re = /<\/([a-z]+)\s*>|<([a-z]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|[^<]+/g;
        let cur = n, m;
        while ((m = re.exec(html))) {
          if (m[1]) { cur = cur.parentNode; continue; }
          if (!m[2]) { cur.textContent += m[0]; continue; }
          const c = dom(m[2]);
          (m[3] || '').replace(/([^\s=]+)="([^"]*)"/g, (x, k, v) => { c.attrs[k] = v; });
          cur.appendChild(c);
          if (!m[4] && !/^(path|circle)$/.test(m[2])) cur = c;
        }
      }
    });
    return n;
  };
  const made = [];
  const pictures = { vessel(o) { const v = { el: dom('span'), o, level: null, tone: null, setLevel(s) { v.level = s; return v; }, setTone(t) { v.tone = t; return v; } }; made.push(v); return v; } };
  const helpers = ['totalCard', 'fillTone', 'setText', 'setHtml', 't', 'esc', 'fill', 'el', 'cap', 'bytes', 'clean', 'rate', 'lvl', 'ink', 'hold'];
  const src = ['var TXT = ' + /var TXT = (\{[\s\S]*?\n  \});/.exec(js)[1] + ';', grabVar(js, 'POW'), grabVar(js, 'INFO'), grabVar(js, 'HOLD')].concat(helpers.map((n) => grabFn(js, n))).join('\n') + '\nreturn totalCard;';
  const totalCard = new Function('window', 'document', 'LANG', 'nf', 'setTimeout', 'clearTimeout', src)({ CCPictures: pictures }, { createElement: dom }, 'de', { format: String }, () => 0, () => {});
  const grid = dom('div');
  const total = { label: 'Array aus fünf Datenträgern', temp: { shown: 34, c: 34, unit: 'C' }, rdText: '0.0 B/s', wrText: '0.0 B/s', fs: { size: '52 TB', used: '43.9 TB', free: '8.12 TB', pct: 84.4 } };
  const c = totalCard(grid, total, '');
  grid.appendChild(c);
  const v = made[0];
  const f = (k) => c.querySelector('[data-f="' + k + '"]');
  ok('a card like a disk\'s: the drawing well, the name row, the use row and the readings', c.classList.contains('cc-dk-card') && c.classList.contains('cc-dk-total') && ['cc-dk-art', 'cc-dk-namerow', 'cc-dk-model', 'cc-dk-use', 'cc-dk-io'].every((k) => !!c.querySelector('.' + k)));
  ok('the vessel stands in the drawing well, with the array\'s share and a label', c.querySelector('.cc-dk-art').children[0] === v.el && Math.abs(v.o.share - 0.844) < 1e-9 && Math.abs(v.level - 0.844) < 1e-9 && v.o.label === 'Füllstand des Arrays');
  ok('its badge says Array beside the whole size', c.querySelector('.cc-dk-nb').textContent === 'Array' && f('cap').textContent === '52 TB');
  ok('Unraid\'s label stands where a disk names its model', f('label').textContent === 'Array aus fünf Datenträgern');
  ok('used, share and free read as on a disk card, the bar at the share', f('used').textContent === '43.9 TB' && f('pct').textContent === '84' && f('free').textContent === '8.12 TB frei' && f('fill').style.width === '84.4%' && f('fill').classList.contains('cc-dk-warn'));
  ok('the bubble names used and size and when the vessel changes colour', f('tip').getAttribute('data-tip') === '43.9 TB von 52 TB belegt. Ab 90 % wird das Gefäß orange, über 95 % rot.');
  ok('the temperature is the average, and says so in its bubble', /Ø 34 °C/.test(f('temp').__ccHtml) && f('temp').getAttribute('data-tip') === 'Mittelwert der Datenträger, die gerade eine Temperatur melden');
  ok('below 90 % the vessel takes the accent, and an idle array shows no rates', v.tone === 'accent' && !c.classList.contains('cc-dk-busy'));
  ok('it takes no focus and opens nothing, so no key or click leads anywhere', !('tabindex' in c.attrs) && !('role' in c.attrs) && !c.__ccDisk);
  totalCard(grid, Object.assign({}, total, { rdText: '3.1 MB/s', fs: Object.assign({}, total.fs, { pct: 90 }) }), '');
  ok('reading, it shows the rates, as a busy disk does', c.classList.contains('cc-dk-busy') && f('rd').textContent === '3.1 MB/s');
  ok('from 90 % the vessel turns orange, on the same card and vessel', made.length === 1 && grid.querySelector(':scope > .cc-dk-total') === c && v.tone === 'warn' && v.level === 0.9);
  totalCard(grid, Object.assign({}, total, { fs: Object.assign({}, total.fs, { pct: 95 }) }), '');
  ok('95 % is still orange', v.tone === 'warn');
  totalCard(grid, Object.assign({}, total, { temp: null, fs: Object.assign({}, total.fs, { pct: 95.2 }) }), '#FF832B');
  ok('past 95 % it turns red', v.tone === 'err');
  ok('with every disk asleep the temperature reads as on a disk that measures none', /cc-dk-idle"><\/span>\*$/.test(f('temp').__ccHtml));
  ok('in the rainbow it wears its colour and the ink that goes with it', c.style.props['--cc-dk-c'] === '#FF832B' && c.style.props['--cc-dk-ct'] === '#161616');
  ok('without a file system the card goes', totalCard(grid, Object.assign({}, total, { fs: null }), '') === null && grid.children.length === 0);
  const rs = grabFn(js, 'renderSection');
  ok('the render makes it the grid\'s lead and counts it in the grid\'s width', /var lead = S\.key === "array" \? totalCard\(grid, data\.total, colourAt\(data\.disks\.length\)\) : null;/.test(rs) && /grid\.style\.setProperty\("--cc-dk-n", data\.disks\.length \+ \(lead \? 1 : 0\)\);/.test(rs) && /fillGrid\(grid, cardsOf\(data\.disks, 0\), colourAt, lead\);/.test(rs));
  ok('the mover still reads the array\'s share from the totals row', /arrayUse = data\.total && data\.total\.fs;/.test(rs));
  ok('no strip and no vessel column are left beside the disks', !/cc-dk-vessel|arrayVessel/.test(js + css) && !/sumHtml\(data\.total/.test(js));
  ok('its vessel sits in the middle of the well, as large as before', /\.cc-dk-total \.cc-vessel \{[^}]*position: absolute; inset: 0; width: 88px; height: 104px; margin: auto;/.test(css));
  ok('it keeps the plain cursor and its surface under the pointer', /\.cc-dk-total \{ cursor: default; \}/.test(css) && /\.cc-dk-total:is\(:hover, :focus-within\) \{ background: var\(--cc-dk-card\); \}/.test(css));

  const fg = new Function('kids', 'attr', 'ink', 'shapeOf', 'newCard', 'patch', grabFn(js, 'fillGrid') + '\nreturn fillGrid;')(
    (n) => n.children.slice(), (n, k) => n.getAttribute(k) || '', () => '', (d) => d.key, (d) => { const n = dom('div'); n.setAttribute('data-key', d.key); n.__ccShape = d.key; return n; }, () => {});
  const g2 = dom('div'), lead = dom('div');
  const items = ['parity', 'disk1'].map((k, i) => ({ d: { key: k }, ctx: {}, n: i }));
  fg(g2, items, () => '');
  const parity = g2.children[0];
  fg(g2, items, () => '', lead);
  ok('the grid takes the lead first and keeps the disk cards it had, in their order', g2.children[0] === lead && g2.children[1] === parity && g2.children.map((n) => n.getAttribute('data-key')).slice(1).join() === 'parity,disk1');
  fg(g2, items, () => '', lead);
  ok('a refill keeps the lead where it is', g2.children[0] === lead && g2.children.length === 3);
}

console.log('\nA disk that reads in bursts keeps working, and its platter runs up and coasts down');
{
  const names = ['busy', 'pace', 'hold', 'still', 'ms', 'flows', 'toward', 'motion', 'glide', 'tick'];
  const src = [grabVar(js, 'HOLD'), grabVar(js, 'UP'), grabVar(js, 'FLOWS')].concat(names.map((n) => grabFn(js, n))).join('\n') + '\nreturn {' + names.join(',') + '};';
  // A clock that runs the due timers and one animation frame every 16 ms.
  const make = (opts = {}) => {
    const env = { now: 1e6, timers: [], frames: [] };
    const M = new Function('document', 'window', 'getComputedStyle', 'requestAnimationFrame', 'Date', 'setTimeout', 'clearTimeout', src)(
      { documentElement: { getAttribute: () => (opts.off ? 'off' : null) } },
      { matchMedia: () => ({ matches: !!opts.reduced }) },
      () => ({ getPropertyValue: () => ' 1.5s' }),
      (f) => env.frames.push(f),
      { now: () => env.now },
      (f, ms) => { const t = { f, at: env.now + ms }; env.timers.push(t); return t; },
      (t) => { env.timers = env.timers.filter((x) => x !== t); });
    const cls = new Set();
    // A rate assigned straight to playbackRate is counted, since in Chrome it holds a starting
    // animation still; updatePlaybackRate is the call that lets it run.
    let rate = 1;
    const spin = { playState: 'running', currentTime: 0, made: 0, cancelled: false, duration: 0, assigned: 0 };
    Object.defineProperty(spin, 'playbackRate', { get: () => rate, set: (v) => { rate = v; spin.assigned++; } });
    Object.assign(spin, { updatePlaybackRate(v) { rate = v; }, pause() { spin.playState = 'paused'; }, play() { spin.playState = 'running'; }, cancel() { spin.cancelled = true; },
      effect: { getTiming: () => ({ duration: spin.duration }), updateTiming: (t) => { spin.duration = t.duration; } } });
    const flow = { animationName: 'cc-dk-flow', playbackRate: 1 };
    const plat = { animate: (kf, o) => { spin.made++; spin.duration = o.duration; spin.kf = kf; return spin; } };
    const card = { isConnected: true, classList: { contains: (c) => cls.has(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) },
      querySelector: (s) => (s === '.cc-dk-plat' ? plat : null), getAnimations: () => [flow, { animationName: 'cc-dk-blink', playbackRate: 1 }] };
    const feed = (rd) => { const d = { rd, wr: 0, down: false }; if (M.busy(d)) card.__ccPace = M.pace(d); M.hold(card, M.busy(d), M.motion); };
    const samples = [];
    const run = (ms) => {
      const end = env.now + ms;
      while (env.now < end) {
        env.now += 16;
        const due = env.timers.filter((t) => t.at <= env.now);
        env.timers = env.timers.filter((t) => t.at > env.now);
        due.forEach((t) => t.f());
        const fr = env.frames; env.frames = [];
        fr.forEach((f) => f(env.now));
        samples.push({ t: env.now, busy: cls.has('cc-dk-busy'), rate: spin.playState === 'running' ? spin.playbackRate : 0, flow: flow.playbackRate });
      }
    };
    return { env, M, cls, spin, flow, feed, run, samples };
  };

  const a = make(), t0 = a.env.now;
  for (let i = 0; i < 8; i++) { a.feed(i % 2 ? 0 : 40e6); a.run(1000); }
  const burst = a.samples.slice();
  ok('the hold keeps a disk that reads in bursts busy the whole time', burst.every((s) => s.busy));
  const up = burst.filter((s) => s.t <= t0 + 1200);
  const steps = up.slice(1).map((s, i) => s.rate - up[i].rate);
  ok('the platter runs up from rest in small steps instead of starting at full speed', up[0].rate < 0.05 && steps.every((d) => d >= 0 && d < 0.06) && up.some((s) => s.rate > 0.3 && s.rate < 0.7), up.slice(0, 6).map((s) => s.rate.toFixed(2)).join(' '));
  ok('it changes speed through updatePlaybackRate, so the compositor does not hold a run-up from rest still', a.spin.assigned === 0 && up.some((s) => s.rate > 0.3 && s.rate < 0.7), a.spin.assigned + ' assignments');
  ok('it reaches full speed within a second and keeps it through the gaps between the bursts', burst.filter((s) => s.t >= t0 + 1000).every((s) => s.rate === 1 && a.spin.playState === 'running'));
  ok('the platter is one animation, a full turn at the spin dial, made once', a.spin.made === 1 && a.spin.duration === 1500 && a.spin.kf[1].rotate === '360deg');

  const H = Number(/var HOLD = (\d+);/.exec(js)[1]);
  a.samples.length = 0;
  a.run(H - 2000 - 200);
  ok('after the last rate above zero it stays busy for the hold', a.samples.every((s) => s.busy));
  a.run(2600);
  const tail = a.samples.filter((s) => !s.busy);
  const down = tail.slice(1).map((s, i) => s.rate - tail[i].rate);
  ok('then it stops being busy', tail.length > 0 && !a.cls.has('cc-dk-busy'));
  ok('the platter coasts down in small steps', down.every((d) => d <= 0 && d > -0.06) && tail.some((s) => s.rate > 0.3 && s.rate < 0.7), tail.slice(0, 6).map((s) => s.rate.toFixed(2)).join(' '));
  ok('and stays where it ran out, paused rather than reset', a.spin.playState === 'paused' && !a.spin.cancelled && a.env.frames.length === 0);

  const b = make();
  b.feed(40e6); b.run(1000); b.feed(40e6); b.run(1000); b.feed(0); b.run(H - 1000 + 600);
  const mid = b.samples[b.samples.length - 1].rate;
  b.samples.length = 0;
  b.feed(40e6); b.run(400);
  ok('a start while it coasts speeds up from where it is', mid > 0.2 && mid < 1 && b.samples.every((s) => s.rate >= mid - 1e-9) && b.samples.slice(1).every((s, i) => s.rate >= b.samples[i].rate), mid.toFixed(2));

  // An array disk that writes once every 6.4 s, quiet for 5.4 s in between.
  const p = make();
  for (let i = 0; i < 32; i++) { p.feed(i % 6.4 < 1 ? 2e6 : 0); p.run(1000); }
  ok('a disk that writes every six and a half seconds stays busy and its platter at full speed throughout', p.samples.every((s) => s.busy) && p.samples.filter((s) => s.t > p.samples[0].t + 1000).every((s) => s.rate === 1));

  const c = make();
  c.feed(40e6); c.run(500);
  const slow = c.flow.playbackRate;
  c.samples.length = 0;
  c.feed(160e6); c.run(1500);
  const glide = c.samples.map((s) => s.flow);
  ok('the flow starts at the pace of the rate', Math.abs(slow - 1 / 0.75) < 1e-9);
  ok('a faster rate glides the flow to its pace instead of jumping', Math.abs(glide[glide.length - 1] - 2) < 1e-9 && glide.slice(1).every((v, i) => v - glide[i] >= 0 && v - glide[i] < 0.03) && glide.some((v) => v > 1.5 && v < 1.9), glide.slice(0, 5).map((v) => v.toFixed(2)).join(' '));

  for (const [label, opts] of [['motion "off"', { off: true }], ['reduced motion', { reduced: true }]]) {
    const s = make(opts);
    for (let i = 0; i < 4; i++) { s.feed(i % 2 ? 0 : 40e6); s.run(1000); }
    ok('at ' + label + ' the platter stands still while the card shows it is busy', s.spin.made === 0 && s.samples.every((x) => x.busy) && s.env.frames.length === 0);
  }
  ok('the card keeps the rates in view for as long as it counts as busy', /hold\(c, busy\(d\), motion\);/.test(grabFn(js, 'patch')) && /hold\(c, rate\(total\.rdText\) > 0 \|\| rate\(total\.wrText\) > 0\);/.test(grabFn(js, 'totalCard')));
}

console.log('\nThe boot hint stands beside the boot card');
{
  ok('a hint turns the boot section into a row, the hint a column as tall as the card', /\.cc-dk-host\[data-cc-dk="boot"\]:has\(> \.cc-dk-notes\) \{ display: flex; align-items: stretch; gap: 12px; \}/.test(css) && /\.cc-dk-host\[data-cc-dk="boot"\] > \.cc-dk-notes \{\s*flex: 0 0 168px;[^}]*margin-top: 0;/.test(css));
  ok('the hint reads quiet, in dimmed text on a faint surface', /\.cc-dk-host\[data-cc-dk="boot"\] > \.cc-dk-notes \{[^}]*background: color-mix\(in srgb, var\(--cc-dk-card\) 50%, transparent\); color: var\(--cc-text-dim\);/.test(css));
  ok('on a phone it goes back under the card', /@media \(max-width: 600px\) \{\s*html\.cc-dk-on #displaybox \.cc-dk-host\[data-cc-dk="boot"\]:has\(> \.cc-dk-notes\) \{ display: block; \}\s*html\.cc-dk-on #displaybox \.cc-dk-host\[data-cc-dk="boot"\] > \.cc-dk-notes \{ margin-top: 12px; \}/.test(css));
  const kidsOf = [];
  const host = { children: kidsOf, querySelector: () => kidsOf.find((k) => k.className.includes('cc-dk-notes')) || null, appendChild: (n) => { kidsOf.push(n); return n; }, removeChild: (n) => { kidsOf.splice(kidsOf.indexOf(n), 1); } };
  const notesStrip = new Function('el', 'setHtml', grabFn(js, 'notesStrip') + '\nreturn notesStrip;')((t, c) => ({ tagName: t, className: c }), (n, h) => { n.html = h; });
  kidsOf.push({ className: 'cc-dk-grid' });
  notesStrip(host, [{ innerHTML: 'Kein internes Boot-Setup erkannt. <a href="/Tools/Wizards/InternalBootWizard">Internal Boot</a> starten.' }]);
  ok('the hint follows the card, its link kept', kidsOf.length === 2 && kidsOf[1].className === 'cc-dk-sum cc-dk-notes' && /<a href="\/Tools\/Wizards\/InternalBootWizard">Internal Boot<\/a>/.test(kidsOf[1].html));
  notesStrip(host, []);
  ok('without a hint the section keeps the card alone, as before', kidsOf.length === 1 && kidsOf[0].className === 'cc-dk-grid');
}

console.log('\ndisks.php reads emhttp\'s own files');
{
  // A PHP build may leave ctype, mbstring or iconv out, and the CI runs php -n, which loads none.
  const phpSrc = fs.readFileSync(path.join(DIR, 'server', 'disks.php'), 'utf8');
  ok('it calls no function from an optional PHP extension', !/\b(ctype_|mb_|iconv)\w*\(/.test(phpSrc));
  let php = null;
  try { execFileSync('php', ['-v'], { stdio: 'ignore' }); php = 'php'; } catch (e) {}
  if (!php) ok('php is not installed here, so the endpoint check is skipped', true);
  else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-disks-'));
    fs.mkdirSync(path.join(tmp, 'smart'));
    fs.writeFileSync(path.join(tmp, 'disks.ini'), '["parity"]\nname="parity"\ndevice="sde"\nrotational="1"\n["disk1"]\nname="disk1"\ndevice="sdf"\nrotational="1"\nhotTemp="40"\nmaxTemp="50"\n["cache"]\nname="cache"\ndevice="nvme0n1"\nrotational="0"\n["disk2"]\nname="disk2"\ndevice="sdd"\nrotational="1"\n');
    const head = 'smartctl 7.4\n\n=== START OF READ SMART DATA SECTION ===\n';
    const table = 'ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE\n';
    fs.writeFileSync(path.join(tmp, 'smart', 'parity'), head + 'SMART overall-health self-assessment test result: PASSED\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       0\n  9 Power_On_Hours          0x0012   098   098   000    Old_age   Always       -       19756\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'disk1'), head + 'SMART overall-health self-assessment test result: PASSED\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       8\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'disk2'), head + 'SMART overall-health self-assessment test result: FAILED!\n\n' + table + '  5 Reallocated_Sector_Ct   0x0033   100   100   005    Pre-fail  Always       -       8\n');
    fs.writeFileSync(path.join(tmp, 'smart', 'cache'), head + 'SMART overall-health self-assessment test result: PASSED\n\nPercentage Used:                    7%\nPower On Hours:                     1,215\n');
    fs.writeFileSync(path.join(tmp, 'monitor.ini'), '');
    fs.writeFileSync(path.join(tmp, 'dynamix.cfg'), '[display]\nhot="46"\nmax="56"\n');
    const run = () => JSON.parse(execFileSync(php, ['-n', path.join(DIR, 'server', 'disks.php')], { env: Object.assign({}, process.env, { CC_EMHTTP: tmp, CC_DYNAMIX_CFG: path.join(tmp, 'dynamix.cfg'), CC_DYNAMIX_DEFAULT: path.join(tmp, 'none.cfg') }) }).toString());
    let out = run();
    ok('a passing disk is ok, with its power-on hours and the display thresholds', out.sde && out.sde.smart === 'ok' && out.sde.hours === 19756 && out.sde.hot === 46 && out.sde.max === 56, JSON.stringify(out.sde));
    ok('a reallocated sector is a warning that names the attribute', out.sdf && out.sdf.smart === 'warn' && /Reallocated Sector Ct: 8/.test(out.sdf.tip), JSON.stringify(out.sdf));
    ok('a disk\'s own thresholds win', out.sdf.hot === 40 && out.sdf.max === 50);
    ok('a failed self-assessment is a failure', out.sdd && out.sdd.smart === 'fail', JSON.stringify(out.sdd));
    ok('an NVMe disk reports its wear and hours, with the SSD thresholds', out.nvme0n1 && out.nvme0n1.wear === 7 && out.nvme0n1.hours === 1215 && out.nvme0n1.hot === 60 && out.nvme0n1.max === 70, JSON.stringify(out.nvme0n1));
    fs.writeFileSync(path.join(tmp, 'monitor.ini'), '[smart]\ndisk1.ack="true"\n');
    out = run();
    ok('an acknowledged warning stays quiet', out.sdf.smart === 'ok', JSON.stringify(out.sdf));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
