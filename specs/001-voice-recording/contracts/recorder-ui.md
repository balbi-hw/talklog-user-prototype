# Contract: 녹음 영역 UI (`Recorder`)

**File**: `app/components/Recorder.tsx`
**Covers**: FR-002~FR-007, FR-009a, FR-010, FR-018~FR-021, FR-023
**Constitution**: 원칙 III(접근성), 원칙 V(상태 전이 완결성)

`useVoiceRecorder`의 `state` · `micStatus`에 따라 아래 5가지 중 정확히 하나를 렌더링한다.
정의되지 않은 조합은 없다.

## 상태별 렌더링 계약

| `state` | 표시 문구 | 컨트롤 | 접근성 |
|---------|-----------|--------|--------|
| `idle` | "눌러서 음성 메시지를 녹음하세요" | 마이크 버튼 1개 | `aria-label="녹음 시작"` |
| `requesting` | "마이크 사용을 허용해주세요" | 마이크 버튼 (비활성) | `aria-busy="true"`, `disabled` |
| `recording` | `● 00:SS` + "말하고 있어요…" | 정지 버튼 1개 | `aria-label="녹음 완료"`, 시간은 `aria-live="off"` (1초마다 읽히면 방해됨), 상태 문구만 `aria-live="polite"` |
| `review` | `00:SS` + (`stopReason === "limit"` 이면 "60초까지만 녹음돼요") | 미리 듣기 / 다시 녹음 / 취소 / 전송 | 각 버튼 텍스트 라벨 보유. 전송은 `sendable === false` 면 `disabled` + `aria-describedby` 로 이유 연결 |
| `blocked` | `micStatus` 별 문구 (아래) | `unsupported` 외에는 "다시 시도" 버튼 | 안내 영역 `role="status"` |

## `blocked` 상태의 문구 분기 (FR-019)

| `micStatus` | 문구 | 다시 시도 |
|-------------|------|-----------|
| `denied` | "마이크 사용이 차단돼 있어요. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해주세요." | 제공 |
| `no-device` | "마이크를 찾을 수 없어요. 마이크가 연결돼 있는지 확인해주세요." | 제공 |
| `unsupported` | "이 브라우저에서는 음성 녹음을 지원하지 않아요. 다른 기능은 그대로 사용할 수 있어요." | 제공하지 않음 |
| `error` | "녹음을 시작할 수 없었어요. 다른 앱이 마이크를 쓰고 있는지 확인하고 다시 시도해주세요." | 제공 |

문구는 서로 구분돼야 한다. 네 경우를 같은 문구로 합치면 FR-019 위반이다.

## 조항

1. `review`에서 아무 조작을 하지 않아도 전송되지 않는다 (FR-004, 시나리오 US1-7).
2. 전송 버튼이 `disabled`일 때 이유 문구가 화면에 보여야 한다. `title` 속성만으로는
   모바일에서 읽을 수 없다 (FR-010).
3. 모든 버튼은 `<button>` 요소다. `div` + `onClick`을 쓰지 않는다 (FR-023).
4. 아이콘만 있는 컨트롤(마이크·정지)은 `aria-label`을 갖는다 (원칙 III).
5. 신규 스타일은 `app/globals.css`에 시맨틱 클래스로 추가한다. Tailwind 유틸리티를 JSX에
   흩뿌리지 않는다 (기술 제약).
6. `unsupported`일 때도 화면의 나머지(대화·하단 탭)는 정상 동작해야 한다 (US3-4).
