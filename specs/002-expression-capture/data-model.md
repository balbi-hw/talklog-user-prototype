# Phase 1 Data Model: 스크립트에서 표현 선택·저장

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-09

spec.md의 Key Entities를 구현 가능한 형태로 구체화한다. 이름은
[docs/domain-model.md](../../docs/domain-model.md) §4 용어집에서만 뽑았다 (Constitution
원칙 I).

---

## 1. SavedExpression — 저장된 표현

용어집의 **표현**. 결정 D-1에 따라 단어 · 구 · 문장을 모두 담으며 길이로 종류를
구분하지 않는다.

| 필드 | 타입 | 설명 | 유래 |
|------|------|------|------|
| `id` | `string` | 목록 key 및 삭제 대상 식별자 | — |
| `term` | `string` | 표현 본문. 사용자가 고르고 다듬은 것 | FR-001, FR-009 |
| `meaning` | `string` | 뜻. 사용자가 직접 적는다 | FR-007 |
| `example` | `string` | 표현이 나온 문장 전체 | FR-010 |
| `sourceRoom` | `string` | 출처 학습방 이름 | FR-011 |
| `savedAt` | `number` | 저장 시각(epoch ms). 정렬 기준 | FR-017 |

**검증 규칙**:

- `term`은 `trim()` 후 1자 이상이어야 한다 (FR-005).
- `term`은 공백과 문장 부호만으로 이루어져서는 안 된다 (FR-005).
- `meaning`은 `trim()` 후 1자 이상이어야 한다 (FR-008).
- `id`는 저장 시점에 생성하며 재사용하지 않는다.

**정규화 키** (중복 판정용, 저장하지 않는 파생값):

```
normalizedTerm = term.trim().normalize("NFC")
```

두 표현의 `normalizedTerm`이 같으면 같은 표현으로 본다. 예문이 달라도 같다 (R-005).

---

## 2. ExpressionDraft — 저장 전 초안

저장되지 않은, 지금 만들고 있는 표현. 동시에 최대 1개만 존재한다.

| 필드 | 타입 | 설명 | 유래 |
|------|------|------|------|
| `term` | `string` | 고른 범위에서 시작해 사용자가 고칠 수 있다 | FR-002a, FR-009 |
| `meaning` | `string` | 초기값은 빈 문자열 | FR-007 |
| `example` | `string` | 고를 때 확정되며 사용자가 고치지 않는다 | FR-010 |
| `sourceRoom` | `string` | 고를 때 확정된다 | FR-011 |
| `savable` | `boolean` (파생) | `term` · `meaning` 이 검증 규칙을 통과하는지 | FR-005, FR-008 |
| `duplicateOf` | `SavedExpression \| null` (파생) | 같은 `normalizedTerm`을 가진 기존 표현 | FR-021 |

**생명주기**: 유효한 선택에서 저장을 시작할 때 생성 → 저장 성공 시 `SavedExpression`이
되고 소멸 / 취소 시 소멸 (FR-013).

`example`을 고칠 수 없게 둔 이유: 예문은 "실제로 이렇게 들었다"는 기록이므로 사용자가
고치면 근거가 사라진다. 표현 본문만 다듬을 수 있다.

---

## 3. TranscriptSelection — 스크립트 위의 선택

저장되지 않는 순간 상태. `window.getSelection()`을 읽어 파생한다 (R-001).

| 필드 | 타입 | 설명 |
|------|------|------|
| `text` | `string` | 고른 글자. `trim()` 적용 후 |
| `example` | `string` | 선택이 일어난 스크립트 전체 텍스트 |
| `sourceRoom` | `string` | 그 스크립트가 속한 학습방 |
| `isValid` | `boolean` (파생) | 아래 조건을 모두 만족하는지 |

**유효 조건** (`isValid`):

1. 선택이 접힌 상태가 아니다 (`!selection.isCollapsed`) — FR-004
2. 선택이 스크립트 요소 안에 있다 (`transcriptEl.contains(commonAncestorContainer)`) — FR-006
3. `text`가 `trim()` 후 1자 이상이다 — FR-005
4. `text`에 문자·숫자가 하나 이상 있다 (공백·문장 부호만이 아니다) — FR-005

조건 2가 FR-006("스크립트가 열려 있을 때만")을 자연히 만족한다. 스크립트가 닫히면 요소가
DOM에 없으므로 어떤 선택도 유효하지 않다.

**선택 해제**: 사용자가 다른 곳을 누르면 `isValid`가 `false`가 되고 저장 수단이 사라진다.
초안이 이미 열려 있으면 초안은 유지한다 — 선택이 풀렸다고 입력 중인 뜻을 버리면 안 된다
(spec.md 엣지 케이스).

---

## 4. StorageStatus — 저장소 상태

