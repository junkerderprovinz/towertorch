// The container add and edit form: one dropdown per select, labels at the start of their row and
// fields at its end, and labels without the spaces Unraid puts in front of an env var's name.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nA select on the container form gets one dropdown');
{
  // ccWrapPageSelects() on a page with one wrappable select, counting what it wraps.
  const sweep = (pathname) => {
    const wrapped = [];
    const sel = { options: [1, 2], closest: () => null, getBoundingClientRect: () => ({ width: 200, height: 30 }) };
    const document = { documentElement: { classList: { contains: (c) => c === 'cc-popups-on' } }, querySelectorAll: () => [sel] };
    new Function('document', 'location', 'ccToolsWrapSelect', grabFn(header, 'ccWrapPageSelects') + '\nccWrapPageSelects();')(document, { pathname }, (s) => wrapped.push(s));
    return wrapped.length;
  };
  ok('the header leaves the edit form\'s selects to docker.js', sweep('/Docker/UpdateContainer') === 0);
  ok('and the add form\'s, also when Community Applications opens it', sweep('/Apps/AddContainer') === 0 && sweep('/Docker/AddContainer') === 0);
  ok('every other page still gets its selects wrapped', sweep('/Dashboard') === 1 && sweep('/Docker') === 1);
}

console.log('\nA form label loses its colon and its leading spaces');
{
  const strip = (text) => {
    const nd = { nodeType: 3, textContent: text };
    const host = { childNodes: [nd], attrs: {}, getAttribute(k) { return this.attrs[k] || null; }, setAttribute(k, v) { this.attrs[k] = v; } };
    new Function('host', grabFn(docker, 'ctStripColon') + '\nctStripColon(host);')(host);
    return { text: nd.textContent, orig: host.attrs['data-cc-lab'] };
  };
  ok('an env var label starts at its first letter', strip('  WebUI Port (HTTP):').text === 'WebUI Port (HTTP)', JSON.stringify(strip('  WebUI Port (HTTP):')));
  ok('a plain label keeps its words', strip('Name:').text === 'Name');
  ok('the original stays for the teardown', strip('  Config:').orig === '  Config:');
}

console.log('\nLabels at the start, fields at the end, at a reading width');
{
  const rule = (sel) => { const i = css.indexOf(sel + ' {'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
  ok('the rows keep the settings cards\' width', /max-width:\s*920px/.test(rule('html.cc-docker-on.cc-on-addct #canvas form dl')));
  ok('and stand in the middle of the window', /margin-inline:\s*auto/.test(rule('html.cc-docker-on.cc-on-addct #canvas form dl')));
  ok('the title bar stands over them', /max-width:\s*920px;\s*margin-inline:\s*auto/.test(rule('html.cc-docker-on.cc-on-addct #canvas div.title')));
  const { candidates } = require('./cascade');
  const bar = { tag: 'div', classes: ['title'], attrs: {}, states: { 'first-child': true }, html: ['cc-docker-on', 'cc-on-addct'], inside: ['#displaybox', '.content'] };
  const top = candidates('docker', bar, 'margin-top').pop();
  ok('the title bar keeps the gap under the main menu that the Docker list keeps', !!top && top.value === '20px', top && top.selector);
  ok('a label stands at the start of its column', /justify-self:\s*start/.test(rule('html.cc-docker-on.cc-on-addct #canvas form dl > dt > span.cc-varlab')));
  ok('a text field runs to the row\'s end', /width:\s*100%/.test(rule('html.cc-docker-on.cc-on-addct #canvas form dl > dd > :is(input[type="text"], input[type="number"], input[type="password"], textarea)')));
  ok('a switch stands at the row\'s end', /justify-content:\s*flex-end/.test(rule('html.cc-docker-on.cc-on-addct #canvas form dl > dd > span.flex-row:has(> .switch-button-background)')));
}

console.log('\nOnly a colour variable gets a colour swatch');
{
  const isColour = new Function(grabFn(docker, 'ctIsColorVar') + '\nreturn ctIsColorVar;')();
  ok('an accent with a hex colour gets one', isColour('Accent (JD_ACCENT) Accent colour for the theme', '#ff8800'));
  ok('and an empty colour field', isColour('Accent Color A 6-digit hex colour for buttons', ''));
  ok('an unmasked key whose description says hex stays a text field', !isColour('App key 64 hexadecimal characters: run openssl rand -hex 32', '475078fab422db809d76123a276bb971'));
  ok('also while the key is still empty', !isColour('Encryption Key openssl rand -hex 32', ''));
  ok('a colour scheme that holds a theme name stays a text field', !isColour('Theme Color scheme, dark or light', 'dark'));

  // ctColorSwatch() hands each field to the shared swatch, which colour-picker-shared.test.js covers.
  const handed = [];
  const window = { CCTheme: { colorSwatch(inp, opts) { const sw = { attrs: {}, cls: [], classList: { add: (c) => sw.cls.push(c) }, setAttribute(k, v) { sw.attrs[k] = v; } }; handed.push([inp, opts]); return sw; } } };
  const swatch = new Function('window', 'MARK', grabFn(docker, 'ctColorSwatch') + '\nreturn ctColorSwatch;')(window, 'data-cc');
  const a = { value: '#111111' }, b = { value: '222222' }, c = { value: '' };
  swatch(a, { textContent: 'Accent colour:' }); swatch(b, null); swatch(c, null);
  ok('each field gets a swatch of its own, named after its row', handed[0][0] === a && handed[1][0] === b && handed[0][1].label === 'Accent colour');
  ok('a value keeps its form, with or without the #', handed[0][1].hash === true && handed[1][1].hash === false, JSON.stringify(handed.map((h) => h[1].hash)));
  ok('an empty field takes the #', handed[2][1].hash === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
