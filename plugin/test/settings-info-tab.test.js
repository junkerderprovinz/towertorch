// The settings page ends in an Info tab with GlimStone's four cards in its order: Version,
// Components, Help and About. The Version card holds TowerTorch and its number and one last row
// with where the updates stand, as Unraid's plugin manager sees it, and the buttons that go with
// it. Every other number stands in Components. Each version reads as plain text that opens its
// project's newest release, and each appears once: no footer line, no version in the gear menu.
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
const settings = read('scripts/settings.js');
const docker = read('scripts/docker.js');
const css = read('styles/docker.css');
const update = read('server/update.php');
const consts = ['REPO', 'GLS_REPO', 'GLS_VER', 'UPDATE_API'].map((n) => (new RegExp('  var ' + n + ' = [^;]+;').exec(settings) || [''])[0]).join('\n');
const cardText = settings.slice(settings.indexOf('  var CARD_TEXT = '), settings.indexOf('};', settings.indexOf('  var CARD_TEXT = ')) + 2);

class N {
  constructor(tag, cls, txt) { this.tag = tag; this.cls = new Set((cls || '').split(' ').filter(Boolean)); this.kids = []; this.parent = null; this.attrs = {}; this.style = {}; this.on = {}; this._t = txt == null ? '' : String(txt); }
  get classList() { const c = this.cls; return { add: (...a) => a.forEach((x) => c.add(x)), remove: (...a) => a.forEach((x) => c.delete(x)), contains: (x) => c.has(x) }; }
  get textContent() { return this.kids.length ? this.kids.map((k) => k.textContent).join('') : this._t; }
  set textContent(v) { this._t = String(v); this.kids = []; }
  set innerHTML(v) { this._t = ''; this.kids = []; }
  get firstChild() { this.own(); return this.kids[0] || null; }
  own() { if (this._t && !this.kids.length) { this.kids.push(new N('#text', '', this._t)); this._t = ''; } }
  appendChild(k) { this.own(); k.parent = this; this.kids.push(k); return k; }
  insertBefore(k, ref) { this.own(); k.parent = this; const i = this.kids.indexOf(ref); this.kids.splice(i < 0 ? this.kids.length : i, 0, k); return k; }
  replaceChild(k, old) { const i = this.kids.indexOf(old); k.parent = this; this.kids[i] = k; return old; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.on[t] = this.on[t] || []).push(fn); }
  click() { (this.on.click || []).forEach((fn) => fn({ type: 'click', target: this })); }
  all() { const out = []; const walk = (n) => n.kids.forEach((k) => { out.push(k); walk(k); }); walk(this); return out; }
  find(c) { return this.all().find((n) => n.cls.has(c)); }
}
const el = (t, c, x) => new N(t, c, x);
const tick = () => new Promise((r) => setTimeout(r, 0));

