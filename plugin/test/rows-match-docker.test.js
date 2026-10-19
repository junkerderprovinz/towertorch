// The VM and Plugins tabs draw their rows the way the Docker tab does: the same header, the same
// centred cells and density, the same logo tile and state dot, and every plugin logo at one size.
// What can quietly break it:
//   · one tab keeping its own header shade or letter spacing
//   · a VM gear with a margin the Docker gear lost, which makes the VM resource lines taller
//   · the VM state as a text pill while Docker shows a dot
//   · a resting VM tile in a fixed dark grey that stands as a black plate on the white theme
//   · a plugin row ignoring the density setting
//   · a fetched plugin logo skipping the crop, so it fills its box while the others fill 82%
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');
const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const docker = clean(read('styles/docker.css')), vm = clean(read('sheets/TowerTorch.VmTab.css'));
const vmsJs = read('scripts/vms.js'), plugJs = read('scripts/plugins.js'), dockerJs = read('scripts/docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };
function body(css, sel) {
  const re = /([^{}]+)\{([^}]*)\}/g; let m;
  while ((m = re.exec(css))) if (m[1].split(/,(?![^(]*\))/).map((s) => s.trim()).includes(sel)) return m[2];
  return null;
}
const decl = (b, prop) => ((new RegExp('(?:^|;)\\s*' + prop + ':\\s*([^;]+)').exec(b || '') || [])[1] || '').trim();

console.log('\nOne header for all three tables');
{
  const dk = body(docker, 'html.cc-docker-on table.cc-enh thead th');
  const pl = body(docker, 'html.cc-on-plugins table.cc-plug thead th');
  const vmh = body(vm, 'html.cc-vms-on #displaybox table.tablesorter thead th');
  for (const prop of ['background', 'color', 'letter-spacing', 'font-weight', 'text-transform']) {
    ok('Plugins header ' + prop + ' as on Docker', !!pl && decl(pl, prop) === decl(dk, prop), decl(pl, prop) + ' vs ' + decl(dk, prop));
    ok('VM header ' + prop + ' as on Docker', !!vmh && decl(vmh, prop) === decl(dk, prop), decl(vmh, prop) + ' vs ' + decl(dk, prop));
  }
}

console.log('\nThe VM row');
{
  const cell = body(vm, 'html.cc-vms-on #displaybox #kvm_list tr.sortable > td');
  ok('every cell is centred', /vertical-align: middle !important/.test(cell || ''), cell);
  const vg = body(vm, 'html.cc-vms-on #kvm_list .cc-limbtn'), dg = body(docker, '.cc-limbtn');
  ok('the gear has the Docker gear\'s margin', decl(vg, 'margin') === decl(dg, 'margin'), decl(vg, 'margin') + ' vs ' + decl(dg, 'margin'));
  const dot = body(vm, 'html.cc-vms-on #kvm_list td.vm-name .inner > span.state.cc-badge'), ddot = body(docker, '.cc-enh .cc-ct-dotrow > .cc-badge');
  for (const prop of ['width', 'height', 'border-radius', 'font-size', 'box-shadow']) ok('the state is the Docker dot: ' + prop, !!dot && decl(dot, prop) === decl(ddot, prop), decl(dot, prop) + ' vs ' + decl(ddot, prop));
  ok('its label goes into the tooltip', /st\.setAttribute\("data-tip", txt\);/.test(vmsJs));
  ok('and comes out again when theming goes off', /st\.className = "state"; st\.style\.cssText = ""; st\.removeAttribute\("data-tip"\);/.test(vmsJs));
  const vrest = body(vm, 'html.cc-vms-on.cc-vm-iconbg.cc-vm-rbneutral #kvm_list td.vm-name .outer > span.hand');
  const drest = body(docker, 'html.cc-shares-rbneutral.cc-docker-on .cc-enh.cc-docker-iconbg #docker_list td.ct-name .outer > span.hand');
  ok('a resting tile in the reactive mode is the Docker tile\'s grey', !!vrest && decl(vrest, 'background') === decl(drest, 'background'), decl(vrest, 'background') + ' vs ' + decl(drest, 'background'));
}

console.log('\nThe logo tile shows under the same switch on all three tabs');
{
  ok('Docker: the Logo tiles switch alone', /function iconBgOn\(\) \{ return effc\("iconbg"\) === "1"; \}/.test(dockerJs));
  ok('Plugins: the same', /function iconBgOnP\(\) \{ return eff\("iconbg"\) === "1"; \}/.test(plugJs) && /classList\.toggle\("cc-plugins-iconbg", iconBgOnP\(\)\)/.test(plugJs) && /var ibgOn = iconBgOnP\(\);/.test(plugJs));
  ok('VMs: the same', /function iconBgOnV\(\) \{ return effK\("iconbg"\) === "1"; \}/.test(vmsJs) && /var ibgOn = iconBgOnV\(\);/.test(vmsJs) && !/effK\("iconbg"\) !== "1"\) return;/.test(vmsJs));
}

