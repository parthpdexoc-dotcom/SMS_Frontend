import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SMSIcon } from '@/components/smsatoms';
import { DAILY_WORKSPACE } from '@/constants/strings';
import type { PostInRequestListDto } from '@/types/request';
import { WorkspaceIconButton } from './WorkspaceIconButton';
import {
  buildPostTree,
  collectExpandablePostIds,
  flattenVisiblePostIds,
  type PostTreeNode,
} from '../postTreeUtils';

/** Cap visual indent growth so deep trees stay usable. */
const MAX_INDENT_DEPTH = 3;

export type PostTreeActionsPlacement = 'header' | 'footer';

export interface PostTreeActions {
  onClone: (post: PostInRequestListDto) => void;
  onEdit: (post: PostInRequestListDto) => void;
  onDelete: (post: PostInRequestListDto) => void;
  onMore: (el: HTMLElement, post: PostInRequestListDto) => void;
}

export interface PostTreeProps {
  posts: ReadonlyArray<PostInRequestListDto>;
  selectedPostIds: ReadonlySet<string>;
  onSelect: (postId: string) => void;
  getTimeLabel: (post: PostInRequestListDto) => string;
  /** Omit for select-only cards (e.g. Employee Location). */
  actions?: PostTreeActions;
  /** When positions panel is open, actions move to the card footer like request rows. */
  actionsPlacement?: PostTreeActionsPlacement;
}

function stopCardClick(e: React.MouseEvent) {
  e.stopPropagation();
}

interface PostTreeItemProps {
  node: PostTreeNode;
  depth: number;
  isLast: boolean;
  expandedIds: ReadonlySet<string>;
  selectedPostIds: ReadonlySet<string>;
  focusedPostId: string | null;
  onToggleExpand: (postId: string) => void;
  onSelect: (postId: string) => void;
  onFocusPost: (postId: string) => void;
  onKeyNavigate: (postId: string, key: string) => void;
  getTimeLabel: (post: PostInRequestListDto) => string;
  actions?: PostTreeActions;
  actionsPlacement: PostTreeActionsPlacement;
}

function PostTreeActionsBar({
  post,
  actions,
  className,
}: {
  post: PostInRequestListDto;
  actions: PostTreeActions;
  className: string;
}) {
  return (
    <div className={className} onClick={stopCardClick}>
      <div className="daily-workspace__actions dw-icon-btn-group">
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.CLONE_POST}
          onClick={() => actions.onClone(post)}
        >
          <SMSIcon name="content_copy" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.EDIT_POST}
          onClick={() => actions.onEdit(post)}
        >
          <SMSIcon name="edit" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          danger
          title={DAILY_WORKSPACE.ACTIONS.DELETE_POST}
          onClick={() => actions.onDelete(post)}
        >
          <SMSIcon name="delete" size="sm" />
        </WorkspaceIconButton>
        <WorkspaceIconButton
          title={DAILY_WORKSPACE.ACTIONS.MORE_POST}
          onClick={(e) => actions.onMore(e.currentTarget, post)}
        >
          <SMSIcon name="more_vert" size="sm" />
        </WorkspaceIconButton>
      </div>
    </div>
  );
}

