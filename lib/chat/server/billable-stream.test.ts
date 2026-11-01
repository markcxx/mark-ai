import { expect, it, vi } from "vitest";
import { billOnFirstOutput } from "./billable-stream";

const stream = (...parts: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    }),
  );

it("bills once when the provider produces output, even split across chunks", async () => {
  const bill = vi.fn();
  const res = billOnFirstOutput(
    stream('{"ty', 'pe":"content","text":"你好"}\n', '{"type":"content"}\n'),
    bill,
  );
  expect(await res.text()).toContain("你好");
  expect(bill).toHaveBeenCalledTimes(1);
});

it("never bills a stream that only reports an error", async () => {
  const bill = vi.fn();
  await billOnFirstOutput(stream('{"type":"error","error":"HTTP 500"}\n'), bill).text();
  expect(bill).not.toHaveBeenCalled();
});

it("never bills a failed response", async () => {
  const bill = vi.fn();
  billOnFirstOutput(new Response("x", { status: 502 }), bill);
  expect(bill).not.toHaveBeenCalled();
});
