// Smoke test: instantiate i18next with all 11 namespaces, verify lookup +
// language switch + key parity. Run with: node scripts/smoke-i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import i18next from "i18next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const localesDir = path.join(root, "client", "src", "locales");

const NAMESPACES = [
  "common", "nav", "auth", "pos", "inventory", "purchases",
  "finance", "payroll", "reports", "settings", "customers",
];

function loadNs(lang, ns) {
  return JSON.parse(fs.readFileSync(path.join(localesDir, lang, `${ns}.json`), "utf8"));
}

function buildResources(lang) {
  return Object.fromEntries(NAMESPACES.map((ns) => [ns, loadNs(lang, ns)]));
}

function countLeafKeys(obj, prefix = "") {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") keys.push(...countLeafKeys(v, p));
    else keys.push(p);
  }
  return keys;
}

const ar = buildResources("ar");
const en = buildResources("en");

await i18next.init({
  lng: "ar",
  fallbackLng: "ar",
  ns: NAMESPACES,
  defaultNS: "common",
  fallbackNS: NAMESPACES,
  resources: { ar, en },
  interpolation: { escapeValue: false },
});

let pass = 0;
let fail = 0;
function assert(label, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓  ${label}`);
  } else {
    fail++;
    console.log(`  ✗  ${label} — got: ${JSON.stringify(got)}`);
  }
}

console.log("Test 1: lookup with namespace prefix");
assert("ar pos:pos.title resolves", typeof i18next.t("pos:pos.title") === "string", i18next.t("pos:pos.title"));
assert("ar nav:nav.dashboard resolves", typeof i18next.t("nav:nav.dashboard") === "string", i18next.t("nav:nav.dashboard"));

console.log("\nTest 2: lookup without namespace (fallbackNS)");
assert("ar nav.dashboard via fallbackNS resolves", typeof i18next.t("nav.dashboard") === "string" && i18next.t("nav.dashboard") !== "nav.dashboard", i18next.t("nav.dashboard"));
assert("ar app.loading resolves", typeof i18next.t("app.loading") === "string" && i18next.t("app.loading") !== "app.loading", i18next.t("app.loading"));

console.log("\nTest 3: language switch ar → en");
const arDashboard = i18next.t("nav.dashboard");
await i18next.changeLanguage("en");
const enDashboard = i18next.t("nav.dashboard");
assert("language is now en", i18next.language === "en", i18next.language);
assert("dashboard label changed", arDashboard !== enDashboard, { ar: arDashboard, en: enDashboard });
assert("ar value not empty", arDashboard.length > 0, arDashboard);
assert("en value not empty", enDashboard.length > 0, enDashboard);

console.log("\nTest 4: per-namespace key parity");
for (const ns of NAMESPACES) {
  const arKeys = new Set(countLeafKeys(ar[ns]));
  const enKeys = new Set(countLeafKeys(en[ns]));
  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));
  const ok = missingInEn.length === 0 && missingInAr.length === 0;
  assert(`${ns}: ${arKeys.size} keys (ar=en)`, ok, { missingInEn, missingInAr });
}

console.log("\nTest 5: switching back to ar");
await i18next.changeLanguage("ar");
assert("language is ar again", i18next.language === "ar", i18next.language);
assert("dashboard returns ar value", i18next.t("nav.dashboard") === arDashboard, i18next.t("nav.dashboard"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
