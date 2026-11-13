// The maintenance plan's panel (scripts/maintenance.js): the bar button, the window and the
// settings card. What can quietly break it:
//   · a proxy that does not forward the new paths, so every click answers "not allowed"
//   · a text missing in one language, or written with a dash or semicolon the house style forbids
//   · a step that says it will run while its app is missing, or a missing app that is not named
//   · a plan that was never saved showing every step off
//   · an item linking to another app, which would show that app's address
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
  ok('each reaches its engine route', /'maintenancerun' => 'maintenance\/run'/.test(proxy) && /'maintenancestop' => 'maintenance\/stop'/.test(proxy) && /\$route\[\$path\]/.test(proxy));
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
const fns = (S, lang) => make(['t', 'appName', 'server', 'avail', 'fromEngine', 'itemLabel', 'pending', 'schedText', 'dayNames', 'chipCls'])(...Object.values({ ...env, LANG: lang || 'en', S }));

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
  ok('an item links nowhere, so no address of another app shows', !/\bhref\b|\.link\b/.test(grab('itemsHtml')), grab('itemsHtml'));
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

console.log('\nThe card says how TowerTorch stands in the fortress and leads to the Fortress tab');
{
  const S2 = { plan: null, o: { server: 'Tower', ready: { fortress: true, device: 'Bottich' } } };
  const names = ['t', 'esc', 'info', 'glyph', 'running', 'chip', 'chipCls', 'when', 'server', 'fortressLine', 'paintCard'];
  const p = new Function(...Object.keys(env), 'theme', names.map(grab).join('\n') + '\nreturn {' + names.join(',') + '};')(...Object.values({ ...env, S: S2 }), () => ({}));
  const attrs = {};
  const body = { getAttribute: (k) => attrs[k], setAttribute: (k, v) => { attrs[k] = v; }, innerHTML: '' };
  const paint = () => { attrs['data-html'] = ''; p.paintCard(body); return body.innerHTML.split('<div class="tt-set-row').slice(1).find((r) => r.includes(T.en['set.here'])) || ''; };
  ok('inside, it names the device TowerTorch joined as', paint().includes('In your fortress as Bottich'));
  ok('without the way to the tab nothing points there', !/data-act="fortress"/.test(paint()));
  S2.toFortress = () => {};
  ok('the button goes to the Fortress tab, with the jump glyph of the settings', /data-act="fortress">.*Go to Fortress/.test(paint()) && /glyph\("Gear"\) \+ esc\(t\("link\.fortress"\)\)/.test(grab('paintCard')));
  S2.o.ready = { fortress: false };
  ok('outside, it says the plan runs without backups and updates', paint().includes(T.en['set.out'].replace(/'/g, '&#39;')));
  S2.o.ready = { fortress: false, removed: true };
  ok('taken out, it names this server', paint().includes('took Tower out of it'));
  S2.o.ready = { fortress: true, phraseChanged: true, device: 'Bottich' };
  ok('after a phrase change it asks for the new words', paint().includes(T.en['set.changed'].replace(/'/g, '&#39;')));
  ok('joining, leaving and removing are the Fortress tab\'s', !/fortressjoin|fortressleave|fortressremove|data-act="(join|leave|remove)"|tt-mw-phrase/.test(js));
  for (const k of ['set.removed', 'set.changed']) {
    ok(k + ' points at the Fortress tab', /Fortress tab/.test(T.en[k]) && /Tab Festung/.test(T.de[k]));
  }
  ok('the phrase TowerTorch knew may have changed, so it asks for the current one', /current phrase/.test(T.en['set.removed']) && /aktuellen Phrase/.test(T.de['set.removed']));
  ok('settings.js hands the card the way to the tab', /window\.TTMaint\.card\(card\([^;]*, function \(\) \{ jumpTo\("fortress"\); \}\)\)/.test(read('scripts/settings.js')));
}

console.log('\nIn the window, a step waiting for the fortress links to the Fortress tab');
{
  const plan = { steps: { backup: true, update: true, check: true, restart: true }, containers: [], schedule: { on: false, days: [], at: '03:30' } };
  const f = fns({ plan, o: { ready: { fortress: false, check: true } } });
  ok('backup and update ask for the link outside a fortress', f.avail('backup')[2] === true && f.avail('update')[2] === true && !f.avail('check')[2]);
  ok('and not once TowerTorch is in', !fns({ plan, o: { ready: { fortress: true, check: true } } }).avail('backup')[2]);
  ok('the step row draws it after the text', /esc\(a\[1\]\) \+ \(a\[2\] \? fortressLink\(\) : ""\)/.test(grab('viewPlan')));
  ok('it wears the window\'s link look and opens the settings page', /class="tt-mw-link" href="\/Settings\/TowerTorch" data-act="tofortress"/.test(grab('fortressLink')));
  const to = grab('toFortress');
  ok('on the settings page the window closes and the tab opens', /if \(S\.toFortress\) \{ e\.preventDefault\(\); close\(\); S\.toFortress\(\); return; \}/.test(to));
  ok('elsewhere the page opens on that tab', /localStorage\.setItem\("tt\.settab", "fortress"\)/.test(to));
  ok('it works while a run locks the plan', grab('onClick').indexOf('"tofortress"') < grab('onClick').indexOf('locked(el)'));
  const css = read('styles/maintenance.css');
  ok('the link stays in sight beside its step', /html \.tt-mw \.tt-mw-avail a\.tt-mw-link \{[^}]*opacity: 1/.test(css));
  ok('the card follows each step the Fortress tab takes', /window\.TTMaint = \{[^}]*refresh: load/.test(js));
}

console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
process.exit(fail ? 1 : 0);
