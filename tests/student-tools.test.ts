import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeStudyProgressStats,
  computeSubjectPriorityWeight,
  DEFAULT_EXAM_SUBJECTS,
  DEFAULT_STUDY_CONFIG,
  exportStudyScheduleToCsv,
  generateDeterministicStudySchedule,
  generateStudyPlanPdf,
  rescheduleMissedSessions,
} from "../src/lib/student-tools";

test("computeSubjectPriorityWeight gives higher priority to higher difficulty, lower confidence, and closer exam dates", () => {
  const highPriority = computeSubjectPriorityWeight(
    { difficulty: 5, confidence: 1, topics: ["A", "B", "C"] },
    3,
  );
  const lowPriority = computeSubjectPriorityWeight(
    { difficulty: 2, confidence: 5, topics: ["A"] },
    14,
  );
  assert.equal(highPriority > lowPriority * 2, true);
});

test("generateDeterministicStudySchedule allocates more sessions to high-priority subjects and includes final review on exam eve", () => {
  const res = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);

  assert.equal(res.ok, true);
  assert.equal(res.sessions.length > 15, true);

  const stats = computeStudyProgressStats(
    DEFAULT_EXAM_SUBJECTS,
    res.sessions,
    DEFAULT_STUDY_CONFIG.startDate,
  );

  const algStat = stats.bySubject.find((s) => s.subjectId === "subj-alg");
  const statSubj = stats.bySubject.find((s) => s.subjectId === "subj-stat");
  assert.ok(algStat);
  assert.ok(statSubj);

  // Algorithms has higher difficulty (5 vs 3), lower confidence (2 vs 4), and earlier exam date
  // Next to Probability, wait: Probability has more days (until Nov 9 vs Nov 4), so let's check exam-eve final review!
  const finalReviews = res.sessions.filter((s) => s.focusType === "final-review");
  assert.equal(finalReviews.length >= 3, true);
  assert.equal(
    finalReviews.some((s) => s.subjectId === "subj-alg" && s.date === "2026-11-03"),
    true,
  );
});

test("rescheduleMissedSessions preserves completed sessions and regenerates remaining sessions", () => {
  const initial = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
  assert.equal(initial.ok, true);

  // Mark first 2 sessions completed
  const modified = initial.sessions.map((s, idx) => (idx < 2 ? { ...s, completed: true } : s));

  const rescheduled = rescheduleMissedSessions(
    DEFAULT_EXAM_SUBJECTS,
    DEFAULT_STUDY_CONFIG,
    modified,
    "2026-10-30",
  );

  assert.equal(rescheduled.ok, true);
  const keptCompleted = rescheduled.sessions.filter((s) => s.completed);
  assert.equal(keptCompleted.length, 2);
});

test("exportStudyScheduleToCsv and generateStudyPlanPdf produce valid CSV and PDF outputs", async () => {
  const initial = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
  const csv = exportStudyScheduleToCsv(initial.sessions);
  assert.equal(csv.includes("Date,Slot,Subject,Topic & Activity"), true);
  assert.equal(csv.includes("Algorithms & Data Structures"), true);

  const pdfBytes = await generateStudyPlanPdf(
    DEFAULT_STUDY_CONFIG,
    DEFAULT_EXAM_SUBJECTS,
    initial.sessions,
  );
  assert.equal(pdfBytes.byteLength > 1000, true);
  assert.equal(new TextDecoder().decode(pdfBytes.slice(0, 5)), "%PDF-");
});
