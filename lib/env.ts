export type StorageMode = "local" | "cloud";

let _mode: StorageMode | undefined;

export const getStorageMode = (): StorageMode => {
  if (_mode) return _mode;

  const hasSqlitePath = !!process.env.MARKAI_SQLITE_PATH?.trim();
  const hasDatabaseUrl = !!process.env.DATABASE_URL?.trim();

  if (hasSqlitePath) {
    _mode = "local";
  } else if (hasDatabaseUrl) {
    _mode = "cloud";
  } else {
    _mode = "local";
  }

  return _mode;
};

export const isCloudMode = () => getStorageMode() === "cloud";
export const isLocalMode = () => getStorageMode() === "local";
