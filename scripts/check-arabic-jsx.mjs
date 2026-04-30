// Lightweight static check: warn on Arabic text appearing directly inside JSX
// (between >…< or in common string-valued props like placeholder, title, label,
// aria-label) — phase-3 will replace these with t() calls.
//
// Usage:
//   node scripts/check-arabic-jsx.mjs              (warnings only)
//   node scripts/check-arabic-jsx.mjs --strict     (exit 1 if any warning)
//
// Out of scope:
//   - pages/mobile/MobilePOS.tsx (Phase 3.x — not yet reached)
//   - components/Invoice58.tsx, Invoice80.tsx (print templates)
//   - lib/printer.ts (print service)
//   - pages/POS.tsx is now IN SCOPE after Phase 3.2; remaining occurrences
//     are CATEGORY_ICONS keys (DB-bound) and the audit-trail reason string,
//     both intentionally not translated.
//
// This is a stand-in for an ESLint plugin until ESLint is wired into the
// project; same diagnostic, just printed to stdout instead of the editor.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const clientSrc = path.join(root, "client", "src");

const EXCLUDE_FILES = new Set([
  path.join(clientSrc, "pages", "mobile", "MobilePOS.tsx"),
  path.join(clientSrc, "components", "Invoice58.tsx"),
  path.join(clientSrc, "components", "Invoice80.tsx"),
  path.join(clientSrc, "lib", "printer.ts"),
]);

const ARABIC = /[؀-ۿ]/;
const JSX_TEXT = />\s*([^<>{}\n]*[؀-ۿ][^<>{}\n]*?)\s*</g;
const STRING_PROP = /\b(placeholder|title|label|aria-label|alt|description)\s*=\s*"([^"]*[؀-ۿ][^"]*)"/g;
const CONSOLE_OR_COMMENT_LINE = /^\s*(\/\/|\/\*|\*|console\.)/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      yield p;
    }
  }
}

const warnings = [];
let scannedFiles = 0;

for (const file of walk(clientSrc)) {
  if (EXCLUDE_FILES.has(file)) continue;
  scannedFiles++;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!ARABIC.test(line)) continue;
    if (CONSOLE_OR_COMMENT_LINE.test(line)) continue;
    let m;
    JSX_TEXT.lastIndex = 0;
    while ((m = JSX_TEXT.exec(line)) !== null) {
      warnings.push({ file, line: i + 1, kind: "jsx-text", snippet: m[1].trim() });
    }
    STRING_PROP.lastIndex = 0;
    while ((m = STRING_PROP.exec(line)) !== null) {
      warnings.push({ file, line: i + 1, kind: `prop:${m[1]}`, snippet: m[2].trim() });
    }
  }
}

const byFile = new Map();
for (const w of warnings) {
  const arr = byFile.get(w.file) ?? [];
  arr.push(w);
  byFile.set(w.file, arr);
}

const sorted = [...byFile.entries()].sort(([, a], [, b]) => b.length - a.length);
console.log(`Scanned: ${scannedFiles} JSX files (excluded ${EXCLUDE_FILES.size})`);
console.log(`Files with Arabic in JSX: ${sorted.length}`);
console.log(`Total warnings: ${warnings.length}`);
console.log("");
const limitPerFile = 5;
for (const [file, ws] of sorted.slice(0, 30)) {
  console.log(`${path.relative(root, file)}  (${ws.length})`);
  for (const w of ws.slice(0, limitPerFile)) {
    const snippet = w.snippet.length > 60 ? w.snippet.slice(0, 60) + "…" : w.snippet;
    console.log(`  L${String(w.line).padStart(4)}  [${w.kind}]  ${snippet}`);
  }
  if (ws.length > limitPerFile) console.log(`  ... and ${ws.length - limitPerFile} more`);
}
if (sorted.length > 30) console.log(`\n... and ${sorted.length - 30} more files`);

const strict = process.argv.includes("--strict");
if (strict && warnings.length > 0) {
  console.error(`\nFAIL: ${warnings.length} Arabic-in-JSX warnings (strict mode)`);
  process.exit(1);
}
