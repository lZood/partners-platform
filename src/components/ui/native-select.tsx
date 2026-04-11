import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: "default" | "compact";
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "w-full appearance-none rounded-lg border border-input bg-card text-sm text-foreground shadow-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "pr-8",
            variant === "default" && "h-10 px-3 py-2",
            variant === "compact" && "h-8 px-2 py-1 text-xs",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
            variant === "default" ? "h-4 w-4" : "h-3 w-3"
          )}
        />
      </div>
    );
  }
);

NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
