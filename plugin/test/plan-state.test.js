// The Startplan badge says where its container stands, "Startplan · wartet", "· bereit" or
// "· fehlgeschlagen", in the state colour, in place of a separate dot beside it. A container that
// waits for nothing keeps the plain badge.
const fs = require('fs');
const path = require('path');
const { DIR, candidates } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const docker = read('scripts/docker.js');
function grabFn(name) {
  const i = docker.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = docker.indexOf('{', i); k < docker.length; k++) { if (docker[k] === '{') d++; else if (docker[k] === '}') { d--; if (!d) return docker.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const labels = (key) => new Function('return ' + (new RegExp('var ' + key + ' = (\\{[\\s\\S]*?\\n  \\});').exec(docker) || [])[1])();

class Chip {
  constructor() { this.cls = new Set(); this.attrs = {}; this.v = { textContent: '' }; const self = this; this.classList = { toggle: (c, f) => (f ? self.cls.add(c) : self.cls.delete(c)), contains: (c) => self.cls.has(c) }; }
  querySelector() { return this.v; }
  setAttribute(k, v) { this.attrs[k] = v; } removeAttribute(k) { delete this.attrs[k]; }
}
const env = { workingPlan: {}, lastRun: {}, containers: {} };
const api = new Function('env', 'RUN_LABELS', 'STATE_LABELS',
  'var LANG = "de"; var T = { de: { active: "aktiv", depsOk: "Alle Abhängigkeiten bereit", depsBad: "Abhängigkeit nicht bereit:", depNotRun: "noch nicht geprüft" } };' +
  'function t(k) { return T.de[k]; } var workingPlan = env.workingPlan, lastRun = env.lastRun;' +
  'function containerByName(n) { return env.containers[n] || null; }' +
  'function depsTxt(node) { return node ? t("active") : ""; }' +
  ['runLabel', 'stateLabel', 'planState'].map(grabFn).join('\n') + '\n' + /var PLAN_STATES = [^\n]*/.exec(docker)[0] + '\n' + grabFn('showPlanState') +
  '\nreturn { planState: planState, show: showPlanState };')(env, labels('RUN_LABELS'), labels('STATE_LABELS'));

const shown = (name) => { const c = new Chip(); api.show(c, name); return c; };

console.log('\nThe badge carries the state');
{
  env.workingPlan.app = { name: 'app', after: ['db', 'cache'] };
  env.containers.db = { state: 'running' }; env.containers.cache = { state: 'exited' };
  let c = shown('app');
  ok('a dependency that is not up yet makes it wait', c.v.textContent === 'wartet' && c.cls.has('tt-plan-pending'), c.v.textContent);
  ok('its bubble names the dependency and why', /cache \(gestoppt\)/.test(c.attrs['data-tip'] || ''), c.attrs['data-tip']);
  env.containers.cache.state = 'running';
  c = shown('app');
  ok('all of them running makes it ready', c.v.textContent === 'bereit' && c.cls.has('tt-plan-ready') && !c.cls.has('tt-plan-pending'));
  ok('and the bubble says so', c.attrs['data-tip'] === 'Alle Abhängigkeiten bereit');
  env.lastRun.db = { state: 'failed', reason: 'probe timed out' };
  c = shown('app');
  ok('a failed dependency makes it fail, whatever the live state says', c.v.textContent === 'fehlgeschlagen' && c.cls.has('tt-plan-failed'));
  ok('with the reason in the bubble', /db \(fehlgeschlagen: probe timed out\)/.test(c.attrs['data-tip']));
  env.lastRun.db = { state: 'skipped' };
  ok('a skipped one counts as failed', shown('app').cls.has('tt-plan-failed'));
  env.lastRun.db = { state: 'degraded' };
  ok('a degraded one lets its dependents start, so it counts as ready', shown('app').cls.has('tt-plan-ready'));
  env.lastRun.db = { state: 'starting' };
  ok('one still starting makes it wait', shown('app').cls.has('tt-plan-pending'));
  env.workingPlan.solo = { name: 'solo', after: [] };
  c = shown('solo');
  ok('a container that waits for nothing keeps the plain badge', c.v.textContent === 'aktiv' && !['ready', 'pending', 'failed'].some((s) => c.cls.has('tt-plan-' + s)) && !('data-tip' in c.attrs));
  ok('one outside the plan says nothing', shown('elsewhere').v.textContent === '');
}

console.log('\nNo dot beside it');
ok('the separate readiness dot is gone', !/depStateDot/.test(docker));
ok('the plan badge and the window\'s refresh draw the state the same way', /showPlanState\(chip, name\);/.test(grabFn('planBadge')) && /showPlanState\(chip, name\)/.test(grabFn('refreshChip')));

console.log('\nThe state colour holds in every colour mode');
{
  for (const [state, fill, ink] of [['ready', '--tt-ok', '--tt-ok-fg'], ['pending', '--tt-warn', '--tt-warn-fg'], ['failed', '--tt-err', '--tt-err-fg']]) {
    for (const html of [['tt-docker-on'], ['tt-docker-on', 'tt-shares-rbneutral'], ['tt-docker-on', 'tt-rb-on']]) {
      const e = { tag: 'a', classes: ['tt-b', 'tt-plan', 'tt-plan-on', 'tt-plan-' + state], attrs: { class: 'tt-b tt-plan', href: '#' }, states: {}, html, inside: ['.tt-enh.tt-rainbow', '#docker_list', '.tt-grid-holder.tt-rainbow'], outside: ['.appname', '.ct-name'] };
      const bg = candidates('docker', e, 'background').pop(), fg = candidates('docker', e, 'color').pop();
      ok(state + ' under ' + html.join(' ') + ': the state colour and its ink win', bg && bg.value.indexOf('var(' + fill + ',') === 0 && fg && fg.value.indexOf('var(' + ink + ',') === 0, (bg && bg.selector + ' ' + bg.value) + ' || ' + (fg && fg.selector + ' ' + fg.value));
    }
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
