// Each switch under Settings, TowerTorch, Areas takes its area's look away as fully as the master
// switch does, and leaves every other area alone. What can quietly break it:
//   · a rule that styles every page's content (tab strips, title bars, table heads) on the master
//     class alone, so it reaches the pages of an area that is switched off
//   · the Shares area, which styles other pages' tab strips, painting a switched-off area's page
//   · docker.css's rules on Unraid's markup keyed to the master switch rather than to their page
//   · the Docker area switch stopping docker.js altogether, which takes the Docker functions with it
//   · the Settings area switch missing /Tools and /Settings sub-pages, which the header marks
const fs = require('fs');
const path = require('path');
const { candidates, withUnraid, DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const theme = read('scripts/tt-theme.js');
const pageAreaOn = (pathname, store) => new Function('location', 'g', /var PAGE_AREAS = \[[\s\S]*?\n  \];/.exec(theme)[0] + '\n' + grabFn(theme, 'pageAreaOn') + '\nreturn pageAreaOn();')(
  { pathname }, (k, d) => (k in store ? store[k] : d));

console.log('\nEvery page knows its area');
{
  const all = { 'tt.enable.docker': '1', 'tt.enable.plugins': '1', 'tt.enable.vms': '1', 'tt.enable.main': '1', 'tt.enable.shares': '1', 'tt.enable.settings': '1', 'tt.enable.favorites': '1', 'tt.enable.header': '1' };
  const pages = [['/Docker', 'docker'], ['/Docker/AddContainer', 'docker'], ['/Apps/UpdateContainer', 'docker'], ['/Plugins', 'plugins'], ['/VMs', 'vms'], ['/VMs/UpdateVM', 'vms'],
    ['/Main', 'main'], ['/Main/Device', 'main'], ['/Shares', 'shares'], ['/Shares/Share', 'shares'], ['/Stats', 'shares'], ['/Settings', 'settings'], ['/Tools/Syslog', 'settings'],
    ['/Users', 'settings'], ['/Favorites', 'favorites'], ['/Dashboard', 'header']];
  for (const [p, area] of pages) {
    const off = Object.assign({}, all, { ['tt.enable.' + area]: '0' });
    ok(p + ' follows the ' + area + ' switch', pageAreaOn(p, all) === true && pageAreaOn(p, off) === false);
  }
  ok('a page outside every area follows the master switch alone', pageAreaOn('/Apps', { 'tt.enable.docker': '0' }) === true && pageAreaOn('/Apps', { 'tt.theming': '0' }) === false);
  ok('with theming off no page is on', pageAreaOn('/Docker', Object.assign({ 'tt.theming': '0' }, all)) === false);
  ok('the switches keep their defaults: Main, Shares and the header start off', pageAreaOn('/Main', {}) === false && pageAreaOn('/Shares', {}) === false && pageAreaOn('/Dashboard', {}) === false && pageAreaOn('/Docker', {}) === true);
}

console.log('\nThe header marks the page from the first paint');
{
  const page = read('TowerTorch.Header.page');
  const js = /<script>\n\(function \(\) \{[\s\S]*?\}\)\(\);\n<\/script>/.exec(page)[0].replace(/^<script>|<\/script>$/g, '');
  const run = (pathname, store) => {
    const cls = new Set();
    const root = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, setAttribute() {}, removeAttribute() {} };
    const ls = { getItem: (k) => (k in store ? store[k] : null) };
    const TTTheme = { pageAreaOn: () => pageAreaOn(pathname, store) };
    new Function('document', 'localStorage', 'location', 'window', js)({ documentElement: root }, ls, { pathname }, { TTTheme });
    return cls;
  };
  const on = { 'tt.enable.docker': '1', 'tt.enable.plugins': '1' };
  ok('the Docker page gets tt-docker-on and tt-page-on', run('/Docker', on).has('tt-docker-on') && run('/Docker', on).has('tt-page-on'));
  ok('the container form too', run('/Apps/AddContainer', on).has('tt-docker-on'));
  ok('the Plugins page gets tt-on-plugins', run('/Plugins', on).has('tt-on-plugins') && !run('/Plugins', on).has('tt-docker-on'));
  const off = run('/Docker', { 'tt.enable.docker': '0' });
  ok('with the Docker area off neither class is set', !off.has('tt-docker-on') && !off.has('tt-page-on') && off.has('tt-popups-on'));
  ok('with the Plugins area off its page is native too', !run('/Plugins', { 'tt.enable.plugins': '0' }).has('tt-on-plugins'));
  const header = read('scripts/header.js');
  ok('header.js keeps all three live on a flip', /root\.classList\.toggle\("tt-page-on", /.test(header) && /root\.classList\.toggle\("tt-docker-on", /.test(header) && /root\.classList\.toggle\("tt-on-plugins", /.test(header));
  ok('the Settings area takes /Settings, /Tools and /Users with it', /var toolsArea = diskPg \|\| caSettingsPg \|\| g\("tt\.enable\.settings", "1"\) !== "0";/.test(header) && /toggle\("tt-tools-on", toolsPg && toolsArea && /.test(header));
  ok('the header icons go with the header area', /toggle\("tt-hideicon-" \+ k9, g\("tt\.hideicon\." \+ k9, "0"\) === "1" && on\)/.test(header));
  ok('page selects are wrapped only where the page\'s area is on', /if \(!document\.documentElement\.classList\.contains\("tt-page-on"\)\) return;/.test(grabFn(header, 'ttWrapPageSelects')));
  ok('the disk state colours wait for the page\'s area', /var on = g\("tt\.statenative", "0"\) === "1" && document\.documentElement\.classList\.contains\("tt-page-on"\);/.test(grabFn(header, 'ttStateBars')));
}

console.log('\nWith the Docker area off the Docker functions keep working');
{
  const docker = read('scripts/docker.js');
  ok('the look reads the Docker area with the master switch', /function themingOn\(\) \{ return localStorage\.getItem\("tt\.theming"\) !== "0" && localStorage\.getItem\("tt\.enable\.docker"\) !== "0"; \}/.test(docker));
  ok('docker.js boots whatever the area says', !/if \(localStorage\.getItem\("tt\.enable\.docker"\) === "0"\) return;/.test(docker));
  ok('a flip of the area repaints the open tab like a flip of the master switch', /if \(e\.key === "tt\.theming" \|\| e\.key === "tt\.enable\.docker"\) \{/.test(docker));
  const sort = read('scripts/sortreset.js');
  ok('the sort reset badge follows the Docker and VM areas, each on its own list', /var area = tb\.id === "kvm_list" \? g\("tt\.enable\.vms", "1"\) : g\("tt\.enable\.docker", "1"\);/.test(sort));
}

console.log('\nThe Shares area leaves other areas\' pages alone');
{
  const shares = read('scripts/shares.js');
  ok('tt-shares-on waits for the page\'s own area', /var on = g\("tt\.enable\.shares", "0"\) !== "0" && g\("tt\.theming", "1"\) !== "0" && !!\(window\.TTTheme && window\.TTTheme\.pageAreaOn && window\.TTTheme\.pageAreaOn\(\)\);/.test(shares));
  ok('its tab colours go with it', /var rb = rbOn\(\) && document\.documentElement\.classList\.contains\("tt-shares-on"\)/.test(grabFn(shares, 'paintTabs')));
}

console.log('\nEach area switched off leaves its page as Unraid draws it');
{
  // Popups, Unraid API panels and CA's windows carry their own rules, which the helper cannot rule out by itself.
  const away = ['.bg-popover', '.unapi', '.multi_installDiv', '#tt-plugbtns', '.sweet-alert', '.ui-dialog', '.swal-modal'];
  const reach = (page, el, prop) => candidates(page === 'docker' ? withUnraid('docker') : page, Object.assign({ outside: away }, el), prop).filter((c) => c.sheet !== 'unraid default-base.css');
  // The master class and the header area stay on; only the area under test and the page class go.
  const base = ['tt-popups-on', 'tt-header-on'];
  const cases = [
    ['Docker', 'docker', ['tt-docker-on', 'tt-page-on'], [
      ['the tab button', { tag: 'button', classes: [], attrs: { role: 'tab', 'aria-selected': 'true' }, inside: ['.tabs-container'] }, 'background'],
      ['the title bar', { tag: 'div', classes: ['title'], attrs: {} }, 'background'],
      ['a native button in the action bar', { tag: 'input', classes: [], attrs: { type: 'button' }, inside: ['.js-actions'] }, 'background'],
      ['the view toggle', { tag: 'div', classes: ['ToggleViewMode'], attrs: {} }, 'display'],
      ['a table head', { tag: 'th', classes: ['tablesorter-header'], attrs: {}, inside: ['.tablesorter'] }, 'text-transform'],
    ]],
    ['Plugins', 'docker', ['tt-on-plugins', 'tt-page-on'], [
      ['a plugin icon', { tag: 'img', classes: ['list'], attrs: {}, inside: ['#plugin_list'] }, 'width'],
      ['the check-for-updates button', { tag: 'span', classes: ['status', 'vhshift'], id: 'checkall', attrs: {}, inside: ['.tabs-container'] }, 'margin-right'],
      ['the update-all button', { tag: 'input', classes: [], attrs: { type: 'button', value: 'Alle Plugins aktualisieren' }, inside: ['#displaybox'] }, 'height'],
    ]],
    ['VMs', 'every', ['tt-vms-on', 'tt-page-on'], [
      ['the VM table head', { tag: 'th', classes: [], attrs: {}, inside: ['#kvm_table'] }, 'text-transform'],
      ['the tab button', { tag: 'button', classes: [], attrs: { role: 'tab' }, inside: ['.tabs-container'] }, 'background'],
    ]],
    ['Main', 'every', ['tt-shares-on', 'tt-on-main', 'tt-page-on'], [
      ['the tab button', { tag: 'button', classes: [], attrs: { role: 'tab' }, inside: ['.tabs-container', '#displaybox'] }, 'background'],
      ['a disk orb', { tag: 'i', classes: ['fa', 'fa-circle', 'orb'], attrs: {}, inside: ['#displaybox'] }, 'border-radius'],
    ]],
    ['Settings', 'every', ['tt-tools-on', 'tt-page-on'], [
      ['a table cell on a Tools page', { tag: 'td', classes: [], attrs: {}, inside: ['#displaybox'] }, 'color'],
      ['the title bar', { tag: 'div', classes: ['title'], attrs: {} }, 'background'],
    ]],
  ];
  for (const [area, page, own, els] of cases) {
    for (const [name, el, prop] of els) {
      const offHits = reach(page, Object.assign({}, el, { html: base }), prop);
      ok(area + ' off: ' + name + ' keeps Unraid\'s ' + prop, offHits.length === 0, offHits.map((c) => c.sheet.split('/').pop() + ' ' + c.selector).slice(0, 2).join(' | '));
      ok(area + ' on: ' + name + ' takes TowerTorch\'s', reach(page, Object.assign({}, el, { html: base.concat(own) }), prop).length > 0);
    }
  }
  const menuLink = (h) => ({ tag: 'a', classes: [], attrs: {}, html: h, inside: ['#menu', '.nav-tile', '.nav-item'] });
  const off = reach('every', menuLink(['tt-popups-on', 'tt-page-on']), 'height');
  ok('Header off: the menu bar keeps Unraid\'s', off.length === 0, off.map((c) => c.selector).slice(0, 2).join(' | '));
  ok('Header on: it takes TowerTorch\'s', reach('every', menuLink(['tt-popups-on', 'tt-page-on', 'tt-header-on']), 'height').length > 0);
  const hdr = (h) => ({ tag: 'div', classes: [], id: 'menu', attrs: {}, html: h });
  ok('Header off: the menu keeps its native edge', reach('every', hdr(['tt-popups-on', 'tt-page-on']), 'padding-right').length === 0);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
