/* Render an SVG centred on a transparent square PNG of the given size, so a logo that
 * is taller than wide is not squeezed by Unraid's square icon boxes.
 * Usage: node render-png.mjs <in.svg> <out.png> <size>
 * Needs @resvg/resvg-js installed globally, like gen-banner.mjs. */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const groot = execSync("npm root -g").toString().trim();
const { Resvg } = require(`${groot}/@resvg/resvg-js`);
const [, , inp, outp, sizeArg] = process.argv;
const size = parseInt(sizeArg || "512", 10);

const src = readFileSync(inp, "utf8").replace(/<\?xml[^>]*\?>\s*/, "");
const [, , w, h] = src.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
const side = Math.max(w, h);
const inner = src.replace(/<svg\b([^>]*)>/, (_, attrs) =>
  `<svg${attrs.replace(/\s(width|height|x|y)="[^"]*"/g, "")} x="${(side - w) / 2}" y="${(side - h) / 2}" width="${w}" height="${h}">`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${size}" height="${size}">${inner}</svg>`;

const png = new Resvg(svg, { fitTo: { mode: "width", value: size }, background: "rgba(0,0,0,0)" }).render().asPng();
writeFileSync(outp, png);
console.log(`rendered ${inp} -> ${outp} @ ${size}x${size} (${png.length} bytes)`);
