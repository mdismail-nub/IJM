import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { parsePageRanges } from "./file-tools";

export const RELEASE2_TOOL_SLUGS = [
  "pdf-to-jpg",
  "extract-pdf-pages",
  "add-page-numbers-to-pdf",
  "add-watermark-to-pdf",
  "sign-pdf",
  "compare-pdfs",
  "compress-images",
  "crop-image",
  "image-dpi-checker",
  "image-to-base64",
  "extract-image-colors",
  "bulk-image-renamer",
] as const;

export type Release2ToolSlug = (typeof RELEASE2_TOOL_SLUGS)[number];

export function isRelease2ToolSlug(slug: string): slug is Release2ToolSlug {
  return (RELEASE2_TOOL_SLUGS as readonly string[]).includes(slug);
}

// ============================================================================
// 1. EXTRACT PDF PAGES
// ============================================================================

export interface ExtractPdfPagesResult {
  ok: boolean;
  bytes?: Uint8Array;
  extractedCount?: number;
  totalPages?: number;
  selectedPages?: number[];
  error?: string;
}

export async function extractPdfPagesBuffer(
  buffer: Uint8Array,
  rangeInput: string,
): Promise<ExtractPdfPagesResult> {
  try {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    if (totalPages === 0) {
      return { ok: false, error: "The PDF contains 0 pages." };
    }

    const parsed = parsePageRanges(rangeInput, totalPages);
    if (!parsed.ok || parsed.flatPages.length === 0) {
      return { ok: false, error: parsed.error ?? "Invalid page range." };
    }

    const outDoc = await PDFDocument.create();
    const zeroBasedIndices = parsed.flatPages.map((p) => p - 1);
    const copied = await outDoc.copyPages(srcDoc, zeroBasedIndices);
    for (const page of copied) {
      outDoc.addPage(page);
    }

    const outBytes = await outDoc.save();
    return {
      ok: true,
      bytes: outBytes,
      extractedCount: copied.length,
      totalPages,
      selectedPages: parsed.flatPages,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to extract PDF pages.",
    };
  }
}

// ============================================================================
// 2. ADD PAGE NUMBERS TO PDF
// ============================================================================

export type PageNumberPosition =
  "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export type PageNumberFormat = "page-of-total" | "slash" | "number-only" | "dash";

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: PageNumberFormat;
  startNumber: number;
  fontSize: number;
  marginPoints: number;
}

export function formatPageNumberLabel(
  displayNumber: number,
  displayTotal: number,
  format: PageNumberFormat,
): string {
  switch (format) {
    case "page-of-total":
      return `Page ${displayNumber} of ${displayTotal}`;
    case "slash":
      return `${displayNumber} / ${displayTotal}`;
    case "dash":
      return `— ${displayNumber} —`;
    case "number-only":
    default:
      return `${displayNumber}`;
  }
}

export interface StampPdfResult {
  ok: boolean;
  bytes?: Uint8Array;
  pageCount?: number;
  error?: string;
}

export async function addPageNumbersToPdfBuffer(
  buffer: Uint8Array,
  options: PageNumberOptions,
): Promise<StampPdfResult> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = doc.getPages();
    if (pages.length === 0) {
      return { ok: false, error: "PDF has no pages to number." };
    }

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = Math.max(8, Math.min(36, options.fontSize || 11));
    const margin = Math.max(12, Math.min(100, options.marginPoints || 28));
    const startNumber = Number.isFinite(options.startNumber)
      ? Math.max(1, Math.floor(options.startNumber))
      : 1;
    const displayTotal = startNumber + pages.length - 1;

    pages.forEach((page, idx) => {
      const { width, height } = page.getSize();
      const label = formatPageNumberLabel(startNumber + idx, displayTotal, options.format);
      const textWidth = font.widthOfTextAtSize(label, fontSize);

      let x = (width - textWidth) / 2;
      if (options.position.endsWith("left")) {
        x = margin;
      } else if (options.position.endsWith("right")) {
        x = Math.max(margin, width - textWidth - margin);
      }

      const y = options.position.startsWith("top")
        ? Math.max(margin, height - margin - fontSize)
        : margin;

      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.18),
      });
    });

    const outBytes = await doc.save();
    return {
      ok: true,
      bytes: outBytes,
      pageCount: pages.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add page numbers to PDF.",
    };
  }
}

// ============================================================================
// 3. ADD WATERMARK TO PDF
// ============================================================================

export type WatermarkPlacement = "center" | "diagonal-tiled";

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number;
  rotationDegrees: number;
  colorHex: string;
  placement: WatermarkPlacement;
}

export function parseHexColorToRgb01(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return { r, g, b };
  }
  return { r: 0.15, g: 0.15, b: 0.18 };
}

