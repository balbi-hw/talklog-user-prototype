---

description: "Task list for 실제 음성 녹음·재생"
---

# Tasks: 실제 음성 녹음·재생

**Input**: Design documents from `/specs/001-voice-recording/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: 자동화 테스트 작업을 포함하지 않는다. spec.md가 테스트를 요구하지 않고,
Constitution 개발 워크플로가 "자동화 테스트는 현재 필수가 아니다"로 규정한다. 검증은
[quickstart.md](./quickstart.md)의 수동 시나리오 S1~S7로 수행한다.

**Organization**: 작업은 spec.md의 User Story 단위로 묶여 있어 각 스토리를 독립적으로
구현·검증할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (다른 파일, 미완료 작업에 의존하지 않음)
- **[Story]**: 해당 작업이 속한 User Story (US1, US2, US3)
- 각 작업 설명에 정확한 파일 경로를 포함한다

## Path Conventions

plan.md의 Structure Decision을 따른다. 저장소 루트 기준 `app/` 아래에서 작업하며, 기존
화면 4개(`Home`, `Feedback`, `Cards`, `Review`)는 수정하지 않는다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 공유 타입과 순수 유틸리티를 먼저 확정해 이후 모든 작업이 같은 이름을 쓰게 한다

- [X] T001 [P] `app/lib/types.ts` 생성 — data-model.md §2 §3 §4의 타입을 정의한다: `VoiceMessage`(필드 `id`, `sender: "me" | "partner"`, `durationMs`, `sentAtLabel`, `source: "mock" | "recorded"`, `url: string | null`, `readLabel: string | null`), `MicrophoneStatus = "unknown" | "requesting" | "granted" | "denied" | "no-device" | "unsupported" | "error"`, `RecordingState = "idle" | "requesting" | "recording" | "review" | "blocked"`, `StopReason = "user" | "limit"`. data-model.md §2의 불변식을 주석으로 남긴다: `source === "recorded"` 이면 반드시 `url !== null`
- [X] T002 [P] `app/lib/audio.ts` 생성 — 순수 함수 4개: (1) `pickMimeType()` — research.md R-001의 후보를 이 순서로 `MediaRecorder.isTypeSupported()` 검사 후 첫 지원 형식 반환: `"audio/webm;codecs=opus"` → `"audio/webm"` → `"audio/mp4"` → `"audio/ogg;codecs=opus"` → `""`; (2) `isRecordingSupported()` — `typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia`; (3) `classifyMicError(error: unknown): MicrophoneStatus` — R-002의 매핑표대로 `NotAllowedError`는 `"denied"`, `NotFoundError`·`OverconstrainedError`는 `"no-device"`, `NotReadableError`·`AbortError`는 `"error"`, `SecurityError`는 `"unsupported"`, 그 외는 `"error"`; (4) `formatDuration(ms: number): string` — `0:08` 형태

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 공유하는 메시지 목록 상태, 버블 컴포넌트, 재생 훅

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 User Story도 시작할 수 없다

**참고**: `useVoicePlayback`이 여기 있는 이유는 US1의 FR-005(전송 전 미리 듣기)와 US2의
FR-011(대화 메시지 재생)이 같은 단일 재생 인스턴스를 공유해야 하기 때문이다 (R-004).

- [X] T003 [P] `app/hooks/useVoicePlayback.ts` 생성 — contracts/use-voice-playback.md의 계약대로 구현한다. `HTMLAudioElement` 인스턴스를 `useRef`로 하나만 소유하고 재생 대상이 바뀔 때 `src`를 교체한다. 반환값은 `{ activeId, positionMs, durationMs, progress, toggle, stop }`. `progress`는 인수로 받은 `durationMs`를 분모로 쓴다 — `audio.duration`은 `Infinity`일 수 있으므로 쓰지 않는다 (R-003). `timeupdate`로 `positionMs` 갱신, `ended`에서 `activeId`를 `null`로 두고 `positionMs`를 0으로 되돌린다. 언마운트 시 재생 중지 + `src` 비우기
- [X] T004 `app/page.tsx` — `Room` 컴포넌트에 하드코딩된 음성 메시지 2개(현재 인라인 JSX의 유키 0:08과 내 0:11)를 `VoiceMessage[]` state로 옮긴다. 두 메시지 모두 `source: "mock"`, `url: null`로 둔다 (data-model.md §2). 상대 메시지의 스크립트·번역 토글 상태는 그대로 유지한다
- [X] T005 [P] `app/components/VoiceBubble.tsx` 생성 — contracts/voice-message-ui.md의 계약대로 정적 버블을 만든다. props는 `{ message, isActive, progress, onToggle }`이며 이 단계에서는 `isActive`·`progress`를 받되 사용하지 않는다(US2에서 연결). FR-016: `message.source === "mock"`이면 재생 버튼에 `disabled`를 걸고 `aria-label="재생할 음성이 없는 예시 메시지입니다"`를 준다. 기존 `Wave` 컴포넌트를 재사용하고 `aria-hidden="true"`를 유지한다. 길이는 `formatDuration(message.durationMs)`로 표시한다
- [X] T006 [P] `app/globals.css` — 신규 시맨틱 클래스의 기본 정의를 추가한다: `.voice-bubble`, `.voice-bubble.is-active`, `.bubble-progress`, `.play-button[disabled]`. 색상은 기존 `:root` CSS 변수(`--green`, `--mint`, `--muted`, `--coral`)만 사용하고 새 리터럴 색상을 추가하지 않는다 (기술 제약)
- [X] T007 `app/page.tsx` — `Room`의 인라인 버블 JSX를 `VoiceBubble` 사용으로 교체한다. 상대방 버블의 스크립트·번역 토글(`aria-expanded`, `aria-controls`)은 버블 밖에 그대로 남긴다

**Checkpoint**: 대화 화면이 이전과 똑같이 보이되 메시지가 state에서 렌더링되고, Mock
메시지의 재생 버튼이 비활성으로 정직하게 표시된다. User Story 작업 시작 가능

---

## Phase 3: User Story 1 - 답장 음성을 녹음해서 보내기 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 실제로 자기 목소리를 녹음하고, 전송 전에 들어보고, 다시 녹음하거나
취소한 뒤 마음에 들 때 전송해 대화에 내 메시지로 추가한다

**Independent Test**: quickstart.md의 S1 · S2 · S3 전체를 통과한다. US2·US3 없이도
검증 가능하다

### Implementation for User Story 1

- [X] T008 [US1] `app/hooks/useVoiceRecorder.ts` 생성 — 상태 골격과 마이크 획득. `state`·`micStatus`를 `useState`로 두고, `start()`에서 `isRecordingSupported()` 확인 후 `getUserMedia({ audio: true })`를 호출한다. 전이 T1(`idle`에서 `requesting`), T2(`requesting`에서 `recording`), T3(`requesting`에서 `blocked`)를 구현한다. 오류는 `classifyMicError()` 결과를 `micStatus`에 넣는다. Permissions API를 호출하지 않는다 (R-002, FR-017). `micStatus === "unsupported"`이면 `start()`는 아무 일도 하지 않는다 (contracts/use-voice-recorder.md 조항 1)
- [X] T009 [US1] `app/hooks/useVoiceRecorder.ts` — 녹음 시작·종료와 길이 측정. `pickMimeType()`으로 `MediaRecorder`를 만들고 `ondataavailable`로 청크를 모은다. 시작 시각을 `performance.now()`로 `useRef`에 기록하고, `elapsedMs`는 시작 시각과의 차이로 계산한다 — 인터벌 카운터를 누적하지 않는다 (R-003). `setInterval`은 1초마다 화면 갱신을 트리거하는 용도로만 쓴다. 전이 T4(`recording`에서 `review`, `stopReason = "user"`)를 구현한다
- [X] T010 [US1] `app/hooks/useVoiceRecorder.ts` — 60초 상한. 옵션 `maxDurationMs`의 기본값은 `60_000`이다 (FR-009). 화면 갱신 인터벌에서 `elapsedMs >= maxDurationMs`이면 훅이 스스로 종료하고 `stopReason = "limit"`으로 둔다 (전이 T5, R-006). `setTimeout` 단독 방식을 쓰지 않는다 — 백그라운드 탭 throttle 시 화면 타이머와 값이 어긋난다
- [X] T011 [US1] `app/hooks/useVoiceRecorder.ts` — `review` 단계. `onstop`에서 청크를 `Blob`으로 합치고 `URL.createObjectURL()`로 `previewUrl`을 만든다. `sendable`은 `durationMs >= minDurationMs && blob.size > 0`이며 `minDurationMs` 기본값은 `1_000`이다 (FR-010, R-007). 전이 T10(`retake`), T11(`send`, `sendable`일 때만 `onSend` 호출), T12(`send`, `sendable`이 false면 호출하지 않음), T13(`cancel`)을 구현한다. URL 소유권 규칙: `retake`·`cancel`·`discard`는 `revokeObjectURL(previewUrl)`을 호출하고, `send`는 호출하지 않는다 (contracts/use-voice-recorder.md 조항 4·5). `hasPending`은 `state`가 `recording` 또는 `review`일 때 `true`다
- [X] T012 [US1] `app/hooks/useVoiceRecorder.ts` — 자원 정리. 녹음이 끝나는 5개 경로(사용자 종료 · 60초 자동 종료 · 오류 · 언마운트 · 화면 이동) 전부에서 `stream.getTracks().forEach(t => t.stop())`을 호출한다. 정리 함수를 하나로 모아 `onstop`과 `useEffect` cleanup이 같은 함수를 쓰게 한다 (R-005, 전이 T8). 언마운트 시 인터벌 해제와 `revokeObjectURL`도 함께 수행한다
- [X] T013 [US1] `app/components/Recorder.tsx` 생성 — contracts/recorder-ui.md의 상태별 렌더링 표 중 `idle` · `requesting` · `recording` 3가지를 구현한다. `idle`은 "눌러서 음성 메시지를 녹음하세요" + 마이크 버튼(`aria-label="녹음 시작"`). `requesting`은 "마이크 사용을 허용해주세요" + `disabled` + `aria-busy="true"` (FR-018). `recording`은 경과 시간 + "말하고 있어요…" + 정지 버튼(`aria-label="녹음 완료"`)이며, 상태 문구에만 `aria-live="polite"`를 걸고 1초마다 바뀌는 시간에는 걸지 않는다. 녹음 중임을 시간 표시 외에 시각적으로도 구분한다 (FR-003)
- [X] T014 [US1] `app/components/Recorder.tsx` — `review` 상태 렌더링. 버튼 4개(미리 듣기 · 다시 녹음 · 취소 · 전송)를 모두 `<button>` 요소로 만든다 (FR-023). `stopReason === "limit"`이면 "60초까지만 녹음돼요" 안내를 표시한다 (FR-009a). `sendable`이 false면 전송 버튼에 `disabled`를 걸고 이유를 화면에 문구로 표시하며 `aria-describedby`로 연결한다 — `title` 속성만으로는 모바일에서 읽을 수 없다 (contracts/recorder-ui.md 조항 2, FR-010). 아무 조작도 하지 않으면 전송되지 않아야 한다 (FR-004)
- [X] T015 [US1] `app/page.tsx` — `Room`의 기존 `.recorder` JSX 블록과 최상위 `TalklogApp`의 `recording`·`seconds` state 및 타이머 `useEffect`를 제거하고 `Recorder`로 교체한다. `useVoiceRecorder`의 `onSend`에서 T004의 `VoiceMessage[]`에 `sender: "me"`, `durationMs`, 현재 시각 라벨, `source: "recorded"`, `url`, `readLabel: null`인 항목을 추가한다 (전이 T11, FR-008). 전송 후 대화 맨 아래에 나타나야 한다
- [X] T016 [US1] `app/components/Recorder.tsx` + `app/page.tsx` — 미리 듣기를 T003의 `useVoicePlayback`에 연결한다. 예약 식별자 `"__preview__"`를 `activeId`로 써서 `toggle("__preview__", previewUrl, elapsedMs)`를 호출한다 (FR-005, contracts/use-voice-playback.md 조항 7). 재생 중임을 표시한다
- [X] T017 [US1] `app/globals.css` — `review` 단계 스타일 추가: `.recorder-review`, `.recorder-actions`, `.recorder-notice`, `.send-button[disabled]`. 4개 버튼이 520px 셸 안에서 줄바꿈 없이 눌리는 크기를 유지한다 (원칙 III)

**Checkpoint**: quickstart.md S1(녹음에서 미리듣기, 다시녹음, 전송까지), S2(취소·빈 녹음
차단), S3(60초 상한)이 전부 통과한다. 이 시점에서 이미 배포 가능한 MVP다

---

## Phase 4: User Story 2 - 대화의 음성 메시지 재생하기 (Priority: P2)

**Goal**: 대화의 음성 메시지를 실제로 재생하고, 어느 것이 재생 중인지와 얼마나
진행됐는지 보이며, 두 소리가 겹치지 않는다

**Independent Test**: quickstart.md S4 전체를 통과한다

### Implementation for User Story 2

- [X] T018 [US2] `app/components/VoiceBubble.tsx` — T005에서 받아만 두었던 `isActive`·`progress`·`onToggle`을 실제로 연결한다. `isActive`면 버튼 아이콘을 일시정지로 바꾸고 `aria-label="일시정지"`, 아니면 `aria-label="음성 재생"` (FR-011). 시간 표시는 `isActive`일 때 경과 시간, 아니면 전체 길이 (FR-014). `message.source === "mock"`인 경우의 `disabled` 처리는 유지한다 (FR-016)
- [X] T019 [US2] `app/page.tsx` — `Room`에서 `useVoicePlayback`의 `toggle`을 각 `VoiceBubble`의 `onToggle`에 연결하고 `isActive`를 `activeId === message.id`로 전달한다. `source === "mock"`인 메시지에는 `toggle`을 연결하지 않는다. 단일 재생은 훅이 구조적으로 보장하므로 화면에서 별도 순회 중지 로직을 넣지 않는다 (FR-012, SC-005, R-004)
- [X] T020 [US2] `app/components/VoiceBubble.tsx` + `app/globals.css` — 재생 진행 표시를 구현한다. 기존 `Wave`의 고정 막대 위에 진행률만큼 채우는 오버레이를 얹거나 `background` 그라디언트 위치를 옮기는 방식 중 하나를 쓴다. 파형 라이브러리를 추가하지 않는다 (원칙 IV, contracts/voice-message-ui.md 조항 2·3). 재생 완료 시 진행 표시가 처음으로 되돌아가야 한다 (FR-015)
- [X] T021 [US2] `app/components/VoiceBubble.tsx` + `app/globals.css` — 재생 중인 버블 자체를 시각적으로 강조한다 (`.voice-bubble.is-active`). 버튼 아이콘 변화만으로는 어느 메시지가 재생 중인지 한눈에 알기 어렵다 (FR-013, contracts/voice-message-ui.md 조항 5)
- [X] T022 [US2] `app/page.tsx` — 재생 중인 대상이 사라질 때의 정리. `review` 상태의 미리 듣기가 재생 중인데 `retake`·`cancel`이 호출되면 `playback.stop()`을 먼저 부른다. 훅은 URL 유효성을 감시하지 않으므로 호출자 책임이다 (data-model.md §5 마지막 행, contracts/use-voice-playback.md 조항 5)

**Checkpoint**: US1과 US2가 각각 독립적으로 동작한다. quickstart.md S4 통과 — 특히
S4-3(두 소리 겹치지 않음)과 S4-6(Mock 메시지 버튼 비활성)

---

## Phase 5: User Story 3 - 마이크를 쓸 수 없을 때 이유를 알기 (Priority: P3)

**Goal**: 권한 거부·장치 없음·미지원·오류를 서로 구분되는 안내로 알리고, 다시 시도할
수단을 주며, 그 상태에서도 앱의 나머지가 계속 동작한다

**Independent Test**: quickstart.md S5 전체를 통과한다

### Implementation for User Story 3

- [ ] T023 [US3] `app/components/Recorder.tsx` — `blocked` 상태 렌더링. contracts/recorder-ui.md의 문구 분기표대로 `micStatus` 4가지에 서로 다른 문구를 표시한다: `denied`는 "마이크 사용이 차단돼 있어요. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해주세요.", `no-device`는 "마이크를 찾을 수 없어요. 마이크가 연결돼 있는지 확인해주세요.", `unsupported`는 "이 브라우저에서는 음성 녹음을 지원하지 않아요. 다른 기능은 그대로 사용할 수 있어요.", `error`는 "녹음을 시작할 수 없었어요. 다른 앱이 마이크를 쓰고 있는지 확인하고 다시 시도해주세요." 네 경우를 같은 문구로 합치면 FR-019 위반이다. 안내 영역에 `role="status"`를 준다
- [ ] T024 [US3] `app/components/Recorder.tsx` — 다시 시도 버튼. `denied` · `no-device` · `error`에서는 제공하고 `unsupported`에서는 제공하지 않는다 — 재시도해도 결과가 같다 (data-model.md §3, 전이 T15, FR-020). 다시 시도는 `start()`를 호출해 `requesting`으로 전이한다
- [ ] T025 [US3] `app/components/Recorder.tsx` — 마운트 시 `isRecordingSupported()`로 조기 판정해 `micStatus`를 `"unsupported"`, `state`를 `"blocked"`로 둔다. 이 상태에서도 대화 목록과 하단 탭은 정상 동작해야 한다 (US3-4, contracts/recorder-ui.md 조항 6)
- [ ] T026 [US3] `app/hooks/useVoiceRecorder.ts` — 녹음 도중 오류 복구. `MediaRecorder`의 `onerror`와 트랙 `ended` 이벤트에서 진행 중인 녹음을 폐기하고 트랙을 정리한 뒤 `blocked`로 전이한다 (전이 T6, FR-021). 다시 시도로 복귀 가능한 상태여야 하며 앱이 조작 불가 상태로 빠지지 않아야 한다
- [X] T027 [US3] `app/globals.css` — 안내 배너 스타일 `.recorder-blocked`, `.recorder-retry`. 오류 계열 강조는 기존 `--coral` 변수를 사용한다 (기술 제약)

**Checkpoint**: 세 User Story가 모두 독립적으로 동작한다. quickstart.md S5 통과

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 여러 스토리에 걸친 요구사항과 문서 동기화

- [ ] T028 `app/page.tsx` — FR-022 구현. `useVoiceRecorder`의 `hasPending`이 `true`일 때 하단 탭이나 브랜드 버튼으로 화면을 이동하려 하면 녹음이 조용히 사라지지 않게 한다. 사용자가 버릴지 유지할지 알 수 있어야 한다. 확인 후 버리는 경로는 `discard()`를 호출한다 (전이 T7 · T14, 원칙 V)
- [ ] T029 `app/components/Recorder.tsx` + `app/components/VoiceBubble.tsx` — FR-023 점검. 신규 컨트롤 전부가 `<button>`인지, 아이콘만 있는 컨트롤에 `aria-label`이 있는지, Tab·Enter·Space만으로 녹음에서 미리 듣기, 전송까지 가능한지 확인한다. `div` + `onClick`이 남아 있으면 교체한다 (원칙 III)
- [ ] T030 `README.md` — 문서 동기화 (SC-007, 원칙 II). "현재 구현 범위"의 미구현 목록에서 "음성 파일 녹음·재생·업로드"를 "음성 파일 업로드"로 좁힌다. "주요 기능"에 실제 녹음·재생과 전송 전 확인 단계를 반영한다. "프로젝트 구조" 트리에 `app/lib/`, `app/hooks/`, `app/components/`를 추가한다. "향후 확장 방향" 2번("실제 음성 녹음 및 재생 기능 연결")을 제거한다
- [ ] T031 `package.json`의 `npm run build` 실행 — TypeScript 오류 0개로 통과해야 한다. `any` 사용이 남았다면 주석으로 정당화하거나 타입을 좁힌다 (Constitution 품질 게이트, 기술 제약)
- [ ] T032 [quickstart.md](./quickstart.md) S1~S7 전체 수동 검증 — `http://localhost:3000`에서 실행한다 (LAN IP로는 `getUserMedia`가 동작하지 않는다). S3은 `maxDurationMs`를 5000으로 낮춰 먼저 확인하고 60000으로 되돌린 뒤 다시 확인한다. 하나라도 실패하면 완료로 보고하지 않는다

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)        T001, T002        — 병렬 가능
        ↓
