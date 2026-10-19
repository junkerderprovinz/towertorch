// On a phone the menu bar keeps to one row: Unraid keeps both tiles as one clipped row each below
// 768px, and wrapped they would take four lines at 390px. The tabs swipe sideways and fade out
// where more wait, a tab that has a glyph shows only the glyph except the open one, and the utility
// icons open from the burger with the bell left beside it. The status chips above the tabs swipe
// as one row too. The user list and the settings tiles follow the same house rules on every width:
// a page has no heading, the page action floats, and a tile is one button.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR, PAGES, candidates, cmp } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const css = read('sheets/TowerTorch.Header.css');
const header = read('scripts/header.js');
const body = (name) => { const i = header.indexOf('function ' + name + '('); return i < 0 ? '' : header.slice(i, header.indexOf('\n  }\n', i)); };
// The sheets as a phone reads them, less the rules for 768px and up, and as a desktop reads them,
// less the phone rules.
function without(src, open) {
  for (let at = src.indexOf(open); at >= 0; at = src.indexOf(open)) {
    let d = 0, k = at + open.length - 1;
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) break; }
    src = src.slice(0, at) + src.slice(k + 1);
  }
  return src;
}
const PHONE = PAGES.every.map((f) => ({ name: f, css: without(read(f), '@media (min-width: 768px) {') }));
const DESKTOP = PAGES.every.map((f) => ({ name: f, css: without(read(f), '@media (max-width: 767.98px) {') }));
const media = (src, from) => { const at = src.indexOf(from); const open = src.lastIndexOf('@media (max-width: 767.98px) {', at); return src.slice(open, src.indexOf('\n}\n', at)); };

