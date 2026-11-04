// Every setting carries an (i) (GlimStone rule 8). Unraid writes one help block after a list of
// several rows, and that block explains the last labelled row, where Unraid also puts its help
// cursor. The rows Unraid and two plugins ship without help get their bubble from TowerTorch's own table, keyed by the
// field's name, and a plugin page without a German translation gets German labels.
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
const header = fs.readFileSync(path.join(DIR, 'scripts/header.js'), 'utf8');
const fnSrc = (name) => { const i = header.indexOf('function ' + name + '('); return header.slice(i, header.indexOf('\n  }\n', i) + 4); };
const varSrc = (name, end) => { const i = header.indexOf('var ' + name + ' = '); return header.slice(i, header.indexOf(end, i) + end.length); };

// A described DOM: just enough of Element and Text for the three functions.
class Text { constructor(v) { this.nodeType = 3; this.nodeValue = v; this.parentElement = null; } }
class El {
  constructor(tag, cls, kids) { this.tagName = tag.toUpperCase(); this.className = cls || ''; this.childNodes = []; this.attrs = {}; (kids || []).forEach((k) => this.appendChild(k)); }
  appendChild(k) { k.parentElement = this; this.childNodes.push(k); return k; }
  closest(sel) { let e = this; while (e) { if (sel === '.tt-toolsinfo' && /\btt-toolsinfo\b/.test(e.className)) return e; e = e.parentElement; } return null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  all() { return this.childNodes.filter((k) => k instanceof El).flatMap((k) => [k].concat(k.all())); }
  querySelector(sel) {
    if (sel === '.tt-toolsinfo') return this.all().find((e) => /\btt-toolsinfo\b/.test(e.className)) || null;
    return this.all().find((e) => e.name && !/^(hidden|button|submit)$/.test(e.type)) || null;
  }
  querySelectorAll(sel) { return sel === ':scope > dt' ? this.childNodes.filter((k) => k.tagName === 'DT') : []; }
  get nextElementSibling() { const s = this.parentElement.childNodes.filter((k) => k instanceof El); return s[s.indexOf(this) + 1] || null; }
}
Object.defineProperty(Text.prototype, 'parentNode', { get() { return this.parentElement; } });
const texts = (root) => { const out = []; (function walk(n) { n.childNodes.forEach((k) => (k instanceof Text ? out.push(k) : walk(k))); })(root); return out; };
const doc = (dts) => ({
  createTreeWalker: (root) => { const t = texts(root); let i = 0; return { nextNode: () => t[i++] || null }; },
  createElement: (tag) => new El(tag),
  querySelectorAll: () => dts
});
const T = (de) => de;
const make = (dts, pathname) => new Function('document', 'NodeFilter', 'location', 'LANG', 'T',
  fnSrc('ttLabelText') + fnSrc('ttHelpOwner') + varSrc('NTP_SRV', '];') + varSrc('PTP_SRV', '];') + varSrc('AMD_UNIT', '];') + varSrc('TT_ROW_HELP', '\n  };') + fnSrc('ttRowHelp') +
  '\nreturn { ttHelpOwner: ttHelpOwner, ttRowHelp: ttRowHelp, TT_ROW_HELP: TT_ROW_HELP };')(doc(dts || []), { SHOW_TEXT: 4 }, { pathname: pathname || '/' }, 'de', T);

console.log('\nA help block after several rows');
{
  const lang = new El('dt', '', [new Text('Hinweis zur Sprachen-Aktualisierung')]);
  const status = new El('dt', '', [new Text('Array-Statusmeldung')]);
  const dl = new El('dl', '', [lang, new El('dd'), status, new El('dd')]);
  const fns = make();
  ok('belongs to the last labelled row', fns.ttHelpOwner(dl) === status);
  const avail = new El('dt', '', [new El('span', '', [new Text('Verfügbare Meldungen:')])]);
  const dl2 = new El('dl', '', [avail, new El('dd'), new El('dt'), new El('dd'), new El('dt'), new El('dd')]);
  ok('empty structural rows after it do not count', fns.ttHelpOwner(dl2) === avail);
  ok('the resolver asks for that row', header.includes('lab = pv.tagName === "DL" ? ttHelpOwner(pv) : pv;'));
}

console.log('\nA row Unraid leaves without help');
{
  const field = (name, type) => { const e = new El('input'); e.name = name; e.type = type || 'text'; return e; };
  const row = (label, ctl) => { const dt = new El('dt', '', [new Text(label)]); new El('dl', '', [dt, new El('dd', '', [ctl])]); return dt; };
  const spindown = row('Verzögerung beim Herunterfahren', field('diskSpindownDelay.1'));
  const enabled = row('Dienst', field('Enabled'));
  const button = row('SMART-Bericht herunterladen', field('diskSpindownDelay', 'button'));
  const unknown = row('Something new', field('brand_new'));
  const gpu = row('Temperature Format', field('TEMPFORMAT'));
  const hasInfo = (dt) => !!dt.querySelector('.tt-toolsinfo');
  make([spindown, enabled, button, unknown, gpu], '/Main/Device').ttRowHelp();
  ok('gets the bubble for its field, whatever the numbered suffix', hasInfo(spindown));
  ok('a generic name only counts on its own page', !hasInfo(enabled));
  ok('a button is an action, not a setting', !hasInfo(button));
  ok('a field TowerTorch has no text for stays as it is', !hasInfo(unknown));
  ok('a plugin page without German gets the German label', texts(gpu)[0].nodeValue === 'Temperatureinheit' && hasInfo(gpu));
  make([enabled], '/Settings/Notifications').ttRowHelp();
  ok('and on its own page it does', hasInfo(enabled));
}

console.log('\nThe texts');
{
  const entries = Object.entries(make().TT_ROW_HELP);
  const sentence = (s) => /[.!?]$/.test(s);
  ok('every entry has a German and an English sentence', entries.every(([, e]) => sentence(e[0]) && sentence(e[1])), entries.filter(([, e]) => !sentence(e[0]) || !sentence(e[1])).map(([k]) => k).join(' '));
  const dashes = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
  ok('no en or em dash anywhere', entries.every(([, e]) => e.every((s) => !dashes.some((d) => s.includes(d)))));
  ok('a German label is a name, not a sentence', entries.every(([, e]) => !e[2] || !sentence(e[2])));
  ok('a page-scoped key names its path', entries.every(([k]) => !/\s/.test(k) || /^\/[A-Za-z/]+ [A-Za-z_]+$/.test(k)));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
