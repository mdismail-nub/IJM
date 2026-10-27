import { degrees, PDFDocument } from "pdf-lib";

export interface PageRangeGroup {
  label: string;
  /** 1-based page numbers */
  pages: number[];
}

export interface PageRangeParseResult {
  ok: boolean;
  ranges: PageRangeGroup[];
  /** Deduplicated 1-based page numbers in order of appearance */
  flatPages: number[];
  error?: string;
}

export function parsePageRanges(rawInput: string, totalPages: number): PageRangeParseResult {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return {
      ok: false,
      ranges: [],
      flatPages: [],
      error: "Document must have at least 1 page.",
    };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      ranges: [],
      flatPages: [],
      error: `Please enter page numbers or ranges between 1 and ${totalPages} (e.g., 1-3, 5).`,
    };
  }

  if (trimmed.toLowerCase() === "all") {
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return {
      ok: true,
      ranges: allPages.map((p) => ({ label: `page-${p}`, pages: [p] })),
      flatPages: allPages,
    };
  }

  const segments = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      ok: false,
      ranges: [],
      flatPages: [],
      error: "Please enter at least one valid page number or range.",
    };
  }

  const ranges: PageRangeGroup[] = [];
  const flatSet = new Set<number>();
  const flatPages: number[] = [];

  for (const segment of segments) {
    const singleMatch = segment.match(/^(\d+)$/);
    if (singleMatch && singleMatch[1]) {
      const pageNum = Number.parseInt(singleMatch[1], 10);
      if (pageNum < 1 || pageNum > totalPages) {
        return {
          ok: false,
          ranges: [],
          flatPages: [],
          error: `Page ${pageNum} is out of bounds. This PDF has ${totalPages} ${totalPages === 1 ? "page" : "pages"}.`,
        };
      }
      ranges.push({ label: `page-${pageNum}`, pages: [pageNum] });
      if (!flatSet.has(pageNum)) {
        flatSet.add(pageNum);
        flatPages.push(pageNum);
      }
      continue;
    }

    const rangeMatch = segment.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);

      if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
        return {
          ok: false,
          ranges: [],
          flatPages: [],
          error: `Range "${segment}" is out of bounds. Valid pages are 1 to ${totalPages}.`,
        };
      }
      if (start > end) {
        return {
          ok: false,
          ranges: [],
          flatPages: [],
          error: `Invalid range "${segment}": start page (${start}) cannot be greater than end page (${end}).`,
        };
      }

      const pages: number[] = [];
      for (let p = start; p <= end; p++) {
        pages.push(p);
        if (!flatSet.has(p)) {
          flatSet.add(p);
          flatPages.push(p);
        }
      }
      ranges.push({
        label: start === end ? `page-${start}` : `pages-${start}-${end}`,
        pages,
      });
      continue;
    }

    return {
      ok: false,
      ranges: [],
      flatPages: [],
      error: `Invalid range syntax "${segment}". Use comma-separated pages or ranges like "1-3, 5".`,
    };
  }

  return { ok: true, ranges, flatPages };
}

export interface ResizeDimensionOptions {
  mode: "dimensions" | "percentage";
  targetWidth?: number;
  targetHeight?: number;
  lockAspectRatio?: boolean;
  percentage?: number;
}

export interface ResizeDimensionResult {
  ok: boolean;
  width: number;
  height: number;
  error?: string;
}

export function computeTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  options: ResizeDimensionOptions,
): ResizeDimensionResult {
  if (
    !Number.isFinite(originalWidth) ||
    !Number.isFinite(originalHeight) ||
    originalWidth < 1 ||
    originalHeight < 1
  ) {
    return {
      ok: false,
      width: 0,
      height: 0,
      error: "Original image dimensions must be positive numbers.",
    };
  }

  const MAX_DIMENSION = 12000;

  if (options.mode === "percentage") {
    const pct = options.percentage ?? 100;
    if (!Number.isFinite(pct) || pct < 1 || pct > 500) {
      return {
        ok: false,
        width: 0,
        height: 0,
        error: "Scale percentage must be between 1% and 500%.",
      };
    }
    const width = Math.max(1, Math.round((originalWidth * pct) / 100));
    const height = Math.max(1, Math.round((originalHeight * pct) / 100));
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      return {
        ok: false,
        width: 0,
        height: 0,
        error: `Target dimensions (${width}×${height}px) exceed maximum browser canvas size of ${MAX_DIMENSION}px.`,
      };
    }
    return { ok: true, width, height };
  }

  const aspect = originalWidth / originalHeight;
  let width = options.targetWidth ? Math.round(options.targetWidth) : 0;
  let height = options.targetHeight ? Math.round(options.targetHeight) : 0;

  if (options.lockAspectRatio) {
    if (width > 0 && (!options.targetHeight || height <= 0)) {
      height = Math.max(1, Math.round(width / aspect));
    } else if (height > 0 && (!options.targetWidth || width <= 0)) {
      width = Math.max(1, Math.round(height * aspect));
    }
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return {
      ok: false,
      width: 0,
      height: 0,
      error: "Width and height must be whole numbers of at least 1 pixel.",
    };
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return {
      ok: false,
      width: 0,
      height: 0,
      error: `Width and height cannot exceed ${MAX_DIMENSION} pixels.`,
    };
  }

  return { ok: true, width, height };
}

