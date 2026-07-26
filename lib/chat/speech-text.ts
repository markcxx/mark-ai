export const MAX_SPEECH_CHUNK_CHARS = 600;

const STRONG_BOUNDARY = /[\n。！？!?；;]/;
const SOFT_BOUNDARY = /[，,、：:\s]/;

const findBoundary = (characters: string[], limit: number) => {
  const minimum = Math.floor(limit * 0.55);

  for (let index = limit - 1; index >= minimum; index -= 1) {
    if (STRONG_BOUNDARY.test(characters[index])) return index + 1;
  }
  for (let index = limit - 1; index >= minimum; index -= 1) {
    if (SOFT_BOUNDARY.test(characters[index])) return index + 1;
  }
  return limit;
};

export const splitSpeechText = (content: string, limit = MAX_SPEECH_CHUNK_CHARS): string[] => {
  if (!Number.isInteger(limit) || limit < 1) return [];

  const chunks: string[] = [];
  let remaining = Array.from(content.trim());

  while (remaining.length > 0) {
    const end = remaining.length <= limit ? remaining.length : findBoundary(remaining, limit);
    const chunk = remaining.slice(0, end).join("").trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(end);
  }

  return chunks;
};
