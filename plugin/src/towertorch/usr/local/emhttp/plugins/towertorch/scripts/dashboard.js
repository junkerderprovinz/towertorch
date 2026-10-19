/* CannonadeCommand: the Dashboard tiles as GlimStone cards.
 *
 * Loaded on every page through CannonadeCommand.Dashboard.page and gated to /Dashboard. It toggles
 * html.cc-dash-on while the header area and master theming are on, puts a filled glyph into each
 * tile title so CannonadeCommand.Dashboard.css can draw the title as a section badge, paints those
 * badges in the colour mode and redraws the two live charts in the accent. Unraid renders the
 * tiles once and only refreshes their values, so one pass after the page settles is enough; the
 * badge colours follow a tile that is dragged to another place through the sortable's own event.
 * The disk rows are the exception: Unraid rebuilds them on every message of its dashboard feed, so
 * their fixes run again from a listener on that same feed.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function onDash() { try { return location.pathname.replace(/\/+$/, "") === "/Dashboard"; } catch (e) { return false; } }
  function isLive() { return g("cc.theming", "1") !== "0" && g("cc.enable.header", "0") !== "0" && onDash(); }

  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var TXT = {
    de: { resting: "Ruht", cores: "%c Kerne", coresHt: "%c Kerne, %t Threads", "P-Core": "P-Kerne", "E-Core": "E-Kerne",
          stop: "Array stoppen", start: "Array starten", sleep: "Ruhezustand", reboot: "Neu starten", off: "Herunterfahren",
          ident: "Identifikation bearbeiten", foldAll: "Alle Karten ein- oder ausklappen", fold: "Karte einklappen", unfold: "Karte ausklappen" },
    en: { resting: "Spun down", cores: "%c cores", coresHt: "%c cores, %t threads", "P-Core": "P-cores", "E-Core": "E-cores",
          stop: "Stop the array", start: "Start the array", sleep: "Sleep", reboot: "Reboot", off: "Shut down",
          ident: "Edit identification", foldAll: "Fold or unfold all cards", fold: "Fold card", unfold: "Unfold card" }
  };
  function t(k) { return (TXT[LANG] || TXT.en)[k] || TXT.en[k]; }

  // Filled drawings for Unraid's tile icons, which are outline glyphs of its own icon font. Tabler
  // icons, filled set (MIT), on a 24 grid; Docker's brand mark from Simple Icons, the one the
  // Docker tab in the menu bar wears. The log tile takes CCTheme's Log glyph.
  var P = {
    bolt: '<path d="M13 2l.018 .001l.016 .001l.083 .005l.011 .002h.011l.038 .009l.052 .008l.016 .006l.011 .001l.029 .011l.052 .014l.019 .009l.015 .004l.028 .014l.04 .017l.021 .012l.022 .01l.023 .015l.031 .017l.034 .024l.018 .011l.013 .012l.024 .017l.038 .034l.022 .017l.008 .01l.014 .012l.036 .041l.026 .027l.006 .009c.12 .147 .196 .322 .218 .513l.001 .012l.002 .041l.004 .064v6h5a1 1 0 0 1 .868 1.497l-.06 .091l-8 11c-.568 .783 -1.808 .38 -1.808 -.588v-6h-5a1 1 0 0 1 -.868 -1.497l.06 -.091l8 -11l.01 -.013l.018 -.024l.033 -.038l.018 -.022l.009 -.008l.013 -.014l.04 -.036l.028 -.026l.008 -.006a1 1 0 0 1 .402 -.199l.011 -.001l.027 -.005l.074 -.013l.011 -.001l.041 -.002z"/>',
    board: '<path d="M5 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a2 2 0 0 1 2 -2"/><path d="M14 3h5a2 2 0 0 1 2 2v8a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1"/><path d="M14 16h6a1 1 0 0 1 1 1v2a2 2 0 0 1 -2 2h-5a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1"/><path d="M4 10h6a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-5a2 2 0 0 1 -2 -2v-8a1 1 0 0 1 1 -1"/>',
    pie: '<path d="M9.883 2.207a1.9 1.9 0 0 1 2.087 1.522l.025 .167l.005 .104v7a1 1 0 0 0 .883 .993l.117 .007h6.8a2 2 0 0 1 2 2a1 1 0 0 1 -.026 .226a10 10 0 1 1 -12.27 -11.933l.27 -.067l.11 -.02z"/><path d="M14 3.5v5.5a1 1 0 0 0 1 1h5.5a1 1 0 0 0 .943 -1.332a10 10 0 0 0 -6.11 -6.111a1 1 0 0 0 -1.333 .943z"/>',
    shieldLock: '<path d="M11.998 2l.118 .007l.059 .008l.061 .013l.111 .034a.993 .993 0 0 1 .217 .112l.104 .082l.255 .218a11 11 0 0 0 7.189 2.537l.342 -.01a1 1 0 0 1 1.005 .717a13 13 0 0 1 -9.208 16.25a1 1 0 0 1 -.502 0a13 13 0 0 1 -9.209 -16.25a1 1 0 0 1 1.005 -.717a11 11 0 0 0 7.531 -2.527l.263 -.225l.096 -.075a.993 .993 0 0 1 .217 -.112l.112 -.034a.97 .97 0 0 1 .119 -.021l.115 -.007zm.002 7a2 2 0 0 0 -1.995 1.85l-.005 .15l.005 .15a2 2 0 0 0 .995 1.581v1.769l.007 .117a1 1 0 0 0 1.993 -.117l.001 -1.768a2 2 0 0 0 -1.001 -3.732z"/>',
    shieldCheck: '<path d="M11.998 2l.118 .007l.059 .008l.061 .013l.111 .034a.993 .993 0 0 1 .217 .112l.104 .082l.255 .218a11 11 0 0 0 7.189 2.537l.342 -.01a1 1 0 0 1 1.005 .717a13 13 0 0 1 -9.208 16.25a1 1 0 0 1 -.502 0a13 13 0 0 1 -9.209 -16.25a1 1 0 0 1 1.005 -.717a11 11 0 0 0 7.531 -2.527l.263 -.225l.096 -.075a.993 .993 0 0 1 .217 -.112l.112 -.034a.97 .97 0 0 1 .119 -.021l.115 -.007zm3.71 7.293a1 1 0 0 0 -1.415 0l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.32 1.497l2 2l.094 .083a1 1 0 0 0 1.32 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z"/>',
    database: '<path d="M3 15.731c1.968 1.507 5.234 2.269 9 2.269c3.76 0 7.025 -.76 9 -2.252v2.252c0 2.425 -3.895 3.936 -8.693 3.998l-.307 .002c-4.938 0 -9 -1.523 -9 -4z"/><path d="M3 9.731c1.968 1.507 5.234 2.269 9 2.269c3.76 0 7.025 -.76 9 -2.252v2.252c0 2.477 -4.062 4 -9 4c-4.798 0 -8.77 -1.438 -8.979 -3.795l-.016 -.101l-.005 -.104z"/><path d="M12 2c1.041 0 2.044 .068 2.977 .198l.469 .071q .84 .14 1.586 .348l.44 .131l.075 .024a11 11 0 0 1 .805 .3l.199 .086q .535 .242 .967 .53q .165 .11 .313 .225a3.8 3.8 0 0 1 .669 .668l.091 .128q .07 .105 .129 .211l.07 .139q .163 .35 .2 .73l.01 .211c0 2.477 -4.062 4 -9 4c-4.798 0 -8.77 -1.438 -8.979 -3.795a1 1 0 0 1 -.021 -.205l.005 -.104l.016 -.1c.205 -2.306 4.01 -3.733 8.667 -3.794z"/>',
    gauge: '<path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-.293 3.953a1 1 0 0 0 -1.414 0l-2.59 2.59l-.083 .094l-.068 .1a2.001 2.001 0 0 0 -2.547 1.774l-.005 .149l.005 .15a2 2 0 1 0 3.917 -.701a.968 .968 0 0 0 .195 -.152l2.59 -2.59l.083 -.094a1 1 0 0 0 -.083 -1.32zm-4.707 -1.293a6 6 0 0 0 -6 6a1 1 0 0 0 2 0a4 4 0 0 1 4 -4a1 1 0 0 0 0 -2z"/>',
    world: '<path d="M21.165 16a10 10 0 0 1 -8.434 5.973a1 1 0 0 0 .617 -.444a18 18 0 0 0 2.28 -5.528z"/><path d="M8.372 16a18 18 0 0 0 2.28 5.53a1 1 0 0 0 .616 .443a10 10 0 0 1 -8.433 -5.973z"/><path d="M13.57 16a16 16 0 0 1 -1.57 3.884a16 16 0 0 1 -1.57 -3.884"/><path d="M8.034 10a18 18 0 0 0 0 4h-5.832a10 10 0 0 1 -.002 -4z"/><path d="M13.952 10a16 16 0 0 1 0 4h-3.904a16 16 0 0 1 0 -4z"/><path d="M21.8 10a10.05 10.05 0 0 1 -.002 4h-5.832c.149 -1.329 .149 -2.67 0 -4z"/><path d="M11.267 2.027a1 1 0 0 0 -.615 .444a18 18 0 0 0 -2.28 5.529h-5.54a10.01 10.01 0 0 1 8.334 -5.967z"/><path d="M12 4.116a16 16 0 0 1 1.57 3.885h-3.14c.34 -1.317 .85 -2.6 1.53 -3.817z"/><path d="M12.733 2.026a10.01 10.01 0 0 1 8.435 5.974h-5.54a18 18 0 0 0 -2.28 -5.53a1 1 0 0 0 -.517 -.414z"/>',
    cards: '<path d="M10.348 3.169l-7.15 3.113a2 2 0 0 0 -1.03 2.608l4.92 11.895a1.96 1.96 0 0 0 2.59 1.063l7.142 -3.11a2.002 2.002 0 0 0 1.036 -2.611l-4.92 -11.894a1.96 1.96 0 0 0 -2.588 -1.064z"/><path d="M16 3a2 2 0 0 1 1.995 1.85l.005 .15v3.5a1 1 0 0 1 -1.993 .117l-.007 -.117v-3.5h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z"/><path d="M19.08 5.61a1 1 0 0 1 1.31 -.53c.257 .108 .505 .21 .769 .314a2 2 0 0 1 1.114 2.479l-.056 .146l-2.298 5.374a1 1 0 0 1 -1.878 -.676l.04 -.11l2.296 -5.371l-.366 -.148l-.402 -.167a1 1 0 0 1 -.53 -1.312z"/>',
    desktop: '<path d="M7 21a1 1 0 0 1 0 -2h1v-2h-4a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-4v2h1a1 1 0 0 1 0 2zm7 -4h-4v2h4z"/>',
    folder: '<path d="M9 3a1 1 0 0 1 .608 .206l.1 .087l2.706 2.707h6.586a3 3 0 0 1 2.995 2.824l.005 .176v8a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-11a3 3 0 0 1 2.824 -2.995l.176 -.005h4z"/>',
    user: '<path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/>',
    battery: '<path d="M17 6a3 3 0 0 1 2.995 2.824l.005 .176v.086l.052 .019a1.5 1.5 0 0 1 .941 1.25l.007 .145v3a1.5 1.5 0 0 1 -.948 1.395l-.052 .018v.087a3 3 0 0 1 -2.824 2.995l-.176 .005h-11a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-6a3 3 0 0 1 2.824 -2.995l.176 -.005h11z"/>',
    tile: '<path d="M9 3a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 12a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2zm10 -4a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2zm0 -8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-2a2 2 0 0 1 2 -2z"/>',
    docker: '<path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>'
  };
  var BY_ICON = {
    "icon-performance": "bolt", "icon-motherboard": "board", "icon-ram": "pie", "icon-vpn": "shieldLock",
    "icon-health": "shieldCheck", "icon-disks": "database", "icon-disk": "database", "icon-cpu": "gauge",
    "icon-ethernet": "world", "icon-hardware": "cards", "icon-virtualization": "desktop", "icon-docker": "docker",
    "icon-folder": "folder", "icon-users": "user", "icon-ups": "battery", "icon-log": "log"
  };
  function glyphFor(icon) {
    var name = "tile";
    if (icon && icon.classList) for (var i = 0; i < icon.classList.length; i++) if (BY_ICON[icon.classList[i]]) { name = BY_ICON[icon.classList[i]]; break; }
    if (name === "log" && window.CCTheme && CCTheme.glyph) return CCTheme.glyph("Log").replace('class="cc-glyph"', 'class="cc-glyph cc-dash-g"');
    return '<svg class="cc-glyph cc-dash-g" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">' + P[name === "log" ? "tile" : name] + "</svg>";
  }

  // The title of a tile: its h3, or for a plugin tile that prints a bare word (the GPU tile) that
  // word, wrapped so it can carry the badge.
  function titleOf(left) {
    var sec = left.querySelector(".section");
    if (!sec) return null;
    var h = sec.querySelector("h3.tile-header-main");
    if (h) return h;
    for (var n = sec.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        var w = document.createElement("span");
        w.className = "cc-dash-wrap";
        sec.insertBefore(w, n); w.appendChild(n);
        return w;
      }
      if (n.nodeType === 1) break;
    }
    return null;
  }

  function heads() { return document.querySelectorAll("table.dashboard > tbody > tr:first-child .tile-header-left"); }

  function decorate() {
    var ls = heads();
    for (var i = 0; i < ls.length; i++) {
      var left = ls[i];
      if (left.querySelector(".cc-dash-h")) continue;
      var t = titleOf(left);
      if (!t) continue;
      var icon = left.querySelector(":scope > i.f32, :scope > i[class*='icon-']");
      var img = left.querySelector(":scope > img");
      t.classList.add("cc-dash-h");
      if (img && !icon) {
        var mini = document.createElement("img");
        mini.className = "cc-dash-g cc-dash-img"; mini.src = img.src; mini.alt = "";
        t.insertBefore(mini, t.firstChild);
      } else {
        t.insertAdjacentHTML("afterbegin", glyphFor(icon));
      }
      left.classList.add("cc-dash-glyphed");
    }
  }

  function strip() {
    var gs = document.querySelectorAll("table.dashboard .cc-dash-g");
    for (var i = 0; i < gs.length; i++) gs[i].parentNode.removeChild(gs[i]);
    var ws = document.querySelectorAll("table.dashboard .cc-dash-wrap");
    for (var j = 0; j < ws.length; j++) { var w = ws[j]; while (w.firstChild) w.parentNode.insertBefore(w.firstChild, w); w.parentNode.removeChild(w); }
    var hs = document.querySelectorAll("table.dashboard .cc-dash-h");
    for (var k = 0; k < hs.length; k++) { hs[k].classList.remove("cc-dash-h"); hs[k].style.removeProperty("--cc-rb-c"); hs[k].style.removeProperty("--cc-rb-ct"); }
    var ls = document.querySelectorAll("table.dashboard .cc-dash-glyphed");
    for (var m = 0; m < ls.length; m++) ls[m].classList.remove("cc-dash-glyphed");
  }

  // A heading is not a control, so the reactive sub-mode leaves it coloured; in rainbow and flag
  // mode each visible tile takes the next palette position in reading order.
  function paint() {
    var rb = g("cc.rainbow", "0") === "1" && window.CCTheme && CCTheme.rbColor;
    var hs = document.querySelectorAll("table.dashboard > tbody:not([style*='none']) .cc-dash-h");
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (rb) {
        var c = CCTheme.rbColor(i, "#FCC419");
        h.style.setProperty("--cc-rb-c", c); h.style.setProperty("--cc-rb-ct", CCTheme.idealText(c));
      } else { h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct"); }
    }
    // the icon badges of each tile run through the palette on their own, as a Docker row's do
    var ts = document.querySelectorAll("table.dashboard > tbody");
    for (var j = 0; j < ts.length; j++) {
      var bs = ts[j].querySelectorAll(".cc-dash-btn:not(.cc-actoff)");
      for (var k = 0; k < bs.length; k++) {
        if (rb) {
          var bc = CCTheme.rbColor(k, "#FCC419");
          bs[k].style.setProperty("--cc-rb-c", bc); bs[k].style.setProperty("--cc-rb-ct", CCTheme.idealText(bc));
        } else { bs[k].style.removeProperty("--cc-rb-c"); bs[k].style.removeProperty("--cc-rb-ct"); }
      }
    }
  }

  // The system tile's power controls and every tile's header controls become CC icon badges. They
  // stay Unraid's own elements with Unraid's handlers and confirmations; each takes a glyph from the
  // set where the set has the meaning, a name for the bubble and for a screen reader, and Tab and
  // Enter. A control with no name of CC's own keeps Unraid's text.
  var BTN_GLYPH = { "fa-stop-circle": "Stop", "fa-play-circle": "Play", "fa-moon-o": "Moon", "fa-refresh": "Refresh", "fa-power-off": "Power", "fa-cog": "Gear", "fa-info-circle": "Info" };
  function btnName(b) {
    var c = b.classList;
    if (c.contains("fa-stop-circle")) return t("stop");
    if (c.contains("fa-play-circle")) return t("start");
    if (c.contains("fa-moon-o")) return t("sleep");
    if (c.contains("fa-refresh")) return t("reboot");
    if (c.contains("fa-power-off")) return t("off");
    if (c.contains("fa-eject")) return t("foldAll");
    if (c.contains("openclose")) return t(c.contains("fa-chevron-down") ? "unfold" : "fold");
    if (b.getAttribute("href") === "/Dashboard/Settings/Identification") return t("ident");
    return "";
  }
  function btnGlyph(b) {
    var i = b.tagName === "A" ? b.querySelector("i.fa") : b;
    for (var k in BTN_GLYPH) if (i && i.classList.contains(k)) return BTN_GLYPH[k];
    return "";
  }
  function controls() {
    return document.querySelectorAll("table.dashboard .tile-ctrl > span:is(.hand, .busy), table.dashboard .tile-header-right-controls > :is(a, i.control:not(.tile))");
  }

  var BTNS = [];
  function badgeControls() {
    var bs = controls();
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.classList.contains("cc-dash-btn")) continue;
      // Unraid puts the gear's text on the icon inside the link, where a bubble would find it before
      // the link's own name.
      var holder = b.hasAttribute("title") || b.hasAttribute("data-cc-tip") ? b : b.querySelector("[title], [data-cc-tip]");
      var rec = { b: b, holder: holder, title: holder ? holder.getAttribute("title") || holder.getAttribute("data-cc-tip") : null };
      BTNS.push(rec);
      if (holder) { holder.removeAttribute("title"); holder.removeAttribute("data-cc-tip"); }
      var name = btnName(b) || rec.title;
      if (name) { b.setAttribute("data-cc-tip", name); b.setAttribute("aria-label", name); }
      b.classList.add("cc-actbtn", "cc-dash-btn");
      if (b.classList.contains("busy")) { b.classList.add("cc-actoff"); b.setAttribute("aria-disabled", "true"); }
      else if (b.tagName !== "A") {
        b.setAttribute("role", "button"); b.setAttribute("tabindex", "0");
        if (!b.ccKeys) { b.ccKeys = true; b.addEventListener("keydown", pressKey); }
      }
      var gl = btnGlyph(b);
      if (gl && window.CCTheme && CCTheme.glyph) { b.insertAdjacentHTML("beforeend", CCTheme.glyph(gl)); b.classList.add("cc-dash-gl"); }
    }
  }
  function pressKey(e) {
    if (!this.classList.contains("cc-dash-btn") || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault(); e.stopPropagation(); this.click();
  }
  // Unraid turns the fold arrow over on a click, so its name follows after Unraid's handler ran.
  function renameFolds() {
    var fs = document.querySelectorAll("table.dashboard .cc-dash-btn.openclose");
    for (var i = 0; i < fs.length; i++) { var n = btnName(fs[i]); fs[i].setAttribute("data-cc-tip", n); fs[i].setAttribute("aria-label", n); }
  }
  function unbadgeControls() {
    BTNS.forEach(function (r) {
      var b = r.b, gs = b.querySelectorAll(":scope > .cc-glyph");
      for (var i = 0; i < gs.length; i++) b.removeChild(gs[i]);
      b.classList.remove("cc-actbtn", "cc-dash-btn", "cc-dash-gl", "cc-actoff");
      ["data-cc-tip", "aria-label", "aria-disabled", "role", "tabindex"].forEach(function (a) { b.removeAttribute(a); });
      b.style.removeProperty("--cc-rb-c"); b.style.removeProperty("--cc-rb-ct");
      if (r.holder && r.title) r.holder.setAttribute("title", r.title);
    });
    BTNS = [];
  }

  // The system tile prints the server's description under its name, and a server whose description
  // is its name would show the name twice.
  function hideDupName() {
    var h = document.querySelector("table.dashboard tbody.system h3.tile-header-main"), d = h && h.nextElementSibling;
    if (!d || d.tagName !== "SPAN" || d.id) return;
    d.classList.toggle("cc-dash-dup", !!d.textContent.trim() && d.textContent.trim().toLowerCase() === h.textContent.trim().toLowerCase());
  }
  function showDupName() {
    var d = document.querySelector("table.dashboard .cc-dash-dup");
    if (d) d.classList.remove("cc-dash-dup");
  }

  // GlimStone draws a chart in the one accent with no grid. The CPU line and the inbound traffic
  // take the accent with a faint fill; outbound keeps the accent as a thinner line without fill, so
  // the two stay apart without a second hue. The originals are kept for turning the area off.
  var CHARTS = ["cpuchart", "netchart"];
  function alpha(hex, a) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "transparent"; var n = parseInt(m[1], 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }
  function paintCharts(on) {
    var acc = "";
    try { acc = getComputedStyle(document.documentElement).getPropertyValue("--cc-accent").trim(); } catch (e) {}
    if (!/^#[0-9a-f]{6}$/i.test(acc)) acc = "#FCC419";
    var text = "";
    try { text = getComputedStyle(document.documentElement).getPropertyValue("--cc-text-dim").trim(); } catch (e) {}
    CHARTS.forEach(function (name) {
      var c = window[name];
      if (!c || !c.options || !c.seriesSet) return;
      if (!c.__ccOrig) c.__ccOrig = { grid: JSON.parse(JSON.stringify(c.options.grid)), label: c.options.labels.fillStyle, series: c.seriesSet.map(function (s) { return { stroke: s.options.strokeStyle, fill: s.options.fillStyle, width: s.options.lineWidth }; }) };
      var o = c.__ccOrig;
      if (on) {
        c.options.grid.strokeStyle = "transparent"; c.options.grid.verticalSections = 0; c.options.grid.borderVisible = false;
        if (text) c.options.labels.fillStyle = text;
        c.seriesSet.forEach(function (s, i) {
          s.options.strokeStyle = i === 0 ? acc : alpha(acc, 0.7);
          s.options.fillStyle = i === 0 ? alpha(acc, 0.16) : undefined;
          s.options.lineWidth = i === 0 ? 1.5 : 1;
        });
      } else {
        c.options.grid = JSON.parse(JSON.stringify(o.grid)); c.options.labels.fillStyle = o.label;
        c.seriesSet.forEach(function (s, i) { var v = o.series[i] || {}; s.options.strokeStyle = v.stroke; s.options.fillStyle = v.fill; s.options.lineWidth = v.width; });
      }
    });
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function hasCls(e, c) { return !!(e && e.classList && e.classList.contains(c)); }

  // Unraid prints one row per physical core: a label such as "CPU 0 (P-Core) - HT 1" or "CPU 4", then
  // one load cell per thread, whose bar carries the thread number in its id. The grid is built from
  // those cells and the core type in the label's brackets, never from a CPU model, so it holds for
  // any thread count, with or without hyperthreading or core types. The cells move into the grid
  // as they are; Unraid finds them by id and class on every update, so the bars stay live.
  function threadsOf(tr) {
    var out = [], td = tr && tr.children[0];
    if (!td || !hasCls(tr, "cpu_open")) return out;
    for (var i = 0; i < td.children.length; i++) {
      var cell = td.children[i];
      for (var j = 0; j < cell.children.length; j++) {
        var bar = cell.children[j], m = hasCls(bar, "usage-disk") && bar.children[0] && /^cpu(\d+)$/.exec(bar.children[0].id || "");
        if (m) { out.push({ n: +m[1], cell: cell }); break; }
      }
    }
    return out;
  }

  function coreHead(gr) {
    var h = el("div", "cc-cores-head"), name = el("span"), n = el("span", "cc-cores-n");
    var threads = gr.cores.reduce(function (a, c) { return a + c.threads.length; }, 0);
    name.textContent = t(gr.type) || gr.type;
    n.textContent = (threads > gr.cores.length ? t("coresHt") : t("cores")).replace("%c", gr.cores.length).replace("%t", threads);
    h.appendChild(name); h.appendChild(n);
    return h;
  }

  var CORES = [];
  function gridOf(rows) {
    var groups = [], byType = {}, moved = [];
    rows.forEach(function (tr) {
      var td = tr.children[0], label = td.children[0], m = /\(([^)]+)\)/.exec((label && label.textContent) || ""), type = m ? m[1].trim() : "";
      if (!byType[type]) groups.push(byType[type] = { type: type, cores: [] });
      byType[type].cores.push({ td: td, threads: threadsOf(tr) });
    });
    var box = el("div", "cc-cores");
    groups.forEach(function (gr) {
      var wrap = el("div", "cc-cores-group"), grid = el("div", "cc-cores-grid");
      // A CPU without core types is one plain group and needs no heading.
      if (gr.type) wrap.appendChild(coreHead(gr));
      gr.cores.forEach(function (c) {
        var core = el("div", c.threads.length > 1 ? "cc-core cc-core-ht" : "cc-core");
        c.threads.forEach(function (th, k) {
          var cell = el("div", "cc-thr"), n = el("span", "cc-thr-n");
          n.textContent = (k ? "HT " : "CPU ") + th.n;
          moved.push([th.cell, c.td]);
          cell.appendChild(n); cell.appendChild(th.cell);
          core.appendChild(cell);
        });
        grid.appendChild(core);
      });
      wrap.appendChild(grid);
      box.appendChild(wrap);
    });
    // The grid lives in the run's first row. Unraid watches every core row to decide whether the
    // per core values are on screen, and this one stays visible while the grid is.
    var td = el("td", "cc-cores-td");
    td.appendChild(box);
    rows[0].appendChild(td);
    rows[0].classList.add("cc-cores-host");
    for (var i = 1; i < rows.length; i++) rows[i].classList.add("cc-cores-spent");
    CORES.push({ rows: rows, td: td, moved: moved });
  }

  // Each physical CPU of a multi socket board has its own run of core rows under its own power
  // line, so each run becomes its own grid.
  function buildCores() {
    var main = document.getElementById("cpu_main");
    if (CORES.length || !main) return;
    var rows = main.parentNode.children, run = [];
    for (var i = 0; i < rows.length; i++) {
      if (threadsOf(rows[i]).length) run.push(rows[i]);
      else if (run.length) { gridOf(run); run = []; }
    }
    if (run.length) gridOf(run);
  }

  function unbuildCores() {
    CORES.forEach(function (c) {
      c.moved.forEach(function (m) { m[1].appendChild(m[0]); });
      c.td.parentNode.removeChild(c.td);
      c.rows.forEach(function (tr) { tr.classList.remove("cc-cores-host"); tr.classList.remove("cc-cores-spent"); });
    });
    CORES = [];
  }

  // Text nodes CC rewrote, with Unraid's wording, so switching the area off puts it back.
  var SWAPS = [];
  function swap(node, text) {
    if (!node || node.nodeType !== 3 || node.nodeValue === text) return;
    if (SWAPS.length > 40) SWAPS = SWAPS.filter(function (s) { return s[0].isConnected; });
    SWAPS.push([node, node.nodeValue, text]);
    node.nodeValue = text;
  }
  function unswap() {
    SWAPS.forEach(function (s) { if (s[0].nodeValue === s[2]) s[0].nodeValue = s[1]; });
    SWAPS = [];
  }

  // Strings the German translation of Unraid leaves in English or gets wrong. Each is found by its
  // place in the card, and only Unraid's own wording is replaced, so a fixed translation stays.
  function pie(id, label, tip) {
    var p = document.getElementById(id), a = p && p.previousElementSibling;
    if (!hasCls(a, "info")) return;
    if (label) swap(a.firstChild, label);
    var s = a.querySelector("span"), n = s && s.firstChild;
    if (tip && n && n.nodeType === 3 && /^\s*Percent usage/.test(n.nodeValue)) swap(n, tip + ((/\s\([^)]*\)\s*$/.exec(n.nodeValue) || [""])[0]));
  }
  function fixCards() {
    if (LANG !== "de") return;
    pie("sys1", "Boot-Gerät", "Nutzungsanteil des Boot-Geräts in Prozent");
    pie("sys2", "Log-Dateisystem");
    pie("sys3", "", "Nutzungsanteil des Docker-Speichers in Prozent");
    var hs = document.querySelectorAll("table.dashboard tr.header span.w18");
    for (var i = 0; i < hs.length; i++) for (var n = hs[i].firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /^\s*Mbr Status\s*$/i.test(n.nodeValue)) swap(n, "MBR-Status");
  }

  // Unraid prints "---" for a server without a model name, which says nothing, so the model block
  // goes until one is set under Identification. The fallback case picture is handled in the sheet.
  function hideModel() {
    var hd = document.querySelector("table.dashboard tbody.system .leftside > span.header");
    if (!hd || hd.parentNode.querySelector(".cc-dash-model")) return;
    var nodes = [hd], val = "";
    for (var n = hd.nextSibling; n && !(n.nodeType === 1 && n.matches("span.header")); n = n.nextSibling) { nodes.push(n); val += n.textContent; }
    if (val.trim() !== "---") return;
    var w = el("span", "cc-dash-model");
    hd.parentNode.insertBefore(w, hd);
    nodes.forEach(function (x) { w.appendChild(x); });
  }
  function showModel() {
    var w = document.querySelector("table.dashboard .cc-dash-model");
    if (!w) return;
    while (w.firstChild) w.parentNode.insertBefore(w.firstChild, w);
    w.parentNode.removeChild(w);
  }

  // An uploaded case picture is drawn in the mode colour through its own alpha, which only works for
  // a cut-out. Unraid swaps the picture after a new case is chosen, so this runs with the feed too.
  function tintCase() {
    var img = document.querySelector("table.dashboard #casing > img#mycase");
    if (!img || img.getAttribute("data-cc-case")) return;
    function look() {
      var cut = false;
      try {
        var c = document.createElement("canvas"); c.width = c.height = 48;
        var x = c.getContext("2d"); x.drawImage(img, 0, 0, 48, 48);
        var d = x.getImageData(0, 0, 48, 48).data;
        for (var i = 3; i < d.length && !cut; i += 4) cut = d[i] < 250;
      } catch (e) {}
      img.setAttribute("data-cc-case", cut ? "cut" : "photo");
      if (cut) img.style.setProperty("--cc-case-src", 'url("' + img.src.replace(/"/g, "%22") + '")');
    }
    if (img.complete && img.naturalWidth) look(); else img.addEventListener("load", look, { once: true });
  }

  // The disk rows and the pools' usage line come new with every message of Unraid's feed. A disk
  // that is spun down shows "*" for its temperature; it reads as resting, as on /Main.
  var USED = /^\s*Used:\s*(.+?)\s+of\s+(.+?)\s*\(([^)]*)\)\s*$/;
  function fixRows() {
    var cs = document.querySelectorAll("table.dashboard tr.updated > td > span.w18:nth-of-type(3)");
    for (var i = 0; i < cs.length; i++) {
      var n = cs[i].firstChild;
      if (!n || n.nodeType !== 3 || n.nodeValue.trim() !== "*") continue;
      var r = el("span", "cc-dash-rest");
      r.innerHTML = (window.CCTheme && CCTheme.glyph ? CCTheme.glyph("Moon") : "") + t("resting");
      cs[i].replaceChild(r, n);
    }
    if (LANG !== "de") return;
    var us = document.querySelectorAll("table.dashboard [id^='pool_usage']");
    for (var j = 0; j < us.length; j++) {
      var m = us[j].firstChild && USED.exec(us[j].firstChild.nodeValue || "");
      if (m) swap(us[j].firstChild, m[1] + " von " + m[2] + " verwendet (" + m[3] + ")");
    }
    var as = document.querySelectorAll("table.dashboard tr.updated span.w26 > a[title$=' settings']");
    for (var k = 0; k < as.length; k++) as[k].title = "Einstellungen für " + as[k].title.replace(/ settings$/, "");
  }
  function unfixRows() {
    var rs = document.querySelectorAll("table.dashboard .cc-dash-rest");
    for (var i = 0; i < rs.length; i++) rs[i].parentNode.replaceChild(document.createTextNode("*"), rs[i]);
  }

  var hooked = false;
  function hookFeed() {
    var feed = window.dashboard;
    if (hooked || !feed || typeof feed.on !== "function") return;
    hooked = true;
    feed.on("message", function () { if (wasLive) { fixRows(); tintCase(); } });
  }

  var wasLive = false;
  function apply() {
    var live = isLive();
    document.documentElement.classList.toggle("cc-dash-on", live);
    if (live) { decorate(); badgeControls(); paint(); paintCharts(true); buildCores(); fixCards(); hideModel(); hideDupName(); tintCase(); fixRows(); hookFeed(); }
    else if (wasLive) { strip(); unbadgeControls(); paintCharts(false); unbuildCores(); unswap(); showModel(); showDupName(); unfixRows(); }
    wasLive = live;
  }

  function boot() {
    if (!onDash()) return;
    apply();
    // dynamix fills in plugin tiles and starts the charts after its own load handlers, so the pass
    // runs again once that has happened.
    setTimeout(apply, 1500);
    setTimeout(apply, 5000);
    try { if (window.jQuery) window.jQuery(document).on("sortupdate", "table.dashboard, .grid", function () { if (isLive()) paint(); }); } catch (e) {}
    document.addEventListener("click", function (e) { if (wasLive && e.target.closest && e.target.closest("table.dashboard .cc-dash-btn")) renameFolds(); });
    // cc.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^cc\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