export async function addWatermarkToPdfBuffer(
  buffer: Uint8Array,
  options: WatermarkOptions,
): Promise<StampPdfResult> {
  const text = options.text.trim();
  if (!text) {
    return { ok: false, error: "Watermark text cannot be empty." };
  }

  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = doc.getPages();
    if (pages.length === 0) {
      return { ok: false, error: "PDF has no pages to watermark." };
    }

    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontSize = Math.max(12, Math.min(120, options.fontSize || 48));
    const opacity = Math.max(0.05, Math.min(1, options.opacity ?? 0.22));
    const angle = Number.isFinite(options.rotationDegrees) ? options.rotationDegrees : -45;
    const { r, g, b } = parseHexColorToRgb01(options.colorHex || "#dc2626");

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);

      if (options.placement === "diagonal-tiled") {
        const tileSize = Math.max(fontSize * 0.65, 22);
        const tileWidth = font.widthOfTextAtSize(text, tileSize);
        const rows = [height * 0.2, height * 0.5, height * 0.8];
        const cols = [width * 0.22, width * 0.62];
        for (const y of rows) {
          for (const x of cols) {
            page.drawText(text, {
              x: Math.max(24, x - tileWidth / 3),
              y,
              size: tileSize,
              font,
              color: rgb(r, g, b),
              opacity,
              rotate: degrees(angle),
            });
          }
        }
      } else {
        const rad = (angle * Math.PI) / 180;
        const dx = (textWidth / 2) * Math.cos(rad);
        const dy = (textWidth / 2) * Math.sin(rad);
        page.drawText(text, {
          x: width / 2 - dx,
          y: height / 2 - dy,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(angle),
        });
      }
    }

    const outBytes = await doc.save();
    return {
      ok: true,
      bytes: outBytes,
      pageCount: pages.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to apply watermark to PDF.",
    };
  }
}

// ============================================================================
// 4. SIGN PDF (VISUAL SIGNATURE STAMP)
// ============================================================================

export type SignaturePlacementPosition =
  "bottom-right" | "bottom-left" | "bottom-center" | "center";

export type SignaturePageTarget = "last" | "first" | "all" | "custom";

export interface SignPdfOptions {
  pageTarget: SignaturePageTarget;
  customPageNumber?: number;
  position: SignaturePlacementPosition;
  widthPoints: number;
  signerName?: string;
  includeDateStamp?: boolean;
  dateText?: string;
}

export async function signPdfBuffer(
  buffer: Uint8Array,
  signatureBytes: Uint8Array,
  signatureMime: "image/png" | "image/jpeg",
  options: SignPdfOptions,
): Promise<StampPdfResult> {
  if (!signatureBytes || signatureBytes.byteLength === 0) {
    return { ok: false, error: "Signature image is empty." };
  }

  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = doc.getPages();
    if (pages.length === 0) {
      return { ok: false, error: "PDF has no pages to sign." };
    }

    const embeddedImg =
      signatureMime === "image/jpeg"
        ? await doc.embedJpg(signatureBytes)
        : await doc.embedPng(signatureBytes);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const targetIndices: number[] = [];

    if (options.pageTarget === "first") {
      targetIndices.push(0);
    } else if (options.pageTarget === "all") {
      pages.forEach((_, idx) => targetIndices.push(idx));
    } else if (options.pageTarget === "custom") {
      const pNum = options.customPageNumber ?? 1;
      if (pNum < 1 || pNum > pages.length) {
        return {
          ok: false,
          error: `Custom page number ${pNum} is out of bounds (PDF has ${pages.length} pages).`,
        };
      }
      targetIndices.push(pNum - 1);
    } else {
      targetIndices.push(pages.length - 1);
    }

    const desiredWidth = Math.max(60, Math.min(360, options.widthPoints || 160));
    const aspect = embeddedImg.width > 0 ? embeddedImg.height / embeddedImg.width : 0.4;
    const drawWidth = desiredWidth;
    const drawHeight = Math.max(24, Math.round(drawWidth * aspect));
    const margin = 36;

    const captionParts: string[] = [];
    if (options.signerName?.trim()) {
      captionParts.push(`Signed by ${options.signerName.trim()}`);
    }
    if (options.includeDateStamp) {
      const dateStr = options.dateText?.trim() || new Date().toISOString().slice(0, 10);
      captionParts.push(`Date: ${dateStr}`);
    }
    const captionText = captionParts.join(" • ");

    for (const idx of targetIndices) {
      const page = pages[idx];
      if (!page) continue;
      const { width, height } = page.getSize();

      let x = width - drawWidth - margin;
      let y = margin + (captionText ? 16 : 0);

      if (options.position === "bottom-left") {
        x = margin;
      } else if (options.position === "bottom-center") {
        x = (width - drawWidth) / 2;
      } else if (options.position === "center") {
        x = (width - drawWidth) / 2;
        y = (height - drawHeight) / 2;
      }

      page.drawImage(embeddedImg, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });

      if (captionText) {
        page.drawText(captionText, {
          x,
          y: Math.max(14, y - 13),
          size: 8.5,
          font,
          color: rgb(0.25, 0.25, 0.28),
        });
      }
    }

    const outBytes = await doc.save();
    return {
      ok: true,
      bytes: outBytes,
      pageCount: pages.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to apply signature to PDF.",
    };
  }
}

// ============================================================================
// 5. PDF TEXT EXTRACTION & COMPARE TWO PDFS
// ============================================================================

export interface ExtractedPdfPage {
  pageNumber: number;
  width: number;
  height: number;
  lines: string[];
}

export interface ExtractedPdfDocument {
  ok: boolean;
  pageCount: number;
  pages: ExtractedPdfPage[];
  error?: string;
}

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function decodePdfHexString(hex: string): string {
  const cleaned = hex.replace(/\s+/g, "");
  if (cleaned.length === 0) return "";
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const pair = cleaned.slice(i, i + 2).padEnd(2, "0");
    const code = parseInt(pair, 16);
    if (!Number.isNaN(code)) bytes.push(code);
  }
  // Check UTF-16BE BOM or high-byte zeros
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
      if (code >= 32) out += String.fromCharCode(code);
    }
    return out;
  }
  return bytes
    .filter((b) => b >= 32 && b <= 126)
    .map((b) => String.fromCharCode(b))
    .join("");
}

