# QZ Tray signing keypair

This directory holds the **self-signed** certificate / private-key pair used
to make every print request from the Lamsa POS web app trusted by QZ Tray —
removing the "anonymous request / Untrusted website" prompt.

## Files

| File | Purpose | Where the live copy lives |
|---|---|---|
| `digital-certificate.pem` | Public certificate. Safe to share. | Inlined into `client/src/lib/qz-certificate.ts` |
| `private-key.pem` | Private RSA key. Server-only. | Inlined into `.env` as `QZ_PRIVATE_KEY` (and into Railway → Variables) |
| `verify-pair.mjs` | Signs a nonce with `.env`'s key and verifies it against the cert in `qz-certificate.ts`. PASS = QZ Tray will accept signatures. | — |

## Verifying the chain

After updating the cert or the private key, run:

```bash
node scripts/qz-keys/verify-pair.mjs
```

Expect:

```
verify with cert: PASS ✓
```

If you see `FAIL ✗`, the cert and private key are **not** a matching pair —
QZ Tray will reject every signature. Regenerate (see below) and paste both
halves in the same commit.

## Regenerating from scratch

```bash
cd scripts/qz-keys

# 1) New 2048-bit RSA private key
openssl genrsa -out private-key.pem 2048

# 2) Self-signed X.509 certificate, 10-year validity
openssl req -new -x509 -key private-key.pem \
  -out digital-certificate.pem -days 3650 \
  -subj "/CN=Lamsat Anotha POS/OU=POS Printing/O=Lamsat Anotha/C=OM"
```

Then:

1. Copy the contents of `digital-certificate.pem` into the
   `QZ_CERTIFICATE` template literal in `client/src/lib/qz-certificate.ts`.
2. Copy the contents of `private-key.pem` into the `QZ_PRIVATE_KEY` value
   in `.env` (preserve the multi-line PEM inside the double quotes; the
   loader in `server/index.ts` handles that natively).
3. Update `Railway → Variables → QZ_PRIVATE_KEY` with the same value.
4. Re-run `node scripts/qz-keys/verify-pair.mjs` → expect `PASS ✓`.
5. Commit the cert change to `client/src/lib/qz-certificate.ts` and push.
6. On the QZ Tray prompt, click **Allow** + **Remember this decision** once.

## Why self-signed is fine

QZ Tray Community Edition does not validate against a CA chain. It pins the
exact certificate the user approved on first run. So a self-signed cert
generated like above is fully sufficient for our trusted-signing setup.
