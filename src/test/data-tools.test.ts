import { describe, expect, it } from "vitest";
import {
  csvToJson,
  jsonToCsv,
  parseCsv,
  removeDuplicateRows,
  SAMPLE_MESSY_CSV,
  serializeCsv,
  splitColumnByDelimiter,
  standardizeDateColumn,
  trimAndNormalizeColumns,
} from "@/lib/data-tools";

describe("Data Tools Pure Logic", () => {
  it("parses RFC-4180 CSV with quoted fields and commas accurately", () => {
    const parsed = parseCsv(SAMPLE_MESSY_CSV, ",");
    expect(parsed.ok).toBe(true);
    expect(parsed.dataset.headers).toEqual([
      "Full Name",
      "Email",
      "Signup Date",
      "Plan & Billing",
      "Status",
    ]);
    expect(parsed.dataset.rows.length).toBe(6);

    const reserialized = serializeCsv(parsed.dataset, ",");
    const reparsed = parseCsv(reserialized, ",");
    expect(reparsed.dataset.rows.length).toBe(parsed.dataset.rows.length);
  });

  it("removes duplicate rows with case-insensitive trimmed matching", () => {
    const parsed = parseCsv(SAMPLE_MESSY_CSV, ",");
    const deduped = removeDuplicateRows(parsed.dataset, {
      keyColumns: [0, 1],
      caseInsensitive: true,
      ignoreSurroundingWhitespace: true,
    });
    expect(deduped.removedCount).toBe(1);
    expect(deduped.dataset.rows.length).toBe(parsed.dataset.rows.length - 1);
  });

  it("trims whitespace and normalizes text case on selected columns", () => {
    const parsed = parseCsv(SAMPLE_MESSY_CSV, ",");
    const trimmed = trimAndNormalizeColumns(parsed.dataset, {
      columnIndices: [0],
      trimWhitespace: true,
      collapseInnerSpaces: true,
      caseMode: "title",
    });
    expect(trimmed.dataset.rows[0]?.[0]).toBe("Alice Johnson");
    expect(trimmed.dataset.rows[1]?.[0]).toBe("Bob Smith");
    expect(trimmed.modifiedCells).toBeGreaterThan(0);
  });

  it("standardizes dates and preserves invalid dates with clear warnings", () => {
    const parsed = parseCsv(SAMPLE_MESSY_CSV, ",");
    const dated = standardizeDateColumn(parsed.dataset, {
      columnIndex: 2,
      targetFormat: "YYYY-MM-DD",
      sourceOrder: "auto",
    });
    expect(dated.dataset.rows[0]?.[2]).toBe("2026-03-15");
    expect(dated.dataset.rows[1]?.[2]).toBe("2026-04-15");
    expect(dated.dataset.rows[5]?.[2]).toBe("invalid-date-row");
    expect(dated.skippedWarnings.length).toBe(1);
  });

  it("splits a column by delimiter into custom columns", () => {
    const parsed = parseCsv(SAMPLE_MESSY_CSV, ",");
    const split = splitColumnByDelimiter(parsed.dataset, {
      columnIndex: 3,
      delimiter: "|",
      removeOriginal: true,
      newColumnPrefix: "BillingPart",
    });
    expect(split.ok).toBe(true);
    expect(split.newColumnNames).toEqual(["BillingPart_1", "BillingPart_2"]);
    expect(split.dataset.rows[0]?.[3]).toBe("Pro");
    expect(split.dataset.rows[0]?.[4]).toBe("Monthly");
  });

  it("converts between CSV and JSON cleanly", () => {
    const jsonRes = csvToJson("Name,Score\nAlice,95\nBob,88", {
      inferTypes: true,
      pretty: false,
    });
    expect(jsonRes.ok).toBe(true);
    expect(JSON.parse(jsonRes.output)).toEqual([
      { Name: "Alice", Score: 95 },
      { Name: "Bob", Score: 88 },
    ]);

    const csvRes = jsonToCsv(jsonRes.output);
    expect(csvRes.ok).toBe(true);
    expect(csvRes.rowCount).toBe(2);
    expect(csvRes.output).toContain("Alice,95");
  });
});
