// A browser, a flash config or a backup file written by an older release keeps every setting
// under the tt names, and the two browser-only keys stay out of the mirrored family.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const theme = fs.readFileSync(path.join(DIR, 'scripts/tt-theme.js'), 'utf8');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
const plg = fs.readFileSync(path.join(__dirname, '..', 'towertorch.plg'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const { renameOldKeys, backupWithCurrentKeys } = new Function(
  grabFn(theme, 'currentKey') + grabFn(theme, 'renameOldKeys') + grabFn(theme, 'backupWithCurrentKeys') + 'return { renameOldKeys, backupWithCurrentKeys };')();
function store(init) {
  const s = Object.assign({}, init);
  return {
    s,
    get length() { return Object.keys(s).length; },
    key: (i) => Object.keys(s)[i],
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
  };
}

console.log('\nA browser keeps its settings');
{
  const ls = store({ 'cc.accent': '#1d99f3', 'cc.brand.name': 'Tower', 'ccd.iconbg': '0', 'ccsh.accent': '#ff8389', 'tt.off': '1', 'tt.charts': '{}', locale: 'de' });
  renameOldKeys(ls);
  ok('the global and area keys take the tt names', ls.s['tt.accent'] === '#1d99f3' && ls.s['tt.brand.name'] === 'Tower' && ls.s['ttd.iconbg'] === '0' && ls.s['ttsh.accent'] === '#ff8389');
  ok('the browser-only keys leave the mirrored family', ls.s['towertorch.off'] === '1' && ls.s['towertorch.charts'] === '{}' && !('tt.off' in ls.s) && !('tt.charts' in ls.s));
  ok('no old key stays behind', !Object.keys(ls.s).some((k) => /^cc[a-z]*\./.test(k)));
  ok('a key of someone else stays', ls.s.locale === 'de');
  const before = JSON.stringify(ls.s);
  renameOldKeys(ls);
  ok('a second page load changes nothing', JSON.stringify(ls.s) === before);
}
{
  const ls = store({ 'cc.accent': '#111111', 'tt.accent': '#222222' });
  renameOldKeys(ls);
  ok('a value already under the tt name wins', ls.s['tt.accent'] === '#222222' && !('cc.accent' in ls.s));
}
ok('it runs before the first read of a setting', theme.indexOf('try { renameOldKeys(localStorage); }') < theme.indexOf('function g(k, d)'));

console.log('\nA backup file still imports');
{
  const o = backupWithCurrentKeys({ 'cc.accent': '#1d99f3', 'ccv.iconbg': '1', 'tt.rainbow': '1' });
  ok('old and current keys come out under the tt names', JSON.stringify(o) === JSON.stringify({ 'tt.accent': '#1d99f3', 'ttv.iconbg': '1', 'tt.rainbow': '1' }));
  ok('the import renames before it checks the keys', settings.indexOf('backupWithCurrentKeys(o)') > 0 && settings.indexOf('backupWithCurrentKeys(o)') < settings.indexOf('var ks = o && typeof o === "object"'));
  ok('something that is no object still fails the check', Object.keys(backupWithCurrentKeys(null)).length === 0 && Object.keys(backupWithCurrentKeys(['x'])).join() === '0');
}

console.log('\nThe flash config keeps its settings');
{
  const m = /sed -E 's\/(.+?)\/(.+?)\/' "\$cfg"/.exec(plg);
  ok('the installer has the rename', !!m);
  const before = '{\n  "schedules": null,\n  "ui_settings": {\n    "cc.accent": "#1d99f3",\n    "ccd.note": "cc.view",\n    "tt.rainbow": "1"\n  },\n  "notify": {}\n}\n';
  const after = before.replace(new RegExp(m[1], 'gm'), m[2].replace(/\\(\d)/g, '$$$1'));
  const ui = JSON.parse(after).ui_settings;
  ok('the keys take the tt names', ui['tt.accent'] === '#1d99f3' && 'ttd.note' in ui && ui['tt.rainbow'] === '1');
  ok('a value is left as it is', ui['ttd.note'] === 'cc.view');
  ok('the rename runs while the daemon is stopped, before the package goes in',
    plg.indexOf('rc.&slug; stop') < plg.indexOf('drop_old_chains()') && plg.indexOf('drop_old_chains()') < plg.indexOf('<FILE Name="&plgPath;/&txz;"'));
}

console.log('\nThe header keeps its order');
{
  const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
  const currentNavKey = new Function(grabFn(header, 'currentNavKey') + 'return currentNavKey;')();
  ok('the bell and the menu button take the tt keys', currentNavKey('cc-bell') === 'tt-bell' && currentNavKey('cc-burger') === 'tt-burger');
  ok('other keys stay', currentNavKey('/Docker') === '/Docker' && currentNavKey('tt-bell') === 'tt-bell' && currentNavKey('usage-bar') === 'usage-bar');
  ok('the saved order goes through it', header.includes('(o.left || []).map(currentNavKey)') && header.includes('(o.right || []).map(currentNavKey)'));
}

console.log('\n' + (fail ? 'FAILED  ' : 'OK  ') + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
