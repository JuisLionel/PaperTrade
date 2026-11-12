export const NEWS_TOPICS = [
  "Earnings",
  "Economy",
  "Tech",
  "Energy",
  "Crypto",
  "Finance",
  "Politics",
] as const;
export const NEWS_SENTIMENTS = ["Positive", "Neutral", "Negative"] as const;
export const NEWS_PERIODS = ["Today", "Week"] as const;
export const NEWS_SOURCES = ["Watchlist", "Holdings", "All"] as const;

export type NewsTopic = (typeof NEWS_TOPICS)[number];
export type NewsSentiment = (typeof NEWS_SENTIMENTS)[number];
export type NewsPeriod = (typeof NEWS_PERIODS)[number];
export type NewsSource = (typeof NEWS_SOURCES)[number];

export const NEWS_PERIOD_SECONDS: Record<NewsPeriod, number> = {
  Today: 24 * 60 * 60,
  Week: 7 * 24 * 60 * 60,
};

const TOPIC_TERMS: Record<NewsTopic, string[]> = {
  Earnings: ["earnings", "revenue", "profit", "quarter", "guidance", "eps"],
  Economy: ["economy", "inflation", "fed ", "rates", "jobs", "gdp", "tariff"],
  Tech: ["technology", "tech ", " ai ", "chip", "software", "semiconductor"],
  Energy: ["energy", "oil", "gas prices", "opec", "renewable"],
  Crypto: ["crypto", "bitcoin", "ethereum", "blockchain"],
  Finance: ["bank", "finance", "financial", "stock", "shares", "investor", "market"],
  Politics: [
    "iran",
    "militant",
    "attack",
    "politic",
    "government",
    "senate",
    "congress",
    "president",
    "war",
    "military",
    "defense",
    "election",
    "parliament",
    "minister",
    "sanction",
    "geopolitic",
    "foreign policy",
  ],
};

const POSITIVE_TERMS = [
  "surge",
  "soar",
  "gain",
  "growth",
  "record",
  "beats",
  "upgrade",
  "rally",
  "profit",
];
const NEGATIVE_TERMS = [
  "fall",
  "drop",
  "cuts",
  "cut ",
  "loss",
  "miss",
  "decline",
  "warning",
  "plunge",
  "bankruptcy",
];

export function getNewsTopic(headline: string): NewsTopic {
  const text = ` ${headline.toLowerCase()} `;
  return (
    NEWS_TOPICS.find((topic) =>
      TOPIC_TERMS[topic].some((term) => text.includes(term)),
    ) ?? "Finance"
  );
}

export function getNewsSentiment(headline: string): NewsSentiment {
  const text = headline.toLowerCase();
  const positive = POSITIVE_TERMS.filter((term) => text.includes(term)).length;
  const negative = NEGATIVE_TERMS.filter((term) => text.includes(term)).length;
  return positive > negative
    ? "Positive"
    : negative > positive
      ? "Negative"
      : "Neutral";
}

export function toggleSelection<T extends string>(
  values: T[],
  value: T,
): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
