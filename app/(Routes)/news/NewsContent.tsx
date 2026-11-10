"use client";

import { useEffect, useMemo, useState } from "react";
import { LuNewspaper, LuRefreshCw, LuSearch } from "react-icons/lu";
import { useResource } from "@/app/Hooks/useResource";
import { useAccount } from "@/app/Hooks/useAccount";
import { timeAgo } from "@/lib/format";
import { fetchNewsFeed } from "@/lib/api/dashboard";
import type { NewsItem } from "@/types/trading";

const TOPICS = ["Earnings", "Economy", "Tech", "Energy", "Crypto", "Finance"] as const;
const SENTIMENTS = ["Positive", "Neutral", "Negative"] as const;
const PERIODS = ["Today", "Week", "Month", "Year", "All"] as const;
const PERIOD_SECONDS: Record<(typeof PERIODS)[number], number | null> = {
  Today: 24 * 60 * 60,
  Week: 7 * 24 * 60 * 60,
  Month: 30 * 24 * 60 * 60,
  Year: 365 * 24 * 60 * 60,
  All: null,
};
type Topic = (typeof TOPICS)[number];
type Sentiment = (typeof SENTIMENTS)[number];

const TOPIC_TERMS: Record<Topic, string[]> = {
  Earnings: ["earnings", "revenue", "profit", "quarter", "guidance", "eps"],
  Economy: ["economy", "inflation", "fed ", "rates", "jobs", "gdp", "tariff"],
  Tech: ["technology", "tech ", " ai ", "chip", "software", "semiconductor"],
  Energy: ["energy", "oil", "gas prices", "opec", "renewable"],
  Crypto: ["crypto", "bitcoin", "ethereum", "blockchain"],
  Finance: ["bank", "finance", "financial", "stock", "shares", "investor", "market"],
};

const POSITIVE_TERMS = ["surge", "soar", "gain", "growth", "record", "beats", "upgrade", "rally", "profit"];
const NEGATIVE_TERMS = ["fall", "drop", "cuts", "cut ", "loss", "miss", "decline", "warning", "plunge", "bankruptcy"];

function getTopic(headline: string): Topic {
  const text = ` ${headline.toLowerCase()} `;
  return TOPICS.find((topic) => TOPIC_TERMS[topic].some((term) => text.includes(term))) ?? "Finance";
}

function getSentiment(headline: string): Sentiment {
  const text = headline.toLowerCase();
  const positive = POSITIVE_TERMS.filter((term) => text.includes(term)).length;
  const negative = NEGATIVE_TERMS.filter((term) => text.includes(term)).length;
  return positive > negative ? "Positive" : negative > positive ? "Negative" : "Neutral";
}

