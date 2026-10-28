"use client";

import { useEffect, useRef } from "react";
import type { ReviewAnswer } from "../lib/reviews";

export default function ReviewComplete({ answers, onHome, onRoom }: {
  answers: Map<string, ReviewAnswer>; onHome: () => void; onRoom: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const known = [...answers.values()].filter((answer) => answer === "know").length;
  return <section className="screen review-complete">
    <div className="eyebrow">오늘의 복습</div>
    <h1 ref={heading} tabIndex={-1}>복습을 마쳤어요!</h1>
    <p className="lead" role="status">{answers.size}장의 카드를 복습했어요.</p>
    <dl className="review-results">
      <div><dt>복습한 카드</dt><dd>{answers.size}장</dd></div>
      <div><dt>알고 있어요</dt><dd>{known}장</dd></div>
      <div><dt>다시 볼 카드</dt><dd>{answers.size - known}장</dd></div>
    </dl>
    <p className="review-help">같은 카드를 다시 봤다면 마지막 응답으로 세었어요.</p>
    <button className="primary-button" onClick={onRoom}>학습방으로 돌아가기</button>
    <button className="review-secondary" onClick={onHome}>홈으로</button>
  </section>;
}
