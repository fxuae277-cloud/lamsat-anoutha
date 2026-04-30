// ============================================================================
// File: client/src/pages/CashierReceiveTransfers.tsx
// Purpose: صفحة استلام البضاعة للكاشير - مسح باركود لكل قطعة
// ============================================================================

import { useEffect, useRef, useState, useMemo } from "react";

// =====================================================
// أنواع البيانات
// =====================================================
type IncomingTransfer = {
  id: number;
  status: "pending" | "in_transit" | "partially_received";
  created_at: string;
  from_branch_id: number;
  from_branch_name: string;
  total_qty: number;
  received_qty: number;
  items_count: number;
};

type TransferItem = {
  transfer_item_id: number;
  product_id: number;
  quantity: number;
  received_quantity: number;
  product_name: string;
  barcode: string;
  model: string | null;
  color: string | null;
  size: string | null;
  image_url: string | null;
  price: number | null;
  sku: string | null;
};

type TransferDetail = {
  transfer: {
    id: number;
    status: string;
    created_at: string;
    from_branch_name: string;
    to_branch_name: string;
  };
  items: TransferItem[];
};

// =====================================================
// خدمة API
// =====================================================
const api = {
  async list(): Promise<IncomingTransfer[]> {
    const r = await fetch("/api/cashier/incoming-transfers", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    return j.data;
  },
  async detail(id: number): Promise<TransferDetail> {
    const r = await fetch(`/api/cashier/incoming-transfers/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    });
    const j = await r.json();
    if (!j.success) throw new Error(j.error);
    return j.data;
  },
  async scan(transferId: number, barcode: string) {
    const r = await fetch(`/api/cashier/incoming-transfers/${transferId}/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ barcode }),
    });
    return r.json();
  },
  async undo(transferId: number, transferItemId: number) {
    const r = await fetch(`/api/cashier/incoming-transfers/${transferId}/undo-scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ transferItemId }),
    });
    return r.json();
  },
  async finalize(transferId: number, allowPartial: boolean, notes?: string) {
    const r = await fetch(`/api/cashier/incoming-transfers/${transferId}/finalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ allowPartial, notes }),
    });
    return r.json();
  },
};

// =====================================================
// أصوات التغذية الراجعة
// =====================================================
function beep(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
  } catch {}
}