function extractTextLinesFromContentStream(streamAscii: string): string[] {
  const lines: string[] = [];
  const btBlocks = streamAscii.match(/BT[\s\S]*?ET/g) ?? [streamAscii];

  for (const block of btBlocks) {
    const pieces: string[] = [];
    // Match (literal) Tj, [(array)] TJ, or <hex> Tj
    const tokenRegex = /\((?:\\.|[^\\()])*\)\s*Tj|\[([\s\S]*?)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let match: RegExpExecArray | null = tokenRegex.exec(block);
    while (match !== null) {
      const full = match[0];
      if (full.endsWith("Tj") && full.startsWith("(")) {
        const inner = full.replace(/\)\s*Tj$/, "").slice(1);
        const decoded = decodePdfLiteralString(inner).trim();
        if (decoded) pieces.push(decoded);
      } else if (match[1] !== undefined) {
        const arrContent = match[1];
        const subLiterals = arrContent.match(/\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f\s]+)>/g) ?? [];
        let combined = "";
        for (const sub of subLiterals) {
          if (sub.startsWith("(")) {
            combined += decodePdfLiteralString(sub.slice(1, -1));
          } else if (sub.startsWith("<")) {
            combined += decodePdfHexString(sub.slice(1, -1));
          }
        }
        if (combined.trim()) pieces.push(combined.trim());
      } else if (match[2] !== undefined) {
        const decoded = decodePdfHexString(match[2]).trim();
        if (decoded) pieces.push(decoded);
      }
      match = tokenRegex.exec(block);
    }

    if (pieces.length > 0) {
      for (const p of pieces) {
        for (const subLine of p.split(/\r?\n/)) {
          const trimmed = subLine.trim();
          if (trimmed) lines.push(trimmed);
        }
      }
    }
  }

  return lines;
}

export async function extractPdfPageDetails(buffer: Uint8Array): Promise<ExtractedPdfDocument> {
  try {
    const doc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const pdfPages = doc.getPages();
    const decoder = new TextDecoder("latin1");

    const pages: ExtractedPdfPage[] = pdfPages.map((p, idx) => {
      const { width, height } = p.getSize();
      const contentsEntry = p.node.Contents();
      const rawStreams: PDFRawStream[] = [];

      if (contentsEntry instanceof PDFRawStream) {
        rawStreams.push(contentsEntry);
      } else if (contentsEntry instanceof PDFArray) {
        for (let i = 0; i < contentsEntry.size(); i++) {
          const lookedUp = doc.context.lookup(contentsEntry.get(i));
          if (lookedUp instanceof PDFRawStream) {
            rawStreams.push(lookedUp);
          }
        }
      } else if (contentsEntry) {
        const lookedUp = doc.context.lookup(contentsEntry);
        if (lookedUp instanceof PDFRawStream) {
          rawStreams.push(lookedUp);
        } else if (lookedUp instanceof PDFArray) {
          for (let i = 0; i < lookedUp.size(); i++) {
            const sub = doc.context.lookup(lookedUp.get(i));
            if (sub instanceof PDFRawStream) {
              rawStreams.push(sub);
            }
          }
        }
      }

      let combinedStreamText = "";
      for (const rs of rawStreams) {
        try {
          const decodedBytes = decodePDFRawStream(rs).decode();
          combinedStreamText += `${decoder.decode(decodedBytes)}\n`;
        } catch {
          combinedStreamText += `${decoder.decode(rs.contents)}\n`;
        }
      }

      const extractedLines = combinedStreamText
        ? extractTextLinesFromContentStream(combinedStreamText)
        : [];

      return {
        pageNumber: idx + 1,
        width: Math.round(width),
        height: Math.round(height),
        lines: extractedLines,
      };
    });

    return {
      ok: true,
      pageCount: pdfPages.length,
      pages,
    };
  } catch (err) {
    return {
      ok: false,
      pageCount: 0,
      pages: [],
      error: err instanceof Error ? err.message : "Failed to inspect PDF document.",
    };
  }
}

export interface PageDiffLine {
  type: "same" | "added" | "removed";
  text: string;
}

export interface PageComparisonItem {
  pageNumber: number;
  status: "identical" | "modified" | "added-page" | "removed-page";
  dimensionsA?: string;
  dimensionsB?: string;
  dimensionsMatch: boolean;
  addedCount: number;
  removedCount: number;
  diffLines: PageDiffLine[];
}

export interface PdfComparisonResult {
  ok: boolean;
  pageCountA: number;
  pageCountB: number;
  identicalPagesCount: number;
  modifiedPagesCount: number;
  totalAddedLines: number;
  totalRemovedLines: number;
  similarityPercent: number;
  pages: PageComparisonItem[];
  error?: string;
}

export function diffLineArrays(linesA: string[], linesB: string[]): PageDiffLine[] {
  const result: PageDiffLine[] = [];
  const maxLen = Math.max(linesA.length, linesB.length);
  let i = 0;
  let j = 0;

  while (i < linesA.length || j < linesB.length) {
    const a = linesA[i];
    const b = linesB[j];
    if (a !== undefined && b !== undefined && a === b) {
      result.push({ type: "same", text: a });
      i++;
      j++;
    } else if (b !== undefined && linesA.slice(i + 1, i + 4).includes(b)) {
      result.push({ type: "removed", text: a ?? "" });
      i++;
    } else if (a !== undefined && linesB.slice(j + 1, j + 4).includes(a)) {
      result.push({ type: "added", text: b ?? "" });
      j++;
    } else {
      if (a !== undefined) {
        result.push({ type: "removed", text: a });
        i++;
      }
      if (b !== undefined) {
        result.push({ type: "added", text: b });
        j++;
      }
    }
    if (result.length > maxLen * 3 + 50) break;
  }

  return result;
}

