import assert from "node:assert/strict";
import { test } from "node:test";
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
} from "../src/lib/release1-tools";

test("Group 1A Text Tools: word counter, case converter, line breaks, find/replace, sorter, deduplicator, lorem ipsum", () => {
  const counts = analyzeTextCounts(
    "Hello world! This is a fast browser test.\n\nSecond paragraph here.",
  );
  assert.equal(counts.words, 11);
  assert.equal(counts.paragraphs, 2);
  assert.equal(counts.sentences >= 2, true);

  assert.equal(convertTextCase("hello world tool", "camel"), "helloWorldTool");
  assert.equal(convertTextCase("hello world tool", "snake"), "hello_world_tool");
  assert.equal(convertTextCase("hello world tool", "kebab"), "hello-world-tool");

  assert.equal(removeLineBreaks("Line 1\nLine 2\nLine 3", "all", " "), "Line 1 Line 2 Line 3");

  const replaced = findAndReplaceText("apple banana apple", "apple", "orange", {
    replaceAll: true,
  });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.matchCount, 2);
  assert.equal(replaced.output, "orange banana orange");

  const sorted = sortTextLines("Charlie\nAlice\nBob", "az");
  assert.equal(sorted.output, "Alice\nBob\nCharlie");

  const deduped = removeDuplicateLines("Alpha\nalpha\nBeta", {
    caseInsensitive: true,
  });
  assert.equal(deduped.uniqueCount, 2);
  assert.equal(deduped.removedCount, 1);

  const lorem = generateLoremIpsum(2, "paragraphs", { wrapHtmlP: true });
  assert.equal(lorem.startsWith("<p>Lorem ipsum"), true);
});

test("Group 1B Student Calculators: CGPA, GPA, and Weighted Grade with target final exam score", () => {
  const cgpa = calculateCgpa(
    [
      { id: "1", name: "Sem 1", gpa: 3.6, credits: 15 },
      { id: "2", name: "Sem 2", gpa: 3.8, credits: 15 },
    ],
    4,
  );
  assert.equal(cgpa.ok, true);
  assert.equal(cgpa.cgpa, 3.7);
  assert.equal(cgpa.totalCredits, 30);

  const gpa = calculateSemesterGpa([
    { id: "1", courseName: "Algorithms", gradePoints: 4.0, credits: 4 },
    { id: "2", courseName: "Databases", gradePoints: 3.0, credits: 4 },
  ]);
  assert.equal(gpa.ok, true);
  assert.equal(gpa.gpa, 3.5);

  const grade = calculateWeightedGrade(
    [
      { id: "1", name: "Midterm", scorePercent: 85, weightPercent: 40 },
      { id: "2", name: "Projects", scorePercent: 95, weightPercent: 30 },
    ],
    90,
  );
  assert.equal(grade.ok, true);
  assert.equal(grade.remainingWeightPercent, 30);
  // Weighted so far: 34 + 28.5 = 62.5. Need 90 - 62.5 = 27.5 across 30% -> 91.67%
  assert.equal(grade.requiredOnRemainingPercent, 91.67);
});

test("Group 1C Business & Finance: Profit Margin, Loan EMI, and Salary Calculator", () => {
  const margin = calculateProfitMargin({
    cost: 60,
    revenue: 100,
    targetMarginPercent: 50,
  });
  assert.equal(margin.ok, true);
  assert.equal(margin.grossProfit, 40);
  assert.equal(margin.profitMarginPercent, 40);
  assert.equal(margin.markupPercent, 66.67);
  assert.equal(margin.priceForTargetMargin, 120);

  const emi = calculateLoanEmi({
    principal: 12000,
    annualRatePercent: 0,
    tenureMonths: 12,
  });
  assert.equal(emi.ok, true);
  assert.equal(emi.monthlyEmi, 1000);
  assert.equal(emi.schedule.length, 12);

  const salary = calculateSalaryBreakdown({
    amount: 120000,
    period: "annual",
    hoursPerWeek: 40,
    daysPerWeek: 5,
    weeksPerYear: 52,
    taxRatePercent: 20,
    retirementPercent: 5,
  });
  assert.equal(salary.ok, true);
  assert.equal(salary.annualNet, 90000);
  assert.equal(salary.periods.monthly.net, 7500);
});

test("Group 1D Developer, Security & SEO Tools: Regex, JWT, Cron, Color, Chmod, HTTP, Password, Meta, Slug, UTM, QR", async () => {
  const rx = testRegularExpression("(\\d+)-([a-z]+)", "g", "id: 42-abc and 99-xyz");
  assert.equal(rx.ok, true);
  assert.equal(rx.matches.length, 2);
  assert.deepEqual(rx.matches[0]?.groups, ["42", "abc"]);

  // Sample unsigned JWT: {"alg":"HS256","typ":"JWT"}.{"sub":"123","name":"Ada"}
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIn0.sig";
  const jwt = decodeJwtToken(token);
  assert.equal(jwt.ok, true);
  assert.equal(jwt.claims.alg, "HS256");
  assert.equal(jwt.claims.sub, "123");

  const cron = explainAndPreviewCron("*/15 * * * *");
  assert.equal(cron.ok, true);
  assert.equal(cron.nextRunsUtc.length, 5);

  const color = convertColorValue("#D6F538");
  assert.equal(color.ok, true);
  assert.deepEqual(color.rgb, { r: 214, g: 245, b: 56 });

  const chmod = calculateUnixPermissions({
    owner: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    others: { read: true, write: false, execute: true },
  });
  assert.equal(chmod.octal, "0755");
  assert.equal(chmod.symbolic, "-rwxr-xr-x");

  assert.equal(searchHttpStatusCodes("404").length, 1);

  const pwd = generateSecurePassword({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  assert.equal(pwd.ok, true);
  assert.equal(pwd.password.length, 20);
  assert.equal(pwd.entropyBits > 100, true);

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
  assert.equal(meta.includes("<title>IJM</title>"), true);

  assert.equal(
    generateUrlSlug("How to Build the Best Web App in 2026!", {
      removeStopWords: true,
    }),
    "build-best-web-app-in-2026",
  );

  const utm = buildUtmUrl({
    baseUrl: "https://example.com",
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "launch",
  });
  assert.equal(utm.ok, true);
  assert.equal(
    utm.url,
    "https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
  );

  const qr = await generateQrCodeAssets("https://example.com");
  assert.equal(qr.ok, true);
  assert.equal(qr.svgString.includes("<svg"), true);
  assert.equal(qr.pngDataUrl.startsWith("data:image/png;base64,"), true);
});
