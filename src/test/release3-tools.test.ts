import { describe, expect, it } from "vitest";
import {
  buildExcelFormula,
  buildSqlQuery,
  calculateHabitMetrics,
  compareTwoCsvFiles,
  computeMd5Hex,
  convertCsvDelimiter,
  convertHtmlToMarkdown,
  convertJsonToExcelData,
  convertMarkdownToHtml,
  evaluateScientificExpression,
  extractCsvColumns,
  formatCssStylesheet,
  formatSqlQuery,
  generateAllHashes,
  generateFormattedCitation,
  generateProjectTimeline,
  generateSampleExcelWorkbookBytes,
  minifyCodeSource,
  parseExcelBufferToSheets,
  RELEASE3_TOOL_SLUGS,
  solveLinearEquation,
  solveLinearSystem2x2,
  solveQuadraticEquation,
} from "@/lib/release3-tools";

describe("Release 3 Data, Developer & Student Tools Suite", () => {
  it("exports all 19 Release 3 tool slugs", () => {
    expect(RELEASE3_TOOL_SLUGS).toHaveLength(19);
  });

  it("round-trips multi-sheet .xlsx workbooks and JSON-to-Excel exports", async () => {
    const sample = generateSampleExcelWorkbookBytes();
    const parsed = await parseExcelBufferToSheets(sample, "sample.xlsx");
    expect(parsed.ok).toBe(true);
    expect(parsed.sheets).toHaveLength(2);
    expect(parsed.sheets[0]?.dataset.rows).toHaveLength(4);

    const jsonExcel = convertJsonToExcelData(
      JSON.stringify([{ sku: "A1", pricing: { usd: 49, active: true } }]),
      { flattenNested: true, sheetName: "Catalog" },
    );
    expect(jsonExcel.ok).toBe(true);
    expect(jsonExcel.dataset.headers).toEqual(["sku", "pricing.usd", "pricing.active"]);
  });

  it("processes CSV column extraction, delimiter conversion, CSV comparison, and Excel formulas", () => {
    const ext = extractCsvColumns("Col1,Col2,Col3\nA,B,C", [2, 0]);
    expect(ext.ok).toBe(true);
    expect(ext.dataset.headers).toEqual(["Col3", "Col1"]);

    const delim = convertCsvDelimiter("A,B\n1,2", "auto", "|");
    expect(delim.output).toBe("A|B\n1|2");

    const cmp = compareTwoCsvFiles("ID,Val\n1,10\n2,20", "ID,Val\n1,15\n3,30", {
      keyColumnIndex: 0,
    });
    expect(cmp.modifiedCount).toBe(1);
    expect(cmp.addedCount).toBe(1);
    expect(cmp.removedCount).toBe(1);

    const formula = buildExcelFormula("vlookup", {
      lookupVal: "A2",
      tableArr: "$B$2:$E$100",
      colIndex: "3",
    });
    expect(formula.formula).toBe("=VLOOKUP(A2, $B$2:$E$100, 3, FALSE)");
  });

  it("converts Markdown <-> HTML, generates citations, formats SQL/CSS, minifies code, and hashes", async () => {
    const html = convertMarkdownToHtml("## Title\n\n- [x] Done");
    expect(html).toContain('<h2 id="title">Title</h2>');
    expect(html).toContain('type="checkbox"');

    const md = convertHtmlToMarkdown("<h1>Guide</h1><p><strong>Fast</strong></p>");
    expect(md).toContain("# Guide");
    expect(md).toContain("**Fast**");

    const cit = generateFormattedCitation({
      style: "ieee",
      sourceType: "journal",
      authors: [{ firstName: "Grace", lastName: "Hopper" }],
      title: "Compiler Design",
      year: "1952",
    });
    expect(cit.inText).toBe("[1]");

    expect(formatSqlQuery("select id, name from items where id = 1")).toContain(
      "SELECT\n  id,\n  name\nFROM items",
    );
    expect(
      buildSqlQuery({
        operation: "DELETE",
        table: "sessions",
        columns: [],
        where: [{ id: "1", column: "expired", operator: "=", value: "true", conjunction: "AND" }],
      }),
    ).toContain("DELETE FROM sessions");

    expect(computeMd5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    const digests = await generateAllHashes("abc");
    expect(digests.sha256).toHaveLength(64);

    const minified = minifyCodeSource("/* header */ body { margin: 0; }", "css");
    expect(minified.output).toBe("body{margin:0}");

    const css = formatCssStylesheet("body{color:red;background:blue}", { sortProperties: true });
    expect(css.ruleCount).toBe(1);
  });

  it("evaluates scientific expressions, solves equations, tracks habits, and builds project timelines", () => {
    const calc = evaluateScientificExpression("cos(0) + 2^3", { angleUnit: "deg" });
    expect(calc.ok).toBe(true);
    expect(calc.value).toBe(9);

    expect(solveLinearEquation(2, 4, 10).x).toBe(3);
    expect(solveQuadraticEquation(1, 0, 4).nature).toBe("complex-conjugate");
    expect(solveLinearSystem2x2(1, 1, 10, 1, -1, 2).x).toBe(6);

    const habit = calculateHabitMetrics([
      { id: "h1", name: "Code", category: "Dev", completedDays: [true, true, true] },
    ]);
    expect(habit.overallCompletionPercent).toBe(100);

    const tl = generateProjectTimeline([
      {
        id: "1",
        title: "Launch",
        owner: "Team",
        startDate: "2026-07-01",
        durationDays: 3,
        status: "completed",
      },
    ]);
    expect(tl.ok).toBe(true);
    expect(tl.projectEndDate).toBe("2026-07-03");
  });
});