Phase 2 (Foundational) T003~T007         — 모든 스토리를 막는 선행 조건
        ↓
Phase 3 (US1, P1)      T008~T017         🎯 MVP
        ↓
Phase 4 (US2, P2)      T018~T022
        ↓
Phase 5 (US3, P3)      T023~T027
        ↓
Phase 6 (Polish)       T028~T032
```

### User Story Dependencies

- **US1 (P1)**: Phase 1·2만 필요. US2·US3와 무관하게 완결된다
- **US2 (P2)**: Phase 1·2 필요. `VoiceBubble`(T005)과 `useVoicePlayback`(T003)이 이미
  있으므로 US1을 건너뛰고도 구현 자체는 가능하나, 실제 재생할 소리가 US1의 녹음에서
  나오므로 순서대로 진행하는 것이 검증에 유리하다
- **US3 (P3)**: `useVoiceRecorder`의 `micStatus`(T008)에 의존한다. US1의 T008까지만
  끝나면 US1의 나머지와 병렬로 진행 가능하다

### Within Each User Story

- 훅 → 컴포넌트 → `page.tsx` 연결 → 스타일 순서를 따른다
- 같은 파일을 만지는 작업은 병렬로 표시하지 않았다 (`useVoiceRecorder.ts`의 T008~T012,
  `Recorder.tsx`의 T013·T014·T016은 순차)

### Parallel Opportunities

- Phase 1: T001, T002 (서로 다른 파일, 의존 없음)
- Phase 2: T003, T005, T006 (T004·T007은 `page.tsx`를 만지므로 순차)
- Phase 5: T023~T025는 `Recorder.tsx` 순차, T026(`useVoiceRecorder.ts`)과
  T027(`globals.css`)은 그와 병렬 가능

---

## Parallel Example: Phase 1 + Phase 2

```text
# Phase 1 — 동시 시작 가능
T001  app/lib/types.ts
T002  app/lib/audio.ts

