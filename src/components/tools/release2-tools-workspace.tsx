import {
  AlertCircle,
  Archive,
  Check,
  Copy,
  Crop,
  Download,
  Eraser,
  FileCheck2,
  FileImage,
  FileText,
  GitCompare,
  Hash,
  ImageDown,
  Info,
  Loader2,
  Palette,
  PenTool,
  Pipette,
  Scissors,
  ShieldAlert,
  Sparkles,
  Stamp,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FileDropzone } from "@/components/file-dropzone";
import { generateSamplePdfBytes, inspectPdfBytes } from "@/lib/file-tools";
import { downloadBlob, formatBytes, sanitizeFilename } from "@/lib/file-utils";
import {
  addPageNumbersToPdfBuffer,
  addWatermarkToPdfBuffer,
  buildZipArchive,
  comparePdfBuffers,
  computeCropBox,
  encodeImageBytesToBase64Snippets,
  extractDominantColorsFromRgba,
  extractPdfPageDetails,
  extractPdfPagesBuffer,
  formatPageNumberLabel,
  generateBulkRenamedFilenames,
  generateSampleComparisonPdfPair,
  injectPngPhysDpiChunk,
  inspectImageDpiAndMetadata,
  isRelease2ToolSlug,
  rgbToHex,
  rgbToHslString,
  signPdfBuffer,
  type CropAspectPreset,
  type ExtractedColorSwatch,
  type ImageDpiMetadataReport,
  type PageNumberFormat,
  type PageNumberPosition,
  type PdfComparisonResult,
  type Release2ToolSlug,
  type RenameCaseStyle,
  type SignaturePageTarget,
  type SignaturePlacementPosition,
  type WatermarkPlacement,
} from "@/lib/release2-tools";

export { isRelease2ToolSlug };

function uint8ToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: mimeType });
}

async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

async function createSamplePdfFile(filename: string, title: string, pages: number): Promise<File> {
  const bytes = await generateSamplePdfBytes(title, pages);
  const blob = uint8ToBlob(bytes, "application/pdf");
  return new File([blob], filename, { type: "application/pdf" });
}

async function createSampleGraphicFile(
  filename = "sample-artwork.png",
  width = 960,
  height = 600,
  injectDpi?: number,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Rich multi-swatch geometric artwork for palette extraction, cropping, DPI, and compression
    ctx.fillStyle = "#111113";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#D6F538";
    ctx.fillRect(48, 48, width - 96, 140);

    ctx.fillStyle = "#2563EB";
    ctx.fillRect(48, 220, Math.floor((width - 128) / 3), height - 268);

    ctx.fillStyle = "#EA580C";
    ctx.fillRect(
      48 + Math.floor((width - 128) / 3) + 16,
      220,
      Math.floor((width - 128) / 3),
      height - 268,
    );

    ctx.fillStyle = "#10B981";
    ctx.fillRect(
      48 + (Math.floor((width - 128) / 3) + 16) * 2,
      220,
      Math.floor((width - 128) / 3),
      height - 268,
    );

    ctx.fillStyle = "#111113";
    ctx.font = "bold 36px sans-serif";
    ctx.fillText("IJM Studio Sample", 76, 118);
    ctx.font = "20px monospace";
    ctx.fillText(`${width} × ${height} px • RGB Test Card`, 76, 156);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });

  if (injectDpi && injectDpi > 0) {
    const rawBytes = new Uint8Array(await blob.arrayBuffer());
    const withPhys = injectPngPhysDpiChunk(rawBytes, injectDpi);
    return new File([uint8ToBlob(withPhys, "image/png")], filename, { type: "image/png" });
  }

  return new File([blob], filename, { type: "image/png" });
}

async function decodeImageFile(file: File): Promise<{
  img: HTMLImageElement;
  width: number;
  height: number;
  url: string;
}> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        img,
        width: img.naturalWidth || img.width || 600,
        height: img.naturalHeight || img.height || 400,
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

// ============================================================================
// 1. PDF TO JPG CONVERTER
// ============================================================================

interface RenderedJpgPage {
  pageNumber: number;
  filename: string;
  width: number;
  height: number;
  blob: Blob;
  bytes: Uint8Array;
  previewUrl: string;
}

function PdfToJpgTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(90);
  const [scalePreset, setScalePreset] = useState<1 | 1.5 | 2>(1.5);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState<RenderedJpgPage[]>([]);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    return () => {
      renderedPages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [renderedPages]);

  const handleLoadSample = async () => {
    setError(null);
    const sample = await createSamplePdfFile("product-deck-3p.pdf", "Product Launch Deck", 3);
    setFiles([sample]);
  };

  const handleConvert = async () => {
    if (!activeFile) return;
    setError(null);
    setProcessing(true);
    renderedPages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setRenderedPages([]);

    try {
      const pdfBytes = await readFileAsUint8Array(activeFile);
      const extracted = await extractPdfPageDetails(pdfBytes);
      if (!extracted.ok || extracted.pageCount === 0) {
        setError(extracted.error ?? "Unable to parse PDF pages.");
        return;
      }

      const stem =
        sanitizeFilename(activeFile.name.replace(/\.pdf$/i, ""), "document").replace(
          /\.pdf$/i,
          "",
        ) || "document";
      const outPages: RenderedJpgPage[] = [];

      for (const page of extracted.pages) {
        const w = Math.max(300, Math.round(page.width * scalePreset));
        const h = Math.max(400, Math.round(page.height * scalePreset));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // Clean white paper canvas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);

        // Top accent bar & page frame
        ctx.strokeStyle = "#e4e4e7";
        ctx.lineWidth = Math.max(2, Math.round(2 * scalePreset));
        ctx.strokeRect(
          Math.round(24 * scalePreset),
          Math.round(24 * scalePreset),
          w - Math.round(48 * scalePreset),
          h - Math.round(48 * scalePreset),
        );

        ctx.fillStyle = "#111113";
        ctx.fillRect(
          Math.round(24 * scalePreset),
          Math.round(24 * scalePreset),
          w - Math.round(48 * scalePreset),
          Math.round(44 * scalePreset),
        );

        ctx.fillStyle = "#D6F538";
        ctx.font = `bold ${Math.round(13 * scalePreset)}px monospace`;
        ctx.fillText(
          `${activeFile.name} • PAGE ${page.pageNumber} OF ${extracted.pageCount} (${page.width}×${page.height} pt)`,
          Math.round(40 * scalePreset),
          Math.round(51 * scalePreset),
        );

        const linesToDraw =
          page.lines.length > 0
            ? page.lines
            : [
                `Document: ${activeFile.name}`,
                `Page ${page.pageNumber} of ${extracted.pageCount}`,
                `Dimensions: ${page.width} × ${page.height} pt (${w} × ${h} px at ${Math.round(72 * scalePreset)} DPI)`,
              ];

        linesToDraw.slice(0, 22).forEach((line, idx) => {
          ctx.fillStyle = idx === 0 ? "#111113" : "#27272a";
          ctx.font =
            idx === 0
              ? `bold ${Math.round(20 * scalePreset)}px sans-serif`
              : `${Math.round(13 * scalePreset)}px sans-serif`;
          const maxChars = Math.floor((w - 100 * scalePreset) / (7.5 * scalePreset));
          constclipped = line.length > maxChars ? `${line.slice(0, maxChars)}…` : line;
          ctx.fillText(
            constclipped,
            Math.round(44 * scalePreset),
            Math.round((115 + idx * 28) * scalePreset),
          );
        });

        const jpgBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("Canvas JPEG export failed"));
            },
            "image/jpeg",
            Math.max(0.1, Math.min(1, quality / 100)),
          );
        });

        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
        const filename = `${stem}-page-${String(page.pageNumber).padStart(2, "0")}.jpg`;
        outPages.push({
          pageNumber: page.pageNumber,
          filename,
          width: w,
          height: h,
          blob: jpgBlob,
          bytes: jpgBytes,
          previewUrl: URL.createObjectURL(jpgBlob),
        });
      }

      setRenderedPages(outPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render PDF pages to JPG.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadAllZip = () => {
    if (renderedPages.length === 0) return;
    const zipBytes = buildZipArchive(
      renderedPages.map((p) => ({
        filename: p.filename,
        bytes: p.bytes,
      })),
    );
    downloadBlob(uint8ToBlob(zipBytes, "application/zip"), "pdf-pages-jpg.zip");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Render every page of a PDF into high-resolution JPG images locally in your browser.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 3-Page Sample PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to convert to JPG images"
        description="Supports .pdf files up to 50 MB. Processed locally in browser memory."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          setRenderedPages([]);
          setError(null);
        }}
      />

      {activeFile && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="pdf-jpg-dpi"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Output Resolution Scale
              </label>
              <select
                id="pdf-jpg-dpi"
                value={scalePreset}
                onChange={(e) => setScalePreset(Number(e.target.value) as 1 | 1.5 | 2)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value={1}>1x Standard (72 DPI — Compact)</option>
                <option value={1.5}>1.5x Sharp (108 DPI — Recommended)</option>
                <option value={2}>2x High-Res (144 DPI — Presentation)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pdf-jpg-quality"
                className="block text-xs font-semibold text-muted-foreground"
              >
                JPEG Quality: {quality}%
              </label>
              <input
                id="pdf-jpg-quality"
                type="range"
                min={20}
                max={100}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleConvert()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Rendering JPG Pages...
              </>
            ) : (
              <>
                <FileImage className="h-4 w-4" aria-hidden /> Convert PDF to JPG
              </>
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

      {renderedPages.length > 0 && (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Rendered {renderedPages.length} JPG {renderedPages.length === 1 ? "Page" : "Pages"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Download individual page JPGs or export all pages as a single .ZIP archive.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadAllZip}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Archive className="h-4 w-4" aria-hidden /> Download All (.ZIP)
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderedPages.map((p) => (
              <div
                key={p.pageNumber}
                className="flex flex-col justify-between rounded-2xl border bg-muted/20 p-3.5"
              >
                <div className="overflow-hidden rounded-xl border bg-white">
                  <img
                    src={p.previewUrl}
                    alt={`Page ${p.pageNumber} preview`}
                    className="h-48 w-full object-contain"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-foreground">Page {p.pageNumber}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {p.width}×{p.height}px • {formatBytes(p.blob.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBlob(p.blob, p.filename)}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden /> JPG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. EXTRACT PDF PAGES
// ============================================================================

function ExtractPdfPagesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState("1, 3");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<{
    bytes: Uint8Array;
    selectedPages: number[];
  } | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setExtractedResult(null);
    setError(null);
    setTotalPages(null);
    if (!activeFile) return;

    readFileAsUint8Array(activeFile)
      .then((b) => inspectPdfBytes(b))
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setError(res.error ?? "Invalid PDF file.");
        } else {
          setTotalPages(res.pageCount);
          setRangeInput(res.pageCount >= 3 ? "1, 3" : "1");
        }
      })
      .catch(() => {
        if (active) setError("Unable to inspect PDF.");
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSamplePdfFile("board-packet-5p.pdf", "Board Packet", 5);
    setFiles([sample]);
  };

  const togglePageInRange = (pageNum: number) => {
    const tokens = rangeInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const str = String(pageNum);
    if (tokens.includes(str)) {
      const filtered = tokens.filter((t) => t !== str);
      setRangeInput(filtered.length > 0 ? filtered.join(", ") : "1");
    } else {
      setRangeInput([...tokens, str].join(", "));
    }
  };

  const handleExtract = async () => {
    if (!activeFile) return;
    setError(null);
    setExtractedResult(null);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const res = await extractPdfPagesBuffer(bytes, rangeInput);
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to extract PDF pages.");
      } else {
        setExtractedResult({
          bytes: res.bytes,
          selectedPages: res.selectedPages ?? [],
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
          Pick specific pages or ranges from a PDF and combine them into a clean new PDF document.
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
        label="Drop a PDF file to extract pages"
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Page Toggle ({totalPages} total pages)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: Math.min(totalPages, 24) }, (_, idx) => {
                const pageNum = idx + 1;
                const isSelected = rangeInput
                  .split(",")
                  .map((s) => s.trim())
                  .includes(String(pageNum));
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => togglePageInRange(pageNum)}
                    className={`rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition ${
                      isSelected
                        ? "border-foreground bg-primary text-primary-foreground"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    Page {pageNum}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="extract-range-input"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Pages / Ranges to Extract (e.g. 1, 3, 4-5)
            </label>
            <input
              id="extract-range-input"
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="1, 3-5"
              className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground outline-none focus:border-foreground"
            />
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleExtract()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Extracting Pages...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" aria-hidden /> Extract Selected Pages
              </>
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

      {extractedResult && (
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
                Extracted {extractedResult.selectedPages.length}{" "}
                {extractedResult.selectedPages.length === 1 ? "Page" : "Pages"} Ready
              </h3>
              <p className="text-xs text-muted-foreground">
                Pages included: {extractedResult.selectedPages.join(", ")} • Size:{" "}
                {formatBytes(extractedResult.bytes.byteLength)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadBlob(
                uint8ToBlob(extractedResult.bytes, "application/pdf"),
                `extracted-pages-${extractedResult.selectedPages.join("-")}.pdf`,
              )
            }
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Extracted PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. ADD PAGE NUMBERS TO PDF
// ============================================================================

function AddPageNumbersToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState<PageNumberPosition>("bottom-center");
  const [format, setFormat] = useState<PageNumberFormat>("page-of-total");
  const [startNumber, setStartNumber] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [marginPoints, setMarginPoints] = useState(28);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ bytes: Uint8Array; pageCount: number } | null>(null);

  const activeFile = files[0] ?? null;

  const handleLoadSample = async () => {
    setError(null);
    const sample = await createSamplePdfFile("thesis-draft-4p.pdf", "Research Thesis Draft", 4);
    setFiles([sample]);
  };

  const handleStampNumbers = async () => {
    if (!activeFile) return;
    setError(null);
    setOutput(null);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const res = await addPageNumbersToPdfBuffer(bytes, {
        position,
        format,
        startNumber,
        fontSize,
        marginPoints,
      });
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to stamp page numbers.");
      } else {
        setOutput({ bytes: res.bytes, pageCount: res.pageCount ?? 1 });
      }
    } finally {
      setProcessing(false);
    }
  };

  const sampleLabelPreview = formatPageNumberLabel(startNumber, startNumber + 3, format);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Stamp clean, customizable page numbers onto every page of your PDF document.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 4-Page Sample PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to add page numbers"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          setOutput(null);
          setError(null);
        }}
      />

      {activeFile && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="pg-num-position"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Page Position
              </label>
              <select
                id="pg-num-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as PageNumberPosition)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pg-num-format"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Number Format
              </label>
              <select
                id="pg-num-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as PageNumberFormat)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="page-of-total">Page 1 of N</option>
                <option value="slash">1 / N</option>
                <option value="number-only">1</option>
                <option value="dash">— 1 —</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pg-num-start"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Starting Number
              </label>
              <input
                id="pg-num-start"
                type="number"
                min={1}
                max={9999}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="pg-num-fontsize"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Font Size ({fontSize} pt) & Margin ({marginPoints} pt)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="pg-num-fontsize"
                  type="number"
                  min={8}
                  max={28}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) || 11)}
                  className="w-1/2 rounded-xl border bg-card px-3 py-2.5 font-mono text-sm text-foreground"
                  aria-label="Font size in points"
                />
                <input
                  type="number"
                  min={14}
                  max={72}
                  value={marginPoints}
                  onChange={(e) => setMarginPoints(Number(e.target.value) || 28)}
                  className="w-1/2 rounded-xl border bg-card px-3 py-2.5 font-mono text-sm text-foreground"
                  aria-label="Margin in points"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Stamp preview:{" "}
              <strong className="font-mono text-foreground">{sampleLabelPreview}</strong> at{" "}
              <span className="font-semibold text-foreground">{position}</span>
            </span>

            <button
              type="button"
              disabled={processing}
              onClick={() => void handleStampNumbers()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adding Page Numbers...
                </>
              ) : (
                <>
                  <Hash className="h-4 w-4" aria-hidden /> Add Page Numbers to PDF
                </>
              )}
            </button>
          </div>
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
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Numbered PDF Ready ({output.pageCount} pages)
              </h3>
              <p className="text-xs text-muted-foreground">
                Stamped &ldquo;{sampleLabelPreview}&rdquo; at {position} •{" "}
                {formatBytes(output.bytes.byteLength)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadBlob(uint8ToBlob(output.bytes, "application/pdf"), "numbered-document.pdf")
            }
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Numbered PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. ADD WATERMARK TO PDF
// ============================================================================

function AddWatermarkToPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("CONFIDENTIAL — DO NOT DISTRIBUTE");
  const [fontSize, setFontSize] = useState(42);
  const [opacity, setOpacity] = useState(0.22);
  const [rotationDegrees, setRotationDegrees] = useState(-35);
  const [colorHex, setColorHex] = useState("#DC2626");
  const [placement, setPlacement] = useState<WatermarkPlacement>("center");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ bytes: Uint8Array; pageCount: number } | null>(null);

  const activeFile = files[0] ?? null;

  const handleLoadSample = async () => {
    setError(null);
    const sample = await createSamplePdfFile("investor-memo-3p.pdf", "Investor Memo", 3);
    setFiles([sample]);
  };

  const handleWatermark = async () => {
    if (!activeFile) return;
    setError(null);
    setOutput(null);
    setProcessing(true);
    try {
      const bytes = await readFileAsUint8Array(activeFile);
      const res = await addWatermarkToPdfBuffer(bytes, {
        text,
        fontSize,
        opacity,
        rotationDegrees,
        colorHex,
        placement,
      });
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to apply watermark.");
      } else {
        setOutput({ bytes: res.bytes, pageCount: res.pageCount ?? 1 });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Stamp custom diagonal or tiled watermarks onto every page of a PDF document.
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
        label="Drop a PDF file to watermark"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          setOutput(null);
          setError(null);
        }}
      />

      {activeFile && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="wm-text"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Watermark Text
              </label>
              <input
                id="wm-text"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="CONFIDENTIAL / DRAFT"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="wm-placement"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Placement Style
              </label>
              <select
                id="wm-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value as WatermarkPlacement)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="center">Single Centered Stamp</option>
                <option value="diagonal-tiled">Repeated Multi-Grid Tile (6× per page)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="wm-fontsize"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Font Size: {fontSize} pt
              </label>
              <input
                id="wm-fontsize"
                type="range"
                min={18}
                max={84}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="wm-opacity"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Opacity: {Math.round(opacity * 100)}%
              </label>
              <input
                id="wm-opacity"
                type="range"
                min={5}
                max={90}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="mt-3 w-full accent-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="wm-rotation"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Angle: {rotationDegrees}°
              </label>
              <input
                id="wm-rotation"
                type="range"
                min={-60}
                max={60}
                step={5}
                value={rotationDegrees}
                onChange={(e) => setRotationDegrees(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="wm-color"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Stamp Color
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="wm-color"
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border bg-card p-1"
                />
                <input
                  type="text"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  aria-label="Watermark hex color"
                  className="w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={processing || !text.trim()}
            onClick={() => void handleWatermark()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Applying Watermark...
              </>
            ) : (
              <>
                <Stamp className="h-4 w-4" aria-hidden /> Stamp Watermark on PDF
              </>
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

      {output && (
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
                Watermarked PDF Ready ({output.pageCount} pages)
              </h3>
              <p className="text-xs text-muted-foreground">
                Stamped &ldquo;{text}&rdquo; ({Math.round(opacity * 100)}% opacity,{" "}
                {rotationDegrees}°) • {formatBytes(output.bytes.byteLength)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadBlob(uint8ToBlob(output.bytes, "application/pdf"), "watermarked-document.pdf")
            }
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Watermarked PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. SIGN PDF (VISUAL SIGNATURE STAMP WITH EXPLICIT NON-PKI DISCLOSURE)
// ============================================================================

function SignPdfTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [sigMode, setSigMode] = useState<"draw" | "type">("type");
  const [typedSignature, setTypedSignature] = useState("Alex Morgan");
  const [signerName, setSignerName] = useState("Alex Morgan, Managing Partner");
  const [inkColor, setInkColor] = useState("#1d4ed8");
  const [pageTarget, setPageTarget] = useState<SignaturePageTarget>("last");
  const [customPage, setCustomPage] = useState(1);
  const [position, setPosition] = useState<SignaturePlacementPosition>("bottom-right");
  const [widthPoints, setWidthPoints] = useState(170);
  const [includeDateStamp, setIncludeDateStamp] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<{ bytes: Uint8Array; pageCount: number } | null>(null);

  const padCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = inkColor;
  }, [inkColor, sigMode]);

  const handleClearPad = () => {
    const canvas = padCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleLoadSample = async () => {
    setError(null);
    const sample = await createSamplePdfFile("nda-agreement-2p.pdf", "Mutual NDA Agreement", 2);
    setFiles([sample]);
  };

  const buildSignaturePngBytes = async (): Promise<Uint8Array> => {
    if (sigMode === "draw" && padCanvasRef.current) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        padCanvasRef.current?.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Could not export drawn signature"));
        }, "image/png");
      });
      return new Uint8Array(await blob.arrayBuffer());
    }

    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 150;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 122);
      ctx.lineTo(460, 122);
      ctx.stroke();

      ctx.fillStyle = inkColor;
      ctx.font = "italic bold 48px Georgia, serif";
      ctx.fillText(typedSignature.trim() || "Signed", 28, 96);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Could not render typed signature"));
      }, "image/png");
    });
    return new Uint8Array(await blob.arrayBuffer());
  };

  const handleSignPdf = async () => {
    if (!activeFile) return;
    if (sigMode === "type" && !typedSignature.trim()) {
      setError("Please enter your signature text before signing.");
      return;
    }

    setError(null);
    setOutput(null);
    setProcessing(true);
    try {
      const [pdfBytes, sigPngBytes] = await Promise.all([
        readFileAsUint8Array(activeFile),
        buildSignaturePngBytes(),
      ]);
      const res = await signPdfBuffer(pdfBytes, sigPngBytes, "image/png", {
        pageTarget,
        customPageNumber: customPage,
        position,
        widthPoints,
        signerName,
        includeDateStamp,
      });
      if (!res.ok || !res.bytes) {
        setError(res.error ?? "Failed to sign PDF.");
      } else {
        setOutput({ bytes: res.bytes, pageCount: res.pageCount ?? 1 });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs leading-relaxed text-foreground">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <strong className="font-bold">Visual Signature Stamp Disclosure:</strong> This utility
          embeds a visual electronic signature graphic and date caption directly onto your PDF pages
          locally in your browser. It does <strong>not</strong> apply a cryptographic X.509 / PKI
          digital certificate (PAdES).
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Type or draw your signature, choose target pages and placement, and stamp it onto your
          PDF.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample NDA PDF
        </button>
      </div>

      <FileDropzone
        label="Drop a PDF file to sign"
        description="Single .pdf file up to 50 MB."
        accept=".pdf,application/pdf"
        validation={{
          allowedExtensions: ["pdf"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          setOutput(null);
          setError(null);
        }}
      />

      {activeFile && (
        <div className="space-y-5 rounded-3xl border bg-muted/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border bg-card p-1">
              <button
                type="button"
                onClick={() => setSigMode("type")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  sigMode === "type"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Type className="h-3.5 w-3.5" aria-hidden /> Type Signature
              </button>
              <button
                type="button"
                onClick={() => setSigMode("draw")}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  sigMode === "draw"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PenTool className="h-3.5 w-3.5" aria-hidden /> Draw Signature Pad
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="sig-ink-color"
                className="text-xs font-semibold text-muted-foreground"
              >
                Ink Color:
              </label>
              <input
                id="sig-ink-color"
                type="color"
                value={inkColor}
                onChange={(e) => setInkColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border bg-card p-0.5"
              />
            </div>
          </div>

          {sigMode === "type" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="sig-typed-input"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Typed Signature Script
                </label>
                <input
                  id="sig-typed-input"
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="Alex Morgan"
                  className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-base font-semibold text-foreground"
                />
              </div>

              <div className="flex flex-col justify-center rounded-2xl border bg-white px-5 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Live Stamp Preview
                </span>
                <p
                  style={{ color: inkColor, fontFamily: "Georgia, serif" }}
                  className="mt-1 border-b border-current pb-1 text-2xl font-bold italic"
                >
                  {typedSignature || "Signature"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Draw your signature inside the pad below:
                </span>
                <button
                  type="button"
                  onClick={handleClearPad}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Eraser className="h-3.5 w-3.5" aria-hidden /> Clear Pad
                </button>
              </div>
              <canvas
                ref={padCanvasRef}
                width={520}
                height={150}
                onMouseDown={(e) => {
                  const canvas = padCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  isDrawingRef.current = true;
                  ctx.beginPath();
                  ctx.moveTo(
                    ((e.clientX - rect.left) / rect.width) * canvas.width,
                    ((e.clientY - rect.top) / rect.height) * canvas.height,
                  );
                }}
                onMouseMove={(e) => {
                  if (!isDrawingRef.current) return;
                  const canvas = padCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.strokeStyle = inkColor;
                  ctx.lineTo(
                    ((e.clientX - rect.left) / rect.width) * canvas.width,
                    ((e.clientY - rect.top) / rect.height) * canvas.height,
                  );
                  ctx.stroke();
                }}
                onMouseUp={() => {
                  isDrawingRef.current = false;
                }}
                onMouseLeave={() => {
                  isDrawingRef.current = false;
                }}
                className="h-36 w-full cursor-crosshair rounded-2xl border bg-white"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="sig-page-target"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Target Page(s)
              </label>
              <select
                id="sig-page-target"
                value={pageTarget}
                onChange={(e) => setPageTarget(e.target.value as SignaturePageTarget)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="last">Last Page Only</option>
                <option value="first">First Page Only</option>
                <option value="all">Every Page</option>
                <option value="custom">Specific Page Number</option>
              </select>
            </div>

            {pageTarget === "custom" && (
              <div>
                <label
                  htmlFor="sig-custom-page"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Page Number
                </label>
                <input
                  id="sig-custom-page"
                  type="number"
                  min={1}
                  value={customPage}
                  onChange={(e) => setCustomPage(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="sig-position"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Page Placement
              </label>
              <select
                id="sig-position"
                value={position}
                onChange={(e) => setPosition(e.target.value as SignaturePlacementPosition)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="center">Center of Page</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sig-signer-caption"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Signer Name / Title Caption
              </label>
              <input
                id="sig-signer-caption"
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Alex Morgan"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="sig-width"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Stamp Width: {widthPoints} pt
              </label>
              <input
                id="sig-width"
                type="range"
                min={90}
                max={280}
                step={10}
                value={widthPoints}
                onChange={(e) => setWidthPoints(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={includeDateStamp}
                onChange={(e) => setIncludeDateStamp(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              Include current ISO date stamp under signature
            </label>

            <button
              type="button"
              disabled={processing}
              onClick={() => void handleSignPdf()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing PDF...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4" aria-hidden /> Apply Signature & Download
                </>
              )}
            </button>
          </div>
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
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground">
                Signed PDF Ready ({output.pageCount} pages)
              </h3>
              <p className="text-xs text-muted-foreground">
                Visual signature stamped at {position} ({pageTarget} page) •{" "}
                {formatBytes(output.bytes.byteLength)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadBlob(uint8ToBlob(output.bytes, "application/pdf"), "signed-document.pdf")
            }
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Download className="h-4 w-4" aria-hidden /> Download Signed PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. COMPARE TWO PDFS
// ============================================================================

function ComparePdfsTool() {
  const [filesA, setFilesA] = useState<File[]>([]);
  const [filesB, setFilesB] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<PdfComparisonResult | null>(null);

  const fileA = filesA[0] ?? null;
  const fileB = filesB[0] ?? null;

  const handleLoadSamplePair = async () => {
    setError(null);
    setComparison(null);
    const { pdfA, pdfB } = await generateSampleComparisonPdfPair();
    const fA = new File([uint8ToBlob(pdfA, "application/pdf")], "service-agreement-v1.pdf", {
      type: "application/pdf",
    });
    const fB = new File([uint8ToBlob(pdfB, "application/pdf")], "service-agreement-v2.pdf", {
      type: "application/pdf",
    });
    setFilesA([fA]);
    setFilesB([fB]);

    const res = await comparePdfBuffers(pdfA, pdfB);
    setComparison(res);
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      setError("Please select both Original PDF (Document A) and Revised PDF (Document B).");
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const [bytesA, bytesB] = await Promise.all([
        readFileAsUint8Array(fileA),
        readFileAsUint8Array(fileB),
      ]);
      const res = await comparePdfBuffers(bytesA, bytesB);
      if (!res.ok) {
        setError(res.error ?? "Could not compare PDF documents.");
      } else {
        setComparison(res);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Compare two PDF versions page-by-page to inspect text additions, removals, and page
          geometry differences.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSamplePair()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample PDF Pair (v1 vs v2)
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FileDropzone
          label="Original PDF (Document A)"
          description="Drop baseline .pdf file here"
          accept=".pdf,application/pdf"
          validation={{ allowedExtensions: ["pdf"], maxSizeBytes: 50 * 1024 * 1024 }}
          files={filesA}
          onFilesChange={(next) => {
            setFilesA(next);
            setComparison(null);
          }}
        />
        <FileDropzone
          label="Revised PDF (Document B)"
          description="Drop updated .pdf file here"
          accept=".pdf,application/pdf"
          validation={{ allowedExtensions: ["pdf"], maxSizeBytes: 50 * 1024 * 1024 }}
          files={filesB}
          onFilesChange={(next) => {
            setFilesB(next);
            setComparison(null);
          }}
        />
      </div>

      {(fileA || fileB) && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!fileA || !fileB || processing}
            onClick={() => void handleCompare()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Comparing PDFs...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4" aria-hidden /> Compare PDFs Now
              </>
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

      {comparison && (
        <div className="space-y-5 rounded-3xl border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Content Similarity</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {comparison.similarityPercent}%
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Page Count (A vs B)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {comparison.pageCountA} vs {comparison.pageCountB}
              </p>
            </div>
            <div className="rounded-2xl border bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold text-emerald-700">Added Lines</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700">
                +{comparison.totalAddedLines}
              </p>
            </div>
            <div className="rounded-2xl border bg-rose-500/10 p-4">
              <p className="text-xs font-semibold text-rose-700">Removed Lines</p>
              <p className="mt-1 font-mono text-2xl font-bold text-rose-700">
                -{comparison.totalRemovedLines}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {comparison.pages.map((p) => (
              <div key={p.pageNumber} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">
                      Page {p.pageNumber}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        p.status === "identical"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-amber-500/20 text-amber-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.dimensionsA ?? "—"} → {p.dimensionsB ?? "—"}
                  </span>
                </div>

                {p.diffLines.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No extractable text stream differences found on this page.
                  </p>
                ) : (
                  <div className="mt-3 space-y-1 font-mono text-xs">
                    {p.diffLines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className={`rounded-lg px-3 py-1.5 ${
                          line.type === "added"
                            ? "bg-emerald-500/15 text-emerald-900 font-semibold"
                            : line.type === "removed"
                              ? "bg-rose-500/15 text-rose-900 line-through"
                              : "text-muted-foreground"
                        }`}
                      >
                        <span className="mr-2 select-none font-bold">
                          {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                        </span>
                        {line.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 7. COMPRESS IMAGES
// ============================================================================

interface CompressedImageItem {
  originalName: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  blob: Blob;
  bytes: Uint8Array;
}

function CompressImagesTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(75);
  const [outputFormat, setOutputFormat] = useState<"image/webp" | "image/jpeg">("image/webp");
  const [maxWidthCap, setMaxWidthCap] = useState<number>(0); // 0 = keep original dimensions
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompressedImageItem[]>([]);

  const handleLoadSample = async () => {
    setError(null);
    const sample = await createSampleGraphicFile("studio-photo-uncompressed.png", 1200, 800);
    setFiles([sample]);
  };

  const handleCompressAll = async () => {
    if (files.length === 0) return;
    setError(null);
    setProcessing(true);
    setResults([]);
    try {
      const items: CompressedImageItem[] = [];
      for (const file of files) {
        const decoded = await decodeImageFile(file);
        try {
          let targetW = decoded.width;
          let targetH = decoded.height;
          if (maxWidthCap > 0 && targetW > maxWidthCap) {
            const ratio = maxWidthCap / targetW;
            targetW = maxWidthCap;
            targetH = Math.max(1, Math.round(targetH * ratio));
          }

          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable.");

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(decoded.img, 0, 0, targetW, targetH);

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error("Compression failed"));
              },
              outputFormat,
              Math.max(0.05, Math.min(1, quality / 100)),
            );
          });

          const ext = outputFormat === "image/webp" ? "webp" : "jpg";
          const stem = file.name.replace(/\.[^.]+$/, "");
          const outputName = sanitizeFilename(`${stem}-compressed.${ext}`, `compressed.${ext}`);
          const bytes = new Uint8Array(await blob.arrayBuffer());

          items.push({
            originalName: file.name,
            outputName,
            originalSize: file.size,
            compressedSize: blob.size,
            width: targetW,
            height: targetH,
            blob,
            bytes,
          });
        } finally {
          URL.revokeObjectURL(decoded.url);
        }
      }
      setResults(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compress images.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Compress PNG, JPG, and WebP images in batches with adjustable lossy quality and dimension
          caps.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample High-Res PNG
        </button>
      </div>

      <FileDropzone
        label="Drop images to compress (PNG, JPG, WebP)"
        description="Supports multiple images up to 25 MB each."
        accept="image/png,image/jpeg,image/webp"
        multiple
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 25 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          setResults([]);
          setError(null);
        }}
      />

      {files.length > 0 && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="compress-img-quality"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Compression Quality: {quality}%
              </label>
              <input
                id="compress-img-quality"
                type="range"
                min={10}
                max={95}
                step={5}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-3 w-full accent-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="compress-img-format"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Output Codec
              </label>
              <select
                id="compress-img-format"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as "image/webp" | "image/jpeg")}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="image/webp">WebP (Smallest File Size)</option>
                <option value="image/jpeg">JPEG (Universal Compatibility)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="compress-max-width"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Max Width Cap (Optional)
              </label>
              <select
                id="compress-max-width"
                value={maxWidthCap}
                onChange={(e) => setMaxWidthCap(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value={0}>Keep Original Dimensions</option>
                <option value={1920}>Max 1920 px (Full HD)</option>
                <option value={1280}>Max 1280 px (Web Standard)</option>
                <option value={800}>Max 800 px (Email / Thumbnail)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleCompressAll()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {processing ? "Compressing Images..." : "Compress Images Now"}
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

      {results.length > 0 && (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-foreground">
              Compressed {results.length} {results.length === 1 ? "Image" : "Images"}
            </h3>
            {results.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const zip = buildZipArchive(
                    results.map((r) => ({ filename: r.outputName, bytes: r.bytes })),
                  );
                  downloadBlob(uint8ToBlob(zip, "application/zip"), "compressed-images.zip");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                <Archive className="h-3.5 w-3.5" aria-hidden /> Download All (.ZIP)
              </button>
            )}
          </div>

          <ul className="divide-y">
            {results.map((r, idx) => {
              const savedPct =
                r.originalSize > 0
                  ? Math.round(((r.originalSize - r.compressedSize) / r.originalSize) * 100)
                  : 0;
              return (
                <li
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.outputName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.width}×{r.height} px • {formatBytes(r.originalSize)} →{" "}
                      <strong className="text-foreground">{formatBytes(r.compressedSize)}</strong>{" "}
                      {savedPct > 0 && (
                        <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
                          −{savedPct}%
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBlob(r.blob, r.outputName)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden /> Download
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

// ============================================================================
// 8. CROP IMAGE
// ============================================================================

function CropImageTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [sourceDims, setSourceDims] = useState<{ width: number; height: number } | null>(null);
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>("16:9");
  const [cropX, setCropX] = useState(40);
  const [cropY, setCropY] = useState(40);
  const [cropW, setCropW] = useState(640);
  const [cropH, setCropH] = useState(360);
  const [outputFormat, setOutputFormat] = useState<"image/png" | "image/jpeg" | "image/webp">(
    "image/png",
  );
  const [croppedResult, setCroppedResult] = useState<{
    blob: Blob;
    previewUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setCroppedResult(null);
    setError(null);
    if (!activeFile) {
      setSourceDims(null);
      return;
    }

    decodeImageFile(activeFile)
      .then((d) => {
        URL.revokeObjectURL(d.url);
        if (!active) return;
        setSourceDims({ width: d.width, height: d.height });
        const box = computeCropBox(d.width, d.height, {
          x: 0,
          y: 0,
          width: Math.round(d.width * 0.8),
          height: Math.round(d.height * 0.8),
          aspectPreset,
        });
        setCropX(box.x);
        setCropY(box.y);
        setCropW(box.width);
        setCropH(box.height);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not decode image.");
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handlePresetChange = (preset: CropAspectPreset) => {
    setAspectPreset(preset);
    if (!sourceDims) return;
    const box = computeCropBox(sourceDims.width, sourceDims.height, {
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
      aspectPreset: preset,
    });
    setCropX(box.x);
    setCropY(box.y);
    setCropW(box.width);
    setCropH(box.height);
  };

  const handleLoadSample = async () => {
    const sample = await createSampleGraphicFile("banner-graphic.png", 960, 600);
    setFiles([sample]);
  };

  const handleCrop = async () => {
    if (!activeFile || !sourceDims) return;
    setError(null);
    try {
      const decoded = await decodeImageFile(activeFile);
      try {
        const box = computeCropBox(decoded.width, decoded.height, {
          x: cropX,
          y: cropY,
          width: cropW,
          height: cropH,
          aspectPreset,
        });
        setCropX(box.x);
        setCropY(box.y);
        setCropW(box.width);
        setCropH(box.height);

        const canvas = document.createElement("canvas");
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");

        ctx.drawImage(
          decoded.img,
          box.x,
          box.y,
          box.width,
          box.height,
          0,
          0,
          box.width,
          box.height,
        );

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("Crop export failed"));
            },
            outputFormat,
            0.92,
          );
        });

        if (croppedResult?.previewUrl) {
          URL.revokeObjectURL(croppedResult.previewUrl);
        }
        setCroppedResult({
          blob,
          previewUrl: URL.createObjectURL(blob),
          width: box.width,
          height: box.height,
        });
      } finally {
        URL.revokeObjectURL(decoded.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to crop image.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Crop images to exact pixel coordinates or standard aspect ratios (1:1, 16:9, 4:3, 3:2).
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample Image
        </button>
      </div>

      <FileDropzone
        label="Drop an image to crop (PNG, JPG, WebP)"
        description="Single image up to 25 MB."
        accept="image/png,image/jpeg,image/webp"
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 25 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && sourceDims && (
        <div className="space-y-4 rounded-3xl border bg-muted/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Original Image: {sourceDims.width} × {sourceDims.height} px
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(["free", "1:1", "16:9", "4:3", "3:2", "9:16"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    aspectPreset === preset
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {preset === "free" ? "Freeform" : preset}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="crop-x" className="block text-xs font-semibold text-muted-foreground">
                Offset X (px)
              </label>
              <input
                id="crop-x"
                type="number"
                min={0}
                max={sourceDims.width - 1}
                value={cropX}
                onChange={(e) => setCropX(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="crop-y" className="block text-xs font-semibold text-muted-foreground">
                Offset Y (px)
              </label>
              <input
                id="crop-y"
                type="number"
                min={0}
                max={sourceDims.height - 1}
                value={cropY}
                onChange={(e) => setCropY(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="crop-w" className="block text-xs font-semibold text-muted-foreground">
                Crop Width (px)
              </label>
              <input
                id="crop-w"
                type="number"
                min={1}
                max={sourceDims.width}
                value={cropW}
                onChange={(e) => setCropW(Number(e.target.value) || 100)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="crop-h" className="block text-xs font-semibold text-muted-foreground">
                Crop Height (px)
              </label>
              <input
                id="crop-h"
                type="number"
                min={1}
                max={sourceDims.height}
                value={cropH}
                onChange={(e) => setCropH(Number(e.target.value) || 100)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="crop-format"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Export Format
              </label>
              <select
                id="crop-format"
                value={outputFormat}
                onChange={(e) =>
                  setOutputFormat(e.target.value as "image/png" | "image/jpeg" | "image/webp")
                }
                className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-sm font-medium"
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleCrop()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Crop className="h-4 w-4" aria-hidden /> Crop Image Now
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

      {croppedResult && (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Cropped Image ({croppedResult.width} × {croppedResult.height} px)
              </h3>
              <p className="text-xs text-muted-foreground">
                Output size: {formatBytes(croppedResult.blob.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const ext =
                  outputFormat === "image/png"
                    ? "png"
                    : outputFormat === "image/jpeg"
                      ? "jpg"
                      : "webp";
                downloadBlob(
                  croppedResult.blob,
                  `cropped-${croppedResult.width}x${croppedResult.height}.${ext}`,
                );
              }}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background"
            >
              <Download className="h-4 w-4" aria-hidden /> Download Cropped Image
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-muted/20 p-4 text-center">
            <img
              src={croppedResult.previewUrl}
              alt="Cropped result preview"
              className="mx-auto max-h-72 rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 9. IMAGE DPI & DIMENSIONS CHECKER
// ============================================================================

function ImageDpiCheckerTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<ImageDpiMetadataReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setReport(null);
    setError(null);
    if (!activeFile) return;

    Promise.all([readFileAsUint8Array(activeFile), decodeImageFile(activeFile)])
      .then(([bytes, decoded]) => {
        URL.revokeObjectURL(decoded.url);
        if (!active) return;
        const info = inspectImageDpiAndMetadata(bytes, decoded.width, decoded.height);
        setReport(info);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to inspect image.");
      });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample300Dpi = async () => {
    const sample = await createSampleGraphicFile("print-ready-poster-300dpi.png", 1200, 900, 300);
    setFiles([sample]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Inspect binary PNG pHYs and JPEG JFIF DPI headers, pixel dimensions, aspect ratio, and
          physical print sizes.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample300Dpi()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample 300-DPI PNG
        </button>
      </div>

      <FileDropzone
        label="Drop an image to inspect DPI & dimensions"
        description="Supports PNG, JPG, and WebP files up to 50 MB."
        accept="image/png,image/jpeg,image/webp"
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 50 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
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

      {report && activeFile && (
        <div className="space-y-5 rounded-3xl border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Pixel Dimensions</p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {report.widthPx} × {report.heightPx} px
              </p>
            </div>

            <div className="rounded-2xl border bg-primary/25 p-4">
              <p className="text-xs font-semibold text-foreground">Embedded Header DPI</p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {report.embeddedDpiX ? `${report.embeddedDpiX} DPI` : "Unset (72 DPI default)"}
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Aspect Ratio & MP</p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {report.aspectRatioLabel} ({report.megapixels} MP)
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Container & File Size</p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">
                {report.detectedFormat} • {formatBytes(activeFile.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
            <span>
              <strong>Header Metadata Source:</strong> {report.dpiSource}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Print Density Standard</th>
                  <th className="px-4 py-3">Physical Size (Inches)</th>
                  <th className="px-4 py-3">Physical Size (Centimeters)</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-xs">
                {report.printSizes.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 font-sans font-semibold text-foreground">
                      {row.label}
                    </td>
                    <td className="px-4 py-3">
                      {row.widthInches}&quot; × {row.heightInches}&quot;
                    </td>
                    <td className="px-4 py-3">
                      {row.widthCm} cm × {row.heightCm} cm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 10. IMAGE TO BASE64
// ============================================================================

function ImageToBase64Tool() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputMode, setOutputMode] = useState<
    "dataUrl" | "rawBase64" | "htmlImgTag" | "cssBackground"
  >("dataUrl");
  const [copied, setCopied] = useState(false);
  const [snippets, setSnippets] = useState<ReturnType<
    typeof encodeImageBytesToBase64Snippets
  > | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    if (!activeFile) {
      setSnippets(null);
      return;
    }
    readFileAsUint8Array(activeFile).then((bytes) => {
      if (!active) return;
      setSnippets(
        encodeImageBytesToBase64Snippets(bytes, activeFile.type || "image/png", activeFile.name),
      );
    });
    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSampleGraphicFile("badge-icon.png", 320, 200);
    setFiles([sample]);
  };

  const activeText = snippets ? snippets[outputMode] : "";

  const handleCopy = async () => {
    if (!activeText) return;
    await navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Encode PNG, JPG, WebP, or SVG images into Base64 Data URLs, HTML &lt;img&gt; tags, or CSS
          backgrounds.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample Image
        </button>
      </div>

      <FileDropzone
        label="Drop an image to encode as Base64"
        description="Supports PNG, JPG, WebP, GIF, and SVG up to 10 MB."
        accept="image/*"
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
          maxSizeBytes: 10 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {snippets && (
        <div className="space-y-4 rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "dataUrl", label: "Data URL (data:image/...)" },
                  { id: "rawBase64", label: "Raw Base64" },
                  { id: "htmlImgTag", label: "HTML <img> Tag" },
                  { id: "cssBackground", label: "CSS background-image" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOutputMode(tab.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    outputMode === tab.id
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "bg-muted/40 text-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Snippet"}
            </button>
          </div>

          <p className="font-mono text-xs text-muted-foreground">
            Original file: {formatBytes(snippets.originalBytes)} • Base64 length:{" "}
            {snippets.base64Length.toLocaleString()} chars
          </p>

          <textarea
            readOnly
            aria-label="Base64 encoded output"
            value={activeText}
            rows={7}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs text-foreground outline-none"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 11. EXTRACT COLORS FROM IMAGE
// ============================================================================

function ExtractImageColorsTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [swatches, setSwatches] = useState<ExtractedColorSwatch[]>([]);
  const [pickedColor, setPickedColor] = useState<{ hex: string; rgb: string; hsl: string } | null>(
    null,
  );
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeFile = files[0] ?? null;

  useEffect(() => {
    let active = true;
    setSwatches([]);
    setPickedColor(null);
    if (!activeFile) return;

    decodeImageFile(activeFile).then((decoded) => {
      try {
        if (!active) return;
        const canvas = previewCanvasRef.current ?? document.createElement("canvas");
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(decoded.width, decoded.height));
        const w = Math.max(1, Math.round(decoded.width * scale));
        const h = Math.max(1, Math.round(decoded.height * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(decoded.img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const extracted = extractDominantColorsFromRgba(imgData.data, 8);
        setSwatches(extracted);
        if (extracted[0]) {
          setPickedColor({
            hex: extracted[0].hex,
            rgb: extracted[0].rgb,
            hsl: extracted[0].hsl,
          });
        }
      } finally {
        URL.revokeObjectURL(decoded.url);
      }
    });

    return () => {
      active = false;
    };
  }, [activeFile]);

  const handleLoadSample = async () => {
    const sample = await createSampleGraphicFile("brand-palette-sample.png", 800, 500);
    setFiles([sample]);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(canvas.width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width)),
    );
    const y = Math.max(
      0,
      Math.min(
        canvas.height - 1,
        Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height),
      ),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0] ?? 0;
    const g = pixel[1] ?? 0;
    const b = pixel[2] ?? 0;
    setPickedColor({
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: rgbToHslString(r, g, b),
    });
  };

  const copyColor = async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedHex(val);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Extract the dominant color palette from any image or click anywhere on the canvas to
          sample exact pixel HEX, RGB, and HSL values.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSample()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Multi-Color Sample Image
        </button>
      </div>

      <FileDropzone
        label="Drop an image to extract colors"
        description="Supports PNG, JPG, and WebP images."
        accept="image/png,image/jpeg,image/webp"
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp"],
          maxSizeBytes: 25 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {activeFile && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-3 rounded-3xl border bg-card p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Pipette className="h-3.5 w-3.5" aria-hidden /> Click Canvas to Eyedrop Pixel
              </span>
            </div>
            <canvas
              ref={previewCanvasRef}
              onClick={handleCanvasClick}
              className="mx-auto max-h-64 w-full cursor-crosshair rounded-2xl border object-contain"
            />
            {pickedColor && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <span
                    style={{ backgroundColor: pickedColor.hex }}
                    className="h-10 w-10 rounded-xl border shadow-sm"
                  />
                  <div className="font-mono text-xs">
                    <p className="font-bold text-foreground">{pickedColor.hex}</p>
                    <p className="text-muted-foreground">
                      {pickedColor.rgb} • {pickedColor.hsl}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyColor(pickedColor.hex)}
                  className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                >
                  {copiedHex === pickedColor.hex ? "Copied!" : "Copy HEX"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border bg-card p-6 lg:col-span-7">
            <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Palette className="h-4 w-4" aria-hidden /> Dominant Color Palette ({swatches.length}{" "}
              Swatches)
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              {swatches.map((s) => (
                <div
                  key={s.hex}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{ backgroundColor: s.hex }}
                      className="h-12 w-12 shrink-0 rounded-xl border shadow-sm"
                    />
                    <div className="font-mono text-xs">
                      <p className="font-bold text-foreground">
                        {s.hex}{" "}
                        <span className="font-normal text-muted-foreground">({s.percentage}%)</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{s.rgb}</p>
                      <p className="text-[11px] text-muted-foreground">{s.hsl}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyColor(s.hex)}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    {copiedHex === s.hex ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 12. BULK IMAGE RENAMER
// ============================================================================

function BulkImageRenamerTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [pattern, setPattern] = useState("product-{index}-{name}");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [startIndex, setStartIndex] = useState(1);
  const [padDigits, setPadDigits] = useState(2);
  const [caseStyle, setCaseStyle] = useState<RenameCaseStyle>("kebab");
  const [downloading, setDownloading] = useState(false);

  const handleLoadSampleBatch = async () => {
    const f1 = await createSampleGraphicFile("DSC_0042 Hero Banner.png", 400, 300);
    const f2 = await createSampleGraphicFile("IMG_9821 Feature Overview.png", 400, 300);
    const f3 = await createSampleGraphicFile("Screenshot 2026 Pricing Table.png", 400, 300);
    setFiles([f1, f2, f3]);
  };

  const renamePairs = generateBulkRenamedFilenames(
    files.map((f) => f.name),
    {
      pattern,
      prefix,
      suffix,
      startIndex,
      padDigits,
      dateStamp: new Date().toISOString().slice(0, 10),
      caseStyle,
    },
  );

  const handleDownloadZip = async () => {
    if (files.length === 0) return;
    setDownloading(true);
    try {
      const entries = await Promise.all(
        files.map(async (f, i) => ({
          filename: renamePairs[i]?.newName ?? f.name,
          bytes: await readFileAsUint8Array(f),
        })),
      );
      const zipBytes = buildZipArchive(entries);
      downloadBlob(uint8ToBlob(zipBytes, "application/zip"), "renamed-images-batch.zip");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Batch-rename multiple image files using custom patterns ({"{name}"}, {"{index}"},{" "}
          {"{date}"}) and download them as a .ZIP archive.
        </p>
        <button
          type="button"
          onClick={() => void handleLoadSampleBatch()}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load 3 Sample Images
        </button>
      </div>

      <FileDropzone
        label="Drop multiple images to batch rename"
        description="Supports PNG, JPG, WebP, GIF, and SVG files."
        accept="image/*"
        multiple
        allowReorder
        validation={{
          allowedExtensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
          maxSizeBytes: 25 * 1024 * 1024,
        }}
        files={files}
        onFilesChange={setFiles}
      />

      {files.length > 0 && (
        <div className="space-y-5 rounded-3xl border bg-muted/40 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="rename-pattern"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Filename Pattern (use {"{name}"}, {"{index}"}, {"{date}"})
              </label>
              <input
                id="rename-pattern"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="product-{index}-{name}"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 font-mono text-sm text-foreground"
              />
            </div>

            <div>
              <label
                htmlFor="rename-start-idx"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Start Number & Zero Padding
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="rename-start-idx"
                  type="number"
                  min={0}
                  value={startIndex}
                  onChange={(e) => setStartIndex(Number(e.target.value) || 0)}
                  className="w-1/2 rounded-xl border bg-card px-3 py-2.5 font-mono text-sm"
                  aria-label="Start number"
                />
                <select
                  value={padDigits}
                  onChange={(e) => setPadDigits(Number(e.target.value))}
                  aria-label="Zero padding digits"
                  className="w-1/2 rounded-xl border bg-card px-2.5 py-2.5 font-mono text-sm"
                >
                  <option value={1}>1 (1, 2)</option>
                  <option value={2}>2 (01, 02)</option>
                  <option value={3}>3 (001)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="rename-case"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Casing & Separator Rule
              </label>
              <select
                id="rename-case"
                value={caseStyle}
                onChange={(e) => setCaseStyle(e.target.value as RenameCaseStyle)}
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="kebab">kebab-case (SEO friendly)</option>
                <option value="snake">snake_case</option>
                <option value="lower">lowercase</option>
                <option value="preserve">Preserve Original Case</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="rename-prefix"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Optional Prefix
              </label>
              <input
                id="rename-prefix"
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. studio-"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="rename-suffix"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Optional Suffix
              </label>
              <input
                id="rename-suffix"
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. -2x"
                className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Original Filename</th>
                  <th className="px-4 py-3">New Filename Preview</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-xs">
                {renamePairs.map((pair, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pair.originalName}</td>
                    <td className="px-4 py-3 font-bold text-foreground">{pair.newName}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const f = files[idx];
                          if (f) downloadBlob(f, pair.newName);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 font-sans text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        <Download className="h-3 w-3" aria-hidden /> Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownloadZip()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            >
              <Archive className="h-4 w-4" aria-hidden />
              {downloading
                ? "Building .ZIP Archive..."
                : `Download All ${files.length} Renamed Images (.ZIP)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN RELEASE 2 DISPATCHER
// ============================================================================

export function Release2ToolWorkspace({ toolSlug }: { toolSlug: Release2ToolSlug }) {
  switch (toolSlug) {
    case "pdf-to-jpg":
      return <PdfToJpgTool />;
    case "extract-pdf-pages":
      return <ExtractPdfPagesTool />;
    case "add-page-numbers-to-pdf":
      return <AddPageNumbersToPdfTool />;
    case "add-watermark-to-pdf":
      return <AddWatermarkToPdfTool />;
    case "sign-pdf":
      return <SignPdfTool />;
    case "compare-pdfs":
      return <ComparePdfsTool />;
    case "compress-images":
      return <CompressImagesTool />;
    case "crop-image":
      return <CropImageTool />;
    case "image-dpi-checker":
      return <ImageDpiCheckerTool />;
    case "image-to-base64":
      return <ImageToBase64Tool />;
    case "extract-image-colors":
      return <ExtractImageColorsTool />;
    case "bulk-image-renamer":
      return <BulkImageRenamerTool />;
  }
}
