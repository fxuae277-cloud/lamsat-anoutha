import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next, I18nextProvider, useTranslation } from "react-i18next";

import arCommon from "@/locales/ar/common.json";
import arNav from "@/locales/ar/nav.json";
import arAuth from "@/locales/ar/auth.json";
import arPos from "@/locales/ar/pos.json";
import arInventory from "@/locales/ar/inventory.json";
import arPurchases from "@/locales/ar/purchases.json";
import arFinance from "@/locales/ar/finance.json";
import arPayroll from "@/locales/ar/payroll.json";
import arReports from "@/locales/ar/reports.json";
import arSettings from "@/locales/ar/settings.json";
import arCustomers from "@/locales/ar/customers.json";

import enCommon from "@/locales/en/common.json";
import enNav from "@/locales/en/nav.json";
import enAuth from "@/locales/en/auth.json";
import enPos from "@/locales/en/pos.json";
import enInventory from "@/locales/en/inventory.json";
import enPurchases from "@/locales/en/purchases.json";
import enFinance from "@/locales/en/finance.json";
import enPayroll from "@/locales/en/payroll.json";
import enReports from "@/locales/en/reports.json";
import enSettings from "@/locales/en/settings.json";
import enCustomers from "@/locales/en/customers.json";

export type Lang = "ar" | "en";

export const NAMESPACES = [
  "common", "nav", "auth", "pos", "inventory", "purchases",
  "finance", "payroll", "reports", "settings", "customers",
] as const;

const STORAGE_KEY = "lamsa_lang";
const LEGACY_STORAGE_KEY = "ui_language";

function readStoredLang(): Lang | null {
  if (typeof localStorage === "undefined") return null;
  const current = localStorage.getItem(STORAGE_KEY);
  if (current === "ar" || current === "en") return current;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === "ar" || legacy === "en") {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  }
  return null;
}

const initialLang: Lang = readStoredLang() ?? "ar";

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources: {
      ar: {
        common: arCommon, nav: arNav, auth: arAuth, pos: arPos,
        inventory: arInventory, purchases: arPurchases, finance: arFinance,
        payroll: arPayroll, reports: arReports, settings: arSettings, customers: arCustomers,
      },
      en: {
        common: enCommon, nav: enNav, auth: enAuth, pos: enPos,
        inventory: enInventory, purchases: enPurchases, finance: enFinance,
        payroll: enPayroll, reports: enReports, settings: enSettings, customers: enCustomers,
      },
    },
    lng: initialLang,
    fallbackLng: "ar",
    ns: [...NAMESPACES],
    defaultNS: "common",
    fallbackNS: [...NAMESPACES],
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

export const i18n: I18nInstance = i18next;

interface I18nContextType {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function htmlLangAttr(lang: Lang): string {
  return lang === "ar" ? "ar-u-nu-latn" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((i18next.language as Lang) || initialLang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const setLang = useCallback((newLang: Lang) => {
    if (newLang !== "ar" && newLang !== "en") return;
    void i18next.changeLanguage(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
    setLangState(newLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = htmlLangAttr(lang);
    document.documentElement.dir = dir;
    document.body.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    const handler = (lng: string) => {
      if (lng === "ar" || lng === "en") setLangState(lng);
    };
    i18next.on("languageChanged", handler);
    return () => i18next.off("languageChanged", handler);
  }, []);

  const t = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      i18next.t(key, options) as string,
    [lang]
  );

  return (
    <I18nextProvider i18n={i18next}>
      <I18nContext.Provider value={{ lang, dir, setLang, t }}>
        {children}
      </I18nContext.Provider>
    </I18nextProvider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export { useTranslation };
