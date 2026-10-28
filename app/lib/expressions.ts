// specs/002-expression-capture/contracts/use-expressions.md 조항 9 · 11 · 12
// research.md R-003 · R-005
//
// 저장소 접근과 순수 함수만 둔다. 상태 관리는 useExpressions 의 몫이다.

import type { ExpressionUpdate, SaveFailure, SavedExpression, UpdateFailure } from "./types";

/**
 * 실패 이유별 화면 문구 (contracts/expression-sheet-ui.md 조항 4).
 *
 * 이유마다 서로 다른 문구여야 한다 — 같은 문구로 합치면 사용자가 무엇을 해야 할지 알
 * 수 없다. 저장 수단과 Feedback 화면이 같은 저장 경로를 쓰므로(E13) 문구도 한 곳에 둔다.
 */
export const SAVE_FAILURE_MESSAGE: Record<SaveFailure, string> = {
  "invalid-term": "표현을 적어주세요",
  "invalid-meaning": "뜻을 적어주세요",
  duplicate: "이미 저장한 표현이에요",
  "storage-unavailable": "이 브라우저에서는 표현을 저장할 수 없어요",
};

export const UPDATE_FAILURE_MESSAGE: Record<UpdateFailure, string> = {
  ...SAVE_FAILURE_MESSAGE,
  "not-found": "이 표현이 저장소에 없어요. 편집을 취소하고 새로고침해주세요",
};

/** 005: 최신 저장소 배열을 입력으로 받아 두 필드만 교체한다. 입력 배열은 변경하지 않는다. */
export function updateExpressionIn(
  items: SavedExpression[],
  id: string,
  changes: ExpressionUpdate,
):
  | { ok: true; saved: SavedExpression; items: SavedExpression[] }
  | { ok: false; reason: Exclude<UpdateFailure, "storage-unavailable"> } {
  if (!isValidTerm(changes.term)) return { ok: false, reason: "invalid-term" };
  if (!isValidMeaning(changes.meaning)) return { ok: false, reason: "invalid-meaning" };
  const current = items.find((item) => item.id === id);
  if (!current) return { ok: false, reason: "not-found" };
  const normalized = normalizeTerm(changes.term);
  if (items.some((item) => item.id !== id && normalizeTerm(item.term) === normalized)) {
    return { ok: false, reason: "duplicate" };
  }
  const saved: SavedExpression = {
    ...current,
    term: changes.term.trim(),
    meaning: changes.meaning.trim(),
  };
  return { ok: true, saved, items: items.map((item) => (item.id === id ? saved : item)) };
}

/**
 * 저장소 키는 하나이며 JSON 배열을 담는다 (계약 조항 11).
 * 표현마다 별도 키를 쓰면 목록을 읽을 때 키를 순회해야 하고 순서 보장을 직접 해야 한다.
 */
const STORAGE_KEY = "talklog.expressions";

/**
 * 중복 판정용 정규화 (R-005).
 *
 * 앞뒤 공백은 끌어서 고를 때 거의 항상 섞여 들어오므로 `trim()` 이 없으면
 * `過ごした` 와 `過ごした ` 가 다른 표현이 된다. `normalize("NFC")` 는 일본어
 * 입력기에서 결합 문자로 들어온 문자열을 같은 표현으로 묶어준다.
 *
 * 전각·반각 통일과 활용형 원형 복원은 하지 않는다 — 형태소 분석기가 필요하고(원칙 IV),
 * 학습자에게는 실제로 들은 형태가 더 유용하다 (결정 D-1).
 */
export function normalizeTerm(term: string): string {
  return term.trim().normalize("NFC");
}

/**
 * 공백·제어 문자·문장 부호의 코드 포인트 구간. 각 구간은 양끝을 포함한다.
 *
 * 정규식의 `\p{L}` · `\p{N}` 을 쓰지 않은 이유: Unicode property escape 는 ES2018
 * 이상을 요구하고 이 프로젝트의 `tsconfig.json` target 은 ES2017 이다. 대신 "의미 없는
 * 글자"의 구간을 열거하고 그 밖의 글자가 하나라도 있으면 유효로 본다 — 일본어·한국어
 * 문자는 모두 이 구간 밖이므로 결과는 같다.
 *
 * 문자 클래스에 문장 부호를 직접 적지 않은 이유는 U+2000·U+3000 같은 보이지 않는
 * 공백이 소스에 리터럴로 들어가 읽는 사람이 확인할 수 없기 때문이다.
 */
