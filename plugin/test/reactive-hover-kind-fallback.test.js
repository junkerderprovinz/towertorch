// With reactive mode on and rainbow mode off, the per-kind hover rules have to
// resolve to the accent colour. They are gated on reactive mode alone, so
// --cc-rb-<kind> is unset whenever rainbow is off, and a hardcoded per-kind hex
// behind it paints the CPU badge red, RAM teal and BW purple with no rainbow in
// sight. The kind-less hover rule above each block already ends in var(--cc-accent).
//
// Every kind is checked in both sheets: a check of the "net" kind alone passes by
// luck on a box whose accent is green, since that fallback is var(--cc-ok).
//
// The .cc-rainbow and .cc-vm-rainbow rules are a different case: their gating class
// guarantees --cc-rb-<kind> is set, so the fallback is unreachable there. It is the
// accent chain all the same, so no state hue stands in for a palette position.
//
// The helpers come from settings-chrome.test.js, this being a string-level pin for
// want of a CSS engine in the bare-Node runner.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const DOCKER_CSS = path.join(DIR, 'styles', 'docker.css');
const VMTAB_CSS = path.join(DIR, 'sheets', 'TowerTorch.VmTab.css');
const PLUGINS_CSS = DOCKER_CSS; // Plugins' per-item badges are styled in docker.css too
const SETTINGSGRID_CSS = path.join(DIR, 'sheets', 'TowerTorch.SettingsGrid.css');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

// Taken from settings-chrome.test.js.
function ruleBody(sheet, selector) {
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = new RegExp('(^|[};])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm');
  const m = re.exec(clean);
  return m ? m[2] : null;
}
// A chain is accent-safe when its last fallback goes through var(--cc-accent, ...),
// or --cc-accent-text for a colour, rather than ending in a bare hex.
function bgAccentSafe(body) { return /background:\s*var\(--cc-rb-[a-z]+,\s*var\(--cc-accent,\s*#[0-9a-fA-F]{3,6}\)\)/.test(body || ''); }
function bgBareHexFallback(body) { return /background:\s*var\(--cc-rb-[a-z]+,\s*(?:var\(--cc-(?:ok|warn|err),\s*)?#[0-9a-fA-F]{3,6}\)?\s*(?:!important)?\s*;/.test(body || '') && !bgAccentSafe(body); }

const dockerCss = fs.readFileSync(DOCKER_CSS, 'utf8');
const vmtabCss = fs.readFileSync(VMTAB_CSS, 'utf8');

console.log('\nDocker per-kind hover badges: the fallback goes through --cc-accent');
{
  const kinds = ['net', 'ip', 'lan', 'port', 'vol', 'cpu', 'ram', 'bw'];
  kinds.forEach((kind) => {
    const listSel = `html.cc-shares-rbneutral.cc-docker-on #docker_list tr:is(.sortable, .folder-element):hover .cc-b.cc-b-${kind}`;
    const gridSel = `html.cc-shares-rbneutral.cc-docker-on .cc-grid-holder .cc-card:hover .cc-b.cc-b-${kind}`;
    const sel = `${listSel},\n${gridSel}`;
    const body = ruleBody(dockerCss, sel);
    ok(`${kind}: the list and grid hover rule exists`, body != null, sel);
    ok(`${kind}: the background chain includes var(--cc-accent`, bgAccentSafe(body), body);
    ok(`${kind}: the background does not end in a bare hex`, !bgBareHexFallback(body), body);
  });
}

console.log('\nVM per-kind hover badges: the fallback goes through --cc-accent');
{
  const kinds = ['cpu', 'ram', 'bw', 'ip', 'vol'];
  kinds.forEach((kind) => {
    const sel = `html.cc-vms-on.cc-vm-rbneutral #kvm_list tr:hover .cc-b.cc-b-${kind}`;
    const body = ruleBody(vmtabCss, sel);
    ok(`${kind}: the hover rule exists`, body != null, sel);
    ok(`${kind}: the background chain includes var(--cc-accent`, bgAccentSafe(body), body);
    ok(`${kind}: the background does not end in a bare hex`, !bgBareHexFallback(body), body);
    ok(`${kind}: the colour chain includes var(--cc-accent-text`, /color:\s*var\(--cc-rb-[a-z]+-t,\s*var\(--cc-accent-text,\s*#161616\)\)/.test(body || ''), body);
  });
}

console.log('\nThe rainbow-gated per-kind rules fall back to the accent, never to a state hue');
{
  const dockerCpuSel = '.cc-enh.cc-rainbow .cc-b-cpu, .cc-grid-holder.cc-rainbow .cc-b-cpu';
  const dockerCpuBody = ruleBody(dockerCss, dockerCpuSel);
  ok('docker.css rainbow-mode CPU rule exists', dockerCpuBody != null);
  ok('docker.css rainbow-mode CPU rule falls back to the accent', /background:\s*var\(--cc-rb-cpu,\s*var\(--cc-accent,\s*#FCC419\)\)/.test(dockerCpuBody || ''), dockerCpuBody);

  const vmCpuSel = 'html.cc-vms-on.cc-vm-rainbow #kvm_list .cc-b-cpu';
  const vmCpuBody = ruleBody(vmtabCss, vmCpuSel);
  ok('VmTab.css rainbow-mode CPU rule exists', vmCpuBody != null);
  ok('VmTab.css rainbow-mode CPU rule falls back to the accent', /background:\s*var\(--cc-rb-cpu,\s*var\(--cc-accent,\s*#FCC419\)\)/.test(vmCpuBody || ''), vmCpuBody);
}

console.log('\nSettingsGrid has no per-kind badge var, so a new one cannot slip in untested');
{
  const kindVarRe = /--cc-rb-(net|ip|lan|port|vol|cpu|ram|bw)\b/;
  const sgCss = fs.readFileSync(SETTINGSGRID_CSS, 'utf8');
  ok('TowerTorch.SettingsGrid.css carries no per-kind --cc-rb-<kind>', !kindVarRe.test(sgCss), 'a per-kind var turned up, so SettingsGrid needs the same chain as Docker and VMs');
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
