import "server-only";
import type { LearningLanguage, TranscriptService, TranslationService } from "../../../understanding";

/** 음성을 분석하지 않는 개발용 고정 예시. 실제 결과로 표시해서는 안 된다. */
const MOCK_TRANSCRIPTS: Record<LearningLanguage, string> = {
  ja: "週末は映画館で映画を見ました。とても楽しかったです。",
  en: "I watched a movie at the cinema this weekend. It was a lot of fun.",
  zh: "周末我去电影院看了电影。非常开心。",
};
export const mockTranscript: TranscriptService = {
  async transcript({ language }) { return { text: MOCK_TRANSCRIPTS[language], source: "mock" }; },
};
export const mockTranslation: TranslationService = {
  async translation() { return { text: "주말에 영화관에서 영화를 봤어요. 정말 즐거웠어요.", source: "mock" }; },
};
