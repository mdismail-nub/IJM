import { parseCsv, serializeCsv, type CsvDataset } from "./data-tools";
import { buildZipArchive } from "./release2-tools";

export const RELEASE3_TOOL_SLUGS = [
  "excel-to-csv",
  "csv-column-extractor",
  "csv-delimiter-converter",
  "excel-formula-helper",
  "compare-csv-files",
  "json-to-excel",
  "markdown-to-html",
  "html-to-markdown",
  "markdown-editor",
  "citation-generator",
  "sql-formatter",
  "sql-query-builder",
  "hash-generator",
  "code-minifier",
  "css-formatter",
  "scientific-calculator",
  "equation-solver",
  "habit-tracker",
  "project-timeline-generator",
] as const;

export type Release3ToolSlug = (typeof RELEASE3_TOOL_SLUGS)[number];

export function isRelease3ToolSlug(slug: string): slug is Release3ToolSlug {
  return (RELEASE3_TOOL_SLUGS as readonly string[]).includes(slug);
}

// ============================================================================
// 1. EXCEL (.XLSX / XML / TSV) TO CSV & JSON TO EXCEL (.XLSX)
// ============================================================================

export interface SpreadsheetSheet {
  name: string;
  dataset: CsvDataset;
}

export interface ExcelParseResult {
  ok: boolean;
  sheets: SpreadsheetSheet[];
  warnings: string[];
  error?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&");
}

export function columnNumberToLetters(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function columnLettersToIndex(letters: string): number {
  let col = 0;
  const clean = letters.toUpperCase().replace(/[^A-Z]/g, "");
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return Math.max(0, col - 1);
}

/**
 * Generates a standards-compliant OpenXML (.xlsx) workbook binary archive
 * from one or more sheets so users can export JSON/CSV to real Excel files
 * or generate sample .xlsx files locally in the browser.
 */
export function generateXlsxWorkbookBytes(
  sheets: { name: string; headers: string[]; rows: (string | number | boolean | null)[][] }[],
): Uint8Array {
  const encoder = new TextEncoder();
  const safeSheets =
    sheets.length > 0 ? sheets : [{ name: "Sheet1", headers: ["Column1"], rows: [] }];

  const contentTypesOverrides = safeSheets
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypesOverrides}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookSheetsXml = safeSheets
    .map((sheet, idx) => {
      const cleanName = escapeXml(
        (sheet.name || `Sheet${idx + 1}`).replace(/[\\/?*[\]:]/g, " ").slice(0, 31),
      );
      return `<sheet name="${cleanName}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`;
    })
    .join("");

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheetsXml}</sheets>
</workbook>`;

  const workbookRelsEntries = safeSheets
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`,
    )
    .join("");

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelsEntries}
</Relationships>`;

  const entries: { filename: string; bytes: Uint8Array }[] = [
    { filename: "[Content_Types].xml", bytes: encoder.encode(contentTypesXml) },
    { filename: "_rels/.rels", bytes: encoder.encode(rootRelsXml) },
    { filename: "xl/workbook.xml", bytes: encoder.encode(workbookXml) },
    { filename: "xl/_rels/workbook.xml.rels", bytes: encoder.encode(workbookRelsXml) },
  ];

  safeSheets.forEach((sheet, sheetIdx) => {
    const allRows: (string | number | boolean | null)[][] = [sheet.headers, ...sheet.rows];

    const rowsXml = allRows
      .map((row, rIdx) => {
        const rowNum = rIdx + 1;
        const cellsXml = row
          .map((cell, cIdx) => {
            const ref = `${columnNumberToLetters(cIdx)}${rowNum}`;
            if (cell === null || cell === undefined || cell === "") {
              return `<c r="${ref}" t="inlineStr"><is><t></t></is></c>`;
            }
            if (typeof cell === "number" && Number.isFinite(cell)) {
              return `<c r="${ref}" t="n"><v>${cell}</v></c>`;
            }
            if (typeof cell === "boolean") {
              return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
            }
            const strVal = String(cell);
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(strVal)}</t></is></c>`;
          })
          .join("");
        return `<row r="${rowNum}">${cellsXml}</row>`;
      })
      .join("");

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;

    entries.push({
      filename: `xl/worksheets/sheet${sheetIdx + 1}.xml`,
      bytes: encoder.encode(sheetXml),
    });
  });

  return buildZipArchive(entries);
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    await writer.write(new Uint8Array(compressed));
    await writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
  throw new Error("Browser does not support DecompressionStream for compressed ZIP entries.");
}

async function extractZipEntries(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder("utf-8");

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, bytes.byteLength - 65557);
  for (let i = bytes.byteLength - 22; i >= minEocdSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Not a valid .xlsx ZIP archive (missing central directory).");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  for (let idx = 0; idx < totalEntries; idx++) {
    if (cdOffset + 46 > bytes.byteLength || view.getUint32(cdOffset, true) !== 0x02014b50) {
      break;
    }
    const compressionMethod = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const filename = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 > bytes.byteLength) continue;
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) continue;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      files.set(filename, rawSlice);
    } else if (compressionMethod === 8) {
      const inflated = await inflateRawBytes(rawSlice);
      files.set(filename, inflated);
    }
  }

  return files;
}

function parseSharedStringsXml(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const inner = siMatch[1] ?? "";
    const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    let combined = "";
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += unescapeXml(tMatch[1] ?? "");
    }
    strings.push(combined);
  }
  return strings;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): CsvDataset {
  const parsedRows: string[][] = [];
  let maxCols = 0;

  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1] ?? "";
    const rowCells: string[] = [];
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let fallbackColIdx = 0;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1] ?? "";
      const inner = cellMatch[2] ?? "";

      const refMatch = /\br="([A-Z]+)\d+"/i.exec(attrs);
      const colIdx = refMatch?.[1] ? columnLettersToIndex(refMatch[1]) : fallbackColIdx;
      fallbackColIdx = colIdx + 1;

      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch?.[1] ?? "n";

      let value = "";
      if (cellType === "inlineStr") {
        const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tRegex.exec(inner)) !== null) {
          value += unescapeXml(tMatch[1] ?? "");
        }
      } else {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner);
        const rawV = vMatch?.[1] ? unescapeXml(vMatch[1].trim()) : "";
        if (cellType === "s") {
          const sIdx = Number(rawV);
          value = sharedStrings[sIdx] ?? rawV;
        } else if (cellType === "b") {
          value = rawV === "1" || rawV.toLowerCase() === "true" ? "true" : "false";
        } else {
          value = rawV;
        }
      }

      while (rowCells.length <= colIdx) {
        rowCells.push("");
      }
      rowCells[colIdx] = value;
    }

    if (rowCells.some((c) => c !== "")) {
      maxCols = Math.max(maxCols, rowCells.length);
      parsedRows.push(rowCells);
    }
  }

  if (parsedRows.length === 0 || maxCols === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = parsedRows[0] ?? [];
  const headers = Array.from({ length: maxCols }, (_, i) => {
    const h = rawHeaders[i]?.trim();
    return h ? h : `Column_${i + 1}`;
  });

  const rows = parsedRows
    .slice(1)
    .map((r) => Array.from({ length: maxCols }, (_, i) => r[i] ?? ""));

  return { headers, rows };
}

/**
 * Parses an Excel (.xlsx binary archive, XML/HTML table, or TSV/CSV text) into
 * structured worksheets ready for CSV conversion.
 */
export async function parseExcelBufferToSheets(
  bytes: Uint8Array,
  filename = "workbook.xlsx",
): Promise<ExcelParseResult> {
  if (!bytes || bytes.byteLength === 0) {
    return {
      ok: false,
      sheets: [],
      warnings: [],
      error: "Uploaded file is empty.",
    };
  }

  const warnings: string[] = [];
  const isZip =
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  if (isZip) {
    try {
      const entries = await extractZipEntries(bytes);
      const decoder = new TextDecoder("utf-8");

      const sharedStringsBytes = entries.get("xl/sharedStrings.xml");
      const sharedStrings = sharedStringsBytes
        ? parseSharedStringsXml(decoder.decode(sharedStringsBytes))
        : [];

      const sheetMeta: { name: string; target: string }[] = [];
      const workbookBytes = entries.get("xl/workbook.xml");
      const relsBytes = entries.get("xl/_rels/workbook.xml.rels");

      const relMap = new Map<string, string>();
      if (relsBytes) {
        const relsXml = decoder.decode(relsBytes);
        const relRegex = /<Relationship\b[^>]*>/g;
        let m: RegExpExecArray | null;
        while ((m = relRegex.exec(relsXml)) !== null) {
          const tag = m[0];
          const id = /\bId="([^"]+)"/.exec(tag)?.[1];
          const target = /\bTarget="([^"]+)"/.exec(tag)?.[1];
          if (id && target) {
            const cleanTarget = target.startsWith("/")
              ? target.slice(1)
              : target.startsWith("xl/")
                ? target
                : `xl/${target}`;
            relMap.set(id, cleanTarget);
          }
        }
      }

      if (workbookBytes) {
        const wbXml = decoder.decode(workbookBytes);
        const sheetRegex = /<sheet\b[^>]*>/g;
        let m: RegExpExecArray | null;
        let idx = 1;
        while ((m = sheetRegex.exec(wbXml)) !== null) {
          const tag = m[0];
          const name = unescapeXml(/\bname="([^"]+)"/.exec(tag)?.[1] ?? `Sheet${idx}`);
          const rId = /\br:id="([^"]+)"/.exec(tag)?.[1];
          const target = (rId && relMap.get(rId)) || `xl/worksheets/sheet${idx}.xml`;
          sheetMeta.push({ name, target });
          idx++;
        }
      }

      if (sheetMeta.length === 0) {
        for (const key of entries.keys()) {
          if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(key)) {
            sheetMeta.push({
              name: key.replace(/^xl\/worksheets\/|\.xml$/gi, ""),
              target: key,
            });
          }
        }
      }

      const sheets: SpreadsheetSheet[] = [];
      for (const meta of sheetMeta) {
        const sheetBytes = entries.get(meta.target);
        if (!sheetBytes) continue;
        const dataset = parseWorksheetXml(decoder.decode(sheetBytes), sharedStrings);
        if (dataset.headers.length > 0) {
          sheets.push({ name: meta.name, dataset });
        }
      }

      if (sheets.length === 0) {
        return {
          ok: false,
          sheets: [],
          warnings,
          error: "No non-empty worksheet cells were found in the .xlsx workbook.",
        };
      }

      return { ok: true, sheets, warnings };
    } catch (err) {
      return {
        ok: false,
        sheets: [],
        warnings,
        error: err instanceof Error ? err.message : "Failed to parse .xlsx file.",
      };
    }
  }

  // Fallback for text-based spreadsheets (TSV, CSV, or XML/HTML .xls exports)
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text.trim() === "") {
    return {
      ok: false,
      sheets: [],
      warnings,
      error: "Spreadsheet file contains no readable text.",
    };
  }

  const delimiter = text.includes("\t") ? "\t" : ",";
  const parsed = parseCsv(text, delimiter);
  if (!parsed.ok) {
    return {
      ok: false,
      sheets: [],
      warnings: parsed.warnings,
      error: parsed.error ?? `Could not parse ${filename}.`,
    };
  }

  return {
    ok: true,
    sheets: [{ name: "Sheet1", dataset: parsed.dataset }],
    warnings: parsed.warnings,
  };
}