// =====================================================
// المكون الرئيسي
// =====================================================
export default function CashierReceiveTransfers() {
  const [list, setList] = useState<IncomingTransfer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [lastScannedItemId, setLastScannedItemId] = useState<number | null>(null);
  const [showFinalize, setShowFinalize] = useState(false);
  const [notes, setNotes] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  // تحميل القائمة
  const loadList = async () => {
    try {
      setList(await api.list());
    } catch (e: any) {
      setErrMsg(e.message);
    }
  };

  // تحميل التفاصيل
  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const d = await api.detail(id);
      setDetail(d);
    } catch (e: any) {
      setErrMsg(e.message);
    } finally {
      setLoading(false);
      setTimeout(() => barcodeRef.current?.focus(), 100);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  // ملخص التقدم
  const progress = useMemo(() => {
    if (!detail) return { received: 0, total: 0, complete: false };
    const received = detail.items.reduce((s, i) => s + i.received_quantity, 0);
    const total = detail.items.reduce((s, i) => s + i.quantity, 0);
    return { received, total, complete: received >= total && total > 0 };
  }, [detail]);

  // معالجة المسح
  const handleScan = async (barcode: string) => {
    if (!barcode.trim() || !selectedId) return;
    setErrMsg("");
    setOkMsg("");
    const res = await api.scan(selectedId, barcode.trim());
    if (!res.success) {
      beep(false);
      setErrMsg(res.error || "فشل المسح");
      return;
    }
    beep(true);
    setOkMsg(`✓ ${res.data.productName} (${res.data.received}/${res.data.required})`);
    setLastScannedItemId(res.data.transferItemId);
    // تحديث الـ state محلياً (تسريع UX)
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.transfer_item_id === res.data.transferItemId
                ? { ...it, received_quantity: res.data.received }
                : it
            ),
          }
        : prev
    );
    setTimeout(() => setOkMsg(""), 1500);
    setTimeout(() => setLastScannedItemId(null), 800);
  };

  const handleUndo = async (transferItemId: number) => {
    if (!selectedId) return;
    if (!confirm("هل أنت متأكد من التراجع عن آخر مسحة لهذا المنتج؟")) return;
    const res = await api.undo(selectedId, transferItemId);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    await loadDetail(selectedId);
  };

  const handleFinalize = async (allowPartial: boolean) => {
    if (!selectedId) return;
    if (
      !confirm(
        allowPartial
          ? "تأكيد الاستلام مع وجود نقص؟ سيتم تحديث المخزون بالكميات المستلمة فقط."
          : "تأكيد الاستلام النهائي؟ سيتم إضافة البضاعة لمخزون فرعك."
      )
    )
      return;
    const res = await api.finalize(selectedId, allowPartial, notes);
    if (!res.success) {
      setErrMsg(res.error);
      return;
    }
    setOkMsg("تم استلام التحويل بنجاح ✓");
    setShowFinalize(false);
    setSelectedId(null);
    setNotes("");
    await loadList();
  };

  // =====================================================
  // الواجهة
  // =====================================================
  return (
    <div dir="rtl" className="min-h-screen bg-pink-50 p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-rose-700">📦 استلام البضاعة الواردة</h1>
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
            >
              ← الرجوع للقائمة
            </button>
          )}
        </header>

        {errMsg && (
          <div className="mb-3 rounded-lg bg-red-100 p-3 text-red-800">{errMsg}</div>
        )}
        {okMsg && (
          <div className="mb-3 rounded-lg bg-green-100 p-3 text-green-800">{okMsg}</div>
        )}

        {/* قائمة التحويلات الواردة */}
        {!selectedId && (
          <div className="rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold">التحويلات في انتظار الاستلام</h2>
            {list.length === 0 ? (
              <p className="text-gray-500">لا توجد تحويلات واردة حالياً.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-right transition hover:border-rose-400 hover:bg-rose-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-700">تحويل #{t.id}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      <div>المرسل: {t.from_branch_name || "—"}</div>
                      <div>المنتجات: {t.items_count}</div>
                      <div>
                        التقدم: {t.received_qty} / {t.total_qty}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(t.created_at).toLocaleString("ar")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* تفاصيل التحويل المختار */}
        {selectedId && detail && (
          <div className="space-y-4">
            {/* رأس التحويل + شريط التقدم */}
            <div className="rounded-xl bg-white p-4 shadow">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-gray-500">تحويل رقم</div>
                  <div className="text-xl font-bold">#{detail.transfer.id}</div>
                </div>
                <div className="text-sm">
                  <div>من: <b>{detail.transfer.from_branch_name}</b></div>
                  <div>إلى: <b>{detail.transfer.to_branch_name}</b></div>
                </div>
                <div className="text-left">
                  <div className="text-sm text-gray-500">التقدم</div>
                  <div className="text-2xl font-bold text-rose-600">
                    {progress.received} / {progress.total}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{
                    width: `${progress.total ? (progress.received / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* حقل مسح الباركود */}
            <div className="rounded-xl bg-white p-4 shadow">
              <label className="mb-2 block text-sm font-semibold">
                🔍 امسح الباركود (الحقل تلقائي التركيز)
              </label>
              <input
                ref={barcodeRef}
                type="text"
                autoFocus
                placeholder="ضع المؤشر هنا وامسح…"
                className="w-full rounded-lg border-2 border-rose-300 px-4 py-3 text-lg focus:border-rose-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleScan((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                قارئ الباركود يرسل Enter تلقائياً بعد كل قراءة.
              </p>
            </div>

            {/* بطاقات المنتجات */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {detail.items.map((it) => {
                const done = it.received_quantity >= it.quantity;
                const partial = it.received_quantity > 0 && !done;
                const flash = lastScannedItemId === it.transfer_item_id;
                return (
                  <div
                    key={it.transfer_item_id}
                    className={`rounded-xl border-2 bg-white p-3 shadow transition ${
                      flash
                        ? "border-green-500 ring-4 ring-green-200"
                        : done
                        ? "border-green-400 bg-green-50"
                        : partial
                        ? "border-yellow-400 bg-yellow-50"
                        : "border-gray-200"
                    }`}
                  >
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.product_name}
                        className="mb-2 h-36 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-36 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                        لا توجد صورة
                      </div>
                    )}
                    <h3 className="font-bold">{it.product_name}</h3>
                    <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                      <div>
                        <b>الباركود:</b> {it.barcode}
                      </div>
                      {it.model && (
                        <div>
                          <b>الموديل:</b> {it.model}
                        </div>
                      )}
                      {it.color && (
                        <div>
                          <b>اللون:</b> {it.color}
                        </div>
                      )}
                      {it.size && (
                        <div>
                          <b>المقاس:</b> {it.size}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-lg font-bold">
                        <span
                          className={
                            done
                              ? "text-green-600"
                              : partial
                              ? "text-yellow-600"
                              : "text-gray-700"
                          }
                        >
                          {it.received_quantity}
                        </span>
                        <span className="text-gray-400"> / {it.quantity}</span>
                      </div>
                      {it.received_quantity > 0 && (
                        <button
                          onClick={() => handleUndo(it.transfer_item_id)}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200"
                        >
                          تراجع −1
                        </button>
                      )}
                    </div>
                    {done && (
                      <div className="mt-1 text-center text-sm font-bold text-green-600">
                        ✓ مكتمل
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* أزرار التأكيد */}
            <div className="sticky bottom-0 rounded-xl bg-white p-4 shadow-lg">
              {!showFinalize ? (
                <div className="flex gap-2">
                  <button
                    disabled={!progress.complete}
                    onClick={() => setShowFinalize(true)}
                    className="flex-1 rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    ✓ تأكيد الاستلام النهائي
                  </button>
                  {!progress.complete && (
                    <button
                      onClick={() => handleFinalize(true)}
                      className="rounded-lg bg-yellow-500 px-4 py-3 font-bold text-white hover:bg-yellow-600"
                    >
                      تأكيد مع نقص ⚠️
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات (اختياري)"
                    className="w-full rounded-lg border p-2"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFinalize(false)}
                      className="flex-1 rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700"
                    >
                      تأكيد ✓
                    </button>
                    <button
                      onClick={() => setShowFinalize(false)}
                      className="rounded-lg bg-gray-200 px-4 py-3"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && <div className="mt-4 text-center text-gray-500">جاري التحميل…</div>}
      </div>
    </div>
  );
}

// =====================================================
// مكوّن صغير: شارة الحالة
// =====================================================
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "قيد الانتظار", cls: "bg-gray-200 text-gray-700" },
    in_transit: { label: "في الطريق", cls: "bg-blue-100 text-blue-700" },
    partially_received: { label: "استلام جزئي", cls: "bg-yellow-100 text-yellow-700" },
    received: { label: "تم الاستلام", cls: "bg-green-100 text-green-700" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100" };
  return <span className={`rounded px-2 py-0.5 text-xs ${s.cls}`}>{s.label}</span>;
}
