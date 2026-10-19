// The animated pictures the areas share (GlimStone, "Illustrations"): a bar tall enough to slosh
// at its end, a vessel that holds a fill level, a checkmark that draws itself, a line with packets
// on it and a ring that shows progress. Loaded on every page through CannonadeCommand.Pictures.page as
// window.CCPictures, before the area scripts.
//
// The vessel, the check and the ring move in CSS on the dials of CannonadeCommand.Pictures.css,
// so the motion level and a request for less motion reach them there. The packets move with SMIL,
// which no stylesheet reaches, so they ask still() and are drawn again when the answer changes.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var REDUCED = "(prefers-reduced-motion: reduce)";

  function still() {
    return window.matchMedia(REDUCED).matches || document.documentElement.getAttribute("data-cc-motion") === "off";
  }
  // Each watcher answers false once its picture has left the page, and is dropped then.
  var watchers = null;
  function onStill(fn) {
    if (!watchers) {
      watchers = [];
      var tell = function () { watchers = watchers.filter(function (w) { return w(); }); };
      window.matchMedia(REDUCED).addEventListener("change", tell);
      new MutationObserver(tell).observe(document.documentElement, { attributes: true, attributeFilter: ["data-cc-motion"] });
    }
    watchers.push(fn);
  }

  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp(v) { return Math.max(0, Math.min(1, +v || 0)); }
  var nf = (function () { try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { maximumFractionDigits: 0 }); } catch (e) { return { format: String }; } })();

  // The vessel is 34 by 40, KnightLoader's drawing. The liquid stands between the floor and the
  // brim, the dashed line where the place counts as full, and reaches well past the walls so it
  // still fills the vessel while it tilts. The back layer stands a little higher and shows where
  // the front one has swung away from it. A crest rests squashed at a wall and runs up it as the
  // sheet stretches it; the hump crosses the middle, the ripple runs from the left wall to the right.
  var BRIM = 8, FLOOR = 35.5;
  var BODY = "M-20 0H54V45H-20z", BACK = "M-20 -.5H54V45H-20z";
  var CREST = "M-5 .6V-1H0C.9 -.55 2.7 -.03 6 0V.6z";
  var HUMP = "M11 .6V0C13 0 14.5 -1 17 -1S21 0 23 0V.6z";
  var RIPPLE = "M7.5 .6V0C9 0 9.6 -1 10.5 -1S12 0 13.5 0V.6z";
  // [x, radius]. The sheet times each by its place among its kind, so the order is part of the animation.
  var BUBBLES = [[10.5, 0.5], [16.5, 0.45], [24.5, 0.7]];
  var POPS = [[13.5, 0.7], [19, 0.6], [21, 0.65]];
  var vesselN = 0;
  function levelOf(share) { return FLOOR - clamp(share) * (FLOOR - BRIM); }

  // The walls and the inside are rectangles reaching far above the top, cut off there, so their
  // lower corners can follow the shape setting through the sheet's rx.
  function vesselSvg(id) {
    var top = '<clipPath id="' + id + '-top"><rect x="-10" y="3" width="54" height="40"/></clipPath>';
    var inside = '<clipPath id="' + id + '" clip-path="url(#' + id + '-top)"><rect class="cc-vessel-in" x="7.5" y="-30" width="19" height="65.5" rx="4.5"/></clipPath>';
    var crest = function (cls) { return '<path class="cc-vessel-liquid ' + cls + '" d="' + CREST + '"/>'; };
    var bubbles = BUBBLES.map(function (b) { return '<circle class="cc-vessel-bubble" cx="' + b[0] + '" cy="0" r="' + b[1] + '"/>'; }).join("");
    var pops = POPS.map(function (p) {
      var at = ' cx="' + p[0] + '" cy="0"';
      return '<g class="cc-vessel-pop"><circle class="cc-vessel-pop-bubble"' + at + ' r="' + p[1] + '"/><circle class="cc-vessel-pop-ring"' + at + ' r="' + p[1] + '"/>' +
        '<circle class="cc-vessel-pop-drop"' + at + ' r=".3"/><circle class="cc-vessel-pop-drop"' + at + ' r=".3"/><circle class="cc-vessel-pop-drop"' + at + ' r=".3"/></g>';
    }).join("");
    return '<svg viewBox="0 0 34 40" role="progressbar" aria-valuemin="0" aria-valuemax="100"><defs>' + top + inside + "</defs>" +
      '<rect class="cc-vessel-wash cc-vessel-in" x="7.5" y="-30" width="19" height="65.5" rx="4.5" clip-path="url(#' + id + '-top)"/>' +
      '<g clip-path="url(#' + id + ')"><g class="cc-vessel-level">' +
      '<g class="cc-vessel-splash-tilt"><path class="cc-vessel-liquid cc-vessel-back" d="' + BACK + '"/><g class="cc-vessel-tilt">' +
      '<path class="cc-vessel-liquid" d="' + BODY + '"/><path class="cc-vessel-liquid cc-vessel-hump" d="' + HUMP + '"/><path class="cc-vessel-liquid cc-vessel-splash-ripple" d="' + RIPPLE + '"/>' +
      '<g transform="translate(7.5 0)">' + crest("cc-vessel-crest cc-vessel-crest-left") + crest("cc-vessel-splash-crest") + "</g>" +
      '<g transform="translate(26.5 0) scale(-1 1)">' + crest("cc-vessel-crest cc-vessel-crest-right") + "</g></g></g>" +
      '<g class="cc-vessel-bubbles">' + bubbles + "</g><g>" + pops + "</g></g></g>" +
      '<rect class="cc-vessel-wall" x="6" y="-30" width="22" height="67" rx="6" clip-path="url(#' + id + '-top)"/>' +
      '<path class="cc-vessel-brim" d="M2 ' + BRIM + 'H32"/></svg>';
  }

  // vessel draws a fill level against the dashed line that means full. share is 0 to 1, tone is
  // "accent" (the --cc-pic-c colour, the accent by default), "warn" or "err". It rises from the
  // floor to its level once it is in the page; setLevel moves it there again.
  function vessel(opts) {
    opts = opts || {};
    var wrap = document.createElement("span");
    wrap.className = "cc-vessel";
    wrap.innerHTML = vesselSvg("cc-vessel-" + (++vesselN));
    var svg = wrap.querySelector("svg"), level = wrap.querySelector(".cc-vessel-level");
    var shown = null;
    function place(y) {
      level.style.transform = "translateY(" + y.toFixed(2) + "px)";
      svg.style.setProperty("--cc-vessel-depth", (FLOOR - y).toFixed(2));
    }
    var api = {
      el: wrap,
      svg: svg,
      setLevel: function (share) {
        var s = clamp(share);
        if (s === shown) return api;
        shown = s;
        place(levelOf(s));
        svg.setAttribute("aria-valuenow", String(Math.round(s * 100)));
        return api;
      },
      setTone: function (tone) {
        var t = tone === "warn" || tone === "err" ? tone : "accent";
        if (wrap.getAttribute("data-tone") !== t) wrap.setAttribute("data-tone", t);
        return api;
      },
      // A splash still running starts over rather than adding to itself: reading the layout
      // applies the removal, so the class added back starts a new animation.
      splash: function () {
        svg.classList.remove("cc-vessel-splashing");
        void svg.getBoundingClientRect();
        svg.classList.add("cc-vessel-splashing");
        return api;
      }
    };
    if (opts.label) svg.setAttribute("aria-label", opts.label);
    api.setTone(opts.tone);
    place(FLOOR + 3);
    var first = clamp(opts.share);
    window.requestAnimationFrame(function () { api.setLevel(first); });
    return api;
  }

  // drawCheck draws GlimStone's checkmark into container. pathLength 1 lets a 1 to 0 dash offset
  // draw the whole glyph whatever its length. Each call puts a fresh node in, so it draws again.
  function drawCheck(container, label) {
    var old = container.querySelector(":scope > .cc-check");
    if (old) container.removeChild(old);
    var svg = svgEl("svg", { "class": "cc-check", viewBox: "0 0 16 16", role: label ? "img" : null, "aria-label": label || null, "aria-hidden": label ? null : "true" });
    svgEl("path", { "class": "cc-check-draw", d: "M3.5 8.5 6.5 11.5 12.5 4.5", pathLength: "1" }, svg);
    container.appendChild(svg);
    return svg;
  }

  // A line through two points, bent so it leaves and reaches each of them level, as chords for
  // its length and the places along it, since packets keep one speed.
  var CHORDS = 24;
  function curve(a, b) {
    var mid = (a[0] + b[0]) / 2, marks = [a];
    for (var i = 1; i <= CHORDS; i++) {
      var u = i / CHORDS, v = 1 - u;
      marks.push([v * v * v * a[0] + 3 * v * u * mid + u * u * u * b[0], v * v * v * a[1] + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u * u * u * b[1]]);
    }
    var walked = [0];
    for (var k = 1; k < marks.length; k++) walked.push(walked[k - 1] + Math.hypot(marks[k][0] - marks[k - 1][0], marks[k][1] - marks[k - 1][1]));
    var length = walked[walked.length - 1];
    return {
      d: "M" + a[0] + " " + a[1] + "C" + mid + " " + a[1] + " " + mid + " " + b[1] + " " + b[0] + " " + b[1],
      length: length,
      at: function (share) {
        var want = clamp(share) * length, j = 1;
        while (j < walked.length - 1 && walked[j] < want) j++;
        var part = (want - walked[j - 1]) / (walked[j] - walked[j - 1] || 1);
        return [marks[j - 1][0] + (marks[j][0] - marks[j - 1][0]) * part, marks[j - 1][1] + (marks[j][1] - marks[j - 1][1]) * part];
      }
    };
  }
  // Viewbox units a second for everything that travels: a short line takes less time, never less speed.
  var TRAVEL = 70;
  // Seconds a vessel's splash settles before a packet can start the next one, so a dense line
  // keeps the liquid lively without shaking it.
  var SETTLE = 0.8;
  function fixed(n) { return (Math.round(n * 1000) / 1000).toString(); }

  // flow draws a line from one point of svg to another with packets on it, one every gap units,
  // all at one speed. A packet that reaches opts.land, a vessel, makes it splash. The still frame
  // stands the packets where a moment of the loop would.
  function flow(svg, from, to, opts) {
    opts = opts || {};
    var line = curve(from, to), size = opts.size || 3;
    var every = (opts.gap || 44) / TRAVEL, crossing = line.length / TRAVEL;
    var count = Math.max(1, Math.ceil(crossing / every)), loop = count * every, share = Math.min(1, crossing / loop);
    var g = svgEl("g", { "class": "cc-flow" }, svg);
    svgEl("path", { "class": "cc-flow-line", d: line.d }, g);
    var packets = svgEl("g", { "class": "cc-flow-packets", "data-packets": count }, g);
    var frame = 0, gone = false;

    function draw() {
      while (packets.firstChild) packets.removeChild(packets.firstChild);
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      if (still()) {
        for (var i = 0; i < count; i++) { var p = line.at((i + 0.5) / count); svgEl("circle", { "class": "cc-flow-packet", cx: fixed(p[0]), cy: fixed(p[1]), r: size }, packets); }
        return;
      }
      for (var n = 0; n < count; n++) {
        var one = svgEl("g", { opacity: "0" }, packets), begin = fixed(n * every) + "s", dur = fixed(loop) + "s";
        svgEl("animateMotion", { path: line.d, begin: begin, dur: dur, repeatCount: "indefinite", calcMode: "linear", keyPoints: "0;1;1", keyTimes: "0;" + fixed(share) + ";1" }, one);
        svgEl("animate", { attributeName: "opacity", begin: begin, dur: dur, repeatCount: "indefinite", calcMode: "discrete", values: "1;0", keyTimes: "0;" + fixed(share) }, one);
        svgEl("circle", { "class": "cc-flow-packet", r: size }, one);
      }
      if (opts.land) watchLandings();
    }
    // Landings are counted on the picture's own SMIL clock from frame to frame, never on timers
    // that would run ahead of it.
    function watchLandings() {
      var landings = function (t) { return Math.floor((t - crossing) / every); };
      var last = svg.getCurrentTime();
      var tick = function () {
        if (gone || !g.isConnected) return;
        var now = svg.getCurrentTime(), v = opts.land;
        if (now >= crossing && landings(now) > landings(last) && !(now - (v.__ccLanded || -Infinity) < SETTLE)) { v.__ccLanded = now; v.splash(); }
        if (now < last) v.__ccLanded = -Infinity;
        last = now;
        frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    }
    draw();
    onStill(function () { if (gone || !g.isConnected) return false; draw(); return true; });
    return {
      el: g,
      remove: function () {
        gone = true;
        if (frame) window.cancelAnimationFrame(frame);
        if (g.parentNode) g.parentNode.removeChild(g);
      }
    };
  }

  // ring is a progress ring with its percentage in the middle (GlimStone: "a status ring becomes
  // a progress ring while work runs"). It draws in currentColor, so it takes the ink of whatever
  // it stands in. It shows the share rounded down, so it never reads 100 % before the end.
  function ring(label) {
    var wrap = document.createElement("span");
    wrap.className = "cc-ring";
    wrap.setAttribute("role", "progressbar");
    wrap.setAttribute("aria-valuemin", "0");
    wrap.setAttribute("aria-valuemax", "100");
    if (label) wrap.setAttribute("aria-label", label);
    wrap.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="cc-ring-track" cx="20" cy="20" r="16.5"/>' +
      '<circle class="cc-ring-arc" cx="20" cy="20" r="16.5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 20 20)"/></svg><span class="cc-ring-pct"></span>';
    var arc = wrap.querySelector(".cc-ring-arc"), pct = wrap.querySelector(".cc-ring-pct");
    var api = {
      el: wrap,
      set: function (share) {
        var whole = Math.floor(clamp(share) * 100);
        if (wrap.getAttribute("aria-valuenow") === String(whole)) return api;
        arc.setAttribute("stroke-dashoffset", String(100 - clamp(share) * 100));
        pct.textContent = nf.format(whole) + " %";
        wrap.setAttribute("aria-valuenow", String(whole));
        return api;
      }
    };
    return api;
  }

  window.CCPictures = {
    sloshBar: window.CCTheme && window.CCTheme.slosh,
    vessel: vessel,
    drawCheck: drawCheck,
    flow: flow,
    ring: ring,
    still: still
  };
})();
