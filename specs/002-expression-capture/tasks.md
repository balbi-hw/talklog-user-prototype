---

description: "Task list for 스크립트에서 표현 선택·저장"
---

# Tasks: 스크립트에서 표현 선택·저장

**Input**: Design documents from `/specs/002-expression-capture/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**서브도메인**: 표현 학습 (**Core**) — [docs/domain-model.md](../../docs/domain-model.md) §2

**Tests**: 자동화 테스트 작업을 포함하지 않는다. spec.md가 테스트를 요구하지 않고,
Constitution 개발 워크플로가 "자동화 테스트는 현재 필수가 아니다"로 규정한다. 검증은
[quickstart.md](./quickstart.md)의 수동 시나리오 S1~S8로 수행한다.

**Organization**: 작업은 spec.md의 User Story 단위로 묶여 있어 각 스토리를 독립적으로
구현·검증할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 의존하지 않음)
- **[Story]**: 해당 작업이 속한 User Story (US1, US2, US3)
- 각 작업 설명에 정확한 파일 경로를 포함한다

## 001에서 배운 것을 반영한 Phase 배치

001의 실행 기록에서 **tasks.md의 Phase 경계가 Constitution 원칙 II를 깨는** 문제가
드러났다. MVP 경계가 "눌려도 아무 일이 없는 버튼"을 남겼기 때문이다. 이번에는 두 가지를
미리 배치했다.

1. **원칙 II 위반 제거를 Foundational로 올렸다** (T006 · T007). 이 기능은 원칙 II
   위반을 만드는 쪽이 아니라 갚는 쪽이므로, 가짜 저장·하드코딩 표현·동작하지 않는 복습
   표시를 US1보다 먼저 없앤다. 어느 Checkpoint에서도 거짓 상태가 남지 않는다.
2. **FR-027 용어 정리를 Foundational에 두었다** (T004). 나중으로 미루면 US1~US3의 새
   코드가 낡은 이름(`word-*`, `flashcard`) 위에 쌓인다.

또한 **중복 처리(FR-021)의 표면화가 US3가 아니라 US1에 있다.**
`contracts/use-expressions.md` 조항 5가 `save()`의 실패 이유 4가지를 구분해 반환하도록
규정하고 `contracts/expression-sheet-ui.md` 조항 4가 각각 다른 문구를 요구하므로,
US1의 저장 수단은 `duplicate`를 포함한 4가지를 처음부터 다뤄야 한다. US3는 삭제와
검증 시나리오를 담당한다.

## Path Conventions

plan.md의 Structure Decision을 따른다. 001이 세운 `app/lib` · `app/hooks` ·
`app/components` 구조를 그대로 쓰고 새 레이어를 만들지 않는다. `Home` · `Review` 화면과
001의 음성 관련 파일은 T004의 이름 변경 외에는 손대지 않는다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 공유 타입과 저장소 접근 함수를 먼저 확정해 이후 모든 작업이 같은 이름을 쓰게 한다

- [X] T001 [P] `app/lib/types.ts` — data-model.md §1 §2 §4의 타입을 추가한다: `SavedExpression`(필드 `id`, `term`, `meaning`, `example`, `sourceRoom`, `savedAt: number`), `ExpressionDraft`(필드 `term`, `meaning`, `example`, `sourceRoom`), `StorageStatus = "loading" | "ready" | "unavailable"`, `SaveFailure = "invalid-term" | "invalid-meaning" | "duplicate" | "storage-unavailable"`. 이름은 [docs/domain-model.md](../../docs/domain-model.md) §4 용어집에서만 뽑는다 — `Word`·`Vocabulary`·`Flashcard` 를 쓰지 않는다 (Constitution 원칙 I)
- [X] T002 [P] `app/lib/expressions.ts` 생성 — 저장소 접근과 순수 함수 (FR-014 영속성의 토대). 저장소 키는 `talklog.expressions` **하나**이며 JSON 배열을 담는다 (R-003, 계약 조항 11). 함수: (1) `normalizeTerm(term)` — `term.trim().normalize("NFC")` (R-005); (2) `isValidTerm(term)` — `trim()` 후 1자 이상이고 문자·숫자를 하나 이상 포함 (FR-005); (3) `readAll()` — 예외를 던지지 않고 `{ ok: true, items } | { ok: false }` 반환. 배열이 아니거나 필드가 깨진 항목은 **버리고 나머지를 쓴다** (계약 조항 12); (4) `writeAll(items)` — 성공 여부 반환. **모든 저장소 접근을 `try`/`catch` 로 감싼다** — 사이트 데이터가 차단되면 접근 자체가 `SecurityError` 를 던지고, 가득 차면 `QuotaExceededError` 가 난다 (R-003)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 표현 모음의 단일 소유자를 세우고, 지금 화면에 남아 있는 원칙 II 위반을 먼저 갚는다

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 User Story도 시작할 수 없다

- [X] T003 `app/hooks/useExpressions.ts` 생성 — contracts/use-expressions.md의 계약대로 구현한다. 반환: `{ status, expressions, count, findDuplicate, save, remove }`. 저장한 표현은 새로고침 이후에도 남아야 한다 (FR-014). **첫 렌더의 `status`는 항상 `"loading"`** 이고 저장소 읽기는 `useEffect` 안에서만 한다 — 렌더 중에 읽으면 hydration 이 어긋난다 (R-004, 조항 1). `expressions`는 `savedAt` 내림차순으로 정렬해 반환한다 (FR-017, 조항 2). `count`는 언제나 `expressions.length` 와 같고 별도 카운터를 두지 않는다 (FR-018, 조항 3). `save()`는 실패 이유 4가지(`invalid-term` · `invalid-meaning` · `duplicate` · `storage-unavailable`)를 구분해 반환하고, 실패하면 `expressions`를 바꾸지 않는다 (조항 5·6). 저장소 예외 시 `status = "unavailable"`, 이후 성공하면 `"ready"` 로 되돌린다 (조항 7·8)
- [X] T004 `app/globals.css` + `app/page.tsx` — FR-027 식별자 이름 변경. data-model.md §6의 표를 그대로 적용한다: `.word-card`→`.expression-card`, `.word-index`→`.expression-index`, `.jp-word`→`.expression-term`, `.ko-word`→`.expression-meaning`, `.flashcard`→`.flip-card`. `Cards` 화면의 `<h1>플래시카드</h1>`→`<h1>내 표현</h1>`. Constitution v1.1.0 원칙 I이 "용어집의 '쓰지 않는 말'을 문서·코드 식별자·화면 문구에 사용해서는 안 된다"(MUST NOT)로 규정한다. `.review-card`(홈 화면)와 `.card-summary`는 용어집의 "카드"를 쓰므로 그대로 둔다
- [X] T005 `app/page.tsx` — `TalklogApp` 셸에서 `useExpressions()`를 호출해 표현 모음을 소유한다. 저장은 `Room`(US1)과 `Feedback`(T007)에서 일어나고 조회는 `Cards`(US2)에서 일어나므로 세 화면의 공통 조상이 가져야 한다. 001에서 음성 메시지 목록을 셸로 올린 것과 같은 이유다 — 화면이 조건부 렌더링이라 `Room`이 언마운트되면 상태가 사라진다
- [X] T006 `app/page.tsx` — **원칙 II 위반 제거** (FR-025, FR-026). `Cards` 화면에서 하드코딩된 표현 3개(`映画館で映画を見る` · `久しぶりだね` · `楽しみにしている`)와 `전체 23` 표시를 제거한다. 동작하지 않는 필터(`최근 저장` · `어려워요`)와 각 항목의 재생 버튼(`▶`, 표현에는 음성이 없다)도 제거한다. 복습 관련 표시(`오늘의 복습` · `8` · `장 남았어요` · `복습 시작 →`)는 복습 서브도메인 미구현이므로 실제 값으로 바꿀 수 없다 — **아직 구현되지 않았음을 알 수 있게** 표시하고 동작하는 것처럼 보이는 버튼을 남기지 않는다 (contracts/expression-list-ui.md 조항 1~4). 이 단계 후 카드 화면은 비어 있되 거짓이 없는 상태다
- [X] T007 `app/page.tsx` — **원칙 II 위반 제거** (FR-024). `Feedback` 화면의 `saved` 상태 토글을 제거하고 `useExpressions.save()` 를 호출하게 바꾼다. 그 화면의 표현(`映画館で映画を見る`)과 뜻(`영화관에서 영화를 보다`)은 AI 교정이 미구현이라 Mock 이지만 **저장 동작은 실제**여야 한다. 실패 이유 4가지를 구분해 표시하고, 성공한 것처럼 상태만 바꾸는 동작이 남아서는 안 된다 (data-model.md E13 — E5와 같은 저장 경로를 쓴다)

**Checkpoint**: 카드 화면에 거짓이 없고, Feedback 화면에서 실제로 저장이 되며 새로고침
후에도 남는다. 카드 목록 UI는 아직 없으므로 저장 결과는 저장소에서만 확인된다.
User Story 작업 시작 가능

---

## Phase 3: User Story 1 - 스크립트에서 표현을 골라 저장하기 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 스크립트에서 배우고 싶은 범위를 직접 골라 뜻을 적어 표현으로 저장한다.
`docs/domain-model.md`가 Core로 규정한 이음새가 처음 실제로 동작한다

**Independent Test**: quickstart.md의 **S1 · S3** 전체를 통과한다. 카드 목록 화면(US2)
없이도 저장 완료 표시로 검증 가능하다

### Implementation for User Story 1

- [X] T008 [US1] `app/hooks/useTranscriptSelection.ts` 생성 — contracts/use-transcript-selection.md의 계약대로 구현한다. 입력 `{ transcriptRef, example, sourceRoom, enabled }`, 반환 `{ selection, clear }`. 사용자가 스크립트에서 배우고 싶은 범위를 직접 고르는 경로이며(FR-001), 범위를 고르지 않은 상태에서는 저장을 시작할 수 없어야 한다 (FR-004). 유효 조건 4개를 모두 만족해야 `selection`이 `null`이 아니다 (data-model.md §3): 선택이 접히지 않음, `transcriptRef.current.contains(range.commonAncestorContainer)`, `trim()` 후 1자 이상, 문자·숫자를 하나 이상 포함. `enabled`가 `false`면 항상 `null` (FR-006)
- [X] T009 [US1] `app/hooks/useTranscriptSelection.ts` — 선택 확정 감지. `document`의 `selectionchange` 와 `pointerup` · `keyup` 을 **모두** 듣고 같은 읽기 함수를 호출한다. 브라우저 사이 `selectionchange` 발생 시점이 달라 어느 한쪽만으로는 놓친다 (R-001, 조항 5). **입력 수단으로 분기하지 않는다** — 마우스 드래그 · 터치 롱프레스 · `Shift`+방향키가 모두 같은 경로로 처리되며, 이것이 FR-028을 별도 UI 없이 충족하는 방식이다 (R-002, 조항 6). `clear()`는 `selection.removeAllRanges()` 로 브라우저 선택도 해제한다. 언마운트 시 리스너를 모두 해제한다
- [X] T010 [US1] `app/components/ExpressionSheet.tsx` 생성 — contracts/expression-sheet-ui.md의 상태별 렌더링 표를 구현한다. 배치는 선택 위에 떠 있는 말풍선이 아니라 **스크립트 블록 바로 아래에 붙는 고정 영역**이다. 모바일에서 길게 눌러 고르면 브라우저가 자체 복사·공유 메뉴를 선택 위에 띄우므로 그 위치의 버튼은 가려진다. 브라우저 기본 메뉴의 위치는 통제할 수 없어 애초에 겹치지 않는 곳에 둔다 (R-006). 상태: 선택 없음(아무것도 렌더링하지 않음, FR-004) → 선택 유효(고른 글자를 확인할 수 있게 표시, FR-003) → 초안(표현 입력칸 + 뜻 입력칸 + 저장·취소, FR-013)
- [X] T011 [US1] `app/components/ExpressionSheet.tsx` — 초안 편집과 검증. 뜻은 사용자가 직접 적는다 (FR-007). 표현 입력칸은 고른 글자로 채워지되 **사용자가 고칠 수 있다** (FR-002a, FR-009). 예문은 보여주기만 하고 고칠 수 없다 — 예문은 "실제로 이렇게 들었다"는 기록이므로 고치면 근거가 사라진다 (조항 2). 저장 버튼이 비활성일 때 **이유가 화면에 문구로 보여야** 한다. `title` 속성만으로는 모바일에서 읽을 수 없다 (FR-008, 조항 3)
- [X] T012 [US1] `app/components/ExpressionSheet.tsx` — 실패 이유 4가지를 서로 다른 문구로 표시한다 (조항 4): `invalid-meaning`("뜻을 적어주세요"), `invalid-term`("표현을 적어주세요"), `duplicate`("이미 저장한 표현이에요"), `storage-unavailable`("이 브라우저에서는 표현을 저장할 수 없어요"). 같은 문구로 합치면 사용자가 무엇을 해야 할지 알 수 없다. **`duplicate` 가 US3가 아니라 여기 있는 이유**는 `save()` 가 Foundational(T003)에서 이미 4가지를 반환하므로 처리하지 않으면 이유 없는 실패가 남기 때문이다
- [X] T013 [US1] `app/page.tsx` — `Room` 의 스크립트 요소에 `ref` 와 `tabIndex={0}` 을 주고 `useTranscriptSelection` 을 연결한다. `tabIndex={0}` 이 FR-028을 충족하는 핵심이다 — 포커스 가능한 텍스트 요소에서는 `Shift`+방향키로 캐럿 선택이 되고 그 선택이 `getSelection()` 에 똑같이 나타난다 (R-002). `aria-label="스크립트. 배우고 싶은 부분을 골라 표현으로 저장할 수 있어요"` 를 붙인다. `enabled` 는 스크립트 토글 상태(`showScript`)를 넘긴다
- [X] T014 [US1] `app/page.tsx` — `ExpressionSheet` 를 스크립트 블록 아래에 배치하고 초안 상태를 `Room` 에 둔다. `example` 은 스크립트 전체 텍스트, `sourceRoom` 은 `"유키와 일본어 대화"` 를 넘긴다 (FR-010, FR-011). 저장은 T005의 셸 `useExpressions.save()` 를 호출하고, 성공하면 완료됐음을 표시한다 (FR-012, data-model.md E5). 취소하면 아무것도 저장되지 않는다 (FR-013). **선택이 풀려도 초안은 유지한다** — 입력 중인 뜻을 잃게 해서는 안 된다 (조항 6, S1-11)
- [X] T015 [US1] `app/globals.css` — 저장 수단 스타일 추가: `.expression-sheet`, `.expression-sheet-preview`, `.expression-sheet-fields`, `.expression-sheet-actions`, `.expression-sheet-notice`, `.save-button[disabled]`. 색상은 기존 `:root` CSS 변수(`--green`, `--mint`, `--muted`, `--coral`, `--line`)만 사용하고 새 리터럴 색상을 추가하지 않는다. 입력칸과 버튼이 520px 셸 안에서 무너지지 않아야 한다 (원칙 III)

**Checkpoint**: quickstart.md S1(고르기→다듬기→뜻→저장, 유효성·취소·선택 해제)과
S3(모바일 롱프레스)이 통과한다. Core 흐름이 처음 실제로 동작하는 지점이다

---

## Phase 4: User Story 2 - 저장한 표현을 카드 목록에서 확인하기 (Priority: P2)

**Goal**: 저장한 표현이 카드 목록에 실제로 나타나고, 개수·순서·출처가 맞으며, 하나도
없을 때와 저장소를 쓸 수 없을 때를 구분해 안내한다

**Independent Test**: quickstart.md **S2** 전체를 통과한다

### Implementation for User Story 2

- [X] T016 [US2] `app/components/ExpressionList.tsx` 생성 — contracts/expression-list-ui.md의 상태 표를 구현한다. `status` × `count` 조합 4가지: `loading`(목록 자리를 비워두되 **빈 상태 안내를 보여주지 않는다**), `ready`+0(빈 상태와 저장 방법 안내), `ready`+>0(목록과 개수), `unavailable`(저장할 수 없다는 안내). **`loading` 과 빈 상태를 같은 화면으로 처리하면 안 된다** — 표현이 있는 사용자에게도 "저장한 표현이 없어요"가 한 순간 보이고 사용자는 저장이 사라졌다고 오해한다 (R-004, FR-019, FR-015)
- [X] T017 [US2] `app/components/ExpressionList.tsx` — 항목 렌더링. 각 표현의 `term` · `meaning` · `example` · `sourceRoom` 을 보여준다 (FR-016). **`example` 을 빼면 FR-010으로 저장한 예문을 사용자가 확인할 경로가 없어진다** — tasks 생성 중 발견한 명세 불일치로, FR-016과 contracts/expression-list-ui.md를 함께 고쳤다. 순서는 `useExpressions` 가 이미 `savedAt` 내림차순으로 정렬해 주므로 **컴포넌트에서 다시 정렬하지 않는다** (FR-017). T004에서 바꾼 식별자를 쓴다 — `.expression-card` · `.expression-index` · `.expression-term` · `.expression-meaning`. `word-*` 를 새로 쓰지 않는다 (조항 6, 원칙 I)
- [X] T018 [US2] `app/page.tsx` — `Cards` 화면에 `ExpressionList` 를 연결하고 T005의 셸 상태를 내려준다. T006이 제거한 자리에 실제 목록이 들어간다. 개수 표시는 `useExpressions.count` 를 쓴다 — 별도 카운터를 만들지 않는다 (FR-018)
- [X] T019 [US2] `app/components/ExpressionList.tsx` + `app/globals.css` — 아주 긴 뜻 처리. `meaning` 이 200자를 넘어도 다른 항목을 밀어내지 않아야 한다. 줄바꿈(`overflow-wrap`) 또는 말줄임 중 하나로 처리한다 (FR-020, S2-7)
- [X] T020 [US2] `app/globals.css` — 카드 목록 스타일: `.expression-list`, `.expression-empty`, `.expression-unavailable`. 기존 `.expression-card` 계열(T004에서 이름을 바꾼 것)을 재사용하고 기존 CSS 변수만 쓴다

**Checkpoint**: US1과 US2가 각각 독립적으로 동작한다. quickstart.md S2 통과 — 특히
S2-2(빈 상태가 한 순간도 잘못 보이지 않음)와 S2-8·9·10(가짜가 남지 않았음)

---

## Phase 5: User Story 3 - 중복을 알고 저장한 표현을 지우기 (Priority: P3)

**Goal**: 잘못 저장한 표현을 지울 수 있고, 지우기 전에 확인을 거치며, 중복이 실제로
막히는지 확인할 수 있다

**Independent Test**: quickstart.md **S4** 전체를 통과한다

> 중복 차단(FR-021)의 로직은 T003, 표면화는 T012에 이미 있다. 이 Phase는 삭제와
> 검증을 담당한다.

### Implementation for User Story 3

- [X] T021 [US3] `app/components/ExpressionList.tsx` — 삭제 수단. 각 항목에 삭제 버튼을 두고 `aria-label="표현 삭제"` 를 준다 (FR-022, FR-029). 아이콘만 있는 컨트롤이므로 텍스트 대체가 필수다 (원칙 III)
- [X] T022 [US3] `app/components/ExpressionList.tsx` — 삭제 확인 단계. 삭제를 누르면 곧바로 지우지 않고 그 항목에 "지울까요?" + 지우기 · 취소를 표시한다. 되돌릴 수 없는 동작이므로 확인 단계를 반드시 거친다 (FR-023, 원칙 V, data-model.md E10~E12). 확인을 취소하면 아무 변화가 없다
- [X] T023 [US3] `app/hooks/useExpressions.ts` + `app/lib/expressions.ts` — `remove(id)` 가 저장소에서도 지우는지 확인하고 보완한다. 새로고침 후 지운 표현이 다시 나타나서는 안 된다 (계약 조항 10, US3 시나리오 4, S4-7). 삭제 후 `count` 가 함께 줄어야 한다 (FR-018)
- [X] T024 [US3] `app/globals.css` — 삭제 확인 스타일: `.expression-delete`, `.expression-confirm`, `.expression-confirm-actions`. 되돌릴 수 없는 동작 강조는 기존 `--coral` 변수를 사용한다 (기술 제약)

**Checkpoint**: 세 User Story가 모두 독립적으로 동작한다. quickstart.md S4 통과

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 여러 스토리에 걸친 요구사항과 문서 동기화

- [X] T025 `app/components/ExpressionSheet.tsx` + `app/components/ExpressionList.tsx` + `app/page.tsx` — FR-028 · FR-029 점검. `Tab` 으로 스크립트 영역에 도달되는지, `Shift`+방향키 선택이 끌어서 고른 것과 같게 인식되는지, `Tab` · `Enter` · `Space` 만으로 뜻 입력과 저장과 삭제 확인까지 되는지 확인한다. 입력칸에 보이는 `<label>` 또는 `aria-label` 이 있는지, 아이콘만 있는 컨트롤에 `aria-label` 이 있는지, 저장 완료가 `role="status"` 로 알려지는지 확인한다. `div` + `onClick` 이 남아 있으면 `<button>` 으로 교체한다 (S7)
- [X] T026 `app/lib/expressions.ts` + `app/hooks/useExpressions.ts` — FR-015 경로 점검. 사이트 데이터를 차단한 상태에서 읽기·쓰기·삭제가 모두 예외를 삼키지 않고 `status = "unavailable"` 로 이어지는지, 그 상태에서 앱의 나머지가 정상 동작하는지 확인한다. 설정을 되돌린 뒤 저장하면 `"ready"` 로 복귀해야 한다 (계약 조항 7·8, S6)
- [X] T027 `README.md` — 문서 동기화 (SC-009, 원칙 II). "현재 구현 범위"의 미구현 목록에서 "플래시카드 영구 저장"을 제거한다. "주요 기능"에 스크립트에서 표현을 골라 저장하는 흐름을 반영한다. "프로젝트 구조" 트리에 `app/lib/expressions.ts`, `app/hooks/useExpressions.ts`, `app/hooks/useTranscriptSelection.ts`, `app/components/ExpressionSheet.tsx`, `app/components/ExpressionList.tsx` 를 추가한다. 용어집에 따라 README 전체에서 "플래시카드"를 "카드"로, 저장 단위를 "표현"으로 통일한다 (원칙 I). `docs/domain-model.md` §4의 드리프트 표에서 해소된 항목을 지운다
- [X] T028 `package.json` 의 `npm run build` 실행 — TypeScript 오류 0개로 통과해야 한다. `any` 사용이 남았다면 주석으로 정당화하거나 타입을 좁힌다 (Constitution 품질 게이트, 기술 제약)
- [X] T029 [quickstart.md](./quickstart.md) S1~S8 전체 수동 검증 — S3(모바일 롱프레스)은 실기기 권장이며 LAN IP 접속으로 가능하다(001과 달리 secure context 제약이 없다). S6은 브라우저 사이트 데이터 차단 또는 DevTools 에서 `localStorage.setItem` 을 예외를 던지도록 덮어써 확인한다. 하나라도 실패하면 완료로 보고하지 않는다

---

## Phase 7: T029 검증과 analyze에서 드러난 보완 (2026-10-27)

**Purpose**: T029 1차 검증(브라우저 자동화, 49개 항목 중 46개 통과)과 `/speckit-analyze`가 찾은
위반을 갚는다. 원칙 III · I · II의 MUST 위반이므로 병합 전에 끝내야 한다.

**1차 검증에서 실패한 항목**: S7-2(키보드만으로 선택을 시작할 수 없음), S8-3(Feedback 화면의
"친구"), S6 조항 8(쓰기 실패 뒤 새로고침 없이는 다시 저장할 수 없음). 이 밖에 S7-3은
통과했지만 포커스가 `body` 로 빠져 뜻 입력칸까지 `Tab` 16번이 필요했다.

- [X] T030 [US1] `app/hooks/useTranscriptSelection.ts` — **FR-028 · SC-010 · 원칙 III**. 스크립트 요소의 `keydown` 에서 방향키를 `Selection.modify()` 로 옮겨 선택을 만든다 (research.md R-002 개정, use-transcript-selection 계약 조항 10). Chromium 은 캐럿 브라우징이 꺼져 있으면 `tabIndex={0}` 만으로는 키보드 선택을 시작하지 못한다. 선택을 *읽는* 경로(조항 6)는 바꾸지 않는다
- [X] T031 [US1] `app/components/ExpressionSheet.tsx` + `app/page.tsx` — **포커스 이동** (expression-sheet-ui 조항 10). 저장을 시작하면 뜻 입력칸으로, 저장·취소하면 스크립트로 포커스를 옮긴다
- [X] T032 [US1] `app/components/ExpressionSheet.tsx` — **저장소 사용 불가 상태에서 다시 시도할 수 있게 한다** (expression-sheet-ui 표 `unavailable` 행, use-expressions 조항 8). 안내는 보여주되 "이 표현 저장하기"를 숨기거나 저장 버튼을 비활성으로 두지 않는다. 덮어쓰기 위험은 `useExpressions` 가 쓰기 전에 다시 읽어 이미 막고 있다
- [X] T033 `app/layout.tsx` + `app/page.tsx` + `README.md` — **원칙 I 용어집 위반 정리** (analyze C1 · C2). "친구" · "상대방" → "학습 짝". 코드 주석의 "예시 상대 메시지"도 함께 정리한다
- [X] T034 `app/page.tsx` — **원칙 II 위반 제거** (analyze C3). Feedback 화면의 "▶ 들어보기" 버튼 2개는 눌러도 아무 일이 없다. 음성 합성은 이해 보조 서브도메인의 미구현이므로 제거한다 (T006에서 Cards 화면의 ▶ 버튼을 지운 것과 같은 기준)
- [X] T035 `specs/002-expression-capture/` — 문서 정합 (analyze I1 · I2 · U1 · U2). expression-sheet 계약 조항 4에 `invalid-term` 추가, plan.md의 data-model 절 번호(§5→§6) 수정, 스크립트를 닫을 때 초안 처리를 계약 조항 11로 명시, quickstart에 S1-12 · S6-5 행 추가와 S7-2 · S7-3 기대 결과 구체화, 검증 통과 후 spec.md `Status` 갱신
- [X] T036 `npm run build` 와 [quickstart.md](./quickstart.md) S1~S8 재검증 — T029를 다시 수행한다. 통과하면 T029와 함께 체크한다
  - **결과 (2026-10-27)**: `npm run build` 통과. Edge 헤드리스 자동화로 S1~S8 55개 항목 전부 통과, S3-3은 320 · 390 · 520px에서 확인. **S3-1 · S3-2(실기기 롱프레스와 선택 핸들)는 자동화로 재현할 수 없어 아직 실기기에서 확인하지 않았다** — quickstart가 '실기기 권장'으로 둔 항목이며 PR 검토 체크리스트로 넘긴다

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)        T001, T002        — 병렬 가능
        ↓
Phase 2 (Foundational) T003~T007         — 원칙 II 위반을 먼저 갚는다
        ↓
Phase 3 (US1, P1)      T008~T015         🎯 MVP · Core 흐름
        ↓
Phase 4 (US2, P2)      T016~T020
        ↓
Phase 5 (US3, P3)      T021~T024
        ↓
Phase 6 (Polish)       T025~T029
        ↓
Phase 7 (보완)          T030~T036         T029 1차 검증 실패분
```

