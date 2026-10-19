/* CannonadeCommand: Unraid's "Reset sorting" control as an icon badge.
 *
 * Loaded on every page through CannonadeCommand.Tokens.page. The Docker and VM lists keep the order
 * the user dragged them into, and Unraid puts a list icon into the first column head that drops it
 * again. While master theming is on, that icon gives way to a badge with GlimStone's Sort glyph,
 * shown only while the list is out of Unraid's own order, so the head stays quiet otherwise.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  function T(d, e) { return LANG === "de" ? d : e; }

  // Each list Unraid lets the user arrange, by its tbody id, and where a row carries its name.
  var LISTS = { docker_list: "td.ct-name .appname", kvm_list: "td.vm-name a" };

  function names(tb) {
    var out = [], rows = tb.querySelectorAll(":scope > tr.sortable");
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i].querySelector(LISTS[tb.id]);
      if (n) out.push(n.textContent.trim());
    }
    return out;
  }
  // PHP's strnatcasecmp in short: case-blind, with runs of digits compared as numbers.
  function natcase(a, b) {
    var x = a.toLowerCase().match(/\d+|\D+/g) || [], y = b.toLowerCase().match(/\d+|\D+/g) || [];
    for (var i = 0; i < x.length && i < y.length; i++) {
      if (/^\d/.test(x[i]) && /^\d/.test(y[i])) { var d = parseInt(x[i], 10) - parseInt(y[i], 10); if (d) return d; }
      else if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return x.length - y.length;
  }
  // Without a stored order Unraid lists by name (natcasesort), so names out of that order are an
  // order the user arranged, and only then has the reset anything to drop.
  function arranged(list) {
    for (var i = 1; i < list.length; i++) if (natcase(list[i - 1], list[i]) > 0) return true;
    return false;
  }

  // Unraid's resetSorting acts only while the list is unlocked for dragging. The badge appears only
  // when there is an order to drop and says what it does, so it unlocks for the one call.
  function reset() {
    var $ = window.jQuery;
    if (typeof window.resetSorting !== "function" || !$ || !$.cookie) return;
    var locked = $.cookie("lockbutton") == null;
    if (locked) $.cookie("lockbutton", "lockbutton");
    try { window.resetSorting(); } finally { if (locked) $.removeCookie("lockbutton"); }
  }

  function badge(native) {
    var b = native.previousElementSibling;
    if (b && b.classList.contains("cc-sortreset")) return b;
    var tip = T("Sortierung zurücksetzen", "Reset sorting");
    b = document.createElement("span");
    b.className = "cc-sortreset";
    b.setAttribute("role", "button"); b.setAttribute("tabindex", "0");
    b.setAttribute("data-tip", tip); b.setAttribute("aria-label", tip);
    b.innerHTML = window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph("Sort") : "";
    // The head cell may sort its column on a click, so the press stays with the badge.
    b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); reset(); });
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); reset(); } });
    native.parentNode.insertBefore(b, native);
    return b;
  }

  function body() {
    var native = document.getElementById("resetsort"), table = native && native.closest("table");
    return table && table.querySelector("tbody#docker_list, tbody#kvm_list");
  }
  function update() {
    var native = document.getElementById("resetsort"), tb = body();
    if (!tb) return;
    if (g("cc.theming", "1") === "0") {
      var old = native.previousElementSibling;
      if (old && old.classList.contains("cc-sortreset")) old.parentNode.removeChild(old);
      native.classList.remove("cc-sortreset-native");
      return;
    }
    native.classList.add("cc-sortreset-native");
    badge(native).hidden = !arranged(names(tb));
  }

  var queued = false;
  function soon() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; update(); }); } }
  function boot() {
    var tb = body();
    if (!tb) return;
    update();
    // Unraid refills the body on every listing and moves rows while they are dragged.
    new MutationObserver(soon).observe(tb, { childList: true });
    window.addEventListener("storage", function (e) { if (e.key === "cc.theming") soon(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
