import * as React from "react"

import { cn } from "@/lib/utils"

const AR_INDIC = /[\u0660-\u0669]/g;
const AR_EXT_INDIC = /[\u06F0-\u06F9]/g;

function normalizeDigits(val: string): string {
  return val
    .replace(AR_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(AR_EXT_INDIC, (c) => String(c.charCodeAt(0) - 0x06F0));
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, ...props }, ref) => {
    const isNumeric = type === "number";
    const isDate = type === "date";

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const normalized = normalizeDigits(e.target.value);
        if (normalized !== e.target.value) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(e.target, normalized);
          }
          e.target.value = normalized;
        }
        onChange?.(e);
      },
      [onChange]
    );

    return (
      <input
        type={isNumeric ? "text" : type}
        inputMode={isNumeric ? "decimal" : undefined}
        dir={isNumeric || isDate ? "ltr" : undefined}
        lang={isDate ? "en" : undefined}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
