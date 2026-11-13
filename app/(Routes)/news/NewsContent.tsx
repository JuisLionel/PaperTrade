"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useResource } from "@/app/Hooks/useResource";
import { useAccount } from "@/app/Hooks/useAccount";
import { fetchNewsFeed } from "@/lib/api/dashboard";
import NewsFilters from "./components/NewsFilters";
import NewsStories from "./components/NewsStories";
import {
  NEWS_PERIOD_SECONDS,
  NEWS_SENTIMENTS,
  NEWS_SOURCES,
  NEWS_TOPICS,
  getNewsSentiment,
  getNewsTopic,
  toggleSelection,
  type NewsPeriod,
  type NewsSentiment,
  type NewsSource,
  type NewsTopic,
} from "./news-utils";

export default function NewsContent() {
  const { account, error: accountError, refresh: refreshAccount } = useAccount();
  const news = useResource(fetchNewsFeed, "news-feed", { refreshMs: 120_000 });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [now, setNow] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<NewsSource[]>([...NEWS_SOURCES]);
  const [topics, setTopics] = useState<NewsTopic[]>([...NEWS_TOPICS]);
  const [sentiments, setSentiments] = useState<NewsSentiment[]>([
    ...NEWS_SENTIMENTS,
  ]);
  const [period, setPeriod] = useState<NewsPeriod>("Week");
  const requestedPage = Number(searchParams.get("page"));
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const resetPage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const queryString = params.toString();
    router.replace(
      queryString ? `${pathname}?${queryString}` : pathname,
      { scroll: false },
    );
  };

  const hrefForPage = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target === 1) params.delete("page");
    else params.set("page", String(target));
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

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

  const latestNews = useMemo(
    () =>
      [...(news.data ?? [])].sort((a, b) => b.datetime - a.datetime),
    [news.data],
  );

  const filtered = useMemo(() => {
    if (now === null) return [];
    const cutoff = now - NEWS_PERIOD_SECONDS[period];
    const normalizedQuery = query.trim().toLowerCase();

    return (news.data ?? []).filter((item) => {
      if (item.datetime < cutoff) return false;
      if (
        normalizedQuery &&
        !`${item.headline} ${item.source}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }

      const headline = item.headline.toUpperCase();
      const mentions = (symbol: string) =>
        new RegExp(
          `(^|[^A-Z0-9])${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`,
        ).test(headline);
      const isWatchlist = watchSymbols.some(mentions);
      const isHolding = holdingSymbols.some(mentions);
      const isPersonal = isWatchlist || isHolding;
      const sourceMatches =
        (isWatchlist && sources.includes("Watchlist")) ||
        (isHolding && sources.includes("Holdings")) ||
        (!isPersonal && sources.includes("All"));

      return (
        sourceMatches &&
        topics.includes(getNewsTopic(item.headline)) &&
        sentiments.includes(getNewsSentiment(item.headline))
      );
    });
  }, [
    holdingSymbols,
    news.data,
    now,
    period,
    query,
    sentiments,
    sources,
    topics,
    watchSymbols,
  ]);

  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const moreStories = filtered.slice(pageStart, pageStart + pageSize);
  const featured = latestNews[0];
  const latestStories = latestNews.slice(1, 5);

  const toggleSource = (source: NewsSource) => {
    setSources((current) => toggleSelection(current, source));
    resetPage();
  };
  const toggleTopic = (topic: NewsTopic) => {
    setTopics((current) => toggleSelection(current, topic));
    resetPage();
  };
  const toggleSentiment = (sentiment: NewsSentiment) => {
    setSentiments((current) => toggleSelection(current, sentiment));
    resetPage();
  };
  const changePeriod = (value: NewsPeriod) => {
    setPeriod(value);
    resetPage();
  };

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 w-full flex-1 bg-base px-3 py-4 sm:px-5 sm:py-5 lg:px-8">
      <div className="grid w-full min-w-0 flex-1 gap-4 sm:gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        <NewsFilters
          query={query}
          sources={sources}
          topics={topics}
          sentiments={sentiments}
          period={period}
          onRefresh={news.reload}
          onQueryChange={(value) => {
            setQuery(value);
            resetPage();
          }}
          onToggleSource={toggleSource}
          onToggleTopic={toggleTopic}
          onToggleSentiment={toggleSentiment}
          onPeriodChange={changePeriod}
        />
        <section className="min-w-0">
          {accountError && (
            <div
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              <span>{accountError}</span>
              <button
                type="button"
                onClick={() => void refreshAccount()}
                className="font-medium underline"
              >
                Retry
              </button>
            </div>
          )}
          <NewsStories
            error={news.error && !news.data ? news.error : null}
            loading={now === null || (news.loading && !news.data)}
            featured={featured}
            latestStories={latestStories}
            stories={moreStories}
            page={page}
            pageCount={pageCount}
            onRetry={news.reload}
            hrefForPage={hrefForPage}
          />
        </section>
      </div>
    </main>
  );
}
