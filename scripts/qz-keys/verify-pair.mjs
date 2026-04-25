// End-to-end test: sign with .env QZ_PRIVATE_KEY,
// verify with the cert literal in client/src/lib/qz-certificate.ts.
// If this passes, QZ Tray will accept the signature.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const envText = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const re = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(?:"((?:\\.|[^"\\])*)"|'([^']*)'|([^\r\n#]*))/gm;
const env = {};
let m;
while ((m = re.exec(envText)) !== null) {
  let v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] ?? "").trim();
  if (m[2] !== undefined) v = v.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  env[m[1]] = v;
}

const certFileText = readFileSync(
  resolve(process.cwd(), "client/src/lib/qz-certificate.ts"),
  "utf8"
);
const certMatch = certFileText.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
if (!certMatch) {
  console.error("could not extract certificate from qz-certificate.ts");
  process.exit(1);
}
const cert = certMatch[0];

const payload = "qz-tray-roundtrip-" + Date.now();
const signer = crypto.createSign("RSA-SHA512");
signer.update(payload);
signer.end();
const signature = signer.sign(env.QZ_PRIVATE_KEY, "base64");

const verifier = crypto.createVerify("RSA-SHA512");
verifier.update(payload);
verifier.end();
const ok = verifier.verify(cert, signature, "base64");

console.log("payload:", payload);
console.log("signature length:", signature.length);
console.log("verify with cert:", ok ? "PASS ✓" : "FAIL ✗");
process.exit(ok ? 0 : 2);
