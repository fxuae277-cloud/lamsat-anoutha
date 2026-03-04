import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

const execFileP = promisify(execFile);

export interface OcrInvoiceLine {
  lineNo: number;
  description: string;
  productCode: string;
  color: string;
  size: string;
  qty: number;
  price: number;
  amount: number;
}

export interface OcrInvoiceResult {
  rawText: string;
  lines: OcrInvoiceLine[];
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
}

async function preprocessImage(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/, "_processed.png");

  await sharp(inputPath)
    .greyscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .threshold(140)
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function runTesseract(imagePath: string): Promise<string> {
  try {
    const { stdout } = await execFileP("tesseract", [
      imagePath,
      "stdout",
      "-l", "eng+ara",
      "--psm", "6",
      "--oem", "3",
    ], { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (err: any) {
    if (err.stdout) return err.stdout;
    throw new Error("OCR failed: " + (err.message || err));
  }
}

function parseInvoiceNumber(text: string): string | null {
  const patterns = [
    /(?:Invoice|Inv|INV|فاتورة)[#:\s]*([A-Z0-9\-\/]+)/i,
    /(?:No|NO|رقم)[.:\s]*([A-Z0-9\-\/]+)/i,
    /\b(INV[\-\/]?\d+)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function parseInvoiceDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (m[3] && m[3].length === 4) {
        const d = m[1].padStart(2, "0");
        const mo = m[2].padStart(2, "0");
        return `${m[3]}-${mo}-${d}`;
      }
      if (m[1] && m[1].length === 4) {
        const mo = m[2].padStart(2, "0");
        const d = m[3].padStart(2, "0");
        return `${m[1]}-${mo}-${d}`;
      }
    }
  }
  return null;
}

function parseTotalAmount(text: string): number | null {
  const patterns = [
    /(?:Total|TOTAL|الإجمالي|المجموع|Grand Total)[:\s]*([0-9,]+\.?\d*)/i,
    /(?:AMOUNT|Amount)[:\s]*([0-9,]+\.?\d*)\s*$/im,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function parseDescription(desc: string): { productCode: string; color: string; size: string } {
  const parts = desc.trim().split(/\s+/);
  if (parts.length === 0) return { productCode: desc, color: "", size: "" };

  const productCode = parts[0];
  let color = "";
  let size = "";

  const colorKeywords = [
    "BLACK", "WHITE", "RED", "BLUE", "GREEN", "YELLOW", "PINK", "PURPLE",
    "ORANGE", "BROWN", "GREY", "GRAY", "SILVER", "GOLD", "MAROON", "NAVY",
    "BEIGE", "CREAM", "COFFEE", "ROSE", "CAMEL", "NUDE", "BURGUNDY", "TEAL",
    "CORAL", "IVORY", "KHAKI", "PEACH", "MINT", "OLIVE", "TURQUOISE", "CRIMSON",
    "FUCHSIA", "INDIGO", "LAVENDER", "MAGENTA", "SALMON", "TAN", "VIOLET",
    "أسود", "أبيض", "أحمر", "أزرق", "أخضر", "وردي", "بني", "رمادي", "ذهبي", "فضي",
  ];

  for (let i = 1; i < parts.length; i++) {
    const upper = parts[i].toUpperCase();
    if (colorKeywords.includes(upper)) {
      color = parts[i];
    } else if (/\d/.test(parts[i]) && i >= parts.length - 2) {
      size = parts.slice(i).join(" ");
      break;
    }
  }

  if (!color && parts.length >= 2) {
    color = parts[1];
  }

  return { productCode, color, size };
}

function extractTableLines(text: string): OcrInvoiceLine[] {
  const lines: OcrInvoiceLine[] = [];
  const textLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const tablePatterns = [
    /^(\d+)\s+(.+?)\s+(\d+)\s+(?:PCS|pcs|Pcs|قطعة)?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    /^(\d+)\s+(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    /^(\d+)[.\s]+(.+?)\s{2,}(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    /^(\d+)\s+(.+?)\s+(\d+)\s+\d+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
  ];

  let lineNo = 0;
  for (const line of textLines) {
    for (const pattern of tablePatterns) {
      const m = line.match(pattern);
      if (m) {
        lineNo++;
        const description = m[2].trim();
        const qty = parseInt(m[3]) || 0;
        const price = parseFloat(m[4]) || 0;
        const amount = parseFloat(m[5]) || 0;
        const { productCode, color, size } = parseDescription(description);

        if (qty > 0 && (price > 0 || amount > 0)) {
          lines.push({
            lineNo,
            description,
            productCode,
            color,
            size,
            qty,
            price: price || (amount / qty),
            amount: amount || (price * qty),
          });
        }
        break;
      }
    }
  }

  if (lines.length === 0) {
    const simplePatterns = [
      /(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    ];
    lineNo = 0;
    for (const line of textLines) {
      if (/total|subtotal|الإجمالي|المجموع|amount|header|no\s+desc/i.test(line)) continue;
      for (const pattern of simplePatterns) {
        const m = line.match(pattern);
        if (m) {
          const description = m[1].trim();
          if (description.length < 2 || /^[A-Z\s]{2,}$/.test(description) && !/\d/.test(description)) continue;
          lineNo++;
          const qty = parseInt(m[2]) || 0;
          const price = parseFloat(m[3]) || 0;
          const amount = parseFloat(m[4]) || 0;
          const { productCode, color, size } = parseDescription(description);

          if (qty > 0 && price > 0) {
            lines.push({
              lineNo,
              description,
              productCode,
              color,
              size,
              qty,
              price,
              amount: amount || (price * qty),
            });
          }
          break;
        }
      }
    }
  }

  return lines;
}

export async function processInvoiceImage(filePath: string): Promise<OcrInvoiceResult> {
  const processedPath = await preprocessImage(filePath);

  const rawText = await runTesseract(processedPath);

  try {
    await fs.unlink(processedPath);
  } catch {}

  const lines = extractTableLines(rawText);
  const invoiceNumber = parseInvoiceNumber(rawText);
  const invoiceDate = parseInvoiceDate(rawText);
  const totalAmount = parseTotalAmount(rawText);

  return {
    rawText,
    lines,
    invoiceNumber,
    invoiceDate,
    totalAmount,
  };
}