console.log('\nThe last tab is Info, with four cards in GlimStone order');
{
  ok('Info is pushed after every area', /SECS\.push\(\{ id: "info", t: T\("Info", "Info"\), w: wrapInfo, key: null \}\);/.test(settings));
  ok('the Info tab has a glyph', /^\s+info: \["/m.test(settings));
  ok('its cards stand on the page', /\[wrapMain, [^\]]*wrapInfo\]\.forEach\(function \(w\) \{ main\.appendChild\(w\); \}\);/.test(settings));
  const block = settings.slice(settings.indexOf('// The Info tab in GlimStone'), settings.indexOf('refreshTabs();', settings.indexOf('// The Info tab in GlimStone')));
  const order = [...block.matchAll(/wrapInfo\.appendChild\((versionCard|componentsCard)\(\)\)|card\(T\("([^"]+)", "([^"]+)"\)\)/g)].map((m) => m[1] || m[3]);
  ok('Version, Components, Help, About', order.join(',') === 'versionCard,componentsCard,Help,About', order.join(','));
  ok('About is called About alone', /card\(T\("Über", "About"\)\)/.test(block));
  for (const url of ['https://buymeacoffee.com/junkerderprovinz', 'https://www.paypal.com/donate/?hosted_button_id=76FVV52TKXTUS', 'https://junkerderprovinz.github.io/junkerderprovinz/', 'href: REPO }', 'href: DISCORD }']) {
    ok('About and Help reach ' + url, block.includes(url));
  }
  const coffee = block.indexOf('buymeacoffee'), paypal = block.indexOf('paypal.com'), crypto = block.indexOf('github.io/junkerderprovinz');
  ok('the give row runs coffee, PayPal, crypto', coffee < paypal && paypal < crypto);
  const gh = block.indexOf('brand: "github"'), discord = block.indexOf('brand: "discord"'), bug = block.indexOf('downloadBugReport');
  ok('Help runs GitHub, Discord, bug report', gh > 0 && gh < discord && discord < bug);
  ok('and no mail route', !/mailto:|BRAND_MARKS\.mail/.test(settings));
  ok('Discord opens TowerTorch\'s invite', /var DISCORD = "https:\/\/discord\.gg\/avtvQmvwED";/.test(settings));
  ok('the bug report says it is a download', /name: T\("Fehlerbericht", "Bug report"\), sub: T\("Herunterladen", "Download"\)/.test(block));
  ok('the Help sentence names both ways the buttons offer', /auf GitHub auf, oder schau auf Discord vorbei/.test(block) && /on GitHub, or come say hi on Discord/.test(block));
  ok('and no other', !/E-Mail|email/.test(block.slice(block.indexOf('var cHelp'), block.indexOf('var hrow'))));
  const btn = grabFn(settings, 'readmeBtn');
  ok('an outside link opens in a new tab without an opener', /b\.target = "_blank"; b\.rel = "noopener noreferrer";/.test(btn));
  ok('the old plain links are gone', !/function linkBtn/.test(settings));
  ok('every button carries its mark, Buy Me a Coffee its own artwork', /art: BRAND_MARKS\.coffee/.test(block) && /mark: BRAND_MARKS\.paypal/.test(block) && /mark: BRAND_MARKS\.bitcoin/.test(block) && /mark: BRAND_MARKS\.github/.test(block) && /mark: BRAND_MARKS\.discord/.test(block) && /mark: BRAND_MARKS\.bug/.test(block));
  ok('the give row stands a blank line under its sentence', /"#tt-settings \.tt-rbtn-rows\.tt-set-give\{margin-top:calc\(var\(--tt-text-body\) \* 1\.5\)\}"/.test(settings));
  ok('the prose runs ragged, never justified', /"#tt-settings \.tt-set-prose\{text-align:start\}"/.test(settings));
  ok('a brand takes its own colour only under the pointer', /#tt-settings \.tt-rbtn-unit:hover \.tt-rbtn\{background:var\(--tt-tile\);color:var\(--tt-tile-ink\)/.test(settings));
}

// The card's helpers, built in the language given, with the network and the engine stubbed.
function load(lang, opts) {
  const o = Object.assign({ ver: '1.5.3', answers: [], engine: Promise.resolve({ version: 'v1.5.3' }) }, opts);
  const log = { fetched: [], notes: [] };
  const fetch = (url, init) => {
    log.fetched.push({ url, method: (init && init.method) || 'GET', body: init && init.body });
    const a = o.answers.shift();
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve({ ok: !a.status, status: a.status || 200, json: () => Promise.resolve(a.body) });
  };
  const fns = ['labelled', 'card', 'infoIcon', 'actionBtn', 'fill', 'timeAgo', 'verNumber', 'versionCard', 'updateState', 'askUpdates', 'componentsCard', 'componentRow', 'verCmp']
    .map((n) => grabFn(settings, n)).join('\n').replace(/^  function el\(tag, cls, txt\) \{[^\n]*\}/m, '');
  const make = new Function('el', 'de', 'T', 'TT_VER', 'window', 'fetch', 'csrfToken', 'openReleaseNotes', 'apiRead', 'document',
    consts + '\n' + 'var LANG = de ? "de" : "en";\n' + cardText + '\n' + fns + '\nreturn { versionCard: versionCard, componentsCard: componentsCard, verNumber: verNumber, verCmp: verCmp, updateState: updateState, CARD_TEXT: CARD_TEXT };');
  const de = lang === 'de';
  const api = make(el, de, (d, e) => (de ? d : e), o.ver, {}, fetch, () => 'tok', (opener, v) => log.notes.push(v), () => o.engine, { createElement: (t) => new N(t) });
  return Object.assign(api, { log });
}
const face = (c) => ({
  line: c.find('tt-ver-line').textContent,
  note: (c.find('tt-ver-note') || { textContent: '' }).textContent,
  tone: c.find('tt-ver-state').getAttribute('data-tone'),
  check: c.find('tt-ver-check').style.display !== 'none',
  checkBusy: c.find('tt-ver-check').getAttribute('aria-disabled') === 'true',
  go: c.find('tt-ver-go').style.display !== 'none',
});

console.log('\nEvery version reads as text and opens its newest release');
{
  const pins = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'glimstone.json'), 'utf8')).targets.map((t) => t.version);
  ok('GlimStone is 4.9.2, and both pins name it', /var GLS_VER = "4\.9\.2";/.test(settings) && pins.join() === '4.9.2,4.9.2', pins.join());
  const { verNumber, verCmp } = load('en');
  const ui = verNumber('1.2.3', 'https://github.com/junkerderprovinz/towertorch');
  ok('a release number is a link and shows without a v', ui.tag === 'a' && ui.textContent === '1.2.3' && verNumber('v0.9.0', 'R').textContent === '0.9.0');
  ok('to the project\'s newest release', ui.href === 'https://github.com/junkerderprovinz/towertorch/releases/latest' && ui.target === '_blank' && ui.rel === 'noopener noreferrer');
  ok('it is no button', !ui.cls.has('tt-btn') && ui.cls.has('tt-ver-num'));
  const dev = verNumber('dev', 'R');
  ok('a dev build has no link and says it is no release', dev.tag === 'span' && dev.textContent === 'dev, not a released build');
  ok('nor has a release candidate', verNumber('1.0.0-rc1', 'R').tag === 'span');
  ok('in German too', load('de').verNumber('dev', 'R').textContent === 'dev, kein veröffentlichter Stand');
  ok('the number is plain text in its colour, the accent under the pointer', /#tt-settings a\.tt-ver-num, #tt-settings a\.tt-ver-num:link, #tt-settings a\.tt-ver-num:visited \{ color: inherit; text-decoration: none; \}/.test(css)
    && /@media \(hover: hover\) \{ #tt-settings a\.tt-ver-num:hover \{ color: var\(--tt-accent-ink\); \} \}/.test(css));
  ok('a number is a 24px target that keeps the line\'s height', /#tt-settings a\.tt-ver-num \{ padding-block: 2px; margin-block: -2px; \}/.test(css));
  ok('a long number in the head drops under the name and may break', /#tt-settings \.tt-ver-head \.tt-ver-num \{ flex-shrink: 1; min-width: 0; margin-left: auto; overflow-wrap: anywhere; \}/.test(css)
    && /#tt-settings \.tt-ver-head \{ display: flex; flex-wrap: wrap;/.test(css));
  ok('a newer patch is newer', verCmp('1.0.1', '1.0.0') > 0);
  ok('the minor outranks the patch', verCmp('1.1.0', '1.0.9') > 0 && verCmp('1.0.9', '1.1.0') < 0);
  ok('the same version is not newer', verCmp('v1.2.0', '1.2.0') === 0);
  ok('any release is newer than a dev build', verCmp('0.9.0', 'dev') > 0);
  ok('an older release is not newer than a release candidate', verCmp('0.9.0', '1.0.0-rc1') < 0);
  ok('the release is newer than its own candidate', verCmp('1.0.0', '1.0.0-rc1') > 0 && verCmp('1.0.0-rc1', '1.0.0') < 0);
  ok('a later candidate is newer than an earlier one', verCmp('1.0.0-rc2', '1.0.0-rc1') > 0 && verCmp('1.0.0-rc.10', '1.0.0-rc.9') > 0);
  ok('build metadata does not count', verCmp('1.0.0+abc', '1.0.0') === 0);
}

(async () => {
  console.log('\nThe Version card shows where the updates stand, as Unraid sees them');
  const now = Math.round(Date.now() / 1000);
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now - 180 } }] });
    const c = t.versionCard();
    ok('the card is called Version and its (i) names TowerTorch', c.find('tt-set-h').textContent === 'Version' && /^The version of TowerTorch, /.test(c.find('tt-info').getAttribute('data-tip')));
    ok('the head holds the name and the number', c.find('tt-ver-app').textContent === 'TowerTorch' && c.find('tt-ver-head').kids[1].textContent === '1.5.3');
    ok('while Unraid is asked, the card says so and the check waits', face(c).line === 'Checking …' && face(c).checkBusy);
    await tick(); await tick();
    const f = face(c);
    ok('current: "Up to date" in the ok tone, with when Unraid last looked', f.line === 'Up to date' && f.tone === 'ok' && f.note === 'Last checked 3 minutes ago', JSON.stringify(f));
    ok('the check is there, and no Plugins tab button', f.check && !f.checkBusy && !f.go);
    ok('it asked Unraid, not GitHub', t.log.fetched.length === 1 && t.log.fetched[0].url === '/plugins/towertorch/server/update.php' && t.log.fetched[0].method === 'GET');
    const acts = c.find('tt-ver-actions').kids.map((k) => [...k.cls].find((x) => /^tt-ver-(news|check|go)$/.test(x)));
    ok('the buttons run What\'s new, Check for updates, then the one action', acts.join() === 'tt-ver-news,tt-ver-check,tt-ver-go', acts.join());
    const news = c.find('tt-ver-news');
    ok('What\'s new wears the dot before its glyph and its word', news.kids[0].cls.has('tt-ver-dot') && /What's new$/.test(news.textContent));
    news.click();
    ok('and opens the running version\'s notes', t.log.notes.length === 1 && t.log.notes[0] === '');
  }
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: '1.6.0', checkedAt: now - 60 } }] });
    const c = t.versionCard(); await tick(); await tick();
    const f = face(c);
    ok('available: "Update to 1.6.0 available" in the warn tone', f.line === 'Update to 1.6.0 available' && f.tone === 'warn', JSON.stringify(f));
    ok('the check goes, since there is nothing left to look for', !f.check);
    const go = c.find('tt-ver-go');
    ok('"Update in the Plugins tab" leads to the Plugins tab', f.go && go.href === '/Plugins' && go.textContent === 'Update in the Plugins tab');
    ok('the new number carries no link', !c.find('tt-ver-state').all().some((n) => n.tag === 'a'));
    c.find('tt-ver-news').click();
    ok('What\'s new opens that version\'s notes', t.log.notes[0] === '1.6.0');
    ok('the action is filled with the accent', /#tt-settings a\.tt-btn\.tt-ver-go, #tt-settings a\.tt-btn\.tt-ver-go:link, #tt-settings a\.tt-btn\.tt-ver-go:visited \{ background: var\(--tt-accent\); color: var\(--tt-accent-text\); \}/.test(css));
  }
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: null, checkedAt: null } }, { body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now } }] });
    const c = t.versionCard(); await tick(); await tick(); await tick(); await tick();
    ok('Unraid has not looked since it booted: the first visit looks once', t.log.fetched.length === 2 && t.log.fetched[1].method === 'POST');
    ok('with the csrf token emhttp asks for', t.log.fetched[1].body === 'csrf_token=tok');
    ok('and then shows what it found', face(c).line === 'Up to date' && face(c).note === 'Last checked now', JSON.stringify(face(c)));
  }
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: null, checkedAt: null } }, { body: { installed: '1.5.3', latest: null, checkedAt: null } }] });
    const c = t.versionCard(); await tick(); await tick(); await tick(); await tick();
    const f = face(c);
    ok('a check that left nothing to compare: "Not checked yet" in the neutral tone', f.line === 'Not checked yet' && f.tone === 'neutral' && !f.note, JSON.stringify(f));
    ok('with the check to look again, and no Plugins tab button', f.check && !f.checkBusy && !f.go);
    ok('and only one look of its own', t.log.fetched.length === 2);
  }
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: null } }] });
    const c = t.versionCard(); await tick(); await tick();
    ok('"Up to date" needs a check behind it', face(c).line === 'Not checked yet' && face(c).tone === 'neutral', JSON.stringify(face(c)));
  }
  {
    const t = load('en', { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now } }, { status: 502, body: { error: 'Network failure' } }] });
    const c = t.versionCard(); await tick(); await tick();
    c.find('tt-ver-check').click(); await tick(); await tick();
    const f = face(c);
    ok('a press on the check asks Unraid to look again', t.log.fetched.length === 2 && t.log.fetched[1].method === 'POST');
    ok('failed: "Check failed" in the fail tone with Unraid\'s reason after it', f.line === 'Check failed' && f.tone === 'fail' && f.note === 'Network failure', JSON.stringify(f));
    ok('and the check stays to try again', f.check && !f.checkBusy && !f.go);
  }
  {
    const t = load('en', { answers: [new Error('offline')] });
    const c = t.versionCard(); await tick(); await tick();
    ok('a network error is a failure too', face(c).line === 'Check failed' && face(c).note === 'offline');
  }
  {
    const t = load('de', { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now - 180 } }] });
    const c = t.versionCard(); await tick(); await tick();
    ok('German: "Aktuell" and "Zuletzt geprüft vor 3 Minuten"', face(c).line === 'Aktuell' && face(c).note === 'Zuletzt geprüft vor 3 Minuten', JSON.stringify(face(c)));
    ok('and the buttons in German', /Neuigkeiten$/.test(c.find('tt-ver-news').textContent) && c.find('tt-ver-check').textContent === 'Nach Updates suchen' && c.find('tt-ver-go').textContent === 'Im Plugins-Tab aktualisieren');
    const t2 = load('de', { answers: [{ body: { installed: '1.5.3', latest: '1.6.0', checkedAt: now } }] });
    const c2 = t2.versionCard(); await tick(); await tick();
    ok('"Update auf 1.6.0 verfügbar"', face(c2).line === 'Update auf 1.6.0 verfügbar');
    const t3 = load('de', { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: null } }] });
    const c3 = t3.versionCard(); await tick(); await tick();
    ok('"Noch nicht geprüft"', face(c3).line === 'Noch nicht geprüft', JSON.stringify(face(c3)));
  }
  ok('a plugin has no update switch', !/autoUpdate|Automatisch aktualisieren|Update automatically/.test(settings));

  console.log('\nUnraid answers through update.php');
  ok('a GET reads, a POST checks, nothing else passes', /if \(\$method !== 'GET' && \$method !== 'POST'\)/.test(update) && /http_response_code\(405\)/.test(update));
  ok('the check is Unraid\'s own, for this plugin only', /\$tool = '\/usr\/local\/emhttp\/plugins\/dynamix\.plugin\.manager\/scripts\/plugin';/.test(update) && /' check ' \. escapeshellarg\(\$plg\)/.test(update) && /\$plg = 'towertorch\.plg';/.test(update));
  ok('it reads the installed file and the one the check left', /"\/var\/log\/plugins\/\$plg"/.test(update) && /\$latest = "\/tmp\/plugins\/\$plg";/.test(update) && /filemtime\(\$latest\)/.test(update));
  ok('every argument to the shell is escaped', !/exec\([^)]*\$[a-z]+ \./.test(update.replace(/escapeshellarg\(\$\w+\)/g, '')));

  console.log('\nThe Components card holds every other version');
  {
    const t = load('en');
    const c = t.componentsCard(); await tick();
    const rows = c.all().filter((n) => n.cls.has('tt-ver-row'));
    const names = rows.map((r) => r.find('tt-ver-part').textContent);
    ok('Engine first, GlimStone last', names.join() === 'Engine,GlimStone', names.join());
    ok('each with what it is in its (i), never under its name', rows.every((r) => r.find('tt-info') && r.find('tt-info').getAttribute('data-tip')) && !c.all().some((n) => n.cls.has('tt-ver-sub')));
    const num = (r) => r.find('tt-ver-tail').find('tt-ver-num');
    ok('the engine shows the version that runs, opening the newest release', num(rows[0]).textContent === '1.5.3' && num(rows[0]).href === 'https://github.com/junkerderprovinz/towertorch/releases/latest');
    ok('GlimStone shows 4.9.2 and opens its newest release', num(rows[1]).textContent === '4.9.2' && num(rows[1]).href === 'https://github.com/junkerderprovinz/glimstone/releases/latest');
    ok('a row ends in one part that holds its status, button and number', rows.every((r) => r.kids.length === 2 && r.kids[1].cls.has('tt-ver-end') && r.kids[1].find('tt-ver-tail')));
    ok('GlimStone\'s (i) calls it the design system', rows[1].find('tt-info').getAttribute('data-tip') === 'Design system');
    ok('the card is called Components', /card\(W\.components, fill\(W\.componentsHint, \{ app: "TowerTorch" \}\)\)/.test(settings));
    ok('and has no switch, since every part ships with the plugin', !/components\.update|Update components/.test(settings));
  }
  {
    const t = load('en', { engine: Promise.reject(new Error('down')) });
    const c = t.componentsCard(); await tick(); await tick();
    const st = c.find('tt-ver-status');
    ok('an unreachable engine says so in place, in the fail tone', st && st.textContent === 'not reachable' && st.getAttribute('data-tone') === 'fail');
    ok('the status stands in the row\'s end before its tail, and no number waits there', st.parent.cls.has('tt-ver-end') && st.parent.kids[1].cls.has('tt-ver-tail') && !st.parent.find('tt-ver-num'));
    const t2 = load('de');
    const c2 = t2.componentsCard(); await tick();
    ok('German: Komponenten, Design-System', c2.find('tt-set-h').textContent === 'Komponenten' && c2.all().filter((n) => n.cls.has('tt-ver-row'))[1].find('tt-info').getAttribute('data-tip') === 'Design-System');
  }

  console.log('\nA component row breaks before its end on a narrow card');
  ok('the row wraps', /#tt-settings \.tt-ver-row \{ display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; \}/.test(css));
  ok('its end moves under the name whole, kept at the end', /#tt-settings \.tt-ver-end \{ display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 12px; margin-left: auto; \}/.test(css));
  ok('the button and the number keep one line', /#tt-settings \.tt-ver-tail \{ display: flex; align-items: center; gap: 12px; \}/.test(css));
  ok('a status never breaks, it takes a line of its own above them', /#tt-settings \.tt-ver-status \{ font-size: var\(--tt-text-meta\); white-space: nowrap; \}/.test(css));

  console.log('\nEach version appears once');
  ok('the footer line is gone', !/verLine|tt-set-version-foot/.test(settings) && !/\.tt-set-version\b/.test(css));
  ok('the gear menu shows no version', !/TT_VER|UI v|daemonVersion/.test(docker));
  ok('the gear menu reports the engine only while it is down', /if \(daemonUp === false\) m\.appendChild\(el\("div", "tt-menu-status tt-bad-text", t\("daemonDown"\)\)\);/.test(docker) && !/engine up/.test(docker));
  ok('the old rows and the verdict on the button are gone', !/function (versionRow|verLink|glimstoneLink|checkUpdates)\(/.test(settings) && !/tt-set-chk-|tt-set-verbad/.test(settings + css));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
