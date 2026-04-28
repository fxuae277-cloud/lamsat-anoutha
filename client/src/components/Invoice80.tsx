import { Heart } from "lucide-react";

/**
 * Invoice80.tsx — 80mm thermal receipt layout.
 *
 * Pixel width is locked to 576px (= 72mm printable × 8 dots/mm) so html2canvas
 * captures at exactly the printer's native column count. The capture is then
 * sent as a PNG to the local print service and rasterised via ESC/POS GS v 0.
 * That path supports full Arabic shaping/RTL — the previous Latin-1 text
 * pipeline is gone.
 */

export interface Invoice80Item {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Invoice80Props {
  invoiceNumber: string;
  date: string;
  time: string;
  cashier: string;
  branch: string;
  items: Invoice80Item[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod?: string;
  qrValue?: string;
}

export const INVOICE_80_WIDTH_PX = 576;

export default function Invoice80({
  invoiceNumber,
  date,
  time,
  cashier,
  branch,
  items,
  subtotal,
  discount,
  vat,
  total,
  paymentMethod,
  qrValue,
}: Invoice80Props) {
  const fmt = (n: number) => `${(Number(n) || 0).toFixed(3)} ر.ع`;

  return (
    <div
      dir="rtl"
      data-invoice="80mm"
      style={{
        width: `${INVOICE_80_WIDTH_PX}px`,
        background: "#ffffff",
        color: "#000000",
        padding: "16px 18px 20px",
        fontFamily: "'Tajawal','Cairo','Noto Naskh Arabic',sans-serif",
        fontSize: 16,
        lineHeight: 1.35,
        boxSizing: "border-box",
      }}
    >
      {/* ── 1. Header (الشعار + معلومات المتجر كصورة واحدة) ───────────────── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <img
          src="/header-lamst-anotha.png"
          alt="Lamst Anotha"
          crossOrigin="anonymous"
          style={{ width: "100%", maxWidth: 540, display: "block" }}
        />
      </div>

      {/* ── 2. صف التاريخ + رقم الفاتورة ─────────────────────────────────── */}
      <MetaRow80
        leftLabel="التاريخ والوقت"
        leftValue={`${date} - ${time}`}
        rightLabel="رقم الفاتورة"
        rightValue={invoiceNumber}
        rightHighlight
      />
      <MetaRow80
        leftLabel="الفرع"
        leftValue={branch || "—"}
        rightLabel="الكاشير"
        rightValue={cashier || "—"}
      />

      {/* ── 3. جدول الأصناف ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 10 }}>
        {/* رأس الجدول (شريط أسود) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 70px 90px 100px",
            background: "#000",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <div style={{ padding: "6px 4px", textAlign: "center" }}>م</div>
          <div style={{ padding: "6px 8px", textAlign: "right" }}>الصنف</div>
          <div style={{ padding: "6px 4px", textAlign: "center" }}>الكمية</div>
          <div style={{ padding: "6px 6px", textAlign: "left" }}>السعر</div>
          <div style={{ padding: "6px 6px", textAlign: "left" }}>الإجمالي</div>
        </div>

        {/* صفوف الأصناف */}
        {items.map((it, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 70px 90px 100px",
              fontSize: 16,
              padding: "8px 0",
              borderTop: idx > 0 ? "1px dashed #888" : "none",
            }}
          >
            <div style={{ textAlign: "center" }}>{idx + 1}</div>
            <div style={{ textAlign: "right", paddingRight: 8 }}>{it.name}</div>
            <div style={{ textAlign: "center" }}>{it.qty}</div>
            <div style={{ textAlign: "left", paddingLeft: 6 }}>
              {(Number(it.unitPrice) || 0).toFixed(3)}
            </div>
            <div style={{ textAlign: "left", paddingLeft: 6 }}>
              {(Number(it.total) || 0).toFixed(3)}
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. ملخص (مجموع، خصم، ضريبة) ──────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid #bbb",
          marginTop: 6,
          paddingTop: 6,
          fontSize: 16,
        }}
      >
        <SummaryRow80 label="المجموع الفرعي" value={fmt(subtotal)} />
        <SummaryRow80 label="الخصم" value={fmt(discount)} />
        <SummaryRow80 label="ضريبة القيمة المضافة (5%)" value={fmt(vat)} />
      </div>

      {/* ── 5. الإجمالي (شريط أسود) ─────────────────────────────────────── */}
      <div
        style={{
          background: "#000",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          marginTop: 8,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <span>الإجمالي</span>
        <span>{fmt(total)}</span>
      </div>

      {paymentMethod ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            marginTop: 4,
            color: "#444",
          }}
        >
          <span>طريقة الدفع</span>
          <span>{paymentMethod}</span>
        </div>
      ) : null}

