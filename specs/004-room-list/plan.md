# Implementation Plan: 학습방 목록·개설

**Branch**: `004-room-list` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: `/specs/004-room-list/spec.md`

**서브도메인**: 학습 관계 (**Supporting**)

## Summary

학습방 저장소·훅·목록·개설·홈 요약을 새 파일로 분리하고 셸에서 선택 학습방과 id별 메시지를 소유한다. 기존 음성·표현 경로를 보존한다.

## Technical Context

**Language/Version**: TypeScript 5 strict, Next.js 15 App Router, React 19

**Primary Dependencies**: 기존 next/react/react-dom만 사용, 신규 0개

**Storage**: talklog.rooms JSON 배열, 녹음과 마지막 전송 시각은 메모리

**Testing**: npm.cmd run build, 순수 저장소 경계 검증, 별도 검증자의 quickstart 수동 검증

**Target Platform**: 모바일 우선 520px 셸, 최신 브라우저

**Project Type**: 프론트엔드 프로토타입

**Performance Goals**: 수십~수백 학습방의 동기 입력·즉시 화면 전환

**Constraints**: 서버·외부 API·신규 런타임 의존성·새 색상 리터럴 없음

**Scale/Scope**: 목록·개설 2개 화면과 기존 홈/대화 연결

## Constitution Check

| 원칙 | 연구 전 | 설계 후 근거 |
|---|---|---|
| I 도메인·흐름·용어 | PASS | 학습 관계 Supporting, 흐름 2·3, room/partner |
| II Mock 경계 | PASS | 예시 식별, 실제 개설·삭제, 초대·전달 미구현 안내 |
| III 접근성 | PASS | 폼 라벨·확인 aria-expanded/controls·포커스 복구 |
| IV 최소 의존성 | PASS | React·표준 API만 사용 |
| V 상태 완결 | PASS | 3상태·빈 대화·삭제 확인·실패 유지·재시도 |
| 기술·품질 | PASS | strict·CSS 변수·빌드·README 동기화·브랜치 유지 |

## Project Structure

```text
specs/004-room-list/
  spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
  checklists/requirements.md
  contracts/use-rooms.md, contracts/room-ui.md
app/
  lib/rooms.ts
  hooks/useRooms.ts
  components/RoomList.tsx, RoomCreate.tsx, RoomSummary.tsx
  page.tsx
  globals.css
```

**Structure Decision**: 002의 lib/hooks/components 구조를 따른다. ExpressionList/useExpressions·복습·홈 기록 섹션은 수정하지 않는다. 메시지 타입은 재사용하고 활동 시각은 별도 맵에 둔다.

## Phases

저장소·훅 → US1 목록·입장 → US2 개설·분리 → US3 확인 삭제·URL 정리 → 문서·빌드·검증 순서다. 자세한 계약은 contracts, 검증은 quickstart에 있다.

## Complexity Tracking

헌법 위반·새 계층·신규 의존성 없음.