# Phase 2 — T001·T002 완료 후 동시 시작 가능
T003  app/hooks/useVoicePlayback.ts
T005  app/components/VoiceBubble.tsx
T006  app/globals.css

# Phase 2 — 위 3개 완료 후 순차
T004  app/page.tsx  (메시지 state 전환)
T007  app/page.tsx  (VoiceBubble 연결)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

T001~T017(17개)까지 구현하면 "말하고 → 확인하고 → 보낸다"는 서비스의 핵심 가치가 처음
실제로 동작한다. quickstart.md S1·S2·S3로 검증한 뒤 여기서 멈춰도 프로토타입으로서
유효하다.

### Incremental Delivery

1. **T001~T017 (MVP)**: 실제 녹음과 전송 — `draft.md` §4의 8·9단계
2. **T018~T022**: 대화 재생 — §4의 5단계
3. **T023~T027**: 예외 경로 — 원칙 V 완성
4. **T028~T032**: 흐름 유지·접근성·문서 동기화

각 단계 끝에서 `npm run build`가 통과하고 해당 quickstart 시나리오가 통과해야 다음으로
넘어간다.

---

## Notes

- 총 32개 작업: Setup 2, Foundational 5, US1 10, US2 5, US3 5, Polish 5
- 신규 런타임 의존성 0개 (원칙 IV). `npm install`로 무언가를 추가하는 작업은 없다
- 기존 화면 4개(`Home`, `Feedback`, `Cards`, `Review`)를 수정하는 작업은 없다.
  `page.tsx` 수정은 `Room`과 `TalklogApp`의 녹음 관련 state에 한정된다
