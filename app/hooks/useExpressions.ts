"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createExpressionId,
  isValidMeaning,
  isValidTerm,
  normalizeTerm,
  readAll,
  writeAll,
} from "../lib/expressions";
import type { ExpressionDraft, SaveFailure, SavedExpression, StorageStatus } from "../lib/types";

/** specs/002-expression-capture/contracts/use-expressions.md */
export type UseExpressionsResult = {
  status: StorageStatus;
  /** savedAt 내림차순. 호출자가 다시 정렬하지 않는다 (조항 2, FR-017) */
  expressions: SavedExpression[];
  /** 언제나 expressions.length 와 같다. 별도 카운터를 두지 않는다 (조항 3, FR-018) */
  count: number;
  findDuplicate: (term: string) => SavedExpression | null;
  save: (
    draft: ExpressionDraft,
  ) => { ok: true; saved: SavedExpression } | { ok: false; reason: SaveFailure };
  remove: (id: string) => boolean;
};

/** 최근에 저장한 것이 먼저 온다 (FR-017). */
function sortByNewest(items: SavedExpression[]): SavedExpression[] {
  return [...items].sort((a, b) => b.savedAt - a.savedAt);
}

function findDuplicateIn(items: SavedExpression[], term: string): SavedExpression | null {
  const normalized = normalizeTerm(term);
  // 예문은 비교하지 않는다 — 같은 표현을 여러 대화에서 만날 때마다 카드가 늘면
  // FR-021이 막으려던 문제 그 자체가 된다 (R-005).
  return items.find((item) => normalizeTerm(item.term) === normalized) ?? null;
}

/**
 * 표현 모음의 단일 소유자다. `TalklogApp` 셸에서 한 번만 호출한다.
 *
 * 저장은 `Room`(스크립트에서 고르기)과 `Feedback`(FR-024)에서 일어나고 조회는
 * `Cards`에서 일어나므로 세 화면의 공통 조상이 가져야 한다. 화면이 조건부 렌더링이라
 * `Room`이 언마운트되면 화면 안에 둔 상태는 사라진다.
 */
export function useExpressions(): UseExpressionsResult {
  const [status, setStatus] = useState<StorageStatus>("loading");
  const [expressions, setExpressions] = useState<SavedExpression[]>([]);

  /**
   * `save`·`remove` 는 이벤트 핸들러에서 동기로 결과를 돌려줘야 하므로 목록의 최신
   * 값을 렌더와 무관하게 읽을 수 있어야 한다. 같은 tick 에 두 번 저장해도 앞의 저장이
   * 사라지지 않는다.
   */
  const expressionsRef = useRef<SavedExpression[]>([]);

  /** 저장소를 한 번이라도 성공적으로 읽었는지. `expressionsRef` 를 믿을 수 있는지의 근거다. */
  const hasLoadedRef = useRef(false);

  const applyExpressions = useCallback((next: SavedExpression[]) => {
    expressionsRef.current = next;
    setExpressions(next);
  }, []);

  /**
   * 쓰기의 기준이 되는 목록. 읽지 못한 상태(`unavailable`)에서 그대로 쓰면 저장소에
   * 남아 있는 표현을 덮어써 버리므로, 먼저 다시 읽어 성공하면 그 값을 기준으로 삼는다.
   *
   * `null` 은 저장소를 여전히 읽을 수 없다는 뜻이다. 브라우저 설정이 그동안 바뀔 수
   * 있어 "unavailable" 을 영구 상태로 두지 않는 것과 같은 이유다 (조항 8).
   */
  const readBaseForWrite = useCallback((): SavedExpression[] | null => {
    if (hasLoadedRef.current) return expressionsRef.current;

    const result = readAll();
    if (!result.ok) return null;

    hasLoadedRef.current = true;
    const items = sortByNewest(result.items);
    expressionsRef.current = items;
    return items;
  }, []);

  /**
   * 첫 렌더의 `status` 는 항상 `"loading"` 이다 (조항 1). 저장소 읽기를 렌더 중에 하면
   * 서버 렌더 결과와 달라져 hydration 이 어긋난다 (R-004).
   */
  useEffect(() => {
    const result = readAll();
    if (!result.ok) {
      setStatus("unavailable");
      return;
    }
    hasLoadedRef.current = true;
    applyExpressions(sortByNewest(result.items));
    setStatus("ready");
  }, [applyExpressions]);

  /**
   * 렌더 중에 불러도 안전하도록 ref 가 아니라 상태를 읽는다. 화면은 "지금 보이는 목록"을
   * 기준으로 중복을 표시해야 하고, 목록이 바뀌면 다시 렌더되므로 결과가 최신이 된다.
   * (동기로 확정해야 하는 `save` 만 ref 를 읽는다.)
   */
  const findDuplicate = useCallback(
    (term: string) => findDuplicateIn(expressions, term),
    [expressions],
  );

  const save = useCallback<UseExpressionsResult["save"]>(
    (draft) => {
      // 실패 이유를 구분해 돌려준다. 호출자가 어떤 문구를 보여줄지 결정한다 (조항 5).
      if (!isValidTerm(draft.term)) return { ok: false, reason: "invalid-term" };
      if (!isValidMeaning(draft.meaning)) return { ok: false, reason: "invalid-meaning" };

      // 중복은 저장소를 읽을 수 있어야 판정할 수 있으므로 저장소 상태를 먼저 확인한다.
      const base = readBaseForWrite();
      if (base === null) {
        setStatus("unavailable");
        return { ok: false, reason: "storage-unavailable" };
      }

      if (findDuplicateIn(base, draft.term)) {
        // 중복이면 아무것도 저장하지 않는다 (FR-021, E7).
        return { ok: false, reason: "duplicate" };
      }

      const saved: SavedExpression = {
        id: createExpressionId(),
        term: draft.term.trim(),
        meaning: draft.meaning.trim(),
        example: draft.example,
        sourceRoom: draft.sourceRoom,
        savedAt: Date.now(),
      };
      const next = sortByNewest([saved, ...base]);

      // 저장소 쓰기가 실패하면 목록을 바꾸지 않는다. 화면에서만 성공한 것처럼 보이는
      // 상태를 만들어서는 안 된다 (조항 6, FR-015, 원칙 II).
      if (!writeAll(next)) {
        setStatus("unavailable");
        return { ok: false, reason: "storage-unavailable" };
      }

      applyExpressions(next);
      // "unavailable" 은 영구가 아니다 — 브라우저 설정이 그동안 바뀔 수 있다 (조항 8).
      setStatus("ready");
      return { ok: true, saved };
    },
    [applyExpressions, readBaseForWrite],
  );

  const remove = useCallback(
    (id: string) => {
      const current = readBaseForWrite();
      if (current === null) {
        setStatus("unavailable");
        return false;
      }

      const next = current.filter((item) => item.id !== id);
      if (next.length === current.length) return false;

      // 저장소에서도 지운다. 새로고침 후 다시 나타나서는 안 된다 (조항 10).
      if (!writeAll(next)) {
        setStatus("unavailable");
        return false;
      }

      applyExpressions(next);
      setStatus("ready");
      return true;
    },
    [applyExpressions, readBaseForWrite],
  );

  return {
    status,
    expressions,
    count: expressions.length,
    findDuplicate,
    save,
    remove,
  };
}
