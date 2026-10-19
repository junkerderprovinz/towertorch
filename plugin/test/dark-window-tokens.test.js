// TowerTorch's own windows, .cc-pop, .cc-win and .cc-menu, stay dark on a white or azure
// page, so the tokens inside them must read as on a dark theme. A custom property mixed
// on <html> is inherited as the finished colour, so re-pinning --cc-text in the window
// does not reach --cc-hover-wash: every token that derives from a flipped one has to be
// mixed again in the window.
//
// The values are resolved the way a browser does: <html> computes its tokens with the
// light override on top, the window declares its own, and the rest is inherited.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, tokens, resolve, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Header.css declares a few dark surfaces on :root that the light override also flips.
const rootDark = {};
for (const r of parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Header.css'), 'utf8'))) {
  if (r.selector.trim() === ':root') for (const d of r.decls) if (d.prop.startsWith('--')) rootDark[d.prop] = d.value;
}
const dark = Object.assign({}, rootDark, tokens(false));
const light = Object.assign({}, rootDark, tokens(true));
const computed = (map) => { const out = {}; for (const k of Object.keys(map)) out[k] = resolve(map[k], map); return out; };
const darkHtml = computed(dark), lightHtml = computed(light);

const windowDecls = {};
let islandSel = '';
for (const r of parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8'))) {
  if (r.selector.replace(/\s+/g, ' ').trim().startsWith('.cc-pop, .cc-menu, .cc-win, .cc-rowmenu')) { islandSel = r.selector; for (const d of r.decls) if (d.prop.startsWith('--')) windowDecls[d.prop] = d.value; }
}
function inWindow(htmlComputed) {
  const scope = Object.assign({}, htmlComputed, windowDecls);
  const out = Object.assign({}, htmlComputed);
  for (const k of Object.keys(windowDecls)) out[k] = resolve(windowDecls[k], scope);
  return out;
}
const lightWin = inWindow(lightHtml), darkWin = inWindow(darkHtml);

console.log('\nThe resolver');
{
  const html = computed({ '--t': '#fff', '--w': 'mix(var(--t))' });
  const scope = Object.assign({}, html, { '--t': '#000' });
  ok('a derived token keeps the value <html> computed when only its source is re-pinned', resolve('var(--w)', scope) === 'mix(#fff)');
}

console.log('\nInside a window on a light theme every token reads as on a dark one');
const flipped = Object.keys(light).filter((k) => light[k] !== dark[k]);
const derived = Object.keys(dark).filter((k) => !flipped.includes(k) && darkHtml[k] !== lightHtml[k]);
ok('the light override flips the text tokens at all', flipped.includes('--cc-text-chip') && flipped.includes('--cc-text'));
for (const k of flipped.concat(derived)) {
  ok(`${k}`, lightWin[k] === darkHtml[k], `${lightWin[k]} in the window, ${darkHtml[k]} on a dark theme`);
}
ok('on a dark theme the window changes nothing', Object.keys(windowDecls).every((k) => darkWin[k] === darkHtml[k]),
  Object.keys(windowDecls).filter((k) => darkWin[k] !== darkHtml[k]).join(', '));

// The Startplan window on a white theme in the reactive mode: resting chips and buttons
// sit on the translucent chip grey over the window and take --cc-text-chip.
console.log('\nThe Startplan window, white theme, reactive rest');
{
  const lum = (rgb) => { const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(rgb[0]) + 0.7152 * l(rgb[1]) + 0.0722 * l(rgb[2]); };
  const rgb = (v) => { let m = /^#([0-9a-f]{6})$/i.exec(v); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; } m = /^rgba?\(([^)]*)\)$/.exec(v); if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } return null; };
  const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
  // the content card, the lighter of the two surfaces a control stands on and so the harder one for light ink
  const WIN = [0x24, 0x24, 0x24];
  const html = ['cc-docker-on', 'cc-shares-rbneutral', 'Theme--white'];
  const CTLS = { 'a resting day chip': ['cc-day'], '"+ Zeitplan"': ['cc-btn'], '"Speichern"': ['cc-btn', 'cc-btn-primary'] };
  for (const [what, classes] of Object.entries(CTLS)) {
    const el = { tag: 'span', classes, attrs: { class: classes.join(' ') }, states: {}, html };
    const top = (prop) => { const c = candidates('docker', el, prop).filter((x) => /\.cc-pop/.test(x.selector)); return c[c.length - 1]; };
    const bg = top('background'), fg = top('color');
    const b = bg && rgb(resolve(bg.value, lightWin)), f = fg && rgb(resolve(fg.value, lightWin));
    const r = b && f ? (() => { const x = lum(over(b, WIN)), y = lum(f); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); })() : 0;
    ok(`${what} reads at 4.5:1`, r >= 4.5, `${fg && resolve(fg.value, lightWin)} on ${bg && bg.value} = ${r.toFixed(2)}:1`);
  }
  // A field's ink competes with Unraid's input[type="text"]:where(...), which paints the white
  // theme's #1d1b1b and outweighs a single class, so its rules take part here.
  const { withUnraid } = require('./cascade');
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const [what, type, states, fill] of [['the max./Std. field', 'number', {}, [0x2e, 0x2e, 0x2e]], ['the CPU field', 'text', {}, [0x2e, 0x2e, 0x2e]], ['a focused field', 'text', { focus: true }, [0x38, 0x38, 0x38]]]) {
    const el = { tag: 'input', classes: ['cc-in'], attrs: { type }, states, html, inside: ['.cc-pop'] };
    const c = candidates(withUnraid('docker'), el, 'color'), fg = c[c.length - 1];
    const f = rgb(resolve(fg.value, lightWin));
    const r = f ? ratio(f, fill) : 0;
    ok(`${what} reads at 4.5:1`, r >= 4.5, `${fg.sheet}: ${fg.selector} => ${resolve(fg.value, lightWin)}, ${r.toFixed(2)}:1`);
  }
}

