import { dec2, signedPct, toneText } from "@/lib/format";
import type { Quote, WatchItem } from "@/types/trading";
import { OPEN_WATCHLIST_EVENT } from "@/lib/client/watchlist-storage";
import { Sparkline } from "./Sparkline";

export interface WatchRow extends WatchItem { quote: Quote | null; spark: number[] }

interface Props { rows: WatchRow[]; loading: boolean; error: string | null; onRetry: () => void; className?: string }

export function WatchlistCard({ rows, loading, error, onRetry, className }: Props) {
  return (
    <section className={className}>
      <header className="flex items-center justify-between border-b border-elevated px-4 py-3">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-content-muted">
          Biggest movers
        </h2>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_WATCHLIST_EVENT))}
          className="text-[12px] text-content-muted hover:text-content"
        >
          Watchlist →
        </button>
      </header>
      {error && !rows.length ? (
        <div className="px-4 py-5 text-[13px] text-danger" role="alert">
          {error}
          <button type="button" onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-elevated" />
          ))}
        </div>
      ) : !rows.length ? (
        <p className="px-4 py-5 text-[13px] text-content-muted">
          Nothing on your watchlist yet.
        </p>
      ) : (
        <div>
          {rows.slice(0, 5).map((row) => (
            <div
              key={row.symbol}
              className="grid min-h-[47px] grid-cols-[minmax(58px,1fr)_48px_52px_48px] items-center gap-2 border-b border-elevated/80 px-4 py-1.5 last:border-0"
            >
              <span className="min-w-0">
                <b className="block text-[13px] font-medium text-opposite">
                  {row.symbol}
                </b>
                <span className="block truncate text-[12px] text-content-muted">
                  {row.name}
                </span>
              </span>
              <Sparkline
                values={row.spark.slice(-10)}
                up={(row.quote?.changePct ?? 0) >= 0}
              />
              <span className="text-right text-[13px] tabular-nums text-opposite">
                {row.quote ? dec2(row.quote.price) : "—"}
              </span>
              <span
                className={`text-right text-[13px] tabular-nums ${row.quote ? toneText(row.quote.changePct) : "text-content-muted"}`}
              >
                {row.quote ? signedPct(row.quote.changePct) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}