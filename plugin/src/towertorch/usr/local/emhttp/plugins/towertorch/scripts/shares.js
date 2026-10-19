// Enhances the Shares, Main, Browse and Stats pages and the sub-page tabs of /Shares and /Docker.
// Loaded on every page through CannonadeCommand.Shares.page, it toggles html.cc-shares-on while
// the "Freigaben" area is enabled (default off, since enabling flips Unraid's global tabbed
// setting), mirrors the theme vars onto the root and badges the tables. The styling lives in
// sheets/CannonadeCommand.Shares.css, scoped to html.cc-shares-on.
(function () {
  "use strict";
  var mo = null, moPending = false, tabbedTried = false;
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff";
    var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff";
  }
  // adopt toggle: cc.styleshares on -> shared cc.* keys, else this area's own ccsh.* keys
  function eff(k, d) { return g("cc.styleshares", "1") !== "0" ? g("cc." + k, d) : g("ccsh." + k, d); }
  function accent() { var a = eff("accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  // /Main is its own area (cc.enable.main, cc.stylemain, ccm.*) but lives here because it reuses
  // the flatten and badge code. On /Main --cc-shr-accent carries the Start accent, so the
  // shares-scoped rules paint in that colour without a second CSS scope.
  function effMain(k, d) { return g("cc.stylemain", "1") !== "0" ? g("cc." + k, d) : g("ccm." + k, d); }
  function mainAccent() { var a = effMain("accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
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
  // rainbow "active only" sub-mode (cc.rbmode=active): idle badges neutral, active painted, hover colours.
  function rbNeutral() { return g("cc.rbmode", "all") === "active"; }
  // The pathname without trailing slashes, for exact page checks (/Shares vs /Shares/Share).
  function pn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }
  // The file manager is reached as /<parent>/Browse?dir=… with a varying parent, hence the suffix
  // match. The static table.indexer.tablesorter from Browse.page keeps a third-party page that
  // is merely named Browse from matching.
  function onBrowse() {
    try { return /\/Browse$/.test(pn()) && !!document.querySelector("#displaybox table.indexer.tablesorter"); } catch (e) { return false; }
  }
  // System Stats ships from unraid/dynamix (source/system-stats), not webgui. Stats.page is
  // Type="xmenu" Tabs="true", so it renders the standard tab bar this area restyles anyway.
  function onStats() { return pn() === "/Stats"; }
  // SystemStats.page appends its interval selects and Reset button (span.status) to nav.tabs.
  // CSS cannot move them out of the bar, so the span moves below the graphs as one unit and keeps
  // the plugin's handlers, which find it by id and class. teardown puts it back.
  function moveStatsControls() {
    try {
      var box = document.getElementById("displaybox"); if (!box) return;
      var st = box.querySelector("span.status"); if (!st) return;
      if (st.getAttribute("data-cc-moved") === "1" && st.parentNode === box) return;
      box.appendChild(st);
      st.setAttribute("data-cc-moved", "1");
    } catch (e) {}
  }
  function statsControlsTeardown() {
    try {
      var st = document.querySelector("#displaybox > span.status[data-cc-moved]"); if (!st) return;
      var tabs = document.querySelector("#displaybox nav.tabs");
      if (tabs) tabs.appendChild(st);
      st.removeAttribute("data-cc-moved");
    } catch (e) {}
  }
  // i18n as in docker.js: German when the page language is, else English
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var T = { de: { browse: "Durchsuchen", protected: "Geschützt", partly: "Nicht alles geschützt", unknown: "Schutz unbekannt", protection: "Schutz", copy: "Einstellungen kopieren" }, en: { browse: "Browse", protected: "Protected", partly: "Not fully protected", unknown: "Protection unknown", protection: "Protection", copy: "Copy settings" } };
  function t(k) { return (T[LANG] || T.en)[k] || T.en[k]; }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  // File manager: badges the owner, permission, size and date values. The page deletes and moves
  // files, so only those plain text cells are touched, never the check glyph, name, Location (its
  // icon colour encodes encryption) or actions cells; columns and tablesorter's data attributes
  // stay as they are. The tbody is replaced by AJAX, so the observer re-runs this.
  function ccBrowseCell(td, cls) {
    if (!td || td.classList.contains("cc-bcell")) return;
    var txt = (td.textContent || "").trim(); if (!txt) return;
    var b = el("span", "cc-fmb " + (cls || ""), txt);
    td.textContent = ""; td.appendChild(b); td.classList.add("cc-bcell");
  }
  function enhanceBrowse() {
    try {
      if (!onBrowse()) return;
      var rows = document.querySelectorAll("#displaybox table.indexer tbody:not(.tablesorter-infoOnly) tr");
      for (var i = 0; i < rows.length; i++) {
        var tr = rows[i];
        ccBrowseCell(tr.querySelector('td[id^="owner_"]'), "cc-b-owner");
        ccBrowseCell(tr.querySelector('td[id^="perm_"]'), "cc-b-perm");
        // size and then the date follow perm_N, each a plain text td with a numeric data=""
        var perm = tr.querySelector('td[id^="perm_"]');
        var size = perm && perm.nextElementSibling;
        if (size && size.hasAttribute("data") && !size.querySelector("*") && !size.classList.contains("loc")) ccBrowseCell(size, "cc-b-size");
        var dateTd = size && size.nextElementSibling;
        if (dateTd && dateTd.hasAttribute("data") && !dateTd.querySelector("*") && !dateTd.classList.contains("loc")) ccBrowseCell(dateTd, "cc-b-date");
      }
    } catch (e) {}
  }
  // Hides the FireSquire sub-tab on /Main in native tab mode too; older versions of that plugin
  // are called SmokeSignal. If it was active, the first tab takes over so no dead panel shows.
  // Sections mode handles it in cardPanels.
  function ccHideSmokeTab() {
    try {
      if (!onMain()) return;
      var btns = document.querySelectorAll('#displaybox nav.tabs button[role="tab"]');
      var panels = document.querySelectorAll('#displaybox section[role="tabpanel"]');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!/smokesignal|firesquire/i.test(b.textContent || "")) continue;
        if (b.classList.contains("cc-smoke-hidden")) return;
        var wasActive = b.getAttribute("aria-selected") === "true";
        b.classList.add("cc-smoke-hidden");
        if (panels[i]) panels[i].classList.add("cc-smoke-hidden");
        if (wasActive && btns[0]) { try { btns[0].click(); } catch (e2) {} }
        return;
      }
    } catch (e) {}
  }
  // Rainbow paints the tab buttons in rotated palette colours; accent mode clears the inline
  // overrides so the sheet's --cc-accent shows.
  function paintTabs() {
    try {
      ccHideSmokeTab();
      var rb = rbOn(), neutral = rb && rbNeutral(), btns = document.querySelectorAll('#displaybox nav.tabs button[role="tab"]');
      document.documentElement.classList.toggle("cc-shares-rbneutral", rbNeutral()); // paintRows never runs for the /Docker tab bar
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i], active = b.getAttribute("aria-selected") === "true";
        if (!rb) { b.style.removeProperty("background"); b.style.removeProperty("color"); b.style.removeProperty("--cc-rb-c"); b.style.removeProperty("--cc-rb-ct"); continue; }
        var c = rbColor(i), tc = idealText(c);
        b.style.setProperty("--cc-rb-c", c); b.style.setProperty("--cc-rb-ct", tc); // per-tab colour for the neutral-mode :hover
        // "active only" paints just the active tab; the others rest grey and colour on hover
        if (!neutral || active) { b.style.setProperty("background", c, "important"); b.style.setProperty("color", tc, "important"); }
        else { b.style.removeProperty("background"); b.style.removeProperty("color"); }
      }
      // A tab switch only flips aria-selected, which the childList observer misses, so each tab
      // bar gets an attribute observer. paintTabs never writes aria-selected, so it cannot loop.
      var bar = document.querySelector('#displaybox nav.tabs');
      if (bar && !bar.__ccTabObs) {
        bar.__ccTabObs = new MutationObserver(function () { paintTabs(); });
        try { bar.__ccTabObs.observe(bar, { attributes: true, attributeFilter: ["aria-selected"], subtree: true }); } catch (e2) {}
      }
    } catch (e) {}
  }
  // The share detail page stacks its sub-tabs as cards instead of a tab bar, so the rainbow paints
  // each card's title badge here. Without rainbow, var(--cc-shr-accent) from the sheet shows.
  function paintCards() {
    try {
      if (pn() !== "/Shares/Share") return;
      var rb = rbOn(), heads = document.querySelectorAll("#displaybox .cc-card-head");
      for (var i = 0; i < heads.length; i++) {
        var h = heads[i];
        if (rb) { var c = rbColor(i); h.style.setProperty("background", c, "important"); h.style.setProperty("color", idealText(c), "important"); }
        else { h.style.removeProperty("background"); h.style.removeProperty("color"); }
      }
    } catch (e) {}
  }
  // The tab bar needs Unraid's [display] tabs=0 (Tabbed) mode. JS cannot read that setting, so a
  // multi-section page without nav.tabs means it is off: POST it once ($.ajaxPrefilter adds the
  // csrf_token) and reload. The reloaded page has nav.tabs, so there is no loop.
  function ensureTabbed() {
    try {
      if (tabbedTried) return;
      // Tab-Ansicht needs Tabbed mode on /Shares, /Docker and /Main; boot() gates the enhancer on
      // the Freigaben area already.
      if (g("cc.theming", "1") === "0") return;
      var p = pn();
      if (p !== "/Shares" && p !== "/Docker" && p !== "/Main") return;
      if (p === "/Main" && g("cc.enable.main", "0") === "0") return;
      if (document.querySelector("#displaybox nav.tabs")) return;
      if (!window.jQuery) return;
      // Once per browser session: a POST that does not stick would otherwise reload forever.
      try { if (sessionStorage.getItem("cc-tabbed-tried") === "1") return; sessionStorage.setItem("cc-tabbed-tried", "1"); } catch (e) {}
      tabbedTried = true;
      window.jQuery.post("/update.php", { "#file": "dynamix/dynamix.cfg", "#section": "display", "tabs": "0" }, function () {
        try { location.reload(); } catch (e) {}
      });
    } catch (e) {}
  }
  // Hides a bar with a single tab, such as /Docker's, in browsers without :has() (Firefox before
  // 121); elsewhere the CSS rule does it and reverts cleanly. /Shares keeps its one tab.
  function hideRedundantTabs() {
    try {
      if (g("cc.enable.shares", "0") === "0") return;
      if (window.CSS && CSS.supports && CSS.supports("selector(:has(*))")) return;
      var navs = document.querySelectorAll("#displaybox nav.tabs");
      for (var i = 0; i < navs.length; i++) {
        var nav = navs[i], btns = nav.querySelectorAll('button[role="tab"]');
        if (btns.length <= 1 && pn() !== "/Shares" && pn() !== "/Shares/Share") nav.style.display = "none"; // keep the detail page's bar (holds the nav arrows)
      }
    } catch (e) {}
  }
  // The /Shares list wraps each SMB/NFS/Storage/Size/Free value in a badge and moves the browse
  // link (a.view) into its own column. Unraid replaces the whole tbody on every refill, so this
  // re-runs from the observer; the per-row data-cc-sh guard keeps a pass from repeating itself.
  function badgeCell(td) {
    if (!td || td.querySelector(":scope > .cc-b")) return;
    var txt = (td.textContent || "").trim();
    if (txt === "" || txt === "-") return;
    var b = el("span", "cc-b"), v = el("span", "cc-b-v");
    while (td.firstChild) v.appendChild(td.firstChild); // moved, so links and orbs keep working
    b.appendChild(v); td.appendChild(b);
  }
  // Turns the protection orb (green-orb protected, yellow-orb or fa-warning not fully protected)
  // into the shield the share tiles draw, with the orb's own words as its bubble. Returns null
  // without an orb.
  function statusPill(name) {
    var orb = name.querySelector("i.orb, i.green-orb, i.yellow-orb");
    if (!orb) return null;
    var cn = orb.className || "", st = /green-orb/.test(cn) ? "ok" : /yellow-orb|fa-warning/.test(cn) ? "warn" : "idle";
    var infoA = orb.closest("a"); // a.info.nohand
    var words = infoA && infoA.querySelector("span");
    var tip = (words && words.textContent.trim()) || t({ ok: "protected", warn: "partly", idle: "unknown" }[st]);
    var sb = el("span", "cc-shield cc-shield-" + st);
    sb.setAttribute("role", "img"); sb.setAttribute("tabindex", "0");
    sb.setAttribute("data-tip", tip); sb.setAttribute("aria-label", tip);
    sb.innerHTML = window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph({ ok: "ShieldOn", warn: "ShieldAlert", idle: "Shield" }[st]) : "";
    (infoA || orb).style.setProperty("display", "none", "important");
    return sb;
  }
  // The share-name link becomes a large badge with its href intact.
  function enhanceName(name) {
    var nl = name.querySelector('a[href*="/Share?name="]');
    if (nl && !nl.classList.contains("cc-b-name")) { nl.classList.add("cc-b"); nl.classList.add("cc-b-name"); }
  }
  // A row becomes [Name] [Browse] [Comment] [values…]. The Browse cell is always inserted so the
  // body matches the head, and the cells are listed before it shifts the indices.
  function enhanceRow(tr) {
    if (tr.getAttribute("data-cc-sh")) return;
    tr.setAttribute("data-cc-sh", "1");
    var empty = tr.querySelector(":scope > td.empty");
    if (empty) { empty.colSpan = (empty.colSpan || 1) + 1; return; } // the no-shares placeholder spans the Browse column too
    var tds = Array.prototype.slice.call(tr.children);
    var name = tds[0]; if (!name) return;
    var dot = statusPill(name); if (dot) name.insertBefore(dot, name.firstChild);
    var bt = el("td", "cc-browse-col");
    var view = name.querySelector("a.view");
    if (view && view.getAttribute("href")) { // real browse link (disk sub-rows carry an empty a.view)
      view.classList.add("cc-b-browse");
      var ic = view.querySelector("i"); if (ic) ic.parentNode.removeChild(ic);
      if (!view.querySelector(".cc-b-lab")) view.appendChild(el("span", "cc-b-lab", t("browse")));
      bt.appendChild(view); // moved, so href and onclick stay intact
    }
    name.parentNode.insertBefore(bt, name.nextSibling);
    enhanceName(name);
    for (var i = 2; i < tds.length; i++) badgeCell(tds[i]); // SMB, NFS, Storage, Size, Free
    noEllipsis(tr);
  }
  // An action says what it does and stops (GlimStone rule 23), so the Compute link loses its dots.
  function noEllipsis(tr) {
    var as = tr.querySelectorAll("a");
    for (var i = 0; i < as.length; i++) {
      var w = document.createTreeWalker(as[i], NodeFilter.SHOW_TEXT), n, last = null;
      while ((n = w.nextNode())) if (n.nodeValue.trim()) last = n;
      if (last && /\s*(\.\.\.|…)\s*$/.test(last.nodeValue)) last.nodeValue = last.nodeValue.replace(/\s*(\.\.\.|…)\s*$/, "");
    }
  }
  function enhanceHead(table) {
    var head = table && table.querySelector("thead tr");
    if (!head || head.getAttribute("data-cc-sh")) return;
    head.setAttribute("data-cc-sh", "1");
    var name = head.children[0]; if (!name) return;
    head.insertBefore(el("td", "cc-browse-col", t("browse")), name.nextSibling);
  }
  function enhanceShares() {
    try {
      if (g("cc.enable.shares", "0") === "0") return;
      if (pn() !== "/Shares") return;
      // The User and Disk Shares sub-tabs use the same MainContentTabbed DOM as /Main, so
      // Tab-Ansicht flattens them the same way; apply() stamps cc-sections-share for /Shares.
      var box = document.getElementById("displaybox");
      if (box) { if (g("cc.sections.shares", "0") !== "0") cardPanels(box); else flattenTeardown(); }
      var ids = ["shareslist", "disk_list"];
      for (var j = 0; j < ids.length; j++) {
        var tb = document.getElementById(ids[j]); if (!tb) continue;
        var table = tb.closest ? tb.closest("table") : null;
        if (table) { enhanceHead(table); ccShareCols.grips(table); }   // grips after the Browse header, as on /Main
        var rows = tb.children;
        for (var r = 0; r < rows.length; r++) if (rows[r].tagName === "TR") enhanceRow(rows[r]);
      }
      ccShareCols.apply();
      ccShareCols.resetBtn();
      ccMutedEmpties();   // after the row pass has widened the colspan
    } catch (e) {}
  }
  // In rainbow mode every row's badges and Browse pill share one rotated palette colour; accent
  // mode clears the inline colour so the sheet's --cc-shr-accent shows. The row index skips the
  // placeholder, so it stays stable across tbody refills.
  function paintRows() {
    try {
      if (g("cc.enable.shares", "0") === "0") return;
      if (pn() !== "/Shares") return;
      var rb = rbOn(), neutral = rb && rbNeutral(), ids = ["shareslist", "disk_list"];
      document.documentElement.classList.toggle("cc-shares-rbneutral", rbNeutral()); // "active only": rows neutral, whole row colours on hover
      for (var j = 0; j < ids.length; j++) {
        var tb = document.getElementById(ids[j]); if (!tb) continue;
        var rows = tb.children, ri = 0;
        for (var r = 0; r < rows.length; r++) {
          var tr = rows[r]; if (tr.tagName !== "TR" || tr.querySelector(":scope > td.empty")) continue;
          var bs = tr.querySelectorAll(".cc-b, .cc-b-browse");
          if (!rb) {
            tr.style.removeProperty("--cc-rb-c"); tr.style.removeProperty("--cc-rb-ct");
            for (var k = 0; k < bs.length; k++) { bs[k].style.removeProperty("background"); bs[k].style.removeProperty("color"); }
            ri++; continue;
          }
          var c = rbColor(ri), tc = idealText(c);
          tr.style.setProperty("--cc-rb-c", c); tr.style.setProperty("--cc-rb-ct", tc); // on the row, so every badge and the neutral-mode :hover inherit it
          for (var k = 0; k < bs.length; k++) {
            if (!neutral) { bs[k].style.setProperty("background", c, "important"); bs[k].style.setProperty("color", tc, "important"); }
            else { bs[k].style.removeProperty("background"); bs[k].style.removeProperty("color"); }
          }
          ri++;
        }
      }
    } catch (e) {}
  }
  // Rainbow on /Main: each disk_status row's badges take one rotated colour as in paintRows, and
  // each Array-Vorgang control row's buttons one colour per row. The .cc-aop-status pills live in
  // table.array_status, which the badge loop never visits, and disabled buttons are skipped,
  // since an inline !important would beat the sheet's inert grey.
  function paintMain() {
    try {
      if (g("cc.enable.main", "0") === "0") return;
      if (!onMain()) return;
      var rb = rbOn(), neutral = rb && rbNeutral();
      document.documentElement.classList.toggle("cc-shares-rbneutral", rbNeutral());
      var tbs = document.querySelectorAll("#displaybox table.unraid.disk_status");
      for (var j = 0; j < tbs.length; j++) {
        var rows = tbs[j].querySelectorAll("tbody > tr"), ri = 0;
        for (var r = 0; r < rows.length; r++) {
          var tr = rows[r];
          var bs = tr.querySelectorAll(".cc-b, a.cc-b-browse");
          if (!bs.length) continue;                                  // placeholder rows
          if (!rb) {
            tr.style.removeProperty("--cc-rb-c"); tr.style.removeProperty("--cc-rb-ct");
            for (var k = 0; k < bs.length; k++) { bs[k].style.removeProperty("background"); bs[k].style.removeProperty("color"); }
            ri++; continue;
          }
          var c = rbColor(ri), tc = idealText(c);
          tr.style.setProperty("--cc-rb-c", c); tr.style.setProperty("--cc-rb-ct", tc);
          for (var k2 = 0; k2 < bs.length; k2++) {
            if (!neutral) { bs[k2].style.setProperty("background", c, "important"); bs[k2].style.setProperty("color", tc, "important"); }
            else { bs[k2].style.removeProperty("background"); bs[k2].style.removeProperty("color"); }
          }
          ri++;
        }
      }
      // One colour per control row in every array_status table, Mover, Sleep and Clear Stats
      // included.
      var aops = document.querySelectorAll("#displaybox table.array_status"), bi = 0;
      for (var a2 = 0; a2 < aops.length; a2++) {
        var arows = aops[a2].rows;
        for (var r2 = 0; r2 < arows.length; r2++) {
          var btns = arows[r2].querySelectorAll('input[type="submit"], input[type="button"], a.button, button:not([role="tab"])');
          if (!btns.length) continue;
          for (var b2 = 0; b2 < btns.length; b2++) {
            var bt = btns[b2];
            var c2 = rbColor(bi), tc2 = idealText(c2);
            if (rb) { bt.style.setProperty("--cc-rb-c", c2); bt.style.setProperty("--cc-rb-ct", tc2); }   // the hover colour in the neutral sub-mode
            else { bt.style.removeProperty("--cc-rb-c"); bt.style.removeProperty("--cc-rb-ct"); }
            if (!rb || neutral || bt.disabled) { bt.style.removeProperty("background"); bt.style.removeProperty("color"); continue; }
            bt.style.setProperty("background", c2, "important"); bt.style.setProperty("color", tc2, "important");
          }
          bi++;
        }
      }
      // The buttons and inputs below the arrays, such as Unassigned Devices' add-share row,
      // continue the rotation; sub-tab pills and the parity card stay out. .cc-xbtn lets the
      // neutral sub-mode CSS reach them.
      var xbtns = document.querySelectorAll('#displaybox button:not([role="tab"]), #displaybox input[type="button"], #displaybox input[type="submit"]');
      for (var x2 = 0; x2 < xbtns.length; x2++) {
        var xb = xbtns[x2];
        if (xb.closest("table.array_status") || xb.closest("nav.tabs") || xb.closest(".cc-aop-pcard")) continue;
        xb.classList.add("cc-xbtn");
        var xc = rbColor(bi), xtc = idealText(xc);
        if (rb) { xb.style.setProperty("--cc-rb-c", xc); xb.style.setProperty("--cc-rb-ct", xtc); }
        else { xb.style.removeProperty("--cc-rb-c"); xb.style.removeProperty("--cc-rb-ct"); }
        if (!rb || neutral || xb.disabled) { xb.style.removeProperty("background"); xb.style.removeProperty("color"); bi++; continue; }
        xb.style.setProperty("background", xc, "important"); xb.style.setProperty("color", xtc, "important");
        bi++;
      }
      // UD icon tiles, toggle tracks, the column-reset icon and the Planung/Wiki links read
      // --cc-rb-c with the accent as fallback, so without the stamp they show the accent.
      // Checked toggle tracks keep their colour in the neutral sub-mode.
      var extras = document.querySelectorAll("#displaybox a.cc-ud-icon, #displaybox a.cc-ibtn, #displaybox .cc-aop-link, #displaybox .switch-button-background");
      for (var e3 = 0; e3 < extras.length; e3++) {
        var ex = extras[e3];
        if (rb) { var ec = rbColor(bi), ect = idealText(ec); ex.style.setProperty("--cc-rb-c", ec); ex.style.setProperty("--cc-rb-ct", ect); bi++; }
        else { ex.style.removeProperty("--cc-rb-c"); ex.style.removeProperty("--cc-rb-ct"); }
      }
      // Unassigned Devices rows follow the disk_status contract: one colour per row, and the
      // neutral sub-mode falls back to the accent.
      var acc = mainAccent(), accDark = idealText(acc) !== "#fff";
      var utbs = document.querySelectorAll("#displaybox #disk-table-body, #displaybox #remotes-table-body, #displaybox #historical-table-body");
      for (var u = 0; u < utbs.length; u++) {
        var urows = utbs[u].children, uri = 0;
        for (var ur = 0; ur < urows.length; ur++) {
          var utr = urows[ur]; if (utr.tagName !== "TR") continue;
          var ubs = utr.querySelectorAll(".cc-b"); if (!ubs.length) continue;
          var uc = rbColor(uri), utc = idealText(uc);
          if (rb) { utr.style.setProperty("--cc-rb-c", uc); utr.style.setProperty("--cc-rb-ct", utc); }
          else { utr.style.removeProperty("--cc-rb-c"); utr.style.removeProperty("--cc-rb-ct"); }
          for (var uk = 0; uk < ubs.length; uk++) {
            if (!rb || neutral) { ubs[uk].style.removeProperty("background"); ubs[uk].style.removeProperty("color"); ubs[uk].classList.toggle("cc-ink-dark", accDark); }
            else { ubs[uk].style.setProperty("background", uc, "important"); ubs[uk].style.setProperty("color", utc, "important"); ubs[uk].classList.toggle("cc-ink-dark", utc !== "#fff"); }
          }
          uri++;
        }
      }
      // The UD split pills and the /Main section heads take consecutive colours in both rainbow
      // sub-modes, like paintCards() does on /Shares/Share.
      var hbs = document.querySelectorAll("#displaybox .cc-b.cc-ud-h, #displaybox .cc-card-head");
      for (var hb = 0; hb < hbs.length; hb++) {
        if (!rb) { hbs[hb].style.removeProperty("background"); hbs[hb].style.removeProperty("color"); hbs[hb].classList.toggle("cc-ink-dark", accDark); continue; }
        var hc = rbColor(hb), htc = idealText(hc);
        hbs[hb].style.setProperty("background", hc, "important"); hbs[hb].style.setProperty("color", htc, "important");
        hbs[hb].classList.toggle("cc-ink-dark", htc !== "#fff");
      }
    } catch (e) {}
  }
  // Replaces each native <select> on the share page with the disk-dropdown look. The open popup of
  // a native select is drawn by the OS, so an overlay (.cc-sel) mirrors the options. The real
  // select stays hidden as the source of truth for the form POST and Unraid's inline JS; a pick
  // writes selectedIndex and dispatches change so the inline onchange handlers still fire.
  function ccSelects(box) {
    try {
      if (pn() !== "/Shares/Share") return;
      var sels = box.querySelectorAll('select:not([multiple]):not([data-cc-sel])'); // multiples are dropdownchecklists, badged already
      for (var i = 0; i < sels.length; i++) ccWrapSelect(sels[i]);
      // Unraid relabels and reselects options at runtime, and its first updateScreen() runs after
      // this defer script has wrapped them, so the wrapped ones are re-synced too. ccSyncOne writes
      // only on a real change, so this cannot loop.
      var done = box.querySelectorAll("select[data-cc-sel]");
      for (var j = 0; j < done.length; j++) ccSyncOne(done[j]);
      // The shared painter stamps the rotating --cc-rb-c the sheet reads, here where the page
      // (re)builds its selects.
      try { if (window.CCTheme && window.CCTheme.paintSelects) window.CCTheme.paintSelects(document); } catch (e2) {}
    } catch (e) {}
  }
  function ccWrapSelect(sel) {
    // header.js's page-wide sweep may reach the select first. This page's overlay takes its place
    // instead of nesting inside it, where both triggers would show.
    var tsel = sel.parentNode;
    if (tsel && tsel.classList.contains("cc-tsel")) { tsel.parentNode.insertBefore(sel, tsel); tsel.parentNode.removeChild(tsel); sel.removeAttribute("data-cc-tsel"); }
    sel.setAttribute("data-cc-sel", "1");                 // first, so the observer's re-fire is a no-op
    var wrap = el("span", "cc-sel"); sel.parentNode.insertBefore(wrap, sel);
    sel.style.display = "none"; wrap.appendChild(sel);
    // The trigger takes the focus on a click and from Tab, which lets the wheel step the value
    // (GlimStone rule 14), and Enter or Space opens it.
    var trig = el("span", "cc-sel-trigger"); wrap.appendChild(trig);
    if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(trig);
    trig.setAttribute("aria-haspopup", "listbox");
    var panel = el("div", "cc-sel-panel"); wrap.appendChild(panel);
    for (var k = 0; k < sel.options.length; k++) {
      var chip = el("div", "cc-sel-opt", sel.options[k].text); chip.setAttribute("data-i", k);
      chip.addEventListener("click", (function (idx) {
        return function (ev) {
          ev.stopPropagation();
          if (sel.options[idx].disabled) return;
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          // The clone block sits beside the form, not in it, so its select has no form and
          // ccSyncGroup would skip it.
          ccSyncOne(sel);
          // updateScreen() has already re-pointed the storage cascade by property writes, which
          // no observer sees.
          ccSyncGroup(sel.form);
          wrap.classList.remove("cc-open");
          trig.focus();
        };
      })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (sel.disabled) return;
      ccSyncOne(sel);
      var open = wrap.classList.toggle("cc-open");
      if (open) { var o = document.querySelectorAll(".cc-sel.cc-open"); for (var j = 0; j < o.length; j++) if (o[j] !== wrap) o[j].classList.remove("cc-open"); }
    });
    ccSyncOne(sel);
  }
  function ccSyncOne(sel) {
    var w = sel.parentNode; if (!w) return;
    w.classList.toggle("cc-sel-disabled", !!sel.disabled);   // e.g. shareCOW on an existing share
    var t = w.querySelector(".cc-sel-trigger"), c = w.querySelectorAll(".cc-sel-opt");
    // Every text write is guarded: rewriting an unchanged string is still a childList mutation and
    // would keep the page's observer repainting in a loop.
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t && t.textContent !== label) t.textContent = label;
    for (var k = 0; k < c.length; k++) {
      var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue;
      // The option text changes at runtime too: #direction renders with empty options and is
      // labelled later by updateScreen(), and a Primary/Secondary change relabels it.
      if (c[k].textContent !== o.text) c[k].textContent = o.text;
      c[k].classList.toggle("is-selected", o.selected);
      c[k].classList.toggle("is-disabled", !!o.disabled);
    }
  }
  function ccSyncGroup(f) { if (!f) return; var s = f.querySelectorAll("select[data-cc-sel]"); for (var i = 0; i < s.length; i++) ccSyncOne(s[i]); }
  // The mouse wheel over a closed field is handled in cc-theme.js. Like a click, it has to re-sync
  // the siblings as well, since updateScreen() re-points them by property writes.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-sel")) return false; ccSyncOne(sel); ccSyncGroup(sel.form); return true; }); } catch (e) {}
  function ccSelectsTeardown() {
    try {
      var wraps = document.querySelectorAll("#displaybox .cc-sel");
      for (var i = 0; i < wraps.length; i++) {
        var w = wraps[i], sel = w.querySelector("select");
        if (sel) { sel.style.display = ""; sel.removeAttribute("data-cc-sel"); w.parentNode.insertBefore(sel, w); }
        if (w.parentNode) w.parentNode.removeChild(w);
      }
    } catch (e) {}
  }
  // a click outside an open cc-select closes it
  document.addEventListener("click", function () {
    var o = document.querySelectorAll(".cc-sel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open");
  });
  // Unraid's Read buttons (readShare, readSMB, readUserSMB, readNFS) set the selects by property
  // inside a $.get callback, which raises no event the overlay could see. Their jQuery
  // .trigger('change') runs before the AJAX lands and never reaches addEventListener anyway.
  // ajaxComplete fires right after the callback; it is limited to the two clone endpoints so the
  // page's other polling cannot cause a repaint loop.
  try {
    if (window.jQuery) window.jQuery(document).ajaxComplete(function (ev, xhr, opt) {
      if (!/\/(ProtocolData|ShareData)\.php/.test((opt && opt.url) || "")) return;
      var s = document.querySelectorAll("#displaybox select[data-cc-sel]");
      for (var i = 0; i < s.length; i++) ccSyncOne(s[i]);
    });
  } catch (e) {}

  // Moves the "Read/Write settings from" clone block into a side card beside the settings form.
  // Unraid renders three variants, all normalised by turning the enclosing .relative into the flex
  // row with a .cc-main-col and a .cc-side-card:
  //   A  ShareEdit:        .relative = [clone, form]                -> main = form
  //   B  SMB settings:     .relative = [clone];  form-.shade is the .relative's next sibling
  //   C  SMB user-access:  .relative = [clone, .shade>form]         -> main = .shade
  // The main column takes every other child of .relative, or in B the following siblings up to the
  // next .title/.relative. Whole forms move, so no field leaves its <form> and the form JS works.
  function ccCards(root) {
    try {
      var clones = root.querySelectorAll(".clone-settings:not([data-cc-clone])");
      for (var i = 0; i < clones.length; i++) {
        try {
          var clone = clones[i], rel = clone.closest(".relative");
          if (!rel || rel.classList.contains("cc-split-row")) continue;
          var mains = [], c;
          for (c = rel.firstElementChild; c; c = c.nextElementSibling) { if (c !== clone) mains.push(c); }
          if (!mains.length) {                        // variant B
            var n = rel.nextElementSibling;
            while (n && n.tagName !== "SCRIPT" && n.tagName !== "STYLE" && !(n.classList && (n.classList.contains("title") || n.classList.contains("relative")))) { var nx = n.nextElementSibling; mains.push(n); n = nx; }
          }
          var main = el("div", "cc-main-col"), side = el("div", "cc-side-card");
          for (var m = 0; m < mains.length; m++) main.appendChild(mains[m]);
          side.appendChild(el("div", "cc-side-head", t("copy")));
          side.appendChild(clone);
          rel.appendChild(main); rel.appendChild(side);
          rel.classList.add("cc-split-row");
          clone.setAttribute("data-cc-clone", "1");
        } catch (e) {}
      }
    } catch (e) {}
  }
  function ccUnwrap(node) { if (!node || !node.parentNode) return; while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node); node.parentNode.removeChild(node); }
  function ccCardsTeardown() {
    try {
      // Without the CSS the clone floats absolutely again, so the changed DOM order does not show.
      var rows = document.querySelectorAll("#displaybox .cc-split-row");
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var main = row.querySelector(":scope > .cc-main-col"), side = row.querySelector(":scope > .cc-side-card");
        if (main) ccUnwrap(main);
        if (side) { var sh = side.querySelector(":scope > .cc-side-head"); if (sh) side.removeChild(sh); ccUnwrap(side); }
        row.classList.remove("cc-split-row");
      }
      var marks = document.querySelectorAll("#displaybox [data-cc-clone]");
      for (var k = 0; k < marks.length; k++) marks[k].removeAttribute("data-cc-clone");
    } catch (e) {}
  }

  // The FireSquire plugin, formerly SmokeSignal, adds its own sub-tab to /Main although it has a
  // page of its own.
  function ccIsSmokeTab(btn) { return !!btn && /smokesignal|firesquire/i.test(btn.textContent || ""); }
  // Flattens a tabbed container into stacked cards, each panel headed by a .cc-card-head cloned from
  // its hidden tab button; shared by /Shares/Share and /Main, which render the same
  // MainContentTabbed DOM. Panels pair with buttons by DOM index, not aria-labelledby:
  // MainContentTabbed.php numbers them in two loops with different skip logic, so a panel can point
  // at a missing button id.
  function cardPanels(box) {
    var tablist = box.querySelector('nav.tabs, [role="tablist"]');
    var tabBtns = tablist ? tablist.querySelectorAll('button[role="tab"]') : [];
    var panels = box.querySelectorAll('section[role="tabpanel"]');
    for (var i = 0; i < panels.length; i++) {
      var section = panels[i];
      if (section.getAttribute("data-cc-card")) continue;   // skipped by attribute so i stays the DOM index
      if (ccIsSmokeTab(tabBtns[i])) { section.setAttribute("data-cc-card", "1"); section.classList.add("cc-smoke-hidden"); continue; }
      section.setAttribute("data-cc-card", "1");
      ccCards(section);
      var head = document.createElement("div");
      head.className = "cc-card-head";
      var btn = tabBtns[i];
      if (btn && btn.childNodes.length) {                   // the localized <span.left><icon>Title</span>
        var kids = btn.childNodes;
        for (var k = 0; k < kids.length; k++) head.appendChild(kids[k].cloneNode(true));
      } else {
        head.textContent = (btn && btn.textContent.trim()) || (section.id || "").replace(/-panel$/, "");
      }
      var cols = section.querySelectorAll(".cc-main-col");
      if (!cols.length) { section.insertBefore(head, section.firstChild); }   // without a split the section is the card
      else {
        cols[0].insertBefore(head, cols[0].firstChild);
        for (var ci = 1; ci < cols.length; ci++) {
          var col = cols[ci];
          if (col.querySelector(":scope > .cc-card-head")) continue;
          var crow = col.closest(".cc-split-row"), nh = crow ? crow.previousElementSibling : null;
          while (nh && !(nh.classList && (nh.classList.contains("title") || nh.classList.contains("cc-split-row")))) nh = nh.previousElementSibling;
          if (nh && nh.classList && nh.classList.contains("cc-split-row")) nh = null;   // another split row came first, so no heading
          var lft = nh && (nh.querySelector("span.left") || nh);
          var h2 = el("div", "cc-card-head");
          h2.textContent = (lft && (lft.textContent || "").trim()) || "SMB";
          col.insertBefore(h2, col.firstChild);
          if (nh) {
            var rgt = nh.querySelector("span.right");
            if (rgt && (rgt.textContent || "").trim()) { var note = el("div", "cc-card-note"); note.textContent = (rgt.textContent || "").trim(); col.insertBefore(note, h2.nextSibling); }
            nh.classList.add("cc-carded");   // the CSS hides the native heading
          }
        }
      }
    }
  }
  // Reverts cardPanels when Tab-Ansicht is off, so the native sub-tabs show.
  function flattenTeardown() { headsTeardown(); ccCardsTeardown(); }
  function headsTeardown() {
    try {
      var stray = document.querySelectorAll("#displaybox .cc-card-head, #displaybox .cc-card-note");
      for (var s = 0; s < stray.length; s++) stray[s].parentNode.removeChild(stray[s]);
      var carded = document.querySelectorAll("#displaybox .cc-carded");
      for (var cd = 0; cd < carded.length; cd++) carded[cd].classList.remove("cc-carded");
      var marked = document.querySelectorAll("#displaybox [data-cc-card]");
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-card");
    } catch (e) {}
  }

  // The share detail page. Its theming is CSS through the cc-on-share-detail class; a
  // .cc-share-title left by an older version is removed.
  function enhanceShareDetail() {
    try {
      var box = document.getElementById("displaybox"); if (!box) return;
      if (pn() !== "/Shares/Share") return;
      if (g("cc.enable.shares", "0") === "0") return;   // the observer can still fire after a runtime disable
      var ttl = box.querySelector(":scope > .cc-share-title"); if (ttl) ttl.parentNode.removeChild(ttl);
      // Unraid nests input[name=confirmDelete] inside label#deleteLabel, a full-width <dl> grid
      // item. Both go into one span with the checkbox moved in front, so the badge hugs its text.
      // The checkbox is moved, not cloned: chkDelete() finds it by name, and a clone would send
      // confirmDelete twice.
      var label = box.querySelector("dl > #deleteLabel");
      if (label && !box.querySelector(".cc-del-wrap")) {
        var cb = label.querySelector('input[type="checkbox"][name="confirmDelete"]');
        var dl = label.parentNode;
        if (cb && dl) {
          var wrap = document.createElement("span");
          wrap.className = "cc-del-wrap"; wrap.setAttribute("data-cc", "1");
          dl.insertBefore(wrap, label);
          wrap.appendChild(cb);
          wrap.appendChild(label);
          cb.classList.add("cc-cb-del");
          label.classList.add("cc-b-del");
          // The checkbox arms Unraid's delete submit (#cmdEditShare) through its native onchange,
          // and the CSS keeps the badge inert until then. A click on the armed badge forwards to
          // #cmdEditShare; the label has no for=, so it cannot untick the checkbox.
          label.addEventListener("click", function () {
            if (cb.checked && !cb.disabled) { var sub = document.getElementById("cmdEditShare"); if (sub) sub.click(); }
          });
        }
      }
      // Tab-Ansicht: native sub-tabs by default, or stacked sections. The default "0" has to match
      // the cc-sections-share stamp in apply(), or the flattened DOM lacks its gating class.
      // With the native sub-tabs the copy-settings block still becomes its own card beside the form.
      if (g("cc.sections.shares", "0") !== "0") cardPanels(box); else { headsTeardown(); ccCards(box); }
      ccSelects(box);
    } catch (e) {}
  }
  // /Main has its own row code: table.unraid.disk_status has ten mixed columns, is refilled by
  // nchan and carries structural rows (colspan placeholders, pool_header, tr_last, offline rows)
  // that the share-list logic would break. onMain() requires nav.tabs, so it runs in Tabbed mode only.
  function onMain() { try { return pn() === "/Main" && !!document.querySelector("#displaybox nav.tabs"); } catch (e) { return false; } }
  // Badges a value cell by moving its children into .cc-b > .cc-b-v, so the Reads/Writes spans and
  // the Errors info icon keep working. Skipped: the usage bar (restyled by CSS), the assignment
  // <select>, structural colspan cells and the disk-name link, which is its own large badge.
  function mainBadgeCell(td) {
    if (!td || td.classList.contains("cc-bcell")) return;
    if (td.classList.contains("cc-browse-col")) return;      // already holds the browse pill
    if (td.querySelector(".usage-disk")) return;
    if (td.querySelector("select")) return;
    if (td.hasAttribute("colspan")) return;
    if (td.querySelector("a.cc-b-name")) return;
    var txt = (td.textContent || "").trim(); if (txt === "" || txt === "-" || txt === "*") return;
    var b = el("span", "cc-b"), v = el("span", "cc-b-v");
    while (td.firstChild) v.appendChild(td.firstChild);
    b.appendChild(v); td.appendChild(b); td.classList.add("cc-bcell");
  }
  // The disk name becomes a large badge like the share name. Its link sits in the Identification
  // cell (td.desc) rather than the Device cell, so the whole row is searched.
  function enhanceMainName(tr) {
    var nl = tr.querySelector('a[href*="/Main/Device?name="], a[href*="/Main/Boot?name="]') || tr.querySelector(':scope > td.desc a[href]');
    if (nl) { if (!nl.classList.contains("cc-b-name")) { nl.classList.add("cc-b"); nl.classList.add("cc-b-name"); } return; }
    // With the array stopped, an empty slot (DISK_NP, DISK_NP_DSBL) renders its name as a bare text
    // node in the Device cell and has no td.desc, so that text node is wrapped instead. It stops at
    // the first <br>, after which DISK_NP_MISSING and DISK_WRONG append a "Missing" note.
    var cell = tr.children[0]; if (!cell || cell.querySelector(":scope > .cc-b-name")) return;
    for (var n = cell.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1 && n.tagName === "BR") return;
      if (n.nodeType !== 3) continue;
      var txt = (n.textContent || "").replace(new RegExp(String.fromCharCode(160), "g"), " ").trim();
      if (!txt) continue;
      cell.replaceChild(el("span", "cc-b cc-b-name", txt), n);
      return;
    }
  }
  // With the array stopped, the Identification cell holds the assignment <select class='slot'>,
  // which native CSS fixes at 440px; on hover it spills across the Temp column. Shares.css clamps it
  // to the cell, so the full device string goes into a title that ccTipSweep shows as a bubble.
  function ccSlotTip(tr) {
    try {
      var s = tr.querySelector("select.slot"); if (!s) return;
      var o = s.options[s.selectedIndex], txt = ((o && o.text) || "").trim();
      if (txt && !s.getAttribute("data-cc-tip") && s.getAttribute("title") !== txt) s.setAttribute("title", txt);
    } catch (e) {}
  }
  // With the array stopped, an empty <tr class='tr_last'> separates Parity from Data. tr_last is
  // also the totals bar that Shares.css tints, so empty ones are marked and the CSS turns them into
  // a section gap; rows with content keep the bar.
  function ccVoidRow(tr) {
    try {
      var cells = tr.children, empty = true;
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].querySelector("*")) { empty = false; break; }
        if (((cells[i].textContent || "").replace(new RegExp(String.fromCharCode(160), "g"), " ").trim())) { empty = false; break; }
      }
      tr.classList.toggle("cc-tr-void", empty);
    } catch (e) {}
  }
  function enhanceMainHead(table) {
    var h = table && table.querySelector("thead tr"); if (!h || h.getAttribute("data-cc-main")) return;
    h.setAttribute("data-cc-main", "1");
    var dev = h.children[0]; if (!dev) return;
    if (h.children.length < 8) { if (dev.hasAttribute("colspan")) dev.colSpan = (dev.colSpan || 1) + 1; return; }   // a short head row is widened; an inserted cell would show as a dark block
    h.insertBefore(el("td", "cc-browse-col", t("browse")), dev.nextSibling);
  }
  function enhanceMainRow(tr) {
    if (tr.getAttribute("data-cc-main")) return; tr.setAttribute("data-cc-main", "1");
    var first = tr.children[0]; if (!first) return;
    // The Browse column is column 2. A structural row whose first cell spans (placeholder, stopped
    // separator) is widened; any other gets an empty cell after the first, like the data rows.
    // show_totals() emits ten plain cells, or a trailing colspan in the pool variant, so widening
    // any other span would shift the totals left of their headers.
    if (first.hasAttribute("colspan") || tr.classList.contains("pool_header") || tr.classList.contains("tr_last") || tr.querySelector(":scope > td.empty")) {
      if (first.hasAttribute("colspan")) first.colSpan = (first.colSpan || 1) + 1;
      else tr.insertBefore(el("td", "cc-browse-col"), first.nextSibling);
      ccFill11(tr);
      ccVoidBars(tr);
      ccVoidRow(tr);
      // Pool and boot summary rows get badges too. The name link comes from the first cell only,
      // since td.desc can hold a pool status "(ONLINE)" link that is not the name.
      if (tr.classList.contains("pool_header")) {
        var pnl = first.querySelector('a[href*="/Main/Device?name="], a[href*="/Main/Boot?name="]');
        if (pnl && !pnl.classList.contains("cc-b-name")) { pnl.classList.add("cc-b"); pnl.classList.add("cc-b-name"); }
        // the pool's own browse link moves into the inserted Browse cell, as in the data rows
        var pbt = tr.children[1], pview = first.querySelector("a.view");
        if (pview && pview.getAttribute("href") && pbt && pbt.classList.contains("cc-browse-col") && !pbt.firstChild) {
          pview.classList.add("cc-b-browse");
          var pic = pview.querySelector("i"); if (pic) pic.parentNode.removeChild(pic);
          if (!pview.querySelector(".cc-b-lab")) pview.appendChild(el("span", "cc-b-lab", t("browse")));
          pbt.appendChild(pview);
        }
        var pc = tr.children;
        for (var p = 1; p < pc.length; p++) mainBadgeCell(pc[p]);
      }
      return;
    }
    var bt = el("td", "cc-browse-col");
    var view = first.querySelector("a.view");
    if (view && view.getAttribute("href")) {
      view.classList.add("cc-b-browse");
      var ic = view.querySelector("i"); if (ic) ic.parentNode.removeChild(ic);
      if (!view.querySelector(".cc-b-lab")) view.appendChild(el("span", "cc-b-lab", t("browse")));
      bt.appendChild(view);
    }
    first.parentNode.insertBefore(bt, first.nextSibling);
    enhanceMainName(tr);
    var tds = Array.prototype.slice.call(tr.children);
    for (var i = 2; i < tds.length; i++) mainBadgeCell(tds[i]);
    ccSlotTip(tr);
    ccFill11(tr);
    ccVoidBars(tr);
  }
  // Hides usage bars whose label is only whitespace or &nbsp;, which the CSS :empty guard cannot
  // see and which would show as a bare grey track.
  function ccVoidBars(tr) {
    try {
      var bars = tr.querySelectorAll(".usage-disk");
      for (var vb = 0; vb < bars.length; vb++) {
        var lab = bars[vb].lastElementChild;
        var vtxt = ((lab && lab.textContent) || "").replace(new RegExp(String.fromCharCode(160), "g"), " ").trim();
        bars[vb].classList.toggle("cc-bar-void", !vtxt);
      }
    } catch (e) {}
  }
  // Pads every row to 11 grid columns; under colfix a short row leaves a dark patch at the right
  // end. The deficit goes to the last colspan cell, else the last cell.
  function ccFill11(tr) {
    try {
      var colsum = 0, lastSpan = null, cells = tr.children;
      if (!cells.length) return;
      for (var cs = 0; cs < cells.length; cs++) { colsum += (cells[cs].colSpan || 1); if (cells[cs].hasAttribute("colspan")) lastSpan = cells[cs]; }
      if (colsum >= 11) return;
      var target = lastSpan || cells[cells.length - 1];
      target.colSpan = (target.colSpan || 1) + (11 - colsum);
    } catch (e) {}
  }
  // Column drag-resize in the style of Windows Explorer, for /Main and both /Shares lists. Every
  // full thead row gets a .cc-colgrip on each cell's right edge. A drag writes pixel widths into a
  // <colgroup data-cc-colw> on every matching table with table-layout:fixed and the sum as the
  // table width; explicit widths on all columns keep fixed layout safe with colspan rows and keep
  // sibling tables in step. The widths persist as JSON under cfg.key; refills replace only the
  // tbodys, so apply() re-applies them on load. A double-click on a grip or the .cc-colreset button
  // resets. Without stored widths one shared set is derived from the first visible table, and only
  // that derived set passes through cfg.fix.
  //   cfg: key   localStorage key ("cc.main.colpx" / "cc.shares.colpx")
  //        sel   the instance's table family selector
  //        n     fixed grid column count (/Main: 11 incl. colspan rows); omit -> read the live thead
  //        host  () -> element hosting the reset ibtn (null = not on this page)
  //        place (host, btn) -> insert the reset ibtn (per-page spot idiom)
  //        fix   (widths, headRow) -> correction pass on the derived set
  function ccColFactory(cfg) {
    var min = 40, drag = null, bound = false;
    function tables() { return document.querySelectorAll(cfg.sel); }
    function headOf(tb) { return tb.querySelector("thead tr"); }
    function num() {   // the fixed grid, else the first real thead's length
      if (cfg.n) return cfg.n;
      var tbs = tables();
      for (var t = 0; t < tbs.length; t++) { var h = headOf(tbs[t]); if (h && h.children.length > 1) return h.children.length; }
      return 0;
    }
    function read() {
      try {
        var n = num(); if (!n) return null;
        var a = JSON.parse(g(cfg.key, "null")); if (!a || a.length !== n) return null;
        for (var i = 0; i < n; i++) { var v = Math.round(+a[i]); if (!(v >= min)) return null; a[i] = v; }
        return a;
      } catch (e) { return null; }
    }
    function colgroup(table, n) {
      var cg = table.querySelector(":scope > colgroup[data-cc-colw]");
      if (cg && cg.children.length !== n) { cg.parentNode.removeChild(cg); cg = null; }
      if (!cg) {
        cg = document.createElement("colgroup"); cg.setAttribute("data-cc-colw", "1");
        for (var i = 0; i < n; i++) cg.appendChild(document.createElement("col"));
        table.insertBefore(cg, table.firstChild);
      }
      return cg;
    }
    // Stored widths wider than the page shrink in proportion to fit it, so the last columns are not
    // cut off at its edge, but a column stops at its header's whole label and the others shrink a
    // little more for it. When the labels alone need more than the page, the table keeps them whole
    // and scrolls inside .TableContainer. A drag passes no fit and widens the table, as Explorer
    // does.
    function fitted(w, room, labels) {
      var sum = 0, i; for (i = 0; i < w.length; i++) sum += w[i];
      if (!room || sum <= room) return w;
      var lo = w.map(function (v, k) { return Math.min(v, Math.max(min, (labels && labels[k]) || min)); });
      var floor = 0; for (i = 0; i < lo.length; i++) floor += lo[i];
      if (floor >= room) return lo;
      // A column pinned at its label leaves less room for the rest, which can pin another, so the
      // scale is worked out again until no new column pins; that takes at most one pass per column.
      var pinned = w.map(function () { return false; }), scale = room / sum;
      for (var pass = 0; pass < w.length; pass++) {
        var fixed = 0, free = 0, more = false;
        for (i = 0; i < w.length; i++) { if (pinned[i]) fixed += lo[i]; else free += w[i]; }
        scale = (room - fixed) / free;
        for (i = 0; i < w.length; i++) if (!pinned[i] && w[i] * scale < lo[i]) { pinned[i] = true; more = true; }
        if (!more) break;
      }
      return w.map(function (v, k) { return pinned[k] ? lo[k] : Math.floor(v * scale); });
    }
    // The width a header needs to show its label whole: the text in its own font, case and letter
    // spacing, plus its padding. A canvas measures it, since a probe in the table would wake the
    // observers that redraw it.
    var ruler = null;
    function labelWidths(tbs, n) {
      for (var t = 0; t < tbs.length; t++) {
        var h = headOf(tbs[t]); if (!h || h.children.length < n || !h.getClientRects().length) continue;
        ruler = ruler || document.createElement("canvas").getContext("2d");
        var out = [];
        for (var i = 0; i < n; i++) {
          var c = h.children[i], cs = getComputedStyle(c), txt = c.textContent.trim();
          if (cs.textTransform === "uppercase") txt = txt.toUpperCase();
          ruler.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
          out.push(Math.ceil(ruler.measureText(txt).width + (parseFloat(cs.letterSpacing) || 0) * txt.length + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) + 2);
        }
        return out;
      }
      return null;
    }
    function room(tbs) {   // a sub-tab hidden in native-tabs mode measures 0, so the widest one counts
      var r = 0; for (var t = 0; t < tbs.length; t++) r = Math.max(r, tbs[t].parentNode.clientWidth || 0);
      return r;
    }
    function set(w, fit) {
      var tbs = tables();
      if (fit) w = fitted(w, room(tbs), labelWidths(tbs, w.length));
      var sum = 0, i, n = w.length; for (i = 0; i < n; i++) sum += w[i];
      for (var t = 0; t < tbs.length; t++) {
        var cols = colgroup(tbs[t], n).children;
        for (i = 0; i < n; i++) { var px = w[i] + "px"; if (cols[i].style.width !== px) cols[i].style.width = px; }
        tbs[t].classList.add("cc-colfix");
        var tw = sum + "px"; if (tbs[t].style.width !== tw) tbs[t].style.width = tw;   // wider than the container scrolls inside .TableContainer
      }
    }
    function clear() {
      var tbs = tables();
      for (var t = 0; t < tbs.length; t++) {
        var cg = tbs[t].querySelector(":scope > colgroup[data-cc-colw]"); if (cg) cg.parentNode.removeChild(cg);
        tbs[t].classList.remove("cc-colfix"); tbs[t].style.removeProperty("width");
      }
    }
    function markAuto(on) { var tbs = tables(); for (var t = 0; t < tbs.length; t++) tbs[t].classList.toggle("cc-colauto", !!on); }   // derived widths keep the table at 100%, without a horizontal scroll
    function apply() {
      var n = num(); if (!n) return;
      var w = read();
      if (!w) {
        var tbs = tables();
        for (var t = 0; t < tbs.length; t++) {
          var h = headOf(tbs[t]);
          if (!h || h.children.length < n) continue;
          if (!tbs[t].getBoundingClientRect().width) continue;   // a hidden sub-tab measures 0
          if (tbs[t].classList.contains("cc-colfix")) { w = null; break; }   // derived already on this load
          w = []; for (var k = 0; k < n; k++) w.push(Math.max(min, Math.round(h.children[k].getBoundingClientRect().width)));
          if (cfg.fix) cfg.fix(w, h);
          break;
        }
        if (w) { set(w); markAuto(true); }
      } else { set(w, true); markAuto(false); }
      if (!bound) {
        bound = true;
        window.addEventListener("resize", function () {
          if (!read()) clear();   // derived widths are measured again
          apply();                // and stored ones fit the new width, since /Shares has no nchan tick
        });
      }
    }
    function down(e) {
      if (e.button != null && e.button !== 0) return;
      var table = this.closest("table"), h = table && headOf(table), n = num();
      if (!h || !n || h.children.length < n) return;
      var w = []; for (var k = 0; k < n; k++) w.push(Math.max(min, Math.round(h.children[k].getBoundingClientRect().width)));   // the grabbed table's geometry as drawn, fitted or not, so nothing jumps
      set(w);
      var ci = +this.getAttribute("data-cc-col");
      drag = { i: ci, x: e.clientX, w: w, start: w[ci] };
      try { this.setPointerCapture(e.pointerId); } catch (e2) {}
      document.documentElement.classList.add("cc-col-dragging");
      e.preventDefault();
    }
    function move(e) {
      if (!drag) return;
      drag.w[drag.i] = Math.max(min, Math.round(drag.start + (e.clientX - drag.x)));
      set(drag.w);
      e.preventDefault();
    }
    function up() {
      if (!drag) return;
      try { localStorage.setItem(cfg.key, JSON.stringify(drag.w)); } catch (e) {}
      drag = null;
      document.documentElement.classList.remove("cc-col-dragging");
    }
    function reset(e) {   // the caller re-applies the derived set
      try { localStorage.removeItem(cfg.key); } catch (e2) {}
      clear();
      if (e) { e.preventDefault(); e.stopPropagation(); }
    }
    function grips(table) {
      var h = headOf(table); if (!h) return;
      var n = num(); if (!n) return;
      var tds = h.children; if (tds.length < n) return;   // a short divider thead gets none
      for (var i = 0; i < n; i++) {
        if (tds[i].querySelector(":scope > .cc-colgrip")) continue;
        var gp = el("span", "cc-colgrip"); gp.setAttribute("data-cc-col", i);
        gp.addEventListener("pointerdown", down);
        gp.addEventListener("pointermove", move);   // pointer capture keeps the drag on the grip outside the table too
        gp.addEventListener("pointerup", up);
        gp.addEventListener("pointercancel", up);
        gp.addEventListener("dblclick", function (e) { reset(e); apply(); });
        tds[i].appendChild(gp);
      }
    }
    function resetBtn() {
      try {
        var host = cfg.host && cfg.host(); if (!host) return;
        if (document.querySelector('.cc-colreset[data-cc-colreset="' + cfg.key + '"]')) return;
        var b = el("a", "cc-ibtn cc-colreset");
        b.href = "#";
        b.setAttribute("data-cc-colreset", cfg.key);
        b.setAttribute("data-cc-tip", mtText("Reset column widths"));
        b.innerHTML = window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph("Restore") : "";
        b.addEventListener("click", function (e) { e.preventDefault(); reset(); apply(); });
        cfg.place(host, b);
      } catch (e) {}
    }
    function teardown() {   // keeps the stored widths for a re-enable
      try {
        var gps = document.querySelectorAll(cfg.sel + " .cc-colgrip");
        for (var i = 0; i < gps.length; i++) gps[i].parentNode.removeChild(gps[i]);
        var rb2 = document.querySelector('.cc-colreset[data-cc-colreset="' + cfg.key + '"]'); if (rb2) rb2.parentNode.removeChild(rb2);
        clear();
        drag = null;
        document.documentElement.classList.remove("cc-col-dragging");
      } catch (e) {}
    }
    return { apply: apply, grips: grips, resetBtn: resetBtn, teardown: teardown };
  }
  // On the derived /Shares widths every size column gets at least 110px, taken proportionally from
  // the other columns' surplus above 60px.
  function ccShareColFix(w, head) {
    try {
      var MINB = 110, FLOOR = 60, sz = /Größe|Grösse|Size|Speicher|Storage|frei|free|used/i;   // /i does not fold ß onto an uppercase GRÖSSE
      var need = 0, donors = [], i;
      for (i = 0; i < w.length; i++) {
        var ht = ((head.children[i] && head.children[i].textContent) || "").trim();
        if (sz.test(ht)) { if (w[i] < MINB) { need += MINB - w[i]; w[i] = MINB; } }
        else donors.push(i);
      }
      if (!need) return;
      var pool = 0, d;
      for (d = 0; d < donors.length; d++) pool += Math.max(0, w[donors[d]] - FLOOR);
      if (!pool) return;
      var take = Math.min(need, pool);
      for (d = 0; d < donors.length; d++) w[donors[d]] -= Math.round(take * Math.max(0, w[donors[d]] - FLOOR) / pool);
    } catch (e) {}
  }
  // /Main: a fixed 11-column grid, with ccFill11 normalising the colspan rows.
  var ccMainCols = ccColFactory({
    key: "cc.main.colpx", n: 11,
    sel: "#displaybox table.unraid.disk_status",
    host: function () { var a = document.querySelector("#displaybox span.status a.tooltip_diskio"); return a ? a.parentNode : null; },
    place: function (host, b) { host.insertBefore(b, host.firstChild); }   // leads the cluster; behind the toggle it overflows the right alignment edge
  });
  // /Shares: #shareslist and #disk_list share one width set, with the column count read from the
  // live thead. The reset button sits at the tab bar's right end, as on /Main.
  var ccShareCols = ccColFactory({
    key: "cc.shares.colpx",
    sel: "#displaybox table.unraid.share_status",
    host: function () { return pn() === "/Shares" ? document.querySelector("#displaybox nav.tabs") : null; },
    place: function (host, b) { host.appendChild(b); },
    fix: ccShareColFix
  });
  // A long Identification value (the boot USB serial) clips at rest and slides left on hover to
  // reveal its tail, like the Docker volume column. Delegated once, inline transform only, since
  // the nchan refill recreates the cells clean and teardown unwraps the pills wholesale.
  var ccMarqBound = false, ccMarqRun = null;   // outside the DOM: the 1s tbody refill destroys the animated node mid-slide
  function ccMarqStart(b) {
    var v = b.querySelector(":scope > .cc-b-v"); if (!v) return;
    var ov = v.scrollWidth - b.clientWidth + 24;
    if (ov <= 6) return;
    var dur = Math.min(8, Math.max(2, ov / 60));
    ccMarqRun = { ov: ov, dur: dur, t0: Date.now(), key: (v.textContent || "").trim() };   // the value text identifies the same pill across node swaps
    b.setAttribute("data-cc-marq", "1");
    v.style.transition = "transform " + dur + "s linear";
    v.style.transform = "translateX(-" + ov + "px)";
  }
  // The refill recreates the hovered cell without the transform, so on its own the slide would jump
  // back and restart every tick. Called from enhanceMain's sync pass before paint, this re-enters
  // the freshly built pill at the interpolated offset and runs out the remaining time.
  function ccMarqResume() {
    if (!ccMarqRun) return;
    if ((Date.now() - ccMarqRun.t0) / 1000 > ccMarqRun.dur + 2) { ccMarqRun = null; return; }   // over, plus a grace margin
    var b = document.querySelector("#displaybox table.unraid.disk_status td.desc:hover .cc-b");
    // A missing :hover match does not mean the pointer left: right after the node swap the
    // browser's hit-test can lag a frame. The run state stays, and the next tick or the re-fired
    // mouseover resumes it; mouseout ends it.
    if (!b) return;
    if (b.getAttribute("data-cc-marq") === "1") return;          // the node survived this tick, so the animation is intact
    var v = b.querySelector(":scope > .cc-b-v"); if (!v) return;
    if ((v.textContent || "").trim() !== ccMarqRun.key) return;  // a different pill under the pointer; its own mouseover starts it
    var p = Math.min(1, (Date.now() - ccMarqRun.t0) / (ccMarqRun.dur * 1000));
    b.setAttribute("data-cc-marq", "1");
    v.style.transition = "none";
    v.style.transform = "translateX(-" + Math.round(ccMarqRun.ov * p) + "px)";
    void v.offsetWidth;                                          // commit the entry point before re-arming the transition
    if (p < 1) {
      v.style.transition = "transform " + (ccMarqRun.dur * (1 - p)) + "s linear";
      v.style.transform = "translateX(-" + ccMarqRun.ov + "px)";
    }
  }
  function ccIdentMarq() {
    if (ccMarqBound) return; ccMarqBound = true;
    var host = document.getElementById("displaybox"); if (!host) return;
    host.addEventListener("mouseover", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("table.unraid.disk_status td.desc .cc-b") : null;
      if (!b || b.getAttribute("data-cc-marq") === "1") return;
      // The refill swaps the node under the pointer, so the browser re-fires mouseover on the new
      // node. Starting fresh would reset t0 every second, so a run still going on the same pill
      // resumes at its interpolated point instead.
      var v0 = b.querySelector(":scope > .cc-b-v");
      if (ccMarqRun && v0 && (v0.textContent || "").trim() === ccMarqRun.key) { ccMarqResume(); return; }
      ccMarqStart(b);
    });
    host.addEventListener("mouseout", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("table.unraid.disk_status td.desc .cc-b") : null;
      if (!b || b.getAttribute("data-cc-marq") !== "1") return;
      if (e.relatedTarget && b.contains(e.relatedTarget)) return;   // still inside the pill
      var v = b.querySelector(":scope > .cc-b-v");
      if (v) v.style.transform = "translateX(0)";
      b.removeAttribute("data-cc-marq");
      ccMarqRun = null;
    });
  }
  // Sections mode only: the UD title bar's control cluster (the span/div.right elements holding
  // gear, refresh and the three switchButtons) leaves the bar, and the emptied bar is hidden via
  // .cc-ud-moved. While UD's parts are tile cards (disks.js puts them in .cc-dk-udrow inside a
  // .cc-dk-box) the cluster is a card of its own at the end of their row, one line per control;
  // otherwise it sits in the UD section's .cc-card-head. Like ccDiskioMove this moves rather than
  // clones, so UD's jQuery bindings ride along; ccUdCtrlsHome puts the cluster back before any
  // teardown that deletes card heads.
  function ccUdCtrlsMove() {
    try {
      if (g("cc.sections.main", "0") === "0") return;
      var wrap = document.querySelector("#displaybox .cc-ud-ctrls[data-cc-ud-ctrls]"), bar;
      if (wrap) bar = document.querySelector("#displaybox div.title[data-cc-ud-moved]");
      else {
        var uda = document.querySelector("#displaybox input.disks-switch, #displaybox input.shares-switch, #displaybox input.historical-switch, #displaybox a[onclick^='rescan_disks'], #displaybox a[href*='UnassignedDevicesSettings']");
        bar = uda && uda.closest ? uda.closest("div.title") : null;
      }
      var sec = bar && bar.closest("section[data-cc-card]"); if (!sec) return;
      var row = sec.classList.contains("cc-dk-box") ? sec.querySelector(":scope > .cc-dk-udrow") : null;
      var host = row ? ccUdPanel(row) : sec.querySelector(":scope > .cc-card-head"); if (!host) return;
      if (!wrap) { wrap = ccUdCtrlsGather(bar); if (!wrap) return; }
      if (wrap.parentNode !== host) host.appendChild(wrap);
      ccUdLabels(wrap, !!row);
      if (!row) ccUdPanelDrop();
    } catch (e) {}
  }
  function ccUdCtrlsGather(bar) {
    var wrap = el("span", "cc-ud-ctrls"); wrap.setAttribute("data-cc-ud-ctrls", "1");
    var kids = Array.prototype.slice.call(bar.children);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.classList && (k.classList.contains("left") || k.classList.contains("leftTitleUD"))) continue;   // the heading host stays (hidden by CSS)
      if (k.tagName === "A" || (k.querySelector && k.querySelector("a, input[type='checkbox'], .switch-button-background"))) wrap.appendChild(k);
    }
    if (!wrap.firstChild) return null;
    // Stamp cc-ud-icon on every non-switch anchor that has content, since the glyph can be the
    // anchor's own text rather than an <i>. An empty anchor (each toggle span carries one) would
    // render as a blank accent square between the toggle and its label.
    var as = wrap.querySelectorAll("a");
    for (var ai = 0; ai < as.length; ai++) {
      var aEl = as[ai], hasGlyph = !!((aEl.textContent || "").trim() || aEl.querySelector("i, img, span, svg, b"));
      if (!aEl.closest("[class*='switch']") && hasGlyph) aEl.classList.add("cc-ud-icon");
      else aEl.classList.remove("cc-ud-icon");   // drop a stale stamp
    }
    // each toggle gets its label as plain hover text rather than a balloon
    for (var tw = 0; tw < wrap.children.length; tw++) {
      var wch = wrap.children[tw], wl = wch.querySelector ? wch.querySelector(".switch-button-label") : null;
      if (wl && !wch.getAttribute("title")) wch.setAttribute("title", (wl.textContent || "").trim());
    }
    // the icons too: without a title of their own, derive one from the glyph (gear for settings,
    // circling arrows for refresh)
    for (var ti = 0; ti < as.length; ti++) {
      var ta = as[ti];
      if (!ta.classList.contains("cc-ud-icon") || ta.getAttribute("title")) continue;
      var cls = ((ta.querySelector("i, span") || {}).className || "") + " " + (ta.className || "");
      if (/gear|cog|setting/i.test(cls)) ta.setAttribute("title", LANG === "de" ? "Unassigned-Devices-Einstellungen" : "Unassigned Devices settings");
      else if (/refresh|sync|rotate/i.test(cls)) ta.setAttribute("title", LANG === "de" ? "Datenträger neu einlesen" : "Refresh disks");
    }
    bar.setAttribute("data-cc-ud-moved", "1"); bar.classList.add("cc-ud-moved");
    return wrap;
  }
  // The controls' card is headed like UD's three by a badge in a div.title, so their card and
  // badge rules in Disks.css and the badge painting draw it too. It stays the last card of the row.
  function ccUdPanel(row) {
    var p = row.querySelector(":scope > .cc-ud-panel");
    if (!p) {
      p = el("div", "cc-ud-panel");
      var b = el("span", "cc-b cc-ud-h");
      b.classList.toggle("cc-ink-dark", idealText(mainAccent()) !== "#fff");
      b.appendChild(el("span", "cc-b-v", "Unassigned Devices"));
      p.appendChild(el("div", "title")).appendChild(el("span", "left")).appendChild(b);
    }
    if (p !== row.lastElementChild) row.appendChild(p);
    return p;
  }
  function ccUdPanelDrop() {
    var p = document.querySelector("#displaybox .cc-ud-panel");
    if (p) p.parentNode.removeChild(p);
  }
  // Each control's name and (i) in the card, found by what the control is rather than by UD's
  // English tooltip; a control this list does not know is named by that tooltip.
  var UD_NAMES = [
    ["a[href*='UnassignedDevicesSettings']", "Unassigned-Devices-Einstellungen", "Unassigned Devices settings", "Öffnet die Einstellungsseite von Unassigned Devices.", "Opens the Unassigned Devices settings page."],
    ["a[onclick^='rescan_disks']", "Datenträger neu einlesen", "Refresh disks", "Sucht neu nach Datenträgern und lädt die Konfiguration von Unassigned Devices neu.", "Scans for disks again and reloads the Unassigned Devices configuration."],
    ["input.historical-switch", "Historische Geräte anzeigen", "Show historical devices", "Zeigt oder verbirgt die Karte mit den Geräten, die schon einmal angeschlossen waren.", "Shows or hides the card with the devices that were connected before."],
    ["input.shares-switch", "Freigaben anzeigen", "Show shares", "Zeigt oder verbirgt die Karte mit den Netzwerk- und ISO-Freigaben.", "Shows or hides the card with the network and ISO shares."],
    ["input.disks-switch", "Datenträger anzeigen", "Show disks", "Zeigt oder verbirgt die Karte mit den nicht zugewiesenen Datenträgern.", "Shows or hides the card with the unassigned disks."]
  ];
  function ccUdName(unit) {
    var de = LANG === "de";
    for (var i = 0; i < UD_NAMES.length; i++) {
      var n = UD_NAMES[i];
      if (unit.querySelector(n[0])) return { label: de ? n[1] : n[2], tip: de ? n[3] : n[4] };
    }
    var t = unit.querySelector("[title], [data-cc-tip]");
    var own = t && (t.getAttribute("title") || t.getAttribute("data-cc-tip"));
    return own ? { label: own, tip: "" } : null;
  }
  // A control's line is the largest box around it that holds no other control: UD boxes each one,
  // the switch's hidden input and labels included, in a div.right.ud.
  function ccUdLabels(wrap, on) {
    var ctrls = wrap.querySelectorAll("a.cc-ud-icon, .switch-button-background");
    for (var i = 0; i < ctrls.length; i++) {
      var unit = ctrls[i];
      while (unit.parentNode !== wrap && unit.parentNode.querySelectorAll("a.cc-ud-icon, .switch-button-background").length === 1) unit = unit.parentNode;
      if (unit === ctrls[i]) continue;
      var lbl = unit.querySelector(":scope > .cc-ud-lbl");
      if (!on) { if (lbl) unit.removeChild(lbl); unit.classList.remove("cc-ud-unit"); continue; }
      if (lbl) continue;
      var name = ccUdName(unit); if (!name) continue;
      lbl = el("span", "cc-ud-lbl");
      lbl.appendChild(el("span", null, name.label));
      if (name.tip) lbl.appendChild(ccInfoIcon(name.tip));
      unit.insertBefore(lbl, unit.firstChild); unit.classList.add("cc-ud-unit");
    }
  }
  // UD's loose text buttons float detached in the CC layout and duplicate the gear and refresh
  // icons, so they are hidden wherever they ended up.
  function ccUdLoose() {
    try {
      // The texts are UD's hover-reveal companions of the gear/refresh anchors and can carry an
      // icon child, so the scan matches any element in the UD scopes whose whole normalised text
      // equals a target, excluding the hosts of real controls.
      var scopes = document.querySelectorAll("#displaybox .cc-ud-ctrls, #displaybox div.title.ud, #displaybox [id*='unassigned' i]");
      for (var s0 = 0; s0 < scopes.length; s0++) {
        var cand = scopes[s0].querySelectorAll("*");
        for (var i = 0; i < cand.length; i++) {
          var e2 = cand[i];
          // The gear/refresh anchors contain their tooltip source span.help-content, so their own
          // textContent equals a target; stamping one would hide the icon. The icon and its
          // insides stay untouched, and a stamp already sitting on them is removed.
          if (e2.classList.contains("cc-ud-icon") || (e2.closest && e2.closest("a.cc-ud-icon"))) { e2.classList.remove("cc-ud-hidden"); continue; }
          if (e2.classList.contains("cc-ud-hidden") || e2.closest(".cc-ud-lbl")) continue;   // the controls card names its lines in the same words
          if (e2.querySelector(".switch-button-background, a.cc-ud-icon, input")) continue;   // never a container of real controls
          var t2 = ((e2.value || e2.textContent || "") + "").replace(new RegExp(String.fromCharCode(160), "g"), " ").replace(/\s+/g, " ").trim().toUpperCase();
          if (t2 === "UNASSIGNED DEVICES SETTINGS" || t2 === "REFRESH DISKS AND CONFIGURATION") e2.classList.add("cc-ud-hidden");
        }
      }
    } catch (e) {}
  }
  // Hover names for the UD controls in both homes, the native title bar and the relocated cluster.
  // Runs every pass, cheap and idempotent.
  function ccUdTitles() {
    try {
      var hosts = document.querySelectorAll("#displaybox .cc-ud-ctrls, #displaybox div.title.ud :is(span.right, div.right, span.right.ud, div.right.ud)");
      for (var h = 0; h < hosts.length; h++) {
        // When all three switchButtons share one wrapper, a wrapper-level title from the first
        // label wins every hover, so each track gets its own label's title and a multi-track
        // wrapper loses the bulk one. Stamped as data-cc-tip, which header.js renders as the
        // floating bubble; a title write would churn against ccTipSweep every pass.
        var trks = hosts[h].querySelectorAll(".switch-button-background");
        for (var t3 = 0; t3 < trks.length; t3++) {
          var trk = trks[t3], lb = trk.previousElementSibling, lbt = "";
          if (!(lb && lb.classList && lb.classList.contains("switch-button-label"))) lb = trk.nextElementSibling;
          if (lb && lb.classList && lb.classList.contains("switch-button-label")) lbt = (lb.textContent || "").trim();
          if (!lbt && trk.parentNode) { var pl = trk.parentNode.querySelector(".switch-button-label"); if (pl) lbt = (pl.textContent || "").trim(); }
          if (lbt && trk.getAttribute("data-cc-tip") !== lbt) trk.setAttribute("data-cc-tip", lbt);
        }
        var kids = hosts[h].children;
        for (var k = 0; k < kids.length; k++) {
          var kd = kids[k];
          if (kd.querySelectorAll && kd.querySelectorAll(".switch-button-background").length > 1) { kd.removeAttribute("title"); kd.removeAttribute("data-cc-tip"); continue; }   // a wrapper around several tracks carries no tip of its own
          if (kd.getAttribute("title") || kd.getAttribute("data-cc-tip")) continue;
          var lbl = kd.querySelector ? kd.querySelector(".switch-button-label") : null;
          if (lbl) { kd.setAttribute("data-cc-tip", (lbl.textContent || "").trim()); continue; }
          if (kd.tagName === "A") {
            var kcls = ((kd.querySelector("i, span") || {}).className || "") + " " + (kd.className || "");
            if (/gear|cog|setting/i.test(kcls)) kd.setAttribute("data-cc-tip", LANG === "de" ? "Unassigned-Devices-Einstellungen" : "Unassigned Devices settings");
            else if (/refresh|sync|rotate/i.test(kcls)) kd.setAttribute("data-cc-tip", LANG === "de" ? "Datenträger neu einlesen" : "Refresh disks");
          }
        }
        // The text that floats free on hover over gear/refresh is UD's own balloon machinery
        // reading the title attribute. Disable the balloon and keep the plain title.
        var bal = hosts[h].querySelectorAll("a");
        for (var b3 = 0; b3 < bal.length; b3++) {
          var ba = bal[b3];
          if (ba.getAttribute("data-cc-ud-ttoff")) continue;
          if (window.jQuery) {
            try { if (window.jQuery.fn.tooltipster) window.jQuery(ba).tooltipster("disable"); } catch (e3) {}
            try { if (window.jQuery.fn.tooltip) window.jQuery(ba).tooltip("destroy"); } catch (e4) {}
          }
          ba.classList.remove("tooltip");   // UD binds its balloon by this class
          ba.setAttribute("data-cc-ud-ttoff", "1");
        }
      }
    } catch (e) {}
  }
  function ccUdCtrlsHome() {
    try {
      var wrap = document.querySelector("#displaybox .cc-ud-ctrls[data-cc-ud-ctrls]"); if (!wrap) return;
      var bar = document.querySelector("#displaybox div.title[data-cc-ud-moved]");
      ccUdLabels(wrap, false);
      if (bar) { while (wrap.firstChild) bar.appendChild(wrap.firstChild); bar.removeAttribute("data-cc-ud-moved"); bar.classList.remove("cc-ud-moved"); }
      wrap.parentNode.removeChild(wrap);
      ccUdPanelDrop();
    } catch (e) {}
  }
  // Moves the native [title] balloons on /Main over to the floating CC bubble, which header.js
  // renders from [data-cc-tip] at body level, so no table or pill overflow can clip it. The nchan
  // refills recreate cells with fresh titles, so this runs every pass over the disk tables, the UD
  // block, the array-op panel, the toggles and the disk-state orbs; apply() restores the title
  // attributes on teardown. The UD gear balloon carries its content in a nested span.help-content
  // whose text becomes the tip, line-broken between rows.
  function ccHelpText(host) {
    var out = "";
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out += c.textContent; continue; }
        if (c.nodeType !== 1) continue;
        if (c.tagName === "BR") { out += "\n"; continue; }
        var blk = /^(DIV|P|LI|TR|UL|OL|DL|DT|DD|H[1-6]|TABLE)$/.test(c.tagName);
        if (blk && out && !/\n$/.test(out)) out += "\n";
        walk(c);
        if (blk && !/\n$/.test(out)) out += "\n";
      }
    })(host);
    return out.replace(new RegExp(String.fromCharCode(160), "g"), " ").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n+/g, "\n").trim();
  }
  function ccTipSweep() {
    try {
      if (!onMain()) return;
      var box = document.getElementById("displaybox"); if (!box) return;
      // Balloon-content anchors such as the UD gear: fold the nested span.help-content text into
      // the tip once per anchor. The attribute rides along when ccUdCtrlsMove relocates the node.
      var helps = box.querySelectorAll("a:not([data-cc-help]) > span.help-content");
      for (var h2 = 0; h2 < helps.length; h2++) {
        var ha = helps[h2].parentNode, ht2 = ccHelpText(helps[h2]);
        ha.setAttribute("data-cc-help", "1");
        if (ht2 && ha.getAttribute("data-cc-tip") !== ht2) ha.setAttribute("data-cc-tip", ht2);
        ha.removeAttribute("title");
      }
      // The disk-state orbs and the error info icons are a.info CSS tooltips with no title at all:
      // the balloon is a nested <span> that default-base.css reveals on :hover. Folding its text
      // into data-cc-tip also keys the Shares.css rule that hides the native box, so teardown
      // reverts it. Only disk_status and the UD tables; array_status stays with ccFoldDesc.
      var infos = box.querySelectorAll("table.unraid.disk_status a.info, :is(table.usb_mounts, table.samba_mounts, table.usb_absent) a.info");
      for (var n2 = 0; n2 < infos.length; n2++) {
        var ia = infos[n2], sp2 = ia.querySelector(":scope > span"); if (!sp2) continue;
        var it2 = ccHelpText(sp2); if (!it2) continue;
        if (ia.getAttribute("data-cc-tip") !== it2) ia.setAttribute("data-cc-tip", it2);
        ia.removeAttribute("title");
      }
      // Every remaining native title in the enhanced area. A fresh node from a refill carries no
      // data-cc-tip, so its title wins; an element that already has a tip only loses the stale
      // title, which keeps this from churning against the direct stamps above.
      var tips = box.querySelectorAll("[title]");
      for (var i2 = 0; i2 < tips.length; i2++) {
        var te2 = tips[i2], tv2 = te2.getAttribute("title");
        te2.removeAttribute("title");
        if (tv2 && tv2.replace(/\s+/g, "") && !te2.getAttribute("data-cc-tip")) te2.setAttribute("data-cc-tip", tv2);
      }
    } catch (e) {}
  }
  function enhanceMain() {
    try {
      if (g("cc.enable.main", "0") === "0") return;
      if (!onMain()) return;
      var box = document.getElementById("displaybox");
      // ccDiskioHome and ccUdCtrlsHome run before flattenTeardown, which deletes every
      // .cc-card-head including the ones hosting the relocated controls.
      if (box) { if (g("cc.sections.main", "0") !== "0") { cardPanels(box); ccDiskioMove(box); } else { ccDiskioHome(); ccUdCtrlsHome(); flattenTeardown(); } }
      // The reads/writes toggle loses its tooltipster balloon in both tab modes; ccDiskioMove runs
      // in sections mode only, so in native-tabs mode the bar would keep the black balloon.
      var dio = document.querySelector("#displaybox span.status a.tooltip_diskio");
      if (dio && dio.closest) { var dst = dio.closest("span.status"); if (dst) ccDiskioTip(dst); }
      var tbs = document.querySelectorAll("#displaybox table.unraid.disk_status");
      for (var i = 0; i < tbs.length; i++) {
        enhanceMainHead(tbs[i]);
        ccMainCols.grips(tbs[i]);   // after the Browse header insert
        var rows = tbs[i].querySelectorAll("tbody > tr");
        for (var r = 0; r < rows.length; r++) enhanceMainRow(rows[r]);
      }
      ccMainCols.apply();
      ccMainCols.resetBtn();
      ccMarqResume();   // pick a running ident marquee back up across the tbody refill
      ccIdentMarq();
      if (box) enhanceArrayOps(box);
      ccLocalizeMain();
      enhanceUD();   // after ccLocalizeMain: the heading split consumes the already translated text
      ccUdLoose();
      ccUdTitles();
      ccMutedEmpties();   // after the badge passes
      ccTipSweep();   // last: the refills keep bringing native titles back
    } catch (e) {}
  }
  // The /Main "Array-Vorgang" table (ArrayOperation.page) puts each control in
  // <tr><td>[status]</td><td>[button]</td><td>[description]</td></tr>, with separator rows carrying
  // a td.line. The description becomes a .cc-info bubble in the button cell. A mixed cell (Check
  // carries prose plus a Schedule link, a checkbox and its label; Reboot and Shutdown carry prose
  // plus the safemode label; Mover's #mover-text is filled asynchronously; Sleep carries prose plus
  // a wiki link) folds its prose nodes only, so every control and a checkbox's trailing label stay
  // inline and live. data-cc-aop is set at the end rather than on the first pass, so the async
  // #mover-text refolds on the observer tick. aopTeardown reverses all of it.
  function svgEl(tag, attrs) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]); return n; }
  // The plugin has one (i) glyph, shared through cc-theme.js; this is the fallback for a page that
  // loads without it.
  function ccInfoIcon(tip) {
    if (window.CCTheme && window.CCTheme.infoIcon) return window.CCTheme.infoIcon(tip);
    var s = el("span", "cc-info"); s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); s.setAttribute("tabindex", "0");
    var svg = svgEl("svg", { viewBox: "0 0 16 16", width: "15", height: "15", fill: "none", "aria-hidden": "true" });
    svg.appendChild(svgEl("circle", { cx: "8", cy: "8", r: "7", stroke: "currentColor", "stroke-width": "1.3" }));
    svg.appendChild(svgEl("circle", { cx: "8", cy: "4.6", r: "0.9", fill: "currentColor" }));
    svg.appendChild(svgEl("path", { d: "M8 7v4.4", stroke: "currentColor", "stroke-width": "1.3", "stroke-linecap": "round" }));
    s.appendChild(svg); return s;
  }
  function ccIsCtrl(n) { if (n.nodeType !== 1) return false; var t = n.tagName; return t === "INPUT" || t === "SELECT" || t === "A" || t === "LABEL" || t === "BUTTON"; }
  // True when n labels an immediately preceding checkbox, skipping whitespace and <br>.
  function ccPrevIsCheckbox(n) {
    var p = n.previousSibling;
    while (p) {
      if (p.nodeType === 1) { if (p.tagName === "INPUT") return /checkbox/i.test(p.getAttribute("type") || ""); if (p.tagName === "BR") { p = p.previousSibling; continue; } return false; }
      if (p.nodeType === 3) { if (p.textContent.trim()) return false; p = p.previousSibling; continue; }
      return false;
    }
    return false;
  }
  // Folds the prose of a mixed description cell into the bubble text, hiding each prose node in
  // place while the interactive controls stay visible. An already hidden node is only re-counted
  // for the tip, never re-wrapped, so a refill of #mover-text refolds without an observer loop.
  function ccFoldDesc(cell) {
    var tip = "", segs = [""], nodes = Array.prototype.slice.call(cell.childNodes);
    function flush() { if (segs[segs.length - 1]) segs.push(""); }
    function add(s) { if (s) { tip += (tip ? " " : "") + s; segs[segs.length - 1] += (segs[segs.length - 1] ? " " : "") + s; } }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      // A <br> is a segment boundary, since a pair row's description is one sentence per <br>.
      // Checked before the hidden-node branch so an already hidden <br> still flushes on a refold.
      if (n.nodeType === 1 && n.tagName === "BR") { flush(); n.classList.add("cc-aop-hide"); continue; }
      // A link that does not point at the Scheduler (the s3-sleep wiki, registration hrefs) is
      // prose and falls through to the generic element branch. Scheduler links, href-less a.info
      // wrappers and anchors around controls (confirmFormat sits inside one) count as controls.
      var foldA = n.nodeType === 1 && n.tagName === "A" && (n.getAttribute("href") || "") !== "" &&
                  (n.getAttribute("href") || "").indexOf("/Main/Settings/Scheduler") === -1 &&
                  !n.querySelector("input, select, button");
      if (ccIsCtrl(n) && !foldA) continue;
      if (n.nodeType === 1 && (n.tagName === "SMALL" || n.tagName === "SPAN") && ccPrevIsCheckbox(n)) continue;
      if (n.nodeType === 3 && ccPrevIsCheckbox(n)) continue;
      if (n.nodeType === 1 && n.classList.contains("cc-aop-hide")) { add((n.textContent || "").replace(/\s+/g, " ").trim()); continue; }
      var s = (n.textContent || "").replace(/\s+/g, " ").trim();
      add(s);
      if (n.nodeType === 1) { n.classList.add("cc-aop-hide"); }
      else if (s) { var w = el("span", "cc-aop-hide"); w.setAttribute("data-cc-aop-w", "1"); n.parentNode.insertBefore(w, n); w.appendChild(n); }   // a bare prose text node needs a wrapper to hide
    }
    if (!segs[segs.length - 1]) segs.pop();
    var out = [];
    for (var g0 = 0; g0 < segs.length; g0++) { var t2 = segs[g0].replace(/\s+/g, " ").trim(); if (t2) out.push(t2); }
    return { tip: tip.replace(/\s+/g, " ").trim(), segs: out };
  }
  function enhanceArrayOpRow(tr) {
    if (tr.querySelector(":scope > td.line")) { tr.setAttribute("data-cc-aop", "1"); return; }   // separator row, collapsed by CSS
    var tds = tr.children; if (tds.length < 3) return;
    var btnCell = tds[1], descCell = tds[2];
    if (!btnCell.querySelector("input, button, a")) return;
    // Every description cell folds in place, pure text included: hiding the whole <td> drops the
    // third column from the spin and keyfile tables and rescales the native 33/22 percent columns.
    var fresh = !descCell.querySelector(".cc-aop-hide");   // first pass, or a cell #mover-text rewrote
    var fold = ccFoldDesc(descCell), tip = mtText(fold.tip);   // translated before the data-tip compare, so refolds stay churn-free
    // Scheduler links move into the button cell beside the bubble. Stale moved badges are purged
    // only on a freshly written cell that carries prose or links, so a link-only cell is not purged
    // without a replacement. Once moved, descCell has no a[href] left and the next tick no-ops.
    var links = descCell.querySelectorAll('a[href*="/Main/Settings/Scheduler"]');   // the s3-sleep wiki anchor stays inside its folded prose
    if (fresh && (tip || links.length)) {
      var stale = btnCell.querySelectorAll(":scope > a.cc-aop-link");
      for (var s0 = 0; s0 < stale.length; s0++) stale[s0].parentNode.removeChild(stale[s0]);
    }
    // A pair row holds several buttons in span.buttons-spaced and gets one .cc-aop-brow per button,
    // each with its own sentence bubble. Sentence i maps to native button i in DOM order, matched
    // by the ids and names from ArrayOperation.page, so the mapping is language-independent and
    // survives FireSquire injecting its button between reboot and shutdown. A foreign button gets a
    // brow but no bubble, and leftover segments join the last native tip.
    var span0 = btnCell.querySelector(":scope > span.buttons-spaced");
    var pair = span0 ? span0.querySelectorAll('input[type="button"], input[type="submit"], button:not([role="tab"]), a.button') : [];
    if (span0 && pair.length > 1) {
      var KID = ["spinup-button", "spindown-button", "pauseButton", "cancelButton"], KNM = ["reboot", "shutdown"], natives = [];
      for (var p0 = 0; p0 < pair.length; p0++) { var pb = pair[p0]; if (KID.indexOf(pb.id) > -1 || KNM.indexOf((pb.getAttribute("name") || "").toLowerCase()) > -1) natives.push(pb); }
      if (!natives.length) natives = Array.prototype.slice.call(pair);   // an unknown pair row maps DOM order to segment order
      for (var p1 = 0; p1 < pair.length; p1++) {
        // A brow belongs to its first button. FireSquire injects itself with reboot.after() after
        // this wrap has run, so it lands inside the reboot brow and would sit side by side with it;
        // such a stowaway gets its own brow right after the host brow.
        var bt2 = pair[p1], pn2 = bt2.parentNode, brow = null;
        if (pn2 && pn2.classList && pn2.classList.contains("cc-aop-brow")) {
          if (pn2.querySelector('input[type="button"], input[type="submit"], button:not([role="tab"]), a.button') === bt2) brow = pn2;
          else { brow = el("span", "cc-aop-brow"); brow.setAttribute("data-cc-aop-brw", "1"); pn2.parentNode.insertBefore(brow, pn2.nextSibling); brow.appendChild(bt2); }
        } else { brow = el("span", "cc-aop-brow"); brow.setAttribute("data-cc-aop-brw", "1"); pn2.insertBefore(brow, bt2); brow.appendChild(bt2); }
        var ni = natives.indexOf(bt2), st = "";
        if (ni > -1) {
          st = mtText(fold.segs[ni] || "");
          if (ni === natives.length - 1) for (var p2 = natives.length; p2 < fold.segs.length; p2++) st += (st ? " " : "") + mtText(fold.segs[p2]);
        }
        var bub = brow.querySelector(":scope > .cc-info");
        if (st) { if (bub) { if (bub.getAttribute("data-tip") !== st) { bub.setAttribute("data-tip", st); bub.setAttribute("aria-label", st); } } else brow.appendChild(ccInfoIcon(st)); }
        else if (bub) bub.parentNode.removeChild(bub);
      }
      var solo = btnCell.querySelector(":scope > .cc-info");   // a pair row has no single centred bubble
      if (solo) solo.parentNode.removeChild(solo);
    } else {
      var info = btnCell.querySelector(":scope > .cc-info");
      if (tip) {
        if (info) { if (info.getAttribute("data-tip") !== tip) { info.setAttribute("data-tip", tip); info.setAttribute("aria-label", tip); } }
        else btnCell.appendChild(ccInfoIcon(tip));                                      // a single-button row keeps the bubble after the button
      }
    }
    for (var l0 = 0; l0 < links.length; l0++) {
      var lk = links[l0];
      if (!lk.classList.contains("cc-aop-link")) {
        lk.classList.add("cc-aop-link"); lk.setAttribute("data-cc-aop-moved", "1");
        var lt = (lk.textContent || "").trim(), m0 = /^\((.+)\)$/.exec(lt);
        if (m0) { lk.setAttribute("data-cc-aop-orig", lt); lk.textContent = mt(m0[1]) || m0[1]; }   // strip the brackets and translate what the pack left English
      }
      btnCell.appendChild(lk);                                                        // after the bubble, as a badge beside it
    }
    // The optionCorrect and safemode checkboxes move into the button cell behind the bubble and the
    // badge. They are moved, never cloned, because the POST and shutdown_now() find them by name.
    // Both native markups occur: a <label> wrapping the input, and a bare input with a following
    // <small>. data-cc-aop-tg marks what aopTeardown undoes.
    var cb0 = descCell.querySelector('input[type="checkbox"][name="optionCorrect"], input[type="checkbox"][name="safemode"]');
    if (cb0 && !btnCell.querySelector(".cc-aop-toggle")) {
      // safemode rides on the reboot button's brow where a pair row has one; an optionCorrect row
      // has a single button and keeps the plain button cell.
      var rbIn = btnCell.querySelector('input[name="reboot"]');
      var rbBrow = rbIn && rbIn.parentNode && rbIn.parentNode.classList.contains("cc-aop-brow") ? rbIn.parentNode : null;
      var unit = cb0.closest("label");
      if (unit && descCell.contains(unit)) {
        unit.classList.add("cc-aop-toggle"); unit.setAttribute("data-cc-aop-tg", "1");
        (rbBrow || btnCell).appendChild(unit);
      } else {
        var lab0 = cb0.nextSibling;
        while (lab0 && lab0.nodeType === 3 && !lab0.textContent.trim()) lab0 = lab0.nextSibling;   // skip whitespace
        var w1 = el("label", "cc-aop-toggle"); w1.setAttribute("data-cc-aop-tg", "1"); w1.setAttribute("data-cc-aop-tgw", "1");
        w1.appendChild(cb0);
        if (lab0 && (lab0.nodeType === 3 || lab0.tagName === "SMALL" || lab0.tagName === "SPAN")) w1.appendChild(lab0);
        (rbBrow || btnCell).appendChild(w1);
      }
    }
    tr.setAttribute("data-cc-aop", "1");
  }
  // The array-state and parity status cells become large badges coloured by status. The colour
  // sources are language-independent: the native orb class in the cell (green for running, yellow
  // for unprotected, grey for stopped), and for the icon-less parity cell its row's controls
  // (input[name=cmdCheck] is the parity-valid branch, the pause/cancel pair means a check is
  // running). A cell that is neither, such as the unmountable-disks list, stays native. The orb's
  // a.info tooltip moves into the pill and stays live.
  function aopStatusBadge(tr) {
    var td = tr.children[0]; if (!td || td.classList.contains("cc-aop-st")) return;
    if (td.querySelector(".cc-b")) return;
    var orb = td.querySelector("a.info i.orb");
    var isCheck = !!tr.querySelector('input[name="cmdCheck"]');
    var isRun = !!tr.querySelector("#pauseButton, #cancelButton");
    if (!orb && !isCheck && !isRun) return;
    var txt = (td.textContent || "").replace(/\s+/g, " ").trim(); if (!txt) return;   // the Read-Check and Sync branches leave it empty
    var cls = orb ? (orb.classList.contains("green-orb") ? "cc-aop-ok" : orb.classList.contains("yellow-orb") ? "cc-aop-warn" : "cc-aop-off")
                  : (isRun ? "cc-aop-warn" : "cc-aop-ok");
    var b = el("span", "cc-b cc-aop-status " + cls), v = el("span", "cc-b-v");
    while (td.firstChild) v.appendChild(td.firstChild);
    b.appendChild(v); td.appendChild(b); td.classList.add("cc-aop-st");
  }
  // The parity-check progress gets its own card right of the button column. It mirrors rather than
  // moves, because Unraid re-renders those rows on every parity tick. The native rows stay in place
  // and keep updating behind a CSS hide, and the card holds synced text copies written only on a
  // change, so the observer sees no churn. The card retires when the check ends.
  function ccAopParityCard(box) {
    try {
      var lines = box.querySelectorAll("table.array_status td[id^='line']");
      var card = box.querySelector(".cc-aop-pcard");
      if (!lines.length) { if (card) card.parentNode.removeChild(card); ccAopParityRing(box, null); return; }
      if (!card) { card = el("div", "cc-aop-pcard"); var sec = lines[0].closest("section") || box; sec.appendChild(card); }
      // The top edge sits flush with the first button row, which a fixed CSS offset cannot do
      // because the badge row above varies in height. The card is out of flow, so measuring the
      // first array-op table here cannot feed back into layout.
      if (window.getComputedStyle(card).position === "absolute") {
        var csec = card.parentNode, fb = csec.querySelector("table.array_status input[type='button'], table.array_status input[type='submit'], table.array_status button, table.array_status a.button");
        if (fb) {
          var off = Math.round(fb.getBoundingClientRect().top - csec.getBoundingClientRect().top);   // the first button is the array stop, disabled or not
          if (off > 0 && Math.abs((parseInt(card.style.top, 10) || 0) - off) > 1) card.style.top = off + "px";
        }
      }
      var rowsBox = card.querySelector(":scope > .cc-aop-rows"), pbx = card.querySelector(":scope > .cc-aop-pbar");
      if (!rowsBox || !pbx || pbx.previousElementSibling !== rowsBox) {   // build the card shell: rows on top, progress bar below
        card.textContent = "";
        rowsBox = el("div", "cc-aop-rows");
        card.appendChild(rowsBox);
        var bar = el("div", "cc-aop-pbar");
        bar.appendChild(el("span", "cc-aop-pfill"));
        bar.appendChild(el("span", "cc-aop-plab"));
        card.appendChild(bar);
      }
      var n = 0;
      for (var i = 0; i < lines.length; i++) {
        var tr = lines[i].closest("tr"); if (!tr) continue;
        var lab = tr.cells && tr.cells[0] ? (tr.cells[0].textContent || "").trim() : "";
        var val = (lines[i].textContent || "").trim();
        var row = rowsBox.children[n];
        if (!row) { row = el("div", "cc-aop-prow"); row.appendChild(el("span", "cc-aop-pl")); row.appendChild(el("span", "cc-aop-pv")); rowsBox.appendChild(row); }
        if (row.firstChild.textContent !== lab) row.firstChild.textContent = lab;
        if (row.lastChild.textContent !== val) row.lastChild.textContent = val;
        n++;
      }
      while (rowsBox.children.length > n) rowsBox.removeChild(rowsBox.lastChild);
      // The percentage rides inside the current-position value, such as "585 GB (3.3 %)", and is
      // parsed language-independently with either decimal separator.
      var pct = null;
      for (var j = 0; j < lines.length; j++) { var m = /\(([\d.,]+)\s*%\s*\)/.exec(lines[j].textContent || ""); if (m) { pct = parseFloat(m[1].replace(",", ".")); break; } }
      var pb = card.querySelector(":scope > .cc-aop-pbar");
      if (pb) {
        if (pct == null || !(pct >= 0)) { if (pb.style.display !== "none") pb.style.display = "none"; }
        else {
          if (pb.style.display !== "") pb.style.display = "";
          var fl = pb.querySelector(".cc-aop-pfill"), pl2 = pb.querySelector(".cc-aop-plab");
          var wv = Math.min(100, Math.max(0, pct)) + "%";
          if (fl && fl.style.width !== wv) fl.style.width = wv;
          var lt = (Math.round(pct * 10) / 10) + " %";
          if (pl2 && pl2.textContent !== lt) pl2.textContent = lt;
        }
      }
      ccAopParityRing(box, pct);
    } catch (e) {}
  }
  // While a check runs, its status chip carries a progress ring with the share done (GlimStone: "a
  // status ring becomes a progress ring while work runs"), and loses it when the check ends. The
  // running check's row is the one with Unraid's pause button; its chip may have moved to the stack.
  function ccAopParityRing(box, pct) {
    var run = box.querySelector("table.array_status #pauseButton");
    var home = run && run.closest("tr") ? run.closest("tr").children[0] : null;
    var ref = home && home.getAttribute("data-cc-aop-pillhome");
    var pill = ref ? box.querySelector('.cc-aop-status[data-cc-aop-pillref="' + ref + '"]') : home && home.querySelector(".cc-aop-status");
    if (pct == null || !window.CCPictures) pill = null;
    var ringed = box.querySelectorAll(".cc-aop-status.cc-aop-ringed");
    for (var i = 0; i < ringed.length; i++) {
      if (ringed[i] === pill) continue;
      if (ringed[i].__ccRing && ringed[i].__ccRing.el.parentNode) ringed[i].__ccRing.el.parentNode.removeChild(ringed[i].__ccRing.el);
      ringed[i].__ccRing = null; ringed[i].classList.remove("cc-aop-ringed");
    }
    if (!pill) return;
    if (!pill.__ccRing) {
      pill.__ccRing = window.CCPictures.ring((pill.textContent || "").trim());
      pill.insertBefore(pill.__ccRing.el, pill.firstChild);
      pill.classList.add("cc-aop-ringed");
    }
    pill.__ccRing.set(pct / 100);
  }
  // The status pills leave their grid rows for a tight stack of their own, so their spacing matches
  // the button gap instead of the row heights. Each pill remembers its home cell, so aopTeardown
  // can hand it back before unwrapping.
  var ccPillSeq = 0;
  function ccAopPillStack(box) {
    try {
      var pills = box.querySelectorAll("table.array_status td.cc-aop-st > .cc-b.cc-aop-status");
      // /Main carries several array_status tables, so anchor on the pills' own one, and insert at
      // the section's direct child: the table sits inside a form, where inserting before it throws
      // NotFoundError.
      var pt = pills.length ? pills[0].closest("table") : box.querySelector("table.array_status");
      if (!pt) return;
      var sec = pt.closest("section") || box;
      var stack = sec.querySelector(".cc-aop-pills");
      if (pills.length && !stack) {
        stack = el("div", "cc-aop-pills");
        var anch = pt; while (anch.parentElement && anch.parentElement !== sec) anch = anch.parentElement;
        sec.insertBefore(stack, anch);
      }
      if (!stack) return;
      // nchan rebuilds the rows, and a rebuilt td gets a fresh pill, so drop the stack pills whose
      // home cell is gone before adopting the current set.
      var olds = stack.querySelectorAll(".cc-b.cc-aop-status[data-cc-aop-pillref]");
      for (var k = 0; k < olds.length; k++) {
        var rf = olds[k].getAttribute("data-cc-aop-pillref");
        if (!box.querySelector('table.array_status td[data-cc-aop-pillhome="' + rf + '"]')) stack.removeChild(olds[k]);
      }
      for (var i = 0; i < pills.length; i++) {
        var home = pills[i].parentNode;
        if (!home.getAttribute("data-cc-aop-pillhome")) home.setAttribute("data-cc-aop-pillhome", String(++ccPillSeq));
        pills[i].setAttribute("data-cc-aop-pillref", home.getAttribute("data-cc-aop-pillhome"));
        stack.appendChild(pills[i]);
      }
      // top edge at the first button, measured as in the parity card
      if (window.getComputedStyle(stack).position === "absolute") {
        var fb2 = pt.querySelector("input[type='button'], input[type='submit'], button, a.button");
        if (fb2) {
          var off2 = Math.round(fb2.getBoundingClientRect().top - sec.getBoundingClientRect().top);
          if (off2 > 0 && Math.abs((parseInt(stack.style.top, 10) || 0) - off2) > 1) stack.style.top = off2 + "px";
        }
      }
    } catch (e) {}
  }
  function enhanceArrayOps(box) {
    try {
      var tables = box.querySelectorAll("table.array_status");
      for (var i = 0; i < tables.length; i++) { var rows = tables[i].rows; for (var r = 0; r < rows.length; r++) { aopStatusBadge(rows[r]); enhanceArrayOpRow(rows[r]); } }
      ccAopPillStack(box);    // after badging, so there are pills to stack
      ccAopParityCard(box);
    } catch (e) {}
  }
  function aopTeardown() {
    try {
      var pc = document.querySelector("#displaybox .cc-aop-pcard"); if (pc) pc.parentNode.removeChild(pc);   // a pure mirror, and the rows unhide with the class
      var dsp = document.getElementById("displaybox"); if (dsp) ccAopParityRing(dsp, null);
      var infos = document.querySelectorAll("#displaybox table.array_status .cc-info");
      for (var i = 0; i < infos.length; i++) infos[i].parentNode.removeChild(infos[i]);
      // moved link badges back into their row's description cell, with the bracketed text restored
      var mvd = document.querySelectorAll("#displaybox table.array_status a.cc-aop-link[data-cc-aop-moved]");
      for (var v = 0; v < mvd.length; v++) {
        var a2 = mvd[v], row2 = a2.closest("tr"), home = row2 && row2.children[2];
        var o2 = a2.getAttribute("data-cc-aop-orig"); if (o2) a2.textContent = o2;
        a2.classList.remove("cc-aop-link"); a2.removeAttribute("data-cc-aop-moved"); a2.removeAttribute("data-cc-aop-orig");
        if (home) home.appendChild(a2);
      }
      // relocated optionCorrect and safemode toggles back into their row's description cell
      var tgs = document.querySelectorAll("#displaybox table.array_status .cc-aop-toggle[data-cc-aop-tg]");
      for (var g2 = 0; g2 < tgs.length; g2++) {
        var tg = tgs[g2], rw = tg.closest("tr"), hm = rw && rw.children[2];
        if (!hm) continue;
        if (tg.getAttribute("data-cc-aop-tgw") === "1") { while (tg.firstChild) hm.appendChild(tg.firstChild); tg.parentNode.removeChild(tg); }
        else { tg.classList.remove("cc-aop-toggle"); tg.removeAttribute("data-cc-aop-tg"); hm.appendChild(tg); }
      }
      // Unwrap the per-button rows. The bubbles and the safemode toggle have left them in the two
      // loops above, so this order is the only safe one.
      var brs = document.querySelectorAll('#displaybox table.array_status span.cc-aop-brow[data-cc-aop-brw]');
      for (var b3 = 0; b3 < brs.length; b3++) ccUnwrap(brs[b3]);
      var descs = document.querySelectorAll("#displaybox table.array_status td.cc-aop-desc");
      for (var d = 0; d < descs.length; d++) descs[d].classList.remove("cc-aop-desc");
      // unfold the mixed-cell prose: unwrap the text-node wrappers, strip the hide class elsewhere
      var hid = document.querySelectorAll("#displaybox table.array_status .cc-aop-hide");
      for (var h = 0; h < hid.length; h++) { var n = hid[h]; if (n.tagName === "SPAN" && n.getAttribute("data-cc-aop-w") === "1") ccUnwrap(n); else n.classList.remove("cc-aop-hide"); }
      // stacked pills back into their home cells first, since the stack holds the live nodes
      var pstack = document.querySelector("#displaybox .cc-aop-pills");
      if (pstack) {
        var spb = pstack.querySelectorAll(".cc-b.cc-aop-status[data-cc-aop-pillref]");
        for (var sp3 = 0; sp3 < spb.length; sp3++) {
          var ref3 = spb[sp3].getAttribute("data-cc-aop-pillref");
          var home3 = document.querySelector('#displaybox table.array_status td[data-cc-aop-pillhome="' + ref3 + '"]');
          if (home3) home3.appendChild(spb[sp3]);
        }
        pstack.parentNode.removeChild(pstack);
      }
      // unbadge the state and parity pills; their children move back into the cell
      var stb = document.querySelectorAll("#displaybox table.array_status td.cc-aop-st");
      for (var s = 0; s < stb.length; s++) {
        var bb = stb[s].querySelector(":scope > .cc-b.cc-aop-status");
        if (bb) { var vv = bb.querySelector(":scope > .cc-b-v"); if (vv) ccUnwrap(vv); ccUnwrap(bb); }
        stb[s].classList.remove("cc-aop-st"); stb[s].removeAttribute("data-cc-aop-pillhome");
      }
      var marked = document.querySelectorAll("#displaybox table.array_status tr[data-cc-aop]");
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-aop");
    } catch (e) {}
  }
  // In tabbed mode ArrayOperation.page appends span.status with the diskio toggle into nav.tabs,
  // which CC's sections mode collapses, so the whole span moves into the first .cc-card-head as one
  // unit and keeps toggle_diskio() and tooltipster bound. ccDiskioHome has to run before any
  // teardown that deletes .cc-card-head, or the native control goes with it. The marker is
  // data-cc-dio-moved rather than data-cc-moved, which statsControlsTeardown queries.
  function ccDiskioMove(box) {
    try {
      var st = box.querySelector("nav.tabs span.status"); if (!st || !st.querySelector("a.tooltip_diskio")) return;
      var head = box.querySelector('section[data-cc-card] .cc-card-head'); if (!head) return;
      head.appendChild(st); st.setAttribute("data-cc-dio-moved", "1");
      ccDiskioTip(st);
    } catch (e) {}
  }
  // tooltipster consumes the title attribute at init, and ArrayOperation.page's inline script runs
  // at parse time, before this deferred one, so stripping the title alone leaves the black balloon.
  // Read the stored content and disable the instance, which 'enable' reverses.
  function ccDiskioTip(st) {
    try {
      var a = st.querySelector("a.tooltip_diskio"); if (!a || a.getAttribute("data-cc-dio-tip")) return;
      var tip = a.getAttribute("title") || "";                              // the fallback before tooltipster ran
      if (window.jQuery && window.jQuery.fn.tooltipster) {
        try { var c = window.jQuery(a).tooltipster("content"); if (c && typeof c === "string") tip = c; window.jQuery(a).tooltipster("disable"); } catch (e2) {}
      }
      if (a.hasAttribute("title")) a.setAttribute("data-cc-tip-orig", a.getAttribute("title"));
      if (!tip) tip = "Toggle reads/writes display";
      // The translated tip becomes a plain title tooltip on the toggle itself, with no bubble;
      // tooltipster stays disabled.
      a.setAttribute("title", mtText(tip));
      var oldIc = st.querySelector(":scope > .cc-info"); if (oldIc) oldIc.remove();
      a.setAttribute("data-cc-dio-tip", "1");
    } catch (e) {}
  }
  function ccDiskioHome() {
    try {
      var st = document.querySelector("#displaybox .cc-card-head span.status[data-cc-dio-moved]"); if (!st) return;
      var ic = st.querySelector(":scope > .cc-info"); if (ic) st.removeChild(ic);
      var a = st.querySelector("a.tooltip_diskio");
      if (a) {
        var o = a.getAttribute("data-cc-tip-orig"); if (o) { a.setAttribute("title", o); a.removeAttribute("data-cc-tip-orig"); }
        if (window.jQuery && window.jQuery.fn.tooltipster) { try { window.jQuery(a).tooltipster("enable"); } catch (e2) {} }
        a.removeAttribute("data-cc-dio-tip");
      }
      var tabs = document.querySelector("#displaybox nav.tabs");
      if (tabs) tabs.appendChild(st);
      st.removeAttribute("data-cc-dio-moved");
    } catch (e) {}
  }
  // Unassigned Devices is a third-party plugin, so its DOM is described here rather than assumed:
  // div.title.ud > span.left holds one slash-joined heading text beside five span.right.ud (the
  // gear and refresh anchors plus three toggle spans with an empty a.tooltip); .show-disks,
  // .show-shares and .show-historical each hold a div.title.shift > span.left with an icon and
  // text; the usb_mounts, samba_mounts and usb_absent tables have their tbody replaced every three
  // seconds by UD's refreshPage(). The headings are static markup and hold no listeners, so they
  // split once, with data-cc-ud-orig keeping the original for teardown. The split reads the current
  // text, so it works after ccLocalizeMain() has translated it.
  function ccUdSplitHeading(host) {
    if (!host || host.getAttribute("data-cc-ud")) return;
    var kids = Array.prototype.slice.call(host.childNodes), parts = [], cur = null;
    function flush(img) { cur = { img: img || null, txt: "" }; parts.push(cur); }
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 1 && n.tagName === "IMG") { flush(n); continue; }
      if (n.nodeType !== 3) continue;
      var segs = n.textContent.split(/[\/|]/);   // the top bar joins with "/", the SMB line with "|"
      for (var s = 0; s < segs.length; s++) {
        var txt = segs[s].replace(/ /g, " ").trim();
        if (s > 0) flush(null);
        if (!txt) continue;
        if (!cur) flush(null);
        cur.txt += (cur.txt ? " " : "") + txt;
      }
    }
    if (!parts.length) return;
    host.setAttribute("data-cc-ud-orig", host.innerHTML);   // snapshot before clearing
    host.setAttribute("data-cc-ud", "1");
    host.textContent = "";
    var inkDark = idealText(mainAccent()) !== "#fff";   // the ink the img monochrome filter uses
    for (var p = 0; p < parts.length; p++) {
      if (!parts[p].txt && !parts[p].img) continue;
      var b = el("span", "cc-b cc-ud-h");
      b.classList.toggle("cc-ink-dark", inkDark);
      if (parts[p].img) b.appendChild(parts[p].img);
      if (parts[p].txt) { var sg = parts[p].txt; sg = mt(sg) || sg; b.appendChild(el("span", "cc-b-v", sg)); }   // a segment already translated misses the map and stays
      host.appendChild(b);
    }
  }
  // A UD value cell becomes a badge. Beyond mainBadgeCell's guards it skips the mount and remove
  // controls, td.mount and the settings-gear cell, whose hidden span.help-title text would
  // otherwise leak into a pill.
  function ccUdBadgeCell(td) {
    if (!td || td.classList.contains("cc-bcell")) return;
    if (td.hasAttribute("colspan") || td.classList.contains("mount")) return;
    // The action cells are icon buttons dressed by CSS, not text badges. The remove X is a filled
    // tile of its own, so a badge around it would hide it.
    if (td.querySelector(".usage-disk, button, select, input, i.fa-gears, i.fa-remove, i.fa-times, i.fa-trash, i.fa-trash-o, i.fa-ban")) return;
    if (td.querySelector("a.cc-b-name")) return;
    var txt = (td.textContent || "").trim(); if (txt === "" || txt === "-" || txt === "*") return;
    var b = el("span", "cc-b"), v = el("span", "cc-b-v");
    while (td.firstChild) v.appendChild(td.firstChild);   // moved, not cloned, so the disklog icon and the links stay live
    b.appendChild(v); td.appendChild(b); td.classList.add("cc-bcell");
    // The wrapped value badge is centred, so its column header is centred too instead of keeping
    // the native right alignment. Done per column, since which UD columns exist varies.
    try {
      var ci = [].indexOf.call(td.parentNode.children, td), tbl = td.closest("table"), hr = tbl && tbl.querySelector("thead tr"), h = hr && hr.children[ci];
      if (h && !h.hasAttribute("data-cc-udth")) { h.setAttribute("data-cc-udth", "1"); h.style.textAlign = "center"; }
    } catch (e) {}
  }
  function enhanceUD() {
    try {
      if (!onMain()) return;
      // The top UD bar heading is hidden by CSS, since the sections below repeat it. Only the
      // sub-section heads split into badges.
      var heads = Array.prototype.slice.call(document.querySelectorAll(
        "#displaybox :is(.show-disks, .show-shares, .show-historical) > div.title.shift :is(span.left, div.left)"));
      for (var h = 0; h < heads.length; h++) ccUdSplitHeading(heads[h]);
      ccUdCtrlsMove();
      var tbs = document.querySelectorAll("#displaybox #disk-table-body, #displaybox #remotes-table-body, #displaybox #historical-table-body");
      for (var t = 0; t < tbs.length; t++) {
        var rows = tbs[t].children;
        for (var r = 0; r < rows.length; r++) {
          var tr = rows[r]; if (tr.tagName !== "TR" || tr.getAttribute("data-cc-ud")) continue;
          tr.setAttribute("data-cc-ud", "1");   // the refill recreates the rows fresh every three seconds
          var tds = tr.children;
          var nl = tr.querySelector('td:first-child a[href^="/Main/"]');
          if (nl && !nl.classList.contains("cc-b-name")) { nl.classList.add("cc-b"); nl.classList.add("cc-b-name"); }
          else if (!nl && tds[0]) ccUdBadgeCell(tds[0]);   // a historical row names a removed device as plain text, with no link to badge
          for (var c = 1; c < tds.length; c++) ccUdBadgeCell(tds[c]);
        }
      }
    } catch (e) {}
  }
  function udTeardown() {
    try {
      var hs = document.querySelectorAll("#displaybox [data-cc-ud-orig]");
      for (var i = 0; i < hs.length; i++) { hs[i].innerHTML = hs[i].getAttribute("data-cc-ud-orig"); hs[i].removeAttribute("data-cc-ud-orig"); hs[i].removeAttribute("data-cc-ud"); }
      var cells = document.querySelectorAll("#displaybox :is(table.usb_mounts, table.samba_mounts, table.usb_absent) td.cc-bcell");
      for (var c2 = 0; c2 < cells.length; c2++) {
        var b2 = cells[c2].querySelector(":scope > .cc-b"), v2 = b2 && b2.querySelector(":scope > .cc-b-v");
        if (v2) { while (v2.firstChild) cells[c2].insertBefore(v2.firstChild, b2); }
        if (b2) cells[c2].removeChild(b2);
        cells[c2].classList.remove("cc-bcell");
      }
      var nn = document.querySelectorAll("#displaybox :is(table.usb_mounts, table.samba_mounts, table.usb_absent) a.cc-b-name");
      for (var n2 = 0; n2 < nn.length; n2++) { nn[n2].classList.remove("cc-b"); nn[n2].classList.remove("cc-b-name"); }
      var thc = document.querySelectorAll("#displaybox :is(table.usb_mounts, table.samba_mounts, table.usb_absent) [data-cc-udth]");   // back to the native header alignment
      for (var t2 = 0; t2 < thc.length; t2++) { thc[t2].style.removeProperty("text-align"); thc[t2].removeAttribute("data-cc-udth"); }
      var mk = document.querySelectorAll("#displaybox tr[data-cc-ud]");
      for (var m2 = 0; m2 < mk.length; m2++) mk[m2].removeAttribute("data-cc-ud");
    } catch (e) {}
  }
  // Empty-state placeholders become muted pills, so that "nothing here" reads like the rest of the
  // page. Wraps the bare text of td.empty rows and the UD single-cell notices in span.cc-muted.
  // Only text-only cells: a cell holding any element is never a bare placeholder. UD's refill
  // recreates its rows, and the next enhanceMain pass rewraps them; ccMutedTeardown unwraps.
  function ccMutedWrap(td) {
    if (!td || td.querySelector("*")) return;                // text-only, and the wrap itself is a child, so this guards against a second pass
    var txt = (td.textContent || "").trim(); if (!txt) return;
    var s = el("span", "cc-muted");
    while (td.firstChild) s.appendChild(td.firstChild);
    td.appendChild(s);
  }
  function ccMutedEmpties() {
    try {
      var es = document.querySelectorAll("#displaybox table td.empty");
      for (var i = 0; i < es.length; i++) ccMutedWrap(es[i]);
      // a UD notice row is a lone spanning <td> of bare text
      var tbs = document.querySelectorAll("#displaybox #disk-table-body, #displaybox #remotes-table-body, #displaybox #historical-table-body");
      for (var t2 = 0; t2 < tbs.length; t2++) {
        var rows = tbs[t2].children;
        for (var r = 0; r < rows.length; r++) {
          var tr = rows[r];
          if (tr.tagName === "TR" && tr.children.length === 1 && tr.children[0].tagName === "TD") ccMutedWrap(tr.children[0]);
        }
      }
    } catch (e) {}
  }
  function ccMutedTeardown() {
    try {
      var ms = document.querySelectorAll("#displaybox .cc-muted");
      for (var i = 0; i < ms.length; i++) ccUnwrap(ms[i]);
    } catch (e) {}
  }
  // Row density follows cc.density, the key docker.js reads, so /Main and /Shares match the rest of
  // the plugin. The default "normal" stamps neither class. The classes ride the static <table>
  // elements, so a tbody refill never wipes them, and the density CSS is page-gated, so a stamp on
  // another page is inert.
  function ccDensity(on2) {
    try {
      var dens = g("cc.density", "normal");
      var tbs = document.querySelectorAll("#displaybox table.unraid.share_status, #displaybox table.unraid.disk_status, #displaybox table.array_status, #displaybox table.usb_mounts, #displaybox table.samba_mounts, #displaybox table.usb_absent");
      for (var i = 0; i < tbs.length; i++) {
        tbs[i].classList.toggle("cc-dens-compact", !!on2 && dens === "compact");
        tbs[i].classList.toggle("cc-dens-airy", !!on2 && dens === "airy");
      }
    } catch (e) {}
  }
  // Three foreign sources on /Main ship English even on a translated UI. dynamix.s3.sleep renders
  // its button value without the _() wrapper and nothing reads the value back, so swapping it is
  // safe. Unassigned Devices wraps its headings, toggles and table heads upstream but they are
  // missing from the language packs, so replacing the text nodes is safe, and the onclick
  // attributes stay untouched. device_list's internal-boot sentence is two text nodes around the
  // wizard link. The locale map is keyed by the exact English string, as T() above; add MAIN_T.<lang>
  // for another locale. Text already translated matches no key. data-cc-i18n-orig holds the
  // original for ccI18nTeardown. Text-node writes are characterData mutations, which the
  // childList-only observer never sees, so this cannot loop.
  var MAIN_T = {
    de: {
      "Sleep": "Ruhezustand",
      "Unassigned Disks/Remote Shares/Historical Unassigned Devices": "Nicht zugewiesene Geräte/Remote-Freigaben/Historische Geräte",
      "Unassigned Disks": "Nicht zugewiesene Datenträger",
      "Remote Shares": "Remote-Freigaben",
      "SMB Shares": "SMB-Freigaben",
      "NFS Shares": "NFS-Freigaben",
      "Unassigned Disk Devices": "Nicht zugewiesene Datenträger",
      "Historical Unassigned Devices": "Historische nicht zugewiesene Geräte",
      "SMB Shares |": "SMB-Freigaben |",
      "NFS Shares |": "NFS-Freigaben |",
      "ISO File Shares": "ISO-Datei-Freigaben",
      "Add Remote SMB/NFS Share": "Remote-SMB/NFS-Freigabe hinzufügen",
      "Add ISO File Share": "ISO-Datei-Freigabe hinzufügen",
      "Add Root Share": "Root-Freigabe hinzufügen",
      "Disks": "Datenträger",
      "Shares": "Freigaben",
      "Historical": "Historisch",
      "Share Type": "Freigabetyp",
      "Source": "Quelle",
      "Mount Point": "Einhängepunkt",
      "Serial Number (Mount Point)": "Seriennummer (Einhängepunkt)",
      "No internal boot setup detected. Launch": "Kein internes Boot-Setup erkannt.",
      "to configure one.": "starten, um eines einzurichten.",
      "Toggle reads/writes display": "Lese-/Schreibanzeige umschalten",
      "Reset column widths": "Spaltenbreiten zurücksetzen",
      "Schedule": "Planung",
      "Sleep will immediately put the server in sleep mode.": "Ruhezustand versetzt den Server sofort in den Ruhezustand.",
      "Make sure your server supports S3 sleep.": "Stellen Sie sicher, dass Ihr Server S3-Ruhezustand unterstützt.",
      "Check this wiki entry for more information.": "Weitere Informationen finden Sie im Wiki-Eintrag.",
      "Stop will take the array offline.": "Stopp nimmt das Array offline.",
      "Start will bring the array online.": "Start nimmt das Array in Betrieb.",
      "Check will start Parity-Check.": "Prüfung startet die Paritätsprüfung.",
      "Check will start Read-Check of all array disks.": "Prüfung startet den Lesetest aller Array-Datenträger.",
      "Spin Up will immediately spin up all disks.": "Hochdrehen fährt sofort alle Datenträger hoch.",
      "Spin Down will immediately spin down all disks.": "Herunterdrehen fährt sofort alle Datenträger herunter.",
      "Clear Stats will immediately clear all disk statistics.": "Statistik leeren setzt sofort alle Datenträger-Statistiken zurück.",
      "Move will immediately invoke the Mover.": "Verschieben startet sofort den Mover.",
      "Empty will immediately invoke the Mover to Empty a disk.": "Leeren startet sofort den Mover, um einen Datenträger zu leeren.",
      "Reboot will activate a clean system reset.": "Neustart führt einen sauberen System-Neustart aus.",
      "Shutdown will activate a clean system power down.": "Herunterfahren führt ein sauberes Ausschalten des Systems aus.",
      "Reboot in safe mode": "Neustart im abgesicherten Modus",
      "Write corrections to parity": "Korrekturen auf die Parität schreiben",
      "Disabled -- Parity operation is running": "Deaktiviert -- Paritätsvorgang läuft",
      "Disabled -- Mover is running": "Deaktiviert -- Mover läuft",
      "Disabled - Mover is running.": "Deaktiviert - Mover läuft.",
      "Disabled - Mover/Empty is running.": "Deaktiviert - Mover/Leeren läuft.",
      "Disabled -- BTRFS operation is running": "Deaktiviert -- BTRFS-Vorgang läuft",
      "WARNING: canceling may leave the array unprotected!": "WARNUNG: Abbrechen kann das Array ungeschützt zurücklassen!"
    }
  };
  function mt(k) { var m = LANG !== "en" && MAIN_T[LANG]; return (m && m[k]) || null; }
  // Translates an assembled bubble tip, matching the whole normalised tip first and falling back to
  // sentence by sentence. A tip already in the UI language matches no key and comes back unchanged.
  function mtText(tip) {
    var m = LANG !== "en" && MAIN_T[LANG]; if (!m || !tip) return tip;
    var k = tip.replace(new RegExp(String.fromCharCode(160), "g"), " ").replace(/\s+/g, " ").trim();   // fromCharCode keeps the NBSP out of the source as an invisible byte
    if (m[k]) return m[k];
    var parts = k.match(/[^.!?]+[.!?]*\s*/g); if (!parts) return tip;
    var out = "", hit = false;
    for (var i = 0; i < parts.length; i++) { var s2 = parts[i].trim(), tr2 = m[s2]; if (tr2) hit = true; out += (out ? " " : "") + (tr2 || s2); }
    return hit ? out : tip;
  }
  // Translates the direct text nodes of a host element, matching after whitespace normalisation.
  // Child elements such as icons, the wizard link and the UD images stay untouched.
  function ccTr(host) {
    if (!host || host.nodeType !== 1 || host.getAttribute("data-cc-i18n")) return;
    var keys = [];
    for (var c = host.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 3) continue;
      var raw = c.textContent;
      var lead = (raw.match(/^\s*/) || [""])[0], trail = (raw.match(/\s*$/) || [""])[0];
      var core = raw.slice(lead.length, raw.length - trail.length); if (!core) continue;
      var k = core.replace(/ /g, " ").replace(/\s+/g, " "), tr = mt(k);
      if (!tr) continue;
      c.textContent = lead + tr + trail;
      keys.push(k);
    }
    if (keys.length) { host.setAttribute("data-cc-i18n", "1"); host.setAttribute("data-cc-i18n-orig", keys.join("")); }
  }
  function ccLocalizeMain() {
    try {
      if (pn() !== "/Main") return;
      if (LANG === "en" || !MAIN_T[LANG]) return;
      // s3-sleep: relabel the value only, which the onclick chain never reads
      var sl = document.querySelectorAll('#displaybox table.array_status input[type="button"][onclick^="sleepS3"]');
      for (var s = 0; s < sl.length; s++) {
        var b = sl[s], tr = mt(b.value);
        if (tr && !b.getAttribute("data-cc-i18n")) { b.setAttribute("data-cc-i18n", "1"); b.setAttribute("data-cc-i18n-orig", b.value); b.value = tr; }
      }
      // UD: the section headings, the three add buttons (text nodes only), the switchButton labels
      // and the table heads. The map is keyed by the exact English string, so a head that is
      // already translated cannot match.
      var els = document.querySelectorAll(
        "#displaybox div.title :is(span.left, div.left, .leftTitleUD), " +
        "#displaybox button[onclick^='add_samba_share'], #displaybox button[onclick^='add_iso_share'], #displaybox button[onclick^='add_root_share'], " +
        "#displaybox span.switch-button-label, " +
        "#displaybox table thead td, #displaybox table thead th");
      for (var i = 0; i < els.length; i++) ccTr(els[i]);
      // The internal-boot sentence is the two text nodes around the wizard link. Its parentNode,
      // not closest("td"): mainBadgeCell may have wrapped the cell text into .cc-b-v, and the
      // link's parent holds the text nodes either way.
      var links = document.querySelectorAll('#displaybox a[href*="InternalBootWizard"]');
      for (var l = 0; l < links.length; l++) { var host = links[l].parentNode; if (host && host.nodeType === 1) ccTr(host); }
    } catch (e) {}
  }
  function ccI18nTeardown() {
    try {
      var els = document.querySelectorAll("#displaybox [data-cc-i18n]");
      for (var i = 0; i < els.length; i++) {
        var el2 = els[i], keys = (el2.getAttribute("data-cc-i18n-orig") || "").split("");
        if (el2.tagName === "INPUT") { if (keys[0]) el2.value = keys[0]; }
        else {
          for (var k = 0; k < keys.length; k++) {
            var tr = mt(keys[k]); if (!tr) continue;
            for (var c = el2.firstChild; c; c = c.nextSibling) {
              if (c.nodeType === 3 && c.textContent.replace(/ /g, " ").trim() === tr) { c.textContent = c.textContent.replace(tr, keys[k]); break; }
            }
          }
        }
        el2.removeAttribute("data-cc-i18n"); el2.removeAttribute("data-cc-i18n-orig");
      }
    } catch (e) {}
  }
  function apply() {
    try {
      var root = document.documentElement;
      // Master theming off behaves like a disabled area and runs the teardown branch below.
      var on = g("cc.enable.shares", "0") !== "0" && g("cc.theming", "1") !== "0";   // opt in, since it flips Unraid's tabbed setting
      // /Main is its own area but reuses this enhancer, so cc-shares-on is set there when the Start
      // area is on even with the Shares area off. onMain() gates it to /Main, so the Shares styling
      // never leaks onto another page.
      var onMainArea = g("cc.enable.main", "0") !== "0" && g("cc.theming", "1") !== "0";
      var active = on || (onMainArea && onMain());
      root.classList.toggle("cc-shares-on", active);
      // /Shares shows one legitimate tab family, so the CSS rule that hides a single tab skips it
      root.classList.toggle("cc-on-shares", on && pn() === "/Shares");
      // The share detail page is a single-family tab page too. Without the marker the single-tab
      // hide takes its prev/next arrows with it, and its buttons, inputs and title stay unthemed.
      root.classList.toggle("cc-on-share-detail", on && pn() === "/Shares/Share");
      // Stacked CC sections instead of the native sub-tabs, per area. cc-on-share-detail stays set,
      // since it gates the button and input theming in both modes; the CSS flatten rule combines it
      // with cc-sections-share, so turning a section toggle off reverts to the native sub-tabs.
      root.classList.toggle("cc-sections-share", on && g("cc.sections.shares", "0") !== "0" && (pn() === "/Shares/Share" || pn() === "/Shares"));   // the /Shares overview flattens too, not only the detail page
      root.classList.toggle("cc-sections-main", onMainArea && g("cc.sections.main", "0") !== "0" && onMain());
      root.classList.toggle("cc-on-main", onMainArea && onMain());
      // The file manager is a CSS-only area, nothing is injected, so this class toggle is the whole
      // teardown. The page runs delete and move jobs, so the cc-on-browse block in Shares.css keeps
      // away from its rows, columns and check glyphs.
      root.classList.toggle("cc-on-browse", on && onBrowse());
      if (on && onBrowse()) enhanceBrowse();
      // On /Stats the class drives the look and moveStatsControls() relocates the control group
      // below the graphs, which is a real DOM move with its own teardown.
      var statsOn = on && onStats();
      root.classList.toggle("cc-on-stats", statsOn);
      if (statsOn) moveStatsControls(); else statsControlsTeardown();
      if (!active) {
        // Disabled at runtime: removing the class reverts every CSS rule, but the injected card
        // headers would linger as stray unstyled divs, so they and their markers go as well.
        try {
          ccDiskioHome();   // the diskio switch sits inside the first .cc-card-head, which the loop below removes
          ccUdCtrlsHome();  // same for the UD cluster parked in the UD section's head or in its own card
          var stray = document.querySelectorAll("#displaybox .cc-card-head, #displaybox .cc-card-note");
          for (var s = 0; s < stray.length; s++) stray[s].parentNode.removeChild(stray[s]);
          // Unhide the carded native SMB sub-heading. Its hide rule is gated on cc-shares-on, so
          // without stripping the class the native heading and the orphaned .cc-card-note would
          // both show the same text.
          var carded = document.querySelectorAll("#displaybox .cc-carded");
          for (var cd = 0; cd < carded.length; cd++) carded[cd].classList.remove("cc-carded");
          var marked = document.querySelectorAll("#displaybox [data-cc-card]");
          for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-cc-card");
          // The inline rainbow colours paintTabs and paintRows stamped survive a class removal, so
          // they are cleared here along with the neutral class.
          root.classList.remove("cc-shares-rbneutral");
          var painted = document.querySelectorAll('#displaybox nav.tabs button[role="tab"], #displaybox #shareslist tr, #displaybox #disk_list tr, #displaybox .cc-b, #displaybox .cc-b-browse, #displaybox table.unraid.disk_status tr, #displaybox table.array_status input[type="submit"], #displaybox table.array_status input[type="button"], #displaybox table.array_status a.button, #displaybox table.array_status button, #displaybox .cc-card-head, #displaybox a.cc-ud-icon, #displaybox a.cc-ibtn, #displaybox .cc-aop-link, #displaybox .switch-button-background');
          for (var p = 0; p < painted.length; p++) { painted[p].style.removeProperty("background"); painted[p].style.removeProperty("color"); painted[p].style.removeProperty("--cc-rb-c"); painted[p].style.removeProperty("--cc-rb-ct"); }
          ccSelectsTeardown();
          ccCardsTeardown();
          // The /Main disk_status tables give back their injected Browse column, value badges and
          // markers, so a live disable reverts before the next nchan refill. A colspan left one too
          // wide heals with that refill.
          var mbrowse = document.querySelectorAll("#displaybox table.unraid.disk_status td.cc-browse-col");
          for (var mb = 0; mb < mbrowse.length; mb++) mbrowse[mb].parentNode.removeChild(mbrowse[mb]);
          // Move the children back rather than reading textContent, which would destroy the wrapped
          // diskio spans and the error info icon.
          var mbc = document.querySelectorAll("#displaybox table.unraid.disk_status td.cc-bcell");
          for (var bcx = 0; bcx < mbc.length; bcx++) {
            var cbx = mbc[bcx].querySelector(":scope > .cc-b"), vvx = cbx && cbx.querySelector(":scope > .cc-b-v");
            if (vvx) { while (vvx.firstChild) mbc[bcx].insertBefore(vvx.firstChild, cbx); }
            if (cbx) mbc[bcx].removeChild(cbx);
            mbc[bcx].classList.remove("cc-bcell");
          }
          var mmk = document.querySelectorAll("#displaybox [data-cc-main]");
          for (var mmx = 0; mmx < mmk.length; mmx++) mmk[mmx].removeAttribute("data-cc-main");
          // strip the headline badge classes off the device link
          var mname = document.querySelectorAll("#displaybox table.unraid.disk_status a.cc-b-name");
          for (var mn = 0; mn < mname.length; mn++) { mname[mn].classList.remove("cc-b"); mname[mn].classList.remove("cc-b-name"); }
          // An empty slot on a stopped array has no link to declass, since enhanceMainName wraps
          // its bare text node instead.
          var msname = document.querySelectorAll("#displaybox table.unraid.disk_status span.cc-b-name");
          for (var ms = 0; ms < msname.length; ms++) msname[ms].parentNode.replaceChild(document.createTextNode(msname[ms].textContent || ""), msname[ms]);
          var mvoid = document.querySelectorAll("#displaybox table.unraid.disk_status tr.cc-tr-void");
          for (var mv = 0; mv < mvoid.length; mv++) mvoid[mv].classList.remove("cc-tr-void");
          ccMainCols.teardown();
          ccShareCols.teardown();
          aopTeardown();
          udTeardown();   // before ccI18nTeardown, whose text-node match needs the restored headings
          ccMutedTeardown();
          ccDensity(false);
          // styled hover bubbles back to native title balloons
          var tps = document.querySelectorAll("#displaybox [data-cc-tip]");
          for (var tp = 0; tp < tps.length; tp++) { tps[tp].setAttribute("title", tps[tp].getAttribute("data-cc-tip")); tps[tp].removeAttribute("data-cc-tip"); }
          var hps = document.querySelectorAll("#displaybox [data-cc-help]");
          for (var hp = 0; hp < hps.length; hp++) hps[hp].removeAttribute("data-cc-help");   // a re-enable derives the fold again
          ccI18nTeardown();
        } catch (e) {}
        return;
      }
      // On /Main the Start area owns the colour, everywhere else the Shares accent applies. The
      // two never meet on one page load.
      var a = (onMainArea && onMain()) ? mainAccent() : accent();
      // Each area owns its accent var: every global enhancer writes on documentElement, so a
      // shared --cc-accent would let the Freigaben colour bleed onto the menu bar and back.
      root.style.setProperty("--cc-shr-accent", a);
      root.style.setProperty("--cc-shr-accent-text", idealText(a));
      root.classList.toggle("cc-shares-rb", rbOn());
      ensureTabbed();
      hideRedundantTabs();
      paintTabs();
      enhanceShares();
      paintRows();          // after the badges exist
      enhanceShareDetail();
      paintCards();
      enhanceMain();
      paintMain();          // after the badges exist
      ccDensity(true);
      if (onStats()) moveStatsControls();   // span.status can arrive late
      if (onBrowse()) enhanceBrowse();      // navigation replaces the tbody
    } catch (e) {}
  }
  // Observes the content container, never body. apply() and its follow-ups change only attributes,
  // so they cannot re-trigger this childList observer; debounced for AJAX content swaps.
  function watch() {
    try {
      var host = document.getElementById("displaybox") || document.getElementById("content");
      if (!host) return;
      mo = new MutationObserver(function (recs) {
        if (g("cc.theming", "1") === "0") return;   // apply()'s teardown has already cleaned up
        // Unraid's devices subscriber replaces the whole disk table body on every nchan tick,
        // wiping the Browse column and the badges. Going through the debounce below would land a
        // paint frame late, so the browser shows the plain 10-column rows under the 11-column head
        // first and then repaints. This callback is a microtask that runs after the .html() call
        // but before the next paint, so re-applying here means the plain state is never rendered.
        // enhanceMain is idempotent, so its own writes re-enter here once and then no-op.
        for (var i = 0; i < recs.length; i++) {
          var tgt = recs[i].target;
          if (tgt && (tgt.id === "array_devices" || tgt.id === "disk-table-body" || tgt.id === "remotes-table-body" || tgt.id === "historical-table-body" || (tgt.closest && tgt.closest("table.unraid.disk_status")))) { enhanceMain(); paintMain(); break; }
        }
        if (moPending) return; moPending = true;
        setTimeout(function () { moPending = false; if (g("cc.theming", "1") === "0") return; hideRedundantTabs(); paintTabs(); enhanceShares(); paintRows(); enhanceShareDetail(); paintCards(); enhanceMain(); paintMain(); if (g("cc.enable.shares", "0") !== "0" && onStats()) moveStatsControls(); if (g("cc.enable.shares", "0") !== "0" && onBrowse()) enhanceBrowse(); }, 150);
      });
      mo.observe(host, { childList: true, subtree: true });
    } catch (e) {}
  }
  function boot() {
    try { window.ccSharesApply = apply; } catch (e) {}   // the settings page's live toggle hook, for Shares and Start
    if (g("cc.enable.shares", "0") === "0" && g("cc.enable.main", "0") === "0") return;
    apply();
    watch();
    // The settings page writes cc.* and ccsh.* keys from another tab. The [a-z]* in the pattern is
    // what catches "ccsh.accent". cc.stateCache is skipped because docker.js rewrites it every 9s.
    try { window.addEventListener("storage", function (e) { if (e && e.key && e.key !== "cc.stateCache" && /^cc[a-z]*\./.test(e.key)) apply(); }); } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
