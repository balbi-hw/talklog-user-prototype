"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AccountScreen from "./components/AccountScreen";
import ExpressionList from "./components/ExpressionList";
import HomeDate from "./components/HomeDate";
import MessageUnderstanding from "./components/MessageUnderstanding";
import TranscriptCapture from "./components/TranscriptCapture";
import { useMessageUnderstanding, type UseMessageUnderstandingResult } from "./hooks/useMessageUnderstanding";
import Recorder from "./components/Recorder";
import RoomList, { type RemoveRoomResult } from "./components/RoomList";
import RoomInvite, { type InviteAvailability } from "./components/RoomInvite";
import InviteJoin from "./components/InviteJoin";
import { usePartnerRooms, type UsePartnerRoomsResult } from "./hooks/usePartnerRooms";
import { LEAVE_FAILURE_MESSAGE, type SharedRoom } from "./lib/partner";
import RoomCreate from "./components/RoomCreate";
import RoomSummary from "./components/RoomSummary";
import { useRooms } from "./hooks/useRooms";
import { useAccount } from "./hooks/useAccount";
import { useRecordSync } from "./hooks/useRecordSync";
import { ImportDialog, RecordSyncBanner } from "./components/RecordSyncNotice";
import { MOCK_ROOM, ROOM_FAILURE_MESSAGE, roomName, type Room as LearningRoom, type RoomOverview } from "./lib/rooms";
import VoiceBubble from "./components/VoiceBubble";
import ReviewHome from "./components/ReviewHome";
import ReviewEntry from "./components/ReviewEntry";
import ReviewSession from "./components/ReviewSession";
import { useReviews, type UseReviewsResult } from "./hooks/useReviews";
import { useExpressions, type UseExpressionsResult } from "./hooks/useExpressions";
import { useVoicePlayback, PREVIEW_ID } from "./hooks/useVoicePlayback";
import { useVoiceRecorder, type SentRecording } from "./hooks/useVoiceRecorder";
import { SAVE_FAILURE_MESSAGE } from "./lib/expressions";
import type { ExpressionDraft, SaveFailure, VoiceMessage } from "./lib/types";

type Screen = "home" | "rooms" | "room-create" | "room" | "feedback" | "cards" | "review" | "account";

const PARTNER_TRANSCRIPT = "週末は何をして過ごしたの？";

/**
 * 예시 학습방의 Feedback 화면이 저장하는 표현. 이 화면의 내용은 Mock이며
 * **저장 동작은 실제**여야 한다 (FR-024, data-model.md E13).
 */
const FEEDBACK_EXPRESSION: ExpressionDraft = {
  term: "映画館で映画を見る",
  meaning: "영화관에서 영화를 보다",
  example: "週末は映画館で映画を見たよ。",
  sourceRoom: roomName(MOCK_ROOM),
};

