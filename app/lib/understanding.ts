/** 제공자 독립 이해 보조 계약. 서버 응답과 화면은 이 타입만 공유한다. */
export type LearningLanguage = "ja" | "en" | "zh";
export type ResultSource = "real" | "mock";
export type UnderstandingResult = { text: string; source: ResultSource };
export type TranscriptInput = { voice: Blob; language: LearningLanguage };
export type TranslationInput = { transcript: string; language: LearningLanguage; source: ResultSource };
export interface TranscriptService {
  transcript(input: TranscriptInput, signal: AbortSignal): Promise<UnderstandingResult>;
}
export interface TranslationService {
  translation(input: TranslationInput, signal: AbortSignal): Promise<UnderstandingResult>;
}
export type RefinementInput = TranslationInput;
export type RefinementResult = { refinedSentence: string; reason: string; changed: boolean; source: ResultSource };
export interface RefinementService {
  refinement(input: RefinementInput, signal: AbortSignal): Promise<RefinementResult>;
}
export type RefinementState =
  | { status: "idle" | "pending" }
  | { status: "success" | "unchanged"; result: RefinementResult }
  | { status: "failed" | "timeout" | "limit" | "network"; code: UnderstandingErrorCode };
export function isRefinementResult(value: unknown): value is RefinementResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return Object.keys(result).length === 4
    && typeof result.refinedSentence === "string" && !!result.refinedSentence.trim() && result.refinedSentence.length <= MAX_TRANSCRIPT_LENGTH
    && typeof result.reason === "string" && !!result.reason.trim() && result.reason.length <= 1_000
    && typeof result.changed === "boolean" && isResultSource(result.source);
}
export type UnderstandingErrorCode = "invalid-input" | "too-large" | "unsupported-format" | "failed" | "timeout" | "limit" | "network";
export type UnderstandingResponse = { ok: true; result: UnderstandingResult } | { ok: false; error: { code: UnderstandingErrorCode } };
export type RefinementResponse = { ok: true; result: RefinementResult } | { ok: false; error: { code: UnderstandingErrorCode } };
export type UnderstandingState =
  | { status: "idle" | "pending" }
  | { status: "success" | "empty"; result: UnderstandingResult }
  | { status: "failed" | "timeout" | "limit" | "network"; code: UnderstandingErrorCode };
export type MessageUnderstandingState = { transcript: UnderstandingState; translation: UnderstandingState; refinement: RefinementState };
export const INITIAL_UNDERSTANDING: MessageUnderstandingState = { transcript: { status: "idle" }, translation: { status: "idle" }, refinement: { status: "idle" } };
export const MAX_TRANSCRIPT_LENGTH = 8_000;
export function isLearningLanguage(value: unknown): value is LearningLanguage {
  return value === "ja" || value === "en" || value === "zh";
}
export function isResultSource(value: unknown): value is ResultSource {
  return value === "real" || value === "mock";
}
export const UNDERSTANDING_NOTICE = {
  idle: "아직 요청하지 않았어요.", pending: "처리 중이에요. 재생과 답장은 계속할 수 있어요.",
  success: "준비됐어요.", empty: "말소리나 표시할 내용이 없어요. 음성을 확인하고 다시 시도해주세요.",
  failed: "처리하지 못했어요. 다시 시도해주세요.", timeout: "시간이 초과됐어요. 다시 시도해주세요.",
  limit: "사용 한도를 초과했어요. 잠시 후 다시 시도해주세요.", network: "네트워크 연결이 끊겼어요. 연결을 확인하고 다시 시도해주세요.",
} satisfies Record<UnderstandingState["status"], string>;
