import { pool } from "./db";

const ACCOUNT_CODES: Record<string, string> = {
  CASH: "1101",
  BANK: "1102",
  INVENTORY: "1301",
  SUPPLIER_PAYABLES: "2101",
  VAT_PAYABLE: "2200",
  SALES_REVENUE: "4100",
  SALES_RETURNS: "4200",
  COGS: "5100",
  EMPLOYEE_ADVANCES: "1401",
  SALARY_EXPENSES: "5200",
  GENERAL_EXPENSES: "5400",
};

async function getAccountId(code: string): Promise<number | null> {
  const result = await pool.query(`SELECT id FROM accounts WHERE code = $1`, [code]);
  return result.rows[0]?.id || null;
}

async function getNextEntryNumber(): Promise<string> {
  const result = await pool.query(`SELECT COUNT(*) as cnt FROM journal_entries`);
  const count = parseInt(result.rows[0].cnt) + 1;
  return `JE-${count.toString().padStart(5, "0")}`;
}

interface AutoJournalParams {
  date: string;
  description: string;
  sourceType: string;
  sourceId: number;
  branchId: number | null;
  createdBy: number | null;
  lines: { accountCode: string; debit: number; credit: number; description?: string }[];
}

export async function createAutoJournal(params: AutoJournalParams): Promise<number | null> {
  const { date, description, sourceType, sourceId, branchId, createdBy, lines } = params;

  const existing = await pool.query(
    `SELECT id FROM journal_entries WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const resolvedLines: { accountId: number; debit: number; credit: number; desc?: string }[] = [];
  for (const line of lines) {
    if (line.debit === 0 && line.credit === 0) continue;
    const accountId = await getAccountId(line.accountCode);
    if (!accountId) {
      console.error(`[AutoJournal] Account code ${line.accountCode} not found — skipping journal for ${sourceType}:${sourceId}`);
      return null;
    }
    resolvedLines.push({ accountId, debit: line.debit, credit: line.credit, desc: line.description });
  }

  if (resolvedLines.length === 0) return null;

  const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error(`[AutoJournal] Unbalanced entry for ${sourceType}:${sourceId} — D:${totalDebit} C:${totalCredit}`);
    return null;
  }

  const entryNumber = await getNextEntryNumber();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const entryRes = await client.query(
      `INSERT INTO journal_entries (entry_number, date, description, status, source_type, source_id, total_debit, total_credit, branch_id, created_by, posted_at)
       VALUES ($1, $2, $3, 'posted', $4, $5, $6, $7, $8, $9, NOW()) RETURNING id`,
      [entryNumber, date, description, sourceType, sourceId,
       totalDebit.toFixed(3), totalCredit.toFixed(3), branchId, createdBy]
    );
    const entryId = entryRes.rows[0].id;

    for (const line of resolvedLines) {
      await client.query(
        `INSERT INTO journal_entry_lines (entry_id, account_id, debit, credit, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [entryId, line.accountId, line.debit.toFixed(3), line.credit.toFixed(3), line.desc || null]
      );
    }

    await client.query("COMMIT");
    return entryId;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[AutoJournal] Error creating entry for ${sourceType}:${sourceId}:`, err);
    return null;
  } finally {
    client.release();
  }
}

export async function journalForSale(sale: {
  id: number;
  invoiceNumber: string;
  total: string;
  vat: string;
  paymentMethod: string;
  branchId: number;
  cashierId: number | null;
  cogsTotal?: string;
  createdAt?: Date | string;
}) {
  const total = parseFloat(sale.total || "0");
  const vat = parseFloat(sale.vat || "0");
  const cogs = parseFloat(sale.cogsTotal || "0");
  const netSales = total - vat;
  if (total <= 0) return;

  const cashOrBank = (sale.paymentMethod === "cash" || sale.paymentMethod === "card") ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
  const date = sale.createdAt ? new Date(sale.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const desc = `فاتورة بيع ${sale.invoiceNumber}`;

  const lines: AutoJournalParams["lines"] = [
    { accountCode: cashOrBank, debit: total, credit: 0, description: desc },
    { accountCode: ACCOUNT_CODES.SALES_REVENUE, debit: 0, credit: netSales, description: desc },
  ];
  if (vat > 0) {
    lines.push({ accountCode: ACCOUNT_CODES.VAT_PAYABLE, debit: 0, credit: vat, description: `ضريبة - ${sale.invoiceNumber}` });
  }
  if (cogs > 0) {
    lines.push({ accountCode: ACCOUNT_CODES.COGS, debit: cogs, credit: 0, description: `تكلفة بضاعة - ${sale.invoiceNumber}` });
    lines.push({ accountCode: ACCOUNT_CODES.INVENTORY, debit: 0, credit: cogs, description: `خروج مخزون - ${sale.invoiceNumber}` });
  }

  await createAutoJournal({
    date,
    description: desc,
    sourceType: "sale",
    sourceId: sale.id,
    branchId: sale.branchId,
    createdBy: sale.cashierId,
    lines,
  });
}

export async function journalForExpense(expense: {
  id: number;
  category: string;
  amount: string;
  source: string;
  date: string;
  branchId: number;
  createdBy: number | null;
  notes?: string | null;
}) {
  const amount = parseFloat(expense.amount || "0");
  if (amount <= 0) return;

  const cashOrBank = (expense.source === "cash" || expense.source === "card") ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
  const desc = `مصروف: ${expense.category}${expense.notes ? " - " + expense.notes : ""}`;

  await createAutoJournal({
    date: expense.date,
    description: desc,
    sourceType: "expense",
    sourceId: expense.id,
    branchId: expense.branchId,
    createdBy: expense.createdBy,
    lines: [
      { accountCode: ACCOUNT_CODES.GENERAL_EXPENSES, debit: amount, credit: 0, description: desc },
      { accountCode: cashOrBank, debit: 0, credit: amount, description: desc },
    ],
  });
}

export async function journalForPurchase(purchase: {
  id: number;
  invoiceNumber: string;
  grandTotal: string;
  supplierId: number;
  branchId: number | null;
  createdBy: number | null;
  invoiceDate: string;
}) {
  const total = parseFloat(purchase.grandTotal || "0");
  if (total <= 0) return;

  const desc = `فاتورة شراء ${purchase.invoiceNumber}`;

  await createAutoJournal({
    date: purchase.invoiceDate,
    description: desc,
    sourceType: "purchase",
    sourceId: purchase.id,
    branchId: purchase.branchId ? Number(purchase.branchId) : null,
    createdBy: purchase.createdBy ? Number(purchase.createdBy) : null,
    lines: [
      { accountCode: ACCOUNT_CODES.INVENTORY, debit: total, credit: 0, description: desc },
      { accountCode: ACCOUNT_CODES.SUPPLIER_PAYABLES, debit: 0, credit: total, description: desc },
    ],
  });
}

export async function journalForSaleReturn(ret: {
  id: number;
  returnNumber: string;
  refundAmount: string;
  refundMethod: string;
  cogsReturned: string;
  branchId: number;
  createdBy: number | null;
  saleInvoiceNumber: string;
  createdAt?: Date | string;
}) {
  const refund = parseFloat(ret.refundAmount || "0");
  const cogs = parseFloat(ret.cogsReturned || "0");
  if (refund <= 0) return;

  const cashOrBank = (ret.refundMethod === "cash" || ret.refundMethod === "card") ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
  const date = ret.createdAt ? new Date(ret.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const desc = `مرتجع مبيعات - فاتورة ${ret.saleInvoiceNumber} - مرتجع #${ret.returnNumber}`;

  const lines: AutoJournalParams["lines"] = [
    { accountCode: ACCOUNT_CODES.SALES_RETURNS, debit: refund, credit: 0, description: desc },
    { accountCode: cashOrBank, debit: 0, credit: refund, description: desc },
  ];
  if (cogs > 0) {
    lines.push({ accountCode: ACCOUNT_CODES.INVENTORY, debit: cogs, credit: 0, description: `إعادة مخزون - مرتجع #${ret.returnNumber}` });
    lines.push({ accountCode: ACCOUNT_CODES.COGS, debit: 0, credit: cogs, description: `عكس تكلفة بضاعة - مرتجع #${ret.returnNumber}` });
  }

  await createAutoJournal({
    date,
    description: desc,
    sourceType: "return",
    sourceId: ret.id,
    branchId: ret.branchId,
    createdBy: ret.createdBy,
    lines,
  });
}

