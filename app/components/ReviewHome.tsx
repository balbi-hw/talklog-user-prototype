"use client";

import type { UseReviewsResult } from "../hooks/useReviews";
import ReviewEntry from "./ReviewEntry";

export default function ReviewHome({ reviews, onStart, onRoom, onCards }: {
  reviews: UseReviewsResult; onStart: () => void; onRoom: () => void; onCards: () => void;
}) {
  return <>
    <ReviewEntry reviews={reviews} onStart={onStart} onRoom={onRoom} />
    <div className="section-title compact"><div><span>복습과 표현</span><h2>지금까지의 기록</h2></div>
      <button onClick={onCards}>전체 보기</button></div>
    {reviews.status === "ready" && <div className="stats-card review-stats">
      <div><strong>{reviews.expressionCount}</strong><span>저장한 표현</span></div>
      <div><strong>{reviews.accuracy === null ? "아직 기록이 없어요" : `${reviews.accuracy}%`}</strong><span>복습 정답률</span></div>
    </div>}
  </>;
}
