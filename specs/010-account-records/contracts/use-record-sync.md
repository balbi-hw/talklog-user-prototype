# Contract: useRecordSync

`app/hooks/useRecordSync.ts` — 셸이 `useAccount` 결과와 함께 한 번 부른다.

```ts
type UseRecordSyncResult = {
  scope: RecordScope;
  status: SyncStatus;
  importOffer: { rooms: number; expressions: number } | null;
  device: { rooms: number; expressions: number };
  importNow(): ImportResult;
  dismissImport(): void;
  retry(): void;
  pendingFor(userId: string): number;
  forget(userId: string): void;
};
```

- 계정 상태가 `loading` 이면 범위를 정하지 않는다(`pending`). `signed-in` 이면 계정, 그 밖은 기기.
- `importOffer` 는 계정 수신 후, 처리 표시가 없고, 이번 로그인에서 "나중에"를 고르지 않았고, 기기 기록이 있을 때만 생긴다.
- 로그인 상태에서 `online`·`focus` 이벤트는 `retry` 를 부른다.
- `forget` 은 사용자가 로그아웃을 확정한 뒤에만 부른다.

## 화면

- `ImportDialog`: 질문(개수, 가져오기/나중에) → 결과(가져온 수·건너뛴 수, 확인). Escape = 나중에. 열리면 첫 버튼에 포커스, 닫히면 원래 자리로.
- `RecordSyncBanner`: 상단 바 아래. 계정 미수신(받아 오는 중·실패)과 `offline`·`error` 일 때만. 실패에는 다시 시도.
- 계정 화면: 상태 한 줄, 기기 기록 가져오기 버튼, 로그아웃 확인의 보낼 변경 경고.
