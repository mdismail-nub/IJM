import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob, downloadText, sanitizeFilename } from "@/lib/file-utils";
import {
  addDaysIso,
  computeStudyProgressStats,
  DEFAULT_EXAM_SUBJECTS,
  DEFAULT_STUDY_CONFIG,
  exportStudyScheduleToCsv,
  formatHumanDate,
  generateDeterministicStudySchedule,
  generateStudyPlanPdf,
  rescheduleMissedSessions,
  type ExamSubject,
  type RatingLevel,
  type StudyPlannerConfig,
  type StudySession,
} from "@/lib/student-tools";

const STORAGE_KEY = "utilitydock_examsprint_plan_v1";

const COLOR_TAG_STYLES: Record<
  ExamSubject["colorTag"],
  { pill: string; border: string; dot: string; label: string }
> = {
  lime: {
    pill: "bg-primary/35 text-foreground",
    border: "border-l-4 border-l-primary",
    dot: "bg-primary",
    label: "Lime",
  },
  blue: {
    pill: "bg-blue-500/15 text-blue-900",
    border: "border-l-4 border-l-blue-600",
    dot: "bg-blue-600",
    label: "Blue",
  },
  emerald: {
    pill: "bg-emerald-500/15 text-emerald-900",
    border: "border-l-4 border-l-emerald-600",
    dot: "bg-emerald-600",
    label: "Emerald",
  },
  amber: {
    pill: "bg-amber-500/20 text-amber-950",
    border: "border-l-4 border-l-amber-500",
    dot: "bg-amber-500",
    label: "Amber",
  },
  rose: {
    pill: "bg-rose-500/15 text-rose-900",
    border: "border-l-4 border-l-rose-600",
    dot: "bg-rose-600",
    label: "Rose",
  },
};

const FOCUS_LABELS: Record<StudySession["focusType"], string> = {
  "core-concept": "Concept Mastery",
  "active-recall": "Active Recall & Practice",
  "final-review": "Exam Eve Final Review",
};

