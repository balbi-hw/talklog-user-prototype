import "server-only";
import type { UnderstandingErrorCode, UnderstandingResponse, UnderstandingResult } from "../../understanding";

export const MAX_VOICE_BYTES = 8 * 1024 * 1024;
export class UnderstandingError extends Error {
  constructor(readonly code: UnderstandingErrorCode) { super(code); }
}
const HTTP_STATUS: Record<UnderstandingErrorCode, number> = {
  "invalid-input": 400, "too-large": 413, "unsupported-format": 415,
  failed: 502, timeout: 504, limit: 429, network: 503,
};
export function checkUpstream(response: Response) {
  if (response.ok) return;
  throw new UnderstandingError(response.status === 429 || response.status === 402 ? "limit"
    : response.status === 408 || response.status === 504 ? "timeout" : "failed");
}

/** Content-Length가 없거나 거짓이어도 파싱 전에 메모리 사용 상한을 지킨다. */
export async function readBounded(request: Request, maximum: number): Promise<Blob> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maximum) throw new UnderstandingError("too-large");
  if (!request.body) throw new UnderstandingError("invalid-input");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new UnderstandingError("too-large");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  // Blob.type은 소문자로 바뀌어 multipart boundary가 본문과 어긋난다. 형식은 원래 헤더로 넘긴다.
  return new Blob(chunks);
}

// 전역 제한: 임의의 IP 헤더를 신뢰하지 않는다. 단일 프로세스에서만 유효하다.
let windowStart = Date.now();
let count = 0;
let active = 0;
export async function handleUnderstanding(request: Request, work: (signal: AbortSignal) => Promise<UnderstandingResult>): Promise<Response> {
  if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); count = 0; }
  if (count >= 20 || active >= 4) return respond({ ok: false, error: { code: "limit" } }, 429);
  count += 1;
  active += 1;
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new UnderstandingError("timeout"));
      }, 30_000);
    });
    const result = await Promise.race([work(controller.signal), deadline]);
    return respond({ ok: true, result: { text: result.text.trim(), source: result.source } }, 200);
  } catch (error) {
    const code = timedOut ? "timeout" : error instanceof UnderstandingError ? error.code
      : error instanceof TypeError ? "network" : "failed";
    return respond({ ok: false, error: { code } }, HTTP_STATUS[code]);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    active -= 1;
  }
}
function respond(body: UnderstandingResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
