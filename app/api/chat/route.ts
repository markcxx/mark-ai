import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { findConfiguredModel } from '@/lib/models';

type ChatMessage = {
  content: string;
  role: 'user' | 'model' | 'assistant';
};

type StreamEventType = 'content' | 'reasoning';

const toOpenAIChatEndpoint = (baseUrl?: string) => {
  if (!baseUrl) return undefined;

  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
};

const getTextValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (!Array.isArray(value)) return '';

  return value
    .map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('');
};

const getChoiceText = (choice: any, fields: string[]) => {
  for (const source of [choice?.delta, choice?.message, choice]) {
    for (const field of fields) {
      const text = getTextValue(source?.[field]);
      if (text) return text;
    }
  }

  return '';
};

const encodeStreamEvent = (encoder: TextEncoder, type: StreamEventType, text: string) =>
  encoder.encode(`${JSON.stringify({ type, text })}\n`);

const createOpenAICompatibleStream = async (
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  baseUrl?: string,
) => {
  const endpoint = toOpenAIChatEndpoint(baseUrl);
  if (!endpoint) {
    return NextResponse.json({ error: 'Model base URL is not configured' }, { status: 400 });
  }

  const upstream = await fetch(endpoint, {
    body: JSON.stringify({
      messages: messages.map(message => ({
        content: message.content,
        role: message.role === 'model' ? 'assistant' : message.role,
      })),
      model,
      stream: true,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return NextResponse.json(
      { error: 'Upstream model request failed', detail },
      { status: upstream.status },
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: 'No upstream response body' }, { status: 502 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';

      const enqueueDataLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return false;

        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') return data === '[DONE]';

        try {
          const parsed = JSON.parse(data);
          const choices = Array.isArray(parsed.choices) ? parsed.choices : [];

          for (const choice of choices) {
            const reasoning = getChoiceText(choice, [
              'reasoning_content',
              'reasoningContent',
              'reasoning',
              'thinking_content',
              'thinkingContent',
              'thinking',
            ]);
            const content = getChoiceText(choice, ['content', 'text']);

            if (reasoning) controller.enqueue(encodeStreamEvent(encoder, 'reasoning', reasoning));
            if (content) controller.enqueue(encodeStreamEvent(encoder, 'content', content));
          }
        } catch {
          // Some compatible providers send comments or metadata lines in the SSE stream.
        }

        return false;
      };

      while (true) {
        const { value, done } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (enqueueDataLine(line)) {
              controller.close();
              return;
            }
          }
        }

        if (done) break;
      }

      if (buffer) enqueueDataLine(buffer);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
  });
};

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider } = await req.json();
    const selectedModel = findConfiguredModel(model, provider);

    if (!selectedModel) {
      return NextResponse.json({ error: 'Model is not configured' }, { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    if (selectedModel.runtime === 'openai-compatible') {
      return createOpenAICompatibleStream(
        messages,
        selectedModel.id,
        selectedModel.apiKey,
        selectedModel.baseUrl,
      );
    }

    const ai = new GoogleGenAI({
      apiKey: selectedModel.apiKey,
      ...(selectedModel.baseUrl ? { httpOptions: { baseUrl: selectedModel.baseUrl } } : {}),
    });

    const prompt = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map((message: ChatMessage) => ({
      parts: [{ text: message.content }],
      role: message.role === 'model' ? 'model' : 'user',
    }));

    const responseStream = await ai.models.generateContentStream({
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] },
      ],
      model: selectedModel.id,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        for await (const chunk of responseStream) {
          if (chunk.text) {
            controller.enqueue(encodeStreamEvent(encoder, 'content', chunk.text));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'application/x-ndjson; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