export async function inspectPdfBytes(
  bytes: Uint8Array,
): Promise<{ ok: boolean; pageCount: number; error?: string }> {
  if (!bytes || bytes.byteLength === 0) {
    return { ok: false, pageCount: 0, error: "PDF file is empty." };
  }
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return { ok: true, pageCount: doc.getPageCount() };
  } catch {
    return {
      ok: false,
      pageCount: 0,
      error: "Could not read this PDF file. It may be corrupted or password-protected.",
    };
  }
}

export async function mergePdfBuffers(
  buffers: Uint8Array[],
): Promise<{ ok: boolean; bytes?: Uint8Array; totalPages?: number; error?: string }> {
  if (!buffers || buffers.length < 2) {
    return {
      ok: false,
      error: "Please select at least 2 PDF files to merge.",
    };
  }

  try {
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i];
      if (!buf || buf.byteLength === 0) {
        return {
          ok: false,
          error: `File #${i + 1} is empty and cannot be merged.`,
        };
      }
      const srcDoc = await PDFDocument.load(buf, { updateMetadata: false });
      const indices = srcDoc.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(srcDoc, indices);
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
        totalPages++;
      }
    }

    const outBytes = await mergedPdf.save({ useObjectStreams: true });
    return { ok: true, bytes: outBytes, totalPages };
  } catch {
    return {
      ok: false,
      error: "Failed to merge PDFs. One of the selected files may be corrupted or encrypted.",
    };
  }
}

export interface SplitPdfOutputItem {
  label: string;
  pageCount: number;
  bytes: Uint8Array;
}

export async function splitPdfBuffer(
  buffer: Uint8Array,
  rangeInput: string,
  combineIntoSingle = true,
): Promise<{
  ok: boolean;
  outputs: SplitPdfOutputItem[];
  error?: string;
}> {
  try {
    const srcDoc = await PDFDocument.load(buffer, { updateMetadata: false });
    const totalPages = srcDoc.getPageCount();
    const parsed = parsePageRanges(rangeInput, totalPages);
    if (!parsed.ok) {
      return {
        ok: false,
        outputs: [],
        ...(parsed.error ? { error: parsed.error } : {}),
      };
    }

    if (combineIntoSingle) {
      const destDoc = await PDFDocument.create();
      const zeroBased = parsed.flatPages.map((p) => p - 1);
      const copied = await destDoc.copyPages(srcDoc, zeroBased);
      for (const page of copied) {
        destDoc.addPage(page);
      }
      const outBytes = await destDoc.save({ useObjectStreams: true });
      return {
        ok: true,
        outputs: [
          {
            label: "extracted-pages",
            pageCount: copied.length,
            bytes: outBytes,
          },
        ],
      };
    }

    const outputs: SplitPdfOutputItem[] = [];
    for (const group of parsed.ranges) {
      const destDoc = await PDFDocument.create();
      const zeroBased = group.pages.map((p) => p - 1);
      const copied = await destDoc.copyPages(srcDoc, zeroBased);
      for (const page of copied) {
        destDoc.addPage(page);
      }
      const outBytes = await destDoc.save({ useObjectStreams: true });
      outputs.push({
        label: group.label,
        pageCount: copied.length,
        bytes: outBytes,
      });
    }

    return { ok: true, outputs };
  } catch {
    return {
      ok: false,
      outputs: [],
      error: "Unable to split this PDF. The file may be corrupted or encrypted.",
    };
  }
}

export interface CompressPdfResult {
  ok: boolean;
  originalBytes?: number;
  compressedBytes?: number;
  savedBytes?: number;
  pageCount?: number;
  bytes?: Uint8Array;
  error?: string;
}