export async function comparePdfBuffers(
  bufferA: Uint8Array,
  bufferB: Uint8Array,
): Promise<PdfComparisonResult> {
  const [docA, docB] = await Promise.all([
    extractPdfPageDetails(bufferA),
    extractPdfPageDetails(bufferB),
  ]);

  if (!docA.ok) {
    return {
      ok: false,
      pageCountA: 0,
      pageCountB: 0,
      identicalPagesCount: 0,
      modifiedPagesCount: 0,
      totalAddedLines: 0,
      totalRemovedLines: 0,
      similarityPercent: 0,
      pages: [],
      error: `First PDF error: ${docA.error ?? "Invalid PDF"}`,
    };
  }
  if (!docB.ok) {
    return {
      ok: false,
      pageCountA: 0,
      pageCountB: 0,
      identicalPagesCount: 0,
      modifiedPagesCount: 0,
      totalAddedLines: 0,
      totalRemovedLines: 0,
      similarityPercent: 0,
      pages: [],
      error: `Second PDF error: ${docB.error ?? "Invalid PDF"}`,
    };
  }

  const maxPages = Math.max(docA.pageCount, docB.pageCount);
  const pages: PageComparisonItem[] = [];
  let identicalPagesCount = 0;
  let modifiedPagesCount = 0;
  let totalAddedLines = 0;
  let totalRemovedLines = 0;
  let totalSameLines = 0;

  for (let idx = 0; idx < maxPages; idx++) {
    const pA = docA.pages[idx];
    const pB = docB.pages[idx];
    const pageNumber = idx + 1;

    if (pA && !pB) {
      const diffLines: PageDiffLine[] = pA.lines.map((t) => ({ type: "removed", text: t }));
      totalRemovedLines += pA.lines.length;
      modifiedPagesCount++;
      pages.push({
        pageNumber,
        status: "removed-page",
        dimensionsA: `${pA.width}×${pA.height} pt`,
        dimensionsMatch: false,
        addedCount: 0,
        removedCount: pA.lines.length,
        diffLines,
      });
    } else if (!pA && pB) {
      const diffLines: PageDiffLine[] = pB.lines.map((t) => ({ type: "added", text: t }));
      totalAddedLines += pB.lines.length;
      modifiedPagesCount++;
      pages.push({
        pageNumber,
        status: "added-page",
        dimensionsB: `${pB.width}×${pB.height} pt`,
        dimensionsMatch: false,
        addedCount: pB.lines.length,
        removedCount: 0,
        diffLines,
      });
    } else if (pA && pB) {
      const dimensionsA = `${pA.width}×${pA.height} pt`;
      const dimensionsB = `${pB.width}×${pB.height} pt`;
      const dimensionsMatch = dimensionsA === dimensionsB;
      const diffLines = diffLineArrays(pA.lines, pB.lines);
      const addedCount = diffLines.filter((d) => d.type === "added").length;
      const removedCount = diffLines.filter((d) => d.type === "removed").length;
      const sameCount = diffLines.filter((d) => d.type === "same").length;

      totalAddedLines += addedCount;
      totalRemovedLines += removedCount;
      totalSameLines += sameCount;

      const isIdentical = dimensionsMatch && addedCount === 0 && removedCount === 0;
      if (isIdentical) {
        identicalPagesCount++;
      } else {
        modifiedPagesCount++;
      }

      pages.push({
        pageNumber,
        status: isIdentical ? "identical" : "modified",
        dimensionsA,
        dimensionsB,
        dimensionsMatch,
        addedCount,
        removedCount,
        diffLines,
      });
    }
  }

  const totalLineOperations = totalSameLines * 2 + totalAddedLines + totalRemovedLines;
  const similarityPercent =
    totalLineOperations > 0
      ? Math.round(((totalSameLines * 2) / totalLineOperations) * 100)
      : docA.pageCount === docB.pageCount
        ? 100
        : Math.round((Math.min(docA.pageCount, docB.pageCount) / maxPages) * 100);

  return {
    ok: true,
    pageCountA: docA.pageCount,
    pageCountB: docB.pageCount,
    identicalPagesCount,
    modifiedPagesCount,
    totalAddedLines,
    totalRemovedLines,
    similarityPercent,
    pages,
  };
}

export async function generateSampleComparisonPdfPair(): Promise<{
  pdfA: Uint8Array;
  pdfB: Uint8Array;
}> {
  const createSpecPdf = async (pagesSpec: { heading: string; lines: string[] }[]) => {
    const doc = await PDFDocument.create();
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

    for (const spec of pagesSpec) {
      const page = doc.addPage([612, 792]);
      page.drawText(spec.heading, {
        x: 56,
        y: 710,
        size: 20,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.12),
      });
      spec.lines.forEach((line, idx) => {
        page.drawText(line, {
          x: 56,
          y: 660 - idx * 28,
          size: 12,
          font: fontRegular,
          color: rgb(0.2, 0.2, 0.24),
        });
      });
    }

    return doc.save({ useObjectStreams: false });
  };

  const pdfA = await createSpecPdf([
    {
      heading: "Service Agreement — Version 1.0",
      lines: [
        "Clause 1: Scope of Browser-First Utilities",
        "Payment Terms: Net 30 days from invoice issue date.",
        "Monthly Retainer Fee: $2,400.00 USD",
        "Support SLA: Standard business hours (9am - 5pm).",
      ],
    },
    {
      heading: "Page 2 — Data Privacy & Retention",
      lines: [
        "All client files are processed locally in browser memory.",
        "Zero files are transmitted to external servers.",
        "Governing Law: State of Delaware.",
      ],
    },
  ]);

  const pdfB = await createSpecPdf([
    {
      heading: "Service Agreement — Version 2.0 (Revised)",
      lines: [
        "Clause 1: Scope of Browser-First Utilities",
        "Payment Terms: Net 15 days from invoice issue date.",
        "Monthly Retainer Fee: $2,850.00 USD",
        "Support SLA: 24/7 Priority Engineering Coverage.",
      ],
    },
    {
      heading: "Page 2 — Data Privacy & Retention",
      lines: [
        "All client files are processed locally in browser memory.",
        "Zero files are transmitted to external servers.",
        "Governing Law: State of Delaware.",
      ],
    },
  ]);

  return { pdfA, pdfB };
}

