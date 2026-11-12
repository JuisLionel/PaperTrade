"use client";
import { useState } from "react";
import { LuNewspaper } from "react-icons/lu";
import { timeAgo } from "@/lib/format";
import type { NewsItem } from "@/types/trading";

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(!src);
  return (
    <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-elevated">
      {bad ? (
        <LuNewspaper className="size-4 text-content-muted" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="size-full object-cover" />
      )}
    </div>
  );
}

interface Props { news: NewsItem[]; loading: boolean; error: string | null; onRetry: () => void; className?: string }

export function NewsCard({ news, loading, error, onRetry, className }: Props) {
  return (
    <section className={`flex min-h-0 flex-col ${className ?? ""}`}>
      <header className="flex shrink-0 items-center justify-between border-y border-elevated px-4 py-3">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-content-muted">
          Market news
        </h2>
        <a href="/news" className="text-[12px] text-content-muted hover:text-content">
          View all →
        </a>
      </header>
      {error && !news.length ? (
        <div className="flex flex-1 items-start px-4 py-5 text-[13px] text-danger" role="alert">
          {error}
          <button type="button" onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-1 flex-col justify-around space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="min-h-14 flex-1 animate-pulse rounded bg-elevated" />
          ))}
        </div>
      ) : !news.length ? (
        <p className="flex-1 px-4 py-5 text-[13px] text-content-muted">
          No headlines right now.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {news.slice(0, 4).map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer"
              className="flex min-h-[62px] flex-1 items-center gap-2.5 border-b border-elevated/80 px-4 py-2.5 text-opposite transition-colors hover:bg-elevated/60 last:border-0">
              <Thumb src={item.image} />
              <span className="flex min-w-0 flex-col justify-center gap-1">
                <span className="line-clamp-2 text-[13px] leading-snug">{item.headline}</span>
                <span className="text-[12px] text-content-muted">{item.source} · {timeAgo(item.datetime)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}