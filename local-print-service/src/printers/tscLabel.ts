/**
 * tscLabel.ts — render a "لمسة أنوثة" branded jewelry label and send it to the
 * TSC TTP-244M Pro thermal label printer.
 *
 * Pipeline:
 *   1. Build an SVG (472×312 px = 59×39 mm @ 203 dpi) with logo, product name,
 *      Code 128 barcode (rendered to inline SVG via bwip-js), price, and the
 *      brand divider ornaments (♥ between rules).
 *   2. Rasterise the SVG to a 1-bit monochrome PNG via sharp.
 *   3. Pack the bitmap into a TSPL `BITMAP` command — TSC printers in RAW
 *      mode interpret TSPL natively, so this is what we send to the spooler.
 *   4. Stream the bytes to the printer through the existing winspool.drv RAW
 *      helper (`printRawBytes`) — same path the receipt printer uses, no
 *      `Out-Printer` quirks with binary payloads.
 *
 * Note on TSPL BITMAP byte order: each row is `Math.ceil(width/8)` bytes,
 * MSB-first, **inverted** vs. ESC/POS — for TSPL, bit = 0 means PRINT (black)
 * and bit = 1 means WHITE. We flip during packing.
 */
import sharp from "sharp";
import bwipjs from "bwip-js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { printRawBytes } from "../rawPrint.js";

// ─── Geometry ──────────────────────────────────────────────────────────────
// 59 mm × 39 mm at 203 dpi (8 dots/mm) → 472 × 312 dots exactly.
export const LABEL_WIDTH_PX = 472;
export const LABEL_HEIGHT_PX = 312;
export const LABEL_WIDTH_MM = 59;
export const LABEL_HEIGHT_MM = 39;
export const LABEL_GAP_MM = 2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// `dist/printers/tscLabel.js` and `src/printers/tscLabel.ts` both sit two
// levels deep — `../../assets/logo.png` works for both compiled and tsx-run.
const LOGO_PATH = resolve(__dirname, "..", "..", "assets", "logo.png");

// Logo block dimensions (px) inside the label canvas.
const LOGO_BLOCK = { x: 126, y: 6, width: 220, height: 60 } as const;

// Cache the logo once per process to avoid hitting disk on every label.
// We pre-resize it to the exact target slot, flatten transparency on white,
// and grayscale it — that way the composite step is just a copy.
let cachedLogo: { png: Buffer | null; loadedAt: number } | null = null;

async function loadLogoBuffer(): Promise<Buffer | null> {
  if (cachedLogo) return cachedLogo.png;
  try {
    const raw = await readFile(LOGO_PATH);
    const prepared = await sharp(raw)
      .resize({
        width: LOGO_BLOCK.width,
        height: LOGO_BLOCK.height,
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    cachedLogo = { png: prepared, loadedAt: Date.now() };
    return prepared;
  } catch {
    // Missing logo is non-fatal — caller falls back to a text placeholder.
    cachedLogo = { png: null, loadedAt: Date.now() };
    return null;
  }
}

// ─── Public types ──────────────────────────────────────────────────────────
export interface LabelInput {
  productName: string;
  priceOMR: number;
  barcode: string;
  copies?: number;
}

export interface LabelRenderResult {
  svg: string;
  png: Buffer;
  tspl: Buffer;
}

// ─── SVG template ──────────────────────────────────────────────────────────
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPrice(priceOMR: number): string {
  // Oman uses 3-decimal Rial. Always show 3 decimals so 5 → "5.000".
  return priceOMR.toFixed(3);
}

async function renderBarcodeSvg(barcode: string): Promise<string> {
  // bwip-js returns a complete <svg>…</svg> string. We embed it as-is into
  // the outer template via xlink so it stays a vector and rasterises crisp.
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: barcode,
    scale: 2,
    height: 12, // mm — bwip-js scales by `scale` to dots; matches our 50 px target after sizing.
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: "FFFFFF",
  });
  return svg;
}

