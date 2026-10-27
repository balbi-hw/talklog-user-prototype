"use client";

import { useEffect, useRef, useState } from "react";
import type { UseReviewsResult } from "../hooks/useReviews";
import ReviewComplete from "./ReviewComplete";
import ReviewEntry from "./ReviewEntry";

export default function ReviewSession({ reviews, onExit, onRoom }: {
  reviews: UseReviewsResult; onExit: () => void; onRoom: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const flip = useRef<HTMLButtonElement>(null);
  const firstAnswer = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { session, current } = reviews;
  useEffect(() => {
    setFlipped(false);
    flip.current?.focus();
  }, [session?.position]);
  useEffect(() => { if (flipped) firstAnswer.current?.focus(); }, [flipped]);
  useEffect(() => { if (!session) heading.current?.focus(); }, [session]);

  if (!session) return <section className="screen">
    <button className="back" aria-label="홈으로 돌아가기" onClick={onExit}>←</button>
    <h1 ref={heading} tabIndex={-1}>복습할 카드를 확인해요</h1>
    <ReviewEntry reviews={reviews} onStart={reviews.start} onRoom={onRoom} />
  </section>;
  if (session.position >= session.queue.length) {
    return <ReviewComplete answers={session.finalAnswers} onHome={onExit} onRoom={onRoom} />;
  }
  return <section className="screen review-screen review-session">
    <div className="review-top">
      <button onClick={onExit} aria-label="복습을 나가고 홈으로 이동">×</button>
      <progress aria-label="복습 진행" value={session.position} max={session.queue.length} />
      <span>{session.position + 1} / {session.queue.length}</span>
    </div>
    <h1 className="review-title">오늘의 복습</h1>
    <p className="review-help">카드 {session.initialCount}장 · 다시 볼 카드는 끝에 한 번 더 나와요.<br/>나가도 지금까지의 응답은 남아요.</p>
    {!current ? <p role="status">삭제된 표현을 확인하고 있어요.</p> : <>
      <div className="review-expression">
        <p className="expression-term">{current.term}</p>
        <button ref={flip} className="review-secondary" aria-expanded={flipped} aria-controls="review-details"
          onClick={() => setFlipped((value) => !value)}>{flipped ? "뜻 숨기기" : "뜻 보기"}</button>
        <div id="review-details" hidden={!flipped}>
          <p className="expression-meaning">{current.meaning}</p>
          <p className="review-example">{current.example}</p>
          <p className="review-help">출처 학습방: {current.sourceRoom}</p>
        </div>
      </div>
      {flipped && <div className="answer-row">
        <button ref={firstAnswer} onClick={() => reviews.answer("again")}>↻ 다시 볼래요</button>
        <button className="know" onClick={() => reviews.answer("know")}>✓ 알고 있어요</button>
      </div>}
    </>}
    <p className="review-notice" role="status">{reviews.notice}</p>
    {reviews.status === "unavailable" && <p className="review-help">저장소를 사용할 수 없어요. 응답은 저장되지 않았고 현재 카드에 머물러 있어요.</p>}
  </section>;
}
