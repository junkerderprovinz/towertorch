// A yes/no toggle on a Settings or Tools page saves its field at once only where posting that one
// field to update.php does what the form's Apply does. Elsewhere it changes the field, fires
// change and leaves the save to Apply. The forms below follow the real markup of Unraid 7.3's
// Display Settings and SMB pages, Enhanced Log Next 2026.11.17, Recycle Bin Next 2026.11.20,
// Dynamix Cache Directories 2026.11.21 and Unassigned Devices Next 2026.11.09. What breaks:
//   · a #section the form does not have, which turns every key of a flat plugin cfg into an empty
//     section and leaves only the flipped one
//   · a form whose Apply also runs a #command or an #include, which a single field skips
//   · a form that is not saved through update.php at all, whose field lands in dynamix.cfg
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// A form is its action and its named fields; querySelector reads [name="x"] and [name^="x"],
// listed with commas.
function form(action, fields) {
  const f = {
    getAttribute: (k) => (k === 'action' ? action : null),
    querySelector: (sel) => {
      for (const one of sel.split(',')) {
        const m = /^\s*\[name(\^?)="([^"]*)"\]\s*$/.exec(one);
        if (!m) throw new Error('selector the shim cannot read: ' + one);
        const hit = fields.find((x) => (m[1] ? x.name.startsWith(m[2]) : x.name === m[2]));
        if (hit) return hit;
      }
      return null;
    },
  };
  return f;
}
const select = (name, value, owner) => ({ name, value, closest: (s) => (s === 'form' ? owner : null) });

const save = grabFn(header, 'ttApplyToolsSel');
function flip(sel) {
  const posts = [];
  let reloaded = false;
  const window = { csrf_token: 'T0KEN' };
  const fetch = (url, opt) => { posts.push({ url, body: new URLSearchParams(String(opt.body)) }); return { then: (fn) => { fn(); return { catch: () => {} }; } }; };
  const location = { reload: () => { reloaded = true; } };
  const localStorage = { setItem: () => {} };
  new Function('window', 'fetch', 'location', 'localStorage', 'URLSearchParams', save + '\nttApplyToolsSel(arguments[5]);')(window, fetch, location, localStorage, URLSearchParams, sel);
  return { posts, reloaded };
}

console.log('\nUnraid\'s own display settings still save at once');
{
  const f = form('/update.php', [{ name: '#file', value: 'dynamix/dynamix.cfg' }, { name: '#section', value: 'display' }, { name: '#custom', value: '' }, { name: '#default', value: 'Default' }, { name: '#apply', value: 'Apply' }]);
  const r = flip(select('favorites', 'no', f));
  ok('one post to update.php', r.posts.length === 1 && r.posts[0].url === '/update.php');
  const b = r.posts[0] ? r.posts[0].body : new URLSearchParams();
  ok('with the form\'s file, section and the field', b.get('#file') === 'dynamix/dynamix.cfg' && b.get('#section') === 'display' && b.get('favorites') === 'no' && b.get('csrf_token') === 'T0KEN', b.toString());
  ok('and the page reloads to show it', r.reloaded);
}

console.log('\nA flat plugin cfg gets no section it does not have');
{
  const f = form('/update.php', [{ name: '#file', value: 'enhanced.log/enhanced.log.cfg' }, { name: '#default', value: 'Default' }]);
  const r = flip(select('ERRORS', 'yes', f));
  const b = r.posts[0] ? r.posts[0].body : new URLSearchParams();
  ok('Enhanced Log Next\'s configuration page saves its field', r.posts.length === 1 && b.get('#file') === 'enhanced.log/enhanced.log.cfg' && b.get('ERRORS') === 'yes', b.toString());
  ok('without a #section', !b.has('#section'), b.get('#section'));
}

console.log('\nA form whose Apply runs more than the save is left to Apply');
{
  const cases = [
    ['Recycle Bin Next, whose Apply restarts the service', select('SERVICE', 'enable', form('/update.php', [{ name: '#file', value: 'recycle.bin/recycle.bin.cfg' }, { name: '#command', value: '/plugins/recycle.bin/scripts/rc.recycle.bin' }, { name: '#arg[1]', value: 'update' }, { name: '#default', value: 'Default' }, { name: '#apply', value: 'Apply' }]))],
    ['Folder Caching, whose Apply builds its settings in an #include', select('service', 'enable', form('/update.php', [{ name: '#file', value: 'dynamix.cache.dirs/dynamix.cache.dirs.cfg' }, { name: '#include', value: '/plugins/dynamix.cache.dirs/include/cache_dirs.php' }, { name: '#default', value: 'Default' }, { name: '#apply', value: 'Apply' }]))],
    ['UD Next\'s common settings, sectioned but with a #command', select('automount_usb', 'yes', form('/update.php', [{ name: '#section', value: 'Config' }, { name: '#file', value: 'unassigned.devices/unassigned.devices.cfg' }, { name: '#command', value: '/plugins/unassigned.devices/scripts/rc.settings' }, { name: '#arg[1]', value: 'apply' }]))],
  ];
  for (const [name, sel] of cases) {
    const r = flip(sel);
    ok(name + ': nothing posted', r.posts.length === 0, r.posts.map((p) => p.body.toString()).join(' | '));
    ok(name + ': no reload', !r.reloaded);
  }
}

console.log('\nA form update.php does not save stays out of dynamix.cfg');
{
  const smb = flip(select('shareSMBEnabled', 'yes', form('/update.htm', [{ name: 'changeShare', value: 'Apply' }])));
  ok('Unraid\'s SMB switch, which emhttp saves, posts nothing', smb.posts.length === 0, smb.posts.map((p) => p.body.toString()).join(' | '));
  const loose = flip(select('loose', 'yes', null));
  ok('a select outside any form posts nothing', loose.posts.length === 0);
  const nofile = flip(select('NOTIFY', 'yes', form('/update.php', [{ name: '#command', value: '/plugins/x/scripts/run' }])));
  ok('nor does an update.php form that names no file', nofile.posts.length === 0);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
