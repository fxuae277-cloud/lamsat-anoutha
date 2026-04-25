/**
 * qz-print-service.ts — central signed QZ Tray service | لمسة أنوثة POS
 *
 * Why this file exists:
 *   QZ Tray treats every connection as untrusted unless the website provides
 *   a digital certificate AND signs each request with the matching private
 *   key. Without the signing handshake, QZ Tray prompts the user with
 *   "anonymous request / Untrusted website" for every print.
 *
 *   This service installs the certificate + signing handshake exactly once
 *   per page load, then exposes the high-level helpers (connect / print /
 *   raw / find printer). All printing in the app MUST go through here —
 *   calling qz.print(...) directly from a component would re-introduce the
 *   anonymous prompt for that call.
 *
 * Security boundary:
 *   - Public certificate is imported from ./qz-certificate (safe in browser).
 *   - Private key NEVER ships to the browser. The signing step calls
 *     POST /api/printing/qz/sign on the backend, which holds QZ_PRIVATE_KEY
 *     in process.env and signs the request server-side.
 */

import { QZ_CERTIFICATE, QZ_CERTIFICATE_CONFIGURED } from './qz-certificate';

declare const qz: any;

const DEFAULT_RECEIPT_PRINTER = 'EPSON TM-T100 Receipt';
const DEFAULT_LABEL_PRINTER = 'TSC TTP-244M Pro';

let securityConfigured = false;
let connectPromise: Promise<void> | null = null;

// ─── Security setup (runs once) ───────────────────────────────────────────────

const LOG = '[QZ-Sign]';

/**
 * Wires the certificate + signing callbacks into qz.security.
 *
 * Idempotent — calling more than once is a no-op. Must be called BEFORE the
 * first qz.websocket.connect(); QZ Tray reads the callbacks during the
 * handshake.
 *
 * The promises are ALWAYS installed (even when the cert is still the
 * placeholder) — that way every sign attempt is visible in the console for
 * verification. If the placeholder cert/key pair is in use, QZ Tray will
 * reject the signature and fall back to its untrusted prompt, but the logs
 * will tell you exactly what happened.
 */
function configureSecurity(): void {
  if (securityConfigured) return;
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  if (!QZ_CERTIFICATE_CONFIGURED) {
    console.error(
      `${LOG} QZ_CERTIFICATE is still the placeholder. Paste the real ` +
      `digital-certificate.txt into client/src/lib/qz-certificate.ts. ` +
      `Until you do, QZ Tray will reject the signature and keep showing ` +
      `the "anonymous request / Untrusted website" prompt.`
    );
  }

  // Public certificate — shipped with the frontend bundle.
  console.log(
    `${LOG} setCertificatePromise — cert length=${QZ_CERTIFICATE.length}, ` +
    `configured=${QZ_CERTIFICATE_CONFIGURED}`
  );
  console.log(`${LOG} certificate (first 80 chars):`, QZ_CERTIFICATE.slice(0, 80));
  qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
    console.log(`${LOG} QZ Tray asked for certificate — delivering`);
    resolve(QZ_CERTIFICATE);
  });

  // SHA-512 matches the server-side signer (createSign('RSA-SHA512')).
  console.log(`${LOG} setSignatureAlgorithm("SHA512")`);
  qz.security.setSignatureAlgorithm('SHA512');

  // Each request is signed by the backend; the private key never reaches the
  // browser. `toSign` is the exact string QZ Tray asks us to sign.
  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve: (sig: string) => void, reject: (err: any) => void) => {
      console.log(
        `${LOG} sign requested — toSign length=${toSign?.length ?? 0}`
      );
      fetch('/api/printing/qz/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request: toSign }),
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(
              `${LOG} signing endpoint returned ${res.status}:`,
              body
            );
            throw new Error(
              `signing endpoint returned ${res.status}: ${body || '(no body)'}`
            );
          }
          return res.json();
        })
        .then(data => {
          if (!data?.signature) {
            console.error(
              `${LOG} signing endpoint returned no signature, body=`,
              data
            );
            throw new Error('signing endpoint returned no signature');
          }
          console.log(
            `${LOG} signature received — length=${data.signature.length}, ` +
            `preview=${String(data.signature).slice(0, 40)}…`
          );
          resolve(data.signature);
        })
        .catch(err => {
          console.error(`${LOG} sign request failed:`, err);
          reject(err);
        });
    };
  });

  securityConfigured = true;
  console.log(`${LOG} security configured ✓`);
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Ensures QZ Tray is loaded, security is wired, and the websocket is open.
 *
 * Connection attempts are de-duplicated: parallel callers share one promise,
 * and once connected this becomes a cheap isActive() check. We never reconnect
 * on top of an active connection.
 */
export async function ensureQzReady(): Promise<void> {
  if (typeof qz === 'undefined') {
    console.error(`${LOG} qz library is not loaded on window`);
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  // Security MUST be configured before connect() — QZ Tray reads the cert
  // during the handshake.
  configureSecurity();

  if (qz.websocket.isActive()) return;

  if (!connectPromise) {
    console.log(`${LOG} qz.websocket.connect() — starting handshake`);
    connectPromise = qz.websocket
      .connect()
      .then(() => {
        console.log(`${LOG} qz.websocket.connect() — connected ✓`);
      })
      .catch((e: any) => {
        connectPromise = null;
        const detail = e?.message ?? String(e);
        console.error(`${LOG} qz.websocket.connect() failed:`, e);
        throw new Error(
          `تعذّر الاتصال بـ QZ Tray — تأكد من تشغيل البرنامج (${detail})`
        );
      });
  }

  await connectPromise;
}

// ─── Printer resolution ───────────────────────────────────────────────────────

/**
 * Finds a printer by name (the Windows queue name). Throws an Arabic error
 * message ready to display in a toast if the printer is missing.
 */
export async function findPrinter(printerName: string): Promise<string> {
  await ensureQzReady();
  const found: string[] = await qz.printers.find(printerName);
  if (!found?.length) {
    throw new Error(
      `الطابعة "${printerName}" غير موجودة — تحقق من اسم الطابعة في الإعدادات`
    );
  }
  return found[0];
}

export async function findReceiptPrinter(printerName?: string): Promise<string> {
  return findPrinter(printerName || DEFAULT_RECEIPT_PRINTER);
}

export async function findLabelPrinter(printerName?: string): Promise<string> {
  return findPrinter(printerName || DEFAULT_LABEL_PRINTER);
}

// ─── Signed print helpers ─────────────────────────────────────────────────────

/**
 * Send a signed print job. `config` and `data` are passed through to
 * qz.print() unchanged — this wrapper exists only to guarantee security
 * setup + connection happen first.
 */
export async function signedPrint(config: any, data: any[]): Promise<void> {
  await ensureQzReady();
  await qz.print(config, data);
}

/** Send raw ESC/POS bytes (cut, drawer pulse, …) to a named printer. */
export async function signedRaw(printer: string, raw: string): Promise<void> {
  await ensureQzReady();
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: raw }]
  );
}

/** Build a printer config (units, density, margins, …) — re-export for callers. */
export function createConfig(printer: string, opts: Record<string, any> = {}): any {
  return qz.configs.create(printer, opts);
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function isCertificateConfigured(): boolean {
  return QZ_CERTIFICATE_CONFIGURED;
}