// ============================================================================
// 6. CROP IMAGE GEOMETRY & ASPECT RATIO CLAMPING
// ============================================================================

export type CropAspectPreset = "free" | "1:1" | "16:9" | "4:3" | "3:2" | "9:16";

export interface CropBoxInput {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectPreset: CropAspectPreset;
}

export interface CropBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ASPECT_RATIO_MAP: Record<Exclude<CropAspectPreset, "free">, number> = {
  "1:1": 1,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
  "9:16": 9 / 16,
};

export function computeCropBox(
  sourceWidth: number,
  sourceHeight: number,
  input: CropBoxInput,
): CropBoxRect {
  const safeSrcW = Math.max(1, Math.round(sourceWidth));
  const safeSrcH = Math.max(1, Math.round(sourceHeight));

  let x = Math.max(0, Math.min(safeSrcW - 1, Math.round(input.x || 0)));
  let y = Math.max(0, Math.min(safeSrcH - 1, Math.round(input.y || 0)));

  const maxW = safeSrcW - x;
  const maxH = safeSrcH - y;

  let width = Math.max(1, Math.min(maxW, Math.round(input.width || maxW)));
  let height = Math.max(1, Math.min(maxH, Math.round(input.height || maxH)));

  if (input.aspectPreset !== "free") {
    const ratio = ASPECT_RATIO_MAP[input.aspectPreset];
    let targetHeight = Math.round(width / ratio);
    if (targetHeight > maxH) {
      targetHeight = maxH;
      width = Math.max(1, Math.min(maxW, Math.round(targetHeight * ratio)));
    }
    height = Math.max(1, targetHeight);
  }

  if (x + width > safeSrcW) x = Math.max(0, safeSrcW - width);
  if (y + height > safeSrcH) y = Math.max(0, safeSrcH - height);

  return { x, y, width, height };
}

// ============================================================================
// 7. IMAGE DPI & BINARY HEADER METADATA INSPECTOR
// ============================================================================

export interface PrintDimensionRow {
  dpi: number;
  label: string;
  widthInches: number;
  heightInches: number;
  widthCm: number;
  heightCm: number;
}

export interface ImageDpiMetadataReport {
  widthPx: number;
  heightPx: number;
  megapixels: number;
  aspectRatioLabel: string;
  detectedFormat: string;
  embeddedDpiX: number | null;
  embeddedDpiY: number | null;
  dpiSource: string;
  printSizes: PrintDimensionRow[];
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

export function parseEmbeddedDpiFromBytes(bytes: Uint8Array): {
  dpiX: number | null;
  dpiY: number | null;
  source: string;
  format: string;
} {
  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readUint32BE(bytes, offset);
      const type = String.fromCharCode(
        bytes[offset + 4] ?? 0,
        bytes[offset + 5] ?? 0,
        bytes[offset + 6] ?? 0,
        bytes[offset + 7] ?? 0,
      );
      if (type === "pHYs" && length === 9 && offset + 17 <= bytes.length) {
        const ppuX = readUint32BE(bytes, offset + 8);
        const ppuY = readUint32BE(bytes, offset + 12);
        const unit = bytes[offset + 16] ?? 0;
        if (unit === 1 && ppuX > 0 && ppuY > 0) {
          return {
            dpiX: Math.round(ppuX * 0.0254),
            dpiY: Math.round(ppuY * 0.0254),
            source: "PNG pHYs chunk (pixels per meter)",
            format: "PNG",
          };
        }
      }
      if (type === "IEND") break;
      offset += 12 + length;
    }
    return {
      dpiX: null,
      dpiY: null,
      source: "No PNG pHYs chunk present (defaults to 72/96 PPI screen standard)",
      format: "PNG",
    };
  }

  // Check JPEG signature: FF D8
  if (bytes.length >= 20 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1] ?? 0;
      if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
      const segLength = readUint16BE(bytes, offset + 2);
      if (segLength < 2) break;

      // APP0 JFIF
      if (
        marker === 0xe0 &&
        offset + 16 <= bytes.length &&
        bytes[offset + 4] === 0x4a && // 'J'
        bytes[offset + 5] === 0x46 && // 'F'
        bytes[offset + 6] === 0x49 && // 'I'
        bytes[offset + 7] === 0x46 // 'F'
      ) {
        const units = bytes[offset + 11] ?? 0;
        const xDensity = readUint16BE(bytes, offset + 12);
        const yDensity = readUint16BE(bytes, offset + 14);
        if (units === 1 && xDensity > 0 && yDensity > 0) {
          return {
            dpiX: xDensity,
            dpiY: yDensity,
            source: "JPEG JFIF APP0 header (dots per inch)",
            format: "JPEG",
          };
        }
        if (units === 2 && xDensity > 0 && yDensity > 0) {
          return {
            dpiX: Math.round(xDensity * 2.54),
            dpiY: Math.round(yDensity * 2.54),
            source: "JPEG JFIF APP0 header (dots per cm converted to DPI)",
            format: "JPEG",
          };
        }
      }
      offset += 2 + segLength;
    }
    return {
      dpiX: null,
      dpiY: null,
      source: "No JFIF/EXIF resolution density tag found (defaults to 72 DPI)",
      format: "JPEG",
    };
  }

  // Check WebP signature: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      dpiX: null,
      dpiY: null,
      source: "WebP container (no physical DPI header; uses standard print DPI presets)",
      format: "WebP",
    };
  }

  return {
    dpiX: null,
    dpiY: null,
    source: "Standard raster image (no embedded DPI header)",
    format: "Image",
  };
}

