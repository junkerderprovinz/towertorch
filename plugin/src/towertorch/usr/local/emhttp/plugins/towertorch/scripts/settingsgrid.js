// Restyles the category tiles on the /Settings and /Tools landing pages into square accent
// badges. Loaded on every page through CannonadeCommand.SettingsGrid.page, it toggles
// html.cc-settingsgrid-on only on those two pages while the "Einstellungen und Werkzeuge" area
// is on (cc.enable.settings, default on), mirrors the theme vars onto the root and paints each
// badge in rainbow mode. Sizing and shape live in sheets/CannonadeCommand.SettingsGrid.css.
(function () {
  "use strict";
  var mo = null, moPending = false;
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff";
  }
  // /Settings and /Tools are two areas with the same grid: each has its adopt key and its own key
  // prefix, read while the adopt key is "0".
  function area() { return /^\/Tools(\/|$)/.test(location.pathname) ? ["cc.styletools", "cct."] : ["cc.stylesettings", "ccs."]; }
  function eff(k, d) { var a = area(); return g(a[0], "1") !== "0" ? g("cc." + k, d) : g(a[1] + k, d); }
  function accent() { var a = eff("accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  // Adopting the rainbow/accent for the icons is a global decision, so it bypasses eff(). While
  // it is on, bgColorEff() answers "" and paintGrid() takes the rotating colour per tile.
  function bgAdopting() { return g("cc.iconbgrainbow", "0") === "1"; }
  // The badge colour, else the older shared icon colour, else the accent; apply() writes the
  // same chain into --cc-iconbg-color.
  function bgColorEff() {
    if (bgAdopting()) return "";
    var bg = eff("iconbgcolor", ""); if (/^#[0-9a-f]{6}$/i.test(bg)) return bg;
    var ic = eff("iconcolor", ""); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
    return accent();
  }
  function badgeBg() { return bgColorEff(); }
  // True when the badge shows a picked colour rather than the accent fallback, so the pick
  // outranks the rainbow; adopting counts as no pick.
  function bgColorIsCustom() { return !bgAdopting() && (/^#[0-9a-f]{6}$/i.test(eff("iconbgcolor", "")) || /^#[0-9a-f]{6}$/i.test(eff("iconcolor", ""))); }
  // The tint colour. The grid tints every icon with one flat filter and has no badge behind it,
  // so adopting resolves a rainbow or accent hue rather than a black/white contrast.
  function tintColorEff() {
    if (bgAdopting()) return rbOn() ? rbColor(5) : accent();
    return eff("iconcolor", "");
  }
  // An unset icontint means "on whenever a valid icon colour is set", which keeps the tint of
  // installs that predate the toggle.
  function tintOnEff() {
    var v = eff("icontint", null);
    return v == null ? /^#[0-9a-f]{6}$/i.test(eff("iconcolor", "")) : v === "1";
  }
  // The two filters a raster logo (img.PanelImg) takes on the badge, in the badge's ink: "mono"
  // flattens every opaque pixel to the ink, "lum" keeps the shading as greys. On a light badge the
  // greys run from the dark ink up to half white, since the plain luminance times a near-black ink
  // is a blob again, and on a dark badge from 40 % grey up to white, since dark artwork such as
  // the Nvidia lettering would sink into it. idealText() yields only two tones, so there are at
  // most four filters, each built once on a body host the #displaybox observer never sees.
  function inkFilter(kind, ink) {
    var host = document.getElementById("cc-sg-mono-svg");
    if (!host) { host = document.createElement("div"); host.id = "cc-sg-mono-svg"; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var light = ink === "#fff", filtId = "cc-sg-" + kind + "-" + (light ? "l" : "d");
    if (!host.querySelector("#" + filtId)) {
      var c = light ? 1 : parseInt("16", 16) / 255; // #fff -> 1, #161616 -> 0.0863
      var k = light ? 0.6 : 0.5, off = light ? 0.4 : c;
      var row = kind === "mono" ? "0 0 0 0 " + c.toFixed(4) : (0.2126 * k).toFixed(4) + " " + (0.7152 * k).toFixed(4) + " " + (0.0722 * k).toFixed(4) + " 0 " + off.toFixed(4);
      var vals = row + " " + row + " " + row + " 0 0 0 1 0";
      host.insertAdjacentHTML("beforeend", '<svg xmlns="http://www.w3.org/2000/svg"><filter id="' + filtId + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter></svg>');
    }
    return "url(#" + filtId + ")";
  }
  // The badge treatment of a raster logo, decided by the shared icon pipeline as on the Docker tab:
  // a one-tone picture is flattened to the ink, a logo on its own plate keeps only its mark
  // ("knock"), and full-colour artwork is tinted with its shading kept. Until the picture is
  // measured the pipeline answers the safe tint, and onResolved repaints.
  function badgeFilter(im, ink) {
    var CI = window.CCTheme && window.CCTheme.icons;
    if (!CI) return inkFilter("mono", ink);
    var src = im.getAttribute("src") || "";
    var plan = CI.plan(CI.globalMode(), "", CI.spread(src), CI.tile(src));
    if (plan.treat === "native") return "none";
    if (plan.treat === "flat") return inkFilter("mono", ink);
    if (plan.treat === "knock") return CI.knock(ink, plan.tile, parseInt(eff("iconstrength", "100"), 10)) || inkFilter("mono", ink);
    return inkFilter("lum", ink);
  }
  // cc.sgsize (global): tile badge [box, glyph]. The default m matches Docker's logo tile
  // (62px content + 8px pad); favorites.js reads the same key so /Favorites matches.
  function sgSize() { return ({ s: ["64px", "32px"], m: ["78px", "38px"], l: ["96px", "46px"] })[g("cc.sgsize", "m")] || ["78px", "38px"]; }
  var RB = ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"];
  if (window.CCTheme) { idealText = window.CCTheme.idealText; RB = window.CCTheme.RB; } // the local copies are the fallback
  var RB_OFF = window.CCTheme ? window.CCTheme.rbSeed(RB.length) : Math.floor(Math.random() * RB.length); // the persisted seed keeps the rainbow aligned across areas
  // Rainbow is a global mode, read directly rather than through eff(), so one switch colours
  // every enabled area. Flag mode keeps its own palette in cc.flagpal.
  function storedPal() { try { if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; } var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p; } catch (e) {} return RB; }
  // On a light theme the near-white slots are swapped, see CCTheme.surfacePalette.
  function pal() { var p = storedPal(); return (window.CCTheme && window.CCTheme.surfacePalette) ? window.CCTheme.surfacePalette(p, accent()) : p; }
  function rbOn() { return g("cc.rainbow", "0") === "1"; }
  function rbColor(i) { if (!rbOn()) return accent(); var off = g("cc.rainbowrot", "1") === "0" ? 0 : RB_OFF; var p = pal(); return p[(i + off) % p.length]; } // rotation defaults to on, as in the other areas
  // rainbow "active only" sub-mode (cc.rbmode=active): tiles have no active item -> neutral idle + hover.
  function rbNeutral() { return g("cc.rbmode", "all") === "active"; }
  // /Settings and /Tools render the same .Panel tile grid inside #displaybox; the exact match
  // keeps the /Settings/<Name> and /Tools/<Name> sub-pages out.
  function onGrid() { try { var p = location.pathname.replace(/\/+$/, ""); return p === "/Settings" || p === "/Tools"; } catch (e) { return false; } }
  // rainbow: paint each badge <span> a rotated palette colour + contrast glyph; accent
  // mode: clear our inline overrides so the sheet's --cc-accent shows through. Inline
  // style writes are attribute changes, so they never re-trigger the childList observer.
  function paintGrid() {
    try {
      var rb = rbOn(), neutral = rb && rbNeutral();
      document.documentElement.classList.toggle("cc-settingsgrid-rbneutral", rbNeutral()); // "active only" applies in accent mode too
      var sz = sgSize();
      document.documentElement.style.setProperty("--cc-sg-size", sz[0]);
      document.documentElement.style.setProperty("--cc-sg-glyph", sz[1]);
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      var accBg = badgeBg();               // "" while the badge adopts the rainbow
      var accBgInk = accBg || accent();    // always a valid hex for the contrast
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        if (!rb) {
          s.style.removeProperty("background"); s.style.removeProperty("--cc-rb-c"); s.style.removeProperty("--cc-rb-ct");
          if (gl) gl.style.removeProperty("color");      // glyph colour comes from CSS --cc-iconbg-text
          // "active only" rests the badge grey in accent mode too, where the glyph reads in white
          if (im) im.style.setProperty("filter", badgeFilter(im, rbNeutral() ? "#fff" : idealText(accBgInk)), "important");
          continue;
        }
        var c = rbColor(i), tc = idealText(c);
        s.style.setProperty("--cc-rb-c", c); s.style.setProperty("--cc-rb-ct", tc); // per-tile colour for the neutral-mode :hover
        if (!neutral) {
          // A picked icon colour (cc.iconcolor, or the area's own ccs.iconcolor or cct.iconcolor)
          // wins over the rotating rainbow colour, as the var() order does in the other areas;
          // the tile rotates only when no colour is picked.
          var iconSet = bgColorIsCustom();
          var bg = iconSet ? accBg : c, btc = iconSet ? idealText(accBg) : tc;
          s.style.setProperty("background", bg, "important");
          if (gl) gl.style.setProperty("color", btc, "important");
          if (im) im.style.setProperty("filter", badgeFilter(im, btc), "important");
        } else {
          s.style.removeProperty("background");          // CSS neutral-idle grey shows; hover recolours via --cc-rb-c
          if (gl) gl.style.removeProperty("color");
          if (im) im.style.setProperty("filter", badgeFilter(im, "#fff"), "important"); // neutral badge is dark grey -> white-ink logo (idle + hover)
        }
      }
    } catch (e) {}
  }
  // Category headings become accent badges on both landing pages. Settings.page and Tools.page
  // have no Title=, so every div.title there is one category heading, rendered by
  // PageBuilder.php tab_title() as <div class="title"><span class="left"><i></i>Label</span>.
  // The label is a bare text node, so span.left is the badge box and the sheet does the rest;
  // JS stamps the rainbow colour per heading, inks a heading picture and names the categories
  // Unraid leaves in English. data-cc-sgh marks what clearHeads() undoes and is not a skip guard,
  // since the paint re-runs when the palette changes. The inner <i> carries class "title" as well,
  // so selectors qualify div.title.
  //
  // Unraid's German has no words for three Tools categories. A heading is known by the page file
  // in the comment Unraid writes in front of it, so a title some other language or plugin changes
  // never matches by accident.
  var HEAD_DE = { WebGui: "Weboberfläche", Wizards: "Assistenten", DiskUtilities: "Datenträger-Werkzeuge" };
  function headPage(title) {
    for (var c = title.previousSibling; c && c.nodeType !== 1; c = c.previousSibling) {
      if (c.nodeType === 8) { var m = /([^\/\s]+)\.page\s*$/m.exec(c.nodeValue); return m ? m[1] : ""; }
    }
    return "";
  }
  function headLabel(h) {
    for (var c = h.lastChild; c; c = c.previousSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return c;
    return null;
  }
  function nameHead(h) {
    var de = (document.documentElement.lang || "").slice(0, 2).toLowerCase() === "de" && HEAD_DE[headPage(h.parentNode)];
    var label = de && headLabel(h);
    if (!label) return;
    if (!h.hasAttribute("data-cc-sgh-text")) h.setAttribute("data-cc-sgh-text", label.nodeValue);
    if (label.nodeValue !== de) label.nodeValue = de;
  }
  function paintHeads() {
    try {
      // Headings keep their colour in both rainbow sub-modes, like the /Main heads; "active
      // only" greys the tiles only.
      var rb = rbOn();
      document.documentElement.classList.remove("cc-settingsgrid-headsneutral");
      var heads = document.querySelectorAll("#displaybox div.title > span.left");
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        h.setAttribute("data-cc-sgh", "1");               // teardown index (attribute write -> no childList re-fire)
        nameHead(h);                                      // a text write, which the childList observer does not see either
        // A plugin's heading picture (img.icon) cannot take the text colour, so it is flattened
        // to the heading's ink like a glyph.
        var im = h.querySelector(":scope > img");
        if (!rb) {
          h.style.removeProperty("background"); h.style.removeProperty("color");
          h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct"); // accent mode: let the sheet's --cc-accent show through
          if (im) im.style.setProperty("filter", inkFilter("mono", idealText(accent())), "important");
          continue;
        }
        var c = rbColor(i), tc = idealText(c);
        h.style.setProperty("--cc-rb-c", c); h.style.setProperty("--cc-rb-ct", tc);
        h.style.setProperty("background", c, "important"); h.style.setProperty("color", tc, "important");
        if (im) im.style.setProperty("filter", inkFilter("mono", tc), "important");
      }
    } catch (e) {}
  }
  // Drops every inline stamp and marker, so a live disable reverts to the native headings
  // without a reload.
  function clearHeads() {
    try {
      document.documentElement.classList.remove("cc-settingsgrid-headsneutral");
      var heads = document.querySelectorAll("#displaybox [data-cc-sgh]");
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        h.style.removeProperty("background"); h.style.removeProperty("color");
        h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct");
        var im = h.querySelector(":scope > img"); if (im) im.style.removeProperty("filter");
        var label = h.hasAttribute("data-cc-sgh-text") && headLabel(h);
        if (label) label.nodeValue = h.getAttribute("data-cc-sgh-text");
        h.removeAttribute("data-cc-sgh-text");
        h.removeAttribute("data-cc-sgh");
      }
    } catch (e) {}
  }
  // Tint mode, the alternative to the badge: with the badge off and Einfärben on, each tile icon
  // takes the chosen colour. Glyphs get a text colour; raster icons get the Docker tab's
  // shading-preserving feColorMatrix, which iconstrength blends back over the original.
  function ensureTintFilter() {
    var ic = tintColorEff(), m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ic || "");
    var host = document.getElementById("cc-sg-tint-svg");
    if (!m) { if (host) host.remove(); return false; }
    var tr = parseInt(m[1], 16) / 255, tg = parseInt(m[2], 16) / 255, tb = parseInt(m[3], 16) / 255;
    var s = (Math.max(10, parseInt(eff("iconstrength", "100"), 10)) / 100).toFixed(3);
    if (!host) { host = document.createElement("div"); host.id = "cc-sg-tint-svg"; host.setAttribute("aria-hidden", "true"); host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(host); }
    var lum = function (c) { return (0.2126 * c).toFixed(4) + " " + (0.7152 * c).toFixed(4) + " " + (0.0722 * c).toFixed(4); };
    var mid = '<feColorMatrix in="SourceGraphic" type="matrix" result="flat" values="' + lum(tr) + ' 0 0 ' + lum(tg) + ' 0 0 ' + lum(tb) + ' 0 0 0 0 0 1 0"/>';
    if (parseFloat(s) < 0.999) mid += '<feComponentTransfer in="flat" result="faded"><feFuncA type="linear" slope="' + s + '"/></feComponentTransfer><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="faded"/></feMerge>';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="cc-sg-icon-tint" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">' + mid + '</filter></svg>';
    return true;
  }
  // paint the tint onto every tile icon: glyph colour + raster filter; also drop any stray
  // rainbow badge background the span may carry from a previous badge-mode render.
  function paintTint() {
    try {
      var ic = tintColorEff(), f = ensureTintFilter() ? "url(#cc-sg-icon-tint)" : "";
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        s.style.removeProperty("background");
        if (gl) gl.style.setProperty("color", ic, "important");
        if (im) im.style.filter = f;
      }
    } catch (e) {}
  }
  // undo the tint everywhere (inline glyph colour + raster filter + stray span background)
  // and drop the filter host, so badge mode / a disabled area starts from a clean slate.
  function clearTint() {
    try {
      var spans = document.querySelectorAll("#displaybox .Panel > a > span");
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i], gl = s.querySelector("i.PanelIcon"), im = s.querySelector("img");
        s.style.removeProperty("background");
        if (gl) gl.style.removeProperty("color");
        if (im) im.style.filter = "";
      }
      var host = document.getElementById("cc-sg-tint-svg"); if (host) host.remove();
      var mono = document.getElementById("cc-sg-mono-svg"); if (mono) mono.remove();
    } catch (e) {}
  }
  function apply() {
    try {
      var root = document.documentElement;
      // master theming off behaves like a disabled area
      var live = g("cc.enable.settings", "1") !== "0" && g("cc.theming", "1") !== "0" && onGrid();
      var badge = live && eff("iconbg", "1") !== "0";
      // Badge and tint exclude each other here because one square icon can show only one
      // treatment; adopting the rainbow is enough for a valid tint colour.
      var tint = live && !badge && tintOnEff() && /^#[0-9a-f]{6}$/i.test(tintColorEff());
      var a = accent();
      root.classList.toggle("cc-settingsgrid-on", badge);
      root.classList.toggle("cc-settingsgrid-tint", tint);
      // The headings badge whenever the area is live on a grid page, independent of the tile
      // badge and tint, hence their own class.
      root.classList.toggle("cc-settingsgrid-heads-on", live);
      if (live) {
        // The headings need these in tint mode too. Gated on onGrid(), so the shared
        // --cc-accent is never written on another area's page.
        root.style.setProperty("--cc-accent", a);
        root.style.setProperty("--cc-accent-text", idealText(a));
      } else {
        clearHeads(); // area/theming off or not a grid page -> native headings back
      }
      if (badge) {
        clearTint(); // drop a tint from a previous render
        var sgBg = bgColorEff();   // "" while the badge adopts the rainbow
        if (sgBg) { root.style.setProperty("--cc-iconbg-color", sgBg); root.style.setProperty("--cc-iconbg-text", idealText(sgBg)); }
        else { root.style.removeProperty("--cc-iconbg-color"); root.style.removeProperty("--cc-iconbg-text"); }
        paintGrid();
      } else if (tint) {
        paintTint();
      } else {
        clearTint();
      }
      // After the tiles, because clearTint() drops the filter host a heading picture uses too.
      if (live) paintHeads();
    } catch (e) {}
  }
  // Observes the content container, not body. apply() changes only attributes, so it cannot
  // re-trigger this childList observer; debounced for AJAX content swaps.
  function watch() {
    try {
      var host = document.getElementById("displaybox") || document.getElementById("content");
      if (!host) return;
      mo = new MutationObserver(function () {
        if (moPending) return; moPending = true;
        setTimeout(function () { moPending = false; apply(); }, 150);
      });
      mo.observe(host, { childList: true, subtree: true });
    } catch (e) {}
  }
  function boot() {
    // apply() handles the disabled state itself, so the watchers are always registered and a
    // re-enable from the settings page takes effect without a reload.
    apply();
    watch();
    // Same global hook as the other areas: the settings page's live toggle and cc-theme.js's
    // cross-browser config adoption call it by name.
    try { window.ccSettingsGridApply = apply; } catch (e) {}
    // A logo measured after the first paint gets its final treatment through this repaint.
    try { if (window.CCTheme && window.CCTheme.icons) window.CCTheme.icons.onResolved(apply); } catch (e) {}
    // The settings page writes the cc.*, ccs.* and cct.* keys from another tab. cc.stateCache is skipped
    // because docker.js rewrites it every 9s.
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) apply(); }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
