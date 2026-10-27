import {
  AlertCircle,
  Check,
  Download,
  FileText,
  Info,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/file-dropzone";
import {
  buildPdfFromEncodedImages,
  compressPdfBuffer,
  computeTargetDimensions,
  generateSamplePdfBytes,
  inspectPdfBytes,
  mergePdfBuffers,
  rotatePdfBuffer,
  splitPdfBuffer,
  type EncodedImageInput,
  type SplitPdfOutputItem,
} from "@/lib/file-tools";
import { downloadBlob, formatBytes, sanitizeFilename } from "@/lib/file-utils";

function uint8ToPdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}

async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function createSamplePdfFile(filename: string, title: string, pages: number): Promise<File> {
  const bytes = await generateSamplePdfBytes(title, pages);
  const blob = uint8ToPdfBlob(bytes);
  return new File([blob], filename, { type: "application/pdf" });
}

async function createSampleCanvasImageFile(
  filename = "sample-graphic.png",
  width = 800,
  height = 500,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#d9f99d";
    ctx.fillRect(40, 40, width - 80, 120);
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("IJM Sample Image", 70, 112);
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px sans-serif";
    ctx.fillText(`Original Size: ${width} × ${height} px`, 70, 240);
    ctx.fillStyle = "#a1a1aa";
    ctx.fillText("Processed 100% locally in your browser.", 70, 290);
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
  return new File([blob], filename, { type: "image/png" });
}

