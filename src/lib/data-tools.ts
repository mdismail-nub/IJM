export interface CsvDataset {
  headers: string[];
  rows: string[][];
}

export interface CsvParseResult {
  ok: boolean;
  dataset: CsvDataset;
  warnings: string[];
  error?: string;
}

/**
 * RFC-4180 compliant CSV parser that handles quoted fields, commas and newlines
 * inside quotes, escaped quotes (""), UTF-8 BOM, and ragged rows.
 */
export function parseCsv(rawInput: string, delimiter = ","): CsvParseResult {
  if (!rawInput || rawInput.trim() === "") {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      warnings: [],
      error: "CSV input is empty. Please upload a .csv file or paste CSV data.",
    };
  }

  // Strip UTF-8 BOM if present
  const input = rawInput.startsWith("\uFEFF") ? rawInput.slice(1) : rawInput;
  const warnings: string[] = [];

  if (input.includes("\uFFFD")) {
    warnings.push(
      "Detected UTF-8 replacement characters (). The file may have been saved in a non-UTF-8 encoding.",
    );
  }

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"' && currentField === "") {
        inQuotes = true;
        i++;
        continue;
      }

      if (ch === delimiter) {
        currentRow.push(currentField);
        currentField = "";
        i++;
        continue;
      }

      if (ch === "\r" || ch === "\n") {
        currentRow.push(currentField);
        currentField = "";
        records.push(currentRow);
        currentRow = [];
        if (ch === "\r" && i + 1 < input.length && input[i + 1] === "\n") {
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      currentField += ch;
      i++;
    }
  }

  if (inQuotes) {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      warnings,
      error: 'Malformed CSV: encountered an unclosed double-quote ("). Please check quoted fields.',
    };
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    records.push(currentRow);
  }

  // Remove trailing completely empty line if present
  while (
    records.length > 0 &&
    records[records.length - 1]?.length === 1 &&
    records[records.length - 1]?.[0] === ""
  ) {
    records.pop();
  }

  if (records.length === 0) {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      warnings,
      error: "No CSV rows found in input.",
    };
  }

  const rawHeaders = records[0] ?? [];
  const maxCols = records.reduce((max, r) => Math.max(max, r.length), rawHeaders.length);

  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const h = rawHeaders[c]?.trim();
    headers.push(h ? h : `Column_${c + 1}`);
  }

  const dataRows: string[][] = [];
  let raggedCount = 0;

  for (let r = 1; r < records.length; r++) {
    const row = records[r] ?? [];
    if (row.length !== rawHeaders.length) {
      raggedCount++;
    }
    const normalizedRow: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      normalizedRow.push(row[c] ?? "");
    }
    dataRows.push(normalizedRow);
  }

  if (raggedCount > 0) {
    warnings.push(
      `${raggedCount} ${raggedCount === 1 ? "row had" : "rows had"} a different number of columns than the header row and were padded to ${maxCols} columns.`,
    );
  }

  return {
    ok: true,
    dataset: { headers, rows: dataRows },
    warnings,
  };
}

export function serializeCsv(dataset: CsvDataset, delimiter = ","): string {
  const escapeCell = (val: string): string => {
    const needsQuotes =
      val.includes(delimiter) ||
      val.includes('"') ||
      val.includes("\n") ||
      val.includes("\r") ||
      /^\s|\s$/.test(val);
    if (!needsQuotes) return val;
    return `"${val.replace(/"/g, '""')}"`;
  };

  const lines: string[] = [];
  if (dataset.headers.length > 0) {
    lines.push(dataset.headers.map(escapeCell).join(delimiter));
  }
  for (const row of dataset.rows) {
    lines.push(row.map((c) => escapeCell(c ?? "")).join(delimiter));
  }
  return lines.join("\n");
}

export function cloneDataset(dataset: CsvDataset): CsvDataset {
  return {
    headers: [...dataset.headers],
    rows: dataset.rows.map((r) => [...r]),
  };
}

export interface RemoveDuplicatesOptions {
  /** Column indices to check. If empty or omitted, checks all columns. */
  keyColumns?: number[];
  caseInsensitive?: boolean;
  ignoreSurroundingWhitespace?: boolean;
}

