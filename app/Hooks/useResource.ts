"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface Options { enabled?: boolean; refreshMs?: number }

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
  { enabled = true, refreshMs }: Options = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const run = async () => {
      try {
        setData(await loadRef.current(ctrl.signal));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };
    setData(null);
    setLoading(true);
    run();
    const id = refreshMs ? setInterval(() => !document.hidden && run(), refreshMs) : undefined;
    return () => {
      ctrl.abort();
      if (id) clearInterval(id);
    };
  }, [key, enabled, refreshMs, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}