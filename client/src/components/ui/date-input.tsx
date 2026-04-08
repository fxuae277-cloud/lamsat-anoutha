import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DateInput — تحل محل <Input type="date"> في كل الموقع.
 * تعرض التاريخ كنص DD/MM/YYYY بأرقام إنجليزية دائماً بدلاً من
 * الـ native date picker الذي يستخدم أرقام عربية في Chrome/Edge
 * عند ضبط لغة المستند على العربية.
 *
 * القيمة المُرسَلة/المُستلمة: YYYY-MM-DD (متوافقة مع <input type="date">).
 */

interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value = "", onChange, disabled, ...props }, ref) => {
    const hiddenRef = React.useRef<HTMLInputElement>(null);

    // يحوّل YYYY-MM-DD → DD/MM/YYYY
    function toDisplay(iso: string): string {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    }

    // يحوّل DD/MM/YYYY → YYYY-MM-DD
    function toISO(display: string): string {
      const clean = display.replace(/[^\d/]/g, "");
      const parts = clean.split("/");
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return "";
    }

    const [displayVal, setDisplayVal] = React.useState(toDisplay(value));

    // مزامنة عند تغيير الـ value الخارجية
    React.useEffect(() => {
      setDisplayVal(toDisplay(value));
    }, [value]);

    // عند الكتابة اليدوية في حقل النص
    function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
      let raw = e.target.value.replace(/[^\d/]/g, "");

      // إضافة / تلقائياً بعد اليوم والشهر
      if (raw.length === 2 && !raw.includes("/") && displayVal.length < 2) {
        raw = raw + "/";
      } else if (raw.length === 5 && raw.split("/").length === 2) {
        raw = raw + "/";
      }

      setDisplayVal(raw);

      const iso = toISO(raw);
      if (iso && onChange) {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: iso },
          currentTarget: { ...e.currentTarget, value: iso },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }

    // فتح native date picker عند الضغط على الأيقونة
    function openPicker() {
      if (disabled) return;
      const input = hiddenRef.current;
      if (input) {
        input.value = value || "";
        input.showPicker?.();
      }
    }

    // عندما يختار المستخدم تاريخاً من الـ native picker
    function handleHiddenChange(e: React.ChangeEvent<HTMLInputElement>) {
      const iso = e.target.value;
      setDisplayVal(toDisplay(iso));
      if (onChange) onChange(e);
    }

    return (
      <div className="relative">
        {/* حقل النص الظاهر — DD/MM/YYYY بأرقام إنجليزية دائماً */}
        <input
          ref={ref}
          type="text"
          dir="ltr"
          lang="en"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          value={displayVal}
          onChange={handleTextChange}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-10 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />

        {/* زر فتح الـ native picker */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          className="absolute left-0 top-0 h-full px-2.5 flex items-center border-r border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 rounded-l-md"
          aria-label="اختر تاريخ"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        {/* date input مخفي — فقط لفتح native picker */}
        <input
          ref={hiddenRef}
          type="date"
          lang="en"
          tabIndex={-1}
          aria-hidden="true"
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={handleHiddenChange}
        />
      </div>
    );
  }
);

DateInput.displayName = "DateInput";
