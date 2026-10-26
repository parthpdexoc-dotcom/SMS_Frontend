import { MenuItem } from '@/types';

/** True if any node in the menu tree uses this id (depth-first). */
export function menuTreeHasItemId(items: MenuItem[], id: string): boolean {
  for (const item of items) {
    if (item.id === id) return true;
    if (item.children?.length && menuTreeHasItemId(item.children, id)) return true;
  }
  return false;
}

/**
 * Recursively removes menu items with the given id. Returns a new tree; does not mutate.
 */
export function filterMenuItemsById(items: MenuItem[], excludeId: string): MenuItem[] {
  return items
    .filter((item) => item.id !== excludeId)
    .map((item) => ({
      ...item,
      children: item.children ? filterMenuItemsById(item.children, excludeId) : undefined,
    }));
}

/**
 * Merges two menu item arrays by id: items with the same id have their children
 * merged (union by id); new ids are appended. Returns a new array; does not mutate.
 * Used to build one menu from multiple roles' contributions.
 */
export function mergeMenuItems(base: MenuItem[], toAdd: MenuItem[]): MenuItem[] {
  const result = base.map((item) => ({
    ...item,
    children: item.children ? [...item.children] : undefined,
  }));

  for (const add of toAdd) {
    const existing = result.find((r) => r.id === add.id);
    if (existing) {
      const mergedChildren = mergeMenuItems(existing.children ?? [], add.children ?? []);
      existing.children = mergedChildren.length ? mergedChildren : undefined;
    } else {
      result.push({
        ...add,
        children: add.children ? mergeMenuItems([], add.children) : undefined,
      });
    }
  }

  return result;
}

/**
 * Sidebar order for Audit Log children (`roleMenuContributions` ids).
 * `mergeMenuItems` appends unknown child ids to the end, so multi-role users
 * (e.g. reduced audit merged before full audit) saw Requester/Request last; this restores order.
 */
const AUDIT_LOG_CHILD_ORDER: string[] = [
  'audit-requester',
  'audit-request',
  'audit-request-schedule',
  'audit-post',
  'audit-post-position',
  'audit-job-position-flow',
  'audit-employee',
  'audit-placeholder',
  'audit-closed-post-position',
  'audit-closed-post-position-equipment',
  'audit-payment',
  'audit-payment-allocation',
  'audit-invoice',
  'audit-invoice-detail',
  'audit-requester-ledger',
];

const AUDIT_LOG_CHILD_ORDER_SET = new Set(AUDIT_LOG_CHILD_ORDER);

export function normalizeAuditLogSectionChildOrder(items: MenuItem[]): MenuItem[] {
  return items.map((item) => {
    if (item.id === 'audit-log-section' && item.children?.length) {
      const byId = new Map(item.children.map((c) => [c.id, c]));
      const ordered: MenuItem[] = [];
      for (const id of AUDIT_LOG_CHILD_ORDER) {
        const child = byId.get(id);
        if (child) ordered.push(child);
      }
      for (const c of item.children) {
        if (!AUDIT_LOG_CHILD_ORDER_SET.has(c.id)) {
          ordered.push(c);
        }
      }
      return { ...item, children: ordered };
    }
    if (item.children?.length) {
      return { ...item, children: normalizeAuditLogSectionChildOrder(item.children) };
    }
    return item;
  });
}

/** Paths that belong to the Requester sidebar item (request flows, jobs, post positions, etc.). */
function isPersonnelRequestPath(pathname: string): boolean {
  return pathname === '/personnel/request' || pathname.startsWith('/personnel/request/');
}

export function getRequesterMenuItemIdForPath(pathname: string): 'requester' | null {
  if (
    pathname.startsWith('/personnel/requester') ||
    isPersonnelRequestPath(pathname) ||
    pathname.startsWith('/personnel/job') ||
    pathname.startsWith('/personnel/job-position') ||
    pathname.startsWith('/personnel/post-position') ||
    pathname.startsWith('/personnel/post/') ||
    pathname.startsWith('/admin/requester-restrict') ||
    pathname.startsWith('/admin/requester-manager') ||
    pathname.startsWith('/admin/requester-authorized') ||
    pathname.startsWith('/admin/block-date')
  ) {
    return 'requester';
  }
  return null;
}
