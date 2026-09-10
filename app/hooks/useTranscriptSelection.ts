"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isValidTerm } from "../lib/expressions";
import type { RefObject } from "react";

/** specs/002-expression-capture/contracts/use-transcript-selection.md */
export type TranscriptSelection = {
  text: string;
  example: string;
  sourceRoom: string;
};

export type UseTranscriptSelectionOptions = {
  transcriptRef: RefObject<HTMLElement | null>;
  /** 그 스크립트의 전체 텍스트 (FR-010) */
  example: string;
  /** 그 스크립트가 속한 학습방 (FR-011) */
  sourceRoom: string;
  /** 스크립트가 열려 있는지 (FR-006) */
  enabled: boolean;
};

export type UseTranscriptSelectionResult = {
  /** 유효 조건 4개를 모두 만족하지 않으면 null (data-model.md §3) */
  selection: TranscriptSelection | null;
  clear: () => void;
};

/**
 * 스크립트 요소 안에서 일어난 글자 선택만 읽는다. UI 를 렌더링하지 않고 저장소를 다루지
 * 않으며 초안을 만들지 않는다 — 초안 생성은 호출자의 몫이다 (조항 9).
 *
 * **입력 수단으로 분기하지 않는다.** 마우스 드래그 · 터치 롱프레스 · `Shift`+방향키가
 * 모두 같은 경로로 처리된다. `Selection` 이 세 입력을 똑같이 노출하므로 이것이 별도 UI
 * 없이 FR-028 을 충족하는 방식이다 (R-002, 조항 6).
 */
export function useTranscriptSelection({
  transcriptRef,
  example,
  sourceRoom,
  enabled,
}: UseTranscriptSelectionOptions): UseTranscriptSelectionResult {
  const [text, setText] = useState<string | null>(null);

  const read = useCallback(() => {
    // enabled 가 false 면 항상 null 이다 (조항 3, FR-006).
    if (!enabled) {
      setText(null);
      return;
    }

    const element = transcriptRef.current;
    if (!element) {
      setText(null);
      return;
    }

    const selection = window.getSelection();
    // 조건 1: 선택이 접힌 상태가 아니다 (FR-004).
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setText(null);
      return;
    }

    // 조건 2: 선택이 스크립트 요소 안에서 일어났다 (R-001, 조항 2).
    // 화면의 다른 텍스트(학습 짝 이름, 번역, 안내 문구)를 골랐을 때 저장 수단이
    // 나타나서는 안 된다.
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) {
      setText(null);
      return;
    }

    // 조건 3·4: trim() 후 1자 이상이고 문자·숫자를 하나 이상 포함한다 (FR-005).
    const trimmed = selection.toString().trim();
    if (!isValidTerm(trimmed)) {
      setText(null);
      return;
    }

    setText(trimmed);
  }, [enabled, transcriptRef]);

  useEffect(() => {
    if (!enabled) {
      setText(null);
      return;
    }

    // selectionchange 만으로는 브라우저 사이 발생 시점이 달라 놓치는 경우가 있다.
    // 세 이벤트가 모두 같은 읽기 함수를 부르므로 어느 쪽이 먼저 와도 결과가 같다
    // (R-001, 조항 5).
    document.addEventListener("selectionchange", read);
    document.addEventListener("pointerup", read);
    document.addEventListener("keyup", read);

    return () => {
      document.removeEventListener("selectionchange", read);
      document.removeEventListener("pointerup", read);
      document.removeEventListener("keyup", read);
    };
  }, [enabled, read]);

  /** 브라우저 선택도 함께 해제한다 (조항 7). */
  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setText(null);
  }, []);

  const selection = useMemo(
    () => (text === null ? null : { text, example, sourceRoom }),
    [text, example, sourceRoom],
  );

  return { selection, clear };
}
