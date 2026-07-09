export type HtmlPreviewPayload = {
  content: string;
  id: string;
  title: string;
};

export const getHtmlPreviewId = (content: string) => {
  let hash = 0;

  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 31 + content.charCodeAt(i)) | 0;
  }

  return `html-${Math.abs(hash).toString(36)}-${content.length}`;
};

export const getHtmlPreviewDocument = (content: string) => {
  const trimmed = content.trim();
  if (/<!doctype|<html[\s>]/i.test(trimmed)) return trimmed;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
};

export const extractHtmlTitle = (content: string) => {
  const match = content.match(/<title>([\S\s]*?)<\/title>/i);
  return match?.[1]?.replaceAll(/\s+/g, ' ').trim();
};

export const sanitizeHtmlFileName = (value: string) =>
  value
    .replaceAll(/["*/:<>?\\|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

export const downloadHtmlFile = (content: string, title: string) => {
  const documentContent = getHtmlPreviewDocument(content);
  const blob = new Blob([documentContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeHtmlFileName(title) || `markai-html-preview-${Date.now()}`}.html`;
  link.click();
  URL.revokeObjectURL(url);
};
