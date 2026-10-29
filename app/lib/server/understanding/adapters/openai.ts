import "server-only";
import type { TranscriptService } from "../../../understanding";
import { checkUpstream, UnderstandingError } from "../http";

export function createOpenAITranscript(key: string, model: string): TranscriptService {
  return {
    async transcript({ voice, language }, signal) {
      const mime = voice.type.split(";")[0].toLowerCase();
      const extension = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg"
        : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "webm";
      const form = new FormData();
      form.set("file", voice, `recording.${extension}`);
      form.set("model", model);
      form.set("language", language);
      form.set("response_format", "json");
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal, cache: "no-store",
      });
      checkUpstream(response);
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string") {
        throw new UnderstandingError("failed");
      }
      return { text: body.text, source: "real" };
    },
  };
}
