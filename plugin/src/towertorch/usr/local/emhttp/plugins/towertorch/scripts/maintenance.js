// The maintenance plan's panel: a button in the Docker tab's bar, the window it opens and the card
// on the settings page. The engine does the work and keeps the plan; every change here is saved
// the moment it is made, and an open window follows a run as it goes.
(function () {
  "use strict";
  if (window.TTMaint) return;

  var PROXY = "/plugins/towertorch/server/ttapi.php";
  var LANG = (document.documentElement.lang || navigator.language || "en").slice(0, 2).toLowerCase() === "de" ? "de" : "en";
  var STEPS = ["backup", "update", "check", "restart"];
  var GLYPH = { backup: "BackupNow", update: "Update", check: "ShieldOn", restart: "Power" };
  var APPS = { bombvault: "BombVault", shiplog: "ShipLog", firesquire: "FireSquire" };
  var DEFAULT_AT = "03:30";

  var T = {
    en: {
      "bar.maint": "Maintenance plan",
      "bar.busy": "Maintenance running, {i} of {n}",
      "bar.busyStep": "Maintenance running",
      "mw.title": "Maintenance plan",
      "mw.info": "Backs up, updates, checks and restarts, in that order. Each step waits for the one before.",
      "seg.plan": "Plan",
      "seg.run": "Run",
      "seg.report": "Last report",
      "seg.noReport": "Nothing has run yet, so there's no report.",
      "sec.steps": "Steps",
      "sec.steps.info": "The order is fixed. Switch off any step you want to leave out.",
      "step.backup": "Back up",
      "step.update": "Update",
      "step.check": "Check",
      "step.restart": "Restart",
      "step.backup.info": "BombVault backs up each chosen container, one after the other. If a backup fails, the run stops there.",
      "step.update.info": "ShipLog updates the chosen containers. It holds back any update that has no backup.",
      "step.check.info": "FireSquire checks whether {server} can restart safely. On NO-GO the server stays up.",
      "step.restart.info": "Restarts {server}. Once it's back, the start plan brings your containers up.",
      "avail.found": "{app} on {device}: Connected",
      "avail.offline": "{app} on {device}: Not reachable",
      "avail.backup.no": "No backup app on this server, so this step is skipped",
      "avail.update.no": "ShipLog isn't in your fortress yet, so this step is skipped",
      "avail.elsewhere": "That app runs on {devices} only, so this step is skipped",
      "avail.noFortress": "TowerTorch isn't in a fortress yet, so this step is skipped",
      "avail.check.ok": "FireSquire is installed",
      "avail.check.no": "FireSquire is missing, so {server} won't restart either",
      "avail.restart.ok": "The start plan takes over afterwards",
      "avail.restart.no": "Held back, because nothing checks the server first",
      "avail.off": "Switched off",
      "sec.cts": "Containers",
      "sec.cts.info": "Back up and Update both use this selection.",
      "cts.all": "All containers",
      "cts.pick": "Selection",
      "cts.count": "{n} of {total} chosen",
      "cts.allCount": "All {total}, new ones join by themselves",
      "cts.idle": "Only Back up and Update use containers, and both are off.",
      "sec.sched": "Schedule",
      "sched.on": "Run on a schedule",
      "sched.info": "Leave every day unpicked and it runs daily.",
      "sched.days": "Days",
      "sched.time": "Time",
      "sched.pickTime": "Pick a time",
      "sched.hours": "Hours",
      "sched.minutes": "Minutes",
      "sched.next": "Next run: {when}",
      "sched.offNote": "Runs only when you start it.",
      "sched.daily": "every day",
      "sched.at": "{days} at {t}",
      "btn.run": "Run now",
      "btn.stop": "Stop",
      "lock.note": "The plan is locked while it runs.",
      "err.noSteps": "Switch on at least one step.",
      "err.noCts": "Pick at least one container.",
      "err.busy": "A run is already going. Only one runs at a time.",
      "err.save": "The plan wasn't saved: {e}",
      "err.start": "The run didn't start: {e}",
      "err.load": "TowerTorch's engine didn't answer: {e}",
      "saved": "Plan saved",
      "run.since": "Running since {t}",
      "run.fortress": "Fortress",
      "run.fortressVal": "busy, please don't restart",
      "run.fortressInfo": "While the run lasts, TowerTorch asks the other apps in your fortress not to restart the server.",
      "prog.backup": "{item} is being backed up, {i} of {n}",
      "prog.update": "ShipLog is updating the containers",
      "prog.check": "FireSquire is checking {server}",
      "prog.restart": "{server} is restarting. This page comes back once it's up.",
      "pend.skipUpdate": "Will be skipped, ShipLog is missing",
      "pend.skipBackup": "Will be skipped, no backup app here",
      "pend.skipCheck": "Will be skipped, FireSquire is missing",
      "pend.holdRestart": "Will be held back without a check",
      "s.done": "done",
      "s.warn": "with notes",
      "s.skipped": "skipped",
      "s.failed": "failed",
      "s.held": "held back",
      "s.notRun": "didn't run",
      "s.running": "running",
      "s.stopped": "stopped",
      "s.waiting": "waiting",
      "s.off": "off",
      "o.done": "Done",
      "o.warn": "Done with notes",
      "o.failed": "Failed",
      "o.held": "Restart held back",
      "o.stopped": "Stopped",
      "o.running": "Running",
      "rep.started": "Started",
      "rep.finished": "Finished",
      "rep.trigger": "Trigger",
      "trig.manual": "By hand",
      "trig.schedule": "Schedule",
      "ib.ok": "backed up",
      "ib.failed": "failed",
      "ib.skipped": "didn't run",
      "ib.running": "running",
      "ib.waiting": "waiting",
      "it.gone": "no longer there",
      "iu.updated": "updated",
      "iu.current": "was current",
      "iu.held": "held back",
      "iu.rolled": "rolled back",
      "iu.failed": "failed",
      "if.ok": "fine",
      "if.warn": "caution",
      "if.failed": "blocks",
      "v.GO": "GO",
      "v.CAUTION": "CAUTION",
      "v.NO-GO": "NO-GO",
      "link.snapshot": "Open snapshot",
      "dlg.stop.title": "Stop the maintenance run?",
      "dlg.stop.textBackup": "{item} finishes its backup first. Nothing after it runs.",
      "dlg.stop.text": "The current step finishes first. Nothing after it runs.",
      "dlg.keep": "Keep running",
      "dlg.stop": "Stop",
      "set.sched": "Schedule",
      "set.off": "Off",
      "set.last": "Last run",
      "set.never": "Not run yet",
      "set.fortress": "Fortress",
      "set.missing": "{app} missing",
      "set.open": "Open maintenance plan",
      "set.in": "In your fortress as {device}",
      "set.join": "Join a fortress",
      "set.joinInfo": "Enter your fortress phrase, the twelve words. TowerTorch keeps its own keys only, never the phrase.",
      "set.joinPh": "twelve words",
      "set.joinBtn": "Join",
      "set.joined": "TowerTorch is in the fortress now",
      "set.leaveRow": "This app in the fortress",
      "set.leaveAbout": "Takes TowerTorch out of the fortress. The current phrase brings it back.",
      "set.leave": "Leave",
      "set.leaveTitle": "Leave the fortress?",
      "set.leaveBody": "The other apps won't see TowerTorch anymore, and every permission with TowerTorch ends. You can come back any time with the phrase.",
      "set.cancel": "Cancel",
      "set.left": "TowerTorch has left the fortress.",
      "set.removedRow": "Taken out",
      "set.removed": "Another member of the fortress took {server} out of it. The plan runs without backups and updates until you join again with the current phrase below.",
      "set.changedRow": "New phrase",
      "set.changed": "Your fortress has a new phrase that TowerTorch couldn't follow on its own. Enter the new words below and it stays the same member. Until then the plan runs without backups and updates.",
      "err.notMember": "TowerTorch isn't in a fortress.",
      "rep.notify": "Notification",
      "rep.sent": "sent",
      "rep.sentAll": "sent to {n} of {total} channels",
      "rep.sentSome": "sent to {n} of {total}, {failed} failed",
      "rep.noChannel": "no channel set up",
      "err.phrase": "These words open no fortress. Check them and try again.",
      "err.member": "TowerTorch is in a fortress already."
    },
    de: {
      "bar.maint": "Wartungsplan",
      "bar.busy": "Wartung läuft, {i} von {n}",
      "bar.busyStep": "Wartung läuft",
      "mw.title": "Wartungsplan",
      "mw.info": "Sichert, aktualisiert, prüft und startet neu, in dieser Reihenfolge. Jeder Schritt wartet auf den vorigen.",
      "seg.plan": "Plan",
      "seg.run": "Lauf",
      "seg.report": "Letzter Bericht",
      "seg.noReport": "Es ist noch nichts gelaufen, deshalb gibt es noch keinen Bericht.",
      "sec.steps": "Schritte",
      "sec.steps.info": "Die Reihenfolge steht fest. Schalte einfach ab, was du auslassen willst.",
      "step.backup": "Sichern",
      "step.update": "Aktualisieren",
      "step.check": "Prüfen",
      "step.restart": "Neu starten",
      "step.backup.info": "BombVault sichert jeden gewählten Container, einen nach dem anderen. Scheitert eine Sicherung, endet der Lauf dort.",
      "step.update.info": "ShipLog aktualisiert die gewählten Container. Ein Update ohne Sicherung hält es zurück.",
      "step.check.info": "FireSquire prüft, ob {server} gefahrlos neu starten kann. Bei NO-GO bleibt der Server an.",
      "step.restart.info": "Startet {server} neu. Sobald er wieder da ist, fährt der Startplan deine Container hoch.",
      "avail.found": "{app} auf {device}: Verbunden",
      "avail.offline": "{app} auf {device}: Nicht erreichbar",
      "avail.backup.no": "Keine Sicherungs-App auf diesem Server, Sichern wird übersprungen",
      "avail.update.no": "ShipLog fehlt in deiner Festung, Aktualisieren wird übersprungen",
      "avail.elsewhere": "Die App läuft nur auf {devices}, der Schritt wird übersprungen",
      "avail.noFortress": "TowerTorch ist noch in keiner Festung, der Schritt wird übersprungen",
      "avail.check.ok": "FireSquire installiert",
      "avail.check.no": "FireSquire fehlt, deshalb startet {server} auch nicht neu",
      "avail.restart.ok": "Danach übernimmt der Startplan",
      "avail.restart.no": "Zurückgehalten, weil vorher niemand den Server prüft",
      "avail.off": "Abgeschaltet",
      "sec.cts": "Container",
      "sec.cts.info": "Sichern und Aktualisieren gelten für dieselbe Auswahl.",
      "cts.all": "Alle Container",
      "cts.pick": "Auswahl",
      "cts.count": "{n} von {total} gewählt",
      "cts.allCount": "Alle {total}, neue kommen von selbst dazu",
      "cts.idle": "Container brauchen nur Sichern und Aktualisieren, und beide sind aus.",
      "sec.sched": "Zeitplan",
      "sched.on": "Nach Zeitplan ausführen",
      "sched.info": "Wählst du keinen Tag, läuft er jeden Tag.",
      "sched.days": "Tage",
      "sched.time": "Uhrzeit",
      "sched.pickTime": "Uhrzeit wählen",
      "sched.hours": "Stunden",
      "sched.minutes": "Minuten",
      "sched.next": "Nächster Lauf: {when}",
      "sched.offNote": "Läuft nur, wenn du ihn startest.",
      "sched.daily": "täglich",
      "sched.at": "{days} um {t}",
      "btn.run": "Jetzt ausführen",
      "btn.stop": "Anhalten",
      "lock.note": "Während des Laufs ist der Plan gesperrt.",
      "err.noSteps": "Schalte mindestens einen Schritt ein.",
      "err.noCts": "Wähl mindestens einen Container aus.",
      "err.busy": "Es läuft schon ein Lauf. Mehr als einer geht nicht gleichzeitig.",
      "err.save": "Der Plan wurde nicht gespeichert: {e}",
      "err.start": "Der Lauf ist nicht gestartet: {e}",
      "err.load": "Die Engine von TowerTorch hat nicht geantwortet: {e}",
      "saved": "Plan gespeichert",
      "run.since": "Läuft seit {t}",
      "run.fortress": "Festung",
      "run.fortressVal": "beschäftigt, bitte nicht neu starten",
      "run.fortressInfo": "Solange der Lauf dauert, bittet TowerTorch die anderen Apps deiner Festung, den Server nicht neu zu starten.",
      "prog.backup": "{item} wird gesichert, {i} von {n}",
      "prog.update": "ShipLog aktualisiert die Container",
      "prog.check": "FireSquire prüft {server}",
      "prog.restart": "{server} startet neu. Die Seite meldet sich, sobald er wieder da ist.",
      "pend.skipUpdate": "Wird übersprungen, ShipLog fehlt",
      "pend.skipBackup": "Wird übersprungen, hier gibt es keine Sicherungs-App",
      "pend.skipCheck": "Wird übersprungen, FireSquire fehlt",
      "pend.holdRestart": "Wird ohne Prüfung zurückgehalten",
      "s.done": "erledigt",
      "s.warn": "mit Hinweisen",
      "s.skipped": "übersprungen",
      "s.failed": "gescheitert",
      "s.held": "zurückgehalten",
      "s.notRun": "nicht gelaufen",
      "s.running": "läuft",
      "s.stopped": "angehalten",
      "s.waiting": "wartet",
      "s.off": "aus",
      "o.done": "Fertig",
      "o.warn": "Fertig mit Hinweisen",
      "o.failed": "Gescheitert",
      "o.held": "Neustart zurückgehalten",
      "o.stopped": "Angehalten",
      "o.running": "Läuft",
      "rep.started": "Start",
      "rep.finished": "Ende",
      "rep.trigger": "Auslöser",
      "trig.manual": "Von Hand",
      "trig.schedule": "Zeitplan",
      "ib.ok": "gesichert",
      "ib.failed": "gescheitert",
      "ib.skipped": "nicht gelaufen",
      "ib.running": "läuft",
      "ib.waiting": "wartet",
      "it.gone": "gibt es nicht mehr",
      "iu.updated": "aktualisiert",
      "iu.current": "war aktuell",
      "iu.held": "zurückgehalten",
      "iu.rolled": "zurückgerollt",
      "iu.failed": "gescheitert",
      "if.ok": "in Ordnung",
      "if.warn": "Vorsicht",
      "if.failed": "blockiert",
      "v.GO": "GO",
      "v.CAUTION": "VORSICHT",
      "v.NO-GO": "NO-GO",
      "link.snapshot": "Snapshot öffnen",
      "dlg.stop.title": "Wartungslauf anhalten?",
      "dlg.stop.textBackup": "{item} wird noch fertig gesichert. Danach läuft nichts mehr.",
      "dlg.stop.text": "Der laufende Schritt wird noch fertig. Danach läuft nichts mehr.",
      "dlg.keep": "Weiterlaufen lassen",
      "dlg.stop": "Anhalten",
      "set.sched": "Zeitplan",
      "set.off": "Aus",
      "set.last": "Letzter Lauf",
      "set.never": "Noch nicht gelaufen",
      "set.fortress": "Festung",
      "set.missing": "{app} fehlt",
      "set.open": "Wartungsplan öffnen",
      "set.in": "In deiner Festung als {device}",
      "set.join": "Festung beitreten",
      "set.joinInfo": "Gib die Phrase deiner Festung ein, die zwölf Wörter. TowerTorch behält nur seine eigenen Schlüssel, nie die Phrase.",
      "set.joinPh": "zwölf Wörter",
      "set.joinBtn": "Beitreten",
      "set.joined": "TowerTorch ist jetzt in der Festung",
      "set.leaveRow": "Diese App in der Festung",
      "set.leaveAbout": "Nimmt TowerTorch aus der Festung. Mit der aktuellen Phrase kommt TowerTorch zurück.",
      "set.leave": "Verlassen",
      "set.leaveTitle": "Festung verlassen?",
      "set.leaveBody": "Die anderen Apps sehen TowerTorch danach nicht mehr, und alle Erlaubnisse mit TowerTorch enden. Zurück kommst du jederzeit mit der Phrase.",
      "set.cancel": "Abbrechen",
      "set.left": "TowerTorch hat die Festung verlassen.",
      "set.removedRow": "Herausgenommen",
      "set.removed": "Ein anderes Mitglied der Festung hat {server} herausgenommen. Bis du mit der aktuellen Phrase unten wieder beitrittst, läuft der Plan ohne Sicherungen und Updates.",
      "set.changedRow": "Neue Phrase",
      "set.changed": "Deine Festung hat eine neue Phrase, der TowerTorch nicht von selbst folgen konnte. Gib unten die neuen Wörter ein, dann bleibt TowerTorch dasselbe Mitglied wie bisher. Bis dahin läuft der Plan ohne Sicherungen und Updates.",
      "err.notMember": "TowerTorch ist in keiner Festung.",
      "rep.notify": "Benachrichtigung",
      "rep.sent": "gesendet",
      "rep.sentAll": "an {n} von {total} Kanälen gesendet",
      "rep.sentSome": "an {n} von {total} gesendet, {failed} gescheitert",
      "rep.noChannel": "kein Kanal eingerichtet",
      "err.phrase": "Diese Wörter öffnen keine Festung. Prüf sie und versuch es noch einmal.",
      "err.member": "TowerTorch ist schon in einer Festung."
    }
  };

  function t(k, args) {
    var s = T[LANG][k] != null ? T[LANG][k] : T.en[k] != null ? T.en[k] : k;
    if (args) Object.keys(args).forEach(function (a) { s = s.split("{" + a + "}").join(args[a]); });
    return s;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function theme() { return window.TTTheme || {}; }
  function glyph(name) { return theme().glyph ? theme().glyph(name) : ""; }
  function info(tip) { return '<span class="tt-info" tabindex="0" role="img" aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '">' + (theme().TT_INFO_SVG || "") + "</span>"; }
  function toast(msg, kind) { if (theme().toast) theme().toast(msg, kind); }
  function deny(el, msg) { if (theme().deny) theme().deny(el); if (msg) toast(msg, "error"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    try { return d.toLocaleString(LANG, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return d.toISOString(); }
  }
  function appName(id) { return APPS[id] || id || ""; }
  function server() { return (S.o && S.o.server) || "Unraid"; }
  function safeLink(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }

  function csrfToken() {
    try {
      if (typeof window.csrf_token !== "undefined" && window.csrf_token) return window.csrf_token;
      var f = document.querySelector('input[name="csrf_token"]'); if (f && f.value) return f.value;
      var m = (document.cookie || "").match(/csrf_token=([0-9A-Za-z]+)/); if (m) return m[1];
    } catch (e) {}
    return "";
  }
  // Writes go form-encoded with the csrf_token in the body, which is the one way emhttp lets a
  // POST through, and ttapi.php unwraps `data` into the JSON body again.
  function api(method, path, body, query) {
    var opts = { method: method, headers: { Accept: "application/json" } };
    var url = PROXY + "?path=" + encodeURIComponent(path) + (query ? "&" + query : "");
    if (method !== "GET") {
      var tk = csrfToken();
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = (tk ? "csrf_token=" + encodeURIComponent(tk) + "&" : "") + "data=" + encodeURIComponent(JSON.stringify(body || {}));
    }
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (txt) {
        var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!r.ok || data == null) { var err = new Error((data && data.error) || "HTTP " + r.status); err.status = r.status; err.code = data && data.error; throw err; }
        return data;
      });
    });
  }

  var S = { o: null, plan: null, mode: "all", view: "plan", open: {}, tp: false, win: null, anchor: null, bars: [], cards: [], timer: 0, toastT: 0, saving: 0 };

  // A plan that was never saved has no step on. The panel offers every step on, all containers
  // and no schedule, and saves that with the first change or the first run.
  function fromEngine(p) {
    p = p || {};
    var steps = p.steps || {};
    var fresh = !STEPS.some(function (s) { return steps[s]; });
    var plan = {
      steps: fresh ? { backup: true, update: true, check: true, restart: true } : { backup: !!steps.backup, update: !!steps.update, check: !!steps.check, restart: !!steps.restart },
      containers: (p.containers || []).slice(),
      schedule: { on: !!(p.schedule && p.schedule.on), days: ((p.schedule && p.schedule.days) || []).slice(), at: (p.schedule && p.schedule.at) || DEFAULT_AT }
    };
    return { plan: plan, fresh: fresh };
  }

  function running() { return !!(S.o && S.o.running); }

  function load() {
    return api("GET", "maintenance", null, "lang=" + LANG).then(function (o) {
      S.o = o;
      // An answer that left before a change was saved would undo it on screen.
      if (!S.saving) {
        var p = fromEngine(o.plan);
        S.plan = p.plan; S.fresh = p.fresh;
        S.mode = S.plan.containers.length ? "pick" : "all";
      }
      if (S.view === "run" && !o.running) S.view = o.last ? "report" : "plan";
      paint();
    }, function (e) {
      if (!S.o) toast(t("err.load", { e: e.message }), "error");
    }).then(schedule);
  }
  function schedule() {
    clearTimeout(S.timer);
    var live = S.win || S.bars.some(function (b) { return b.isConnected; }) || S.cards.some(function (c) { return c.isConnected; });
    if (live) S.timer = setTimeout(load, running() ? 3000 : 30000);
  }

  function save() {
    var body = { steps: S.plan.steps, containers: S.mode === "pick" ? S.plan.containers : [], schedule: S.plan.schedule };
    S.saving++;
    return api("PUT", "maintenance", body).then(function () {
      S.saving--;
      S.fresh = false;
      clearTimeout(S.toastT);
      S.toastT = setTimeout(function () { toast(t("saved"), "ok"); }, 700);
    }, function (e) {
      S.saving--;
      toast(t("err.save", { e: e.message }), "error");
      return load().then(function () { throw e; });
    });
  }

  // what the panel tells about a step before it runs: [dot class, text]
  function avail(step) {
    var o = S.o || {}, ready = o.ready || {}, p = S.plan;
    if (!p.steps[step]) return ["", t("avail.off")];
    if (step === "backup" || step === "update") {
      if (!ready.fortress) return ["warn", t("avail.noFortress")];
      var f = ready[step] || {};
      if (f.found) return f.online ? ["ok", t("avail.found", { app: appName(f.app), device: f.device })] : ["err", t("avail.offline", { app: appName(f.app), device: f.device })];
      if (f.elsewhere && f.elsewhere.length) return ["warn", t("avail.elsewhere", { devices: f.elsewhere.join(", ") })];
      return ["warn", t("avail." + step + ".no")];
    }
    if (step === "check") return ready.check ? ["ok", t("avail.check.ok")] : ["err", t("avail.check.no", { server: server() })];
    return p.steps.check && !ready.check ? ["warn", t("avail.restart.no")] : ["ok", t("avail.restart.ok")];
  }
  function dayNames() { return LANG === "de" ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; }
  function schedText() {
    var s = S.plan.schedule; if (!s.on) return t("set.off");
    var dn = dayNames();
    var days = s.days.length ? [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return s.days.indexOf(d) >= 0; }).map(function (d) { return dn[d]; }).join(", ") : t("sched.daily");
    return t("sched.at", { days: days, t: s.at });
  }
  function containers() { return (S.o && S.o.containers) || []; }
  function chipCls(state) { return { ok: "ok", done: "ok", warn: "warn", held: "warn", failed: "failed", skipped: "neutral", stopped: "neutral", notRun: "dim", waiting: "dim", off: "dim", running: "running" }[state] || "dim"; }
  function chip(cls, text, big) { return '<span class="tt-mw-chip tt-mw-' + cls + (big ? " tt-mw-big" : "") + '">' + esc(text) + "</span>"; }
  function toggle(act, val, on, label) {
    return '<span class="tt-set-toggle' + (on ? " tt-set-toggle-on" : "") + '" role="switch" tabindex="0" data-act="' + act + '"' + (val != null ? ' data-val="' + esc(val) + '"' : "") + ' aria-checked="' + on + '" aria-label="' + esc(label) + '"><span class="tt-set-knob"></span></span>';
  }
  function sec(text, tip) { return '<div class="tt-mw-h"><span class="tt-mw-sec">' + esc(text) + (tip ? info(tip) : "") + "</span></div>"; }

  function viewPlan() {
    var p = S.plan, lk = running() ? " tt-mw-locked" : "";
    var steps = STEPS.map(function (s, i) {
      var a = avail(s);
      return '<div class="tt-mw-block tt-mw-step' + (p.steps[s] ? "" : " tt-mw-off") + lk + '">' +
        '<span class="tt-mw-gtile">' + glyph(GLYPH[s]) + "</span>" +
        '<span class="tt-mw-name"><span class="tt-mw-ord">' + (i + 1) + "</span>" + esc(t("step." + s)) + info(t("step." + s + ".info", { server: server() })) + "</span>" +
        toggle("step", s, p.steps[s], t("step." + s)) +
        '<span class="tt-mw-avail"><span class="tt-mw-dot' + (a[0] ? " tt-mw-dot-" + a[0] : "") + '"></span>' + esc(a[1]) + "</span></div>";
    }).join("");
    var names = containers(), body;
    if (!p.steps.backup && !p.steps.update) body = '<div class="tt-mw-muted">' + esc(t("cts.idle")) + "</div>";
    else {
      body = '<div class="tt-mw-seg" role="tablist">' + ["all", "pick"].map(function (m) {
        return '<span role="tab" tabindex="0" data-act="mode" data-val="' + m + '" aria-selected="' + (S.mode === m) + '">' + esc(t(m === "all" ? "cts.all" : "cts.pick")) + "</span>";
      }).join("") + "</div>" +
        '<div class="tt-mw-muted tt-mw-gap">' + esc(S.mode === "all" ? t("cts.allCount", { total: names.length }) : t("cts.count", { n: p.containers.length, total: names.length })) + "</div>";
      if (S.mode === "pick") {
        body += '<div class="tt-mw-cts" role="group" aria-label="' + esc(t("sec.cts")) + '">' + names.map(function (n) {
          return '<span class="tt-mw-ct" role="checkbox" tabindex="0" data-act="ct" data-val="' + esc(n) + '" aria-checked="' + (p.containers.indexOf(n) >= 0) + '">' + esc(n) + "</span>";
        }).join("") + "</div>";
      }
    }
    var s = p.schedule, sched = '<div class="tt-mw-row"><span class="tt-mw-lbl">' + esc(t("sched.on")) + '</span><span class="tt-mw-spacer"></span>' + toggle("sched", null, s.on, t("sched.on")) + "</div>";
    if (s.on) {
      var dn = dayNames();
      sched += '<div class="tt-mw-row"><span class="tt-mw-lbl">' + esc(t("sched.days")) + info(t("sched.info")) + '</span><span class="tt-days">' +
        [1, 2, 3, 4, 5, 6, 0].map(function (d) { var on = s.days.indexOf(d) >= 0; return '<span class="tt-day' + (on ? " tt-day-on" : "") + '" role="button" tabindex="0" data-act="day" data-val="' + d + '" aria-pressed="' + on + '">' + dn[d] + "</span>"; }).join("") + "</span></div>" +
        '<div class="tt-mw-row"><span class="tt-mw-lbl">' + esc(t("sched.time")) + '</span><span class="tt-mw-tp"><input class="tt-in tt-mw-time" type="text" inputmode="numeric" maxlength="5" value="' + esc(s.at) + '" aria-label="' + esc(t("sched.time")) + '" dir="ltr"><span class="tt-mw-tpbtn" role="button" tabindex="0" data-act="tp" aria-label="' + esc(t("sched.pickTime")) + '" aria-expanded="' + S.tp + '">' + glyph("Schedules") + "</span>" + timePanel() + "</span></div>" +
        '<div class="tt-mw-row tt-mw-muted">' + esc(S.o && S.o.next ? t("sched.next", { when: when(S.o.next) }) : "") + "</div>";
    } else sched += '<div class="tt-mw-row tt-mw-muted">' + esc(t("sched.offNote")) + "</div>";
    return (running() ? '<div class="tt-mw-lockline">' + glyph("Hourglass") + esc(t("lock.note")) + "</div>" : "") +
      sec(t("sec.steps"), t("sec.steps.info")) + "<div>" + steps + "</div>" +
      sec(t("sec.cts"), t("sec.cts.info")) + '<div class="tt-mw-block' + lk + '">' + body + "</div>" +
      sec(t("sec.sched")) + '<div class="tt-mw-block' + lk + '">' + sched + "</div>";
  }
  function timePanel() {
    if (!S.tp) return "";
    var hhmm = S.plan.schedule.at.split(":"), mins = [];
    for (var i = 0; i < 12; i++) mins.push(pad(i * 5));
    if (mins.indexOf(hhmm[1]) < 0) { mins.push(hhmm[1]); mins.sort(); }
    var hours = []; for (var h = 0; h < 24; h++) hours.push(pad(h));
    function col(list, act, cur, label) {
      return '<div class="tt-mw-tpcol" role="listbox" aria-label="' + esc(label) + '">' + list.map(function (x) { return '<span role="option" tabindex="0" data-act="' + act + '" data-val="' + x + '" aria-selected="' + (x === cur) + '">' + x + "</span>"; }).join("") + "</div>";
    }
    return '<div class="tt-mw-tppanel">' + col(hours, "tph", hhmm[0], t("sched.hours")) + col(mins, "tpm", hhmm[1], t("sched.minutes")) + "</div>";
  }

  function itemLabel(step, it) {
    if (it.state === "running") return t("ib.running");
    if (it.state === "waiting") return t("ib.waiting");
    if (it.state === "notRun") return t("ib.skipped");
    if (step === "check") return t({ warn: "if.warn", failed: "if.failed" }[it.state] || "if.ok");
    var k = { "backup.ok": "ib.ok", "backup.failed": "ib.failed", "container.gone": "it.gone", "update.updated": "iu.updated", "update.current": "iu.current", "update.held": "iu.held", "update.rolled_back": "iu.rolled", "update.failed": "iu.failed" }[it.code];
    return t(k || "s." + it.state);
  }
  function itemsHtml(s, current) {
    return (s.items || []).map(function (it) {
      if (current && it.name === current && it.state === "waiting") it = { name: it.name, state: "running" };
      var link = it.state === "ok" ? safeLink(it.link) : "";
      var detail = s.step === "check" || it.state !== "ok" ? it.detail : "";
      return '<div class="tt-mw-it"><span class="tt-mw-nm">' + esc(it.name) + "</span>" + (detail ? '<span class="tt-mw-dt">' + esc(detail) + "</span>" : "") +
        '<span class="tt-mw-rt">' + (link ? '<a class="tt-mw-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + glyph("ExternalLink") + esc(t("link.snapshot")) + "</a>" : "") + chip(chipCls(it.state), itemLabel(s.step, it)) + "</span></div>";
    }).join("");
  }
  function pending(s) {
    var a = avail(s.step);
    if (s.step === "restart") return a[0] === "warn" ? t("pend.holdRestart") : "";
    if (a[0] === "warn" || a[0] === "err") return t({ backup: "pend.skipBackup", update: "pend.skipUpdate", check: "pend.skipCheck" }[s.step]);
    return "";
  }
  function stepRow(s, extra) {
    var st = s.state, live = st === "running", pend = st === "waiting";
    var badge = s.verdict && !live ? chip(s.verdict === "GO" ? "ok" : s.verdict === "CAUTION" ? "warn" : "failed", t("v." + s.verdict)) : chip(chipCls(st), t("s." + st));
    var why = pend ? pending(s) : live ? "" : s.text || "";
    var has = (s.items || []).length > 0, open = has && (!!S.open[s.step] || live);
    var head = '<span class="tt-mw-rshead" role="button" tabindex="0" ' + (has ? 'data-act="exp" data-val="' + s.step + '" aria-expanded="' + open + '"' : 'aria-disabled="true"') + ">" +
      '<span class="tt-mw-gtile">' + glyph(GLYPH[s.step]) + '</span><span class="tt-mw-name">' + esc(t("step." + s.step)) + "</span>" + badge +
      (has ? '<span class="tt-mw-chev" aria-hidden="true">' + glyph("Expand") + "</span>" : "<span></span>") +
      (why ? '<span class="tt-mw-why">' + esc(why) + "</span>" : "") + "</span>";
    var cur = live && S.o.running && S.o.running.step === s.step ? S.o.running.item : "";
    return '<div class="tt-mw-rs">' + head + (extra || "") + (open ? '<div class="tt-mw-items">' + itemsHtml(s, cur) + "</div>" : "") + "</div>";
  }
  function progress() {
    var p = S.o.running, text, pct = null;
    if (p.step === "backup" && p.total) { text = t("prog.backup", { item: p.item, i: p.index, n: p.total }); pct = (p.index - 0.5) / p.total * 100; }
    else text = t("prog." + p.step, { server: server() });
    return '<div class="tt-mw-extra"><div class="tt-mw-progtext">' + esc(text) + '</div><div class="tt-mw-prog' + (pct == null ? " tt-mw-prog-open" : "") + '" role="progressbar" aria-label="' + esc(text) + '"' +
      (pct == null ? "" : ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '"') + '><i style="width:' + (pct == null ? 100 : pct) + '%"></i></div></div>';
  }
  function viewRun() {
    var r = S.o.last, p = S.o.running;
    var rows = r.steps.map(function (s) { return stepRow(s, s.state === "running" && p.step === s.step ? progress() : ""); }).join("");
    return '<div class="tt-mw-block tt-mw-top"><div class="tt-mw-row">' + chip("running", t("s.running"), true) + "<span>" + esc(t("run.since", { t: hm(new Date(p.started)) })) + "</span></div>" +
      '<div class="tt-mw-meta"><div><span>' + esc(t("rep.trigger")) + "</span><b>" + esc(t("trig." + r.trigger)) + "</b></div>" +
      "<div><span>" + esc(t("run.fortress")) + info(t("run.fortressInfo")) + "</span><b>" + esc(t("run.fortressVal")) + "</b></div></div></div>" +
      '<div class="tt-mw-gap">' + rows + "</div>";
  }
  function viewReport() {
    var r = S.o.last;
    return '<div class="tt-mw-block tt-mw-top"><div class="tt-mw-row">' + chip(chipCls(r.outcome), t("o." + r.outcome), true) + "</div>" +
      '<div class="tt-mw-meta"><div><span>' + esc(t("rep.started")) + "</span><b>" + esc(when(r.started)) + "</b></div>" +
      "<div><span>" + esc(t("rep.finished")) + "</span><b>" + esc(r.finished ? hm(new Date(r.finished)) : "") + "</b></div>" +
      "<div><span>" + esc(t("rep.trigger")) + "</span><b>" + esc(t("trig." + r.trigger)) + "</b></div>" +
      (r.notified ? "<div><span>" + esc(t("rep.notify")) + "</span><b>" + esc(delivery(r.notified)) + "</b></div>" : "") + "</div></div>" +
      '<div class="tt-mw-gap">' + r.steps.map(function (s) { return stepRow(s); }).join("") + "</div>";
  }

  // where the run's notification went, as the report says it
  function delivery(n) {
    var failed = n.failed || [], total = n.sent + failed.length;
    if (!total) return t("rep.noChannel");
    if (failed.length) return t("rep.sentSome", { n: n.sent, total: total, failed: failed.join(", ") });
    return total === 1 ? t("rep.sent") : t("rep.sentAll", { n: n.sent, total: total });
  }

  function paintWindow() {
    var w = S.win; if (!w) return;
    var mid = w.querySelector(".tt-win-card"), keep = mid.scrollTop, a = document.activeElement;
    var focusKey = a && w.contains(a) && a.getAttribute("data-act") ? [a.getAttribute("data-act"), a.getAttribute("data-val")] : null;
    var hasSecond = running() || !!(S.o && S.o.last);
    if (S.view !== "plan" && !hasSecond) S.view = "plan";
    if (S.view === "report" && running()) S.view = "run";
    var second = running() ? "run" : "report";
    var body = !S.o ? "" : S.view === "plan" ? viewPlan() : S.view === "run" ? viewRun() : viewReport();
    mid.innerHTML = '<div class="tt-mw-seg" role="tablist">' +
      '<span role="tab" tabindex="0" data-act="view" data-val="plan" aria-selected="' + (S.view === "plan") + '">' + esc(t("seg.plan")) + "</span>" +
      '<span role="tab" tabindex="0" data-act="view" data-val="' + second + '" aria-selected="' + (S.view !== "plan") + '"' + (hasSecond ? "" : ' aria-disabled="true" data-tip="' + esc(t("seg.noReport")) + '"') + ">" +
      (running() ? '<span class="tt-mw-ring" aria-hidden="true"></span>' : "") + esc(t(running() ? "seg.run" : "seg.report")) + "</span></div>" + body;
    mid.scrollTop = keep;
    var act = w.querySelector(".tt-win-act");
    act.innerHTML = running()
      ? '<span class="tt-win-btn tt-win-go" role="button" tabindex="0" data-act="askstop">' + glyph("Stop") + esc(t("btn.stop")) + "</span>"
      : '<span class="tt-win-btn tt-win-go" role="button" tabindex="0" data-act="run">' + glyph("Play") + esc(t("btn.run")) + "</span>";
    if (focusKey) {
      var back = w.querySelector('[data-act="' + focusKey[0] + '"]' + (focusKey[1] != null ? '[data-val="' + focusKey[1] + '"]' : ""));
      if (back) back.focus();
    }
    placeTimePanel();
  }
  function placeTimePanel() {
    var w = S.win, panel = w && w.querySelector(".tt-mw-tppanel"), field = w && w.querySelector(".tt-mw-time");
    if (!panel || !field) return;
    var r = field.getBoundingClientRect(), h = panel.offsetHeight, top = r.bottom + 4;
    if (top + h > window.innerHeight - 16) top = r.top - h - 4;
    panel.style.top = top + "px"; panel.style.left = Math.max(16, Math.min(r.left, window.innerWidth - panel.offsetWidth - 16)) + "px";
    Array.prototype.forEach.call(panel.querySelectorAll(".tt-mw-tpcol"), function (c) { var x = c.querySelector('[aria-selected="true"]'); if (x) c.scrollTop = x.offsetTop - c.clientHeight / 2 + x.offsetHeight / 2; });
  }
  function placeWindow() {
    var w = S.win; if (!w) return;
    if (window.innerWidth <= 640) { w.style.left = ""; w.style.top = ""; return; }
    var a = S.anchor && S.anchor.isConnected ? S.anchor.getBoundingClientRect() : null;
    var ww = w.offsetWidth, h = w.offsetHeight, E = 16;
    var left = a ? a.left : (window.innerWidth - ww) / 2, top = a ? a.bottom + 10 : (window.innerHeight - h) / 2;
    if (a && top + h > window.innerHeight - E) top = a.top - h - 10;
    top = Math.max(E + 11, Math.min(top, window.innerHeight - E - h));
    left = Math.min(Math.max(E, left), window.innerWidth - E - ww);
    w.style.left = left + "px"; w.style.top = top + "px";
  }

  function open(anchor, view) {
    S.anchor = anchor || S.anchor;
    if (view) S.view = view; else if (running()) S.view = "run";
    if (S.win) { paintWindow(); return; }
    var w = document.createElement("div"); w.className = "tt-win tt-mw";
    w.innerHTML = '<div class="tt-win-title">' + esc(t("mw.title")) + info(t("mw.info")) + '</div><div class="tt-win-card"></div><div class="tt-win-act"></div>';
    document.body.appendChild(w);
    S.win = w;
    w.addEventListener("click", onClick);
    w.addEventListener("keydown", onKey);
    w.addEventListener("change", onChange);
    w.querySelector(".tt-win-card").addEventListener("scroll", placeTimePanel);
    paintWindow(); placeWindow();
    var h = theme().modal ? theme().modal(w, { opener: S.anchor, onDismiss: function () { if (S.tp) { S.tp = false; paintWindow(); return; } close(); } }) : null;
    S.close = function () { if (h) h.close(); else if (w.parentNode) w.parentNode.removeChild(w); };
    load();
  }
  function close() { if (S.close) S.close(); S.win = null; S.close = null; S.tp = false; schedule(); }

  function locked(el) { return running() && el.closest(".tt-mw-locked"); }
  function onClick(e) {
    var el = e.target.closest("[data-act]");
    if (!el || !S.win.contains(el)) { if (S.tp && !e.target.closest(".tt-mw-tp")) { S.tp = false; paintWindow(); } return; }
    if (locked(el)) return deny(el, t("lock.note"));
    var act = el.getAttribute("data-act"), val = el.getAttribute("data-val"), p = S.plan;
    switch (act) {
      case "view":
        if (el.getAttribute("aria-disabled") === "true") return deny(el, t("seg.noReport"));
        S.view = val; S.tp = false; paintWindow(); break;
      case "step":
        if (p.steps[val] && STEPS.filter(function (s) { return p.steps[s]; }).length === 1) return deny(el, t("err.noSteps"));
        p.steps[val] = !p.steps[val]; save(); paint(); break;
      case "mode":
        if (S.mode === val) break;
        S.mode = val;
        if (val === "pick" && !p.containers.length) p.containers = containers().slice();
        save(); paint(); break;
      case "ct": {
        var i = p.containers.indexOf(val);
        if (i >= 0 && p.containers.length === 1) return deny(el, t("err.noCts"));
        if (i >= 0) p.containers.splice(i, 1); else p.containers.push(val);
        save(); paint(); break;
      }
      case "sched": p.schedule.on = !p.schedule.on; S.tp = false; save(); paint(); break;
      case "day": {
        var d = +val, j = p.schedule.days.indexOf(d);
        if (j >= 0) p.schedule.days.splice(j, 1); else p.schedule.days.push(d);
        save(); paint(); break;
      }
      case "tp": S.tp = !S.tp; paintWindow(); break;
      case "tph": case "tpm": {
        var hhmm = p.schedule.at.split(":");
        p.schedule.at = act === "tph" ? val + ":" + hhmm[1] : hhmm[0] + ":" + val;
        if (act === "tpm") S.tp = false;
        save().then(load); paint(); break;
      }
      case "exp": S.open[val] = !S.open[val]; paintWindow(); break;
      case "run": run(el); break;
      case "askstop": askStop(); break;
    }
  }
  function onKey(e) {
    var el = e.target;
    if ((e.key === "Enter" || e.key === " ") && el.getAttribute && el.getAttribute("data-act") && el.tagName !== "INPUT" && el.tagName !== "A") { e.preventDefault(); el.click(); return; }
    if (el.classList && el.classList.contains("tt-mw-time") && e.key === "Enter") { el.blur(); return; }
    if (S.tp && (e.key === "ArrowUp" || e.key === "ArrowDown") && el.closest && el.closest(".tt-mw-tpcol")) {
      e.preventDefault();
      var sib = e.key === "ArrowUp" ? el.previousElementSibling : el.nextElementSibling;
      if (sib) { var act = sib.getAttribute("data-act"), v = sib.getAttribute("data-val"); sib.click(); var again = S.win && S.win.querySelector('[data-act="' + act + '"][data-val="' + v + '"]'); if (again) again.focus(); }
    }
  }
  function onChange(e) {
    if (!e.target.classList.contains("tt-mw-time")) return;
    var m = /^(\d{1,2}):?(\d{2})$/.exec(e.target.value.trim());
    if (!m || +m[1] > 23 || +m[2] > 59) { if (theme().shake) theme().shake(e.target); e.target.value = S.plan.schedule.at; return; }
    S.plan.schedule.at = pad(+m[1]) + ":" + m[2];
    save().then(load); paint();
  }

  function run(el) {
    if (running()) return deny(el, t("err.busy"));
    var p = S.plan;
    if (!STEPS.some(function (s) { return p.steps[s]; })) return deny(el, t("err.noSteps"));
    if ((p.steps.backup || p.steps.update) && S.mode === "pick" && !p.containers.length) return deny(el, t("err.noCts"));
    (S.fresh ? save() : Promise.resolve()).then(function () {
      return api("POST", "maintenancerun", {});
    }).then(function () {
      S.view = "run"; return load();
    }, function (e) {
      if (e.status === 409) deny(el, t("err.busy"));
      else if (e.message) deny(el, t("err.start", { e: e.message }));
    });
  }
  function askStop() {
    var p = S.o && S.o.running;
    var text = p && p.step === "backup" && p.item ? t("dlg.stop.textBackup", { item: p.item }) : t("dlg.stop.text");
    var go = function () { api("POST", "maintenancestop", {}).then(load, function (e) { toast(e.message, "error"); }); };
    if (theme().ask) theme().ask({ title: t("dlg.stop.title"), text: text, ok: t("dlg.stop"), cancel: t("dlg.keep"), glyph: "Stop", cancelGlyph: "Play", onOk: go });
    else go();
  }

  // the bar button, put next to "Check for updates" whenever docker.js arranges the bar
  function bar(barEl) {
    var b = barEl.querySelector(".tt-maintbtn");
    if (!b) {
      b = document.createElement("span"); b.className = "tt-maintbtn";
      b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); b.setAttribute("aria-haspopup", "dialog");
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); open(b); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(b); } });
      S.bars.push(b);
      if (!S.o) load();
    }
    var check = barEl.querySelector('input[type=button][onclick^="checkAll("]');
    if (check ? b.previousElementSibling !== check : b.parentElement !== barEl) barEl.insertBefore(b, check ? check.nextSibling : null);
    paintBar(b);
  }
  function busyLabel() {
    var p = S.o && S.o.running;
    if (!p) return "";
    return p.step === "backup" && p.total ? t("bar.busy", { i: p.index, n: p.total }) : t("bar.busyStep");
  }
  function paintBar(b) {
    var busy = running(), html = (busy ? '<span class="tt-mw-ring" aria-hidden="true"></span>' : glyph("Calendar")) + '<span class="tt-maintbtn-l">' + esc(busy ? busyLabel() : t("bar.maint")) + "</span>";
    if (b.innerHTML !== html) b.innerHTML = html;
  }

  // the settings card: settings.js makes the card in its own look and hands it over
  function card(c) {
    var body = document.createElement("div"); body.className = "tt-mw-card";
    c.appendChild(body);
    body.addEventListener("click", function (e) {
      var el = e.target.closest("[data-act]"); if (!el) return;
      if (el.getAttribute("data-act") === "open") open(el, S.o && S.o.last && !running() ? "report" : null);
      if (el.getAttribute("data-act") === "join") join(el, body.querySelector(".tt-mw-phrase"));
      if (el.getAttribute("data-act") === "leave") leave(el);
    });
    body.addEventListener("keydown", function (e) {
      var el = e.target;
      if (el.classList.contains("tt-mw-phrase") && e.key === "Enter") { e.preventDefault(); join(body.querySelector('[data-act="join"]'), el); return; }
      if ((e.key === "Enter" || e.key === " ") && el.getAttribute("data-act")) { e.preventDefault(); el.click(); }
    });
    S.cards.push(body);
    if (S.o) paintCard(body); else load();
    return c;
  }
  function paintCard(body) {
    var o = S.o || {}, r = o.last, ready = o.ready || {};
    var last = running() ? chip("running", t("s.running")) + "<span>" + esc(busyLabel()) + "</span>"
      : r ? chip(chipCls(r.outcome), t("o." + r.outcome)) + "<span>" + esc(when(r.started)) + "</span>" : "<span>" + esc(t("set.never")) + "</span>";
    var apps = [["backup", "BombVault", ready.backup && ready.backup.found], ["update", "ShipLog", ready.update && ready.update.found], ["check", "FireSquire", ready.check]].map(function (a) {
      return '<span class="tt-mw-av"><span class="tt-mw-dot tt-mw-dot-' + (a[2] ? "ok" : "warn") + '"></span>' + esc(a[2] ? a[1] : t("set.missing", { app: a[1] })) + "</span>";
    }).join("");
    var html = '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.sched")) + '</span><span class="tt-mw-setval">' + esc(S.plan ? schedText() : "") + "</span></div>" +
      '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.last")) + '</span><span class="tt-mw-setval">' + last + "</span></div>" +
      '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.fortress")) + '</span><span class="tt-mw-setval">' + apps + "</span></div>";
    if (ready.fortress) {
      html += '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.leaveRow")) + info(t("set.leaveAbout")) + "</span>" +
        '<span class="tt-mw-setval"><span class="tt-mw-device">' + esc(t("set.in", { device: ready.device || "" })) + "</span>" +
        '<span class="tt-btn" role="button" tabindex="0" data-act="leave">' + glyph("SignOut") + esc(t("set.leave")) + "</span></span></div>";
    }
    if (ready.removed && !ready.fortress) {
      html += '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.removedRow")) + '</span><span class="tt-mw-setval tt-mw-removed">' + esc(t("set.removed", { server: server() })) + "</span></div>";
    }
    if (ready.fortress && ready.phraseChanged) {
      html += '<div class="tt-set-row"><span class="tt-set-rl">' + esc(t("set.changedRow")) + '</span><span class="tt-mw-setval tt-mw-removed">' + esc(t("set.changed")) + "</span></div>";
    }
    if (S.o && (!ready.fortress || ready.phraseChanged)) {
      html += '<div class="tt-set-row tt-mw-joinrow"><span class="tt-set-rl">' + esc(t("set.join")) + info(t("set.joinInfo")) + "</span>" +
        '<span class="tt-mw-setval"><input class="tt-in tt-mw-phrase" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(t("set.joinPh")) + '" aria-label="' + esc(t("set.join")) + '">' +
        '<span class="tt-btn" role="button" tabindex="0" data-act="join">' + esc(t("set.joinBtn")) + "</span></span></div>";
    }
    html += '<div class="tt-mw-foot"><span class="tt-btn" role="button" tabindex="0" data-act="open" aria-haspopup="dialog">' + glyph("Calendar") + esc(t("set.open")) + "</span></div>";
    var phrase = body.querySelector(".tt-mw-phrase"), typed = phrase ? phrase.value : "", focused = phrase && document.activeElement === phrase;
    if (body.getAttribute("data-html") === html) return;
    body.innerHTML = html; body.setAttribute("data-html", html);
    var again = body.querySelector(".tt-mw-phrase");
    if (again) { again.value = typed; if (focused) again.focus(); }
  }
  function join(btn, field) {
    var words = field ? field.value.trim() : "";
    if (!words) return deny(field || btn, t("err.phrase"));
    api("POST", "fortressjoin", { phrase: words }).then(function () {
      field.value = "";
      toast(t("set.joined"), "ok");
      return load();
    }, function (e) {
      deny(field, t(e.code === "member" ? "err.member" : e.code === "phrase" ? "err.phrase" : "err.load", { e: e.message }));
    });
  }

  // Leaving asks first and is no red button: the window says what ends, and the
  // phrase brings TowerTorch back.
  function leave(btn) {
    var go = function () {
      api("POST", "fortressleave", {}).then(function () {
        toast(t("set.left"), "ok");
        return load();
      }, function (e) {
        deny(btn, e.code === "notMember" ? t("err.notMember") : t("err.load", { e: e.message }));
        load();
      });
    };
    if (theme().ask) theme().ask({ title: t("set.leaveTitle"), text: t("set.leaveBody"), ok: t("set.leave"), cancel: t("set.cancel"), glyph: "SignOut", cancelGlyph: "Close", opener: btn, onOk: go });
    else go();
  }

  function paint() {
    S.bars = S.bars.filter(function (b) { return b.isConnected; });
    S.cards = S.cards.filter(function (c) { return c.isConnected; });
    S.bars.forEach(paintBar);
    S.cards.forEach(paintCard);
    paintWindow();
  }

  window.addEventListener("resize", function () { placeWindow(); placeTimePanel(); });
  window.TTMaint = { bar: bar, card: card, open: open, t: t };
})();
