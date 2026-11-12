/* TowerTorch: styles the /Favorites page.
 *
 * /Favorites is rendered on the server (Tabs="false"), so this only toggles html.tt-favorites-on
 * and mirrors the accent and tile size onto :root for TowerTorch.Favorites.css.
 * Turning it off is removing the class, and the observer never injects anything, so it cannot
 * trigger itself.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function onFavorites() { try { return location.pathname.replace(/\/+$/, "") === "/Favorites"; } catch (e) { return false; } }
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; var L = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255), w = 1.05 / (L + 0.05), g = 22; if (w > (L + 0.05) / (lin(g) + 0.05) && w >= 4.5) return "#fff"; while ((L + 0.05) / (lin(g) + 0.05) < 4.5) g--; return "#" + ("0" + g.toString(16)).slice(-2).repeat(3); }
  // With the adopt toggle on (the default) the global tt.accent wins over this area's ttf.accent.
  function effAccent() { var a = g("tt.stylefavorites", "1") !== "0" ? g("tt.accent", "#FCC419") : g("ttf.accent", "#FCC419"); return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419"; }
  function apply() {
    var root = document.documentElement;
    var live = g("tt.theming", "1") !== "0" && g("tt.enable.favorites", "1") !== "0" && onFavorites();
    root.classList.toggle("tt-favorites-on", live);
    if (!live) return;
    var a = effAccent();
    root.style.setProperty("--tt-accent", a);
    root.style.setProperty("--tt-accent-text", idealText(a));
    // tt.sgsize is shared with settingsgrid.js so /Favorites, /Settings and /Tools use one tile
    // size; m matches Docker's 78px logo tile (62px plus 8px padding).
    var sz = ({ s: ["64px", "32px"], m: ["78px", "38px"], l: ["96px", "46px"] })[g("tt.sgsize", "m")] || ["78px", "38px"];
    root.style.setProperty("--tt-fav-size", sz[0]);
    root.style.setProperty("--tt-fav-glyph", sz[1]);
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
    // tt.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "tt.stateCache" && /^ttf?\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