const Icon = ({ name }: { name: "home" | "chat" | "cards" }) => {
  const paths = {
    home: "M3 10.8 12 3l9 7.8V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.8Z",
    chat: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
    cards: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 5h6M9 12h6M9 16h4",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d={paths[name]} /></svg>;
};

// 흐름 검증용 예시 메시지. 재생할 실제 소리가 없으므로 source 는 "mock" 이다 (FR-016).
const INITIAL_MESSAGES: VoiceMessage[] = [
  { id: "m1", sender: "partner", durationMs: 8000, sentAtLabel: "오전 9:41", source: "mock", url: null, readLabel: null },
  { id: "m2", sender: "me", durationMs: 11000, sentAtLabel: "오전 9:46", source: "mock", url: null, readLabel: "읽음" },
];

const timeLabel = () =>
  new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

/** FR-022 — 아직 보내지 않은 녹음이 있는지와 그것을 버리는 수단. */
type PendingRecording = { hasPending: boolean; discard: () => void };

/** 표현을 저장하는 화면(`Room` · `Feedback`)이 셸에서 받는 것. 저장 경로는 하나다 (E13). */
type ExpressionSaving = {
  storageStatus: UseExpressionsResult["status"];
  findDuplicate: UseExpressionsResult["findDuplicate"];
  onSaveExpression: UseExpressionsResult["save"];
};

export default function TalklogApp() {
  const [screen, setScreen] = useState<Screen>("home");
  // 화면을 옮겨도 전송한 메시지가 유지되도록 대화 상태는 셸에서 소유한다.
  const rooms = useRooms();
  const [selectedRoomId, setSelectedRoomId] = useState(MOCK_ROOM.id);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, VoiceMessage[]>>({ [MOCK_ROOM.id]: INITIAL_MESSAGES });
  const [activityByRoom, setActivityByRoom] = useState<Record<string, number>>({});
  const messagesRef = useRef(messagesByRoom);
  messagesRef.current = messagesByRoom;

  /**
   * 표현 모음의 단일 소유자 (contracts/use-expressions.md). 저장은 `Room`·`Feedback`
   * 에서 일어나고 조회는 `Cards` 에서 일어나므로 세 화면의 공통 조상이 가져야 한다 —
   * 화면이 조건부 렌더링이라 `Room` 이 언마운트되면 화면 안에 둔 상태는 사라진다.
   */
  const account = useAccount();
  const sync = useRecordSync(account);
  // 011: 로그인 상태의 학습방은 서버 메시지를 쓴다. 로그아웃·키 없음·예시 학습방은 위의 메모리 경로 그대로다.
  const partner = usePartnerRooms(account, sync.scope);
  // 학습 짝이 들어오면 두 사람 모두 서로의 표시 이름으로 학습방을 본다 (contracts/use-partner-rooms.md 조항 10).
  const displayRooms = rooms.rooms.map((room) => {
    const name = partner.shared(room.id)?.partnerName;
    return name && name !== room.partner ? { ...room, partner: name } : room;
  });
  const selectedRoom = displayRooms.find((room) => room.id === selectedRoomId) ?? MOCK_ROOM;
  const overviews: RoomOverview[] = displayRooms
    .map((room) => {
      const server = partner.messages(room.id);
      const messages = server ?? messagesByRoom[room.id] ?? [];
      const sentAt = server ? partner.lastMessageAt(room.id) ?? undefined : activityByRoom[room.id];
      return { room, sentAt, messages, server: server !== null };
    })
    .sort((a, b) => (b.sentAt ?? b.room.createdAt) - (a.sentAt ?? a.room.createdAt) || a.room.id.localeCompare(b.room.id))
    .map(({ room, sentAt, messages, server }) => ({ room, messageCount: messages.length,
      lastMessageLabel: messages.length === 0 ? null : sentAt !== undefined
        ? new Date(sentAt).toLocaleString("ko-KR") : server ? null : "예시 오전 9:46" }));
  const inviteAvailability: InviteAvailability = account.state.status === "unavailable" ? "unavailable"
    : account.state.status === "signed-out" ? "signed-out"
    : !partner.enabled || partner.status === "idle" || partner.status === "loading" ? "loading"
    : partner.status === "error" ? "error" : "ready";

  useEffect(() => () => {
    Object.values(messagesRef.current).flat().forEach((message) => {
      if (message.url) URL.revokeObjectURL(message.url);
    });
  }, []);

  // 확인 링크에서 돌아오면 결과 안내가 보이도록 계정 화면을 연다.
  useEffect(() => { if (account.confirmNotice) setScreen("account"); }, [account.confirmNotice]);
  const understanding = useMessageUnderstanding();
  const expressions = useExpressions();
  const reviews = useReviews(expressions);
  // 이동이 막힌 목적지. null 이 아니면 확인을 기다리는 중이다.
  const [blockedNav, setBlockedNav] = useState<Screen | null>(null);

  const pendingRef = useRef<PendingRecording>({ hasPending: false, discard: () => {} });
  const phoneRef = useRef<HTMLDivElement>(null);
  const focusAfterReview = useRef(false);
  useEffect(() => {
    if (!focusAfterReview.current) return;
    const heading = phoneRef.current?.querySelector<HTMLElement>("section h1");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
    focusAfterReview.current = false;
  }, [screen]);
  const reportPending = useCallback((pending: PendingRecording) => {
    pendingRef.current = pending;
  }, []);

  const move = (next: Screen) => {
    if (screen === "review" && next !== "review") {
      reviews.end();
      focusAfterReview.current = true;
    }
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * FR-022: 녹음 중이거나 전송 전 녹음이 있으면 조용히 사라지게 두지 않고,
   * 버릴지 유지할지 사용자가 고르게 한다 (전이 T7 · T14).
   */
  const go = (next: Screen) => {
    // 011: 보내는 중인 메시지가 있어도 떠나기 전에 확인한다 (edge case, quickstart P19).
    if (screen === "room" && next !== "room" && (pendingRef.current.hasPending || partner.hasSending())) {
      setBlockedNav(next);
      return;
    }
    move(next);
  };

  const keepRecording = () => setBlockedNav(null);

  const discardAndLeave = () => {
    if (pendingRef.current.hasPending) pendingRef.current.discard();
    const next = blockedNav;
    setBlockedNav(null);
    if (next) move(next);
  };

  const openRoom = (id: string) => {
    setSelectedRoomId(id);
    go("room");
  };

  // 학습방을 열면 빠진 메시지를 받아 오고 서명 주소를 갱신한다 (FR-009).
  const openPartnerRoom = partner.openRoom;
  useEffect(() => {
    if (screen === "room" && partner.enabled) openPartnerRoom(selectedRoom.id);
  }, [screen, selectedRoom.id, partner.enabled, openPartnerRoom]);

  /**
   * 011 FR-012: 공유 정보가 있는 학습방을 지우는 것은 나가기다. 온라인으로 먼저 나가고,
   * 성공하면 010 경로로 내 학습방을 지운다. 실패하면 지우지 않고 이유를 알린다 (research R8).
   */
  const removeRoom = async (id: string): Promise<RemoveRoomResult> => {
    const serverMessages = partner.messages(id);
    if (serverMessages !== null) {
      // 공유 정보를 모르면 나가기인지 지우기인지 알 수 없어 지우지 않는다. 공유한 적 없는 학습방은 받아 온 뒤에만 그냥 지운다 (D3).
      if (!partner.shared(id) && partner.status !== "ready") {
        return { ok: false, message: "학습 짝과 함께 쓰는 학습방인지 아직 확인하지 못해 지울 수 없어요. 연결을 확인하고 잠시 뒤 다시 시도해 주세요." };
      }
      if (partner.hasSending(id)) return { ok: false, message: "보내는 중인 음성 메시지가 있어요. 다 보낸 뒤 다시 시도해 주세요." };
      const left = await partner.leave(id);
      if (!left.ok) return { ok: false, message: LEAVE_FAILURE_MESSAGE[left.reason] };
      understanding.remove(serverMessages.map((message) => message.id));
    }
    if (!rooms.remove(id)) return { ok: false, message: ROOM_FAILURE_MESSAGE["storage-unavailable"] };
    understanding.remove((messagesByRoom[id] ?? []).map((message) => message.id));
    (messagesByRoom[id] ?? []).forEach((message) => {
      if (message.url) URL.revokeObjectURL(message.url);
    });
    setMessagesByRoom((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setActivityByRoom((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (selectedRoomId === id) setSelectedRoomId(MOCK_ROOM.id);
    return { ok: true };
  };

  const sendPartnerMessage = partner.send;
  const serverPath = partner.messages(selectedRoom.id) !== null;
  const addRecordedMessage = useCallback((recording: SentRecording) => {
    // 011: 서버 경로면 학습 짝에게 보낸다. 녹음의 blob 주소는 훅이 맡는다.
    if (serverPath) { sendPartnerMessage(selectedRoom.id, selectedRoom.language, recording); return; }
    const sentAt = Date.now();
    setMessagesByRoom((current) => ({ ...current, [selectedRoom.id]: [
      ...(current[selectedRoom.id] ?? []),
      { id: `r${crypto.randomUUID()}`, sender: "me", durationMs: recording.durationMs,
        sentAtLabel: timeLabel(), source: "recorded", url: recording.url, readLabel: null },
    ] }));
    setActivityByRoom((current) => ({ ...current, [selectedRoom.id]: sentAt }));
  }, [selectedRoom.id, selectedRoom.language, serverPath, sendPartnerMessage]);

  return (
    <main className="app-shell">
      <div className="phone-frame" ref={phoneRef}>
        <header className="topbar">
          <button className="brand" onClick={() => go("home")} aria-label="홈으로 이동">
            <span className="brand-mark">t</span><span>talklog</span>
          </button>
          <button className="topbar-account" onClick={() => go("account")}
            aria-label={account.state.status === "signed-in" ? `계정: ${account.state.user.displayName}` : "계정"}>
            {account.state.status === "signed-in" ? account.state.user.displayName
              : account.state.status === "signed-out" ? "로그인" : "계정"}
          </button>
        </header>
        <RecordSyncBanner sync={sync} />

        {screen === "home" && <Home roomSummary={<RoomSummary items={overviews} status={rooms.status} onOpen={openRoom} onAll={() => go("rooms")} onCreate={() => go("room-create")} onReload={rooms.reload} />}
          reviews={reviews} onOpenRoom={() => go("rooms")} onCards={() => go("cards")}
          onReview={() => { reviews.start(); go("review"); }} />}
        {screen === "account" && <AccountScreen account={account} sync={sync} unsentMessages={partner.unsentCount()} onBack={() => go("home")} />}
        {screen === "rooms" && <RoomList items={overviews} status={rooms.status} onOpen={openRoom} onCreate={() => go("room-create")} onRemove={removeRoom} onReload={rooms.reload}
          isShared={(id) => { const shared = partner.shared(id); return !!shared && (shared.role === "partner" || !!shared.partnerName); }}
          inviteJoin={<InviteJoin availability={inviteAvailability} preview={partner.preview} join={partner.join}
            onJoined={openRoom} onAccount={() => go("account")} onRetry={partner.retry} />} />}
        {screen === "room-create" && <RoomCreate status={rooms.status} onCreate={rooms.create} onCreated={(room) => openRoom(room.id)} onCancel={() => go("rooms")} />}
        {screen === "room" && (
          <Room
            key={selectedRoom.id}
            room={selectedRoom}
            onRooms={() => go("rooms")}
            messages={partner.messages(selectedRoom.id) ?? messagesByRoom[selectedRoom.id] ?? []}
            onSendRecording={addRecordedMessage}
            partner={serverPath ? partner : null}
            shared={partner.shared(selectedRoom.id)}
            invite={selectedRoom.id === MOCK_ROOM.id ? null : <RoomInvite availability={inviteAvailability}
              shared={partner.shared(selectedRoom.id)} state={partner.invite.state(selectedRoom.id)}
              onCreate={() => { void partner.invite.create(selectedRoom.id, selectedRoom.language); }}
              onRevoke={() => { void partner.invite.revoke(selectedRoom.id); }}
              onRetry={partner.retry} onAccount={() => go("account")} />}
            understanding={understanding}
            onFeedback={() => go("feedback")}
            onPendingChange={reportPending}
            storageStatus={expressions.status}
            findDuplicate={expressions.findDuplicate}
            onSaveExpression={expressions.save}
          />
        )}
        {screen === "feedback" && (
          <Feedback
            onBack={() => go("room")}
            onCards={() => go("cards")}
            storageStatus={expressions.status}
            findDuplicate={expressions.findDuplicate}
            onSaveExpression={expressions.save}
          />
        )}
        {screen === "cards" && (
          <Cards
            status={expressions.status}
            expressions={expressions.expressions}
            count={expressions.count}
            onRemove={expressions.remove}
            reviews={reviews}
            onReview={() => { reviews.start(); go("review"); }}
            onRoom={() => go("room")}
            onUpdate={expressions.update}
            onReload={expressions.reload}
          />
        )}
        {screen === "review" && <ReviewSession reviews={reviews} onExit={() => go("home")} onRoom={() => go("room")} />}

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <NavButton active={screen === "home"} icon="home" label="홈" onClick={() => go("home")} />
          <NavButton active={screen === "rooms" || screen === "room-create" || screen === "room" || screen === "feedback"} icon="chat" label="대화" onClick={() => go("rooms")} />
          <NavButton active={screen === "cards" || screen === "review"} icon="cards" label="카드" onClick={() => go("cards")} />
        </nav>

        <ImportDialog sync={sync} />
        {blockedNav && (
          <div
            className="leave-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") keepRecording();
            }}
          >
            <div className="leave-card">
              {pendingRef.current.hasPending ? <>
                <strong id="leave-title">아직 보내지 않은 녹음이 있어요</strong>
                <p>화면을 옮기면 이 녹음은 사라져요.{partner.hasSending() ? " 보내는 중인 음성 메시지는 계속 보내요." : ""}</p>
                <div className="leave-actions">
                  <button autoFocus onClick={keepRecording}>
                    녹음 계속하기
                  </button>
                  <button className="leave-discard" onClick={discardAndLeave}>
                    버리고 이동
                  </button>
                </div>
              </> : <>
                {/* 011: 보내기는 화면을 옮겨도 이어진다. 새로고침하거나 창을 닫으면 사라진다는 사실을 알린다. */}
                <strong id="leave-title">아직 보내는 중인 음성 메시지가 있어요</strong>
                <p>화면을 옮겨도 보내기는 이어져요. 새로고침하거나 창을 닫으면 보내는 중인 음성 메시지는 사라져요.</p>
                <div className="leave-actions">
                  <button autoFocus onClick={keepRecording}>
                    이 화면에 머무르기
                  </button>
                  <button className="leave-discard" onClick={discardAndLeave}>
                    이동
                  </button>
                </div>
              </>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Home({ roomSummary, onOpenRoom, onReview, onCards, reviews }: {
  roomSummary: React.ReactNode; onOpenRoom: () => void; onReview: () => void; onCards: () => void; reviews: UseReviewsResult;
}) {
  return <section className="screen home-screen">
    <HomeDate />
    <h1>반가워요<span className="hello-dot">.</span></h1>
    <p className="lead">오늘도 한 문장씩, 가볍게 시작해볼까요?</p>

    {roomSummary}

    <ReviewHome reviews={reviews} onStart={onReview} onRoom={onOpenRoom} onCards={onCards} />
  </section>;
}

function Room({
  room,
  onRooms,
  messages,
  onSendRecording,
  understanding,
  onFeedback,
  onPendingChange,
  storageStatus,
  findDuplicate,
  onSaveExpression,
  partner,
  shared,
  invite,
}: {
  room: LearningRoom;
  onRooms: () => void;
  messages: VoiceMessage[];
  onSendRecording: (recording: SentRecording) => void;
  understanding: UseMessageUnderstandingResult;
  onFeedback: () => void;
  onPendingChange: (pending: PendingRecording) => void;
  /** 011: 서버 경로일 때만 있다. null 이면 지금의 메모리 경로다. */
  partner: UsePartnerRoomsResult | null;
  shared: SharedRoom | null;
  invite: ReactNode;
} & ExpressionSaving) {
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { roomHeadingRef.current?.focus(); }, []);
  const [showScript, setShowScript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const playback = useVoicePlayback();
  const recorder = useVoiceRecorder({ onSend: onSendRecording });

  const toggleScript = () => setShowScript((current) => !current);

  const isPreviewPlaying = playback.activeId === PREVIEW_ID;

  // FR-022: 셸이 화면 이동을 막을 수 있도록 전송 전 녹음 상태를 위로 알린다.
  useEffect(() => {
    onPendingChange({ hasPending: recorder.hasPending, discard: recorder.discard });
  }, [recorder.hasPending, recorder.discard, onPendingChange]);

  const handlePreview = () => {
    if (recorder.previewUrl) playback.toggle(PREVIEW_ID, recorder.previewUrl, recorder.elapsedMs);
  };

  // 재생 중인 URL 이 곧 무효해지므로 먼저 재생을 멈춘다 (contracts/use-voice-playback.md 조항 5).
  const handleRetake = () => {
    if (isPreviewPlaying) playback.stop();
    recorder.retake();
  };
  const handleCancel = () => {
    if (isPreviewPlaying) playback.stop();
    recorder.cancel();
  };

  const renderBubble = (message: VoiceMessage) => {
    const url = message.url;
    const failed = message.delivery === "failed";
    return (
      <VoiceBubble
        message={message}
        isActive={playback.activeId === message.id}
        progress={playback.progress}
        onToggle={url ? () => playback.toggle(message.id, url, message.durationMs) : undefined}
        playFailed={playback.failedId === message.id}
        onRetryPlay={url ? async () => {
          // 만료된 서명 주소일 수 있으니 서버 경로면 새 주소를 받은 뒤 재생한다 (D4).
          const fresh = partner ? await partner.freshUrl(room.id, message.id) : url;
          playback.toggle(message.id, fresh ?? url, message.durationMs);
        } : undefined}
        onResend={failed && partner ? () => partner.resend(room.id, message.id) : undefined}
        // 지운 메시지 자리는 사라지므로 학습방 제목으로 포커스를 옮긴다 (D6).
        onDiscard={failed && partner ? () => { partner.discard(room.id, message.id); roomHeadingRef.current?.focus(); } : undefined}
      />
    );
  };
  const messagesStatus = partner ? partner.messagesStatus(room.id) : "ready";
  const closed = !!shared?.closed;

  return <section className="screen room-screen">
    <div className="room-heading"><div className="room-partner-avatar" aria-hidden="true">{Array.from(room.partner)[0]}</div><div><h1 ref={roomHeadingRef} tabIndex={-1}>{roomName(room)}</h1><p>학습 짝 {room.partner} · {room.language}{room.id === MOCK_ROOM.id ? " · 예시 학습방" : ""}</p></div></div>
    {invite}
    <div className="room-context"><button onClick={onRooms}>← 학습방 목록</button><p>{!partner
      ? "학습 짝에게 실제로 전달되지는 않아요. 녹음은 새로고침하면 사라져요."
      : shared?.partnerName
        ? "보낸 음성 메시지는 계정에 저장되고 학습 짝에게 전달돼요."
        : "보낸 음성 메시지는 계정에 저장돼요. 학습 짝이 들어오면 지난 메시지도 함께 봐요."}</p></div>
    {/* 011 FR-010: 바로 받는 연결이 끊겨도 재생·녹음·전송은 막지 않는다. */}
    {partner?.connection === "lost" && <div className="partner-connection" role="status">
      <p>새 메시지를 바로 받지 못하고 있어요.</p>
      <button type="button" onClick={partner.retry}>다시 시도</button>
    </div>}
    {messages.length === 0 && messagesStatus === "loading" && <p className="room-empty" role="status">음성 메시지를 받아 오고 있어요.</p>}
    {messages.length === 0 && messagesStatus === "error" && <div className="room-notice" role="status">
      <p>음성 메시지를 받아 오지 못했어요.</p>
      <button type="button" onClick={() => partner?.retry()}>다시 시도</button>
    </div>}
    {messages.length === 0 && messagesStatus === "unknown" && <p className="room-empty" role="status">학습방 정보를 받아 오면 지난 음성 메시지가 보여요. 지금도 녹음해 보낼 수 있어요.</p>}
    {messages.length === 0 && messagesStatus === "ready" && <p className="room-empty" role="status">아직 음성 메시지가 없어요. 첫 음성 메시지를 녹음해보세요. 보낸 뒤 스크립트와 번역을 열 수 있어요.</p>}
    <div className="day-divider"><span>음성 메시지</span></div>

    {messages.map((message) => message.sender === "partner" ? (
      <div className="chat partner" key={message.id}>
        <div className="mini-avatar">{Array.from(room.partner)[0]}</div>
        <div className="partner-message">
          {renderBubble(message)}
          {/* 고정 예시와 실제 녹음의 요청 경로를 구분한다. */}
          {room.id === MOCK_ROOM.id && message.source === "mock" && <>
            <div className="detail-toggles">
              <button className={showScript ? "active" : ""} onClick={toggleScript} aria-expanded={showScript} aria-controls="partner-script">스크립트 <span>{showScript ? "⌃" : "⌄"}</span></button>
              <button className={showTranslation ? "active" : ""} onClick={() => setShowTranslation((visible) => !visible)} aria-expanded={showTranslation} aria-controls="partner-translation">번역 <span>{showTranslation ? "⌃" : "⌄"}</span></button>
            </div>
            {showScript && <>
              <div id="partner-script" className="message-details">
                <span>스크립트 · 예시</span>
                <TranscriptCapture text={PARTNER_TRANSCRIPT} sourceRoom={roomName(room)}
                  storageStatus={storageStatus} findDuplicate={findDuplicate} onSaveExpression={onSaveExpression} />
              </div>
            </>}
            {showTranslation && <div id="partner-translation" className="message-details translation-detail"><span>번역 · 예시</span><p>주말에는 무엇을 하며 보냈어?</p></div>}
          </>}
          {/* 011: 학습 짝이 실제로 보낸 메시지는 내 메시지와 같은 방식(007)으로 스크립트·번역을 요청한다. */}
          {message.source === "recorded" && <MessageUnderstanding message={message} room={room} understanding={understanding}
            storageStatus={storageStatus} findDuplicate={findDuplicate} onSaveExpression={onSaveExpression} />}
          <small>{message.sentAtLabel}</small>
        </div>
      </div>
    ) : (
      <div className="chat mine" key={message.id}>
        <div>
          {renderBubble(message)}
          {message.source === "recorded" && <MessageUnderstanding message={message} room={room} understanding={understanding}
            storageStatus={storageStatus} findDuplicate={findDuplicate} onSaveExpression={onSaveExpression} />}
          <small>{[message.readLabel, (message.delivery ?? "sent") === "sent" ? message.sentAtLabel : null].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
    ))}

    {room.id === MOCK_ROOM.id && <button className="feedback-banner" onClick={onFeedback}><span className="spark">✦</span><div><strong>내 문장을 확인해볼까요?</strong><p>예시 스크립트와 다듬은 문장을 확인해요</p></div><b>→</b></button>}

    {closed ? <p className="room-closed" role="status">학습 짝이 나갔어요. 지난 음성 메시지는 그대로 볼 수 있지만 더 보낼 수 없어요.</p> : <Recorder
      state={recorder.state}
      micStatus={recorder.micStatus}
      elapsedMs={recorder.elapsedMs}
      stopReason={recorder.stopReason}
      sendable={recorder.sendable}
      isPreviewPlaying={isPreviewPlaying}
      onStart={recorder.start}
      onStop={recorder.stop}
      onPreview={handlePreview}
      onRetake={handleRetake}
      onCancel={handleCancel}
      onSend={recorder.send}
    />}
  </section>;
}

function Feedback({
  onBack,
  onCards,
  storageStatus,
  findDuplicate,
  onSaveExpression,
}: { onBack: () => void; onCards: () => void } & ExpressionSaving) {
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  /**
   * 저장 여부를 이 화면의 상태로 판단하지 않는다 — 표현 모음에 실제로 있는지로 판단한다.
   * 화면을 떠났다 돌아와도, 새로고침해도 같은 답이 나온다 (FR-024, 원칙 II).
   */
  const alreadySaved = findDuplicate(FEEDBACK_EXPRESSION.term) !== null;

  /** E13 — E5 와 같은 저장 경로를 쓴다. 중복 판정과 저장소 실패 처리도 똑같이 적용된다. */
  const handleSave = () => {
    const result = onSaveExpression(FEEDBACK_EXPRESSION);
    if (!result.ok) {
      setSaveError(result.reason);
      return;
    }
    setSaveError(null);
    setJustSaved(true);
  };

  /**
   * 저장을 시도해 실패한 이유가 가장 우선한다. 그다음은 저장소를 아예 쓸 수 없는 상태
   * (FR-015), 마지막이 이미 저장돼 있다는 안내다. 방금 저장한 직후에는 완료 표시가
   * 나가므로 중복 안내를 겹쳐 보여주지 않는다.
   */
  const notice: SaveFailure | null =
    saveError ??
    (storageStatus === "unavailable"
      ? "storage-unavailable"
      : alreadySaved && !justSaved
        ? "duplicate"
        : null);

  return <section className="screen feedback-screen">
    <button className="back" onClick={onBack} aria-label="대화로 돌아가기">←</button>
    <div className="eyebrow">AI 피드백 · 예시</div><h1>잘 전달됐어요!<br/><span>조금 더 자연스럽게</span> 다듬어볼게요.</h1>
    <p className="lead">아래 스크립트와 다듬은 문장은 예시예요. 내가 보낸 음성 메시지에서는 스크립트 옆 문장 다듬기를 열 수 있어요. 카드 저장은 실제로 동작해요.</p>
    <div className="feedback-card original"><div className="card-label">내가 말한 문장</div><p>週末に映画館で映画を見ました。</p></div>
    <div className="connector-line" />
    <div className="feedback-card suggestion"><div className="card-label">✦ 더 자연스러운 표현</div><p>週末は映画館で映画を見たよ。</p><div className="why"><strong>왜 이렇게 바꿨나요?</strong><p>학습 짝과 나누는 편한 대화에서는 「〜ました」보다 「〜たよ」가 더 자연스러워요.</p></div></div>
    <div className="expression">
      <div>
        <span>저장할 표현</span>
        <h2>{FEEDBACK_EXPRESSION.term}</h2>
        <p>{FEEDBACK_EXPRESSION.meaning}</p>
      </div>
      <button className={alreadySaved ? "saved" : ""} onClick={handleSave}>
        {alreadySaved ? "✓ 저장됨" : "+ 카드에 저장"}
      </button>
    </div>
    {notice && <p className="expression-notice">{SAVE_FAILURE_MESSAGE[notice]}</p>}
    {justSaved && !saveError && <p className="expression-notice done" role="status">✓ 카드에 저장했어요</p>}
    {alreadySaved && <button className="primary-button" onClick={onCards}>저장한 카드 확인하기 →</button>}
  </section>;
}

/**
 * 카드 목록 화면. 실제로 저장한 표현만 렌더링한다.
 *
 * 하드코딩된 표현 3개와 `전체 23`, 동작하지 않는 필터, 표현에는 없는 음성의 재생
 * 버튼을 모두 제거했다 (FR-025, contracts/expression-list-ui.md 조항 1·3·4).
 */
function Cards({
  status,
  expressions,
  count,
  onRemove,
  reviews,
  onReview,
  onRoom,
  onUpdate,
  onReload,
}: {
  status: UseExpressionsResult["status"];
  expressions: UseExpressionsResult["expressions"];
  count: number;
  onRemove: (id: string) => void;
  reviews: UseReviewsResult;
  onReview: () => void;
  onRoom: () => void;
  onUpdate: UseExpressionsResult["update"];
  onReload: () => void;
}) {
  const reload = () => { onReload(); reviews.refresh(); };
  return <section className="screen cards-screen">
    <div className="eyebrow">나의 표현</div>
    <h1>내 표현</h1>
    <p className="lead">대화에서 발견한 표현을 다시 만나보세요.</p>

    <ReviewEntry reviews={reviews} onStart={onReview} onRoom={onRoom} onReload={reload} />

    <ExpressionList status={status} expressions={expressions} count={count} onRemove={onRemove} onUpdate={onUpdate} onReload={reload} />
  </section>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: "home" | "chat" | "cards"; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>;
}
