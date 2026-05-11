import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  iconColor?: string;
  iconBg?: string;
}

export function StatCard({ label, value, icon: Icon, trend, iconColor = "text-primary", iconBg = "bg-primary/10" }: StatCardProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon size={18} className={iconColor} />
        </div>
        {trend && (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground mb-0.5">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
