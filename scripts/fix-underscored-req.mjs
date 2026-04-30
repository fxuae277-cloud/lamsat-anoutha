/**
 * Fix getLang(req) calls inside route handlers that use _req as the parameter name.
 * Strategy: track route handler boundaries, detect _req handlers, patch getLang(req)→getLang(_req).
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "server", "routes.ts");
const lines = readFileSync(filePath, "utf-8").split("\n");

// State machine: track if current handler uses _req
let inUnderscoreHandler = false;
let braceDepth = 0;
let handlerStartDepth = -1;

const HANDLER_RE = /async\s*\(\s*(_req)\s*,\s*res\s*\)/;
const HANDLER_OPEN_RE = /async\s*\(\s*(?:_req|req)\s*,\s*res\s*\)/;

// Simple approach: scan for handler boundaries using brace counting
// Mark regions that belong to _req handlers

let fixed = 0;
const result = [];

// We'll use a simpler line-based approach:
// Find "async (_req, res)" lines, then for every "getLang(req)" in the
// corresponding handler body, replace with "getLang(_req)"

// Build a list of line ranges that are inside _req handlers
const underscoreRanges = [];
let depth = 0;
let inHandler = false;
let handlerIsUnderscore = false;
let handlerDepthStart = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Count brace changes on this line (simplified)
  for (const ch of line) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }

  if (!inHandler) {
    // Look for handler signatures
    if (HANDLER_OPEN_RE.test(line)) {
      inHandler = true;
      handlerIsUnderscore = HANDLER_RE.test(line);
      // Handler body starts at the next { after this point
      // depth already includes any { on this line
      handlerDepthStart = depth; // depth after processing this line
    }
  } else {
    // We're inside a handler - it ends when depth returns to handlerDepthStart - 1
    if (depth < handlerDepthStart) {
      if (handlerIsUnderscore) {
        underscoreRanges.push({ start: /* approximate */ 0, end: i });
      }
      inHandler = false;
      handlerIsUnderscore = false;
      handlerDepthStart = -1;
    }
  }
}

// Simpler, more reliable approach: just fix all specific known-bad lines
// The TypeScript compiler told us exactly which lines have the problem.
// Any line that has getLang(req) and where "req" is not defined in scope
// (i.e., inside a _req handler) needs to be fixed.

// Read fresh
const src = readFileSync(filePath, "utf-8");
const srcLines = src.split("\n");

// Re-scan with better logic: track current handler's req param name
let currentReqName = "req";
const fixedLines = [];
let handlerBraceLevel = -1;
let currentBraceLevel = 0;

for (let i = 0; i < srcLines.length; i++) {
  let line = srcLines[i];

  // Count braces
  let lineBraces = 0;
  for (const ch of line) {
    if (ch === "{") lineBraces++;
    else if (ch === "}") lineBraces--;
  }

  // Detect new handler opening
  const handlerMatch = line.match(/async\s*\((_req|req)\s*,\s*res\s*[,)]/);
  if (handlerMatch) {
    currentReqName = handlerMatch[1]; // "req" or "_req"
    handlerBraceLevel = currentBraceLevel + lineBraces;
  }

  currentBraceLevel += lineBraces;

  // If we've exited the handler, reset
  if (handlerBraceLevel !== -1 && currentBraceLevel < handlerBraceLevel) {
    currentReqName = "req";
    handlerBraceLevel = -1;
  }

  // Fix the line if currentReqName is _req and line uses getLang(req)
  if (currentReqName === "_req" && line.includes("getLang(req)")) {
    const fixed_line = line.replace(/getLang\(req\)/g, "getLang(_req)");
    fixedLines.push(fixed_line);
    fixed++;
    console.log(`Line ${i + 1}: ${line.trim()} → fixed`);
  } else {
    fixedLines.push(line);
  }
}

writeFileSync(filePath, fixedLines.join("\n"), "utf-8");
console.log(`\nFixed ${fixed} getLang(req) → getLang(_req) replacements`);
