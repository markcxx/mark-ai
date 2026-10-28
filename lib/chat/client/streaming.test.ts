import { afterEach, expect, it, vi } from "vitest";
import { createSmoothTextController } from "./streaming";
afterEach(() => vi.unstubAllGlobals());
it("commits the first text/thought fragment immediately without waiting for animation frames", async () => {
  const frame = vi.fn();
  vi.stubGlobal("requestAnimationFrame", frame);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const commit = vi.fn();
  const controller = createSmoothTextController(commit);
  controller.push("");
  controller.push("开始思考");
  expect(commit).toHaveBeenCalledWith("开始思考");
  expect(frame).not.toHaveBeenCalled();
  controller.push("后续文字");
  expect(frame).toHaveBeenCalledTimes(1);
  controller.flush();
  await controller.finish();
  expect(commit.mock.calls.flat().join("")).toBe("开始思考后续文字");
});
