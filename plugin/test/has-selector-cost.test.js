// A :has() whose argument tests the class or style attribute makes Chrome restyle the whole page
// on every class or inline style change anywhere. Unraid's Dashboard animates its CPU bars through
// both, dozens of times a second, so a single such rule stalls the page on each update.
// A state that lives in an inline style is mirrored into a class instead, and a :has() tests that.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

function hasArgs(src) {
  const out = [];
  for (let i = src.indexOf(':has('); i >= 0; i = src.indexOf(':has(', i + 1)) {
    let d = 0, k = i + 4;
    for (; k < src.length; k++) { if (src[k] === '(') d++; else if (src[k] === ')' && !--d) break; }
    out.push({ line: src.slice(0, i).split('\n').length, arg: src.slice(i + 5, k).replace(/\s+/g, ' ') });
  }
  return out;
}

console.log('\nNo :has() reads the class or style attribute');
{
  const sheets = ['sheets', 'styles'].flatMap((d) => fs.readdirSync(path.join(DIR, d)).filter((f) => f.endsWith('.css')).map((f) => d + '/' + f));
  let seen = 0;
  for (const f of sheets) {
    const args = hasArgs(fs.readFileSync(path.join(DIR, f), 'utf8'));
    seen += args.length;
    const bad = args.filter((a) => /\[\s*(class|style)\b/.test(a.arg));
    ok(f, !bad.length, bad.map((b) => b.line + ': ' + b.arg).join(' | '));
  }
  ok('the scan found the sheets\' :has() rules at all', seen > 100, String(seen));
}

console.log('\nThe overlays\' inline display reaches the sheet as a class');
{
  const js = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
  const tokens = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Tokens.css'), 'utf8');
  const fn = new Function(/function ccMirrorShut\(el\) \{[^\n]*\}/.exec(js)[0] + '\nreturn ccMirrorShut;')();
  const node = (display) => { const c = new Set(); return { style: { display }, classList: { toggle: (t, on) => (on ? c.add(t) : c.delete(t)), contains: (t) => c.has(t) } }; };
  const shut = node('none'); fn(shut);
  const shown = node('flex'); fn(shown);
  const bare = node(''); fn(bare);
  ok('a node hidden by an inline display is shut', shut.classList.contains('cc-shut'));
  ok('one shown inline, or with no inline display at all, is not', !shown.classList.contains('cc-shut') && !bare.classList.contains('cc-shut'));
  ok('the overlay and the SweetAlert shell are watched on their style attribute', /querySelectorAll\("div\.spinner\.fixed, \.sweet-alert"\)/.test(js) && /attributeFilter: \["style"\]/.test(js));
  ok('the in-page spinner yields to the overlay while it is not shut', /body:has\(div\.spinner\.fixed:not\(\.cc-shut\)\) div\.spinner:not\(\.fixed\)/.test(tokens));
  ok('the overlay yields to a SweetAlert that is not shut', /:has\(\.sweet-alert\.showSweetAlert:not\(\.cc-shut\),/.test(tokens));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
