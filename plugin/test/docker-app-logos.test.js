// A container without an icon of its own shows the logo of the app its image runs, and the icon
// pipeline treats that logo as the row's own picture: measured, coloured in the icon style, and
// swapped only for a glyph that will be inked.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const docker = fs.readFileSync(path.join(DIR, 'docker.js'), 'utf8');

const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
global.document = { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), getElementById: () => null, documentElement: { style: { setProperty() {}, removeProperty() {} }, classList: { toggle() {}, contains() { return false; } } }, body: { appendChild() {} }, cookie: '' };
global.navigator = { language: 'en' };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout };
global.location = { pathname: '/Docker' };
global.fetch = () => new Promise(() => {});
global.Image = class { set src(v) { this.onerror && this.onerror(); } };
require(path.join(DIR, 'tt-theme.js'));
global.window.TTContainerApps = require(path.join(DIR, 'container-apps.js'));
const CI = global.window.TTTheme.icons;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = docker.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = docker.indexOf('{', i); k < docker.length; k++) { if (docker[k] === '{') d++; else if (docker[k] === '}') { d--; if (!d) return docker.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const Q = '/plugins/dynamix.docker.manager/images/question.png?1700089733';
const LOGO = '/plugins/towertorch/container-app-marks/plex.dark.svg';
const treat = new Function('window', grabFn('iconTreatment') + '\nreturn iconTreatment;')(global.window);
const was = { result: CI.result, spread: CI.spread };

console.log('\nThe logo stands in for the placeholder');
{
  CI.spread = () => 40;
  CI.result = () => ({ kind: 'none' });
  let p = treat('docker', 'Media', false, Q, LOGO);
  ok('the row shows the logo', p.url === LOGO && p.stand === LOGO, JSON.stringify(p));
  ok('and colours it like a picture of its own', p.treat === 'tint', JSON.stringify(p));
  CI.result = () => ({ kind: 'color', source: 'dashboard-icons', slug: 'plex' });
  p = treat('docker', 'Media', false, Q, LOGO);
  ok('the curated colour artwork does not replace it, the logo is that artwork drawn for this page', p.url === LOGO, JSON.stringify(p));
  CI.result = () => ({ kind: 'glyph', source: 'simple-icons', slug: 'plex' });
  p = treat('docker', 'Media', false, Q, LOGO);
  ok('a glyph replaces it, flattened', p.glyph && p.treat === 'flat' && p.url.indexOf('path=iconsvg') > 0 && p.stand === LOGO, JSON.stringify(p));
  CI.result = () => ({ kind: 'none' });
  ok('without a logo the container glyph stays', /^data:image\/svg\+xml,/.test(treat('docker', 'Media', false, Q, '').url));
  const own = '/state/plugins/dynamix.docker.manager/images/plex-icon.png';
  ok('a row with an icon of its own keeps it', treat('docker', 'Media', false, own, LOGO).url === '');
  CI.result = () => ({ kind: 'color', source: 'dashboard-icons', slug: 'plex' });
  ok('and still takes the curated colour artwork the way it always did', treat('docker', 'Media', false, own, LOGO).url.indexOf('path=iconsvg') > 0);
  CI.result = was.result; CI.spread = was.spread;
}

console.log('\nA glyph nobody inks is no improvement');
{
  const loop = grabFn('applyIconTint');
  ok('a row falls back to its picture when the glyph gets no filter', /setIconSrc\(n, plan\.glyph && !want \? plan\.stand : plan\.url\)/.test(loop));
  ok('so does a card', /setIconSrc\(g\[j\], gp\.glyph && !gWant \? gp\.stand : gp\.url\)/.test(loop));
}

console.log('\nEach container is known by its image, then by its name');
{
  // Unraid's row carries only the image id, so the image comes from the engine's container list.
  const containerApps = new Function('window', 'localStorage', grabFn('imageLogosOn') + '\nvar appMemo = {};\n' + grabFn('containerApps') + '\nreturn containerApps;')(global.window, global.localStorage);
  const list = [{ name: 'Films', image: 'lscr.io/linuxserver/radarr:latest' }, { name: 'sonarr', image: 'someone/mystery:1' }, { name: 'tt-logo-test-mystery', image: 'someone/mystery:1' }, { name: 'gone' }];
  let apps = containerApps(list);
  ok('the image names the app', apps.Films === 'radarr', JSON.stringify(apps));
  ok('the name speaks when the image says nothing', apps.sonarr === 'sonarr', JSON.stringify(apps));
  ok('a container neither knows is left out', !('tt-logo-test-mystery' in apps) && !('gone' in apps), JSON.stringify(apps));
  store['tt.imagelogos'] = '0';
  apps = containerApps(list);
  ok('the switch turns it off', Object.keys(apps).length === 0, JSON.stringify(apps));
  delete store['tt.imagelogos'];
  ok('the Docker tab hands it the engine\'s list', /var apps = containerApps\(containers\);/.test(grabFn('applyIconTint')));
  const logo = new Function('window', grabFn('appLogo') + '\nreturn appLogo;')(global.window);
  ok('a dark page takes the logo drawn for it', logo('plex') === '/plugins/towertorch/container-app-marks/plex.dark.svg', logo('plex'));
  ok('no app, no logo', logo('') === '');
}

console.log('\nThe Docker tab loads the list before its script');
{
  const page = fs.readFileSync(path.join(DIR, '..', 'TowerTorch.Docker.page'), 'utf8');
  const a = page.indexOf('scripts/container-apps.js'), b = page.indexOf('scripts/docker.js');
  ok('container-apps.js comes first', a > 0 && a < b);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