export function generateSampleExcelWorkbookBytes(): Uint8Array {
  return generateXlsxWorkbookBytes([
    {
      name: "Q4 Sales Orders",
      headers: ["Order ID", "Customer", "Region", "Product Tier", "Seats", "ARR ($)", "Active"],
      rows: [
        ["ORD-1041", "Acme Robotics", "North America", "Enterprise", 45, 27000, true],
        ["ORD-1042", "Nordic Cloud AB", "Europe", "Pro", 18, 6480, true],
        ["ORD-1043", "Solis Energy", "LATAM", "Starter", 8, 1440, false],
        ["ORD-1044", "Kibo Logistics", "APAC", "Enterprise", 60, 36000, true],
      ],
    },
    {
      name: "Regional Summary",
      headers: ["Region", "Total Deals", "Total ARR ($)", "Lead Owner"],
      rows: [
        ["North America", 1, 27000, "Elena Rostova"],
        ["Europe", 1, 6480, "Marcus Vance"],
        ["LATAM", 1, 1440, "Sofia Morales"],
        ["APAC", 1, 36000, "Kenji Takahashi"],
      ],
    },
  ]);
}

export function flattenJsonRecord(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, string | number | boolean | null> = {},
): Record<string, string | number | boolean | null> {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) {
      result[path] = null;
    } else if (typeof val === "number" || typeof val === "boolean" || typeof val === "string") {
      result[path] = val;
    } else if (Array.isArray(val)) {
      result[path] = JSON.stringify(val);
    } else if (typeof val === "object") {
      flattenJsonRecord(val as Record<string, unknown>, path, result);
    } else {
      result[path] = String(val);
    }
  }
  return result;
}

export function convertJsonToExcelData(
  rawJson: string,
  options: { flattenNested?: boolean; sheetName?: string } = {},
): {
  ok: boolean;
  dataset: CsvDataset;
  xlsxBytes: Uint8Array;
  rowCount: number;
  columnCount: number;
  error?: string;
} {
  if (!rawJson || rawJson.trim() === "") {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      xlsxBytes: new Uint8Array(),
      rowCount: 0,
      columnCount: 0,
      error: "Please enter a JSON array of objects to convert to Excel.",
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawJson);
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object"
        ? [parsed]
        : null;

    if (!items || items.length === 0) {
      return {
        ok: false,
        dataset: { headers: [], rows: [] },
        xlsxBytes: new Uint8Array(),
        rowCount: 0,
        columnCount: 0,
        error: "JSON must be a non-empty array of objects (or a single object).",
      };
    }

    const flatten = options.flattenNested !== false;
    const normalizedRecords: Record<string, string | number | boolean | null>[] = [];
    const headerSet = new Set<string>();

    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return {
          ok: false,
          dataset: { headers: [], rows: [] },
          xlsxBytes: new Uint8Array(),
          rowCount: 0,
          columnCount: 0,
          error: "Every element in the JSON array must be an object.",
        };
      }
      const flat = flatten
        ? flattenJsonRecord(item as Record<string, unknown>)
        : Object.fromEntries(
            Object.entries(item as Record<string, unknown>).map(([k, v]) => [
              k,
              v === null || v === undefined
                ? null
                : typeof v === "object"
                  ? JSON.stringify(v)
                  : (v as string | number | boolean),
            ]),
          );
      normalizedRecords.push(flat);
      for (const k of Object.keys(flat)) {
        headerSet.add(k);
      }
    }

    const headers = Array.from(headerSet);
    const typedRows = normalizedRecords.map((rec) =>
      headers.map((h) => (rec[h] !== undefined ? rec[h] : null)),
    );
    const stringRows = typedRows.map((row) =>
      row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
    );

    const xlsxBytes = generateXlsxWorkbookBytes([
      {
        name: options.sheetName?.trim() || "Exported Data",
        headers,
        rows: typedRows,
      },
    ]);

    return {
      ok: true,
      dataset: { headers, rows: stringRows },
      xlsxBytes,
      rowCount: stringRows.length,
      columnCount: headers.length,
    };
  } catch (err) {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      xlsxBytes: new Uint8Array(),
      rowCount: 0,
      columnCount: 0,
      error: err instanceof Error ? err.message : "Invalid JSON syntax.",
    };
  }
}

// ============================================================================
// 2. CSV COLUMN EXTRACTOR, DELIMITER CONVERTER, COMPARE CSV & EXCEL FORMULAS
// ============================================================================

export function extractCsvColumns(
  rawCsv: string,
  selectedColumnIndices: number[],
  options: { inputDelimiter?: string; outputDelimiter?: string; skipEmptyRows?: boolean } = {},
): {
  ok: boolean;
  dataset: CsvDataset;
  outputCsv: string;
  extractedCount: number;
  error?: string;
} {
  const parsed = parseCsv(rawCsv, options.inputDelimiter ?? ",");
  if (!parsed.ok) {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      outputCsv: "",
      extractedCount: 0,
      error: parsed.error,
    };
  }

  const validIndices = selectedColumnIndices.filter(
    (idx) => idx >= 0 && idx < parsed.dataset.headers.length,
  );
  if (validIndices.length === 0) {
    return {
      ok: false,
      dataset: { headers: [], rows: [] },
      outputCsv: "",
      extractedCount: 0,
      error: "Please select at least one column to extract.",
    };
  }

  const headers = validIndices.map((idx) => parsed.dataset.headers[idx] ?? `Column_${idx + 1}`);
  let rows = parsed.dataset.rows.map((row) => validIndices.map((idx) => row[idx] ?? ""));

  if (options.skipEmptyRows) {
    rows = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  }

  const dataset: CsvDataset = { headers, rows };
  return {
    ok: true,
    dataset,
    outputCsv: serializeCsv(dataset, options.outputDelimiter ?? ","),
    extractedCount: headers.length,
  };
}

