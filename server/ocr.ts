import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import crypto from "crypto";

const execFileP = promisify(execFile);

const UPLOADS_ORIGINAL = path.resolve("uploads/original");
const UPLOADS_PROCESSED = path.resolve("uploads/processed");

export interface OcrParsedItem {
  code: string;
  color: string;
  size: string;
  qty: number;
  unitCost: number;
  amount: number;
}

export interface OcrParseResult {
  ok: true;
  parsed: {
    items: OcrParsedItem[];
    invoiceNo: string | null;
    date: string | null;
    totalQty: number;
    totalAmount: number;
    rawText: string;
  };
}

export interface OcrError {
  ok: false;
  stage: "upload" | "preprocess" | "ocr" | "parse";
  error: string;
}

export type OcrResult = OcrParseResult | OcrError;

async function ensureDirs() {
  await fs.mkdir(UPLOADS_ORIGINAL, { recursive: true });
  await fs.mkdir(UPLOADS_PROCESSED, { recursive: true });
}

export function generateFileId(): string {
  return crypto.randomUUID();
}

export async function saveUploadedFile(fileBuffer: Buffer, originalName: string): Promise<{ fileId: string; filePath: string }> {
  await ensureDirs();
  const fileId = generateFileId();
  const ext = path.extname(originalName).toLowerCase() || ".png";
  const filePath = path.join(UPLOADS_ORIGINAL, `${fileId}${ext}`);
  await fs.writeFile(filePath, fileBuffer);
  return { fileId, filePath };
}

async function preprocessImage(inputPath: string, fileId: string, variant: string): Promise<string> {
  const outputPath = path.join(UPLOADS_PROCESSED, `${fileId}_${variant}_${Date.now()}.png`);

  if (path.resolve(inputPath) === path.resolve(outputPath)) {
    throw new Error("Input and output paths must differ");
  }

  let pipeline = sharp(inputPath);
  const metadata = await sharp(inputPath).metadata();

  if (variant === "clean") {
    pipeline = pipeline.greyscale().normalize().sharpen({ sigma: 1.0 }).png();
  } else if (variant === "contrast") {
    pipeline = pipeline.greyscale().normalize().linear(1.5, -30).sharpen({ sigma: 1.2 }).png();
  } else if (variant === "threshold") {
    pipeline = pipeline.greyscale().normalize().sharpen({ sigma: 1.5 }).threshold(160).png();
  } else if (variant === "upscale") {
    const w = metadata.width || 1000;
    pipeline = pipeline.resize({ width: Math.min(w * 2, 4000) }).greyscale().normalize().sharpen({ sigma: 1.2 }).png();
  }

  await pipeline.toFile(outputPath);
  return outputPath;
}

async function runTesseract(imagePath: string, lang: string = "eng+ara", psm: string = "6"): Promise<string> {
  try {
    const { stdout } = await execFileP("tesseract", [
      imagePath, "stdout", "-l", lang, "--psm", psm, "--oem", "3",
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
    return stdout;
  } catch (err: any) {
    if (err.stdout) return err.stdout;
    return "";
  }
}

async function safeUnlink(filePath: string) {
  try { await fs.unlink(filePath); } catch {}
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
        return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
      if (m[1] && m[1].length === 4) {
        return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      }
    }
  }
  return null;
}

const COLOR_KEYWORDS = [
  "BLACK", "WHITE", "RED", "BLUE", "GREEN", "YELLOW", "PINK", "PURPLE",
  "ORANGE", "BROWN", "GREY", "GRAY", "SILVER", "GOLD", "MAROON", "NAVY",
  "BEIGE", "CREAM", "COFFEE", "ROSE", "CAMEL", "NUDE", "BURGUNDY", "TEAL",
  "CORAL", "IVORY", "KHAKI", "PEACH", "MINT", "OLIVE", "TURQUOISE", "CRIMSON",
  "FUCHSIA", "INDIGO", "LAVENDER", "MAGENTA", "SALMON", "TAN", "VIOLET",
  "CHARCOAL", "COPPER", "CHAMPAGNE", "EMERALD", "RUBY", "SAPPHIRE",
  "أسود", "أبيض", "أحمر", "أزرق", "أخضر", "وردي", "بني", "رمادي", "ذهبي", "فضي",
  "بيج", "كريمي", "زهري", "برتقالي", "بنفسجي", "كحلي", "عنابي",
];

