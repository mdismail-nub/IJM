import { Link } from "@tanstack/react-router";
import { ArrowRight, Facebook, Grid, Info, Linkedin, Menu, Stamp, X, Zap } from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/tools";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 md:px-10 md:py-5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight sm:text-xl md:text-2xl"
        >
          <Stamp className="h-6 w-6 shrink-0 md:h-7 md:w-7" strokeWidth={2.5} /> IJM
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-4 text-sm lg:flex xl:gap-6 xl:text-base"
        >
          <Link
            to="/tools"
            className="whitespace-nowrap text-foreground/75 transition hover:text-foreground"
            activeProps={{ className: "font-semibold text-foreground" }}
          >
            All Tools
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/${c.slug}`}
              className="whitespace-nowrap text-foreground/75 transition hover:text-foreground"
              activeProps={{ className: "font-semibold text-foreground" }}
            >
              {c.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/tools"
            className="hidden rounded-full border border-foreground/70 px-4 py-2 text-sm font-medium transition hover:bg-foreground hover:text-background sm:inline-block xl:px-5 xl:py-2.5 xl:text-base"
          >
            Start Docking — Free
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full p-2 transition hover:bg-muted lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          aria-label="Mobile navigation"
          className="flex max-h-[calc(100vh-4.5rem)] flex-col gap-1 overflow-y-auto border-t bg-background px-4 py-3 sm:px-6 lg:hidden"
        >
          <Link
            to="/tools"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium hover:bg-muted sm:text-lg"
            activeProps={{ className: "bg-primary font-semibold" }}
          >
            <Grid className="h-5 w-5 shrink-0" aria-hidden /> All Tools
          </Link>
          {categories.map((c) => {
            const NavIcon = c.icon;
            return (
              <Link
                key={c.slug}
                to={`/${c.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium hover:bg-muted sm:text-lg"
                activeProps={{ className: "bg-primary font-semibold" }}
              >
                <NavIcon className="h-5 w-5 shrink-0" aria-hidden /> {c.title}
              </Link>
            );
          })}
          <Link
            to="/about"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium hover:bg-muted sm:text-lg"
            activeProps={{ className: "bg-primary font-semibold" }}
          >
            <Info className="h-5 w-5 shrink-0" aria-hidden /> About & Contact
          </Link>
        </nav>
      )}
    </header>
  );
}

const WAVE_PATH = (() => {
  const w = 1440,
    half = 24,
    step = 72;
  let d = `M0 ${half}`;
  for (let i = 0; i * step < w; i++) {
    const cy = i % 2 === 0 ? 4 : 44;
    d += ` Q ${i * step + step / 2} ${cy} ${(i + 1) * step} ${half}`;
  }
  return d + ` L ${w} ${half + 24} L 0 ${half + 24} Z`;
})();

export function SiteFooter() {
  return (
    <footer className="mt-16 md:mt-24">
      <div className="bg-ink text-ink-foreground">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-14 text-center sm:px-6 md:pb-24 md:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 px-4 py-1.5 text-sm font-semibold tracking-wide text-ink-foreground/80">
            <Zap className="h-4 w-4 text-primary" /> Free forever
          </span>
          <h2 className="mt-6 text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-tighter">
            Every tool you need. <span className="text-primary">One dock.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-foreground/60 sm:text-lg md:text-xl">
            Stop juggling a dozen ad-filled sites — every essential utility lives in one clean dock.
          </p>
          <Link
            to="/tools"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-card transition hover:scale-105 sm:px-8 sm:py-4 sm:text-lg"
          >
            Start Docking — Free <ArrowRight className="h-5 w-5 shrink-0" />
          </Link>
          <p className="mt-4 text-sm text-ink-foreground/40">No account. No upload. No catch.</p>
        </div>
      </div>

      <div className="bg-background">
        <svg
          aria-hidden
          viewBox="0 0 1440 48"
          preserveAspectRatio="none"
          className="block h-9 w-full fill-ink md:h-14"
        >
          <path d={WAVE_PATH} />
        </svg>

        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-10 sm:px-6 md:grid-cols-[1.35fr_1.35fr_auto] md:gap-8 md:px-10 md:pb-16 md:pt-16">
          <Link
            to="/"
            className="flex flex-wrap items-end gap-2 self-start text-[clamp(2.25rem,6vw,4.5rem)] font-bold leading-none tracking-tighter"
          >
            <span>IJM</span>
            <img
              src="/images/mascot.png"
              alt=""
              loading="lazy"
              width={640}
              height={640}
              className="h-12 w-12 shrink-0 -translate-y-1 sm:h-16 sm:w-16 md:h-24 md:w-24 md:-translate-y-2"
            />
          </Link>

          <div className="min-w-0">
            <p className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold leading-[1.12] tracking-tight">
              Privacy at its core.
              <br />
              No account required.
            </p>
            <p className="mt-3 max-w-md text-base text-foreground/70 sm:text-lg">
              Your data never leaves your browser. Work faster, easier, and more accessible — all in
              one place.
            </p>
          </div>

          <div className="flex items-center gap-5 self-start md:pt-3">
            <a
              href="https://www.facebook.com/share/1HTUVBiqz3/"
              target="_blank"
              rel="noreferrer"
              aria-label="IJM on Facebook"
              className="text-foreground transition hover:text-primary"
            >
              <Facebook className="h-8 w-8" />
            </a>
            <a
              href="https://www.linkedin.com/in/iammdismail"
              target="_blank"
              rel="noreferrer"
              aria-label="Md Ismail on LinkedIn"
              className="text-foreground transition hover:text-primary"
            >
              <Linkedin className="h-8 w-8" />
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 border-t px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:px-10">
          <span>© {new Date().getFullYear()} IJM. All rights reserved.</span>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-5">
            <Link to="/tools" className="transition hover:text-foreground">
              All Tools
            </Link>
            {categories.map((c) => (
              <Link key={c.slug} to={`/${c.slug}`} className="transition hover:text-foreground">
                {c.label}
              </Link>
            ))}
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <Link
              to="/about"
              className="font-medium text-foreground/70 transition hover:text-foreground"
            >
              About & Contact
            </Link>
            <Link
              to="/privacy"
              className="font-medium text-foreground/70 transition hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
