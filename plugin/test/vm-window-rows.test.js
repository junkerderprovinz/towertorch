// The VM limits window lays its rows out like every other CC window: a field or a dropdown stands
// beside its label at the row's end (GlimStone rule 35), the core picker and the vDisk list keep
// their label above them, an explanation sits in the label's (i) rather than under the field
// (rule 8), and the icon colouring is CC's own dropdown with its arrow, not a native <select>
// (rules 14 and 18). What can quietly break it:
//   · a hint printed under a field again
//   · the field stretching to the window's width, or the label moving above it
//   · the native select coming back, with no arrow and the OS's open list
//   · the dropdown's panel clipped by the window's scrolling card
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const vms = fs.readFileSync(path.join(DIR, 'scripts/vms.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.VmTab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function body(sel) {
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(css))) if (m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).includes(sel)) return m[2];
  return '';
}
const decl = (b, prop) => ((new RegExp('(?:^|;)\\s*' + prop + ':\\s*([^;]+)').exec(b) || [])[1] || '').trim();

console.log('\nA field stands beside its label');
{
  const fld = grabFn(vms, 'vmFld');
  ok('the field and its label share one row', /el\("div", "cc-vm-row"\)/.test(fld) && /el\("label", "cc-vm-lbl"/.test(fld));
  ok('a hint goes into the label\'s (i)', /CCTheme\.infoIcon\(hint\)/.test(fld));
  ok('and nothing is printed under the field', !/hh\.style|cc-text-dim/.test(fld), fld.slice(0, 200));
  const row = body('#cc-vmlim .cc-vm-row');
  ok('the row puts the label at its start and the field at its end', decl(row, 'display') === 'flex' && decl(row, 'justify-content') === 'space-between' && decl(row, 'align-items') === 'center', row);
  const inp = body('#cc-vmlim .cc-vm-row > input');
  ok('a field keeps a width of its own', /^\d+px$/.test(decl(inp, 'width')), decl(inp, 'width'));
  ok('its placeholder takes the hint ink rather than Unraid\'s link colour', /var\(--cc-text-hint/.test(decl(body('#cc-vmlim .cc-vm-row > input::placeholder'), 'color')));
}

console.log('\nWhat needs the window\'s width keeps its label above');
{
  const ed = grabFn(vms, 'openVmEd');
  ok('the core picker explains itself in its label\'s (i)', /pinLbl\.appendChild\(window\.CCTheme\.infoIcon\(/.test(ed) && !/pinHint/.test(ed));
  ok('the vDisk list keeps its label above it', /dsec\.appendChild\(dlbl\); dsec\.appendChild\(dlist\);/.test(ed));
}

console.log('\nThe icon colouring is CC\'s dropdown');
{
  const ed = grabFn(vms, 'openVmEd');
  ok('the select is wrapped in a .cc-dsel', /row\.appendChild\(vmDsel\(sel\)\)/.test(ed) && /el\("label", "cc-vm-lbl"/.test(ed));
  const ds = grabFn(vms, 'vmDsel');
  ok('the native select stays as the value, out of sight', /sel\.style\.display = "none"/.test(ds));
  ok('a choice fires the select\'s change, so the override is saved as before', /sel\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/.test(ds));
  ok('the trigger is a button the keyboard reaches', /CCTheme\.pressable\(trig\)/.test(ds) && /aria-haspopup", "listbox"/.test(ds));
  ok('the wheel and the colour modes reach it through cc-theme.js', /registerSelectSync\(/.test(vms) && /CT\.paintSelects\(win\)/.test(ed));
  ok('the open panel is placed on the page, so the scrolling card cannot clip it', /panel\.style\.position = "fixed"/.test(grabFn(vms, 'vmDselPosition')));
  ok('and it is out of flow from the start, so opening it never pushes the trigger aside first', decl(body('#cc-vmlim .cc-dsel-panel'), 'position') === 'fixed');
  const after = body('#cc-vmlim .cc-dsel-trigger::after');
  ok('the trigger draws its arrow', /border-top:\s*5px solid/.test(after), after);
  const trig = body('#cc-vmlim .cc-dsel-trigger');
  ok('on the field fill every other field in the window has', /var\(--cc-surface-3/.test(decl(trig, 'background-color')), decl(trig, 'background-color'));
  ok('its items rest neutral in every colour mode', /rgba\(128, 128, 128, \.16\)/.test(body('#cc-vmlim .cc-dsel-opt')));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