function fuzzyMatchColor(word: string): string {
  const upper = word.toUpperCase().replace(/[^A-Z\u0600-\u06FF]/g, "");
  if (upper.length < 3) return "";
  for (const c of COLOR_KEYWORDS) {
    if (c.toUpperCase() === upper) return c;
  }
  for (const c of COLOR_KEYWORDS) {
    const cu = c.toUpperCase();
    if (cu.length >= 4 && upper.length >= 4) {
      if (upper.includes(cu) || cu.includes(upper)) return c;
      let matches = 0;
      for (let i = 0; i < Math.min(cu.length, upper.length); i++) {
        if (cu[i] === upper[i]) matches++;
      }
      if (matches / Math.max(cu.length, upper.length) > 0.6) return c;
    }
  }
  return "";
}

function parseItemDescription(desc: string): { code: string; color: string; size: string } {
  const parts = desc.trim().split(/\s+/);
  if (parts.length === 0) return { code: desc, color: "", size: "" };

  const code = parts[0];
  let color = "";
  let size = "";

  for (let i = 1; i < parts.length; i++) {
    const matched = fuzzyMatchColor(parts[i]);
    if (matched) {
      color = matched;
    } else if (/\d/.test(parts[i]) && i >= parts.length - 2) {
      size = parts.slice(i).join(" ");
      break;
    }
  }

  if (!color && parts.length >= 2) {
    color = parts[1];
  }

  return { code, color, size };
}

