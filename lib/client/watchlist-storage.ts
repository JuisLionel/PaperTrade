import type { Asset } from "./markets";
import {
  fetchAlpacaWatchlist,
  updateAlpacaWatchlist,
} from "@/lib/api/alpaca";

const COOKIE_NAME = "papertrade.watchlist.pinnedAssets";
const LEGACY_STORAGE_KEY = COOKIE_NAME;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_COOKIE_VALUE_LENGTH = 3800;
const PIN_SYNC_TTL_MS = 30_000;
export const PINNED_ASSETS_CHANGED_EVENT = "papertrade:pinned-assets-changed";
export const OPEN_WATCHLIST_EVENT = "papertrade:open-watchlist";
let pinsSyncInFlight: Promise<Asset[]> | null = null;
let cachedPins: Asset[] | null = null;
let cachedPinsAt = 0;

function parseAssets(value: string): Asset[] {
  const parsed: unknown = JSON.parse(value);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (asset): asset is Asset =>
        typeof asset === "object" &&
        asset !== null &&
        "symbol" in asset &&
        typeof asset.symbol === "string" &&
        "name" in asset &&
        typeof asset.name === "string" &&
        "kind" in asset &&
        typeof asset.kind === "string",
    )
  ) {
    throw new Error("Saved watchlist pins have an invalid format.");
  }

  return [...new Map(parsed.map((asset) => [asset.symbol, asset])).values()];
}

function getCookieValue() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));

  return cookie?.slice(COOKIE_NAME.length + 1);
}

export function readPinnedAssets() {
  const cookieValue = getCookieValue();
  if (cookieValue !== undefined) {
    return parseAssets(decodeURIComponent(cookieValue));
  }

  const legacyValue = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  return legacyValue ? parseAssets(legacyValue) : [];
}

export function writePinnedAssets(assets: Asset[]) {
  const serialized = JSON.stringify(assets);
  const value = encodeURIComponent(serialized);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (value.length <= MAX_COOKIE_VALUE_LENGTH) {
    document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    if (getCookieValue() !== value) {
      throw new Error("The browser could not save your pinned items in a cookie.");
    }
  } else {
    try {
      window.localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
    } catch {
      throw new Error("The browser could not cache your Alpaca watchlist.");
    }
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    if (window.localStorage.getItem(LEGACY_STORAGE_KEY) !== serialized) {
      throw new Error("The browser could not cache your Alpaca watchlist.");
    }
  }

  window.dispatchEvent(
    new CustomEvent<Asset[]>(PINNED_ASSETS_CHANGED_EVENT, {
      detail: [...assets],
    }),
  );
}

export function syncPinnedAssets(force = false) {
  if (pinsSyncInFlight) return pinsSyncInFlight;
  if (!force && cachedPins && Date.now() - cachedPinsAt < PIN_SYNC_TTL_MS) {
    return Promise.resolve(cachedPins);
  }

  pinsSyncInFlight = (async () => {
    const remote = await fetchAlpacaWatchlist();
    const assets = remote.exists
      ? remote.assets
      : (await updateAlpacaWatchlist(readPinnedAssets())).assets;
    writePinnedAssets(assets);
    cachedPins = assets;
    cachedPinsAt = Date.now();
    return assets;
  })().finally(() => {
    pinsSyncInFlight = null;
  });

  return pinsSyncInFlight;
}

export async function savePinnedAssets(assets: Asset[]) {
  const saved = await updateAlpacaWatchlist(assets);
  writePinnedAssets(saved.assets);
  cachedPins = saved.assets;
  cachedPinsAt = Date.now();
  return saved.assets;
}
