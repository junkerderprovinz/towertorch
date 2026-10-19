// Unraid's two quick-scroll arrows are small chips in the bottom right corner, standing on whatever
// is docked at the bottom edge, and show only while the page scrolls, so they never rest over a
// card.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR, candidates } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const header = read('scripts/header.js');
const tokens = read('sheets/TowerTorch.Tokens.css');
const body = (name) => { const i = header.indexOf('function ' + name + '('); return i < 0 ? '' : header.slice(i, header.indexOf('\n  }\n', i)); };
const all = (el, prop, html) => candidates('every', Object.assign({ states: {}, html: ['cc-popups-on'].concat(html || []) }, el), prop);
const val = (el, prop, html) => { const c = all(el, prop, html); return c.length ? c[c.length - 1].value : null; };
const up = { tag: 'a', classes: ['back_to_top'], attrs: { class: 'back_to_top' } };
const down = { tag: 'a', classes: ['move_to_end'], attrs: { class: 'move_to_end' } };

console.log('\nWhere they sit');
{
  ok('in the bottom corner, on whatever is docked there', val(down, 'bottom') === 'calc(var(--cc-arrows-floor, 0px) + 12px)' && val(up, 'bottom') === val(down, 'bottom'));
  ok('not lifted for an action bar the page may not have', all(down, 'transform').length === 0 && !/--cc-actbar-h, 44px/.test(tokens));
  ok('the down arrow at the content edge, the up arrow one chip to its left', /\+ var\(--cc-md-h, 30px\) \+ 6px\)$/.test(val(up, 'right')) && !/--cc-md-h/.test(val(down, 'right')));
  ok('a chip of the small control height', val(down, 'width') === 'var(--cc-md-h, 30px)' && val(down, 'height') === 'var(--cc-md-h, 30px)');
}

console.log('\nWhen they show');
{
  const hides = (el, html) => all(el, 'opacity', html).some((d) => d.value === '0' && d.selector.includes(':not(.cc-arrows-live)'));
  ok('at rest they are hidden', hides(down) && hides(up));
  ok('and cannot be hit', all(down, 'pointer-events').some((d) => d.value === 'none' && d.selector.includes(':not(.cc-arrows-live)')));
  ok('while the page scrolls they show', !hides(down, ['cc-arrows-live']) && !hides(up, ['cc-arrows-live']));
  ok('keyboard focus keeps one on screen', !hides(Object.assign({}, down, { states: { 'focus-visible': true } })));
  ok('a pointer keeps one on screen, except on a touch screen', /@media \(hover: hover\) \{\s*html\.cc-popups-on:not\(\.cc-arrows-live\) :is\(a\.back_to_top, a\.move_to_end\):not\(:hover\):not\(:focus-visible\)/.test(tokens) && /@media \(hover: none\) \{\s*html\.cc-popups-on:not\(\.cc-arrows-live\) :is\(a\.back_to_top, a\.move_to_end\):not\(:focus-visible\) \{/.test(tokens));
  ok('the fade runs only where motion is allowed', /@media \(prefers-reduced-motion: no-preference\) \{\s*html\.cc-popups-on:not\(\[data-cc-motion="off"\]\) :is\(a\.back_to_top, a\.move_to_end\) \{ transition: opacity \.3s/.test(tokens));
  ok('and no rule outside that gate fades them', !all(down, 'transition').some((d) => /opacity/.test(d.value) && !d.selector.includes('data-cc-motion')));
  ok('the down arrow still goes at the bottom of the page', val(down, 'opacity', ['cc-arrows-live', 'cc-footer-at-bottom']) === '0');
}

// A minimal browser around the scroll handler: the timer runs by hand.
function load(docked) {
  const cls = new Set(), vars = {}, timers = [];
  const root = { clientHeight: 800, classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, style: { setProperty: (k, v) => { vars[k] = v; } } };
  const ctx = vm.createContext({
    document: { documentElement: root, querySelectorAll: () => docked },
    getComputedStyle: (el) => ({ position: el.position }),
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; },
    clearTimeout: () => {},
  });
  vm.runInContext('var ccArrowsIdle = 0, ccArrowsFloor = -1;\n' + ['ccArrowsFloorMeasure', 'ccArrowsWake'].map((n) => body(n) + '\n  }\n').join(''), ctx);
  return { ctx, cls, vars, timers };
}
const box = (position, top, height) => ({ position, getBoundingClientRect: () => ({ top, height }) });

console.log('\nThe scroll handler');
{
  const w = load([box('fixed', 744, 56)]);
  w.ctx.ccArrowsWake();
  ok('a scroll shows the arrows', w.cls.has('cc-arrows-live'));
  ok('standing on a docked bar', w.vars['--cc-arrows-floor'] === '56px', w.vars['--cc-arrows-floor']);
  const [f, ms] = w.timers[w.timers.length - 1];
  ok('after a short rest', ms > 500 && ms < 3000, ms);
  f();
  ok('they go again', !w.cls.has('cc-arrows-live'));
  const flow = load([box('relative', 744, 56), box('fixed', 820, 40)]);
  flow.ctx.ccArrowsWake();
  ok('a footer in the page flow or below the fold lifts nothing', flow.vars['--cc-arrows-floor'] === '0px', flow.vars['--cc-arrows-floor']);
  ok('the scroll listener is passive', /window\.addEventListener\("scroll", ccArrowsWake, \{ passive: true \}\);/.test(header));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