export function detectCsvDelimiter(sampleText: string): "," | ";" | "\t" | "|" {
  const firstLine = sampleText.split(/\r?\n/)[0] ?? "";
  const candidates: ("," | ";" | "\t" | "|")[] = [",", ";", "\t", "|"];
  let best: "," | ";" | "\t" | "|" = ",";
  let bestCount = -1;
  for (const delim of candidates) {
    const count = firstLine.split(delim).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

export function convertCsvDelimiter(
  rawCsv: string,
  sourceDelimiter: string,
  targetDelimiter: string,
): {
  ok: boolean;
  output: string;
  rowCount: number;
  columnCount: number;
  detectedSourceDelimiter: string;
  error?: string;
} {
  const effectiveSource =
    sourceDelimiter === "auto" ? detectCsvDelimiter(rawCsv) : sourceDelimiter || ",";
  if (!targetDelimiter) {
    return {
      ok: false,
      output: "",
      rowCount: 0,
      columnCount: 0,
      detectedSourceDelimiter: effectiveSource,
      error: "Please specify a target delimiter.",
    };
  }

  const parsed = parseCsv(rawCsv, effectiveSource);
  if (!parsed.ok) {
    return {
      ok: false,
      output: "",
      rowCount: 0,
      columnCount: 0,
      detectedSourceDelimiter: effectiveSource,
      error: parsed.error,
    };
  }

  return {
    ok: true,
    output: serializeCsv(parsed.dataset, targetDelimiter),
    rowCount: parsed.dataset.rows.length,
    columnCount: parsed.dataset.headers.length,
    detectedSourceDelimiter: effectiveSource,
  };
}

export interface CsvCellDiff {
  columnHeader: string;
  beforeValue: string;
  afterValue: string;
}

export interface CsvRowComparison {
  keyLabel: string;
  status: "added" | "removed" | "modified" | "identical";
  cellDiffs: CsvCellDiff[];
  rowA?: string[];
  rowB?: string[];
}

export interface CsvComparisonResult {
  ok: boolean;
  headersA: string[];
  headersB: string[];
  addedHeaders: string[];
  removedHeaders: string[];
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  identicalCount: number;
  rowComparisons: CsvRowComparison[];
  error?: string;
}

export function compareTwoCsvFiles(
  rawCsvA: string,
  rawCsvB: string,
  options: {
    keyColumnIndex?: number | "row-index";
    ignoreCase?: boolean;
    trimCells?: boolean;
  } = {},
): CsvComparisonResult {
  const parsedA = parseCsv(rawCsvA);
  const parsedB = parseCsv(rawCsvB);

  if (!parsedA.ok || !parsedB.ok) {
    return {
      ok: false,
      headersA: [],
      headersB: [],
      addedHeaders: [],
      removedHeaders: [],
      addedCount: 0,
      removedCount: 0,
      modifiedCount: 0,
      identicalCount: 0,
      rowComparisons: [],
      error: parsedA.error ?? parsedB.error ?? "Failed to parse CSV inputs.",
    };
  }

  const headersA = parsedA.dataset.headers;
  const headersB = parsedB.dataset.headers;
  const addedHeaders = headersB.filter((h) => !headersA.includes(h));
  const removedHeaders = headersA.filter((h) => !headersB.includes(h));

  const normalize = (val: string): string => {
    let v = options.trimCells !== false ? val.trim() : val;
    if (options.ignoreCase) v = v.toLowerCase();
    return v;
  };

  const allHeaders = Array.from(new Set([...headersA, ...headersB]));
  const rowComparisons: CsvRowComparison[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;
  let identicalCount = 0;

  const keyIdx = options.keyColumnIndex === undefined ? "row-index" : options.keyColumnIndex;

  if (keyIdx === "row-index" || keyIdx < 0) {
    const maxLen = Math.max(parsedA.dataset.rows.length, parsedB.dataset.rows.length);
    for (let i = 0; i < maxLen; i++) {
      const rA = parsedA.dataset.rows[i];
      const rB = parsedB.dataset.rows[i];
      const label = `Row #${i + 1}`;
      if (!rA && rB) {
        addedCount++;
        rowComparisons.push({ keyLabel: label, status: "added", cellDiffs: [], rowB: rB });
      } else if (rA && !rB) {
        removedCount++;
        rowComparisons.push({ keyLabel: label, status: "removed", cellDiffs: [], rowA: rA });
      } else if (rA && rB) {
        const diffs: CsvCellDiff[] = [];
        for (const h of allHeaders) {
          const idxA = headersA.indexOf(h);
          const idxB = headersB.indexOf(h);
          const valA = idxA >= 0 ? (rA[idxA] ?? "") : "";
          const valB = idxB >= 0 ? (rB[idxB] ?? "") : "";
          if (normalize(valA) !== normalize(valB)) {
            diffs.push({ columnHeader: h, beforeValue: valA, afterValue: valB });
          }
        }
        if (diffs.length > 0) {
          modifiedCount++;
          rowComparisons.push({
            keyLabel: label,
            status: "modified",
            cellDiffs: diffs,
            rowA: rA,
            rowB: rB,
          });
        } else {
          identicalCount++;
          rowComparisons.push({
            keyLabel: label,
            status: "identical",
            cellDiffs: [],
            rowA: rA,
            rowB: rB,
          });
        }
      }
    }
  } else {
    const keyHeader = headersA[keyIdx] ?? headersB[keyIdx] ?? headersA[0] ?? "Key";
    const keyIdxB = Math.max(0, headersB.indexOf(keyHeader));

    const mapA = new Map<string, string[]>();
    const mapB = new Map<string, string[]>();
    const orderedKeys: string[] = [];

    parsedA.dataset.rows.forEach((r, idx) => {
      const k = (r[keyIdx] ?? "").trim() || `Row_${idx + 1}`;
      mapA.set(k, r);
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });
    parsedB.dataset.rows.forEach((r, idx) => {
      const k = (r[keyIdxB] ?? "").trim() || `Row_${idx + 1}`;
      mapB.set(k, r);
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    });

    for (const k of orderedKeys) {
      const rA = mapA.get(k);
      const rB = mapB.get(k);
      if (!rA && rB) {
        addedCount++;
        rowComparisons.push({ keyLabel: k, status: "added", cellDiffs: [], rowB: rB });
      } else if (rA && !rB) {
        removedCount++;
        rowComparisons.push({ keyLabel: k, status: "removed", cellDiffs: [], rowA: rA });
      } else if (rA && rB) {
        const diffs: CsvCellDiff[] = [];
        for (const h of allHeaders) {
          const idxA = headersA.indexOf(h);
          const idxB = headersB.indexOf(h);
          const valA = idxA >= 0 ? (rA[idxA] ?? "") : "";
          const valB = idxB >= 0 ? (rB[idxB] ?? "") : "";
          if (normalize(valA) !== normalize(valB)) {
            diffs.push({ columnHeader: h, beforeValue: valA, afterValue: valB });
          }
        }
        if (diffs.length > 0) {
          modifiedCount++;
          rowComparisons.push({
            keyLabel: k,
            status: "modified",
            cellDiffs: diffs,
            rowA: rA,
            rowB: rB,
          });
        } else {
          identicalCount++;
          rowComparisons.push({
            keyLabel: k,
            status: "identical",
            cellDiffs: [],
            rowA: rA,
            rowB: rB,
          });
        }
      }
    }
  }

  return {
    ok: true,
    headersA,
    headersB,
    addedHeaders,
    removedHeaders,
    addedCount,
    removedCount,
    modifiedCount,
    identicalCount,
    rowComparisons,
  };
}

export type ExcelFormulaId =
  | "xlookup"
  | "vlookup"
  | "index-match"
  | "sumifs"
  | "countifs"
  | "if-condition"
  | "textjoin"
  | "datedif"
  | "pmt-loan"
  | "percentage-change";

export interface ExcelFormulaSpec {
  id: ExcelFormulaId;
  name: string;
  category: "Lookup & Reference" | "Conditional Math" | "Logic & Text" | "Date & Finance";
  summary: string;
  paramLabels: { key: string; label: string; defaultValue: string; placeholder: string }[];
}

export const EXCEL_FORMULA_CATALOG: ExcelFormulaSpec[] = [
  {
    id: "xlookup",
    name: "XLOOKUP (Modern Lookup)",
    category: "Lookup & Reference",
    summary: "Search a range or column for a key and return the matching item from another column.",
    paramLabels: [
      { key: "lookupVal", label: "Lookup Value Cell", defaultValue: "A2", placeholder: "A2" },
      {
        key: "lookupArr",
        label: "Lookup Column/Range",
        defaultValue: "B2:B500",
        placeholder: "B2:B500",
      },
      {
        key: "returnArr",
        label: "Return Column/Range",
        defaultValue: "E2:E500",
        placeholder: "E2:E500",
      },
      {
        key: "notFound",
        label: "Fallback Text if Missing",
        defaultValue: "Not Found",
        placeholder: "Not Found",
      },
    ],
  },
  {
    id: "vlookup",
    name: "VLOOKUP (Classic Vertical Lookup)",
    category: "Lookup & Reference",
    summary:
      "Find a value in the leftmost column of a table and return a value in the same row from a specified column number.",
    paramLabels: [
      { key: "lookupVal", label: "Lookup Value Cell", defaultValue: "A2", placeholder: "A2" },
      {
        key: "tableArr",
        label: "Table Range",
        defaultValue: "$B$2:$F$500",
        placeholder: "$B$2:$F$500",
      },
      {
        key: "colIndex",
        label: "Column Index Number (1, 2, 3...)",
        defaultValue: "3",
        placeholder: "3",
      },
    ],
  },
  {
    id: "index-match",
    name: "INDEX + MATCH (Two-Way / Left Lookup)",
    category: "Lookup & Reference",
    summary:
      "Flexible lookup that works even when the return column is to the left of the lookup column.",
    paramLabels: [
      { key: "returnArr", label: "Return Range", defaultValue: "C2:C500", placeholder: "C2:C500" },
      { key: "lookupVal", label: "Lookup Value Cell", defaultValue: "A2", placeholder: "A2" },
      { key: "lookupArr", label: "Lookup Range", defaultValue: "D2:D500", placeholder: "D2:D500" },
    ],
  },
  {
    id: "sumifs",
    name: "SUMIFS (Multi-Condition Sum)",
    category: "Conditional Math",
    summary: "Sum numeric cells that meet one or more criteria across corresponding columns.",
    paramLabels: [
      { key: "sumRange", label: "Range to Sum", defaultValue: "D2:D500", placeholder: "D2:D500" },
      {
        key: "critRange1",
        label: "Criteria Range 1",
        defaultValue: "B2:B500",
        placeholder: "B2:B500",
      },
      {
        key: "crit1",
        label: "Criteria 1 Value",
        defaultValue: '"Enterprise"',
        placeholder: '"Enterprise"',
      },
      {
        key: "critRange2",
        label: "Criteria Range 2 (Optional)",
        defaultValue: "C2:C500",
        placeholder: "C2:C500",
      },
      {
        key: "crit2",
        label: "Criteria 2 Value (Optional)",
        defaultValue: '">1000"',
        placeholder: '">1000"',
      },
    ],
  },
  {
    id: "countifs",
    name: "COUNTIFS (Multi-Condition Count)",
    category: "Conditional Math",
    summary: "Count the number of rows that match one or more criteria.",
    paramLabels: [
      {
        key: "critRange1",
        label: "Criteria Range 1",
        defaultValue: "B2:B500",
        placeholder: "B2:B500",
      },
      {
        key: "crit1",
        label: "Criteria 1 Value",
        defaultValue: '"Active"',
        placeholder: '"Active"',
      },
      {
        key: "critRange2",
        label: "Criteria Range 2 (Optional)",
        defaultValue: "",
        placeholder: "C2:C500",
      },
      {
        key: "crit2",
        label: "Criteria 2 Value (Optional)",
        defaultValue: "",
        placeholder: '">=50"',
      },
    ],
  },
  {
    id: "if-condition",
    name: "IF (Conditional Branch)",
    category: "Logic & Text",
    summary: "Evaluate a condition and return one value if TRUE and another if FALSE.",
    paramLabels: [
      {
        key: "condition",
        label: "Logical Condition",
        defaultValue: "C2>=70",
        placeholder: "C2>=70",
      },
      { key: "whenTrue", label: "Value if TRUE", defaultValue: '"Pass"', placeholder: '"Pass"' },
      {
        key: "whenFalse",
        label: "Value if FALSE",
        defaultValue: '"Review"',
        placeholder: '"Review"',
      },
    ],
  },
  {
    id: "textjoin",
    name: "TEXTJOIN (Combine Cells with Delimiter)",
    category: "Logic & Text",
    summary:
      "Join multiple text cells together with a separator while optionally skipping blank cells.",
    paramLabels: [
      { key: "delimiter", label: "Delimiter Text", defaultValue: ", ", placeholder: ", " },
      { key: "range", label: "Range to Join", defaultValue: "A2:D2", placeholder: "A2:D2" },
    ],
  },
  {
    id: "datedif",
    name: "DATEDIF (Difference Between Dates)",
    category: "Date & Finance",
    summary: "Calculate the number of complete days, months, or years between two dates.",
    paramLabels: [
      { key: "startDate", label: "Start Date Cell", defaultValue: "A2", placeholder: "A2" },
      { key: "endDate", label: "End Date Cell", defaultValue: "B2", placeholder: "B2" },
      {
        key: "unit",
        label: "Unit (D = Days, M = Months, Y = Years)",
        defaultValue: "D",
        placeholder: "D",
      },
    ],
  },
  {
    id: "pmt-loan",
    name: "PMT (Monthly Loan Payment)",
    category: "Date & Finance",
    summary:
      "Calculate fixed monthly loan payment from annual interest rate, total months, and principal.",
    paramLabels: [
      {
        key: "annualRateCell",
        label: "Annual Rate Cell (e.g. 6.5%)",
        defaultValue: "B1",
        placeholder: "B1",
      },
      { key: "monthsCell", label: "Tenure in Months Cell", defaultValue: "B2", placeholder: "B2" },
      { key: "principalCell", label: "Loan Principal Cell", defaultValue: "B3", placeholder: "B3" },
    ],
  },
  {
    id: "percentage-change",
    name: "Percentage Growth / Change",
    category: "Conditional Math",
    summary: "Compute percentage increase or decrease from an old value to a new value safely.",
    paramLabels: [
      {
        key: "oldCell",
        label: "Previous / Baseline Value Cell",
        defaultValue: "B2",
        placeholder: "B2",
      },
      { key: "newCell", label: "New / Current Value Cell", defaultValue: "C2", placeholder: "C2" },
    ],
  },
];

export function buildExcelFormula(
  formulaId: ExcelFormulaId,
  params: Record<string, string>,
  options: { wrapIfError?: boolean; ifErrorFallback?: string; argSeparator?: "," | ";" } = {},
): {
  formula: string;
  explanation: string;
  pitfalls: string[];
} {
  const sep = options.argSeparator ?? ",";
  let core = "";
  let explanation = "";
  let pitfalls: string[] = [];

  switch (formulaId) {
    case "xlookup": {
      const lv = params.lookupVal || "A2";
      const la = params.lookupArr || "B2:B500";
      const ra = params.returnArr || "E2:E500";
      const nf = params.notFound ? `"${params.notFound.replace(/^"|"$/g, "")}"` : '""';
      core = `XLOOKUP(${lv}${sep} ${la}${sep} ${ra}${sep} ${nf}${sep} 0)`;
      explanation = `Searches for ${lv} inside ${la} using exact match (0) and returns the corresponding row from ${ra}, or ${nf} if no match exists.`;
      pitfalls = [
        "Ensure Lookup Range and Return Range have the exact same start and end row numbers.",
        "Available in Excel 2021+, Microsoft 365, and Google Sheets.",
      ];
      break;
    }
    case "vlookup": {
      const lv = params.lookupVal || "A2";
      const ta = params.tableArr || "$B$2:$F$500";
      const ci = params.colIndex || "2";
      core = `VLOOKUP(${lv}${sep} ${ta}${sep} ${ci}${sep} FALSE)`;
      explanation = `Looks for ${lv} in the first column of ${ta} and returns the value in column #${ci} of that range using exact match (FALSE).`;
      pitfalls = [
        "Lock your table range with $ signs (e.g. $B$2:$F$500) before dragging the formula down.",
        "VLOOKUP cannot look to the left of the first column in the table range.",
      ];
      break;
    }
    case "index-match": {
      const ra = params.returnArr || "C2:C500";
      const lv = params.lookupVal || "A2";
      const la = params.lookupArr || "D2:D500";
      core = `INDEX(${ra}${sep} MATCH(${lv}${sep} ${la}${sep} 0))`;
      explanation = `MATCH finds the exact row position of ${lv} inside ${la}, and INDEX retrieves the value at that same row position from ${ra}.`;
      pitfalls = [
        "Always pass 0 as the third argument to MATCH for an exact match.",
        "Keep both ranges aligned to the same starting and ending rows.",
      ];
      break;
    }
    case "sumifs": {
      const sr = params.sumRange || "D2:D500";
      const cr1 = params.critRange1 || "B2:B500";
      const c1 = params.crit1 || '"Enterprise"';
      const cr2 = params.critRange2?.trim();
      const c2 = params.crit2?.trim();
      core =
        cr2 && c2
          ? `SUMIFS(${sr}${sep} ${cr1}${sep} ${c1}${sep} ${cr2}${sep} ${c2})`
          : `SUMIFS(${sr}${sep} ${cr1}${sep} ${c1})`;
      explanation = `Sums values in ${sr} where ${cr1} matches ${c1}${cr2 && c2 ? ` AND ${cr2} matches ${c2}` : ""}.`;
      pitfalls = [
        "Unlike SUMIF, SUMIFS places the sum_range FIRST, followed by criteria pairs.",
        'Wrap comparison operators in quotes, such as ">1000".',
      ];
      break;
    }
    case "countifs": {
      const cr1 = params.critRange1 || "B2:B500";
      const c1 = params.crit1 || '"Active"';
      const cr2 = params.critRange2?.trim();
      const c2 = params.crit2?.trim();
      core =
        cr2 && c2
          ? `COUNTIFS(${cr1}${sep} ${c1}${sep} ${cr2}${sep} ${c2})`
          : `COUNTIFS(${cr1}${sep} ${c1})`;
      explanation = `Counts rows where ${cr1} matches ${c1}${cr2 && c2 ? ` and ${cr2} matches ${c2}` : ""}.`;
      pitfalls = ["All criteria ranges must have identical dimensions."];
      break;
    }
    case "if-condition": {
      const cond = params.condition || "C2>=70";
      const wt = params.whenTrue || '"Pass"';
      const wf = params.whenFalse || '"Review"';
      core = `IF(${cond}${sep} ${wt}${sep} ${wf})`;
      explanation = `Evaluates ${cond}; outputs ${wt} when true, and ${wf} when false.`;
      pitfalls = ["Wrap text outputs in double quotes; leave numbers unquoted."];
      break;
    }
    case "textjoin": {
      const delim = `"${(params.delimiter ?? ", ").replace(/"/g, '""')}"`;
      const rng = params.range || "A2:D2";
      core = `TEXTJOIN(${delim}${sep} TRUE${sep} ${rng})`;
      explanation = `Concatenates all non-empty cells in ${rng} separated by ${delim}.`;
      pitfalls = [
        "Setting the 2nd argument to TRUE prevents extra delimiters when cells are blank.",
      ];
      break;
    }
    case "datedif": {
      const sd = params.startDate || "A2";
      const ed = params.endDate || "B2";
      const unit = `"${(params.unit || "D").replace(/"/g, "").toUpperCase()}"`;
      core = `DATEDIF(${sd}${sep} ${ed}${sep} ${unit})`;
      explanation = `Calculates elapsed ${unit} between start date ${sd} and end date ${ed}.`;
      pitfalls = [
        "Start date must be earlier than or equal to End date, otherwise #NUM! is returned.",
      ];
      break;
    }
    case "pmt-loan": {
      const rate = params.annualRateCell || "B1";
      const months = params.monthsCell || "B2";
      const pv = params.principalCell || "B3";
      core = `-PMT(${rate}/12${sep} ${months}${sep} ${pv})`;
      explanation = `Calculates positive monthly payment by dividing annual rate ${rate} by 12 across ${months} months for principal ${pv}.`;
      pitfalls = [
        "PMT returns a negative cash-outflow number by default; prefixing with - makes it positive.",
      ];
      break;
    }
    case "percentage-change": {
      const oldCell = params.oldCell || "B2";
      const newCell = params.newCell || "C2";
      core = `(${newCell}-${oldCell})/ABS(${oldCell})`;
      explanation = `Computes the relative change from ${oldCell} to ${newCell}. Format the result cell as Percentage (%).`;
      pitfalls = ["Enable 'Wrap in IFERROR' to avoid #DIV/0! when the baseline value is 0."];
      break;
    }
  }

  const finalFormula = options.wrapIfError
    ? `=IFERROR(${core}${sep} "${(options.ifErrorFallback ?? "").replace(/"/g, '""')}")`
    : `=${core}`;

  return {
    formula: finalFormula,
    explanation,
    pitfalls,
  };
}

// ============================================================================
// 3. MARKDOWN ⇄ HTML & CITATION GENERATOR
// ============================================================================

export function convertMarkdownToHtml(
  markdown: string,
  options: { addHeadingIds?: boolean; wrapFullDocument?: boolean; documentTitle?: string } = {},
): string {
  if (!markdown || markdown.trim() === "") return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks: string[] = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let paragraphBuffer: string[] = [];

  const slugifyHeading = (txt: string): string =>
    txt
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const formatInline = (text: string): string => {
    let out = escapeXml(text);
    // Inline code
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Images ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    // Links [label](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Bold **text** or __text__
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // Italic *text* or _text_
    out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
    // Strikethrough ~~text~~
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return out;
  };

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      htmlBlocks.push(`<p>${formatInline(paragraphBuffer.join(" "))}</p>`);
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listType && listItems.length > 0) {
      htmlBlocks.push(
        `<${listType}>\n${listItems.map((li) => `  <li>${li}</li>`).join("\n")}\n</${listType}>`,
      );
      listType = null;
      listItems = [];
    }
  };

  const flushTable = () => {
    if (inTable && tableHeader.length > 0) {
      const thHtml = tableHeader.map((h) => `      <th>${formatInline(h)}</th>`).join("\n");
      const trHtml = tableRows
        .map(
          (r) =>
            `    <tr>\n${tableHeader.map((_, idx) => `      <td>${formatInline(r[idx] ?? "")}</td>`).join("\n")}\n    </tr>`,
        )
        .join("\n");
      htmlBlocks.push(
        `<table>\n  <thead>\n    <tr>\n${thHtml}\n    </tr>\n  </thead>\n  <tbody>\n${trHtml}\n  </tbody>\n</table>`,
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        const langAttr = codeLang ? ` class="language-${escapeXml(codeLang)}"` : "";
        htmlBlocks.push(`<pre><code${langAttr}>${escapeXml(codeLines.join("\n"))}</code></pre>`);
        inCodeBlock = false;
        codeLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushParagraph();
      flushList();
      const cells = line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) {
        const nextLine = lines[i + 1]?.trim() ?? "";
        if (/^\|[\s:-]+\|$/.test(nextLine)) {
          inTable = true;
          tableHeader = cells;
          tableRows = [];
          i++; // skip separator row
          continue;
        }
      } else {
        tableRows.push(cells);
        continue;
      }
    } else if (inTable) {
      flushTable();
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      flushParagraph();
      flushList();
      htmlBlocks.push("<hr />");
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1]!.length;
      const rawTitle = headingMatch[2]!.trim();
      const idAttr = options.addHeadingIds !== false ? ` id="${slugifyHeading(rawTitle)}"` : "";
      htmlBlocks.push(`<h${level}${idAttr}>${formatInline(rawTitle)}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.trim().startsWith(">")) {
      flushParagraph();
      flushList();
      const quoteText = line.trim().replace(/^>\s?/, "");
      htmlBlocks.push(`<blockquote><p>${formatInline(quoteText)}</p></blockquote>`);
      continue;
    }

    // Unordered list (including task list items)
    const ulMatch = /^[-*+]\s+(.+)$/.exec(line.trim());
    if (ulMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      const itemRaw = ulMatch[1]!;
      const taskMatch = /^\[([ xX])\]\s+(.+)$/.exec(itemRaw);
      if (taskMatch) {
        const checked = taskMatch[1]!.toLowerCase() === "x" ? " checked" : "";
        listItems.push(
          `<input type="checkbox" disabled${checked} /> ${formatInline(taskMatch[2]!)}`,
        );
      } else {
        listItems.push(formatInline(itemRaw));
      }
      continue;
    }

    // Ordered list
    const olMatch = /^\d+\.\s+(.+)$/.exec(line.trim());
    if (olMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(formatInline(olMatch[1]!));
      continue;
    }

    paragraphBuffer.push(line.trim());
  }

  if (inCodeBlock) {
    htmlBlocks.push(`<pre><code>${escapeXml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  flushTable();

  const bodyHtml = htmlBlocks.join("\n");
  if (!options.wrapFullDocument) {
    return bodyHtml;
  }

  const title = escapeXml(options.documentTitle?.trim() || "Document");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function convertHtmlToMarkdown(
  html: string,
  options: { bulletMarker?: "-" | "*"; stripUnknownTags?: boolean } = {},
): string {
  if (!html || html.trim() === "") return "";
  const bullet = options.bulletMarker ?? "-";

  let out = html.replace(/\r\n/g, "\n");
  // Remove head/script/style blocks if full HTML document pasted
  out = out.replace(/<(head|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Code blocks <pre><code class="language-xyz">...</code></pre>
  out = out.replace(
    /<pre\b[^>]*>\s*<code(?:\s+class="[^"]*language-([a-z0-9_-]+)[^"]*")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_, lang, code) => `\n\`\`\`${lang ?? ""}\n${unescapeXml(code.trim())}\n\`\`\`\n\n`,
  );

  // Headings h1..h6
  for (let level = 1; level <= 6; level++) {
    const hashes = "#".repeat(level);
    const regex = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
    out = out.replace(regex, (_, inner) => `\n${hashes} ${inner.trim()}\n\n`);
  }

  // Tables
  out = out.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_, tableInner) => {
    const rows: string[][] = [];
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tableInner)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cellRegex.exec(trMatch[1] ?? "")) !== null) {
        cells.push((cMatch[1] ?? "").replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length === 0) return "";
    const header = rows[0]!;
    const sep = header.map(() => "---");
    const mdLines = [
      `| ${header.join(" | ")} |`,
      `| ${sep.join(" | ")} |`,
      ...rows.slice(1).map((r) => `| ${header.map((_, i) => r[i] ?? "").join(" | ")} |`),
    ];
    return `\n${mdLines.join("\n")}\n\n`;
  });

  // Blockquotes
  out = out.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const clean = inner.replace(/<\/?p\b[^>]*>/gi, "").trim();
    return `\n> ${clean}\n\n`;
  });

  // Ordered lists
  out = out.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let idx = 1;
    const items = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => {
      return `${idx++}. ${li.trim()}\n`;
    });
    return `\n${items.trim()}\n\n`;
  });

  // Unordered lists
  out = out.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => {
      return `${bullet} ${li.trim()}\n`;
    });
    return `\n${items.trim()}\n\n`;
  });

  // Inline elements
  out = out.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  out = out.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  out = out.replace(/<(del|s|strike)\b[^>]*>([\s\S]*?)<\/\1>/gi, "~~$2~~");
  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  out = out.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  out = out.replace(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  out = out.replace(/<img\b[^>]*alt="([^"]*)"[^>]*src="([^"]+)"[^>]*\/?>/gi, "![$1]($2)");
  out = out.replace(/<hr\b[^>]*\/?>/gi, "\n---\n\n");
  out = out.replace(/<br\b[^>]*\/?>/gi, "\n");
  out = out.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

  if (options.stripUnknownTags !== false) {
    out = out.replace(/<[^>]+>/g, "");
  }

  return unescapeXml(out)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard" | "ieee";
export type CitationSourceType = "website" | "book" | "journal";

export interface CitationAuthor {
  firstName: string;
  lastName: string;
}

export interface CitationInput {
  style: CitationStyle;
  sourceType: CitationSourceType;
  authors: CitationAuthor[];
  title: string;
  containerTitle?: string;
  publisher?: string;
  year: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  doi?: string;
  accessDate?: string;
}

export interface FormattedCitation {
  bibliography: string;
  inText: string;
}

function formatAuthorApa(a: CitationAuthor): string {
  const last = a.lastName.trim();
  const firstInitial = a.firstName.trim() ? `${a.firstName.trim()[0]!.toUpperCase()}.` : "";
  return [last, firstInitial].filter(Boolean).join(", ");
}

function formatAuthorMla(a: CitationAuthor, isFirst: boolean): string {
  const first = a.firstName.trim();
  const last = a.lastName.trim();
  if (!first) return last;
  return isFirst ? `${last}, ${first}` : `${first} ${last}`;
}

export function generateFormattedCitation(input: CitationInput): FormattedCitation {
  const validAuthors = input.authors.filter(
    (a) => a.lastName.trim() !== "" || a.firstName.trim() !== "",
  );
  const year = input.year.trim() || "n.d.";
  const title = input.title.trim() || "Untitled work";
  const container = input.containerTitle?.trim() || "";
  const publisher = input.publisher?.trim() || "";
  const urlOrDoi = input.doi?.trim()
    ? `https://doi.org/${input.doi.trim().replace(/^https?:\/\/doi\.org\//i, "")}`
    : input.url?.trim() || "";

  const firstAuthorLast = validAuthors[0]?.lastName.trim() || title.split(/\s+/)[0] || "Author";

  switch (input.style) {
    case "apa": {
      const authorStr =
        validAuthors.length === 0
          ? ""
          : validAuthors.length === 1
            ? formatAuthorApa(validAuthors[0]!)
            : validAuthors.length === 2
              ? `${formatAuthorApa(validAuthors[0]!)} & ${formatAuthorApa(validAuthors[1]!)}`
              : `${validAuthors.slice(0, -1).map(formatAuthorApa).join(", ")}, & ${formatAuthorApa(validAuthors[validAuthors.length - 1]!)}`;

      const volIssue = input.volume?.trim()
        ? `${input.volume.trim()}${input.issue?.trim() ? `(${input.issue.trim()})` : ""}`
        : "";
      const pages = input.pages?.trim() ? `, ${input.pages.trim()}` : "";
      const middle =
        input.sourceType === "journal"
          ? `${title}. ${container ? `${container}, ` : ""}${volIssue}${pages}.`
          : `${title}.${container ? ` ${container}.` : ""}${publisher ? ` ${publisher}.` : ""}`;

      const bib = [
        authorStr ? `${authorStr} (${year}).` : `${title} (${year}).`,
        authorStr ? middle : `${container ? `${container}.` : ""}`,
        urlOrDoi,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\.\./g, ".");

      const inTextAuthor =
        validAuthors.length === 0
          ? `"${title}"`
          : validAuthors.length === 1
            ? firstAuthorLast
            : validAuthors.length === 2
              ? `${validAuthors[0]!.lastName.trim()} & ${validAuthors[1]!.lastName.trim()}`
              : `${firstAuthorLast} et al.`;

      return {
        bibliography: bib,
        inText: `(${inTextAuthor}, ${year})`,
      };
    }

    case "mla": {
      const authorStr =
        validAuthors.length === 0
          ? ""
          : validAuthors.length === 1
            ? `${formatAuthorMla(validAuthors[0]!, true)}.`
            : validAuthors.length === 2
              ? `${formatAuthorMla(validAuthors[0]!, true)}, and ${formatAuthorMla(validAuthors[1]!, false)}.`
              : `${formatAuthorMla(validAuthors[0]!, true)}, et al.`;

      const parts = [
        authorStr,
        input.sourceType === "book" ? `${title}.` : `"${title}."`,
        container ? `${container},` : "",
        input.volume?.trim() ? `vol. ${input.volume.trim()},` : "",
        input.issue?.trim() ? `no. ${input.issue.trim()},` : "",
        publisher ? `${publisher},` : "",
        `${year}${input.pages?.trim() ? `, pp. ${input.pages.trim()}` : ""}.`,
        urlOrDoi ? `${urlOrDoi}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\.\./g, ".");

      const pageSuffix = input.pages?.trim() ? ` ${input.pages.trim()}` : "";
      return {
        bibliography: parts,
        inText: `(${firstAuthorLast}${pageSuffix})`,
      };
    }

    case "chicago": {
      const authorStr =
        validAuthors.length === 0
          ? ""
          : validAuthors.map((a, i) => formatAuthorMla(a, i === 0)).join(", ") + ".";

      const bib = [
        authorStr,
        `${year}.`,
        input.sourceType === "book" ? `${title}.` : `"${title}."`,
        container ? `${container}` : "",
        input.volume?.trim()
          ? `${input.volume.trim()}${input.issue?.trim() ? `, no. ${input.issue.trim()}` : ""}${input.pages?.trim() ? `: ${input.pages.trim()}` : ""}.`
          : publisher
            ? `${publisher}.`
            : "",
        urlOrDoi,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\.\./g, ".");

      return {
        bibliography: bib,
        inText: `(${firstAuthorLast} ${year}${input.pages?.trim() ? `, ${input.pages.trim()}` : ""})`,
      };
    }

    case "harvard": {
      const authorStr =
        validAuthors.length === 0 ? title : validAuthors.map(formatAuthorApa).join(" and ");
      const bib = [
        `${authorStr} (${year})`,
        `'${title}',`,
        container ? `${container},` : "",
        publisher ? `${publisher},` : "",
        input.pages?.trim() ? `pp. ${input.pages.trim()}.` : "",
        urlOrDoi ? `Available at: ${urlOrDoi}` : "",
        input.accessDate?.trim() ? `(Accessed: ${input.accessDate.trim()}).` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        bibliography: bib,
        inText: `(${firstAuthorLast}, ${year})`,
      };
    }

    case "ieee": {
      const authorStr = validAuthors
        .map((a) => {
          const init = a.firstName.trim() ? `${a.firstName.trim()[0]!.toUpperCase()}. ` : "";
          return `${init}${a.lastName.trim()}`;
        })
        .join(", ");
      const bib = [
        authorStr ? `${authorStr},` : "",
        `"${title},"`,
        container ? `${container},` : "",
        input.volume?.trim() ? `vol. ${input.volume.trim()},` : "",
        input.issue?.trim() ? `no. ${input.issue.trim()},` : "",
        input.pages?.trim() ? `pp. ${input.pages.trim()},` : "",
        `${year}.`,
        urlOrDoi ? `[Online]. Available: ${urlOrDoi}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      return {
        bibliography: bib,
        inText: "[1]",
      };
    }
  }
}

// ============================================================================
// 4. DEVELOPER TOOLS: SQL FORMATTER, SQL QUERY BUILDER, HASH, MINIFIER, CSS
// ============================================================================

const SQL_MAJOR_CLAUSES = [
  "LEFT OUTER JOIN",
  "RIGHT OUTER JOIN",
  "FULL OUTER JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "UNION ALL",
  "UNION",
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "JOIN",
];

const SQL_ALL_KEYWORDS = [
  ...SQL_MAJOR_CLAUSES,
  "AS",
  "ON",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "DISTINCT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "ASC",
  "DESC",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "CAST",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "EXISTS",
  "WITH",
  "CREATE",
  "TABLE",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
];

export function formatSqlQuery(
  rawSql: string,
  options: {
    keywordCase?: "upper" | "lower" | "preserve";
    indentSize?: 2 | 4;
    compact?: boolean;
  } = {},
): string {
  if (!rawSql || rawSql.trim() === "") return "";

  const keywordCase = options.keywordCase ?? "upper";
  const indent = " ".repeat(options.indentSize ?? 2);

  // Protect quoted strings so we don't alter text inside 'single quotes'
  const stringTokens: string[] = [];
  let tokenized = rawSql.replace(/'(?:''|[^'])*'/g, (match) => {
    const idx = stringTokens.length;
    stringTokens.push(match);
    return `__SQL_STR_${idx}__`;
  });

  // Collapse whitespace
  tokenized = tokenized.replace(/\s+/g, " ").trim();

  // Apply keyword casing
  if (keywordCase !== "preserve") {
    const sortedKw = [...SQL_ALL_KEYWORDS].sort((a, b) => b.length - a.length);
    for (const kw of sortedKw) {
      const pattern = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "gi");
      tokenized = tokenized.replace(pattern, () =>
        keywordCase === "upper" ? kw.toUpperCase() : kw.toLowerCase(),
      );
    }
  }

  if (options.compact) {
    return tokenized.replace(/__SQL_STR_(\d+)__/g, (_, i) => stringTokens[Number(i)] ?? "");
  }

  // Insert newlines before major clauses
  const sortedMajor = [...SQL_MAJOR_CLAUSES].sort((a, b) => b.length - a.length);
  for (const clause of sortedMajor) {
    const regex = new RegExp(`\\s+\\b(${clause.replace(/\s+/g, "\\s+")})\\b`, "gi");
    tokenized = tokenized.replace(regex, (_, matched) => `\n${matched}`);
  }

  // Format AND / OR inside WHERE clauses onto indented lines
  tokenized = tokenized.replace(/\s+\b(AND|OR)\b\s+/gi, (_, conj) => `\n${indent}${conj} `);

  // Format comma-separated column lists under SELECT
  const lines = tokenized.split("\n").map((line) => {
    if (/^(SELECT|SET)\b/i.test(line.trim())) {
      const m = /^(SELECT(?:\s+DISTINCT)?|SET)\s+(.+)$/i.exec(line.trim());
      if (m) {
        const prefix = m[1]!;
        const rest = m[2]!;
        // Split top-level commas (not inside parentheses)
        const parts: string[] = [];
        let depth = 0;
        let current = "";
        for (const ch of rest) {
          if (ch === "(") depth++;
          if (ch === ")") depth = Math.max(0, depth - 1);
          if (ch === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        if (current.trim()) parts.push(current.trim());
        if (parts.length > 1) {
          return `${prefix}\n${parts.map((p) => `${indent}${p}`).join(",\n")}`;
        }
      }
    }
    return line;
  });

  const formatted = lines.join("\n");
  return formatted.replace(/__SQL_STR_(\d+)__/g, (_, i) => stringTokens[Number(i)] ?? "");
}

export interface SqlWhereCondition {
  id: string;
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value: string;
  conjunction: "AND" | "OR";
}

export interface SqlQueryBuilderConfig {
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  table: string;
  columns: string[];
  distinct?: boolean;
  joinTable?: string;
  joinType?: "INNER JOIN" | "LEFT JOIN" | "RIGHT JOIN";
  joinOn?: string;
  where: SqlWhereCondition[];
  groupBy?: string;
  orderByColumn?: string;
  orderByDirection?: "ASC" | "DESC";
  limit?: number;
  insertOrUpdateValues?: Record<string, string>;
}

function formatSqlLiteral(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "''";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^(true|false|null)$/i.test(trimmed)) return trimmed.toUpperCase();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
}