```
"loading" | "ready" | "unavailable"
```

| 상태 | 진입 조건 | 화면이 보여주는 것 | 유래 |
|------|-----------|--------------------|------|
| `loading` | 초기값. 첫 렌더는 항상 이 상태다 | 목록 자리에 아무 판단도 하지 않는 상태 | R-004 |
| `ready` | `useEffect`에서 저장소 읽기 성공 | 표현 목록, 또는 0개면 빈 상태 안내 | FR-016, FR-019 |
| `unavailable` | 읽기·쓰기에서 예외 발생 | 저장할 수 없다는 안내. 저장 수단을 비활성 | FR-015 |

**중요** (R-004): 빈 상태 안내(FR-019)는 `status === "ready" && expressions.length === 0`
일 때만 보여준다. `loading`에서 빈 상태를 보여주면 표현이 있는 사용자에게도 "저장한 것이
없어요"가 한 순간 보이고, 사용자는 저장이 사라졌다고 오해한다.

`unavailable`은 되돌릴 수 있다 — 다음 저장 시도에서 성공하면 `ready`로 전이한다. 브라우저
설정이 그동안 바뀔 수 있으므로 영구 상태로 두지 않는다.

---

## 5. 표현 저장·삭제 흐름

| # | 트리거 | 조건 | 결과 |
|---|--------|------|------|
| E1 | 스크립트에서 범위를 고름 | `isValid` | 저장 수단이 나타남 (R-006의 고정 영역) |
| E2 | 저장 시작 | `isValid` | `ExpressionDraft` 생성. `term`은 선택 글자, `example`·`sourceRoom` 확정 |
| E3 | 표현 본문 수정 | 초안 존재 | `term` 갱신, `savable`·`duplicateOf` 재계산 |
| E4 | 뜻 입력 | 초안 존재 | `meaning` 갱신, `savable` 재계산 |
| E5 | 저장 | `savable && !duplicateOf && status !== "unavailable"` | `SavedExpression` 추가, 저장소 쓰기, 초안 소멸, 완료 표시 (FR-012) |
| E6 | 저장 | `!savable` | 저장하지 않고 이유 표시 (FR-008) |
| E7 | 저장 | `duplicateOf !== null` | 저장하지 않고 이미 있음을 표시 (FR-021) |
| E8 | 저장 | 저장소 쓰기 실패 | `status = "unavailable"`, 실패를 알림. 성공처럼 표시하지 않음 (FR-015) |
| E9 | 취소 | 초안 존재 | 초안 소멸, 아무것도 저장되지 않음 (FR-013) |
| E10 | 삭제 요청 | 목록에 표현 존재 | 확인 단계 진입 (FR-023) |
| E11 | 삭제 확인 | 확인 단계 | 저장소에서 제거, 목록·개수 갱신 (FR-022, FR-018) |
| E12 | 삭제 취소 | 확인 단계 | 아무 변화 없음 |
| E13 | Feedback 화면에서 저장 | 그 화면의 표현·뜻이 정해져 있음 | E5와 **같은 경로**를 쓴다 (FR-024) |

E13이 별도 경로가 아니라 E5를 재사용하는 것이 핵심이다. Feedback 화면의 표현과 뜻은
Mock이지만 **저장 동작은 실제**여야 하며(FR-024), 중복 판정과 저장소 실패 처리도 똑같이
적용된다.

---

## 6. FR-027 식별자 이름 변경

Constitution v1.1.0 원칙 I이 코드 식별자에도 용어집을 적용하도록 요구한다. R-007의
결정을 그대로 따른다.

| 현재 | 변경 후 | 이유 |
|---|---|---|
| `.word-card` | `.expression-card` | "단어"는 용어집이 금지 |
| `.word-index` | `.expression-index` | 같음 |
| `.jp-word` | `.expression-term` | 같음. `SavedExpression.term`과 이름을 맞춘다 |
| `.ko-word` | `.expression-meaning` | 같음. `SavedExpression.meaning`과 맞춘다 |
| `.flashcard` | `.flip-card` | "플래시카드"는 용어집이 금지. 복습 화면의 뒤집는 카드 |
| `<h1>플래시카드</h1>` | `<h1>내 표현</h1>` | 화면 문구도 원칙 I의 대상 |

`.review-card`(홈 화면 복습 진입)와 `.card-summary`는 용어집의 "카드"를 쓰므로 그대로
둔다.

---

## 엔티티 관계

```
TranscriptSelection ──E2──> ExpressionDraft ──E5──> SavedExpression[]
   (순간 상태)                 (최대 1개)              (저장소에 영속)
                                                            │
                                              StorageStatus 가 접근 가능성을 결정
                                                            │
                                                            ↓
                                                    카드 목록 화면
                                                  (표현 하나당 카드 하나)
```
