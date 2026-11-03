# Contract: `usePartnerRooms` (011)

`app/hooks/usePartnerRooms.ts`. 셸(`app/page.tsx`)이 한 번 만든다. 화면 코드는 Supabase 를 직접 부르지 않고 이 훅과 `app/lib/partner-client.ts` 만 쓴다.

```ts
type UsePartnerRoomsResult = {
  enabled: boolean;                 // 로그인 + 010 계정 기록을 받아 옴 + 키 있음
  status: "idle" | "loading" | "ready" | "error";  // 공유 정보 받아 오기
  connection: ConnectionState;
  shared(roomId: string): SharedRoom | null;       // 내 rooms.id 기준
  messages(roomId: string): VoiceMessage[] | null; // null = 이 학습방은 메모리 경로
  messagesStatus(roomId: string): "loading" | "ready" | "error" | "unknown"; // unknown = 공유 정보를 받아 오지 못해 모름 (D3)
  lastMessageAt(roomId: string): number | null;    // 홈·목록 요약
  openRoom(roomId: string): void;   // 빠진 메시지·유효 초대 코드 받아 오기, 서명 주소 갱신
  freshUrl(roomId: string, messageId: string): Promise<string | null>; // 재생 실패 뒤 새 서명 주소 (D4)
  send(roomId: string, language: RoomLanguage, recording: SentRecording): void;
  resend(roomId: string, messageId: string): void;
  discard(roomId: string, messageId: string): void;
  hasSending(roomId?: string): boolean;
  unsentCount(): number;            // 보내는 중·실패한 메시지 수, 로그아웃 확인에 쓴다 (D8)
  invite: {
    state(roomId: string): InviteState;
    create(roomId: string, language: RoomLanguage): Promise<void>;
    revoke(roomId: string): Promise<void>;
  };
  preview(code: string): Promise<{ ok: true; ownerName: string; language: RoomLanguage } | { ok: false; reason: JoinFailure }>;
  join(code: string): Promise<{ ok: true; roomId: string } | { ok: false; reason: JoinFailure }>;
  leave(roomId: string): Promise<{ ok: true } | { ok: false; reason: "network" | "timeout" | "failed" }>;
  retry(): void;                    // 공유 정보·연결 다시
};
```

## 조항

1. `enabled` 가 false 이면 `messages()` 는 언제나 null 이다. 셸은 지금의 메모리 메시지를 쓴다. 예시 학습방도 null 이다.
2. `enabled` 이고 예시가 아닌 학습방이면 `messages()` 는 서버 메시지와 보내는 중인 메시지를 합친 것이다. 받아 오기 전이면 `messagesStatus` 가 `loading` 이고, 빈 상태 안내를 보이지 않는다.
3. `send` 는 곧바로 `delivery:"sending"` 메시지를 끝에 붙인다. 성공하면 `"sent"`, 실패하면 `"failed"` 다. `resend` 는 같은 id 로 다시 보낸다.
4. 닫힌 학습방(`shared.closed`)에서는 `send` 가 아무것도 하지 않는다. 화면은 녹음 영역 대신 안내를 보인다.
5. 실시간으로 받은 메시지 중 내가 멤버가 아닌 학습방의 것은 버린다. 같은 id 는 한 번만 넣는다.
6. 사용자 id 가 바뀌거나 `enabled` 가 false 가 되면 모든 상태를 버리고 채널을 닫고 blob 주소를 revoke 한다.
7. `join` 이 성공하면 010 쓰기 경로로 `rooms` 행을 만들고(`joined:true` 일 때), 공유 정보를 다시 받아 온 뒤 `roomId` 를 돌려준다.
8. `leave` 는 research R8 순서를 따른다. 성공하면 셸이 010 의 `rooms.remove` 를 부른다.
9. 모든 서버 호출은 15초(올리기 30초) 상한이 있고, 오프라인이면 `network` 다.
10. 화면 문구의 학습방 이름은 `shared(roomId)?.partnerName ?? room.partner` 로 만든다.