export function buildSqlQuery(config: SqlQueryBuilderConfig): string {
  const table = config.table.trim() || "users";
  const cols = config.columns.filter((c) => c.trim() !== "");

  const buildWhereClause = (): string => {
    const valid = config.where.filter((w) => w.column.trim() !== "");
    if (valid.length === 0) return "";
    const parts = valid.map((w, idx) => {
      const prefix = idx === 0 ? "WHERE" : `  ${w.conjunction}`;
      if (w.operator === "IS NULL" || w.operator === "IS NOT NULL") {
        return `${prefix} ${w.column.trim()} ${w.operator}`;
      }
      if (w.operator === "IN") {
        const items = w.value
          .split(",")
          .map((item) => formatSqlLiteral(item))
          .join(", ");
        return `${prefix} ${w.column.trim()} IN (${items})`;
      }
      return `${prefix} ${w.column.trim()} ${w.operator} ${formatSqlLiteral(w.value)}`;
    });
    return parts.join("\n");
  };

  if (config.operation === "SELECT") {
    const selectPrefix = config.distinct ? "SELECT DISTINCT" : "SELECT";
    const colList = cols.length > 0 ? cols.map((c) => `  ${c.trim()}`).join(",\n") : "  *";
    const lines: string[] = [`${selectPrefix}\n${colList}`, `FROM ${table}`];

    if (config.joinTable?.trim() && config.joinOn?.trim()) {
      lines.push(
        `${config.joinType ?? "LEFT JOIN"} ${config.joinTable.trim()} ON ${config.joinOn.trim()}`,
      );
    }

    const whereClause = buildWhereClause();
    if (whereClause) lines.push(whereClause);

    if (config.groupBy?.trim()) {
      lines.push(`GROUP BY ${config.groupBy.trim()}`);
    }
    if (config.orderByColumn?.trim()) {
      lines.push(`ORDER BY ${config.orderByColumn.trim()} ${config.orderByDirection ?? "ASC"}`);
    }
    if (config.limit && config.limit > 0) {
      lines.push(`LIMIT ${Math.floor(config.limit)}`);
    }

    return `${lines.join("\n")};`;
  }

  if (config.operation === "INSERT") {
    const entries = Object.entries(config.insertOrUpdateValues ?? {}).filter(
      ([k]) => k.trim() !== "",
    );
    const colNames = entries.length > 0 ? entries.map(([k]) => k.trim()) : ["name", "email"];
    const vals =
      entries.length > 0
        ? entries.map(([, v]) => formatSqlLiteral(v))
        : ["'Ada Lovelace'", "'ada@example.com'"];
    return `INSERT INTO ${table} (${colNames.join(", ")})\nVALUES (${vals.join(", ")});`;
  }

  if (config.operation === "UPDATE") {
    const entries = Object.entries(config.insertOrUpdateValues ?? {}).filter(
      ([k]) => k.trim() !== "",
    );
    const setLines =
      entries.length > 0
        ? entries.map(([k, v]) => `  ${k.trim()} = ${formatSqlLiteral(v)}`).join(",\n")
        : "  status = 'active'";
    const whereClause = buildWhereClause() || "WHERE id = 1";
    return `UPDATE ${table}\nSET\n${setLines}\n${whereClause};`;
  }

  // DELETE
  const whereClause = buildWhereClause() || "WHERE id = 1";
  return `DELETE FROM ${table}\n${whereClause};`;
}

