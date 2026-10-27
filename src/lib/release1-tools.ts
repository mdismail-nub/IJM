import QRCode from "qrcode";

// ============================================================================
// Group 1A: Text & Writing Tools Pure Logic
// ============================================================================

const STOP_WORDS = new Set([
  "a",
  "an",
  "to",
  "of",
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "your",
  "have",
  "are",
  "was",
  "were",
  "will",
  "into",
  "about",
  "than",
  "then",
  "them",
  "they",
  "their",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "not",
  "but",
  "you",
  "all",
  "any",
  "can",
  "had",
  "her",
  "his",
  "its",
  "our",
  "out",
  "has",
  "been",
]);

export interface WordCounterResult {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTimeMinutes: number;
  speakingTimeMinutes: number;
  topKeywords: { word: string; count: number }[];
}

export function analyzeTextCounts(text: string): WordCounterResult {
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      characters,
      charactersNoSpaces,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: text === "" ? 0 : text.split(/\r?\n/).length,
      readingTimeMinutes: 0,
      speakingTimeMinutes: 0,
      topKeywords: [],
    };
  }

  const wordTokens = trimmed.split(/\s+/).filter(Boolean);
  const words = wordTokens.length;
  const sentences =
    trimmed
      .split(/[.!?]+(?=\s|$)/)
      .map((s) => s.trim())
      .filter(Boolean).length || (words > 0 ? 1 : 0);
  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
  const lines = text.split(/\r?\n/).length;

  const readingTimeMinutes = Math.max(0.1, Math.round((words / 225) * 10) / 10);
  const speakingTimeMinutes = Math.max(0.1, Math.round((words / 130) * 10) / 10);

  const freq = new Map<string, number>();
  for (const raw of wordTokens) {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9']/g, "");
    if (cleaned.length < 3 || STOP_WORDS.has(cleaned)) continue;
    freq.set(cleaned, (freq.get(cleaned) ?? 0) + 1);
  }

  const topKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    readingTimeMinutes,
    speakingTimeMinutes,
    topKeywords,
  };
}

export type CaseConversionMode =
  "upper" | "lower" | "title" | "sentence" | "camel" | "pascal" | "snake" | "kebab" | "constant";

function extractWordsForIdentifier(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-/]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
}

export function convertTextCase(text: string, mode: CaseConversionMode): string {
  if (!text) return "";
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case "sentence":
      return text
        .toLowerCase()
        .replace(/(^\s*[a-z]|[.!?]\s+[a-z])/g, (match) => match.toUpperCase());
    case "camel": {
      const words = extractWordsForIdentifier(text);
      return words
        .map((w, i) =>
          i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join("");
    }
    case "pascal": {
      const words = extractWordsForIdentifier(text);
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
    }
    case "snake":
      return extractWordsForIdentifier(text)
        .map((w) => w.toLowerCase())
        .join("_");
    case "kebab":
      return extractWordsForIdentifier(text)
        .map((w) => w.toLowerCase())
        .join("-");
    case "constant":
      return extractWordsForIdentifier(text)
        .map((w) => w.toUpperCase())
        .join("_");
  }
}

export function removeLineBreaks(
  text: string,
  mode: "all" | "preserve-paragraphs" = "all",
  separator = " ",
): string {
  if (!text) return "";
  if (mode === "preserve-paragraphs") {
    return text
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((para) =>
        para
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join(separator),
      )
      .filter(Boolean)
      .join("\n\n");
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(separator);
}

export function findAndReplaceText(
  text: string,
  findStr: string,
  replaceStr: string,
  options: {
    useRegex?: boolean;
    caseSensitive?: boolean;
    replaceAll?: boolean;
  } = {},
): { ok: boolean; output: string; matchCount: number; error?: string } {
  if (!findStr) {
    return { ok: true, output: text, matchCount: 0 };
  }

  try {
    const flags = `${options.replaceAll !== false ? "g" : ""}${options.caseSensitive ? "" : "i"}`;
    const escaped = options.useRegex ? findStr : findStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, flags);

    const matches = text.match(new RegExp(escaped, `g${options.caseSensitive ? "" : "i"}`));
    const matchCount = matches ? matches.length : 0;
    const output = text.replace(regex, replaceStr);

    return {
      ok: true,
      output,
      matchCount: options.replaceAll === false ? Math.min(1, matchCount) : matchCount,
    };
  } catch (err) {
    return {
      ok: false,
      output: text,
      matchCount: 0,
      error: err instanceof Error ? err.message : "Invalid regular expression.",
    };
  }
}

export type TextSortMode =
  "az" | "za" | "numeric-asc" | "numeric-desc" | "length-asc" | "length-desc" | "reverse";

export function sortTextLines(
  text: string,
  mode: TextSortMode,
  options: { removeEmpty?: boolean; trimLines?: boolean } = {},
): { output: string; lineCount: number } {
  if (!text) return { output: "", lineCount: 0 };
  let lines = text.split(/\r?\n/);
  if (options.trimLines) {
    lines = lines.map((l) => l.trim());
  }
  if (options.removeEmpty) {
    lines = lines.filter((l) => l.trim().length > 0);
  }

  const sorted = [...lines];
  switch (mode) {
    case "az":
      sorted.sort((a, b) => a.localeCompare(b));
      break;
    case "za":
      sorted.sort((a, b) => b.localeCompare(a));
      break;
    case "numeric-asc":
      sorted.sort(
        (a, b) => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0) || a.localeCompare(b),
      );
      break;
    case "numeric-desc":
      sorted.sort(
        (a, b) => (Number.parseFloat(b) || 0) - (Number.parseFloat(a) || 0) || b.localeCompare(a),
      );
      break;
    case "length-asc":
      sorted.sort((a, b) => a.length - b.length || a.localeCompare(b));
      break;
    case "length-desc":
      sorted.sort((a, b) => b.length - a.length || a.localeCompare(b));
      break;
    case "reverse":
      sorted.reverse();
      break;
  }

  return {
    output: sorted.join("\n"),
    lineCount: sorted.length,
  };
}

