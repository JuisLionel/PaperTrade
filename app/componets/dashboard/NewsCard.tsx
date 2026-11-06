"use client";
import { useState } from "react";
import { LuArrowRight, LuNewspaper } from "react-icons/lu";
import { timeAgo } from "@/lib/format";
import type { NewsItem } from "@/types/trading";
import { Card, CardEmpty, CardError, DashboardButton, SkeletonRows } from "./Card";

function Thumb({ src }: { src: string }) {
  const [bad, setBad] = useState(!src);
  return (
    <div className="flex h-21 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-elevated bg-elevated min-[761px]:h-25.25 min-[761px]:w-33.5">
      {bad ? (
        <LuNewspaper className="size-8 text-content-muted min-[761px]:size-10" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="size-full object-contain" />
      )}
    </div>
  );
}

interface Props { news: NewsItem[]; loading: boolean; error: string | null; onRetry: () => void; className?: string }

export function NewsCard({ news, loading, error, onRetry, className }: Props) {
  return (
    <Card
      title="Market news"
      className={className}
      action={
        <DashboardButton href="/news">
          View all <LuArrowRight aria-hidden />
        </DashboardButton>
      }
    >
      {error && !news.length ? (
        <CardError message={error} onRetry={onRetry} />
      ) : loading ? (
        <SkeletonRows rows={2} height="h-24" />
      ) : !news.length ? (
        <CardEmpty title="No headlines" text="Check back in a few minutes." />
      ) : (
        <div className="grid gap-x-2 px-3 pb-4 sm:grid-cols-2">
          {news.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer"
              className="flex gap-4 rounded-[10px] p-3 text-opposite transition-colors hover:bg-elevated">
              <Thumb src={n.image} />
              <span className="flex min-w-0 flex-col justify-center gap-2 text-ui-sm leading-snug min-[761px]:gap-3">
                <span className="line-clamp-3">{n.headline}</span>
                <span className="text-[12px] text-content-muted min-[761px]:text-ui-base">{n.source} · {timeAgo(n.datetime)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}