export function removeDuplicateRows(
  dataset: CsvDataset,
  options: RemoveDuplicatesOptions = {},
): {
  dataset: CsvDataset;
  removedCount: number;
  summary: string;
} {
  const indices =
    options.keyColumns && options.keyColumns.length > 0
      ? options.keyColumns
      : dataset.headers.map((_, idx) => idx);

  const seen = new Set<string>();
  const keptRows: string[][] = [];
  let removedCount = 0;

  for (const row of dataset.rows) {
    const keyParts = indices.map((colIdx) => {
      let cell = row[colIdx] ?? "";
      if (options.ignoreSurroundingWhitespace) {
        cell = cell.trim();
      }
      if (options.caseInsensitive) {
        cell = cell.toLowerCase();
      }
      return cell;
    });
    const compositeKey = JSON.stringify(keyParts);
    if (seen.has(compositeKey)) {
      removedCount++;
    } else {
      seen.add(compositeKey);
      keptRows.push([...row]);
    }
  }

  const colDesc =
    indices.length === dataset.headers.length
      ? "all columns"
      : indices.map((i) => dataset.headers[i] ?? `Col ${i + 1}`).join(", ");

  return {
    dataset: {
      headers: [...dataset.headers],
      rows: keptRows,
    },
    removedCount,
    summary: `Removed ${removedCount} duplicate ${removedCount === 1 ? "row" : "rows"} (checked ${colDesc}).`,
  };
}

export type TextCaseMode = "none" | "upper" | "lower" | "title";

export interface TrimNormalizeOptions {
  columnIndices?: number[];
  trimWhitespace: boolean;
  collapseInnerSpaces: boolean;
  caseMode: TextCaseMode;
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export function trimAndNormalizeColumns(
  dataset: CsvDataset,
  options: TrimNormalizeOptions,
): {
  dataset: CsvDataset;
  modifiedCells: number;
  summary: string;
} {
  const targetCols = new Set(
    options.columnIndices && options.columnIndices.length > 0
      ? options.columnIndices
      : dataset.headers.map((_, idx) => idx),
  );

  let modifiedCells = 0;
  const nextRows = dataset.rows.map((row) =>
    row.map((cell, colIdx) => {
      if (!targetCols.has(colIdx)) return cell;
      let updated = cell;
      if (options.trimWhitespace) {
        updated = updated.trim();
      }
      if (options.collapseInnerSpaces) {
        updated = updated.replace(/\s+/g, " ");
      }
      if (options.caseMode === "upper") {
        updated = updated.toUpperCase();
      } else if (options.caseMode === "lower") {
        updated = updated.toLowerCase();
      } else if (options.caseMode === "title") {
        updated = toTitleCase(updated);
      }
      if (updated !== cell) {
        modifiedCells++;
      }
      return updated;
    }),
  );

  return {
    dataset: {
      headers: [...dataset.headers],
      rows: nextRows,
    },
    modifiedCells,
    summary: `Trimmed/normalized ${modifiedCells} ${modifiedCells === 1 ? "cell" : "cells"} across ${targetCols.size} ${targetCols.size === 1 ? "column" : "columns"}.`,
  };
}

export type DateTargetFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type DateSourceOrder = "auto" | "YMD" | "MDY" | "DMY";

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function formatCalendarDate(
  year: number,
  month: number,
  day: number,
  target: DateTargetFormat,
): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  if (target === "DD/MM/YYYY") return `${dd}/${mm}/${yyyy}`;
  if (target === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export function parseSingleDateCell(
  raw: string,
  sourceOrder: DateSourceOrder = "auto",
): { ok: boolean; year?: number; month?: number; day?: number; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }

  // 1. ISO-like YYYY-MM-DD or YYYY/MM/DD (with optional time suffix)
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = Number.parseInt(isoMatch[1], 10);
    const m = Number.parseInt(isoMatch[2], 10);
    const d = Number.parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return { ok: true, year: y, month: m, day: d };
    }
    return { ok: false, reason: "Invalid calendar date" };
  }

  // 2. Numeric D/M/Y or M/D/Y with 4-digit year at end
  const dmyOrMdy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyOrMdy && dmyOrMdy[1] && dmyOrMdy[2] && dmyOrMdy[3]) {
    const p1 = Number.parseInt(dmyOrMdy[1], 10);
    const p2 = Number.parseInt(dmyOrMdy[2], 10);
    const y = Number.parseInt(dmyOrMdy[3], 10);

    if (sourceOrder === "MDY") {
      if (isValidCalendarDate(y, p1, p2)) {
        return { ok: true, year: y, month: p1, day: p2 };
      }
      return { ok: false, reason: "Invalid MM/DD/YYYY date" };
    }

    if (sourceOrder === "DMY") {
      if (isValidCalendarDate(y, p2, p1)) {
        return { ok: true, year: y, month: p2, day: p1 };
      }
      return { ok: false, reason: "Invalid DD/MM/YYYY date" };
    }

    // In auto mode, only convert if unambiguous (p1 > 12 or p2 > 12 or p1 === p2)
    if (p1 > 12 && p2 <= 12 && isValidCalendarDate(y, p2, p1)) {
      return { ok: true, year: y, month: p2, day: p1 };
    }
    if (p2 > 12 && p1 <= 12 && isValidCalendarDate(y, p1, p2)) {
      return { ok: true, year: y, month: p1, day: p2 };
    }
    if (p1 === p2 && isValidCalendarDate(y, p1, p2)) {
      return { ok: true, year: y, month: p1, day: p2 };
    }
    return {
      ok: false,
      reason: "Ambiguous slash date (select MM/DD/YYYY or DD/MM/YYYY source order to disambiguate)",
    };
  }

  // 3. Month name formats: "Oct 27, 2026" or "27 Oct 2026"
  const monthFirst = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst && monthFirst[1] && monthFirst[2] && monthFirst[3]) {
    const m = MONTH_NAME_MAP[monthFirst[1].toLowerCase()];
    const d = Number.parseInt(monthFirst[2], 10);
    const y = Number.parseInt(monthFirst[3], 10);
    if (m && isValidCalendarDate(y, m, d)) {
      return { ok: true, year: y, month: m, day: d };
    }
  }

  const dayFirst = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dayFirst && dayFirst[1] && dayFirst[2] && dayFirst[3]) {
    const d = Number.parseInt(dayFirst[1], 10);
    const m = MONTH_NAME_MAP[dayFirst[2].toLowerCase()];
    const y = Number.parseInt(dayFirst[3], 10);
    if (m && isValidCalendarDate(y, m, d)) {
      return { ok: true, year: y, month: m, day: d };
    }
  }

  return { ok: false, reason: "Unrecognized date format" };
}

