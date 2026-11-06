import type { Asset } from "./markets";

const COOKIE_NAME = "papertrade.watchlist.pinnedAssets";
const LEGACY_STORAGE_KEY = COOKIE_NAME;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_COOKIE_VALUE_LENGTH = 3800;
export const PINNED_ASSETS_CHANGED_EVENT = "papertrade:pinned-assets-changed";
export const OPEN_WATCHLIST_EVENT = "papertrade:open-watchlist";

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
  const value = encodeURIComponent(JSON.stringify(assets));
  if (value.length > MAX_COOKIE_VALUE_LENGTH) {
    throw new Error("Cookie storage is full. Unpin some items before adding more.");
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;

  if (getCookieValue() !== value) {
    throw new Error("The browser could not save your pinned items in a cookie.");
  }

  window.dispatchEvent(
    new CustomEvent<Asset[]>(PINNED_ASSETS_CHANGED_EVENT, {
      detail: [...assets],
    }),
  );
}
