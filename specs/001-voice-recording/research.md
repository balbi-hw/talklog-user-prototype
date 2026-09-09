# Phase 0 Research: 실제 음성 녹음·재생

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-09-09

Technical Context에 남은 미확정 항목과, Constitution 원칙 IV(최소 의존성)가 요구하는
"표준 API로 해결 가능한지" 검토 결과를 정리한다.

---

## R-001: 녹음 API와 출력 형식 선택

**Decision**: `MediaRecorder`를 사용하고, `MediaRecorder.isTypeSupported()`로 후보
mimeType을 순서대로 검사해 첫 번째 지원 형식을 쓴다. 후보 순서는
`audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg;codecs=opus` →
`""`(브라우저 기본값).

**Rationale**: 브라우저마다 지원 컨테이너가 다르다. Chromium 계열은 webm/opus,
Safari는 mp4/AAC, Firefox는 webm과 ogg/opus를 지원한다. 형식을 하드코딩하면 특정
브라우저에서 `NotSupportedError`로 녹음이 아예 시작되지 않는다. `isTypeSupported`로
런타임 선택하면 지원 목록을 코드에 고정하지 않아도 된다. 빈 문자열을 마지막 후보로 두면
브라우저 기본값에 위임할 수 있다.

프로토타입은 음질·파일 크기·서버 호환성을 요구하지 않으므로(spec Assumptions) 어떤
형식이 선택되든 흐름 검증에는 영향이 없다.

**Alternatives considered**:
- `RecordRTC` / `extendable-media-recorder` 등 래퍼 라이브러리 — 형식 통일(wav 강제)을
  제공하지만 원칙 IV 위반이고, 통일된 형식이 필요한 요구사항이 없다.
- Web Audio API `AudioWorklet`으로 직접 PCM 수집 후 WAV 인코딩 — 형식을 완전히 통제할
  수 있지만 인코딩 코드를 직접 들여야 하고 흐름 검증에 기여하지 않는다.

---

## R-002: 마이크 권한 상태 판별

**Decision**: `navigator.permissions.query({ name: "microphone" })`에 의존하지 않는다.
권한 상태는 `getUserMedia()` 호출 결과의 오류 `name`으로 분류한다.

| `error.name` | 의미 | 매핑되는 마이크 상태 |
|--------------|------|----------------------|
| (성공) | 허용됨 | `granted` |
| `NotAllowedError` | 사용자가 거부 또는 정책 차단 | `denied` |
| `NotFoundError` / `OverconstrainedError` | 사용 가능한 마이크 없음 | `no-device` |
| `NotReadableError` / `AbortError` | 장치를 다른 앱이 점유하거나 하드웨어 오류 | `error` |
| `SecurityError` | secure context 아님 | `unsupported` |

미지원 판별은 `typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia`
로 한다.

**Rationale**: Permissions API의 `microphone` 디스크립터는 브라우저 지원이 고르지 않아
Safari와 Firefox에서 조회 자체가 실패하거나 예외를 던진다. 지원 여부를 다시 분기하면
코드가 두 갈래로 늘어난다. `getUserMedia`의 오류 이름은 표준으로 정의돼 있어 어느
브라우저에서든 같은 방식으로 분류할 수 있다.

이 결정이 FR-017(첫 녹음 시도 시에만 권한 요청)과도 맞는다. Permissions API로 미리
조회하지 않으므로 학습방 진입만으로는 권한 요청이 발생하지 않는다.

**Alternatives considered**:
- Permissions API 우선 + 실패 시 폴백 — 상태 판별 경로가 둘로 늘어나 원칙 V의
  "정의되지 않은 전이 없음"을 지키기 어려워진다.
- 진입 시 미리 권한 요청 — FR-017 위반. 사용자가 아직 녹음할 의도가 없을 때 권한 팝업이
  뜨면 거부율이 올라간다.

---

## R-003: 녹음 길이 측정 (SC-003의 핵심)

**Decision**: `MediaRecorder`가 만든 `Blob`에서 길이를 읽지 않는다. 녹음 시작 시각을
`performance.now()`로 기록하고 종료 시각과의 차이를 길이로 삼는다. 화면에 표시하는
경과 시간도 `setInterval` 카운터가 아니라 이 시작 시각과의 차이에서 계산한다.

**Rationale**: 스트리밍으로 생성된 webm Blob에는 duration 메타데이터가 기록되지 않아
`HTMLAudioElement.duration`이 `Infinity`로 나오는 것이 알려진 동작이다. 이 값을 그대로
표시하면 FR-008(실제 녹음 길이 표시)과 SC-003(오차 1초 이내)을 만족할 수 없다.

`setInterval` 카운터를 그대로 길이로 쓰는 방식도 부적합하다. 탭이 백그라운드로 가면
브라우저가 타이머를 throttle 하므로(엣지 케이스: "녹음 중 탭을 벗어나면") 카운터가
실제 경과보다 뒤처진다. 시작 시각 기준 차이 계산은 throttle 영향을 받지 않는다.
`setInterval`은 화면 갱신 트리거로만 쓴다.

**Alternatives considered**:
- Blob을 다시 디코딩해 `AudioContext.decodeAudioData`로 정확한 길이 산출 — 정확하지만
  60초 오디오 디코딩 비용을 전송 전 단계마다 지불하고, 오차 1초 이내라는 기준에는
  타이머만으로 충분하다.
