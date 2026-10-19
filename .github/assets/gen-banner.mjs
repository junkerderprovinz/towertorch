/**
 * Generates the TowerTorch README banners (1600x500):
 *   towertorch-banner.svg / .png       light: logo on white
 *   towertorch-banner-dark.svg / .png  dark:  logo on #0d1117 (GitHub dark)
 *   towertorch-banner-logo.svg / .png  text-free, logo on white (support thread)
 *
 * The README serves the light and dark banner as a <picture> pair. The logo reads on
 * both grounds, so both embed the same master unchanged. The wordmark (Bree Serif)
 * and the claim (Lato) become SVG paths, so the file carries no font and renders the
 * same in resvg and in a browser.
 *
 * Needs opentype.js and @resvg/resvg-js installed globally. Bree Serif and Lato,
 * both OFL, are fetched at runtime into the OS temp dir and stay out of the repo.
 *
 * To change the name or the claim, edit the values below and run
 * `node .github/assets/gen-banner.mjs`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const groot = execSync("npm root -g").toString().trim();
const opentype = require(`${groot}/opentype.js`);
const { Resvg } = require(`${groot}/@resvg/resvg-js`);

const __dir = dirname(fileURLToPath(import.meta.url));

const NAME = "TowerTorch";
const CLAIM = ["Your server's UI on fire.", "Your disks stay cool."];
const LOGO = "towertorch.svg";
const W = 1600, H = 500;
const logoInk = 400;                 // the logo's larger ink side
const logoX = 165;                   // left edge of the logo's ink
const gap = 70;                      // logo ink to name
const rightMargin = 120;
const NAME_SIZE = 132, CLAIM_SIZE = 44;

const THEMES = [
  { suffix: "", bg: "#ffffff", name: "#1f2328", claim: "#5a5d5e" },
  { suffix: "-dark", bg: "#0d1117", name: "#e6edf3", claim: "#9aa4ad" },
];

async function font(file, url) {
  const p = join(tmpdir(), file);
  if (!existsSync(p)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${file} fetch ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  const b = readFileSync(p);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

const bree = await font("tt-BreeSerif-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/breeserif/BreeSerif-Regular.ttf");
const lato = await font("tt-Lato-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf");

// The logo master as it is, with the ink box measured from a render rather than taken
// from the viewBox, since a master may carry empty margin.
const src = readFileSync(join(__dir, LOGO), "utf8");
const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const [vbX, vbY, vbW, vbH] = src.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
const probe = new Resvg(src, { fitTo: { mode: "width", value: Math.round(vbW) }, background: "rgba(0,0,0,0)" }).render();
const alpha = probe.pixels;
let x0 = probe.width, y0 = probe.height, x1 = -1, y1 = -1;
for (let y = 0; y < probe.height; y++) {
  for (let x = 0; x < probe.width; x++) {
    if (alpha[(y * probe.width + x) * 4 + 3] > 8) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
}
const px = vbW / probe.width;        // viewBox units per probe pixel
const ink = { x: vbX + x0 * px, y: vbY + y0 * px, w: (x1 - x0 + 1) * px, h: (y1 - y0 + 1) * px };
const scale = logoInk / Math.max(ink.w, ink.h);
const logoAt = (left) => `translate(${(left - ink.x * scale).toFixed(2)},${(H / 2 - (ink.y + ink.h / 2) * scale).toFixed(2)}) scale(${scale.toFixed(6)})`;

// Text is drawn at the origin and placed with a transform: opentype.js emits NaN points
// for some glyphs at large pen coordinates, and resvg drops a path from the first NaN on.
// The size still steps down until every glyph comes out clean.
function fit(fnt, lines, size, maxW) {
  size = Math.min(size, Math.floor(100 * maxW / Math.max(...lines.map((l) => fnt.getAdvanceWidth(l, 100)))));
  for (; size > 10; size--) {
    const ds = lines.map((l) => fnt.getPaths(l, 0, 0, size).map((p) => p.toPathData(2)).filter(Boolean));
    if (ds.every((d) => d.every((s) => !s.includes("NaN")))) return { size, ds };
  }
  throw new Error("no NaN-free size found");
}
const textX = logoX + ink.w * scale + gap;
const maxTextW = W - textX - rightMargin;
const name = fit(bree, [NAME], NAME_SIZE, maxTextW);
const claim = fit(lato, CLAIM, CLAIM_SIZE, maxTextW);

// Name and claim are centred as one block on H/2, where the logo's ink centre sits,
// with the baselines taken from the font metrics.
const em = (fnt, s) => s / fnt.unitsPerEm;
const nameAsc = bree.ascender * em(bree, name.size);
const nameDesc = -bree.descender * em(bree, name.size);
const claimAsc = lato.ascender * em(lato, claim.size);
const claimDesc = -lato.descender * em(lato, claim.size);
const toClaim = Math.round(nameDesc + 16 + claimAsc);
const claimStep = Math.round((lato.ascender - lato.descender) * em(lato, claim.size) * 1.15);
const blockH = nameAsc + toClaim + claimStep * (CLAIM.length - 1) + claimDesc;
const nameBase = Math.round(H / 2 - blockH / 2 + nameAsc);
const placed = (ds, x, y, fill) => `<g transform="translate(${x.toFixed(2)},${y})">${ds.map((d) => `<path d="${d}" fill="${fill}"/>`).join("")}</g>`;

function write(file, svg) {
  writeFileSync(join(__dir, `${file}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  writeFileSync(join(__dir, `${file}.png`), png);
  console.log(`${file} ok: ${W}x${H}, png ${png.length} bytes`);
}

for (const t of THEMES) {
  const claimLines = claim.ds.map((ds, i) => placed(ds, textX + 4, nameBase + toClaim + i * claimStep, t.claim)).join("\n  ");
  write(`towertorch-banner${t.suffix}`, `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${NAME}">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <g transform="${logoAt(logoX)}">
${inner}
  </g>
  ${placed(name.ds[0], textX, nameBase, t.name)}
  ${claimLines}
</svg>
`);
}

// The support banner: the logo alone, centred on white.
write("towertorch-banner-logo", `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${NAME}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g transform="${logoAt((W - ink.w * scale) / 2)}">
${inner}
  </g>
</svg>
`);
console.log(`name ${name.size}px, claim ${claim.size}px`);