function NewsImage({ src, featured = false }: { src: string; featured?: boolean }) {
  const [failed, setFailed] = useState(!src);
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-lg border border-elevated bg-base ${featured ? "h-40 sm:h-full" : "aspect-[16/9]"}`}>
      {failed ? (
        <LuNewspaper className="size-8 text-content-muted" aria-hidden />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      )}
    </div>
  );
}

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-ui-sm text-content-secondary hover:text-opposite">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-content"
      />
      {label}
    </label>
  );
}

function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function StoryTags({ item }: { item: NewsItem }) {
  const topic = getTopic(item.headline);
  const sentiment = getSentiment(item.headline);
  const sentimentTone = sentiment === "Positive"
    ? "text-success"
    : sentiment === "Negative"
      ? "text-danger"
      : "text-content-muted";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded bg-elevated px-2 py-1 text-content-secondary">{topic}</span>
      <span className={`rounded bg-elevated px-2 py-1 ${sentimentTone}`}>{sentiment}</span>
    </div>
  );
}

export default function NewsContent() {
  const account = useAccount();
  const news = useResource(fetchNewsFeed, "news-feed", { refreshMs: 120_000 });
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState(["Watchlist", "Holdings", "All"]);
  const [topics, setTopics] = useState<string[]>([...TOPICS]);
  const [sentiments, setSentiments] = useState<string[]>([...SENTIMENTS]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now() / 1000), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const watchSymbols = useMemo(
    () => account?.watchlist.map((item) => item.symbol.toUpperCase()) ?? [],
    [account?.watchlist],
  );
  const holdingSymbols = useMemo(
    () => account?.positions.map((item) => item.symbol.toUpperCase()) ?? [],
    [account?.positions],
  );

  const filtered = useMemo(() => {
    if (now === null) return [];
    const duration = PERIOD_SECONDS[period];
    const cutoff = duration === null ? null : now - duration;
    const normalizedQuery = query.trim().toLowerCase();

    return (news.data ?? []).filter((item) => {
      if (cutoff !== null && item.datetime < cutoff) return false;
      if (normalizedQuery && !`${item.headline} ${item.source}`.toLowerCase().includes(normalizedQuery)) return false;

      const headline = item.headline.toUpperCase();
      const mentions = (symbol: string) => new RegExp(`(^|[^A-Z0-9])${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`).test(headline);
      const isWatchlist = watchSymbols.some(mentions);
      const isHolding = holdingSymbols.some(mentions);
      const isPersonal = isWatchlist || isHolding;
      const sourceMatches =
        (isWatchlist && sources.includes("Watchlist")) ||
        (isHolding && sources.includes("Holdings")) ||
        (!isPersonal && sources.includes("All"));

      return sourceMatches &&
        topics.includes(getTopic(item.headline)) &&
        sentiments.includes(getSentiment(item.headline));
    });
  }, [holdingSymbols, news.data, now, period, query, sentiments, sources, topics, watchSymbols]);

  const featured = filtered[0];
  const pageSize = 9;
  const storiesTotal = Math.max(0, filtered.length - 1);
  const pageCount = Math.max(1, Math.ceil(storiesTotal / pageSize));
  const pageStart = (page - 1) * pageSize;
  const stories = filtered.slice(pageStart + 1, pageStart + pageSize + 1);

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-1 bg-base px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid w-full flex-1 gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="self-start lg:sticky lg:top-5">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="font-display text-ui-xl font-bold text-opposite">News</h1>
            <button
              type="button"
              onClick={news.reload}
              aria-label="Refresh news"
              className="rounded-md p-2 text-content-muted hover:bg-elevated hover:text-opposite"
            >
              <LuRefreshCw className="size-4" />
            </button>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-md border border-elevated bg-surface px-3 text-content-muted focus-within:border-content">
            <LuSearch className="size-4 shrink-0" aria-hidden />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-ui-sm text-opposite outline-none placeholder:text-content-muted"
            />
          </label>

          <div className="mt-6">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Show</h2>
            {["Watchlist", "Holdings", "All"].map((item) => (
              <FilterCheckbox key={item} label={item === "Watchlist" ? "My watchlist" : item === "Holdings" ? "My holdings" : item}
                checked={sources.includes(item)} onChange={() => {
                  setSources((current) => toggle(current, item));
                  setPage(1);
                }} />
            ))}
          </div>

          <div className="mt-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Topic</h2>
            {TOPICS.map((topic) => (
              <FilterCheckbox key={topic} label={topic} checked={topics.includes(topic)}
                onChange={() => {
                  setTopics((current) => toggle(current, topic));
                  setPage(1);
                }} />
            ))}
          </div>

          <div className="mt-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Sentiment</h2>
            {SENTIMENTS.map((sentiment) => (
              <FilterCheckbox key={sentiment} label={sentiment} checked={sentiments.includes(sentiment)}
                onChange={() => {
                  setSentiments((current) => toggle(current, sentiment));
                  setPage(1);
                }} />
            ))}
          </div>

          <div className="mt-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Time</h2>
            <div className="flex gap-2">
              {PERIODS.map((value) => (
                <button key={value} type="button" onClick={() => {
                  setPeriod(value);
                  setPage(1);
                }}
                  aria-pressed={period === value}
                  className={`rounded-full border px-3 py-1.5 text-ui-sm transition-colors ${period === value ? "border-content bg-content font-medium text-base" : "border-elevated text-content-secondary hover:text-opposite"}`}>
                  {value}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {news.error && !news.data ? (
            <div className="rounded-lg border border-elevated bg-surface p-8 text-center" role="alert">
              <p className="text-ui-base text-danger">{news.error}</p>
              <button type="button" onClick={news.reload} className="mt-4 rounded-md bg-elevated px-4 py-2 text-ui-sm text-opposite hover:bg-elevated/70">
                Try again
              </button>
            </div>
          ) : (now === null || (news.loading && !news.data)) ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className={`animate-pulse rounded-lg border border-elevated bg-surface p-3 ${index === 0 ? "sm:col-span-2" : ""}`}>
                  <div className="h-36 rounded-md bg-elevated" />
                  <div className="mt-4 h-3 w-1/3 rounded bg-elevated" />
                  <div className="mt-3 h-5 rounded bg-elevated" />
                  <div className="mt-2 h-5 w-2/3 rounded bg-elevated" />
                </div>
              ))}
            </div>
          ) : !featured ? (
            <div className="rounded-lg border border-dashed border-elevated px-5 py-16 text-center">
              <p className="text-ui-base font-medium text-opposite">No matching stories</p>
              <p className="mt-2 text-ui-sm text-content-muted">Try changing your filters or search terms.</p>
            </div>
          ) : (
            <>
              <a href={featured.url} target="_blank" rel="noreferrer"
                className="grid gap-4 rounded-xl border border-elevated bg-surface p-3 transition-colors hover:border-content/40 sm:grid-cols-2 sm:items-center sm:p-4">
                <NewsImage src={featured.image} featured />
                <div className="min-w-0 px-1 py-2 sm:px-3">
                  <p className="text-[11px] text-content-muted">
                    <span className="font-semibold uppercase text-content">Top story</span>
                    <span> · {featured.source} · {timeAgo(featured.datetime)}</span>
                  </p>
                  <h2 className="mt-3 text-ui-lg font-semibold leading-snug text-opposite sm:text-[22px]">
                    {featured.headline}
                  </h2>
                  <StoryTags item={featured} />
                </div>
              </a>

              {stories.length > 0 && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {stories.map((item) => (
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer"
                      className="rounded-xl border border-elevated bg-surface p-3 transition-colors hover:border-content/40">
                      <NewsImage src={item.image} />
                      <p className="mt-3 text-[11px] text-content-muted">
                        <span className="font-semibold uppercase text-content">{getTopic(item.headline)}</span>
                        <span> · {item.source} · {timeAgo(item.datetime)}</span>
                      </p>
                      <h2 className="mt-1.5 line-clamp-3 text-ui-base font-semibold leading-snug text-opposite">
                        {item.headline}
                      </h2>
                      <StoryTags item={item} />
                    </a>
                  ))}
                </div>
              )}

              {pageCount > 1 && (
                <nav aria-label="News pages" className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-elevated pt-4">
                  <p className="text-ui-sm text-content-muted">
                    Showing {pageStart + 1}–{Math.min(pageStart + pageSize, storiesTotal)} of {storiesTotal} stories
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1} aria-label="Previous page"
                      className="rounded-md border border-elevated px-3 py-2 text-ui-sm text-content-secondary hover:text-opposite disabled:cursor-not-allowed disabled:opacity-40">
                      Previous
                    </button>
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                      <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)}
                        aria-label={`Page ${pageNumber}`} aria-current={page === pageNumber ? "page" : undefined}
                        className={`size-9 rounded-md border text-ui-sm ${page === pageNumber ? "border-content bg-content font-medium text-base" : "border-elevated text-content-secondary hover:text-opposite"}`}>
                        {pageNumber}
                      </button>
                    ))}
                    <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={page === pageCount} aria-label="Next page"
                      className="rounded-md border border-elevated px-3 py-2 text-ui-sm text-content-secondary hover:text-opposite disabled:cursor-not-allowed disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
