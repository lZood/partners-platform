"use client";

import { useState } from "react";
import { PlayCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  OnboardingDialog,
  type OnboardingRole,
} from "@/components/onboarding/onboarding-dialog";
import { markOnboardingCompleted } from "@/components/onboarding/onboarding-trigger";

interface OnboardingReplayButtonProps {
  userId: string;
  role: OnboardingRole;
  userName?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function OnboardingReplayButton({
  userId,
  role,
  userName,
  variant = "outline",
  size = "sm",
  className,
}: OnboardingReplayButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <PlayCircle weight="duotone" className="h-4 w-4 mr-1.5" />
        Volver a ver el tour
      </Button>
      <OnboardingDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && userId) markOnboardingCompleted(userId);
        }}
        role={role}
        userName={userName}
        onFinish={() => {
          if (userId) markOnboardingCompleted(userId);
        }}
      />
    </>
  );
}
