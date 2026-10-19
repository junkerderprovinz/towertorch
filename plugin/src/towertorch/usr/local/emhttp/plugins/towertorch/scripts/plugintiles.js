// The plugin tiles on /Plugins. Loaded after plugins.js through CannonadeCommand.Plugins.page, it
// puts one Liste/Kacheln switch beside the Check button and draws one card per installed plugin.
//
// The cards read the rows plugins.js has painted, which stay in the page, hidden. Unraid's update
// check and its install and remove runs keep writing to those rows, plugins.js repaints them and
// then calls render(), and every action on a card clicks the control the row itself carries.
(function () {
  "use strict";
  var KEY = "cc.pluginview";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var TXT = {
    de: { view: "Ansicht", list: "Liste", tiles: "Kacheln", support: "Support-Thread", icons: "Icon-Färbung", open: "öffnen" },
    en: { view: "View", list: "List", tiles: "Tiles", support: "Support thread", icons: "Icon colouring", open: "open" }
  };
  function t(k) { return (TXT[LANG] || TXT.en)[k] || TXT.en[k]; }

  function pn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }
  // The same gate as plugins.js, which paints the rows the cards are read from.
  function live() {
    return g("cc.theming", "1") !== "0" && g("cc.enable.plugins", "1") !== "0" && pn() === "/Plugins" && !!document.getElementById("plugin_list");
  }
  // One key, written by the switch and by the settings page.
  function view() { return g(KEY, "tiles") === "list" ? "list" : "tiles"; }

  // Tree helpers that use children, childNodes, tagName and getAttribute only, so the readers run
  // on the live rows and on the test shim alike.
  function kids(n) { return n && n.children ? Array.prototype.slice.call(n.children) : []; }
  function tag(n) { return (n && n.tagName || "").toUpperCase(); }
  function attr(n, k) { return (n && n.getAttribute && n.getAttribute(k)) || ""; }
  function hasCls(n, c) { return (" " + attr(n, "class") + " ").indexOf(" " + c + " ") >= 0; }
  function find(n, pred) {
    var ks = kids(n);
    for (var i = 0; i < ks.length; i++) { if (pred(ks[i])) return ks[i]; var r = find(ks[i], pred); if (r) return r; }
    return null;
  }
  function byCls(n, c) { return find(n, function (x) { return hasCls(x, c); }); }
  function text(n) {
    var out = "", cn = n && n.childNodes ? n.childNodes : [];
    for (var i = 0; i < cn.length; i++) out += cn[i].nodeType === 3 ? cn[i].nodeValue : cn[i].nodeType === 1 ? text(cn[i]) : "";
    return out;
  }
  function clean(v) { return String(v || "").replace(/[   ]/g, " ").replace(/\s+/g, " ").trim(); }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  // A painted piece of the row as markup for the card: the colours plugins.js stamped inline come
  // along, the ids and inline handlers stay with the row, so a card never runs Unraid's command on
  // its own.
  function markup(n) { return n && n.outerHTML ? n.outerHTML.replace(/\s(?:id|on[a-z]+)="[^"]*"/gi, "") : ""; }

  // One row as plugins.js leaves it: the logo and the name in the first cell, the author badge, the
  // version badges with the changelog link, Unraid's status and the trash.
  function readRow(tr) {
    var td = kids(tr).filter(function (c) { return tag(c) === "TD"; });
    if (td.length < 6) return null;
    var name = attr(td[0], "data-cc-pname");
    if (!name) return null;
    var ico = byCls(td[0], "cc-plugico");
    var logo = find(ico, function (n) { return (tag(n) === "IMG" || tag(n) === "I") && hasCls(n, "list"); });
    var launch = find(ico, function (n) { return tag(n) === "A" && !!attr(n, "href"); });
    var sup = byCls(td[0], "cc-plugsup");
    var update = find(td[4], function (n) { return tag(n) === "INPUT" && hasCls(n, "update") && !n.disabled; });
    var status = update ? null : find(td[4], function (n) { return tag(n) === "SPAN" || tag(n) === "A"; });
    return {
      name: name, logo: logo, launch: launch ? attr(launch, "href") : "", support: sup ? attr(sup, "href") : "",
      author: byCls(td[2], "cc-plugauth"),
      version: byCls(td[3], "cc-verb"), newer: byCls(td[3], "cc-plugnew"), changelog: byCls(td[3], "cc-plugchg"),
      update: update, status: status,
      remove: byCls(td[5], "cc-b-delicon") || find(td[5], function (n) { return tag(n) === "INPUT" && hasCls(n, "remove") && attr(n, "type") === "button"; }),
      row: tr
    };
  }
  // The table body as a list of plugins, or the line Unraid writes when none is installed.
  function readList(tb) {
    var out = { plugins: [], notice: "" };
    kids(tb).forEach(function (tr) {
      if (tag(tr) !== "TR") return;
      var p = readRow(tr);
      if (p) { out.plugins.push(p); return; }
      var only = kids(tr).filter(function (c) { return tag(c) === "TD"; });
      if (only.length === 1 && attr(only[0], "colspan")) out.notice = clean(text(only[0]));
    });
    return out;
  }

  function glyph(n) { return window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph(n) : ""; }
  function cardHtml(p) {
    var gear = window.CCTheme && window.CCTheme.icons
      ? '<span class="cc-plugicm" role="button" tabindex="0" data-act="icons" data-tip="' + esc(t("icons")) + '" aria-label="' + esc(t("icons") + ": " + p.name) + '">' + glyph("Gear") + "</span>" : "";
    var name = p.launch
      ? '<a class="cc-plt-name" href="' + esc(p.launch) + '" aria-label="' + esc(p.name + " " + t("open")) + '">' + esc(p.name) + "</a>"
      : '<span class="cc-plt-name">' + esc(p.name) + "</span>";
    var sup = p.support ? '<a class="cc-pluglink cc-plugsup" href="' + esc(p.support) + '" target="_blank" rel="noopener">' + esc(t("support")) + "</a>" : "";
    var state = p.update
      ? '<span class="cc-plt-upd" role="button" tabindex="0" data-act="update" style="' + esc(attr(p.update, "style")) + '">' + esc(attr(p.update, "value")) + "</span>"
      : markup(p.status);
    var chg = p.changelog ? '<span class="cc-pluglink cc-plugchg" role="button" tabindex="0" data-act="changelog">' + esc(clean(text(p.changelog))) + "</span>" : "";
    var del = p.remove ? markup(p.remove).replace(/^<(\w+)/, '<$1 data-act="remove"') : "";
    return '<div class="cc-plt-head"><span class="cc-plugico cc-plt-ico">' + markup(p.logo) + gear + "</span>" +
      '<div class="cc-plt-id"><div class="cc-plt-title">' + name + sup + "</div>" + (p.author ? '<div class="cc-plt-by">' + markup(p.author) + "</div>" : "") + "</div>" +
      (state ? '<div class="cc-plt-state">' + state + "</div>" : "") + "</div>" +
      '<div class="cc-plt-foot">' + (p.newer ? markup(p.newer) : "") + markup(p.version) + chg +
      (del ? '<span class="cc-plt-acts">' + del + "</span>" : "") + "</div>";
  }
  function el(tagName, cls) { var n = document.createElement(tagName); if (cls) n.className = cls; return n; }
  function setHtml(n, v) { if (n && n.__ccHtml !== v) { n.innerHTML = v; n.__ccHtml = v; } }
  function rowVar(tr, k) { return tr && tr.style && tr.style.getPropertyValue ? tr.style.getPropertyValue(k).trim() : ""; }
  function fillGrid(grid, list) {
    var old = {};
    kids(grid).forEach(function (c) { old[attr(c, "data-key")] = c; });
    list.forEach(function (p, i) {
      var c = old[p.name];
      if (!c) { c = el("div", "cc-plt-card"); c.setAttribute("data-key", p.name); }
      delete old[p.name];
      if (grid.children[i] !== c) grid.insertBefore(c, grid.children[i] || null);
      c.__ccPlugin = p;
      // The row's palette colour and its ink, so the card's badges and logo tile react like the row.
      ["--cc-rb-c", "--cc-rb-ct"].forEach(function (k) { var v = rowVar(p.row, k); if (c.style.getPropertyValue(k) !== v) { if (v) c.style.setProperty(k, v); else c.style.removeProperty(k); } });
      setHtml(c, cardHtml(p));
    });
    Object.keys(old).forEach(function (k) { if (old[k].parentNode === grid) grid.removeChild(old[k]); });
  }

  function tableBox() { var tb = document.getElementById("plugin_table"); return tb && (tb.closest(".TableContainer") || tb); }
  function hostFor(box) {
    var h = box.nextElementSibling;
    if (h && hasCls(h, "cc-plt-host")) return h;
    h = el("div", "cc-plt-host");
    box.parentNode.insertBefore(h, box.nextSibling);
    h.addEventListener("click", onClick);
    h.addEventListener("keydown", onKey);
    return h;
  }
  // The switch leads the group of Unraid's buttons that plugins.js pins to the right end of the
  // tab bar, the place the switch takes on /Main and /Shares.
  function pageSwitch() {
    var host = document.getElementById("cc-plugbtns");
    if (!host) return null;
    var sw = host.querySelector(":scope > .cc-plt-vsw");
    if (sw) return sw;
    sw = el("span", "cc-plt-vsw");
    var seg = el("span", "cc-plt-seg");
    seg.setAttribute("role", "group"); seg.setAttribute("aria-label", t("view"));
    [["list", "ViewList"], ["tiles", "ViewGrid"]].forEach(function (o) {
      var b = el("span", "cc-seg-btn");
      b.innerHTML = glyph(o[1]) + "<span>" + esc(t(o[0])) + "</span>";
      b.setAttribute("data-v", o[0]);
      if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(b); else { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); }
      b.addEventListener("click", function () { s(KEY, o[0]); render(); });
      seg.appendChild(b);
    });
    sw.appendChild(seg);
    host.insertBefore(sw, host.firstChild);
    return sw;
  }

  // Clicks the row's own control: the update button and the changelog link carry Unraid's
  // handlers, the trash carries the CannonadeCommand confirmation in front of Unraid's remove.
  function run(kind, c, at) {
    var p = c.__ccPlugin; if (!p) return;
    if (kind === "update" && p.update) p.update.click();
    else if (kind === "changelog" && p.changelog) p.changelog.click();
    else if (kind === "remove" && p.remove) p.remove.click();
    else if (kind === "icons" && window.CCTheme && window.CCTheme.icons) {
      window.CCTheme.icons.popover(at, "plugin", p.name, function () { if (typeof window.ccPluginsApply === "function") window.ccPluginsApply(); });
    }
  }
  function target(e) {
    var a = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    var c = a && a.closest(".cc-plt-card");
    return a && c ? { a: a, c: c } : null;
  }
  function onClick(e) {
    var x = target(e); if (!x) return;
    e.preventDefault(); e.stopPropagation();
    run(attr(x.a, "data-act"), x.c, x.a);
  }
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var x = target(e); if (!x) return;
    e.preventDefault();
    run(attr(x.a, "data-act"), x.c, x.a);
  }

  function teardown() {
    document.documentElement.classList.remove("cc-plt-on", "cc-plt-tiled");
    Array.prototype.forEach.call(document.querySelectorAll(".cc-plt-host, .cc-plt-vsw"), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(document.querySelectorAll(".cc-plt-hidden"), function (n) { n.classList.remove("cc-plt-hidden"); });
  }
  function render() {
    if (!live()) { teardown(); return; }
    var root = document.documentElement, tiles = view() === "tiles";
    root.classList.add("cc-plt-on");
    root.classList.toggle("cc-plt-tiled", tiles);
    var sw = pageSwitch();
    if (sw) Array.prototype.forEach.call(sw.querySelectorAll(".cc-seg-btn"), function (b) {
      var on = attr(b, "data-v") === (tiles ? "tiles" : "list");
      if (attr(b, "aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
    });
    var box = tableBox();
    if (!box) return;
    if (!tiles) {
      box.classList.remove("cc-plt-hidden");
      var gone = box.nextElementSibling;
      if (gone && hasCls(gone, "cc-plt-host")) gone.parentNode.removeChild(gone);
      return;
    }
    box.classList.add("cc-plt-hidden");
    var data = readList(document.getElementById("plugin_list"));
    var host = hostFor(box);
    var empty = host.querySelector(":scope > .cc-plt-empty");
    if (!data.plugins.length && !data.notice) return;   // the rows are not painted yet
    if (!data.plugins.length) {
      var grid0 = host.querySelector(":scope > .cc-plt-grid"); if (grid0) host.removeChild(grid0);
      if (!empty) empty = host.appendChild(el("div", "cc-plt-empty"));
      setHtml(empty, esc(data.notice));
      return;
    }
    if (empty) host.removeChild(empty);
    var grid = host.querySelector(":scope > .cc-plt-grid") || host.appendChild(el("div", "cc-plt-grid"));
    fillGrid(grid, data.plugins);
  }

  window.ccPluginTilesApply = render;
  function boot() {
    if (pn() !== "/Plugins") return;
    render();
    window.addEventListener("storage", function (e) { if (e && e.key === KEY) render(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