// CA's Statistics, Credits and Change Log panel is a #1a1a1a surface on every theme, and its text
// reads --cc-text-chip, which the white theme flips to #303030.
console.log('\nThe CA changelog panel, white theme');
{
  const inIsland = /#alternateView \.alternateViewContent/.test(islandSel);
  ok('the panel is part of the dark island', inIsland);
  const scope = inIsland ? lightWin : lightHtml;
  const lum = (rgb) => { const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(rgb[0]) + 0.7152 * l(rgb[1]) + 0.0722 * l(rgb[2]); };
  const hex = (v) => { const m = /^#([0-9a-f]{6})$/i.exec(v); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const PANEL = [0x1a, 0x1a, 0x1a];
  const html = ['cc-popups-on', 'Theme--white'];
  for (const [what, tag, classes] of [['a changelog line', 'li', []], ['a statistics label', 'td', ['ca_table']]]) {
    const el = { tag, classes, attrs: {}, states: {}, html, inside: ['#alternateView', '.alternateViewContent'] };
    const c = candidates('every', el, 'color'), fg = c[c.length - 1];
    const f = fg && hex(resolve(fg.value, scope));
    const r = f ? (lum(f) + 0.05 > lum(PANEL) + 0.05 ? (lum(f) + 0.05) / (lum(PANEL) + 0.05) : (lum(PANEL) + 0.05) / (lum(f) + 0.05)) : 0;
    ok(`${what} reads at 4.5:1`, r >= 4.5, `${fg && fg.selector} => ${fg && resolve(fg.value, scope)}, ${r.toFixed(2)}:1`);
  }
}

// A window's field labels stand on the content card and its placeholders in the fields, at rest
// and focused. Both carry information, so both read at 4.5:1 on every theme.
console.log('\nWindow labels and placeholders');
{
  const lum = (h) => { const n = parseInt(h.slice(1), 16); const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hexOf = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null);
  for (const [theme, scope, html] of [['dark', darkWin, ['cc-docker-on']], ['white', lightWin, ['cc-docker-on', 'Theme--white']]]) {
    const lbl = { tag: 'span', classes: ['cc-pop-lbl'], attrs: {}, states: {}, html, inside: ['.cc-pop'] };
    const c = candidates('docker', lbl, 'color'), fg = c[c.length - 1];
    const f = fg && hexOf(resolve(fg.value, scope)), r = f ? ratio(f, '#242424') : 0;
    ok(`${theme}: a label on the content card reads at 4.5:1`, r >= 4.5, `${fg && fg.selector} => ${fg && resolve(fg.value, scope)}, ${r.toFixed(2)}:1`);
    // The resolver leaves pseudo-elements out, so the placeholder rules are read directly.
    const rules = parseRules(fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8')).filter((x) => /\.cc-(in|pop[^-])[^,{]*::placeholder|\.cc-pop input::placeholder/.test(x.selector));
    const decl = rules.length ? rules[rules.length - 1].decls.find((d) => d.prop === 'color') : null;
    const p = decl && hexOf(resolve(decl.value, scope));
    for (const [state, fill] of [['at rest', '#2e2e2e'], ['focused', '#383838']]) {
      const rp = p ? ratio(p, fill) : 0;
      ok(`${theme}: a placeholder in a field ${state} reads at 4.5:1`, rp >= 4.5, `${decl && resolve(decl.value, scope)} on ${fill}, ${rp.toFixed(2)}:1`);
    }
  }
}

console.log('\nThe field in a question window, such as "Neuer Ordner"');
{
  const lum = (h) => { const n = parseInt(h.slice(1), 16); const l = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const rule = parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8')).find((x) => /\.cc-win \.cc-win-in::placeholder/.test(x.selector));
  const decl = rule && rule.decls.find((d) => d.prop === 'color');
  ok('its placeholder takes the muted ink rather than Unraid\'s link colour', decl && decl.important && /--cc-text-hint/.test(decl.value), decl && decl.value);
  for (const [theme, scope] of [['dark', darkWin], ['white', lightWin]]) {
    const p = decl && resolve(decl.value, scope);
    for (const [state, fill] of [['at rest', '#2e2e2e'], ['focused', '#383838']]) {
      const rp = p ? ratio(p, fill) : 0;
      ok(`${theme}: it reads at 4.5:1 on the field ${state}`, rp >= 4.5, `${p} on ${fill}, ${rp.toFixed(2)}:1`);
    }
  }
}

console.log('\nA settings card, dark on a light theme');
for (const theme of ['Theme--white', 'Theme--azure']) {
  const card = { tag: 'div', classes: ['cc-set-card'], inside: ['#cc-settings'], html: [theme] };
  const chip = candidates('settings', card, '--cc-text-chip').pop();
  ok(theme + ': a grey chip inside it keeps the light ink', chip && chip.value === darkHtml['--cc-text-chip'], chip && chip.value);
  // A lock line's "Folgt", a hint, the colour mode's groove and an off switch sit on the dark
  // card, not on the page.
  for (const tok of ['--cc-text-dim', '--cc-text-hint', '--cc-surface-base', '--cc-surface-3', '--cc-toggle-track-off']) {
    const got = candidates('settings', card, tok).pop();
    ok(theme + ': ' + tok + ' keeps its dark-theme value', got && got.value === darkHtml[tok], got && got.value);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
