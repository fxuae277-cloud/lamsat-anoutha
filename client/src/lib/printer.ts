/**
 * printer.ts — QZ Tray image printing | لمسة أنوثة POS
 *
 * Flow:
 *  1. getLogoDataUrl()        → fetch /logo.png → base64 (same-origin, no CORS)
 *  2. buildReceiptHtml()      → self-contained TABLE-based HTML (no flexbox)
 *  3. receiptToBase64()       → off-screen DOM → html2canvas scale:3 → PNG
 *  4. printReceiptAsImage()   → QZ pixel/image job → separate cut command
 *
 * Why TABLE (not flex):
 *   html2canvas v1.4.x misrenders justify-content:space-between in RTL.
 *   Tables give deterministic column widths every time.
 */

import html2canvas from 'html2canvas';

declare const qz: any;

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PRINTER = 'EPSON TM-T100 Receipt';
const RECEIPT_WIDTH   = 576;          // px — HTML width before scale
const INNER_W         = RECEIPT_WIDTH - 40; // 536px (20px padding × 2)

const CMD_CUT    = '\x1D\x56\x41\x10';     // GS V 65 16 — partial cut
const CMD_DRAWER = '\x1B\x70\x00\x19\xFA'; // ESC p — cash drawer pulse

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  productName: string;
  quantity:    number;
  unitPrice:   number | string;
  color?:      string;
  size?:       string;
}

export interface ReceiptData {
  invoiceNumber:  string;
  items:          ReceiptItem[];
  subtotal?:      number;
  discount?:      number;
  vat?:           number;
  vatRate?:       number;   // percentage: 5, 10, 15…
  total:          number;
  amountPaid?:    number;
  changeAmount?:  number;
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | string;
  customerName?:  string | null;
  cashierName?:   string;
  branchName?:    string;
  createdAt?:     string;
  qrCodeDataUrl?: string;   // optional pre-generated base64 PNG
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: string | number | null | undefined) =>
  parseFloat(String(v ?? 0)) || 0;

const fmtOMR = (v: number) =>
  v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ر.ع';

const payLabel = (m: string): string => {
  const labels: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    bank_transfer: 'تحويل بنكي',
  };
  return labels[m] ?? m;
};

