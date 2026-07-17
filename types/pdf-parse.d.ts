declare module "pdf-parse" {
  type PdfPageData = {
    getTextContent: () => Promise<{
      items: Array<{ str?: string; transform?: number[] }>;
    }>;
  };

  type PdfParseOptions = {
    max?: number;
    pagerender?: (page: PdfPageData) => Promise<string>;
  };

  type PdfParseResult = {
    info?: Record<string, unknown>;
    metadata?: unknown;
    numpages: number;
    numrender: number;
    text: string;
  };

  export default function parsePdf(
    data: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  import parsePdf from "pdf-parse";

  export default parsePdf;
}
