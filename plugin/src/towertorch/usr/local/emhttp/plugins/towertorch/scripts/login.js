/* TowerTorch: the login page. include/login-head.php writes this into Unraid's login page next to
 * styles/login.css, together with the cc.* settings the engine keeps for every browser. Those come
 * first, since a browser that clears its storage would otherwise meet the defaults here; the
 * browser's own keys fill what the engine does not have. It puts the logo above the server name
 * and leaves the stock page alone when theming is switched off. */
(function () {
  "use strict";
  var server = window.TT_LOGIN_UI || {};
  function g(k, d) {
    if (typeof server[k] === "string") return server[k];
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }

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
  // The reactive colour mode (stored as "active") rests the button grey until it has the pointer.
  root.classList.toggle("tt-reactive", g("cc.rbmode", "all") === "active");
  var labels = g("cc.labels.buttons", "textGlyph");
  root.setAttribute("data-tt-labels", ["text", "textGlyph", "glyph", "reactive"].indexOf(labels) < 0 ? "textGlyph" : labels);
  // GlimStone's glyphs for the two submit buttons these pages have, signing in and setting the
  // password, by their captions in English and German. Another caption keeps its words alone.
  var GLYPHS = { SignIn: ["0 0 14 14", '<path fill-rule="evenodd" d="M14 12.5C14 13.328427 13.328427 14 12.5 14h-7c-0.82843 0 -1.5 -0.671573 -1.5 -1.5v-3.24998h0.51563c0.0888 0.70641 0.54957 1.32045 1.219 1.59774c0.74735 0.30956 1.60759 0.13845 2.17958 -0.43354l2 -2c0.78105 -0.78105 0.78105 -2.04738 0 -2.82843l-2 -1.99999c-0.57199 -0.572 -1.43223 -0.7431 -2.17958 -0.4336c-0.66944 0.2773 -1.13022 0.8914 -1.219 1.59782H4V1.5c0 -0.8284 0.67157 -1.5 1.5 -1.5h7C13.328427 0 14 0.6716 14 1.5v11Zm-7.78701 -2.80711c-0.28026 -0.11609 -0.46299 -0.38957 -0.46299 -0.69291v-1H1c-0.5523 0 -1 -0.44772 -1 -1c0 -0.55229 0.4477 -1 1 -1H5.75v-1c0 -0.30335 0.18273 -0.57683 0.46299 -0.69291c0.28025 -0.11609 0.60284 -0.05192 0.81734 0.16258l2 2c0.29289 0.29289 0.29289 0.76777 0 1.06066l-2 2c-0.2145 0.2145 -0.53709 0.27866 -0.81734 0.16258Z" clip-rule="evenodd"/>'], Key: ["0 0 14 14", '<path fill-rule="evenodd" d="M10.2929 1.29289c0.3905 -0.390521 1.0237 -0.390521 1.4142 0l2 2c0.3905 0.39053 0.3905 1.02369 0 1.41422 -0.3905 0.39052 -1.0237 0.39052 -1.4142 0L11 3.41421l-1.08578 1.0858 1.29288 1.29288c0.3905 0.39053 0.3905 1.02369 0 1.41422 -0.3905 0.39052 -1.0237 0.39052 -1.41421 0L8.50001 5.91422 7.44619 6.96804C7.79807 7.56355 8 8.2582 8 9c0 2.2091 -1.79086 4 -4 4s-4 -1.7909 -4 -4c0 -2.20914 1.79086 -4 4 -4 0.74181 0 1.43646 0.20193 2.03198 0.55383l1.75731 -1.75732 0.0036 -0.00362 0.00362 -0.0036 2.49639 -2.4964ZM2 9c0 -1.10457 0.89543 -2 2 -2s2 0.89543 2 2c0 1.1046 -0.89543 2 -2 2s-2 -0.8954 -2 -2Z" clip-rule="evenodd"/>'] };
  var CAPTIONS = { "login": "SignIn", "log in": "SignIn", "sign in": "SignIn", "anmelden": "SignIn", "set password": "Key", "passwort festlegen": "Key" };

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
    // The words stay the button's accessible name in every mode; in glyph mode they are its title.
    Array.prototype.forEach.call(document.querySelectorAll("#login button[type=submit]"), function (b) {
      var words = b.textContent.replace(/\s+/g, " ").trim(), d = GLYPHS[CAPTIONS[words.toLowerCase()]];
      if (!d || b.children.length) return;
      b.textContent = "";
      var gl = document.createElement("span"), l = document.createElement("span");
      gl.className = "tt-lb-g";
      gl.innerHTML = '<svg viewBox="' + d[0] + '" fill="currentColor" aria-hidden="true" focusable="false">' + d[1] + "</svg>";
      l.className = "tt-lb-l"; l.textContent = words;
      b.appendChild(gl); b.appendChild(l); b.classList.add("tt-lb");
      if (root.getAttribute("data-tt-labels") === "glyph") b.title = words;
    });
    // "Successfully logged out" comes in the error element; it gets the calm tint instead.
    var note = document.getElementById("error");
    if (note && /logged out|abgemeldet/i.test(note.textContent)) note.classList.add("tt-ok");
  });
})();
