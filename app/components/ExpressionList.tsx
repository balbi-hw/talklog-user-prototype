"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  isValidMeaning,
  isValidTerm,
  normalizeTerm,
  UPDATE_FAILURE_MESSAGE,
} from "../lib/expressions";
import type {
  ExpressionUpdate,
  SavedExpression,
  StorageStatus,
  UpdateFailure,
  UpdateResult,
} from "../lib/types";

export type ExpressionListProps = {
  status: StorageStatus;
  /** savedAt 내림차순으로 이미 정렬돼 있다. 여기서 다시 정렬하지 않는다 (FR-017) */
  expressions: SavedExpression[];
  count: number;
  onReload: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, changes: ExpressionUpdate) => UpdateResult;
};

/**
 * 카드 목록 (specs/002-expression-capture/contracts/expression-list-ui.md).
 *
 * 하드코딩된 표현을 렌더링하지 않는다. 저장한 표현만 보여준다 (FR-025, 원칙 II).
 */
export default function ExpressionList({
  status,
  expressions,
  count,
  onReload,
  onRemove,
  onUpdate,
}: ExpressionListProps) {
  /** 삭제 확인을 기다리는 항목. 되돌릴 수 없는 동작이므로 확인 단계를 거친다 (FR-023) */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<(ExpressionUpdate & { id: string }) | null>(null);
  const [updateError, setUpdateError] = useState<UpdateFailure | null>(null);
  const [notice, setNotice] = useState("");
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocus = useRef<{ id: string; action: "edit" | "delete" } | null>(null);
  const countRef = useRef<HTMLParagraphElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // 폼이 닫히고 비활성 버튼이 다시 활성화된 React 커밋 뒤에 복귀한다.
  useEffect(() => {
    const target = restoreFocus.current;
    if (!target) return;
    const buttons = target.action === "edit" ? editButtons : deleteButtons;
    (buttons.current.get(target.id) ?? countRef.current ?? emptyRef.current)?.focus({ preventScroll: true });
    restoreFocus.current = null;
  }, [editing, pendingId]);

  const cancelEdit = () => {
    if (!editing) return;
    restoreFocus.current = { id: editing.id, action: "edit" };
    setEditing(null);
    setUpdateError(null);
  };

  const blockedReason: UpdateFailure | null = !editing ? null
    : !isValidTerm(editing.term) ? "invalid-term"
    : !isValidMeaning(editing.meaning) ? "invalid-meaning"
    : expressions.some((item) => item.id !== editing.id && normalizeTerm(item.term) === normalizeTerm(editing.term))
      ? "duplicate" : null;
  const editNotice = blockedReason ?? updateError;

  /**
   * `loading` 과 빈 상태를 같은 화면으로 처리하면 안 된다. 표현이 있는 사용자에게도
   * "저장한 표현이 없어요"가 한 순간 보이고, 사용자는 저장이 사라졌다고 오해한다
   * (R-004, FR-019).
   */
  if (status === "loading") {
    return <div className="expression-list-loading" aria-hidden="true" />;
  }

  const unavailableNotice = status === "unavailable" ? (
      <div className="expression-unavailable" role="status">
        <strong>이 브라우저에서는 표현을 저장할 수 없어요</strong>
        <p>
          브라우저 설정에서 이 사이트의 쿠키·사이트 데이터가 차단돼 있으면 저장한 표현을
          읽고 쓸 수 없어요. 설정이나 저장 공간을 확인해주세요.
          {expressions.length > 0 ? " 입력한 내용은 유지돼요. 복구 후 다시 저장할 수 있어요." : " 설정을 되돌린 뒤 다시 읽기를 눌러주세요."}
        </p>
        <button className="review-secondary" onClick={onReload}>다시 읽기</button>
      </div>
    ) : null;

  if (status === "unavailable" && expressions.length === 0) return unavailableNotice;

  if (count === 0) {
    return (
      <div className="expression-empty" ref={emptyRef} tabIndex={-1}>
        <strong>아직 저장한 표현이 없어요</strong>
        <p>
          학습방에서 학습 짝의 음성을 열고 <b>스크립트</b>를 펼친 뒤, 배우고 싶은 부분을
          끌어서 고르면 표현으로 저장할 수 있어요.
        </p>
      </div>
    );
  }

  return (
    <>
      {unavailableNotice}
      <p className="expression-edit-status" role="status">{notice}</p>
      {/* 개수는 useExpressions.count 를 그대로 쓴다. 별도 카운터를 두지 않는다 (FR-018) */}
      <p className="expression-count" ref={countRef} tabIndex={-1}>저장한 표현 {count}개</p>
      {(editing || pendingId) && (
        <p className="expression-edit-hint">
          {editing ? "편집을 저장하거나 취소한 뒤 다른 표현을 편집·삭제할 수 있어요." : "삭제 확인을 마친 뒤 편집할 수 있어요."}
        </p>
      )}

      <div className="expression-list">
        {expressions.map((expression, index) => (
          <article className="expression-card" key={expression.id}>
            <div className="expression-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="expression-edit-content">
              <div id={`${listId}-edit-${index}`}>
                {editing?.id === expression.id ? (
                  <form
                    className="expression-edit-form"
                    aria-label={`${expression.term} 편집`}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (blockedReason) return;
                      const result = onUpdate(editing.id, { term: editing.term, meaning: editing.meaning });
                      if (!result.ok) {
                        setUpdateError(result.reason);
                        return;
                      }
                      restoreFocus.current = { id: editing.id, action: "edit" };
                      setNotice(`「${result.saved.term}」 표현을 수정했어요`);
                      setEditing(null);
                      setUpdateError(null);
                    }}
                  >
                    <label htmlFor={`${listId}-term-${index}`}>표현</label>
                    <input
                      id={`${listId}-term-${index}`}
                      value={editing.term}
                      autoComplete="off"
                      onChange={(event) => {
                        setEditing({ ...editing, term: event.target.value });
                        setUpdateError(null);
                      }}
                    />
                    <label htmlFor={`${listId}-meaning-${index}`}>뜻</label>
                    <textarea
                      id={`${listId}-meaning-${index}`}
                      value={editing.meaning}
                      rows={3}
                      autoFocus
                      onChange={(event) => {
                        setEditing({ ...editing, meaning: event.target.value });
                        setUpdateError(null);
                      }}
                    />
                    <p className="expression-edit-error" id={`${listId}-reason-${index}`} role="status">
                      {editNotice ? UPDATE_FAILURE_MESSAGE[editNotice] : "표현과 뜻만 고칠 수 있어요. 예문과 출처는 유지돼요."}
                    </p>
                    <div className="expression-edit-actions">
                      <button type="button" onClick={cancelEdit}>취소</button>
                      <button type="submit" disabled={blockedReason !== null} aria-describedby={`${listId}-reason-${index}`}>저장</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h2 className="expression-term">{expression.term}</h2>
                    <p className="expression-meaning">{expression.meaning}</p>
                  </>
                )}
              </div>
              {/* 예문을 빼면 FR-010으로 저장한 값을 사용자가 확인할 경로가 없어진다 */}
              <p className="expression-example">{expression.example}</p>
              <small>↳ {expression.sourceRoom}</small>

              {pendingId === expression.id && (
                <div className="expression-confirm" id={`${listId}-delete-${index}`}>
                  <strong>지울까요?</strong>
                  <div className="expression-confirm-actions">
                    <button autoFocus onClick={() => {
                      restoreFocus.current = { id: expression.id, action: "delete" };
                      setPendingId(null);
                    }}>취소</button>
                    <button
                      className="expression-confirm-remove"
                      onClick={() => {
                        // 삭제되는 버튼 대신 다음 항목 또는 목록 개수로 이동한다.
                        const next = expressions[index + 1] ?? expressions[index - 1];
                        restoreFocus.current = { id: next?.id ?? "", action: "edit" };
                        onRemove(expression.id);
                        setPendingId(null);
                      }}
                    >
                      지우기
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="expression-edit-controls">
              <button
                className="expression-edit-toggle"
                ref={(button) => {
                  if (button) editButtons.current.set(expression.id, button);
                  else editButtons.current.delete(expression.id);
                }}
                aria-label={`${expression.term} 표현 편집`}
                aria-expanded={editing?.id === expression.id}
                aria-controls={`${listId}-edit-${index}`}
                disabled={editing !== null || pendingId !== null}
                onClick={() => {
                  setEditing({ id: expression.id, term: expression.term, meaning: expression.meaning });
                  setUpdateError(null);
                  setNotice("");
                }}
              >편집</button>
              <button
                className="expression-delete"
                aria-label="표현 삭제"
                ref={(button) => {
                  if (button) deleteButtons.current.set(expression.id, button);
                  else deleteButtons.current.delete(expression.id);
                }}
                aria-expanded={pendingId === expression.id}
                aria-controls={`${listId}-delete-${index}`}
                disabled={editing !== null}
                onClick={() => setPendingId(expression.id)}
              >
                ×
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
