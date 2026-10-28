"use client";
import { useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { ProfileSettings, type UserProfile } from "./settings/ProfileSettings";
export type { UserProfile } from "./settings/ProfileSettings";

export function ProfileDialog({
  email,
  fallbackAvatar,
  fallbackName,
  onClose,
  onProfileUpdated,
  profile,
}: {
  email: string;
  fallbackAvatar?: string | null;
  fallbackName: string;
  onClose: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
  profile: UserProfile | null;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <AppDialog
      bodyClassName="min-h-0 overflow-y-auto"
      closeDisabled={saving}
      onClose={onClose}
      open
      title="个人资料"
      width={560}
      zIndex={1200}
    >
      <div className="p-5">
        <ProfileSettings
          email={email}
          fallbackAvatar={fallbackAvatar}
          fallbackName={fallbackName}
          initialProfile={profile}
          onSavingChange={setSaving}
          onSaved={(value) => {
            onProfileUpdated(value);
            onClose();
          }}
        />
      </div>
    </AppDialog>
  );
}
