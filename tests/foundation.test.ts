import test from "node:test";
import assert from "node:assert/strict";
import { categories, getAllTools, getCategory, getToolBySlug, searchTools } from "../src/lib/tools";
import {
  formatBytes,
  getFileExtension,
  sanitizeFilename,
  validateFile,
} from "../src/lib/file-utils";

test("tool registry contains all 5 categories and 82 real tools with unique slugs and status tracking", () => {
  assert.equal(categories.length, 5);
  const all = getAllTools();
  assert.equal(all.length, 82);

  const slugs = new Set(all.map((t) => t.slug));
  assert.equal(slugs.size, all.length);

  for (const tool of all) {
    assert.ok(tool.slug.length > 0);
    assert.ok(tool.name.length > 0);
    assert.ok(tool.desc.length > 0);
    assert.ok(tool.keywords.length > 0);
    assert.equal(tool.status, "tested");
    assert.equal(getToolBySlug(tool.slug)?.name, tool.name);
  }
});

test("searchTools filters by name, category, and keywords", () => {
  const pdfTools = searchTools("merge pdf");
  assert.ok(pdfTools.some((t) => t.slug === "merge-pdfs"));

  const examTools = searchTools("examsprint");
  assert.equal(examTools.length, 1);
  assert.equal(examTools[0]?.slug, "examsprint-planner");

  const devCategoryOnly = searchTools("", "developer-tools");
  assert.equal(devCategoryOnly.length, getCategory("developer-tools").tools.length);

  const noMatch = searchTools("nonexistent-quantum-blockchain-xyz");
  assert.equal(noMatch.length, 0);
});

test("file-utils formats bytes and sanitizes filenames accurately", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatBytes(1024 * 1024 * 2.5), "2.50 MB");

  assert.equal(getFileExtension("invoice.final.PDF"), "pdf");
  assert.equal(getFileExtension("README"), "");

  assert.equal(sanitizeFilename("My Invoice #01 (2026).pdf"), "My-Invoice-01-2026-.pdf");
  assert.equal(sanitizeFilename("   ", "fallback.txt"), "fallback.txt");
});

test("validateFile enforces non-empty, max size, and allowed extensions", () => {
  const emptyRes = validateFile({ name: "empty.pdf", size: 0, type: "application/pdf" });
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.error?.includes("empty"));

  const oversizedRes = validateFile(
    { name: "huge.pdf", size: 15 * 1024 * 1024, type: "application/pdf" },
    { maxSizeBytes: 10 * 1024 * 1024 },
  );
  assert.equal(oversizedRes.valid, false);
  assert.ok(oversizedRes.error?.includes("exceeds"));

  const badExtRes = validateFile(
    { name: "script.exe", size: 1024, type: "application/octet-stream" },
    { allowedExtensions: ["pdf", "png"] },
  );
  assert.equal(badExtRes.valid, false);
  assert.ok(badExtRes.error?.includes("unsupported file type"));

  const validRes = validateFile(
    { name: "document.pdf", size: 20480, type: "application/pdf" },
    { allowedExtensions: ["pdf"], maxSizeBytes: 10 * 1024 * 1024 },
  );
  assert.equal(validRes.valid, true);
});
