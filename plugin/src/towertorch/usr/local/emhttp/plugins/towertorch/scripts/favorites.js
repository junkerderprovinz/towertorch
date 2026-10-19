/* CannonadeCommand: styles the /Favorites page.
 *
 * /Favorites is rendered on the server (Tabs="false"), so this only toggles html.cc-favorites-on
 * and mirrors the accent and tile size onto :root for CannonadeCommand.Favorites.css.
 * Turning it off is removing the class, and the observer never injects anything, so it cannot
 * trigger itself.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function onFavorites() { try { return location.pathname.replace(/\/+$/, "") === "/Favorites"; } catch (e) { return false; } }
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff"; }
  // With the adopt toggle on (the default) the global cc.accent wins over this area's ccf.accent.
  function effAccent() { var a = g("cc.stylefavorites", "1") !== "0" ? g("cc.accent", "#FCC419") : g("ccf.accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  function apply() {
    var root = document.documentElement;
    var live = g("cc.theming", "1") !== "0" && g("cc.enable.favorites", "1") !== "0" && onFavorites();
    root.classList.toggle("cc-favorites-on", live);
    if (!live) return;
    var a = effAccent();
    root.style.setProperty("--cc-accent", a);
    root.style.setProperty("--cc-accent-text", idealText(a));
    // cc.sgsize is shared with settingsgrid.js so /Favorites, /Settings and /Tools use one tile
    // size; m matches Docker's 78px logo tile (62px plus 8px padding).
    var sz = ({ s: ["64px", "32px"], m: ["78px", "38px"], l: ["96px", "46px"] })[g("cc.sgsize", "m")] || ["78px", "38px"];
    root.style.setProperty("--cc-fav-size", sz[0]);
    root.style.setProperty("--cc-fav-glyph", sz[1]);
  }
  var mo = null;
  function boot() {
    if (!onFavorites()) return;
    // The observer and storage listener are set up even while the area is off, so enabling it
    // from the settings page takes effect without a reload.
    apply();
    try {
      var host = document.querySelector(".Panels") || document.getElementById("displaybox");
      if (host) { mo = new MutationObserver(function () { if (mo) apply(); }); mo.observe(host, { childList: true, subtree: true }); }
    } catch (e) {}
    // cc.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^ccf?\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