const fmtReceiptDate = (dateStr?: string): string => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let   h    = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ap   = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${dd}/${mm}/${yyyy} - ${h}:${min} ${ap}`;
};

// ─── Logo loader ──────────────────────────────────────────────────────────────

/** Fetch /logo.png from same origin → base64 data URL. Silent on failure. */
async function getLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result as string);
      r.onerror = () => resolve('');
      r.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// ─── QZ connection ────────────────────────────────────────────────────────────

export async function ensureQzConnected(): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تأكد من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }
  if (qz.websocket.isActive()) return;
  try {
    await qz.websocket.connect();
  } catch (e: any) {
    throw new Error(`تعذّر الاتصال بـ QZ Tray — ${e.message ?? e}`);
  }
}

// ─── Printer detection ────────────────────────────────────────────────────────

export async function getReceiptPrinter(printerName?: string): Promise<string> {
  const target = printerName || DEFAULT_PRINTER;
  try {
    const found: string[] = await qz.printers.find(target);
    if (!found?.length) {
      throw new Error(
        `الطابعة "${target}" غير موجودة — تحقق من اسم الطابعة في الإعدادات`
      );
    }
    return found[0];
  } catch (e: any) {
    if (String(e.message).includes('غير موجودة')) throw e;
    throw new Error(`فشل البحث عن الطابعة: ${e.message ?? e}`);
  }
}

// ─── Receipt HTML builder ─────────────────────────────────────────────────────

/**
 * Builds a 576px self-contained receipt using ONLY <table> layouts.
 * All styles are inline. No flexbox, no grid, no external CSS.
 *
 * Visual structure:
 *  ┌─────────────────────────────────────┐
 *  │            [LOGO IMAGE]              │
 *  │          LAMST ANOTHA               │
 *  │   ── TOUCH OF FEMININITY ──  ♥      │
 *  ├─────┬──────────────┬────────────────┤
 *  │ سجل │  انستجرام    │   تواصل        │ (contact bar)
 *  ╞═══════════════════════════════════╡ (dashed sep)
 *  │██ رقم الفاتورة | INV-XXXXX █████│  (dark bar)
 *  │██ التاريخ 25/04/2026 - 09:12 PM █│
 *  │   الفرع: …         الكاشير: …     │
 *  ╞═══════════════════════════════════╡ (dashed sep)
 *  │██  م  │  الصنف  │ كمية │ سعر │ إجمالي ██│ (dark header)
 *  │   1   │ منتج    │  ×1  │ … │ … │
 *  ╞═══════════════════════════════════╡
 *  │  المجموع الفرعي          X.XXX ر.ع │
 *  │  الخصم                   X.XXX ر.ع │
 *  │  ضريبة (5%)               X.XXX ر.ع│
 *  │██        الإجمالي  XX.XXX ر.ع    ██│ (dark)
 *  │  المدفوع / الباقي / طريقة الدفع    │
 *  ╞═══════════════════════════════════╡
 *  │ ┌ - - - - - - - - - - - - - - ┐  │
 *  │   ♥ شكراً لثقتكم بنا ♥          │
 *  │   نسعد بخدمتكم دائماً            │
 *  │ └ - - - - - - - - - - - - - - ┘  │
 *  │  جودة  │   [QR]   │   تسوقي       │
 *  ├──────────────────────────────────┤
 *  │  لا يوجد استرجاع أو استبدال …     │
 *  │  No Return or Exchange …          │
 *  └─────────────────────────────────┘
 */
export function buildReceiptHtml(data: ReceiptData, logoDataUrl = ''): string {
  const {
    invoiceNumber, items,
    discount, vat, vatRate,
    total, amountPaid, changeAmount,
    paymentMethod = 'cash',
    customerName, cashierName, branchName,
    createdAt, qrCodeDataUrl,
  } = data;

  const subtotal = data.subtotal ??
    items.reduce((s, i) => s + toNum(i.unitPrice) * i.quantity, 0);
  const discVal  = toNum(discount);
  const vatVal   = toNum(vat);

  const vatPct = vatRate ??
    (subtotal > 0 && vatVal > 0 ? Math.round((vatVal / subtotal) * 100) : 0);

  const dateStr = fmtReceiptDate(createdAt);

  // Shared font shorthand
  const F = 'font-family:Tahoma,Arial,sans-serif;';

  // Dark-background cell (for header bars)
  const dk = (content: string, align: 'right' | 'left' | 'center', width = '') =>
    `<td style="${F}background:#111111;color:#ffffff;padding:10px 12px;
     text-align:${align};vertical-align:middle;${width ? `width:${width};` : ''}
     direction:${align === 'left' ? 'ltr' : 'rtl'};">${content}</td>`;

  // Two-column summary row (label right | amount left)
  const sumRow = (label: string, value: string, bold = false, size = 17) =>
    `<tr>
       <td style="${F}font-size:${size}px;text-align:right;color:#333;padding:5px 0;
           ${bold ? 'font-weight:bold;' : ''}vertical-align:middle;">${label}</td>
       <td style="${F}font-size:${size}px;text-align:left;direction:ltr;color:#000;
           padding:5px 0;${bold ? 'font-weight:bold;' : ''}vertical-align:middle;">${value}</td>
     </tr>`;

  // ── Item rows ─────────────────────────────────────────────────────────────
  const itemRows = items.map((item, idx) => {
    const lineTotal = toNum(item.unitPrice) * item.quantity;
    const name      = item.color ? `${item.productName} (${item.color})` : item.productName;
    const isLast    = idx === items.length - 1;
    return `
      <tr>
        <td style="${F}font-size:17px;font-weight:bold;text-align:right;color:#000;
                    padding:9px 4px 3px;vertical-align:top;width:6%;">${idx + 1}</td>
        <td style="${F}font-size:17px;font-weight:bold;text-align:right;color:#000;
                    padding:9px 4px 3px;vertical-align:top;width:40%;">${name}</td>
        <td style="${F}font-size:16px;text-align:center;color:#444;
                    padding:9px 4px 3px;vertical-align:top;width:12%;">${item.quantity}</td>
        <td style="${F}font-size:16px;text-align:center;color:#444;
                    padding:9px 4px 3px;vertical-align:top;width:21%;direction:ltr;">
          ${fmtOMR(toNum(item.unitPrice))}</td>
        <td style="${F}font-size:17px;font-weight:bold;text-align:left;color:#000;
                    padding:9px 4px 3px;vertical-align:top;width:21%;direction:ltr;">
          ${fmtOMR(lineTotal)}</td>
      </tr>
      ${!isLast ? `<tr><td colspan="5" style="padding:0 4px;">
        <div style="border-top:1px dashed #bbb;margin:2px 0;"></div></td></tr>` : ''}`;
  }).join('');

  // ── Full HTML ──────────────────────────────────────────────────────────────
  return `
<div style="
  width:${RECEIPT_WIDTH}px;
  background:#ffffff;
  color:#000000;
  ${F}
  direction:rtl;
  padding:20px;
  box-sizing:border-box;
  line-height:1.45;
">

  <!-- ══ LOGO ══ -->
  ${logoDataUrl ? `
  <div style="text-align:center;margin-bottom:8px;">
    <img src="${logoDataUrl}"
         style="max-width:110px;max-height:90px;object-fit:contain;" />
  </div>` : ''}

  <!-- ══ STORE NAME ══ -->
  <div style="${F}font-size:26px;font-weight:bold;text-align:center;
              letter-spacing:3px;color:#000;margin-bottom:3px;">
    LAMST ANOTHA
  </div>

  <!-- ══ TAGLINE ══ -->
  <div style="text-align:center;margin-bottom:12px;">
    <span style="${F}font-size:12px;letter-spacing:2px;color:#888;">──────────</span>
    <span style="${F}font-size:12px;letter-spacing:1px;color:#555;"> TOUCH OF FEMININITY </span>
    <span style="${F}font-size:12px;letter-spacing:2px;color:#888;">──────────</span><br>
    <span style="${F}font-size:16px;color:#555;">♥</span>
  </div>

  <!-- ══ CONTACT INFO ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-bottom:10px;"
         cellpadding="0" cellspacing="0">
    <tr>
      <td style="${F}font-size:13px;text-align:center;border-left:1px solid #ccc;
                  padding:5px 6px;vertical-align:top;width:33%;">
        <div style="color:#666;margin-bottom:2px;">رقم السجل التجاري</div>
        <div style="${F}font-weight:bold;font-size:15px;direction:ltr;">1260008</div>
      </td>
      <td style="${F}font-size:13px;text-align:center;border-left:1px solid #ccc;
                  padding:5px 6px;vertical-align:top;width:34%;">
        <div style="color:#666;margin-bottom:2px;">الانستجرام</div>
        <div style="${F}font-weight:bold;font-size:15px;direction:ltr;">lamst_anotha</div>
      </td>
      <td style="${F}font-size:13px;text-align:center;
                  padding:5px 6px;vertical-align:top;width:33%;">
        <div style="color:#666;margin-bottom:2px;">التواصل مع الإدارة</div>
        <div style="${F}font-weight:bold;font-size:15px;direction:ltr;">94891122</div>
      </td>
    </tr>
  </table>

  <!-- ══ DASHED SEPARATOR ══ -->
  <div style="border-top:1px dashed #aaa;margin:0 0 10px;"></div>

  <!-- ══ INVOICE HEADER BAR (dark) ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;"
         cellpadding="0" cellspacing="0">
    <tr>
      ${dk(`<div style="${F}font-size:13px;color:#bbb;margin-bottom:3px;">رقم الفاتورة</div>
            <div style="${F}font-size:21px;font-weight:bold;">${invoiceNumber || '---'}</div>`,
           'right', '50%')}
      ${dk(`<div style="${F}font-size:13px;color:#bbb;margin-bottom:3px;direction:rtl;text-align:right;">
              التاريخ والوقت</div>
            <div style="${F}font-size:16px;font-weight:bold;">${dateStr}</div>`,
           'left', '50%')}
    </tr>
  </table>

  <!-- ══ BRANCH / CASHIER ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-top:8px;"
         cellpadding="0" cellspacing="0">
    <tr>
      <td style="${F}font-size:16px;text-align:right;padding:3px 2px;width:50%;vertical-align:top;">
        <div style="${F}font-size:13px;color:#777;">الفرع</div>
        <div style="font-weight:bold;">${branchName || '---'}</div>
      </td>
      <td style="${F}font-size:16px;text-align:left;padding:3px 2px;width:50%;
                  direction:ltr;vertical-align:top;">
        <div style="${F}font-size:13px;color:#777;direction:rtl;text-align:right;">الكاشير</div>
        <div style="font-weight:bold;">${cashierName || '---'}</div>
      </td>
    </tr>
    ${customerName ? `<tr>
      <td colspan="2" style="${F}font-size:16px;text-align:right;padding:3px 2px;border-top:1px dashed #ddd;">
        <span style="${F}font-size:13px;color:#777;">العميلة: </span>
        <span style="font-weight:bold;">${customerName}</span>
      </td>
    </tr>` : ''}
  </table>

  <!-- ══ DASHED SEPARATOR ══ -->
  <div style="border-top:1px dashed #aaa;margin:10px 0;"></div>

  <!-- ══ ITEMS TABLE HEADER (dark) ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;"
         cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        ${dk('<span style="font-size:14px;font-weight:bold;">م</span>',          'right', '6%')}
        ${dk('<span style="font-size:14px;font-weight:bold;">الصنف</span>',       'right', '40%')}
        ${dk('<span style="font-size:14px;font-weight:bold;">الكمية</span>',      'center', '12%')}
        ${dk('<span style="font-size:14px;font-weight:bold;">سعر الوحدة</span>',  'center', '21%')}
        ${dk('<span style="font-size:14px;font-weight:bold;">الإجمالي</span>',    'left', '21%')}
      </tr>
    </thead>
  </table>

  <!-- ══ ITEMS ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-top:4px;"
         cellpadding="0" cellspacing="0">
    <tbody>${itemRows}</tbody>
  </table>

  <!-- ══ SOLID SEPARATOR ══ -->
  <div style="border-top:2px solid #000;margin:10px 0 8px;"></div>

  <!-- ══ SUBTOTALS ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;"
         cellpadding="0" cellspacing="0">
    <tbody>
      ${sumRow('المجموع الفرعي', fmtOMR(subtotal))}
      ${sumRow('الخصم', fmtOMR(discVal))}
      ${vatVal > 0 ? sumRow(
          vatPct > 0 ? `ضريبة القيمة المضافة (${vatPct}%)` : 'ضريبة القيمة المضافة',
          fmtOMR(vatVal)
        ) : ''}
    </tbody>
  </table>

  <!-- ══ GRAND TOTAL BAR (dark) ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-top:6px;"
         cellpadding="0" cellspacing="0">
    <tr>
      ${dk('<span style="font-size:22px;font-weight:bold;">الإجمالي</span>', 'right')}
      ${dk(`<span style="font-size:22px;font-weight:bold;">${fmtOMR(total)}</span>`, 'left')}
    </tr>
  </table>

  <!-- ══ PAYMENT DETAILS ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-top:8px;"
         cellpadding="0" cellspacing="0">
    <tbody>
      ${toNum(amountPaid) > 0 ? sumRow('المدفوع', fmtOMR(toNum(amountPaid))) : ''}
      ${toNum(changeAmount) > 0 ? sumRow('الباقي',   fmtOMR(toNum(changeAmount))) : ''}
      ${sumRow('طريقة الدفع', payLabel(paymentMethod))}
    </tbody>
  </table>

  <!-- ══ SOLID SEPARATOR ══ -->
  <div style="border-top:2px solid #000;margin:12px 0;"></div>

  <!-- ══ THANK YOU BOX ══ -->
  <div style="border:1px dashed #999;border-radius:3px;padding:12px 8px;
              text-align:center;margin-bottom:12px;">
    <div style="${F}font-size:20px;font-weight:bold;color:#000;margin-bottom:4px;">
      ♥ شكراً لثقتكم بنا ♥
    </div>
    <div style="${F}font-size:16px;color:#444;">
      نسعد بخدمتكم دائماً
    </div>
  </div>

  <!-- ══ FOOTER 3-COLUMN ══ -->
  <table style="width:${INNER_W}px;border-collapse:collapse;margin-bottom:10px;"
         cellpadding="0" cellspacing="0">
    <tr>
      <td style="${F}font-size:14px;text-align:right;vertical-align:middle;
                  width:35%;padding:4px 0;">
        <div style="font-weight:bold;color:#000;">جودة وأنافة</div>
        <div style="color:#555;margin-top:2px;">تليق بكِ</div>
      </td>
      <td style="text-align:center;vertical-align:middle;width:30%;padding:4px 0;">
        ${qrCodeDataUrl
          ? `<img src="${qrCodeDataUrl}"
                  style="width:68px;height:68px;object-fit:contain;" />`
          : ''}
      </td>
      <td style="${F}font-size:14px;text-align:left;vertical-align:middle;
                  width:35%;direction:ltr;padding:4px 0;">
        <div style="font-weight:bold;color:#000;">تسوقي الآن</div>
        <div style="color:#555;margin-top:2px;">مع لمسة أنوثة</div>
      </td>
    </tr>
  </table>

  <!-- ══ SEPARATOR ══ -->
  <div style="border-top:1px solid #000;margin:6px 0;"></div>

  <!-- ══ RETURN POLICY ══ -->
  <div style="${F}font-size:14px;text-align:center;color:#333;
              padding:6px 0 2px;line-height:1.9;">
    لا يوجد استرجاع أو استبدال بعد الشراء<br>
    <span style="direction:ltr;display:inline-block;color:#555;">
      No Return or Exchange After Purchase
    </span>
  </div>

  <!-- feed gap before cutter -->
  <div style="height:18px;"></div>

</div>`;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