export function removeDuplicateLines(
  text: string,
  options: {
    caseInsensitive?: boolean;
    trimLines?: boolean;
    removeEmpty?: boolean;
  } = {},
): {
  output: string;
  originalCount: number;
  uniqueCount: number;
  removedCount: number;
} {
  if (!text) {
    return { output: "", originalCount: 0, uniqueCount: 0, removedCount: 0 };
  }
  const rawLines = text.split(/\r?\n/);
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const raw of rawLines) {
    const processed = options.trimLines ? raw.trim() : raw;
    if (options.removeEmpty && processed.trim() === "") {
      continue;
    }
    const key = options.caseInsensitive ? processed.toLowerCase() : processed;
    if (!seen.has(key)) {
      seen.add(key);
      kept.push(processed);
    }
  }

  return {
    output: kept.join("\n"),
    originalCount: rawLines.length,
    uniqueCount: kept.length,
    removedCount: rawLines.length - kept.length,
  };
}

const LOREM_SENTENCES = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Curabitur pretium tincidunt lacus, nulla gravida orci a odio, et nullam varius turpis et commodo pharetra.",
  "Est eros bibendum elit, nec luctus magna felis sollicitudin mauris, integer in mauris eu nibh euismod gravida.",
  "Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.",
  "Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.",
];

export function generateLoremIpsum(
  count: number,
  unit: "paragraphs" | "sentences" | "words",
  options: { startWithClassic?: boolean; wrapHtmlP?: boolean } = {},
): string {
  const safeCount = Math.min(100, Math.max(1, Math.floor(count || 1)));
  const startClassic = options.startWithClassic !== false;

  if (unit === "words") {
    const allWords = LOREM_SENTENCES.join(" ").replace(/[.,]/g, "").toLowerCase().split(/\s+/);
    const picked: string[] = [];
    for (let i = 0; i < safeCount; i++) {
      const idx = startClassic ? i % allWords.length : (i + 7) % allWords.length;
      picked.push(allWords[idx] ?? "lorem");
    }
    if (picked[0]) {
      picked[0] = picked[0].charAt(0).toUpperCase() + picked[0].slice(1);
    }
    const text = `${picked.join(" ")}.`;
    return options.wrapHtmlP ? `<p>${text}</p>` : text;
  }

  if (unit === "sentences") {
    const picked: string[] = [];
    for (let i = 0; i < safeCount; i++) {
      const idx = startClassic ? i % LOREM_SENTENCES.length : (i + 1) % LOREM_SENTENCES.length;
      picked.push(LOREM_SENTENCES[idx]!);
    }
    const text = picked.join(" ");
    return options.wrapHtmlP ? `<p>${text}</p>` : text;
  }

  // paragraphs
  const paragraphs: string[] = [];
  for (let p = 0; p < safeCount; p++) {
    const s1 = LOREM_SENTENCES[(p * 3) % LOREM_SENTENCES.length]!;
    const s2 = LOREM_SENTENCES[(p * 3 + 1) % LOREM_SENTENCES.length]!;
    const s3 = LOREM_SENTENCES[(p * 3 + 2) % LOREM_SENTENCES.length]!;
    const para =
      p === 0 && startClassic
        ? `${LOREM_SENTENCES[0]} ${LOREM_SENTENCES[1]} ${LOREM_SENTENCES[2]}`
        : `${s1} ${s2} ${s3}`;
    paragraphs.push(options.wrapHtmlP ? `<p>${para}</p>` : para);
  }
  return paragraphs.join("\n\n");
}

// ============================================================================
// Group 1B: Student & Academic Calculators Pure Logic
// ============================================================================

export interface SemesterEntry {
  id: string;
  name: string;
  gpa: number;
  credits: number;
}

export function calculateCgpa(
  semesters: SemesterEntry[],
  scaleMax: 4 | 5 | 10 = 4,
): {
  ok: boolean;
  cgpa: number;
  totalCredits: number;
  totalQualityPoints: number;
  percentageEquivalent: number;
  error?: string;
} {
  if (!semesters || semesters.length === 0) {
    return {
      ok: false,
      cgpa: 0,
      totalCredits: 0,
      totalQualityPoints: 0,
      percentageEquivalent: 0,
      error: "Add at least one semester to compute CGPA.",
    };
  }

  let totalCredits = 0;
  let totalQualityPoints = 0;

  for (let i = 0; i < semesters.length; i++) {
    const s = semesters[i]!;
    if (!Number.isFinite(s.gpa) || s.gpa < 0 || s.gpa > scaleMax) {
      return {
        ok: false,
        cgpa: 0,
        totalCredits: 0,
        totalQualityPoints: 0,
        percentageEquivalent: 0,
        error: `Semester "${s.name || i + 1}" GPA must be between 0 and ${scaleMax.toFixed(1)}.`,
      };
    }
    if (!Number.isFinite(s.credits) || s.credits <= 0) {
      return {
        ok: false,
        cgpa: 0,
        totalCredits: 0,
        totalQualityPoints: 0,
        percentageEquivalent: 0,
        error: `Semester "${s.name || i + 1}" credits must be greater than 0.`,
      };
    }
    totalCredits += s.credits;
    totalQualityPoints += s.gpa * s.credits;
  }

  const cgpa = Math.round((totalQualityPoints / totalCredits) * 100) / 100;
  const percentageEquivalent = Math.round((cgpa / scaleMax) * 100 * 10) / 10;

  return {
    ok: true,
    cgpa,
    totalCredits: Math.round(totalCredits * 10) / 10,
    totalQualityPoints: Math.round(totalQualityPoints * 100) / 100,
    percentageEquivalent,
  };
}

export interface CourseGpaEntry {
  id: string;
  courseName: string;
  gradePoints: number;
  credits: number;
}

