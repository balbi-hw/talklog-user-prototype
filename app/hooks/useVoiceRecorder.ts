"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyMicError, isRecordingSupported, pickMimeType } from "../lib/audio";
import type { MicrophoneStatus, RecordingState, StopReason } from "../lib/types";

/**
 * 전송되는 녹음. url 의 소유권이 호출자에게 넘어가므로 훅은 revoke 하지 않는다.
 * mimeType 은 담지 않는다 — VoiceMessage 에 해당 필드가 없어 버려진다 (analyze F1).
 */
export type SentRecording = {
  url: string;
  durationMs: number;
};

export type UseVoiceRecorderOptions = {
  maxDurationMs?: number;
  minDurationMs?: number;
  onSend: (recording: SentRecording) => void;
};

export type UseVoiceRecorderResult = {
  state: RecordingState;
  micStatus: MicrophoneStatus;
  elapsedMs: number;
  stopReason: StopReason | null;
  sendable: boolean;
  previewUrl: string | null;
  hasPending: boolean;
  start: () => void;
  stop: () => void;
  retake: () => void;
  send: () => void;
  cancel: () => void;
  discard: () => void;
};

/**
 * 녹음 상태 머신과 마이크 장치 제어 (contracts/use-voice-recorder.md).
 * 전이 번호는 data-model.md §4 의 T1~T15 표를 가리킨다.
 */
export function useVoiceRecorder({
  maxDurationMs = 60_000,
  minDurationMs = 1_000,
  onSend,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [state, setState] = useState<RecordingState>("idle");
  const [micStatus, setMicStatus] = useState<MicrophoneStatus>("unknown");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blobSize, setBlobSize] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  // research.md R-003: 인터벌 카운터를 누적하지 않고 시작 시각과의 차이로 계산한다.
  const startedAtRef = useRef(0);
  const stopReasonRef = useRef<StopReason>("user");

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * research.md R-005: 녹음이 끝나는 모든 경로에서 트랙을 멈춰야 한다.
   * 멈추지 않으면 사용자는 녹음이 끝났다고 인식하는데 탭의 마이크 표시가 계속 켜져 있다.
   */
  const releaseDevice = useCallback(() => {
    clearTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, [clearTimer]);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  /** T7 · T10 · T13 — 진행 중인 녹음과 전송 전 녹음을 모두 버리고 idle 로 돌아간다. */
  const reset = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      // onstop 을 떼야 review 로 전이하지 않는다.
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    releaseDevice();
    revokePreview();
    chunksRef.current = [];
    setElapsedMs(0);
    setBlobSize(0);
    setStopReason(null);
    setState("idle");
  }, [releaseDevice, revokePreview]);

  /** T1 → T2 / T3, T15(다시 시도) */
  const start = useCallback(async () => {
    // contracts 조항 1: unsupported 에서는 아무 일도 하지 않는다.
    if (micStatus === "unsupported") return;
    if (!isRecordingSupported()) {
      setMicStatus("unsupported");
      setState("blocked");
      return;
    }

    revokePreview();
    chunksRef.current = [];
    setElapsedMs(0);
    setBlobSize(0);
    setStopReason(null);
    setState("requesting");
    setMicStatus("requesting");

    try {
      // FR-017: 첫 녹음 시도 시에만 권한을 요청한다. Permissions API 는 쓰지 않는다 (R-002).
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      // T4 / T5 — 사용자 종료와 60초 자동 종료가 같은 경로로 review 에 도달한다.
      recorder.onstop = () => {
        const durationMs = performance.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        releaseDevice();

        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setBlobSize(blob.size);
        setElapsedMs(durationMs);
        setStopReason(stopReasonRef.current);
        setState("review");
      };

      startedAtRef.current = performance.now();
      stopReasonRef.current = "user";
      recorder.start();
      setMicStatus("granted");
      setState("recording");

      // 인터벌은 화면 갱신 트리거이자 60초 상한 감시용이다 (R-006).
      intervalRef.current = window.setInterval(() => {
        const ms = performance.now() - startedAtRef.current;
        if (ms >= maxDurationMs) {
          stopReasonRef.current = "limit";
          clearTimer();
          const current = recorderRef.current;
          if (current && current.state !== "inactive") current.stop();
          return;
        }
        setElapsedMs(ms);
      }, 1000);
    } catch (error) {
      releaseDevice();
      setMicStatus(classifyMicError(error));
      setState("blocked");
    }
  }, [micStatus, maxDurationMs, clearTimer, releaseDevice, revokePreview]);

  /** T4 */
  const stop = useCallback(() => {
    if (state !== "recording") return;
    stopReasonRef.current = "user";
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, [state, clearTimer]);

  // FR-010 / R-007: 음량을 분석하지 않고 길이와 크기로만 판정한다.
  const sendable = state === "review" && elapsedMs >= minDurationMs && blobSize > 0;

  /** T11 (sendable) / T12 (그 외 — onSend 를 호출하지 않는다) */
  const send = useCallback(() => {
    if (!sendable) return;
    const url = previewUrlRef.current;
    if (!url) return;

    // contracts 조항 4: URL 소유권이 호출자로 넘어가므로 revoke 하지 않는다.
    previewUrlRef.current = null;
    setPreviewUrl(null);
    onSend({ url, durationMs: elapsedMs });

    chunksRef.current = [];
    setElapsedMs(0);
    setBlobSize(0);
    setStopReason(null);
    setState("idle");
  }, [sendable, elapsedMs, onSend]);

  /** T10 — 이전 녹음을 버리고 곧바로 다시 녹음한다. */
  const retake = useCallback(() => {
    reset();
    void start();
  }, [reset, start]);

  // T8 — 언마운트 시 장치·타이머·URL 을 모두 정리한다 (R-005).
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  return {
    state,
    micStatus,
    elapsedMs,
    stopReason,
    sendable,
    previewUrl,
    hasPending: state === "recording" || state === "review",
    start: () => void start(),
    stop,
    retake,
    send,
    cancel: reset,
    discard: reset,
  };
}
