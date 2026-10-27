import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  buildPdfFromEncodedImages,
  compressPdfBuffer,
  computeTargetDimensions,
  generateSamplePdfBytes,
  inspectPdfBytes,
  mergePdfBuffers,
  parsePageRanges,
  rotatePdfBuffer,
  splitPdfBuffer,
} from "../src/lib/file-tools";

test("parsePageRanges: handles valid ranges, single pages, 'all', and rejects invalid or out-of-bounds ranges", () => {
  const res = parsePageRanges("1-3, 5, 2", 6);
  assert.equal(res.ok, true);
  assert.deepEqual(res.flatPages, [1, 2, 3, 5]);
  assert.equal(res.ranges.length, 3);

  const allRes = parsePageRanges("all", 4);
  assert.equal(allRes.ok, true);
  assert.deepEqual(allRes.flatPages, [1, 2, 3, 4]);

  assert.equal(parsePageRanges("", 5).ok, false);
  assert.equal(parsePageRanges("0", 5).ok, false);
  assert.equal(parsePageRanges("1-7", 5).ok, false);
  assert.equal(parsePageRanges("4-2", 5).ok, false);
  assert.equal(parsePageRanges("abc", 5).ok, false);
});

test("computeTargetDimensions: scales by percentage or dimensions with aspect ratio lock and boundary checks", () => {
  const pct = computeTargetDimensions(1920, 1080, {
    mode: "percentage",
    percentage: 50,
  });
  assert.equal(pct.ok, true);
  assert.equal(pct.width, 960);
  assert.equal(pct.height, 540);

  const locked = computeTargetDimensions(1600, 800, {
    mode: "dimensions",
    targetWidth: 800,
    lockAspectRatio: true,
  });
  assert.equal(locked.ok, true);
  assert.equal(locked.width, 800);
  assert.equal(locked.height, 400);

  assert.equal(computeTargetDimensions(100, 100, { mode: "percentage", percentage: 0 }).ok, false);
  assert.equal(
    computeTargetDimensions(100, 100, { mode: "percentage", percentage: 600 }).ok,
    false,
  );
  assert.equal(
    computeTargetDimensions(100, 100, {
      mode: "dimensions",
      targetWidth: 0,
      targetHeight: 100,
    }).ok,
    false,
  );
});

test("PDF operations: merge, split, compress, rotate, and corrupt input handling", async () => {
  const pdfA = await generateSamplePdfBytes("Doc A", 2);
  const pdfB = await generateSamplePdfBytes("Doc B", 3);

  const infoA = await inspectPdfBytes(pdfA);
  assert.equal(infoA.ok, true);
  assert.equal(infoA.pageCount, 2);

  // Corrupt PDF check
  const corruptInfo = await inspectPdfBytes(new Uint8Array([1, 2, 3, 4, 5]));
  assert.equal(corruptInfo.ok, false);

  // Merge
  const merged = await mergePdfBuffers([pdfA, pdfB]);
  assert.equal(merged.ok, true);
  assert.equal(merged.totalPages, 5);
  assert.ok(merged.bytes && merged.bytes.byteLength > 0);

  // Split combined
  const splitSingle = await splitPdfBuffer(merged.bytes!, "1-2, 5", true);
  assert.equal(splitSingle.ok, true);
  assert.equal(splitSingle.outputs.length, 1);
  assert.equal(splitSingle.outputs[0]?.pageCount, 3);

  // Split separate ranges
  const splitMulti = await splitPdfBuffer(merged.bytes!, "1-2, 4-5", false);
  assert.equal(splitMulti.ok, true);
  assert.equal(splitMulti.outputs.length, 2);
  assert.equal(splitMulti.outputs[0]?.pageCount, 2);
  assert.equal(splitMulti.outputs[1]?.pageCount, 2);

  // Compress
  const compressed = await compressPdfBuffer(merged.bytes!, true);
  assert.equal(compressed.ok, true);
  assert.equal(compressed.pageCount, 5);
  assert.ok(compressed.bytes && compressed.bytes.byteLength > 0);

  // Rotate
  const rotated = await rotatePdfBuffer(pdfA, 90, "1");
  assert.equal(rotated.ok, true);
  assert.equal(rotated.rotatedCount, 1);
  const loadedRot = await PDFDocument.load(rotated.bytes!);
  assert.equal(loadedRot.getPages()[0]?.getRotation().angle, 90);
  assert.equal(loadedRot.getPages()[1]?.getRotation().angle, 0);
});

test("buildPdfFromEncodedImages: embeds PNG bytes into a multi-page PDF", async () => {
  // Valid 1x1 red pixel PNG in base64
  const base64Png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = atob(base64Png);
  const pngBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    pngBytes[i] = bin.charCodeAt(i);
  }

  const res = await buildPdfFromEncodedImages(
    [
      { name: "red-1.png", bytes: pngBytes, format: "png" },
      { name: "red-2.png", bytes: pngBytes, format: "png" },
    ],
    { pageSize: "a4", orientation: "auto", marginPoints: 20 },
  );
  assert.equal(res.ok, true);
  assert.equal(res.pageCount, 2);
  assert.ok(res.bytes && res.bytes.byteLength > 100);
});
