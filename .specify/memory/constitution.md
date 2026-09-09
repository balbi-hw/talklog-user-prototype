<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - "I. 흐름 검증 우선 (Flow-Validation First)"
    → "I. 도메인 경계와 흐름 검증 (Domain Boundaries & Flow Validation)"
    - `docs/domain-model.md` 를 제품 최상위 설계로 참조
    - 기능 명세가 소속 서브도메인과 분류(Core/Supporting/Generic)를 밝히도록 MUST 추가
    - 유비쿼터스 언어 용어집 준수를 MUST 추가
    - "모든 작업"의 범위를 "모든 기능 작업(`specs/NNN-*` 단위)"으로 명확화
      (analyze 지적 D1 해소 — task 단위인지 기능 단위인지 모호했음)
- Unchanged principles: II. Mock 경계 명시, III. 모바일 우선·접근성, IV. 최소 의존성,
  V. 상태 전이 완결성
- Modified sections:
  - Governance: 설계 문서 우선순위에 `docs/domain-model.md` 추가
  - Governance 준수 검토: 서브도메인 명시 항목 추가
- Unchanged sections: 기술 제약, 개발 워크플로
- Added sections: none
- Removed sections: none
- Bump rationale: MINOR — 기존 원칙을 제거하거나 재정의하지 않고 지침을 실질적으로
  확장했다. 새 MUST 두 개가 추가되므로 PATCH 가 아니다.
- Follow-up TODOs: none
- 이전 이력: 1.0.0 (2026-09-09) 최초 제정 — 원칙 5개, 기술 제약, 개발 워크플로,
  Governance 신설
-->

# Talklog Constitution

## Core Principles

### I. 도메인 경계와 흐름 검증 (Domain Boundaries & Flow Validation)

제품 최상위 설계는 `docs/domain-model.md`이며, 모든 기능 작업은 그 지도 안에 자리를
가져야 한다.

- 모든 기능 명세(`specs/NNN-*/spec.md`)는 소속 서브도메인과 그 분류(Core / Supporting /
  Generic)를 밝혀야 한다 (MUST).
- 모든 기능 명세와 코드는 `docs/domain-model.md` §4의 유비쿼터스 언어 용어집을 따라야
  한다 (MUST). 용어집의 "쓰지 않는 말"을 문서·코드 식별자·화면 문구에 사용해서는 안
  된다 (MUST NOT). 새 개념이 필요하면 용어집을 먼저 개정한다.
- 모든 기능 작업은 `draft.md` §4의 핵심 사용자 흐름 14단계 중 어느 단계를 검증하는지
  명시해야 한다 (MUST). 여기서 "기능 작업"은 하나의 `specs/NNN-*` 단위를 뜻하며 개별
  task 를 뜻하지 않는다.
- 흐름 검증에 기여하지 않는 기능은 범위에서 제외한다.
- 기능의 "완성도"보다 사용자가 설명 없이 다음 행동을 선택할 수 있는지가 완료 판단
  기준이다.

근거: 이 프로젝트는 프로덕션 서비스가 아니라 흐름 검증용 프로토타입이다. 검증 목적을
잃은 기능 추가는 흐름을 흐리게 만들고, 같은 개념을 서로 다른 말로 부르면 명세와 코드가
조용히 갈라진다. 도메인 지도는 기능 명세가 답하는 "무엇을 만드는가" 이전에 "왜 그것이
먼저인가"를 답한다.

### II. Mock 경계 명시 (Explicit Mock Boundaries)

Mock 데이터·미구현 기능은 코드와 문서 양쪽에서 식별 가능해야 한다.

- Mock 데이터는 실제 데이터 소스와 구분되는 위치·이름을 가져야 한다 (MUST).
- 실제로 동작하지 않는 버튼이 동작하는 것처럼 보여서는 안 된다 (MUST NOT).
- 새로 구현한 실제 기능은 `README.md`의 "현재 구현 범위"에서 미구현 목록에서 제거해야
  한다 (MUST).

근거: 프로토타입은 무엇이 진짜인지 흐려지는 순간 검증 도구로서의 신뢰를 잃는다.

### III. 모바일 우선·접근성 (Mobile-First & Accessible)

레이아웃은 `.phone-frame` 520px 셸을 기준으로 설계하며, 데스크톱은 셸을 중앙 정렬하는
것으로 충족한다.

- 모든 인터랙티브 요소는 키보드로 도달·조작 가능해야 한다 (MUST).
- 아이콘만 있는 컨트롤은 `aria-label`을 가져야 한다 (MUST).
- 열고 닫는 영역은 `aria-expanded`와 `aria-controls`를 가져야 한다 (MUST).
- 장식용 그래픽은 `aria-hidden="true"`로 표시해야 한다 (MUST).

