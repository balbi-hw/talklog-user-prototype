# Phase 1 Data Model: 실제 음성 녹음·재생

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-09

spec.md의 Key Entities를 구현 가능한 형태로 구체화한다. 저장소가 없으므로 모든 엔티티는
런타임 메모리 상태이며, 스키마가 아니라 상태 모델이다.

---

## 1. VoiceRecording — 전송 전 녹음

전송되지 않은, 방금 만든 음성. 동시에 최대 1개만 존재한다.

| 필드 | 타입 | 설명 | 유래 |
|------|------|------|------|
| `blob` | `Blob` | 녹음된 소리 데이터 | FR-001 |
| `url` | `string` | `createObjectURL(blob)` 결과. 미리 듣기용 | R-004 |
| `durationMs` | `number` | 자체 타이머로 측정한 길이 | R-003, FR-008 |
| `mimeType` | `string` | 실제로 선택된 형식 | R-001 |
| `stopReason` | `"user" \| "limit"` | 사용자가 멈췄는지, 60초 상한인지 | FR-009a, R-006 |
| `sendable` | `boolean` (파생) | `durationMs >= 1000 && blob.size > 0` | FR-010, R-007 |

**생명주기**: 녹음 종료 시 생성 → 전송(VoiceMessage로 변환) / 다시 녹음 / 취소 시 소멸.
소멸 시 반드시 `revokeObjectURL(url)`을 호출한다 (R-004).

**검증 규칙**:
- `durationMs`는 0보다 커야 한다. 0이면 오류 상태로 전이한다.
- `sendable`이 `false`인 동안 전송 동작은 호출되어서는 안 된다 (FR-010).

---

## 2. VoiceMessage — 대화에 놓인 음성

| 필드 | 타입 | 설명 | 유래 |
|------|------|------|------|
| `id` | `string` | 목록 key 및 재생 대상 식별자 | — |
| `sender` | `"me" \| "partner"` | 보낸 사람 | FR-008 |
| `durationMs` | `number` | 표시할 길이 | FR-008 |
| `sentAtLabel` | `string` | "오전 9:46" 형태의 표시 문자열 | 기존 UI |
| `source` | `"mock" \| "recorded"` | 재생할 실제 소리가 있는지 | **FR-016**, 원칙 II |
| `url` | `string \| null` | `source === "recorded"` 일 때만 값이 있다 | R-004 |
| `readLabel` | `string \| null` | "읽음" 등 기존 표시 | 기존 UI |

**핵심 불변식** (원칙 II — Mock 경계 명시):

```
source === "recorded"  ⟺  url !== null
source === "mock"      ⟹  url === null  → 재생 버튼은 비활성 상태여야 한다
```

기존 대화의 Mock 메시지 2개는 `source: "mock"`으로 유지한다. 재생 버튼이 눌리는 것처럼
보이되 아무 소리도 나지 않는 상태를 만들어서는 안 된다 (FR-016).

---

## 3. MicrophoneStatus — 마이크 사용 상태

```
"unknown" | "requesting" | "granted" | "denied" | "no-device" | "unsupported" | "error"
```

| 상태 | 진입 조건 | 녹음 영역이 보여주는 것 | 유래 |
|------|-----------|--------------------------|------|
| `unknown` | 초기값 | 평소 녹음 안내 문구 + 마이크 버튼 | FR-017 |
| `requesting` | `getUserMedia()` 호출 직후 | "마이크 사용을 허용해주세요" + 버튼 비활성 | FR-018 |
| `granted` | `getUserMedia()` 성공 | 녹음 진행 UI | FR-001 |
| `denied` | `NotAllowedError` | 거부 안내 + 허용 방법 + 다시 시도 버튼 | FR-019, FR-020 |
| `no-device` | `NotFoundError` / `OverconstrainedError` | "마이크를 찾을 수 없어요" | FR-019 |
| `unsupported` | `MediaRecorder` 없음 또는 `SecurityError` | "이 브라우저에서는 녹음할 수 없어요" | FR-019 |
| `error` | `NotReadableError` / `AbortError` / 기타 | 일반 오류 안내 + 다시 시도 | FR-021 |

오류 분류 규칙은 [research.md R-002](./research.md)를 따른다.

`denied` · `no-device` · `error` 에서 다시 시도하면 `requesting`으로 전이한다.
`unsupported`는 다시 시도 수단을 제공하지 않는다 (재시도해도 결과가 같다).

---

## 4. RecordingState — 녹음 상태 머신

```
idle → requesting → recording → review → (idle)
                 ↘ blocked
       recording ↘ error → idle
```

