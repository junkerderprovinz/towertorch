// The maintenance plan's panel (scripts/maintenance.js): the bar button, the window and the
// settings card. What can quietly break it:
//   · a proxy that does not forward the new paths, so every click answers "not allowed"
//   · a text missing in one language, or written with a dash or semicolon the house style forbids
//   · a step that says it will run while its app is missing, or a missing app that is not named
//   · a plan that was never saved showing every step off
//   · a link from the engine that is not http(s) turning into a live href
//   · the bar or the settings page not mounting the panel at all
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = read('scripts/maintenance.js');
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const T = new Function('return ' + /var T = (\{[\s\S]*?\n  \});/.exec(js)[1])();

console.log('\nThe proxy forwards the panel\'s paths and nothing more');
{
  const proxy = read('server/ttapi.php');
  ok('the plan is read and saved', /'maintenance' => \['GET', 'PUT'\]/.test(proxy));
  ok('a run starts and stops by POST only', /'maintenancerun' => \['POST'\]/.test(proxy) && /'maintenancestop' => \['POST'\]/.test(proxy));
  ok('the phrase goes in by POST only', /'fortressjoin' => \['POST'\]/.test(proxy));
  ok('leaving goes out by POST only, to its engine route', /'fortressleave' => \['POST'\]/.test(proxy) && /'fortressleave' => 'fortress\/leave'/.test(proxy));
  ok('each reaches its engine route', /'maintenancerun' => 'maintenance\/run'/.test(proxy) && /'maintenancestop' => 'maintenance\/stop'/.test(proxy) && /'fortressjoin' => 'fortress\/join'/.test(proxy) && /\$route\[\$path\]/.test(proxy));
  ok('lang passes only in the shape of a language tag', /'maintenance' => \['lang'\]/.test(proxy) && /\$qshape = \['lang' => /.test(proxy));
}

console.log('\nEvery text in both languages, in the house style');
{
  const en = Object.keys(T.en), de = Object.keys(T.de);
  ok('German has every English key', en.every((k) => k in T.de), en.filter((k) => !(k in T.de)).join(' '));
  ok('and no key of its own', de.every((k) => k in T.en), de.filter((k) => !(k in T.en)).join(' '));
  const all = [...Object.values(T.en), ...Object.values(T.de)];
  const banned = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ';]| \\+ ');
  ok('no long dash, semicolon or "+" as a word', all.every((s) => !banned.test(s)), all.filter((s) => banned.test(s)).join(' | '));
  const used = [...js.matchAll(/\bt\("([a-zA-Z.-]+)"(?=\s*[,)])/g)].map((m) => m[1]);
  ok('every text the script asks for exists', used.length > 40 && used.every((k) => k in T.en), used.filter((k) => !(k in T.en)).join(' '));
  ok('placeholders match between the languages', en.every((k) => (T.en[k].match(/\{\w+\}/g) || []).sort().join() === (T.de[k].match(/\{\w+\}/g) || []).sort().join()));
}

// The functions run against a stand-in for the panel's state, with the real texts.
const env = { LANG: 'en', T, STEPS: ['backup', 'update', 'check', 'restart'], APPS: { bombvault: 'BombVault', shiplog: 'ShipLog', firesquire: 'FireSquire' }, DEFAULT_AT: '03:30', S: null };
const make = (names) => new Function(...Object.keys(env), names.map(grab).join('\n') + '\nreturn {' + names.join(',') + '};');
const fns = (S, lang) => make(['t', 'appName', 'server', 'avail', 'fromEngine', 'safeLink', 'itemLabel', 'pending', 'schedText', 'dayNames', 'chipCls'])(...Object.values({ ...env, LANG: lang || 'en', S }));

console.log('\nA plan never saved offers every step');
{
  const f = fns({});
  const p = f.fromEngine({ steps: {}, containers: null, schedule: { on: false, at: '' } });
  ok('all four steps on, flagged as fresh', p.fresh && Object.values(p.plan.steps).every(Boolean));
  ok('with a time to start from', p.plan.schedule.at === '03:30');
  const q = f.fromEngine({ steps: { check: true }, containers: ['a'], schedule: { on: true, days: [0], at: '04:00' } });
  ok('a saved plan stays as it is', !q.fresh && q.plan.steps.check && !q.plan.steps.backup && q.plan.containers[0] === 'a' && q.plan.schedule.at === '04:00');
}

