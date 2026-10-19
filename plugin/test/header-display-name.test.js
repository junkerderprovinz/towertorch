// The header can show a display name of its own. It is a CC setting, cc.brand.name, typed on the
// Kopfbereich tab beside its name, and only CC's header reads it: Unraid's server name stays as
// it is, and an empty field shows that name again.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

console.log('\nThe header shows the display name, else the server name');
{
  // ccBrand() against a header element and a store, reading back the text it renders.
  function render(store, title) {
    const kids = [];
    const mk = (tag) => ({ tag, style: {}, children: [], firstChild: null, className: '', appendChild(c) { this.children.push(c); this.firstChild = this.children[0]; return c; }, removeChild(c) { this.children.splice(this.children.indexOf(c), 1); this.firstChild = this.children[0] || null; } });
    const hdr = mk('div'); hdr.insertBefore = (c) => { kids.push(c); c.id = 'cc-brand'; };
    const document = { title, getElementById: (id) => id === 'header' ? hdr : (id === 'cc-brand' ? kids[0] || null : null), createElement: mk, createTextNode: (t) => ({ text: t }), querySelector: () => null };
    const g = (k, d) => (k in store ? store[k] : d);
    new Function('document', 'g', 'window', 'var ccBrandSig = "";\n' + grabFn(header, 'ccBrandOn') + '\n' + grabFn(header, 'ccBrand') + '\nccBrand();')(document, g, {});
    const br = kids[0];
    return br ? br.children[0].children[0].text : null;
  }
  const on = { 'cc.enable.header': '1' };
  ok('no display name: the server name from the title', render(Object.assign({}, on), 'Bottich/Settings') === 'Bottich');
  ok('a display name: that name instead', render(Object.assign({ 'cc.brand.name': 'Kommandostand' }, on), 'Bottich/Settings') === 'Kommandostand');
  ok('blanks around it are dropped', render(Object.assign({ 'cc.brand.name': '  Feste  ' }, on), 'Bottich/Settings') === 'Feste');
  ok('a name of blanks counts as empty', render(Object.assign({ 'cc.brand.name': '   ' }, on), 'Bottich/Settings') === 'Bottich');
}

console.log('\nThe field on the Kopfbereich tab');
{
  const at = settings.indexOf('var nmRow = el("div", "cc-set-row")');
  const block = settings.slice(at, settings.indexOf('cB.appendChild(nmRow);', at));
  ok('it is a one-line field beside its name, which the sheet puts at the row\'s end', /el\("input", "cc-set-txt"\)/.test(block) && /nmRow\.appendChild\(nmL\); nmRow\.appendChild\(nmIn\)/.test(settings));
  ok('its name carries a bubble that says Unraid\'s own name stays', /nmL\.appendChild\(infoIcon\(T\([^)]*Unraids eigener Servername bleibt/.test(block));
  ok('a typed name is saved and the header follows at once', /if \(v\) set\("cc\.brand\.name", v\); else del\("cc\.brand\.name"\); syncHeaderBar\(\);/.test(block));
  ok('the server name it falls back to is the placeholder', /nmIn\.placeholder = \(document\.title\.split\("\/"\)\[0\] \|\| ""\)\.trim\(\) \|\| "Unraid";/.test(block));
  ok('it sits in the Servername card, first', settings.indexOf('var nmRow') > settings.indexOf('card(T("Servername", "Server name")') && settings.indexOf('var nmRow') < settings.indexOf('dropRow(T("Größe", "Size")'));
  ok('nothing writes Unraid\'s hostname', !/NAME=|ident\.cfg|#file", "ident/.test(settings));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
