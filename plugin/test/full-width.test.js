// Pages and windows run the full width (GlimStone, "The content column" and "Windows"). The
// settings cards stand under each other up to a reading width, a dropdown or
// a one-line field stands beside its name with a width of its own (rule 35), and a window's
// actions sit at the end of its foot with Close first. A grid of cards stands on the page: a
// folder in the folder view has no card around its cards.
const fs = require('fs');
const path = require('path');
const { DIR, candidates, withUnraid } = require('./cascade');
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
const win = (page, e, prop) => { const c = candidates(page, e, prop); return c[c.length - 1]; };
const val = (w) => (w ? w.value : '(none)');

console.log('\nThe settings page uses the width it has');
{
  const page = withUnraid('settings');
  const wrap = { tag: 'div', classes: ['cc-set-wrap'], inside: ['#cc-settings'] };
  ok('the cards stand under each other', val(win(page, wrap, 'display')) === 'flex' && val(win(page, wrap, 'flex-direction')) === 'column', val(win(page, wrap, 'display')));
  ok('and keep the 40px rhythm', val(win(page, wrap, 'gap')) === '40px');
  ok('no grid of columns is left', !candidates(page, wrap, 'grid-template-columns').length);
  // A card across the whole window puts a row's name and its switch a screen apart.
  const main = { tag: 'div', classes: ['cc-set-main'], inside: ['#cc-settings'] };
  ok('the card column stops at a reading width', val(win(page, main, 'max-width')) === '920px', val(win(page, main, 'max-width')));
  ok('and still shrinks beside the tiles', val(win(page, main, 'min-width')) === '0' && val(win(page, main, 'flex')) === '1 1 auto');
  const pick = { tag: 'div', classes: ['cc-set-pickrow'], inside: ['#cc-settings'] };
  ok('a colour picker keeps a width of its own', val(win(page, pick, 'max-width')) === '420px', val(win(page, pick, 'max-width')));
  const range = { tag: 'input', classes: [], attrs: { type: 'range' }, inside: ['#cc-settings', '.cc-set-row'] };
  ok('a slider stands at the end of its row with a width of its own', val(win(page, range, 'flex')) === '0 1 280px' && val(win(page, range, 'margin-left')) === 'auto', val(win(page, range, 'flex')));
}

