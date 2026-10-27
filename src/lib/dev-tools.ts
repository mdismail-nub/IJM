export interface JsonFormatOptions {
  indent?: 2 | 4 | "tab";
  minify?: boolean;
  sortKeys?: boolean;
}

export interface JsonFormatResult {
  ok: boolean;
  output: string;
  error?: string;
  line?: number;
  column?: number;
  byteSize?: number;
}

function sortObjectKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeysRecursively);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const sorted: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      sorted[k] = sortObjectKeysRecursively(v);
    }
    return sorted;
  }
  return value;
}

function extractJsonErrorPosition(
  message: string,
  input: string,
): { line?: number; column?: number } {
  const posMatch = message.match(/position\s+(\d+)/i);
  if (posMatch && posMatch[1]) {
    const index = Number.parseInt(posMatch[1], 10);
    if (Number.isFinite(index) && index >= 0 && index <= input.length) {
      const slice = input.slice(0, index);
      const lines = slice.split("\n");
      const line = lines.length;
      const lastLine = lines[lines.length - 1] ?? "";
      const column = lastLine.length + 1;
      return { line, column };
    }
  }
  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch && lineColMatch[1] && lineColMatch[2]) {
    return {
      line: Number.parseInt(lineColMatch[1], 10),
      column: Number.parseInt(lineColMatch[2], 10),
    };
  }
  return {};
}

export function formatJson(rawInput: string, options: JsonFormatOptions = {}): JsonFormatResult {
  if (!rawInput || rawInput.trim() === "") {
    return {
      ok: false,
      output: "",
      error: "Please enter JSON input to format or validate.",
    };
  }

  try {
    const parsed: unknown = JSON.parse(rawInput);
    const normalized = options.sortKeys ? sortObjectKeysRecursively(parsed) : parsed;

    let space: string | number | undefined = 2;
    if (options.minify) {
      space = undefined;
    } else if (options.indent === "tab") {
      space = "\t";
    } else if (options.indent === 4) {
      space = 4;
    } else {
      space = 2;
    }

    const output = JSON.stringify(normalized, null, space);
    const byteSize = new TextEncoder().encode(output).byteLength;
    return { ok: true, output, byteSize };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid JSON syntax detected.";
    const pos = extractJsonErrorPosition(msg, rawInput);
    return {
      ok: false,
      output: "",
      error: msg,
      ...(pos.line !== undefined ? { line: pos.line } : {}),
      ...(pos.column !== undefined ? { column: pos.column } : {}),
    };
  }
}

export interface TextTransformResult {
  ok: boolean;
  output: string;
  error?: string;
}

export function encodeBase64Text(input: string, urlSafe = false): TextTransformResult {
  if (input === "") {
    return {
      ok: false,
      output: "",
      error: "Please enter text to encode into Base64.",
    };
  }

  try {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    let encoded = btoa(binary);
    if (urlSafe) {
      encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return { ok: true, output: encoded };
  } catch (err) {
    return {
      ok: false,
      output: "",
      error: err instanceof Error ? err.message : "Failed to encode text as Base64.",
    };
  }
}

export function decodeBase64Text(input: string): TextTransformResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return {
      ok: false,
      output: "",
      error: "Please enter a Base64 string to decode.",
    };
  }

  // Normalize URL-safe Base64 and strip whitespace
  const compact = trimmed.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    return {
      ok: false,
      output: "",
      error: "Invalid Base64 input: contains characters outside the Base64 alphabet.",
    };
  }

  const remainder = compact.length % 4;
  if (remainder === 1) {
    return {
      ok: false,
      output: "",
      error: "Invalid Base64 input: length is not a valid Base64 block size.",
    };
  }

  const padded = remainder === 0 ? compact : compact + "=".repeat((4 - remainder) % 4);

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const decoded = decoder.decode(bytes);
    return { ok: true, output: decoded };
  } catch {
    return {
      ok: false,
      output: "",
      error: "Invalid Base64 sequence or binary data cannot be decoded as valid UTF-8 text.",
    };
  }
}

export type UrlEncodeMode = "component" | "uri";

