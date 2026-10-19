// In the limits and bandwidth windows a field runs to the row's end: the apply-status dot stands in
// the label column, the core picker is flush right, and the window's (i) rides in its title badge.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');
const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

// A row of label, field and unit, as the windows build it.
function node(cls) {
  return {
    className: cls || '', children: [], parent: null, attrs: {}, textContent: '',
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    querySelector(sel) {
      const direct = sel.startsWith(':scope > ');
      const cls = sel.replace(':scope > ', '').slice(1);
      const walk = (n) => { for (const c of n.children) { if (c.className.split(' ').includes(cls)) return c; if (!direct) { const f = walk(c); if (f) return f; } } return null; };
      return walk(this);
    },
  };
}
const api = new Function('el', grabFn(docker, 'statHost') + '\n' + grabFn(docker, 'statDot') + '\n' + grabFn(docker, 'statSlot') + '\n' + grabFn(docker, 'statClear') + '\nreturn { statDot: statDot, statSlot: statSlot, statClear: statClear };')((tag, cls) => node(cls));
const row = () => { const r = node('cc-pop-row'); r.appendChild(node('cc-pop-lbl')); r.appendChild(node('cc-in')); r.appendChild(node('cc-unit')); return r; };

console.log('\nThe apply-status dot stands in the label column');
{
  const r = row();
  api.statSlot(r);
  ok('its reserved slot goes into the label', r.children[0].children.length === 1 && /cc-stat-slot/.test(r.children[0].children[0].className));
  ok('so the last thing in the row is still the field or its unit', r.children[r.children.length - 1].className === 'cc-unit');
  api.statDot(r, true, 'RAM 8 GB');
  ok('the result fills that slot instead of adding a second dot', r.children[0].children.length === 1 && /cc-stat-ok/.test(r.children[0].children[0].className));
  api.statClear(r);
  ok('clearing it leaves the slot in place', /cc-stat-slot/.test(r.children[0].children[0].className) && !r.children[0].children[0].attrs['data-tip']);
  const bare = node('cc-pop-row'); bare.appendChild(node('cc-in'));
  api.statDot(bare, false, 'x');
  ok('a row without a label still gets its dot', bare.children.length === 2);
  ok('a label holding the dot spreads it to the column\'s end', /\.cc-pop-lbl:has\(> \.cc-statdot\) \{[^}]*justify-content: space-between/.test(css));
}

console.log('\nThe core picker and the (i)');
{
  ok('the core boxes stand at the row\'s end', /\.cc-cores \{[^}]*justify-content: flex-end/.test(css));
  const lim = grabFn(docker, 'openLimits');
  ok('the limits window puts its (i) inside the title badge', /limTitle\.appendChild\(infoBubble\(/.test(lim) && !/head\.appendChild\(infoBubble\(/.test(lim));
  ok('so does the bandwidth window', /bwTitle\.appendChild\(infoBubble\(/.test(docker));
  ok('where it takes the badge\'s ink', /\.cc-win-title \.cc-info \{ color: inherit !important;/.test(tokens));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