/**
 * Pure TypeScript RFC-1321 MD5 implementation (128-bit hex digest)
 * since Web Crypto subtle.digest intentionally omits MD5.
 */
export function computeMd5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const totalLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let offset = 0; offset < totalLen; offset += 64) {
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const word = view.getUint32(offset + g * 4, true);
      const temp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i]! + word) >>> 0;
      B = (B + rotl(sum, S[i]!)) >>> 0;
      A = temp;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);

  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface HashDigestSuite {
  md5: string;
  sha1: string;
  sha256: string;
  sha384: string;
  sha512: string;
}

async function webCryptoDigestHex(
  algorithm: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512",
  text: string,
  hmacKey?: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  if (hmacKey && hmacKey.trim() !== "") {
    const keyData = encoder.encode(hmacKey);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: algorithm },
      false,
      ["sign"],
    );
    const sig = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, data);
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  const digest = await globalThis.crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateAllHashes(
  input: string,
  options: { uppercase?: boolean; hmacKey?: string } = {},
): Promise<HashDigestSuite> {
  const md5Raw = computeMd5Hex(options.hmacKey ? `${options.hmacKey}:${input}` : input);
  const [sha1Raw, sha256Raw, sha384Raw, sha512Raw] = await Promise.all([
    webCryptoDigestHex("SHA-1", input, options.hmacKey),
    webCryptoDigestHex("SHA-256", input, options.hmacKey),
    webCryptoDigestHex("SHA-384", input, options.hmacKey),
    webCryptoDigestHex("SHA-512", input, options.hmacKey),
  ]);

  const fmt = (h: string) => (options.uppercase ? h.toUpperCase() : h.toLowerCase());
  return {
    md5: fmt(md5Raw),
    sha1: fmt(sha1Raw),
    sha256: fmt(sha256Raw),
    sha384: fmt(sha384Raw),
    sha512: fmt(sha512Raw),
  };
}

