import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Lock, ShieldCheck, Zap } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { recordRecentTool } from "@/lib/file-utils";
import { getCategory, type Tool } from "@/lib/tools";

export function ToolShell({ tool, children }: { tool: Tool; children: ReactNode }) {
  const category = getCategory(tool.categorySlug);
  const ToolIcon = tool.icon;
  const relatedTools = category.tools.filter((t) => t.slug !== tool.slug);

  useEffect(() => {
    recordRecentTool(tool.slug);
  }, [tool.slug]);

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
        <Link to={`/${category.slug}`} className="hover:text-foreground">
          {category.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-foreground">{tool.name}</span>
      </nav>

      <section className="mt-4 rounded-[1.75rem] border bg-card p-4 shadow-card sm:rounded-[2rem] sm:p-6 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card sm:h-14 sm:w-14"
              aria-hidden
            >
              <ToolIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                  {category.label}
                </span>
                {tool.tag && (
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {tool.tag}
                  </span>
                )}
              </div>
              <h1 className="mt-2 break-words text-[clamp(1.65rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight">
                {tool.name}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
                {tool.desc}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
              Processed in browser
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-2 text-foreground">
              <Lock className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
              No upload
            </span>
          </div>
        </div>

        <div className="mt-6 min-w-0 border-t pt-6 sm:mt-8 sm:pt-8">{children}</div>
      </section>

      {relatedTools.length > 0 && (
        <section className="mt-14 sm:mt-16">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[clamp(1.375rem,3vw,1.875rem)] font-bold tracking-tight">
              More in {category.title}
            </h2>
            <Link
              to={`/${category.slug}`}
              className="text-sm font-semibold text-foreground underline underline-offset-4 hover:text-primary-foreground"
            >
              View all {category.tools.length} tools →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedTools.map((rel) => {
              const RelIcon = rel.icon;
              return (
                <Link
                  key={rel.slug}
                  to="/tools/$toolSlug"
                  params={{ toolSlug: rel.slug }}
                  className="group flex h-full min-w-0 flex-col rounded-3xl border bg-card p-5 transition hover:-translate-y-1 hover:shadow-card sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted transition group-hover:bg-primary">
                      <RelIcon className="h-5 w-5" aria-hidden />
                    </span>
                    {rel.tag && (
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        {rel.tag}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 break-words text-lg font-semibold leading-snug tracking-tight">
                    {rel.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{rel.desc}</p>
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-foreground">
                    Open tool <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

export function ToolReadyBanner({ phaseLabel, summary }: { phaseLabel: string; summary: string }) {
  return (
    <div className="rounded-2xl border bg-muted/40 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Zap className="h-4 w-4" aria-hidden /> {phaseLabel}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}
