# Contract: 음성 메시지 버블 (`VoiceBubble`)

**File**: `app/components/VoiceBubble.tsx`
**Covers**: FR-011~FR-016, FR-023
**Constitution**: 원칙 II(Mock 경계 명시), 원칙 III(접근성), 원칙 IV(최소 의존성)

## 입력

```ts
type VoiceBubbleProps = {
  message: VoiceMessage;      // data-model.md §2
  isActive: boolean;          // playback.activeId === message.id
  progress: number;           // 0~1
  onToggle: () => void;
};
```

## 상태별 렌더링 계약

| 조건 | 재생 버튼 | 파형 | 시간 |
|------|-----------|------|------|
| `source === "recorded"`, `!isActive` | `▶`, `aria-label="음성 재생"` | 기존 `<Wave>` 고정 막대 | 전체 길이 |
| `source === "recorded"`, `isActive` | `❙❙`, `aria-label="일시정지"` | `progress`까지 채움 | 경과 시간 |
| `source === "mock"` | `▶`, `disabled` | 고정 막대 (채움 없음) | 전체 길이 |

## 조항

1. **원칙 II 핵심**: `source === "mock"` 메시지의 재생 버튼은 `disabled`이며, 왜 재생할
   수 없는지 알 수 있어야 한다 (`aria-label="재생할 음성이 없는 예시 메시지입니다"`).
   눌리는 것처럼 보이지만 아무 일도 일어나지 않는 상태를 만들어서는 안 된다 (FR-016).
2. 파형은 기존 `<Wave>` 컴포넌트의 고정 막대를 재사용한다. 실제 오디오 파형을 분석하지
   않는다 (원칙 IV, R-004).
3. 진행 표시는 CSS로 얹는다. 파형 막대 위에 `width: {progress}%` 오버레이를 두거나
   `background` 그라디언트 위치를 옮기는 방식 중 하나를 쓴다. 신규 라이브러리를 넣지
   않는다.
4. `<Wave>` 자체는 `aria-hidden="true"`를 유지한다 (원칙 III).
5. 재생 상태는 버블의 시각적 강조로도 구분돼야 한다 (FR-013). 버튼 아이콘 변화만으로는
   "어느 메시지가 재생 중인지"를 한눈에 알기 어렵다.
6. 상대방 메시지 버블의 스크립트·번역 토글(기존 `aria-expanded` / `aria-controls`)은
   그대로 유지한다.
