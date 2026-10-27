import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Compass } from "lucide-react";

import { ToolShell } from "@/components/tool-shell";
import { BusinessToolWorkspace } from "@/components/tools/business-tools-workspace";
import { DataToolWorkspace } from "@/components/tools/data-tools-workspace";
import { DeveloperToolWorkspace } from "@/components/tools/developer-tools-workspace";
import { FileToolWorkspace } from "@/components/tools/file-tools-workspace";
import {
  isRelease1ToolSlug,
  Release1ToolWorkspace,
} from "@/components/tools/release1-tools-workspace";
import {
  isRelease2ToolSlug,
  Release2ToolWorkspace,
} from "@/components/tools/release2-tools-workspace";
import {
  isRelease3ToolSlug,
  Release3ToolWorkspace,
} from "@/components/tools/release3-tools-workspace";
import { StudentToolWorkspace } from "@/components/tools/student-tools-workspace";
import { getAllTools, getToolBySlug } from "@/lib/tools";

export const Route = createFileRoute("/tools/$toolSlug")({
  head: ({ params }) => {
    const tool = getToolBySlug(params.toolSlug);
    const title = tool
      ? `${tool.name} — Free Online ${tool.subcategory ?? "Utility"} | IJM`
      : "Tool Not Found — IJM";
    const description = tool
      ? `${tool.desc} Runs 100% in your browser with private local processing.`
      : "Browse 80+ browser-first online tools for files, text, data, business, students, and developers.";
    const canonicalUrl = `https://ijm.app/tools/${params.toolSlug}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
    };
  },
  component: ToolDetailRoutePage,
});

function ToolDetailRoutePage() {
  const { toolSlug } = Route.useParams();
  const tool = getToolBySlug(toolSlug);
  const totalTools = getAllTools().length;

  if (!tool) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 md:px-10">
        <div className="rounded-[2rem] border bg-card p-8 text-center shadow-card sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tool Not Found
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            We couldn&apos;t find a utility matching &ldquo;{toolSlug}&rdquo;
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            Check the URL or browse all {totalTools} browser-first utilities across File, Data,
            Business, Student, and Developer categories.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/tools"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5"
            >
              <Compass className="h-4 w-4" />
              Browse all tools
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ToolShell tool={tool}>
      {isRelease1ToolSlug(tool.slug) ? (
        <Release1ToolWorkspace toolSlug={tool.slug} />
      ) : isRelease2ToolSlug(tool.slug) ? (
        <Release2ToolWorkspace toolSlug={tool.slug} />
      ) : isRelease3ToolSlug(tool.slug) ? (
        <Release3ToolWorkspace toolSlug={tool.slug} />
      ) : tool.categorySlug === "developer-tools" ? (
        <DeveloperToolWorkspace toolSlug={tool.slug} />
      ) : tool.categorySlug === "file-tools" ? (
        <FileToolWorkspace toolSlug={tool.slug} />
      ) : tool.categorySlug === "data-tools" ? (
        <DataToolWorkspace toolSlug={tool.slug} />
      ) : tool.categorySlug === "business-tools" ? (
        <BusinessToolWorkspace toolSlug={tool.slug} />
      ) : (
        <StudentToolWorkspace />
      )}
    </ToolShell>
  );
}
