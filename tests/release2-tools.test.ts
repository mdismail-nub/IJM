import test from "node:test";
import assert from "node:assert/strict";
import { generateSamplePdfBytes, inspectPdfBytes } from "../src/lib/file-tools";
import {
  addPageNumbersToPdfBuffer,
  addWatermarkToPdfBuffer,
  buildZipArchive,
  comparePdfBuffers,
  computeCrc32,
  computeCropBox,
  encodeImageBytesToBase64Snippets,
  extractDominantColorsFromRgba,
  extractPdfPagesBuffer,
  formatPageNumberLabel,
  generateBulkRenamedFilenames,
  generateSampleComparisonPdfPair,
  injectPngPhysDpiChunk,
  inspectImageDpiAndMetadata,
  isRelease2ToolSlug,
  parseHexColorToRgb01,
  RELEASE2_TOOL_SLUGS,
  signPdfBuffer,
} from "../src/lib/release2-tools";

// 1x1 valid transparent PNG bytes for testing signature embedding & DPI injection
const VALID_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

test("Release 2 slug registry identifies all 12 new PDF and Image tools", () => {
  assert.equal(RELEASE2_TOOL_SLUGS.length, 12);
  for (const slug of RELEASE2_TOOL_SLUGS) {
    assert.equal(isRelease2ToolSlug(slug), true);
  }
  assert.equal(isRelease2ToolSlug("merge-pdfs"), false);
});

test("extractPdfPagesBuffer extracts selected pages into a single new PDF", async () => {
  const sample5p = await generateSamplePdfBytes("Five Page Report", 5);
  const res = await extractPdfPagesBuffer(sample5p, "1, 3, 5");
  assert.equal(res.ok, true);
  assert.equal(res.extractedCount, 3);
  assert.deepEqual(res.selectedPages, [1, 3, 5]);
  assert.ok(res.bytes && res.bytes.byteLength > 100);

  const inspected = await inspectPdfBytes(res.bytes!);
  assert.equal(inspected.ok, true);
  assert.equal(inspected.pageCount, 3);

  const badRange = await extractPdfPagesBuffer(sample5p, "9-12");
  assert.equal(badRange.ok, false);
  assert.ok(badRange.error?.includes("out of bounds"));
});

test("addPageNumbersToPdfBuffer formats labels and stamps all PDF pages", async () => {
  assert.equal(formatPageNumberLabel(1, 5, "page-of-total"), "Page 1 of 5");
  assert.equal(formatPageNumberLabel(2, 5, "slash"), "2 / 5");
  assert.equal(formatPageNumberLabel(3, 5, "dash"), "— 3 —");
  assert.equal(formatPageNumberLabel(4, 5, "number-only"), "4");

  const sample3p = await generateSamplePdfBytes("Numbered Doc", 3);
  const res = await addPageNumbersToPdfBuffer(sample3p, {
    position: "bottom-right",
    format: "page-of-total",
    startNumber: 1,
    fontSize: 11,
    marginPoints: 28,
  });
  assert.equal(res.ok, true);
  assert.equal(res.pageCount, 3);
  assert.ok(res.bytes && res.bytes.byteLength > sample3p.byteLength);
});

test("addWatermarkToPdfBuffer validates text and stamps single or tiled watermarks", async () => {
  const rgbColor = parseHexColorToRgb01("#ff0000");
  assert.equal(rgbColor.r, 1);
  assert.equal(rgbColor.g, 0);
  assert.equal(rgbColor.b, 0);

  const sample2p = await generateSamplePdfBytes("Watermark Test", 2);
  const emptyRes = await addWatermarkToPdfBuffer(sample2p, {
    text: "   ",
    fontSize: 40,
    opacity: 0.25,
    rotationDegrees: -45,
    colorHex: "#dc2626",
    placement: "center",
  });
  assert.equal(emptyRes.ok, false);

  const tiledRes = await addWatermarkToPdfBuffer(sample2p, {
    text: "CONFIDENTIAL",
    fontSize: 44,
    opacity: 0.2,
    rotationDegrees: -35,
    colorHex: "#dc2626",
    placement: "diagonal-tiled",
  });
  assert.equal(tiledRes.ok, true);
  assert.equal(tiledRes.pageCount, 2);
  assert.ok(tiledRes.bytes && tiledRes.bytes.byteLength > sample2p.byteLength);
});

test("signPdfBuffer embeds PNG signature onto target pages and validates custom page bounds", async () => {
  const sample2p = await generateSamplePdfBytes("NDA Contract", 2);
  const res = await signPdfBuffer(sample2p, VALID_1X1_PNG, "image/png", {
    pageTarget: "last",
    position: "bottom-right",
    widthPoints: 160,
    signerName: "Alex Morgan",
    includeDateStamp: true,
    dateText: "2026-10-27",
  });
  assert.equal(res.ok, true);
  assert.equal(res.pageCount, 2);
  assert.ok(res.bytes && res.bytes.byteLength > sample2p.byteLength);

  const outOfBounds = await signPdfBuffer(sample2p, VALID_1X1_PNG, "image/png", {
    pageTarget: "custom",
    customPageNumber: 9,
    position: "bottom-left",
    widthPoints: 150,
  });
  assert.equal(outOfBounds.ok, false);
  assert.ok(outOfBounds.error?.includes("out of bounds"));
});