console.log('\nThe names read in the text colour, as on the Plugins and VM tabs');
{
  const nm = body(docker, '.cc-enh #docker_list tr:is(.sortable, .folder-element) td.ct-name .appname a');
  ok('a container name takes the row\'s text colour, not Unraid\'s link blue', decl(nm, 'color') === 'inherit !important', nm);
}

console.log('\nThe plugin row');
{
  const cell = body(docker, '.cc-plug #plugin_list > tr > td');
  ok('the padding follows the density', /padding-top: var\(--cc-density, 9px\)/.test(cell || '') && /padding-bottom: var\(--cc-density, 9px\)/.test(cell || ''), cell);
  ok('the logo stands as far from the name as on Docker', decl(body(docker, '.cc-plugname'), 'gap') === decl(body(docker, '.cc-enh #docker_list tr:is(.sortable, .folder-element) td.ct-name .outer'), 'gap'));
  const box = body(docker, '.cc-plugico');
  ok('every logo sits in one fixed square', decl(box, 'width') === 'var(--cc-logo-img, 62px)' && decl(box, 'height') === 'var(--cc-logo-img, 62px)', box);
  ok('centred in it', decl(box, 'align-items') === 'center' && decl(box, 'justify-content') === 'center');
  ok('docker.js sets the density this way', /var dens = localStorage\.getItem\("cc\.density"\); root\.setProperty\("--cc-density", \{ compact: "5px", normal: "9px", airy: "14px" \}\[dens\] \|\| "9px"\)/.test(dockerJs));
  ok('plugins.js sets it the same way', /setProperty\("--cc-density", \{ compact: "5px", normal: "9px", airy: "14px" \}\[ls\("cc\.density"\)\] \|\| "9px"\)/.test(plugJs));
  ok('vms.js sets it the same way', /setProperty\("--cc-density", \{ compact: "5px", normal: "9px", airy: "14px" \}\[ls\("cc\.density"\)\] \|\| "9px"\)/.test(vmsJs));
}

console.log('\nEvery plugin logo is cropped to the same fill');
{
  const grab = (name) => { const i = plugJs.indexOf('function ' + name + '('); let d = 0; for (let k = plugJs.indexOf('{', i); k < plugJs.length; k++) { if (plugJs[k] === '{') d++; else if (plugJs[k] === '}') { d--; if (!d) return plugJs.slice(i, k + 1); } } return ''; };
  const probes = [];
  class Img { constructor() { this.naturalWidth = 0; this.naturalHeight = 0; probes.push(this); } }
  // A canvas whose drawn content is a block in the middle, so the crop finds a bounding box.
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: (x, y, w, h) => { const d = new Uint8ClampedArray(w * h * 4); for (let yy = 40; yy < 150; yy++) for (let xx = 40; xx < 150; xx++) d[(yy * w + xx) * 4 + 3] = 255; return { data: d }; } }), toDataURL: () => 'data:image/png;base64,CROPPED' });
  const document = { createElement: () => canvas() };
  const api = new Function('Image', 'document', 'var normCache = {};' + grab('plugSetIconSrc') + grab('applyNorm') + grab('normalizeIcon') + '; return { set: plugSetIconSrc, norm: normalizeIcon };')(Img, document);
  const img = { attrs: { src: '/plugins/x/x.png' }, getAttribute(k) { return k === 'src' ? this.src || this.attrs.src : (k in this.attrs ? this.attrs[k] : null); }, setAttribute(k, v) { if (k === 'src') this.src = v; else this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  img.src = '/plugins/x/x.png';
  api.set(img, '/plugins/towertorch/server/ccapi.php?path=iconsvg&name=x');
  api.norm(img);
  const probe = probes[probes.length - 1];
  ok('the fetched logo is measured, not the plugin\'s own', !!probe && /iconsvg/.test(probe.src || ''), probe && probe.src);
  probe.onload();
  ok('an SVG with no natural size is cropped all the same', img.src === 'data:image/png;base64,CROPPED', img.src);
  ok('paintRow crops whatever source the pipeline chose', /plugSetIconSrc\(el2, plan\.url\);\s*normalizeIcon\(el2\);/.test(plugJs));
  // A crop fills 82% of its square, and a font glyph fills its em box.
  ok('a glyph logo is drawn at the crop\'s 82%, inline', /var GLYPH = "calc\(" \+ LOGO \+ " \* \.82\)";/.test(plugJs) && /el2\.style\.setProperty\("font-size", GLYPH, "important"\);/.test(plugJs));
  ok('and in the sheet that holds through a re-render', /\.cc-plugico i \{[^}]*font-size: calc\(var\(--cc-logo-img, 62px\) \* \.82\) !important;/.test(docker));
  ok('the crop fills 82% of its square', /var OUT = 192, avail = OUT \* 0\.82/.test(plugJs));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
