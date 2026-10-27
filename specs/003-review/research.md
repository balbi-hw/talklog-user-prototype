# Phase 0 Research: 저장한 표현 복습

**Feature**: [spec.md](./spec.md) | **Date**: 2026-10-27

## R-001 저장소와 복구

**Decision**: 별도 `talklog.reviews` JSON 배열, 모든 접근 try/catch. 응답 직전
표현 readAll과 복습 readAll을 다시 읽고 병합한다. 깨진 항목·고아 기록 제외.
**Rationale**: 기존 useExpressions의 초기 로드 후 ref 캐시는 최신 쓰기 기준으로 충분하지
않다. 접근 실패와 데이터 손상을 구분해야 남은 데이터를 덮어쓰지 않는다.
**Alternatives considered**: 표현 필드 확장은 상류 계약 침범, IndexedDB/서버는 범위를 넘는다.
동시 탭에서 완전히 같은 순간의 쓰기는 트랜잭션을 보장하지 않는다.

## R-002 로컬 달력

**Decision**: 로컬 연/월/일로 YYYY-MM-DD를 만들고 Date의 달력 연산으로 간격을 더한다.
**Rationale**: UTC 문자열과 24시간 밀리초 덧셈은 자정·서머타임에서 날짜가 다를 수 있다.
**Alternatives considered**: 날짜 라이브러리는 내장 Date로 충분하여 제외한다.

## R-003 세션과 집계

**Decision**: 첫 순회 최대 20개. 첫 순회의 again만 큐 끝에 한 번 추가한다.
완료는 id별 최종 응답, 누적 정답률은 재등장을 포함한 모든 성공 응답을 센다.
최초 know 1일, 이후 두 배 최대 30일. again은 간격 1로 리셋하며 이후 know는 2일이다.
**Rationale**: 무한 반복과 완료 카드 중복 집계를 막는다. 두 통계는 목적이 다르다.
**Alternatives considered**: 무제한 재추가와 재등장 응답 미저장은 각각 세션 상한/즉시 저장을 어긴다.

## R-004 화면과 포커스

**Decision**: 새 컴포넌트로 분리. 전환 후 다음 뜻 보기 버튼, 완료 제목에 포커스한다.
**Rationale**: 병합 충돌과 사라진 응답 버튼에서의 포커스 유실을 막는다.
**Alternatives considered**: page 내부 전체 구현은 다른 기능 변경과 섞인다.

## 입력과 조사

두 번째 지정 경로 briefs$f.md가 없어 같은 폴더의 003-review.md를 사용했다.
현재 브랜치/기능명/소유 경계와 일치한다. speckit-plan의 연구 에이전트는 기존 코드 기반으로
저장소·로컬 날짜·세션 규칙을 검토했고 위 결정을 확인했다. 외부 검색이나 미확정 선택은 없다.
