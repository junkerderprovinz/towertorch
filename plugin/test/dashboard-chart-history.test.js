// The Dashboard's CPU and network charts come back filled after a reload (dashboard.js), and an
// empty stretch shows a hairline instead of nothing (TowerTorch.Dashboard.css).
// What can quietly break it:
//   · a restored run joined to the live line across the time the page was closed
//   · points older than the frame on screen, or out of order, pushed into Unraid's series
//   · the history stored under a cc.* key, which the engine mirrors to every browser
//   · recording or restoring with the area off, or a stored history outliving the switch
//   · a restored run drawn in Unraid's colours while its twin wears the accent
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const js = fs.readFileSync(path.join(DIR, 'scripts/dashboard.js'), 'utf8');
const css = fs.readFileSync(path.join(DIR, 'sheets/TowerTorch.Dashboard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Smoothie's TimeSeries and chart, as far as dashboard.js touches them: append keeps time order
// and drops NaN, the chart owns a copy of each series' options.
class TimeSeries {
  constructor() { this.data = []; }
  append(t, v) {
    if (isNaN(t) || isNaN(v)) return;
    let i = this.data.length;
    while (i > 0 && this.data[i - 1][0] > t) i--;
    if (i > 0 && this.data[i - 1][0] === t) this.data[i - 1][1] = v; else this.data.splice(i, 0, [t, v]);
  }
}
class Chart {
  constructor(strokes) {
    this.options = { grid: { strokeStyle: '#2b2b2b', verticalSections: 4, borderVisible: true }, labels: { fillStyle: '#f2f2f2' } };
    this.seriesSet = [];
    this.series = strokes.map((s) => { const ts = new TimeSeries(); this.addTimeSeries(ts, { strokeStyle: s, lineWidth: 1 }); return ts; });
  }
  addTimeSeries(ts, o) { this.seriesSet.push({ timeSeries: ts, options: Object.assign({}, o) }); }
  removeTimeSeries(ts) { this.seriesSet = this.seriesSet.filter((s) => s.timeSeries !== ts); }
}

// A Dashboard after DashStats.page ran: the two charts and their three series, the frames from
// Unraid's settings, a clock the test moves, timers it fires by hand.
function page(store, opt = {}) {
  const clock = { now: opt.now || 1e12 };
  const timers = [], on = {};
  const cpuchart = new Chart(['#ff8c2f']), netchart = new Chart(['#e22828', '#ff8c2f']);
  const win = {
    cpuchart, netchart, cpuTimeSeries: cpuchart.series[0], rxTimeSeries: netchart.series[0], txTimeSeries: netchart.series[1],
    TimeSeries, cpuline: opt.cpuline || 30, netline: opt.netline || 30,
    addEventListener: (t, f) => { (on[t] = on[t] || []).push(f); },
  };
  const ctx = {
    window: win, location: { pathname: '/Dashboard' }, Date: { now: () => clock.now },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    setTimeout: (f) => timers.push(f), clearTimeout: () => {},
    getComputedStyle: () => ({ getPropertyValue: (p) => (p === '--cc-accent' ? '#1f9d55' : p === '--cc-text' ? '#e6e6e6' : '') }),
    document: {
      readyState: 'complete',
      documentElement: { lang: 'de', classList: { toggle() {} } },
      querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener() {},
    },
  };
  Object.assign(win, { localStorage: ctx.localStorage });
  vm.runInNewContext(js, ctx);
  return {
    win, clock, store,
    leave: () => (on.pagehide || []).forEach((f) => f()),
    flush: () => timers.splice(0).forEach((f) => f()),
    fire: (key) => (on.storage || []).forEach((f) => f({ key })),
  };
}
const LIVE = () => ({ 'cc.enable.header': '1' });
// Unraid's feed: one point a second on all three series, ending at the given time.
function feed(p, from, to) {
  for (let t = from; t <= to; t += 1000) {
    p.clock.now = t;
    p.win.cpuTimeSeries.append(t, 12.4);
    p.win.rxTimeSeries.append(t, 800 + (t / 1000) % 7);
    p.win.txTimeSeries.append(t, 90);
  }
}
const T = 1e12;

console.log('\nThe last minutes are kept in this browser');
{
  const p = page(LIVE(), { now: T });
  feed(p, T, T + 400000);
  p.leave();
  const kept = JSON.parse(p.store['tt.charts'] || '{}');
  ok('all three series are kept', ['cpu', 'rx', 'tx'].every((k) => Array.isArray(kept[k]) && kept[k].length > 0), Object.keys(kept));
  const n = kept.rx.length / 2;
  ok('no further back than the longest frame Unraid offers', n <= 301 && n >= 290, n);
  ok('the first time is whole and every later one a step', kept.rx[0] > T && kept.rx.slice(2).filter((_, i) => i % 2 === 0).every((d) => d === 1000));
  ok('values are rounded', kept.cpu.filter((_, i) => i % 2 === 1).every((v) => v === 12));
  ok('nothing goes under a key the engine mirrors', !Object.keys(p.store).some((k) => /^cc[a-z]*\./.test(k) && k !== 'cc.enable.header'), Object.keys(p.store));
}
{
  const p = page(LIVE(), { now: T });
  feed(p, T, T + 3000);
  ok('a write waits for the timer instead of following every point', !('tt.charts' in p.store));
  p.flush();
  ok('and the timer writes', 'tt.charts' in p.store);
}

console.log('\nA reload comes back filled');
{
  const first = page(LIVE(), { now: T });
  feed(first, T, T + 120000);
  first.leave();
  const p = page({ ...LIVE(), 'tt.charts': first.store['tt.charts'] }, { now: T + 121500, netline: 30, cpuline: 60 });
  const rx = p.win.rxTimeSeries.data, cpu = p.win.cpuTimeSeries.data;
  ok('the series hold the points of the frame on screen', rx.length >= 29 && rx.length <= 31 && cpu.length >= 59 && cpu.length <= 61, rx.length + ' ' + cpu.length);
  ok('none older than the frame', rx[0][0] > T + 121500 - 30000, rx[0][0] - T);
  ok('in time order', rx.every((p2, i) => !i || rx[i - 1][0] < p2[0]));
  ok('joined to the live line, with no extra series', p.win.netchart.seriesSet.length === 2 && p.win.cpuchart.seriesSet.length === 1);
  feed(p, T + 122000, T + 124000);
  ok('Unraid\'s own points follow on the same line', rx[rx.length - 1][0] === T + 124000 && rx.length >= 31);
  ok('they are kept again, not the restored ones twice', (() => { p.leave(); const k = JSON.parse(p.store['tt.charts']).rx; return k.length / 2 === 124; })(), JSON.parse(p.store['tt.charts']).rx.length / 2);
}

console.log('\nA gap stays a gap');
{
  const first = page(LIVE(), { now: T });
  feed(first, T, T + 60000);
  first.leave();
  const p = page({ ...LIVE(), 'tt.charts': first.store['tt.charts'] }, { now: T + 90000, netline: 300 });
  const net = p.win.netchart;
  ok('a run that ends well before the page came back is not put into Unraid\'s series', p.win.rxTimeSeries.data.length === 0);
  const past = net.seriesSet.filter((s) => s.ccPast);
  ok('it gets a series of its own per line', past.length === 2 && past[0].timeSeries.data.length === 61, past.length);
  ok('which draws with its twin\'s options', past.length === 2 && past[0].options === net.seriesSet[0].options && past[1].options === net.seriesSet[1].options);
  ok('so the accent reaches the restored inbound run too', past.length === 2 && past[0].options.strokeStyle === '#1f9d55' && past[1].options.strokeStyle === '#e6e6e6', past.length);
  feed(p, T + 91000, T + 400000);
  ok('it leaves once it has scrolled out', !net.seriesSet.some((s) => s.ccPast) && net.seriesSet.length === 2, net.seriesSet.length);
}
{
  // two visits with a pause between them, the second ending just before the reload
  const first = page(LIVE(), { now: T });
  feed(first, T, T + 40000);
  first.leave();
  const second = page({ ...LIVE(), 'tt.charts': first.store['tt.charts'] }, { now: T + 100000 });
  feed(second, T + 100000, T + 160000);
  second.leave();
  const p = page({ ...LIVE(), 'tt.charts': second.store['tt.charts'] }, { now: T + 162000, netline: 300 });
  const past = p.win.netchart.seriesSet.filter((s) => s.ccPast);
  ok('the older visit is a run of its own', past.length === 2 && past[0].timeSeries.data.every((q) => q[0] <= T + 40000), past.length);
  ok('the visit before the reload joins the live line', p.win.rxTimeSeries.data.length === 61 && p.win.rxTimeSeries.data[0][0] === T + 100000);
}

console.log('\nThe off switch');
{
  const store = { 'cc.enable.header': '1', 'cc.theming': '0', 'tt.charts': JSON.stringify({ rx: [T, 5, 1000, 6] }) };
  const p = page(store, { now: T + 1500 });
  ok('nothing is restored with theming off', p.win.rxTimeSeries.data.length === 0);
  ok('the stored history goes', !('tt.charts' in p.store));
  feed(p, T + 2000, T + 9000);
  p.flush(); p.leave();
  ok('and nothing is recorded', !('tt.charts' in p.store));
  ok('Unraid\'s append stays its own', p.win.rxTimeSeries.append === TimeSeries.prototype.append);
}
{
  const first = page(LIVE(), { now: T });
  feed(first, T, T + 30000);
  first.leave();
  const store = { ...LIVE(), 'tt.charts': first.store['tt.charts'] };
  const p = page(store, { now: T + 60000, netline: 300 });
  ok('a gap run is up before the switch', p.win.netchart.seriesSet.some((s) => s.ccPast));
  store['cc.enable.header'] = '0';
  p.fire('cc.enable.header');
  ok('switched off, the restored runs leave the chart', !p.win.netchart.seriesSet.some((s) => s.ccPast) && p.win.netchart.seriesSet.length === 2);
  ok('the stored history goes', !('tt.charts' in store));
  feed(p, T + 61000, T + 70000);
  p.flush(); p.leave();
  ok('and recording stops', !('tt.charts' in store));
}

console.log('\nThe hairline');
{
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /#cpuchart, #netchart/.test(m[1]));
  ok('both charts have one', !!rule);
  ok('only with the area on', rule && /^html\.cc-dash-on /.test(rule[1].trim()));
  ok('a single pixel at the foot, in the dim text colour', rule && /var\(--cc-text-dim/.test(rule[2]) && /left bottom \/ 100% 1px no-repeat/.test(rule[2]), rule && rule[2]);
  ok('drawn as a background, under the lines', rule && /background:/.test(rule[2]) && !/box-shadow|border/.test(rule[2]));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
