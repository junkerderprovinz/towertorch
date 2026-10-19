// Unraid's "Reset sorting" icon on the Docker and VM lists becomes a CC badge (sortreset.js,
// loaded on every page from TowerTorch.Tokens.page). What can quietly break it:
//   · the badge showing on a list in Unraid's own order, or missing on one the user arranged
//   · a click that does nothing because Unraid's lock is closed, or that leaves the lock open
//   · Unraid's icon vanishing with theming off, or standing next to the badge with it on
//   · a size or colour of its own instead of the icon badge token and the accent
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

const js = read('scripts/sortreset.js'), theme = read('scripts/cc-theme.js'), tokens = read('sheets/TowerTorch.Tokens.css'), page = read('TowerTorch.Tokens.page');
const LISTS = /var LISTS = \{[^\n]+\};/.exec(js)[0];

console.log('\nAn arranged list is told from Unraid\'s name order');
{
  const { natcase, arranged } = new Function(grabFn(js, 'natcase') + grabFn(js, 'arranged') + 'return { natcase, arranged };')();
  ok('names in order are not arranged', !arranged(['7DaysToDie', 'ARKSurvivalEvolved', 'BombVault', 'CCWB', 'ClamAV']));
  ok('one container dragged up is', arranged(['StrawDroid', 'BombVault', 'CCWB']));
  ok('case does not count, as in natcasesort', !arranged(['Enshrouded', 'homarr', 'Immich']) && arranged(['homarr', 'Enshrouded']));
  ok('numbers count as numbers', !arranged(['Storj-2', 'Storj-10']) && natcase('Storj-10', 'Storj-2') > 0);
  ok('a hyphen sorts before letters, as PHP compares bytes', !arranged(['Cloudflare-DDNS', 'Cloudflared']));
  ok('a prefix comes first', !arranged(['Palworld-I', 'Palworld-II']) && arranged(['Palworld-II', 'Palworld-I']));
  ok('a list of one or none is never arranged', !arranged(['Plex']) && !arranged([]));
}

console.log('\nThe click runs Unraid\'s reset, through the lock if it is closed');
{
  function run(cookie, withFn) {
    const jar = { lockbutton: cookie }, seen = [];
    const $ = { cookie(k, v) { if (v === undefined) return jar[k] == null ? null : jar[k]; jar[k] = v; }, removeCookie(k) { delete jar[k]; } };
    const win = { jQuery: $ };
    if (withFn) win.resetSorting = () => seen.push(jar.lockbutton || null);
    new Function('window', grabFn(js, 'reset') + 'reset();')(win);
    return { seen, after: jar.lockbutton == null ? null : jar.lockbutton };
  }
  const locked = run(undefined, true);
  ok('locked: resetSorting runs with the lock open, so it acts', locked.seen.length === 1 && locked.seen[0] === 'lockbutton');
  ok('and the lock closes again afterwards', locked.after === null);
  const open = run('lockbutton', true);
  ok('unlocked: it runs and the lock stays open', open.seen.length === 1 && open.after === 'lockbutton');
  ok('a page without resetSorting is left alone', run(undefined, false).after === null);
  ok('the lock closes even when the reset throws', /try \{ window\.resetSorting\(\); \} finally \{ if \(locked\) \$\.removeCookie\("lockbutton"\); \}/.test(js));
}

// The list head and body with just enough DOM for update().
function makeNode(tag, props) {
  const n = Object.assign({ tagName: tag.toUpperCase(), id: '', children: [], parentNode: null, hidden: false, attrs: {}, listeners: {}, innerHTML: '', textContent: '' }, props || {});
  const cls = new Set();
  n.classList = { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) };
  Object.defineProperty(n, 'className', { get: () => [...cls].join(' '), set: (v) => { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); } });
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.addEventListener = (t, fn) => { n.listeners[t] = fn; };
  n.append = (c) => { c.parentNode = n; n.children.push(c); return c; };
  n.insertBefore = (c, ref) => { c.parentNode = n; n.children.splice(n.children.indexOf(ref), 0, c); return c; };
  n.removeChild = (c) => { n.children.splice(n.children.indexOf(c), 1); c.parentNode = null; };
  Object.defineProperty(n, 'previousElementSibling', { get: () => { const p = n.parentNode; if (!p) return null; const i = p.children.indexOf(n); return i > 0 ? p.children[i - 1] : null; } });
  n.closest = (sel) => { for (let c = n; c; c = c.parentNode) if (c.tagName === sel.toUpperCase()) return c; return null; };
  return n;
}
function listPage(kind, names) {
  const table = makeNode('table'), th = table.append(makeNode('th')), native = th.append(makeNode('a', { id: 'resetsort' }));
  const tb = table.append(makeNode('tbody', { id: kind }));
  for (const name of names) {
    const tr = tb.append(makeNode('tr')); tr.classList.add('sortable');
    const label = makeNode('span', { textContent: '  ' + name + ' ' });
    tr.querySelector = (sel) => (sel === (kind === 'docker_list' ? 'td.ct-name .appname' : 'td.vm-name a') ? label : null);
  }
  tb.querySelectorAll = (sel) => (sel === ':scope > tr.sortable' ? tb.children.filter((r) => r.classList.contains('sortable')) : []);
  table.querySelector = (sel) => (sel === 'tbody#docker_list, tbody#kvm_list' ? tb : null);
  return { th, native, tb };
}
function load(lang, store, pg) {
  const doc = { documentElement: { lang }, getElementById: (id) => (id === 'resetsort' ? pg.native : null), createElement: (t) => makeNode(t) };
  const win = { CCTheme: { glyph: (n) => '<svg class="cc-glyph" data-name="' + n + '"></svg>' } };
  const src = [grabFn(js, 'g'), 'var LANG = "' + lang + '";', grabFn(js, 'T'), LISTS, grabFn(js, 'names'), grabFn(js, 'natcase'), grabFn(js, 'arranged'), grabFn(js, 'reset'), grabFn(js, 'badge'), grabFn(js, 'body'), grabFn(js, 'update'), 'return update;'].join('\n');
  return new Function('window', 'document', 'localStorage', 'navigator', src)(win, doc, { getItem: (k) => (k in store ? store[k] : null) }, {});
}
const badgeOf = (pg) => pg.th.children.find((c) => c.classList.contains('cc-sortreset'));

