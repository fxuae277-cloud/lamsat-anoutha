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
 * Regeneration: see scripts/qz-keys/README.md for the openssl one-liner
 * that regenerates this file and the matching private key.
 *
 * IMPORTANT: this certificate is paired with QZ_PRIVATE_KEY on the server.
 * If you replace one, you MUST replace the other in the same commit, or
 * QZ Tray will reject every signature and revert to the anonymous prompt.
 */

export const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDkTCCAnmgAwIBAgIUZFdLLhurQWHsHQW2pn2azMQyJ9MwDQYJKoZIhvcNAQEL
BQAwWDEaMBgGA1UEAwwRTGFtc2F0IEFub3RoYSBQT1MxFTATBgNVBAsMDFBPUyBQ
cmludGluZzEWMBQGA1UECgwNTGFtc2F0IEFub3RoYTELMAkGA1UEBhMCT00wHhcN
MjYwNDI1MTIzMDU0WhcNMzYwNDIyMTIzMDU0WjBYMRowGAYDVQQDDBFMYW1zYXQg
QW5vdGhhIFBPUzEVMBMGA1UECwwMUE9TIFByaW50aW5nMRYwFAYDVQQKDA1MYW1z
YXQgQW5vdGhhMQswCQYDVQQGEwJPTTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC
AQoCggEBALX67rPus9FMkqPyDq2oWvJjBJHKbXkamhLg3QAz3L3UhUFJ7K7YDDZa
qZNlOsqi6V3gSpdakeVxKcP5hYdLD/LRPyjWtzsk6o7eHZiy+OZqzCBDc0ACCzdl
FRo7tMfksOattaPrkVwWW4J889zFUEOigN2goQBLa4/EyPIZO4jHvyax8WxMmk1T
yOHXvx/GPHSiYgYo5wfwlTFEVLAF/AghwKq/flVCjWhus7OsR5MuRu2g4X65tcI8
FOLI8Hav8u/0ZJ5Mv0EQlTjbaXjqntd4gCIucsjZs/Zv1k4keI0ghu6OHTfyXo3j
zEOHP1QG8sg3JlUACaBpZjIuVzsrdvcCAwEAAaNTMFEwHQYDVR0OBBYEFCABocUw
/j/3HVPS/Q/k/+VRUz8/MB8GA1UdIwQYMBaAFCABocUw/j/3HVPS/Q/k/+VRUz8/
MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBACuncUKlKNtp6M+k
SvacsNvdn69Yx0MfCbWtZOlj6XkVFQvy57eha+GIhwDM4dEgulMbLZi2rKgi2MH+
147K0/fPEhBmfGaMu8s3Ho1271yNDeyf2s76PDf7scmRH7+ZC9Perr05+qA17nwM
1ZX5/pnM9tQASL2jWgGBzLvINqHk8HDqU8cabg9HnlezEgqVgAh9wMlNuGF/mmue
7ndWx4y0KxVh1qrqmdKkp1Q95/jmWGjAIfmZ/LrGZjevB83cLA3DXM6KX8oC80xL
5EaSo0LGC9hWfMYpaEuFHdrBcVvp19/0lmCsa2xPpVNs/Y84RybNEYnXADEIwQ4a
42XL3dY=
-----END CERTIFICATE-----`;

/** True once a real certificate has been pasted in (placeholder check). */
export const QZ_CERTIFICATE_CONFIGURED =
  !QZ_CERTIFICATE.includes('PASTE_DIGITAL_CERTIFICATE_HERE');