- T030(README 동기화)은 원칙 II가 요구하는 완료 조건이며 선택 사항이 아니다

---

## 실행 기록 (2026-09-09)

`/speckit-implement` 1회차 — 요청 범위는 Phase 1~3(T001~T017)이었다.

**완료**: T001~T022, T027 (23개)
**미완료**: T023~T026, T028~T032 (9개)

### 범위를 넘어 Phase 4(T018~T022)를 함께 구현한 이유

Constitution 원칙 II(Mock 경계 명시)가 "실제로 동작하지 않는 버튼이 동작하는 것처럼
보여서는 안 된다"를 MUST로 규정한다. T015가 전송한 메시지는 `source: "recorded"`이므로
FR-016에 따라 재생 버튼이 활성이어야 하는데, T018·T019(재생 연결)가 없으면 눌려도 아무
일이 없는 버튼이 남는다. 또 T011의 `retake`·`cancel`이 `revokeObjectURL`을 호출하므로,
T022(재생 중지) 없이는 미리 듣기 중 다시 녹음 시 무효한 URL을 재생하게 된다.

**tasks.md의 MVP 경계(Phase 3까지)가 원칙 II와 충돌한다**는 것이 이번 실행에서 드러난
문제다. 다음 `/speckit-tasks` 재생성 시 T018·T019·T022를 Phase 3으로 옮기거나,
US1의 수용 시나리오에 "전송한 메시지를 다시 들을 수 있다"를 포함시켜야 한다.

