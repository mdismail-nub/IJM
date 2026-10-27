import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Grid, Search, X } from "lucide-react";
import { useState } from "react";
import { categories, getAllTools, searchTools, type CategorySlug } from "@/lib/tools";

const TITLE = "All Tools Directory — IJM";
const DESC =
  "Browse and search every IJM tool across File Tools, Data Tools, Business Tools, Developer Tools, and Student Tools.";

export const Route = createFileRoute("/tools/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "/tools" },
    ],
    links: [{ rel: "canonical", href: "/tools" }],
  }),
  component: AllToolsPage,
});

function AllToolsPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | "all">("all");

  const allToolsCount = getAllTools().length;
  const filteredTools = searchTools(query, selectedCategory);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-y-1 pt-6 text-sm text-muted-foreground"
      >
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-foreground">All Tools</span>
      </nav>

      <section className="mt-4 overflow-hidden rounded-[1.75rem] bg-ink p-6 text-ink-foreground shadow-card sm:rounded-[2rem] sm:p-8 md:p-14">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-background/15 shadow-card sm:h-16 sm:w-16 md:h-20 md:w-20"
          aria-hidden
        >
          <Grid className="h-7 w-7 text-primary sm:h-8 sm:w-8 md:h-10 md:w-10" />
        </span>
        <h1 className="mt-4 text-[clamp(2.25rem,5.5vw,4.5rem)] font-bold leading-[1.04] tracking-tighter">
          All Tools
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-foreground/80 sm:text-lg md:text-xl">
          Search across all {allToolsCount} browser-based utilities across 5 categories. Everything
          runs locally on your device.
        </p>

        <div className="mt-6 max-w-2xl sm:mt-8">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search all tools"
              placeholder="Filter by tool name, category, or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-ink-foreground/20 bg-card py-3.5 pl-12 pr-11 text-sm text-foreground outline-none focus:border-primary sm:text-base"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setQuery("")}
                className="absolute right-3.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div role="group" aria-label="Filter by category" className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-background/10 text-ink-foreground hover:bg-background/20"
            }`}
          >
            All ({allToolsCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                selectedCategory === cat.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/10 text-ink-foreground hover:bg-background/20"
              }`}
            >
              {cat.label} ({cat.tools.length})
            </button>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[clamp(1.375rem,3vw,1.875rem)] font-bold tracking-tight">
            Showing {filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"}
          </h2>
          {(query || selectedCategory !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedCategory("all");
              }}
              className="text-sm font-semibold text-foreground underline underline-offset-4"
            >
              Reset filters
            </button>
          )}
        </div>

        {filteredTools.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTools.map((t) => {
              const ToolIcon = t.icon;
              return (
                <Link
                  key={t.slug}
                  to="/tools/$toolSlug"
                  params={{ toolSlug: t.slug }}
                  className="group relative flex h-full min-h-48 min-w-0 flex-col rounded-3xl border bg-card p-5 transition hover:-translate-y-1 hover:shadow-card sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted transition group-hover:bg-primary">
                      <ToolIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {t.categoryLabel}
                    </span>
                  </div>
                  <h3 className="mt-4 break-words text-lg font-semibold leading-snug tracking-tight sm:mt-5 sm:text-xl">
                    {t.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-foreground">
                    Open tool <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border bg-card p-8 text-center shadow-card sm:p-12">
            <h3 className="text-xl font-bold text-foreground">No matching tools found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No utilities matched your current search or category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedCategory("all");
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Show all tools
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
