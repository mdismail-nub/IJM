import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLineDiff,
  dateInputToUnix,
  decodeBase64Text,
  decodeUrlText,
  encodeBase64Text,
  encodeUrlText,
  formatJson,
  generateUuids,
  parseUnixTimestamp,
} from "../src/lib/dev-tools";

test("JSON Formatter: formats valid JSON, minifies, sorts keys, and catches empty/invalid JSON", () => {
  const emptyRes = formatJson("   ");
  assert.equal(emptyRes.ok, false);
  assert.ok(emptyRes.error?.includes("Please enter JSON"));

  const validRes = formatJson('{"z":1,"a":{"d":4,"c":3}}', {
    indent: 2,
    sortKeys: true,
  });
  assert.equal(validRes.ok, true);
  assert.equal(validRes.output, '{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "z": 1\n}');

  const minified = formatJson('{\n  "hello": "world"\n}', { minify: true });
  assert.equal(minified.ok, true);
  assert.equal(minified.output, '{"hello":"world"}');

  const invalidRes = formatJson('{"name": "UtilityDock", }');
  assert.equal(invalidRes.ok, false);
  assert.ok(invalidRes.error);
});

test("Base64 Codec: handles UTF-8 text, emojis, URL-safe mode, and rejects malformed Base64", () => {
  assert.equal(encodeBase64Text("").ok, false);
  assert.equal(decodeBase64Text("   ").ok, false);

  const original = "UtilityDock — 100% Private 🚀";
  const encoded = encodeBase64Text(original);
  assert.equal(encoded.ok, true);

  const decoded = decodeBase64Text(encoded.output);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.output, original);

  const urlSafeEncoded = encodeBase64Text("subjects?>=123", true);
  assert.equal(urlSafeEncoded.ok, true);
  assert.ok(!urlSafeEncoded.output.includes("="));
  const urlSafeDecoded = decodeBase64Text(urlSafeEncoded.output);
  assert.equal(urlSafeDecoded.ok, true);
  assert.equal(urlSafeDecoded.output, "subjects?>=123");

  const corrupted = decodeBase64Text("!!!not_base64@@@");
  assert.equal(corrupted.ok, false);
  assert.ok(corrupted.error?.includes("Invalid Base64"));
});

test("URL Encoder/Decoder: handles component vs URI modes and catches malformed percent sequences", () => {
  assert.equal(encodeUrlText("").ok, false);
  assert.equal(decodeUrlText("").ok, false);

  const query = "https://utilitydock.dev/search?q=hello world&lang=en#top";
  const compEncoded = encodeUrlText(query, "component");
  assert.equal(compEncoded.ok, true);
  assert.ok(compEncoded.output.includes("https%3A%2F%2F"));
  assert.equal(decodeUrlText(compEncoded.output, "component").output, query);

  const uriEncoded = encodeUrlText(query, "uri");
  assert.equal(uriEncoded.ok, true);
  assert.ok(uriEncoded.output.startsWith("https://utilitydock.dev/"));
  assert.ok(uriEncoded.output.includes("hello%20world"));

  const malformed = decodeUrlText("%E0%A4%A", "component");
  assert.equal(malformed.ok, false);
  assert.ok(malformed.error?.includes("Malformed URL-encoded"));
});

test("Unix Timestamp Converter: converts seconds/milliseconds and human dates with explicit timezone handling", () => {
  assert.equal(parseUnixTimestamp("").ok, false);
  assert.equal(parseUnixTimestamp("not-a-number").ok, false);

  // 2026-10-27T00:00:00.000Z = 1793059200 seconds
  const secRes = parseUnixTimestamp("1793059200", "auto", 1793059200000);
  assert.equal(secRes.ok, true);
  assert.equal(secRes.detectedUnit, "seconds");
  assert.equal(secRes.iso8601, "2026-10-27T00:00:00.000Z");
  assert.equal(secRes.unixMilliseconds, 1793059200000);
  assert.equal(secRes.relativeTime, "just now");

  const msRes = parseUnixTimestamp("1793059200000", "auto", 1793059200000);
  assert.equal(msRes.ok, true);
  assert.equal(msRes.detectedUnit, "milliseconds");
  assert.equal(msRes.unixSeconds, 1793059200);

  const fromDateUtc = dateInputToUnix("2026-10-27T00:00:00", "utc");
  assert.equal(fromDateUtc.ok, true);
  assert.equal(fromDateUtc.unixSeconds, 1793059200);

  const badDate = dateInputToUnix("not-a-valid-date", "utc");
  assert.equal(badDate.ok, false);
});

test("UUID Generator: generates valid v4 UUIDs with formatting options and enforces 1..500 bounds", () => {
  assert.equal(generateUuids(0).ok, false);
  assert.equal(generateUuids(501).ok, false);

  const batch = generateUuids(10);
  assert.equal(batch.ok, true);
  assert.equal(batch.uuids.length, 10);
  const unique = new Set(batch.uuids);
  assert.equal(unique.size, 10);

  for (const id of batch.uuids) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }

  const formatted = generateUuids(2, {
    uppercase: true,
    hyphens: false,
    braces: true,
  });
  assert.equal(formatted.ok, true);
  assert.match(formatted.uuids[0] ?? "", /^\{[0-9A-F]{32}\}$/);
});

test("Diff Checker: computes accurate LCS line diffs with whitespace and case options", () => {
  const original = "alpha\nbeta\ngamma";
  const modified = "alpha\nbeta updated\ngamma\ndelta";

  const diff = computeLineDiff(original, modified);
  assert.equal(diff.unchanged, 2);
  assert.equal(diff.removed, 1);
  assert.equal(diff.added, 2);
  assert.ok(diff.unifiedPatch.includes("- beta"));
  assert.ok(diff.unifiedPatch.includes("+ beta updated"));
  assert.ok(diff.unifiedPatch.includes("+ delta"));

  const wsDiff = computeLineDiff("hello   world", "  hello world  ", {
    ignoreWhitespace: true,
  });
  assert.equal(wsDiff.added, 0);
  assert.equal(wsDiff.removed, 0);
  assert.equal(wsDiff.unchanged, 1);
});
