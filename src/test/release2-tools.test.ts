import { describe, expect, it } from "vitest";
import { generateSamplePdfBytes } from "@/lib/file-tools";
import {
  addPageNumbersToPdfBuffer,
  addWatermarkToPdfBuffer,
  buildZipArchive,
  comparePdfBuffers,
  computeCropBox,
  encodeImageBytesToBase64Snippets,
  extractDominantColorsFromRgba,
  extractPdfPagesBuffer,
  generateBulkRenamedFilenames,
  generateSampleComparisonPdfPair,
  injectPngPhysDpiChunk,
  inspectImageDpiAndMetadata,
  RELEASE2_TOOL_SLUGS,
  signPdfBuffer,
} from "@/lib/release2-tools";

const VALID_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("Release 2 Core PDF & Image Tools Suite", () => {
  it("exports all 12 Release 2 tool slugs", () => {
    expect(RELEASE2_TOOL_SLUGS).toHaveLength(12);
  });

  it("extracts pages, adds page numbers, watermarks, and signs PDFs", async () => {
    const sample = await generateSamplePdfBytes("Release 2 Spec", 4);

    const extracted = await extractPdfPagesBuffer(sample, "2-3");
    expect(extracted.ok).toBe(true);
    expect(extracted.extractedCount).toBe(2);

    const numbered = await addPageNumbersToPdfBuffer(sample, {
      position: "bottom-center",
      format: "page-of-total",
      startNumber: 1,
      fontSize: 11,
      marginPoints: 28,
    });
    expect(numbered.ok).toBe(true);
    expect(numbered.pageCount).toBe(4);

    const watermarked = await addWatermarkToPdfBuffer(sample, {
      text: "INTERNAL DRAFT",
      fontSize: 40,
      opacity: 0.2,
      rotationDegrees: -45,
      colorHex: "#dc2626",
      placement: "center",
    });
    expect(watermarked.ok).toBe(true);

    const signed = await signPdfBuffer(sample, VALID_1X1_PNG, "image/png", {
      pageTarget: "last",
      position: "bottom-right",
      widthPoints: 160,
      signerName: "QA Lead",
      includeDateStamp: true,
    });
    expect(signed.ok).toBe(true);
  });

  it("compares two PDFs page by page", async () => {
    const { pdfA, pdfB } = await generateSampleComparisonPdfPair();
    const res = await comparePdfBuffers(pdfA, pdfB);
    expect(res.ok).toBe(true);
    expect(res.pageCountA).toBe(2);
    expect(res.modifiedPagesCount).toBe(1);
    expect(res.identicalPagesCount).toBe(1);
  });

  it("processes image crop geometry, 300-DPI pHYs headers, Base64, color palettes, and ZIP archives", () => {
    const crop = computeCropBox(800, 600, {
      x: 50,
      y: 50,
      width: 400,
      height: 400,
      aspectPreset: "1:1",
    });
    expect(crop.width).toBe(crop.height);

    const dpiPng = injectPngPhysDpiChunk(VALID_1X1_PNG, 300);
    const dpiInfo = inspectImageDpiAndMetadata(dpiPng, 1500, 1200);
    expect(dpiInfo.embeddedDpiX).toBe(300);
    expect(dpiInfo.aspectRatioLabel).toBe("5:4");

    const b64 = encodeImageBytesToBase64Snippets(VALID_1X1_PNG, "image/png", "Logo");
    expect(b64.dataUrl).toContain("data:image/png;base64,");

    const rgba = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255]);
    const palette = extractDominantColorsFromRgba(rgba, 4);
    expect(palette[0]?.hex).toBe("#FF0000");

    const renamed = generateBulkRenamedFilenames(["Photo A.png", "Photo B.jpg"], {
      pattern: "{name}-{index}",
      prefix: "",
      suffix: "",
      startIndex: 1,
      padDigits: 2,
      dateStamp: "2026-10-27",
      caseStyle: "kebab",
    });
    expect(renamed[0]?.newName).toBe("photo-a-01.png");

    const zip = buildZipArchive([{ filename: "photo-a-01.png", bytes: VALID_1X1_PNG }]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});
