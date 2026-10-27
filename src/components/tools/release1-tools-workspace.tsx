import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FileDropzone } from "@/components/file-dropzone";
import { downloadBlob, downloadText } from "@/lib/file-utils";
import {
  analyzeTextCounts,
  buildUtmUrl,
  calculateCgpa,
  calculateLoanEmi,
  calculateProfitMargin,
  calculateSalaryBreakdown,
  calculateSemesterGpa,
  calculateUnixPermissions,
  calculateWeightedGrade,
  convertColorValue,
  convertTextCase,
  decodeJwtToken,
  explainAndPreviewCron,
  findAndReplaceText,
  generateLoremIpsum,
  generateMetaTagsHtml,
  generateQrCodeAssets,
  generateSecurePassword,
  generateUrlSlug,
  removeDuplicateLines,
  removeLineBreaks,
  searchHttpStatusCodes,
  sortTextLines,
  testRegularExpression,
  type CaseConversionMode,
  type ChmodMatrix,
  type CourseGpaEntry,
  type GradeAssessmentItem,
  type SalaryPayPeriod,
  type SemesterEntry,
  type TextSortMode,
} from "@/lib/release1-tools";

export const RELEASE_1_TOOL_SLUGS = new Set([
  "word-counter",
  "case-converter",
  "remove-line-breaks",
  "find-replace",
  "text-sorter",
  "duplicate-line-remover",
  "lorem-ipsum-generator",
  "cgpa-calculator",
  "gpa-calculator",
  "grade-calculator",
  "exam-countdown",
  "pomodoro-timer",
  "profit-margin-calculator",
  "loan-emi-calculator",
  "salary-calculator",
  "regex-tester",
  "jwt-decoder",
  "cron-builder",
  "color-converter",
  "chmod-calculator",
  "http-status-lookup",
  "password-generator",
  "meta-tag-generator",
  "slug-generator",
  "utm-builder",
  "qr-code-generator",
  "favicon-generator",
]);

export function isRelease1ToolSlug(slug: string): boolean {
  return RELEASE_1_TOOL_SLUGS.has(slug);
}

// ============================================================================
// Group 1A: Text & Writing Workspaces
// ============================================================================