const PostTreeItem = memo(function PostTreeItem({
  node,
  depth,
  isLast,
  expandedIds,
  selectedPostIds,
  focusedPostId,
  onToggleExpand,
  onSelect,
  onFocusPost,
  onKeyNavigate,
  getTimeLabel,
  actions,
  actionsPlacement,
}: PostTreeItemProps) {
  const post = node.post;
  const postId = post.postId ?? '';
  const hasChildren = node.children.length > 0;
  const isBranchExpanded = hasChildren && Boolean(postId) && expandedIds.has(postId);
  const isSelected = Boolean(postId && selectedPostIds.has(postId));
  const isFocused = Boolean(postId && focusedPostId === postId);
  const actionsInFooter = actionsPlacement === 'footer';
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.focus({ preventScroll: false });
    }
  }, [isFocused]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!postId || !hasChildren) return;
      onToggleExpand(postId);
    },
    [postId, hasChildren, onToggleExpand]
  );

  const positionsLabel = DAILY_WORKSPACE.POSITIONS_COUNT.replace(
    '{count}',
    String(post.totalPositions ?? 0)
  );

  const childIndentClass =
    depth + 1 >= MAX_INDENT_DEPTH
      ? 'dw-post-tree__children--capped'
      : 'dw-post-tree__children--step';

  return (
    <li
      className={`dw-post-tree__node${isLast ? ' is-last' : ''}`}
      data-depth={depth}
      role="none"
    >
      <div
        ref={cardRef}
        role="treeitem"
        tabIndex={isFocused ? 0 : -1}
        aria-level={depth + 1}
        aria-expanded={hasChildren ? isBranchExpanded : undefined}
        aria-selected={isSelected}
        className={[
          'dw-post-tree__card',
          actionsInFooter ? 'dw-post-tree__card--actions-footer' : '',
          isSelected ? 'is-selected' : '',
          isFocused ? 'is-focused' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (!postId) return;
          onFocusPost(postId);
          onSelect(postId);
        }}
        onKeyDown={(e) => {
          if (!postId) return;
          if (
            e.key === 'ArrowDown' ||
            e.key === 'ArrowUp' ||
            e.key === 'Home' ||
            e.key === 'End' ||
            e.key === 'ArrowRight' ||
            e.key === 'ArrowLeft'
          ) {
            e.preventDefault();
          }
          onKeyNavigate(postId, e.key);
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(postId);
          }
          if (e.key === 'ArrowRight' && hasChildren && !isBranchExpanded) {
            onToggleExpand(postId);
          }
          if (e.key === 'ArrowLeft' && hasChildren && isBranchExpanded) {
            onToggleExpand(postId);
          }
        }}
      >
        <div className="dw-post-tree__card-top">
          <div className="dw-post-tree__card-title-row">
            {hasChildren ? (
              <button
                type="button"
                className="dw-post-tree__expand"
                tabIndex={-1}
                aria-label={
                  isBranchExpanded
                    ? DAILY_WORKSPACE.COLLAPSE_BRANCH
                    : DAILY_WORKSPACE.EXPAND_BRANCH
                }
                onClick={handleToggleExpand}
              >
                <SMSIcon name={isBranchExpanded ? 'expand_more' : 'chevron_right'} size="xs" />
              </button>
            ) : (
              <span className="dw-post-tree__expand-spacer" aria-hidden="true" />
            )}

            {post.isSupervisorPost && (
              <SMSIcon name="crown" size="xs" className="dw-post-tree__supervisor-icon" />
            )}

            <span className="dw-post-tree__card-title">{post.postTitle}</span>

            {post.isSupervisorPost && (
              <span className="dw-post-tree__badge">{DAILY_WORKSPACE.SUPERVISOR_BADGE}</span>
            )}
          </div>

          {!actionsInFooter && actions && (
            <PostTreeActionsBar
              post={post}
              actions={actions}
              className="dw-post-tree__card-actions"
            />
          )}
        </div>

        <div className="dw-post-tree__card-meta">
          <div className="dw-post-tree__meta-row">
            <span className="dw-post-tree__meta-item dw-post-tree__meta-item--time">
              <SMSIcon name="schedule" size="xs" />
              <span>{getTimeLabel(post)}</span>
            </span>
            <span className="dw-post-tree__meta-item dw-post-tree__meta-item--positions">
              <SMSIcon name="group" size="xs" />
              <span>{positionsLabel}</span>
            </span>
          </div>
          <div className="dw-post-tree__meta-row">
            <span className="dw-post-tree__meta-item dw-post-tree__meta-item--location">
              <SMSIcon name="location_on" size="xs" />
              <span>{post.postLocation || '—'}</span>
            </span>
          </div>
        </div>

        {actionsInFooter && actions && (
          <PostTreeActionsBar
            post={post}
            actions={actions}
            className="dw-post-tree__card-foot"
          />
        )}
      </div>

      {hasChildren && isBranchExpanded && (
        <ul className={`dw-post-tree__children ${childIndentClass}`} role="group">
          {node.children.map((child, index) => (
            <PostTreeItem
              key={child.post.postId || child.post.postTitle}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
              expandedIds={expandedIds}
              selectedPostIds={selectedPostIds}
              focusedPostId={focusedPostId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onFocusPost={onFocusPost}
              onKeyNavigate={onKeyNavigate}
              getTimeLabel={getTimeLabel}
              actions={actions}
              actionsPlacement={actionsPlacement}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export const PostTree: React.FC<PostTreeProps> = ({
  posts,
  selectedPostIds,
  onSelect,
  getTimeLabel,
  actions,
  actionsPlacement = 'header',
}) => {
  const tree = useMemo(() => buildPostTree(posts), [posts]);

  const expandableIdsKey = useMemo(
    () => collectExpandablePostIds(tree).sort().join(','),
    [tree]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);

  useEffect(() => {
    const ids = expandableIdsKey ? expandableIdsKey.split(',') : [];
    setExpandedIds(new Set(ids));
  }, [expandableIdsKey]);

  const visibleIds = useMemo(
    () => flattenVisiblePostIds(tree, expandedIds),
    [tree, expandedIds]
  );

  useEffect(() => {
    if (visibleIds.length === 0) {
      setFocusedPostId(null);
      return;
    }
    setFocusedPostId((prev) => {
      const selectedVisible = visibleIds.find((id) => selectedPostIds.has(id));
      if (selectedVisible) return selectedVisible;
      if (prev && visibleIds.includes(prev)) return prev;
      return visibleIds[0]!;
    });
  }, [visibleIds, selectedPostIds]);

  const onToggleExpand = useCallback((postId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const onFocusPost = useCallback((postId: string) => {
    setFocusedPostId(postId);
  }, []);

  const onKeyNavigate = useCallback(
    (postId: string, key: string) => {
      const index = visibleIds.indexOf(postId);
      if (index < 0) return;
      if (key === 'ArrowDown') {
        const next = visibleIds[index + 1];
        if (next) setFocusedPostId(next);
      } else if (key === 'ArrowUp') {
        const prev = visibleIds[index - 1];
        if (prev) setFocusedPostId(prev);
      } else if (key === 'Home') {
        const first = visibleIds[0];
        if (first) setFocusedPostId(first);
      } else if (key === 'End') {
        const last = visibleIds[visibleIds.length - 1];
        if (last) setFocusedPostId(last);
      }
    },
    [visibleIds]
  );

  if (tree.length === 0) return null;

  return (
    <ul
      className={[
        'dw-post-tree',
        actionsPlacement === 'footer' ? 'dw-post-tree--actions-footer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="tree"
      aria-label={DAILY_WORKSPACE.POSTS_PANEL}
    >
      {tree.map((node, index) => (
        <PostTreeItem
          key={node.post.postId || node.post.postTitle}
          node={node}
          depth={0}
          isLast={index === tree.length - 1}
          expandedIds={expandedIds}
          selectedPostIds={selectedPostIds}
          focusedPostId={focusedPostId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onFocusPost={onFocusPost}
          onKeyNavigate={onKeyNavigate}
          getTimeLabel={getTimeLabel}
          actions={actions}
          actionsPlacement={actionsPlacement}
        />
      ))}
    </ul>
  );
};