/**
 * Appends receipt HTML off-screen, captures with html2canvas at scale:3,
 * returns raw Base64 PNG (no data URI prefix).
 */
async function receiptToBase64(htmlString: string, rotate180 = false): Promise<string> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'z-index:-9999',
    'pointer-events:none',
    `width:${RECEIPT_WIDTH}px`,
    'background:#ffffff',
  ].join(';');
  wrapper.innerHTML = htmlString.trim();
  document.body.appendChild(wrapper);

  try {
    const el = wrapper.firstElementChild as HTMLElement;

    const canvas = await html2canvas(el, {
      scale:           3,
      useCORS:         true,
      backgroundColor: '#ffffff',
      width:           RECEIPT_WIDTH,
      height:          el.scrollHeight,
      logging:         false,
    });

    let target = canvas;

    if (rotate180) {
      const rot  = document.createElement('canvas');
      rot.width  = canvas.width;
      rot.height = canvas.height;
      const ctx  = rot.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      target = rot;
    }

    return target.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, '');
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Paper cut ────────────────────────────────────────────────────────────────

export async function cutPaper(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

// ─── Cash drawer ──────────────────────────────────────────────────────────────

export async function openCashDrawer(printerName?: string): Promise<void> {
  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_DRAWER }]
  );
}

// ─── Main print function ──────────────────────────────────────────────────────

