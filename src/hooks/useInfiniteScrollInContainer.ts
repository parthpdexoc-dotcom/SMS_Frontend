import { useCallback, useEffect, useRef, type RefObject } from 'react';

const SCROLL_ROOT_MARGIN = '120px';
const SCROLL_BOTTOM_THRESHOLD_PX = 160;
const FILL_VIEWPORT_SLACK_PX = 80;

export type InfiniteScrollInContainerOptions = {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** When the list grows, rebind the observer (sentinel position changes). */
  itemCount: number;
};

/**
 * Infinite scroll inside a fixed `overflow-y: auto` container (not the window).
 * Uses IntersectionObserver with that container as `root`, plus a scroll fallback
 * and auto-fetch when content is shorter than the container.
 */
export function useInfiniteScrollInContainer(
  scrollContainerRef: RefObject<HTMLElement | null>,
  sentinelRef: RefObject<HTMLElement | null>,
  {
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore,
    itemCount,
  }: InfiniteScrollInContainerOptions
): void {
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const guardRef = useRef({ hasMore, isLoading, isLoadingMore });
  guardRef.current = { hasMore, isLoading, isLoadingMore };

  const tryLoadMore = useCallback(() => {
    const guard = guardRef.current;
    if (!guard.hasMore || guard.isLoading || guard.isLoadingMore) return;
    onLoadMoreRef.current();
  }, []);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          tryLoadMore();
        }
      },
      { root, rootMargin: `${SCROLL_ROOT_MARGIN} 0px`, threshold: 0 }
    );
    observer.observe(sentinel);

    const onScroll = () => {
      const guard = guardRef.current;
      if (!guard.hasMore || guard.isLoading || guard.isLoadingMore) return;
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - SCROLL_BOTTOM_THRESHOLD_PX) {
        tryLoadMore();
      }
    };
    root.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    tryLoadMore,
    itemCount,
    scrollContainerRef,
    sentinelRef,
  ]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !hasMore || isLoading || isLoadingMore) return;
    if (root.scrollHeight > root.clientHeight + FILL_VIEWPORT_SLACK_PX) return;
    tryLoadMore();
  }, [hasMore, isLoading, isLoadingMore, itemCount, tryLoadMore, scrollContainerRef]);
}
