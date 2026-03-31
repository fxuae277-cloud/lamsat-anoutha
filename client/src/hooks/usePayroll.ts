import { useContext } from "react";
import { PayrollContext } from "../providers/PayrollProvider";
import type { PayrollContextType } from "../lib/payroll-types";

export function usePayroll(): PayrollContextType {
  const ctx = useContext(PayrollContext);
  if (!ctx) {
    throw new Error("usePayroll يجب أن يُستخدم داخل PayrollProvider");
  }
  return ctx;
}
