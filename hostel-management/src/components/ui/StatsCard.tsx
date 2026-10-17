import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  iconColor?: string;
  iconBg?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  iconColor = 'text-primary-600',
  iconBg = 'bg-primary-50',
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs transition-all duration-150 hover:border-gray-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 tracking-tight mt-1.5 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend && (
            <p
              className={`text-xs font-medium mt-1.5 ${
                trend.positive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl border border-gray-100 flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
