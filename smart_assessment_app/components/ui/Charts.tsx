import { cn } from '@/lib/utils';

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  max?: number;
  height?: number;
  showValues?: boolean;
  horizontal?: boolean;
  unit?: string;
}

export function BarChart({ data, max, height = 200, showValues = false, horizontal = false, unit = '%' }: BarChartProps) {
  const maxValue = max || Math.max(...data.map(d => d.value), 100);

  if (horizontal) {
    return (
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-600 truncate pr-2">{d.label}</span>
              <span className="text-xs font-semibold text-slate-900 tabular-nums">
                {d.value}{unit}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all duration-700 ease-out', d.color || 'bg-brand-500')}
                style={{ width: `${(d.value / maxValue) * 100}%`, animationDelay: `${i * 50}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          {showValues && (
            <span className="text-xs font-semibold text-slate-700 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value}{unit}
            </span>
          )}
          <div className="w-full flex-1 flex items-end">
            <div
              className={cn('w-full rounded-t-md transition-all duration-700 ease-out', d.color || 'bg-brand-500')}
              style={{
                height: `${(d.value / maxValue) * 100}%`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          </div>
          <span className="text-2xs font-medium text-slate-500 text-center leading-tight truncate w-full">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface DonutChartProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ segments, size = 160, thickness = 20, centerLabel, centerValue }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-slate-100" />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circumference;
          const circle = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          );
          offset += dash;
          return circle;
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-2xl font-bold text-slate-900 tabular-nums">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-slate-500 mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showArea?: boolean;
  unit?: string;
}

export function LineChart({ data, height = 180, color = '#0d9488', showDots = true, showArea = true, unit = '' }: LineChartProps) {
  const width = 400;
  const padding = { top: 20, right: 20, bottom: 30, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...data.map(d => d.value), 100);
  const min = 0;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((d.value - min) / (max - min)) * chartHeight,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(tick => (
        <line
          key={tick}
          x1={padding.left}
          y1={padding.top + (chartHeight * tick) / 100}
          x2={width - padding.right}
          y2={padding.top + (chartHeight * tick) / 100}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}
      {showArea && <path d={areaD} fill="url(#lineGradient)" />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" className="transition-all hover:r-5" />
      ))}
      {points.map((p, i) => (
        <text key={i} x={p.x} y={height - 8} textAnchor="middle" className="fill-slate-400 text-2xs font-medium">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

interface RadialGaugeProps {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  color?: string;
}

export function RadialGauge({ value, max = 100, size = 120, label, color = '#0d9488' }: RadialGaugeProps) {
  const pct = Math.min(1, value / max);
  const radius = size / 2 - 10;
  const circumference = Math.PI * radius;
  const dash = pct * circumference;

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <span className="text-xl font-bold text-slate-900 tabular-nums">{Math.round(value)}%</span>
        {label && <p className="text-2xs text-slate-500 mt-0.5">{label}</p>}
      </div>
    </div>
  );
}
