"use client";

import { useEffect, useState } from "react";
import {
  OnboardingDialog,
  type OnboardingRole,
} from "@/components/onboarding/onboarding-dialog";

const STORAGE_PREFIX = "boxbuild_onboarding_completed:";

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingCompleted(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function resetOnboarding(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

interface OnboardingTriggerProps {
  userId: string;
  role: OnboardingRole;
  userName?: string;
}

/**
 * Mounts into the dashboard layout and automatically shows the onboarding
 * the first time a given user lands in the app. Completion is persisted in
 * localStorage keyed by auth user id, so each user sees it exactly once per
 * device/browser.
 */
export function OnboardingTrigger({
  userId,
  role,
  userName,
}: OnboardingTriggerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (!hasCompletedOnboarding(userId)) {
      // Tiny delay so the dashboard paints first — feels more polished.
      const timer = window.setTimeout(() => setOpen(true), 400);
      return () => window.clearTimeout(timer);
    }
  }, [userId]);

  const handleFinish = () => {
    if (userId) markOnboardingCompleted(userId);
  };

  return (
    <OnboardingDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && userId) markOnboardingCompleted(userId);
      }}
      role={role}
      userName={userName}
      onFinish={handleFinish}
    />
  );
}
