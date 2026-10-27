import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type RatingLevel = 1 | 2 | 3 | 4 | 5;

export interface ExamSubject {
  id: string;
  name: string;
  topics: string[];
  examDate: string; // YYYY-MM-DD
  difficulty: RatingLevel; // 1 (Easy) .. 5 (Very Hard)
  confidence: RatingLevel; // 1 (Low) .. 5 (High)
  colorTag: "lime" | "blue" | "emerald" | "amber" | "rose";
}

export interface StudyPlannerConfig {
  planTitle: string;
  startDate: string; // YYYY-MM-DD
  weekdayHours: number; // 0.5 .. 14
  weekendHours: number; // 0.5 .. 14
  sessionDurationMinutes: 30 | 45 | 60 | 90;
}

export type SessionFocusType = "core-concept" | "active-recall" | "final-review";

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  slotIndex: number; // 1-based slot on that date
  subjectId: string;
  subjectName: string;
  colorTag: ExamSubject["colorTag"];
  topic: string;
  focusType: SessionFocusType;
  durationMinutes: number;
  completed: boolean;
}

export interface ScheduleGenerationResult {
  ok: boolean;
  sessions: StudySession[];
  warnings: string[];
  error?: string;
}

export interface SubjectProgressStat {
  subjectId: string;
  subjectName: string;
  examDate: string;
  colorTag: ExamSubject["colorTag"];
  totalSessions: number;
  completedSessions: number;
  totalMinutes: number;
  completedMinutes: number;
  completionPercent: number;
  priorityScore: number;
}

