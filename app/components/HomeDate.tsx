"use client";

import { useEffect, useState } from "react";

/** 서버와 첫 클라이언트 렌더를 일치시키고 날짜는 기기에서 확인한다. */
export default function HomeDate() {
  const [date, setDate] = useState("");

  useEffect(() => {
    const refresh = () => setDate(new Date().toLocaleDateString("ko-KR", {
      month: "long", day: "numeric", weekday: "long",
    }));
    refresh();
    // 자정과 기기 시계·시간대 변경도 반영하며, 절전 후 복귀 시 즉시 갱신한다.
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return <div className="eyebrow">{date || "오늘의 날짜를 확인하고 있어요"}</div>;
}
