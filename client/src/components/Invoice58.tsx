import { Heart } from "lucide-react";

/**
 * Invoice58.tsx — 58mm thermal receipt layout.
 *
 * Pixel width is locked to 384px (= 48mm printable × 8 dots/mm) so html2canvas
 * captures at exactly the printer's native column count. The narrower paper
 * forces a vertical layout: each item's name sits on its own line, with
 * "qty × unit = total" on the next line right-aligned. The boxed total bar,
 * QR strip, and thank-you line all stack vertically — the receipt grows
 * downward instead of trying to fit columns into 384px.
 */

export interface Invoice58Item {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Invoice58Props {
  invoiceNumber: string;
  date: string;
  time: string;
  cashier: string;
  branch: string;
  items: Invoice58Item[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod?: string;
  qrValue?: string;
}

export const INVOICE_58_WIDTH_PX = 384;

export default function Invoice58({
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
}: Invoice58Props) {
  const fmt = (n: number) => `${(Number(n) || 0).toFixed(3)} ر.ع`;

  return (
    <div
      dir="rtl"
      data-invoice="58mm"
      style={{
        width: `${INVOICE_58_WIDTH_PX}px`,
        background: "#ffffff",
        color: "#000000",
        padding: "10px 12px 14px",
        fontFamily: "'Tajawal','Cairo','Noto Naskh Arabic',sans-serif",
        fontSize: 13,
        lineHeight: 1.35,
        boxSizing: "border-box",
      }}
    >
      {/* ── 1. Header ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <img
          src="/header-lamst-anotha.png"
          alt="Lamst Anotha"
          crossOrigin="anonymous"
          style={{ width: "100%", maxWidth: 360, display: "block" }}
        />
      </div>

      {/* ── 2. ميتا: التاريخ + رقم الفاتورة (سطران منفصلان) ─────────────── */}
      <MetaLine58 label="التاريخ والوقت" value={`${date} - ${time}`} />
      <MetaLine58 label="رقم الفاتورة" value={invoiceNumber} highlight />
      <MetaLine58 label="الفرع" value={branch || "—"} />
      <MetaLine58 label="الكاشير" value={cashier || "—"} />

      {/* ── 3. عنوان الأصناف ────────────────────────────────────────────── */}
      <div
        style={{
          background: "#000",
          color: "#fff",
          textAlign: "center",
          fontWeight: 700,
          fontSize: 13,
          padding: "4px 6px",
          marginTop: 8,
        }}
      >
        الأصناف
      </div>

      {/* ── 4. صفوف الأصناف (vertical: اسم في سطر، تفاصيل في سطر) ───────── */}
      <div>
        {items.map((it, idx) => (
          <div
            key={idx}
            style={{
              padding: "6px 0",
              borderBottom:
                idx < items.length - 1 ? "1px dashed #888" : "1px solid #000",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span style={{ color: "#666", marginLeft: 6 }}>{idx + 1}.</span>
              <span style={{ flex: 1, textAlign: "right" }}>{it.name}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginTop: 2,
                color: "#222",
              }}
            >
              <span>
                {it.qty} × {(Number(it.unitPrice) || 0).toFixed(3)}
              </span>
              <span style={{ fontWeight: 700 }}>
                {(Number(it.total) || 0).toFixed(3)} ر.ع
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. الملخص ───────────────────────────────────────────────────── */}
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <SumLine58 label="المجموع الفرعي" value={fmt(subtotal)} />
        <SumLine58 label="الخصم" value={fmt(discount)} />
        <SumLine58 label="ضريبة القيمة المضافة (5%)" value={fmt(vat)} />
      </div>

      {/* ── 6. الإجمالي (شريط أسود) ─────────────────────────────────────── */}
      <div
        style={{
          background: "#000",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          marginTop: 6,
          fontSize: 16,
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
            fontSize: 12,
            marginTop: 4,
            color: "#444",
          }}
        >
          <span>طريقة الدفع</span>
          <span>{paymentMethod}</span>
        </div>
      ) : null}

      {/* ── 7. QR وحده في سطر مركزي ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          marginTop: 12,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            background: "#fff",
            border: "1px solid #000",
            padding: 3,
          }}
        >
          <QRPattern58 value={qrValue || invoiceNumber} />
        </div>
        <div style={{ fontSize: 12, color: "#555", textAlign: "center", marginTop: 4 }}>
          تسوقي الآن مع لمسة أنوثة
        </div>
        <div style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
          جودة وأناقة تليق بكِ
        </div>
      </div>

      {/* ── 8. الشكر ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 10,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <Heart style={{ width: 11, height: 11, fill: "#000" }} strokeWidth={0} />
        <span>شكراً لثقتكم</span>
        <Heart style={{ width: 11, height: 11, fill: "#000" }} strokeWidth={0} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12, marginTop: 2 }}>
        نسعد بخدمتكم دائماً
      </div>
    </div>
  );
}

function MetaLine58({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontSize: 12,
        padding: "2px 0",
        borderBottom: "1px dotted #bbb",
      }}
    >
      <span style={{ color: "#666" }}>{label}</span>
      <span
        style={{
          fontWeight: 700,
          letterSpacing: highlight ? "0.04em" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SumLine58({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QRPattern58({ value }: { value: string }) {
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
