# Lamsa Local Print Service

Local print bridge for **Lamsat Anotha POS**. Runs on each cashier Windows PC
and exposes a small HTTP API on `http://127.0.0.1:3030` that the cloud POS
calls to print directly to Windows printers — without QZ Tray, browser print
dialogs, or `window.print()`.

This is **Phase 1**: it proves the bridge architecture works using
PowerShell-based plain-text printing. ESC/POS receipts, TSPL labels, and cash
drawer support land in later phases.

## Prerequisites

- Windows 10/11 (PowerShell 4.0+ required for `Get-Printer`).
- Node.js LTS — install from <https://nodejs.org/>. Verify with `node -v`
  (should be `v20.x` or newer).
- At least one printer installed in Windows.

## Install

Open PowerShell or Command Prompt in the cashier PC, then:

```powershell
cd C:\Users\HP\lamsat-anoutha\local-print-service
npm install
```

## Configure

Copy the example env file and edit it:

```powershell
copy .env.example .env
notepad .env
```

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Port the service listens on (loopback only). | `3030` |
| `LOCAL_PRINT_API_KEY` | Required header for `POST` endpoints. **Change this on every cashier PC.** | `change-me` |
| `LOCAL_PRINT_ALLOW_ALL` | Bypass CORS allow-list (set to `true` only for local debugging). | `false` |

## Run (development)

```powershell
npm run dev
```

You should see:

```
[Lamsa Local Print] listening on http://127.0.0.1:3030
[Lamsa Local Print] CORS allow-all: false
```

The `dev` script uses `tsx watch`, so source edits restart the service
automatically.

## Test

All examples assume the default `LOCAL_PRINT_API_KEY=change-me`. Replace
`<KEY>` with whatever you set in `.env`.

### 1. Health check

```powershell
curl http://127.0.0.1:3030/health
```

Expected:

```json
{ "ok": true, "service": "Lamsa Local Print Service", "version": "1.0.0" }
```

### 2. List installed printers

```powershell
curl http://127.0.0.1:3030/printers
```

Expected (shape):

```json
{
  "ok": true,
  "printers": [
    { "Name": "EPSON TM-T100 Receipt", "DriverName": "...", "PortName": "USB001", "Shared": false, "Default": false },
    { "Name": "TSC TTP-244M Pro", "DriverName": "...", "PortName": "USB002", "Shared": false, "Default": false }
  ]
}
```

### 3. Send a test print

Pick the exact `Name` value from `/printers` output and use it below.

```powershell
curl -X POST http://127.0.0.1:3030/print/test ^
  -H "Content-Type: application/json" ^
  -H "x-lamsa-print-key: <KEY>" ^
  -d "{\"printerName\":\"EPSON TM-T100 Receipt\",\"text\":\"LAMST ANOTHA TEST PRINT\"}"
```

PowerShell users can use `Invoke-RestMethod` instead:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:3030/print/test `
  -Method POST `
  -Headers @{ "x-lamsa-print-key" = "<KEY>" } `
  -ContentType "application/json" `
  -Body '{"printerName":"EPSON TM-T100 Receipt","text":"LAMST ANOTHA TEST PRINT"}'
```

A successful call returns `{ "ok": true }` and the printer fires a small page
with the text on it. (In Phase 1 the rendering is whatever Windows decides — no
ESC/POS layout yet.)

## Production

```powershell
npm run build
npm run start
```

`npm run build` compiles `src/` into `dist/` via `tsc`. `npm run start` runs
the compiled JS with plain `node`, which is the form you would wrap with NSSM
or Windows Task Scheduler when wiring up auto-start. (Auto-start setup will be
documented in Phase 5.)

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|-------------------|
| `printers` returns `{ "ok": true, "printers": [] }` | The Windows user running this service has no printers in their account. Open Settings → Printers & scanners and confirm the printer is listed there. |
| `/printers` 500 with `Get-Printer` not recognized | PowerShell 3.0 or older. Update Windows or install Windows Management Framework 4.0+. |
| `/print/test` 401 invalid key | Header `x-lamsa-print-key` missing or doesn't match `.env`. Confirm both sides. |
| `/print/test` 403 origin not allowed | The browser's Origin doesn't match the allow-list in `src/index.ts`. Add it there or set `LOCAL_PRINT_ALLOW_ALL=true` for debugging only. |
| `/print/test` 500 print failed | Printer name doesn't exactly match a `Name` from `/printers`, or the printer queue is paused / offline / out of paper. Open the printer queue from Windows Settings to confirm. |
| Browser blocks call from Railway HTTPS to local HTTP | Mixed Content. Will be addressed in Phase 4 with a same-origin pattern. For Phase 1, test from `http://localhost:5000` or `http://127.0.0.1:5000`. |