export function encodeUrlText(
  input: string,
  mode: UrlEncodeMode = "component",
): TextTransformResult {
  if (input === "") {
    return {
      ok: false,
      output: "",
      error: "Please enter a string or URL to encode.",
    };
  }

  try {
    const output = mode === "uri" ? encodeURI(input) : encodeURIComponent(input);
    return { ok: true, output };
  } catch (err) {
    return {
      ok: false,
      output: "",
      error: err instanceof Error ? err.message : "Failed to URL-encode input.",
    };
  }
}

export function decodeUrlText(
  input: string,
  mode: UrlEncodeMode = "component",
): TextTransformResult {
  if (input.trim() === "") {
    return {
      ok: false,
      output: "",
      error: "Please enter a URL-encoded string to decode.",
    };
  }

  try {
    const output = mode === "uri" ? decodeURI(input) : decodeURIComponent(input);
    return { ok: true, output };
  } catch {
    return {
      ok: false,
      output: "",
      error:
        "Malformed URL-encoded input: contains an incomplete or invalid percent-encoding sequence (e.g., trailing '%').",
    };
  }
}

export type TimestampUnit = "auto" | "seconds" | "milliseconds";

export interface TimestampConversionResult {
  ok: boolean;
  error?: string;
  detectedUnit?: "seconds" | "milliseconds";
  unixSeconds?: number;
  unixMilliseconds?: number;
  iso8601?: string;
  utcString?: string;
  localString?: string;
  localTimezone?: string;
  relativeTime?: string;
}

export function formatRelativeTime(targetMs: number, nowMs = Date.now()): string {
  const diffSeconds = Math.round((targetMs - nowMs) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 5) return "just now";

  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];

  for (const [unitSeconds, label] of units) {
    if (absSeconds >= unitSeconds) {
      const count = Math.floor(absSeconds / unitSeconds);
      const plural = count === 1 ? label : `${label}s`;
      return diffSeconds > 0 ? `in ${count} ${plural}` : `${count} ${plural} ago`;
    }
  }
  return "just now";
}

export function getLocalTimezoneLabel(date = new Date()): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const hours = String(Math.floor(absMin / 60)).padStart(2, "0");
    const mins = String(absMin % 60).padStart(2, "0");
    return `${tz} (UTC${sign}${hours}:${mins})`;
  } catch {
    return "Local Timezone";
  }
}

export function parseUnixTimestamp(
  rawInput: string,
  unit: TimestampUnit = "auto",
  nowMs = Date.now(),
): TimestampConversionResult {
  const trimmed = rawInput.trim();
  if (trimmed === "") {
    return {
      ok: false,
      error: "Please enter a Unix timestamp (seconds or milliseconds).",
    };
  }

  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return {
      ok: false,
      error: "Invalid timestamp: must be a numeric value (e.g., 1730000000).",
    };
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return {
      ok: false,
      error: "Numeric value is out of range.",
    };
  }

  let detectedUnit: "seconds" | "milliseconds";
  if (unit === "seconds" || unit === "milliseconds") {
    detectedUnit = unit;
  } else {
    // Values with magnitude >= 1e11 are treated as milliseconds (after year 1973 in ms / year 5138 in sec)
    detectedUnit = Math.abs(num) >= 1e11 ? "milliseconds" : "seconds";
  }

  const ms = detectedUnit === "milliseconds" ? Math.trunc(num) : Math.trunc(num * 1000);

  // JS Date supports +/- 8,640,000,000,000,000 ms
  if (Math.abs(ms) > 8_640_000_000_000_000) {
    return {
      ok: false,
      error: "Timestamp exceeds the supported JavaScript Date range (±8.64e15 milliseconds).",
    };
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return {
      ok: false,
      error: "Unable to construct a valid date from this timestamp.",
    };
  }

  return {
    ok: true,
    detectedUnit,
    unixSeconds: Math.floor(ms / 1000),
    unixMilliseconds: ms,
    iso8601: date.toISOString(),
    utcString: date.toUTCString(),
    localString: date.toLocaleString(undefined, {
      dateStyle: "full",
      timeStyle: "long",
    }),
    localTimezone: getLocalTimezoneLabel(date),
    relativeTime: formatRelativeTime(ms, nowMs),
  };
}

