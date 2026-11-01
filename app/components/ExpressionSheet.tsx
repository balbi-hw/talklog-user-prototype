"use client";

import { isValidMeaning, isValidTerm, SAVE_FAILURE_MESSAGE } from "../lib/expressions";
import { useId } from "react";
import type { TranscriptSelection } from "../hooks/useTranscriptSelection";
import type { ExpressionDraft, SaveFailure, SavedExpression, StorageStatus } from "../lib/types";


export type ExpressionSheetProps = {
  selection: TranscriptSelection | null;
  draft: ExpressionDraft | null;
  /** 같은 표현이 이미 있으면 그 표현 (FR-021) */
  duplicateOf: SavedExpression | null;
  storageStatus: StorageStatus;
  /** 저장을 실제로 시도해 실패한 이유 */
  saveError: SaveFailure | null;
  /** 방금 저장한 표현 본문. 완료 표시에 쓴다 (FR-012) */
  savedTerm: string | null;
  onStart: () => void;
  onTermChange: (term: string) => void;
  onMeaningChange: (meaning: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

/**
 * 표현 저장 수단 (specs/002-expression-capture/contracts/expression-sheet-ui.md).
 *
 * **배치**: 선택 위에 떠 있는 말풍선이 아니라 스크립트 블록 바로 아래에 붙는 고정
 * 영역이다. 모바일에서 길게 눌러 고르면 브라우저가 자체 복사·공유 메뉴를 선택 위에
 * 띄우므로 그 위치의 버튼은 가려진다. 브라우저 기본 메뉴의 위치는 통제할 수 없어 애초에
 * 겹치지 않는 곳에 둔다 (R-006).
 */
export default function ExpressionSheet({
  selection,
  draft,
  duplicateOf,
  storageStatus,
  saveError,
  savedTerm,
  onStart,
  onTermChange,
  onMeaningChange,
  onSave,
  onCancel,
}: ExpressionSheetProps) {
  const inputId = useId();
  const TERM_INPUT_ID = `${inputId}-term`;
  const MEANING_INPUT_ID = `${inputId}-meaning`;
  const isUnavailable = storageStatus === "unavailable";

  // 초안 있음 → 초안 편집. 초안 없고 선택 유효 → 저장 시작 수단.
  // 둘 다 없으면 완료 표시만 남고, 그것도 없으면 아무것도 렌더링하지 않는다 (FR-004).
  if (!draft && !selection) {
    if (!savedTerm) return null;
    return (
      <div className="expression-sheet">
        <p className="expression-sheet-done" role="status">
          ✓ <b>{savedTerm}</b> 을(를) 카드에 저장했어요
        </p>
      </div>
    );
  }

  if (!draft && selection) {
    return (
      <div className="expression-sheet">
        <div className="expression-sheet-preview">
          <span>고른 표현</span>
          <p>{selection.text}</p>
        </div>
        {/* 저장소를 쓸 수 없어도 시도는 막지 않는다. 막으면 설정이 바뀌어도 새로고침
            없이는 다시 저장할 수 없다 (use-expressions 조항 8). */}
        {isUnavailable && (
          <p className="expression-sheet-notice">{SAVE_FAILURE_MESSAGE["storage-unavailable"]}</p>
        )}
        <button className="save-button" onClick={onStart}>
          이 표현 저장하기
        </button>
      </div>
    );
  }

  if (!draft) return null;

  /**
   * 저장 버튼이 비활성일 때 이유가 화면에 문구로 보여야 한다. `title` 속성만으로는
   * 모바일에서 읽을 수 없다 (계약 조항 3, FR-008).
   */
  const blockedReason: SaveFailure | null = !isValidTerm(draft.term)
    ? "invalid-term"
    : !isValidMeaning(draft.meaning)
      ? "invalid-meaning"
      : duplicateOf
        ? "duplicate"
        : null;

  // 실제 저장 시도가 실패했으면 그 이유가 우선한다 (쓰기 시점에만 드러나는 실패가 있다).
  // 저장소를 쓸 수 없다는 안내는 보여주되 저장 버튼을 막지는 않는다 (조항 8).
  const notice = saveError ?? blockedReason ?? (isUnavailable ? "storage-unavailable" : null);

  return (
    <div className="expression-sheet">
      <div className="expression-sheet-fields">
        <label htmlFor={TERM_INPUT_ID}>표현</label>
        {/* 고른 글자로 채워지되 사용자가 고칠 수 있다. 범위를 조금 넓게 골랐을 때
            다시 고르러 돌아가지 않아도 된다 (FR-002a, FR-009). */}
        <input
          id={TERM_INPUT_ID}
          value={draft.term}
          onChange={(event) => onTermChange(event.target.value)}
          autoComplete="off"
        />

        <label htmlFor={MEANING_INPUT_ID}>뜻</label>
        {/* 뜻은 사용자가 직접 적는다 (FR-007). 자동 번역은 이 기능의 범위가 아니다. */}
        {/* 저장을 시작하면 누른 버튼이 사라지므로 포커스를 여기로 옮긴다. 옮기지 않으면
            포커스가 body 로 빠진다 (계약 조항 10). */}
        <input
          id={MEANING_INPUT_ID}
          autoFocus
          value={draft.meaning}
          onChange={(event) => onMeaningChange(event.target.value)}
          placeholder="이 표현의 뜻을 적어주세요"
          autoComplete="off"
        />
      </div>

      {/* 예문은 보여주기만 하고 고칠 수 없다. "실제로 이렇게 들었다"는 기록이므로
          고치면 근거가 사라진다 (계약 조항 2). */}
      <div className="expression-sheet-example">
        <span>예문</span>
        <p>{draft.example}</p>
        <small>↳ {draft.sourceRoom}</small>
      </div>

      {notice && <p className="expression-sheet-notice">{SAVE_FAILURE_MESSAGE[notice]}</p>}

      <div className="expression-sheet-actions">
        <button onClick={onCancel}>취소</button>
        <button className="save-button" onClick={onSave} disabled={blockedReason !== null}>
          카드에 저장
        </button>
      </div>
    </div>
  );
}
