export function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return <span className="text-content-muted">–</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * 64).toFixed(1)},${(21 - ((v - min) / span) * 20).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
        className={up ? "stroke-success" : "stroke-danger"} />
    </svg>
  );
}