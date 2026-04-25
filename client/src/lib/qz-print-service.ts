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
 *   - Public certificate is fetched from /api/printing/qz/certificate.
 *   - Private key NEVER ships to the browser. The signing step calls
 *     POST /api/printing/qz/sign on the backend, which holds QZ_PRIVATE_KEY
 *     in process.env and signs the request server-side.
 */

declare const qz: any;
declare const window: any;

const DEFAULT_RECEIPT_PRINTER = 'EPSON TM-T100 Receipt';
const DEFAULT_LABEL_PRINTER = 'TSC TTP-244M Pro';

const LOG = '[QZ-Sign]';

let securityConfigured = false;
let connectPromise: Promise<void> | null = null;
let cachedCertificate: string | null = null;

// ─── Certificate loader ───────────────────────────────────────────────────────

async function loadCertificate(): Promise<string> {
  if (cachedCertificate) return cachedCertificate;
  const res = await fetch('/api/printing/qz/certificate', {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(
      `failed to fetch QZ certificate (${res.status}): ${await res.text().catch(() => '')}`
    );
  }
  const cert = (await res.text()).trim();
  if (!cert.includes('BEGIN CERTIFICATE')) {
    throw new Error('certificate endpoint returned an invalid PEM');
  }
  cachedCertificate = cert;
  console.log(`${LOG} QZ certificate loaded (length=${cert.length})`);
  return cert;
}

// ─── Security setup (runs once) ───────────────────────────────────────────────

async function configureSecurity(): Promise<void> {
  if (securityConfigured) return;
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  const cert = await loadCertificate();

  qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
    resolve(cert);
  });

  qz.security.setSignatureAlgorithm('SHA512');

  qz.security.setSignaturePromise((toSign: string) => {
    return (resolve: (sig: string) => void, reject: (err: any) => void) => {
      fetch('/api/printing/qz/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ request: toSign }),
      })
        .then(async res => {
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(
              `signing endpoint returned ${res.status}: ${body || '(no body)'}`
            );
          }
          return res.json();
        })
        .then(data => {
          if (!data?.signature) {
            throw new Error('signing endpoint returned no signature');
          }
          console.log(`${LOG} QZ signature completed`);
          resolve(data.signature);
        })
        .catch(err => {
          console.error(`${LOG} sign request failed:`, err);
          reject(err);
        });
    };
  });

  securityConfigured = true;
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Ensures QZ Tray is loaded, security is wired, and the websocket is open.
 *
 * Order is critical:
 *   1) qz must exist on window
 *   2) certificate + signature promises configured
 *   3) websocket.connect() — only after the promises are wired so QZ Tray
 *      reads them during the handshake
 *
 * Connection attempts are de-duplicated: parallel callers share one promise,
 * and once connected this becomes a cheap isActive() check.
 */
export async function ensureQzReady(): Promise<void> {
  if (typeof qz === 'undefined' || !(window as any).qz) {
    console.error(`${LOG} qz library is not loaded on window`);
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  await configureSecurity();

  if (qz.websocket.isActive()) return;

  if (!connectPromise) {
    connectPromise = qz.websocket
      .connect()
      .then(() => {
        console.log(`${LOG} QZ websocket connected`);
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
 * Send a signed print job. Guarantees the websocket is active before
 * dispatching to qz.print() — this is what prevents the
 * "Cannot read properties of null (reading 'sendData')" error that fires
 * when qz.print is called before the transport is ready.
 */
export async function signedPrint(config: any, data: any[]): Promise<void> {
  await ensureQzReady();
  if (!qz.websocket.isActive()) {
    throw new Error('QZ Tray websocket is not active — print aborted');
  }
  await qz.print(config, data);
  console.log(`${LOG} QZ print completed`);
}

/** Send raw ESC/POS bytes (cut, drawer pulse, …) to a named printer. */
export async function signedRaw(printer: string, raw: string): Promise<void> {
  await ensureQzReady();
  if (!qz.websocket.isActive()) {
    throw new Error('QZ Tray websocket is not active — print aborted');
  }
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: raw }]
  );
  console.log(`${LOG} QZ print completed`);
}

/** Build a printer config (units, density, margins, …) — re-export for callers. */
export function createConfig(printer: string, opts: Record<string, any> = {}): any {
  return qz.configs.create(printer, opts);
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function isCertificateConfigured(): boolean {
  return cachedCertificate !== null;
}
