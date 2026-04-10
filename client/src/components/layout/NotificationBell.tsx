import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  creator_name: string | null;
}

function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

const TYPE_ICON: Record<string, string> = {
  invoice_return: "↩️",
  low_stock: "⚠️",
};

export function NotificationBell() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // عدد الإشعارات غير المقروءة — يُحدَّث كل 30 ثانية
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/count"],
    queryFn: () => fetch("/api/notifications/count", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const unread = countData?.count ?? 0;

  // قائمة الإشعارات — تُجلب عند فتح القائمة
  const { data: notifications = [], isFetching } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => fetch("/api/notifications?limit=20", { credentials: "include" }).then(r => r.json()),
    enabled: open && isOwner,
    staleTime: 0,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute left-0 top-full mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {/* رأس القائمة */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">الإشعارات</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  قراءة الكل
                </button>
              )}
              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ["/api/notifications"] });
                  qc.invalidateQueries({ queryKey: ["/api/notifications/count"] });
                }}
                className="text-muted-foreground hover:text-foreground"
                title="تحديث"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* قائمة الإشعارات */}
          <div className="max-h-96 overflow-y-auto">
            {isFetching && notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</div>
            ) : !isOwner ? (
              <div className="py-8 text-center text-sm text-muted-foreground">الإشعارات للمالك فقط</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${
                    n.is_read ? "bg-background" : "bg-primary/5"
                  }`}
                >
                  <div className="shrink-0 text-xl mt-0.5">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.is_read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{fmtTimeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                      className="shrink-0 text-primary hover:text-primary/70 mt-0.5"
                      title="تحديد كمقروء"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
