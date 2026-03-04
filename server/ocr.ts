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

async function preprocessVariant(inputPath: string, variant: string): Promise<string> {
  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${baseName}_${variant}_${Date.now()}.png`);

  const img = sharp(inputPath);
  const metadata = await img.metadata();

  let pipeline = sharp(inputPath);

  if (variant === "clean") {
    pipeline = pipeline
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.0 })
      .png();
  } else if (variant === "contrast") {
    pipeline = pipeline
      .greyscale()
      .normalize()
      .linear(1.5, -30)
      .sharpen({ sigma: 1.2 })
      .png();
  } else if (variant === "threshold") {
    pipeline = pipeline
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .threshold(160)
      .png();
  } else if (variant === "upscale") {
    const w = metadata.width || 1000;
    pipeline = pipeline
      .resize({ width: Math.min(w * 2, 4000) })
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.2 })
      .png();
  }

  await pipeline.toFile(outputPath);
  return outputPath;
}

async function runTesseract(imagePath: string, lang: string = "eng+ara", psm: string = "6"): Promise<string> {
  try {
    const { stdout } = await execFileP("tesseract", [
      imagePath,
      "stdout",
      "-l", lang,
      "--psm", psm,
      "--oem", "3",
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

function parseTotalAmount(text: string): number | null {
  const patterns = [
    /(?:Total|TOTAL|الإجمالي|المجموع|Grand\s*Total)[:\s]*([0-9,]+\.?\d*)/i,
    /(?:AMOUNT|Amount|Net)[:\s]*([0-9,]+\.?\d*)\s*$/im,
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

function parseDescription(desc: string): { productCode: string; color: string; size: string } {
  const parts = desc.trim().split(/\s+/);
  if (parts.length === 0) return { productCode: desc, color: "", size: "" };

  const productCode = parts[0];
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

  return { productCode, color, size };
}

function extractTableLines(text: string): OcrInvoiceLine[] {
  const lines: OcrInvoiceLine[] = [];
  const textLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let lineNo = 0;

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
        lineNo++;
        const description = texts.join(" ") || `Item ${lineNo}`;
        const { productCode, color, size } = parseDescription(description);

        let qty: number, price: number, amount: number;

        if (numbers.length >= 3) {
          qty = Math.round(numbers[numbers.length - 3]);
          price = numbers[numbers.length - 2];
          amount = numbers[numbers.length - 1];

          if (Math.abs(qty * price - amount) > amount * 0.2 && numbers.length >= 4) {
            qty = Math.round(numbers[numbers.length - 4]);
            price = numbers[numbers.length - 2];
            amount = numbers[numbers.length - 1];
          }
        } else {
          qty = Math.round(numbers[0]);
          price = numbers[1];
          amount = qty * price;
        }

        if (qty > 0 && qty < 100000 && (price > 0 || amount > 0)) {
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
      }
      continue;
    }

    const tablePatterns = [
      /^(\d+)\s+(.+?)\s+(\d+)\s+(?:PCS|pcs|Pcs|قطعة)?\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
      /^(\d+)\s+(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
      /^(\d+)[.\s]+(.+?)\s{2,}(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
      /^(\d+)\s+(.+?)\s+(\d+)\s+\d+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/,
    ];

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
    lineNo = 0;
    for (const line of textLines) {
      if (skipPatterns.test(line.trim())) continue;
      const m = line.match(/(.+?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/);
      if (m) {
        const description = m[1].trim();
        if (description.length < 2) continue;
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
      }
    }
  }

  if (lines.length === 0) {
    lineNo = 0;
    const allNumbers: Array<{ line: string; nums: number[] }> = [];
    for (const line of textLines) {
      if (skipPatterns.test(line.trim())) continue;
      const nums = line.match(/\d+(?:\.\d+)?/g);
      if (nums && nums.length >= 2) {
        allNumbers.push({ line, nums: nums.map(Number) });
      }
    }

    for (const { line, nums } of allNumbers) {
      if (nums.length >= 2) {
        lineNo++;
        const textPart = line.replace(/[\d.]+/g, " ").replace(/[|│\[\]]/g, " ").trim();
        const description = textPart.length >= 2 ? textPart : `Item ${lineNo}`;
        const { productCode, color, size } = parseDescription(description);

        let qty: number, price: number, amount: number;
        if (nums.length >= 3) {
          qty = Math.round(nums[nums.length - 3]);
          price = nums[nums.length - 2];
          amount = nums[nums.length - 1];
        } else {
          qty = Math.round(nums[0]);
          price = nums[1];
          amount = qty * price;
        }

        if (qty > 0 && qty <= 10000 && price > 0 && price <= 100000) {
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
      }
    }
  }

  return lines;
}

async function tryOcrWithSettings(inputPath: string): Promise<{ text: string; lines: OcrInvoiceLine[] }> {
  const variants: Array<{ preprocess: string; lang: string; psm: string }> = [
    { preprocess: "clean", lang: "eng+ara", psm: "6" },
    { preprocess: "upscale", lang: "eng+ara", psm: "6" },
    { preprocess: "contrast", lang: "eng", psm: "6" },
    { preprocess: "clean", lang: "eng", psm: "4" },
    { preprocess: "threshold", lang: "eng+ara", psm: "6" },
  ];

  let bestText = "";
  let bestLines: OcrInvoiceLine[] = [];

  for (const v of variants) {
    let processedPath = "";
    try {
      processedPath = await preprocessVariant(inputPath, v.preprocess);
      const text = await runTesseract(processedPath, v.lang, v.psm);
      const lines = extractTableLines(text);

      if (lines.length > bestLines.length) {
        bestText = text;
        bestLines = lines;
      }

      if (!bestText && text.length > bestText.length) {
        bestText = text;
      }

      if (bestLines.length >= 3) break;
    } catch (e) {
    } finally {
      if (processedPath) await safeUnlink(processedPath);
    }
  }

  if (bestLines.length === 0) {
    try {
      const rawText = await runTesseract(inputPath, "eng+ara", "6");
      const rawLines = extractTableLines(rawText);
      if (rawLines.length > 0) {
        bestText = rawText;
        bestLines = rawLines;
      } else if (rawText.length > bestText.length) {
        bestText = rawText;
      }
    } catch {}
  }

  return { text: bestText, lines: bestLines };
}

export async function processInvoiceImage(filePath: string): Promise<OcrInvoiceResult> {
  const { text: rawText, lines } = await tryOcrWithSettings(filePath);

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
