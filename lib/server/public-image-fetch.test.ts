import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), fetch: vi.fn(), connect: undefined as any }));
vi.mock("node:dns/promises", () => ({ default: { lookup: mocks.lookup } }));
vi.mock("undici", () => ({
  Agent: class {
    constructor(options: any) {
      mocks.connect = options.connect.lookup;
    }
  },
  fetch: mocks.fetch,
  EnvHttpProxyAgent: class {},
}));
import { fetchPublicImage, isPublicImageAddress } from "./public-image-fetch";
afterEach(() => vi.clearAllMocks());
it.each([
  "127.0.0.1",
  "10.1.1.1",
  "169.254.169.254",
  "172.16.0.1",
  "192.168.0.1",
  "100.64.0.1",
  "198.18.0.1",
  "198.51.100.2",
  "203.0.113.1",
  "224.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
])("rejects reserved IP %s", (address) => expect(isPublicImageAddress(address)).toBe(false));
it("pins the validated public DNS result to the actual connection", async () => {
  mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  const result = await new Promise((resolve) =>
    mocks.connect("cdn.example.org", { all: true }, (error: Error, addresses: unknown) =>
      resolve({ error, addresses }),
    ),
  );
  expect(result).toEqual({ error: null, addresses: [{ address: "8.8.8.8", family: 4 }] });
});
it("rejects private DNS answers during connection", async () => {
  mocks.lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
  const error = await new Promise((resolve) => mocks.connect("cdn.example.org", {}, resolve));
  expect(error).toBeInstanceOf(Error);
});
it("rejects reserved IP literals which bypass DNS", async () => {
  await expect(fetchPublicImage("https://198.18.0.1/a", {})).rejects.toThrow("内网");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