function parseIsoDateUtc(isoDate: string): Date | null {
  const m = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const day = Number.parseInt(m[3], 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

export function formatIsoDateUtc(date: Date): string {
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = parseIsoDateUtc(isoDate);
  if (!d) return isoDate;
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDateUtc(d);
}

export function diffDaysIso(fromIso: string, toIso: string): number {
  const a = parseIsoDateUtc(fromIso);
  const b = parseIsoDateUtc(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatHumanDate(isoDate: string): string {
  const d = parseIsoDateUtc(isoDate);
  if (!d) return isoDate;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isWeekendIso(isoDate: string): boolean {
  const d = parseIsoDateUtc(isoDate);
  if (!d) return false;
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Computes a deterministic priority weight for a subject on a given study day.
 * Higher difficulty (1..5), lower confidence (1..5 -> gap 5..1), and closer exam dates
 * produce higher weights.
 */
export function computeSubjectPriorityWeight(
  subject: Pick<ExamSubject, "difficulty" | "confidence" | "topics">,
  daysUntilExam: number,
): number {
  const difficultyPoints = Math.min(5, Math.max(1, subject.difficulty)) * 2.2;
  const confidenceGapPoints = (6 - Math.min(5, Math.max(1, subject.confidence))) * 2.5;
  const topicBreadthBonus = Math.min(6, Math.max(1, subject.topics.length)) * 0.4;

  // Urgency multiplier increases as exam approaches (1.0x far out -> up to 2.2x within 3 days)
  const clampedDays = Math.max(1, daysUntilExam);
  const urgencyMultiplier = 1 + Math.min(1.2, 6 / clampedDays);

  return (
    Math.round(
      (difficultyPoints + confidenceGapPoints + topicBreadthBonus) * urgencyMultiplier * 100,
    ) / 100
  );
}

/**
 * Generates a deterministic, balanced study timetable from startDate through the last examDate.
 * Optionally preserves already-completed sessions on or before `rescheduleFromDate`.
 */
export function generateDeterministicStudySchedule(
  subjects: ExamSubject[],
  config: StudyPlannerConfig,
  existingCompletedSessions: StudySession[] = [],
): ScheduleGenerationResult {
  const warnings: string[] = [];

  if (!subjects || subjects.length === 0) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error: "Please add at least one subject with an exam date.",
    };
  }

  const startD = parseIsoDateUtc(config.startDate);
  if (!startD) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error: "Please enter a valid start date (YYYY-MM-DD).",
    };
  }

  if (
    !Number.isFinite(config.weekdayHours) ||
    config.weekdayHours < 0 ||
    config.weekdayHours > 16 ||
    !Number.isFinite(config.weekendHours) ||
    config.weekendHours < 0 ||
    config.weekendHours > 16
  ) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error: "Daily study hours must be between 0 and 16 hours.",
    };
  }

  if (config.weekdayHours === 0 && config.weekendHours === 0) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error: "Available study hours cannot be 0 on both weekdays and weekends.",
    };
  }

  const validSubjects: ExamSubject[] = [];
  for (const subj of subjects) {
    const cleanName = subj.name.trim();
    if (!cleanName) {
      return {
        ok: false,
        sessions: [],
        warnings,
        error: "Every subject must have a name.",
      };
    }
    const examD = parseIsoDateUtc(subj.examDate);
    if (!examD) {
      return {
        ok: false,
        sessions: [],
        warnings,
        error: `Subject "${cleanName}" has an invalid exam date.`,
      };
    }
    const daysAvailable = diffDaysIso(config.startDate, subj.examDate);
    if (daysAvailable <= 0) {
      warnings.push(
        `Exam date for "${cleanName}" (${subj.examDate}) is on or before the study start date (${config.startDate}), so no pre-exam revision days remain.`,
      );
      continue;
    }
    validSubjects.push({
      ...subj,
      name: cleanName,
      topics:
        subj.topics.map((t) => t.trim()).filter(Boolean).length > 0
          ? subj.topics.map((t) => t.trim()).filter(Boolean)
          : ["Core Syllabus & Past Papers"],
    });
  }

  if (validSubjects.length === 0) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error:
        "All subject exam dates are on or before the start date. Please choose an earlier start date or later exam dates.",
    };
  }

  // Find latest exam date (cap horizon at 120 days to prevent runaway schedules)
  const latestExamIso = validSubjects.reduce(
    (maxIso, s) => (s.examDate > maxIso ? s.examDate : maxIso),
    validSubjects[0]!.examDate,
  );
  const totalSpanDays = Math.min(120, Math.max(1, diffDaysIso(config.startDate, latestExamIso)));

  // Track how many times each subject has been scheduled to ensure proportional distribution
  const allocatedCountBySubject = new Map<string, number>();
  const topicCursorBySubject = new Map<string, number>();
  for (const s of validSubjects) {
    allocatedCountBySubject.set(s.id, 0);
    topicCursorBySubject.set(s.id, 0);
  }

  // Index any preserved completed sessions by date
  const completedByDate = new Map<string, StudySession[]>();
  const priorCompletedSessions: StudySession[] = [];
  for (const comp of existingCompletedSessions) {
    if (!comp.completed) continue;
    allocatedCountBySubject.set(
      comp.subjectId,
      (allocatedCountBySubject.get(comp.subjectId) ?? 0) + 1,
    );
    topicCursorBySubject.set(comp.subjectId, (topicCursorBySubject.get(comp.subjectId) ?? 0) + 1);
    if (comp.date < config.startDate) {
      priorCompletedSessions.push({ ...comp });
    } else {
      const list = completedByDate.get(comp.date) ?? [];
      list.push(comp);
      completedByDate.set(comp.date, list);
    }
  }

  const allSessions: StudySession[] = [...priorCompletedSessions];
  const sessionMinutes = config.sessionDurationMinutes;

  for (let offset = 0; offset < totalSpanDays; offset++) {
    const currentDate = addDaysIso(config.startDate, offset);
    const preservedToday = completedByDate.get(currentDate) ?? [];

    for (const p of preservedToday) {
      allSessions.push({ ...p });
    }

    const availableHours = isWeekendIso(currentDate) ? config.weekendHours : config.weekdayHours;
    const maxSlotsToday = Math.floor((availableHours * 60) / sessionMinutes);
    const remainingSlotsToday = Math.max(0, maxSlotsToday - preservedToday.length);

    if (remainingSlotsToday === 0) continue;

    // Active subjects whose exam is strictly after currentDate
    const activeSubjects = validSubjects.filter((s) => diffDaysIso(currentDate, s.examDate) > 0);
    if (activeSubjects.length === 0) continue;

    let lastPickedSubjectId: string | null = null;

    for (let sIdx = 0; sIdx < remainingSlotsToday; sIdx++) {
      const slotNumber = preservedToday.length + sIdx + 1;

      // Check if any subject has its exam tomorrow and hasn't had a final review today yet
      const examTomorrowSubject = activeSubjects.find(
        (s) =>
          diffDaysIso(currentDate, s.examDate) === 1 &&
          !allSessions.some(
            (sess) =>
              sess.date === currentDate &&
              sess.subjectId === s.id &&
              sess.focusType === "final-review",
          ),
      );

      let chosen: ExamSubject;
      let focusType: SessionFocusType;

      if (examTomorrowSubject) {
        chosen = examTomorrowSubject;
        focusType = "final-review";
      } else {
        // Deterministic Deficit Round-Robin weighted by priority score
        let bestCandidate = activeSubjects[0]!;
        let bestEffectiveScore = -Infinity;

        for (const candidate of activeSubjects) {
          const daysLeft = diffDaysIso(currentDate, candidate.examDate);
          const baseWeight = computeSubjectPriorityWeight(candidate, daysLeft);
          const alreadyAllocated = allocatedCountBySubject.get(candidate.id) ?? 0;

          // Quota ratio ensures proportional allocation while rotating smoothly
          let effectiveScore = baseWeight / (alreadyAllocated + 1);

          // Avoid scheduling the exact same subject 2 slots in a row when alternatives exist
          if (activeSubjects.length > 1 && candidate.id === lastPickedSubjectId) {
            effectiveScore *= 0.65;
          }

          if (effectiveScore > bestEffectiveScore) {
            bestEffectiveScore = effectiveScore;
            bestCandidate = candidate;
          }
        }

        chosen = bestCandidate;
        const allocatedSoFar = allocatedCountBySubject.get(chosen.id) ?? 0;
        focusType = allocatedSoFar % 2 === 0 ? "core-concept" : "active-recall";
      }

      const cursor = topicCursorBySubject.get(chosen.id) ?? 0;
      const baseTopic = chosen.topics[cursor % chosen.topics.length] ?? "Core Syllabus";
      const topicLabel =
        focusType === "final-review"
          ? `Final Exam Eve Review: ${baseTopic}`
          : focusType === "active-recall"
            ? `${baseTopic} (Practice Problems & Recall)`
            : `${baseTopic} (Concept Mastery & Notes)`;

      allSessions.push({
        id: `sess-${currentDate}-${slotNumber}-${chosen.id}`,
        date: currentDate,
        slotIndex: slotNumber,
        subjectId: chosen.id,
        subjectName: chosen.name,
        colorTag: chosen.colorTag,
        topic: topicLabel,
        focusType,
        durationMinutes: sessionMinutes,
        completed: false,
      });

      allocatedCountBySubject.set(chosen.id, (allocatedCountBySubject.get(chosen.id) ?? 0) + 1);
      topicCursorBySubject.set(chosen.id, cursor + 1);
      lastPickedSubjectId = chosen.id;
    }
  }

  if (allSessions.length === 0) {
    return {
      ok: false,
      sessions: [],
      warnings,
      error:
        "No study sessions could be generated with the current hours and dates. Try increasing daily study hours.",
    };
  }

  return {
    ok: true,
    sessions: allSessions,
    warnings,
  };
}

