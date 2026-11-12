"use client";

import { useState } from "react";
import { LuNewspaper } from "react-icons/lu";
import Pagination from "@/app/componets/Pagination";
import { timeAgo } from "@/lib/format";
import type { NewsItem } from "@/types/trading";
import { getNewsSentiment, getNewsTopic } from "../news-utils";

interface NewsStoriesProps {
  error: string | null;
  loading: boolean;
  featured?: NewsItem;
  latestStories: NewsItem[];
  stories: NewsItem[];
  page: number;
  pageCount: number;
  onRetry: () => void;
  hrefForPage: (page: number) => string;
}

function SentimentBadge({ headline }: { headline: string }) {
  const sentiment = getNewsSentiment(headline);
  const color =
    sentiment === "Positive"
      ? "bg-success/15 text-success"
      : sentiment === "Negative"
        ? "bg-danger/15 text-danger"
        : "bg-elevated text-content-secondary";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}
    >
      {sentiment}
    </span>
  );
}

function NewsImage({
  src,
  className = "aspect-video",
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden border border-elevated bg-base ${className}`}
    >
      {failed ? (
        <LuNewspaper className="size-8 text-content-muted" aria-hidden />
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

function NewsLoadingState() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 11 }, (_, index) => (
        <div
          key={index}
          className="flex animate-pulse gap-3 rounded-lg border border-elevated bg-surface p-3 sm:items-center sm:gap-4"
        >
          <div className="size-18 shrink-0 rounded-md bg-elevated sm:size-21" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-1/3 rounded bg-elevated" />
            <div className="h-4 rounded bg-elevated" />
            <div className="h-3 w-1/4 rounded bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeaturedStory({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="card group relative min-h-64 overflow-hidden bg-surface transition-colors sm:min-h-95"
    >
      <NewsImage
        src={item.image}
        className="absolute inset-0 h-full w-full rounded-none border-0"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/25 to-transparent" />
      <div className="relative mt-auto p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-sm border-0 bg-content font-medium text-base">
            {getNewsTopic(item.headline)}
          </span>
          <SentimentBadge headline={item.headline} />
        </div>
        <h2 className="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
          {item.headline}
        </h2>
        <p className="mt-3 text-[11px] text-white/70">
          Featured story <span className="px-1">·</span> {item.source}{" "}
          <span className="px-1">·</span> {timeAgo(item.datetime)}
        </p>
      </div>
    </a>
  );
}

function LatestStories({ items }: { items: NewsItem[] }) {
  return (
    <section aria-labelledby="latest-news-heading">
      <h2
        id="latest-news-heading"
        className="mb-3 font-display text-ui-lg font-semibold text-opposite"
      >
        Latest stories
      </h2>
      <div>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface/60 sm:gap-3"
          >
            <NewsImage src={item.image} className="size-17 shrink-0 rounded-md" />
            <div className="min-w-0 py-1">
              <div className="flex flex-wrap items-center gap-2">
                <SentimentBadge headline={item.headline} />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-content">
                  {getNewsTopic(item.headline)}
                </p>
              </div>
              <h3 className="mt-1 line-clamp-2 text-ui-sm font-medium leading-snug text-opposite">
                {item.headline}
              </h3>
              <p className="mt-2 truncate text-[12px] text-content-muted">
                {item.source} · {timeAgo(item.datetime)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function MoreStories({ items }: { items: NewsItem[] }) {
  return (
    <section
      className="mt-5 border-t border-elevated pt-4 sm:mt-6 sm:pt-5"
      aria-labelledby="more-news-heading"
    >
      <h2
        id="more-news-heading"
        className="mb-4 font-display text-ui-lg font-semibold text-opposite"
      >
        More market news
      </h2>
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="card overflow-hidden border border-elevated bg-surface transition-colors hover:border-content/40"
            >
              <NewsImage
                src={item.image}
                className="aspect-video w-full rounded-none border-0"
              />
              <div className="card-body flex flex-1 flex-col gap-0 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase text-content">
                    {getNewsTopic(item.headline)}
                  </p>
                  <SentimentBadge headline={item.headline} />
                </div>
                <h3 className="mt-2 line-clamp-3 text-ui-base font-semibold leading-snug text-opposite">
                  {item.headline}
                </h3>
                <p className="mt-auto pt-3 text-[11px] text-content-muted">
                  {item.source} · {timeAgo(item.datetime)}
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="rounded-lg px-5 py-10 text-center text-ui-sm text-content-muted">
          No stories match these filters. Try changing your categories or search.
        </p>
      )}
    </section>
  );
}

export default function NewsStories({
  error,
  loading,
  featured,
  latestStories,
  stories,
  page,
  pageCount,
  onRetry,
  hrefForPage,
}: NewsStoriesProps) {
  if (error && !featured) {
    return (
      <div
        className="rounded-lg border border-elevated bg-surface p-8 text-center"
        role="alert"
      >
        <p className="text-ui-base text-danger">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-elevated px-4 py-2 text-ui-sm text-opposite hover:bg-elevated/70"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) return <NewsLoadingState />;

  if (!featured && !latestStories.length && !stories.length) {
    return (
      <div className="rounded-lg border border-dashed border-elevated px-5 py-16 text-center">
        <p className="text-ui-base font-medium text-opposite">No stories available</p>
        <p className="mt-2 text-ui-sm text-content-muted">
          Check back later for the latest market news.
        </p>
      </div>
    );
  }

  return (
    <>
      {(featured || latestStories.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
          {featured && <FeaturedStory item={featured} />}
          {latestStories.length > 0 && <LatestStories items={latestStories} />}
        </div>
      )}

      <MoreStories items={stories} />

      {pageCount > 1 && (
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={pageCount}
            hrefForPage={hrefForPage}
          />
        </div>
      )}
    </>
  );
}
