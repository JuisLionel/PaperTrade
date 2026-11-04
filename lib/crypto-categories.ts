export type CryptoCategoryId =
  | "layer-1"
  | "layer-2"
  | "defi"
  | "meme"
  | "ai"
  | "gaming"
  | "stablecoin"
  | "payments";

export const CRYPTO_CATEGORIES: { id: CryptoCategoryId; label: string }[] = [
  { id: "layer-1", label: "Layer 1" },
  { id: "layer-2", label: "Layer 2" },
  { id: "defi", label: "DeFi" },
  { id: "meme", label: "Meme" },
  { id: "ai", label: "AI" },
  { id: "gaming", label: "Gaming" },
  { id: "stablecoin", label: "Stablecoins" },
  { id: "payments", label: "Payments" },
];

type CryptoEntry = { base: string; name: string; category: CryptoCategoryId };

const entry = (
  category: CryptoCategoryId,
  coins: [base: string, name: string][],
): CryptoEntry[] => coins.map(([base, name]) => ({ base, name, category }));

export const CRYPTO_ASSETS: CryptoEntry[] = [
  ...entry("layer-1", [
    ["BTC", "Bitcoin"], ["ETH", "Ethereum"], ["SOL", "Solana"],
    ["ADA", "Cardano"], ["AVAX", "Avalanche"], ["DOT", "Polkadot"],
    ["ATOM", "Cosmos"], ["NEAR", "NEAR Protocol"], ["SUI", "Sui"],
    ["APT", "Aptos"], ["TON", "Toncoin"], ["TRX", "TRON"], ["BNB", "BNB"],
  ]),
  ...entry("layer-2", [
    ["ARB", "Arbitrum"], ["OP", "Optimism"], ["POL", "Polygon"],
    ["STRK", "Starknet"],
  ]),
  ...entry("defi", [
    ["UNI", "Uniswap"], ["AAVE", "Aave"], ["LINK", "Chainlink"],
    ["MKR", "Maker"], ["CRV", "Curve DAO"], ["LDO", "Lido DAO"],
    ["INJ", "Injective"], ["RUNE", "THORChain"],
  ]),
  ...entry("meme", [
    ["DOGE", "Dogecoin"], ["SHIB", "Shiba Inu"], ["PEPE", "Pepe"],
    ["WIF", "dogwifhat"], ["BONK", "Bonk"], ["FLOKI", "Floki"],
  ]),
  ...entry("ai", [
    ["FET", "Fetch.ai"], ["RENDER", "Render"], ["TAO", "Bittensor"],
    ["WLD", "Worldcoin"],
  ]),
  ...entry("gaming", [
    ["AXS", "Axie Infinity"], ["SAND", "The Sandbox"], ["MANA", "Decentraland"],
    ["GALA", "Gala"], ["IMX", "Immutable"],
  ]),
  ...entry("stablecoin", [
    ["USDC", "USD Coin"], ["FDUSD", "First Digital USD"], ["TUSD", "TrueUSD"],
  ]),
  ...entry("payments", [
    ["XRP", "XRP"], ["XLM", "Stellar"], ["LTC", "Litecoin"],
    ["BCH", "Bitcoin Cash"],
  ]),
];

const CATEGORY_BY_BASE = new Map(CRYPTO_ASSETS.map((c) => [c.base, c.category]));

/** "BINANCE:BTCUSDT" -> "BTC" (same rule as displaySymbol in the panel) */
export const cryptoBase = (symbol: string) =>
  symbol.includes(":") ? symbol.split(":")[1].replace(/USDT$/, "") : symbol;

export const getCryptoCategory = (symbol: string) =>
  CATEGORY_BY_BASE.get(cryptoBase(symbol));