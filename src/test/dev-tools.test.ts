import { describe, expect, it } from "vitest";
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
} from "@/lib/dev-tools";

describe("Phase C — Developer Tools", () => {
  it("formats and validates JSON accurately", () => {
    expect(formatJson("").ok).toBe(false);
    expect(formatJson("{invalid}").ok).toBe(false);
    const formatted = formatJson('{"b":2,"a":1}', { indent: 2, sortKeys: true });
    expect(formatted.ok).toBe(true);
    expect(formatted.output).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("encodes and decodes UTF-8 Base64 and rejects invalid input", () => {
    const encoded = encodeBase64Text("Hello UtilityDock ✓");
    expect(encoded.ok).toBe(true);
    const decoded = decodeBase64Text(encoded.output);
    expect(decoded.ok).toBe(true);
    expect(decoded.output).toBe("Hello UtilityDock ✓");
    expect(decodeBase64Text("@@@invalid@@@").ok).toBe(false);
  });

  it("encodes and decodes URL strings and handles malformed percent sequences", () => {
    const enc = encodeUrlText("a b&c=d", "component");
    expect(enc.ok).toBe(true);
    expect(enc.output).toBe("a%20b%26c%3Dd");
    expect(decodeUrlText(enc.output, "component").output).toBe("a b&c=d");
    expect(decodeUrlText("%E0%A4%A", "component").ok).toBe(false);
  });

  it("converts Unix timestamps in seconds and milliseconds", () => {
    const res = parseUnixTimestamp("1793059200", "seconds");
    expect(res.ok).toBe(true);
    expect(res.iso8601).toBe("2026-10-27T00:00:00.000Z");

    const fromDate = dateInputToUnix("2026-10-27T00:00:00", "utc");
    expect(fromDate.ok).toBe(true);
    expect(fromDate.unixSeconds).toBe(1793059200);
  });

  it("generates cryptographic v4 UUIDs within valid bounds", () => {
    expect(generateUuids(0).ok).toBe(false);
    expect(generateUuids(501).ok).toBe(false);
    const res = generateUuids(5, { uppercase: true });
    expect(res.ok).toBe(true);
    expect(res.uuids).toHaveLength(5);
    expect(res.uuids[0]).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/,
    );
  });

  it("computes line-by-line LCS diffs with added, removed, and unchanged counts", () => {
    const diff = computeLineDiff("line 1\nline 2", "line 1\nline 2 modified\nline 3");
    expect(diff.unchanged).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(2);
  });
});
