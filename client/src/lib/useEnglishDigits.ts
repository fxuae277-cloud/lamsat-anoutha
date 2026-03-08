import { useEffect } from "react";

const AR_INDIC = /[\u0660-\u0669]/g;
const AR_EXT_INDIC = /[\u06F0-\u06F9]/g;

function normalizeValue(val: string): string {
  return val
    .replace(AR_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(AR_EXT_INDIC, (c) => String(c.charCodeAt(0) - 0x06F0));
}

export function useEnglishDigits() {
  useEffect(() => {
    function handleInput(e: Event) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        const original = target.value;
        const normalized = normalizeValue(original);
        if (original !== normalized) {
          const pos = target.selectionStart;
          target.value = normalized;
          const nativeInputValueSetter =
            Object.getOwnPropertyDescriptor(
              target.tagName === "INPUT"
                ? HTMLInputElement.prototype
                : HTMLTextAreaElement.prototype,
              "value"
            )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(target, normalized);
          }
          target.dispatchEvent(new Event("input", { bubbles: true }));
          if (pos !== null) {
            target.setSelectionRange(pos, pos);
          }
        }
      }
    }

    document.addEventListener("input", handleInput, true);
    return () => document.removeEventListener("input", handleInput, true);
  }, []);
}
