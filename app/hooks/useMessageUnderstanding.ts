"use client";

import { useEffect, useRef, useState } from "react";
import { INITIAL_UNDERSTANDING, isRefinementResult, isResultSource, type LearningLanguage, type MessageUnderstandingState, type RefinementState, type UnderstandingErrorCode, type UnderstandingState } from "../lib/understanding";
import type { VoiceMessage } from "../lib/types";

type Kind = "transcript" | "translation" | "refinement";
const ERROR_CODES: UnderstandingErrorCode[] = ["invalid-input", "too-large", "unsupported-format", "failed", "timeout", "limit", "network"];

/** 메시지처럼 셸에서 소유하여 화면 열기와 요청 수명을 분리한다. */
export function useMessageUnderstanding() {
  const [states, setStates] = useState<Record<string, MessageUnderstandingState>>({});
  const statesRef = useRef(states);
  const pending = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current.forEach((controller) => controller.abort());
      pending.current.clear();
    };
  }, []);

  function update(id: string, kind: Kind, state: UnderstandingState | RefinementState) {
    const current = statesRef.current[id] ?? INITIAL_UNDERSTANDING;
    // kind와 state는 같은 요청 분기에서 구성한다.
    const next = { ...statesRef.current, [id]: { ...current, [kind]: state } as MessageUnderstandingState };
    statesRef.current = next;
    if (mounted.current) setStates(next);
  }

  async function request(message: VoiceMessage, language: LearningLanguage, kind: Kind, retry = false) {
    if (message.source !== "recorded" || !message.url) return;
    if (kind === "refinement" && message.sender !== "me") return;
    const current = statesRef.current[message.id] ?? INITIAL_UNDERSTANDING;
    const state = current[kind];
    const key = `${message.id}:${kind}`;
    if (pending.current.has(key) || ((state.status === "success" || state.status === "unchanged") && !(retry && kind === "transcript"))
      || (!retry && state.status !== "idle")) return;
    if (kind !== "transcript" && current.transcript.status !== "success") return;

    const controller = new AbortController();
    pending.current.set(key, controller);
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 40_000);
    if (kind === "transcript") {
      for (const dependent of ["translation", "refinement"] as const) {
        const dependentKey = `${message.id}:${dependent}`;
        pending.current.get(dependentKey)?.abort();
        pending.current.delete(dependentKey);
        update(message.id, dependent, { status: "idle" });
      }
    }
    update(message.id, kind, { status: "pending" });
    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (kind === "transcript") {
        const voiceResponse = await fetch(message.url, { signal: controller.signal });
        if (!voiceResponse.ok) throw new Error("voice-unavailable");
        const voice = await voiceResponse.blob();
        const form = new FormData();
        form.set("voice", voice, "recording");
        form.set("language", language);
        body = form;
      } else {
        if (current.transcript.status !== "success") return;
        body = JSON.stringify({ transcript: current.transcript.result.text, source: current.transcript.result.source, language });
        headers = { "Content-Type": "application/json" };
      }
      const response = await fetch(`/api/${kind}`, { method: "POST", body, headers, signal: controller.signal, cache: "no-store" });
      const data: unknown = await response.json();
      // 삭제한 메시지나 이전 요청의 응답으로 상태를 복원하지 않는다.
      if (pending.current.get(key) !== controller || !mounted.current) return;
      if (kind === "refinement" && data && typeof data === "object" && "ok" in data && data.ok === true && response.ok
        && "result" in data && isRefinementResult(data.result)) {
        const result = { ...data.result, refinedSentence: data.result.refinedSentence.trim(), reason: data.result.reason.trim() };
        if (current.transcript.status !== "success" || result.changed !== (result.refinedSentence !== current.transcript.result.text)) {
          update(message.id, kind, { status: "failed", code: "failed" });
        } else {
          update(message.id, kind, { status: result.changed ? "success" : "unchanged", result });
        }
      } else if (kind !== "refinement" && data && typeof data === "object" && "ok" in data && data.ok === true && response.ok
        && "result" in data && data.result && typeof data.result === "object"
        && "text" in data.result && typeof data.result.text === "string"
        && "source" in data.result && isResultSource(data.result.source)) {
        const result = { text: data.result.text.trim(), source: data.result.source };
        update(message.id, kind, { status: result.text ? "success" : "empty", result });
      } else {
        let code: UnderstandingErrorCode = response.status === 429 ? "limit" : response.status === 504 ? "timeout" : "failed";
        if (data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object"
          && "code" in data.error && ERROR_CODES.includes(data.error.code as UnderstandingErrorCode)) code = data.error.code as UnderstandingErrorCode;
        update(message.id, kind, { status: code === "timeout" || code === "limit" || code === "network" ? code : "failed", code });
      }
    } catch (error) {
      if (pending.current.get(key) !== controller || !mounted.current) return;
      const status = timedOut ? "timeout" : error instanceof TypeError ? "network" : "failed";
      update(message.id, kind, { status, code: status });
    } finally {
      window.clearTimeout(timer);
      if (pending.current.get(key) === controller) pending.current.delete(key);
    }
  }

  function remove(ids: string[]) {
    const next = { ...statesRef.current };
    for (const id of ids) {
      for (const kind of ["transcript", "translation", "refinement"] as const) {
        const key = `${id}:${kind}`;
        pending.current.get(key)?.abort();
        pending.current.delete(key);
      }
      delete next[id];
    }
    statesRef.current = next;
    setStates(next);
  }

  return { states, request, remove };
}
export type UseMessageUnderstandingResult = ReturnType<typeof useMessageUnderstanding>;
