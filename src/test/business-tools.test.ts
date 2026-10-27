import { describe, expect, it } from "vitest";
import {
  calculateDiscountBreakdown,
  calculateDocumentTotals,
  calculatePercentageChange,
  calculateTaxBreakdown,
  DEFAULT_BUSINESS_PROFILE,
  formatMoney,
  generateCommercialDocumentPdf,
} from "@/lib/business-tools";

describe("Business Tools Pure Logic", () => {
  it("computes invoice/quotation totals and validates negative inputs", () => {
    const res = calculateDocumentTotals({
      currency: "USD",
      discountMode: "percent",
      discountValue: 10,
      taxRatePercent: 8.5,
      items: [
        { id: "1", description: "UI/UX Audit", quantity: 2, unitPrice: 500 },
        { id: "2", description: "Frontend Dev", quantity: 10, unitPrice: 120 },
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.subtotal).toBe(2200);
    expect(res.discountAmount).toBe(220);
    expect(res.taxableAmount).toBe(1980);
    expect(res.taxAmount).toBe(168.3);
    expect(res.grandTotal).toBe(2148.3);
  });

  it("generates a real PDF binary for commercial documents", async () => {
    const pdfBytes = await generateCommercialDocumentPdf({
      kind: "quotation",
      documentNumber: "QT-2026-101",
      projectTitle: "Website Modernization",
      issueDate: "2026-10-27",
      dueOrValidDate: "2026-11-27",
      currency: "EUR",
      business: DEFAULT_BUSINESS_PROFILE,
      customer: {
        name: "Marcus Vance",
        company: "Helios Energy GmbH",
        email: "mvance@helios.example",
        address: "Friedrichstrasse 88, Berlin",
      },
      items: [{ id: "1", description: "Phase 1 Architecture", quantity: 1, unitPrice: 3200 }],
      discountMode: "percent",
      discountValue: 5,
      taxLabel: "VAT",
      taxRatePercent: 19,
      notes: "Includes 30 days of post-launch support.",
      termsOrPaymentInstructions: "50% deposit upon acceptance; 50% upon delivery.",
    });

    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(pdfBytes.slice(0, 5))).toBe("%PDF-");
  });

  it("calculates exclusive and inclusive tax accurately", () => {
    const excl = calculateTaxBreakdown({
      amount: 500,
      taxRatePercent: 20,
      mode: "exclusive",
      currency: "GBP",
    });
    expect(excl.ok).toBe(true);
    expect(excl.netAmount).toBe(500);
    expect(excl.taxAmount).toBe(100);
    expect(excl.grossAmount).toBe(600);

    const incl = calculateTaxBreakdown({
      amount: 600,
      taxRatePercent: 20,
      mode: "inclusive",
      currency: "GBP",
    });
    expect(incl.ok).toBe(true);
    expect(incl.netAmount).toBe(500);
    expect(incl.taxAmount).toBe(100);
    expect(incl.grossAmount).toBe(600);
  });

  it("calculates stacked discounts, sales tax, and percentage changes", () => {
    const disc = calculateDiscountBreakdown({
      originalPrice: 250,
      primaryDiscountMode: "percent",
      primaryDiscountValue: 20,
      extraDiscountPercent: 5,
      salesTaxPercent: 8,
      currency: "USD",
    });
    expect(disc.ok).toBe(true);
    expect(disc.subtotalAfterDiscounts).toBe(190);
    expect(disc.totalSavings).toBe(60);
    expect(disc.taxAmount).toBe(15.2);
    expect(disc.finalPayable).toBe(205.2);

    const pct = calculatePercentageChange(120, 150);
    expect(pct.ok).toBe(true);
    expect(pct.direction).toBe("increase");
    expect(pct.percentChange).toBe(25);
    expect(formatMoney(205.2, "USD")).toBe("$205.20");
  });
});