const PUNCTUATION_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x002f], // 제어 문자 · 공백 · ! " # $ % & ' ( ) * + , - . /
  [0x003a, 0x0040], // : ; < = > ? @        (0x30~0x39 숫자는 의미 있는 글자)
  [0x005b, 0x0060], // [ \ ] ^ _ `          (0x41~0x5A 대문자는 의미 있는 글자)
  [0x007b, 0x00bf], // { | } ~ · Latin-1 기호와 문장 부호 (0x61~0x7A 소문자 제외)
  [0x2000, 0x206f], // 일반 문장 부호 — 각종 공백, ‥ … — ‘ ’ “ ”
  [0x3000, 0x303f], // CJK 기호와 문장 부호 — 전각 공백, 、 。 「 」 〜
  [0xff01, 0xff0f], // 전각 ！ ＂ ＃ ～ ／   (0xFF10~0xFF19 전각 숫자 제외)
  [0xff1a, 0xff20], // 전각 ： ； ＜ ＝ ＞ ？ ＠ (0xFF21~0xFF3A 전각 대문자 제외)
  [0xff3b, 0xff40], // 전각 ［ ＼ ］ ＾ ＿ ｀ (0xFF41~0xFF5A 전각 소문자 제외)
  [0xff5b, 0xff65], // 전각 ｛ ｜ ｝ · 반각 ｡ ｢ ｣ ､ ･
];

function isPunctuationOrSpace(codePoint: number): boolean {
  return PUNCTUATION_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * 표현 본문으로 받아들일 수 있는지 (FR-005).
 *
 * `trim()` 후 1자 이상이고 문자·숫자를 하나 이상 포함해야 한다. 공백과 문장 부호만
 * 고른 범위는 표현이 아니다.
 */
export function isValidTerm(term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length === 0) return false;
  // Array.from 으로 서로게이트 쌍(이모지 등)을 한 글자로 센다.
  return Array.from(trimmed).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && !isPunctuationOrSpace(codePoint);
  });
}

/** 뜻으로 받아들일 수 있는지 (FR-008). 비어 있지만 않으면 된다 — 모국어 표기는 자유다. */
export function isValidMeaning(meaning: string): boolean {
  return meaning.trim().length > 0;
}

/** 저장 시점에 만들고 재사용하지 않는다 (data-model.md §1 검증 규칙). */
export function createExpressionId(): string {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function isSavedExpression(value: unknown): value is SavedExpression {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.term === "string" &&
    typeof candidate.meaning === "string" &&
    typeof candidate.example === "string" &&
    typeof candidate.sourceRoom === "string" &&
    typeof candidate.savedAt === "number"
  );
}

export type ReadResult = { ok: true; items: SavedExpression[] } | { ok: false };

/**
 * 저장소에서 표현 전체를 읽는다. 예외를 던지지 않는다 (계약 조항 9).
 *
 * `{ ok: false }` 는 **저장소를 쓸 수 없다**는 뜻이다. 브라우저 설정에서 사이트
 * 데이터를 차단하면 `localStorage` 에 접근하는 순간 `SecurityError` 가 난다 (R-003).
 * 값이 깨진 것과는 구분한다 — 값만 깨졌으면 저장소는 여전히 쓸 수 있으므로 빈 목록으로
 * 계속 진행한다 (계약 조항 12).
 */
export function readAll(): ReadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false };
  }

  if (raw === null) return { ok: true, items: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    // 배열이 아니거나 필드가 깨진 항목은 버리고 나머지를 쓴다 (계약 조항 12).
    if (!Array.isArray(parsed)) return { ok: true, items: [] };
    return { ok: true, items: parsed.filter(isSavedExpression) };
  } catch {
    return { ok: true, items: [] };
  }
}

/**
 * 표현 전체를 저장소에 쓴다. 성공 여부를 반환하고 예외를 던지지 않는다.
 *
 * 저장소가 가득 차면 `QuotaExceededError`, 사이트 데이터가 차단되면 `SecurityError`
 * 가 난다. 둘 다 삼키지 않고 실패로 알려야 한다 (FR-015, R-003).
 */
export function writeAll(items: SavedExpression[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