export type CodeMinifierLanguage = "html" | "css" | "javascript";

export interface MinifyCodeResult {
  output: string;
  originalBytes: number;
  minifiedBytes: number;
  savedBytes: number;
  savingsPercent: number;
}

export function minifyCodeSource(source: string, language: CodeMinifierLanguage): MinifyCodeResult {
  const encoder = new TextEncoder();
  const originalBytes = encoder.encode(source).byteLength;
  if (!source || source.trim() === "") {
    return {
      output: "",
      originalBytes: 0,
      minifiedBytes: 0,
      savedBytes: 0,
      savingsPercent: 0,
    };
  }

  let output = "";
  if (language === "html") {
    // Preserve <pre> and <textarea> content
    const preserved: string[] = [];
    output = source.replace(/<(pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
      const idx = preserved.length;
      preserved.push(m);
      return `__HTML_PRESERVE_${idx}__`;
    });
    output = output
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .trim();
    output = output.replace(/__HTML_PRESERVE_(\d+)__/g, (_, i) => preserved[Number(i)] ?? "");
  } else if (language === "css") {
    output = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>~])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  } else {
    // JavaScript minifier preserving string & template literals
    const strings: string[] = [];
    let tokenized = source.replace(
      /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)/g,
      (m) => {
        const idx = strings.length;
        strings.push(m);
        return `__JS_STR_${idx}__`;
      },
    );
    tokenized = tokenized
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}();,=+\-*/<>!&|?:])\s*/g, "$1")
      .trim();
    output = tokenized.replace(/__JS_STR_(\d+)__/g, (_, i) => strings[Number(i)] ?? "");
  }

  const minifiedBytes = encoder.encode(output).byteLength;
  const savedBytes = Math.max(0, originalBytes - minifiedBytes);
  const savingsPercent =
    originalBytes > 0 ? Number(((savedBytes / originalBytes) * 100).toFixed(1)) : 0;

  return {
    output,
    originalBytes,
    minifiedBytes,
    savedBytes,
    savingsPercent,
  };
}

