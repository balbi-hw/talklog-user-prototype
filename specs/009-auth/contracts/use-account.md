# Contract: useAccount

`app/hooks/useAccount.ts` — 셸(`app/page.tsx`)이 한 번 부르고 계정 화면·상단 바에 내려 준다.

```ts
type UseAccountResult = {
  state: AccountState;
  confirmNotice: "confirmed" | AccountFailure | null;
  dismissConfirmNotice(): void;
  signIn(email, password): Promise<AccountResult>;
  signUp(email, password, displayName): Promise<AccountResult>;
  signOut(): Promise<AccountResult>;
};
type AccountResult =
  | { ok: true; outcome: "signed-in" | "confirmation-sent" | "signed-out" }
  | { ok: false; reason: AccountFailure };
```

- 세 함수는 예외를 던지지 않는다. 실패는 `reason` 으로 돌려준다.
- 각 호출은 15초 상한이 있다.
- `signUp` 은 `emailRedirectTo = <origin>/auth/confirm` 을 보낸다.
- `state` 는 `onAuthStateChange` 로만 바뀐다. 호출 결과로 직접 바꾸지 않는다.
- `confirmNotice` 가 생기면 셸은 계정 화면을 연다.