### User Story Dependencies

- **US1 (P1)**: Phase 1·2만 필요. US2·US3와 무관하게 완결된다. 저장 완료 표시로
  독립 검증이 가능하므로 카드 목록이 없어도 된다
- **US2 (P2)**: Phase 1·2 필요. T007(Feedback 저장)이 이미 실제 데이터를 만들 수 있으므로
  US1을 건너뛰고도 구현·검증이 가능하다
- **US3 (P3)**: `ExpressionList`(T016)에 의존한다. US2가 끝나야 시작할 수 있다.
  중복 차단은 T003·T012에 이미 있으므로 이 Phase는 삭제만 다룬다

### Within Each User Story

- 훅 → 컴포넌트 → `page.tsx` 연결 → 스타일 순서를 따른다
- 같은 파일을 만지는 작업은 병렬로 표시하지 않았다 (`useTranscriptSelection.ts` 의
  T008·T009, `ExpressionSheet.tsx` 의 T010~T012, `page.tsx` 의 T004~T007·T013·T014·T018,
  `ExpressionList.tsx` 의 T016·T017·T019·T021·T022 는 각각 순차)

### Parallel Opportunities

- Phase 1: T001, T002 (서로 다른 파일, 의존 없음)
- Phase 2: T003 은 T004 와 병렬 가능 (`useExpressions.ts` 와 `globals.css`+`page.tsx`).
  T005·T006·T007 은 모두 `page.tsx` 이므로 T004 이후 순차
