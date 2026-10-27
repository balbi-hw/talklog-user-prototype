"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ExpressionList from "./components/ExpressionList";
import ExpressionSheet from "./components/ExpressionSheet";
import Recorder from "./components/Recorder";
import RoomList from "./components/RoomList";
import RoomCreate from "./components/RoomCreate";
import RoomSummary from "./components/RoomSummary";
import { useRooms } from "./hooks/useRooms";
import { MOCK_ROOM, roomName, type Room as LearningRoom, type RoomOverview } from "./lib/rooms";
import VoiceBubble from "./components/VoiceBubble";
import ReviewHome from "./components/ReviewHome";
import ReviewEntry from "./components/ReviewEntry";
import ReviewSession from "./components/ReviewSession";
import { useReviews, type UseReviewsResult } from "./hooks/useReviews";
import { useExpressions, type UseExpressionsResult } from "./hooks/useExpressions";
import { useTranscriptSelection } from "./hooks/useTranscriptSelection";
import { useVoicePlayback, PREVIEW_ID } from "./hooks/useVoicePlayback";
import { useVoiceRecorder, type SentRecording } from "./hooks/useVoiceRecorder";
import { SAVE_FAILURE_MESSAGE } from "./lib/expressions";
import type { ExpressionDraft, SaveFailure, VoiceMessage } from "./lib/types";

type Screen = "home" | "rooms" | "room-create" | "room" | "feedback" | "cards" | "review";

/**
 * 스크립트가 붙은 학습 짝의 예시 메시지 전체 텍스트. 표현의 예문으로 저장한다 (FR-010).
 *
 * 실제로 녹음한 내 음성에는 스크립트가 없다 — STT 가 미구현이므로 표현을 고를 수 있는
 * 것은 이 예시 스크립트뿐이다 (spec.md Assumptions).
 */
const PARTNER_TRANSCRIPT = "週末は何をして過ごしたの？";

/**
 * Feedback 화면이 저장하는 표현. AI 문장 교정이 미구현이라 내용은 Mock 이지만
 * **저장 동작은 실제**여야 한다 (FR-024, data-model.md E13).
 */
const FEEDBACK_EXPRESSION: ExpressionDraft = {
  term: "映画館で映画を見る",
  meaning: "영화관에서 영화를 보다",
  example: "週末は映画館で映画を見たよ。",
  sourceRoom: roomName(MOCK_ROOM),
};

