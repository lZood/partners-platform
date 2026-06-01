"use client";

import { GridFour, List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "grid";

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-card p-0.5 shadow-sm",
        className
      )}
      role="group"
      aria-label="Cambiar vista"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
          value === "list"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-label="Vista de lista"
        aria-pressed={value === "list"}
        title="Lista"
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
          value === "grid"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        aria-label="Vista de cuadrícula"
        aria-pressed={value === "grid"}
        title="Tarjetas"
      >
        <GridFour className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
