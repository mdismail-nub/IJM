import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  GitCompare,
  Hash,
  ListChecks,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/file-dropzone";
import { parseCsv, serializeCsv, type CsvDataset } from "@/lib/data-tools";
import { downloadBytes, downloadText, formatBytes, sanitizeFilename } from "@/lib/file-utils";
import { analyzeTextCounts } from "@/lib/release1-tools";
import {
  buildExcelFormula,
  buildSqlQuery,
  calculateHabitMetrics,
  compareTwoCsvFiles,
  convertCsvDelimiter,
  convertHtmlToMarkdown,
  convertJsonToExcelData,
  convertMarkdownToHtml,
  evaluateScientificExpression,
  EXCEL_FORMULA_CATALOG,
  extractCsvColumns,
  formatCssStylesheet,
  formatSqlQuery,
  generateAllHashes,
  generateFormattedCitation,
  generateProjectTimeline,
  generateSampleExcelWorkbookBytes,
  isRelease3ToolSlug,
  minifyCodeSource,
  parseExcelBufferToSheets,
  solveLinearEquation,
  solveLinearSystem2x2,
  solveQuadraticEquation,
  type AngleUnit,
  type CitationAuthor,
  type CitationSourceType,
  type CitationStyle,
  type CodeMinifierLanguage,
  type ExcelFormulaId,
  type HabitItem,
  type HashDigestSuite,
  type Release3ToolSlug,
  type SpreadsheetSheet,
  type SqlWhereCondition,
  type TimelineTaskInput,
} from "@/lib/release3-tools";

export { isRelease3ToolSlug };

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={() => {
        if (!text) return;
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden /> {label}
        </>
      )}
    </button>
  );
}

