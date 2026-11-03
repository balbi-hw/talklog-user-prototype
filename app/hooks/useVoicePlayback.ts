"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 전송 전 미리 듣기가 쓰는 예약 식별자.
 * contracts/use-voice-playback.md 조항 7 — 훅은 이 값을 특별 취급하지 않는다.
 */
export const PREVIEW_ID = "__preview__";

export type UseVoicePlaybackResult = {
  activeId: string | null;
  positionMs: number;
  durationMs: number;
  progress: number;
  /** 011: 마지막으로 재생하지 못한 대상. 다시 재생을 시작하면 지운다. */
  failedId: string | null;
  toggle: (id: string, url: string, durationMs: number) => void;
  stop: () => void;
};

/**
 * 대화 전체의 재생을 조율한다 (contracts/use-voice-playback.md).
 *
 * HTMLAudioElement 인스턴스를 하나만 소유하고 재생 대상이 바뀔 때 src를 교체하므로
 * "새 재생이 이전 재생을 멈춘다"(FR-012)가 구조적으로 보장된다 — 화면에서 모든
 * 메시지를 순회해 멈출 필요가 없다 (research.md R-004).
 */
export function useVoicePlayback(): UseVoicePlaybackResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [failedId, setFailedId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => setPositionMs(audio.currentTime * 1000);
    const handleEnded = () => {
      // FR-015: 재생이 끝나면 초기 상태로 되돌린다.
      setActiveId(null);
      setPositionMs(0);
    };

    // 소리를 받아 오지 못하면(서명 주소 만료, 연결 끊김) 재생 실패로 알린다.
    const handleError = () => {
      if (!audio.getAttribute("src")) return;
      setFailedId(currentIdRef.current);
      setActiveId(null);
      setPositionMs(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setActiveId(null);
    setPositionMs(0);
  }, []);

  const toggle = useCallback(
    (id: string, url: string, nextDurationMs: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      // 같은 대상을 다시 누르면 멈춘다.
      if (activeId === id) {
        stop();
        return;
      }

      // 다른 대상이면 이전 재생을 멈추고 새 대상을 처음부터 재생한다 (FR-012).
      audio.pause();
      audio.src = url;
      currentIdRef.current = id;
      setFailedId(null);
      setDurationMs(nextDurationMs);
      setPositionMs(0);
      setActiveId(id);
      void audio.play().catch((error: unknown) => {
        setActiveId(null);
        // 다른 대상으로 바뀌며 끊긴 재생(AbortError)은 실패가 아니다.
        if (currentIdRef.current === id && !(error instanceof DOMException && error.name === "AbortError")) setFailedId(id);
      });
    },
    [activeId, stop],
  );

  // research.md R-003: audio.duration 은 Infinity 일 수 있어 분모로 쓰지 않는다.
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return { activeId, positionMs, durationMs, progress, failedId, toggle, stop };
}
