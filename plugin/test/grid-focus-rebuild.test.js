// The card and folder views are rebuilt from scratch on every load, every nine seconds, and after a
// folder is renamed. The keyboard focus has to come back to the same control in the fresh DOM,
// found by the card or folder it sits in, or a keyboard user is thrown to the top of the page.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const src = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
const between = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

// A tree of elements that answers the compound selectors the two helpers use.
const doc = { activeElement: null };
function E(tag, cls, attrs, kids) {
  const n = { tag, classes: cls ? cls.split(' ') : [], attrs: attrs || {}, kids: kids || [], parent: null };
  n.kids.forEach((k) => { k.parent = n; });
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.focus = () => { doc.activeElement = n; };
  n.contains = (o) => { for (let p = o; p; p = p.parent) if (p === n) return true; return false; };
  n.matches = (sel) => sel.split(/,\s*/).some((one) => {
    const m = /^([a-z]*)((?:\.[-\w]+)*)((?:\[[^\]]+\])*)(:not\(\[tabindex="-1"\]\))?$/.exec(one.trim());
    if (!m) throw new Error('selector ' + one);
    if (m[1] && m[1] !== n.tag) return false;
    if (m[2] && !m[2].split('.').filter(Boolean).every((c) => n.classes.includes(c))) return false;
    for (const a of (m[3].match(/\[[^\]]+\]/g) || [])) {
      const am = /^\[([-\w]+)(?:="(.*)")?\]$/.exec(a);
      if (!(am[1] in n.attrs) || (am[2] != null && n.attrs[am[1]] !== am[2])) return false;
    }
    if (m[4] && n.attrs.tabindex === '-1') return false;
    return true;
  });
  n.closest = (sel) => { for (let p = n; p; p = p.parent) if (p.matches(sel)) return p; return null; };
  n.querySelectorAll = (sel) => { const out = []; const walk = (x) => x.kids.forEach((k) => { if (k.matches(sel)) out.push(k); walk(k); }); walk(n); return out; };
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  return n;
}
const card = (name) => E('div', 'tt-card', { 'data-name': name }, [E('span', 'tt-b', { tabindex: '0' }), E('button', 'tt-card-movebtn'), E('span', 'tt-actbtn', { role: 'button', tabindex: '0' })]);
const folder = (id, kids) => E('div', 'tt-folder-group', { 'data-fid': id }, [E('div', 'tt-folder-group-head', {}, [E('button', 'tt-folder-act'), E('button', 'tt-folder-act')])].concat(kids));
// A container that appears between two loads shifts every control after it.
const build = (fresh) => E('div', 'tt-grid-holder', {}, (fresh ? [card('adguard')] : []).concat([folder('f1', [card('web'), card('db')]), card('plex'), E('div', 'tt-card tt-gear-tile', {}, [E('button', 'tt-hgear')])]));

const api = new Function('document', 'CSS', 'holder', 'var gridHolder = holder;\n' + between('var GRID_FOCUSABLE', 'function removeGridHolder') +
  '\nreturn { key: gridFocusKey, restore: restoreGridFocus, swap: function (h) { gridHolder = h; } };');
const CSS_ = { escape: (v) => String(v).replace(/["\\]/g, '\\$&') };

function across(pick, what, fresh) {
  const h1 = build();
  const a = api(doc, CSS_, h1);
  const was = pick(h1); was.focus();
  const k = a.key();
  const h2 = build(fresh); a.swap(h2); doc.activeElement = null;
  a.restore(k);
  const now = pick(h2);
  ok(what, doc.activeElement === now && now !== was, JSON.stringify(k));
}

console.log('\nThe focus comes back to the same control after a rebuild');
across((h) => h.querySelector('.tt-card[data-name="db"]').kids[2], 'a row action in a card inside a folder');
across((h) => h.querySelector('.tt-card[data-name="plex"]').kids[1], 'the move button of a card at the root');
across((h) => h.querySelector('.tt-folder-group[data-fid="f1"]').kids[0].kids[1], 'the rename button in a folder header');
across((h) => h.querySelector('.tt-hgear'), 'the gear tile');
across((h) => h.querySelector('.tt-card[data-name="plex"]').kids[2], 'an action in a card after a new container arrived ahead of it', true);
across((h) => h.querySelector('.tt-folder-group[data-fid="f1"]').kids[0].kids[0], 'a folder button after a new container arrived ahead of it', true);
{
  const h1 = build(), a = api(doc, CSS_, h1);
  doc.activeElement = null;
  ok('a focus outside the view is left alone', a.key() === null);
  const h2 = E('div', 'tt-grid-holder', {}, [card('web')]);
  h1.querySelector('.tt-card[data-name="plex"]').kids[1].focus();
  const k = a.key(); a.swap(h2); doc.activeElement = null; a.restore(k);
  ok('a card that is gone after the rebuild takes nothing', doc.activeElement === null);
}

console.log('\nBoth views take part');
ok('the card view keeps the focus across its rebuild', /var focusKey = gridFocusKey\(\);\s+ensureGridHolder\(\); gridHolder\.innerHTML = "";/.test(grabFn('renderGrid')) && /restoreGridFocus\(focusKey\);\s+\}$/.test(grabFn('renderGrid')));
ok('the folder view too', /focusKey = gridFocusKey\(\);\s+ensureGridHolder\(\); gridHolder\.innerHTML = "";/.test(grabFn('renderFolderView')) && /restoreGridFocus\(focusKey\);\s+\}$/.test(grabFn('renderFolderView')));
ok('a folder group carries its id', /grp\.setAttribute\("data-fid", e\.id\)/.test(src));

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
