type IndexChartProps = { data: number[]; positive: boolean };

export default function IndexChart({ data, positive }: IndexChartProps) {
  const W = 600;
  const H = 220;
  const pad = 8;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const line = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive ? "var(--color-success)" : "var(--color-danger)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="Index price chart"
    >
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={0}
          x2={W}
          y1={H * p}
          y2={H * p}
          stroke="var(--color-elevated)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={color} fillOpacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}