export function formatCssStylesheet(
  rawCss: string,
  options: { indentSize?: 2 | 4; sortProperties?: boolean } = {},
): {
  output: string;
  ruleCount: number;
  customPropCount: number;
} {
  if (!rawCss || rawCss.trim() === "") {
    return { output: "", ruleCount: 0, customPropCount: 0 };
  }

  const indentUnit = " ".repeat(options.indentSize ?? 2);
  const customPropMatches = rawCss.match(/--[a-zA-Z0-9_-]+\s*:/g);
  const customPropCount = customPropMatches ? customPropMatches.length : 0;

  // Strip block comments for clean re-indentation
  const cleaned = rawCss.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const lines: string[] = [];
  let depth = 0;
  let current = "";
  let ruleCount = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (ch === "{") {
      const selector = current.trim().replace(/\s+/g, " ");
      lines.push(`${indentUnit.repeat(depth)}${selector} {`);
      depth++;
      ruleCount++;
      current = "";
    } else if (ch === "}") {
      if (current.trim()) {
        lines.push(`${indentUnit.repeat(depth)}${current.trim().replace(/\s*:\s*/, ": ")};`);
        current = "";
      }
      depth = Math.max(0, depth - 1);
      lines.push(`${indentUnit.repeat(depth)}}`);
      if (depth === 0) lines.push("");
    } else if (ch === ";") {
      const decl = current.trim();
      if (decl) {
        const colonIdx = decl.indexOf(":");
        if (colonIdx > 0) {
          const prop = decl.slice(0, colonIdx).trim();
          const val = decl
            .slice(colonIdx + 1)
            .trim()
            .replace(/\s+/g, " ");
          lines.push(`${indentUnit.repeat(depth)}${prop}: ${val};`);
        } else {
          lines.push(`${indentUnit.repeat(depth)}${decl};`);
        }
      }
      current = "";
    } else {
      current += ch;
    }
  }

  let output = lines.join("\n").trim();

  if (options.sortProperties) {
    output = output.replace(/\{\n((?:[ \t]+[^}{\n]+;\n)+)/g, (_, body: string) => {
      const declLines = body
        .trimEnd()
        .split("\n")
        .sort((a, b) => a.trim().localeCompare(b.trim()));
      return `{\n${declLines.join("\n")}\n`;
    });
  }

  return { output, ruleCount, customPropCount };
}

// ============================================================================
// 5. STUDENT & PRODUCTIVITY: SCIENTIFIC CALCULATOR, EQUATION SOLVER, HABIT, TIMELINE
// ============================================================================

export type AngleUnit = "deg" | "rad";

export interface ScientificEvalResult {
  ok: boolean;
  value: number;
  formatted: string;
  error?: string;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

/**
 * Deterministic recursive-descent mathematical expression evaluator.
 * Supports +, -, *, /, %, ^, !, parentheses, constants (pi, e, tau, phi, ans),
 * and scientific functions (sin, cos, tan, asin, acos, atan, sqrt, cbrt, ln, log, exp, abs, fact).
 */
export function evaluateScientificExpression(
  expr: string,
  options: { angleUnit?: AngleUnit; lastAnswer?: number } = {},
): ScientificEvalResult {
  const angleUnit = options.angleUnit ?? "deg";
  const lastAnswer = options.lastAnswer ?? 0;

  if (!expr || expr.trim() === "") {
    return { ok: false, value: 0, formatted: "", error: "Please enter a mathematical expression." };
  }

  const normalized = expr
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/\s+/g, "");

  type Token =
    | { type: "num"; value: number }
    | { type: "id"; name: string }
    | { type: "op"; op: string }
    | { type: "paren"; paren: "(" | ")" }
    | { type: "comma" };

  const tokens: Token[] = [];
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i]!;
    if (/\d|\./.test(ch)) {
      let numStr = "";
      while (i < normalized.length && /[\d.]/.test(normalized[i]!)) {
        numStr += normalized[i++];
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) {
        return { ok: false, value: 0, formatted: "", error: `Invalid number: ${numStr}` };
      }
      tokens.push({ type: "num", value: parsed });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let idStr = "";
      while (i < normalized.length && /[a-zA-Z0-9]/.test(normalized[i]!)) {
        idStr += normalized[i++];
      }
      tokens.push({ type: "id", name: idStr.toLowerCase() });
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", paren: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }
    if ("+-*/%^!".includes(ch)) {
      tokens.push({ type: "op", op: ch });
      i++;
      continue;
    }
    return {
      ok: false,
      value: 0,
      formatted: "",
      error: `Unexpected character "${ch}" in expression.`,
    };
  }

  // Insert implicit multiplication: e.g. 2pi, 3(4+5), (1+2)(3+4)
  const expanded: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const curr = tokens[idx]!;
    expanded.push(curr);
    const next = tokens[idx + 1];
    if (!next) continue;

    const currIsValue =
      curr.type === "num" ||
      (curr.type === "paren" && curr.paren === ")") ||
      (curr.type === "op" && curr.op === "!") ||
      (curr.type === "id" && ["pi", "e", "tau", "phi", "ans"].includes(curr.name));

    const nextStartsValue =
      next.type === "num" || next.type === "id" || (next.type === "paren" && next.paren === "(");

    if (currIsValue && nextStartsValue) {
      expanded.push({ type: "op", op: "*" });
    }
  }

  let pos = 0;
  const peek = () => expanded[pos];
  const consume = () => expanded[pos++];

  const toRad = (v: number) => (angleUnit === "deg" ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (angleUnit === "deg" ? (v * 180) / Math.PI : v);

  function parseExpression(): number {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (t && t.type === "op" && (t.op === "+" || t.op === "-")) {
        consume();
        const right = parseTerm();
        left = t.op === "+" ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (true) {
      const t = peek();
      if (t && t.type === "op" && (t.op === "*" || t.op === "/" || t.op === "%")) {
        consume();
        const right = parsePower();
        if (t.op === "*") left *= right;
        else if (t.op === "/") left = right === 0 ? NaN : left / right;
        else left %= right;
      } else {
        break;
      }
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    const t = peek();
    if (t && t.type === "op" && t.op === "^") {
      consume();
      const exp = parsePower(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    const t = peek();
    if (t && t.type === "op" && (t.op === "+" || t.op === "-")) {
      consume();
      const v = parseUnary();
      return t.op === "-" ? -v : v;
    }
    return parsePostfix();
  }

  function parsePostfix(): number {
    let val = parsePrimary();
    while (true) {
      const t = peek();
      if (t && t.type === "op" && t.op === "!") {
        consume();
        val = factorial(val);
      } else {
        break;
      }
    }
    return val;
  }

  function parsePrimary(): number {
    const t = consume();
    if (!t) throw new Error("Unexpected end of expression.");

    if (t.type === "num") return t.value;

    if (t.type === "paren" && t.paren === "(") {
      const inner = parseExpression();
      const close = consume();
      if (!close || close.type !== "paren" || close.paren !== ")") {
        throw new Error("Missing closing parenthesis ')'.");
      }
      return inner;
    }

    if (t.type === "id") {
      if (t.name === "pi") return Math.PI;
      if (t.name === "e") return Math.E;
      if (t.name === "tau") return Math.PI * 2;
      if (t.name === "phi") return (1 + Math.sqrt(5)) / 2;
      if (t.name === "ans") return lastAnswer;

      const open = consume();
      if (!open || open.type !== "paren" || open.paren !== "(") {
        throw new Error(`Function "${t.name}" must be followed by parentheses.`);
      }
      const args: number[] = [parseExpression()];
      while (peek()?.type === "comma") {
        consume();
        args.push(parseExpression());
      }
      const close = consume();
      if (!close || close.type !== "paren" || close.paren !== ")") {
        throw new Error(`Missing closing parenthesis for ${t.name}(...).`);
      }

      const a0 = args[0] ?? 0;
      const a1 = args[1] ?? 0;
      switch (t.name) {
        case "sin":
          return Math.sin(toRad(a0));
        case "cos":
          return Math.cos(toRad(a0));
        case "tan":
          return Math.tan(toRad(a0));
        case "asin":
          return fromRad(Math.asin(a0));
        case "acos":
          return fromRad(Math.acos(a0));
        case "atan":
          return fromRad(Math.atan(a0));
        case "sinh":
          return Math.sinh(a0);
        case "cosh":
          return Math.cosh(a0);
        case "tanh":
          return Math.tanh(a0);
        case "sqrt":
          return a0 < 0 ? NaN : Math.sqrt(a0);
        case "cbrt":
          return Math.cbrt(a0);
        case "ln":
          return a0 <= 0 ? NaN : Math.log(a0);
        case "log":
        case "log10":
          return a0 <= 0 ? NaN : Math.log10(a0);
        case "log2":
          return a0 <= 0 ? NaN : Math.log2(a0);
        case "exp":
          return Math.exp(a0);
        case "abs":
          return Math.abs(a0);
        case "ceil":
          return Math.ceil(a0);
        case "floor":
          return Math.floor(a0);
        case "round":
          return Math.round(a0);
        case "fact":
          return factorial(a0);
        case "pow":
          return Math.pow(a0, a1);
        case "ncr":
          return factorial(a0) / (factorial(a1) * factorial(a0 - a1));
        case "npr":
          return factorial(a0) / factorial(a0 - a1);
        default:
          throw new Error(`Unknown function "${t.name}".`);
      }
    }

    throw new Error("Invalid syntax in expression.");
  }

  try {
    const val = parseExpression();
    if (pos < expanded.length) {
      return {
        ok: false,
        value: 0,
        formatted: "",
        error: "Unexpected trailing tokens in expression.",
      };
    }
    if (!Number.isFinite(val)) {
      return {
        ok: false,
        value: val,
        formatted: "",
        error: "Math error: division by zero or domain out of range.",
      };
    }
    const cleanVal = Math.abs(val) < 1e-12 ? 0 : Number(val.toPrecision(12));
    return {
      ok: true,
      value: cleanVal,
      formatted: String(cleanVal),
    };
  } catch (err) {
    return {
      ok: false,
      value: 0,
      formatted: "",
      error: err instanceof Error ? err.message : "Invalid mathematical expression.",
    };
  }
}

export interface LinearSolutionResult {
  ok: boolean;
  x?: number;
  steps: string[];
  error?: string;
}

/** Solves ax + b = c */
export function solveLinearEquation(a: number, b: number, c: number): LinearSolutionResult {
  if (a === 0) {
    return {
      ok: false,
      steps: [],
      error:
        b === c
          ? "Infinite solutions: coefficient a is 0 and both sides are identical."
          : "No solution: coefficient a cannot be 0 when b ≠ c.",
    };
  }
  const rhs = c - b;
  const x = Number((rhs / a).toFixed(6));
  return {
    ok: true,
    x,
    steps: [
      `Given linear equation: ${a}x + (${b}) = ${c}`,
      `Subtract ${b} from both sides: ${a}x = ${c} - (${b}) = ${rhs}`,
      `Divide both sides by ${a}: x = ${rhs} / ${a} = ${x}`,
    ],
  };
}

export interface QuadraticSolutionResult {
  ok: boolean;
  discriminant: number;
  nature: "two-real" | "one-repeated" | "complex-conjugate";
  roots: string[];
  vertex: { h: number; k: number };
  steps: string[];
  error?: string;
}

/** Solves ax^2 + bx + c = 0 */
export function solveQuadraticEquation(a: number, b: number, c: number): QuadraticSolutionResult {
  if (a === 0) {
    return {
      ok: false,
      discriminant: 0,
      nature: "one-repeated",
      roots: [],
      vertex: { h: 0, k: 0 },
      steps: [],
      error: "Coefficient 'a' cannot be 0 for a quadratic equation (use Linear mode instead).",
    };
  }

  const discriminant = Number((b * b - 4 * a * c).toFixed(6));
  const h = Number((-b / (2 * a)).toFixed(6));
  const k = Number((a * h * h + b * h + c).toFixed(6));

  const steps: string[] = [
    `Standard form: ${a}x² + (${b})x + (${c}) = 0`,
    `Compute discriminant Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${discriminant}`,
  ];

  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const x1 = Number(((-b + sqrtD) / (2 * a)).toFixed(6));
    const x2 = Number(((-b - sqrtD) / (2 * a)).toFixed(6));
    steps.push(`Since Δ > 0, there are two distinct real roots:`);
    steps.push(`x₁ = (-b + √Δ) / (2a) = (${-b} + ${sqrtD.toFixed(4)}) / ${2 * a} = ${x1}`);
    steps.push(`x₂ = (-b - √Δ) / (2a) = (${-b} - ${sqrtD.toFixed(4)}) / ${2 * a} = ${x2}`);
    steps.push(`Parabola vertex (h, k) = (${h}, ${k})`);
    return {
      ok: true,
      discriminant,
      nature: "two-real",
      roots: [`x₁ = ${x1}`, `x₂ = ${x2}`],
      vertex: { h, k },
      steps,
    };
  } else if (discriminant === 0) {
    const x = Number((-b / (2 * a)).toFixed(6));
    steps.push(`Since Δ = 0, there is one repeated real root:`);
    steps.push(`x = -b / (2a) = ${-b} / ${2 * a} = ${x}`);
    steps.push(`Parabola vertex (h, k) = (${h}, ${k})`);
    return {
      ok: true,
      discriminant: 0,
      nature: "one-repeated",
      roots: [`x = ${x}`],
      vertex: { h, k },
      steps,
    };
  } else {
    const realPart = Number((-b / (2 * a)).toFixed(6));
    const imagPart = Number((Math.sqrt(Math.abs(discriminant)) / Math.abs(2 * a)).toFixed(6));
    steps.push(`Since Δ < 0, there are two complex conjugate roots:`);
    steps.push(`x = ${realPart} ± ${imagPart}i`);
    steps.push(`Parabola vertex (h, k) = (${h}, ${k})`);
    return {
      ok: true,
      discriminant,
      nature: "complex-conjugate",
      roots: [`x₁ = ${realPart} + ${imagPart}i`, `x₂ = ${realPart} - ${imagPart}i`],
      vertex: { h, k },
      steps,
    };
  }
}

export interface LinearSystem2x2Result {
  ok: boolean;
  determinant: number;
  x?: number;
  y?: number;
  steps: string[];
  error?: string;
}

/** Solves a1*x + b1*y = c1 and a2*x + b2*y = c2 via Cramer's Rule */
export function solveLinearSystem2x2(
  a1: number,
  b1: number,
  c1: number,
  a2: number,
  b2: number,
  c2: number,
): LinearSystem2x2Result {
  const D = Number((a1 * b2 - a2 * b1).toFixed(6));
  const Dx = Number((c1 * b2 - c2 * b1).toFixed(6));
  const Dy = Number((a1 * c2 - a2 * c1).toFixed(6));

  if (D === 0) {
    return {
      ok: false,
      determinant: 0,
      steps: [`Main determinant D = (${a1})(${b2}) - (${a2})(${b1}) = 0`],
      error:
        Dx === 0 && Dy === 0
          ? "System has infinitely many solutions (lines are coincident)."
          : "System has no solution (lines are parallel and never intersect).",
    };
  }

  const x = Number((Dx / D).toFixed(6));
  const y = Number((Dy / D).toFixed(6));

  return {
    ok: true,
    determinant: D,
    x,
    y,
    steps: [
      `Equation 1: ${a1}x + ${b1}y = ${c1}`,
      `Equation 2: ${a2}x + ${b2}y = ${c2}`,
      `Determinant D = (${a1})(${b2}) - (${a2})(${b1}) = ${D}`,
      `Determinant Dx = (${c1})(${b2}) - (${c2})(${b1}) = ${Dx}`,
      `Determinant Dy = (${a1})(${c2}) - (${a2})(${c1}) = ${Dy}`,
      `By Cramer's Rule: x = Dx / D = ${x}, y = Dy / D = ${y}`,
    ],
  };
}

export interface HabitItem {
  id: string;
  name: string;
  category: string;
  completedDays: boolean[]; // e.g., 7 or 14 days, index 0 = oldest, last = today
}

export interface HabitStats {
  id: string;
  name: string;
  category: string;
  completedCount: number;
  totalDays: number;
  completionRatePercent: number;
  currentStreak: number;
  bestStreak: number;
}

export function calculateHabitMetrics(habits: HabitItem[]): {
  habitStats: HabitStats[];
  overallCompletionPercent: number;
  topStreak: number;
} {
  if (habits.length === 0) {
    return { habitStats: [], overallCompletionPercent: 0, topStreak: 0 };
  }

  let totalChecks = 0;
  let totalPossible = 0;
  let topStreak = 0;

  const habitStats: HabitStats[] = habits.map((h) => {
    const days = h.completedDays;
    const totalDays = days.length;
    const completedCount = days.filter(Boolean).length;
    totalChecks += completedCount;
    totalPossible += totalDays;

    let bestStreak = 0;
    let running = 0;
    for (const done of days) {
      if (done) {
        running++;
        bestStreak = Math.max(bestStreak, running);
      } else {
        running = 0;
      }
    }

    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i]) currentStreak++;
      else break;
    }

    topStreak = Math.max(topStreak, bestStreak);
    const completionRatePercent =
      totalDays > 0 ? Number(((completedCount / totalDays) * 100).toFixed(1)) : 0;

    return {
      id: h.id,
      name: h.name,
      category: h.category,
      completedCount,
      totalDays,
      completionRatePercent,
      currentStreak,
      bestStreak,
    };
  });

  const overallCompletionPercent =
    totalPossible > 0 ? Number(((totalChecks / totalPossible) * 100).toFixed(1)) : 0;

  return { habitStats, overallCompletionPercent, topStreak };
}