export function inspectImageDpiAndMetadata(
  bytes: Uint8Array,
  widthPx: number,
  heightPx: number,
): ImageDpiMetadataReport {
  const safeW = Math.max(1, Math.round(widthPx));
  const safeH = Math.max(1, Math.round(heightPx));
  const divisor = gcd(safeW, safeH);
  const aspectRatioLabel = `${safeW / divisor}:${safeH / divisor}`;
  const megapixels = Number(((safeW * safeH) / 1_000_000).toFixed(2));

  const parsed = parseEmbeddedDpiFromBytes(bytes);

  const buildRow = (dpi: number, label: string): PrintDimensionRow => {
    const widthInches = Number((safeW / dpi).toFixed(2));
    const heightInches = Number((safeH / dpi).toFixed(2));
    return {
      dpi,
      label,
      widthInches,
      heightInches,
      widthCm: Number((widthInches * 2.54).toFixed(2)),
      heightCm: Number((heightInches * 2.54).toFixed(2)),
    };
  };

  const printSizes: PrintDimensionRow[] = [];
  if (
    parsed.dpiX &&
    parsed.dpiX > 0 &&
    parsed.dpiX !== 72 &&
    parsed.dpiX !== 150 &&
    parsed.dpiX !== 300
  ) {
    printSizes.push(buildRow(parsed.dpiX, `${parsed.dpiX} DPI (Embedded Header)`));
  }
  printSizes.push(
    buildRow(72, "72 DPI (Screen / Web Standard)"),
    buildRow(150, "150 DPI (Office / Draft Print)"),
    buildRow(300, "300 DPI (High-Res Commercial Print)"),
  );

  return {
    widthPx: safeW,
    heightPx: safeH,
    megapixels,
    aspectRatioLabel,
    detectedFormat: parsed.format,
    embeddedDpiX: parsed.dpiX,
    embeddedDpiY: parsed.dpiY,
    dpiSource: parsed.source,
    printSizes,
  };
}

// ============================================================================
// CRC-32 & PNG pHYs CHUNK INJECTOR (FOR 300-DPI SAMPLE GENERATION & TESTS)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0;
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function injectPngPhysDpiChunk(pngBytes: Uint8Array, dpi: number): Uint8Array {
  // Verify PNG signature + IHDR chunk (8 + 25 = 33 bytes)
  if (
    pngBytes.length < 33 ||
    pngBytes[0] !== 0x89 ||
    pngBytes[1] !== 0x50 ||
    pngBytes[2] !== 0x4e ||
    pngBytes[3] !== 0x47
  ) {
    return pngBytes;
  }

  const ppm = Math.round(dpi / 0.0254);
  const physChunk = new Uint8Array(21);
  // Length = 9
  physChunk[0] = 0;
  physChunk[1] = 0;
  physChunk[2] = 0;
  physChunk[3] = 9;
  // Type = 'pHYs'
  physChunk[4] = 0x70;
  physChunk[5] = 0x48;
  physChunk[6] = 0x59;
  physChunk[7] = 0x73;
  // ppuX (4 bytes BE)
  physChunk[8] = (ppm >>> 24) & 0xff;
  physChunk[9] = (ppm >>> 16) & 0xff;
  physChunk[10] = (ppm >>> 8) & 0xff;
  physChunk[11] = ppm & 0xff;
  // ppuY (4 bytes BE)
  physChunk[12] = (ppm >>> 24) & 0xff;
  physChunk[13] = (ppm >>> 16) & 0xff;
  physChunk[14] = (ppm >>> 8) & 0xff;
  physChunk[15] = ppm & 0xff;
  // Unit = 1 (meter)
  physChunk[16] = 1;

  const crc = computeCrc32(physChunk.subarray(4, 17));
  physChunk[17] = (crc >>> 24) & 0xff;
  physChunk[18] = (crc >>> 16) & 0xff;
  physChunk[19] = (crc >>> 8) & 0xff;
  physChunk[20] = crc & 0xff;

  const ihdrEnd = 8 + 12 + readUint32BE(pngBytes, 8);
  const out = new Uint8Array(pngBytes.length + physChunk.length);
  out.set(pngBytes.subarray(0, ihdrEnd), 0);
  out.set(physChunk, ihdrEnd);
  out.set(pngBytes.subarray(ihdrEnd), ihdrEnd + physChunk.length);
  return out;
}

// ============================================================================
// 8. IMAGE TO BASE64 ENCODER & SNIPPET GENERATOR
// ============================================================================

