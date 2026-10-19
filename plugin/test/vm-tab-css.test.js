// Pins two rules of TowerTorch.VmTab.css. Most VM rows render their icon as
// a font glyph rather than an <img>, so a font-size that is not tied to
// --cc-logo-img resizes only the invisible box and leaves Kachelgröße looking
// broken on this tab alone.
//
// A string-level check: the bare-Node runner has no CSS engine, so the helpers
// from settings-chrome.test.js are reused as they are.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const CSS = process.argv[2] || path.join(DIR, 'sheets', 'TowerTorch.VmTab.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const css = fs.readFileSync(CSS, 'utf8');

// Taken from settings-chrome.test.js.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
function declares(body, prop) {
  if (body == null) return false;
  return new RegExp('(^|;)\\s*' + prop + '\\s*:', 'i').test(body);
}

console.log('\nThe VM-row glyph icon rule ties font-size to --cc-logo-img, never a bare pixel literal');
{
  const sel = 'html.cc-vms-on #kvm_list td.vm-name .outer > span.hand i.img';
  const body = ruleBody(css, sel);
  ok('the rule exists', body != null);
  ok('font-size is declared', declares(body, 'font-size'), body);
  ok('font-size is tied to var(--cc-logo-img', /font-size:\s*var\(--cc-logo-img/.test(body || ''), body);
  ok('font-size is not a bare pixel literal', !/font-size:\s*\d/.test(body || ''), body);
  ok('width and height stay tied to the same token', /width:\s*var\(--cc-logo-img/.test(body || '') && /height:\s*var\(--cc-logo-img/.test(body || ''), body);
}

console.log('\nVM icon logo badge: a configured icon colour wins over the rainbow palette');
{
  // The badge carries the app's identity rather than a rotating value, so a picked
  // Logo-Hintergrund colour has to come first in the var() chain and the rainbow
  // rotation colour only serves rows without one.
  const nonReactiveSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rainbow:not(.cc-vm-rbneutral) #kvm_list td.vm-name .outer > span.hand';
  const reactiveHoverSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rbneutral #kvm_list tr:hover td.vm-name .outer > span.hand';
  const reactiveRestSel = 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rbneutral #kvm_list td.vm-name .outer > span.hand';
  const nrBody = ruleBody(css, nonReactiveSel);
  const rhBody = ruleBody(css, reactiveHoverSel);
  const rrBody = ruleBody(css, reactiveRestSel);
  ok('non-reactive rainbow rule exists', nrBody != null);
  ok('non-reactive: --cc-iconbg-color comes before --cc-rb-c', /background:\s*var\(--cc-iconbg-color,\s*var\(--cc-rb-c,/.test(nrBody || ''), nrBody);
  ok('reactive hover rule exists', rhBody != null);
  ok('reactive hover: --cc-iconbg-color comes before --cc-rb-c', /background:\s*var\(--cc-iconbg-color,\s*var\(--cc-rb-c,/.test(rhBody || ''), rhBody);
  ok('the reactive rest state takes the grey wash of the Docker tile, which reads on light themes too', /background:\s*rgba\(128, 128, 128, \.18\)/.test(rrBody || ''), rrBody);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
