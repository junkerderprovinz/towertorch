// In a TowerTorch window and in the windows TowerTorch themes on the Docker tab, a row reads label first and
// switch last: the words and their (i) at the left, the switch at the far right, as the
// "Im Startplan verwalten" row has always done.
const fs = require('fs');
const path = require('path');
const { DIR, PAGES, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('function not found: ' + name);
}

console.log('\nThe Startplan window');
{
  const ed = grabFn(read('scripts/docker.js'), 'openEditor');
  // Each switch row, read as the order its children are appended in.
  const order = (row) => {
    const re = new RegExp(row + '\\.appendChild\\(([^;]+?)\\);', 'g');
    const out = []; let m;
    while ((m = re.exec(ed))) out.push(m[1]);
    return out;
  };
  for (const [row, sw, what] of [['mrow', 'manageTog', 'Im Startplan verwalten'], ['wHead', 'wEn', 'Auto-Start'], ['wUrow', 'wU', 'bei „unhealthy“'], ['wXrow', 'wX', 'bei Absturz'], ['nHead', 'nEn', 'Auto-Stop bei Leerlauf']]) {
    const kids = order(row);
    ok(what + ': the words come first', /^el\("span"/.test(kids[0] || ''), kids.join(' | '));
    ok(what + ': a spacer pushes the switch to the far right, where it is the last child', kids[kids.length - 1] === sw && kids[kids.length - 2] === 'el("span", "tt-set-spacer")', kids.join(' | '));
  }
  ok('the (i) of Auto-Stop stays beside its words, before the spacer', order('nHead')[1] === 'infoBubble(t("idleFoot"))');
  const sheet = read('styles/docker.css');
  ok('the spacer takes the free room', /\.tt-set-spacer \{ flex: 1; \}/.test(sheet));
}

console.log('\nShipLog\'s auto-update switch');
{
  // ShipLog's own rules, as its sheet ships them, loaded after TowerTorch's so they win every tie.
  const shiplog = {
    name: 'shiplog/styles/docker.css',
    css: '.sl-bubble .sl-au-row{position:relative;display:inline-flex;align-items:center;gap:9px;cursor:pointer}' +
      '.sl-bubble .sl-au-track{position:relative;width:34px;height:18px;flex:none;border-radius:999px;background:var(--sl-line2)}' +
      '.sl-bubble .sl-au-cb:checked + .sl-au-track{background:var(--tt-accent,#ff8c2f)}' +
      '.sl-bubble .sl-au-state{flex:1 1 160px;min-width:0}'
  };
  const page = PAGES.docker.concat([shiplog]);
  const el = (classes) => ({ tag: 'span', classes, attrs: { class: classes.join(' ') }, states: {}, inside: ['.sl-bubble', '.sl-aubar'] });
  const win = (classes, prop, tag) => { const e = el(classes); if (tag) e.tag = tag; const c = candidates(page, e, prop); return c.length ? c[c.length - 1].value : null; };
  ok('the label lets its parts take their own places in the bar', win(['sl-au-row'], 'display', 'label') === 'contents');
  ok('the switch stands last', win(['sl-au-track'], 'order') === '3' && win(['sl-au-info'], 'order') === '2', win(['sl-au-track'], 'order') + ' ' + win(['sl-au-info'], 'order'));
  ok('and is pushed to the far right', win(['sl-au-track'], 'margin-inline-start') === 'auto');
  ok('at GlimStone\'s switch size, in the shape engine', win(['sl-au-track'], 'width') === '44px' && win(['sl-au-track'], 'height') === '24px' && win(['sl-au-track'], 'border-radius') === 'var(--tt-radius-pill)');
  const on = candidates(page, { tag: 'span', classes: ['sl-au-track'], attrs: { class: 'sl-au-track' }, states: { checked: true }, inside: ['.sl-bubble'], prev: ['.sl-au-cb:checked'] }, 'background').pop();
  ok('switched on, it takes the colour chain', on && /var\(--tt-rb-c, var\(--tt-rbaccent, var\(--tt-accent/.test(on.value), on && on.selector + ' ' + on.value);
  ok('the save state gets a line of its own below', win(['sl-au-state'], 'flex-basis') === '100%');
  const docker = read('scripts/docker.js');
  ok('the rainbow gives the switch a slot of its own, without painting its off state', /\.sl-x, \.sl-au-track"\)\)/.test(docker) && /if \(neutral \|\| bn\.classList\.contains\("sl-au-track"\)\)/.test(docker));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
