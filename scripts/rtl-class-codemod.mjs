// One-shot codemod: rewrite directional Tailwind classes to logical equivalents
// (ml-* → ms-*, mr-* → me-*, pl-* → ps-*, pr-* → pe-*,
//  text-right → text-start, text-left → text-end).
//
// Excludes files that are out of scope for Phase 2 of the i18n migration:
//   - client/src/pages/POS.tsx, MobilePOS.tsx (Phase 3)
//   - client/src/components/Invoice58.tsx, Invoice80.tsx (print templates)
//   - client/src/lib/printer.ts (print service)
//   - anything under node_modules / dist / scripts / local-print-service
//
// Usage:  node scripts/rtl-class-codemod.mjs           (dry-run, prints diff stats)
//         node scripts/rtl-class-codemod.mjs --write   (apply changes)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const clientSrc = path.join(root, "client", "src");

const EXCLUDE_FILES = new Set([
  path.join(clientSrc, "pages", "POS.tsx"),
  path.join(clientSrc, "pages", "mobile", "MobilePOS.tsx"),
  path.join(clientSrc, "components", "Invoice58.tsx"),
  path.join(clientSrc, "components", "Invoice80.tsx"),
  path.join(clientSrc, "lib", "printer.ts"),
]);

const SUFFIX_RE = /(?:\d+(?:\.\d+)?|\[[^\]]+\]|auto|px)/.source;
const REPLACEMENTS = [
  [new RegExp(`\\bml-(${SUFFIX_RE})\\b`, "g"), "ms-$1"],
  [new RegExp(`\\bmr-(${SUFFIX_RE})\\b`, "g"), "me-$1"],
  [new RegExp(`\\bpl-(${SUFFIX_RE})\\b`, "g"), "ps-$1"],
  [new RegExp(`\\bpr-(${SUFFIX_RE})\\b`, "g"), "pe-$1"],
  [/\btext-right\b/g, "text-start"],
  [/\btext-left\b/g, "text-end"],
  [new RegExp(`\\b(?:sm|md|lg|xl|2xl|hover|focus|group-hover|first|last|rtl|ltr):ml-(${SUFFIX_RE})\\b`, "g"), (m) => m.replace("ml-", "ms-")],
  [new RegExp(`\\b(?:sm|md|lg|xl|2xl|hover|focus|group-hover|first|last|rtl|ltr):mr-(${SUFFIX_RE})\\b`, "g"), (m) => m.replace("mr-", "me-")],
  [new RegExp(`\\b(?:sm|md|lg|xl|2xl|hover|focus|group-hover|first|last|rtl|ltr):pl-(${SUFFIX_RE})\\b`, "g"), (m) => m.replace("pl-", "ps-")],
  [new RegExp(`\\b(?:sm|md|lg|xl|2xl|hover|focus|group-hover|first|last|rtl|ltr):pr-(${SUFFIX_RE})\\b`, "g"), (m) => m.replace("pr-", "pe-")],
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(p);
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      yield p;
    }
  }
}

const write = process.argv.includes("--write");
let totalFiles = 0;
let totalChanged = 0;
let totalReplacements = 0;
const perFile = [];

for (const file of walk(clientSrc)) {
  if (EXCLUDE_FILES.has(file)) continue;
  totalFiles++;
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  let count = 0;
  for (const [re, repl] of REPLACEMENTS) {
    next = next.replace(re, (...args) => {
      count++;
      return typeof repl === "function" ? repl(args[0]) : args[0].replace(re.source.match(/[\w-]+/)[0], repl.split("$1")[0]);
    });
  }
  // Re-do replacements with simple string-result form (the previous block over-engineered the replacer for the prefixed variants).
  next = original;
  count = 0;
  for (const [re, repl] of REPLACEMENTS) {
    next = next.replace(re, (match, ...rest) => {
      count++;
      if (typeof repl === "function") return repl(match);
      // Simple back-reference replacement
      const groups = rest.slice(0, -2);
      return repl.replace(/\$(\d+)/g, (_, n) => groups[Number(n) - 1] ?? "");
    });
  }
  if (next !== original) {
    totalChanged++;
    totalReplacements += count;
    perFile.push({ file: path.relative(root, file), count });
    if (write) fs.writeFileSync(file, next, "utf8");
  }
}

perFile.sort((a, b) => b.count - a.count);
console.log(`Scanned: ${totalFiles} files`);
console.log(`Files with changes: ${totalChanged}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`Mode: ${write ? "WRITE" : "DRY-RUN (no files modified — pass --write to apply)"}`);
console.log("");
console.log("Top files:");
for (const e of perFile.slice(0, 25)) {
  console.log(`  ${e.count.toString().padStart(4)}  ${e.file}`);
}
if (perFile.length > 25) console.log(`  ... and ${perFile.length - 25} more`);
