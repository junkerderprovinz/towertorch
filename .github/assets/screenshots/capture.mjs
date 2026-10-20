// Takes the raw pictures for the README screenshots from a running Unraid server with
// TowerTorch installed: each page once as a list and once as tiles, in English and with
// made-up names in place of the server's own. render.mjs frames them.
//
// The server is only read. Every request other than a GET or a GraphQL query is dropped, and the
// share and disk lists, which wipe their cached sizes when asked without "all", are always asked
// with it and for a share that does not exist, so nothing gets computed either. The look (accent,
// colour mode, view) is handed to the page in the settings response and never written back.
//
// Unraid prints its text in the server's language. TowerTorch follows the lang attribute,
// Unraid's scripts get an English translate.js, and what PHP printed is mapped back through the
// server's own language files.
//
// SHOT_DENY takes comma-separated words that must not show on a page. Hits are printed and the
// picture is still taken, so it can be checked.
//
// Deps (global): playwright-core with its Chromium installed.
// Run: UNRAID_URL=https://<server> UNRAID_PW=<root password> node .github/assets/screenshots/capture.mjs [page...]

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync("npm root -g").toString().trim()}/playwright-core`);

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "captures");
const BASE = (process.env.UNRAID_URL || "").replace(/\/+$/, "");
const USER = process.env.UNRAID_USER || "root";
const PASSWORD = process.env.UNRAID_PW;
if (!BASE || !PASSWORD) throw new Error("set UNRAID_URL and UNRAID_PW");
const DENY = (process.env.SHOT_DENY || "").split(",").map((w) => w.trim()).filter(Boolean);
const CHOSEN = process.argv.slice(2);

const VIEW = { width: 1440, height: 900 };
// The pages read TowerTorch's settings, kept in /boot/config/plugins/towertorch, from the engine here.
const SETTINGS = /\/plugins\/towertorch\/server\/ccapi\.php\?path=config(&|$)/;
const DEMO_NAME = "Tower";
const DEMO_DESCRIPTION = "Media server";

// The start plan the pictures show instead of the server's own, so the chain in the window is a
// plain home-server one. The plan is only answered from here, never written to the server.
const DEMO_PLAN = {
  nodes: [
    { name: "MariaDB", after: [], delay_seconds: 0, probe: { kind: "health" }, policy: "abort" },
    { name: "Redis", after: [], delay_seconds: 0, probe: { kind: "health" }, policy: "abort" },
    { name: "PostgreSQL", after: [], delay_seconds: 0, probe: { kind: "health" }, policy: "abort" },
    { name: "Nextcloud", after: ["MariaDB", "Redis"], delay_seconds: 10, probe: { kind: "health" }, policy: "abort" },
    { name: "Immich", after: ["PostgreSQL", "Redis"], delay_seconds: 10, probe: { kind: "health" }, policy: "abort" },
    { name: "Tautulli", after: ["Plex"], delay_seconds: 20, probe: { kind: "health" }, policy: "continue" },
  ],
};

// Unraid prints the login page in the server's language and the pictures are English.
const LOGIN_ENGLISH = { "Passwort-Wiederherstellung": "Password recovery", Benutzername: "Username", Passwort: "Password", Anmelden: "Login" };
const LOGIN_ACCENT = "#FF832B";

// Applied on every page on top of the server's own settings, so each picture shows the accent
// itself rather than the palette, and every area follows the one accent.
const LOOK = {
  "cc.theming": "1",
  "cc.rainbow": "0",
  "cc.flagmode": "0",
  "cc.rbmode": "all",
  "cc.anim": "off",
  "cc.iconbg": "1",
  "cc.iconbgrainbow": "1",
  "cc.icontint": "1",
  "cc.enable.header": "1",
  "cc.enable.docker": "1",
  "cc.enable.main": "1",
  "cc.enable.shares": "1",
  "cc.enable.plugins": "1",
  "cc.enable.vms": "1",
  "cc.styleheader": "1",
  "cc.styledocker": "1",
  "cc.stylemain": "1",
  "cc.styleshares": "1",
  "cc.styleplugin": "1",
  "cc.stylevms": "1",
};

// What each picture keeps, in the order shown. Everything else on the page is taken out, so
// test machines and private apps never reach a picture, and renamed items read like an ordinary
// home server.
const PAGES = [
  {
    name: "docker",
    path: "/Docker",
    accent: "#FCC419",
    key: "cc.view",
    views: { list: "list", tiles: "grid" },
    keep: ["Plex", "Immich", "Nextcloud", "Nginx", "MariaDB", "PostgreSQL", "Redis", "Tautulli", "CrowdSec",
      "OpenWebUI", "Ollama", "Homarr", "StirlingPDF", "Minecraft"],
    rename: { homarr: "Homarr" },
  },
  {
    name: "startplan",
    path: "/Docker",
    accent: "#3DDBD9",
    key: "cc.view",
    views: { list: "list", tiles: "list" },
    keep: ["Plex", "Immich", "Nextcloud", "Nginx", "MariaDB", "PostgreSQL", "Redis", "Tautulli", "CrowdSec",
      "OpenWebUI", "Ollama", "Homarr", "StirlingPDF", "Minecraft"],
    rename: { homarr: "Homarr" },
    plan: DEMO_PLAN,
    open: "Nextcloud",
  },
  {
    name: "main",
    path: "/Main",
    accent: "#1D99F3",
    key: "cc.diskview",
    views: { list: "list", tiles: "tiles" },
    wake: true,
  },
  {
    name: "shares",
    path: "/Shares",
    accent: "#6FDC8C",
    key: "cc.shareview",
    views: { list: "list", tiles: "tiles" },
    keep: ["appdata", "backups", "domains", "downloads", "games", "immich", "isos", "media", "nextcloud", "photos", "software", "system"],
    rename: { download: "downloads", filerun: "games", medien: "media", opencloud: "photos", seaweedfs: "software" },
  },
  {
    name: "plugins",
    path: "/Plugins",
    accent: "#BE95FF",
    key: "cc.pluginview",
    views: { list: "list", tiles: "tiles" },
    keep: ["TowerTorch", "Community Applications", "Unassigned Devices", "Fix Common Problems", "User Scripts", "Tailscale",
      "Nvidia Driver", "GPU Statistics", "Unassigned Devices Plus", "Unassigned Devices Preclear", "Dynamix Cache Directories",
      "Dynamix File Integrity", "Dynamix System Information", "Dynamix System Statistics", "Dynamix System Temperature",
      "Appdata Cleanup Plus", "unBALANCED"],
    rename: { "community-applications": "Community Applications" },
  },
  {
    name: "vms",
    path: "/VMs",
    accent: "#FF7EB6",
    key: "cc.vmview",
    views: { list: "list", tiles: "grid" },
    keep: ["Home Assistant OS", "Windows 11", "Ubuntu Server", "Debian"],
    rename: { Linux: "Home Assistant OS", Ubuntu: "Ubuntu Server", "TrueNAS-Test": "Debian" },
    describe: { "Home Assistant OS": "Smart home", "Ubuntu Server": "Build box", "Windows 11": "Games", Debian: "Pi-hole and DNS" },
  },
];

// The language files whose strings show on these pages. Unraid has no listing of the folder.
const LANG_FILES = ["translations", "docker", "main", "shares", "plugins", "vms", "dashboard", "settings", "tools", "apps",
  "unassigneddevices", "javascript"];

// Unraid's language files give the same German word for more than one English key ("Start" is
// both the Main tab and the button), and some strings are built from pieces. These win over the
// files.
const ENGLISH = {
  "Gestoppt": "Stopped",
  "Gestartet": "Started",
  "Array gestartet": "Array Started",
  "nicht verfügbar": "not available",
  "Auf dem neusten Stand": "up-to-date",
  "Privat": "Private",
  "Berechnen": "Compute",
  "Keine": "None",
  "Von": "By",
  "Treiber": "Driver",
  "zwei": "two", "drei": "three", "vier": "four", "fünf": "five", "sechs": "six", "sieben": "seven", "acht": "eight",
  "neun": "nine", "zehn": "ten", "elf": "eleven", "zwölf": "twelve",
};
const NAV = { "/Dashboard": "Dashboard", "/Main": "Main", "/Shares": "Shares", "/Users": "Users", "/Settings": "Settings",
  "/Plugins": "Plugins", "/Docker": "Docker", "/VMs": "VMs", "/Apps": "Apps", "/Tools": "Tools", "/Stats": "Stats", "/Favorites": "Favorites" };

function parseLang(text) {
  const pairs = [];
  let help = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^:\w+:$/.test(line)) { help = line !== ":end"; continue; }
    if (help || !line || line.startsWith(";")) continue;
    const at = line.indexOf("=");
    if (at > 0) pairs.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return pairs;
}

// The server's language back to English. A value that is also its own key stays as it is,
// otherwise the first file to name it wins. Strings with a %s placeholder become patterns.
async function englishMap(ctx, locale) {
  const back = {};
  const patterns = [];
  for (const file of LANG_FILES) {
    const res = await ctx.request.get(`${BASE}/languages/${locale}/${file}.txt`);
    if (!res.ok()) continue;
    for (const [en, local] of parseLang(await res.text())) {
      if (local.length < 2 || /[<*]/.test(local) || /^\d+$/.test(local)) continue;
      if (local.includes("%s")) {
        const literal = local.replace(/%s/g, "").trim();
        const source = local.split("%s").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)");
        if (literal.length >= 4) patterns.push([`^${source}$`, en]);
        continue;
      }
      if (!(local in back) || en === local) back[local] = en;
    }
  }
  return { exact: Object.assign(back, ENGLISH), patterns };
}

// One scrubber for every text the page receives and everything it shows: the server's name and
// description, private addresses, MAC addresses, disk serial numbers and the license fields of
// Unraid's server state.
function scrubber(server) {
  const serials = new Map();
  const fake = (real) => {
    if (!serials.has(real)) {
      let h = 0;
      for (const c of real) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const pool = /^\d+$/.test(real) ? "0123456789" : "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
      let s = "";
      for (let i = 0; i < real.length; i++) { h = (h * 1103515245 + 12345) >>> 0; s += pool[h % pool.length]; }
      serials.set(real, s);
    }
    return serials.get(real);
  };
  const words = [[server.name, DEMO_NAME], [server.description, DEMO_DESCRIPTION]].filter(([w]) => w && w.length > 2);
  const edges = (w) => new RegExp(`(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
  const swaps = [];
  for (const [w, demo] of words) {
    swaps.push([edges(w), demo], [edges(w.toLowerCase()), demo.toLowerCase()], [edges(w.toUpperCase()), demo.toUpperCase()]);
  }
  const fn = (text) => {
    let t = text;
    t = t.replace(/((?:&quot;|")(?:guid|regGuid|flashGuid|keyfile|regTo|email|site|wanFQDN)(?:&quot;|"):(?:&quot;|"))(.*?)((?:&quot;|"))/g, "$1$3");
    for (const [re, demo] of swaps) t = t.replace(re, demo);
    t = t.replace(/(?<![\d.])(10|100|172|192)\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g, (all, a, b, c, d) => {
      const priv = a === "10" || (a === "172" && b >= 16 && b <= 31) || (a === "192" && b === "168") || (a === "100" && b >= 64 && b <= 127);
      return priv ? `192.168.1.${d}` : all;
    });
    t = t.replace(/\bbr0\.\d+\b/g, "br0");
    t = t.replace(/\b([0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi, (m) => `52:54:00:${fake(m).slice(0, 6).replace(/(..)(?=.)/g, "$1:").toLowerCase()}`);
    t = t.replace(/\b([A-Za-z][A-Za-z0-9.-]*(?:_[A-Za-z0-9.-]+)*)_((?=[A-Z]*\d)[A-Z0-9]{8,24})(?=\b|-0:0)/g, (m, model, serial) => `${model}_${fake(serial)}`);
    t = t.replace(/\b0x5[0-9a-f]{15}\b/g, (m) => `0x5000c500${fake(m).slice(0, 7).toLowerCase().replace(/[^0-9a-f]/g, "a")}`);
    t = t.replace(/\beui\.[0-9a-f]{16}\b/g, (m) => `eui.0025385${fake(m).slice(0, 9).toLowerCase().replace(/[^0-9a-f]/g, "b")}`);
    for (const [real, demo] of serials) t = t.split(real).join(demo);
    return t;
  };
  fn.serials = serials;
  return fn;
}

// A spun-down disk comes with a grey orb that spins it up and no temperature, and its tile is
// dimmed. For the picture each one reads as running, with a made-up temperature.
function wake(text) {
  let n = 0;
  return text.replace(/grey-orb('[^>]*?toggle_state\('Device','\w+',')up('(?:(?!<tr>)[^])*?<\\?\/td><td>)\*(<\\?\/td>)/g,
    (m, orb, row, end) => `green-orb${orb}down${row}${33 + (n++ % 4)}&#8201;&#176;C${end}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { timeout: 120000 });
  await page.fill("input[name=username]", USER);
  await page.fill("input[name=password]", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !/login/.test(String(u)), { waitUntil: "commit", timeout: 60000 }),
    page.click("button[type=submit], input[type=submit]"),
  ]);
}

// Runs in the page: takes out what the picture does not keep, renames and orders the rest, and
// puts the English and the demo names into every text node and every attribute a tooltip reads.
// The scrubbing itself happens in Node through shotScrub, the same function the responses went
// through.
async function curate({ keep, rename, describe, english, nav }) {
  const nameOf = (el) => {
    const n = el.dataset.name || el.dataset.key ||
      el.querySelector(".appname, .vm-name .inner > a, td:first-child a[href*='name='], .cc-plugtitle")?.textContent ||
      el.querySelector("[data-cc-pname]")?.dataset.ccPname || "";
    return n.trim();
  };
  const renamed = (n) => (rename && rename[n]) || n;
  if (keep) {
    const order = (n) => keep.indexOf(renamed(n));
    for (const tbody of ["#docker_list", "#shareslist", "#plugin_list", "#kvm_list"]) {
      const rows = [...document.querySelectorAll(tbody + " > tr")];
      if (!rows.length) continue;
      // A VM's detail rows follow its own row and go wherever it goes.
      const groups = [];
      for (const tr of rows) {
        if (tbody !== "#kvm_list" || tr.classList.contains("sortable") || !groups.length) groups.push({ name: nameOf(tr), rows: [tr] });
        else groups.at(-1).rows.push(tr);
      }
      const parent = rows[0].parentNode;
      for (const g of groups) if (order(g.name) < 0) g.rows.forEach((r) => r.remove());
      groups.filter((g) => order(g.name) >= 0).sort((x, y) => order(x.name) - order(y.name))
        .forEach((g) => g.rows.forEach((r) => parent.appendChild(r)));
    }
    const cards = [...document.querySelectorAll(".cc-card[data-name], .cc-sht-card[data-key], .cc-plt-card[data-key], .cc-vm-grid > [data-name]")];
    for (const c of cards) if (order(nameOf(c)) < 0) c.remove();
    const byParent = new Map();
    for (const c of cards.filter((c) => c.isConnected)) {
      if (!byParent.has(c.parentNode)) byParent.set(c.parentNode, []);
      byParent.get(c.parentNode).push(c);
    }
    for (const [parent, list] of byParent) list.sort((x, y) => order(nameOf(x)) - order(nameOf(y))).forEach((c) => parent.appendChild(c));
  }
  for (const a of document.querySelectorAll("a[href]")) {
    const label = nav[new URL(a.href, location.href).pathname];
    if (!label || a.closest("#displaybox")) continue;
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.trim()) { n.nodeValue = n.nodeValue.replace(/\S(.*\S)?/s, label); break; }
    }
  }
  const exact = english.exact;
  const patterns = english.patterns.map(([re, en]) => [new RegExp(re), en]);
  const word = (core) => {
    if (exact[core]) return exact[core];
    const dots = /^(.*?)(\.\.\.|…)$/.exec(core);
    if (dots && exact[dots[1]]) return exact[dots[1]] + dots[2];
    const counted = /^(.+?) (\d+)$/.exec(core);
    if (counted && exact[counted[1]]) return exact[counted[1]] + " " + counted[2];
    for (const [re, en] of patterns) {
      const hit = re.exec(core);
      if (!hit) continue;
      const parts = hit.slice(1).map((p) => exact[p] || p);
      return en.replace(/%s/g, () => parts.shift());
    }
    return null;
  };
  const translate = (s) => {
    const m = /^(\s*\(?)(.*?)([):.…]*\s*)$/s.exec(s);
    if (!m || !m[2]) return s;
    const unit = (en) => (x, n) => n + " " + en + (n === "1" ? "" : "s");
    const core = m[2]
      .replace(/\bTreiber:/g, "Driver:")
      .replace(/\b(\d+) Tage?n?\b/g, unit("day"))
      .replace(/\b(\d+) Stunden?\b/g, unit("hour"))
      .replace(/\b(\d+) Minuten?\b/g, unit("minute"))
      .replace(/\b(\d+) Sekunden?\b/g, unit("second"));
    return m[1] + (word(core) || core) + m[3];
  };
  const ATTRS = ["title", "alt", "placeholder", "aria-label", "data-tip", "data-cc-tip", "data-original-title", "data-name", "data-key"];
  const visit = (each) => {
    const roots = [document.documentElement];
    for (let i = 0; i < roots.length; i++) {
      const walker = document.createTreeWalker(roots[i], NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = walker.currentNode; n; n = walker.nextNode()) {
        if (n.shadowRoot) roots.push(n.shadowRoot);
        if (n.nodeType !== Node.TEXT_NODE || !/^(SCRIPT|STYLE)$/.test(n.parentNode?.nodeName)) each(n);
      }
    }
  };
  const seen = new Set();
  visit((n) => {
    if (n.nodeType === Node.TEXT_NODE) { seen.add(n.nodeValue); return; }
    for (const at of ATTRS) if (n.getAttribute(at)) seen.add(n.getAttribute(at));
    if (n.nodeName === "INPUT" && n.value) seen.add(n.value);
  });
  const list = [...seen];
  const done = await window.shotScrub(list);
  const scrubbed = new Map(list.map((v, i) => [v, done[i]]));
  const fix = (s) => {
    let t = scrubbed.get(s) ?? s;
    const core = t.trim();
    if (rename && rename[core]) t = t.replace(core, rename[core]);
    return translate(t);
  };
  visit((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const v = fix(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
      return;
    }
    for (const at of ATTRS) if (n.getAttribute(at)) n.setAttribute(at, fix(n.getAttribute(at)));
    if (n.nodeName === "INPUT" && /^(button|submit|text)$/.test(n.type) && n.value) n.value = fix(n.value);
  });
  // A VM description is free text, so each kept VM gets its demo one.
  for (const [vm, text] of Object.entries(describe || {})) {
    for (const el of document.querySelectorAll("#kvm_list > tr.sortable, .cc-vm-grid > [data-name]")) {
      if (nameOf(el) !== vm) continue;
      const cell = el.matches("tr") ? el.children[2] : el.querySelector("[class*='desc']");
      const leaf = cell && [...cell.querySelectorAll("*")].reverse().find((x) => !x.children.length && x.textContent.trim());
      if (leaf) leaf.textContent = text;
    }
  }
}

// Runs in the page: every visible place where a denied word or a private address is left.
function leaks({ deny, demoNet }) {
  const hits = [];
  const check = (text, where) => {
    for (const w of deny) if (text.toLowerCase().includes(w.toLowerCase())) hits.push(w + " in " + where + ": " + text.trim().slice(0, 90));
    for (const ip of text.match(/(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/g) || []) {
      if (!ip.startsWith(demoNet) && !/^(127\.|0\.0\.0\.0)/.test(ip)) hits.push("address " + ip + " in " + where);
    }
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (/^(SCRIPT|STYLE)$/.test(n.parentNode?.nodeName)) continue;
      const box = n.parentElement?.getBoundingClientRect();
      if (box && box.width && box.height && box.bottom > 0 && box.top < innerHeight) check(n.nodeValue, String(n.parentElement.className || n.parentElement.nodeName));
    } else if (n.nodeName !== "OPTION") {
      const box = n.getBoundingClientRect();
      const shown = box.width && box.height && box.bottom > 0 && box.top < innerHeight;
      for (const at of ["title", "data-tip", shown && "alt", shown && "placeholder", shown && "value"].filter(Boolean)) {
        const v = n.getAttribute(at);
        if (v) check(v, n.nodeName.toLowerCase() + "[" + at + "]");
      }
    }
  }
  return [...new Set(hits)];
}

mkdirSync(out, { recursive: true });
// Unraid's live tables come over WebSockets, which Chrome refuses from a page whose document was
// handed over by the route below unless the local network checks are off.
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets,PrivateNetworkAccessChecks"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: VIEW, deviceScaleFactor: 2, locale: "en-US", colorScheme: "dark" });
  const page = await ctx.newPage();
  // Until the login is through, the only thing allowed to go out besides GETs is the login form.
  await page.route(/./, (r) => (r.request().method() === "GET" || /\/login/.test(r.request().url()) ? r.continue() : r.abort()));
  await login(page);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.goto(`${BASE}/Dashboard`, { waitUntil: "load" });
  const server = await page.evaluate(() => {
    try { return JSON.parse(document.querySelector("[server]").getAttribute("server")); } catch { return {}; }
  });
  server.name = server.name || (await page.title()).split("/")[0];
  const locale = server.locale || (await page.evaluate(() => document.documentElement.lang)) || "en_US";
  const english = /^en/.test(locale) ? { exact: {}, patterns: [] } : await englishMap(ctx, locale);
  const scrub = scrubber(server);
  await page.exposeFunction("shotScrub", (list) => list.map(scrub));

  let state = { settings: {}, frozen: false, shares: {}, wake: false, plan: null };
  // A request made while the page is frozen is held, not refused: a refused one would put an
  // error toast into the picture.
  const held = [];
  await page.route(/./, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (state.frozen && req.resourceType() !== "image") return void held.push(route);
    if (/\/webGui\/javascript\/translate\.[A-Za-z_]+\.js/.test(url)) {
      return route.fulfill({ contentType: "application/javascript", body: "function _(t){return t;}" });
    }
    if (method === "GET" && state.plan && /\/plugins\/towertorch\/server\/ccapi\.php\?path=state(&|$)/.test(url)) {
      const res = await route.fetch();
      const json = await res.json();
      json.plan = state.plan;
      json.last_run = null;
      return route.fulfill({ response: res, body: scrub(JSON.stringify(json)), contentType: "application/json" });
    }
    if (method === "GET" && SETTINGS.test(url)) {
      const res = await route.fetch();
      const json = await res.json();
      json.ui_settings = Object.assign(json.ui_settings || {}, LOOK, state.settings);
      return route.fulfill({ response: res, body: scrub(JSON.stringify(json)), contentType: "application/json" });
    }
    let postData;
    if (method !== "GET") {
      const body = req.postData() || "";
      const listing = /\/(ShareList|DiskList)\.php/.test(url) && /(^|&)compute=/.test(body);
      const query = /\/graphql/.test(url) && !/mutation/i.test(body);
      if (!listing && !query) return route.abort();
      postData = listing ? body.replace(/(^|&)compute=[^&]*/, "$1compute=%2F%2Fnone").replace(/(^|&)all=[^&]*/, "$1all=1") : body;
    }
    if (method === "GET" && !/^(document|xhr|fetch)$/.test(req.resourceType())) return route.continue();
    const res = await route.fetch(postData === undefined ? {} : { postData });
    if (!/json|html|text\/plain/.test(res.headers()["content-type"] || "")) return route.fulfill({ response: res });
    let body = await res.text();
    if (req.resourceType() === "document") body = body.replace(/<html([^>]*?)\blang="[^"]*"/, '<html$1lang="en"');
    if (/organizer/.test(postData || "") && state.settings["cc.view"]) {
      try {
        const json = JSON.parse(body);
        for (const v of json?.data?.docker?.organizer?.views || []) v.prefs = Object.assign(v.prefs || {}, { ccViewMode: state.settings["cc.view"] });
        body = JSON.stringify(json);
      } catch {}
    }
    if (/ShareList\.php/.test(url)) {
      for (const [from, to] of Object.entries(state.shares)) body = body.replace(new RegExp(`(?<![\\w-])${from}(?![\\w-])`, "g"), to);
    }
    if (state.wake) body = wake(body);
    return route.fulfill({ response: res, body: scrub(body) });
  });
  await page.routeWebSocket(/./, (ws) => {
    const upstream = ws.connectToServer();
    ws.onMessage((m) => upstream.send(m));
    upstream.onMessage((m) => { if (!state.frozen) ws.send(typeof m === "string" ? scrub(state.wake ? wake(m) : m) : m); });
  });

  const shots = PAGES.filter((p) => !CHOSEN.length || CHOSEN.includes(p.name));
  for (const shot of shots) {
    for (const [view, value] of Object.entries(shot.views)) {
      const settings = Object.assign({ "cc.accent": shot.accent }, { [shot.key]: value });
      state = { settings, frozen: false, shares: shot.name === "shares" ? shot.rename : {}, wake: !!shot.wake, plan: shot.plan || null };
      for (const route of held.splice(0)) route.abort().catch(() => {});
      await page.goto(`${BASE}/Dashboard`, { waitUntil: "load" });
      await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) window.__ccLS ? window.__ccLS(k, v) : localStorage.setItem(k, v); }, Object.assign({}, LOOK, settings));
      await page.goto(`${BASE}${shot.path}`, { waitUntil: "load", timeout: 60000 });
      await page.waitForTimeout(9000);
      if (shot.open && view === "tiles") {
        await page.locator("#docker_list tr", { hasText: shot.open }).first().locator("a.cc-plan").first().click();
        await page.waitForTimeout(2500);
      }
      await page.mouse.move(VIEW.width / 2, 2);
      state.frozen = true;
      await page.evaluate(() => {
        const last = setTimeout(() => {}, 0);
        for (let i = 0; i <= last; i++) { clearTimeout(i); clearInterval(i); }
      });
      const args = { keep: shot.keep, rename: shot.rename, describe: shot.describe, english, nav: NAV };
      await page.evaluate(curate, args);
      await page.waitForTimeout(1500);
      await page.evaluate(curate, args);
      await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }" });
      const hits = await page.evaluate(leaks, { deny: [...DENY, server.name, ...[...scrub.serials.keys()]].filter((w) => w && w.length > 2), demoNet: "192.168.1." });
      for (const h of hits) console.log(`  ${shot.name}-${view}: ${h}`);
      await page.screenshot({ path: join(out, `${shot.name}-${view}.png`) });
      console.log(`wrote ${shot.name}-${view}.png`);
    }
  }
  // The login page is taken in a context that never logged in: dark in front and light behind, the
  // server's name and the words in English. Unraid takes the light look from a class on <html>.
  if (!CHOSEN.length || CHOSEN.includes("login")) {
    for (const [view, light] of [["tiles", false], ["list", true]]) {
      const guest = await browser.newContext({ ignoreHTTPSErrors: true, viewport: VIEW, deviceScaleFactor: 2, locale: "en-US", colorScheme: "dark" });
      await guest.addInitScript((accent) => { localStorage.setItem("cc.accent", accent); }, LOGIN_ACCENT);
      const gp = await guest.newPage();
      await gp.route(/./, async (route) => {
        if (route.request().resourceType() !== "document") return route.continue();
        const res = await route.fetch();
        let body = scrub(await res.text());
        for (const [from, to] of Object.entries(LOGIN_ENGLISH)) body = body.split(from).join(to);
        body = body.replace(/<html([^>]*?)\blang="[^"]*"/, '<html$1lang="en"');
        if (light) body = body.replace("Theme--black", "Theme--white");
        return route.fulfill({ response: res, body });
      });
      await gp.goto(`${BASE}/login`, { waitUntil: "load", timeout: 60000 });
      await gp.waitForTimeout(1500);
      await gp.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }" });
      const hits = await gp.evaluate(leaks, { deny: [...DENY, server.name].filter((w) => w && w.length > 2), demoNet: "192.168.1." });
      for (const hit of hits) console.log(`  login-${view}: ${hit}`);
      await gp.screenshot({ path: join(out, `login-${view}.png`) });
      console.log(`wrote login-${view}.png`);
      await guest.close();
    }
  }
} finally {
  await browser.close();
}
