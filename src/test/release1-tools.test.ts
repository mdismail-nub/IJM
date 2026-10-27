import { describe, expect, it } from "vitest";

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
} from "@/lib/release1-tools";

describe("Release 1 — 27 Quick-Win Tools Pure Logic", () => {
  it("analyzes text counts, converts cases, removes line breaks, sorts, and deduplicates lines", () => {
    const counts = analyzeTextCounts(
      "Hello world! This is a fast browser test.\n\nSecond paragraph here.",
    );
    expect(counts.words).toBe(11);
    expect(counts.paragraphs).toBe(2);
    expect(counts.sentences).toBeGreaterThanOrEqual(2);

    expect(convertTextCase("hello world tool", "camel")).toBe("helloWorldTool");
    expect(convertTextCase("hello world tool", "snake")).toBe("hello_world_tool");
    expect(convertTextCase("hello world tool", "kebab")).toBe("hello-world-tool");

    expect(removeLineBreaks("Line 1\nLine 2\nLine 3", "all", " ")).toBe("Line 1 Line 2 Line 3");

    const replaced = findAndReplaceText("apple banana apple", "apple", "orange", {
      replaceAll: true,
    });
    expect(replaced.ok).toBe(true);
    expect(replaced.matchCount).toBe(2);
    expect(replaced.output).toBe("orange banana orange");

    const sorted = sortTextLines("Charlie\nAlice\nBob", "az");
    expect(sorted.output).toBe("Alice\nBob\nCharlie");

    const deduped = removeDuplicateLines("Alpha\nalpha\nBeta", {
      caseInsensitive: true,
    });
    expect(deduped.uniqueCount).toBe(2);
    expect(deduped.removedCount).toBe(1);

    const lorem = generateLoremIpsum(2, "paragraphs", { wrapHtmlP: true });
    expect(lorem.startsWith("<p>Lorem ipsum")).toBe(true);
  });

  it("calculates CGPA, GPA, weighted grades, profit margin, loan EMI, and salary breakdown", () => {
    const cgpa = calculateCgpa(
      [
        { id: "1", name: "Sem 1", gpa: 3.6, credits: 15 },
        { id: "2", name: "Sem 2", gpa: 3.8, credits: 15 },
      ],
      4,
    );
    expect(cgpa.ok).toBe(true);
    expect(cgpa.cgpa).toBe(3.7);
    expect(cgpa.totalCredits).toBe(30);

    const gpa = calculateSemesterGpa([
      { id: "1", courseName: "Algorithms", gradePoints: 4.0, credits: 4 },
      { id: "2", courseName: "Databases", gradePoints: 3.0, credits: 4 },
    ]);
    expect(gpa.ok).toBe(true);
    expect(gpa.gpa).toBe(3.5);

    const grade = calculateWeightedGrade(
      [
        { id: "1", name: "Midterm", scorePercent: 85, weightPercent: 40 },
        { id: "2", name: "Projects", scorePercent: 95, weightPercent: 30 },
      ],
      90,
    );
    expect(grade.ok).toBe(true);
    expect(grade.remainingWeightPercent).toBe(30);
    expect(grade.requiredOnRemainingPercent).toBe(91.67);

    const margin = calculateProfitMargin({
      cost: 60,
      revenue: 100,
      targetMarginPercent: 50,
    });
    expect(margin.ok).toBe(true);
    expect(margin.grossProfit).toBe(40);
    expect(margin.profitMarginPercent).toBe(40);
    expect(margin.markupPercent).toBe(66.67);
    expect(margin.priceForTargetMargin).toBe(120);

    const emi = calculateLoanEmi({
      principal: 12000,
      annualRatePercent: 0,
      tenureMonths: 12,
    });
    expect(emi.ok).toBe(true);
    expect(emi.monthlyEmi).toBe(1000);
    expect(emi.schedule).toHaveLength(12);

    const salary = calculateSalaryBreakdown({
      amount: 120000,
      period: "annual",
      hoursPerWeek: 40,
      daysPerWeek: 5,
      weeksPerYear: 52,
      taxRatePercent: 20,
      retirementPercent: 5,
    });
    expect(salary.ok).toBe(true);
    expect(salary.annualNet).toBe(90000);
    expect(salary.periods.monthly.net).toBe(7500);
  });

  it("handles regex testing, JWT decoding, cron explanation, color conversion, chmod, HTTP status, password, SEO, and QR", async () => {
    const rx = testRegularExpression("(\\d+)-([a-z]+)", "g", "id: 42-abc and 99-xyz");
    expect(rx.ok).toBe(true);
    expect(rx.matches).toHaveLength(2);
    expect(rx.matches[0]?.groups).toEqual(["42", "abc"]);

    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIn0.sig";
    const jwt = decodeJwtToken(token);
    expect(jwt.ok).toBe(true);
    expect(jwt.claims.alg).toBe("HS256");
    expect(jwt.claims.sub).toBe("123");

    const cron = explainAndPreviewCron("*/15 * * * *");
    expect(cron.ok).toBe(true);
    expect(cron.nextRunsUtc).toHaveLength(5);

    const color = convertColorValue("#D6F538");
    expect(color.ok).toBe(true);
    expect(color.rgb).toEqual({ r: 214, g: 245, b: 56 });

    const chmod = calculateUnixPermissions({
      owner: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      others: { read: true, write: false, execute: true },
    });
    expect(chmod.octal).toBe("0755");
    expect(chmod.symbolic).toBe("-rwxr-xr-x");

    expect(searchHttpStatusCodes("404")).toHaveLength(1);

    const pwd = generateSecurePassword({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: false,
    });
    expect(pwd.ok).toBe(true);
    expect(pwd.password).toHaveLength(20);
    expect(pwd.entropyBits).toBeGreaterThan(100);

    const meta = generateMetaTagsHtml({
      title: "IJM",
      description: "Fast online utilities",
      canonicalUrl: "https://example.com",
      ogType: "website",
      ogImageUrl: "",
      siteName: "IJM",
      robotsIndex: true,
      robotsFollow: true,
    });
    expect(meta).toContain("<title>IJM</title>");

    expect(
      generateUrlSlug("How to Build the Best Web App in 2026!", {
        removeStopWords: true,
      }),
    ).toBe("build-best-web-app-in-2026");

    const utm = buildUtmUrl({
      baseUrl: "https://example.com",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "launch",
    });
    expect(utm.ok).toBe(true);
    expect(utm.url).toBe(
      "https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
    );

    const qr = await generateQrCodeAssets("https://example.com");
    expect(qr.ok).toBe(true);
    expect(qr.svgString).toContain("<svg");
    expect(qr.pngDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
