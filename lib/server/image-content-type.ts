const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Recognize supported raster formats from bytes, not URLs or upstream MIME.
 * This identifies the format; decoding remains the browser's responsibility.
 */
export function detectImageContentType(bytes: Buffer): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  const signature = bytes.toString("latin1", 0, 6);
  if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  if (
    bytes.length >= 16 &&
    bytes.toString("latin1", 0, 4) === "RIFF" &&
    bytes.toString("latin1", 8, 12) === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("latin1", 12, 16))
  ) {
    return "image/webp";
  }

  // AVIF uses an ISO BMFF FileTypeBox. Inspect its major/compatible brands,
  // skipping the minor version and never scanning unrelated file contents.
  // https://aomediacodec.github.io/av1-avif/#brands
  if (bytes.length < 16 || bytes.toString("latin1", 4, 8) !== "ftyp") return;
  let boxEnd = bytes.readUInt32BE(0);
  let brandOffset = 8;
  if (boxEnd === 1) {
    if (bytes.length < 24) return;
    const largeSize = bytes.readBigUInt64BE(8);
    if (largeSize > BigInt(bytes.length)) return;
    boxEnd = Number(largeSize);
    brandOffset = 16;
  } else if (boxEnd === 0) {
    boxEnd = bytes.length;
  }
  if (boxEnd > bytes.length || boxEnd < brandOffset + 8 || (boxEnd - brandOffset) % 4) return;
  for (let offset = brandOffset; offset < boxEnd; offset += 4) {
    if (offset === brandOffset + 4) continue;
    const brand = bytes.toString("latin1", offset, offset + 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
}
