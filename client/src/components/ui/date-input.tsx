import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * DateInput — تحل محل <Input type="date"> في كل الموقع.
 * تعرض التاريخ كنص DD/MM/YYYY بأرقام إنجليزية دائماً.
 * التقويم المنبثق مبني بـ react-day-picker (لا native picker) —
 * يحل نهائياً مشكلة الأرقام العربية في Chrome/Edge على الأجهزة العربية.
 *
 * القيمة المُرسَلة/المُستلمة: YYYY-MM-DD (متوافقة مع <input type="date">).
 */

interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      className,
      value = "",
      onChange,
      disabled,
      placeholder = "DD/MM/YYYY",
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const { t } = useI18n();

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

    // يحوّل YYYY-MM-DD → Date object
    function toDate(iso: string): Date | undefined {
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    }

    // يحوّل Date → YYYY-MM-DD
    function fromDate(date: Date): string {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const [displayVal, setDisplayVal] = React.useState(toDisplay(value));

    // مزامنة عند تغيير الـ value الخارجية
    React.useEffect(() => {
      setDisplayVal(toDisplay(value));
    }, [value]);

    // إطلاق onChange مع قيمة ISO
    function fireChange(
      e: React.SyntheticEvent,
      iso: string
    ) {
      if (!onChange) return;
      const syntheticEvent = {
        ...e,
        target: { ...(e.target as HTMLInputElement), value: iso },
        currentTarget: { ...(e.currentTarget as HTMLInputElement), value: iso },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }

    // عند الكتابة اليدوية
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
      if (iso) fireChange(e, iso);
    }

    // عند اختيار يوم من التقويم
    function handleDaySelect(day: Date | undefined) {
      if (!day) return;
      const iso = fromDate(day);
      setDisplayVal(toDisplay(iso));
      setOpen(false);

      // نطلق onChange بحدث اصطناعي
      const fakeEvent = {
        target: { value: iso },
        currentTarget: { value: iso },
      } as React.ChangeEvent<HTMLInputElement>;
      if (onChange) onChange(fakeEvent);
    }

    const selectedDate = toDate(value);

    return (
      <div className="relative">
        {/* حقل النص الظاهر — DD/MM/YYYY بأرقام إنجليزية دائماً */}
        <input
          ref={ref}
          type="text"
          dir="ltr"
          lang="en"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={10}
          value={displayVal}
          onChange={handleTextChange}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 ps-10 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />

        {/* زر فتح التقويم */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              className="absolute left-0 top-0 h-full px-2.5 flex items-center border-r border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 rounded-l-md"
              aria-label={t("pick_date")}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              defaultMonth={selectedDate}
              captionLayout="dropdown"
              fromYear={2020}
              toYear={2035}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

DateInput.displayName = "DateInput";
