"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Recorder from "./components/Recorder";
import VoiceBubble from "./components/VoiceBubble";
import { useVoicePlayback, PREVIEW_ID } from "./hooks/useVoicePlayback";
import { useVoiceRecorder, type SentRecording } from "./hooks/useVoiceRecorder";
import type { VoiceMessage } from "./lib/types";

type Screen = "home" | "room" | "feedback" | "cards" | "review";

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

export default function TalklogApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [saved, setSaved] = useState(false);
  const [answer, setAnswer] = useState<"know" | "again" | null>(null);
  // 화면을 옮겨도 전송한 메시지가 유지되도록 대화 상태는 셸에서 소유한다.
  const [messages, setMessages] = useState<VoiceMessage[]>(INITIAL_MESSAGES);
  // 이동이 막힌 목적지. null 이 아니면 확인을 기다리는 중이다.
  const [blockedNav, setBlockedNav] = useState<Screen | null>(null);

  const pendingRef = useRef<PendingRecording>({ hasPending: false, discard: () => {} });
  const reportPending = useCallback((pending: PendingRecording) => {
    pendingRef.current = pending;
  }, []);

  const move = (next: Screen) => {
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

  const addRecordedMessage = useCallback((recording: SentRecording) => {
    setMessages((current) => [
      ...current,
      {
        id: `r${Date.now()}`,
        sender: "me",
        durationMs: recording.durationMs,
        sentAtLabel: timeLabel(),
        source: "recorded",
        url: recording.url,
        readLabel: null,
      },
    ]);
  }, []);

  return (
    <main className="app-shell">
      <div className="phone-frame">
        <header className="topbar">
          <button className="brand" onClick={() => go("home")} aria-label="홈으로 이동">
            <span className="brand-mark">t</span><span>talklog</span>
          </button>
          <button className="avatar" aria-label="내 프로필">민</button>
        </header>

        {screen === "home" && <Home onOpenRoom={() => go("room")} onReview={() => go("review")} />}
        {screen === "room" && (
          <Room
            messages={messages}
            onSendRecording={addRecordedMessage}
            onFeedback={() => go("feedback")}
            onPendingChange={reportPending}
          />
        )}
        {screen === "feedback" && (
          <Feedback saved={saved} onBack={() => go("room")} onSave={() => setSaved(true)} onCards={() => go("cards")} />
        )}
        {screen === "cards" && <Cards onReview={() => go("review")} />}
        {screen === "review" && <Review answer={answer} onAnswer={setAnswer} onDone={() => go("home")} />}

        <nav className="bottom-nav" aria-label="주요 메뉴">
          <NavButton active={screen === "home"} icon="home" label="홈" onClick={() => go("home")} />
          <NavButton active={screen === "room" || screen === "feedback"} icon="chat" label="대화" onClick={() => go("room")} />
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

function Home({ onOpenRoom, onReview }: { onOpenRoom: () => void; onReview: () => void }) {
  return <section className="screen home-screen">
    <div className="eyebrow">7월 22일 수요일</div>
    <h1>좋은 아침이에요, 민지님<span className="hello-dot">.</span></h1>
    <p className="lead">오늘도 한 문장씩, 가볍게 시작해볼까요?</p>

    <button className="hero-card" onClick={onOpenRoom}>
      <div className="live-chip"><span /> 새 메시지 2개</div>
      <div className="hero-avatars"><span>유</span><span>민</span></div>
      <div className="hero-copy">
        <small>진행 중인 학습방</small>
        <h2>유키와 일본어 대화</h2>
        <p>“週末は何をして過ごしたの？”</p>
      </div>
      <div className="hero-footer"><span>일본어 · 12분 전</span><b>이어하기 →</b></div>
    </button>

    <div className="section-title"><div><span>오늘의 복습</span><h2>기억을 한번 꺼내볼까요?</h2></div><span className="count-pill">8장</span></div>
    <button className="review-card" onClick={onReview}>
      <div className="review-icon">あ</div>
      <div><strong>오늘 복습할 카드</strong><p>약 3분이면 충분해요</p></div>
      <span className="circle-arrow">→</span>
    </button>

    <div className="section-title compact"><div><span>최근 학습</span><h2>이번 주 기록</h2></div><button>전체 보기</button></div>
    <div className="stats-card">
      <div><strong>4</strong><span>대화한 날</span></div><div><strong>23</strong><span>저장한 표현</span></div><div><strong>86%</strong><span>복습 정답률</span></div>
    </div>
  </section>;
}

function Room({
  messages,
  onSendRecording,
  onFeedback,
  onPendingChange,
}: {
  messages: VoiceMessage[];
  onSendRecording: (recording: SentRecording) => void;
  onFeedback: () => void;
  onPendingChange: (pending: PendingRecording) => void;
}) {
  const [showScript, setShowScript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const playback = useVoicePlayback();
  const recorder = useVoiceRecorder({ onSend: onSendRecording });

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
    <div className="room-heading"><div className="friend-avatar">유</div><div><h1>유키와 일본어 대화</h1><p><span /> 일본어 학습 중</p></div><button aria-label="더 보기">•••</button></div>
    <div className="day-divider"><span>오늘</span></div>

    {messages.map((message) => message.sender === "partner" ? (
      <div className="chat partner" key={message.id}>
        <div className="mini-avatar">유</div>
        <div className="partner-message">
          {renderBubble(message)}
          {/* 스크립트·번역은 STT 가 붙은 예시 메시지에만 있다. 실제 녹음의 STT 는 범위 밖이다. */}
          {message.source === "mock" && <>
            <div className="detail-toggles">
              <button className={showScript ? "active" : ""} onClick={() => setShowScript((visible) => !visible)} aria-expanded={showScript} aria-controls="partner-script">스크립트 <span>{showScript ? "⌃" : "⌄"}</span></button>
              <button className={showTranslation ? "active" : ""} onClick={() => setShowTranslation((visible) => !visible)} aria-expanded={showTranslation} aria-controls="partner-translation">번역 <span>{showTranslation ? "⌃" : "⌄"}</span></button>
            </div>
            {showScript && <div id="partner-script" className="message-details"><span>스크립트</span><p className="transcript">週末は何をして過ごしたの？</p></div>}
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

    <button className="feedback-banner" onClick={onFeedback}><span className="spark">✦</span><div><strong>내 문장을 확인해볼까요?</strong><p>스크립트와 자연스러운 표현이 준비됐어요</p></div><b>→</b></button>

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

function Feedback({ saved, onBack, onSave, onCards }: { saved: boolean; onBack: () => void; onSave: () => void; onCards: () => void }) {
  return <section className="screen feedback-screen">
    <button className="back" onClick={onBack} aria-label="대화로 돌아가기">←</button>
    <div className="eyebrow">AI 피드백</div><h1>잘 전달됐어요!<br/><span>조금 더 자연스럽게</span> 다듬어볼게요.</h1>
    <div className="feedback-card original"><div className="card-label">내가 말한 문장</div><p>週末に映画館で映画を見ました。</p><button className="sound">▶ 들어보기</button></div>
    <div className="connector-line" />
    <div className="feedback-card suggestion"><div className="card-label">✦ 더 자연스러운 표현</div><p>週末は映画館で映画を見たよ。</p><button className="sound">▶ 들어보기</button><div className="why"><strong>왜 이렇게 바꿨나요?</strong><p>친구와의 편한 대화에서는 「〜ました」보다 「〜たよ」가 더 자연스러워요.</p></div></div>
    <div className="expression"><div><span>저장할 표현</span><h2>映画館で映画を見る</h2><p>영화관에서 영화를 보다</p></div><button className={saved ? "saved" : ""} onClick={onSave}>{saved ? "✓ 저장됨" : "+ 카드에 저장"}</button></div>
    {saved && <button className="primary-button" onClick={onCards}>저장한 카드 확인하기 →</button>}
  </section>;
}

function Cards({ onReview }: { onReview: () => void }) {
  return <section className="screen cards-screen"><div className="eyebrow">나의 표현</div><h1>플래시카드</h1><p className="lead">대화에서 발견한 표현을 다시 만나보세요.</p>
    <div className="card-summary"><div><small>오늘의 복습</small><strong>8</strong><span>장 남았어요</span></div><button onClick={onReview}>복습 시작 →</button></div>
    <div className="filter-row"><button className="active">전체 23</button><button>최근 저장</button><button>어려워요</button></div>
    {[['映画館で映画を見る','영화관에서 영화를 보다','유키와 일본어 대화'],['久しぶりだね','오랜만이야','유키와 일본어 대화'],['楽しみにしている','기대하고 있어','하루와 일본어 대화']].map(([jp,ko,source],i)=><article className="word-card" key={jp}><div className="word-index">{String(i+1).padStart(2,'0')}</div><div><h2>{jp}</h2><p>{ko}</p><small>↳ {source}</small></div><button aria-label="음성 재생">▶</button></article>)}
  </section>;
}

function Review({ answer, onAnswer, onDone }: { answer: "know" | "again" | null; onAnswer: (a: "know" | "again") => void; onDone: () => void }) {
  const [flipped, setFlipped] = useState(false);
  return <section className="screen review-screen"><div className="review-top"><button onClick={onDone}>×</button><div className="progress"><i /></div><span>1 / 8</span></div><div className="eyebrow">오늘의 복습</div>
    <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(true)}>
      {!flipped ? <><small>이 표현을 기억하시나요?</small><div className="jp-word">映画館で<br/>映画を見る</div><span className="tap-hint">카드를 눌러 뜻 보기</span></> : <><small>뜻</small><div className="ko-word">영화관에서<br/>영화를 보다</div><div className="example"><span>대화 속 문장</span><p>週末は映画館で映画を見たよ。</p></div></>}
    </button>
    {flipped && !answer && <div className="answer-row"><button onClick={() => onAnswer("again")}><span>↻</span>다시 볼래요</button><button className="know" onClick={() => onAnswer("know")}><span>✓</span>알고 있어요</button></div>}
    {answer && <div className="result-panel"><strong>{answer === "know" ? "멋져요, 기억하고 있네요!" : "괜찮아요, 한 번 더 만나면 돼요."}</strong><button onClick={onDone}>복습 마치기</button></div>}
  </section>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: "home" | "chat" | "cards" | "user"; label: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>;
}