      {/* ── 6. سطر QR + النصين الجانبيين ─────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 110px 1fr",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
        }}
      >
        <div style={{ textAlign: "right", fontSize: 13, color: "#555", lineHeight: 1.3 }}>
          <div>جودة وأناقة</div>
          <div>تليق بكِ</div>
        </div>
        <div
          style={{
            width: 110,
            height: 110,
            background: "#fff",
            border: "1px solid #000",
            padding: 4,
          }}
        >
          <QRPattern80 value={qrValue || invoiceNumber} />
        </div>
        <div style={{ textAlign: "left", fontSize: 13, color: "#555", lineHeight: 1.3 }}>
          <div>تسوقي الآن</div>
          <div>مع لمسة أنوثة</div>
        </div>
      </div>

      {/* ── 7. شكر ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 12,
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <Heart style={{ width: 14, height: 14, fill: "#000" }} strokeWidth={0} />
        <span>شكراً لثقتكم — نسعد بخدمتكم دائماً</span>
        <Heart style={{ width: 14, height: 14, fill: "#000" }} strokeWidth={0} />
      </div>
    </div>
  );
}

function MetaRow80({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  rightHighlight = false,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  rightHighlight?: boolean;
}) {
  const cellStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    padding: "4px 2px",
    borderBottom: "1px dotted #bbb",
    fontSize: 14,
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
      <div style={cellStyle}>
        <span style={{ color: "#666" }}>{leftLabel}</span>
        <span style={{ fontWeight: 700 }}>{leftValue}</span>
      </div>
      <div style={cellStyle}>
        <span style={{ color: "#666" }}>{rightLabel}</span>
        <span
          style={{
            fontWeight: 700,
            letterSpacing: rightHighlight ? "0.04em" : undefined,
          }}
        >
          {rightValue}
        </span>
      </div>
    </div>
  );
}

function SummaryRow80({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Pseudo-QR placeholder — same generative pattern used in the previous
 * Invoice. A real `qrcode` package can replace this without changing the
 * layout dimensions (110×110 px).
 */
function QRPattern80({ value }: { value: string }) {
  const size = 25;
  const cells: boolean[] = new Array(size * size);
  let seed = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    cells[i] = ((seed >>> 17) & 1) === 1;
  }
  const stamp = (r: number, c: number) => {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        const border = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const center = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const blank =
          ((dr === 1 || dr === 5) && dc >= 1 && dc <= 5) ||
          ((dc === 1 || dc === 5) && dr >= 1 && dr <= 5);
        cells[(r + dr) * size + (c + dc)] = border || center ? true : blank ? false : cells[(r + dr) * size + (c + dc)];
      }
    }
  };
  stamp(0, 0);
  stamp(0, size - 7);
  stamp(size - 7, 0);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      shapeRendering="crispEdges"
      aria-label="QR placeholder"
    >
      <rect width={size} height={size} fill="#fff" />
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={i % size}
            y={Math.floor(i / size)}
            width={1}
            height={1}
            fill="#000"
          />
        ) : null,
      )}
    </svg>
  );
}
