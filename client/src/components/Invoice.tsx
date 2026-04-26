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
      className="bg-white text-black mx-auto w-full max-w-[420px] p-6 font-sans print:p-2 print:max-w-none print:w-[80mm] print:shadow-none"
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

      {/* dashed separator */}
      <div className="border-t border-dashed border-gray-400 my-4" />

      {/* ===== Invoice info bar ===== */}
      <div className="flex justify-between items-stretch">
        {/* Right (RTL start): Date */}
        <div className="py-2 text-right">
          <div className="text-[11px] text-gray-700">التاريخ والوقت</div>
          <div className="text-[13px] font-semibold mt-1">
            {date} - {time}
          </div>
        </div>
        {/* Left (RTL end): Invoice number with black tag */}
        <div className="flex items-stretch">
          <div className="flex items-center px-3 text-[13px] font-semibold">
            {invoiceNumber}
          </div>
          <div className="bg-black text-white flex items-center px-4 text-[12px]">
            رقم الفاتورة
          </div>
        </div>
      </div>

      {/* ===== Cashier / Branch ===== */}
      <div className="flex justify-between items-stretch mt-1">
        <div className="py-2 text-right">
          <div className="text-[11px] text-gray-700">الفرع</div>
          <div className="text-[13px] font-semibold mt-1">{branch}</div>
        </div>
        <div className="py-2 text-right">
          <div className="text-[11px] text-gray-700">الكاشير</div>
          <div className="text-[13px] font-semibold mt-1">{cashier}</div>
        </div>
      </div>

      {/* ===== Items table ===== */}
      <div className="mt-4">
        {/* Header */}
        <div className="bg-black text-white grid grid-cols-[0.6fr_2.6fr_1fr_1.6fr_1.6fr] text-[12px]">
          <div className="py-3 px-2 text-center">م</div>
          <div className="py-3 px-2 text-right">الصنف</div>
          <div className="py-3 px-2 text-center">الكمية</div>
          <div className="py-3 px-2 text-right">سعر الوحدة</div>
          <div className="py-3 px-2 text-right">الإجمالي</div>
        </div>

        {/* Rows */}
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[0.6fr_2.6fr_1fr_1.6fr_1.6fr] text-[13px] py-3 ${
              idx > 0 ? "border-t border-dashed border-gray-400" : ""
            }`}
          >
            <div className="px-2 text-center">{idx + 1}</div>
            <div className="px-2 text-right">{item.name}</div>
            <div className="px-2 text-center">{item.qty}</div>
            <div className="px-2 text-right">{item.unitPrice.toFixed(3)} ر.ع</div>
            <div className="px-2 text-right">{item.total.toFixed(3)} ر.ع</div>
          </div>
        ))}
      </div>

      {/* ===== Summary ===== */}
      <div className="border-t border-gray-300 mt-2 pt-3 text-[13px] space-y-2">
        <SummaryRow label="المجموع الفرعي" value={fmt(subtotal)} />
        <SummaryRow label="الخصم" value={fmt(discount)} />
        <SummaryRow label="ضريبة القيمة المضافة (5%)" value={fmt(vat)} />
      </div>

      {/* Total bar */}
      <div className="bg-black text-white flex justify-between items-center px-4 py-3 mt-3 text-[15px] font-bold">
        <span>الإجمالي</span>
        <span>{fmt(total)}</span>
      </div>

      {/* ===== Thank-you box ===== */}
      <div className="border border-dashed border-gray-400 rounded mt-5 px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-3 text-[14px] font-bold">
          <Heart className="w-3 h-3 fill-black text-black" strokeWidth={0} />
          <span>شكرا لثقتكم بنا</span>
          <Heart className="w-3 h-3 fill-black text-black" strokeWidth={0} />
        </div>
        <div className="text-[12px] mt-2">نسعد بخدمتكم دائما</div>
      </div>

      {/* ===== Footer with QR ===== */}
      <div className="border-t border-gray-300 mt-4 pt-4 grid grid-cols-3 items-center text-[11px]">
        <div className="text-right text-gray-700 leading-snug">
          <div>جودة وأناقة</div>
          <div>تليق بكِ</div>
        </div>
        <div className="flex justify-center">
          <div className="w-[88px] h-[88px] bg-white p-1">
            <QRPattern value={qrValue || invoiceNumber} />
          </div>
        </div>
        <div className="text-left text-gray-700 leading-snug">
          <div>تسوقي الآن</div>
          <div>مع لمسة أنوثة</div>
        </div>
      </div>
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
