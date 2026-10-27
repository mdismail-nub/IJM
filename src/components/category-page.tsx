import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Lock, ShieldCheck, Zap } from "lucide-react";
import { categories, type Category } from "@/lib/tools";

const toneHero: Record<Category["tone"], string> = {
  primary: "bg-primary text-primary-foreground",
  ink: "bg-ink text-ink-foreground",
  muted: "bg-muted",
  card: "bg-card",
  data: "bg-data",
};

export function CategoryPage({ cat }: { cat: Category }) {
  const others = categories.filter((c) => c.slug !== cat.slug);
  const CatIcon = cat.icon;
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
        <span className="font-medium text-foreground">{cat.title}</span>
      </nav>

      <section
        className={`mt-4 overflow-hidden rounded-[1.75rem] p-6 shadow-card sm:rounded-[2rem] sm:p-8 md:p-14 ${toneHero[cat.tone]}`}
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-background/80 shadow-card sm:h-16 sm:w-16 md:h-20 md:w-20"
          aria-hidden
        >
          <CatIcon className="h-7 w-7 text-foreground sm:h-8 sm:w-8 md:h-10 md:w-10" />
        </span>
        <h1 className="mt-4 break-words text-[clamp(2rem,5.5vw,4.5rem)] font-bold leading-[1.04] tracking-tighter">
          {cat.title}
        </h1>
        <p className="mt-3 text-lg font-medium sm:text-xl md:text-2xl">{cat.tagline}</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-85 sm:text-base md:text-lg">
          {cat.intro}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5 text-xs font-medium sm:mt-8 sm:gap-3 sm:text-sm">
          {(
            [
              [ShieldCheck, "Private"],
              [Zap, "Instant"],
              [Lock, "No account"],
            ] as const
          ).map(([Icon, t]) => (
            <span
              key={t}
              className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3.5 py-2 text-foreground sm:px-4"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-12 sm:mt-14">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-tight">
            {cat.tools.length} {cat.tools.length === 1 ? "tool" : "tools"}
          </h2>
          <p className="hidden text-muted-foreground md:block">Pick a tool to get started</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cat.tools.map((t) => {
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
                  {t.tag && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {t.tag}
                    </span>
                  )}
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
      </section>

      <section className="mt-16 sm:mt-20">
        <h2 className="text-[clamp(1.5rem,3.5vw,2rem)] font-bold tracking-tight">
          Explore more tools
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((o) => {
            const OtherIcon = o.icon;
            return (
              <Link
                key={o.slug}
                to={`/${o.slug}`}
                className={`flex min-w-0 items-center justify-between gap-3 rounded-3xl p-5 shadow-card transition hover:-translate-y-1 sm:p-6 ${toneHero[o.tone]}`}
              >
                <span className="min-w-0">
                  <OtherIcon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                  <span className="mt-2 block break-words text-lg font-bold sm:text-xl">
                    {o.title}
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export const categoryHead = (cat: Category) => {
  const title = `${cat.title} — IJM`;
  const description = `${cat.tagline} ${cat.intro}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `/${cat.slug}` },
    ],
    links: [{ rel: "canonical", href: `/${cat.slug}` }],
  };
};
