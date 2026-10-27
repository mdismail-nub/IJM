import { describe, expect, it } from "vitest";
import {
  buildPdfFromEncodedImages,
  compressPdfBuffer,
  computeTargetDimensions,
  generateSamplePdfBytes,
  mergePdfBuffers,
  parsePageRanges,
  rotatePdfBuffer,
  splitPdfBuffer,
} from "@/lib/file-tools";

describe("Phase D — File Tools", () => {
  it("parses page ranges and rejects out-of-bounds or inverted ranges", () => {
    expect(parsePageRanges("1-3, 5", 5).ok).toBe(true);
    expect(parsePageRanges("1-3, 5", 5).flatPages).toEqual([1, 2, 3, 5]);
    expect(parsePageRanges("0", 5).ok).toBe(false);
    expect(parsePageRanges("1-6", 5).ok).toBe(false);
    expect(parsePageRanges("4-2", 5).ok).toBe(false);
  });

  it("calculates target resize dimensions with aspect ratio and bounds validation", () => {
    const pct = computeTargetDimensions(1000, 500, {
      mode: "percentage",
      percentage: 50,
    });
    expect(pct.ok).toBe(true);
    expect(pct.width).toBe(500);
    expect(pct.height).toBe(250);

    const invalid = computeTargetDimensions(1000, 500, {
      mode: "percentage",
      percentage: 999,
    });
    expect(invalid.ok).toBe(false);
  });

  it("merges, splits, compresses, and rotates PDFs in memory", async () => {
    const doc1 = await generateSamplePdfBytes("Doc 1", 2);
    const doc2 = await generateSamplePdfBytes("Doc 2", 2);

    const merged = await mergePdfBuffers([doc1, doc2]);
    expect(merged.ok).toBe(true);
    expect(merged.totalPages).toBe(4);

    const split = await splitPdfBuffer(merged.bytes!, "1-2", true);
    expect(split.ok).toBe(true);
    expect(split.outputs[0]?.pageCount).toBe(2);

    const compressed = await compressPdfBuffer(merged.bytes!, true);
    expect(compressed.ok).toBe(true);
    expect(compressed.pageCount).toBe(4);

    const rotated = await rotatePdfBuffer(doc1, 180, "all");
    expect(rotated.ok).toBe(true);
    expect(rotated.rotatedCount).toBe(2);
  });

  it("creates a PDF from PNG image buffers", async () => {
    const base64Png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bin = atob(base64Png);
    const pngBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pngBytes[i] = bin.charCodeAt(i);

    const pdf = await buildPdfFromEncodedImages([
      { name: "dot.png", bytes: pngBytes, format: "png" },
    ]);
    expect(pdf.ok).toBe(true);
    expect(pdf.pageCount).toBe(1);
  });
});