/**
 * Reschedules all incomplete sessions on or after `fromDate` while keeping completed sessions intact.
 */
export function rescheduleMissedSessions(
  subjects: ExamSubject[],
  config: StudyPlannerConfig,
  currentSessions: StudySession[],
  fromDate: string,
): ScheduleGenerationResult {
  const completedToKeep = currentSessions.filter((s) => s.completed);
  const adjustedStart = fromDate > config.startDate ? fromDate : config.startDate;
  return generateDeterministicStudySchedule(
    subjects,
    { ...config, startDate: adjustedStart },
    completedToKeep,
  );
}

export function computeStudyProgressStats(
  subjects: ExamSubject[],
  sessions: StudySession[],
  referenceDate: string,
): {
  totalSessions: number;
  completedSessions: number;
  totalHours: number;
  completedHours: number;
  overallPercent: number;
  bySubject: SubjectProgressStat[];
} {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.completed).length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const completedMinutes = sessions
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const overallPercent =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const bySubject: SubjectProgressStat[] = subjects.map((subj) => {
    const subjSessions = sessions.filter((s) => s.subjectId === subj.id);
    const subjDone = subjSessions.filter((s) => s.completed);
    const subjTotalMins = subjSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const subjDoneMins = subjDone.reduce((sum, s) => sum + s.durationMinutes, 0);
    const daysLeft = Math.max(1, diffDaysIso(referenceDate, subj.examDate));

    return {
      subjectId: subj.id,
      subjectName: subj.name,
      examDate: subj.examDate,
      colorTag: subj.colorTag,
      totalSessions: subjSessions.length,
      completedSessions: subjDone.length,
      totalMinutes: subjTotalMins,
      completedMinutes: subjDoneMins,
      completionPercent:
        subjSessions.length > 0 ? Math.round((subjDone.length / subjSessions.length) * 100) : 0,
      priorityScore: computeSubjectPriorityWeight(subj, daysLeft),
    };
  });

  return {
    totalSessions,
    completedSessions,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    completedHours: Math.round((completedMinutes / 60) * 10) / 10,
    overallPercent,
    bySubject,
  };
}

export function exportStudyScheduleToCsv(sessions: StudySession[]): string {
  const escape = (val: string): string =>
    val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;

  const lines = ["Date,Slot,Subject,Topic & Activity,Focus Type,Duration (Mins),Status"];
  for (const s of sessions) {
    lines.push(
      [
        s.date,
        String(s.slotIndex),
        escape(s.subjectName),
        escape(s.topic),
        s.focusType,
        String(s.durationMinutes),
        s.completed ? "Completed" : "Pending",
      ].join(","),
    );
  }
  return lines.join("\n");
}