export function StudentToolWorkspace() {
  const [config, setConfig] = useState<StudyPlannerConfig>(DEFAULT_STUDY_CONFIG);
  const [subjects, setSubjects] = useState<ExamSubject[]>(DEFAULT_EXAM_SUBJECTS);
  const [sessions, setSessions] = useState<StudySession[]>(() => {
    const initial = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
    return initial.sessions;
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [rescheduleDate, setRescheduleDate] = useState<string>("2026-10-30");
  const [hydrated, setHydrated] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load saved plan from localStorage on client mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          config?: StudyPlannerConfig;
          subjects?: ExamSubject[];
          sessions?: StudySession[];
        };
        if (parsed.config && parsed.subjects && parsed.sessions) {
          setConfig(parsed.config);
          setSubjects(parsed.subjects);
          setSessions(parsed.sessions);
        }
      }
    } catch {
      // Ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist changes to localStorage after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, subjects, sessions }));
    } catch {
      // Ignore storage quota errors
    }
  }, [config, subjects, sessions, hydrated]);

  const handleGenerateSchedule = () => {
    setError(null);
    const res = generateDeterministicStudySchedule(subjects, config);
    if (!res.ok) {
      setError(res.error ?? "Could not generate study schedule.");
      setWarnings(res.warnings);
      return;
    }
    setSessions(res.sessions);
    setWarnings(res.warnings);
    setWeekOffset(0);
  };

  const handleRescheduleRemaining = () => {
    setError(null);
    const res = rescheduleMissedSessions(subjects, config, sessions, rescheduleDate);
    if (!res.ok) {
      setError(res.error ?? "Could not reschedule remaining sessions.");
      setWarnings(res.warnings);
      return;
    }
    setSessions(res.sessions);
    setWarnings(res.warnings);
  };

  const handleResetToSample = () => {
    setConfig(DEFAULT_STUDY_CONFIG);
    setSubjects(DEFAULT_EXAM_SUBJECTS);
    const res = generateDeterministicStudySchedule(DEFAULT_EXAM_SUBJECTS, DEFAULT_STUDY_CONFIG);
    setSessions(res.sessions);
    setWarnings(res.warnings);
    setError(null);
    setWeekOffset(0);
    setSubjectFilter("all");
  };

  const handleAddSubject = () => {
    const colorPool: ExamSubject["colorTag"][] = ["lime", "blue", "emerald", "amber", "rose"];
    const nextColor = colorPool[subjects.length % colorPool.length] ?? "lime";
    setSubjects((prev) => [
      ...prev,
      {
        id: `subj-${Date.now()}-${prev.length + 1}`,
        name: `New Course ${prev.length + 1}`,
        topics: ["Module 1 Core Concepts", "Past Exam Problems"],
        examDate: addDaysIso(config.startDate, 10),
        difficulty: 3,
        confidence: 3,
        colorTag: nextColor,
      },
    ]);
  };

  const handleUpdateSubject = (id: string, patch: Partial<ExamSubject>) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleRemoveSubject = (id: string) => {
    if (subjects.length <= 1) return;
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleSessionCompleted = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, completed: !s.completed } : s)),
    );
  };

  const handleExportPdf = async () => {
    if (sessions.length === 0) return;
    setIsExportingPdf(true);
    try {
      const pdfBytes = await generateStudyPlanPdf(config, subjects, sessions);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const base = sanitizeFilename(config.planTitle || "examsprint-schedule");
      downloadBlob(blob, `${base}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PDF schedule.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCsv = () => {
    if (sessions.length === 0) return;
    const csv = exportStudyScheduleToCsv(sessions);
    const base = sanitizeFilename(config.planTitle || "examsprint-schedule");
    downloadText(csv, `${base}.csv`, "text/csv;charset=utf-8");
  };

  const stats = computeStudyProgressStats(subjects, sessions, config.startDate);

  const filteredSessions =
    subjectFilter === "all" ? sessions : sessions.filter((s) => s.subjectId === subjectFilter);

  // Group sessions by date for Daily View
  const groupedByDate = filteredSessions.reduce<Record<string, StudySession[]>>((acc, sess) => {
    const list = acc[sess.date] ?? [];
    list.push(sess);
    acc[sess.date] = list;
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort();

  // Compute 7 days for Weekly View based on config.startDate + weekOffset * 7
  const weekStartIso = addDaysIso(config.startDate, weekOffset * 7);
  const weekDaysIso = Array.from({ length: 7 }, (_, idx) => addDaysIso(weekStartIso, idx));

  return (
    <div className="space-y-8">
      {/* Top Banner & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/40 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Deterministic Priority-Weighted
            Scheduler
          </span>
          <span>
            Allocates extra revision slots to higher-difficulty, lower-confidence, and sooner-exam
            subjects.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetToSample}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset Sample Plan
          </button>
          <button
            type="button"
            disabled={sessions.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </button>
          <button
            type="button"
            disabled={sessions.length === 0 || isExportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {isExportingPdf ? "Generating PDF..." : "Download PDF Timetable"}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div role="status" className="rounded-2xl border bg-muted p-4 text-xs text-foreground">
          <p className="font-semibold">Schedule Notes:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1: Study Availability & Plan Settings */}
      <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4">
        <h2 className="text-lg font-bold text-foreground">
          1. Study Availability & Session Settings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="plan-title-input"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Study Plan Name
            </label>
            <input
              id="plan-title-input"
              type="text"
              value={config.planTitle}
              onChange={(e) => setConfig({ ...config, planTitle: e.target.value })}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-sm font-medium"
            />
          </div>

          <div>
            <label
              htmlFor="plan-start-date"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Revision Start Date
            </label>
            <input
              id="plan-start-date"
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="plan-weekday-hours"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Weekday Hours / Day
            </label>
            <input
              id="plan-weekday-hours"
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={config.weekdayHours}
              onChange={(e) => setConfig({ ...config, weekdayHours: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="plan-weekend-hours"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Weekend Hours / Day
            </label>
            <input
              id="plan-weekend-hours"
              type="number"
              min={0}
              max={16}
              step={0.5}
              value={config.weekendHours}
              onChange={(e) => setConfig({ ...config, weekendHours: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="plan-session-mins"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Session Block Length
            </label>
            <select
              id="plan-session-mins"
              value={String(config.sessionDurationMinutes)}
              onChange={(e) => {
                const v = Number(e.target.value);
                const mins: 30 | 45 | 60 | 90 = v === 30 ? 30 : v === 60 ? 60 : v === 90 ? 90 : 45;
                setConfig({ ...config, sessionDurationMinutes: mins });
              }}
              className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 text-sm font-medium"
            >
              <option value="30">30 minutes (Pomodoro+)</option>
              <option value="45">45 minutes (Focused Sprint)</option>
              <option value="60">60 minutes (Standard Block)</option>
              <option value="90">90 minutes (Deep Work)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Subjects, Topics, Exam Dates & Difficulty/Confidence */}
      <div className="rounded-3xl border bg-card p-6 shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              2. Subjects, Topics & Exam Dates ({subjects.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Rate difficulty (1=Easy, 5=Very Hard) and current confidence (1=Low, 5=High) to weight
              study time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAddSubject}
              className="inline-flex items-center gap-1.5 rounded-full border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add Subject
            </button>
            <button
              type="button"
              onClick={handleGenerateSchedule}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden /> Generate / Update Schedule
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {subjects.map((subj, idx) => {
            const tagStyle = COLOR_TAG_STYLES[subj.colorTag];
            return (
              <div
                key={subj.id}
                className={`rounded-2xl border bg-background/70 p-4 ${tagStyle.border}`}
              >
                <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Subject / Course #{idx + 1}
                    </label>
                    <input
                      type="text"
                      value={subj.name}
                      onChange={(e) => handleUpdateSubject(subj.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Topics (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={subj.topics.join(", ")}
                      onChange={(e) =>
                        handleUpdateSubject(subj.id, {
                          topics: e.target.value.split(","),
                        })
                      }
                      placeholder="Topic 1, Topic 2, Past Papers..."
                      className="mt-1 w-full rounded-xl border bg-card px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Exam Date
                    </label>
                    <input
                      type="date"
                      value={subj.examDate}
                      onChange={(e) =>
                        handleUpdateSubject(subj.id, {
                          examDate: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border bg-card px-3 py-2 font-mono text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 lg:col-span-3 lg:items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Difficulty
                      </label>
                      <select
                        aria-label={`Difficulty for ${subj.name}`}
                        value={String(subj.difficulty)}
                        onChange={(e) =>
                          handleUpdateSubject(subj.id, {
                            difficulty: Number(e.target.value) as RatingLevel,
                          })
                        }
                        className="mt-1 w-full rounded-xl border bg-card px-2 py-2 text-xs font-semibold"
                      >
                        {[1, 2, 3, 4, 5].map((lv) => (
                          <option key={lv} value={String(lv)}>
                            {lv} / 5
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground">
                        Confidence
                      </label>
                      <select
                        aria-label={`Confidence for ${subj.name}`}
                        value={String(subj.confidence)}
                        onChange={(e) =>
                          handleUpdateSubject(subj.id, {
                            confidence: Number(e.target.value) as RatingLevel,
                          })
                        }
                        className="mt-1 w-full rounded-xl border bg-card px-2 py-2 text-xs font-semibold"
                      >
                        {[1, 2, 3, 4, 5].map((lv) => (
                          <option key={lv} value={String(lv)}>
                            {lv} / 5
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={subjects.length <= 1}
                        aria-label={`Remove ${subj.name}`}
                        onClick={() => handleRemoveSubject(subj.id)}
                        className="rounded-xl border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: Progress Dashboard & Reschedule Bar */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-3xl border bg-card p-6 shadow-card space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-foreground">3. Revision Progress Tracker</h2>
              <p className="text-xs text-muted-foreground">
                {stats.completedSessions} of {stats.totalSessions} sessions completed (
                {stats.completedHours} / {stats.totalHours} hrs)
              </p>
            </div>
            <span className="rounded-full bg-primary px-4 py-1 font-mono text-sm font-extrabold text-primary-foreground">
              {stats.overallPercent}% Complete
            </span>
          </div>

          {/* Overall Progress Bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-foreground transition-all"
              style={{ width: `${stats.overallPercent}%` }}
            />
          </div>

          {/* Per-Subject Progress Breakdown */}
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.bySubject.map((item) => {
              const style = COLOR_TAG_STYLES[item.colorTag];
              return (
                <div
                  key={item.subjectId}
                  className="rounded-2xl border bg-background p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-foreground line-clamp-1">
                      {item.subjectName}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${style.pill}`}
                    >
                      Wt {item.priorityScore}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Exam: {item.examDate} · {item.completedSessions}/{item.totalSessions} done
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${style.dot}`}
                      style={{ width: `${item.completionPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Adaptive Missed-Session Rescheduler */}
        <div className="rounded-3xl border bg-card p-6 shadow-card flex flex-col justify-between space-y-4 lg:col-span-5">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground">
              Missed a Day? Reschedule Remaining Tasks
            </h3>
            <p className="text-xs text-muted-foreground">
              Keep all sessions you have already checked off as completed, and redistribute
              remaining revision topics from a new restart date through each exam date.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="reschedule-from-date"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Reschedule Incomplete Tasks From
              </label>
              <input
                id="reschedule-from-date"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3.5 py-2 font-mono text-xs"
              />
            </div>
            <button
              type="button"
              onClick={handleRescheduleRemaining}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background transition hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Reschedule Incomplete
            </button>
          </div>
        </div>
      </div>

      {/* Step 4: Interactive Timetable (Daily & Weekly Views) */}
      <div className="rounded-3xl border bg-card p-6 shadow-card space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">4. Revision Timetable</h2>
            <div
              role="tablist"
              aria-label="Timetable view mode"
              className="inline-flex rounded-full border bg-muted/40 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "daily"}
                onClick={() => setViewMode("daily")}
                className={`rounded-full px-4 py-1 text-xs font-semibold ${
                  viewMode === "daily"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground"
                }`}
              >
                Daily View
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "weekly"}
                onClick={() => setViewMode("weekly")}
                className={`rounded-full px-4 py-1 text-xs font-semibold ${
                  viewMode === "weekly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground"
                }`}
              >
                Weekly View
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span>Filter Subject:</span>
              <select
                aria-label="Filter schedule by subject"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="min-w-0 max-w-full rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <option value="all">All Subjects ({sessions.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Daily View */}
        {viewMode === "daily" && (
          <div className="space-y-4">
            {sortedDates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No study sessions match the current filter.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {sortedDates.map((isoDate) => {
                  const daySessions = groupedByDate[isoDate] ?? [];
                  const dayMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
                  const examsToday = subjects.filter((s) => s.examDate === isoDate);

                  return (
                    <div key={isoDate} className="rounded-2xl border bg-background p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2.5">
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {formatHumanDate(isoDate)}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{isoDate}</p>
                        </div>
                        <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs font-semibold text-foreground">
                          {daySessions.length} {daySessions.length === 1 ? "slot" : "slots"} (
                          {Math.round((dayMins / 60) * 10) / 10}h)
                        </span>
                      </div>

                      {examsToday.map((ex) => (
                        <div
                          key={ex.id}
                          className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                        >
                          EXAM DAY: {ex.name}
                        </div>
                      ))}

                      <div className="space-y-2">
                        {daySessions.map((sess) => {
                          const style = COLOR_TAG_STYLES[sess.colorTag];
                          return (
                            <button
                              key={sess.id}
                              type="button"
                              onClick={() => toggleSessionCompleted(sess.id)}
                              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                                sess.completed
                                  ? "bg-muted/50 opacity-70"
                                  : "bg-card hover:border-foreground/40"
                              }`}
                            >
                              {sess.completed ? (
                                <CheckCircle2
                                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                                  aria-hidden
                                />
                              ) : (
                                <Circle
                                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <span
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${style.pill}`}
                                  >
                                    {sess.subjectName}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    Slot #{sess.slotIndex} · {sess.durationMinutes}m
                                  </span>
                                </div>
                                <p
                                  className={`mt-1 text-xs font-semibold ${
                                    sess.completed
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {sess.topic}
                                </p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                  {FOCUS_LABELS[sess.focusType]}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Weekly View */}
        {viewMode === "weekly" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={weekOffset <= 0}
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                className="rounded-full border bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40"
              >
                ← Previous 7 Days
              </button>
              <span className="text-xs font-bold text-foreground">
                Week {weekOffset + 1}: {formatHumanDate(weekDaysIso[0]!)} —{" "}
                {formatHumanDate(weekDaysIso[6]!)}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="rounded-full border bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Next 7 Days →
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {weekDaysIso.map((isoDate) => {
                const daySessions = groupedByDate[isoDate] ?? [];
                const examsToday = subjects.filter((s) => s.examDate === isoDate);
                return (
                  <div
                    key={isoDate}
                    className="flex flex-col rounded-2xl border bg-background p-3 space-y-2"
                  >
                    <div className="border-b pb-2">
                      <p className="text-xs font-bold text-foreground">
                        {formatHumanDate(isoDate)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {daySessions.length} slots
                      </p>
                    </div>

                    {examsToday.map((ex) => (
                      <div
                        key={ex.id}
                        className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground"
                      >
                        EXAM: {ex.name}
                      </div>
                    ))}

                    <div className="space-y-1.5">
                      {daySessions.length === 0 ? (
                        <p className="py-4 text-center text-[11px] italic text-muted-foreground">
                          No sessions
                        </p>
                      ) : (
                        daySessions.map((sess) => {
                          const style = COLOR_TAG_STYLES[sess.colorTag];
                          return (
                            <button
                              key={sess.id}
                              type="button"
                              onClick={() => toggleSessionCompleted(sess.id)}
                              className={`w-full rounded-xl border p-2 text-left text-[11px] transition ${
                                sess.completed
                                  ? "bg-muted/50 opacity-65 line-through"
                                  : "bg-card hover:border-foreground/40"
                              }`}
                            >
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${style.pill}`}
                              >
                                {sess.subjectName}
                              </span>
                              <p className="mt-1 font-medium text-foreground line-clamp-2">
                                {sess.topic}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