console.log('\nThe badge stands in for Unraid\'s icon and shows only while there is an order to drop');
{
  const docker = listPage('docker_list', ['StrawDroid', 'BombVault', 'CCWB']);
  load('de', {}, docker)();
  const b = badgeOf(docker);
  ok('an arranged Docker list shows the badge before the head\'s text', b && !b.hidden && docker.th.children.indexOf(b) === docker.th.children.indexOf(docker.native) - 1);
  ok('it wears GlimStone\'s Sort glyph', b && /data-name="Sort"/.test(b.innerHTML));
  ok('its bubble and name say what it does, in German', b && b.getAttribute('data-tip') === 'Sortierung zurücksetzen' && b.getAttribute('aria-label') === 'Sortierung zurücksetzen');
  ok('it is a button the keyboard reaches', b && b.getAttribute('role') === 'button' && b.getAttribute('tabindex') === '0' && !!b.listeners.click && !!b.listeners.keydown);
  ok('Unraid\'s icon is marked to step aside', docker.native.classList.contains('cc-sortreset-native'));
  const vms = listPage('kvm_list', ['CasaOS-Test', 'Linux', 'Windows 11']);
  const up = load('en', {}, vms);
  up();
  ok('a VM list in name order keeps the head quiet', badgeOf(vms) && badgeOf(vms).hidden === true);
  ok('in English it says Reset sorting', badgeOf(vms).getAttribute('data-tip') === 'Reset sorting');
  vms.tb.children.unshift(vms.tb.children.pop());
  up();
  ok('once a row is moved the badge appears, and only one', !badgeOf(vms).hidden && vms.th.children.filter((c) => c.classList.contains('cc-sortreset')).length === 1);
  load('de', { 'cc.theming': '0' }, vms)();
  ok('theming off takes the badge away and gives Unraid its icon back', !badgeOf(vms) && !vms.native.classList.contains('cc-sortreset-native'));
}

console.log('\nWhere it loads and how it looks');
{
  ok('Tokens.page loads sortreset.js deferred, after cc-theme.js', /scripts\/cc-theme\.js'\)\?>"><\/script>\n<script defer src="<\?autov\('\/plugins\/towertorch\/scripts\/sortreset\.js'\)\?>"><\/script>/.test(page));
  ok('it watches the list body, where Unraid refills and drags', /new MutationObserver\(soon\)\.observe\(tb, \{ childList: true \}\);/.test(js));
  ok('Sort is in the glyph set', /^    "Sort": \["0\.042 0 14 14", '<path fill-rule="evenodd" d="M3\.75002 0c/m.test(theme));
  const body = (sel) => { const i = tokens.indexOf(sel + ' {'); return i < 0 ? '' : tokens.slice(i, tokens.indexOf('}', i)); };
  ok('the badge is hidden unless theming is on', /^\.cc-sortreset \{ display: none; \}/m.test(tokens) && !!body('html.cc-popups-on .cc-sortreset:not([hidden])'));
  ok('Unraid\'s icon hides only where the script marked it, with theming on', /^html\.cc-popups-on a#resetsort\.cc-sortreset-native \{ display: none !important; \}/m.test(tokens) && !/#resetsort[^.\n]*\{[^}]*display: none/.test(tokens.replace(/a#resetsort\.cc-sortreset-native/g, '')));
  const rest = body('html.cc-popups-on .cc-sortreset:not([hidden])');
  ok('it has the size every icon badge has', /width: var\(--cc-icon-badge, 26px\); height: var\(--cc-icon-badge, 26px\);/.test(rest));
  ok('it rests on the neutral chip and takes the accent when pointed at', /background: var\(--cc-surface-3, #2e2e2e\)/.test(rest) && /background: var\(--cc-rbaccent, var\(--cc-accent, #FCC419\)\); color: var\(--cc-rbaccent-text/.test(body('html.cc-popups-on .cc-sortreset:hover')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
