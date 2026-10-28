import { readAll as readExpressions } from "./expressions";
import type { SavedExpression } from "./types";

export type ReviewAnswer = "know" | "again";
export type ReviewRecord = {
  expressionId: string;
  dueDate: string;
  intervalDays: number;
  knownCount: number;
  answerCount: number;
};
export const REVIEW_STORAGE_KEY = "talklog.reviews";

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(year, month - 1, date, 12);
  result.setDate(result.getDate() + days);
  return localDate(result);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

function isRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.expressionId === "string" && item.expressionId.length > 0 &&
    isDate(item.dueDate) && typeof item.intervalDays === "number" &&
    Number.isInteger(item.intervalDays) && item.intervalDays >= 1 && item.intervalDays <= 30 &&
    typeof item.knownCount === "number" && Number.isSafeInteger(item.knownCount) && item.knownCount >= 0 &&
    typeof item.answerCount === "number" && Number.isSafeInteger(item.answerCount) &&
    item.answerCount >= 1 && item.answerCount >= item.knownCount;
}

export function readReviews(expressions: SavedExpression[]):
  { ok: true; records: ReviewRecord[] } | { ok: false } {
  let raw: string | null;
  try { raw = window.localStorage.getItem(REVIEW_STORAGE_KEY); }
  catch { return { ok: false }; }
  try {
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const ids = new Set(expressions.map((item) => item.id));
    const records = new Map<string, ReviewRecord>();
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (isRecord(item) && ids.has(item.expressionId)) records.set(item.expressionId, item);
      }
    }
    return { ok: true, records: [...records.values()] };
  } catch { return { ok: true, records: [] }; }
}

export function readReviewSnapshot() {
  const expressions = readExpressions();
  if (!expressions.ok) return { ok: false } as const;
  const reviews = readReviews(expressions.items);
  if (!reviews.ok) return { ok: false } as const;
  return { ok: true, expressions: expressions.items, records: reviews.records } as const;
}

export function scheduleAnswer(previous: ReviewRecord | undefined, expressionId: string,
  answer: ReviewAnswer, today = localDate()): ReviewRecord {
  const intervalDays = answer === "again" ? 1 : previous ? Math.min(previous.intervalDays * 2, 30) : 1;
  return {
    expressionId, intervalDays,
    dueDate: answer === "again" ? today : addDays(today, intervalDays),
    knownCount: (previous?.knownCount ?? 0) + (answer === "know" ? 1 : 0),
    answerCount: (previous?.answerCount ?? 0) + 1,
  };
}

/** 매 응답 직전에 두 저장소를 읽는다. 실패 시 저장/진행을 성공처럼 바꾸지 않는다. */
export function saveReviewAnswer(expressionId: string, answer: ReviewAnswer, today = localDate()) {
  const snapshot = readReviewSnapshot();
  if (!snapshot.ok) return { ok: false, reason: "storage" } as const;
  if (!snapshot.expressions.some((item) => item.id === expressionId)) {
    return { ok: false, reason: "missing", snapshot } as const;
  }
  const record = scheduleAnswer(snapshot.records.find((item) => item.expressionId === expressionId), expressionId, answer, today);
  const records = [...snapshot.records.filter((item) => item.expressionId !== expressionId), record];
  try { window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(records)); }
  catch { return { ok: false, reason: "storage" } as const; }
  return { ok: true, expressions: snapshot.expressions, records } as const;
}

export function reviewOverview(expressions: SavedExpression[], records: ReviewRecord[], today = localDate()) {
  const ids = new Set(expressions.map((item) => item.id));
  const valid = records.filter((item) => ids.has(item.expressionId));
  const byId = new Map(valid.map((item) => [item.expressionId, item]));
  const cards = expressions.map((expression) => ({
    expression,
    dueDate: byId.get(expression.id)?.dueDate ??
      (Number.isFinite(expression.savedAt) ? localDate(new Date(expression.savedAt)) : today),
  })).sort((a, b) => a.dueDate.localeCompare(b.dueDate) ||
    a.expression.savedAt - b.expression.savedAt || a.expression.id.localeCompare(b.expression.id));
  const due = cards.filter((card) => card.dueDate <= today);
  const answers = valid.reduce((sum, item) => sum + item.answerCount, 0);
  const known = valid.reduce((sum, item) => sum + item.knownCount, 0);
  return { due, dueCount: due.length, nextDate: cards.find((card) => card.dueDate > today)?.dueDate ?? null,
    accuracy: answers ? Math.round(known / answers * 100) : null, expressionCount: expressions.length };
}

export type ReviewQueueItem = { expressionId: string; repeated: boolean };
export type ReviewSessionState = {
  queue: ReviewQueueItem[];
  position: number;
  initialCount: number;
  finalAnswers: Map<string, ReviewAnswer>;
};

export function advanceReview(session: ReviewSessionState, answer: ReviewAnswer): ReviewSessionState {
  const current = session.queue[session.position];
  const queue = answer === "again" && !current.repeated
    ? [...session.queue, { expressionId: current.expressionId, repeated: true }] : session.queue;
  const finalAnswers = new Map(session.finalAnswers);
  finalAnswers.set(current.expressionId, answer);
  return { ...session, queue, position: session.position + 1, finalAnswers };
}
