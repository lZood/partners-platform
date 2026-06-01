"use client";

import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/shared/view-toggle";

export function useViewMode(
  key: string,
  defaultMode: ViewMode = "list"
): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`view-mode:${key}`);
      if (saved === "list" || saved === "grid") setMode(saved);
    } catch {}
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(`view-mode:${key}`, mode);
    } catch {}
  }, [mode, loaded, key]);

  return [mode, setMode];
}