console.log('\nA dropdown or a one-line field stands beside its name');
{
  const page = withUnraid('settings');
  const dsel = { tag: 'span', classes: ['cc-dsel'], inside: ['#cc-settings'], outside: ['.cc-pop', '.cc-on-addct'] };   // the container form's gate never stands on the settings page
  // A flex line breaks on the basis, so a basis at the full width put the dropdown under a name
  // that it fits beside once it shrinks.
  ok('a dropdown breaks the line only at its narrowest width', val(win(page, dsel, 'flex')) === '1 1 120px' && val(win(page, dsel, 'min-width')) === '120px', val(win(page, dsel, 'flex')));
  ok('and grows to a width of its own', val(win(page, dsel, 'max-width')) === 'var(--cc-dsel-w, 240px)');
  {
    // ccDsel with a select of three entries, the longest thirteen characters.
    const nodes = [];
    const mk = (tag, cls, txt) => { const n = { tag, className: cls || '', textContent: txt || '', style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, kids: [], appendChild(c) { this.kids.push(c); return c; }, setAttribute() {}, addEventListener() {}, classList: { toggle() {}, remove() {}, contains: () => false } }; nodes.push(n); return n; };
    const sel = { style: {}, options: [{ text: 'Aus', style: {} }, { text: 'Zwölf Zeichen', style: {} }, { text: 'Kurz', style: {} }], selectedIndex: 0, parentNode: null };
    const wrap = new Function('el', 'sel', 'ccDselSync', 'ccDselPosition', 'Event', 'window', grabFn(settings, 'ccDsel') + '; return ccDsel(sel);')(mk, sel, () => {}, () => {}, function () {}, {});
    ok('ccDsel sizes the dropdown to its longest entry', wrap.style.props['--cc-dsel-w'] === 'min(calc(13ch + 52px), 340px)', wrap.style.props['--cc-dsel-w']);
  }
  ok('the motion setting goes through the shared option row, beside its name', /themingCard\.appendChild\(segRow\(T\("Bewegung", "Motion"\)/.test(settings) && /function segRow\(labelText, opts, cur, onChange, help, pairs\) \{\s*return dropRow\(/.test(settings));
  ok('below 600px a selector with long labels sets its segments two to a row', /@media \(max-width:599px\)\{" \+\s*"#cc-settings \.cc-seg\.cc-set-mode\.cc-set-pairs\{[^}]*--seg-basis:calc\(50% - 1\.5px\)/.test(settings) && /\.cc-set-pairs \.cc-seg-btn\{flex:1 0 var\(--seg-basis, auto\);[^}]*white-space:normal/.test(settings));
  ok('the Labels and icon colouring selectors take that layout', (settings.match(/\), true\)\);/g) || []).length >= 1 && /completely untouched\."\), true\);/.test(settings));
  const flag = /"#cc-settings \.cc-flag-row \.cc-flag-picker\{([^}]*)\}"/.exec(settings);
  ok('the country picker stands at the end of its row, wide enough for a long name', !!flag && /margin-left:auto/.test(flag[1]) && /flex:0 1 300px/.test(flag[1]), flag && flag[1]);
  ok('the flag row names the country beside the picker', /el\("div", "cc-set-row cc-flag-row"\), frl = el\("span", "cc-set-rl", T\("Land", "Country"\)\)/.test(settings) && /fr\.appendChild\(picker\);/.test(settings));
  ok('it keeps the row\'s end', val(win(page, dsel, 'margin-left')) === 'auto');
  const txt = { tag: 'input', classes: ['cc-set-txt'], attrs: { type: 'text' }, inside: ['#cc-settings'], html: ['cc-popups-on'] };
  const tw = win(page, txt, 'width'), tf = win(page, txt, 'flex');
  ok('a one-line field has a width of its own, past Unraid\'s 100%', tf && tf.value === '1 1 140px' && val(win(page, txt, 'max-width')) === '280px' && tw.selector === '#cc-settings .cc-set-txt' && tw.value === 'auto', tw && tw.selector);
  ok('and stands at the end of its row', /auto$/.test(val(win(page, txt, 'margin'))));
  ok('it is filled like the dropdowns, with no line around it', /--cc-surface-chip/.test(val(win(page, txt, 'background'))) && val(win(page, txt, 'border')) === 'none');
  ok('its type sits on the scale, not on Unraid\'s 1.3rem', val(win(page, txt, 'font-size')) === 'var(--cc-text-subline)');
  ok('focus is a lighter fill rather than a coloured line', /--cc-surface-chip/.test(val(win(page, Object.assign({}, txt, { states: { focus: true } }), 'background'))));
  const drop = grabFn(settings, 'dropRow');
  ok('a dropdown row puts the name first and the dropdown after it', /row\.appendChild\(rl\);[\s\S]*row\.appendChild\(ccDsel\(sel\)\)/.test(drop));
  for (const id of ['cc-set-webhook', 'cc-set-iface']) {
    const at = settings.indexOf('id = "' + id + '"');
    const around = settings.slice(settings.lastIndexOf('el("div", "cc-set-row")', at), settings.indexOf('\n', settings.indexOf('Child(', at + 200)));
    ok(id + ' stands in the same row as its name', /el\("span", "cc-set-rl", T\(/.test(around), around.slice(0, 80));
  }
}

console.log('\nA window\'s actions stand at the end of its foot');
{
  const every = withUnraid('every');
  const act = { tag: 'div', classes: ['cc-win-act'], inside: ['.cc-win'] };
  ok('the foot aligns its buttons to the end', val(win(every, act, 'justify-content')) === 'flex-end');
  const btn = { tag: 'span', classes: ['cc-win-btn'], inside: ['.cc-win', '.cc-win-act'] };
  ok('a button keeps its own width instead of filling the row', val(win(every, btn, 'flex')) === '0 0 auto' && val(win(every, btn, 'min-width')) === '96px');
  const docker = withUnraid('docker');
  const pact = { tag: 'div', classes: ['cc-pop-row', 'cc-pop-act'], inside: ['.cc-pop'] };
  ok('the editor windows\' button row does the same', val(win(docker, pact, 'justify-content')) === 'flex-end');
  const pbtn = { tag: 'span', classes: ['cc-btn'], inside: ['.cc-pop', '.cc-pop-act'], outside: ['.cc-menu-plain', '.cc-card-actions', '.cc-search'] };
  ok('and its buttons keep their own width', val(win(docker, pbtn, 'flex')) === '0 0 auto', val(win(docker, pbtn, 'flex')));
  const ask = grabFn(fs.readFileSync(path.join(DIR, 'scripts/cc-theme.js'), 'utf8'), 'ask');
  ok('Close or Cancel comes first and the answer last', /act\.appendChild\(no\); act\.appendChild\(yes\);/.test(ask));
}

console.log('\nThe share detail page runs the full width');
{
  const every = withUnraid('every');
  const html = ['cc-shares-on', 'cc-on-share-detail', 'cc-sections-share'];
  const section = { tag: 'section', classes: [], attrs: { role: 'tabpanel' }, inside: ['#displaybox'], html };
  ok('its sections have no width cap', !candidates(every, section, 'max-width').some((c) => /px/.test(c.value)), val(win(every, section, 'max-width')));
  ok('and start at the page\'s edge instead of centring', val(win(every, section, 'margin')) === '0 0 28px', val(win(every, section, 'margin')));
  const host = { tag: 'div', classes: ['tab-content'], inside: ['#displaybox'], has: ['.cc-split-row'], html };
  ok('the row with the side column has no cap either', !candidates(every, host, 'max-width').some((c) => /px/.test(c.value)), val(win(every, host, 'max-width')));
}

console.log('\nA grid of cards stands on the page');
{
  const page = withUnraid('docker');
  const group = { tag: 'div', classes: ['cc-folder-group'], outside: ['.cc-folder-group'] };
  ok('a folder group draws no card of its own', !candidates(page, group, 'background').length && !candidates(page, group, 'background-color').length);
  ok('and no card padding around its cards', !candidates(page, group, 'padding').length);
  const head = { tag: 'div', classes: ['cc-folder-group-head'] };
  ok('its head still names it on a shade', /--cc-bg3/.test(val(win(page, head, 'background'))));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
