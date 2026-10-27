import { describe, expect, it } from "vitest";
import {
  computeStudyProgressStats,
  computeSubjectPriorityWeight,
  DEFAULT_EXAM_SUBJECTS,
  DEFAULT_STUDY_CONFIG,
  exportStudyScheduleToCsv,
  generateDeterministicStudySchedule,
  generateStudyPlanPdf,
  rescheduleMissedSessions,
} from "@/lib/student-tools";

describe("Student Tools Pure Logic (ExamSprint Planner)", () => {
  it("computes higher priority weights for difficult, low-confidence, soon-exam subjects", () => {
    const high = computeSubjectPriorityWeight(
      { difficulty: 5, confidence: 1, topics: ["DP", "Graphs"] },
      2,
    );
    const low = computeSubjectPriorityWeight(
      { difficulty: 1, confidence: 5, topics: ["Intro"] },
      15,
    );
    expect(high).toBeGreaterThan(low * 2);
  });

  it("generates a deterministic schedule with exam-eve final review sessions", () => {
    const res = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
    expect(res.ok).toBe(true);
    expect(res.sessions.length).toBeGreaterThan(15);

    const hasAlgFinalReview = res.sessions.some(
      (s) =>
        s.subjectId === "subj-alg" && s.date === "2026-11-03" && s.focusType === "final-review",
    );
    expect(hasAlgFinalReview).toBe(true);
  });

  it("reschedules missed sessions while preserving completed sessions", () => {
    const initial = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
    const withCompleted = initial.sessions.map((s, idx) =>
      idx < 3 ? { ...s, completed: true } : s,
    );

    const rescheduled = rescheduleMissedSessions(
      DEFAULT_EXAM_SUBJECTS,
      DEFAULT_STUDY_CONFIG,
      withCompleted,
      "2026-10-30",
    );
    expect(rescheduled.ok).toBe(true);
    const stats = computeStudyProgressStats(
      DEFAULT_EXAM_SUBJECTS,
      rescheduled.sessions,
      DEFAULT_STUDY_CONFIG.startDate,
    );
    expect(stats.completedSessions).toBe(3);
  });

  it("exports study schedule to CSV and PDF binary", async () => {
    const initial = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
    const csv = exportStudyScheduleToCsv(initial.sessions);
    expect(csv).toContain("Algorithms & Data Structures");

    const pdfBytes = await generateStudyPlanPdf(
      DEFAULT_STUDY_CONFIG,
      DEFAULT_EXAM_SUBJECTS,
      initial.sessions,
    );
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(pdfBytes.slice(0, 5))).toBe("%PDF-");
  });
});
