import test from "node:test";
import assert from "node:assert/strict";
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
} from "../src/lib/data-tools";

test("parseCsv & serializeCsv: handles RFC-4180 quotes, commas, newlines, escaped quotes, and catches unclosed quotes", () => {
  assert.equal(parseCsv("   ").ok, false);

  const complexCsv =
    '\uFEFFName,Bio,Score\n"Ada, Countess","Line 1\nLine 2 with ""quotes""",100\nGrace,,95';
  const parsed = parseCsv(complexCsv);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.dataset.headers, ["Name", "Bio", "Score"]);
  assert.equal(parsed.dataset.rows.length, 2);
  assert.equal(parsed.dataset.rows[0]?.[0], "Ada, Countess");
  assert.equal(parsed.dataset.rows[0]?.[1], 'Line 1\nLine 2 with "quotes"');
  assert.equal(parsed.dataset.rows[1]?.[1], "");

  const roundTrip = parseCsv(serializeCsv(parsed.dataset));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.dataset, parsed.dataset);

  const unclosed = parseCsv('Name,Notes\n"Unclosed quote,123');
  assert.equal(unclosed.ok, false);
  assert.ok(unclosed.error?.includes("unclosed double-quote"));
});

test("removeDuplicateRows: removes exact and case-insensitive duplicates across all or selected columns", () => {
  const parsed = parseCsv(SAMPLE_MESSY_CSV);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.dataset.rows.length, 6);

  const deduped = removeDuplicateRows(parsed.dataset);
  assert.equal(deduped.removedCount, 1);
  assert.equal(deduped.dataset.rows.length, 5);

  const statusOnly = removeDuplicateRows(parsed.dataset, {
    keyColumns: [4],
    caseInsensitive: true,
    ignoreSurroundingWhitespace: true,
  });
  // Status values: active, ACTIVE, active, pending, "  active  ", inactive -> 3 unique (active, pending, inactive)
  assert.equal(statusOnly.dataset.rows.length, 3);
  assert.equal(statusOnly.removedCount, 3);
});

test("trimAndNormalizeColumns: trims spaces, collapses inner whitespace, and transforms casing", () => {
  const parsed = parseCsv(SAMPLE_MESSY_CSV);
  const res = trimAndNormalizeColumns(parsed.dataset, {
    columnIndices: [0],
    trimWhitespace: true,
    collapseInnerSpaces: true,
    caseMode: "title",
  });

  assert.equal(res.dataset.rows[0]?.[0], "Alice Johnson");
  assert.equal(res.dataset.rows[1]?.[0], "Bob Smith");
  assert.ok(res.modifiedCells >= 5);
});

test("standardizeDateColumn: converts valid dates and preserves unparseable cells with warnings", () => {
  const parsed = parseCsv(SAMPLE_MESSY_CSV);
  const res = standardizeDateColumn(parsed.dataset, {
    columnIndex: 2,
    targetFormat: "YYYY-MM-DD",
    sourceOrder: "DMY",
  });

  assert.equal(res.convertedCount, 5);
  assert.equal(res.skippedWarnings.length, 1);
  assert.equal(res.dataset.rows[0]?.[2], "2026-03-15");
  assert.equal(res.dataset.rows[1]?.[2], "2026-04-15");
  assert.equal(res.dataset.rows[3]?.[2], "2026-10-27");
  assert.equal(res.dataset.rows[4]?.[2], "2026-11-05");
  // Row 6 ("invalid-date-row") must remain untouched!
  assert.equal(res.dataset.rows[5]?.[2], "invalid-date-row");
});

test("splitColumnByDelimiter: splits a column by delimiter into new columns", () => {
  const parsed = parseCsv(SAMPLE_MESSY_CSV);
  const res = splitColumnByDelimiter(parsed.dataset, {
    columnIndex: 3,
    delimiter: "|",
    removeOriginal: true,
    newColumnPrefix: "Tier",
  });

  assert.equal(res.ok, true);
  assert.deepEqual(res.newColumnNames, ["Tier_1", "Tier_2"]);
  assert.equal(res.dataset.rows[0]?.[3], "Pro");
  assert.equal(res.dataset.rows[0]?.[4], "Monthly");
});

test("csvToJson & jsonToCsv: converts bidirectionally and validates input", () => {
  const csv = "name,age,active\nAda,36,true\nGrace,45,false";
  const toJ = csvToJson(csv, { inferTypes: true });
  assert.equal(toJ.ok, true);
  assert.equal(toJ.rowCount, 2);
  const parsedArr = JSON.parse(toJ.output) as Record<string, unknown>[];
  assert.equal(parsedArr[0]?.["age"], 36);
  assert.equal(parsedArr[0]?.["active"], true);

  const backToCsv = jsonToCsv(toJ.output);
  assert.equal(backToCsv.ok, true);
  assert.equal(backToCsv.output, csv);

  assert.equal(jsonToCsv("not-json").ok, false);
  assert.equal(jsonToCsv('{"not":"an array"}').ok, false);
});
