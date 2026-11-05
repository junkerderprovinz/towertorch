// A number field in a TowerTorch window wears GlimStone's two arrows inside its box, in every browser.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const theme = read('scripts/tt-theme.js'), docker = read('scripts/docker.js'), vms = read('scripts/vms.js');
const tokens = read('sheets/TowerTorch.Tokens.css'), dockerCss = read('styles/docker.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function grabFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return src.slice(at, i + 1);
}

console.log('\nEvery number field the plugin draws goes through the helper');
{
  const vars = (src) => [...src.matchAll(/(\w+)\.type = "number"/g)].map((m) => m[1]);
  ok('the Docker windows have their fields', vars(docker).length === 8, vars(docker).length);
  for (const v of vars(docker)) ok('docker.js places ' + v + ' through numField', v === 'port' ? /var portField = numField\(port\);/.test(docker) : new RegExp('appendChild\\(numField\\(' + v + '\\)\\)').test(docker));
  ok('the probe row shows and hides the port field with its arrows', /var k = probe\.value; portField\.style\.display =/.test(docker) && /prow\.appendChild\(portField\);/.test(docker));
  ok('the VM disk field too', vars(vms).length === 1 && /row\.appendChild\(numField\(inp\)\);/.test(vms));
}

console.log('\nThe browser\'s own spinner stays away');
{
  const rule = /html input\.tt-num-input\[type="number"\] \{([^}]*)\}/.exec(tokens);
  ok('the field asks for textfield, which is what Firefox reads', rule && /-webkit-appearance: textfield; appearance: textfield;/.test(rule[1]));
  ok('that outweighs the appearance: none of .tt-pop input', /^\.tt-pop button, \.tt-pop input, \.tt-pop select, \.tt-pop textarea \{\s*-webkit-appearance: none; appearance: none;/m.test(dockerCss));
  ok('Chrome\'s spin buttons go as well', /input\.tt-num-input\[type="number"\]::-webkit-inner-spin-button \{ -webkit-appearance: none;/.test(tokens));
}

console.log('\nThe arrows belong to the field');
{
  ok('the digits keep clear of them', /padding-inline-end: 28px !important;/.test(tokens));
  ok('hardenPop stamps the same room, or its inline padding would win', /i\.classList\.contains\("tt-num-input"\) \? "5px 28px 5px 8px"/.test(docker));
  ok('they have no ground of their own and only the ink changes on hover', /\.tt-num-step:hover \{ color: var\(--tt-text, #e6e6e6\); \}/.test(tokens) && !/\.tt-num-step[^{]*\{[^}]*background/.test(tokens));
  const num = grabFn(theme, 'numberField');
  ok('they stay out of the tab order and away from a screen reader', /stack\.setAttribute\("aria-hidden", "true"\)/.test(num) && !/tabindex/.test(num));
  ok('a press keeps the focus in the field', /addEventListener\("mousedown", function \(e\) \{ e\.preventDefault\(\); \}\)/.test(num));
  ok('a step fires the same events as typing', /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/.test(num) && /dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/.test(num));
  ok('the wheel steps only with focus and does not scroll the page', /document\.activeElement !== input/.test(num) && /e\.preventDefault\(\);\s*move\(/.test(num) && /\{ passive: false \}/.test(num));
  ok('the helper is on TTTheme', /numberField: numberField/.test(theme));
}

console.log('\nThe field keeps its place in a window row');
{
  ok('a short field hands its width to the wrapper', /input\.classList\.remove\("tt-port"\); wrap\.classList\.add\("tt-port"\);/.test(grabFn(theme, 'numberField')));
  ok('a wide field grows as .tt-in does', /\.tt-pop-row > \.tt-num-wrap:not\(\.tt-port\) \{ flex: 1 1 0%; \}/.test(dockerCss));
  ok('in the plan window it splits the row evenly with the dropdown', /\.tt-pop\.tt-pop-plan \.tt-pop-row \.tt-num-wrap \{ flex: 1 1 16px !important; \}/.test(dockerCss));
}

console.log('\nAn arrow greys out at its own end');
{
  const wouldStep = new Function(grabFn(theme, 'wouldStep') + '; return wouldStep;')();
  const f = (value, min = '', max = '', step = '') => ({ value, min, max, step });
  ok('up is free without a maximum', wouldStep(f('5'), 1) === true);
  ok('down stops at the minimum', wouldStep(f('0', '0'), -1) === false);
  ok('up stops at the maximum', wouldStep(f('100', '0', '100'), 1) === false);
  ok('an empty field counts from its minimum', wouldStep(f('', '0'), -1) === false && wouldStep(f('', '0'), 1) === true);
  ok('the step counts', wouldStep(f('0.2', '0', '', '0.5'), -1) === false && wouldStep(f('0.5', '0', '', '0.5'), -1) === true);
}

console.log(fail ? `\nFAILED  ${pass} passed, ${fail} failed` : `\nOK  ${pass} passed`);
process.exit(fail ? 1 : 0);
