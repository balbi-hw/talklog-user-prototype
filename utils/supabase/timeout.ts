/**
 * 서버 쪽 Supabase 호출의 시간 상한 (원칙 V, 009 FR-007).
 * 요청 하나는 fetch 를 끊고, 재시도를 포함한 호출 전체는 deadline 으로 끊는다.
 */

/** 미들웨어는 모든 페이지·API 앞에 서므로 짧게 둔다. 넘으면 세션 갱신 없이 지나간다. */
export const MIDDLEWARE_TIMEOUT_MS = 3_000;
/** 확인 링크 처리. 넘으면 확인 실패로 알린다. */
export const CONFIRM_TIMEOUT_MS = 10_000;

export const timedFetch = (ms: number): typeof fetch => (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(ms) });

export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("deadline exceeded")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
