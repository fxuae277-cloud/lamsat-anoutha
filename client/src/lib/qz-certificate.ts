/**
 * qz-certificate.ts — QZ Tray public certificate
 *
 * The PUBLIC certificate (digital-certificate.txt) is safe to ship in the
 * frontend bundle. It identifies the website to QZ Tray. Without it QZ Tray
 * shows the "anonymous request / Untrusted website" prompt for every print.
 *
 * The matching PRIVATE key (private-key.pem) MUST stay on the server only,
 * loaded from the QZ_PRIVATE_KEY environment variable. It is used to sign
 * each print request via POST /api/printing/qz/sign — never exposed here.
 *
 * Generation (one-time, on a developer machine):
 *   1. Follow https://qz.io/wiki/2.0-signing-messages
 *      or run the helper at https://qz.io/wiki/2.1-signing-messages
 *   2. Replace the placeholder below with the contents of digital-certificate.txt
 *   3. Put the contents of private-key.pem into the backend .env as QZ_PRIVATE_KEY
 *   4. After deploying, the QZ Tray prompt asks once to trust the certificate;
 *      tick "Remember this decision" and the trusted state persists.
 *
 * Until the real certificate is pasted in, QZ Tray will keep showing the
 * anonymous prompt — that is expected.
 */

export const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
PASTE_DIGITAL_CERTIFICATE_HERE
-----END CERTIFICATE-----`;

/** True once a real certificate has been pasted in (placeholder check). */
export const QZ_CERTIFICATE_CONFIGURED =
  !QZ_CERTIFICATE.includes('PASTE_DIGITAL_CERTIFICATE_HERE');
