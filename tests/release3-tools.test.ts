import test from "node:test";
import assert from "node:assert/strict";
import { csvToJson, jsonToCsv } from "../src/lib/data-tools";
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
  isRelease3ToolSlug,
  minifyCodeSource,
  parseExcelBufferToSheets,
  RELEASE3_TOOL_SLUGS,
  solveLinearEquation,
  solveLinearSystem2x2,
  solveQuadraticEquation,
} from "../src/lib/release3-tools";

test("Release 3 exports all 19 tool slugs and recognizes them via type guard", () => {
  assert.equal(RELEASE3_TOOL_SLUGS.length, 19);
  for (const slug of RELEASE3_TOOL_SLUGS) {
    assert.equal(isRelease3ToolSlug(slug), true);
  }
  assert.equal(isRelease3ToolSlug("merge-pdfs"), false);
});

test("Excel (.xlsx) workbook generator and multi-sheet parser round-trip accurately", async () => {
  const sampleBytes = generateSampleExcelWorkbookBytes();
  assert.equal(sampleBytes[0], 0x50); // 'P'
  assert.equal(sampleBytes[1], 0x4b); // 'K'

  const parsed = await parseExcelBufferToSheets(sampleBytes, "sample.xlsx");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.sheets.length, 2);
  assert.equal(parsed.sheets[0]?.name, "Q4 Sales Orders");
  assert.deepEqual(parsed.sheets[0]?.dataset.headers, [
    "Order ID",
    "Customer",
    "Region",
    "Product Tier",
    "Seats",
    "ARR ($)",
    "Active",
  ]);
  assert.equal(parsed.sheets[0]?.dataset.rows.length, 4);
  assert.equal(parsed.sheets[0]?.dataset.rows[0]?.[1], "Acme Robotics");
});

test("JSON to Excel (.xlsx) flattens nested objects and produces valid OpenXML archive", async () => {
  const raw = JSON.stringify([
    { id: "1", user: { name: "Ada", role: "Admin" }, active: true },
    { id: "2", user: { name: "Grace", role: "Lead" }, active: false },
  ]);
  const res = convertJsonToExcelData(raw, { flattenNested: true, sheetName: "Team" });
  assert.equal(res.ok, true);
  assert.equal(res.rowCount, 2);
  assert.deepEqual(res.dataset.headers, ["id", "user.name", "user.role", "active"]);

  const roundTrip = await parseExcelBufferToSheets(res.xlsxBytes, "team.xlsx");
  assert.equal(roundTrip.ok, true);
  assert.equal(roundTrip.sheets[0]?.name, "Team");
  assert.equal(roundTrip.sheets[0]?.dataset.rows[0]?.[1], "Ada");
});

test("Enriched CSV <-> JSON supports custom delimiters and nested object flattening", () => {
  const jsonInput = JSON.stringify([{ item: "Book", meta: { pages: 320 } }]);
  const csvRes = jsonToCsv(jsonInput, { delimiter: ";", flattenNested: true });
  assert.equal(csvRes.ok, true);
  assert.ok(csvRes.output.includes("item;meta.pages"));
  assert.ok(csvRes.output.includes("Book;320"));

  const backToJson = csvToJson(csvRes.output, { delimiter: ";", inferTypes: true });
  assert.equal(backToJson.ok, true);
  assert.equal(backToJson.rowCount, 1);
});

test("CSV Column Extractor, Delimiter Converter, Compare CSVs, and Excel Formula Helper", () => {
  const csv = "A,B,C\n1,2,3\n4,5,6";
  const extracted = extractCsvColumns(csv, [2, 0]);
  assert.equal(extracted.ok, true);
  assert.deepEqual(extracted.dataset.headers, ["C", "A"]);
  assert.deepEqual(extracted.dataset.rows[0], ["3", "1"]);

  const converted = convertCsvDelimiter('Name,Role\n"Ada, Jr.",Engineer', "auto", ";");
  assert.equal(converted.ok, true);
  assert.equal(converted.output, "Name;Role\nAda, Jr.;Engineer");

  const diff = compareTwoCsvFiles(
    "ID,Name,Score\n1,Ada,95\n2,Bob,80",
    "ID,Name,Score\n1,Ada,98\n3,Carol,91",
    { keyColumnIndex: 0 },
  );
  assert.equal(diff.ok, true);
  assert.equal(diff.modifiedCount, 1);
  assert.equal(diff.addedCount, 1);
  assert.equal(diff.removedCount, 1);

  const formula = buildExcelFormula(
    "xlookup",
    { lookupVal: "A2", lookupArr: "B2:B100", returnArr: "D2:D100", notFound: "Missing" },
    { wrapIfError: true, ifErrorFallback: "N/A" },
  );
  assert.equal(formula.formula, '=IFERROR(XLOOKUP(A2, B2:B100, D2:D100, "Missing", 0), "N/A")');
});

