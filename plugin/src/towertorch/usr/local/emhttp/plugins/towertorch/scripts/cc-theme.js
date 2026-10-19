/* CannonadeCommand: the theme helpers shared by every area script.
 *
 * Loaded on every page, synchronously, from CannonadeCommand.Tokens.page (Menu="Buttons:94"), so
 * window.CCTheme exists before any area script runs. The rainbow offset is one seed kept in
 * cc.rbseed, so every area starts the palette on the same hue and keeps it across reloads. Each
 * area keeps an identical local fallback, so a missed load order degrades instead of breaking.
 */
(function () {
  "use strict";
  if (window.CCTheme) return;

  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // GlimStone's palette, the Carbon 30 steps once round the wheel: red, orange, Sunflower, green,
  // teal, blue, purple and magenta. Sunflower is the default accent, so one position always matches
  // it. A stored cc.rbpal replaces the whole set and is never rewritten.
  var RB = ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"];

  // Dark ink or white on a fill, whichever has the higher contrast ratio. Against #161616 and white
  // the two ratios cross at a relative luminance of 0.197, so every pastel in the palette takes dark
  // ink. The fallbacks in the area scripts use the same formula.
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff";
  }

  // cc.anim holds a GlimStone motion level, off, subtle or wild, and subtle when unset. The digits
  // stored before the levels had names, 0, 1 and 2, read as the same three, so nobody's choice is
  // lost; header.js rewrites them to the names.
  function motionLevel(v) {
    if (v === "off" || v === "0") return "off";
    if (v === "wild" || v === "2") return "wild";
    return "subtle";
  }

  // cc.badgeshape holds a GlimStone shape, round, soft or square, and round when unset. The names
  // stored before, pill, rounded, square and circle, read as the nearest of the three, so nobody's
  // choice is lost; header.js rewrites them to the new names.
  function shapeName(v) {
    if (v === "soft" || v === "rounded") return "soft";
    if (v === "square") return "square";
    return "round";
  }
  // One seed, picked at random once and kept in cc.rbseed, so seed % len gives the same rotation
  // in every area and on every reload.
  function rbSeed(len) {
    var v = parseInt(g("cc.rbseed", ""), 10);
    if (isNaN(v) || v < 0) { v = Math.floor(Math.random() * 9973); s("cc.rbseed", String(v)); } // prime modulus base
    return len > 0 ? (v % len) : 0;
  }

  // Flag mode reads cc.flagpal, otherwise the user's cc.rbpal, otherwise the given default.
  function palette(def) {
    try {
      if (g("cc.flagmode", "0") === "1") { var f = JSON.parse(g("cc.flagpal", "null")); if (f && f.length) return f; }
      var p = JSON.parse(g("cc.rbpal", "null")); if (p && p.length) return p;
    } catch (e) {}
    return def || RB;
  }

  // The colour of rainbow item i, or the plain accent when rainbow is off. Honours rotation
  // (cc.rainbowrot, default on) and the shared seed.
  function rbColor(i, accent, def) {
    if (g("cc.rainbow", "0") !== "1") return accent;
    var p = surfacePalette(palette(def), accent), off = g("cc.rainbowrot", "1") === "0" ? 0 : rbSeed(p.length);
    return p[((i % p.length) + off) % p.length];
  }

  // Rec-601 luma of a hex colour, 0-255, the measure the floors below were taken in.
  function lumOf(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 255;
    var n = parseInt(m[1], 16);
    return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  }

  // A near-black palette slot (the German flag's black stripe, a hand-picked #2a2a2a) paints an
  // invisible badge on CC's #161616 surfaces, so a slot below the floor is swapped for the
  // palette's brightest slot, or for the accent when the whole palette is dark. header.js's
  // popBadge delegates here.
  //
  // The floor of 28 was measured: 64 swapped the Algerian flag's #006233 (luma 63.3) and broke its
  // cycle, while 28 still catches #000000 and keeps dark flag colours such as navy #002868 (35.4)
  // that read fine with white text. floor is a parameter because a luminance tint lands at about
  // half the target's luma on a mid-bright icon, so the tint path passes LUM_FLOOR * 2.
  var LUM_FLOOR = 28;
  function liftDark(hex, accent, floor) {
    if (floor == null) floor = LUM_FLOOR;
    if (!hex) return hex;
    if (lumOf(hex) >= floor) return hex;
    var p = palette(), best = null, bl = -1;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L > bl) { bl = L; best = p[k]; } }
    return (best && bl >= floor) ? best : (accent || hex);
  }

  // The mirror of liftDark for Unraid's white and azure themes, where Tokens.css turns the
  // surfaces white and light grey: a near-white slot (a flag's white stripe) paints a badge with no
  // visible edge there, so a slot above 255 - floor is swapped for the palette's darkest slot, or
  // for the accent when the whole palette is light. The floor is liftDark's, mirrored, so the same
  // flag colours survive on either side. pal is the palette to search, the active one by default.
  function liftLight(hex, accent, floor, pal) {
    if (floor == null) floor = LUM_FLOOR;
    if (!hex) return hex;
    var ceil = 255 - floor;
    if (lumOf(hex) <= ceil) return hex;
    var p = pal || palette(), best = null, bl = 256;
    for (var k = 0; k < p.length; k++) { var L = lumOf(p[k]); if (L < bl) { bl = L; best = p[k]; } }
    return (best && bl <= ceil) ? best : (accent || hex);
  }
  function lightTheme() {
    var c = document.documentElement.classList;
    return c.contains("Theme--white") || c.contains("Theme--azure");
  }
  // The guard for the theme the page is in, for a colour that sits on CC's own surfaces.
  function liftSurface(hex, accent, floor) {
    return lightTheme() ? liftLight(hex, accent, floor) : liftDark(hex, accent, floor);
  }
  // The palette as the fills on a light theme need it, every near-white slot swapped as above, so
  // each area's palette reader covers its badges, buttons and hover stamps in one place. A dark
  // theme gets the palette as stored.
  function surfacePalette(p, accent) {
    if (!p || !lightTheme()) return p;
    return p.map(function (c) { return liftLight(c, accent, LUM_FLOOR, p); });
  }

  // A hue within 15 degrees of pure red, saturated enough to read as red rather than a grey.
  function isRed(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return false;
    var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    var hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    if (hi !== r || hi === 0 || (hi - lo) / hi < 0.3) return false;
    var h = (g - b) / (hi - lo) * 60;
    return h <= 15 && h >= -15;
  }
  // Palette slot i for a control that deletes something. A delete is never red, so a slot that
  // lands on red passes to the next one that is not, in a flag's palette as in the rainbow.
  function deleteSlot(pal, i) {
    for (var k = 0; k < pal.length; k++) { var c = pal[(i + k) % pal.length]; if (!isRed(c)) return c; }
    return pal[i % pal.length];
  }

  // Colour modes for the select replacements header.js does not paint: .cc-dsel (Docker form, CC
  // settings, .cc-pop windows), .cc-sel (share detail) and .cc-drop (the Startplan "Hängt ab von"
  // multi-select). It lives here because this is the only file loaded on every page. .cc-tsel is
  // left out because ccPaintRotate() rotates it together with the toggles around it, and a second
  // painter would fight it on every pass.
  var CC_SEL_WRAPS = ".cc-dsel, .cc-sel";
  var CC_SEL_PANELS = ".cc-dsel-panel, .cc-sel-panel, .cc-drop";
  var CC_SEL_OPTS = ".cc-dsel-opt, .cc-sel-opt, .cc-drop-it";
  function paintSelects(root) {
    try {
      var scope = (root && root.querySelectorAll) ? root : document;
      // With rainbow or theming off the stamps are removed, so the sheets' var(--cc-rb-c,
      // var(--cc-rbaccent, <area accent>)) chain falls back to the accent. Flag mode comes in
      // through rbColor()'s palette().
      var on = g("cc.theming", "1") !== "0" && g("cc.rainbow", "0") === "1";
      var i, n, c;
      var wraps = scope.querySelectorAll(CC_SEL_WRAPS);
      for (i = 0; i < wraps.length; i++) {
        if (!on) { wraps[i].style.removeProperty("--cc-rb-c"); wraps[i].style.removeProperty("--cc-rb-ct"); continue; }
        c = rbColor(i, null);   // guarded by `on`, so this never returns the null accent
        wraps[i].style.setProperty("--cc-rb-c", c); wraps[i].style.setProperty("--cc-rb-ct", idealText(c));
      }
      // Rotate within each panel, as ccPaintRotate does for .cc-tsel-panel, so an open list reads
      // as a rainbow rather than one colour repeated down the column.
      var panels = scope.querySelectorAll(CC_SEL_PANELS);
      for (var p = 0; p < panels.length; p++) {
        var opts = panels[p].querySelectorAll(CC_SEL_OPTS);
        for (n = 0; n < opts.length; n++) {
          if (!on) { opts[n].style.removeProperty("--cc-rb-c"); opts[n].style.removeProperty("--cc-rb-ct"); continue; }
          c = rbColor(n, null);
          opts[n].style.setProperty("--cc-rb-c", c); opts[n].style.setProperty("--cc-rb-ct", idealText(c));
        }
      }
    } catch (e) {}
  }

  // GlimStone rule 14: a closed select field with focus steps through its values with the scroll
  // wheel (reference/selectScroll.ts). It lives here because this file loads on every page.
  // .cc-tsel (header.js), .cc-dsel (docker.js form, CC settings, .cc-pop) and .cc-sel (share
  // detail) keep a hidden <select> as their value, so a wheel step changes its selectedIndex.
  // .cc-drop is left out: it has no closed field, only a text input holding a comma list with no
  // next value to step to.
  //
  // The handler acts only over a closed widget that has the focus, from a click or from Tab, so a
  // page with a dropdown on every row can scroll past them without changing one, and an open panel
  // scrolls as before. It calls preventDefault only when the value changed, so a disabled or
  // single-option field still lets the page scroll. It clamps at the ends like the arrow keys in
  // settings.js moveSel and header.js ccTselMove, and it commits through the same path as an option
  // click (selectedIndex, a bubbling change event, then a resync), so the host page's inline
  // onchange handlers fire.
  var CC_SEL_WHEEL = ".cc-tsel, .cc-dsel, .cc-sel";
  var selSyncFns = [];
  // Each family registers the sync its click handler calls, because they differ: .cc-tsel
  // re-inserts a locale flag and rebuilds when the option count changes. A family that registers
  // nothing falls back to ccSelMirror.
  function registerSelectSync(fn) { if (typeof fn === "function" && selSyncFns.indexOf(fn) < 0) selSyncFns.push(fn); }
  // Repaints the trigger label and each chip's selected and disabled state. All three families
  // share the .cc-X-trigger and .cc-X-opt[data-i] markup.
  function ccSelMirror(wrap, sel) {
    try {
      var t = wrap.querySelector(".cc-tsel-trigger, .cc-dsel-trigger, .cc-sel-trigger");
      var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
      if (t && t.textContent !== label) t.textContent = label;
      var opts = wrap.querySelectorAll(".cc-tsel-opt, .cc-dsel-opt, .cc-sel-opt");
      for (var i = 0; i < opts.length; i++) {
        var o = sel.options[+opts[i].getAttribute("data-i")]; if (!o) continue;
        opts[i].classList.toggle("is-selected", o.selected);
        opts[i].classList.toggle("is-disabled", !!o.disabled);
        opts[i].setAttribute("aria-selected", o.selected ? "true" : "false");
      }
    } catch (e) {}
  }
  // Next selectable index in dir, skipping disabled options and clamped at both ends. Returns the
  // current index when there is nowhere to go.
  function nextSelIndex(sel, dir) {
    var n = sel.options.length, i = sel.selectedIndex;
    if (n < 2) return i;
    if (i < 0) return dir > 0 ? 0 : n - 1;
    for (var k = i + dir; k >= 0 && k < n; k += dir) { if (!sel.options[k].disabled) return k; }
    return i;
  }
  function wheelStepSelect(wrap, dir) {
    var sel = wrap.querySelector("select");
    if (!sel || sel.disabled || sel.multiple) return false;
    var i = nextSelIndex(sel, dir);
    if (i === sel.selectedIndex) return false;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));   // the host's inline onchange chain
    var painted = false;
    for (var k = 0; k < selSyncFns.length; k++) { try { if (selSyncFns[k](sel, wrap) === true) painted = true; } catch (e) {} }
    if (!painted) ccSelMirror(wrap, sel);
    // the freshly-selected chip has to wear the mode colour like every other one (rule 9)
    try { paintSelects(wrap); } catch (e2) {}
    return true;
  }
  function bindSelectWheel() {
    if (window.__ccSelWheel || !document || typeof document.addEventListener !== "function") return;
    window.__ccSelWheel = true;
    // Not passive, so a handled step can stop the page from scrolling underneath it.
    document.addEventListener("wheel", function (e) {
      try {
        if (e.ctrlKey || e.metaKey || e.altKey) return;               // browser zoom and OS gestures
        var t = e.target;
        if (!t || !t.closest) return;
        if (t.closest(".cc-tsel-panel, .cc-dsel-panel, .cc-sel-panel, .cc-drop")) return;
        var wrap = t.closest(CC_SEL_WHEEL);
        if (!wrap || wrap.classList.contains("cc-open") || !wrap.contains(document.activeElement)) return;
        if (wrap.classList.contains("cc-tsel-disabled") || wrap.classList.contains("cc-dsel-disabled") || wrap.classList.contains("cc-sel-disabled")) return;
        var dy = e.deltaY || 0, dx = e.deltaX || 0;
        var d = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        if (!d) return;
        if (wheelStepSelect(wrap, d > 0 ? 1 : -1)) e.preventDefault();
      } catch (e3) {}
    }, { passive: false, capture: true });
  }
  bindSelectWheel();

  // Google Fonts for the server-name wordmark as [family, generic fallback], loaded on demand so
  // they render on any client. loadGFonts merges all families into one <link>, so the header (one
  // family) and the settings dropdown (all of them, for the previews) do not overwrite each other.
  var GFONTS = [
    ["Anton", "sans-serif"], ["Archivo Black", "sans-serif"], ["Audiowide", "sans-serif"], ["Bebas Neue", "sans-serif"],
    ["Bitter", "serif"], ["Comfortaa", "sans-serif"], ["Cormorant Garamond", "serif"], ["Fredoka", "sans-serif"],
    ["Inter", "sans-serif"], ["Lato", "sans-serif"], ["Lobster", "cursive"], ["Merriweather", "serif"],
    ["Montserrat", "sans-serif"], ["Nunito", "sans-serif"], ["Orbitron", "sans-serif"], ["Oswald", "sans-serif"],
    ["Outfit", "sans-serif"], ["Pacifico", "cursive"], ["Playfair Display", "serif"], ["Poppins", "sans-serif"],
    ["Quicksand", "sans-serif"], ["Righteous", "sans-serif"], ["Roboto", "sans-serif"], ["Rubik", "sans-serif"],
    ["Russo One", "sans-serif"], ["Sora", "sans-serif"], ["Teko", "sans-serif"], ["Work Sans", "sans-serif"]
  ];
  function loadGFonts(fams) {
    try {
      if (!fams || !fams.length) return;
      var link = document.getElementById("cc-gfonts");
      var have = (link && link.dataset.fams) ? link.dataset.fams.split("|") : [];
      fams.forEach(function (f) { if (f && have.indexOf(f) < 0) have.push(f); });
      if (!have.length) return;
      have.sort();
      var href = "https://fonts.googleapis.com/css2?" + have.map(function (f) { return "family=" + f.replace(/ /g, "+") + ":wght@400;700"; }).join("&") + "&display=swap";
      if (!link) { link = document.createElement("link"); link.id = "cc-gfonts"; link.rel = "stylesheet"; (document.head || document.documentElement).appendChild(link); }
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
      link.dataset.fams = have.join("|");
    } catch (e) {}
  }
  // primaryFamily("\"Montserrat\",sans-serif") -> "Montserrat"; used to tell if a chosen brand font is a GFONT.
  function primaryFamily(css) { var m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(String(css || "")); return (m ? (m[1] || m[2] || m[3] || "") : "").trim(); }

  // The (i) info bubble for every area script, after reference/tooltip.ts infoIcon(). The glyph is
  // an outline ring, the one exception the "Icon glyphs" section allows, because the ring is the
  // letter i set in a circle and filling it leaves a meaningless disc. The markup matches BombVault's
  // InfoBubble.tsx: r=7, stroke-width 1.3, dot r=0.9, and a round-capped <path> for the stem, since
  // a <rect>'s rx rounds the ends differently. It is neutral, not accent: the sheets resolve
  // currentColor to var(--txt). The text goes into data-tip and is rendered by header.js's
  // body-level #cc-tipfloat, because any overflow:hidden ancestor would clip a local child.
  var CC_INFO_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>';
  function infoIcon(tip) {
    var s = document.createElement("span");
    s.className = "cc-info";
    s.innerHTML = CC_INFO_SVG;
    if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); }
    s.setAttribute("tabindex", "0");   // rule 8: reachable by keyboard, so focus opens it like hover does
    return s;
  }

  // GlimStone's glyph set (reference/glyphs.json), for every glyph CannonadeCommand draws on its own
  // controls; Unraid's own icons keep their Font Awesome. Each entry is the square viewBox cropped
  // to the drawing's ink and the drawing, so every glyph fills its box alike. Sources: Streamline
  // Core Solid, free set (CC BY 4.0), Tabler Icons (MIT), and drawings made for GlimStone,
  // BombVault and KnightLoader. Log is drawn for CannonadeCommand, since the set has no log, and so
  // are Shield, the outline of IconShieldOn, and ShieldAlert, that outline with an exclamation mark
  // cut out where IconShieldOn has its check. Star is Tabler's filled star, which the Favorites tab
  // already wears, and Containers is the Simple Icons whale (CC0).
  var GLYPHS = {
    "ExternalLink": ["0 0 14 14", '<path fill-rule="evenodd" d="M7 2 2.5 2a0.5 0.5 0 0 0 -0.5 0.5l0 9a0.5 0.5 0 0 0 0.5 0.5l9 0a0.5 0.5 0 0 0 0.5 -0.5L12 7a1 1 0 1 1 2 0l0 4.5a2.5 2.5 0 0 1 -2.5 2.5l-9 0A2.5 2.5 0 0 1 0 11.5l0 -9A2.5 2.5 0 0 1 2.5 0L7 0a1 1 0 0 1 0 2ZM9.538 0.309A0.5 0.5 0 0 1 10 0l3.5 0a0.5 0.5 0 0 1 0.5 0.5L14 4a0.5 0.5 0 0 1 -0.854 0.354L12.104 3.31 7.707 7.707a1 1 0 0 1 -1.414 -1.414l4.396 -4.397L9.646 0.854a0.5 0.5 0 0 1 -0.108 -0.545Z"/>'],
    "Gear": ["-0.001 0 14 14", '<path fill-rule="evenodd" d="m5.557 0.69 -0.463 1.195 -1.594 0.904 -1.27 -0.194a1.077 1.077 0 0 0 -1.078 0.528l-0.43 0.754a1.077 1.077 0 0 0 0.086 1.217l0.807 1.001v1.81L0.83 8.906a1.077 1.077 0 0 0 -0.086 1.217l0.43 0.754a1.077 1.077 0 0 0 1.078 0.528l1.27 -0.194 1.573 0.904 0.463 1.196a1.076 1.076 0 0 0 1 0.689h0.905a1.076 1.076 0 0 0 1.002 -0.69l0.463 -1.195 1.572 -0.904 1.27 0.194a1.077 1.077 0 0 0 1.078 -0.528l0.43 -0.754a1.077 1.077 0 0 0 -0.086 -1.217l-0.807 -1.001v-1.81l0.786 -1.001a1.077 1.077 0 0 0 0.086 -1.217l-0.43 -0.754a1.076 1.076 0 0 0 -1.078 -0.528l-1.27 0.194 -1.573 -0.904L8.443 0.689A1.077 1.077 0 0 0 7.442 0h-0.884a1.077 1.077 0 0 0 -1.001 0.69ZM7 9.25a2.25 2.25 0 1 0 0 -4.5 2.25 2.25 0 0 0 0 4.5Z"/>'],
    "Folder": ["0 -0.25 14 14", '<path d="M6.12675 0.805269c-0.2708 -0.205804 -0.60343 -0.313418 -0.9433 -0.305333H1.5c-0.39782 0 -0.779356 0.158035 -1.06066 0.43934C0.158035 1.22058 0 1.60211 0 1.99994v9.99996c0 0.3979 0.158035 0.7794 0.43934 1.0607 0.281304 0.2813 0.66283 0.4393 1.06066 0.4393h11c0.3978 0 0.7794 -0.158 1.0607 -0.4393S14 12.3978 14 11.9999V3.99994c0 -0.39783 -0.158 -0.77936 -0.4393 -1.06066 -0.2813 -0.28131 -0.6629 -0.43934 -1.0607 -0.43934H6.89039l-0.21495 -0.85979c-0.08224 -0.33249 -0.27599 -0.62762 -0.54869 -0.834881Z"/>'],
    "ViewList": ["0.5 0.5 13 13", '<path d="M1.3 0.5H2.7A0.8 0.8 0 0 1 3.5 1.3V2.7A0.8 0.8 0 0 1 2.7 3.5H1.3A0.8 0.8 0 0 1 0.5 2.7V1.3A0.8 0.8 0 0 1 1.3 0.5ZM6 0.9L12.4 0.9A1.1 1.1 0 0 1 12.4 3.1L6 3.1A1.1 1.1 0 0 1 6 0.9ZM1.3 5.5H2.7A0.8 0.8 0 0 1 3.5 6.3V7.7A0.8 0.8 0 0 1 2.7 8.5H1.3A0.8 0.8 0 0 1 0.5 7.7V6.3A0.8 0.8 0 0 1 1.3 5.5ZM6 5.9L12.4 5.9A1.1 1.1 0 0 1 12.4 8.1L6 8.1A1.1 1.1 0 0 1 6 5.9ZM1.3 10.5H2.7A0.8 0.8 0 0 1 3.5 11.3V12.7A0.8 0.8 0 0 1 2.7 13.5H1.3A0.8 0.8 0 0 1 0.5 12.7V11.3A0.8 0.8 0 0 1 1.3 10.5ZM6 10.9L12.4 10.9A1.1 1.1 0 0 1 12.4 13.1L6 13.1A1.1 1.1 0 0 1 6 10.9Z" />'],
    "ViewGrid": ["0 0 14 14", '<path d="M1.5 0H4.5A1.5 1.5 0 0 1 6 1.5V4.5A1.5 1.5 0 0 1 4.5 6H1.5A1.5 1.5 0 0 1 0 4.5V1.5A1.5 1.5 0 0 1 1.5 0ZM9.5 0H12.5A1.5 1.5 0 0 1 14 1.5V4.5A1.5 1.5 0 0 1 12.5 6H9.5A1.5 1.5 0 0 1 8 4.5V1.5A1.5 1.5 0 0 1 9.5 0ZM1.5 8H4.5A1.5 1.5 0 0 1 6 9.5V12.5A1.5 1.5 0 0 1 4.5 14H1.5A1.5 1.5 0 0 1 0 12.5V9.5A1.5 1.5 0 0 1 1.5 8ZM9.5 8H12.5A1.5 1.5 0 0 1 14 9.5V12.5A1.5 1.5 0 0 1 12.5 14H9.5A1.5 1.5 0 0 1 8 12.5V9.5A1.5 1.5 0 0 1 9.5 8Z" />'],
    "Pencil": ["-0.002 -0.001 14.001 14.001", '<path d="M10.715 -0.000976562c-0.1998 0 -0.3976 0.039922962 -0.5818 0.117424562 -0.18301 0.07702 -0.34892 0.18961 -0.48808 0.331228L1.40732 8.64549c-0.06116 0.06086 -0.10553 0.13651 -0.12879 0.21959L0.0185299 13.3651c-0.0487051 0.1739 0.0001992 0.3606 0.1279281 0.4884 0.12773 0.1277 0.314422 0.1766 0.488369 0.1279l4.500003 -1.26c0.08308 -0.0233 0.15873 -0.0677 0.21959 -0.1288l8.19768 -8.2377 0.0014 -0.00135c0.1399 -0.13917 0.251 -0.30459 0.3269 -0.48679 0.0762 -0.18278 0.1154 -0.37884 0.1154 -0.57686 0 -0.19802 -0.0392 -0.39408 -0.1154 -0.57687 -0.0759 -0.1822 -0.187 -0.34763 -0.3269 -0.48679l-0.0014 -0.00134L11.7859 0.448721c-0.1393 -0.14211 -0.3056 -0.255064 -0.4891 -0.332273 -0.1842 -0.0775016 -0.382 -0.117424562 -0.5818 -0.117424562Z"/>'],
    "Refresh": ["0.128 0.252 13.745 13.745", '<path fill-rule="evenodd" d="M5.35099 1.00245c0 -0.303349 -0.18273 -0.576826 -0.46299 -0.692912 -0.28026 -0.116085 -0.60284 -0.051918 -0.81734 0.16258L1.67164 2.87114c-0.2929 0.29289 -0.2929 0.76777 0 1.06066l2.39902 2.39902c0.2145 0.2145 0.53708 0.27867 0.81734 0.16258 0.28026 -0.11608 0.46299 -0.38956 0.46299 -0.69291V4.40137h1.64902c2.0976 0 3.79809 1.70045 3.79809 3.79805 0 2.09758 -1.70049 3.79808 -3.79809 3.79808S3.20197 10.297 3.20197 8.19942c0 -0.55229 -0.44772 -1 -1 -1 -0.55229 0 -1 0.44771 -1 1 0 3.20218 2.59587 5.79808 5.79804 5.79808 3.20219 0 5.79809 -2.5959 5.79809 -5.79808 0 -3.20217 -2.5959 -5.79805 -5.79809 -5.79805H5.35099V1.00245Z"/>'],
    "Play": ["0.01 0.019 13.981 13.981", '<path fill-rule="evenodd" d="M2.67593 0.019165c-0.29576 0 -0.58657 0.0753875 -0.84499 0.218948 -0.26314 0.134139 -0.48525 0.336896 -0.64277 0.58693 -0.15979 0.253627 -0.247004 0.546207 -0.252169 0.845927l-0.000075 0V12.3396H0.935852l0.000149 0.0086c0.005165 0.2997 0.092379 0.5923 0.252169 0.8459 0.15752 0.2501 0.37963 0.4528 0.64277 0.587 0.25842 0.1435 0.54923 0.2189 0.84499 0.2189 0.29995 0 0.59481 -0.0775 0.85596 -0.2251 0.00575 -0.0032 0.01143 -0.0066 0.01704 -0.0101l8.62977 -5.33745c0.2617 -0.13189 0.4826 -0.33282 0.6388 -0.5813 0.1611 -0.25659 0.2467 -0.55345 0.2467 -0.85647 0 -0.30301 -0.0856 -0.59988 -0.2467 -0.85646 -0.1563 -0.24874 -0.3776 -0.44984 -0.6396 -0.58172L3.54751 0.253465c-0.00515 -0.00316 -0.01036 -0.006227 -0.01562 -0.009199 -0.26115 -0.1475588 -0.55601 -0.225101 -0.85596 -0.225101Z"/>'],
    "Pause": ["0 0 14 14", '<path fill-rule="evenodd" d="M0 1.5C0 0.671573 0.671573 0 1.5 0H4c0.82843 0 1.5 0.671573 1.5 1.5v11c0 0.8284 -0.67157 1.5 -1.5 1.5H1.5C0.671573 14 0 13.3284 0 12.5v-11ZM10 0c-0.82843 0 -1.5 0.671573 -1.5 1.5v11c0 0.8284 0.67157 1.5 1.5 1.5h2.5c0.8284 0 1.5 -0.6716 1.5 -1.5v-11c0 -0.828427 -0.6716 -1.5 -1.5 -1.5H10Z"/>'],
    "Stop": ["0 0 14 14", '<path fill-rule="evenodd" d="M1.5 0C0.671573 0 0 0.671573 0 1.5v11c0 0.8284 0.671573 1.5 1.5 1.5h11c0.8284 0 1.5 -0.6716 1.5 -1.5v-11c0 -0.828427 -0.6716 -1.5 -1.5 -1.5h-11Z"/>'],
    "Resume": ["0 0.333 13.335 13.335", '<path fill-rule="evenodd" d="M0 2.25A1.625 1.625 0 0 1 3.25 2.25V11.75A1.625 1.625 0 0 1 0 11.75ZM4.75 2.35Q4.75 0.75 6.08 1.65L12.67 6.1Q14 7 12.67 7.9L6.08 12.35Q4.75 13.25 4.75 11.65Z"/>'],
    "Code": ["0.051 0.053 13.898 13.898", '<path fill-rule="evenodd" d="M5.154 12.122 L5.155 12.289 L5.188 12.452 L5.296 12.677 L5.403 12.805 L5.532 12.91 L5.68 12.987 L5.839 13.035 L6.005 13.05 L6.171 13.033 L6.33 12.983 L6.477 12.904 L6.605 12.797 L6.71 12.668 L6.815 12.442 L8.846 1.878 L8.833 1.629 L8.783 1.47 L8.704 1.323 L8.597 1.195 L8.468 1.09 L8.242 0.985 L8.078 0.954 L7.911 0.955 L7.748 0.988 L7.595 1.053 L7.457 1.146 L7.34 1.265 L7.248 1.404 L7.185 1.558ZM0.135 6.629 L0.077 6.789 L0.051 7.043 L0.077 7.211 L0.176 7.446 L2.879 10.98 L3.004 11.09 L3.148 11.174 L3.306 11.227 L3.471 11.249 L3.637 11.239 L3.798 11.196 L3.948 11.123 L4.08 11.021 L4.235 10.826 L4.304 10.675 L4.343 10.512 L4.339 10.263 L4.263 10.025 L4.175 9.884 L1.97 7 L4.175 4.116 L4.263 3.975 L4.339 3.737 L4.343 3.488 L4.274 3.248 L4.138 3.039 L4.016 2.925 L3.875 2.837 L3.719 2.779 L3.554 2.752 L3.388 2.757 L3.225 2.796 L3.074 2.865 L2.939 2.962 L2.825 3.084 L0.225 6.484ZM9.777 9.952 L9.704 10.102 L9.661 10.263 L9.657 10.512 L9.696 10.675 L9.765 10.826 L9.92 11.021 L10.052 11.123 L10.202 11.196 L10.446 11.248 L10.694 11.227 L10.852 11.174 L10.996 11.09 L11.175 10.916 L13.775 7.516 L13.898 7.293 L13.94 7.128 L13.949 6.957 L13.923 6.789 L13.865 6.629 L13.775 6.484 L11.121 3.02 L10.926 2.865 L10.775 2.796 L10.612 2.757 L10.363 2.761 L10.125 2.837 L9.92 2.979 L9.81 3.104 L9.726 3.248 L9.657 3.488 L9.652 3.654 L9.704 3.898 L9.825 4.116 L12.03 7Z"/>'],
    "Trash": ["0 0 14 14", '<path fill-rule="evenodd" d="M5.76256 2.01256C6.09075 1.68437 6.53587 1.5 7 1.5c0.46413 0 0.90925 0.18437 1.23744 0.51256 0.20736 0.20737 0.35731 0.46141 0.43961 0.73744h-3.3541c0.0823 -0.27603 0.23225 -0.53007 0.43961 -0.73744ZM3.78868 2.75c0.10537 -0.67679 0.42285 -1.30773 0.91322 -1.798097C5.3114 0.34241 6.13805 0 7 0c0.86195 0 1.6886 0.34241 2.2981 0.951903 0.49037 0.490367 0.8079 1.121307 0.9132 1.798097H13c0.4142 0 0.75 0.33579 0.75 0.75 0 0.41422 -0.3358 0.75 -0.75 0.75h-1v8.25c0 0.3978 -0.158 0.7794 -0.4393 1.0607S10.8978 14 10.5 14h-7c-0.39783 0 -0.77936 -0.158 -1.06066 -0.4393C2.15804 13.2794 2 12.8978 2 12.5V4.25H1c-0.414214 0 -0.75 -0.33578 -0.75 -0.75 0 -0.41421 0.335786 -0.75 0.75 -0.75h2.78868ZM5 5.87646c0.34518 0 0.625 0.27983 0.625 0.625V10.503c0 0.3451 -0.27982 0.625 -0.625 0.625s-0.625 -0.2799 -0.625 -0.625V6.50146c0 -0.34517 0.27982 -0.625 0.625 -0.625Zm4.625 0.625c0 -0.34517 -0.27982 -0.625 -0.625 -0.625s-0.625 0.27983 -0.625 0.625V10.503c0 0.3451 0.27982 0.625 0.625 0.625s0.625 -0.2799 0.625 -0.625V6.50146Z"/>'],
    "TrashFiles": ["-0.019 0 14.019 14.019", '<path fill-rule="evenodd" d="M3.5 0A1.5 1.5 0 0 0 2 1.5v5.949c0.057 0.045 0.112 0.094 0.164 0.147l0.706 0.706 0.706 -0.706a2 2 0 0 1 2.828 2.828l-0.706 0.706 0.706 0.706A2 2 0 0 1 6.844 14H12.5a1.5 1.5 0 0 0 1.5 -1.5v-8a0.5 0.5 0 0 0 -0.146 -0.354l-4 -4A0.5 0.5 0 0 0 9.5 0h-6Zm2.02 8.48a0.75 0.75 0 0 1 0 1.06l-1.59 1.59 1.59 1.59a0.75 0.75 0 1 1 -1.06 1.06l-1.59 -1.59 -1.59 1.59a0.75 0.75 0 0 1 -1.06 -1.06l1.59 -1.59L0.22 9.54a0.75 0.75 0 1 1 1.06 -1.06l1.59 1.59 1.59 -1.59a0.75 0.75 0 0 1 1.06 0Z"/>'],
    "More": ["0 0 14 14", '<path fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7ZM4 8c0.55228 0 1 -0.44772 1 -1s-0.44772 -1 -1 -1 -1 0.44772 -1 1 0.44772 1 1 1Zm4 -1c0 0.55228 -0.44772 1 -1 1s-1 -0.44772 -1 -1 0.44772 -1 1 -1 1 0.44772 1 1Zm2 1c0.5523 0 1 -0.44772 1 -1s-0.4477 -1 -1 -1c-0.55229 0 -1 0.44772 -1 1s0.44771 1 1 1Z"/>'],
    "Help": ["0 0 14 14", '<path fill-rule="evenodd" d="M14 7c0 3.866 -3.134 7 -7 7 -3.86599 0 -7 -3.134 -7 -7 0 -3.86599 3.13401 -7 7 -7 3.866 0 7 3.13401 7 7ZM5.75 5.25C5.75 4.55964 6.30964 4 7 4s1.25 0.55964 1.25 1.25S7.69036 6.5 7 6.5c-0.41421 0 -0.75 0.33579 -0.75 0.75v0.64648c0 0.41422 0.33579 0.75 0.75 0.75s0.75 -0.33578 0.75 -0.75c1.15425 -0.32646 2 -1.3877 2 -2.64648C9.75 3.73122 8.51878 2.5 7 2.5S4.25 3.73122 4.25 5.25c0 0.41421 0.33579 0.75 0.75 0.75s0.75 -0.33579 0.75 -0.75ZM8 10.5c0 0.5523 -0.44771 1 -1 1s-1 -0.4477 -1 -1c0 -0.55229 0.44771 -1 1 -1s1 0.44771 1 1Z"/>'],
    "Search": ["-0.001 0 13.988 13.988", '<path fill-rule="evenodd" d="M2 6a4 4 0 1 1 8 0 4 4 0 0 1 -8 0Zm4 -6a6 6 0 1 0 3.476 10.89l2.817 2.817a1 1 0 0 0 1.414 -1.414l-2.816 -2.816A6 6 0 0 0 6 0Z" clip-rule="evenodd" />'],
    "Info": ["0 0 14 14", '<path fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7ZM5.5 9.375c-0.34518 0 -0.625 0.27982 -0.625 0.625 0 0.3452 0.27982 0.625 0.625 0.625h3c0.34518 0 0.625 -0.2798 0.625 -0.625 0 -0.34518 -0.27982 -0.625 -0.625 -0.625h-0.875V6.5c0 -0.34518 -0.27982 -0.625 -0.625 -0.625H6c-0.34518 0 -0.625 0.27982 -0.625 0.625s0.27982 0.625 0.625 0.625h0.375v2.25H5.5ZM8 4c0 0.55228 -0.44772 1 -1 1s-1 -0.44772 -1 -1 0.44772 -1 1 -1 1 0.44772 1 1Z"/>'],
    "Manual": ["0 0 14 14", '<path fill-rule="evenodd" d="M3 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9.25a.75.75 0 0 0 0-1.5H3a.5.5 0 0 1 0-1h9.25A.75.75 0 0 0 13 10.75V1a1 1 0 0 0-1-1H3Zm1.75 3a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"/>'],
    "VM": ["0 0.247 14 14", '<path fill-rule="evenodd" d="M2 9V2.5h10V9H2ZM1.457 0.5C0.652 0.5 0 1.152 0 1.957v7.586C0 10.348 0.652 11 1.457 11h4.026l-0.535 1.495H4a0.75 0.75 0 0 0 0 1.5h6a0.75 0.75 0 0 0 0 -1.5h-0.948L8.517 11h4.026C13.348 11 14 10.348 14 9.543V1.957C14 1.152 13.348 0.5 12.543 0.5H1.457Z"/>'],
    "Moon": ["-0.015 0 14 14", '<path fill-rule="evenodd" d="M9 0a7 7 0 0 0 0 14l0.004 0a7.079 7.079 0 0 0 2.657 -0.538 0.5 0.5 0 0 0 0.061 -0.894A6.5 6.5 0 0 1 8.5 7a6.5 6.5 0 0 1 3.194 -5.568 0.5 0.5 0 0 0 -0.063 -0.893A7.08 7.08 0 0 0 9.006 0H9Z"/>'],
    "Power": ["0 0 14 14", '<path fill-rule="evenodd" d="M8 1c0 -0.552285 -0.44772 -1 -1 -1S6 0.447715 6 1v5.07692c0 0.55229 0.44772 1 1 1s1 -0.44771 1 -1V1ZM3.92308 3.05886c0.43532 -0.33987 0.51271 -0.96829 0.17284 -1.40361 -0.33987 -0.43533 -0.96829 -0.51271 -1.40361 -0.17285C1.54339 2.37939 0.703135 3.61265 0.288786 5.01012 -0.125563 6.40758 -0.0933357 7.89953 0.38097 9.27781 0.855276 10.6561 1.748 11.8519 2.93458 12.6984 4.12116 13.545 5.5424 14 7 14c1.4576 0 2.87884 -0.455 4.0654 -1.3016 1.1866 -0.8465 2.0793 -2.0423 2.5536 -3.42059 0.4743 -1.37827 0.5066 -2.87023 0.0922 -4.26769 -0.4143 -1.39747 -1.2546 -2.63073 -2.4035 -3.52772 -0.4353 -0.33986 -1.0638 -0.26248 -1.40362 0.17285 -0.33987 0.43532 -0.26248 1.06374 0.17282 1.40361 0.8207 0.6407 1.4209 1.5216 1.7168 2.51979 0.296 0.99819 0.273 2.06387 -0.0658 3.04835s-0.9765 1.8386 -1.82403 2.4433C9.05632 11.675 8.04114 12 7 12s-2.05632 -0.325 -2.90387 -0.9297c-0.84756 -0.6047 -1.48522 -1.45882 -1.82401 -2.4433 -0.33879 -0.98448 -0.36181 -2.05016 -0.06584 -3.04835 0.29596 -0.99819 0.89614 -1.87909 1.7168 -2.51979Z"/>'],
    "BackupNow": ["0.065 0.06 13.882 13.882", '<path fill-rule="evenodd" d="M0.193 1.969c0 -0.111 0.055 -0.283 0.294 -0.507 0.24 -0.224 0.623 -0.455 1.148 -0.662C2.68 0.388 4.167 0.12 5.84 0.12c1.674 0 3.161 0.269 4.206 0.681 0.525 0.207 0.907 0.438 1.148 0.662 0.24 0.224 0.294 0.396 0.294 0.507 0 0.111 -0.055 0.283 -0.294 0.506 -0.241 0.225 -0.623 0.455 -1.148 0.662 -1.045 0.413 -2.532 0.682 -4.206 0.682 -1.673 0 -3.16 -0.27 -4.205 -0.682C1.11 2.93 0.728 2.7 0.487 2.475 0.247 2.252 0.193 2.08 0.193 1.97Zm11.422 1.76c-0.323 0.22 -0.7 0.41 -1.11 0.571 -1.225 0.484 -2.874 0.769 -4.665 0.769 -1.79 0 -3.44 -0.285 -4.664 -0.769a5.746 5.746 0 0 1 -1.11 -0.57v2.584c0.04 0.093 0.118 0.208 0.266 0.343 0.248 0.226 0.642 0.458 1.183 0.666 1.076 0.414 2.605 0.683 4.325 0.683 1.72 0 3.25 -0.27 4.326 -0.683 0.54 -0.208 0.935 -0.44 1.183 -0.666a1.02 1.02 0 0 0 0.266 -0.343V3.73ZM0.065 9.89V8.006c0.3 0.183 0.637 0.343 1 0.483 1.253 0.482 2.942 0.767 4.775 0.767 1.834 0 3.522 -0.285 4.775 -0.767l0.03 -0.011 -1.733 1.949 -0.528 -0.396a2 2 0 0 0 -3.065 2.322C2.374 12.242 0.066 11.18 0.066 9.89Zm13.68 -0.76a0.75 0.75 0 1 0 -1.121 -0.996l-3.542 3.984 -1.448 -1.086a0.75 0.75 0 0 0 -0.9 1.2l2 1.5a0.75 0.75 0 0 0 1.01 -0.102l4 -4.5Z"/>'],
    "Copy": ["2 2 20 20", '<path d="M20.926 7.074a3.67 3.67 0 0 1 1.074 2.593v8.666a3.667 3.667 0 0 1 -3.667 3.667h-8.666a3.667 3.667 0 0 1 -3.667 -3.667v-8.666q 0 -.053 .005 -.102a3.66 3.66 0 0 1 3.662 -3.565h8.666c.973 0 1.905 .386 2.593 1.074"/><path d="M17.374 3.514a1 1 0 1 1 -1.748 .972c-.221 -.398 -.342 -.486 -.626 -.486h-10c-.548 0 -1 .452 -1 1v9.998c0 .36 .194 .692 .507 .87a1 1 0 1 1 -.99 1.738a3 3 0 0 1 -1.517 -2.606v-10c0 -1.652 1.348 -3 3 -3h10c1.094 0 1.828 .533 2.374 1.514"/>'],
    "Restore": ["0 0 14 14", '<path fill-rule="evenodd" d="M8 0c-0.55228 0 -1 0.447715 -1 1 0 0.55228 0.44772 1 1 1h1.5c0.27614 0 0.5 0.22386 0.5 0.5v6H8.5c-0.20223 0 -0.38455 0.12182 -0.46194 0.30866 -0.07739 0.18684 -0.03461 0.40189 0.10839 0.54489l2.49995 2.50005c0.1953 0.1952 0.5119 0.1952 0.7072 0l2.5 -2.50005c0.143 -0.143 0.1857 -0.35805 0.1083 -0.54489C13.8845 8.62182 13.7022 8.5 13.5 8.5H12v-6C12 1.11929 10.8807 0 9.5 0H8ZM3.35355 2.14645c-0.19526 -0.19527 -0.51184 -0.19527 -0.7071 0l-2.500003 2.5c-0.14299938 0.143 -0.1857772 0.35805 -0.1083868 0.54489C0.115451 5.37818 0.297769 5.5 0.5 5.5H2v6C2 12.8807 3.11929 14 4.5 14H6c0.55228 0 1 -0.4477 1 -1s-0.44772 -1 -1 -1H4.5c-0.27614 0 -0.5 -0.2239 -0.5 -0.5v-6h1.5c0.20223 0 0.38455 -0.12182 0.46194 -0.30866 0.07739 -0.18684 0.03461 -0.40189 -0.10839 -0.54489l-2.5 -2.5Z"/>'],
    "Download": ["0 0 14 14", '<path fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7Zm3.1464 -5.68958L7.3535 11.1033c-0.19526 0.1953 -0.51184 0.1953 -0.7071 0L3.8535 8.31042c-0.31498 -0.31499 -0.09189 -0.85356 0.35356 -0.85356h1.79289l0 -3.70686c0 -0.55228 0.44772 -1 1 -1 0.55229 0 1 0.44772 1 1l0 3.70686h1.79289c0.44546 0 0.66856 0.53857 0.35356 0.85356Z"/>'],
    "Close": ["0 0 14 14", '<path fill-rule="evenodd" d="M11.957 13.716 L12.056 13.789 L12.272 13.905 L12.506 13.976 L12.75 14 L12.994 13.976 L13.228 13.905 L13.444 13.789 L13.543 13.716 L13.716 13.543 L13.789 13.444 L13.905 13.228 L13.976 12.994 L14 12.75 L13.976 12.506 L13.905 12.272 L13.852 12.161 L13.789 12.056 L13.634 11.866 L8.768 7 L13.716 2.043 L13.789 1.944 L13.905 1.728 L13.976 1.494 L14 1.25 L13.976 1.006 L13.905 0.772 L13.789 0.556 L13.716 0.457 L13.543 0.284 L13.339 0.148 L13.113 0.054 L12.873 0.006 L12.627 0.006 L12.387 0.054 L12.272 0.095 L12.056 0.211 L11.866 0.366 L7 5.232 L2.043 0.284 L1.839 0.148 L1.613 0.054 L1.494 0.024 L1.25 0 L1.127 0.006 L0.887 0.054 L0.661 0.148 L0.457 0.284 L0.284 0.457 L0.211 0.556 L0.095 0.772 L0.024 1.006 L0 1.25 L0.024 1.494 L0.095 1.728 L0.211 1.944 L0.366 2.134 L5.232 7 L0.284 11.957 L0.211 12.056 L0.095 12.272 L0.024 12.506 L0 12.75 L0.024 12.994 L0.095 13.228 L0.211 13.444 L0.284 13.543 L0.457 13.716 L0.661 13.852 L0.772 13.905 L1.006 13.976 L1.25 14 L1.494 13.976 L1.728 13.905 L1.944 13.789 L2.134 13.634 L7 8.768Z"/>'],
    "Warning": ["0.003 0.006 13.994 13.994", '<path fill-rule="evenodd" d="M6.21769 0.226033c0.23555 -0.1439857 0.50627 -0.22017362 0.78234 -0.22017362 0.27607 0 0.54678 0.07618792 0.78233 0.22017362 0.23555 0.143986 0.42679 0.350183 0.55267 0.595886l0.00223 0.004362 -0.00002 0.000011L13.8365 11.8249l0.0004 0.0007c0.1148 0.2281 0.1695 0.4819 0.1588 0.7371 -0.0107 0.2555 -0.0865 0.504 -0.2203 0.7219 -0.1338 0.2179 -0.321 0.398 -0.544 0.5232 -0.2229 0.1252 -0.4742 0.1913 -0.7299 0.1921l-0.0015 0H1.50003l-0.00152 0c-0.25569 -0.0008 -0.506947 -0.0669 -0.729898 -0.1921 -0.22295 -0.1252 -0.410196 -0.3053 -0.543955 -0.5232 -0.1337584 -0.2179 -0.2095892 -0.4664 -0.22029075 -0.7219 -0.01068905 -0.2552 0.04395355 -0.5089 0.15874275 -0.737l0.000404 -0.0008L5.66281 0.826292 5.665 0.821908l0.00003 0.000011c0.12587 -0.245703 0.31712 -0.4519 0.55266 -0.595886ZM7 4.125c0.41421 0 0.75 0.33579 0.75 0.75v3.25c0 0.41421 -0.33579 0.75 -0.75 0.75s-0.75 -0.33579 -0.75 -0.75v-3.25c0 -0.41421 0.33579 -0.75 0.75 -0.75Zm1 6.75c0 0.5523 -0.44772 1 -1 1s-1 -0.4477 -1 -1 0.44772 -1 1 -1 1 0.4477 1 1Z"/>'],
    "Check": ["0.3 0.549 13.399 13.399", '<path fill-rule="evenodd" d="M4.381 12.219 L4.574 12.378 L4.793 12.497 L5.032 12.572 L5.155 12.592 L5.405 12.596 L5.651 12.552 L5.884 12.461 L6.096 12.328 L6.278 12.157 L13.457 3.957 L13.584 3.736 L13.666 3.495 L13.699 3.242 L13.683 2.988 L13.656 2.863 L13.566 2.625 L13.431 2.408 L13.257 2.222 L13.05 2.074 L12.936 2.016 L12.695 1.934 L12.442 1.901 L12.188 1.917 L11.942 1.983 L11.713 2.096 L11.511 2.251 L5.238 9.399 L2.519 6.681 L2.425 6.595 L2.213 6.454 L1.977 6.356 L1.854 6.325 L1.6 6.3 L1.346 6.325 L1.223 6.356 L0.987 6.454 L0.775 6.595 L0.595 6.775 L0.454 6.987 L0.399 7.103 L0.325 7.346 L0.3 7.6 L0.306 7.727 L0.356 7.977 L0.399 8.097 L0.519 8.322 L0.681 8.519Z"/>'],
    "Eye": ["0 0 14 14", '<path fill-rule="evenodd" d="M2.9327 3.49099C4.0559 2.68177 5.4556 2 7 2c1.54441 0 2.9441 0.68177 4.0673 1.49099 1.1273 0.81215 2.0197 1.78397 2.5599 2.4369l0.0045 0.00553c0.2413 0.3002 0.3683 0.68062 0.3683 1.06664 0 0.38601 -0.127 0.76644 -0.3683 1.06664l-0.0045 0.00553c-0.5402 0.65292 -1.4326 1.62475 -2.5599 2.43687 -1.1232 0.8092 -2.52289 1.491 -4.0673 1.491 -1.5444 0 -2.9441 -0.6818 -4.0673 -1.491C1.80544 9.69698 0.913028 8.72515 0.37279 8.07223L0.36828 8.0667C0.127025 7.7665 0 7.38607 0 7.00006c0 -0.38602 0.127025 -0.76644 0.36828 -1.06664l0.00451 -0.00553c0.540238 -0.65293 1.43265 -1.62475 2.55991 -2.4369ZM7 9.25c1.24264 0 2.25 -1.00736 2.25 -2.25S8.24264 4.75 7 4.75 4.75 5.75736 4.75 7 5.75736 9.25 7 9.25Z"/>'],
    "EyeOff": ["0.044 0.044 13.912 13.912", '<path fill-rule="evenodd" d="M0.263638 1.32434c-0.2928929 -0.2929 -0.2928929 -0.767771 0 -1.060664 0.292894 -0.2928929 0.767772 -0.2928929 1.060662 0L3.95291 2.89228c0.90784 -0.49884 1.93998 -0.85203 3.04708 -0.85203 1.53199 0 2.92043 0.67629 4.03461 1.479 1.1182 0.80562 2.0034 1.76963 2.5393 2.41731l0.0045 0.00548c0.2393 0.29779 0.3653 0.67515 0.3653 1.05806s-0.126 0.76028 -0.3653 1.05806l-0.0045 0.00549c-0.4886 0.59054 -1.2677 1.44407 -2.2489 2.20075l2.4114 2.4113c0.2929 0.2929 0.2929 0.7678 0 1.0607 -0.2929 0.2929 -0.7678 0.2929 -1.0607 0L0.263638 1.32434ZM9.01713 7.95651c0.13771 -0.2899 0.21477 -0.61419 0.21477 -0.95649 0 -1.23264 -0.99926 -2.2319 -2.23191 -2.2319 -0.34229 0 -0.66659 0.07705 -0.95649 0.21476l2.97363 2.97363ZM0.426074 5.93656c0.319448 -0.38609 0.763036 -0.88458 1.306096 -1.39491l7.10402 7.10405c-0.58062 0.1961 -1.19587 0.3143 -1.8362 0.3143 -1.53198 0 -2.92042 -0.6763 -4.03459 -1.479C1.8472 9.67534 0.961967 8.71133 0.426074 8.06365L0.4216 8.05816C0.182285 7.76038 0.0562814 7.38301 0.0562814 7.0001S0.182285 6.23983 0.4216 5.94204l0.004474 -0.00548Z"/>'],
    "Schedules": ["0 0 14 14", '<path fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7Zm0.625 -9.5c0 -0.34518 -0.27982 -0.625 -0.625 -0.625s-0.625 0.27982 -0.625 0.625V7c0 0.14621 0.05126 0.28779 0.14486 0.40012l2.5 2.99998c0.22098 0.2652 0.61508 0.301 0.88026 0.08 0.26518 -0.2209 0.30098 -0.61504 0.08002 -0.88022L7.625 6.77372V4.5Z"/>'],
    "Log": ["0 0 14 14", '<path fill-rule="evenodd" d="M2.5 0h9A1.5 1.5 0 0 1 13 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 12.5v-11A1.5 1.5 0 0 1 2.5 0ZM4 3a.8.8 0 0 0 0 1.6h6A.8.8 0 0 0 10 3Zm0 3.2a.8.8 0 0 0 0 1.6h6a.8.8 0 0 0 0-1.6Zm0 3.2a.8.8 0 0 0 0 1.6h3.5a.8.8 0 0 0 0-1.6Z"/>'],
    "ShieldOn": ["0 -0.018 14 14", '<path fill-rule="evenodd" d="M14 4.809 L14 1.504 L13.957 1.142 L13.834 0.812 L13.711 0.615 L13.561 0.44 L13.386 0.29 L13.189 0.167 L12.86 0.043 L12.499 0 L1.396 0.004 L1.157 0.039 L0.932 0.111 L0.724 0.216 L0.536 0.351 L0.371 0.512 L0.233 0.697 L0.124 0.903 L0.047 1.125 L0 1.486 L0.001 5.032 L0.018 5.517 L0.075 6.116 L0.217 6.938 L0.429 7.737 L0.708 8.509 L1.053 9.25 L1.277 9.658 L1.521 10.054 L1.784 10.437 L2.066 10.807 L2.366 11.163 L2.683 11.503 L3.017 11.828 L3.368 12.137 L3.735 12.429 L4.117 12.702 L4.513 12.958 L4.924 13.194 L5.349 13.41 L5.787 13.605 L6.238 13.779 L6.7 13.929 L6.933 13.964 L7.168 13.954 L7.284 13.933 L7.63 13.825 L8.085 13.657 L8.527 13.468 L8.955 13.258 L9.37 13.027 L10.062 12.578 L10.708 12.073 L11.305 11.515 L11.623 11.175 L11.923 10.82 L12.405 10.165 L12.83 9.47 L13.193 8.739 L13.492 7.977 L13.725 7.186 L13.889 6.37 L13.972 5.655ZM3.428 7.272 L3.262 7.048 L3.191 6.876 L3.15 6.6 L3.168 6.415 L3.262 6.152 L3.366 5.997 L3.497 5.866 L3.736 5.722 L4.007 5.655 L4.193 5.655 L4.464 5.722 L4.628 5.81 L4.772 5.928 L6.174 7.331 L9.303 3.954 L9.443 3.831 L9.603 3.737 L9.779 3.676 L9.964 3.651 L10.241 3.681 L10.416 3.746 L10.646 3.903 L10.769 4.043 L10.863 4.203 L10.941 4.471 L10.938 4.75 L10.891 4.93 L10.757 5.174 L6.897 9.346 L6.754 9.472 L6.588 9.567 L6.313 9.643 L6.123 9.647 L5.935 9.612 L5.676 9.492 L5.528 9.372Z"/>'],
    "ShieldAlert": ["0 -0.018 14 14", '<path fill-rule="evenodd" d="M14 4.809 L14 1.504 L13.957 1.142 L13.834 0.812 L13.711 0.615 L13.561 0.44 L13.386 0.29 L13.189 0.167 L12.86 0.043 L12.499 0 L1.396 0.004 L1.157 0.039 L0.932 0.111 L0.724 0.216 L0.536 0.351 L0.371 0.512 L0.233 0.697 L0.124 0.903 L0.047 1.125 L0 1.486 L0.001 5.032 L0.018 5.517 L0.075 6.116 L0.217 6.938 L0.429 7.737 L0.708 8.509 L1.053 9.25 L1.277 9.658 L1.521 10.054 L1.784 10.437 L2.066 10.807 L2.366 11.163 L2.683 11.503 L3.017 11.828 L3.368 12.137 L3.735 12.429 L4.117 12.702 L4.513 12.958 L4.924 13.194 L5.349 13.41 L5.787 13.605 L6.238 13.779 L6.7 13.929 L6.933 13.964 L7.168 13.954 L7.284 13.933 L7.63 13.825 L8.085 13.657 L8.527 13.468 L8.955 13.258 L9.37 13.027 L10.062 12.578 L10.708 12.073 L11.305 11.515 L11.623 11.175 L11.923 10.82 L12.405 10.165 L12.83 9.47 L13.193 8.739 L13.492 7.977 L13.725 7.186 L13.889 6.37 L13.972 5.655ZM7 3a0.8 0.8 0 0 1 0.8 0.8v3.3a0.8 0.8 0 0 1 -1.6 0V3.8A0.8 0.8 0 0 1 7 3Zm0 5.15a0.95 0.95 0 1 1 0 1.9 0.95 0.95 0 0 1 0 -1.9Z"/>'],
    "Shield": ["0 -0.018 14 14", '<path fill-rule="evenodd" d="M14 4.809 L14 1.504 L13.957 1.142 L13.834 0.812 L13.711 0.615 L13.561 0.44 L13.386 0.29 L13.189 0.167 L12.86 0.043 L12.499 0 L1.396 0.004 L1.157 0.039 L0.932 0.111 L0.724 0.216 L0.536 0.351 L0.371 0.512 L0.233 0.697 L0.124 0.903 L0.047 1.125 L0 1.486 L0.001 5.032 L0.018 5.517 L0.075 6.116 L0.217 6.938 L0.429 7.737 L0.708 8.509 L1.053 9.25 L1.277 9.658 L1.521 10.054 L1.784 10.437 L2.066 10.807 L2.366 11.163 L2.683 11.503 L3.017 11.828 L3.368 12.137 L3.735 12.429 L4.117 12.702 L4.513 12.958 L4.924 13.194 L5.349 13.41 L5.787 13.605 L6.238 13.779 L6.7 13.929 L6.933 13.964 L7.168 13.954 L7.284 13.933 L7.63 13.825 L8.085 13.657 L8.527 13.468 L8.955 13.258 L9.37 13.027 L10.062 12.578 L10.708 12.073 L11.305 11.515 L11.623 11.175 L11.923 10.82 L12.405 10.165 L12.83 9.47 L13.193 8.739 L13.492 7.977 L13.725 7.186 L13.889 6.37 L13.972 5.655Z"/>'],
    "Sort": ["0.042 0 14 14", '<path fill-rule="evenodd" d="M3.75002 0c0.55229 0 1 0.447715 1 1v9h1.5c0.30335 0 0.57683 0.1827 0.69291 0.463 0.11609 0.2802 0.05192 0.6028 -0.16258 0.8173l-2.5 2.5c-0.29289 0.2929 -0.76776 0.2929 -1.06066 0l-2.499998 -2.5c-0.214499 -0.2145 -0.278665 -0.5371 -0.16258 -0.8173 0.116086 -0.2803 0.389563 -0.463 0.692908 -0.463h1.5V1c0 -0.552285 0.44772 -1 1 -1Zm8.16678 0.75c0 -0.414214 -0.3358 -0.75 -0.75 -0.75s-0.75 0.335786 -0.75 0.75c0 0.27614 -0.2239 0.5 -0.50001 0.5h-0.41667c-0.41421 0 -0.75 0.33579 -0.75 0.75s0.33579 0.75 0.75 0.75h0.41667c0.17261 0 0.34021 -0.02188 0.50001 -0.06301V5h-0.91668c-0.41421 0 -0.75 0.33579 -0.75 0.75s0.33579 0.75 0.75 0.75h3.33338c0.4142 0 0.75 -0.33579 0.75 -0.75s-0.3358 -0.75 -0.75 -0.75h-0.9167V0.75Zm-0.8384 9.3438 -0.6563 0c-0.371 0 -0.67185 -0.30085 -0.67185 -0.67191s0.30085 -0.67187 0.67185 -0.67187l0.6562 -0.00001c0.3695 0 0.6692 0.29811 0.6719 0.66689v0.00997c-0.0027 0.36877 -0.3024 0.66693 -0.6718 0.66693Zm-0.0001 -2.84379c1.1105 -0.00001 2.0264 0.83342 2.1562 1.9089 0.0103 0.04958 0.0157 0.10095 0.0157 0.15359v0.10042l0 0.00897 0 0.00896v2.50665c0 1.1391 -0.9234 2.0625 -2.0625 2.0625h-0.875c-0.89918 0 -1.66215 -0.575 -1.94492 -1.3751 -0.13804 -0.3905 0.06666 -0.819 0.45719 -0.957 0.39054 -0.1381 0.81903 0.0666 0.95707 0.4572 0.07757 0.2194 0.28696 0.3749 0.53066 0.3749h0.875c0.3107 0 0.5625 -0.2518 0.5625 -0.5625v-0.4497c-0.2116 0.0688 -0.4374 0.106 -0.6718 0.106l-0.6563 0c-1.19947 0 -2.17185 -0.9724 -2.17185 -2.17192 0 -1.19948 0.97237 -2.17186 2.17185 -2.17186l0.6562 -0.00001Z"/>'],
    "Star": ["1.3 0.55 21.4 21.4", '<path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"/>'],
    "Containers": ["0 0 24 24", '<path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>']
  };
  // The markup for one glyph, sized by the font size of whatever holds it (.cc-glyph in Tokens.css),
  // in the ink of its control.
  function glyph(name) {
    var d = GLYPHS[name];
    return d ? '<svg class="cc-glyph" viewBox="' + d[0] + '" fill="currentColor" aria-hidden="true" focusable="false">' + d[1] + "</svg>" : "";
  }

  // One trash can for every icon-only destructive control, GlimStone's Trash at the 15px these
  // controls were measured with.
  var CC_TRASH_SVG = '<svg viewBox="' + GLYPHS.Trash[0] + '" width="15" height="15" fill="currentColor" aria-hidden="true">' + GLYPHS.Trash[1] + "</svg>";

  // The icon-only delete badge that stands in for a native remove control. A span rather than a
  // button, which Unraid's global CSS would bloat, so it carries the role and keys itself.
  function delIcon(label, run) {
    var b = document.createElement("span");
    b.className = "cc-b-del cc-b-delicon";
    b.innerHTML = CC_TRASH_SVG;
    b.setAttribute("role", "button"); b.tabIndex = 0;
    b.setAttribute("title", label); b.setAttribute("aria-label", label);
    b.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); run(); });
    b.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); run(); } });
    return b;
  }

  // The icon pipeline. Ink-flattening (feColorMatrix to one flat colour) looks sharp on a real
  // glyph but turns a full-colour icon with a coloured background and a mark on top into one blob.
  // Luminance tinting (pixel luminance x target) is safe on anything but never looks as crisp. So
  // the pipeline works out what kind of picture an icon is, and finds a better one when needed:
  //   1. Measure the luminance spread over the opaque pixels on a canvas. A low spread means the
  //      artwork is one tone and flattening loses nothing. It is local, so it runs first.
  //   2. Look for a simple-icons (CC0-1.0) glyph, which is monochrome by construction.
  //   3. Otherwise tint the best colour source: dashboard-icons (Apache-2.0) before the
  //      container's own icon.
  // The engine answers steps 2 and 3 from its cache and fetches only on its own workers (see
  // internal/iconsrc), so the browser never waits on a CDN.
  //
  // cc.iconmode is the global default and cc.iconov holds per-item pins:
  //   auto    the chain above (default)
  //   native    no recolouring, but a curated colour icon still beats a poor shipped one
  //   flat      always flatten, whatever the heuristic says
  //   tint      always tint
  //   original  the item's own icon as it ships, never swapped and never recoloured; offered per
  //             item only
  var ICON_PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var ICON_MODES = ["auto", "native", "flat", "tint", "original"];
  // Luminance spread on a 0-255 scale, measured over the 55 containers of a real box. The values
  // are bimodal: flat glyphs land at 0.0-3.4 (Plex 0.53, Nginx 0.79, CCWB 3.4), anything with
  // internal structure at 17.3 and up (CrowdSec 17.3, Unraid's question.png 19.8, OpenCloud 39.0),
  // and 12 sits in the empty gap. Borderline icons get tinted, because flattening one that needed
  // a tint destroys it: at 32 question.png lost its "?" and became a white disc.
  var ICON_SIMPLE_MAX = 12;
  var ICON_ALPHA_MIN = 20;    // a pixel counts as "content" above this alpha
  var icoRes = {};            // normalised name -> {kind, source, slug}
  var icoWant = {};           // names asked for but not yet answered
  var icoInflight = false, icoTimer = null, icoLast = 0;
  var icoListeners = [];
  var icoSimple = {};         // icon URL -> { s: luminance stddev or -1, t: tile or null }
  var icoMeasuring = {};

  function icoNorm(n) { return String(n == null ? "" : n).trim().toLowerCase(); }
  function icoValidMode(m) { return ICON_MODES.indexOf(m) >= 0 ? m : null; }
  // The global default. Anything unrecognised (or unset) is "auto".
  function iconGlobalMode() { return icoValidMode(g("cc.iconmode", "auto")) || "auto"; }
  // Per-item pins share one cc.* key, keyed "<scope>:<lowercased name>", so the settings sync
  // carries them.
  function iconOverrides() { try { var j = JSON.parse(g("cc.iconov", "null")); return (j && typeof j === "object") ? j : {}; } catch (e) { return {}; } }
  function iconOverride(scope, name) { return icoValidMode(iconOverrides()[scope + ":" + icoNorm(name)]) || ""; }
  function setIconOverride(scope, name, mode) {
    var all = iconOverrides(), k = scope + ":" + icoNorm(name);
    if (icoValidMode(mode)) all[k] = mode; else delete all[k];
    s("cc.iconov", JSON.stringify(all));
  }
  // The mode actually in force for one item: its own pin, else the global default.
  function iconMode(scope, name) { return iconOverride(scope, name) || iconGlobalMode(); }

  // Steps 2 and 3: one batched POST per page, answered from the engine's cache. Names still being
  // looked up come back "pending" and are asked for again later.
  function iconWant(names) {
    var fresh = false;
    for (var i = 0; i < (names || []).length; i++) {
      var k = icoNorm(names[i]);
      if (!k || icoRes[k] || icoWant[k]) continue;
      icoWant[k] = 1; fresh = true;
    }
    // Pending names are asked for at most every 6s, so a page full of them does not hammer the
    // engine while its workers warm the cache.
    var pending = false, kk;
    for (kk in icoRes) { if (icoRes[kk] && icoRes[kk].kind === "pending") { pending = true; break; } }
    if (fresh || (pending && Date.now() - icoLast > 6000)) icoFlush();
  }
  function icoFlush() {
    if (icoInflight) return;
    var names = [], k;
    for (k in icoWant) names.push(k);
    for (k in icoRes) { if (icoRes[k] && icoRes[k].kind === "pending") names.push(k); }
    if (!names.length) return;
    icoInflight = true; icoLast = Date.now();
    var tok = "";
    try {
      if (typeof window.csrf_token === "string" && window.csrf_token) tok = window.csrf_token;
      else { var f = document.querySelector('input[name="csrf_token"]'); if (f && f.value) tok = f.value; else { var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) tok = m[1]; } }
    } catch (e) {}
    fetch(ICON_PROXY + "?path=icons", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: (tok ? "csrf_token=" + encodeURIComponent(tok) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify({ names: names }))
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      icoInflight = false;
      // A 502 from the proxy (engine stopped) or an engine without the icons endpoint: settle
      // every name on "none" so the page keeps its native icons and stops asking until a reload.
      if (!j || typeof j !== "object") { icoSettleNone(); return; }
      var changed = false;
      Object.keys(j).forEach(function (n) {
        var key = icoNorm(n), v = j[n] || {};
        var was = icoRes[key];
        if (!was || was.kind !== v.kind) changed = true;
        icoRes[key] = { kind: v.kind || "none", source: v.source || "", slug: v.slug || "" };
        delete icoWant[key];
      });
      // The engine skips a name it normalises to nothing; left waiting, it would be asked for again
      // at once by icoDrain, without end.
      names.forEach(function (key) {
        if (!icoWant[key]) return;
        delete icoWant[key];
        if (!icoRes[key]) { icoRes[key] = { kind: "none", source: "", slug: "" }; changed = true; }
      });
      if (changed) { icoPolls = 0; icoNotify(); }
      icoDrain();
    }).catch(function () { icoInflight = false; icoSettleNone(); icoDrain(); });
  }
  // icoFlush skips names asked for while a batch is in flight, and the Plugins tab asks row by
  // row, so drain the queue after each batch and keep asking while anything is pending.
  function icoDrain() {
    if (Object.keys(icoWant).length) { setTimeout(icoFlush, 0); return; }
    icoPoll();
  }
  // The Plugins and VM tabs do not repaint on their own, so the pipeline polls for pending names
  // itself. It stops once nothing is pending or after icoPollMax tries, so a name the engine can
  // never resolve does not poll forever.
  var icoPollT = null, icoPolls = 0, icoPollMax = 10;
  function icoPoll() {
    if (icoPollT || icoPolls >= icoPollMax) return;
    var pending = false;
    for (var k in icoRes) { if (icoRes[k] && icoRes[k].kind === "pending") { pending = true; break; } }
    if (!pending) return;
    icoPollT = setTimeout(function () { icoPollT = null; icoPolls++; icoFlush(); }, 4000);
  }
  // On failure every name still waited on becomes "none", which means the native icon.
  function icoSettleNone() {
    var changed = false;
    Object.keys(icoWant).forEach(function (key) { if (!icoRes[key]) { icoRes[key] = { kind: "none", source: "", slug: "" }; changed = true; } delete icoWant[key]; });
    if (changed) icoNotify();
  }
  function icoNotify() {
    clearTimeout(icoTimer);
    icoTimer = setTimeout(function () { icoListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }, 30);
  }
  // An area script registers one repaint callback. It fires only when an answer changed, so it
  // cannot become a render loop.
  function onIconsResolved(fn) { if (typeof fn === "function" && icoListeners.indexOf(fn) < 0) icoListeners.push(fn); }
  function iconResult(name) { return icoRes[icoNorm(name)] || null; }
  // The engine serves its cached artwork as image/svg+xml through the same-origin proxy, so an
  // <img> can point at it and the canvas heuristic can read it back without tainting.
  function iconSvgUrl(name) { return ICON_PROXY + "?path=iconsvg&name=" + encodeURIComponent(icoNorm(name)); }

  // Step 1: draw the icon small and take the standard deviation of luminance over its opaque
  // pixels, cached per URL. Until a measurement lands the caller uses the safe tint, and the
  // repaint callback upgrades it afterwards. The same pass tells whether the picture is a tile
  // (see iconTileOf), so the two never need a second load.
  function iconSpread(url) {
    var m = icoMeasure(url);
    return m && m.s >= 0 ? m.s : null;
  }
  function iconTile(url) {
    var m = icoMeasure(url);
    return m && m.t ? m.t : null;
  }
  function icoMeasure(url) {
    if (!url) return null;
    if (icoSimple[url] != null) return icoSimple[url];
    try { var c = sessionStorage.getItem("ccico2:" + url); if (c != null) { icoSimple[url] = JSON.parse(c); return icoSimple[url]; } } catch (e) {}
    if (icoMeasuring[url]) return null;
    icoMeasuring[url] = 1;
    var probe = new Image();
    var done = function (v) {
      icoSimple[url] = v; delete icoMeasuring[url];
      try { sessionStorage.setItem("ccico2:" + url, JSON.stringify(v)); } catch (e2) {}
      icoNotify();
    };
    probe.onerror = function () { done({ s: -1 }); };
    probe.onload = function () {
      try {
        var W = 48, cv = document.createElement("canvas"); cv.width = cv.height = W;
        var cx = cv.getContext("2d", { willReadFrequently: true });
        var nw = probe.naturalWidth || W, nh = probe.naturalHeight || W;
        var sc = Math.min(W / nw, W / nh), dw = nw * sc, dh = nh * sc;
        cx.drawImage(probe, (W - dw) / 2, (W - dh) / 2, dw, dh);
        done(iconMeasurePixels(cx.getImageData(0, 0, W, W).data, W));
      } catch (e3) { done({ s: -1 }); }     // a tainted canvas (cross-origin icon) lands here
    };
    probe.src = url;
    return null;
  }
  // Pure over an RGBA buffer, so a test can feed it pictures. s is the luminance spread (-1 when
  // there is too little content to judge), t the tile description or null.
  function iconMeasurePixels(d, W) {
    var n = 0, sum = 0, sq = 0, lum = [], span = 0;
    for (var y = 0; y < W; y++) {
      var first = -1, last = -1;
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if (d[i + 3] <= ICON_ALPHA_MIN) continue;
        var L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        n++; sum += L; sq += L * L; lum.push(L);
        if (first < 0) first = x;
        last = x;
      }
      if (first >= 0) span += last - first + 1;
    }
    if (n < 16) return { s: -1 };
    var mean = sum / n, varc = Math.max(0, sq / n - mean * mean);
    return { s: Math.round(Math.sqrt(varc) * 100) / 100, t: iconTileOf(lum, n / span) };
  }
  // A tile is artwork drawn onto an opaque plate, such as a rounded square, a disc or a chip seen
  // at an angle, rather than cut out of transparency. Flattening keeps only the outline, so a
  // tile flattens to a blank shape. What carries the picture is the mark's contrast against the
  // plate: bg and mk are the plate's and the mark's luminance (0-1), mark says which is lighter.
  // fill is the share of each row's run from its first to its last opaque pixel that is opaque: a
  // plate of any outline fills its rows, a glyph has gaps between its strokes.
  var ICON_TILE_FILL = 0.9;
  var ICON_TILE_STEP = 48;     // luminance a pixel must differ from the plate by to count as mark
  function iconTileOf(lum, fill) {
    if (fill < ICON_TILE_FILL) return null;
    var hist = [], b, best = 0;
    for (b = 0; b < 16; b++) hist[b] = 0;
    lum.forEach(function (L) { hist[Math.min(15, Math.floor(L / 16))]++; });
    for (b = 1; b < 16; b++) if (hist[b] > hist[best]) best = b;
    var plate = 0, pn = 0, light = 0, dark = 0;
    lum.forEach(function (L) {
      var k = Math.min(15, Math.floor(L / 16));
      if (Math.abs(k - best) <= 1) { plate += L; pn++; }
    });
    plate /= pn;
    var lsum = 0, dsum = 0;
    lum.forEach(function (L) { if (L > plate + ICON_TILE_STEP) { light++; lsum += L; } else if (L < plate - ICON_TILE_STEP) { dark++; dsum += L; } });
    if (Math.max(light, dark) < lum.length * 0.03) return null;   // a plain plate: nothing to keep
    var r2 = function (v) { return Math.round(v / 255 * 100) / 100; };
    return light >= dark ? { bg: r2(plate), mk: r2(lsum / light), mark: "light" } : { bg: r2(plate), mk: r2(dsum / dark), mark: "dark" };
  }

  // Pure, so a DOM test can pin every branch without a browser.
  //   treat: "flat" | "tint" | "native"      what to do to the pixels
  //   src:   "native" | "glyph" | "color"    which picture to do it to
  //   tile:  the tile iconTile() found, for "knock"
  // A glyph is only chosen when it will be inked, since an un-inked monochrome glyph on a dark
  // card is a black square. A tile is never flattened whole: "knock" inks its mark and drops the
  // plate, the flat look without the blank square.
  function iconPlan(mode, kind, spread, tile) {
    if (mode === "original") return { treat: "native", src: "native", why: "mode:original" };
    if (mode === "native") return { treat: "native", src: kind === "color" ? "color" : "native", why: "mode:native" };
    if (mode === "tint") return { treat: "tint", src: kind === "color" ? "color" : "native", why: "mode:tint" };
    if (mode === "flat") {
      if (kind === "glyph") return { treat: "flat", src: "glyph", why: "mode:flat" };
      if (tile) return { treat: "knock", src: "native", why: "mode:flat tile", tile: tile };
      if (spread == null) return { treat: "tint", src: "native", why: "mode:flat unmeasured" };
      return { treat: "flat", src: "native", why: "mode:flat" };
    }
    if (spread != null && spread < ICON_SIMPLE_MAX) {
      if (tile) return { treat: "knock", src: "native", why: "simple tile:" + spread, tile: tile };
      return { treat: "flat", src: "native", why: "simple:" + spread };
    }
    if (kind === "glyph") return { treat: "flat", src: "glyph", why: "glyph" };
    if (kind === "color") return { treat: "tint", src: "color", why: "color" };
    return { treat: "tint", src: "native", why: spread == null ? "unmeasured" : "complex:" + spread };
  }

  // The filter for "knock": the mark's contrast against the plate becomes alpha, ramping from a
  // fifth of the way to the mark up to two thirds, and the picture's own alpha masks the result.
  // Both levels are rounded to sixteenths to keep the filters on a page few. Without an ink it
  // answers "", like the flat filter, and the icon stays native. A strength below 100 lays the
  // knocked mark over the faded original, in tenths for the same reason.
  function iconKnockFilter(ink, tile, strength) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(ink || "").replace(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i, "#$1$1$2$2$3$3"));
    if (!m || !tile) return "";
    var q = function (v) { return Math.round(Math.max(0, Math.min(1, v)) * 16); };
    var bq = q(tile.bg), mq = q(tile.mk), sq = Math.round(Math.max(10, Math.min(100, strength || 100)) / 10);
    var id = "cc-knock-" + bq + "-" + mq + "-" + (m[1] + m[2] + m[3]).toLowerCase() + (sq < 10 ? "-s" + sq : "");
    var host = document.getElementById("cc-knock-svg");
    if (!host) {
      host = document.createElement("div"); host.id = "cc-knock-svg"; host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      document.body.appendChild(host);
      icoKnock = {};
    }
    if (!icoKnock[id]) {
      // alpha = c * luminance + d; c turns negative for a mark darker than its plate
      var bg = bq / 16, mk = mq / 16, from = bg + (mk - bg) / 5, to = bg + (mk - bg) * 2 / 3;
      var c = 1 / (to - from), d = -c * from;
      var ch = function (h) { return (parseInt(h, 16) / 255).toFixed(4); };
      var f = function (x) { return x.toFixed(4); };
      var vals = "0 0 0 0 " + ch(m[1]) + " 0 0 0 0 " + ch(m[2]) + " 0 0 0 0 " + ch(m[3]) + " " + f(c * 0.2126) + " " + f(c * 0.7152) + " " + f(c * 0.0722) + " 0 " + f(d);
      var blend = sq < 10 ? '<feComponentTransfer in="kk" result="top"><feFuncA type="linear" slope="' + sq / 10 + '"/></feComponentTransfer><feComponentTransfer in="SourceGraphic" result="under"><feFuncA type="linear" slope="' + (10 - sq) / 10 + '"/></feComponentTransfer><feMerge><feMergeNode in="under"/><feMergeNode in="top"/></feMerge>' : "";
      icoKnock[id] = '<filter id="' + id + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '" result="k"/><feComposite in="k" in2="SourceGraphic" operator="in"' + (blend ? ' result="kk"' : "") + "/>" + blend + "</filter>";
      host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + Object.keys(icoKnock).map(function (k) { return icoKnock[k]; }).join("") + "</svg>";
    }
    return "url(#" + id + ")";
  }
  var icoKnock = {};

  // Unraid's stand-in for a container without an icon is a grey disc with a question mark, which
  // reads as an error and flattens to a blank disc. CC shows GlimStone's container glyph instead,
  // in a neutral grey that the tint and the flat filter recolour like any other one-tone icon.
  var ICON_PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + GLYPHS.Containers[0] + '" width="96" height="96" fill="#8a8a8a">' + GLYPHS.Containers[1] + "</svg>");
  function iconPlaceholder(src) {
    return /\/dynamix\.docker\.manager\/images\/question\.png(\?|$)/.test(String(src || "")) ? ICON_PLACEHOLDER : "";
  }

  // The room every window, menu and bubble keeps from the viewport's edges, 16px and 24px on a wide
  // screen. Tokens.css carries the same numbers as --cc-edge for the size caps.
  function edge() {
    return window.innerWidth >= 1440 ? 24 : 16;   // the viewport width, as in the min-width query beside --cc-edge
  }
  // left and top for a box of w by h under the anchor rect r, or above it when the page ends first,
  // kept edge() inside the viewport. alignEnd lines its right edge up with the anchor's.
  function placeAt(r, w, h, gap, alignEnd) {
    var m = edge(), vw = document.documentElement.clientWidth || window.innerWidth, vh = document.documentElement.clientHeight || window.innerHeight;
    var top = r.bottom + gap + h > vh - m && r.top - gap - h >= m ? r.top - gap - h : r.bottom + gap;
    var left = alignEnd ? r.right - w : r.left;
    return { left: Math.max(m, Math.min(left, vw - w - m)), top: Math.max(m, Math.min(top, vh - h - m)) };
  }

  // CannonadeCommand's colour picker, drawn in the page, so no colour field opens the system's
  // own picker window. Its presets are GlimStone's accent presets, the same eight in the same order
  // in every app of the family, so Blue here is the Blue of the next app. Only the offer changes: a
  // saved cc.accent is never rewritten, whichever preset it came from.
  var PRESETS = ["#FCC419", "#1D99F3", "#6FDC8C", "#FF8389", "#BE95FF", "#FF832B", "#3DDBD9", "#FF7EB6"];
  function hexToHsv(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return null;
    var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    if (h < 0) h += 360;
    return { h: h, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToHex(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    var f = function (u) { return ("0" + Math.round((u + m) * 255).toString(16)).slice(-2); };
    return "#" + f(r) + f(g) + f(b);
  }
  function normHex(s) { var v = String(s || "").trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = "#" + v; return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ""; }
  function div(cls) { var n = document.createElement("div"); n.className = cls; return n; }
  // A saturation square and a hue bar; _set(hex) syncs it and _get() reads it back.
  function inlinePicker(hex, onChange) {
    var box = div("cc-ip"), sv = div("cc-ip-sv"), dot = document.createElement("span"), hue = div("cc-ip-hue"), hdot = document.createElement("span");
    dot.className = "cc-ip-dot"; hdot.className = "cc-ip-hdot";
    sv.appendChild(dot); hue.appendChild(hdot); box.appendChild(sv); box.appendChild(hue);
    var st = hexToHsv(hex) || { h: 220, s: 0.8, v: 0.9 };
    function paint() {
      sv.style.background = "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(" + Math.round(st.h) + ",100%,50%))";
      dot.style.left = (st.s * 100) + "%"; dot.style.top = ((1 - st.v) * 100) + "%";
      hdot.style.left = (st.h / 360 * 100) + "%";
    }
    function emit() { onChange(hsvToHex(st.h, st.s, st.v)); }
    function drag(target, apply2) {
      function mv(e) {
        var r = target.getBoundingClientRect();
        var cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
        apply2(Math.min(1, Math.max(0, (cx - r.left) / r.width)), Math.min(1, Math.max(0, (cy - r.top) / r.height)));
        paint(); emit(); e.preventDefault();
      }
      function up() { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); document.removeEventListener("touchmove", mv); document.removeEventListener("touchend", up); }
      function down(e) { mv(e); document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up); document.addEventListener("touchmove", mv); document.addEventListener("touchend", up); }
      target.addEventListener("mousedown", down); target.addEventListener("touchstart", down);
    }
    drag(sv, function (x, y) { st.s = x; st.v = 1 - y; });
    drag(hue, function (x) { st.h = Math.min(359.9, x * 360); });
    box._set = function (h2) { var p = hexToHsv(h2); if (p) { st = p; paint(); } };
    box._get = function () { return hsvToHex(st.h, st.s, st.v); };
    paint(); return box;
  }
  function swTick(c) { return "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3 8.5l3.2 3.2L13 5' fill='none' stroke='" + encodeURIComponent(c) + "' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")"; }
  // Every colour row draws the same swatch, so the picked one is marked the same way everywhere.
  // The box never changes size, since a scaled swatch reads as a different size from its
  // neighbours; the mark is a tick on the fill, and that tick needs an ink contrasting with this
  // swatch's own colour, so the class and the ink are always set together.
  function swMark(sw, on, colour) {
    if (!sw) return;
    sw.classList.toggle("cc-set-sw-on", !!on);
    if (on) sw.style.setProperty("--cc-sw-tick", swTick(idealText(colour || sw.dataset.c || "")));
    else sw.style.removeProperty("--cc-sw-tick");
  }
  // Marks the swatch in `row` whose colour matches and unmarks the rest; dataset.c is the one
  // attribute every preset swatch carries.
  function swMarkRow(row, colour) {
    if (!row) return;
    var want = String(colour || "").toLowerCase();
    Array.prototype.slice.call(row.querySelectorAll(".cc-set-sw")).forEach(function (sw) {
      var c = (sw.dataset.c || "").toLowerCase();
      swMark(sw, !!c && c === want, sw.dataset.c);
    });
  }
  // The picker, and under it the GlimStone presets in one row with the hex field as its last
  // cell, the row as wide as the picker. onPick gets "#rrggbb", or "" when opts.clearable lets the
  // hex field be emptied. _set(hex, shown) repaints it without calling onPick, the picker on shown
  // while hex is empty.
  function colorPicker(hex, onPick, opts) {
    opts = opts || {};
    var valid = function (v) { return /^#[0-9a-f]{6}$/i.test(v || ""); };
    var box = div("cc-set-pickrow");
    var hx = document.createElement("input"); hx.className = "cc-set-hexin"; hx.type = "text"; hx.value = hex || ""; hx.maxLength = 7; hx.spellcheck = false;
    hx.placeholder = opts.placeholder || "#FCC419"; hx.setAttribute("aria-label", german() ? "Farbe als Hex-Wert" : "Colour as a hex value");
    var row = div("cc-set-swatches cc-fill" + (opts.rowClass ? " " + opts.rowClass : ""));
    var pk = inlinePicker(valid(hex) ? hex : (opts.fallback || "#FCC419"), function (v) { hx.value = v; swMarkRow(row, v); onPick(v); });
    function pick(c) { pk._set(c); hx.value = c; swMarkRow(row, c); onPick(c); }
    PRESETS.forEach(function (c) {
      var sw = pressable(document.createElement("span")); sw.className = "cc-set-sw";
      sw.addEventListener("click", function () { pick(c); });
      sw.setAttribute("data-tip", c); sw.setAttribute("aria-label", c); sw.style.background = c; sw.dataset.c = c;
      row.appendChild(sw);
    });
    row.appendChild(hx);
    hx.addEventListener("input", function () {
      var v = normHex(hx.value);
      if (v) { pk._set(v); swMarkRow(row, v); onPick(v); }
      else if (!hx.value && opts.clearable) { swMarkRow(row, ""); onPick(""); }
    });
    box.appendChild(pk); box.appendChild(row);
    swMarkRow(row, hex);
    box._set = function (v, shown) { var p = valid(v) ? v : shown; if (valid(p)) pk._set(p); hx.value = v || ""; swMarkRow(row, v); };
    box._get = pk._get;
    box._row = row;
    box._hex = hx;
    return box;
  }
  // A colour field in someone else's form, a hex text field or an <input type=color>, gets a
  // swatch that opens the picker in a panel under it. The field keeps the value and hears input
  // and change on every pick, so the form still submits it; opts.hash writes the leading #, and an
  // <input type=color> always has one.
  var cpOpen = null;
  function colorSwatch(inp, opts) {
    opts = opts || {};
    var native = inp.type === "color", hash = native || !!opts.hash;
    var sw = native ? inp : pressable(document.createElement("span"));
    sw.classList.add("cc-colpick");
    if (opts.label) { sw.setAttribute("aria-label", opts.label); sw.setAttribute("data-tip", opts.label); }
    sw.setAttribute("aria-haspopup", "dialog"); sw.setAttribute("aria-expanded", "false");
    function current() { var v = String(inp.value || "").trim().replace(/^#/, ""); if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/(.)/g, "$1$1"); return normHex(v); }
    function paint() { var c = current(); if (c) sw.style.setProperty("--cc-cp", c); else sw.style.removeProperty("--cc-cp"); }
    function write(c) {
      c = c.toLowerCase();
      inp.value = hash ? c : c.slice(1);
      paint();
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function open(e) {
      e.preventDefault(); e.stopPropagation();
      var again = cpOpen && cpOpen.anchor === sw;
      if (cpOpen) cpOpen.close(false);
      if (again) return;
      var pop = div("cc-cpop"); pop.setAttribute("role", "dialog"); pop.setAttribute("data-cc-own-keys", "1");
      if (opts.label) pop.setAttribute("aria-label", opts.label);
      var field = colorPicker(current(), write, { fallback: opts.fallback });
      pop.appendChild(field);
      // A jQuery UI dialog hands the focus back to itself when it moves to a node outside it.
      (sw.closest(".ui-dialog") || document.body).appendChild(pop);
      var at = placeAt(sw.getBoundingClientRect(), pop.offsetWidth, pop.offsetHeight, 6);
      pop.style.left = at.left + "px"; pop.style.top = at.top + "px";
      function outside(ev) { if (!pop.contains(ev.target) && ev.target !== sw) close(false); }
      function key(ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(true); } }
      function scrolled(ev) { if (!pop.contains(ev.target)) close(false); }
      function resized() { close(false); }
      function close(refocus) {
        if (cpOpen !== entry) return;
        cpOpen = null;
        document.removeEventListener("pointerdown", outside, true);
        window.removeEventListener("scroll", scrolled, true);
        window.removeEventListener("resize", resized);
        if (pop.parentNode) pop.parentNode.removeChild(pop);
        sw.setAttribute("aria-expanded", "false");
        if (refocus) try { sw.focus(); } catch (e2) {}
      }
      var entry = { anchor: sw, close: close };
      cpOpen = entry;
      pop.addEventListener("keydown", key);
      document.addEventListener("pointerdown", outside, true);
      window.addEventListener("scroll", scrolled, true);
      window.addEventListener("resize", resized);
      sw.setAttribute("aria-expanded", "true");
      try { field._hex.focus(); } catch (e3) {}
    }
    sw.addEventListener("click", open);
    // An <input type=color> opens the system picker on Enter and Space as well as on a click.
    if (native) sw.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") open(e); });
    else inp.parentNode.insertBefore(sw, inp);
    inp.addEventListener("input", paint); inp.addEventListener("change", paint);
    paint();
    return sw;
  }

  // The per-item mode picker as an anchored popover, for tabs such as Plugins that have no
  // per-item settings window. Docker offers the same options in its Startplan window and the VM
  // tab in its limits editor.
  function iconPopover(anchor, scope, name, onChange) {
    var de = german();
    var old = document.getElementById("cc-icm-pop"); if (old) old.remove();
    var ov = document.createElement("div"); ov.id = "cc-icm-pop";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999";
    var card = document.createElement("div");
    card.style.cssText = "position:absolute;background:var(--cc-bg,#161616);color:var(--cc-txt,#e6e6e6);border-radius:var(--cc-radius-card);padding:12px 14px;width:250px;max-width:92vw;box-shadow:0 2px 5px rgba(0,0,0,.38),0 14px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.05);font-size:var(--cc-text-subline);line-height:1.5;font-family:inherit";
    var h = document.createElement("div");
    h.textContent = (de ? "Icon-Färbung" : "Icon colouring") + ": " + name;
    h.style.cssText = "font-size:var(--cc-text-subline);font-weight:700;margin:0 0 8px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    card.appendChild(h);
    var opts = de
      ? [["", "folgt globaler Einstellung"], ["auto", "Automatisch"], ["native", "Natives Icon"], ["flat", "Nachzeichnen"], ["tint", "Tönen"], ["original", "Original-Logo"]]
      : [["", "follows the global setting"], ["auto", "Automatic"], ["native", "Native icon"], ["flat", "Redraw"], ["tint", "Tone"], ["original", "Original logo"]];
    var sel = document.createElement("select");
    sel.style.cssText = "width:100%;background:var(--cc-surface-3,#2e2e2e);color:var(--cc-txt,#e6e6e6);border:none;border-radius:var(--cc-radius-control);padding:6px 10px;font-size:var(--cc-text-subline);outline:none";
    var cur = iconOverride(scope, name);
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; sel.appendChild(op); });
    sel.addEventListener("change", function () { setIconOverride(scope, name, sel.value); if (typeof onChange === "function") { try { onChange(); } catch (e2) {} } });
    card.appendChild(sel);
    ov.appendChild(card); document.body.appendChild(ov);
    try {
      var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
      var cw = card.offsetWidth || 250, ch = card.offsetHeight || 90;
      if (r && (r.width || r.height)) {
        var at = placeAt(r, cw, ch, 6);
        card.style.left = at.left + "px"; card.style.top = at.top + "px";
      } else { card.style.left = "50%"; card.style.top = "20vh"; card.style.transform = "translateX(-50%)"; }
    } catch (e3) { card.style.left = "50%"; card.style.top = "20vh"; }
    ov.addEventListener("click", function (ev) { if (ev.target === ov) ov.remove(); });
    return ov;
  }

  // The one toast every area uses (GlimStone, "Toasts"). Each lasts four seconds, a new one stacks
  // under the last instead of replacing it, and hover or focus pauses the countdown and keeps what
  // is left of it, so a toast under a resting pointer still expires once the pointer leaves. A
  // click dismisses it. kind "error" or "ok" colours the text. The returned handle can rewrite the
  // toast, which turns a progress note into its result without stacking a second toast.
  var TOAST_MS = 4000;
  function toast(msg, kind) {
    if (!document.body || !msg) return null;
    var stack = document.getElementById("cc-toasts");
    if (!stack) {
      stack = document.createElement("div"); stack.id = "cc-toasts";
      stack.setAttribute("role", "status"); stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    var el = document.createElement("div");
    var left = TOAST_MS, started = 0, timer = 0, hover = false, focus = false, closed = false;
    function paint(m, k) { el.className = "cc-toast" + (k === "error" ? " cc-toast-err" : k === "ok" ? " cc-toast-ok" : ""); el.textContent = m; }
    function run() { if (closed || timer || hover || focus) return; started = Date.now(); timer = setTimeout(close, left); }
    function pause() { if (!timer) return; clearTimeout(timer); timer = 0; left = Math.max(0, left - (Date.now() - started)); }
    function close() {
      if (closed) return;
      closed = true; clearTimeout(timer); timer = 0;
      el.classList.add("cc-toast-out");
      // The fade-out reads its length from the motion level, none at "off".
      var d = parseFloat(getComputedStyle(el).animationDuration) || 0;
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, d * 1000);
    }
    paint(msg, kind);
    el.tabIndex = 0;
    el.addEventListener("mouseenter", function () { hover = true; pause(); });
    el.addEventListener("mouseleave", function () { hover = false; run(); });
    el.addEventListener("focus", function () { focus = true; pause(); });
    el.addEventListener("blur", function () { focus = false; run(); });
    el.addEventListener("click", close);
    stack.appendChild(el);
    run();
    return {
      update: function (m, k) { if (closed) return false; paint(m, k); clearTimeout(timer); timer = 0; left = TOAST_MS; run(); return true; },
      close: close,
      isOpen: function () { return !closed; }
    };
  }

  // Makes a bar's fill slosh at its end (Tokens.css, .cc-slosh-edge), or takes the slosh off with
  // on === false. The phase is the time since the page loaded, so a bar that is drawn again
  // swings on from where the one before it was. A fill that already sloshes is left untouched,
  // which keeps a MutationObserver that calls this from waking itself. An empty bar holds no
  // liquid, and on a bar thinner than SLOSH_MIN the surge reads as a twitch, so neither sloshes.
  // A fill that is not laid out yet measures 0 and keeps what the caller asked for. A caller that
  // stamps many bars reads their heights first and passes each in, since a read after a stamp lays
  // the page out again.
  var SLOSH_MIN = 12;
  function slosh(fill, on, high) {
    if (!fill || !fill.classList) return fill;
    if (high == null) high = fill.getBoundingClientRect().height;
    if (!(parseFloat(fill.style.width) > 0) || (high > 0 && high < SLOSH_MIN)) on = false;
    var sloshing = fill.classList.contains("cc-slosh-edge");
    if (on === false) {
      if (!sloshing) return fill;
      fill.classList.remove("cc-slosh-edge"); fill.style.removeProperty("--cc-slosh-phase");
      return fill;
    }
    if (sloshing) return fill;
    fill.classList.add("cc-slosh-edge");
    fill.style.setProperty("--cc-slosh-phase", (-performance.now() / 1000).toFixed(3) + "s");
    return fill;
  }

  // A control that could not do what was asked shakes once (GlimStone, "Failure feedback"). The
  // class comes off and goes back on across a forced layout, which restarts the animation, so a
  // second refusal in a row shakes again. The timeout clears it where no animationend arrives.
  function shake(el) {
    if (!el || !el.classList) return;
    el.classList.remove("cc-shake");
    void el.offsetWidth;
    el.classList.add("cc-shake");
    var done = function (e) {
      if (e && e.animationName && e.animationName.indexOf("cc-shake") !== 0) return;   // a child's animation bubbling up
      el.classList.remove("cc-shake"); el.removeEventListener("animationend", done);
    };
    el.addEventListener("animationend", done);
    clearTimeout(el.ccShakeT); el.ccShakeT = setTimeout(done, 600);
  }
  // Every failure reports through both channels at once: the message in a toast and a shake on the
  // control that was used, when there is one.
  function fail(el, msg) { shake(el); return toast(msg, "error"); }
  // A control that is off or locked shakes the same way when it is pressed anyway, with no toast:
  // its (i) already says why. Where nothing may move, cc-deny swaps the opacity pulse for the
  // accent halo a focus wears.
  function deny(el) {
    if (!el || !el.classList) return;
    el.classList.add("cc-deny");
    shake(el);
    clearTimeout(el.ccDenyT); el.ccDenyT = setTimeout(function () { el.classList.remove("cc-deny"); }, 600);
  }

  // A span that acts as a button: reachable with Tab, pressed with Enter or Space. CC draws its
  // buttons as spans because Unraid's global button rules would restyle a real one.
  function pressable(el) {
    if (!el || el.ccPressable) return el;
    el.ccPressable = true;
    el.setAttribute("role", "button");
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); el.click(); } });
    return el;
  }

  // Every CannonadeCommand window is modal (GlimStone rule 15): the page behind it is darkened and
  // blurred by a scrim, focus moves into the window and Tab cycles inside it, Escape and a click on
  // the scrim dismiss it, and focus goes back to the control that opened it. Windows stack, so a
  // question asked from inside a window answers Escape before the window does.
  var winStack = [], winSeq = 0;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // The control a window or menu hands the focus back to may have been drawn again while it was
  // open, as the card view's gear is on every stats tick. One that carries data-cc-focus-key is
  // found again by that key.
  function refind(node) {
    if (!node || document.contains(node)) return node;
    var key = node.getAttribute && node.getAttribute("data-cc-focus-key");
    return (key && document.querySelector('[data-cc-focus-key="' + key + '"]')) || null;
  }
  function focusables(win) {
    return Array.prototype.filter.call(win.querySelectorAll(FOCUSABLE), function (n) { return n.getClientRects().length > 0; });
  }
  function onWinKey(e) {
    var top = winStack[winStack.length - 1];
    if (!top) return;
    // A panel the window opened, such as the time picker, answers Escape and Tab itself.
    if (e.target && e.target.closest && e.target.closest("[data-cc-own-keys]")) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); top.dismiss(); return; }
    if (e.key !== "Tab") return;
    var f = focusables(top.win), a = document.activeElement;
    if (!f.length) { e.preventDefault(); top.win.focus(); return; }
    var first = f[0], last = f[f.length - 1];
    if (!top.win.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
  function german() {
    try { return /de/i.test(document.documentElement.lang || "") || (localStorage.getItem("locale") || "").indexOf("de") === 0; } catch (e) { return false; }
  }
  // The way out of every window, a square badge in its top right corner, so the button row at the
  // bottom holds only the actions.
  function closeBadge(run) {
    var b = pressable(document.createElement("span"));
    b.className = "cc-win-x";
    b.innerHTML = glyph("Close");
    var label = german() ? "Schließen" : "Close";
    b.setAttribute("aria-label", label); b.setAttribute("data-tip", label);
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); run(); });
    return b;
  }
  // win has to be in the document already. opts.onDismiss runs on Escape, on a scrim click and on
  // the close badge and is expected to end in close(); without it those close the window outright.
  function modal(win, opts) {
    opts = opts || {};
    var opener = opts.opener || document.activeElement, closed = false;
    var scrim = document.createElement("div"); scrim.className = "cc-scrim";
    var z = parseInt(getComputedStyle(win).zIndex, 10);
    if (z > 0) scrim.style.zIndex = String(z - 1);
    win.parentNode.insertBefore(scrim, win);
    win.setAttribute("role", "dialog"); win.setAttribute("aria-modal", "true");
    if (!win.hasAttribute("tabindex")) win.setAttribute("tabindex", "-1");
    var title = win.querySelector(".cc-win-title");
    if (title) { if (!title.id) title.id = "cc-win-t" + (++winSeq); win.setAttribute("aria-labelledby", title.id); }
    function close() {
      if (closed) return;
      closed = true;
      var i = winStack.indexOf(entry); if (i >= 0) winStack.splice(i, 1);
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      if (win.parentNode) win.parentNode.removeChild(win);
      if (!winStack.length) document.removeEventListener("keydown", onWinKey, true);
      try { var back = refind(opener); if (back && back.focus) back.focus(); } catch (e) {}
    }
    var entry = { win: win, dismiss: function () { if (opts.onDismiss) opts.onDismiss(); else close(); } };
    scrim.addEventListener("click", function (e) { e.stopPropagation(); entry.dismiss(); });
    win.appendChild(closeBadge(function () { entry.dismiss(); }));
    if (win.classList.contains("cc-win")) paintWin(win);
    if (!winStack.length) document.addEventListener("keydown", onWinKey, true);
    winStack.push(entry);
    // The first field or switch in the content, else the first button in the bottom row; never
    // the (i) beside the title, whose bubble would open the moment the window does, and never the
    // close badge.
    var into = opts.focus;
    if (!into) {
      var f = focusables(win).filter(function (n) { return !n.classList.contains("cc-info") && !n.classList.contains("cc-win-x"); });
      into = f.filter(function (n) { return n.closest(".cc-win-card, .cc-pop-mid"); })[0] || f[0] || win;
    }
    try { into.focus(); } catch (e) {}
    return { close: close };
  }

  // The title badge first, then each button and the close badge, one palette slot after another in
  // rainbow, a delete keeping off the red slot as on the rows. Under the reactive mode the main
  // button rests grey; the title, a heading, keeps its colour.
  function paintWin(win) {
    var rb = g("cc.theming", "1") !== "0" && g("cc.rainbow", "0") === "1";
    win.classList.toggle("cc-win-reactive", g("cc.theming", "1") !== "0" && g("cc.rbmode", "all") === "active");
    var p = surfacePalette(palette(), null), off = g("cc.rainbowrot", "1") === "0" ? 0 : rbSeed(p.length);
    Array.prototype.forEach.call(win.querySelectorAll(".cc-win-title, .cc-win-btn, .cc-win-x"), function (el, i) {
      if (!rb) { el.style.removeProperty("--cc-rb-c"); el.style.removeProperty("--cc-rb-ct"); return; }
      var c = el.classList.contains("cc-win-del") ? deleteSlot(p, i + off) : p[(i + off) % p.length];
      el.style.setProperty("--cc-rb-c", c); el.style.setProperty("--cc-rb-ct", idealText(c));
    });
  }

  // A question in its own window, in place of window.confirm and window.prompt. o.input asks for a
  // name, which Enter takes and an empty one refuses; o.danger marks a deleting answer, which looks
  // like Cancel rather than red and leaves the focus on Cancel, the safe choice. o.onOk gets the
  // trimmed name.
  function ask(o) {
    var win = document.createElement("div"); win.className = "cc-win cc-dlg";
    var title = document.createElement("div"); title.className = "cc-win-title"; title.textContent = o.title; win.appendChild(title);
    var card = document.createElement("div"); card.className = "cc-win-card";
    if (o.text) { var p = document.createElement("p"); p.className = "cc-win-text"; p.textContent = o.text; card.appendChild(p); }
    var input = null;
    if (o.input) {
      input = document.createElement("input"); input.type = "text"; input.className = "cc-win-in";
      input.value = o.input.value || ""; input.setAttribute("aria-label", o.input.label || o.title);
      if (o.input.placeholder) input.placeholder = o.input.placeholder;
      input.setAttribute("autocomplete", "off");
      card.appendChild(input);
    }
    if (card.childNodes.length) win.appendChild(card);
    var act = document.createElement("div"); act.className = "cc-win-act";
    var no = pressable(document.createElement("span")); no.className = "cc-win-btn"; no.textContent = o.cancel;
    var yes = pressable(document.createElement("span")); yes.className = "cc-win-btn " + (o.danger ? "cc-win-del" : "cc-win-go"); yes.textContent = o.ok;
    act.appendChild(no); act.appendChild(yes); win.appendChild(act);
    document.body.appendChild(win);
    paintWin(win);
    var done = false;
    function finish(ok) {
      if (done) return;
      var val = input ? input.value.trim() : "";
      if (ok && input && !val) { shake(input); input.focus(); return; }
      done = true; h.close();
      if (ok && o.onOk) o.onOk(val);
    }
    var h = modal(win, { opener: o.opener, focus: input || (o.danger ? no : yes), onDismiss: function () { finish(false); } });
    if (input) input.select();
    no.addEventListener("click", function () { finish(false); });
    yes.addEventListener("click", function () { finish(true); });
    win.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.target === no || e.target === yes) return;
      e.preventDefault(); finish(true);
    });
    return { close: function () { finish(false); } };
  }

  // The menu a row's More opens (GlimStone, "Page actions"): the rare actions, each with its glyph
  // and its words. The arrow keys, Home and End move, Enter and Space run, and Escape, Tab, a press
  // outside, a page scroll or a resize close it, with the focus back on the control. One is open at
  // a time; a second press on the same control closes it. An item is { glyph, label, run, del },
  // and del keeps it off the rainbow's red slot as on the rows.
  var rowMenu = null;
  function menu(anchor, items) {
    if (rowMenu) { var again = rowMenu.anchor === anchor; rowMenu.close(false); if (again) return null; }
    var m = document.createElement("div"); m.className = "cc-rowmenu"; m.setAttribute("role", "menu");
    var rb = g("cc.theming", "1") !== "0" && g("cc.rainbow", "0") === "1";
    var p = surfacePalette(palette(), null), off = g("cc.rainbowrot", "1") === "0" ? 0 : rbSeed(p.length);
    var nodes = items.map(function (it, i) {
      var n = document.createElement("div"); n.className = "cc-rowmenu-it"; n.setAttribute("role", "menuitem"); n.tabIndex = -1;
      n.innerHTML = glyph(it.glyph);
      var l = document.createElement("span"); l.textContent = it.label; n.appendChild(l);
      if (rb) { var c = it.del ? deleteSlot(p, i + off) : p[(i + off) % p.length]; n.style.setProperty("--cc-rb-c", c); n.style.setProperty("--cc-rb-ct", idealText(c)); }
      n.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); close(true); it.run(); });
      m.appendChild(n);
      return n;
    });
    function move(to) { var k = (to + nodes.length) % nodes.length; if (nodes[k]) nodes[k].focus(); }
    m.addEventListener("keydown", function (e) {
      var at = nodes.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); move(at + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(at < 0 ? -1 : at - 1); }
      else if (e.key === "Home") { e.preventDefault(); move(0); }
      else if (e.key === "End") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (at >= 0) nodes[at].click(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === "Tab") close(true);   // the Tab itself then moves on from the control
    });
    function outside(e) { if (!m.contains(e.target) && !anchor.contains(e.target)) close(false); }
    function scrolled(e) { if (!m.contains(e.target)) close(false); }
    function resized() { close(false); }
    function close(refocus) {
      if (rowMenu !== entry) return;
      rowMenu = null;
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", resized);
      if (m.parentNode) m.parentNode.removeChild(m);
      anchor.setAttribute("aria-expanded", "false");
      if (refocus) try { anchor.focus(); } catch (e) {}
    }
    var entry = { anchor: anchor, close: close };
    rowMenu = entry;
    anchor.setAttribute("aria-haspopup", "menu"); anchor.setAttribute("aria-expanded", "true");
    document.body.appendChild(m);
    // Under the control and flush with its right edge, or above it when the page ends first, and
    // kept off the viewport's edges either way.
    var at = placeAt(anchor.getBoundingClientRect(), m.offsetWidth, m.offsetHeight, 6, true);
    m.style.left = at.left + "px"; m.style.top = at.top + "px";
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", resized);
    move(0);
    return entry;
  }
  // /Tools reads cc.styletools and cct.*. An install that only has the /Settings keys gets them
  // copied once, the exception and every ccs.* value, so /Tools keeps its look; a set
  // cc.styletools marks the copy as done. store.LoadConfig makes the same copy in the
  // engine's mirror, which a browser on another origin adopts.
  function splitToolsKeys(ls) {
    if (ls.getItem("cc.styletools") != null) return;
    var keys = [];
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && k.indexOf("ccs.") === 0) keys.push(k); }
    keys.forEach(function (k) { var t = "cct." + k.slice(4); if (ls.getItem(t) == null) ls.setItem(t, ls.getItem(k)); });
    ls.setItem("cc.styletools", ls.getItem("cc.stylesettings") || "1");
  }
  try { splitToolsKeys(localStorage); } catch (e) {}
  // An install that adopts the badge colours gets the tile and tint switches turned on once,
  // globally and for every area with colours of its own, so its logos keep the tile and the ink
  // adopting gave them. cc.iconadoptsplit marks it done and a switch turned off later stays off.
  // store.LoadConfig runs the same step on the engine's mirror.
  function keepAdoptedTiles(ls) {
    var adopt = ls.getItem("cc.iconbgrainbow");
    if (adopt == null || ls.getItem("cc.iconadoptsplit")) return;
    if (adopt === "1") {
      ls.setItem("cc.iconbg", "1"); ls.setItem("cc.icontint", "1");
      [["cc.styledocker", "ccd."], ["cc.stylevms", "ccv."], ["cc.styleplugin", "ccp."]].forEach(function (a) {
        if (ls.getItem(a[0]) === "0") { ls.setItem(a[1] + "iconbg", "1"); ls.setItem(a[1] + "icontint", "1"); }
      });
    }
    ls.setItem("cc.iconadoptsplit", "1");
  }
  try { keepAdoptedTiles(localStorage); } catch (e) {}
  // The Settings and Tools grids take the same step under a marker of their own, so an install
  // that has already run the one above gets it for them as well. Without it a grid with colours
  // of its own shows neither tiles nor tint while the other areas show both.
  function keepAdoptedGridTiles(ls) {
    var adopt = ls.getItem("cc.iconbgrainbow");
    if (adopt == null || ls.getItem("cc.iconadoptgrid")) return;
    if (adopt === "1") {
      [["cc.stylesettings", "ccs."], ["cc.styletools", "cct."]].forEach(function (a) {
        if (ls.getItem(a[0]) === "0") { ls.setItem(a[1] + "iconbg", "1"); ls.setItem(a[1] + "icontint", "1"); }
      });
    }
    ls.setItem("cc.iconadoptgrid", "1");
  }
  try { keepAdoptedGridTiles(localStorage); } catch (e) {}

  window.CCTheme = {
    RB: RB, idealText: idealText, motionLevel: motionLevel, shapeName: shapeName, rbSeed: rbSeed, palette: palette, rbColor: rbColor, paintSelects: paintSelects,
    registerSelectSync: registerSelectSync, nextSelIndex: nextSelIndex, wheelStepSelect: wheelStepSelect,
    gfonts: GFONTS, loadGFonts: loadGFonts, primaryFamily: primaryFamily,
    CC_INFO_SVG: CC_INFO_SVG, infoIcon: infoIcon, CC_TRASH_SVG: CC_TRASH_SVG, delIcon: delIcon,
    lumOf: lumOf, LUM_FLOOR: LUM_FLOOR, liftDark: liftDark, liftLight: liftLight, lightTheme: lightTheme,
    liftSurface: liftSurface, surfacePalette: surfacePalette, isRed: isRed, deleteSlot: deleteSlot, toast: toast, shake: shake, fail: fail, deny: deny,
    pressable: pressable, modal: modal, closeBadge: closeBadge,
    PRESETS: PRESETS, colorPicker: colorPicker, colorSwatch: colorSwatch, swMark: swMark, swMarkRow: swMarkRow, refind: refind, paintWin: paintWin, ask: ask, glyph: glyph, menu: menu, slosh: slosh,
    edge: edge, placeAt: placeAt,
    icons: {
      MODES: ICON_MODES, SIMPLE_MAX: ICON_SIMPLE_MAX,
      globalMode: iconGlobalMode, mode: iconMode, override: iconOverride, overrides: iconOverrides, setOverride: setIconOverride,
      want: iconWant, result: iconResult, svgUrl: iconSvgUrl, spread: iconSpread, tile: iconTile,
      measurePixels: iconMeasurePixels, plan: iconPlan, knock: iconKnockFilter, placeholder: iconPlaceholder,
      onResolved: onIconsResolved, popover: iconPopover
    }
  };

  // Syncs cc.* settings across browsers and origins, since localStorage is per origin and per
  // browser. docker.js and settings.js mirror every cc.* write into the engine's
  // config.ui_settings on their own pages and adopt it back on load; this covers every other page
  // and skips those two, so localStorage.setItem is not wrapped twice.
  (function () {
    if (/^\/Docker(\/|$)/.test(location.pathname) || /^\/Settings\/CannonadeCommand(\/|$)/.test(location.pathname)) return;
    var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
    function apiGet(path) {
      return fetch(PROXY + "?path=" + encodeURIComponent(path), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    function csrfToken() {
      try {
        if (typeof window.csrf_token === "string" && window.csrf_token) return window.csrf_token;
        var f = document.querySelector('input[name="csrf_token"]'); if (f && f.value) return f.value;
        var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) return m[1];
      } catch (e) {}
      return "";
    }
    function apiPut(path, body) {
      var tok = csrfToken();
      return fetch(PROXY + "?path=" + encodeURIComponent(path), {
        method: "PUT", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: (tok ? "csrf_token=" + encodeURIComponent(tok) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}))
      }).catch(function () {});
    }
    var pending = {}, syncT = null;
    try {
      if (!window.__ccLS) {
        var orig = localStorage.setItem.bind(localStorage);
        window.__ccLS = orig;
        localStorage.setItem = function (k, v) {
          // Writing the value already stored gives the engine nothing to hear, and the pages rewrite
          // some keys unchanged on every render, the settings tab among them.
          var same = false; try { same = localStorage.getItem(k) === String(v); } catch (e) {}
          orig(k, v);
          try { if (!same && /^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { pending[k] = 1; clearTimeout(syncT); syncT = setTimeout(push, 800); } } catch (e) {}
        };
      }
    } catch (e) {}
    // A removed key is queued too, and push() deletes it on the server; otherwise the next
    // adopt() would bring the old value back.
    try {
      if (!window.__ccLSRemove) {
        var origRm = localStorage.removeItem.bind(localStorage);
        window.__ccLSRemove = origRm;
        localStorage.removeItem = function (k) {
          origRm(k);
          try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { pending[k] = 1; clearTimeout(syncT); syncT = setTimeout(push, 800); } } catch (e) {}
        };
      }
    } catch (e) {}
    // the writes header.js made before this wrapper existed, see syncedSet() there
    var early = Object.keys(window.__ccLSEarly || {});
    early.forEach(function (k) { pending[k] = 1; });
    if (early.length) syncT = setTimeout(push, 800);
    delete window.__ccLSEarly;
    // One push at a time; a write landing while one is out queues another for when it returns. The
    // keys a push carries stay unsynced until its PUT has landed, so adopt() leaves them alone.
    var sending = {}, pushing = false, queued = false;
    function push() {
      if (pushing) { queued = true; return; }
      var keys = Object.keys(pending); if (!keys.length) return;
      pushing = true;
      // Only the changed keys go out, merged by the engine, so a fresh browser cannot write its
      // defaults over the rest of the engine's copy.
      var body = {};
      keys.forEach(function (k) { sending[k] = 1; delete pending[k]; body[k] = localStorage.getItem(k); });
      apiPut("uisettings", body).then(function (r) { if (!r || !r.ok) keys.forEach(function (k) { pending[k] = 1; }); }).then(function () {
        pushing = false; sending = {};
        if (queued) { queued = false; push(); }
      });
    }
    // A write in the last moments before the page goes away would wait out the debounce and die
    // with the page. On pagehide what is still unsynced goes out
    // in one keepalive request that the engine merges into the config itself.
    window.addEventListener("pagehide", function () {
      var keys = Object.keys(pending).concat(Object.keys(sending));
      if (!keys.length) return;
      var body = {};
      keys.forEach(function (k) { body[k] = localStorage.getItem(k); });
      var tk = csrfToken();
      try {
        fetch(PROXY + "?path=uisettings", {
          method: "PUT", keepalive: true, headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body))
        });
      } catch (e) {}
    });
    function unsynced() { var o = {}; Object.keys(pending).concat(Object.keys(sending)).forEach(function (k) { o[k] = 1; }); return o; }
    function adopt(u, busy) {
      var changed = false, skip = unsynced();
      Object.keys(busy || {}).forEach(function (k) { skip[k] = 1; });
      try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && !skip[k] && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
      return changed;
    }
    // adopt() corrects localStorage from the server copy after the page has already drawn itself
    // with the old values, so call the repaint hooks the area scripts expose for live toggles and
    // the correction shows without another reload.
    var CC_AREA_APPLY_HOOKS = ["ccHeaderApply", "ccSharesApply", "ccDisksApply", "ccVmsApply", "ccPluginsApply", "ccFavoritesApply", "ccSettingsGridApply"];
    function rerenderAdoptedAreas() {
      CC_AREA_APPLY_HOOKS.forEach(function (fnName) {
        try { if (typeof window[fnName] === "function") window[fnName](); } catch (e) {}
      });
    }
    var bootBusy = unsynced();
    apiGet("config").then(function (c) {
      if (!c || typeof c !== "object") return;
      if (adopt(c.ui_settings, bootBusy)) rerenderAdoptedAreas();
      if (!c.ui_settings || !Object.keys(c.ui_settings).length) {
        var seed = {};
        try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") seed[k] = localStorage.getItem(k); } } catch (e) {}
        if (Object.keys(seed).length) { Object.keys(seed).forEach(function (k) { pending[k] = 1; }); push(); }
      }
    });
  })();
})();