export function calculateSemesterGpa(
  courses: CourseGpaEntry[],
  scaleMax = 4,
): {
  ok: boolean;
  gpa: number;
  totalCredits: number;
  totalPoints: number;
  error?: string;
} {
  if (!courses || courses.length === 0) {
    return {
      ok: false,
      gpa: 0,
      totalCredits: 0,
      totalPoints: 0,
      error: "Add at least one course.",
    };
  }

  let totalCredits = 0;
  let totalPoints = 0;

  for (let i = 0; i < courses.length; i++) {
    const c = courses[i]!;
    if (!Number.isFinite(c.gradePoints) || c.gradePoints < 0 || c.gradePoints > scaleMax) {
      return {
        ok: false,
        gpa: 0,
        totalCredits: 0,
        totalPoints: 0,
        error: `Course #${i + 1} grade points must be between 0 and ${scaleMax}.`,
      };
    }
    if (!Number.isFinite(c.credits) || c.credits <= 0) {
      return {
        ok: false,
        gpa: 0,
        totalCredits: 0,
        totalPoints: 0,
        error: `Course #${i + 1} credit hours must be greater than 0.`,
      };
    }
    totalCredits += c.credits;
    totalPoints += c.gradePoints * c.credits;
  }

  const gpa = Math.round((totalPoints / totalCredits) * 100) / 100;
  return {
    ok: true,
    gpa,
    totalCredits: Math.round(totalCredits * 10) / 10,
    totalPoints: Math.round(totalPoints * 100) / 100,
  };
}

export interface GradeAssessmentItem {
  id: string;
  name: string;
  scorePercent: number;
  weightPercent: number;
}

export function calculateWeightedGrade(
  items: GradeAssessmentItem[],
  targetOverallPercent = 90,
): {
  ok: boolean;
  currentWeightedAverage: number;
  completedWeightPercent: number;
  remainingWeightPercent: number;
  requiredOnRemainingPercent: number | null;
  letterEstimate: string;
  error?: string;
} {
  if (!items || items.length === 0) {
    return {
      ok: false,
      currentWeightedAverage: 0,
      completedWeightPercent: 0,
      remainingWeightPercent: 100,
      requiredOnRemainingPercent: null,
      letterEstimate: "-",
      error: "Add at least one graded assessment.",
    };
  }

  let weightedSum = 0;
  let completedWeightPercent = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!Number.isFinite(item.scorePercent) || item.scorePercent < 0 || item.scorePercent > 150) {
      return {
        ok: false,
        currentWeightedAverage: 0,
        completedWeightPercent: 0,
        remainingWeightPercent: 0,
        requiredOnRemainingPercent: null,
        letterEstimate: "-",
        error: `Assessment #${i + 1} score must be between 0% and 150%.`,
      };
    }
    if (!Number.isFinite(item.weightPercent) || item.weightPercent <= 0) {
      return {
        ok: false,
        currentWeightedAverage: 0,
        completedWeightPercent: 0,
        remainingWeightPercent: 0,
        requiredOnRemainingPercent: null,
        letterEstimate: "-",
        error: `Assessment #${i + 1} weight must be greater than 0%.`,
      };
    }
    weightedSum += (item.scorePercent * item.weightPercent) / 100;
    completedWeightPercent += item.weightPercent;
  }

  if (completedWeightPercent > 100) {
    return {
      ok: false,
      currentWeightedAverage: 0,
      completedWeightPercent,
      remainingWeightPercent: 0,
      requiredOnRemainingPercent: null,
      letterEstimate: "-",
      error: `Total assessment weights (${completedWeightPercent}%) cannot exceed 100%.`,
    };
  }

  const currentWeightedAverage =
    Math.round((weightedSum / completedWeightPercent) * 100 * 100) / 100;
  const remainingWeightPercent = Math.round((100 - completedWeightPercent) * 100) / 100;

  const requiredOnRemainingPercent =
    remainingWeightPercent > 0
      ? Math.round(((targetOverallPercent - weightedSum) / remainingWeightPercent) * 100 * 100) /
        100
      : null;

  const letterEstimate =
    currentWeightedAverage >= 93
      ? "A"
      : currentWeightedAverage >= 90
        ? "A-"
        : currentWeightedAverage >= 87
          ? "B+"
          : currentWeightedAverage >= 83
            ? "B"
            : currentWeightedAverage >= 80
              ? "B-"
              : currentWeightedAverage >= 70
                ? "C"
                : currentWeightedAverage >= 60
                  ? "D"
                  : "F";

  return {
    ok: true,
    currentWeightedAverage,
    completedWeightPercent: Math.round(completedWeightPercent * 100) / 100,
    remainingWeightPercent,
    requiredOnRemainingPercent,
    letterEstimate,
  };
}

// ============================================================================
// Group 1C: Business & Finance Calculators Pure Logic
// ============================================================================

export function calculateProfitMargin(input: {
  cost: number;
  revenue: number;
  targetMarginPercent?: number;
}): {
  ok: boolean;
  grossProfit: number;
  profitMarginPercent: number;
  markupPercent: number;
  priceForTargetMargin: number | null;
  error?: string;
} {
  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return {
      ok: false,
      grossProfit: 0,
      profitMarginPercent: 0,
      markupPercent: 0,
      priceForTargetMargin: null,
      error: "Cost must be a non-negative number.",
    };
  }
  if (!Number.isFinite(input.revenue) || input.revenue <= 0) {
    return {
      ok: false,
      grossProfit: 0,
      profitMarginPercent: 0,
      markupPercent: 0,
      priceForTargetMargin: null,
      error: "Selling price / revenue must be greater than 0.",
    };
  }

  const grossProfit = Math.round((input.revenue - input.cost) * 100) / 100;
  const profitMarginPercent = Math.round((grossProfit / input.revenue) * 100 * 100) / 100;
  const markupPercent =
    input.cost > 0 ? Math.round((grossProfit / input.cost) * 100 * 100) / 100 : 100;

  let priceForTargetMargin: number | null = null;
  if (
    input.targetMarginPercent !== undefined &&
    input.targetMarginPercent >= 0 &&
    input.targetMarginPercent < 100
  ) {
    priceForTargetMargin =
      Math.round((input.cost / (1 - input.targetMarginPercent / 100)) * 100) / 100;
  }

  return {
    ok: true,
    grossProfit,
    profitMarginPercent,
    markupPercent,
    priceForTargetMargin,
  };
}

export interface AmortizationRow {
  month: number;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
}

