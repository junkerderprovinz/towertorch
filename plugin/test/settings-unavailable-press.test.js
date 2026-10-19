// A control on the settings page that cannot act right now still answers a press: a shut row's
// switch or selector, a choice that is not available yet and the line of a locked row shake, or
// glow in the focus halo where nothing may move. The helper lives in cc-theme.js, so every CC
// window can use it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const { specificity, cmp } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const settings = read('scripts/settings.js');
const theme = read('scripts/cc-theme.js');
const header = read('sheets/TowerTorch.Header.css');

class Ctl {
  constructor() { this.cls = new Set(); this.attrs = {}; this.on = {}; this.kids = []; this.style = {}; this.offsetWidth = 10; }
  get classList() { const s = this.cls; return { add: (c) => s.add(c), remove: (...c) => c.forEach((x) => s.delete(x)), contains: (c) => s.has(c), toggle: (c, v) => (v ? s.add(c) : s.delete(c)) }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter((x) => x !== f); }
  appendChild(c) { this.kids.push(c); return c; }
  focus() {}
}

console.log('\nThe shared helper shakes, or glows where nothing may move');
{
  const api = new Function('setTimeout', 'clearTimeout', grabFn(theme, 'shake') + grabFn(theme, 'deny') + 'return { deny: deny };');
  const timers = [];
  const { deny } = api((f) => { timers.push(f); return timers.length; }, () => {});
  const el = new Ctl();
  deny(el);
  ok('a press marks the control with the refusal and its shake', el.cls.has('cc-deny') && el.cls.has('cc-shake'));
  timers.forEach((f) => f());
  ok('and both come off again', !el.cls.has('cc-deny') && !el.cls.has('cc-shake'));
  ok('every CC window reaches it through CCTheme', /fail: fail, deny: deny,/.test(theme));
  const rule = /\.cc-shake\.cc-deny \{ animation: cc-deny-halo [^}]*!important; \}/.exec(header);
  ok('without motion the refusal is the focus halo, not the fading pulse', !!rule && /@keyframes cc-deny-halo \{[^}]*\}\s*30% \{ box-shadow: 0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\); \}/.test(header));
  const gate = 'html:not([data-cc-motion="off"]) .cc-shake';
  ok('with motion allowed the shake wins over the halo', header.indexOf(gate + ' { animation: cc-shake') > header.indexOf('.cc-shake.cc-deny') && cmp(specificity(gate), specificity('.cc-shake.cc-deny')) > 0, specificity(gate) + ' vs ' + specificity('.cc-shake.cc-deny'));
}

