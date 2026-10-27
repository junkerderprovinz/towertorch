/* The windows the Info tab's give buttons open inside the page: Buy Me a Coffee's widget, PayPal's
 * buttons under the house's own controls, and the crypto window with an address and a QR code per
 * network. Nothing from a payment provider loads before its window opens. The coin marks are
 * Bitcoin, Ethereum, Tether, BNB, Solana and Sui from Simple Icons (CC0), and USD Coin and XRP from
 * cryptocurrency-icons (MIT, Copyright (c) 2018 Christopher Downer). */
(function () {
  var de = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase() === "de";
  function T(d, e) { return de ? d : e; }

  // The one Buy Me a Coffee page that may be framed; the profile page answers
  // X-Frame-Options: SAMEORIGIN.
  var COFFEE_WIDGET = "https://buymeacoffee.com/widget/page/junkerderprovinz?description=&color=%23FFDD00";
  var PAYPAL = {
    clientId: "BAAbFqgNYfuCIBT_gwVE64oqj-E-jmxFiLaoR1yMIF9KK-CW16x5Pt2bSjBloqbTF4TvjFYw3ZTLnRP8_U",
    // One plan per interval, each at 1 EUR a unit, so any whole amount is the plan times a quantity.
    plans: { month: "P-2ND5083133959702RNK2375A", year: "P-2FN843952N550243RNK2375A" },
    currency: "EUR"
  };
  var AMOUNTS = ["10", "25", "50"];
  var DEFAULT_AMOUNT = "25";

  // Every network carries its own address, so a coin is never offered on a chain nobody receives
  // on. An EVM address is not a Tron or Solana address, which is why Tron is absent.
  var BTC = "bc1q078lt57t4n5zq5md3knz3ythum0w78zmjw5eda";
  var EVM = "0xFF6726C5bd76C8FD6b6bE7Ea5CEd4621fde5e841";
  var SOL = "GrTyhSbZVArdaZAr3TqWDrkEGahomLtNZJ41qPLm3dHd";
  var SUI = "0xa76677f71d107c9a957c2d1814b68027cbd4ad9dbf28d911a97fad5d2fc3a414";
  var XRP = "rwMK2nXqChT4JYWVypMypnpctDcM9jgWmG";
  var ETHEREUM = { name: "Ethereum", address: EVM };
  var BASE = { name: "Base", address: EVM };
  var OPTIMISM = { name: "Optimism", address: EVM };
  var BSC = { name: "BNB Smart Chain", address: EVM };
  var SOLANA = { name: "Solana", address: SOL };
  var COINS = [
    { id: "btc", symbol: "BTC", name: "Bitcoin", tile: ["#f7931a", "#ffffff"], networks: [{ name: "Bitcoin", address: BTC }] },
    // Native ETH only; on BNB Smart Chain it is a bridged token.
    { id: "eth", symbol: "ETH", name: "Ethereum", tile: ["#627eea", "#ffffff"], networks: [ETHEREUM, BASE, OPTIMISM] },
    { id: "usdt", symbol: "USDT", name: "Tether", tile: ["#26a17b", "#ffffff"], networks: [ETHEREUM, BSC, SOLANA] },
    { id: "usdc", symbol: "USDC", name: "USD Coin", tile: ["#2775ca", "#ffffff"], networks: [ETHEREUM, BASE, SOLANA] },
    { id: "bnb", symbol: "BNB", name: "BNB", tile: ["#f0b90b", "#161616"], networks: [BSC] },
    { id: "sol", symbol: "SOL", name: "Solana", tile: ["#9945ff", "#ffffff"], networks: [SOLANA] },
    { id: "sui", symbol: "SUI", name: "Sui", tile: ["#4da2ff", "#ffffff"], networks: [{ name: "Sui", address: SUI }] },
    // Exchanges often ask for a destination tag; this account does not need one. Its near-black
    // mark would vanish on the dark tile, so at rest it takes the white of the reversed logo.
    { id: "xrp", symbol: "XRP", name: "XRP", tile: ["#23292f", "#ffffff"], rest: "#ffffff", networks: [{ name: "XRP Ledger", address: XRP, notag: true }] }
  ];
  var COIN_MARK = {
    btc: ["0 0 24 24", "M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z"],
    eth: ["0 0 24 24", "M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"],
    usdt: ["0 0 24 24", "M18.7538 10.5176c0 .6251-2.2379 1.1483-5.2381 1.2812l.0028.0007c-.0848.0064-.5233.0325-1.5012.0325-.7778 0-1.33-.0233-1.5237-.0325-3.0059-.1322-5.2495-.6555-5.2495-1.2819s2.2436-1.149 5.2495-1.2834v2.0442c.1965.0142.7594.0474 1.5372.0474.9334 0 1.4008-.0389 1.4849-.0466V9.2356c2.9994.1337 5.2381.657 5.2381 1.282zm5.19.5466L12.1248 22.389a.1803.1803 0 0 1-.2496 0L.0562 11.0635a.1781.1781 0 0 1-.0382-.2079l4.3762-9.1921a.1767.1767 0 0 1 .1626-.1026h14.8878a.1768.1768 0 0 1 .1612.1032l4.3762 9.1922a.1782.1782 0 0 1-.0382.2079zm-4.478-.4038c0-.8068-2.5515-1.4799-5.9473-1.6369V7.195h4.186V4.4055H6.3076V7.195h4.1852v1.8286c-3.4018.1562-5.9601.83-5.9601 1.6376 0 .8075 2.5583 1.4806 5.9601 1.6376v5.8618h3.025v-5.8639c3.394-.1563 5.948-.8295 5.948-1.6363z"],
    usdc: ["0 0 32 32", "M16 0c8.837 0 16 7.163 16 16s-7.163 16-16 16S0 24.837 0 16 7.163 0 16 0zm3.352 5.56c-.244-.12-.488 0-.548.243-.061.061-.061.122-.061.243v.85l.01.104a.86.86 0 00.355.503c4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85l.005.088a.45.45 0 00.36.397c.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162zm-6.46-.06c-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85l-.01-.08c-.042-.169-.199-.362-.355-.466-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85l-.005-.088a.45.45 0 00-.36-.397zm3.535 3.156h-.915l-.088.008c-.2.04-.346.212-.4.478v1.396l-.207.032c-1.708.304-2.778 1.483-2.778 2.942 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036l-.079.007a.413.413 0 00-.347.418v.06l.033.18c.29 1.424 1.266 2.443 3.197 2.734v1.457l.008.088c.04.198.213.344.48.397h.914l.088-.008c.2-.04.346-.212.4-.477V21.34l.207-.04c1.713-.362 2.84-1.601 2.84-3.177 0-2.124-1.28-2.852-3.84-3.156-1.829-.243-2.194-.728-2.194-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975l.079-.006a.413.413 0 00.348-.419v-.06l-.037-.173a3.04 3.04 0 00-2.706-2.316V9.142l-.008-.088c-.04-.199-.213-.345-.48-.398z"],
    bnb: ["0 0 24 24", "M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z"],
    sol: ["0 0 24 24", "m23.8764 18.0313-3.962 4.1393a.9201.9201 0 0 1-.306.2106.9407.9407 0 0 1-.367.0742H.4599a.4689.4689 0 0 1-.2522-.0733.4513.4513 0 0 1-.1696-.1962.4375.4375 0 0 1-.0314-.2545.4438.4438 0 0 1 .117-.2298l3.9649-4.1393a.92.92 0 0 1 .3052-.2102.9407.9407 0 0 1 .3658-.0746H23.54a.4692.4692 0 0 1 .2523.0734.4531.4531 0 0 1 .1697.196.438.438 0 0 1 .0313.2547.4442.4442 0 0 1-.1169.2297zm-3.962-8.3355a.9202.9202 0 0 0-.306-.2106.941.941 0 0 0-.367-.0742H.4599a.4687.4687 0 0 0-.2522.0734.4513.4513 0 0 0-.1696.1961.4376.4376 0 0 0-.0314.2546.444.444 0 0 0 .117.2297l3.9649 4.1394a.9204.9204 0 0 0 .3052.2102c.1154.049.24.0744.3658.0746H23.54a.469.469 0 0 0 .2523-.0734.453.453 0 0 0 .1697-.1961.4382.4382 0 0 0 .0313-.2546.4444.4444 0 0 0-.1169-.2297zM.46 6.7225h18.7815a.9411.9411 0 0 0 .367-.0742.9202.9202 0 0 0 .306-.2106l3.962-4.1394a.4442.4442 0 0 0 .117-.2297.4378.4378 0 0 0-.0314-.2546.453.453 0 0 0-.1697-.196.469.469 0 0 0-.2523-.0734H4.7596a.941.941 0 0 0-.3658.0745.9203.9203 0 0 0-.3052.2102L.1246 5.9687a.4438.4438 0 0 0-.1169.2295.4375.4375 0 0 0 .0312.2544.4512.4512 0 0 0 .1692.196.4689.4689 0 0 0 .2518.0739z"],
    sui: ["0 0 24 24", "M17.636 10.009a7.16 7.16 0 0 1 1.565 4.474 7.2 7.2 0 0 1-1.608 4.53l-.087.106-.023-.135a7 7 0 0 0-.07-.349c-.502-2.21-2.142-4.106-4.84-5.642-1.823-1.034-2.866-2.278-3.14-3.693-.177-.915-.046-1.834.209-2.62.254-.787.631-1.446.953-1.843l1.05-1.284a.46.46 0 0 1 .713 0l5.28 6.456zm1.66-1.283L12.26.123a.336.336 0 0 0-.52 0L4.704 8.726l-.023.029a9.33 9.33 0 0 0-2.07 5.872C2.612 19.803 6.816 24 12 24s9.388-4.197 9.388-9.373a9.32 9.32 0 0 0-2.07-5.871zM6.389 9.981l.63-.77.018.142q.023.17.055.34c.408 2.136 1.862 3.917 4.294 5.297 2.114 1.203 3.345 2.586 3.7 4.103a5.3 5.3 0 0 1 .109 1.801l-.004.034-.03.014A7.2 7.2 0 0 1 12 21.67c-3.976 0-7.2-3.218-7.2-7.188 0-1.705.594-3.27 1.587-4.503z"],
    xrp: ["0 0 32 32", "M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm7.07-24l-4.574 4.523a3.556 3.556 0 01-4.996 0L8.93 8H6.035l6.02 5.957a5.621 5.621 0 007.89 0L25.961 8h-2.89zM8.895 24.563L13.504 20a3.556 3.556 0 014.996 0l4.605 4.563H26l-6.055-5.993a5.621 5.621 0 00-7.89 0L6 24.562h2.895z"]
  };

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // A control in the window's own look: Unraid dresses every <button>, so these are spans.
  function control(cls, text) { return window.CCTheme.pressable(el("span", cls, text)); }

  // Under the rainbow, one position per option as on the settings page's tabs; otherwise the
  // sheet's accent.
  function hue(node, i) {
    var C = window.CCTheme;
    if (i != null && get("cc.theming", "1") !== "0" && get("cc.rainbow", "0") === "1") {
      var c = C.rbColor(i, get("cc.accent", "#FCC419"));
      node.style.setProperty("--cc-rb-c", c);
      node.style.setProperty("--cc-rb-ct", C.idealText(c));
    } else {
      node.style.removeProperty("--cc-rb-c");
      node.style.removeProperty("--cc-rb-ct");
    }
  }
  // TowerTorch's label mode for the buttons it draws, which the coin tiles follow.
  function labelMode() {
    var m = document.documentElement.getAttribute("data-cc-labels-buttons");
    return ["text", "textGlyph", "glyph", "reactive"].indexOf(m) < 0 ? "textGlyph" : m;
  }

  /* A TowerTorch window with the appeal and the sentence naming who takes the payment over its own
     content. o.build fills the card and returns what takes the focus; o.onClose runs on every way
     out. */
  function openWindow(o) {
    var win = el("div", "cc-win cc-dlg cc-give " + o.cls);
    win.setAttribute("data-cc-give-labels", labelMode());
    win.appendChild(el("div", "cc-win-title", o.title));
    var card = el("div", "cc-win-card cc-give-body");
    card.appendChild(el("p", "cc-win-text", T("Wirf deinem Ritter eine Münze zu: Sie deckt einen Teil der Kosten und hält das Projekt am Leben. Alles, was ich baue, kostet nichts und zeigt keine Werbung.", "Toss a coin to your knight: it covers part of the costs and keeps the project alive. Everything I build costs nothing and shows no ads.")));
    card.appendChild(el("p", "cc-win-text cc-give-sub", o.intro));
    win.appendChild(card);
    document.body.appendChild(win);
    var into = o.build(card, win);
    var h = window.CCTheme.modal(win, { opener: o.opener, focus: into, onDismiss: function () { if (o.onClose) o.onClose(); h.close(); } });
  }

  function openCoffee(opener) {
    openWindow({
      cls: "cc-give-coffee", title: "Buy Me a Coffee", opener: opener,
      intro: T("Die Zahlung läuft direkt bei Buy Me a Coffee. Ein Konto brauchst du nicht.", "The payment runs through Buy Me a Coffee. You do not need an account."),
      build: function (card) {
        var frame = el("div", "cc-give-frame"), f = el("iframe");
        f.src = COFFEE_WIDGET;
        f.title = "Buy Me a Coffee";
        f.allow = "payment";
        frame.appendChild(f);
        card.appendChild(frame);
      }
    });
  }

  /* The house's horizontal selector: one option is picked, the arrow keys move the pick, and only
     the picked option is a tab stop. */
  function selector(label, items, pick) {
    var node = el("div", "cc-give-seg"), opts = [];
    node.setAttribute("role", "radiogroup");
    node.setAttribute("aria-label", label);
    items.forEach(function (it, i) {
      var b = control("cc-give-opt", it[1]);
      b.setAttribute("role", "radio");
      b.addEventListener("click", function () { set(it[0]); pick(it[0]); });
      b.addEventListener("keydown", function (e) {
        var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        if (document.documentElement.dir === "rtl" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) step = -step;
        var next = items[(i + step + items.length) % items.length];
        set(next[0]);
        pick(next[0]);
        opts[items.indexOf(next)].focus();
      });
      opts.push(b);
      node.appendChild(b);
    });
    function set(id) {
      var any = false;
      opts.forEach(function (b, i) {
        var on = items[i][0] === id;
        any = any || on;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        hue(b, i);
      });
      if (!any) opts[0].tabIndex = 0;
    }
    return { node: node, set: set, first: function () { return opts[0]; } };
  }
  function group(label, node) {
    var g = el("div", "cc-give-group");
    g.appendChild(el("div", "cc-give-lbl", label));
    g.appendChild(node);
    return g;
  }

  /* PayPal. A one-off donation and a recurring one need the SDK loaded with different parameters,
     so each gets its own namespace. Two things break it without a readable error: an element with
     id="paypal", which becomes window.paypal first, and a page-level open or close function
     shadowing the window.open its login popup needs. Only the PayPal wallet and the card button
     stay; the other funding sources repeat what the card covers. */
  var DISABLED_FUNDING = "sepa,paylater,venmo,bancontact,blik,eps,giropay,ideal,mybank,p24,sofort";
  var paypalLoads = {};
  function loadPaypal(recurring) {
    var ns = recurring ? "ccPaypalRecurring" : "ccPaypalOnce";
    if (paypalLoads[ns]) return paypalLoads[ns];
    var q = "client-id=" + encodeURIComponent(PAYPAL.clientId) + "&currency=" + PAYPAL.currency +
      "&intent=" + (recurring ? "subscription&vault=true" : "capture") + "&components=buttons&disable-funding=" + DISABLED_FUNDING;
    paypalLoads[ns] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?" + q;
      s.setAttribute("data-namespace", ns);
      // A blocker can let the script load and still keep the SDK from running.
      s.onload = function () { if (window[ns]) resolve(window[ns]); else reject(new Error("paypal")); };
      s.onerror = function () { delete paypalLoads[ns]; s.remove(); reject(new Error("paypal")); };
      document.head.appendChild(s);
    });
    return paypalLoads[ns];
  }
  // A typed amount as PayPal's decimal string, or null below 1 or with more than two decimals. A
  // comma counts as the decimal mark.
  function parseAmount(text) {
    var v = String(text).replace(",", ".").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) < 1) return null;
    return Number(v).toFixed(2).replace(/\.00$/, "");
  }

  function openPaypal(opener) {
    var freq = "once", preset = DEFAULT_AMOUNT, typed = "", buttons = null, run = 0;
    function amount() { return typed === "" ? preset : parseAmount(typed); }
    openWindow({
      cls: "cc-give-paypal", title: "PayPal", opener: opener,
      intro: T("Die Zahlung läuft direkt bei PayPal, mit deinem PayPal-Konto oder mit Karte ohne Konto.", "The payment runs through PayPal, with your PayPal account or by card without one."),
      onClose: function () { run++; if (buttons) buttons.close().catch(function () {}); },
      build: function (card) {
        var oftenLbl = T("Wie oft", "How often"), amountLbl = T("Betrag", "Amount"), otherLbl = T("Anderer Betrag", "Other amount");
        var often = selector(oftenLbl, [["once", T("Einmalig", "Once")], ["month", T("Monatlich", "Monthly")], ["year", T("Jährlich", "Yearly")]], function (id) {
          if (id === freq) return;
          freq = id;
          render();
        });
        often.set(freq);
        card.appendChild(group(oftenLbl, often.node));

        var sums = selector(amountLbl, AMOUNTS.map(function (a) { return [a, a + " €"]; }), function (id) {
          preset = id;
          typed = "";
          field.value = "";
          mark();
        });
        var field = el("input", "cc-win-in cc-give-amount");
        field.type = "text";
        field.inputMode = "decimal";
        field.autocomplete = "off";
        field.placeholder = otherLbl;
        field.setAttribute("aria-label", otherLbl);
        // A valid typed amount takes the pick from the presets, so the window never shows two
        // amounts; clearing the field gives it back.
        field.addEventListener("input", function () {
          typed = field.value;
          if (parseAmount(typed)) preset = null;
          else if (typed === "") preset = preset || DEFAULT_AMOUNT;
          mark();
        });
        // Leaving the field shows the amount as it will be charged, hands a preset's amount back to
        // its preset, and shakes text that is no amount.
        field.addEventListener("blur", function () {
          if (typed === "") return;
          var v = parseAmount(typed);
          if (!v) { window.CCTheme.shake(field); return; }
          if (AMOUNTS.indexOf(v) >= 0) { preset = v; typed = ""; }
          else typed = v;
          field.value = typed;
          mark();
        });
        var col = el("div", "cc-give-amounts");
        col.appendChild(sums.node);
        col.appendChild(field);
        card.appendChild(group(amountLbl, col));
        function mark() {
          sums.set(preset);
          var ok = !!parseAmount(typed);
          field.classList.toggle("cc-give-amount-ok", ok);
          field.setAttribute("aria-invalid", typed !== "" && !ok ? "true" : "false");
        }
        mark();

        var box = el("div", "cc-give-pp"), state = el("p", "cc-give-state");
        card.appendChild(box);
        card.appendChild(state);
        function say(cls, text) { state.className = "cc-give-state" + (cls ? " " + cls : ""); state.textContent = text; }

        function render() {
          var mine = ++run;
          say("", T("PayPal wird geladen…", "Loading PayPal…"));
          if (buttons) { buttons.close().catch(function () {}); buttons = null; }
          box.textContent = "";
          loadPaypal(freq !== "once").then(function (pp) {
            if (mine !== run) return;
            var handlers = freq === "once" ? {
              createOrder: function (d, actions) {
                var money = { currency_code: PAYPAL.currency, value: amount() };
                return actions.order.create({
                  purchase_units: [{
                    description: "TowerTorch",
                    amount: { currency_code: money.currency_code, value: money.value, breakdown: { item_total: money } },
                    // DONATION marks the payment as a gift in the donor's PayPal history.
                    items: [{ name: "TowerTorch", quantity: "1", category: "DONATION", unit_amount: money }]
                  }]
                });
              },
              onApprove: function (d, actions) { return actions.order.capture().then(thanks); }
            } : {
              createSubscription: function (d, actions) {
                return actions.subscription.create({
                  plan_id: PAYPAL.plans[freq],
                  quantity: String(Math.max(1, Math.round(Number(amount()))))
                });
              },
              onApprove: thanks
            };
            buttons = pp.Buttons(Object.assign({
              style: { layout: "vertical", color: "blue", shape: "rect", borderRadius: 10, label: "donate", height: 40 },
              // A half-typed amount keeps the buttons from opening PayPal at all.
              onClick: function (d, actions) { return amount() ? actions.resolve() : actions.reject(); },
              onError: failed
            }, handlers));
            return buttons.render(box).then(function () { if (mine === run) say("", ""); });
          }).catch(failed);
          function thanks() { if (mine === run) say("cc-give-ok", T("Danke, deine Spende ist angekommen.", "Thank you, your donation went through.")); }
          function failed() { if (mine === run) say("cc-give-err", T("PayPal ist gerade nicht erreichbar. Versuch es später noch einmal oder nimm einen anderen Weg.", "PayPal cannot be reached right now. Try again later or pick another way to give.")); }
        }
        render();
        return often.first();
      }
    });
  }

  /* The crypto window. The code comes first, since it is what the window is opened for; the chain
     is switched right under the address it changes, and the coins wait below as tiles. */
  var qrLoad = null;
  function qrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLoad) {
      qrLoad = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "/plugins/towertorch/vendor/qrcode.js";
        s.onload = function () { if (window.qrcode) resolve(window.qrcode); else reject(new Error("qrcode")); };
        s.onerror = function () { qrLoad = null; s.remove(); reject(new Error("qrcode")); };
        document.head.appendChild(s);
      });
    }
    return qrLoad;
  }
  var SVG = "http://www.w3.org/2000/svg";
  // Black on white in every theme: an inverted code is outside the standard, and the wallets a
  // donor holds are the scanners that refuse one.
  function qrSvg(lib, text) {
    var qr = lib(0, "M");
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2, d = "";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) if (qr.isDark(y, x)) d += "M" + (x + quiet) + " " + (y + quiet) + "h1v1h-1z";
    }
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", text);
    var bg = document.createElementNS(SVG, "rect"), path = document.createElementNS(SVG, "path");
    bg.setAttribute("width", size);
    bg.setAttribute("height", size);
    bg.setAttribute("fill", "#ffffff");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#000000");
    svg.appendChild(bg);
    svg.appendChild(path);
    return svg;
  }
  function coinMark(id) {
    var m = COIN_MARK[id], svg = document.createElementNS(SVG, "svg"), path = document.createElementNS(SVG, "path");
    svg.setAttribute("viewBox", m[0]);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("d", m[1]);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }
  function copyText(text, host) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = el("textarea", "cc-give-copysrc");
      ta.value = text;
      ta.setAttribute("readonly", "");
      host.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      if (ok) resolve(); else reject(new Error("copy"));
    });
  }

  function openCrypto(opener) {
    var coin = COINS[0], net = coin.networks[0], copiedTimer = 0;
    var copyLbl = T("Kopieren", "Copy"), title = T("Mit Krypto spenden", "Donate with crypto");
    openWindow({
      cls: "cc-give-crypto", title: title, opener: opener,
      intro: T("Wähle eine Währung und ein Netzwerk, dann scanne den Code oder kopiere die Adresse.", "Pick a currency and a network, then scan the code or copy the address."),
      onClose: function () { clearTimeout(copiedTimer); },
      build: function (card, win) {
        var well = el("div", "cc-give-well");
        var plate = el("div", "cc-give-qr");
        var addr = el("p", "cc-give-addr");
        addr.dir = "ltr";
        var nets = el("div", "cc-give-nets");
        nets.setAttribute("role", "listbox");
        nets.setAttribute("aria-label", T("Netzwerke", "Networks"));
        var note = el("p", "cc-give-note", T("Kein Destination Tag und kein Memo nötig.", "No destination tag and no memo needed."));
        var copy = control("cc-win-btn cc-give-copy", copyLbl);
        [plate, addr, nets, note, copy].forEach(function (n) { well.appendChild(n); });
        var grid = el("div", "cc-give-coins");
        grid.setAttribute("role", "listbox");
        grid.setAttribute("aria-label", title);
        var tiles = COINS.map(function (c) {
          var b = control("cc-give-coin");
          b.setAttribute("role", "option");
          b.setAttribute("aria-label", c.name + " (" + c.symbol + ")");
          b.setAttribute("data-tip", c.name);
          b.style.setProperty("--cc-give-tile", c.tile[0]);
          b.style.setProperty("--cc-give-tile-ink", c.tile[1]);
          b.style.setProperty("--cc-give-mark", c.rest || c.tile[0]);
          var m = el("span", "cc-give-coinmark");
          m.appendChild(coinMark(c.id));
          b.appendChild(m);
          b.appendChild(el("span", "cc-give-tick", c.symbol));
          // Always the new coin's first network, never a chain carried over.
          b.addEventListener("click", function () { coin = c; net = c.networks[0]; show(); });
          grid.appendChild(b);
          return b;
        });
        card.appendChild(well);
        card.appendChild(grid);

        copy.addEventListener("click", function () {
          copyText(net.address, win).then(function () {
            copy.textContent = T("Kopiert", "Copied");
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(function () { copy.textContent = copyLbl; }, 1500);
          }, function () { window.CCTheme.shake(copy); });
        });

        function show() {
          clearTimeout(copiedTimer);
          copy.textContent = copyLbl;
          // The address is never shortened: it is read back by eye before sending.
          addr.textContent = net.address;
          var shownFor = net.address;
          qrLib().then(function (lib) {
            if (net.address !== shownFor) return;
            plate.textContent = "";
            plate.appendChild(qrSvg(lib, shownFor));
          }, function () { plate.hidden = true; });
          // Shown for a single network too, since it names the address's chain.
          nets.textContent = "";
          coin.networks.forEach(function (n, i) {
            var chip = control("cc-give-net", n.name);
            chip.setAttribute("role", "option");
            chip.setAttribute("aria-selected", n === net ? "true" : "false");
            hue(chip, i);
            chip.addEventListener("click", function () { net = n; show(); nets.children[i].focus(); });
            nets.appendChild(chip);
          });
          note.hidden = !net.notag;
          tiles.forEach(function (b, i) {
            var on = COINS[i] === coin;
            b.setAttribute("aria-selected", on ? "true" : "false");
            hue(b, on ? i : null);
          });
        }
        show();
        return copy;
      }
    });
  }

  window.CCGive = { coffee: openCoffee, paypal: openPaypal, crypto: openCrypto };
})();