export async function buildLabelSvg(
  input: LabelInput,
  hasLogo: boolean,
): Promise<string> {
  const { productName, priceOMR, barcode } = input;
  const barcodeSvg = await renderBarcodeSvg(barcode);

  // The barcode SVG comes with its own viewBox; we wrap it in a <g> with a
  // transform that fits it into our reserved slot (centred, 50 px tall).
  const barcodeWrapped = barcodeSvg
    .replace(/^<\?xml[^>]*\?>\s*/, "")
    .replace(
      /^<svg([^>]*)>/,
      `<svg$1 preserveAspectRatio="xMidYMid meet">`,
    );

  const productSafe = escapeXml(productName);
  const priceSafe = escapeXml(formatPrice(priceOMR));
  const barcodeSafe = escapeXml(barcode);

  // Layout (y-coordinates in px, label is 312 px tall):
  //   logo:               y =   6  → 66   (60 px tall)
  //   divider 1 (♥):      y =  76
  //   product name:       y = 100
  //   barcode:            y = 128 → 178   (50 px tall)
  //   barcode digits:     y = 196
  //   divider 2 (♥):      y = 218
  //   price:              y = 260
  //
  // 10 px side padding everywhere; black text on white background.
  const cx = LABEL_WIDTH_PX / 2; // 236

  // When we have a logo file we leave the slot empty here and composite the
  // PNG over the rasterised SVG in `svgToLabelPng` — librsvg's <image href>
  // support is unreliable across versions, so we don't depend on it.
  const logoBlock = hasLogo
    ? "" // logo is composited later
    : `<text x="${cx}" y="46" font-family="Playfair Display, 'Times New Roman', serif"
              font-size="28" font-weight="bold" text-anchor="middle" fill="#000">
         TOUCH OF FEMININITY
       </text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${LABEL_WIDTH_PX}" height="${LABEL_HEIGHT_PX}"
     viewBox="0 0 ${LABEL_WIDTH_PX} ${LABEL_HEIGHT_PX}">
  <rect width="100%" height="100%" fill="#ffffff"/>

  ${logoBlock}

  <!-- divider 1 with heart -->
  <line x1="40" y1="76" x2="200" y2="76" stroke="#000" stroke-width="1"/>
  <text x="${cx}" y="81" font-family="Arial, sans-serif" font-size="14"
        text-anchor="middle" fill="#000">&#9829;</text>
  <line x1="272" y1="76" x2="432" y2="76" stroke="#000" stroke-width="1"/>

  <!-- product name -->
  <text x="${cx}" y="105" font-family="Playfair Display, 'Times New Roman', serif"
        font-size="26" font-weight="bold" text-anchor="middle" fill="#000">
    ${productSafe}
  </text>

  <!-- barcode (Code 128, vector) -->
  <svg x="86" y="128" width="300" height="50" viewBox="0 0 300 50"
       preserveAspectRatio="none">
    ${stripOuterSvg(barcodeWrapped)}
  </svg>

  <!-- barcode digits -->
  <text x="${cx}" y="196" font-family="Inter, Helvetica, Arial, sans-serif"
        font-size="14" letter-spacing="1.5" text-anchor="middle" fill="#000">
    ${barcodeSafe}
  </text>

  <!-- divider 2 with heart -->
  <line x1="40" y1="218" x2="200" y2="218" stroke="#000" stroke-width="1"/>
  <text x="${cx}" y="223" font-family="Arial, sans-serif" font-size="14"
        text-anchor="middle" fill="#000">&#9829;</text>
  <line x1="272" y1="218" x2="432" y2="218" stroke="#000" stroke-width="1"/>

  <!-- price -->
  <text x="${cx}" y="270" font-family="Playfair Display, 'Times New Roman', serif"
        font-size="36" font-weight="bold" text-anchor="middle" fill="#000">
    ${priceSafe}  R.O
  </text>
</svg>`;
}

