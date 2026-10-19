// Every field of the container add and edit form carries an (i) beside its label: Unraid's own
// fields a sentence of ours, a template variable the description its template gives it.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const docker = fs.readFileSync(path.join(DIR, 'scripts/docker.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'styles/docker.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const grabVar = (name) => new RegExp('  var ' + name + ' = \\{[\\s\\S]*?\\n  \\};').exec(docker)[0];

// A node answers only the selectors the function asks, from a table set per node.
function node(tag, opts) {
  const n = Object.assign({ tagName: tag, kids: [], attrs: {}, q: {}, qa: {}, cls: new Set() }, opts || {});
  n.classList = { contains: (c) => n.cls.has(c) };
  n.querySelector = (s) => (s === ':scope > .cc-info' ? n.kids.find((k) => k.isInfo) || null : n.q[s] || null);
  n.querySelectorAll = (s) => n.qa[s] || [];
  n.appendChild = (c) => { n.kids.push(c); c.parentNode = n; return c; };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.closest = (s) => (s === "[id^='ConfigNum']" ? n.cfg || null : null);
  return n;
}
// One row: a dt and its dd in a dl, the dl in a wrapper.
function row(o) {
  const dt = node('DT'), dd = node('DD'), dl = node('DL', { cfg: o.cfg }), wrap = node('DIV');
  if (o.span) { const sp = node('SPAN'); sp.cls.add('cc-varlab'); dt.q[':scope > span.cc-varlab'] = sp; dt.host = sp; sp.kids = []; } else { dt.cls.add('cc-dtlab'); dt.host = dt; }
  if (o.field) dd.q['select[name], select[id], input[name]:not([type=hidden]), input[id]:not([type=hidden]), textarea[name]'] = o.field;
  if (o.notes) dd.qa['.boxed > span.orange-text'] = o.notes;
  dt.parentNode = dl; dt.nextElementSibling = dd; dl.parentElement = wrap;
  if (o.help) { wrap.q[':scope > blockquote.inline_help'] = { textContent: '  ' + o.help + ' ' }; wrap.qa[':scope > dl > dt'] = [dt]; }
  return dt;
}
function run(dts, lang) {
  const document = { querySelectorAll: (s) => (s === '#canvas form dl > dt' ? dts : []) };
  const window = { CCTheme: { infoIcon: (tip) => { const s = node('SPAN', { isInfo: true }); s.tip = tip; return s; } } };
  new Function('document', 'window', 'LANG', 'MARK', grabVar('CT_HELP') + grabVar('CT_KIND_HELP') + grabFn(docker, 'ctHelpText') + grabFn(docker, 'ctInfoBubbles') + '\nctInfoBubbles();')(document, window, lang, 'data-cc');
}
const tipOf = (dt) => { const i = dt.host.kids.find((k) => k.isInfo); return i ? i.tip : null; };

console.log('\nUnraid\'s own fields');
{
  const name = row({ field: { name: 'contName' } }), priv = row({ field: { name: 'contPrivileged' } }), cpu = row({ field: { id: 'box4' } });
  run([name, priv, cpu], 'de');
  ok('Name explains itself in German', /^Der Name des Containers/.test(tipOf(name) || ''), tipOf(name));
  ok('a second pair in the same list reads its own field', /vollen Zugriff/.test(tipOf(priv) || ''), tipOf(priv));
  ok('the CPU pins share one sentence', /CPU-Kerne/.test(tipOf(cpu) || ''), tipOf(cpu));
  const en = row({ field: { name: 'contRepository' } });
  run([en], 'en');
  ok('and in English on an English page', /^The image the container runs/.test(tipOf(en) || ''), tipOf(en));
  run([name], 'de');
  ok('a second pass adds no second (i)', name.host.kids.filter((k) => k.isInfo).length === 1);
}

console.log('\nTemplate variables');
{
  const desc = 'The desktop the emulator draws on.';
  const kept = { textContent: 'Container Port: 3001', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const moved = { textContent: ' ' + desc + ' ', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const cfg = node('DIV'); cfg.q['input[name="confDescription[]"]'] = { value: desc }; cfg.q['input[name="confType[]"]'] = { value: 'Port' };
  const v = row({ span: true, cfg, notes: [kept, moved] });
  const bare = node('DIV'); bare.q['input[name="confDescription[]"]'] = { value: '' }; bare.q['input[name="confType[]"]'] = { value: 'Path' };
  const p = row({ span: true, cfg: bare, notes: [] });
  run([v, p], 'de');
  ok('a variable takes its template\'s description', tipOf(v) === desc, tipOf(v));
  ok('which then leaves the page, while the container port line stays', moved.attrs['data-cc-help'] === '1' && !kept.attrs['data-cc-help']);
  ok('one without a description says what its kind does', /Ordner am Server/.test(tipOf(p) || ''), tipOf(p));
}

console.log('\nAny other row');
{
  const ts = row({ field: { name: 'TShostname' }, help: 'Provide the hostname for this container.' });
  const none = row({ field: { name: 'contSomething' } });
  run([ts, none], 'de');
  ok('falls back to Unraid\'s inline help when its wrapper holds only that row', tipOf(ts) === 'Provide the hostname for this container.', tipOf(ts));
  ok('and stays without an (i) when nothing explains it', tipOf(none) === null);
}

console.log('\nThe label sweep and the sheet');
{
  const labels = grabFn(docker, 'ctVarLabels');
  ok('the label sweep never takes an (i) for a label', /dt > span:not\(\.cc-info\), \.ui-dialog dl > dt > span:not\(\.cc-info\)/.test(labels) && /dt\.querySelector\(":scope > span:not\(\.cc-info\)"\)/.test(labels));
  ok('the form pass adds the bubbles and the teardown takes them back', /ctInfoBubbles\(\);/.test(grabFn(docker, 'ctApply')) && /ctInfoBubblesTeardown\(\);/.test(grabFn(docker, 'ctApply')));
  ok('a moved description is hidden', /#canvas \.boxed span\.orange-text\[data-cc-help\] \{ display: none !important; \}/.test(css));
  ok('the (i) stands after the required dot, in the label\'s ink', /#canvas dl > dt \.cc-info \{ order: 1; color: inherit; \}/.test(css));
}

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