export async function compressPdfBuffer(
  buffer: Uint8Array,
  stripMetadata = true,
): Promise<CompressPdfResult> {
  if (!buffer || buffer.byteLength === 0) {
    return { ok: false, error: "PDF file is empty." };
  }

  try {
    const srcDoc = await PDFDocument.load(buffer, { updateMetadata: false });
    const freshDoc = await PDFDocument.create();
    const indices = srcDoc.getPageIndices();
    const copied = await freshDoc.copyPages(srcDoc, indices);
    for (const page of copied) {
      freshDoc.addPage(page);
    }

    if (stripMetadata) {
      freshDoc.setTitle("");
      freshDoc.setAuthor("");
      freshDoc.setSubject("");
      freshDoc.setKeywords([]);
      freshDoc.setProducer("");
      freshDoc.setCreator("");
    }

    const reencoded = await freshDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    // Never return a larger file if the input was already maximally packed and stripping metadata didn't needed
    const finalBytes =
      !stripMetadata && reencoded.byteLength >= buffer.byteLength ? buffer : reencoded;

    const originalBytes = buffer.byteLength;
    const compressedBytes = finalBytes.byteLength;
    const savedBytes = Math.max(0, originalBytes - compressedBytes);

    return {
      ok: true,
      originalBytes,
      compressedBytes,
      savedBytes,
      pageCount: copied.length,
      bytes: finalBytes,
    };
  } catch {
    return {
      ok: false,
      error: "Could not optimize this PDF. It may be corrupted or password-protected.",
    };
  }
}

export async function rotatePdfBuffer(
  buffer: Uint8Array,
  angle: 90 | 180 | 270,
  pageRangeInput = "all",
): Promise<{
  ok: boolean;
  bytes?: Uint8Array;
  pageCount?: number;
  rotatedCount?: number;
  error?: string;
}> {
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false });
    const totalPages = doc.getPageCount();
    const parsed = parsePageRanges(pageRangeInput, totalPages);
    if (!parsed.ok) {
      return {
        ok: false,
        ...(parsed.error ? { error: parsed.error } : {}),
      };
    }

    const pages = doc.getPages();
    let rotatedCount = 0;

    for (const pageNum of parsed.flatPages) {
      const page = pages[pageNum - 1];
      if (!page) continue;
      const currentAngle = page.getRotation().angle;
      const nextAngle = (((currentAngle + angle) % 360) + 360) % 360;
      page.setRotation(degrees(nextAngle));
      rotatedCount++;
    }

    const outBytes = await doc.save({ useObjectStreams: true });
    return {
      ok: true,
      bytes: outBytes,
      pageCount: totalPages,
      rotatedCount,
    };
  } catch {
    return {
      ok: false,
      error: "Failed to rotate PDF pages. The file may be corrupted or encrypted.",
    };
  }
}

export interface EncodedImageInput {
  name: string;
  bytes: Uint8Array;
  format: "jpg" | "png";
}

export interface ImageToPdfOptions {
  pageSize: "fit" | "a4" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  marginPoints: number;
}

export async function buildPdfFromEncodedImages(
  images: EncodedImageInput[],
  options: ImageToPdfOptions = {
    pageSize: "a4",
    orientation: "auto",
    marginPoints: 24,
  },
): Promise<{ ok: boolean; bytes?: Uint8Array; pageCount?: number; error?: string }> {
  if (!images || images.length === 0) {
    return {
      ok: false,
      error: "Please select at least one image to convert to PDF.",
    };
  }

  try {
    const pdfDoc = await PDFDocument.create();

    for (const item of images) {
      const embedded =
        item.format === "jpg"
          ? await pdfDoc.embedJpg(item.bytes)
          : await pdfDoc.embedPng(item.bytes);

      const imgWidth = embedded.width;
      const imgHeight = embedded.height;
      const margin = Math.max(0, options.marginPoints);

      if (options.pageSize === "fit") {
        const pageW = imgWidth + margin * 2;
        const pageH = imgHeight + margin * 2;
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, {
          x: margin,
          y: margin,
          width: imgWidth,
          height: imgHeight,
        });
      } else {
        // A4: 595.28 x 841.89 pt, Letter: 612 x 792 pt
        const baseW = options.pageSize === "letter" ? 612 : 595.28;
        const baseH = options.pageSize === "letter" ? 792 : 841.89;

        const useLandscape =
          options.orientation === "landscape" ||
          (options.orientation === "auto" && imgWidth > imgHeight);

        const pageW = useLandscape ? baseH : baseW;
        const pageH = useLandscape ? baseW : baseH;

        const availW = Math.max(50, pageW - margin * 2);
        const availH = Math.max(50, pageH - margin * 2);
        const scale = Math.min(availW / imgWidth, availH / imgHeight, 1);

        const drawW = imgWidth * scale;
        const drawH = imgHeight * scale;
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;

        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }
    }

    const outBytes = await pdfDoc.save({ useObjectStreams: true });
    return { ok: true, bytes: outBytes, pageCount: images.length };
  } catch {
    return {
      ok: false,
      error: "Failed to embed one or more images into the PDF document.",
    };
  }
}

export async function generateSamplePdfBytes(
  title = "IJM Sample Document",
  pageCount = 3,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setAuthor("IJM Local Generator");

  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`${title} — Page ${i} of ${pageCount}`, {
      x: 50,
      y: 760,
      size: 18,
    });
    page.drawText(
      "Processed locally in your browser by IJM. No files are uploaded to any server.",
      {
        x: 50,
        y: 725,
        size: 11,
      },
    );
  }
  return await doc.save();
}
