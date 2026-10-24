// Cloud-mode anonymous visitors use the regular chat shell with read-only public
// data. Stores consult this flag so they never call protected APIs for guests.

export const GUEST_DRAFT_STORAGE_KEY = "markai:guest-draft";

let guestMode = false;
let readDraft: () => string = () => "";

export const isGuestMode = () => guestMode;

export const setGuestMode = (enabled: boolean, draftReader?: () => string) => {
  // Module state is shared across server renders, so only the browser may own it.
  if (typeof window === "undefined") return;
  guestMode = enabled;
  if (draftReader) readDraft = draftReader;
};

/** Saves the current draft and sends the visitor to login, returning to `/`. */
export const requestGuestSignIn = () => {
  const draft = readDraft().trim();
  try {
    if (draft) window.localStorage.setItem(GUEST_DRAFT_STORAGE_KEY, draft);
  } catch {
    // The login flow still works when browser storage is unavailable.
  }
  window.location.assign("/login?callbackUrl=%2F");
};