## Security notes

- The service binds to `127.0.0.1` only. Other machines on the LAN cannot
  reach it; only code running in a browser on the same PC can call it.
- `LOCAL_PRINT_API_KEY` defends against malicious local pages that might also
  be open in the cashier's browser. Set a long random value per PC.
- The print service does **not** read or store invoice data — every `POST`
  body is consumed in-process and discarded.

## Phase 2: receipt printing (`POST /print/invoice`)

Phase 2 adds an authenticated invoice endpoint that prints an 80mm thermal
receipt to **EPSON TM-T100** (and any compatible ESC/POS printer) using
**raw Windows printing** via the `winspool.drv` API — no QZ Tray, no browser
print dialog, no `Out-Printer` rendering.

### How it works

1. The endpoint validates the JSON payload.
2. `printInvoice.ts` composes the receipt as ESC/POS bytes (init, code page
   selection, header, items, totals, partial cut).
3. `rawPrint.ts` writes the bytes to a temp file and invokes a tiny C# helper
   loaded inline via PowerShell `Add-Type`. The helper P/Invokes
   `OpenPrinter`/`StartDocPrinter`/`WritePrinter` with the **RAW** datatype
   so the bytes reach the thermal printer untouched.

### Test it

Start the service (`npm run dev`), then:

```powershell
curl -X POST http://127.0.0.1:3030/print/invoice ^
  -H "Content-Type: application/json" ^
  -H "x-lamsa-print-key: <KEY>" ^
  -d "{\"printerName\":\"EPSON TM-T100 Receipt\",\"invoice\":{\"invoiceNo\":\"INV-1001\",\"date\":\"2026-04-26 10:30\",\"cashier\":\"Cashier\",\"branch\":\"Lamsa Branch\",\"customerName\":\"Walk-in Customer\",\"items\":[{\"name\":\"Shoes Model 131-AF-80\",\"sku\":\"131-AF-80\",\"qty\":1,\"price\":4.5,\"total\":4.5}],\"subtotal\":4.5,\"discount\":0,\"tax\":0,\"grandTotal\":4.5,\"paymentMethod\":\"Cash\"}}"
```

PowerShell users (more readable):

```powershell
$body = @{
  printerName = "EPSON TM-T100 Receipt"
  invoice = @{
    invoiceNo     = "INV-1001"
    date          = "2026-04-26 10:30"
    cashier       = "Cashier"
    branch        = "Lamsa Branch"
    customerName  = "Walk-in Customer"
    items = @(
      @{ name = "Shoes Model 131-AF-80"; sku = "131-AF-80"; qty = 1; price = 4.5; total = 4.5 }
    )
    subtotal      = 4.5
    discount      = 0
    tax           = 0
    grandTotal    = 4.5
    paymentMethod = "Cash"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri http://127.0.0.1:3030/print/invoice `
  -Method POST `
  -Headers @{ "x-lamsa-print-key" = "<KEY>" } `
  -ContentType "application/json" `
  -Body $body
```

A successful call returns `{ "ok": true, "bytesSent": <number> }` and a
receipt physically prints with a partial cut at the end.

### Receipt layout (80mm, 48 columns)

```
            LAMST ANOTHA
            CR: 1260008
       Instagram: lamst_anotha
     Admin Contact: 94891122

================================================
Invoice:                                INV-1001
Date:                          2026-04-26 10:30
Branch:                            Lamsa Branch
Cashier:                                Cashier
Customer:                    Walk-in Customer
================================================
Shoes Model 131-AF-80
  SKU: 131-AF-80
  1 x 4.500                                 4.500
------------------------------------------------
Subtotal:                                  4.500
Discount:                                  0.000
Tax:                                       0.000
================================================
            TOTAL:           4.500           (2× size, bold)
Payment:                                    Cash
================================================

       Thank you for shopping with us
                                               <-- partial cut
```

### Arabic support — current state

Phase 2 ships with **CP1252 (Latin-1)** as the printer code page. Pure
English text, numbers, currency formatting, and most European symbols print
correctly. **Arabic strings** (cashier name, branch, customer name written in
Arabic) print as `?` placeholders in this phase by design — encoding Arabic
correctly requires:

- Selecting an Arabic code page that matches the TM-T100 firmware
  (typically **CP864** via `ESC t 22`, or CP1256 via custom firmware).
- Right-to-left line composition where the host inverts character order before
  sending bytes — thermal printers do not bidi-shape on their own.

