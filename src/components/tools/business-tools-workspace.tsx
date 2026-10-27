import {
  AlertCircle,
  BookmarkCheck,
  Check,
  Copy,
  Download,
  FileText,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  calculateDiscountBreakdown,
  calculateDocumentTotals,
  calculatePercentageChange,
  calculateTaxBreakdown,
  CURRENCY_OPTIONS,
  DEFAULT_BUSINESS_PROFILE,
  formatMoney,
  generateCommercialDocumentPdf,
  loadSavedBusinessProfile,
  roundCurrency,
  saveBusinessProfile,
  type BusinessProfile,
  type CommercialDocumentData,
  type CurrencyCode,
  type CustomerDetails,
  type DiscountMode,
  type DocumentLineItem,
  type TaxCalculationMode,
} from "@/lib/business-tools";
import { downloadBlob, sanitizeFilename } from "@/lib/file-utils";

const ACCENT_STYLES: Record<
  BusinessProfile["accentColor"],
  { banner: string; badge: string; label: string }
> = {
  lime: {
    banner: "bg-primary text-primary-foreground",
    badge: "bg-primary/25 text-foreground",
    label: "IJM Lime",
  },
  ink: {
    banner: "bg-foreground text-background",
    badge: "bg-foreground/10 text-foreground",
    label: "Classic Ink",
  },
  emerald: {
    banner: "bg-emerald-700 text-white",
    badge: "bg-emerald-500/15 text-emerald-900",
    label: "Emerald",
  },
  blue: {
    banner: "bg-blue-700 text-white",
    badge: "bg-blue-500/15 text-blue-900",
    label: "Royal Blue",
  },
};

function getInitialItems(kind: "invoice" | "quotation"): DocumentLineItem[] {
  if (kind === "invoice") {
    return [
      {
        id: "item-1",
        description: "Product UI/UX Design & Interactive Prototype",
        quantity: 1,
        unitPrice: 1650,
      },
      {
        id: "item-2",
        description: "Frontend Engineering & Responsive QA (Sprint 1)",
        quantity: 12,
        unitPrice: 125,
      },
    ];
  }
  return [
    {
      id: "item-1",
      description: "Discovery Workshop & Technical Architecture Blueprint",
      quantity: 1,
      unitPrice: 1200,
    },
    {
      id: "item-2",
      description: "Full-Stack Web Application Implementation",
      quantity: 1,
      unitPrice: 3800,
    },
    {
      id: "item-3",
      description: "Post-Launch Support & Handover Documentation",
      quantity: 1,
      unitPrice: 600,
    },
  ];
}

