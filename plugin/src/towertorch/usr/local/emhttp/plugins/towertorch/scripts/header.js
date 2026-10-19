// Enhances Unraid's main menu bar. Loaded on every page through
// CannonadeCommand.Header.page, it keeps the JS side small: toggle html.cc-header-on, which gates
// every rule in sheets/CannonadeCommand.Header.css, and mirror the accent, text and shape
// settings onto the document root so the sheet follows the configured theme. The area is off by
// default, opt in under Settings > CannonadeCommand > Bereiche > Hauptmenueleiste.
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  // docker.js, settings.js and cc-theme.js wrap localStorage.setItem to mirror cc.* keys into the
  // engine, and a page's wrapper can arrive after this file's first pass. A write made before it
  // is listed in __ccLSEarly for the wrapper to push, or the engine copy it adopts on load would
  // put the old value back.
  function syncedSet(k, v) {
    try { localStorage.setItem(k, v); if (!window.__ccLS) (window.__ccLSEarly = window.__ccLSEarly || {})[k] = 1; } catch (e) {}
  }
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff";
  }
  function motionLevel(v) { return v === "off" || v === "0" ? "off" : v === "wild" || v === "2" ? "wild" : "subtle"; }
  function shapeName(v) { return v === "soft" || v === "rounded" ? "soft" : v === "square" ? "square" : "round"; }
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  function T(d, e) { return LANG === "de" ? d : e; }
  function eff(k, d) { return g("cc.styleheader", "1") !== "0" ? g("cc." + k, d) : g("cch." + k, d); }
  function accent() { var a = eff("accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  var RB = ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"];
  if (window.CCTheme) { idealText = window.CCTheme.idealText; motionLevel = window.CCTheme.motionLevel; shapeName = window.CCTheme.shapeName; RB = window.CCTheme.RB; } // the local copies are the fallback
  var RB_OFF = window.CCTheme ? window.CCTheme.rbSeed(RB.length) : Math.floor(Math.random() * RB.length); // the persisted seed keeps the rainbow aligned across areas
  // Rainbow is a global mode, read directly rather than through the adopt-gated eff(), so one
  // switch colours every enabled area whatever this bar's adopt state is. The per-area accent
  // stays adopt-gated for the single-colour look. Flag mode keeps its own palette in cc.flagpal,
  // so neither palette leaks into the other.
  function storedPal() { try { if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; } var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p; } catch (e) {} return RB; }
  // On a light theme the near-white slots are swapped, see CCTheme.surfacePalette.
  function pal() { var p = storedPal(); return (window.CCTheme && window.CCTheme.surfacePalette) ? window.CCTheme.surfacePalette(p, accent()) : p; }
  function rbOn() { return g("cc.rainbow", "0") === "1"; }
  function rbColor(i) { if (!rbOn()) return accent(); var off = g("cc.rainbowrot", "1") === "0" ? 0 : RB_OFF; var p = pal(); return p[(i + off) % p.length]; } // rotation defaults to on, as in the other areas
  function lumOf(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 255; var n = parseInt(m[1], 16); return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255); }
  // A badge inside a popup sits on the dark modal, which stays dark on a light theme too, where a
  // near-black palette slot such as the German flag's black stripe would be invisible. Such a slot
  // is swapped for the brightest one in the palette, which stays on theme, or for the accent when
  // the whole palette is dark.
  // The threshold of 28 catches black while keeping dark flag colours that read perfectly well
  // against white text, such as #006233 (63.3) or navy #002868 (35.4). A higher bar breaks a flag
  // palette, which is the flag repeated: swapping its green for the brightest slot turns the
  // green/white/red cycle into white/white/red with adjacent duplicates and no green at all.
  // cc-theme.js holds the swap, because the icon pipeline needs the same guard for its tint
  // target; the branch below is the load-order fallback.
  function popBadge(i) {
    var c = rbColor(i);
    if (window.CCTheme && window.CCTheme.liftDark) return window.CCTheme.liftDark(c, accent());
    if (lumOf(c) >= 28) return c;
    var p = pal(), best = null, bl = -1;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L > bl) { bl = L; best = p[k]; } }
    return (best && bl >= 28) ? best : accent();
  }
  // In rainbow mode the active tab, each utility icon box and the usage fill take a rotated palette
  // colour; in accent mode the CSS handles it through --cc-accent and this only clears the inline
  // overrides. In the "active only" sub-mode the idle badges go neutral and only the active one
  // keeps its colour, with the CSS colouring any badge on hover from the per-item vars stamped
  // below. The observer watches childList only, so these style writes cannot loop.
  function rbNeutral() { return g("cc.rbmode", "all") === "active"; }
  function paintNav() {
    try {
      // With the area off, rb is false and every branch below clears its properties, so a disabled
      // area never paints even with rainbow on and loses any inline colour it still carries.
      var rb = rbOn() && document.documentElement.classList.contains("cc-header-on"), neutral = rb && rbNeutral(), n = 0;
      document.documentElement.classList.toggle("cc-header-rbneutral", rbNeutral() && document.documentElement.classList.contains("cc-header-on"));   // the class applies in accent mode too, the paint above stays rainbow-keyed
      // Every item carries its rotated colour for the CSS :hover; the background itself is painted
      // only outside the neutral sub-mode, or on the active tab.
      function stamp(elm, c, t) { elm.style.setProperty("--cc-rb-c", c); elm.style.setProperty("--cc-rb-ct", t); }
      function clear(elm) { elm.style.removeProperty("background"); elm.style.removeProperty("color"); elm.style.removeProperty("--cc-rb-c"); elm.style.removeProperty("--cc-rb-ct"); }
      Array.prototype.slice.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a")).forEach(function (aEl) {   // either tile, since the merged drag zone can park a tab on the right
        if (!rb) { clear(aEl); n++; return; }
        var c = rbColor(n), t = idealText(c), item = aEl.closest(".nav-item"), active = !!(item && item.classList.contains("active"));
        stamp(aEl, c, t);
        if (!neutral || active) { aEl.style.setProperty("background", c, "important"); aEl.style.setProperty("color", t, "important"); }
        else { aEl.style.removeProperty("background"); aEl.style.removeProperty("color"); }
        n++;
      });
      Array.prototype.slice.call(document.querySelectorAll("#menu .nav-tile .nav-item.util > a")).forEach(function (aEl) {   // either tile, as above
        var gl = aEl.querySelector("b.system, img.system");
        if (!rb) { clear(aEl); if (gl) gl.style.removeProperty("color"); n++; return; }
        var c = rbColor(n), t = idealText(c);
        stamp(aEl, c, t);
        if (!neutral) { aEl.style.setProperty("background", c, "important"); if (gl) gl.style.setProperty("color", t, "important"); }
        else { aEl.style.removeProperty("background"); if (gl) gl.style.removeProperty("color"); }
        n++;
      });
      var u = document.querySelector("#menu .usage-bar > span");
      if (u) {
        if (!rb) { clear(u); }
        else { var cu = rbColor(n), tu = idealText(cu); stamp(u, cu, tu); if (!neutral) { u.style.setProperty("background", cu, "important"); u.style.setProperty("color", tu, "important"); } else { u.style.removeProperty("background"); u.style.removeProperty("color"); } }
      }
      // The footer scroll arrows need their own rotating colour, or they fall through the var()
      // chain to the one shared --cc-rbaccent. The CSS owns their background and hover state and
      // only reads the colour from here. They are not gated on cc-header-on like the loops above,
      // because the CSS shows them whenever html.cc-popups-on is set, whatever the menu bar area
      // does. Their index starts at 100, so disabling that area does not shift their colours.
      Array.prototype.slice.call(document.querySelectorAll("a.back_to_top, a.move_to_end")).forEach(function (aEl, ai) {
        if (!rbOn()) { aEl.style.removeProperty("--cc-rb-c"); aEl.style.removeProperty("--cc-rb-ct"); return; }
        var ca = rbColor(100 + ai), ta = idealText(ca); stamp(aEl, ca, ta);
      });
    } catch (e) {}
  }
  // Icons for the main page tabs. Unraid renders a tab label as a bare text node with no icon, so
  // these are added rather than swapped: inline SVG on currentColor, which picks up the tab's own
  // rainbow colour from paintNav() without any further wiring.
  // The glyphs are filled, not outlined. Outline path data is open line art and fills into a smear,
  // so a filled twin is taken where the set has one and the nearest filled glyph otherwise. Every
  // candidate was rendered at 16px, which is what this bar paints, before it was picked. Two that
  // do not work at that size: Tabler's `container`, whose corner rivets vanish, and `stack-2` for
  // /Docker, which reads like /Main's `database` one tab over.
  // Sources: Tabler icons (MIT) for most tabs, FontAwesome Solid `wrench` (CC-BY 4.0) for /Tools,
  // which Tabler has in neither set and which the WebGUI already loads globally, and Docker's own
  // brand mark from Simple Icons, verbatim, for /Docker.
  var CC_TAB_ICONS = {
    "/Dashboard": '<path d="M9 3a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zm10 -4a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 -8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z" />',   // layout-dashboard
    "/Main": '<path d="M3 15.731c1.968 1.507 5.234 2.269 9 2.269c3.76 0 7.025 -.76 9 -2.252v2.252c0 2.425 -3.895 3.936 -8.693 3.998l-.307 .002c-4.938 0 -9 -1.523 -9 -4z" /><path d="M3 9.731c1.968 1.507 5.234 2.269 9 2.269c3.76 0 7.025 -.76 9 -2.252v2.252c0 2.477 -4.062 4 -9 4c-4.798 0 -8.77 -1.438 -8.979 -3.795l-.016 -.101l-.005 -.104z" /><path d="M12 2c1.041 0 2.044 .068 2.977 .198l.469 .071q .84 .14 1.586 .348l.44 .131l.075 .024a11 11 0 0 1 .805 .3l.199 .086q .535 .242 .967 .53q .165 .11 .313 .225a3.8 3.8 0 0 1 .669 .668l.091 .128q .07 .105 .129 .211l.07 .139q .163 .35 .2 .73l.01 .211c0 2.477 -4.062 4 -9 4c-4.798 0 -8.77 -1.438 -8.979 -3.795a1 1 0 0 1 -.021 -.205l.005 -.104l.016 -.1c.205 -2.306 4.01 -3.733 8.667 -3.794z" />',   // database; Tabler has no filled server, and stacked discs read as the array
    "/Favorites": '<path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" />',   // star
    "/Shares": '<path d="M12 2a1 1 0 0 1 .707 .293l1.708 1.707h4.585a3 3 0 0 1 2.995 2.824l.005 .176v7a3 3 0 0 1 -3 3h-1v1a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3h1v-1a3 3 0 0 1 3 -3zm-6 6h-1a1 1 0 0 0 -1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1 -1v-1h-7a3 3 0 0 1 -3 -3z" />',   // folders; there is no filled folder-share, and the plural keeps the several-shares reading
    "/Settings": '<path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" />',   // settings
    "/Docker": '<path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />',   // Docker's brand mark, from Simple Icons
    "/Plugins": '<path d="M10 2a3 3 0 0 1 2.995 2.824l.005 .176v1h3a2 2 0 0 1 1.995 1.85l.005 .15v3h1a3 3 0 0 1 .176 5.995l-.176 .005h-1v3a2 2 0 0 1 -1.85 1.995l-.15 .005h-3a2 2 0 0 1 -1.995 -1.85l-.005 -.15v-1a1 1 0 0 0 -1.993 -.117l-.007 .117v1a2 2 0 0 1 -1.85 1.995l-.15 .005h-3a2 2 0 0 1 -1.995 -1.85l-.005 -.15v-3a2 2 0 0 1 1.85 -1.995l.15 -.005h1a1 1 0 0 0 .117 -1.993l-.117 -.007h-1a2 2 0 0 1 -1.995 -1.85l-.005 -.15v-3a2 2 0 0 1 1.85 -1.995l.15 -.005h3v-1a3 3 0 0 1 3 -3z" />',   // puzzle
    "/VMs": '<path d="M7 21a1 1 0 0 1 0 -2h1v-2h-4a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-4v2h1a1 1 0 0 1 0 2zm7 -4h-4v2h4z" />',   // device-desktop
    "/Tools": '<path d="M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7L336 192c-8.8 0-16-7.2-16-16l0-57.4c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L297.5 310.5c17 6.2 35.4 9.5 54.5 9.5zM80 408a24 24 0 1 1 0 48 24 24 0 1 1 0-48z" />',   // FontAwesome Solid wrench (CC-BY 4.0); Tabler ships none
    "/Stats": '<path d="M20 18a1 1 0 0 1 .117 1.993l-.117 .007h-16a1 1 0 0 1 -.117 -1.993l.117 -.007h16z" /><path d="M15.22 5.375a1 1 0 0 1 1.393 -.165l.094 .083l4 4a1 1 0 0 1 .284 .576l.009 .131v5a1 1 0 0 1 -.883 .993l-.117 .007h-16.022l-.11 -.009l-.11 -.02l-.107 -.034l-.105 -.046l-.1 -.059l-.094 -.07l-.06 -.055l-.072 -.082l-.064 -.089l-.054 -.096l-.016 -.035l-.04 -.103l-.027 -.106l-.015 -.108l-.004 -.11l.009 -.11l.019 -.105c.01 -.04 .022 -.077 .035 -.112l.046 -.105l.059 -.1l4 -6a1 1 0 0 1 1.165 -.39l.114 .05l3.277 1.638l3.495 -4.369z" />',   // chart-area, the only filled chart glyph still legible at 16px
    "/Apps": '<path d="M9 3h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M9 13h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M19 13h-4a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2z" /><path d="M17 3a1 1 0 0 1 .993 .883l.007 .117v2h2a1 1 0 0 1 .117 1.993l-.117 .007h-2v2a1 1 0 0 1 -1.993 .117l-.007 -.117v-2h-2a1 1 0 0 1 -.117 -1.993l.117 -.007h2v-2a1 1 0 0 1 1 -1z" />'   // apps
  };
  // Tabler draws on a 24 grid, FontAwesome on 512, and a 512-unit path in a 24-unit box renders as
  // one enormous filled corner. The exceptions go here rather than into rescaled path data, since a
  // retyped path is a redrawn icon.
  var CC_TAB_VB = { "/Tools": "0 0 512 512" };
  function ccTabIcons() {
    try {
      // This is the only place that puts the icons into the DOM, so it also takes them back out
      // when the setting flips off.
      var on = g("cc.tabicons", "1") !== "0";
      // The label has no element of its own, so it is wrapped in a span once per tab and hiding it
      // becomes a class toggle. The wrapping runs whatever `on` says, so icon-only and text-only
      // mode stay independent.
      var textOff = g("cc.tabtext", "1") === "0";
      var items = document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]");
      for (var i = 0; i < items.length; i++) {
        var a = items[i];
        var existing = a.querySelector(":scope > svg.cc-tab-ico");
        if (!on) { if (existing) existing.remove(); } else if (!existing) {
          var href = "/" + (a.getAttribute("href") || "").replace(/^\/+|\/+$/g, "").split("/")[0];
          var d = CC_TAB_ICONS[href];
          if (d) {
            var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("class", "cc-tab-ico");
            svg.setAttribute("viewBox", CC_TAB_VB[href] || "0 0 24 24");
            // Filled, with no stroke: a leftover stroke-width paints a skin around the shape and
            // fattens every glyph by a third at 16px.
            svg.setAttribute("fill", "currentColor"); svg.setAttribute("stroke", "none");
            svg.innerHTML = d;
            a.insertBefore(svg, a.firstChild);
          }
        }
        if (!a.querySelector(":scope > span.cc-tab-label")) {
          for (var n = a.childNodes.length - 1; n >= 0; n--) {
            var node = a.childNodes[n];
            if (node.nodeType === 3 && node.textContent.trim()) {
              var lbl = document.createElement("span");
              lbl.className = "cc-tab-label";
              a.replaceChild(lbl, node);
              lbl.appendChild(node);
              // A phone shows only the glyph, and a hidden label names nothing.
              a.setAttribute("aria-label", node.textContent.trim());
              break;
            }
          }
        }
      }
      document.documentElement.classList.toggle("cc-tabtext-off", textOff);
    } catch (e) {}
  }
  try { window.ccTabIcons = ccTabIcons; } catch (eTI) {}   // the settings page's live toggle hook
  // Below 768px the tabs are one row that swipes sideways (Header.css), with the utility icons
  // moved into the burger's menu.
  function ccIsPhone() { return !!(window.matchMedia && window.matchMedia("(max-width: 767.98px)").matches); }
  // A strip that swipes sideways, the tabs or the status island, fades out at a side where more
  // wait. The classes name the physical side, so a right-to-left page, where scrollLeft runs
  // negative, fades the correct one.
  function ccStripEdges(tile) {
    var max = tile.scrollWidth - tile.clientWidth, s = Math.abs(tile.scrollLeft);
    var rtl = getComputedStyle(tile).direction === "rtl", before = s > 2, after = s < max - 2;
    tile.classList.toggle("cc-more-l", rtl ? after : before);
    tile.classList.toggle("cc-more-r", rtl ? before : after);
  }
  // The open tab is centred in the strip, which a later pass repeats once fonts and icons have
  // settled, until the person moves the strip themselves.
  function ccTabStrip() {
    try {
      var tile = navTile(); if (!tile) return;
      if (!tile.ccStrip) {
        tile.ccStrip = true;
        tile.addEventListener("scroll", function () { ccStripEdges(tile); }, { passive: true });
        ["pointerdown", "wheel"].forEach(function (ev) { tile.addEventListener(ev, function () { tile.ccMoved = true; }, { passive: true }); });
      }
      var act = ccIsPhone() && !tile.ccMoved && tile.querySelector(":scope > .nav-item.active");
      if (act) {
        var tr = tile.getBoundingClientRect(), ar = act.getBoundingClientRect();
        tile.scrollLeft += Math.round((ar.left + ar.width / 2) - (tr.left + tr.width / 2));
      }
      ccStripEdges(tile);
    } catch (e) {}
  }
  // On a phone the island is one swiping row as well. Its chips are rebuilt in place on each live
  // update, so the element and its scroll position stay.
  function ccIslandStrip() {
    var isle = document.getElementById("cc-island"); if (!isle) return;
    if (!isle.ccStrip) { isle.ccStrip = true; isle.addEventListener("scroll", function () { ccStripEdges(isle); }, { passive: true }); }
    ccStripEdges(isle);
  }
  // Popup badges follow the colour modes: the accent by default through the CSS vars, a palette slot
  // in rainbow mode. Painted from here because a dialog can appear as a direct body child at any
  // time.
  function paintPopups() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // Every badge inside a window is stamped with its own --cc-rb-c/--cc-rb-ct, which the CSS
      // reads through var(--cc-rb-c, var(--cc-rbaccent, …)). Without the stamp they all fall
      // through to --cc-rbaccent, one shared colour, and a four-step update window renders flat
      // while the rest of the UI rotates. The rotation is continuous per window (title, then each
      // section badge, then each bottom button) rather than per selector, so two badges next to
      // each other never land on the same slot. The neutral sub-mode is skipped here: a legend is
      // not interactive, so "neutral until hover" would leave it colourless for good. Every slot
      // goes through popBadge(), since these sit on the dark modal.
      var scopes = [];
      Array.prototype.forEach.call(document.querySelectorAll(".sweet-alert"), function (w) {
        swalClose(w);
        scopes.push({ root: w, title: w.querySelector("h2"), btns: "button.confirm, .sa-button-container button, .cc-win-x" });
      });
      Array.prototype.forEach.call(document.querySelectorAll(".ui-dialog"), function (w) {
        scopes.push({ root: w, title: w.querySelector(".ui-dialog-title"), btns: ".ui-dialog-buttonpane button" });
      });
      // The ctout recreate window is a page, not a dialog node, so its box is #displaybox .content.
      var ctT = document.getElementById("cc-ctout-title");
      if (ctT) {
        var ctRoot = ctT.closest(".content") || document.querySelector("#displaybox .content");
        if (ctRoot) scopes.push({ root: ctRoot, title: ctT, btns: "button, input[type=button], input[type=submit]" });
      }
      var rb = rbOn();
      scopes.forEach(function (sc) {
        var n = 0;
        // The title badge shows no status of its own; running and done live in the bottom-left
        // indicator.
        function stamp(el, legacy, noRed) {
          if (!el) return;
          // An inline background on the title would outrank the var() chain for good after a live
          // mode switch, so it is always cleared.
          if (legacy) { el.style.removeProperty("background"); el.style.removeProperty("color"); }
          if (!rb) { el.style.removeProperty("--cc-rb-c"); el.style.removeProperty("--cc-rb-ct"); return; }   // in accent mode the CSS falls through to the plain accent, which popBadge's swap would override
          var c = popBadge(n++);
          for (var k = 0; noRed && k < 8 && window.CCTheme && window.CCTheme.isRed(c); k++) c = popBadge(n++);
          var t = idealText(c);
          el.style.setProperty("--cc-rb-c", c); el.style.setProperty("--cc-rb-ct", t);
        }
        stamp(sc.title, true);
        Array.prototype.forEach.call(sc.root.querySelectorAll("fieldset > legend"), function (l) { stamp(l, false); });
        Array.prototype.forEach.call(sc.root.querySelectorAll(sc.btns), function (b) {
          // SweetAlert reuses one node for its whole lifecycle, so a leftover hidden Cancel must
          // not eat a palette slot and shift the visible buttons.
          if (b.offsetParent === null && getComputedStyle(b).display === "none") return;
          // A confirmation's forward button may well delete, and a delete is never red.
          stamp(b, false, b.classList.contains("confirm"));
        });
      });
      // The iframe dialog paints its own badges from the parent and cannot read these CSS vars, so
      // it is repainted on the same cadence; otherwise a live mode switch leaves it on the old
      // colours.
      try { ccPopIframes(); } catch (ePI) {}
    } catch (e) {}
  }
  // A confirmation closes from CannonadeCommand's close badge in its corner. The press clicks
  // SweetAlert's Cancel, shown or hidden, as Escape does, so the callback hears a cancel. SweetAlert
  // keeps one node for every dialog, so the badge is added once and Header.css shows it only on a
  // confirmation.
  function swalClose(sa) {
    if (sa.querySelector(":scope > .cc-win-x") || !window.CCTheme || !window.CCTheme.closeBadge) return;
    sa.appendChild(window.CCTheme.closeBadge(function () { var c = sa.querySelector("button.cancel"); if (c) c.click(); }));
  }
  // docker.js's ctout window is a page navigation of its own, so it gets the one function it needs
  // rather than this file's observer machinery.
  try { window.paintPopups = paintPopups; } catch (ePP) {}
  // The streaming plugin-install and container-update dialog gets a loader: the in-progress state is
  // read from the title, a rotating ring goes beside the title badge, and the empty grey fieldset
  // bars Unraid leaves behind are hidden. A per-dialog subtree observer restyles on every streamed
  // line and on the flip to finished.
  // Those observers wake hundreds of times a second while a log streams, so they are coalesced into
  // one restyle per 60ms rather than restyling on every mutation, which saturated the main thread
  // and locked the UI. A timeout, not requestAnimationFrame, which a background tab throttles and
  // which would leave the dialog unstyled.
  var _ccPopT = 0, _ccPopFull = false;
  function ccPopRestyleSoon(full) {
    if (full) _ccPopFull = true;
    if (_ccPopT) return;
    _ccPopT = setTimeout(function () {
      _ccPopT = 0;
      var doFull = _ccPopFull; _ccPopFull = false;
      try { ccNchanStyle(); } catch (e) {}
      try { paintPopups(); } catch (e) {}
      if (doFull) { try { ccPopIframes(); } catch (e) {} try { ccPopoverDim(); } catch (e) {} try { ccNotifActions(); } catch (e) {} try { ccPaintRotate(); } catch (e) {} }
    }, 60);
  }
  function ccNchanStyle() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // The container-update window is a .sweet-alert without the nchan class in this Unraid build,
      // so every nchan-scoped rule below would miss it. Any .sweet-alert holding a <pre> log is
      // matched too and gets the class stamped on it.
      // ccPopObs watches document.body's childList without subtree, so it fires when an alert
      // first appears (the "are you sure" confirm, which has no <pre>) but never again while that
      // same alert streams in place and its title cycles. A subtree observer on every sweet-alert,
      // matched or not, makes the later in-place streaming re-run this.
      var allSa = document.querySelectorAll(".sweet-alert");
      for (var z = 0; z < allSa.length; z++) {
        if (!allSa[z].__ccNchanObs) {
          allSa[z].__ccNchanObs = new MutationObserver(function () { ccPopRestyleSoon(false); });
          try { allSa[z].__ccNchanObs.observe(allSa[z], { childList: true, subtree: true, characterData: true }); } catch (e) {}
        }
      }
      var sas = document.querySelectorAll(".sweet-alert.nchan, .sweet-alert:has(pre)");
      for (var i = 0; i < sas.length; i++) {
        var sa = sas[i], h2 = sa.querySelector("h2"); if (!h2) continue;
        sa.classList.add("nchan");
        // The update stream carries a <style> block whose content also lands in a bare text node
        // and renders as raw CSS under the title. The CSS hides the element; this blanks the
        // text-rendered variant, matching leaf elements and text nodes with a CSS signature.
        try {
          var CSS_SIG = /font-family\s*:|@font-face|\.logLine\s*\{/i;
          var leafs = sa.querySelectorAll("p, div, font, pre, span");
          for (var cq = 0; cq < leafs.length; cq++) { var le = leafs[cq]; if (!le.children.length && !(le.id && le.id.indexOf("cc-") === 0) && !le.className && CSS_SIG.test(le.textContent || "") && (le.textContent || "").indexOf("{") !== -1) le.style.display = "none"; }
          var tw = document.createTreeWalker(sa, NodeFilter.SHOW_TEXT, null);
          var tn; while ((tn = tw.nextNode())) { if (CSS_SIG.test(tn.nodeValue || "") && (tn.nodeValue || "").indexOf("{") !== -1) tn.nodeValue = ""; }
        } catch (eCss) {}
        // The title badge shows the clean name, with no status text and no loader. The status sits
        // bottom left beside the buttons: a three-dot loader while the stream runs, a circle with
        // a check when it finishes.
        var raw = (h2.textContent || "");
        // Only a real install or update stream gets the indicator. The System Information and
        // changelog windows carry a <pre> too but are static, so a stream is recognised by a
        // progress verb in the title or by the exec step cards Unraid emits (fieldset.CMD and
        // fieldset.docker from Helpers.php addLog). A plain <fieldset> is too broad a match, since
        // System Information wraps its table.info in one, which is why that table also excludes a
        // window outright.
        var isStream = (/in\s*progress|wird\s+(aktualisiert|installiert|erstellt|neu\s*erstellt|gezogen|gestartet)|updating|installing|pulling|creating/i.test(raw) || !!sa.querySelector("fieldset.CMD, fieldset.docker") || !!sa.querySelector("#swaltext")) && !sa.querySelector("table.info");
        if (isStream) {
          // Recomputed from scratch on every pass, so a fresh window starts as running and never
          // inherits a stale "done" from the reused SweetAlert node.
          // Completion comes from Unraid's own signal rather than a phrase in the log: while a job
          // runs it renders a #pluginProgressTitle span with a spinner, and on the nchan done or
          // error message openDone() and openError() replace that span with plain text and enable
          // the confirm button. That flip is instant and locale-independent, while an install log
          // may never contain a completion phrase at all.
          var progT = h2.querySelector("#pluginProgressTitle");
          var spinning = progT ? !!progT.querySelector(".fa-spin, .fa-refresh, i.fa") : false;
          var cb0 = sa.querySelector("button.confirm");
          var btnDone = !!(cb0 && !cb0.disabled && cb0.offsetParent !== null && !/close|schlie|abbrech|cancel/i.test(cb0.textContent || ""));
          var done;
          if (progT) { done = !spinning; }               // the span is there, so a missing spinner means finished or error
          else if (btnDone) { done = true; }             // no span, but the confirm button went live
          else {                                         // last resort: wait for the log phrase and a settled stream
            var finishTxt = /(erfolgreich (ausgeführt|beendet)|successfully|command (finished|completed|executed)|finished)/i.test(sa.textContent || "");
            var len = (sa.textContent || "").length;
            if (sa.__ccLen !== len) { sa.__ccLen = len; sa.__ccGrow = Date.now(); }
            done = finishTxt && (Date.now() - (sa.__ccGrow || 0)) > 700;
            if (!done && finishTxt) { clearTimeout(sa.__ccSettleT); sa.__ccSettleT = setTimeout(function () { try { ccNchanStyle(); paintPopups(); } catch (e) {} }, 750); }
          }
          if (done) sa.__ccDone = true;                  // once finished it never goes back to running
          sa.dataset.ccState = (done || sa.__ccDone) ? "done" : "run";
          sa.classList.toggle("cc-nchan-err", (done || sa.__ccDone) && /error|fehler/i.test((progT ? progT.textContent : (cb0 && cb0.textContent)) || ""));
        } else { sa.dataset.ccState = ""; sa.__ccDone = false; }
        var state = sa.dataset.ccState || "";
        sa.classList.toggle("cc-nchan-loading", state === "run");
        sa.classList.toggle("cc-nchan-done", state === "done");
        // Follow the streamed log to its new bottom line. Which element actually scrolls varies
        // with the Unraid build and the dialog type (#swaltext, a fieldset, or the dialog box), so
        // every scroller inside the dialog is pinned to its own bottom, once per restyle pass
        // rather than per streamed line. The page itself is left alone: a .sweet-alert here is
        // fixed and centred with its own overflow, so scrolling the page only drags the list
        // behind it out from under the reader. Gated on the running state, so a static <pre>
        // dialog such as System Information or a changelog viewer never scrolls at all.
        if (state === "run") {
          var scrollers = sa.querySelectorAll("*");
          for (var sc = 0; sc < scrollers.length; sc++) { var sn = scrollers[sc]; if (sn.scrollHeight - sn.clientHeight > 2) sn.scrollTop = sn.scrollHeight; }
          if (sa.scrollHeight - sa.clientHeight > 2) sa.scrollTop = sa.scrollHeight;
        }
        // Strip the status suffix from the title without rewriting h2.textContent, which would
        // destroy #pluginProgressTitle, the completion signal read above. Hide the progress span in
        // place and trim the trailing separator; rewriting the text is the fallback for an alert
        // that has no such span.
        var progH = h2.querySelector("#pluginProgressTitle");
        if (progH) {
          progH.style.display = "none";
          var pv = progH.previousSibling;
          if (pv && pv.nodeType === 3 && /[-–—]\s*$/.test(pv.nodeValue || "")) pv.nodeValue = pv.nodeValue.replace(/\s*[-–—]\s*$/, "");
        } else {
          var clean = raw.replace(/\s*[-–—]\s*(IN\s*PROGRESS|FINISHED)\b[\s\S]*$/i, "").replace(/\s+$/, "");
          if (clean && clean !== raw && h2.textContent !== clean) h2.textContent = clean;
        }
        var oldspin = h2.querySelector(".cc-nchan-spin"); if (oldspin) oldspin.remove();
        // the bottom-left status badge: a spinning ring while running, a circle with a check when done
        var loader = sa.querySelector(".cc-nchan-loader");
        if (state === "run" || state === "done") {
          if (!loader) {
            loader = document.createElement("span"); loader.className = "cc-nchan-loader"; loader.setAttribute("role", "status");
          }
          // The loader is re-homed to the button row on every pass: the docker-create window
          // streams with no buttons at all and renders them only when it finishes. Any button
          // counts, since those carry no .confirm or .cancel class; without a row the loader lands
          // on the dialog, which the CSS pins bottom left.
          var _btns = sa.querySelectorAll("button");
          var _row = sa.querySelector(".sa-button-container") || (_btns.length ? _btns[_btns.length - 1].parentElement : sa);
          if (loader.parentElement !== _row) _row.appendChild(loader);
          if (state === "done") {
            if (loader.getAttribute("data-cc-mode") !== "done") { loader.setAttribute("data-cc-mode", "done"); loader.classList.add("cc-nchan-check"); loader.setAttribute("aria-label", T("Fertig", "Done")); loader.innerHTML = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle class='cc-ck-c' cx='12' cy='12' r='10.5'/><path class='cc-ck-p' d='M6.5 12.5l3.6 3.6L17.5 8.8'/></svg>"; }
          } else if (loader.getAttribute("data-cc-mode") !== "run") {
            loader.setAttribute("data-cc-mode", "run"); loader.classList.remove("cc-nchan-check"); loader.setAttribute("aria-label", T("Läuft…", "Working…")); loader.innerHTML = "<span class='cc-loader cc-load-sm'><span class='o'><i></i></span><span class='in'><i></i></span></span>";  // the shared double counter-rotating ring, small tier
          }
        } else if (loader) { loader.remove(); }
        // The step cards are dark, so a fieldset holding only a legend renders as a stray grey bar.
        // Hide any whose body text, the content minus the legend, is blank.
        var fs = sa.querySelectorAll("fieldset");
        for (var j = 0; j < fs.length; j++) {
          var body = (fs[j].textContent || ""), leg = fs[j].querySelector("legend");
          if (leg) body = body.replace(leg.textContent || "", "");
          fs[j].style.display = body.replace(/\s+/g, "") ? "" : "none";
        }
        if (!sa.__ccNchanObs) { sa.__ccNchanObs = new MutationObserver(function () { ccPopRestyleSoon(false); }); sa.__ccNchanObs.observe(sa, { childList: true, subtree: true, characterData: true }); }
      }
    } catch (e) {}
  }
  // A dialog's content often lives in a same-origin iframe the parent CSS cannot reach, so a small
  // sheet goes into the inner document.
  function ccPopIframes() {
    try {
      var rootCS = getComputedStyle(document.documentElement);
      var tok = function (name, d) { return (rootCS.getPropertyValue(name) || "").trim() || d; };
      var acc = tok("--cc-hdr-accent", "#FCC419");
      var rCtl = tok("--cc-radius-control", "12px"), rPill = tok("--cc-radius-pill", "9999px");
      var fsBody = tok("--cc-text-body", "14px"), fsMeta = tok("--cc-text-meta", "12px");
      var ifr = document.querySelectorAll(".ui-dialog iframe");
      for (var i = 0; i < ifr.length; i++) {
        (function (f) {
          function inject() {
            try {
              var d = f.contentDocument;
              if (!d || !d.head || d.getElementById("cc-pop-inner")) return;
              var st = d.createElement("style"); st.id = "cc-pop-inner";
              // The iframe cannot read the parent's CSS vars, so the radii and type sizes are read
              // off the parent's tokens and written in as values; the 36px button height tracks
              // --cc-lgb-h in Header.css, and the focus rules repeat the parent's. The inner surface
              // is darkened so no lighter native band shows through, and the text inputs get the
              // dark fill while radios stay native.
              st.textContent = "html,body{background:#0f0f0f !important;color:#d6d6d6 !important} fieldset,table,tbody,thead,tr,td,th,.tabs,dl,dt,dd,form,center,p,section,article,div{background:transparent !important;border:none !important} legend{color:#9a9a9a !important} label,td,th{color:#d6d6d6 !important} input[type=text],input[type=password],input[type=email],input[type=search],input[type=number],input[type=url],textarea,select{background:#232323 !important;color:#eaeaea !important;border:none !important;border-radius:" + rCtl + " !important;outline:none !important;box-shadow:none !important} textarea{width:100% !important;box-sizing:border-box !important} a{color:" + acc + " !important} " +
                "input[type=button],input[type=submit],button{height:36px !important;padding:0 24px !important;font-size:" + fsBody + " !important;border:0 !important;border-radius:" + rPill + " !important;box-shadow:none !important;background:" + acc + " !important;color:" + idealText(acc) + " !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:.6px !important;cursor:pointer} center,.buttons{text-align:center !important} a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none !important;box-shadow:none !important;filter:brightness(1.18)} " +
                // The template-update window is CreateDocker.php inside this iframe, with inline
                // styles of its own. These selectors exist only in that window, so giving them the
                // CC look here reaches nothing else.
                "fieldset.docker{background:#191919 !important;border:none !important;border-radius:" + rCtl + " !important;margin:0 0 12px !important;padding:10px 12px !important;box-shadow:0 1px 4px rgba(0,0,0,.35) !important} fieldset.docker>legend{display:inline-block !important;background:" + acc + " !important;color:" + idealText(acc) + " !important;border:none !important;border-radius:" + rPill + " !important;padding:3px 12px !important;font-size:" + fsMeta + " !important;font-weight:600 !important;text-transform:uppercase !important;letter-spacing:.6px !important} span.system{background:transparent !important;color:#d6d6d6 !important;box-shadow:none !important} span.label{background:rgba(255,255,255,.08) !important;color:#e6e6e6 !important;border-radius:" + rPill + " !important;padding:3px 10px !important}";
              d.head.appendChild(st);
            } catch (e2) {}
          }
          // The sheet above bakes in one colour, so in rainbow mode the inner window would sit
          // outside the colour modes entirely. An iframe has no var() chain to read, so the
          // rotation is painted in directly; inline with "important" outranks the injected sheet,
          // and re-running is idempotent, so a card streamed in later gets its slot as it arrives.
          // The sequence continues the one in paintPopups(): the title is slot 0, so the badges
          // start at 1 and the buttons follow the last badge.
          function paintInner() {
            try {
              var d = f.contentDocument; if (!d || !d.body) return;
              var n = 1;
              function put(el) {
                if (!rbOn()) { el.style.removeProperty("background"); el.style.removeProperty("color"); return; }
                var c = popBadge(n++), t = idealText(c);
                el.style.setProperty("background", c, "important"); el.style.setProperty("color", t, "important");
              }
              Array.prototype.forEach.call(d.querySelectorAll("fieldset.docker > legend"), put);
              Array.prototype.forEach.call(d.querySelectorAll("input[type=button], input[type=submit], button"), put);
            } catch (e4) {}
          }
          inject(); paintInner();
          try { f.addEventListener("load", function () { inject(); paintInner(); }); } catch (e3) {}
        })(ifr[i]);
      }
    } catch (e) {}
  }
  // The Connect popover (bell and burger menu) has no backdrop of its own, so a dim and blur
  // overlay goes behind it while it is open. Clicking it sends Escape, which reka honours.
  function ccPopoverDim() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) { var d0 = document.getElementById("cc-pop-dim"); if (d0) d0.style.display = "none"; return; }
      // The burger menu teleports to body as .bg-popover, while the bell's notification centre is
      // a sheet rendered inside the Connect root, which the body observer misses. Both open states
      // share the one backdrop.
      var pop = document.querySelector(".bg-popover") || document.querySelector(".unapi div.fixed.z-50.bg-background");
      var dim = document.getElementById("cc-pop-dim");
      if (!pop) { if (dim) dim.style.display = "none"; return; }
      if (!dim) {
        dim = document.createElement("div"); dim.id = "cc-pop-dim";
        // The Escape carries a keyCode as well: dynamix's shortcut handler reads nothing else and
        // throws on a key event without one.
        dim.addEventListener("pointerdown", function () { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true })); });
        document.body.appendChild(dim);
      }
      // The backdrop sits above #header and #menu so the blur covers the header band, and below
      // the popup's own root stacking context so the menu stays crisp. The inner node's z-index is
      // relative to that context, so the walk up takes the highest one, the real root layer, and
      // the backdrop goes one step under it, floored at 103 to clear the header.
      var topZ = 0;
      for (var an = pop; an && an !== document.body && an !== document.documentElement; an = an.parentElement) {
        var az = parseInt(getComputedStyle(an).zIndex, 10);
        if (isFinite(az) && az > topZ) topZ = az;
      }
      if (!topZ) topZ = 50;
      dim.style.zIndex = String(topZ - 1 > 102 ? topZ - 1 : 103);
      dim.style.display = "block";
      // The Connect sheet closes through an animation and fires none of the open-time triggers
      // again, so while the backdrop shows, a self-clearing poll hides it once the popover is gone.
      if (!ccDimWatch) {
        ccDimWatch = setInterval(function () {
          if (!document.querySelector(".bg-popover") && !document.querySelector(".unapi div.fixed.z-50.bg-background")) {
            var d = document.getElementById("cc-pop-dim"); if (d) d.style.display = "none";
            clearInterval(ccDimWatch); ccDimWatch = 0;
          }
        }, 200);
      }
    } catch (e) {}
  }
  var ccDimWatch = 0;
  var ccPopObs = null;
  function watchPopups() {
    try {
      if (ccPopObs) return; ccPopObs = new MutationObserver(function () { ccPopRestyleSoon(true); });
      ccPopObs.observe(document.body, { childList: true });   // dialogs append as direct body children, so no subtree needed
    } catch (e) {}
  }
  // The Connect bell shows a Vue notification list that caches its rows: a GraphQL mutation clears
  // the backend, but the open list keeps showing them. The native "archive all" link also opens a
  // confirm dialog far off screen. So the native link is hidden and two cloned badges take its
  // place, a clone carrying no Vue handler and therefore no confirm, which call the same-origin
  // GraphQL API and then reload the page, the only way the cached list comes back current.
  // Archiving sweeps the unread into the archive; deleting archives first and then deletes the
  // archived, behind a two-step armed click.
  function ccGql(q, variables) {
    return fetch("/graphql", { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "x-csrf-token": (window.csrf_token || "") },
      body: JSON.stringify(variables ? { query: q, variables: variables } : { query: q }) });
  }
  try { window.ccGql = ccGql; } catch (e) {} // docker.js's organizer code reuses the same transport
  function ccArchiveNotifs() {
    try { ccGql("mutation { archiveAll { archive { total } } }").then(function () { location.reload(); }).catch(function () {}); } catch (e) {}
  }
  function ccClearNotifs() {
    try {
      ccGql("mutation { archiveAll { archive { total } } }")
        .then(function () { return ccGql("mutation { deleteArchivedNotifications { archive { total } unread { total } } }"); })
        .then(function () { location.reload(); })
        .catch(function () {});
    } catch (e) {}
  }
  function ccArmDelete(del) {                                                        // the first click arms, a second one within 4s clears
    if (del.getAttribute("data-armed") === "1") { ccClearNotifs(); return; }
    del.setAttribute("data-armed", "1"); del.classList.add("cc-notif-armed");
    // The icon-only button has no text to relabel, so it signals the armed state through its fill
    // and its tooltip.
    var iconOnly = del.classList.contains("cc-notif-iconbtn");
    if (iconOnly) del.setAttribute("title", T("Wirklich löschen? Nochmal klicken.", "Really delete? Click again."));
    else del.textContent = T("Wirklich löschen?", "Really delete?");
    clearTimeout(del._ccT);
    del._ccT = setTimeout(function () {
      del.setAttribute("data-armed", "0"); del.classList.remove("cc-notif-armed");
      if (iconOnly) del.setAttribute("title", T("Alle löschen", "Delete all"));
      else del.textContent = T("Alle löschen", "Delete all");
    }, 4000);
  }
  function ccNotifActions() {
    try {
      if (g("cc.theming", "1") === "0") return;
      var host = document.querySelector(".unapi div.fixed.z-50.bg-background");     // the Connect notification sheet
      if (!host) return;
      // The sheet's close control is a square icon badge in the corner, so it takes a bubble that
      // names it, like every icon-only badge.
      var x = host.querySelector(":scope > span.absolute > [role=\"button\"]");
      if (x) x.classList.add("cc-notif-x");
      if (x && !x.getAttribute("data-cc-tip")) { x.setAttribute("data-cc-tip", T("Schließen", "Close")); if (!x.getAttribute("aria-label")) x.setAttribute("aria-label", T("Schließen", "Close")); }
      // A button says what it does, and the German pack names the card action with a noun. Looked
      // at on every call, since Vue rebuilds the cards as they arrive.
      var cardBtns = host.querySelectorAll('[class~="group/item"] span[class*="rounded-md"][class*="inline-flex"]');
      for (var cb = 0; cb < cardBtns.length; cb++) {
        var cbt = ccLabelText(cardBtns[cb]);
        if (cbt && cbt.nodeValue.trim() === "Archiv") cbt.nodeValue = cbt.nodeValue.replace("Archiv", "Archivieren");
      }
      if (host.querySelector(".cc-notif-badge")) return;
      var arch = null, sp = host.querySelectorAll("span, button, a");
      for (var i = 0; i < sp.length; i++) { if (/^\s*(Alle archivieren|Archive all)\s*$/i.test(sp[i].textContent || "")) { arch = sp[i]; break; } }
      if (!arch || !arch.parentElement) return;                                     // the empty state and the archive tab have no link to attach to
      arch.parentElement.classList.add("cc-notif-actions");                         // the CSS turns the column into a badge row
      // The two bulk actions become icon-only badges docked left of the type-filter gear.
      var gear = null, glinks = host.querySelectorAll('a[href*="Notification"]');
      for (var gi = 0; gi < glinks.length; gi++) { if (glinks[gi].querySelector("svg") && !(glinks[gi].textContent || "").trim()) { gear = glinks[gi]; break; } }
      if (gear && !gear.getAttribute("data-cc-tip")) { gear.setAttribute("data-cc-tip", T("Benachrichtigungs-Einstellungen", "Notification settings")); gear.removeAttribute("title"); }  // the same frameless bubble the two bulk icons get
      var ICON_ARCH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden="true"><path d="M2 5a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z" /><path d="M19 9c.513 0 .936 .463 .993 1.06l.007 .14v7.2c0 1.917 -1.249 3.484 -2.824 3.594l-.176 .006h-10c-1.598 0 -2.904 -1.499 -2.995 -3.388l-.005 -.212v-7.2c0 -.663 .448 -1.2 1 -1.2h14zm-5 2h-4l-.117 .007a1 1 0 0 0 0 1.986l.117 .007h4l.117 -.007a1 1 0 0 0 0 -1.986l-.117 -.007z" /></svg>';   // tabler filled/archive
      var ICON_DEL = (window.CCTheme && window.CCTheme.CC_TRASH_SVG) || "";   // the one trash can, from cc-theme.js
      function badge(icon, label, cls, onAct) {
        var b = arch.cloneNode(true);                                              // the native look without its Vue handler
        b.removeAttribute("id"); b.className = arch.className + " cc-notif-badge cc-notif-iconbtn " + cls;
        b.innerHTML = icon; b.setAttribute("role", "button"); b.setAttribute("aria-label", label); b.setAttribute("data-cc-tip", label); b.removeAttribute("title"); b.tabIndex = 0; b.style.cursor = "pointer";
        b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); onAct(b); });
        b.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onAct(b); } });
        return b;
      }
      var arB = badge(ICON_ARCH, T("Alle archivieren", "Archive all"), "cc-notif-arch", function () { ccArchiveNotifs(); });
      var del = badge(ICON_DEL, T("Alle löschen", "Delete all"), "cc-notif-del", function () { ccClearNotifs(); });
      arch.style.display = "none";                                                  // its click opens the off-screen confirm
      if (gear && gear.parentNode) {                                                // without a gear, fall back to the native spot
        var anchor = gear.closest(".shrink-0") || gear;
        anchor.parentNode.insertBefore(arB, anchor);
        anchor.parentNode.insertBefore(del, anchor);
      } else {
        arch.parentNode.insertBefore(arB, arch.nextSibling);
        arB.parentNode.insertBefore(del, arB.nextSibling);
      }
      for (var k = 0; k < sp.length; k++) { if (sp[k] !== del && /^\s*(Alle löschen|Delete all)\s*$/i.test(sp[k].textContent || "")) sp[k].style.display = "none"; }  // the archive tab has a native delete-all too
    } catch (e) {}
  }
  // Every CC area lines its left edge up with the main menu bar. The offset is measured rather than
  // guessed with a constant, which drifts: the first menu item's real left edge minus #displaybox's
  // own left, written once to --cc-align-left on <html>. Every area's sheet reads that, so one
  // measured value aligns them all whatever the theme, the font size or the header state. Runs on
  // every apply() and on resize; the static value in each sheet is the fallback without JS.
  function measureAlign() {
    try {
      var root = document.documentElement;
      if (root.classList.contains("Theme--sidebar")) return;   // a vertical menu has no horizontal edge to match, and the sheets exclude it too
      var box = document.getElementById("displaybox");
      var tile = document.querySelector("#menu .nav-tile:not(.right)");
      var a = tile && tile.querySelector(".nav-item > a");
      if (!box || !a) return;                                  // no menu or no content here, so the CSS fallback stands
      var aRect = a.getBoundingClientRect(), boxRect = box.getBoundingClientRect();
      // compensate for horizontal scroll inside the menu tile, so the value is stable with many tabs
      var scroll = tile.scrollLeft || 0;
      var edge;
      if (root.classList.contains("cc-header-on")) {
        edge = aRect.left + scroll;                            // the pill's background box is the visible edge
      } else {
        var cs = getComputedStyle(a);                         // in the native text menu the text is the visible edge, past the anchor's own padding
        edge = aRect.left + scroll + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
      }
      if (root.classList.contains("Theme--width-boxed")) {
        // At boxed display width the content is centred while the menu bar runs full width, so the
        // section badges would land far right of the menu. Overriding the centring margin with the
        // menu item's absolute left aligns the whole content to the bar; edge does not depend on
        // the box position, so this cannot oscillate, and --cc-align-left stays at zero.
        root.style.setProperty("--cc-box-shift", Math.round(edge) + "px");
        root.style.setProperty("--cc-align-left", "0px");
      } else {
        var align = Math.round(edge - boxRect.left);
        if (align >= 0 && align < 200) { root.style.setProperty("--cc-align-left", align + "px"); root.style.setProperty("--cc-box-shift", "0px"); }  // bounded, so a bad measurement leaves the sheets' fallback
      }
      // The server-name brand sits at x=0 while the menu tabs start at their padded left, so it
      // looks off by that pad. Nudging its margin by the measured delta converges, since the next
      // pass measures roughly nothing.
      var brand = document.getElementById("cc-brand");
      if (brand) {
        var bRect = brand.getBoundingClientRect();
        if (bRect.width > 0) {
          var cm = parseFloat(getComputedStyle(brand).marginLeft) || 0;
          var bd = Math.round(edge - bRect.left);
          if (bd && Math.abs(bd) < 200) brand.style.marginLeft = (cm + bd) + "px";
        }
      }
    } catch (e) {}
  }
  // The main-menu items can be reordered by dragging, but only after a press and hold arms it: the
  // cursor stays the normal link pointer and a plain click still navigates. Holding an item for
  // about 450ms sets everything jiggling to signal that it can be moved, and the same held press
  // then drags it. The native order comes from the server, so this is a front-end reorder plus its
  // persistence, active while the header area is on. An item with no saved position keeps its
  // native slot after the saved ones.
  function navTile() { return document.querySelector("#menu .nav-tile:not(.right)"); }
  function navTileR() { return document.querySelector("#menu .nav-tile.right"); }
  // Both tiles form one zone: every page tab, every utility icon and the array-usage meter take
  // part, wherever they sit. The user menu and the transient search box never move.
  function navParts(tile) { if (!tile) return []; return Array.prototype.slice.call(tile.querySelectorAll(":scope > .nav-item, :scope > .usage-bar")); }
  function navAllParts() { return navParts(navTile()).concat(navParts(navTileR())); }
  // A stable key per item: tabs by href, utility icons by their link signature, the meter fixed.
  // Keying an icon by its localised title resets that one icon on a language switch.
  function navKeyAll(it) {
    if (it.id === "cc-bell-proxy") return "cc-bell";              // the proxies have no href to key on
    if (it.id === "cc-burger-proxy") return "cc-burger";
    if (it.classList.contains("usage-bar")) return "usage-bar";
    var a = it.querySelector("a"); if (!a) return null;
    // Every native utility anchor is href="#" and carries its real discriminator in onclick, so
    // keying by href first collapses them all onto one key. That breaks applyNavOrder's
    // idempotence gate, and place() and the #menu observer then reshuffle the right tile forever.
    var href = (a.getAttribute("href") || "").trim();
    if (href === "#") href = "";
    return ((href || a.getAttribute("onclick") || a.getAttribute("title") || "") + "").slice(0, 160) || null;
  }
  // cc.navorder.all holds {left:[keys], right:[keys]}, each tile's own sequence including items
  // dragged over from the other side, with a one-time migration from the older per-zone keys.
  function navReadAll() {
    var o = null;
    try { o = JSON.parse(g("cc.navorder.all", "null")); if (!(o && o.left && o.right)) o = null; } catch (e) {}
    if (!o) {
      try {
        var l = JSON.parse(g("cc.navorder", "null")) || [], r = JSON.parse(g("cc.navorder.right", "null")) || [];
        if (l.length || r.length) o = { left: l, right: r };
      } catch (e2) {}
    }
    if (!o) return null;
    // The bell and burger proxies host a live adopted Vue trigger rather than a plain link and
    // render correctly only among the other utility icons, so a stray drag must not leave them
    // parked among the page tabs.
    if (o.left && o.left.length) o.left = o.left.filter(function (k) { return k !== "cc-bell" && k !== "cc-burger"; });
    return o;
  }
  function applyNavOrder() {
    try {
      if (ccReorder || ccDragged) return;                      // never fight a live drag
      // Unraid's Connect auto-mount script observes the menu and rebuilds its component nodes on
      // a reorder. That rebuild refires this observer, place() reorders again, and the two sides
      // ping-pong the main thread into a freeze, so an arrangement that will not settle after a
      // few attempts stands down for a while.
      if (Date.now() < ccNavTruce) return;
      var o = navReadAll(); if (!o) return;
      var lt = navTile(), rt = navTileR(); if (!lt || !rt) return;
      var byKey = {}, all = navAllParts(), i, k;
      for (i = 0; i < all.length; i++) { k = navKeyAll(all[i]); if (k && !byKey[k]) byKey[k] = all[i]; }
      // Applying the order at boot alone misses the utility icons, which native scripts append
      // afterwards, so this runs from the #menu observer as well. insertBefore always mutates, so
      // re-running demands a strict no-op once the arrangement matches, or it loops.
      function inPlace(tile2, want) {
        var wantHere = [], wset = {}, have = [], cur = navParts(tile2), j, kk;
        for (j = 0; j < want.length; j++) if (byKey[want[j]]) { wantHere.push(want[j]); wset[want[j]] = 1; }
        for (j = 0; j < cur.length; j++) { kk = navKeyAll(cur[j]); if (kk && wset[kk]) have.push(kk); }
        if (have.length !== wantHere.length) return false;     // a saved item currently sits in the other tile
        for (j = 0; j < have.length; j++) if (have[j] !== wantHere[j]) return false;
        return true;
      }
      if (inPlace(lt, o.left) && inPlace(rt, o.right)) { ccNavTries = 0; return; }
      // Auto-mount undoes the reorder asynchronously, so a re-check right after placing would
      // always pass. Count instead how often a re-place happens in a short window: a page load or
      // a late icon takes one or two rounds, a fight never ends. Standing down before placing
      // leaves the other side nothing to react to.
      var now = Date.now();
      if (now - ccNavLast > 3000) ccNavTries = 0;
      ccNavLast = now;
      if (++ccNavTries >= 4) { ccNavTruce = now + 5000; ccNavTries = 0; return; }
      function place(tile2, want) {
        var anchor = tile2.querySelector(":scope > .nav-user");   // the user menu stays the tail, and a missing one means append
        for (var j = 0; j < want.length; j++) { var it = byKey[want[j]]; if (it) tile2.insertBefore(it, anchor); }
      }
      place(lt, o.left); place(rt, o.right);                   // an item with no saved position keeps its native tile and slot
    } catch (e) {}
  }
  function saveNavOrder() {
    try {
      var lt = navTile(), rt = navTileR(); if (!lt || !rt) return;
      function seq(tile2) { var out = [], ps = navParts(tile2), i, k; for (i = 0; i < ps.length; i++) { k = navKeyAll(ps[i]); if (k) out.push(k); } return out; }
      localStorage.setItem("cc.navorder.all", JSON.stringify({ left: seq(lt), right: seq(rt) }));
    } catch (e) {}
  }
  var ccDragged = null, ccReorder = false, ccHoldTimer = null, ccPressXY = null, ccSuppressClick = false, ccDocBound = false;
  var ccPressItem = null, ccPressPtr = 0, ccMoved = false;   // pointer-drag state
  var ccNavTruce = 0, ccNavTries = 0, ccNavLast = 0;   // see applyNavOrder
  var ccLockCapBound = false;
  function cancelHold() { if (ccHoldTimer) { clearTimeout(ccHoldTimer); ccHoldTimer = null; } ccPressXY = null; ccPressItem = null; }
  // The lock is what ends arranging, so it holds still and a press on it stays a click: a wiggling
  // lock misses clicks, and a press on a drag participant starts a drag.
  function isNavLock(it) { return it.id === "cc-lock-item" || it.classList.contains("LockButton"); }
  function enterReorder() {   // the hold is satisfied, so the whole zone jiggles
    if (ccReorder) return; ccReorder = true;
    navAllParts().forEach(function (it) { if (!isNavLock(it)) it.classList.add("cc-nav-wiggle"); });
  }
  function exitReorder() {    // back to plain, clickable items
    ccReorder = false; ccDragged = null; ccMoved = false;
    navAllParts().forEach(function (it) { it.classList.remove("cc-nav-wiggle", "cc-dragging"); });
  }
  // A lock toggle arms arranging. Locked, which is the state on every page load, the tabs and chips
  // navigate as usual; unlocked, everything wiggles and can be dragged straight away, and locking
  // again or pressing Escape saves the new order. The lock reuses Unraid's own "unlock sortable"
  // icon, which natively appears on the Dashboard only: there the native LockButton also toggles CC
  // arranging, and on every other page a look-alike util icon is injected.
  function ccArrangeLock() {
    try {
      // A capture-phase stopPropagation on the header eats lock clicks before they reach any
      // per-element handler, so one toggle is bound on the document in the capture phase, where it
      // fires first. It covers the native LockButton and the injected #cc-lock-item alike.
      if (!ccLockCapBound) {
        ccLockCapBound = true;
        document.addEventListener("click", function (e) {
          var lk = e.target && e.target.closest ? e.target.closest("#cc-lock-item, #menu .nav-item.LockButton") : null;
          if (!lk) return;
          if (lk.id === "cc-lock-item") e.preventDefault();   // the injected lock is an anchor, so suppress its navigation
          ccToggleArrange();
        }, true);
      }
      var old = document.getElementById("cc-arrange-lock"); if (old) old.remove();
      var on = document.documentElement.classList.contains("cc-header-on");
      var tileR = document.querySelector("#menu .nav-tile.right");
      var injected = document.getElementById("cc-lock-item");
      if (!on || !tileR) { if (injected) injected.remove(); return; }
      var native = document.querySelector("#menu .nav-item.LockButton");   // on the Docker tab Unraid puts it in the left tile
      if (native) {
        if (injected) injected.remove();   // the native one is there, and the capture toggle drives it
      } else if (!injected) {
        injected = document.createElement("div"); injected.className = "nav-item util cc-navdrag"; injected.id = "cc-lock-item"; injected.setAttribute("data-cc-drag", "1");   // the marker keeps it out of the reorder
        var a = document.createElement("a"); a.href = "#"; a.className = "hand"; a.setAttribute("data-cc-tip", T("Anordnen entsperren/sperren", "Unlock/lock arranging"));
        a.innerHTML = "<b class='icon-u-lock system'></b>";
        injected.appendChild(a); tileR.insertBefore(injected, tileR.firstChild);
      }
      var arr = document.documentElement.classList.contains("cc-arrange");
      if (native) native.classList.toggle("cc-lock-arranging", arr);
      var inj2 = document.getElementById("cc-lock-item"); if (inj2) inj2.classList.toggle("cc-lock-arranging", arr);
    } catch (e) {}
  }
  function ccToggleArrange() {
    try {
      var arr = !document.documentElement.classList.contains("cc-arrange");
      document.documentElement.classList.toggle("cc-arrange", arr);
      var isle = document.getElementById("cc-island");
      if (arr) { enterReorder(); if (isle) isle.classList.add("cc-isl-arranging"); }
      else {
        exitReorder(); if (isle) isle.classList.remove("cc-isl-arranging");
        try { saveNavOrder(); } catch (e1) {}
        try { ccIslandSaveOrder(); } catch (e2) {}
      }
      ccArrangeLock();
      try { ccDockProfile(); } catch (eD) {}                      // entering and leaving arrange swaps ghost and trigger, so re-adopt the bell and burger
      // The Docker tab's move arrows are Unraid's own, driven only by the native LockButton
      // onclick, which the header's capture-phase stopPropagation eats on a trusted click. So
      // arrange exits while the arrows stay. After the native handler has had its turn, flip
      // Unraid's LockButton once if its cookie disagrees with the arrange state.
      if (document.getElementById("docker_list")) {
        var wantArr = arr;
        setTimeout(function () {
          try {
            if (typeof LockButton !== "function") return;
            var cookieOn = /(^|;\s*)lockbutton=/.test(document.cookie);
            if (cookieOn !== wantArr) LockButton();
          } catch (e3) {}
        }, 0);
      }
    } catch (e) {}
  }
  // A command palette on Ctrl+K: a quick launcher over every page tab and a few CC actions, fuzzy
  // filtered and keyboard driven. Built on first open, one overlay reused afterwards.
  var ccCmdEl = null, ccCmdInput = null, ccCmdList = null, ccCmdItems = [], ccCmdSel = 0;
  function ccCmdSources() {
    var items = [];
    var seen = {};
    Array.prototype.forEach.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a) {
      var href = a.getAttribute("href") || "", label = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!href || href === "#" || !label || seen[href]) return; seen[href] = 1;
      items.push({ label: label, sub: href, kind: "page", go: function () { location.href = href; } });
    });
    items.push({ label: T("Anordnen ein/aus", "Toggle arranging"), sub: T("Menü & Insel umsortieren", "Rearrange menu & island"), kind: "action", go: function () { ccToggleArrange(); } });
    items.push({ label: T("CannonadeCommand-Einstellungen", "CannonadeCommand settings"), sub: "/Settings/CannonadeCommand", kind: "action", go: function () { location.href = "/Settings/CannonadeCommand"; } });
    // On the settings page the palette leads with that page's own search and hands it what was typed.
    // It opens a tick later, after the click that chose it, which the search would otherwise take
    // for a click beside it and close on.
    var sb = document.querySelector("#cc-settings .cc-set-searchbadge"), si = sb && sb.querySelector(".cc-set-search");
    if (si) items.unshift({ label: T("Einstellungen durchsuchen", "Search the settings"), sub: "/", kind: "action", pinned: true, go: function (q) {
      setTimeout(function () { sb.classList.add("cc-open"); si.value = q || ""; si.dispatchEvent(new Event("input", { bubbles: true })); si.focus(); }, 0);
    } });
    return items;
  }
  function ccCmdRender() {
    var q = (ccCmdInput.value || "").toLowerCase().replace(/\s+/g, "");
    var scored = [];
    ccCmdItems.forEach(function (it) {
      var hay = (it.label + " " + (it.sub || "")).toLowerCase();
      if (!q || it.pinned) { scored.push({ it: it, s: it.pinned ? -1 : 0 }); return; }
      // simple subsequence fuzzy match
      var i = 0; for (var c = 0; c < hay.length && i < q.length; c++) { if (hay[c] === q[i]) i++; }
      if (i === q.length) scored.push({ it: it, s: hay.indexOf(q[0]) });
    });
    scored.sort(function (a, b) { return a.s - b.s; });
    ccCmdSel = 0;
    ccCmdList.innerHTML = "";
    scored.slice(0, 40).forEach(function (r, ix) {
      var row = document.createElement("div"); row.className = "cc-cmd-item" + (ix === 0 ? " cc-cmd-on" : "");
      row.innerHTML = "<span class='cc-cmd-lbl'></span><span class='cc-cmd-sub'></span>";
      var raw = ccCmdInput.value.trim();
      row.querySelector(".cc-cmd-lbl").textContent = r.it.label; row.querySelector(".cc-cmd-sub").textContent = r.it.pinned && raw ? T("„" + raw + "“", "“" + raw + "”") : (r.it.sub || "");
      row.addEventListener("mousemove", function () { ccCmdMark(ix); });
      row.addEventListener("click", function () { var typed = ccCmdInput.value.trim(); ccCmdClose(); r.it.go(typed); });
      ccCmdList.appendChild(row);
    });
  }
  function ccCmdMark(ix) { var rows = ccCmdList.children; for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("cc-cmd-on", i === ix); ccCmdSel = ix; }
  function ccCmdOpen() {
    if (!ccCmdEl) {
      ccCmdEl = document.createElement("div"); ccCmdEl.id = "cc-cmd"; ccCmdEl.setAttribute("role", "dialog");
      ccCmdEl.innerHTML = "<div class='cc-cmd-bd'></div><div class='cc-cmd-box'><input class='cc-cmd-in' type='text' spellcheck='false' placeholder='" + T("Seite oder Aktion suchen…", "Search a page or action…") + "'><div class='cc-cmd-list'></div></div>";
      document.body.appendChild(ccCmdEl);
      ccCmdInput = ccCmdEl.querySelector(".cc-cmd-in"); ccCmdList = ccCmdEl.querySelector(".cc-cmd-list");
      ccCmdEl.querySelector(".cc-cmd-bd").addEventListener("click", ccCmdClose);
      ccCmdInput.addEventListener("input", ccCmdRender);
      ccCmdInput.addEventListener("keydown", function (e) {
        var n = ccCmdList.children.length;
        if (e.key === "ArrowDown") { e.preventDefault(); ccCmdMark(Math.min(ccCmdSel + 1, n - 1)); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].scrollIntoView({ block: "nearest" }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); ccCmdMark(Math.max(ccCmdSel - 1, 0)); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].scrollIntoView({ block: "nearest" }); }
        else if (e.key === "Enter") { e.preventDefault(); ccCmdList.children[ccCmdSel] && ccCmdList.children[ccCmdSel].click(); }
        else if (e.key === "Escape") { e.preventDefault(); ccCmdClose(); }
      });
    }
    ccCmdItems = ccCmdSources();
    ccCmdEl.classList.add("cc-cmd-open"); ccCmdInput.value = ""; ccCmdRender();
    setTimeout(function () { try { ccCmdInput.focus(); } catch (e) {} }, 20);
  }
  function ccCmdClose() { if (ccCmdEl) ccCmdEl.classList.remove("cc-cmd-open"); }
  // Wires one participant, guarded per item. The drag is pointer-based rather than the native HTML5
  // one, which needs draggable=true before pointerdown and so swallows the press that arms it.
  // Pointer capture with a manual insertBefore lets the arming gesture continue into the drag.
  function wireNavItem(it) {
    if (it.getAttribute("data-cc-drag") === "1") return; it.setAttribute("data-cc-drag", "1");
    it.setAttribute("draggable", "false"); it.classList.add("cc-navdrag");
    var la = it.querySelectorAll("a"); for (var ai = 0; ai < la.length; ai++) la[ai].setAttribute("draggable", "false");
    it.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || isNavLock(it)) return;
      // Locked, this does nothing and the tab navigates; in arrange mode the same press drags at
      // once, with no hold, and everything already wiggles.
      if (!document.documentElement.classList.contains("cc-arrange")) return;
      cancelHold(); ccPressXY = { x: e.clientX, y: e.clientY }; ccPressItem = it; ccPressPtr = e.pointerId; ccMoved = false;
      enterReorder(); ccDragged = ccPressItem;
      if (ccDragged) { ccDragged.classList.add("cc-dragging"); try { ccDragged.setPointerCapture(ccPressPtr); } catch (e2) {} }
      e.preventDefault();
    });
  }
  // The document-level pointer handlers, bound once, run the whole gesture; pointer capture routes
  // the moves here.
  function ccNavPointerMove(e) {
    if (ccPressXY && !ccReorder) {   // a real move before arming is a click or a scroll
      if (Math.abs(e.clientX - ccPressXY.x) > 8 || Math.abs(e.clientY - ccPressXY.y) > 8) { cancelHold(); }
      return;
    }
    if (!ccDragged) return;
    ccMoved = true;
    // insert the dragged item before or after whichever one the pointer is over
    var parts = navAllParts(), i, best = null;
    for (i = 0; i < parts.length; i++) { if (parts[i] === ccDragged) continue; var r = parts[i].getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 20 && e.clientY <= r.bottom + 20) { best = parts[i]; break; } }
    if (best) { var br = best.getBoundingClientRect(), before = e.clientX < br.left + br.width / 2; best.parentNode.insertBefore(ccDragged, before ? best : best.nextSibling); }
  }
  function ccNavPointerUp() {
    var wasReorder = ccReorder, dragged = ccDragged, moved = ccMoved;
    cancelHold();
    if (dragged) { try { dragged.releasePointerCapture(ccPressPtr); } catch (e) {} saveNavOrder(); }
    if (wasReorder) { if (!moved) ccSuppressClick = true; exitReorder(); }   // armed but never moved, so swallow the click rather than navigate
  }
  function setupNavDrag() {
    try {
      if (g("cc.navdrag", "1") === "0") return;
      navAllParts().forEach(wireNavItem);
      if (!ccDocBound) {
        ccDocBound = true;
        document.addEventListener("pointermove", ccNavPointerMove);
        document.addEventListener("pointerup", ccNavPointerUp);
        document.addEventListener("pointercancel", ccNavPointerUp);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.documentElement.classList.contains("cc-arrange")) { cancelHold(); ccToggleArrange(); } });
        // in the capture phase, so a press that never became a drag cannot navigate either
        document.addEventListener("click", function (e) { if (ccSuppressClick) { e.preventDefault(); e.stopPropagation(); ccSuppressClick = false; } }, true);
        // An auto-mount or a nav reorder that re-inserts the <a> between mousedown and mouseup
        // swallows the first click on /VMs. This handler sits on document, survives the
        // reinsertion and navigates on that first click.
        if (!window.__ccVmsClickFix) {
          window.__ccVmsClickFix = true;
          document.addEventListener("click", function (e) {
            try {
              if (ccSuppressClick || document.documentElement.classList.contains("cc-arrange")) return;
              var a = e.target && e.target.closest ? e.target.closest('#menu .nav-item:not(.util) a[href="/VMs"]') : null;
              if (!a) return;
              if (location.pathname.replace(/\/+$/, "") === "/VMs") return;
              location.href = "/VMs";
            } catch (e2) {}
          }, false);
        }
      }
    } catch (e) {}
  }
  // The top strip is empty between Unraid's two Connect web components, which are shadow DOM and
  // stay untouched, so the status island is a light-DOM span of its own inserted before the
  // profile. Its data comes from the CSS-hidden native footer: span#statusbar's text is bullet
  // separated, the first segment the array state and each following one "name: status (details)"
  // per service, and the same text carries the CPU and board temperatures in unmarked spans, so
  // the parsing goes by text rather than by structure.
  var ccIslandObs = null, ccIslandSig = "";
  // the three island rows, rebuilt on each paint, and the pointer-drag state for arranging chips
  var ccIslRows = null, ccIslDragBound = false, ccIslDragged = null, ccIslHold = null, ccIslPressXY = null, ccIslPressPtr = 0, ccIslMoved = false, ccIslSuppressClick = false;
  // a chip click jumps to the page it belongs to
  var CC_ISL_NAV = { array: "/Main", "array-fill": "/Main", docker: "/Docker", ram: "/Dashboard", cpu: "/Dashboard" };
  function ccIslandOn() { return g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0" && g("cc.island", "1") !== "0"; }
  // CPU and RAM exist as page globals on the Dashboard only, but Unraid publishes them cross-page on
  // nchan, the feed the footer rides. One lightweight websocket each, started when the island comes
  // on and stopped when it goes off; every message repaints the island, which the signature guard
  // turns into a no-op when nothing changed. This writes only inside #header, so it cannot loop.
  var ccLiveRam = "", ccLiveRamUsed = "", ccLiveCpu = "", ccLiveDocker = "", ccLiveSubs = null;
  var ccLiveNetRx = 0, ccLiveNetTx = 0, ccLiveNetOk = false;   // live receive and send rate in bytes/s
  function ccStartLive() {
    if (ccLiveSubs || typeof window.NchanSubscriber !== "function") return;
    ccLiveSubs = [];
    try {
      var u1 = new window.NchanSubscriber("/sub/update1", { subscriber: "websocket" });
      u1.on("message", function (m) {
        try {
          var d = JSON.parse(String(m));
          if (d && d.ram && d.ram.length && /%/.test(String(d.ram[0]))) {
            var r = String(d.ram[0]).replace(/\s+/g, ""), used = d.ram[1] ? String(d.ram[1]) : "";
            if (r !== ccLiveRam || used !== ccLiveRamUsed) { ccLiveRam = r; ccLiveRamUsed = used; ccIsland(); }
          }
        } catch (e) {}
      });
      u1.start(); ccLiveSubs.push(u1);
    } catch (e) {}
    ccStartCpu();
    ccStartNet();
    try {
      // /sub/dockerload publishes one line per running container on every page, so the count is
      // the number of non-empty lines.
      var dk = new window.NchanSubscriber("/sub/dockerload", { subscriber: "websocket" });
      dk.on("message", function (m) {
        try { var n = String(m).split("\n").filter(function (l) { return l.indexOf(";") > 0; }).length; var s = n > 0 ? String(n) : ""; if (s !== ccLiveDocker) { ccLiveDocker = s; ccIsland(); } } catch (e) {}
      });
      dk.start(); ccLiveSubs.push(dk);
    } catch (e) {}
  }
  function ccStopLive() { if (ccLiveSubs) { ccLiveSubs.forEach(function (s) { try { s.stop(); } catch (e) {} }); ccLiveSubs = null; } ccLiveRam = ccLiveRamUsed = ccLiveCpu = ccLiveDocker = ""; ccLiveNetRx = ccLiveNetTx = 0; ccLiveNetOk = false; }
  // Unraid 7.3 moved CPU load to a GraphQL websocket, which a reverse proxy may fail to upgrade, so
  // the subscription never emits and the chip stays blank. Polling this plugin's own engine over
  // plain HTTP instead works on every page and through any proxy; the engine computes host CPU
  // percent from /proc/stat deltas, so the first reading is the baseline and the rest are live.
  function ccStartCpu() {
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php", stopped = false;
    function poll() {
      if (stopped || !ccLiveSubs) return;
      fetch(PROXY + "?path=" + encodeURIComponent("hostcpu"), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && typeof j.pct === "number") { var c = Math.round(j.pct) + "%"; if (c !== ccLiveCpu) { ccLiveCpu = c; ccIsland(); } } })
        .catch(function () {});
    }
    poll();
    var iv = setInterval(poll, 3000);
    if (ccLiveSubs) ccLiveSubs.push({ stop: function () { stopped = true; clearInterval(iv); } });
  }
  // The network rate comes from the engine's /api/hostnet, which sums the primary uplink's
  // cumulative byte counters, polled over plain HTTP like the CPU above. Successive readings become
  // a per-second rate; the first sample and a counter reset leave no rate to show yet.
  function ccStartNet() {
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php", stopped = false, prev = null;
    function poll() {
      if (stopped || !ccLiveSubs) return;
      fetch(PROXY + "?path=" + encodeURIComponent("hostnet"), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || typeof j.rx !== "number" || typeof j.tx !== "number") return;
          var now = Date.now();
          if (prev && now > prev.t && j.rx >= prev.rx && j.tx >= prev.tx) {
            var dt = (now - prev.t) / 1000, rx = (j.rx - prev.rx) / dt, tx = (j.tx - prev.tx) / dt;
            if (rx !== ccLiveNetRx || tx !== ccLiveNetTx || !ccLiveNetOk) { ccLiveNetRx = rx; ccLiveNetTx = tx; ccLiveNetOk = true; ccIsland(); }
          }
          prev = { rx: j.rx, tx: j.tx, t: now };
        })
        .catch(function () {});
    }
    poll();
    var iv = setInterval(poll, 3000);
    if (ccLiveSubs) ccLiveSubs.push({ stop: function () { stopped = true; clearInterval(iv); } });
  }
  // On /Main, compute the size-weighted array fill and cache it in cc.arrfill, so the island's fill
  // chip has a value on every page: 7.3.x dropped the cross-page menu usage bar.
  function ccArrFill() {
    try {
      if (!/^\/Main/.test(location.pathname)) return;
      var tbl = document.querySelector("table.disk_status");
      if (!tbl) { if (!ccArrFill._t) { ccArrFill._t = setTimeout(function () { ccArrFill._t = 0; ccArrFill(); }, 900); } return; }   // apply() can run before the array table is parsed
      var usedSum = 0, sizeSum = 0, n = 0;
      Array.prototype.forEach.call(tbl.querySelectorAll("tr"), function (row) {
        var sp = row.querySelector(".usage-disk span"); if (!sp) return;
        var w = parseFloat(sp.style.width || ""); if (isNaN(w)) return;
        var mm = (row.textContent || "").match(/(\d+(?:[.,]\d+)?)\s*(PB|TB|GB|MB)\b/i); if (!mm) return;   // the first size in the row is the size column
        var val = parseFloat(mm[1].replace(",", ".")), unit = mm[2].toUpperCase();
        var mult = unit === "PB" ? 1e15 : unit === "TB" ? 1e12 : unit === "GB" ? 1e9 : 1e6, bytes = val * mult;
        usedSum += bytes * w / 100; sizeSum += bytes; n++;
      });
      if (n > 0 && sizeSum > 0) { var pct = Math.round(usedSum / sizeSum * 100); if (pct >= 0 && pct <= 100) { var v = pct + "%"; if (g("cc.arrfill", "") !== v) { localStorage.setItem("cc.arrfill", v); ccIsland(); } } }
    } catch (e) {}
  }
  function ccIsland() {
    try {
      var isle = document.getElementById("cc-island");
      if (!ccIslandOn()) { if (isle && isle.parentNode) isle.parentNode.removeChild(isle); ccIslandSig = ""; ccStopLive(); return; }
      ccStartLive();
      if (ccIslDragged) return;   // a rebuild mid-drag would detach the dragged chip
      var hdr = document.getElementById("header"); if (!hdr) return;
      var foot = document.getElementById("footer"), sb = document.getElementById("statusbar");
      var raw = ((sb && sb.textContent) || "").replace(/^\s+|\s+$/g, "");
      var footTxt = (foot && foot.textContent) || "";
      // every temperature in the footer text, matched by value since the span markup varies by board
      var temps = [], tm, tre = /(\d+(?:[.,]\d+)?)\s*°\s*C/g;
      while ((tm = tre.exec(footTxt))) temps.push(parseFloat(tm[1].replace(",", ".")));
      var warn = parseFloat(g("cc.tempwarn", "60")); if (!isFinite(warn) || warn <= 0) warn = 60;
      // the parity progress text, which goes into the array chip's tooltip only
      var par = /parit[^•%]{0,120}?\d+(?:[.,]\d+)?\s*%/i.exec(footTxt);
      // The Connect profile's first row carries the uptime and the OS edition. Both spans stay in
      // the DOM, hidden by Header.css, and are only read here, never moved or edited. Without an
      // uptime span the chip is skipped.
      var up = document.querySelector("#UserProfile > div:first-child span.text-xs");
      var upTxt = ((up && up.textContent) || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      var upTitle = (up && up.getAttribute("title")) || "";
      var osSp = null, osRow = document.querySelector("#UserProfile > div:first-child");
      if (osRow) { var sps = osRow.querySelectorAll("span"); for (var oj = 0; oj < sps.length; oj++) { if (/Unraid\s*OS/i.test(sps[oj].textContent || "")) { osSp = sps[oj]; break; } } }
      // the span's textContent already carries the nested edition, so a missing one leaves the base name
      var osLabel = osSp ? (osSp.textContent || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "") : "Unraid OS";
      // The fill level prefers the menu usage bar, which older Unraid versions still carry, and
      // falls back to the value ccArrFill() caches while on /Main.
      var ub = document.querySelector("#menu .usage-bar > span");
      var usage = ub ? (ub.textContent || "").replace(/\s+/g, "").trim() : (g("cc.arrfill", "") || "");
      // The fill bar's width is the percentage and its colour carries the state, on the same
      // thresholds as the dots; text that is not a number leaves an empty grey track.
      var un = parseInt(usage, 10);
      var uw = isNaN(un) ? 0 : Math.max(0, Math.min(100, un));
      var uc = isNaN(un) ? "#8d8d8d" : un >= 95 ? "var(--cc-err, #ff8389)" : un >= 80 ? "var(--cc-warn, #ff832b)" : "var(--cc-ok, #6fdc8c)";
      // Each chip has its own cc.isl.<key> toggle, on by default, and the fixed render order below
      // keeps the layout the same from page to page.
      function iOn(k) { return g("cc.isl." + k, "1") !== "0"; }
      var netUnit = g("cc.isl.net.unit", "bit") === "byte" ? "byte" : "bit";
      var verNum = "";
      var verElN = document.querySelector('unraid-header-os-version span[id^="reka-menu-trigger"]');
      if (verElN) verNum = ((verElN.textContent) || "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      // /sub/dockerload carries the running containers only, so the total for the stopped count
      // comes from cc.stateCache, where docker.js keeps the full list.
      var dockRun = parseInt(ccLiveDocker, 10) || 0, dockTot = 0;
      try { var csD = JSON.parse(g("cc.stateCache", "null")); if (csD && csD.containers && csD.containers.length) dockTot = csD.containers.length; } catch (eD) {}
      var dockStop = dockTot > dockRun ? dockTot - dockRun : 0;
      var items = "u" + (iOn("uptime") ? 1 : 0) + "o" + (iOn("os") ? 1 : 0) + "v" + (iOn("version") ? 1 : 0) + "a" + (iOn("array") ? 1 : 0) + "f" + (iOn("fill") ? 1 : 0) + "r" + (iOn("ram") ? 1 : 0) + "c" + (iOn("cpu") ? 1 : 0) + "d" + (iOn("containers") ? 1 : 0) + "t" + (iOn("temps") ? 1 : 0) + "n" + (iOn("net") ? 1 : 0) + "|dt" + dockTot + "|nu" + netUnit;
      // nchan rewrites the footer every few seconds, mostly with the same text, so the rebuild is
      // skipped unless this signature changes. It covers the bar geometry and the chip toggles too.
      var sig = upTxt + "|" + upTitle + "|" + osLabel + "|" + verNum + "|" + raw + "|" + temps.join(",") + "|" + warn + "|" + usage + "|" + uw + uc + "|" + (par ? par[0] : "") + "|" + ccLiveRam + "/" + ccLiveRamUsed + "/" + ccLiveCpu + "/" + ccLiveDocker + "|net" + (ccLiveNetOk ? Math.round(ccLiveNetRx) + "/" + Math.round(ccLiveNetTx) : "") + "|" + items;
      if (isle && sig === ccIslandSig) return;
      ccIslandSig = sig;
      if (!isle) {
        isle = document.createElement("span"); isle.id = "cc-island";
        var prof = hdr.querySelector("unraid-user-profile");   // beside the web component, never inside it
        if (prof) hdr.insertBefore(isle, prof); else hdr.appendChild(isle);
      }
      while (isle.firstChild) isle.removeChild(isle.firstChild);
      // The chips live in three arrangeable rows. They are built into row 0, and ccIslandArrange()
      // then moves each into its saved row and position; a chip with no saved place stays here.
      // The data-cc-chip key is stable, so the saved order survives every rebuild.
      ccIslRows = [];
      for (var ir = 0; ir < 3; ir++) { var rw = document.createElement("span"); rw.className = "cc-isl-row"; rw.setAttribute("data-cc-row", ir); isle.appendChild(rw); ccIslRows.push(rw); }
      function chip(label, dot, tip, cls) {
        var c = document.createElement("span"); c.className = "cc-isl-chip" + (cls ? " " + cls : "");
        if (cls) c.setAttribute("data-cc-chip", cls.replace(/^cc-isl-/, ""));
        var d = document.createElement("span"); d.className = "cc-isl-dot";
        d.style.background = dot;   // the state colour inline, the size and shape from the sheet
        c.appendChild(d); c.appendChild(document.createTextNode(label));
        if (tip) c.setAttribute("data-cc-tip", tip);
        ccIslRows[0].appendChild(c);
      }
      // A bar chip for the fill, RAM and CPU readings. The lead label tells the three apart, since
      // the bars themselves look alike, and the tooltip carries the detail.
      function barChip(lead, pctText, tip, cls) {
        var n = parseInt(pctText, 10), w = isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
        var col = isNaN(n) ? "#8d8d8d" : n >= 95 ? "var(--cc-err, #ff8389)" : n >= 80 ? "var(--cc-warn, #ff832b)" : "var(--cc-ok, #6fdc8c)";
        var uch = document.createElement("span"); uch.className = "cc-isl-chip cc-isl-usage" + (cls ? " " + cls : "");
        if (lead) { var lb = document.createElement("span"); lb.className = "cc-isl-lead"; lb.textContent = lead; uch.appendChild(lb); }
        var ubar = document.createElement("span"); ubar.className = "cc-isl-bar";
        var ufill = document.createElement("span"); ufill.className = "cc-isl-fill";
        ufill.style.width = w + "%"; ufill.style.background = col;
        ubar.appendChild(ufill); uch.appendChild(ubar); uch.appendChild(document.createTextNode(pctText));
        if (tip) uch.setAttribute("data-cc-tip", tip);
        if (cls) uch.setAttribute("data-cc-chip", cls.replace(/^cc-isl-/, ""));
        ccIslRows[0].appendChild(uch);
      }
      // The render order is fixed, and every tooltip carries information the chip itself does not.
      var arrSeg = (raw ? raw.split("•")[0] : "").replace(/^\s+|\s+$/g, "");   // the first bullet segment is the array state
      // uptime, with the boot timestamp in the bubble
      if (iOn("uptime") && upTxt) {
        var upClean = upTxt.replace(/^(Betriebszeit|Uptime)\s*/i, "");
        chip(upClean, "var(--cc-ok, #6fdc8c)", upTitle || (T("Läuft seit ", "Up since ") + upClean), "cc-isl-up");
      }
      // the OS edition, with the running version in the bubble
      if (iOn("os")) {
        chip(osLabel, "#8d8d8d", T("Version ", "Version ") + (verNum || "?"), "cc-isl-os");
      }
      // The sheet hides the native floating version chip, so its number joins the island and every
      // chip aligns in the same rows. It only displays; the OS update stays under Tools.
      if (iOn("version") && verNum) {
        chip(verNum, "#8d8d8d", T("Unraid-Version ", "Unraid version ") + verNum, "cc-isl-ver");
      }
      // the array state, with the parity progress in the bubble while a check runs
      if (iOn("array") && arrSeg) {
        var low = arrSeg.toLowerCase(), dc = "var(--cc-warn, #ff832b)";
        if (low.indexOf("gestartet") !== -1 || low.indexOf("started") !== -1) dc = "var(--cc-ok, #6fdc8c)";
        else if (low.indexOf("gestoppt") !== -1 || low.indexOf("stopped") !== -1) dc = "var(--cc-err, #ff8389)";
        chip(arrSeg, dc, par ? arrSeg + ", " + par[0].replace(/\s+/g, " ") : arrSeg, "cc-isl-array");
      }
      // The fill chip shows a placeholder while its source is empty, so an enabled toggle always
      // produces a visible chip; on 7.3.x the value needs a visit to /Main first, which the
      // tooltip says.
      if (iOn("fill")) barChip(T("Array", "Array"), usage || "--", usage ? T("Array zu " + usage + " belegt", "Array " + usage + " used") : T("Array-Füllstand, auf der Startseite messbar", "Array fill, measured on the Main page"), "cc-isl-array-fill");
      if (iOn("ram") && ccLiveRam) barChip("RAM", ccLiveRam, T("RAM zu " + ccLiveRam + " belegt" + (ccLiveRamUsed ? " (" + ccLiveRamUsed + ")" : ""), "RAM " + ccLiveRam + " used" + (ccLiveRamUsed ? " (" + ccLiveRamUsed + ")" : "")), "cc-isl-ram");
      if (iOn("cpu")) barChip("CPU", ccLiveCpu || "--", ccLiveCpu ? T("CPU-Last " + ccLiveCpu, "CPU load " + ccLiveCpu) : T("CPU-Last derzeit nicht verfügbar", "CPU load currently unavailable"), "cc-isl-cpu");
      if (iOn("containers") && (ccLiveDocker || dockTot)) chip((ccLiveDocker || "0") + (dockTot ? " / " + dockStop : ""), "var(--cc-ok, #6fdc8c)", T(dockRun + " laufend" + (dockTot ? ", " + dockStop + " gestoppt (von " + dockTot + ")" : ""), dockRun + " running" + (dockTot ? ", " + dockStop + " stopped (of " + dockTot + ")" : "")), "cc-isl-docker");
      // One chip with a receive and a send segment, fed by ccStartNet(). A click flips the unit
      // between bit and byte, handled in the island's click delegate.
      if (iOn("net")) {
        var fmtRate = function (bps) {
          if (!ccLiveNetOk || !isFinite(bps) || bps < 0) return "--";
          var v = netUnit === "bit" ? bps * 8 : bps, base = netUnit === "bit" ? 1000 : 1024;
          var u = netUnit === "bit" ? ["bit/s", "Kbit/s", "Mbit/s", "Gbit/s"] : ["B/s", "KB/s", "MB/s", "GB/s"], i = 0;
          while (v >= base && i < u.length - 1) { v /= base; i++; }
          return (i === 0 || v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + " " + u[i];
        };
        var nc = document.createElement("span"); nc.className = "cc-isl-chip cc-isl-net"; nc.setAttribute("data-cc-chip", "net");
        nc.setAttribute("data-cc-tip", T("Netzwerk-Traffic, Klick wechselt Bit/Byte", "Network traffic, click switches bit/byte"));
        var segD = document.createElement("span"); segD.className = "cc-isl-net-seg"; segD.textContent = "↓ " + fmtRate(ccLiveNetRx);
        var segU = document.createElement("span"); segU.className = "cc-isl-net-seg"; segU.textContent = "↑ " + fmtRate(ccLiveNetTx);
        nc.appendChild(segD); nc.appendChild(segU); ccIslRows[0].appendChild(nc);
      }
      // In the footer's order the first sensor is the CPU and the second the mainboard; the rest
      // stay generic. The dot carries the state against cc.tempwarn.
      if (iOn("temps")) {
        for (var i = 0; i < temps.length; i++) {
          var tlab = i === 0 ? T("CPU-Temperatur", "CPU temperature") : i === 1 ? T("Mainboard-Temperatur", "Motherboard temperature") : T("Temperatur", "Temperature");
          chip(Math.round(temps[i]) + " °C", temps[i] >= warn + 15 ? "var(--cc-err, #ff8389)" : temps[i] >= warn ? "var(--cc-warn, #ff832b)" : "var(--cc-ok, #6fdc8c)", tlab + ": " + temps[i] + " °C", "cc-isl-temp" + i);
        }
      }
      // The per-service segments stay in the hidden native footer rather than on a chip.
      ccIslandArrange(); ccWireIslandDrag(); ccIslandStrip();
    } catch (e) {}
  }
  // A chip can be dragged to any row and position. The layout is persisted as cc.isl.order, three
  // lists of chip keys, and re-applied on every island rebuild, as the main menu's nav drag does.
  function ccIslKey(el) { return el && el.getAttribute ? el.getAttribute("data-cc-chip") : null; }
  function ccIslandOrderRead() { try { var o = JSON.parse(g("cc.isl.order", "null")); if (o && o.length === 3) return o; } catch (e) {} return null; }
  function ccIslandSaveOrder() {
    try {
      if (!ccIslRows) return;
      var o = [[], [], []];
      for (var r = 0; r < 3; r++) { var ch = ccIslRows[r].querySelectorAll(":scope > .cc-isl-chip"); for (var i = 0; i < ch.length; i++) { var k = ccIslKey(ch[i]); if (k) o[r].push(k); } }
      localStorage.setItem("cc.isl.order", JSON.stringify(o));
    } catch (e) {}
  }
  function ccIslandArrange() {
    try {
      if (!ccIslRows) return;
      var order = ccIslandOrderRead();
      if (!order) {
        // Without a saved arrangement, spread the chips evenly across the three rows: the rows run
        // the full header width, so leaving them all in row 0 would stretch the island into one
        // long line.
        var chips0 = ccIslRows[0].querySelectorAll(":scope > .cc-isl-chip"), n = chips0.length;
        if (n) { var per = Math.ceil(n / 3); for (var d = 0; d < n; d++) { var rr = Math.min(2, Math.floor(d / per)); if (rr > 0) ccIslRows[rr].appendChild(chips0[d]); } }
        return;
      }
      var byKey = {}, all = ccIslRows[0].querySelectorAll(":scope > .cc-isl-chip");
      for (var i = 0; i < all.length; i++) { var k = ccIslKey(all[i]); if (k && !byKey[k]) byKey[k] = all[i]; }
      for (var r = 0; r < 3; r++) { var list = order[r] || []; for (var j = 0; j < list.length; j++) { var el = byKey[list[j]]; if (el) { ccIslRows[r].appendChild(el); delete byKey[list[j]]; } } }
    } catch (e) {}   // a chip in no saved list stays in row 0
  }
  function ccIslandDropTarget(x, y) {
    if (!ccIslRows) return null;
    var row = null, best = 1e9;
    for (var r = 0; r < 3; r++) { var rr = ccIslRows[r].getBoundingClientRect(); if (rr.height && y >= rr.top - 8 && y <= rr.bottom + 8) { row = ccIslRows[r]; break; } var mid = rr.height ? (rr.top + rr.bottom) / 2 : ccIslRows[0].getBoundingClientRect().top; var d = Math.abs(y - mid); if (d < best) { best = d; row = ccIslRows[r]; } }
    if (!row) row = ccIslRows[0];
    var chips = row.querySelectorAll(":scope > .cc-isl-chip"), before = null;
    for (var i = 0; i < chips.length; i++) { if (chips[i] === ccIslDragged) continue; var cr = chips[i].getBoundingClientRect(); if (x < cr.left + cr.width / 2) { before = chips[i]; break; } }
    return { row: row, before: before };
  }
  function ccWireIslandDrag() {
    try {
      if (!ccIslRows) return;
      var chips = document.querySelectorAll("#cc-island .cc-isl-chip");
      for (var i = 0; i < chips.length; i++) {
        (function (c) {
          if (c.getAttribute("data-cc-idrag") === "1") return; c.setAttribute("data-cc-idrag", "1");
          c.addEventListener("pointerdown", function (e) {
            if (e.button !== 0) return;
            if (!document.documentElement.classList.contains("cc-arrange")) return;   // locked, so the click navigates instead
            ccIslPressXY = { x: e.clientX, y: e.clientY }; ccIslPressPtr = e.pointerId; ccIslMoved = false;
            ccIslDragged = c; c.classList.add("cc-isl-dragging");
            var isle = document.getElementById("cc-island"); if (isle) isle.classList.add("cc-isl-arranging");
            try { c.setPointerCapture(ccIslPressPtr); } catch (e2) {}
            e.preventDefault();
          });
        })(chips[i]);
      }
      if (!ccIslDragBound) {
        ccIslDragBound = true;
        document.addEventListener("pointermove", function (e) {
          if (ccIslPressXY && !ccIslDragged) { if (Math.abs(e.clientX - ccIslPressXY.x) > 8 || Math.abs(e.clientY - ccIslPressXY.y) > 8) { clearTimeout(ccIslHold); ccIslHold = null; ccIslPressXY = null; } return; }
          if (!ccIslDragged) return;
          ccIslMoved = true;
          var t = ccIslandDropTarget(e.clientX, e.clientY);
          if (t && t.row) { if (t.before) t.row.insertBefore(ccIslDragged, t.before); else t.row.appendChild(ccIslDragged); }
        });
        var up = function () {
          clearTimeout(ccIslHold); ccIslHold = null; ccIslPressXY = null;
          if (ccIslDragged) { try { ccIslDragged.releasePointerCapture(ccIslPressPtr); } catch (e) {} ccIslDragged.classList.remove("cc-isl-dragging"); var isle = document.getElementById("cc-island"); if (isle) isle.classList.remove("cc-isl-arranging"); if (ccIslMoved) { ccIslandSaveOrder(); ccIslSuppressClick = true; } ccIslDragged = null; }
        };
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
        // a chip click jumps to its page, except for the click that follows a drag
        document.addEventListener("click", function (e) {
          var chip = e.target && e.target.closest ? e.target.closest("#cc-island .cc-isl-chip") : null;
          if (!chip) return;
          if (ccIslSuppressClick) { ccIslSuppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
          var key = ccIslKey(chip);
          // the net chip is a unit toggle rather than a nav target
          if (key === "net") { localStorage.setItem("cc.isl.net.unit", g("cc.isl.net.unit", "bit") === "bit" ? "byte" : "bit"); ccIslandSig = ""; ccIsland(); e.preventDefault(); e.stopPropagation(); return; }
          var url = key ? (CC_ISL_NAV[key] || (/^temp/.test(key) ? "/Dashboard" : null)) : null;
          if (url) location.href = url;
        }, true);
      }
    } catch (e) {}
  }
  // With cc.statenative on, the /Main usage bars carry their fill level as a colour, on the same
  // thresholds as the island's fill chip; with it off they follow the colour mode through the CSS.
  // Unraid 7.3.x stamps no bar classes of its own, so this assigns cc-fill-* classes that the
  // sheet colours rather than writing inline, which keeps the native table re-render from
  // flickering. Both bars of a row take the used percentage, so a nearly empty disk, whose free bar
  // fills the track, stays green instead of turning red.
  function ccStateBars() {
    try {
      var on = g("cc.statenative", "0") === "1" && g("cc.theming", "1") !== "0";
      var allBars = document.querySelectorAll(".usage-disk:not(.sys):not(.mm) > span:first-child");
      // The two usage bars tall enough to slosh at their end: the 26px /Main bars while the Shares
      // area restyles them, and the array meter in the menu while the header area is on.
      var rt = document.documentElement.classList, CT = window.CCTheme;
      if (CT && CT.slosh) {
        var mainOn = rt.contains("cc-shares-on") && rt.contains("cc-on-main");
        var meter = document.querySelector("#menu .usage-bar > span");
        var highs = Array.prototype.map.call(allBars, function (b) { return b.getBoundingClientRect().height; });
        var meterHigh = meter ? meter.getBoundingClientRect().height : 0;
        for (var s = 0; s < allBars.length; s++) CT.slosh(allBars[s], mainOn && !!allBars[s].closest("#displaybox"), highs[s]);
        if (meter) CT.slosh(meter, rt.contains("cc-header-on"), meterHigh);
      }
      if (!on) {   // strip any leftover class so the colour mode shows through
        for (var i = 0; i < allBars.length; i++) { var b = allBars[i]; if (b.style.background) b.style.removeProperty("background"); if (b.className && b.className.indexOf("cc-fill-") >= 0) b.className = b.className.replace(/\s*cc-fill-(green|amber|red)\b/g, ""); }
        return;
      }
      var trs = document.querySelectorAll("table.unraid.disk_status tr");
      for (var t = 0; t < trs.length; t++) {
        var bars = trs[t].querySelectorAll(".usage-disk:not(.sys):not(.mm) > span:first-child");
        if (!bars.length) continue;
        var usedW = parseFloat(bars[0].style.width) || 0;   // the first bar in the row is the used one
        var cls = usedW >= 95 ? "cc-fill-red" : usedW >= 80 ? "cc-fill-amber" : "cc-fill-green";
        for (var k = 0; k < bars.length; k++) { if (!bars[k].classList.contains(cls)) { bars[k].classList.remove("cc-fill-green", "cc-fill-amber", "cc-fill-red"); bars[k].classList.add(cls); } }
      }
    } catch (e) {}
  }
  // The account popover mounts fresh on every open, so it is tagged for the CC sheet, and any plain
  // description item, one with no icon or link, folds onto an info bubble on the item above it.
  function ccAcctMenu() {
    try {
      // The bubble opens on a click as well as on hover, so a document-capture handler toggles a
      // pinned copy: the same icon again, or a click anywhere outside, dismisses it.
      // stopPropagation keeps the reka menu open and stops the row from navigating.
      if (!document.__ccAcctInfoBound) {
        document.__ccAcctInfoBound = true;
        document.addEventListener("click", function (e) {
          var icon = e.target && e.target.closest ? e.target.closest(".cc-acctinfo") : null;
          var pop = document.getElementById("cc-acctinfo-pop");
          if (icon) {
            e.preventDefault(); e.stopPropagation();
            var same = pop && pop.getAttribute("data-src") === (icon.getAttribute("data-cc-info") || "");
            if (pop) pop.remove();
            if (same) return;                                             // a second click on the same icon closes it
            pop = document.createElement("div"); pop.id = "cc-acctinfo-pop";
            pop.textContent = icon.getAttribute("data-cc-info") || "";
            pop.setAttribute("data-src", icon.getAttribute("data-cc-info") || "");
            document.body.appendChild(pop);
            var r = icon.getBoundingClientRect(), w = pop.offsetWidth, vw = window.innerWidth || document.documentElement.clientWidth, m = window.CCTheme.edge();
            pop.style.left = Math.max(m, Math.min(vw - m - w, r.left + r.width / 2 - w / 2)) + "px";
            pop.style.top = (r.bottom + 8) + "px";
            return;
          }
          if (pop && !(e.target.closest && e.target.closest("#cc-acctinfo-pop"))) pop.remove();   // click elsewhere dismisses
        }, true);
      }
      var menus = document.querySelectorAll('div[role="menu"].bg-popover');
      for (var m = 0; m < menus.length; m++) {
        var menu = menus[m];
        menu.classList.add("cc-acctmenu");
        ccAcctTools(menu);
        if (menu.getAttribute("data-cc-acct") === "1") continue;
        menu.setAttribute("data-cc-acct", "1");
        // The menu brings no close control of its own, unlike the notification drawer, so it gets
        // the square badge in the corner that every CC window has. Escape is what reka closes on.
        var mx = window.CCTheme.pressable(document.createElement("span"));
        mx.className = "cc-acct-x"; mx.innerHTML = window.CCTheme.glyph("Close");
        mx.setAttribute("aria-label", T("Schließen", "Close")); mx.setAttribute("data-cc-tip", T("Schließen", "Close"));
        mx.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
        });
        menu.insertBefore(mx, menu.firstChild);
        // The strip the close badge sits on carries the title, as every CC window does.
        var mt = document.createElement("span");
        mt.className = "cc-acct-title"; mt.textContent = T("Konto", "Account");
        menu.insertBefore(mt, menu.firstChild);
        var lis = menu.querySelectorAll("li");
        for (var i = 0; i < lis.length; i++) {
          var li = lis[i];
          if (li.querySelector("svg, a, button, input")) continue;         // an action row, not a description
          var txt = (li.textContent || "").trim();
          if (txt.length < 12) continue;                                    // too short to be a description
          var prev = li.previousElementSibling;
          var host = prev ? (prev.querySelector("span, a") || prev) : null;
          if (host && !host.querySelector(".cc-acctinfo")) {
            var ic = document.createElement("span");
            ic.className = "cc-acctinfo"; ic.innerHTML = window.CCTheme.CC_INFO_SVG;
            ic.setAttribute("role", "button"); ic.tabIndex = 0; ic.setAttribute("aria-label", txt);
            ic.setAttribute("data-cc-info", txt);                          // the text the pinned bubble shows
            // data-cc-tip rides the same hover engine every other CC icon uses, so the text
            // previews on hover while the click handler still pins a copy for touch and keyboard.
            ic.setAttribute("data-cc-tip", txt);
            host.appendChild(ic);
            li.style.display = "none";
          }
        }
      }
    } catch (e) {}
  }
  // On a phone the burger's menu opens with a row of the utility icons the menu bar leaves out.
  // Each copy presses its hidden original, so whatever Unraid or a plugin wired to that icon runs
  // unchanged. An icon the person switched off stays computed display:none and gets no copy.
  function ccAcctTools(menu) {
    var trig = document.querySelector('[data-cc-trig="burger"]');
    if (!ccIsPhone() || !trig || menu.getAttribute("aria-labelledby") !== trig.id || menu.querySelector(".cc-acct-tools")) return;
    var row = document.createElement("div"); row.className = "cc-acct-tools";
    var items = document.querySelectorAll("#menu .nav-tile.right > .nav-item.util:not(.cc-iconproxy)");
    for (var i = 0; i < items.length; i++) {
      var a = items[i].querySelector(":scope > a");
      if (!a || getComputedStyle(items[i]).display === "none") continue;
      var name = a.getAttribute("data-cc-tip") || a.getAttribute("title") || (a.textContent || "").trim();
      var b = window.CCTheme.pressable(document.createElement("span"));
      b.className = "cc-acct-tool"; b.setAttribute("aria-label", name); b.setAttribute("data-cc-tip", name);
      // the icon's own palette slot for the hover, without the inline glyph colour paintNav forces
      ["--cc-rb-c", "--cc-rb-ct"].forEach(function (v) { var c = a.style.getPropertyValue(v); if (c) b.style.setProperty(v, c); });
      var glyph = a.querySelector("b, img, svg");
      if (glyph) { glyph = glyph.cloneNode(true); glyph.removeAttribute("style"); b.appendChild(glyph); }
      b.addEventListener("click", (function (orig) {
        return function (e) {
          e.preventDefault(); e.stopPropagation();
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
          // reka hands the focus back to the burger at the end of the close animation, which
          // would blur the field gui_search() focuses, and gui_search closes on that blur. So the
          // original is pressed once the menu has left the page.
          var tries = 0;
          (function press() {
            if (menu.isConnected && ++tries < 40) { setTimeout(press, 50); return; }
            orig.click();
          })();
        };
      })(a));
      row.appendChild(b);
    }
    if (row.children.length) menu.insertBefore(row, menu.querySelector(":scope > div"));
  }
  // In rainbow mode two controls next to each other take different palette slots rather than one
  // shared colour. Each themed native button gets a slot rotated within its own row, each toggle
  // one rotated across the page. The CSS reads var(--cc-rb-c, var(--cc-rbaccent, <accent>)), so a
  // control that never gets a stamp still falls back to the one accent.
  function ccPaintRotate() {
    try {
      var on = g("cc.theming", "1") !== "0" && rbOn();
      // in the neutral sub-mode the dropdown options rest grey and show their colour on hover
      document.documentElement.classList.toggle("cc-tools-rbneutral", on && rbNeutral());
      var stamp = function (el, ix) { var c = rbColor(ix); el.style.setProperty("--cc-rb-c", c, "important"); el.style.setProperty("--cc-rb-ct", idealText(c), "important"); };
      var clear = function (el) { el.style.removeProperty("--cc-rb-c"); el.style.removeProperty("--cc-rb-ct"); };
      var BSEL = "html.cc-tools-on #displaybox input[type=button], html.cc-tools-on #displaybox input[type=submit], html.cc-tools-on #displaybox button:not([role=tab]):not(.cc-tgl), html.cc-tools-on #displaybox a.button, html.cc-shares-on #displaybox #compute-shares, html.cc-shares-on #displaybox #compute-disks, html.cc-shares-on #displaybox #cleanup-button, html.cc-shares-on #displaybox form[name=\"share_form\"] input[type=submit], html.cc-vms-on #displaybox input[type=button]:not(.cc-actbtn), html.cc-vms-on #displaybox input[type=submit]:not(.cc-actbtn)";
      var btns = document.querySelectorAll(BSEL);
      if (!on) { for (var i0 = 0; i0 < btns.length; i0++) clear(btns[i0]); }
      else {
        // Group by visual row, rounding the top offset, so buttons sitting next to each other
        // rotate through the palette even when they live in different DOM parents.
        var rows = {};
        for (var i = 0; i < btns.length; i++) { var rct = btns[i].getBoundingClientRect(); if (!rct.width) { clear(btns[i]); continue; } var key = Math.round(rct.top / 6); if (rows[key] == null) rows[key] = 0; stamp(btns[i], rows[key]++); }
      }
      // The toggles and dropdowns on the tools and settings pages rotate across the page, so no two
      // read the same colour; the dropdown's box and selected chip inherit --cc-rb-c from the
      // .cc-tsel wrapper. cc-popups-on is listed beside cc-tools-on, or a .cc-tsel outside the
      // Tools area would never be stamped at all.
      var tgls = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tgl, html.cc-tools-on #displaybox .switch-button-background, html.cc-tools-on #displaybox .cc-tsel, html.cc-tools-on #displaybox .ui-dropdownchecklist-selector-wrapper, html.cc-diskpage #displaybox h3.section-header, html.cc-popups-on #displaybox .cc-tsel");
      for (var t = 0; t < tgls.length; t++) { if (!on) clear(tgls[t]); else stamp(tgls[t], t); }
      // Each dropdown option gets its own slot, rotated within its panel, so an open list reads as
      // a run of colours while the trigger rests neutral until hover. Covers the CC overlay
      // dropdown and the jQuery dropdownchecklist.
      var panels = document.querySelectorAll("html.cc-tools-on #displaybox .cc-tsel-panel, html.cc-tools-on #displaybox .ui-dropdownchecklist-dropcontainer, html.cc-popups-on #displaybox .cc-tsel-panel");
      for (var pn = 0; pn < panels.length; pn++) { var opts = panels[pn].querySelectorAll(".cc-tsel-opt, .ui-dropdownchecklist-item"); for (var oi = 0; oi < opts.length; oi++) { if (!on) clear(opts[oi]); else stamp(opts[oi], oi); } }
      // The notification drawer's badges rotate as well: tabs, type filters, gear, the bulk action
      // icons and the per-card buttons.
      var nd = document.querySelector(".unapi div.fixed.z-50.bg-background");
      if (nd) {
        var ndb = nd.querySelectorAll('[role="tab"], [role="button"][aria-pressed]:not(.cc-notif-badge), .shrink-0 > a[href*="Notification"], .cc-notif-arch, .cc-notif-del, [class~="group/item"] a[class*="text-primary"], [class~="group/item"] span[class*="rounded-md"][class*="inline-flex"]');
        for (var di = 0; di < ndb.length; di++) { if (!on) clear(ndb[di]); else stamp(ndb[di], di); }
      }
      // one slot per table row on the disk pages, so each reveals its own hover colour
      var dtr = document.querySelectorAll("html.cc-diskpage #displaybox table.unraid tbody tr");
      for (var dr2 = 0; dr2 < dtr.length; dr2++) { if (!on) clear(dtr[dr2]); else stamp(dtr[dr2], dr2); }
      // the clickable kernel-argument chips on the boot-parameters page, like the action buttons
      var pcodes = document.querySelectorAll("html.cc-diskpage #displaybox .parameter-code");
      for (var pc = 0; pc < pcodes.length; pc++) { if (!on) clear(pcodes[pc]); else stamp(pcodes[pc], pc); }
      // the account popover items, so each reveals its own colour on hover
      var amItems = document.querySelectorAll('div[role="menu"].bg-popover li > span, div[role="menu"].bg-popover li > a');
      for (var am = 0; am < amItems.length; am++) { if (!on) clear(amItems[am]); else stamp(amItems[am], am); }
    } catch (e) {}
  }
  // Unraid builds the SMB dropdownchecklist widgets while their tab is still hidden, so the jQuery
  // plugin sizes the drop panel from a zero-width selector and the list never opens. Once the tab
  // is visible, each widget is destroyed and rebuilt once so it measures the real selector.
  function ccFixSmbDcl() {
    try {
      var jq = window.jQuery; if (!jq || !jq.fn || typeof jq.fn.dropdownchecklist !== "function") return;
      var ws = document.querySelectorAll('#displaybox span.ui-dropdownchecklist[id^="ddcl-"]');
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i];
        if (w.getAttribute("data-cc-dclfixed") === "1") continue;
        var selr = w.querySelector(".ui-dropdownchecklist-selector");
        if (!selr || selr.getBoundingClientRect().width < 5) continue;   // only once the tab is really on screen
        var selId = w.id.replace(/^ddcl-/, ""), selEl = document.getElementById(selId); if (!selEl) continue;
        var empty = (selr.textContent || "").trim() || "...", wdt = Math.max(110, Math.round(selr.getBoundingClientRect().width));
        var $sel = jq(selEl);
        try { $sel.dropdownchecklist("destroy"); } catch (e1) {}
        try { $sel.dropdownchecklist({ emptyText: empty, firstItemChecksAll: true, explicitClose: T("Schließen", "Close"), width: wdt }); } catch (e2) {}
        var nw = document.getElementById("ddcl-" + selId); if (nw) nw.setAttribute("data-cc-dclfixed", "1");
      }
    } catch (e) {}
  }
  // The /Main disk tables, the settings forms and the button rows are rendered after apply() has
  // run, so a one-shot paint misses them. This watches #displaybox for childList changes only, so
  // the inline style writes never re-trigger it, and re-runs the paints debounced.
  var ccMainObs = null, ccMainT = null, ccTabPaintBound = false;
  function ccWatchMain() {
    try {
      if (ccMainObs) return;
      var box = document.getElementById("displaybox"); if (!box) return;
      ccMainObs = new MutationObserver(function (recs) {
        // The work below matters only on /Main's disk table or a settings form, but the observer is
        // armed on every page, where the Docker and VM tabs' own per-row churn would wake it
        // hundreds of times per refresh. Bail before touching a single record.
        if (!document.querySelector("table.unraid.disk_status") && !document.documentElement.classList.contains("cc-tools-on")) return;
        // Unraid replaces the whole /Main disk table on every nchan tick, so the fresh bars would
        // show the base colour until the debounced pass re-classes them, which reads as a blink.
        // This callback is a microtask that runs after the .html() call but before the next paint,
        // so re-classing here puts the class on the new bars before they ever paint. ccStateBars
        // inserts no nodes of its own, so its pass cannot wake the observer again.
        for (var i = 0; i < recs.length; i++) { var t2 = recs[i].target; if (t2 && t2.closest && t2.closest("table.unraid.disk_status")) { try { ccStateBars(); } catch (e3) {} break; } }
        if (ccMainT) return; ccMainT = setTimeout(function () { ccMainT = null; try { ccStateBars(); ccPaintRotate(); ccToolsEnhance(); } catch (e2) {} }, 120);
      });
      ccMainObs.observe(box, { childList: true, subtree: true });
      // A reka sub-tab switch only toggles display, an attribute change the observer above ignores
      // to avoid a paint loop, so the freshly shown panel's controls would never get their palette
      // slot. Re-run the paints shortly after any sub-tab click.
      if (!ccTabPaintBound) {
        ccTabPaintBound = true;
        document.addEventListener("click", function (e) {
          var t = e.target && e.target.closest ? e.target.closest('#displaybox nav.tabs button[role="tab"], #displaybox .tabs-container button[role="tab"]') : null;
          if (t) {
            setTimeout(function () { try { ccPaintRotate(); ccToolsEnhance(); ccFixSmbDcl(); } catch (er) {} }, 70);
            setTimeout(function () { try { ccFixSmbDcl(); } catch (er2) {} }, 400);   // again once the tab is fully on screen
          }
        }, true);
      }
    } catch (e) {}
  }
  // Unraid's Display Settings help strings are server-rendered, and its German language pack leaves
  // several of them in English. This map is keyed on the whitespace-normalised English text and is
  // applied only on a German UI; a string it does not carry keeps the server's text.
  var CC_HELP_DE = {
    "Boxed is the legacy setting which constrains the content width to maximum 1920 pixels Unlimited allows content to use all available width, which maybe useful on wide screens":
      "Boxed ist die alte Einstellung, die die Inhaltsbreite auf maximal 1920 Pixel begrenzt. Unlimited erlaubt dem Inhalt, die gesamte verfügbare Breite zu nutzen, was auf breiten Bildschirmen nützlich sein kann.",
    "Changes the font size of terminal windows.":
      "Ändert die Schriftgröße von Terminalfenstern.",
    "Changes how certain pages are displayed. In Tabbed mode different sections will be displayed in different tabs, while in Non-tabbed mode sections are displayed under each other.":
      "Ändert, wie bestimmte Seiten dargestellt werden. Im Reiter-Modus werden verschiedene Abschnitte in verschiedenen Reitern angezeigt, im Nicht-Reiter-Modus untereinander.",
    "The Users Menu can be part of the header or part of the Settings menu. You can move the Users Menu if insufficient space in the header is available to display all menus.":
      "Das Benutzermenü kann Teil der Kopfzeile oder des Einstellungsmenüs sein. Du kannst das Benutzermenü verschieben, wenn in der Kopfzeile nicht genug Platz für alle Menüs ist.",
    "Automatic : long listings are displayed as is, and the user needs to scroll the whole page to see the bottom Fixed : long listings are displayed in a window with a fixed size, user can scroll this window to see the bottom":
      "Automatisch: Lange Listen werden vollständig angezeigt, man muss die ganze Seite scrollen, um das Ende zu sehen. Fest: Lange Listen erscheinen in einem Fenster fester Größe, das man separat scrollen kann.",
    "Enables favorite support. If set to no, will stop heart icon showing for additions. If existing favorites are saved, favorites tab and pre-saved options will still continue to show and function until all are deleted.":
      "Aktiviert Favoriten. Bei „Nein\" wird das Herz-Symbol nicht mehr angezeigt. Bereits gespeicherte Favoriten und der Favoriten-Reiter bleiben sichtbar und funktionsfähig, bis alle gelöscht sind."
  };
  function ccTransHelp(txt) {
    try { if (LANG !== "de") return txt; var k = (txt || "").replace(/\s+/g, " ").trim(); return CC_HELP_DE[k] || txt; } catch (e) { return txt; }
  }
  // The last text node of a settings label, wherever its markup nests it, leaving out an (i).
  function ccLabelText(dt) {
    var w = document.createTreeWalker(dt, NodeFilter.SHOW_TEXT), n, last = null;
    while ((n = w.nextNode())) { if (n.nodeValue.trim() && !(n.parentElement && n.parentElement.closest(".cc-toolsinfo"))) last = n; }
    return last;
  }
  // A help block after a list of several rows explains the last labelled one, which is also where
  // Unraid puts its help cursor; the rows above it are other settings.
  function ccHelpOwner(dl) {
    var dts = dl.querySelectorAll(":scope > dt");
    for (var i = dts.length - 1; i >= 0; i--) { if (ccLabelText(dts[i])) return dts[i]; }
    return dts[0] || null;
  }
  // Bubble texts for settings Unraid and two plugins ship without help, keyed by the field's name,
  // so they hold in every language. A path before the name limits a generic name to its page. A
  // third entry is the German label for a plugin page that has no translation of its own.
  var NTP_SRV = ["Name oder Adresse eines Zeitservers, etwa pool.ntp.org. Die weiteren springen ein, wenn einer nicht antwortet.", "Name or address of a time server, such as pool.ntp.org. The others step in when one does not answer."];
  var PTP_SRV = ["Adresse einer PTP-Uhr im Netz. Nur im Modus Unicast nötig.", "Address of a PTP clock on the network. Only needed in Unicast mode."];
  var AMD_UNIT = ["Zeigt, wie stark dieser Baustein einer AMD-Karte arbeitet, so wie radeontop es meldet.", "Shows how busy this part of an AMD card is, as radeontop reports it."];
  var CC_ROW_HELP = {
    diskSpindownDelay: ["Wie lange der Datenträger ohne Zugriff läuft, bevor er sich abschaltet. „Standard verwenden“ nimmt den Wert aus den Datenträger-Einstellungen.", "How long the disk keeps spinning without access before it spins down. “Use default” takes the value from Disk Settings."],
    diskFsProfile: ["Wie ein Pool seine Daten auf die Datenträger verteilt, etwa gespiegelt oder verteilt.", "How a pool spreads its data across its disks, for example mirrored or striped."],
    diskCompression: ["Komprimiert neue Daten beim Schreiben. Das spart Platz und kostet etwas Rechenzeit.", "Compresses new data as it is written. This saves space and costs a little CPU time."],
    diskAutotrim: ["Meldet einer SSD laufend, welche Blöcke frei sind, damit sie schnell bleibt.", "Keeps telling an SSD which blocks are free, so it stays fast."],
    zfs_arc_mode: ["Wie viel Arbeitsspeicher ZFS höchstens als Lesecache nutzen darf. Unbegrenzt gibt den Speicher wieder frei, wenn andere ihn brauchen.", "The most memory ZFS may use as its read cache. Unlimited gives the memory back when something else needs it."],
    zfs_arc_max_custom: ["Die Obergrenze für den ZFS-Lesecache in GB, wenn darüber ein eigener Wert gewählt ist.", "The cap for the ZFS read cache in GB, when a custom value is chosen above."],
    display_power: ["Zeigt bei NVMe-Laufwerken an, wie viel Strom sie gerade brauchen.", "Shows how much power NVMe drives draw right now."],
    "/Settings/Notifications language_update": ["Wie oft Unraid nach neuen Übersetzungen der Oberfläche sucht und dich darauf hinweist.", "How often Unraid looks for new translations of the interface and tells you about them."],
    "/Settings/Notifications AuthUser": ["Der Benutzername für den Mailserver, meist deine E-Mail-Adresse.", "The user name for the mail server, usually your email address."],
    "/Settings/Notifications Enabled": ["Schaltet diesen Benachrichtigungsdienst ein oder aus.", "Turns this notification service on or off."],
    "/Settings/DateTime display_date": ["Wie Unraid ein Datum schreibt.", "How Unraid writes a date."],
    "/Settings/DateTime display_time": ["Ob Uhrzeiten mit 12 oder 24 Stunden erscheinen.", "Whether times show in 12 or 24 hour format."],
    USE_NTP: ["Woher der Server seine Uhrzeit nimmt: aus dem Internet (NTP), von einer Uhr im lokalen Netz (PTP) oder von Hand gestellt.", "Where the server takes its time from: the internet (NTP), a clock on the local network (PTP), or set by hand."],
    NTP_POLL: ["Wie oft der Server die Zeitserver fragt. Öfter hält die Uhr genauer.", "How often the server asks the time servers. More often keeps the clock more exact."],
    NTP_SERVER1: NTP_SRV, NTP_SERVER2: NTP_SRV, NTP_SERVER3: NTP_SRV, NTP_SERVER4: NTP_SRV,
    PTP_TRANSPORT: ["Über welches Protokoll die PTP-Zeit im Netz läuft. Es muss zur Uhr in deinem Netz passen.", "Which protocol carries PTP time on the network. It has to match the clock on your network."],
    PTP_MODE: ["Multicast findet die Uhr im Netz selbst, Unicast fragt nur die Server darunter.", "Multicast finds the clock on the network by itself, Unicast only asks the servers below."],
    PTP_SERVER1: PTP_SRV, PTP_SERVER2: PTP_SRV, PTP_SERVER3: PTP_SRV, PTP_SERVER4: PTP_SRV,
    PTP_PORT: ["Die Netzwerkschnittstelle, über die PTP läuft.", "The network interface PTP runs on."],
    PTP_CLOCK: ["Hardware nimmt die Uhr der Netzwerkkarte und ist genauer, Software geht mit jeder Karte.", "Hardware uses the network card's clock and is more exact, Software works with any card."],
    MULTIGPU: ["Welche Grafikkarten die Kachel im Dashboard zeigt. Du kannst mehrere wählen.", "Which graphics cards the Dashboard tile shows. You can pick several.", "Grafikkarten im Dashboard"],
    TEMPFORMAT: ["In welcher Einheit Temperaturen erscheinen.", "The unit temperatures are shown in.", "Temperatureinheit"],
    UIREFRESH: ["Ob die Kachel ihre Werte selbst neu lädt, und in welchem Abstand in Millisekunden.", "Whether the tile reloads its values by itself, and how often in milliseconds.", "Automatisch aktualisieren (Millisekunden)"],
    DEBUGLOG: ["Schreibt ausführliche Meldungen ins Systemprotokoll. Nur für die Fehlersuche.", "Writes detailed messages to the system log. Only for troubleshooting.", "Debug-Protokoll"],
    DISPCLOCKS: ["Zeigt den Takt von Grafikchip und Grafikspeicher.", "Shows the clock speed of the graphics chip and its memory.", "GPU- und Speichertakt (Nvidia/Intel/AMD)"],
    DISPPCIUTIL: ["Zeigt, wie stark der PCIe-Bus oder der Speichercontroller arbeitet.", "Shows how busy the PCIe bus or the memory controller is.", "PCI- und IMC-Auslastung (Nvidia/Intel)"],
    DISPPWRDRAW: ["Zeigt, wie viel Strom die Karte gerade braucht.", "Shows how much power the card draws right now.", "Leistungsaufnahme (Nvidia/Intel/AMD**)"],
    DISPPWRSTATE: ["Zeigt den Energiezustand der Karte, von P0 für volle Leistung abwärts.", "Shows the card's power state, from P0 for full power downwards.", "Energiezustand (Nvidia/Intel)"],
    DISPMEMUTIL: ["Zeigt, wie viel Grafikspeicher belegt ist.", "Shows how much graphics memory is in use.", "Speicherauslastung (Nvidia/AMD)"],
    DISPTEMP: ["Zeigt die Temperatur des Grafikchips.", "Shows the temperature of the graphics chip.", "Temperatur (Nvidia/AMD)"],
    DISPFAN: ["Zeigt, wie schnell der Lüfter der Karte dreht.", "Shows how fast the card's fan spins.", "Lüfter (Nvidia/Intel/AMD**)"],
    DISPSESSIONS: ["Zeigt, welche Programme die Karte gerade nutzen, etwa beim Transcoding.", "Shows which programs use the card right now, for example while transcoding.", "Aktive Sitzungen (Nvidia/Intel/AMD)"],
    DISPENCDEC: ["Zeigt, wie stark die Einheiten für Video-Kodierung und -Dekodierung arbeiten.", "Shows how busy the video encode and decode units are.", "Encoder- und Decoder-Auslastung"],
    DISPTHROTTLE: ["Zeigt, ob und warum die Karte ihren Takt drosselt, etwa wegen Hitze.", "Shows whether and why the card slows its clock, for example from heat.", "Drosselung"],
    INTELBACKEND: ["Mit welchem Werkzeug die Werte einer Intel-Karte gelesen werden.", "Which tool reads the values of an Intel card.", "Intel-Backend (i915)"],
    DISP3DRENDER: ["Zeigt, wie stark die 3D-Einheit arbeitet.", "Shows how busy the 3D unit is.", "3D-Last"],
    DISPBLITTER: ["Zeigt, wie stark die Einheit arbeitet, die Bildbereiche kopiert.", "Shows how busy the unit that copies image regions is.", "Blitter-Last"],
    DISPVIDEO: ["Zeigt, wie stark die Videoeinheit arbeitet, die beim Transcoding rechnet.", "Shows how busy the video unit used for transcoding is.", "Video-Last"],
    DISPVIDENH: ["Zeigt, wie stark die Einheit für Skalierung und Bildverbesserung arbeitet.", "Shows how busy the scaling and enhancement unit is.", "Videoverbesserung"],
    DISPCOMPUTE: ["Zeigt, wie stark Berechnungen die Karte auslasten, etwa für KI.", "Shows how busy compute work keeps the card, for example AI.", "Rechenlast"],
    DISPINTERRUPT: ["Zeigt, wie oft die Karte den Prozessor pro Sekunde unterbricht.", "Shows how often per second the card interrupts the processor.", "Interrupts pro Sekunde"],
    DISPPWRDRWSEL: ["Ob die Leistung des Grafikchips, des ganzen Prozessors oder der höhere der beiden Werte erscheint.", "Whether to show the power of the graphics chip, of the whole processor, or the higher of the two.", "Quelle der Leistungsaufnahme"],
    DISPEVENT: AMD_UNIT.concat("Auslastung Event Engine"), DISPVERTEX: AMD_UNIT.concat("Auslastung Vertex Tesselator"), DISPTEXTURE: AMD_UNIT.concat("Auslastung Texture Addresser"),
    DISPSHADEREXP: AMD_UNIT.concat("Auslastung Shader Export"), DISPSEQUENCER: AMD_UNIT.concat("Auslastung Sequencer Cache"), DISPSHADERINTER: AMD_UNIT.concat("Auslastung Shader Interpolator"),
    DISPSCANCON: AMD_UNIT.concat("Auslastung Scan Converter"), DISPPRIMASSEM: AMD_UNIT.concat("Auslastung Primitive Assembly"), DISPDEPTHBLK: AMD_UNIT.concat("Auslastung Depth Block"),
    DISPCOLORBLK: AMD_UNIT.concat("Auslastung Color Block"), DISPGFXTRANS: AMD_UNIT.concat("Auslastung Graphics Translation"),
    "/Settings/UserscriptsEnhanced default_expanded": ["Neue Kategorien stehen in der Skriptliste gleich offen.", "New categories start opened in the script list.", "Neue Kategorien aufgeklappt"],
    "/Settings/UserscriptsEnhanced uncategorized_expanded": ["Die Skripte ohne Kategorie stehen gleich offen.", "The scripts without a category start opened.", "Skripte ohne Kategorie aufgeklappt"],
    "/Settings/UserscriptsEnhanced capitalized": ["Schreibt Kategorienamen mit großem Anfangsbuchstaben.", "Starts category names with a capital letter.", "Kategorienamen großschreiben"],
    "/Settings/UserscriptsEnhanced enable_search": ["Zeigt über der Skriptliste ein Suchfeld.", "Shows a search field above the script list.", "Suche"],
    "/Settings/UserscriptsEnhanced hide_description": ["Blendet die Beschreibungen in der Liste aus, alle oder nur die leeren.", "Hides the descriptions in the list, all of them or only the empty ones.", "Skriptbeschreibungen ausblenden"],
    "/Settings/UserscriptsEnhanced hide_what_is_cron": ["Blendet den Hinweis aus, der Cron erklärt.", "Hides the note that explains cron.", "Hinweis zu Cron ausblenden"],
    "/Settings/UserscriptsEnhanced hide_how_to_add_scripts": ["Blendet den Knopf aus, der zeigt, wie man Skripte hinzufügt.", "Hides the button that shows how to add scripts.", "Anleitungsknopf ausblenden"],
    "/Settings/UserscriptsEnhanced hide_help": ["Blendet den Hinweis aus, wo es Hilfe zum Plugin gibt.", "Hides the note on where to get help with the plugin.", "Hilfehinweis ausblenden"]
  };
  // Gives a settings row the (i) Unraid left out, from CC_ROW_HELP, once the native help blocks
  // have found their rows. Buttons are actions, not settings, so a row needs a real field.
  function ccRowHelp() {
    var path = location.pathname.replace(/\/+$/, "");
    var dts = document.querySelectorAll("#displaybox dl > dt");
    for (var i = 0; i < dts.length; i++) {
      var dt = dts[i];
      if (dt.querySelector(".cc-toolsinfo")) continue;
      var dd = dt.nextElementSibling;
      var ctl = dd && dd.tagName === "DD" ? dd.querySelector("input[name]:not([type=hidden]):not([type=button]):not([type=submit]), select[name], textarea[name]") : null;
      if (!ctl) continue;
      var name = ctl.name.replace(/\[\]$/, "").replace(/\.\d+$/, "");
      var e = CC_ROW_HELP[path + " " + name] || CC_ROW_HELP[name];
      if (!e) continue;
      var tn = ccLabelText(dt);
      if (!tn) continue;
      if (e[2] && LANG === "de") tn.nodeValue = e[2];
      var ic = document.createElement("span"); ic.className = "cc-toolsinfo"; ic.setAttribute("data-cc-tip", T(e[0], e[1])); ic.textContent = "ⓘ";
      tn.parentNode.appendChild(ic);
    }
  }
  // On cc-tools-on pages the native <select> is replaced with the same overlay dropdown the Docker
  // add-container form uses, under its own class names so nothing else unwraps it. The real select
  // stays hidden and carries the form value: a click writes selectedIndex back and dispatches
  // change, so the native onchange chains still fire. The panel is fixed, which escapes the
  // overflow clipping, and flips upward when there is more room above.
  function ccMkEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  // A GlimStone glyph from cc-theme.js as an element, for the glyphs CC adds to Unraid's and CA's
  // pages; their own icons keep their Font Awesome.
  function ccGlyphEl(name, cls) {
    var s = ccMkEl("span"); s.innerHTML = window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph(name) : "";
    var svg = s.firstChild || s;
    if (cls) svg.classList.add(cls);
    return svg;
  }
  var ccTselDocBound = false;
  function ccBindTselDoc() {
    if (ccTselDocBound) return; ccTselDocBound = true;
    document.addEventListener("click", function (e) {
      var open = document.querySelectorAll(".cc-tsel.cc-open"); if (!open.length) return;
      for (var i = 0; i < open.length; i++) { if (!open[i].contains(e.target)) open[i].classList.remove("cc-open"); }
    });
    window.addEventListener("scroll", function () { var o = document.querySelectorAll(".cc-tsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
  }
  function ccPositionTsel(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14, ox = 0, oy = 0, cbBottom = window.innerHeight;
      for (var pe = panel.parentElement; pe && pe.nodeType === 1 && pe !== document.documentElement; pe = pe.parentElement) {
        var pcs = getComputedStyle(pe);
        if (pcs.transform !== "none" || pcs.perspective !== "none" || (pcs.filter && pcs.filter !== "none")) { var pr = pe.getBoundingClientRect(); ox = pr.left; oy = pr.top; cbBottom = pr.bottom; break; }
      }
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge;
      panel.style.position = "fixed"; panel.style.boxSizing = "border-box";
      panel.style.left = Math.round(r.left - ox) + "px"; panel.style.minWidth = Math.round(r.width) + "px"; panel.style.maxWidth = "min(92vw, 480px)";
      if (below >= 200 || below >= above) { panel.style.top = Math.round(r.bottom + gap - oy) + "px"; panel.style.bottom = "auto"; panel.style.maxHeight = Math.max(140, below - gap) + "px"; }
      else { panel.style.bottom = Math.round(cbBottom - r.top + gap) + "px"; panel.style.top = "auto"; panel.style.maxHeight = Math.max(140, above - gap) + "px"; }
    } catch (e) {}
  }
  // On /Apps/ca_settings the apply, done and download-log buttons come out of one <span> while the
  // help link sits in a separate <center>. Two elements in different parents cannot share a flex
  // line, so the one that has to change rows is moved. It acts only while the button is still in
  // the span, and the page is a plain form render that nothing rebuilds underneath.
  function ccCaSettingsRows() {
    try {
      if (!/^\/Apps\/ca_settings/i.test(location.pathname)) return;
      var box = document.getElementById("displaybox"); if (!box) return;
      var host = box.querySelector("center"); if (!host) return;
      var btns = box.querySelectorAll('span > input[type="button"]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i], v = (b.value || "").toUpperCase();
        if (v.indexOf("LOG") < 0) continue;              // only the log button joins the help link
        if (b.parentElement === host) continue;
        host.insertBefore(b, host.firstChild);
      }
      // Both button rows line up with the toggle column. They sit in different parents, so one
      // shared indent cannot work: the control edge is measured once and each row pushed to it,
      // which survives a language change, another font size or a longer label.
      // A yes/no select that ccToolsWrapSelect turned into a pill stays in the DOM hidden, right
      // where it was and therefore before its own pill, so a plain query can land on it first and
      // measure a zero rect. Skip anything with no rendered box.
      var ctrlCands = box.querySelectorAll("dd .cc-tgl, dd .cc-tsel, dd input, dd select"), ctrl = null;
      for (var cc = 0; cc < ctrlCands.length; cc++) {
        var ccRect = ctrlCands[cc].getBoundingClientRect();
        if (ccRect.width > 0 || ccRect.height > 0) { ctrl = ctrlCands[cc]; break; }
      }
      if (ctrl) {
        var cx = ctrl.getBoundingClientRect().left;
        var rows = [];
        var sub = box.querySelector('form span:has(> input[type="submit"])'); if (sub) rows.push(sub);
        if (host) rows.push(host);
        // Padding does not move the two rows equally: one of them sits inside a shrink-wrapped
        // ancestor that keeps itself centred, so widening it re-centres the ancestor and eats half
        // of every pixel, while the other takes padding one to one. Rather than hard-coding which
        // row is which, a probe write measures the real shift per pixel of padding and the padding
        // that closes the remaining gap follows from it.
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          row.style.setProperty("padding-left", "0px", "important");
          var c0 = row.getBoundingClientRect().left;
          var PROBE = 100;
          row.style.setProperty("padding-left", PROBE + "px", "important");
          var cP = row.getBoundingClientRect().left + PROBE;
          var slope = (cP - c0) / PROBE;
          var pad = slope > 0.05 ? Math.round((cx - c0) / slope) : 0;
          if (pad > 0 && pad < 2400) row.style.setProperty("padding-left", pad + "px", "important");
          else row.style.removeProperty("padding-left");
        }
      }
    } catch (e) {}
  }
  // The Display Settings language dropdown shows a flag per option, drawn from the plugin's own
  // bundled SVGs rather than from emoji: a regional-indicator pair relies on the OS font to
  // ligature it into one glyph, which Segoe UI Emoji does not do, so on Windows it renders as two
  // letter boxes. settings.js's flag picker takes the same route.
  // Several of Unraid's locale codes are not ISO country codes but repeat the language as a fake
  // country suffix, so uppercasing that suffix lands on no territory at all or on the wrong one by
  // coincidence, such as Argentina for Arabic. This map is built from the official pack list; the
  // suffix arithmetic below stays as the fallback for a pack not listed here yet.
  var CC_LOCALE_COUNTRY = {
    "": "gb", "en_US": "us", "de_DE": "de", "da_DA": "dk", "hu_HU": "hu", "nl_NL": "nl", "no_NO": "no",
    "it_IT": "it", "fr_FR": "fr", "pt_BR": "br", "pt_PT": "pt", "pl_PL": "pl", "es_ES": "es", "sv_SE": "se",
    "ru_RU": "ru", "uk_UA": "ua", "ar_AR": "sa", "bn_BN": "bd", "ja_JA": "jp", "zh_CN": "cn", "zh_TW": "tw",
    "ko_KO": "kr"
  };
  function ccLocaleCountry(val) {
    val = val || "";
    if (CC_LOCALE_COUNTRY.hasOwnProperty(val)) return CC_LOCALE_COUNTRY[val];
    var m = /_([A-Za-z]{2})$/.exec(val);
    return m ? m[1].toLowerCase() : "gb"; // no suffix at all is Unraid's default locale, English
  }
  // Writes the flag image as the first child of a trigger or an option chip without touching its
  // text, which ccToolsSyncSel owns. A textContent write removes every child, so the image has to
  // be inserted after that write rather than folded into the text.
  function ccLangFlagImg(container, val) {
    var iso = ccLocaleCountry(val);
    var img = container.firstElementChild && container.firstElementChild.classList.contains("cc-lang-flag") ? container.firstElementChild : null;
    if (!iso) { if (img) img.remove(); return; }
    if (!img) {
      img = document.createElement("img"); img.className = "cc-lang-flag"; img.loading = "lazy"; img.draggable = false; img.alt = "";
      img.onerror = function () { img.style.display = "none"; };
      container.insertBefore(img, container.firstChild);
    }
    var src = "/plugins/cannonadecommand/images/flags/" + iso + ".svg";
    if (img.getAttribute("src") !== src) { img.style.display = ""; img.src = src; }
  }
  // Scoped to the locale select: every other select on the site goes through the same generic
  // wrap and sync pair and has to render unchanged. The parenthetical the native option carries
  // ("Deutsch (German)") is dropped, so the whole dropdown reads as one name per entry.
  function ccLangLabel(sel, o) {
    if (sel.name !== "locale") return o.text;
    return o.text.replace(/\s*\([^)]*\)\s*$/, "");
  }
  // Unraid's official language packs are ordinary Community Applications catalog entries in the
  // "Language:" category, so server/langpacks.php reads the same local CA cache and lists every
  // one, installed or not; the native select lists only the installed ones. A pack missing from
  // this select's own option values gets an entry appended to the panel with a download glyph
  // instead of a flag. Its data-i resolves to no option, so ccToolsSyncSel's resync loop skips it.
  // Clicking one does not install anything here: a language pack extracts a zip rather than
  // pulling an image, and CA's own Install button is the safe path for that, so this navigates to
  // /Apps with the pack's name queued for ccAppsAutoSearch to drop into CA's search box.
  function ccLangAugmentPanel(sel, panel) {
    var installed = {}; for (var i = 0; i < sel.options.length; i++) installed[sel.options[i].value] = true;
    fetch("/plugins/cannonadecommand/server/langpacks.php", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (packs) {
        if (!Array.isArray(packs) || !panel.isConnected) return;
        // No group label: the download glyph on each entry already says it is not installed.
        packs.forEach(function (p) {
          if (!p || !p.code || installed[p.code]) return;
          var chip = ccMkEl("div", "cc-tsel-opt cc-tsel-opt-avail");
          // A missing data-i reads as +null, which is 0, so the resync loop would resolve these to
          // the first option and stomp their text. -1 resolves to nothing, which the loop skips.
          chip.setAttribute("data-i", "-1");
          var flagWrap = ccMkEl("span", "cc-tsel-avail-flag");
          chip.appendChild(flagWrap);
          ccLangFlagImg(flagWrap, p.code);
          chip.appendChild(ccMkEl("span", "cc-tsel-avail-name", p.local || p.name || p.code));
          chip.appendChild(ccGlyphEl("Download", "cc-tsel-avail-dl"));
          chip.setAttribute("role", "option"); chip.setAttribute("tabindex", "-1");
          chip.title = LANG === "de" ? "Nicht installiert, klicken, um es in Community Applications zu finden" : "Not installed, click to find it in Community Applications";
          chip.addEventListener("click", function (ev) {
            ev.stopPropagation();
            try { sessionStorage.setItem("cc.appsSearch", p.name || p.local || p.code); } catch (e) {}
            location.href = "/Apps";
          });
          panel.appendChild(chip);
        });
      })
      .catch(function () {});
  }
  // Runs a search term a language chip stashed through CA's own search box once the Apps tab has
  // rendered it. ccApps() calls this on every tick while the page settles, and the term is only
  // cleared once the search actually runs.
  function ccAppsAutoSearch() {
    var term; try { term = sessionStorage.getItem("cc.appsSearch"); } catch (e) { return; }
    if (!term) return;
    // The search box's own input handler only swaps its icon; the filter runs inside CA's global
    // doSearch(), which its submit button calls directly, so a synthetic input event never reaches
    // it. Calling doSearch before CA's initial catalog render has finished searches an empty grid
    // and is overwritten the moment that render lands, and one rendered card is a reliable sign
    // that it has.
    if (typeof window.doSearch !== "function" || !document.getElementById("searchBox") || !document.querySelector(".ca_holder")) return;   // retried on the next tick
    try { sessionStorage.removeItem("cc.appsSearch"); } catch (e) {}
    window.doSearch(true, term);
  }
  function ccToolsSyncSel(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-tsel")) return;
    w.classList.toggle("cc-tsel-disabled", !!sel.disabled);
    var t2 = w.querySelector(".cc-tsel-trigger"), c = w.querySelectorAll(".cc-tsel-opt");
    var label = sel.selectedIndex >= 0 ? ccLangLabel(sel, sel.options[sel.selectedIndex]) : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;
    // The flag goes back in after the write above, on every sync: that write wipes the children
    // whenever the label changed and leaves them alone when it did not, so calling this
    // unconditionally heals either case.
    if (sel.name === "locale" && t2) ccLangFlagImg(t2, sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].value : "");
    // A host script that refills a wrapped select, such as a disk list or a growing locale list,
    // changes its option count, and the loop below only re-reads the text of chips that already
    // exist, so the panel would keep offering the old list. A mismatch rebuilds through the one
    // existing builder. Only chips with a real index count, since the language panel appends its
    // "not installed" chips with data-i="-1". Never while the panel is open: rebuilding under the
    // pointer would drop the click it is aiming at.
    if (!w.classList.contains("cc-open")) {
      var real = 0;
      for (var q = 0; q < c.length; q++) if (+c[q].getAttribute("data-i") >= 0) real++;
      if (real !== sel.options.length) { ccToolsRewrap(sel); return; }
    }
    for (var k = 0; k < c.length; k++) {
      var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue;
      var lbl = ccLangLabel(sel, o); if (c[k].textContent !== lbl) c[k].textContent = lbl;
      if (sel.name === "locale") ccLangFlagImg(c[k], o.value);
      c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); c[k].setAttribute("aria-selected", o.selected ? "true" : "false");
    }
  }
  // The wheel handler for a closed field lives in cc-theme.js, but the repaint has to be this
  // family's own: ccToolsSyncSel re-inserts the locale flag and rebuilds the panel after a refill,
  // neither of which a generic mirror knows about.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-tsel")) return false; ccToolsSyncSel(sel); return true; }); } catch (e) {}
  // Puts the native select back where it was and wraps it again from scratch. The select itself is
  // never recreated, so every host handler bound to it survives.
  function ccToolsRewrap(sel) {
    try {
      var w = sel.parentNode;
      if (!w || !w.classList || !w.classList.contains("cc-tsel")) return;
      w.parentNode.insertBefore(sel, w); w.parentNode.removeChild(w);
      sel.style.display = ""; sel.removeAttribute("data-cc-tsel");
      ccToolsWrapSelect(sel);
    } catch (e) {}
  }
  function ccToolsWrapSelect(sel) {
    if (sel.getAttribute("data-cc-tsel") || sel.getAttribute("data-cc-tgl")) return;   // already wrapped, or a yes-no toggle
    if (sel.multiple || (sel.size && sel.size > 1) || sel.options.length < 1) return;   // a multiple or a list box stays native
    sel.setAttribute("data-cc-tsel", "1");
    var wrap = ccMkEl("span", "cc-tsel"); sel.parentNode.insertBefore(wrap, sel);
    sel.style.display = "none"; wrap.appendChild(sel);
    var trig = ccMkEl("span", "cc-tsel-trigger"); wrap.appendChild(trig);
    // the trigger is a listbox button, the panel a listbox, each chip an option
    trig.setAttribute("role", "button"); trig.setAttribute("tabindex", "0"); trig.setAttribute("aria-haspopup", "listbox"); trig.setAttribute("aria-expanded", "false");
    var lid = "cc-tsel-lb-" + (ccTselSeq++); trig.setAttribute("aria-controls", lid);
    if (sel.id || sel.name) trig.setAttribute("aria-label", (function () { var lab = sel.closest && sel.closest("dd") ? (sel.closest("dd").previousElementSibling || {}).textContent : ""; return (lab || sel.name || sel.id || "").replace(/\s*:\s*$/, "").trim() || "Auswahl"; })());
    var panel = ccMkEl("div", "cc-tsel-panel"); wrap.appendChild(panel);
    panel.setAttribute("role", "listbox"); panel.id = lid;
    var lastGroup = null;
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k], gl = o.parentNode && o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : null;
      if (gl && gl !== lastGroup) { var grp = ccMkEl("div", "cc-tsel-group", gl); grp.setAttribute("role", "presentation"); panel.appendChild(grp); lastGroup = gl; }
      var chip = ccMkEl("div", "cc-tsel-opt", ccLangLabel(sel, o)); chip.setAttribute("data-i", k);
      chip.setAttribute("role", "option"); chip.setAttribute("aria-selected", o.selected ? "true" : "false"); chip.setAttribute("tabindex", "-1");
      var pick = (function (idx) { return function (ev) { ev.stopPropagation(); if (sel.options[idx].disabled) return; sel.selectedIndex = idx; sel.dispatchEvent(new Event("change", { bubbles: true })); ccToolsSyncSel(sel); wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); trig.focus(); }; })(k);
      chip.addEventListener("click", pick);
      chip.addEventListener("keydown", (function (fn) { return function (e2) { if (e2.key === "Enter" || e2.key === " ") { e2.preventDefault(); fn(e2); } else if (e2.key === "ArrowDown" || e2.key === "ArrowUp") { e2.preventDefault(); ccTselMove(panel, e2.target, e2.key === "ArrowDown" ? 1 : -1); } else if (e2.key === "Escape") { wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); trig.focus(); } }; })(pick));
      panel.appendChild(chip);
    }
    if (sel.name === "locale") ccLangAugmentPanel(sel, panel);
    function openPanel() { var o2 = document.querySelectorAll(".cc-tsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) { o2[j].classList.remove("cc-open"); var t3 = o2[j].querySelector(".cc-tsel-trigger"); if (t3) t3.setAttribute("aria-expanded", "false"); } wrap.classList.add("cc-open"); trig.setAttribute("aria-expanded", "true"); ccPositionTsel(trig, panel); }
    trig.addEventListener("click", function (ev) { ev.stopPropagation(); if (sel.disabled) return; ccToolsSyncSel(sel); if (wrap.classList.toggle("cc-open")) { trig.setAttribute("aria-expanded", "true"); var o2 = document.querySelectorAll(".cc-tsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) { o2[j].classList.remove("cc-open"); var t3 = o2[j].querySelector(".cc-tsel-trigger"); if (t3) t3.setAttribute("aria-expanded", "false"); } ccPositionTsel(trig, panel); } else trig.setAttribute("aria-expanded", "false"); });
    trig.addEventListener("keydown", function (e2) {
      if (sel.disabled) return;
      if (e2.key === "Enter" || e2.key === " " || e2.key === "ArrowDown") { e2.preventDefault(); ccToolsSyncSel(sel); openPanel(); var first = panel.querySelector(".cc-tsel-opt.is-selected") || panel.querySelector(".cc-tsel-opt:not(.is-disabled)"); if (first) first.focus(); }
      else if (e2.key === "Escape") { wrap.classList.remove("cc-open"); trig.setAttribute("aria-expanded", "false"); }
    });
    ccToolsSyncSel(sel);
    ccBindTselDoc();
  }
  var ccTselSeq = 0;
  // ccToolsEnhance() wraps every select it can reach, but returns early unless cc-tools-on is set,
  // so it covers the /Tools and /Settings sub-pages only. The Dashboard's tile selects sit inside
  // #displaybox and match the same selector; this sweep reaches them. Three conditions:
  //   a rendered box, since a select inside a dialog that is hidden until opened buys nothing and
  //   risks fighting whatever builds it, and the next pass picks it up once it opens;
  //   at least two options, because a single-option select is a placeholder, not a choice;
  //   not already inside another CC widget: the settings page wraps its own selects in .cc-dsel,
  //   which sets no marker attribute, and nesting would stack two triggers on one field.
  function ccWrapPageSelects() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // The container form's selects belong to docker.js, which loads later and would wrap a
      // second trigger inside this one.
      if (/^\/(Docker|Apps)\/(AddContainer|UpdateContainer)\/?$/.test(location.pathname)) return;
      var sels = document.querySelectorAll("#displaybox select:not([data-cc-tgl]):not([data-cc-tsel]):not([data-cc-dsel]):not([multiple])");
      for (var i = 0; i < sels.length; i++) {
        var s = sels[i];
        if (s.options.length < 2) continue;
        if (s.closest(".cc-dsel") || s.closest(".cc-tsel")) continue;
        // Never the /Main array-device table: Unraid replaces its whole tbody every second, so a
        // wrapper cannot survive one tick, and an open panel would be destroyed mid-click on the
        // very control that assigns disks. Shares.css gives that native select the filled-pill
        // look instead, and its popup is drawn by the OS, so nothing can tear it away.
        if (s.closest("table.unraid.disk_status")) continue;
        var r = s.getBoundingClientRect(); if (!r.width || !r.height) continue;
        ccToolsWrapSelect(s);
      }
    } catch (e) {}
  }
  // apply() runs once at boot, which on the Dashboard is before dynamix has rendered its tiles, so
  // the selects still measure zero and the rendered test above skips them. Two bounded follow-ups,
  // both no-ops on a repeat pass thanks to the sweep's own marker filter: a settle interval, as
  // ccAppsBoot() uses for CA's late cards, and a debounced sweep after any click, which catches a
  // control that exists only once something is opened.
  var ccSelSweepT = null;
  function ccWrapSelectsBoot() {
    try {
      var n = 0, iv = setInterval(function () { ccWrapPageSelects(); if (++n >= 15) clearInterval(iv); }, 300);
      document.addEventListener("click", function () {
        if (ccSelSweepT) return;
        ccSelSweepT = setTimeout(function () { ccSelSweepT = null; ccWrapPageSelects(); }, 250);
      }, true);
    } catch (e) {}
  }
  // roving focus between option chips, skipping group headers and disabled ones
  function ccTselMove(panel, cur, dir) {
    var opts = Array.prototype.filter.call(panel.querySelectorAll(".cc-tsel-opt"), function (o) { return !o.classList.contains("is-disabled"); });
    var i = opts.indexOf(cur); if (i < 0) i = 0; else i = (i + dir + opts.length) % opts.length;
    if (opts[i]) opts[i].focus();
  }
  // The native /Settings pages apply on form submit rather than on change, so flipping a wrapped
  // toggle has no effect until Apply. This persists the one changed field the way Apply does, by
  // posting it to /update.php with the form's own #file and #section, and reloads.
  function ccApplyToolsSel(sel) {
    try {
      if (!sel || !sel.name || typeof window.csrf_token === "undefined") return;
      var form = sel.closest ? sel.closest("form") : null;
      var fEl = form && form.querySelector('[name="#file"]'), sEl = form && form.querySelector('[name="#section"]');
      var fd = new URLSearchParams();
      fd.append("#file", (fEl && fEl.value) || "dynamix/dynamix.cfg");
      fd.append("#section", (sEl && sEl.value) || "display");
      fd.append("csrf_token", window.csrf_token);
      fd.append(sel.name, sel.value);
      // Keep a native setting that has a CC counterpart in step, or the CC side overrides it again.
      try { if (sel.name === "favorites") localStorage.setItem("cc.hidefavtab", (sel.value === "no" || sel.value === "0") ? "1" : "0"); } catch (eC) {}
      fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function () { location.reload(); }).catch(function () {});
    } catch (e) {}
  }
  // Tidies the native /Tools and /Settings sub-pages: the setting labels lose their trailing colon,
  // the status word becomes a state dot, and each inline help block moves onto an info bubble.
  function ccToolsEnhance() {
    try {
      if (!document.documentElement.classList.contains("cc-tools-on")) return;
      // Every pass looks again, since some pages write their labels after the first one.
      var dts = document.querySelectorAll("#displaybox dl > dt");
      for (var i = 0; i < dts.length; i++) {
        var tn = ccLabelText(dts[i]);
        if (tn && /:\s*$/.test(tn.nodeValue)) tn.nodeValue = tn.nodeValue.replace(/\s*:\s*$/, "");
      }
      // The coloured status word in the page-title span becomes a state dot, with the word as its
      // tooltip, like the disk state dots.
      var stcolor = { green: "var(--cc-ok, #6fdc8c)", orange: "var(--cc-warn, #ff832b)", red: "var(--cc-err, #ff8389)", grey: "#8d8d8d", gray: "#8d8d8d", blue: "#1D99F3" };
      var stwords = document.querySelectorAll("#displaybox div.title .status span[class]:not([data-cc-dot]), #displaybox div.title span.status span[class]:not([data-cc-dot])");
      for (var sw = 0; sw < stwords.length; sw++) {
        var w = stwords[sw]; var cl = (w.className || "").trim().toLowerCase(); var col = stcolor[cl];
        if (!col) continue;
        w.setAttribute("data-cc-dot", "1"); w.setAttribute("data-cc-tip", (w.textContent || "").trim());
        // The dot follows the colour modes unless state-native is on, and its shape the badge
        // setting. The raw state colour goes into a var, and the sheet decides which one wins.
        w.textContent = ""; w.classList.add("cc-status-dot"); w.style.setProperty("--cc-dotstate", col);
      }
      // Unraid's per-setting help is a blockquote, whose text moves onto a small icon on the label
      // and rides the CC bubble; the native block is hidden.
      // A block already moved is looked at again, because some pages rewrite the label it went
      // into and take the icon with it.
      var helps = document.querySelectorAll("#displaybox blockquote.inline_help, #displaybox .inline-help");
      for (var h = 0; h < helps.length; h++) {
        var bq = helps[h];
        if (bq.__ccIcon && bq.__ccIcon.isConnected) continue;
        bq.setAttribute("data-cc-help", "1");
        var txt = ccTransHelp((bq.textContent || "").trim()); if (!txt) { continue; }
        // The help block sits either inside the field's dd or as a flat sibling after the dl it
        // describes, so the label is resolved both ways.
        var lab = null, dd = bq.closest("dd");
        if (dd) lab = dd.previousElementSibling;
        else { var pv = bq.previousElementSibling; while (pv && pv.tagName !== "DL" && pv.tagName !== "DT") pv = pv.previousElementSibling; if (pv) lab = pv.tagName === "DL" ? ccHelpOwner(pv) : pv; }
        var host = (lab && lab.tagName === "DT") ? (lab.querySelector("span") || lab) : null;
        // Without a label span, fall back to the value cell or the label itself, so no help block
        // is left inline.
        if (!host && dd) host = dd;
        if (!host && lab) host = lab;
        if (host) {
          var ic = host.querySelector(":scope > .cc-toolsinfo");
          if (!ic) { ic = document.createElement("span"); ic.className = "cc-toolsinfo"; ic.setAttribute("data-cc-tip", txt); ic.textContent = "ⓘ"; host.appendChild(ic); }
          bq.__ccIcon = ic;
          bq.style.display = "none";
        }
      }
      // Unraid's form lists carry empty structural <dt>s before some real labels. Hiding a stray dt
      // takes it out of the grid entirely, so auto-flow places every real row itself. CSS cannot do
      // this: :has() and sibling matching cannot tell one stray row from several, and a blanket
      // rule flattens multi-row lists onto each other.
      // The resolver above can append its icon to such an empty dt instead of the real label, so
      // the icon moves into the following label and the empty carrier is hidden.
      var carriers = document.querySelectorAll("#displaybox dl > dt > .cc-toolsinfo");
      for (var ck = 0; ck < carriers.length; ck++) {
        var cic = carriers[ck], cdt = cic.parentElement;
        if ((cdt.textContent || "").replace(/[\sⓘ]/g, "")) continue;              // the dt has a label, so the icon belongs there
        var nlab = cdt.nextElementSibling;
        while (nlab && nlab.tagName === "DT" && (getComputedStyle(nlab).display === "none" || !(nlab.textContent || "").trim())) nlab = nlab.nextElementSibling;
        if (nlab && nlab.tagName === "DT") { nlab.appendChild(cic); cdt.style.display = "none"; }
      }
      // A dt with nothing in it at all has no content to relocate and is simply hidden. That also
      // takes it out of the grid, so a dd that used it as its column-1 anchor, such as the button
      // row, would flow into column 1 itself; it is put back on column 2 explicitly.
      var bareDts = document.querySelectorAll("#displaybox dl > dt:not([data-cc-barehid])");
      for (var bd = 0; bd < bareDts.length; bd++) {
        var bdt = bareDts[bd];
        bdt.setAttribute("data-cc-barehid", "1");
        if (getComputedStyle(bdt).display === "none") continue;
        if (!(bdt.textContent || "").trim() && !bdt.querySelector("*")) {
          bdt.style.display = "none";
          var afterBare = bdt.nextElementSibling;
          if (afterBare && afterBare.tagName === "DD") afterBare.style.gridColumn = "2";
        }
      }
      ccRowHelp();
      // Unraid's header colour fields are plain hex text inputs with no picker, so each gets a
      // swatch that opens CannonadeCommand's colour picker, and a native <input type=color> opens
      // that picker instead of the system's. Text fields are recognised by a hex value together
      // with a colour-like name; the picker writes the field without the # Unraid leaves out and
      // fires input and change, so Apply still works.
      var COLNAMES = { header: 1, headermetacolor: 1, background: 1, headertext: 1 };
      var cinp = window.CCTheme ? document.querySelectorAll("#displaybox input[type=text]:not([data-cc-colpick]), #displaybox input[type=color]:not([data-cc-colpick])") : [];
      for (var ci = 0; ci < cinp.length; ci++) {
        var inp = cinp[ci], v = (inp.value || "").trim();
        var dd0 = inp.closest("dd"), dt0 = dd0 && dd0.previousElementSibling;
        var lbl = dt0 ? (dt0.textContent || "") : "";
        if (inp.type === "text") {
          if (!/^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(v)) continue;
          if (!COLNAMES[inp.name] && !/farbe|colou?r/i.test(lbl + " " + inp.name)) continue;   // only genuine colour fields
        }
        inp.setAttribute("data-cc-colpick", "1");
        window.CCTheme.colorSwatch(inp, { hash: v.charAt(0) === "#", label: (lbl || inp.name || "").replace(/[\s:ⓘ]+$/, "").trim() });
      }
      // On the VM manager settings page the remove link beside the VirtIO ISO dropdown becomes the
      // trash icon the Plugins tab uses. Gated to /Settings/VM so no other "remove" matches, and
      // only for one riding in the same row as a select. Its native onclick stays.
      try {
        if (/\/Settings\/VM/i.test(location.pathname)) {
          var rms = document.querySelectorAll("#displaybox a, #displaybox span, #displaybox input[type=button], #displaybox button");
          for (var rr = 0; rr < rms.length; rr++) {
            var rme = rms[rr]; if (rme.getAttribute && rme.getAttribute("data-cc-delicon")) continue;
            var rmt = (rme.textContent || rme.value || "").replace(/^[^0-9a-zäöüß]+/i, "").trim();   // strip a leading 🗑 glyph
            if (!/^(entfernen|remove|löschen|delete)$/i.test(rmt)) continue;
            var rmrow = rme.closest("dd") || rme.closest("dl") || rme.parentElement;
            if (!rmrow || !rmrow.querySelector("select")) continue;
            rme.setAttribute("data-cc-delicon", "1");
            if (!window.CCTheme) continue;
            // An <input> cannot hold the SVG, so a badge stands in for it and clicks it.
            if (rme.tagName === "INPUT") {
              rme.style.setProperty("display", "none", "important");
              rme.parentNode.insertBefore(window.CCTheme.delIcon(rmt, (function (n) { return function () { n.click(); }; })(rme)), rme.nextSibling);
            } else {
              rme.classList.add("cc-b-del", "cc-b-delicon"); rme.setAttribute("title", rmt);
              rme.insertAdjacentHTML("beforeend", window.CCTheme.CC_TRASH_SVG);
            }
          }
        }
      } catch (eRm) {}
      // A two-option select whose options read as yes and no becomes a toggle. The real select
      // stays hidden in the DOM as the form value, and the toggle writes it back and fires change,
      // so Unraid's own handlers still run.
      var YES = { ja: 1, yes: 1, enabled: 1, an: 1, on: 1, aktiviert: 1 }, NO = { nein: 1, no: 1, disabled: 1, aus: 1, off: 1, deaktiviert: 1 };
      var sels = document.querySelectorAll("#displaybox select:not([data-cc-tgl]):not([multiple])");
      for (var s = 0; s < sels.length; s++) {
        var sel = sels[s];
        if (sel.options.length !== 2) continue;
        var t0 = (sel.options[0].text || "").trim().toLowerCase(), t1 = (sel.options[1].text || "").trim().toLowerCase();
        var yesOpt = YES[t0] ? sel.options[0] : YES[t1] ? sel.options[1] : null;
        var noOpt = NO[t0] ? sel.options[0] : NO[t1] ? sel.options[1] : null;
        if (!yesOpt || !noOpt) continue;
        sel.setAttribute("data-cc-tgl", "1");
        var tg = document.createElement("span"); tg.className = "cc-tgl" + (sel.value === yesOpt.value ? " cc-tgl-on" : ""); tg.setAttribute("role", "switch"); tg.setAttribute("tabindex", "0");
        tg.appendChild(document.createElement("span")).className = "cc-tgl-knob";
        (function (sel2, tg2, yv, nv) {
          var flip = function () { var nowOn = !tg2.classList.contains("cc-tgl-on"); tg2.classList.toggle("cc-tgl-on", nowOn); sel2.value = nowOn ? yv : nv; try { sel2.dispatchEvent(new Event("change", { bubbles: true })); } catch (e2) {} ccApplyToolsSel(sel2); };   // persist and reload, so the flip takes effect without Apply
          tg2.addEventListener("click", flip);
          tg2.addEventListener("keydown", function (e3) { if (e3.key === "Enter" || e3.key === " ") { e3.preventDefault(); flip(); } });
        })(sel, tg, yesOpt.value, noOpt.value);
        sel.style.display = "none";
        sel.parentNode.insertBefore(tg, sel.nextSibling);
      }
      // every select not turned into a toggle above becomes the overlay dropdown
      var dsels = document.querySelectorAll("#displaybox select:not([data-cc-tgl]):not([data-cc-tsel]):not([multiple])");
      for (var ds = 0; ds < dsels.length; ds++) ccToolsWrapSelect(dsels[ds]);
    } catch (e) {}
  }
  function watchIsland() {   // nchan rewrites the hidden footer live, and the island mirrors it
    try {
      if (ccIslandObs) return;
      var f = document.getElementById("footer"); if (!f) return;   // no footer yet, so the next apply() retries
      ccIslandObs = new MutationObserver(function () { ccIsland(); });
      ccIslandObs.observe(f, { childList: true, subtree: true, characterData: true });   // the island writes into #header, so this cannot loop
    } catch (e) {}
  }
  // The server name is a light-DOM sibling of the Connect components, never a child of them, since
  // auto-mount rebuilds their nodes. It is the display name set in CC's settings, else the
  // document title, else the native server-name span in the profile, else it reads "Unraid".
  // Gated on the header area and master theming but not on cc.island: hiding the status island
  // must not take the name with it.
  var ccBrandSig = "";
  function ccBrandOn() { return g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0"; }
  function ccBrand() {
    try {
      var br = document.getElementById("cc-brand");
      if (!ccBrandOn()) { if (br && br.parentNode) br.parentNode.removeChild(br); ccBrandSig = ""; return; }
      var hdr = document.getElementById("header"); if (!hdr) return;
      var name = g("cc.brand.name", "").replace(/^\s+|\s+$/g, "") || (document.title.split("/")[0] || "").replace(/^\s+|\s+$/g, "");
      if (!name) {   // a page without a title, so read the native server-name span
        var ns = document.querySelector("#UserProfile > div:nth-child(2) span");
        name = ((ns && ns.textContent) || "").replace(/^\s+|\s+$/g, "");
      }
      if (!name) name = "Unraid";
      // The cc.brand.* keys are inlined here and are part of the signature, so a settings change
      // re-renders the name.
      var bSize = g("cc.brand.size", "30"), bWeight = g("cc.brand.weight", "650"), bItalic = g("cc.brand.italic", "0"),
          bFont = g("cc.brand.font", ""), bColor = g("cc.brand.color", "");
      var sig = name + "|" + bSize + "|" + bWeight + "|" + bItalic + "|" + bFont + "|" + bColor;
      if (br && sig === ccBrandSig) return;   // a profile rebuild re-runs this, but only a real change re-renders
      ccBrandSig = sig;
      if (!br) { br = document.createElement("span"); br.id = "cc-brand"; hdr.insertBefore(br, hdr.firstChild); }
      while (br.firstChild) br.removeChild(br.firstChild);
      var nm = document.createElement("span"); nm.className = "cc-brand-name";
      // an unset key leaves the sheet's default in place
      if (/^\d{1,3}$/.test(bSize)) nm.style.fontSize = bSize + "px";
      if (bWeight) nm.style.fontWeight = bWeight;
      nm.style.fontStyle = bItalic === "1" ? "italic" : "normal";
      if (bFont) {
        nm.style.fontFamily = bFont;
        // Load the web font for one of the curated Google families, so the name renders the same
        // on a client that does not have it installed.
        try {
          if (window.CCTheme && window.CCTheme.loadGFonts && window.CCTheme.gfonts) {
            var fam = window.CCTheme.primaryFamily(bFont);
            if (window.CCTheme.gfonts.some(function (gf) { return gf[0] === fam; })) window.CCTheme.loadGFonts([fam]);
          }
        } catch (e) {}
      }
      if (/^#[0-9a-f]{6}$/i.test(bColor)) nm.style.color = bColor;
      nm.appendChild(document.createTextNode(name));
      br.appendChild(nm);
    } catch (e) {}
  }
  var ccProfObs = null, ccProfT = null;
  function watchProfile() {   // the uptime, edition and name live inside the Connect profile, which auto-mount rebuilds at will
    try {
      if (ccProfObs) return;
      // Observe the custom element where there is one, since it survives auto-mount replacing
      // div#UserProfile wholesale, and never div#header, where this file writes itself.
      var p = document.querySelector("unraid-user-profile") || document.getElementById("UserProfile");
      if (!p) return;   // not mounted yet, so the next apply() retries
      ccProfObs = new MutationObserver(function () {
        if (ccProfT) return;   // coalesce auto-mount's rebuild burst into one pass
        ccProfT = setTimeout(function () {
          ccProfT = null;
          ccIsland(); ccBrand();
          ccDockProfile();         // the slow net, for anything ccWatchAdopt missed
        }, 120);
      });
      ccProfObs.observe(p, { childList: true, subtree: true, characterData: true });
      // ccWatchAdopt() is the fast net: it re-adopts the moment auto-mount inserts a fresh trigger
      // span, straight off the childList mutation and without a debounce, so the CSS safety net
      // never has to cover more than one frame. The debounced observer above is the slow net for
      // the rest of the profile, and a fallback if ccWatchAdopt's own target was not mounted yet.
      ccWatchAdopt();
    } catch (e) {}
  }
  // A ::after bubble is clipped by an overflow ancestor such as a nav tile or a table, and by the
  // viewport edge, so one body-mounted div serves every [data-cc-tip] anchor in the document
  // through delegation, which survives any rebuild. It is fixed, centred under the anchor and
  // clamped into the viewport with the arrow staying over the anchor, and flips above the anchor
  // when the bottom edge would clip it. Hidden on scroll and on pointerdown.
  var ccTipBound = false, ccTipCur = null, ccTipKeys = false;
  var ccTipFrame = 0, ccTipAt = "";
  function ccTipEl() {
    var d = document.getElementById("cc-tipfloat");
    if (!d) { d = document.createElement("div"); d.id = "cc-tipfloat"; document.body.appendChild(d); }
    return d;
  }
  function ccTipHide() {
    var d = document.getElementById("cc-tipfloat"); if (d) d.style.display = "none";
    ccTipCur = null;
    if (ccTipFrame) { window.cancelAnimationFrame(ccTipFrame); ccTipFrame = 0; }
  }
  // While a bubble stands it is checked once a frame. An anchor that moves, as a window does when it
  // grows and the clamp slides it up, takes its bubble along, and one that leaves the page or is
  // hidden takes it away, so no bubble is left standing on its own.
  function ccTipFollow() {
    ccTipFrame = 0;
    if (!ccTipCur) return;
    var r = ccTipCur.getBoundingClientRect();
    if (!ccTipCur.isConnected || (!r.width && !r.height)) { ccTipHide(); return; }
    if (Math.round(r.left) + "," + Math.round(r.top) !== ccTipAt) ccTipShow(ccTipCur);
    ccTipFrame = window.requestAnimationFrame(ccTipFollow);
  }
  function ccTipShow(t) {
    var tip = t.getAttribute("data-cc-tip") || t.getAttribute("data-tip"); if (!tip) return;
    var d = ccTipEl(), r = t.getBoundingClientRect();
    ccTipAt = Math.round(r.left) + "," + Math.round(r.top);
    d.textContent = tip;
    d.style.display = "block";                                     // shown first, since it only measures while visible
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = document.documentElement.clientHeight || window.innerHeight;
    var w = d.offsetWidth, h = d.offsetHeight, cx = r.left + r.width / 2, m = window.CCTheme.edge();
    var x = Math.max(m + w / 2, Math.min(vw - m - w / 2, cx));     // kept off the viewport's edges, since rows run to both
    d.style.left = x + "px";                                       // left is the bubble's centre, which the CSS shifts back
    // a bubble that would clip at the bottom opens above the anchor, where it fits
    var above = r.bottom + 8 + h > vh - m && r.top - 8 - h >= m;
    d.classList.toggle("cc-tip-above", above);
    d.style.top = (above ? r.top - 8 - h : r.bottom + 8) + "px";
    d.style.setProperty("--cc-tip-ax", Math.max(10, Math.min(w - 10, cx - (x - w / 2))) + "px");   // the arrow stays over the anchor even when the bubble clamps
  }
  function ccWireTips() {
    try {
      if (ccTipBound) return;
      ccTipBound = true;
      function over(e) {
        if (!document.documentElement.classList.contains("cc-popups-on")) return;   // master theming off, so everything stays native
        // Focus opens the bubble only for keyboard users. After a press the focus arrives as a side
        // effect, from the click or from a dialog handing it back, and a bubble opened then would
        // stand where the pointer no longer is until the focus moves on.
        if (e.type === "focusin" && !ccTipKeys) return;
        var t = e.target && e.target.closest ? e.target.closest("[data-cc-tip], [data-tip], [title]") : null;
        if (!t) return;
        // A raw title anywhere, on a native control or an icon no script converted, becomes a
        // bubble here and the OS balloon is suppressed, so every hover text reads the same.
        if (!t.getAttribute("data-cc-tip") && !t.getAttribute("data-tip")) {
          var nt = t.getAttribute("title");
          if (nt && nt.trim()) { t.setAttribute("data-cc-tip", nt); t.removeAttribute("title"); }
          else return;
        }
        if (t === ccTipCur) return;                                // the bubble already stands on this anchor
        ccTipCur = t; ccTipShow(t);
        if (!ccTipFrame) ccTipFrame = window.requestAnimationFrame(ccTipFollow);
      }
      function out(e) {
        if (!ccTipCur) return;
        var to = e.relatedTarget;
        if (to && ccTipCur.contains(to)) return;                   // still inside the same anchor
        ccTipHide();
      }
      document.addEventListener("mouseover", over);
      document.addEventListener("mouseout", out);
      document.addEventListener("focusin", over);
      document.addEventListener("focusout", out);
      document.addEventListener("pointerdown", function () { ccTipKeys = false; ccTipHide(); }, true);   // a press means action rather than reading
      document.addEventListener("keydown", function () { ccTipKeys = true; }, true);   // the last input, page-wide, since a press on one control can focus another
      window.addEventListener("scroll", ccTipHide, true);          // any scroll de-anchors the fixed bubble, and capture catches inner containers too
      // Escape dismisses the bubble, which is a keyboard user's only way out after tabbing onto an
      // icon. In the capture phase, so it fires before a dialog handler that stops propagation; it
      // only hides a tooltip, so it never swallows the key.
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") ccTipHide(); }, true);
    } catch (e) {}
  }
  // The bell and burger triggers are adopted as children of their proxy divs rather than overlaid.
  // An overlay cannot work here: a fixed box tracking a sticky proxy from JS is always a frame
  // behind, because the compositor resolves sticky with no synchronous hook, and worse, hovering
  // any nav item lifts #menu above #header, so .nav-tile.right's opaque background paints over two
  // spans that still belong to #header's stacking context. Adopted, the spans reflow with the row
  // and paint inside that tile's own context, where its background cannot cover them. Connect
  // rebuilds the profile row periodically; ccWatchAdopt() below re-adopts before paint the moment
  // it does, and a CSS rule hides any leftover un-adopted span whatever the JS timing, so a rebuild
  // cannot flash the icons at the parked anchor.
  var ccDockProps = ["position", "left", "right", "top", "height", "width", "z-index", "padding", "min-width"];
  // The two trigger spans are told apart by identity rather than DOM position, which changes once
  // they are adopted: the burger's id starts with "reka-menu-trigger". Falling back to first and
  // last keeps this working if Connect's naming changes.
  function ccClassifyTrig(sp) {
    var burger = null, i;
    for (i = 0; i < sp.length; i++) { if (/^reka-menu-trigger/.test(sp[i].id || "")) { burger = sp[i]; break; } }
    if (!burger) burger = sp.length ? sp[sp.length - 1] : null;
    var bell = null;
    for (i = 0; i < sp.length; i++) { if (sp[i] !== burger) { bell = sp[i]; break; } }
    if (!bell) bell = sp.length ? sp[0] : null;
    return { bell: bell, burger: burger };
  }
  // The proxies are two real draggable nav items in the normal .nav-tile.right flow, so they
  // reflow and reorder like every other icon, and each hosts its live trigger as a DOM child. The
  // proxy's own ghost glyph serves as the drag handle while arrange mode is active.
  function ccEnsureProxies(bellSpan, burgerSpan) {
    var tileR = navTileR(); if (!tileR) return [null, null];
    var defs = [["cc-bell-proxy", true, bellSpan], ["cc-burger-proxy", false, burgerSpan]];
    var out = [];
    for (var d = 0; d < defs.length; d++) {
      var id = defs[d][0], isBell = defs[d][1], span = defs[d][2];
      var it = document.getElementById(id);
      if (!it) {
        it = document.createElement("div");
        it.className = "nav-item util cc-navdrag cc-iconproxy";
        it.id = id;
        var a = document.createElement("a"); a.href = "#"; a.className = "hand cc-proxy-a";
        a.setAttribute("data-cc-tip", isBell ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        a.addEventListener("click", function (e) { e.preventDefault(); });   // a click in normal mode lands on the adopted span beside it
        var gh = document.createElement("span"); gh.className = "cc-proxy-ghost"; a.appendChild(gh);
        it.appendChild(a);
        tileR.appendChild(it);                                     // far right by default, which matches the native order
        wireNavItem(it);
      }
      // the ghost glyph mirrors the live trigger's icon, for the arrange-mode preview
      var gh2 = it.querySelector(".cc-proxy-ghost");
      if (gh2 && span && gh2.getAttribute("data-cc-svg") !== "1") { var svg = span.querySelector("svg"); if (svg) { gh2.innerHTML = svg.outerHTML; gh2.setAttribute("data-cc-svg", "1"); } }
      out.push(it);
    }
    return out;
  }
  // The bell swings instead of wearing Connect's corner badge, on a CSS beat that runs while
  // anything is unread (cc-bell-ring). The badge's level goes into data-cc-bell, which colours the
  // glyph.
  var ccBellSpan = null, ccBellObs = null;
  function ccBellLevel(span) {
    var mark = span && span.querySelector('[class*="absolute"]');
    if (!mark) return "";
    var cls = mark.getAttribute("class") || "";
    return /red/.test(cls) ? "alert" : /yellow|orange|amber/.test(cls) ? "warning" : "notice";
  }
  function ccBellSwinging(span) {
    var glyph = span.querySelector('svg:not([class*="absolute"])');
    return !!(glyph && glyph.getAnimations().some(function (a) { return a.animationName === "cc-bell-swing" && a.playState === "running"; }));
  }
  function ccBellSync() {
    var span = ccBellSpan, lvl = ccBellLevel(span);
    if (!span) return;
    if (lvl) span.setAttribute("data-cc-bell", lvl); else span.removeAttribute("data-cc-bell");
    span.setAttribute("data-cc-tip", lvl ? T("Ungelesene Benachrichtigungen", "Unread notifications") : T("Benachrichtigungen", "Notifications"));
    // A class write is a mutation even when it changes nothing, and the observer would call this
    // again, so only a real change is written. A swing under way ends at the close of its beat.
    var ring = span.classList.contains("cc-bell-ring");
    if (lvl && !ring) span.classList.add("cc-bell-ring");
    else if (!lvl && ring && !ccBellSwinging(span)) span.classList.remove("cc-bell-ring");
  }
  function ccBellWatch(span) {
    if (span === ccBellSpan) return;
    if (ccBellObs) { ccBellObs.disconnect(); ccBellObs = null; }
    ccBellSpan = span;
    if (!span) return;
    ccBellObs = new MutationObserver(ccBellSync);
    ccBellObs.observe(span, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    span.addEventListener("animationiteration", function (e) { if (e.animationName === "cc-bell-swing" && !span.hasAttribute("data-cc-bell")) span.classList.remove("cc-bell-ring"); });
    ccBellSync();
  }
  function ccDockProfile() {
    try {
      if (!document.documentElement.classList.contains("cc-header-on")) { ccUndockProfile(); return; }
      var up = document.getElementById("UserProfile"); if (!up) return;
      var container = up.querySelector(":scope > div:nth-child(2)");
      // Stamp any fresh span Connect just rebuilt; an already adopted one lives inside its proxy,
      // keeps its data-cc-trig and is found by the document query below.
      if (container) {
        var freshSp = container.querySelectorAll(":scope > span:not([data-cc-trig])");
        if (freshSp.length === 1) {
          // With only one candidate, ccClassifyTrig's position fallback would tag the same node as
          // both roles, so take the one role that is missing document-wide instead.
          var needBell1 = !document.querySelector('[data-cc-trig="bell"]'), needBurger1 = !document.querySelector('[data-cc-trig="burger"]');
          if (needBell1 !== needBurger1) freshSp[0].setAttribute("data-cc-trig", needBurger1 ? "burger" : "bell");
        } else if (freshSp.length >= 2) {
          var cls = ccClassifyTrig(freshSp);
          if (cls.bell && !document.querySelector('[data-cc-trig="bell"]')) cls.bell.setAttribute("data-cc-trig", "bell");
          if (cls.burger && !document.querySelector('[data-cc-trig="burger"]')) cls.burger.setAttribute("data-cc-trig", "burger");
        }
      }
      var bellSpan = document.querySelector('[data-cc-trig="bell"]');
      var burgerSpan = document.querySelector('[data-cc-trig="burger"]');
      if (!bellSpan && !burgerSpan) return;                        // the profile is not mounted yet, so the next pass retries
      var hideBell = g("cc.hideicon.bell", "0") === "1", hideBurger = g("cc.hideicon.burger", "0") === "1";
      var proxies = ccEnsureProxies(bellSpan, burgerSpan);
      var arranging = document.documentElement.classList.contains("cc-arrange");
      // The emptied Connect container keeps its place in the DOM, which auto-mount needs, and is
      // shrunk to no footprint instead.
      function setUp(p, v) { if (up.style.getPropertyValue(p) !== v) up.style.setProperty(p, v, "important"); }   // writing only on a difference means no mutations once settled
      setUp("position", "fixed"); setUp("left", "0"); setUp("top", "0"); setUp("width", "0"); setUp("height", "0"); setUp("min-width", "0"); setUp("padding", "0");
      [[bellSpan, proxies[0], hideBell, true], [burgerSpan, proxies[1], hideBurger, false]].forEach(function (row) {
        var span = row[0], proxy = row[1], hidden = row[2], isBell = row[3];
        if (!span || !proxy) return;
        var wantDisp = hidden ? "none" : "";
        if (proxy.style.display !== wantDisp) proxy.style.display = wantDisp;   // hiding the proxy collapses the whole slot
        var ss = span.style;
        if (hidden) { if (ss.getPropertyValue("display") !== "none") ss.setProperty("display", "none", "important"); return; }
        if (ss.getPropertyValue("display")) ss.removeProperty("display");
        // a CC bubble instead of the native balloon; ccWireTips binds document-wide
        if (!span.getAttribute("data-cc-tip")) span.setAttribute("data-cc-tip", isBell ? T("Benachrichtigungen", "Notifications") : T("Menü", "Menu"));
        if (span.getAttribute("title")) span.removeAttribute("title");
        // the triggers carry a Tailwind min-width and min-height that beat the sheet, so the box is set inline
        if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }
        // Mirror the proxy slot's rainbow colour onto the adopted trigger, so the bell and burger
        // rotate like the other utility icons; paintNav() stamps it on the proxy's own anchor. In
        // accent mode it is cleared and the CSS decides.
        var pxa = proxy.querySelector(".cc-proxy-a"), rbc = (rbOn() && pxa) ? pxa.style.getPropertyValue("--cc-rb-c") : "";
        if (rbc) { ss.setProperty("--cc-rb-c", rbc); ss.setProperty("--cc-rb-ct", pxa.style.getPropertyValue("--cc-rb-ct") || idealText(rbc)); }
        else { ss.removeProperty("--cc-rb-c"); ss.removeProperty("--cc-rb-ct"); }
        // The adoption itself. It is a no-op once the span sits inside the proxy, so this branch
        // fires again only when Vue rebuilds a fresh span.
        if (span.parentElement !== proxy) proxy.appendChild(span);
        // The ghost handle is hidden whenever the adopted trigger is showing, so the two boxes do
        // not sit side by side. The general ".nav-item.util > a" rule forces display with
        // !important, which a plain inline style cannot beat, so this matches it.
        var ghostA = proxy.querySelector(".cc-proxy-a");
        if (ghostA) {
          if (arranging) { if (ghostA.style.display) ghostA.style.removeProperty("display"); }
          else if (ghostA.style.display !== "none" || ghostA.style.getPropertyPriority("display") !== "important") {
            ghostA.style.setProperty("display", "none", "important");
          }
        }
      });
      ccBellWatch(hideBell ? null : bellSpan);
      ccArmAdoptObs();
    } catch (e) {}
  }
  function ccUndockProfile() {                                     // move the spans back and drop the proxies, so the row is native again
    try {
      ccDisarmAdoptObs();
      ccBellWatch(null);
      var bell = document.querySelector('[data-cc-trig="bell"]'), burger = document.querySelector('[data-cc-trig="burger"]');
      var up = document.getElementById("UserProfile");
      var container = up ? up.querySelector(":scope > div:nth-child(2)") : null;
      if (container) { if (bell) container.appendChild(bell); if (burger) container.appendChild(burger); }   // the native order is bell, then burger
      [bell, burger].forEach(function (s) {
        if (!s) return;
        s.removeAttribute("data-cc-trig");
        ["width", "height", "min-width", "min-height", "position", "left", "top", "z-index", "margin", "pointer-events", "display", "--cc-rb-c", "--cc-rb-ct"].forEach(function (p) { s.style.removeProperty(p); });
      });
      ["cc-bell-proxy", "cc-burger-proxy"].forEach(function (id) { var p = document.getElementById(id); if (p) p.remove(); });
      if (up) for (var i = 0; i < ccDockProps.length; i++) up.style.removeProperty(ccDockProps[i]);
    } catch (e) {}
  }
  // Two nets re-adopt after an auto-mount rebuild. Neither can loop: their only writes land on the
  // trigger spans' attributes or inside a proxy under #menu, and neither sits in the subtree the
  // other observer watches, so a write wakes the other net once, it sees a clean diff and stops.
  // The counter on the wide net is the backstop if Connect ever fights back with a real tug-of-war
  // rather than a plain rebuild.
  var ccAdoptObs = null, ccTrigStyleObs = null, ccAdoptHits = 0, ccAdoptWinT = 0, ccAdoptOffT = 0;
  function ccArmAdoptObs() {   // the narrow net: rewrites the box on the two adopted spans when something wipes it
    try {
      if (ccTrigStyleObs) { ccTrigStyleObs.disconnect(); ccTrigStyleObs = null; }
      var trig = document.querySelectorAll("[data-cc-trig]"); if (!trig.length) return;
      ccTrigStyleObs = new MutationObserver(function () {
        for (var i = 0; i < trig.length; i++) {
          var ss = trig[i].style;
          if (ss.getPropertyValue("min-height") !== "36px") { ss.setProperty("width", "36px", "important"); ss.setProperty("height", "36px", "important"); ss.setProperty("min-width", "36px", "important"); ss.setProperty("min-height", "36px", "important"); }
        }
      });
      for (var i = 0; i < trig.length; i++) ccTrigStyleObs.observe(trig[i], { attributes: true, attributeFilter: ["style"] });
    } catch (e) {}
  }
  function ccWatchAdopt() {   // the wide net: catches Connect inserting a fresh trigger span on a rebuild
    try {
      if (ccAdoptObs) return;
      var p = document.querySelector("unraid-user-profile"); if (!p) return;
      ccAdoptObs = new MutationObserver(function () {
        if (Date.now() < ccAdoptOffT) return;                                                                 // stood down
        if (!document.querySelector("#UserProfile > div:nth-child(2) > span:not([data-cc-trig])")) return;    // nothing un-adopted, so the chain ends here
        var now = Date.now();
        if (now - ccAdoptWinT > 1000) { ccAdoptWinT = now; ccAdoptHits = 0; }
        if (++ccAdoptHits > 30) { ccAdoptOffT = now + 5000; return; }                                          // thirty re-adoptions a second is a tug-of-war, so stand down
        try { ccDockProfile(); } catch (e2) {}
      });
      ccAdoptObs.observe(p, { childList: true, subtree: true });
    } catch (e) {}
  }
  function ccDisarmAdoptObs() {
    try { if (ccAdoptObs) { ccAdoptObs.disconnect(); ccAdoptObs = null; } if (ccTrigStyleObs) { ccTrigStyleObs.disconnect(); ccTrigStyleObs = null; } } catch (e) {}
  }
  function ccToast(msg, kind) {
    try { return window.CCTheme && window.CCTheme.toast ? window.CCTheme.toast(msg, kind) : null; } catch (e) { return null; }
  }
  // The API settings sub-tabs are not the classic PHP form the rest of that page is: each is its own
  // Vue custom element with its own tag name, so no single tag covers them. They all carry
  // class="unapi" in the light DOM, which is the stable anchor, and they are styled through
  // Tailwind's CSS-variable convention, where every colour utility reads hsl(var(--primary)) and
  // the variable holds a bare triplet defined on the element. Overriding that triplet reaches
  // every button, toggle and focus ring at once, without chasing each class combination.
  function ccHexToHslTriplet(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "220 91% 55%";
    var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, gC = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, gC, b), min = Math.min(r, gC, b), l = (max + min) / 2, hDeg = 0, s = 0;
    if (max !== min) {
      var d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hDeg = (gC - b) / d + (gC < b ? 6 : 0); else if (max === gC) hDeg = (b - r) / d + 2; else hDeg = (r - gC) / d + 4;
      hDeg *= 60;
    }
    return Math.round(hDeg) + " " + Math.round(s * 100) + "% " + Math.round(l * 100) + "%";
  }
  function ccSyncApiTheme() {
    try {
      var hosts = document.querySelectorAll(".unapi");
      if (!hosts.length) return;
      // --cc-rbaccent is the one representative colour under rainbow, set further down while
      // rainbow and the header area are both on. It is rbColor(5), the same palette index as the
      // default accent, so it stays continuous with the plain-accent look; taking slot zero
      // instead would paint the whole sub-tab red and clash with every other area on the page.
      var rbaVar = getComputedStyle(document.documentElement).getPropertyValue("--cc-rbaccent").trim();
      var hex = /^#[0-9a-f]{6}$/i.test(rbaVar) ? rbaVar : accent();
      var triplet = ccHexToHslTriplet(hex), fg = idealText(hex) === "#fff" ? "0 0% 98%" : "0 0% 9%";
      for (var i = 0; i < hosts.length; i++) {
        var s = hosts[i].style;
        // --primary and --ring drive the checked fill, the focus rings and the primary buttons,
        // --accent the neutral hover states. Both take the same colour, as elsewhere in the
        // plugin, where a hover always resolves to the accent.
        s.setProperty("--primary", triplet); s.setProperty("--primary-foreground", fg);
        s.setProperty("--ring", triplet);
        s.setProperty("--accent", triplet); s.setProperty("--accent-foreground", fg);
      }
    } catch (e) {}
  }
  function apply() {
    try {
      var root = document.documentElement;
      // Master theming off behaves like a disabled area, since the header is presentational. The
      // storage listener re-runs apply(), so a live toggle reverts it.
      var on = g("cc.enable.header", "0") !== "0" && g("cc.theming", "1") !== "0";
      root.classList.toggle("cc-header-on", on);
      // This file runs on every page, so it owns the global attributes the sheets key off. The
      // shape is global and set whatever the header area does: data-cc-shape picks the radius set
      // in Tokens.css. cc.badgeshape is read directly, since through eff() it would fall back to an
      // unset cch.badgeshape while the adopt toggle is off. A name from before GlimStone's three
      // shapes is rewritten once, and the engine's mirror follows.
      var shp = g("cc.badgeshape", "round"), shpName = shapeName(shp);
      if (/^(pill|rounded|circle)$/.test(shp)) syncedSet("cc.badgeshape", shpName);
      root.setAttribute("data-cc-shape", shpName);
      // The motion level is global too. The sheets read it from data-cc-motion, and the OS
      // reduce-motion setting still wins over every level. A digit from before the levels had
      // names is rewritten once, and the engine's mirror follows.
      var anim = g("cc.anim", "subtle"), level = motionLevel(anim);
      if (/^[012]$/.test(anim)) syncedSet("cc.anim", level);
      root.setAttribute("data-cc-motion", level);
      // The native jQuery-UI dialogs and the SweetAlert confirmations follow the CC look on every
      // page. Master-gated only, since it is chrome rather than an area of its own.
      root.classList.toggle("cc-popups-on", g("cc.theming", "1") !== "0");
      // CA's settings sub-page is a real Unraid form page, not one of CA's overlays, and nothing in
      // its markup identifies it: its form posts to /update.php like any other settings page. The
      // identity comes from the URL instead, as the sheet already does for CA's other states.
      root.classList.toggle("cc-ca-settings", /^\/Apps\/ca_settings/i.test(location.pathname));
      // Writing the padding moves the row, so the first measurement only gets part of the way. The
      // function corrects itself, so a second pass once layout has settled lands it, and both are
      // no-ops once aligned.
      ccCaSettingsRows();
      setTimeout(ccCaSettingsRows, 60);
      setTimeout(ccCaSettingsRows, 400);
      // The API settings element mounts asynchronously too, and switching between its sub-tabs
      // remounts it without a page navigation, which nothing else here would notice.
      ccSyncApiTheme();
      setTimeout(ccSyncApiTheme, 60);
      setTimeout(ccSyncApiTheme, 400);
      if (/^\/Settings\/ManagementAccess/i.test(location.pathname)) {
        var ccApiTick = 0, ccApiIv = setInterval(function () { ccSyncApiTheme(); if (++ccApiTick >= 20) clearInterval(ccApiIv); }, 500);
      }
      // The native footer strip is hidden by default; cc.footer brings it back.
      root.classList.toggle("cc-footer-off", g("cc.footer", "1") === "1" && g("cc.theming", "1") !== "0");
      // Unraid's own favorites=no does not hide the Favorites tab, and CC's own nav rule even
      // forces it visible, which the sheet's cc-hide-favtab rule beats.
      root.classList.toggle("cc-hide-favtab", g("cc.hidefavtab", "0") === "1" && g("cc.theming", "1") !== "0");
      // The island's fill chip mirrors the native menu usage bar, which is its data source, so that
      // bar is hidden while the island shows and comes back when it does not.
      root.classList.toggle("cc-usage-isl", on && ccIslandOn());
      // Per-icon hide for the utility icons, and the native state colours. The bell and burger are
      // not in the list: they are integral and handled in ccDockProfile, and a stale key would
      // otherwise blank the icon while leaving its badge.
      ["lang", "search", "logout", "terminal", "browse", "feedback", "info", "log", "help"].forEach(function (k9) { root.classList.toggle("cc-hideicon-" + k9, g("cc.hideicon." + k9, "0") === "1" && g("cc.theming", "1") !== "0"); });
      root.classList.toggle("cc-state-native", g("cc.statenative", "0") === "1" && g("cc.theming", "1") !== "0");
      // a global rainbow flag, so the shared loader can cycle its colour once per revolution
      root.classList.toggle("cc-rb-on", rbOn() && g("cc.theming", "1") !== "0");
      // One representative colour on <html>, so a native button in any sheet can follow the colour
      // mode through var(--cc-rbaccent, var(--cc-accent, …)). The six area scripts stamp --cc-accent
      // on their own pages, but a plain /Settings sub-page has none of them, so without the branch
      // below its buttons fall through to the hardcoded default rather than the configured accent.
      // accent() is the same function rbColor()'s own non-rainbow fallback calls.
      try {
        if (on) { var accA = accent(); root.style.setProperty("--cc-accent", accA); root.style.setProperty("--cc-accent-text", idealText(accA)); }
        else { root.style.removeProperty("--cc-accent"); root.style.removeProperty("--cc-accent-text"); }
        if (on && rbOn()) { var rbA = rbColor(5); root.style.setProperty("--cc-rbaccent", rbA); root.style.setProperty("--cc-rbaccent-text", idealText(rbA)); }
        else { root.style.removeProperty("--cc-rbaccent"); root.style.removeProperty("--cc-rbaccent-text"); }
      } catch (e7) {}
      // cc-tools-on covers the /Tools sub-pages, every native /Settings sub-page and the
      // docker/plugin execution-output pages, but not CC's own settings page, which owns
      // #cc-settings.
      try {
        var p0 = location.pathname, ownPg = /^\/Settings\/CannonadeCommand/.test(p0);
        // The disk and pool detail pages and the boot parameters editor are reka settings forms
        // with the same layout as a /Settings sub-page. They are matched by URL rather than by
        // probing for a fieldset, which races the async render. The /Main root stays native.
        var diskPg = /^\/Main\/(Device|Disk|Boot)\b/.test(p0) || /^\/Settings\/BootParameters\b/.test(p0);
        // CA's settings sub-page is a native Unraid settings form, with the same layout, selects
        // and bare input buttons, so it takes the same treatment rather than one of its own.
        var caSettingsPg = /^\/Apps\/ca_settings/i.test(p0);
        // The container-recreate pages render a native fieldset and legend once they stream, so
        // the fallback below would match them and its generic legend rule would fight the one
        // docker.js already applies there, inflating the badges past either rule on its own.
        var ctOutPg = /^\/(Docker|Apps)\/(AddContainer|UpdateContainer)$/.test(p0);
        // /Users is the user list and editor of /Settings/Users, reached from the header when
        // Unraid's users menu sits there.
        var usersPg = /^\/Users(\/|$)/.test(p0);
        var toolsPg = !ownPg && !ctOutPg && (/^\/Tools\//.test(p0) || /^\/Settings\/./.test(p0) || usersPg || diskPg || caSettingsPg || !!document.querySelector("#displaybox fieldset legend"));
        root.classList.toggle("cc-tools-on", toolsPg && g("cc.theming", "1") !== "0");
        // The disk detail form is a full-width native grid whose labels and values would spread to
        // the screen edges, so the compact grid is kept for these pages alone.
        root.classList.toggle("cc-diskpage", diskPg && toolsPg && g("cc.theming", "1") !== "0");
        // The create-key trigger and its dropdown live on this one sub-page, so the rules for it
        // are scoped here rather than reaching every menu trigger on other /Settings pages.
        var apiKeysPg = /^\/Settings\/ApiKeys\b/.test(p0);
        root.classList.toggle("cc-apikeyspage", apiKeysPg && toolsPg && g("cc.theming", "1") !== "0");
        // The user list carries a page title above its sections and an add button that is the
        // page's action; the header sheet handles both on either address.
        root.classList.toggle("cc-userlist", /^\/(Settings\/)?Users\/?$/.test(p0) && toolsPg && g("cc.theming", "1") !== "0");
      } catch (e0) {}
      ccArrFill();
      ccStateBars();
      ccToolsEnhance();
      ccWrapPageSelects();
      ccPaintRotate();
      ccWatchMain();      // repaints content rendered after this pass
      ccNchanStyle(); paintPopups(); watchPopups();
      ccWireTips();     // on every page: the docker, shares and settings anchors ride it with the header area off too
      try { ccApps(); } catch (e) {}
      // With cc-header-on gone, paintNav() clears every lingering inline rainbow colour, so
      // switching theming off reverts the menu bar instead of leaving the coloured tabs behind.
      if (!on) {
        paintNav(); measureAlign();
        ccIsland();
        ccBrand();
        // styled hover bubbles back to native title balloons
        var tps0 = document.querySelectorAll("#menu [data-cc-tip]");
        for (var tq = 0; tq < tps0.length; tq++) { tps0[tq].setAttribute("title", tps0[tq].getAttribute("data-cc-tip")); tps0[tq].removeAttribute("data-cc-tip"); }
        ccTipHide();
        ccUndockProfile();
        return;   // measureAlign() ran above, since the other areas still align to the native menu-text edge
      }
      // The utility icons' titles become CC bubbles, because the OS balloon cannot be styled.
      var tps1 = document.querySelectorAll("#menu .nav-item.util a[title], #menu .usage-bar [title]");
      for (var tr1 = 0; tr1 < tps1.length; tr1++) { var th = tps1[tr1]; th.setAttribute("data-cc-tip", th.getAttribute("title")); th.removeAttribute("title"); }
      var a = accent();
      // The menu bar owns its own accent var: the other global enhancers write --cc-accent on
      // documentElement and would clobber this colour, and the reverse.
      root.style.setProperty("--cc-hdr-accent", a);
      root.style.setProperty("--cc-hdr-accent-text", idealText(a));
      root.classList.toggle("cc-header-rb", rbOn());
      applyNavOrder();  // before painting and measuring, since it reorders the DOM
      setupNavDrag();
      paintNav();
      ccTabIcons();     // before measureAlign: inserting an icon changes the tab width
      measureAlign();   // once the pill geometry is live
      ccTabStrip();
      ccIsland();
      ccBrand();
      watchIsland();
      watchProfile();
      ccDockProfile();
      ccArrangeLock();
      // The first pass can run before late-loading icons and styles have finished shifting the
      // row, so the dock is re-adopted twice more once the layout has settled. Adoption puts the
      // trigger into the native flow, so nothing has to track it per frame afterwards.
      setTimeout(ccDockProfile, 300); setTimeout(ccDockProfile, 1200);
    } catch (e) {}
  }
  // gui_search() prepends its box at the far left of the right tile, focuses the input and closes
  // the search on that input's focusout. The field belongs directly left of the magnifier, but
  // moving the span blurs the focused input, which fires that focusout and closes the search
  // before it appears. So the span is placed with flex order alone: no DOM move, no blur, and an
  // attribute change rather than a childList mutation, which never re-triggers the observer.
  function reorderSearch() {
    try {
      var root = document.documentElement;
      if (!root.classList.contains("cc-header-on") || root.classList.contains("Theme--sidebar")) return;
      var right = document.querySelector("#menu .nav-tile.right");
      if (!right) return;
      var kids = right.children, j;
      var span = document.getElementById("guiSearchBoxSpan");
      if (!span) { for (j = 0; j < kids.length; j++) kids[j].style.removeProperty("order"); return; }
      var toggle = right.querySelector('[onclick*="gui_search"]');
      toggle = toggle ? toggle.closest(".nav-item") : right.querySelector(".nav-item.gui_search");
      if (!toggle) { for (j = 0; j < kids.length; j++) kids[j].style.removeProperty("order"); return; }
      var order = 0;
      for (j = 0; j < kids.length; j++) {
        if (kids[j] === span) continue;                 // it is placed just before the toggle below
        if (kids[j] === toggle) { span.style.setProperty("order", order); order++; }
        kids[j].style.setProperty("order", order); order++;
      }
    } catch (e) {}
  }
  function watchSearch() {
    try {
      var target = document.getElementById("menu") || document.body;
      // A synchronous callback here ping-pongs with Connect's auto-mount observer, whose rebuilds
      // refire this one and whose own observer the reorder refires. The timer hop lets the event
      // loop breathe and coalesces the rebuild burst into one pass; applyNavOrder covers the rest.
      var moT = null;
      var mo = new MutationObserver(function () {
        if (moT) return;
        moT = setTimeout(function () {
          moT = null;
          reorderSearch();
          document.documentElement.classList.toggle("cc-search-open", !!document.getElementById("guiSearchBoxSpan"));
          // gui_search opens an empty field that says nothing about what it finds; on the Docker
          // tab it filters the containers too (docker.js followHeaderSearch)
          var sbox = document.getElementById("guiSearchBox");
          if (sbox && !sbox.getAttribute("placeholder")) sbox.setAttribute("placeholder", /^\/Docker\/?$/.test(location.pathname) ? T("Container oder Seite suchen", "Search containers and pages") : T("Seite oder Einstellung suchen", "Search pages and settings"));
          // A utility icon the native scripts append after boot gets its saved slot and its drag
          // wiring here; applyNavOrder is a no-op once the arrangement matches.
          if (document.documentElement.classList.contains("cc-header-on")) { applyNavOrder(); setupNavDrag(); }
          paintNav();
          ccDockProfile();   // the icon row shifts when the search box opens or an icon arrives late
        }, 120);
      });
      mo.observe(target, { childList: true, subtree: true });
    } catch (e) {}
  }
  // gui_search() only opens on a click, so a second click on the magnifier closes it here. The
  // delegated capture-phase listener runs before the toggle's own inline onclick.
  function wireSearchToggle() {
    // A real click on the magnifier first blurs the search input, whose focusout closes the box, so
    // by click time the box is already gone and the inline gui_search() reopens it. Remembering
    // whether it was open at mousedown, before the blur, is what tells the two cases apart.
    var searchWasOpen = false;
    function onToggle(e) { return e.target && e.target.closest ? e.target.closest(".nav-item.gui_search, [onclick*='gui_search']") : null; }
    function closeSearch(ev) {
      try { if (typeof window.closeSearchBox === "function") window.closeSearchBox(ev); } catch (e3) {}
      var s = document.getElementById("guiSearchBoxSpan"); if (s && s.parentNode) s.parentNode.removeChild(s);
      var hid = document.querySelectorAll(".nav-item.util, .nav-user.show");
      for (var i = 0; i < hid.length; i++) hid[i].style.removeProperty("display"); // restore what gui_search hid
      document.documentElement.classList.remove("cc-search-open");
    }
    document.addEventListener("mousedown", function (e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) { searchWasOpen = false; return; }
        if (onToggle(e)) { searchWasOpen = !!document.getElementById("guiSearchBoxSpan"); return; }
        searchWasOpen = false;
        // a click outside the search span while it is open closes it too
        var span = document.getElementById("guiSearchBoxSpan");
        if (span && !(e.target && e.target.closest && e.target.closest("#guiSearchBoxSpan"))) closeSearch(e);
      } catch (err) {}
    }, true);
    document.addEventListener("click", function (e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) return;
        if (!onToggle(e)) return;
        if (!searchWasOpen && !document.getElementById("guiSearchBoxSpan")) return; // it was closed, so let the native handler open it
        searchWasOpen = false;
        e.preventDefault(); e.stopImmediatePropagation(); // keep the inline gui_search() from reopening it
        closeSearch(e);
      } catch (err) {}
    }, true);
    document.addEventListener("keydown", function (e) { try { if (e.key === "Escape" && document.getElementById("guiSearchBoxSpan")) closeSearch(e); } catch (err) {} });
  }
  var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
  // After an update, a one-shot toast names the new version. Never on the first install, which has
  // no baseline to compare against, and never in a dev build.
  function ccWhatsNew() {
    try {
      if (CC_VER === "dev") return;
      if (g("cc.theming", "1") === "0") return;
      var last = g("cc.lastver", "");
      if (last && last !== CC_VER) { setTimeout(function () { ccToast(T("CannonadeCommand auf v" + CC_VER + " aktualisiert.", "CannonadeCommand updated to v" + CC_VER + ".")); }, 1400); }
      if (last !== CC_VER) syncedSet("cc.lastver", CC_VER);
    } catch (e) {}
  }
  // This file is the only CC script on the Apps tab, and it stamps no accent var on the root there,
  // so without this pass CA's badges fall back to the default blue in both colour modes. It stamps
  // --cc-rb-c per element, which rbColor() resolves to the accent or to a rotating slot, and moves
  // each home-section subtitle into the shared bubble. No subtree observer on the card tree, which
  // froze the tab: a childList observer on #templates_content catches CA's view swaps, and a
  // re-stamp rides the nav clicks.
  // The plugin has one (i) glyph, which cc-theme.js owns; this is the fallback for a page that
  // loads without it.
  function ccMakeInfo(tip) {
    if (window.CCTheme && window.CCTheme.infoIcon) return window.CCTheme.infoIcon(tip);
    var s = document.createElement("span"); s.className = "cc-info";
    s.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>';
    s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); s.setAttribute("tabindex", "0");
    return s;
  }
  function ccAppsStamp(sel) {
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var c = rbColor(i);
      els[i].style.setProperty("--cc-rb-c", c);
      els[i].style.setProperty("--cc-rb-ct", idealText(c));
    }
  }
  // CA's full-width search becomes a collapsible badge: a magnifier that expands into an input on
  // click, as the CC settings search does. data-cc-search keeps it idempotent, so it re-wires after
  // a CA view swap, and the reopen block runs in the capture phase.
  function wireCaSearch() {
    try {
      var filter = document.getElementById("searchFilter");
      if (!filter) return;
      // The badge moves out of the top-right search bar to the top of the left sidebar, first in
      // CA's first list so the tab order starts there too. CA rebuilds that sidebar on a view
      // swap, so the next ccApps pass re-homes it. The li carries no .caMenuItem: CA's menu
      // handler would take a click into the field for a menu choice and drop the open category.
      var caMenu = document.querySelector("ul.caMenu");
      if (caMenu) {
        var li = document.getElementById("cc-ca-search-li");
        if (!li) { li = document.createElement("li"); li.id = "cc-ca-search-li"; li.className = "cc-ca-search-li"; }
        if (filter.parentElement !== li) li.appendChild(filter);
        // Re-inserting the node on every pass would blur the input mid-typing, so it only moves
        // when it is somewhere else.
        if (li.parentElement !== caMenu) caMenu.insertBefore(li, caMenu.firstChild);
      }
      // cc-open is runtime state the handlers below own, never stamped here: ccApps re-runs on
      // every category and magnifier click, so a stamp would reopen the badge behind any collapse.
      // CA's markup carries no label text, so one is injected. Above the idempotency guard, which
      // is right for listeners, bound once per node, and wrong for DOM content, which has to be
      // repairable when CA rewrites the container's children but keeps the node.
      var lb = filter.querySelector(".cc-ca-search-label");
      if (!lb) {
        lb = document.createElement("span");
        lb.className = "cc-ca-search-label";
        filter.appendChild(lb);
      }
      var lbText = T("Apps durchsuchen", "Search apps");
      if (lb.textContent !== lbText) lb.textContent = lbText;
      if (filter.getAttribute("data-cc-search") === "1") return;
      filter.setAttribute("data-cc-search", "1");
      var box = document.getElementById("searchBox");
      // While typing, a class on <html> lets the suggestion popup grow past the narrow sidebar and
      // dims the page behind it. The suggestion list is re-anchored fixed, clear of the sidebar.
      if (box) {
        var caFlag = function () {
          var on = !!(box.value && box.value.trim());
          document.documentElement.classList.toggle("cc-ca-searching", on);
          if (on) { ccPositionCaResults(filter); requestAnimationFrame(function () { ccPositionCaResults(filter); }); }
        };
        box.addEventListener("input", caFlag);
        box.addEventListener("keyup", caFlag);
        box.addEventListener("focus", caFlag);
        box.addEventListener("blur", function () {
          setTimeout(function () {
            document.documentElement.classList.remove("cc-ca-searching");
            // An empty field turns back into the badge once the focus has left it. With text in
            // it, it stays open, since a click on a suggestion blurs the box before it lands.
            if (!box.value && document.activeElement !== box && filter.closest("li.cc-ca-search-li")) {
              filter.classList.remove("cc-open");
              document.documentElement.classList.remove("cc-ca-searchopen");
            }
          }, 200);
        });
        // Tab reaches the input while the field is still collapsed, so focus opens it like a click.
        box.addEventListener("focus", function () {
          if (filter.classList.contains("cc-open") || !filter.closest("li.cc-ca-search-li")) return;
          filter.classList.add("cc-open");
          document.documentElement.classList.add("cc-ca-searchopen");
        });
      }
      // Delegated on the whole chip rather than on the magnifier, so a click on the icon or the
      // label opens it and a CA re-render of the inner icon cannot orphan the handler. The open
      // state is latched at mousedown, for the reason wireSearchToggle above gives.
      var caWasOpen = false;
      filter.addEventListener("mousedown", function () { caWasOpen = filter.classList.contains("cc-open"); }, true);
      filter.addEventListener("click", function (e) {
        try {
          if (caWasOpen || filter.classList.contains("cc-open")) return;   // already open, so leave CA's own submit alone
          // CA swaps the magnifier for a clear icon once a query is active, and a click then means
          // clear rather than open. Without this check the capture-phase handler would stop that
          // click along with the one it is here to intercept.
          var btn = filter.querySelector("#searchButton");
          if (btn && btn.classList.contains("fa-remove")) return;
          e.preventDefault(); e.stopPropagation();
          filter.classList.add("cc-open");
          // The expanded field leaves the sidebar column and overlays the app grid, so the
          // sidebar's stacking context is lifted right away; waiting for the typing class would
          // paint the panel under the cards until the first keystroke.
          document.documentElement.classList.add("cc-ca-searchopen");
          if (box) box.focus();
        } catch (e2) {}
      }, true);
    } catch (e) {}
  }
  // The collapse is bound once per document, and never on focusout: the suggestion list is fixed
  // and visually outside the field but still a DOM descendant, so a focusout collapse would fire on
  // pointerdown over a suggestion and destroy the list before its own click landed. Bubble phase
  // and no stopPropagation, or it would swallow the click for every CA control underneath.
  function ccWireCaSearchCollapse() {
    try {
      if (window.__ccCaSearchDoc) return;
      window.__ccCaSearchDoc = 1;
      function collapse() {
        var f = document.getElementById("searchFilter");
        if (!f || !f.classList.contains("cc-open")) return;
        if (!f.closest("li.cc-ca-search-li")) return;      // the top-bar variant keeps its own behaviour
        f.classList.remove("cc-open");
        var b = document.getElementById("searchBox");
        if (b && b.value) {                                 // reset CA's own filter through its own listeners
          b.value = "";
          b.dispatchEvent(new Event("input", { bubbles: true }));
          b.dispatchEvent(new Event("keyup", { bubbles: true }));
        }
        try { b && b.blur(); } catch (e) {}
        document.documentElement.classList.remove("cc-ca-searching");   // or the dim outlives the field
        document.documentElement.classList.remove("cc-ca-searchopen");
      }
      document.addEventListener("click", function (e) {
        var f = document.getElementById("searchFilter");
        if (!f || !f.contains(e.target)) collapse();        // contains() counts the fixed suggestion list as inside
      });
      // Escape is listened for in the capture phase, because awesomplete binds its own handler to
      // close the suggestion list and the event never reaches a bubble-phase listener. It only
      // listens and never stops propagation, or it would swallow Escape for the controls underneath.
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") collapse(); }, true);
      // collapse() above cancels, clearing the term, which is right for a dismissal and wrong after
      // an actual search, where it would wipe the query CA is about to filter by. Awesomplete fires
      // awesomplete-selectcomplete for a click on a suggestion and for Enter on a highlighted one,
      // and CA listens to the same event. A plain Enter with nothing highlighted reaches neither,
      // since awesomplete intercepts the key only while a suggestion is selected, so a direct Enter
      // listener on the box covers that without depending on its internal state.
      function submitCollapse() {
        var f = document.getElementById("searchFilter");
        if (!f || !f.classList.contains("cc-open")) return;
        if (!f.closest("li.cc-ca-search-li")) return;
        f.classList.remove("cc-open");
        document.documentElement.classList.remove("cc-ca-searching");
        document.documentElement.classList.remove("cc-ca-searchopen");
        try { box && box.blur(); } catch (e2) {}
      }
      var box = document.getElementById("searchBox");
      if (box) {
        box.addEventListener("awesomplete-selectcomplete", submitCollapse);
        box.addEventListener("keydown", function (e) { if (e.key === "Enter") submitCollapse(); });
      }
    } catch (e) {}
  }
  // Anchors the suggestion popup fixed, so the narrow sidebar cannot clip it. Re-applied on every
  // keystroke, because awesomplete rewrites the list and its inline offsets on each render.
  function ccPositionCaResults(filter) {
    try {
      var ul = filter.querySelector(".awesomplete > ul"); if (!ul || ul.hasAttribute("hidden")) return;
      var r = filter.getBoundingClientRect();
      ul.style.setProperty("position", "fixed", "important");
      // The field opens to the right at the panel's own width, so the list sits directly beneath
      // it, left-aligned and exactly as wide: one panel rather than two boxes side by side.
      ul.style.setProperty("left", Math.round(r.left) + "px", "important");
      ul.style.setProperty("top", Math.round(r.bottom + 6) + "px", "important");
      ul.style.setProperty("width", Math.round(r.width) + "px", "important");
      ul.style.setProperty("min-width", "0", "important");
      ul.style.setProperty("max-width", "none", "important");
      ul.style.setProperty("bottom", "auto", "important");
      ul.style.setProperty("right", "auto", "important");
    } catch (e) {}
  }
  // A group heading for the sidebar: the section badge of the group's card, and the card itself.
  // It goes first in its list, where no CA entry has it as the sibling its click handler opens, and
  // Tokens.css moves it to its group by data-cc-group. The card travels with its heading, so CA
  // rewriting the category list takes both and the next pass brings both back.
  function ccEyebrow(list, group, text) {
    var h = list.querySelector(':scope > li.cc-ca-eyebrow[data-cc-group="' + group + '"]');
    if (!h) {
      h = document.createElement("li");
      h.className = "cc-ca-eyebrow";
      h.setAttribute("data-cc-group", group);
      h.appendChild(document.createElement("span"));
      var card = document.createElement("div");
      card.className = "cc-ca-card";
      h.appendChild(card);
      list.insertBefore(h, list.firstChild);
    }
    if (h.firstChild.textContent !== text) h.firstChild.textContent = text;
  }
  // CA's entries cannot be wrapped in a card without breaking its click handler, so each group's
  // card is a plate behind its rows, from the centre of the heading's badge to the last row the
  // group shows. A row's group is its CSS order, which Tokens.css sets in steps of ten.
  var ccCardRo = null, ccCardMenu = null;
  function ccAppsCards() {
    try {
      var menu = document.querySelector(".ca_display_area .menuItems");
      if (!menu) return;
      if (menu !== ccCardMenu && window.ResizeObserver) {
        if (ccCardRo) ccCardRo.disconnect();
        ccCardMenu = menu;
        ccCardRo = new ResizeObserver(ccAppsCards);   // a sub-list opening, the categories arriving
        ccCardRo.observe(menu);
      }
      var top0 = menu.getBoundingClientRect().top, heads = {}, ends = {};
      var lis = menu.querySelectorAll("ul.caMenu > li");
      for (var i = 0; i < lis.length; i++) {
        var li = lis[i];
        if (!li.getClientRects().length) continue;
        var g = Math.min(4, Math.floor((parseInt(getComputedStyle(li).order, 10) || 0) / 10));
        if (!g) continue;
        if (li.classList.contains("cc-ca-eyebrow")) heads[g] = li;
        else ends[g] = Math.max(ends[g] || 0, li.getBoundingClientRect().bottom - top0);
      }
      for (var k in heads) {
        var card = heads[k].querySelector(":scope > .cc-ca-card");
        if (card.hidden !== !ends[k]) card.hidden = !ends[k];
        if (!ends[k]) continue;
        var b = heads[k].firstChild.getBoundingClientRect(), top = b.top + b.height / 2 - top0;
        // the card's inset below its last row, as at its sides
        var t = Math.round(top) + "px", ht = Math.round(ends[k] + 8 - top) + "px";
        if (card.style.top !== t) card.style.top = t;
        if (card.style.height !== ht) card.style.height = ht;
      }
    } catch (e) {}
  }
  // The results-per-page control and the Docker Hub badge live in CA's search area in the main
  // column. Docker Hub belongs to a search and goes under the sidebar field; results per page is a
  // preference and becomes a row of the Community Apps group. The real nodes are moved, never
  // cloned, or their click handlers would be left behind, and a pass that finds them home is a no-op.
  function ccMoveSearchAreaBadges() {
    try {
      var searchLi = document.querySelector("li.cc-ca-search-li");
      var filter = document.getElementById("searchFilter");
      if (!searchLi || !filter) return;
      var host = searchLi.querySelector(":scope > .cc-ca-search-extras");
      if (!host) {
        host = document.createElement("div");
        host.className = "cc-ca-search-extras";
        filter.parentNode === searchLi ? searchLi.insertBefore(host, filter.nextSibling) : searchLi.appendChild(host);
      }
      var dh = document.querySelector(".searchArea .dockerSearch");
      if (dh && dh.parentNode !== host) host.appendChild(dh);
      var mpp = document.getElementById("maxPerPage");
      var meta = document.querySelector(".menuItems > ul.caMenu:last-child");
      if (mpp && meta) {
        var row = meta.querySelector(":scope > li.cc-ca-perpage-li");
        if (!row) { row = document.createElement("li"); row.className = "cc-ca-perpage-li"; meta.appendChild(row); }
        if (mpp.parentNode !== row) row.appendChild(mpp);
      }
      // CA appends the per-page dropdown to <body> and positions it with offsets computed for the
      // control's old home, so after the move it opens near the page corner. One corrective write
      // loses: CA fades the node in and keeps touching its style across several frames, so the
      // correction has to cover the whole animation rather than one or two beats.
      if (mpp && !mpp.getAttribute("data-cc-dd-wired")) {
        mpp.setAttribute("data-cc-dd-wired", "1");
        mpp.addEventListener("click", function () {
          function place() {
            var dd = document.getElementById("dropdown-maxPerPage");
            if (!dd || getComputedStyle(dd).display === "none") return;
            var r = mpp.getBoundingClientRect();
            dd.style.setProperty("position", "fixed", "important");
            dd.style.setProperty("left", Math.round(r.left) + "px", "important");
            dd.style.setProperty("top", Math.round(r.bottom + 6) + "px", "important");
            dd.style.setProperty("right", "auto", "important"); dd.style.setProperty("bottom", "auto", "important");
          }
          [0, 20, 40, 60, 90, 120, 160, 210, 270, 340, 420, 500].forEach(function (ms) { setTimeout(place, ms); });
        });
      }
    } catch (e) {}
  }
  // CA appends the live count to its own label, which a sidebar row has no room for. The tail is
  // stripped on every pass, so it stays gone after a different per-page value is picked.
  function ccAppsStripCount() {
    try {
      var mpp = document.querySelector(".cc-ca-perpage-li .caButton.maxPerPage");
      if (!mpp) return;
      var m = /^(.*?):\s*[\d,]+\s*$/.exec((mpp.textContent || "").trim());
      if (m) mpp.textContent = m[1];
    } catch (e) {}
  }
  // CA's sidebar entries keep their place in CA's lists, because its click handler opens whatever
  // follows the clicked entry; Tokens.css orders them into groups. This pass adds what CA lacks: a
  // heading per group, a mark on each half of the version line and keyboard access to the rows.
  function ccAppsGroups() {
    try {
      var main = document.querySelector(".menuItems > ul.caMenu:first-child");
      var cats = document.querySelector("#category_list > ul.caMenu");
      var meta = document.querySelector(".menuItems > ul.caMenu:last-child");
      if (main) {
        ccEyebrow(main, "mine", T("Meine Apps", "My apps"));
        ccEyebrow(main, "discover", T("Entdecken", "Discover"));
      }
      // CA rewrites the category list on every load of it, which takes the heading along.
      if (cats) ccEyebrow(cats, "categories", T("Kategorien", "Categories"));
      if (meta && meta !== main) {
        ccEyebrow(meta, "ca", "Community Apps");
        // The label and the number have no class of their own. Each is found by itself, the label
        // by its text and the number by CA's id, since CA puts an <hr> between them on some renders.
        var num = meta.querySelector("#caInstalledVersion");
        if (num && num.closest("li")) num.closest("li").classList.add("cc-ca-ver-num");
        for (var i = 0; i < meta.children.length; i++) {
          var n = meta.children[i];
          if (!n.children.length && /^version$/i.test((n.textContent || "").trim())) n.classList.add("cc-ca-ver-label");
        }
      }
      // CA's entries are plain list items with no tab stop. The rows become one tab stop, the
      // open entry or the first row, and the arrow keys walk them in the order they are shown,
      // which is not CA's DOM order. Enter or Space clicks a row through CA's own handler; Support
      // is a real link and answers Enter itself.
      var rows = ccSidebarRows();
      for (var k = 0; k < rows.length; k++) {
        var r = rows[k];
        if (r.hasAttribute("tabindex")) continue;
        r.setAttribute("tabindex", "-1");
        if (r.tagName !== "A") r.setAttribute("role", "button");
      }
      if (rows.length && !rows.some(function (x) { return x.getAttribute("tabindex") === "0"; })) {
        rows.filter(function (x) { return x.classList.contains("selectedMenu"); }).concat(rows)[0].setAttribute("tabindex", "0");
      }
      var menu = document.querySelector(".menuItems");
      if (menu && !menu.hasAttribute("data-cc-keys")) {
        menu.setAttribute("data-cc-keys", "1");
        menu.addEventListener("focusin", function (e) {
          var all = ccSidebarRows();
          if (all.indexOf(e.target) < 0) return;
          all.forEach(function (x) { x.setAttribute("tabindex", x === e.target ? "0" : "-1"); });
        });
        menu.addEventListener("keydown", function (e) {
          var t = e.target, all = ccSidebarRows(), i = all.indexOf(t);
          if (i < 0) return;
          var to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
          if (to !== undefined) {
            e.preventDefault();
            if (all[to]) all[to].focus();
            return;
          }
          if ((e.key === "Enter" || e.key === " ") && t.tagName !== "A") {
            e.preventDefault();
            t.click();
          }
        });
      }
    } catch (e) {}
  }
  // The rows a keyboard can reach, top to bottom as shown. A hidden row, such as a closed sub-list
  // or an Action Centre CA has nothing for, has no client rects and is left out.
  function ccSidebarRows() {
    var all = document.querySelectorAll(".menuItems li.caMenuItem, .menuItems li.subCategory > ul.caMenuItem, #maxPerPage, .cc-ca-search-extras > .dockerSearch");
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].querySelector("hr")) continue;
      var t = all[i].querySelector(":scope > a") || all[i];
      if (t.getClientRects().length) out.push(t);
    }
    return out.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
  }
  function ccAppsAlignRight() {
    try {
      var rTile = document.querySelector("#menu .nav-tile.right");
      if (!rTile) return;
      var gutter = rTile.getBoundingClientRect().right - (parseFloat(getComputedStyle(rTile).paddingRight) || 0);
      var heads = document.querySelectorAll(".ca_homeTemplatesHeader");
      for (var i = 0; i < heads.length; i++) {
        var more = heads[i].querySelector(".homeMore"); if (!more) continue;
        // The new padding comes from where the button actually landed against the gutter, nudged
        // by that delta. Computing it from the parent's rect needs assumptions about the container
        // that do not hold: its border-box right includes its own padding, and #displaybox is a
        // different box again. This form converges to no delta at all.
        var cur = parseFloat(heads[i].style.paddingRight) || 0;
        var delta = more.getBoundingClientRect().right - gutter;
        if (Math.abs(delta) < 0.5) continue;                       // already flush, so no write
        var pad = Math.round(cur + delta);
        if (pad >= 0 && pad < 200) heads[i].style.setProperty("padding-right", pad + "px", "important");
      }
    } catch (e) {}
  }
  // The first section row lines up with the top of the sidebar, the search field, or the home
  // entry where there is none. The two differ in height, so their vertical centres are aligned
  // rather than their tops, and it is measured, since a static margin drifts with the font size,
  // the badge tier and the theme. Only the first row is nudged; its margin collapses out of the
  // container, which pulls the whole column up, and the rows below keep their own rhythm. The open
  // field has left the column, so it is not measured.
  function ccAppsAlignTop() {
    try {
      var home = document.querySelector("li.cc-ca-search-li > #searchFilter") || document.querySelector("ul.caMenu > li.startupButton");
      if (home && home.classList.contains("cc-open")) return;
      var head = document.querySelector(".ca_homeTemplatesHeader"); if (!home || !head) return;
      var badge = head.querySelector(".cc-sechead-badge") || head;
      var hr = home.getBoundingClientRect(), br = badge.getBoundingClientRect();
      if (!hr.height || !br.height) return;
      var delta = (hr.top + hr.height / 2) - (br.top + br.height / 2);
      if (Math.abs(delta) < 0.5) return;                       // already level, so no write
      var cur = parseFloat(head.style.marginTop);
      if (isNaN(cur)) cur = parseFloat(getComputedStyle(head).marginTop) || 0;
      var mt = Math.round(cur + delta);
      if (mt > -80 && mt < 80) head.style.setProperty("margin-top", mt + "px", "important");   // bounded against a bad measurement
    } catch (e) {}
  }
  // The corner marks stack as badges at the card's top right. CA emits a ribbon as a sibling of the
  // card and positions it with its own offsets, which beat a CSS re-anchor; moving it into the card
  // puts both marks in the same containing block, where one rule stacks them.
  function ccAppsCornerMarks() {
    try {
      var marks = document.querySelectorAll(".officialCardBackground, .LTOfficialCardBackground, .installedCardBackground, .betaCardBackground");
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        if (m.closest(".ca_holder")) continue;                 // already inside its card
        var slot = m.parentElement; if (!slot) continue;
        var card = slot.querySelector(".ca_holder"); if (!card) continue;
        card.appendChild(m);
      }
    } catch (e) {}
  }
  // The download count and the last-updated month on each card face, as ca.unraid.net shows them.
  // CA's own card never does: it fetches them per app when the Info popup opens. But CA already
  // caches the whole catalog locally, and server/castats.php reads that cache once and returns a
  // map keyed by name and repository, rather than one round trip per card. Fetched once per page
  // load and applied on every ccApps() pass, so a card rendered later gets it too. Without CA, its
  // cache or a format it still understands, the stat line stays empty and the card is fine.
  var ccCaStats = null, ccCaStatsWanted = false;
  function ccCaStatsFetch() {
    if (ccCaStats || ccCaStatsWanted) return;
    ccCaStatsWanted = true;
    fetch("/plugins/cannonadecommand/server/castats.php").then(function (r) { return r.json(); })
      .then(function (d) { ccCaStats = (d && typeof d === "object") ? d : {}; ccApps(); })
      .catch(function () { ccCaStats = {}; });
  }
  function ccFmtCompact(n) {
    try { return new Intl.NumberFormat(LANG === "de" ? "de-DE" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n); }
    catch (e) { return String(n); }
  }
  function ccFmtMonth(ts) {
    var d = new Date(ts * 1000);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }
  // The update action string from an installed app's own Actions dropdown, or null. CA's context
  // attribute carries the same data its native menu renders, and an update entry appears there only
  // when an update is actually available.
  function ccAppsUpdateAction(holder) {
    var ctx = holder.querySelector(".actionsButtonContext"); if (!ctx) return null;
    var raw = ctx.getAttribute("data-context"); if (!raw) return null;
    var arr; try { arr = JSON.parse(raw); } catch (e) { return null; }
    if (!Array.isArray(arr)) return null;
    for (var i = 0; i < arr.length; i++) { if (arr[i].action && /updateDocker\(/.test(arr[i].action)) return arr[i].action; }
    return null;
  }
  // Every card carries this row: a downloads badge, an updated badge and one call to action in
  // three states. Not installed shows the real native button, moved in so its own click handler
  // keeps working; installed with an update shows a badge that runs the action string from CA's own
  // context, the same trust boundary ccAppsCardMenu() uses; installed without one shows an inert
  // status badge. The two states that do not apply stay hidden rather than removed, so a re-run is
  // a toggle rather than a rebuild.
  function ccAppsStatRow(holder) {
    var name = holder.getAttribute("data-appname"), repo = holder.getAttribute("data-repository");
    var rec = (ccCaStats && name && repo) ? ccCaStats[name + "|" + repo] : null;
    var row = holder.querySelector(".cc-castats");
    if (!row) { row = document.createElement("div"); row.className = "cc-castats"; holder.appendChild(row); }
    // The ribbons share this row, aligned left, while the three badges stay right. The row holds
    // two groups rather than one flush-right cluster, so the triplet needs its own wrapper or it
    // would spread out across the row.
    var right = row.querySelector(".cc-cs-right");
    if (!right) {
      right = document.createElement("div"); right.className = "cc-cs-right";
      right.appendChild(document.createElement("span")).className = "cc-cs-d";
      right.appendChild(document.createElement("span")).className = "cc-cs-u";
      var cta = document.createElement("span"); cta.className = "cc-cs-cta"; right.appendChild(cta);
      row.appendChild(right);
    }
    // A badge with no data is hidden rather than showing a placeholder. The two spans are
    // display:inline-flex with !important in Tokens.css, so the hide has to carry !important too.
    var dSpan = right.querySelector(".cc-cs-d"), uSpan = right.querySelector(".cc-cs-u"), ctaEl = right.querySelector(".cc-cs-cta");
    var dTxt = (rec && rec.d != null) ? ccFmtCompact(rec.d) : "";
    var uTxt = (rec && rec.u != null) ? ccFmtMonth(rec.u) : "";
    if (dSpan.textContent !== dTxt) dSpan.textContent = dTxt;   // written only on a change, so a repeat pass churns nothing
    if (uSpan.textContent !== uTxt) uSpan.textContent = uTxt;
    if (dTxt) dSpan.style.removeProperty("display"); else dSpan.style.setProperty("display", "none", "important");
    if (uTxt) uSpan.style.removeProperty("display"); else uSpan.style.setProperty("display", "none", "important");
    dSpan.title = T("Downloads", "Downloads");
    uSpan.title = T("Aktualisiert", "Updated");

    // The call to action's display is !important in Tokens.css, where it has to beat the badge
    // shape rules, so hiding it needs !important as well; clearing the property is enough to show
    // it again.
    var plainInstall = holder.querySelector(".ca_bottomLine .actionsButton:not(.actionsButtonContext)");
    var updateAction = ccAppsUpdateAction(holder);
    var installed = !!holder.querySelector(".actionsButtonContext");
    if (plainInstall) {
      ctaEl.style.setProperty("display", "none", "important");
      if (plainInstall.parentElement !== right) right.appendChild(plainInstall);
    } else if (updateAction) {
      ctaEl.style.removeProperty("display");
      ctaEl.classList.add("cc-cs-cta-update"); ctaEl.classList.remove("cc-cs-cta-installed");
      var uWord = T("Update", "Update");
      if (ctaEl.textContent !== uWord) ctaEl.textContent = uWord;
      ctaEl.onclick = function (e) { e.preventDefault(); e.stopPropagation(); try { (new Function(updateAction))(); } catch (err) {} };
    } else if (installed) {
      ctaEl.style.removeProperty("display");
      ctaEl.classList.add("cc-cs-cta-installed"); ctaEl.classList.remove("cc-cs-cta-update");
      var iWord = T("Installiert", "Installed");
      if (ctaEl.textContent !== iWord) ctaEl.textContent = iWord;
      ctaEl.onclick = null;
    } else {
      ctaEl.style.setProperty("display", "none", "important");   // a late-rendering card resolves neither state yet, and the next pass catches it
    }
  }
  // Info, support and an installed app's actions fold into one corner menu. It is built from data
  // CA itself computed, the same context arrays its own dropdown renders, plus a direct click on
  // the untouched native Info button, so the behaviour stays CA's: a support link opens the same
  // URL, an actions entry runs CA's own call. Only the presentation is different.
  var ccCaMenuOpen = null;
  function ccCaMenuClose() { if (ccCaMenuOpen) { ccCaMenuOpen.remove(); ccCaMenuOpen = null; } }
  function ccAppsCardMenu(holder) {
    if (holder.querySelector(".cc-ca-menu-btn")) return;
    var infoBtn = holder.querySelector(".infoButton");
    var supportBtn = holder.querySelector(".supportButtonCardContext, .supportButton");
    var actionsCtx = holder.querySelector(".actionsButtonContext");
    if (!infoBtn && !supportBtn && !actionsCtx) return;
    var items = [];
    if (infoBtn) items.push({ text: T("Info", "Info"), run: function () { infoBtn.click(); } });
    function pushContext(btn) {
      if (!btn) return;
      var raw = btn.getAttribute("data-context"); if (!raw) return;
      var arr; try { arr = JSON.parse(raw); } catch (e) { return; }
      if (!Array.isArray(arr)) return;
      arr.forEach(function (it) {
        if (it.divider) { items.push({ divider: true }); return; }
        if (it.link) { items.push({ text: it.text || it.link, run: function () { window.open(it.link, "_blank"); } }); return; }
        // The update entry is already the card's primary badge, so it is skipped here rather than
        // offered twice on the same card.
        if (it.action && /updateDocker\(/.test(it.action)) return;
        // CA's own dropdown runs this exact string from an inline onclick, so the trust boundary
        // is the same one; here it waits for a click.
        if (it.action) { items.push({ text: it.text || "", run: function () { try { (new Function(it.action))(); } catch (e) {} } }); return; }
      });
    }
    pushContext(supportBtn);
    pushContext(actionsCtx);
    if (!items.length) return;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "cc-ca-menu-btn"; btn.setAttribute("aria-label", T("Mehr", "More"));
    btn.innerHTML = "<span></span><span></span><span></span>";
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (ccCaMenuOpen) { ccCaMenuClose(); return; }
      // Rendered into <body>, fixed and measured off the button: the card clips overflow, so a
      // dropdown positioned inside it would be cut off, as with the info bubble.
      var menu = document.createElement("div"); menu.className = "cc-ca-menu";
      items.forEach(function (it) {
        if (it.divider) { menu.appendChild(document.createElement("hr")); return; }
        var row = document.createElement("div"); row.className = "cc-ca-menu-item"; row.textContent = it.text;
        row.addEventListener("click", function (e2) { e2.preventDefault(); e2.stopPropagation(); ccCaMenuClose(); it.run(); });
        menu.appendChild(row);
      });
      document.body.appendChild(menu);
      // The button itself is in ccAppsStamp's sweep, but the menu renders into body fresh on every
      // open, a separate branch the page-wide sweep cannot catch in time, so its items are stamped
      // here as they are created.
      ccAppsStamp(".cc-ca-menu-item");
      var r = btn.getBoundingClientRect(), mr = menu.getBoundingClientRect();
      var m = window.CCTheme.edge();
      menu.style.left = Math.max(m, Math.min(r.right - mr.width, window.innerWidth - mr.width - m)) + "px";
      menu.style.top = (r.bottom + 4) + "px";
      ccCaMenuOpen = menu;
    });
    holder.appendChild(btn);
  }
  // The type glyph, of which CA renders at most one per card, moves out of the old button row and
  // becomes a direct child of the card, so it can sit beside the corner menu like the other
  // card-level badges instead of staying inside a row that is now mostly hidden.
  function ccAppsTypeBadge(holder) {
    var glyph = holder.querySelector(".appDocker, .appPlugin, .appLanguage, .appDriver, .appRepository");
    if (glyph && glyph.parentElement !== holder) holder.appendChild(glyph);
  }
  // The spotlight mark leaves the other ribbons and becomes a square icon-only badge beside the
  // type glyph, with a Font Awesome star rather than an emoji, so it inherits its colour like every
  // other glyph on the card. The month CA renders beside it moves into the title tooltip instead of
  // staying a second visible pill.
  function ccAppsSpotlightBadge(holder) {
    var area = holder.querySelector(".homespotlightIconArea");
    if (!area) return;
    if (area.parentElement !== holder) holder.appendChild(area);
    if (area.getAttribute("data-cc-spot")) return;
    area.setAttribute("data-cc-spot", "1");
    var dateEl = area.querySelector(".spotlightDate");
    var dateTxt = dateEl ? dateEl.textContent.trim() : "";
    area.textContent = ""; // CA's own icon and date pill give way to the star below
    area.appendChild(ccGlyphEl("Star"));
    if (dateTxt) area.title = dateTxt;
  }
  // CA's Statistics, Credits and Change Log panel becomes a CC window: a frame around CA's own close
  // button and content with a head row for the title and the close badge. CA reaches both through
  // their class names and binds the close handler on the element itself, so moving them keeps CA
  // working, while CA's .html() on each open would wipe anything placed inside the content. The
  // observer on #alternateView re-runs this, so it writes nothing once the title is current.
  function ccAppsAltView() {
    var av = document.getElementById("alternateView");
    if (!av) return;
    var win = av.querySelector(":scope > .cc-av-win");
    if (!win) {
      var x = av.querySelector(":scope > .alternateViewClose"), content = av.querySelector(":scope > .alternateViewContent");
      if (!x || !content) return;
      win = ccMkEl("div", "cc-av-win");
      var head = ccMkEl("div", "cc-av-head");
      head.appendChild(ccMkEl("span", "cc-av-title"));
      av.insertBefore(win, content);
      win.appendChild(head); win.appendChild(content);
      head.appendChild(x);
      x.textContent = ""; x.appendChild(ccGlyphEl("Close"));
      x.setAttribute("role", "button"); x.setAttribute("tabindex", "0");
      x.setAttribute("aria-label", T("Schließen", "Close")); x.setAttribute("data-cc-tip", T("Schließen", "Close"));
      x.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); x.click(); } });
    }
    var src = win.querySelector(".alternateViewContent .ca_center > font, .alternateViewContent .ca_creditTitle:not(.caLogoIcon)");
    var title = src ? src.textContent.trim() : "";
    var badge = win.querySelector(".cc-av-title");
    if (badge.textContent !== title) badge.textContent = title;
  }
  // The app-info side drawer is restructured into the same badge-card system the notification
  // centre and the update window use.
  // CA does not recreate the popup per app: it reuses one node and swaps its content. A plain
  // presence guard would therefore fire for the first app opened and bail for every later one,
  // leaving the previous app's enhancement in place. Keying the guard to the app's name re-runs it
  // for a different app while the same app re-rendering still no-ops.
  function ccInfoCardEnhance() {
    var sc = document.getElementById("sidenavContent");
    var popup = sc && sc.querySelector(".popup");
    if (!popup) return;
    var nameEl0 = sc.querySelector(".popupName");
    // CA opens the drawer and fills it asynchronously, so this bails without writing the guard
    // until the name is really there. The observer on #sidenavContent re-triggers ccApps() the
    // moment CA's render finishes, however long it takes; the retry the click handler schedules is
    // only a head start for the fast case.
    if (!nameEl0 || !nameEl0.textContent.trim()) return;
    var key = nameEl0.textContent.trim();
    if (popup.getAttribute("data-cc-ic") === key) return;
    if (!sc.querySelector(".popupDescription")) return; // the same race, for the description block
    popup.setAttribute("data-cc-ic", key);
    // The close button becomes a square badge at the pill radius. Its native onclick stays
    // untouched.
    var closeBtn = sc.querySelector(".popUpClose");
    if (closeBtn) {
      closeBtn.textContent = ""; closeBtn.classList.add("cc-ic-close");
      closeBtn.appendChild(ccGlyphEl("Close"));
      closeBtn.title = T("Schließen", "Close"); closeBtn.setAttribute("aria-label", closeBtn.title);
    }
    // The spotlight becomes a star beside the app name, matching the card's own badge, and the
    // reason for the pick rides the star's hover tooltip rather than a separate bubble beside it:
    // ccWireTips watches the document for the same [data-tip] attribute, so one hoverable control
    // is enough.
    var spotBlock = sc.querySelector(".spotlightPopup");
    var nameEl = sc.querySelector(".popupName");
    if (spotBlock && nameEl && !nameEl.querySelector(".cc-ic-spot")) {
      var star = ccMkEl("span", "cc-ic-spot");
      star.appendChild(ccGlyphEl("Star"));
      var msgEl = spotBlock.querySelector(".spotlightMessage"), whoEl = spotBlock.querySelector(".spotlightWho");
      // the attribution already carries a leading dash, which would double up with the separator
      var tipParts = [msgEl, whoEl].map(function (e) { return e ? e.textContent.trim().replace(/^-\s*/, "") : ""; }).filter(Boolean);
      var spotTip = tipParts.length ? tipParts.join(", ") : T("Spotlight-App", "Spotlight app");
      star.setAttribute("data-tip", spotTip); star.setAttribute("aria-label", spotTip); star.setAttribute("tabindex", "0");
      nameEl.appendChild(star);
    }
    // Wraps live elements in a badge card, the first one anchoring the insertion point. It is the
    // same idea as a fieldset with a legend, the badge sitting half on the card, built from plain
    // divs because that is what CA's own markup is. `warn` gives the card the orange warning tone, a
    // background tint rather than a border. Every card is a top-level sibling at the same width.
    function cardify(els, title, warn) {
      els = els.filter(Boolean);
      if (!els.length) return;
      var card = ccMkEl("div", "cc-ic-card");
      var legend = ccMkEl("span", "cc-ic-legend" + (warn ? " cc-ic-warn" : ""), title);
      els[0].parentNode.insertBefore(card, els[0]);
      card.appendChild(legend);
      els.forEach(function (el) { card.appendChild(el); });
    }
    // Every section is gathered before the first cardify() call moves anything: an element
    // reference stays valid once reparented, but a query run after a move could miss something
    // already relocated into an earlier card.
    var desc = sc.querySelector(".popupDescription");
    // The description carries the same readmore class as the changelog, so CA truncates it and
    // appends its own toggle as the next sibling, present only when the text is long enough.
    var descMore = desc && desc.nextElementSibling && desc.nextElementSibling.classList.contains("ca_readmore") ? desc.nextElementSibling : null;
    var video = sc.querySelector(".videoPlayOverlay");
    var videoWrap = video ? video.parentElement : null;
    // CA's attention box, where the blacklist, incompatible-OS and custom-network notices land.
    var modComment = sc.querySelector(".modComment");
    // The requirements header is a sibling immediately before the requirements block rather than
    // nested inside it, so it has to travel into the same card; the CSS hide rule reaches only
    // inside a card, and left behind it would show twice.
    var addReqHeader = sc.querySelector(".additionalRequirementsHeader");
    var addReq = sc.querySelector(".additionalRequirements");
    var infoLefts = sc.querySelectorAll(".popupInfoLeft");
    var detailsBlock = infoLefts[0], maintBlock = infoLefts[1];
    var trendsHead = sc.querySelector(".charts.chartTitle");
    var trendEls = [];
    if (trendsHead) {
      trendEls.push(trendsHead);
      var sib = trendsHead.nextElementSibling;
      for (var ti = 0; ti < 2 && sib; ti++) { trendEls.push(sib); sib = sib.nextElementSibling; }
    }
    // The changelog's title, message and body are flat siblings, with the readmore toggle appended
    // after the body only when the content is long enough; cardify() filters out a missing one.
    var changelogTitle = sc.querySelector(".changelogTitle");
    var changelogMsg = sc.querySelector(".changelogMessage");
    var changelogBody = sc.querySelector(".changelog");
    var changelogMore = changelogBody ? changelogBody.nextElementSibling : null;
    if (changelogMore && !changelogMore.classList.contains("ca_readmore")) changelogMore = null;
    // The template-errors heading is followed by bare list-item siblings, which CA emits outside
    // any list; they are left as they are rather than rewrapped.
    var templateErrHead = sc.querySelector(".templateErrors");
    var templateErrEls = [];
    if (templateErrHead) {
      templateErrEls.push(templateErrHead);
      var teSib = templateErrHead.nextElementSibling;
      while (teSib && teSib.classList.contains("templateErrorsList")) { templateErrEls.push(teSib); teSib = teSib.nextElementSibling; }
    }
    cardify([desc, descMore, videoWrap], T("Infotext", "Info text"));
    cardify([modComment], T("Achtung", "Attention"), true);
    cardify([addReqHeader, addReq], T("Zusätzliche Anforderungen", "Additional requirements"), true);
    cardify([detailsBlock], T("Details", "Details"));
    cardify([maintBlock], T("Maintainer", "Maintainer"));
    cardify(trendEls, T("Trends", "Trends"));
    cardify([changelogTitle, changelogMsg, changelogBody, changelogMore], T("Änderungsprotokoll", "Changelog"));
    cardify(templateErrEls, T("Vorlagenfehler", "Template Errors"));
  }
  // CA puts its multi-select checkbox (Previous Apps, Action Centre) into the bottom button row, where
  // it lands in the middle of the text and the buttons cover it. It moves into a round marker in the
  // card's top right corner instead. The checkbox itself stays the click target, transparent over
  // the marker, so CA's delegated handlers and the :checked state keep working.
  function ccAppsSelectMark(holder) {
    var box = holder.querySelector("input.ca_multiselect");
    if (!box || box.parentElement.classList.contains("cc-ca-sel")) return;
    var mark = ccMkEl("span", "cc-ca-sel");
    holder.appendChild(mark);
    mark.appendChild(box);
    mark.appendChild(ccGlyphEl("Check"));
  }
  // CA's inline warning glyph sits inside the app name and becomes a square badge like the type and
  // spotlight ones. Clicking it does what its native title says and opens the info popup.
  // ccAppsPositionTopBadges below places it among whichever badges the card actually has.
  function ccAppsWarnBadge(holder) {
    var native = holder.querySelector(".cardWarning");
    if (!native) return;
    native.style.setProperty("display", "none", "important"); // the badge replaces the inline glyph
    if (holder.querySelector(".cc-warn-badge")) return;
    var badge = document.createElement("span"); badge.className = "cc-warn-badge";
    badge.appendChild(ccGlyphEl("Warning"));
    badge.title = native.getAttribute("title") || (LANG === "de" ? "Hinweis vorhanden" : "Note available");
    badge.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var infoBtn = holder.querySelector(".infoButton"); if (infoBtn) infoBtn.click(); });
    holder.appendChild(badge);
  }
  // Each of the top-right badges is optional per card, so a fixed offset per badge type leaves gaps
  // where one is missing and gives the name the same width whatever is actually there. This places
  // only the badges that exist, back to back, and stops the name exactly where the leftmost one
  // begins, measured against the card's real width.
  function ccAppsPositionTopBadges(holder) {
    var GAP = 6, W = 30, RIGHT0 = 10;
    // from the corner inwards: selection marker, menu, type, warning, spotlight
    var order = [
      holder.querySelector(".cc-ca-sel"),
      holder.querySelector(".cc-ca-menu-btn"),
      holder.querySelector(".appDocker, .appPlugin, .appLanguage, .appDriver, .appRepository"),
      holder.querySelector(".cc-warn-badge"),
      holder.querySelector(".homespotlightIconArea")
    ].filter(Boolean);
    var right = RIGHT0;
    order.forEach(function (b) { b.style.setProperty("right", right + "px", "important"); right += W + GAP; });
    var reservedFromRight = order.length ? (right - GAP + 10) : 16; // with a little clearance past the leftmost badge
    var nameEl = holder.querySelector(".ca_applicationName");
    if (!nameEl) return;
    var holderW = holder.getBoundingClientRect().width || 378;
    var nameLeft = 105; // the name's own left anchor, from Tokens.css
    var maxW = Math.max(40, Math.round(holderW - nameLeft - reservedFromRight));
    nameEl.style.setProperty("max-width", maxW + "px", "important");
  }
  // A name truncated above reveals itself on hover, sliding back and forth as docker.js does for a
  // long volume path. The name element is CA's own absolutely positioned box, so transforming it
  // would move the whole box and its clip boundary across the card rather than scroll the text
  // inside it; the content is wrapped in an inner span and only that one moves.
  function ccAppsNameMarquee(holder) {
    var nameEl = holder.querySelector(".ca_applicationName");
    if (!nameEl || nameEl.getAttribute("data-cc-marq")) return;
    nameEl.setAttribute("data-cc-marq", "1");
    nameEl.style.setProperty("overflow", "hidden", "important");
    nameEl.style.setProperty("white-space", "nowrap", "important");
    nameEl.style.setProperty("text-overflow", "clip", "important");
    var inner = document.createElement("span"); inner.className = "cc-name-inner"; inner.style.display = "inline-block";
    while (nameEl.firstChild) inner.appendChild(nameEl.firstChild);
    nameEl.appendChild(inner);
    var iv = null;
    nameEl.addEventListener("mouseenter", function () {
      var over = inner.scrollWidth - nameEl.clientWidth; if (over <= 2) return;
      var dur = Math.max(1000, Math.round(over / 55 * 1000)), toEnd = true;
      inner.style.transition = "transform " + (dur / 1000) + "s linear"; inner.style.transform = "translateX(-" + over + "px)";
      iv = setInterval(function () { if (!inner.isConnected) { clearInterval(iv); return; } toEnd = !toEnd; inner.style.transform = "translateX(" + (toEnd ? -over : 0) + "px)"; }, dur + 700);
    });
    nameEl.addEventListener("mouseleave", function () {
      if (iv) { clearInterval(iv); iv = null; }
      inner.style.transition = "transform .3s ease"; inner.style.transform = "translateX(0)";
    });
  }
  // Community Applications ships much of its sidebar and toolbar text in English even on a German
  // UI. This is an exact-match dictionary swapped in place over the sidebar labels, the show-more
  // toggle, the results-per-page control and the sort options. A string it does not carry is left
  // as it is rather than guessed at.
  var CC_APPS_XLATE_DE = {
    "Home": "Start", "Installed Apps": "Installierte Apps", "Previous Apps": "Bisherige Apps",
    "Pinned Apps": "Angeheftete Apps", "Favourite Repo": "Bevorzugtes Repository", "Action Centre": "Aktionszentrale",
    "Results Per Page": "Ergebnisse pro Seite", "Sort By:": "Sortieren nach:",
    "Name Ascending": "Name aufsteigend", "Name Descending": "Name absteigend", "Date Added": "Hinzugefügt am",
    "Language": "Sprache", "Media Applications": "Medienanwendungen", "Media Servers": "Medienserver",
    "Network Services": "Netzwerkdienste", "Tools / Utilities": "Werkzeuge", "Utilities": "Dienstprogramme",
    "All Apps": "Alle Apps", "Statistics": "Statistiken", "Change Log": "Änderungsprotokoll", "Debugging": "Fehlersuche",
    // The section headings above each app row and their subtitle sentences come from CA's own
    // startup types, which its translation leaves in English here. Keyed exactly as CA emits them,
    // in its own casing, since the badge uppercases in CSS.
    "Featured Applications": "Empfohlene Anwendungen", "Recently Added": "Kürzlich hinzugefügt",
    "Spotlight Apps": "Spotlight-Apps", "Top Trending Apps": "Angesagte Apps", "Top New Installs": "Top-Neuinstallationen",
    "Most Popular Plugins": "Beliebteste Plugins", "Random Apps": "Zufällige Apps",
    // and the subtitle sentences, shown inside the info bubble
    "Check out these newly added applications from our awesome community": "Entdecke diese neu hinzugefügten Anwendungen aus unserer großartigen Community",
    "Each month we highlight some of the amazing work from our community": "Jeden Monat heben wir einige der großartigen Arbeiten aus unserer Community hervor",
    "Check out these up and coming apps": "Entdecke diese aufstrebenden Apps",
    "These apps have the highest percentage of new installs": "Diese Apps haben den höchsten Anteil an Neuinstallationen",
    "The most popular plugins installed by other Unraid users": "Die beliebtesten Plugins, die von anderen Unraid-Nutzern installiert wurden",
    "An assortment of randomly chosen apps": "Eine Auswahl zufällig ausgewählter Apps"
  };
  // CA writes its card ribbons and Show more in capitals, in both languages, where every other CC
  // badge and button speaks in ordinary case.
  var CC_APPS_CASE = {
    "OFFICIAL": ["Offiziell", "Official"], "LIMETECH": ["Limetech", "Limetech"], "BETA": ["Beta", "Beta"],
    "UPDATED": ["Aktualisiert", "Updated"], "INSTALLED": ["Installiert", "Installed"],
    "SHOW MORE": ["Mehr anzeigen", "Show more"], "MEHR ANZEIGEN": ["Mehr anzeigen", "Show more"]
  };
  function ccAppsBulkDe(v) {
    if (v === "Select all on page") return "Alle auf der Seite auswählen";
    var m = /^(Install|Update) (?:(\d+) )?Selected Applications?$/.exec(v);
    if (!m) return "";
    var verb = m[1] === "Install" ? "installieren" : "aktualisieren";
    if (!m[2]) return "Ausgewählte " + verb;
    return m[2] + (m[2] === "1" ? " App " : " Apps ") + verb;
  }
  function ccAppsTranslateNative() {
    Array.prototype.slice.call(document.querySelectorAll(".homeMore, .installedCardText")).forEach(function (el) {
      if (el.children.length) return;
      var c = CC_APPS_CASE[el.textContent.trim()];
      if (c && el.textContent !== T(c[0], c[1])) el.textContent = T(c[0], c[1]);
    });
    if (LANG !== "de") return;
    // Leaf elements whose whole text is one dictionary entry. An element with children is skipped,
    // since overwriting its textContent would destroy that markup.
    Array.prototype.slice.call(document.querySelectorAll(".caMenuItem, .homeMore, .maxPerPage, .sortIcons")).forEach(function (el) {
      if (el.children.length) return;
      var xl = CC_APPS_XLATE_DE[el.textContent.trim()];
      if (xl && el.textContent !== xl) el.textContent = xl;
    });
    // The sort label is a bare text node among the sort links rather than an element of its own,
    // so this walks the child nodes instead of querying for it.
    // The bulk bar's buttons, which CA rewrites with the count on every pick. They are type=button
    // inputs, so the value is only their caption.
    Array.prototype.slice.call(document.querySelectorAll(".multi_installDiv input[type='button']")).forEach(function (b) {
      var xl = ccAppsBulkDe(b.value);
      if (xl && b.value !== xl) b.value = xl;
    });
    var sortArea = document.getElementById("sortIconArea");
    if (sortArea) {
      Array.prototype.slice.call(sortArea.childNodes).forEach(function (n) {
        if (n.nodeType !== 3) return;
        var t = n.textContent.trim(), xl = CC_APPS_XLATE_DE[t];
        if (xl) n.textContent = n.textContent.replace(t, xl);
      });
    }
  }
  function ccAppsRibbonRow(holder) {
    var marks = holder.querySelectorAll(".officialCardBackground, .LTOfficialCardBackground, .installedCardBackground, .betaCardBackground");
    if (!marks.length) return;
    var stats = holder.querySelector(".cc-castats"); if (!stats) return; // ccAppsStatRow builds it just before this runs
    var row = stats.querySelector(".cc-ribbonrow");
    if (!row) { row = document.createElement("div"); row.className = "cc-ribbonrow"; stats.insertBefore(row, stats.firstChild); }
    for (var i = 0; i < marks.length; i++) { if (marks[i].parentElement !== row) row.appendChild(marks[i]); }
  }
  document.addEventListener("click", ccCaMenuClose);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") ccCaMenuClose(); });
  window.addEventListener("scroll", ccCaMenuClose, true);
  window.addEventListener("resize", ccCaMenuClose);
  function ccApps() {
    try {
      if (!/^\/Apps(\/|$)/.test(location.pathname)) return;
      ccCaStatsFetch();
      ccAppsAutoSearch();
      ccAppsTranslateNative();
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      // the neutral sub-mode is global, so the Apps tab carries its own class like the others
      document.documentElement.classList.toggle("cc-apps-rbneutral", rbNeutral());
      // CA renders its bulk-action bar on every Apps view, but only Previous Apps renders the
      // per-card checkboxes it acts on, so elsewhere the bar sits there permanently disabled. The
      // gate is the checkboxes themselves rather than a URL, so it keeps working if CA ever wires
      // multi-select into another view.
      document.documentElement.classList.toggle("cc-apps-noselect", !document.querySelector(".ca_multiselect"));
      ccAppsStamp(".ca_homeTemplatesHeader");
      // CA's start view marks no entry when its startup cookie names "onlynew", a screen no entry
      // carries, so Start is marked here while that view shows and nothing else is marked.
      var home = document.querySelector("li.startupButton");
      if (home) home.classList.toggle("cc-ca-home", !document.querySelector(".caMenuItem.selectedMenu") && !!document.querySelector(".ca_homeTemplatesHeader"));
      ccAppsStamp(".caMenuItem.selectedMenu, li.cc-ca-home");
      ccAppsStamp("#searchFilter");
      // Before ccMoveSearchAreaBadges() runs, or on a page without the sidebar, these still sit in
      // CA's own search area as coloured badges; once moved they are plain sidebar rows.
      ccAppsStamp(".searchArea .caButton.maxPerPage, .searchArea .dockerSearch");
      ccAppsStamp(".pageNavigation .pageNumber");
      ccAppsStamp("a.sortIcons");
      // the icons in the Statistics, Credits and Change Log panel, which CA fills on each open
      ccAppsStamp("#alternateView i.fa");
      ccAppsAltView();
      ccAppsStamp("#alternateView .cc-av-title, #alternateView .alternateViewClose");
      // the card ribbons and spotlight badges, re-run every tick so a card that arrives later is stamped too
      ccAppsStamp(".officialCardBackground, .LTOfficialCardBackground, .installedCardBackground, .betaCardBackground, .homespotlightIconArea");
      // CA reuses one label slot for "Search for X", which says what was searched, and for the plain
      // section name, which the highlighted sidebar entry already says. CA marks the redundant case
      // itself with hideWithMenu, so that is the signal rather than a list of section names.
      // visibility rather than display: the slot's height is reserved on every other page, where CA
      // renders this element empty, so collapsing it here alone would pull everything below it up.
      Array.prototype.slice.call(document.querySelectorAll(".category.categoryLine")).forEach(function (cl) {
        cl.style.setProperty("visibility", cl.classList.contains("hideWithMenu") ? "hidden" : "", "important");
      });
      ccMoveSearchAreaBadges();
      ccAppsStripCount();
      wireCaSearch();
      ccWireCaSearchCollapse();
      ccAppsGroups();
      ccAppsStamp("li.cc-ca-eyebrow");
      ccAppsCards();
      ccAppsStamp("li.caMenuItem.actionCentre");
      // The installed status badge stays unstamped: it is a resting state, never accent-filled in
      // any mode, so it has nothing to stamp.
      ccAppsStamp(".ca_bottomLine .actionsButton, .ca_bottomLine .caButton, .cc-castats .actionsButton, .cc-ca-menu-btn, .appDocker, .appPlugin, .appLanguage, .appDriver, .appRepository, .cc-cs-cta.cc-cs-cta-update, .cc-warn-badge, .cc-ca-sel");
      // the info drawer's own button row, stamped every pass because CA rebuilds it on each open
      ccAppsStamp(".popupInfo .actionsPopup, .popupInfo .caButton");
      ccInfoCardEnhance();
      // the elements ccInfoCardEnhance just built, stamped in the same pass or they stay flat
      ccAppsStamp(".cc-ic-legend, .cc-ic-close, .cc-ic-spot, .cc-ic-card .ca_readmore, .cc-ic-card .donateDiv .caButton.donate");
      ccAppsStamp(".multi_installDiv input[type='button'], .multi_installDiv input[type='submit']");
      // CA's own class name says this button only clears the selection checkmarks; removing an app
      // is the separate per-card action. Its native German label reads as a destructive delete, so
      // it is relabelled, matching the exact stale strings only, which leaves an already correct
      // label from a future CA release alone.
      var clearBtn = document.querySelector("input.multi_installClear");
      if (clearBtn && (clearBtn.value === "Löschen" || clearBtn.value === "Auswahl löschen")) clearBtn.value = "Auswahl zurücksetzen";
      // A bulk remove, driving CA's own remove_application call once per checked card rather than
      // reimplementing it: each card already carries the path and name that call takes. It is
      // inserted inside the bulk-action bar, so the stamp pass above colours it along with the rest.
      if (clearBtn && !document.getElementById("cc-prevapps-del")) {
        var delBtn = document.createElement("input");
        delBtn.type = "button"; delBtn.id = "cc-prevapps-del";
        // The button carries none of CA's own classes. CA delegates click handlers off both
        // multi_installClear and multi_deleteButton, and sharing either class makes its handler run
        // alongside this one and race it, so the two confirm dialogs cancel out and the refresh
        // this button's own handler triggers never happens. Tokens.css targets this class directly
        // for the same look, with nothing for CA's delegation to match on.
        delBtn.className = "cc-prevapps-delbtn";
        // Disabled until at least one card is checked; the delegated change listener below keeps it
        // in sync, since CA's own checkbox toggling never touches this button.
        delBtn.value = T("Löschen", "Delete");
        delBtn.disabled = true;
        var ccSyncDelBtn = function () { delBtn.disabled = !document.querySelector(".ca_multiselect:checked"); };
        document.addEventListener("change", function (e) { if (e.target && e.target.classList && e.target.classList.contains("ca_multiselect")) ccSyncDelBtn(); });
        ccSyncDelBtn();
        delBtn.addEventListener("click", function () {
          var boxes = document.querySelectorAll(".ca_multiselect:checked");
          var apps = [];
          for (var i = 0; i < boxes.length; i++) {
            var holder = boxes[i].closest(".ca_holder");
            if (holder && holder.getAttribute("data-apppath")) apps.push({ path: holder.getAttribute("data-apppath"), name: holder.getAttribute("data-appname") || "" });
          }
          if (!apps.length) return;
          var names = apps.map(function (a) { return a.name; }).join(", ");
          var go = function () {
            // CA's own refresh scrolls the page as a side effect, so the scroll position from
            // before the delete is pinned back across the few ticks that refresh spans.
            var savedScroll = window.scrollY;
            var restoreScroll = function () { window.scrollTo(0, savedScroll); };
            var done = 0;
            apps.forEach(function (a) {
              try {
                window.post({ action: "remove_application", application: a.path }, function () {
                  if (++done === apps.length) {
                    document.querySelectorAll(".caMenuItem").forEach(function (m) { m.classList.remove("selectedMenu"); });
                    var menuItem = document.querySelector(".caMenuItem[data-category='previous_apps']");
                    if (menuItem) menuItem.classList.add("selectedMenu");
                    if (typeof previousApps === "function") previousApps(false, true, (window.data && data.previousAppsSection) || undefined);
                    restoreScroll();
                    requestAnimationFrame(restoreScroll);
                    setTimeout(restoreScroll, 50);
                    setTimeout(restoreScroll, 300);
                  }
                });
              } catch (e) { done++; }
            });
          };
          if (!window.CCTheme || !window.CCTheme.ask) return;
          var n = apps.length;
          window.CCTheme.ask({
            title: n === 1 ? T("1 App entfernen?", "Remove 1 app?") : T(n + " Apps entfernen?", "Remove " + n + " apps?"),
            text: T("Sie werden endgültig aus „Bisherige Apps“ entfernt: ", "This removes them from “Previous Apps” for good: ") + names,
            ok: T("Entfernen", "Remove"), cancel: T("Abbrechen", "Cancel"), danger: true, opener: delBtn, onOk: go
          });
        });
        clearBtn.parentNode.insertBefore(delBtn, clearBtn.nextSibling);
      }
      ccAppsCornerMarks();
      var holders = document.querySelectorAll(".ca_holder");
      for (var ci = 0; ci < holders.length; ci++) {
        ccAppsCardMenu(holders[ci]);   // before the install button leaves .ca_bottomLine
        ccAppsTypeBadge(holders[ci]);
        ccAppsWarnBadge(holders[ci]);
        ccAppsSelectMark(holders[ci]);
        ccAppsSpotlightBadge(holders[ci]);
        ccAppsPositionTopBadges(holders[ci]); // needs every badge above to exist before it compacts them
        ccAppsNameMarquee(holders[ci]);
        ccAppsStatRow(holders[ci]);    // builds the row the ribbon row below nests into
        ccAppsRibbonRow(holders[ci]);  // needs ccAppsCornerMarks() to have moved the ribbon in
      }
      // The subtitle moves into an info bubble on the header, the show-more toggle stays inline and
      // the body-text line is retired.
      var heads = document.querySelectorAll(".ca_homeTemplatesHeader:not([data-cc-info])");
      for (var h = 0; h < heads.length; h++) {
        var head = heads[h]; head.setAttribute("data-cc-info", "1");
        // The bare title text goes into an element of its own so it can carry a fill; an anonymous
        // flex text run cannot be styled. The bubble and the toggle stay siblings in the row.
        if (!head.querySelector(".cc-sechead-badge")) {
          var tb = document.createElement("span"); tb.className = "cc-sechead-badge";
          while (head.firstChild) tb.appendChild(head.firstChild);
          // every source header here is plain text, so overwriting it wholesale destroys no markup
          if (LANG === "de") { var xlB = CC_APPS_XLATE_DE[tb.textContent.trim()]; if (xlB) tb.textContent = xlB; }
          head.appendChild(tb);
        }
        var line2 = head.nextElementSibling;
        if (!line2 || !/\bca_homeTemplatesLine2\b/.test(line2.className || "")) continue;
        var more = line2.querySelector(".homeMore"), sub = "";
        for (var n = 0; n < line2.childNodes.length; n++) { var nd = line2.childNodes[n]; if (nd.nodeType === 3) sub += nd.textContent; }
        sub = sub.trim();
        if (LANG === "de" && CC_APPS_XLATE_DE[sub]) sub = CC_APPS_XLATE_DE[sub];
        // the sideways-scroll hint gets its own paragraph, or it drowns in the section text
        if (sub) sub += "\n\n" + T("Tipp: seitlich scrollen mit gedrückter rechter Maustaste.",
                                   "Tip: scroll sideways with the right mouse button held down.");
        if (sub) head.appendChild(ccMakeInfo(sub));
        if (more) head.appendChild(more);
        line2.style.display = "none";
      }
      // After the loop: the alignment passes read each row's toggle and title badge, which exist
      // only once the loop above has built them.
      ccAppsAlignRight();
      ccAppsAlignTop();
    } catch (e) {}
  }
  var ccAppsObs = null, ccInfoObs = null, ccAltObs = null, ccAppsT = 0;
  function ccAppsSoon() { if (ccAppsT) return; ccAppsT = setTimeout(function () { ccAppsT = 0; ccApps(); }, 60); }
  // #sidenavContent does not exist at boot: CA creates it lazily, as a side effect of the first
  // click that opens the drawer, so the observer can only attach after that click. A short bounded
  // retry covers the few milliseconds it takes to appear, and attaches for the rest of the page's
  // life. ccAppsSoon() runs right away once attached, so the click that triggered this does not
  // have to wait for a later mutation.
  function ccInfoObsAttach(tries) {
    if (ccInfoObs) return;
    var sc1 = document.getElementById("sidenavContent");
    if (sc1) { ccInfoObs = new MutationObserver(ccAppsSoon); ccInfoObs.observe(sc1, { childList: true, subtree: true }); ccAppsSoon(); return; }
    if ((tries || 0) < 20) setTimeout(function () { ccInfoObsAttach((tries || 0) + 1); }, 100);
  }
  function ccAppsBoot() {
    try {
      if (!/^\/Apps(\/|$)/.test(location.pathname)) return;
      ccApps();
      ccInfoObsAttach(0);
      document.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest(".caMenuItem, .homeMore, .sortIcons, .searchSubmit, #searchButton")) ccAppsSoon();
        // .ca_appPopup marks every entry point into the info drawer, none of which the selectors
        // above match, so without this its buttons get their stamp on some later, unrelated pass.
        // The capture-phase listener sees the click before CA swaps in the drawer content, hence
        // the delay; the attach call is what catches the very first open of the session.
        if (e.target && e.target.closest && e.target.closest(".ca_appPopup")) { setTimeout(ccAppsSoon, 80); ccInfoObsAttach(0); }
        if (e.target && e.target.closest && e.target.closest(".multi_installDiv")) setTimeout(ccAppsTranslateNative, 0);
      }, true);
      // CA rewrites the bulk bar's caption in English on every pick.
      document.addEventListener("change", function (e) {
        if (e.target && e.target.classList && e.target.classList.contains("ca_multiselect")) setTimeout(ccAppsTranslateNative, 0);
      }, true);
      // The measured right gutter moves with the viewport, so without a re-measure the padding
      // stays frozen at whatever the last pass computed and the toggle drifts off the gutter.
      var arRaf = 0;
      window.addEventListener("resize", function () {
        if (arRaf) return;
        function pass() { arRaf = 0; ccAppsAlignRight(); ccAppsAlignTop(); setTimeout(function () { ccAppsAlignRight(); ccAppsAlignTop(); }, 120); }
        arRaf = window.requestAnimationFrame ? window.requestAnimationFrame(pass) : setTimeout(pass, 16);
      }, { passive: true });
      // CA's search area sits outside #templates_content, so the observer below never sees it, and
      // it often finishes rendering after the first tick because CA's feed load is async. ccApps()
      // is idempotent, so running it on every tick of this bounded window closes that gap without a
      // second observer.
      var k = 0, t = setInterval(function () {
        var tc = document.getElementById("templates_content");
        if (tc && !ccAppsObs) { ccAppsObs = new MutationObserver(ccAppsSoon); ccAppsObs.observe(tc, { childList: true, subtree: false }); }
        // CA fills the Statistics, Credits and Change Log panel from a request that lands well
        // after the menu click, so its icons are stamped when the content arrives.
        var av = document.getElementById("alternateView");
        if (av && !ccAltObs) { ccAltObs = new MutationObserver(ccAppsSoon); ccAltObs.observe(av, { childList: true, subtree: true }); }
        ccApps();
        if (++k >= 15) clearInterval(t);
      }, 300);
    } catch (e) {}
  }

  function boot() {
    try { window.ccHeaderApply = apply; } catch (e) {} // the settings page's live toggle hook
    apply();
    ccWhatsNew();
    // The pill edge shifts with the viewport and the font, and the brand and the docked bell can
    // land off during the first paint, before the anchor is measured. Re-running the whole settle,
    // not just measureAlign, on the next frame and again on load corrects that once layout is
    // stable; every write is diffed, so the extra passes are cheap.
    function reSettle() { try { measureAlign(); ccBrand(); ccDockProfile(); ccTabStrip(); ccIslandStrip(); } catch (e2) {} }
    try {
      if (window.requestAnimationFrame) window.requestAnimationFrame(reSettle);
      window.addEventListener("resize", measureAlign);
      window.addEventListener("resize", ccTabStrip);
      window.addEventListener("resize", ccIslandStrip);
      window.addEventListener("load", reSettle);
    } catch (e) {}
    watchSearch();
    wireSearchToggle();
    ccAppsBoot();
    ccWrapSelectsBoot();   // catches a select that exists only once the host has rendered, or once something is opened
    // The docked profile once overlapped the help icon and ate the real click; Header.css makes the
    // dock click-through. This is the belt and braces: if the event target is not the help icon,
    // because of some other overlay, hit-test the pointer's element stack for it, and bind
    // pointerup too, since a drag path with pointer capture may never fire a click.
    var ccHelpBusy = 0;
    function ccHelpTrigger(e) {
      try {
        if (!document.documentElement.classList.contains("cc-header-on")) return;
        var h = e.target && e.target.closest ? e.target.closest("#menu .nav-item.HelpButton") : null;
        if (!h && e.clientX != null && document.elementsFromPoint) {   // scan the hit stack, in case an overlay sits on top
          var stk = document.elementsFromPoint(e.clientX, e.clientY);
          for (var s = 0; s < stk.length; s++) { if (stk[s].closest && stk[s].closest("#menu .nav-item.HelpButton")) { h = stk[s]; break; } }
        }
        if (!h) return;
        if (ccHelpBusy && Date.now() - ccHelpBusy < 400) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // click and pointerup both fire
        ccHelpBusy = Date.now();
        e.preventDefault(); e.stopImmediatePropagation();
        if (typeof window.HelpButton !== "function") { ccToast(T("Hilfe ist auf dieser Seite nicht verfügbar.", "Help is not available on this page.")); return; }
        window.HelpButton();
        // No toast when nothing appears: on a page like the Docker list the native help blocks live
        // in a hidden template container with genuinely nothing to show, and on the settings pages
        // the help has already moved into the info bubbles. Help behaves like the native button.
      } catch (err) {}
    }
    try { document.addEventListener("click", ccHelpTrigger, true); document.addEventListener("pointerup", ccHelpTrigger, true); } catch (e) {}
    // Ctrl+K opens the command palette, except while typing in a field or with theming off
    try {
      document.addEventListener("keydown", function (e) {
        if (!((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K"))) return;
        if (g("cc.theming", "1") === "0") return;
        var t = e.target, tag = t && t.tagName;
        if ((tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) && !(t.classList && t.classList.contains("cc-cmd-in"))) return;
        e.preventDefault(); e.stopPropagation(); ccCmdOpen();
      }, true);
    } catch (e) {}
    // Each trigger is a child of its in-flow proxy and reflows with the row, so nothing tracks its
    // position per frame; a resize pass covers a real DOM change, such as icons appearing or
    // reordering across a breakpoint.
    try { window.addEventListener("resize", function () { try { ccDockProfile(); } catch (e2) {} }); } catch (e) {}
    // At boxed display width the content is capped and left-aligned while the full-width island,
    // the utility icons and the footer arrows ride to the viewport edge, leaving a gap that grows
    // with the window. Publishing that gap as a var lets the sheet pull the three back to the
    // content edge. It writes one custom property and no DOM, and at fluid width the gap is zero.
    try {
      var ccGapRaf = 0;
      function ccContentGap() {
        ccGapRaf = 0;
        try {
          var db = document.getElementById("displaybox");
          var vw = document.documentElement.clientWidth;   // the layout width without the scrollbar, which innerWidth would include
          var r = db ? db.getBoundingClientRect().right : vw;
          var gap = Math.max(0, Math.round(vw - r));
          document.documentElement.style.setProperty("--cc-content-rgap", gap + "px");
        } catch (e) {}
      }
      function ccGapSchedule() { if (ccGapRaf) return; ccGapRaf = window.requestAnimationFrame ? window.requestAnimationFrame(ccContentGap) : setTimeout(ccContentGap, 16); }
      window.addEventListener("resize", ccGapSchedule, { passive: true });
      window.addEventListener("load", ccContentGap);
      ccContentGap();
      setTimeout(ccContentGap, 300);   // once more after the boxed layout settles
    } catch (e) {}
    // The settings page and the Docker tab write cc.* and the per-area keys from another tab. The
    // pattern matches those prefixes too, which a plain "cc." check would miss. cc.stateCache is
    // skipped because docker.js rewrites it every 9s.
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) apply(); }); } catch (e) {}
    // The notification sheet mounts inside the Connect root rather than as a body child, so the
    // body observer can miss it; a few passes after a click on the bell land the bulk buttons as
    // soon as it appears.
    try {
      document.addEventListener("click", function (e) {
        try { if (e.target && e.target.closest && e.target.closest("#UserProfile, [data-cc-trig]")) { var n = 0, t = setInterval(function () { ccNotifActions(); try { ccPopoverDim(); } catch (ed) {} try { ccPaintRotate(); } catch (ep) {} try { ccAcctMenu(); } catch (ea) {} if (++n >= 8) clearInterval(t); }, 180); } } catch (err) {}
      }, true);
    } catch (e) {}
    // For the same reason the body observer misses that sheet opening and closing, so the backdrop
    // is re-evaluated after any click or Escape; ccPopoverDim() shows it while a popover is open
    // and hides it when none is. The deferred passes cover the sheet's mount delay.
    try {
      var ccDimSync = function () { [0, 100, 300, 600].forEach(function (ms) { setTimeout(function () { try { ccPopoverDim(); } catch (e) {} }, ms); }); };
      document.addEventListener("click", ccDimSync, true);
      document.addEventListener("keydown", function (e) { if (e && e.key === "Escape") ccDimSync(); }, true);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

/* Puts the CC loader into Unraid's full-screen tab-load spinner in place of the stock mark, and
   exposes window.ccMakeLoader so the Apps dialog and the plugin-install view use the same one. Its
   own closure, so it stays isolated from the header logic above. */
(function () {
  // One factory. Every size lives in the CSS tokens and nothing writes the size inline, so no sheet
  // has to out-weigh a call site and no call site can invent a number the tiers do not know.
  function ccLoader(tier) {
    var w = document.createElement("span"); w.className = "cc-loader cc-load-" + (tier || "dlg");
    w.setAttribute("role", "status"); w.setAttribute("aria-live", "polite");
    w.innerHTML = '<span class="o"><i></i></span><span class="in"><i></i></span>';
    return w;
  }
  // At most one ring per host: an existing one changes tier rather than gaining a second.
  function ccMountLoader(host, tier) {
    try {
      if (!host) return null;
      var l = host.querySelector(".cc-loader");
      if (l) { l.className = "cc-loader cc-load-" + (tier || "dlg"); return l; }
      l = ccLoader(tier); host.appendChild(l); return l;
    } catch (e) { return null; }
  }
  function ccUnmountLoader(host) {
    try { var l = host && host.querySelector(".cc-loader"); if (l && l.parentNode) l.parentNode.removeChild(l); } catch (e) {}
  }
  try {
    window.ccLoader = ccLoader; window.ccMountLoader = ccMountLoader; window.ccUnmountLoader = ccUnmountLoader;
    window.ccMakeLoader = function () { return ccLoader("dlg"); };   // for an external caller
  } catch (e) {}

  // Decides from the computed state which fullscreen loader is genuinely on screen, mounts exactly
  // one ring there, dedupes every other spinner and stamps the loading class, so one scroll-lock
  // rule covers the tab-load overlay, the Apps dialog and the container-update window alike.
  // It only reads and writes on a difference, and runs from a timer rather than an observer on the
  // overlay: Unraid's own code touches that element's style repeatedly, and an attribute observer
  // on it re-triggers this on every touch, which is not provably loop-free.
  function ccLoadState() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var root = document.documentElement;
      var swal = document.querySelector(".sweet-alert.cc-only-loader");
      var swalOn = !!(swal && getComputedStyle(swal).display !== "none");
      var ctout = document.getElementById("cc-ctout-bd");
      var ctoutOn = !!(ctout && getComputedStyle(ctout).display !== "none");

      // Release the override a previous tick applied before reading visibility below, or that
      // write reads back as Unraid still showing the overlay and a held spinner could never leave.
      var prevFixed = document.querySelectorAll("div.spinner.fixed");
      for (var p = 0; p < prevFixed.length; p++) {
        if (prevFixed[p].style.getPropertyValue("display") === "flex") prevFixed[p].style.removeProperty("display");
      }

      var sps = document.querySelectorAll("div.spinner");
      var fixedUp = null, inPageUp = null;
      for (var i = 0; i < sps.length; i++) {
        var s = sps[i];
        if (getComputedStyle(s).display === "none") continue;
        if (s.classList.contains("fixed")) { if (!fixedUp) fixedUp = s; }
        else if (!inPageUp) inPageUp = s;
      }
      // Unraid hides its tab-load overlay the moment its own AJAX populates the table, well before
      // a tab enhancer has painted its badges over the now-visible native rows. While an enhancer
      // reports itself busy, the same native overlay is held open rather than replaced by a
      // parallel one, so every branch below treats it like any other showing spinner. data-cc-held
      // marks this hold, so the release branch never fights another reason the element is shown.
      var heldFixed = document.querySelector("div.spinner.fixed");
      if (!fixedUp && !swalOn && !ctoutOn && root.classList.contains("cc-enh-busy")) {
        if (heldFixed) { heldFixed.setAttribute("data-cc-held", "1"); fixedUp = heldFixed; }   // the election loop sets the display, as for any other elected overlay
      } else if (heldFixed && heldFixed.getAttribute("data-cc-held") === "1") {
        heldFixed.removeAttribute("data-cc-held");   // no longer elected, so the loop drops the forced display
      }
      // One ring and one elected host, in order: the Apps dialog, the container-update window, the
      // fullscreen overlay, then an in-page spinner. The order matters: on the Apps tab the overlay
      // and CA's own dialog are both genuinely showing on nearly every load, since CA opens that
      // dialog while its feed refreshes. ccUpdatingSwal() only does its housekeeping; this is the
      // one place that mounts or unmounts a ring.
      var swalMark = swal ? swal.querySelector(".updateContent-swal") : null;
      var swalHost = swalMark ? swalMark.parentNode : null;   // the ring goes above the marker, not after it
      var elected = swalOn ? swalHost : ctoutOn ? null : (fixedUp || inPageUp);

      if (swalHost) {
        if (elected === swalHost) { if (!swalHost.querySelector(".cc-loader")) { var sl = ccLoader("full"); sl.style.display = "block"; sl.style.margin = "6px auto 14px"; swalHost.insertBefore(sl, swalMark); } }
        else ccUnmountLoader(swalHost);
      }
      for (var j = 0; j < sps.length; j++) {
        var sp = sps[j];
        var spElected = (elected === sp);
        sp.classList.toggle("cc-spin-dupe", !spElected && !!(fixedUp || inPageUp) && !swalOn);
        sp.classList.toggle("cc-spin-active", !!(spElected && !sp.classList.contains("fixed")));
        // Centring the overlay from CSS with !important can never lose to Unraid's own inline
        // display:none and forces the dimmed overlay on permanently. The elected state is known
        // here, so the inline override is set and cleared exactly when it changes.
        if (sp.classList.contains("fixed")) {
          if (spElected) sp.style.setProperty("display", "flex", "important");
          else if (sp.style.getPropertyValue("display") === "flex") sp.style.removeProperty("display");
        }
        if (spElected) ccMountLoader(sp, "full"); else ccUnmountLoader(sp);
      }

      var mode = swalOn ? "swal" : ctoutOn ? "ctout" : (fixedUp || inPageUp) ? "fixed" : null;
      root.classList.toggle("cc-loading", !!mode);
      if (mode) root.setAttribute("data-cc-load", mode); else root.removeAttribute("data-cc-load");
    } catch (e) {}
  }
  try { window.ccLoadState = ccLoadState; } catch (e) {}

  /* CA's "Updating Content" dialog is a SweetAlert appended as a direct child of body, whose
     content carries a marker span. This hides the stock info icon and tags the shell, so the CSS
     and ccLoadState know a loader-only dialog is up. Keyed on the marker, so it never fires on any
     other dialog. ccLoadState places the ring; doing it here as well gave two rings at once. */
  function ccUpdatingSwal() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var mark = document.querySelector(".updateContent-swal");
      var box  = mark ? ((mark.closest && mark.closest(".sweet-alert")) || mark.parentElement)
                      : document.querySelector(".sweet-alert.cc-only-loader");
      // SweetAlert reuses one node for every dialog, so the class is stamped only while the marker
      // is present and stripped the moment the node serves something else.
      if (box) box.classList.toggle("cc-only-loader", !!mark);
      if (!mark || !box) return;
      var icon = box.querySelector(".sa-icon"); if (icon) icon.style.display = "none";
    } catch (e) {}
  }

  /* The plugin install dialog's title carries a #pluginProgressTitle span with a stock spinner
     glyph, which this swaps for a small inline ring. On completion Unraid replaces that span's
     content, which removes the ring with it, so nothing has to clean up afterwards. Keyed on the
     id, so it only ever touches that dialog. */
  function ccPluginSwal() {
    try {
      if (!document.documentElement.classList.contains("cc-popups-on")) return;
      var t = document.getElementById("pluginProgressTitle");
      if (!t || t.querySelector(".cc-loader")) return;
      var fa = t.querySelector("i.fa"); if (fa) fa.style.display = "none";
      var l = ccLoader("xs");   // an inline ring in place of a glyph in a title line
      l.style.display = "inline-block"; l.style.verticalAlign = "middle"; l.style.marginLeft = "8px";
      t.appendChild(l);
    } catch (e) {}
  }

  function ccSwalScan() { ccUpdatingSwal(); ccPluginSwal(); }

  /* A scoped observer on the SweetAlert shell. SweetAlert creates that element once and reuses it,
     toggling a class to open it, so a body-childList observer catches only the first dialog.
     Watching the element's class attribute catches every open, and its content is already in place
     when the class flips. Attributes only, so a streaming install log makes no noise here. */
  function ccAttachSwalObs() {
    try {
      var shells = document.querySelectorAll(".sweet-alert, .swal-modal, .swal2-popup");
      for (var i = 0; i < shells.length; i++) {
        var sa = shells[i];
        if (sa.__ccSwalObs) continue;
        sa.__ccSwalObs = new MutationObserver(ccSwalScan);
        sa.__ccSwalObs.observe(sa, { attributes: true, attributeFilter: ["class"] });
      }
    } catch (e) {}
  }

  var ccBodyObs = null;
  function ccWatchBodyForSwal() {
    // Body's direct children only, purely to notice the first time a shell is added so the scoped
    // observer above can attach. A subtree here fires on the deep app-card mutations that froze
    // the Apps tab.
    try {
      if (ccBodyObs || !document.body) return;
      ccBodyObs = new MutationObserver(function () { ccAttachSwalObs(); ccSwalScan(); });
      ccBodyObs.observe(document.body, { childList: true, subtree: false });
    } catch (e) {}
  }

  // dynamix.js fades the back-to-top arrow out at the top of the page but ships nothing for the
  // move-to-end arrow at the bottom. Mirroring its jQuery animation did not hold: something kept
  // resetting a completed fade back to an opacity value within a few frames, so the arrow never
  // stayed hidden. A class with an opacity transition avoids the animation queue entirely.
  var ccFooterBottomState = null;
  function ccFooterArrowsBottom() {
    try {
      var atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 2);
      if (atBottom === ccFooterBottomState) return;
      ccFooterBottomState = atBottom;
      document.documentElement.classList.toggle("cc-footer-at-bottom", atBottom);
    } catch (e) {}
  }
  // The arrows rest in the bottom corner and show only while the page scrolls, so they never sit
  // over a card for long. Their floor is whatever is docked at the viewport's bottom edge, the
  // fixed footer or the Docker action bar, measured here rather than assumed so a page without
  // either keeps them in the corner.
  var ccArrowsIdle = 0, ccArrowsFloor = -1;
  function ccArrowsFloorMeasure() {
    var vh = document.documentElement.clientHeight, floor = 0;
    var docked = document.querySelectorAll("#footer, div.js-actions");
    for (var i = 0; i < docked.length; i++) {
      if (getComputedStyle(docked[i]).position !== "fixed") continue;
      var r = docked[i].getBoundingClientRect();
      if (r.height > 0 && r.top < vh) floor = Math.max(floor, Math.round(vh - r.top));
    }
    if (floor !== ccArrowsFloor) { ccArrowsFloor = floor; document.documentElement.style.setProperty("--cc-arrows-floor", floor + "px"); }
  }
  function ccArrowsWake() {
    try {
      var root = document.documentElement;
      if (!root.classList.contains("cc-arrows-live")) { ccArrowsFloorMeasure(); root.classList.add("cc-arrows-live"); }
      clearTimeout(ccArrowsIdle);
      ccArrowsIdle = setTimeout(function () { root.classList.remove("cc-arrows-live"); }, 1400);
    } catch (e) {}
  }
  function ccLoaderBoot() {
    ccLoadState();
    ccAttachSwalObs();
    ccSwalScan();          // in case a dialog is already open on load
    ccWatchBodyForSwal();
    ccFooterArrowsBottom();                                                 // the initial state, for a page shorter than the viewport
    window.addEventListener("scroll", ccFooterArrowsBottom, { passive: true });
    window.addEventListener("resize", ccFooterArrowsBottom);
    window.addEventListener("scroll", ccArrowsWake, { passive: true });
    // A permanent heartbeat rather than a bounded retry, which would only repair the first few
    // seconds of a page's life and miss a loader that opens minutes into a session. A timer
    // callback cannot re-enter itself the way an observer on a node Unraid churns can, and
    // ccLoadState() only reads and writes on a difference, so there is no path back into itself.
    // It pauses while the tab is hidden, and the interval matches the restyle debounce above.
    setInterval(function () { if (!document.hidden) { ccLoadState(); ccAttachSwalObs(); } }, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ccLoaderBoot); else ccLoaderBoot();
})();

