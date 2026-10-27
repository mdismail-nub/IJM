import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
import {
  clearRecentTools,
  formatBytes,
  getRecentToolSlugs,
  recordRecentTool,
  validateFile,
} from "@/lib/file-utils";
import { categories, getAllTools, getToolBySlug, searchTools } from "@/lib/tools";
import { routeTree } from "@/routeTree.gen";

describe("App routing, Foundation & End-to-End Tool Registry QA", () => {
  it("matches all core platform routes and all 82 individual tool routes", () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
    });

    const corePaths = [
      "/",
      "/tools",
      "/about",
      "/privacy",
      "/file-tools",
      "/data-tools",
      "/business-tools",
      "/developer-tools",
      "/student-tools",
    ];

    const toolPaths = getAllTools().map((t) => `/tools/${t.slug}`);

    for (const path of [...corePaths, ...toolPaths]) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });

  it("registers all 82 tools across 5 categories and supports keyword search", () => {
    expect(categories).toHaveLength(5);
    expect(getAllTools()).toHaveLength(82);
    expect(getToolBySlug("invoice-generator")?.categorySlug).toBe("business-tools");
    expect(getToolBySlug("word-counter")?.categorySlug).toBe("data-tools");
    expect(getToolBySlug("cgpa-calculator")?.categorySlug).toBe("student-tools");
    expect(getToolBySlug("loan-emi-calculator")?.categorySlug).toBe("business-tools");
    expect(getToolBySlug("qr-code-generator")?.categorySlug).toBe("developer-tools");
    expect(getToolBySlug("favicon-generator")?.categorySlug).toBe("file-tools");
    expect(getToolBySlug("sign-pdf")?.categorySlug).toBe("file-tools");
    expect(getToolBySlug("image-dpi-checker")?.categorySlug).toBe("file-tools");
    expect(getToolBySlug("excel-to-csv")?.categorySlug).toBe("data-tools");
    expect(getToolBySlug("sql-formatter")?.categorySlug).toBe("developer-tools");
    expect(getToolBySlug("equation-solver")?.categorySlug).toBe("student-tools");
    expect(searchTools("json").some((t) => t.slug === "json-formatter")).toBe(true);
    expect(searchTools("pomodoro").some((t) => t.slug === "pomodoro-timer")).toBe(true);
    expect(searchTools("watermark").some((t) => t.slug === "add-watermark-to-pdf")).toBe(true);
    expect(searchTools("xlookup").some((t) => t.slug === "excel-formula-helper")).toBe(true);
    expect(searchTools("nonexistent-tool-xyz")).toHaveLength(0);
  });

  it("renders every single one of the 82 interactive tool workspaces without errors", () => {
    for (const tool of getAllTools()) {
      const element = isRelease1ToolSlug(tool.slug) ? (
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
      );

      const { container, unmount } = render(element);
      expect(container.firstChild).not.toBeNull();
      unmount();
    }
  });

  it("validates files and manages recent tools in localStorage", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(
      validateFile(
        { name: "report.pdf", size: 1024, type: "application/pdf" },
        { allowedExtensions: ["pdf"] },
      ).valid,
    ).toBe(true);
    expect(
      validateFile(
        { name: "bad.exe", size: 1024, type: "application/octet-stream" },
        { allowedExtensions: ["pdf"] },
      ).valid,
    ).toBe(false);

    clearRecentTools();
    expect(getRecentToolSlugs()).toEqual([]);
    recordRecentTool("merge-pdfs");
    recordRecentTool("json-formatter");
    recordRecentTool("merge-pdfs");
    expect(getRecentToolSlugs()).toEqual(["merge-pdfs", "json-formatter"]);
    clearRecentTools();
  });
});