- webm 메타데이터를 후처리로 주입(`ts-ebml` 등) — 신규 의존성이며 원칙 IV 위반.

---

## R-004: 재생 방식과 단일 재생 보장 (FR-012)

**Decision**: 녹음 Blob은 `URL.createObjectURL(blob)`로 URL을 만들어
`HTMLAudioElement`에 넣는다. 대화 전체에서 `HTMLAudioElement` 인스턴스는 **하나만**
두고, 재생 대상이 바뀔 때 `src`를 교체한다. 진행 위치는 `timeupdate` 이벤트로 갱신하고,
`ended`에서 초기 상태로 되돌린다.

**Rationale**: 메시지마다 `<audio>`를 두면 FR-012(동시에 하나만 재생)를 지키기 위해
모든 인스턴스를 순회해 멈춰야 하고, 인스턴스가 늘어날수록 누락 위험이 커진다. 단일
인스턴스 + `src` 교체 방식은 "새 재생이 이전 재생을 멈춘다"가 구조적으로 보장된다.
진행률 계산은 R-003에서 측정한 길이를 분모로 쓴다(`audio.duration`이 `Infinity`일 수
있으므로).

`createObjectURL`로 만든 URL은 녹음이 버려질 때(다시 녹음·취소) `revokeObjectURL`로
해제한다. 해제하지 않으면 60초 녹음을 반복할 때 메모리가 계속 쌓인다.

**Alternatives considered**:
- 메시지별 `<audio>` 인스턴스 — 위 이유로 기각.
- Web Audio API `AudioBufferSourceNode` — 파형 시각화에 유리하지만 이 기능은 기존
  `<Wave>`의 고정 막대를 재사용하기로 했으므로(원칙 IV) 이점이 없다.
- Blob을 base64 data URL로 변환 — 60초 오디오에서 문자열이 수 MB로 커지고 변환 비용이
  든다.

---

## R-005: 스트림과 타이머 정리 시점

**Decision**: 녹음이 종료되는 모든 경로에서 `stream.getTracks().forEach(t => t.stop())`
를 호출한다. 종료 경로는 5가지다 — 사용자 종료, 60초 자동 종료, 오류 발생, 컴포넌트
언마운트, 화면 이동. `MediaRecorder`의 `onstop` 핸들러 한 곳에서 정리하고, 언마운트는
`useEffect` cleanup에서 같은 정리 함수를 호출한다.

**Rationale**: 트랙을 멈추지 않으면 브라우저 탭의 녹음 표시가 계속 켜져 있고, 모바일에서
마이크가 점유된 채로 남는다. 사용자는 녹음을 끝냈다고 인식하는데 장치는 여전히 열려
있으므로 신뢰 문제로 직결된다. 정리 함수를 한 곳으로 모으면 원칙 V가 요구하는 "정의되지
않은 전이 없음"을 코드 수준에서도 유지할 수 있다.

**Alternatives considered**:
- 스트림을 한 번 얻어 재사용하고 트랙을 멈추지 않음 — 두 번째 녹음의 시작이 빨라지지만
  위 문제로 기각.

---

## R-006: 60초 상한 구현 (FR-009 / FR-009a)

**Decision**: `MediaRecorder.start()`에 timeslice를 넘기지 않고, 화면 갱신용
`setInterval`에서 경과가 60초 이상이면 종료 함수를 호출한다. 종료 사유를
`"user" | "limit" | "error"` 로 구분해 상태에 남기고, `limit`인 경우 전송 전 단계에
자동 종료 안내를 표시한다.

**Rationale**: `MediaRecorder`에는 최대 길이 옵션이 없어 호출 측에서 끊어야 한다. 종료
사유를 남기지 않으면 FR-009a(자동 종료 사실 표시)를 만족할 수 없다. 경과 판단은
R-003의 시작 시각 기준 계산을 재사용하므로 타이머 throttle 상황에서도 60초를 크게
넘기지 않는다.

**Alternatives considered**:
- `setTimeout(stop, 60000)` 단독 — 백그라운드 throttle 시 실제 종료가 늦어지고, 화면
  타이머와 값이 어긋날 수 있다.

---

## R-007: 빈 녹음 판정 (FR-010)

**Decision**: 길이가 1초 미만이거나 `Blob.size`가 0인 녹음은 전송 불가로 판정하고,
전송 버튼을 비활성화하며 이유를 문구로 표시한다. 실제 음량 분석은 하지 않는다.

**Rationale**: "소리가 담기지 않은" 녹음을 음량으로 판정하려면 디코딩과 RMS 계산이
필요하고, 이는 원칙 IV가 요구하는 정당화 기준을 넘기지 못한다. 흐름 검증 목적에서는
"너무 짧아서 실수로 누른 것"을 걸러내는 것으로 충분하다. 음량 판정이 필요해지면 별도
기능으로 다룬다.

**Alternatives considered**:
- `AnalyserNode`로 실시간 음량 측정 후 무음 판정 — 정확하지만 목적 대비 과도하고,
  판정 임계값이라는 새 미확정 항목을 만든다.

---

## 결론

미확정 항목이 남지 않았다. Technical Context의 모든 값이 확정됐고, 신규 런타임 의존성은
0개다. Phase 1 설계로 진행한다.
