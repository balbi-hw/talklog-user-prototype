"use client";

import { useEffect, useRef } from "react";
import type { UseReviewsResult } from "../hooks/useReviews";

export default function ReviewEntry({ reviews, onStart, onRoom, onReload }: {
  reviews: UseReviewsResult; onStart: () => void; onRoom: () => void;
  onReload?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const retrying = useRef(false);
  useEffect(() => {
    if (retrying.current) { heading.current?.focus(); retrying.current = false; }
  }, [reviews.status]);
  return <div className="review-entry">
    <h2 ref={heading} tabIndex={-1}>오늘의 복습</h2>
    {reviews.status === "loading" ? <p role="status">복습 기록을 읽고 있어요.</p> :
      reviews.status === "unavailable" ? <>
        <p role="status">저장소를 읽거나 쓸 수 없어요. 브라우저의 사이트 데이터 설정과 저장 공간을 확인해주세요.</p>
        <button className="review-secondary" onClick={() => { retrying.current = true; (onReload ?? reviews.refresh)(); heading.current?.focus(); }}>다시 읽기</button>
      </> : reviews.expressionCount === 0 ? <>
        <p>아직 저장한 표현이 없어요. 학습방에서 스크립트를 펼치고 배우고 싶은 부분을 골라 뜻과 함께 저장해보세요.</p>
        <button className="review-secondary" onClick={onRoom}>학습방으로 가기</button>
      </> : reviews.dueCount === 0 ? <>
        <p role="status">오늘 복습할 카드가 없어요.</p>
        {reviews.nextDate && <p>다음 복습 예정일: <time dateTime={reviews.nextDate}>{reviews.nextDate}</time></p>}
      </> : <>
        <p>오늘 복습할 카드 <strong>{reviews.dueCount}장</strong></p>
        <p>한 번에 최대 20장씩 복습해요.</p>
        <button className="primary-button" onClick={onStart}>복습 시작 →</button>
      </>}
  </div>;
}
