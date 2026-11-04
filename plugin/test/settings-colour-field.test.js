// Every colour on the settings page is set with one control: the embedded picker, and under it the
// GlimStone presets in one row with the hex field as its last cell, that row exactly as wide as the
// picker. The field stands at the end of its row with its name at the start, like every other
// control on the page.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
const theme = fs.readFileSync(path.join(DIR, 'scripts/tt-theme.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const win = (page, e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
const code = strip(settings), themeCode = strip(theme);

console.log('\nNo colour on the page is set without the presets');
{
  const pickers = [...themeCode.matchAll(/inlinePicker\(/g)].length;
  ok('the bare picker is built in one place, inside TTTheme.colorPicker', pickers === 2 && /function colorPicker[\s\S]*?inlinePicker\(/.test(themeCode) && !/inlinePicker\(/.test(code), pickers);
  ok('which the page takes as its colour field', /colourField = window\.TTTheme\.colorPicker\b/.test(code));
  const uses = [...code.matchAll(/colourField\(/g)].length;
  ok('the accent, an area\'s accent, the tile, the icon, the server name and the palette all use it', uses >= 6, uses);
  ok('no hex field is built outside it', !/tt-set-hexin"\)/.test(code) && [...themeCode.matchAll(/className = "tt-set-hexin"/g)].length === 1);
}

console.log('\nThe field: picker on top, presets and hex field in one row under it');
{
  // A shim with just enough DOM for colourField and the helpers it calls.
  class N {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.style = { setProperty() {}, removeProperty() {} }; this.cls = new Set(); this.value = ''; const self = this; this.classList = { toggle(c, f) { const w = f === undefined ? !self.cls.has(c) : !!f; w ? self.cls.add(c) : self.cls.delete(c); return w; }, contains: (c) => self.cls.has(c), add: (c) => self.cls.add(c), remove: (c) => self.cls.delete(c) }; }
    set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.cls].join(' '); }
    set textContent(v) { this.text = v; }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
    querySelectorAll(sel) { const out = []; const want = sel.replace('.', ''); (function walk(n) { n.children.forEach((k) => { if (k.cls.has(want)) out.push(k); walk(k); }); })(this); return out; }
  }
  const document = { createElement: (t) => new N(t), documentElement: { lang: 'en' } };
  const picks = [];
  const fake = function inlinePicker(hex, onChange) { const b = new N('div'); b.cls.add('tt-ip'); b.set = []; b._set = (h) => b.set.push(h); b._get = () => '#123456'; b.drag = onChange; return b; };
  const build = new Function('document', 'inlinePicker', 'PRESETS',
    ['div', 'german', 'normHex', 'pressable', 'swMark', 'swMarkRow', 'swTick', 'idealText', 'colorPicker'].map((n) => grabFn(theme, n)).join('\n') +
    '\nreturn colorPicker;')(document, fake, ['#FCC419', '#1D99F3', '#6FDC8C']);
  const f = build('#1d99f3', (v) => picks.push(v), { clearable: true });
  const [picker, row] = f.children;
  ok('the picker comes first, the row under it', picker.cls.has('tt-ip') && row.cls.has('tt-set-swatches') && row.cls.has('tt-fill'));
  const sws = row.children.filter((c) => c.cls.has('tt-set-sw')), hex = row.children[row.children.length - 1];
  ok('the row holds every preset and then the hex field', sws.length === 3 && hex.tagName === 'INPUT' && hex.cls.has('tt-set-hexin'));
  ok('the preset in use carries the tick', sws[1].cls.has('tt-set-sw-on') && !sws[0].cls.has('tt-set-sw-on'));
  ok('a preset is a button the keyboard reaches', sws.every((s) => s.attrs.role === 'button' && s.attrs.tabindex === '0'));
  sws[2].listeners.click[0]();
  ok('a preset click sets the picker, the hex field and the value', picks[0] === '#6FDC8C' && hex.value === '#6FDC8C' && picker.set.includes('#6FDC8C') && sws[2].cls.has('tt-set-sw-on'));
  hex.value = 'ff8389'; hex.listeners.input[0]();
  ok('a typed hex value is normalised and taken', picks[1] === '#ff8389' && !sws.some((s) => s.cls.has('tt-set-sw-on')));
  hex.value = ''; hex.listeners.input[0]();
  ok('a clearable field reports an emptied hex field', picks[2] === '');
  const g = build('', (v) => picks.push(v));
  const gh = g.children[1].children[g.children[1].children.length - 1];
  gh.value = ''; gh.listeners.input[0]();
  ok('any other field ignores an empty hex field', picks.length === 3);
  picker.drag('#abcdef');
  ok('a drag in the picker writes the hex field', hex.value === '#abcdef' && picks[3] === '#abcdef');
  f._set('', '#00ff00');
  ok('_set shows the stand-in on the picker while the value is empty', picker.set[picker.set.length - 1] === '#00ff00' && hex.value === '');
}

console.log('\nThe field stands at the end of its row, as wide as its picker');
{
  const page = withUnraid('settings');
  const pick = { tag: 'div', classes: ['tt-set-pickrow'], inside: ['#tt-settings', '.tt-set-row'], outside: ['.tt-set-pickrow'] };
  ok('it is pushed to the row\'s end', /auto$/.test(val(win(page, pick, 'margin'))), val(win(page, pick, 'margin')));
  ok('it keeps a width of its own', val(win(page, pick, 'flex')) === '0 1 420px' && val(win(page, pick, 'max-width')) === '420px');
  ok('picker and row stretch to that one width', val(win(page, pick, 'flex-direction')) === 'column' && val(win(page, pick, 'align-items')) === 'stretch');
  const row = { tag: 'div', classes: ['tt-set-swatches', 'tt-fill'], inside: ['#tt-settings', '.tt-set-pickrow'] };
  ok('the preset row adds no margin of its own inside it', val(win(page, row, 'margin')) === '0');
  const hex = { tag: 'input', classes: ['tt-set-hexin'], attrs: { type: 'text' }, inside: ['#tt-settings', '.tt-set-swatches', '.tt-fill'] };
  ok('the hex field takes what the row has left', val(win(page, hex, 'flex')) === '1 1 0');
  const sq = (n) => val(win(page, n, 'flex')) === 'none' && val(win(page, n, 'width')) === '30px' && val(win(page, n, 'height')) === '30px';
  ok('every swatch is a 30px square', sq({ tag: 'span', classes: ['tt-set-sw'], inside: ['#tt-settings', '.tt-set-swatches', '.tt-fill'] }));
  ok('and so is the reset after a palette', sq({ tag: 'span', classes: ['tt-set-ibtn'], inside: ['#tt-settings', '.tt-set-swatches', '.tt-fill'] }));
  const fr = { tag: 'div', classes: ['tt-set-row', 'tt-set-fieldrow'], inside: ['#tt-settings', '.tt-set-card'] };
  ok('its name sits at the start of the first line', val(win(page, fr, 'align-items')) === 'flex-start' && val(win(page, fr, 'flex-wrap')) === 'nowrap');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
