// Renders the README screenshots in the style of the house's store pictures: each page of
// CannonadeCommand twice, the list behind and the tiles in front, in two tilted browser windows on
// the dark relief ground with the logo pressed into it, a heading and a line of text beside them.
// 1920x1080 each, so two windows fit with only a corner of the back one covered.
//
// The pictures come from captures/, taken by capture.mjs at 1440x900 and twice the pixel density.
// Everything here is rendered at twice the size and scaled down, which keeps the type crisp
// through the tilt.
//
// Deps (global): playwright-core with its Chromium installed.
// Run: node .github/assets/screenshots/render.mjs

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync("npm root -g").toString().trim()}/playwright-core`);

const here = dirname(fileURLToPath(import.meta.url));

const SHOTS = [
  {
    file: "cannonadecommand-1.jpg",
    page: "docker",
    path: "/Docker",
    caption: "Your containers, <em>lined up or laid out</em>",
    sub: "The Docker tab as a list or as cards, with live load, start plan and one-click actions",
  },
  {
    file: "cannonadecommand-2.jpg",
    page: "main",
    path: "/Main",
    caption: "Every disk, <em>temperature included</em>",
    sub: "The Main page shows array, pools and boot device as a table or as tiles with fill level and SMART state",
  },
  {
    file: "cannonadecommand-3.jpg",
    page: "shares",
    path: "/Shares",
    caption: "Every share <em>and its free space</em>",
    sub: "User shares as a list or as tiles, with storage, protection, SMB and NFS on badges",
  },
  {
    file: "cannonadecommand-4.jpg",
    page: "plugins",
    path: "/Plugins",
    caption: "Your plugins, <em>finally in uniform</em>",
    sub: "One logo tile and the same badges for every plugin: author, version, status",
  },
  {
    file: "cannonadecommand-5.jpg",
    page: "vms",
    path: "/VMs",
    caption: "Your VMs, <em>one click from booting</em>",
    sub: "The VM tab as a list or as tiles, with cores, memory, disks and graphics at a glance",
  },
];

const W = 1920;
const H = 1080;
const WIN_W = 940;
const VIEW_H = Math.round((WIN_W * 900) / 1440);
const BAR_H = 44;
const WIN_H = VIEW_H + BAR_H;
const HOST = "nas.local";

async function cached(file, url) {
  const path = join(tmpdir(), `cannonadecommand-${file}`);
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file}: fetch ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

const dataUrl = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
const fonts = "https://github.com/google/fonts/raw/main/ofl";
const bree = dataUrl(await cached("BreeSerif-Regular.ttf", `${fonts}/breeserif/BreeSerif-Regular.ttf`), "font/ttf");
const lato = dataUrl(await cached("Lato-Regular.ttf", `${fonts}/lato/Lato-Regular.ttf`), "font/ttf");
const logo = dataUrl(readFileSync(join(here, "..", "logo.svg")), "image/svg+xml");

const STYLE = `
@font-face { font-family: "Bree Serif"; src: url(${bree}); }
@font-face { font-family: Lato; src: url(${lato}); }
* { box-sizing: border-box; margin: 0; }
body { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; font-family: Lato, sans-serif; background: #0c0c0b; }
.wall { position: absolute; inset: 0; background: radial-gradient(55% 60% at 62% 35%, #26231d, #0f0e0c 72%); }
.relief { position: absolute; width: 46%; left: -9%; top: -4%; transform: rotate(-10deg); opacity: .32;
  filter: grayscale(1) brightness(.36) contrast(1.2) drop-shadow(-2px -2px 0 rgba(255,255,255,.16)) drop-shadow(12px 18px 26px rgba(0,0,0,.85)); }
.vignette { position: absolute; inset: 0; box-shadow: inset 0 0 200px rgba(0,0,0,.6); }
.copy { position: absolute; left: 80px; top: 0; bottom: 0; width: 380px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
.copy img { width: 96px; }
h1 { font: 400 52px/1.14 "Bree Serif", serif; color: #f4f4f4; text-wrap: balance; }
h1 em { font-style: normal; color: #FCC419; }
.sub { font-size: 23px; line-height: 1.4; color: #9d9481; }
.stage { position: absolute; width: ${WIN_W}px; height: ${WIN_H}px; perspective: 2400px; }
.back { left: ${W - 60 - WIN_W}px; top: 56px; }
.front { left: 500px; top: ${H - 56 - WIN_H}px; }
.floor { position: absolute; left: 6%; right: 6%; bottom: -34px; height: 60px; border-radius: 50%; background: rgba(0,0,0,.75); filter: blur(28px); }
.win { position: absolute; inset: 0; border-radius: 12px; background: #1c1c1c; transform: rotateY(-7deg) rotateX(3deg);
  box-shadow: 0 0 0 1px #333, 0 1px 0 1px rgba(255,255,255,.05), 0 2px 4px rgba(0,0,0,.35), 0 16px 32px rgba(0,0,0,.4), 0 48px 96px rgba(0,0,0,.5); }
.front .win { transform: rotateY(-7deg) rotateX(3deg) translateZ(40px);
  box-shadow: 0 0 0 1px #3a3a3a, 0 1px 0 1px rgba(255,255,255,.06), 0 4px 8px rgba(0,0,0,.45), 0 24px 48px rgba(0,0,0,.55), 0 64px 120px rgba(0,0,0,.65); }
.bar { height: ${BAR_H}px; display: flex; align-items: center; gap: 16px; padding: 0 16px; border-radius: 12px 12px 0 0;
  background: linear-gradient(#242424, #1c1c1c); border-bottom: 1px solid #0e0e0e; }
.dots { display: flex; gap: 8px; } .dots i { width: 12px; height: 12px; border-radius: 50%; background: #3d3d3d; }
.nav { display: flex; gap: 14px; color: #7c7c7c; } .nav svg { width: 16px; height: 16px; display: block; }
.url { flex: 1; height: 28px; border-radius: 14px; background: #2b2b2b; color: #b4b4b4; font-size: 14px; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
.url svg { width: 12px; height: 12px; color: #7c7c7c; }
.more { color: #7c7c7c; font-size: 18px; }
.view img { display: block; width: ${WIN_W}px; height: ${VIEW_H}px; border-radius: 0 0 12px 12px; }
.glare { position: absolute; inset: 0; border-radius: 12px; pointer-events: none;
  background: linear-gradient(118deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.02) 28%, rgba(255,255,255,0) 42%); }
`;

const windowAt = (place, shot, capture) => `<div class="stage ${place}"><div class="floor"></div><div class="win">
  <div class="bar">
    <div class="dots"><i></i><i></i><i></i></div>
    <div class="nav">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 3 5 8l5 5"/></svg>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 3 5 5-5 5"/></svg>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5"/></svg>
    </div>
    <div class="url"><svg viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="5" width="8" height="6" rx="1.2"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>${HOST}${shot.path}</div>
    <div class="more">&#8942;</div>
  </div>
  <div class="view"><img src="${dataUrl(readFileSync(join(here, "captures", capture)), "image/png")}"></div>
  <div class="glare"></div>
</div></div>`;

const page = (shot) => `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
<div class="wall"></div><img class="relief" src="${logo}"><div class="vignette"></div>
<div class="copy"><img src="${logo}"><h1>${shot.caption}</h1><p class="sub">${shot.sub}</p></div>
${windowAt("back", shot, `${shot.page}-tiles.png`)}
${windowAt("front", shot, `${shot.page}-list.png`)}
</body></html>`;

const browser = await chromium.launch();
try {
  for (const shot of SHOTS) {
    const big = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await big.setContent(page(shot));
    await big.evaluate(() => document.fonts.ready);
    await big.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    const png = await big.screenshot();
    await big.close();
    const small = await browser.newPage({ viewport: { width: W, height: H } });
    await small.setContent(`<body style="margin:0"><img src="${dataUrl(png, "image/png")}" style="display:block;width:${W}px;height:${H}px">`);
    await small.locator("img").evaluate((img) => img.decode());
    await small.screenshot({ path: join(here, shot.file), type: "jpeg", quality: 90 });
    await small.close();
    console.log(`${shot.file} written`);
  }
} finally {
  await browser.close();
}
