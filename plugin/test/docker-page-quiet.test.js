// The Docker tab keeps its normal case calm and names every thing once. The green "up to date"
// chip stays, an exception to GlimStone rule 33. What can quietly break it:
//   · the green "up to date" chip hidden
//   · a "ready" pill under it repeating what the start plan badge says
//   · the gear menu reporting a healthy engine in maintenance jargon
//   · Unraid's untranslated "3rd Party" standing beside its own "Drittanbieter"
//   · the page action sliding back to the start of the bar
//   · a toast covering the docked bar's buttons
//   · the rows at phone width cut off after the actions column
//   · a volume path cut mid-word without an ellipsis
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const js = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grab(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nUp to date shows as a green chip');
{
  ok('no rule hides it', !/span\.green-text \{ display: none/.test(css));
  ok('it takes the ok green while its column is on', /\.cc-enh\.cc-c-update #docker_list tr:is\(\.sortable, \.folder-element\) td\.updatecolumn > span\.green-text \{ background: var\(--cc-ok, #6fdc8c\);/.test(css));
  ok('and goes with the update-status column', /\.cc-enh:not\(\.cc-c-update\)  #docker_list tr:is\(\.sortable, \.folder-element\) td\.updatecolumn > span\.green-text,/.test(css));
}

console.log('\nA start plan run that went well leaves no pill');
{
  const lastRun = {};
  const el = (tag, cls, txt) => ({ cls, txt, setAttribute() {} });
  const pill = new Function('lastRun', 'el', 'runLabel', grab('lastRunPill') + '\nreturn lastRunPill;')(lastRun, el, (s) => s);
  lastRun.ccwb = { name: 'ccwb', state: 'ready' };
  ok('a container the plan brought up ready shows no pill beside "Startplan bereit"', pill('ccwb') === null);
  for (const st of ['degraded', 'failed', 'skipped']) {
    lastRun.ccwb = { name: 'ccwb', state: st };
    const p = pill('ccwb');
    ok('a ' + st + ' run still shows its pill', !!p && p.cls === 'cc-pill cc-pill-' + st);
  }
  ok('no sheet colours a ready pill', !/\.cc-pill-ready/.test(css));
}

console.log('\nThe gear menu is quiet');
{
  const menu = grab('buildMenu');
  ok('the gear menu shows no status while the engine runs', /if \(daemonUp === false\)/.test(menu) && !/engine up/.test(js));
}

console.log('\nOne word for third-party containers');
{
  const T = { de: {}, en: {} };
  for (const l of ['de', 'en']) { const m = new RegExp('    ' + l + ': \\{[^\\n]*thirdParty: "([^"]+)"').exec(js); T[l] = m && m[1]; }
  ok('German says Drittanbieter, English Third party', T.de === 'Drittanbieter' && T.en === 'Third party', JSON.stringify(T));
  const fn = new Function('t', grab('thirdPartyWord') + '\nreturn thirdPartyWord;')((k) => (k === 'thirdParty' ? 'Drittanbieter' : k));
  const text = (s) => ({ nodeType: 3, textContent: s });
  const badge = { childNodes: [{ nodeType: 1, textContent: '' }, text(' 3rd Party')] };
  fn(badge);
  ok('Unraid\'s "3rd Party" in the autostart cell reads the same word', badge.childNodes[1].textContent === ' Drittanbieter');
  const project = { childNodes: [{ nodeType: 1 }, text(' media-stack')] };
  fn(project);
  ok('any other group label is left alone', project.childNodes[1].textContent === ' media-stack');
  ok('both cells run through it', (js.match(/thirdPartyWord\((fi\.parentElement|gb)\)/g) || []).length === 2);
}

console.log('\nThe page action stands in the corner');
{
  ok('"Container hinzufügen" comes after the view switch', /input\[type=button\]\.cc-bar-primary \{\s*order: 2;/.test(css) && /\.cc-bar-adv \{ order: 1;/.test(css));
  ok('the toasts stand above the docked bar', /html\.cc-docker-on #cc-toasts \{ bottom: calc\(var\(--cc-footer-h, 0px\) \+ var\(--cc-actbar-h, 0px\) \+ 18px\); \}/.test(css));
}

console.log('\nNothing is cut off without a hint');
{
  const narrow = /@media \(max-width: 600px\) \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf('At phone width the columns')));
  ok('at phone width the table drops its header', narrow && /> thead \{ display: none; \}/.test(narrow[1]));
  ok('and each row wraps its cells under the name', narrow && /tr:is\(\.sortable, \.folder-element\) \{ display: flex; flex-wrap: wrap;/.test(narrow[1]) && /td\.ct-name \{ flex: 1 0 100%; \}/.test(narrow[1]));
  ok('without forcing a display the column toggles hide', narrow && !/display: block !important/.test(narrow[1]));
  ok('a volume path ends in an ellipsis at rest', /\.cc-vtext \{ display: block; overflow: hidden; text-overflow: ellipsis;/.test(css));
  ok('and only scrolls once the marquee runs', /\.cc-vrun > \.cc-vtext \{ display: inline-block; overflow: visible;/.test(css) && /w\.classList\.add\("cc-vrun"\)/.test(js));
}

console.log('\nThe start plan chip is an action, in sentence case');
ok('its word drops the data badges\' uppercase', /\.cc-plan \.cc-b-k \{ text-transform: none; letter-spacing: normal; \}/.test(css));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