- Phase 3: T008·T009(훅)와 T015(CSS)는 T010~T012(컴포넌트)와 병렬 가능
- Phase 5: T024(CSS)는 T021~T023 과 병렬 가능
- Phase 6: T027(README)은 T025·T026 과 병렬 가능

---

## Parallel Example: Phase 1 + Phase 2

```text
# Phase 1 — 동시 시작 가능
T001  app/lib/types.ts
T002  app/lib/expressions.ts

# Phase 2 — T001·T002 완료 후 동시 시작 가능
T003  app/hooks/useExpressions.ts
T004  app/globals.css + app/page.tsx  (식별자 이름 변경)

# Phase 2 — T003·T004 완료 후 순차 (모두 page.tsx)
T005  셸에서 useExpressions 소유
T006  Cards 화면의 가짜 제거
T007  Feedback 저장을 실제로 연결
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

T001~T015(15개)까지 구현하면 스크립트에서 표현을 골라 저장하는 Core 흐름이 처음 실제로
동작한다. `docs/domain-model.md`가 "음성 메시지 앱과 플래시카드 앱을 잇는 이음새"라고
규정한 지점이며, `draft.md` §1의 네 번째 검증 질문에 처음 답할 수 있게 된다.
quickstart.md S1·S3으로 검증한 뒤 여기서 멈춰도 프로토타입으로서 유효하다.

001과 달리 **MVP 경계에서 거짓이 남지 않는다** — Foundational(T006·T007)이 원칙 II
위반을 먼저 갚기 때문이다.

### Incremental Delivery

1. **T001~T015 (MVP)**: 스크립트에서 표현 선택·저장 — `draft.md` §4의 10·11단계
2. **T016~T020**: 카드 목록 — §4의 12단계
3. **T021~T024**: 삭제와 확인 — 원칙 V 완성
4. **T025~T029**: 접근성·저장 실패 경로·문서 동기화

각 단계 끝에서 `npm run build` 가 통과하고 해당 quickstart 시나리오가 통과해야 다음으로
넘어간다.

---

## Notes

- 총 36개 작업: Setup 2, Foundational 5, US1 8, US2 5, US3 4, Polish 5, 보완 7 (Phase 7은 T029 검증 후 추가)
- 신규 런타임 의존성 0개 (원칙 IV). `npm install` 로 무언가를 추가하는 작업은 없다.
  형태소 분석기와 저장소 래퍼 라이브러리를 도입하지 않는다
- `Home` · `Review` 화면과 001의 음성 관련 파일(`Recorder.tsx`, `VoiceBubble.tsx`,
  `useVoiceRecorder.ts`, `useVoicePlayback.ts`, `audio.ts`)은 T004의 식별자 이름 변경
  외에는 수정하지 않는다
- T006·T007(원칙 II 위반 제거)과 T027(README 동기화)은 원칙이 요구하는 완료 조건이며
  선택 사항이 아니다