export function dateInputToUnix(
  isoLikeInput: string,
  zoneAssumption: "utc" | "local",
  nowMs = Date.now(),
): TimestampConversionResult {
  const trimmed = isoLikeInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Please enter a date/time string (e.g., 2026-10-27T14:30:00).",
    };
  }

  let normalized = trimmed;
  const hasExplicitZone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  if (!hasExplicitZone && zoneAssumption === "utc") {
    normalized = trimmed.includes("T") ? `${trimmed}Z` : `${trimmed.replace(" ", "T")}Z`;
  }

  const parsedMs = Date.parse(normalized);
  if (Number.isNaN(parsedMs)) {
    return {
      ok: false,
      error: "Invalid date/time format. Use YYYY-MM-DDTHH:mm:ss or an ISO-8601 string.",
    };
  }

  return parseUnixTimestamp(String(parsedMs), "milliseconds", nowMs);
}

export interface UuidGeneratorOptions {
  uppercase?: boolean;
  hyphens?: boolean;
  braces?: boolean;
  quotes?: boolean;
}

export interface UuidGeneratorResult {
  ok: boolean;
  uuids: string[];
  error?: string;
}

function generateRawUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUuids(
  count: number,
  options: UuidGeneratorOptions = {},
): UuidGeneratorResult {
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return {
      ok: false,
      uuids: [],
      error: "Quantity must be a whole number between 1 and 500.",
    };
  }

  const useHyphens = options.hyphens !== false;
  const uuids: string[] = [];

  for (let i = 0; i < count; i++) {
    let id = generateRawUuidV4();
    if (!useHyphens) {
      id = id.replace(/-/g, "");
    }
    if (options.uppercase) {
      id = id.toUpperCase();
    }
    if (options.braces) {
      id = `{${id}}`;
    }
    if (options.quotes) {
      id = `"${id}"`;
    }
    uuids.push(id);
  }

  return { ok: true, uuids };
}

export interface DiffOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
}

export interface DiffLine {
  type: "equal" | "added" | "removed";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
  unchanged: number;
  unifiedPatch: string;
}

function normalizeDiffLine(line: string, options: DiffOptions): string {
  let result = line;
  if (options.ignoreWhitespace) {
    result = result.trim().replace(/\s+/g, " ");
  }
  if (options.ignoreCase) {
    result = result.toLowerCase();
  }
  return result;
}

export function computeLineDiff(
  originalText: string,
  modifiedText: string,
  options: DiffOptions = {},
): DiffResult {
  const oldLines = originalText === "" ? [] : originalText.replace(/\r\n/g, "\n").split("\n");
  const newLines = modifiedText === "" ? [] : modifiedText.replace(/\r\n/g, "\n").split("\n");

  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    const oldNorm = normalizeDiffLine(oldLines[i] ?? "", options);
    for (let j = m - 1; j >= 0; j--) {
      const newNorm = normalizeDiffLine(newLines[j] ?? "", options);
      const rowI = dp[i];
      const rowNext = dp[i + 1];
      if (!rowI || !rowNext) continue;
      if (oldNorm === newNorm) {
        rowI[j] = (rowNext[j + 1] ?? 0) + 1;
      } else {
        rowI[j] = Math.max(rowNext[j] ?? 0, rowI[j + 1] ?? 0);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  while (i < n && j < m) {
    const oldRaw = oldLines[i] ?? "";
    const newRaw = newLines[j] ?? "";
    const oldNorm = normalizeDiffLine(oldRaw, options);
    const newNorm = normalizeDiffLine(newRaw, options);

    if (oldNorm === newNorm) {
      lines.push({
        type: "equal",
        text: newRaw,
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
      unchanged++;
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      lines.push({
        type: "removed",
        text: oldRaw,
        oldLineNumber: oldLineNum++,
      });
      removed++;
      i++;
    } else {
      lines.push({
        type: "added",
        text: newRaw,
        newLineNumber: newLineNum++,
      });
      added++;
      j++;
    }
  }

  while (i < n) {
    lines.push({
      type: "removed",
      text: oldLines[i] ?? "",
      oldLineNumber: oldLineNum++,
    });
    removed++;
    i++;
  }

  while (j < m) {
    lines.push({
      type: "added",
      text: newLines[j] ?? "",
      newLineNumber: newLineNum++,
    });
    added++;
    j++;
  }

  const unifiedPatch = lines
    .map((l) => {
      if (l.type === "added") return `+ ${l.text}`;
      if (l.type === "removed") return `- ${l.text}`;
      return `  ${l.text}`;
    })
    .join("\n");

  return { lines, added, removed, unchanged, unifiedPatch };
}
