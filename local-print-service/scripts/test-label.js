#!/usr/bin/env node
/**
 * scripts/test-label.js
 *
 * Generate a sample "لمسة أنوثة" jewelry label and write the SVG, PNG and
 * TSPL bytes to disk. No printer is touched — this is the offline preview
 * we use to QA the design before sending real jobs to the TSC TTP-244M Pro.
 *
 * Run:
 *   npm run build
 *   npm run test:label
 *
 * Outputs land in `./test-output/` next to package.json.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "test-output");

// Dynamic import on Windows must use a file:// URL — bare absolute paths
// (C:\…) are rejected by the ESM loader.
const { renderLabel } = await import(
  pathToFileURL(
    resolve(__dirname, "..", "dist", "printers", "tscLabel.js"),
  ).href
);

const sample = {
  productName: "Diamond Necklace",
  priceOMR: 5.5,
  barcode: "1234567890123",
  copies: 1,
};

console.log("[test-label] rendering sample:", sample);

const { svg, png, tspl } = await renderLabel(sample);

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "label.svg"), svg);
await writeFile(resolve(outDir, "label.png"), png);
await writeFile(resolve(outDir, "label.prn"), tspl);

console.log(`[test-label] svg  → ${resolve(outDir, "label.svg")} (${svg.length} chars)`);
console.log(`[test-label] png  → ${resolve(outDir, "label.png")} (${png.length} bytes)`);
console.log(`[test-label] tspl → ${resolve(outDir, "label.prn")} (${tspl.length} bytes)`);
console.log("[test-label] done. Open label.png to preview, label.prn to inspect raw TSPL.");
