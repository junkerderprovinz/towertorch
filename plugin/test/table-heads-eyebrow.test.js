// Every table head TowerTorch restyles is GlimStone's eyebrow: no fill, the meta size in the
// muted ink, uppercase and tracked 1.2px, and nothing but space between it and the rows. Main,
// Shares, Docker, Plugins and VMs read alike. What can quietly break it:
//   · one table keeping its own shade, weight or tracking
//   · Unraid's tablesorter fill or its rule line under the head row coming back through a rule
//     that outweighs CC's
//   · a head that the light themes leave too faint to read on white
//   · Unraid's 2.8rem line on a head td making the Main and Shares heads taller than the rest
const { candidates, tokens, resolve, cmp, PAGES } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Unraid's own head rules from default-base.css and default-dynamix.css, the ones that compete.
const UNRAID_HEAD = { name: 'unraid head rules', css: `
table.tablesorter thead tr { border-bottom: 1px solid #333; }
table.tablesorter thead tr th { font-weight: normal; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; color: #f2f2f2; background-color: #3a3a3a; padding: 8px 20px 8px 6px; }
table.tablesorter thead tr .tablesorter-headerAsc, table.tablesorter thead tr .tablesorter-headerDesc { background-color: #3a3a3a; }
table.unraid thead tr:first-child > td { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; background-color: #3a3a3a; }
table.unraid thead tr:last-child { border-bottom: 1px solid #333; }
table:where(:not(.unapi *)) thead td { line-height: 2.8rem; height: 2.8rem; white-space: nowrap; }
` };
const page = (p) => [UNRAID_HEAD].concat(PAGES[p]);
const winner = (pg, el, props) => {
  // Every head described here has text, so a rule for an empty cell never reaches it.
  const all = props.flatMap((p) => candidates(pg, el, p)).filter((c) => !/:empty/.test(c.selector));
  all.sort((a, b) => (a.important - b.important) || cmp(a.spec, b.spec) || (a.order - b.order));
  return all[all.length - 1];
};

const HEADS = [
  ['Docker', 'docker', { tag: 'th', classes: ['tablesorter-header'], inside: ['.cc-enh', '.tablesorter'], html: ['cc-docker-on', 'cc-header-on', 'cc-popups-on'] }, ['.cc-enh', '.tablesorter']],
  ['Plugins', 'docker', { tag: 'th', classes: ['tablesorter-header'], inside: ['.cc-plug', '#plugin_table', '.tablesorter'], html: ['cc-on-plugins', 'cc-header-on', 'cc-popups-on'] }, ['.cc-plug', '#plugin_table', '.tablesorter']],
  ['Plugins, the other tables', 'docker', { tag: 'th', classes: [], inside: ['.cc-plug-lite', '.tablesorter'], html: ['cc-on-plugins', 'cc-header-on', 'cc-popups-on'] }, ['.cc-plug-lite', '.tablesorter']],
  ['VMs', 'every', { tag: 'th', classes: ['tablesorter-header'], inside: ['#displaybox', '#kvm_table', '.tablesorter'], html: ['cc-vms-on', 'cc-header-on', 'cc-popups-on'] }, ['#displaybox', '#kvm_table', '.tablesorter']],
  ['Shares', 'every', { tag: 'td', classes: [], inside: ['#displaybox', '.share_status', '.unraid'], html: ['cc-shares-on', 'cc-on-shares', 'cc-header-on', 'cc-popups-on'] }, ['#displaybox', '.share_status', '.unraid']],
  ['Main', 'every', { tag: 'td', classes: [], inside: ['#displaybox', '.disk_status', '.unraid'], outside: ['.tr_last', '.cc-tr-void', '.array_status'], html: ['cc-shares-on', 'cc-on-main', 'cc-header-on', 'cc-popups-on'] }, ['#displaybox', '.disk_status', '.unraid']],
  ['any other sortable table', 'every', { tag: 'th', classes: ['tablesorter-header'], inside: ['.tablesorter'], html: ['cc-header-on', 'cc-popups-on'] }, ['.tablesorter']],
];

const hex = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null; };
const lum = (c) => hex(c).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dark = tokens(false), light = tokens(true);

for (const [name, pg, el, ctx] of HEADS) {
  console.log('\n' + name);
  const sheets = page(pg);
  const bg = winner(sheets, el, ['background', 'background-color']);
  ok('no fill', !!bg && /^transparent$/.test(bg.value), bg && bg.sheet + ': ' + bg.selector + ' => ' + bg.value);
  const col = winner(sheets, el, ['color']);
  ok('the muted ink', !!col && col.value === 'var(--cc-text-dim, #8a8a8a)', col && col.sheet + ': ' + col.selector + ' => ' + col.value);
  const fs = winner(sheets, el, ['font-size']);
  ok('the meta size, 12px', !!fs && resolve(fs.value, dark) === '12px', fs && fs.selector + ' => ' + fs.value);
  const tt = winner(sheets, el, ['text-transform']), ls = winner(sheets, el, ['letter-spacing']);
  ok('uppercase, tracked 1.2px', !!tt && tt.value === 'uppercase' && !!ls && ls.value === '1.2px', (tt && tt.value) + ' / ' + (ls && ls.selector + ' => ' + ls.value));
  const sh = winner(sheets, el, ['box-shadow']);
  ok('no shade under it', !sh || sh.value === 'none', sh && sh.selector + ' => ' + sh.value);
  const pb = winner(sheets, el, ['padding-bottom', 'padding']);
  ok('space under it sets it apart', !!pb && /^12px$/.test(pb.value), pb && pb.selector + ' => ' + pb.value);
  if (el.tag === 'td') {
    const lh = winner(sheets, el, ['line-height']), h = winner(sheets, el, ['height']);
    ok('as tall as the th heads: no 2.8rem line', !!lh && lh.value === 'normal' && !!h && h.value === 'auto', (lh && lh.selector + ' => ' + lh.value) + ' / ' + (h && h.value));
  }
  const row = { tag: 'tr', classes: [], inside: ctx.concat(['thead']), html: el.html };
  const b = winner(sheets, row, ['border', 'border-bottom']);
  ok('no line under the head row', !!b && /^(none|0|0px)$/.test(b.value), b && b.sheet + ': ' + b.selector + ' => ' + b.value);
  if (col) {
    const d = resolve(col.value, dark), l = resolve(col.value, light);
    ok('readable on the dark pages', ['#000000', '#161616', '#1e1e1e'].every((p) => ratio(d, p) >= 4.5), d);
    ok('readable on white and on the light page base', ['#ffffff', '#f2f2f2'].every((p) => ratio(l, p) >= 4.5), l);
  }
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