/**
 * Render receipt → PNG (scale:3) → QZ Tray pixel print → cut.
 *
 * @param data         Receipt data
 * @param printerName  Windows queue name — defaults to DEFAULT_PRINTER
 * @param rotate180    Flip 180° before printing — fix upside-down output
 *
 * Throws Arabic error string on failure — pass directly to toast.
 */
export async function printReceiptAsImage(
  data:         ReceiptData,
  printerName?: string,
  rotate180 =   false,
): Promise<void> {
  if (typeof qz === 'undefined') {
    throw new Error(
      'QZ Tray غير محمّل — تحقق من تشغيل تطبيق QZ Tray وأعد تحميل الصفحة'
    );
  }

  await ensureQzConnected();
  const printer = await getReceiptPrinter(printerName);

  const logoDataUrl = await getLogoDataUrl();
  const html        = buildReceiptHtml(data, logoDataUrl);
  const base64      = await receiptToBase64(html, rotate180);

  const imgConfig = qz.configs.create(printer, {
    units:         'px',
    density:       203,
    margins:       0,
    interpolation: 'nearest-neighbor',
  });

  await qz.print(imgConfig, [{
    type:   'pixel',
    format: 'image',
    flavor: 'base64',
    data:   base64,
  }]);

  // Cut must be a separate raw job sent AFTER the image job completes
  await qz.print(
    qz.configs.create(printer),
    [{ type: 'raw', format: 'plain', data: CMD_CUT }]
  );
}

// ─── Test print ───────────────────────────────────────────────────────────────

/** Prints a full Arabic test receipt. Call from browser console or Settings. */
export async function printTestReceiptAsImage(
  printerName?: string,
  rotate180 = false,
): Promise<void> {
  await printReceiptAsImage(
    {
      invoiceNumber: 'INV-TEST-001',
      branchName:    'الفرع الرئيسي',
      cashierName:   'ahmed',
      createdAt:     new Date().toISOString(),
      items: [
        { productName: 'حلق دائري ذهبي',   quantity: 1, unitPrice: 1.600 },
        { productName: 'سوار فضي ناعم',    quantity: 1, unitPrice: 2.500 },
        { productName: 'عقد لؤلؤ طبيعي',   quantity: 1, unitPrice: 3.900 },
      ],
      subtotal:      8.000,
      discount:      0,
      vat:           0.400,
      vatRate:       5,
      total:         8.400,
      amountPaid:    10.000,
      changeAmount:  1.600,
      paymentMethod: 'cash',
    },
    printerName,
    rotate180,
  );
}

// ─── Backward-compatible alias ────────────────────────────────────────────────

export const printReceipt = printReceiptAsImage;
