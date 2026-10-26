/** Data domains in Daily Workspace (Requests → Posts → Positions). */
export type WorkspaceRefreshDomain = 'request' | 'post' | 'postPosition';

export type WorkspaceRefreshScope = {
  /** When omitted, all currently selected posts are refreshed. */
  postIds?: readonly string[];
};

export type WorkspaceRefreshHandlers = {
  reloadRequests: () => void;
  reloadPosts: () => void;
  reloadPositionsForPost: (postId: string) => void;
  getSelectedPostIds: () => readonly string[];
};

/**
 * Refreshes only the workspace columns affected by a mutation.
 * Navigation / filter changes stay in dedicated `useEffect`s on each panel.
 */
export function runWorkspaceRefresh(
  domains: readonly WorkspaceRefreshDomain[],
  handlers: WorkspaceRefreshHandlers,
  scope?: WorkspaceRefreshScope
): void {
  if (domains.includes('request')) {
    handlers.reloadRequests();
  }
  if (domains.includes('post')) {
    handlers.reloadPosts();
  }
  if (domains.includes('postPosition')) {
    const postIds = scope?.postIds?.length ? scope.postIds : handlers.getSelectedPostIds();
    for (const postId of postIds) {
      const trimmed = postId?.trim();
      if (trimmed) handlers.reloadPositionsForPost(trimmed);
    }
  }
}