async function decodeImageFileToElement(
  file: File,
): Promise<{ img: HTMLImageElement; width: number; height: number; url: string }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        url,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to decode image "${file.name}".`));
    };
    img.src = url;
  });
}

function MergePdfsTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergedOutput, setMergedOutput] = useState<{
    bytes: Uint8Array;
    totalPages: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    setMergedOutput(null);
    setError(null);

    const inspectAll = async () => {
      const counts: Record<string, number> = {};
      for (const f of files) {
        const bytes = await readFileAsUint8Array(f);
        const info = await inspectPdfBytes(bytes);
        if (!active) return;
        if (!info.ok) {
          setError(`"${f.name}": ${info.error ?? "Invalid PDF"}`);
          return;
        }
        counts[`${f.name}-${f.size}`] = info.pageCount;
      }
      if (active) setPageCounts(counts);
    };

    if (files.length > 0) {
      void inspectAll();
    } else {
      setPageCounts({});
    }
    return () => {
      active = false;
    };
  }, [files]);

  const handleLoadSample = async () => {
    setError(null);
    const f1 = await createSamplePdfFile("project-overview.pdf", "Project Overview", 2);
    const f2 = await createSamplePdfFile("financial-summary.pdf", "Financial Summary", 3);
    setFiles([f1, f2]);
  };

  const handleMerge = async () => {
    setError(null);
    setMergedOutput(null);
    if (files.length < 2) {
      setError("Please select at least 2 PDF files to merge.");
      return;
    }

    setProcessing(true);
    try {
      const buffers: Uint8Array[] = [];
      for (const f of files) {
        buffers.push(await readFileAsUint8Array(f));
      }
      const res = await mergePdfBuffers(buffers);
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to merge PDFs.");
      } else {
        setMergedOutput({
          bytes: res.bytes,
          totalPages: res.totalPages ?? 0,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Upload 2 or more PDF files, use the up/down arrows to arrange their order, and merge them
          into a single document.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 2 Sample PDFs
        </button>
      </div>

      <FileDropzone
        label="Drop PDF files here to merge"
        description="Supports multiple .pdf files up to 50 MB each. Reorder files before merging."
        accept=".pdf,application/pdf"
        multiple
        allowReorder
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {files.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-4">
          <div className="text-sm">
            <span className="font-semibold text-foreground">
              {files.length} PDF {files.length === 1 ? "file" : "files"} queued
            </span>
            {Object.keys(pageCounts).length > 0 && (
              <span className="ml-2 text-muted-foreground">
                (
                {files
                  .map((f) => `${f.name}: ${pageCounts[`${f.name}-${f.size}`] ?? "?"}p`)
                  .join(" + ")}
                )
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={files.length < 2 || processing}
            onClick={() => void handleMerge()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Merging PDFs...
              </>
            ) : (
              "Merge PDFs Now"
            )}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {mergedOutput && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-primary/20 p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Merged PDF Ready ({mergedOutput.totalPages} pages)
              </h3>
              <p className="text-xs text-muted-foreground">
                Output size: {formatBytes(mergedOutput.bytes.byteLength)} • Combined {files.length}{" "}
                files
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => downloadBlob(uint8ToPdfBlob(mergedOutput.bytes), "merged-document.pdf")}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Merged PDF
          </button>
        </div>
      )}
    </div>
  );
}

function SplitPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState("1-2");
  const [combineMode, setCombineMode] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<SplitPdfOutputItem[]>([]);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setOutputs([]);
    setError(null);
    setTotalPages(null);

    if (!activeFile) return;

    readFileAsUint8Array(activeFile)
      .then((bytes) => inspectPdfBytes(bytes))
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Invalid PDF file.");
        } else {
          setTotalPages(res.pageCount);
          setRangeInput(res.pageCount > 1 ? `1-${res.pageCount - 1}` : "1");
        }
      })
      .catch(() => {
        if (active) setError("Could not read PDF file.");
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSamplePdfFile("quarterly-report-5p.pdf", "Quarterly Report", 5);
    setFiles([sample]);
  };

  const handleSplit = async () => {
    if (!activeFile) return;
    setError(null);
    setOutputs([]);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const res = await splitPdfBuffer(bytes, rangeInput, combineMode);
      if (!res.ok) {
        setError(res.error ?? "Failed to split PDF.");
      } else {
        setOutputs(res.outputs);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Extract specific pages or split page ranges into separate PDF files.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 5-Page Sample PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to split"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && totalPages !== null && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              Document has {totalPages} {totalPages === 1 ? "page" : "pages"} (1 to {totalPages})
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="split-range-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Page Ranges (e.g. 1-3, 5 or "all")
              </label>
              <input
                id="split-range-input"
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="1-3, 5"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground outline-none focus:border-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="split-mode-select"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Output Mode
              </label>
              <select
                id="split-mode-select"
                value={combineMode ? "single" : "separate"}
                onChange={(e) => setCombineMode(e.target.value === "single")}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="single">Combine selected pages into 1 PDF</option>
                <option value="separate">Create a separate PDF for each range</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleSplit()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Splitting PDF...
              </>
            ) : (
              "Extract Pages"
            )}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {outputs.length > 0 && (
        <div className="space-y-3 rounded-3xl border bg-card p-6">
          <h3 className="text-base font-bold text-foreground">
            Extracted PDF {outputs.length === 1 ? "File" : `Files (${outputs.length})`}
          </h3>
          <ul className="divide-y">
            {outputs.map((item, idx) => {
              const baseName = sanitizeFilename(
                activeFile?.name.replace(/\.pdf$/i, "") ?? "document",
              );
              const outName = `${baseName}-${item.label}.pdf`;
              return (
                <li
                  key={`${item.label}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/30">
                      <FileText className="h-4 w-4 text-foreground" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{outName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.pageCount} {item.pageCount === 1 ? "page" : "pages"} •{" "}
                        {formatBytes(item.bytes.byteLength)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBlob(uint8ToPdfBlob(item.bytes), outName)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden /> Download PDF
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompressPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [stripMetadata, setStripMetadata] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    originalBytes: number;
    compressedBytes: number;
    savedBytes: number;
    pageCount: number;
    bytes: Uint8Array;
  } | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSamplePdfFile(
      "unoptimized-document.pdf",
      "Unoptimized Sample PDF",
      4,
    );
    setFiles([sample]);
  };

  const handleCompress = async () => {
    if (!activeFile) return;
    setError(null);
    setResult(null);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const res = await compressPdfBuffer(bytes, stripMetadata);
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to optimize PDF.");
      } else {
        setResult({
          originalBytes: res.originalBytes ?? bytes.byteLength,
          compressedBytes: res.compressedBytes ?? res.bytes.byteLength,
          savedBytes: res.savedBytes ?? 0,
          pageCount: res.pageCount ?? 1,
          bytes: res.bytes,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-2xl items-start gap-2.5 rounded-2xl border bg-muted/40 p-3.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <strong>How local PDF compression works:</strong> This tool rebuilds the PDF
            cross-reference table using PDF 1.5+ compressed object streams and optionally strips
            embedded document metadata. Text and vector quality remain 100% lossless. Note: PDFs
            composed primarily of already-compressed JPEG scans may show minimal size reduction
            without lossy image downsampling.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to optimize"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={stripMetadata}
              onChange={(e) => setStripMetadata(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Strip document metadata (Author, Title, Producer, Keywords)
          </label>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleCompress()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Optimizing...
              </>
            ) : (
              "Optimize PDF"
            )}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-primary/20 p-6"
        >
          <div>
            <h3 className="text-base font-bold text-foreground">
              Optimization Complete ({result.pageCount} {result.pageCount === 1 ? "page" : "pages"})
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Original: <strong>{formatBytes(result.originalBytes)}</strong> → Optimized:{" "}
              <strong>{formatBytes(result.compressedBytes)}</strong> (
              {result.savedBytes > 0
                ? `Saved ${formatBytes(result.savedBytes)} / ${Math.round((result.savedBytes / result.originalBytes) * 100)}%`
                : "Already compact — structure verified"}
              )
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const base = sanitizeFilename(activeFile?.name.replace(/\.pdf$/i, "") ?? "document");
              downloadBlob(uint8ToPdfBlob(result.bytes), `${base}-optimized.pdf`);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Optimized PDF
          </button>
        </div>
      )}
    </div>
  );
}

function RotatePagesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [scope, setScope] = useState<"all" | "custom">("all");
  const [customRange, setCustomRange] = useState("1");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{
    bytes: Uint8Array;
    rotatedCount: number;
  } | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setOutput(null);
    setError(null);
    setTotalPages(null);

    if (!activeFile) return;

    readFileAsUint8Array(activeFile)
      .then((bytes) => inspectPdfBytes(bytes))
      .then((res) => {
        if (!active) return;
        if (!res.ok) setError(res.error ?? "Invalid PDF");
        else setTotalPages(res.pageCount);
      })
      .catch(() => {
        if (active) setError("Could not read PDF.");
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSamplePdfFile("scanned-pages.pdf", "Scanned Pages", 3);
    setFiles([sample]);
  };

  const handleRotate = async () => {
    if (!activeFile) return;
    setError(null);
    setOutput(null);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const rangeStr = scope === "all" ? "all" : customRange;
      const res = await rotatePdfBuffer(bytes, angle, rangeStr);
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to rotate pages.");
      } else {
        setOutput({
          bytes: res.bytes,
          rotatedCount: res.rotatedCount ?? 0,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Rotate all or selected pages in a PDF document by 90°, 180°, or 270°.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to rotate"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && totalPages !== null && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="rotate-angle"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Rotation Angle
              </label>
              <select
                id="rotate-angle"
                value={String(angle)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAngle(v === 180 ? 180 : v === 270 ? 270 : 90);
                }}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="90">90° Clockwise</option>
                <option value="180">180° Upside Down</option>
                <option value="270">270° (90° Counter-Clockwise)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rotate-scope"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Pages to Rotate ({totalPages} total)
              </label>
              <select
                id="rotate-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value === "custom" ? "custom" : "all")}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="all">All Pages (1–{totalPages})</option>
                <option value="custom">Specific Page Range</option>
              </select>
            </div>

            {scope === "custom" && (
              <div>
                <label
                  htmlFor="rotate-custom-range"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Page Numbers / Ranges
                </label>
                <input
                  id="rotate-custom-range"
                  type="text"
                  value={customRange}
                  onChange={(e) => setCustomRange(e.target.value)}
                  placeholder="e.g. 1, 3-4"
                  className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleRotate()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            {processing ? "Rotating..." : "Apply Rotation"}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {output && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-primary/20 p-6"
        >
          <div>
            <h3 className="text-base font-bold text-foreground">
              Rotated {output.rotatedCount} {output.rotatedCount === 1 ? "page" : "pages"} by{" "}
              {angle}°
            </h3>
            <p className="text-xs text-muted-foreground">
              Output size: {formatBytes(output.bytes.byteLength)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const base = sanitizeFilename(activeFile?.name.replace(/\.pdf$/i, "") ?? "document");
              downloadBlob(uint8ToPdfBlob(output.bytes), `${base}-rotated.pdf`);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Rotated PDF
          </button>
        </div>
      )}
    </div>
  );
}

function ImageToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("a4");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [marginPoints, setMarginPoints] = useState(24);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    setPdfBytes(null);
    setError(null);
  }, [files, pageSize, orientation, marginPoints]);

  const handleLoadSample = async () => {
    const img1 = await createSampleCanvasImageFile("slide-1.png", 800, 500);
    const img2 = await createSampleCanvasImageFile("slide-2.png", 800, 500);
    setFiles([img1, img2]);
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setError(null);
    setPdfBytes(null);
    setProcessing(true);

    try {
      const encodedList: EncodedImageInput[] = [];
      for (const f of files) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
          encodedList.push({
            name: f.name,
            bytes: await readFileAsUint8Array(f),
            format: "jpg",
          });
        } else if (lower.endsWith(".png")) {
          encodedList.push({
            name: f.name,
            bytes: await readFileAsUint8Array(f),
            format: "png",
          });
        } else {
          const decoded = await decodeImageFileToElement(f);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = decoded.width;
            canvas.height = decoded.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context unavailable");
            ctx.drawImage(decoded.img, 0, 0);
            const pngBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to encode image as PNG"));
              }, "image/png");
            });
            encodedList.push({
              name: f.name,
              bytes: new Uint8Array(await pngBlob.arrayBuffer()),
              format: "png",
            });
          } finally {
            URL.revokeObjectURL(decoded.url);
          }
        }
      }

      const res = await buildPdfFromEncodedImages(encodedList, {
        pageSize,
        orientation,
        marginPoints,
      });

      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to create PDF from images.");
      } else {
        setPdfBytes(res.bytes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image files.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Combine JPG, PNG, and WebP images into a clean, multi-page PDF document.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 2 Sample Images
        </button>
      </div>

      <FileDropzone
        label="Drop JPG, PNG, or WebP images here"
        description="Select multiple images and reorder them with the up/down buttons."
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        allowReorder
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 30 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {files.length > 0 && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="img-pdf-size"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Page Size
              </label>
              <select
                id="img-pdf-size"
                value={pageSize}
                onChange={(e) =>
                  setPageSize(
                    e.target.value === "letter"
                      ? "letter"
                      : e.target.value === "fit"
                        ? "fit"
                        : "a4",
                  )
                }
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="a4">A4 Standard</option>
                <option value="letter">US Letter</option>
                <option value="fit">Fit Page to Image Dimensions</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="img-pdf-orientation"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Orientation
              </label>
              <select
                id="img-pdf-orientation"
                disabled={pageSize === "fit"}
                value={orientation}
                onChange={(e) =>
                  setOrientation(
                    e.target.value === "portrait"
                      ? "portrait"
                      : e.target.value === "landscape"
                        ? "landscape"
                        : "auto",
                  )
                }
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                <option value="auto">Auto (Match Image Aspect)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="img-pdf-margin"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Page Margin
              </label>
              <select
                id="img-pdf-margin"
                value={String(marginPoints)}
                onChange={(e) => setMarginPoints(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="0">No Margin (0 pt)</option>
                <option value="24">Small Margin (24 pt)</option>
                <option value="48">Standard Margin (48 pt)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleConvert()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing
              ? "Building PDF..."
              : `Convert ${files.length} ${files.length === 1 ? "Image" : "Images"} to PDF`}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {pdfBytes && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-primary/20 p-6"
        >
          <div>
            <h3 className="text-base font-bold text-foreground">
              PDF Created ({files.length} {files.length === 1 ? "page" : "pages"})
            </h3>
            <p className="text-xs text-muted-foreground">
              File size: {formatBytes(pdfBytes.byteLength)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadBlob(uint8ToPdfBlob(pdfBytes), "images-bundle.pdf")}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

function ResizeImagesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [origMeta, setOrigMeta] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mode, setMode] = useState<"dimensions" | "percentage">("percentage");
  const [percentage, setPercentage] = useState("50");
  const [targetWidth, setTargetWidth] = useState("800");
  const [targetHeight, setTargetHeight] = useState("500");
  const [lockAspect, setLockAspect] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resizedBlob, setResizedBlob] = useState<{
    blob: Blob;
    width: number;
    height: number;
    filename: string;
  } | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setResizedBlob(null);
    setError(null);
    setOrigMeta(null);

    if (!activeFile) return;

    decodeImageFileToElement(activeFile)
      .then((decoded) => {
        URL.revokeObjectURL(decoded.url);
        if (!active) return;
        setOrigMeta({ width: decoded.width, height: decoded.height });
        setTargetWidth(String(Math.max(1, Math.round(decoded.width / 2))));
        setTargetHeight(String(Math.max(1, Math.round(decoded.height / 2))));
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not decode image.");
        }
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleWidthChange = (val: string) => {
    setTargetWidth(val);
    const numW = Number.parseInt(val, 10);
    if (lockAspect && origMeta && Number.isFinite(numW) && numW > 0) {
      const nextH = Math.max(1, Math.round((numW * origMeta.height) / origMeta.width));
      setTargetHeight(String(nextH));
    }
  };

  const handleHeightChange = (val: string) => {
    setTargetHeight(val);
    const numH = Number.parseInt(val, 10);
    if (lockAspect && origMeta && Number.isFinite(numH) && numH > 0) {
      const nextW = Math.max(1, Math.round((numH * origMeta.width) / origMeta.height));
      setTargetWidth(String(nextW));
    }
  };

  const handleResize = async () => {
    if (!activeFile || !origMeta) return;
    setError(null);
    setResizedBlob(null);

    const calc = computeTargetDimensions(origMeta.width, origMeta.height, {
      mode,
      percentage: Number(percentage),
      targetWidth: Number(targetWidth),
      targetHeight: Number(targetHeight),
      lockAspectRatio: lockAspect,
    });

    if (!calc.ok) {
      setError(calc.error ?? "Invalid target dimensions.");
      return;
    }

    setProcessing(true);
    try {
      const decoded = await decodeImageFileToElement(activeFile);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = calc.width;
        canvas.height = calc.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context is not available.");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(decoded.img, 0, 0, calc.width, calc.height);

        const mime =
          activeFile.type === "image/jpeg" ||
          activeFile.type === "image/webp" ||
          activeFile.type === "image/png"
            ? activeFile.type
            : "image/png";

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("Failed to encode resized image."));
            },
            mime,
            0.92,
          );
        });

        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
        const base = sanitizeFilename(activeFile.name.replace(/\.[^.]+$/, ""));
        setResizedBlob({
          blob,
          width: calc.width,
          height: calc.height,
          filename: `${base}-${calc.width}x${calc.height}.${ext}`,
        });
      } finally {
        URL.revokeObjectURL(decoded.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resize image.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Resize PNG, JPG, and WebP images by exact pixel dimensions or percentage using
          high-quality browser resampling.
        </p>
        <button
          type="button"
          onClick={() =>
            void createSampleCanvasImageFile("sample-banner.png", 1200, 630).then((f) =>
              setFiles([f]),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample Image (1200×630)
        </button>
      </div>

      <FileDropzone
        label="Drop an image to resize"
        description="Supports PNG, JPG, JPEG, and WebP up to 30 MB."
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 30 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && origMeta && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              Original Dimensions: {origMeta.width} × {origMeta.height} px (
              {formatBytes(activeFile.size)})
            </span>
            <div
              role="group"
              aria-label="Resize mode"
              className="inline-flex rounded-full border bg-card p-1"
            >
              <button
                type="button"
                onClick={() => setMode("percentage")}
                className={`rounded-full px-4 py-1 text-xs font-semibold ${
                  mode === "percentage" ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                By Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setMode("dimensions")}
                className={`rounded-full px-4 py-1 text-xs font-semibold ${
                  mode === "dimensions" ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                By Exact Pixels (px)
              </button>
            </div>
          </div>

          {mode === "percentage" ? (
            <div className="space-y-3">
              <label
                htmlFor="resize-pct-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Scale Percentage (1% – 500%)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[25, 50, 75, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPercentage(String(preset))}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                      Number(percentage) === preset
                        ? "border-foreground bg-primary text-primary-foreground"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
                <input
                  id="resize-pct-input"
                  type="number"
                  min={1}
                  max={500}
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="w-24 rounded-xl border bg-card px-3 py-1.5 font-mono text-sm text-foreground"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="resize-width-input"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Width (px)
                </label>
                <input
                  id="resize-width-input"
                  type="number"
                  min={1}
                  max={12000}
                  value={targetWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-sm text-foreground"
                />
              </div>
              <div>
                <label
                  htmlFor="resize-height-input"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Height (px)
                </label>
                <input
                  id="resize-height-input"
                  type="number"
                  min={1}
                  max={12000}
                  value={targetHeight}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-sm text-foreground"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3.5 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Lock aspect ratio
                </label>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleResize()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? "Resizing..." : "Resize Image"}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {resizedBlob && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-primary/20 p-6"
        >
          <div>
            <h3 className="text-base font-bold text-foreground">
              Resized to {resizedBlob.width} × {resizedBlob.height} px
            </h3>
            <p className="text-xs text-muted-foreground">
              Output file: {resizedBlob.filename} ({formatBytes(resizedBlob.blob.size)})
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadBlob(resizedBlob.blob, resizedBlob.filename)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Resized Image
          </button>
        </div>
      )}
    </div>
  );
}

function ConvertImagesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [targetMime, setTargetMime] = useState<"image/png" | "image/jpeg" | "image/webp">(
    "image/webp",
  );
  const [quality, setQuality] = useState(90);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedItems, setConvertedItems] = useState<
    {
      filename: string;
      blob: Blob;
      originalSize: number;
      width: number;
      height: number;
    }[]
  >([]);

  useEffect(() => {
    setConvertedItems([]);
    setError(null);
  }, [files, targetMime, quality]);

  const handleConvertAll = async () => {
    if (files.length === 0) return;
    setError(null);
    setConvertedItems([]);
    setProcessing(true);

    try {
      const results: {
        filename: string;
        blob: Blob;
        originalSize: number;
        width: number;
        height: number;
      }[] = [];

      const ext =
        targetMime === "image/jpeg" ? "jpg" : targetMime === "image/webp" ? "webp" : "png";

      for (const f of files) {
        const decoded = await decodeImageFileToElement(f);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = decoded.width;
          canvas.height = decoded.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context is not available.");

          if (targetMime === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, decoded.width, decoded.height);
          }
          ctx.drawImage(decoded.img, 0, 0);

          const qParam =
            targetMime === "image/png" ? undefined : Math.min(1, Math.max(0.1, quality / 100));

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error(`Failed to convert "${f.name}".`));
              },
              targetMime,
              qParam,
            );
          });

          const base = sanitizeFilename(f.name.replace(/\.[^.]+$/, ""));
          results.push({
            filename: `${base}.${ext}`,
            blob,
            originalSize: f.size,
            width: decoded.width,
            height: decoded.height,
          });
        } finally {
          URL.revokeObjectURL(decoded.url);
        }
      }

      setConvertedItems(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert images.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Convert images between PNG (lossless), JPEG, and WebP formats right in your browser.
          Transparent areas are composited onto white when converting to JPEG.
        </p>
        <button
          type="button"
          onClick={() =>
            void createSampleCanvasImageFile("illustration.png", 900, 600).then((f) =>
              setFiles([f]),
            )
          }
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample PNG
        </button>
      </div>

      <FileDropzone
        label="Drop images to convert format"
        description="Supports PNG, JPG, JPEG, and WebP up to 30 MB each."
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 30 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {files.length > 0 && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="convert-target-format"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Target Image Format
              </label>
              <select
                id="convert-target-format"
                value={targetMime}
                onChange={(e) =>
                  setTargetMime(
                    e.target.value === "image/jpeg"
                      ? "image/jpeg"
                      : e.target.value === "image/png"
                        ? "image/png"
                        : "image/webp",
                  )
                }
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="image/webp">WebP (Modern, compact)</option>
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png — Lossless)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="convert-quality"
                className="block text-xs font-semibold text-muted-foreground"
              >
                {targetMime === "image/png"
                  ? "Compression (PNG is always lossless)"
                  : `Encoding Quality: ${quality}%`}
              </label>
              <input
                id="convert-quality"
                type="range"
                min={10}
                max={100}
                step={5}
                disabled={targetMime === "image/png"}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-3 w-full accent-foreground disabled:opacity-40"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleConvertAll()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? "Converting..." : "Convert Images Now"}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {convertedItems.length > 0 && (
        <div className="space-y-3 rounded-3xl border bg-card p-6">
          <h3 className="text-base font-bold text-foreground">
            Converted {convertedItems.length} {convertedItems.length === 1 ? "Image" : "Images"}
          </h3>
          <ul className="divide-y">
            {convertedItems.map((item, idx) => (
              <li
                key={`${item.filename}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.width} × {item.height} px • {formatBytes(item.originalSize)} →{" "}
                    <strong>{formatBytes(item.blob.size)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadBlob(item.blob, item.filename)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FileToolWorkspace({ toolSlug }: { toolSlug: string }) {
  switch (toolSlug) {
    case "merge-pdfs":
      return <MergePdfsTool />;
    case "split-pdf":
      return <SplitPdfTool />;
    case "compress-pdf":
      return <CompressPdfTool />;
    case "rotate-pages":
      return <RotatePagesTool />;
    case "image-to-pdf":
      return <ImageToPdfTool />;
    case "resize-images":
      return <ResizeImagesTool />;
    case "convert-images":
      return <ConvertImagesTool />;
    default:
      return null;
  }
}
