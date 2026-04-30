/**
 * qzPrinter.ts — robust QZ Tray client for Lamsat Anotha POS
 *
 * Why this file exists (vs. the older qz-print-service.ts):
 *
 *   QZ Tray's web client has a known failure mode where, after a print job
 *   fails on the OS side (e.g. "Printer is not accepting job"), the WebSocket
 *   is left half-dead: `qz.websocket.isActive()` still returns true but the
 *   underlying transport socket is null. The next `qz.print()` call then
 *   tries to call `socket.sendData(...)` and crashes with:
 *
 *     "Cannot read properties of null (reading 'sendData')"
 *
 *   This module wraps every print call with a stale-socket detector. On that
 *   specific error pattern it forces a clean disconnect + reconnect, then
 *   retries the print exactly once. All other errors propagate unchanged.
 *
 * Security boundary (unchanged from the previous module):
 *   - Public certificate fetched from /api/printing/qz/certificate.
 *   - Private key NEVER ships to the browser. Signing is done server-side
 *     via POST /api/printing/qz/sign.
 */

declare const qz: any;
declare const window: any;

const LOG = '[qzPrinter]';
const KEEP_ALIVE_SECONDS = 60;
const isDev = import.meta.env.DEV;

const DEFAULT_RECEIPT_PRINTER = 'EPSON TM-T100 Receipt';
const DEFAULT_LABEL_PRINTER = 'TSC TTP-244M Pro';

let securityConfigured = false;
let connectPromise: Promise<void> | null = null;
let cachedCertificate: string | null = null;

function debug(...args: any[]) {
  if (isDev) console.log(LOG, ...args);
}

// ─── Certificate loader ───────────────────────────────────────────────────────

async function loadCertificate(): Promise<string> {
  if (cachedCertificate) return cachedCertificate;
  const res = await fetch('/api/printing/qz/certificate', { credentials: 'include' });
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
  debug(`certificate loaded length=${cert.length}`);
  return cert;
}

// ─── Security setup (runs once per page load) ─────────────────────────────────

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
          debug('signature completed');
          resolve(data.signature);
        })
        .catch(err => {
          if (isDev) console.error(LOG, 'sign request failed:', err);
          reject(err);
        });
    };
  });

  // Reset cached promise on disconnect so the next ensureQzConnected() call
  // triggers a fresh connect instead of awaiting a stale resolved promise.
  qz.websocket.setClosedCallbacks(() => {
    debug('websocket closed — clearing connection state');
    connectPromise = null;
  });

  // Surface QZ-side errors in dev only — these are usually transport hiccups
  // that the next ensureQzConnected() call will recover from.
  if (typeof qz.websocket.setErrorCallbacks === 'function') {
    qz.websocket.setErrorCallbacks((err: any) => {
      if (isDev) console.warn(LOG, 'websocket error:', err);
    });
  }

  securityConfigured = true;
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Ensures QZ Tray is loaded, security is wired, and the websocket is open.
 *
 * Defensive against stale state: if the WS is not active but a previous
 * connectPromise resolved long ago, we drop it before reconnecting so we
 * don't await a no-op promise on a dead socket.
 */
