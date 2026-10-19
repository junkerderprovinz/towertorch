// Lays Unraid's native settings forms out as GlimStone cards. Loaded on every page through
// CannonadeCommand.Forms.page, it stamps html.cc-forms-on on the Settings and Tools sub-pages, the
// disk, pool and boot device pages and the share edit page; the look lives in
// sheets/CannonadeCommand.Forms.css. No field leaves its form, is renamed or is submitted from
// here: a card is a class on Unraid's own form, and every control drawn in place of a native one
// writes back to that input and fires its events.
(function () {
  "use strict";
  var root = document.documentElement;
  var LANG = (root.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  function T(de, en) { return LANG === "de" ? de : en; }

  // Rows in these belong to a layout of their own: the share page's copy-settings card, data
  // tables, dialogs, the reka editors and CC's own windows.
  var SKIP = ".cc-side-card, .clone-settings, table, .ui-dialog, .main-content, #cc-settings, .cc-pop, .cc-win, .sweet-alert, .unapi";
  var FIELD = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="hidden"]), select, textarea, .cc-tsel, .cc-sel, .cc-tgl, .switch-button-background, .ui-dropdownchecklist';
  var BUTTON = 'input[type="button"], input[type="submit"], input[type="reset"], button, a.button';
  var APPLY = /^(anwenden|apply|übernehmen|speichern|save)$/i;
  // The short sentences a page leaves on screen under a field, which move into the row's bubble.
  var HINT = "dd span.input-instructions, dd span.orange-text, dd i:not([class]), dd small, dd span[id^='moverAction']";

  // Settings that Unraid ships without any help text of their own, keyed by page and field name.
  var TIPS = {
    "/Settings/DisplaySettings": {
      font: ["Die Schriftgröße der ganzen Oberfläche.", "The font size of the whole interface."],
      tty: ["Die Schriftgröße im Terminalfenster.", "The font size in the terminal window."],
      number: ["Wie Tausender und Nachkommastellen geschrieben werden.", "How thousands and decimals are written."],
      scale: ["In welcher Einheit Größen angezeigt werden.", "Which unit sizes are shown in."],
      wwn: ["Zeigt die WWN-Kennung der Datenträger an.", "Shows the WWN identifier of the disks."],
      total: ["Zeigt eine Summenzeile unter den Datenträgern.", "Shows a totals row under the disks."],
      usage: ["Zeigt die Belegung der Datenträger als Balken.", "Shows disk usage as a bar."],
      text: ["Wie die Spalten für belegt und frei aussehen.", "How the used and free columns look."],
      theme: ["Das Farbschema von Unraid.", "Unraid's colour theme."],
      header: ["Die Textfarbe der Kopfzeile, als Hex-Farbcode.", "The text colour of the header, as a hex colour code."],
      headermetacolor: ["Die Farbe der zweiten Textzeile in der Kopfzeile.", "The colour of the second text line in the header."],
      background: ["Die Hintergrundfarbe der Kopfzeile.", "The background colour of the header."],
      headerdescription: ["Zeigt die Serverbeschreibung in der Kopfzeile.", "Shows the server description in the header."],
      unit: ["Ob Temperaturen in Celsius oder Fahrenheit angezeigt werden.", "Whether temperatures show in Celsius or Fahrenheit."],
      banner: ["Zeigt ein Bild im Hintergrund der Kopfzeile.", "Shows an image behind the header."]
    },
    "/Settings/DiskSettings": {
      zfs_arc_mode: ["Wie viel Arbeitsspeicher ZFS höchstens als Lesecache nutzt.", "How much memory ZFS may use at most as its read cache."],
      display_warning: ["Ab dieser Belegung in Prozent gilt ein Datenträger als fast voll.", "From this usage in percent a disk counts as nearly full."]
    },
    "/Settings/Notifications": {
      status: ["Wie oft eine Meldung zum Zustand des Arrays verschickt wird.", "How often a report on the array's state is sent."],
      unraid1: ["Wohin jede Art von Meldung zugestellt wird.", "Where each kind of notification is delivered."]
    },
    "/Settings/DateTime": {
      display_date: ["Wie Datumsangaben geschrieben werden.", "How dates are written."],
      display_time: ["Ob die Uhr 12 oder 24 Stunden zählt.", "Whether the clock counts 12 or 24 hours."],
      timeZone: ["Die Zeitzone des Servers.", "The server's time zone."],
      USE_NTP: ["Stellt die Uhr automatisch über Zeitserver im Netz.", "Sets the clock automatically from time servers on the network."],
      NTP_SERVER2: ["Ein weiterer Zeitserver, falls der erste nicht antwortet.", "Another time server, in case the first one does not answer."],
      NTP_SERVER3: ["Ein weiterer Zeitserver, falls der erste nicht antwortet.", "Another time server, in case the first one does not answer."],
      NTP_SERVER4: ["Ein weiterer Zeitserver, falls der erste nicht antwortet.", "Another time server, in case the first one does not answer."]
    },
    "/Settings/StatSettings": {
      first: ["Welche Ansicht die Statistik-Seite zuerst zeigt.", "Which view the Stats page shows first."]
    },
    "/Settings/ShareSettings": {
      shareUserEmptying: ["Datenträger, die gerade geleert werden und keine neuen Dateien mehr bekommen.", "Disks that are being emptied and get no new files."]
    }
  };

  function active() {
    if (/^\/Apps\/ca_settings/i.test(location.pathname)) return false;
    return root.classList.contains("cc-tools-on") || root.classList.contains("cc-on-share-detail");
  }
  function hidden(e) { return getComputedStyle(e).display === "none"; }
  function isRow(dl) { return !!dl.querySelector(":scope > dt, :scope > dd"); }
  function text(e) { return (e.textContent || "").replace(/\s+/g, " ").trim(); }
  function infoSvg() { return window.CCTheme && window.CCTheme.CC_INFO_SVG ? window.CCTheme.CC_INFO_SVG : "i"; }

  // A run of rows outside a form shares its parent as the card, unless that parent also holds
  // titles or forms, which would put one card inside another.
  function cardHost(dl, box) {
    var f = dl.closest("form");
    if (f && box.contains(f)) return f;
    var p = dl.parentElement;
    if (p && p !== box && !p.querySelector("form, div.title")) return p;
    return dl;
  }
  function markCards(box) {
    var dls = box.querySelectorAll("dl"), cards = [];
    for (var i = 0; i < dls.length; i++) {
      var dl = dls[i];
      // The Basic/Advanced switch stands at the card's top right corner, not in a card of its own.
      if (!isRow(dl) || dl.closest(SKIP) || dl.querySelector(".advancedview")) continue;
      var host = cardHost(dl, box);
      if (host.parentElement && host.parentElement.closest(".cc-fm-card")) continue;
      host.classList.add("cc-fm-card");
      if (cards.indexOf(host) < 0) cards.push(host);
    }
    return cards;
  }
  // Unassigned Devices titles its sections with a table of one header cell and no body.
  function titleTable(t) {
    return t.tagName === "TABLE" && t.rows.length === 1 && t.rows[0].cells.length === 1 && t.rows[0].cells[0].tagName === "TH";
  }
  // The section title right before a card becomes the badge on the card's top edge.
  // A card that opens its own wrapper (the VPN tunnel's block) takes the title before the wrapper.
  function markHead(card) {
    var at = card, p = null;
    for (var up = 0; up < 3 && at; up++) {
      p = at.previousElementSibling;
      while (p && (p.tagName === "SCRIPT" || p.tagName === "STYLE" || hidden(p) || (!p.offsetHeight && !text(p)))) p = p.previousElementSibling;
      if (p || !at.parentElement || at.parentElement.matches("#displaybox, .content, .tab-content")) break;
      at = at.parentElement;
    }
    var head = p && (p.matches("div.title, div#title") || titleTable(p)) && !p.closest(".cc-fm-card") ? p : null;
    if (head) head.classList.add("cc-fm-head");
    card.classList.toggle("cc-fm-headed", !!head);
  }
  function labelOf(dd) {
    var p = dd.previousElementSibling;
    while (p && p.tagName !== "DD" && (p.tagName !== "DT" || hidden(p))) p = p.previousElementSibling;
    return p && p.tagName === "DT" && (text(p) || p.querySelector(".cc-toolsinfo")) ? p : null;
  }
  // A label loses its trailing colon. Some pages swap the label text live, so every pass looks.
  function stripColon(dt) {
    var w = document.createTreeWalker(dt, NodeFilter.SHOW_TEXT), n, last = null;
    while ((n = w.nextNode())) if (n.nodeValue.trim()) last = n;
    if (last && /:\s*$/.test(last.nodeValue)) last.nodeValue = last.nodeValue.replace(/\s*:\s*$/, "");
  }
  // A label or value whose every child is hidden (the Notifications page keeps one per message type)
  // would still take a grid row and its gap.
  function empty(c) {
    for (var n = c.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return false;
      if (n.nodeType === 1 && !hidden(n)) return false;
    }
    return true;
  }
  // A dd without a label of its own (a checkbox list, the button row) spans the row, and a row of
  // nothing but buttons is the card's action row.
  function markRows(card) {
    var dls = Array.prototype.slice.call(card.querySelectorAll("dl"));
    if (card.tagName === "DL") dls.unshift(card);
    for (var i = 0; i < dls.length; i++) {
      var dl = dls[i];
      if (!isRow(dl) || dl.closest(SKIP) || dl.closest(".cc-fm-card") !== card) continue;
      var fields = false, buttons = false;
      for (var c = dl.firstElementChild; c; c = c.nextElementSibling) {
        if (c.tagName === "DT" && text(c)) stripColon(c);
        if (c.tagName !== "DD" && c.tagName !== "DT") continue;
        var f = !!c.querySelector(FIELD), b = !f && !!c.querySelector(BUTTON);
        if (c.tagName === "DD") { c.classList.toggle("cc-fm-wide", !labelOf(c)); c.classList.toggle("cc-fm-btns", b); }
        c.classList.toggle("cc-fm-void", !b && !f && empty(c));
        if (f) fields = true; else if (b) buttons = true;
      }
      dl.classList.toggle("cc-fm-actions", buttons && !fields);
    }
  }

  // The (i) on a row's label. header.js draws its own as a text glyph on the Tools and Settings
  // pages; both become GlimStone's stroke glyph, and the text they carry stays in data-cc-tip.
  function ensureInfo(dt) {
    var ic = dt.querySelector(".cc-toolsinfo");
    if (!ic) {
      ic = document.createElement("span");
      ic.className = "cc-toolsinfo cc-fm-made";
      (dt.querySelector(":scope > span") || dt).appendChild(ic);
    }
    return ic;
  }
  function upgradeInfo(ic) {
    if (!ic.querySelector("svg")) ic.innerHTML = infoSvg();
    if (!ic.hasAttribute("tabindex")) ic.tabIndex = 0;
  }
  function helpIcons(card) {
    var bqs = card.querySelectorAll("blockquote.inline_help:not([data-cc-help]), .inline-help:not([data-cc-help])");
    for (var i = 0; i < bqs.length; i++) {
      var bq = bqs[i]; bq.setAttribute("data-cc-help", "1");
      var txt = (bq.textContent || "").trim(); if (!txt) continue;
      var dd = bq.closest("dd"), lab = dd ? labelOf(dd) : null;
      if (!dd) {
        var pv = bq.previousElementSibling;
        while (pv && pv.tagName !== "DL" && pv.tagName !== "DT") pv = pv.previousElementSibling;
        if (pv && pv.tagName === "DL") {
          var dts = pv.querySelectorAll(":scope > dt");
          for (var k = 0; k < dts.length && !lab; k++) if (text(dts[k])) lab = dts[k];
        } else lab = pv;
      }
      if (!lab) continue;
      var ic = ensureInfo(lab);
      if (!ic.getAttribute("data-cc-tip")) ic.setAttribute("data-cc-tip", txt);
    }
  }
  function namedTips(card) {
    var dts = card.querySelectorAll("dl > dt");
    for (var i = 0; i < dts.length; i++) {
      var dt = dts[i];
      if (!text(dt) || dt.querySelector(".cc-toolsinfo")) continue;
      var dd = dt.nextElementSibling;
      var f = dd && dd.tagName === "DD" ? dd.querySelector("[name]") : null;
      var tip = f && (TIPS[location.pathname] || {})[f.getAttribute("name")];
      if (tip) ensureInfo(dt).setAttribute("data-cc-tip", T(tip[0], tip[1]));
    }
  }

  // Hint text under a field moves into the bubble of the row's (i), behind the help text that is
  // already there. The hint element stays in the page, hidden, and is read again on every pass,
  // since some of them are rewritten live (the mover note on the share page). One that is hidden
  // when first seen is a validation message waiting for its error, and is left alone.
  function hints(card, extra) {
    var hs = card.querySelectorAll(HINT + ', dd.cc-fm-btns span:not([class]), [data-cc-fmhint="1"]');
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!h.hasAttribute("data-cc-fmhint")) {
        // A sentence with a warning sign is a warning about the current state and stays on the page.
        var plain = !hidden(h) && text(h) && !h.querySelector(FIELD + ", " + BUTTON + ", .fa-warning, .fa-exclamation-triangle");
        h.setAttribute("data-cc-fmhint", plain ? "1" : "skip");
      }
      if (h.getAttribute("data-cc-fmhint") !== "1") continue;
      var dd = h.closest("dd"), lab = dd && !dd.classList.contains("cc-fm-btns") ? labelOf(dd) : null, ic;
      if (lab) ic = ensureInfo(lab);
      else {
        ic = h.ccFmIcon;
        if (!ic || !ic.parentNode) {
          ic = h.ccFmIcon = document.createElement("span");
          ic.className = "cc-toolsinfo cc-fm-made cc-fm-hinticon";
          h.parentNode.insertBefore(ic, h);
          // A link in the sentence would be dead inside a bubble, so it stays on the page as a badge.
          var as = h.querySelectorAll("a[href], a[onclick]");
          for (var a = 0; a < as.length; a++) {
            var cl = as[a].cloneNode(true); cl.classList.add("cc-fm-link", "cc-fm-made");
            h.parentNode.insertBefore(cl, h);
          }
        }
      }
      h.classList.add("cc-fm-hinted");
      (extra.get(ic) || extra.set(ic, []).get(ic)).push(text(h));
    }
    // Unraid's own blue info glyphs carry their text in a title; they become the same (i).
    var fa = card.querySelectorAll("i.fa-info-circle:not([data-cc-fmfa]), i.fa-info:not([data-cc-fmfa])");
    for (var j = 0; j < fa.length; j++) {
      var f = fa[j], tip = f.getAttribute("title") || f.getAttribute("data-cc-tip") || "";
      f.setAttribute("data-cc-fmfa", "1");
      if (!tip) {
        if (f.parentElement && f.parentElement.querySelector(".cc-fm-hinted")) f.classList.add("cc-fm-hinted");
        continue;
      }
      var ni = document.createElement("span");
      ni.className = "cc-toolsinfo cc-fm-made";
      ni.setAttribute("data-cc-tip", tip);
      if (f.getAttribute("onclick")) ni.addEventListener("click", (function (src) { return function () { src.click(); }; })(f));
      f.parentNode.insertBefore(ni, f.nextSibling);
      f.classList.add("cc-fm-hinted");
    }
  }
  // An explanation banner inside a card (the language page's notice) goes into the bubble of the
  // card's first label, so no info strip stands over the settings (GlimStone rule 31).
  function notices(card, extra) {
    var ns = card.querySelectorAll(".notice, .info-box");
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (!n.classList.contains("cc-fm-hinted") && (hidden(n) || !text(n))) continue;
      var dts = card.querySelectorAll("dl > dt"), lab = null;
      for (var k = 0; k < dts.length && !lab; k++) if (text(dts[k]) && !hidden(dts[k])) lab = dts[k];
      if (!lab) continue;
      n.classList.add("cc-fm-hinted");
      var ic = ensureInfo(lab);
      (extra.get(ic) || extra.set(ic, []).get(ic)).push(text(n));
    }
  }
  // The boot parameters editor explains each section in a box under its heading; the text moves
  // onto an (i) in the heading badge.
  function sectionBoxes(box) {
    var ws = box.querySelectorAll(".main-content section.section > .warning-box:not([data-cc-fmhint])");
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], h = w.parentElement.querySelector("h3.section-header");
      w.setAttribute("data-cc-fmhint", "box");
      if (!h || !text(w)) continue;
      var ic = document.createElement("span");
      ic.className = "cc-toolsinfo cc-fm-made";
      ic.setAttribute("data-cc-tip", text(w)); ic.setAttribute("aria-label", text(w));
      h.appendChild(ic); upgradeInfo(ic);
      w.classList.add("cc-fm-hinted");
    }
  }
  function writeTips(box, extra) {
    var ics = box.querySelectorAll(".cc-fm-card .cc-toolsinfo, .cc-fm-head .cc-toolsinfo");
    for (var i = 0; i < ics.length; i++) {
      var ic = ics[i];
      if (!ic.hasAttribute("data-cc-fmbase")) ic.setAttribute("data-cc-fmbase", ic.getAttribute("data-cc-tip") || "");
      var parts = [ic.getAttribute("data-cc-fmbase")].concat(extra.get(ic) || []).filter(Boolean);
      var tip = parts.join("\n\n");
      if (ic.getAttribute("data-cc-tip") !== tip) ic.setAttribute("data-cc-tip", tip);
      if (ic.getAttribute("aria-label") !== tip) ic.setAttribute("aria-label", tip);
      upgradeInfo(ic);
    }
  }

  // A group of radio buttons becomes the one horizontal selector. The radios stay in the form,
  // hidden, and a segment clicks its radio, so Unraid's own handlers run as before.
  function segments(card) {
    var radios = card.querySelectorAll('input[type="radio"]:not([data-cc-seg])'), groups = {};
    for (var i = 0; i < radios.length; i++) { var n = radios[i].name || ""; (groups[n] = groups[n] || []).push(radios[i]); }
    Object.keys(groups).forEach(function (name) {
      var rs = groups[name]; if (rs.length < 2) return;
      var first = rs[0].closest("dd"); if (!first) return;
      var strip = document.createElement("span");
      strip.className = "cc-fm-seg cc-fm-made"; strip.setAttribute("role", "radiogroup");
      var btns = rs.map(function (r) {
        r.setAttribute("data-cc-seg", "1");
        var lab = r.closest("label, span") || r.parentElement;
        var b = document.createElement("span");
        b.className = "cc-fm-segbtn"; b.setAttribute("role", "radio"); b.textContent = text(lab) || r.value;
        b.addEventListener("click", function () { if (!r.disabled && !r.checked) r.click(); sync(); });
        r.addEventListener("change", sync);
        lab.classList.add("cc-fm-segsrc");
        var dd = r.closest("dd");
        if (dd && dd !== first) dd.classList.add("cc-fm-segsrc");
        return b;
      });
      strip.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.target.click(); return; }
        if (!d) return;
        e.preventDefault();
        var at = btns.indexOf(e.target), nx = btns[(at + d + btns.length) % btns.length];
        nx.click(); nx.focus();
      });
      function sync() {
        btns.forEach(function (b, k) {
          var on = rs[k].checked;
          b.classList.toggle("cc-fm-segon", on);
          b.setAttribute("aria-checked", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
          b.classList.toggle("cc-fm-segoff", !!rs[k].disabled);
        });
        if (!rs.some(function (r) { return r.checked; })) btns[0].tabIndex = 0;
      }
      btns.forEach(function (b) { strip.appendChild(b); });
      first.appendChild(strip);
      sync();
    });
  }

  // unbalanced lays its settings out in a grid of its own instead of dl rows. Its form is a card
  // all the same, with the page title as the badge; Forms.css draws the version line between the
  // two into the card's top corner.
  function unbalanced(box) {
    var f = box.querySelector('form[name="unbalanced_settings"]');
    if (!f) return;
    f.classList.add("cc-fm-card", "cc-fm-headed", "cc-fm-ub");
    var labels = f.querySelectorAll(".unbalanced-settings-panel > .label");
    for (var i = 0; i < labels.length; i++) stripColon(labels[i]);
    for (var p = f.previousElementSibling; p && !p.matches("div.title"); p = p.previousElementSibling) {
      if (p.tagName === "B") p.classList.add("cc-fm-ubver");
    }
    if (p) p.classList.add("cc-fm-head");
  }

  function enhance() {
    var on = active();
    root.classList.toggle("cc-forms-on", on);
    if (!on) { teardown(); return; }
    var box = document.getElementById("displaybox"); if (!box) return;
    unbalanced(box);
    var cards = markCards(box), extra = new Map();
    for (var i = 0; i < cards.length; i++) {
      markHead(cards[i]); markRows(cards[i]); helpIcons(cards[i]); namedTips(cards[i]);
      hints(cards[i], extra); notices(cards[i], extra); segments(cards[i]);
    }
    writeTips(box, extra);
    sectionBoxes(box);
    var bs = box.querySelectorAll(BUTTON);
    for (var b = 0; b < bs.length; b++) {
      var lbl = (bs[b].value || bs[b].textContent || "").trim();
      bs[b].classList.toggle("cc-fm-primary", APPLY.test(lbl) || bs[b].name === "#apply");
    }
  }
  // With theming switched off the sheet goes inert, so only what this script added is taken back.
  function teardown() {
    var made = document.querySelectorAll("#displaybox .cc-fm-made");
    for (var i = 0; i < made.length; i++) if (made[i].parentNode) made[i].parentNode.removeChild(made[i]);
    var segs = document.querySelectorAll("#displaybox [data-cc-seg]");
    for (var s = 0; s < segs.length; s++) segs[s].removeAttribute("data-cc-seg");
    var marks = document.querySelectorAll("#displaybox [data-cc-fmhint], #displaybox [data-cc-fmfa]");
    for (var m = 0; m < marks.length; m++) { marks[m].removeAttribute("data-cc-fmhint"); marks[m].removeAttribute("data-cc-fmfa"); }
  }

  var pending = null;
  function later() { if (pending) return; pending = setTimeout(function () { pending = null; try { enhance(); } catch (e) {} }, 120); }
  function boot() {
    try { enhance(); } catch (e) {}
    var box = document.getElementById("displaybox");
    // Unraid shows and hides rows through their style, which decides what counts as an empty row.
    if (box) new MutationObserver(function () { if (active() || root.classList.contains("cc-forms-on")) later(); }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    // header.js and shares.js stamp the page classes this gate reads, some of them after load.
    new MutationObserver(function () { if (active() !== root.classList.contains("cc-forms-on")) later(); }).observe(root, { attributes: true, attributeFilter: ["class"] });
    var n = 0, iv = setInterval(function () { later(); if (++n >= 10) clearInterval(iv); }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
