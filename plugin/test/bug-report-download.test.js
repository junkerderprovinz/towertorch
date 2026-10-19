// The bug report button saves the engine's redacted report as a download and then opens GitHub's
// bug form, where the file is attached. The form's tab opens inside the click, before the request,
// so a popup blocker lets it through; a failed request closes it again and shakes the button.
// ccapi.php forwards the engine's endpoint and nothing else new.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const settings = fs.readFileSync(path.join(DIR, 'scripts/settings.js'), 'utf8');
const proxy = fs.readFileSync(path.join(DIR, 'server/ccapi.php'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

async function run(answer) {
  const log = { opened: [], clicked: [], toasts: [], fails: [], fetched: '' };
  const tab = { opener: 'page', closed: false, location: { href: 'about:blank' }, close() { this.closed = true; } };
  const ctl = { tag: 'span' };
  const unit = { querySelector: (s) => (s === '.cc-rbtn' ? ctl : null) };
  const anchor = { click() { log.clicked.push(this.download); } };
  const win = {
    open: (u, t) => { log.opened.push([u, t]); return tab; },
    CCTheme: { toast: (m) => log.toasts.push(m) }
  };
  const doc = { body: { appendChild() {}, removeChild() {} } };
  const fetch = (u) => { log.fetched = u; return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer); };
  const fn = new Function('window', 'document', 'fetch', 'URL', 'setTimeout', 'el', 'T', 'failed', 'PROXY', 'REPO', 'CC_VER',
    grabFn(settings, 'downloadBugReport') + '\nreturn downloadBugReport;')(
    win, doc, fetch, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, () => {}, () => anchor, (d, e) => e,
    (c, m) => log.fails.push([c, m]), '/plugins/towertorch/server/ccapi.php', 'https://github.com/junkerderprovinz/towertorch', '1.2.0');
  fn(unit);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return { log, tab, ctl };
}

(async () => {
  console.log('\nA report that arrives is saved and the form opens');
  {
    const { log, tab } = await run({ ok: true, blob: () => Promise.resolve('report') });
    ok('it asks the engine through the proxy', log.fetched === '/plugins/towertorch/server/ccapi.php?path=bugreport');
    ok('the form\'s tab opens inside the click, before the answer', log.opened.length === 1 && log.opened[0][0] === 'about:blank');
    ok('that tab gets no handle on this page', tab.opener === null);
    ok('the file is saved under a dated name', log.clicked.length === 1 && /^towertorch-bugreport-\d{8}-\d{6}\.txt$/.test(log.clicked[0]), log.clicked[0]);
    ok('the tab goes to the bug form with the version filled in', tab.location.href === 'https://github.com/junkerderprovinz/towertorch/issues/new?template=bug_report.yml&version=1.2.0', tab.location.href);
    ok('a toast says to attach the file', log.toasts.length === 1 && /Attach the file/.test(log.toasts[0]));
  }

  console.log('\nA report that fails closes the tab and shakes the button');
  {
    const { log, tab, ctl } = await run({ ok: false, status: 502, blob: () => Promise.resolve('') });
    ok('no file is saved', log.clicked.length === 0);
    ok('the empty tab closes', tab.closed);
    ok('the button shakes with the reason', log.fails.length === 1 && log.fails[0][0] === ctl && /HTTP 502/.test(log.fails[0][1]));
    const off = await run(new Error('offline'));
    ok('a network error is a failure too', off.log.fails.length === 1 && off.tab.closed);
  }

  console.log('\nThe proxy forwards the report as text');
  ok('bugreport is allowed for GET only', /'bugreport' => \['GET'\]/.test(proxy));
  ok('it answers as plain text that is never cached', /elseif \(\$path === 'bugreport'\) \{\s*header\('Content-Type: text\/plain; charset=utf-8'\);\s*header\('Cache-Control: no-store'\);/.test(proxy));
  ok('it takes no query parameters', !/'bugreport' => \['name'\]/.test(proxy));

  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
})();
