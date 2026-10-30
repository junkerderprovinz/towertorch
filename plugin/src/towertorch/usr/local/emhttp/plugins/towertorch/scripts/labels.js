/* TowerTorch: GlimStone's label engine for the Unraid buttons TowerTorch draws as badges.
 *
 * Loaded on every page through TowerTorch.Labels.page. cc.labels.buttons holds how much of a
 * button shows: its caption (text), glyph and caption (textGlyph, the default), the glyph alone
 * (glyph), or the glyph with the caption opening under the pointer and on keyboard focus
 * (reactive). The mode goes onto <html> as data-cc-labels-buttons, and
 * sheets/TowerTorch.Labels.css draws it.
 *
 * A caption listed in GLYPHS gets that glyph; any other caption keeps its text in every mode. An
 * <input type=button> cannot hold an element, so the glyph is a background layer of the button
 * itself, drawn in the button's ink. It moves, hides and fades with the button, and a <button> is
 * drawn the same way so both kinds line up. The button stays Unraid's control: its value, its
 * form, its disabled state and its accessible name are untouched.
 */
(function () {
  "use strict";
  if (window.ccLabelsApply) return;
  var root = document.documentElement;
  var KEY = "cc.labels.buttons", ATTR = "data-cc-labels-buttons";
  var MODES = ["text", "textGlyph", "glyph", "reactive"];
  var GAP = 6;

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }

  // Unraid's captions in English and in the German language pack, lower case, by glyph.
  var BY_GLYPH = {
    Apply: ["apply", "anwenden", "übernehmen"],
    Save: ["save", "speichern", "save changes", "änderungen speichern", "save raw config"],
    Confirm: ["done", "fertig", "ok", "i understand"],
    Check: ["check", "prüfen"],
    Close: ["cancel", "abbrechen", "close", "schließen"],
    Back: ["back", "zurück"],
    Refresh: ["reset", "zurücksetzen", "default", "standard"],
    Restore: ["restore", "wiederherstellen", "restore backup"],
    SelectAll: ["select all", "alles auswählen", "alle auf der seite auswählen"],
    ClearSelection: ["select none", "alles abwählen", "reset selection", "auswahl zurücksetzen"],
    Trash: ["delete", "löschen", "remove", "entfernen", "erase", "delete pool", "pool löschen", "remove pool", "pool entfernen",
      "delete tunnel", "tunnel löschen", "delete peer", "peer löschen", "remove selected plugins", "ausgewählte plugins entfernen"],
    Empty: ["clear", "empty", "leeren", "clear stats", "statistiken löschen", "clear log", "protokoll leeren"],
    Add: ["add", "hinzufügen", "create", "erstellen", "add share", "freigabe hinzufügen", "add user", "benutzer hinzufügen",
      "add vm", "vm hinzufügen", "add container", "container hinzufügen", "add pool", "pool hinzufügen", "add peer",
      "peer hinzufügen", "add tunnel", "tunnel hinzufügen", "add route", "route hinzufügen", "add new script",
      "add remote smb/nfs share", "remote-smb/nfs-freigabe hinzufügen", "add iso file share", "iso-datei-freigabe hinzufügen",
      "add root share", "root-freigabe hinzufügen"],
    Download: ["download", "herunterladen", "download log"],
    Upload: ["upload", "hochladen"],
    Install: ["install", "installieren", "install selected", "ausgewählte installieren"],
    // The Add Share page reads another share's settings in and writes its own out to others.
    Import: ["read", "lesen"],
    Export: ["write", "schreiben"],
    Update: ["update", "aktualisieren", "aktualisierung", "update all", "alle aktualisieren", "alle plugins aktualisieren",
      "check for updates", "nach aktualisierungen suchen"],
    Retry: ["refresh", "neu laden", "restart", "neustart"],
    Search: ["search", "suche", "suchen", "find", "browse", "durchsuchen", "rescan", "neu prüfen", "erneut scannen"],
    Play: ["start", "starten", "start all", "alle starten", "spin up", "platten anlaufen lassen", "run script"],
    Resume: ["resume", "fortsetzen", "resume all", "alle fortsetzen"],
    Pause: ["pause", "pausieren", "pause all", "alle pausieren"],
    Stop: ["stop", "stopp", "stoppen", "stop all", "alle stoppen"],
    Moon: ["spin down", "platten anhalten"],
    Power: ["shutdown", "herunterfahren", "reboot", "neu starten"],
    Pencil: ["edit", "bearbeiten", "change", "ändern", "rename", "umbenennen"],
    Copy: ["copy", "kopieren"],
    Move: ["move", "verschieben", "move now", "jetzt verschieben"],
    Compute: ["compute", "berechnen", "compute all", "alle berechnen", "calculate"],
    Prune: ["clean up", "aufräumen"],
    Eye: ["show", "anzeigen", "view"],
    Log: ["view log", "protokoll anzeigen", "show log"],
    Info: ["info", "php info", "php-info"],
    Schedules: ["history", "verlauf"],
    BackupNow: ["boot device backup"],
    Accounts: ["owner", "eigentümer"],
    Key: ["permission", "berechtigung", "set password", "passwort festlegen", "install key", "lizenz installieren"],
    ViewList: ["jobs", "aufträge"]
  };
  var GLYPHS = {};
  Object.keys(BY_GLYPH).forEach(function (g) { BY_GLYPH[g].forEach(function (c) { GLYPHS[c] = g; }); });

  // The places TowerTorch draws Unraid's buttons as badges, the same gates its sheets key on.
  var SCOPE = [
    "html.cc-forms-on #displaybox",
    "html.cc-tools-on #displaybox",
    "html.cc-shares-on:is(.cc-on-main, .cc-on-shares, .cc-on-browse, .cc-on-stats) #displaybox",
    "html[data-cc-page=\"vmform\"] #displaybox",
    "html.cc-vms-on #displaybox",
    "html.cc-docker-on #displaybox div.js-actions",
    "html.cc-docker-on.cc-on-addct #canvas",
    "html.cc-ctout-on #displaybox .content",
    "html.cc-popups-on .multi_installDiv",
    "html.cc-on-plugins #cc-plugbtns"
  ];
  // The share page's Delete is Unraid's label, which shares.js draws as a badge in the button row.
  var TEXTUAL = 'button:not([role="tab"]), a.button, label.cc-b-del';
  var CONTROL = 'input[type="button"], input[type="submit"], input[type="reset"], ' + TEXTUAL;
  var IN_SCOPE = SCOPE.map(function (s) { return s + " :is(" + CONTROL + ")"; }).join(", ");
  // Unraid's web components and the boot editor draw their own buttons, and so does TowerTorch in
  // its windows and its own badges.
  var SKIP = ".unapi, .main-content, #cc-settings, .cc-pop, .cc-win, .sweet-alert, .ui-dialog";
  var NATIVE = ["cc-xbtn", "cc-fm-primary", "cc-b-del"];
  function managed(el) {
    if (el.closest(SKIP)) return false;
    if (el.tagName === "INPUT") return true;
    var own = (el.className || "").split(/\s+/).filter(function (c) { return /^cc-/.test(c) && NATIVE.indexOf(c) < 0; });
    if (own.length) return false;
    // A button that brings its own icon keeps it.
    return !el.querySelector("*:not(br)");
  }

  function mode() { var v = get(KEY, "textGlyph"); return MODES.indexOf(v) < 0 ? "textGlyph" : v; }
  function enabled() { return get("cc.theming", "1") !== "0" && !!(window.CCTheme && window.CCTheme.glyph); }
  function caption(el) { return String(el.tagName === "INPUT" ? el.value : el.textContent).replace(/\s+/g, " ").trim(); }
  function glyphFor(text) { return GLYPHS[text.toLowerCase().replace(/[\s:.…]+$/, "")] || ""; }

  // Unraid renames a button by setting its value, which no observer sees, so every input in scope
  // reports its own value changes. The getter and setter are the browser's own.
  var VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  var hooked = [];
  function hook(el) {
    if (el.tagName !== "INPUT" || el.ccLblHook || !VALUE) return;
    el.ccLblHook = true; hooked.push(el);
    Object.defineProperty(el, "value", {
      configurable: true,
      get: function () { return VALUE.get.call(this); },
      set: function (v) { VALUE.set.call(this, v); if (caption(this) !== this.ccLblCap) later(); }
    });
  }
  function unhookAll() { hooked.forEach(function (el) { delete el.value; el.ccLblHook = false; }); hooked = []; }

  // What the button looks like without the engine, read with the engine's rules switched off for
  // it, so the glyph can sit where its own padding and caption leave room. Coming back, the button
  // settles without a transition, or a reactive button would replay its opening on every pass.
  var ctx = null;
  function textWidth(el, cs) {
    if (!ctx) ctx = document.createElement("canvas").getContext("2d");
    var t = caption(el);
    if (cs.textTransform === "uppercase") t = t.toUpperCase();
    ctx.font = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join(" ");
    return ctx.measureText(t).width + (parseFloat(cs.letterSpacing) || 0) * t.length;
  }
  function measure(el) {
    giveBack(el);
    el.setAttribute("data-cc-lbl-off", "");
    var cs = getComputedStyle(el);
    var m = {
      pl: parseFloat(cs.paddingLeft) || 0, pr: parseFloat(cs.paddingRight) || 0,
      fs: parseFloat(cs.fontSize) || 13, h: el.offsetHeight, w: el.offsetWidth, tw: Math.ceil(textWidth(el, cs))
    };
    el.setAttribute("data-cc-lbl-still", "");
    el.removeAttribute("data-cc-lbl-off");
    return {
      "--cc-lbl-pl": m.pl + "px", "--cc-lbl-pr": m.pr + "px", "--cc-lbl-tw": m.tw + "px", "--cc-lbl-gs": m.fs + "px",
      "--cc-lbl-h": m.h + "px", "--cc-lbl-w": (m.w + m.fs + GAP) + "px", "--cc-lbl-gap": GAP + "px"
    };
  }
  function settle(el) { if (el.hasAttribute("data-cc-lbl-still")) { void getComputedStyle(el).width; el.removeAttribute("data-cc-lbl-still"); } }

  // The layer's place and size and the padding beside it come from the sheet, per mode and state.
  // They are set here inline because the area scripts paint some buttons with an inline
  // background shorthand, which would reset every layer the sheet adds, and give the plugin bar
  // its padding inline. That padding is kept, put back while measuring and when the engine lets go.
  var LAYER = { "background-image": "var(--cc-lbl-img)", "background-repeat": "no-repeat", "background-origin": "border-box",
    "background-size": "var(--cc-lbl-bs)", "background-position": "var(--cc-lbl-bp)",
    "padding-left": "var(--cc-lbl-ps)", "padding-right": "var(--cc-lbl-pe)" };
  var PROPS = Object.keys(LAYER).concat(["--cc-lbl-img", "--cc-lbl-pl", "--cc-lbl-pr", "--cc-lbl-tw", "--cc-lbl-gs", "--cc-lbl-h", "--cc-lbl-w", "--cc-lbl-gap"]);
  function layer(el) {
    if (el.style.getPropertyValue("padding-left") !== LAYER["padding-left"]) {
      var s = el.style, sh = s.getPropertyValue("padding");
      el.ccLblPad = sh ? [["padding", sh, s.getPropertyPriority("padding")]]
        : ["padding-left", "padding-right"].filter(function (p) { return s.getPropertyValue(p); }).map(function (p) { return [p, s.getPropertyValue(p), s.getPropertyPriority(p)]; });
      // A shorthand written with var() loses its other two sides once two are taken out of it.
      if (sh) { var cs = getComputedStyle(el); s.setProperty("padding-top", cs.paddingTop, s.getPropertyPriority("padding")); s.setProperty("padding-bottom", cs.paddingBottom, s.getPropertyPriority("padding")); }
    }
    for (var p in LAYER) if (el.style.getPropertyValue(p) !== LAYER[p] || el.style.getPropertyPriority(p) !== "important") el.style.setProperty(p, LAYER[p], "important");
  }
  function giveBack(el) {
    if (el.style.getPropertyValue("padding-left") !== LAYER["padding-left"]) return;
    el.style.removeProperty("padding-left"); el.style.removeProperty("padding-right");
    (el.ccLblPad || []).forEach(function (d) { el.style.setProperty(d[0], d[1], d[2]); });
  }

  // The glyph is drawn in the button's ink, which changes with hover, focus, the disabled state and
  // the colour mode, so it is redrawn every frame while such a change may be under way.
  function paint(el) {
    var name = el.getAttribute("data-cc-lbl"); if (!name) return;
    var ink = getComputedStyle(el).color;
    if (el.ccLblInk === ink + name) return;
    el.ccLblInk = ink + name;
    var svg = window.CCTheme.glyph(name).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace('fill="currentColor"', 'fill="' + ink + '"');
    el.style.setProperty("--cc-lbl-img", 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
  }
  function follow(el) {
    if (!el.hasAttribute("data-cc-lbl")) return;
    el.ccLblUntil = performance.now() + 450;
    if (el.ccLblRaf) return;
    (function step() {
      paint(el);
      el.ccLblRaf = performance.now() < el.ccLblUntil ? requestAnimationFrame(step) : 0;
    })();
  }

  // In glyph mode the caption is the bubble, ahead of whatever the bubble said before, as
  // GlimStone's buttons do it; reactive shows the words themselves and keeps the bubble only on a
  // disabled button, which never opens. The bubble it replaced comes back, title included.
  var TIP_FROM = ["data-cc-tip", "data-tip", "title"];
  function tip(el, m) {
    var want = m === "glyph" || (m === "reactive" && el.disabled);
    if (want) {
      if (!el.ccLblTip) {
        var from = TIP_FROM.filter(function (a) { return el.getAttribute(a); })[0] || "";
        el.ccLblTip = { from: from, text: from ? el.getAttribute(from) : "" };
        if (from === "title") el.removeAttribute("title");
      } else if (el.getAttribute("title")) {
        // Unraid writes some titles later, the share page's reason why Delete is not possible
        el.ccLblTip.text = el.getAttribute("title"); el.ccLblTip.from = el.ccLblTip.from || "title";
        el.removeAttribute("title");
      }
      var was = el.ccLblTip.text, cap = caption(el), t = was && was !== cap ? cap + ": " + was : cap;
      if (el.getAttribute("data-cc-tip") !== t) el.setAttribute("data-cc-tip", t);
    } else if (el.ccLblTip) {
      var o = el.ccLblTip;
      el.ccLblTip = null;
      el.removeAttribute("data-cc-tip");
      if (o.from) el.setAttribute(o.from, o.text);
    }
  }

  // A button is measured again when its caption, its classes or its visibility change, or when the
  // page classes or the fonts do, which is when its own look can have changed. One that is not
  // rendered has nothing to measure; the resize observer brings it back when it shows.
  var epoch = 0;
  function stamp(el, name, m) {
    if (el.getAttribute("data-cc-lbl") !== name) el.setAttribute("data-cc-lbl", name);
    el.ccLblShown = el.getClientRects().length > 0;
    var key = [el.ccLblCap, epoch, el.className, el.ccLblShown].join("\n");
    if (el.ccLblShown && el.ccLblKey !== key) {
      el.ccLblKey = key;
      var v = measure(el);
      for (var k in v) if (el.style.getPropertyValue(k) !== v[k]) el.style.setProperty(k, v[k]);
    }
    layer(el);
    tip(el, m);
    paint(el);
    settle(el);
  }
  function unstamp(el) {
    el.removeAttribute("data-cc-lbl");
    giveBack(el);
    PROPS.forEach(function (p) { if (!/^padding/.test(p)) el.style.removeProperty(p); });
    el.ccLblKey = el.ccLblInk = "";
    tip(el, "text");
  }

  var stamped = [];
  function sweep() {
    var m = enabled() ? mode() : null;
    if (m) { if (root.getAttribute(ATTR) !== m) root.setAttribute(ATTR, m); } else root.removeAttribute(ATTR);
    var keep = [];
    if (m) {
      var els = document.querySelectorAll(IN_SCOPE);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!managed(el)) continue;
        hook(el);
        if (ro && !el.ccLblSeen) { el.ccLblSeen = true; ro.observe(el); }
        el.ccLblCap = caption(el);
        var name = m === "text" ? "" : glyphFor(el.ccLblCap);
        if (!name) continue;
        stamp(el, name, m);
        keep.push(el);
      }
    }
    stamped.forEach(function (el) { if (keep.indexOf(el) < 0) unstamp(el); });
    stamped = keep;
    if (!m) unhookAll();
    if (mo) mo.takeRecords();
  }

  var queued = false;
  function later() {
    if (queued) return;
    queued = true;
    Promise.resolve().then(function () { queued = false; try { sweep(); } catch (e) {} });
  }

  // Only what can change a button: its own attributes and caption, buttons coming and going, and
  // the page classes on <html> that open or close the areas.
  function relevant(r) {
    var t = r.target;
    if (t === root) return true;
    // A button's style changes with every redraw of its glyph; it only matters when another
    // script replaced the layer.
    if (r.type === "attributes") {
      if (!t.matches || !t.matches(CONTROL)) return false;
      if (r.attributeName !== "style" || !t.hasAttribute("data-cc-lbl")) return true;
      for (var p in LAYER) if (t.style.getPropertyValue(p) !== LAYER[p]) return true;
      return false;
    }
    if (r.type === "characterData") return !!(t.parentElement && t.parentElement.closest(TEXTUAL));
    if (t.closest && t.closest(TEXTUAL)) return true;
    var lists = [r.addedNodes, r.removedNodes];
    for (var l = 0; l < 2; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        var n = lists[l][i];
        if (n.nodeType === 1 && (n.matches(CONTROL) || n.querySelector(CONTROL))) return true;
      }
    }
    return false;
  }
  var mo = null, ro = null;
  function boot() {
    if (window.ResizeObserver) ro = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var el = entries[i].target, r = entries[i].contentRect;
        if (el.hasAttribute("data-cc-lbl") && (r.width > 0 || r.height > 0) !== el.ccLblShown) { later(); return; }
      }
    });
    try { sweep(); } catch (e) {}
    mo = new MutationObserver(function (recs) {
      var run = false;
      for (var i = 0; i < recs.length; i++) {
        if (recs[i].target === root) epoch++;
        if (!run) run = relevant(recs[i]);
      }
      if (run) try { sweep(); } catch (e) {}
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class", "data-cc-page"] });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["value", "class", "style", "disabled", "hidden", "title"] });
    ["pointerover", "pointerout", "focusin", "focusout", "transitionrun", "transitionend"].forEach(function (ev) {
      document.addEventListener(ev, function (e) { if (e.target && e.target.nodeType === 1) follow(e.target); }, true);
    });
    window.addEventListener("storage", function (e) { if (!e.key || e.key === KEY || e.key === "cc.theming") later(); });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", function () { epoch++; later(); });
  }
  window.ccLabelsApply = later;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
