// The icon logo badge carries the app's identity, not a rotating value, so a
// colour picked in the "Logos & Icons" card has to come before --tt-rb-c, the
// per-row rainbow colour JS stamps inline, in every var() chain that paints it.
// The rainbow colour stays as the fallback for rows with no icon colour set.
//
// This holds for the icon logo badge alone. Every other rainbow-coloured element,
// the CPU and RAM badges, tab pills and buttons, stays rainbow-first, which this
// file pins too so the two paths do not get conflated.
//
// Covered: Docker and Plugins in docker.css, and the Settings/Tools category grid
// in TowerTorch.SettingsGrid.css. Its plain rainbow paint has no CSS chain
// to fall back on, being a hard inline write, so paintGrid()'s body is checked
// from source instead. The helpers come from settings-chrome.test.js, this being
// a string-level pin for want of a CSS engine in the bare-Node runner.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const CSS = process.argv[2] || path.join(DIR, 'styles', 'docker.css');
const SG_CSS = path.join(DIR, 'sheets', 'TowerTorch.SettingsGrid.css');
const SG_JS = path.join(DIR, 'scripts', 'settingsgrid.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = fs.readFileSync(CSS, 'utf8');

// Taken from settings-chrome.test.js.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
function iconbgFirst(body) { return /background:\s*var\(--tt-iconbg-color,\s*var\(--tt-rb-c,/.test(body || ''); }

console.log('\nDocker icon logo badge: a configured icon colour wins over the rainbow palette');
{
  const listSel = '.tt-enh.tt-docker-iconbg.tt-rainbow #docker_list tr:is(.sortable, .folder-element) td.ct-name .outer > span.hand';
  const gridSel = '.tt-grid-holder.tt-docker-iconbg.tt-rainbow .tt-card-icobox';
  const listHoverSel = 'html.tt-shares-rbneutral.tt-docker-on .tt-enh.tt-docker-iconbg.tt-rainbow #docker_list tr:is(.sortable, .folder-element):hover td.ct-name .outer > span.hand';
  const gridHoverSel = 'html.tt-shares-rbneutral.tt-docker-on .tt-grid-holder.tt-docker-iconbg.tt-rainbow .tt-card:hover .tt-card-icobox';
  [
    ['list-mode tile (non-reactive rainbow)', listSel],
    ['grid-mode tile (non-reactive rainbow)', gridSel],
    ['list-mode tile (reactive hover)', listHoverSel],
    ['grid-mode tile (reactive hover)', gridHoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --tt-iconbg-color comes before --tt-rb-c', iconbgFirst(body), body);
  });
}

console.log('\nPlugins icon logo badge: a configured icon colour wins over the rainbow palette');
{
  const tileSel = 'html.tt-plugins-iconbg.tt-plugins-rainbow .tt-plugico';
  const hoverSel = 'html.tt-shares-rbneutral.tt-on-plugins #plugin_list tr:hover .tt-plugico';
  [
    ['tile (non-reactive rainbow)', tileSel],
    ['tile (reactive hover)', hoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --tt-iconbg-color comes before --tt-rb-c', iconbgFirst(body), body);
  });
}

console.log('\nSettingsGrid tile badge in CSS: a configured icon colour wins over the rainbow palette');
{
  // The reactive hover rules are where SettingsGrid resolves the badge colour
  // through a var() chain; the plain paint is an inline JS write, checked below.
  const sgCss = fs.readFileSync(SG_CSS, 'utf8');
  const localHoverSel = 'html.tt-settingsgrid-on.tt-settingsgrid-rbneutral #displaybox .Panel > a:hover > span';
  const globalHoverSel = 'html.tt-shares-rbneutral.tt-settingsgrid-on #displaybox .Panel > a:hover > span';
  const localHoverColorSel = 'html.tt-settingsgrid-on.tt-settingsgrid-rbneutral #displaybox .Panel > a:hover > span > i.PanelIcon,\nhtml.tt-settingsgrid-on.tt-settingsgrid-rbneutral #displaybox .Panel > a:hover > span';
  const globalHoverColorSel = 'html.tt-shares-rbneutral.tt-settingsgrid-on #displaybox .Panel > a:hover > span > i.PanelIcon,\nhtml.tt-shares-rbneutral.tt-settingsgrid-on #displaybox .Panel > a:hover > span';
  [
    ['local reactive hover (tt-settingsgrid-rbneutral)', localHoverSel, localHoverColorSel],
    ['global reactive hover (tt-shares-rbneutral)', globalHoverSel, globalHoverColorSel],
  ].forEach(([label, sel, colorSel]) => {
    const body = ruleBody(sgCss, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --tt-iconbg-color comes before --tt-rb-c', iconbgFirst(body), body);
    const colorBody = ruleBody(sgCss, colorSel);
    ok(label + ': paired glyph-ink rule exists', colorBody != null);
    ok(label + ': paired glyph-ink colour also puts --tt-iconbg-text first', /color:\s*var\(--tt-iconbg-text,\s*var\(--tt-rb-ct,/.test(colorBody || ''), colorBody);
  });
}

console.log('\nSettingsGrid tile badge in paintGrid(): the plain paint defers to a configured icon colour');
{
  // paintGrid() writes the background as an inline style, with no var() chain to
  // fall back on, so the write has to be conditional on an icon colour being set.
  const sgJs = fs.readFileSync(SG_JS, 'utf8');
  const m = /function paintGrid\(\) \{[\s\S]*?\n  \}\n/.exec(sgJs);
  ok('paintGrid() is found in source', !!m);
  const body = m ? m[0] : '';
  ok('it checks whether tts.iconcolor holds a colour', /tts\.iconcolor/.test(body), body);
  ok('the background write goes through bg rather than the raw rainbow colour', /setProperty\("background",\s*bg,\s*"important"\)/.test(body) && !/setProperty\("background",\s*c,\s*"important"\)/.test(body), body);
  ok('with an icon colour configured the badge paints with the resolved accBg', /bg\s*=\s*iconSet\s*\?\s*accBg\s*:\s*c/.test(body), body);
}

console.log('\nDocker icon logo badge on hover with no icon colour configured: --tt-rb-c stays in the chain');
{
  // These two rules apply whenever Hintergrund is on, whether or not an icon colour
  // is configured, so they are a different pair from the .tt-rainbow-gated ones
  // above. Falling from --tt-iconbg-color straight to the flat --tt-accent would
  // leave the badge with no colour source at all while the master adopt toggle is
  // on, since bgColor() answers "" then.
  const listNoColorHoverSel = 'html.tt-shares-rbneutral.tt-docker-on .tt-enh.tt-docker-iconbg #docker_list tr:is(.sortable, .folder-element):hover td.ct-name .outer > span.hand';
  const gridNoColorHoverSel = 'html.tt-shares-rbneutral.tt-docker-on .tt-grid-holder.tt-docker-iconbg .tt-card:hover .tt-card-icobox';
  [
    ['list-mode tile (reactive hover, no icon colour configured)', listNoColorHoverSel],
    ['grid-mode tile (reactive hover, no icon colour configured)', gridNoColorHoverSel],
  ].forEach(([label, sel]) => {
    const body = ruleBody(css, sel);
    ok(label + ' rule exists', body != null);
    ok(label + ': --tt-iconbg-color comes before --tt-rb-c, before the flat --tt-accent', iconbgFirst(body), body);
  });
}

console.log('\nBadges that are not icon logos stay rainbow-first');
{
  // The CPU and RAM value badges and the generic plugin row-badge hover path are
  // not icon logo tiles, so they keep --tt-rb-c as their first colour source.
  const cpuSel = '.tt-enh.tt-rainbow .tt-b-cpu, .tt-grid-holder.tt-rainbow .tt-b-cpu';
  const cpuBody = ruleBody(css, cpuSel);
  ok('CPU badge rule exists', cpuBody != null);
  ok('CPU badge: --tt-rb-c comes first', /background:\s*var\(--tt-rb-cpu,/.test(cpuBody || ''), cpuBody);

  const genericPluginHoverSel = 'html.tt-shares-rbneutral.tt-on-plugins #plugin_list tr:hover .tt-b,\nhtml.tt-shares-rbneutral.tt-on-plugins #plugin_list tr:hover .tt-b-del';
  const genBody = ruleBody(css, genericPluginHoverSel);
  ok('generic plugin value-badge hover rule exists, the delete badge among the badges', genBody != null);
  ok('generic plugin value badge: --tt-rb-c comes first', /background:\s*var\(--tt-rb-c,\s*var\(--tt-accent,/.test(genBody || ''), genBody);
  const delRest = ruleBody(css, 'html.tt-shares-rbneutral.tt-on-plugins #plugin_list .tt-b-del');
  ok('the delete badge rests neutral with its siblings in the reactive mode', /background:\s*rgba\(128, 128, 128, \.18\)/.test(delRest || ''), delRest);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