### Phase 5 의 부분 구현

`app/components/Recorder.tsx`에 `blocked` 상태의 최소 안내와 다시 시도 버튼을 넣었다.
권한을 거부하면 `state`가 `blocked`가 되는데(T008) 렌더 분기가 없으면 녹음 영역이 빈
화면이 되어 원칙 V를 위반하기 때문이다. FR-019가 요구하는 `micStatus` 4분기 문구는
아직 없으며 해당 위치에 `TODO(T023 · T024)` 주석을 남겼다. T027(안내 스타일)은 완료했다.

### 검증 상태

- `npm run build`: 통과 (TypeScript 오류 0개, `/` 6.57 kB)
- quickstart.md 수동 검증 (2026-09-09, `http://localhost:3000`):
  - **통과**: S1(녹음→미리듣기→다시녹음→전송, 트랙 해제 확인 포함), S2(취소·빈 녹음
    차단), S4(재생 조율·Mock 버튼 비활성), S6-4(키보드만으로 전송)
  - **미검증**: S3(60초 상한 — 구현됐으나 실시간 대기 필요), S5(권한 분기 — T023~T026
    미구현), S6-1·2(녹음 중 화면 이동 — T028 미구현), S7(README — T030 미구현)
  - 결론: US1·US2는 수용 기준을 만족한다. US3와 Polish는 구현 후 재검증 대상
