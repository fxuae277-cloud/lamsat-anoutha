import { Heart } from "lucide-react";

export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceProps {
  invoiceNumber?: string;
  date?: string;
  time?: string;
  cashier?: string;
  branch?: string;
  /** @deprecated القيمة مدمجة الآن في صورة الهيدر (header-lamst-anotha.png) */
  commercialRegister?: string;
  /** @deprecated القيمة مدمجة الآن في صورة الهيدر (header-lamst-anotha.png) */
  instagram?: string;
  /** @deprecated القيمة مدمجة الآن في صورة الهيدر (header-lamst-anotha.png) */
  phone?: string;
  items?: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  vatRate?: number;
  qrValue?: string;
  /** @deprecated الشعار الآن جزء من صورة الهيدر (header-lamst-anotha.png) */
  logoSrc?: string;
}

const DEFAULT_ITEMS: InvoiceItem[] = [
  { name: "حلق دائري ذهبي", qty: 1, unitPrice: 1.6, total: 1.6 },
  { name: "سوار فضي ناعم", qty: 1, unitPrice: 2.5, total: 2.5 },
  { name: "عقد لؤلؤ طبيعي", qty: 1, unitPrice: 3.9, total: 3.9 },
];

export default function Invoice({
  invoiceNumber = "INV-00017",
  date = "25/04/2026",
  time = "09:12 AM",
  cashier = "ahmed",
  branch = "الفرع الرئيسي",
  items = DEFAULT_ITEMS,
  subtotal = 8.0,
  discount = 0.0,
  vatRate = 0.05,
  qrValue,
}: InvoiceProps) {
  const fmt = (n: number) => `${n.toFixed(3)} ر.ع`;
  const vat = +(subtotal * vatRate).toFixed(3);
  const total = +(subtotal - discount + vat).toFixed(3);

  return (
    <div
      dir="rtl"
      className="bg-white text-black mx-auto w-full max-w-[420px] px-4 pt-2 pb-3 font-sans print:px-2 print:pt-1 print:pb-2 print:max-w-none print:w-[80mm] print:shadow-none"
      style={{ fontFamily: "'Tajawal','Cairo','Noto Naskh Arabic',sans-serif" }}
    >
      {/* ===== Header (شعار + معلومات المتجر كصورة واحدة) ===== */}
      <div className="flex justify-center">
        <img
          src="/header-lamst-anotha.png"
          alt="Lamst Anotha"
          className="w-full max-w-[720px] object-contain block"
        />
      </div>

      {/* ===== Meta grid: التاريخ | رقم الفاتورة | الفرع | الكاشير ===== */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-[11px] leading-tight">
        <MetaCell label="التاريخ والوقت" value={`${date} - ${time}`} />
        <MetaCell label="رقم الفاتورة" value={invoiceNumber} highlight />
        <MetaCell label="الفرع" value={branch} />
        <MetaCell label="الكاشير" value={cashier} />
      </div>

      {/* ===== Items table ===== */}
      <div className="mt-3">
        {/* Header */}
        <div className="bg-black text-white grid grid-cols-[0.5fr_2.6fr_0.8fr_1.4fr_1.4fr] text-[11px] font-semibold">
          <div className="py-1.5 px-1.5 text-center">م</div>
          <div className="py-1.5 px-1.5 text-right">الصنف</div>
          <div className="py-1.5 px-1.5 text-center">الكمية</div>
          <div className="py-1.5 px-1.5 text-right">السعر</div>
          <div className="py-1.5 px-1.5 text-right">الإجمالي</div>
        </div>

        {/* Rows */}
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[0.5fr_2.6fr_0.8fr_1.4fr_1.4fr] text-[12px] py-1.5 ${
              idx > 0 ? "border-t border-dashed border-gray-400" : ""
            }`}
          >
            <div className="px-1.5 text-center">{idx + 1}</div>
            <div className="px-1.5 text-right">{item.name}</div>
            <div className="px-1.5 text-center">{item.qty}</div>
            <div className="px-1.5 text-right">{item.unitPrice.toFixed(3)}</div>
            <div className="px-1.5 text-right">{item.total.toFixed(3)}</div>
          </div>
        ))}
      </div>

      {/* ===== Summary ===== */}
      <div className="border-t border-gray-300 mt-1.5 pt-1.5 text-[12px] space-y-0.5">
        <SummaryRow label="المجموع الفرعي" value={fmt(subtotal)} />
        <SummaryRow label="الخصم" value={fmt(discount)} />
        <SummaryRow label="ضريبة القيمة المضافة (5%)" value={fmt(vat)} />
      </div>

      {/* Total bar */}
      <div className="bg-black text-white flex justify-between items-center px-3 py-1.5 mt-1.5 text-[14px] font-bold">
        <span>الإجمالي</span>
        <span>{fmt(total)}</span>
      </div>

      {/* ===== Footer: thank-you + QR في صفّ واحد ===== */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-3">
        <div className="text-right text-[10px] text-gray-700 leading-tight">
          <div>جودة وأناقة</div>
          <div>تليق بكِ</div>
        </div>
        <div className="w-[64px] h-[64px] bg-white">
          <QRPattern value={qrValue || invoiceNumber} />
        </div>
        <div className="text-left text-[10px] text-gray-700 leading-tight">
          <div>تسوقي الآن</div>
          <div>مع لمسة أنوثة</div>
        </div>
      </div>

      {/* Thank-you single line */}
      <div className="flex items-center justify-center gap-2 mt-2 text-[12px] font-bold">
        <Heart className="w-2.5 h-2.5 fill-black text-black" strokeWidth={0} />
        <span>شكراً لثقتكم — نسعد بخدمتكم دائماً</span>
        <Heart className="w-2.5 h-2.5 fill-black text-black" strokeWidth={0} />
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-gray-300 pb-0.5">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span
        className={`font-semibold text-black truncate ${
          highlight ? "tracking-wide" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-black">{label}</span>
      <span className="text-black">{value}</span>
    </div>
  );
}

/**
 * Lightweight inline pseudo-QR pattern (visual placeholder).
 * Replace with a real QR library output by passing a custom node where this is rendered.
 */
function QRPattern({ value }: { value: string }) {
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
          (dr === 1 || dr === 5) && dc >= 1 && dc <= 5 ||
          (dc === 1 || dc === 5) && dr >= 1 && dr <= 5;
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
      className="w-full h-full"
      shapeRendering="crispEdges"
      aria-label="QR code"
    >
      <rect width={size} height={size} fill="white" />
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={i % size}
            y={Math.floor(i / size)}
            width={1}
            height={1}
            fill="black"
          />
        ) : null
      )}
    </svg>
  );
}