console.log('\nThe settings page refuses a press on what cannot act');
{
  const denied = [];
  const root = { contains: () => true, addEventListener() {} };
  const refuse = new Function('root', 'window', grabFn(settings, 'refuse') + 'return refuse;')(root, { CCTheme: { deny: (el) => denied.push(el) } });
  const press = (hits, type, key) => {
    const ev = { type, key, stopped: false, prevented: false, target: { closest: (sel) => hits[sel] || null }, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    refuse(ev); return ev;
  };
  const toggle = { name: 'toggle' }, option = { name: 'folder' }, lock = { name: 'lockby' };
  let ev = press({ '.cc-set-disabled :is(.cc-seg, .cc-set-toggle, .cc-set-numwrap)': toggle }, 'click');
  ok('a switch in a shut row shakes and never flips', denied[0] === toggle && ev.stopped && ev.prevented);
  ev = press({ '[aria-disabled=true]': option }, 'keydown', 'Enter');
  ok('a choice that is not available refuses Enter as well', denied[1] === option && ev.stopped);
  ev = press({ '.cc-set-locked .cc-set-lockby': lock }, 'click');
  ok('the line of a locked row shakes, its button stays free', denied[2] === lock && ev.stopped);
  ev = press({ '[aria-disabled=true]': option }, 'keydown', 'ArrowRight');
  ok('other keys pass through untouched', denied.length === 3 && !ev.stopped);
  ev = press({}, 'click');
  ok('a press on a working control passes through untouched', denied.length === 3 && !ev.stopped);
  ok('it listens on the page root in the capture phase, before the control hears it', /root\.addEventListener\("click", refuse, true\);\s*root\.addEventListener\("keydown", refuse, true\);/.test(settings));
  ok('a shut row shows that it takes no press', /"#cc-settings \.cc-set-disabled :is\(\.cc-seg, \.cc-seg-btn, \.cc-set-toggle, \.cc-set-numwrap\)\{cursor:not-allowed\}"/.test(settings) && /"#cc-settings \.cc-set-disabled input\{pointer-events:none\}"/.test(settings));
  ok('a disabled dropdown choice shakes too', /if \(sel\.options\[idx\]\.disabled\) \{ if \(window\.CCTheme && window\.CCTheme\.deny\) window\.CCTheme\.deny\(ev\.currentTarget\); return; \}/.test(settings));
}

console.log('\nA selector keeps an unavailable choice in view and refuses it');
{
  const picks = [], denied = [];
  const doc = { activeElement: null };
  const el = (tag, cls, txt) => { const n = new Ctl(); (cls || '').split(' ').filter(Boolean).forEach((c) => n.cls.add(c)); n.textContent = txt || ''; return n; };
  const make = new Function('el', 'segGlyph', 'document', 'window', grabFn(settings, 'modeSelector') + 'return modeSelector;');
  const box = make(el, () => new Ctl(), doc, { CCTheme: { deny: (b) => denied.push(b) } })([['list', 'Liste'], ['grid', 'Raster'], ['folder', 'Ordner', null, true]], 'grid', (v) => picks.push(v));
  const [, grid, folder] = box.kids;
  ok('the choice is marked as unavailable', folder.attrs['aria-disabled'] === 'true' && grid.attrs['aria-disabled'] === undefined);
  folder.on.click[0]();
  ok('a click on it picks nothing', picks.length === 0);
  doc.activeElement = grid;
  let prevented = false;
  box.on.keydown[0]({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  ok('the arrow onto it shakes it and leaves the choice where it was', prevented && picks.length === 0 && denied[0] === folder);
  box.on.keydown[0]({ key: 'ArrowLeft', preventDefault() {} });
  ok('the arrow to an available choice still picks it', picks[0] === 'list');
}

console.log('\nThe strength slider reaches the redrawn logos in the preview');
{
  const st = { strength: 100 };
  const filterDef = new Function('st', grabFn(settings, 'filterDef') + 'return filterDef;')(st);
  const vals = () => /values="([^"]+)"/.exec(filterDef('f', '#ffffff', false))[1].split(' ').map(Number);
  ok('at full strength a redrawn logo is the ink alone', vals()[0] === 0 && vals()[4] === 1);
  st.strength = 30;
  ok('at 30 it keeps 70 per cent of the original', vals()[0] === 0.7 && vals()[4] === 0.3 && vals()[18] === 1, vals().join(' '));
  ok('a knocked-out tile gets the strength as well', /Ci\.knock\(ink\(false, i\), plan\.tile, st\.strength\)/.test(settings));
}

console.log('\nEvery colour pick repaints what shows it');
{
  const pal = /var rbPick = colourField\(rbpal\[0\], function \(v\) \{([\s\S]*?)\n    \}\);/.exec(settings);
  ok('a palette colour repaints the previews, switches, card badges and tabs', !!pal && /paintPrev\(\); paintToggles\(\); paintCardHeads\(\); paintSetTabs\(\); repaintLogoPrevs\(\); tintPrev\(\);/.test(pal[1]));
  const acc = /var prow = colourField\(accent, function \(v\) \{([^}]*)\}/.exec(settings);
  ok('the accent repaints the logo previews too, which fall back to it', !!acc && /repaintLogoPrevs\(\); tintPrev\(\);/.test(acc[1]));
}

console.log('\nAn area\'s badge preview shows what its own tab paints');
{
  const block = /pvBadges = \(\{([\s\S]*?)\}\)\[P\]\(\);/.exec(settings);
  ok('every area with badges has its own samples', !!block && ['ccd.', 'ccv.', 'ccp.', 'ccm.', 'ccs.', 'cct.', 'ccf.'].every((p) => block[1].includes('"' + p + '": function')));
  ok('no area previews the Docker menu tab, which its colour never reaches', !/"cc-navtab cc-navtab-on", "Docker"\)\s*\]/.test(settings) && !!block && !/navtab/.test(block[1]));
  ok('the VM samples are VM names and the VM badges', !!block && /"ccv\.": function \(\) \{ return \[mkName\("Windows 11"\), mkVal\("CPU", "4"\), mkVal\("RAM", "8G"\), mkName\("Home Assistant"\), mkVal\("IP", "\.20\.30"\), mkVal\("BW", "100M"\)\]; \}/.test(block[1]));
  ok('with the rainbow or a flag the accent gives way to a line naming the colour mode, and no preview shows', /if \(palMode\) cA\.appendChild\(lockRow\(accLabel, T\("Folgt dem Farbmodus", "Follows the colour mode"\)/.test(settings) && /if \(!palMode\) \{ cA\.appendChild\(el\("div", "cc-set-lbl", T\("Vorschau", "Preview"\)\)\); cA\.appendChild\(pv\); \}/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
