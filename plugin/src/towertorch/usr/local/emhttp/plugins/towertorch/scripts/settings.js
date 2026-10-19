/* The CannonadeCommand settings page. Client-side only: it renders a card-based form into
 * #cc-settings and persists to localStorage under the cc.* keys, which the Docker-tab enhancer reads
 * and reacts to live through the storage event. */
(function () {
  "use strict";
  var root = document.getElementById("cc-settings");
  if (!root) return;
  // Page-local style additions, since docker.css is owned elsewhere. They live in <head> and so
  // survive render().
  (function () {
    if (document.getElementById("cc-set-xtra")) return;
    var st = document.createElement("style"); st.id = "cc-set-xtra";
    st.textContent =
      "#cc-settings .cc-set-xbtn{display:inline-flex;align-items:center;justify-content:center;height:var(--cc-md-h,30px);padding:var(--cc-md-btnpad,0 14px);font-size:var(--cc-md-fs);font-weight:600;border-radius:var(--cc-radius-pill);box-sizing:border-box;margin:12px 10px 0 0}" +
      // the flag picker's stripe swatches and its searchable dropdown
      "#cc-settings .cc-flag-sw{display:inline-block;width:22px;height:15px;border-radius:calc(var(--cc-radius-control) / 4);flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}" +
      "#cc-settings .cc-flag-sw-lg{width:34px;height:22px}" +
      // the real flag image, at the same footprint as the stripe swatch
      "#cc-settings .cc-flag-img{display:inline-block;width:22px;height:15px;flex:0 0 auto;object-fit:cover;border-radius:calc(var(--cc-radius-control) / 4);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}" +
      "#cc-settings .cc-flag-img-lg{width:34px;height:22px}" +
      "#cc-settings .cc-set-swatches.cc-fill{display:flex;gap:6px;align-items:center;justify-content:flex-end}" +
      // Every swatch is the same 30px square in every card, and the reset after a palette is one
      // more square of that size. The hex field takes what the row has left, since the code needs
      // the room.
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-sw{flex:none;width:30px;height:30px;box-sizing:border-box;border-radius:var(--cc-radius-pill)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn{flex:none;width:30px;height:30px;box-sizing:border-box;margin:0;display:inline-flex;align-items:center;justify-content:center;background:#2e2e2e;border-radius:var(--cc-radius-pill);cursor:pointer;color:#cfcfcf;font-size:var(--cc-text-body);transition:filter .12s,background .12s,color .12s}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-ibtn:hover{background:var(--cc-accent,#FCC419);color:var(--cc-accent-text, #161616)}" +
      "#cc-settings .cc-set-swatches.cc-fill .cc-set-hexin{flex:1 1 0;height:30px;min-width:0;box-sizing:border-box;padding:0 8px;align-self:center;font-size:var(--cc-text-meta);letter-spacing:0;margin:0}" +
      // the settings search and the reset-everything button
      "#cc-settings .cc-set-searchrow{margin:12px 0 2px}" +
      "#cc-settings .cc-set-search{box-sizing:border-box;width:100%;max-width:420px;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:var(--cc-radius-control);padding:9px 13px;font-size:var(--cc-text-subline);transition:background-color .12s}" +
      // Unraid's default-base.css paints every placeholder in the theme's link colour, so a hint
      // reads as a link or as an already filled value. One rule per sheet covers every field; the
      // Docker half of the same guard lives in docker.css.
      "#cc-settings input::placeholder{color:#8d8d8d;opacity:1}" +
      "#cc-settings .cc-set-search:focus{background:#2e2e2e}" +
      // The search is a secondary badge that expands into an input on click, grey like every
      // button in a card, so it takes the colour mode only under the pointer.
      "#cc-settings .cc-set-searchbadge{margin-left:auto;display:inline-flex;align-items:center;background:#2e2e2e;border-radius:var(--cc-radius-pill);height:34px;overflow:hidden;transition:background-color .12s}" +
      "#cc-settings .cc-set-searchbadge .cc-set-searchicon{flex:0 0 auto;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;color:#e6e6e6;cursor:pointer;transition:color .12s}" +
      "#cc-settings .cc-set-searchbadge:not(.cc-open):hover{background:var(--cc-rbaccent,var(--cc-accent,#FCC419))}" +
      "#cc-settings .cc-set-searchbadge:not(.cc-open):hover .cc-set-searchicon{color:var(--cc-rbaccent-text,var(--cc-accent-text,#161616))}" +
      "#cc-settings .cc-set-searchbadge .cc-set-search{box-sizing:border-box;width:0;max-width:0;padding:0;background:transparent;transition:width .2s,max-width .2s,padding .2s}" +
      "#cc-settings .cc-set-searchbadge.cc-open .cc-set-search{width:220px;max-width:220px;padding:0 12px 0 2px}" +
      // What a search shows when no setting matches, in the place the cards would take and dark
      // like them on every theme: Tokens.css counts it among the dark token islands.
      "#cc-settings .cc-set-empty{display:flex;align-items:center;gap:14px;max-width:420px;box-sizing:border-box;padding:18px;background:var(--cc-surface-2);border-radius:var(--cc-radius-card);box-shadow:var(--cc-elev-1)}" +
      "#cc-settings .cc-set-empty svg{flex:none;width:28px;height:28px;opacity:.4}" +
      "#cc-settings .cc-set-empty-t{font-weight:600;color:var(--cc-text)}" +
      "#cc-settings .cc-set-empty-h{margin-top:2px;font-size:var(--cc-text-meta);color:var(--cc-text-dim)}" +
      // The country picker stands at the end of its row, wide enough for "Bosnien und Herzegowina".
      "#cc-settings .cc-flag-row .cc-flag-picker{position:relative;margin-left:auto;flex:0 1 300px;min-width:0}" +
      "#cc-settings .cc-flag-trigger{display:flex;align-items:center;gap:9px;background:var(--cc-surface-chip,#383838);border-radius:var(--cc-radius-control);padding:7px 12px;cursor:pointer;user-select:none}" +
      "#cc-settings .cc-flag-trigger:hover{background:color-mix(in srgb,var(--cc-surface-chip,#383838) 85%,var(--cc-text,#e6e6e6))}" +
      "#cc-settings .cc-flag-name{font-size:var(--cc-text-subline);color:#eaeaea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      // The trigger reads as a button, with no caret, and openPanel pins the panel fixed.
      "#cc-settings .cc-flag-panel{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:9999;background:#1c1c1c;border-radius:var(--cc-radius-card);box-shadow:0 12px 34px rgba(0,0,0,.6);overflow:hidden}" +
      "#cc-settings .cc-flag-search{box-sizing:border-box;background:#232323;color:#eaeaea;border:none;outline:none;border-radius:var(--cc-radius-control);padding:8px 10px;margin:8px;width:calc(100% - 16px);font-size:var(--cc-text-subline)}" +
      "#cc-settings .cc-flag-list{max-height:260px;overflow-y:auto;padding:0 6px 6px}" +
      "#cc-settings .cc-flag-item{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:var(--cc-radius-control);cursor:pointer}" +
      "#cc-settings .cc-flag-item:hover,#cc-settings .cc-flag-item.cc-sel{background:rgba(255,255,255,.09)}" +   // the keyboard highlight too
      // The logo preview tile. Its coloured badge is this box, a real element with a radius and
      // overflow hidden, never an feFlood inside the filter: an feFlood fills the whole filter
      // region and ignores the radius, rendering a hard square where the live tab shows a rounded
      // tile. The real tabs split it the same way: the tile carries the badge, the child the pixels.
      "#cc-settings .cc-set-tile{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;flex:0 0 auto;transition:background-color .12s}" +
      "#cc-settings .cc-set-tile>img{width:100%;height:100%;object-fit:contain;display:block;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile>i{display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box}" +
      "#cc-settings .cc-set-tile-bg>img,#cc-settings .cc-set-tile-bg>i{padding:14%}" +
      // A per-area sub-heading inside one card is a muted caption, never a card inside a card.
      "#cc-settings .cc-set-sublbl{margin:12px 0 0;font-size:var(--cc-text-meta);font-weight:700;letter-spacing:.6px;text-transform:uppercase;opacity:.55}" +
      "#cc-settings .cc-set-prev-empty{margin:6px 0 0;font-size:var(--cc-text-meta);opacity:.5}" +
      // The release notes window is wide and sets its body as reading text. It hangs on <body>,
      // outside #cc-settings, so its rules carry the html prefix against Unraid's link colours.
      ".cc-dlg.cc-win-notes{width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 48px)}" +
      "html .cc-win-notes .cc-notes{color:var(--cc-text);font-size:var(--cc-text-subline);line-height:1.55;overflow-wrap:anywhere}" +
      "html .cc-win-notes .cc-notes-h{margin:18px 0 6px;font-size:var(--cc-text-title);font-weight:700}" +
      "html .cc-win-notes .cc-notes>:first-child{margin-top:0}" +
      "html .cc-win-notes .cc-notes p{margin:0 0 10px}" +
      "html .cc-win-notes .cc-notes :is(ul,ol){margin:0 0 10px;padding-inline-start:20px}" +
      "html .cc-win-notes .cc-notes li{margin:5px 0}" +
      "html .cc-win-notes .cc-notes code{font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:var(--cc-text-meta);background:var(--cc-surface-3);border-radius:calc(var(--cc-radius-control) / 2);padding:1px 5px}" +
      "html .cc-win-notes .cc-notes pre{margin:0 0 10px;padding:10px 12px;background:var(--cc-surface-deep);border-radius:var(--cc-radius-control);overflow-x:auto}" +
      "html .cc-win-notes .cc-notes pre code{background:none;padding:0;white-space:pre}" +
      "html .cc-win-notes .cc-notes a,html .cc-win-notes .cc-notes a:visited{color:var(--cc-accent-ink);text-decoration:none;border-radius:calc(var(--cc-radius-control) / 2)}" +
      "html .cc-win-notes .cc-notes a:hover{background:var(--cc-rbaccent,var(--cc-accent));color:var(--cc-rbaccent-text,var(--cc-accent-text))}" +
      "html .cc-win-notes :is(.cc-notes, .cc-notes a):focus-visible{outline:none!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--cc-accent,#FCC419) 45%,transparent)!important}" +
      "html .cc-win a.cc-win-btn,html .cc-win a.cc-win-btn:visited{color:var(--cc-text);text-decoration:none}" +
      "html .cc-win a.cc-win-btn:hover{color:var(--cc-rb-ct,var(--cc-rbaccent-text,var(--cc-accent-text,#161616)))}" +
      // A row or card that has nothing to act on stays out of the page and out of the search.
      "#cc-settings [hidden],#cc-settings .cc-set-off{display:none!important}" +
      "#cc-settings .cc-set-prose{text-align:start}" +
      // One font with the rest of Unraid: the page takes the theme's face, as every other page does.
      "#cc-settings{font-family:inherit}" +
      "#cc-settings .cc-set-cname .cc-info{margin-left:6px;vertical-align:-2px}" +
      // A selector sits at the end of its row in a groove, its segments one width, and only the chosen one is a badge.
      "#cc-settings .cc-seg.cc-set-mode{display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;flex:none;box-sizing:border-box;background:var(--cc-surface-base,#161616)}" +
      "#cc-settings .cc-set-mode .cc-seg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;padding:7px 12px;font-size:var(--cc-text-subline)}" +
      "#cc-settings .cc-seg-ico{flex:none;width:14px;height:14px}" +
      // a value of its own beside a selector, a short field with its unit after it
      "#cc-settings .cc-set-numwrap{display:inline-flex;align-items:center;gap:6px;color:var(--cc-text-dim,#8a8a8a);font-size:var(--cc-text-subline)}" +
      "#cc-settings .cc-set-numwrap .cc-set-num{flex:none;width:56px;min-width:0;margin:0;text-align:center}" +
      // a view sketch right under the selector it belongs to, in a well of its own
      "#cc-settings .cc-set-viewprev{display:flex;flex-direction:column;align-items:flex-end;gap:8px;margin-top:12px}" +
      "#cc-settings .cc-set-viewprev > .cc-set-lbl{margin:0}" +
      "#cc-settings .cc-set-vp{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 12px 8px;border-radius:var(--cc-radius-control);background:var(--cc-surface-base,#161616);color:var(--cc-text-dim,#8a8a8a);transition:color .12s,background-color .12s}" +
      "#cc-settings .cc-set-vp svg{display:block;width:108px;height:65px}" +
      "#cc-settings .cc-set-vp-lbl{font-size:var(--cc-text-meta);line-height:1.2}" +
      "#cc-settings .cc-set-vp-on{background:var(--cc-surface-3,#2e2e2e);color:var(--cc-rb-c,var(--cc-accent,#FCC419))}" +
      "#cc-settings .cc-set-vp-on .cc-set-vp-lbl{color:var(--cc-text,#e6e6e6)}" +
      // A row whose switch above it is off rests dimmed and out of the tab order;
      // a press on it is refused (refuse() below), and its (i) still explains it. A disabled
      // field takes no click at all, so its wrapper receives the press.
      "#cc-settings .cc-set-lbl.cc-set-disabled,#cc-settings .cc-set-disabled > span:first-child:not(.cc-set-lblwrap),#cc-settings .cc-set-disabled :is(.cc-set-lblwrap > span:first-child, .cc-seg, .cc-set-toggle, .cc-set-numwrap){opacity:.45}" +
      "#cc-settings .cc-set-disabled :is(.cc-seg, .cc-seg-btn, .cc-set-toggle, .cc-set-numwrap){cursor:not-allowed}" +
      "#cc-settings .cc-set-disabled input{pointer-events:none}" +
      "#cc-settings .cc-set-mode .cc-seg-btn:not(.cc-seg-on){background:transparent;color:var(--cc-text-chip,#cfcfcf)}" +
      "#cc-settings .cc-set-mode .cc-seg-btn:not(.cc-seg-on):not([aria-disabled=true]):hover{background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6)}" +
      "#cc-settings .cc-set-disabled .cc-set-mode .cc-seg-btn:not(.cc-seg-on):hover{background:transparent;color:var(--cc-text-chip,#cfcfcf)}" +
      "#cc-settings .cc-set-mode .cc-seg-btn[aria-disabled=true]{opacity:.45;cursor:not-allowed}" +
      "#cc-settings .cc-set-locked .cc-set-lockby{cursor:not-allowed}" +
      // An area's colour line and a row that names who decides its value.
      "#cc-settings .cc-set-colend{display:inline-flex;align-items:center;gap:12px;flex:none}" +
      "#cc-settings .cc-set-colend .cc-set-xbtn{margin:0}" +
      "#cc-settings :is(.cc-set-colstate,.cc-set-lockby){display:inline-flex;align-items:center;gap:7px;color:var(--cc-text-dim,#8a8a8a);font-size:var(--cc-text-subline)}" +
      "#cc-settings .cc-set-colstate .cc-set-excdot{width:10px;height:10px}" +
      // The README buttons on the Info tab (GlimStone, "The App tab"). The cards stay dark on every
      // theme, so the marks rest in their dark-theme colours.
      "#cc-settings .cc-rbtn-rows{display:flex;flex-wrap:wrap;gap:13px;margin-top:12px}" +
      "#cc-settings .cc-rbtn-rows.cc-set-give{margin-top:calc(var(--cc-text-body) * 1.5)}" +
      "#cc-settings .cc-rbtn-unit{position:relative;display:inline-flex;border-radius:var(--cc-radius-pill);overflow:hidden;isolation:isolate;--cc-brand-coffee:#ffdd00;--cc-brand-paypal:#4fb5f0;--cc-brand-bitcoin:#f7931a;--cc-brand-github:#ffffff}" +
      "#cc-settings .cc-rbtn{position:relative;display:block;flex:none;box-sizing:border-box;width:160px;height:46.6px;padding:0;background:var(--cc-surface-3,#2e2e2e);color:var(--cc-text,#e6e6e6);text-decoration:none;cursor:pointer}" +
      "#cc-settings .cc-rbtn:hover{text-decoration:none}" +
      // The unit clips at its edge, so the focus halo goes inside the button.
      "#cc-settings .cc-rbtn:focus-visible{outline:none!important;filter:none!important;box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--cc-accent,#FCC419) 45%,transparent)!important}" +
      "#cc-settings .cc-rbtn-mark{position:absolute;top:50%;left:14px;width:32px;height:25px;translate:0 -50%;display:flex}" +
      "#cc-settings :is(.cc-rbtn-mark,.cc-rbtn-art) svg{display:block;width:100%;height:100%}" +
      "#cc-settings .cc-rbtn-mark svg.cc-mark-hover{display:none}" +
      "#cc-settings .cc-rbtn-art{position:absolute;inset:0}" +
      "#cc-settings .cc-rbtn-text{position:absolute;top:0;bottom:0;left:53px;right:10px;display:flex;flex-direction:column;justify-content:center;line-height:1.15}" +
      "#cc-settings :is(.cc-rbtn-name,.cc-rbtn-sub){max-width:100%;overflow:hidden;white-space:nowrap}" +
      "#cc-settings .cc-rbtn-name{font-size:var(--cc-text-body);font-weight:700;transition:translate var(--cc-motion-control-dur,0s)}" +
      "#cc-settings .cc-rbtn-name:not(:only-child){translate:0 7px}" +
      "#cc-settings .cc-rbtn-sub{font-size:var(--cc-text-meta);opacity:0;translate:0 4px;transition:opacity var(--cc-motion-control-dur,0s),translate var(--cc-motion-control-dur,0s)}" +
      "#cc-settings .cc-rbtn-unit:is(:hover,:focus-within) .cc-rbtn-name{translate:0 0}" +
      "#cc-settings .cc-rbtn-unit:is(:hover,:focus-within) .cc-rbtn-sub{opacity:.9;translate:0 0}" +
      "#cc-settings .cc-paypal-mark{color:var(--cc-brand-paypal)}" +
      "#cc-settings .cc-bitcoin-mark{color:var(--cc-brand-bitcoin)}" +
      "#cc-settings .cc-github-mark{color:var(--cc-brand-github)}" +
      "#cc-settings .cc-house-mark{color:var(--cc-rb-c,var(--cc-rbaccent,var(--cc-accent,#FCC419)))}" +
      "#cc-settings .cc-tile-github{--cc-tile:#181717;--cc-tile-ink:#fff}" +
      "#cc-settings .cc-tile-paypal{--cc-tile:#003087;--cc-tile-ink:#fff}" +
      "#cc-settings .cc-tile-bitcoin{--cc-tile:#f7931a;--cc-tile-ink:#161616}" +
      "#cc-settings .cc-tile-coffee{--cc-tile:#ffdd00;--cc-tile-ink:#0d0c22}" +
      // The button that reaches CannonadeCommand's author follows the colour engine.
      "#cc-settings .cc-tile-house{--cc-tile:var(--cc-rb-c,var(--cc-rbaccent,var(--cc-accent,#FCC419)));--cc-tile-ink:var(--cc-rb-ct,var(--cc-rbaccent-text,var(--cc-accent-text,#161616)))}" +
      "#cc-settings .cc-rbtn-unit .cc-rbtn:focus-visible .cc-house-mark .cc-mark-rest{display:none}" +
      "#cc-settings .cc-rbtn-unit .cc-rbtn:focus-visible .cc-house-mark .cc-mark-hover{display:block}" +
      "@media (hover:hover){" +
        "#cc-settings .cc-rbtn-unit:hover .cc-rbtn{background:var(--cc-tile);color:var(--cc-tile-ink);--cc-mark-ink:var(--cc-tile-ink)}" +
        "#cc-settings .cc-rbtn-unit:hover .cc-rbtn-mark{color:var(--cc-tile-ink)}" +
        "#cc-settings .cc-rbtn-unit:hover .cc-mark-rest{display:none}" +
        "#cc-settings .cc-rbtn-unit:hover .cc-rbtn-mark svg.cc-mark-hover{display:block}" +
      "}" +
      "#cc-settings .cc-rbtn-sheen{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none}" +
      "#cc-settings .cc-rbtn-sheen::after{content:'';position:absolute;top:-12px;bottom:-12px;left:-64px;width:33px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28) 45%,rgba(255,255,255,.28) 55%,transparent);transform:skewX(-16deg)}" +
      "@keyframes cc-rbtn-sheen{to{left:calc(100% + 32px)}}" +
      "@media (hover:hover) and (prefers-reduced-motion:no-preference){html:not([data-cc-motion=\"off\"]) #cc-settings .cc-rbtn-unit:hover .cc-rbtn-sheen::after{animation:cc-rbtn-sheen .7s linear}}" +
      // Where a row is too narrow for its name and its control, the control moves under the name
      // and keeps the row's end (GlimStone, "Narrow windows"). A selector or a group of buttons
      // still wider than the card breaks into even rows rather than pushing the page sideways.
      "@media (max-width:1023px){" +
        "#cc-settings .cc-set-row.cc-set-inline{flex-wrap:wrap;row-gap:8px}" +
        "#cc-settings .cc-set-row.cc-set-inline > :last-child{margin-left:auto;max-width:100%}" +
        "#cc-settings .cc-set-colend{flex-wrap:wrap;justify-content:flex-end;row-gap:8px;min-width:0}" +
        "#cc-settings .cc-seg.cc-set-mode{display:flex;flex-wrap:wrap;justify-content:flex-end;max-width:100%;border-radius:var(--cc-radius-control)}" +
        "#cc-settings .cc-set-mode .cc-seg-btn{flex:1 0 auto}" +
        "#cc-settings .cc-set-fieldrow{flex-wrap:wrap;row-gap:8px}" +
        "#cc-settings .cc-set-fieldrow > .cc-set-pickrow{flex:1 1 100%}" +
        "#cc-settings .cc-set-swatches.cc-fill{flex-wrap:wrap}" +
        "#cc-settings .cc-set-swatches.cc-fill .cc-set-hexin{min-width:90px}" +
      "}";
    document.head.appendChild(st);
  })();
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase();
  var de = LANG === "de";
  function T(d, e) { return de ? d : e; }
  var CC_VER = "@@CCVER@@"; if (CC_VER.indexOf("@@") === 0) CC_VER = "dev";
  // the GlimStone version this UI is built against, bumped by hand whenever its files are recopied
  var GLS_VER = "3.5.0";
  var REPO = "https://github.com/junkerderprovinz/cannonadecommand";
  var GLS_REPO = "https://github.com/junkerderprovinz/glimstone";
  var LATEST_API = "https://api.github.com/repos/junkerderprovinz/cannonadecommand/releases/latest";
  var RELEASES_API = "https://api.github.com/repos/junkerderprovinz/cannonadecommand/releases";

  var COLS = [
    { key: "update", label: T("Update-Status", "Update status"), help: T("Ob für das Image ein Update bereitsteht.", "Whether an update is waiting for the image.") },
    { key: "force", label: T("Update erzwingen", "Force update"), help: T("Ein Knopf, der das Image neu lädt, auch ohne gemeldetes Update.", "A button that pulls the image again, even when no update is reported.") },
    { key: "version", label: T("Image-Tag (latest)", "Image tag (latest)"), help: T("Der Tag des Images, etwa latest oder 1.4.", "The image tag, such as latest or 1.4.") },
    { key: "net", label: T("Netzwerk", "Network"), help: T("Das Netzwerk, in dem der Container läuft.", "The network the container runs in.") },
    { key: "ip", label: T("Container-IP", "Container IP"), help: T("Die IP-Adresse des Containers in seinem Netzwerk.", "The container's IP address in its network.") },
    { key: "lan", label: T("LAN-IP", "LAN IP"), help: T("Die Adresse, unter der der Container im LAN erreichbar ist.", "The address the container can be reached at on the LAN.") },
    { key: "port", label: T("Ports", "Ports"), help: T("Die Ports, die der Container nach außen öffnet.", "The ports the container publishes.") },
    { key: "res", label: T("CPU / RAM", "CPU / RAM"), help: T("Wie viel Prozessor und Arbeitsspeicher der Container gerade braucht.", "How much processor and memory the container uses right now.") },
    { key: "id", label: T("Container-ID", "Container ID"), help: T("Die kurze ID des Containers.", "The container's short ID.") },
    { key: "von", label: T("Von / Quelle", "From / source"), help: T("Woher das Image stammt, mit einem Link zu seiner Seite.", "Where the image comes from, with a link to its page.") },
    { key: "vol", label: T("Volumes", "Volumes"), help: T("Die Ordner, die in den Container eingebunden sind.", "The folders mapped into the container.") },
    { key: "plan", label: T("Startplan", "Start plan"), help: T("Wo der Container im Startplan steht.", "Where the container stands in the start plan.") },
    { key: "restart", label: T("Restart-Policy", "Restart policy"), help: T("Wann Docker den Container von selbst neu startet.", "When Docker restarts the container on its own.") },
  ];
  // One glyph per settings tab, filled on currentColor, each with the viewBox glyphs.json crops to
  // its ink so every tab's glyph reads the same size.
  var TAB_GLYPHS = {
    general: ["0.1 0.106 13.797 13.797", '<path fill-rule="evenodd" d="M0.597 1.73 L0.47 1.783 L0.305 1.905 L0.218 2.011 L0.153 2.132 L0.103 2.331 L0.103 2.469 L0.13 2.603 L0.218 2.789 L0.305 2.895 L0.411 2.982 L0.532 3.047 L0.663 3.087 L0.8 3.1 L1.491 3.1 L1.418 2.713 L1.401 2.361 L1.418 2.087 L1.491 1.7 L0.8 1.7ZM13.468 3.047 L13.589 2.982 L13.695 2.895 L13.817 2.73 L13.887 2.537 L13.897 2.331 L13.847 2.132 L13.782 2.011 L13.695 1.905 L13.53 1.783 L13.337 1.713 L13.2 1.7 L6.909 1.7 L6.982 2.087 L6.999 2.361 L6.982 2.713 L6.909 3.1 L13.2 3.1 L13.337 3.087ZM6.114 1.819 L5.964 1.457 L5.746 1.131 L5.469 0.854 L5.143 0.636 L4.781 0.486 L4.396 0.41 L4.004 0.41 L3.619 0.486 L3.257 0.636 L2.931 0.854 L2.654 1.131 L2.436 1.457 L2.286 1.819 L2.21 2.204 L2.21 2.596 L2.286 2.981 L2.436 3.343 L2.654 3.669 L2.931 3.946 L3.257 4.164 L3.619 4.314 L4.004 4.39 L4.396 4.39 L4.781 4.314 L5.143 4.164 L5.469 3.946 L5.746 3.669 L5.964 3.343 L6.114 2.981 L6.19 2.596 L6.19 2.204ZM0.597 6.33 L0.411 6.418 L0.259 6.556 L0.153 6.732 L0.113 6.863 L0.1 7 L0.113 7.137 L0.153 7.268 L0.259 7.444 L0.356 7.541 L0.47 7.617 L0.663 7.687 L0.8 7.7 L7.091 7.7 L7.018 7.313 L7.001 6.961 L7.018 6.687 L7.091 6.3 L0.8 6.3ZM11.714 6.419 L11.564 6.057 L11.346 5.731 L11.069 5.454 L10.743 5.236 L10.381 5.086 L9.996 5.01 L9.604 5.01 L9.219 5.086 L8.857 5.236 L8.531 5.454 L8.254 5.731 L8.036 6.057 L7.886 6.419 L7.81 6.804 L7.81 7.196 L7.886 7.581 L8.036 7.943 L8.254 8.269 L8.531 8.546 L8.857 8.764 L9.219 8.914 L9.604 8.99 L9.996 8.99 L10.381 8.914 L10.743 8.764 L11.069 8.546 L11.346 8.269 L11.564 7.943 L11.714 7.581 L11.79 7.196 L11.79 6.804ZM13.468 7.647 L13.589 7.582 L13.695 7.495 L13.817 7.33 L13.87 7.203 L13.897 7.069 L13.887 6.863 L13.847 6.732 L13.782 6.611 L13.695 6.505 L13.589 6.418 L13.468 6.353 L13.337 6.313 L13.2 6.3 L12.509 6.3 L12.582 6.687 L12.599 6.961 L12.582 7.313 L12.509 7.7 L13.269 7.697ZM0.597 10.93 L0.411 11.018 L0.259 11.156 L0.153 11.332 L0.103 11.531 L0.113 11.737 L0.183 11.93 L0.305 12.095 L0.47 12.217 L0.663 12.287 L0.8 12.3 L3.091 12.3 L3.018 11.913 L3.001 11.639 L3.018 11.287 L3.091 10.9 L0.8 10.9ZM7.648 10.835 L7.463 10.489 L7.214 10.186 L6.911 9.937 L6.565 9.752 L6.19 9.638 L5.8 9.6 L5.41 9.638 L5.035 9.752 L4.689 9.937 L4.386 10.186 L4.137 10.489 L3.952 10.835 L3.838 11.21 L3.8 11.6 L3.838 11.99 L3.952 12.365 L4.137 12.711 L4.386 13.014 L4.689 13.263 L5.035 13.448 L5.41 13.562 L5.8 13.6 L6.19 13.562 L6.565 13.448 L6.911 13.263 L7.214 13.014 L7.463 12.711 L7.648 12.365 L7.762 11.99 L7.8 11.6 L7.762 11.21ZM13.53 12.217 L13.695 12.095 L13.817 11.93 L13.887 11.737 L13.897 11.531 L13.847 11.332 L13.741 11.156 L13.589 11.018 L13.403 10.93 L13.2 10.9 L8.509 10.9 L8.582 11.287 L8.599 11.561 L8.582 11.913 L8.509 12.3 L13.2 12.3 L13.337 12.287Z" />'],   // IconTabGeneral
    header: ["0.046 0.047 13.908 13.908", '<g><path fill="currentColor" fill-rule="evenodd" d="M1.546 12.25V3.314h10.908v8.934a0.204 0.204 0 0 1 -0.205 0.205H1.751a0.204 0.204 0 0 1 -0.205 -0.205Zm-1.5 -10.5C0.046 0.81 0.81 0.047 1.751 0.047h10.498c0.942 0 1.705 0.763 1.705 1.705V12.25c0 0.942 -0.763 1.705 -1.705 1.705H1.751A1.704 1.704 0 0 1 0.046 12.25V1.751Z" clip-rule="evenodd" stroke-width="1"></path></g>'],   // IconBrowser
    main: ["0.056 0.112 13.888 13.888", '<g><path fill="currentColor" fill-rule="evenodd" d="M0.551514 2.27783c0 -0.15488 0.07702 -0.36799 0.357204 -0.62937 0.281142 -0.26227 0.721972 -0.52723 1.318962 -0.762786C3.41794 0.416028 5.10495 0.111832 6.99996 0.111832S10.582 0.416028 11.7722 0.885674c0.597 0.235556 1.0379 0.500516 1.319 0.762786 0.2802 0.26138 0.3572 0.47449 0.3572 0.62937 0 0.15487 -0.077 0.36799 -0.3572 0.62936 -0.2811 0.26227 -0.722 0.52723 -1.319 0.76279 -1.1902 0.46965 -2.87723 0.77384 -4.77224 0.77384s-3.58202 -0.30419 -4.77228 -0.77384c-0.59699 -0.23556 -1.03782 -0.50052 -1.318962 -0.76279 -0.280184 -0.26137 -0.357204 -0.47449 -0.357204 -0.62936ZM13.5121 4.16708c-0.3673 0.25522 -0.8026 0.47686 -1.2811 0.66566 -1.3698 0.54049 -3.21949 0.86108 -5.23104 0.86108s-3.86126 -0.32059 -5.23108 -0.86108c-0.47845 -0.18879 -0.913723 -0.41041 -1.280965 -0.66562v3.17781c0.055969 0.0849 0.135466 0.17801 0.246193 0.27869 0.289992 0.26368 0.744472 0.52986 1.359042 0.76629 1.22499 0.47125 2.95961 0.77608 4.90685 0.77608 1.94723 0 3.6819 -0.30483 4.9068 -0.77608 0.6146 -0.23643 1.0691 -0.50261 1.3591 -0.76629 0.1107 -0.10067 0.1902 -0.19378 0.2462 -0.27868V4.16708ZM0.487915 11.209V8.99273c0.341164 0.21282 0.732125 0.4006 1.156435 0.56383C3.04569 10.0957 4.93936 10.416 7 10.416c2.06063 0 3.9543 -0.3203 5.3556 -0.85944 0.4243 -0.16323 0.8153 -0.351 1.1565 -0.56383V11.209c0 1.5406 -2.9154 2.791 -6.51211 2.791 -3.59667 0 -6.512075 -1.2504 -6.512075 -2.791Z" clip-rule="evenodd" stroke-width="1"></path></g>'],   // IconDatabase
    shares: ["0 0 14 14", '<g><path fill="currentColor" d="M6.12675 0.805269c-0.2708 -0.205804 -0.60343 -0.313418 -0.9433 -0.305333H1.5c-0.39782 0 -0.779356 0.158035 -1.06066 0.43934C0.158035 1.22058 0 1.60211 0 1.99994v9.99996c0 0.3979 0.158035 0.7794 0.43934 1.0607 0.281304 0.2813 0.66283 0.4393 1.06066 0.4393h11c0.3978 0 0.7794 -0.158 1.0607 -0.4393S14 12.3978 14 11.9999V3.99994c0 -0.39783 -0.158 -0.77936 -0.4393 -1.06066 -0.2813 -0.28131 -0.6629 -0.43934 -1.0607 -0.43934H6.89039l-0.21495 -0.85979c-0.08224 -0.33249 -0.27599 -0.62762 -0.54869 -0.834881Z" stroke-width="1"></path></g>'],   // IconFolder
    docker: ["0 0 24 24", '<path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />'],   // IconContainers
    plugins: ["0.25 0.25 13.5 13.5", '<g><path fill="currentColor" fill-rule="evenodd" d="M7.01916 0.25c-0.16092 0 -0.32002 0.034013 -0.46688 0.099809 -0.14165 0.063467 -0.26883 0.155124 -0.37379 0.269316L5.04523 1.74619c-0.1201 -0.24641 -0.28227 -0.47269 -0.48153 -0.66779C4.10172 0.617519 3.47577 0.358645 2.82313 0.358645c-0.65362 0 -1.28048 0.25965 -1.74266 0.721825 -0.462175 0.46218 -0.721825 1.08904 -0.721825 1.74266 0 0.65264 0.258874 1.27859 0.719755 1.74057 0.1927 0.19681 0.41581 0.35743 0.6587 0.47708L0.621448 6.13804c-0.115273 0.10537 -0.207743 0.23331 -0.271639 0.37592C0.284013 6.66082 0.25 6.81992 0.25 6.98084s0.034013 0.32002 0.099809 0.46688c0.063572 0.14189 0.155429 0.26925 0.269887 0.37431L2.08637 9.28871c0.11441 0.11441 0.2771 0.16638 0.43664 0.1395 0.15955 -0.02689 0.29622 -0.12931 0.36681 -0.27489 0.07392 -0.15244 0.17174 -0.29206 0.28976 -0.41359 0.27608 -0.27707 0.65075 -0.43344 1.04195 -0.43478 0.392 -0.00134 0.76848 0.15309 1.04661 0.42933 0.27813 0.27623 0.43514 0.65165 0.43649 1.04364 0.00133 0.39058 -0.15201 0.76588 -0.42643 1.04368 -0.12124 0.1175 -0.26044 0.2149 -0.41236 0.2886 -0.144 0.0698 -0.24588 0.2043 -0.27404 0.3619 -0.02816 0.1575 0.0208 0.319 0.1317 0.4344l1.41232 1.4696c0.10579 0.1164 0.23453 0.2097 0.37814 0.2741 0.14686 0.0658 0.30596 0.0998 0.46688 0.0998s0.32002 -0.034 0.46688 -0.0998c0.14165 -0.0635 0.26881 -0.1551 0.37378 -0.2693l1.13609 -1.1299c0.06501 0.1337 0.14226 0.2617 0.23113 0.3825 0.2813 0.3823 0.66704 0.6753 1.11088 0.8436 0.4438 0.1683 0.9267 0.2048 1.3908 0.1052 0.4641 -0.0996 0.8895 -0.3311 1.2251 -0.6668 0.3357 -0.3356 0.5672 -0.761 0.6668 -1.2251 0.0996 -0.4641 0.0631 -0.947 -0.1052 -1.3908 -0.1683 -0.44384 -0.4613 -0.82958 -0.8436 -1.11088 -0.118 -0.08686 -0.2431 -0.16262 -0.3734 -0.2267l1.1185 -1.10006c0.1152 -0.10537 0.2077 -0.23331 0.2716 -0.37592 0.0658 -0.14686 0.0998 -0.30596 0.0998 -0.46688s-0.034 -0.32002 -0.0998 -0.46688c-0.0638 -0.14245 -0.1562 -0.27025 -0.2713 -0.37556l-1.4867 -1.4677c-0.1148 -0.11327 -0.2771 -0.16426 -0.436 -0.13696 -0.1589 0.02731 -0.2948 0.12956 -0.3652 0.27462 -0.072 0.1486 -0.1668 0.28503 -0.2809 0.40438 -0.2787 0.2483 -0.6415 0.38168 -1.01504 0.37282 -0.37858 -0.00899 -0.73917 -0.16339 -1.00694 -0.43116 -0.26777 -0.26777 -0.42217 -0.62836 -0.43116 -1.00695 -0.00886 -0.37355 0.12452 -0.73632 0.37282 -1.01505 0.11935 -0.11406 0.25578 -0.20884 0.40438 -0.2809 0.144 -0.06983 0.24587 -0.20437 0.27404 -0.36191 0.02816 -0.15755 -0.0208 -0.31905 -0.1317 -0.43444L7.86419 0.623895c-0.1058 -0.116412 -0.23453 -0.209738 -0.37815 -0.274086C7.33918 0.284013 7.18008 0.25 7.01916 0.25Z" clip-rule="evenodd" stroke-width="1"></path></g>'],   // IconModules
    vms: ["0 0.247 14 14", '<g><path fill="currentColor" fill-rule="evenodd" d="M2 9V2.5h10V9H2ZM1.457 0.5C0.652 0.5 0 1.152 0 1.957v7.586C0 10.348 0.652 11 1.457 11h4.026l-0.535 1.495H4a0.75 0.75 0 0 0 0 1.5h6a0.75 0.75 0 0 0 0 -1.5h-0.948L8.517 11h4.026C13.348 11 14 10.348 14 9.543V1.957C14 1.152 13.348 0.5 12.543 0.5H1.457Z" clip-rule="evenodd" stroke-width="1"></path></g>'],   // IconVM
    settings: ["-0.001 0 14 14", '<g><path fill="currentColor" fill-rule="evenodd" d="m5.557 0.69 -0.463 1.195 -1.594 0.904 -1.27 -0.194a1.077 1.077 0 0 0 -1.078 0.528l-0.43 0.754a1.077 1.077 0 0 0 0.086 1.217l0.807 1.001v1.81L0.83 8.906a1.077 1.077 0 0 0 -0.086 1.217l0.43 0.754a1.077 1.077 0 0 0 1.078 0.528l1.27 -0.194 1.573 0.904 0.463 1.196a1.076 1.076 0 0 0 1 0.689h0.905a1.076 1.076 0 0 0 1.002 -0.69l0.463 -1.195 1.572 -0.904 1.27 0.194a1.077 1.077 0 0 0 1.078 -0.528l0.43 -0.754a1.077 1.077 0 0 0 -0.086 -1.217l-0.807 -1.001v-1.81l0.786 -1.001a1.077 1.077 0 0 0 0.086 -1.217l-0.43 -0.754a1.076 1.076 0 0 0 -1.078 -0.528l-1.27 0.194 -1.573 -0.904L8.443 0.689A1.077 1.077 0 0 0 7.442 0h-0.884a1.077 1.077 0 0 0 -1.001 0.69ZM7 9.25a2.25 2.25 0 1 0 0 -4.5 2.25 2.25 0 0 0 0 4.5Z" clip-rule="evenodd" stroke-width="1"></path></g>'],   // IconGear
    info: ["0 0 14 14", '<path fill="currentColor" fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7ZM5.5 9.375c-0.34518 0 -0.625 0.27982 -0.625 0.625 0 0.3452 0.27982 0.625 0.625 0.625h3c0.34518 0 0.625 -0.2798 0.625 -0.625 0 -0.34518 -0.27982 -0.625 -0.625 -0.625h-0.875V6.5c0 -0.34518 -0.27982 -0.625 -0.625 -0.625H6c-0.34518 0 -0.625 0.27982 -0.625 0.625s0.27982 0.625 0.625 0.625h0.375v2.25H5.5ZM8 4c0 0.55228 -0.44772 1 -1 1s-1 -0.44772 -1 -1 0.44772 -1 1 -1 1 0.44772 1 1Z" clip-rule="evenodd" stroke-width="1"></path>'],   // IconInfo
    favorites: ["0 0 24 24", '<path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" />'],   // Tabler star (MIT), the main bar's; glyphs.json has none
    tools: ["0 0 512 512", '<path d="M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7L336 192c-8.8 0-16-7.2-16-16l0-57.4c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1C7.2 408.8 0 426.1 0 444.1C0 481.6 30.4 512 67.9 512c18 0 35.3-7.2 48-19.9L297.5 310.5c17 6.2 35.4 9.5 54.5 9.5zM80 408a24 24 0 1 1 0 48 24 24 0 1 1 0-48z" />']   // FontAwesome Solid wrench (CC BY 4.0), the main bar's; glyphs.json has none
  };
  function tabGlyph(id) {
    var g = TAB_GLYPHS[id], svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cc-set-tabico"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", g[0]); svg.setAttribute("fill", "currentColor");
    svg.innerHTML = g[1];
    return svg;
  }
  // A small glyph before each choice of a selector, as in KnightLoader's and BombVault's settings:
  // GlimStone's drawing for that choice under its name in glyphs.json, with the viewBox it crops
  // to its ink, filled on currentColor so a chosen segment inks its glyph with its label.
  var SEG_GLYPHS = {
    IconMotionOff: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M1 6H13A1 1 0 0 1 13 8H1A1 1 0 0 1 1 6Z" />'],
    IconMotionSubtle: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M1.48 7.88 2.63 6.98 3.24 6.6 3.51 6.49 3.79 6.42 4.04 6.4 4.3 6.44 4.76 6.6 5.24 6.89 5.78 7.29 7.3 8.52 7.73 8.83 8.18 9.1 8.73 9.36 9.24 9.51 9.77 9.59 10.23 9.59 10.76 9.51 11.37 9.32 11.93 9.04 12.54 8.65 13.26 8.09 13.78 7.63 13.89 7.46 13.96 7.28 14 7.09 13.99 6.89 13.95 6.7 13.88 6.52 13.77 6.36 13.63 6.22 13.46 6.11 13.28 6.04 13.09 6 12.89 6.01 12.7 6.05 12.52 6.12 11.44 6.97 11.05 7.23 10.76 7.4 10.49 7.51 10.21 7.58 9.96 7.6 9.7 7.56 9.24 7.4 8.76 7.11 8.22 6.71 6.7 5.48 6.27 5.17 5.82 4.9 5.27 4.64 4.76 4.49 4.23 4.41 3.77 4.41 3.34 4.47 2.86 4.6 2.44 4.77 2 5 1.46 5.35 0.82 5.85 0.36 6.23 0.22 6.37 0.11 6.54 0.04 6.72 0 6.91 0.01 7.11 0.05 7.3 0.12 7.48 0.23 7.64 0.37 7.78 0.54 7.89 0.72 7.96 0.91 8 1.11 7.99 1.3 7.95Z" />'],
    IconMotionWild: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M1.86 7.51 2.6 5.56 3 4.7 3.24 5.18 3.52 5.86 4.73 9.14 5.04 9.87 5.32 10.39 5.7 10.94 5.88 11.12 6.1 11.3 6.39 11.47 6.61 11.55 6.84 11.59 7.08 11.6 7.32 11.56 7.53 11.5 7.73 11.41 7.97 11.25 8.18 11.07 8.37 10.85 8.7 10.36 8.96 9.87 9.27 9.14 10.48 5.86 10.76 5.18 11 4.7 11.19 5.08 11.47 5.73 12.06 7.33 12.14 7.51 12.26 7.67 12.4 7.8 12.57 7.9 12.75 7.97 12.95 8 13.14 7.99 13.33 7.94 13.51 7.86 13.67 7.74 13.8 7.6 13.9 7.43 13.97 7.25 14 7.05 13.99 6.86 13.94 6.67 13.25 4.81 12.84 3.91 12.44 3.25 12.21 2.97 12 2.77 11.74 2.6 11.54 2.5 11.24 2.42 11 2.4 10.76 2.42 10.53 2.48 10.14 2.67 9.84 2.92 9.49 3.35 9.19 3.85 8.93 4.37 8.62 5.13 7.42 8.38 7.22 8.87 7 9.3 6.78 8.87 6.51 8.2 5.3 4.93 4.98 4.19 4.71 3.66 4.33 3.11 4.16 2.92 3.95 2.73 3.68 2.56 3.47 2.48 3.24 2.42 3 2.4 2.76 2.42 2.54 2.48 2.16 2.66 1.79 2.97 1.45 3.4 1.08 4.05 0.75 4.79 0.28 6.03 0.06 6.67 0.01 6.86 0 7.05 0.03 7.25 0.1 7.43 0.2 7.6 0.33 7.74 0.49 7.86 0.67 7.94 0.86 7.99 1.05 8 1.25 7.97 1.43 7.9 1.6 7.8 1.74 7.67Z" />'],
    IconAccent: ["0.3 0.6 13.4 13.4", '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 0.6C7 0.6 12 6.203 12 9A5 5 0 0 1 2 9C2 6.203 7 0.6 7 0.6Z" />'],
    IconRainbow: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M0 10.5A7 7 0 0 1 14 10.5H12A5 5 0 0 0 2 10.5ZM3.5 10.5A3.5 3.5 0 0 1 10.5 10.5H8.5A1.5 1.5 0 0 0 5.5 10.5Z" />'],
    IconFlag: ["0.2 0.2 13.6 13.6", '<path d="M3.4 1.2L3.4 12.8A1 1 0 0 1 1.4 12.8L1.4 1.2A1 1 0 0 1 3.4 1.2ZM3.4 1.4L12.6 1.4L10.2 4.85L12.6 8.3L3.4 8.3Z" />'],
    IconCornerRound: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M6 0H8A6 6 0 0 1 14 6V8A6 6 0 0 1 8 14H6A6 6 0 0 1 0 8V6A6 6 0 0 1 6 0ZM6 2H8A4 4 0 0 1 12 6V8A4 4 0 0 1 8 12H6A4 4 0 0 1 2 8V6A4 4 0 0 1 6 2Z" />'],
    IconCornerSoft: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 0H11A3 3 0 0 1 14 3V11A3 3 0 0 1 11 14H3A3 3 0 0 1 0 11V3A3 3 0 0 1 3 0ZM3 2H11A1 1 0 0 1 12 3V11A1 1 0 0 1 11 12H3A1 1 0 0 1 2 11V3A1 1 0 0 1 3 2Z" />'],
    IconCornerSquare: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H14V14H0ZM2 2H12V12H2Z" />'],
    IconBadgeFlat: ["0.5 0.5 13 13", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 3.5H10A3.5 3.5 0 0 1 13.5 7V7A3.5 3.5 0 0 1 10 10.5H4A3.5 3.5 0 0 1 0.5 7V7A3.5 3.5 0 0 1 4 3.5Z" />'],
    IconBadgeGlass: ["0.5 0.5 13 13", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 3.5H10A3.5 3.5 0 0 1 13.5 7V7A3.5 3.5 0 0 1 10 10.5H4A3.5 3.5 0 0 1 0.5 7V7A3.5 3.5 0 0 1 4 3.5ZM5.4 4.9L3.2 9.1L4.9 9.1L7.1 4.9ZM8.3 4.9L6.1 9.1L7.2 9.1L9.4 4.9Z" />'],
    IconDensityCompact: ["0.2 0.2 13.6 13.6", '<path d="M1 1.8L13 1.8A0.8 0.8 0 0 1 13 3.4L1 3.4A0.8 0.8 0 0 1 1 1.8ZM1 4.73L13 4.73A0.8 0.8 0 0 1 13 6.33L1 6.33A0.8 0.8 0 0 1 1 4.73ZM1 7.67L13 7.67A0.8 0.8 0 0 1 13 9.27L1 9.27A0.8 0.8 0 0 1 1 7.67ZM1 10.6L13 10.6A0.8 0.8 0 0 1 13 12.2L1 12.2A0.8 0.8 0 0 1 1 10.6Z" />'],
    IconDensityNormal: ["0.1 0.1 13.8 13.8", '<path d="M1 2.1L13 2.1A0.9 0.9 0 0 1 13 3.9L1 3.9A0.9 0.9 0 0 1 1 2.1ZM1 6.1L13 6.1A0.9 0.9 0 0 1 13 7.9L1 7.9A0.9 0.9 0 0 1 1 6.1ZM1 10.1L13 10.1A0.9 0.9 0 0 1 13 11.9L1 11.9A0.9 0.9 0 0 1 1 10.1Z" />'],
    IconDensityAiry: ["0.1 0.1 13.8 13.8", '<path d="M1 2.6L13 2.6A0.9 0.9 0 0 1 13 4.4L1 4.4A0.9 0.9 0 0 1 1 2.6ZM1 9.6L13 9.6A0.9 0.9 0 0 1 13 11.4L1 11.4A0.9 0.9 0 0 1 1 9.6Z" />'],
    IconSizeSmall: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M5.4 4H8.6A1.4 1.4 0 0 1 10 5.4V8.6A1.4 1.4 0 0 1 8.6 10H5.4A1.4 1.4 0 0 1 4 8.6V5.4A1.4 1.4 0 0 1 5.4 4Z" />'],
    IconSizeMedium: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.3 2.5H9.7A1.8 1.8 0 0 1 11.5 4.3V9.7A1.8 1.8 0 0 1 9.7 11.5H4.3A1.8 1.8 0 0 1 2.5 9.7V4.3A1.8 1.8 0 0 1 4.3 2.5Z" />'],
    IconSizeLarge: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M3.2 1H10.8A2.2 2.2 0 0 1 13 3.2V10.8A2.2 2.2 0 0 1 10.8 13H3.2A2.2 2.2 0 0 1 1 10.8V3.2A2.2 2.2 0 0 1 3.2 1Z" />'],
    IconTintAuto: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 0C7.6 4.6 9.4 6.4 14 7C9.4 7.6 7.6 9.4 7 14C6.4 9.4 4.6 7.6 0 7C4.6 6.4 6.4 4.6 7 0Z" />'],
    IconTintNative: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 1H12A2 2 0 0 1 14 3V11A2 2 0 0 1 12 13H2A2 2 0 0 1 0 11V3A2 2 0 0 1 2 1ZM2.3 2.5A0.8 0.8 0 0 0 1.5 3.3V10.7A0.8 0.8 0 0 0 2.3 11.5H11.7A0.8 0.8 0 0 0 12.5 10.7V3.3A0.8 0.8 0 0 0 11.7 2.5ZM1.5 11.5L5.4 6.4L8.1 9.3L9.6 7.9L12.5 11.5ZM8.2 5A1.4 1.4 0 1 1 11 5A1.4 1.4 0 1 1 8.2 5Z" />'],
    IconTintFlatten: ["0.3 0.199 13.401 13.401", '<path d="M4.8 2.4A2.2 2.2 0 1 1 9.2 2.4A2.2 2.2 0 1 1 4.8 2.4ZM6.1 3.6H7.9A0.5 0.5 0 0 1 8.4 4.1V7.5A0.5 0.5 0 0 1 7.9 8H6.1A0.5 0.5 0 0 1 5.6 7.5V4.1A0.5 0.5 0 0 1 6.1 3.6ZM2.7 7H11.3A1.2 1.2 0 0 1 12.5 8.2V9.4A1.2 1.2 0 0 1 11.3 10.6H2.7A1.2 1.2 0 0 1 1.5 9.4V8.2A1.2 1.2 0 0 1 2.7 7ZM1.6 11.4H12.4A1.1 1.1 0 0 1 13.5 12.5V12.5A1.1 1.1 0 0 1 12.4 13.6H1.6A1.1 1.1 0 0 1 0.5 12.5V12.5A1.1 1.1 0 0 1 1.6 11.4Z" />'],
    IconTintLuminance: ["0.3 0.6 13.4 13.4", '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 0.6C7 0.6 12 6.203 12 9A5 5 0 0 1 2 9C2 6.203 7 0.6 7 0.6ZM7 3.12C7 3.12 10.5 7.042 10.5 9A3.5 3.5 0 0 1 3.5 9C3.5 7.042 7 3.12 7 3.12ZM7 3.12C7 3.12 3.5 7.042 3.5 9A3.5 3.5 0 0 0 7 12.5Z" />'],
    IconTempLow: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.25 2.75A2.75 2.75 0 0 1 9.75 2.75V8.335A3.5 3.5 0 1 1 4.25 8.335ZM5.75 8.6V2.75A1.25 1.25 0 0 1 8.25 2.75V8.6Z" />'],
    IconTempMid: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.25 2.75A2.75 2.75 0 0 1 9.75 2.75V8.335A3.5 3.5 0 1 1 4.25 8.335ZM5.75 5.6V2.75A1.25 1.25 0 0 1 8.25 2.75V5.6Z" />'],
    IconTempHigh: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.25 2.75A2.75 2.75 0 0 1 9.75 2.75V8.335A3.5 3.5 0 1 1 4.25 8.335Z" />'],
    IconCustomValue: ["0 0 14 14", '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 2.5H12A2 2 0 0 1 14 4.5V9.5A2 2 0 0 1 12 11.5H2A2 2 0 0 1 0 9.5V4.5A2 2 0 0 1 2 2.5ZM2.3 4A0.8 0.8 0 0 0 1.5 4.8V9.2A0.8 0.8 0 0 0 2.3 10H11.7A0.8 0.8 0 0 0 12.5 9.2V4.8A0.8 0.8 0 0 0 11.7 4ZM4.4 5.1H4.4A0.8 0.8 0 0 1 5.2 5.9V8.1A0.8 0.8 0 0 1 4.4 8.9H4.4A0.8 0.8 0 0 1 3.6 8.1V5.9A0.8 0.8 0 0 1 4.4 5.1Z" />'],
    IconViewList: ["0.5 0.5 13 13", '<path d="M1.3 0.5H2.7A0.8 0.8 0 0 1 3.5 1.3V2.7A0.8 0.8 0 0 1 2.7 3.5H1.3A0.8 0.8 0 0 1 0.5 2.7V1.3A0.8 0.8 0 0 1 1.3 0.5ZM6 0.9L12.4 0.9A1.1 1.1 0 0 1 12.4 3.1L6 3.1A1.1 1.1 0 0 1 6 0.9ZM1.3 5.5H2.7A0.8 0.8 0 0 1 3.5 6.3V7.7A0.8 0.8 0 0 1 2.7 8.5H1.3A0.8 0.8 0 0 1 0.5 7.7V6.3A0.8 0.8 0 0 1 1.3 5.5ZM6 5.9L12.4 5.9A1.1 1.1 0 0 1 12.4 8.1L6 8.1A1.1 1.1 0 0 1 6 5.9ZM1.3 10.5H2.7A0.8 0.8 0 0 1 3.5 11.3V12.7A0.8 0.8 0 0 1 2.7 13.5H1.3A0.8 0.8 0 0 1 0.5 12.7V11.3A0.8 0.8 0 0 1 1.3 10.5ZM6 10.9L12.4 10.9A1.1 1.1 0 0 1 12.4 13.1L6 13.1A1.1 1.1 0 0 1 6 10.9Z" />'],
    IconViewGrid: ["0 0 14 14", '<path d="M1.5 0H4.5A1.5 1.5 0 0 1 6 1.5V4.5A1.5 1.5 0 0 1 4.5 6H1.5A1.5 1.5 0 0 1 0 4.5V1.5A1.5 1.5 0 0 1 1.5 0ZM9.5 0H12.5A1.5 1.5 0 0 1 14 1.5V4.5A1.5 1.5 0 0 1 12.5 6H9.5A1.5 1.5 0 0 1 8 4.5V1.5A1.5 1.5 0 0 1 9.5 0ZM1.5 8H4.5A1.5 1.5 0 0 1 6 9.5V12.5A1.5 1.5 0 0 1 4.5 14H1.5A1.5 1.5 0 0 1 0 12.5V9.5A1.5 1.5 0 0 1 1.5 8ZM9.5 8H12.5A1.5 1.5 0 0 1 14 9.5V12.5A1.5 1.5 0 0 1 12.5 14H9.5A1.5 1.5 0 0 1 8 12.5V9.5A1.5 1.5 0 0 1 9.5 8Z" />'],
    IconFolder: ["0 0 14 14", '<path d="M6.12675 0.805269c-0.2708 -0.205804 -0.60343 -0.313418 -0.9433 -0.305333H1.5c-0.39782 0 -0.779356 0.158035 -1.06066 0.43934C0.158035 1.22058 0 1.60211 0 1.99994v9.99996c0 0.3979 0.158035 0.7794 0.43934 1.0607 0.281304 0.2813 0.66283 0.4393 1.06066 0.4393h11c0.3978 0 0.7794 -0.158 1.0607 -0.4393S14 12.3978 14 11.9999V3.99994c0 -0.39783 -0.158 -0.77936 -0.4393 -1.06066 -0.2813 -0.28131 -0.6629 -0.43934 -1.0607 -0.43934H6.89039l-0.21495 -0.85979c-0.08224 -0.33249 -0.27599 -0.62762 -0.54869 -0.834881Z"></path>'],
    IconWeightThin: ["1 1 12 12", '<path d="M7.556 1.826L3.156 12.626A0.6 0.6 0 0 1 2.044 12.174L6.444 1.374A0.6 0.6 0 0 1 7.556 1.826ZM7.556 1.374L11.956 12.174A0.6 0.6 0 0 1 10.844 12.626L6.444 1.826A0.6 0.6 0 0 1 7.556 1.374ZM3.944 8.5L10.056 8.5A0.6 0.6 0 0 1 10.056 9.7L3.944 9.7A0.6 0.6 0 0 1 3.944 8.5Z" />'],
    IconWeightRegular: ["0.76 0.759 12.482 12.482", '<path d="M7.787 1.921L3.387 12.721A0.85 0.85 0 0 1 1.813 12.079L6.213 1.279A0.85 0.85 0 0 1 7.787 1.921ZM7.787 1.279L12.187 12.079A0.85 0.85 0 0 1 10.613 12.721L6.213 1.921A0.85 0.85 0 0 1 7.787 1.279ZM3.944 8.25L10.056 8.25A0.85 0.85 0 0 1 10.056 9.95L3.944 9.95A0.85 0.85 0 0 1 3.944 8.25Z" />'],
    IconWeightMedium: ["0.5 0.5 13 13", '<path d="M8.019 2.015L3.619 12.815A1.1 1.1 0 0 1 1.581 11.985L5.981 1.185A1.1 1.1 0 0 1 8.019 2.015ZM8.019 1.185L12.419 11.985A1.1 1.1 0 0 1 10.381 12.815L5.981 2.015A1.1 1.1 0 0 1 8.019 1.185ZM3.944 8L10.056 8A1.1 1.1 0 0 1 10.056 10.2L3.944 10.2A1.1 1.1 0 0 1 3.944 8Z" />'],
    IconWeightSemibold: ["0.277 0.278 13.444 13.444", '<path d="M8.25 2.109L3.85 12.909A1.35 1.35 0 0 1 1.35 11.891L5.75 1.091A1.35 1.35 0 0 1 8.25 2.109ZM8.25 1.091L12.65 11.891A1.35 1.35 0 0 1 10.15 12.909L5.75 2.109A1.35 1.35 0 0 1 8.25 1.091ZM3.944 7.75L10.056 7.75A1.35 1.35 0 0 1 10.056 10.45L3.944 10.45A1.35 1.35 0 0 1 3.944 7.75Z" />'],
    IconWeightBold: ["0 0 14.001 14.001", '<path d="M8.482 2.204L4.082 13.004A1.6 1.6 0 0 1 1.118 11.796L5.518 0.996A1.6 1.6 0 0 1 8.482 2.204ZM8.482 0.996L12.882 11.796A1.6 1.6 0 0 1 9.918 13.004L5.518 2.204A1.6 1.6 0 0 1 8.482 0.996ZM3.944 7.5L10.056 7.5A1.6 1.6 0 0 1 10.056 10.7L3.944 10.7A1.6 1.6 0 0 1 3.944 7.5Z" />'],
    IconUpright: ["0.9 0.9 12.2 12.2", '<path d="M8.1 2L8.1 12A1.1 1.1 0 0 1 5.9 12L5.9 2A1.1 1.1 0 0 1 8.1 2ZM4 0.9L10 0.9A1.1 1.1 0 0 1 10 3.1L4 3.1A1.1 1.1 0 0 1 4 0.9ZM4 10.9L10 10.9A1.1 1.1 0 0 1 10 13.1L4 13.1A1.1 1.1 0 0 1 4 10.9Z" />'],
    IconItalic: ["0.899 0.9 12.2 12.2", '<path d="M9.648 2.335L6.448 12.335A1.1 1.1 0 0 1 4.352 11.665L7.552 1.665A1.1 1.1 0 0 1 9.648 2.335ZM5.6 0.9L11.6 0.9A1.1 1.1 0 0 1 11.6 3.1L5.6 3.1A1.1 1.1 0 0 1 5.6 0.9ZM2.4 10.9L8.4 10.9A1.1 1.1 0 0 1 8.4 13.1L2.4 13.1A1.1 1.1 0 0 1 2.4 10.9Z" />']
  };
  function segGlyph(name) {
    var g = SEG_GLYPHS[name], svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cc-seg-ico"); svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", g[0]); svg.setAttribute("fill", "currentColor");
    svg.innerHTML = g[1];
    return svg;
  }
  // The start tab, the header and the shares stay off until switched on, as their scripts read
  // them, so an unset key hides their tab here too.
  var OFF_BY_DEFAULT = { "cc.enable.main": true, "cc.enable.header": true, "cc.enable.shares": true };
  // render() points this at its own tabs; a row that names who decides its value jumps there.
  var jumpTo = function () {};
  // The colour field is CannonadeCommand's one colour picker, shared through cc-theme.js with the
  // colour fields of Unraid's own forms.
  var PRESETS = window.CCTheme.PRESETS, colourField = window.CCTheme.colorPicker, swMark = window.CCTheme.swMark, swMarkRow = window.CCTheme.swMarkRow;

  // Each column gets an object of its own from a factory call: chkCell mutates these in place, so a
  // shared reference would let one checkbox flip every column that aliased it. Stays in step with
  // docker.js defaultColview().
  function defColview() { var adv = function () { return { s: false, a: true }; }, both = function () { return { s: true, a: true }; }; return { update: both(), force: adv(), version: adv(), net: both(), ip: both(), lan: both(), port: both(), res: both(), id: adv(), von: adv(), vol: adv(), plan: both(), restart: adv() }; }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // Whether the icons under a key prefix are tinted. An unset icontint means "on whenever an icon
  // colour is set", which keeps the tint of installs that predate the switch.
  function tintOnAt(prefix) { var v = get(prefix + "icontint", null); return v == null ? !!get(prefix + "iconcolor", "") : v === "1"; }
  // A failed save shakes the control that was used and says why in a toast.
  function failed(ctl, msg) { if (window.CCTheme) window.CCTheme.fail(ctl, msg); }
  // Older builds stored the flag palette in the shared cc.rbpal key. With a flag selected and
  // cc.flagpal still absent, cc.rbpal holds exactly those flag colours, so they move across and the
  // rainbow palette returns to its default. No flag lookup is needed, since the value already is
  // the palette, so this cannot race the flag data loading. It runs at module load, before any
  // render, and once cc.flagpal exists the guard is false and it never runs again.
  (function migrateFlagPalette() {
    try {
      var rb = get("cc.rbpal", "");
      if (get("cc.flag", "") && rb) {
        var fp = get("cc.flagpal", "");
        if (!fp) { set("cc.flagpal", rb); del("cc.rbpal"); }
        else if (fp === rb) { del("cc.rbpal"); }                       // both hold the flag palette, so the rainbow one is redundant
        // a differing rbpal is a genuine custom rainbow palette and stays
      }
    } catch (e) {}
  })();
  function loadColview() { try { var j = JSON.parse(localStorage.getItem("cc.colview2") || "null"); if (j && typeof j === "object") { var d = defColview(); Object.keys(d).forEach(function (k) { if (j[k]) d[k] = { s: !!j[k].s, a: !!j[k].a }; }); return d; } } catch (e) {} return defColview(); }

  var accent = get("cc.accent", "#FCC419");
  var rainbow = get("cc.rainbow", "0") === "1";
  var iconcolor = get("cc.iconcolor", "");
  var iconstrength = parseInt(get("cc.iconstrength", "100"), 10);
  var vmicons = get("cc.vmicons", "1") === "1"; // ON by default; the switch is an opt-OUT
  var density = get("cc.density", "normal");
  var colview = loadColview();

  // Notifications are engine config rather than localStorage, loaded and saved through the
  // same-origin proxy. The whole config is kept, so a save here never drops the per-container
  // schedules and watchdogs set in the Docker tab.
  var PROXY = "/plugins/cannonadecommand/server/ccapi.php";
  var fullConfig = { schedules: [], watchdogs: [], notify: { unraid: false, webhook: "" } };
  var notify = { unraid: false, webhook: "" };
  var shapeIface = "";       // the interface the egress shaping runs on; blank means eth0
  var notifyDirty = false;
  var shapeDirty = false;
  // Every cc.* write is mirrored into the engine config: localStorage is per origin, so without
  // this the toggles apply only to the origin they were set on.
  var uiSyncT = null, uiPending = {};
  (function () {
    try {
      var orig = localStorage.setItem.bind(localStorage);
      window.__ccLS = orig;
      localStorage.setItem = function (k, v) {
        // Writing the value already stored gives the engine nothing to hear, and the pages rewrite
        // some keys unchanged on every render, the settings tab among them.
        var same = false; try { same = localStorage.getItem(k) === String(v); } catch (e) {}
        orig(k, v);
        try { if (!same && /^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
    // removeItem is intercepted too, or a cleared key never reaches the engine's mirror and the
    // next adopt resurrects the old value. pushUISettings() already reads a missing local value as
    // "delete the server key"; this is what queues the key at all. docker.js and cc-theme.js carry
    // the same interception, and a page runs exactly one of the three.
    try {
      var origRm = localStorage.removeItem.bind(localStorage);
      window.__ccLSRemove = origRm;
      localStorage.removeItem = function (k) {
        origRm(k);
        try { if (/^cc[a-z]*\./.test(String(k)) && k !== "cc.stateCache") { uiPending[k] = 1; clearTimeout(uiSyncT); uiSyncT = setTimeout(pushUISettings, 800); } } catch (e) {}
      };
    } catch (e) {}
    // the writes header.js made before this wrapper existed, see syncedSet() there
    var early = Object.keys(window.__ccLSEarly || {});
    early.forEach(function (k) { uiPending[k] = 1; });
    if (early.length) uiSyncT = setTimeout(pushUISettings, 800);
    delete window.__ccLSEarly;
  })();
  function collectUISettings() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && /^cc[a-z]*\./.test(k) && k !== "cc.stateCache") o[k] = localStorage.getItem(k); } return o; }
  // Sends only the changed keys, which the engine merges into its copy, one push at a time and
  // inside the config lock, so it cannot race a card's own save. The keys a push carries stay
  // unsynced until its PUT has landed, so the adopt below cannot bring the old value back.
  var uiSending = {}, uiPushing = false, uiQueued = false;
  function pushUISettings() {
    if (uiPushing) { uiQueued = true; return; }
    var keys = Object.keys(uiPending); if (!keys.length) return;
    uiPushing = true;
    var body = {};
    keys.forEach(function (k) { uiSending[k] = 1; delete uiPending[k]; body[k] = localStorage.getItem(k); });
    var unsent = function () { keys.forEach(function (k) { uiPending[k] = 1; }); };
    withConfigLock(function () { return api("PUT", "uisettings", body); }).catch(unsent).then(function () {
      uiPushing = false; uiSending = {};
      if (uiQueued) { uiQueued = false; pushUISettings(); }
    });
  }
  // A write in the last moments before the page goes away would wait out the debounce and die
  // with the page. On pagehide what is still unsynced goes out
  // in one keepalive request that the engine merges into the config itself.
  window.addEventListener("pagehide", function () {
    var keys = Object.keys(uiPending).concat(Object.keys(uiSending));
    if (!keys.length) return;
    var body = {};
    keys.forEach(function (k) { body[k] = localStorage.getItem(k); });
    var tk = csrfToken();
    try {
      fetch(PROXY + "?path=uisettings", {
        method: "PUT", keepalive: true, headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body))
      });
    } catch (e) {}
  });
  function uiUnsynced() { var o = {}; Object.keys(uiPending).concat(Object.keys(uiSending)).forEach(function (k) { o[k] = 1; }); return o; }
  function adoptUISettings(u, busy) {
    var changed = false, skip = uiUnsynced();
    Object.keys(busy || {}).forEach(function (k) { skip[k] = 1; });
    // The same migration on the other side of the sync: the engine's ui_settings is the source of
    // truth, so cleaning localStorage alone would let the next adopt restore the old key. The
    // palette moves across in the incoming map, the local copy is cleared, and _migrated tells the
    // loader to persist the cleaned config back to the engine.
    adoptUISettings._migrated = false;
    try {
      if (u && u["cc.flag"] && u["cc.rbpal"]) {
        if (!u["cc.flagpal"]) { u["cc.flagpal"] = u["cc.rbpal"]; delete u["cc.rbpal"]; adoptUISettings._migrated = true; }
        else if (u["cc.flagpal"] === u["cc.rbpal"]) { delete u["cc.rbpal"]; adoptUISettings._migrated = true; }
        // a differing rbpal is a genuine custom rainbow palette and stays
      }
    } catch (e0) {}
    if (adoptUISettings._migrated) { try { localStorage.removeItem("cc.rbpal"); } catch (e1) {} }
    try { Object.keys(u || {}).forEach(function (k) { if (/^cc[a-z]*\./.test(k) && k !== "cc.stateCache" && !skip[k] && localStorage.getItem(k) !== u[k]) { (window.__ccLS || localStorage.setItem.bind(localStorage))(k, u[k]); changed = true; } }); } catch (e) {}
    return changed;
  }
  function csrfToken() {
    try { return (typeof window.csrf_token !== "undefined" && window.csrf_token) || (document.querySelector('input[name="csrf_token"]') || {}).value || ((document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/) || [])[1] || ""; } catch (e) { return ""; }
  }
  function api(method, path, body) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    var u = PROXY + "?path=" + encodeURIComponent(path);
    var tk = csrfToken();
    if (method !== "GET") { // emhttp accepts the csrf_token in a form body only
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body != null ? body : {}));
    }
    return fetch(u, opts).then(function (r) {
      return r.text().then(function (tx) { var d = null; try { d = tx ? JSON.parse(tx) : null; } catch (e) {} if (!r.ok) throw new Error((d && d.error) || ("HTTP " + r.status)); return d; });
    });
  }
  // Writes fields of Unraid's display settings the way its own form does: a post to update.php
  // with the form's #file and #section and the CSRF token, which merges them into dynamix.cfg. A
  // multipart body times out, hence URLSearchParams.
  function postDisplay(fields) {
    var fd = new URLSearchParams();
    fd.append("#file", "dynamix/dynamix.cfg"); fd.append("#section", "display"); fd.append("csrf_token", csrfToken());
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    return fetch("/update.php", { method: "POST", body: fd, credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); });
  }
  // Loading the page renders more than once and every render reads the engine again, so a read in
  // flight or answered a moment ago is shared rather than sent again, and a read that fails is
  // tried once more before the page says the engine cannot be reached.
  var sharedReads = {};
  function apiRead(path) {
    var s = sharedReads[path];
    if (s && (!s.at || Date.now() - s.at < 3000)) return s.p;
    var entry = { at: 0 };
    entry.p = api("GET", path).catch(function () {
      return new Promise(function (res) { setTimeout(res, 600); }).then(function () { return api("GET", path); });
    }).then(function (d) { entry.at = Date.now(); return d; }, function (e) { if (sharedReads[path] === entry) delete sharedReads[path]; throw e; });
    sharedReads[path] = entry;
    return entry.p;
  }
  // Serialises the config read, modify and write, so two cards saving at nearly the same moment
  // cannot lose each other's field: each cycle waits for the previous one to settle.
  var cfgChain = Promise.resolve();
  function withConfigLock(fn) { var p = cfgChain.then(fn, fn); cfgChain = p.catch(function () {}); return p; }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function glyph(name) { return window.CCTheme && window.CCTheme.glyph ? window.CCTheme.glyph(name) : ""; }
  var cardN = 0;
  function card(title, sub) {
    var c = el("div", "cc-set-card");
    var h = el("div", "cc-set-h", title);
    if (sub) h.appendChild(infoIcon(sub)); // the explanation lives behind the bubble, never on the card
    c.appendChild(h); return c;
  }
  // A control that cannot act right now still answers a press, so it reads as unavailable rather
  // than broken: a shut row's control, a disabled choice and the line of a locked row shake, or
  // glow where nothing may move (CCTheme.deny). Bound on the root once, in the capture phase, so
  // the control's own handler never runs.
  function refuse(e) {
    if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    var t = e.target, hit = t && t.closest && (t.closest(".cc-set-disabled :is(.cc-seg, .cc-set-toggle, .cc-set-numwrap)") || t.closest("[aria-disabled=true]") || t.closest(".cc-set-locked .cc-set-lockby"));
    if (!hit || !root.contains(hit)) return;
    e.preventDefault(); e.stopPropagation();
    if (window.CCTheme && window.CCTheme.deny) window.CCTheme.deny(hit);
  }
  root.addEventListener("click", refuse, true);
  root.addEventListener("keydown", refuse, true);
  function elk(t) { var s = el("span", "cc-b-k"); s.textContent = t; return s; }
  function elv(t) { var s = el("span", "cc-b-v"); s.textContent = t; return s; }
  // The plugin's one info glyph, shared through cc-theme.js; this is the fallback for a page that
  // loads without it. Hover or keyboard focus shows the explanation in a bubble.
  function infoIcon(tip) { if (window.CCTheme && window.CCTheme.infoIcon) return window.CCTheme.infoIcon(tip); var s = el("span", "cc-info"); s.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3" /><circle cx="8" cy="4.6" r="0.9" fill="currentColor" /><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>'; if (tip) { s.setAttribute("data-tip", tip); s.setAttribute("aria-label", tip); } s.setAttribute("tabindex", "0"); return s; }
  // normalise a typed hex ("fcc419" / "#FCC419") to "#rrggbb", or "" if invalid.
  function normHex(s) { var v = String(s || "").trim(); if (/^[0-9a-f]{6}$/i.test(v)) v = "#" + v; return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ""; }

  // A badge-styled on/off toggle, built from a span rather than a button: Unraid's global button
  // CSS paints a border on it and limits the knob's travel.
  function toggle(on, onChange) {
    var t = el("span", "cc-set-toggle" + (on ? " cc-set-toggle-on" : ""));
    t.setAttribute("role", "switch"); t.setAttribute("tabindex", "0"); t.setAttribute("aria-checked", on ? "true" : "false");
    t.appendChild(el("span", "cc-set-knob"));
    function paint() { t.classList.toggle("cc-set-toggle-on", on); t.setAttribute("aria-checked", on ? "true" : "false"); }
    function flip() { on = !on; paint(); onChange(on); }
    t._setOn = function (v) { if (v === on) return; on = v; paint(); }; // a programmatic sync, which fires no onChange
    t.addEventListener("click", flip);
    t.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    return t;
  }
  // A row that only acts while a switch above it is on is shut while that switch is off: its
  // controls leave the tab order and say so to a screen reader, and the sheet fades them and lets
  // no click through. A selector's chosen segment takes the tab stop back when the row opens.
  function setRowEnabled(row, on) {
    row.classList.toggle("cc-set-disabled", !on);
    Array.prototype.forEach.call(row.querySelectorAll(".cc-seg, .cc-set-toggle"), function (c) {
      if (on) c.removeAttribute("aria-disabled"); else c.setAttribute("aria-disabled", "true");
    });
    Array.prototype.forEach.call(row.querySelectorAll(".cc-set-toggle"), function (t) { t.setAttribute("tabindex", on ? "0" : "-1"); });
    Array.prototype.forEach.call(row.querySelectorAll(".cc-seg-btn"), function (b) { b.setAttribute("tabindex", on && b.classList.contains("cc-seg-on") ? "0" : "-1"); });
    Array.prototype.forEach.call(row.querySelectorAll("input"), function (i) { i.disabled = !on; });
  }
  // The flag palette has its own key, never the rainbow one, so the rainbow editor keeps its
  // colours and the engine paints flag colours only while flag mode is on.
  function applyFlag(f) {
    var n = ((window.CCTheme && window.CCTheme.RB) || PRESETS).length, pal = [];
    for (var k = 0; k < n; k++) pal.push(f.colors[k % f.colors.length]);
    set("cc.flag", f.code); set("cc.flagpal", JSON.stringify(pal));
  }
  // The colour mode lives in the two keys every area script reads, cc.rainbow for a palette and
  // cc.flagmode for a flag as that palette, so the mode needs no key of its own.
  function colorMode() {
    if (get("cc.rainbow", "0") !== "1") return "accent";
    return get("cc.flagmode", "0") === "1" ? "flag" : "rainbow";
  }
  function setColorMode(m) {
    set("cc.rainbow", m === "accent" ? "0" : "1");
    set("cc.flagmode", m === "flag" ? "1" : "0");
    var flags = window.CC_FLAGS || [];
    if (m !== "flag" || !flags.length) return;
    var code = get("cc.flag", "de"), pick = flags.filter(function (f) { return f.code === code; })[0] || flags.filter(function (f) { return f.code === "de"; })[0] || flags[0];
    applyFlag(pick);
  }
  // GlimStone's horizontal selector in its well styling, compact at the end of its row. An option
  // is [value, label, glyph, unavailable]. The arrows move the choice and the focus with it, as in
  // a radio group; an unavailable choice stays in view and refuses the move.
  function modeSelector(opts, cur, onPick) {
    var box = el("div", "cc-seg cc-set-mode"); box.setAttribute("role", "radiogroup");
    var btns = opts.map(function (o) {
      var on = o[0] === cur, b = el("span", "cc-seg-btn" + (on ? " cc-seg-on" : ""));
      if (o[2]) b.appendChild(segGlyph(o[2]));
      b.appendChild(el("span", null, o[1]));
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", on ? "true" : "false"); b.setAttribute("tabindex", on ? "0" : "-1");
      if (o[3]) b.setAttribute("aria-disabled", "true");
      b.addEventListener("click", function () { if (!o[3] && !b.classList.contains("cc-seg-on")) onPick(o[0]); });
      box.appendChild(b);
      return b;
    });
    box.addEventListener("keydown", function (e) {
      var at = btns.indexOf(document.activeElement), to = null;
      if (at < 0) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") to = at + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = at - 1;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = btns.length - 1;
      if (to === null) return;
      e.preventDefault();
      to = Math.max(0, Math.min(btns.length - 1, to));
      if (opts[to][3]) { if (window.CCTheme && window.CCTheme.deny) window.CCTheme.deny(btns[to]); return; }
      if (to !== at) onPick(opts[to][0]);
    });
    return box;
  }
  // The selector for a setting that stays on the page: the pick moves the badge and runs onChange.
  function segPicker(opts, cur, onChange) {
    var box = modeSelector(opts, cur, function (v) {
      Array.prototype.forEach.call(box.children, function (b, i) {
        var on = opts[i][0] === v;
        b.classList.toggle("cc-seg-on", on); b.setAttribute("aria-checked", on ? "true" : "false"); b.setAttribute("tabindex", on ? "0" : "-1");
        if (on) b.focus();
      });
      paintToggles();
      onChange(v);
    });
    return box;
  }
  // The one shape of a setting row: its name and (i) at the start, its control at the end.
  function inlineRow(labelText, help, control) {
    var row = el("div", "cc-set-row cc-set-inline"), lw = el("span", "cc-set-lblwrap");
    lw.appendChild(el("span", null, labelText)); lw.appendChild(infoIcon(help));
    row.appendChild(lw); row.appendChild(control);
    return row;
  }
  function toggleRow(labelText, help, on, onChange) { return inlineRow(labelText, help, toggle(on, onChange)); }
  // A tall control such as a colour field beside its name: the name and its bubble at the start of
  // the first line, the control at the row's end.
  function fieldRow(labelText, help, control) {
    var row = el("div", "cc-set-row cc-set-fieldrow"), rl = el("span", "cc-set-rl", labelText);
    if (help) rl.appendChild(infoIcon(help));
    row.appendChild(rl); row.appendChild(control);
    return row;
  }

  // A switch whose value has no effect is left out, and this line stands in its place: it names
  // what decides instead and jumps there.
  function lockRow(label, by, jumpLabel, onJump, help) {
    var end = el("span", "cc-set-colend");
    end.appendChild(el("span", "cc-set-lockby", by));
    end.appendChild(actionBtn(jumpLabel, "cc-btn cc-set-xbtn", onJump));
    var row = inlineRow(label, help, end);
    row.classList.add("cc-set-locked");
    return row;
  }

  // One logo preview for every card that has one. It runs the tabs' own icon pipeline, which
  // picks the treatment and may swap in a curated glyph, exactly as the area scripts do, so the
  // preview shows what the tab it previews will show. The badge is a real CSS box behind the
  // image, not an feFlood inside the filter, which fills the whole filter region and would ignore
  // the radius. `scope` is the pipeline's per-item scope, so a per-item pin shows up here too.
  function logoPreview(scope, fid) {
    var wrap = el("div", "cc-set-prev");
    var items = [];
    // The background and the tint are two independent pairs: the background draws the badge box
    // in its own colour, falling back to the tint colour and then the accent, while the tint
    // recolours the icon and has its own switch, so a badge alone never forces a recolour.
    // `adopt` is the master switch that hands both colours to the badges.
    var st = { bg: false, bgColor: "", tint: false, color: "", adopt: false, strength: 100, accent: "#FCC419", size: null };
    var bound = false;
    function C() { return window.CCTheme && window.CCTheme.icons; }
    function hex6(c) { c = String(c == null ? "" : c).trim(); return /^#[0-9a-f]{3}$/i.test(c) ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c; }
    function badgeBg() {
      if (/^#[0-9a-f]{6}$/i.test(st.bgColor)) return st.bgColor;
      if (/^#[0-9a-f]{6}$/i.test(st.color)) return st.color;
      return st.accent;
    }
    // A badge colour by position, as the tabs stamp one on each row: the rotating palette while
    // the rainbow is on, the accent otherwise.
    function badgeAt(i) { return window.CCTheme && window.CCTheme.rbColor ? window.CCTheme.rbColor(i, st.accent) : st.accent; }
    // The tile behind the i-th logo. Adopting, it takes the badge colour of its row.
    function tileBg(i) {
      if (!st.bg) return "";
      return st.adopt ? badgeAt(i) : badgeBg();
    }
    // The same ink contract as docker.js iconInk(): nothing while the tint is off. Adopting over a
    // tile, the black or white that reads on that tile; adopting without one, the badge colour
    // docker.js picks for its icons; otherwise the picked tint colour. A colour of its own is kept
    // off the surface colour, and a luminance tint outputs about half the target's luma, so that
    // path doubles the floor. badgeBg() stays the box's own colour and is never the icon's ink.
    function ink(forTint, i) {
      if (!st.tint) return "";
      if (st.adopt && st.bg) return hex6(idealText(tileBg(i)));
      var pick = hex6(st.adopt ? badgeAt(5) : st.color);
      if (!/^#[0-9a-f]{6}$/i.test(pick)) return "";
      var T = window.CCTheme;
      return (T && T.liftSurface) ? hex6(T.liftSurface(pick, st.accent, T.LUM_FLOOR * (forTint ? 2 : 1))) : pick;
    }
    function host(id) {
      var h = document.getElementById(id);
      if (!h) { h = document.createElement("div"); h.id = id; h.setAttribute("aria-hidden", "true"); h.style.cssText = "position:absolute;width:0;height:0;overflow:hidden"; document.body.appendChild(h); }
      return h;
    }
    // One filter per ink, since an adopted tile may want black ink beside white. The strength
    // blends either treatment back toward the original, as the VM tab does.
    function filterDef(id, hex, tint) {
      var n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, vals;
      var s = Math.max(10, st.strength || 100) / 100, i = 1 - s;
      if (tint) {
        var row = function (c, ix) { var v = [0.2126 * c * s, 0.7152 * c * s, 0.0722 * c * s, 0, 0]; v[ix] += i; return v.join(" "); };
        vals = row(r, 0) + " " + row(g, 1) + " " + row(b, 2) + " 0 0 0 1 0";
      } else {
        var flat = function (c, ix) { var v = [0, 0, 0, 0, (c * s).toFixed(4)]; v[ix] = i.toFixed(4); return v.join(" "); };
        vals = flat(r, 0) + " " + flat(g, 1) + " " + flat(b, 2) + " 0 0 0 1 0";
      }
      return '<filter id="' + id + '" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="' + vals + '"/></filter>';
    }
    function radius() { return "var(--cc-radius-control)"; }   // the live logo tile is a tile
    function size() { return st.size || ({ s: "48px", m: "62px", l: "76px" })[get("cc.sgsize", "m")] || "62px"; }
    // A sample whose name starts with a font-icon prefix is a glyph, monochrome by construction:
    // it inks through the CSS colour and has no raster for a filter to work on.
    function add(src, name) {
      var tile = el("span", "cc-set-tile"), node;
      if (/^(fa-|icon-)/.test(src)) { node = el("i", (/^fa-/.test(src) ? "fa " : "") + src); }
      else { node = el("img"); node.alt = ""; node.src = src; node.onerror = function () { tile.style.display = "none"; }; }
      tile.appendChild(node); wrap.appendChild(tile);
      items.push({ tile: tile, node: node, name: name || "", glyph: node.tagName !== "IMG", src: src });
    }
    function paint() {
      var Ci = C(), rad = radius(), sz = size(), defs = {}, svg = "";
      function filter(hex, tint) {
        if (!hex) return "";
        var id = fid + (tint ? "-tint-" : "-flat-") + hex.slice(1);
        if (!defs[id]) { defs[id] = true; svg += filterDef(id, hex, tint); }
        return "url(#" + id + ")";
      }
      if (Ci) { var names = []; items.forEach(function (it) { if (it.name) names.push(it.name); }); if (names.length) Ci.want(names); }
      items.forEach(function (it, i) {
        it.tile.style.width = it.tile.style.height = sz;
        it.tile.style.borderRadius = rad;
        it.tile.style.background = tileBg(i);
        it.tile.classList.toggle("cc-set-tile-bg", !!st.bg);
        // The plan comes from the pipeline, never from a local guess, so an unknown icon falls
        // through to the safe treatment exactly as it does on the real tab.
        var plan = { treat: "tint", url: "" };
        if (Ci) {
          var res = it.name ? Ci.result(it.name) : null, kind = (res && res.kind !== "pending") ? res.kind : "";
          var spread = it.glyph ? 0 : Ci.spread(it.src);
          var p = Ci.plan(it.name ? Ci.mode(scope, it.name) : Ci.globalMode(), kind, spread, it.glyph ? null : Ci.tile(it.src));
          plan = { treat: p.treat, tile: p.tile, url: (!it.glyph && it.name && (p.src === "glyph" || p.src === "color")) ? Ci.svgUrl(it.name) : "" };
        }
        if (it.glyph) {
          it.node.style.fontSize = "calc(" + sz + " * .46)";
          // ink() already answers the picked colour while the tint is on and nothing while it is
          // off, badge or no badge; branching on the badge here would colour the glyph regardless.
          it.node.style.color = plan.treat === "native" ? "" : ink(false, i);
          it.node.style.filter = "none";
        } else {
          var src = plan.url || it.src;
          if (it.node.getAttribute("src") !== src) it.node.src = src;
          it.node.style.filter = plan.treat === "native" ? "none" : plan.treat === "knock" ? (Ci.knock(ink(false, i), plan.tile, st.strength) || "none") : (filter(ink(plan.treat === "tint", i), plan.treat === "tint") || "none");
        }
      });
      host(fid + "-svg").innerHTML = svg ? '<svg xmlns="http://www.w3.org/2000/svg">' + svg + "</svg>" : "";
    }
    // A "pending" name is still being looked up by the engine's workers; the pipeline calls back
    // when an answer lands, so the preview upgrades itself exactly like a real tab row does.
    function bind() { if (bound) return; var Ci = C(); if (Ci && Ci.onResolved) { Ci.onResolved(paint); bound = true; } }
    return {
      el: wrap,
      add: function (src, name) { add(src, name); },
      clear: function () { items = []; wrap.innerHTML = ""; },
      count: function () { return items.length; },
      set: function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) st[k] = o[k]; bind(); paint(); },
      paint: paint
    };
  }

  // The one background and icon control pair, for every card that has one: the global logos card,
  // the Docker tab's own and every other area's. Each control has its own on/off key and its own
  // colour key, which is what keeps turning the background on from silently switching the icon
  // tint on with it, and the DOM for both is built exactly once.
  //   io.getBg()/setBg(bool)             the background on or off
  //   io.getBgColor()/setBgColor(hex)    its own colour; empty falls back
  //   io.getTint()/setTint(bool)         the icon tint on or off
  //   io.getColor()/setColor(hex)        its own colour
  //   io.getAdopt()/setAdopt(bool)       the master adopt toggle
  //   io.getAccent()                     this scope's accent, for the fallback
  //   io.onChange()                      called after any of those writes
  // It returns the handles a caller may still need, such as the strength slider, and a sync() that
  // repaints every row from the stored values, which an adopt flip on an area card needs.
  //
  // The adopt toggle is one switch, not one per control. Two would each have to resolve the tint
  // to a single flat hue, since the tint is one shared SVG filter for the whole page, so rainbow
  // mode would paint every logo the same colour. It takes over the colours only: the tile then
  // follows rainbow or the accent as any other badge does, per item, and the icon's ink becomes an
  // automatic black or white contrast against it, or the badge colour itself where no tile is
  // behind the icon. The two switches still decide whether there is a tile and whether the icons
  // are tinted, so they stay, and only the pickers give way to a line that says what decides. The
  // colour resolution itself lives on the read side in each area script.
  function logoToggles(into, io) {
    function bgColorEff() {
      var c = io.getBgColor(); if (/^#[0-9a-f]{6}$/i.test(c)) return c;
      var ic = io.getColor(); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
      return /^#[0-9a-f]{6}$/i.test(io.getAccent()) ? io.getAccent() : "#FCC419";
    }
    // The master toggle is a global decision, so only the global card shows a switch for it. An
    // area card still reads getAdopt() to dim its colour pickers, it just has no row of its own;
    // that row is not built at all rather than built and hidden.
    var hideAdopt = !!io.hideAdoptRow;
    var adoptTg = null, adoptRow = null;
    if (!hideAdopt) {
      // the master toggle, first in the card and above every other row
      adoptTg = toggle(io.getAdopt(), function (v) { io.setAdopt(v); sync(); io.onChange(); });
      adoptRow = el("div", "cc-set-row cc-set-inline");
      var adoptLbl = el("span", "cc-set-lblwrap"); adoptLbl.appendChild(el("span", null, T("Badge-Farben übernehmen", "Use the badge colours")));
      adoptLbl.appendChild(infoIcon(T("An: Logo-Kacheln und eingefärbte Icons nehmen die Farben der Badges, also den Regenbogen pro Logo oder die Akzentfarbe. Auf einer Kachel wird das Icon schwarz oder weiß, je nachdem, was darauf lesbar ist. Die Schalter darunter bleiben: Sie entscheiden weiter, ob es Kacheln gibt und ob Icons eingefärbt werden. Nur die beiden Farbwähler entfallen.", "On: logo tiles and tinted icons take the badge colours, the rainbow per logo or the accent. On a tile the icon turns black or white, whichever reads on it. The switches below stay and still decide whether there are tiles and whether icons are tinted. Only the two colour pickers are hidden.")));
      adoptRow.appendChild(adoptLbl); adoptRow.appendChild(adoptTg);
    }

    var bgTg = toggle(io.getBg(), function (v) {
      io.setBg(v);
      if (v && !/^#[0-9a-f]{6}$/i.test(io.getBgColor())) { var seed = bgColorEff(); io.setBgColor(seed); bgPickRow._set(seed); }
      sync(); io.onChange();
    });
    var bgRow = el("div", "cc-set-row cc-set-inline"), bgLbl = el("span", "cc-set-lblwrap");
    bgLbl.appendChild(el("span", null, T("Logo-Kacheln", "Logo tiles")));
    bgLbl.appendChild(infoIcon(T("Stellt jedes Logo auf eine farbige Kachel. Aus: die Logos stehen frei.", "Puts every logo on a coloured tile. Off: the logos stand on their own.")));
    bgRow.appendChild(bgLbl); bgRow.appendChild(bgTg);
    var bgPickRow = colourField(io.getBgColor(), function (v) { io.setBgColor(v); sync(); io.onChange(); }, { fallback: bgColorEff() });
    var bgColRow = fieldRow(T("Kachelfarbe", "Tile colour"), T("Die Farbe der Kachel hinter jedem Logo. Leer nimmt die Icon-Farbe, sonst die Akzentfarbe.", "The colour of the tile behind each logo. Empty takes the icon colour, otherwise the accent."), bgPickRow);

    var tintTg = toggle(io.getTint(), function (v) {
      io.setTint(v);
      if (v && !/^#[0-9a-f]{6}$/i.test(io.getColor())) { var seed2 = tintPickRow._get(); io.setColor(seed2); tintPickRow._set(seed2); }
      sync(); io.onChange();
    });
    // The storage key and every name in the code stay as the tint.
    var tintRow = el("div", "cc-set-row cc-set-inline"), tintLbl = el("span", "cc-set-lblwrap");
    tintLbl.appendChild(el("span", null, T("Icons einfärben", "Tint icons")));
    tintLbl.appendChild(infoIcon(T("Färbt die Logos in einer Farbe ein. Wie das je Logo geschieht, entscheidet die Icon-Färbung. Aus: die Logos behalten ihre eigenen Farben.", "Tints the logos in one colour. Icon colouring decides how for each logo. Off: the logos keep their own colours.")));
    tintRow.appendChild(tintLbl); tintRow.appendChild(tintTg);
    var tintPickRow = colourField(io.getColor(), function (v) { io.setColor(v); sync(); io.onChange(); }, { fallback: /^#[0-9a-f]{6}$/i.test(io.getAccent()) ? io.getAccent() : "#FCC419" });
    var tintColRow = fieldRow(T("Icon-Farbe", "Icon colour"), T("Die Farbe, in der die Logos eingefärbt werden.", "The colour the logos are tinted in."), tintPickRow);

    var strRow = el("div", "cc-set-row"), strLbl = el("span", "cc-set-rl", T("Intensität", "Strength"));
    strLbl.appendChild(infoIcon(T("Wie stark die Einfärbung über dem Original liegt.", "How strongly the tint covers the original.")));
    strRow.appendChild(strLbl);
    var strInput = el("input"); strInput.type = "range"; strInput.min = "10"; strInput.max = "100"; strRow.appendChild(strInput);
    // On an area tab the global card decides; on the global card itself it is the badge colour.
    var colours = T("Kachel- und Icon-Farbe", "Tile and icon colour");
    var lockHelp = T("Solange „Badge-Farben übernehmen“ an ist, nehmen Kacheln und eingefärbte Icons die Farben der Badges.", "While “Use the badge colours” is on, tiles and tinted icons take the badge colours.");
    var lock = hideAdopt
      ? lockRow(colours, T("Folgt Allgemein", "Follows General"), T("Zu Logos & Icons", "Go to Logos & icons"), function () { jumpTo("general", T("Logos & Icons", "Logos & icons")); }, lockHelp)
      : lockRow(colours, T("Folgt den Badges", "Follows the badges"), T("Zu den Badges", "Go to Badges"), function () { jumpTo("general", T("Badges", "Badges")); }, lockHelp);

    function sync() {
      if (adoptTg) adoptTg._setOn(io.getAdopt());
      var adopting = io.getAdopt();
      bgTg._setOn(io.getBg());
      bgPickRow._set(io.getBgColor(), bgColorEff());
      tintTg._setOn(io.getTint());
      tintPickRow._set(io.getColor());
      // Adopting takes over the colours alone, so the pickers give way to the line that names
      // what decides and the switches stay. A picker or the strength under a switch that is off
      // has nothing to act on, and the strength only tunes the luminance tint.
      lock.hidden = !adopting || (!io.getBg() && !io.getTint());
      bgColRow.hidden = adopting || !io.getBg();
      tintColRow.hidden = adopting || !io.getTint();
      strRow.hidden = !io.getTint();
    }
    if (adoptRow) into.appendChild(adoptRow);
    into.appendChild(bgRow); into.appendChild(bgColRow);
    into.appendChild(tintRow); into.appendChild(tintColRow);
    into.appendChild(lock);
    into.appendChild(strRow);
    sync();
    return { sync: sync, strInput: strInput, bgToggle: bgTg, tintToggle: tintTg, adoptToggle: adoptTg };
  }

  // Real sample icons per area, for the previews. Fetching the native list pages cannot work:
  // all three ship an empty table body and fill it from their own jQuery after load, and fetch()
  // never executes a page's scripts, so the bytes it gets hold no icon at all. These are the same
  // row-fragment endpoints those pages call, plain server-rendered rows with the real icons in
  // them, identical by construction to what the live tab shows.
  // Three details in the parsing below:
  //  the VM endpoint answers the rows and a script separated by a NUL, and only the first part is
  //  markup; a bare row string handed to DOMParser is discarded, because the parser foster-parents
  //  a row with no table around it, so the fragment is wrapped first; and only the direct row
  //  children of that wrapper count, since a plugin's rendered README can carry its own tables
  //  and images. The plugin endpoint takes init=1 for the server-rendered icon markup and check=1
  //  to skip the remote version check, whose network path lives in the other branch.
  var ICON_SRC = {
    // The fragment carries the src the Docker tab itself renders, including Unraid's stand-in
    // image. Building a URL from the engine's container list instead is a guess, and it is wrong
    // for every container Unraid has no cached icon for: the file 404s and the row comes out as
    // a hole.
    docker: {
      url: "/plugins/dynamix.docker.manager/include/DockerContainers.php",
      cell: "td.ct-name",
      sels: ["span[id] > .img", "img.img", "img", "i.img"],
      name: function (cell) {
        var h = cell.querySelector("[onclick*='addDockerContainerContext']");
        var m = /addDockerContainerContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
        return m ? m[1] : "";
      }
    },
    vm: {
      url: "/plugins/dynamix.vm.manager/include/VMMachines.php",
      cell: "td.vm-name",                                                     // a detail or disk row has no such cell and is skipped
      sels: ["span[id^='vm-'] > .img", "img.img", "img", "i.img"],            // the order vms.js uses
      // as vms.js does: a row's VM name is the first argument of its context handler
      name: function (cell) {
        var h = cell.querySelector("[onclick*='addVMContext']");
        var m = /addVMContext\('([^']+)'/.exec(h ? (h.getAttribute("onclick") || "") : "");
        return m ? m[1] : "";
      }
    },
    plugin: {
      url: "/plugins/dynamix.plugin.manager/include/ShowPlugins.php?init=1&check=1",
      cell: "td",
      sels: ["img.list", "i.list", "img", "i"],
      // as plugins.js does: the display name is the README heading in the description cell, with
      // the version cell's own id as the fallback.
      name: function (cell, row) {
        var tds = row.children; if (!tds || tds.length < 4) return "";
        var h = tds[1].querySelector("h1, h2, h3") || tds[1].querySelector("strong, b");
        return (h ? (h.textContent || "").trim() : String(tds[3].id || "").replace(/^vid-/, "")) || "";
      }
    }
  };
  // A disabled tab, no VMs or a slow box yields an empty list, and the caller shows its
  // "nothing to show" line rather than a broken row.
  function rowIcons(kind, max) {
    var cfg = ICON_SRC[kind];
    if (!cfg) return Promise.resolve([]);
    return fetch(cfg.url, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (raw) {
      var out = [];
      if (!raw) return out;
      try {
        var rows = String(raw).split("\0")[0];
        var doc = new DOMParser().parseFromString("<table><tbody>" + rows + "</tbody></table>", "text/html");
        var tb = doc.querySelector("tbody");
        var lim = max || 4;
        Array.prototype.slice.call(tb ? tb.children : []).forEach(function (row) {
          if (out.length >= lim || row.tagName !== "TR") return;
          var cell = row.children && row.children[0];
          if (!cell || !cell.matches || !cell.matches(cfg.cell)) return;
          var n = null;
          for (var i = 0; i < cfg.sels.length && !n; i++) n = cell.querySelector(cfg.sels[i]);
          if (!n) return;
          var nm = ""; try { nm = cfg.name(cell, row) || ""; } catch (e2) {}
          if (n.tagName === "IMG") { var s = n.getAttribute("src") || ""; if (s) out.push({ src: s, name: nm }); }
          else { var cls = (n.getAttribute("class") || "").split(/\s+/).filter(function (c) { return /^(fa-|icon-)/.test(c); })[0]; if (cls) out.push({ src: cls, name: nm }); }
        });
      } catch (e) {}
      return out;
    }).catch(function () { return []; });
  }

  function render() {
    // Emptying the root shortens the page, and a layout read while it is rebuilt clamps the scroll
    // to the top, so the page is put back where it stood once the cards are in again.
    var keepY = window.scrollY;
    root.innerHTML = "";
    // The theming snapshot is re-read on every render: these are module-level variables read once
    // at load, and a setting change calls render(), so without this the page repaints from the
    // value it started with and a freshly flipped switch snaps back.
    accent = get("cc.accent", "#FCC419");
    rainbow = get("cc.rainbow", "0") === "1";
    iconcolor = get("cc.iconcolor", "");
    iconstrength = parseInt(get("cc.iconstrength", "100"), 10);
    root.classList.toggle("cc-rainbow", rainbow);
    root.style.setProperty("--cc-accent", accent);
    root.style.setProperty("--cc-accent-text", idealText(accent));

    // The page has no heading (GlimStone rule 30): the tile column already says where this is. The
    // head row holds only the settings search, which filters cards and rows across every tab, a
    // badge at the right with a magnifier that expands into the input on click.
    var head = el("div", "cc-set-head");
    var hero = el("div", "cc-set-hero");
    head.appendChild(hero);
    var setSearch = el("input", "cc-set-search"); setSearch.type = "search"; setSearch.placeholder = T("Einstellungen durchsuchen …", "Search settings …"); setSearch.spellcheck = false;
    var searchBadge = el("div", "cc-set-searchbadge");
    var searchIcon = el("span", "cc-set-searchicon"); searchIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M14 3.072a8 8 0 0 1 2.32 11.834l5.387 5.387a1 1 0 0 1 -1.414 1.414l-5.388 -5.387a8 8 0 1 1 -.905 -13.249" /></svg>';   // tabler filled/search
    searchBadge.appendChild(searchIcon); searchBadge.appendChild(setSearch);
    searchIcon.addEventListener("click", function (e) { e.stopPropagation(); var open = searchBadge.classList.toggle("cc-open"); if (open) { setSearch.focus(); } else { setSearch.value = ""; runFilter(""); } });
    // Escape clears the query first and puts the search away on a second press.
    setSearch.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (setSearch.value) { setSearch.value = ""; runFilter(""); } else { searchBadge.classList.remove("cc-open"); setSearch.blur(); }
    });
    hero.appendChild(searchBadge);
    // The search collapses again on a click beside it, clearing the query and resetting the filter
    // through an input event so the existing listener runs. Bound once, since render() re-enters.
    if (!window.__ccSetSearchDoc) {
      window.__ccSetSearchDoc = true;
      document.addEventListener("click", function (e) {
        var sb = document.querySelector(".cc-set-searchbadge.cc-open");
        if (sb && !sb.contains(e.target)) { sb.classList.remove("cc-open"); var si = sb.querySelector(".cc-set-search"); if (si && si.value) { si.value = ""; try { si.dispatchEvent(new Event("input", { bubbles: true })); } catch (e2) {} } }
      });
    }
    root.appendChild(head);
    // "/" opens the search from anywhere on the page outside a field. Ctrl+K stays with header.js's
    // command palette, which takes it on every page and here offers this search first. Bound once,
    // since render() re-enters; it looks the badge up when the key is pressed.
    if (!window.__ccSetSearchKey) {
      window.__ccSetSearchKey = true;
      document.addEventListener("keydown", function (e) {
        if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target, tag = t && t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
        var sb = document.querySelector("#cc-settings .cc-set-searchbadge"), si = sb && sb.querySelector(".cc-set-search");
        if (!si) return;
        e.preventDefault(); sb.classList.add("cc-open"); si.focus();
      });
    }

    // the Unraid title strip between the main menu and our hero is redundant here
    try { Array.prototype.slice.call(document.querySelectorAll("div.title")).forEach(function (tt) { tt.style.setProperty("display", "none", "important"); }); } catch (e9) {}
    // three sections: Docker Tab | Plugin Tab | VM Tab (minimal tab row)
    var tabRow = el("div", "cc-set-tabs");
    var wrap = el("div", "cc-set-wrap");
    var wrapPlugin = el("div", "cc-set-wrap"), wrapVms = el("div", "cc-set-wrap"), wrapHeader = el("div", "cc-set-wrap"), wrapShares = el("div", "cc-set-wrap");
    var wrapSettings = el("div", "cc-set-wrap");
    var wrapTools = el("div", "cc-set-wrap");   // Werkzeuge shares the /Settings grid config, since Unraid renders both landing pages alike
    var wrapFavorites = el("div", "cc-set-wrap");
    var wrapInfo = el("div", "cc-set-wrap");
    var wrapStart = el("div", "cc-set-wrap");
    var wrapMain = el("div", "cc-set-wrap");    // Allgemein, which also hosts the export and import card
    // Each area's adopt key, "1" or unset while it follows the global badge colour and "0" once it
    // has a colour of its own, with that area's key prefix and the switches showing it.
    var ADOPT_PREF = { "cc.styleheader": "cch.", "cc.styleshares": "ccsh.", "cc.styledocker": "ccd.", "cc.styleplugin": "ccp.", "cc.stylevms": "ccv.", "cc.stylesettings": "ccs.", "cc.styletools": "cct.", "cc.stylefavorites": "ccf.", "cc.stylemain": "ccm." };
    var areaSync = {};      // each adopt key's colour lines and area cards, told when the key flips
    var styleCardSync = {}; // each adopt key's refresher, repainting an area card with the effective colour
    function syncAllStyleCards() { for (var k9 in styleCardSync) { try { styleCardSync[k9](); } catch (e9) {} } }
    // the global Logos & icons previews, repainted when a card elsewhere edits the global icon keys
    var repaintLogoPrevs = function () {};
    // The master theming switch. Off keeps the Docker orchestration functions and disables every
    // visual change. It defaults on, so an existing install is unchanged, and the tabs pick a
    // change up through their storage listeners or on the next load.
    var themingCard; // the first Allgemein card, which the backup section moves into
    (function () {
      var tc = card(T("Theming", "Theming"), T("Aus: nur die Docker-Funktionen von CannonadeCommand bleiben (Startplan, Abhängigkeiten, Health-Gate, Watchdog, Zeitpläne, Limits, Bandbreite, Auto-Stop bei Leerlauf). Das gesamte visuelle Theming, also Badges, Farben, Rainbow, Karten und die Umgestaltung aller Tabs, wird abgeschaltet.", "Off: only CannonadeCommand's Docker functions remain (start plan, dependencies, health gate, watchdog, schedules, limits, bandwidth, idle auto-stop). All visual theming, meaning badges, colours, rainbow, cards and every tab's restyling, is turned off."));
      tc.appendChild(toggleRow(T("Theming aktiv", "Theming on"), T("Schaltet das Aussehen von CannonadeCommand an oder aus, die Docker-Funktionen arbeiten weiter.", "Turns CannonadeCommand's look on or off, while the Docker functions keep working."), localStorage.getItem("cc.theming") !== "0", function (v) { set("cc.theming", v ? "1" : "0"); render(); syncHeaderBar(); syncSharesBar(); }));
      themingCard = tc;
      wrapMain.appendChild(tc);
    })();
    // Unraid's display settings stay on Unraid's own page, which CC styles anyway, rather than
    // being mirrored field by field. The few controls kept here write the native setting itself
    // through postDisplay(), and the theme coupling reloads, since the native header only reads its
    // colours on load.
    if (typeof csrf_token !== "undefined") (function () {
      // The header colour pickers live on Unraid's own page too; this card keeps the quick link
      // and the theme coupling below.
      var postDisplayMulti = function (fields) {
        postDisplay(fields).then(function () { location.reload(); })
          .catch(function () { failed(null, T("Die Anzeige-Einstellung wurde nicht gespeichert.", "The display setting was not saved.")); });
      };
      // Matches the native header background and text colour to Unraid's active theme, read from
      // the theme's real body colour.
      function applyHdrAuto() {
        try {
          var bg = getComputedStyle(document.body).backgroundColor || "";
          var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (!m) return;
          var toHex = function (n) { return ("0" + (n & 255).toString(16)).slice(-2); };
          var bghex = toHex(+m[1]) + toHex(+m[2]) + toHex(+m[3]);
          var ink = idealText("#" + bghex).replace(/^#/, "");
          postDisplayMulti({ header: ink, headermetacolor: ink, background: bghex });
        } catch (e9) {}
      }
      // The header rows sit in the Theming card rather than in a card of their own.
      var cCard = themingCard;
      (function () {
        // the label and its bubble on the left, a short button beside it on the right
        var r = el("div", "cc-set-row cc-set-inline");
        var rl = el("span", "cc-set-lblwrap");
        rl.appendChild(el("span", null, T("Native Anzeige-Seite", "Native display page")));
        rl.appendChild(infoIcon(T("Öffnet Unraids Anzeige-Einstellungen im CannonadeCommand-Stil. Dort liegen unter anderem die Kopfzeilen-Farben, das Banner und die Favoriten-Option.", "Opens Unraid's Display Settings in CannonadeCommand style, where the header colours, the banner and the favourites option live.")));
        r.appendChild(rl);
        var b = el("button", "cc-btn", T("Öffnen", "Open")); b.type = "button";
        b.style.marginLeft = "auto";   // flush right, like the switches in the rows around it
        b.addEventListener("click", function () { location.href = "/Settings/DisplaySettings"; });
        r.appendChild(b); cCard.appendChild(r);
        var arLabel = T("Kopf-Farben ans Thema koppeln", "Match header colours to the theme");
        var arHelp = T("An: die Kopfzeilen-Hintergrund- und Textfarbe folgen automatisch Unraids Farbschema, also dunkler Hintergrund mit heller Schrift beim dunklen Thema und umgekehrt. Wirkt, wenn CannonadeCommands Kopfbereich aus ist.", "On: the header background and text colour follow Unraid's colour scheme automatically, dark background with light text on a dark theme and the reverse on a light one. Applies while CannonadeCommand's header area is off.");
        // CannonadeCommand's own header area paints over the native colours, so while it is on the
        // switch has nothing to show and the line says so.
        if (areaOn("cc.enable.header")) cCard.appendChild(lockRow(arLabel, T("Übermalt vom Kopfbereich", "Painted over by the header area"), T("Zu den Bereichen", "Go to Areas"), function () { jumpTo("general", T("Bereiche", "Areas")); }, arHelp));
        else cCard.appendChild(toggleRow(arLabel, arHelp, get("cc.hdrauto", "1") === "1", function (v) { set("cc.hdrauto", v ? "1" : "0"); if (v) applyHdrAuto(); }));
        // Apply the coupling once for a fresh default-on state. It only bites while the CC header
        // area is off, and the flag is set before the call, so the reload postDisplay triggers
        // cannot loop.
        try { if (get("cc.hdrauto", "1") === "1" && get("cc.hdrauto.done", "0") !== "1") { set("cc.hdrauto.done", "1"); applyHdrAuto(); } } catch (e9) {}
      })();
      // cCard is themingCard, already in the DOM, so re-appending it would reorder the cards. This
      // only keeps the favourites value in sync.
      fetch("/Settings/DisplaySettings", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
        try {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var form = null;
          Array.prototype.forEach.call(doc.querySelectorAll("form"), function (f) { var s = f.querySelector('input[name="#section"]'); if (s && s.value === "display") form = f; });
          if (!form) return;
          var fav = form.querySelector('select[name="favorites"]'); if (fav) set("cc.hidefavtab", fav.value === "no" ? "1" : "0");
          try { if (window.ccFavGateSync) window.ccFavGateSync(); } catch (eG) {}   // the real native state is known now, so re-gate the Favoriten toggle
          syncHeaderBar();
        } catch (e9) {}
      }).catch(function () {});
    })();
    // Bereiche: enable/disable each area CannonadeCommand enhances
    (function () {
      var c = card(T("Bereiche", "Areas"), T("Aktiviere, welche Bereiche CannonadeCommand verschönert. Ein deaktivierter Bereich blendet seinen Tab hier sofort aus.", "Choose which areas CannonadeCommand enhances. Disabling an area hides its tab here immediately."));
      [
        ["cc.enable.main", T("Start", "Main"), "0", T("Gestaltet den Tab Start mit dem Array und seinen Laufwerken.", "Styles the Main tab with the array and its disks.")],
        ["cc.enable.header", T("Kopfbereich", "Header area"), "0", T("Gestaltet die Menüleiste, den Streifen darüber mit der Status-Insel und die Übersicht.", "Styles the menu bar, the strip above it with the status island, and the Dashboard.")],
        ["cc.enable.shares", T("Freigaben", "Shares"), "0", T("Gestaltet den Tab Freigaben mit den Benutzer- und Laufwerksfreigaben.", "Styles the Shares tab with the user and disk shares.")],
        ["cc.enable.docker", T("Docker", "Docker"), "1", T("Gestaltet den Docker-Tab und das Formular, in dem du einen Container anlegst oder änderst.", "Styles the Docker tab and the form where you add or edit a container.")],
        ["cc.enable.plugins", T("Plugins", "Plugins"), "1", T("Gestaltet den Plugins-Tab.", "Styles the Plugins tab.")],
        ["cc.enable.vms", T("VMs", "VMs"), "1", T("Gestaltet den VMs-Tab.", "Styles the VMs tab.")],
        ["cc.enable.settings", T("Einstellungen und Werkzeuge", "Settings and Tools"), "1", T("Gestaltet die Kacheln und Seiten unter Einstellungen und Werkzeuge.", "Styles the tiles and pages under Settings and Tools.")],
        ["cc.enable.favorites", T("Favoriten", "Favorites"), "1"]
      ].forEach(function (a) {
        var cur = localStorage.getItem(a[0]);
        if (a[0] === "cc.enable.favorites") {
          var row = el("div", "cc-set-row cc-set-inline");
          // The favourites area needs Unraid's own favourites, or there is no tab to enhance.
          // cc.hidefavtab mirrors the native "favorites=no", and the first switch here writes that
          // native setting itself: the Favorites tab comes and goes at once through header.js,
          // which hides it on cc.hidefavtab, so nothing needs a reload. While the native setting
          // is off the area switch has nothing to act on and stays out. ccFavGateSync checks
          // again once the fetch above knows the native state.
          var natRow = el("div", "cc-set-row cc-set-inline"), nlw = el("span", "cc-set-lblwrap");
          nlw.appendChild(el("span", null, T("Favoriten in Unraid", "Favourites in Unraid")));
          nlw.appendChild(infoIcon(T("Schaltet Unraids eigene Einstellung „Favoriten aktiviert“ (Einstellungen › Anzeige) sofort um. Aus blendet den Favoriten-Tab aus und nimmt die Herzen von den Kacheln unter Einstellungen und Werkzeuge.", "Switches Unraid's own setting “Favorites enabled” (Settings › Display Settings) right away. Off hides the Favorites tab and takes the hearts off the Settings and Tools tiles.")));
          natRow.appendChild(nlw);
          var natTgl = toggle(localStorage.getItem("cc.hidefavtab") !== "1", function (v) {
            set("cc.hidefavtab", v ? "0" : "1");
            if (v) localStorage.setItem("cc.enable.favorites", "1");
            favGate(true); syncHeaderBar();
            postDisplay({ favorites: v ? "yes" : "no" }).catch(function () {
              set("cc.hidefavtab", v ? "1" : "0"); natTgl._setOn(!v); favGate(true); syncHeaderBar();
              failed(natTgl, T("Unraids Favoriten-Einstellung wurde nicht gespeichert.", "Unraid's favourites setting was not saved."));
            });
          });
          natRow.appendChild(natTgl);
          var lw = el("span", "cc-set-lblwrap"); lw.appendChild(el("span", null, a[1])); row.appendChild(lw);
          lw.appendChild(infoIcon(T("Gestaltet den Favoriten-Tab im CannonadeCommand-Stil. Dafür müssen die Favoriten in Unraid an sein.", "Styles the Favorites tab in CannonadeCommand's look. Needs favourites turned on in Unraid.")));
          var favTgl = toggle(cur == null ? true : cur !== "0", function (v) { localStorage.setItem("cc.enable.favorites", v ? "1" : "0"); refreshTabs(); });
          row.appendChild(favTgl);
          var favGate = function (live) {
            var off = localStorage.getItem("cc.hidefavtab") === "1";
            natTgl._setOn(!off); row.hidden = off;
            favTgl._setOn(localStorage.getItem("cc.enable.favorites") !== "0");
            if (off && localStorage.getItem("cc.enable.favorites") !== "0") { localStorage.setItem("cc.enable.favorites", "0"); favTgl._setOn(false); }
            if (live) refreshTabs();
          };
          favGate(false);
          window.ccFavGateSync = function () { favGate(true); };
          c.appendChild(natRow); c.appendChild(row); return;
        }
        // The header area decides whether the Theming card's header colour switch shows.
        c.appendChild(toggleRow(a[1], a[3], cur == null ? a[2] !== "0" : cur !== "0", function (v) { localStorage.setItem(a[0], v ? "1" : "0"); if (a[0] === "cc.enable.header") render(); else refreshTabs(); }));
      });
      wrapMain.appendChild(c);
    })();
    // The motion level, GlimStone's off, subtle and wild. header.js stamps it on every page; this
    // page stamps it again on change so the choice shows at once. The OS reduce-motion setting
    // wins over every level, in the sheets.
    function motionLevel(v) { return window.CCTheme ? window.CCTheme.motionLevel(v) : (v === "off" || v === "0" ? "off" : v === "wild" || v === "2" ? "wild" : "subtle"); }
    function applyAnim() { document.documentElement.setAttribute("data-cc-motion", motionLevel(get("cc.anim", "subtle"))); }
    applyAnim();
    if (themingCard) {
      themingCard.appendChild(segRow(T("Bewegung", "Motion"),
        [["off", T("Aus", "Off"), "IconMotionOff"], ["subtle", T("Dezent", "Subtle"), "IconMotionSubtle"], ["wild", T("Wild", "Wild"), "IconMotionWild"]],
        motionLevel(get("cc.anim", "subtle")),
        function (v) { set("cc.anim", v); applyAnim(); },
        T("Aus: nichts bewegt sich. Dezent: kurze Übergänge und Einblendungen. Wild: kräftigere Effekte, etwa Hauptleisten-Tabs, die beim Überfahren hüpfen. Wenn im System „Bewegung reduzieren“ an ist, gilt das bei jeder Stufe.", "Off: nothing moves. Subtle: short transitions and fades. Wild: stronger effects, such as main-bar tabs that hop on hover. If the system is set to reduce motion, that wins at every level."),
        true));
    }
    // The section order follows the main menu. header.js persists a drag-reordered menu, and this
    // reads it loosely: either shape is accepted, and anything else falls back to the order below.
    var NAVDEF = ["Start", "Favorites", "Freigaben", "Einstellungen", "Docker", "Plugins", "VMs", "Werkzeuge", "Stats", "Apps"];
    var navOrder = NAVDEF;
    try { var no9 = JSON.parse(get("cc.navorder.all", "null")); var arr9 = no9 && no9.left ? no9.left : no9; if (arr9 && arr9.length && typeof arr9.forEach === "function") navOrder = arr9; } catch (e9b) {}
    // The on-screen menu order comes first, so these sub-tabs mirror the main tabs exactly; the
    // persisted snapshot and the default above are only fallbacks.
    try {
      var liveToks9 = [];
      Array.prototype.forEach.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a9) {
        var h9 = (a9.getAttribute("href") || "").replace(/^\//, "").split(/[/?#]/)[0].toLowerCase();
        if (h9 && liveToks9.indexOf(h9) < 0) liveToks9.push(h9);
      });
      if (liveToks9.length >= 2) navOrder = liveToks9;
    } catch (e9x) {}
    // one normalised token per entry, so an href and a label compare equal
    var navToks = [];
    navOrder.forEach(function (k9) { navToks.push(String(k9).replace(/^\//, "").split(/[/?#]/)[0].toLowerCase()); });
    function navRank(aliases) { var best = -1; aliases.forEach(function (a9) { var i9 = navToks.indexOf(a9); if (i9 >= 0 && (best < 0 || i9 < best)) best = i9; }); return best; }
    // Allgemein comes first and Kopfbereich second, both chrome rather than menu tabs. The rest
    // follow the menu order, with anything missing from it keeping its relative order at the end.
    // Each section carries a stable id, which is what cc.settab persists.
    var SECS = [
      { id: "general", t: T("Allgemein", "General"), w: wrapMain, key: null },
      { id: "header", t: T("Kopfbereich", "Header area"), w: wrapHeader, key: "cc.enable.header" }
    ];
    [
      { id: "main", t: T("Start", "Main"), w: wrapStart, key: "cc.enable.main", tabs: ["start", "main"] },
      { id: "shares", t: T("Freigaben", "Shares"), w: wrapShares, key: "cc.enable.shares", tabs: ["freigaben", "shares"] },
      { id: "docker", t: T("Docker", "Docker"), w: wrap, key: "cc.enable.docker", tabs: ["docker"] },
      { id: "plugins", t: T("Plugins", "Plugins"), w: wrapPlugin, key: "cc.enable.plugins", tabs: ["plugins"] },
      { id: "vms", t: T("VMs", "VMs"), w: wrapVms, key: "cc.enable.vms", tabs: ["vms"] },
      { id: "settings", t: T("Einstellungen", "Settings"), w: wrapSettings, key: "cc.enable.settings", tabs: ["einstellungen", "settings"] },
      { id: "tools", t: T("Werkzeuge", "Tools"), w: wrapTools, key: "cc.enable.settings", tabs: ["werkzeuge", "tools"] },
      { id: "favorites", t: T("Favoriten", "Favorites"), w: wrapFavorites, key: "cc.enable.favorites", tabs: ["favorites", "favoriten"] }
    ].map(function (s9, i9) { return { s: s9, i: i9, r: navRank(s9.tabs) }; })
      .sort(function (a9, b9) { return (a9.r < 0 ? 1e9 + a9.i : a9.r) - (b9.r < 0 ? 1e9 + b9.i : b9.r) || a9.i - b9.i; })
      .forEach(function (d9) { SECS.push(d9.s); });
    SECS.push({ id: "info", t: T("Info", "Info"), w: wrapInfo, key: null });   // GlimStone's Info tile comes last
    var tabBtns = [];
    function areaOn(key) { if (!key) return true; var v = localStorage.getItem(key); return v == null ? !OFF_BY_DEFAULT[key] : v !== "0"; }
    function showSec(i) {
      if (!SECS[i] || !areaOn(SECS[i].key)) i = 0; // never land on a hidden section
      localStorage.setItem("cc.settab", SECS[i].id); // the id, not the index, or a menu reorder restores the wrong tab
      SECS.forEach(function (sc, j) {
        var on = j === i;
        sc.w.style.display = on ? "" : "none";
        tabBtns[j].classList.toggle("cc-set-tab-on", on);
        tabBtns[j].setAttribute("aria-selected", on ? "true" : "false");
        tabBtns[j].setAttribute("tabindex", on ? "0" : "-1");
      });
      paintSetTabs();
    }
    // Opens a tab and brings one of its cards into view, for a row that names who decides its value.
    jumpTo = function (secId, cardTitle) {
      var ix = -1; SECS.forEach(function (sc, j) { if (sc.id === secId) ix = j; });
      if (ix < 0) return;
      if (setSearch.value) { setSearch.value = ""; searchBadge.classList.remove("cc-open"); restore(); }
      showSec(ix);
      var target = null;
      Array.prototype.forEach.call(SECS[ix].w.querySelectorAll(".cc-set-card > .cc-set-h"), function (h) { if (!target && (h.textContent || "").trim() === cardTitle) target = h.parentNode; });
      if (!target) return;
      try { target.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { target.scrollIntoView(); }
      var first = target.querySelector("[tabindex='0'], a[href], input, .cc-dsel-trigger");
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    };
    // GlimStone's tab-strip colour rule: every tab owns a rainbow position, which its glyph shows
    // at rest and its fill once chosen. The sheet does the painting from these vars; reactive mode
    // rests the idle glyphs grey through the class on the root.
    function paintSetTabs() {
      var rb = get("cc.rainbow", "0") === "1", rbC = (window.CCTheme && window.CCTheme.rbColor) || function (i, a) { return a; };
      root.classList.toggle("cc-set-reactive", get("cc.rbmode", "all") === "active");
      tabBtns.forEach(function (b, i) {
        if (rb) { var c = rbC(i, accent); b.style.setProperty("--cc-rb-c", c); b.style.setProperty("--cc-rb-ct", idealText(c)); }
        else { b.style.removeProperty("--cc-rb-c"); b.style.removeProperty("--cc-rb-ct"); }
      });
    }
    // A switched-off area loses its tile at once, and if its tab was open, Allgemein opens.
    function refreshTabs() {
      var activeHidden = false;
      SECS.forEach(function (sc, j) {
        var on = areaOn(sc.key);
        tabBtns[j].hidden = !on;
        if (!on && tabBtns[j].classList.contains("cc-set-tab-on")) { activeHidden = true; sc.w.style.display = "none"; }
      });
      if (activeHidden) showSec(0);
    }
    // GlimStone's vertical tiles: one tab stop with a roving tabindex, where the arrows, Home and
    // End move the focus and Enter, Space or a click opens the tab.
    tabRow.setAttribute("role", "tablist"); tabRow.setAttribute("aria-orientation", "vertical");
    SECS.forEach(function (sc, i) {
      var b = el("button", "cc-set-tab"); b.type = "button";
      b.setAttribute("role", "tab"); b.setAttribute("aria-label", sc.t);
      b.appendChild(tabGlyph(sc.id)); b.appendChild(el("span", "cc-set-tablbl", sc.t));
      b.addEventListener("click", function () { showSec(i); });
      tabBtns.push(b); tabRow.appendChild(b);
    });
    tabRow.addEventListener("keydown", function (e) {
      var shown = tabBtns.filter(function (b) { return !b.hidden; }), at = shown.indexOf(document.activeElement), to = -1;
      if (at < 0) return;
      if (e.key === "ArrowDown") to = Math.min(shown.length - 1, at + 1);
      else if (e.key === "ArrowUp") to = Math.max(0, at - 1);
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = shown.length - 1;
      if (to < 0) return;
      e.preventDefault();
      shown.forEach(function (b, j) { b.setAttribute("tabindex", j === to ? "0" : "-1"); });
      shown[to].focus();
    });
    // Below 1024px the column shows the glyphs alone, and each name moves into its bubble.
    window.__ccSetTabTips = function () {
      var narrow = window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
      tabBtns.forEach(function (b, i) { if (narrow) b.setAttribute("data-tip", SECS[i].t); else b.removeAttribute("data-tip"); });
    };
    window.__ccSetTabTips();
    if (!window.__ccSetTabTipsBound && window.matchMedia) {
      window.__ccSetTabTipsBound = true;
      var narrowMq = window.matchMedia("(max-width: 1023px)");
      var onNarrow = function () { window.__ccSetTabTips(); };
      if (narrowMq.addEventListener) narrowMq.addEventListener("change", onNarrow); else narrowMq.addListener(onNarrow);
    }
    var body = el("div", "cc-set-body"), main = el("div", "cc-set-main");
    body.appendChild(tabRow); body.appendChild(main);
    root.appendChild(body);
    alignSetTabs(); // indent the page to the first main-menu tab
    [wrapMain, wrapStart, wrapHeader, wrapShares, wrap, wrapPlugin, wrapVms, wrapSettings, wrapTools, wrapFavorites, wrapInfo].forEach(function (w) { main.appendChild(w); });

    // The picker stays visible with a hex field beside it, both editing the same value and staying
    // in sync. It is embedded rather than an <input type=color>, which opens an OS dialog in a
    // window of its own.
    var c1 = card(T("Badges", "Badges"), T("Akzentfarbe und Farbmodus der Badges.", "Accent colour and colour mode of the badges."));
    // One colour mode at a time, and below the selector only the controls of the chosen one.
    var mode = colorMode();
    var modes = [["accent", T("Akzent", "Accent"), "IconAccent"], ["rainbow", T("Regenbogen", "Rainbow"), "IconRainbow"]];
    if (window.CC_FLAGS && window.CC_FLAGS.length) modes.push(["flag", T("Flagge", "Flag"), "IconFlag"]);
    var modeRow = el("div", "cc-set-row cc-set-inline cc-set-colourmode");
    var modeLbl = el("span", "cc-set-lblwrap");
    modeLbl.appendChild(el("span", null, T("Farbmodus", "Colour mode")));
    modeLbl.appendChild(infoIcon(T("Akzent: alles in einer Farbe. Regenbogen: jedes Badge nimmt eine Farbe aus der Palette. Flagge: die Palette sind die Farben eines Landes.", "Accent: everything in one colour. Rainbow: every badge takes a colour from the palette. Flag: the palette is a country's colours.")));
    modeRow.appendChild(modeLbl);
    modeRow.appendChild(modeSelector(modes, mode, function (m) {
      setColorMode(m); render(); syncHeaderBar(); syncSharesBar();
      var on = root.querySelector(".cc-set-colourmode .cc-seg-on"); if (on) on.focus({ preventScroll: true });
    }));
    c1.appendChild(modeRow);
    // The handler pushes the new colour onto the live bars as well: the header and the shares area
    // own isolated vars, so writing --cc-accent here alone would leave them until the next reload.
    // cc-set-swrow-global scopes syncSwOn() to this row: sweeping every swatch on the page and
    // marking it against the global accent would un-mark an area card's own pick whenever the
    // global colour changed. The logo previews fall back to the accent for their tiles and ink,
    // so they repaint with it.
    var prow = colourField(accent, function (v) { accent = v; set("cc.accent", v); root.style.setProperty("--cc-accent", v); root.style.setProperty("--cc-accent-text", idealText(v)); paintPrev(); syncSwOn(); syncAllStyleCards(); repaintLogoPrevs(); tintPrev(); syncHeaderBar(); syncSharesBar(); }, { rowClass: "cc-set-swrow-global" });
    if (mode === "accent") c1.appendChild(fieldRow(T("Akzentfarbe", "Accent colour"), T("Die Farbe aller Badges, Schalter und Knöpfe im Farbmodus Akzent.", "The colour of every badge, switch and button in the Accent colour mode."), prow));
    // on: every reload deals a fresh colour mapping; off: the colours stay put
    var rrot = el("div", "cc-set-row cc-set-inline");
    var rrotL = el("span", "cc-set-lblwrap");
    rrotL.appendChild(el("span", null, T("Automatische Farbenrotation", "Automatic colour rotation")));
    rrotL.appendChild(infoIcon(T("Mischt die Rainbow-Farben bei jedem Neuladen der Seite neu durch, statt die Reihenfolge fest zu lassen.", "Reshuffles the rainbow colours on every page reload instead of keeping the order fixed.")));
    rrot.appendChild(rrotL);
    rrot.appendChild(toggle(get("cc.rainbowrot", "1") !== "0", function (v) { set("cc.rainbowrot", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    // Every palette colour is editable: clicking a swatch marks it and opens the colour field below
    // it for that place. The palette is stored as JSON in cc.rbpal, which the Docker tab reads live.
    var RBDEF = (window.CCTheme && window.CCTheme.RB) || ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"]; // the shared palette, or the swatches and the live UI disagree
    var rbpal = null; try { rbpal = JSON.parse(get("cc.rbpal", "null")); } catch (e) { rbpal = null; }
    if (!rbpal || rbpal.length !== RBDEF.length) rbpal = RBDEF.slice();
    var rbrow = el("div", "cc-set-swatches cc-fill"), rbIdx = -1;
    var rbPick = colourField(rbpal[0], function (v) {   // its own key, so editing it never touches the flag palette
      if (rbIdx < 0) return;
      var sw = rbrow.children[rbIdx];
      rbpal[rbIdx] = v; sw.style.background = v; sw.setAttribute("data-tip", v); swMark(sw, true, v);
      set("cc.rbpal", JSON.stringify(rbpal)); syncHeaderBar(); syncSharesBar();
      // everything on this page that wears a palette colour, previews, switches and badges alike
      paintPrev(); paintToggles(); paintCardHeads(); paintSetTabs(); repaintLogoPrevs(); tintPrev();
    });
    rbPick.hidden = true;
    rbpal.forEach(function (cx, ix) {
      var sw = actionBtn("", "cc-set-sw", function () {
        rbIdx = ix; rbPick.hidden = false; rbPick._set(rbpal[ix]);
        Array.prototype.forEach.call(rbrow.querySelectorAll(".cc-set-sw"), function (o, j) { swMark(o, j === ix, rbpal[j]); });
      });
      sw.style.background = cx; sw.setAttribute("data-tip", cx); sw.setAttribute("aria-label", cx);
      rbrow.appendChild(sw);
    });
    // a restore glyph right of the swatches, the same size as one of them
    var rbReset = el("span", "cc-set-ibtn");
    rbReset.setAttribute("data-tip", T("Farben zurücksetzen", "Reset colours"));
    rbReset.innerHTML = glyph("Restore");
    rbReset.addEventListener("click", function () { del("cc.rbpal"); render(); syncHeaderBar(); syncSharesBar(); });
    rbrow.appendChild(rbReset);
    var rbCol = el("div", "cc-set-pickrow"); rbCol.appendChild(rbrow); rbCol.appendChild(rbPick);
    if (mode === "rainbow") { c1.appendChild(rrot); c1.appendChild(fieldRow(T("Palette", "Palette"), T("Ein Klick auf eine Farbe öffnet darunter den Farbwähler für diesen Platz der Palette.", "Clicking a colour opens the colour picker for that place in the palette below it."), rbCol)); }
    // In flag mode a country's colours become the active palette, cycled to fill every slot, and
    // drive the same engine. The picker searches
    // by name and shows real flag images; an emoji flag renders as two letter boxes on Windows.
    if (window.CC_FLAGS && window.CC_FLAGS.length) {
      var FLAG_BASE = "/plugins/cannonadecommand/images/flags/";
      // The bundled SVG shows the country's actual pattern, and a code with no SVG falls back to
      // the colour-stripe swatch.
      var flagImg = function (f9, big) {
        var im = document.createElement("img");
        im.className = "cc-flag-img" + (big ? " cc-flag-img-lg" : "");
        im.src = FLAG_BASE + f9.code + ".svg"; im.alt = f9.name_de; im.loading = "lazy"; im.draggable = false;
        im.onerror = function () { try { if (im.parentNode) im.parentNode.replaceChild(flagSwatch(f9.colors, big), im); } catch (e9) {} };
        return im;
      };
      var flagSwatch = function (colors, big) {
        var s = el("span", "cc-flag-sw" + (big ? " cc-flag-sw-lg" : "")); var n = colors.length, stops = [];
        for (var i9 = 0; i9 < n; i9++) { stops.push(colors[i9] + " " + Math.round(i9 / n * 100) + "% " + Math.round((i9 + 1) / n * 100) + "%"); }
        s.style.background = "linear-gradient(to bottom, " + stops.join(", ") + ")"; return s;
      };
      var curFlag = function () { var c9 = get("cc.flag", ""); for (var j9 = 0; j9 < window.CC_FLAGS.length; j9++) if (window.CC_FLAGS[j9].code === c9) return window.CC_FLAGS[j9]; return null; };
      var fr = el("div", "cc-set-row cc-flag-row"), frl = el("span", "cc-set-rl", T("Land", "Country"));
      frl.appendChild(infoIcon(T("Die Farben der Flagge werden zur Palette, der Reihe nach wiederholt, bis alle acht Plätze belegt sind.", "The flag's colours become the palette, repeated in order until all eight places are filled.")));
      fr.appendChild(frl);
      if (mode === "flag") c1.appendChild(fr);
      // A picker of its own, since a native select cannot show flag images: a real flag, the name,
      // and a search over both.
      var picker = el("div", "cc-flag-picker");
      var trigger = el("div", "cc-flag-trigger"); trigger.setAttribute("tabindex", "0");
      // the trigger reads as a button, with no caret
      var renderTrigger = function () { trigger.innerHTML = ""; var f0 = curFlag(); if (f0) { trigger.appendChild(flagImg(f0)); trigger.appendChild(el("span", "cc-flag-name", f0.name_de)); } else trigger.appendChild(el("span", "cc-flag-name", T("Land wählen", "Choose a country"))); };
      renderTrigger();
      var panel = el("div", "cc-flag-panel"); panel.style.display = "none";
      var search = el("input", "cc-flag-search"); search.type = "text"; search.placeholder = T("Suchen…", "Search…"); search.spellcheck = false; panel.appendChild(search);
      var list = el("div", "cc-flag-list");
      var buildList = function (q) {
        list.innerHTML = ""; q = (q || "").toLowerCase();
        window.CC_FLAGS.forEach(function (f0) {
          if (q && f0.name_de.toLowerCase().indexOf(q) < 0 && f0.name.toLowerCase().indexOf(q) < 0 && f0.code.indexOf(q) < 0) return;
          var row = el("div", "cc-flag-item"); row.appendChild(flagImg(f0)); row.appendChild(el("span", "cc-flag-name", f0.name_de));
          row.addEventListener("click", function () { applyFlag(f0); render(); syncHeaderBar(); syncSharesBar(); });
          list.appendChild(row);
        });
      };
      buildList(""); panel.appendChild(list);
      search.addEventListener("input", function () { buildList(search.value); });
      var openPanel = function () {
        panel.style.display = ""; search.value = ""; buildList("");
        // Pinning the panel fixed at the trigger escapes the card's overflow clip, and capping the
        // list to the room below it keeps the whole country list scrollable.
        try {
          var r = trigger.getBoundingClientRect();
          panel.style.position = "fixed"; panel.style.left = Math.round(r.left) + "px"; panel.style.top = Math.round(r.bottom + 4) + "px"; panel.style.right = "auto"; panel.style.width = Math.round(r.width) + "px";
          list.style.maxHeight = Math.max(140, Math.min(300, window.innerHeight - r.bottom - 68)) + "px";
        } catch (e8) {}
        try { search.focus(); } catch (e9) {}
        var closer = function (e9) { if (!picker.contains(e9.target)) { panel.style.display = "none"; document.removeEventListener("click", closer, true); } };
        setTimeout(function () { document.addEventListener("click", closer, true); }, 0);   // removes itself, so it cannot leak across a render
      };
      var closePanel = function () { panel.style.display = "none"; try { trigger.focus(); } catch (e9) {} };
      trigger.addEventListener("click", function () { if (panel.style.display !== "none") panel.style.display = "none"; else openPanel(); });
      // The country picker is a closed field standing for one value, so it wheel-steps like the
      // other selection fields. It has no <select> behind it, so cc-theme.js's shared handler
      // cannot serve it and the step is spelled out here against the same list the panel uses,
      // clamped at both ends. The commit is the click path's, but the full render is debounced: it
      // rebuilds the page, which would tear the element out from under the cursor on every notch.
      var flagRenderT = null;
      trigger.addEventListener("wheel", function (e9) {
        if (e9.ctrlKey || e9.metaKey || e9.altKey) return;
        if (panel.style.display !== "none") return;                 // an open panel scrolls its own list
        var d9 = e9.deltaY || e9.deltaX; if (!d9) return;
        var list9 = window.CC_FLAGS, cur9 = get("cc.flag", ""), ix9 = -1;
        for (var j9 = 0; j9 < list9.length; j9++) if (list9[j9].code === cur9) { ix9 = j9; break; }
        var nx9 = ix9 < 0 ? (d9 > 0 ? 0 : list9.length - 1) : ix9 + (d9 > 0 ? 1 : -1);
        if (nx9 < 0 || nx9 >= list9.length) return;                 // clamped, so the page scrolls instead
        e9.preventDefault();
        applyFlag(list9[nx9]);
        renderTrigger();                                            // the field repaints as a pick would
        syncHeaderBar(); syncSharesBar();
        clearTimeout(flagRenderT); flagRenderT = setTimeout(function () { render(); }, 450);
      }, { passive: false });
      // Enter, space or the down arrow opens the panel; then the arrows move the highlight, Enter
      // picks and Escape closes. The search matches either name and the country code.
      trigger.addEventListener("keydown", function (e9) { if (e9.key === "Enter" || e9.key === " " || e9.key === "ArrowDown") { e9.preventDefault(); openPanel(); } });
      var moveSel = function (dir) { var items = list.querySelectorAll(".cc-flag-item"); if (!items.length) return; var cur = list.querySelector(".cc-flag-item.cc-sel"); var idx = cur ? Array.prototype.indexOf.call(items, cur) : -1; idx += dir; if (idx < 0) idx = 0; if (idx >= items.length) idx = items.length - 1; if (cur) cur.classList.remove("cc-sel"); items[idx].classList.add("cc-sel"); items[idx].scrollIntoView({ block: "nearest" }); };
      search.addEventListener("keydown", function (e9) { if (e9.key === "ArrowDown") { e9.preventDefault(); moveSel(1); } else if (e9.key === "ArrowUp") { e9.preventDefault(); moveSel(-1); } else if (e9.key === "Enter") { e9.preventDefault(); var sel = list.querySelector(".cc-flag-item.cc-sel") || list.querySelector(".cc-flag-item"); if (sel) sel.click(); } else if (e9.key === "Escape") { e9.preventDefault(); closePanel(); } });
      picker.appendChild(trigger); picker.appendChild(panel);
      fr.appendChild(picker);
      // the selected flag's colours, shown apart from the rainbow editor
      var f1 = curFlag();
      if (f1 && mode === "flag") {
        var frow = el("div", "cc-set-swatches cc-fill"), fcol = el("div", "cc-set-pickrow");
        // The same count as the rainbow row, cycled from the flag's own colours, which matches the
        // palette the engine paints and keeps both rows the same shape.
        var fpal = []; for (var kf = 0; kf < RBDEF.length; kf++) fpal.push(f1.colors[kf % f1.colors.length]);
        fpal.forEach(function (c9) { var sw9 = el("span", "cc-set-sw"); sw9.style.background = c9; sw9.setAttribute("data-tip", c9); frow.appendChild(sw9); });
        var fReset = el("span", "cc-set-ibtn"); fReset.setAttribute("data-tip", T("Flagge zurücksetzen", "Reset flag"));
        fReset.innerHTML = glyph("Restore");
        fReset.addEventListener("click", function () { del("cc.flag"); del("cc.flagpal"); setColorMode("accent"); render(); syncHeaderBar(); syncSharesBar(); });
        frow.appendChild(fReset);
        fcol.appendChild(frow);
        c1.appendChild(fieldRow(T("Flaggenfarben", "Flag colours"), T("Die Farben der gewählten Flagge, so wie sie die Palette füllen. Der Pfeil setzt die Flagge zurück.", "The chosen flag's colours as they fill the palette. The arrow resets the flag."), fcol));
      }
    }
    // GlimStone's three shapes, in its order. A name stored before them shows as the shape it reads as.
    themingCard.appendChild(segRow(T("Form", "Shape"), [["round", T("Rund", "Round"), "IconCornerRound"], ["soft", T("Weich", "Soft"), "IconCornerSoft"], ["square", T("Eckig", "Square"), "IconCornerSquare"]], shapeName(get("cc.badgeshape", "round")), function (v) { set("cc.badgeshape", v); applyShape(); syncHeaderBar(); syncSharesBar(); },
      T("Karten, Felder und Knöpfe ändern ihre Ecken gemeinsam.", "Cards, fields and buttons change their corners together.")));
    // One global badge style: glass adds a sheen to every badge at once, flat is the solid look.
    themingCard.appendChild(segRow(T("Badge-Stil", "Badge style"), [["flat", T("Flach", "Flat"), "IconBadgeFlat"], ["glass", T("Glas", "Glass"), "IconBadgeGlass"]], get("cc.badgeglass", "0") === "1" ? "glass" : "flat", function (v) { set("cc.badgeglass", v === "glass" ? "1" : "0"); document.documentElement.classList.toggle("cc-badge-glass", v === "glass" && get("cc.theming", "1") !== "0"); syncHeaderBar(); syncSharesBar(); },
      T("Flach: einfarbige Badges. Glas: ein Glanz auf jedem Badge.", "Flat: solid badges. Glass: a sheen on every badge.")));
    // The reactive toggle covers every colour mode: everything rests grey, colours on hover, and
    // the active item stays lit.
    var rmode = el("div", "cc-set-row cc-set-inline");
    var rmodeL = el("span", "cc-set-lblwrap");
    rmodeL.appendChild(el("span", null, T("Reaktiver Modus", "Reactive mode")));
    rmodeL.appendChild(infoIcon(T("An: alles ruht grau und färbt sich beim Überfahren, Aktives bleibt farbig. Gilt global für alle Farbmodi (Regenbogen, Flagge und Normal) und alle Bereiche, Logo-Kacheln eingeschlossen.", "On: everything rests grey and colours on hover, and the active item stays coloured. Global across every colour mode (rainbow, flag and accent) and every area, logo tiles included.")));
    rmode.appendChild(rmodeL);
    rmode.appendChild(toggle(get("cc.rbmode", "all") === "active", function (v) { set("cc.rbmode", v ? "active" : "all"); paintSetTabs(); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(rmode);
    var snR = el("div", "cc-set-row cc-set-inline");
    var snL = el("span", "cc-set-lblwrap");
    snL.appendChild(el("span", null, T("Zustandsanzeigen nativ färben", "Native state colours")));
    snL.appendChild(infoIcon(T("An: Auslastungsbalken und Status-Badges behalten ihre native Zustandsfarbe (grün, orange, rot). Aus: sie werden in den aktuellen Farbmodus integriert. Zustands-Punkte bei Containern und Laufwerken sind immer nativ, denn bei ihnen ist die Farbe die einzige Information.", "On: usage bars and status badges keep their native state colour (green, orange, red). Off: they fold into the current colour mode. The state dots on containers and drives are always native, because for them the colour is the only information there is.")));
    snR.appendChild(snL);
    snR.appendChild(toggle(get("cc.statenative", "0") === "1", function (v) { set("cc.statenative", v ? "1" : "0"); syncHeaderBar(); syncSharesBar(); }));
    c1.appendChild(snR);
    c1.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
    var prev = el("div", "cc-set-prev");
    // Eight mixed badges, so the whole palette sweep is visible; paintPrev colours each by index.
    var pvName = el("span", "cc-b cc-b-lg", "nextcloud");
    var pvVal = el("span", "cc-b"); pvVal.appendChild(elk("CPU")); pvVal.appendChild(elv("2/8"));
    var pvVal2 = el("span", "cc-b"); pvVal2.appendChild(elk("RAM")); pvVal2.appendChild(elv("1.2G"));
    var pvName2 = el("span", "cc-b cc-b-lg", "plex");
    var pvVal3 = el("span", "cc-b"); pvVal3.appendChild(elk("IP")); pvVal3.appendChild(elv(".20.9"));
    var pvVal4 = el("span", "cc-b"); pvVal4.appendChild(elk("Port")); pvVal4.appendChild(elv("443"));
    var pvName3 = el("span", "cc-b cc-b-lg", "grafana");
    var pvTab = el("span", "cc-navtab cc-navtab-on", "Docker");
    [pvName, pvVal, pvVal2, pvName2, pvVal3, pvVal4, pvName3, pvTab].forEach(function (x9) { prev.appendChild(x9); });
    prev.id = "cc-set-prev"; c1.appendChild(prev);
    wrapMain.appendChild(c1);
    // The global badge colour is set once, in the card above. This card says that every area
    // follows it and lists only the areas set apart, each with its way back.
    var EXC_AREAS = [
      ["cc.styleheader", "header", T("Kopfbereich", "Header area")],
      ["cc.stylemain", "main", T("Start", "Main")],
      ["cc.styleshares", "shares", T("Freigaben", "Shares")],
      ["cc.styledocker", "docker", T("Docker", "Docker")],
      ["cc.styleplugin", "plugins", T("Plugins", "Plugins")],
      ["cc.stylevms", "vms", T("VMs", "VMs")],
      ["cc.stylesettings", "settings", T("Einstellungen", "Settings")],
      ["cc.styletools", "tools", T("Werkzeuge", "Tools")],
      ["cc.stylefavorites", "favorites", T("Favoriten", "Favorites")]
    ];
    var cExc = card(T("Bereichsfarben", "Area colours"));
    wrapMain.appendChild(cExc);
    function paintExceptions() {
      Array.prototype.slice.call(cExc.querySelectorAll(".cc-set-row")).forEach(function (r) { r.parentNode.removeChild(r); });
      var own = [], follow = [];
      EXC_AREAS.forEach(function (a) {
        var sec = SECS.filter(function (s9) { return s9.id === a[1]; })[0];
        if (sec && areaOn(sec.key)) (localStorage.getItem(a[0]) === "0" ? own : follow).push(a);
      });
      var lead = el("div", "cc-set-row"), lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, own.length ? T("Alle Bereiche folgen der globalen Badge-Farbe, bis auf diese:", "Every area follows the global badge colour, except these:") : T("Alle Bereiche folgen der globalen Badge-Farbe", "Every area follows the global badge colour")));
      lw.appendChild(infoIcon(T("Eine eigene Farbe bekommt ein Bereich über „Ausnahme hinzufügen“ oder in seinem eigenen Tab. Alle übrigen Bereiche ändern sich mit der globalen Farbe.", "Add an exception here or on the area's own tab to give it a colour of its own. Every other area changes with the global colour.")));
      lead.appendChild(lw); cExc.appendChild(lead);
      own.forEach(function (a) {
        var row = el("div", "cc-set-row cc-set-inline"), nm = el("span", "cc-set-lblwrap"), dot = el("span", "cc-set-excdot");
        dot.style.background = get(ADOPT_PREF[a[0]] + "accent", "#FCC419");
        nm.appendChild(dot); nm.appendChild(el("span", null, a[2]));
        nm.appendChild(infoIcon(T("Dieser Bereich hat eine eigene Farbe, bis du „Globale Farbe nutzen“ wählst.", "This area has a colour of its own until you pick “Use the global colour”.")));
        row.appendChild(nm);
        row.appendChild(actionBtn(T("Globale Farbe nutzen", "Use the global colour"), "cc-btn", function () { setOwnColour(a[0], false); }));
        cExc.appendChild(row);
      });
      if (follow.length) {
        var add = el("div", "cc-set-row"), addL = add.appendChild(el("span", "cc-set-rl", T("Ausnahme hinzufügen", "Add an exception")));
        addL.appendChild(infoIcon(T("Gibt einem Bereich eine eigene Farbe, die du danach in seinem Tab wählst.", "Gives an area a colour of its own, which you then pick on its tab.")));
        add.appendChild(areaPicker(T("Bereich wählen", "Choose an area"), follow, function (a) { setOwnColour(a[0], true); localStorage.setItem("cc.settab", a[1]); render(); }));
        cExc.appendChild(add);
      }
      paintSelects();
    }
    paintExceptions();
    // Density and tile size are each one key every list reads, so they sit here with the other
    // global controls rather than being repeated per tab.
    if (themingCard) themingCard.appendChild(segRow(T("Dichte", "Density"), [["compact", T("Kompakt", "Compact"), "IconDensityCompact"], ["normal", "Normal", "IconDensityNormal"], ["airy", T("Luftig", "Airy"), "IconDensityAiry"]], density, function (v) { density = v; set("cc.density", v); }, T("Gilt global für alle Listen: Docker, Start, Freigaben und VMs.", "Applies globally to every list: Docker, Start, Shares and VMs."), true));
    if (themingCard) themingCard.appendChild(tileSizeRow());
    // The global logos card edits the shared icon keys every adopting tab resolves through eff().
    // It carries the same controls as a per-area card and the same preview: this is where the icon
    // treatment is decided, so it is the last card that should show no logo. Three sections, one
    // per area, each with that area's real icons.
    (function () {
      var cLI = card(T("Logos & Icons", "Logos & icons"), T("Globale Logo- und Icon-Farben. Bereiche ohne eigene Farbe folgen ihnen.", "Global logo and icon colours. Areas without a colour of their own follow them."));
      // the three previews at the bottom of this card, repainted by every control in it
      var gPrevs = [];
      // Each preview shows what the global values make of that area's icons. An area with a colour
      // of its own previews its own values on its own tab, so nothing here depends on it.
      function gpaint() {
        var look = { bg: get("cc.iconbg", "0") === "1", bgColor: get("cc.iconbgcolor", ""), tint: tintOnAt("cc."), color: get("cc.iconcolor", ""), adopt: get("cc.iconbgrainbow", "0") === "1", strength: parseInt(get("cc.iconstrength", "100"), 10) || 100, accent: get("cc.accent", "#FCC419"), size: "48px" };
        gPrevs.forEach(function (p9) { try { p9.set(look); } catch (e9) {} });
        // The colouring mode only acts on tinted icons, so without the tint its row is shut.
        setRowEnabled(modeRow, tintOnAt("cc."));
      }
      function gsync() { gpaint(); syncAllStyleCards(); syncHeaderBar(); syncSharesBar(); } // an adopting area card repaints with the new globals
      var gLT = logoToggles(cLI, {
        getBg: function () { return get("cc.iconbg", "0") === "1"; },
        setBg: function (v) { set("cc.iconbg", v ? "1" : "0"); },
        getBgColor: function () { return get("cc.iconbgcolor", ""); },
        setBgColor: function (v) { set("cc.iconbgcolor", v); },
        getTint: function () { return tintOnAt("cc."); },
        setTint: function (v) { set("cc.icontint", v ? "1" : "0"); },
        getColor: function () { return get("cc.iconcolor", ""); },
        setColor: function (v) { set("cc.iconcolor", v); },
        getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
        setAdopt: function (v) { set("cc.iconbgrainbow", v ? "1" : "0"); set("cc.iconadoptsplit", "1"); },
        getAccent: function () { return get("cc.accent", "#FCC419"); },
        onChange: gsync
      });
      gLT.strInput.value = String(parseInt(get("cc.iconstrength", "100"), 10) || 100);
      gLT.strInput.addEventListener("input", function () { set("cc.iconstrength", gLT.strInput.value); gsync(); });
      // Icon-Färbung, global: how the two icon treatments are chosen, as opposed to the
      // colour they use (that is the picker above). See cc-theme.js for the chain itself.
      // The default is "auto"; the other three are manual overrides and are respected even
      // where the automatic choice would have picked differently.
      var modeRow = segRow(T("Icon-Färbung", "Icon colouring"),
        [["auto", T("Automatisch", "Automatic"), "IconTintAuto"], ["native", T("Natives Icon", "Native icon"), "IconTintNative"], ["flat", T("Nachzeichnen", "Redraw"), "IconTintFlatten"], ["tint", T("Tönen", "Tone"), "IconTintLuminance"]],
        get("cc.iconmode", "auto"),
        function (v) { set("cc.iconmode", v); gsync(); },
        T("Ein Logo ist entweder eine einzelne durchgehende Form oder ein kleines mehrfarbiges Bild. Eine Form kann man komplett in deiner Farbe nachzeichnen und sie bleibt erkennbar; ein Bild würde dabei zum Farbklecks, weil Hintergrund und Motiv dieselbe Farbe bekämen. Darum zwei Behandlungen:\n\nAutomatisch (empfohlen): CannonadeCommand sieht sich jedes Logo an. Formen werden nachgezeichnet, für bekannte Programme wird dafür sogar ein echtes Marken-Logo geholt; Bilder werden nur eingefärbt.\nNatives Icon: nichts einfärben. Für bekannte Programme nimmt CannonadeCommand dabei ein sauberes Marken-Logo in seinen eigenen Farben, sonst bleibt das Logo, wie es ist.\nNachzeichnen: alles nachzeichnen, auch Bilder.\nTönen: alles nur einfärben, auch Formen.\n\nDie Wahl wirkt, sobald „Icons einfärben“ an ist. Einzelne Container, VMs und Plugins kannst du in ihrem eigenen Fenster abweichend einstellen; diese Einzelwahl gewinnt immer gegen die Einstellung hier. Ganz unverändert bleibt ein Logo mit „Original-Logo“ im Startplan-Fenster des Containers.",
          "A logo is either one solid shape or a small multi-colour picture. A shape can be redrawn entirely in your colour and stays recognisable; a picture would turn into a blob, because its background and its mark would end up the same colour. Hence two treatments:\n\nAutomatic (recommended): CannonadeCommand looks at each logo. Shapes are redrawn, and for a well-known app a real brand logo is fetched to redraw; pictures are only tinted.\nNative icon: no colouring. For a well-known app CannonadeCommand still uses a clean brand logo in its own colours, otherwise the logo stays as it is.\nRedraw: redraw everything, pictures included.\nTone: only tint everything, shapes included.\n\nThe choice applies once “Tint icons” is on. Individual containers, VMs and plugins can be set differently in their own window; that per-item choice always wins over the setting here. “Original logo” in a container's start plan window leaves its logo completely untouched."));
      cLI.appendChild(modeRow);
      cLI.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
      // Three preview sections, each with that area's real icons, each running the same pipeline
      // the real tab runs, so the choice above is visible without leaving this tab.
      [
        ["docker", T("Docker-Container", "Docker containers")],
        ["vm", T("VMs", "VMs")],
        ["plugin", T("Plugins", "Plugins")]
      ].forEach(function (sec9) {
        var lbl9 = el("div", "cc-set-sublbl", sec9[1]);
        cLI.appendChild(lbl9);
        var p9 = logoPreview(sec9[0], "cc-set-gprev-" + sec9[0]);
        var empty9 = el("div", "cc-set-prev-empty", T("Keine Symbole gefunden.", "No icons found."));
        empty9.style.display = "none";
        cLI.appendChild(p9.el); cLI.appendChild(empty9);
        gPrevs.push(p9);
        var fill9 = function (list9) {
          (list9 || []).slice(0, 4).forEach(function (it9) { p9.add(it9.src, it9.name || ""); });
          if (!p9.count()) empty9.style.display = "";
          gpaint();
        };
        // One mechanism for all three: the same row-fragment endpoint that area's own page asks,
        // since the pages themselves only ever return an empty skeleton. An empty answer shows
        // the line above instead.
        rowIcons(sec9[0], 4).then(fill9);
      });
      gpaint();
      repaintLogoPrevs = gpaint;
      wrapMain.appendChild(cLI);
    })();
    // Docker is an area like the others: an adopt card and its own badges card at the top of its
    // tab. buildStyleCards writes the area's own accent key, which docker.js resolves through its
    // adopt-gated reader, so an install that never touches it follows the global colour.
    var cV = card(T("Ansicht", "View"));
    viewRow(cV);
    wrap.appendChild(cV);
    var cD = card(T("Stil", "Style"));
    cD.appendChild(colourRow("cc.styledocker"));
    wrap.appendChild(cD);
    buildStyleCards("ccd.", wrap, [], true);

    var c2 = card(T("Logos", "Logos"), T("Logo-Kacheln und Icons einfärben werden getrennt geschaltet, jedes mit seiner eigenen Farbe.", "Logo tiles and Tint icons are switched separately, each with its own colour."));
    // This Docker card edits the same global keys, not a scoped copy of them.
    function c2OnChange() {
      var on = get("cc.iconbg", "0") === "1";
      c2.classList.toggle("cc-bg-mode", on);
      tprevWrap.classList.toggle("cc-prev-bg", on);
      try { tintPrev(); } catch (e9) {}
      syncAllStyleCards(); // the global icon keys changed, so an adopting area card follows
      repaintLogoPrevs();
    }
    var c2LT = logoToggles(c2, {
      getBg: function () { return get("cc.iconbg", "0") === "1"; },
      setBg: function (v) { set("cc.iconbg", v ? "1" : "0"); },
      getBgColor: function () { return get("cc.iconbgcolor", ""); },
      setBgColor: function (v) { set("cc.iconbgcolor", v); },
      getTint: function () { return tintOnAt("cc."); },
      setTint: function (v) { set("cc.icontint", v ? "1" : "0"); },
      getColor: function () { return get("cc.iconcolor", ""); },
      setColor: function (v) { set("cc.iconcolor", v); },
      // These already read and write the global key, so hideAdoptRow is all it takes to keep this
      // card from showing a second copy of that switch.
      getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
      setAdopt: function (v) { set("cc.iconbgrainbow", v ? "1" : "0"); set("cc.iconadoptsplit", "1"); },
      getAccent: function () { return get("cc.accent", "#FCC419"); },
      onChange: c2OnChange,
      hideAdoptRow: true
    });
    c2LT.strInput.value = String(iconstrength);
    c2LT.strInput.addEventListener("input", function () { iconstrength = parseInt(c2LT.strInput.value, 10); set("cc.iconstrength", c2LT.strInput.value); try { tintPrev(); } catch (e9) {} syncAllStyleCards(); repaintLogoPrevs(); });
    // The tile size is one global key, and its control lives once in the Theming card. This Docker
    // card keeps the preview, which sizePrev() resizes whenever that control changes.
    function tileSizeRow() {
      // the tip goes through `help`, so the icon lands inside the label as it does on every row
      return segRow(T("Kachelgröße", "Tile size"), [["s", T("Klein", "Small"), "IconSizeSmall"], ["m", T("Mittel", "Medium"), "IconSizeMedium"], ["l", T("Groß", "Large"), "IconSizeLarge"]], get("cc.sgsize", "m"), function (v) { set("cc.sgsize", v); try { sizePrev(); } catch (e) {} }, T("Gilt global: dieselbe Größe steuert das Einstellungen- und Werkzeuge-Raster und die Docker- und Plugin-Logos.", "Global: the same size drives the Settings and Tools grid and the Docker and Plugin logos."));
    }
    c2.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
    var dockPrev = logoPreview("docker", "cc-set-dockprev");
    var tprevWrap = dockPrev.el;
    // the preview logos take the size the tile-size control selects, so a change shows at once
    function sizePrev() { tintPrev(); }
    // Up to four real container logos, from the Docker tab's own row fragment; the plugin's logo
    // is the fallback when the tab has nothing to show. The name rides along, since the pipeline
    // needs it to look a glyph up and to honour a per-container pin.
    rowIcons("docker", 4).then(function (l9) {
      (l9 || []).forEach(function (it9) { dockPrev.add(it9.src, it9.name || ""); });
      if (!dockPrev.count()) dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", "");
      tintPrev();
    }).catch(function () { dockPrev.add("/plugins/cannonadecommand/images/cannonadecommand.png", ""); tintPrev(); });
    function tintPrev() {
      dockPrev.set({ bg: get("cc.iconbg", "0") === "1", bgColor: get("cc.iconbgcolor", ""), tint: tintOnAt("cc."), color: get("cc.iconcolor", ""), adopt: get("cc.iconbgrainbow", "0") === "1", strength: parseInt(get("cc.iconstrength", "100"), 10) || 100, accent: get("cc.accent", "#FCC419") });
    }
    c2.appendChild(tprevWrap); tintPrev(); c2OnChange(); sizePrev();   // the preview is the card's last block, sized to the tile-size control
    wrap.appendChild(c2);
    // Docker's logo card stands in for an area logo card, so it shows only with an exception too.
    var showC2 = function (own) { c2.classList.toggle("cc-set-off", !own); };
    showC2(localStorage.getItem("cc.styledocker") === "0");
    (areaSync["cc.styledocker"] = areaSync["cc.styledocker"] || []).push(showC2);

    // The containers pinned to their original logo, the same pin their Startplan window sets. It
    // stands outside the Logos card, which hides while Docker follows the global colour.
    var cOrig = card(T("Original-Logos", "Original logos"));
    wrap.appendChild(cOrig);
    var origNames = [], origMissing = {}, origChecked = false;
    // Unraid keeps a container's logo only after it downloaded the template's icon once, so a dead
    // icon address leaves its question-mark stand-in in the row and the pin has nothing to show.
    function checkOriginals() {
      if (origChecked) return;
      origChecked = true;
      rowIcons("docker", 1000).then(function (list) {
        list.forEach(function (it) { if (it.name) origMissing[it.name] = /\/question\.png(\?|$)/.test(it.src); });
        paintOriginals();
      });
    }
    function paintOriginals() {
      var Ci = window.CCTheme && window.CCTheme.icons;
      if (!Ci) return;
      Array.prototype.slice.call(cOrig.querySelectorAll(".cc-set-row")).forEach(function (r) { r.parentNode.removeChild(r); });
      var all = Ci.overrides(), pinned = [];
      Object.keys(all).forEach(function (k) { if (all[k] === "original" && k.indexOf("docker:") === 0) pinned.push(k.slice(7)); });
      var shown = function (low) { return origNames.filter(function (n) { return n.toLowerCase() === low; })[0] || low; };
      var lead = el("div", "cc-set-row"), lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, pinned.length ? T("Diese Container zeigen ihr eigenes Logo:", "These containers show their own logo:") : T("Kein Container zeigt sein Original-Logo", "No container shows its original logo")));
      lw.appendChild(infoIcon(T("Ein Container mit Original-Logo zeigt sein Logo genau wie geliefert: nie durch ein anderes ersetzt und nie eingefärbt. Dieselbe Wahl gibt es im Startplan-Fenster des Containers unter „Icon-Färbung“.", "A container with its original logo shows that logo exactly as it ships: never swapped for another and never tinted. The same choice sits in the container's Start plan window under “Icon colouring”.")));
      lead.appendChild(lw); cOrig.appendChild(lead);
      pinned.sort().forEach(function (low) {
        var row = el("div", "cc-set-row cc-set-inline cc-set-origrow"), nm = el("span", "cc-set-lblwrap");
        var real = shown(low);
        nm.appendChild(el("span", null, real));
        checkOriginals();
        if (origMissing[real]) {
          var miss = el("span", "cc-set-colstate", T("Kein eigenes Logo vorhanden", "No logo of its own"));
          miss.appendChild(infoIcon(T("Die Logo-Adresse im Template dieses Containers antwortet nicht, deshalb hat Unraid nie ein Logo gespeichert. Trag im Container unter „Symbol-URL“ eine Adresse ein, die ein Bild liefert; danach erscheint es hier als Original-Logo.", "The icon address in this container's template does not answer, so Unraid never stored a logo. Enter an address that serves a picture under “Icon URL” in the container; it then shows here as the original logo.")));
          nm.appendChild(miss);
        }
        row.appendChild(nm);
        row.appendChild(actionBtn(T("Entfernen", "Remove"), "cc-btn", function () { Ci.setOverride("docker", low, ""); paintOriginals(); tintPrev(); }));
        cOrig.appendChild(row);
      });
      var free = origNames.filter(function (n) { return pinned.indexOf(n.toLowerCase()) < 0; });
      if (free.length) {
        var add = el("div", "cc-set-row cc-set-origadd"), addL = add.appendChild(el("span", "cc-set-rl", T("Ausnahme hinzufügen", "Add an exception")));
        addL.appendChild(infoIcon(T("Gibt einem Container sein Original-Logo.", "Gives a container its original logo.")));
        add.appendChild(areaPicker(T("Container wählen", "Choose a container"), free.map(function (n) { return [n, n, n]; }), function (it) { Ci.setOverride("docker", it[0], "original"); paintOriginals(); tintPrev(); }));
        cOrig.appendChild(add);
      }
    }
    paintOriginals();
    apiRead("state").then(function (st) {
      origNames = ((st && st.containers) || []).map(function (c) { return c.name; }).filter(Boolean).sort(function (a, b) { return a.localeCompare(b); });
      paintOriginals();
    }).catch(function () {});

    var c3 = card(T("Spalten / Badges je Ansicht", "Columns / badges per view"), T("Welche Badges in der einfachen und in der erweiterten Ansicht erscheinen.", "Which badges appear in the basic and the advanced view."));
    var tbl = el("table", "cc-set-tbl");
    var thr = el("tr"); thr.appendChild(el("th")); thr.appendChild(thc(T("Einfach", "Basic"))); thr.appendChild(thc(T("Erweitert", "Advanced"))); tbl.appendChild(thr);
    COLS.forEach(function (c, i) {
      var tr = el("tr"), hue = window.CCTheme ? window.CCTheme.rbColor(i, accent) : accent;   // one palette position per column
      tr.appendChild(el("td", "cc-set-cname", c.label)).appendChild(infoIcon(c.help));
      tr.appendChild(chkCell(c.key, "s", hue)); tr.appendChild(chkCell(c.key, "a", hue)); tbl.appendChild(tr);
    });
    c3.appendChild(tbl);
    wrap.appendChild(c3);

    function shapeName(v) { return window.CCTheme ? window.CCTheme.shapeName(v) : (v === "soft" || v === "rounded" ? "soft" : v === "square" ? "square" : "round"); }
    function applyShape() { document.documentElement.setAttribute("data-cc-shape", shapeName(get("cc.badgeshape", "round"))); }
    applyShape();

    // Notifications are engine-side and saved to the flash.
    var c5 = card(T("Benachrichtigungen", "Notifications"), T("Warnungen bei Watchdog-Neustarts, fehlgeschlagenen Starts und Zeitplan-Fehlern.", "Alerts on watchdog restarts, failed starts and schedule errors."));
    var ntg = toggle(notify.unraid, function (v) {
      notify.unraid = v; notifyDirty = true;
      saveNotify(ntg, function () { notify.unraid = !v; ntg._setOn(!v); });
    });
    c5.appendChild(inlineRow(T("Unraid-Benachrichtigungen", "Unraid notifications"), T("Schickt die Warnungen auch als Unraid-Benachrichtigung.", "Also sends the alerts as Unraid notifications."), ntg));
    var wrow = el("div", "cc-set-row"), wl = wrow.appendChild(el("span", "cc-set-rl", T("Webhook-URL", "Webhook URL")));
    wl.appendChild(infoIcon(T("Eine Adresse, an die jede Warnung zusätzlich geht. Leer heißt aus.", "An address every alert is also sent to. Empty means off.")));
    var win = el("input", "cc-set-txt"); win.id = "cc-set-webhook"; win.type = "url"; win.placeholder = "https://…"; win.value = notify.webhook || "";
    // a render in the meantime replaces the field, so the save looks it up again when it fires
    win.addEventListener("input", function () { notify.webhook = win.value.trim(); notifyDirty = true; afterQuiet("notify", function () { saveNotify(document.getElementById("cc-set-webhook")); }); });
    wrow.appendChild(win); c5.appendChild(wrow);
    wrap.appendChild(c5);

    var c6 = card(T("Bandbreite", "Bandwidth"), T("Schnittstelle im Container, auf der die Limits gesetzt werden. Leer heißt automatisch, also die Default-Route des Containers, und ist die Empfehlung. Pro-Container-Limits stellst du im Docker-Tab ein.", "The interface inside the container the limits are applied to. Blank means automatic, the container's default route, which is the recommendation. Per-container limits are set in the Docker tab."));
    var ifrow = el("div", "cc-set-row"), ifl = ifrow.appendChild(el("span", "cc-set-rl", T("Schnittstelle", "Interface")));
    ifl.appendChild(infoIcon(T("Die Netzwerkschnittstelle im Container, auf der die Limits greifen. Leer heißt automatisch.", "The network interface inside the container the limits act on. Empty means automatic.")));
    var ifin = el("input", "cc-set-txt"); ifin.id = "cc-set-iface"; ifin.type = "text"; ifin.placeholder = T("automatisch", "automatic"); ifin.value = shapeIface; ifin.maxLength = 15; ifin.spellcheck = false; ifin.setAttribute("list", "cc-iface-list");
    var dl = el("datalist"); dl.id = "cc-iface-list"; ["eth0", "eth1", "eth2"].forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
    ifin.addEventListener("input", function () { shapeIface = ifin.value.trim(); shapeDirty = true; afterQuiet("shape", function () { saveShape(document.getElementById("cc-set-iface")); }); });
    ifrow.appendChild(ifin); ifrow.appendChild(dl); c6.appendChild(ifrow);
    wrap.appendChild(c6);

    // A browser fires no storage event in the document that wrote the key, so the header and the
    // shares bar are pushed their new state directly on this page.
    function syncHeaderBar() { try { if (typeof window.ccHeaderApply === "function") window.ccHeaderApply(); } catch (e) {} }
    function syncSharesBar() { try { if (typeof window.ccSharesApply === "function") window.ccSharesApply(); } catch (e) {} }
    function setOwnColour(key, own) {
      localStorage.setItem(key, own ? "0" : "1");
      // An area set apart for the first time starts from the global accent, so its colour does not
      // jump to the built-in default and its picker shows what is in effect.
      var p = ADOPT_PREF[key];
      if (own && p && localStorage.getItem(p + "accent") == null) set(p + "accent", get("cc.accent", "#FCC419"));
      (areaSync[key] || []).forEach(function (f) { f(own); });
      if (styleCardSync[key]) styleCardSync[key]();
      paintExceptions(); syncHeaderBar(); syncSharesBar();
    }
    // An area's colour line, in the words of the Bereichsfarben card on General: the area follows
    // the global colour until it gets an exception, and only then shows badge and logo cards of its own.
    function colourRow(key) {
      var row = el("div", "cc-set-row cc-set-inline cc-set-colour"), lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, T("Farbe", "Colour")));
      lw.appendChild(infoIcon(T("Ohne Ausnahme folgt der Bereich der Badge-Farbe aus Allgemein. Mit einer Ausnahme bekommt er auf diesem Tab eigene Badge- und Logo-Karten.", "Without an exception the area follows the badge colour from General. With one it gets badge and logo cards of its own on this tab.")));
      row.appendChild(lw);
      var end = el("span", "cc-set-colend"), state = el("span", "cc-set-colstate"), dot = el("span", "cc-set-excdot"), word = el("span");
      state.appendChild(dot); state.appendChild(word); end.appendChild(state);
      var btn = actionBtn("", "cc-btn cc-set-xbtn", function () { setOwnColour(key, localStorage.getItem(key) !== "0"); });
      end.appendChild(btn); row.appendChild(end);
      function paint(own) {
        dot.style.background = own ? get(ADOPT_PREF[key] + "accent", "#FCC419") : get("cc.accent", "#FCC419");
        word.textContent = own ? T("Eigene Farbe", "Own colour") : T("Folgt Allgemein", "Follows General");
        btn.textContent = own ? T("Globale Farbe nutzen", "Use the global colour") : T("Ausnahme hinzufügen", "Add an exception");
      }
      paint(localStorage.getItem(key) === "0");
      (areaSync[key] = areaSync[key] || []).push(paint);
      return row;
    }
    // The tabbed-view row reads inverted to its storage: on means the native Unraid sub-tabs,
    // which is the default, and off means the sub-tabs stacked as CC sections. Only an area that
    // has sub-tabs gets one.
    function tabviewRow(area, applyFn) {
      var row = el("div", "cc-set-row cc-set-inline");
      var lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, T("Tabansicht", "Tabbed view")));
      lw.appendChild(infoIcon(T("Aus: die Unterreiter dieses Tabs werden als CannonadeCommand-Abschnitte untereinander gestapelt. Unraids globale Tabansicht ist der Master: steht sie auf „Ohne Tabs“, rendert Unraid überall Abschnitte und dieser Schalter wirkt nicht.", "Off: this tab's sub-tabs stack as CannonadeCommand sections. Unraid's own tabbed view is the master: set to non-tabbed, Unraid renders sections everywhere and this switch has no effect.")));
      row.appendChild(lw);
      row.appendChild(toggle(get("cc.sections." + area, "0") === "0", function (v) { set("cc.sections." + area, v ? "0" : "1"); if (applyFn) applyFn(); }));
      return row;
    }
    var cP = card(T("Stil", "Style"));
    cP.appendChild(colourRow("cc.styleplugin"));
    cP.appendChild(tabviewRow("plugins", syncPluginsBar));
    var cPV = card(T("Ansicht", "View"));
    pluginViewRow(cPV);
    wrapPlugin.appendChild(cPV);
    // Every area carries the same style cards on its own key prefix, which apply while its adopt
    // toggle is off.
    function buildStyleCards(P, into, samples, noLogos) {
      // Picking a colour in an area's card means that area uses its own style, so its adopt
      // toggle goes off; otherwise the read side keeps resolving the global accent and the pick
      // has no visible effect. Turning adopt back on follows the global colour again.
      var ADOPT = { "ccd.": "cc.styledocker", "ccp.": "cc.styleplugin", "ccv.": "cc.stylevms", "cch.": "cc.styleheader", "ccs.": "cc.stylesettings", "cct.": "cc.styletools", "ccsh.": "cc.styleshares", "ccf.": "cc.stylefavorites", "ccm.": "cc.stylemain" };
      var adoptKey = ADOPT[P];
      // The card always shows the effective colour: the global accent while adopt is on, the
      // area's own while it is off, so the fields jump the moment it is flipped.
      function effAcc() { return (adoptKey && localStorage.getItem(adoptKey) !== "0") ? get("cc.accent", "#FCC419") : get(P + "accent", "#FCC419"); }
      var acc = effAcc(), istr = parseInt(get(P + "iconstrength", "100"), 10) || 100;
      function useOwn() {
        if (adoptKey && localStorage.getItem(adoptKey) !== "0") setOwnColour(adoptKey, true);
        else { syncHeaderBar(); syncSharesBar(); }
      }
      var cA = card(T("Badges", "Badges"), T("Akzentfarbe und Farbmodus der Badges.", "Accent colour and colour mode of the badges."));
      var accLabel = T("Akzentfarbe", "Accent colour"), accHelp = T("Die Farbe der Badges in diesem Bereich. Eine Wahl hier gibt dem Bereich eine eigene Farbe.", "The colour of the badges in this area. A pick here gives the area a colour of its own.");
      var pr = colourField(acc, function (v) { acc = v; set(P + "accent", v); useOwn(); paintPv(); });
      // Rainbow and flag are global modes with one palette in the Badges card, and every badge of
      // an area then takes its colour from that palette. The accent has nothing to colour, so a
      // line naming the colour mode stands in its place, and with no setting left the card shows
      // no preview either.
      var palMode = get("cc.rainbow", "0") === "1";
      if (palMode) cA.appendChild(lockRow(accLabel, T("Folgt dem Farbmodus", "Follows the colour mode"), T("Zu den Badges", "Go to Badges"), function () { jumpTo("general", T("Badges", "Badges")); }, accHelp));
      else cA.appendChild(fieldRow(accLabel, accHelp, pr));
      // The header and shares areas restyle Unraid tab bars, so their previews are tab pills, one
      // of them active. Every other area previews what its own tab paints in this colour: names as
      // large badges, values with their key, the Settings and Tools headings, the Favorites tiles.
      var isTabs = P === "cch." || P === "ccsh.";
      var pv = el("div", "cc-set-prev" + (isTabs ? " cc-set-navprev" : ""));
      var activeIx = P === "ccsh." ? 0 : 2; // one active tab, like the real bar
      var pvBadges;
      if (isTabs) {
        var TABS = P === "ccsh."
          ? [T("Benutzer-Freigaben", "User Shares"), T("Laufwerks-Freigaben", "Disk Shares")]
          : [T("Übersicht", "Main"), "Shares", "Docker", "VMs", T("Einstellungen", "Settings"), "Tools"];
        pvBadges = TABS.map(function (nm9) { return el("span", "cc-navtab", nm9); });
        pvBadges[activeIx].classList.add("cc-navtab-on");
      } else {
        var mkName = function (t9) { return el("span", "cc-b cc-b-lg", t9); };
        var mkVal = function (k9, v9) { var b8 = el("span", "cc-b"); if (k9) b8.appendChild(elk(k9)); b8.appendChild(elv(v9)); return b8; };
        var mkTile = function (g9) {
          var t8 = el("span", "cc-set-tile");
          t8.style.width = t8.style.height = "48px"; t8.style.borderRadius = "var(--cc-radius-control)"; t8.style.fontSize = "22px";
          t8.innerHTML = glyph(g9); return t8;
        };
        pvBadges = ({
          "ccd.": function () { return [mkName("nextcloud"), mkVal("CPU", "2/8"), mkVal("RAM", "1.2G"), mkName("plex"), mkVal("IP", ".20.9"), mkVal("Port", "443"), mkName("grafana")]; },
          "ccv.": function () { return [mkName("Windows 11"), mkVal("CPU", "4"), mkVal("RAM", "8G"), mkName("Home Assistant"), mkVal("IP", ".20.30"), mkVal("BW", "100M")]; },
          "ccp.": function () { return [mkVal("Von", "dlandon"), mkVal("Version", "2026.10.01"), mkVal("", "Changelog"), mkVal("Von", "Squid"), mkVal("Version", "2026.09.14"), mkVal("", "Changelog")]; },
          "ccm.": function () { return [mkName(T("Parität", "Parity")), mkVal("", "18 TB"), mkName("Disk 1"), mkVal("", "34 °C"), mkName("Cache"), mkVal("", "1 TB")]; },
          "ccs.": function () { return [mkName(T("Systemeinstellungen", "System Settings")), mkName(T("Netzwerkdienste", "Network Services")), mkName(T("Benutzerwerkzeuge", "User Utilities"))]; },
          "cct.": function () { return [mkName(T("Über", "About")), mkName(T("Systeminformationen", "System Information")), mkName(T("Benutzerwerkzeuge", "User Utilities"))]; },
          "ccf.": function () { return ["Star", "Gear", "Folder"].map(mkTile); }
        })[P]();
      }
      pvBadges.forEach(function (b9) { pv.appendChild(b9); });
      function paintPv() {
        pvBadges.forEach(function (b9, i9) {
          if (isTabs && i9 !== activeIx) return;   // an idle tab keeps its grey pill
          b9.style.setProperty("background", acc, "important"); b9.style.setProperty("color", idealText(acc), "important");
        });
        swMarkRow(pr._row, acc);   // the preset row's tick follows the colour the preview shows
      }
      paintPv();
      if (!palMode) { cA.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview"))); cA.appendChild(pv); }
      // An adopt flip or a global edit repaints this card with the effective colour, and the Logos
      // card below with the effective icon values. cBLT, applyBgClasses and tp are assigned further
      // down, and this refresher only ever runs once buildStyleCards has finished.
      if (adoptKey) styleCardSync[adoptKey] = function () {
        acc = effAcc();
        pr._set(acc, "#FCC419");
        paintPv();
        cBLT.sync();
        cBLT.strInput.value = String(effIconStrength());
        applyBgClasses(); tp();
      };
      into.appendChild(cA);
      var cB = card(T("Logos", "Logos"), T("Logo-Kacheln und Icons einfärben werden getrennt geschaltet, jedes mit seiner eigenen Farbe.", "Logo tiles and Tint icons are switched separately, each with its own colour."));
      // ga() says whether this area adopts: with it on the card reads and previews the global icon
      // values, with it off the area's own. Every change here means the area uses its own style,
      // so the setters below always write the area's own key whatever ga() currently answers.
      function ga() { return !!adoptKey && localStorage.getItem(adoptKey) !== "0"; }
      function bgColorAt(prefix) {
        var c = get(prefix + "iconbgcolor", ""); if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        var ic = get(prefix + "iconcolor", ""); if (/^#[0-9a-f]{6}$/i.test(ic)) return ic;
        return acc;
      }
      function effIconBg() { return (ga() ? get("cc.iconbg", "0") : get(P + "iconbg", P === "ccs." || P === "cct." ? "1" : "0")) === "1"; }
      function effIconStrength() { return parseInt(ga() ? get("cc.iconstrength", "100") : get(P + "iconstrength", "100"), 10) || 100; }
      function applyBgClasses() { var on = effIconBg(); cB.classList.toggle("cc-bg-mode", on); tpw.classList.toggle("cc-prev-bg", on); }
      var cBLT = logoToggles(cB, {
        getBg: effIconBg,
        setBg: function (v) { set(P + "iconbg", v ? "1" : "0"); useOwn(); },
        getBgColor: function () { return ga() ? bgColorAt("cc.") : bgColorAt(P); },
        setBgColor: function (v) { set(P + "iconbgcolor", v); useOwn(); },
        getTint: function () { return ga() ? tintOnAt("cc.") : tintOnAt(P); },
        setTint: function (v) { set(P + "icontint", v ? "1" : "0"); useOwn(); },
        getColor: function () { return ga() ? get("cc.iconcolor", "") : get(P + "iconcolor", ""); },
        setColor: function (v) { set(P + "iconcolor", v); useOwn(); },
        // Adopting the rainbow is a global decision, flipped only on the global logos card, so
        // this answers the global key whatever ga() says: an area's own icon colours and whether
        // they follow the rainbow are separate questions. setAdopt is never called while
        // hideAdoptRow is set, and stays as a no-op in case a caller shows the row again.
        getAdopt: function () { return get("cc.iconbgrainbow", "0") === "1"; },
        setAdopt: function () {},
        getAccent: function () { return acc; },
        onChange: function () { applyBgClasses(); try { tp(); } catch (e9) {} repaintLogoPrevs(); },
        hideAdoptRow: true
      });
      cBLT.strInput.value = String(istr);
      cBLT.strInput.addEventListener("input", function () { set(P + "iconstrength", cBLT.strInput.value); useOwn(); try { tp(); } catch (e9) {} repaintLogoPrevs(); });
      cB.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview")));
      // the pipeline scope this area's items live under, so a per-item pin shows up here too
      var PAREA = { "ccd.": "docker", "ccv.": "vm", "ccp.": "plugin" }[P];   // the areas whose rows carry real per-item logos
      var PSCOPE = PAREA || "docker";
      var pvl = logoPreview(PSCOPE, "cc-set-tint-" + P.replace(/[^a-z]/g, ""));
      var tpw = pvl.el;
      // A sample whose name starts with a font-icon prefix is a glyph, which logoPreview renders
      // as an <i> coloured through CSS; the Settings and Tools tiles pass those rather than
      // raster paths, which is why their sample list looks empty.
      var addSamples = function () { (samples || []).forEach(function (s9) { pvl.add(s9, ""); }); };
      // Docker, VMs and Plugins have real per-item logos, from the same row fragments the global
      // card uses, so the preview shows this box's own. The canned samples are the fallback for a
      // box with none of them, and could never be more than stand-ins anyway.
      if (PAREA && !noLogos) {
        rowIcons(PAREA, 4).then(function (l9) {
          (l9 || []).forEach(function (it9) { pvl.add(it9.src, it9.name || ""); });
          if (!pvl.count()) addSamples();
          tp();
        }).catch(function () { addSamples(); tp(); });
      } else {
        addSamples();
      }
      function tp() {
        var ga9 = ga();
        // The adopt state is the global key, like getAdopt() above, so the preview never
        // disagrees with what that answers.
        pvl.set({
          bg: effIconBg(), bgColor: ga9 ? get("cc.iconbgcolor", "") : get(P + "iconbgcolor", ""),
          tint: ga9 ? tintOnAt("cc.") : tintOnAt(P), color: ga9 ? get("cc.iconcolor", "") : get(P + "iconcolor", ""),
          adopt: get("cc.iconbgrainbow", "0") === "1", strength: effIconStrength(), accent: acc, size: "48px"
        });
      }
      cB.appendChild(tpw); tp(); applyBgClasses();
      // initial paint = the EFFECTIVE values (cA already initialises via effAcc(); run the
      // refresher once so cB starts on the global icon values while adopt is ON, own while OFF)
      if (adoptKey) { try { styleCardSync[adoptKey](); } catch (e9) {} }
      if (!noLogos) into.appendChild(cB); // header tab: badges only, no logo card
      if (adoptKey) {
        var showCards = function (own) { cA.classList.toggle("cc-set-off", !own); cB.classList.toggle("cc-set-off", !own); };
        showCards(localStorage.getItem(adoptKey) === "0");
        (areaSync[adoptKey] = areaSync[adoptKey] || []).push(showCards);
      }
    }
    // The adopt "Stil" card leads every section, followed by the Badges and Logos cards. The menu
    // bar section has the same cards as Plugins and VMs, plus the footer switch and the status
    // island card.
    var cV = card(T("Stil", "Style"));
    cV.appendChild(colourRow("cc.stylevms"));
    cV.appendChild(tabviewRow("vms", syncVmsBar));
    var cH = card(T("Stil", "Style"));
    cH.appendChild(colourRow("cc.styleheader"));
    // The footer bar is hidden by default. header.js applies it, and it sits in the Theming card
    // rather than here: it is one global on/off for a page element, like density and tile size,
    // not part of the header area itself.
    if (themingCard) {
      var cHf = el("div", "cc-set-row cc-set-inline");
      var cHfL = el("span", "cc-set-lblwrap");
      cHfL.appendChild(el("span", null, T("Fußleiste ausblenden", "Hide footer bar")));
      cHfL.appendChild(infoIcon(T("Blendet die untere Statusleiste komplett aus.", "Hides the bottom status bar completely.")));
      cHf.appendChild(cHfL);
      cHf.appendChild(toggle(get("cc.footer", "1") !== "0", function (v) { set("cc.footer", v ? "1" : "0"); syncHeaderBar(); }));
      themingCard.appendChild(cHf);
    }
    var cSh = card(T("Stil", "Style"));
    cSh.appendChild(colourRow("cc.styleshares"));
    cSh.appendChild(tabviewRow("shares", syncSharesBar));
    var cShV = card(T("Ansicht", "View"));
    shareViewRow(cShV);
    wrapShares.appendChild(cShV);
    var cSet = card(T("Stil", "Style"));
    cSet.appendChild(colourRow("cc.stylesettings"));
    // tile size of the /Settings + /Tools grid is the GLOBAL cc.sgsize control in Allgemein (no per-tab copy).
    var cFav = card(T("Stil", "Style"));
    cFav.appendChild(colourRow("cc.stylefavorites"));
    var cStart = card(T("Stil", "Style"));
    cStart.appendChild(colourRow("cc.stylemain"));
    cStart.appendChild(tabviewRow("main", syncSharesBar));
    var cDisks = card(T("Ansicht", "View"));
    diskViewRow(cDisks);
    wrapStart.appendChild(cDisks);
    wrapHeader.appendChild(cH); wrapShares.appendChild(cSh); wrapPlugin.appendChild(cP); wrapVms.appendChild(cV); wrapSettings.appendChild(cSet); wrapFavorites.appendChild(cFav); wrapStart.appendChild(cStart);
    var cTools = card(T("Stil", "Style"));
    cTools.appendChild(colourRow("cc.styletools"));
    wrapTools.appendChild(cTools);
    function syncPluginsBar() { try { if (typeof window.ccPluginsApply === "function") window.ccPluginsApply(); } catch (e) {} }
    function syncVmsBar() { try { if (typeof window.ccVmsApply === "function") window.ccVmsApply(); } catch (e) {} }
    buildStyleCards("cch.", wrapHeader, [], true);
    // Kopfbereich covers the main menu bar AND the top strip: the Status-Insel (top strip)
    // belongs to THIS area. header.js renders it and reads cc.island / cc.tempwarn live.
    (function () {
      var cI = card(T("Status-Insel", "Status island"), T("Die Status-Insel im oberen Streifen gehört zum Kopfbereich.", "The status island in the top strip belongs to the header area."));
      // What the island shows only matters while it is shown, so those rows are shut while it is off.
      var shown = [];
      var gate = function () { var on = get("cc.island", "1") !== "0"; shown.forEach(function (r) { setRowEnabled(r, on); }); };
      cI.appendChild(toggleRow(T("Status-Insel anzeigen", "Show status island"), T("Zeigt oben rechts die Insel mit den Werten des Servers.", "Shows the island with the server's readings at the top right."), get("cc.island", "1") !== "0", function (v) { set("cc.island", v ? "1" : "0"); gate(); syncHeaderBar(); }));
      // one switch per chip; header.js renders them in a fixed order and reads the keys live
      shown.push(cI.appendChild(el("div", "cc-set-lbl", T("Angezeigte Elemente", "Shown elements"))));
      [
        ["uptime", T("Betriebszeit", "Uptime"), T("Wie lange der Server schon läuft.", "How long the server has been running.")],
        ["os", T("Unraid-Edition", "Unraid edition"), T("Welche Unraid-Lizenz der Server hat, etwa Plus oder Pro.", "Which Unraid licence the server has, such as Plus or Pro.")],
        ["version", T("Unraid-Version", "Unraid version"), T("Die Unraid-Version, die gerade läuft.", "The Unraid version that is running.")],
        ["array", T("Array-Zustand", "Array state"), T("Ob das Array gestartet oder gestoppt ist.", "Whether the array is started or stopped.")],
        ["fill", T("Array-Füllstand", "Array usage"), T("Wie voll das Array ist, als Balken mit Prozentwert.", "How full the array is, as a bar with a percentage.")],
        ["ram", T("RAM-Auslastung", "RAM usage"), T("Wie viel Arbeitsspeicher belegt ist.", "How much memory is in use.")],
        ["cpu", T("CPU-Last", "CPU load"), T("Wie stark der Prozessor gerade arbeitet.", "How busy the processor is right now.")],
        ["containers", T("Laufende Container", "Running containers"), T("Wie viele Container laufen und wie viele gestoppt sind.", "How many containers are running and how many are stopped.")],
        ["net", T("Netzwerk-Traffic", "Network traffic"), T("Wie viel der Server gerade empfängt und sendet.", "How much the server is receiving and sending right now.")],
        ["temps", T("Temperaturen", "Temperatures"), T("Die Temperaturen von Prozessor und Mainboard, farbig ab der Warnschwelle.", "The processor and board temperatures, coloured from the warning threshold up.")]
      ].forEach(function (it) {
        shown.push(cI.appendChild(toggleRow(it[1], it[2], get("cc.isl." + it[0], "1") !== "0", function (v) { set("cc.isl." + it[0], v ? "1" : "0"); syncHeaderBar(); })));
      });
      shown.push(cI.appendChild(tempWarnRow(syncHeaderBar)));
      gate();
      wrapHeader.appendChild(cI);
    })();
    // The main-tab icons are markup CC inserts rather than a native element, so they get an on/off
    // of their own. header.js reads the key live and both inserts and removes them on a flip;
    // nothing else clears an icon already in the DOM.
    (function () {
      var cT = card(T("Haupttabs", "Main tabs"), T("Icon (Tabler, MIT-lizenziert) und/oder Text vor jedem Haupttab-Namen (Übersicht, Docker, VMs, …). Beides aus ist möglich, zeigt dann eine leere Pille.", "Icon (Tabler, MIT licensed) and/or text for every main tab label (Dashboard, Docker, VMs, …). Turning both off is possible and shows an empty pill."));
      cT.appendChild(toggleRow(T("Icons anzeigen", "Show icons"), T("Setzt vor jeden Tab der Menüleiste ein kleines Symbol.", "Puts a small icon before every tab in the menu bar."), get("cc.tabicons", "1") !== "0", function (v) { set("cc.tabicons", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      // an icon-only mode beside the icon switch, in the same card, since both fill the same pill
      cT.appendChild(toggleRow(T("Text anzeigen", "Show text"), T("Zeigt den Namen in jedem Tab, ohne ihn bleibt nur das Symbol.", "Shows the name in each tab, without it only the icon stays."), get("cc.tabtext", "1") !== "0", function (v) { set("cc.tabtext", v ? "1" : "0"); try { window.ccTabIcons && window.ccTabIcons(); } catch (e) {} }));
      wrapHeader.appendChild(cT);
    })();
    // The server name's look. header.js reads the cc.brand.* keys live and inlines them, so the
    // real header is the preview. Every control is a dropdown, apart from the colour, which is a
    // picker like every other colour control here.
    (function () {
      var cB = card(T("Servername", "Server name"), T("Aussehen des Servernamens oben links. Änderungen erscheinen live im Kopfbereich.", "Look of the server name at the top left. Changes appear live in the header."));
      // A name for CC's header alone: Unraid's own server name stays as it is, and an empty field
      // shows it again. The field shows it as the placeholder, read where header.js reads it.
      var nmRow = el("div", "cc-set-row"), nmL = el("span", "cc-set-rl", T("Angezeigter Name", "Display name"));
      nmL.appendChild(infoIcon(T("Der Name, den CannonadeCommand oben links im Kopfbereich zeigt. Leer zeigt Unraids Servernamen. Unraids eigener Servername bleibt dabei, wie er ist.", "The name CannonadeCommand shows at the top left of the header. Empty shows Unraid's server name. Unraid's own server name stays as it is.")));
      var nmIn = el("input", "cc-set-txt"); nmIn.id = "cc-set-brandname"; nmIn.type = "text"; nmIn.maxLength = 40; nmIn.spellcheck = false;
      nmIn.value = get("cc.brand.name", ""); nmIn.placeholder = (document.title.split("/")[0] || "").trim() || "Unraid";
      nmIn.addEventListener("input", function () { var v = nmIn.value.trim(); if (v) set("cc.brand.name", v); else del("cc.brand.name"); syncHeaderBar(); });
      nmRow.appendChild(nmL); nmRow.appendChild(nmIn); cB.appendChild(nmRow);
      var SZ = ["16", "18", "20", "22", "24", "26", "28", "30", "32", "36", "40", "44", "48", "56", "64"].map(function (s) { return [s, s + " px"]; });
      cB.appendChild(dropRow(T("Größe", "Size"), SZ, get("cc.brand.size", "30"), function (v) { set("cc.brand.size", v); syncHeaderBar(); },
        T("Die Schriftgröße des Servernamens.", "The font size of the server name.")));
      cB.appendChild(dropRow(T("Stärke", "Weight"), [["300", T("Dünn", "Thin"), "IconWeightThin"], ["400", "Normal", "IconWeightRegular"], ["500", "Medium", "IconWeightMedium"], ["650", T("Halbfett", "Semibold"), "IconWeightSemibold"], ["800", T("Fett", "Bold"), "IconWeightBold"]], get("cc.brand.weight", "650"), function (v) { set("cc.brand.weight", v); syncHeaderBar(); },
        T("Wie kräftig der Servername geschrieben ist.", "How heavy the server name is set.")));
      cB.appendChild(dropRow(T("Kursiv", "Italic"), [["0", T("Normal", "Normal"), "IconUpright"], ["1", T("Kursiv", "Italic"), "IconItalic"]], get("cc.brand.italic", "0"), function (v) { set("cc.brand.italic", v); syncHeaderBar(); },
        T("Stellt den Servernamen schräg.", "Sets the server name in italics.")));
      // System faces, which render where the client has them. The Google families below are
      // downloaded, so they render anywhere.
      var SYS = [
        ['Arial,Helvetica,sans-serif', "Arial"],
        ['"Arial Black",Gadget,sans-serif', "Arial Black"],
        ['Bahnschrift,"DIN",sans-serif', "Bahnschrift"],
        ['Baskerville,"Baskerville Old Face",serif', "Baskerville"],
        ['"Bodoni MT","Didot",serif', "Bodoni"],
        ['"Book Antiqua","Palatino Linotype",serif', "Book Antiqua"],
        ['Calibri,"Segoe UI",sans-serif', "Calibri"],
        ['Cambria,Georgia,serif', "Cambria"],
        ['Candara,"Segoe UI",sans-serif', "Candara"],
        ['"Cascadia Code","Cascadia Mono",Consolas,monospace', "Cascadia"],
        ['"Century Gothic","Apple Gothic",sans-serif', "Century Gothic"],
        ['Consolas,"Lucida Console",monospace', "Consolas"],
        ['Constantia,Georgia,serif', "Constantia"],
        ['Corbel,"Segoe UI",sans-serif', "Corbel"],
        ['"Courier New",Courier,monospace', "Courier New"],
        ['Didot,"Bodoni MT",serif', "Didot"],
        ['"Franklin Gothic Medium","Arial Narrow",sans-serif', "Franklin Gothic"],
        ['Futura,"Trebuchet MS",sans-serif', "Futura"],
        ['Garamond,"Times New Roman",serif', "Garamond"],
        ['Geneva,Verdana,sans-serif', "Geneva"],
        ['Georgia,"Times New Roman",serif', "Georgia"],
        ['"Gill Sans","Gill Sans MT",sans-serif', "Gill Sans"],
        ['"Helvetica Neue",Helvetica,Arial,sans-serif', "Helvetica Neue"],
        ['"Hoefler Text",Georgia,serif', "Hoefler Text"],
        ['Impact,Charcoal,sans-serif', "Impact"],
        ['"Lucida Console",Monaco,monospace', "Lucida Console"],
        ['Menlo,Monaco,monospace', "Menlo"],
        ['Monaco,"Lucida Console",monospace', "Monaco"],
        ['Optima,Segoe,sans-serif', "Optima"],
        ['"Palatino Linotype","Book Antiqua",Palatino,serif', "Palatino"],
        ['Perpetua,Georgia,serif', "Perpetua"],
        ['"Segoe UI",system-ui,sans-serif', "Segoe UI"],
        ['Tahoma,Geneva,sans-serif', "Tahoma"],
        ['"Times New Roman",Times,serif', "Times New Roman"],
        ['"Trebuchet MS",Helvetica,sans-serif', "Trebuchet MS"],
        ['Verdana,Geneva,sans-serif', "Verdana"]
      ];
      var GF = (window.CCTheme && window.CCTheme.gfonts) ? window.CCTheme.gfonts : [];
      var rest = SYS.slice();
      GF.forEach(function (gf) { var val = '"' + gf[0] + '",' + gf[1]; rest.push([val, gf[0], val]); }); // Google faces (always render)
      rest.sort(function (a, b) { return a[1].localeCompare(b[1]); });   // system and Google faces in one alphabetical list
      var FONTS = [["", T("Standard", "Default")], ['system-ui,-apple-system,"Segoe UI",sans-serif', "System"]]
        .concat(rest).map(function (f) { return [f[0], f[1], f[2] || f[0]]; }); // o[2] = self-preview face
      // load the Google faces so their dropdown previews (and any chosen one on this page) actually render
      try { if (window.CCTheme && window.CCTheme.loadGFonts) window.CCTheme.loadGFonts(GF.map(function (gf) { return gf[0]; })); } catch (e) {}
      cB.appendChild(dropRow(T("Schriftart", "Font"), FONTS, get("cc.brand.font", ""), function (v) { set("cc.brand.font", v); syncHeaderBar(); },
        T("Die Schrift des Servernamens. Standard nimmt Unraids eigene.", "The server name's font. Default uses Unraid's own.")));
      var brandCol = colourField(get("cc.brand.color", ""), function (v) { if (v) set("cc.brand.color", v); else del("cc.brand.color"); syncHeaderBar(); }, { fallback: "#f4f4f4", placeholder: "#F4F4F4", clearable: true });
      cB.appendChild(fieldRow(T("Farbe", "Colour"), T("Ein leeres Hex-Feld lässt den Namen in der hellen Standardfarbe.", "An empty hex field leaves the name in the light default colour."), brandCol));
      wrapHeader.appendChild(cB);
    })();
    // One show-and-hide per utility icon in the top right; on means visible. header.js stamps a
    // class per key, which the sheet hides the matching button on. The keys are the native button
    // classes.
    (function () {
      var cIc = card(T("Kopf-Icons", "Header icons"), T("Blende einzelne Icons oben rechts aus. Aus heißt versteckt.", "Hide individual icons in the top right. Off means hidden."));
      // The help icon is absent because its inline help moved into the bubbles, and the bell and
      // burger because they are integral: hiding one left its badge without an icon.
      [
        ["lang", T("Sprache", "Language"), T("Zeigt den Knopf, der die Sprache wechselt.", "Shows the button that switches the language.")],
        ["search", T("Suche", "Search"), T("Zeigt den Knopf für die Suche.", "Shows the search button.")],
        ["logout", T("Abmelden", "Logout"), T("Zeigt den Knopf zum Abmelden.", "Shows the button that logs you out.")],
        ["terminal", T("Terminal", "Terminal"), T("Zeigt den Knopf, der ein Terminal auf dem Server öffnet.", "Shows the button that opens a terminal on the server.")],
        ["browse", T("Datei-Verwaltung", "File manager"), T("Zeigt den Knopf, der die Datei-Verwaltung öffnet.", "Shows the button that opens the file manager.")],
        ["feedback", T("Feedback", "Feedback"), T("Zeigt den Knopf, mit dem du Lime Technology Feedback schickst.", "Shows the button that sends feedback to Lime Technology.")],
        ["info", T("Info", "Info"), T("Zeigt den Knopf mit den Systeminfos des Servers.", "Shows the button with the server's system info.")],
        ["log", T("Protokoll", "Log"), T("Zeigt den Knopf, der das Systemprotokoll öffnet.", "Shows the button that opens the system log.")]
      ].forEach(function (ic) {
        cIc.appendChild(toggleRow(ic[1], ic[2], get("cc.hideicon." + ic[0], "0") === "0", function (v) { set("cc.hideicon." + ic[0], v ? "0" : "1"); syncHeaderBar(); }));
      });
      wrapHeader.appendChild(cIc);
    })();
    buildStyleCards("ccsh.", wrapShares, [], true); // the shares tab pills are glyphs, so badges only
    buildStyleCards("ccs.", wrapSettings, ["fa-cog", "fa-globe", "fa-star"], false); // the settings tiles are glyphs, so the preview shows sample ones
    buildStyleCards("cct.", wrapTools, ["fa-wrench", "fa-terminal", "fa-hdd-o"], false);
    buildStyleCards("ccp.", wrapPlugin, ["/plugins/dynamix.plugin.manager/images/dynamix.plugin.manager.png", "/plugins/dynamix.docker.manager/images/dynamix.docker.manager.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccv.", wrapVms, ["/plugins/dynamix.vm.manager/templates/images/linux.png", "/plugins/dynamix.vm.manager/templates/images/windows.png", "/plugins/cannonadecommand/images/cannonadecommand.png"]);
    buildStyleCards("ccf.", wrapFavorites, ["fa-star", "fa-heart", "fa-cog"], false); // glyph tiles again
    buildStyleCards("ccm.", wrapStart, [], true); // /Main has value and name badges but no per-row logos
    // Export, import and reset of every cc-family setting, one row in the Theming card with the
    // three buttons together at its end.
    (function () {
      var cX = themingCard;
      var lblw = el("span", "cc-set-lblwrap");
      lblw.appendChild(el("span", null, T("Sichern & Übertragen", "Backup & transfer")));
      lblw.appendChild(infoIcon(T("Exportiert alle CannonadeCommand-Einstellungen (cc.*-Schlüssel) als JSON-Datei. Der Import schreibt sie zurück und lädt die Seite neu.", "Exports every CannonadeCommand setting (cc.* keys) as a JSON file. Import writes them back and reloads the page.")));
      var ex = el("span", "cc-btn cc-set-xbtn", T("Exportieren", "Export"));
      ex.addEventListener("click", function () {
        try {
          // every cc-family key but cc.stateCache, the same set the engine mirrors
          var blob = new Blob([JSON.stringify(collectUISettings(), null, 2)], { type: "application/json" });
          var a = el("a"); a.href = URL.createObjectURL(blob); a.download = "cannonadecommand-settings.json";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        } catch (e) { failed(ex, T("Export fehlgeschlagen: ", "Export failed: ") + ((e && e.message) || e)); }
      });
      var im = el("span", "cc-btn cc-set-xbtn", T("Importieren", "Import"));
      var fin = el("input"); fin.type = "file"; fin.accept = ".json,application/json"; fin.style.display = "none";
      fin.addEventListener("change", function () {
        var f = fin.files && fin.files[0]; fin.value = ""; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var o = null;
          try { o = JSON.parse(String(rd.result)); } catch (e) { failed(im, T("Keine gültige JSON-Datei.", "Not a valid JSON file.")); return; }
          // it has to be a flat object of cc-family string keys, and never cc.stateCache
          var ks = o && typeof o === "object" && !Array.isArray(o) ? Object.keys(o) : [];
          var bad = ks.filter(function (k) { return !/^cc[a-z]*\./.test(k) || k === "cc.stateCache" || typeof o[k] !== "string"; });
          if (!ks.length || bad.length) { failed(im, T("Ungültiges Format: erwartet wird ein flaches Objekt mit cc.*-Textwerten.", "Invalid format: expected a flat object of cc.* string values.")); return; }
          var w = window.__ccLS || localStorage.setItem.bind(localStorage); // a raw write, bypassing the mirror debounce
          ks.forEach(function (k) { try { w(k, o[k]); } catch (e) {} });
          // The engine mirror is written before the reload: the reloaded page adopts ui_settings
          // from the engine, which would otherwise revert the import.
          withConfigLock(function () {
            return api("GET", "config").then(function (c) {
              if (!c || typeof c !== "object") return;
              var u = c.ui_settings || {};
              ks.forEach(function (k) { u[k] = o[k]; });
              c.ui_settings = u;
              return api("PUT", "config", c);
            });
          }).then(function () { location.reload(); }, function () { location.reload(); });
        };
        rd.onerror = function () { failed(im, T("Datei konnte nicht gelesen werden.", "Could not read the file.")); };
        rd.readAsText(f);
      });
      im.addEventListener("click", function () { fin.click(); });
      // Reset clears every cc.* key and the engine mirror and reloads, after a window has asked.
      // The start plan and the engine config outside ui_settings stay.
      var rs = el("span", "cc-btn cc-set-xbtn", T("Alles zurücksetzen", "Reset all"));   // the colour of Export and Import beside it, never red
      if (window.CCTheme) window.CCTheme.pressable(rs);   // focus comes back here when the window closes
      rs.addEventListener("click", function () {
        if (!window.CCTheme || !window.CCTheme.ask) return;
        window.CCTheme.ask({
          title: T("Alle Einstellungen zurücksetzen?", "Reset all settings?"),
          text: T("Alles, was CannonadeCommand im Browser speichert, also Farben, Form und Bereiche, geht auf den Standard zurück, die Kopie in der Engine auch. Danach lädt die Seite neu. Startplan, Zeitpläne, Limits und Benachrichtigungen bleiben.",
            "Everything CannonadeCommand keeps in the browser, such as colours, shape and areas, goes back to its default, including the engine's copy, and the page reloads. The start plan, schedules, limits and notifications stay."),
          ok: T("Zurücksetzen", "Reset"), cancel: T("Abbrechen", "Cancel"), danger: true, opener: rs, onOk: resetAll
        });
      });
      function resetAll() {
        try {
          var kill = []; for (var i9 = 0; i9 < localStorage.length; i9++) { var k9 = localStorage.key(i9); if (k9 && /^cc[a-z]*\./.test(k9) && k9 !== "cc.stateCache") kill.push(k9); }
          kill.forEach(function (k9) { try { localStorage.removeItem(k9); } catch (e9) {} });
          withConfigLock(function () { return api("GET", "config").then(function (c) { if (!c || typeof c !== "object") return; c.ui_settings = {}; return api("PUT", "config", c); }); })
            .then(function () { location.reload(); }, function () { location.reload(); });
        } catch (e) { failed(rs, T("Zurücksetzen fehlgeschlagen: ", "Reset failed: ") + ((e && e.message) || e)); }
      }
      var brow = el("div", "cc-set-row cc-set-inline"), bend = el("span", "cc-set-colend");
      bend.appendChild(ex); bend.appendChild(im); bend.appendChild(rs);
      brow.appendChild(lblw); brow.appendChild(bend);
      cX.appendChild(brow); cX.appendChild(fin);
    })();
    // The search filters cards and rows across every tab, matching a row's text and the
    // explanations in its bubbles, so a word that only stands in an (i) still finds its row. An
    // empty query restores the tabbed view.
    var searchEmpty = el("div", "cc-set-empty"); searchEmpty.style.display = "none";
    searchEmpty.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3.072a8 8 0 0 1 2.32 11.834l5.387 5.387a1 1 0 0 1 -1.414 1.414l-5.388 -5.387a8 8 0 1 1 -.905 -13.249" /></svg>';
    var emptyText = el("div"), emptyTitle = el("div", "cc-set-empty-t", T("Keine Treffer", "No matches")), emptyHint = el("div", "cc-set-empty-h");
    emptyText.appendChild(emptyTitle); emptyText.appendChild(emptyHint); searchEmpty.appendChild(emptyText);
    main.appendChild(searchEmpty);
    function restore() {
      Array.prototype.forEach.call(root.querySelectorAll(".cc-set-card, .cc-set-row, .cc-set-lbl, .cc-set-prose"), function (e9) { e9.style.removeProperty("display"); });
      searchEmpty.style.display = "none";
      var st9 = localStorage.getItem("cc.settab"), ix9 = 0; SECS.forEach(function (sc9, j9) { if (sc9.id === st9) ix9 = j9; }); showSec(ix9);
    }
    function runFilter(q) {
      var raw = (q || "").trim(); q = raw.toLowerCase();
      if (!q) { restore(); return; }
      // The matches come from every tab, so no tile is the chosen one while a query stands.
      tabBtns.forEach(function (b) { b.classList.remove("cc-set-tab-on"); b.setAttribute("aria-selected", "false"); });
      SECS.forEach(function (sc9) { sc9.w.style.display = ""; });
      var shown = 0;
      Array.prototype.forEach.call(root.querySelectorAll(".cc-set-card"), function (cardEl) {
        var h9 = cardEl.querySelector(".cc-set-h"), titleHit = !!h9 && searchText(h9).indexOf(q) >= 0, any = false;
        Array.prototype.forEach.call(cardEl.querySelectorAll(".cc-set-row, .cc-set-lbl, .cc-set-prose"), function (r9) {
          var hit = titleHit || searchText(r9).indexOf(q) >= 0; r9.style.display = hit ? "" : "none"; if (hit) any = true;
        });
        cardEl.style.display = (titleHit || any) ? "" : "none";
        if (titleHit || any) shown++;
      });
      emptyHint.textContent = T("Keine Einstellung enthält „" + raw + "“.", "No setting contains “" + raw + "”.");
      searchEmpty.style.display = shown ? "none" : "";
    }
    // The Info tab in GlimStone's order: Version, Help, About.
    (function () {
      var cVer = card(T("Version", "Version"));
      cVer.appendChild(versionRow("UI", verLink(CC_VER, REPO)));
      var engine = el("span", "cc-set-ver", "…");
      cVer.appendChild(versionRow("Engine", engine));
      cVer.appendChild(versionRow("GlimStone", verLink(GLS_VER, GLS_REPO)));
      // the version of the daemon that is running, so an update that did not restart it shows
      apiRead("state").then(function (st) {
        if (st && st.version) engine.parentNode.replaceChild(verLink(String(st.version), REPO), engine);
        else engine.textContent = T("unbekannt", "unknown");
      }).catch(function () { engine.textContent = T("nicht erreichbar", "not reachable"); engine.classList.add("cc-set-verbad"); });
      var crow = el("div", "cc-set-btnrow");
      var notes = actionBtn(T("Versionshinweise", "Release notes"), "cc-btn cc-set-xbtn cc-set-notes", function () { openReleaseNotes(notes); });
      var chk = actionBtn(T("Nach Updates suchen", "Check for updates"), "cc-btn cc-set-xbtn cc-set-check", function () { checkUpdates(chk); });
      crow.appendChild(notes); crow.appendChild(chk); cVer.appendChild(crow);
      wrapInfo.appendChild(cVer);

      var cHelp = card(T("Hilfe", "Help"));
      cHelp.appendChild(el("p", "cc-set-prose", T("Probleme, Wünsche oder Vorschläge? Mach gern ein Issue auf GitHub auf, oder schreib eine E-Mail.", "Problems, wishes or suggestions? You're welcome to open an issue on GitHub, or send an email.")));
      var hrow = el("div", "cc-rbtn-rows");
      hrow.appendChild(readmeBtn({ brand: "github", name: "GitHub", mark: BRAND_MARKS.github, href: REPO }));
      hrow.appendChild(readmeBtn({ brand: "house", name: T("E-Mail", "Email"), mark: BRAND_MARKS.mail, href: "mailto:hello@halleluja.design?subject=CannonadeCommand" }));
      var bug = readmeBtn({ brand: "house", name: T("Fehlerbericht", "Bug report"), sub: T("Herunterladen", "Download"), mark: BRAND_MARKS.bug, run: function () { downloadBugReport(bug); } });
      hrow.appendChild(bug);
      cHelp.appendChild(hrow);
      wrapInfo.appendChild(cHelp);

      var cAbout = card(T("Über", "About"));
      cAbout.appendChild(el("p", "cc-set-prose", T("CannonadeCommand ist ein kostenloses Plugin für Unraids Docker-, Plugin- und VM-Tabs, gebaut von einem einzelnen Ritter an Abenden und Wochenenden, ohne Konto, ohne Telemetrie und ohne Werbung.", "CannonadeCommand is a free plugin for Unraid's Docker, Plugins and VM tabs, built by one knight on evenings and weekends, with no accounts, no telemetry and no ads.")));
      cAbout.appendChild(el("p", "cc-set-prose", T("Wenn es sich einen Platz auf deinem Server verdient hat, wirf deinem Ritter eine Münze zu: Das hilft bei den Kosten und hält das Projekt am Leben.", "If it has earned a place on your server, toss a coin to your knight: it helps cover the costs and keeps the project alive.")));
      // The give row in its house form: hosted pages first, the wallet last.
      var give = el("div", "cc-rbtn-rows cc-set-give");
      give.appendChild(readmeBtn({ brand: "coffee", name: "Buy me a coffee", art: BRAND_MARKS.coffee, href: "https://buymeacoffee.com/junkerderprovinz" }));
      give.appendChild(readmeBtn({ brand: "paypal", name: "PayPal", mark: BRAND_MARKS.paypal, href: "https://www.paypal.com/donate/?hosted_button_id=76FVV52TKXTUS" }));
      give.appendChild(readmeBtn({ brand: "bitcoin", name: T("Krypto", "Crypto"), mark: BRAND_MARKS.bitcoin, href: "https://junkerderprovinz.github.io/junkerderprovinz/" }));
      cAbout.appendChild(give);
      wrapInfo.appendChild(cAbout);
    })();
    refreshTabs();
    // cc.settab holds a section id; an older numeric index, or anything unknown, lands on the
    // first section.
    var st0 = localStorage.getItem("cc.settab"), ix0 = 0;
    SECS.forEach(function (sc9, j9) { if (sc9.id === st0) ix0 = j9; });
    showSec(ix0);
    setSearch.addEventListener("input", function () { runFilter(setSearch.value); });
    paintPrev(); paintToggles(); paintSelects(); paintCardHeads();
    if (window.scrollY !== keepY) window.scrollTo(0, keepY);
  }
  // This page's own .cc-dsel dropdowns take the colour mode through the painter every area shares
  // (cc-theme.js); without the stamp each option would show the flat accent in rainbow and flag
  // mode. It runs from the same render step as paintToggles(), so the two cannot drift apart.
  function paintSelects() { try { if (window.CCTheme && window.CCTheme.paintSelects) window.CCTheme.paintSelects(root || document); } catch (e) {} }
  // Notifications and the shaping interface save as they change: a switch at once, reverting when
  // the engine refuses, and a text field once typing has been quiet for a moment, keeping what was
  // typed. Each save reads the live config, changes its own field and writes it back, so the
  // schedules, the watchdogs and the other card's field survive, and a failed read writes nothing.
  function saveConfigField(change) {
    return withConfigLock(function () {
      return api("GET", "config").then(function (c) {
        if (!c || typeof c !== "object") throw new Error("config unreadable");
        change(c);
        return api("PUT", "config", c).then(function () { fullConfig = c; });
      });
    });
  }
  var quietT = {};
  function afterQuiet(key, fn) { clearTimeout(quietT[key]); quietT[key] = setTimeout(fn, 800); }
  function saveNotify(ctl, revert) {
    return saveConfigField(function (c) { c.notify = { unraid: !!notify.unraid, webhook: notify.webhook || "" }; })
      .catch(function () { if (revert) revert(); failed(ctl, T("Nicht gespeichert. Ist die Engine erreichbar?", "Not saved. Is the engine reachable?")); });
  }
  function saveShape(ctl) {
    return saveConfigField(function (c) { c.shape_iface = shapeIface || ""; })
      .catch(function (e) { failed(ctl, /bad shaping interface/.test(String(e && e.message)) ? T("Ungültige Schnittstelle", "Invalid interface") : T("Nicht gespeichert. Ist die Engine erreichbar?", "Not saved. Is the engine reachable?")); });
  }
  // dark text on a light background and white on a dark one, by perceived luminance
  function idealText(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#fff"; var n = parseInt(m[1], 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255) > 0.197 ? "#161616" : "#fff"; }
  // The preview uses the real palette, so it matches what the Docker tab shows.
  function paintPrev() { var p = document.getElementById("cc-set-prev"); if (!p) return; var DEF = (window.CCTheme && window.CCTheme.RB) || ["#FF8389", "#FF832B", "#FCC419", "#6FDC8C", "#3DDBD9", "#1D99F3", "#BE95FF", "#FF7EB6"]; var pal = DEF; try { var fj = get("cc.flagmode", "0") === "1" ? JSON.parse(get("cc.flagpal", "null")) : null; var j = (fj && fj.length) ? fj : JSON.parse(get("cc.rbpal", "null")); if (j && j.length) pal = j; } catch (e) {} if (window.CCTheme && window.CCTheme.surfacePalette) pal = window.CCTheme.surfacePalette(pal, accent); Array.prototype.slice.call(p.children).forEach(function (b, i) { var c = rainbow ? pal[i % pal.length] : accent; b.style.background = c; b.style.color = idealText(c); }); }
  // Every toggle on this page follows the colour engine. In rainbow mode each takes its own slot
  // from the shared seed, as the badges elsewhere do; otherwise the stamp is cleared and the
  // track's CSS falls back through the shared vars to the accent.
  function paintToggles() {
    if (!root) return;
    var rbC = (window.CCTheme && window.CCTheme.rbColor) || function (i, a) { return a; };
    var tgls = root.querySelectorAll(".cc-set-toggle, .cc-set-mode .cc-seg-on");   // the chosen mode wears a colour of its own, like a switch
    for (var i = 0; i < tgls.length; i++) {
      var t = tgls[i];
      if (rainbow) { var c = rbC(i, accent); t.style.setProperty("--cc-rb-c", c); t.style.setProperty("--cc-rb-ct", idealText(c)); }
      else { t.style.removeProperty("--cc-rb-c"); t.style.removeProperty("--cc-rb-ct"); }
    }
    // A lit view sketch wears the colour of the segment chosen above it, so the two always agree.
    Array.prototype.forEach.call(root.querySelectorAll(".cc-set-viewslot"), function (slot) {
      var on = slot.querySelector(".cc-set-mode .cc-seg-on"), c = on ? on.style.getPropertyValue("--cc-rb-c") : "";
      Array.prototype.forEach.call(slot.closest(".cc-set-card").querySelectorAll(".cc-set-vp"), function (fig) {
        if (c && fig.classList.contains("cc-set-vp-on")) fig.style.setProperty("--cc-rb-c", c); else fig.style.removeProperty("--cc-rb-c");
      });
    });
  }
  // A card title counts through the palette from the first card of its own tab, so every tab
  // starts on the same hue. Without rainbow the stamp goes and the badge falls back to the accent.
  function paintCardHeads() {
    var rbC = (window.CCTheme && window.CCTheme.rbColor) || function (i, a) { return a; };
    Array.prototype.forEach.call(root.querySelectorAll(".cc-set-wrap"), function (w) {
      Array.prototype.forEach.call(w.querySelectorAll(".cc-set-card > .cc-set-h"), function (h, i) {
        if (rainbow) { var c = rbC(i, accent); h.style.setProperty("--cc-rb-c", c); h.style.setProperty("--cc-rb-ct", idealText(c)); }
        else { h.style.removeProperty("--cc-rb-c"); h.style.removeProperty("--cc-rb-ct"); }
      });
    });
  }
  // live-highlight the preset swatch that matches the current accent (no re-render)
  function syncSwOn() { Array.prototype.slice.call(document.querySelectorAll("#cc-settings .cc-set-swrow-global")).forEach(function (row) { swMarkRow(row, accent); }); }
  function thc(t) { var e = el("th", null, t); return e; }
  // The badge-visibility matrix is a grid of on/off settings, so each cell is the shared .cc-cb
  // switch, carrying its own badge's colour and the ink for its knob.
  function chkCell(key, v, color) { var td = el("td", "cc-set-chk"); var cb = el("input", "cc-cb"); cb.type = "checkbox"; cb.checked = !!(colview[key] && colview[key][v]); if (rainbow && color) { cb.style.setProperty("--cc-rb-c", color); cb.style.setProperty("--cc-rb-ct", idealText(color)); } cb.addEventListener("change", function () { var cur = colview[key] || { s: true, a: true }; colview[key] = { s: cur.s, a: cur.a }; colview[key][v] = cb.checked; set("cc.colview2", JSON.stringify(colview)); }); td.appendChild(cb); return td; }
  function versionRow(name, value) {
    var row = el("div", "cc-set-row cc-set-inline");
    row.appendChild(el("span", null, name)); row.appendChild(value);
    return row;
  }
  // A version links to its own release page. A build with no release behind it, such as a dev
  // build, shows its name without a link, since the link would lead nowhere.
  function verLink(ver, repo) {
    var v = String(ver || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) return el("span", "cc-set-ver", v);
    var a = el("a", "cc-btn cc-set-ver", "v" + v);
    a.href = repo + "/releases/tag/v" + v; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }
  // The marks on the Info tab's README buttons: Buy Me a Coffee's own artwork, PayPal and Bitcoin
  // from Simple Icons (CC0), GitHub's Octicon (MIT), and GlimStone's envelope and bug glyphs.
  var BRAND_MARKS = {
    coffee: '<svg viewBox="0 0 841.9 245.3"><path fill="var(--cc-mark-ink, var(--cc-brand-coffee))" d="M110.7,113.9c-4.4,1.9-9.4,4.2-15.9,4.2s-5.5-.4-8-1.2l4.5,47.9c.2,2,1.1,3.9,2.5,5.2,1.4,1.4,3.3,2.1,5.2,2.1,0,0,6.3.3,8.5.3s9.1-.3,9.1-.3c1.9,0,3.7-.7,5.2-2.1,1.4-1.4,2.4-3.2,2.5-5.2l4.8-53c-2.1-.7-4.3-1.3-6.7-1.3-4.2,0-7.6,1.5-11.6,3.2h0Z"/><path fill="var(--cc-mark-ink, var(--cc-brand-coffee))" d="M149.7,89.1l-.6-3.5c-.6-3.2-2-6.2-5.1-7.4-1-.3-2.1-.5-2.9-1.3s-1-1.9-1.2-3c-.3-2-.6-4.1-1-6-.3-1.7-.5-3.6-1.3-5.2-1-2.1-3.1-3.3-5.1-4.2-1.1-.4-2.1-.7-3.2-1.1-5.1-1.4-10.5-1.9-15.7-2.2-6.3-.3-12.6-.2-18.9.3-4.7.4-9.6,1-14.1,2.7-1.6.6-3.3,1.4-4.5,2.7-1.5,1.6-2,4.1-.9,6.1.7,1.4,2.1,2.5,3.5,3.1,1.8.9,3.7,1.5,5.8,1.9,5.5,1.3,11.2,1.7,16.8,1.9,6.2.2,12.5,0,18.6-.6,1.5-.2,3.1-.4,4.6-.6,1.8-.3,3-2.8,2.5-4.4-.6-2-2.4-2.8-4.3-2.6-.3,0-.5,0-.9.1h-.2c-.6.1-1.3.2-1.9.2-1.4.1-2.7.3-4.1.4-3,.2-6.1.3-9.1.3s-6,0-9-.3c-1.4,0-2.7-.2-4.1-.3-.6,0-1.3-.1-1.8-.2h-1.4c-1.3-.3-2.5-.5-3.7-.7-.1,0-.2,0-.3-.2s-.1-.2-.1-.3,0-.2.1-.3c0-.1.2-.2.3-.2h0c1.1-.2,2.1-.4,3.2-.6.3,0,.7-.1,1.1-.2h0c.6,0,1.4-.2,2-.2,5.8-.6,11.7-.9,17.6-.6,2.9,0,5.7.2,8.5.5.6,0,1.2.1,1.8.2h1.2c1.4.3,2.8.5,4.1.9,2,.4,4.6.6,5.5,2.9.3.7.4,1.5.5,2.2l.2,1h0c.4,2.2,1,4.6,1.4,6.8v.5c0,.2,0,.3-.2.4,0,.1-.2.2-.3.3s-.3.1-.4.2h-.6c-.9.1-1.8.2-2.7.3-1.8.2-3.5.4-5.4.5-3.5.3-7.2.5-10.7.6h-5.5c-7.3,0-14.4-.4-21.7-1.3-.7,0-1.6-.2-2.4-.3.6,0-.4,0-.6,0-.5,0-1-.1-1.5-.2-1.7-.2-3.3-.5-5-.9-2-.3-4-.2-5.8.9-1.5.9-2.7,2.1-3.4,3.7-.7,1.7-1,3.5-1.4,5.4s-.9,3.7-.6,5.6c.4,4,3.1,7.3,7.1,8,3.6.6,7.3,1.3,11,1.7,14.4,1.8,29,2,43.6.6,1.2-.1,2.4-.2,3.5-.4.3,0,.7,0,1.1.1s.6.3,1,.6.4.6.6,1,.2.7.1,1.2l-.3,3.7c-.7,7.5-1.5,15-2.2,22.5-.7,7.9-1.5,15.7-2.4,23.5-.2,2.2-.4,4.4-.6,6.6-.2,2.1-.2,4.4-.6,6.5-.6,3.4-2.9,5.5-6.1,6.2-3,.6-6,1.1-9,1.1s-6.7-.1-10.1-.1-7.9-.3-10.7-3.1c-2.5-2.5-2.8-6.2-3.1-9.5-.4-4.4-.9-8.7-1.3-13.1l-2.5-24.2-1.6-15.6v-.7c-.2-1.9-1.5-3.7-3.4-3.6-1.7,0-3.6,1.6-3.4,3.6l1.2,11.7,2.4,24.1c.6,6.8,1.4,13.7,2,20.4.1,1.3.2,2.7.4,4,.7,7.2,6,11,12.5,12.1,3.9.6,7.7.7,11.6.9,4.9,0,10,.3,14.8-.6,7.2-1.4,12.6-6.4,13.4-14.1.2-2.2.4-4.5.6-6.7.7-7.4,1.5-14.9,2.2-22.3l2.4-24.2,1.1-11.1c0-.5.3-1.1.6-1.5s.9-.6,1.4-.7c2-.4,4.1-1.2,5.5-2.8,2.4-2.6,2.8-6,1.9-9.4h0ZM72.2,91.6v.4-.4ZM72.5,93.2h.1c0,.1-.1,0-.1,0ZM72.6,93.4c0,.2,0,.1,0,0ZM73,93.7h0ZM142.1,93.3c-.7.7-1.8,1.1-3,1.3-12.4,1.9-24.9,2.9-37.4,2.5-8.9-.3-17.8-1.4-26.6-2.7-.9-.1-1.8-.3-2.4-1-1.2-1.3-.5-3.7-.3-5.4.2-1.4.7-3.2,2.4-3.4,2.5-.3,5.4.7,7.8,1.2,3,.4,5.9.9,8.9,1.1,12.7,1.2,25.6,1.1,38.2-.7,2.4-.3,4.6-.6,6.8-1.1,2-.4,4.3-1.1,5.6,1.1.9,1.5,1,3.5.9,5.1,0,.7-.3,1.4-.9,1.9h0Z"/><path fill="currentColor" fill-rule="evenodd" d="M237.6,134.4c-1,1.8-2.2,3.4-4,4.7-1.7,1.3-3.6,2.5-5.8,3.3-2.2.9-4.5,1.4-6.7,1.7s-4.4.2-6.5,0c-2.1-.3-4-1.1-5.4-2.1l1.7-17.3c1.5-.5,3.4-1.1,5.8-1.6s4.7-1,7.2-1.2,4.8-.2,7,0c2.2.3,4,1,5.2,2.1.6.6,1.3,1.3,1.7,2s.7,1.5.9,2.2c.2,2.2,0,4.3-1.1,6h0ZM213.4,97.6c1.1-.6,2.5-1.3,4-1.8,1.6-.5,3.1-.9,4.8-1.1,1.6-.2,3.2-.2,4.8,0,1.6.1,2.9.5,4.2,1.3,1.2.7,2,1.7,2.7,3.1s.7,3,.4,5.1c-.2,1.6-.9,3-1.9,4.2s-2.4,2-4,2.9c-1.6.7-3.2,1.4-4.9,1.8s-3.4.7-5,1c-1.6.2-3,.3-4.2.4h-2.4l1.6-16.7h0v-.2ZM246.2,123.3c-.9-1.8-2-3.4-3.4-4.8s-3.1-2.4-5-3c.9-.6,1.7-1.7,2.5-3.2s1.5-3.1,2.1-4.8c.5-1.7,1-3.5,1.2-5.2s.1-3.3-.2-4.5c-.9-3.2-2.4-5.7-4.3-7.4-1.9-1.8-4.2-3-6.7-3.7-2.6-.6-5.4-.9-8.5-.4s-6.2,1.2-9.5,2.4v-1.8c0-.7-.4-1.5-1.2-2s-1.7-1-2.8-1.1-2,.1-3,.6c-1,.5-1.6,1.6-2,3-.4,4.7-.9,9.6-1.3,14.8s-.9,10.3-1.4,15.5c-.4,5.2-1,10.4-1.4,15.5-.4,5.1-1,10.1-1.4,14.8.1,1.4.5,2.6,1.2,3.3.6.7,1.4,1.3,2.2,1.4s1.7,0,2.7-.4,1.7-1.2,2.5-2.4c2.1,1.2,4.5,1.9,7.2,2.2s5.4.3,8,0,5.5-1,8-1.9c2.7-1,5-2.1,7.2-3.5s4-3,5.5-4.8,2.5-3.7,2.9-5.9.6-4.3.4-6.4c-.2-2.1-.7-4.2-1.6-6h.2Z"/><path fill="currentColor" fill-rule="evenodd" d="M323.5,164.9c-.3,1.7-.6,3.5-1.2,5.5s-1.2,3.6-1.8,5.2c-.7,1.6-1.5,2.9-2.4,3.9-.9,1-1.8,1.4-2.8,1.2-.7-.1-1.3-.6-1.5-1.5-.2-.9-.2-2,0-3.3s.6-2.8,1.2-4.5c.6-1.6,1.4-3.3,2.2-4.9.9-1.6,1.8-3.2,3-4.7,1.1-1.5,2.2-2.8,3.5-3.7.2.3.4,1.1.3,2.4s-.2,2.8-.4,4.5h-.2ZM350.4,130.6c-.7-.7-1.6-1.3-2.7-1.3-1.1-.1-2,.4-3.1,1.7-.6,1.3-1.6,2.5-2.7,3.6-1.1,1.2-2.1,2.2-3.3,3.2s-2.2,1.7-3.2,2.5c-1.1.6-1.8,1.2-2.5,1.5-.2-1.7-.3-3.5-.3-5.5s0-4,.1-5.9c.1-2.9.5-5.7,1-8.6s1.2-5.8,2.1-8.6c0-1.5-.3-2.7-1.1-3.6-.6-1-1.5-1.5-2.5-1.7s-2-.1-3,.4-1.9,1.4-2.7,2.7c-.6,1.7-1.4,3.7-2.1,5.9-.9,2.1-1.7,4.4-2.8,6.6s-2.1,4.4-3.4,6.5-2.7,4-4.2,5.6-3.1,2.9-4.9,3.9c-1.8,1-3.6,1.3-5.8,1.2-1-.2-1.6-1-2-2.1s-.6-2.6-.7-4.4,0-3.6.2-5.8.5-4.2,1-6.2.9-4,1.3-5.9,1-3.4,1.4-4.7c.6-1.5.6-2.8,0-3.9s-1.5-1.7-2.6-2-2.2-.3-3.5,0c-1.2.3-2.1,1.2-2.6,2.5-.9,2.1-1.7,4.6-2.5,7.3s-1.3,5.5-1.8,8.3c-.4,2.9-.7,5.7-.7,8.6v.5c-1.2,3.1-2.2,5.4-3.3,7-1.4,2-2.9,2.9-4.6,2.6-.7-.3-1.2-1.1-1.5-2.2-.2-1.2-.3-2.6-.2-4.3,0-1.7.3-3.6.6-5.8.3-2.1.7-4.4,1.2-6.6.5-2.2,1-4.6,1.5-7s1-4.5,1.4-6.5c0-1.8-.6-3.2-1.6-4.3s-2.5-1.4-4.3-1.2c-1.3.5-2.2,1.2-2.8,2s-1.1,1.9-1.5,3.2c-.2.6-.5,2-1,4.1s-1,4.4-1.6,7.1-1.5,5.5-2.4,8.3c-.9,2.9-1.9,5.6-3,7.8-1.1,2.4-2.4,4.3-3.6,5.7s-2.8,2-4.3,1.7c-.9-.1-1.4-1.1-1.6-2.6s-.3-3.5-.1-5.9.4-4.8,1-7.6c.4-2.8,1-5.4,1.5-7.9.5-2.5,1-4.7,1.4-6.5.4-1.9.7-3.2.9-3.7,0-1.5-.3-2.8-1.1-3.6s-1.5-1.5-2.5-1.7-2-.1-3,.4c-1.1.5-1.9,1.4-2.7,2.7-.2,1.4-.6,3.1-1.1,4.9-.4,1.9-.9,3.7-1.2,5.8s-.7,3.9-1.1,5.8-.6,3.5-.7,4.9c-.1,1.1-.2,2.5-.3,4.1s-.2,3.3-.2,5.1.1,3.5.4,5.4c.2,1.7.7,3.4,1.4,4.8s1.6,2.7,2.9,3.6,2.8,1.5,4.7,1.6c1.9.1,3.6,0,5.1-.4s2.8-1.1,4-1.8c1.2-.9,2.2-1.8,3.2-3s1.9-2.5,2.9-3.7c.9,2,2,3.5,3.5,4.7,1.4,1.1,2.9,1.7,4.5,1.9s3.2,0,4.8-.6,3.1-1.8,4.4-3.3c.9-1,1.7-2,2.5-3.3.3.5.6,1.1,1.1,1.6,1.3,1.7,3.1,2.9,5.2,3.4,2.4.6,4.7.7,7,.3s4.4-1.2,6.5-2.2c2-1.1,4-2.5,5.8-4s3.3-3.2,4.6-4.8v7c-2.7,1.8-5.1,4.1-7.5,6.6s-4.4,5.4-6.2,8.2c-1.7,2.9-3.2,5.9-4.2,8.9s-1.5,5.8-1.5,8.5.6,4.9,1.8,6.8c1.2,1.9,3.2,3.3,6,4.2,2.9.9,5.4,1,7.5,0,2.1-.9,4.1-2.2,5.7-4.2,1.6-1.9,2.9-4.3,4-7.1s1.8-5.7,2.5-8.7c.6-3,1-6,1.2-8.9s.1-5.5,0-7.7c4.5-1.9,8.2-4.3,11.1-7.2,2.9-2.9,5.4-6,7.2-9.2.5-.7.7-1.7.6-2.9-.2-1.1-.6-2-1.4-2.9h0v.3Z"/><path fill="currentColor" fill-rule="evenodd" d="M450.4,125.6c.1-1.2.4-2.5.7-3.9s.7-2.7,1.2-3.9c.4-1.3,1.1-2.4,1.7-3.3s1.3-1.6,2-2,1.4-.3,2.1.1,1.3,1.5,1.5,3c.2,1.5,0,3.2-.5,4.9s-1.5,3.3-3,4.9c-1.4,1.5-3.3,2.6-5.8,3-.1-.7,0-1.7,0-2.9h0ZM477.9,128.8c-.9-.2-1.7-.3-2.5,0-.7.2-1.3.7-1.5,1.6-.4,1.7-1.1,3.4-2,5.1s-2,3.4-3.4,5c-1.4,1.6-2.9,3-4.6,4.2-1.7,1.2-3.4,2-5.4,2.6-1.8.5-3.4.6-4.6.2-1.2-.4-2.1-1.2-2.9-2.2s-1.2-2.4-1.5-3.9c-.3-1.5-.5-3.1-.5-4.7,3,.2,5.7-.3,8-1.6s4.4-3,6-5.1,2.9-4.5,3.7-7.2,1.3-5.4,1.4-7.9c0-2.5-.3-4.6-1.1-6.3s-1.8-3-3.2-4-2.9-1.5-4.6-1.6c-1.7-.1-3.5,0-5.4.7-2.1.7-4,1.9-5.5,3.6s-2.8,3.6-3.7,5.8-1.8,4.5-2.4,7.1-1,5-1.3,7.5c-.2,2.1-.3,4.3-.4,6.3-.1.2-.2.5-.3.7-.9,1.9-1.8,3.7-2.9,5.5s-2.2,3.3-3.6,4.5c-1.3,1.2-2.7,1.6-4.2,1.3-.9-.2-1.3-1.2-1.4-2.9,0-1.7,0-3.9.3-6.4.2-2.6.5-5.4,1-8.3.3-3,.5-5.9.5-8.6s-.4-4.6-1.4-6.8c-.9-2.1-2.1-4-3.6-5.5-1.6-1.5-3.3-2.4-5.5-2.9-2-.4-4.3-.1-6.6,1s-4.3,2.7-5.7,4.7-2.7,4.1-3.9,6.3c-.4-1.7-1.1-3.2-1.8-4.7-.9-1.5-1.8-2.7-3-3.7s-2.6-1.9-4-2.6-3-1-4.7-1-3.1.3-4.4,1c-1.4.6-2.6,1.4-3.7,2.4-1.1,1-2.1,2-3,3.2s-1.7,2.4-2.4,3.5c-.1-1.4-.2-2.6-.3-3.6s-.4-1.9-.7-2.6-.9-1.3-1.5-1.6-1.5-.5-2.7-.5-1.2.1-1.7.3-1.1.5-1.5,1-.7,1-1.1,1.5-.3,1.3-.2,2.1c0,.5.2,1.3.4,2.1.2.9.4,1.9.6,3.2s.4,2.9.5,4.8.2,4.2.1,6.8c0,2.7-.2,5.9-.6,9.5-.3,3.6-.9,7.8-1.6,12.6-.1,1.1.3,2,1.3,2.7s2,1.1,3.2,1.2,2.4-.1,3.4-.6,1.7-1.5,1.8-2.8c.1-2.5.4-5.1,1-7.9.4-2.8,1-5.6,1.7-8.3s1.4-5.4,2.2-7.8c.9-2.5,1.8-4.7,2.8-6.5,1.1-1.9,2.1-3.4,3.2-4.5,1.1-1.2,2.2-1.7,3.5-1.7s2.7.6,3.4,2c.9,1.4,1.4,3.1,1.7,5.1.3,2.1.5,4.4.4,7s-.1,4.9-.3,7.3c-.2,2.4-.4,4.4-.6,6.2s-.4,3.1-.5,3.7c0,1.2.4,2.1,1.4,2.9s1.9,1.2,3.1,1.3c1.2.1,2.2,0,3.2-.6s1.6-1.5,1.7-2.8c.5-3.7,1.3-7.6,2.1-11.5,1-3.9,2-7.3,3.2-10.3,1.2-3,2.5-5.5,4-7.4,1.5-1.9,3-2.9,4.6-2.9s1.5.5,1.9,1.7.6,2.8.6,4.7-.1,3-.3,4.5c-.2,1.6-.5,3.2-.9,4.8s-.6,3.3-.9,5.1-.3,3.5-.3,5.5.1,2.9.4,4.6.7,3.4,1.5,4.9c.7,1.6,1.7,2.9,3.1,4s3,1.6,4.9,1.6c3,0,5.7-.6,8-1.9s4.3-3,6-5c0-.1.1-.2.2-.3.1.3.2.6.4,1,1.2,2.4,2.7,4.1,4.6,5.4s4.3,1.9,7,2.1c2.7.1,5.6-.3,8.7-1.5,2.4-.9,4.4-1.9,6.1-3.2s3.2-2.8,4.6-4.6,2.7-3.9,3.7-6.3,2.2-5.1,3.4-8.1c.2-.9,0-1.6-.5-2.2-.6-.6-1.4-1.1-2.2-1.4h0v-.5Z"/><path fill="currentColor" fill-rule="evenodd" d="M521,120.1c-.2,1.6-.6,3.2-1.1,5.1s-1.1,3.9-1.7,5.8c-.6,2-1.5,3.9-2.6,5.5-1,1.6-2.1,2.9-3.4,3.9-1.3,1-2.8,1.3-4.5,1.2-.9-.1-1.5-.6-1.9-1.7s-.6-2.4-.7-4.1c0-1.6.1-3.4.4-5.4s.9-3.9,1.5-5.8,1.5-3.6,2.5-5.1c1-1.6,2-2.8,3.3-3.6s2.6-1.3,4.1-1.2c1.5,0,3.1.7,4.8,2.2-.1.6-.3,1.8-.5,3.3h-.1ZM549.2,126c-.9-.4-1.6-.5-2.6-.3-.9.2-1.5,1.1-1.8,2.4-.2,1.5-.6,3.2-1.4,5.2-.7,2-1.6,3.9-2.8,5.7-1.1,1.8-2.4,3.3-3.7,4.5-1.4,1.2-2.9,1.7-4.5,1.6-1.3-.1-2.2-.7-2.8-2s-.9-2.8-.9-4.7.1-4,.5-6.3.9-4.7,1.4-7,1.1-4.5,1.7-6.6c.5-2.1,1.1-4,1.4-5.5.4-1.3.3-2.5-.4-3.3-.6-1-1.5-1.6-2.6-1.9-1.1-.4-2-.5-3.1-.3s-1.7.7-2,1.7c-3.1-2.7-6.1-4.2-9-4.4s-5.6.4-7.9,1.9c-2.5,1.5-4.6,3.6-6.4,6.4-1.9,2.8-3.4,5.9-4.6,9.1s-1.9,6.6-2.1,10.1c-.3,3.4,0,6.5.6,9.4.7,2.8,2,5.1,4,7,1.9,1.8,4.4,2.7,7.6,2.7s2.8-.3,4.2-.9,2.6-1.3,3.6-2,2.1-1.6,2.9-2.5,1.5-1.6,2-2.1c.3,1.9,1,3.5,1.8,4.8s1.8,2.4,2.9,3.2,2.2,1.5,3.4,1.8c1.2.4,2.4.5,3.4.5,2.5,0,4.8-.9,7-2.6,2.1-1.7,4.1-3.7,5.8-6.2,1.7-2.5,3.1-5,4.3-7.7,1.1-2.7,1.8-5.1,2.2-7.3.3-.7.3-1.6-.2-2.5s-1.2-1.5-2-1.9h.1Z"/><path fill="currentColor" fill-rule="evenodd" d="M691.9,169.7c-.4,1.8-1.2,3.3-2.1,4.5-1,1.3-2.1,1.9-3.5,1.9s-1.6-.4-2-1.4c-.5-1-.9-2.2-1-3.9-.2-1.6-.2-3.3-.2-5.4s0-3.9.2-5.8c.1-1.9.3-3.6.5-5.4.2-1.6.3-2.9.4-3.7,1.8.2,3.3,1,4.5,2.4,1.2,1.3,2.1,2.9,2.8,4.8.6,1.8,1,3.9,1.1,6,0,2.1,0,4.1-.5,5.9h-.1ZM663.2,169.7c-.4,1.8-1.2,3.3-2.1,4.5-1,1.3-2.1,1.9-3.5,1.9s-1.6-.4-2-1.4c-.5-1-.9-2.2-1-3.9-.2-1.6-.2-3.3-.2-5.4s0-3.9.2-5.8c.1-1.9.3-3.6.5-5.4.2-1.6.3-2.9.4-3.7,1.8.2,3.3,1,4.5,2.4,1.2,1.3,2.1,2.9,2.8,4.8.6,1.8,1,3.9,1.1,6,0,2.1,0,4.1-.5,5.9h-.1ZM633.8,124.9c0,1.3-.2,2.4-.3,3.3-.2,1-.4,1.6-.7,1.8-.5-.3-1.3-1.2-2.1-2.5s-1.5-2.8-1.9-4.5-.6-3.3-.4-4.9c.2-1.6,1.1-2.9,2.5-3.7.5-.3,1.1-.2,1.5.3s.7,1.4,1.1,2.4c.2,1.1.4,2.2.5,3.6,0,1.4.1,2.7,0,4h0v.2ZM626.7,140.6c-.9.9-1.7,1.6-2.8,2.2s-2,1.1-3.1,1.4-2,.4-2.9.2c-2.4-.4-4.2-1.5-5.5-3.1s-2-3.4-2.5-5.6c-.3-2.1-.3-4.4.1-6.8.4-2.5,1.2-4.7,2.1-6.7s2.2-3.9,3.6-5.4,3-2.5,4.7-2.8c-.6,2.7-.9,5.5-.6,8.3.2,2.9.9,5.6,2,8.1.7,1.5,1.6,2.9,2.7,4.2s2.2,2.4,3.7,3.2c-.4.9-1.1,1.8-1.8,2.7h.1ZM714.5,125.6c.2-1.2.4-2.5.7-3.9.3-1.3.7-2.7,1.2-3.9.5-1.3,1.1-2.4,1.7-3.3s1.3-1.6,2-2,1.4-.3,2.1.1,1.3,1.5,1.5,3,0,3.2-.5,4.9-1.5,3.3-3,4.9-3.3,2.6-5.8,3v-2.9h0ZM746.4,125.6c.2-1.2.4-2.5.7-3.9.3-1.3.7-2.7,1.2-3.9.5-1.3,1.1-2.4,1.7-3.3s1.3-1.6,2-2,1.4-.3,2.1.1,1.3,1.5,1.5,3,0,3.2-.5,4.9-1.5,3.3-3,4.9c-1.4,1.5-3.3,2.6-5.8,3v-2.9h0ZM776.2,130.2c-.6-.6-1.4-1.1-2.2-1.4s-1.7-.3-2.5,0c-.7.2-1.3.7-1.5,1.6-.4,1.7-1.1,3.4-2,5.1s-2,3.4-3.4,5-2.9,3-4.6,4.2-3.4,2-5.4,2.6c-1.8.5-3.4.6-4.6.2-1.2-.4-2.1-1.2-2.9-2.2s-1.3-2.4-1.5-3.9c-.3-1.5-.5-3.1-.5-4.7,3,.2,5.7-.3,8-1.6s4.4-3,6-5.1,2.9-4.5,3.7-7.2,1.3-5.4,1.4-7.9c0-2.5-.3-4.6-1.1-6.3s-1.8-3-3.2-4-2.9-1.5-4.6-1.6-3.5,0-5.4.7c-2.1.7-4,1.9-5.6,3.6-1.5,1.6-2.8,3.6-3.7,5.8s-1.8,4.5-2.4,7.1-1,5-1.3,7.5c-.2,2.4-.4,4.6-.4,6.8-.2.4-.4.9-.6,1.3-1,1.7-2,3.4-3.4,5s-2.9,3-4.6,4.2-3.4,2-5.4,2.6c-1.8.5-3.4.6-4.6.2-1.2-.4-2.1-1.2-2.9-2.2s-1.3-2.4-1.5-3.9c-.3-1.5-.5-3.1-.5-4.7,3,.2,5.7-.3,8-1.6s4.4-3,6-5.1,2.9-4.5,3.7-7.2,1.3-5.4,1.4-7.9c0-2.5-.3-4.6-1.1-6.3s-1.8-3-3.2-4-2.9-1.5-4.6-1.6-3.5,0-5.4.7c-2.1.7-4,1.9-5.6,3.6-1.5,1.6-2.8,3.6-3.7,5.8s-1.8,4.5-2.4,7.1-1,5-1.3,7.5c-.1,1.4-.2,2.7-.3,4.1-.5.4-1,.9-1.5,1.3-1.8,1.5-3.7,2.8-5.8,4-2,1.2-4.1,2.1-6.2,2.9s-4.4,1.2-6.6,1.4l4.9-52.4c.3-1.1.2-2-.5-2.9s-1.5-1.4-2.5-1.7c-1-.3-2-.3-3.2,0-1.2.4-2,1.2-2.8,2.6-.3,2-.7,4.7-1.2,8.2s-.7,7.3-1.2,11.3-.7,8.3-1.2,12.7c-.4,4.4-.7,8.5-1.1,12.2v.5c-.4.4-.9.7-1.4,1.2-1.8,1.5-3.7,2.8-5.8,4-2,1.2-4.1,2.1-6.2,2.9s-4.4,1.2-6.6,1.4l4.9-52.4c.3-1.1.2-2-.5-2.9s-1.5-1.4-2.5-1.7c-1-.3-2-.3-3.2,0-1.2.4-2,1.2-2.8,2.6-.3,2-.7,4.7-1.2,8.2s-.7,7.3-1.2,11.3-.7,8.3-1.2,12.7c-.4,4.4-.7,8.5-1.1,12.2v.2c-.9.4-1.7.7-2.7,1-1,.3-2.1.4-3.4.5.2-1,.4-2,.5-3.2s.2-2.4.3-3.6v-3.7c0-1.3,0-2.5-.2-3.4-.2-2.2-.7-4.4-1.5-6.4s-1.7-3.7-2.9-5.1c-1.2-1.4-2.8-2.2-4.6-2.8-1.8-.4-4-.3-6.4.4-3.6-.4-6.8-.1-9.7,1-2.9,1.2-5.4,2.8-7.5,4.9s-3.9,4.7-5.1,7.6c-1.4,2.9-2.2,5.9-2.7,9-.2,1.3-.3,2.6-.3,3.9-.9,1.7-1.7,3.1-2.7,4.4-1.4,1.7-2.9,3.2-4.4,4.3-1.5,1.1-3,1.9-4.5,2.6-1.5.5-2.8,1-4,1.2-1.4.2-2.7.3-4,0-1.3-.2-2.5-.9-3.5-1.8-.9-.7-1.5-1.9-1.9-3.5-.4-1.6-.7-3.5-.7-5.6s0-4.3.2-6.5.6-4.4,1.3-6.4c.5-2,1.3-3.9,2.2-5.5.9-1.6,1.9-2.8,3.2-3.4.6.1,1.1.5,1.3,1.2s.2,1.6.1,2.6c0,1-.2,2-.3,3-.2,1.1-.2,1.9-.2,2.6.2,1.4.7,2.6,1.5,3.3s1.6,1.3,2.6,1.4c1,.1,1.9,0,2.8-.6,1-.5,1.7-1.5,2.2-2.8h.2l1.1-10.1c.3-1.4,0-2.6-.6-3.6-.7-1.1-1.7-1.6-2.9-1.8-1.5-2.2-3.6-3.4-6.2-3.5-2.7-.1-5.4.7-8,2.6-1.7,1.2-3.2,2.9-4.5,5s-2.4,4.5-3.2,7.1-1.4,5.4-1.7,8.2-.4,5.7-.2,8.5.7,5.4,1.5,7.7c.7,2.5,1.8,4.5,3.2,6.1,1.2,1.4,2.5,2.5,4,3.1,1.5.6,3,1.1,4.6,1.2s3.2,0,4.8-.2,3.1-.6,4.5-1.2c1.8-.6,3.7-1.6,5.7-2.6,1.9-1.1,3.9-2.4,5.7-3.7,1-.7,1.8-1.6,2.8-2.6.4,1,.9,1.9,1.4,2.9,1.4,2.4,3.3,4.3,5.8,5.8,2.5,1.5,5.5,2.1,9,2.1s7.3-1.1,10.5-2.9c3.2-1.9,5.9-4.6,7.9-8.2,3.1,0,6.1-.5,9.1-1.5v1c-.2,2.8-.3,4.7-.3,5.7,0,1.7-.2,3.9-.3,6.4-.2,2.6-.3,5.2-.3,8s0,5.7.3,8.6c.2,2.9.9,5.5,1.7,7.8s2,4.3,3.6,6c1.6,1.6,3.6,2.6,6.1,2.9,2.7.3,5-.1,7-1.4s3.5-3.1,4.8-5.5c1.2-2.2,2-4.9,2.6-7.9.5-3,.6-6,.4-9.1s-.7-5.9-1.7-8.6-2.1-4.9-3.7-6.6c1-.2,2.1-.7,3.4-1.5s2.7-1.6,4.1-2.5c.3-.2.6-.4,1.1-.6-.1,1.8-.2,3.2-.2,4,0,1.7-.2,3.9-.3,6.4-.2,2.6-.3,5.2-.3,8s0,5.7.3,8.6c.2,2.9.9,5.5,1.7,7.8s2,4.3,3.6,6c1.6,1.6,3.6,2.6,6.1,2.9,2.7.3,5-.1,7-1.4s3.5-3.1,4.8-5.5c1.2-2.2,2-4.9,2.6-7.9.5-3,.6-6,.4-9.1s-.7-5.9-1.7-8.6-2.1-4.9-3.7-6.6c1-.2,2.1-.7,3.4-1.5s2.7-1.6,4.1-2.5c.7-.5,1.5-1,2.1-1.5.3,2.6.9,4.8,1.8,6.7,1.2,2.4,2.7,4.1,4.6,5.4s4.3,1.9,6.8,2.1c2.7.1,5.6-.3,8.7-1.5,2.4-.9,4.4-1.9,6.1-3.2,1.7-1.3,3.2-2.8,4.6-4.6,0-.1.2-.2.2-.3.2.7.5,1.5.9,2.1,1.2,2.4,2.7,4.1,4.6,5.4s4.3,1.9,6.8,2.1c2.7.1,5.6-.3,8.7-1.5,2.4-.9,4.4-1.9,6.1-3.2,1.7-1.3,3.2-2.8,4.6-4.6s2.7-3.9,3.7-6.3c1.2-2.4,2.2-5.1,3.4-8.1.2-.9,0-1.6-.6-2.2h0v-.2Z"/></svg>',
    paypal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></svg>',
    bitcoin: '<svg viewBox="3.961 4.178 15.2 15.2" fill="currentColor"><path d="M17.288 10.291c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"/></svg>',
    github: '<svg viewBox="0 0 20 20" fill="currentColor"><path transform="scale(1.25)" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
    mail: '<svg viewBox="0 0 14 14" class="cc-mark-rest" fill="currentColor"><g><path fill="currentColor" fill-rule="evenodd" d="M0 2.75a1.5 1.5 0 0 1 1.5 -1.5h11a1.5 1.5 0 0 1 1.5 1.5v0.342L7.383 7.504A0.72 0.72 0 0 1 7 7.607a0.72 0.72 0 0 1 -0.383 -0.103L0 3.092V2.75Zm0 1.844v6.656a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5 -1.5V4.594L8.073 8.546l-0.005 0.004A1.966 1.966 0 0 1 7 8.857c-0.375 0 -0.753 -0.102 -1.068 -0.307l-0.005 -0.004L0 4.594Z" clip-rule="evenodd"></path></g></svg><svg viewBox="2 0.32 20 20" class="cc-mark-hover" fill="currentColor"><path d="M4,8L12,13L20,8V8L12,3L4,8V8M22,8V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V8C2,7.27 2.39,6.64 2.97,6.29L12,0.64L21.03,6.29C21.61,6.64 22,7.27 22,8Z" /></svg>',
    bug: '<svg viewBox="0.05 0.05 13.9 13.9" fill="currentColor"><g><path fill="currentColor" fill-rule="evenodd" d="M10.1346 1.71069c0.0001 -0.41421 -0.33558 -0.750107 -0.74979 -0.750241 -0.41421 -0.000133 -0.75011 0.335541 -0.75024 0.749761 -0.00009 0.2881 -0.07634 0.57107 -0.22101 0.82022 -0.10982 0.18914 -0.25611 0.35369 -0.42966 0.48451 -0.31826 -0.06272 -0.64724 -0.0956 -0.98389 -0.0956 -0.33664 0 -0.6656 0.03288 -0.98385 0.09559 -0.17354 -0.13081 -0.31983 -0.29536 -0.42965 -0.4845 -0.14466 -0.24915 -0.22091 -0.53212 -0.221 -0.82022 -0.00013 -0.41422 -0.33603 -0.749894 -0.75024 -0.749761 -0.41422 0.000134 -0.74989 0.336031 -0.74976 0.750241 0.00018 0.5525 0.14639 1.09515 0.42382 1.57294 0.06078 0.10469 0.12739 0.20544 0.1994 0.30185 -0.47748 0.27348 -0.90612 0.62255 -1.26961 1.03089 -0.22639 -0.16753 -0.47029 -0.31148 -0.72801 -0.42907 -0.53139 -0.24246 -1.10894 -0.36711 -1.693029 -0.36541 -0.414212 0.0012 -0.7490202 0.33796 -0.7478154 0.75217 0.0012048 0.41422 0.3379664 0.74902 0.7521784 0.74782 0.367766 -0.00107 0.731426 0.07742 1.066006 0.23008 0.18909 0.08628 0.36637 0.19509 0.52815 0.32367 -0.18431 0.40261 -0.31734 0.83359 -0.39077 1.28459H0.800262c-0.414213 0 -0.7499995 0.33578 -0.7499995 0.75 0 0.41421 0.3357865 0.75 0.7499995 0.75H1.98524c0.06223 0.46278 0.18702 0.90575 0.36557 1.32009 -0.14925 0.11319 -0.31095 0.20989 -0.48236 0.28809 -0.33458 0.1527 -0.69824 0.2312 -1.066006 0.2301 -0.414212 -0.0012 -0.7509736 0.3336 -0.7521784 0.7478 -0.0012048 0.4142 0.3336034 0.751 0.7478154 0.7522 0.584089 0.0017 1.161639 -0.1229 1.693029 -0.3654 0.22985 -0.1049 0.44871 -0.2307 0.65395 -0.3756 0.92816 1.0905 2.31077 1.7822 3.85495 1.7822 1.54417 0 2.92679 -0.6917 3.85499 -1.7822 0.2052 0.1449 0.4241 0.2707 0.6539 0.3756 0.5314 0.2425 1.109 0.3671 1.6931 0.3654 0.4142 -0.0012 0.749 -0.338 0.7478 -0.7522 -0.0012 -0.4142 -0.338 -0.749 -0.7522 -0.7478 -0.3678 0.0011 -0.7314 -0.0774 -1.066 -0.2301 -0.1714 -0.0782 -0.3331 -0.1749 -0.4824 -0.2881 0.1786 -0.41434 0.3033 -0.8573 0.3656 -1.32008h1.185c0.4142 0 0.75 -0.33579 0.75 -0.75 0 -0.41422 -0.3358 -0.75 -0.75 -0.75h-1.2056c-0.0734 -0.45099 -0.2065 -0.88197 -0.3908 -1.28458 0.1618 -0.12859 0.3391 -0.2374 0.5282 -0.32368 0.3346 -0.15266 0.6982 -0.23115 1.066 -0.23008 0.4142 0.0012 0.751 -0.3336 0.7522 -0.74782 0.0012 -0.41421 -0.3336 -0.75097 -0.7478 -0.75217 -0.5841 -0.0017 -1.1617 0.12295 -1.6931 0.36541 -0.2577 0.11759 -0.5016 0.26155 -0.728 0.42908 -0.3635 -0.40833 -0.79211 -0.75739 -1.26958 -1.03087 0.07202 -0.09642 0.13864 -0.19718 0.19943 -0.30188 0.27743 -0.47779 0.42365 -1.02043 0.42385 -1.57294ZM7.00001 4.41934c1.42372 0 2.65224 0.83571 3.22179 2.04334H3.77821c0.56955 -1.20763 1.79808 -2.04334 3.2218 -2.04334Z" clip-rule="evenodd"></path></g></svg>'
  };
  // A button in the shape of the README's buttons (GlimStone, "The App tab"): the mark and the name
  // at rest, and under the pointer the brand's own colour, a second line and one sheen. A link
  // opens in a new tab, and a run button does its work on the page.
  function readmeBtn(o) {
    var unit = el("span", "cc-rbtn-unit cc-tile-" + o.brand), b;
    if (o.href) {
      b = el("a", "cc-rbtn");
      b.href = o.href;
      if (!/^mailto:/.test(o.href)) { b.target = "_blank"; b.rel = "noopener noreferrer"; }
    } else {
      b = actionBtn("", "cc-rbtn", o.run);
    }
    b.setAttribute("aria-label", o.sub ? o.name + " " + o.sub : o.name);
    if (o.art) {
      var art = el("span", "cc-rbtn-art"); art.innerHTML = o.art; b.appendChild(art);
    } else {
      var mk = el("span", "cc-rbtn-mark cc-" + o.brand + "-mark"); mk.innerHTML = o.mark; b.appendChild(mk);
      var tx = el("span", "cc-rbtn-text"); tx.appendChild(el("span", "cc-rbtn-name", o.name));
      if (o.sub) tx.appendChild(el("span", "cc-rbtn-sub", o.sub));
      b.appendChild(tx);
    }
    unit.appendChild(b); unit.appendChild(el("span", "cc-rbtn-sheen"));
    return unit;
  }
  // The bug report is a file the engine writes without passwords, keys or webhook addresses. It is
  // saved as a download, and then GitHub's bug form opens so the file can be attached there. The
  // form's tab opens before the request, inside the click, or a popup blocker would stop it.
  function downloadBugReport(unit) {
    var ctl = unit.querySelector(".cc-rbtn"), tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    fetch(PROXY + "?path=bugreport", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
      .then(function (blob) {
        var d = new Date(), p = function (n) { return ("0" + n).slice(-2); };
        var a = el("a"); a.href = URL.createObjectURL(blob);
        a.download = "cannonadecommand-bugreport-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".txt";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        var form = REPO + "/issues/new?template=bug_report.yml&version=" + encodeURIComponent(CC_VER);
        if (tab) tab.location.href = form; else window.open(form, "_blank", "noopener");
        if (window.CCTheme && window.CCTheme.toast) window.CCTheme.toast(T("Fehlerbericht gespeichert. Häng die Datei im GitHub-Formular an.", "Bug report saved. Attach the file in the GitHub form."));
      })
      .catch(function (e) {
        if (tab) tab.close();
        failed(ctl, T("Der Fehlerbericht ließ sich nicht erstellen: ", "Could not create the bug report: ") + ((e && e.message) || e));
      });
  }
  // Positive when version a is newer than b. A current version that is no release number, a dev
  // build, counts as older than any release.
  // Semantic versioning order: the numeric core decides, and a pre-release such as 1.0.0-rc1 sits
  // just below its own release and above everything before it. A build without a version (dev)
  // is older than any release.
  function verCmp(a, b) {
    function parts(v) {
      var m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v || ""));
      return m ? { core: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] } : null;
    }
    var pa = parts(a), pb = parts(b);
    if (!pa) return 0;
    if (!pb) return 1;
    for (var i = 0; i < 3; i++) if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
    if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length;
    for (var j = 0; j < Math.max(pa.pre.length, pb.pre.length); j++) {
      var x = pa.pre[j], y = pb.pre[j];
      if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
      if (x === y) continue;
      var nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny) return +x - +y;
      if (nx !== ny) return nx ? -1 : 1;
      return x < y ? -1 : 1;
    }
    return 0;
  }
  // The check shows its verdict on the button itself: green when this build is the latest
  // release, orange with the newer number, red and shaken when the check fails.
  function checkUpdates(btn) {
    btn.classList.remove("cc-set-chk-ok", "cc-set-chk-new", "cc-set-chk-bad");
    btn.textContent = T("Prüfe …", "Checking …");
    return fetch(LATEST_API, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var latest = String((j && j.tag_name) || "").replace(/^v/, "");
        if (!/^\d+\.\d+\.\d+$/.test(latest)) throw new Error(T("keine Versionsnummer in der Antwort", "no version number in the answer"));
        if (verCmp(latest, CC_VER) > 0) { btn.classList.add("cc-set-chk-new"); btn.textContent = T("v" + latest + " verfügbar", "v" + latest + " available"); }
        else { btn.classList.add("cc-set-chk-ok"); btn.textContent = T("Aktuell", "Up to date"); }
      })
      .catch(function (e) {
        btn.classList.add("cc-set-chk-bad"); btn.textContent = T("Prüfung fehlgeschlagen", "Check failed");
        failed(btn, T("Die Update-Prüfung ist fehlgeschlagen: ", "The update check failed: ") + ((e && e.message) || e));
      });
  }
  // The running version's notes, from the release API the update check reads. A dev build has no
  // release of its own and shows the latest one.
  function notesSource(ver) {
    var v = String(ver || "").replace(/^v/, "");
    if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) return { api: RELEASES_API + "/tags/v" + v, page: REPO + "/releases/tag/v" + v, ver: v };
    return { api: LATEST_API, page: REPO + "/releases", ver: "" };
  }
  function openReleaseNotes(opener) {
    var C = window.CCTheme; if (!C || !C.modal) return;
    var src = notesSource(CC_VER);
    var win = el("div", "cc-win cc-dlg cc-win-notes");
    var title = el("div", "cc-win-title", src.ver ? T("Neu in ", "New in ") + src.ver : T("Versionshinweise", "Release notes"));
    var card = el("div", "cc-win-card cc-notes");
    card.setAttribute("tabindex", "0");   // long notes scroll, and the keyboard needs a way in
    card.appendChild(el("p", "cc-win-text", T("Lade Versionshinweise …", "Loading the release notes …")));
    var act = el("div", "cc-win-act");
    var link = el("a", "cc-win-btn cc-win-link", T("Auf GitHub ansehen", "View on GitHub"));
    link.href = src.page; link.target = "_blank"; link.rel = "noopener noreferrer";
    act.appendChild(link);
    win.appendChild(title); win.appendChild(card); win.appendChild(act);
    document.body.appendChild(win);
    C.paintWin(win);
    C.modal(win, { opener: opener, focus: card });
    function say(text) { card.textContent = ""; card.appendChild(el("p", "cc-win-text", text)); }
    fetch(src.api, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (r.status === 404) throw new Error("missing"); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var tag = String((j && j.tag_name) || "").replace(/^v/, "");
        if (!src.ver && tag) { title.textContent = T("Neu in ", "New in ") + tag; link.href = REPO + "/releases/tag/v" + tag; }
        if (!j || !String(j.body || "").trim()) { say(T("Zu dieser Version gibt es keine Versionshinweise.", "This version has no release notes.")); return; }
        card.textContent = "";
        notesDom(j.body, card);
      })
      .catch(function (e) {
        say(e && e.message === "missing"
          ? T("Zu dieser Version gibt es auf GitHub noch keine Versionshinweise.", "GitHub has no release notes for this version yet.")
          : T("Die Versionshinweise ließen sich nicht laden. Auf GitHub kannst du sie lesen.", "Could not load the release notes. You can read them on GitHub."));
      });
  }
  // A release body is GitHub Markdown. It is built from elements and text nodes, so nothing in it
  // is ever read as HTML, and a link becomes an anchor only when it leads to http or https.
  function notesInline(text, into) {
    var re = /\*\*(.+?)\*\*|\x60([^\x60]+)\x60|\[([^\]]+)\]\(([^)\s]+)\)|\*(\S(?:.*?\S)?)\*/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) { var b = el("strong"); notesInline(m[1], b); into.appendChild(b); }
      else if (m[2] != null) into.appendChild(el("code", null, m[2]));
      else if (m[3] != null) {
        if (/^https?:\/\//i.test(m[4])) { var a = el("a", null, m[3]); a.href = m[4]; a.target = "_blank"; a.rel = "noopener noreferrer"; into.appendChild(a); }
        else into.appendChild(document.createTextNode(m[3]));
      } else { var i = el("em"); notesInline(m[5], i); into.appendChild(i); }
      last = re.lastIndex;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }
  function notesDom(md, into) {
    var blocks = [], cur = null, code = null;
    String(md || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
      if (code) { if (/^\s*\x60{3}/.test(ln)) code = null; else code.text += (code.text ? "\n" : "") + ln; return; }
      var m;
      if (/^\s*\x60{3}/.test(ln)) { code = { type: "pre", text: "" }; blocks.push(code); cur = null; }
      else if (!ln.trim() || /^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) cur = null;
      else if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(ln))) { blocks.push({ type: "h", text: m[2] }); cur = null; }
      else if ((m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(ln))) {
        var kind = /\d/.test(m[1]) ? "ol" : "ul";
        if (!cur || cur.type !== kind) { cur = { type: kind, items: [] }; blocks.push(cur); }
        cur.items.push(m[2]);
      } else if (cur && (cur.type === "ul" || cur.type === "ol")) cur.items[cur.items.length - 1] += " " + ln.trim();
      else if (cur && cur.type === "p") cur.text += " " + ln.trim().replace(/^>\s?/, "");
      else { cur = { type: "p", text: ln.trim().replace(/^>\s?/, "") }; blocks.push(cur); }
    });
    blocks.forEach(function (b) {
      if (b.type === "pre") { var pre = el("pre"); pre.appendChild(el("code", null, b.text)); into.appendChild(pre); return; }
      if (b.type === "h") { var h = el("div", "cc-notes-h"); h.setAttribute("role", "heading"); h.setAttribute("aria-level", "3"); notesInline(b.text, h); into.appendChild(h); return; }
      if (b.type === "p") { var p = el("p"); notesInline(b.text, p); into.appendChild(p); return; }
      var list = el(b.type);
      b.items.forEach(function (t) { var li = el("li"); notesInline(t, li); list.appendChild(li); });
      into.appendChild(list);
    });
  }
  // What the settings search matches in a row: its text and the bubble texts on and inside it.
  function searchText(n) {
    var t = (n.textContent || "") + " " + (n.getAttribute("data-tip") || "");
    Array.prototype.forEach.call(n.querySelectorAll("[data-tip]"), function (x) { t += " " + x.getAttribute("data-tip"); });
    return t.toLowerCase();
  }
  // A span with the button role, since Unraid's global button CSS would bloat a real button.
  function actionBtn(text, cls, run) {
    var b = el("span", cls, text);
    b.setAttribute("role", "button"); b.setAttribute("tabindex", "0");
    b.addEventListener("click", run);
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } });
    return b;
  }
  // A dropdown of areas that runs an action on a pick. It has no <select> behind it, so the shared
  // wheel step in cc-theme.js passes it by and a turn of the wheel never adds an exception.
  function areaPicker(label, items, onPick) {
    var wrap = el("span", "cc-dsel"), trig = el("span", "cc-dsel-trigger", label), panel = el("div", "cc-dsel-panel");
    items.forEach(function (it) {
      var o = el("div", "cc-dsel-opt", it[2]);
      o.addEventListener("click", function (ev) { ev.stopPropagation(); wrap.classList.remove("cc-open"); onPick(it); });
      panel.appendChild(o);
    });
    trig.addEventListener("click", function (ev) { ev.stopPropagation(); if (wrap.classList.toggle("cc-open")) ccDselPosition(trig, panel); });
    wrap.appendChild(trig); wrap.appendChild(panel);
    return wrap;
  }
  // The Docker view, the same choice as the gear menu there: cc.view for this browser and the
  // organizer's ccViewMode, which docker.js prefers on load, so either place sets both. Folders
  // need the organizer, which shows an empty folder view with a tile for a first folder, and the
  // cards and folders need the theming.
  var VIEW_ORG_Q = "{ docker { organizer { views { id prefs flatEntries { type } } } } }";
  var VIEW_ORG_SAVE = "mutation($viewId: String, $prefs: JSON!) { updateDockerViewPreferences(viewId: $viewId, prefs: $prefs) { version } }";
  // A schematic of each view the selector offers, the chosen one lit in the colour of its
  // segment: rows for the list, tiles for the grid, and tiles grouped under folder heads, since
  // folders always show their containers as tiles.
  function viewSketch(kind) {
    var r = function (x, y, w, h, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5"' + (o ? ' opacity="' + o + '"' : "") + "/>"; };
    var s = "";
    if (kind === "list") [1.5, 10.5, 19.5, 28.5].forEach(function (y) { s += r(1, y, 58, 6, 0.18) + r(3, y + 1, 4, 4) + r(10, y + 2, 22, 2) + r(40, y + 2, 8, 2, 0.6) + r(50, y + 2, 7, 2, 0.6); });
    else if (kind === "grid") [1, 19].forEach(function (y) { [1, 21, 41].forEach(function (x) { s += r(x, y, 18, 16, 0.18) + r(x + 6, y + 3, 6, 6) + r(x + 3, y + 11.5, 12, 2, 0.6); }); });
    else [1, 19].forEach(function (y) { s += r(1, y, 6, 4) + r(9, y + 1, 16, 2) + r(1, y + 6, 58, 10, 0.18); [3, 17, 31, 45].forEach(function (x) { s += r(x, y + 7.5, 12, 7, 0.55); }); });
    return '<svg viewBox="0 0 60 36" fill="currentColor" aria-hidden="true">' + s + "</svg>";
  }
  // The preview shows the chosen view alone, since a sketch of every view beside the selector would
  // read as a second selector for the same choice.
  function viewPreview(opts, sketch) {
    var box = el("div", "cc-set-viewprev"), fig = el("div", "cc-set-vp cc-set-vp-on");
    box.appendChild(el("div", "cc-set-lbl", T("Vorschau", "Preview"))); box.appendChild(fig);
    // paintToggles() gives the sketch the colour of the chosen segment.
    function mark(v) {
      var o = opts.filter(function (x) { return x[0] === v; })[0] || opts[0];
      fig.innerHTML = (sketch || viewSketch)(o[0]);
      fig.appendChild(el("span", "cc-set-vp-lbl", o[1]));
      paintToggles();
    }
    return { el: box, mark: mark };
  }
  function viewRow(c) {
    var label = T("Ansicht", "View");
    var help = T("Wie der Docker-Tab die Container zeigt, dieselbe Wahl wie im Zahnrad-Menü dort. Ordner lässt sich wählen, sobald Unraid Ordner für Docker anbietet; ohne Ordner zeigt die Ansicht die Container und eine Kachel „Neuer Ordner“.", "How the Docker tab shows the containers, the same choice as its gear menu. Folders can be picked once Unraid offers folders for Docker; with none yet, the view shows the containers and a “New folder” tile.");
    if (get("cc.theming", "1") === "0") {
      c.appendChild(lockRow(label, T("Liste, solange das Theming aus ist", "List while theming is off"), T("Zum Theming", "Go to Theming"), function () { jumpTo("general", "Theming"); }, help));
      return;
    }
    var slot = el("div", "cc-set-viewslot"), side = el("div");
    c.appendChild(slot); c.appendChild(side);
    function draw(org) {
      var opts = [["list", T("Liste", "List"), "IconViewList"], ["grid", T("Raster", "Grid"), "IconViewGrid"], ["folder", T("Ordner", "Folders"), "IconFolder", !org]];
      var cur = (org && org.prefs && org.prefs.ccViewMode) || get("cc.view", "list");
      if (!opts.some(function (o) { return o[0] === cur && !o[3]; })) cur = "list";
      slot.innerHTML = ""; side.innerHTML = "";
      var prev = viewPreview(opts);
      slot.appendChild(dropRow(label, opts, cur, function (v) {
        set("cc.view", v);
        prev.mark(v);
        if (!org || !window.ccGql) return;
        var prefs = {}, was = org.prefs && typeof org.prefs === "object" ? org.prefs : {};
        Object.keys(was).forEach(function (k) { prefs[k] = was[k]; });
        prefs.ccViewMode = v;
        window.ccGql(VIEW_ORG_SAVE, { viewId: org.id, prefs: prefs }).then(function (r) { return r.json(); })
          .then(function (j) { if (j && !j.errors) org.prefs = prefs; }).catch(function () {});
      }, help));
      side.appendChild(prev.el);
      prev.mark(cur);
    }
    draw(null);
    if (window.ccGql) window.ccGql(VIEW_ORG_Q).then(function (r) { return r.json(); }).then(function (j) {
      var v = j && j.data && j.data.docker && j.data.docker.organizer && j.data.docker.organizer.views;
      if (v && v[0]) draw(v[0]);
    }).catch(function () {});
  }
  // The disk view on /Main, the same choice as the switch above each section there. A pick here
  // clears the sections' own picks, so every section follows it.
  function diskSketch(kind) {
    if (kind === "list") return viewSketch("list");
    var r = function (x, y, w, h, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5"' + (o ? ' opacity="' + o + '"' : "") + "/>"; };
    var s = "";
    [1, 21, 41].forEach(function (x) { s += r(x, 1, 18, 34, 0.18) + r(x + 2, 3, 14, 13, 0.3) + '<circle cx="' + (x + 8) + '" cy="9.5" r="4.5"/>' + r(x + 3, 20, 12, 2.5) + r(x + 3, 26, 12, 2, 0.6) + r(x + 3, 30, 7, 2, 0.6); });
    return '<svg viewBox="0 0 60 36" fill="currentColor" aria-hidden="true">' + s + "</svg>";
  }
  function diskViewRow(c) {
    var label = T("Datenträger", "Disks");
    var help = T("Wie der Tab Start die Datenträger zeigt: als Liste wie in Unraid oder als Kacheln mit einem Bild von jedem Laufwerk. Der Schalter oben im Tab Start stellt dasselbe um.", "How the Main tab shows the disks: as Unraid's list or as tiles with a picture of each drive. The switch at the top of the Main tab changes the same setting.");
    if (get("cc.theming", "1") === "0") {
      c.appendChild(lockRow(label, T("Liste, solange das Theming aus ist", "List while theming is off"), T("Zum Theming", "Go to Theming"), function () { jumpTo("general", "Theming"); }, help));
      return;
    }
    var opts = [["list", T("Liste", "List"), "IconViewList"], ["tiles", T("Kacheln", "Tiles"), "IconViewGrid"]];
    var cur = get("cc.diskview", "tiles") === "list" ? "list" : "tiles";
    var prev = viewPreview(opts, diskSketch), slot = el("div", "cc-set-viewslot cc-set-diskview");
    slot.appendChild(dropRow(label, opts, cur, function (v) {
      set("cc.diskview", v);
      prev.mark(v);
    }, help));
    c.appendChild(slot); c.appendChild(prev.el);
    prev.mark(cur);
  }
  // The share view on /Shares, the same choice as the switch in its tab bar, for the user and the
  // disk shares alike.
  function shareSketch(kind) {
    if (kind === "list") return viewSketch("list");
    var r = function (x, y, w, h, o) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5"' + (o ? ' opacity="' + o + '"' : "") + "/>"; };
    var s = "";
    [1, 19].forEach(function (y) { [1, 21, 41].forEach(function (x) { s += r(x, y, 18, 16, 0.18) + r(x + 2, y + 2, 9, 3.5) + r(x + 2, y + 7, 5, 2.5, 0.6) + r(x + 8, y + 7, 5, 2.5, 0.6) + r(x + 2, y + 11.5, 14, 2, 0.45); }); });
    return '<svg viewBox="0 0 60 36" fill="currentColor" aria-hidden="true">' + s + "</svg>";
  }
  function shareViewRow(c) {
    var label = T("Freigaben", "Shares");
    var help = T("Wie der Tab Freigaben die Benutzer- und Datenträgerfreigaben zeigt: als Liste wie in Unraid oder als Kacheln mit Export, Speicher und Größe je Freigabe. Der Schalter oben im Tab Freigaben stellt dasselbe um.", "How the Shares tab shows the user and disk shares: as Unraid's list or as tiles with the export, storage and size of each share. The switch at the top of the Shares tab changes the same setting.");
    if (get("cc.theming", "1") === "0") {
      c.appendChild(lockRow(label, T("Liste, solange das Theming aus ist", "List while theming is off"), T("Zum Theming", "Go to Theming"), function () { jumpTo("general", "Theming"); }, help));
      return;
    }
    var opts = [["list", T("Liste", "List"), "IconViewList"], ["tiles", T("Kacheln", "Tiles"), "IconViewGrid"]];
    var cur = get("cc.shareview", "tiles") === "list" ? "list" : "tiles";
    var prev = viewPreview(opts, shareSketch), slot = el("div", "cc-set-viewslot cc-set-shareview");
    slot.appendChild(dropRow(label, opts, cur, function (v) {
      set("cc.shareview", v);
      prev.mark(v);
    }, help));
    c.appendChild(slot); c.appendChild(prev.el);
    prev.mark(cur);
  }
  // The plugin view on /Plugins, the same choice as the switch beside its Check button.
  function pluginViewRow(c) {
    var label = T("Plugins", "Plugins");
    var help = T("Wie der Tab Plugins die installierten Plugins zeigt: als Liste wie in Unraid oder als Kacheln mit Logo, Version, Status und Aktionen je Plugin. Der Schalter oben im Tab Plugins stellt dasselbe um.", "How the Plugins tab shows the installed plugins: as Unraid's list or as tiles with the logo, version, status and actions of each plugin. The switch at the top of the Plugins tab changes the same setting.");
    if (get("cc.theming", "1") === "0") {
      c.appendChild(lockRow(label, T("Liste, solange das Theming aus ist", "List while theming is off"), T("Zum Theming", "Go to Theming"), function () { jumpTo("general", "Theming"); }, help));
      return;
    }
    var opts = [["list", T("Liste", "List"), "IconViewList"], ["tiles", T("Kacheln", "Tiles"), "IconViewGrid"]];
    var cur = get("cc.pluginview", "tiles") === "list" ? "list" : "tiles";
    var prev = viewPreview(opts, function (kind) { return viewSketch(kind === "list" ? "list" : "grid"); }), slot = el("div", "cc-set-viewslot cc-set-pluginview");
    slot.appendChild(dropRow(label, opts, cur, function (v) {
      set("cc.pluginview", v);
      prev.mark(v);
    }, help));
    c.appendChild(slot); c.appendChild(prev.el);
    prev.mark(cur);
  }
  // The temperature warning threshold: three presets, or a value of its own in a field beside
  // them. Both land in cc.tempwarn as a plain number, which header.js reads as it is, and
  // onChange runs after each write.
  var TEMP_MIN = 30, TEMP_MAX = 110;
  function tempWarnValid(v) { return /^\d{2,3}$/.test(String(v).trim()) && +v >= TEMP_MIN && +v <= TEMP_MAX; }
  function tempWarnRow(onChange) {
    var presets = [["50", "50 °C", "IconTempLow"], ["60", "60 °C", "IconTempMid"], ["70", "70 °C", "IconTempHigh"]];
    var stored = function () { return get("cc.tempwarn", "60"); };
    var isPreset = function (v) { return presets.some(function (p) { return p[0] === v; }); };
    var field = el("span", "cc-set-numwrap"), num = el("input", "cc-set-txt cc-set-num");
    num.type = "text"; num.inputMode = "numeric"; num.maxLength = 3; num.spellcheck = false;
    num.setAttribute("aria-label", T("Eigene Warnschwelle in °C", "Own warning threshold in °C"));
    field.appendChild(num); field.appendChild(el("span", "cc-set-unit", "°C"));
    field.hidden = isPreset(stored());
    num.value = stored();
    var row = dropRow(T("Temperatur-Warnschwelle", "Temperature warning threshold"), presets.concat([["custom", T("Eigene", "Custom"), "IconCustomValue"]]), field.hidden ? stored() : "custom", function (v) {
      field.hidden = v !== "custom";
      if (v === "custom") { num.value = stored(); num.focus(); num.select(); return; }
      set("cc.tempwarn", v); onChange();
    }, T("Ab dieser Temperatur wird ein Wert in der Status-Insel orange, 15 °C darüber rot. Eigene: ein Wert von " + TEMP_MIN + " bis " + TEMP_MAX + " °C.", "From this temperature a reading in the status island turns orange, and red 15 °C above it. Custom: a value from " + TEMP_MIN + " to " + TEMP_MAX + " °C."));
    num.addEventListener("input", function () {
      var ok = tempWarnValid(num.value);
      num.setAttribute("aria-invalid", ok ? "false" : "true");
      if (ok) { set("cc.tempwarn", String(+num.value)); onChange(); }
    });
    // A value outside the range is never stored, and leaving the field puts the stored one back.
    num.addEventListener("change", function () {
      if (tempWarnValid(num.value)) return;
      failed(num, T("Bitte einen Wert von " + TEMP_MIN + " bis " + TEMP_MAX + " °C.", "Please enter a value from " + TEMP_MIN + " to " + TEMP_MAX + " °C."));
      num.value = stored(); num.setAttribute("aria-invalid", "false");
    });
    var end = el("span", "cc-set-colend");
    end.appendChild(row.lastChild); end.appendChild(field);
    row.appendChild(end);
    return row;
  }
  function segRow(labelText, opts, cur, onChange, help) {
    return dropRow(labelText, opts, cur, onChange, help);
  }
  // A setting with up to six choices is GlimStone's horizontal selector at the end of its row,
  // where an option is [value, label, glyph]. A longer list stays a dropdown, a native select
  // dressed as a CC control, where an option is [value, label, face] and the font list previews
  // each face.
  var SEG_MAX = 6;
  function dropRow(labelText, opts, cur, onChange, help) {
    if (opts.length <= SEG_MAX) {
      var srow = el("div", "cc-set-row cc-set-inline"), lw = el("span", "cc-set-lblwrap");
      lw.appendChild(el("span", null, labelText)); if (help) lw.appendChild(infoIcon(help));
      srow.appendChild(lw); srow.appendChild(segPicker(opts, cur, onChange));
      return srow;
    }
    var row = el("div", "cc-set-row"); var rl = el("span", "cc-set-rl", labelText); if (help) rl.appendChild(infoIcon(help)); row.appendChild(rl);
    var sel = el("select", "cc-set-sel");
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === cur) op.selected = true; if (o[2]) op.style.fontFamily = o[2]; sel.appendChild(op); });
    sel.addEventListener("change", function () { onChange(sel.value); });
    row.appendChild(ccDsel(sel)); return row;
  }
  // The dropdowns use the same widget the Docker network dropdown does, rather than a native
  // select, whose opened list the browser draws in its own colours. As in docker.js, the native
  // select stays hidden as the source of truth, so its change event still runs the live effects,
  // and a trigger with a floating panel of chips renders on top of it.
  function ccDsel(sel) {
    var wrap = el("span", "cc-dsel"); sel.style.display = "none"; wrap.appendChild(sel);
    // The trigger takes the focus on a click and from Tab, which lets the wheel step the value
    // (GlimStone rule 14), and Enter or Space opens it.
    var trig = el("span", "cc-dsel-trigger"); wrap.appendChild(trig);
    if (window.CCTheme && window.CCTheme.pressable) window.CCTheme.pressable(trig);
    trig.setAttribute("aria-haspopup", "listbox");
    var panel = el("div", "cc-dsel-panel"); wrap.appendChild(panel);
    // Wide enough for the longest entry, the padding and the caret, so no choice is cut short.
    var longest = 0;
    for (var n = 0; n < sel.options.length; n++) longest = Math.max(longest, sel.options[n].text.length);
    wrap.style.setProperty("--cc-dsel-w", "min(calc(" + longest + "ch + 52px), 340px)");
    for (var k = 0; k < sel.options.length; k++) {
      var o = sel.options[k];
      var chip = el("div", "cc-dsel-opt", o.text); chip.setAttribute("data-i", k);
      if (o.style.fontFamily) chip.style.fontFamily = o.style.fontFamily;   // in the font picker a chip previews its own face
      chip.addEventListener("click", (function (idx) {
        return function (ev) {
          ev.stopPropagation();
          if (sel.options[idx].disabled) { if (window.CCTheme && window.CCTheme.deny) window.CCTheme.deny(ev.currentTarget); return; }
          sel.selectedIndex = idx;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          ccDselSync(sel); wrap.classList.remove("cc-open"); trig.focus();
        };
      })(k));
      panel.appendChild(chip);
    }
    trig.addEventListener("click", function (ev) {
      ev.stopPropagation();
      ccDselSync(sel);
      var open = wrap.classList.toggle("cc-open");
      if (open) { var o2 = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var j = 0; j < o2.length; j++) if (o2[j] !== wrap) o2[j].classList.remove("cc-open"); ccDselPosition(trig, panel); }
    });
    ccDselSync(sel); return wrap;
  }
  function ccDselSync(sel) {
    var w = sel.parentNode; if (!w || !w.classList || !w.classList.contains("cc-dsel")) return;
    var t2 = w.querySelector(".cc-dsel-trigger"), c = w.querySelectorAll(".cc-dsel-opt");
    var label = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
    if (t2 && t2.textContent !== label) t2.textContent = label;   // written only on a change, so nothing churns
    for (var k = 0; k < c.length; k++) { var o = sel.options[+c[k].getAttribute("data-i")]; if (!o) continue; c[k].classList.toggle("is-selected", o.selected); c[k].classList.toggle("is-disabled", !!o.disabled); }
  }
  // The wheel handler for a closed field lives in cc-theme.js; this page builds its own widgets,
  // so it hands over its own repaint. docker.js registers the same shape for its copy, the two
  // never load on one page, and each sync is a no-op on a wrapper that is not its own.
  try { if (window.CCTheme && window.CCTheme.registerSelectSync) window.CCTheme.registerSelectSync(function (sel, wrap) { if (!wrap || !wrap.classList || !wrap.classList.contains("cc-dsel")) return false; ccDselSync(sel); return true; }); } catch (e) {}
  // The panel is fixed on open, so the page's overflow cannot clip a long list, and it flips up
  // where there is more room above. No transform-ancestor maths, since this page has no dialog.
  function ccDselPosition(trig, panel) {
    try {
      var r = trig.getBoundingClientRect(), gap = 4, edge = 14;
      var below = window.innerHeight - r.bottom - edge, above = r.top - edge;
      panel.style.position = "fixed"; panel.style.boxSizing = "border-box";
      panel.style.left = Math.round(r.left) + "px"; panel.style.minWidth = Math.round(r.width) + "px"; panel.style.maxWidth = "min(92vw, 420px)";
      if (below >= 200 || below >= above) { panel.style.top = Math.round(r.bottom + gap) + "px"; panel.style.bottom = "auto"; panel.style.maxHeight = Math.max(140, below - gap) + "px"; }
      else { panel.style.bottom = Math.round(window.innerHeight - r.top + gap) + "px"; panel.style.top = "auto"; panel.style.maxHeight = Math.max(140, above - gap) + "px"; }
    } catch (e) {}
  }
  if (!window.__ccSetDsel) {   // one document-level close handler for the page's lifetime
    window.__ccSetDsel = true;
    document.addEventListener("click", function () { var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); });
    window.addEventListener("scroll", function (e) { var tgt = e && e.target; if (tgt && tgt.closest && tgt.closest(".cc-dsel-panel")) return; var o = document.querySelectorAll("#cc-settings .cc-dsel.cc-open"); for (var i = 0; i < o.length; i++) o[i].classList.remove("cc-open"); }, true);
  }
  // Indents the whole panel, hero, tab strip and cards alike, so it starts at the first main-menu
  // tab; header.js stamps the offset. Padding the root is safe to repeat, since the root's border
  // edge does not move with its own padding.
  function alignSetTabs() {
    try {
      var al = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cc-align-left")) || 15;
      var rr = root.getBoundingClientRect();
      var need = al - rr.left;
      if (need > 0 && need < 60) root.style.paddingLeft = need + "px"; else root.style.paddingLeft = "";
      // Unraid's #displaybox is a few pixels wider than the viewport, so the panel and the search
      // icon pinned to its right would spill past the edge. The right is padded to mirror the
      // left inset, which brings both back inside.
      var padR = Math.round(rr.right - (document.documentElement.clientWidth - al));
      if (padR > 0 && padR < 80) root.style.paddingRight = padR + "px"; else root.style.paddingRight = "";
    } catch (e) {}
  }
  var alignT = null; // one resize listener for the page's lifetime
  window.addEventListener("resize", function () { clearTimeout(alignT); alignT = setTimeout(alignSetTabs, 150); });

  // The sub-tabs re-sort when the main menu order changes, whether by a drag or by an auto-mount.
  // A menu mutation re-runs render(), which re-reads the live order and rebuilds the strip while
  // cc.settab preserves the active tab. Gated on the order string itself, so an unrelated menu
  // mutation such as a badge stamp never triggers a rebuild. The order the first render() reads is
  // the starting point, or the first stamp after load would rebuild the page a third time.
  if (!window.__ccSetNavObs) {
    window.__ccSetNavObs = true;
    var menuEl9 = document.getElementById("menu");
    if (menuEl9 && window.MutationObserver) {
      var menuOrder = function () { return Array.prototype.map.call(document.querySelectorAll("#menu .nav-tile .nav-item:not(.util) > a[href]"), function (a9) { return a9.getAttribute("href"); }).join("|"); };
      var navT9 = null, lastOrd9 = menuOrder();
      new MutationObserver(function () {
        clearTimeout(navT9);
        navT9 = setTimeout(function () {
          try {
            var ord9 = menuOrder();
            if (ord9 && ord9 !== lastOrd9) { lastOrd9 = ord9; render(); }
          } catch (e9o) {}
        }, 200);
      }).observe(menuEl9, { childList: true, subtree: true });
    }
  }

  render();
  // Pulls the engine config so the Notifications card shows what is saved, then re-renders. With
  // the engine down the defaults stay. An edit made during the round trip is kept rather than
  // overwritten.
  var bootBusy = uiUnsynced();
  apiRead("config").then(function (c) {
    if (!c || typeof c !== "object") return;
    fullConfig = { schedules: c.schedules || [], watchdogs: c.watchdogs || [], bandwidths: c.bandwidths || [], notify: c.notify || { unraid: false, webhook: "" }, shape_iface: c.shape_iface || "", ui_settings: c.ui_settings || undefined };
    adoptUISettings(c.ui_settings, bootBusy); // render() below shows the adopted values
    // The palette migration cleaned the incoming map in place, so it is written back; otherwise
    // the next load's adopt would restore the old key from the mirror.
    if (adoptUISettings._migrated) { try { api("PUT", "config", c); } catch (e8) {} }
    if (!c.ui_settings || !Object.keys(c.ui_settings).length) { var seed9 = collectUISettings(); if (Object.keys(seed9).length) { Object.keys(seed9).forEach(function (k9) { uiPending[k9] = 1; }); pushUISettings(); } } // seed the mirror
    // An edit already in progress stays; otherwise the loaded values apply.
    if (!notifyDirty) notify = { unraid: !!fullConfig.notify.unraid, webhook: fullConfig.notify.webhook || "" };
    if (!shapeDirty) shapeIface = fullConfig.shape_iface || "";
    render();
  }).catch(function () {});
})();
