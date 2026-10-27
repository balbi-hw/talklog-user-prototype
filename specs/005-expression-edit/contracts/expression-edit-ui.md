# Contract: 카드 항목 편집 UI

**File**: app/components/ExpressionList.tsx, app/globals.css
**Covers**: FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-012, FR-013, FR-014

## 표시와 조작

1. onUpdate는 useExpressions.update와 같은 타입이다. onRemove는 기존 계약을 유지한다.
2. 편집 버튼은 표현을 포함한 aria-label·aria-expanded·aria-controls를 가진다.
3. 항목 내부 form에 보이는 label과 표현 입력·뜻 textarea·저장·취소를 제공한다.
   예문·출처는 일반 텍스트로 유지하며 식별자·시각 입력은 없다.
4. 뜻 입력칸은 시작 시 autoFocus. 저장·취소는 폼을 닫고 React 커밋 후 편집 버튼 ref로
   포커스를 복원한다. Escape도 취소한다. 실패는 폼을 닫지 않는다.
5. 하나를 편집하면 다른 편집·모든 삭제를 비활성으로 두고 종료 방법을 설명한다.
   삭제 확인 중 편집은 비활성이다. 삭제 취소 후 삭제 버튼으로 포커스를 돌린다.
6. UI는 기존 검증으로 잘못된 표현·빈 뜻·자기 자신 제외 중복을 즉시 표시하고 저장을 막는다.
   이유는 보이는 문구와 aria-describedby로 연결한다.
7. 훅 실패 이유는 role=status로 알리고 입력을 유지한다. 입력 변경 시 이전 오류를 지운다.
   화면 목록에 없는 최신 저장소 중복도 저장 시 반환된 이유로 표시한다.
8. unavailable 자체로 저장 버튼을 막지 않는다. 재시도는 훅의 최신 읽기를 다시 실행한다.
9. 완료 안내는 목록의 지속되는 role=status 영역에서 알린다.

## 상태별 렌더링

| 상태 | 표시 |
|---|---|
| loading | 로딩 자리, 빈 상태 아님 |
| ready + 0 | 기존 빈 상태·저장 방법 |
| ready + 양수 | 목록·개수·편집 |
| unavailable + 0 | 저장소 실패 안내, 빈 상태 아님 |
| unavailable + 기존 목록 | 실패 안내와 목록·입력 유지, 저장 재시도 가능 |

배열 순서대로 렌더링한다. 긴 입력은 min-width:0·overflow-wrap으로 셸 안에 유지한다.
스타일은 expression-edit-* 시맨틱 클래스와 기존 :root 변수만 쓴다.
