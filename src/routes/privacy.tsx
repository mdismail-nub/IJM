import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Stamp } from "lucide-react";

const TITLE = "Privacy Policy — IJM";
const DESC =
  "IJM privacy policy: your files and data never leave your browser. No accounts, no uploads, no tracking — here is exactly what that means.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

const sections: { title: string; body: string[] }[] = [
  {
    title: "The short version",
    body: [
      "IJM runs entirely in your browser. The documents you open, the data you paste and the work you do here never touch our servers — because there is no server to send them to.",
      "We don't ask for an account, we don't show ads, and we don't sell data. There is nothing to sign up for and nothing to opt out of.",
    ],
  },
  {
    title: "Your files never leave your device",
    body: [
      "Every tool on IJM — PDF conversions, data cleaning, code formatting and more — works locally in your browser. When you pick a file, it is read directly on your device and processed in memory.",
      "Nothing is uploaded, stored on a server, or shared with anyone. Close the tab and the file is gone.",
    ],
  },
  {
    title: "What stays on your device",
    body: [
      "A few tools save small preferences or entries — like saved clients or study plans — so you don't have to retype them. This is stored only in your own browser's local storage on your device.",
      "That data is never transmitted to us. Clearing your browser's site data removes it permanently.",
    ],
  },
  {
    title: "What we don't do",
    body: [
      "We don't require accounts or passwords. We don't sell, rent or share your information — we don't collect it in the first place. We don't run third-party ad trackers that follow you around the web.",
    ],
  },
  {
    title: "Links to other sites",
    body: [
      "Our footer links to our Facebook and LinkedIn pages. Those platforms have their own privacy policies, and anything you do there is governed by them — not by this policy.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If we update this policy, the new version will appear on this page with a revised date. Material changes will be highlighted on the home page.",
    ],
  },
  {
    title: "Questions",
    body: [
      "Something unclear? Reach us any time through our Facebook page or LinkedIn profile — both linked in the footer below.",
    ],
  },
];

function PrivacyPage() {
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
        <span className="font-medium text-foreground">Privacy Policy</span>
      </nav>

      <section className="mt-4 overflow-hidden rounded-[1.75rem] bg-ink p-6 text-ink-foreground shadow-card sm:rounded-[2rem] sm:p-8 md:p-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 px-4 py-1.5 text-xs font-semibold tracking-wide text-ink-foreground/80 sm:text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> Last updated — 27 October 2026
        </span>
        <h1 className="mt-5 text-[clamp(2.25rem,5.5vw,4.5rem)] font-bold leading-[1.04] tracking-tighter">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium text-ink-foreground/80 sm:text-xl md:text-2xl">
          Privacy at its core, in plain language. Here is exactly what happens to your data — and
          what doesn't.
        </p>
      </section>

      <section className="mx-auto mt-12 max-w-3xl sm:mt-14">
        {sections.map((s, i) => (
          <div key={s.title} className={i > 0 ? "mt-10 border-t pt-10 sm:mt-12 sm:pt-12" : ""}>
            <h2 className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-tight">
              {s.title}
            </h2>
            {s.body.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="mt-4 text-base leading-7 text-foreground/75 md:text-lg md:leading-8"
              >
                {p}
              </p>
            ))}
          </div>
        ))}

        <div className="mt-12 rounded-[1.75rem] bg-primary p-6 text-center text-primary-foreground shadow-card sm:mt-14 sm:rounded-[2rem] sm:p-8 md:p-10">
          <p className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight">
            <Stamp className="h-6 w-6" strokeWidth={2.5} /> IJM
          </p>
          <p className="mt-2 text-ink-foreground/80">
            The tools that never ask for your data.{" "}
            <Link
              to="/"
              className="font-semibold underline underline-offset-4 hover:text-foreground"
            >
              Back to the dock →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
