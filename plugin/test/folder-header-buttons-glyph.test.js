// The five folder-header buttons carry GlimStone glyphs rather than emoji. An
// emoji ignores CSS color, so it cannot follow the button's own grey at rest and
// accent on hover, and 🗑 renders as a filled grey rectangle on this stack, reading
// as a bordered swatch.
//
// What this pins:
//   1. folderActBtn() builds a <button> holding the glyph cc-theme.js draws, with
//      no text of its own and its title as the accessible name.
//   2. hide-stopped, bulk-start, bulk-stop, rename and delete all call it.
//   3. No action-glyph emoji is left in docker.js's code.
//   4. docker.css sizes the glyph, which takes the button's colour through
//      currentColor.
//   5. The button's own background rules beat Unraid's native button rules, which
//      would otherwise paint a gradient at rest and transparency on hover.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const DOCKER = process.argv[2] || path.join(DIR, 'scripts', 'docker.js');
const CSS = process.argv[3] || path.join(DIR, 'styles', 'docker.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

class CL { constructor() { this.s = new Set(); } add(c) { this.s.add(c); } contains(c) { return this.s.has(c); } }
class N {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.classList = new CL(); this._cls = ''; this._txt = ''; this.attrs = {}; }
  get className() { return this._cls; }
  set className(v) { this._cls = String(v); this.classList.s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._txt; }
  set textContent(v) { this._txt = String(v); this.children = []; }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
}
function el(tag, cls, txt) { const n = new N(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

console.log('\nfolderActBtn(): a glyph button, never raw emoji text');
{
  const fn = new Function('el', 'ccGlyph', grabFn('folderActBtn') + '\nreturn folderActBtn;')(el, (n) => '<glyph ' + n + '>');
  const b = fn('cc-folder-act', 'Eye', 'Hide stopped');
  ok('is a real <button>', b.tagName === 'BUTTON');
  ok('carries the class it was given', b.classList.contains('cc-folder-act'));
  ok('carries the title/tooltip it was given', b.title === 'Hide stopped');
  ok('its title is its accessible name too', b.getAttribute('aria-label') === 'Hide stopped');
  ok('has no text of its own, the glyph being the only content', b._txt === '');
  ok('holds the glyph cc-theme.js draws for the name it was given', b.innerHTML === '<glyph Eye>', b.innerHTML);
}

console.log('\nEvery folder-header button calls folderActBtn()');
{
  ok('hide-stopped button: an open eye, a crossed one while stopped containers are hidden', /var hsBtn = folderActBtn\("cc-folder-act" \+ \(hsOn \? " cc-folder-act-on" : ""\), hsOn \? "EyeOff" : "Eye", t\("hideStopped"\)\);/.test(src));
  ok('start, stop and restart all: Play, Stop and Retry through folderActBtn()', /\[\["Play", "bulkStartAll", "start"\], \["Stop", "bulkStopAll", "stop"\], \["Retry", "bulkRestartAll", "restart"\]\]\.forEach\(function \(b\) \{\s*var btn = folderActBtn\("cc-folder-act", b\[0\], t\(b\[1\]\)\);/.test(src));
  ok('update all button: folderActBtn(..., "Update", t("bulkUpdateAll"))', /var updBtn = folderActBtn\("cc-folder-act", "Update", t\("bulkUpdateAll"\)\);/.test(src));
  ok('edit button: folderActBtn(..., "Pencil", t("editFolder"))', /var editBtn = folderActBtn\("cc-folder-act", "Pencil", t\("editFolder"\)\);/.test(src));
  ok('delete button: folderActBtn(..., "Trash", t("deleteFolder"))', /var delBtn = folderActBtn\("cc-folder-act", "Trash", t\("deleteFolder"\)\);/.test(src));
}

console.log('\nNo action-glyph emoji is left in docker.js\'s code');
{
  // The comments are blanked out first, since docker.js may quote a retired glyph
  // in one. 📁 belongs to the move-to-folder button and stays as it is.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, m => m.replace(/[^\n]/g, ' '))).join('\n');
  ['👁', '▶', '■', '✎', '🗑'].forEach(glyph => {
    ok('"' + glyph + '" appears in no code line of docker.js', code.indexOf(glyph) < 0);
  });
}

console.log('\ndocker.css: the glyph is sized, and no Font Awesome rule is left behind');
{
  const m = css.match(/\.cc-folder-act \.cc-glyph\s*\{([^}]*)\}/);
  ok('a .cc-folder-act .cc-glyph rule exists', !!m);
  const body = m ? m[1] : '';
  ok('it sets the meta size on the scale', /font-size:\s*var\(--cc-text-meta\)/.test(body), body);
  ok('no .cc-folder-act i.fa rule is left', !/\.cc-folder-act i\.fa/.test(css));
}

console.log('\nThe resting background beats Unraid\'s native button gradient');
{
  // Unraid's own `button:where(:not(.unapi *))` in default-base.css paints a
  // four-layer edge gradient. Its :where() wrapper gives it zero specificity, yet
  // a plain `background: transparent` on a class selector still loses to it, so
  // the declaration needs !important. .cc-hgear has carried it all along.
  const folderAct = css.match(/\.cc-folder-act\s*\{([^}]*)\}/);
  const moveBtn = css.match(/\.cc-card-movebtn\s*\{([^}]*)\}/);
  ok('.cc-folder-act rule exists', !!folderAct);
  ok('.cc-card-movebtn rule exists', !!moveBtn);
  const faBody = folderAct ? folderAct[1] : '';
  const mbBody = moveBtn ? moveBtn[1] : '';
  ok('.cc-folder-act: background transparent !important', /background:\s*transparent\s*!important/.test(faBody), faBody);
  ok('.cc-card-movebtn: background transparent !important', /background:\s*transparent\s*!important/.test(mbBody), mbBody);
  // box-shadow and border are a separate matter, pinned so a later edit cannot
  // weaken them while reaching for the background again.
  ok('.cc-folder-act: box-shadow none !important', /box-shadow:\s*none\s*!important/.test(faBody));
  ok('.cc-card-movebtn: box-shadow none !important', /box-shadow:\s*none\s*!important/.test(mbBody));
}

console.log('\nThe hover and active backgrounds are not shadowed by the base rule');
{
  // Two rules have to be beaten, so :hover and .cc-folder-act-on carry !important
  // of their own. The base rule's `transparent !important` outranks a plain hover
  // rule whatever its specificity, and default-base.css's
  // `button[type="button"]:where(:not(.unapi *))` has attribute specificity (0,1,1),
  // above a single class selector such as .cc-folder-act-on's (0,1,0), so it forces
  // the background back to transparent on specificity alone. :hover escapes the
  // second one at (0,2,0) but not the first.
  //
  // With all of them at the same priority, specificity and source order settle the
  // rest: :hover outranks the base rule by its pseudo-class, while
  // .cc-folder-act-on ties with .cc-folder-act and has to come after it.
  var faIdx = css.indexOf('.cc-folder-act {');
  var faOnIdx = css.indexOf('.cc-folder-act-on {');
  var mbIdx = css.indexOf('.cc-card-movebtn {');
  var faHoverIdx = css.indexOf('.cc-folder-act:hover {');
  var mbHoverIdx = css.indexOf('.cc-card-movebtn:hover {');
  ok('the .cc-folder-act, :hover and -on rules are all found', faIdx >= 0 && faHoverIdx >= 0 && faOnIdx >= 0);
  ok('the .cc-card-movebtn and :hover rules are both found', mbIdx >= 0 && mbHoverIdx >= 0);

  var faHoverBody = (css.match(/\.cc-folder-act:hover\s*\{([^}]*)\}/) || [, ''])[1];
  var faOnBody = (css.match(/\.cc-folder-act-on\s*\{([^}]*)\}/) || [, ''])[1];
  var mbHoverBody = (css.match(/\.cc-card-movebtn:hover\s*\{([^}]*)\}/) || [, ''])[1];
  ok('.cc-folder-act:hover sets the shade background with !important', /background:\s*rgba\(128, 128, 128, \.18\)\s*!important\s*;/.test(faHoverBody), faHoverBody);
  ok('.cc-folder-act-on sets the shade background with !important', /background:\s*rgba\(128, 128, 128, \.18\)\s*!important/.test(faOnBody), faOnBody);
  ok('.cc-card-movebtn:hover sets the shade background with !important', /background:\s*rgba\(128, 128, 128, \.18\)\s*!important\s*;/.test(mbHoverBody), mbHoverBody);
  ok('.cc-folder-act-on comes after .cc-folder-act in the file', faOnIdx > faIdx);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
