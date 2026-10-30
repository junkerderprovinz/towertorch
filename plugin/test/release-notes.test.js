// The Version card opens the running version's release notes in one window, "Neu in x.y.z",
// from a button that stands before the update check, so the check stays the last step. The notes
// are GitHub Markdown built from elements and text nodes: a release body can never inject markup,
// and a link becomes an anchor only for http or https. The release page link opens the foot and
// Close ends it.
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

let active = null;
class N {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.parentNode = null; this.cls = new Set(); this.attrs = {}; this.listeners = {}; this._text = ''; }
  get classList() { const c = this.cls; return { add: (...a) => a.forEach((x) => c.add(x)), remove: (...a) => a.forEach((x) => c.delete(x)), contains: (x) => c.has(x) }; }
  get className() { return [...this.cls].join(' '); }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.childNodes.length ? this.childNodes.map((c) => c.textContent).join('') : this._text; }
  set textContent(v) { this._text = String(v); this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; }
  set href(v) { this.attrs.href = String(v); } get href() { return this.attrs.href || ''; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() { (this.listeners.click || []).slice().forEach((fn) => fn({ type: 'click', target: this })); }
  focus() { active = this; }
  all() { const out = []; const walk = (n) => n.childNodes.forEach((c) => { out.push(c); walk(c); }); walk(this); return out; }
  byClass(c) { return this.all().filter((n) => n.cls && n.cls.has(c)); }
  byTag(t) { return this.all().filter((n) => n.tagName === t.toUpperCase()); }
}
class Text { constructor(t) { this.tagName = '#TEXT'; this.textContent = String(t); this.childNodes = []; this.parentNode = null; } }
const body = new N('body');
const document = { body, createElement: (t) => new N(t), createTextNode: (t) => new Text(t) };

const consts = ['REPO', 'LATEST_API', 'RELEASES_API'].map((n) => {
  const m = new RegExp('  var ' + n + ' = [^;]+;').exec(settings);
  if (!m) throw new Error('const not found: ' + n);
  return m[0];
}).join('\n');
const fns = ['el', 'labelled', 'notesSource', 'openReleaseNotes', 'notesInline', 'notesDom'].map((n) => grabFn(settings, n)).join('\n');
function load(ver, fetch, theme) {
  return new Function('document', 'window', 'fetch', 'CC_VER', 'T', consts + '\n' + fns + '\nreturn { notesSource: notesSource, open: openReleaseNotes, dom: notesDom };')(
    document, { CCTheme: theme }, fetch, ver, (d) => d);
}
const tick = () => new Promise((r) => setTimeout(r, 0));

console.log('\nThe Version card offers the notes before the update check');
{
  const block = settings.slice(settings.indexOf('// The Info tab in GlimStone'), settings.indexOf('var cHelp ='));
  ok('a "Versionshinweise" button with the What\'s new glyph opens the window', /labelled\(actionBtn\("", "cc-btn cc-set-xbtn cc-set-notes", function \(\) \{ openReleaseNotes\(notes\); \}\), "WhatsNew", T\("Versionshinweise", "Release notes"\)\)/.test(block));
  ok('it stands before "Nach Updates suchen", which stays last', /crow\.appendChild\(notes\); crow\.appendChild\(chk\); cVer\.appendChild\(crow\);/.test(block));
  ok('no "New" button, since TowerTorch marks no changes', !/Neu ·|New ·/.test(settings));
}

console.log('\nWhich release the window reads');
{
  const { notesSource } = load('1.0.0');
  const rel = notesSource('1.0.0');
  ok('a release reads its own tag', rel.api === 'https://api.github.com/repos/junkerderprovinz/towertorch/releases/tags/v1.0.0' && rel.ver === '1.0.0', JSON.stringify(rel));
  ok('and links to its own release page', rel.page === 'https://github.com/junkerderprovinz/towertorch/releases/tag/v1.0.0');
  ok('a release candidate reads its own tag', /\/tags\/v1\.1\.0-rc1$/.test(notesSource('v1.1.0-rc1').api));
  const dev = notesSource('dev');
  ok('a dev build reads the latest release', dev.api === 'https://api.github.com/repos/junkerderprovinz/towertorch/releases/latest' && dev.ver === '');
}

