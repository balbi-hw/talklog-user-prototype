/**
 * 학습 기록을 어디에 두는지 (specs/010-account-records/data-model.md §1).
 *
 * - `pending`: 로그인 여부를 아직 모른다. 화면은 loading 으로 기다린다 — 기기 기록을 잠깐 보여 줬다가
 *   계정 기록으로 바꾸면 사용자는 기록이 바뀌었다고 오해한다.
 * - `device`: 로그아웃 상태 또는 로그인을 쓸 수 없는 환경. 지금까지와 같은 `talklog.*` 키.
 * - `account`: 로그인 상태. 계정별 로컬 사본(`talklog.account.<id>.*`)에 쓰고 서버로 보낸다.
 *   `loaded` 가 false 면 서버에서 아직 받아 오지 못했으므로 읽기를 실패로 다룬다 (빈 목록으로 보이면 안 된다).
 */
export type RecordCollection = "rooms" | "expressions" | "reviews";

export type RecordScope =
  | { kind: "pending" }
  | { kind: "device" }
  | { kind: "account"; userId: string; loaded: boolean };

export const DEVICE_KEYS: Record<RecordCollection, string> = {
  rooms: "talklog.rooms",
  expressions: "talklog.expressions",
  reviews: "talklog.reviews",
};

export const RECORD_COLLECTIONS: readonly RecordCollection[] = ["rooms", "expressions", "reviews"];

export const accountPrefix = (userId: string) => `talklog.account.${userId}.`;
export const accountKey = (userId: string, name: string) => `${accountPrefix(userId)}${name}`;

let scope: RecordScope = { kind: "pending" };
const listeners = new Set<() => void>();

/** 계정 범위의 쓰기를 서버 대기열로 넘기는 곳. 순환 참조를 피하려고 sync 모듈이 등록한다. */
type WriteListener = (userId: string, collection: RecordCollection, previous: unknown[], next: unknown[]) => void;
let writeListener: WriteListener | null = null;
let readFailureListener: ((userId: string) => void) | null = null;

export function getRecordScope(): RecordScope {
  return scope;
}

export function setRecordScope(next: RecordScope) {
  const same = scope.kind === next.kind &&
    (scope.kind !== "account" || next.kind !== "account" || (scope.userId === next.userId && scope.loaded === next.loaded));
  if (same) return;
  scope = next;
  listeners.forEach((listener) => listener());
}

/** 범위가 바뀌거나 서버에서 새 기록을 받으면 호출된다. 훅은 다시 읽는다. */
export function subscribeRecordScope(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyRecordsChanged() {
  listeners.forEach((listener) => listener());
}

/**
 * 화면이 기록을 읽어도 되는지. 로그인 여부를 모르거나 계정 기록을 아직 받아 오지 못했으면 false 다.
 * 이때 화면은 이전 범위(기기)의 목록을 남기지 말고 받아 오는 중으로 보여야 한다 (FR-003).
 */
export function isRecordScopeReady(): boolean {
  return scope.kind === "device" || (scope.kind === "account" && scope.loaded);
}

/**
 * 지금 범위에서 그 기록을 읽고 쓸 키. null 은 지금 읽을 수 없다는 뜻이다
 * (범위 미정, 또는 계정 기록을 아직 받아 오지 못함).
 */
export function recordKey(collection: RecordCollection): string | null {
  if (scope.kind === "device") return DEVICE_KEYS[collection];
  if (scope.kind === "account" && scope.loaded) return accountKey(scope.userId, collection);
  if (scope.kind === "account") readFailureListener?.(scope.userId);
  return null;
}

/** storage 이벤트가 지금 범위의 그 기록에 대한 것인지. */
export function isRecordKey(key: string | null, collection: RecordCollection): boolean {
  if (key === null) return true;
  return key === recordKey(collection);
}

export function registerRecordSync(onWrite: WriteListener, onReadFailure: (userId: string) => void) {
  writeListener = onWrite;
  readFailureListener = onReadFailure;
}

/**
 * 지금 범위에 기록 전체를 쓴다. 성공 여부를 돌려주고 예외를 던지지 않는다.
 * 계정 범위면 저장돼 있던 값과 비교해 서버로 보낼 변경을 남긴다.
 */
export function writeRecords<T>(collection: RecordCollection, next: T[]): boolean {
  const key = recordKey(collection);
  if (key === null) return false;
  let previous: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (Array.isArray(parsed)) previous = parsed;
  } catch {
    // 깨진 값은 빈 목록으로 본다. 쓰기 자체는 아래에서 성공 여부를 판정한다.
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    return false;
  }
  if (scope.kind === "account") writeListener?.(scope.userId, collection, previous, next);
  return true;
}

/** 지금 범위의 원본 문자열. 키가 없으면 `{ ok: false }`. */
export function readRaw(collection: RecordCollection): { ok: true; raw: string | null } | { ok: false } {
  const key = recordKey(collection);
  if (key === null) return { ok: false };
  try {
    return { ok: true, raw: window.localStorage.getItem(key) };
  } catch {
    return { ok: false };
  }
}
