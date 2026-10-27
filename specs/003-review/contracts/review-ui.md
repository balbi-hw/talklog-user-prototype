# Contract: 복습 화면과 진입

**Files**: `app/components/ReviewEntry.tsx`, `ReviewHome.tsx`, `ReviewSession.tsx`, `ReviewComplete.tsx`
**Covers**: FR-002, FR-007~FR-011

| 상태 | 화면/조작 |
|---|---|
| loading | 읽는 중 role=status. 0장/빈 상태 먼저 표시 금지 |
| unavailable | 실패와 다시 읽기 |
| ready, 표현0 | 표현 저장 방법과 학습방 진입 |
| ready, 대상0 | 오늘 복습할 카드가 없어요 + 가장 빠른 예정일 |
| ready, 대상 있음 | 실제 대상 수, 최대20장 안내, 복습 시작 |
| 앞면 | 표현과 뜻 보기, aria-expanded/controls |
| 뒤집힘 | 뜻·예문·출처, know/again 버튼 |
| 저장 실패 | 카드·뜻 유지, 실패 알림, 응답 재시도 |
| 완료 | 고유 카드 수·최종 응답 두 수, 홈/학습방 복귀 |

홈은 누적 기록으로 범위를 표시, 대화한 날 제거, 전체 보기는 카드로 이동.
진행은 큐 위치/길이이며 재등장 추가 시 분모가 증가한다. 고유 카드 수 별도 안내.
네이티브 progress, 아이콘 라벨, 상태 role=status. 다음 카드 버튼/완료 제목으로 포커스.
뜻 보기 후 첫 응답, 진입과 재시도 후 영역 제목으로 포커스. 긴 텍스트는 자연스럽게 늘어난다.