export function standardizeDateColumn(
  dataset: CsvDataset,
  options: {
    columnIndex: number;
    targetFormat: DateTargetFormat;
    sourceOrder?: DateSourceOrder;
  },
): {
  dataset: CsvDataset;
  convertedCount: number;
  skippedWarnings: string[];
  summary: string;
} {
  const { columnIndex, targetFormat, sourceOrder = "auto" } = options;
  const colName = dataset.headers[columnIndex] ?? `Column ${columnIndex + 1}`;
  let convertedCount = 0;
  const skippedWarnings: string[] = [];

  const nextRows = dataset.rows.map((row, rIdx) => {
    const copy = [...row];
    const rawCell = copy[columnIndex] ?? "";
    if (rawCell.trim() === "") {
      return copy;
    }

    const parsed = parseSingleDateCell(rawCell, sourceOrder);
    if (
      parsed.ok &&
      parsed.year !== undefined &&
      parsed.month !== undefined &&
      parsed.day !== undefined
    ) {
      copy[columnIndex] = formatCalendarDate(parsed.year, parsed.month, parsed.day, targetFormat);
      convertedCount++;
    } else {
      // Never silently change unparseable or ambiguous values
      skippedWarnings.push(
        `Row ${rIdx + 1} ("${rawCell}"): ${parsed.reason ?? "Could not parse"} — original value preserved.`,
      );
    }
    return copy;
  });

  return {
    dataset: {
      headers: [...dataset.headers],
      rows: nextRows,
    },
    convertedCount,
    skippedWarnings,
    summary: `Standardized ${convertedCount} ${convertedCount === 1 ? "date" : "dates"} in "${colName}" to ${targetFormat}${skippedWarnings.length > 0 ? ` (${skippedWarnings.length} skipped)` : ""}.`,
  };
}

export interface SplitColumnOptions {
  columnIndex: number;
  delimiter: string;
  removeOriginal?: boolean;
  newColumnPrefix?: string;
}

export function splitColumnByDelimiter(
  dataset: CsvDataset,
  options: SplitColumnOptions,
): {
  ok: boolean;
  dataset: CsvDataset;
  newColumnNames: string[];
  summary: string;
  error?: string;
} {
  const { columnIndex, delimiter, removeOriginal = false } = options;
  if (delimiter === "") {
    return {
      ok: false,
      dataset,
      newColumnNames: [],
      summary: "",
      error: "Please specify a non-empty delimiter character or string.",
    };
  }

  const origHeader = dataset.headers[columnIndex];
  if (origHeader === undefined) {
    return {
      ok: false,
      dataset,
      newColumnNames: [],
      summary: "",
      error: "Selected column does not exist.",
    };
  }

  const splitPartsPerRow = dataset.rows.map((row) => {
    const cell = row[columnIndex] ?? "";
    return cell === "" ? [""] : cell.split(delimiter).map((part) => part.trim());
  });

  const maxParts = Math.max(
    2,
    splitPartsPerRow.reduce((m, parts) => Math.max(m, parts.length), 2),
  );

  const prefix = options.newColumnPrefix?.trim() || origHeader;
  const newColumnNames = Array.from({ length: maxParts }, (_, idx) => `${prefix}_${idx + 1}`);

  const nextHeaders = [...dataset.headers];
  if (removeOriginal) {
    nextHeaders.splice(columnIndex, 1, ...newColumnNames);
  } else {
    nextHeaders.splice(columnIndex + 1, 0, ...newColumnNames);
  }

  const nextRows = dataset.rows.map((row, rIdx) => {
    const parts = splitPartsPerRow[rIdx] ?? [];
    const padded = Array.from({ length: maxParts }, (_, idx) => parts[idx] ?? "");
    const nextRow = [...row];
    if (removeOriginal) {
      nextRow.splice(columnIndex, 1, ...padded);
    } else {
      nextRow.splice(columnIndex + 1, 0, ...padded);
    }
    return nextRow;
  });

  return {
    ok: true,
    dataset: {
      headers: nextHeaders,
      rows: nextRows,
    },
    newColumnNames,
    summary: `Split "${origHeader}" by "${delimiter}" into ${newColumnNames.length} columns (${newColumnNames.join(", ")}).`,
  };
}

