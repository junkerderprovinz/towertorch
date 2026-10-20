/* TowerTorch: the login page. include/login-head.php writes this into Unraid's login page next to
 * styles/login.css. It reads the accent and the shape from the same localStorage keys the
 * interface uses, puts the logo above the server name, and leaves the stock page alone when
 * theming is switched off. */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }

  if (g("cc.theming", "1") === "0") {
    var sheet = document.getElementById("towertorch-login");
    if (sheet) sheet.remove();
    return;
  }

  function idealText(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#161616";
    var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#ffffff";
  }

  var root = document.documentElement;
  var accent = g("cc.accent", "#FCC419");
  if (!/^#[0-9a-f]{6}$/i.test(accent)) accent = "#FCC419";
  root.style.setProperty("--tt-accent", accent);
  root.style.setProperty("--tt-accent-ink", idealText(accent));
  var shape = g("cc.badgeshape", "round");
  root.setAttribute("data-cc-shape", shape === "soft" || shape === "rounded" ? "soft" : shape === "square" ? "square" : "round");

  document.addEventListener("DOMContentLoaded", function () {
    var content = document.querySelector("#login .content");
    if (content && window.TT_LOGIN_LOGO) {
      var box = document.createElement("div");
      box.className = "tt-logo";
      var img = new Image();
      img.alt = "";
      img.src = window.TT_LOGIN_LOGO;
      box.appendChild(img);
      content.insertBefore(box, content.firstChild);
    }
    // The server name looks like the name in the header: the same cc.brand.* keys, with the same
    // defaults, and a web font from Google where the header would load one.
    var title = document.querySelector("#login h1");
    if (title) {
      var custom = g("cc.brand.name", "");
      if (custom) title.textContent = custom;
      var size = g("cc.brand.size", "30");
      if (/^\d{1,3}$/.test(size)) title.style.fontSize = size + "px";
      title.style.fontWeight = g("cc.brand.weight", "650");
      title.style.fontStyle = g("cc.brand.italic", "0") === "1" ? "italic" : "normal";
      var color = g("cc.brand.color", "");
      if (/^#[0-9a-f]{6}$/i.test(color)) title.style.color = color;
      var font = g("cc.brand.font", "");
      if (font) {
        title.style.fontFamily = font;
        var m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(font), family = m ? (m[1] || m[2] || m[3] || "").trim() : "";
        if (family && !/^(system-ui|-apple-system|segoe ui)$/i.test(family)) {
          var link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://fonts.googleapis.com/css2?family=" + family.replace(/ /g, "+") + ":wght@400;700&display=swap";
          document.head.appendChild(link);
        }
      }
    }
    // "Successfully logged out" comes in the error element; it gets the calm tint instead.
    var note = document.getElementById("error");
    if (note && /logged out|abgemeldet/i.test(note.textContent)) note.classList.add("tt-ok");
  });
})();
