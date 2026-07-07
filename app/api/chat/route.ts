import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { findConfiguredModel } from '@/lib/models';

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();
    const selectedModel = findConfiguredModel(model);

    if (!selectedModel) {
      return NextResponse.json({ error: 'Model is not configured' }, { status: 400 });
    }

    if (selectedModel.provider !== 'gemini') {
      return NextResponse.json({ error: 'This model provider is not available yet' }, { status: 501 });
    }
    
    // Server-side initialization
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const responseStream = await ai.models.generateContentStream({
      model: selectedModel.id,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of responseStream) {
          if (chunk.text) {
            controller.enqueue(new TextEncoder().encode(chunk.text));
          }
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