const Icon = ({ name }: { name: "home" | "chat" | "cards" | "user" }) => {
  const paths = {
    home: "M3 10.8 12 3l9 7.8V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.8Z",
    chat: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
    cards: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 5h6M9 12h6M9 16h4",
    user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
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
  const selectedRoom = rooms.rooms.find((room) => room.id === selectedRoomId) ?? MOCK_ROOM;
  const overviews: RoomOverview[] = [...rooms.rooms]
    .sort((a, b) => (activityByRoom[b.id] ?? b.createdAt) - (activityByRoom[a.id] ?? a.createdAt) || a.id.localeCompare(b.id))
    .map((room) => {
      const messages = messagesByRoom[room.id] ?? [];
      const sentAt = activityByRoom[room.id];
      return { room, messageCount: messages.length,
        lastMessageLabel: messages.length === 0 ? null : sentAt !== undefined
          ? new Date(sentAt).toLocaleString("ko-KR") : "예시 오전 9:46" };
    });

  useEffect(() => () => {
    Object.values(messagesRef.current).flat().forEach((message) => {
      if (message.url) URL.revokeObjectURL(message.url);
    });
  }, []);

  /**
   * 표현 모음의 단일 소유자 (contracts/use-expressions.md). 저장은 `Room`·`Feedback`
   * 에서 일어나고 조회는 `Cards` 에서 일어나므로 세 화면의 공통 조상이 가져야 한다 —
   * 화면이 조건부 렌더링이라 `Room` 이 언마운트되면 화면 안에 둔 상태는 사라진다.
   */
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
    if (screen === "room" && next !== "room" && pendingRef.current.hasPending) {
      setBlockedNav(next);
      return;
    }
    move(next);
  };

  const keepRecording = () => setBlockedNav(null);

  const discardAndLeave = () => {
    pendingRef.current.discard();
    const next = blockedNav;
    setBlockedNav(null);
    if (next) move(next);
  };

  const openRoom = (id: string) => {
    setSelectedRoomId(id);
    go("room");
  };

  const removeRoom = (id: string): boolean => {
    if (!rooms.remove(id)) return false;
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
    return true;
  };

  const addRecordedMessage = useCallback((recording: SentRecording) => {
    const sentAt = Date.now();
    setMessagesByRoom((current) => ({ ...current, [selectedRoom.id]: [
      ...(current[selectedRoom.id] ?? []),
      { id: `r${sentAt}`, sender: "me", durationMs: recording.durationMs,
        sentAtLabel: timeLabel(), source: "recorded", url: recording.url, readLabel: null },
    ] }));
    setActivityByRoom((current) => ({ ...current, [selectedRoom.id]: sentAt }));
  }, [selectedRoom.id]);

  return (
    <main className="app-shell">
      <div className="phone-frame" ref={phoneRef}>
        <header className="topbar">
          <button className="brand" onClick={() => go("home")} aria-label="홈으로 이동">
            <span className="brand-mark">t</span><span>talklog</span>
          </button>
          <button className="avatar" aria-label="내 프로필">민</button>
        </header>

        {screen === "home" && <Home roomSummary={<RoomSummary items={overviews} status={rooms.status} onOpen={openRoom} onAll={() => go("rooms")} onCreate={() => go("room-create")} onReload={rooms.reload} />}
          reviews={reviews} onOpenRoom={() => go("rooms")} onCards={() => go("cards")}
          onReview={() => { reviews.start(); go("review"); }} />}
        {screen === "rooms" && <RoomList items={overviews} status={rooms.status} onOpen={openRoom} onCreate={() => go("room-create")} onRemove={removeRoom} onReload={rooms.reload} />}
        {screen === "room-create" && <RoomCreate status={rooms.status} onCreate={rooms.create} onCreated={(room) => openRoom(room.id)} onCancel={() => go("rooms")} />}
        {screen === "room" && (
          <Room
            key={selectedRoom.id}
            room={selectedRoom}
            onRooms={() => go("rooms")}
            messages={messagesByRoom[selectedRoom.id] ?? []}
            onSendRecording={addRecordedMessage}
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
          />
        )}
        {screen === "review" && <ReviewSession reviews={reviews} onExit={() => go("home")} onRoom={() => go("room")} />}

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <NavButton active={screen === "home"} icon="home" label="홈" onClick={() => go("home")} />
          <NavButton active={screen === "rooms" || screen === "room-create" || screen === "room" || screen === "feedback"} icon="chat" label="대화" onClick={() => go("rooms")} />
          <NavButton active={screen === "cards" || screen === "review"} icon="cards" label="카드" onClick={() => go("cards")} />
          <NavButton active={false} icon="user" label="마이" onClick={() => {}} />
        </nav>

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
              <strong id="leave-title">아직 보내지 않은 녹음이 있어요</strong>
              <p>화면을 옮기면 이 녹음은 사라져요.</p>
              <div className="leave-actions">
                <button autoFocus onClick={keepRecording}>
                  녹음 계속하기
                </button>
                <button className="leave-discard" onClick={discardAndLeave}>
                  버리고 이동
                </button>
              </div>
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
    <div className="eyebrow">7월 22일 수요일</div>
    <h1>좋은 아침이에요, 민지님<span className="hello-dot">.</span></h1>
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
  onFeedback,
  onPendingChange,
  storageStatus,
  findDuplicate,
  onSaveExpression,
}: {
  room: LearningRoom;
  onRooms: () => void;
  messages: VoiceMessage[];
  onSendRecording: (recording: SentRecording) => void;
  onFeedback: () => void;
  onPendingChange: (pending: PendingRecording) => void;
} & ExpressionSaving) {
  const roomHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { roomHeadingRef.current?.focus(); }, []);
  const [showScript, setShowScript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const playback = useVoicePlayback();
  const recorder = useVoiceRecorder({ onSend: onSendRecording });

  /**
   * 스크립트가 붙은 학습 짝의 예시 메시지는 하나뿐이므로 ref 도 하나다
   * (spec.md Assumptions — 실제 녹음에는 STT 가 없다).
   */
  const transcriptRef = useRef<HTMLParagraphElement>(null);

  // 초안은 동시에 최대 1개다 (data-model.md §2). 저장 수단이 스크립트 블록에 붙어
  // 있으므로 초안도 이 화면이 소유한다.
  const [draft, setDraft] = useState<ExpressionDraft | null>(null);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const [savedTerm, setSavedTerm] = useState<string | null>(null);

  const { selection, clear } = useTranscriptSelection({
    transcriptRef,
    example: PARTNER_TRANSCRIPT,
    sourceRoom: roomName(room),
    enabled: showScript && room.id === MOCK_ROOM.id,
  });

  /** 스크립트를 닫으면 표현을 고를 수단 자체가 사라진다 (FR-006). 초안도 함께 버린다. */
  const toggleScript = () => {
    const next = !showScript;
    setShowScript(next);
    if (!next) {
      setDraft(null);
      setSaveError(null);
      setSavedTerm(null);
    }
  };

  const startDraft = () => {
    if (!selection) return;
    setDraft({
      term: selection.text,
      meaning: "",
      example: selection.example,
      sourceRoom: selection.sourceRoom,
    });
    setSaveError(null);
    setSavedTerm(null);
  };

  /**
   * 저장·취소하면 누른 버튼이 사라지므로 포커스를 스크립트로 돌려놓는다 (US1-4,
   * expression-sheet-ui 조항 10).
   */
  const returnToTranscript = () => {
    clear();
    transcriptRef.current?.focus({ preventScroll: true });
  };

  /** 취소하면 아무것도 저장되지 않는다 (FR-013, E9). */
  const cancelDraft = () => {
    setDraft(null);
    setSaveError(null);
    returnToTranscript();
  };

  const submitDraft = () => {
    if (!draft) return;
    const result = onSaveExpression(draft);
    if (!result.ok) {
      // 실패하면 초안을 유지한다 — 적어둔 뜻을 잃게 해서는 안 된다 (FR-015, 원칙 II).
      setSaveError(result.reason);
      return;
    }
    setSavedTerm(result.saved.term);
    setDraft(null);
    setSaveError(null);
    returnToTranscript();
  };

  const duplicateOf = draft ? findDuplicate(draft.term) : null;

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
    return (
      <VoiceBubble
        message={message}
        isActive={playback.activeId === message.id}
        progress={playback.progress}
        onToggle={url ? () => playback.toggle(message.id, url, message.durationMs) : undefined}
      />
    );
  };

  return <section className="screen room-screen">
    <div className="room-heading"><div className="room-partner-avatar" aria-hidden="true">{Array.from(room.partner)[0]}</div><div><h1 ref={roomHeadingRef} tabIndex={-1}>{roomName(room)}</h1><p>학습 짝 {room.partner} · {room.language}{room.id === MOCK_ROOM.id ? " · 예시 학습방" : ""}</p></div></div>
    <div className="room-context"><button onClick={onRooms}>← 학습방 목록</button><p>학습 짝에게 실제로 전달되지는 않아요. 녹음은 새로고침하면 사라져요.</p></div>
    {messages.length === 0 && <p className="room-empty" role="status">아직 음성 메시지가 없어요. 첫 음성 메시지를 녹음해보세요. 스크립트·번역은 아직 준비 중이에요.</p>}
    <div className="day-divider"><span>오늘</span></div>

    {messages.map((message) => message.sender === "partner" ? (
      <div className="chat partner" key={message.id}>
        <div className="mini-avatar">{Array.from(room.partner)[0]}</div>
        <div className="partner-message">
          {renderBubble(message)}
          {/* 스크립트·번역은 STT 가 붙은 예시 메시지에만 있다. 실제 녹음의 STT 는 범위 밖이다. */}
          {room.id === MOCK_ROOM.id && message.source === "mock" && <>
            <div className="detail-toggles">
              <button className={showScript ? "active" : ""} onClick={toggleScript} aria-expanded={showScript} aria-controls="partner-script">스크립트 <span>{showScript ? "⌃" : "⌄"}</span></button>
              <button className={showTranslation ? "active" : ""} onClick={() => setShowTranslation((visible) => !visible)} aria-expanded={showTranslation} aria-controls="partner-translation">번역 <span>{showTranslation ? "⌃" : "⌄"}</span></button>
            </div>
            {showScript && <>
              <div id="partner-script" className="message-details">
                <span>스크립트</span>
                {/* tabIndex={0} 이 FR-028 의 핵심이다 — 포커스 가능한 텍스트 요소에서는
                    Shift+방향키로 캐럿 선택이 되고 그 선택이 getSelection() 에 똑같이
                    나타난다. 키보드 전용 선택 UI 를 따로 만들지 않는다 (R-002). */}
                <p
                  ref={transcriptRef}
                  className="transcript"
                  tabIndex={0}
                  aria-label="스크립트. 배우고 싶은 부분을 골라 표현으로 저장할 수 있어요"
                >
                  {PARTNER_TRANSCRIPT}
                </p>
              </div>
              <ExpressionSheet
                selection={selection}
                draft={draft}
                duplicateOf={duplicateOf}
                storageStatus={storageStatus}
                saveError={saveError}
                savedTerm={savedTerm}
                onStart={startDraft}
                onTermChange={(term) => {
                  setDraft((current) => (current ? { ...current, term } : current));
                  setSaveError(null);
                }}
                onMeaningChange={(meaning) => {
                  setDraft((current) => (current ? { ...current, meaning } : current));
                  setSaveError(null);
                }}
                onSave={submitDraft}
                onCancel={cancelDraft}
              />
            </>}
            {showTranslation && <div id="partner-translation" className="message-details translation-detail"><span>번역</span><p>주말에는 무엇을 하며 보냈어?</p></div>}
          </>}
          <small>{message.sentAtLabel}</small>
        </div>
      </div>
    ) : (
      <div className="chat mine" key={message.id}>
        <div>
          {renderBubble(message)}
          <small>{[message.readLabel, message.sentAtLabel].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
    ))}

    {room.id === MOCK_ROOM.id && <button className="feedback-banner" onClick={onFeedback}><span className="spark">✦</span><div><strong>내 문장을 확인해볼까요?</strong><p>스크립트와 자연스러운 표현이 준비됐어요</p></div><b>→</b></button>}

    <Recorder
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
    />
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
    <div className="eyebrow">AI 피드백</div><h1>잘 전달됐어요!<br/><span>조금 더 자연스럽게</span> 다듬어볼게요.</h1>
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
}: {
  status: UseExpressionsResult["status"];
  expressions: UseExpressionsResult["expressions"];
  count: number;
  onRemove: (id: string) => void;
  reviews: UseReviewsResult;
  onReview: () => void;
  onRoom: () => void;
}) {
  return <section className="screen cards-screen">
    <div className="eyebrow">나의 표현</div>
    <h1>내 표현</h1>
    <p className="lead">대화에서 발견한 표현을 다시 만나보세요.</p>

    <ReviewEntry reviews={reviews} onStart={onReview} onRoom={onRoom} />

    <ExpressionList status={status} expressions={expressions} count={count} onRemove={onRemove} />
  </section>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: "home" | "chat" | "cards" | "user"; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>;
}
