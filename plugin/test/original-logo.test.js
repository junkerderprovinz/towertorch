// A container, VM or plugin can be pinned to its original logo: the icon it ships with, never
// swapped for a curated or brand logo and never tinted, whatever the global icon colouring says.
// The settings page lists the pinned containers on the Docker tab, each one removable, with a
// picker to add another. What can quietly break it:
//   · the plan picking the curated colour icon, as "native" does
//   · one of the per-item pickers missing the choice
//   · the settings list showing a container that is not pinned, or offering one that is
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
};
global.document = {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  getElementById: () => null,
  documentElement: { style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {}, contains() { return false; } } },
  body: { appendChild() {} },
  cookie: ''
};
global.navigator = { language: 'en' };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout };
global.location = { pathname: '/Docker' };
global.fetch = () => new Promise(() => {});
global.Image = class { set src(v) { this.onerror && this.onerror(); } };
require(path.join(DIR, 'cc-theme.js'));
const CI = global.window.CCTheme.icons;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const docker = read('docker.js'), vms = read('vms.js'), theme = read('cc-theme.js'), settings = read('settings.js');

console.log('\nThe Docker tab keeps the shipped icon');
{
  const treat = new Function('window', grabFn(docker, 'iconTreatment') + '\nreturn iconTreatment;')(global.window);
  const own = '/state/plugins/dynamix.docker.manager/images/plex-icon.png';
  CI.setOverride('docker', 'Plex', 'native');
  const was = CI.result;
  CI.result = () => ({ kind: 'color', source: 'dashboard-icons', slug: 'plex' });
  ok('native swaps in a curated colour logo', treat('docker', 'Plex', false, own).url !== '');
  CI.setOverride('docker', 'Plex', 'original');
  const p = treat('docker', 'Plex', false, own);
  ok('original keeps the container\'s own icon and leaves its pixels alone', p.url === '' && p.treat === 'native', JSON.stringify(p));
  CI.result = () => ({ kind: 'glyph', source: 'simple-icons', slug: 'plex' });
  ok('a brand glyph does not replace it either', treat('docker', 'Plex', false, own).url === '');
  CI.result = was;
  CI.setOverride('docker', 'Plex', '');
}

