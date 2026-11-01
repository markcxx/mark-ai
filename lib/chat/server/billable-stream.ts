// Model output events. An `error` event alone means the provider call failed.
const OUTPUT = /"type"\s*:\s*"(?:content|reasoning|image|tool_use|tool)"/;

/**
 * Passes an NDJSON chat stream through unchanged and calls `onBillable` once,
 * as soon as the provider has produced output. Failed calls are never billed;
 * a reply aborted after it started still is, since the provider charged us.
 */
export function billOnFirstOutput(response: Response, onBillable: () => void): Response {
  if (!response.ok || !response.body) return response;
  let billed = false;
  let tail = "";
  const decoder = new TextDecoder();
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (!billed) {
          // Keep a short tail so an event split across chunks is still seen.
          const text = tail + decoder.decode(chunk, { stream: true });
          if (OUTPUT.test(text)) {
            billed = true;
            onBillable();
          } else tail = text.slice(-64);
        }
        controller.enqueue(chunk);
      },
    }),
  );
  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