export function calculateLoanEmi(input: {
  principal: number;
  annualRatePercent: number;
  tenureMonths: number;
}): {
  ok: boolean;
  monthlyEmi: number;
  totalPayment: number;
  totalInterest: number;
  interestSharePercent: number;
  schedule: AmortizationRow[];
  error?: string;
} {
  if (!Number.isFinite(input.principal) || input.principal <= 0) {
    return {
      ok: false,
      monthlyEmi: 0,
      totalPayment: 0,
      totalInterest: 0,
      interestSharePercent: 0,
      schedule: [],
      error: "Loan principal must be greater than 0.",
    };
  }
  if (
    !Number.isFinite(input.annualRatePercent) ||
    input.annualRatePercent < 0 ||
    input.annualRatePercent > 100
  ) {
    return {
      ok: false,
      monthlyEmi: 0,
      totalPayment: 0,
      totalInterest: 0,
      interestSharePercent: 0,
      schedule: [],
      error: "Annual interest rate must be between 0% and 100%.",
    };
  }
  const n = Math.floor(input.tenureMonths);
  if (!Number.isFinite(n) || n < 1 || n > 600) {
    return {
      ok: false,
      monthlyEmi: 0,
      totalPayment: 0,
      totalInterest: 0,
      interestSharePercent: 0,
      schedule: [],
      error: "Loan tenure must be between 1 and 600 months.",
    };
  }

  const r = input.annualRatePercent / 12 / 100;
  const rawEmi =
    r === 0
      ? input.principal / n
      : (input.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const monthlyEmi = Math.round(rawEmi * 100) / 100;
  let balance = input.principal;
  let totalInterestAcc = 0;
  const schedule: AmortizationRow[] = [];

  for (let m = 1; m <= n; m++) {
    const interestForMonth = balance * r;
    let principalForMonth = rawEmi - interestForMonth;
    if (m === n || principalForMonth > balance) {
      principalForMonth = balance;
    }
    balance = Math.max(0, balance - principalForMonth);
    totalInterestAcc += interestForMonth;

    schedule.push({
      month: m,
      payment: Math.round((principalForMonth + interestForMonth) * 100) / 100,
      principalPaid: Math.round(principalForMonth * 100) / 100,
      interestPaid: Math.round(interestForMonth * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    });
  }

  const totalInterest = Math.round(totalInterestAcc * 100) / 100;
  const totalPayment = Math.round((input.principal + totalInterest) * 100) / 100;
  const interestSharePercent =
    totalPayment > 0 ? Math.round((totalInterest / totalPayment) * 100 * 10) / 10 : 0;

  return {
    ok: true,
    monthlyEmi,
    totalPayment,
    totalInterest,
    interestSharePercent,
    schedule,
  };
}

export type SalaryPayPeriod = "annual" | "monthly" | "biweekly" | "weekly" | "daily" | "hourly";

export function calculateSalaryBreakdown(input: {
  amount: number;
  period: SalaryPayPeriod;
  hoursPerWeek: number;
  daysPerWeek: number;
  weeksPerYear: number;
  taxRatePercent: number;
  retirementPercent: number;
}): {
  ok: boolean;
  annualGross: number;
  annualTax: number;
  annualRetirement: number;
  annualNet: number;
  periods: Record<SalaryPayPeriod, { gross: number; net: number }>;
  error?: string;
} {
  const emptyPeriods: Record<SalaryPayPeriod, { gross: number; net: number }> = {
    annual: { gross: 0, net: 0 },
    monthly: { gross: 0, net: 0 },
    biweekly: { gross: 0, net: 0 },
    weekly: { gross: 0, net: 0 },
    daily: { gross: 0, net: 0 },
    hourly: { gross: 0, net: 0 },
  };

  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return {
      ok: false,
      annualGross: 0,
      annualTax: 0,
      annualRetirement: 0,
      annualNet: 0,
      periods: emptyPeriods,
      error: "Salary amount must be non-negative.",
    };
  }
  if (input.hoursPerWeek <= 0 || input.daysPerWeek <= 0 || input.weeksPerYear <= 0) {
    return {
      ok: false,
      annualGross: 0,
      annualTax: 0,
      annualRetirement: 0,
      annualNet: 0,
      periods: emptyPeriods,
      error: "Hours/week, days/week, and weeks/year must be greater than 0.",
    };
  }
  if (input.taxRatePercent < 0 || input.taxRatePercent + input.retirementPercent > 100) {
    return {
      ok: false,
      annualGross: 0,
      annualTax: 0,
      annualRetirement: 0,
      annualNet: 0,
      periods: emptyPeriods,
      error: "Combined tax and deduction rates must be between 0% and 100%.",
    };
  }

  let annualGross = 0;
  switch (input.period) {
    case "annual":
      annualGross = input.amount;
      break;
    case "monthly":
      annualGross = input.amount * 12;
      break;
    case "biweekly":
      annualGross = input.amount * (input.weeksPerYear / 2);
      break;
    case "weekly":
      annualGross = input.amount * input.weeksPerYear;
      break;
    case "daily":
      annualGross = input.amount * input.daysPerWeek * input.weeksPerYear;
      break;
    case "hourly":
      annualGross = input.amount * input.hoursPerWeek * input.weeksPerYear;
      break;
  }

  const annualTax = annualGross * (input.taxRatePercent / 100);
  const annualRetirement = annualGross * (input.retirementPercent / 100);
  const annualNet = Math.max(0, annualGross - annualTax - annualRetirement);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const totalDays = input.daysPerWeek * input.weeksPerYear;
  const totalHours = input.hoursPerWeek * input.weeksPerYear;

  return {
    ok: true,
    annualGross: r2(annualGross),
    annualTax: r2(annualTax),
    annualRetirement: r2(annualRetirement),
    annualNet: r2(annualNet),
    periods: {
      annual: { gross: r2(annualGross), net: r2(annualNet) },
      monthly: { gross: r2(annualGross / 12), net: r2(annualNet / 12) },
      biweekly: {
        gross: r2(annualGross / (input.weeksPerYear / 2)),
        net: r2(annualNet / (input.weeksPerYear / 2)),
      },
      weekly: {
        gross: r2(annualGross / input.weeksPerYear),
        net: r2(annualNet / input.weeksPerYear),
      },
      daily: {
        gross: r2(annualGross / totalDays),
        net: r2(annualNet / totalDays),
      },
      hourly: {
        gross: r2(annualGross / totalHours),
        net: r2(annualNet / totalHours),
      },
    },
  };
}

// ============================================================================
// Group 1D: Developer, Security & SEO Quick Wins Pure Logic
// ============================================================================

export interface RegexMatchEntry {
  index: number;
  fullMatch: string;
  groups: string[];
}

export function testRegularExpression(
  pattern: string,
  flags: string,
  testString: string,
): {
  ok: boolean;
  matches: RegexMatchEntry[];
  error?: string;
} {
  if (!pattern) {
    return { ok: true, matches: [] };
  }
  try {
    const cleanFlags = Array.from(new Set(flags.split("")))
      .filter((f) => "gimsuy".includes(f))
      .join("");
    const rx = new RegExp(pattern, cleanFlags.includes("g") ? cleanFlags : `${cleanFlags}g`);

    const matches: RegexMatchEntry[] = [];
    let m: RegExpExecArray | null = null;
    let safety = 0;

    while ((m = rx.exec(testString)) !== null && safety < 500) {
      safety++;
      matches.push({
        index: m.index,
        fullMatch: m[0],
        groups: m.slice(1).map((g) => g ?? ""),
      });
      if (m[0].length === 0) {
        rx.lastIndex++;
      }
    }

    return {
      ok: true,
      matches: cleanFlags.includes("g") ? matches : matches.slice(0, 1),
    };
  } catch (err) {
    return {
      ok: false,
      matches: [],
      error: err instanceof Error ? err.message : "Invalid regular expression.",
    };
  }
}

function decodeBase64UrlPart(part: string): string {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function decodeJwtToken(
  rawToken: string,
  nowMs = Date.now(),
): {
  ok: boolean;
  headerJson: string;
  payloadJson: string;
  signaturePart: string;
  claims: {
    alg?: string;
    typ?: string;
    iss?: string;
    sub?: string;
    expIso?: string;
    iatIso?: string;
    isExpired?: boolean;
  };
  error?: string;
} {
  const trimmed = rawToken.trim().replace(/^Bearer\s+/i, "");
  if (!trimmed) {
    return {
      ok: false,
      headerJson: "",
      payloadJson: "",
      signaturePart: "",
      claims: {},
      error: "Paste a JWT token (header.payload.signature) to decode.",
    };
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    return {
      ok: false,
      headerJson: "",
      payloadJson: "",
      signaturePart: "",
      claims: {},
      error: "Invalid JWT format: expected 3 dot-separated segments (header.payload.signature).",
    };
  }

  try {
    const headerObj = JSON.parse(decodeBase64UrlPart(parts[0])) as Record<string, unknown>;
    const payloadObj = JSON.parse(decodeBase64UrlPart(parts[1])) as Record<string, unknown>;

    const expNum = typeof payloadObj.exp === "number" ? payloadObj.exp : undefined;
    const iatNum = typeof payloadObj.iat === "number" ? payloadObj.iat : undefined;

    return {
      ok: true,
      headerJson: JSON.stringify(headerObj, null, 2),
      payloadJson: JSON.stringify(payloadObj, null, 2),
      signaturePart: parts[2] ?? "",
      claims: {
        ...(typeof headerObj.alg === "string" ? { alg: headerObj.alg } : {}),
        ...(typeof headerObj.typ === "string" ? { typ: headerObj.typ } : {}),
        ...(typeof payloadObj.iss === "string" ? { iss: payloadObj.iss } : {}),
        ...(typeof payloadObj.sub === "string" ? { sub: payloadObj.sub } : {}),
        ...(expNum !== undefined
          ? {
              expIso: new Date(expNum * 1000).toISOString(),
              isExpired: expNum * 1000 < nowMs,
            }
          : {}),
        ...(iatNum !== undefined ? { iatIso: new Date(iatNum * 1000).toISOString() } : {}),
      },
    };
  } catch (err) {
    return {
      ok: false,
      headerJson: "",
      payloadJson: "",
      signaturePart: "",
      claims: {},
      error:
        err instanceof Error
          ? `Could not decode JWT JSON: ${err.message}`
          : "Malformed Base64URL or JSON in JWT.",
    };
  }
}

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    const stepParts = part.split("/");
    const rangePart = stepParts[0] ?? "*";
    const step = stepParts[1] ? Number.parseInt(stepParts[1], 10) : 1;
    if (!Number.isFinite(step) || step <= 0) return false;

    let start = min;
    let end = max;
    if (rangePart !== "*") {
      if (rangePart.includes("-")) {
        const [a, b] = rangePart.split("-");
        start = Number.parseInt(a ?? "", 10);
        end = Number.parseInt(b ?? "", 10);
      } else {
        start = Number.parseInt(rangePart, 10);
        end = stepParts[1] ? max : start;
      }
    }
    if (value >= start && value <= end && (value - start) % step === 0) {
      return true;
    }
  }
  return false;
}

