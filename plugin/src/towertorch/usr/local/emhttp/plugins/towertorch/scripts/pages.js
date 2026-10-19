/* CannonadeCommand: single pages the area enhancers do not reach.
 *
 * Loaded on every page through CannonadeCommand.Pages.page. It names the current page in
 * html[data-cc-page] while master theming and the area the page belongs to are on, which is all
 * CannonadeCommand.Pages.css keys on, and does the few things CSS cannot: it translates two native
 * button captions, moves a hint printed under a field into an (i) bubble, gives the disk usage
 * chart a translated title and groups the VM templates into cards. A caption only changes on a
 * button whose value no form sends.
 */
(function () {
  "use strict";
  function g(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  function T(d, e) { return LANG === "de" ? d : e; }
  function pn() { try { return location.pathname.replace(/\/+$/, ""); } catch (e) { return ""; } }

  // Route, page name and the area switch with its default. A page without a switch rides the area
  // class its sheet rules combine with (cc-tools-on on /Settings and /Tools, cc-popups-on on /Apps).
  var PAGES = [
    [/^\/Users\/(UserEdit|UserAdd)$/, "useredit", "cc.enable.settings", "1"],
    [/^\/VMs\/(UpdateVM|AddVM)$/, "vmform", "cc.enable.vms", "1"],
    [/^\/VMs\/VMTemplates$/, "vmtemplates", "cc.enable.vms", "1"],
    [/^\/Stats$/, "stats", "cc.enable.shares", "0"],
    [/^\/Main$/, "main", "cc.enable.main", "0"],
    [/^\/Main\/Device$/, "device", null],
    [/^\/Settings\/Userscripts$/i, "userscripts", null],
    [/^\/Settings\/nvidia-driver$/i, "nvidia", null],
    [/^\/Settings\/AppdataCleanupPlus$/i, "acp", null],
    [/^\/Tools\/Syslog$/, "syslog", null],
    [/^\/Tools\/(Downgrade|Registration|Update)$/, "vue", null],
    [/^\/Apps(\/|$)/, "apps", null]
  ];
  function pageName() {
    if (g("cc.theming", "1") === "0") return "";
    var p = pn();
    for (var i = 0; i < PAGES.length; i++) {
      var r = PAGES[i];
      if (!r[0].test(p)) continue;
      if (r[2] && g(r[2], r[3]) === "0") return "";
      return r[1];
    }
    return "";
  }

  // The pool page's two buttons are type=button without a name, so their caption is only a label;
  // they take the case of the buttons beside them from the shared button rules.
  var POOL_BTNS = { eraseButton: ["Pool löschen", "Erase pool"], removeButton: ["Pool entfernen", "Remove pool"] };
  function poolButtons(on) {
    for (var id in POOL_BTNS) {
      var b = document.getElementById(id);
      if (!b || b.type !== "button" || b.name) continue;
      if (on) {
        if (!b.hasAttribute("data-cc-orig")) b.setAttribute("data-cc-orig", b.value);
        b.value = T(POOL_BTNS[id][0], POOL_BTNS[id][1]);
      } else if (b.hasAttribute("data-cc-orig")) { b.value = b.getAttribute("data-cc-orig"); b.removeAttribute("data-cc-orig"); }
    }
  }

  // The picture hint on the user page is a sentence in italics under the field (GlimStone rule 8).
  // It joins the field's own help in its (i) bubble, or gets a bubble of its own while the help
  // has not been turned into one yet.
  function userHint(on) {
    var em = document.querySelector("#displaybox dd:has(#dropbox) > em");
    if (!em) return;
    var dt = em.closest("dd").previousElementSibling;
    while (dt && dt.tagName !== "DT") dt = dt.previousElementSibling;
    if (!dt) return;
    var text = em.textContent.trim(), own = dt.querySelector(".cc-pagehint"), help = dt.querySelector(".cc-toolsinfo:not(.cc-pagehint)");
    if (on) {
      em.classList.add("cc-hint-moved");
      if (help) {
        if (own) own.parentNode.removeChild(own);
        if (!help.hasAttribute("data-cc-tip-orig")) {
          var orig = help.getAttribute("data-cc-tip") || "";
          help.setAttribute("data-cc-tip-orig", orig);
          help.setAttribute("data-cc-tip", orig ? orig + " " + text : text);
        }
      } else if (!own) {
        own = document.createElement("span");
        own.className = "cc-toolsinfo cc-pagehint";
        own.setAttribute("tabindex", "0");
        own.setAttribute("data-cc-tip", text); own.setAttribute("aria-label", text);
        own.textContent = "ⓘ";
        dt.appendChild(own);
      }
    } else {
      em.classList.remove("cc-hint-moved");
      if (own) own.parentNode.removeChild(own);
      if (help && help.hasAttribute("data-cc-tip-orig")) { help.setAttribute("data-cc-tip", help.getAttribute("data-cc-tip-orig")); help.removeAttribute("data-cc-tip-orig"); }
    }
  }

  // Highcharts draws the disk usage title and subtitle in English and redraws them on a resize.
  function statsTitle(on) {
    var t = document.querySelector("#sys .highcharts-title"), s = document.querySelector("#sys .highcharts-subtitle");
    [[t, T("Belegung", "Disk usage")], [s, T("in Prozent", "in percent")]].forEach(function (x) {
      var el = x[0]; if (!el) return;
      var span = el.querySelector("tspan") || el;
      if (on) { if (!el.hasAttribute("data-cc-orig")) el.setAttribute("data-cc-orig", span.textContent); span.textContent = x[1]; }
      else if (el.hasAttribute("data-cc-orig")) { span.textContent = el.getAttribute("data-cc-orig"); el.removeAttribute("data-cc-orig"); }
    });
  }

  // The template picker prints each group as a heading followed by loose tiles. A group's heading
  // and tiles move into one wrapper, which Pages.css draws as a card with the heading as its badge.
  // Only the wrappers are added, so turning the area off puts every node back where it was.
  function templateGroups(on) {
    var heads = document.querySelectorAll("#displaybox .vmheader");
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i], box = h.parentElement;
      if (on && !box.classList.contains("cc-vmt-group")) {
        var g = document.createElement("div");
        g.className = "cc-vmt-group";
        if (!h.textContent.trim()) g.classList.add("cc-vmt-bare");
        box.insertBefore(g, h);
        for (var n = h; n && (n === h || (n.classList && n.classList.contains("vmtemplate")) || n.nodeType === 3);) {
          var next = n.nextSibling;
          g.appendChild(n);
          n = next;
        }
      } else if (!on && box.classList.contains("cc-vmt-group")) {
        while (box.firstChild) box.parentNode.insertBefore(box.firstChild, box);
        box.parentNode.removeChild(box);
      }
    }
  }

  var current = "";
  function apply() {
    var name = pageName(), root = document.documentElement;
    if (name) root.setAttribute("data-cc-page", name); else root.removeAttribute("data-cc-page");
    var was = current; current = name;
    if (name === "device" || was === "device") poolButtons(name === "device");
    // The bubble is the settings form's (i), so the hint moves only where the form rules apply.
    var hint = name === "useredit" && root.classList.contains("cc-tools-on");
    if (hint || was === "useredit") userHint(hint);
    if (name === "stats" || was === "stats") statsTitle(name === "stats");
    if (name === "vmtemplates" || was === "vmtemplates") templateGroups(name === "vmtemplates");
  }

  function boot() {
    var p = pn();
    if (!PAGES.some(function (r) { return r[0].test(p); })) return;
    apply();
    // The pool page and the statistics render after load, so the pass runs again once they have.
    setTimeout(apply, 1500);
    setTimeout(apply, 4000);
    window.addEventListener("resize", function () { if (current === "stats") setTimeout(function () { statsTitle(true); }, 300); });
    // cc.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "cc.stateCache" && /^cc\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
