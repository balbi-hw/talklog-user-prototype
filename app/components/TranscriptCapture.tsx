"use client";

import { useRef, useState } from "react";
import { useTranscriptSelection } from "../hooks/useTranscriptSelection";
import type { UseExpressionsResult } from "../hooks/useExpressions";
import type { ExpressionDraft, SaveFailure } from "../lib/types";
import ExpressionSheet from "./ExpressionSheet";

export type TranscriptSaving = {
  storageStatus: UseExpressionsResult["status"];
  findDuplicate: UseExpressionsResult["findDuplicate"];
  onSaveExpression: UseExpressionsResult["save"];
};

/** 002 선택·저장 경로를 스크립트마다 재사용한다. */
export default function TranscriptCapture({ text, sourceRoom, label = "스크립트", storageStatus, findDuplicate, onSaveExpression }: {
  text: string; sourceRoom: string; label?: string;
} & TranscriptSaving) {
  const transcriptRef = useRef<HTMLParagraphElement>(null);
  const [draft, setDraft] = useState<ExpressionDraft | null>(null);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const [savedTerm, setSavedTerm] = useState<string | null>(null);
  const { selection, clear } = useTranscriptSelection({ transcriptRef, example: text, sourceRoom, enabled: true });
  const returnFocus = () => {
    clear();
    transcriptRef.current?.focus({ preventScroll: true });
  };
  return <>
    <p ref={transcriptRef} className="transcript" tabIndex={0}
      aria-label={`${label}. 배우고 싶은 부분을 골라 표현으로 저장할 수 있어요`}>{text}</p>
    <ExpressionSheet
      selection={selection} draft={draft} duplicateOf={draft ? findDuplicate(draft.term) : null}
      storageStatus={storageStatus} saveError={saveError} savedTerm={savedTerm}
      onStart={() => {
        if (!selection) return;
        setDraft({ term: selection.text, meaning: "", example: selection.example, sourceRoom: selection.sourceRoom });
        setSaveError(null); setSavedTerm(null);
      }}
      onTermChange={(term) => { setDraft((value) => value ? { ...value, term } : null); setSaveError(null); }}
      onMeaningChange={(meaning) => { setDraft((value) => value ? { ...value, meaning } : null); setSaveError(null); }}
      onCancel={() => { setDraft(null); setSaveError(null); returnFocus(); }}
      onSave={() => {
        if (!draft) return;
        const result = onSaveExpression(draft);
        if (!result.ok) { setSaveError(result.reason); return; }
        setSavedTerm(result.saved.term); setDraft(null); setSaveError(null); returnFocus();
      }}
    />
  </>;
}
