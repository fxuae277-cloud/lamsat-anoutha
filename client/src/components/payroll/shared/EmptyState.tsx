import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

interface EmptyStateProps {
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  message = "لا توجد نتائج مطابقة",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="text-muted-foreground/40">
        {icon ?? <SearchX className="h-10 w-10" />}
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
