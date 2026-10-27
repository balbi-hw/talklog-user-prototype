"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseExpressionsResult } from "./useExpressions";
import type { SavedExpression, StorageStatus } from "../lib/types";
import { advanceReview, localDate, readReviewSnapshot, reviewOverview, saveReviewAnswer,
  type ReviewAnswer, type ReviewRecord, type ReviewSessionState } from "../lib/reviews";

export function useReviews(source: UseExpressionsResult) {
  const [status, setStatus] = useState<StorageStatus>("loading");
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [expressions, setExpressions] = useState<SavedExpression[]>([]);
  const [today, setToday] = useState("");
  const [session, setSession] = useState<ReviewSessionState | null>(null);
  const sessionRef = useRef<ReviewSessionState | null>(null);
  const busy = useRef(false);
  const [notice, setNotice] = useState("");

  const applySession = useCallback((next: ReviewSessionState | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const refresh = useCallback(() => {
    const snapshot = readReviewSnapshot();
    setToday(localDate());
    if (!snapshot.ok) { setStatus("unavailable"); return false; }
    setExpressions(snapshot.expressions);
    setRecords(snapshot.records);
    setStatus("ready");
    return true;
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "talklog.reviews" || event.key === "talklog.expressions") refresh();
    };
    let timer: ReturnType<typeof setTimeout>;
    const atMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => { refresh(); atMidnight(); }, next.getTime() - now.getTime() + 50);
    };
    atMidnight();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => { clearTimeout(timer); window.removeEventListener("focus", refresh); window.removeEventListener("storage", onStorage); };
  }, [refresh]);

  // 같은 탭의 상류 저장/삭제도 반영한다. 상류 훅의 저장 로직은 수정하지 않는다.
  useEffect(() => { if (source.status === "ready") refresh(); }, [source.expressions, source.status, refresh]);

  // 외부에서 삭제된 큐 항목은 건너뛴다. 성공한 과거 응답 통계는 세션 결과에 남는다.
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || status !== "ready") return;
    const ids = new Set(expressions.map((item) => item.id));
    let position = current.position;
    while (position < current.queue.length && !ids.has(current.queue[position].expressionId)) position++;
    if (position !== current.position) {
      applySession({ ...current, position });
      setNotice("삭제된 표현은 복습에서 건너뛰었어요.");
    }
  }, [expressions, status, applySession]);

  const start = useCallback(() => {
    const snapshot = readReviewSnapshot();
    const day = localDate();
    setToday(day);
    if (!snapshot.ok) { setStatus("unavailable"); return; }
    setExpressions(snapshot.expressions); setRecords(snapshot.records); setStatus("ready");
    const due = reviewOverview(snapshot.expressions, snapshot.records, day).due.slice(0, 20);
    if (!due.length) { applySession(null); return; }
    setNotice("");
    applySession({ queue: due.map(({ expression }) => ({ expressionId: expression.id, repeated: false })),
      position: 0, initialCount: due.length, finalAnswers: new Map() });
  }, [applySession]);

  const answer = useCallback((value: ReviewAnswer) => {
    const current = sessionRef.current;
    if (!current || busy.current || current.position >= current.queue.length) return false;
    busy.current = true;
    const result = saveReviewAnswer(current.queue[current.position].expressionId, value);
    if (!result.ok) {
      if (result.reason === "missing") {
        setExpressions(result.snapshot.expressions); setRecords(result.snapshot.records); setStatus("ready");
        applySession({ ...current, position: current.position + 1 });
        setNotice("삭제된 표현은 복습에서 건너뛰었어요.");
      } else {
        setStatus("unavailable");
        setNotice("응답을 저장하지 못했어요. 설정이나 저장 공간을 확인한 뒤 같은 응답을 다시 선택해주세요.");
      }
      busy.current = false;
      return false;
    }
    setExpressions(result.expressions); setRecords(result.records); setToday(localDate()); setStatus("ready");
    setNotice(value === "know" ? "알고 있어요를 기록했어요." : "다시 볼래요를 기록했어요.");
    applySession(advanceReview(current, value));
    // 렌더 전 연속 클릭은 동일 카드에 중복 응답을 남기지 않는다.
    return true;
  }, [applySession]);

  useEffect(() => { busy.current = false; }, [session]);

  const end = useCallback(() => { applySession(null); setNotice(""); }, [applySession]);
  const overview = reviewOverview(expressions, records, today);
  const currentId = session?.queue[session.position]?.expressionId;
  return { ...overview, status: source.status === "loading" ? "loading" as const : status,
    session, current: expressions.find((item) => item.id === currentId) ?? null,
    notice, refresh, start, answer, end };
}

export type UseReviewsResult = ReturnType<typeof useReviews>;
