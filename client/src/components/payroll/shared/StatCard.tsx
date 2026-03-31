import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type StatCardColor = "green" | "blue" | "red" | "orange" | "pink" | "grey" | "purple";

interface TrendProps {
  value: number;    // positive = up, negative = down
  label?: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: StatCardColor;
  trend?: TrendProps;
  sub?: ReactNode;
}

const COLOR_MAP: Record<StatCardColor, { bg: string; fg: string }> = {
  green:  { bg: "#e8f5e9", fg: "#4CAF50" },
  blue:   { bg: "#e3f2fd", fg: "#2196F3" },
  red:    { bg: "#ffebee", fg: "#F44336" },
  orange: { bg: "#fff3e0", fg: "#FF9800" },
  pink:   { bg: "#fce4ec", fg: "#E91E63" },
  grey:   { bg: "#f5f5f5", fg: "#757575" },
  purple: { bg: "#f3e5f5", fg: "#9C27B0" },
};

export function StatCard({
  title, value, icon, color = "grey", trend, sub,
}: StatCardProps) {
  const { bg, fg } = COLOR_MAP[color];
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: bg, color: fg }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
          {trend && (
            <div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: trend.value >= 0 ? "#4CAF50" : "#F44336" }}
            >
              {trend.value >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              <span>{Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}</span>
            </div>
          )}
          {sub && <div>{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