export async function journalForSupplierPayment(payment: {
  supplierId: number;
  amount: number;
  method: string;
  branchId: number;
  createdBy: number;
  note?: string;
}) {
  if (payment.amount <= 0) return;

  const cashOrBank = (payment.method === "cash" || payment.method === "card") ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.BANK;
  const date = new Date().toISOString().slice(0, 10);
  const desc = payment.note || `دفعة للمورد #${payment.supplierId}`;

  const uniqueId = Date.now();

  await createAutoJournal({
    date,
    description: desc,
    sourceType: "supplier_payment",
    sourceId: uniqueId,
    branchId: payment.branchId,
    createdBy: payment.createdBy,
    lines: [
      { accountCode: ACCOUNT_CODES.SUPPLIER_PAYABLES, debit: payment.amount, credit: 0, description: desc },
      { accountCode: cashOrBank, debit: 0, credit: payment.amount, description: desc },
    ],
  });
}

export async function journalForSalaryPayment(payment: {
  id: number;
  employeeId: number;
  employeeName: string;
  amount: number;
  paymentMethod: string;
  branchId: number | null;
  paidBy: number;
  month: string;
  year: number;
}) {
  if (payment.amount <= 0) return;

  const date = new Date().toISOString().slice(0, 10);
  const desc = `دفع راتب ${payment.employeeName} - ${payment.month}/${payment.year}`;

  await createAutoJournal({
    date,
    description: desc,
    sourceType: "salary_payment",
    sourceId: payment.id,
    branchId: payment.branchId || 1,
    createdBy: payment.paidBy,
    lines: [
      { accountCode: ACCOUNT_CODES.SALARY_EXPENSES, debit: payment.amount, credit: 0, description: desc },
      { accountCode: ACCOUNT_CODES.BANK, debit: 0, credit: payment.amount, description: desc },
    ],
  });
}

export async function journalForEmployeeAdvance(advance: {
  id: number;
  employeeId: number;
  amount: string;
}, createdBy: number) {
  const amt = parseFloat(advance.amount);
  if (amt <= 0) return;

  const empResult = await pool.query(`SELECT name, branch_id FROM users WHERE id = $1`, [advance.employeeId]);
  const empName = empResult.rows[0]?.name || "موظف";
  const branchId = empResult.rows[0]?.branch_id || 1;
  const date = new Date().toISOString().slice(0, 10);
  const desc = `سلفة موظف: ${empName}`;

  await createAutoJournal({
    date,
    description: desc,
    sourceType: "employee_advance",
    sourceId: advance.id,
    branchId,
    createdBy,
    lines: [
      { accountCode: ACCOUNT_CODES.EMPLOYEE_ADVANCES, debit: amt, credit: 0, description: desc },
      { accountCode: ACCOUNT_CODES.CASH, debit: 0, credit: amt, description: desc },
    ],
  });
}
