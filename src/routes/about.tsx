import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, Facebook, Linkedin, Lock, ShieldCheck, Stamp, Zap } from "lucide-react";
import { categories, getAllTools } from "@/lib/tools";

const TITLE = "About & Contact — IJM";
const DESC =
  "Learn how IJM processes files and data locally in your browser without accounts or servers, and how to get in touch.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const totalTools = getAllTools().length;

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
        <span className="font-medium text-foreground">About & Contact</span>
      </nav>

      <section className="mt-4 overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-card sm:rounded-[2rem] sm:p-8 md:p-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-4 py-1.5 text-sm font-semibold tracking-wide">
          <Stamp className="h-4 w-4 shrink-0" /> IJM Platform
        </span>
        <h1 className="mt-5 text-[clamp(2rem,5.5vw,4.5rem)] font-bold leading-[1.04] tracking-tighter">
          Built for speed and local privacy.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium text-foreground/85 sm:text-xl md:text-2xl">
          IJM brings {totalTools} everyday utilities across {categories.length} categories into one
          fast, distraction-free dock — with zero mandatory accounts and local browser execution.
        </p>
      </section>

      <section className="mt-12 grid gap-6 sm:mt-14 md:grid-cols-3">
        <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
            Browser-First Architecture
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Documents, images, CSV spreadsheets, invoices, and code snippets are processed directly
            in your browser's memory using Web APIs. Your files are not uploaded to remote servers.
          </p>
        </article>

        <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">
            No Registration Wall
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every tool works immediately without creating an account, handing over an email address,
            or navigating pop-up paywalls. Optional preferences like study timetables and business
            profiles stay in your browser's local storage.
          </p>
        </article>

        <article className="rounded-3xl border bg-card p-6 shadow-card sm:p-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Code2 className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">Honest Capabilities</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Every tool clearly explains what it does, validates inputs before processing, and
            provides direct downloads of your actual processed files without watermarks or
            artificial delays.
          </p>
        </article>
      </section>

      <section className="mt-14 grid gap-6 rounded-[1.75rem] border bg-card p-5 shadow-card sm:mt-16 sm:gap-8 sm:rounded-[2rem] sm:p-8 md:grid-cols-2 md:p-12">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1 text-xs font-semibold text-foreground">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden /> Get in touch
          </span>
          <h2 className="mt-4 text-[clamp(1.65rem,3.5vw,2.25rem)] font-bold tracking-tight">
            Contact & Feedback
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            Have a question, found a bug, or want to suggest an improvement to an existing tool?
            Reach out directly via our official social profiles linked below.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Note: Because IJM does not store your files or personal data on a server, please do not
            attach confidential documents when messaging us on external platforms.
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-4">
          <a
            href="https://www.linkedin.com/in/iammdismail"
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border bg-background p-4 transition hover:-translate-y-0.5 hover:border-foreground/50 hover:shadow-card sm:p-5"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground sm:h-12 sm:w-12">
                <Linkedin className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground sm:text-base">
                  Connect on LinkedIn
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  linkedin.com/in/iammdismail
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-foreground sm:text-sm">
              Open →
            </span>
          </a>

          <a
            href="https://www.facebook.com/share/1HTUVBiqz3/"
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border bg-background p-4 transition hover:-translate-y-0.5 hover:border-foreground/50 hover:shadow-card sm:p-5"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground sm:h-12 sm:w-12">
                <Facebook className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground sm:text-base">
                  IJM on Facebook
                </p>
                <p className="truncate text-xs text-muted-foreground">Official IJM page</p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-foreground sm:text-sm">
              Open →
            </span>
          </a>
        </div>
      </section>
    </main>
  );
}
