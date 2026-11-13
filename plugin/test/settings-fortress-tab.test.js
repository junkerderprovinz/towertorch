// The Fortress tab on the settings page: GlimStone's fortress card in a tab of its own right
// after General, as in every app of a fortress, talking to the engine through the adapter.
// What can quietly break it:
//   · the proxy not forwarding the card's reads, so the tab stays empty
//   · the card's files not loading before settings.js, so nothing mounts
//   · an adapter that loses the engine's error code, so a wrong phrase reads as a generic failure
//   · a status window showing raw ISO times
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const settings = read('scripts/settings.js');
function grab(name) {
  const i = settings.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = settings.indexOf('{', i); k < settings.length; k++) { if (settings[k] === '{') d++; else if (settings[k] === '}') { d--; if (!d) return settings.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nThe proxy forwards the card\'s reads and nothing more');
for (const f of ['server/ttapi.php', 'server/api.php']) {
  const proxy = read(f);
  ok(f + ': the state is read by GET only', /'fortress' => \['GET'\]/.test(proxy));
  ok(f + ': a member\'s status by GET only, to its engine route', /'fortressmember' => \['GET'\]/.test(proxy) && /'fortressmember' => 'fortress\/member'/.test(proxy));
  ok(f + ': it passes the id and the language, each only in its shape', /'fortressmember' => \['id', 'lang'\]/.test(proxy) && /'id' => '\/\^\[a-z0-9-\]\{1,80\}\$\/'/.test(proxy));
  ok(f + ': joining, leaving and removing stay POST only', ['fortressjoin', 'fortressleave', 'fortressremove'].every((p) => new RegExp("'" + p + "' => \\['POST'\\]").test(proxy)));
}

console.log('\nThe page loads the card before the settings');
{
  const page = read('TowerTorch.page');
  const card = page.indexOf('scripts/fortress-card.js'), main = page.indexOf('scripts/settings.js');
  ok('its script comes before settings.js, both deferred', card > 0 && card < main && /<script defer src="<\?autov\('\/plugins\/towertorch\/scripts\/fortress-card\.js'\)\?>"><\/script>/.test(page));
  ok('and its sheet is linked', /<link type="text\/css" rel="stylesheet" href="<\?autov\('\/plugins\/towertorch\/styles\/fortress-card\.css'\)\?>">/.test(page));
}

console.log('\nIts tab stands just above Info');
{
  ok('the fortress is the section before Info, named in both languages', /SECS\.push\(\{ id: "fortress", t: T\("Festung", "Fortress"\), w: wrapFortress, key: null \}\);\n\s*SECS\.push\(\{ id: "info"/.test(settings));
  ok('its wrapper stands just above Info\'s on the page', /wrapFavorites, wrapFortress, wrapInfo\]/.test(settings));
  ok('it holds the card\'s element and nothing else', /var wrapFortress = el\("div", "tt-set-wrap"\);\n\s*if \(fortressCard\(\)\) wrapFortress\.appendChild\(fortressCard\(\)\);/.test(settings));
  const mount = grab('fortressCard');
  ok('the card mounts once, in the language T speaks, as TowerTorch', /if \(!fortressEl && window\.GlimFortressCard\)/.test(mount) && /mount\(fortressEl, fortressAdapter, \{ lang: fortressLang, app: \{ id: "towertorch", name: "TowerTorch" \} \}\)/.test(mount) && /var fortressLang = de \? "de" : "en"/.test(settings));
  ok('without rows of its own', !/rows:/.test(mount));
}

// The adapter runs against a stand-in for the engine.
const calls = [];
let answer = () => Promise.resolve({ joined: true });
const refreshed = [];
const block = settings.slice(settings.indexOf('  var fortressLang = '), settings.indexOf('  function fortressCard('));
const build = (lang) => new Function('de', 'T', 'api', 'window', block + '\nreturn { adapter: fortressAdapter, time: fortressTime };')(
  lang === 'de', (d, e) => (lang === 'de' ? d : e), (m, p, b, q) => { calls.push([m, p, b, q]); return answer(m, p); }, { TTMaint: { refresh: () => refreshed.push(1) } });
const { adapter, time } = build('en');

console.log('\nThe adapter speaks for the card');
(async () => {
  await adapter.load();
  ok('the state is the fortress path', calls[0][0] === 'GET' && calls[0][1] === 'fortress');

  console.log('\nTaken out or left behind by a new phrase, the card says what the plan misses');
  const EN = 'Until then the maintenance plan runs without backups and updates.';
  const DE = 'Bis dahin läuft der Wartungsplan ohne Sicherungen und Updates.';
  const hintsOf = async (a, st) => { answer = () => Promise.resolve(st); return (await a.load()).hints; };
  ok('a member in good standing gets no line', (await hintsOf(adapter, { joined: true, device: 'Tower' })).length === 0);
  ok('so does one that is out by choice', (await hintsOf(adapter, { joined: false })).length === 0);
  const out = await hintsOf(adapter, { joined: false, removedHere: true });
  ok('taken out, one warning says the plan runs without backups and updates', out.length === 1 && out[0].tone === 'warn' && out[0].text === EN, JSON.stringify(out));
  const moved = await hintsOf(adapter, { joined: true, phraseChanged: true });
  ok('the same after a phrase change TowerTorch could not follow', moved.length === 1 && moved[0].tone === 'warn' && moved[0].text === EN && !moved[0].action);
  ok('in German too', (await hintsOf(build('de').adapter, { joined: true, phraseChanged: true }))[0].text === DE);
  answer = () => Promise.resolve({ joined: false, removedHere: true });
  ok('every step the card takes carries it as well', (await adapter.join(['x'])).hints.length === 1 && (await adapter.leave()).hints.length === 1 && (await adapter.remove('i')).hints.length === 1);
  answer = () => Promise.reject(Object.assign(new Error('x'), { status: 404 }));
  ok('a hidden card stays hidden', (await adapter.load()) === null);
  calls.length = 0; refreshed.length = 0; answer = () => Promise.resolve({ joined: true });
  const err = (status, code) => Object.assign(new Error(code || 'HTTP ' + status), { status, code });
  answer = () => Promise.reject(err(502, 'engine unreachable'));
  ok('an engine that is down hides the card', (await adapter.load()) === null);
  answer = () => Promise.reject(err(404));
  ok('so does an engine without a fortress', (await adapter.load()) === null);
  answer = () => Promise.reject(err(500, 'disk full'));
  ok('any other failure shows as one', await adapter.load().then(() => false, (e) => e.code === 'disk full'));

  calls.length = 0; answer = () => Promise.resolve({ joined: true });
  const words = 'legal winner thank year wave sausage worth useful legal winner thank yellow'.split(' ');
  const s = await adapter.join(words);
  ok('the twelve words go in as the phrase', calls[0][0] === 'POST' && calls[0][1] === 'fortressjoin' && calls[0][2].phrase === words.join(' '));
  ok('and the new state comes back', s.joined === true);
  ok('the maintenance card hears of it', refreshed.length === 1);
  await adapter.leave();
  await adapter.remove('i-bv');
  ok('leaving and removing take their paths, removing by id', calls[1][1] === 'fortressleave' && calls[2][1] === 'fortressremove' && calls[2][2].id === 'i-bv' && refreshed.length === 3);
  answer = () => Promise.reject(err(400, 'phrase'));
  ok('a wrong phrase keeps its code for the card', await adapter.join(words).then(() => false, (e) => e.code === 'phrase'));
  ok('settings.js gives every failure the engine\'s code and status', /err\.status = r\.status; err\.code = d && d\.error; throw err;/.test(grab('api')) && /function api\(method, path, body, query\)/.test(settings));

  calls.length = 0;
  answer = () => Promise.resolve({
    report: { state: 'warning', needsYou: [{ severity: 'warn', text: 'Check the disk' }], work: [], next: [{ title: 'Backup', at: '2026-11-14T03:30:00Z' }] },
    log: [{ id: '9', at: '2026-11-13T03:30:00Z', level: 'info', code: 'x', text: 'Done' }],
  });
  const st = await adapter.status('i-sl');
  ok('a member\'s status asks for it by id, in the card\'s language', calls[0][0] === 'GET' && calls[0][1] === 'fortressmember' && calls[0][3].id === 'i-sl' && calls[0][3].lang === 'en');
  ok('its report comes through', st.report.state === 'warning' && st.report.needsYou[0].text === 'Check the disk');
  ok('every time reads as a date for people', st.report.next[0].at === time('2026-11-14T03:30:00Z') && st.log[0].at === time('2026-11-13T03:30:00Z') && !/T03:30/.test(st.log[0].at));
  ok('a log line carries its level and text', st.log[0].level === 'info' && st.log[0].text === 'Done');
  ok('the German page asks in German', (await build('de').adapter.status('i-sl'), calls[1][3].lang === 'de'));

  console.log('\nThe search finds the card by its words');
  const run = grab('runFilter');
  ok('the card stays while its text matches, and goes otherwise', /var fortressHit = searchText\(wrapFortress\)\.indexOf\(q\) >= 0;\s*wrapFortress\.style\.display = fortressHit \? "" : "none";\s*if \(fortressHit\) shown\+\+;/.test(run));

  console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
  process.exit(fail ? 1 : 0);
})();