export function explainAndPreviewCron(
  expression: string,
  referenceUtcMs = 1793120400000,
): {
  ok: boolean;
  summary: string;
  nextRunsUtc: string[];
  error?: string;
} {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return {
      ok: false,
      summary: "",
      nextRunsUtc: [],
      error:
        "Standard cron expression must have 5 space-separated fields: minute hour day-of-month month day-of-week.",
    };
  }

  const [minF, hourF, domF, monF, dowF] = fields as [string, string, string, string, string];
  const validToken = /^[0-9*,/-]+$/;
  if (![minF, hourF, domF, monF, dowF].every((f) => validToken.test(f))) {
    return {
      ok: false,
      summary: "",
      nextRunsUtc: [],
      error: "Cron fields may only contain numbers, *, /, -, and commas.",
    };
  }

  const minDesc =
    minF === "*"
      ? "every minute"
      : minF.startsWith("*/")
        ? `every ${minF.slice(2)} minutes`
        : `at minute ${minF}`;
  const hourDesc =
    hourF === "*"
      ? "of every hour"
      : hourF.startsWith("*/")
        ? `every ${hourF.slice(2)} hours`
        : `past hour ${hourF} UTC`;
  const domDesc = domF === "*" ? "" : ` on day-of-month ${domF}`;
  const monDesc = monF === "*" ? "" : ` in month ${monF}`;
  const dowDesc = dowF === "*" ? "" : ` on day-of-week ${dowF}`;

  const summary = `Runs ${minDesc} ${hourDesc}${domDesc}${monDesc}${dowDesc}.`;

  // Compute next 5 matching UTC minutes (scanning up to 60 days ahead)
  const nextRunsUtc: string[] = [];
  const cursor = new Date(referenceUtcMs);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  const maxIterations = 60 * 24 * 60;
  for (let i = 0; i < maxIterations && nextRunsUtc.length < 5; i++) {
    const m = cursor.getUTCMinutes();
    const h = cursor.getUTCHours();
    const dom = cursor.getUTCDate();
    const mon = cursor.getUTCMonth() + 1;
    const dow = cursor.getUTCDay();

    if (
      matchesCronField(minF, m, 0, 59) &&
      matchesCronField(hourF, h, 0, 23) &&
      matchesCronField(domF, dom, 1, 31) &&
      matchesCronField(monF, mon, 1, 12) &&
      matchesCronField(dowF, dow, 0, 6)
    ) {
      nextRunsUtc.push(cursor.toISOString().replace(".000Z", " UTC"));
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return {
    ok: true,
    summary,
    nextRunsUtc,
  };
}

export function convertColorValue(input: string): {
  ok: boolean;
  hex: string;
  rgb: { r: number; g: number; b: number };
  rgbString: string;
  hsl: { h: number; s: number; l: number };
  hslString: string;
  contrastWithWhite: number;
  contrastWithBlack: number;
  error?: string;
} {
  const trimmed = input.trim();
  let r = 0;
  let g = 0;
  let b = 0;
  let parsed = false;

  const hexMatch = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch && hexMatch[1]) {
    const raw = hexMatch[1];
    const full =
      raw.length === 3
        ? raw
            .split("")
            .map((c) => c + c)
            .join("")
        : raw;
    r = Number.parseInt(full.slice(0, 2), 16);
    g = Number.parseInt(full.slice(2, 4), 16);
    b = Number.parseInt(full.slice(4, 6), 16);
    parsed = true;
  }

  if (!parsed) {
    const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
      r = Math.min(255, Number.parseInt(rgbMatch[1], 10));
      g = Math.min(255, Number.parseInt(rgbMatch[2], 10));
      b = Math.min(255, Number.parseInt(rgbMatch[3], 10));
      parsed = true;
    }
  }

  if (!parsed) {
    const hslMatch = trimmed.match(/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?/i);
    if (hslMatch && hslMatch[1] && hslMatch[2] && hslMatch[3]) {
      const h = (Number.parseInt(hslMatch[1], 10) % 360) / 360;
      const s = Math.min(100, Number.parseInt(hslMatch[2], 10)) / 100;
      const l = Math.min(100, Number.parseInt(hslMatch[3], 10)) / 100;

      if (s === 0) {
        r = g = b = Math.round(l * 255);
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          let tt = t;
          if (tt < 0) tt += 1;
          if (tt > 1) tt -= 1;
          if (tt < 1 / 6) return p + (q - p) * 6 * tt;
          if (tt < 1 / 2) return q;
          if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
      }
      parsed = true;
    }
  }

  if (!parsed) {
    return {
      ok: false,
      hex: "#000000",
      rgb: { r: 0, g: 0, b: 0 },
      rgbString: "rgb(0, 0, 0)",
      hsl: { h: 0, s: 0, l: 0 },
      hslString: "hsl(0, 0%, 0%)",
      contrastWithWhite: 21,
      contrastWithBlack: 1,
      error:
        "Enter a valid HEX (#D6F538), RGB (rgb(214, 245, 56)), or HSL (hsl(70, 90%, 59%)) color.",
    };
  }

  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  // Relative luminance (WCAG 2.1)
  const srgbToLin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
  const contrastWithWhite = Math.round((1.05 / (lum + 0.05)) * 100) / 100;
  const contrastWithBlack = Math.round(((lum + 0.05) / 0.05) * 100) / 100;

  return {
    ok: true,
    hex,
    rgb: { r, g, b },
    rgbString: `rgb(${r}, ${g}, ${b})`,
    hsl: { h: hDeg, s: sPct, l: lPct },
    hslString: `hsl(${hDeg}, ${sPct}%, ${lPct}%)`,
    contrastWithWhite,
    contrastWithBlack,
  };
}

