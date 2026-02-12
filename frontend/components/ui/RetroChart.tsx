interface RetroChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}

/** Simple SVG line chart with retro styling */
export function RetroChart({ data, color = "#836EF9", height = 150 }: RetroChartProps) {
  if (data.length < 2) return null;

  const width = 600;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.value - min) / range) * chartH;
    return `${x},${y}`;
  });

  return (
    <div className="w-full rounded border border-monad-purple/15 bg-monad-deeper p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + chartH * (1 - t);
          const val = Math.round(min + range * t);
          return (
            <g key={t}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#6B649422" strokeDasharray="4" />
              <text x={padding.left - 4} y={y + 3} textAnchor="end" fill="#6B6494" fontSize="9" fontFamily="monospace">{val}</text>
            </g>
          );
        })}
        {/* Line */}
        <polyline fill="none" stroke={color} strokeWidth="2" points={points.join(" ")} />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padding.left + (i / (data.length - 1)) * chartW;
          const y = padding.top + chartH - ((d.value - min) / range) * chartH;
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
    </div>
  );
}

interface RetroSparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

/** Minimal sparkline — just a line, no axes */
export function RetroSparkline({ data, color = "#39FF14", width = 120, height = 30 }: RetroSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}
