"use client";

import { useEffect, useState } from "react";

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

const Wave = ({ light = false }: { light?: boolean }) => (
  <div className={`wave ${light ? "wave-light" : ""}`} aria-hidden="true">
    {[9, 18, 12, 24, 16, 29, 20, 13, 23, 17, 27, 14, 21, 11, 18, 8].map((h, i) => <i key={i} style={{ height: h }} />)}
  </div>
);

export default function TalklogApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saved, setSaved] = useState(false);
  const [answer, setAnswer] = useState<"know" | "again" | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const go = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
            recording={recording}
            seconds={seconds}
            onRecord={() => { setRecording((v) => !v); if (recording) setSeconds(0); }}
            onFeedback={() => go("feedback")}
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

function Room({ recording, seconds, onRecord, onFeedback }: { recording: boolean; seconds: number; onRecord: () => void; onFeedback: () => void }) {
  const [showScript, setShowScript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  return <section className="screen room-screen">
    <div className="room-heading"><div className="friend-avatar">유</div><div><h1>유키와 일본어 대화</h1><p><span /> 일본어 학습 중</p></div><button aria-label="더 보기">•••</button></div>
    <div className="day-divider"><span>오늘</span></div>
    <div className="chat partner"><div className="mini-avatar">유</div><div className="partner-message"><div className="bubble audio-bubble"><button aria-label="음성 재생">▶</button><Wave /><time>0:08</time></div><div className="detail-toggles"><button className={showScript ? "active" : ""} onClick={() => setShowScript((visible) => !visible)} aria-expanded={showScript} aria-controls="partner-script">스크립트 <span>{showScript ? "⌃" : "⌄"}</span></button><button className={showTranslation ? "active" : ""} onClick={() => setShowTranslation((visible) => !visible)} aria-expanded={showTranslation} aria-controls="partner-translation">번역 <span>{showTranslation ? "⌃" : "⌄"}</span></button></div>{showScript && <div id="partner-script" className="message-details"><span>스크립트</span><p className="transcript">週末は何をして過ごしたの？</p></div>}{showTranslation && <div id="partner-translation" className="message-details translation-detail"><span>번역</span><p>주말에는 무엇을 하며 보냈어?</p></div>}<small>오전 9:41</small></div></div>
    <div className="chat mine"><div><div className="bubble mine-bubble"><button aria-label="음성 재생">▶</button><Wave light /><time>0:11</time></div><small>읽음 · 오전 9:46</small></div></div>
    <button className="feedback-banner" onClick={onFeedback}><span className="spark">✦</span><div><strong>내 문장을 확인해볼까요?</strong><p>스크립트와 자연스러운 표현이 준비됐어요</p></div><b>→</b></button>

    <div className={`recorder ${recording ? "is-recording" : ""}`}>
      {recording ? <><span className="record-time">● 00:{String(seconds).padStart(2, "0")}</span><p>말하고 있어요…</p></> : <p>눌러서 음성 메시지를 녹음하세요</p>}
      <button className="record-button" onClick={onRecord} aria-label={recording ? "녹음 완료" : "녹음 시작"}>{recording ? <span className="stop" /> : <span className="mic">●</span>}</button>
      <small>{recording ? "완료하려면 다시 눌러주세요" : "마이크 버튼을 누르면 녹음이 시작돼요"}</small>
    </div>
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
