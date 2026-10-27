import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "BDT" | "INR" | "CAD" | "AUD" | "JPY";

export interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
  pdfPrefix: string;
  label: string;
  decimals: number;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", symbol: "$", pdfPrefix: "USD $", label: "USD ($) — US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", pdfPrefix: "EUR ", label: "EUR (€) — Euro", decimals: 2 },
  { code: "GBP", symbol: "£", pdfPrefix: "GBP £", label: "GBP (£) — British Pound", decimals: 2 },
  { code: "BDT", symbol: "৳", pdfPrefix: "BDT ", label: "BDT (৳) — Bangladeshi Taka", decimals: 2 },
  { code: "INR", symbol: "₹", pdfPrefix: "INR ", label: "INR (₹) — Indian Rupee", decimals: 2 },
  {
    code: "CAD",
    symbol: "CA$",
    pdfPrefix: "CAD $",
    label: "CAD (CA$) — Canadian Dollar",
    decimals: 2,
  },
  {
    code: "AUD",
    symbol: "A$",
    pdfPrefix: "AUD $",
    label: "AUD (A$) — Australian Dollar",
    decimals: 2,
  },
  { code: "JPY", symbol: "¥", pdfPrefix: "JPY ¥", label: "JPY (¥) — Japanese Yen", decimals: 0 },
];

export function getCurrencyOption(code: CurrencyCode): CurrencyOption {
  return CURRENCY_OPTIONS.find((c) => c.code === code) ?? CURRENCY_OPTIONS[0]!;
}

export function formatMoney(
  amount: number,
  currencyCode: CurrencyCode = "USD",
  forPdf = false,
): string {
  const opt = getCurrencyOption(currencyCode);
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const formattedNumber = abs.toLocaleString("en-US", {
    minimumFractionDigits: opt.decimals,
    maximumFractionDigits: opt.decimals,
  });
  const prefix = forPdf ? opt.pdfPrefix : opt.symbol;
  return `${sign}${prefix}${formattedNumber}`;
}

export interface BusinessProfile {
  businessName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  accentColor: "lime" | "ink" | "emerald" | "blue";
}

export interface CustomerDetails {
  name: string;
  company: string;
  email: string;
  address: string;
}

export interface DocumentLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type DiscountMode = "percent" | "fixed";

export interface CommercialDocumentData {
  kind: "invoice" | "quotation";
  documentNumber: string;
  projectTitle?: string;
  issueDate: string;
  dueOrValidDate: string;
  currency: CurrencyCode;
  business: BusinessProfile;
  customer: CustomerDetails;
  items: DocumentLineItem[];
  discountMode: DiscountMode;
  discountValue: number;
  taxLabel: string;
  taxRatePercent: number;
  notes: string;
  termsOrPaymentInstructions: string;
}

export interface DocumentTotalsResult {
  ok: boolean;
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number;
  validationErrors: string[];
}

export function roundCurrency(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateDocumentTotals(
  doc: Pick<
    CommercialDocumentData,
    "items" | "discountMode" | "discountValue" | "taxRatePercent" | "currency"
  >,
): DocumentTotalsResult {
  const opt = getCurrencyOption(doc.currency);
  const decimals = opt.decimals;
  const validationErrors: string[] = [];

  if (!doc.items || doc.items.length === 0) {
    validationErrors.push("At least one line item is required.");
  }

  const lineTotals: number[] = [];
  let rawSubtotal = 0;

  doc.items.forEach((item, idx) => {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      validationErrors.push(`Line item #${idx + 1} has an invalid or negative quantity.`);
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      validationErrors.push(`Line item #${idx + 1} has an invalid or negative unit price.`);
    }
    const q = Math.max(0, Number.isFinite(item.quantity) ? item.quantity : 0);
    const p = Math.max(0, Number.isFinite(item.unitPrice) ? item.unitPrice : 0);
    const lineTotal = roundCurrency(q * p, decimals);
    lineTotals.push(lineTotal);
    rawSubtotal += lineTotal;
  });

  const subtotal = roundCurrency(rawSubtotal, decimals);

  if (!Number.isFinite(doc.discountValue) || doc.discountValue < 0) {
    validationErrors.push("Discount cannot be negative.");
  }
  if (doc.discountMode === "percent" && doc.discountValue > 100) {
    validationErrors.push("Percentage discount cannot exceed 100%.");
  }
  if (doc.discountMode === "fixed" && doc.discountValue > subtotal && subtotal > 0) {
    validationErrors.push("Fixed discount cannot exceed the subtotal.");
  }

  let discountAmount = 0;
  const cleanDiscountVal = Math.max(0, Number.isFinite(doc.discountValue) ? doc.discountValue : 0);
  if (doc.discountMode === "percent") {
    const clampedPct = Math.min(100, cleanDiscountVal);
    discountAmount = roundCurrency(subtotal * (clampedPct / 100), decimals);
  } else {
    discountAmount = roundCurrency(Math.min(subtotal, cleanDiscountVal), decimals);
  }

  const taxableAmount = roundCurrency(Math.max(0, subtotal - discountAmount), decimals);

  if (!Number.isFinite(doc.taxRatePercent) || doc.taxRatePercent < 0) {
    validationErrors.push("Tax rate cannot be negative.");
  }
  if (doc.taxRatePercent > 100) {
    validationErrors.push("Tax rate cannot exceed 100%.");
  }

  const cleanTaxRate = Math.min(
    100,
    Math.max(0, Number.isFinite(doc.taxRatePercent) ? doc.taxRatePercent : 0),
  );
  const taxAmount = roundCurrency(taxableAmount * (cleanTaxRate / 100), decimals);
  const grandTotal = roundCurrency(taxableAmount + taxAmount, decimals);

  return {
    ok: validationErrors.length === 0,
    lineTotals,
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    grandTotal,
    validationErrors,
  };
}