export interface ImageBase64Snippets {
  rawBase64: string;
  dataUrl: string;
  htmlImgTag: string;
  cssBackground: string;
  markdownImage: string;
  originalBytes: number;
  base64Length: number;
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < len ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < len ? (bytes[i + 2] ?? 0) : 0;

    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += BASE64_CHARS[(triplet >>> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >>> 12) & 0x3f];
    result += i + 1 < len ? BASE64_CHARS[(triplet >>> 6) & 0x3f] : "=";
    result += i + 2 < len ? BASE64_CHARS[triplet & 0x3f] : "=";
  }
  return result;
}

export function encodeImageBytesToBase64Snippets(
  bytes: Uint8Array,
  mimeType = "image/png",
  altText = "Embedded image",
): ImageBase64Snippets {
  const safeMime = mimeType.trim() || "image/png";
  const rawBase64 = uint8ArrayToBase64(bytes);
  const dataUrl = `data:${safeMime};base64,${rawBase64}`;
  const cleanAlt = altText.replace(/"/g, "&quot;");
  return {
    rawBase64,
    dataUrl,
    htmlImgTag: `<img src="${dataUrl}" alt="${cleanAlt}" />`,
    cssBackground: `background-image: url("${dataUrl}");`,
    markdownImage: `![${altText}](${dataUrl})`,
    originalBytes: bytes.byteLength,
    base64Length: rawBase64.length,
  };
}

// ============================================================================
// 9. EXTRACT DOMINANT COLORS FROM IMAGE RGBA BUFFER
// ============================================================================

export interface ExtractedColorSwatch {
  hex: string;
  rgb: string;
  hsl: string;
  r: number;
  g: number;
  b: number;
  percentage: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHslString(r: number, g: number, b: number): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function extractDominantColorsFromRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  maxColors = 8,
): ExtractedColorSwatch[] {
  const buckets = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();

  const totalPixels = Math.floor(rgba.length / 4);
  if (totalPixels === 0) return [];

  // Sample up to ~25,000 pixels for fast performance
  const stride = Math.max(1, Math.floor(totalPixels / 25000));
  let validSampled = 0;

  for (let p = 0; p < totalPixels; p += stride) {
    const idx = p * 4;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;
    const a = rgba[idx + 3] ?? 255;

    if (a < 40) continue; // skip transparent pixels
    validSampled++;

    // Quantize to 16-step bins per channel
    const qr = Math.floor(r / 16);
    const qg = Math.floor(g / 16);
    const qb = Math.floor(b / 16);
    const key = `${qr}-${qg}-${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.sumR += r;
      existing.sumG += g;
      existing.sumB += b;
    } else {
      buckets.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
    }
  }

  if (validSampled === 0) return [];

  const sortedClusters = Array.from(buckets.values())
    .map((b) => ({
      count: b.count,
      r: Math.round(b.sumR / b.count),
      g: Math.round(b.sumG / b.count),
      b: Math.round(b.sumB / b.count),
    }))
    .sort((a, b) => b.count - a.count);

  // Merge perceptually close clusters so swatches are distinct
  const merged: { count: number; r: number; g: number; b: number }[] = [];
  for (const cluster of sortedClusters) {
    const closeExisting = merged.find((m) => {
      const dist = Math.hypot(m.r - cluster.r, m.g - cluster.g, m.b - cluster.b);
      return dist < 36;
    });
    if (closeExisting) {
      const total = closeExisting.count + cluster.count;
      closeExisting.r = Math.round(
        (closeExisting.r * closeExisting.count + cluster.r * cluster.count) / total,
      );
      closeExisting.g = Math.round(
        (closeExisting.g * closeExisting.count + cluster.g * cluster.count) / total,
      );
      closeExisting.b = Math.round(
        (closeExisting.b * closeExisting.count + cluster.b * cluster.count) / total,
      );
      closeExisting.count = total;
    } else {
      merged.push({ ...cluster });
    }
  }

  const top = merged.sort((a, b) => b.count - a.count).slice(0, Math.max(1, maxColors));

  return top.map((c) => {
    const hex = rgbToHex(c.r, c.g, c.b);
    return {
      hex,
      rgb: `rgb(${c.r}, ${c.g}, ${c.b})`,
      hsl: rgbToHslString(c.r, c.g, c.b),
      r: c.r,
      g: c.g,
      b: c.b,
      percentage: Number(((c.count / validSampled) * 100).toFixed(1)),
    };
  });
}

// ============================================================================
// 10. BULK IMAGE RENAMER & PURE-TS ZIP ARCHIVE BUILDER
// ============================================================================

export type RenameCaseStyle = "kebab" | "snake" | "lower" | "preserve";

export interface BulkRenameOptions {
  pattern: string; // e.g. "{name}-{index}" or "product-{index}"
  prefix: string;
  suffix: string;
  startIndex: number;
  padDigits: number;
  dateStamp: string;
  caseStyle: RenameCaseStyle;
}

export interface BulkRenamePair {
  originalName: string;
  newName: string;
  extension: string;
}

function formatBaseNameCase(input: string, style: RenameCaseStyle): string {
  const cleaned = Array.from(input.trim())
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join("")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ");
  switch (style) {
    case "kebab":
      return cleaned
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    case "snake":
      return cleaned
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    case "lower":
      return cleaned.toLowerCase().replace(/\s+/g, "-");
    case "preserve":
    default:
      return cleaned.replace(/\s+/g, "-");
  }
}

export function generateBulkRenamedFilenames(
  originalNames: string[],
  options: BulkRenameOptions,
): BulkRenamePair[] {
  const pattern = options.pattern.trim() || "{name}-{index}";
  const startIdx = Number.isFinite(options.startIndex)
    ? Math.max(0, Math.floor(options.startIndex))
    : 1;
  const padDigits = Math.max(1, Math.min(6, Math.floor(options.padDigits || 2)));
  const dateToken = (options.dateStamp || new Date().toISOString().slice(0, 10)).trim();
  const usedNames = new Set<string>();

  return originalNames.map((originalName, i) => {
    const dotIdx = originalName.lastIndexOf(".");
    const rawStem = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;
    const ext = dotIdx > 0 ? originalName.slice(dotIdx + 1).toLowerCase() : "png";

    const formattedStem = formatBaseNameCase(rawStem, options.caseStyle) || `image-${i + 1}`;
    const indexStr = String(startIdx + i).padStart(padDigits, "0");

    let built = pattern
      .replace(/\{name\}/gi, formattedStem)
      .replace(/\{index\}/gi, indexStr)
      .replace(/\{date\}/gi, dateToken);

    if (options.prefix.trim()) {
      built = `${options.prefix.trim()}${built}`;
    }
    if (options.suffix.trim()) {
      built = `${built}${options.suffix.trim()}`;
    }

    const cleanStem = formatBaseNameCase(built, options.caseStyle) || `file-${indexStr}`;
    let candidate = `${cleanStem}.${ext}`;
    let dupCounter = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${cleanStem}-${dupCounter}.${ext}`;
      dupCounter++;
    }
    usedNames.add(candidate.toLowerCase());

    return {
      originalName,
      newName: candidate,
      extension: ext,
    };
  });
}