function SimpleDatasetTable({
  title,
  dataset,
  maxRows = 50,
}: {
  title: string;
  dataset: CsvDataset;
  maxRows?: number;
}) {
  const rows = dataset.rows.slice(0, maxRows);
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold">
        <span className="truncate">{title}</span>
        <span className="shrink-0 text-muted-foreground">
          {dataset.rows.length} rows × {dataset.headers.length} columns
        </span>
      </div>
      <div className="max-h-72 w-full overflow-x-auto overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-muted">
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
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/25">
                <td className="border-r bg-muted/15 px-3 py-1.5 text-[11px] text-muted-foreground">
                  {rIdx + 1}
                </td>
                {dataset.headers.map((_, cIdx) => (
                  <td key={cIdx} className="border-r px-3 py-1.5 whitespace-pre last:border-r-0">
                    {row[cIdx] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 1. EXCEL TO CSV CONVERTER
// ============================================================================

function ExcelToCsvTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [delimiter, setDelimiter] = useState<string>(",");
  const [sourceName, setSourceName] = useState("workbook");
  const [error, setError] = useState<string | null>(null);

  const loadBytes = async (bytes: Uint8Array, name: string) => {
    setError(null);
    const res = await parseExcelBufferToSheets(bytes, name);
    if (!res.ok) {
      setError(res.error ?? "Could not parse Excel workbook.");
      setSheets([]);
      return;
    }
    setSheets(res.sheets);
    setActiveSheetIdx(0);
    setSourceName(name.replace(/\.[^.]+$/, "") || "workbook");
  };

  useEffect(() => {
    const file = files[0];
    if (!file) return;
    file
      .arrayBuffer()
      .then((buf) => loadBytes(new Uint8Array(buf), file.name))
      .catch(() => setError("Failed to read uploaded spreadsheet file."));
  }, [files]);

  const activeSheet = sheets[activeSheetIdx] ?? sheets[0];
  const csvOutput = activeSheet ? serializeCsv(activeSheet.dataset, delimiter) : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const sampleBytes = generateSampleExcelWorkbookBytes();
              void loadBytes(sampleBytes, "q4-sales-report.xlsx");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample .XLSX Workbook
          </button>

          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Output Delimiter:</span>
            <select
              aria-label="Output CSV delimiter"
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
        </div>

        {sheets.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              setSheets([]);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Reset
          </button>
        )}
      </div>

      <FileDropzone
        files={files}
        onFilesChange={setFiles}
        multiple={false}
        accept=".xlsx,.xls,.xml,.tsv,.csv"
        allowedExtensions={["xlsx", "xls", "xml", "tsv", "csv"]}
        maxSizeBytes={25 * 1024 * 1024}
        label="Drop an Excel .XLSX workbook or spreadsheet here"
        hint="Supports multi-sheet .xlsx archives, TSV exports, and CSV files — parsed 100% locally."
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {activeSheet && (
        <div className="space-y-5">
          {sheets.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Worksheet Tabs ({sheets.length}):
              </span>
              {sheets.map((s, idx) => (
                <button
                  key={`${s.name}-${idx}`}
                  type="button"
                  onClick={() => setActiveSheetIdx(idx)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    idx === activeSheetIdx
                      ? "bg-foreground text-background"
                      : "border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {s.name} ({s.dataset.rows.length})
                </button>
              ))}
            </div>
          )}

          <SimpleDatasetTable
            title={`Worksheet Preview: ${activeSheet.name}`}
            dataset={activeSheet.dataset}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="excel-csv-output" className="text-sm font-semibold">
                Generated CSV Output ({activeSheet.dataset.rows.length} rows)
              </label>
              <div className="flex items-center gap-2">
                <CopyButton text={csvOutput} label="Copy CSV" />
                <button
                  type="button"
                  onClick={() => {
                    const outName = sanitizeFilename(
                      `${sourceName}-${activeSheet.name}.csv`,
                      "converted.csv",
                    );
                    downloadText(csvOutput, outName, "text/csv;charset=utf-8");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download .CSV
                </button>
              </div>
            </div>
            <textarea
              id="excel-csv-output"
              readOnly
              rows={8}
              value={csvOutput}
              className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs text-foreground outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. CSV COLUMN EXTRACTOR
// ============================================================================

const SAMPLE_EXTRACTOR_CSV = `OrderID,CustomerName,Email,Country,PlanTier,MonthlyUSD,SignupDate
ORD-501,Alice Johnson,alice@example.com,United States,Enterprise,499,2026-01-14
ORD-502,Benoit Dubois,benoit@example.fr,France,Pro,99,2026-02-03
ORD-503,Chihiro Sato,chihiro@example.jp,Japan,Enterprise,499,2026-02-19
ORD-504,Diego Morales,diego@example.mx,Mexico,Starter,29,2026-03-05`;

function CsvColumnExtractorTool() {
  const [rawCsv, setRawCsv] = useState(SAMPLE_EXTRACTOR_CSV);
  const [selectedCols, setSelectedCols] = useState<number[]>([0, 1, 4, 5]);
  const [skipEmptyRows, setSkipEmptyRows] = useState(true);

  const parsed = parseCsv(rawCsv);
  const headers = parsed.ok ? parsed.dataset.headers : [];

  const toggleColumn = (colIdx: number) => {
    setSelectedCols((prev) =>
      prev.includes(colIdx) ? prev.filter((i) => i !== colIdx) : [...prev, colIdx],
    );
  };

  const moveSelectedCol = (pos: number, dir: -1 | 1) => {
    const target = pos + dir;
    if (target < 0 || target >= selectedCols.length) return;
    setSelectedCols((prev) => {
      const next = [...prev];
      const temp = next[pos]!;
      next[pos] = next[target]!;
      next[target] = temp;
      return next;
    });
  };

  const extraction = extractCsvColumns(rawCsv, selectedCols, { skipEmptyRows });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCols(headers.map((_, i) => i))}
            className="rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Select All Columns
          </button>
          <button
            type="button"
            onClick={() => setSelectedCols([])}
            className="rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Deselect All
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={skipEmptyRows}
              onChange={(e) => setSkipEmptyRows(e.target.checked)}
              className="h-3.5 w-3.5 accent-foreground"
            />
            Skip rows where extracted cells are blank
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRawCsv(SAMPLE_EXTRACTOR_CSV);
              setSelectedCols([0, 1, 4, 5]);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample CSV
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="col-extractor-input" className="text-sm font-semibold">
              Source CSV Data
            </label>
            <textarea
              id="col-extractor-input"
              rows={8}
              value={rawCsv}
              onChange={(e) => {
                setRawCsv(e.target.value);
                const nextParsed = parseCsv(e.target.value);
                if (nextParsed.ok) {
                  setSelectedCols(nextParsed.dataset.headers.map((_, idx) => idx));
                }
              }}
              placeholder="Paste CSV with column headers on row 1..."
              className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
            />
          </div>

          {headers.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Toggle Columns to Extract ({selectedCols.length} of {headers.length} selected)
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {headers.map((h, idx) => {
                  const active = selectedCols.includes(idx);
                  return (
                    <button
                      key={`${h}-${idx}`}
                      type="button"
                      onClick={() => toggleColumn(idx)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {h}
                    </button>
                  );
                })}
              </div>

              {selectedCols.length > 1 && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Output Column Order (Click arrows to reorder)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCols.map((colIdx, pos) => (
                      <div
                        key={`${colIdx}-${pos}`}
                        className="inline-flex items-center gap-1 rounded-xl border bg-muted/40 px-2.5 py-1 text-xs font-semibold"
                      >
                        <button
                          type="button"
                          aria-label={`Move ${headers[colIdx]} left`}
                          disabled={pos === 0}
                          onClick={() => moveSelectedCol(pos, -1)}
                          className="p-0.5 hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <span>{headers[colIdx]}</span>
                        <button
                          type="button"
                          aria-label={`Move ${headers[colIdx]} right`}
                          disabled={pos === selectedCols.length - 1}
                          onClick={() => moveSelectedCol(pos, 1)}
                          className="p-0.5 hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!extraction.ok ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span>{extraction.error}</span>
            </div>
          ) : (
            <>
              <SimpleDatasetTable
                title="Extracted Columns Table Preview"
                dataset={extraction.dataset}
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="col-extractor-output" className="text-sm font-semibold">
                    Extracted CSV Output
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={extraction.outputCsv} />
                    <button
                      type="button"
                      onClick={() =>
                        downloadText(
                          extraction.outputCsv,
                          "extracted-columns.csv",
                          "text/csv;charset=utf-8",
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden /> Download .CSV
                    </button>
                  </div>
                </div>
                <textarea
                  id="col-extractor-output"
                  readOnly
                  rows={6}
                  value={extraction.outputCsv}
                  className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. CSV DELIMITER CONVERTER
// ============================================================================

function CsvDelimiterConverterTool() {
  const [rawInput, setRawInput] = useState(
    `SKU,Product Name,Warehouse,Quantity\n"KB-100","Mechanical Keyboard, RGB",Austin,140\n"MS-200","Wireless Mouse; Pro",Berlin,85`,
  );
  const [sourceDelim, setSourceDelim] = useState<string>("auto");
  const [targetDelim, setTargetDelim] = useState<string>(";");

  const converted = convertCsvDelimiter(rawInput, sourceDelim, targetDelim);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Input Delimiter:</span>
            <select
              aria-label="Source delimiter"
              value={sourceDelim}
              onChange={(e) => setSourceDelim(e.target.value)}
              className="bg-transparent font-mono text-xs outline-none"
            >
              <option value="auto">Auto-Detect</option>
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={"\t"}>Tab (\t)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Target Delimiter:</span>
            <select
              aria-label="Target delimiter"
              value={targetDelim}
              onChange={(e) => setTargetDelim(e.target.value)}
              className="bg-transparent font-mono text-xs outline-none"
            >
              <option value=";">Semicolon (;)</option>
              <option value=",">Comma (,)</option>
              <option value={"\t"}>Tab / TSV (\t)</option>
              <option value="|">Pipe (|)</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() =>
            setRawInput(
              `SKU,Product Name,Warehouse,Quantity\n"KB-100","Mechanical Keyboard, RGB",Austin,140\n"MS-200","Wireless Mouse; Pro",Berlin,85`,
            )
          }
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample CSV
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="delim-source-input" className="text-sm font-semibold">
            Input CSV / TSV
          </label>
          <textarea
            id="delim-source-input"
            rows={10}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="delim-target-output" className="text-sm font-semibold">
              Converted Output{" "}
              {converted.ok ? `(${converted.rowCount} rows × ${converted.columnCount} cols)` : ""}
            </label>
            <div className="flex items-center gap-2">
              <CopyButton text={converted.output} />
              <button
                type="button"
                disabled={!converted.ok}
                onClick={() =>
                  downloadText(
                    converted.output,
                    targetDelim === "\t" ? "converted.tsv" : "converted.csv",
                    "text/csv;charset=utf-8",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </button>
            </div>
          </div>
          <textarea
            id="delim-target-output"
            readOnly
            rows={10}
            value={converted.ok ? converted.output : (converted.error ?? "")}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. EXCEL FORMULA HELPER
// ============================================================================

function ExcelFormulaHelperTool() {
  const [selectedId, setSelectedId] = useState<ExcelFormulaId>("xlookup");
  const [params, setParams] = useState<Record<string, string>>({});
  const [wrapIfError, setWrapIfError] = useState(false);
  const [ifErrorFallback, setIfErrorFallback] = useState("0");
  const [argSeparator, setArgSeparator] = useState<"," | ";">(",");

  const activeSpec =
    EXCEL_FORMULA_CATALOG.find((f) => f.id === selectedId) ?? EXCEL_FORMULA_CATALOG[0]!;

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const p of activeSpec.paramLabels) {
      defaults[p.key] = p.defaultValue;
    }
    setParams(defaults);
  }, [activeSpec]);

  const built = buildExcelFormula(selectedId, params, {
    wrapIfError,
    ifErrorFallback,
    argSeparator,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          <label htmlFor="excel-formula-select" className="text-sm font-bold">
            1. Choose Spreadsheet Formula Template
          </label>
          <select
            id="excel-formula-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value as ExcelFormulaId)}
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-foreground"
          >
            {EXCEL_FORMULA_CATALOG.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — [{item.category}]
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{activeSpec.summary}</p>

          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. Configure Cell References & Criteria
            </p>
            {activeSpec.paramLabels.map((param) => (
              <div key={param.key} className="space-y-1">
                <label
                  htmlFor={`formula-param-${param.key}`}
                  className="text-xs font-semibold text-foreground"
                >
                  {param.label}
                </label>
                <input
                  id={`formula-param-${param.key}`}
                  type="text"
                  value={params[param.key] ?? ""}
                  placeholder={param.placeholder}
                  onChange={(e) => setParams((prev) => ({ ...prev, [param.key]: e.target.value }))}
                  className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={wrapIfError}
                  onChange={(e) => setWrapIfError(e.target.checked)}
                  className="h-4 w-4 accent-foreground"
                />
                Wrap in IFERROR(...)
              </label>
              {wrapIfError && (
                <input
                  type="text"
                  aria-label="IFERROR fallback text"
                  value={ifErrorFallback}
                  onChange={(e) => setIfErrorFallback(e.target.value)}
                  placeholder="Fallback value"
                  className="w-28 rounded-lg border bg-background px-2.5 py-1 font-mono text-xs"
                />
              )}
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span>Locale Separator:</span>
                <select
                  aria-label="Argument separator"
                  value={argSeparator}
                  onChange={(e) => setArgSeparator(e.target.value as "," | ";")}
                  className="rounded-lg border bg-background px-2 py-1 font-mono text-xs"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-3xl border bg-ink p-6 text-ink-foreground shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Ready-to-Paste Excel / Google Sheets Formula
              </span>
              <CopyButton text={built.formula} label="Copy Formula" />
            </div>
            <div className="mt-3 rounded-2xl bg-background/10 p-4 font-mono text-base font-bold text-primary md:text-lg">
              {built.formula}
            </div>
            <p className="mt-4 text-sm text-ink-foreground/85">{built.explanation}</p>
          </div>

          <div className="rounded-2xl border bg-muted/40 p-5">
            <h3 className="text-sm font-bold text-foreground">
              Formula Tips & Common Error Prevention
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
              {built.pitfalls.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. COMPARE TWO CSV FILES
// ============================================================================

const SAMPLE_COMPARE_CSV_A = `ID,Employee,Department,Salary,Status
EMP-01,Alice Wu,Engineering,135000,Active
EMP-02,Brian Patel,Product,122000,Active
EMP-03,Clara Gomez,Design,110000,Active
EMP-04,David Kim,Marketing,98000,On Leave`;

const SAMPLE_COMPARE_CSV_B = `ID,Employee,Department,Salary,Status
EMP-01,Alice Wu,Engineering,145000,Active
EMP-02,Brian Patel,Product,122000,Active
EMP-04,David Kim,Marketing,98000,Active
EMP-05,Elena Rossi,Security,138000,Active`;

function CompareCsvFilesTool() {
  const [csvA, setCsvA] = useState(SAMPLE_COMPARE_CSV_A);
  const [csvB, setCsvB] = useState(SAMPLE_COMPARE_CSV_B);
  const [matchByKey, setMatchByKey] = useState<"0" | "row-index">("0");
  const [ignoreCase, setIgnoreCase] = useState(false);

  const diff = compareTwoCsvFiles(csvA, csvB, {
    keyColumnIndex: matchByKey === "row-index" ? "row-index" : 0,
    ignoreCase,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Row Matching Mode:</span>
            <select
              aria-label="Row matching mode"
              value={matchByKey}
              onChange={(e) => setMatchByKey(e.target.value as "0" | "row-index")}
              className="bg-transparent text-xs outline-none"
            >
              <option value="0">First Column (Primary Key ID)</option>
              <option value="row-index">Exact Row Number (1-to-1)</option>
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(e) => setIgnoreCase(e.target.checked)}
              className="h-3.5 w-3.5 accent-foreground"
            />
            Case-insensitive comparison
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            setCsvA(SAMPLE_COMPARE_CSV_A);
            setCsvB(SAMPLE_COMPARE_CSV_B);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample CSV Pair
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="compare-csv-a" className="text-sm font-semibold">
            Base CSV (File A — Original)
          </label>
          <textarea
            id="compare-csv-a"
            rows={7}
            value={csvA}
            onChange={(e) => setCsvA(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="compare-csv-b" className="text-sm font-semibold">
            Comparison CSV (File B — Updated)
          </label>
          <textarea
            id="compare-csv-b"
            rows={7}
            value={csvB}
            onChange={(e) => setCsvB(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
      </div>

      {diff.ok ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Modified Rows</p>
              <p className="mt-1 text-2xl font-bold">{diff.modifiedCount}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Added Rows</p>
              <p className="mt-1 text-2xl font-bold">{diff.addedCount}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Removed Rows</p>
              <p className="mt-1 text-2xl font-bold">{diff.removedCount}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Identical Rows</p>
              <p className="mt-1 text-2xl font-bold">{diff.identicalCount}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-background">
            <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-bold">
              Row-by-Row Diff Breakdown
            </div>
            <div className="divide-y text-xs">
              {diff.rowComparisons.map((item, idx) => (
                <div
                  key={`${item.keyLabel}-${idx}`}
                  className="flex flex-col gap-1.5 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${
                        item.status === "added"
                          ? "bg-primary text-primary-foreground"
                          : item.status === "removed"
                            ? "bg-destructive/15 text-destructive"
                            : item.status === "modified"
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="font-mono font-bold">{item.keyLabel}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {item.status === "modified"
                      ? item.cellDiffs
                          .map((c) => `${c.columnHeader}: "${c.beforeValue}" → "${c.afterValue}"`)
                          .join(" | ")
                      : item.status === "added"
                        ? `New record: ${(item.rowB ?? []).join(", ")}`
                        : item.status === "removed"
                          ? `Removed record: ${(item.rowA ?? []).join(", ")}`
                          : "No cell differences"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {diff.error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. JSON TO EXCEL CONVERTER
// ============================================================================

const SAMPLE_JSON_TO_EXCEL = `[
  {
    "id": "INV-2026-01",
    "client": "Apex BioLabs",
    "billing": { "plan": "Enterprise", "amountUsd": 4800, "paid": true },
    "owner": "Sarah Chen"
  },
  {
    "id": "INV-2026-02",
    "client": "Veloce Motors",
    "billing": { "plan": "Growth", "amountUsd": 1650, "paid": true },
    "owner": "Marco Silva"
  },
  {
    "id": "INV-2026-03",
    "client": "Helios Solar",
    "billing": { "plan": "Enterprise", "amountUsd": 5200, "paid": false },
    "owner": "Sarah Chen"
  }
]`;

function JsonToExcelTool() {
  const [rawJson, setRawJson] = useState(SAMPLE_JSON_TO_EXCEL);
  const [flattenNested, setFlattenNested] = useState(true);
  const [sheetName, setSheetName] = useState("Invoices_2026");

  const result = convertJsonToExcelData(rawJson, { flattenNested, sheetName });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={flattenNested}
              onChange={(e) => setFlattenNested(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Flatten nested objects (e.g. billing.amountUsd)
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Sheet Name:</span>
            <input
              type="text"
              aria-label="Excel worksheet name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="w-32 bg-transparent font-mono text-xs outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRawJson(SAMPLE_JSON_TO_EXCEL)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample JSON
          </button>
          <button
            type="button"
            disabled={!result.ok}
            onClick={() => {
              if (!result.ok) return;
              downloadBytes(
                result.xlsxBytes,
                sanitizeFilename(`${sheetName || "export"}.xlsx`, "export.xlsx"),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Download .XLSX Workbook
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="json-excel-input" className="text-sm font-semibold">
            JSON Array Input
          </label>
          <textarea
            id="json-excel-input"
            rows={12}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-4">
          {result.ok ? (
            <>
              <SimpleDatasetTable
                title={`Excel Sheet Preview: ${sheetName || "Exported Data"}`}
                dataset={result.dataset}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/30 p-4 text-xs">
                <span>
                  Ready: <strong>{result.rowCount}</strong> rows ×{" "}
                  <strong>{result.columnCount}</strong> columns (
                  {formatBytes(result.xlsxBytes.byteLength)} .xlsx archive)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    downloadText(
                      serializeCsv(result.dataset),
                      `${sheetName || "export"}.csv`,
                      "text/csv;charset=utf-8",
                    )
                  }
                  className="font-semibold underline underline-offset-4"
                >
                  Also download as .CSV
                </button>
              </div>
            </>
          ) : (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {result.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7, 8, 9. MARKDOWN TO HTML, HTML TO MARKDOWN, MARKDOWN EDITOR & PREVIEW
// ============================================================================

const SAMPLE_MARKDOWN_DOC = `# Product Launch Checklist

Welcome to **IJM Release 3**. Everything processes *locally* in your browser.

## Key Capabilities

- [x] Standards-compliant CSV & Excel conversion
- [x] Zero server uploads or tracking
- [ ] Export final release notes

| Utility | Category | Status |
| --- | --- | --- |
| Excel to CSV | Data Tools | Tested |
| SQL Formatter | Developer Tools | Tested |

\`\`\`sql
SELECT id, name FROM tools WHERE status = 'tested';
\`\`\``;

function MarkdownSuiteTool({ mode }: { mode: "md-to-html" | "html-to-md" | "editor" }) {
  const [input, setInput] = useState(() =>
    mode === "html-to-md"
      ? `<h1>Release Notes</h1>\n<p>Built for <strong>fast local</strong> execution with <a href="https://ijm.app">IJM</a>.</p>\n<ul>\n  <li>Instant HTML to Markdown</li>\n  <li>Clean table conversion</li>\n</ul>`
      : SAMPLE_MARKDOWN_DOC,
  );
  const [wrapFullDoc, setWrapFullDoc] = useState(false);
  const [addHeadingIds, setAddHeadingIds] = useState(true);

  const htmlOutput =
    mode === "html-to-md"
      ? input
      : convertMarkdownToHtml(input, { wrapFullDocument: wrapFullDoc, addHeadingIds });

  const mdOutput = mode === "html-to-md" ? convertHtmlToMarkdown(input) : input;
  const counts = analyzeTextCounts(mode === "html-to-md" ? mdOutput : input);

  const insertSnippet = (snippet: string) => {
    setInput((prev) => `${prev}\n${snippet}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        {mode === "editor" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => insertSnippet("## Section Heading")}
              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("**Bold text**")}
              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("- [ ] Task item")}
              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Checklist
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("| Col A | Col B |\n| --- | --- |\n| Val 1 | Val 2 |")}
              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("```ts\nconst ready = true;\n```")}
              className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              Code Block
            </button>
          </div>
        ) : mode === "md-to-html" ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={addHeadingIds}
                onChange={(e) => setAddHeadingIds(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              Add heading slug IDs
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={wrapFullDoc}
                onChange={(e) => setWrapFullDoc(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              Wrap in full &lt;!DOCTYPE html&gt;
            </label>
          </div>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">
            Converts headings, lists, links, tables, inline code, and fenced blocks to Markdown
          </span>
        )}

        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span>{counts.words} words</span>
          <span>•</span>
          <span>{counts.characters} chars</span>
          <span>•</span>
          <span>~{counts.readingTimeMinutes} min read</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="md-suite-input" className="text-sm font-semibold">
              {mode === "html-to-md" ? "HTML Source Input" : "Markdown Source"}
            </label>
            {mode === "editor" && (
              <button
                type="button"
                onClick={() => downloadText(input, "document.md", "text/markdown;charset=utf-8")}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> .MD
              </button>
            )}
          </div>
          <textarea
            id="md-suite-input"
            rows={14}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="md-suite-output" className="text-sm font-semibold">
              {mode === "html-to-md"
                ? "Generated Markdown Output"
                : mode === "md-to-html"
                  ? "Generated HTML Code"
                  : "Live Rendered Preview & HTML Export"}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <CopyButton
                text={mode === "html-to-md" ? mdOutput : htmlOutput}
                label={mode === "html-to-md" ? "Copy Markdown" : "Copy HTML"}
              />
              <button
                type="button"
                onClick={() => {
                  if (mode === "html-to-md") {
                    downloadText(mdOutput, "converted.md", "text/markdown;charset=utf-8");
                  } else {
                    downloadText(htmlOutput, "converted.html", "text/html;charset=utf-8");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </button>
            </div>
          </div>

          {mode === "editor" ? (
            <div
              className="prose prose-sm max-h-[22rem] min-h-[20rem] max-w-full overflow-x-auto overflow-y-auto rounded-2xl border bg-card p-4 text-sm leading-relaxed text-foreground sm:p-5"
              dangerouslySetInnerHTML={{ __html: htmlOutput }}
            />
          ) : (
            <textarea
              id="md-suite-output"
              readOnly
              rows={14}
              value={mode === "html-to-md" ? mdOutput : htmlOutput}
              className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. CITATION GENERATOR
// ============================================================================

function CitationGeneratorTool() {
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [sourceType, setSourceType] = useState<CitationSourceType>("journal");
  const [authors, setAuthors] = useState<CitationAuthor[]>([
    { firstName: "Elena", lastName: "Rostova" },
    { firstName: "Marcus", lastName: "Vance" },
  ]);
  const [title, setTitle] = useState(
    "Privacy-Preserving Local Browser Architectures for High-Throughput Data Processing",
  );
  const [containerTitle, setContainerTitle] = useState("Journal of Web Systems Engineering");
  const [publisher, setPublisher] = useState("ACM Press");
  const [year, setYear] = useState("2026");
  const [volume, setVolume] = useState("18");
  const [issue, setIssue] = useState("4");
  const [pages, setPages] = useState("210-228");
  const [doi, setDoi] = useState("10.1145/3600000.3600123");
  const [url, setUrl] = useState("https://ijm.app/research/local-web-processing");
  const [savedList, setSavedList] = useState<string[]>([]);

  const citation = generateFormattedCitation({
    style,
    sourceType,
    authors,
    title,
    containerTitle,
    publisher,
    year,
    volume,
    issue,
    pages,
    doi,
    url,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["apa", "mla", "chicago", "harvard", "ieee"] as CitationStyle[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStyle(st)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase transition ${
                style === st
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {(["journal", "website", "book"] as CitationSourceType[]).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setSourceType(src)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${
                sourceType === src
                  ? "bg-foreground text-background"
                  : "border bg-card text-foreground"
              }`}
            >
              {src}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Authors
              </span>
              <button
                type="button"
                onClick={() => setAuthors((prev) => [...prev, { firstName: "", lastName: "" }])}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-semibold hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Add Author
              </button>
            </div>
            {authors.map((a, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  aria-label={`Author ${idx + 1} first name`}
                  placeholder="First name"
                  value={a.firstName}
                  onChange={(e) =>
                    setAuthors((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, firstName: e.target.value } : item,
                      ),
                    )
                  }
                  className="col-span-5 rounded-xl border bg-background px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  aria-label={`Author ${idx + 1} last name`}
                  placeholder="Last name"
                  value={a.lastName}
                  onChange={(e) =>
                    setAuthors((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, lastName: e.target.value } : item,
                      ),
                    )
                  }
                  className="col-span-6 rounded-xl border bg-background px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  aria-label={`Remove author ${idx + 1}`}
                  disabled={authors.length <= 1}
                  onClick={() => setAuthors((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 grid place-items-center rounded-xl border text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="cit-title" className="text-xs font-semibold">
                Article / Book / Page Title
              </label>
              <input
                id="cit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-container" className="text-xs font-semibold">
                Journal / Website Name
              </label>
              <input
                id="cit-container"
                type="text"
                value={containerTitle}
                onChange={(e) => setContainerTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-publisher" className="text-xs font-semibold">
                Publisher / Institution
              </label>
              <input
                id="cit-publisher"
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-year" className="text-xs font-semibold">
                Publication Year
              </label>
              <input
                id="cit-year"
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-pages" className="text-xs font-semibold">
                Pages (e.g. 210-228)
              </label>
              <input
                id="cit-pages"
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-vol" className="text-xs font-semibold">
                Volume
              </label>
              <input
                id="cit-vol"
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="cit-issue" className="text-xs font-semibold">
                Issue
              </label>
              <input
                id="cit-issue"
                type="text"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cit-doi" className="text-xs font-semibold">
                DOI or URL
              </label>
              <input
                id="cit-doi"
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1145/... or https://..."
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-5">
          <div className="rounded-3xl border bg-card p-4 shadow-card space-y-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden /> Formatted Reference (
                {style.toUpperCase()})
              </span>
              <CopyButton text={citation.bibliography} label="Copy Reference" />
            </div>
            <p className="break-words rounded-2xl border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
              {citation.bibliography}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground">In-Text Citation: </span>
                <code className="break-words font-mono text-xs font-bold">{citation.inText}</code>
              </div>
              <CopyButton text={citation.inText} label="Copy In-Text" />
            </div>

            <button
              type="button"
              onClick={() =>
                setSavedList((prev) =>
                  prev.includes(citation.bibliography) ? prev : [...prev, citation.bibliography],
                )
              }
              className="w-full rounded-full bg-primary py-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
            >
              + Add to Bibliography List ({savedList.length})
            </button>
          </div>

          {savedList.length > 0 && (
            <div className="rounded-2xl border bg-muted/30 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold">Saved Bibliography ({savedList.length})</span>
                <CopyButton text={[...savedList].sort().join("\n\n")} label="Copy All" />
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {[...savedList].sort().map((entry, idx) => (
                  <li
                    key={idx}
                    className="break-words rounded-xl border bg-card p-2.5 text-foreground"
                  >
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 11. SQL FORMATTER
// ============================================================================

const SAMPLE_MESSY_SQL = `select u.id, u.email, count(o.id) as total_orders, sum(o.amount_usd) as lifetime_value from users u left join orders o on o.user_id = u.id where u.status = 'active' and o.created_at >= '2026-01-01' group by u.id, u.email having count(o.id) > 2 order by lifetime_value desc limit 25;`;

function SqlFormatterTool() {
  const [rawSql, setRawSql] = useState(SAMPLE_MESSY_SQL);
  const [keywordCase, setKeywordCase] = useState<"upper" | "lower" | "preserve">("upper");
  const [indentSize, setIndentSize] = useState<2 | 4>(2);
  const [compact, setCompact] = useState(false);

  const formatted = formatSqlQuery(rawSql, { keywordCase, indentSize, compact });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>SQL Keywords:</span>
            <select
              aria-label="SQL keyword case"
              value={keywordCase}
              onChange={(e) => setKeywordCase(e.target.value as "upper" | "lower" | "preserve")}
              className="bg-transparent text-xs outline-none"
            >
              <option value="upper">UPPERCASE</option>
              <option value="lower">lowercase</option>
              <option value="preserve">Preserve Original</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Indent:</span>
            <select
              aria-label="SQL indentation"
              value={indentSize}
              onChange={(e) => setIndentSize(Number(e.target.value) as 2 | 4)}
              className="bg-transparent text-xs outline-none"
            >
              <option value={2}>2 Spaces</option>
              <option value={4}>4 Spaces</option>
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Compact / Single-line
          </label>
        </div>

        <button
          type="button"
          onClick={() => setRawSql(SAMPLE_MESSY_SQL)}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample SQL
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="sql-raw-input" className="text-sm font-semibold">
            Raw SQL Query
          </label>
          <textarea
            id="sql-raw-input"
            rows={12}
            value={rawSql}
            onChange={(e) => setRawSql(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="sql-formatted-output" className="text-sm font-semibold">
              Formatted SQL Output
            </label>
            <div className="flex items-center gap-2">
              <CopyButton text={formatted} />
              <button
                type="button"
                onClick={() => downloadText(formatted, "query.sql", "text/plain;charset=utf-8")}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> .SQL
              </button>
            </div>
          </div>
          <textarea
            id="sql-formatted-output"
            readOnly
            rows={12}
            value={formatted}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. SQL QUERY BUILDER
// ============================================================================

function SqlQueryBuilderTool() {
  const [operation, setOperation] = useState<"SELECT" | "INSERT" | "UPDATE" | "DELETE">("SELECT");
  const [table, setTable] = useState("orders o");
  const [columnsInput, setColumnsInput] = useState(
    "o.id, o.customer_email, o.total_usd, c.country",
  );
  const [distinct, setDistinct] = useState(false);
  const [joinTable, setJoinTable] = useState("customers c");
  const [joinType, setJoinType] = useState<"INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN">("LEFT JOIN");
  const [joinOn, setJoinOn] = useState("c.id = o.customer_id");
  const [where, setWhere] = useState<SqlWhereCondition[]>([
    { id: "w1", column: "o.status", operator: "=", value: "paid", conjunction: "AND" },
    { id: "w2", column: "o.total_usd", operator: ">=", value: "100", conjunction: "AND" },
  ]);
  const [groupBy, setGroupBy] = useState("");
  const [orderByColumn, setOrderByColumn] = useState("o.total_usd");
  const [orderByDirection, setOrderByDirection] = useState<"ASC" | "DESC">("DESC");
  const [limit, setLimit] = useState(50);

  const builtSql = buildSqlQuery({
    operation,
    table,
    columns: columnsInput.split(",").map((s) => s.trim()),
    distinct,
    joinTable,
    joinType,
    joinOn,
    where,
    groupBy,
    orderByColumn,
    orderByDirection,
    limit,
    insertOrUpdateValues: {
      customer_email: "ada@example.com",
      total_usd: "249.00",
      status: "paid",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/40 p-4">
        {(["SELECT", "INSERT", "UPDATE", "DELETE"] as const).map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => setOperation(op)}
            className={`rounded-full px-4 py-1.5 font-mono text-xs font-bold transition ${
              operation === op
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card text-foreground"
            }`}
          >
            {op}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sqlb-table" className="text-xs font-semibold">
                Target Table
              </label>
              <input
                id="sqlb-table"
                type="text"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
            {operation === "SELECT" && (
              <div>
                <label htmlFor="sqlb-cols" className="text-xs font-semibold">
                  Selected Columns (comma-separated)
                </label>
                <input
                  id="sqlb-cols"
                  type="text"
                  value={columnsInput}
                  onChange={(e) => setColumnsInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
            )}
          </div>

          {operation === "SELECT" && (
            <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
              <div>
                <label htmlFor="sqlb-jointype" className="text-xs font-semibold">
                  Join Type
                </label>
                <select
                  id="sqlb-jointype"
                  value={joinType}
                  onChange={(e) =>
                    setJoinType(e.target.value as "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN")
                  }
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                >
                  <option value="LEFT JOIN">LEFT JOIN</option>
                  <option value="INNER JOIN">INNER JOIN</option>
                  <option value="RIGHT JOIN">RIGHT JOIN</option>
                </select>
              </div>
              <div>
                <label htmlFor="sqlb-jointable" className="text-xs font-semibold">
                  Join Table
                </label>
                <input
                  id="sqlb-jointable"
                  type="text"
                  value={joinTable}
                  onChange={(e) => setJoinTable(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="sqlb-joinon" className="text-xs font-semibold">
                  ON Condition
                </label>
                <input
                  id="sqlb-joinon"
                  type="text"
                  value={joinOn}
                  onChange={(e) => setJoinOn(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                WHERE Filter Conditions
              </span>
              <button
                type="button"
                onClick={() =>
                  setWhere((prev) => [
                    ...prev,
                    {
                      id: `w-${Date.now()}`,
                      column: "created_at",
                      operator: ">=",
                      value: "2026-01-01",
                      conjunction: "AND",
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Filter
              </button>
            </div>
            {where.map((cond, idx) => (
              <div key={cond.id} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  aria-label={`Where column ${idx + 1}`}
                  value={cond.column}
                  onChange={(e) =>
                    setWhere((prev) =>
                      prev.map((w, i) => (i === idx ? { ...w, column: e.target.value } : w)),
                    )
                  }
                  className="col-span-12 rounded-xl border bg-background px-2.5 py-1.5 font-mono text-xs sm:col-span-4"
                />
                <select
                  aria-label={`Where operator ${idx + 1}`}
                  value={cond.operator}
                  onChange={(e) =>
                    setWhere((prev) =>
                      prev.map((w, i) =>
                        i === idx
                          ? { ...w, operator: e.target.value as SqlWhereCondition["operator"] }
                          : w,
                      ),
                    )
                  }
                  className="col-span-4 rounded-xl border bg-background px-2 py-1.5 font-mono text-xs sm:col-span-3"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<">&lt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="LIKE">LIKE</option>
                  <option value="IN">IN</option>
                  <option value="IS NULL">IS NULL</option>
                </select>
                <input
                  type="text"
                  aria-label={`Where value ${idx + 1}`}
                  value={cond.value}
                  onChange={(e) =>
                    setWhere((prev) =>
                      prev.map((w, i) => (i === idx ? { ...w, value: e.target.value } : w)),
                    )
                  }
                  className="col-span-6 rounded-xl border bg-background px-2.5 py-1.5 font-mono text-xs sm:col-span-4"
                />
                <button
                  type="button"
                  aria-label={`Remove filter ${idx + 1}`}
                  onClick={() => setWhere((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-2 grid place-items-center rounded-xl border text-muted-foreground hover:text-destructive sm:col-span-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {operation === "SELECT" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="sqlb-orderby" className="text-xs font-semibold">
                  ORDER BY Column
                </label>
                <input
                  id="sqlb-orderby"
                  type="text"
                  value={orderByColumn}
                  onChange={(e) => setOrderByColumn(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="sqlb-orderdir" className="text-xs font-semibold">
                  Sort Direction
                </label>
                <select
                  id="sqlb-orderdir"
                  value={orderByDirection}
                  onChange={(e) => setOrderByDirection(e.target.value as "ASC" | "DESC")}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                >
                  <option value="DESC">DESC</option>
                  <option value="ASC">ASC</option>
                </select>
              </div>
              <div>
                <label htmlFor="sqlb-limit" className="text-xs font-semibold">
                  LIMIT Rows
                </label>
                <input
                  id="sqlb-limit"
                  type="number"
                  min={1}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
              <Database className="h-4 w-4 shrink-0" aria-hidden /> Generated SQL Statement
            </span>
            <CopyButton text={builtSql} label="Copy SQL" />
          </div>
          <pre className="max-w-full overflow-x-auto rounded-3xl border bg-ink p-4 font-mono text-xs leading-relaxed text-primary sm:p-5">
            {builtSql}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 13. HASH GENERATOR
// ============================================================================

function HashGeneratorTool() {
  const [input, setInput] = useState("IJM — 100% Local Browser Processing");
  const [hmacKey, setHmacKey] = useState("");
  const [uppercase, setUppercase] = useState(false);
  const [compareHash, setCompareHash] = useState("");
  const [digests, setDigests] = useState<HashDigestSuite | null>(null);

  useEffect(() => {
    let active = true;
    generateAllHashes(input, { uppercase, hmacKey }).then((res) => {
      if (active) setDigests(res);
    });
    return () => {
      active = false;
    };
  }, [input, uppercase, hmacKey]);

  const cleanCompare = compareHash.trim().toLowerCase();
  const matchedAlgo =
    cleanCompare && digests
      ? (Object.entries(digests).find(([, val]) => val.toLowerCase() === cleanCompare)?.[0] ?? null)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-7">
          <label htmlFor="hash-input-text" className="text-sm font-semibold">
            Input Text to Hash (UTF-8)
          </label>
          <textarea
            id="hash-input-text"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
        <div className="space-y-3 lg:col-span-5">
          <div>
            <label htmlFor="hash-hmac-key" className="text-xs font-semibold">
              Optional HMAC Secret Key
            </label>
            <input
              id="hash-hmac-key"
              type="text"
              value={hmacKey}
              onChange={(e) => setHmacKey(e.target.value)}
              placeholder="Leave empty for standard digest..."
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label htmlFor="hash-verify-input" className="text-xs font-semibold">
              Verify / Compare Against Checksum
            </label>
            <input
              id="hash-verify-input"
              type="text"
              value={compareHash}
              onChange={(e) => setCompareHash(e.target.value)}
              placeholder="Paste expected MD5/SHA256 hex digest..."
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
            />
            {cleanCompare && (
              <p className="mt-1 text-xs font-semibold">
                {matchedAlgo ? (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Matches {matchedAlgo.toUpperCase()}!
                  </span>
                ) : (
                  <span className="text-destructive">No match with current input digests.</span>
                )}
              </p>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            UPPERCASE Hex Output
          </label>
        </div>
      </div>

      {digests && (
        <div className="space-y-3">
          {(
            [
              { key: "sha256", label: "SHA-256 (256-bit)" },
              { key: "sha512", label: "SHA-512 (512-bit)" },
              { key: "sha384", label: "SHA-384 (384-bit)" },
              { key: "sha1", label: "SHA-1 (160-bit)" },
              { key: "md5", label: "MD5 (128-bit)" },
            ] as const
          ).map(({ key, label }) => (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
                <p className="mt-1 break-all font-mono text-xs text-foreground">{digests[key]}</p>
              </div>
              <CopyButton text={digests[key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 14 & 15. HTML/CSS/JS MINIFIER & CSS FORMATTER
// ============================================================================

const SAMPLE_CODE_BY_LANG: Record<CodeMinifierLanguage, string> = {
  html: `<!-- Main Hero Section -->\n<section class="hero-card">\n  <h1>   IJM Workspace   </h1>\n  <p>Fast, private, and 100% browser-based.</p>\n</section>`,
  css: `/* Primary Card Styles */\n.hero-card {\n  display: flex;\n  flex-direction: column;\n  padding: 24px;\n  background-color: #ffffff;\n  border-radius: 16px;\n}`,
  javascript: `// Compute discount total\nfunction calculateTotal(price, discountRate) {\n  const savings = price * discountRate;\n  return price - savings;\n}`,
};

function CodeMinifierTool() {
  const [language, setLanguage] = useState<CodeMinifierLanguage>("css");
  const [source, setSource] = useState(SAMPLE_CODE_BY_LANG.css);

  const res = minifyCodeSource(source, language);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          {(["html", "css", "javascript"] as CodeMinifierLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                setLanguage(lang);
                setSource(SAMPLE_CODE_BY_LANG[lang]);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card text-foreground"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <span>Original: {formatBytes(res.originalBytes)}</span>
          <span>Minified: {formatBytes(res.minifiedBytes)}</span>
          <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">
            Saved {res.savingsPercent}% ({formatBytes(res.savedBytes)})
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="minifier-input" className="text-sm font-semibold">
            Source {language.toUpperCase()} Code
          </label>
          <textarea
            id="minifier-input"
            rows={10}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="minifier-output" className="text-sm font-semibold">
              Minified Output
            </label>
            <CopyButton text={res.output} />
          </div>
          <textarea
            id="minifier-output"
            readOnly
            rows={10}
            value={res.output}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function CssFormatterTool() {
  const [rawCss, setRawCss] = useState(
    `:root{--brand:#d6f538;--ink:#111113}.card{padding:24px;background:#fff;border-radius:16px;display:flex;align-items:center}`,
  );
  const [indentSize, setIndentSize] = useState<2 | 4>(2);
  const [sortProperties, setSortProperties] = useState(true);

  const formatted = formatCssStylesheet(rawCss, { indentSize, sortProperties });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <span>Indent:</span>
            <select
              aria-label="CSS indent spaces"
              value={indentSize}
              onChange={(e) => setIndentSize(Number(e.target.value) as 2 | 4)}
              className="bg-transparent text-xs outline-none"
            >
              <option value={2}>2 Spaces</option>
              <option value={4}>4 Spaces</option>
            </select>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={sortProperties}
              onChange={(e) => setSortProperties(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Sort CSS declarations alphabetically
          </label>
        </div>

        <span className="text-xs font-semibold text-muted-foreground">
          {formatted.ruleCount} rules • {formatted.customPropCount} CSS variables
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="css-fmt-input" className="text-sm font-semibold">
            Minified or Unformatted CSS
          </label>
          <textarea
            id="css-fmt-input"
            rows={12}
            value={rawCss}
            onChange={(e) => setRawCss(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="css-fmt-output" className="text-sm font-semibold">
              Beautified CSS Output
            </label>
            <div className="flex items-center gap-2">
              <CopyButton text={formatted.output} />
              <button
                type="button"
                onClick={() =>
                  downloadText(formatted.output, "styles.css", "text/css;charset=utf-8")
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> .CSS
              </button>
            </div>
          </div>
          <textarea
            id="css-fmt-output"
            readOnly
            rows={12}
            value={formatted.output}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 16. SCIENTIFIC CALCULATOR
// ============================================================================

function ScientificCalculatorTool() {
  const [expr, setExpr] = useState("sin(30) + sqrt(144) + 5!");
  const [angleUnit, setAngleUnit] = useState<AngleUnit>("deg");
  const [lastAns, setLastAns] = useState(0);
  const [history, setHistory] = useState<{ expr: string; res: string }[]>([]);

  const evaluated = evaluateScientificExpression(expr, { angleUnit, lastAnswer: lastAns });

  const appendToken = (t: string) => setExpr((prev) => `${prev}${t}`);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-3xl border bg-ink p-6 text-ink-foreground shadow-card">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full bg-background/15 p-1">
              <button
                type="button"
                onClick={() => setAngleUnit("deg")}
                className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase ${
                  angleUnit === "deg" ? "bg-primary text-primary-foreground" : "text-ink-foreground"
                }`}
              >
                DEG
              </button>
              <button
                type="button"
                onClick={() => setAngleUnit("rad")}
                className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase ${
                  angleUnit === "rad" ? "bg-primary text-primary-foreground" : "text-ink-foreground"
                }`}
              >
                RAD
              </button>
            </div>
            <span className="font-mono text-xs text-ink-foreground/70">Ans = {lastAns}</span>
          </div>

          <input
            type="text"
            aria-label="Scientific expression input"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="e.g. sin(45) * sqrt(2) + log(100)"
            className="mt-4 w-full rounded-2xl bg-background/10 px-4 py-3 font-mono text-lg text-ink-foreground outline-none"
          />

          <div className="mt-4 flex items-baseline justify-between border-t border-ink-foreground/15 pt-4">
            <span className="text-xs uppercase tracking-wider text-ink-foreground/60">Result</span>
            <span className="font-mono text-3xl font-bold text-primary">
              {evaluated.ok ? evaluated.formatted : evaluated.error}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {[
            "sin(",
            "cos(",
            "tan(",
            "sqrt(",
            "cbrt(",
            "ln(",
            "log(",
            "exp(",
            "pi",
            "e",
            "(",
            ")",
            "^",
            "!",
            "%",
            "7",
            "8",
            "9",
            "/",
            "abs(",
            "4",
            "5",
            "6",
            "*",
            "ans",
            "1",
            "2",
            "3",
            "-",
            "C",
            "0",
            ".",
            "+",
          ].map((btn) => (
            <button
              key={btn}
              type="button"
              onClick={() => {
                if (btn === "C") setExpr("");
                else appendToken(btn);
              }}
              className="rounded-2xl border bg-card py-3 font-mono text-xs font-bold transition hover:bg-muted"
            >
              {btn}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (evaluated.ok) {
                setLastAns(evaluated.value);
                setHistory((prev) => [{ expr, res: evaluated.formatted }, ...prev.slice(0, 9)]);
              }
            }}
            className="col-span-2 rounded-2xl bg-primary py-3 font-mono text-xs font-bold text-primary-foreground"
          >
            = Evaluate & Save
          </button>
        </div>
      </div>

      <div className="space-y-3 lg:col-span-5">
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Calculation Tape History</h3>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Click &ldquo;= Evaluate &amp; Save&rdquo; to log expressions to your calculation tape.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 font-mono text-xs">
              {history.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => setExpr(item.expr)}
                    className="text-left hover:underline"
                  >
                    {item.expr}
                  </button>
                  <span className="font-bold">= {item.res}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 17. EQUATION SOLVER
// ============================================================================

function EquationSolverTool() {
  const [mode, setMode] = useState<"quadratic" | "linear" | "system2x2">("quadratic");
  // Quadratic ax^2 + bx + c = 0
  const [qa, setQa] = useState(1);
  const [qb, setQb] = useState(-5);
  const [qc, setQc] = useState(6);
  // Linear ax + b = c
  const [la, setLa] = useState(4);
  const [lb, setLb] = useState(-7);
  const [lc, setLc] = useState(13);
  // 2x2 system
  const [a1, setA1] = useState(2);
  const [b1, setB1] = useState(3);
  const [c1, setC1] = useState(13);
  const [a2, setA2] = useState(5);
  const [b2, setB2] = useState(-1);
  const [c2, setC2] = useState(7);

  const quadRes = solveQuadraticEquation(qa, qb, qc);
  const linRes = solveLinearEquation(la, lb, lc);
  const sysRes = solveLinearSystem2x2(a1, b1, c1, a2, b2, c2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/40 p-4">
        <button
          type="button"
          onClick={() => setMode("quadratic")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold ${
            mode === "quadratic"
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground"
          }`}
        >
          Quadratic (ax² + bx + c = 0)
        </button>
        <button
          type="button"
          onClick={() => setMode("linear")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold ${
            mode === "linear"
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground"
          }`}
        >
          Linear (ax + b = c)
        </button>
        <button
          type="button"
          onClick={() => setMode("system2x2")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold ${
            mode === "system2x2"
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground"
          }`}
        >
          2×2 Linear System (x, y)
        </button>
      </div>

      {mode === "quadratic" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="grid grid-cols-3 gap-3 rounded-2xl border bg-card p-5 lg:col-span-5">
            <div>
              <label htmlFor="quad-a" className="text-xs font-bold">
                a (x² coeff)
              </label>
              <input
                id="quad-a"
                type="number"
                value={qa}
                onChange={(e) => setQa(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="quad-b" className="text-xs font-bold">
                b (x coeff)
              </label>
              <input
                id="quad-b"
                type="number"
                value={qb}
                onChange={(e) => setQb(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="quad-c" className="text-xs font-bold">
                c (constant)
              </label>
              <input
                id="quad-c"
                type="number"
                value={qc}
                onChange={(e) => setQc(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            {quadRes.ok ? (
              <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Roots ({quadRes.nature.replace("-", " ")})
                  </span>
                  <span className="rounded-full bg-primary px-3 py-1 font-mono text-xs font-bold text-primary-foreground">
                    Δ = {quadRes.discriminant}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 font-mono text-xl font-bold">
                  {quadRes.roots.map((r, idx) => (
                    <span key={idx} className="rounded-2xl border bg-muted/40 px-4 py-2">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <p className="font-bold text-foreground">Step-by-Step Solution:</p>
                  {quadRes.steps.map((s, idx) => (
                    <p key={idx} className="font-mono">
                      {idx + 1}. {s}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {quadRes.error}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "linear" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="grid grid-cols-3 gap-3 rounded-2xl border bg-card p-5 lg:col-span-5">
            <div>
              <label htmlFor="lin-a" className="text-xs font-bold">
                a (x coeff)
              </label>
              <input
                id="lin-a"
                type="number"
                value={la}
                onChange={(e) => setLa(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="lin-b" className="text-xs font-bold">
                b (constant)
              </label>
              <input
                id="lin-b"
                type="number"
                value={lb}
                onChange={(e) => setLb(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="lin-c" className="text-xs font-bold">
                c (RHS)
              </label>
              <input
                id="lin-c"
                type="number"
                value={lc}
                onChange={(e) => setLc(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            {linRes.ok ? (
              <div className="rounded-3xl border bg-card p-6 shadow-card space-y-3">
                <p className="font-mono text-2xl font-bold">x = {linRes.x}</p>
                {linRes.steps.map((s, idx) => (
                  <p key={idx} className="font-mono text-xs text-muted-foreground">
                    {idx + 1}. {s}
                  </p>
                ))}
              </div>
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {linRes.error}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === "system2x2" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-3 rounded-2xl border bg-card p-5 lg:col-span-5">
            <p className="text-xs font-bold">Equation 1: a₁x + b₁y = c₁</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                aria-label="a1"
                value={a1}
                onChange={(e) => setA1(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                aria-label="b1"
                value={b1}
                onChange={(e) => setB1(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                aria-label="c1"
                value={c1}
                onChange={(e) => setC1(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
            <p className="text-xs font-bold pt-2">Equation 2: a₂x + b₂y = c₂</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                aria-label="a2"
                value={a2}
                onChange={(e) => setA2(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                aria-label="b2"
                value={b2}
                onChange={(e) => setB2(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                aria-label="c2"
                value={c2}
                onChange={(e) => setC2(Number(e.target.value))}
                className="rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            {sysRes.ok ? (
              <div className="rounded-3xl border bg-card p-6 shadow-card space-y-3">
                <p className="font-mono text-2xl font-bold">
                  x = {sysRes.x}, y = {sysRes.y}
                </p>
                {sysRes.steps.map((s, idx) => (
                  <p key={idx} className="font-mono text-xs text-muted-foreground">
                    {idx + 1}. {s}
                  </p>
                ))}
              </div>
            ) : (
              <div
                role="alert"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {sysRes.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 18. HABIT TRACKER
// ============================================================================

const DEFAULT_HABITS: HabitItem[] = [
  {
    id: "h1",
    name: "Deep Work / Problem Solving (60m)",
    category: "Study",
    completedDays: [true, true, false, true, true, true, true],
  },
  {
    id: "h2",
    name: "Spaced Repetition Flashcards",
    category: "Memory",
    completedDays: [true, true, true, true, false, true, true],
  },
  {
    id: "h3",
    name: "30m Walk & Hydration",
    category: "Wellness",
    completedDays: [false, true, true, true, true, false, true],
  },
];

const DAY_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Today"];

function HabitTrackerTool() {
  const [habits, setHabits] = useState<HabitItem[]>(DEFAULT_HABITS);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitCat, setNewHabitCat] = useState("Study");

  const metrics = calculateHabitMetrics(habits);

  const toggleDay = (habitId: string, dayIdx: number) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? {
              ...h,
              completedDays: h.completedDays.map((done, i) => (i === dayIdx ? !done : done)),
            }
          : h,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Overall Completion Rate</p>
          <p className="mt-1 text-2xl font-bold">{metrics.overallCompletionPercent}%</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Best Active Streak</p>
          <p className="mt-1 text-2xl font-bold">{metrics.topStreak} days</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tracked Habits</p>
          <p className="mt-1 text-2xl font-bold">{habits.length}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newHabitName.trim()) return;
          setHabits((prev) => [
            ...prev,
            {
              id: `h-${Date.now()}`,
              name: newHabitName.trim(),
              category: newHabitCat,
              completedDays: [false, false, false, false, false, false, false],
            },
          ]);
          setNewHabitName("");
        }}
        className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/40 p-4"
      >
        <input
          type="text"
          aria-label="New habit name"
          placeholder="Add a daily habit (e.g. Read 20 pages)..."
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          className="min-w-60 flex-1 rounded-xl border bg-card px-3.5 py-2 text-xs outline-none"
        />
        <select
          aria-label="Habit category"
          value={newHabitCat}
          onChange={(e) => setNewHabitCat(e.target.value)}
          className="rounded-xl border bg-card px-3 py-2 text-xs font-semibold"
        >
          <option value="Study">Study</option>
          <option value="Code">Code</option>
          <option value="Wellness">Wellness</option>
          <option value="Reading">Reading</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Habit
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 font-bold">Habit</th>
              {DAY_LABELS.map((d) => (
                <th key={d} className="px-2.5 py-3 text-center font-semibold">
                  {d}
                </th>
              ))}
              <th className="px-3 py-3 text-center font-bold">Streak</th>
              <th className="px-3 py-3 text-center font-bold">Rate</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {habits.map((h) => {
              const stat = metrics.habitStats.find((s) => s.id === h.id);
              return (
                <tr key={h.id}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">{h.name}</p>
                    <span className="text-[11px] text-muted-foreground">{h.category}</span>
                  </td>
                  {h.completedDays.map((done, dIdx) => (
                    <td key={dIdx} className="px-2.5 py-3 text-center">
                      <button
                        type="button"
                        aria-label={`Toggle ${h.name} ${DAY_LABELS[dIdx]}`}
                        onClick={() => toggleDay(h.id, dIdx)}
                        className={`mx-auto grid h-7 w-7 place-items-center rounded-lg border font-bold transition ${
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-mono font-bold">
                    {stat?.currentStreak ?? 0}d
                  </td>
                  <td className="px-3 py-3 text-center font-mono">
                    {stat?.completionRatePercent ?? 0}%
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${h.name}`}
                      onClick={() => setHabits((prev) => prev.filter((item) => item.id !== h.id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 19. PROJECT TIMELINE GENERATOR
// ============================================================================

const SAMPLE_TIMELINE_TASKS: TimelineTaskInput[] = [
  {
    id: "t1",
    title: "Discovery & Architecture Spec",
    owner: "Product Lead",
    startDate: "2026-05-01",
    durationDays: 5,
    status: "completed",
  },
  {
    id: "t2",
    title: "Core Data & Spreadsheet Engine",
    owner: "Data Team",
    startDate: "2026-05-05",
    durationDays: 8,
    status: "completed",
  },
  {
    id: "t3",
    title: "Developer & SQL Workspace UI",
    owner: "Frontend Team",
    startDate: "2026-05-11",
    durationDays: 7,
    status: "in-progress",
  },
  {
    id: "t4",
    title: "Release 3 QA & Production Launch",
    owner: "QA Engineering",
    startDate: "2026-05-18",
    durationDays: 4,
    status: "planned",
    isMilestone: true,
  },
];

function ProjectTimelineGeneratorTool() {
  const [tasks, setTasks] = useState<TimelineTaskInput[]>(SAMPLE_TIMELINE_TASKS);
  const timeline = generateProjectTimeline(tasks);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setTasks((prev) => [
                ...prev,
                {
                  id: `t-${Date.now()}`,
                  title: `Milestone ${prev.length + 1}`,
                  owner: "Team",
                  startDate: "2026-05-20",
                  durationDays: 5,
                  status: "planned",
                },
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add Task
          </button>
          <button
            type="button"
            onClick={() => setTasks(SAMPLE_TIMELINE_TASKS)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Sample
          </button>
        </div>

        {timeline.ok && (
          <div className="flex items-center gap-2">
            <CopyButton text={timeline.markdownTable} label="Copy Markdown" />
            <button
              type="button"
              onClick={() =>
                downloadText(timeline.csvExport, "project-timeline.csv", "text/csv;charset=utf-8")
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
            >
              <Download className="h-3.5 w-3.5" /> Export .CSV
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className="grid grid-cols-12 items-center gap-2 rounded-2xl border bg-card p-3"
          >
            <input
              type="text"
              aria-label={`Task ${idx + 1} title`}
              value={task.title}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((t, i) => (i === idx ? { ...t, title: e.target.value } : t)),
                )
              }
              className="col-span-8 rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold md:col-span-4"
            />
            <input
              type="text"
              aria-label={`Task ${idx + 1} owner`}
              value={task.owner}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((t, i) => (i === idx ? { ...t, owner: e.target.value } : t)),
                )
              }
              className="col-span-4 rounded-xl border bg-background px-2.5 py-1.5 text-xs md:col-span-2"
            />
            <input
              type="date"
              aria-label={`Task ${idx + 1} start date`}
              value={task.startDate}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((t, i) => (i === idx ? { ...t, startDate: e.target.value } : t)),
                )
              }
              className="col-span-5 rounded-xl border bg-background px-2.5 py-1.5 font-mono text-xs md:col-span-2"
            />
            <input
              type="number"
              min={1}
              aria-label={`Task ${idx + 1} duration days`}
              value={task.durationDays}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((t, i) =>
                    i === idx ? { ...t, durationDays: Number(e.target.value) } : t,
                  ),
                )
              }
              className="col-span-2 rounded-xl border bg-background px-2 py-1.5 font-mono text-xs md:col-span-1"
            />
            <select
              aria-label={`Task ${idx + 1} status`}
              value={task.status}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((t, i) =>
                    i === idx ? { ...t, status: e.target.value as TimelineTaskInput["status"] } : t,
                  ),
                )
              }
              className="col-span-4 rounded-xl border bg-background px-2 py-1.5 text-xs font-semibold md:col-span-2"
            >
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="planned">Planned</option>
              <option value="blocked">Blocked</option>
            </select>
            <button
              type="button"
              aria-label={`Remove task ${idx + 1}`}
              disabled={tasks.length <= 1}
              onClick={() => setTasks((prev) => prev.filter((_, i) => i !== idx))}
              className="col-span-1 grid place-items-center text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {timeline.ok && (
        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Visual Gantt Project Timeline</h3>
              <p className="text-xs text-muted-foreground">
                Span: {timeline.projectStartDate} → {timeline.projectEndDate} (
                {timeline.totalDurationDays} days total • {timeline.completionPercent}% complete)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {timeline.tasks.map((t) => (
              <div key={t.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {t.isMilestone ? "★ " : ""}
                    {t.title} <span className="font-normal text-muted-foreground">({t.owner})</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {t.startDate} → {t.endDate} ({t.durationDays}d)
                  </span>
                </div>
                <svg
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  aria-label={`${t.title} timeline bar`}
                  className="h-6 w-full overflow-hidden rounded-full bg-muted/60"
                >
                  <rect
                    x={t.leftPercent}
                    y={0}
                    width={t.widthPercent}
                    height={10}
                    rx={3}
                    className={
                      t.status === "completed"
                        ? "fill-primary"
                        : t.status === "in-progress"
                          ? "fill-foreground"
                          : "fill-foreground/35"
                    }
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN DISPATCHER FOR RELEASE 3 WORKSPACES
// ============================================================================

export function Release3ToolWorkspace({ toolSlug }: { toolSlug: Release3ToolSlug }) {
  switch (toolSlug) {
    case "excel-to-csv":
      return <ExcelToCsvTool />;
    case "csv-column-extractor":
      return <CsvColumnExtractorTool />;
    case "csv-delimiter-converter":
      return <CsvDelimiterConverterTool />;
    case "excel-formula-helper":
      return <ExcelFormulaHelperTool />;
    case "compare-csv-files":
      return <CompareCsvFilesTool />;
    case "json-to-excel":
      return <JsonToExcelTool />;
    case "markdown-to-html":
      return <MarkdownSuiteTool mode="md-to-html" />;
    case "html-to-markdown":
      return <MarkdownSuiteTool mode="html-to-md" />;
    case "markdown-editor":
      return <MarkdownSuiteTool mode="editor" />;
    case "citation-generator":
      return <CitationGeneratorTool />;
    case "sql-formatter":
      return <SqlFormatterTool />;
    case "sql-query-builder":
      return <SqlQueryBuilderTool />;
    case "hash-generator":
      return <HashGeneratorTool />;
    case "code-minifier":
      return <CodeMinifierTool />;
    case "css-formatter":
      return <CssFormatterTool />;
    case "scientific-calculator":
      return <ScientificCalculatorTool />;
    case "equation-solver":
      return <EquationSolverTool />;
    case "habit-tracker":
      return <HabitTrackerTool />;
    case "project-timeline-generator":
      return <ProjectTimelineGeneratorTool />;
  }
}
