"use client";
import { useId, useMemo, useState } from "react";
import { smoothPath } from "@/lib/chart";
import { compactUsd, usd } from "@/lib/format";
import type { CurvePoint, RangeKey } from "@/types/trading";

const W = 720, H = 228, PAD = 12;

function label(t: string, range: RangeKey) {
  if (range === "1D") return t.slice(11, 16);
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function EquityChart({ points, range }: { points: CurvePoint[]; range: RangeKey }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;

  const geo = useMemo(() => {
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const x = (i: number) => (i / (n - 1)) * W;
    const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
    return {
      x, y,
      line: points.map((p, i) => [x(i), y(p.value)] as [number, number]),
      ticks: [0, 1, 2, 3].map((k) => max - (span * k) / 3),
    };
  }, [points, n]);

  if (n < 2) return null;
  const idx = hover ?? n - 1;
  const p = points[idx];
  const up = points[n - 1].value >= points[0].value;
  const line = smoothPath(geo.line);
  const cx = geo.x(idx);
  const leftPct = (cx / W) * 100;
  const dots = [0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4));

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-[120px] flex-col justify-between text-right text-[13px] text-content-muted tabular-nums min-[761px]:h-[140px] min-[761px]:text-[14px]">
          {geo.ticks.map((t) => <span key={t}>{compactUsd(t)}</span>)}
        </div>

        <div
          className="relative h-[120px] min-w-0 flex-1 min-[761px]:h-[140px]"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setHover(Math.round(ratio * (n - 1)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" role="img"
            aria-label={`Equity curve, ${usd(points[0].value)} to ${usd(points[n - 1].value)}`}>
            <defs>
              <pattern id={`h${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M1 0V4" strokeOpacity=".3" className={up ? "stroke-success" : "stroke-danger"} />
              </pattern>
            </defs>
            <path d={`M0 0H${W}M0 ${H / 3}H${W}M0 ${(H / 3) * 2}H${W}M0 ${H - 1}H${W}`}
              className="stroke-elevated" strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
            <path d={`${line}L${W} ${H}L0 ${H}Z`} fill={`url(#h${uid})`} />
            <path d={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke"
              className={up ? "stroke-success" : "stroke-danger"} />
            <path d={`M${cx} 0V${H}`} strokeDasharray="3 4" className="stroke-content-muted"
              vectorEffect="non-scaling-stroke" />
          </svg>

          <span className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-base ${up ? "border-success" : "border-danger"}`}
            style={{ left: `${leftPct}%`, top: `${(geo.y(p.value) / H) * 100}%` }} />

          <div className="pointer-events-none absolute top-0 flex gap-2 whitespace-nowrap"
            style={{ left: `${leftPct}%`, transform: leftPct > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-elevated px-3 py-0.5 text-[17px] text-opposite tabular-nums">
              <i className={`size-1.5 rounded-full ${up ? "bg-success" : "bg-danger"}`} />{usd(p.value)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-between pl-[42px] text-[13px] text-content-muted min-[761px]:pl-[48px] min-[761px]:text-[14px]">
        {dots.map((i) => <span key={i}>{label(points[i].t, range)}</span>)}
      </div>
    </div>
  );
}