type BanState = {
  banExpires?: Date | null | string;
  banned?: boolean | null;
};

export const isActiveBan = (user: BanState, now = Date.now()) => {
  if (!user.banned) return false;
  if (!user.banExpires) return true;
  const expiresAt = new Date(user.banExpires).getTime();
  return !Number.isFinite(expiresAt) || expiresAt > now;
};