console.log('\nEvery per-item picker offers it');
{
  ok('the Startplan window', /\["original", t\("iconOriginal"\)\]/.test(grabFn(docker, 'iconModeSelect')) && /iconOriginal: "Original-Logo"/.test(docker) && /iconOriginal: "Original logo"/.test(docker));
  ok('with its own line in the bubble', /\["Original-Logo", "/.test(grabFn(docker, 'iconModeItems')) && /\["Original logo", "/.test(grabFn(docker, 'iconModeItems')));
  ok('the VM editor', /\["original", "Original-Logo"\]/.test(vms) && /\["original", "Original logo"\]/.test(vms));
  ok('the Plugins popover', /\["original", "Original-Logo"\]/.test(grabFn(theme, 'iconPopover')) && /\["original", "Original logo"\]/.test(grabFn(theme, 'iconPopover')));
  ok('and the global setting does not, it is a choice for one item', !/\["original"/.test(settings.slice(settings.indexOf('Icon-Färbung", "Icon colouring"'), settings.indexOf('Icon-Färbung", "Icon colouring"') + 400)));
}

class N {
  constructor(tag, cls, txt) { this.tag = tag; this.className = cls || ''; this.textContent = txt == null ? '' : txt; this.children = []; this.parentNode = null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; }
  all() { return this.children.reduce((a, c) => a.concat([c], c.all()), []); }
  querySelectorAll(sel) { const want = sel.slice(1); return this.all().filter(n => n.className.split(' ').includes(want)); }
  text() { return this.textContent + this.children.map(c => c.text()).join(''); }
}
const el = (tag, cls, txt) => new N(tag, cls, txt);
// paintOriginals with its helpers, built from the settings page's own source, so the test runs
// the shipped code against a stub DOM and stub Docker rows.
function settingsList(cOrig, names, picks, removes, onRepaint, rowIcons) {
  const areaPicker = (label, items, onPick) => { const n = el('span', 'cc-dsel', label); n.items = items; n.pick = (i) => onPick(items[i]); picks.push(n); return n; };
  const actionBtn = (text, cls, run) => { const n = el('span', cls, text); n.run = run; removes.push(n); return n; };
  return new Function('cOrig', 'el', 'infoIcon', 'actionBtn', 'areaPicker', 'T', 'window', 'tintPrev', 'names', 'rowIcons',
    'var origNames = names, origMissing = {}, origChecked = false;\n' + grabFn(settings, 'labelled') + '\n' + grabFn(settings, 'checkOriginals') + '\n' + grabFn(settings, 'paintOriginals') + '\nreturn paintOriginals;')(
    // The stub nodes have no classList, so the buttons keep their words without the glyph.
    cOrig, el, () => el('span', 'cc-info'), actionBtn, areaPicker, (de, en) => en, Object.assign({}, global.window, { CCTheme: Object.assign({}, global.window.CCTheme, { labelled: null }) }), onRepaint, names, rowIcons);
}

console.log('\nThe settings page lists the pinned containers');
{
  const cOrig = el('div', 'cc-set-card');
  const picks = [], removes = [];
  let repaints = 0;
  const paint = settingsList(cOrig, ['Plex', 'Sonarr', 'Nextcloud'], picks, removes, () => { repaints++; }, () => new Promise(() => {}));
  CI.setOverride('docker', 'Sonarr', 'original');
  CI.setOverride('docker', 'Plex', 'flat');
  CI.setOverride('vm', 'Plex', 'original');
  paint();
  const rows = cOrig.querySelectorAll('.cc-set-origrow');
  ok('one row per container on its original logo, shown by its real name', rows.length === 1 && rows[0].text().includes('Sonarr'), rows.map(r => r.text()).join('|'));
  const picker = picks[picks.length - 1];
  ok('the picker offers every container not yet on it', JSON.stringify(picker.items.map(i => i[2])) === JSON.stringify(['Plex', 'Nextcloud']));
  picker.pick(1);
  ok('a pick pins the container', CI.mode('docker', 'Nextcloud') === 'original' && cOrig.querySelectorAll('.cc-set-origrow').length === 2 && repaints === 1);
  ok('and leaves the other pins alone', CI.mode('docker', 'Plex') === 'flat' && CI.mode('vm', 'Plex') === 'original');
  removes[removes.length - 1].run();
  ok('Remove sends the container back to the global setting', CI.override('docker', 'Sonarr') === '' && cOrig.querySelectorAll('.cc-set-origrow').length === 1 && repaints === 2);
  ok('the rows are rebuilt, not stacked', cOrig.querySelectorAll('.cc-set-origadd').length === 1);
  ok('the remove button is a plain secondary button, never red', removes.every(b => b.className === 'cc-btn'));
}

(async () => {
  console.log('\nA pinned container without a logo of its own says so');
  const cOrig = el('div', 'cc-set-card');
  let asked = 0;
  const paint = settingsList(cOrig, ['Plex', 'Cloudflared'], [], [], () => {}, (kind) => {
    asked++;
    return Promise.resolve(kind !== 'docker' ? [] : [
      { name: 'Plex', src: '/state/plugins/dynamix.docker.manager/images/Plex-icon.png?1792110340' },
      { name: 'Cloudflared', src: '/plugins/dynamix.docker.manager/images/question.png?' }
    ]);
  });
  CI.setOverride('docker', 'Plex', 'original');
  CI.setOverride('docker', 'Cloudflared', 'original');
  paint();
  await new Promise(r => setTimeout(r, 0));
  const row = (n) => cOrig.querySelectorAll('.cc-set-origrow').filter(r => r.text().includes(n))[0];
  ok('a container showing Unraid\'s stand-in carries the hint', row('Cloudflared') && row('Cloudflared').querySelectorAll('.cc-set-colstate').length === 1);
  ok('one showing its own icon does not', row('Plex') && row('Plex').querySelectorAll('.cc-set-colstate').length === 0);
  paint();
  ok('the Docker rows are read once, not per repaint', asked === 1, String(asked));
  CI.setOverride('docker', 'Plex', '');
  CI.setOverride('docker', 'Cloudflared', '');

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