/* Holding the right mouse button and spinning the wheel scrolls any horizontally overflowing
   container sideways, such as the Apps rows. The context menu is swallowed only once that gesture
   has actually moved a row, so a plain right-click still opens it. Shift and the wheel do the same. */
(function () {
  "use strict";
  var rmbDown = false, rmbUsed = false, clearT = 0;
  function hScroller(node) {
    for (var el = node; el && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollWidth - el.clientWidth > 2) {
        var ov = "";
        try { ov = getComputedStyle(el).overflowX; } catch (e) {}
        if (ov === "auto" || ov === "scroll") return el;
      }
    }
    return null;
  }
  document.addEventListener("mousedown", function (e) {
    if (e.button === 2) { rmbDown = true; rmbUsed = false; if (clearT) { clearTimeout(clearT); clearT = 0; } }
  }, true);
  document.addEventListener("mouseup", function (e) {
    if (e.button === 2) {
      rmbDown = false;
      if (rmbUsed) { if (clearT) clearTimeout(clearT); clearT = setTimeout(function () { rmbUsed = false; clearT = 0; }, 350); }
    }
  }, true);
  document.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return;                       // leave pinch/zoom alone
    if (!rmbDown && !e.shiftKey) return;         // only our two gestures
    var d = e.deltaY || e.deltaX; if (!d) return;
    var sc = hScroller(e.target); if (!sc) return;
    sc.scrollLeft += d;
    e.preventDefault();
    if (rmbDown) rmbUsed = true;
  }, { capture: true, passive: false });
  document.addEventListener("contextmenu", function (e) {
    if (rmbDown || rmbUsed) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