export interface ZipArchiveEntry {
  filename: string;
  bytes: Uint8Array;
}

function writeUint16LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

/**
 * Pure-TypeScript PKZIP archive generator (Store method 0 with IEEE 802.3 CRC-32).
 */
export function buildZipArchive(entries: ZipArchiveEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((e) => {
    const nameBytes = encoder.encode(e.filename.replace(/^\/+/, "") || "file.bin");
    const crc = computeCrc32(e.bytes);
    return {
      nameBytes,
      data: e.bytes,
      crc,
      localHeaderOffset: 0,
    };
  });

  let localSectionSize = 0;
  let centralDirSize = 0;
  for (const item of prepared) {
    item.localHeaderOffset = localSectionSize;
    localSectionSize += 30 + item.nameBytes.length + item.data.length;
    centralDirSize += 46 + item.nameBytes.length;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const out = new Uint8Array(totalSize);
  let ptr = 0;

  // 1. Write Local File Headers + File Data
  for (const item of prepared) {
    writeUint32LE(out, ptr, 0x04034b50); // Local file header signature
    writeUint16LE(out, ptr + 4, 20); // Version needed to extract (2.0)
    writeUint16LE(out, ptr + 6, 0x0800); // UTF-8 filename flag
    writeUint16LE(out, ptr + 8, 0); // Compression method: 0 (Store)
    writeUint16LE(out, ptr + 10, 0); // Mod time
    writeUint16LE(out, ptr + 12, 0x5421); // Mod date
    writeUint32LE(out, ptr + 14, item.crc);
    writeUint32LE(out, ptr + 18, item.data.length);
    writeUint32LE(out, ptr + 22, item.data.length);
    writeUint16LE(out, ptr + 26, item.nameBytes.length);
    writeUint16LE(out, ptr + 28, 0); // Extra field length
    out.set(item.nameBytes, ptr + 30);
    ptr += 30 + item.nameBytes.length;
    out.set(item.data, ptr);
    ptr += item.data.length;
  }

  const centralDirOffset = ptr;

  // 2. Write Central Directory Headers
  for (const item of prepared) {
    writeUint32LE(out, ptr, 0x02014b50); // Central directory signature
    writeUint16LE(out, ptr + 4, 20); // Version made by
    writeUint16LE(out, ptr + 6, 20); // Version needed
    writeUint16LE(out, ptr + 8, 0x0800); // UTF-8 flag
    writeUint16LE(out, ptr + 10, 0); // Store method
    writeUint16LE(out, ptr + 12, 0);
    writeUint16LE(out, ptr + 14, 0x5421);
    writeUint32LE(out, ptr + 16, item.crc);
    writeUint32LE(out, ptr + 20, item.data.length);
    writeUint32LE(out, ptr + 24, item.data.length);
    writeUint16LE(out, ptr + 28, item.nameBytes.length);
    writeUint16LE(out, ptr + 30, 0); // Extra length
    writeUint16LE(out, ptr + 32, 0); // Comment length
    writeUint16LE(out, ptr + 34, 0); // Disk number
    writeUint16LE(out, ptr + 36, 0); // Internal attrs
    writeUint32LE(out, ptr + 38, 0); // External attrs
    writeUint32LE(out, ptr + 42, item.localHeaderOffset);
    out.set(item.nameBytes, ptr + 46);
    ptr += 46 + item.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  writeUint32LE(out, ptr, 0x06054b50);
  writeUint16LE(out, ptr + 4, 0); // Disk number
  writeUint16LE(out, ptr + 6, 0); // Disk with central dir
  writeUint16LE(out, ptr + 8, prepared.length);
  writeUint16LE(out, ptr + 10, prepared.length);
  writeUint32LE(out, ptr + 12, centralDirSize);
  writeUint32LE(out, ptr + 16, centralDirOffset);
  writeUint16LE(out, ptr + 20, 0); // Comment length

  return out;
}
