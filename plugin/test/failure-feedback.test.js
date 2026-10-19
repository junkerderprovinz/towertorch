// A failed action reports through two channels at once (GlimStone, "Failure feedback"): the
// message in a toast and a 360ms shake on the control that was used. CCTheme.shake() and
// CCTheme.fail() in cc-theme.js are the mechanism; this pins it and the failure paths
// that use it: limits, bandwidth, plan and editor saves, the settings saves, VM limits.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}

const theme = read('scripts/cc-theme.js');
class El {
  constructor() { this.cls = new Set(); this.listeners = {}; this.log = []; this.reflows = 0; }
  get classList() { const s = this; return { add: (c) => { s.cls.add(c); s.log.push('+' + c); }, remove: (c) => { if (s.cls.has(c)) s.log.push('-' + c); s.cls.delete(c); }, contains: (c) => s.cls.has(c) }; }
  get offsetWidth() { this.reflows++; this.log.push('reflow'); return 10; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  fire(t, e) { (this.listeners[t] || []).slice().forEach((fn) => fn(e)); }
}
let timers = [];
const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
const toasts = [];
const api = new Function('setTimeout', 'clearTimeout', 'toast',
  grabFn(theme, 'shake') + '\n' + grabFn(theme, 'fail') + '\nreturn { shake: shake, fail: fail };')(setT, () => {}, (m, k) => { toasts.push([m, k]); return {}; });

console.log('\nThe shake');
{
  const el = new El();
  api.shake(el);
  ok('it puts .cc-shake on the control', el.cls.has('cc-shake'));
  el.fire('animationend', { animationName: 'cc-load-cw' });
  ok("a child's animation ending does not end the shake", el.cls.has('cc-shake'));
  el.fire('animationend', { animationName: 'cc-shake' });
  ok('its own animationend takes the class off', !el.cls.has('cc-shake'));
  el.log = [];
  api.shake(el); api.shake(el);
  ok('a second refusal in a row takes the class off and forces a layout before adding it again', el.log.join(' ') === 'reflow +cc-shake -cc-shake reflow +cc-shake', el.log.join(' '));
  const el2 = new El(); timers = [];
  api.shake(el2);
  timers[timers.length - 1].fn();
  ok('the timeout clears it where no animationend arrives', !el2.cls.has('cc-shake'));
  ok('the shake without a control is a no-op', (() => { try { api.shake(null); return true; } catch (e) { return false; } })());
}

console.log('\nfail() is shake plus an error toast');
{
  const el = new El(); toasts.length = 0;
  api.fail(el, 'Not saved');
  ok('the control shakes', el.cls.has('cc-shake'));
  ok('the message goes into an error toast', toasts.length === 1 && toasts[0][0] === 'Not saved' && toasts[0][1] === 'error');
  api.fail(null, 'Engine unreachable');
  ok('with no control the toast still comes', toasts.length === 2);
}

console.log('\nThe sheet: 360ms, through translate, a pulse when still');
{
  const css = read('sheets/TowerTorch.Header.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const kf = (/@keyframes cc-shake \{([\s\S]*?)\n\}/.exec(css) || [])[1] || '';
  ok('the keyframe moves through translate, not transform', /translate:/.test(kf) && !/transform/.test(kf));
  ok('it ends where it started', /0%, 100% \{ translate: none; \}/.test(kf));
  ok('the moving shake reads the level duration, 360ms by default', /cc-shake var\(--cc-motion-shake-dur, 360ms\) ease-in-out/.test(css));
}

console.log('\ndocker.js: flash() shakes the control it is given');
{
  const docker = read('scripts/docker.js');
  const shaken = [];
  const flash = new Function('window', 'menuStatusEl', 'flashToast',
    grabFn(docker, 'flash') + '\nreturn flash;')({ CCTheme: { shake: (el) => shaken.push(el), toast: () => ({ update: () => false }) } }, null, null);
  flash('Error: x', true, 'BTN');
  ok('a failure with a control shakes it', shaken.length === 1 && shaken[0] === 'BTN');
  flash('saved', false, 'BTN');
  ok('a success does not shake', shaken.length === 1);
  flash('Error: y', true);
  ok('a failure with no control only toasts', shaken.length === 1);

  ok('the plan menu passes its buttons', /savePlan\(false, save\); \}\); fire\.addEventListener\("click", function \(\) \{ savePlan\(true, fire\);/.test(docker));
  ok('savePlan reports with its control, also when the apply after it fails', /function savePlan\(thenApply, ctl\)[^\n]*return apply\(ctl\)[^\n]*flash\("Error: " \+ e\.message, true, ctl\)/.test(docker));
  ok('apply reports with its control', /function apply\(ctl\)[^\n]*flash\("Error: " \+ e\.message, true, ctl\)/.test(docker));
  ok('the editor save passes its button', /saveEditor\(name, readWatchdog\(\), readSchedules\(\), readNursery\(\), false, bSave\)/.test(docker));
  const editor = grabFn(docker, 'saveEditor');
  ok('the editor save reports with it', /flash\("Error: " \+ e\.message, true, ctl\)/.test(editor) && /return apply\(ctl\)/.test(editor));
  ok('both limit buttons pass themselves', /submitLimits\(payload, rem\)/.test(docker) && /submitLimits\(payload, save\)/.test(docker));
  const limits = grabFn(docker, 'submitLimits');
  ok('a failed limit apply toasts and shakes', /flash\("Error: " \+ em, true, ctl\)/.test(limits));
  ok('every invalid limit field shakes Save', (docker.match(/flash\(t\("invalid"\), true, save\)/g) || []).length === 3);
  ok('both bandwidth buttons pass themselves', /saveBandwidth\(name, 0, 0, rem\)/.test(docker) && /saveBandwidth\(name, readKbit\(upIn\), readKbit\(dnIn\), save\)/.test(docker));
  ok('a failed bandwidth save reaches popError with its control', /\.catch\(function \(e\) \{ popError\(e, ctl\); \}\)/.test(grabFn(docker, 'saveBandwidth')));
  ok('popError reports a failed click through flash', /if \(ctl \|\| !p\) flash\("Error: " \+ m, true, ctl\);/.test(grabFn(docker, 'popError')));
  ok('the restart policy select shakes on failure', /flash\("Error: " \+ e\.message, true, rpSel\)/.test(docker));
  ok('the engine being unreachable is a failure toast', /flash\("engine unreachable: " \+ e\.message, true\)/.test(docker));
}

console.log('\nsettings.js and vms.js');
{
  const settings = read('scripts/settings.js');
  ok('settings.js routes through CCTheme.fail', /function failed\(ctl, msg\) \{ if \(window\.CCTheme\) window\.CCTheme\.fail\(ctl, msg\); \}/.test(settings));
  for (const fn of ['saveNotify', 'saveShape']) {
    const src = grabFn(settings, fn);
    ok(fn + ' shakes its control and toasts on failure', /\.catch\(function \(e?\) \{[^}]*failed\(ctl, /.test(src));
    ok(fn + ' leaves no failure sentence on the page', !/textContent/.test(src));
  }
  ok('export, import and reset fail on their own buttons', /failed\(ex, /.test(settings) && (settings.match(/failed\(im, /g) || []).length === 3 && /failed\(rs, /.test(settings));
  ok('the inline notice under them is gone', !/cc-set-xnote/.test(settings));
  const vms = read('scripts/vms.js');
  ok('vms.js routes through CCTheme.fail', /function ccvFail\(ctl, msg\) \{ if \(window\.CCTheme\) window\.CCTheme\.fail\(ctl, msg\); \}/.test(vms));
  ok('a failed VM limit apply shakes Apply', /ccvFail\(apply, String\(e\.message \|\| e\)\)/.test(vms));
  ok('a failed or refused disk grow shakes Grow', (vms.match(/ccvFail\(btn, /g) || []).length === 2);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
