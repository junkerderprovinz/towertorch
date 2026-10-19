// The Apps sidebar: the search field on top, CA's entries grouped under eyebrow headings, one
// 30px row shape for every entry and the version on the last line. CA's own sheet competes
// with every rule here, so the rules are checked against CA's selectors, and CA shows and hides
// some entries through inline display, which no CC rule may override. The script half adds the
// headings, the version marks and keyboard access without moving any CA entry.
const fs = require('fs');
const path = require('path');
const { DIR, PAGES, candidates, parseRules } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// CA's own rules for the sidebar, from community.applications.css. Its stylesheet links sit in
// the page body, after CC's sheets in <head>, so it is listed last and wins every tie.
const CA = { name: 'community.applications.css', css: `
ul.caMenu { list-style-type: none; margin: 0 0 20px 0; padding: 0; font-size: 1.5rem; }
li.caMenuItem { padding: 0 0 5px 0; width: fit-content; }
.caMenuItem:hover { color: var(--unraid-66-color); }
.selectedMenu { color: var(--unraid-66-color); font-weight: bold; }
.caMenuDisabled { cursor: default; opacity: 0.5; }
.caMenuDisabled:hover { color: inherit !important; }
.caMenuEnabled { cursor: pointer; opacity: 1; }
li.subCategory { margin-top: -0.5rem; }
.subCategory ul { padding-left: 20px; }
.actionCentre { display: none; }
.caButton { display: inline-block; margin-right: 1rem; padding: 1px 10px; font-size: 1.2rem; line-height: 2rem; color: var(--support-popup-text) !important; border-radius: 15px; }
.caButton:hover { background: var(--unraid-66-color); color: var(--ca-white-color) !important; }
.maxPerPage { display: block; top: 0.5rem; font-size: 1rem; }
.dockerSearch { display: inline-block; cursor: pointer; color: var(--unraid-66-color); margin-bottom: 1rem; }
` };
const PAGE = PAGES.every.concat([CA]);
const HTML = ['cc-popups-on', 'Theme--black'];
// An element lists what its :has() may match, so an entry without a link inside is not taken for
// Support.
const win = (el, prop) => { const all = candidates(PAGE, Object.assign({ attrs: {}, states: {}, html: HTML, has: [] }, el), prop); return all[all.length - 1]; };
const val = (el, prop) => { const w = win(el, prop); return w ? w.value.trim() : ''; };
// The moved CA buttons share classes with buttons in CA's search area, bulk bar, cards and info
// drawer, whose rules the cascade would otherwise count as possible ancestors.
const OUT = ['.searchArea', '.multi_installDiv', '.popupInfo', '.ca_bottomLine'];
const IN_CATS = ['.menuItems', '#category_list', '.caMenu'];
// CA marks every entry either caMenuEnabled or caMenuDisabled, never both.
const row = (classes, states, inside) => ({ tag: 'li', classes: classes.concat(['caMenuItem'], classes.includes('caMenuDisabled') ? [] : ['caMenuEnabled']), states: states || {}, inside: inside || IN_CATS });

console.log('\nEvery entry is one 30px row in the body size, over CA\'s own sizes');
for (const [name, el] of [
  ['a category', row(['categoryMenu'])],
  ['Installed apps', row(['sectionMenu', 'onlyShowWithFeed'], {}, ['.menuItems', '.caMenu'])],
  ['a sub-entry', { tag: 'ul', classes: ['categoryMenu', 'caMenuItem'], inside: ['.subCategory', '.menuItems'] }],
  ['results per page', { tag: 'div', id: 'maxPerPage', classes: ['caButton', 'maxPerPage'], inside: ['.cc-ca-perpage-li', '.menuItems'], outside: OUT }],
  ['Docker Hub', { tag: 'div', classes: ['dockerSearch', 'caButton'], inside: ['.cc-ca-search-extras', '.menuItems'], outside: OUT }],
]) {
  ok(`${name}: 30px high`, val(el, 'height') === '30px', val(el, 'height'));
  ok(`${name}: body size`, val(el, 'font-size') === 'var(--cc-text-body)', val(el, 'font-size'));
  ok(`${name}: no fill at rest`, val(el, 'background') === 'transparent', val(el, 'background'));
  ok(`${name}: the column's full width`, val(el, 'width') === '100%', val(el, 'width'));
  ok(`${name}: sentence case kept`, val(el, 'text-transform') === 'none', val(el, 'text-transform'));
  ok(`${name}: no border`, val(el, 'border') === 'none', val(el, 'border'));
}
ok('CA\'s nudge on results per page is undone', val({ tag: 'div', classes: ['caButton', 'maxPerPage'], inside: ['.cc-ca-perpage-li'] }, 'top') === '0');
ok('a sub-entry sits a step in', val({ tag: 'ul', classes: ['caMenuItem'], inside: ['.subCategory'] }, 'padding-left') === '24px');