export async function ensureQzConnected(): Promise<void> {
  if (typeof qz === 'undefined' || !(window as any).qz) {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  await configureSecurity();

  if (qz.websocket.isActive()) return;

  // Defensive: drop any stale resolved promise so we actually reconnect.
  if (connectPromise) connectPromise = null;

  connectPromise = qz.websocket
    .connect({ keepAlive: KEEP_ALIVE_SECONDS })
    .then(() => {
      debug('websocket connected');
    })
    .catch((e: any) => {
      connectPromise = null;
      const detail = e?.message ?? String(e);
      if (isDev) console.error(LOG, 'connect() failed:', e);
      throw new Error(
        `تعذّر الاتصال بـ QZ Tray — تأكد من تشغيل البرنامج (${detail})`
      );
    });

  await connectPromise;
}

/** Backwards-compatible alias used by older callers. */
export const ensureQzReady = ensureQzConnected;

/**
 * Cleanly disconnect and clear all cached state.
 * Useful for "reset and try again" UI affordances.
 */
export async function disconnectQz(): Promise<void> {
  try {
    if (typeof qz !== 'undefined' && qz?.websocket?.isActive?.()) {
      await qz.websocket.disconnect();
    }
  } catch (e) {
    if (isDev) console.warn(LOG, 'disconnect() ignored error:', e);
  } finally {
    connectPromise = null;
  }
}

// ─── Printer resolution ───────────────────────────────────────────────────────

export async function findPrinter(printerName: string): Promise<string> {
  await ensureQzConnected();
  const found: string[] = await qz.printers.find(printerName);
  if (!found?.length) {
    throw new Error(
      `الطابعة "${printerName}" غير موجودة — تحقق من اسم الطابعة في الإعدادات`
    );
  }
  debug(`selected printer: ${found[0]}`);
  return found[0];
}

export async function findReceiptPrinter(printerName?: string): Promise<string> {
  return findPrinter(printerName || DEFAULT_RECEIPT_PRINTER);
}

export async function findLabelPrinter(printerName?: string): Promise<string> {
  return findPrinter(printerName || DEFAULT_LABEL_PRINTER);
}

// ─── Stale-socket recovery ────────────────────────────────────────────────────

/**
 * Detect the specific QZ Tray failure where _socket is null but isActive()
 * returned true. Two known surface forms across QZ versions:
 *   - "Cannot read properties of null (reading 'sendData')"
 *   - "null is not an object (evaluating '... .sendData')"
 */
function isStaleSocketError(e: any): boolean {
  const msg = String(e?.message || e || '');
  return /sendData/i.test(msg) && /(null|undefined)/i.test(msg);
}

async function forceReconnect(): Promise<void> {
  try {
    if (qz?.websocket?.isActive?.()) {
      await qz.websocket.disconnect();
    }
  } catch (_) {
    // intentional: we don't care if disconnect of an already-broken socket fails
  }
  connectPromise = null;
  await ensureQzConnected();
}

// ─── Signed print helpers ─────────────────────────────────────────────────────

/**
 * Send a signed print job. If the underlying socket is in the half-dead state
 * (sendData on null), force a reconnect and retry exactly once. Any other
 * error propagates unchanged so callers (and the toast layer) can decide.
 */
export async function signedPrint(config: any, data: any[]): Promise<void> {
  await ensureQzConnected();
  try {
    debug('print payload sent');
    await qz.print(config, data);
    debug('print completed');
  } catch (e: any) {
    if (isStaleSocketError(e)) {
      debug('stale socket detected — reconnecting and retrying once');
      await forceReconnect();
      await qz.print(config, data);
      debug('print completed after retry');
      return;
    }
    if (isDev) console.error(LOG, 'print failed:', e);
    throw e;
  }
}

/** Send raw ESC/POS bytes (cut, drawer pulse, …) to a named printer. */
export async function signedRaw(printer: string, raw: string): Promise<void> {
  const config = qz.configs.create(printer);
  await signedPrint(config, [{ type: 'raw', format: 'plain', data: raw }]);
}

/** Alias matching the project prompt's vocabulary (printRawEscPos). */
export const printRawEscPos = signedRaw;

/** Build a printer config (units, density, margins, …) — re-export for callers. */
export function createConfig(printer: string, opts: Record<string, any> = {}): any {
  return qz.configs.create(printer, opts);
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function isCertificateConfigured(): boolean {
  return cachedCertificate !== null;
}

/**
 * Translate any QZ-related error into a user-friendly Arabic message that's
 * safe to drop into a toast. Falls back to the original message if no pattern
 * matches.
 */
export function toArabicError(e: any): string {
  const msg = String(e?.message || e || '');

  if (/QZ Tray غير محمّل|qz.*not (loaded|defined)|qz is not defined/i.test(msg)) {
    return 'برنامج الطباعة QZ Tray غير متصل. تأكد من تشغيله ثم حاول مرة أخرى.';
  }
  if (/تعذّر الاتصال|websocket.*(closed|error)|connection.*(refused|failed)/i.test(msg)) {
    return 'تعذّر الاتصال ببرنامج QZ Tray. تأكد من تشغيله ثم أعد المحاولة.';
  }
  if (/blocked|denied|rejected by user/i.test(msg)) {
    return 'تم رفض صلاحية الطباعة. افتح QZ Tray واضغط Allow مع Remember this decision.';
  }
  if (/غير موجودة|not found|no printer/i.test(msg)) {
    return 'لم يتم العثور على الطابعة. تأكد من توصيلها وضبط اسمها في الإعدادات.';
  }
  if (/not accepting|printer.*(error|offline|paused)/i.test(msg)) {
    return 'الطابعة لا تقبل أوامر الطباعة. تحقق من حالتها (Online، الورق، طابور غير معلّق).';
  }
  if (/sendData/i.test(msg)) {
    // Should be invisible to the user thanks to the retry, but keep a
    // friendly fallback in case retry also failed.
    return 'انقطع الاتصال ببرنامج الطباعة. أعد المحاولة بعد لحظات.';
  }
  return msg || 'خطأ غير معروف في الطباعة';
}
