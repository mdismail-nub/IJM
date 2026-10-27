import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  computeLineDiff,
  dateInputToUnix,
  decodeBase64Text,
  decodeUrlText,
  encodeBase64Text,
  encodeUrlText,
  formatJson,
  generateUuids,
  getLocalTimezoneLabel,
  parseUnixTimestamp,
  type TimestampUnit,
  type UrlEncodeMode,
} from "@/lib/dev-tools";
import { downloadText, formatBytes } from "@/lib/file-utils";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for restricted clipboard contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      disabled={!text}
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-foreground" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
    </button>
  );
}

const SAMPLE_JSON = `{
  "platform": "IJM",
  "privacyFirst": true,
  "categories": ["file-tools", "data-tools", "business-tools", "developer-tools", "student-tools"],
  "limits": {
    "serverUploads": 0,
    "accountRequired": false
  }
}`;

function JsonFormatterTool() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<2 | 4 | "tab">(2);
  const [minify, setMinify] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);

  const result = input.trim() ? formatJson(input, { indent, minify, sortKeys }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            Indentation
            <select
              aria-label="Indentation"
              value={String(indent)}
              disabled={minify}
              onChange={(e) => {
                const v = e.target.value;
                setIndent(v === "tab" ? "tab" : v === "4" ? 4 : 2);
              }}
              className="rounded-xl border bg-card px-3 py-1.5 text-sm font-medium text-foreground"
            >
              <option value="2">2 Spaces</option>
              <option value="4">4 Spaces</option>
              <option value="tab">Tabs</option>
            </select>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={minify}
              onChange={(e) => setMinify(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Minify output
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Sort keys (A–Z)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInput(SAMPLE_JSON)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample JSON
          </button>
          <button
            type="button"
            disabled={!input}
            onClick={() => setInput("")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Invalid JSON Syntax</p>
            <p className="mt-0.5">{result.error}</p>
            {(result.line !== undefined || result.column !== undefined) && (
              <p className="mt-1 text-xs font-medium">
                Detected near line {result.line ?? "?"}, column {result.column ?? "?"}.
              </p>
            )}
          </div>
        </div>
      )}

      {result && result.ok && (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl border bg-primary/25 px-4 py-2.5 text-sm font-medium text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" aria-hidden /> Valid JSON
          </span>
          {result.byteSize !== undefined && (
            <span className="text-xs text-muted-foreground">
              Formatted size: {formatBytes(result.byteSize)}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="json-input" className="text-sm font-semibold text-foreground">
              Raw JSON Input
            </label>
            <span className="text-xs text-muted-foreground">{input.length} chars</span>
          </div>
          <textarea
            id="json-input"
            rows={14}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Paste or type JSON here (e.g. {"hello": "world"})...'
            className="w-full rounded-2xl border bg-background p-4 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="json-output" className="text-sm font-semibold text-foreground">
              Formatted Output
            </label>
            <div className="flex items-center gap-2">
              <CopyButton text={result?.ok ? result.output : ""} label="Copy JSON" />
              <button
                type="button"
                disabled={!result?.ok}
                onClick={() => {
                  if (result?.ok) {
                    downloadText(result.output, "formatted.json", "application/json;charset=utf-8");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download
              </button>
            </div>
          </div>
          <textarea
            id="json-output"
            rows={14}
            readOnly
            value={result?.ok ? result.output : ""}
            placeholder="Formatted or minified JSON will appear here..."
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-sm text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function Base64CodecTool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [urlSafe, setUrlSafe] = useState(false);
  const [input, setInput] = useState("");

  const result =
    input.trim() === ""
      ? null
      : mode === "encode"
        ? encodeBase64Text(input, urlSafe)
        : decodeBase64Text(input);

  const sampleValue =
    mode === "encode"
      ? "IJM — Private browser-side utilities (100% local UTF-8 ✓)"
      : "SUpNIOKAlCBQcml2YXRlIGJyb3dzZXItc2lkZSB1dGlsaXRpZXMgKDEwMCUgbG9jYWwgVVRGLTgg4pyTKQ==";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Base64 operation mode"
            className="inline-flex rounded-full border bg-card p-1"
          >
            <button
              type="button"
              onClick={() => setMode("encode")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === "encode"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Encode to Base64
            </button>
            <button
              type="button"
              onClick={() => setMode("decode")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === "decode"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Decode from Base64
            </button>
          </div>

          {mode === "encode" && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={urlSafe}
                onChange={(e) => setUrlSafe(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              URL-safe Base64 (- and _ without =)
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result?.ok}
            onClick={() => {
              if (result?.ok) {
                setInput(result.output);
                setMode(mode === "encode" ? "decode" : "encode");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Swap Input & Output
          </button>
          <button
            type="button"
            onClick={() => setInput(sampleValue)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample Input
          </button>
          <button
            type="button"
            disabled={!input}
            onClick={() => setInput("")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{result.error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="b64-input" className="block text-sm font-semibold text-foreground">
              {mode === "encode" ? "Plain Text (UTF-8)" : "Base64 String"}
            </label>
          </div>
          <textarea
            id="b64-input"
            rows={10}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "encode"
                ? "Enter plain text to encode into Base64..."
                : "Paste Base64 string to decode back into UTF-8 text..."
            }
            className="w-full rounded-2xl border bg-background p-4 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex min-h-8 items-center justify-between">
            <label htmlFor="b64-output" className="text-sm font-semibold text-foreground">
              {mode === "encode" ? "Base64 Output" : "Decoded Plain Text"}
            </label>
            <CopyButton text={result?.ok ? result.output : ""} />
          </div>
          <textarea
            id="b64-output"
            rows={10}
            readOnly
            value={result?.ok ? result.output : ""}
            placeholder="Result will appear here automatically..."
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-sm text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function UrlEncoderTool() {
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [mode, setMode] = useState<UrlEncodeMode>("component");
  const [input, setInput] = useState("");

  const result =
    input.trim() === ""
      ? null
      : direction === "encode"
        ? encodeUrlText(input, mode)
        : decodeUrlText(input, mode);

  const sampleText =
    direction === "encode"
      ? "https://ijm.dev/tools?search=Merge PDF & Clean CSV#results"
      : "https%3A%2F%2Fijm.dev%2Ftools%3Fsearch%3DMerge%20PDF%20%26%20Clean%20CSV%23results";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="URL operation direction"
            className="inline-flex rounded-full border bg-card p-1"
          >
            <button
              type="button"
              onClick={() => setDirection("encode")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                direction === "encode"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Encode URL
            </button>
            <button
              type="button"
              onClick={() => setDirection("decode")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                direction === "decode"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              Decode URL
            </button>
          </div>

          <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>Mode</span>
            <select
              aria-label="URL Encoding Mode"
              value={mode}
              onChange={(e) => setMode(e.target.value === "uri" ? "uri" : "component")}
              className="w-full min-w-0 max-w-full rounded-xl border bg-card px-3 py-1.5 text-xs font-medium sm:w-auto sm:text-sm"
            >
              <option value="component">URI Component (escapes :, /, ?, &, =)</option>
              <option value="uri">Full URI (preserves URL structure)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!result?.ok}
            onClick={() => {
              if (result?.ok) {
                setInput(result.output);
                setDirection(direction === "encode" ? "decode" : "encode");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Swap
          </button>
          <button
            type="button"
            onClick={() => setInput(sampleText)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sample Input
          </button>
          <button
            type="button"
            disabled={!input}
            onClick={() => setInput("")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      {result && !result.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{result.error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="url-input" className="block text-sm font-semibold text-foreground">
            {direction === "encode" ? "Raw String / URL" : "Percent-Encoded Input"}
          </label>
          <textarea
            id="url-input"
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              direction === "encode"
                ? "Enter query parameter or URL to percent-encode..."
                : "Enter percent-encoded string (e.g. hello%20world)..."
            }
            className="w-full rounded-2xl border bg-background p-4 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="url-output" className="text-sm font-semibold text-foreground">
              {direction === "encode" ? "Encoded Output" : "Decoded Output"}
            </label>
            <CopyButton text={result?.ok ? result.output : ""} />
          </div>
          <textarea
            id="url-output"
            rows={8}
            readOnly
            value={result?.ok ? result.output : ""}
            placeholder="Output will appear here..."
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-sm text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function TimestampConverterTool() {
  const [rawTimestamp, setRawTimestamp] = useState("1793059200");
  const [unit, setUnit] = useState<TimestampUnit>("auto");
  const [dateInput, setDateInput] = useState("2026-10-27T00:00:00");
  const [zoneAssumption, setZoneAssumption] = useState<"utc" | "local">("utc");
  const [nowSec, setNowSec] = useState(1793059200);
  const [detectedTz, setDetectedTz] = useState("UTC");

  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000));
    setDetectedTz(getLocalTimezoneLabel());
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const tsResult = rawTimestamp.trim()
    ? parseUnixTimestamp(rawTimestamp, unit, nowSec * 1000)
    : null;
  const dateResult = dateInput.trim()
    ? dateInputToUnix(dateInput, zoneAssumption, nowSec * 1000)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-ink p-5 text-ink-foreground">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-foreground/70">
            Current Unix Epoch (UTC)
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-primary md:text-3xl">
            {nowSec} <span className="text-sm font-normal text-ink-foreground/70">sec</span>
          </p>
          <p className="mt-1 text-xs text-ink-foreground/70">
            Detected browser timezone: <strong>{detectedTz}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const current = Math.floor(Date.now() / 1000);
              setRawTimestamp(String(current));
              setUnit("seconds");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Use Current Time
          </button>
          <CopyButton text={String(nowSec)} label="Copy Epoch" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Unix Timestamp -> Human Date */}
        <div className="min-w-0 space-y-4 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              1. Unix Timestamp → Human Date
            </h2>
            <button
              type="button"
              onClick={() => setRawTimestamp("")}
              disabled={!rawTimestamp}
              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <label
                htmlFor="unix-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Unix Timestamp
              </label>
              <input
                id="unix-input"
                type="text"
                value={rawTimestamp}
                onChange={(e) => setRawTimestamp(e.target.value)}
                placeholder="e.g. 1793059200 or 1793059200000"
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2.5 font-mono text-sm text-foreground outline-none focus:border-foreground"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="unix-unit"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Input Unit
              </label>
              <select
                id="unix-unit"
                value={unit}
                onChange={(e) =>
                  setUnit(
                    e.target.value === "seconds"
                      ? "seconds"
                      : e.target.value === "milliseconds"
                        ? "milliseconds"
                        : "auto",
                  )
                }
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="auto">Auto-detect (sec / ms)</option>
                <option value="seconds">Seconds (s)</option>
                <option value="milliseconds">Milliseconds (ms)</option>
              </select>
            </div>
          </div>

          {tsResult && !tsResult.ok && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{tsResult.error}</span>
            </div>
          )}

          {tsResult && tsResult.ok && (
            <dl className="divide-y rounded-2xl border bg-muted/30 p-3.5 text-sm sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0">
                <dt className="text-xs font-medium text-muted-foreground">Interpreted Unit</dt>
                <dd className="font-mono text-xs font-semibold uppercase text-foreground">
                  {tsResult.detectedUnit}
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">ISO-8601 (UTC)</dt>
                  <dd className="break-all font-mono text-xs font-semibold text-foreground sm:text-sm">
                    {tsResult.iso8601}
                  </dd>
                </div>
                <CopyButton text={tsResult.iso8601 ?? ""} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">UTC / GMT String</dt>
                  <dd className="break-words font-mono text-xs text-foreground sm:text-sm">
                    {tsResult.utcString}
                  </dd>
                </div>
                <CopyButton text={tsResult.utcString ?? ""} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Local Time ({tsResult.localTimezone})
                  </dt>
                  <dd className="break-words text-xs font-medium text-foreground sm:text-sm">
                    {tsResult.localString}
                  </dd>
                </div>
                <CopyButton text={tsResult.localString ?? ""} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2 last:pb-0">
                <dt className="text-xs font-medium text-muted-foreground">Relative</dt>
                <dd className="text-xs font-semibold text-foreground">{tsResult.relativeTime}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Human Date -> Unix Timestamp */}
        <div className="min-w-0 space-y-4 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">
              2. Date & Time → Unix Timestamp
            </h2>
            <button
              type="button"
              onClick={() => setDateInput("")}
              disabled={!dateInput}
              className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <label
                htmlFor="date-string-input"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Date / ISO-8601 String
              </label>
              <input
                id="date-string-input"
                type="text"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="YYYY-MM-DDTHH:mm:ss"
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2.5 font-mono text-sm text-foreground outline-none focus:border-foreground"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="zone-assumption"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Timezone Assumption
              </label>
              <select
                id="zone-assumption"
                value={zoneAssumption}
                onChange={(e) => setZoneAssumption(e.target.value === "local" ? "local" : "utc")}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm font-medium text-foreground"
              >
                <option value="utc">Interpret as UTC (Z)</option>
                <option value="local">Interpret as Local Timezone</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Timezone assumption applies when your input does not include an explicit offset (such as{" "}
            <code className="font-mono">Z</code> or <code className="font-mono">+02:00</code>).
          </p>

          {dateResult && !dateResult.ok && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{dateResult.error}</span>
            </div>
          )}

          {dateResult && dateResult.ok && (
            <dl className="divide-y rounded-2xl border bg-muted/30 p-3.5 text-sm sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Unix Seconds (s)</dt>
                  <dd className="break-all font-mono text-base font-bold text-foreground sm:text-lg">
                    {dateResult.unixSeconds}
                  </dd>
                </div>
                <CopyButton text={String(dateResult.unixSeconds ?? "")} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">
                    Unix Milliseconds (ms)
                  </dt>
                  <dd className="break-all font-mono text-base font-bold text-foreground sm:text-lg">
                    {dateResult.unixMilliseconds}
                  </dd>
                </div>
                <CopyButton text={String(dateResult.unixMilliseconds ?? "")} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 last:pb-0">
                <dt className="text-xs font-medium text-muted-foreground">Resolved ISO-8601</dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {dateResult.iso8601}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

function UuidGeneratorTool() {
  const [countInput, setCountInput] = useState("5");
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [quotes, setQuotes] = useState(false);
  const [seedCounter, setSeedCounter] = useState(0);
  const [result, setResult] = useState<{
    ok: boolean;
    uuids: string[];
    error?: string;
  }>({ ok: true, uuids: [] });

  useEffect(() => {
    const parsedCount = Number.parseInt(countInput, 10);
    setResult(
      generateUuids(parsedCount, {
        uppercase,
        hyphens,
        braces,
        quotes,
      }),
    );
  }, [countInput, uppercase, hyphens, braces, quotes, seedCounter]);

  const outputText = result.ok ? result.uuids.join("\n") : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            Quantity (1–500)
            <input
              type="number"
              min={1}
              max={500}
              aria-label="UUID Quantity"
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              className="w-24 rounded-xl border bg-card px-3 py-1.5 font-mono text-sm text-foreground"
            />
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={hyphens}
              onChange={(e) => setHyphens(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Hyphens
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            UPPERCASE
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={braces}
              onChange={(e) => setBraces(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            {"{Braces}"}
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={quotes}
              onChange={(e) => setQuotes(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            "Quotes"
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSeedCounter((c) => c + 1)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Regenerate UUIDs
          </button>
          <CopyButton text={outputText} label="Copy All" />
          <button
            type="button"
            disabled={!result.ok}
            onClick={() => downloadText(outputText, "uuids.txt")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Download .txt
          </button>
        </div>
      </div>

      {!result.ok && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{result.error}</span>
        </div>
      )}

      {result.ok && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
            <span>
              Generated {result.uuids.length} cryptographic v4{" "}
              {result.uuids.length === 1 ? "UUID" : "UUIDs"} via Web Crypto API
            </span>
          </div>
          <ul className="mt-3 max-h-96 divide-y overflow-y-auto font-mono text-sm">
            {result.uuids.map((id, idx) => (
              <li
                key={`${id}-${idx}`}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <span className="truncate text-foreground">{id}</span>
                <CopyButton text={id} label="Copy" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const SAMPLE_DIFF_OLD = `function calculateTotal(items) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.qty;
  }
  return subtotal;
}`;

const SAMPLE_DIFF_NEW = `function calculateTotal(items, taxRate = 0.15) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
  }
  const tax = subtotal * taxRate;
  return subtotal + tax;
}`;

function DiffCheckerTool() {
  const [original, setOriginal] = useState("");
  const [modified, setModified] = useState("");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);

  const hasContent = original !== "" || modified !== "";
  const diff = hasContent
    ? computeLineDiff(original, modified, { ignoreWhitespace, ignoreCase })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={ignoreWhitespace}
              onChange={(e) => setIgnoreWhitespace(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Ignore extra whitespace
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(e) => setIgnoreCase(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Ignore case
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => {
              const temp = original;
              setOriginal(modified);
              setModified(temp);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Swap Texts
          </button>
          <button
            type="button"
            onClick={() => {
              setOriginal(SAMPLE_DIFF_OLD);
              setModified(SAMPLE_DIFF_NEW);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Load Sample
          </button>
          <button
            type="button"
            disabled={!hasContent}
            onClick={() => {
              setOriginal("");
              setModified("");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="diff-original" className="block text-sm font-semibold text-foreground">
            Original Text
          </label>
          <textarea
            id="diff-original"
            rows={10}
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="Paste original text here..."
            className="w-full rounded-2xl border bg-background p-4 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="diff-modified" className="block text-sm font-semibold text-foreground">
            Modified Text
          </label>
          <textarea
            id="diff-modified"
            rows={10}
            value={modified}
            onChange={(e) => setModified(e.target.value)}
            placeholder="Paste modified text here..."
            className="w-full rounded-2xl border bg-background p-4 font-mono text-sm text-foreground outline-none focus:border-foreground"
          />
        </div>
      </div>

      {diff && (
        <div className="rounded-3xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <span className="rounded-full bg-primary/40 px-3 py-1 text-foreground">
                +{diff.added} added
              </span>
              <span className="rounded-full bg-destructive/15 px-3 py-1 text-destructive">
                -{diff.removed} removed
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {diff.unchanged} unchanged
              </span>
            </div>
            <CopyButton text={diff.unifiedPatch} label="Copy Unified Diff" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border bg-background font-mono text-xs">
            {diff.lines.map((line, idx) => {
              const rowStyle =
                line.type === "added"
                  ? "bg-primary/25 text-foreground"
                  : line.type === "removed"
                    ? "bg-destructive/15 text-destructive"
                    : "text-foreground/80";
              const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
              return (
                <div
                  key={idx}
                  className={`grid grid-cols-[3rem_3rem_1.5rem_1fr] items-baseline border-b px-3 py-1 last:border-b-0 ${rowStyle}`}
                >
                  <span className="select-none text-right pr-2 text-muted-foreground">
                    {line.oldLineNumber ?? ""}
                  </span>
                  <span className="select-none text-right pr-2 text-muted-foreground">
                    {line.newLineNumber ?? ""}
                  </span>
                  <span className="select-none font-bold">{prefix}</span>
                  <span className="whitespace-pre-wrap break-all">{line.text || " "}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DeveloperToolWorkspace({ toolSlug }: { toolSlug: string }) {
  switch (toolSlug) {
    case "json-formatter":
      return <JsonFormatterTool />;
    case "base64-codec":
      return <Base64CodecTool />;
    case "url-encoder":
      return <UrlEncoderTool />;
    case "timestamp-converter":
      return <TimestampConverterTool />;
    case "uuid-generator":
      return <UuidGeneratorTool />;
    case "diff-checker":
      return <DiffCheckerTool />;
    default:
      return null;
  }
}
