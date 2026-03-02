import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import arMessages from "@/locales/ar.json";
import enMessages from "@/locales/en.json";

type Lang = "ar" | "en";
type Messages = typeof arMessages;

const messages: Record<Lang, Messages> = { ar: arMessages, en: enMessages };

interface I18nContextType {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: any, path: string): string {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return path;
    current = current[part];
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const cached = typeof localStorage !== "undefined" ? localStorage.getItem("ui_language") as Lang : null;
  const [lang, setLangState] = useState<Lang>(initialLang || cached || "ar");

  const dir = lang === "ar" ? "rtl" : "ltr";

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("ui_language", newLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.style.direction = dir;
    document.body.style.textAlign = lang === "ar" ? "right" : "left";
  }, [lang, dir]);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages[lang], key);
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export type { Lang };
