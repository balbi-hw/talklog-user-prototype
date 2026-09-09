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

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => setPositionMs(audio.currentTime * 1000);
    const handleEnded = () => {
      // FR-015: 재생이 끝나면 초기 상태로 되돌린다.
      setActiveId(null);
      setPositionMs(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
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
      setDurationMs(nextDurationMs);
      setPositionMs(0);
      setActiveId(id);
      void audio.play().catch(() => {
        setActiveId(null);
      });
    },
    [activeId, stop],
  );

  // research.md R-003: audio.duration 은 Infinity 일 수 있어 분모로 쓰지 않는다.
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  return { activeId, positionMs, durationMs, progress, toggle, stop };
}
