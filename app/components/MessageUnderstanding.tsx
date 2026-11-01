"use client";

import { useId, useState } from "react";
import type { UseMessageUnderstandingResult } from "../hooks/useMessageUnderstanding";
import { INITIAL_UNDERSTANDING, UNDERSTANDING_NOTICE, type LearningLanguage, type UnderstandingState } from "../lib/understanding";
import { roomName, type Room } from "../lib/rooms";
import type { VoiceMessage } from "../lib/types";
import TranscriptCapture, { type TranscriptSaving } from "./TranscriptCapture";

const LANGUAGE_CODE: Record<Room["language"], LearningLanguage> = { "일본어": "ja", "영어": "en", "중국어": "zh" };

export default function MessageUnderstanding({ message, room, understanding, ...saving }: {
  message: VoiceMessage; room: Room; understanding: UseMessageUnderstandingResult;
} & TranscriptSaving) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const [retrying, setRetrying] = useState({ transcript: false, translation: false });
  const id = useId();
  const state = understanding.states[message.id] ?? INITIAL_UNDERSTANDING;
  const language = LANGUAGE_CODE[room.language];
  const run = (kind: "transcript" | "translation" | "refinement", retry = false) => {
    void understanding.request(message, language, kind, retry);
  };
  function detail(kind: "transcript" | "translation", value: UnderstandingState) {
    const retryVisible = retrying[kind] || !["idle", "pending", "success"].includes(value.status);
    return <div className={`message-details understanding-detail ${kind === "translation" ? "translation-detail" : ""}`}>
      <span>{kind === "transcript" ? "스크립트" : "번역"}</span>
      <p className="understanding-status" role="status">{UNDERSTANDING_NOTICE[value.status]}</p>
      {(value.status === "success" || value.status === "empty") && <>
        <p className="understanding-source">{value.result.source === "mock"
          ? "예시 · 실제 음성을 분석한 내용이 아니에요. 예시 입력이나 개발용 고정 내용일 수 있어요."
          : "실제 결과"}</p>
        {value.status === "success" && (kind === "transcript"
          ? <TranscriptCapture text={value.result.text} sourceRoom={roomName(room)} {...saving} />
          : <p lang="ko">{value.result.text}</p>)}
      </>}
      {retryVisible && <button className="understanding-retry" disabled={value.status === "pending" || value.status === "success"}
        onClick={() => { setRetrying((current) => ({ ...current, [kind]: true })); run(kind, true); }}>
        다시 시도
      </button>}
    </div>;
  }

  return <div className="message-understanding">
    <p className="understanding-disclosure">스크립트·번역·문장 다듬기를 위해 음성·텍스트가 외부 제공자에 전송될 수 있어요. 앱은 학습·평가용으로 보관하지 않아요.</p>
    <div className="detail-toggles">
      <button className={showTranscript ? "active" : ""} aria-expanded={showTranscript} aria-controls={`${id}-transcript`}
        onClick={() => { const next = !showTranscript; setShowTranscript(next); if (next) run("transcript"); }}>스크립트 {showTranscript ? "⌃" : "⌄"}</button>
      <button className={showTranslation ? "active" : ""} aria-expanded={showTranslation} aria-controls={`${id}-translation`}
        disabled={state.transcript.status !== "success"} aria-describedby={state.transcript.status !== "success" ? `${id}-hint` : undefined}
        onClick={() => { const next = !showTranslation; setShowTranslation(next); if (next) run("translation"); }}>번역 {showTranslation ? "⌃" : "⌄"}</button>
      <button className={showRefinement ? "active" : ""} aria-expanded={showRefinement} aria-controls={`${id}-refinement`}
        disabled={state.transcript.status !== "success"} aria-describedby={state.transcript.status !== "success" ? `${id}-hint` : undefined}
        onClick={() => { const next = !showRefinement; setShowRefinement(next); if (next) run("refinement"); }}>문장 다듬기 {showRefinement ? "⌃" : "⌄"}</button>
    </div>
    {state.transcript.status !== "success" && <p className="understanding-hint" id={`${id}-hint`}>스크립트를 먼저 열어 준비한 뒤 번역하거나 문장을 다듬을 수 있어요.</p>}
    <div id={`${id}-transcript`} hidden={!showTranscript}>{showTranscript && detail("transcript", state.transcript)}</div>
    <div id={`${id}-translation`} hidden={!showTranslation}>{showTranslation && detail("translation", state.translation)}</div>
    <div id={`${id}-refinement`} hidden={!showRefinement}>
      {showRefinement && <div className="message-details understanding-detail">
        <span>다듬은 문장</span>
        <p className="understanding-status" role="status">{state.refinement.status === "unchanged"
          ? "그대로도 자연스러워요. 바꿀 것이 없어요."
          : UNDERSTANDING_NOTICE[state.refinement.status]}</p>
        {(state.refinement.status === "success" || state.refinement.status === "unchanged") && <>
          <p className="understanding-source">{state.refinement.result.source === "mock"
            ? "예시 · 실제 문장을 분석한 내용이 아니에요. 예시 입력이나 개발용 고정 내용일 수 있어요."
            : "실제 결과"}</p>
          <TranscriptCapture key={state.refinement.result.refinedSentence} text={state.refinement.result.refinedSentence}
            label="다듬은 문장" sourceRoom={roomName(room)} {...saving} />
          <p lang="ko">{state.refinement.result.reason}</p>
        </>}
        {!["idle", "pending", "success", "unchanged"].includes(state.refinement.status) && <button className="understanding-retry"
          disabled={state.transcript.status !== "success"} onClick={() => run("refinement", true)}>다시 시도</button>}
      </div>}
    </div>
  </div>;
}
