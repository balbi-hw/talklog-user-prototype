import { isLearningLanguage } from "../../lib/understanding";
import { transcriptService } from "../../lib/server/understanding/config";
import { handleUnderstanding, MAX_VOICE_BYTES, readBounded, UnderstandingError } from "../../lib/server/understanding/http";

export const runtime = "nodejs";
const ALLOWED_MIME = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-wav", "video/webm", "video/mp4", "application/ogg"]);
export async function POST(request: Request) {
  return handleUnderstanding(request, async (signal) => {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new UnderstandingError("unsupported-format");
    const blob = await readBounded(request, MAX_VOICE_BYTES + 64 * 1024);
    let form: FormData;
    try { form = await new Response(blob, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
    catch { throw new UnderstandingError("invalid-input"); }
    const voice = form.get("voice");
    const language = form.get("language");
    if (!(voice instanceof Blob) || !isLearningLanguage(language) || voice.size === 0) throw new UnderstandingError("invalid-input");
    if (voice.size > MAX_VOICE_BYTES) throw new UnderstandingError("too-large");
    if (!ALLOWED_MIME.has(voice.type.split(";")[0].trim().toLowerCase())) throw new UnderstandingError("unsupported-format");
    return transcriptService().transcript({ voice, language }, signal);
  });
}
