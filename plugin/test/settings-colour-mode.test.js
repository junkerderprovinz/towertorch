// The Badges card picks one colour mode, Accent, Rainbow or Flag, in a selector at the end of its row,
// and shows only the controls of that mode under it. The mode lives in the two keys every area
// script reads, cc.rainbow and cc.flagmode, so an install keeps its look on upgrade. Shape and
// badge style sit in the Theming card.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
function env(init, flags) {
  const m = Object.assign({}, init);
  const fns = new Function('window', 'store', 'PRESETS',
    'function get(k, d) { return k in store ? store[k] : d; }\nfunction set(k, v) { store[k] = String(v); }\n' +
    grabFn(settings, 'applyFlag') + '\n' + grabFn(settings, 'colorMode') + '\n' + grabFn(settings, 'setColorMode') +
    '\nreturn { colorMode: colorMode, setColorMode: setColorMode };')({ CC_FLAGS: flags }, m, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  return Object.assign(fns, { m });
}
const FLAGS = [{ code: 'at', colors: ['#c8102e', '#ffffff'] }, { code: 'de', colors: ['#000000', '#dd0000', '#ffce00'] }];

console.log('\nThe mode is read from the keys every area reads');
{
  ok('a fresh install is in accent mode', env({}).colorMode() === 'accent');
  ok('the rainbow switch on reads as rainbow', env({ 'cc.rainbow': '1' }).colorMode() === 'rainbow');
  ok('rainbow and flag on read as flag', env({ 'cc.rainbow': '1', 'cc.flagmode': '1' }).colorMode() === 'flag');
  ok('a flag left behind with the palette off reads as accent, as the areas paint it', env({ 'cc.rainbow': '0', 'cc.flagmode': '1' }).colorMode() === 'accent');
}

console.log('\nPicking a mode writes both keys');
{
  const e = env({ 'cc.flag': 'at' }, FLAGS);
  e.setColorMode('rainbow');
  ok('rainbow turns the palette on and the flag off', e.m['cc.rainbow'] === '1' && e.m['cc.flagmode'] === '0');
  e.setColorMode('flag');
  ok('flag turns both on', e.m['cc.rainbow'] === '1' && e.m['cc.flagmode'] === '1');
  ok('and keeps the country chosen before, its colours cycled over eight places', e.m['cc.flag'] === 'at' && JSON.parse(e.m['cc.flagpal']).join(',') === '#c8102e,#ffffff,#c8102e,#ffffff,#c8102e,#ffffff,#c8102e,#ffffff');
  e.setColorMode('accent');
  ok('accent turns both off', e.m['cc.rainbow'] === '0' && e.m['cc.flagmode'] === '0');
  const fresh = env({}, FLAGS);
  fresh.setColorMode('flag');
  ok('flag with no country yet starts on Germany', fresh.m['cc.flag'] === 'de');
}

console.log('\nOnly the chosen mode shows its controls');
{
  ok('the accent colour field only in accent mode', /if \(mode === "accent"\) c1\.appendChild\(fieldRow\(T\("Akzentfarbe", "Accent colour"\), [^\n]*, prow\)\);/.test(settings));
  ok('rotation and palette only in rainbow mode', /if \(mode === "rainbow"\) \{ c1\.appendChild\(rrot\); c1\.appendChild\(fieldRow\(T\("Palette", "Palette"\), [^\n]*, rbCol\)\); \}/.test(settings));
  ok('the country only in flag mode', /if \(mode === "flag"\) c1\.appendChild\(fr\);/.test(settings) && /if \(f1 && mode === "flag"\) \{/.test(settings));
  ok('no rainbow or flag switch is left', !/T\("Regenbogen-Modus", "Rainbow mode"\)|T\("Flaggen-Modus", "Flag mode"\)/.test(settings));
  ok('nothing in the card is dimmed instead', !/rbOnly|style\.opacity = "\.4"/.test(settings));
  ok('the country row has its (i)', /frl\.appendChild\(infoIcon\(/.test(settings));
  ok('Flag is offered only with the flag list loaded', /if \(window\.CC_FLAGS && window\.CC_FLAGS\.length\) modes\.push\(\["flag", T\("Flagge", "Flag"\), "IconFlag"\]\);/.test(settings));
}

// GlimStone, "The one horizontal selector": in a settings row a selector stays compact at the
// row's end, with its label at the row's start. The Badges card holds other rows, so the mode
// selector is one of them rather than a strip across the card.
console.log('\nThe mode selector stands at the end of its row');
{
  ok('the label and the selector share one row', /var modeRow = el\("div", "cc-set-row cc-set-inline cc-set-colourmode"\);/.test(settings) && /modeRow\.appendChild\(modeLbl\);/.test(settings) && /modeRow\.appendChild\(modeSelector\(/.test(settings) && /c1\.appendChild\(modeRow\);/.test(settings));
  const css = /"#cc-settings \.cc-seg\.cc-set-mode\{([^}]*)\}"/.exec(settings);
  ok('the groove hugs its segments instead of spanning the card', !!css && /display:inline-grid/.test(css[1]) && !/width:100%/.test(css[1]), css && css[1]);
  ok('and gives every segment one width, as GlimStone\'s horizontal selector does', !!css && /grid-auto-flow:column/.test(css[1]) && /grid-auto-columns:1fr/.test(css[1]));
  ok('and is drawn deeper than the card, beating the generic segment rule', !!css && /background:var\(--cc-surface-base,#161616\)/.test(css[1]));
  const seg = /"#cc-settings \.cc-set-mode \.cc-seg-btn\{([^}]*)\}"/.exec(settings);
  ok('a segment keeps its label on one line', !!seg && /white-space:nowrap/.test(seg[1]), seg && seg[1]);
}

console.log('\nShape and badge style live in the Theming card');
{
  ok('Form', /themingCard\.appendChild\(segRow\(T\("Form", "Shape"\)/.test(settings));
  ok('Badge-Stil, with its (i)', /themingCard\.appendChild\(segRow\(T\("Badge-Stil", "Badge style"\)[^\n]*\n\s+T\("Flach: /.test(settings));
  ok('neither stays in the Badges card', !/c1\.appendChild\(segRow\(T\("(Form|Badge-Stil)"/.test(settings));
}

console.log('\nThe selector is a radio group the arrows move through');
{
  class N {
    constructor(tag, cls, txt) { this.tag = tag; this.cls = new Set((cls || '').split(' ').filter(Boolean)); this.classList = { contains: (c) => this.cls.has(c), toggle: (c, f) => (f ? this.cls.add(c) : this.cls.delete(c)) }; this.children = this.kids = []; this.textContent = txt || ''; this.attrs = {}; this.on = {}; }
    setAttribute(k, v) { this.attrs[k] = v; } appendChild(c) { this.kids.push(c); return c; }
    addEventListener(t, f) { this.on[t] = f; } focus() { doc.activeElement = this; }
  }
  const doc = { activeElement: null };
  const picks = [];
  const box = new Function('el', 'document', grabFn(settings, 'modeSelector') + '\nreturn modeSelector;')((t, c, x) => new N(t, c, x), doc)(
    [['accent', 'Accent'], ['rainbow', 'Rainbow'], ['flag', 'Flag']], 'rainbow', (m) => picks.push(m));
  ok('it is a radio group', box.attrs.role === 'radiogroup' && box.kids.every((b) => b.attrs.role === 'radio'));
  ok('the chosen mode is the badge and the one tab stop', box.kids[1].cls.has('cc-seg-on') && box.kids[1].attrs.tabindex === '0' && box.kids[0].attrs.tabindex === '-1');
  box.kids[1].on.click();
  ok('a click on the chosen mode changes nothing', picks.length === 0);
  box.kids[2].on.click();
  ok('a click on another mode picks it', picks[0] === 'flag');
  doc.activeElement = box.kids[1];
  box.on.keydown({ key: 'ArrowLeft', preventDefault() {} });
  ok('left picks the mode before it', picks[1] === 'accent');
  doc.activeElement = box.kids[2];
  box.on.keydown({ key: 'ArrowRight', preventDefault() {} });
  ok('the last mode holds at the end', picks.length === 2);
  ok('the focus follows the choice into the rebuilt card', /var on = root\.querySelector\("\.cc-set-colourmode \.cc-seg-on"\); if \(on\) on\.focus\(\{ preventScroll: true \}\);/.test(settings));
}

console.log('\nA setting with a few choices is a horizontal selector, a long list stays a dropdown');
{
  class N {
    constructor(tag, cls, txt) { this.tag = tag; this.cls = new Set((cls || '').split(' ').filter(Boolean)); this.classList = { contains: (c) => this.cls.has(c), toggle: (c, f) => (f ? this.cls.add(c) : this.cls.delete(c)) }; this.children = this.kids = []; this.textContent = txt || ''; this.attrs = {}; this.on = {}; }
    setAttribute(k, v) { this.attrs[k] = v; } appendChild(c) { this.kids.push(c); return c; }
    addEventListener(t, f) { this.on[t] = f; } focus() { doc.activeElement = this; }
  }
  const doc = { activeElement: null, createElement: (t) => ({ tag: t, style: {} }) };
  const mk = (t, c, x) => new N(t, c, x);
  const make = new Function('el', 'document', 'infoIcon', 'paintToggles', 'ccDsel', 'segGlyph', grabFn(settings, 'modeSelector') + '\n' + grabFn(settings, 'segPicker') + '\nvar SEG_MAX = 6;\n' + grabFn(settings, 'dropRow') + '\nreturn dropRow;')(mk, doc, () => mk('span', 'cc-info'), () => {}, () => mk('span', 'cc-dsel'), (g) => mk('svg', 'cc-seg-ico', g));
  const got = [];
  const row = make('Form', [['round', 'Rund'], ['soft', 'Weich'], ['square', 'Eckig']], 'soft', (v) => got.push(v));
  const seg = row.kids[1];
  ok('three shapes are a selector at the end of the row, the name first', row.cls.has('cc-set-inline') && seg.cls.has('cc-set-mode') && row.kids[0].cls.has('cc-set-lblwrap'));
  seg.kids[2].on.click();
  ok('a pick runs the setting', got[0] === 'square');
  ok('and moves the badge with it', seg.kids[2].cls.has('cc-seg-on') && !seg.kids[1].cls.has('cc-seg-on') && seg.kids[2].attrs['aria-checked'] === 'true');
  seg.kids[1].on.click();
  ok('the segment that was chosen before can be picked again', got[1] === 'soft');
  const sizes = make('Größe', ['16', '18', '20', '22', '24', '26', '28'].map((v) => [v, v + ' px']), '20', () => {});
  ok('seven sizes stay a dropdown', sizes.kids.some((k) => k.cls.has('cc-dsel')));
  const fonts = make('Schriftart', ['Arial', 'Bahnschrift', 'Calibri', 'Cambria', 'Georgia', 'Lobster', 'Verdana'].map((f) => [f, f, f]), 'Arial', () => {});
  ok('a font list that previews its faces stays a dropdown', fonts.kids.some((k) => k.cls.has('cc-dsel')));
  const shapes = make('Form', [['round', 'Rund', 'shape-round'], ['soft', 'Weich', 'shape-soft']], 'round', () => {}).kids[1];
  ok('a segment shows its glyph before its label', shapes.kids.every((b) => b.kids[0].tag === 'svg' && b.kids[1].tag === 'span'), JSON.stringify(shapes.kids.map((b) => b.kids.map((k) => k.tag))));
  ok('the glyph is the one the option names', shapes.kids[0].kids[0].textContent === 'shape-round' && shapes.kids[1].kids[0].textContent === 'shape-soft');
  ok('and the label follows it', shapes.kids[0].kids[1].textContent === 'Rund');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
