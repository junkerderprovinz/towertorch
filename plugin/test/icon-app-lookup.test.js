// A container the Docker tab knows by its image is looked up as that app: the engine is asked
// for the app, the artwork comes from the app's entry, and a row on Unraid's placeholder shows
// the app's logo in place of the container glyph.
const path = require('path');
const THEME = process.argv[2] || path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts', 'tt-theme.js');

const node = () => ({ classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, getAttribute: () => null, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
global.document = Object.assign(node(), { createElement: node, getElementById: () => null, documentElement: node(), body: node(), cookie: '' });
global.navigator = { language: 'en' };
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { localStorage: global.localStorage, document: global.document, setTimeout, clearTimeout };
global.location = { pathname: '/Docker' };

const bodies = [];
global.fetch = (url, opts) => {
  const req = JSON.parse(decodeURIComponent(String(opts.body).split('data=')[1]));
  bodies.push(req);
  const out = {};
  req.names.forEach((n) => { out[n] = { kind: 'glyph', source: 'simple-icons', slug: (req.apps && req.apps[n]) || n }; });
  return Promise.resolve({ ok: true, json: () => Promise.resolve(out) });
};

require(THEME);
const CI = global.window.TTTheme.icons;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log('\nThe engine is asked for the app, keyed by the container');
CI.want(['Films', 'backup'], { Films: 'jellyfin' });
setTimeout(() => {
  const b = bodies[0] || {};
  ok('the batch carries the names', JSON.stringify(b.names) === '["films","backup"]', JSON.stringify(b));
  ok('and the app of each name that has one', b.apps && b.apps.films === 'jellyfin' && !('backup' in b.apps), JSON.stringify(b.apps));
  ok('the answer is kept under the container name', CI.result('Films') && CI.result('Films').slug === 'jellyfin');
  ok('the artwork is the app\'s', CI.svgUrl('Films').indexOf('name=jellyfin') > 0, CI.svgUrl('Films'));
  ok('a name without an app keeps its own artwork', CI.svgUrl('backup').indexOf('name=backup') > 0, CI.svgUrl('backup'));

  console.log('\nA name that learns its app later is asked for again');
  CI.want(['backup'], { backup: 'duplicati' });
  setTimeout(() => {
    const b2 = bodies[1] || {};
    ok('in a batch of its own', bodies.length === 2 && b2.apps && b2.apps.backup === 'duplicati', JSON.stringify(bodies));
    ok('then points at the app\'s artwork', CI.svgUrl('backup').indexOf('name=duplicati') > 0, CI.svgUrl('backup'));
    CI.want(['backup'], { backup: 'duplicati' });
    CI.want(['backup', 'Films']);
    setTimeout(() => {
      ok('and is not asked for again while nothing changed', bodies.length === 2, bodies.length + ' requests');
      ok('a caller that knows no apps keeps the ones learnt', CI.svgUrl('Films').indexOf('name=jellyfin') > 0, CI.svgUrl('Films'));

      console.log('\nA row on Unraid\'s placeholder');
      const Q = '/plugins/dynamix.docker.manager/images/question.png?1700089733';
      const logo = '/plugins/towertorch/container-app-marks/jellyfin.svg';
      ok('shows the logo it is given', CI.placeholder(Q, logo) === logo);
      ok('and the container glyph without one', /^data:image\/svg\+xml,/.test(CI.placeholder(Q, '')));
      ok('a real icon is left alone even with a logo at hand', CI.placeholder('/state/plugins/dynamix.docker.manager/images/Plex-icon.png', logo) === '');
      console.log(`\n${pass} passed, ${fail} failed`);
      process.exit(fail ? 1 : 0);
    }, 100);
  }, 100);
}, 100);
