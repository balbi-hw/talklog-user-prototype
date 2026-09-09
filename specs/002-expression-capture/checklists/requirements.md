# Specification Quality Checklist: 스크립트에서 표현 선택·저장

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Constitution v1.1.0 원칙 I 준수

- [x] 소속 서브도메인과 분류 명시 — 표현 학습 (Core)
- [x] 검증하는 `draft.md` §4 흐름 단계 명시 — 10·11·12단계
- [x] 유비쿼터스 언어 용어집 준수 — 저장 단위는 "표현", 복습 단위는 "카드"로만 지칭

## Notes

- 1차 검증 (2026-09-09): 총 19개 항목 중 17개 통과, 2개는 FR-002 의
  `[NEEDS CLARIFICATION]` 에 의존.
- 초안에서 발견해 추가한 사항:
  - FR-024 — Feedback 화면의 "+ 카드에 저장" 이 저장한 것처럼 상태만 바꾸는 것은
    원칙 II(Mock 경계 명시) 위반이다. 요구사항으로 끌어올렸다.
  - FR-025 · FR-026 — 카드 화면의 하드코딩 표현 3개와 "8장" 표시, 동작하지 않는 복습
    시작 버튼도 같은 위반이다.
  - FR-027 — 원칙 I(v1.1.0)이 용어집 준수를 MUST 로 요구하므로, `.word-card` 계열
    식별자와 "플래시카드" 문구 정리를 요구사항에 포함했다.
  - FR-015 — 브라우저 저장소를 쓸 수 없는 환경(사생활 보호 모드, 저장소 가득 참)은
    원칙 V 가 요구하는 실패 경로다.
  - FR-020 — 목록 화면의 긴 입력 처리. 뜻을 사용자가 직접 적으므로 길이 상한이 없다.
- 2차 검증 (2026-09-09): 19개 항목 전부 통과. FR-002 를 "스크립트 위에서 글자 범위를
  직접 끌어 고르기"로 확정하고, FR-002a(저장 전 글자 단위 수정), US1 시나리오 1a,
  엣지 케이스 2건(선택 해제 · 브라우저별 선택 UI 차이)을 함께 추가했다.
- 결론: `/speckit-plan` 진행 가능.
