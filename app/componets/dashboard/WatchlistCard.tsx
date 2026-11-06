import { LuArrowUpRight } from "react-icons/lu";
import { dec2, signedPct, toneText } from "@/lib/format";
import type { Quote, WatchItem } from "@/types/trading";
import { OPEN_WATCHLIST_EVENT } from "@/lib/client/watchlist-storage";
import { Card, CardEmpty, CardError, IconButton, SkeletonRows } from "./Card";

export interface WatchRow extends WatchItem { quote: Quote | null }

interface Props { rows: WatchRow[]; loading: boolean; error: string | null; onRetry: () => void; className?: string }

export function WatchlistCard({ rows, loading, error, onRetry, className }: Props) {
  return (
    <Card title="Watchlist movers" className={className}
      action={<IconButton label="Open watchlist" onClick={() => window.dispatchEvent(new Event(OPEN_WATCHLIST_EVENT))}><LuArrowUpRight /></IconButton>}>
      {error && !rows.length ? (
        <CardError message={error} onRetry={onRetry} />
      ) : loading ? (
        <SkeletonRows rows={5} height="h-[50px] min-[761px]:h-[60px]" />
      ) : !rows.length ? (
        <CardEmpty title="Nothing on your watchlist" text="Add symbols to track their moves here." />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-5">
          {rows.map((r, i) => (
            <div key={r.symbol}
              className={`grid h-12.5 grid-cols-[30px_1fr_auto_64px] items-center gap-3 rounded-xl border px-3 text-ui-sm transition-colors hover:bg-elevated min-[761px]:h-[60px] min-[761px]:grid-cols-[36px_1fr_auto_76px] min-[761px]:gap-4 min-[761px]:px-4 ${i === 0 ? "border-elevated bg-elevated" : "border-elevated"}`}>
              <span className="flex size-7.5 items-center justify-center rounded-lg bg-elevated text-[11px] font-semibold text-opposite min-[761px]:size-9 min-[761px]:text-[13px]">{r.symbol.slice(0, 2)}</span>
              <span className="min-w-0">
                <b className="block text-opposite">{r.symbol}</b>
                <span className="block truncate text-[11px] text-content-muted min-[761px]:text-ui-sm">{r.name}</span>
              </span>
              <span className="text-right tabular-nums text-opposite">{r.quote ? dec2(r.quote.price) : "—"}</span>
              <span className={`text-right tabular-nums ${r.quote ? toneText(r.quote.changePct) : "text-content-muted"}`}>{r.quote ? signedPct(r.quote.changePct) : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}