console.log('\nHover steps toward the text, the open entry takes the colour mode');
{
  const hover = row(['categoryMenu'], { hover: true });
  ok('hover lays the text wash over the row', val(hover, 'background') === 'var(--cc-hover-wash)', val(hover, 'background'));
  ok('hover lifts the ink to the text colour', /^var\(--cc-text,/.test(val(hover, 'color')), val(hover, 'color'));
  const open = row(['categoryMenu', 'selectedMenu']);
  ok('the open entry is filled with the stamped colour', /^var\(--cc-rb-c, var\(--cc-accent/.test(val(open, 'background')), val(open, 'background'));
  ok('with the ink picked for that fill', /^var\(--cc-rb-ct, var\(--cc-accent-text/.test(val(open, 'color')), val(open, 'color'));
  ok('in the same weight as every other row, not CA\'s bold', val(open, 'font-weight') === '400', val(open, 'font-weight'));
  const openHover = row(['categoryMenu', 'selectedMenu'], { hover: true });
  ok('the open entry answers hover with a colour step', /^color-mix\(in srgb, var\(--cc-rb-c/.test(val(openHover, 'background')), val(openHover, 'background'));
  const reactive = Object.assign(row(['categoryMenu', 'selectedMenu']), { html: HTML.concat(['cc-apps-rbneutral']) });
  ok('the reactive mode still fills the open entry', /^var\(--cc-rb-c/.test(val(reactive, 'background')), val(reactive, 'background'));
  const light = Object.assign(row(['categoryMenu']), { html: ['cc-popups-on', 'Theme--white'] });
  ok('the white theme reads the same tokens', /^var\(--cc-text-chip/.test(val(light, 'color')), val(light, 'color'));
  // CA's start view marks nothing when its startup cookie says "onlynew", which no entry carries.
  const home = row(['startupButton', 'cc-ca-home']);
  ok('Start is filled like an open entry while the start view shows', /^var\(--cc-rb-c, var\(--cc-accent/.test(val(home, 'background')) && /^var\(--cc-rb-ct/.test(val(home, 'color')), val(home, 'background'));
  ok('and answers hover with the same colour step', /^color-mix\(in srgb, var\(--cc-rb-c/.test(val(row(['startupButton', 'cc-ca-home'], { hover: true }), 'background')));
  const hdr = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
  ok('the mark follows the start view and steps aside for any entry CA marks itself', /home\.classList\.toggle\("cc-ca-home", !document\.querySelector\("\.caMenuItem\.selectedMenu"\) && !!document\.querySelector\("\.ca_homeTemplatesHeader"\)\)/.test(hdr));
  ok('and takes the stamped colour', /ccAppsStamp\("\.caMenuItem\.selectedMenu, li\.cc-ca-home"\)/.test(hdr));
}

console.log('\nA disabled entry is dimmed by colour and ignores the pointer');
{
  const off = row(['caPinnedMenu', 'sectionMenu', 'caMenuDisabled']);
  ok('dim ink', /^var\(--cc-text-dim2/.test(val(off, 'color')), val(off, 'color'));
  ok('no opacity on the row', val(off, 'opacity') === '1', val(off, 'opacity'));
  ok('no hover wash', val(Object.assign(off, { states: { hover: true } }), 'background') === 'transparent');
}

console.log('\nKeyboard focus is the accent halo, never a ring');
for (const [name, el] of [['a row', row(['categoryMenu'], { focus: true, 'focus-visible': true })], ['the open entry', row(['allApps', 'selectedMenu'], { focus: true, 'focus-visible': true })]]) {
  ok(`${name}: halo`, /^0 0 0 3px color-mix\(in srgb, var\(--cc-accent, #FCC419\) 45%, transparent\)$/.test(val(el, 'box-shadow')), val(el, 'box-shadow'));
  ok(`${name}: no outline`, val(el, 'outline') === 'none', val(el, 'outline'));
}

console.log('\nCA keeps showing and hiding its own entries');
{
  const ac = win(row(['sectionMenu', 'actionCentre'], {}, ['.menuItems', '.caMenu']), 'display');
  ok('nothing in CC sets display on the Action Centre, so CA\'s none and its inline show decide', ac && ac.sheet === CA.name && ac.value === 'none', ac && (ac.sheet + ' ' + ac.selector));
  const sub = win({ tag: 'li', classes: ['subCategory', 'onlyShowWithFeed'], inside: IN_CATS }, 'display');
  ok('nothing in CC sets display on a sub-list', !sub, sub && (sub.sheet + ' ' + sub.selector));
  const dh = win({ tag: 'div', classes: ['dockerSearch', 'caButton', 'ca_hide'], inside: ['.cc-ca-search-extras'], outside: OUT }, 'display');
  ok('Docker Hub keeps CA\'s own visibility', dh && dh.sheet === CA.name, dh && (dh.sheet + ' ' + dh.selector));
  // A spacer <li> has no class to key the cascade on, so its rule is read directly.
  const spacer = parseRules(fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8')).find((r) => /> li:has\(> hr\)$/.test(r.selector.trim()));
  ok('the rule spacers are taken out', !!spacer && spacer.decls.some((d) => d.prop === 'display' && d.value === 'none' && d.important), spacer && spacer.selector);
}

console.log('\nThe lists step out of the box tree and the column orders the groups');
{
  ok('the column is a wrapping flex row', val({ tag: 'div', classes: ['menuItems', 'menuAdjust'], inside: ['.ca_display_area'] }, 'display') === 'flex');
  ok('CA\'s lists take no box of their own', val({ tag: 'ul', classes: ['caMenu'], inside: ['.menuItems'] }, 'display') === 'contents');
  ok('nor does the category span', val({ tag: 'span', id: 'category_list', classes: ['onlyShowWithFeed'], inside: ['.menuItems'] }, 'display') === 'contents');
  const seq = [
    ['the search field', { tag: 'li', id: 'cc-ca-search-li', classes: ['cc-ca-search-li'] }],
    ['Discover', { tag: 'li', classes: ['cc-ca-eyebrow'], attrs: { 'data-cc-group': 'discover' } }],
    ['Start', row(['startupButton'])],
    ['All apps', row(['categoryMenu', 'allApps'])],
    ['Action Centre', row(['sectionMenu', 'actionCentre'])],
    ['Repositories', row(['categoryMenu', 'caRepositoryMenu'])],
    ['My apps', { tag: 'li', classes: ['cc-ca-eyebrow'], attrs: { 'data-cc-group': 'mine' } }],
    ['Categories', { tag: 'li', classes: ['cc-ca-eyebrow'], attrs: { 'data-cc-group': 'categories' } }],
    ['Community Apps', { tag: 'li', classes: ['cc-ca-eyebrow'], attrs: { 'data-cc-group': 'ca' } }],
    ['results per page', { tag: 'li', classes: ['cc-ca-perpage-li'] }],
    ['Statistics', row(['showStatistics', 'noSelect'])],
    ['Change log', row(['caChangeLog', 'noSelect'])],
    ['Debugging', row(['debugging', 'noSelect'])],
    ['Support', Object.assign(row([]), { has: ['> a'] })],
    ['Credits', row(['showCredits', 'noSelect'])],
    ['the version label', { tag: 'li', classes: ['cc-ca-ver-label'] }],
    ['the version number', { tag: 'li', classes: ['cc-ca-ver-num'] }],
  ].map(([n, el]) => [n, parseFloat(val(Object.assign({ inside: IN_CATS }, el), 'order'))]);
  const bad = seq.filter((s, i) => isNaN(s[1]) || (i && s[1] <= seq[i - 1][1]));
  ok('top to bottom: search, Discover, My apps, Categories, Community Apps, version', !bad.length, seq.map((s) => s[0] + '=' + s[1]).join(' '));
  ok('the version shares the last line, the label taking the room', val({ tag: 'li', classes: ['cc-ca-ver-label'], inside: IN_CATS }, 'flex') === '1 1 0');
  ok('and the number its own width', val({ tag: 'li', classes: ['cc-ca-ver-num'], inside: IN_CATS }, 'flex') === '0 0 auto');
}

console.log('\nEach group stands on a card under a section badge');
{
  const eb = { tag: 'li', classes: ['cc-ca-eyebrow'], attrs: { 'data-cc-group': 'mine' }, inside: IN_CATS };
  ok('no pointer on the heading', val(eb, 'cursor') === 'default');
  const badge = { tag: 'span', classes: [], inside: ['.cc-ca-eyebrow'].concat(IN_CATS) };
  ok('the badge is filled with the stamped colour', /^var\(--cc-rb-c, var\(--cc-accent/.test(val(badge, 'background')), val(badge, 'background'));
  ok('with the ink picked for that fill', /^var\(--cc-rb-ct, var\(--cc-accent-text/.test(val(badge, 'color')), val(badge, 'color'));
  ok('at the section badge height', val(badge, 'height') === 'var(--cc-sec-h, 22px)', val(badge, 'height'));
  ok('in the section badge type', val(badge, 'font-size') === 'var(--cc-sec-fs)' && val(badge, 'text-transform') === 'uppercase');
  ok('as a pill', val(badge, 'border-radius') === 'var(--cc-radius-pill)');
  const card = { tag: 'div', classes: ['cc-ca-card'], inside: ['.cc-ca-eyebrow'].concat(IN_CATS) };
  ok('the card lies under the rows', val(card, 'position') === 'absolute' && val(card, 'z-index') === '-1' && val(card, 'pointer-events') === 'none');
  ok('on the surface and radius of the app cards beside it', /^var\(--cc-surface-1/.test(val(card, 'background')) && val(card, 'border-radius') === 'var(--cc-radius-card)', val(card, 'background'));
  ok('a card with rows is drawn', val(card, 'display') === 'block');
  ok('a card without rows to hold is not', val(Object.assign({}, card, { attrs: { hidden: '' } }), 'display') === 'none');
  ok('without CC\'s pop-ups a leftover card stays out of the column', val(Object.assign({}, card, { html: ['Theme--black'] }), 'display') === 'none');
  const column = { tag: 'div', classes: ['menuItems', 'menuAdjust'], inside: ['.ca_display_area'] };
  ok('the column holds the cards in a stacking context of its own', val(column, 'isolation') === 'isolate' && val(column, 'position') === 'relative');
  ok('its side padding is the cards\' inset', val(column, 'padding') === '0 8px 8px');
  ok('the search field spans the full card width over it', val({ tag: 'li', id: 'cc-ca-search-li', classes: ['cc-ca-search-li'], inside: IN_CATS }, 'margin') === '0 -8px');
}

console.log('\nThe Action Centre carries a dot, not a green fill');
{
  const ac = row(['sectionMenu', 'actionCentre'], {}, ['.menuItems', '.caMenu']);
  ok('no fill while it is not the open entry', val(ac, 'background') === 'transparent', val(ac, 'background'));
  ok('the row\'s case, not capitals', val(ac, 'text-transform') === 'none');
  const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');
  ok('a dot in the entry\'s colour', /li\.caMenuItem\.actionCentre::after \{[^}]*background: var\(--cc-rb-c, var\(--cc-accent, #FCC419\)\) !important;/.test(tokens));
  ok('in its ink while the entry is open', /li\.caMenuItem\.actionCentre\.selectedMenu::after \{ background: var\(--cc-rb-ct/.test(tokens));
  ok('grey at rest in the reactive mode', /html\.cc-apps-rbneutral\.cc-popups-on li\.caMenuItem\.actionCentre:not\(\.selectedMenu\):not\(:hover\)::after \{ background: var\(--cc-text-dim/.test(tokens));
}

// A small DOM for the script half: elements with classes, attributes and children, and a
// selector matcher for the shapes header.js uses (tag, class, id, attribute, :scope, child and
// descendant combinators, :first-child and :last-child, comma lists).
class El {
  constructor(tag, cls, attrs, kids, top) {
    this.tagName = tag.toUpperCase(); this.attrs = Object.assign({}, attrs || {}); this.children = []; this.parentElement = null;
    this.classList = { list: (cls || '').split(' ').filter(Boolean), el: this,
      contains(c) { return this.list.includes(c); }, add(c) { if (!this.list.includes(c)) this.list.push(c); }, remove(c) { this.list = this.list.filter((x) => x !== c); } };
    this.text = ''; this.top = top == null ? 0 : top; this.hidden = false; this.listeners = {}; this.clicks = 0;
    (kids || []).forEach((k) => (typeof k === 'string' ? (this.text = k) : this.appendChild(k)));
  }
  get id() { return this.attrs.id || ''; }
  get className() { return this.classList.list.join(' '); }
  set className(v) { this.classList.list = String(v).split(' ').filter(Boolean); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.text = v; this.children = []; }
  get nextElementSibling() { const s = this.parentElement && this.parentElement.children; return s ? s[s.indexOf(this) + 1] || null : null; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) { if (c.parentElement) c.parentElement.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = this; const i = ref ? this.children.indexOf(ref) : -1; i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c; }
  getClientRects() { let e = this; while (e) { if (e.hidden) return []; e = e.parentElement; } return [1]; }
  getBoundingClientRect() { const h = this.h || 0; return { top: this.top, bottom: this.top + h, height: h }; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { this.clicks++; }
  focus() { this.ownerDoc.activeElement = this; (this.ownerDoc.root.listeners.focusin || []).forEach((f) => f({ target: this })); }
  all() { return this.children.flatMap((c) => [c].concat(c.all())); }
  closest(sel) { let e = this; while (e && !matches(e, sel)) e = e.parentElement; return e; }
  querySelectorAll(sel) { return this.all().filter((e) => sel.split(',').some((s) => matchesFrom(e, s.trim(), this))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function compound(e, c) {
  const re = /([a-z]+)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)="([^"]*)"\]|:(first-child|last-child|scope)/gi; let m;
  while ((m = re.exec(c))) {
    if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
    if (m[2] && !e.classList.contains(m[2])) return false;
    if (m[3] && e.id !== m[3]) return false;
    if (m[4] && e.getAttribute(m[4]) !== m[5]) return false;
    if (m[6] === 'first-child' && e.parentElement.children[0] !== e) return false;
    if (m[6] === 'last-child' && e.parentElement.children[e.parentElement.children.length - 1] !== e) return false;
  }
  return true;
}
function matchesFrom(e, sel, scope) {
  const parts = sel.replace(/\s*>\s*/g, ' > ').split(/\s+/);
  function back(el, i) {
    if (!compound(el, parts[i])) return false;
    if (i === 0) return parts[0] === ':scope' ? el === scope : true;
    if (parts[i - 1] === '>') return parts[i - 2] === ':scope' ? el.parentElement === scope && i - 2 === 0 : !!el.parentElement && back(el.parentElement, i - 2);
    for (let a = el.parentElement; a; a = a.parentElement) if (back(a, i - 1)) return true;
    return false;
  }
  if (parts[0] === ':scope' && parts[1] === '>') return e.parentElement === scope && parts.length === 3 && compound(e, parts[2]);
  return back(e, parts.length - 1);
}
function matches(e, sel) { return matchesFrom(e, sel, null); }

const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const fnSrc = (name) => { const i = header.indexOf('function ' + name + '('); return header.slice(i, header.indexOf('\n  }\n', i) + 4); };

function sidebar() {
  const li = (cls, text, top, attrs) => new El('li', cls, attrs, [text], top);
  const main = new El('ul', 'caMenu', {}, [
    li('startupButton caMenuItem caMenuEnabled', 'Start', 100),
    new El('li', '', {}, [new El('hr')]),
    li('caMenuItem sectionMenu caMenuEnabled', 'Installierte Apps', 300),
    new El('li', 'subCategory', {}, [new El('ul', 'caMenuItem sectionMenu', {}, ['Docker'], 310)]),
    li('caMenuItem sectionMenu actionCentre caMenuEnabled', 'Aktionszentrale', 150),
  ]);
  main.children[3].hidden = true;
  const cats = new El('ul', 'caMenu', {}, [li('categoryMenu caMenuItem caMenuEnabled', 'AI', 400), li('categoryMenu caMenuItem caMenuEnabled selectedMenu', 'Cloud', 410)]);
  const meta = new El('ul', 'caMenu', {}, [
    li('categoryMenu caMenuItem allApps caMenuEnabled', 'Alle Apps', 120),
    li('caMenuItem caMenuEnabled', 'Einstellungen', 500, { onclick: 'window.location="/Apps/ca_settings"' }),
    new El('li', 'caMenuItem caMenuEnabled', {}, [new El('a', 'caMenuItem caMenuEnabled', { href: 'https://forums.unraid.net/' }, ['Support'], 520)]),
    new El('li', '', {}, ['VERSION']),
    new El('li', '', {}, [new El('span', '', { id: 'caInstalledVersion' }, ['2026.07.21'])]),
  ]);
  const menu = new El('div', 'menuItems menuAdjust', {}, [main, new El('span', '', { id: 'category_list' }, [cats]), meta]);
  const root = new El('div', 'ca_display_area', {}, [menu]);
  const doc = { root: menu, activeElement: null, querySelector: (s) => root.querySelector(s), querySelectorAll: (s) => root.querySelectorAll(s), getElementById: (id) => root.querySelector('#' + id) };
  root.all().concat([root]).forEach((e) => { e.ownerDoc = doc; });
  return { doc, menu, main, cats, meta };
}
function run(lang) {
  const s = sidebar();
  const make = new Function('document', 'T', fnSrc('ccEyebrow') + fnSrc('ccAppsGroups') + fnSrc('ccSidebarRows') + '\nreturn ccAppsGroups;');
  const create = (tag) => { const e = new El(tag); e.ownerDoc = s.doc; e.style = {}; return e; };
  s.doc.createElement = create;
  s.groups = make(s.doc, (de, en) => (lang === 'de' ? de : en));
  s.groups();
  return s;
}

console.log('\nThe script adds a heading per group, first in its list');
{
  const s = run('de');
  const heads = (ul) => ul.children.filter((c) => c.classList.contains('cc-ca-eyebrow')).map((c) => c.getAttribute('data-cc-group') + ':' + c.textContent);
  ok('Discover and My apps in CA\'s first list', heads(s.main).sort().join() === 'discover:Entdecken,mine:Meine Apps', heads(s.main).join());
  ok('Categories in the category list', heads(s.cats).join() === 'categories:Kategorien');
  ok('Community Apps in the last list', heads(s.meta).join() === 'ca:Community Apps');
  const firsts = [s.main, s.cats, s.meta].every((ul) => ul.children[0].classList.contains('cc-ca-eyebrow'));
  ok('each heading leads its list, so no CA entry gets one as the sibling its click opens', firsts && !s.menu.all().some((e) => e.classList.contains('caMenuItem') && e.nextElementSibling && e.nextElementSibling.classList.contains('cc-ca-eyebrow')));
  s.groups(); s.groups();
  ok('a repeat pass adds nothing', s.menu.querySelectorAll('li.cc-ca-eyebrow').length === 4, s.menu.querySelectorAll('li.cc-ca-eyebrow').length);
  ok('CA\'s entries keep their place', s.meta.children.filter((c) => c.classList.contains('caMenuItem')).map((c) => c.textContent).join() === 'Alle Apps,Einstellungen,Support');
  ok('English labels in English', run('en').main.children.map((c) => c.textContent).slice(0, 2).sort().join() === 'Discover,My apps');
  ok('the version label is marked', s.meta.children.some((c) => c.classList.contains('cc-ca-ver-label') && c.textContent === 'VERSION'));
  ok('and the number', s.meta.children.some((c) => c.classList.contains('cc-ca-ver-num') && c.querySelector('#caInstalledVersion')));
  ok('every heading carries its badge and its card', s.menu.querySelectorAll('li.cc-ca-eyebrow').every((h) => h.children.length === 2 && h.children[0].tagName === 'SPAN' && h.children[1].classList.contains('cc-ca-card')));
}

console.log('\nA group\'s card runs from its badge to the last row the group shows');
{
  const s = run('de');
  const by = (t) => s.menu.all().find((e) => e.textContent === t && e.classList.contains('caMenuItem'));
  const head = (g) => s.menu.querySelector('li.cc-ca-eyebrow[data-cc-group="' + g + '"]');
  // The column starts at 40 on the screen; a badge is 22 high and a row 30.
  s.menu.top = 40;
  const place = (e, order, top, h) => { e.order = order; e.top = top; e.h = h; };
  place(head('discover'), 10, 50, 22); place(head('discover').children[0], 0, 50, 22);
  place(by('Start'), 11, 80, 30); place(by('Alle Apps'), 12, 112, 30); place(by('Aktionszentrale'), 13, 144, 30);
  place(head('mine'), 20, 210, 22); place(head('mine').children[0], 0, 210, 22);
  by('Installierte Apps').hidden = true;
  [head('categories'), head('ca')].forEach((h) => { h.hidden = true; });
  s.main.children.filter((c) => c.querySelector('hr')).forEach((c) => { c.hidden = true; });
  s.main.children.filter((c) => !c.order && !c.classList.contains('cc-ca-eyebrow')).forEach((c) => { c.order = 21; });
  const cards = new Function('document', 'window', 'getComputedStyle', 'var ccCardRo = null, ccCardMenu = null;\n' + fnSrc('ccAppsCards') + '\nreturn ccAppsCards;')(s.doc, {}, (e) => ({ order: String(e.order || 0) }));
  cards();
  const disc = head('discover').children[1], mine = head('mine').children[1];
  ok('the card\'s top edge runs through the badge\'s centre', disc.style.top === '21px', disc.style.top);
  ok('and ends a card inset under the group\'s last row, though that row sits in another list', disc.style.height === '121px', disc.style.height);
  ok('a group whose rows are all hidden draws no card', mine.hidden === true);
  by('Installierte Apps').hidden = false; place(by('Installierte Apps'), 21, 240, 30);
  cards();
  ok('and draws it again once a row shows', mine.hidden === false && mine.style.height === '57px', mine.style.height);
}

console.log('\nThe rows are one tab stop and the arrows walk them as shown');
{
  const s = run('de');
  const rows = s.menu.all().filter((e) => e.hasAttribute('tabindex'));
  const zero = rows.filter((e) => e.getAttribute('tabindex') === '0').map((e) => e.textContent);
  ok('one row holds the tab stop, the open entry', zero.join() === 'Cloud', zero.join());
  ok('every other row is reached by arrow', rows.filter((e) => e.getAttribute('tabindex') === '-1').length === rows.length - 1);
  ok('a closed sub-list is skipped', !rows.some((e) => e.textContent === 'Docker'));
  ok('Support is reached on its link', rows.some((e) => e.tagName === 'A' && e.textContent === 'Support'));
  ok('the rows are buttons, the link stays a link', rows.every((e) => (e.tagName === 'A') === (e.getAttribute('role') !== 'button')));
  const key = (target, k) => { let prevented = false; s.menu.listeners.keydown.forEach((f) => f({ key: k, target, preventDefault() { prevented = true; } })); return prevented; };
  const by = (t) => rows.find((e) => e.textContent === t);
  by('Start').focus();
  key(by('Start'), 'ArrowDown');
  ok('down from Start goes to All apps, shown next though it sits in another list', s.doc.activeElement === by('Alle Apps'), s.doc.activeElement && s.doc.activeElement.textContent);
  key(s.doc.activeElement, 'ArrowDown');
  ok('then to the Action Centre, last in CA\'s first list', s.doc.activeElement === by('Aktionszentrale'));
  key(s.doc.activeElement, 'End');
  ok('End goes to the last row', s.doc.activeElement === by('Support'));
  key(s.doc.activeElement, 'Home');
  ok('Home goes to the first', s.doc.activeElement === by('Start'));
  ok('the tab stop follows the focus', rows.filter((e) => e.getAttribute('tabindex') === '0').map((e) => e.textContent).join() === 'Start');
  ok('Enter clicks a row through CA\'s handler', key(by('Start'), 'Enter') && by('Start').clicks === 1);
  ok('Space too', key(by('Start'), ' ') && by('Start').clicks === 2);
  ok('Enter on the link is left to the browser', !key(by('Support'), 'Enter') && by('Support').clicks === 0);
}

console.log('\nThe search field leads the sidebar outside CA\'s menu handling');
{
  const wire = fnSrc('wireCaSearch');
  ok('its <li> carries no .caMenuItem', /li\.className = "cc-ca-search-li";/.test(wire) && !/className = "caMenuItem/.test(wire));
  ok('it goes first in CA\'s first list, so the tab order starts there', /caMenu\.insertBefore\(li, caMenu\.firstChild\)/.test(wire));
  ok('keyboard focus opens it', /box\.addEventListener\("focus", function \(\) \{\s*if \(filter\.classList\.contains\("cc-open"\)[^}]*\) return;\s*filter\.classList\.add\("cc-open"\);/.test(wire));
  ok('an empty field closes when the focus leaves', /if \(!box\.value && document\.activeElement !== box[^{]*\{\s*filter\.classList\.remove\("cc-open"\);/.test(wire));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
