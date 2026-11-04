// The disk tiles on /Main. Loaded on every page through TowerTorch.Disks.page and live only
// where the Start area styles /Main (shares.js), it puts one Liste/Kacheln switch on the page and
// draws one card per disk of the array, the pools, the boot device and Unassigned Devices.
//
// The cards read Unraid's own tables, which stay in the page, hidden, and keep being refilled by
// Unraid's devices subscriber and by Unassigned Devices' own refresh, so the tiles follow the same
// feed without a poller of their own. Every action runs the call the row's own control carries.
// server/disks.php adds what the table lacks (SMART, wear, temperature thresholds) once per load.
(function () {
  "use strict";
  var KEY = "tt.diskview";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var TXT = {
    de: { view: "Ansicht", list: "Liste", tiles: "Kacheln", spinDown: "Platte anhalten", spinUp: "Platte anlaufen lassen", browse: "Durchsuchen", log: "Datenträgerprotokoll",
      resting: "Ruht", used: "belegt", free: "frei", of: "von", temp: "Temperatur", read: "Lesen", write: "Schreiben", errors: "Fehler",
      smartWarn: "SMART-Warnung", smartFail: "SMART-Fehler",
      smartFailTip: "Der SMART-Selbsttest ist fehlgeschlagen", parity: "Parität gültig, schützt %n Datenträger",
      tempTip: "Warnung ab %w, kritisch ab %c", tempNone: "Meldet keine Temperatur", tempDown: "Ruht und misst gerade nicht",
      serial: "Seriennummer", hours: "%n Betriebsstunden", wear: "Abnutzung %n %", counts: "Lesezugriffe %r, Schreibzugriffe %w",
      member: "Gehört zum Pool %p", details: "Details", aopArray: "Array", aopDisks: "Platten", aopSystem: "System",
      spinAllUp: "Platten anlaufen lassen", spinAllDown: "Platten anhalten", arrayFill: "Füllstand des Arrays",
      arrayTip: "%u von %s belegt. Ab 90 % wird das Gefäß orange, über 95 % rot.", tempAvg: "Mittelwert der Datenträger, die gerade eine Temperatur melden",
      moving: "Mover läuft", movingTip: "Er verschiebt gerade Dateien zwischen den Pools und dem Array.",
      hdd: "Festplatte", ssd: "SATA-SSD", nvme: "NVMe-SSD", usb: "USB-Stick" },
    en: { view: "View", list: "List", tiles: "Tiles", spinDown: "Spin down", spinUp: "Spin up", browse: "Browse", log: "Disk log",
      resting: "Spun down", used: "used", free: "free", of: "of", temp: "Temperature", read: "Read", write: "Write", errors: "errors",
      smartWarn: "SMART warning", smartFail: "SMART failed",
      smartFailTip: "The SMART self-assessment failed", parity: "Parity valid, protects %n disks",
      tempTip: "Warning from %w, critical from %c", tempNone: "Reports no temperature", tempDown: "Spun down, not measuring",
      serial: "Serial number", hours: "%n power-on hours", wear: "Wear %n %", counts: "Reads %r, writes %w",
      member: "Part of pool %p", details: "Details", aopArray: "Array", aopDisks: "Disks", aopSystem: "System", arrayFill: "Array fill level",
      arrayTip: "%u of %s used. The vessel turns orange from 90 % and red past 95 %.", tempAvg: "Average of the disks that report a temperature right now",
      moving: "Mover running", movingTip: "It is moving files between the pools and the array.",
      hdd: "Hard disk", ssd: "SATA SSD", nvme: "NVMe SSD", usb: "USB flash drive" }
  };
  function t(k) { return (TXT[LANG] || TXT.en)[k] || TXT.en[k]; }

  function pn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }
  // The same gate as the Start area's styling in shares.js, which needs Unraid's tabbed mode.
  function live() {
    return g("tt.theming", "1") !== "0" && g("tt.enable.main", "0") !== "0" && pn() === "/Main" && !!document.querySelector("#displaybox nav.tabs");
  }
  // One key for the whole page, written by its switch and by the settings page.
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
  // Text as it reads, with a <br> as a line break and Unraid's a.info tooltips left out, since
  // their hidden span would run into the value beside them.
  function text(n, keepInfo) {
    var out = "", cn = n && n.childNodes ? n.childNodes : [];
    for (var i = 0; i < cn.length; i++) {
      var c = cn[i];
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType === 1) {
        if (tag(c) === "BR") out += "\n";
        else if (keepInfo || !hasCls(c, "info")) out += text(c, keepInfo);
      }
    }
    return out;
  }
  function clean(v) { return String(v || "").replace(/[   ]/g, " ").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim(); }

  // Unraid scales every size and rate to three digits, so a lone comma is a decimal comma.
  var POW = { B: 0, K: 1, M: 2, G: 3, T: 4, P: 5 };
  function bytes(v) {
    var m = /([\d.,]+)\s*([KMGTP]?)i?B\b/i.exec(clean(v)); if (!m) return null;
    return parseFloat(m[1].replace(",", ".")) * Math.pow(1000, POW[(m[2] || "B").toUpperCase()]);
  }
  function rate(v) { return /\/s\b/.test(v || "") ? bytes(v) || 0 : 0; }
  function temp(v) {
    var m = /(-?\d+(?:[.,]\d+)?)\s*°\s*([CF])?/.exec(clean(v)); if (!m) return null;
    var n = parseFloat(m[1].replace(",", "."));
    return m[2] === "F" ? { shown: n, c: (n - 32) * 5 / 9, unit: "F" } : { shown: n, c: n, unit: "C" };
  }
  // The inline handlers the tiles may call, read off Unraid's own controls.
  var CALLS = { toggle_state: 1, spinUpDisk: 1, spinDownDisk: 1, openTerminal: 1 };
  function parseCall(src) {
    var m = /^\s*(\w+)\(([^)]*)\)/.exec(src || ""); if (!m || !CALLS[m[1]]) return null;
    var args = [], re = /'([^']*)'|"([^"]*)"/g, a;
    while ((a = re.exec(m[2]))) args.push(a[1] != null ? a[1] : a[2]);
    return { fn: m[1], args: args };
  }
  function run(c) { if (c && typeof window[c.fn] === "function") window[c.fn].apply(window, c.args); }

  // The cells Unraid wrote, without the Browse column shares.js inserts.
  function cells(tr) { return kids(tr).filter(function (c) { return tag(c) === "TD" && !hasCls(c, "tt-browse-col"); }); }
  function usage(td) {
    if (!td) return null;
    var bar = find(td, function (n) { return hasCls(n, "usage-disk"); });
    var label = clean(bar ? text(kids(bar)[kids(bar).length - 1]) : text(td));
    if (!label) return null;
    var w = bar ? /width:\s*([\d.]+)%/.exec(attr(kids(bar)[0], "style")) : null;
    return { text: label, bytes: bytes(label), pct: w ? parseFloat(w[1]) : null };
  }
  function fsInfo(fsTd, sizeTd, usedTd, freeTd) {
    var fs = fsTd ? clean(text(fsTd)) : "";
    if ((fsTd && !fs) || !usedTd) return null;
    var used = usage(usedTd), free = usage(freeTd);
    if (!used || !free) return null;
    var pct = used.pct != null ? used.pct : (used.bytes != null && free.bytes != null && used.bytes + free.bytes > 0 ? 100 * used.bytes / (used.bytes + free.bytes) : 0);
    return { fs: fs, size: clean(text(sizeTd)), used: used.text, free: free.text, pct: pct };
  }
  function linkName(href) { var m = /[?&]name=([^&#]+)/.exec(href || ""); return m ? decodeURIComponent(m[1]) : ""; }
  // The kind of drive, from the disk log glyph Unraid picks by transport and rotation.
  function kindOf(icon, dev) {
    if (/icon-usb/.test(icon)) return "usb";
    if (/icon-nvme/.test(icon)) return /^nvme/.test(dev) ? "nvme" : "ssd";
    return "hdd";
  }
  function orbState(orb) {
    var c = attr(orb, "class");
    if (/red-orb/.test(c)) return "err";
    if (/yellow-orb/.test(c)) return "warn";
    if (/blue-orb/.test(c)) return "new";
    if (/grey-orb/.test(c) && /fa-square/.test(c)) return "missing";
    return "ok";
  }
  function splitId(id) {
    var i = id.lastIndexOf("_");
    return i > 0 ? { model: id.slice(0, i).replace(/_/g, " "), serial: id.slice(i + 1) } : { model: id.replace(/_/g, " "), serial: "" };
  }

  function ioText(td, cls) { var sp = find(td, function (n) { return hasCls(n, cls); }); return clean(text(sp || td)); }
  // A disk row of Unraid's device_list: device, identification, temperature, reads, writes,
  // errors, then the file system cells, or one empty cell spanning them.
  function readRow(tr) {
    var c = cells(tr);
    if (c.length < 6) return null;
    if (find(tr, function (n) { return tag(n) === "SELECT"; })) return { offline: true };
    var link = find(c[0], function (n) { return tag(n) === "A" && /\/Main\/(Device|Boot)\?name=/.test(attr(n, "href")) && attr(n, "href").indexOf("#") < 0; });
    var log = find(c[1], function (n) { return /openTerminal\(/.test(attr(n, "onclick")); });
    if (!link || !log) return null;
    var orb = find(c[0], function (n) { return hasCls(n, "orb"); });
    var spin = parseCall(attr(orb, "onclick"));
    var bitstream = find(c[1], function (n) { return /bitstream/.test(attr(n, "style")); });
    var id = clean(text(bitstream));
    var tail = /- ([\d.,]+ ?[KMGTP]?B) \(([^)]+)\)\s*$/.exec(clean(text(c[1])));
    var logCall = parseCall(attr(log, "onclick"));
    var dev = tail ? tail[2] : (logCall && logCall.args[1]) || "";
    var icon = find(log, function (n) { return tag(n) === "I"; });
    var browse = find(tr, function (n) { return tag(n) === "A" && hasCls(n, "view") && !!attr(n, "href"); });
    var errInfo = find(c[5], function (n) { return hasCls(n, "info"); });
    var tip = find(orb && orb.parentNode, function (n) { return tag(n) === "SPAN"; });
    var href = attr(link, "href"), name = linkName(href), parts = splitId(id);
    return {
      key: name, name: clean(text(link)), href: href, dev: dev, kind: kindOf(attr(icon, "class"), dev), id: id, model: parts.model, serial: parts.serial,
      size: tail ? bytes(tail[1]) : null, temp: temp(text(c[2])),
      rdText: ioText(c[3], "diskio"), wrText: ioText(c[4], "diskio"), reads: ioText(c[3], "number"), writes: ioText(c[4], "number"),
      rd: rate(ioText(c[3], "diskio")), wr: rate(ioText(c[4], "diskio")),
      errors: parseInt(clean(text(c[5])).replace(/\D/g, ""), 10) || 0, errTip: clean(text(errInfo && find(errInfo, function (n) { return tag(n) === "SPAN"; }), true)),
      fs: c.length >= 10 ? fsInfo(c[6], c[7], c[8], c[9]) : null,
      browse: browse ? attr(browse, "href") : "", spin: spin, log: logCall,
      down: !!spin && spin.args[spin.args.length - 1] === "up", state: orbState(orb),
      stateTip: clean(attr(orb && orb.parentNode, "data-tt-tip") || text(tip, true)),
      parity: /^parity\d*$/.test(name)
    };
  }
  function readArray(tb) {
    var out = { disks: [], total: null, offline: false };
    kids(tb).forEach(function (tr) {
      if (hasCls(tr, "tr_last")) {
        var c = cells(tr);
        if (find(tr, function (n) { return tag(n) === "SELECT"; })) out.offline = true;
        else if (c.length >= 10) out.total = { label: clean(text(c[1])), temp: temp(text(c[2])), rdText: ioText(c[3], "diskio"), wrText: ioText(c[4], "diskio"), fs: fsInfo(null, c[7], c[8], c[9]) };
        return;
      }
      var d = readRow(tr);
      if (d && d.offline) out.offline = true; else if (d) out.disks.push(d);
    });
    return out;
  }
  // A pool's tbody: its header row with the file system of the whole pool, then one row per member.
  function readPool(tb) {
    var head = kids(tb).filter(function (tr) { return hasCls(tr, "pool_header"); })[0];
    var pool = { key: "", name: "", status: "", fs: null, browse: "", disks: [], offline: false };
    if (head) {
      var c = cells(head);
      var link = find(c[0], function (n) { return tag(n) === "A" && /\/Main\/Device\?name=/.test(attr(n, "href")); });
      pool.key = linkName(attr(link, "href")); pool.name = clean(text(link));
      var view = find(head, function (n) { return tag(n) === "A" && hasCls(n, "view") && !!attr(n, "href"); });
      pool.browse = view ? attr(view, "href") : "";
      var st = /\(([^)]+)\)/.exec(clean(text(c[1], true)));
      pool.status = st ? st[1] : "";
      if (c.length >= 7) pool.fs = fsInfo(c[3], c[4], c[5], c[6]);
    }
    kids(tb).forEach(function (tr) {
      if (tr === head) return;
      var d = readRow(tr);
      if (d && d.offline) pool.offline = true; else if (d) pool.disks.push(d);
    });
    return pool;
  }
  // The boot tbody: the flash or boot device rows, and rows of plain text such as the internal boot hint.
  function readBoot(tb) {
    var out = { disks: [], notes: [], offline: false };
    kids(tb).forEach(function (tr) {
      var d = readRow(tr);
      if (d && d.offline) { out.offline = true; return; }
      if (d) { out.disks.push(d); return; }
      var desc = find(tr, function (n) { return hasCls(n, "desc"); });
      if (desc && clean(text(desc))) out.notes.push(desc);
    });
    return out;
  }
  // An Unassigned Devices disk row: device, serial with the disk log, mount button, temperature,
  // reads, writes, settings, file system, size, used and free. Its partitions follow in rows of
  // their own, where the browse link sits.
  function readUd(tb) {
    var rows = kids(tb);
    // A row spanning the table carries Unassigned Devices' own notice, such as no disks or a failed
    // refresh; until one or a disk arrives, its table stays in view.
    var notice = rows.map(function (r) { return find(r, function (n) { return tag(n) === "TD" && +attr(n, "colspan") >= 10; }); }).filter(Boolean)[0];
    var out = { disks: [], offline: false, notice: notice ? clean(text(notice)) : "", unknown: !notice };
    rows.forEach(function (tr) {
      if (!hasCls(tr, "toggle-disk")) return;
      var c = kids(tr).filter(function (x) { return tag(x) === "TD"; });
      if (c.length < 11) return;
      var link = find(c[0], function (n) { return tag(n) === "A" && /\/Main\/(Device|New)\?name=/.test(attr(n, "href")); });
      var log = find(c[1], function (n) { return /openTerminal\(/.test(attr(n, "onclick")); });
      if (!link) return;
      var logCall = parseCall(attr(log, "onclick"));
      var dev = (logCall && logCall.args[1]) || linkName(attr(link, "href"));
      var spinEl = find(c[0], function (n) { return /spin(Up|Down)Disk\(/.test(attr(n, "onclick")); });
      var spin = parseCall(attr(spinEl, "onclick"));
      var icon = find(log, function (n) { return tag(n) === "I"; });
      var parts = rows.filter(function (r) { return hasCls(r, "toggle-" + dev); });
      var browse = null;
      parts.some(function (r) { browse = find(r, function (n) { return tag(n) === "A" && /\/Main\/Browse\?dir=/.test(attr(n, "href")); }); return !!browse; });
      var serial = clean(text(c[1])).replace(/\s*\([^)]*\)\s*$/, "");
      var used = usage(c[9]), free = usage(c[10]);
      var fs = clean(text(c[7]));
      out.disks.push({
        key: "ud-" + dev, name: clean(text(link)), href: attr(link, "href"), dev: dev, kind: kindOf(/icon-nvme/.test(attr(icon, "class")) ? "icon-nvme" : "", dev),
        id: serial, model: splitId(serial).model, serial: splitId(serial).serial, size: bytes(text(c[8])), temp: temp(text(c[3])),
        rdText: clean(text(c[4])), wrText: clean(text(c[5])), reads: "", writes: "", rd: rate(text(c[4])), wr: rate(text(c[5])), errors: null, errTip: "",
        fs: fs && used && free ? { fs: fs, size: clean(text(c[8])), used: used.text, free: free.text, pct: used.pct != null ? used.pct : 0 } : null,
        browse: browse ? attr(browse, "href") : "", spin: spin, log: logCall,
        down: !!spin && spin.fn === "spinUpDisk", state: "ok", stateTip: "", parity: false
      });
    });
    if (out.disks.length) out.unknown = false;
    return out;
  }

  // A size under ten keeps its first decimal, so a 1.5 TB disk does not read as 2 TB.
  function cap(b) {
    if (b == null) return "";
    var v = b >= 1e12 ? b / 1e12 : b / 1e9;
    return (v < 10 ? Math.round(v * 10) / 10 : Math.round(v)) + (b >= 1e12 ? " TB" : " GB");
  }
  function lvl(p) { return p >= 90 ? "tt-dk-err" : p >= 70 ? "tt-dk-warn" : "tt-dk-ok"; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function fill(str, map) { return str.replace(/%(\w)/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  var nf = (function () { try { return new Intl.NumberFormat(document.documentElement.lang || undefined); } catch (e) { return { format: String }; } })();

  // What disks.php knows per device; until it answers, the thresholds are Unraid's defaults.
  var extra = {};
  function limits(d) {
    var x = extra[d.dev];
    if (x && x.hot != null) return [x.hot, x.max];
    return d.kind === "hdd" ? [45, 55] : [60, 70];
  }
  function tempState(d) {
    if (!d.temp || d.down) return "";
    var l = limits(d);
    return d.temp.c >= l[1] ? "err" : d.temp.c >= l[0] ? "warn" : "";
  }
  function tempTip(d) {
    if (d.down) return t("tempDown");
    if (!d.temp) return t("tempNone");
    var l = limits(d), u = d.temp.unit === "F" ? function (c) { return Math.round(c * 9 / 5 + 32) + " °F"; } : function (c) { return c + " °C"; };
    return fill(t("tempTip"), { w: u(l[0]), c: u(l[1]) });
  }
  function tipFor(d) {
    var x = extra[d.dev] || {}, lines = [d.model];
    if (d.serial) lines.push(t("serial") + " " + d.serial);
    if (x.hours) lines.push(fill(t("hours"), { n: nf.format(x.hours) }));
    if (x.wear != null && d.kind !== "hdd") lines.push(fill(t("wear"), { n: x.wear }));
    if (d.reads || d.writes) lines.push(fill(t("counts"), { r: d.reads, w: d.writes }));
    if (d.stateTip) lines.push(d.stateTip.split("\n")[0]);
    return lines.join("\n");
  }

  // Glyphs: TTTheme's set where it has them, and the ones it lacks from GlimStone's glyph set.
  var OWN = {
    FolderOpen: ["0 -31.981 575.963 575.963", '<path d="M88.7 223.8L0 375.8 0 96C0 60.7 28.7 32 64 32l117.5 0c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7L416 96c35.3 0 64 28.7 64 64l0 32-336 0c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224l400 0c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480L32 480c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z"/>'],
    ShieldOn: ["0 -0.018 14 14", '<path fill-rule="evenodd" d="M14 4.809 L14 1.504 L13.957 1.142 L13.834 0.812 L13.711 0.615 L13.561 0.44 L13.386 0.29 L13.189 0.167 L12.86 0.043 L12.499 0 L1.396 0.004 L1.157 0.039 L0.932 0.111 L0.724 0.216 L0.536 0.351 L0.371 0.512 L0.233 0.697 L0.124 0.903 L0.047 1.125 L0 1.486 L0.001 5.032 L0.018 5.517 L0.075 6.116 L0.217 6.938 L0.429 7.737 L0.708 8.509 L1.053 9.25 L1.277 9.658 L1.521 10.054 L1.784 10.437 L2.066 10.807 L2.366 11.163 L2.683 11.503 L3.017 11.828 L3.368 12.137 L3.735 12.429 L4.117 12.702 L4.513 12.958 L4.924 13.194 L5.349 13.41 L5.787 13.605 L6.238 13.779 L6.7 13.929 L6.933 13.964 L7.168 13.954 L7.284 13.933 L7.63 13.825 L8.085 13.657 L8.527 13.468 L8.955 13.258 L9.37 13.027 L10.062 12.578 L10.708 12.073 L11.305 11.515 L11.623 11.175 L11.923 10.82 L12.405 10.165 L12.83 9.47 L13.193 8.739 L13.492 7.977 L13.725 7.186 L13.889 6.37 L13.972 5.655ZM3.428 7.272 L3.262 7.048 L3.191 6.876 L3.15 6.6 L3.168 6.415 L3.262 6.152 L3.366 5.997 L3.497 5.866 L3.736 5.722 L4.007 5.655 L4.193 5.655 L4.464 5.722 L4.628 5.81 L4.772 5.928 L6.174 7.331 L9.303 3.954 L9.443 3.831 L9.603 3.737 L9.779 3.676 L9.964 3.651 L10.241 3.681 L10.416 3.746 L10.646 3.903 L10.769 4.043 L10.863 4.203 L10.941 4.471 L10.938 4.75 L10.891 4.93 L10.757 5.174 L6.897 9.346 L6.754 9.472 L6.588 9.567 L6.313 9.643 L6.123 9.647 L5.935 9.612 L5.676 9.492 L5.528 9.372Z"/>']
  };
  function labelled(b, name, text) { if (window.TTTheme && window.TTTheme.labelled) window.TTTheme.labelled(b, name, text); else b.textContent = text; return b; }
  function glyph(n) {
    if (OWN[n]) return '<svg class="tt-glyph" viewBox="' + OWN[n][0] + '" fill="currentColor" aria-hidden="true" focusable="false">' + OWN[n][1] + "</svg>";
    return window.TTTheme && window.TTTheme.glyph ? window.TTTheme.glyph(n) : "";
  }
  var INFO = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>';

  // One drawing per kind of drive, its label in the card colour naming the kind; the capacity
  // stands in the card's badge. A parity disk wears the shield beside its label. The gradients
  // live once in the page, see defs(). The platter is an HTML layer between the case and the arm,
  // since the compositor turns only HTML: on an SVG node the turn waits for every task Unraid and
  // the other scripts run on /Main, and stalls each second while they do.
  function drawHdd(d) {
    var sticker = d.parity
      ? '<rect class="tt-dk-st" x="124" y="15" width="62" height="22" rx="3"/><svg class="tt-dk-ink" x="130" y="19" width="14" height="14" viewBox="' + OWN.ShieldOn[0] + '">' + OWN.ShieldOn[1] + '</svg><text class="tt-dk-ink" x="180" y="30.5" font-size="12" font-weight="800" letter-spacing="1.5" text-anchor="end">HDD</text>'
      : '<rect class="tt-dk-st" x="132" y="15" width="54" height="22" rx="3"/><text class="tt-dk-ink" x="159.75" y="30.5" font-size="12" font-weight="800" letter-spacing="1.5" text-anchor="middle">HDD</text>';
    var streaks = "";
    [44, 36, 28, 20].forEach(function (r, i) { streaks += '<path d="M ' + (78 + r) + " 68 A " + r + " " + r + " 0 0 1 " + (78 + r * Math.cos(1.1 + i * 0.25)).toFixed(2) + " " + (68 + r * Math.sin(1.1 + i * 0.25)).toFixed(2) + '" fill="none" stroke="var(--tt-dk-sheen)" stroke-width="' + (2.6 - i * 0.4).toFixed(1) + '" stroke-linecap="round"/>'; });
    [40, 24].forEach(function (r) { streaks += '<path d="M ' + (78 - r) + " 68 A " + r + " " + r + " 0 0 1 " + (78 - r * Math.cos(0.7)).toFixed(2) + " " + (68 - r * Math.sin(0.7)).toFixed(2) + '" fill="none" stroke="var(--tt-dk-sheen)" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>'; });
    var screws = "";
    for (var i = 0; i < 6; i++) screws += '<circle cx="' + (78 + 8.5 * Math.cos(i * Math.PI / 3)).toFixed(2) + '" cy="' + (68 + 8.5 * Math.sin(i * Math.PI / 3)).toFixed(2) + '" r="1.5" fill="#555"/>';
    return '<div class="tt-dk-drive tt-dk-hdd" aria-hidden="true"><svg viewBox="3 3 194 130">' +
      '<rect x="6" y="6" width="188" height="124" rx="10" fill="url(#tt-dk-metal)"/>' +
      '<rect x="12" y="10" width="176" height="116" rx="8" fill="var(--tt-dk-well)"/>' +
      '<circle cx="78" cy="68" r="55" fill="var(--tt-dk-metal-b)"/></svg>' +
      '<div class="tt-dk-plat"><svg viewBox="25 15 106 106"><circle cx="78" cy="68" r="53" fill="url(#tt-dk-plat)"/>' + streaks +
      '<circle cx="78" cy="68" r="13" fill="var(--tt-dk-hub)"/>' + screws + '<circle cx="78" cy="68" r="4" fill="#3a3a3a"/></svg></div>' +
      '<svg viewBox="3 3 194 130">' + sticker +
      '<path d="M168 84 L186 92 L186 124 L160 124 Z" fill="var(--tt-dk-metal-b)"/>' +
      '<g class="tt-dk-arm" style="transform-origin:168px 106px"><g class="tt-dk-seek" style="transform-origin:168px 106px"><g transform="translate(168 106) rotate(-134)">' +
      '<path d="M0 -8 L78 -2.6 L94 -1.6 L94 1.6 L78 2.6 L0 8 Z" fill="var(--tt-dk-arm)"/><path d="M0 -8 L78 -2.6 L94 -1.6 L94 0 L0 0 Z" fill="var(--tt-dk-arm-hi)" opacity=".6"/>' +
      '<rect x="88" y="-3.2" width="9" height="6.4" rx="1.2" fill="#6a6a6a"/></g></g>' +
      '<circle cx="168" cy="106" r="11" fill="#9a9a9a"/><circle cx="168" cy="106" r="4" fill="#4a4a4a"/></g>' +
      '<circle class="tt-dk-led" cx="24" cy="118" r="3.2"/></svg></div>';
  }
  var clipN = 0;
  function drawSsd() {
    var id = "tt-dk-clip" + (++clipN), pins = "";
    for (var i = 0; i < 9; i++) pins += '<rect x="22" y="' + (42 + i * 6) + '" width="6" height="3" fill="var(--tt-dk-gold)"/>';
    return '<svg class="tt-dk-drive" viewBox="0 0 200 136" aria-hidden="true"><defs><clipPath id="' + id + '"><rect x="44" y="28" width="122" height="80" rx="5"/></clipPath></defs>' +
      '<rect x="30" y="16" width="150" height="104" rx="9" fill="url(#tt-dk-metal)"/><rect x="20" y="38" width="10" height="60" rx="2" fill="#1b1b1b"/>' + pins +
      '<rect x="44" y="28" width="122" height="80" rx="5" fill="#141414"/>' +
      '<rect class="tt-dk-st" x="44" y="28" width="122" height="24" rx="5"/><rect class="tt-dk-st" x="44" y="44" width="122" height="8"/>' +
      '<text class="tt-dk-ink" x="54" y="45" font-size="12" font-weight="800" letter-spacing="1.5">SSD</text>' +
      '<rect class="tt-dk-bar" x="54" y="64" width="70" height="5" rx="2.5"/><rect class="tt-dk-bar tt-dk-n2" x="54" y="76" width="96" height="5" rx="2.5"/><rect class="tt-dk-bar tt-dk-n3" x="54" y="88" width="52" height="5" rx="2.5"/>' +
      '<g clip-path="url(#' + id + ')"><rect class="tt-dk-sweep" x="44" y="28" width="56" height="80" fill="url(#tt-dk-sweep)"/></g>' +
      '<circle class="tt-dk-led" cx="166" cy="112" r="3"/></svg>';
  }
  // Dots in the card colour that run into a flash drive one after another while it reads or writes.
  function flowDots(x, ys) {
    return ys.map(function (y, i) { return '<circle class="tt-dk-flow tt-dk-st' + (i ? " tt-dk-n" + (i + 1) : "") + '" cx="' + x + '" cy="' + y + '" r="1.8"/>'; }).join("");
  }
  function drawNvme() {
    var fingers = "";
    for (var i = 0; i < 12; i++) if (i !== 8) fingers += '<rect x="12" y="' + (49 + i * 3.3).toFixed(1) + '" width="9" height="2.2" fill="var(--tt-dk-gold)"/>';
    return '<svg class="tt-dk-drive" viewBox="2 24 196 88" aria-hidden="true"><rect x="10" y="46" width="182" height="44" rx="3" fill="var(--tt-dk-pcb)"/>' + fingers +
      '<circle cx="190" cy="68" r="5.5" fill="var(--tt-dk-inset)"/><path d="M24 60 H44 M24 68 H44 M24 76 H44" stroke="#3b3b3b" stroke-width="1.2"/>' +
      '<rect x="44" y="55" width="24" height="26" rx="2" fill="var(--tt-dk-nand)"/><rect x="49" y="60" width="14" height="16" rx="1" fill="#222"/>' +
      '<rect class="tt-dk-st" x="74" y="51" width="104" height="34" rx="2"/>' +
      '<text class="tt-dk-ink" x="126" y="72.5" font-size="12" font-weight="800" letter-spacing="1" text-anchor="middle">NVMe</text>' +
      flowDots(22, [60, 68, 76]) + '<circle class="tt-dk-led" cx="186" cy="84" r="2.4"/></svg>';
  }
  function drawUsb() {
    return '<svg class="tt-dk-drive" viewBox="10 22 174 92" aria-hidden="true"><rect x="22" y="52" width="46" height="32" rx="2" fill="url(#tt-dk-conn)"/>' +
      '<rect x="34" y="60" width="8" height="6" fill="#2a2a2a"/><rect x="50" y="60" width="8" height="6" fill="#2a2a2a"/>' +
      '<rect x="62" y="44" width="110" height="48" rx="10" fill="url(#tt-dk-plastic)"/><circle cx="160" cy="68" r="6" fill="var(--tt-dk-inset)"/>' +
      '<rect class="tt-dk-st" x="76" y="56" width="66" height="24" rx="3"/>' +
      '<text class="tt-dk-ink" x="109.75" y="72.5" font-size="12" font-weight="800" letter-spacing="1.5" text-anchor="middle">USB</text>' +
      flowDots(66, [50, 86, 50]) + '<circle class="tt-dk-led" cx="150" cy="54" r="2.6"/></svg>';
  }
  var DRAW = { hdd: drawHdd, ssd: drawSsd, nvme: drawNvme, usb: drawUsb };
  function defs() {
    if (document.getElementById("tt-dk-defs")) return;
    var box = document.createElement("div");
    box.innerHTML = '<svg id="tt-dk-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="tt-dk-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--tt-dk-metal-a)"/><stop offset="1" style="stop-color:var(--tt-dk-metal-b)"/></linearGradient>' +
      '<radialGradient id="tt-dk-plat" cx=".42" cy=".38" r=".7"><stop offset="0" style="stop-color:var(--tt-dk-plat-a)"/><stop offset=".55" style="stop-color:color-mix(in srgb, var(--tt-dk-plat-a) 55%, var(--tt-dk-plat-b))"/><stop offset="1" style="stop-color:var(--tt-dk-plat-b)"/></radialGradient>' +
      '<linearGradient id="tt-dk-conn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6d6d6"/><stop offset=".5" stop-color="#9a9a9a"/><stop offset="1" stop-color="#c4c4c4"/></linearGradient>' +
      '<linearGradient id="tt-dk-plastic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--tt-dk-plastic)"/><stop offset="1" style="stop-color:var(--tt-dk-plastic-b)"/></linearGradient>' +
      '<linearGradient id="tt-dk-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      "</defs></svg>";
    document.body.appendChild(box.firstChild);
  }

  function actions(d) {
    var a = "";
    if (d.spin) { var l = d.down ? t("spinUp") : t("spinDown"); a += '<span class="tt-dk-ib" data-act="spin" data-tip="' + esc(l) + '" aria-label="' + esc(l) + '">' + glyph("Power") + "</span>"; }
    if (d.browse) a += '<span class="tt-dk-ib" data-act="browse" data-tip="' + esc(t("browse")) + '" aria-label="' + esc(t("browse")) + '">' + glyph("FolderOpen") + "</span>";
    if (d.log) a += '<span class="tt-dk-ib" data-act="log" data-tip="' + esc(t("log")) + '" aria-label="' + esc(t("log")) + '">' + glyph("Log") + "</span>";
    return a;
  }
  function useHtml(d, ctx) {
    if (d.parity) return '<div class="tt-dk-use"><div class="tt-dk-parity"><span class="tt-dk-dot' + (d.state === "ok" ? "" : " tt-dk-" + d.state) + '"></span>' +
      esc(d.state === "ok" ? fill(t("parity"), { n: ctx.members }) : d.stateTip.split("\n")[0]) + "</div></div>";
    if (ctx.member) return '<div class="tt-dk-use"><div class="tt-dk-parity">' + esc(fill(t("member"), { p: ctx.member })) + "</div></div>";
    if (!d.fs) return '<div class="tt-dk-use"></div>';
    return '<div class="tt-dk-use"><div class="tt-dk-uselbl"><span><b data-f="used">' + esc(d.fs.used) + "</b> " + esc(t("used")) + ' · <span data-f="pct">' + Math.round(d.fs.pct) + '</span> %</span><span data-f="free">' + esc(d.fs.free + " " + t("free")) + "</span></div>" +
      '<div class="tt-dk-track"><div class="tt-dk-fill ' + lvl(d.fs.pct) + '" data-f="fill" style="width:' + Math.max(d.fs.pct, 1.5).toFixed(1) + '%"></div></div></div>';
  }
  // A chip only for what deviates: a state that is not normal, SMART that warns or fails, errors.
  // A disk that is fine shows none.
  function chipsHtml(d) {
    var x = extra[d.dev], h = "";
    if ((d.state === "warn" || d.state === "err" || d.state === "new") && !d.parity) h += '<span class="tt-dk-chip tt-dk-' + (d.state === "new" ? "plain" : d.state) + '" data-tip="' + esc(d.stateTip) + '">' + esc(d.stateTip.split("\n")[0]) + "</span>";
    if (x && (x.smart === "fail" || x.smart === "warn")) {
      var fail = x.smart === "fail";
      h += '<span class="tt-dk-chip ' + (fail ? "tt-dk-err" : "tt-dk-warn") + '" data-tip="' + esc(fail ? t("smartFailTip") : x.tip) + '"><span class="tt-dk-dot"></span>' + esc(fail ? t("smartFail") : t("smartWarn")) + "</span>";
    }
    if (d.errors) h += '<span class="tt-dk-chip tt-dk-err"' + (d.errTip ? ' data-tip="' + esc(d.errTip) + '"' : "") + ">" + esc(nf.format(d.errors) + " " + t("errors")) + "</span>";
    return h;
  }
  function tempHtml(d) {
    if (d.down) return glyph("Sleep") + esc(t("resting"));
    if (!d.temp) return '<span class="tt-dk-dot tt-dk-idle"></span>*';
    return '<span class="tt-dk-dot"></span>' + esc(nf.format(d.temp.shown) + " °" + d.temp.unit);
  }
  function busy(d) { return !d.down && (d.rd > 0 || d.wr > 0); }
  function pace(d) { var r = d.rd + d.wr; return r > 100e6 ? 0.5 : r > 10e6 ? 0.75 : 1.1; }

  // Unraid sends the rates once a second, and a disk that reads in bursts drops to zero between
  // them, so a card stays busy until HOLD after its last rate above zero. Array disks often see a
  // write every six seconds or so, which a shorter hold would break into a stop each time.
  var HOLD = 8000;
  function hold(c, active, after) {
    var now = Date.now();
    if (active) c.__ttSeen = now;
    var left = c.__ttSeen ? c.__ttSeen + HOLD - now : 0;
    clearTimeout(c.__ttHold);
    if (left > 0) c.__ttHold = setTimeout(function () { hold(c, false, after); }, left);
    c.classList.toggle("tt-dk-busy", left > 0);
    if (after) after(c);
  }

  // The platter runs up and coasts to a stop where it is, and the data in a flash drive glides to
  // a new pace. A CSS animation would stop dead, or jump when its duration changes.
  var UP = 0.9, DOWN = 1.6, GLIDE = 1.2, turning = [], last = 0, ticking = false;
  var FLOWS = { "tt-dk-sweep": 1, "tt-dk-bars": 1, "tt-dk-flow": 1 };
  function still() {
    return document.documentElement.getAttribute("data-tt-motion") === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function ms(v) { var m = /([\d.]+)\s*(m?s)/.exec(v || ""); return m ? parseFloat(m[1]) * (m[2] === "ms" ? 1 : 1000) : 0; }
  function flows(c) { return c.getAnimations({ subtree: true }).filter(function (a) { return FLOWS[a.animationName]; }); }
  function toward(v, to, step) { return v < to ? Math.min(to, v + step) : Math.max(to, v - step); }
  function motion(c) {
    var m = c.__ttMotion || (c.__ttMotion = { p: 0, f: 0, on: false, flowing: false });
    var on = c.classList.contains("tt-dk-busy") && !c.classList.contains("tt-dk-down");
    var plat = c.querySelector(".tt-dk-plat");
    if (still()) { m.p = 0; m.on = false; if (m.spin) m.spin.pause(); return; }
    var dur = plat ? ms(getComputedStyle(plat).getPropertyValue("--tt-motion-disk-spin")) : 0;
    if (plat && dur && on && !m.spin) { m.spin = plat.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: dur, iterations: Infinity }); m.spin.pause(); }
    if (m.spin && dur && m.spin.effect.getTiming().duration !== dur) {
      var was = m.spin.effect.getTiming().duration, at = m.spin.currentTime % was;
      m.spin.effect.updateTiming({ duration: dur });
      m.spin.currentTime = at / was * dur;
    }
    m.on = on;
    m.ft = 1 / (c.__ttPace || 1.1);
    if (on && !m.flowing) m.f = m.ft;
    m.flowing = on;
    if (on) flows(c).forEach(function (a) { a.playbackRate = m.f; });
    if (((m.spin && m.p !== (on ? 1 : 0)) || m.f !== m.ft) && turning.indexOf(c) < 0) turning.push(c);
    if (turning.length && !ticking) { ticking = true; last = 0; requestAnimationFrame(tick); }
  }
  function glide(c, dt) {
    var m = c.__ttMotion;
    if (!c.isConnected) { if (m.spin) m.spin.cancel(); m.spin = null; return false; }
    if (m.spin) {
      m.p = toward(m.p, m.on ? 1 : 0, dt / (m.on ? UP : DOWN));
      var r = m.p * m.p * (3 - 2 * m.p);
      // Assigning playbackRate to an animation the compositor is still picking up starts the pickup
      // over, so a platter that runs up from rest would stand until it reached full speed.
      if (r > 0) { m.spin.updatePlaybackRate(r); if (m.spin.playState !== "running") m.spin.play(); }
      else m.spin.pause();
    }
    if (m.f !== m.ft) {
      m.f = toward(m.f, m.ft, dt * GLIDE);
      flows(c).forEach(function (a) { a.playbackRate = m.f; });
    }
    return (m.spin && m.p !== (m.on ? 1 : 0)) || m.f !== m.ft;
  }
  function tick(now) {
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    turning = turning.filter(function (c) { return glide(c, dt); });
    if (turning.length) requestAnimationFrame(tick); else ticking = false;
  }
  function shapeOf(d, ctx) { return [d.kind, d.size, !!d.fs, d.parity, !!d.spin, !!d.browse, !!d.log, d.down, d.name, ctx.member || "", ctx.colour].join("|"); }

  function newCard(d, i, ctx) {
    var c = document.createElement("div");
    c.className = "tt-dk-card tt-dk-enter";
    c.setAttribute("tabindex", "0"); c.setAttribute("role", "link");
    c.setAttribute("data-key", d.key); c.setAttribute("data-kind", d.kind);
    c.setAttribute("aria-label", d.name + ", " + t(d.kind));
    c.style.setProperty("--tt-dk-i", i);
    if (ctx.colour) { c.style.setProperty("--tt-dk-c", ctx.colour); c.style.setProperty("--tt-dk-ct", ctx.ink); }
    c.innerHTML = '<div class="tt-dk-art">' + DRAW[d.kind](d) + '<div class="tt-dk-acts">' + actions(d) + "</div></div>" +
      '<div class="tt-dk-namerow"><span class="tt-dk-nb">' + esc(d.name) + "</span>" + (d.size ? '<span class="tt-dk-cap">' + esc(cap(d.size)) + "</span>" : "") + '<span class="tt-info tt-dk-info" tabindex="0" data-f="tip">' + INFO + '</span><span class="tt-dk-dev">' + esc(d.dev) + "</span></div>" +
      '<div class="tt-dk-model">' + esc(d.model + (d.fs ? " · " + d.fs.fs : "")) + "</div>" + useHtml(d, ctx) +
      '<div class="tt-dk-chips" data-f="chips"></div>' +
      '<div class="tt-dk-io"><div>' + esc(t("temp")) + '<b data-f="temp"></b></div><div class="tt-dk-rate">' + esc(t("read")) + '<b data-f="rd"></b></div><div class="tt-dk-rate">' + esc(t("write")) + '<b data-f="wr"></b></div></div>';
    if (window.TTTheme && window.TTTheme.pressable) Array.prototype.forEach.call(c.querySelectorAll(".tt-dk-ib"), window.TTTheme.pressable);
    c.addEventListener("animationend", function (e) { if (e.target === c) c.classList.remove("tt-dk-enter"); });
    return c;
  }
  function setText(el, v) { if (el && el.textContent !== v) el.textContent = v; }
  function setHtml(el, v) { if (el && el.__ttHtml !== v) { el.innerHTML = v; el.__ttHtml = v; } }
  // Live values go into the card in place, so a drawing keeps its running animation.
  function patch(c, d, ctx) {
    c.__ttDisk = d;
    c.classList.toggle("tt-dk-down", d.down);
    c.classList.toggle("tt-dk-access", busy(d));
    if (busy(d)) c.__ttPace = pace(d);
    if (d.down) c.__ttSeen = 0;
    hold(c, busy(d), motion);
    c.style.setProperty("--tt-dk-k", pace(d));
    var tip = c.querySelector('[data-f="tip"]'), tp = tipFor(d);
    if (tip && tip.getAttribute("data-tip") !== tp) { tip.setAttribute("data-tip", tp); tip.setAttribute("aria-label", t("details")); }
    var te = c.querySelector('[data-f="temp"]');
    if (te) { setHtml(te, tempHtml(d)); te.className = tempState(d) ? "tt-dk-" + tempState(d) : ""; te.setAttribute("data-tip", tempTip(d)); }
    setText(c.querySelector('[data-f="rd"]'), d.rdText);
    setText(c.querySelector('[data-f="wr"]'), d.wrText);
    setHtml(c.querySelector('[data-f="chips"]'), chipsHtml(d));
    if (d.fs && !ctx.member && !d.parity) {
      setText(c.querySelector('[data-f="used"]'), d.fs.used);
      setText(c.querySelector('[data-f="pct"]'), String(Math.round(d.fs.pct)));
      setText(c.querySelector('[data-f="free"]'), d.fs.free + " " + t("free"));
      var f = c.querySelector('[data-f="fill"]');
      if (f) {
        f.className = "tt-dk-fill " + lvl(d.fs.pct);
        f.style.width = Math.max(d.fs.pct, 1.5).toFixed(1) + "%";
      }
    }
    if (c.__ttWait && (c.__ttWait.down !== d.down || Date.now() - c.__ttWait.at > 30000)) { c.__ttWait = null; c.classList.remove("tt-dk-wait"); }
  }
  // Puts the cards for a list of disks into a grid, after lead when there is one, reusing a card
  // while its drawing still fits and moving only those out of place, since a moved node starts its
  // animations over.
  function fillGrid(grid, list, colourAt, lead) {
    var old = {}, at = lead ? 1 : 0;
    kids(grid).forEach(function (c) { if (c !== lead) old[attr(c, "data-key")] = c; });
    if (lead && grid.children[0] !== lead) grid.insertBefore(lead, grid.children[0] || null);
    list.forEach(function (it, i) {
      var ctx = it.ctx; ctx.colour = colourAt(it.n); ctx.ink = ink(ctx.colour);
      var c = old[it.d.key], sh = shapeOf(it.d, ctx);
      if (c && c.__ttShape !== sh) { grid.removeChild(c); c = null; }
      if (!c) { c = newCard(it.d, i, ctx); c.__ttShape = sh; }
      delete old[it.d.key];
      if (grid.children[i + at] !== c) grid.insertBefore(c, grid.children[i + at] || null);
      patch(c, it.d, ctx);
    });
    Object.keys(old).forEach(function (k) { if (old[k].parentNode === grid) grid.removeChild(old[k]); });
  }

  // Colours: the Start accent, or one rainbow colour per card as the list rows take them.
  function accent() {
    var a = g("tt.stylemain", "1") !== "0" ? g("tt.accent", "#FCC419") : g("ttm.accent", "#FCC419");
    return /^#[0-9a-f]{6}$/i.test(a) ? a : "#FCC419";
  }
  function ink(c) { return c && window.TTTheme && window.TTTheme.idealText ? window.TTTheme.idealText(c) : "#161616"; }
  function colourAt(n) {
    if (g("tt.rainbow", "0") !== "1" || !window.TTTheme || !window.TTTheme.rbColor) return "";
    return window.TTTheme.rbColor(n, accent());
  }

  function el(tagName, cls, html) { var n = document.createElement(tagName); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function sumHtml(label, f) {
    return "<span><b>" + esc(label) + "</b></span><span><b>" + esc(f.used) + "</b> " + esc(t("of") + " " + f.size + " " + t("used")) + "</span>" +
      '<span class="tt-dk-track tt-dk-sumbar"><span class="tt-dk-fill ' + lvl(f.pct) + '" style="width:' + f.pct.toFixed(1) + '%"></span></span><span>' + esc(f.free + " " + t("free")) + "</span>";
  }
  function strip(host, cls, html) {
    var n = host.querySelector(":scope > ." + cls);
    if (!html) { if (n) host.removeChild(n); return; }
    if (!n) { n = el("div", cls); host.appendChild(n); }
    setHtml(n, html);
  }

  function fillTone(p) { return p > 95 ? "err" : p >= 90 ? "warn" : "accent"; }
  // The whole array as the first card of its grid, built like a disk's with its fill level as a
  // vessel for the drawing (GlimStone: "A fill level is a vessel"), orange from 90 % and red past
  // 95 %. It is built once, so the liquid keeps sloshing, and opens nothing, so it takes no focus.
  function totalCard(grid, total, colour) {
    var c = grid.querySelector(":scope > .tt-dk-total"), fs = total && total.fs;
    if (!fs || !window.TTPictures) { if (c) grid.removeChild(c); return null; }
    if (!c) {
      c = el("div", "tt-dk-card tt-dk-total tt-dk-enter",
        '<div class="tt-dk-art"></div><div class="tt-dk-namerow"><span class="tt-dk-nb">' + esc(t("aopArray")) + '</span><span class="tt-dk-cap" data-f="cap"></span>' +
        '<span class="tt-info tt-dk-info" tabindex="0" data-f="tip" aria-label="' + esc(t("details")) + '">' + INFO + "</span></div>" +
        '<div class="tt-dk-model" data-f="label"></div><div class="tt-dk-use"><div class="tt-dk-uselbl"><span><b data-f="used"></b> ' + esc(t("used")) + ' · <span data-f="pct"></span> %</span><span data-f="free"></span></div>' +
        '<div class="tt-dk-track"><div class="tt-dk-fill" data-f="fill"></div></div></div>' +
        '<div class="tt-dk-io"><div>' + esc(t("temp")) + '<b data-f="temp" data-tip="' + esc(t("tempAvg")) + '"></b></div><div class="tt-dk-rate">' + esc(t("read")) + '<b data-f="rd"></b></div><div class="tt-dk-rate">' + esc(t("write")) + '<b data-f="wr"></b></div></div>');
      c.__ttVessel = window.TTPictures.vessel({ share: fs.pct / 100, label: t("arrayFill") });
      c.querySelector(".tt-dk-art").appendChild(c.__ttVessel.el);
      c.addEventListener("animationend", function (e) { if (e.target === c) c.classList.remove("tt-dk-enter"); });
    }
    c.__ttVessel.setLevel(fs.pct / 100).setTone(fillTone(fs.pct));
    setText(c.querySelector('[data-f="cap"]'), cap(bytes(fs.size)) || fs.size);
    setText(c.querySelector('[data-f="label"]'), total.label);
    setText(c.querySelector('[data-f="used"]'), fs.used);
    setText(c.querySelector('[data-f="pct"]'), String(Math.round(fs.pct)));
    setText(c.querySelector('[data-f="free"]'), fs.free + " " + t("free"));
    var f = c.querySelector('[data-f="fill"]');
    f.className = "tt-dk-fill " + lvl(fs.pct);
    f.style.width = Math.max(fs.pct, 1.5).toFixed(1) + "%";
    var tip = c.querySelector('[data-f="tip"]'), tp = fill(t("arrayTip"), { u: fs.used, s: fs.size });
    if (tip.getAttribute("data-tip") !== tp) tip.setAttribute("data-tip", tp);
    setHtml(c.querySelector('[data-f="temp"]'), total.temp ? '<span class="tt-dk-dot"></span>' + esc("Ø " + nf.format(total.temp.shown) + " °" + total.temp.unit) : '<span class="tt-dk-dot tt-dk-idle"></span>*');
    setText(c.querySelector('[data-f="rd"]'), total.rdText);
    setText(c.querySelector('[data-f="wr"]'), total.wrText);
    hold(c, rate(total.rdText) > 0 || rate(total.wrText) > 0);
    if (colour) { c.style.setProperty("--tt-dk-c", colour); c.style.setProperty("--tt-dk-ct", ink(colour)); }
    else { c.style.removeProperty("--tt-dk-c"); c.style.removeProperty("--tt-dk-ct"); }
    return c;
  }

  // Unraid's own subscriber on /Main says what the array is busy with, and 2 is the mover. Its
  // number reads the same in every language, where the button texts it sets would not.
  var moving = false, arrayUse = null;
  function watchMover() {
    var mon = window.mymonitor;
    if (!mon || typeof mon.on !== "function") return;
    mon.on("message", function (state) {
      var m = String(state) === "2";
      if (m !== moving) { moving = m; soon(); }
    });
  }
  // While the mover runs, the pools card shows its work as a picture: a line from each pool to the
  // array, packets travelling on it at one speed, the array's vessel splashing as each one lands.
  var MOVE_W = 220, MOVE_PITCH = 34;
  function moverFlow(host, pools) {
    var box = host.querySelector(":scope > .tt-dk-move");
    var from = pools.filter(function (p) { return p.disks.length; });
    var key = moving && window.TTPictures && from.length ? from.map(function (p) { return p.key; }).join("|") : "";
    if (box && box.__ttKey !== key) { box.__ttFlows.forEach(function (f) { f.remove(); }); host.removeChild(box); box = null; }
    if (!key) return;
    if (!box) {
      var h = Math.max(from.length * MOVE_PITCH, 56), top = (h - from.length * MOVE_PITCH) / 2 + MOVE_PITCH / 2;
      var figures = from.map(function (p, i) {
        var y = top + i * MOVE_PITCH;
        return '<rect class="tt-dk-movepool" x="0" y="' + (y - 12) + '" width="92" height="24" rx="12"/><text class="tt-dk-movename" x="46" y="' + (y + 4) + '" text-anchor="middle">' + esc(p.name) + "</text>";
      }).join("");
      box = el("div", "tt-dk-move", '<div class="tt-dk-movetxt"><b>' + esc(t("moving")) + "</b><span>" + esc(t("movingTip")) + "</span></div>" +
        '<div class="tt-dk-movepic"><svg viewBox="0 0 ' + MOVE_W + " " + h + '" width="' + MOVE_W + '" height="' + h + '" aria-hidden="true">' + figures + '</svg><span class="tt-dk-movedest"><span>' + esc(t("aopArray")) + "</span></span></div>");
      var svg = box.querySelector("svg"), dest = box.querySelector(".tt-dk-movedest");
      box.__ttVessel = window.TTPictures.vessel({ share: arrayUse ? arrayUse.pct / 100 : 0, label: t("arrayFill") });
      dest.insertBefore(box.__ttVessel.el, dest.firstChild);
      box.__ttFlows = from.map(function (p, i) { return window.TTPictures.flow(svg, [96, top + i * MOVE_PITCH], [MOVE_W, h / 2], { land: box.__ttVessel }); });
      box.__ttKey = key;
      host.appendChild(box);
    }
    if (arrayUse) box.__ttVessel.setLevel(arrayUse.pct / 100).setTone(fillTone(arrayUse.pct));
  }

  // The four sections, each found by the tbody Unraid fills and the box the list view shows.
  function sections() {
    var out = [];
    var arr = document.getElementById("array_devices");
    if (arr) out.push({ key: "array", tbodies: [arr], box: arr.closest(".TableContainer") || arr.closest("table") });
    var pools = Array.prototype.slice.call(document.querySelectorAll('#displaybox tbody[id^="pool_device"]'));
    if (pools.length) out.push({ key: "pools", tbodies: pools, box: pools[0].closest(".TableContainer") || pools[0].closest("table") });
    var boot = document.getElementById("boot_device");
    if (boot) out.push({ key: "boot", tbodies: [boot], box: boot.closest(".TableContainer") || boot.closest("table") });
    var ud = document.getElementById("disk-table-body");
    if (ud) out.push({ key: "ud", tbodies: [ud], box: ud.closest("table") });
    out.forEach(function (S) { S.sec = S.box && S.box.closest('section[role="tabpanel"]'); });
    return out.filter(function (S) { return S.box && S.sec; });
  }

  // One switch for the whole page, at the right end of the tab bar where Unraid keeps its own page
  // controls. In section view the bar holds nothing else, so the switch tops the page.
  function pageSwitch() {
    var nav = document.querySelector("#displaybox nav.tabs");
    var sw = nav.querySelector(":scope > .tt-dk-vsw");
    if (sw) return sw;
    sw = el("div", "tt-dk-vsw");
    var seg = el("span", "tt-dk-seg");
    seg.setAttribute("role", "group"); seg.setAttribute("aria-label", t("view"));
    [["list", "ViewList"], ["tiles", "ViewGrid"]].forEach(function (o) {
      // A span, since shares.js paints every button on /Main in the rainbow.
      var b = labelled(el("span", "tt-seg-btn"), o[1], t(o[0]));
      b.setAttribute("data-v", o[0]);
      if (window.TTTheme && window.TTTheme.pressable) window.TTTheme.pressable(b); else { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); }
      b.addEventListener("click", function () { s(KEY, o[0]); render(); });
      seg.appendChild(b);
    });
    sw.appendChild(seg);
    nav.insertBefore(sw, nav.querySelector(":scope > span.status"));
    return sw;
  }
  function hostFor(S) {
    var h = S.sec.querySelector(':scope .tt-dk-host[data-tt-dk="' + S.key + '"]');
    if (h) return h;
    h = el("div", "tt-dk-host");
    h.setAttribute("data-tt-dk", S.key);
    S.box.parentNode.insertBefore(h, S.box.nextSibling);
    h.addEventListener("click", onClick);
    h.addEventListener("keydown", onKey);
    return h;
  }
  function drop(S) {
    var h = S.sec && S.sec.querySelector(':scope .tt-dk-host[data-tt-dk="' + S.key + '"]');
    if (h) h.parentNode.removeChild(h);
    if (S.box) S.box.classList.remove("tt-dk-hidden");
  }

  function readSection(S) {
    if (S.key === "array") return readArray(S.tbodies[0]);
    if (S.key === "pools") { var pools = S.tbodies.map(readPool); return { pools: pools, offline: pools.some(function (p) { return p.offline; }) }; }
    if (S.key === "boot") return readBoot(S.tbodies[0]);
    return readUd(S.tbodies[0]);
  }
  function cardsOf(disks, n) {
    var members = disks.filter(function (d) { return !d.parity; }).length;
    return disks.map(function (d, i) { return { d: d, ctx: { members: members }, n: n + i }; });
  }
  // Puts the given children into parent in this order and drops the rest.
  function order(parent, list) {
    list.forEach(function (c, i) { if (parent.children[i] !== c) parent.insertBefore(c, parent.children[i] || null); });
    while (parent.children.length > list.length) parent.removeChild(parent.lastChild);
  }
  // A pool under its own section badge, which takes the colour of its first card, with the file
  // system and the pool state beside it.
  function poolBox(wrap, p, items) {
    var box = wrap.querySelector('.tt-dk-pool[data-pool="' + p.key + '"]');
    if (!box) { box = el("div", "tt-dk-pool", '<div class="tt-dk-phead"></div><div class="tt-dk-grid"></div>'); box.setAttribute("data-pool", p.key); }
    setHtml(box.querySelector(".tt-dk-phead"), '<span class="tt-dk-pb">' + esc(p.name) + "</span><span>" + esc([p.fs && p.fs.fs, p.status].filter(Boolean).join(" · ")) + "</span>");
    var grid = box.querySelector(".tt-dk-grid");
    grid.style.setProperty("--tt-dk-n", items.length);
    fillGrid(grid, items, colourAt);
    var c = colourAt(items[0].n);
    if (c) { box.style.setProperty("--tt-dk-c", c); box.style.setProperty("--tt-dk-ct", ink(c)); }
    else { box.style.removeProperty("--tt-dk-c"); box.style.removeProperty("--tt-dk-ct"); }
    return box;
  }
  function notesStrip(host, notes) {
    var box = host.querySelector(":scope > .tt-dk-notes");
    if (!notes.length) { if (box) host.removeChild(box); return; }
    if (!box) box = host.appendChild(el("div", "tt-dk-sum tt-dk-notes"));
    setHtml(box, notes.map(function (td) { return "<span>" + td.innerHTML + "</span>"; }).join(""));
  }
  // The pools stand side by side while the row has room for them, and wrap when it has not.
  function drawPools(host, pools) {
    var wrap = host.querySelector(":scope > .tt-dk-pools") || host.insertBefore(el("div", "tt-dk-pools"), host.firstChild);
    var boxes = [], n = 0;
    pools.forEach(function (p) {
      if (!p.disks.length) return;
      var multi = p.disks.length > 1;
      var items = p.disks.map(function (d) {
        var shown = Object.assign({}, d, { name: multi ? p.name + " " + d.name.replace(/\D+/g, "") : p.name, fs: multi ? null : p.fs, browse: d.browse || (multi ? "" : p.browse) });
        return { d: shown, ctx: { member: multi ? p.name : "" }, n: n++ };
      });
      var box = poolBox(wrap, p, items);
      strip(box, "tt-dk-sum", multi && p.fs ? sumHtml(p.name, p.fs) : "");
      boxes.push(box);
    });
    order(wrap, boxes);
    moverFlow(host, pools);
  }
  // Unassigned Devices' parts (its disks, the network shares, the past devices) share one wrapping
  // row, so they stand side by side where the section has room. UD finds them by class, wherever
  // they sit.
  function udRow(S) {
    var parts = kids(S.sec).filter(function (c) { return hasCls(c, "show-disks") || hasCls(c, "show-shares"); });
    if (!parts.length) return;
    var row = S.sec.querySelector(":scope > .tt-dk-udrow") || S.sec.insertBefore(el("div", "tt-dk-udrow"), parts[0]);
    parts.forEach(function (c) { row.appendChild(c); });
  }

  // Array-Vorgang becomes a card like the disk sections: the state badges on the left, then the
  // controls in three groups. Each form or table moves whole and a comment keeps its place, so
  // names, ids and handlers stay as Unraid wrote them and the list view gets the page back as it was.
  // Buttons other plugins hang into a form go with it; a block of their own joins the system group.
  function aopGroup(n) {
    if (n.matches('form[name="arrayOps"]') || n.querySelector('form[name="arrayOps"]')) return "Array";
    if (n.matches('form[name="mover_schedule"]') || n.querySelector('#spinup-button, #spindown-button, form[name="mover_schedule"]')) return "Disks";
    return "System";
  }
  function moveInto(box, n, before) {
    if (!n.__ttAopMark) { n.__ttAopMark = document.createComment("tt-dk-aop"); n.parentNode.insertBefore(n.__ttAopMark, n); }
    box.insertBefore(n, before || null);
  }
  function arrayOps(on) {
    var form = document.querySelector('#displaybox form[name="arrayOps"]');
    var sec = form && form.closest('section[role="tabpanel"]');
    var box = document.querySelector("#displaybox .tt-dk-aop");
    if (!on || !sec) {
      if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll(":scope > .tt-aop-pills, :scope > .tt-dk-aopg > :not(.tt-dk-aopt)"), function (n) {
        var m = n.__ttAopMark;
        if (m && m.parentNode) m.parentNode.replaceChild(n, m); else box.parentNode.insertBefore(n, box);
        n.__ttAopMark = null;
      });
      box.parentNode.classList.remove("tt-dk-box");
      box.parentNode.removeChild(box);
      return;
    }
    sec.classList.add("tt-dk-box");
    if (!box) {
      box = el("div", "tt-dk-aop");
      ["Array", "Disks", "System"].forEach(function (k) {
        var grp = el("div", "tt-dk-aopg", '<div class="tt-dk-aopt"><span class="tt-dk-pb">' + esc(t("aop" + k)) + "</span></div>");
        grp.setAttribute("data-g", k);
        box.appendChild(grp);
      });
      var head = sec.querySelector(":scope > .tt-card-head");
      sec.insertBefore(box, head ? head.nextSibling : sec.firstChild);
    }
    kids(sec).forEach(function (n) {
      if (n !== box && (tag(n) === "TABLE" ? hasCls(n, "array_status") : n.querySelector("table.array_status"))) moveInto(box.querySelector('[data-g="' + aopGroup(n) + '"]'), n);
    });
    // shares.js stacks the pills at the section's top level, also after the groups are built.
    var pills = sec.querySelector(":scope > .tt-aop-pills");
    if (pills) moveInto(box, pills, box.firstChild);
    kids(box).forEach(function (grp) { if (hasCls(grp, "tt-dk-aopg")) grp.classList.toggle("tt-dk-hidden", !grp.querySelector("table.array_status")); });
  }
  // Unraid's German calls spinning the disks up and down Hochfahren and Herunterfahren, the same as
  // powering the server down, so the two disk buttons get names of their own. The bold labels in
  // the description cell are what the bubbles beside the buttons read.
  function spinNames(on) {
    [["spinup-button", "spinAllUp", 0], ["spindown-button", "spinAllDown", 1]].forEach(function (x) {
      var b = document.getElementById(x[0]); if (!b) return;
      var row = b.closest("tr"), lab = row && row.children[2] ? row.children[2].querySelectorAll("strong")[x[2]] : null;
      if (b.__ttOrig == null) b.__ttOrig = b.value;
      if (lab && lab.__ttOrig == null) lab.__ttOrig = lab.textContent;
      var name = on && LANG === "de" ? t(x[1]) : null;
      var v = name || b.__ttOrig, lv = lab ? (name ? name + ":" : lab.__ttOrig) : null;
      if (b.value !== v) b.value = v;
      if (lab && lab.textContent !== lv) lab.textContent = lv;
    });
  }

  function renderSection(S) {
    var data = S.data;
    if (data.unknown) { drop(S); return; }
    S.box.classList.add("tt-dk-hidden");
    var host = hostFor(S);
    if (S.key === "pools") { drawPools(host, data.pools); return; }
    if (S.key === "ud" && !data.disks.length) {
      host.innerHTML = "";
      host.appendChild(el("div", "tt-dk-empty", "<b>" + esc(data.notice) + "</b>"));
      return;
    }
    var empty = host.querySelector(":scope > .tt-dk-empty"); if (empty) host.removeChild(empty);
    var grid = host.querySelector(":scope > .tt-dk-grid") || host.insertBefore(el("div", "tt-dk-grid"), host.firstChild);
    var lead = S.key === "array" ? totalCard(grid, data.total, colourAt(data.disks.length)) : null;
    grid.style.setProperty("--tt-dk-n", data.disks.length + (lead ? 1 : 0));
    fillGrid(grid, cardsOf(data.disks, 0), colourAt, lead);
    if (S.key === "array") arrayUse = data.total && data.total.fs;
    if (S.key === "boot") notesStrip(host, data.notes);
  }

  function cardOf(e) { return e.target && e.target.closest ? e.target.closest(".tt-dk-card") : null; }
  function act(kind, c) {
    var d = c.__ttDisk; if (!d) return;
    if (kind === "spin" && d.spin) { c.__ttWait = { down: d.down, at: Date.now() }; c.classList.add("tt-dk-wait"); run(d.spin); }
    else if (kind === "browse" && d.browse) location.href = d.browse;
    else if (kind === "log" && d.log) run(d.log);
  }
  // A click on the card opens the disk's settings, as the name link in Unraid's row does; the
  // action badges and the bubbles keep their own job.
  function onClick(e) {
    var c = cardOf(e); if (!c) return;
    var a = e.target.closest("[data-act]");
    if (a) { e.stopPropagation(); act(attr(a, "data-act"), c); return; }
    if (e.target.closest(".tt-info")) return;
    if (c.__ttDisk && c.__ttDisk.href) location.href = c.__ttDisk.href;
  }
  function onKey(e) {
    if (e.key !== "Enter") return;
    var c = cardOf(e);
    if (c && e.target === c && c.__ttDisk && c.__ttDisk.href) { e.preventDefault(); location.href = c.__ttDisk.href; }
  }

  function teardown() {
    arrayOps(false);
    spinNames(false);
    document.documentElement.classList.remove("tt-dk-on", "tt-dk-tiled", "tt-dk-sides");
    Array.prototype.forEach.call(document.querySelectorAll("#displaybox .tt-dk-host, #displaybox .tt-dk-vsw"), function (n) { n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(document.querySelectorAll("#displaybox .tt-dk-udrow"), function (r) {
      while (r.firstChild) r.parentNode.insertBefore(r.firstChild, r);
      r.parentNode.removeChild(r);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#displaybox .tt-dk-hidden, #displaybox .tt-dk-side, #displaybox .tt-dk-box"), function (n) { n.classList.remove("tt-dk-hidden", "tt-dk-side", "tt-dk-box"); });
  }
  function render() {
    if (!live()) { teardown(); return; }
    var root = document.documentElement, tiles = view() === "tiles", all = sections();
    root.classList.add("tt-dk-on");
    defs();
    all.forEach(function (S) { try { S.data = readSection(S); } catch (e) { S.data = { offline: true }; } });
    // A stopped array shows the assignment dropdowns, which only the list can hold.
    var open = all.filter(function (S) { return !S.data.offline; });
    var sw = document.querySelector("#displaybox nav.tabs > .tt-dk-vsw");
    if (!open.length) { if (sw) sw.parentNode.removeChild(sw); }
    else {
      Array.prototype.forEach.call(pageSwitch().querySelectorAll(".tt-seg-btn"), function (b) {
        var on = attr(b, "data-v") === (tiles ? "tiles" : "list");
        b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("tt-seg-on", on);
      });
    }
    all.forEach(function (S) {
      try {
        if (!tiles || S.data.offline) drop(S); else renderSection(S);
        if (S.key === "ud") udRow(S);
      } catch (e) {}
      // Each section the tiles draw is a card around its disks. In section view the pools and the
      // boot device stand side by side while the page has room for both.
      S.sec.classList.toggle("tt-dk-box", tiles && !S.data.offline);
      S.sec.classList.toggle("tt-dk-side", tiles && !S.data.offline && (S.key === "pools" || S.key === "boot"));
    });
    root.classList.toggle("tt-dk-sides", all.some(function (S) { return S.sec.classList.contains("tt-dk-side"); }));
    arrayOps(tiles && root.classList.contains("tt-sections-main"));
    spinNames(true);
    // The column and reads/writes controls act on the disk tables, so they go while none shows.
    root.classList.toggle("tt-dk-tiled", tiles && !all.some(function (S) {
      return S.key !== "ud" && !S.box.classList.contains("tt-dk-hidden");
    }));
    level();
  }
  // While the boot device stands beside the pools, its cards drop by the height of a pool's badge
  // row, so the card tops in that row line up. Wrapped below, it needs no gap.
  function level() {
    var boot = document.querySelector('#displaybox .tt-dk-host[data-tt-dk="boot"]');
    if (!boot) return;
    var pool = document.querySelector("#displaybox .tt-dk-pool"), lift = 0;
    if (pool && Math.abs(pool.closest("section").getBoundingClientRect().top - boot.closest("section").getBoundingClientRect().top) < 1) {
      lift = Math.round(pool.querySelector(".tt-dk-grid").getBoundingClientRect().top - pool.getBoundingClientRect().top);
    }
    boot.style.paddingTop = lift > 0 ? lift + "px" : "";
  }
  var frame = 0;
  function soon() { if (!frame) frame = (window.requestAnimationFrame || setTimeout)(function () { frame = 0; render(); }); }

  function loadExtra() {
    if (!live() || !window.fetch) return;
    fetch("/plugins/towertorch/server/disks.php", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && typeof j === "object") { extra = j; soon(); } })
      .catch(function () {});
  }
  // Unraid and Unassigned Devices refill their tables in place; the tiles redraw in the next frame.
  function watch() {
    var host = document.getElementById("displaybox"); if (!host) return;
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var tg = recs[i].target;
        if (!tg || !tg.closest || tg.closest(".tt-dk-host, .tt-dk-vsw")) continue;
        if (hasCls(tg, "tt-dk-box") && tg.querySelector(":scope > .tt-aop-pills")) { soon(); return; }
        if (tg.closest("table.disk_status, #usb_devices_list") || recs[i].addedNodes.length && tg.querySelector && tg.querySelector("table.disk_status")) { soon(); return; }
      }
    }).observe(host, { childList: true, subtree: true });
  }
  function boot() {
    window.ttDisksApply = render;
    if (pn() !== "/Main") return;
    render();
    loadExtra();
    setInterval(loadExtra, 10 * 60 * 1000);
    watch();
    watchMover();
    window.addEventListener("resize", level);
    window.addEventListener("storage", function (e) { if (e && e.key && /^tt[a-z]*\./.test(e.key) && e.key !== "tt.stateCache") soon(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
