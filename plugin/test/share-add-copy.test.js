// Adding a share (/Shares/Share?name=) with the settings of another one, and where the form stands.
// What can quietly break it:
//   · Unraid's Read on the add page, which submits through an #cmdEditShare that only exists on an
//     existing share's page, so it stops with an error and nothing is added
//   · a copy that writes the hidden fields only, which prepareEdit() overwrites from the visible
//     ones on Add Share
//   · the storage selects set without their change events, or in an order Unraid's updateScreen()
//     cannot follow, so the secondary storage stays disabled
//   · the take-over reaching an existing share's page, where Unraid's own Read applies at once
//   · the settings card standing at the left edge instead of in the middle, where Unraid puts it
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

const js = read('scripts/shares.js'), css = read('sheets/TowerTorch.Shares.css');

// A select as the share form has it: options with values, a selectedIndex, and a log of the events
// it fires, shared by every field so the order across fields shows.
const log = [];
function select(name, values, at) {
  const s = { name, options: values.map((v) => ({ value: v, disabled: false, selected: false })) };
  Object.defineProperty(s, 'selectedIndex', {
    get() { return s.options.findIndex((o) => o.selected); },
    set(i) { s.options.forEach((o, k) => { o.selected = k === i; }); }
  });
  s.selectedIndex = at || 0;
  s.dispatchEvent = (e) => { log.push(name + ':' + e.type); return true; };
  return s;
}
function multi(name, values) { return { name, options: values.map((v) => ({ value: v, selected: false })) }; }
function addForm(orig) {
  const f = {
    shareNameOrig: { value: orig || '' },
    shareName: { value: '', focused: false, focus() { this.focused = true; } },
    shareFloor: { value: '' },
    shareCachePool: select('primary', ['', 'cache', 'fastcache']),
    shareCOW: select('shareCOW', ['no', 'auto'], 1),
    shareAllocator1: select('shareAllocator1', ['highwater', 'fillup', 'mostfree']),
    shareAllocator2: select('shareAllocator2', ['highwater', 'fillup', 'mostfree']),
    shareSplitLevel1: select('shareSplitLevel1', ['', '1', '2', '0']),
    shareSplitLevel2: select('shareSplitLevel2', ['', '1', '2', '0']),
    shareInclude1: multi('shareInclude1', ['disk1', 'disk2', 'disk3']),
    shareInclude2: multi('shareInclude2', ['disk1', 'disk2', 'disk3']),
    shareExclude1: multi('shareExclude1', ['disk1', 'disk2', 'disk3']),
    shareExclude2: multi('shareExclude2', ['disk1', 'disk2', 'disk3'])
  };
  return f;
}
function load(f, extra) {
  const byId = Object.assign({ secondary: select('secondary', ['0', '1', 'cache', 'fastcache']), direction: select('direction', ['0', '1']) }, extra || {});
  byId.primary = f.shareCachePool;
  const window = { initDropdown: () => log.push('initDropdown') };
  const document = { forms: { share_edit: f }, getElementById: (id) => byId[id] || null, querySelector: () => null };
  const src = ['ccFloor', 'ccFillShare', 'ccReadIntoNew'].map((n) => grabFn(js, n)).join('\n') +
    '\nfunction ccSyncGroup() { log.push("sync"); }\nreturn { ccFloor, ccFillShare, ccReadIntoNew };';
  return { api: new Function('window', 'document', 'Event', 'log', src)(window, document, function (t) { this.type = t; }, log), byId };
}
const picked = (s) => s.options[s.selectedIndex].value;
const ticked = (s) => s.options.filter((o) => o.selected).map((o) => o.value).join(',');

console.log('\nA floor goes in as a size Unraid reads back');
{
  const { api } = load(addForm());
  ok('kilobytes become the largest whole unit with one decimal', api.ccFloor(97628454) === '97.6 GB' && api.ccFloor(976434990) === '976.4 GB', api.ccFloor(97628454));
  ok('a small floor stays in kilobytes', api.ccFloor(512) === '512 KB');
  ok('the decimal is a dot, the one parseDiskSize reads', !/,/.test(api.ccFloor(1234567)));
}

