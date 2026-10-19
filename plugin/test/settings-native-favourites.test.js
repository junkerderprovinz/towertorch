// The Favoriten row on the Bereiche card switches Unraid's own favourites setting from CC's
// settings page, live: it writes the field the way Unraid's display settings form does, and the
// Favorites tab follows at once through cc.hidefavtab, which header.js turns into the class that
// hides the tab. A refused write puts the switch and the tab back and says so.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
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

console.log('\npostDisplay() writes a field as Unraid\'s own form does');
(async () => {
  const calls = [];
  const fetchOk = (status) => (url, opts) => { calls.push({ url, opts }); return Promise.resolve({ ok: status < 400, status }); };
  const make = (f) => new Function('fetch', 'csrfToken', 'URLSearchParams', grabFn(settings, 'postDisplay') + '; return postDisplay;')(f, () => 'TOKEN', URLSearchParams);
  await make(fetchOk(200))({ favorites: 'no' });
  const body = calls[0].opts.body;
  ok('it posts to update.php', calls[0].url === '/update.php' && calls[0].opts.method === 'POST');
  ok('with the display form\'s #file and #section', body.get('#file') === 'dynamix/dynamix.cfg' && body.get('#section') === 'display');
  ok('with the CSRF token', body.get('csrf_token') === 'TOKEN');
  ok('and the field itself', body.get('favorites') === 'no');
  ok('as a urlencoded body, since a multipart one times out', body instanceof URLSearchParams);
  let refused = false;
  await make(fetchOk(500))({ favorites: 'yes' }).catch(() => { refused = true; });
  ok('a refused write rejects, so the caller can put the switch back', refused);

  console.log('\nThe Favoriten row: a native switch, and the area switch while it is on');
  const at = settings.indexOf('if (a[0] === "cc.enable.favorites") {');
  const block = settings.slice(at, settings.indexOf('c.appendChild(natRow); c.appendChild(row); return;', at));
  ok('the row is a switch, no line that sends the person to another page', !/lockRow\(/.test(block) && !/location\.href/.test(block));
  ok('the switch shows the native state', /toggle\(localStorage\.getItem\("cc\.hidefavtab"\) !== "1"/.test(block));
  ok('a flip writes Unraid\'s own favorites field', /postDisplay\(\{ favorites: v \? "yes" : "no" \}\)/.test(block));
  ok('and moves the tab at once, without a reload', /set\("cc\.hidefavtab", v \? "0" : "1"\);/.test(block) && /syncHeaderBar\(\)/.test(block) && !/location\.reload/.test(block));
  ok('a refused write puts the switch and the tab back and says why', /\.catch\(function \(\) \{\s*set\("cc\.hidefavtab", v \? "1" : "0"\); natTgl\._setOn\(!v\);[\s\S]*failed\(natTgl,/.test(block));
  ok('turning favourites on brings the area back with them', /if \(v\) localStorage\.setItem\("cc\.enable\.favorites", "1"\);/.test(block));
  ok('the area switch steps aside while the native one is off', /row\.hidden = off;/.test(block));
  ok('both rows have a bubble that says what they change', (block.match(/infoIcon\(/g) || []).length === 2 && /Unraids eigene Einstellung/.test(block));
  ok('header.js hides the tab on that same key', /root\.classList\.toggle\("cc-hide-favtab", g\("cc\.hidefavtab", "0"\) === "1"/.test(header));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
