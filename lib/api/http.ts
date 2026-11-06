export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}