function WordCounterWorkspace() {
  const [text, setText] = useState(
    "IJM processes documents, spreadsheets, and text directly in your browser. Because every tool runs locally on your device, your drafts and sensitive notes never touch an external server.\n\nPaste or type your article, essay, or social post here to see instant word counts, character counts, reading time estimates, and top recurring keywords.",
  );
  const [copied, setCopied] = useState(false);
  const stats = analyzeTextCounts(text);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Words", stats.words],
          ["Characters", stats.characters],
          ["No Spaces", stats.charactersNoSpaces],
          ["Sentences", stats.sentences],
          ["Paragraphs", stats.paragraphs],
          ["Lines", stats.lines],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-2xl border bg-background p-4 text-center">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-foreground">{val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-foreground">
            Reading time (~225 wpm): <strong>{stats.readingTimeMinutes} min</strong>
          </span>
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-foreground">
            Speaking time (~130 wpm): <strong>{stats.speakingTimeMinutes} min</strong>
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!text}
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 font-semibold text-foreground hover:bg-muted disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Text"}
          </button>
          <button
            type="button"
            disabled={!text}
            onClick={() => setText("")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      <textarea
        rows={10}
        aria-label="Text to count"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste your text here..."
        className="w-full rounded-2xl border bg-background p-4 text-sm text-foreground outline-none focus:border-foreground"
      />

      {stats.topKeywords.length > 0 && (
        <div className="rounded-2xl border bg-muted/30 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Top Keywords (excluding common stop words)
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {stats.topKeywords.map((kw) => (
              <span
                key={kw.word}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground"
              >
                <span>{kw.word}</span>
                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
                  {kw.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CaseConverterWorkspace() {
  const [input, setInput] = useState(
    "convert THIS sample Heading into ANY naming convention or text case.",
  );
  const [mode, setMode] = useState<CaseConversionMode>("title");
  const [copied, setCopied] = useState(false);

  const output = convertTextCase(input, mode);

  const modes: [CaseConversionMode, string][] = [
    ["upper", "UPPERCASE"],
    ["lower", "lowercase"],
    ["title", "Title Case"],
    ["sentence", "Sentence case"],
    ["camel", "camelCase"],
    ["pascal", "PascalCase"],
    ["snake", "snake_case"],
    ["kebab", "kebab-case"],
    ["constant", "CONSTANT_CASE"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {modes.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Input Text</label>
            <button
              type="button"
              onClick={() => setInput("")}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <textarea
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-2xl border bg-background p-4 text-sm outline-none focus:border-foreground"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Converted Output</label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!output}
                onClick={() => {
                  void navigator.clipboard?.writeText(output);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                disabled={!output}
                onClick={() => downloadText(output, `converted-${mode}.txt`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1 text-xs font-semibold text-background disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>
          <textarea
            rows={8}
            readOnly
            value={output}
            className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-sm outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function RemoveLineBreaksWorkspace() {
  const [input, setInput] = useState(
    "This paragraph was copied from a PDF\nwhere every single line\nhas an awkward hard line break.\n\nAnd this is a second paragraph\nthat should stay separated.",
  );
  const [mode, setMode] = useState<"all" | "preserve-paragraphs">("preserve-paragraphs");
  const [separator, setSeparator] = useState(" ");
  const output = removeLineBreaks(input, mode, separator);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("preserve-paragraphs")}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              mode === "preserve-paragraphs"
                ? "bg-primary text-primary-foreground"
                : "border bg-card"
            }`}
          >
            Preserve Paragraph Breaks (Double Newlines)
          </button>
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              mode === "all" ? "bg-primary text-primary-foreground" : "border bg-card"
            }`}
          >
            Remove All Line Breaks
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          Join Separator:
          <input
            type="text"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="w-20 rounded-xl border bg-card px-2.5 py-1 font-mono text-xs"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <textarea
          rows={9}
          aria-label="Input text with line breaks"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-2xl border bg-background p-4 text-sm"
        />
        <textarea
          rows={9}
          aria-label="Cleaned output text"
          readOnly
          value={output}
          className="w-full rounded-2xl border bg-muted/30 p-4 text-sm"
        />
      </div>
    </div>
  );
}

function FindReplaceWorkspace() {
  const [text, setText] = useState(
    "Order #1042: 3 widgets at $19.99.\nOrder #1043: 5 widgets at $19.99.",
  );
  const [findStr, setFindStr] = useState("widgets");
  const [replaceStr, setReplaceStr] = useState("licences");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceAll, setReplaceAll] = useState(true);

  const res = findAndReplaceText(text, findStr, replaceStr, {
    useRegex,
    caseSensitive,
    replaceAll,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">Find What</label>
          <input
            type="text"
            value={findStr}
            onChange={(e) => setFindStr(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">Replace With</label>
          <input
            type="text"
            value={replaceStr}
            onChange={(e) => setReplaceStr(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col justify-center gap-1.5 text-xs font-medium sm:col-span-2">
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              Regular Expression
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Case sensitive
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
              />
              Replace all occurrences
            </label>
          </div>
          <p className="text-xs font-semibold text-foreground">
            Matches replaced: {res.matchCount}
          </p>
        </div>
      </div>

      {!res.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <textarea
          rows={9}
          aria-label="Source text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-2xl border bg-background p-4 font-mono text-xs"
        />
        <textarea
          rows={9}
          aria-label="Replaced output"
          readOnly
          value={res.output}
          className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs"
        />
      </div>
    </div>
  );
}

function TextSorterWorkspace() {
  const [text, setText] = useState("Zebra\nApple\nMango\nBanana\nApricot\nBlueberry");
  const [mode, setMode] = useState<TextSortMode>("az");
  const [removeEmpty, setRemoveEmpty] = useState(true);
  const [trimLines, setTrimLines] = useState(true);

  const res = sortTextLines(text, mode, { removeEmpty, trimLines });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["az", "A → Z"],
              ["za", "Z → A"],
              ["numeric-asc", "Numeric (Low → High)"],
              ["numeric-desc", "Numeric (High → Low)"],
              ["length-asc", "Shortest → Longest"],
              ["length-desc", "Longest → Shortest"],
              ["reverse", "Reverse Line Order"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                mode === m ? "bg-primary text-primary-foreground" : "border bg-card text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 text-xs font-medium">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={trimLines}
              onChange={(e) => setTrimLines(e.target.checked)}
            />
            Trim whitespace
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={removeEmpty}
              onChange={(e) => setRemoveEmpty(e.target.checked)}
            />
            Remove blank lines
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <textarea
          rows={9}
          aria-label="Unsorted lines"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-2xl border bg-background p-4 font-mono text-xs"
        />
        <textarea
          rows={9}
          aria-label="Sorted lines"
          readOnly
          value={res.output}
          className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs"
        />
      </div>
    </div>
  );
}

function DuplicateLineRemoverWorkspace() {
  const [text, setText] = useState(
    "alice@example.com\nbob@example.com\nALICE@example.com\ncarol@example.com\nbob@example.com",
  );
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [trimLines, setTrimLines] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);

  const res = removeDuplicateLines(text, {
    caseInsensitive,
    trimLines,
    removeEmpty,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4 text-xs">
        <div className="flex flex-wrap gap-4 font-medium">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={caseInsensitive}
              onChange={(e) => setCaseInsensitive(e.target.checked)}
            />
            Case-insensitive matching
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={trimLines}
              onChange={(e) => setTrimLines(e.target.checked)}
            />
            Trim leading/trailing spaces
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={removeEmpty}
              onChange={(e) => setRemoveEmpty(e.target.checked)}
            />
            Remove empty lines
          </label>
        </div>
        <span className="rounded-full bg-primary px-3.5 py-1 font-bold text-primary-foreground">
          {res.originalCount} lines → {res.uniqueCount} unique ({res.removedCount} removed)
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <textarea
          rows={9}
          aria-label="Input lines"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-2xl border bg-background p-4 font-mono text-xs"
        />
        <textarea
          rows={9}
          aria-label="Deduplicated lines"
          readOnly
          value={res.output}
          className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs"
        />
      </div>
    </div>
  );
}

function LoremIpsumWorkspace() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [startWithClassic, setStartWithClassic] = useState(true);
  const [wrapHtmlP, setWrapHtmlP] = useState(false);
  const [copied, setCopied] = useState(false);

  const output = generateLoremIpsum(count, unit, {
    startWithClassic,
    wrapHtmlP,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={50}
            aria-label="Quantity"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 rounded-xl border bg-card px-3 py-1.5 font-mono text-sm font-bold"
          />
          <select
            aria-label="Unit"
            value={unit}
            onChange={(e) =>
              setUnit(
                e.target.value === "sentences"
                  ? "sentences"
                  : e.target.value === "words"
                    ? "words"
                    : "paragraphs",
              )
            }
            className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold"
          >
            <option value="paragraphs">Paragraphs</option>
            <option value="sentences">Sentences</option>
            <option value="words">Words</option>
          </select>

          <label className="inline-flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={startWithClassic}
              onChange={(e) => setStartWithClassic(e.target.checked)}
            />
            Start with &ldquo;Lorem ipsum dolor sit amet...&rdquo;
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={wrapHtmlP}
              onChange={(e) => setWrapHtmlP(e.target.checked)}
            />
            Wrap in HTML &lt;p&gt; tags
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied Lorem Ipsum" : "Copy Lorem Ipsum"}
        </button>
      </div>

      <textarea
        rows={10}
        readOnly
        aria-label="Generated Lorem Ipsum"
        value={output}
        className="w-full rounded-2xl border bg-background p-4 text-sm leading-relaxed"
      />
    </div>
  );
}

// ============================================================================
// Group 1B: Student & Academic Calculators & Timers
// ============================================================================

function CgpaCalculatorWorkspace() {
  const [scaleMax, setScaleMax] = useState<4 | 5 | 10>(4);
  const [semesters, setSemesters] = useState<SemesterEntry[]>([
    { id: "sem-1", name: "Semester 1", gpa: 3.65, credits: 16 },
    { id: "sem-2", name: "Semester 2", gpa: 3.8, credits: 18 },
    { id: "sem-3", name: "Semester 3", gpa: 3.9, credits: 15 },
  ]);

  const res = calculateCgpa(semesters, scaleMax);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span>Grading Scale Maximum:</span>
          {([4, 5, 10] as const).map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={() => setScaleMax(sc)}
              className={`rounded-full px-3.5 py-1 ${
                scaleMax === sc ? "bg-primary text-primary-foreground" : "border bg-card"
              }`}
            >
              {sc}.0 Scale
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setSemesters((prev) => [
              ...prev,
              {
                id: `sem-${Date.now()}`,
                name: `Semester ${prev.length + 1}`,
                gpa: Math.min(scaleMax, 3.5),
                credits: 15,
              },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background"
        >
          <Plus className="h-3.5 w-3.5" /> Add Semester
        </button>
      </div>

      {!res.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {semesters.map((sem, idx) => (
            <div
              key={sem.id}
              className="grid gap-3 rounded-2xl border bg-background p-3.5 sm:grid-cols-12 sm:items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Term Name
                </label>
                <input
                  type="text"
                  value={sem.name}
                  onChange={(e) =>
                    setSemesters((prev) =>
                      prev.map((s) => (s.id === sem.id ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Semester GPA (max {scaleMax}.0)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={scaleMax}
                  value={sem.gpa}
                  onChange={(e) =>
                    setSemesters((prev) =>
                      prev.map((s) =>
                        s.id === sem.id ? { ...s, gpa: Number(e.target.value) } : s,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Credits / Units
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  value={sem.credits}
                  onChange={(e) =>
                    setSemesters((prev) =>
                      prev.map((s) =>
                        s.id === sem.id ? { ...s, credits: Number(e.target.value) } : s,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="flex justify-end sm:col-span-1">
                <button
                  type="button"
                  disabled={semesters.length <= 1}
                  aria-label={`Remove ${sem.name || idx + 1}`}
                  onClick={() => setSemesters((prev) => prev.filter((s) => s.id !== sem.id))}
                  className="rounded-xl border p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4 lg:col-span-5">
          <h3 className="text-base font-bold">Cumulative GPA Result</h3>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-wider opacity-85">
              Cumulative GPA (on {scaleMax}.0 scale)
            </p>
            <p className="mt-1 font-mono text-4xl font-extrabold">{res.cgpa.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border bg-background p-3.5">
              <p className="text-muted-foreground">Total Credits</p>
              <p className="mt-1 font-mono text-lg font-bold">{res.totalCredits}</p>
            </div>
            <div className="rounded-2xl border bg-background p-3.5">
              <p className="text-muted-foreground">Scale Ratio</p>
              <p className="mt-1 font-mono text-lg font-bold">{res.percentageEquivalent}%</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calculated as total quality points ({res.totalQualityPoints}) divided by total credit
            hours ({res.totalCredits}). Verify your university&apos;s official conversion table for
            transcript equivalence.
          </p>
        </div>
      </div>
    </div>
  );
}

function GpaCalculatorWorkspace() {
  const [courses, setCourses] = useState<CourseGpaEntry[]>([
    { id: "c-1", courseName: "Data Structures", gradePoints: 4.0, credits: 4 },
    { id: "c-2", courseName: "Linear Algebra", gradePoints: 3.7, credits: 3 },
    { id: "c-3", courseName: "Computer Networks", gradePoints: 3.3, credits: 4 },
    { id: "c-4", courseName: "Technical Writing", gradePoints: 4.0, credits: 2 },
  ]);

  const res = calculateSemesterGpa(courses, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select letter grades or enter numeric grade points (0.0–4.0) and credit hours.
        </p>
        <button
          type="button"
          onClick={() =>
            setCourses((prev) => [
              ...prev,
              {
                id: `c-${Date.now()}`,
                courseName: `Course ${prev.length + 1}`,
                gradePoints: 4.0,
                credits: 3,
              },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Course
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {courses.map((c) => (
            <div
              key={c.id}
              className="grid gap-3 rounded-2xl border bg-background p-3.5 sm:grid-cols-12 sm:items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Course Name
                </label>
                <input
                  type="text"
                  value={c.courseName}
                  onChange={(e) =>
                    setCourses((prev) =>
                      prev.map((item) =>
                        item.id === c.id ? { ...item, courseName: e.target.value } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Grade (4.0 Scale)
                </label>
                <select
                  value={String(c.gradePoints)}
                  onChange={(e) =>
                    setCourses((prev) =>
                      prev.map((item) =>
                        item.id === c.id ? { ...item, gradePoints: Number(e.target.value) } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs font-semibold"
                >
                  <option value="4">A / A+ (4.0)</option>
                  <option value="3.7">A- (3.7)</option>
                  <option value="3.3">B+ (3.3)</option>
                  <option value="3">B (3.0)</option>
                  <option value="2.7">B- (2.7)</option>
                  <option value="2.3">C+ (2.3)</option>
                  <option value="2">C (2.0)</option>
                  <option value="1.7">C- (1.7)</option>
                  <option value="1">D (1.0)</option>
                  <option value="0">F (0.0)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Credits
                </label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={c.credits}
                  onChange={(e) =>
                    setCourses((prev) =>
                      prev.map((item) =>
                        item.id === c.id ? { ...item, credits: Number(e.target.value) } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="flex justify-end sm:col-span-1">
                <button
                  type="button"
                  disabled={courses.length <= 1}
                  onClick={() => setCourses((prev) => prev.filter((item) => item.id !== c.id))}
                  className="rounded-xl border p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4 lg:col-span-5">
          <h3 className="text-base font-bold">Semester GPA Summary</h3>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-wider opacity-85">Semester GPA</p>
            <p className="mt-1 font-mono text-4xl font-extrabold">{res.gpa.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border bg-background p-3.5">
              <p className="text-muted-foreground">Semester Credits</p>
              <p className="mt-1 font-mono text-lg font-bold">{res.totalCredits}</p>
            </div>
            <div className="rounded-2xl border bg-background p-3.5">
              <p className="text-muted-foreground">Quality Points</p>
              <p className="mt-1 font-mono text-lg font-bold">{res.totalPoints}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeCalculatorWorkspace() {
  const [items, setItems] = useState<GradeAssessmentItem[]>([
    { id: "g-1", name: "Homework & Labs", scorePercent: 94, weightPercent: 25 },
    { id: "g-2", name: "Midterm Exam", scorePercent: 86, weightPercent: 35 },
  ]);
  const [targetOverall, setTargetOverall] = useState(90);

  const res = calculateWeightedGrade(items, targetOverall);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          Target Overall Course Grade (%):
          <input
            type="number"
            min={0}
            max={100}
            value={targetOverall}
            onChange={(e) => setTargetOverall(Number(e.target.value))}
            className="w-20 rounded-xl border bg-card px-3 py-1.5 font-mono text-sm font-bold"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              {
                id: `g-${Date.now()}`,
                name: `Assessment ${prev.length + 1}`,
                scorePercent: 85,
                weightPercent: 15,
              },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Graded Item
        </button>
      </div>

      {!res.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-2xl border bg-background p-3.5 sm:grid-cols-12 sm:items-end"
            >
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Assignment / Exam
                </label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Score (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={150}
                  value={item.scorePercent}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.id === item.id ? { ...x, scorePercent: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Weight (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={item.weightPercent}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.id === item.id ? { ...x, weightPercent: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="flex justify-end sm:col-span-1">
                <button
                  type="button"
                  disabled={items.length <= 1}
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                  className="rounded-xl border p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4 lg:col-span-5">
          <h3 className="text-base font-bold">Weighted Grade & Final Target</h3>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-wider opacity-85">
              Current Average ({res.completedWeightPercent}% of course graded)
            </p>
            <p className="mt-1 font-mono text-3xl font-extrabold">
              {res.currentWeightedAverage}% ({res.letterEstimate})
            </p>
          </div>
          {res.requiredOnRemainingPercent !== null && (
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Score Needed on Remaining {res.remainingWeightPercent}% (Final Exam) for{" "}
                {targetOverall}%:
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                {res.requiredOnRemainingPercent}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExamCountdownWorkspace() {
  const [exams, setExams] = useState([
    {
      id: "ex-1",
      title: "Algorithms Final Exam",
      date: "2026-11-15T09:00",
      location: "Hall B — Room 204",
    },
    {
      id: "ex-2",
      title: "Database Systems Project Defense",
      date: "2026-11-22T14:00",
      location: "Engineering Lab 3",
    },
  ]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("2026-12-01T09:00");

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-5">
          <label className="block text-xs font-semibold text-muted-foreground">
            Exam or Deadline Name
          </label>
          <input
            type="text"
            placeholder="e.g. Organic Chemistry Midterm"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs"
          />
        </div>
        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-muted-foreground">
            Exam Date & Time
          </label>
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="button"
            onClick={() => {
              if (!newTitle.trim()) return;
              setExams((prev) => [
                ...prev,
                {
                  id: `ex-${Date.now()}`,
                  title: newTitle.trim(),
                  date: newDate,
                  location: "Main Campus",
                },
              ]);
              setNewTitle("");
            }}
            className="w-full rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            + Add Countdown
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {exams.map((ex) => {
          const targetMs = new Date(ex.date).getTime();
          const diff =
            nowMs !== null && Number.isFinite(targetMs) ? Math.max(0, targetMs - nowMs) : 0;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          const secs = Math.floor((diff / 1000) % 60);

          return (
            <div key={ex.id} className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{ex.title}</h3>
                  <p className="font-mono text-xs text-muted-foreground">
                    {ex.date.replace("T", " at ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExams((prev) => prev.filter((item) => item.id !== ex.id))}
                  className="rounded-lg border p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ["Days", days],
                  ["Hours", hours],
                  ["Mins", mins],
                  ["Secs", secs],
                ].map(([label, v]) => (
                  <div key={String(label)} className="rounded-2xl bg-muted/60 p-3">
                    <p className="font-mono text-2xl font-extrabold text-foreground">
                      {nowMs === null ? "--" : v}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PomodoroTimerWorkspace() {
  const [mode, setMode] = useState<"focus" | "short" | "long">("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [taskName, setTaskName] = useState("Complete Chapter 4 Practice Problems");

  const durations = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (mode === "focus") {
            setCompletedPomodoros((c) => c + 1);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode]);

  const switchMode = (next: "focus" | "short" | "long") => {
    setRunning(false);
    setMode(next);
    setSecondsLeft(durations[next]);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="inline-flex rounded-full border bg-muted/40 p-1.5">
        {(
          [
            ["focus", "Focus Sprint (25m)"],
            ["short", "Short Break (5m)"],
            ["long", "Long Break (15m)"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
              mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-[2.5rem] border bg-card p-10 shadow-card space-y-6">
        <input
          type="text"
          aria-label="Current study task"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          className="mx-auto block w-full max-w-md rounded-xl border bg-background px-4 py-2 text-center text-sm font-semibold"
        />

        <p className="font-mono text-7xl font-extrabold tracking-tight text-foreground md:text-8xl">
          {mm}:{ss}
        </p>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-sm"
          >
            {running ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start Timer
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSecondsLeft(durations[mode]);
            }}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-6 py-3 text-sm font-semibold text-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>

        <p className="text-xs font-semibold text-muted-foreground">
          Completed Focus Sessions Today: <strong>{completedPomodoros}</strong>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Group 1C: Business & Finance Workspaces
// ============================================================================

function ProfitMarginWorkspace() {
  const [cost, setCost] = useState(65);
  const [revenue, setRevenue] = useState(110);
  const [targetMargin, setTargetMargin] = useState(45);

  const res = calculateProfitMargin({
    cost,
    revenue,
    targetMarginPercent: targetMargin,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
        <h2 className="text-base font-bold">Cost & Selling Price Inputs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Unit Cost ($)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2.5 font-mono text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Selling Price / Revenue ($)
            </label>
            <input
              type="number"
              min={0.01}
              step="any"
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2.5 font-mono text-sm font-bold"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            Target Profit Margin (%) — Price Finder
          </label>
          <input
            type="number"
            min={0}
            max={99}
            step="any"
            value={targetMargin}
            onChange={(e) => setTargetMargin(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
        <h3 className="text-base font-bold">Margin & Markup Breakdown</h3>
        {!res.ok ? (
          <p className="text-xs text-destructive">{res.error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
              <p className="text-xs font-bold uppercase">Gross Profit</p>
              <p className="mt-1 font-mono text-2xl font-extrabold">
                ${res.grossProfit.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-semibold text-muted-foreground">Gross Margin (%)</p>
              <p className="mt-1 font-mono text-2xl font-bold">{res.profitMarginPercent}%</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-semibold text-muted-foreground">Markup on Cost (%)</p>
              <p className="mt-1 font-mono text-xl font-bold">{res.markupPercent}%</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Price for {targetMargin}% Margin
              </p>
              <p className="mt-1 font-mono text-xl font-bold">
                {res.priceForTargetMargin !== null
                  ? `$${res.priceForTargetMargin.toFixed(2)}`
                  : "-"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoanEmiWorkspace() {
  const [principal, setPrincipal] = useState(25000);
  const [annualRate, setAnnualRate] = useState(6.5);
  const [tenureMonths, setTenureMonths] = useState(36);

  const res = calculateLoanEmi({
    principal,
    annualRatePercent: annualRate,
    tenureMonths,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
          <h2 className="text-base font-bold">Loan Parameters</h2>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Loan Principal Amount ($)
            </label>
            <input
              type="number"
              min={1}
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Annual Interest Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={annualRate}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Tenure (Months)
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Monthly EMI Summary</h3>
            {res.ok && (
              <button
                type="button"
                onClick={() => {
                  const lines = [
                    "Month,Payment,Principal,Interest,Remaining Balance",
                    ...res.schedule.map(
                      (r) =>
                        `${r.month},${r.payment},${r.principalPaid},${r.interestPaid},${r.remainingBalance}`,
                    ),
                  ];
                  downloadText(lines.join("\n"), "loan-amortization.csv", "text/csv;charset=utf-8");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3.5 py-1 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> Export Schedule CSV
              </button>
            )}
          </div>
          {!res.ok ? (
            <p className="text-xs text-destructive">{res.error}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                <p className="text-[11px] font-bold uppercase">Monthly EMI</p>
                <p className="mt-1 font-mono text-xl font-extrabold">
                  ${res.monthlyEmi.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-[11px] font-semibold text-muted-foreground">Total Interest</p>
                <p className="mt-1 font-mono text-lg font-bold">
                  ${res.totalInterest.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-[11px] font-semibold text-muted-foreground">Total Payable</p>
                <p className="mt-1 font-mono text-lg font-bold">
                  ${res.totalPayment.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SalaryCalculatorWorkspace() {
  const [amount, setAmount] = useState(95000);
  const [period, setPeriod] = useState<SalaryPayPeriod>("annual");
  const [hoursPerWeek, setHoursPerWeek] = useState(40);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [weeksPerYear, setWeeksPerYear] = useState(52);
  const [taxRatePercent, setTaxRatePercent] = useState(22);
  const [retirementPercent, setRetirementPercent] = useState(5);

  const res = calculateSalaryBreakdown({
    amount,
    period,
    hoursPerWeek,
    daysPerWeek,
    weeksPerYear,
    taxRatePercent,
    retirementPercent,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
          <h2 className="text-base font-bold">Gross Pay & Schedule Assumptions</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Pay Amount ($)
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Pay Frequency
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as SalaryPayPeriod)}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-xs font-semibold"
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Hours / Week
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Effect. Tax (%)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Retirement (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={retirementPercent}
                onChange={(e) => setRetirementPercent(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Assumes {daysPerWeek} workdays/week and {weeksPerYear} paid weeks/year with
            user-configured flat effective tax/deduction rates.
          </p>
        </div>

        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-3 lg:col-span-6">
          <h3 className="text-base font-bold">Gross vs. Estimated Net Pay</h3>
          {res.ok && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Period</th>
                    <th className="py-2 text-right">Gross Pay</th>
                    <th className="py-2 text-right">Est. Net Take-Home</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {(
                    [
                      ["annual", "Annual"],
                      ["monthly", "Monthly"],
                      ["biweekly", "Biweekly"],
                      ["weekly", "Weekly"],
                      ["daily", "Daily"],
                      ["hourly", "Hourly"],
                    ] as const
                  ).map(([k, label]) => (
                    <tr key={k}>
                      <td className="py-2 font-sans font-semibold">{label}</td>
                      <td className="py-2 text-right">${res.periods[k].gross.toLocaleString()}</td>
                      <td className="py-2 text-right font-bold text-foreground">
                        ${res.periods[k].net.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Group 1D: Developer, Security, SEO & Image Quick Wins
// ============================================================================

function RegexTesterWorkspace() {
  const [pattern, setPattern] = useState("([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");
  const [flags, setFlags] = useState("gi");
  const [testString, setTestString] = useState(
    "Contact support@ijm.dev or engineering@ijm.org for assistance.",
  );

  const res = testRegularExpression(pattern, flags, testString);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border bg-muted/40 p-4 sm:grid-cols-12">
        <div className="sm:col-span-9">
          <label className="block text-xs font-semibold text-muted-foreground">
            Regular Expression Pattern
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Flags (g, i, m, s, u)
          </label>
          <input
            type="text"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-card px-3.5 py-2 font-mono text-xs"
          />
        </div>
      </div>

      {!res.ok && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">Test String</label>
          <textarea
            rows={8}
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            className="mt-1 w-full rounded-2xl border bg-background p-4 font-mono text-xs"
          />
        </div>

        <div className="rounded-2xl border bg-background p-4 space-y-3">
          <p className="text-xs font-bold">Matches Found ({res.matches.length})</p>
          {res.matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matches found.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-auto">
              {res.matches.map((m, idx) => (
                <div key={idx} className="rounded-xl border bg-muted/30 p-2.5 font-mono text-xs">
                  <p className="font-bold text-foreground">
                    Match #{idx + 1} (index {m.index}): &ldquo;{m.fullMatch}&rdquo;
                  </p>
                  {m.groups.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Capture groups: {m.groups.map((g, gi) => `$${gi + 1}="${g}"`).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JwtDecoderWorkspace() {
  const [token, setToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwNDIiLCJuYW1lIjoiQWRhIExvdmVsYWNlIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYwMDAwMDAwLCJleHAiOjE5MjAwMDAwMDB9.sample_signature_not_verified",
  );
  const res = decodeJwtToken(token);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-2xl border bg-muted/50 p-4 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
        <p>
          <strong>Security Notice:</strong> This tool decodes Base64URL JWT headers and payloads
          locally in your browser. It <strong>does not verify cryptographic signatures</strong> —
          never trust unverified tokens in production authentication flows.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground">
          Encoded JWT Token (Bearer or raw header.payload.signature)
        </label>
        <textarea
          rows={3}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded-2xl border bg-background p-3.5 font-mono text-xs"
        />
      </div>

      {!res.ok ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-bold">Decoded Header (Algorithm & Type)</p>
            <pre className="overflow-auto rounded-2xl border bg-muted/30 p-4 font-mono text-xs">
              {res.headerJson}
            </pre>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold">
              Decoded Payload Claims {res.claims.expIso ? `(Expires: ${res.claims.expIso})` : ""}
            </p>
            <pre className="overflow-auto rounded-2xl border bg-muted/30 p-4 font-mono text-xs">
              {res.payloadJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function CronBuilderWorkspace() {
  const [expression, setExpression] = useState("*/15 9-17 * * 1-5");
  const res = explainAndPreviewCron(expression);

  const presets: [string, string][] = [
    ["*/5 * * * *", "Every 5 minutes"],
    ["0 * * * *", "Top of every hour"],
    ["0 9 * * 1-5", "Weekdays at 09:00 UTC"],
    ["0 0 * * 0", "Weekly on Sunday midnight"],
    ["0 0 1 * *", "Monthly on the 1st"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {presets.map(([expr, label]) => (
          <button
            key={expr}
            type="button"
            onClick={() => setExpression(expr)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
              expression === expr ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {label} ({expr})
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground">
          5-Field Cron Expression (minute hour day-of-month month day-of-week)
        </label>
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          className="mt-1 w-full rounded-2xl border bg-background px-4 py-3 font-mono text-base font-bold"
        />
      </div>

      {!res.ok ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
        >
          {res.error}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs font-bold uppercase">Schedule Explanation</p>
            <p className="mt-2 text-base font-bold">{res.summary}</p>
          </div>
          <div className="rounded-2xl border bg-background p-5">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Next Scheduled Runs (UTC)
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {res.nextRunsUtc.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorConverterWorkspace() {
  const [input, setInput] = useState("#D6F538");
  const res = convertColorValue(input);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
        <label className="block text-xs font-semibold text-muted-foreground">
          Enter HEX, RGB, or HSL Color
        </label>
        <div className="flex gap-3">
          <input
            type="color"
            aria-label="Color picker"
            value={res.ok ? res.hex : "#000000"}
            onChange={(e) => setInput(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border bg-background p-1"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-2 font-mono text-sm font-bold"
          />
        </div>
        {!res.ok && <p className="text-xs text-destructive">{res.error}</p>}
        <div
          className="h-28 w-full rounded-2xl border shadow-inner"
          style={{ backgroundColor: res.ok ? res.hex : "#000000" }}
        />
      </div>

      <div className="space-y-3 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
        <h3 className="text-base font-bold">Converted Color Formats & Contrast</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["HEX", res.hex],
            ["RGB", res.rgbString],
            ["HSL", res.hslString],
          ].map(([label, val]) => (
            <div key={label} className="rounded-2xl border bg-background p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xs font-bold">{val}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border bg-background p-3.5">
            <p className="text-muted-foreground">Contrast vs. White (#FFF)</p>
            <p className="mt-1 font-mono text-base font-bold">{res.contrastWithWhite}:1</p>
          </div>
          <div className="rounded-2xl border bg-background p-3.5">
            <p className="text-muted-foreground">Contrast vs. Black (#000)</p>
            <p className="mt-1 font-mono text-base font-bold">{res.contrastWithBlack}:1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChmodCalculatorWorkspace() {
  const [matrix, setMatrix] = useState<ChmodMatrix>({
    owner: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    others: { read: true, write: false, execute: true },
  });

  const res = calculateUnixPermissions(matrix);

  const toggle = (role: keyof ChmodMatrix, perm: "read" | "write" | "execute") => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="rounded-3xl border bg-card p-6 shadow-card lg:col-span-7">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2">Scope</th>
              <th className="py-2">Read (4)</th>
              <th className="py-2">Write (2)</th>
              <th className="py-2">Execute (1)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(
              [
                ["owner", "Owner (u)"],
                ["group", "Group (g)"],
                ["others", "Public / Others (o)"],
              ] as const
            ).map(([role, label]) => (
              <tr key={role}>
                <td className="py-3 font-bold">{label}</td>
                {(["read", "write", "execute"] as const).map((perm) => (
                  <td key={perm} className="py-3">
                    <input
                      type="checkbox"
                      aria-label={`${label} ${perm}`}
                      checked={matrix[role][perm]}
                      onChange={() => toggle(role, perm)}
                      className="h-4 w-4 accent-foreground"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-3xl border bg-card p-6 shadow-card lg:col-span-5">
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <p className="text-xs font-bold uppercase">Octal Notation</p>
          <p className="mt-1 font-mono text-3xl font-extrabold">{res.octal}</p>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">Symbolic Representation</p>
          <p className="mt-1 font-mono text-lg font-bold">{res.symbolic}</p>
        </div>
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-xs font-semibold text-muted-foreground">Shell Command</p>
          <p className="mt-1 font-mono text-sm font-bold">{res.chmodCommand}</p>
        </div>
      </div>
    </div>
  );
}

function HttpStatusLookupWorkspace() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | "1xx" | "2xx" | "3xx" | "4xx" | "5xx">("all");
  const items = searchHttpStatusCodes(query, cat);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <input
          type="search"
          placeholder="Search by status code (e.g. 404, 502) or keyword..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-xl border bg-card px-4 py-2 text-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "1xx", "2xx", "3xx", "4xx", "5xx"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                cat === c ? "bg-primary text-primary-foreground" : "border bg-card"
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.code} className="rounded-2xl border bg-background p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-extrabold text-foreground">
                {item.code} {item.phrase}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] font-bold">
                {item.category}
              </span>
            </div>
            <p className="text-xs text-foreground">{item.description}</p>
            <p className="text-[11px] text-muted-foreground">
              <strong>Common cause/use:</strong> {item.commonUse}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordGeneratorWorkspace() {
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState("Generating...");
  const [entropy, setEntropy] = useState(110);
  const [strength, setStrength] = useState("Very Strong");
  const [copied, setCopied] = useState(false);

  const regenerate = () => {
    const res = generateSecurePassword({
      length,
      uppercase,
      lowercase,
      numbers,
      symbols,
      excludeAmbiguous,
    });
    if (res.ok) {
      setPassword(res.password);
      setEntropy(res.entropyBits);
      setStrength(res.strengthLabel);
    } else {
      setPassword(res.error ?? "");
    }
  };

  useEffect(() => {
    regenerate();
  }, [length, uppercase, lowercase, numbers, symbols, excludeAmbiguous]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-6 shadow-card">
        <p className="break-all font-mono text-xl font-extrabold text-foreground">{password}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={regenerate}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Password"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 rounded-3xl border bg-muted/30 p-6 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-semibold">
            Password Length: <strong>{length} characters</strong>
          </label>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full accent-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Entropy: <strong>{entropy} bits</strong> ({strength}) — generated via{" "}
            <code>window.crypto.getRandomValues</code>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs font-medium">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
            />
            Uppercase (A–Z)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={lowercase}
              onChange={(e) => setLowercase(e.target.checked)}
            />
            Lowercase (a–z)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={numbers}
              onChange={(e) => setNumbers(e.target.checked)}
            />
            Numbers (0–9)
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
            />
            Symbols (!@#$...)
          </label>
          <label className="col-span-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(e) => setExcludeAmbiguous(e.target.checked)}
            />
            Exclude ambiguous characters (I, l, 1, O, 0)
          </label>
        </div>
      </div>
    </div>
  );
}

function MetaTagGeneratorWorkspace() {
  const [title, setTitle] = useState("IJM — Privacy-First Online Tools");
  const [description, setDescription] = useState(
    "Convert PDFs, clean CSV spreadsheets, generate invoices, and format code locally in your browser with zero file uploads.",
  );
  const [canonicalUrl, setCanonicalUrl] = useState("https://ijm.example/");
  const [siteName, setSiteName] = useState("IJM");
  const [ogType, setOgType] = useState<"website" | "article" | "product">("website");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);

  const html = generateMetaTagsHtml({
    title,
    description,
    canonicalUrl,
    ogType,
    ogImageUrl,
    siteName,
    robotsIndex,
    robotsFollow,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-6">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            Page Title ({title.length} / 60 chars recommended)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-xs font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            Meta Description ({description.length} / 160 chars recommended)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background p-3 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Canonical URL
            </label>
            <input
              type="url"
              value={canonicalUrl}
              onChange={(e) => setCanonicalUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">Site Name</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs"
            />
          </div>
        </div>
        <div className="flex gap-4 text-xs font-medium">
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={robotsIndex}
              onChange={(e) => setRobotsIndex(e.target.checked)}
            />
            Allow indexing (index)
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={robotsFollow}
              onChange={(e) => setRobotsFollow(e.target.checked)}
            />
            Allow following links (follow)
          </label>
        </div>
      </div>

      <div className="space-y-4 lg:col-span-6">
        <div className="rounded-2xl border bg-white p-4 text-slate-900 shadow-sm">
          <p className="text-[11px] text-slate-500">{canonicalUrl}</p>
          <p className="mt-0.5 text-base font-semibold text-blue-700 hover:underline">
            {title || "Untitled Page"}
          </p>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{description}</p>
        </div>
        <textarea
          rows={10}
          readOnly
          aria-label="Generated HTML Meta Tags"
          value={html}
          className="w-full rounded-2xl border bg-muted/30 p-4 font-mono text-xs"
        />
      </div>
    </div>
  );
}

function SlugGeneratorWorkspace() {
  const [input, setInput] = useState(
    "10 Proven Ways to Speed Up Your React & TypeScript Build in 2026!",
  );
  const [separator, setSeparator] = useState<"-" | "_">("-");
  const [lowercase, setLowercase] = useState(true);
  const [removeStopWords, setRemoveStopWords] = useState(false);

  const slug = generateUrlSlug(input, {
    separator,
    lowercase,
    removeStopWords,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 rounded-2xl border bg-muted/40 p-4 text-xs font-medium">
        <label className="flex items-center gap-2">
          Separator:
          <select
            value={separator}
            onChange={(e) => setSeparator(e.target.value === "_" ? "_" : "-")}
            className="rounded-lg border bg-card px-2.5 py-1 font-mono"
          >
            <option value="-">Hyphen (-)</option>
            <option value="_">Underscore (_)</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={lowercase}
            onChange={(e) => setLowercase(e.target.checked)}
          />
          Force lowercase
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={removeStopWords}
            onChange={(e) => setRemoveStopWords(e.target.checked)}
          />
          Strip common English stop words
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground">
          Article or Page Title
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="mt-1 w-full rounded-2xl border bg-background px-4 py-3 text-sm"
        />
      </div>

      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-bold uppercase opacity-80">Generated URL Slug</p>
        <p className="mt-1 font-mono text-xl font-extrabold">/{slug}</p>
      </div>
    </div>
  );
}

function UtmBuilderWorkspace() {
  const [baseUrl, setBaseUrl] = useState("https://ijm.example/tools");
  const [utmSource, setUtmSource] = useState("newsletter");
  const [utmMedium, setUtmMedium] = useState("email");
  const [utmCampaign, setUtmCampaign] = useState("spring_launch");
  const [utmTerm, setUtmTerm] = useState("");
  const [utmContent, setUtmContent] = useState("hero_cta");

  const res = buildUtmUrl({
    baseUrl,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-semibold text-muted-foreground">Website URL</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            utm_source (e.g. google, newsletter)
          </label>
          <input
            type="text"
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            utm_medium (e.g. cpc, email, social)
          </label>
          <input
            type="text"
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            utm_campaign (e.g. product_launch)
          </label>
          <input
            type="text"
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            utm_term (optional)
          </label>
          <input
            type="text"
            value={utmTerm}
            onChange={(e) => setUtmTerm(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            utm_content (optional)
          </label>
          <input
            type="text"
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
      </div>

      {!res.ok ? (
        <p className="text-xs text-destructive">{res.error}</p>
      ) : (
        <div className="rounded-2xl border bg-muted/40 p-4 space-y-2">
          <p className="text-xs font-bold">Trackable Campaign URL</p>
          <p className="break-all font-mono text-xs text-foreground">{res.url}</p>
        </div>
      )}
    </div>
  );
}

function QrCodeGeneratorWorkspace() {
  const [text, setText] = useState("https://ijm.example");
  const [size, setSize] = useState(280);
  const [ecc, setEcc] = useState<"L" | "M" | "Q" | "H">("M");
  const [svgString, setSvgString] = useState("");
  const [pngUrl, setPngUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    generateQrCodeAssets(text, { width: size, errorCorrectionLevel: ecc })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setSvgString(res.svgString);
          setPngUrl(res.pngDataUrl);
          setError(null);
        } else {
          setError(res.error ?? "Invalid QR input");
        }
      })
      .catch(() => {
        if (active) setError("Could not generate QR code.");
      });
    return () => {
      active = false;
    };
  }, [text, size, ecc]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-card lg:col-span-7">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground">
            URL or Text Content
          </label>
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full rounded-2xl border bg-background p-3.5 font-mono text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">Size (px)</label>
            <input
              type="number"
              min={128}
              max={1024}
              step={32}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground">
              Error Correction Level
            </label>
            <select
              value={ecc}
              onChange={(e) => setEcc(e.target.value as "L" | "M" | "Q" | "H")}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
            >
              <option value="L">Low (7%)</option>
              <option value="M">Medium (15%)</option>
              <option value="Q">Quartile (25%)</option>
              <option value="H">High (30%)</option>
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card p-6 shadow-card space-y-4 lg:col-span-5">
        {pngUrl ? (
          <img
            src={pngUrl}
            alt="Generated QR code"
            className="h-52 w-52 rounded-2xl border bg-white p-2"
          />
        ) : (
          <div className="grid h-52 w-52 place-items-center rounded-2xl border bg-muted text-xs text-muted-foreground">
            QR Preview
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!pngUrl}
            onClick={async () => {
              const resp = await fetch(pngUrl);
              const blob = await resp.blob();
              downloadBlob(blob, "qrcode.png");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Download PNG
          </button>
          <button
            type="button"
            disabled={!svgString}
            onClick={() => downloadText(svgString, "qrcode.svg", "image/svg+xml;charset=utf-8")}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> Download SVG
          </button>
        </div>
      </div>
    </div>
  );
}

function FaviconGeneratorWorkspace() {
  const [files, setFiles] = useState<File[]>([]);
  const [badgeText, setBadgeText] = useState("IJM");
  const [bgColor, setBgColor] = useState("#D6F538");
  const [textColor, setTextColor] = useState("#111111");
  const [previews, setPreviews] = useState<{ size: number; dataUrl: string }[]>([]);

  const sizes = [16, 32, 48, 180, 512];

  useEffect(() => {
    let cancelled = false;
    const renderFavicons = async () => {
      let imgEl: HTMLImageElement | null = null;
      const uploaded = files[0];
      if (uploaded) {
        const url = URL.createObjectURL(uploaded);
        try {
          imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Image load failed"));
            img.src = url;
          });
        } catch {
          imgEl = null;
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      const generated: { size: number; dataUrl: string }[] = [];
      for (const sz of sizes) {
        const canvas = document.createElement("canvas");
        canvas.width = sz;
        canvas.height = sz;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, sz, sz, Math.round(sz * 0.2));
        ctx.fill();

        if (imgEl) {
          ctx.drawImage(imgEl, 0, 0, sz, sz);
        } else {
          ctx.fillStyle = textColor;
          ctx.font = `bold ${Math.round(sz * 0.48)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badgeText.slice(0, 3) || "U", sz / 2, sz / 2 + sz * 0.03);
        }

        generated.push({ size: sz, dataUrl: canvas.toDataURL("image/png") });
      }
      if (!cancelled) {
        setPreviews(generated);
      }
    };

    void renderFavicons();
    return () => {
      cancelled = true;
    };
  }, [files, badgeText, bgColor, textColor]);

  const htmlSnippet = `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />`;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <FileDropzone
            label="Upload Logo Image (Optional)"
            description="PNG, JPG, WebP, or SVG. Or use the monogram badge designer on the right."
            accept="image/*"
            files={files}
            onFilesChange={setFiles}
          />
          <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-background p-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Badge Text (1–3 chars)
              </label>
              <input
                type="text"
                maxLength={3}
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-card px-3 py-1.5 font-mono text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Background
              </label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="mt-1 h-9 w-full cursor-pointer rounded-xl border bg-card p-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">
                Text Color
              </label>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="mt-1 h-9 w-full cursor-pointer rounded-xl border bg-card p-1"
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 rounded-3xl border bg-card p-4 shadow-card sm:p-6">
          <h3 className="text-base font-bold">Generated Multi-Size Favicons</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((p) => (
              <div
                key={p.size}
                className="flex flex-col items-center justify-between rounded-2xl border bg-background p-3 text-center"
              >
                <img
                  src={p.dataUrl}
                  alt={`${p.size}x${p.size} favicon`}
                  className="h-12 w-12 object-contain"
                />
                <p className="mt-2 font-mono text-xs font-bold">
                  {p.size}×{p.size}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await fetch(p.dataUrl);
                    const b = await r.blob();
                    downloadBlob(b, `favicon-${p.size}x${p.size}.png`);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground"
                >
                  <Download className="h-3 w-3" /> PNG
                </button>
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">HTML Head Snippet:</p>
            <pre className="mt-1 max-w-full overflow-x-auto rounded-xl border bg-muted/30 p-3 font-mono text-[11px]">
              {htmlSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Release1ToolWorkspace({ toolSlug }: { toolSlug: string }) {
  switch (toolSlug) {
    case "word-counter":
      return <WordCounterWorkspace />;
    case "case-converter":
      return <CaseConverterWorkspace />;
    case "remove-line-breaks":
      return <RemoveLineBreaksWorkspace />;
    case "find-replace":
      return <FindReplaceWorkspace />;
    case "text-sorter":
      return <TextSorterWorkspace />;
    case "duplicate-line-remover":
      return <DuplicateLineRemoverWorkspace />;
    case "lorem-ipsum-generator":
      return <LoremIpsumWorkspace />;
    case "cgpa-calculator":
      return <CgpaCalculatorWorkspace />;
    case "gpa-calculator":
      return <GpaCalculatorWorkspace />;
    case "grade-calculator":
      return <GradeCalculatorWorkspace />;
    case "exam-countdown":
      return <ExamCountdownWorkspace />;
    case "pomodoro-timer":
      return <PomodoroTimerWorkspace />;
    case "profit-margin-calculator":
      return <ProfitMarginWorkspace />;
    case "loan-emi-calculator":
      return <LoanEmiWorkspace />;
    case "salary-calculator":
      return <SalaryCalculatorWorkspace />;
    case "regex-tester":
      return <RegexTesterWorkspace />;
    case "jwt-decoder":
      return <JwtDecoderWorkspace />;
    case "cron-builder":
      return <CronBuilderWorkspace />;
    case "color-converter":
      return <ColorConverterWorkspace />;
    case "chmod-calculator":
      return <ChmodCalculatorWorkspace />;
    case "http-status-lookup":
      return <HttpStatusLookupWorkspace />;
    case "password-generator":
      return <PasswordGeneratorWorkspace />;
    case "meta-tag-generator":
      return <MetaTagGeneratorWorkspace />;
    case "slug-generator":
      return <SlugGeneratorWorkspace />;
    case "utm-builder":
      return <UtmBuilderWorkspace />;
    case "qr-code-generator":
      return <QrCodeGeneratorWorkspace />;
    case "favicon-generator":
      return <FaviconGeneratorWorkspace />;
    default:
      return <WordCounterWorkspace />;
  }
}