/**
 * Replaces characters outside WinAnsi (StandardFonts.Helvetica) with safe ASCII equivalents
 * so pdf-lib never throws an encoding error on user input.
 */
function toSafePdfText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const result: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxCharsPerLine) {
        current += ` ${word}`;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current) {
      result.push(current);
    }
  }
  return result;
}

/**
 * Generates a real, multi-section commercial Invoice or Quotation PDF in the browser
 * using pdf-lib.
 */
export async function generateCommercialDocumentPdf(
  doc: CommercialDocumentData,
): Promise<Uint8Array> {
  const totals = calculateDocumentTotals(doc);
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const margin = 48;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const accentPalette = {
    lime: { bg: rgb(0.84, 0.96, 0.22), text: rgb(0.08, 0.09, 0.08) },
    ink: { bg: rgb(0.11, 0.12, 0.14), text: rgb(1, 1, 1) },
    emerald: { bg: rgb(0.06, 0.48, 0.35), text: rgb(1, 1, 1) },
    blue: { bg: rgb(0.12, 0.32, 0.68), text: rgb(1, 1, 1) },
  }[doc.business.accentColor ?? "lime"];

  // Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 56,
    width: pageWidth - margin * 2,
    height: 56,
    color: accentPalette.bg,
  });

  const docTitle = doc.kind === "invoice" ? "INVOICE" : "QUOTATION";
  page.drawText(docTitle, {
    x: margin + 18,
    y: y - 34,
    size: 20,
    font: fontBold,
    color: accentPalette.text,
  });

  const numberLabel = `#${toSafePdfText(doc.documentNumber || "001")}`;
  const numWidth = fontBold.widthOfTextAtSize(numberLabel, 13);
  page.drawText(numberLabel, {
    x: pageWidth - margin - 18 - numWidth,
    y: y - 32,
    size: 13,
    font: fontBold,
    color: accentPalette.text,
  });

  y -= 78;

  // Business Details (Left) & Dates/Metadata (Right)
  const leftX = margin;
  const rightX = pageWidth / 2 + 20;

  page.drawText(toSafePdfText(doc.business.businessName || "Your Business Name"), {
    x: leftX,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  let leftY = y - 15;
  if (doc.business.tagline.trim()) {
    page.drawText(toSafePdfText(doc.business.tagline), {
      x: leftX,
      y: leftY,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });
    leftY -= 13;
  }

  const businessMetaLines = [
    doc.business.address,
    doc.business.email,
    doc.business.phone,
    doc.business.taxId ? `Tax / Reg ID: ${doc.business.taxId}` : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const line of businessMetaLines) {
    for (const wrapped of wrapTextLines(toSafePdfText(line), 44)) {
      page.drawText(wrapped, {
        x: leftX,
        y: leftY,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
      });
      leftY -= 12;
    }
  }

  // Right Column: Issue Date, Due/Valid Until Date, Currency
  let rightY = y;
  const metaPairs: [string, string][] = [
    ["Issue Date:", doc.issueDate || "-"],
    [doc.kind === "invoice" ? "Due Date:" : "Valid Until:", doc.dueOrValidDate || "-"],
    ["Currency:", doc.currency],
  ];
  if (doc.projectTitle?.trim()) {
    metaPairs.push(["Project / Ref:", doc.projectTitle.trim()]);
  }

  for (const [k, v] of metaPairs) {
    page.drawText(toSafePdfText(k), {
      x: rightX,
      y: rightY,
      size: 9,
      font: fontBold,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(toSafePdfText(v), {
      x: rightX + 80,
      y: rightY,
      size: 9,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    rightY -= 14;
  }

  y = Math.min(leftY, rightY) - 18;

  // Bill To / Prepared For Box
  page.drawRectangle({
    x: margin,
    y: y - 68,
    width: pageWidth - margin * 2,
    height: 68,
    color: rgb(0.96, 0.96, 0.95),
  });

  page.drawText(doc.kind === "invoice" ? "BILL TO" : "PREPARED FOR", {
    x: margin + 14,
    y: y - 16,
    size: 8,
    font: fontBold,
    color: rgb(0.45, 0.45, 0.45),
  });

  const custHeader = [doc.customer.name, doc.customer.company]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" — ");
  page.drawText(toSafePdfText(custHeader || "Client / Customer"), {
    x: margin + 14,
    y: y - 30,
    size: 11,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  const custSub = [doc.customer.email, doc.customer.address.replace(/\r?\n/g, ", ")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("  |  ");
  if (custSub) {
    page.drawText(toSafePdfText(custSub.slice(0, 95)), {
      x: margin + 14,
      y: y - 46,
      size: 9,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  y -= 88;

  // Line Items Table Header
  const colDescX = margin + 10;
  const colQtyX = pageWidth - margin - 190;
  const colUnitX = pageWidth - margin - 125;
  const colTotalX = pageWidth - margin - 60;

  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: pageWidth - margin * 2,
    height: 22,
    color: rgb(0.12, 0.13, 0.14),
  });

  page.drawText("DESCRIPTION", {
    x: colDescX,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("QTY", {
    x: colQtyX,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("UNIT PRICE", {
    x: colUnitX,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("AMOUNT", {
    x: colTotalX,
    y: y - 14,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 28;

  doc.items.forEach((item, index) => {
    if (y < 160) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    const descText = toSafePdfText(item.description.trim() || `Item #${index + 1}`);
    const descLines = wrapTextLines(descText, 48);
    const rowHeight = Math.max(20, descLines.length * 12 + 8);

    if (index % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.96),
      });
    }

    descLines.forEach((line, lIdx) => {
      page.drawText(line, {
        x: colDescX,
        y: y - 10 - lIdx * 12,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.12, 0.12, 0.12),
      });
    });

    page.drawText(String(item.quantity), {
      x: colQtyX,
      y: y - 10,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(formatMoney(item.unitPrice, doc.currency, true), {
      x: colUnitX,
      y: y - 10,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    const lineAmt = totals.lineTotals[index] ?? 0;
    page.drawText(formatMoney(lineAmt, doc.currency, true), {
      x: colTotalX,
      y: y - 10,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    y -= rowHeight;
  });

  y -= 14;

  // Totals Summary Block (Right aligned)
  const summaryLabelX = pageWidth - margin - 200;
  const summaryValueX = pageWidth - margin - 85;

  const drawSummaryRow = (label: string, val: string, bold = false) => {
    page.drawText(toSafePdfText(label), {
      x: summaryLabelX,
      y,
      size: bold ? 10.5 : 9.5,
      font: bold ? fontBold : fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(toSafePdfText(val), {
      x: summaryValueX,
      y,
      size: bold ? 10.5 : 9.5,
      font: bold ? fontBold : fontRegular,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 16;
  };

  drawSummaryRow("Subtotal:", formatMoney(totals.subtotal, doc.currency, true));
  if (totals.discountAmount > 0) {
    const discLabel =
      doc.discountMode === "percent" ? `Discount (${doc.discountValue}%):` : "Discount:";
    drawSummaryRow(discLabel, `-${formatMoney(totals.discountAmount, doc.currency, true)}`);
  }
  if (doc.taxRatePercent > 0) {
    drawSummaryRow(
      `${doc.taxLabel || "Tax"} (${doc.taxRatePercent}%):`,
      formatMoney(totals.taxAmount, doc.currency, true),
    );
  }

  page.drawLine({
    start: { x: summaryLabelX, y: y + 8 },
    end: { x: pageWidth - margin, y: y + 8 },
    thickness: 1,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 4;
  drawSummaryRow(
    doc.kind === "invoice" ? "TOTAL DUE:" : "ESTIMATED TOTAL:",
    formatMoney(totals.grandTotal, doc.currency, true),
    true,
  );

  y -= 18;

  // Notes & Terms / Payment Instructions
  const drawFooterSection = (heading: string, content: string) => {
    if (!content.trim()) return;
    if (y < 100) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(toSafePdfText(heading), {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= 13;
    for (const line of wrapTextLines(toSafePdfText(content), 85)) {
      page.drawText(line, {
        x: margin,
        y,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 11;
    }
    y -= 8;
  };

  drawFooterSection("Notes", doc.notes);
  drawFooterSection(
    doc.kind === "invoice" ? "Payment Instructions" : "Terms & Conditions",
    doc.termsOrPaymentInstructions,
  );

  // Subtle Privacy / Generator Footer
  page.drawText(
    "Generated locally in browser via IJM — Estimated figures; verify tax & payment details before remittance.",
    {
      x: margin,
      y: 28,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.55, 0.55, 0.55),
    },
  );

  return pdfDoc.save();
}

// ============================================================================
// Tax Calculator Pure Logic
// ============================================================================

export type TaxCalculationMode = "exclusive" | "inclusive";

export interface TaxCalculatorInput {
  amount: number;
  taxRatePercent: number;
  mode: TaxCalculationMode;
  currency: CurrencyCode;
}

export interface TaxCalculatorOutput {
  ok: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
  effectiveTaxSharePercent: number;
  error?: string;
}

export function calculateTaxBreakdown(input: TaxCalculatorInput): TaxCalculatorOutput {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return {
      ok: false,
      netAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      effectiveTaxSharePercent: 0,
      error: "Please enter a valid non-negative amount.",
    };
  }

  if (
    !Number.isFinite(input.taxRatePercent) ||
    input.taxRatePercent < 0 ||
    input.taxRatePercent > 100
  ) {
    return {
      ok: false,
      netAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      effectiveTaxSharePercent: 0,
      error: "Tax rate must be between 0% and 100%.",
    };
  }

  const decimals = getCurrencyOption(input.currency).decimals;
  const rate = input.taxRatePercent / 100;

  if (input.mode === "exclusive") {
    const netAmount = roundCurrency(input.amount, decimals);
    const taxAmount = roundCurrency(netAmount * rate, decimals);
    const grossAmount = roundCurrency(netAmount + taxAmount, decimals);
    const effectiveTaxSharePercent =
      grossAmount > 0 ? roundCurrency((taxAmount / grossAmount) * 100, 2) : 0;
    return {
      ok: true,
      netAmount,
      taxAmount,
      grossAmount,
      effectiveTaxSharePercent,
    };
  } else {
    const grossAmount = roundCurrency(input.amount, decimals);
    const netAmount = roundCurrency(grossAmount / (1 + rate), decimals);
    const taxAmount = roundCurrency(grossAmount - netAmount, decimals);
    const effectiveTaxSharePercent =
      grossAmount > 0 ? roundCurrency((taxAmount / grossAmount) * 100, 2) : 0;
    return {
      ok: true,
      netAmount,
      taxAmount,
      grossAmount,
      effectiveTaxSharePercent,
    };
  }
}

// ============================================================================
// Percentage & Discount Calculator Pure Logic
// ============================================================================

export interface DiscountCalculatorInput {
  originalPrice: number;
  primaryDiscountMode: DiscountMode;
  primaryDiscountValue: number;
  extraDiscountPercent?: number;
  salesTaxPercent?: number;
  currency: CurrencyCode;
}

export interface DiscountCalculatorOutput {
  ok: boolean;
  originalPrice: number;
  primaryDiscountAmount: number;
  priceAfterPrimary: number;
  extraDiscountAmount: number;
  totalSavings: number;
  effectiveDiscountPercent: number;
  subtotalAfterDiscounts: number;
  taxAmount: number;
  finalPayable: number;
  error?: string;
}

export function calculateDiscountBreakdown(
  input: DiscountCalculatorInput,
): DiscountCalculatorOutput {
  const emptyFail = (error: string): DiscountCalculatorOutput => ({
    ok: false,
    originalPrice: 0,
    primaryDiscountAmount: 0,
    priceAfterPrimary: 0,
    extraDiscountAmount: 0,
    totalSavings: 0,
    effectiveDiscountPercent: 0,
    subtotalAfterDiscounts: 0,
    taxAmount: 0,
    finalPayable: 0,
    error,
  });

  if (!Number.isFinite(input.originalPrice) || input.originalPrice < 0) {
    return emptyFail("Original price must be a non-negative number.");
  }
  if (!Number.isFinite(input.primaryDiscountValue) || input.primaryDiscountValue < 0) {
    return emptyFail("Primary discount cannot be negative.");
  }
  if (input.primaryDiscountMode === "percent" && input.primaryDiscountValue > 100) {
    return emptyFail("Primary percentage discount cannot exceed 100%.");
  }
  if (
    input.primaryDiscountMode === "fixed" &&
    input.primaryDiscountValue > input.originalPrice &&
    input.originalPrice > 0
  ) {
    return emptyFail("Fixed discount cannot exceed the original price.");
  }

  const extraPct = input.extraDiscountPercent ?? 0;
  if (!Number.isFinite(extraPct) || extraPct < 0 || extraPct > 100) {
    return emptyFail("Additional stacked discount must be between 0% and 100%.");
  }

  const taxPct = input.salesTaxPercent ?? 0;
  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    return emptyFail("Sales tax rate must be between 0% and 100%.");
  }

  const decimals = getCurrencyOption(input.currency).decimals;
  const originalPrice = roundCurrency(input.originalPrice, decimals);

  const primaryDiscountAmount =
    input.primaryDiscountMode === "percent"
      ? roundCurrency(originalPrice * (input.primaryDiscountValue / 100), decimals)
      : roundCurrency(Math.min(originalPrice, input.primaryDiscountValue), decimals);

  const priceAfterPrimary = roundCurrency(
    Math.max(0, originalPrice - primaryDiscountAmount),
    decimals,
  );

  const extraDiscountAmount = roundCurrency(priceAfterPrimary * (extraPct / 100), decimals);

  const subtotalAfterDiscounts = roundCurrency(
    Math.max(0, priceAfterPrimary - extraDiscountAmount),
    decimals,
  );

  const totalSavings = roundCurrency(originalPrice - subtotalAfterDiscounts, decimals);

  const effectiveDiscountPercent =
    originalPrice > 0 ? roundCurrency((totalSavings / originalPrice) * 100, 2) : 0;

  const taxAmount = roundCurrency(subtotalAfterDiscounts * (taxPct / 100), decimals);
  const finalPayable = roundCurrency(subtotalAfterDiscounts + taxAmount, decimals);

  return {
    ok: true,
    originalPrice,
    primaryDiscountAmount,
    priceAfterPrimary,
    extraDiscountAmount,
    totalSavings,
    effectiveDiscountPercent,
    subtotalAfterDiscounts,
    taxAmount,
    finalPayable,
  };
}

export function calculatePercentageChange(
  fromValue: number,
  toValue: number,
): {
  ok: boolean;
  difference: number;
  percentChange: number;
  direction: "increase" | "decrease" | "unchanged";
  error?: string;
} {
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) {
    return {
      ok: false,
      difference: 0,
      percentChange: 0,
      direction: "unchanged",
      error: "Please enter valid numbers for both values.",
    };
  }
  if (fromValue === 0) {
    return {
      ok: false,
      difference: toValue,
      percentChange: 0,
      direction: "unchanged",
      error: "Starting value cannot be zero when computing percentage change.",
    };
  }
  const difference = roundCurrency(toValue - fromValue, 4);
  const rawPct = (difference / Math.abs(fromValue)) * 100;
  const percentChange = roundCurrency(Math.abs(rawPct), 2);
  const direction = difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged";

  return {
    ok: true,
    difference,
    percentChange,
    direction,
  };
}

const BUSINESS_PROFILE_STORAGE_KEY = "utilitydock_business_profile_v1";

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  businessName: "Northstar Studio LLC",
  tagline: "Product Design & Full-Stack Engineering",
  email: "billing@northstar.example",
  phone: "+1 (555) 234-5678",
  address: "420 Market Street, Suite 300, San Francisco, CA",
  taxId: "US-94-3829104",
  accentColor: "lime",
};

export function loadSavedBusinessProfile(): BusinessProfile {
  if (typeof window === "undefined") return DEFAULT_BUSINESS_PROFILE;
  try {
    const raw = window.localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_BUSINESS_PROFILE;
    const parsed = JSON.parse(raw) as Partial<BusinessProfile>;
    return {
      businessName: parsed.businessName ?? DEFAULT_BUSINESS_PROFILE.businessName,
      tagline: parsed.tagline ?? DEFAULT_BUSINESS_PROFILE.tagline,
      email: parsed.email ?? DEFAULT_BUSINESS_PROFILE.email,
      phone: parsed.phone ?? DEFAULT_BUSINESS_PROFILE.phone,
      address: parsed.address ?? DEFAULT_BUSINESS_PROFILE.address,
      taxId: parsed.taxId ?? DEFAULT_BUSINESS_PROFILE.taxId,
      accentColor: parsed.accentColor ?? DEFAULT_BUSINESS_PROFILE.accentColor,
    };
  } catch {
    return DEFAULT_BUSINESS_PROFILE;
  }
}

export function saveBusinessProfile(profile: BusinessProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}
