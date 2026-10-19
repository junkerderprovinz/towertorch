/**
 * Generates the TowerTorch README banners (1600x500):
 *   towertorch-banner.svg / .png       light: dunkel logo on white
 *   towertorch-banner-dark.svg / .png  dark:  hell logo on #0d1117 (GitHub dark)
 *   towertorch-banner-logo.svg / .png  text-free, dunkel on white (support thread)
 *
 * The README serves the light and dark banner as a <picture> pair. Each theme
 * embeds its own logo master unchanged rather than recolouring one, and the
 * wordmark (Bree Serif) and the claim (Lato) become SVG paths, so the file
 * carries no font and renders the same in resvg and in a browser.
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

const NAME_A = "Cannonade";
const NAME_B = "Command";
const CLAIM1 = "Firepower and finish for your whole";
const CLAIM2 = "Unraid dashboard. Fire when ready.";
const W = 1600, H = 500;
const logoBox = 400;                 // square, as in the sibling repos
const logoX = 165, logoY = (H - logoBox) / 2;
const textX = logoX + logoBox + 70;  // left edge of the text block
const maxTextW = W - textX - 80;     // what is left between textX and the right margin

// Each theme embeds the logo variant that reads on its background.
const THEMES = [
  { suffix: "", bg: "#ffffff", name: "#1f2328", claim: "#5a5d5e", logo: "towertorch-dunkel.svg" },
  { suffix: "-dark", bg: "#0d1117", name: "#e6edf3", claim: "#9aa4ad", logo: "towertorch-hell.svg" },
];

async function font(file, url) {
  const p = join(tmpdir(), file);
  if (!existsSync(p)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${file} fetch ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  return opentype.parse(readFileSync(p).buffer.slice(readFileSync(p).byteOffset, readFileSync(p).byteOffset + readFileSync(p).byteLength));
}

const bree = await font("cc-BreeSerif-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/breeserif/BreeSerif-Regular.ttf");
const lato = await font("cc-Lato-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf");

// The sizes are fitted to the available width rather than hard-coded. opentype.js
// emits NaN points for some size and glyph combinations (Lato "y" at 42px, for
// one), and whether it does depends on the pen position, so the loop generates the
// real paths and steps down until one comes out free of NaN.
function cleanPaths(fnt, runs, size) {
  for (; size > 10; size--) {
    const paths = runs.map(([t, x, y]) => fnt.getPath(t, x, y, size));
    if (paths.every((pp) => !pp.toPathData(2).includes("NaN"))) return { size, paths };
  }
  throw new Error("no NaN-free size found");
}
const nameFit = cleanPaths(bree, [[NAME_A + NAME_B, textX, 0]],
  Math.min(132, Math.floor(100 * maxTextW / bree.getAdvanceWidth(NAME_A + NAME_B, 100))));
const claimFit = cleanPaths(lato, [[CLAIM1, textX + 4, 0], [CLAIM2, textX + 4, 0]],
  Math.min(44, Math.floor(100 * maxTextW / Math.max(lato.getAdvanceWidth(CLAIM1, 100), lato.getAdvanceWidth(CLAIM2, 100)))));
const nameSize = nameFit.size, claimSize = claimFit.size;

// The whole text block is centred on H/2, where the logo sits too. The baselines
// come from the font metrics and the line steps, and the final paths are then
// generated at those baselines.
const sc = (fnt, s) => s / fnt.unitsPerEm;
const nameAsc = bree.ascender * sc(bree, nameSize);
const nameDesc = -bree.descender * sc(bree, nameSize);
const claimAsc = lato.ascender * sc(lato, claimSize);
const claimDesc = -lato.descender * sc(lato, claimSize);
const D1 = Math.round(nameDesc + 8 + claimAsc);                            // name to the first claim line
const D2 = Math.round((lato.ascender - lato.descender) * sc(lato, claimSize) * 1.15); // claim line spacing
const blockH = nameAsc + D1 + D2 + claimDesc;
const nameBaseline = Math.round(H / 2 - blockH / 2 + nameAsc);
const claim1Baseline = nameBaseline + D1;
const claim2Baseline = claim1Baseline + D2;
// One path per glyph: resvg's tessellator can abort a merged multi-subpath path
// partway through for some glyph and coordinate combinations.
const glyphD = (fnt, text, x, baseline, size) =>
  fnt.getPaths(text, x, baseline, size).map((p) => p.toPathData(2)).filter(Boolean);
const nameD = glyphD(bree, NAME_A + NAME_B, textX, nameBaseline, nameSize);
const claim1D = glyphD(lato, CLAIM1, textX + 4, claim1Baseline, claimSize);
const claim2D = glyphD(lato, CLAIM2, textX + 4, claim2Baseline, claimSize);
const paths = (ds, fill) => ds.map((d) => `<path d="${d}" fill="${fill}"/>`).join("");

// Read a logo master as it is and return its inner markup with the scale factor
// for its own viewBox.
function embed(logoFile) {
  const src = readFileSync(join(__dir, logoFile), "utf8");
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const m = src.match(/viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/);
  const vbW = m ? parseFloat(m[1]) : 960.28;
  return { inner, scale: logoBox / vbW };
}

// The README banners: the logo on the left, then the wordmark and the claim.
for (const t of THEMES) {
  const { inner, scale } = embed(t.logo);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="TowerTorch">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <g transform="translate(${logoX},${logoY}) scale(${scale.toFixed(6)})">
${inner}
  </g>
  ${paths(nameD, t.name)}
  ${paths(claim1D, t.claim)}
  ${paths(claim2D, t.claim)}
</svg>
`;
  writeFileSync(join(__dir, `towertorch-banner${t.suffix}.svg`), svg);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  writeFileSync(join(__dir, `towertorch-banner${t.suffix}.png`), png);
  console.log(`banner${t.suffix} ok: ${W}x${H}, png ${png.length} bytes`);
}

// The support banner: the dunkel logo on white, without any text.
const { inner: dInner, scale: dScale } = embed("towertorch-dunkel.svg");
const logoOnly = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="TowerTorch">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <g transform="translate(${(W - logoBox) / 2},${logoY}) scale(${dScale.toFixed(6)})">
${dInner}
  </g>
</svg>
`;
writeFileSync(join(__dir, "towertorch-banner-logo.svg"), logoOnly);
const pngLogo = new Resvg(logoOnly, { fitTo: { mode: "width", value: W } }).render().asPng();
writeFileSync(join(__dir, "towertorch-banner-logo.png"), pngLogo);
console.log(`banner-logo ok, claim ${claimSize}px`);
