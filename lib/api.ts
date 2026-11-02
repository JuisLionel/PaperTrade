const FINNHUB_KEY = process.env.FINNHUB_KEY!;

export async function finnhub<T = any>(
  path: string,
  params: Record<string, string> = {},
  revalidate = 10 // seconds to cache
): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: FINNHUB_KEY });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${qs}`, {
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Finnhub error ${res.status}`);
  return res.json();
}