This is deferred to **Phase 3** so we don't block testing while figuring out
which code page your specific TM-T100 firmware understands. Pass branch /
cashier / customer fields in English (or transliterated) for now and the
receipt prints cleanly.

### Performance note

The first `/print/invoice` call after the service starts takes ~1–2 seconds
extra because PowerShell compiles the inline C# helper via Roslyn. Subsequent
calls reuse the warmed PowerShell process pool and are sub-second. If this
overhead becomes painful, Phase 3 can pre-compile the helper into a DLL.

### Troubleshooting `/print/invoice`

| Symptom | Likely cause / fix |
|---------|-------------------|
| 500 with `OpenPrinter failed: Win32=1801` | Invalid printer name — must match exactly a `Name` from `/printers`. |
| 500 with `OpenPrinter failed: Win32=5` | Access denied — the user running the service has no permission on the printer queue. |
| 500 with `WritePrinter failed: Win32=63` | Printer offline / paused / out of paper. Check the queue from Settings → Printers. |
| Receipt prints garbage characters | Code page mismatch. TM-T100 default is PC437; see Arabic note above for non-ASCII text. |
| Cut command ignored, receipt doesn't separate | Older firmware. Try replacing `cutPartial(3)` with `cutFull` in `escpos.ts`, or increase feed dots. |

## What's next (Phase 3)

Phase 3 will add label printing (`POST /print/label` with TSPL for TSC
TTP-244M Pro) and cash drawer kick (`POST /drawer/open`). Arabic code page
selection will land in the same phase once we verify the right page on the
TM-T100 firmware in your shop.

## Cash drawer (v2.3.0)

The cash drawer wired to **pin 2** of the EPSON TM-T100's DK port pops open
automatically after every successful invoice print, and can also be opened
on demand via a dedicated endpoint.

### How it works

The rasteriser (`pngToEscposRaster`) injects a single ESC/POS pulse command
**after** the trailing feed lines and **before** the partial-cut command:

```
[ raster image ] → [ feed × 4 ] → [ ESC p 0 25 250 ] → [ GS V 1 cut ]
```

Bytes: `0x1B 0x70 0x00 0x19 0xFA`

| Byte | Meaning |
|------|---------|
| `0x1B 0x70` | `ESC p` — generate drawer kick-out pulse |
| `0x00` | `m=0` → drawer #1 (pin 2 on the DK connector) |
| `0x19` | `t1=25` → on-time = 25 × 2ms = **50 ms** |
| `0xFA` | `t2=250` → off-time = 250 × 2ms = 500 ms |

Why the order matters: some EPSON firmwares ignore the kick if it arrives
while the print engine is still flushing rows, so the feed lines must
finish first. Putting the kick before the cut ensures the receipt drops
and the drawer opens at the same moment.

The kick is embedded in the same RAW print job as the receipt — there is
no second `printRawBytes` round-trip and no extra PowerShell process per
sale. Labels are not affected (`/print/label` does not pass `openDrawer`).

### Manual test endpoint: `POST /open-drawer`

Used to confirm the drawer cabling and pin number after install, without
having to print a real invoice. Same auth (`x-api-key`) as the print
endpoints.

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:3001/open-drawer `
  -Method POST `
  -Headers @{ "x-api-key" = "<KEY>" } `
  -ContentType "application/json" `
  -Body '{"printerName":"EPSON TM-T100 Receipt"}'
```

Successful response:

```json
{
  "ok": true,
  "printer": "EPSON TM-T100 Receipt",
  "bytesSent": 5,
  "command": "ESC p 0 25 250"
}
```

Both `/open-drawer` and `/api/open-drawer` are accepted.

### Logs

The service writes one of these to `print-service.log` per drawer event:

```
[Drawer] kick request printer=EPSON TM-T100 Receipt
[Drawer] kick sent printer=EPSON TM-T100 Receipt bytes=5
[Drawer] kick embedded in invoice print invoice=INV-1234 printer=EPSON TM-T100 Receipt
[Drawer] kick failed printer=EPSON TM-T100 Receipt: <reason>
```

### Troubleshooting drawer

| Symptom | Likely cause / fix |
|---------|-------------------|
| Receipt prints, drawer stays shut | Drawer cable on the wrong DK pin. The default kick targets pin 2 (drawer #1). If your cable is on pin 5 (drawer #2), swap `m=0x00` to `m=0x01` in `DRAWER_KICK_BYTES`. |
| `/open-drawer` returns 200 but nothing happens | Solenoid disconnected at the drawer side, or 24V supply weak. Try a longer pulse: `t1=0x32` (100 ms). |
| `/open-drawer` returns 500 | Same as `/print/invoice` 500 — printer queue paused / offline / wrong name. Check `/printers` first. |
