// The share tiles on /Shares (TowerTorch.Shares.page, Shares.css, sharetiles.js).
// What can quietly break it:
//   · a tile rule that is not gated on html.cc-sht-on restyles /Shares with the tiles off
//   · a reader that only knows Unraid's plain rows and loses a share once shares.js has badged them
//   · the per-disk breakdown Compute adds, read as a share of its own
//   · an action that does anything but click the control the row itself carries
//   · a second key for the view, or a settings row that writes another one
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function splitTop(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = read('scripts/sharetiles.js');
const css = read('sheets/TowerTorch.Shares.css');
const page = read('TowerTorch.Shares.page');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function grabVar(src, name) { const m = new RegExp('var ' + name + ' = [^\\n]+;').exec(src); if (!m) throw new Error('var not found: ' + name); return m[0]; }

// A small HTML tree with what the readers use: children, childNodes, tagName, getAttribute and
// parentNode. An anchor records its clicks, so the actions can be checked.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#\d+|\w+);/g, (m, e) => e[0] === '#' ? String.fromCodePoint(+e.slice(1)) : (ENT[e] ?? m));
function el(tag, attrs, parent) {
  const n = { nodeType: 1, tagName: tag.toUpperCase(), attrs, children: [], childNodes: [], parentNode: parent, clicks: 0, held: 0 };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.addEventListener = (type, fn) => { n.hold = fn; };
  n.click = () => { n.clicks++; if (n.hold) { n.hold({ preventDefault() { n.held++; } }); n.hold = null; } };
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
  const VOID = new Set(['br', 'img', 'input']);
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

const READERS = ['kids', 'tag', 'attr', 'hasCls', 'find', 'text', 'clean', 'esc', 'bytes', 'cells', 'computeLink', 'waiting', 'storage', 'readRow', 'readList', 'usage', 'press', 'run', 'cardOf', 'onClick', 'view'];
function load(env) {
  const src = [grabVar(js, 'POW'), grabVar(js, 'KEY')].concat(READERS.map((n) => grabFn(js, n))).join('\n') + '\nreturn {' + READERS.join(',') + '};';
  return new Function('window', 'location', 'g', src)(env.window || {}, env.location || {}, env.g || (() => null));
}

// Rows as ShareList.php and DiskList.php write them (names made up).
const MEDIA = `<tr><td><a class='view' href="/Shares/Browse?dir=/mnt/user/media"><i class="icon-u-tab" title="Durchsuchen /mnt/user/media"></i></a><a class='info nohand' onclick='return false'><i class='fa fa-circle orb green-orb'></i><span style='left:18px'>Alle Dateien geschützt</span></a><a href="/Shares/Share?name=media" onclick="$.cookie('one','tab1')">media</a></td><td>Filme &amp; Serien</td><td><em>Privat</em></td><td>-</td><td><a class='hand info none' onclick='return false'><i class='fa fa-bullseye fa-fw'></i>Cache <i class='fa fa-arrow-right fa-fw'></i><i class='fa fa-database fa-fw'></i>Array<span>Primärer Speicher zu sekundärem Speicher</span></a></td><td><a href='#' onclick="computeShare('media',$(this))">Berechnen...</a></td><td>9.09 TB</td></tr>`;
const BACKUP = `<tr><td><a class='view' href="/Shares/Browse?dir=/mnt/user/backup"><i class="icon-u-tab"></i></a><a class='info nohand' onclick='return false'><i class='fa fa-warning orb yellow-orb'></i><span style='left:18px'>Einige oder alle Dateien sind ungeschützt</span></a><a href="/Shares/Share?name=backup" onclick="$.cookie('one','tab1')">backup</a></td><td></td><td>-</td><td>Öffentlich</td><td><a class='hand info none' onclick='return false'><i class='fa fa-database fa-fw'></i>Array<span>Primärer Speicher Array</span></a></td><td>6.21 TB</td><td>8.12 TB</td></tr>` +
  `<tr class=''><td><a class='view'></a><a href='#' title='Neu berechnen...' onclick="computeShare('backup',$(this).parent())"><i class='fa fa-refresh icon'></i></a>&nbsp;Datenträger 1</td><td></td><td></td><td></td><td></td><td>3.10 TB</td><td>1.97 TB</td></tr>` +
  `<tr class='warning'><td><a class='view'></a><a href='#' title='Neu berechnen...' onclick="computeShare('backup',$(this).parent())"><i class='fa fa-refresh icon'></i></a>&nbsp;Datenträger 3</td><td><em>Freigabe liegt außerhalb der Liste der zugewiesenen Datenträger</em></td><td></td><td></td><td></td><td>1.10 TB</td><td>2 TB</td></tr>`;
// The same media row once shares.js has badged it: a Browse column, the shield, the cells wrapped.
const MEDIA_BADGED = `<tr data-cc-sh="1"><td><span class="cc-shield cc-shield-ok" role="img" tabindex="0" data-tip="Alle Dateien geschützt" aria-label="Alle Dateien geschützt"><svg class="cc-glyph" viewBox="0 -0.018 14 14"><path d="M14 4.809Z"/></svg></span><a class="info nohand" onclick="return false" style="display: none !important;"><i class="fa fa-circle orb green-orb"></i><span style="left:18px">Alle Dateien geschützt</span></a><a href="/Shares/Share?name=media" onclick="$.cookie('one','tab1')" class="cc-b cc-b-name">media</a></td><td class="cc-browse-col"><a class="view cc-b-browse" href="/Shares/Browse?dir=/mnt/user/media"><span class="cc-b-lab">Durchsuchen</span></a></td><td>Filme &amp; Serien</td><td><span class="cc-b"><span class="cc-b-v"><em>Privat</em></span></span></td><td>-</td><td><span class="cc-b"><span class="cc-b-v"><a class='hand info none' onclick='return false'><i class='fa fa-bullseye fa-fw'></i>Cache <i class='fa fa-arrow-right fa-fw'></i><i class='fa fa-database fa-fw'></i>Array<span>Primärer Speicher zu sekundärem Speicher</span></a></span></span></td><td><span class="cc-b"><span class="cc-b-v"><a href="#" onclick="computeShare('media',$(this))">Berechnen</a></span></span></td><td><span class="cc-b"><span class="cc-b-v">9.09 TB</span></span></td></tr>`;
const DISK1 = `<tr><td><a class='view' href="/Shares/Browse?dir=/mnt/disk1"><i class="icon-u-tab"></i></a><a class='info nohand' onclick='return false'><i class='fa fa-circle orb green-orb'></i><span style='left:18px'>Alle Dateien geschützt</span></a><a href="/Shares/Disk?name=disk1" onclick="$.cookie('one','tab1')">disk1</a></td><td></td><td>-</td><td>-</td><td>HDD</td><td>16 TB</td><td>1.97 TB</td></tr>` +
  `<tr class=''><td><a class='view'></a><a href='#' title='Neu berechnen...' onclick="computeDisk('disk1',$(this).parent())"><i class='fa fa-refresh icon'></i></a>&nbsp;media</td><td></td><td></td><td></td><td></td><td>12.1 TB</td><td>1.97 TB</td></tr>`;
const NONE = `<tr><td class='empty' colspan='7'><i class='fa fa-folder-open-o icon'></i>Es existieren keine zu exportierenden Datenträgerfreigaben</td></tr>`;

console.log('\nThe hook');
ok('Shares.page loads sharetiles.js after shares.js', /scripts\/shares\.js[\s\S]*scripts\/sharetiles\.js/.test(page));

console.log('\nEvery tile rule waits for html.cc-sht-on');
{
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) { const s = m[1].replace(/^\s*@media[^{]*\{/, '').trim(); if (s && !s.startsWith('@')) sels.push(s); }
  const tiles = sels.filter((s) => /cc-sht-/.test(s));
  ok('the sheet has tile rules', tiles.length > 25, tiles.length);
  const loose = [];
  for (const s of tiles) for (const part of splitTop(s)) if (!/^html\.cc-shares-on\.cc-sht-on/.test(part.trim())) loose.push(part.trim());
  ok('no tile selector applies without the gate', loose.length === 0, loose.slice(0, 4).join(' | '));
  ok('the script sets the gate only where the Freigaben area styles /Shares', /function live\(\) \{\s*return g\("cc\.theming", "1"\) !== "0" && g\("cc\.enable\.shares", "0"\) !== "0" && pn\(\) === "\/Shares" && !!document\.querySelector\("#displaybox nav\.tabs"\);/.test(js));
  ok('the column reset goes in the tile view', /html\.cc-shares-on\.cc-sht-on\.cc-sht-tiled #displaybox nav\.tabs > \.cc-colreset \{ display: none !important; \}/.test(css));
}

console.log('\nThe readers follow Unraid\'s rows');
{
  const R = load({});
  const list = R.readList(tbody(MEDIA + BACKUP));
  const [media, backup] = list.shares;
  ok('two shares, the breakdown rows are not shares', list.shares.length === 2 && !list.notice);
  ok('media: name, settings link and browse link', media.name === 'media' && media.link.getAttribute('href') === '/Shares/Share?name=media' && media.browse.getAttribute('href') === '/Shares/Browse?dir=/mnt/user/media');
  ok('media: protected, with Unraid\'s own words for it', media.prot === 'ok' && media.protTip === 'Alle Dateien geschützt');
  ok('media: comment and the two exports', media.comment === 'Filme & Serien' && media.smb === 'Privat' && media.nfs === '-');
  ok('media: storage as Unraid\'s glyphs and words, its bubble as the tip', media.store.html === '<i class="fa fa-bullseye fa-fw"></i>Cache <i class="fa fa-arrow-right fa-fw"></i><i class="fa fa-database fa-fw"></i>Array' && media.store.tip === 'Primärer Speicher zu sekundärem Speicher');
  ok('media: not computed yet, so the Compute link and the free space', !!media.compute && media.size === '' && media.free === '9.09 TB' && media.parts.length === 0);
  ok('backup: unprotected, computed, with its two disks', backup.prot === 'warn' && backup.size === '6.21 TB' && !backup.compute && backup.parts.length === 2);
  ok('a disk outside the designated ones is marked', !backup.parts[0].outside && backup.parts[1].outside && backup.parts[1].name === 'Datenträger 3' && backup.parts[1].size === '1.10 TB');
  ok('a user share shows no bar, it has no capacity of its own', R.usage(backup, false) === null);
  const badged = R.readList(tbody(MEDIA_BADGED)).shares[0];
  const keys = ['name', 'prot', 'protTip', 'comment', 'smb', 'nfs', 'store', 'size', 'free'];
  ok('a row shares.js has badged reads the same', !!badged && keys.every((k) => JSON.stringify(badged[k]) === JSON.stringify(media[k])) && !!badged.compute && badged.browse.getAttribute('href') === media.browse.getAttribute('href'), badged && keys.filter((k) => JSON.stringify(badged[k]) !== JSON.stringify(media[k])).join(','));
  const disks = R.readList(tbody(DISK1)).shares;
  ok('a disk share: its type stands for the storage', disks.length === 1 && disks[0].store.html === 'HDD' && disks[0].parts.length === 1 && disks[0].parts[0].name === 'media');
  ok('a computed disk share shows how full the disk is', Math.round(R.usage(disks[0], true)) === 88);
  const running = R.readList(tbody(MEDIA.replace(/<a href='#' onclick="computeShare\('media',\$\(this\)\)">Berechnen\.\.\.<\/a>/, "<i class='fa fa-circle-o-notch fa-spin'></i> Bitte warten..."))).shares[0];
  ok('while Compute runs the tile says so and shows no size', running.busy === 'Bitte warten' && running.size === '' && !running.compute);
  const none = R.readList(tbody(NONE));
  ok('no shares: Unraid\'s own notice is kept', none.shares.length === 0 && none.notice === 'Es existieren keine zu exportierenden Datenträgerfreigaben');
}

console.log('\nA card reads like a plugin card: the folder, shield, name, size and actions, the split, then storage, exports and Compute');
{
  const txt = js.slice(js.indexOf('var TXT = {'), js.indexOf('};', js.indexOf('var TXT = {')) + 2);
  const folder = js.slice(js.indexOf('var FOLDER = '), js.indexOf("</svg>';", js.indexOf('var FOLDER = ')) + 8);
  const fns = ['kids', 'tag', 'attr', 'hasCls', 'find', 'text', 'clean', 'esc', 'bytes', 'cells', 'computeLink', 'waiting', 'storage', 'readRow', 'readList', 'usage', 't', 'glyph', 'lvl', 'act', 'shield', 'cornerBtn', 'exportChip', 'cardHtml'];
  const src = ['var LANG = "de";', txt, grabVar(js, 'POW'), folder].concat(fns.map((n) => grabFn(js, n))).join('\n') + '\nreturn { readList, cardHtml };';
  const C = new Function('window', src)({});
  const html = (rows, disk) => C.cardHtml(C.readList(tbody(rows)).shares[0], disk);
  const card = (rows, disk) => parse('<div>' + html(rows, disk) + '</div>').children[0];
  const cls = (n) => (n && n.attrs.class) || '';
  const order = (n) => n.children.map(cls).join(' ');
  const acts = (n) => n.children[0].children[2].children.map((b) => b.attrs['data-act']).join(' ');
  const last = (n) => n.children[n.children.length - 1];
  const media = card(MEDIA, false);
  ok('media: the head and the footer', order(media) === 'cc-sht-head cc-sht-foot', order(media));
  const head = media.children[0];
  ok('the head holds the folder, the name with the comment, and the actions for the top corner', order(head) === 'cc-sht-pic cc-sht-id cc-sht-acts', order(head));
  ok('everything in the head sits on the card\'s top edge', /\.cc-sht-head \{[^}]*align-items: flex-start;/.test(css));
  ok('the folder is drawn, not loaded, and carries nothing else', order(head.children[0]) === 'cc-sht-folder' && head.children[0].children[0].tagName === 'SVG');
  ok('the folder is back, sheet and front, in that order', head.children[0].children[0].children.length > 0 && /cc-sht-fback[\s\S]*cc-sht-fback[\s\S]*cc-sht-fsheet[\s\S]*cc-sht-ffront/.test(html(MEDIA, false)));
  ok('the name stands over the comment', order(head.children[1]) === 'cc-sht-title cc-sht-cmt');
  ok('the shield badge leads the name\'s line, the free space follows the name badge', order(head.children[1].children[0]) === 'cc-shield cc-shield-ok cc-sht-nb cc-sht-size' && html(MEDIA, false).includes('<b>9.09 TB</b> frei'));
  ok('the top corner holds Durchsuchen and Einstellungen', acts(media) === 'browse open');
  const foot = last(media);
  ok('the footer holds the chips and then Berechnen', order(foot) === 'cc-sht-chips cc-sht-cb' && foot.children[1].attrs['data-act'] === 'compute', order(foot));
  ok('the storage badge leads, SMB and NFS follow on its row', order(foot.children[0]) === 'cc-sht-chip cc-sht-store cc-sht-chip cc-sht-chip cc-sht-off');
  const backup = card(BACKUP, false);
  ok('backup: used and free together in the head, the split before the footer', backup.children[0].children[1].children[0].children[2].children.length === 2 && order(backup) === 'cc-sht-head cc-sht-parts cc-sht-foot', order(backup));
  ok('a share without an orb has no shield before its name', order(card(BACKUP.replace(/<a class='info nohand'[^]*?<\/a>(?=<a href="\/Shares\/Share)/, ''), false).children[0].children[1].children[0]) === 'cc-sht-nb cc-sht-size');
  ok('a computed share offers Neu berechnen in the same corner and not among the actions', order(last(backup)) === 'cc-sht-chips cc-sht-cb' && last(backup).children[1].attrs['data-act'] === 'again' && acts(backup) === 'browse open');
  const disk = card(DISK1, true);
  ok('a computed disk share keeps its bar before the split', order(disk) === 'cc-sht-head cc-sht-track cc-sht-parts cc-sht-foot', order(disk));
  const running = card(MEDIA.replace(/<a href='#' onclick="computeShare\('media',\$\(this\)\)">Berechnen\.\.\.<\/a>/, "<i class='fa fa-circle-o-notch fa-spin'></i> Bitte warten..."), false);
  ok('while Compute runs its note takes the corner', order(last(running)) === 'cc-sht-chips cc-sht-busy');
  const again = card(BACKUP.replace(`<a class='view'></a><a href='#' title='Neu berechnen...' onclick="computeShare('backup',$(this).parent())"><i class='fa fa-refresh icon'></i></a>&nbsp;Datenträger 1`, "<i class='fa fa-circle-o-notch fa-spin'></i> Bitte warten..."), false);
  ok('while Neu berechnen runs its note takes the corner as well', order(last(again)) === 'cc-sht-chips cc-sht-busy' && again.children[1].children.length === 1);
  const bare = parse('<div>' + C.cardHtml(Object.assign(C.readList(tbody(BACKUP)).shares[0], { parts: [] }), false) + '</div>').children[0];
  ok('a card with nothing for the corner has only its chips in the footer', order(bare) === 'cc-sht-head cc-sht-foot' && order(last(bare)) === 'cc-sht-chips', order(bare));
  ok('the footer sits at the bottom and puts Compute at its right end', /\.cc-sht-foot \{[^}]*flex-wrap: wrap;[^}]*margin-top: auto;/.test(css) && /\.cc-sht-foot > :is\(\.cc-sht-cb, \.cc-sht-busy\) \{ margin-left: auto; \}/.test(css));
  ok('the name column takes the room, the actions keep their place', /\.cc-sht-id \{[^}]*flex: 1 1 auto;/.test(css) && /\.cc-sht-title \{[^}]*flex-wrap: wrap;/.test(css) && /\.cc-sht-acts \{[^}]*flex: none;/.test(css));
}

console.log('\nThe folder looks like the logo tiles of Docker and Plugins');
{
  ok('the tile is the logo box, the drawing the logo size', /\.cc-sht-pic \{[^}]*width: var\(--cc-logo-box, 78px\); height: var\(--cc-logo-box, 78px\);/.test(css) && /\.cc-sht-folder \{[^}]*width: var\(--cc-logo-img, 62px\); height: var\(--cc-logo-img, 62px\);/.test(css));
  ok('the tile size follows cc.sgsize like the other areas', /function logoSizes\(\) \{ return \(\{ s: \["48px", "62px"\], m: \["62px", "78px"\], l: \["76px", "94px"\] \}\)\[g\("cc\.sgsize", "m"\)\]/.test(js));
  ok('the folder takes the card\'s colour and rests grey in the reactive mode', /--cc-sht-fold: var\(--cc-sht-c, var\(--cc-shr-accent, #FCC419\)\);/.test(css) && /\.cc-shares-rbneutral #displaybox \.cc-sht-card:not\(:hover\):not\(:focus-within\) \.cc-sht-pic \{ --cc-sht-fold: var\(--cc-text-dim\); \}/.test(css));
  ok('its corners follow the shape setting', /\.cc-sht-folder rect \{ rx: var\(--cc-pic-corner, 6px\);/.test(css));
  ok('the folder rests closed and opens while the card has the pointer or the focus', /cc-sht-ffront" x="6" y="14" width="52" height="38"/.test(js) && /\.cc-sht-card:is\(:hover, :focus-within\) \.cc-sht-ffront \{ y: 24px; height: 28px; \}/.test(css));
}

console.log('\nThe shield is a badge of its own before the name');
{
  const rule = (sel) => { const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css); return m ? m[1] : ''; };
  const base = rule('#displaybox .cc-sht-title > .cc-shield');
  ok('it is as tall as the name badge', /height: 28px;/.test(base) && /height: 28px;/.test(rule('#displaybox .cc-sht-nb')));
  ok('it takes the badge shape', /border-radius: var\(--cc-radius-pill\);/.test(base));
  ok('protected fills it green and not fully protected orange, each with its own ink',
    /background: var\(--cc-ok\); color: var\(--cc-ok-fg\);/.test(rule('#displaybox .cc-sht-title > .cc-shield-ok')) &&
    /background: var\(--cc-warn\); color: var\(--cc-warn-fg\);/.test(rule('#displaybox .cc-sht-title > .cc-shield-warn')));
  ok('the folder carries no shield', !/\.cc-sht-pic > \.cc-shield/.test(css));
}

console.log('\nThe actions click the row\'s own controls');
{
  const loc = { href: '/Shares' };
  const R = load({ location: loc });
  const [media, backup] = R.readList(tbody(MEDIA + BACKUP)).shares;
  R.run('compute', { __ccShare: media });
  ok('Berechnen clicks the row\'s Compute link and keeps the page where it is', media.compute.clicks === 1 && media.compute.held === 1 && loc.href === '/Shares');
  R.run('again', { __ccShare: backup });
  ok('Neu berechnen clicks the Recompute link of the breakdown', backup.parts[0].again.clicks === 1 && backup.parts[0].again.held === 1);
  R.run('open', { __ccShare: media });
  ok('the settings open through the name link, whose handler picks the first tab', media.link.clicks === 1 && media.link.held === 0);
  R.run('browse', { __ccShare: media });
  ok('Durchsuchen goes where the row\'s browse link goes', loc.href === '/Shares/Browse?dir=/mnt/user/media');

  const tree = parse('<div class="cc-sht-card"><span class="cc-sht-ib" data-act="compute">x</span><b>y</b></div>');
  const card = tree.children[0];
  card.__ccShare = media;
  R.onClick({ target: card.children[1] });
  ok('a click on the card opens the share\'s settings', media.link.clicks === 2 && media.compute.clicks === 1);
  R.onClick({ target: card.children[0] });
  ok('a click on an action runs that action and not the link', media.compute.clicks === 2 && media.link.clicks === 2);
}

console.log('\nThe view: one switch and one key for both tables');
{
  const store = {};
  const R = load({ g: (k, d) => (k in store ? store[k] : d) });
  ok('unset, the page shows tiles', R.view() === 'tiles');
  store['cc.shareview'] = 'list';
  ok('cc.shareview = list shows Unraid\'s list', R.view() === 'list');
  ok('the switch writes cc.shareview', /var KEY = "cc\.shareview";/.test(js) && /s\(KEY, o\[0\]\)/.test(js));
  ok('there is one switch, in the tab bar ahead of the column reset', (js.match(/el\("div", "cc-sht-vsw"\)/g) || []).length === 1 && /nav\.insertBefore\(sw, nav\.querySelector\(":scope > \.cc-colreset"\)\)/.test(js));
  const settings = read('scripts/settings.js');
  const row = grabFn(settings, 'shareViewRow');
  ok('the settings row writes the same key and nothing else', /set\("cc\.shareview", v\);/.test(row) && (row.match(/set\(/g) || []).length === 1);
  ok('it starts from tiles as the page does', /var cur = get\("cc\.shareview", "tiles"\) === "list" \? "list" : "tiles";/.test(row));
  ok('it offers Liste and Kacheln with the view glyphs', /\[\["list", T\("Liste", "List"\), "IconViewList"\], \["tiles", T\("Kacheln", "Tiles"\), "IconViewGrid"\]\]/.test(row));
  ok('its bubble points to the switch on the page', /Der Schalter oben im Tab Freigaben stellt dasselbe um\./.test(row));
  ok('it sits in the Freigaben tab', /shareViewRow\(cShV\);\s*wrapShares\.appendChild\(cShV\);/.test(settings));
}

console.log('\nThe tiles redraw with every refill and never feed on their own writes');
{
  const w = grabFn(js, 'watch');
  ok('a change inside a share table redraws', /tg\.closest\("table\.share_status"\)/.test(w));
  ok('the tiles\' own nodes are skipped', /tg\.closest\("\.cc-sht-host, \.cc-sht-vsw"\)/.test(w));
  ok('a card writes its markup only when it changed', /function setHtml\(n, v\) \{ if \(n && n\.__ccHtml !== v\)/.test(js));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