console.log('\nThe menu bar on a phone');
{
  const phone = media(css, 'Below 768px Unraid keeps both tiles');
  const html = ['cc-header-on', 'cc-popups-on', 'Theme--black'];
  const all = (el, prop) => candidates(PHONE, Object.assign({ attrs: {}, states: {}, html }, el), prop);
  const val = (el, prop) => { const c = all(el, prop); return c.length ? c[c.length - 1].value : null; };
  const menu = { tag: 'div', classes: [], id: 'menu' };
  ok('the menu is one flex row', val(menu, 'display') === 'flex' && val(menu, 'flex-wrap') === 'nowrap');
  const tabs = { tag: 'div', classes: ['nav-tile'], inside: ['#menu'] };
  ok('the tabs stay on one line', val(tabs, 'flex-wrap') === 'nowrap');
  ok('and swipe sideways, snapping to a tab', val(tabs, 'overflow-x') === 'auto' && val(tabs, 'scroll-snap-type') === 'x proximity');
  ok('without a scrollbar', val(tabs, 'scrollbar-width') === 'none' && /::-webkit-scrollbar \{ display: none; \}/.test(phone));
  ok('they give way to the bell and the burger', val(tabs, 'flex') === '1 1 auto' && val(tabs, 'min-width') === '0');
  const wild = all(tabs, 'overflow').filter((d) => d.selector.includes(':has(> .nav-item:hover)'));
  const keep = all(tabs, 'overflow-x').filter((d) => d.value === 'auto' && d.important);
  ok('a tab left hovered by a tap does not stop the scrolling', wild.length > 0 && keep.length > 0 && keep.every((k) => wild.every((w) => cmp(k.spec, w.spec) > 0)));
  ok('the side where more tabs wait fades out', /\.nav-tile:not\(\.right\)\.cc-more-r \{[^}]*mask-image: linear-gradient\(to right/.test(phone) && /\.nav-tile:not\(\.right\)\.cc-more-l \{[^}]*mask-image: linear-gradient\(to left/.test(phone));
  const icons = { tag: 'div', classes: ['nav-tile', 'right'], inside: ['#menu'] };
  ok('the icon group keeps its own size at the end of the row', val(icons, 'flex') === '0 0 auto' && val(icons, 'flex-wrap') === 'nowrap');
  const util = { tag: 'div', classes: ['nav-item', 'util', 'LogButton'], inside: ['#menu', '.nav-tile', '.right'] };
  ok('the utility icons leave the row', val(util, 'position') === 'absolute' && val(util, 'visibility') === 'hidden' && val(util, 'pointer-events') === 'none');
  ok('but keep the display the person chose, which the burger menu reads', !all(util, 'display').some((d) => d.selector.includes(':not(.cc-iconproxy)')));
  const bell = { tag: 'div', classes: ['nav-item', 'util', 'cc-iconproxy'], id: 'cc-bell-proxy', inside: ['#menu', '.nav-tile', '.right'] };
  ok('the bell and the burger stay', val(bell, 'visibility') !== 'hidden');
  ok('a closed tab with a glyph shows only the glyph', /:not\(\.active\) > a:has\(> svg\.cc-tab-ico\) > span\.cc-tab-label \{ display: none; \}/.test(phone));
  const hides = phone.split('\n').filter((l) => l.includes('span.cc-tab-label { display: none'));
  ok('the open tab keeps its name', hides.length > 0 && hides.every((l) => l.includes(':not(.active)')));
  ok('a tab keeps its name for screen readers', header.includes('a.setAttribute("aria-label", node.textContent.trim());'));
  ok('the open tab is brought into view on load and on resize', /ccTabStrip\(\);/.test(body('apply')) && header.includes('window.addEventListener("resize", ccTabStrip);'));
}

console.log('\nThe status island on a phone');
{
  const html = ['cc-header-on', 'cc-popups-on', 'Theme--black'];
  const val = (sheets, el, prop) => { const c = candidates(sheets, Object.assign({ attrs: {}, states: {}, html }, el), prop); return c.length ? c[c.length - 1].value : null; };
  const isle = { tag: 'span', classes: [], id: 'cc-island' };
  const chip = { tag: 'span', classes: ['cc-isl-chip'], inside: ['#cc-island'] };
  ok('the chips stay on one line', val(PHONE, isle, 'flex-direction') === 'row' && val(PHONE, isle, 'flex-wrap') === 'nowrap');
  ok('and swipe sideways, snapping to a chip', val(PHONE, isle, 'overflow-x') === 'auto' && val(PHONE, isle, 'overflow-y') === 'hidden' && val(PHONE, isle, 'scroll-snap-type') === 'x proximity');
  ok('without a scrollbar', val(PHONE, isle, 'scrollbar-width') === 'none' && css.includes('#cc-island::-webkit-scrollbar { display: none; }'));
  ok('a swipe past the end leaves the page where it is', val(PHONE, isle, 'overscroll-behavior-x') === 'contain');
  ok('the row is as wide as the screen, never wider', val(PHONE, isle, 'flex') === '1 0 100%' && val(PHONE, isle, 'min-width') === '0' && val(PHONE, isle, 'box-sizing') === 'border-box');
  ok('a chip keeps its size and is a snap point', val(PHONE, chip, 'flex') === '0 0 auto' && val(PHONE, chip, 'scroll-snap-align') === 'start');
  const fade = (side) => val(PHONE, { tag: 'span', classes: [side], id: 'cc-island' }, 'mask-image') || '';
  ok('the side where more chips wait fades out, as the tabs do', fade('cc-more-r').startsWith('linear-gradient(to right') && fade('cc-more-l').startsWith('linear-gradient(to left'));
  ok('on a desktop the island keeps its rows and does not scroll', val(DESKTOP, isle, 'flex-direction') === 'column' && val(DESKTOP, isle, 'overflow-x') === null && val(DESKTOP, chip, 'scroll-snap-align') === null);
  ok('the fade follows each rebuild, a resize and the settle after load', body('ccIsland').includes('ccIslandStrip();') && header.includes('window.addEventListener("resize", ccIslandStrip);') && /function reSettle\(\) \{[^\n]*ccIslandStrip\(\);/.test(header));
  ok('a rebuild refills the island in place, so a swiped row keeps its position', body('ccIsland').includes('while (isle.firstChild) isle.removeChild(isle.firstChild);'));
}

// A minimal browser around the strip's edge marks and the burger menu's icon row.
function load(win) {
  const ctx = vm.createContext(Object.assign({ setTimeout: (f) => f(), KeyboardEvent: function (t, o) { this.type = t; Object.assign(this, o); } }, win));
  vm.runInContext(['ccIsPhone', 'ccStripEdges', 'ccIslandStrip', 'ccAcctTools'].map((n) => body(n) + '\n  }\n').join(''), ctx);
  return ctx;
}
class El {
  constructor(tag, opts = {}) {
    Object.assign(this, { tagName: tag.toUpperCase(), attrs: {}, cls: new Set(), kids: [], listeners: {}, props: {}, display: 'flex', textContent: '' }, opts);
    this.style = { setProperty: (k, v) => { this.props[k] = v; }, getPropertyValue: (k) => this.props[k] || '' };
    this.classList = { toggle: (c, on) => (on ? this.cls.add(c) : this.cls.delete(c)), contains: (c) => this.cls.has(c), add: (c) => this.cls.add(c) };
  }
  set className(v) { this.cls = new Set(v.split(' ')); }
  get className() { return [...this.cls].join(' '); }
  get children() { return this.kids; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(c) { this.kids.push(c); return c; }
  insertBefore(c, ref) { const i = this.kids.indexOf(ref); this.kids.splice(i < 0 ? this.kids.length : i, 0, c); return c; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  cloneNode() { const c = new El(this.tagName.toLowerCase()); c.attrs = Object.assign({}, this.attrs); c.cls = new Set(this.cls); return c; }
}

console.log('\nThe tab strip fades where more tabs wait');
{
  const run = (scrollLeft, dir) => {
    const tile = new El('div', { scrollWidth: 600, clientWidth: 300, scrollLeft });
    load({ getComputedStyle: () => ({ direction: dir || 'ltr' }) }).ccStripEdges(tile);
    return [...tile.cls].sort().join(' ');
  };
  ok('at the start, on the right only', run(0) === 'cc-more-r', run(0));
  ok('in the middle, on both sides', run(150) === 'cc-more-l cc-more-r', run(150));
  ok('at the end, on the left only', run(300) === 'cc-more-l', run(300));
  ok('a right-to-left strip starts at the right, so it fades on the left', run(0, 'rtl') === 'cc-more-l', run(0, 'rtl'));
  const fits = new El('div', { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
  load({ getComputedStyle: () => ({ direction: 'ltr' }) }).ccStripEdges(fits);
  ok('a strip that fits does not fade at all', fits.cls.size === 0);
}

console.log('\nThe status island fades where more chips wait');
{
  const isle = new El('span', { scrollWidth: 650, clientWidth: 382, scrollLeft: 0 });
  const ctx = load({ document: { getElementById: (id) => (id === 'cc-island' ? isle : null) }, getComputedStyle: () => ({ direction: 'ltr' }) });
  ctx.ccIslandStrip();
  ok('at the start, on the right only', [...isle.cls].join(' ') === 'cc-more-r', [...isle.cls].join(' '));
  isle.scrollLeft = 268; isle.listeners.scroll[0]();
  ok('swiped to the end, on the left only', [...isle.cls].join(' ') === 'cc-more-l', [...isle.cls].join(' '));
  ctx.ccIslandStrip();
  ok('a later rebuild adds no second scroll listener', isle.listeners.scroll.length === 1);
  let threw = false;
  try { load({ document: { getElementById: () => null } }).ccIslandStrip(); } catch (e) { threw = true; }
  ok('with the island switched off there is nothing to mark', !threw);
}

console.log('\nThe burger menu carries the utility icons on a phone');
{
  const make = (phone) => {
    const trig = new El('span', { id: 'reka-menu-trigger-v-0-0' });
    const menu = new El('div', { attrs: { 'aria-labelledby': 'reka-menu-trigger-v-0-0' } });
    const list = new El('div');
    menu.kids.push(new El('span'), list);
    menu.querySelector = (q) => (q === '.cc-acct-tools' ? menu.kids.find((k) => k.cls.has('cc-acct-tools')) || null : q === ':scope > div' ? list : null);
    const clicks = [];
    const item = (name, display, rb) => {
      const glyph = new El('b', { attrs: { class: 'icon-u-log system', style: 'color: #161616 !important' } });
      const a = new El('a', { attrs: { 'data-cc-tip': name } });
      a.querySelector = () => glyph;
      a.click = () => clicks.push(name);
      if (rb) a.props['--cc-rb-c'] = rb;
      const it = new El('div', { display });
      it.querySelector = () => a;
      return it;
    };
    const items = [item('Terminal', 'flex', '#ff8800'), item('Sprache wechseln', 'none'), item('Protokoll', 'flex')];
    const sent = [];
    const doc = {
      querySelector: (q) => (q === '[data-cc-trig="burger"]' ? trig : null),
      querySelectorAll: () => items,
      createElement: (t) => new El(t),
      dispatchEvent: (e) => sent.push(e.key),
    };
    const ctx = load({ document: doc, window: { matchMedia: () => ({ matches: phone }), CCTheme: { pressable: (x) => x } }, getComputedStyle: (el) => ({ display: el.display }) });
    ctx.ccAcctTools(menu);
    return { menu, list, clicks, sent, ctx };
  };
  const { menu, list, clicks, sent } = make(true);
  const row = menu.kids.find((k) => k.cls.has('cc-acct-tools'));
  ok('a row of icons goes in above the menu entries', !!row && menu.kids.indexOf(row) === menu.kids.indexOf(list) - 1);
  ok('one per icon the person shows, none for a switched-off one', !!row && row.kids.map((b) => b.attrs['aria-label']).join() === 'Terminal,Protokoll');
  ok('each named for screen readers and in a bubble', !!row && row.kids.every((b) => b.attrs['aria-label'] && b.attrs['data-cc-tip'] === b.attrs['aria-label']));
  ok('the glyph comes along without the colour forced on it', !!row && row.kids[0].kids[0].attrs.class === 'icon-u-log system' && !('style' in row.kids[0].kids[0].attrs));
  ok('with the icon\'s palette slot for the hover', !!row && row.kids[0].props['--cc-rb-c'] === '#ff8800' && !row.kids[1].props['--cc-rb-c']);
  if (row) row.kids[1].listeners.click[0]({ preventDefault() {}, stopPropagation() {} });
  ok('a press closes the menu and presses the hidden original', sent.join() === 'Escape' && clicks.join() === 'Protokoll');
  const again = make(true);
  again.ctx.ccAcctTools(again.menu);
  ok('a second pass over the same menu adds no second row', again.menu.kids.filter((k) => k.cls.has('cc-acct-tools')).length === 1);
  ok('above phone width the menu stays as it is', make(false).menu.kids.length === 2);
}

console.log('\nThe user list');
{
  ok('/Users gets the settings page treatment of /Settings/Users', /var usersPg = \/\^\\\/Users\(\\\/\|\$\)\/\.test\(p0\);/.test(header) && header.includes('|| usersPg ||'));
  ok('its page title goes, the section titles stay', css.includes('html.cc-userlist #displaybox div.title:has(+ div#title.title) { display: none !important; }'));
  ok('adding a user floats in the bottom right corner', css.includes('form[action$="/UserAdd"] input[type="submit"] {\n  position: fixed; right: 24px; bottom: 24px;'));
  ok('one step taller, the key button', /form\[action\$="\/UserAdd"\] input\[type="submit"\] \{[^}]*height: 40px !important;/.test(css));
  ok('and the list keeps room below it', css.includes('html.cc-userlist #displaybox { padding-bottom: 96px; }'));
  ok('Fertig rests grey as the secondary action', /form\[action\$="\/UserAdd"\] input\[type="button"\]:not\(:hover\) \{\s*background: rgba\(128, 128, 128, \.18\) !important;/.test(css));
}

console.log('\nA settings tile without its badge');
{
  const sg = read('sheets/TowerTorch.SettingsGrid.css');
  const val = (e, prop) => { const c = candidates('every', Object.assign({ attrs: {}, states: {}, html: ['cc-popups-on', 'cc-settingsgrid-heads-on', 'cc-settingsgrid-tint'] }, e), prop); return c.length ? c[c.length - 1].value : null; };
  const tile = { tag: 'a', classes: [], inside: ['#displaybox', '.Panel'] };
  ok('its name is neutral ink, not a blue link', val(tile, 'color') === 'var(--cc-text-chip, #cfcfcf)' && val(tile, 'text-decoration') === 'none');
  ok('the whole tile fills one step up under the pointer', val(Object.assign({}, tile, { states: { hover: true } }), 'background') === 'var(--cc-hover-wash, rgba(128, 128, 128, .18))');
  ok('keyboard focus is the accent halo', /0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)/.test(val(Object.assign({}, tile, { states: { 'focus-visible': true } }), 'box-shadow') || ''));
  ok('with the badges on, the halo sits around the badge', sg.includes('html.cc-settingsgrid-on #displaybox .Panel > a:focus-visible > span,'));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
