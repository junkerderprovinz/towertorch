/* CannonadeCommand for Unraid's VMs tab: state and info badges, the VM icon tint, the per-VM
 * limits and the tiles. It reacts live to settings changes through the storage event and clears
 * itself after an uninstall, when the same-origin proxy answers 404. The selectors follow
 * Unraid's VM manager DOM; a build that renders icons differently gets no tint.
 */
(function () {
  "use strict";
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  // The filled gear from docker.js (tabler-icons MIT, icons/filled/settings.svg), copied because
  // vms.js cannot rely on docker.js being loaded. Change both together.
  var CC_GEAR_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" /></svg>';
  var dead = false, mo = null, liveTimer = null, moPending = false, moTimer = null, moTrail = false, smo = null, smoPending = false, vmBwTimer = null;
  var ccFirstPaintDone = false, ccEnhBusyStart = 0;   // minimum visible spinner, as in docker.js
  // Wraps the memory, disk-IO and network-IO readouts of the VM usage table into chips like the
  // CPU pills. The vm_usage websocket replaces the tbody about every 3s, hence the wrapped check.
  function wrapVmStats() {
    try {
      if (!document.documentElement.classList.contains("cc-vms-on")) return;
      var body = document.getElementById("vmstatsbody") || (function () { var t = document.getElementById("vmstats"); return t ? t.querySelector("tbody") : null; })();
      if (!body) return;
      Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
        var tds = tr.children;
        // the VM name becomes a badge like in the main list
        var n0 = tds[0];
        if (n0 && n0.tagName === "TD" && !n0.querySelector(":scope > .cc-vmstat-name") && (n0.textContent || "").trim()) {
          var nb = document.createElement("span"); nb.className = "cc-b cc-vmstat-name";
          while (n0.firstChild) nb.appendChild(n0.firstChild);
          n0.appendChild(nb);
        }
        [3, 4, 5].forEach(function (ci) {
          var td = tds[ci]; if (!td || td.tagName !== "TD") return;
          if (td.querySelector(":scope > .cc-vmstat-chip")) return;     // already wrapped this render
          if (!(td.textContent || "").trim()) return;
          var chip = document.createElement("span"); chip.className = "cc-vmstat-chip";
          while (td.firstChild) chip.appendChild(td.firstChild);
          td.appendChild(chip);
        });
      });
    } catch (e) {}
  }
  var VMVIEW_KEY = "cc.vmview";
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  // Rainbow, as in docker.js, so the VM badges share the global palette. The --cc-rb-* vars are
  // stamped on <html>; the kind-to-colour map rotates by the shared seed (cc.rainbowrot). VM info
  // badges carry the kinds cpu/ram/ip.
  var RB_KINDS = ["net", "ip", "lan", "port", "id", "von", "cpu", "ram", "bw", "version", "vol", "plan"];
  var RB_PAL = ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"];
  if (window.CCTheme) { RB_PAL = window.CCTheme.RB; } // the local copy is the fallback
  var RB_OFFSET = window.CCTheme ? window.CCTheme.rbSeed(RB_PAL.length) : Math.floor(Math.random() * RB_PAL.length); // persisted seed, aligned with the other areas

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  // VM tinting follows the container icon colour unless cc.vmicons is "0".
  function vmTintOff() { return ls("cc.vmicons") === "0"; }
  // Hintergrund and Einfärben are independent, as in docker.js: cc.iconbg/cc.iconbgcolor drive
  // the badge, cc.icontint/cc.iconcolor the tint. An unset icontint means "on whenever a valid
  // icon colour is set", which keeps the look of installs that predate the toggle.
  function vmTintOn() {
    var v = effK("icontint");
    return v == null ? !!effK("iconcolor") : v === "1";
  }
  // While the icons adopt the rainbow/accent, vmBgColor() answers "" and VmTab.css's var() chain
  // falls through to the per-row --cc-rb-c. The ink is then the black/white contrast for the
  // colour this returns: the rainbow "action" slot 5 (--cc-rbaccent), or the accent.
  function vmAdoptTint() {
    if (ls("cc.theming") === "0" || ls("cc.rainbow") !== "1") return ccAccent();
    return vmRbColor(5);
  }
  function vmBgColor() {
    if (iconBgAdoptsV()) return "";   // the CSS rainbow/accent chain decides
    var c = effK("iconbgcolor");
    if (c && /^#?[0-9a-f]{6}$/i.test(c)) return ccHex6(c);
    var ic = effK("iconcolor");
    if (ic && /^#?[0-9a-f]{6}$/i.test(ic)) return ccHex6(ic);
    return ccAccent();
  }
  // The icon ink, as in docker.js iconInk(): "" while the tint is off. With adopt on, the
  // black/white contrast for the badge, or the badge colour itself with no badge behind the icon;
  // otherwise the picked tint colour. Both are kept off the surface colour. `forTint` doubles the floor because a
  // luminance tint outputs roughly half the target's luma.
  function vmIconInk(forTint) {
    if (!vmTintOn()) return "";
    if (iconBgAdoptsV() && iconBgOnV()) return ccIdeal(vmAdoptTint());
    var pick = iconBgAdoptsV() ? vmAdoptTint() : effK("iconcolor");
    var valid = pick && /^#?[0-9a-f]{6}$/i.test(pick);
    if (!valid) return "";
    if (!window.CCTheme || !window.CCTheme.liftSurface) return ccHex6(pick);
    return ccHex6(window.CCTheme.liftSurface(pick, ccAccent(), window.CCTheme.LUM_FLOOR * (forTint ? 2 : 1)));
  }
  // Takes the host and filter ids so the black and white adopt filters can coexist with the
  // page-wide one.
  function ensureTintFilterAs(hostId, filtId, ic) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById(hostId);
    if (dead || vmTintOff() || !m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(effK("iconstrength") || "100", 10)) / 100).toFixed(3);
    // shading-preserving: channel = luminance × target colour (matches docker.js)
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    // Rewrites the SVG only when colour or strength changed; a blind innerHTML write on every
    // apply() would feed any observer on body into a repaint loop.
    var sig = filtId + "|" + tr + "|" + tg + "|" + tb + "|" + s + "|lum";
    if (host.dataset.sig !== sig) {
      var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
      if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
      host.dataset.sig = sig;
    }
    return true;
  }
  function ensureTintFilter() { return ensureTintFilterAs("cc-vm-tint-svg", "cc-vm-icon-tint", vmIconInk(true)); }
  function filterVal() { return ensureTintFilter() ? "url(#cc-vm-icon-tint)" : ""; }
  // Per-row adopt ink, as in docker.js itemAdoptInk(): the --cc-rb-ct enhanceCells() stamped for
  // this row's rotated colour, else the page-wide answer (Rainbow off, or no stamp yet).
  function vmItemAdoptInk(rowEl) {
    if (rowEl && rowEl.style && ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
      var v = rowEl.style.getPropertyValue ? rowEl.style.getPropertyValue("--cc-rb-ct") : "";
      if (v) return v.trim();
    }
    return ccIdeal(vmAdoptTint());
  }
  // The chosen colour as a plain hex, gated the same way. Most VM icons are icon-font glyphs
  // (`<i class="fa fa-… img">`) coloured through CSS `color:`; only real .png icons
  // (`<img class="img">`) take the filter.
  function tintColor() {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(vmIconInk(false) || "");
    if (dead || vmTintOff() || !m) return "";
    return "#" + m[1] + m[2] + m[3];
  }
  // From dynamix.vm.manager VMMachines.php: the VM list is tbody#kvm_list and each row's
  // td.vm-name holds the icon at span[id^="vm-"] > .img (an <img> or an <i> glyph). The tiles
  // carry a copy of it, which takes the same tint.
  function vmImgs() {
    var sels = ["#kvm_list td.vm-name span[id^='vm-'] > .img", "#kvm_list td.vm-name img.img", "#kvm_list td.vm-name img"], out = [];
    for (var i = 0; i < sels.length; i++) { var n = document.querySelectorAll(sels[i]); if (n.length) { out = Array.prototype.slice.call(n); break; } }
    return out.concat(Array.prototype.slice.call(document.querySelectorAll(".cc-vm-grid .cc-vmc-icobox > .img")));
  }
  // The VM behind one icon element, for the icon pipeline's lookup + per-VM pin.
  function vmIconName(n) {
    var host = n && n.closest ? n.closest("tr, .cc-vmc") : null;
    if (!host) return "";
    return host.tagName === "TR" ? (vmNameOf(host) || "") : (host.getAttribute("data-name") || "");
  }
  // A glyph gets either a css colour or the luminance filter, never both, or the tint would
  // double and dim the hue. Kept separate so the tests can reach it; ibgOn and ibgAcc are unused
  // because `ink` already says whether Einfärben is on.
  function glyphInkAndFilter(plan, ibgOn, ibgAcc, ink) {
    if (plan.treat === "native") return { color: "", filter: "" };
    return { color: ink, filter: "" };
  }
  // Source swap + native-source memory, identical contract to docker.js setIconSrc.
  function vmSetIconSrc(img, url) {
    if (!img.getAttribute("data-cc-osrc")) img.setAttribute("data-cc-osrc", img.getAttribute("src") || "");
    var want = url || img.getAttribute("data-cc-osrc") || "";
    if (!want || img.getAttribute("data-cc-isrc") === want) return;
    img.setAttribute("data-cc-isrc", want);
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
  }
  // A font glyph (<i class="fa … img">) is already monochrome, so it only inks and has no src to
  // swap. Real .png icons run the full chain.
  function vmIconPlan(n, name) {
    var CI = window.CCTheme && window.CCTheme.icons;
    if (!CI) return { treat: "tint", url: "" };
    var isGlyphEl = n.tagName !== "IMG";
    var res = CI.result(name), kind = res && res.kind !== "pending" ? res.kind : "";
    var src = isGlyphEl ? "" : n.getAttribute("data-cc-osrc") || n.getAttribute("src") || "";
    var plan = CI.plan(CI.mode("vm", name), kind, isGlyphEl ? 0 : CI.spread(src), isGlyphEl ? null : CI.tile(src));
    return { treat: plan.treat, tile: plan.tile, url: (!isGlyphEl && (plan.src === "glyph" || plan.src === "color")) ? CI.svgUrl(name) : "" };
  }
  // cc.stylevms on reads the shared cc.* keys, off the VM area's own ccv.* keys.
  function effK(k) { return ls("cc.stylevms") !== "0" ? ls("cc." + k) : ls("ccv." + k); }
  // Adopting the rainbow is a global decision, so it bypasses effK().
  function iconBgAdoptsV() { return ls("cc.iconbgrainbow") === "1"; }
  // The logo tile has its own switch whether or not the colours are adopted (docker.js iconBgOn).
  function iconBgOnV() { return effK("iconbg") === "1"; }
  function ccIdeal(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff"; }
  // A failed action shakes the control that was used and says why in a toast.
  function ccvFail(ctl, msg) { if (window.CCTheme) window.CCTheme.fail(ctl, msg); }
  function ccAccent() { var a = effK("accent") || "#FCC419"; return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  // Expands #rgb to #rrggbb: idealText answers "#fff", while the filter builders and colour
  // regexes here want six digits.
  function ccHex6(c) {
    c = String(c == null ? "" : c).trim();
    return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  }
  // Flattens every opaque pixel to one colour with alpha untouched, as docker.js does. Only
  // aimed at a real glyph or an icon the complexity heuristic found to be one tone already. A
  // strength below 100 mixes each pixel back toward the original by that share.
  function ensureFlatFilter(hostId, filtId, hex, strength) {
    var host = document.getElementById(hostId);
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ccHex6(hex) || "");
    if (!m) { if (host) host.remove(); return ""; }
    var s = Math.max(10, Math.min(100, strength || 100)) / 100, keep = (1 - s).toFixed(4);
    var r = (parseInt(m[1], 16) / 255 * s).toFixed(4), g2 = (parseInt(m[2], 16) / 255 * s).toFixed(4), b = (parseInt(m[3], 16) / 255 * s).toFixed(4);
    if (!host) { host = document.createElement("div"); host.id = hostId; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var sig = filtId + "|" + r + "|" + g2 + "|" + b + "|" + keep;
    if (host.dataset.sig !== sig) {
      var vals = keep + " 0 0 0 " + r + " 0 " + keep + " 0 0 " + g2 + " 0 0 " + keep + " 0 " + b + " 0 0 0 1 0";
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>';
      host.dataset.sig = sig;
    }
    return "url(#" + filtId + ")";
  }
  // Flattens an icon to black on a light accent or white on a dark one.
  function ensureMonoFilter(hostId, filtId, accentHex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(accentHex || "");
    return ensureFlatFilter(hostId, filtId, m ? ccIdeal("#" + m[1]) : "");
  }
  // The active palette, as docker.js ccPalActive(): flag mode keeps its own cc.flagpal.
  function vmPalStored() {
    var pal = RB_PAL;
    try { var fjp = ls("cc.flagmode") === "1" ? JSON.parse(ls("cc.flagpal") || "null") : null; var jp = (fjp && fjp.length) ? fjp : JSON.parse(ls("cc.rbpal") || "null"); if (jp && jp.length) pal = jp; } catch (e) {}
    return pal;
  }
  // On a light theme the near-white slots are swapped, see CCTheme.surfacePalette.
  function vmPalActive() { var p = vmPalStored(); return (window.CCTheme && window.CCTheme.surfacePalette) ? window.CCTheme.surfacePalette(p, ccAccent()) : p; }
  // One palette slot, rotated the same way applyRainbowPalette() rotates the kinds.
  function vmRbColor(i) { var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET; return vmPalActive()[(i + off) % vmPalActive().length]; }
  // Stamps --cc-rb-* on <html> from the global rainbow keys, as docker.js does; cleared when off.
  function applyRainbowPalette() {
    var rt = document.documentElement.style, on = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (!on) { rt.removeProperty("--cc-rbaccent"); rt.removeProperty("--cc-rbaccent-text"); RB_KINDS.forEach(function (k) { rt.removeProperty("--cc-rb-" + k); rt.removeProperty("--cc-rb-" + k + "-t"); }); return; }
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    var pal = vmPalActive();
    // The rainbow "action" colour (slot 5, like docker.js). VmTab.css's generic badge, the
    // reactive hover, the autostart toggle and the vmstat name badge all read --cc-rbaccent.
    var acc = pal[(5 + off) % pal.length];
    rt.setProperty("--cc-rbaccent", acc); rt.setProperty("--cc-rbaccent-text", ccIdeal(acc));
    RB_KINDS.forEach(function (k, i) {
      var c = pal[(i + off) % pal.length];
      rt.setProperty("--cc-rb-" + k, c); rt.setProperty("--cc-rb-" + k + "-t", ccIdeal(c));
    });
  }
  // The list is the default, as on the Docker tab. The tiles belong to the theming, so they never
  // show with theming off.
  function currentView() { return (ls(VMVIEW_KEY) === "grid" && ls("cc.theming") !== "0") ? "grid" : "list"; }
  function applyView() {
    var g = currentView() === "grid";
    document.documentElement.classList.toggle("cc-vmgrid", g);
    var tg = document.getElementById("cc-vm-viewtoggle");
    if (tg) Array.prototype.forEach.call(tg.querySelectorAll(".cc-seg-btn"), function (b) {
      var on = b.getAttribute("data-v") === (g ? "grid" : "list");
      b.classList.toggle("cc-seg-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (g) renderVmGrid(); else removeVmGrid();
  }
  // The Liste/Kacheln switch at the right end of the sub-tab bar, the same one /Main and /Shares
  // carry there.
  function ensureViewToggle() {
    if (document.getElementById("cc-vm-viewtoggle")) return;
    var nav = document.querySelector("#displaybox > nav.tabs");
    if (!nav) return;
    var de = LANG === "de";
    var sw = el("div", "cc-vm-vsw"); sw.id = "cc-vm-viewtoggle";
    var seg = el("span", "cc-vm-seg");
    seg.setAttribute("role", "group"); seg.setAttribute("aria-label", de ? "Ansicht" : "View");
    [["list", de ? "Liste" : "List", "ViewList"], ["grid", de ? "Kacheln" : "Tiles", "ViewGrid"]].forEach(function (o) {
      var b = el("span", "cc-seg-btn");
      b.innerHTML = ccGlyph(o[2]);
      b.appendChild(el("span", null, o[1]));
      b.setAttribute("data-v", o[0]);
      if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(b); else { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); }
      b.addEventListener("click", function () { try { localStorage.setItem(VMVIEW_KEY, o[0]); } catch (e) {} apply(); });
      seg.appendChild(b);
    });
    sw.appendChild(seg);
    nav.appendChild(sw);
  }
  function removeViewToggle() { var vt = document.getElementById("cc-vm-viewtoggle"); if (vt && vt.parentNode) vt.parentNode.removeChild(vt); }
  // Tab-Ansicht: flattens the /VMs sub-tabs (#kvm_list and #vmstats) into stacked sections, each
  // headed by a .cc-card-head cloned from its hidden tab button. Same MainContentTabbed DOM as
  // /Shares/Share and /Main.
  function cardPanels(box) {
    var tablist = box.querySelector('nav.tabs, [role="tablist"]');
    var tabBtns = tablist ? tablist.querySelectorAll('button[role="tab"]') : [];
    var panels = box.querySelectorAll('section[role="tabpanel"]');
    for (var i = 0; i < panels.length; i++) {
      var section = panels[i];
      if (section.getAttribute("data-cc-card")) continue;   // idempotent; keeps i == real DOM index
      section.setAttribute("data-cc-card", "1");
      var head = document.createElement("div"); head.className = "cc-card-head";
      var btn = tabBtns[i];
      if (btn && btn.childNodes.length) { var kids = btn.childNodes; for (var k = 0; k < kids.length; k++) head.appendChild(kids[k].cloneNode(true)); }
      else { head.textContent = (btn && btn.textContent.trim()) || (section.id || "").replace(/-panel$/, ""); }
      section.insertBefore(head, section.firstChild);       // VM panels have no split, so the section IS the card
    }
  }
  function flattenTeardown() {
    try {
      var stray = document.querySelectorAll("#displaybox .cc-card-head, #displaybox .cc-card-note");
      for (var s = 0; s < stray.length; s++) stray[s].parentNode.removeChild(stray[s]);
      var marked = document.querySelectorAll("#displaybox [data-cc-card]");
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-card");
    } catch (e) {}
  }
  // Keep this map identical to docker.js ccLogoSizes() and plugins.js logoSize().
  function vmLogoSizes() { return ({ s: ["48px", "62px"], m: ["62px", "78px"], l: ["76px", "94px"] })[ls("cc.sgsize") || "m"] || ["62px", "78px"]; }
  function enhanceRows() {
    try {
      var a = ccAccent(), root = document.documentElement.style;
      root.setProperty("--cc-accent", a); root.setProperty("--cc-accent-text", ccIdeal(a));
      // the logo tile follows the global cc.sgsize like the Docker and Plugins tabs
      var lg = vmLogoSizes();
      root.setProperty("--cc-logo-img", lg[0]); root.setProperty("--cc-logo-box", lg[1]);
      // the rows are as dense as the Docker tab's (docker.js applySettings)
      root.setProperty("--cc-density", { compact: "5px", normal: "9px", airy: "14px" }[ls("cc.density")] || "9px");
      // The VM state becomes a Docker state dot. The state comes from the sibling <i.fa> class
      // rather than the translated label, mapped to Docker's running/paused/exited.
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        var txt = (st.textContent || "").trim(); if (!txt) return;
        var icon = st.previousElementSibling, cls = (icon && icon.className) || "", low = txt.toLowerCase();
        var running = /\bstarted\b|green-text/.test(cls) || /run|l\u00e4uft|gestartet/.test(low);
        var paused = /\bpaused\b|orange-text/.test(cls) || /paus/.test(low);
        var dstate = running ? "running" : paused ? "paused" : "exited";
        st.className = "state cc-badge cc-badge-" + dstate;   // keep native .state (sort/hooks) + Docker classes
        st.setAttribute("data-tip", txt);                    // the dot shows no text, as on Docker
        st.style.cssText = "";                                // the look comes from CSS
      });
    } catch (e) {}
  }
  // Reverts every inline visual, so the master theming toggle restores the native VM page
  // without a reload. Unlike teardown it keeps the observer and timers for a re-enable.
  function stripVmTheming() {
    try {
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list tr.sortable td.vm-name span.state")).forEach(function (st) {
        st.className = "state"; st.style.cssText = ""; st.removeAttribute("data-tip");
      });
      document.documentElement.classList.remove("cc-vm-iconbg");
      document.documentElement.style.removeProperty("--cc-iconbg-color");
      document.documentElement.style.removeProperty("--cc-density");
      var imgs = vmImgs();
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.filter = ""; imgs[i].style.removeProperty("color");
        var w = imgs[i].parentElement; if (w) ["background", "border-radius", "width", "height", "padding", "display", "align-items", "justify-content", "box-sizing"].forEach(function (p) { w.style.removeProperty(p); });
      }
      ["cc-vm-tint-svg", "cc-vm-mono-svg", "cc-vm-tint-svg-blk", "cc-vm-tint-svg-wht", "cc-vm-mono-svg-blk", "cc-vm-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); });
      document.documentElement.classList.remove("cc-vmgrid", "cc-vm-rainbow", "cc-vm-rbneutral");
      RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); });
      removeViewToggle(); removeVmGrid();
    } catch (e) {}
  }
  // from docker.js, so the VM badges share Docker's classes and structure
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  // VM limits: a gear per resource opens an editor for CPU pin/cap, RAM (balloon) and up/down
  // bandwidth. The engine applies CPU and RAM through virsh and bandwidth host-side with an
  // iptables physdev hashlimit that the monitor re-asserts. docker.css is not loaded on /VMs,
  // so the editor styles itself from the global tokens.
  var VMDE = (function () { try { return /de/i.test(document.documentElement.lang || "") || (localStorage.getItem("locale") || "").indexOf("de") === 0; } catch (e) { return false; } })();
  var CCPROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var vmLims = {}; // name -> the VM's current limits from /api/vms
  function vmCsrf() {
    try {
      if (typeof window.csrf_token !== "undefined" && window.csrf_token) return window.csrf_token;
      var fe = document.querySelector('input[name="csrf_token"]'); if (fe && fe.value) return fe.value;
      var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) return m[1];
    } catch (e) {}
    return "";
  }
  function vmApi(method, path, body, query) {
    var o = { method: method, headers: { Accept: "application/json" } };
    if (method !== "GET") {
      // emhttp accepts a POST only with csrf_token in the form body; ccapi.php unwraps `data`
      // into the JSON body for the engine. An empty 200 means the token was dropped.
      var tk = vmCsrf();
      o.headers["Content-Type"] = "application/x-www-form-urlencoded";
      o.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}));
    }
    // An extra query such as name=… rides next to ?path=…; ccapi.php forwards only the params
    // on its per-path $qallow list.
    return fetch(CCPROXY + "?path=" + encodeURIComponent(path) + (query ? "&" + query : ""), o).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
        if (method !== "GET" && j == null) throw new Error(VMDE ? "leere Antwort (csrf verworfen?)" : "empty response (csrf dropped?)");
        return j;
      });
    });
  }
  function loadVmLims() {
    return vmApi("GET", "vms").then(function (list) { vmLims = {}; if (Array.isArray(list)) list.forEach(function (v) { vmLims[v.name] = v; }); }).catch(function () {});
  }
  // Host CPU topology for the core picker, from the same /api/state keys docker.js reads.
  var vmHost = { cpus: 0, coreOf: null, pcores: [], ecores: [] };
  function loadVmHost() {
    return vmApi("GET", "state", null).then(function (st) {
      if (st) vmHost = { cpus: st.host_cpus || 0, coreOf: st.host_core_of || null, pcores: st.host_pcores || [], ecores: st.host_ecores || [] };
    }).catch(function () {});
  }
  // cpuset string <-> list of CPUs, as in docker.js
  function cpusetToSet(str) { var out = []; String(str || "").split(",").forEach(function (p) { p = p.trim(); var m = /^(\d+)-(\d+)$/.exec(p); if (m) { for (var i = +m[1]; i <= +m[2]; i++) out.push(i); } else if (/^\d+$/.test(p)) out.push(+p); }); return out; }
  function setToCpuset(arr) { arr = arr.slice().sort(function (a, b) { return a - b; }); var parts = [], i = 0; while (i < arr.length) { var j = i; while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++; parts.push(i === j ? String(arr[i]) : arr[i] + "-" + arr[j]); i = j + 1; } return parts.join(","); }
  // The Docker-style core grid: one box per physical core with its hyperthreads stacked, and a P/E
  // tag on hybrid Intel CPUs. Returns { node, read }, or null for an unknown topology, in which case
  // the caller falls back to a text cpuset field.
  function buildCoreGrid(cur) {
    var ncpu = vmHost.cpus || 0;
    if (!(ncpu > 0 && ncpu <= 512)) return null;
    var coreOf = (vmHost.coreOf && vmHost.coreOf.length === ncpu) ? vmHost.coreOf : null;
    var isE = {}; (vmHost.ecores || []).forEach(function (n) { isE[n] = true; });
    var hybrid = (vmHost.pcores || []).length > 0 && (vmHost.ecores || []).length > 0;
    var grid = el("div", "cc-cores");
    var groups = {}, order = [];
    for (var ci = 0; ci < ncpu; ci++) { var g = coreOf ? coreOf[ci] : ci; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(ci); }
    order.forEach(function (g) {
      var box = el("span", "cc-corebox");
      if (hybrid) { var isEcore = groups[g].every(function (n) { return isE[n]; }); box.classList.add(isEcore ? "cc-corebox-e" : "cc-corebox-p"); box.appendChild(el("span", "cc-corebox-tag", isEcore ? "E" : "P")); }
      groups[g].forEach(function (cpu2) {
        var core = el("span", "cc-core cc-rb-" + (g % 8), String(cpu2)); core.dataset.core = cpu2;
        core.title = "CPU " + cpu2 + (coreOf ? " · core " + g : "") + (hybrid ? (isE[cpu2] ? " · E-core" : " · P-core") : "");
        core.addEventListener("click", function () { this.classList.toggle("cc-core-on"); });
        box.appendChild(core);
      });
      grid.appendChild(box);
    });
    var s = cpusetToSet(cur);
    Array.prototype.forEach.call(grid.querySelectorAll(".cc-core"), function (c) { if (s.indexOf(parseInt(c.dataset.core, 10)) >= 0) c.classList.add("cc-core-on"); });
    return { node: grid, read: function () { var sel = []; Array.prototype.forEach.call(grid.querySelectorAll(".cc-core-on"), function (c) { sel.push(parseInt(c.dataset.core, 10)); }); return setToCpuset(sel); } };
  }
  function vmNameOf(tr) {
    var h = tr && tr.querySelector("td.vm-name [onclick*='addVMContext']");
    var m = /addVMContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
    return m ? m[1] : null;
  }
  // A one-line field beside its label (GlimStone rule 35), with the hint in the label's (i).
  function vmFld(label, hint, value, ph) {
    var wrap = el("div", "cc-vm-row");
    var l = el("label", "cc-vm-lbl", label);
    if (hint && window.CCTheme && window.CCTheme.infoIcon) l.appendChild(window.CCTheme.infoIcon(hint));
    var inp = el("input", "cc-vm-in"); inp.type = "text"; inp.value = (value == null ? "" : String(value)); if (ph != null) inp.placeholder = String(ph);
    wrap.appendChild(l); wrap.appendChild(inp);
    return { wrap: wrap, input: inp };
  }
  // CC's dropdown for a <select> in the limits window, the settings page's ccDsel: the select
  // stays as the value, hidden, and a pick fires its change.
  function vmDsel(sel) {
    var wrap = el("span", "cc-dsel"); sel.style.display = "none"; wrap.appendChild(sel);
    var trig = el("span", "cc-dsel-trigger"); wrap.appendChild(trig);
    if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(trig);
    trig.setAttribute("aria-haspopup", "listbox");
    var panel = el("div", "cc-dsel-panel"); wrap.appendChild(panel);
    for (var k = 0; k < sel.options.length; k++) {
      var chip = el("div", "cc-dsel-opt", sel.options[k].text); chip.setAttribute("data-i", k);
      chip.addEventListener("click", (function (idx) {
        return function (ev) {
          ev.stopPropagation();
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          vmDselSync(sel); wrap.classList.remove("cc-open"); trig.focus();
        };
      })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) {
      ev.stopPropagation();
      vmDselSync(sel);
      if (wrap.classList.toggle("cc-open")) vmDselPosition(trig, panel);
    });
    vmDselSync(sel);
    return wrap;
  }
  function vmDselSync(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-dsel")) return;
    var t2 = w.querySelector(".cc-dsel-trigger"), c = w.querySelectorAll(".cc-dsel-opt");
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (o) c[k].classList.toggle("is-selected", o.selected); }
  }
  // The window's card scrolls, which would clip a panel inside it, so the open panel is fixed at its
  // trigger. An ancestor of the window can still be its containing block (a transform or a filter
  // does that), so the panel is measured once placed and moved by whatever it is off.
  function vmDselPosition(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14;
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge, down = below >= 200 || below >= above;
      panel.style.position = "fixed"; panel.style.boxSizing = "border-box"; panel.style.bottom = "auto";
      panel.style.minWidth = Math.round(r.width) + "px";
      panel.style.maxHeight = Math.max(140, (down ? below : above) - gap) + "px";
      panel.style.left = Math.round(r.left) + "px"; panel.style.top = "0px";
      var want = down ? r.bottom + gap : r.top - gap - panel.offsetHeight;
      var p = panel.getBoundingClientRect();
      panel.style.left = Math.round(r.left + (r.left - p.left)) + "px";
      panel.style.top = Math.round(want - p.top) + "px";
    } catch (e) {}
  }
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.closest || !wrap.closest("#cc-vmlim")) return false; vmDselSync(sel); return true; }); } catch (e) {}
  try { document.addEventListener("click", function () { var o = document.querySelectorAll("#cc-vmlim .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }); } catch (e) {}
  // The BW badge, like Docker's: a running VM shows its live throughput from pollVmBw, any other VM
  // its configured cap.
  var vmBwPrev = {}, vmRate = {}; // name -> {down,up,t} sample ; name -> {down,up} bytes/s
  function rateFmt(bps) {
    var bits = (bps || 0) * 8;
    if (bits >= 1e9) return (bits / 1e9).toFixed(1) + "G";
    if (bits >= 1e6) return (bits / 1e6).toFixed(1) + "M";
    if (bits >= 1e3) return Math.round(bits / 1e3) + "k";
    return "0";
  }
  function vmBwText(lim) {
    if (lim && lim.running && lim.name && vmRate[lim.name]) {
      var r = vmRate[lim.name];
      return "↓" + rateFmt(r.down) + " ↑" + rateFmt(r.up);
    }
    var d = lim && lim.inKbit > 0, u = lim && lim.outKbit > 0;
    if (!d && !u) return "-";
    function fmt(k) { return k >= 1000 ? (Math.round(k / 100) / 10) + "M" : k + "k"; }
    return "↓" + (d ? fmt(lim.inKbit) : "∞") + " ↑" + (u ? fmt(lim.outKbit) : "∞");
  }
  // Diffs each running VM's tap byte counters into a bytes/s rate. arm() runs it only while a VM is
  // running, because the engine's virsh list is expensive.
  function pollVmBw() {
    return loadVmLims().then(function () {
      var now = Date.now();
      Object.keys(vmLims).forEach(function (n) {
        var v = vmLims[n];
        if (!v || !v.running) { delete vmBwPrev[n]; delete vmRate[n]; return; }
        var prev = vmBwPrev[n];
        if (prev && now > prev.t) {
          var dt = (now - prev.t) / 1000;
          vmRate[n] = { down: Math.max(0, Math.round(((v.downBytes || 0) - prev.down) / dt)), up: Math.max(0, Math.round(((v.upBytes || 0) - prev.up) / dt)) };
        }
        vmBwPrev[n] = { down: v.downBytes || 0, up: v.upBytes || 0, t: now };
      });
      try { refreshAllRes(); } catch (e) {}
    });
  }
  // Gear colour, as docker.js gearFill: rainbow stamps the kind var and leaves the rest to CSS;
  // accent mode fills inline with priority, since Unraid's theme CSS would beat the stylesheet.
  function vmGearFill(lb, set, kind) {
    var rbOn = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    if (rbOn && kind) {
      lb.style.removeProperty("background"); lb.style.removeProperty("color");
      lb.style.setProperty("--cc-rb-c", "var(--cc-rb-" + kind + ", var(--cc-accent, #FCC419))");
      lb.style.setProperty("--cc-rb-ct", "var(--cc-rb-" + kind + "-t, #fff)");
      return;
    }
    lb.style.removeProperty("--cc-rb-c"); lb.style.removeProperty("--cc-rb-ct");
    // an unused gear rests on the theme's surface grey, like the row actions
    var bg = set ? ccAccent() : "var(--cc-surface-3, #2e2e2e)", tx = set ? ccIdeal(bg) : "var(--cc-text, #e6e6e6)";
    lb.style.setProperty("background", bg, "important");
    lb.style.setProperty("color", tx, "important");
  }
  var GEAR_TIP = {
    cpu: VMDE ? "CPU (Pin + Limit)" : "CPU (pin + limit)", ram: VMDE ? "RAM (Balloon)" : "RAM (balloon)",
    bw: VMDE ? "Bandbreite" : "Bandwidth", disk: VMDE ? "vDisk live vergrößern" : "grow vDisk live"
  };
  // One gear per resource, coloured by kind, opening that resource's editor. The disk gear takes
  // the "vol" colour of the vDisks badge.
  function vmGear(name, which, set) {
    var colorKind = which === "disk" ? "vol" : which;
    var lb = el("span", "cc-limbtn" + (set ? " cc-limbtn-set" : "") + " cc-lim-" + which); lb.innerHTML = CC_GEAR_SVG;
    vmGearFill(lb, set, colorKind);
    lb.title = GEAR_TIP[which] + " · " + (set ? (VMDE ? "gesetzt" : "set") : (VMDE ? "Standard" : "default"));
    lb.setAttribute("aria-label", lb.title);
    if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(lb);   // focus returns here when the window closes
    lb.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (vmLims[name]) openVmEd(name, which, lb); else loadVmLims().then(function () { openVmEd(name, which, lb); });
    });
    return lb;
  }
  // After the limits load or an editor applies, the gears and BW text update in place, since the
  // #kvm_list rows are not rebuilt.
  function syncGear(g, set, kind) { if (!g) return; g.classList.toggle("cc-limbtn-set", set); vmGearFill(g, set, kind); }
  function limSet(lim) {
    return {
      cpu: !!(lim.cpuCap > 0 || (lim.cpuCores && lim.cpuCores !== "" && lim.cpuCores !== "0-127")),
      ram: !!(lim.memMiB > 0 && lim.maxMemMiB > 0 && lim.memMiB < lim.maxMemMiB),
      bw: !!(lim.inKbit > 0 || lim.outKbit > 0)
    };
  }
  function refreshResGroup(group) {
    var name = group.getAttribute("data-cc-vm"); if (!name) return;
    var lim = vmLims[name] || {}, s = limSet(lim);
    syncGear(group.querySelector(".cc-lim-cpu"), s.cpu, "cpu");
    syncGear(group.querySelector(".cc-lim-ram"), s.ram, "ram");
    syncGear(group.querySelector(".cc-lim-bw"), s.bw, "bw");
    var bwv = group.querySelector(".cc-b-bw .cc-b-v"); if (bwv) bwv.textContent = vmBwText(lim);
  }
  function refreshAllRes() { try { Array.prototype.forEach.call(document.querySelectorAll("#kvm_list .cc-resgroup[data-cc-vm], .cc-vm-grid .cc-resgroup[data-cc-vm]"), refreshResGroup); } catch (e) {} }
  // one resource line: badge + its gear, side by side (docker.js resLine). Gear optional.
  function vmResLine(badge, gear) { var l = el("div", "cc-resline"); l.appendChild(badge); if (gear) l.appendChild(gear); return l; }
  // One live-resize row per disk, grow only (the engine rejects a shrink).
  function diskRow(name, d, statusEl) {
    var known = d.capacityBytes > 0;
    var curG = known ? (Math.round(d.capacityBytes / 1073741824 * 100) / 100) : 0;
    var row = el("div"); row.style.cssText = "display:flex;align-items:center;gap:8px;margin:0 0 7px 0";
    var lab = el("div"); lab.style.cssText = "flex:1;min-width:0;font-size:var(--cc-text-meta);color:var(--cc-text,#e6e6e6)";
    var tgt = el("span", null, d.target); tgt.style.cssText = "font-weight:600";
    var cur = el("span", null, "  " + (known ? curG + " GiB" : (VMDE ? "Größe unbekannt" : "size unknown"))); cur.style.cssText = "color:var(--cc-text-dim,#8a8a8a);font-family:Consolas,monospace";
    lab.appendChild(tgt); lab.appendChild(cur);
    if (!known) { row.appendChild(lab); return row; }   // source missing -> no size to grow from; label only
    var inp = el("input"); inp.type = "number"; inp.min = String(curG); inp.step = "1"; inp.value = String(Math.max(1, Math.ceil(curG)));
    inp.style.cssText = "width:74px;background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6);border:none;border-radius:var(--cc-radius-control);padding:6px 8px;font-size:var(--cc-text-subline);outline:none";
    var unit = el("span", null, "GiB"); unit.style.cssText = "font-size:var(--cc-text-meta);color:var(--cc-text-dim,#8a8a8a)";
    var btn = el("button", "cc-vm-grow", VMDE ? "Vergrößern" : "Grow"); btn.style.cssText = "background:var(--cc-accent,#FCC419);color:var(--cc-accent-text, #161616);border:none;border-radius:var(--cc-radius-pill);padding:6px 12px;font-size:var(--cc-text-meta);font-weight:600;cursor:pointer";
    btn.onclick = function () {
      var g = parseFloat(String(inp.value).replace(",", "."));
      if (isNaN(g) || g <= curG) { statusEl.textContent = ""; ccvFail(btn, (VMDE ? "Nur vergrößern, auf mehr als " : "Grow only, to more than ") + curG + " GiB"); return; }
      function doResize() {
        btn.disabled = true; statusEl.style.color = "var(--cc-text-dim,#8a8a8a)"; statusEl.textContent = VMDE ? "Vergrößern läuft…" : "resizing…";
        vmApi("POST", "vmdiskresize", { name: name, target: d.target, size_gib: g }).then(function () {
          btn.disabled = false; statusEl.style.color = "var(--cc-ok, #6fdc8c)"; statusEl.textContent = (VMDE ? "vergrößert auf " : "grown to ") + g + " GiB" + (VMDE ? " · Gast muss Partition/FS erweitern" : " · guest must extend partition/FS");
          curG = g; cur.textContent = "  " + g + " GiB"; d.capacityBytes = g * 1073741824; inp.min = String(g);
        }).catch(function (e) { btn.disabled = false; statusEl.textContent = ""; ccvFail(btn, String(e.message || e)); });
      }
      // A vDisk cannot shrink back without data loss, so a grow is asked first, in a window over
      // the limits editor.
      if (!window.CCTheme || !window.CCTheme.ask) return;
      window.CCTheme.ask({
        title: (VMDE ? "vDisk " + d.target + " vergrößern?" : "Grow vDisk " + d.target + "?"),
        text: curG + " GiB → " + g + " GiB. " + (VMDE ? "Verkleinern lässt sie sich danach nicht mehr." : "It cannot be shrunk again."),
        ok: VMDE ? "Vergrößern" : "Grow", cancel: VMDE ? "Abbrechen" : "Cancel", opener: btn, onOk: doResize
      });
    };
    row.appendChild(lab); row.appendChild(inp); row.appendChild(unit); row.appendChild(btn);
    return row;
  }
  function loadDisks(name, host, statusEl) {
    host.textContent = VMDE ? "lädt…" : "loading…";
    vmApi("GET", "vmdisks", null, "name=" + encodeURIComponent(name)).then(function (disks) {
      host.textContent = "";
      if (!disks || !disks.length) { host.textContent = VMDE ? "keine resizbaren Disks" : "no resizable disks"; return; }
      disks.forEach(function (d) { host.appendChild(diskRow(name, d, statusEl)); });
    }).catch(function (e) { host.textContent = String(e.message || e).slice(0, 70); });
  }
  // The limits editor. `which` is "cpu", "ram", "bw", "disk" or "all": a gear opens only its own
  // section, as Docker does. CPU, RAM and BW commit through vmlimits, disks through vmdiskresize.
  function openVmEd(name, which, anchor) {
    which = which || "all";
    var v = vmLims[name] || {};
    var showCpu = which === "all" || which === "cpu", showRam = which === "all" || which === "ram";
    var showBw = which === "all" || which === "bw", showDisk = which === "all" || which === "disk";
    var hasLimFields = showCpu || showRam || showBw;
    // A CannonadeCommand window anchored at the gear, in the .cc-win template of Tokens.css, the
    // same frame, title badge, content and button row as Docker's editors.
    var win = el("div", "cc-win"); win.id = "cc-vmlim";
    var titleMap = { cpu: VMDE ? "CPU-Limit" : "CPU limit", ram: VMDE ? "RAM-Limit" : "RAM limit", bw: VMDE ? "Bandbreite" : "Bandwidth", disk: VMDE ? "vDisk-Größe" : "vDisk size", all: VMDE ? "VM-Limits" : "VM limits" };
    win.appendChild(el("div", "cc-win-title", titleMap[which] + ": " + name));
    var card = el("div", "cc-win-card"); win.appendChild(card);
    var sub = el("div", null, (v.vcpus || 0) + " vCPUs · " + (v.maxMemMiB || 0) + " MiB max" + (v.running ? (VMDE ? " · läuft" : " · running") : (VMDE ? " · gestoppt" : " · stopped")));
    sub.style.cssText = "font-size:var(--cc-text-meta);color:var(--cc-text-dim,#8a8a8a);margin:0 0 14px 0"; card.appendChild(sub);
    var cores = (v.cpuCores && v.cpuCores !== "0-127") ? v.cpuCores : "";
    var f = {}, readCpuset = null;   // readCpuset() yields the pin cpuset (grid selection or text field)
    if (showCpu) {
      // the Docker tab's core picker when the topology is known, else a cpuset text field
      var grid = buildCoreGrid(cores);
      if (grid) {
        var pinWrap = el("div", "cc-vm-block");
        var pinLbl = el("label", "cc-vm-lbl", VMDE ? "CPU-Kerne (Pin)" : "CPU cores (pin)");
        if (window.CCTheme && window.CCTheme.infoIcon) pinLbl.appendChild(window.CCTheme.infoIcon(VMDE ? "Kerne anklicken, die die VM nutzen darf. Ohne Auswahl nutzt sie alle." : "Click the cores the VM may use. With none picked it uses all of them."));
        pinWrap.appendChild(pinLbl); pinWrap.appendChild(grid.node); card.appendChild(pinWrap);
        readCpuset = grid.read;
      } else {
        f.cores = vmFld(VMDE ? "CPU-Kerne (Pin)" : "CPU cores (pin)", VMDE ? "z. B. 6-15 · leer = alle" : "e.g. 6-15 · empty = all", cores, "6-15");
        card.appendChild(f.cores.wrap); readCpuset = function () { return f.cores.input.value.trim(); };
      }
      f.cap = vmFld(VMDE ? "CPU-Limit (Kerne)" : "CPU limit (cores)", VMDE ? "0 = unbegrenzt · z. B. 1.5" : "0 = unlimited · e.g. 1.5", v.cpuCap > 0 ? (v.cpuCap / 100) : "", "0");
      card.appendChild(f.cap.wrap);
    }
    if (showRam) { f.ram = vmFld("RAM (MiB)", (VMDE ? "aktuelles Max " : "current max ") + (v.maxMemMiB || 0) + (VMDE ? " MiB · höher = auch das Max wird angehoben (greift beim nächsten VM-Start)" : " MiB · higher also raises the max (takes effect on the next VM start)"), v.memMiB || "", String(v.maxMemMiB || 0)); card.appendChild(f.ram.wrap); }
    if (showBw) {
      f.dn = vmFld("Download (kbit/s)", VMDE ? "0 = unbegrenzt" : "0 = unlimited", v.inKbit || "", "0");
      f.up = vmFld("Upload (kbit/s)", VMDE ? "0 = unbegrenzt" : "0 = unlimited", v.outKbit || "", "0");
      card.appendChild(f.dn.wrap); card.appendChild(f.up.wrap);
    }
    if (showDisk) {
      var dsec = el("div"); dsec.style.cssText = "margin:2px 0 6px 0";
      var dlbl = el("div", null, VMDE ? "vDisks: Live-Resize (nur vergrößern)" : "vDisks: live resize (grow only)"); dlbl.style.cssText = "font-size:var(--cc-text-meta);font-weight:600;margin:0 0 8px 0;color:var(--cc-text,#e6e6e6)";
      var dlist = el("div"); dlist.style.cssText = "font-size:var(--cc-text-meta);color:var(--cc-text-dim,#8a8a8a)";
      var dstat = el("div"); dstat.style.cssText = "font-size:var(--cc-text-meta);color:var(--cc-text-dim,#8a8a8a);margin-top:2px";
      dsec.appendChild(dlbl); dsec.appendChild(dlist); dsec.appendChild(dstat); card.appendChild(dsec);
      loadDisks(name, dlist, dstat);
    }
    // Icon colouring for this VM sits in every variant of the editor, since the VM tab has no
    // other per-item settings. It is a display choice and applies at once, not on Apply.
    (function () {
      var CI = window.CCTheme && window.CCTheme.icons; if (!CI) return;
      var row = el("div", "cc-vm-row");
      var l = el("label", "cc-vm-lbl", VMDE ? "Icon-Färbung" : "Icon colouring");
      var sel = el("select");
      var opts = VMDE
        ? [["", "folgt globaler Einstellung"], ["auto", "Automatisch"], ["native", "Natives Icon"], ["flat", "Nachzeichnen"], ["tint", "Tönen"], ["original", "Original-Logo"]]
        : [["", "follows the global setting"], ["auto", "Automatic"], ["native", "Native icon"], ["flat", "Redraw"], ["tint", "Tone"], ["original", "Original logo"]];
      var cur = CI.override("vm", name);
      opts.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === cur) op.selected = true; sel.appendChild(op); });
      sel.addEventListener("change", function () { CI.setOverride("vm", name, sel.value); paintVmIcons(); });   // `apply` here is the editor's Apply button
      row.appendChild(l); row.appendChild(vmDsel(sel)); card.appendChild(row);
    })();
    // the progress line of Apply, at the foot of the card
    var msg = el("div"); msg.style.cssText = "font-size:var(--cc-text-meta);color:var(--cc-text-dim,#8a8a8a)"; card.appendChild(msg);
    // The close badge comes from the modal, so the row holds Apply alone, and a vDisk-only window,
    // whose grow buttons act on their own, has no row at all.
    var apply = null;
    if (hasLimFields) {
      var act = el("div", "cc-win-act");
      apply = el("span", "cc-win-btn cc-win-go", VMDE ? "Anwenden" : "Apply"); act.appendChild(apply);
      win.appendChild(act);
    }
    document.body.appendChild(win);
    var CT = window.CCTheme;
    if (CT && CT.pressable && apply) CT.pressable(apply);
    if (CT && CT.paintWin) CT.paintWin(win);
    if (CT && CT.paintSelects) CT.paintSelects(win);
    // at the gear, above it when the page ends first, and off the viewport's edges
    try {
      var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null, cw = win.offsetWidth || 420, ch = win.offsetHeight || 300;
      if (r && (r.width || r.height)) {
        var at = CT.placeAt(r, cw, ch, 6);
        win.style.left = (window.scrollX + at.left) + "px"; win.style.top = (window.scrollY + at.top) + "px";
      } else { win.style.left = "50%"; win.style.top = "12vh"; win.style.transform = "translateX(-50%)"; }
    } catch (e) { win.style.left = "50%"; win.style.top = "12vh"; win.style.transform = "translateX(-50%)"; }
    var into = f.cores ? f.cores.input : f.ram ? f.ram.input : f.dn ? f.dn.input : null;
    var modal = CT && CT.modal ? CT.modal(win, { opener: anchor, focus: into || undefined }) : null;
    function close() { if (modal) modal.close(); else if (win.parentNode) win.parentNode.removeChild(win); }
    function intOr(s) { s = (s || "").trim(); if (s === "") return null; var n = parseInt(s, 10); return isNaN(n) ? null : n; }
    var busy = false;
    if (apply) apply.onclick = function () {
      if (busy) return;
      var body = { name: name };
      if (readCpuset) body.cpu_cores = readCpuset(); // "" (no cores selected) clears the pin
      if (f.cap) { var capRaw = f.cap.input.value.trim(); if (capRaw === "") body.cpu_cap = 0; else { var cf = parseFloat(capRaw.replace(",", ".")); if (!isNaN(cf)) body.cpu_cap = Math.max(0, Math.round(cf * 100)); } }
      if (f.ram) { var ramN = intOr(f.ram.input.value); if (ramN != null && ramN > 0) body.mem_mib = ramN; }
      if (f.dn) { var dnN = intOr(f.dn.input.value); if (dnN != null) body.in_kbit = Math.max(0, dnN); }
      if (f.up) { var upN = intOr(f.up.input.value); if (upN != null) body.out_kbit = Math.max(0, upN); }
      busy = true; msg.style.color = "var(--cc-text-dim,#8a8a8a)"; msg.textContent = VMDE ? "wird angewendet…" : "applying…";
      vmApi("POST", "vmlimits", body).then(function (res) { if (res && res.vm) vmLims[name] = res.vm; try { refreshAllRes(); } catch (e) {} close(); })
        .catch(function (e) { busy = false; msg.textContent = ""; ccvFail(apply, String(e.message || e)); });
    };
  }
  // The Actions column, built like docker.js's action bar. Each icon calls the native global the
  // VM context menu uses (vmmanager.js addVMContext), with the VM context read from the logo's
  // span#vm-<uuid> and its onclick=addVMContext('name','uuid','template','state','vmrcurl',
  // 'PROTO','log','fstype','console;rdp','','webui',...). Native calls are typeof-guarded, so a
  // missing Unraid global leaves a button that does nothing.
  function ccGlyph(name) { return window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph(name) : ""; }
  function actBtn(icon, tip, fn) {
    var b = el("span", "cc-actbtn"); b.title = tip; b.setAttribute("aria-label", tip); b.innerHTML = ccGlyph(icon);
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { fn(); } catch (_) {} });
    if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(b);
    return b;
  }
  function actBtnOff(icon, tip) { var b = el("span", "cc-actbtn cc-actoff"); b.title = tip; b.setAttribute("aria-disabled", "true"); b.innerHTML = ccGlyph(icon); return b; }
  function vmDisp(action, uuid) { if (typeof window.ajaxVMDispatch === "function") window.ajaxVMDispatch({ action: action, uuid: uuid }, "loadlist"); }
  // As docker.js tintAct: an accent or rainbow colour per button, grey for cc-actoff.
  function tintAct(bar) {
    var colorsOn = ls("cc.actcolors") !== "0";
    var rb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1";
    // In the reactive sub-mode buttons rest grey and take their colour on row hover, so only
    // --cc-rb-c/--cc-rb-ct are stamped; an inline !important background would beat the sheet.
    var neutral = rb && ls("cc.rbmode") === "active";
    // flag mode keeps its own palette in cc.flagpal
    var pal = vmPalActive();
    var off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET;
    Array.prototype.slice.call(bar.querySelectorAll(".cc-actbtn")).forEach(function (b2, i2) {
      var bg = "var(--cc-surface-3, #2e2e2e)", tx = "var(--cc-text-dim, #8a8a8a)";
      if (!b2.classList.contains("cc-actoff")) {
        tx = "var(--cc-text, #e6e6e6)";
        if (colorsOn) { bg = !rb ? ccAccent() : pal[(i2 + off) % pal.length]; tx = ccIdeal(bg); }
      }
      if (neutral && colorsOn && !b2.classList.contains("cc-actoff")) {
        b2.style.setProperty("--cc-rb-c", bg); b2.style.setProperty("--cc-rb-ct", tx);
        b2.style.removeProperty("background"); b2.style.removeProperty("color");
      } else {
        b2.style.removeProperty("--cc-rb-c"); b2.style.removeProperty("--cc-rb-ct");
        b2.style.setProperty("background", bg, "important");
        b2.style.setProperty("color", tx, "important");
      }
    });
  }
  function vmCtxFor(tr) {
    var out = { uuid: "", name: "", state: "", vmrcurl: "", proto: "", log: "", fstype: "QEMU", webui: "", console: "web" };
    try {
      var hand = tr.querySelector("td.vm-name span.outer > span.hand[id^='vm-']") || tr.querySelector("td.vm-name span.hand[onclick*='addVMContext']");
      if (!hand) return out;
      var id = hand.id || ""; if (id.indexOf("vm-") === 0) out.uuid = id.slice(3);
      var oc = hand.getAttribute("onclick") || "";
      var m = oc.match(/addVMContext\s*\(([\s\S]*)\)/); if (!m) return out;
      var toks = m[1].match(/'(?:[^'\\]|\\.)*'/g) || [];
      var q = toks.map(function (s) { return s.slice(1, -1).replace(/\\(.)/g, "$1"); });
      out.name = q[0] || ""; if (!out.uuid) out.uuid = q[1] || "";
      out.state = q[3] || ""; out.vmrcurl = q[4] || ""; out.proto = q[5] || "";
      out.log = q[6] || ""; out.fstype = q[7] || "QEMU"; out.console = (q[8] || "web").split(";")[0];
      out.webui = q[10] || "";
    } catch (e) {}
    return out;
  }
  function vmRemove(uuid, name, withDisks) {
    var de = LANG === "de";
    var run = function () { vmDisp(withDisks ? "domain-delete" : "domain-undefine", uuid); };
    if (!window.CCTheme || !window.CCTheme.ask) return;
    window.CCTheme.ask(withDisks ? {
      title: de ? "VM „" + name + "“ samt vDisks löschen?" : "Delete VM “" + name + "” and its vDisks?",
      text: de ? "Die VM und ihre vDisks werden gelöscht. Das lässt sich nicht rückgängig machen." : "This deletes the VM and its vDisks. It cannot be undone.",
      ok: de ? "Löschen" : "Delete", cancel: de ? "Abbrechen" : "Cancel", danger: true, onOk: run
    } : {
      title: de ? "VM „" + name + "“ entfernen?" : "Remove VM “" + name + "”?",
      text: de ? "Die VM verschwindet aus der Liste. Ihre vDisks bleiben, wo sie sind." : "This takes the VM off the list. Its vDisks stay where they are.",
      ok: de ? "Entfernen" : "Remove", cancel: de ? "Abbrechen" : "Cancel", danger: true, onOk: run
    });
  }
  // As docker.js actionBars(): console, log and edit, then restart, pause or resume, stop or start
  // and More, whose menu holds the console, hibernate, force stop, snapshot, clone and remove.
  function vmActionBars(tr) {
    var de = LANG === "de";
    var cx = vmCtxFor(tr), uuid = cx.uuid, name = cx.name, st = cx.state;
    var running = st === "running", paused = st === "paused" || st === "pmsuspended", shutoff = !running && !paused;
    var path = location.pathname; var xi = path.indexOf("?"); if (xi !== -1) path = path.substring(0, xi);
    var bar = el("div", "cc-actbar");
    var r1 = el("div", "cc-actrow");
    var vnc = (de ? "VNC-Konsole" : "VNC Console") + (cx.proto ? " (" + cx.proto + ")" : "");
    // the VNC console takes the place of Docker's WebUI
    r1.appendChild((cx.vmrcurl && running) ? actBtn("VM", vnc, function () { window.open(cx.vmrcurl, "_blank", "scrollbars=yes,resizable=yes"); }) : actBtnOff("VM", de ? "keine Konsole" : "no console"));
    r1.appendChild((cx.log && typeof window.openTerminal === "function") ? actBtn("Log", "Log", function () { window.openTerminal("log", name, cx.log); }) : actBtnOff("Log", "Log"));
    r1.appendChild(actBtn("Pencil", de ? "Bearbeiten" : "Edit", function () { location.href = path + "/UpdateVM?uuid=" + uuid; }));
    var r2 = el("div", "cc-actrow");
    r2.appendChild(running ? actBtn("Refresh", de ? "Neustart" : "Restart", function () { vmDisp("domain-restart", uuid); }) : actBtnOff("Refresh", de ? "Neustart" : "Restart"));
    r2.appendChild(paused ? actBtn("Resume", de ? "Fortsetzen" : "Resume", function () { vmDisp(st === "pmsuspended" ? "domain-pmwakeup" : "domain-resume", uuid); })
      : (running ? actBtn("Pause", "Pause", function () { vmDisp("domain-pause", uuid); }) : actBtnOff("Pause", "Pause")));
    r2.appendChild((running || paused) ? actBtn("Stop", de ? "Stoppen" : "Stop", function () { vmDisp("domain-stop", uuid); })
      : actBtn("Play", de ? "Starten" : "Start", function () { vmDisp("domain-start", uuid); }));
    var extras = [];
    if (cx.vmrcurl && running) extras.push({ glyph: "VM", label: (de ? "VM-Konsole" : "VM Console") + (cx.proto ? " (" + cx.proto + ")" : ""), run: function () { window.open(cx.vmrcurl, "_blank", "scrollbars=yes,resizable=yes"); } });
    if (running) extras.push({ glyph: "Moon", label: de ? "Ruhezustand" : "Hibernate", run: function () { vmDisp("domain-pmsuspend", uuid); } });
    if (running || paused) extras.push({ glyph: "Power", label: de ? "Stopp erzwingen" : "Force Stop", run: function () { vmDisp("domain-destroy", uuid); } });
    if ((running || shutoff) && typeof window.selectsnapshot === "function") extras.push({ glyph: "BackupNow", label: de ? "Snapshot erstellen" : "Create Snapshot", run: function () { window.selectsnapshot(uuid, name, "--generate", "create", false, st, cx.fstype); } });
    if (shutoff && typeof window.VMClone === "function") extras.push({ glyph: "Copy", label: de ? "Klonen" : "Clone", run: function () { window.VMClone(uuid, name); } });
    if (shutoff) {
      extras.push({ glyph: "Trash", label: de ? "VM entfernen" : "Remove VM", del: true, run: function () { vmRemove(uuid, name, false); } });
      extras.push({ glyph: "TrashFiles", label: de ? "VM + Disks entfernen" : "Remove VM & Disks", del: true, run: function () { vmRemove(uuid, name, true); } });
    }
    if (extras.length && window.CCTheme && window.CCTheme.menu) {
      var moreBtn = actBtn("More", de ? "Mehr" : "More", function () { window.CCTheme.menu(moreBtn, extras); });
      r2.appendChild(moreBtn);
    } else {
      r2.appendChild(actBtnOff("More", de ? "keine weiteren Aktionen" : "no more actions"));
    }
    bar.appendChild(r1); bar.appendChild(r2);
    tintAct(bar);
    return { bar: bar, sig: st + "|" + cx.webui + "|" + cx.vmrcurl + "|" + cx.log + "|" + uuid };
  }
  function injectVmActionCell(tr, nameTd) {
    try {
      var de = LANG === "de";
      nameTd = nameTd || tr.querySelector(":scope > td.vm-name");
      var head = document.querySelector("#kvm_table thead tr");
      // The Actions th goes in once, after the Name th. thead survives the #kvm_list re-renders, so
      // every row needs its Actions td or it renders one column short.
      if (head && !head.querySelector(".cc-act-th")) {
        var nameTh = head.querySelector("th.th1") || head.children[0];
        var th = el("th", "cc-act-th", de ? "Aktionen" : "Actions");
        head.insertBefore(th, nameTh ? nameTh.nextSibling : head.firstChild);
      }
      var old = tr.querySelector(":scope > td.cc-actcell");
      var ab = null;
      try { ab = vmActionBars(tr); } catch (e) { ab = null; }              // a failed row still gets its td
      if (old) { if (ab && old.getAttribute("data-cc-sig") === ab.sig) return; old.remove(); } // rebuild only on change
      var td = el("td", "cc-actcell");
      if (ab) { td.setAttribute("data-cc-sig", ab.sig); td.appendChild(ab.bar); }
      // inserted even when empty, so the column counts of thead and tbody always match
      tr.insertBefore(td, nameTd ? nameTd.nextSibling : (tr.children[1] || null));
    } catch (e) {}
  }
  function vmCell(td, label, kind) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    if (td.querySelector("br, table, .diskresize")) return;      // skip multi-line / interactive cells
    var txt = (td.textContent || "").trim(); if (!txt || txt === "-") return;
    var b = el("span", "cc-b cc-b-info" + (kind ? " cc-b-" + kind : ""));
    if (label) b.appendChild(el("span", "cc-b-k", label));
    var v = el("span", "cc-b-v"); while (td.firstChild) v.appendChild(td.firstChild); b.appendChild(v);  // keep live children (a.vcpu-*) inside .cc-b-v
    td.appendChild(b); td.classList.add("cc-vmb-cell");
  }
  // CPU, RAM and BW stacked in one column like Docker's .cc-resgroup. The VM table has separate
  // CPU and RAM cells, so the RAM content moves (live children, not clones) into the CPU cell and
  // the native RAM cell and header are hidden.
  function vmResCell(cpuTd, ramTd) {
    if (!cpuTd || cpuTd.classList.contains("cc-vmb-cell")) return;
    var vmn = vmNameOf(cpuTd.closest("tr"));
    var lim = (vmn && vmLims[vmn]) || {}, s = limSet(lim);
    var group = el("div", "cc-resgroup"); if (vmn) group.setAttribute("data-cc-vm", vmn);
    var cb = el("span", "cc-b cc-b-info cc-b-cpu"); cb.appendChild(el("span", "cc-b-k", "CPU"));
    var cv = el("span", "cc-b-v"); var cpuTxt = (cpuTd.textContent || "").trim();
    if (cpuTxt && cpuTxt !== "-") { while (cpuTd.firstChild) cv.appendChild(cpuTd.firstChild); } else cv.textContent = "-";
    cb.appendChild(cv);
    group.appendChild(vmResLine(cb, vmn ? vmGear(vmn, "cpu", s.cpu) : null));
    if (ramTd) {
      var rb = el("span", "cc-b cc-b-info cc-b-ram"); rb.appendChild(el("span", "cc-b-k", "RAM"));
      var rv = el("span", "cc-b-v"); var ramTxt = (ramTd.textContent || "").trim();
      if (ramTxt && ramTxt !== "-") { while (ramTd.firstChild) rv.appendChild(ramTd.firstChild); } else rv.textContent = "-";
      rb.appendChild(rv);
      group.appendChild(vmResLine(rb, vmn ? vmGear(vmn, "ram", s.ram) : null));
      ramTd.style.display = "none"; ramTd.classList.add("cc-vmb-ramcell");   // hidden, reverted in teardown
    }
    // VMs have no native BW cell
    var bwB = el("span", "cc-b cc-b-info cc-b-bw"); bwB.appendChild(el("span", "cc-b-k", "BW"));
    bwB.appendChild(el("span", "cc-b-v", vmBwText(lim)));
    group.appendChild(vmResLine(bwB, vmn ? vmGear(vmn, "bw", s.bw) : null));
    cpuTd.appendChild(group); cpuTd.classList.add("cc-vmb-cell", "cc-vmb-rescell");
    hideResHeader();
  }
  // Hides the native memory header once, found by its text because the Actions column shifts the
  // indices. teardown reverts it.
  function hideResHeader() {
    try {
      var head = document.querySelector("#kvm_table thead tr");
      if (!head || head.getAttribute("data-cc-reshdr")) return;
      var ths = head.querySelectorAll("th");
      for (var i = 0; i < ths.length; i++) {
        var t = (ths[i].textContent || "").trim().toLowerCase();
        if (/memory|speicher|^ram\b|^mem\b/.test(t)) { ths[i].style.display = "none"; ths[i].classList.add("cc-vmb-ramhdr"); break; }
      }
      head.setAttribute("data-cc-reshdr", "1");
    } catch (e) {}
  }
  // Cells are found by class and content (VMMachines.php L217-229) rather than by index, which the
  // injected Actions td or a missing description would shift. span.vmgraphics marks the graphics
  // cell and then the IP cell, and is matched at any depth, since a badged cell holds it inside
  // its badge.
  function vmCells(row) {
    var c = { name: row.querySelector(":scope > td.vm-name"), desc: null };
    var vcpuA = row.querySelector(":scope > td a[class*='vcpu-']");   // <a class='vcpu-$uuid'> (L224)
    c.cpu = vcpuA ? vcpuA.closest("td") : null;
    c.ram = c.cpu ? c.cpu.nextElementSibling : null;                  // $mem cell (L225)
    if (c.cpu) { var p = c.cpu.previousElementSibling; if (p && !p.classList.contains("vm-name") && !p.classList.contains("cc-actcell")) c.desc = p; }
    var diskSpan = row.querySelector(":scope > td > span.state");      // vm-name's span.state is nested deeper (L226)
    c.disk = diskSpan ? diskSpan.parentNode : null;
    var vg = row.querySelectorAll(":scope > td span.vmgraphics");      // graphics (L227) then ip (L228), document order
    c.graphics = vg[0] ? vg[0].closest("td") : null;
    c.ip = vg[1] ? vg[1].closest("td") : null;
    return c;
  }
  // The native IP cell joins one "addr/prefix" per line with <br>, and textContent would glue the
  // lines together, so the split follows the <br> elements.
  function vmIpLines(td) {
    var span = td.querySelector("span.vmgraphics") || td, lines = [], cur = "";
    Array.prototype.forEach.call(span.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === "BR") { lines.push(cur); cur = ""; }
      else cur += (n.textContent || "");
    });
    lines.push(cur);
    return lines.map(function (s) { return s.trim(); }).filter(function (s) {
      return /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d+)?$/.test(s) || /^[0-9a-f:]+(?:\/\d+)?$/i.test(s);
    });
  }
  // Without an address Unraid writes the same sentence about the guest agent into every row, so a
  // muted dash stands there instead and the sentence becomes the (i) beside it.
  function vmNoIp() {
    var s = el("span", "cc-vmb-noip");
    s.appendChild(el("span", "cc-vmb-noip-dash", "-"));
    if (window.CCTheme && window.CCTheme.infoIcon) s.appendChild(window.CCTheme.infoIcon(LANG === "de" ? "Die IP-Adresse steht hier, sobald in der VM der QEMU-Gast-Agent läuft." : "The IP address shows here once the QEMU guest agent runs in the VM."));
    return s;
  }
  // Each address becomes a Docker-style click-to-copy pill.
  function vmIpCell(td) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    var ips = vmIpLines(td), wrap = el("span", "cc-vmb-ips");
    if (!ips.length) wrap.appendChild(vmNoIp());
    ips.forEach(function (ip) {
      var b = el("span", "cc-b cc-b-info cc-b-ip cc-b-copy"); b.appendChild(el("span", "cc-b-k", "IP")); b.appendChild(el("span", "cc-b-v", ip));
      b.title = "Klicken zum Kopieren";
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ip); } catch (_) {} b.classList.add("cc-copied"); setTimeout(function () { try { b.classList.remove("cc-copied"); } catch (x) {} }, 600); });
      wrap.appendChild(b);
    });
    for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.display = "none"; }  // hide native, don't destroy -> reversible teardown
    td.appendChild(wrap); td.classList.add("cc-vmb-cell", "cc-vmb-ipcell");
  }
  // The disks cell holds span.state = "DISKS&nbsp;&nbsp;&nbsp;&nbsp;CDS<a.hand ISO-picker><br>(Snapshots: X)".
  // DISKS and CDS each read "count / size", so they are told apart by the run of spaces between
  // them rather than by single spaces.
  function vmDiskParts(span) {
    var preTxt = "", postTxt = "", seenBr = false, link = null;
    Array.prototype.forEach.call(span.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === "BR") { seenBr = true; return; }
      if (!seenBr) { if (n.nodeType === 1 && n.classList && n.classList.contains("hand")) link = n; else preTxt += (n.textContent || ""); }
      else postTxt += (n.textContent || "");
    });
    var parts = preTxt.split(/[\s ]{2,}/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ""; });
    var sm = /\(([^:]+):\s*([^)]*)\)/.exec(postTxt.replace(/ /g, " ").trim());
    return { disks: parts[0] || "", cds: parts.slice(1).join(" "), link: link, snapLabel: sm ? sm[1].trim() : "Snapshots", snapVal: sm ? sm[2].trim() : "" };
  }
  function vmBadge(label, value, kind) {
    var b = el("span", "cc-b cc-b-info" + (kind ? " cc-b-" + kind : ""));
    if (label) b.appendChild(el("span", "cc-b-k", label));
    b.appendChild(el("span", "cc-b-v", value));
    return b;
  }
  // vDisks with the live-resize gear, CD with a copy of the ISO picker (its inline onclick survives
  // cloneNode) and Snapshots, for the list cell and the tile alike.
  function vmDiskBadges(name, p) {
    var out = [];
    if (p.disks && p.disks !== "-") { var vd = vmBadge("vDisks", p.disks, "vol"); out.push(name ? vmResLine(vd, vmGear(name, "disk", false)) : vd); }
    if (p.cds) {
      var cd = vmBadge("CD", p.cds, "vol");
      if (p.link) { var cl = p.link.cloneNode(true); cl.style.marginLeft = "6px"; cd.querySelector(".cc-b-v").appendChild(cl); }
      out.push(cd);
    }
    if (p.snapVal) out.push(vmBadge(p.snapLabel, p.snapVal, ""));
    return out;
  }
  // vmCell skips the disks cell for its <br>, so it gets its own badges and the native span is hidden.
  function vmDiskCell(td) {
    if (!td || td.classList.contains("cc-vmb-cell")) return;
    var span = td.querySelector(":scope > span.state"); if (!span) return;
    var badges = vmDiskBadges(vmNameOf(td.closest("tr")), vmDiskParts(span));
    if (!badges.length) return;                         // nothing parseable -> leave native untouched
    var wrap = el("span", "cc-vmb-disks");
    badges.forEach(function (b) { wrap.appendChild(b); });
    span.style.display = "none";                        // hide native, reversible
    td.appendChild(wrap); td.classList.add("cc-vmb-cell", "cc-vmb-diskcell");
  }
  // The tiles. Unraid's table stays in the page, hidden, as their source: loadlist() rebuilds it and
  // its controls carry Unraid's own handlers. The tiles live in a container of their own beside it,
  // since a CSS reflow of the live table fights tablesorter and the drag sorting. A tile is drawn
  // from its row and redrawn only when what it shows has changed, so hover and focus survive the
  // frequent passes.
  var vmGridHolder = null;
  function removeVmGrid() { if (vmGridHolder && vmGridHolder.parentNode) vmGridHolder.parentNode.removeChild(vmGridHolder); vmGridHolder = null; }
  function vmRowData(tr) {
    var cx = vmCtxFor(tr), c = vmCells(tr);
    var txt = function (n) { return n ? (n.textContent || "").replace(/\s+/g, " ").trim() : ""; };
    var st = c.name ? c.name.querySelector("span.state") : null;
    var ds = /cc-badge-(running|paused|exited)/.exec(st ? st.className : "");
    var dspan = c.disk ? c.disk.querySelector(":scope > span.state") : null;
    var auto = tr.querySelector("input.autostart");
    return {
      name: cx.name || vmNameOf(tr) || "", uuid: cx.uuid, state: ds ? ds[1] : "exited", label: txt(st),
      cpu: txt(c.cpu ? c.cpu.querySelector("a[class*='vcpu-']") : null) || "-",
      ram: txt(c.cpu && c.cpu.querySelector(".cc-b-ram .cc-b-v") || c.ram) || "-",
      disks: dspan ? vmDiskParts(dspan) : null,
      graphics: txt(c.graphics ? c.graphics.querySelector("span.vmgraphics") : null),
      ips: c.ip ? vmIpLines(c.ip) : [],
      auto: auto ? auto.checked : null,
      ctx: [cx.state, cx.vmrcurl, cx.log, cx.webui].join("|")
    };
  }
  function vmCardSig(d) { return JSON.stringify(d, function (k, v) { return k === "link" ? (v ? v.getAttribute("onclick") : "") : v; }); }
  // A tile's autostart switch works the row's own checkbox through Unraid's switchButton, so
  // Unraid's change handler saves it exactly as a click in the list would.
  function vmNativeAuto(uuid) { return uuid ? document.querySelector('#kvm_list input.autostart[uuid="' + uuid + '"]') : null; }
  function vmAutoSwitch(uuid) {
    if (!vmNativeAuto(uuid)) return null;
    var tg = el("span", "cc-set-toggle cc-vmc-auto"); tg.setAttribute("role", "switch"); tg.setAttribute("tabindex", "0");
    tg.setAttribute("aria-label", "Autostart"); tg.setAttribute("data-tip", "Autostart");
    tg.appendChild(el("span", "cc-set-knob"));
    function show(on) { tg.classList.toggle("cc-set-toggle-on", on); tg.setAttribute("aria-checked", on ? "true" : "false"); }
    function flip() {
      var b = vmNativeAuto(uuid); if (!b) return;
      var sw = b.parentNode ? b.parentNode.querySelector(".switch-button-background") : null;
      if (sw) sw.click(); else b.click();
      show(b.checked);
    }
    show(vmNativeAuto(uuid).checked);
    tg.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); flip(); });
    tg.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    return tg;
  }
  // Laid out like the Docker grid card: the logo, the name with the IP under it, the autostart
  // switch in the corner with the state under it while the VM is not running, the action buttons
  // in one row and the resource badges with their gears at the foot.
  function vmCard(tr, d) {
    var card = el("div", "cc-vmc"); card.setAttribute("data-name", d.name);
    var head = el("div", "cc-vmc-head");
    var box = el("span", "cc-vmc-icobox"), ico = tr.querySelector("td.vm-name span.hand > .img");
    if (ico) { var ic = ico.cloneNode(true); ic.removeAttribute("style"); box.appendChild(ic); }
    head.appendChild(box);
    var nb = el("div", "cc-vmc-name"), title = el("div", "cc-vmc-title", d.name);
    // PCI Changed and the like, which also say why the VM cannot start
    Array.prototype.forEach.call(tr.querySelectorAll("td.vm-name .inner > i.fa-warning"), function (w) { title.appendChild(w.cloneNode(true)); });
    title.addEventListener("mouseover", function () { if (title.scrollWidth > title.clientWidth) title.setAttribute("data-tip", d.name); else title.removeAttribute("data-tip"); });
    nb.appendChild(title);
    var ip = el("div", "cc-vmc-ip");
    // a list cut short after two lines comes up whole as the tip
    if (d.ips.length) {
      ip.textContent = d.ips.join(" · ");
      ip.addEventListener("mouseover", function () { if (ip.scrollHeight > ip.clientHeight) ip.setAttribute("data-tip", d.ips.join(" · ")); else ip.removeAttribute("data-tip"); });
    } else ip.appendChild(vmNoIp());
    nb.appendChild(ip);
    head.appendChild(nb);
    var corner = el("div", "cc-vmc-corner"), auto = vmAutoSwitch(d.uuid);
    if (auto) { var r1 = el("div", "cc-vmc-cornerrow"); r1.appendChild(auto); corner.appendChild(r1); }
    if (d.state !== "running" && d.label) { var r2 = el("div", "cc-vmc-cornerrow cc-vmc-state"); r2.appendChild(el("span", "cc-badge cc-badge-" + d.state, d.label)); corner.appendChild(r2); }
    head.appendChild(corner);
    card.appendChild(head);
    var bar = el("div", "cc-vmc-actbar"); bar.appendChild(vmActionBars(tr).bar);
    card.appendChild(bar);
    var lim = vmLims[d.name] || {}, s = limSet(lim);
    var rg = el("div", "cc-resgroup cc-vmc-res"); rg.setAttribute("data-cc-vm", d.name);
    rg.appendChild(vmResLine(vmBadge("CPU", d.cpu, "cpu"), vmGear(d.name, "cpu", s.cpu)));
    rg.appendChild(vmResLine(vmBadge("RAM", d.ram, "ram"), vmGear(d.name, "ram", s.ram)));
    rg.appendChild(vmResLine(vmBadge("BW", vmBwText(lim), "bw"), vmGear(d.name, "bw", s.bw)));
    if (d.disks) vmDiskBadges(d.name, d.disks).forEach(function (b) { rg.appendChild(b); });
    if (d.graphics) rg.appendChild(vmBadge("", d.graphics, ""));
    card.appendChild(rg);
    return card;
  }
  function renderVmGrid() {
    var table = document.getElementById("kvm_table");
    if (!table || !table.parentNode) return;
    if (!vmGridHolder || vmGridHolder.parentNode !== table.parentNode) {
      removeVmGrid();
      vmGridHolder = el("div", "cc-vm-grid-holder");
      vmGridHolder.appendChild(el("div", "cc-vm-grid"));
      table.parentNode.insertBefore(vmGridHolder, table);
    }
    var grid = vmGridHolder.firstChild, have = {}, seen = {}, prev = null;
    Array.prototype.forEach.call(grid.children, function (k) { have[k.getAttribute("data-name")] = k; });
    var rows = document.querySelectorAll("#kvm_list tr.sortable");
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i], d = vmRowData(tr);
      if (!d.name) continue;
      seen[d.name] = true;
      var sig = vmCardSig(d), card = have[d.name];
      if (!card || card.getAttribute("data-cc-sig") !== sig) {
        var fresh = vmCard(tr, d); fresh.setAttribute("data-cc-sig", sig);
        if (card) grid.replaceChild(fresh, card);
        card = fresh;
      }
      // the row's rainbow slot, which the logo tile and the adopt ink fall back to
      ["--cc-rb-c", "--cc-rb-ct"].forEach(function (k) { var v = tr.style.getPropertyValue(k); if (v) card.style.setProperty(k, v); else card.style.removeProperty(k); });
      var want = prev ? prev.nextSibling : grid.firstChild;
      if (card !== want) grid.insertBefore(card, want);
      prev = card;
    }
    Object.keys(have).forEach(function (n) { if (!seen[n] && have[n].parentNode) grid.removeChild(have[n]); });
  }
  function enhanceCells() {
    try {
      var rows = document.querySelectorAll("#kvm_list tr.sortable");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        // A rotating colour per row lets the logo tile join the rainbow, since the badges are
        // coloured per kind. The tile rule prefers it over the iconbg colour, as on Docker and Plugins.
        try {
          if (ls("cc.theming") !== "0" && ls("cc.rainbow") === "1") {
            var _off = ls("cc.rainbowrot") === "0" ? 0 : RB_OFFSET, _pal = RB_PAL;
            try { if (ls("cc.flagmode") === "1") { var _f = JSON.parse(ls("cc.flagpal") || "null"); if (_f && _f.length) _pal = _f; } else { var _r = JSON.parse(ls("cc.rbpal") || "null"); if (_r && _r.length) _pal = _r; } } catch (_e) {}
            if (window.CCTheme && window.CCTheme.surfacePalette) _pal = window.CCTheme.surfacePalette(_pal, ccAccent());
            var _c = _pal[(i + _off) % _pal.length];
            row.style.setProperty("--cc-rb-c", _c); row.style.setProperty("--cc-rb-ct", ccIdeal(_c));
          } else { row.style.removeProperty("--cc-rb-c"); row.style.removeProperty("--cc-rb-ct"); }
        } catch (_eR) {}
        var c = vmCells(row);
        if (c.desc) vmCell(c.desc, "", "desc");
        if (c.cpu) vmResCell(c.cpu, c.ram);
        if (c.graphics) vmCell(c.graphics, "", "");
        if (c.ip) vmIpCell(c.ip);
        if (c.disk) vmDiskCell(c.disk);
        injectVmActionCell(row, c.name);
      }
    } catch (e) {}
  }
  function enhanceCellsTeardown() {
    try {
      var cells = document.querySelectorAll("#kvm_list td.cc-vmb-cell");
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.classList.contains("cc-vmb-rescell")) continue;   // handled by the pass below
        if (td.classList.contains("cc-vmb-diskcell")) {
          var dw = td.querySelector(":scope > span.cc-vmb-disks"); if (dw) td.removeChild(dw);
          var ds = td.querySelector(":scope > span.state"); if (ds) ds.style.removeProperty("display");
          td.classList.remove("cc-vmb-cell", "cc-vmb-diskcell"); continue;
        }
        if (td.classList.contains("cc-vmb-ipcell")) {
          var ipw = td.querySelector(":scope > span.cc-vmb-ips"); if (ipw) td.removeChild(ipw);
          for (var c = td.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) c.style.removeProperty("display"); }
          td.classList.remove("cc-vmb-cell", "cc-vmb-ipcell"); continue;
        }
        var b = td.querySelector(":scope > span.cc-b-info");
        if (b) { var k = b.querySelector(".cc-b-k"); if (k) b.removeChild(k); var v = b.querySelector(".cc-b-v"); var src = v || b; while (src.firstChild) td.insertBefore(src.firstChild, b); td.removeChild(b); }
        td.classList.remove("cc-vmb-cell");
      }
      // move CPU and RAM back into their native cells and unhide the RAM cell and header
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list td.cc-vmb-rescell")).forEach(function (cpuTd) {
        var g = cpuTd.querySelector(":scope > .cc-resgroup"), ramTd = cpuTd.nextElementSibling;
        if (g) {
          var cpuV = g.querySelector(".cc-b-cpu .cc-b-v"), ramV = g.querySelector(".cc-b-ram .cc-b-v");
          if (cpuV) while (cpuV.firstChild) cpuTd.insertBefore(cpuV.firstChild, g);
          if (ramV && ramTd) while (ramV.firstChild) ramTd.appendChild(ramV.firstChild);
          g.remove();
        }
        if (ramTd && ramTd.classList.contains("cc-vmb-ramcell")) { ramTd.style.removeProperty("display"); ramTd.classList.remove("cc-vmb-ramcell"); }
        cpuTd.classList.remove("cc-vmb-cell", "cc-vmb-rescell");
      });
      var rh = document.querySelector("#kvm_table thead tr .cc-vmb-ramhdr"); if (rh) { rh.style.removeProperty("display"); rh.classList.remove("cc-vmb-ramhdr"); }
      var hdrRow = document.querySelector("#kvm_table thead tr[data-cc-reshdr]"); if (hdrRow) hdrRow.removeAttribute("data-cc-reshdr");
      Array.prototype.slice.call(document.querySelectorAll("#kvm_list td.cc-actcell")).forEach(function (td) { td.remove(); });
      var actTh = document.querySelector("#kvm_table thead tr .cc-act-th"); if (actTh) actTh.remove();
    } catch (e) {}
  }
  function apply() {
    var root = document.documentElement;
    var live = ls("cc.theming") !== "0" && ls("cc.enable.vms") !== "0";
    root.classList.toggle("cc-vms-on", live);
    if (!live) { root.classList.remove("cc-sections-vms"); stripVmTheming(); enhanceCellsTeardown(); flattenTeardown(); return; }
    try { enhanceRows(); } catch (e) {}
    try { enhanceCells(); } catch (e) {}
    try { wrapVmStats(); } catch (e) {}
    // Tab-Ansicht (cc.sections.vms, default off). It runs before the tint early return below so it
    // applies without a tint colour too.
    try {
      var vmSections = ls("cc.sections.vms") === "1";
      root.classList.toggle("cc-sections-vms", vmSections);
      var vbox = document.getElementById("displaybox");
      if (vbox) { if (vmSections) cardPanels(vbox); else flattenTeardown(); }
    } catch (e) {}
    try { ensureViewToggle(); applyView(); } catch (e) {}
    try { applyRainbowPalette(); var vmRb = ls("cc.theming") !== "0" && ls("cc.rainbow") === "1"; root.classList.toggle("cc-vm-rainbow", vmRb); root.classList.toggle("cc-vm-rbneutral", ls("cc.theming") !== "0" && ls("cc.rbmode") === "active"); } catch (e) {} // reactive: badges rest grey and colour on hover, in accent mode too
    // The action bars' rebuild signature ignores the colour mode, so they are re-tinted in place.
    try { Array.prototype.forEach.call(document.querySelectorAll("#kvm_list td.cc-actcell, .cc-vm-grid .cc-vmc-actbar"), function (cell) { tintAct(cell); }); } catch (e) {}
    // enhanceCells does not rebuild a finished cell, so the gear colours are refreshed here too
    try { refreshAllRes(); } catch (e) {}
    // Adopt off with no own tint colour needs the icon pass only for the badge.
    if (ls("cc.stylevms") === "0" && !ls("ccv.iconcolor") && !iconBgOnV()) return;
    paintVmIcons();
  }
  // The icon pass, separate from apply() so the per-VM dropdown can repaint at once: inside
  // openVmEd, `var apply` is the Apply button and shadows the page-level apply().
  function paintVmIcons() {
    try {
      var imgs = vmImgs();
      var ibgOn = iconBgOnV(); var ibgAcc = vmBgColor();
      // VmTab.css draws the badge box through html.cc-vm-iconbg; the ink flatten has to be an
      // inline filter on each logo.
      var root2 = document.documentElement;
      root2.classList.toggle("cc-vm-iconbg", ibgOn);
      if (ibgOn && ibgAcc) root2.style.setProperty("--cc-iconbg-color", ibgAcc); else root2.style.removeProperty("--cc-iconbg-color");
      // Adopting over a tinted badge builds a black-ink and a white-ink filter once for the page, and each row picks
      // the one that matches its own background.
      var f, flat, c, fBlk, fWht, flatBlk, flatWht, vmInk;
      var adopt = iconBgAdoptsV() && iconBgOnV() && vmTintOn();
      var str = parseInt(effK("iconstrength") || "100", 10);
      if (adopt) {
        flatBlk = ensureFlatFilter("cc-vm-mono-svg-blk", "cc-vm-mono-tint-blk", "#161616", str);
        flatWht = ensureFlatFilter("cc-vm-mono-svg-wht", "cc-vm-mono-tint-wht", "#fff", str);
        fBlk = ensureTintFilterAs("cc-vm-tint-svg-blk", "cc-vm-icon-tint-blk", "#161616") ? "url(#cc-vm-icon-tint-blk)" : "";
        fWht = ensureTintFilterAs("cc-vm-tint-svg-wht", "cc-vm-icon-tint-wht", "#fff") ? "url(#cc-vm-icon-tint-wht)" : "";
      } else {
        f = filterVal(); c = tintColor();
        // One flat filter for the page from the tint's ink, which is "" while Einfärben is off, so
        // the badge alone never flattens the icons.
        vmInk = vmIconInk(false);
        flat = ensureFlatFilter("cc-vm-mono-svg", "cc-vm-mono-tint", vmInk, str);
      }
      var CI = window.CCTheme && window.CCTheme.icons, vmNames = [];
      for (var i = 0; i < imgs.length; i++) {
        var n = imgs[i], vname = vmIconName(n);
        if (vname) vmNames.push(vname);
        var plan = vmIconPlan(n, vname);
        var thisFlat = flat, thisTint = f, thisInk = vmInk;
        if (adopt) {
          var rowInk = vmItemAdoptInk(n.closest("tr, .cc-vmc")), rowBlk = rowInk !== "#fff";
          thisFlat = rowBlk ? flatBlk : flatWht;
          thisTint = rowBlk ? fBlk : fWht;
          thisInk = rowInk;
        }
        var want = plan.treat === "native" ? "" : plan.treat === "flat" ? thisFlat : plan.treat === "knock" ? CI.knock(thisInk, plan.tile, str) : thisTint;
        if (n.tagName === "IMG") { vmSetIconSrc(n, plan.url); n.style.filter = want; if (ibgOn) n.style.removeProperty("color"); }
        // A glyph takes `color` with !important, since Unraid's VM CSS colours it through a class rule.
        else {
          var gif = glyphInkAndFilter(plan, ibgOn, ibgAcc, thisInk || c || "");
          if (gif.color) n.style.setProperty("color", gif.color, "important"); else n.style.removeProperty("color");
          n.style.filter = gif.filter;
        }
      }
      if (CI && vmNames.length) CI.want(vmNames);
    } catch (e) {}
  }
  function connectObserver() {
    // Observes the VM list, not body, where the filter hosts live and would feed back.
    var host = document.getElementById("kvm_list") || document.getElementById("kvm_table");
    if (!host) return;
    // Repaints when an engine lookup or a complexity measurement lands; cc-theme.js fires only on
    // a real change, so this settles.
    try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(function () { if (!dead) paintVmIcons(); }); } catch (e) {}
    // Leading edge: a MutationObserver callback runs before the browser paints, so the rows are
    // restyled in the frame they appear. A burst coalesces into one trailing pass within 300ms.
    function vmSweep() {
      moPending = true; moTrail = false;
      try { mo.disconnect(); } catch (e) {}   // our own writes must not re-fire the observer
      if (!dead) { try { apply(); } catch (e) {} }
      // The first pass ends the tab-load spinner, after a minimum visible time so it paints at
      // least one frame; later native rebuilds do not re-arm it.
      if (!ccFirstPaintDone) {
        ccFirstPaintDone = true;
        var ccEnhMinMs = 400, ccEnhElapsed = Date.now() - ccEnhBusyStart;
        if (ccEnhElapsed >= ccEnhMinMs) document.documentElement.classList.remove("cc-enh-busy");
        else setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, ccEnhMinMs - ccEnhElapsed);
      }
      try { mo.observe(host, { childList: true, subtree: true }); } catch (e) {}
      moTimer = setTimeout(function () {
        moTimer = null; moPending = false;
        if (moTrail && !dead) vmSweep();
      }, 300);
    }
    mo = new MutationObserver(function () {
      if (dead) return;
      if (moPending) { moTrail = true; return; }
      vmSweep();
    });
    mo.observe(host, { childList: true, subtree: true });
    // the observer only fires on a later mutation, so paint a list that is already there
    try { if (!moPending && host.querySelector("tr")) vmSweep(); } catch (e) {}
    // #vmstats renders only when its subtab first opens, so the observer sits on #displaybox.
    try {
      var dbox = document.getElementById("displaybox");
      if (dbox && !smo) {
        wrapVmStats();
        // Wraps synchronously in the callback, before the browser paints, so the native cells
        // never flash; the wrapped check turns our own writes into a no-op.
        smo = new MutationObserver(function () { if (dead) return; wrapVmStats(); });
        smo.observe(dbox, { childList: true, subtree: true });
      }
    } catch (e) {}
  }
  function teardown() {
    if (dead) return; dead = true;
    try { if (mo) mo.disconnect(); mo = null; } catch (e) {}
    try { if (moTimer) { clearTimeout(moTimer); moTimer = null; } } catch (e) {}
    try { if (smo) smo.disconnect(); smo = null; } catch (e) {}
    try { if (liveTimer) clearInterval(liveTimer); liveTimer = null; } catch (e) {}
    try { if (vmBwTimer) { clearInterval(vmBwTimer); vmBwTimer = null; } } catch (e) {}
    try { document.documentElement.classList.remove("cc-vms-on", "cc-vm-iconbg", "cc-sections-vms", "cc-vmgrid", "cc-vm-rainbow", "cc-vm-rbneutral"); document.documentElement.style.removeProperty("--cc-iconbg-color"); } catch (e) {}
    try { RB_KINDS.forEach(function (k) { document.documentElement.style.removeProperty("--cc-rb-" + k); document.documentElement.style.removeProperty("--cc-rb-" + k + "-t"); }); removeViewToggle(); removeVmGrid(); } catch (e) {}
    try { enhanceCellsTeardown(); flattenTeardown(); } catch (e) {}
    try { var imgs = vmImgs(); for (var i = 0; i < imgs.length; i++) { imgs[i].style.filter = ""; imgs[i].style.removeProperty("color"); var w = imgs[i].parentElement; if (w) { w.style.removeProperty("background"); w.style.removeProperty("border-radius"); w.style.removeProperty("width"); w.style.removeProperty("height"); w.style.removeProperty("padding"); w.style.removeProperty("display"); w.style.removeProperty("align-items"); w.style.removeProperty("justify-content"); w.style.removeProperty("box-sizing"); } } } catch (e) {}
    try { ["cc-vm-tint-svg", "cc-vm-mono-svg", "cc-vm-tint-svg-blk", "cc-vm-tint-svg-wht", "cc-vm-mono-svg-blk", "cc-vm-mono-svg-wht"].forEach(function (id) { var h = document.getElementById(id); if (h) h.remove(); }); } catch (e) {}
  }
  function arm() {
    dead = false;
    // header.js ccLoadState() keeps the native tab-load overlay open while html.cc-enh-busy is set,
    // as on the Docker tab, so the page does not show half-enhanced.
    document.documentElement.classList.add("cc-enh-busy");
    ccEnhBusyStart = Date.now();
    setTimeout(function () { document.documentElement.classList.remove("cc-enh-busy"); }, 5000);
    apply();
    connectObserver();
    // #kvm_list is usually filled by an AJAX loadlist() after this script runs, so the observer
    // and apply() retry for a short window until the list is there.
    var tries = 0;
    var poll = setInterval(function () {
      if (dead) { clearInterval(poll); return; }
      tries++;
      if (!mo) connectObserver();
      apply();
      if ((mo && vmImgs().length) || tries >= 20) clearInterval(poll); // done, or give up after ~10s
    }, 500);
    // liveness: a 404/410 from the proxy means the plugin is gone → clear + stop
    liveTimer = setInterval(function () {
      try { fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.status === 404 || r.status === 410) teardown(); }).catch(function () {}); } catch (e) {}
    }, 8000);
    // The /api/vms round trip is expensive, so the live rate is polled only while a VM runs.
    if (!vmBwTimer) vmBwTimer = setInterval(function () {
      try { if (dead) return; if (!document.querySelector("#kvm_list .cc-badge-running")) { vmRate = {}; return; } pollVmBw(); } catch (e) {}
    }, 4000);
  }
  function boot() {
    // Loaded on every page through CannonadeCommand.VmTab.page, so it gates itself to /VMs;
    // otherwise its polling timers would run everywhere.
    try { if (location.pathname.replace(/\/+$/, "") !== "/VMs") return; } catch (e) { return; }
    try { window.ccVmsApply = apply; } catch (e) {} // the settings page's live toggle hook
    if (localStorage.getItem("cc.enable.vms") === "0") return;
    // The first enhanceCells builds the rows before the limits arrive, so the gears and BW
    // badges are refreshed once they do.
    loadVmLims().then(function () { try { refreshAllRes(); } catch (e) {} });
    loadVmHost();
    try {
      arm();
      // A click on a VM icon flashes the action bar instead of opening the native menu, as on the
      // Docker tab. Without a CC action bar the native menu opens.
      if (!window.__ccVmLogoFlash) {
        window.__ccVmLogoFlash = true;
        document.addEventListener("click", function (e) {
          try {
            if (dead) return;
            if (location.pathname.replace(/\/+$/, "") !== "/VMs") return;
            var hand = e.target && e.target.closest ? e.target.closest("#kvm_list td.vm-name span.hand") : null;
            if (!hand) return;
            var row2 = hand.closest("tr"), bar2 = row2 && row2.querySelector(".cc-actbar");
            if (!bar2) return;
            e.preventDefault(); e.stopPropagation();
            bar2.classList.add("cc-act-flash");
            setTimeout(function () { bar2.classList.remove("cc-act-flash"); }, 1600);
          } catch (e2) {}
        }, true);
      }
      // cc.* and the VM tab's own ccv.* keys; cc.stateCache is skipped because docker.js rewrites
      // it every 9s.
      window.addEventListener("storage", function (e) { try { if (!dead && e && e.key && e.key !== "cc.stateCache" && /^ccv?\./.test(e.key)) apply(); } catch (e2) {} });
      // Re-arms when the proxy comes back, so the gap during a plugin update does not end the
      // enhancer until a reload.
      setInterval(function () { try { if (!dead) return; fetch(PROXY + "?path=state", { headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) arm(); }).catch(function () {}); } catch (e) {} }, 8000);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
