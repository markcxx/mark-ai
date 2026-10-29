import { expect, it } from "vitest";
import { detectImageContentType } from "./image-content-type";

// Format signatures, independent of any site's URL or response headers.
it.each([
  ["image/jpeg", "ffd8ffe000104a46494600"],
  ["image/png", "89504e470d0a1a0a"],
  ["image/gif", Buffer.from("GIF87a").toString("hex")],
  ["image/gif", Buffer.from("GIF89a").toString("hex")],
  ...["VP8 ", "VP8L", "VP8X"].map((chunk) => [
    "image/webp",
    Buffer.from(`RIFF\x0c\x00\x00\x00WEBP${chunk}`).toString("hex"),
  ]),
])("recognizes %s from its file signature (%s)", (type, hex) => {
  expect(detectImageContentType(Buffer.from(hex, "hex"))).toBe(type);
});

function fileTypeBox(major: string, compatible: string[] = [], extended = false) {
  const offset = extended ? 16 : 8;
  const bytes = Buffer.alloc(offset + 8 + compatible.length * 4);
  bytes.writeUInt32BE(extended ? 1 : bytes.length);
  bytes.write("ftyp", 4);
  if (extended) bytes.writeBigUInt64BE(BigInt(bytes.length), 8);
  bytes.write(major, offset);
  compatible.forEach((brand, index) => bytes.write(brand, offset + 8 + index * 4));
  return bytes;
}

it.each(["avif", "avis"])("recognizes AVIF brand %s in major and compatible brands", (brand) => {
  expect(detectImageContentType(fileTypeBox(brand))).toBe("image/avif");
  expect(detectImageContentType(fileTypeBox("mif1", ["miaf", brand]))).toBe("image/avif");
  expect(detectImageContentType(fileTypeBox("mif1", [brand], true))).toBe("image/avif");
});

it("does not mistake MP4/HEIC or arbitrary avif text for AVIF", () => {
  expect(detectImageContentType(fileTypeBox("isom", ["mp42"]))).toBeUndefined();
  expect(detectImageContentType(fileTypeBox("heic", ["mif1"]))).toBeUndefined();
  const minorVersion = fileTypeBox("isom");
  minorVersion.write("avif", 12);
  expect(detectImageContentType(minorVersion)).toBeUndefined();
  const trailingBrand = Buffer.concat([fileTypeBox("isom"), Buffer.from("avif")]);
  expect(detectImageContentType(trailingBrand)).toBeUndefined();
});

it("rejects truncated or invalid AVIF box lengths without throwing", () => {
  const valid = fileTypeBox("mif1", ["avif"]);
  for (let length = 0; length < valid.length; length++) {
    expect(detectImageContentType(valid.subarray(0, length))).toBeUndefined();
  }
  for (const size of [4, 15, 19, 99999]) {
    const invalid = Buffer.from(valid);
    invalid.writeUInt32BE(size);
    expect(detectImageContentType(invalid)).toBeUndefined();
  }
  const oversized = fileTypeBox("avif", [], true);
  oversized.writeBigUInt64BE(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1), 8);
  expect(detectImageContentType(oversized)).toBeUndefined();
});

it.each([
  "",
  "RIFF1234WAVEfmt ",
  "RIFF1234WEBPjunk",
  "<html>image/png</html>",
  '<svg xmlns="http://www.w3.org/2000/svg"/>',
  "avif",
  "GIF88a",
])("rejects unsupported or non-image content %s", (text) => {
  expect(detectImageContentType(Buffer.from(text))).toBeUndefined();
});

it("compares signature bytes exactly, including their high bits", () => {
  const invalid = Buffer.from("GIF89a");
  invalid[0] |= 0x80;
  expect(detectImageContentType(invalid)).toBeUndefined();
});