근거: 대표 사용자가 모바일 앱 사용자이며, 접근성 속성은 나중에 덧붙이면 구조를 다시
바꿔야 한다.

### IV. 최소 의존성 (Minimal Dependencies)

웹 표준 API를 우선하고, 새 런타임 의존성 추가는 명시적 정당화를 요구한다.

- 표준 브라우저 API로 해결 가능한 문제에 라이브러리를 추가해서는 안 된다 (MUST NOT).
- 새 의존성은 해당 기능의 `plan.md`에 대안 검토와 함께 기록해야 한다 (MUST).
- 상태 관리는 React 내장 기능으로 시작한다 (MUST).

근거: 현재 런타임 의존성은 next·react·react-dom 3개뿐이며, 이 가벼움이 프로토타입의
반복 속도를 만든다.

### V. 상태 전이 완결성 (Complete State Coverage)

사용자 흐름의 각 단계는 성공 경로만으로 완료로 간주하지 않는다.

- 비동기·권한 의존 기능은 대기·진행·성공·실패·권한 거부 상태를 모두 정의해야 한다 (MUST).
- 목록 화면은 빈 상태를 정의해야 한다 (MUST).
- 되돌릴 수 없는 전송·삭제 동작은 확인 단계 또는 취소 수단을 제공해야 한다 (MUST).

근거: `draft.md` §5.4는 "실수로 바로 전송되지 않는가?"를 검증 항목으로 명시하며,
예외 경로가 없는 프로토타입은 실제 사용 문제를 드러내지 못한다.

## 기술 제약 (Technology Constraints)

- 프레임워크: Next.js 15 App Router, React 19. Pages Router를 추가하지 않는다.
- 언어: TypeScript 5, `strict: true`. `any` 사용은 주석으로 정당화해야 한다.
- 스타일: `app/globals.css`의 시맨틱 클래스와 CSS 변수를 사용한다. Tailwind 유틸리티
  클래스를 JSX에 직접 흩뿌리지 않는다. 색상은 `:root` CSS 변수로만 정의한다.
- 백엔드: 서버·데이터베이스·외부 API를 추가하지 않는다. 영속성이 필요하면 브라우저
  저장소를 사용한다.
- 플랫폼: 개발 환경은 Windows이며 Spec Kit 스크립트는 PowerShell(`ps`) 변형을 사용한다.

## 개발 워크플로 (Development Workflow)

기능 작업은 Spec-Driven Development 순서를 따른다.

1. `/speckit-specify` — 기능 명세 작성 (기술 선택 없이 요구사항과 수용 기준만)
2. `/speckit-clarify` — 모호한 영역 해소 (선택)
3. `/speckit-plan` — 기술 구현 계획
4. `/speckit-tasks` — 실행 가능한 작업 분해
5. `/speckit-analyze` — 산출물 간 일관성 검토 (선택)
6. `/speckit-implement` — 구현

품질 게이트:

- 구현 완료 판정 전 `npm run build`가 성공해야 한다 (MUST).
- TypeScript 오류가 남은 상태를 완료로 보고해서는 안 된다 (MUST NOT).
- 각 기능의 수용 기준은 브라우저에서 수동으로 확인 가능한 형태로 작성해야 한다 (MUST).
- 자동화 테스트는 현재 필수가 아니다. 도입 시 이 문서를 개정한다.

## Governance

이 문서는 프로젝트의 다른 관행보다 우선한다. 설계 문서의 우선순위는

1. `.specify/memory/constitution.md` (이 문서)
2. `docs/domain-model.md`
3. `README.md` · `draft.md`

순이며, 충돌하는 경우 위쪽을 따르고 충돌 사실을 개정 안건으로 남긴다.

개정 절차:

1. 개정 제안은 변경할 원칙, 변경 이유, 기존 코드에 미치는 영향을 함께 기술한다.
2. 개정이 승인되면 `CONSTITUTION_VERSION`을 갱신하고 Sync Impact Report를 문서 상단에
   기록한다.
3. 기존 코드가 새 원칙을 위반하면 마이그레이션 계획을 함께 남긴다.

버전 정책 (semantic versioning):

- MAJOR: 원칙 제거 또는 하위 비호환 재정의
- MINOR: 원칙·섹션 추가 또는 실질적 지침 확장
- PATCH: 표현 명확화, 오타 수정, 의미 변화 없는 정리

준수 검토:

- 모든 `spec.md`는 소속 서브도메인과 분류를 명시해야 한다 (원칙 I).
- 모든 `plan.md`는 Constitution Check 항목을 통과해야 한다.
- 원칙을 벗어나는 복잡도는 `plan.md`에 정당화를 기록해야 하며, 정당화 없는 위반은
  구현 전에 해소한다.

**Version**: 1.1.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