function toSafePdfAscii(str: string): string {
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export async function generateStudyPlanPdf(
  config: StudyPlannerConfig,
  subjects: ExamSubject[],
  sessions: StudySession[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 44;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 52,
    width: pageWidth - margin * 2,
    height: 52,
    color: rgb(0.84, 0.96, 0.22),
  });

  page.drawText(toSafePdfAscii(config.planTitle.trim() || "ExamSprint Study Timetable"), {
    x: margin + 16,
    y: y - 26,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.09, 0.08),
  });

  const stats = computeStudyProgressStats(subjects, sessions, config.startDate);
  page.drawText(
    `Start: ${config.startDate}  |  Total: ${stats.totalSessions} sessions (${stats.totalHours} hrs)  |  Completed: ${stats.overallPercent}%`,
    {
      x: margin + 16,
      y: y - 42,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.18, 0.2, 0.18),
    },
  );

  y -= 72;

  // Subjects Summary
  page.drawText("EXAM SUBJECTS & PRIORITY OVERVIEW", {
    x: margin,
    y,
    size: 9.5,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 14;

  for (const subj of subjects) {
    const stat = stats.bySubject.find((b) => b.subjectId === subj.id);
    const line = `• ${toSafePdfAscii(subj.name)} — Exam: ${subj.examDate} | Difficulty: ${subj.difficulty}/5 | Confidence: ${subj.confidence}/5 | Planned: ${stat?.totalSessions ?? 0} sessions`;
    page.drawText(line.slice(0, 98), {
      x: margin + 6,
      y,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= 13;
  }

  y -= 10;

  // Sessions Table Header
  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 20,
      width: pageWidth - margin * 2,
      height: 20,
      color: rgb(0.12, 0.13, 0.14),
    });
    page.drawText("DATE", {
      x: margin + 8,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("SUBJECT", {
      x: margin + 78,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("REVISION TOPIC & ACTIVITY", {
      x: margin + 195,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("MINS", {
      x: pageWidth - margin - 78,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("STATUS", {
      x: pageWidth - margin - 44,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 26;
  };

  drawTableHeader();

  sessions.forEach((sess, idx) => {
    if (y < 48) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawTableHeader();
    }

    if (idx % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - 12,
        width: pageWidth - margin * 2,
        height: 16,
        color: rgb(0.96, 0.96, 0.95),
      });
    }

    page.drawText(sess.date, {
      x: margin + 8,
      y: y - 7,
      size: 8,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(toSafePdfAscii(sess.subjectName).slice(0, 22), {
      x: margin + 78,
      y: y - 7,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(toSafePdfAscii(sess.topic).slice(0, 48), {
      x: margin + 195,
      y: y - 7,
      size: 8,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`${sess.durationMinutes}m`, {
      x: pageWidth - margin - 78,
      y: y - 7,
      size: 8,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    });

    page.drawText(sess.completed ? "[x] Done" : "[ ] Todo", {
      x: pageWidth - margin - 44,
      y: y - 7,
      size: 8,
      font: fontRegular,
      color: sess.completed ? rgb(0.06, 0.48, 0.35) : rgb(0.35, 0.35, 0.35),
    });

    y -= 16;
  });

  return pdfDoc.save();
}

export const DEFAULT_STUDY_CONFIG: StudyPlannerConfig = {
  planTitle: "Fall Finals Revision Sprint",
  startDate: "2026-10-28",
  weekdayHours: 3,
  weekendHours: 4.5,
  sessionDurationMinutes: 45,
};

export const DEFAULT_EXAM_SUBJECTS: ExamSubject[] = [
  {
    id: "subj-alg",
    name: "Algorithms & Data Structures",
    topics: [
      "Graph Traversal & Shortest Paths",
      "Dynamic Programming & Memoization",
      "Balanced Trees & Heaps",
      "Complexity & Recurrence Relations",
    ],
    examDate: "2026-11-04",
    difficulty: 5,
    confidence: 2,
    colorTag: "lime",
  },
  {
    id: "subj-db",
    name: "Database Systems",
    topics: [
      "SQL Joins & Window Functions",
      "B+ Trees & Indexing",
      "ACID Transactions & Isolation Levels",
      "Normalization (3NF / BCNF)",
    ],
    examDate: "2026-11-06",
    difficulty: 4,
    confidence: 3,
    colorTag: "blue",
  },
  {
    id: "subj-stat",
    name: "Probability & Statistics",
    topics: [
      "Bayes Theorem & Conditional Probability",
      "Continuous Distributions & CLT",
      "Hypothesis Testing & Confidence Intervals",
    ],
    examDate: "2026-11-09",
    difficulty: 3,
    confidence: 4,
    colorTag: "emerald",
  },
];