function CommercialDocumentWorkspace({ kind }: { kind: "invoice" | "quotation" }) {
  const isInvoice = kind === "invoice";

  const [documentNumber, setDocumentNumber] = useState(isInvoice ? "INV-2026-042" : "QT-2026-108");
  const [projectTitle, setProjectTitle] = useState(
    isInvoice ? "Q4 Web Platform Redesign" : "Web Platform Modernization Proposal",
  );
  const [issueDate, setIssueDate] = useState("2026-10-27");
  const [dueOrValidDate, setDueOrValidDate] = useState(isInvoice ? "2026-11-10" : "2026-11-27");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [business, setBusiness] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: "Elena Rostova",
    company: "Acme Robotics Inc.",
    email: "elena@acmerobotics.example",
    address: "100 Innovation Way, Suite 4B, Boston, MA 02110",
  });
  const [items, setItems] = useState<DocumentLineItem[]>(() => getInitialItems(kind));
  const [discountMode, setDiscountMode] = useState<DiscountMode>("percent");
  const [discountValue, setDiscountValue] = useState<number>(5);
  const [taxLabel, setTaxLabel] = useState("Tax / VAT");
  const [taxRatePercent, setTaxRatePercent] = useState<number>(8.5);
  const [notes, setNotes] = useState(
    isInvoice
      ? "Thank you for partnering with us. All deliverables for Sprint 1 have been verified and deployed."
      : "This quotation includes two rounds of design revisions and complete source-code handover upon completion.",
  );
  const [termsOrPaymentInstructions, setTermsOrPaymentInstructions] = useState(
    isInvoice
      ? "Payment due within 14 days via ACH or wire transfer. Please reference invoice number INV-2026-042 on remittance."
      : "Quotation valid for 30 days from issue date. 50% deposit required to schedule project kickoff; 50% upon delivery.",
  );

  const [savedProfileFeedback, setSavedProfileFeedback] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Hydrate saved business profile on mount and reset kind-specific defaults when switching between Invoice and Quotation
  useEffect(() => {
    setBusiness(loadSavedBusinessProfile());
  }, []);

  useEffect(() => {
    setDocumentNumber(kind === "invoice" ? "INV-2026-042" : "QT-2026-108");
    setProjectTitle(
      kind === "invoice" ? "Q4 Web Platform Redesign" : "Web Platform Modernization Proposal",
    );
    setDueOrValidDate(kind === "invoice" ? "2026-11-10" : "2026-11-27");
    setItems(getInitialItems(kind));
    setNotes(
      kind === "invoice"
        ? "Thank you for partnering with us. All deliverables for Sprint 1 have been verified and deployed."
        : "This quotation includes two rounds of design revisions and complete source-code handover upon completion.",
    );
    setTermsOrPaymentInstructions(
      kind === "invoice"
        ? "Payment due within 14 days via ACH or wire transfer. Please reference invoice number INV-2026-042 on remittance."
        : "Quotation valid for 30 days from issue date. 50% deposit required to schedule project kickoff; 50% upon delivery.",
    );
  }, [kind]);

  const docData: CommercialDocumentData = {
    kind,
    documentNumber,
    projectTitle,
    issueDate,
    dueOrValidDate,
    currency,
    business,
    customer,
    items,
    discountMode,
    discountValue,
    taxLabel,
    taxRatePercent,
    notes,
    termsOrPaymentInstructions,
  };

  const totals = calculateDocumentTotals(docData);
  const accent = ACCENT_STYLES[business.accentColor];

  const handleSaveBusinessProfile = () => {
    saveBusinessProfile(business);
    setSavedProfileFeedback(true);
    setTimeout(() => setSavedProfileFeedback(false), 2200);
  };

  const handleAddLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        description: "",
        quantity: 1,
        unitPrice: 100,
      },
    ]);
  };

  const handleUpdateLineItem = (id: string, patch: Partial<DocumentLineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveLineItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExportPdf = async () => {
    if (!totals.ok) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const pdfBytes = await generateCommercialDocumentPdf(docData);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const baseName = sanitizeFilename(
        documentNumber.trim() || (isInvoice ? "invoice" : "quotation"),
      );
      downloadBlob(blob, `${baseName}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to generate PDF document.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-3.5 sm:p-4">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
            <span>Currency</span>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full min-w-0 max-w-full rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold text-foreground sm:w-auto"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
            <span>Branding Theme:</span>
            {(["lime", "ink", "emerald", "blue"] as const).map((colorKey) => (
              <button
                key={colorKey}
                type="button"
                onClick={() => setBusiness((prev) => ({ ...prev, accentColor: colorKey }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  business.accentColor === colorKey
                    ? "bg-foreground text-background"
                    : "border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {ACCENT_STYLES[colorKey].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveBusinessProfile}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            {savedProfileFeedback ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Business Details Saved
              </>
            ) : (
              <>
                <BookmarkCheck className="h-3.5 w-3.5" aria-hidden /> Save Business Profile
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!totals.ok || isExporting}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isExporting
              ? "Generating PDF..."
              : isInvoice
                ? "Download PDF Invoice"
                : "Download PDF Quotation"}
          </button>
        </div>
      </div>

      {!totals.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
        >
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            Please fix the following before exporting:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {totals.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
        >
          {exportError}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-12">
        {/* Left Column: Form Editor */}
        <div className="space-y-6 xl:col-span-7">
          {/* Document Metadata */}
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-4">
            <h2 className="text-base font-bold text-foreground">
              1. {isInvoice ? "Invoice" : "Quotation"} Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="doc-number-input"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  {isInvoice ? "Invoice Number" : "Quotation Number"}
                </label>
                <input
                  id="doc-number-input"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-project-input"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Project / Reference Title
                </label>
                <input
                  id="doc-project-input"
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-issue-date"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Issue Date
                </label>
                <input
                  id="doc-issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="doc-due-date"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  {isInvoice ? "Due Date" : "Valid Until Date"}
                </label>
                <input
                  id="doc-due-date"
                  type="date"
                  value={dueOrValidDate}
                  onChange={(e) => setDueOrValidDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Sender & Client Details */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">2. From (Your Business)</h2>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Reusable across docs
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Business / Freelancer Name
                </label>
                <input
                  type="text"
                  value={business.businessName}
                  onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Tagline / Specialty (optional)
                </label>
                <input
                  type="text"
                  value={business.tagline}
                  onChange={(e) => setBusiness({ ...business, tagline: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={business.email}
                    onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">Phone</label>
                  <input
                    type="text"
                    value={business.phone}
                    onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">Address</label>
                <input
                  type="text"
                  value={business.address}
                  onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Tax / Registration ID (optional)
                </label>
                <input
                  type="text"
                  value={business.taxId}
                  onChange={(e) => setBusiness({ ...business, taxId: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-card space-y-3">
              <h2 className="text-base font-bold text-foreground">
                3. {isInvoice ? "Bill To (Customer)" : "Prepared For (Client)"}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={customer.company}
                  onChange={(e) => setCustomer({ ...customer, company: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Client Email
                </label>
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Billing / Client Address
                </label>
                <textarea
                  rows={2}
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-3xl border bg-card p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-foreground">
                4. Line Items ({items.length})
              </h2>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add Line Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const lineTotal = totals.lineTotals[idx] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-2xl border bg-background/70 p-3.5 sm:grid-cols-12 sm:items-end"
                  >
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Description #{idx + 1}
                      </label>
                      <input
                        type="text"
                        placeholder="Item or service description..."
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateLineItem(item.id, {
                            description: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Qty
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateLineItem(item.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateLineItem(item.id, {
                            unitPrice: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:col-span-2">
                      <div>
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                          Subtotal
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {formatMoney(lineTotal, currency)}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        aria-label={`Remove line item ${idx + 1}`}
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="rounded-lg border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Discount & Tax Controls */}
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Discount Type & Value
                </label>
                <div className="mt-1 flex gap-1.5">
                  <select
                    aria-label="Discount mode"
                    value={discountMode}
                    onChange={(e) =>
                      setDiscountMode(e.target.value === "fixed" ? "fixed" : "percent")
                    }
                    className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="percent">% Off</option>
                    <option value="fixed">Fixed</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    aria-label="Discount value"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Tax Label
                </label>
                <input
                  type="text"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="VAT / GST / Sales Tax"
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={taxRatePercent}
                  onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Notes & Payment/Terms */}
          <div className="rounded-3xl border bg-card p-5 shadow-card grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Notes / Scope Summary
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background p-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                {isInvoice ? "Payment Instructions" : "Validity & Terms"}
              </label>
              <textarea
                rows={3}
                value={termsOrPaymentInstructions}
                onChange={(e) => setTermsOrPaymentInstructions(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background p-3 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Document Preview */}
        <div className="min-w-0 xl:col-span-5">
          <div className="sticky top-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden /> Live{" "}
                {isInvoice ? "Invoice" : "Quotation"} Preview
              </span>
              <span className="text-xs text-muted-foreground">A4 Vector PDF Ready</span>
            </div>

            <div className="overflow-hidden rounded-3xl border bg-white text-slate-900 shadow-card">
              {/* Banner */}
              <div
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5 ${accent.banner}`}
              >
                <div className="min-w-0">
                  <p className="text-lg font-extrabold tracking-tight sm:text-xl">
                    {isInvoice ? "INVOICE" : "QUOTATION"}
                  </p>
                  {projectTitle && <p className="break-words text-xs opacity-85">{projectTitle}</p>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold">#{documentNumber || "001"}</p>
                  <p className="text-[11px] opacity-80">Issued: {issueDate || "-"}</p>
                </div>
              </div>

              <div className="space-y-5 p-4 text-xs sm:p-6">
                {/* Sender & Dates */}
                <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-slate-900">
                      {business.businessName || "Your Business"}
                    </p>
                    {business.tagline && (
                      <p className="break-words text-[11px] text-slate-500">{business.tagline}</p>
                    )}
                    <p className="mt-1 break-words text-slate-600">{business.address}</p>
                    <p className="break-words text-slate-600">
                      {business.email}
                      {business.phone ? ` · ${business.phone}` : ""}
                    </p>
                    {business.taxId && (
                      <p className="break-words text-[11px] text-slate-500">
                        Tax ID: {business.taxId}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-100 p-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {isInvoice ? "Payment Due" : "Valid Until"}
                    </p>
                    <p className="font-mono text-xs font-bold text-slate-900">
                      {dueOrValidDate || "-"}
                    </p>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {isInvoice ? "Amount Due" : "Estimated Total"}
                    </p>
                    <p className="font-mono text-base font-extrabold text-slate-900">
                      {formatMoney(totals.grandTotal, currency)}
                    </p>
                  </div>
                </div>

                {/* Bill To */}
                <div className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isInvoice ? "Bill To" : "Prepared For"}
                  </p>
                  <p className="mt-0.5 break-words font-bold text-slate-900">
                    {customer.name || "Client Name"}
                    {customer.company ? ` — ${customer.company}` : ""}
                  </p>
                  <p className="break-words text-slate-600">{customer.address}</p>
                  {customer.email && <p className="break-words text-slate-500">{customer.email}</p>}
                </div>

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-2">Description</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-2 text-right">Unit</th>
                        <th className="py-2 pl-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((it, i) => (
                        <tr key={it.id}>
                          <td className="py-2.5 pr-2 font-medium text-slate-800">
                            {it.description || `Item #${i + 1}`}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {formatMoney(it.unitPrice, currency)}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono font-bold text-slate-900">
                            {formatMoney(totals.lineTotals[i] ?? 0, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Block */}
                <div className="space-y-1.5 border-t border-slate-300 pt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold">
                      {formatMoney(totals.subtotal, currency)}
                    </span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>
                        Discount {discountMode === "percent" ? `(${discountValue}%)` : "(Fixed)"}
                      </span>
                      <span className="font-mono font-semibold">
                        -{formatMoney(totals.discountAmount, currency)}
                      </span>
                    </div>
                  )}
                  {taxRatePercent > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>
                        {taxLabel || "Tax"} ({taxRatePercent}%)
                      </span>
                      <span className="font-mono font-semibold">
                        {formatMoney(totals.taxAmount, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-extrabold text-slate-900">
                    <span>{isInvoice ? "Total Due" : "Estimated Total"}</span>
                    <span className="font-mono">{formatMoney(totals.grandTotal, currency)}</span>
                  </div>
                </div>

                {/* Notes & Terms */}
                {(notes.trim() || termsOrPaymentInstructions.trim()) && (
                  <div className="space-y-2 border-t border-slate-200 pt-3 text-[11px] text-slate-600">
                    {notes.trim() && (
                      <div>
                        <p className="font-bold text-slate-800">Notes</p>
                        <p className="whitespace-pre-line">{notes}</p>
                      </div>
                    )}
                    {termsOrPaymentInstructions.trim() && (
                      <div>
                        <p className="font-bold text-slate-800">
                          {isInvoice ? "Payment Instructions" : "Terms & Conditions"}
                        </p>
                        <p className="whitespace-pre-line">{termsOrPaymentInstructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Currency symbols format numbers for display and PDF export only — no live foreign
              exchange rate conversion is applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaxCalculatorWorkspace() {
  const [mode, setMode] = useState<TaxCalculationMode>("exclusive");
  const [amount, setAmount] = useState<number>(1000);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(15);
  const [taxLabel, setTaxLabel] = useState("VAT / GST");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [copied, setCopied] = useState(false);

  const result = calculateTaxBreakdown({
    amount,
    taxRatePercent,
    mode,
    currency,
  });

  const presetRates = [0, 5, 7.5, 10, 15, 18, 20, 25];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-card lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Tax Configuration</h2>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div role="group" aria-label="Tax calculation mode" className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("exclusive")}
              className={`rounded-2xl border p-4 text-left transition ${
                mode === "exclusive"
                  ? "border-foreground bg-primary/25 text-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-sm font-bold text-foreground">Add Tax (Tax Exclusive)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Start with Net price and add {taxLabel} on top.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("inclusive")}
              className={`rounded-2xl border p-4 text-left transition ${
                mode === "inclusive"
                  ? "border-foreground bg-primary/25 text-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <p className="text-sm font-bold text-foreground">Extract Tax (Tax Inclusive)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reverse-calculate Net price & tax from a Gross total.
              </p>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tax-amount-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                {mode === "exclusive" ? "Net Amount (Before Tax)" : "Gross Amount (Including Tax)"}
              </label>
              <input
                id="tax-amount-input"
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-mono text-base font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="tax-rate-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                {taxLabel} Rate (%)
              </label>
              <input
                id="tax-rate-input"
                type="number"
                min={0}
                max={100}
                step="any"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-mono text-base font-semibold"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-muted-foreground">
              Quick Tax Rate Presets:
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {presetRates.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTaxRatePercent(preset)}
                  className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
                    taxRatePercent === preset
                      ? "border-foreground bg-foreground text-background"
                      : "bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="tax-name-input"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Custom Tax Label
            </label>
            <input
              id="tax-name-input"
              type="text"
              value={taxLabel}
              onChange={(e) => setTaxLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        {/* Breakdown Output */}
        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-5">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-base font-bold text-foreground">Tax Breakdown</h3>
            <button
              type="button"
              disabled={!result.ok}
              onClick={() => {
                if (!result.ok) return;
                const text = `Net Amount: ${formatMoney(result.netAmount, currency)}\n${taxLabel} (${taxRatePercent}%): ${formatMoney(result.taxAmount, currency)}\nGross Total: ${formatMoney(result.grossAmount, currency)}`;
                void navigator.clipboard?.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Summary
                </>
              )}
            </button>
          </div>

          {!result.ok ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{result.error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  Net Amount (Excl. {taxLabel})
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatMoney(result.netAmount, currency)}
                </p>
              </div>

              <div className="rounded-2xl border bg-background p-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  {taxLabel} ({taxRatePercent}%)
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {formatMoney(result.taxAmount, currency)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Represents {result.effectiveTaxSharePercent}% of the gross total
                </p>
              </div>

              <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider opacity-85">
                  Gross Total (Incl. {taxLabel})
                </p>
                <p className="mt-1 font-mono text-3xl font-extrabold">
                  {formatMoney(result.grossAmount, currency)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3.5 text-[11px] text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <strong>Estimation Notice:</strong> Results are mathematical estimates for general
              planning and do not constitute formal tax, accounting, or legal advice. Currency
              selection formats symbols only (not live FX rates).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscountCalculatorWorkspace() {
  const [originalPrice, setOriginalPrice] = useState<number>(240);
  const [primaryDiscountMode, setPrimaryDiscountMode] = useState<DiscountMode>("percent");
  const [primaryDiscountValue, setPrimaryDiscountValue] = useState<number>(20);
  const [extraDiscountPercent, setExtraDiscountPercent] = useState<number>(10);
  const [salesTaxPercent, setSalesTaxPercent] = useState<number>(8.5);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Quick Percentage Utility state
  const [pctX, setPctX] = useState<number>(15);
  const [pctY, setPctY] = useState<number>(360);
  const [changeFrom, setChangeFrom] = useState<number>(120);
  const [changeTo, setChangeTo] = useState<number>(150);

  const result = calculateDiscountBreakdown({
    originalPrice,
    primaryDiscountMode,
    primaryDiscountValue,
    extraDiscountPercent,
    salesTaxPercent,
    currency,
  });

  const pctOfValue =
    Number.isFinite(pctX) && Number.isFinite(pctY) ? roundCurrency((pctX / 100) * pctY, 4) : 0;
  const pctChangeRes = calculatePercentageChange(changeFrom, changeTo);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Discount Form */}
        <div className="space-y-5 rounded-3xl border bg-card p-6 shadow-card lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">
              Sale & Stacked Discount Calculator
            </h2>
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="disc-orig-price"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Original Price
              </label>
              <input
                id="disc-orig-price"
                type="number"
                min={0}
                step="any"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-4 py-2.5 font-mono text-base font-semibold"
              />
            </div>

            <div>
              <label
                htmlFor="disc-primary-val"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Primary Discount
              </label>
              <div className="mt-1 flex gap-1.5">
                <select
                  aria-label="Primary discount mode"
                  value={primaryDiscountMode}
                  onChange={(e) =>
                    setPrimaryDiscountMode(e.target.value === "fixed" ? "fixed" : "percent")
                  }
                  className="rounded-xl border bg-background px-3 py-2.5 text-xs font-semibold"
                >
                  <option value="percent">% Off</option>
                  <option value="fixed">Fixed</option>
                </select>
                <input
                  id="disc-primary-val"
                  type="number"
                  min={0}
                  step="any"
                  value={primaryDiscountValue}
                  onChange={(e) => setPrimaryDiscountValue(Number(e.target.value))}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 font-mono text-base font-semibold"
                />
              </div>
            </div>
          </div>

          {primaryDiscountMode === "percent" && (
            <div>
              <span className="block text-xs font-semibold text-muted-foreground">
                Quick Sale Presets:
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {[5, 10, 15, 20, 25, 30, 40, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPrimaryDiscountValue(pct)}
                    className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
                      primaryDiscountValue === pct
                        ? "border-foreground bg-foreground text-background"
                        : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {pct}% Off
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="disc-extra-pct"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Additional Stacked Discount (%)
              </label>
              <input
                id="disc-extra-pct"
                type="number"
                min={0}
                max={100}
                step="any"
                value={extraDiscountPercent}
                onChange={(e) => setExtraDiscountPercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="disc-tax-pct"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Sales Tax on Discounted Price (%)
              </label>
              <input
                id="disc-tax-pct"
                type="number"
                min={0}
                max={100}
                step="any"
                value={salesTaxPercent}
                onChange={(e) => setSalesTaxPercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Discount Breakdown Card */}
        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-5">
          <h3 className="border-b pb-3 text-base font-bold text-foreground">
            Savings & Final Total
          </h3>

          {!result.ok ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{result.error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-background p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground">Total You Save</p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">
                    {formatMoney(result.totalSavings, currency)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Effective {result.effectiveDiscountPercent}% off
                  </p>
                </div>

                <div className="rounded-2xl border bg-background p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Subtotal After Discounts
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold text-foreground">
                    {formatMoney(result.subtotalAfterDiscounts, currency)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Tax: +{formatMoney(result.taxAmount, currency)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-xs font-bold uppercase tracking-wider opacity-85">
                  Final Payable Total (Incl. Tax)
                </p>
                <p className="mt-1 font-mono text-3xl font-extrabold">
                  {formatMoney(result.finalPayable, currency)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Percentage Calculators */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
          <h3 className="text-base font-bold text-foreground">
            Percentage of a Number (What is X% of Y?)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Percentage (X%)
              </label>
              <input
                type="number"
                step="any"
                value={pctX}
                onChange={(e) => setPctX(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Base Value (Y)
              </label>
              <input
                type="number"
                step="any"
                value={pctY}
                onChange={(e) => setPctY(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <span className="text-xs text-muted-foreground">
              {pctX}% of {pctY} equals:
            </span>
            <p className="font-mono text-2xl font-bold text-foreground">{pctOfValue}</p>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
          <h3 className="text-base font-bold text-foreground">Percentage Change (From A to B)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Starting Value (A)
              </label>
              <input
                type="number"
                step="any"
                value={changeFrom}
                onChange={(e) => setChangeFrom(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                New Value (B)
              </label>
              <input
                type="number"
                step="any"
                value={changeTo}
                onChange={(e) => setChangeTo(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            {!pctChangeRes.ok ? (
              <p className="text-xs text-destructive">{pctChangeRes.error}</p>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">
                  Change from {changeFrom} to {changeTo}:
                </span>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {pctChangeRes.direction === "increase"
                    ? `+${pctChangeRes.percentChange}% increase`
                    : pctChangeRes.direction === "decrease"
                      ? `-${pctChangeRes.percentChange}% decrease`
                      : "0% (unchanged)"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    (diff:{" "}
                    {pctChangeRes.difference > 0
                      ? `+${pctChangeRes.difference}`
                      : pctChangeRes.difference}
                    )
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BusinessToolWorkspace({ toolSlug }: { toolSlug: string }) {
  if (toolSlug === "quotation-generator") {
    return <CommercialDocumentWorkspace kind="quotation" />;
  }
  if (toolSlug === "tax-calculator") {
    return <TaxCalculatorWorkspace />;
  }
  if (toolSlug === "discount-calculator") {
    return <DiscountCalculatorWorkspace />;
  }
  return <CommercialDocumentWorkspace kind="invoice" />;
}
