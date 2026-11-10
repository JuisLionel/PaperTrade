type SparklineProps = {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
  fluid?: boolean; // stretch to fill the parent's width
};

export default function Sparkline({
  data,
  positive,
  width = 80,
  height = 24,
  fluid = false,
}: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : undefined}
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--color-success)" : "var(--color-danger)"}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}