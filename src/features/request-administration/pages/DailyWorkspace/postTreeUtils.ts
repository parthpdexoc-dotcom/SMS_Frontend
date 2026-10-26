import type { PostInRequestListDto } from '@/types/request';

export interface PostTreeNode {
  post: PostInRequestListDto;
  children: PostTreeNode[];
}

/**
 * Build an unlimited-depth parent/child tree from a flat post list using `postParentId`.
 * Orphaned / missing parents become roots. Cycles are broken by treating the cyclic edge as a root.
 */
export function buildPostTree(posts: ReadonlyArray<PostInRequestListDto>): PostTreeNode[] {
  const nodes = new Map<string, PostTreeNode>();
  const roots: PostTreeNode[] = [];
  const withoutId: PostTreeNode[] = [];

  for (const post of posts) {
    if (!post.postId) {
      withoutId.push({ post, children: [] });
      continue;
    }
    nodes.set(post.postId, { post, children: [] });
  }

  const isAncestor = (ancestorId: string, descendantId: string): boolean => {
    let currentId: string | null | undefined = descendantId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === ancestorId) return true;
      if (seen.has(currentId)) return false;
      seen.add(currentId);
      currentId = nodes.get(currentId)?.post.postParentId ?? null;
    }
    return false;
  };

  for (const post of posts) {
    if (!post.postId) continue;
    const node = nodes.get(post.postId);
    if (!node) continue;

    const parentId = post.postParentId;
    if (parentId && nodes.has(parentId) && parentId !== post.postId && !isAncestor(post.postId, parentId)) {
      nodes.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return [...roots, ...withoutId];
}

/** Keep matching nodes, ancestors needed for path context, and full subtrees under matches. */
export function filterPostTree(
  nodes: ReadonlyArray<PostTreeNode>,
  matches: (post: PostInRequestListDto) => boolean
): PostTreeNode[] {
  const result: PostTreeNode[] = [];
  for (const node of nodes) {
    const selfMatch = matches(node.post);
    if (selfMatch) {
      result.push(node);
      continue;
    }
    const filteredChildren = filterPostTree(node.children, matches);
    if (filteredChildren.length > 0) {
      result.push({ post: node.post, children: filteredChildren });
    }
  }
  return result;
}

export function collectExpandablePostIds(nodes: ReadonlyArray<PostTreeNode>): string[] {
  const ids: string[] = [];
  const walk = (list: ReadonlyArray<PostTreeNode>) => {
    for (const node of list) {
      if (node.children.length > 0 && node.post.postId) {
        ids.push(node.post.postId);
      }
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

export function flattenVisiblePostIds(
  nodes: ReadonlyArray<PostTreeNode>,
  expandedIds: ReadonlySet<string>
): string[] {
  const ids: string[] = [];
  const walk = (list: ReadonlyArray<PostTreeNode>) => {
    for (const node of list) {
      if (node.post.postId) ids.push(node.post.postId);
      if (node.children.length > 0 && node.post.postId && expandedIds.has(node.post.postId)) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}
