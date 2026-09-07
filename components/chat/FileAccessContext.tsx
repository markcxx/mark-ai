"use client";

import { createContext, useContext } from "react";

export type FileUrlResolver = (fileId: string, action: "preview" | "download") => string;
export const FileAccessContext = createContext<FileUrlResolver>(
  (id, action) => `/api/files/${encodeURIComponent(id)}/${action}`,
);
export const useFileUrl = () => useContext(FileAccessContext);
