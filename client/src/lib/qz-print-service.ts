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

/**
 * Wires the certificate + signing callbacks into qz.security.
 *
 * Idempotent — calling more than once is a no-op. Must be called BEFORE the
 * first qz.websocket.connect(); QZ Tray reads the callbacks during the
 * handshake.
 */
function configureSecurity(): void {
  if (securityConfigured) return;
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  // If the cert/key pair has not been generated yet, leave QZ in its default
  // anonymous mode. The user will see the trust prompt once per session, but
  // printing keeps working — far better than failing every print with a bad
  // signature handshake.
  if (!QZ_CERTIFICATE_CONFIGURED) {
    securityConfigured = true;
    return;
  }

  // Public certificate — shipped with the frontend bundle.
  qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
    resolve(QZ_CERTIFICATE);
  });

  // SHA-512 matches the server-side signer (createSign('SHA512')).
  qz.security.setSignatureAlgorithm('SHA512');

  // Each request is signed by the backend; the private key never reaches the
  // browser. `toSign` is the exact string QZ Tray asks us to sign.
  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve: (sig: string) => void, reject: (err: any) => void) => {
      fetch('/api/printing/qz/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request: toSign }),
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`signing endpoint returned ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (!data?.signature) {
            throw new Error('signing endpoint returned no signature');
          }
          resolve(data.signature);
        })
        .catch(reject);
    };
  });

  securityConfigured = true;
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
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  configureSecurity();

  if (qz.websocket.isActive()) return;

  if (!connectPromise) {
    connectPromise = qz.websocket
      .connect()
      .catch((e: any) => {
        connectPromise = null;
        const detail = e?.message ?? String(e);
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