// bwip-js wraps everything in <svg>…</svg> — when nesting we want the inner
// drawing only so our outer viewBox controls the scale.
function stripOuterSvg(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

// ─── PNG rasterisation ─────────────────────────────────────────────────────
export async function svgToLabelPng(
  svg: string,
  logo: Buffer | null,
): Promise<Buffer> {
  // density:203 makes sharp render the SVG at the printer's native dpi so we
  // get a crisp 472×312 raster (matches the SVG width/height attrs exactly).
  let pipeline = sharp(Buffer.from(svg), { density: 203 })
    .resize({
      width: LABEL_WIDTH_PX,
      height: LABEL_HEIGHT_PX,
      fit: "fill",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" });

  if (logo) {
    pipeline = pipeline.composite([
      { input: logo, top: LOGO_BLOCK.y, left: LOGO_BLOCK.x },
    ]);
  }

  return await pipeline.png().toBuffer();
}

// ─── PNG → TSPL BITMAP ─────────────────────────────────────────────────────
/**
 * Build a complete TSPL job from a PNG buffer.
 *
 * TSPL BITMAP encoding:
 *   BITMAP x,y,widthBytes,height,mode,<binary>
 *   • widthBytes = ceil(width/8)
 *   • mode 0 = OVERWRITE (we always start from CLS so this is correct)
 *   • bit semantics are INVERTED vs ESC/POS: 0 = print (black), 1 = white.
 */
export async function pngToTspl(
  pngBuffer: Buffer,
  copies: number,
): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer)
    .resize({
      width: LABEL_WIDTH_PX,
      height: LABEL_HEIGHT_PX,
      fit: "fill",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (width !== LABEL_WIDTH_PX || height !== LABEL_HEIGHT_PX) {
    throw new Error(
      `unexpected raster size ${width}×${height} (expected ${LABEL_WIDTH_PX}×${LABEL_HEIGHT_PX})`,
    );
  }
  if (channels !== 1) {
    throw new Error(`expected 1 channel after grayscale, got ${channels}`);
  }

  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < bytesPerRow; xByte++) {
      // Start with all bits = 1 (white) and clear bits where we want black.
      let byte = 0xff;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x >= width) break;
        const gray = data[y * width + x];
        if (gray < 128) {
          // Black pixel → clear the bit (TSPL: 0 = print).
          byte &= ~(1 << (7 - bit)) & 0xff;
        }
      }
      bitmap[y * bytesPerRow + xByte] = byte;
    }
  }

  // TSPL header — newline-terminated ASCII commands.
  // DIRECTION 1 = print top-down (sticker peels off correctly with our roll).
  // DENSITY 8  = mid-range darkness (1=lightest, 15=darkest).
  // SPEED 4    = 4 ips, the TTP-244M Pro's safe default.
  const header = Buffer.from(
    `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm\r\n` +
      `GAP ${LABEL_GAP_MM} mm,0\r\n` +
      `DIRECTION 1\r\n` +
      `DENSITY 8\r\n` +
      `SPEED 4\r\n` +
      `CLS\r\n` +
      `BITMAP 0,0,${bytesPerRow},${height},0,`,
    "ascii",
  );

  const trailer = Buffer.from(`\r\nPRINT 1,${copies}\r\n`, "ascii");

  return Buffer.concat([header, bitmap, trailer]);
}

// ─── End-to-end ────────────────────────────────────────────────────────────
export async function renderLabel(
  input: LabelInput,
): Promise<LabelRenderResult> {
  const logo = await loadLogoBuffer();
  const svg = await buildLabelSvg(input, logo !== null);
  const png = await svgToLabelPng(svg, logo);
  const tspl = await pngToTspl(png, Math.max(1, input.copies ?? 1));
  return { svg, png, tspl };
}

/**
 * Render and print a label. 15 s timeout — beyond that the printer is almost
 * certainly offline / out of paper, and the cashier should retry rather than
 * keep the request hanging.
 */
export async function printLabel(
  printerName: string,
  input: LabelInput,
): Promise<{ pngBytes: number; tsplBytes: number }> {
  console.log(
    `[Label] request productName="${input.productName}" ` +
      `barcode="${input.barcode}" copies=${input.copies ?? 1}`,
  );
  const logo = await loadLogoBuffer();
  const svg = await buildLabelSvg(input, logo !== null);
  console.log(`[Label] svg generated ${LABEL_WIDTH_PX}x${LABEL_HEIGHT_PX}`);
  const png = await svgToLabelPng(svg, logo);
  console.log(`[Label] png rendered bytes=${png.length}`);
  const tspl = await pngToTspl(png, Math.max(1, input.copies ?? 1));
  console.log(`[Label] tspl bitmap bytes=${tspl.length}`);

  const printPromise = printRawBytes(printerName, tspl);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(Object.assign(new Error("printer timeout"), { code: "ETIMEDOUT" })),
      15_000,
    );
  });
  await Promise.race([printPromise, timeoutPromise]);
  console.log(`[Label] sent to printer "${printerName}"`);
  return { pngBytes: png.length, tsplBytes: tspl.length };
}