export interface TimelineTaskInput {
  id: string;
  title: string;
  owner: string;
  startDate: string; // YYYY-MM-DD
  durationDays: number;
  status: "completed" | "in-progress" | "planned" | "blocked";
  isMilestone?: boolean;
}

export interface ComputedTimelineTask extends TimelineTaskInput {
  endDate: string;
  startOffsetDays: number;
  widthPercent: number;
  leftPercent: number;
}

export interface ProjectTimelineResult {
  ok: boolean;
  projectStartDate: string;
  projectEndDate: string;
  totalDurationDays: number;
  completionPercent: number;
  tasks: ComputedTimelineTask[];
  markdownTable: string;
  csvExport: string;
  error?: string;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + Math.max(0, days));
  return d.toISOString().slice(0, 10);
}

function diffDaysIso(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T00:00:00Z`).getTime();
  const e = new Date(`${endIso}T00:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.round((e - s) / 86400000);
}

export function generateProjectTimeline(tasks: TimelineTaskInput[]): ProjectTimelineResult {
  const validTasks = tasks.filter(
    (t) => t.title.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate.trim()),
  );

  if (validTasks.length === 0) {
    return {
      ok: false,
      projectStartDate: "",
      projectEndDate: "",
      totalDurationDays: 0,
      completionPercent: 0,
      tasks: [],
      markdownTable: "",
      csvExport: "",
      error: "Please add at least one task with a valid YYYY-MM-DD start date.",
    };
  }

  const withEnd = validTasks.map((t) => {
    const dur = Math.max(1, Math.round(t.durationDays || 1));
    const endDate = addDaysIso(t.startDate, dur - 1);
    return { ...t, durationDays: dur, endDate };
  });

  const sortedStarts = withEnd.map((t) => t.startDate).sort();
  const sortedEnds = withEnd.map((t) => t.endDate).sort();
  const projectStartDate = sortedStarts[0]!;
  const projectEndDate = sortedEnds[sortedEnds.length - 1]!;
  const totalDurationDays = Math.max(1, diffDaysIso(projectStartDate, projectEndDate) + 1);

  const computedTasks: ComputedTimelineTask[] = withEnd.map((t) => {
    const startOffsetDays = Math.max(0, diffDaysIso(projectStartDate, t.startDate));
    const leftPercent = Number(((startOffsetDays / totalDurationDays) * 100).toFixed(2));
    const widthPercent = Number(Math.max(4, (t.durationDays / totalDurationDays) * 100).toFixed(2));
    return {
      ...t,
      startOffsetDays,
      leftPercent,
      widthPercent: Math.min(100 - leftPercent, widthPercent),
    };
  });

  const completedWeight = computedTasks.reduce((acc, t) => {
    if (t.status === "completed") return acc + 1;
    if (t.status === "in-progress") return acc + 0.5;
    return acc;
  }, 0);
  const completionPercent = Number(((completedWeight / computedTasks.length) * 100).toFixed(1));

  const mdLines = [
    "| Task / Milestone | Owner | Start Date | End Date | Duration (Days) | Status |",
    "| --- | --- | --- | --- | --- | --- |",
    ...computedTasks.map(
      (t) =>
        `| ${t.isMilestone ? "★ " : ""}${t.title} | ${t.owner || "-"} | ${t.startDate} | ${t.endDate} | ${t.durationDays} | ${t.status} |`,
    ),
  ];

  const csvDataset: CsvDataset = {
    headers: ["Task", "Owner", "Start Date", "End Date", "Duration (Days)", "Status", "Milestone"],
    rows: computedTasks.map((t) => [
      t.title,
      t.owner,
      t.startDate,
      t.endDate,
      String(t.durationDays),
      t.status,
      t.isMilestone ? "Yes" : "No",
    ]),
  };

  return {
    ok: true,
    projectStartDate,
    projectEndDate,
    totalDurationDays,
    completionPercent,
    tasks: computedTasks,
    markdownTable: mdLines.join("\n"),
    csvExport: serializeCsv(csvDataset),
  };
}