test("comparePdfBuffers extracts page text and detects line-level additions and removals", async () => {
  const { pdfA, pdfB } = await generateSampleComparisonPdfPair();
  const diff = await comparePdfBuffers(pdfA, pdfB);
  assert.equal(diff.ok, true);
  assert.equal(diff.pageCountA, 2);
  assert.equal(diff.pageCountB, 2);
  assert.equal(diff.pages[0]?.status, "modified");
  assert.equal(diff.pages[1]?.status, "identical");
  assert.ok(diff.totalAddedLines > 0);
  assert.ok(diff.totalRemovedLines > 0);
  assert.ok(diff.similarityPercent > 0 && diff.similarityPercent < 100);
});

test("computeCropBox enforces aspect ratio presets and clamps within source bounds", () => {
  const square = computeCropBox(1000, 600, {
    x: 100,
    y: 50,
    width: 800,
    height: 800,
    aspectPreset: "1:1",
  });
  assert.equal(square.width, square.height);
  assert.ok(square.x + square.width <= 1000);
  assert.ok(square.y + square.height <= 600);

  const wide = computeCropBox(1920, 1080, {
    x: 0,
    y: 0,
    width: 1600,
    height: 900,
    aspectPreset: "16:9",
  });
  assert.equal(wide.width, 1600);
  assert.equal(wide.height, 900);
});

test("injectPngPhysDpiChunk and inspectImageDpiAndMetadata read embedded 300 DPI PNG headers", () => {
  const pngWith300Dpi = injectPngPhysDpiChunk(VALID_1X1_PNG, 300);
  const report = inspectImageDpiAndMetadata(pngWith300Dpi, 1200, 900);
  assert.equal(report.detectedFormat, "PNG");
  assert.equal(report.embeddedDpiX, 300);
  assert.equal(report.embeddedDpiY, 300);
  assert.equal(report.aspectRatioLabel, "4:3");
  assert.equal(report.megapixels, 1.08);
  const row300 = report.printSizes.find((r) => r.dpi === 300);
  assert.ok(row300);
  assert.equal(row300.widthInches, 4);
  assert.equal(row300.heightInches, 3);
});

test("encodeImageBytesToBase64Snippets produces valid Data URL, HTML img, and CSS snippets", () => {
  const snippets = encodeImageBytesToBase64Snippets(VALID_1X1_PNG, "image/png", "Test Icon");
  assert.ok(snippets.dataUrl.startsWith("data:image/png;base64,iVBORw0KGgo"));
  assert.ok(snippets.htmlImgTag.includes('alt="Test Icon"'));
  assert.ok(snippets.cssBackground.includes("background-image: url("));
  assert.equal(snippets.originalBytes, VALID_1X1_PNG.byteLength);
});

test("extractDominantColorsFromRgba quantizes pixels and returns sorted dominant HEX swatches", () => {
  // 10 pixels: 7 neon lime (#D6F538) + 3 dark ink (#111113)
  const rgba = new Uint8Array(10 * 4);
  for (let i = 0; i < 7; i++) {
    rgba[i * 4] = 0xd6;
    rgba[i * 4 + 1] = 0xf5;
    rgba[i * 4 + 2] = 0x38;
    rgba[i * 4 + 3] = 255;
  }
  for (let i = 7; i < 10; i++) {
    rgba[i * 4] = 0x11;
    rgba[i * 4 + 1] = 0x11;
    rgba[i * 4 + 2] = 0x13;
    rgba[i * 4 + 3] = 255;
  }

  const swatches = extractDominantColorsFromRgba(rgba, 5);
  assert.equal(swatches.length, 2);
  assert.equal(swatches[0]?.hex, "#D6F538");
  assert.equal(swatches[0]?.percentage, 70);
  assert.equal(swatches[1]?.hex, "#111113");
  assert.equal(swatches[1]?.percentage, 30);
});

test("generateBulkRenamedFilenames and buildZipArchive create collision-free names and valid PKZIP bytes", () => {
  const pairs = generateBulkRenamedFilenames(
    ["Hero Shot 01.PNG", "Hero Shot 01.PNG", "Team Photo.jpg"],
    {
      pattern: "asset-{index}-{name}",
      prefix: "web-",
      suffix: "-v2",
      startIndex: 1,
      padDigits: 2,
      dateStamp: "2026-10-27",
      caseStyle: "kebab",
    },
  );
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0]?.newName, "web-asset-01-hero-shot-01-v2.png");
  assert.equal(pairs[1]?.newName, "web-asset-02-hero-shot-01-v2.png");
  assert.equal(pairs[2]?.newName, "web-asset-03-team-photo-v2.jpg");

  const zipBytes = buildZipArchive([
    { filename: pairs[0]!.newName, bytes: VALID_1X1_PNG },
    { filename: pairs[2]!.newName, bytes: VALID_1X1_PNG },
  ]);
  // Verify PKZIP Local File Header signature 0x04034b50 ('PK\x03\x04')
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);
  assert.ok(computeCrc32(VALID_1X1_PNG) > 0);
});
