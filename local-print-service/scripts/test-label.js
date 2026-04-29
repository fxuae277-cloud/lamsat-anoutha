#!/usr/bin/env node
/**
 * scripts/test-label.js
 *
 * Generate three sample "لمسة أنوثة" jewelry labels exercising the layout
 * variants we ship to production:
 *
 *   1. label-basic         — productName + price + barcode (no variant line)
 *   2. label-with-variant  — pre-built `productVariant` string
 *   3. label-color-only    — structured `color` only (no size)
 *
 * No printer is touched — these are the offline previews we use to QA the
 * design before sending real jobs to the TSC TTP-244M Pro.
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

const SCENARIOS = [
  {
    slug: "label-basic",
    input: {
      productName: "Diamond Necklace",
      priceOMR: 5.5,
      barcode: "1234567890123",
      copies: 1,
    },
  },
  {
    slug: "label-with-variant",
    input: {
      productName: "Premium Bag",
      productVariant: "Color: Black | Size: M",
      priceOMR: 25.0,
      barcode: "9876543210987",
      copies: 1,
    },
  },
  {
    slug: "label-color-only",
    input: {
      productName: "Silk Scarf",
      color: "Red",
      priceOMR: 8.5,
      barcode: "5555555555555",
      copies: 1,
    },
  },
];

await mkdir(outDir, { recursive: true });

for (const { slug, input } of SCENARIOS) {
  console.log(`[test-label] rendering ${slug}:`, input);
  const { svg, png, tspl } = await renderLabel(input);
  await writeFile(resolve(outDir, `${slug}.svg`), svg);
  await writeFile(resolve(outDir, `${slug}.png`), png);
  await writeFile(resolve(outDir, `${slug}.prn`), tspl);
  console.log(
    `[test-label] ${slug}: svg=${svg.length}c png=${png.length}b tspl=${tspl.length}b`,
  );
}

console.log(`[test-label] done — open ${outDir} to inspect the previews.`);