export interface ChmodScope {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface ChmodMatrix {
  owner: ChmodScope;
  group: ChmodScope;
  others: ChmodScope;
}

export function calculateUnixPermissions(matrix: ChmodMatrix): {
  octal: string;
  symbolic: string;
  chmodCommand: string;
} {
  const scopeVal = (s: ChmodScope) => (s.read ? 4 : 0) + (s.write ? 2 : 0) + (s.execute ? 1 : 0);
  const scopeSym = (s: ChmodScope) =>
    `${s.read ? "r" : "-"}${s.write ? "w" : "-"}${s.execute ? "x" : "-"}`;

  const o = scopeVal(matrix.owner);
  const g = scopeVal(matrix.group);
  const p = scopeVal(matrix.others);

  const octal = `0${o}${g}${p}`;
  const symbolic = `-${scopeSym(matrix.owner)}${scopeSym(matrix.group)}${scopeSym(matrix.others)}`;
  return {
    octal,
    symbolic,
    chmodCommand: `chmod ${o}${g}${p} filename`,
  };
}

export interface HttpStatusEntry {
  code: number;
  phrase: string;
  category: "1xx" | "2xx" | "3xx" | "4xx" | "5xx";
  description: string;
  commonUse: string;
}

export const HTTP_STATUS_CODES: HttpStatusEntry[] = [
  {
    code: 100,
    phrase: "Continue",
    category: "1xx",
    description:
      "The server has received the request headers and the client should proceed to send the request body.",
    commonUse: "Large file upload pre-check (Expect: 100-continue).",
  },
  {
    code: 101,
    phrase: "Switching Protocols",
    category: "1xx",
    description: "The server is switching protocols as requested by the client.",
    commonUse: "Upgrading an HTTP connection to a WebSocket.",
  },
  {
    code: 200,
    phrase: "OK",
    category: "2xx",
    description: "The request succeeded.",
    commonUse: "Standard response for successful GET, PUT, or POST requests.",
  },
  {
    code: 201,
    phrase: "Created",
    category: "2xx",
    description: "The request succeeded and a new resource was created.",
    commonUse: "Returned after creating a new record via POST.",
  },
  {
    code: 202,
    phrase: "Accepted",
    category: "2xx",
    description:
      "The request has been accepted for processing, but processing is not yet complete.",
    commonUse: "Async background jobs or webhook queues.",
  },
  {
    code: 204,
    phrase: "No Content",
    category: "2xx",
    description: "The server successfully processed the request and is not returning any content.",
    commonUse: "DELETE or PUT endpoints that do not return a payload.",
  },
  {
    code: 301,
    phrase: "Moved Permanently",
    category: "3xx",
    description: "The URL of the requested resource has been changed permanently.",
    commonUse: "SEO-safe permanent URL redirects.",
  },
  {
    code: 302,
    phrase: "Found",
    category: "3xx",
    description: "The URI of requested resource has been changed temporarily.",
    commonUse: "Temporary redirect during login flows.",
  },
  {
    code: 304,
    phrase: "Not Modified",
    category: "3xx",
    description: "Indicates the client's cached copy is still up to date.",
    commonUse: "Browser caching with ETag or If-Modified-Since.",
  },
  {
    code: 307,
    phrase: "Temporary Redirect",
    category: "3xx",
    description:
      "Temporary redirect that preserves the original HTTP method (e.g. POST stays POST).",
    commonUse: "API maintenance redirects.",
  },
  {
    code: 308,
    phrase: "Permanent Redirect",
    category: "3xx",
    description: "Permanent redirect that preserves the original HTTP method.",
    commonUse: "Permanent API endpoint migration.",
  },
  {
    code: 400,
    phrase: "Bad Request",
    category: "4xx",
    description:
      "The server cannot process the request due to a client error (malformed syntax or invalid fields).",
    commonUse: "Schema validation failure on request payload.",
  },
  {
    code: 401,
    phrase: "Unauthorized",
    category: "4xx",
    description: "Authentication is required and has failed or has not yet been provided.",
    commonUse: "Missing or expired Bearer token / session cookie.",
  },
  {
    code: 403,
    phrase: "Forbidden",
    category: "4xx",
    description: "The client is authenticated but does not have permission to access the resource.",
    commonUse: "Role-based access control (RBAC) rejection.",
  },
  {
    code: 404,
    phrase: "Not Found",
    category: "4xx",
    description: "The server cannot find the requested resource.",
    commonUse: "Missing URL route or deleted database record.",
  },
  {
    code: 405,
    phrase: "Method Not Allowed",
    category: "4xx",
    description:
      "The request method is known by the server but is not supported by the target resource.",
    commonUse: "Sending POST to a GET-only endpoint.",
  },
  {
    code: 409,
    phrase: "Conflict",
    category: "4xx",
    description: "The request conflicts with the current state of the server.",
    commonUse: "Duplicate email registration or optimistic locking conflict.",
  },
  {
    code: 413,
    phrase: "Payload Too Large",
    category: "4xx",
    description: "Request entity is larger than limits defined by server.",
    commonUse: "Uploading a file exceeding the maximum size limit.",
  },
  {
    code: 422,
    phrase: "Unprocessable Content",
    category: "4xx",
    description: "The request was well-formed but could not be followed due to semantic errors.",
    commonUse: "REST/GraphQL field validation errors.",
  },
  {
    code: 429,
    phrase: "Too Many Requests",
    category: "4xx",
    description: "The user has sent too many requests in a given amount of time.",
    commonUse: "API rate-limiting and abuse protection.",
  },
  {
    code: 500,
    phrase: "Internal Server Error",
    category: "5xx",
    description:
      "The server encountered an unexpected condition that prevented it from fulfilling the request.",
    commonUse: "Unhandled exception in backend code.",
  },
  {
    code: 502,
    phrase: "Bad Gateway",
    category: "5xx",
    description:
      "The server, while acting as a gateway or proxy, received an invalid response from an upstream server.",
    commonUse: "Reverse proxy (Nginx/Cloudflare) cannot reach app server.",
  },
  {
    code: 503,
    phrase: "Service Unavailable",
    category: "5xx",
    description: "The server is not ready to handle the request.",
    commonUse: "Server overloaded or down for scheduled maintenance.",
  },
  {
    code: 504,
    phrase: "Gateway Timeout",
    category: "5xx",
    description: "The gateway or proxy did not receive a timely response from the upstream server.",
    commonUse: "Slow database query exceeding proxy timeout.",
  },
];

export function searchHttpStatusCodes(
  query: string,
  categoryFilter: "all" | HttpStatusEntry["category"] = "all",
): HttpStatusEntry[] {
  const q = query.trim().toLowerCase();
  return HTTP_STATUS_CODES.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      String(item.code).includes(q) ||
      item.phrase.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.commonUse.toLowerCase().includes(q)
    );
  });
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export function generateSecurePassword(options: PasswordGeneratorOptions): {
  ok: boolean;
  password: string;
  entropyBits: number;
  strengthLabel: "Weak" | "Fair" | "Strong" | "Very Strong";
  error?: string;
} {
  const len = Math.min(128, Math.max(4, Math.floor(options.length || 16)));
  let upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let lower = "abcdefghijklmnopqrstuvwxyz";
  let nums = "0123456789";
  const syms = "!@#$%^&*()-_=+[]{};:,.<>?";

  if (options.excludeAmbiguous) {
    upper = upper.replace(/[IO]/g, "");
    lower = lower.replace(/[lo]/g, "");
    nums = nums.replace(/[01]/g, "");
  }

  let pool = "";
  if (options.uppercase) pool += upper;
  if (options.lowercase) pool += lower;
  if (options.numbers) pool += nums;
  if (options.symbols) pool += syms;

  if (!pool) {
    return {
      ok: false,
      password: "",
      entropyBits: 0,
      strengthLabel: "Weak",
      error: "Select at least one character set (Uppercase, Lowercase, Numbers, or Symbols).",
    };
  }

  const randomValues = new Uint32Array(len);
  globalThis.crypto.getRandomValues(randomValues);

  let password = "";
  for (let i = 0; i < len; i++) {
    const idx = (randomValues[i] ?? 0) % pool.length;
    password += pool[idx] ?? "";
  }

  const entropyBits = Math.round(len * Math.log2(pool.length) * 10) / 10;
  const strengthLabel =
    entropyBits >= 95
      ? "Very Strong"
      : entropyBits >= 70
        ? "Strong"
        : entropyBits >= 45
          ? "Fair"
          : "Weak";

  return {
    ok: true,
    password,
    entropyBits,
    strengthLabel,
  };
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface MetaTagGeneratorInput {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: "website" | "article" | "product";
  ogImageUrl: string;
  siteName: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

export function generateMetaTagsHtml(input: MetaTagGeneratorInput): string {
  const title = escapeHtmlAttr(input.title.trim() || "Untitled Page");
  const desc = escapeHtmlAttr(input.description.trim());
  const url = escapeHtmlAttr(input.canonicalUrl.trim());
  const img = escapeHtmlAttr(input.ogImageUrl.trim());
  const site = escapeHtmlAttr(input.siteName.trim());
  const robots = `${input.robotsIndex ? "index" : "noindex"}, ${
    input.robotsFollow ? "follow" : "nofollow"
  }`;

  const lines: string[] = [
    "<!-- Primary Meta Tags -->",
    `<title>${title}</title>`,
    `<meta name="title" content="${title}" />`,
  ];
  if (desc) {
    lines.push(`<meta name="description" content="${desc}" />`);
  }
  lines.push(`<meta name="robots" content="${robots}" />`);
  if (url) {
    lines.push(`<link rel="canonical" href="${url}" />`);
  }

  lines.push("", "<!-- Open Graph / Facebook -->");
  lines.push(`<meta property="og:type" content="${input.ogType}" />`);
  lines.push(`<meta property="og:title" content="${title}" />`);
  if (desc) {
    lines.push(`<meta property="og:description" content="${desc}" />`);
  }
  if (url) {
    lines.push(`<meta property="og:url" content="${url}" />`);
  }
  if (site) {
    lines.push(`<meta property="og:site_name" content="${site}" />`);
  }
  if (img) {
    lines.push(`<meta property="og:image" content="${img}" />`);
  }

  lines.push("", "<!-- Twitter / X -->");
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${title}" />`);
  if (desc) {
    lines.push(`<meta name="twitter:description" content="${desc}" />`);
  }
  if (img) {
    lines.push(`<meta name="twitter:image" content="${img}" />`);
  }

  return lines.join("\n");
}

export function generateUrlSlug(
  input: string,
  options: {
    separator?: "-" | "_";
    lowercase?: boolean;
    removeStopWords?: boolean;
  } = {},
): string {
  const sep = options.separator ?? "-";
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .trim();

  if (!normalized) return "";

  let tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  if (options.removeStopWords) {
    const filtered = tokens.filter((t) => !STOP_WORDS.has(t.toLowerCase()));
    if (filtered.length > 0) {
      tokens = filtered;
    }
  }

  const joined = tokens.join(sep);
  return options.lowercase !== false ? joined.toLowerCase() : joined;
}

export interface UtmBuilderInput {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
}

export function buildUtmUrl(input: UtmBuilderInput): {
  ok: boolean;
  url: string;
  error?: string;
} {
  const rawUrl = input.baseUrl.trim();
  if (!rawUrl) {
    return {
      ok: false,
      url: "",
      error: "Please enter a valid website URL (e.g. https://example.com/pricing).",
    };
  }

  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(withProto);

    if (input.utmSource.trim()) {
      parsed.searchParams.set("utm_source", input.utmSource.trim());
    }
    if (input.utmMedium.trim()) {
      parsed.searchParams.set("utm_medium", input.utmMedium.trim());
    }
    if (input.utmCampaign.trim()) {
      parsed.searchParams.set("utm_campaign", input.utmCampaign.trim());
    }
    if (input.utmTerm?.trim()) {
      parsed.searchParams.set("utm_term", input.utmTerm.trim());
    }
    if (input.utmContent?.trim()) {
      parsed.searchParams.set("utm_content", input.utmContent.trim());
    }

    return { ok: true, url: parsed.toString() };
  } catch {
    return {
      ok: false,
      url: "",
      error: "Invalid base URL format. Include a valid domain name.",
    };
  }
}

export async function generateQrCodeAssets(
  text: string,
  options: {
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    darkColor?: string;
    lightColor?: string;
  } = {},
): Promise<{
  ok: boolean;
  svgString: string;
  pngDataUrl: string;
  error?: string;
}> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      svgString: "",
      pngDataUrl: "",
      error: "Enter a URL or text string to encode as a QR code.",
    };
  }

  try {
    const qrOpts = {
      width: options.width ?? 320,
      margin: 2,
      errorCorrectionLevel: options.errorCorrectionLevel ?? "M",
      color: {
        dark: options.darkColor ?? "#111111",
        light: options.lightColor ?? "#FFFFFF",
      },
    };
    const svgString = await QRCode.toString(trimmed, {
      ...qrOpts,
      type: "svg",
    });
    const pngDataUrl = await QRCode.toDataURL(trimmed, qrOpts);
    return { ok: true, svgString, pngDataUrl };
  } catch (err) {
    return {
      ok: false,
      svgString: "",
      pngDataUrl: "",
      error: err instanceof Error ? err.message : "Failed to generate QR code.",
    };
  }
}
