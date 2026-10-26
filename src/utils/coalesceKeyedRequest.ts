/** Shares one in-flight promise per key until settled (StrictMode / duplicate dispatches). */
const inflight = new Map<string, Promise<unknown>>();

export function coalesceKeyedRequest<T>(
  namespace: string,
  requestKey: string,
  factory: () => Promise<T>
): Promise<T> {
  const k = `${namespace}\0${requestKey}`;
  let p = inflight.get(k) as Promise<T> | undefined;
  if (!p) {
    p = factory().finally(() => {
      queueMicrotask(() => inflight.delete(k));
    }) as Promise<T>;
    inflight.set(k, p);
  }
  return p;
}
