// While a TollRoll of the fortress sends TowerTorch's alerts, the Notifications card says so
// above the switches it stands in for. What can quietly break it:
//   · the proxy not forwarding the engine's answer, so the note never shows
//   · the note showing while TollRoll does not take the alerts, or the other way round
//   · a render of the page dropping what the engine said
//   · the note missing in one of the two languages
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const settings = read('scripts/settings.js');
function grab(name) {
  const i = settings.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = settings.indexOf('{', i); k < settings.length; k++) { if (settings[k] === '{') d++; else if (settings[k] === '}') { d--; if (!d) return settings.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nThe proxy forwards the answer by GET only');
for (const f of ['server/ttapi.php', 'server/api.php']) {
  ok(f, /'notifyhub' => \['GET'\]/.test(read(f)));
}

// A stand-in for the page: elements are plain objects, the engine answers what the test says.
function page(lang, answer) {
  const nodes = {};
  const el = (tag, cls, text) => ({
    tag, className: cls || '', textContent: text || '', children: [], attrs: {}, hidden: false,
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    set id(v) { nodes[v] = this; },
  });
  const document = { getElementById: (id) => nodes[id] || null };
  const body = 'var notifyHub = false;\n' + grab('hubNote') + '\n' + grab('loadNotifyHub') + '\nreturn { hubNote: hubNote, load: loadNotifyHub };';
  const T = (d, e) => (lang === 'de' ? d : e);
  return new Function('el', 'document', 'api', 'T', 'glyph', body)(el, document, () => answer(), T, () => '<svg/>');
}
const words = (n) => n.children.map((c) => c.textContent).join(' ');
const settle = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  console.log('\nThe note follows the engine\'s answer');
  for (const [name, answer, shown] of [
    ['TollRoll takes the alerts', () => Promise.resolve({ hub: true }), true],
    ['TollRoll does not', () => Promise.resolve({ hub: false }), false],
    ['an engine without the answer', () => Promise.resolve(null), false],
    ['an engine that fails', () => Promise.reject(new Error('HTTP 400')), false],
  ]) {
    const p = page('en', answer);
    const drawn = p.hubNote();
    ok(name + ': hidden until the engine answers', drawn.hidden === true);
    p.load();
    await settle();
    ok(name + ': ' + (shown ? 'shown' : 'stays hidden'), drawn.hidden === !shown);
    ok(name + ': a card drawn afterwards keeps it', p.hubNote().hidden === !shown);
  }

  console.log('\nThe note reads as a note in both languages');
  const en = page('en', () => Promise.resolve({ hub: true })).hubNote();
  const de = page('de', () => Promise.resolve({ hub: true })).hubNote();
  ok('it is marked as a note', en.tag === 'p' && en.attrs.role === 'note');
  ok('in English it names TollRoll and what takes over again', /TollRoll/.test(words(en)) && /Unraid/.test(words(en)) && /webhook/.test(words(en)), words(en));
  ok('in German too, in its own words', /TollRoll/.test(words(de)) && /Webhook/.test(words(de)) && words(de) !== words(en), words(de));
  ok('it stands first in the Notifications card', /var c5 = card\(T\("Benachrichtigungen", "Notifications"\)[^\n]*\n\s*c5\.appendChild\(hubNote\(\)\);/.test(settings));
  ok('the page asks the engine when it loads', /\n  loadNotifyHub\(\);/.test(settings));

  console.log('\nIts look');
  const win = (prop, attrs) => candidates('settings', { tag: 'p', classes: ['tt-set-hubnote'], attrs: attrs || {}, states: {}, inside: ['#tt-settings'] }, prop).pop();
  ok('a hidden note takes no room', /^none$/.test((win('display', { hidden: '' }) || {}).value), JSON.stringify(win('display', { hidden: '' })));
  ok('a shown one lays its mark beside the words', /^flex$/.test((win('display') || {}).value), JSON.stringify(win('display')));
  ok('its words are the dim ones of the card', /--tt-text-dim/.test((win('color') || {}).value), JSON.stringify(win('color')));

  console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
  process.exit(fail ? 1 : 0);
})();
