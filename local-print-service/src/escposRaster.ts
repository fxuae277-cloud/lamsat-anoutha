/**
 * escposRaster.ts — convert a PNG buffer into ESC/POS raster bytes that an
 * EPSON-compatible thermal printer (TM-T100, TM-T20, generic 80mm/58mm) can
 * print directly.
 *
 * Pipeline:
 *   1. sharp: decode PNG → resize to printer's exact dot width (576 for 80mm,
 *      384 for 58mm) → grayscale → raw 1 byte/pixel buffer.
 *   2. Threshold each pixel at 128 → 1-bit (1 = print, 0 = white).
 *   3. Pack into MSB-first bytes (1 byte holds 8 horizontal dots).
 *   4. Wrap with ESC @ (init), ESC a 1 (centre alignment), one or more
 *      `GS v 0` raster blocks (each ≤ 2303 rows — printer hard limit), one LF
 *      flush, and `GS V 1` partial cut.
 *
 * Why we slice on 2303 rows: the y-count field of GS v 0 is two bytes
 * (yL + yH×256), max value 65535, but in practice printers reject blocks
 * larger than 2303 rows for buffer reasons. Splitting into ≤ 1024-row chunks
 * is the conservative choice that all EPSON variants accept.
 */

import sharp from "sharp";

export const RASTER_BUILD_MARKER = "***RASTER PRINT v1***";

export type PaperWidth = "58mm" | "80mm";

export const PAPER_WIDTH_DOTS: Record<PaperWidth, number> = {
  "80mm": 576,
  "58mm": 384,
};

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const MAX_ROWS_PER_BLOCK = 1024;

export interface RasterizeResult {
  bytes: Buffer;
  widthDots: number;
  heightRows: number;
  blocks: number;
}

/**
 * ESC p 0 25 250 — fire pin 2 (cash drawer #1) with a 50ms pulse.
 *   0x1B 0x70 0x00 0x19 0xFA
 *   ESC  p    m    t1   t2
 *   m=0  → drawer #1 (pin 2 on the DK port)
 *   t1=25, t2=250 → on-time=25×2ms=50ms, off-time=250×2ms=500ms
 * Exported so /open-drawer endpoint can reuse the same constant.
 */
export const DRAWER_KICK_BYTES = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

/**
 * Convert a PNG buffer (as decoded from base64) into ESC/POS raster bytes
 * for the given paper width. The returned bytes are everything the printer
 * needs: init, alignment, raster image, line feeds, optional cash-drawer kick,
 * and a partial cut at end.
 *
 * `openDrawer` injects the drawer-kick command AFTER the feed lines and
 * BEFORE the cut — some EPSON firmwares ignore the kick if it arrives while
 * the print engine is still flushing rows, so the feed must finish first.
 */
export async function pngToEscposRaster(
  pngBuffer: Buffer,
  paperWidth: PaperWidth,
  feedLinesAfter = 4,
  openDrawer = false,
): Promise<RasterizeResult> {
  const widthDots = PAPER_WIDTH_DOTS[paperWidth];

  // 1. sharp pipeline: resize → grayscale → raw 1 byte/pixel.
  const { data, info } = await sharp(pngBuffer)
    .resize({
      width: widthDots,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (width !== widthDots) {
    throw new Error(
      `unexpected sharp output width=${width} (expected ${widthDots})`,
    );
  }
  if (channels !== 1) {
    throw new Error(`expected 1 channel after grayscale, got ${channels}`);
  }

  // 2 + 3. Threshold each pixel and pack 8 dots/byte, MSB first.
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < bytesPerRow; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x >= width) break;
        const gray = data[y * width + x];
        if (gray < 128) byte |= 1 << (7 - bit);
      }
      bitmap[y * bytesPerRow + xByte] = byte;
    }
  }

  // 4. Wrap with ESC/POS framing.
  const out: Buffer[] = [];
  // ESC @ — initialise
  out.push(Buffer.from([ESC, 0x40]));
  // ESC a 1 — centre alignment (image is exactly the printable width so any
  // 1-2-row rounding lands centred).
  out.push(Buffer.from([ESC, 0x61, 0x01]));

  let blocks = 0;
  for (let rowStart = 0; rowStart < height; rowStart += MAX_ROWS_PER_BLOCK) {
    const rowsInBlock = Math.min(MAX_ROWS_PER_BLOCK, height - rowStart);
    const xL = bytesPerRow & 0xff;
    const xH = (bytesPerRow >> 8) & 0xff;
    const yL = rowsInBlock & 0xff;
    const yH = (rowsInBlock >> 8) & 0xff;
    out.push(Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
    out.push(
      bitmap.subarray(
        rowStart * bytesPerRow,
        (rowStart + rowsInBlock) * bytesPerRow,
      ),
    );
    blocks++;
  }

  // Feed → (optional) drawer kick → cut.
  // Order matters: the drawer-kick MUST land after the feed bytes (otherwise
  // some EPSON firmwares ignore it because the engine is still busy advancing
  // paper) and before the cut so the receipt and the open drawer hit the
  // cashier at the same moment.
  for (let i = 0; i < feedLinesAfter; i++) out.push(Buffer.from([LF]));
  if (openDrawer) {
    out.push(DRAWER_KICK_BYTES);
  }
  // GS V 1 — partial cut
  out.push(Buffer.from([GS, 0x56, 0x01]));

  return {
    bytes: Buffer.concat(out),
    widthDots: width,
    heightRows: height,
    blocks,
  };
}
