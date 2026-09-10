"use client";

import { useState } from "react";
import type { SavedExpression, StorageStatus } from "../lib/types";

export type ExpressionListProps = {
  status: StorageStatus;
  /** savedAt 내림차순으로 이미 정렬돼 있다. 여기서 다시 정렬하지 않는다 (FR-017) */
  expressions: SavedExpression[];
  count: number;
  onRemove: (id: string) => void;
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
  onRemove,
}: ExpressionListProps) {
  /** 삭제 확인을 기다리는 항목. 되돌릴 수 없는 동작이므로 확인 단계를 거친다 (FR-023) */
  const [pendingId, setPendingId] = useState<string | null>(null);

  /**
   * `loading` 과 빈 상태를 같은 화면으로 처리하면 안 된다. 표현이 있는 사용자에게도
   * "저장한 표현이 없어요"가 한 순간 보이고, 사용자는 저장이 사라졌다고 오해한다
   * (R-004, FR-019).
   */
  if (status === "loading") {
    return <div className="expression-list-loading" aria-hidden="true" />;
  }

  if (status === "unavailable") {
    return (
      <div className="expression-unavailable">
        <strong>이 브라우저에서는 표현을 저장할 수 없어요</strong>
        <p>
          브라우저 설정에서 이 사이트의 쿠키·사이트 데이터가 차단돼 있으면 저장한 표현을
          읽고 쓸 수 없어요. 설정을 되돌린 뒤 다시 열어주세요.
        </p>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="expression-empty">
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
      {/* 개수는 useExpressions.count 를 그대로 쓴다. 별도 카운터를 두지 않는다 (FR-018) */}
      <p className="expression-count">저장한 표현 {count}개</p>

      <div className="expression-list">
        {expressions.map((expression, index) => (
          <article className="expression-card" key={expression.id}>
            <div className="expression-index">{String(index + 1).padStart(2, "0")}</div>
            <div>
              <h2 className="expression-term">{expression.term}</h2>
              <p className="expression-meaning">{expression.meaning}</p>
              {/* 예문을 빼면 FR-010으로 저장한 값을 사용자가 확인할 경로가 없어진다 */}
              <p className="expression-example">{expression.example}</p>
              <small>↳ {expression.sourceRoom}</small>

              {pendingId === expression.id && (
                <div className="expression-confirm">
                  <strong>지울까요?</strong>
                  <div className="expression-confirm-actions">
                    <button onClick={() => setPendingId(null)}>취소</button>
                    <button
                      className="expression-confirm-remove"
                      onClick={() => {
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
            <button
              className="expression-delete"
              aria-label="표현 삭제"
              onClick={() => setPendingId(expression.id)}
            >
              ×
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
