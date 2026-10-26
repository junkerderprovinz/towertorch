// Unraid's lock makes the Docker list sortable, and then every row wiggles and wears a grip on its
// logo tile in place of the orange arrow. What can quietly break it:
//   · a wiggle outside the no-preference gate, or one that ignores the "off" level
//   · a wiggle on the dragged row or the row under the pointer, whose transform would make it the
//     containing block of what opens from it and tilt the clone jQuery UI drags
//   · a beat that does not start and end untransformed
//   · rows wiggling in step, which reads as the whole list tilting
//   · the grip showing outside the move mode, or catching the press the row needs for the drag
//   · the native arrow coming back beside the grip
const fs = require('fs');
const path = require('path');
const { DIR } = require('./cascade');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const docker = read('styles/docker.css');
const js = read('scripts/docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Every rule with the @media conditions it sits in.
function rules(css) {
  const out = []; const stack = []; let buf = '';
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') { stack.push(buf.trim()); buf = ''; }
    else if (ch === '}') { const head = stack.pop(); if (head !== undefined) out.push({ sel: head, body: buf.trim(), media: stack.join(' ') }); buf = ''; }
    else buf += ch;
  }
  return out;
}
const css = rules(docker);

console.log('\nThe rows wiggle only in the move mode, and only where motion is wanted');
{
  const wig = css.filter((r) => /animation:\s*cc-row-wiggle\b/.test(r.body));
  ok('one rule runs the wiggle', wig.length === 1, wig.map((r) => r.sel).join(' | '));
  const w = wig[0] || { sel: '', body: '', media: '' };
  ok('inside the no-preference gate', /prefers-reduced-motion:\s*no-preference/.test(w.media), w.media);
  ok('and still at the "off" level', /html\.cc-docker-on:not\(\[data-cc-motion="off"\]\)/.test(w.sel), w.sel);
  ok('on the rows of a sortable list', /#docker_list\.ui-sortable > tr\.sortable/.test(w.sel), w.sel);
  ok('never on the row under the pointer, the focused one, the dragged clone or its placeholder',
    /:not\(:hover, :focus-within, \.ui-sortable-helper, \.ui-sortable-placeholder\)/.test(w.sel), w.sel);
  ok('at the motion engine\'s pace', /var\(--cc-motion-wiggle-dur\b/.test(w.body), w.body);
  const delays = css.filter((r) => /#docker_list\.ui-sortable > tr\.sortable:nth-child\(\d+n\)/.test(r.sel) && /animation-delay:\s*calc\(var\(--cc-motion-wiggle-dur\b[^)]*\) \* -[.\d]+\)/.test(r.body));
  ok('neighbours start at different points of the beat', delays.length >= 2 && new Set(delays.map((r) => r.body)).size === delays.length, delays.map((r) => r.body).join(' | '));
  ok('the phase rules sit beside the wiggle, so they never start it on their own', delays.every((r) => r.media === w.media && /:not\(\[data-cc-motion="off"\]\)/.test(r.sel)));
}

console.log('\nOne beat');
{
  const kf = /@keyframes cc-row-wiggle \{([\s\S]*?)\n\}/.exec(docker.replace(/\/\*[\s\S]*?\*\//g, ''));
  ok('the keyframes are there', !!kf);
  const body = kf ? kf[1] : '';
  ok('it starts and ends untransformed', /0%, 100% \{ transform: none; \}/.test(body), body);
  ok('it tilts and lifts by the motion dials', /rotate\([^;]*--cc-motion-wiggle-tilt\b/.test(body) && /translateY\([^;]*--cc-motion-wiggle-lift\b/.test(body), body);
  const tokens = rules(read('sheets/TowerTorch.Tokens.css'));
  const val = (sel, gated, name) => { const r = tokens.find((x) => x.sel === sel && /no-preference/.test(x.media) === gated && x.body.includes(name)); const m = r && new RegExp(name + ':\\s*([^;]+);').exec(r.body); return m ? m[1].trim() : null; };
  const tilt = (sel) => parseFloat(val(sel, true, '--cc-motion-wiggle-tilt'));
  ok('a wide row tilts by a fraction of a degree', tilt('html') > 0 && tilt('html') <= .25, val('html', true, '--cc-motion-wiggle-tilt'));
  ok('subtle tilts less than wild', tilt('html[data-cc-motion="subtle"]') > 0 && tilt('html[data-cc-motion="subtle"]') < tilt('html'));
  ok('the still numbers do not move at all', val('html', false, '--cc-motion-wiggle-tilt') === '0deg' && val('html[data-cc-motion="off"]', true, '--cc-motion-wiggle-tilt') === '0deg');
}

console.log('\nThe grip stands in for the orange arrow');
{
  ok('docker.js puts a grip from the glyph set on the logo tile', /var grip = el\("span", "cc-grip"\); grip\.setAttribute\(MARK, "1"\); grip\.innerHTML = ccGlyph\("Grip"\);\s*tile\.appendChild\(grip\);/.test(js));
  ok('only with theming on, so the native arrow serves without it', (() => { const i = js.indexOf('ccGlyph("Grip")'); const gate = js.lastIndexOf('if (themingOn()) {', i); return i > 0 && gate > 0 && i - gate < 1500; })());
  const hid = css.find((r) => r.sel === 'html td.ct-name span.cc-pick > .cc-grip');
  ok('hidden outside the move mode', !!hid && /display:\s*none/.test(hid.body));
  const shown = css.find((r) => r.sel === 'html.cc-docker-on #docker_list.ui-sortable td.ct-name span.cc-pick > .cc-grip');
  ok('shown while the list is sortable', !!shown && /display:\s*inline-flex/.test(shown.body));
  const b = shown ? shown.body : '';
  ok('as a badge in the shape setting\'s radius', /border-radius:\s*var\(--cc-radius-pill\)/.test(b) && /background:\s*var\(--cc-surface-3\b/.test(b));
  ok('that lets the press through to the row, which is the drag handle', /pointer-events:\s*none/.test(b));
  const hot = css.find((r) => /#docker_list\.ui-sortable tr:is\(:hover, \.ui-sortable-helper\)[^,]*\.cc-grip$/.test(r.sel));
  ok('the row under the pointer and the dragged one light it in the row\'s colour', !!hot && /background:\s*var\(--cc-rb-c, var\(--cc-rbaccent, var\(--cc-accent\b/.test(hot.body) && /color:\s*var\(--cc-rb-ct\b/.test(hot.body), hot && hot.sel);
  ok('Unraid\'s arrow stays away', css.some((r) => r.sel === 'html.cc-docker-on #docker_list i.mover' && /display:\s*none !important/.test(r.body)));
  const ph = css.find((r) => r.sel === 'html.cc-docker-on #docker_list tr.ui-sortable-placeholder');
  ok('the slot the row will land in shows as a shade', !!ph && /visibility:\s*visible !important/.test(ph.body) && /background:\s*var\(--cc-chip\)/.test(ph.body));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
