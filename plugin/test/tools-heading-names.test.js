// The German names of the Tools categories Unraid leaves in English (settingsgrid.js).
// A heading is matched by the page file in the comment Unraid writes before it, never by its
// text, and only a German page is renamed. clearHeads() gives the original back.
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts', 'settingsgrid.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(name) {
  const i = js.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}') { d--; if (!d) return js.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const HEAD_DE = /var HEAD_DE = [^\n]+;/.exec(js)[0];

// A heading as Unraid writes it: the annotate() comment, whitespace, then div.title > span.left
// holding the icon and the bare label.
function heading(file, label) {
  const parent = { childNodes: [] };
  const link = (list) => list.forEach((n, i) => { n.previousSibling = list[i - 1] || null; });
  const comment = { nodeType: 8, nodeValue: '\n' + '#'.repeat(file.length) + '\n' + file + '\n' + '#'.repeat(file.length) + '\n' };
  const gap = { nodeType: 3, nodeValue: '\n                ' };
  const title = { nodeType: 1 };
  const icon = { nodeType: 1 };
  const text = { nodeType: 3, nodeValue: label };
  const attrs = {};
  const h = {
    nodeType: 1, parentNode: title, lastChild: text,
    hasAttribute: (k) => k in attrs, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = String(v); }, removeAttribute: (k) => { delete attrs[k]; },
  };
  link([comment, gap, title]);
  link([icon, text]);
  parent.childNodes.push(comment, gap, title);
  return { h, text, attrs };
}
function load(lang) {
  const document = { documentElement: { lang } };
  return new Function('document', HEAD_DE + '\n' + grabFn('headPage') + '\n' + grabFn('headLabel') + '\n' + grabFn('nameHead') + '\nreturn { headPage: headPage, nameHead: nameHead };')(document);
}

console.log('\nOn a German page the three English categories get German names');
{
  const R = load('de');
  for (const [file, en, de] of [['webGui/WebGui.page', 'WebGUI', 'Weboberfläche'], ['webGui/Wizards.page', 'Wizards', 'Assistenten'], ['plugins/unassigned.devices.preclear/DiskUtilities.page', 'Disk Utilities', 'Datenträger-Werkzeuge']]) {
    const x = heading(file, en);
    ok(file + ' is told by its page file', R.headPage(x.h.parentNode) === file.split('/').pop().replace('.page', ''));
    R.nameHead(x.h);
    ok(en + ' becomes ' + de + ' and keeps the original for the teardown', x.text.nodeValue === de && x.attrs['data-cc-sgh-text'] === en);
    R.nameHead(x.h);
    ok('a second paint keeps the first original', x.attrs['data-cc-sgh-text'] === en);
  }
  for (const [file, label] of [['webGui/UNRAID-OS.page', 'Unraid OS'], ['webGui/About.page', 'Über'], ['plugins/dynamix.system.stats/SystemInformation.page', 'Systeminformation']]) {
    const x = heading(file, label);
    R.nameHead(x.h);
    ok(label + ' stays as Unraid names it', x.text.nodeValue === label && !('data-cc-sgh-text' in x.attrs));
  }
  const odd = heading('plugins/other/Tools.page', 'Wizards');
  R.nameHead(odd.h);
  ok('the same text from another page file is left alone', odd.text.nodeValue === 'Wizards');
}

console.log('\nAny other language is left alone');
for (const lang of ['en', 'fr', '']) {
  const x = heading('webGui/Wizards.page', 'Wizards');
  load(lang).nameHead(x.h);
  ok('lang "' + lang + '" keeps Wizards', x.text.nodeValue === 'Wizards');
}

console.log('\nThe teardown gives the original back');
ok('clearHeads() restores the label and drops the marker', /if \(label\) label\.nodeValue = h\.getAttribute\("data-cc-sgh-text"\);\s*h\.removeAttribute\("data-cc-sgh-text"\);/.test(grabFn('clearHeads')));
ok('paintHeads() names every heading it badges', /nameHead\(h\);/.test(grabFn('paintHeads')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
