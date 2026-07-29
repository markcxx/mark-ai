import WordExtractor from "word-extractor";

export const extractLegacyWordText = async (bytes: Uint8Array) => {
  const extractor = new WordExtractor();
  const document = await extractor.extract(Buffer.from(bytes));
  return document.getBody();
};