console.log('\nEach step says whether its app is there');
{
  const plan = { steps: { backup: true, update: true, check: true, restart: true }, containers: [], schedule: { on: false, days: [], at: '03:30' } };
  let f = fns({ plan, o: { server: 'Tower', ready: { fortress: false, check: false } } });
  ok('outside a fortress backup and update are skipped', f.avail('backup')[0] === 'warn' && /isn't in a fortress/.test(f.avail('update')[1]));
  ok('without FireSquire the check is red and names the server', f.avail('check')[0] === 'err' && /Tower/.test(f.avail('check')[1]));
  ok('and the restart waits', f.avail('restart')[0] === 'warn' && f.pending({ step: 'restart' }) !== '');
  f = fns({ plan, o: { server: 'Tower', ready: { fortress: true, backup: { found: true, app: 'bombvault', device: 'Tower', online: true }, update: { found: false, elsewhere: ['Basement'] }, check: true } } });
  ok('a backup app here is named with its server and the state in GlimStone\'s word', f.avail('backup')[0] === 'ok' && f.avail('backup')[1] === 'BombVault on Tower: Connected');
  ok('an app on another server is named, and the step is skipped', f.avail('update')[0] === 'warn' && /Basement/.test(f.avail('update')[1]) && /ShipLog is missing/.test(f.pending({ step: 'update' })));
  f = fns({ plan, o: { server: 'Tower', ready: { fortress: true, backup: { found: true, app: 'bombvault', device: 'Tower', online: false }, update: {}, check: true } } });
  ok('one that is offline is red and Not reachable, never skipped quietly', f.avail('backup')[0] === 'err' && f.avail('backup')[1] === 'BombVault on Tower: Not reachable');
  const off = fns({ plan: { ...plan, steps: { ...plan.steps, update: false } }, o: { ready: {} } });
  ok('a step switched off says so', off.avail('update')[1] === 'Switched off');
  const de = fns({ plan, o: { server: 'Tower', ready: { fortress: true, backup: { found: true, app: 'bombvault', device: 'Tower', online: true }, update: {}, check: true } } }, 'de');
  ok('in German too', de.avail('backup')[1] === 'BombVault auf Tower: Verbunden');
}

console.log('\nThe report reads plainly');
{
  const f = fns({ plan: { steps: {}, schedule: { on: true, days: [1, 0], at: '03:30' } }, o: {} });
  ok('the schedule names its days from Monday', f.schedText() === 'Mo, Su at 03:30');
  ok('an item that never ran says so', f.itemLabel('backup', { state: 'notRun', code: '' }) === "didn't run");
  ok('a rolled back update is named', f.itemLabel('update', { state: 'warn', code: 'update.rolled_back' }) === 'rolled back');
  ok('a container that is gone is named', f.itemLabel('backup', { state: 'skipped', code: 'container.gone' }) === 'no longer there');
  ok('a finding that blocks the restart', f.itemLabel('check', { state: 'failed', code: 'fortress_busy' }) === 'blocks');
  ok('a held restart wears the warning colour', f.chipCls('held') === 'warn' && f.chipCls('failed') === 'failed');
  ok('only an http(s) link opens', f.safeLink('https://bv.lan/s/1') === 'https://bv.lan/s/1' && f.safeLink('javascript:alert(1)') === '' && f.safeLink('') === '');
}

console.log('\nThe Docker tab and the settings page mount the panel');
{
  const docker = read('scripts/docker.js'), settings = read('scripts/settings.js');
  ok('the bar gets its button whenever docker.js arranges it', /ensureBarToggle\(jsa\);\n\s+if \(window\.TTMaint\) window\.TTMaint\.bar\(jsa\);/.test(docker));
  ok('the button stands beside "Check for updates"', /onclick\^="checkAll\("/.test(grab('bar')));
  ok('the settings card follows the notifications', /wrap\.appendChild\(c5\);\n\s+if \(window\.TTMaint\) wrap\.appendChild\(window\.TTMaint\.card\(card\(/.test(settings));
  for (const page of ['TowerTorch.Docker.page', 'TowerTorch.page']) {
    const src = read(page);
    const m = src.indexOf('scripts/maintenance.js'), area = src.indexOf(page === 'TowerTorch.page' ? 'scripts/settings.js' : 'scripts/docker.js');
    ok(page + ' loads the panel before its area script', m > 0 && m < area && /styles\/maintenance\.css/.test(src));
  }
  const css = read('styles/docker.css');
  ok('the bar button looks like its neighbours', /\.tt-bulkmode-badge, \.tt-allct, \.tt-maintbtn\)/.test(css) && /div\.js-actions \.tt-maintbtn:hover/.test(css));
}

console.log('\nThe report says where the notification went');
{
  const { delivery } = make(['t', 'delivery'])(...Object.values({ ...env, S: {} }));
  ok('every channel took it', delivery({ sent: 2 }) === 'sent to 2 of 2 channels');
  ok('the one channel there is', delivery({ sent: 1 }) === 'sent');
  ok('a channel that failed is named', delivery({ sent: 1, failed: ['Home Assistant'] }) === 'sent to 1 of 2, Home Assistant failed');
  ok('no channel set up', delivery({ sent: 0 }) === 'no channel set up');
  ok('the report shows it only when the engine sent one', /r\.notified \? .*delivery\(r\.notified\)/.test(grab('viewReport')));
}

console.log('\nLeaving the fortress, as GlimStone\'s FortressPairing does');
{
  const card = grab('paintCard'), leave = grab('leave');
  ok('a row of its own while TowerTorch is in a fortress, with an (i)', /if \(ready\.fortress\) \{[\s\S]*set\.leaveRow[\s\S]*info\(t\("set\.leaveAbout"\)\)[\s\S]*data-act="leave"/.test(card));
  ok('it asks first and says what ends', /theme\(\)\.ask\(\{ title: t\("set\.leaveTitle"\), text: t\("set\.leaveBody"\)/.test(leave));
  ok('the answer is not a red delete', !/danger/.test(leave) && !/Trash/.test(leave));
  ok('the button wears GlimStone\'s sign-out glyph', /glyph\("SignOut"\)/.test(card) && /glyph: "SignOut"/.test(leave));
}

console.log('\nTaken out by another member, the card says so and offers the phrase');
{
  const card = grab('paintCard');
  ok('the card names it once the engine says so', /if \(ready\.removed && !ready\.fortress\)[\s\S]*t\("set\.removed"/.test(card));
  ok('the phrase field follows it', card.indexOf('set.removed') > 0 && card.indexOf('set.removed') < card.indexOf('tt-mw-joinrow'));
  ok('the words name this server and the phrase', /\{server\}/.test(T.en['set.removed'] || '') && /\{server\}/.test(T.de['set.removed'] || '') && /phrase/i.test(T.en['set.removed'] || ''));
  // The phrase TowerTorch knew may have changed since, so nothing promises it still opens the fortress.
  for (const k of ['set.removed', 'set.leaveAbout', 'set.leaveBody']) {
    ok(k + ' points at the current phrase', /current phrase/.test(T.en[k] || '') && /aktuellen Phrase/.test(T.de[k] || ''));
    ok(k + ' promises no way back at any time', !/any time/.test(T.en[k] || '') && !/jederzeit/.test(T.de[k] || ''));
  }
}

console.log('\nAfter a phrase change it could not follow, the card asks for the new words');
{
  const card = grab('paintCard');
  ok('the card says so once the engine does', /if \(ready\.fortress && ready\.phraseChanged\)[\s\S]*t\("set\.changed"\)/.test(card));
  ok('the phrase field follows it while TowerTorch is still in', /if \(S\.o && \(!ready\.fortress \|\| ready\.phraseChanged\)\)/.test(card) && card.indexOf('set.changed"') < card.indexOf('tt-mw-joinrow'));
  ok('both languages name the new words', /new words/.test(T.en['set.changed'] || '') && /neuen Wörter/.test(T.de['set.changed'] || '') && !!T.en['set.changedRow'] && !!T.de['set.changedRow']);
}

console.log('\nThe phrase stays out of sight');
{
  ok('the field hides what is typed and is never spell-checked', /type="password" autocomplete="off" spellcheck="false"/.test(grab('paintCard')));
  ok('it is cleared once TowerTorch is in', /field\.value = ""/.test(grab('join')));
}

console.log('\nThe reminder starts in the value column of the row above');
{
  const S2 = { plan: null, o: { server: 'Tower', ready: { fortress: true, device: 'Bottich' }, fortress: { members: [], removed: [{ app: 'tollroll', name: 'TollRoll', device: 'Bottich' }] } } };
  const names = ['t', 'esc', 'info', 'glyph', 'running', 'chip', 'chipCls', 'when', 'server', 'memberName', 'listOf', 'keepers', 'changeWhere', 'paintCard'];
  const p = new Function(...Object.keys(env), 'theme', names.map(grab).join('\n') + '\nreturn {' + names.join(',') + '};')(...Object.values({ ...env, S: S2 }), () => ({}));
  const attrs = {};
  const body = { querySelector: () => null, getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; }, innerHTML: '' };
  p.paintCard(body);
  const rows = body.innerHTML.split('<div class="tt-set-row').slice(1);
  const leaveRow = rows.find((r) => /data-act="leave"/.test(r)) || '';
  ok('no row of its own with an empty label column', !rows.some((r) => /tt-mw-removednote/.test(r) && !/data-act="leave"/.test(r)));
  ok('it sits in the value of "This app in the fortress", under the device', /tt-mw-device[\s\S]*data-act="leave"[\s\S]*tt-mw-removednote[\s\S]*Removed: TollRoll on Bottich\./.test(leaveRow) && leaveRow.includes(T.en['set.changeNone']) && !/data-act="change"/.test(leaveRow), leaveRow);
  const css = read('styles/maintenance.css');
  ok('the value stacks its lines from the left', /\.tt-mw-stack \{[^}]*flex-direction: column[^}]*align-items: flex-start/.test(css));
  ok('the text reads from the left with the button right after it, wrapping on a phone', /\.tt-mw-removednote \{[^}]*flex-wrap: wrap/.test(css) && /\.tt-mw-removednote \.tt-mw-removed \{[^}]*text-align: start/.test(css));
  S2.o.fortress.removed = [];
  attrs['data-html'] = '';
  p.paintCard(body);
  ok('without anybody removed the row keeps its single line', !/tt-mw-stack|tt-mw-removednote/.test(body.innerHTML));
}

console.log('\nRemoving another member, then the offer to change the phrase');
{
  for (const f of ['server/ttapi.php', 'server/api.php']) {
    const proxy = read(f);
    ok(f + ' lets a removal through by POST only, to its engine route', /'fortressremove' => \['POST'\]/.test(proxy) && /'fortressremove' => 'fortress\/remove'/.test(proxy));
  }
  const card = grab('paintCard');
  ok('each other member gets a row with Remove while TowerTorch is in', /if \(ready\.fortress\) \{[\s\S]*members\.forEach[\s\S]*data-act="remove" data-id="/.test(card));
  ok('Remove wears the bin and no red', /glyph\("Trash"\) \+ esc\(t\("set\.remove"\)\)/.test(card) && !/tt-btn-del|danger/.test(card));
  ok('the reminder names the removed and where the phrase is changed', /removed\.length[\s\S]*t\("set\.removedNote", \{ devices: [\s\S]*changeWhere\(\)/.test(card) && !/data-act="change"/.test(card));
  const theme = read('scripts/tt-theme.js');
  ok('a window with a single answer shows a single button', /if \(o\.cancel != null\) act\.appendChild\(no\)/.test(theme));

  const calls = [], asks = [], toasts = [], opened = [];
  const S = { o: { ready: { fortress: true }, fortress: {
    members: [
      { id: 'i-tr', kind: 'viewer', app: 'tollroll', name: 'TollRoll', device: 'Bottich', deployment: 'plugin', address: '', online: true },
      { id: 'i-bv', kind: 'instance', app: 'bombvault', name: 'BombVault', device: 'Bottich', deployment: 'container', address: 'http://192.168.10.10:8484', online: true },
      { id: 'i-kl', kind: 'instance', app: 'knightloader', name: 'KnightLoader', device: 'Attic', deployment: 'container', online: false },
      { id: 'i-bv0', kind: 'instance', app: 'bombvault', name: 'BombVault', device: 'Bottich', deployment: 'container', online: false },
    ], removed: [] } } };
  const fake = {
    theme: () => ({ ask: (o) => asks.push(o) }),
    api: (method, path, body) => { calls.push([method, path, body]); return Promise.resolve({ status: 'removed' }); },
    toast: (m, k) => toasts.push([m, k]), deny: (el, m) => toasts.push([m, 'error']), load: () => Promise.resolve(),
    window: { open: (u, n, f) => opened.push([u, n, f]) },
  };
  const names = ['t', 'memberName', 'listOf', 'keepers', 'changeWhere', 'removeMember', 'offerChange'];
  const build = (lang) => new Function(...Object.keys(env), ...Object.keys(fake), names.map(grab).join('\n') + '\nreturn {' + names.join(',') + '};')(...Object.values({ ...env, LANG: lang, S }), ...Object.values(fake));
  const f = build('en');

  f.removeMember(null, 'i-tr');
  const q = asks[0] || {};
  ok('the window names app and device', q.title === 'Remove TollRoll on Bottich?' && q.text === "TollRoll on Bottich loses its access right away. This can't be undone.", q.title);
  ok('it is no red delete and continues with Remove', !q.danger && q.ok === 'Remove' && q.cancel === 'Cancel');
  ok('nothing goes before the answer', calls.length === 0);
  if (q.onOk) q.onOk();
  setTimeout(() => {
    ok('the answer removes that member by its id', calls.length === 1 && calls[0][0] === 'POST' && calls[0][1] === 'fortressremove' && calls[0][2].id === 'i-tr', JSON.stringify(calls));
    const c = asks[1] || {};
    ok('then the window asks to change the phrase', c.title === 'Change the phrase now?' && /TollRoll on Bottich is out/.test(c.text || ''), JSON.stringify(c));
    ok('and names the apps and devices where that happens, those in reach first and each once', (c.text || '').endsWith(' You change the phrase in BombVault on Bottich or KnightLoader on Attic.'), c.text);
    ok('Later is its only answer', c.ok === 'Later' && c.cancel == null && !c.onOk, JSON.stringify(c));
    ok('nothing opens a member\'s address', opened.length === 0 && !/192\.168/.test(JSON.stringify(asks)), JSON.stringify(opened));
    ok('in German too', build('de').changeWhere() === 'Die Phrase änderst du in BombVault auf Bottich oder KnightLoader auf Attic.', build('de').changeWhere());
    S.o.fortress.members = S.o.fortress.members.filter((m) => m.deployment === 'plugin');
    ok('a plugin keeps no phrase, so then the window says where it changes', f.changeWhere() === T.en['set.changeNone'], f.changeWhere());
    ok('an app without a name is called by its device', f.memberName({ device: 'Attic' }) === 'Attic');
    for (const k of ['set.remove', 'set.removeTitle', 'set.removeBody', 'set.removedTitle', 'set.removedBody', 'set.later', 'set.removedNote', 'set.memberOn']) {
      ok(k + ' matches GlimStone', T.en[k] === glim.en[k] && T.de[k] === glim.de[k], T.en[k] + ' | ' + T.de[k]);
    }
    console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
    process.exit(fail ? 1 : 0);
  }, 20);
}

// GlimStone's own words for removing, so every app in the fortress says the same.
const glim = {
  en: { 'set.remove': 'Remove', 'set.memberOn': '{app} on {device}', 'set.removeTitle': 'Remove {device}?', 'set.removeBody': "{device} loses its access right away. This can't be undone.", 'set.removedTitle': 'Change the phrase now?', 'set.removedBody': '{device} is out. As long as the phrase stays the same, the way back in is still open.', 'set.later': 'Later', 'set.removedNote': 'Removed: {devices}. Change the phrase to close the way back in.' },
  de: { 'set.remove': 'Herausnehmen', 'set.memberOn': '{app} auf {device}', 'set.removeTitle': '{device} herausnehmen?', 'set.removeBody': '{device} verliert sofort den Zugang. Das lässt sich nicht rückgängig machen.', 'set.removedTitle': 'Phrase jetzt ändern?', 'set.removedBody': '{device} ist draußen. Solange die Phrase gleich bleibt, steht der Weg zurück aber noch offen.', 'set.later': 'Später', 'set.removedNote': 'Herausgenommen: {devices}. Ändere die Phrase, dann ist der Weg zurück zu.' },
};