console.log('\nA release body becomes elements, never markup');
{
  const { dom } = load('1.0.0');
  const card = new N('div');
  dom([
    'TowerTorch moves on, with **bold words** and `code`.',
    '',
    '## ✨ Added',
    '- **Info tab.** The last tab.',
    '- A second point',
    '  that runs on.',
    '',
    '1. one',
    '2. two',
    '',
    '<script>alert(1)</script> <img src=x onerror=alert(2)>',
    '',
    '[the page](https://example.org/x) and [a trap](javascript:alert(3))',
    '```',
    '<b>raw</b>',
    '```',
  ].join('\n'), card);
  const kids = card.childNodes.map((n) => n.tagName + (n.cls.size ? '.' + [...n.cls].join('.') : ''));
  ok('paragraph, heading, list, numbered list, paragraphs and code in order', kids.join(' ') === 'P DIV.cc-notes-h UL OL P P PRE', kids.join(' '));
  const h = card.byClass('cc-notes-h')[0];
  ok('the heading is a heading for a screen reader', h && h.getAttribute('role') === 'heading' && h.textContent === '✨ Added');
  const lis = card.byTag('ul')[0].byTag('li');
  ok('a list item keeps its bold lead', lis[0].byTag('strong')[0].textContent === 'Info tab.');
  ok('a wrapped line joins its item', lis[1].textContent === 'A second point that runs on.', lis[1].textContent);
  ok('bold and code become their elements', card.byTag('strong').length === 2 && card.byTag('code').some((c) => c.textContent === 'code'));
  ok('tags in the body stay text', card.childNodes[4].textContent === '<script>alert(1)</script> <img src=x onerror=alert(2)>' && !card.byTag('script').length && !card.byTag('img').length);
  const links = card.byTag('a');
  ok('an http link becomes an anchor in a new tab without an opener', links.length === 1 && links[0].href === 'https://example.org/x' && links[0].attrs.target === undefined && links[0].target === '_blank' && links[0].rel === 'noopener noreferrer', JSON.stringify(links.map((a) => a.href)));
  ok('a javascript: link stays text', /a trap/.test(card.childNodes[5].textContent) && !links.some((a) => /javascript/.test(a.href)));
  ok('a fenced block keeps its text as text', card.byTag('pre')[0].textContent === '<b>raw</b>' && !card.byTag('b').length);
  ok('no notes function writes innerHTML', !/innerHTML/.test(['openReleaseNotes', 'notesInline', 'notesDom'].map((n) => grabFn(settings, n)).join('')));
}