function extractItems(text: string): OcrParsedItem[] {
  const items: OcrParsedItem[] = [];
  const textLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const skipPatterns = /^(total|subtotal|الإجمالي|المجموع|amount|header|no\s+desc|sr|s\.?n|item|description|qty|price|unit|الصنف|الكمية|السعر|الوصف|البيان|#)/i;

  for (const line of textLines) {
    if (skipPatterns.test(line.trim())) continue;

    const pipeParts = line.split(/[|│┃\u2502]/).map(p => p.trim()).filter(p => p.length > 0);

    if (pipeParts.length >= 3) {
      const numbers: number[] = [];
      const texts: string[] = [];

      for (const part of pipeParts) {
        const cleaned = part.replace(/[^\d.]/g, "");
        const num = parseFloat(cleaned);
        if (!isNaN(num) && num > 0 && /^\d+\.?\d*$/.test(cleaned)) {
          numbers.push(num);
        } else if (part.length >= 2) {
          texts.push(part);
        }
      }

      if (numbers.length >= 2) {
        const description = texts.join(" ") || `Item ${items.length + 1}`;
        const { code, color, size } = parseItemDescription(description);

        let qty: number, unitCost: number, amount: number;
        if (numbers.length >= 3) {
          qty = Math.round(numbers[numbers.length - 3]);
          unitCost = numbers[numbers.length - 2];
          amount = numbers[numbers.length - 1];
          if (Math.abs(qty * unitCost - amount) > amount * 0.2 && numbers.length >= 4) {
            qty = Math.round(numbers[numbers.length - 4]);
            unitCost = numbers[numbers.length - 2];
            amount = numbers[numbers.length - 1];
          }
        } else {
          qty = Math.round(numbers[0]);
          unitCost = numbers[1];
          amount = qty * unitCost;
        }

        if (qty > 0 && qty < 100000 && (unitCost > 0 || amount > 0)) {
          items.push({
            code, color, size,
            qty,
            unitCost: unitCost || (amount / qty),
            amount: amount || (unitCost * qty),
          });
        }
      }
      continue;
    }

    const tablePatterns = [
      /^(\d+)\s+(.+?)\s+(\d+)\s+(?:PCS|pcs|Pcs|قطعة)?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
      /^(\d+)\s+(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
      /^(\d+)[.\s]+(.+?)\s{2,}(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    ];

    for (const pattern of tablePatterns) {
      const m = line.match(pattern);
      if (m) {
        const description = m[2].trim();
        const qty = parseInt(m[3]) || 0;
        const unitCost = parseFloat(m[4]) || 0;
        const amount = parseFloat(m[5]) || 0;
        const { code, color, size } = parseItemDescription(description);

        if (qty > 0 && (unitCost > 0 || amount > 0)) {
          items.push({
            code, color, size, qty,
            unitCost: unitCost || (amount / qty),
            amount: amount || (unitCost * qty),
          });
        }
        break;
      }
    }
  }

  if (items.length === 0) {
    for (const line of textLines) {
      if (skipPatterns.test(line.trim())) continue;
      const m = line.match(/(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/);
      if (m) {
        const description = m[1].trim();
        if (description.length < 2) continue;
        const qty = parseInt(m[2]) || 0;
        const unitCost = parseFloat(m[3]) || 0;
        const amount = parseFloat(m[4]) || 0;
        const { code, color, size } = parseItemDescription(description);

        if (qty > 0 && unitCost > 0) {
          items.push({
            code, color, size, qty, unitCost,
            amount: amount || (unitCost * qty),
          });
        }
      }
    }
  }

  if (items.length === 0) {
    for (const line of textLines) {
      if (skipPatterns.test(line.trim())) continue;
      const nums = line.match(/\d+(?:\.\d+)?/g);
      if (nums && nums.length >= 2) {
        const numArr = nums.map(Number);
        const textPart = line.replace(/[\d.]+/g, " ").replace(/[|│\[\]]/g, " ").trim();
        const description = textPart.length >= 2 ? textPart : `Item ${items.length + 1}`;
        const { code, color, size } = parseItemDescription(description);

        let qty: number, unitCost: number, amount: number;
        if (numArr.length >= 3) {
          qty = Math.round(numArr[numArr.length - 3]);
          unitCost = numArr[numArr.length - 2];
          amount = numArr[numArr.length - 1];
        } else {
          qty = Math.round(numArr[0]);
          unitCost = numArr[1];
          amount = qty * unitCost;
        }

        if (qty > 0 && qty <= 10000 && unitCost > 0 && unitCost <= 100000) {
          items.push({
            code, color, size, qty,
            unitCost: unitCost || (amount / qty),
            amount: amount || (unitCost * qty),
          });
        }
      }
    }
  }

  return items;
}

export async function parseInvoiceFile(fileId: string): Promise<OcrResult> {
  await ensureDirs();

  const files = await fs.readdir(UPLOADS_ORIGINAL);
  const originalFile = files.find(f => f.startsWith(fileId));
  if (!originalFile) {
    return { ok: false, stage: "upload", error: `File not found: ${fileId}` };
  }

  const inputPath = path.join(UPLOADS_ORIGINAL, originalFile);

  const ocrVariants: Array<{ preprocess: string; lang: string; psm: string }> = [
    { preprocess: "clean", lang: "eng+ara", psm: "6" },
    { preprocess: "upscale", lang: "eng+ara", psm: "6" },
    { preprocess: "contrast", lang: "eng", psm: "6" },
    { preprocess: "clean", lang: "eng", psm: "4" },
    { preprocess: "threshold", lang: "eng+ara", psm: "6" },
  ];

  let bestText = "";
  let bestItems: OcrParsedItem[] = [];

  for (const v of ocrVariants) {
    let processedPath = "";
    try {
      processedPath = await preprocessImage(inputPath, fileId, v.preprocess);
      const text = await runTesseract(processedPath, v.lang, v.psm);
      const parsedItems = extractItems(text);

      if (parsedItems.length > bestItems.length) {
        bestText = text;
        bestItems = parsedItems;
      }
      if (!bestText && text.length > 0) {
        bestText = text;
      }
      if (bestItems.length >= 3) break;
    } catch (e: any) {
      console.error(`OCR variant ${v.preprocess}/${v.lang} failed:`, e.message);
    } finally {
      if (processedPath) await safeUnlink(processedPath);
    }
  }

  if (bestItems.length === 0) {
    try {
      const rawText = await runTesseract(inputPath, "eng+ara", "6");
      const rawItems = extractItems(rawText);
      if (rawItems.length > 0) {
        bestText = rawText;
        bestItems = rawItems;
      } else if (rawText.length > bestText.length) {
        bestText = rawText;
      }
    } catch {}
  }

  try { await safeUnlink(inputPath); } catch {}

  const invoiceNo = parseInvoiceNumber(bestText);
  const date = parseInvoiceDate(bestText);
  const totalQty = bestItems.reduce((s, i) => s + i.qty, 0);
  const totalAmount = bestItems.reduce((s, i) => s + i.amount, 0);

  return {
    ok: true,
    parsed: {
      items: bestItems,
      invoiceNo,
      date,
      totalQty,
      totalAmount,
      rawText: bestText,
    },
  };
}
