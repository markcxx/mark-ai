export const extractTranslation = (value: string) => {
  const tagged = value.match(/<translation>\s*([\s\S]*?)\s*<\/translation>/i)?.[1];
  return (tagged || value)
    .replace(/^```(?:markdown|text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:译文|翻译|translation)\s*[：:]\s*/i, "")
    .trim();
};
