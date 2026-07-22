import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talklog — 대화가 배움이 되는 순간",
  description: "친구와 음성 메시지를 주고받고, 표현을 자연스럽게 익히는 언어 학습 프로토타입",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
