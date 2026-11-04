/* TowerTorch: single pages the area enhancers do not reach.
 *
 * Loaded on every page through TowerTorch.Pages.page. It names the current page in
 * html[data-tt-page] while master theming and the area the page belongs to are on, which is all
 * TowerTorch.Pages.css keys on, and does the few things CSS cannot: it translates two native
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
  // class its sheet rules combine with (tt-tools-on on /Settings and /Tools, tt-popups-on on /Apps).
  var PAGES = [
    [/^\/Users\/(UserEdit|UserAdd)$/, "useredit", "tt.enable.settings", "1"],
    [/^\/VMs\/(UpdateVM|AddVM)$/, "vmform", "tt.enable.vms", "1"],
    [/^\/VMs\/VMTemplates$/, "vmtemplates", "tt.enable.vms", "1"],
    [/^\/Stats$/, "stats", "tt.enable.shares", "0"],
    [/^\/Main$/, "main", "tt.enable.main", "0"],
    [/^\/Main\/Device$/, "device", null],
    [/^\/Settings\/Userscripts$/i, "userscripts", null],
    [/^\/Settings\/nvidia-driver$/i, "nvidia", null],
    [/^\/Settings\/AppdataCleanupPlus$/i, "acp", null],
    [/^\/Tools\/Syslog$/, "syslog", null],
    [/^\/Tools\/(Downgrade|Registration|Update)$/, "vue", null],
    [/^\/Apps(\/|$)/, "apps", null]
  ];
  function pageName() {
    if (g("tt.theming", "1") === "0") return "";
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
        if (!b.hasAttribute("data-tt-orig")) b.setAttribute("data-tt-orig", b.value);
        b.value = T(POOL_BTNS[id][0], POOL_BTNS[id][1]);
      } else if (b.hasAttribute("data-tt-orig")) { b.value = b.getAttribute("data-tt-orig"); b.removeAttribute("data-tt-orig"); }
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
    var text = em.textContent.trim(), own = dt.querySelector(".tt-pagehint"), help = dt.querySelector(".tt-toolsinfo:not(.tt-pagehint)");
    if (on) {
      em.classList.add("tt-hint-moved");
      if (help) {
        if (own) own.parentNode.removeChild(own);
        if (!help.hasAttribute("data-tt-tip-orig")) {
          var orig = help.getAttribute("data-tt-tip") || "";
          help.setAttribute("data-tt-tip-orig", orig);
          help.setAttribute("data-tt-tip", orig ? orig + " " + text : text);
        }
      } else if (!own) {
        own = document.createElement("span");
        own.className = "tt-toolsinfo tt-pagehint";
        own.setAttribute("tabindex", "0");
        own.setAttribute("data-tt-tip", text); own.setAttribute("aria-label", text);
        own.textContent = "ⓘ";
        dt.appendChild(own);
      }
    } else {
      em.classList.remove("tt-hint-moved");
      if (own) own.parentNode.removeChild(own);
      if (help && help.hasAttribute("data-tt-tip-orig")) { help.setAttribute("data-tt-tip", help.getAttribute("data-tt-tip-orig")); help.removeAttribute("data-tt-tip-orig"); }
    }
  }

  // Highcharts draws the disk usage title and subtitle in English and redraws them on a resize.
  function statsTitle(on) {
    var t = document.querySelector("#sys .highcharts-title"), s = document.querySelector("#sys .highcharts-subtitle");
    [[t, T("Belegung", "Disk usage")], [s, T("in Prozent", "in percent")]].forEach(function (x) {
      var el = x[0]; if (!el) return;
      var span = el.querySelector("tspan") || el;
      if (on) { if (!el.hasAttribute("data-tt-orig")) el.setAttribute("data-tt-orig", span.textContent); span.textContent = x[1]; }
      else if (el.hasAttribute("data-tt-orig")) { span.textContent = el.getAttribute("data-tt-orig"); el.removeAttribute("data-tt-orig"); }
    });
  }

  // The template picker prints each group as a heading followed by loose tiles. A group's heading
  // and tiles move into one wrapper, which Pages.css draws as a card with the heading as its badge.
  // Only the wrappers are added, so turning the area off puts every node back where it was.
  function templateGroups(on) {
    var heads = document.querySelectorAll("#displaybox .vmheader");
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i], box = h.parentElement;
      if (on && !box.classList.contains("tt-vmt-group")) {
        var g = document.createElement("div");
        g.className = "tt-vmt-group";
        if (!h.textContent.trim()) g.classList.add("tt-vmt-bare");
        box.insertBefore(g, h);
        for (var n = h; n && (n === h || (n.classList && n.classList.contains("vmtemplate")) || n.nodeType === 3);) {
          var next = n.nextSibling;
          g.appendChild(n);
          n = next;
        }
      } else if (!on && box.classList.contains("tt-vmt-group")) {
        while (box.firstChild) box.parentNode.insertBefore(box.firstChild, box);
        box.parentNode.removeChild(box);
      }
    }
  }

  var current = "";
  function apply() {
    var name = pageName(), root = document.documentElement;
    if (name) root.setAttribute("data-tt-page", name); else root.removeAttribute("data-tt-page");
    var was = current; current = name;
    if (name === "device" || was === "device") poolButtons(name === "device");
    // The bubble is the settings form's (i), so the hint moves only where the form rules apply.
    var hint = name === "useredit" && root.classList.contains("tt-tools-on");
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
    // tt.stateCache is skipped because docker.js rewrites it every 9s.
    window.addEventListener("storage", function (e) { try { if (e && e.key && e.key !== "tt.stateCache" && /^tt\./.test(e.key)) apply(); } catch (e2) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
