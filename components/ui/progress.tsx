import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  points?: number; // 0..100
  complete?: boolean; // render success (green) fill when done
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, points = 0, complete = false, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, points));
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-osrs-black/50",
          className,
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-150",
            complete ? "bg-osrs-green" : "bg-osrs-gold",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