export function csvToJson(
  rawCsv: string,
  options: { inferTypes?: boolean; pretty?: boolean; delimiter?: string } = {},
): { ok: boolean; output: string; rowCount: number; error?: string } {
  const parsed = parseCsv(rawCsv, options.delimiter ?? ",");
  if (!parsed.ok) {
    return {
      ok: false,
      output: "",
      rowCount: 0,
      ...(parsed.error ? { error: parsed.error } : {}),
    };
  }

  const { headers, rows } = parsed.dataset;
  const records = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const rawVal = row[idx] ?? "";
      if (!options.inferTypes) {
        obj[h] = rawVal;
      } else if (rawVal === "") {
        obj[h] = null;
      } else if (rawVal.toLowerCase() === "true") {
        obj[h] = true;
      } else if (rawVal.toLowerCase() === "false") {
        obj[h] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
        obj[h] = Number(rawVal);
      } else {
        obj[h] = rawVal;
      }
    });
    return obj;
  });

  const output = JSON.stringify(records, null, options.pretty !== false ? 2 : undefined);
  return { ok: true, output, rowCount: records.length };
}

function flattenNestedRecordForCsv(
  obj: Record<string, unknown>,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flattenNestedRecordForCsv(v as Record<string, unknown>, path, out);
    } else {
      out[path] = v;
    }
  }
  return out;
}

export function jsonToCsv(
  rawJson: string,
  options: { delimiter?: string; flattenNested?: boolean } = {},
): {
  ok: boolean;
  output: string;
  rowCount: number;
  error?: string;
} {
  if (!rawJson || rawJson.trim() === "") {
    return {
      ok: false,
      output: "",
      rowCount: 0,
      error: "Please enter a JSON array of objects to convert to CSV.",
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {
        ok: false,
        output: "",
        rowCount: 0,
        error: 'JSON input must be a non-empty array of objects (e.g. [{"name":"Ada"}]).',
      };
    }

    const normalizedItems: Record<string, unknown>[] = [];
    const headerSet = new Set<string>();
    for (const item of parsed) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        return {
          ok: false,
          output: "",
          rowCount: 0,
          error: "Every element in the JSON array must be a key-value object.",
        };
      }
      const record =
        options.flattenNested !== false
          ? flattenNestedRecordForCsv(item as Record<string, unknown>)
          : (item as Record<string, unknown>);
      normalizedItems.push(record);
      for (const key of Object.keys(record)) {
        headerSet.add(key);
      }
    }

    const headers = Array.from(headerSet);
    const rows: string[][] = normalizedItems.map((rec) => {
      return headers.map((h) => {
        const val = rec[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      });
    });

    return {
      ok: true,
      output: serializeCsv({ headers, rows }, options.delimiter ?? ","),
      rowCount: rows.length,
    };
  } catch (err) {
    return {
      ok: false,
      output: "",
      rowCount: 0,
      error: err instanceof Error ? err.message : "Invalid JSON syntax.",
    };
  }
}

export const SAMPLE_MESSY_CSV = `Full Name,Email,Signup Date,Plan & Billing,Status
"  alice johnson  ",ALICE@EXAMPLE.COM,2026-03-15,Pro | Monthly,active
"bob   smith",bob@example.com,15/04/2026,Starter | Annual,ACTIVE
"  alice johnson  ",ALICE@EXAMPLE.COM,2026-03-15,Pro | Monthly,active
"carol davis, jr.",carol@example.com,"Oct 27, 2026",Enterprise | Annual,pending
"david lee",david@example.com,2026/11/05,Pro | Monthly,  active  
"eva martinez",eva@example.com,invalid-date-row,Starter | Monthly,inactive`;
