import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/file-dropzone";
import {
  cloneDataset,
  csvToJson,
  jsonToCsv,
  parseCsv,
  removeDuplicateRows,
  SAMPLE_MESSY_CSV,
  serializeCsv,
  splitColumnByDelimiter,
  standardizeDateColumn,
  trimAndNormalizeColumns,
  type CsvDataset,
  type DateSourceOrder,
  type DateTargetFormat,
  type TextCaseMode,
} from "@/lib/data-tools";
import { downloadText, sanitizeFilename } from "@/lib/file-utils";

type WorkbenchTab = "dedupe" | "trim" | "dates" | "split";

interface HistoryStep {
  label: string;
  dataset: CsvDataset;
  warnings?: string[];
}

function initialTabForSlug(slug: string): WorkbenchTab {
  if (slug === "remove-duplicates") return "dedupe";
  if (slug === "trim-normalize") return "trim";
  if (slug === "date-standardizer") return "dates";
  if (slug === "column-splitter") return "split";
  return "dedupe";
}

function DataTablePreview({
  title,
  dataset,
  maxRows = 100,
}: {
  title: string;
  dataset: CsvDataset;
  maxRows?: number;
}) {
  const visibleRows = dataset.rows.slice(0, maxRows);

  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold text-foreground">
        <span>{title}</span>
        <span className="text-muted-foreground">
          {dataset.rows.length} {dataset.rows.length === 1 ? "row" : "rows"} ×{" "}
          {dataset.headers.length} {dataset.headers.length === 1 ? "column" : "columns"}
          {dataset.rows.length > maxRows ? ` (showing first ${maxRows})` : ""}
        </span>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-muted text-foreground">
            <tr>
              <th className="border-b border-r px-3 py-2 font-mono text-[11px] text-muted-foreground">
                #
              </th>
              {dataset.headers.map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className="border-b border-r px-3 py-2 font-semibold last:border-r-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y font-mono">
            {visibleRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/30">
                <td className="border-r bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
                  {rIdx + 1}
                </td>
                {dataset.headers.map((_, cIdx) => {
                  const val = row[cIdx] ?? "";
                  return (
                    <td key={cIdx} className="border-r px-3 py-1.5 whitespace-pre last:border-r-0">
                      {val === "" ? (
                        <span className="italic text-muted-foreground/50">empty</span>
                      ) : (
                        val
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CsvWorkbenchTool({ toolSlug }: { toolSlug: string }) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>(() => initialTabForSlug(toolSlug));
  const [files, setFiles] = useState<File[]>([]);
  const [rawPaste, setRawPaste] = useState("");
  const [sourceFilename, setSourceFilename] = useState("cleaned-data.csv");
  const [originalDataset, setOriginalDataset] = useState<CsvDataset | null>(null);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"after" | "before" | "side-by-side">(
    "side-by-side",
  );
  const [copied, setCopied] = useState(false);

  // Operation 1: Remove Duplicates state
  const [dedupeSelectedCols, setDedupeSelectedCols] = useState<number[]>([]);
  const [dedupeCaseInsensitive, setDedupeCaseInsensitive] = useState(true);
  const [dedupeIgnoreSpaces, setDedupeIgnoreSpaces] = useState(true);

  // Operation 2: Trim & Normalize state
  const [trimSelectedCols, setTrimSelectedCols] = useState<number[]>([]);
  const [trimSpaces, setTrimSpaces] = useState(true);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [caseMode, setCaseMode] = useState<TextCaseMode>("none");

  // Operation 3: Standardize Dates state
  const [dateColIndex, setDateColIndex] = useState(0);
  const [dateTargetFormat, setDateTargetFormat] = useState<DateTargetFormat>("YYYY-MM-DD");
  const [dateSourceOrder, setDateSourceOrder] = useState<DateSourceOrder>("DMY");

  // Operation 4: Split Column state
  const [splitColIndex, setSplitColIndex] = useState(0);
  const [splitDelimiter, setSplitDelimiter] = useState("|");
  const [splitPrefix, setSplitPrefix] = useState("");
  const [splitRemoveOrig, setSplitRemoveOrig] = useState(false);

  useEffect(() => {
    setActiveTab(initialTabForSlug(toolSlug));
  }, [toolSlug]);

  const currentDataset =
    history.length > 0
      ? (history[history.length - 1]?.dataset ?? originalDataset)
      : originalDataset;

  const loadCsvString = (csvText: string, filename = "dataset.csv") => {
    setError(null);
    setParseWarnings([]);
    const res = parseCsv(csvText);
    if (!res.ok) {
      setError(res.error ?? "Failed to parse CSV.");
      setOriginalDataset(null);
      setHistory([]);
      return;
    }
    setOriginalDataset(res.dataset);
    setHistory([]);
    setParseWarnings(res.warnings);
    setSourceFilename(filename);
    setDedupeSelectedCols([]);
    setTrimSelectedCols([]);

    // Pre-select a likely date column if one exists
    const dateIdx = res.dataset.headers.findIndex((h) => /date|time|created|signup|dob/i.test(h));
    setDateColIndex(dateIdx >= 0 ? dateIdx : 0);

    // Pre-select a likely splittable column if one exists
    const splitIdx = res.dataset.headers.findIndex((h) =>
      /plan|name|full|address|category|tags/i.test(h),
    );
    setSplitColIndex(splitIdx >= 0 ? splitIdx : 0);
  };

  useEffect(() => {
    const file = files[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        setRawPaste(text);
        loadCsvString(text, file.name);
      })
      .catch(() => {
        setError("Could not read the uploaded CSV file.");
      });
  }, [files]);

  const handleLoadSample = () => {
    setFiles([]);
    setRawPaste(SAMPLE_MESSY_CSV);
    loadCsvString(SAMPLE_MESSY_CSV, "sample-customers.csv");
  };

  const applyRemoveDuplicates = () => {
    if (!currentDataset) return;
    setError(null);
    const res = removeDuplicateRows(currentDataset, {
      keyColumns: dedupeSelectedCols,
      caseInsensitive: dedupeCaseInsensitive,
      ignoreSurroundingWhitespace: dedupeIgnoreSpaces,
    });
    setHistory((prev) => [...prev, { label: res.summary, dataset: res.dataset }]);
  };

  const applyTrimNormalize = () => {
    if (!currentDataset) return;
    setError(null);
    const res = trimAndNormalizeColumns(currentDataset, {
      columnIndices: trimSelectedCols,
      trimWhitespace: trimSpaces,
      collapseInnerSpaces: collapseSpaces,
      caseMode,
    });
    setHistory((prev) => [...prev, { label: res.summary, dataset: res.dataset }]);
  };

  const applyDateStandardization = () => {
    if (!currentDataset) return;
    setError(null);
    const res = standardizeDateColumn(currentDataset, {
      columnIndex: dateColIndex,
      targetFormat: dateTargetFormat,
      sourceOrder: dateSourceOrder,
    });
    setHistory((prev) => [
      ...prev,
      {
        label: res.summary,
        dataset: res.dataset,
        ...(res.skippedWarnings.length > 0 ? { warnings: res.skippedWarnings } : {}),
      },
    ]);
  };

  const applySplitColumn = () => {
    if (!currentDataset) return;
    setError(null);
    const res = splitColumnByDelimiter(currentDataset, {
      columnIndex: splitColIndex,
      delimiter: splitDelimiter,
      removeOriginal: splitRemoveOrig,
      ...(splitPrefix.trim() ? { newColumnPrefix: splitPrefix.trim() } : {}),
    });
    if (!res.ok) {
      setError(res.error ?? "Could not split column.");
      return;
    }
    setHistory((prev) => [...prev, { label: res.summary, dataset: res.dataset }]);
  };

  const toggleIndex = (list: number[], idx: number): number[] =>
    list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx];

  const latestStepWarnings =
    history.length > 0 ? (history[history.length - 1]?.warnings ?? []) : [];

  return (
    <div className="space-y-8">
      {/* Step 1: Import or Paste CSV */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">1. Import CSV Data</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample Messy CSV
            </button>
            {originalDataset && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setRawPaste("");
                  setOriginalDataset(null);
                  setHistory([]);
                  setParseWarnings([]);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear Dataset
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <FileDropzone
            label="Drop a .csv file here"
            description="RFC-4180 CSV up to 50 MB. Processed locally in your browser."
            accept=".csv,text/csv,text/plain"
            validation={{
              allowedExtensions: ["csv", "txt"],
              maxSizeBytes: 50 * 1024 * 1024,
            }}
            files={files}
            onFilesChange={setFiles}
          />

          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="csv-paste-input" className="text-sm font-semibold text-foreground">
                Or Paste Raw CSV Text
              </label>
              <button
                type="button"
                disabled={!rawPaste.trim()}
                onClick={() => loadCsvString(rawPaste, "pasted-data.csv")}
                className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
              >
                Parse Pasted CSV
              </button>
            </div>
            <textarea
              id="csv-paste-input"
              rows={6}
              value={rawPaste}
              onChange={(e) => setRawPaste(e.target.value)}
              placeholder={'Name,Email,Signup Date\n"Ada Lovelace",ada@example.com,2026-10-27'}
              className="w-full flex-1 rounded-2xl border bg-background p-3.5 font-mono text-xs text-foreground outline-none focus:border-foreground"
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {parseWarnings.length > 0 && (
        <div role="status" className="rounded-2xl border bg-muted p-4 text-xs text-foreground">
          <p className="font-semibold">CSV Import Notes:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {parseWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 2: Cleaning Operations Workbench */}
      {originalDataset && currentDataset && (
        <div className="space-y-6">
          <div className="rounded-3xl border bg-muted/30 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <h2 className="text-lg font-bold text-foreground">
                2. Select & Apply Cleaning Operations
              </h2>
              <div
                role="tablist"
                aria-label="Data cleaning operations"
                className="flex flex-wrap gap-2"
              >
                {(
                  [
                    ["dedupe", "Remove Duplicates"],
                    ["trim", "Trim & Normalize"],
                    ["dates", "Standardize Dates"],
                    ["split", "Split Column"],
                  ] as const
                ).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeTab === tabKey
                        ? "bg-primary text-primary-foreground shadow-card"
                        : "border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab 1: Remove Duplicates */}
            {activeTab === "dedupe" && (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Columns to check for duplicate values (leave all unchecked to compare entire
                    rows):
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentDataset.headers.map((h, idx) => {
                      const active = dedupeSelectedCols.includes(idx);
                      return (
                        <button
                          key={`${h}-${idx}`}
                          type="button"
                          onClick={() => setDedupeSelectedCols((prev) => toggleIndex(prev, idx))}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={dedupeCaseInsensitive}
                      onChange={(e) => setDedupeCaseInsensitive(e.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    Case-insensitive comparison (e.g. "ALICE" = "alice")
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={dedupeIgnoreSpaces}
                      onChange={(e) => setDedupeIgnoreSpaces(e.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    Ignore leading/trailing spaces when comparing
                  </label>
                </div>

                <button
                  type="button"
                  onClick={applyRemoveDuplicates}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Apply Remove Duplicates
                </button>
              </div>
            )}

            {/* Tab 2: Trim & Normalize */}
            {activeTab === "trim" && (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">
                    Target columns (leave all unchecked to clean all columns):
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentDataset.headers.map((h, idx) => {
                      const active = trimSelectedCols.includes(idx);
                      return (
                        <button
                          key={`${h}-${idx}`}
                          type="button"
                          onClick={() => setTrimSelectedCols((prev) => toggleIndex(prev, idx))}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={trimSpaces}
                      onChange={(e) => setTrimSpaces(e.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    Trim leading & trailing whitespace
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={collapseSpaces}
                      onChange={(e) => setCollapseSpaces(e.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    Collapse multiple internal spaces
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    Text Case
                    <select
                      aria-label="Text Case Normalization"
                      value={caseMode}
                      onChange={(e) =>
                        setCaseMode(
                          e.target.value === "upper"
                            ? "upper"
                            : e.target.value === "lower"
                              ? "lower"
                              : e.target.value === "title"
                                ? "title"
                                : "none",
                        )
                      }
                      className="rounded-xl border bg-card px-3 py-1.5 text-sm font-medium"
                    >
                      <option value="none">Keep existing case</option>
                      <option value="title">Title Case</option>
                      <option value="lower">lowercase</option>
                      <option value="upper">UPPERCASE</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={applyTrimNormalize}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Apply Trim & Normalize
                </button>
              </div>
            )}

            {/* Tab 3: Standardize Dates */}
            {activeTab === "dates" && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label
                      htmlFor="date-col-select"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Date Column
                    </label>
                    <select
                      id="date-col-select"
                      value={String(dateColIndex)}
                      onChange={(e) => setDateColIndex(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 text-sm font-medium"
                    >
                      {currentDataset.headers.map((h, idx) => (
                        <option key={`${h}-${idx}`} value={String(idx)}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="date-target-format"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Target Date Format
                    </label>
                    <select
                      id="date-target-format"
                      value={dateTargetFormat}
                      onChange={(e) =>
                        setDateTargetFormat(
                          e.target.value === "DD/MM/YYYY"
                            ? "DD/MM/YYYY"
                            : e.target.value === "MM/DD/YYYY"
                              ? "MM/DD/YYYY"
                              : "YYYY-MM-DD",
                        )
                      }
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 text-sm font-medium"
                    >
                      <option value="YYYY-MM-DD">ISO (YYYY-MM-DD)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="date-source-order"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Numeric Slash Date Order
                    </label>
                    <select
                      id="date-source-order"
                      value={dateSourceOrder}
                      onChange={(e) =>
                        setDateSourceOrder(
                          e.target.value === "MDY"
                            ? "MDY"
                            : e.target.value === "DMY"
                              ? "DMY"
                              : e.target.value === "YMD"
                                ? "YMD"
                                : "auto",
                        )
                      }
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 text-sm font-medium"
                    >
                      <option value="DMY">Day / Month / Year (DD/MM/YYYY)</option>
                      <option value="MDY">Month / Day / Year (MM/DD/YYYY)</option>
                      <option value="auto">Strict Auto (skip ambiguous slash dates)</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Unparseable or invalid date cells are never overwritten — their original values
                  are preserved and listed below.
                </p>

                <button
                  type="button"
                  onClick={applyDateStandardization}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Apply Date Standardization
                </button>
              </div>
            )}

            {/* Tab 4: Split Column */}
            {activeTab === "split" && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label
                      htmlFor="split-col-select"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Column to Split
                    </label>
                    <select
                      id="split-col-select"
                      value={String(splitColIndex)}
                      onChange={(e) => setSplitColIndex(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 text-sm font-medium"
                    >
                      {currentDataset.headers.map((h, idx) => (
                        <option key={`${h}-${idx}`} value={String(idx)}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="split-delimiter-input"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      Delimiter (e.g. | , - / or space)
                    </label>
                    <input
                      id="split-delimiter-input"
                      type="text"
                      value={splitDelimiter}
                      onChange={(e) => setSplitDelimiter(e.target.value)}
                      placeholder="|"
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="split-prefix-input"
                      className="block text-xs font-semibold text-muted-foreground"
                    >
                      New Column Name Prefix (optional)
                    </label>
                    <input
                      id="split-prefix-input"
                      type="text"
                      value={splitPrefix}
                      onChange={(e) => setSplitPrefix(e.target.value)}
                      placeholder="Defaults to column name"
                      className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={splitRemoveOrig}
                    onChange={(e) => setSplitRemoveOrig(e.target.checked)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Remove original unsplit column after splitting
                </label>

                <div>
                  <button
                    type="button"
                    onClick={applySplitColumn}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Apply Column Split
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Operation Pipeline, Undo/Reset & Export Controls */}
          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <History className="h-4 w-4" aria-hidden /> Cleaning Pipeline ({history.length}{" "}
                  {history.length === 1 ? "operation" : "operations"} applied)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Original: <strong>{originalDataset.rows.length} rows</strong> (
                  {originalDataset.headers.length} cols) → Current:{" "}
                  <strong>{currentDataset.rows.length} rows</strong> (
                  {currentDataset.headers.length} cols)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={history.length === 0}
                  onClick={() => setHistory((prev) => prev.slice(0, -1))}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo Last Step
                </button>
                <button
                  type="button"
                  disabled={history.length === 0}
                  onClick={() => setHistory([])}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to Original
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const out = serializeCsv(currentDataset);
                    void navigator.clipboard?.writeText(out);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Copied CSV
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden /> Copy CSV
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const out = serializeCsv(currentDataset);
                    const base = sanitizeFilename(sourceFilename.replace(/\.csv$/i, ""));
                    downloadText(out, `${base}-cleaned.csv`, "text/csv;charset=utf-8");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background transition hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Export Cleaned CSV
                </button>
              </div>
            </div>

            {history.length > 0 && (
              <ol className="mt-4 flex flex-wrap gap-2">
                {history.map((step, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/30 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    <span className="font-bold">{i + 1}.</span> {step.label}
                  </li>
                ))}
              </ol>
            )}

            {latestStepWarnings.length > 0 && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
              >
                <p className="font-semibold">
                  Validation Warnings (Original cell values preserved):
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {latestStepWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Before & After Preview Mode Selector */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-foreground">
                3. Data Preview (Before & After)
              </h4>
              <div
                role="group"
                aria-label="Preview layout mode"
                className="inline-flex rounded-full border bg-muted/40 p-1"
              >
                <button
                  type="button"
                  onClick={() => setPreviewMode("side-by-side")}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                    previewMode === "side-by-side"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("after")}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                    previewMode === "after"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Cleaned (After)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("before")}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                    previewMode === "before"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Original (Before)
                </button>
              </div>
            </div>

            <div
              className={`mt-3 grid gap-4 ${
                previewMode === "side-by-side" ? "lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {(previewMode === "before" || previewMode === "side-by-side") && (
                <DataTablePreview
                  title="Original Data (Before Cleaning)"
                  dataset={cloneDataset(originalDataset)}
                />
              )}
              {(previewMode === "after" || previewMode === "side-by-side") && (
                <DataTablePreview
                  title="Cleaned Data (After Operations)"
                  dataset={currentDataset}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CsvJsonConverterTool() {
  const [direction, setDirection] = useState<"csv-to-json" | "json-to-csv">("csv-to-json");
  const [inferTypes, setInferTypes] = useState(true);
  const [pretty, setPretty] = useState(true);
  const [flattenNested, setFlattenNested] = useState(true);
  const [delimiter, setDelimiter] = useState<string>(",");
  const [files, setFiles] = useState<File[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const file = files[0];
    if (!file) return;
    file
      .text()
      .then((txt) => {
        setInput(txt);
        if (file.name.toLowerCase().endsWith(".json")) {
          setDirection("json-to-csv");
        } else if (
          file.name.toLowerCase().endsWith(".csv") ||
          file.name.toLowerCase().endsWith(".tsv")
        ) {
          setDirection("csv-to-json");
        }
      })
      .catch(() => {
        // handled by validation if invalid
      });
  }, [files]);

  const result =
    input.trim() === ""
      ? null
      : direction === "csv-to-json"
        ? csvToJson(input, { inferTypes, pretty, delimiter })
        : jsonToCsv(input, { delimiter, flattenNested });

  const sampleInput =
    direction === "csv-to-json"
      ? `Product,Category,Price,InStock\n"Mechanical Keyboard",Hardware,129.99,true\n"USB-C Dock, 10-in-1",Accessories,79.50,true\n"Ergonomic Mouse",Hardware,59.00,false`
      : `[\n  {\n    "Product": "Mechanical Keyboard",\n    "Category": "Hardware",\n    "Price": 129.99,\n    "InStock": true,\n    "Vendor": { "Name": "KeyCraft", "Region": "US" }\n  },\n  {\n    "Product": "USB-C Dock, 10-in-1",\n    "Category": "Accessories",\n    "Price": 79.5,\n    "InStock": true,\n    "Vendor": { "Name": "PortHub", "Region": "EU" }\n  }\n]`;

  return (
    <div className="space-y-6">
      <FileDropzone
        files={files}
        onFilesChange={setFiles}
        multiple={false}
        accept=".csv,.tsv,.json,text/csv,application/json,text/plain"
        allowedExtensions={["csv", "tsv", "json", "txt"]}
        maxSizeBytes={10 * 1024 * 1024}
        label="Drop a .CSV or .JSON file here, or click to browse"
        hint="Automatically detects direction from file extension — processed 100% in your browser."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Conversion direction"
            className="inline-flex rounded-full border bg-card p-1"
          >
            <button
              type="button"
              onClick={() => setDirection("csv-to-json")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                direction === "csv-to-json"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              CSV → JSON
            </button>
            <button
              type="button"
              onClick={() => setDirection("json-to-csv")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                direction === "json-to-csv"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              JSON → CSV
            </button>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>CSV Delimiter:</span>
            <select
              aria-label="CSV delimiter"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className="bg-transparent font-mono text-xs outline-none"
            >
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={"\t"}>Tab (\t)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </label>

          {direction === "csv-to-json" ? (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={inferTypes}
                  onChange={(e) => setInferTypes(e.target.checked)}
                  className="h-4 w-4 accent-foreground"
                />
                Infer numbers & booleans
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={pretty}
                  onChange={(e) => setPretty(e.target.checked)}
                  className="h-4 w-4 accent-foreground"
                />
                Pretty-print JSON
              </label>
            </>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={flattenNested}
                onChange={(e) => setFlattenNested(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              Flatten nested JSON objects
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result?.ok}
            onClick={() => {
              if (result?.ok) {
                setInput(result.output);
                setDirection(direction === "csv-to-json" ? "json-to-csv" : "csv-to-json");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Swap
          </button>
          <button
            type="button"
            onClick={() => setInput(sampleInput)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample Input
          </button>
          <button
            type="button"
            disabled={!input}
            onClick={() => {
              setInput("");
              setFiles([]);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{result.error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="csv-json-input" className="text-sm font-semibold text-foreground">
              {direction === "csv-to-json" ? "CSV Input" : "JSON Array Input"}
            </label>
          </div>
          <textarea
            id="csv-json-input"
            rows={12}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              direction === "csv-to-json"
                ? "Paste CSV data with headers on row 1..."
                : 'Paste JSON array of objects (e.g. [{"name": "Ada"}])...'
            }
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="csv-json-output" className="text-sm font-semibold text-foreground">
              {direction === "csv-to-json" ? "JSON Output" : "CSV Output"}
              {result?.ok ? ` (${result.rowCount} records)` : ""}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!result?.ok}
                onClick={() => {
                  if (result?.ok) {
                    void navigator.clipboard?.writeText(result.output);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!result?.ok}
                onClick={() => {
                  if (!result?.ok) return;
                  if (direction === "csv-to-json") {
                    downloadText(result.output, "converted.json", "application/json;charset=utf-8");
                  } else {
                    downloadText(result.output, "converted.csv", "text/csv;charset=utf-8");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </button>
            </div>
          </div>
          <textarea
            id="csv-json-output"
            rows={12}
            readOnly
            value={result?.ok ? result.output : ""}
            placeholder="Converted output will appear here..."
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export function DataToolWorkspace({ toolSlug }: { toolSlug: string }) {
  if (toolSlug === "csv-json") {
    return <CsvJsonConverterTool />;
  }
  return <CsvWorkbenchTool toolSlug={toolSlug} />;
}
