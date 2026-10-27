import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { clearRecentTools, getRecentToolSlugs } from "@/lib/file-utils";
import { getToolBySlug, searchTools, type Tool } from "@/lib/tools";

const TITLE = "IJM — Get More Done in Less Time";
const DESC =
  "All your essential online tools in one simple platform: PDFs, data cleaning, invoices, study planning and coding tools. Private, free, no account required.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [recentTools, setRecentTools] = useState<Tool[]>([]);

  useEffect(() => {
    const slugs = getRecentToolSlugs();
    const resolved = slugs.map((s) => getToolBySlug(s)).filter((t): t is Tool => Boolean(t));
    setRecentTools(resolved);
  }, []);

  const trimmedQuery = query.trim();
  const matchingTools = trimmedQuery ? searchTools(trimmedQuery) : [];

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto max-w-5xl px-4 pt-8 text-center sm:px-6 md:pt-16">
        <h1 className="text-[clamp(2.25rem,6.5vw,5.5rem)] font-bold leading-[1.08] tracking-tighter md:leading-[1.05]">
          Get{" "}
          <span className="relative inline-block -rotate-2 rounded-[1.2rem] bg-primary px-3 py-0.5 text-primary-foreground sm:rounded-[1.4rem] md:rounded-[2rem] md:px-6">
            More Done
          </span>{" "}
          in Less{" "}
          <span className="relative inline-block">
            Time
            <svg
              aria-hidden
              viewBox="0 0 220 14"
              preserveAspectRatio="none"
              className="absolute -bottom-1 left-0 h-2.5 w-full text-primary md:-bottom-2 md:h-3.5"
            >
              <path
                d="M4 10 C 60 2, 160 2, 216 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-4xl text-base leading-relaxed text-foreground/85 sm:mt-6 sm:text-lg md:text-2xl">
          IJM brings all your essential online tools into one simple platform. Manage PDFs, clean
          data, create invoices, plan studies, and solve coding tasks—all in one place, with privacy
          at its core and no account required.
        </p>

        {/* Functional Homepage Search */}
        <div className="mx-auto mt-7 max-w-2xl sm:mt-8">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground sm:left-5"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search tools by name, category, or keyword"
              placeholder="Search tools (e.g., Merge PDF, CSV, Invoice, JSON, ExamSprint)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border-2 border-foreground/15 bg-card py-3.5 pl-11 pr-11 text-sm text-foreground shadow-card outline-none transition focus:border-foreground sm:py-4 sm:pl-13 sm:pr-12 sm:text-base md:text-lg"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-3.5 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:right-4"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {trimmedQuery && (
          <div
            aria-live="polite"
            className="mx-auto mt-6 max-w-4xl rounded-3xl border bg-card p-4 text-left shadow-card sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <span className="text-sm font-semibold text-foreground">
                {matchingTools.length} {matchingTools.length === 1 ? "tool found" : "tools found"}{" "}
                for "{trimmedQuery}"
              </span>
              <Link
                to="/tools"
                className="text-sm font-semibold text-foreground underline underline-offset-4"
              >
                Browse all tools →
              </Link>
            </div>

            {matchingTools.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchingTools.map((tool) => {
                  const ToolIcon = tool.icon;
                  return (
                    <Link
                      key={tool.slug}
                      to="/tools/$toolSlug"
                      params={{ toolSlug: tool.slug }}
                      className="group flex h-full min-w-0 flex-col rounded-2xl border bg-background p-4 transition hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-card"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted transition group-hover:bg-primary">
                          <ToolIcon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {tool.categoryLabel}
                        </span>
                      </div>
                      <h2 className="mt-3 break-words text-base font-bold text-foreground">
                        {tool.name}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tool.desc}</p>
                      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-foreground">
                        Open tool <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-base font-semibold text-foreground">
                  No tools matched "{trimmedQuery}"
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try searching for PDF, CSV, Invoice, Tax, JSON, Base64, or Study Planner.
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 sm:mt-8 sm:gap-4">
          <a
            href="#tools"
            className="inline-flex items-center justify-center gap-2.5 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-card transition hover:scale-105 sm:px-9 sm:py-5 sm:text-xl md:text-2xl"
          >
            Explore the Tools <ArrowRight className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
          </a>
          <Link
            to="/tools"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-foreground/20 bg-card px-6 py-3.5 text-base font-semibold text-foreground transition hover:border-foreground sm:px-7 sm:py-5 sm:text-lg md:text-xl"
          >
            All Tools Directory
          </Link>
        </div>
      </section>

      {recentTools.length > 0 && (
        <section
          aria-label="Recently used tools"
          className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 md:px-10"
        >
          <div className="rounded-3xl border bg-card p-4 shadow-card sm:p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Clock className="h-4 w-4 shrink-0" aria-hidden /> Recently Used Tools
              </div>
              <button
                type="button"
                onClick={() => {
                  clearRecentTools();
                  setRecentTools([]);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear history
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {recentTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.slug}
                    to="/tools/$toolSlug"
                    params={{ toolSlug: tool.slug }}
                    className="inline-flex items-center gap-2 rounded-full border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground sm:px-4 sm:text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{tool.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section
        id="tools"
        className="mx-auto mt-12 grid max-w-7xl gap-5 px-4 sm:mt-14 sm:grid-cols-2 sm:px-6 xl:grid-cols-[1.9fr_1fr_1.3fr_1.15fr] md:px-10"
      >
        {/* Document Hub */}
        <Link
          to="/file-tools"
          className="relative block h-88 overflow-hidden rounded-[2rem] bg-muted p-6 shadow-card transition hover:-translate-y-1 sm:h-96 sm:p-7"
        >
          <h3 className="text-3xl font-bold leading-none tracking-tight sm:text-4xl md:text-5xl">
            File
            <br />
            Tools
          </h3>
          <div className="absolute right-5 top-5 grid h-14 w-14 place-items-center rounded-full bg-card shadow-card sm:h-16 sm:w-16">
            <div className="h-5 w-5 rounded-full border-2 border-foreground bg-muted-foreground/60 sm:h-6 sm:w-6" />
          </div>
          <div className="absolute bottom-0 left-5 h-48 w-48 rounded-t-xl bg-card p-5 shadow-card sm:left-10 sm:h-52 sm:w-64 sm:p-6">
            <span className="absolute -left-3 top-5 rounded-md bg-destructive px-2.5 py-1 text-lg font-semibold text-ink-foreground sm:-left-4 sm:top-6 sm:px-3 sm:text-2xl">
              PDF
            </span>
            <div className="mt-12 space-y-2 sm:mt-14">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-1.5 rounded bg-muted" />
              ))}
            </div>
          </div>
          <div className="absolute bottom-8 right-4 w-52 divide-y rounded-2xl bg-card/95 px-4 text-base shadow-card sm:bottom-12 sm:right-6 sm:w-72 sm:px-5 sm:text-xl">
            {["Merge PDFs", "Image to PDF"].map((t) => (
              <div key={t} className="flex items-center justify-between py-3 sm:py-4">
                <span>{t}</span>
                <ChevronRight className="h-5 w-5 shrink-0" />
              </div>
            ))}
          </div>
        </Link>

        {/* Data Cleaner */}
        <Link
          to="/data-tools"
          className="relative block h-88 overflow-hidden rounded-[2rem] bg-data p-6 shadow-card transition hover:-translate-y-1 sm:h-96 sm:p-7"
        >
          <h3 className="text-3xl font-bold leading-none tracking-tight sm:text-4xl md:text-5xl">
            Data
            <br />
            Tools
          </h3>
          <div className="absolute -right-4 bottom-0 left-6 h-48 space-y-2 rounded-tl-2xl bg-card/80 p-4 sm:left-7 sm:h-52">
            <div className="h-3 w-28 rounded-full bg-muted-foreground/40" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm">
                <span className="h-4 w-4 shrink-0 rounded border" /> Data
                <span className="h-2 w-12 rounded bg-muted" />
                <span className="h-2 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        </Link>

        {/* Invoice */}
        <Link
          to="/business-tools"
          className="relative block h-88 overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-card transition hover:-translate-y-1 sm:h-96 sm:p-7"
        >
          <h3 className="text-3xl font-bold leading-none tracking-tight sm:text-4xl md:text-5xl">
            Business
            <br />
            Tools
          </h3>
          <p className="mt-3 text-base sm:text-lg">Invoices, quotes & calculators</p>
          <div className="absolute bottom-0 left-5 right-5 h-44 rounded-t-2xl bg-card p-4 text-foreground sm:left-8 sm:right-8 sm:p-5">
            <p className="text-base font-semibold sm:text-lg">Add details</p>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2">
              <Search className="h-4 w-4 shrink-0" />
              <span className="h-2 flex-1 rounded bg-muted" />
              <ChevronDown className="h-4 w-4 shrink-0" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-8 w-8 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2 w-20 rounded bg-muted sm:w-24" />
                <div className="h-2 w-24 rounded bg-muted sm:w-32" />
              </div>
              <Plus className="h-5 w-5 shrink-0 rounded-full bg-muted-foreground p-0.5 text-card" />
            </div>
          </div>
        </Link>

        {/* Study + Dev */}
        <div className="flex flex-col gap-5 sm:h-96">
          <Link
            to="/student-tools"
            className="block flex-1 rounded-[2rem] bg-card p-5 shadow-card transition hover:-translate-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-2xl font-bold leading-none tracking-tight sm:text-3xl">
                Student
                <br />
                Tools
              </h3>
              <div className="flex shrink-0 -space-x-2">
                {["🧑🏾", "👨🏻", "👩🏽"].map((e) => (
                  <span
                    key={e}
                    className="grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-muted"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-around rounded-lg border p-2 text-center">
                {(
                  [
                    ["Mon", 12],
                    ["Tue", 13],
                    ["Wed", 14],
                  ] as const
                ).map(([d, n], i) => (
                  <span key={d} className={`rounded px-1 ${i === 2 ? "bg-primary" : ""}`}>
                    {d}
                    <br />
                    {n}
                  </span>
                ))}
              </div>
              <div className="space-y-1 rounded-lg border p-2">
                {["Task #1", "Task #2"].map((t) => (
                  <div key={t} className="flex items-center gap-1 rounded bg-muted/60 px-1">
                    <Check className="h-3 w-3 shrink-0" />
                    <span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </Link>
          <Link
            to="/developer-tools"
            className="relative block min-h-40 flex-1 overflow-hidden rounded-[2rem] bg-ink p-5 text-ink-foreground shadow-card transition hover:-translate-y-1"
          >
            <h3 className="text-2xl font-bold leading-none tracking-tight sm:text-3xl">
              Developer
              <br />
              Tools
            </h3>
            <Code2 className="absolute right-5 top-5 h-10 w-10 rounded-xl bg-ink-foreground/10 p-2 text-primary" />
            <span className="absolute bottom-4 right-5 text-5xl font-light text-muted-foreground sm:bottom-6 sm:text-6xl">
              &lt;/&gt;
            </span>
            <p className="mt-6 text-base sm:text-lg">Format, encode & debug</p>
          </Link>
        </div>
      </section>

      <section className="scallop scallop-b mt-16 w-full bg-primary px-4 pb-20 pt-24 text-center text-primary-foreground sm:px-6 md:pb-24 md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/25 px-4 py-1.5 text-sm font-semibold tracking-wide">
          <Lock className="h-4 w-4" /> Built for privacy
        </span>
        <h2 className="mx-auto mt-6 max-w-4xl text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-tighter">
          Privacy at its core. No account required.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-foreground/80 sm:text-lg md:text-xl">
          Your data never leaves your browser. Work faster, easier, and more accessible — all in one
          place.
        </p>
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2.5 sm:mt-9 sm:gap-3">
          {(
            [
              [ShieldCheck, "Files never uploaded"],
              [Zap, "Nothing to install"],
              [Lock, "No sign-up, ever"],
            ] as const
          ).map(([Icon, t]) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-card sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" /> {t}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