console.log('\nThe window');
(async () => {
  let modalOpts = null;
  const theme = {
    pressable: (n) => n, paintWin: () => {},
    modal: (win, o) => { modalOpts = o; o.focus.focus(); return { close: () => win.remove() }; },
  };
  const answer = (status, j) => () => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(j) });
  const opener = new N('span');

  const { open } = load('1.0.0', answer(200, { tag_name: 'v1.0.0', body: '## Added\n- **One.** thing' }), theme);
  open(opener);
  const w = body.byClass('cc-win-notes')[0];
  ok('one window, wide, centred like a question', !!w && w.cls.has('cc-win') && w.cls.has('cc-dlg'));
  ok('titled after the running version', w.byClass('cc-win-title')[0].textContent === 'Neu in 1.0.0');
  ok('it says it is loading until the answer lands', /Lade Versionshinweise/.test(w.byClass('cc-notes')[0].textContent));
  const foot = w.byClass('cc-win-act')[0].childNodes;
  ok('the release page link is the only action in the foot', foot[0].tagName === 'A' && foot[0].cls.has('cc-win-link') && foot[0].href === 'https://github.com/junkerderprovinz/towertorch/releases/tag/v1.0.0' && foot[0].rel === 'noopener noreferrer');
  ok('the foot holds no Close, the modal puts its close badge in the corner', foot.length === 1 && !foot.some((n) => /Schließen/.test(n.textContent)));
  ok('the window is modal, opened from the button, with the notes focused', modalOpts.opener === opener && active === w.byClass('cc-notes')[0]);
  ok('the notes take focus from the keyboard, so long notes scroll without a mouse', w.byClass('cc-notes')[0].getAttribute('tabindex') === '0');
  await tick(); await tick();
  ok('the notes replace the loading line', w.byClass('cc-notes-h')[0].textContent === 'Added' && w.byTag('strong')[0].textContent === 'One.' && !/Lade/.test(w.byClass('cc-notes')[0].textContent));
  w.remove();

  const missing = load('1.1.0-rc1', answer(404, {}), theme);
  missing.open(opener);
  const w2 = body.byClass('cc-win-notes')[0];
  await tick(); await tick();
  ok('a version without a release on GitHub says so', w2.byClass('cc-notes')[0].textContent === 'Zu dieser Version gibt es auf GitHub noch keine Versionshinweise.', w2.byClass('cc-notes')[0].textContent);
  w2.remove();

  const dev = load('dev', answer(200, { tag_name: 'v1.0.0', body: 'Text' }), theme);
  dev.open(opener);
  const w3 = body.byClass('cc-win-notes')[0];
  ok('a dev build opens on a neutral title', w3.byClass('cc-win-title')[0].textContent === 'Versionshinweise');
  await tick(); await tick();
  ok('and takes the title and the link from the latest release', w3.byClass('cc-win-title')[0].textContent === 'Neu in 1.0.0' && w3.byClass('cc-win-link')[0].href === 'https://github.com/junkerderprovinz/towertorch/releases/tag/v1.0.0');
  w3.remove();

  const down = load('1.0.0', () => Promise.reject(new Error('offline')), theme);
  down.open(opener);
  const w4 = body.byClass('cc-win-notes')[0];
  await tick(); await tick();
  ok('a failed fetch says so and points to GitHub', /ließen sich nicht laden/.test(w4.byClass('cc-notes')[0].textContent));
  w4.remove();

  const empty = load('1.0.0', answer(200, { tag_name: 'v1.0.0', body: '  ' }), theme);
  empty.open(opener);
  const w5 = body.byClass('cc-win-notes')[0];
  await tick(); await tick();
  ok('an empty body says there are no notes', w5.byClass('cc-notes')[0].textContent === 'Zu dieser Version gibt es keine Versionshinweise.');

  console.log('\nThe sheet');
  const style = settings.slice(settings.indexOf('st.textContent ='), settings.indexOf('document.head.appendChild(st);'));
  ok('the window is wider than a question', /\.cc-dlg\.cc-win-notes\{width:min\(760px,calc\(100vw - 32px\)\)/.test(style));
  ok('its links leave Unraid\'s underline and colour behind', /html \.cc-win-notes \.cc-notes a,html \.cc-win-notes \.cc-notes a:visited\{color:var\(--cc-accent-ink\);text-decoration:none/.test(style));
  const { candidates, withUnraid } = require('./cascade');
  const page = withUnraid('settings').concat(['styles/docker.css']);
  const focused = [
    ['the notes card', { tag: 'div', classes: ['cc-win-card', 'cc-notes'], attrs: { tabindex: '0' }, inside: ['.cc-win', '.cc-win-notes'], html: ['cc-shares-on'], states: { 'focus-visible': true, focus: true } }],
    ['a link in the notes', { tag: 'a', classes: [], attrs: { href: 'https://example.org/' }, inside: ['.cc-win', '.cc-win-notes', '.cc-notes'], html: ['cc-shares-on'], states: { 'focus-visible': true, focus: true } }],
  ];
  for (const [name, e] of focused) {
    const halo = candidates(page, e, 'box-shadow').pop();
    ok(name + ' gets the focus halo past the blanket no-ring rules', halo && /^0 0 0 3px color-mix\(in srgb,var\(--cc-accent,#FCC419\) 45%,transparent\)$/.test(halo.value), halo && halo.selector + ' ' + halo.value);
  }
  ok('the release page link, the one action, stands at the end like every forward action', !/\.cc-win-link\{margin-inline-end:auto\}/.test(style));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
