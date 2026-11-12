"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuRefreshCw, LuSearch } from "react-icons/lu";
import {
  NEWS_PERIODS,
  NEWS_SENTIMENTS,
  NEWS_SOURCES,
  NEWS_TOPICS,
  type NewsPeriod,
  type NewsSentiment,
  type NewsSource,
  type NewsTopic,
} from "../news-utils";

interface NewsFiltersProps {
  query: string;
  sources: NewsSource[];
  topics: NewsTopic[];
  sentiments: NewsSentiment[];
  period: NewsPeriod;
  onRefresh: () => void;
  onQueryChange: (value: string) => void;
  onToggleSource: (source: NewsSource) => void;
  onToggleTopic: (topic: NewsTopic) => void;
  onToggleSentiment: (sentiment: NewsSentiment) => void;
  onPeriodChange: (period: NewsPeriod) => void;
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

function FilterSections({
  sources,
  topics,
  sentiments,
  period,
  onToggleSource,
  onToggleTopic,
  onToggleSentiment,
  onPeriodChange,
  compact = false,
}: Omit<NewsFiltersProps, "query" | "onRefresh" | "onQueryChange"> & {
  compact?: boolean;
}) {
  return (
    <>
      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
          Show
        </h2>
        {NEWS_SOURCES.map((source) => (
          <FilterCheckbox
            key={source}
            label={
              source === "Watchlist"
                ? "My watchlist"
                : source === "Holdings"
                  ? "My holdings"
                  : source
            }
            checked={sources.includes(source)}
            onChange={() => onToggleSource(source)}
          />
        ))}
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
          Topic
        </h2>
        {NEWS_TOPICS.map((topic) => (
          <FilterCheckbox
            key={topic}
            label={topic}
            checked={topics.includes(topic)}
            onChange={() => onToggleTopic(topic)}
          />
        ))}
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
          Sentiment
        </h2>
        {NEWS_SENTIMENTS.map((sentiment) => (
          <FilterCheckbox
            key={sentiment}
            label={sentiment}
            checked={sentiments.includes(sentiment)}
            onChange={() => onToggleSentiment(sentiment)}
          />
        ))}
      </div>

      <div className={compact ? "mt-4" : "mt-5"}>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
          Time
        </h2>
        <div className={`flex ${compact ? "flex-wrap" : ""} gap-2`}>
          {NEWS_PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPeriodChange(value)}
              aria-pressed={period === value}
              className={`rounded-full border px-3 py-1.5 text-ui-sm transition-colors ${
                period === value
                  ? "border-content bg-content font-medium text-base"
                  : "border-elevated text-content-secondary hover:text-opposite"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function NewsFilters(props: NewsFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearchOnSlash = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", focusSearchOnSlash);
    return () => window.removeEventListener("keydown", focusSearchOnSlash);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  return (
    <aside className="self-start lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-ui-xl font-bold text-opposite">News</h1>
        <button
          type="button"
          onClick={props.onRefresh}
          aria-label="Refresh news"
          className="rounded-md p-2 text-content-muted hover:bg-elevated hover:text-opposite"
        >
          <LuRefreshCw className="size-4" />
        </button>
      </div>

      <div className="flex items-start gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-sm border border-elevated bg-surface px-3 text-content-muted focus-within:border-content">
          <LuSearch className="size-4 shrink-0" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            aria-label="Search news"
            placeholder="Search news"
            className="min-w-0 flex-1 bg-transparent text-ui-sm text-opposite outline-none placeholder:text-content-muted"
          />
          <kbd className="kbd kbd-sm border-0 bg-elevated text-content-secondary">
            /
          </kbd>
        </label>

        <div ref={filtersRef} className="relative shrink-0 lg:hidden">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="news-filter-menu"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex h-10 items-center gap-2 rounded-md border border-elevated bg-surface px-3 text-ui-sm text-opposite"
          >
            Filters
            <LuChevronDown
              className={`size-4 text-content-muted transition-transform duration-200 motion-reduce:transition-none ${
                filtersOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
          <div
            id="news-filter-menu"
            aria-hidden={!filtersOpen}
            inert={!filtersOpen}
            className={`absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-elevated bg-surface p-4 shadow-xl transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
              filtersOpen
                ? "max-h-[70dvh] translate-y-0 overflow-y-auto opacity-100"
                : "pointer-events-none max-h-0 -translate-y-1 overflow-hidden opacity-0"
            }`}
          >
            <FilterSections {...props} compact />
          </div>
        </div>
      </div>

      <div className="mt-6 hidden lg:block">
        <FilterSections {...props} />
      </div>
    </aside>
  );
}
