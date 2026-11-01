import "server-only";
import type { TranscriptService, TranslationService } from "../../understanding";
import { createOpenAITranscript } from "./adapters/openai";
import { createClaudeTranslation } from "./adapters/claude";
import { mockTranscript, mockTranslation } from "./adapters/mock";
import { UnderstandingError } from "./http";

/** 제공자 선택·모델 기본값은 이 서버 파일에만 둔다. */
export function transcriptService(): TranscriptService {
  const key = process.env.OPENAI_API_KEY?.trim();
  const provider = process.env.TRANSCRIPT_PROVIDER?.trim() || (key ? "openai" : "mock");
  if (provider !== "openai" && provider !== "mock") throw new UnderstandingError("failed");
  if (provider === "mock" || !key) return mockTranscript;
  return createOpenAITranscript(key, process.env.TRANSCRIPT_MODEL?.trim() || "whisper-1");
}
export function translationService(): TranslationService {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const provider = process.env.TRANSLATION_PROVIDER?.trim() || (key ? "claude" : "mock");
  if (provider !== "claude" && provider !== "mock") throw new UnderstandingError("failed");
  if (provider === "mock" || !key) return mockTranslation;
  return createClaudeTranslation(key, process.env.TRANSLATION_MODEL?.trim() || "claude-haiku-5-5");
}
