export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  allowedMimePrefixes?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB default limit

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const val = bytes / Math.pow(k, i);
  const formatted = i === 0 ? Math.round(val).toString() : val.toFixed(val >= 10 ? 1 : 2);
  return `${formatted} ${units[i] ?? "B"}`;
}

export function getFileExtension(filename: string): string {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function sanitizeFilename(name: string, fallback = "download"): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}

export function validateFile(
  file: { name: string; size: number; type?: string },
  options: FileValidationOptions = {},
): FileValidationResult {
  const maxBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  if (!file || typeof file.name !== "string" || file.name.trim() === "") {
    return { valid: false, error: "Invalid file selected." };
  }

  if (file.size <= 0) {
    return { valid: false, error: `"${file.name}" is empty (0 bytes).` };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `"${file.name}" (${formatBytes(file.size)}) exceeds the maximum size limit of ${formatBytes(maxBytes)}.`,
    };
  }

  const ext = getFileExtension(file.name);
  if (options.allowedExtensions && options.allowedExtensions.length > 0) {
    const normalizedAllowed = options.allowedExtensions.map((e) =>
      e.replace(/^\./, "").toLowerCase(),
    );
    if (!ext || !normalizedAllowed.includes(ext)) {
      return {
        valid: false,
        error: `"${file.name}" has an unsupported file type. Accepted formats: ${normalizedAllowed.map((e) => `.${e}`).join(", ")}.`,
      };
    }
  }

  if (options.allowedMimePrefixes && options.allowedMimePrefixes.length > 0 && file.type) {
    const mime = file.type.toLowerCase();
    const matchesMime = options.allowedMimePrefixes.some((prefix) =>
      mime.startsWith(prefix.toLowerCase()),
    );
    if (!matchesMime) {
      return {
        valid: false,
        error: `"${file.name}" (${file.type}) is not a supported format.`,
      };
    }
  }

  return { valid: true };
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mimeType = "application/octet-stream",
): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  downloadBlob(blob, filename);
}

const RECENT_TOOLS_KEY = "utilitydock_recent_tools_v1";
const MAX_RECENT_TOOLS = 6;

export function getRecentToolSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_TOOLS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function recordRecentTool(slug: string): string[] {
  if (typeof window === "undefined" || !slug.trim()) return [];
  try {
    const existing = getRecentToolSlugs().filter((item) => item !== slug);
    const updated = [slug, ...existing].slice(0, MAX_RECENT_TOOLS);
    window.localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearRecentTools(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_TOOLS_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}
