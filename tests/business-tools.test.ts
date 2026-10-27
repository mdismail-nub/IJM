import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateDiscountBreakdown,
  calculateDocumentTotals,
  calculatePercentageChange,
  calculateTaxBreakdown,
  DEFAULT_BUSINESS_PROFILE,
  formatMoney,
  generateCommercialDocumentPdf,
} from "../src/lib/business-tools";

test("calculateDocumentTotals computes line totals, percentage/fixed discounts, tax, and catches invalid inputs", () => {
  const valid = calculateDocumentTotals({
    currency: "USD",
    discountMode: "percent",
    discountValue: 10,
    taxRatePercent: 8.5,
    items: [
      { id: "1", description: "UI/UX Audit", quantity: 2, unitPrice: 500 },
      { id: "2", description: "Frontend Implementation", quantity: 10, unitPrice: 120 },
    ],
  });

  assert.equal(valid.ok, true);
  assert.deepEqual(valid.lineTotals, [1000, 1200]);
  assert.equal(valid.subtotal, 2200);
  assert.equal(valid.discountAmount, 220);
  assert.equal(valid.taxableAmount, 1980);
  assert.equal(valid.taxAmount, 168.3);
  assert.equal(valid.grandTotal, 2148.3);

  const invalid = calculateDocumentTotals({
    currency: "USD",
    discountMode: "percent",
    discountValue: 120,
    taxRatePercent: -5,
    items: [{ id: "1", description: "Bad item", quantity: -2, unitPrice: 100 }],
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.validationErrors.length, 3);
});

test("generateCommercialDocumentPdf creates a valid PDF binary for both invoices and quotations", async () => {
  const bytes = await generateCommercialDocumentPdf({
    kind: "invoice",
    documentNumber: "INV-2026-042",
    issueDate: "2026-10-27",
    dueOrValidDate: "2026-11-10",
    currency: "USD",
    business: DEFAULT_BUSINESS_PROFILE,
    customer: {
      name: "Elena Rostova",
      company: "Acme Robotics Inc.",
      email: "elena@acme.example",
      address: "100 Innovation Way, Boston, MA",
    },
    items: [
      { id: "1", description: "Design System Architecture", quantity: 1, unitPrice: 1850 },
      { id: "2", description: "Component Library Delivery", quantity: 1, unitPrice: 2400 },
    ],
    discountMode: "fixed",
    discountValue: 250,
    taxLabel: "Sales Tax",
    taxRatePercent: 6.25,
    notes: "Thank you for your business!",
    termsOrPaymentInstructions: "ACH / Wire within 14 days.",
  });

  assert.equal(bytes instanceof Uint8Array, true);
  assert.equal(bytes.byteLength > 1000, true);
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, "%PDF-");
});

test("calculateTaxBreakdown handles exclusive and inclusive tax accurately", () => {
  const exclusive = calculateTaxBreakdown({
    amount: 1000,
    taxRatePercent: 15,
    mode: "exclusive",
    currency: "USD",
  });
  assert.equal(exclusive.ok, true);
  assert.equal(exclusive.netAmount, 1000);
  assert.equal(exclusive.taxAmount, 150);
  assert.equal(exclusive.grossAmount, 1150);

  const inclusive = calculateTaxBreakdown({
    amount: 1150,
    taxRatePercent: 15,
    mode: "inclusive",
    currency: "USD",
  });
  assert.equal(inclusive.ok, true);
  assert.equal(inclusive.netAmount, 1000);
  assert.equal(inclusive.taxAmount, 150);
  assert.equal(inclusive.grossAmount, 1150);

  const bad = calculateTaxBreakdown({
    amount: -50,
    taxRatePercent: 15,
    mode: "exclusive",
    currency: "USD",
  });
  assert.equal(bad.ok, false);
});

test("calculateDiscountBreakdown and calculatePercentageChange compute stacked discounts, tax, and % changes", () => {
  const res = calculateDiscountBreakdown({
    originalPrice: 200,
    primaryDiscountMode: "percent",
    primaryDiscountValue: 20, // -> 160
    extraDiscountPercent: 10, // -> 144
    salesTaxPercent: 10, // -> +14.4 = 158.4
    currency: "USD",
  });

  assert.equal(res.ok, true);
  assert.equal(res.primaryDiscountAmount, 40);
  assert.equal(res.priceAfterPrimary, 160);
  assert.equal(res.extraDiscountAmount, 16);
  assert.equal(res.subtotalAfterDiscounts, 144);
  assert.equal(res.totalSavings, 56);
  assert.equal(res.effectiveDiscountPercent, 28);
  assert.equal(res.taxAmount, 14.4);
  assert.equal(res.finalPayable, 158.4);

  const pct = calculatePercentageChange(80, 100);
  assert.equal(pct.ok, true);
  assert.equal(pct.direction, "increase");
  assert.equal(pct.percentChange, 25);
  assert.equal(formatMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(formatMoney(1234.5, "JPY"), "¥1,235");
});
