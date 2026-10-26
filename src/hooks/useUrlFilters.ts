import { useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

/**
 * Generic hook to keep filter state in the URL (shareable links, back/forward).
 * Use for any screen that has filters (available posts, lists with search, etc.).
 *
 * @param filterKeys - Optional list of param names to treat as filters. If omitted, all search params are used.
 * @returns [filters, setFilter, setFilters] where filters is Record<key, string>, setFilter(k,v) sets one (v=null removes), setFilters(updates) sets many.
 */
export function useUrlFilters(filterKeys?: string[]) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const filters = useMemo(() => {
    const entries = filterKeys
      ? filterKeys.map((key) => [key, searchParams.get(key) ?? ''] as const)
      : Array.from(searchParams.entries());
    return Object.fromEntries(entries) as Record<string, string>;
  }, [searchParams, filterKeys?.join(',')]);

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
    },
    [searchParams, location.pathname, navigate]
  );

  const setFilters = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
    },
    [searchParams, location.pathname, navigate]
  );

  return [filters, setFilter, setFilters] as const;
}
