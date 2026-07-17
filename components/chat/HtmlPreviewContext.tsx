"use client";

import { createContext, useContext } from "react";

import type { HtmlPreviewPayload } from "./htmlPreviewUtils";

export type HtmlPreviewContextValue = {
  activePreview: HtmlPreviewPayload | null;
  closePreview: () => void;
  openPreview: (preview: HtmlPreviewPayload) => void;
};

export const HtmlPreviewContext = createContext<HtmlPreviewContextValue | null>(null);

export const useHtmlPreview = () => useContext(HtmlPreviewContext);