console.log('\nRead fills the visible fields of the add form');
{
  log.length = 0;
  const f = addForm();
  const { api, byId } = load(f);
  api.ccFillShare(f, { useCache: 'prefer', cachePool: 'fastcache', cachePool2: '', allocator: 'mostfree', splitLevel: '1', include: 'disk1,disk3', exclude: '', floor: '97628454', cow: 'no' });
  ok('primary storage is the pool, secondary the array', picked(f.shareCachePool) === 'fastcache' && picked(byId.secondary) === '1');
  ok('the mover runs from secondary to primary, as prefer means', byId.direction.selectedIndex === 1);
  ok('allocation and split level land in both storage sections', picked(f.shareAllocator1) === 'mostfree' && picked(f.shareAllocator2) === 'mostfree' && picked(f.shareSplitLevel1) === '1' && picked(f.shareSplitLevel2) === '1');
  ok('the included disks are ticked in both lists, the excluded ones none', ticked(f.shareInclude1) === 'disk1,disk3' && ticked(f.shareInclude2) === 'disk1,disk3' && ticked(f.shareExclude1) === '');
  ok('copy on write and the floor follow', picked(f.shareCOW) === 'no' && f.shareFloor.value === '97.6 GB');
  const at = (k) => log.indexOf(k);
  ok('the checklists are rebuilt before the storage selects change', at('initDropdown') >= 0 && at('initDropdown') < at('primary:change'));
  ok('primary, then secondary, then the mover direction, each with its change event', at('primary:change') < at('secondary:change') && at('secondary:change') < at('direction:change'), log.join(' '));
  ok('the overlays are synced afterwards', log[log.length - 1] === 'sync');
  ok('the name field is left to the user and takes the focus', f.shareName.value === '' && f.shareName.focused);
}
{
  log.length = 0;
  const f = addForm();
  const { api, byId } = load(f);
  api.ccFillShare(f, { useCache: 'no', cachePool: '', cachePool2: '', allocator: 'highwater', splitLevel: '', include: '', exclude: 'disk2', floor: '0', cow: 'auto' });
  ok('an array share stays on the array, with no secondary storage and no mover direction', picked(f.shareCachePool) === '' && picked(byId.secondary) === '0' && !log.includes('direction:change'));
  ok('no floor leaves the field to Unraid\'s own default', f.shareFloor.value === '');
  ok('the excluded disk is ticked', ticked(f.shareExclude1) === 'disk2');
}
{
  const f = addForm();
  const { api } = load(f);
  f.shareName.value = 'media';
  api.ccFillShare(f, { useCache: 'only', cachePool: 'cache' });
  ok('a name typed first keeps its place and the focus stays where it is', f.shareName.value === 'media' && !f.shareName.focused);
}

console.log('\nOnly the add page takes Read over');
{
  const button = () => ({ attrs: {}, onclick: 'readShare()', hasAttribute(k) { return k in this.attrs; }, setAttribute(k, v) { this.attrs[k] = v; } });
  const add = addForm(), b1 = button();
  load(add, { readshare: b1 }).api.ccReadIntoNew();
  ok('on the add page Read gets a handler of its own', typeof b1.onclick === 'function' && b1.attrs['data-cc-read'] === '1');
  const again = b1.onclick;
  load(add, { readshare: b1 }).api.ccReadIntoNew();
  ok('a second pass leaves it as it is', b1.onclick === again);
  const edit = addForm('media'), b2 = button();
  load(edit, { readshare: b2, cmdEditShare: {} }).api.ccReadIntoNew();
  ok('on an existing share\'s page Unraid\'s Read stays', b2.onclick === 'readShare()' && !('data-cc-read' in b2.attrs));
  ok('it is wired from the share page pass', /ccSelects\(box\);\s*ccReadIntoNew\(\);/.test(grabFn(js, 'enhanceShareDetail')));
  ok('it reads the settings where Unraid\'s Read does', /window\.jQuery\.get\("\/webGui\/include\/ShareData\.php", \{ name: from\.value \}/.test(grabFn(js, 'ccReadIntoNew')));
}

console.log('\nThe settings card stands in the middle');
{
  ok('the row is a grid around one 920px column, centred', /\.cc-split-row \{\s*display: grid; grid-template-columns: minmax\(0, 920px\); justify-content: center;/.test(css));
  ok('with room for the copy card, the form takes the middle of three columns and the copy card the right one',
    /@media \(min-width: 1880px\) \{[^@]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 920px\) minmax\(0, 1fr\);[^@]*\.cc-main-col \{ grid-column: 2; \}[^@]*\.cc-side-card \{ grid-column: 3; grid-row: 1; \}/.test(css));
  ok('the form column has no flex basis that would pin it to the left edge', !/\.cc-main-col \{ flex: 0 1 920px/.test(css));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
