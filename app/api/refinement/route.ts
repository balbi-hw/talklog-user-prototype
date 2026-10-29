import { isLearningLanguage, isResultSource, MAX_TRANSCRIPT_LENGTH } from "../../lib/understanding";
import { refinementService } from "../../lib/server/understanding/config";
import { handleUnderstanding, readBounded, UnderstandingError } from "../../lib/server/understanding/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleUnderstanding(request, async (signal) => {
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new UnderstandingError("unsupported-format");
    const blob = await readBounded(request, 64 * 1024);
    let body: unknown;
    try { body = JSON.parse(await blob.text()); } catch { throw new UnderstandingError("invalid-input"); }
    if (!body || typeof body !== "object" || !("transcript" in body) || typeof body.transcript !== "string"
      || !("language" in body) || !isLearningLanguage(body.language) || !("source" in body) || !isResultSource(body.source)) throw new UnderstandingError("invalid-input");
    const transcript = body.transcript.trim();
    if (!transcript || transcript.length > MAX_TRANSCRIPT_LENGTH) throw new UnderstandingError("invalid-input");
    const result = await refinementService().refinement({ transcript, language: body.language, source: body.source }, signal);
    return { ...result, source: body.source === "mock" ? "mock" as const : result.source };
  });
}