| 상태 | 의미 |
|------|------|
| `idle` | 녹음 전. 마이크 버튼만 보인다 |
| `requesting` | 권한 요청 중 |
| `recording` | 녹음 중. 경과 시간이 올라간다 |
| `review` | 녹음 종료. 미리 듣기 · 다시 녹음 · 전송 · 취소 가능 (FR-004) |
| `blocked` | 권한 거부 · 장치 없음 · 미지원 · 오류로 녹음 불가 |

### 전이 표 (정의되지 않은 전이 없음 — 원칙 V)

| # | 현재 상태 | 트리거 | 다음 상태 | 부수 효과 |
|---|-----------|--------|-----------|-----------|
| T1 | `idle` | 마이크 버튼 | `requesting` | `getUserMedia()` 호출 |
| T2 | `requesting` | 권한 허용 | `recording` | `MediaRecorder.start()`, 시작 시각 기록 |
| T3 | `requesting` | 권한 거부·오류 | `blocked` | MicrophoneStatus 갱신 |
| T4 | `recording` | 마이크 버튼 | `review` | `stop()`, `stopReason = "user"`, 트랙 정리 (R-005) |
| T5 | `recording` | 경과 ≥ 60초 | `review` | `stop()`, `stopReason = "limit"`, 트랙 정리 |
| T6 | `recording` | 녹음 오류 | `blocked` | 녹음 폐기, 트랙 정리 |
| T7 | `recording` | 화면 이동 시도 | `recording` 유지 | 확인 요청 (FR-022). 확인 시 폐기 후 `idle` |
| T8 | `recording` | 언마운트 | — | 트랙 정리, URL 해제 (R-005) |
| T9 | `review` | 미리 듣기 | `review` 유지 | 재생 시작. 진행 중인 대화 재생은 멈춘다 |
| T10 | `review` | 다시 녹음 | `requesting` | 이전 녹음 폐기 + `revokeObjectURL` |
| T11 | `review` | 전송 (`sendable`) | `idle` | VoiceMessage 추가, 녹음 상태 초기화 |
| T12 | `review` | 전송 (`!sendable`) | `review` 유지 | 전송 차단 + 이유 표시 (FR-010) |
| T13 | `review` | 취소 | `idle` | 녹음 폐기 + `revokeObjectURL` (FR-007) |
| T14 | `review` | 화면 이동 시도 | `review` 유지 | 확인 요청 (FR-022) |
| T15 | `blocked` | 다시 시도 | `requesting` | `unsupported`에서는 이 트리거를 제공하지 않음 |

**T11이 만드는 VoiceMessage**:

```
{ id: 새 식별자, sender: "me", durationMs: recording.durationMs,
  sentAtLabel: 현재 시각, source: "recorded", url: recording.url, readLabel: null }
```

전송된 녹음의 `url`은 메시지가 소유하므로 이 경로에서는 `revokeObjectURL`을 호출하지
않는다. T10 · T13과 구분해야 하는 지점이다.

---

## 5. PlaybackState — 재생 상태

대화 전체에서 **하나만** 존재한다 (FR-012, R-004).

| 필드 | 타입 | 설명 |
|------|------|------|
| `activeId` | `string \| null` | 재생 중인 대상. `null`이면 정지 상태 |
| `positionMs` | `number` | 현재 재생 위치 |
| `durationMs` | `number` | 재생 중 대상의 전체 길이 |

재생 대상은 대화의 VoiceMessage이거나 `review` 상태의 VoiceRecording(미리 듣기)이다.
미리 듣기는 예약 식별자 `"__preview__"`를 `activeId`로 쓴다.

### 전이 규칙

| 현재 | 트리거 | 결과 | 유래 |
|------|--------|------|------|
| `activeId === null` | 대상 A 재생 | `activeId = A`, 위치 0부터 재생 | FR-011 |
| `activeId === A` | 대상 A 재생 | `activeId = null`, 재생 정지 | FR-011 |
| `activeId === A` | 대상 B 재생 | `activeId = B`, A 정지 후 B를 0부터 | FR-012 |
| `activeId === A` | `timeupdate` | `positionMs` 갱신 | FR-014 |
| `activeId === A` | `ended` | `activeId = null`, `positionMs = 0` | FR-015 |
| `activeId === A` | A가 목록에서 사라짐 | `activeId = null` | T10 · T13 |
| 임의 | `source === "mock"` 대상 재생 | 상태 변화 없음. 버튼이 애초에 비활성 | FR-016 |

진행률은 `positionMs / durationMs` 로 계산한다. `audio.duration`은 `Infinity`일 수
있으므로 분모로 쓰지 않는다 (R-003).

---

## 엔티티 관계

```
MicrophoneStatus ──제약──> RecordingState ──T11──> VoiceMessage[]
                                 │                       │
                              review                     │
                                 │                       │
                                 ↓                       ↓
                           VoiceRecording ──────> PlaybackState (단일)
                                                         ↑
                                              activeId 로 하나만 지목
```
