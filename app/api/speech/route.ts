import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { generateSpeechAudio } from "@/lib/chat/server/speech";
import { MAX_SPEECH_CHUNK_CHARS } from "@/lib/chat/speech-text";
import { isSpeechVoice, SYSTEM_SPEECH_VOICE } from "@/lib/chat/speech-voices";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 120, scope: "speech" });
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content || Array.from(content).length > MAX_SPEECH_CHUNK_CHARS) {
      return NextResponse.json(
        { error: `单段朗读内容须为 1-${MAX_SPEECH_CHUNK_CHARS} 个字符` },
        { status: 400 },
      );
    }

    const requestedVoice = body?.voice;
    if (
      requestedVoice !== undefined &&
      requestedVoice !== SYSTEM_SPEECH_VOICE &&
      !isSpeechVoice(requestedVoice)
    ) {
      return NextResponse.json({ error: "所选音色不可用" }, { status: 400 });
    }

    const audio = await generateSpeechAudio({
      signal: req.signal,
      text: content,
      voice: requestedVoice === SYSTEM_SPEECH_VOICE ? undefined : requestedVoice,
    });
    return new NextResponse(audio.bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": audio.contentType,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    console.error("Speech synthesis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "语音合成失败，请稍后重试" },
      { status: 500 },
    );
  }
}
