// The share tiles on /Shares. Loaded on every page through CannonadeCommand.Shares.page and live
// only where the Freigaben area styles /Shares (shares.js), it puts one Liste/Kacheln switch in the
// tab bar and draws one card per user share and per disk share.
//
// The cards read Unraid's own share tables, which stay in the page, hidden. Unraid refills them on
// every listing and every Compute, so the tiles follow the same refills, and every action clicks
// the control the row itself carries.
(function () {
  "use strict";
  var KEY = "cc.shareview";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var TXT = {
    de: { view: "Ansicht", list: "Liste", tiles: "Kacheln", browse: "Durchsuchen", compute: "Berechnen", recompute: "Neu berechnen", settings: "Einstellungen",
      used: "belegt", free: "frei", of: "von", off: "aus", outside: "Liegt außerhalb der zugewiesenen Datenträger",
      protected: "Geschützt", partly: "Nicht alles geschützt", unknown: "Schutz unbekannt" },
    en: { view: "View", list: "List", tiles: "Tiles", browse: "Browse", compute: "Compute", recompute: "Compute again", settings: "Settings",
      used: "used", free: "free", of: "of", off: "off", outside: "Lies outside the designated disks",
      protected: "Protected", partly: "Not fully protected", unknown: "Protection unknown" }
  };
  function t(k) { return (TXT[LANG] || TXT.en)[k] || TXT.en[k]; }

  function pn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }
  // The same gate as the Freigaben styling in shares.js, which needs Unraid's tabbed mode.
  function live() {
    return g("cc.theming", "1") !== "0" && g("cc.enable.shares", "0") !== "0" && pn() === "/Shares" && !!document.querySelector("#displaybox nav.tabs");
  }
  // One key for both tables, written by the switch and by the settings page.
  function view() { return g(KEY, "tiles") === "list" ? "list" : "tiles"; }

  // Tree helpers that use children, childNodes, tagName and getAttribute only, so the readers run
  // on the live rows, on the rows shares.js has badged, and on the test shim alike.
  function kids(n) { return n && n.children ? Array.prototype.slice.call(n.children) : []; }
  function tag(n) { return (n && n.tagName || "").toUpperCase(); }
  function attr(n, k) { return (n && n.getAttribute && n.getAttribute(k)) || ""; }
  function hasCls(n, c) { return (" " + attr(n, "class") + " ").indexOf(" " + c + " ") >= 0; }
  function find(n, pred) {
    var ks = kids(n);
    for (var i = 0; i < ks.length; i++) { if (pred(ks[i])) return ks[i]; var r = find(ks[i], pred); if (r) return r; }
    return null;
  }
  // Text as it reads, without the hidden tooltip span of Unraid's a.info.
  function text(n) {
    var out = "", cn = n && n.childNodes ? n.childNodes : [];
    for (var i = 0; i < cn.length; i++) {
      var c = cn[i];
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1 && !(tag(c) === "SPAN" && hasCls(c.parentNode, "info"))) out += text(c);
    }
    return out;
  }
  function clean(v) { return String(v || "").replace(/[   ]/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  // Unraid scales every size to three digits, so a lone comma is a decimal comma.
  var POW = { B: 0, K: 1, M: 2, G: 3, T: 4, P: 5 };
  function bytes(v) {
    var m = /([\d.,]+)\s*([KMGTP]?)i?B\b/i.exec(clean(v)); if (!m) return null;
    return parseFloat(m[1].replace(",", ".")) * Math.pow(1000, POW[(m[2] || "B").toUpperCase()]);
  }

  // The cells Unraid wrote, without the Browse column shares.js inserts.
  function cells(tr) { return kids(tr).filter(function (c) { return tag(c) === "TD" && !hasCls(c, "cc-browse-col"); }); }
  function computeLink(td) { return find(td, function (n) { return tag(n) === "A" && /compute(Share|Disk)\(/.test(attr(n, "onclick")); }); }
  // While Compute runs, Unraid writes a spinner and "Please wait" into the cell it was started from.
  function waiting(td) {
    return find(td, function (n) { return tag(n) === "I" && hasCls(n, "fa-spin"); }) ? clean(text(td)).replace(/\s*(\.\.\.|…)$/, "") : "";
  }
  // The storage cell as icons and words: Unraid's glyphs keep their classes, the words are
  // escaped, and the tooltip span becomes the bubble text.
  function storage(td) {
    var a = find(td, function (n) { return tag(n) === "A" && hasCls(n, "info"); });
    if (!a) { var plain = clean(text(td)); return plain ? { html: esc(plain), tip: "" } : null; }
    var html = "", tip = "";
    (function walk(n) {
      var cn = n.childNodes || [];
      for (var i = 0; i < cn.length; i++) {
        var c = cn[i];
        if (c.nodeType === 3) html += esc(c.nodeValue);
        else if (tag(c) === "I") html += '<i class="' + esc(attr(c, "class")) + '"></i>';
        else if (tag(c) === "SPAN" && c.parentNode === a) tip = clean(text(c));
        else if (c.nodeType === 1) walk(c);
      }
    })(a);
    return { html: html.replace(/\s+/g, " ").trim(), tip: tip };
  }
  // A share or disk row: its name link leads to the settings page. A row without one is the
  // per-disk breakdown Compute adds below its share, and Recompute runs from its name cell.
  function readRow(tr) {
    var td = cells(tr), nameTd = td[0];
    var link = find(nameTd, function (n) { return tag(n) === "A" && /\/(Share|Disk)\?name=/.test(attr(n, "href")); });
    if (!link) {
      var again = computeLink(nameTd), wait = waiting(nameTd);
      if (wait) return { part: true, busy: wait };
      if (!again) return null;
      return { part: true, name: clean(text(nameTd)), size: clean(text(td[5])), outside: hasCls(tr, "warning"), again: again };
    }
    var browse = find(tr, function (n) { return tag(n) === "A" && hasCls(n, "view") && !!attr(n, "href"); });
    var orb = find(nameTd, function (n) { return tag(n) === "I" && hasCls(n, "orb"); });
    var tipSpan = orb && orb.parentNode && find(orb.parentNode, function (n) { return tag(n) === "SPAN"; });
    var size = td[5], comp = computeLink(size), busy = waiting(size);
    return {
      name: clean(text(link)), link: link, browse: browse,
      prot: !orb ? "" : hasCls(orb, "green-orb") ? "ok" : hasCls(orb, "yellow-orb") ? "warn" : "idle",
      protTip: tipSpan ? clean(text(tipSpan)) : "",
      comment: clean(text(td[1])),
      smb: clean(text(td[2])), nfs: clean(text(td[3])),
      store: storage(td[4]),
      compute: comp, busy: busy,
      size: comp || busy ? "" : clean(text(size)), free: clean(text(td[6])),
      parts: []
    };
  }
  // One table body as a list of shares, or the notice Unraid writes when there is none.
  function readList(tb) {
    var out = { shares: [], notice: "" };
    kids(tb).forEach(function (tr) {
      if (tag(tr) !== "TR") return;
      var empty = find(tr, function (n) { return tag(n) === "TD" && hasCls(n, "empty"); });
      if (empty) { out.notice = clean(text(empty)); return; }
      var r = readRow(tr);
      if (!r) return;
      if (r.part) {
        var last = out.shares[out.shares.length - 1];
        if (last) { if (r.busy) last.busy = r.busy; else last.parts.push(r); }
      }
      else out.shares.push(r);
    });
    return out;
  }
  // The used share of a disk share once Compute has run: Size is then the disk's whole capacity.
  // A user share has no capacity of its own, so it shows no bar.
  function usage(sh, disk) {
    if (!disk || !sh.size) return null;
    var total = bytes(sh.size), free = bytes(sh.free);
    if (!total || free == null || free > total) return null;
    return (total - free) / total * 100;
  }

  function glyph(n) { return window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph(n) : ""; }
  function accent() {
    var a = g("cc.styleshares", "1") !== "0" ? g("cc.accent", "#FCC419") : g("ccsh.accent", "#FCC419");
    return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419";
  }
  // One rainbow colour per card, in the order the list rows take them.
  function colourAt(n) {
    if (g("cc.rainbow", "0") !== "1" || !window.CCTheme || !window.CCTheme.rbColor) return "";
    return window.CCTheme.rbColor(n, accent());
  }
  function ink(c) { return c && window.CCTheme && window.CCTheme.idealText ? window.CCTheme.idealText(c) : "#161616"; }
  function lvl(p) { return p >= 90 ? "cc-sht-err" : p >= 70 ? "cc-sht-warn" : "cc-sht-ok"; }

  function act(kind, label, icon) { return '<span class="cc-sht-ib" role="button" tabindex="0" data-act="' + kind + '" data-tip="' + esc(label) + '" aria-label="' + esc(label) + '">' + glyph(icon) + "</span>"; }
  function exportChip(proto, v) {
    var off = !v || v === "-";
    return '<span class="cc-sht-chip' + (off ? " cc-sht-off" : "") + '">' + proto + " <b>" + esc(off ? t("off") : v) + "</b></span>";
  }
  // Unraid's protection orb becomes a shield before the name, with the orb's own words as its bubble.
  function shield(sh) {
    if (!sh.prot) return "";
    var tip = sh.protTip || t({ ok: "protected", warn: "partly", idle: "unknown" }[sh.prot]);
    return '<span class="cc-shield cc-shield-' + sh.prot + '" role="img" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '">' +
      glyph({ ok: "ShieldOn", warn: "ShieldAlert", idle: "Shield" }[sh.prot]) + "</span>";
  }
  function cornerBtn(kind, label) { return '<span class="cc-sht-cb" role="button" tabindex="0" data-act="' + kind + '">' + esc(label) + "</span>"; }
  // Reading order: the name with its size and the actions in the top corner, the comment, where
  // the share lives and how it is exported, the per-disk split, and Compute in the bottom corner.
  // Compute and Recompute run the same computeShare, so the corner holds whichever the row offers.
  function cardHtml(sh, disk) {
    var acts = (sh.browse ? act("browse", t("browse"), "Folder") : "") + act("open", t("settings"), "Gear");
    var pct = usage(sh, disk);
    var used = pct != null ? "<span><b>" + esc(Math.round(pct)) + " %</b> " + esc(t("of") + " " + sh.size + " " + t("used")) + "</span>"
      : sh.size ? "<span><b>" + esc(sh.size) + "</b> " + esc(t("used")) + "</span>" : "";
    var free = sh.free ? "<span><b>" + esc(sh.free) + "</b> " + esc(t("free")) + "</span>" : "";
    var corner = sh.compute ? cornerBtn("compute", t("compute"))
      : sh.busy ? '<span class="cc-sht-busy">' + esc(sh.busy) + "</span>"
      : sh.parts.length ? cornerBtn("again", t("recompute")) : "";
    var parts = sh.parts.map(function (p) {
      return '<span class="cc-sht-part' + (p.outside ? " cc-sht-warn" : "") + '"' + (p.outside ? ' data-tip="' + esc(t("outside")) + '"' : "") + ">" + esc(p.name) + " <b>" + esc(p.size) + "</b></span>";
    }).join("");
    return '<div class="cc-sht-head"><span class="cc-sht-title">' + shield(sh) + '<span class="cc-sht-nb">' + esc(sh.name) + "</span>" +
      (used || free ? '<span class="cc-sht-size">' + used + free + "</span>" : "") + '</span><span class="cc-sht-acts">' + acts + "</span></div>" +
      (sh.comment ? '<div class="cc-sht-cmt">' + esc(sh.comment) + "</div>" : "") +
      '<div class="cc-sht-chips">' +
      (sh.store ? '<span class="cc-sht-chip cc-sht-store"' + (sh.store.tip ? ' data-tip="' + esc(sh.store.tip) + '"' : "") + ">" + sh.store.html + "</span>" : "") +
      exportChip("SMB", sh.smb) + exportChip("NFS", sh.nfs) + "</div>" +
      (pct != null ? '<div class="cc-sht-track"><div class="cc-sht-fill ' + lvl(pct) + '" style="width:' + Math.max(pct, 1.5).toFixed(1) + '%"></div></div>' : "") +
      (parts ? '<div class="cc-sht-parts">' + parts + "</div>" : "") +
      (corner ? '<div class="cc-sht-foot">' + corner + "</div>" : "");
  }
  function el(tagName, cls) { var n = document.createElement(tagName); if (cls) n.className = cls; return n; }
  function setHtml(n, v) { if (n && n.__ccHtml !== v) { n.innerHTML = v; n.__ccHtml = v; } }
  function fillGrid(grid, list, disk) {
    var old = {};
    kids(grid).forEach(function (c) { old[attr(c, "data-key")] = c; });
    list.forEach(function (sh, i) {
      var c = old[sh.name];
      if (!c) {
        c = el("div", "cc-sht-card");
        c.setAttribute("data-key", sh.name); c.setAttribute("tabindex", "0"); c.setAttribute("role", "link");
      }
      delete old[sh.name];
      if (grid.children[i] !== c) grid.insertBefore(c, grid.children[i] || null);
      c.__ccShare = sh;
      if (c.getAttribute("aria-label") !== sh.name) c.setAttribute("aria-label", sh.name);
      var col = colourAt(i);
      if (col) { c.style.setProperty("--cc-sht-c", col); c.style.setProperty("--cc-sht-ct", ink(col)); }
      else { c.style.removeProperty("--cc-sht-c"); c.style.removeProperty("--cc-sht-ct"); }
      setHtml(c, cardHtml(sh, disk));
    });
    Object.keys(old).forEach(function (k) { if (old[k].parentNode === grid) grid.removeChild(old[k]); });
  }

  // The two tables, each found by the tbody Unraid fills.
  function lists() {
    return [["shareslist", false], ["disk_list", true]].map(function (p) {
      var tb = document.getElementById(p[0]), box = tb && (tb.closest(".TableContainer") || tb.closest("table"));
      return tb && box ? { tb: tb, box: box, disk: p[1] } : null;
    }).filter(Boolean);
  }
  function hostFor(L) {
    var h = L.box.nextElementSibling;
    if (h && hasCls(h, "cc-sht-host")) return h;
    h = el("div", "cc-sht-host");
    L.box.parentNode.insertBefore(h, L.box.nextSibling);
    h.addEventListener("click", onClick);
    h.addEventListener("keydown", onKey);
    return h;
  }
  function drop(L) {
    var h = L.box.nextElementSibling;
    if (h && hasCls(h, "cc-sht-host")) h.parentNode.removeChild(h);
    L.box.classList.remove("cc-sht-hidden");
  }
  // The switch sits at the right end of the tab bar, as on /Main, ahead of the column reset.
  function pageSwitch() {
    var nav = document.querySelector("#displaybox nav.tabs");
    var sw = nav.querySelector(":scope > .cc-sht-vsw");
    if (sw) return sw;
    sw = el("div", "cc-sht-vsw");
    var seg = el("span", "cc-sht-seg");
    seg.setAttribute("role", "group"); seg.setAttribute("aria-label", t("view"));
    [["list", "ViewList"], ["tiles", "ViewGrid"]].forEach(function (o) {
      // A span, since shares.js paints every button on /Shares in the rainbow.
      var b = el("span", "cc-seg-btn");
      b.innerHTML = glyph(o[1]) + "<span>" + esc(t(o[0])) + "</span>";
      b.setAttribute("data-v", o[0]);
      if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(b); else { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); }
      b.addEventListener("click", function () { s(KEY, o[0]); render(); });
      seg.appendChild(b);
    });
    sw.appendChild(seg);
    nav.insertBefore(sw, nav.querySelector(":scope > .cc-colreset"));
    return sw;
  }

  function cardOf(e) { return e.target && e.target.closest ? e.target.closest(".cc-sht-card") : null; }
  // Clicks the row's own control, whose inline handler does the work. Compute and Recompute are
  // links to "#", so the jump to the top of the page is held back.
  function press(a) {
    if (!a) return;
    var hold = function (ev) { ev.preventDefault(); };
    if (attr(a, "href") === "#") a.addEventListener("click", hold, { once: true });
    a.click();
  }
  function run(kind, c) {
    var sh = c.__ccShare; if (!sh) return;
    if (kind === "browse" && sh.browse) location.href = attr(sh.browse, "href");
    else if (kind === "compute") press(sh.compute);
    else if (kind === "again" && sh.parts.length) press(sh.parts[0].again);
    else if (kind === "open") press(sh.link);
  }
  // A click on the card opens the share's settings, as the name link in Unraid's row does.
  function onClick(e) {
    var c = cardOf(e); if (!c) return;
    var a = e.target.closest("[data-act]");
    run(a ? attr(a, "data-act") : "open", c);
  }
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var c = cardOf(e); if (!c) return;
    var a = e.target.closest("[data-act]");
    if (!a && e.target !== c) return;
    e.preventDefault();
    run(a ? attr(a, "data-act") : "open", c);
  }

  function teardown() {
    document.documentElement.classList.remove("cc-sht-on", "cc-sht-tiled");
    Array.prototype.forEach.call(document.querySelectorAll("#displaybox .cc-sht-host, #displaybox .cc-sht-vsw"), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(document.querySelectorAll("#displaybox .cc-sht-hidden"), function (n) { n.classList.remove("cc-sht-hidden"); });
  }
  function render() {
    if (!live()) { teardown(); return; }
    var root = document.documentElement, tiles = view() === "tiles";
    root.classList.add("cc-sht-on");
    root.classList.toggle("cc-sht-tiled", tiles);
    Array.prototype.forEach.call(pageSwitch().querySelectorAll(".cc-seg-btn"), function (b) {
      var on = attr(b, "data-v") === (tiles ? "tiles" : "list");
      b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("cc-seg-on", on);
    });
    lists().forEach(function (L) {
      if (!tiles) { drop(L); return; }
      var data = readList(L.tb);
      L.box.classList.add("cc-sht-hidden");
      var host = hostFor(L);
      var empty = host.querySelector(":scope > .cc-sht-empty");
      if (!data.shares.length && !data.notice) return;   // Unraid has not listed them yet
      if (!data.shares.length) {
        var grid0 = host.querySelector(":scope > .cc-sht-grid"); if (grid0) host.removeChild(grid0);
        if (!empty) empty = host.appendChild(el("div", "cc-sht-empty"));
        setHtml(empty, "<b>" + esc(data.notice) + "</b>");
        return;
      }
      if (empty) host.removeChild(empty);
      var grid = host.querySelector(":scope > .cc-sht-grid") || host.appendChild(el("div", "cc-sht-grid"));
      fillGrid(grid, data.shares, L.disk);
    });
  }
  var frame = 0;
  function soon() { if (!frame) frame = (window.requestAnimationFrame || setTimeout)(function () { frame = 0; render(); }); }

  // Unraid refills the table bodies with each listing and each Compute; the tiles redraw in the
  // next frame. Their own writes are skipped, so a redraw cannot call itself.
  function watch() {
    var host = document.getElementById("displaybox"); if (!host) return;
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var tg = recs[i].target;
        if (!tg || !tg.closest || tg.closest(".cc-sht-host, .cc-sht-vsw")) continue;
        if (tg.closest("table.share_status")) { soon(); return; }
      }
    }).observe(host, { childList: true, subtree: true });
  }
  function boot() {
    window.ccShareTilesApply = render;
    if (pn() !== "/Shares") return;
    render();
    watch();
    window.addEventListener("storage", function (e) { if (e && e.key && /^cc[a-z]*\./.test(e.key) && e.key !== "cc.stateCache") soon(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