test("Markdown <-> HTML converter and Academic Citation Generator", () => {
  const html = convertMarkdownToHtml("# Hello World\n\nThis is **bold** and `code`.");
  assert.ok(html.includes('<h1 id="hello-world">Hello World</h1>'));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<code>code</code>"));

  const md = convertHtmlToMarkdown(
    '<h2>Subheading</h2><p>Visit <a href="https://example.com">Example</a></p>',
  );
  assert.ok(md.includes("## Subheading"));
  assert.ok(md.includes("[Example](https://example.com)"));

  const apa = generateFormattedCitation({
    style: "apa",
    sourceType: "journal",
    authors: [{ firstName: "Ada", lastName: "Lovelace" }],
    title: "Analytical Engine Notes",
    containerTitle: "Scientific Memoirs",
    year: "1843",
    volume: "3",
    pages: "666-731",
  });
  assert.ok(apa.bibliography.includes("Lovelace, A. (1843)."));
  assert.equal(apa.inText, "(Lovelace, 1843)");
});

test("SQL Formatter, SQL Query Builder, Hash Generator, Code Minifier, and CSS Formatter", async () => {
  const formattedSql = formatSqlQuery(
    "select id, name from users where active = 1 order by name asc",
  );
  assert.ok(
    formattedSql.includes("SELECT\n  id,\n  name\nFROM users\nWHERE active = 1\nORDER BY name ASC"),
  );

  const builtSql = buildSqlQuery({
    operation: "SELECT",
    table: "users",
    columns: ["id", "email"],
    where: [{ id: "1", column: "role", operator: "=", value: "admin", conjunction: "AND" }],
    orderByColumn: "id",
    orderByDirection: "DESC",
    limit: 10,
  });
  assert.ok(builtSql.includes("WHERE role = 'admin'"));
  assert.ok(builtSql.includes("LIMIT 10;"));

  assert.equal(computeMd5Hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
  const hashes = await generateAllHashes("abc");
  assert.equal(hashes.md5, "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(hashes.sha1, "a9993e364706816aba3e25717850c26c9cd0d89d");
  assert.equal(hashes.sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  const minCss = minifyCodeSource(
    "/* comment */\n.box {\n  color: #111;\n  margin: 0px;\n}",
    "css",
  );
  assert.equal(minCss.output, ".box{color:#111;margin:0px}");
  assert.ok(minCss.savedBytes > 0);

  const prettyCss = formatCssStylesheet(".card{z-index:2;align-items:center;display:flex}", {
    sortProperties: true,
  });
  assert.equal(prettyCss.ruleCount, 1);
  assert.ok(prettyCss.output.indexOf("align-items") < prettyCss.output.indexOf("z-index"));
});

test("Scientific Calculator, Equation Solver, Habit Tracker, and Project Timeline Generator", () => {
  const degTrig = evaluateScientificExpression("sin(30) + sqrt(81) + 4!", { angleUnit: "deg" });
  assert.equal(degTrig.ok, true);
  assert.equal(degTrig.value, 33.5);

  const lin = solveLinearEquation(3, -6, 9);
  assert.equal(lin.ok, true);
  assert.equal(lin.x, 5);

  const quad = solveQuadraticEquation(1, -5, 6);
  assert.equal(quad.ok, true);
  assert.equal(quad.discriminant, 1);
  assert.deepEqual(quad.roots, ["x₁ = 3", "x₂ = 2"]);

  const sys = solveLinearSystem2x2(2, 1, 5, 1, -1, 1);
  assert.equal(sys.ok, true);
  assert.equal(sys.x, 2);
  assert.equal(sys.y, 1);

  const habits = calculateHabitMetrics([
    { id: "1", name: "Study", category: "Academic", completedDays: [false, true, true, true] },
  ]);
  assert.equal(habits.topStreak, 3);
  assert.equal(habits.overallCompletionPercent, 75);

  const timeline = generateProjectTimeline([
    {
      id: "t1",
      title: "Phase 1",
      owner: "Ada",
      startDate: "2026-06-01",
      durationDays: 5,
      status: "completed",
    },
    {
      id: "t2",
      title: "Phase 2",
      owner: "Grace",
      startDate: "2026-06-06",
      durationDays: 5,
      status: "planned",
    },
  ]);
  assert.equal(timeline.ok, true);
  assert.equal(timeline.totalDurationDays, 10);
  assert.equal(timeline.completionPercent, 50);
});
