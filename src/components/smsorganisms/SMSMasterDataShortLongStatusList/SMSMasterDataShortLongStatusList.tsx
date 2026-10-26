import React, { useEffect, useMemo, useState } from 'react';
import {
  SMSButton,
  SMSIcon,
  SMSIconButton,
  SMSTypography,
  SMSStack,
  SMSBox,
  SMSChip,
  SMSDialog,
  SMSDialogContent,
  SMSStandardDialogHeader,
  SMSSegmentedStatusFilter,
  type SMSSegmentedStatusFilterValue,
} from '@/components/smsatoms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { arrayMove } from '@dnd-kit/sortable';
import { usePagination } from '@/hooks/usePagination';
import { DEFAULT_TABLE_PAGE_SIZE, PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { formatTime } from '@/utils';
import './SMSMasterDataShortLongStatusList.css';

export interface MasterDataShortLongStatusListStrings {
  TITLE: string;
  EDIT_TITLE: string;
  TABLE: {
    TITLE: string;
    NO_DATA: string;
    FILTERS: { ACTIVE: string; INACTIVE: string };
    COLUMNS: {
      TITLE: string;
      DESCRIPTION: string;
      STATUS: string;
      CREATED_BY: string;
      EDITED_BY: string;
      ACTION: string;
    };
  };
  BUTTON: {
    ADD_NEW: string;
    EDIT: string;
    DELETE?: string;
  };
  /** Required when `onDelete` is provided. */
  CONFIRM?: {
    DELETE_TITLE: string;
    DELETE_MESSAGE: string;
    DELETE_CONFIRM: string;
    DELETE_CANCEL: string;
  };
}

export interface MasterDataShortLongStatusListFormProps<T> {
  initialData?: T | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface MasterDataShortLongStatusListProps<T> {
  className?: string;
  strings: MasterDataShortLongStatusListStrings;
  items: T[];
  loading: boolean;
  onRefresh: () => void;
  /** When omitted, delete control and confirm dialog are not shown. */
  onDelete?: (row: T) => Promise<void>;
  FormComponent: React.ComponentType<MasterDataShortLongStatusListFormProps<T>>;

  getShort: (row: T) => string;
  getLong: (row: T) => string;
  getStatus: (row: T) => boolean;
  getCreatedBy: (row: T) => string | null | undefined;
  getCreatedDate: (row: T) => string | null | undefined;
  getEditedBy: (row: T) => string | null | undefined;
  getEditedDate: (row: T) => string | null | undefined;

  extraColumns?: Array<{
    key: string;
    label: string;
    render?: (value: any, row: T) => React.ReactNode;
    mutedWhenInactive?: boolean;
  }>;
  showAuditColumns?: boolean;
  /** If false, hide the status column and pill. Default: true */
  showStatusColumn?: boolean;
  /** If false, hide Active/Inactive segmented control. Default: true */
  enableStatusFilter?: boolean;
  
  // Optional callbacks for move operations (for reordering)
  /** Optional third arg: atDisplayRow, batchIndex/batchTotal for multi-row drag (single toast on last). */
  onMoveUp?: (
    row: T,
    newRank: number,
    options?: { atDisplayRow?: number; batchIndex?: number; batchTotal?: number }
  ) => Promise<void>;
  onMoveDown?: (row: T, newRank: number) => Promise<void>;
  getId?: (row: T) => string; // Function to get the ID of the row (for API calls)
  /**
   * When set, drag-and-drop groups consecutive rows with the same rank and moves them together.
   * Dropping onto the 2nd+ row of a block inserts before that block (e.g. D onto B of A,B → D,A,B).
   */
  getRankForReorder?: (row: T) => number;
  /**
   * When set, drag reorder is ignored (no API / refresh) if source and drop target share the same rank.
   * Use for master data where tied ranks should not trigger rank updates (e.g. Employee Type).
   * Does not enable block grouping; use {@link getRankForReorder} only for that.
   */
  getReorderRank?: (row: T) => number;
  /** When true, hide Add / Edit / Delete (grid is view-only). Used e.g. for HR Admin on Department Division. */
  readOnly?: boolean;
  /** When set, matching rows stay visible but cannot be edited or deleted (greyed out, actions disabled). */
  isRowReadOnly?: (row: T) => boolean;
  /** When set, modal is controlled by parent (e.g. URL). 'add' = add modal, string = edit modal for that id, null = closed. Requires getId when using edit. */
  openModal?: 'add' | string | null;
  /** Called when user clicks Add (parent e.g. navigates to /add). */
  onOpenAdd?: () => void;
  /** Called when user clicks Edit (parent e.g. navigates to /edit/:id). Requires getId. */
  onOpenEdit?: (id: string) => void;
  /** Called when modal is closed (parent e.g. navigates to list). */
  onModalClose?: () => void;
  /** When provided with onSearchChange, search is controlled (e.g. for URL sync). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Drag column stays visible but handles are gray and non-interactive (e.g. suspended employee). */
  sortableDragDisabled?: boolean;

  /**
   * Server-driven pagination: `items` is one API page; totals and page changes come from the parent.
   * Use with `controlledStatusFilter` / `onControlledStatusFilterChange` so Active/Inactive is applied on the server.
   */
  serverPagination?: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  controlledStatusFilter?: SMSSegmentedStatusFilterValue;
  onControlledStatusFilterChange?: (value: SMSSegmentedStatusFilterValue) => void;
}

const DEFAULT_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

export function MasterDataShortLongStatusList<T extends Record<string, any>>({
  className = '',
  strings,
  items,
  loading,
  onRefresh,
  onDelete: onDeleteProp,
  FormComponent,
  getShort,
  getLong,
  getStatus,
  getCreatedBy,
  getCreatedDate,
  getEditedBy,
  getEditedDate,
  extraColumns = [],
  showAuditColumns = true,
  showStatusColumn = true,
  enableStatusFilter = true,
  onMoveUp,
  onMoveDown,
  getId,
  getRankForReorder,
  getReorderRank,
  readOnly = false,
  isRowReadOnly,
  openModal,
  onOpenAdd,
  onOpenEdit,
  onModalClose,
  searchValue: searchValueProp,
  onSearchChange: onSearchChangeProp,
  sortableDragDisabled = false,
  serverPagination,
  controlledStatusFilter,
  onControlledStatusFilterChange,
}: MasterDataShortLongStatusListProps<T>) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [internalEditingRow, setInternalEditingRow] = useState<T | null>(null);
  const [deletingRow, setDeletingRow] = useState<T | null>(null);
  const deleteConfirm = strings.CONFIRM;

  const isControlled = openModal !== undefined;
  const isModalOpen = isControlled
    ? (openModal !== null)
    : internalModalOpen;
  const editingRow = isControlled
    ? (openModal === 'add'
      ? null
      : (typeof openModal === 'string' && getId
        ? items.find((r) => getId(r) === openModal) ?? null
        : null))
    : internalEditingRow;
  // Default view should be Active (requested).
  const [internalStatusFilter, setInternalStatusFilter] = useState<SMSSegmentedStatusFilterValue>('active');

  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
  });

  /** Parent drives status via API (e.g. Response Area `isActive`). Otherwise use local filter on the current page. */
  const usesServerSideStatus = Boolean(serverPagination && onControlledStatusFilterChange);

  const effectiveStatusFilter: SMSSegmentedStatusFilterValue = !enableStatusFilter
    ? null
    : usesServerSideStatus
      ? controlledStatusFilter === undefined
        ? 'active'
        : controlledStatusFilter
      : internalStatusFilter;

  const handleSegmentStatusChange = (value: SMSSegmentedStatusFilterValue) => {
    if (usesServerSideStatus) {
      onControlledStatusFilterChange?.(value);
    } else {
      setInternalStatusFilter(value);
      if (serverPagination) {
        serverPagination.onPageChange(1);
      }
    }
  };
  const isActiveView = effectiveStatusFilter === 'active';
  const isInactiveView = effectiveStatusFilter === 'inactive';

  /** Server-paged grid + local Active/Inactive: footer must use filtered row count, not API total (see Business Type / Skills). */
  const clientStatusFilterOnServerGrid = Boolean(
    serverPagination && !usesServerSideStatus && effectiveStatusFilter !== null
  );

  /** Apply status filter in the UI even when the parent also passes `isActive` to the API — keeps tabs correct if the server ignores or mis-filters. */
  const filteredItems = useMemo(() => {
    if (effectiveStatusFilter === null) return items;
    return effectiveStatusFilter === 'inactive'
      ? items.filter((r) => !getStatus(r))
      : items.filter((r) => getStatus(r));
  }, [items, effectiveStatusFilter, getStatus]);

  useEffect(() => {
    if (serverPagination || usesServerSideStatus) return;
    pagination.setTotalItems(filteredItems.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems.length, serverPagination, usesServerSideStatus]);

  useEffect(() => {
    if (serverPagination || usesServerSideStatus) return;
    pagination.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStatusFilter, serverPagination, usesServerSideStatus]);

  const handleAddClick = () => {
    if (isControlled && onOpenAdd) {
      onOpenAdd();
      return;
    }
    setInternalEditingRow(null);
    setInternalModalOpen(true);
  };

  const handleEditClick = (row: T) => {
    if (isRowReadOnly?.(row)) return;
    if (isControlled && onOpenEdit && getId) {
      onOpenEdit(getId(row));
      return;
    }
    setInternalEditingRow(row);
    setInternalModalOpen(true);
  };

  const handleDeleteClick = (row: T) => {
    if (isRowReadOnly?.(row)) return;
    setDeletingRow(row);
  };

  const handleModalClose = () => {
    if (isControlled && onModalClose) {
      onModalClose();
      return;
    }
    setInternalModalOpen(false);
    setInternalEditingRow(null);
  };

  const handleFormSuccess = () => {
    onRefresh();
    if (isControlled && onModalClose) {
      onModalClose();
      return;
    }
    setInternalModalOpen(false);
    setInternalEditingRow(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRow || !onDeleteProp) return;
    try {
      await onDeleteProp(deletingRow);
      setDeletingRow(null);
      onRefresh();
    } catch (error) {
      // Error is already surfaced by the slice (e.g. toast). Log for debugging; do not show alert.
      // eslint-disable-next-line no-console
      console.error('Error deleting item:', error);
      setDeletingRow(null);
    }
  };

  const handleDeleteCancel = () => setDeletingRow(null);

  const handleMoveUp = async (row: T, currentIndex: number) => {
    if (currentIndex <= 0 || !onMoveUp || !getId) return;
    
    try {
      // When moving up, the new rank is the current index (1-based)
      // Example: item at index 1 (rank 2) moves to index 0 (rank 1)
      const newRank = currentIndex; // 1-based rank
      await onMoveUp(row, newRank);
      // Refresh the list to get the updated order from backend
      onRefresh();
    } catch (error) {
      console.error('Error moving item up:', error);
      // Error handling can be added here (e.g., show toast)
    }
  };

  const handleMoveDown = async (row: T, currentIndex: number) => {
    if (currentIndex >= filteredItems.length - 1 || !onMoveDown || !getId) return;
    
    try {
      // When moving down, the new rank is currentIndex + 2 (1-based)
      // Example: item at index 0 (rank 1) moves to index 1 (rank 2)
      const newRank = currentIndex + 2; // 1-based rank
      await onMoveDown(row, newRank);
      // Refresh the list to get the updated order from backend
      onRefresh();
    } catch (error) {
      console.error('Error moving item down:', error);
      // Error handling can be added here (e.g., show toast)
    }
  };

  const useDragReorder = Boolean(onMoveUp && onMoveDown && getId);

  const handleReorder = async (
    fromIndex: number,
    toIndex: number,
    fromId?: string,
    toId?: string
  ) => {
    if (sortableDragDisabled || !onMoveUp || !pagination) return;
    const pageStart = (pagination.currentPage - 1) * pagination.pageSize;
    const items = filteredItems;

    const resolveGlobalIndex = (displayIndex: number, id?: string): number => {
      if (getId && id) {
        const i = items.findIndex((r) => getId(r) === id);
        if (i >= 0) return i;
      }
      return pageStart + displayIndex;
    };

    const globalFrom = resolveGlobalIndex(fromIndex, fromId);
    const globalTo = resolveGlobalIndex(toIndex, toId);

    if (
      globalFrom < 0 ||
      globalTo < 0 ||
      globalFrom >= items.length ||
      globalTo >= items.length
    ) {
      return;
    }

    const row = items[globalFrom];
    if (!row) return;
    const toRow = items[globalTo];
    if (
      toRow &&
      getReorderRank &&
      getReorderRank(row) === getReorderRank(toRow)
    ) {
      return;
    }

    const rankBlock = (gi: number) => {
      if (!getRankForReorder || gi < 0 || gi >= items.length) {
        return { start: gi, end: gi };
      }
      const r = getRankForReorder(items[gi]);
      let s = gi;
      while (s > 0 && getRankForReorder(items[s - 1]) === r) s--;
      let e = gi;
      while (e < items.length - 1 && getRankForReorder(items[e + 1]) === r) e++;
      return { start: s, end: e };
    };

    try {
      if (!getRankForReorder) {
        const n = items.length;
        const order = Array.from({ length: n }, (_, i) => i);
        const newOrder = arrayMove(order, globalFrom, globalTo);
        const newPos = newOrder.indexOf(globalFrom);
        const atDisplayRow = newPos + 1;
        await onMoveUp(row, atDisplayRow, { atDisplayRow });
        onRefresh();
        return;
      }

      const fromB = rankBlock(globalFrom);
      const toB = rankBlock(globalTo);
      if (fromB.start === toB.start && fromB.end === toB.end) {
        return;
      }

      const moving = items.slice(fromB.start, fromB.end + 1);
      const k = moving.length;

      let dropTarget = globalTo;
      if (toB.end > toB.start && globalTo > toB.start) {
        dropTarget = toB.start;
      }

      const arr = [...items];
      arr.splice(fromB.start, k);
      // Same "drop row slot" semantics as the single-row branch (not arrayMove / insert-after).
      let targetPos: number;
      if (dropTarget <= fromB.start) {
        targetPos = dropTarget;
      } else if (dropTarget <= fromB.end) {
        targetPos = Math.min(dropTarget, arr.length);
      } else if (dropTarget === fromB.end + 1) {
        targetPos = dropTarget - (k - 1);
      } else {
        targetPos = dropTarget - k;
      }
      targetPos = Math.max(0, Math.min(targetPos, arr.length));
      arr.splice(targetPos, 0, ...moving);

      const total = moving.length;
      for (let i = 0; i < total; i++) {
        const oneBasedRow = targetPos + i + 1;
        await onMoveUp(moving[i], oneBasedRow, {
          atDisplayRow: oneBasedRow,
          batchIndex: i,
          batchTotal: total,
        });
      }
      onRefresh();
    } catch (error) {
      console.error('Error reordering item:', error);
    }
  };

  const mutedText = (text: string, rowReadOnly = false) => (
    <SMSTypography 
      variant="body2" 
      className={
        rowReadOnly
          ? 'master-data-list-muted-text-readonly'
          : isInactiveView
            ? 'master-data-list-muted-text-inactive'
            : 'master-data-list-muted-text'
      }
    >
      {text}
    </SMSTypography>
  );

  const formatDate = (value: string | null | undefined): string => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  };


  const renderUserStamp = (name: string | null | undefined, date: string | null | undefined) => (
    <SMSBox 
      className="master-data-list-stamp"
      title={formatTime(date, '-')}
    >
      <SMSStack spacing={0.25}>
        <SMSTypography variant="body2" className="master-data-list-stamp-name">
          {name?.trim() || '-'}
        </SMSTypography>
        <SMSTypography 
          variant="caption" 
          className="master-data-list-stamp-date"
        >
          {formatDate(date)}
        </SMSTypography>
        <SMSTypography
          className="master-data-list-stamp-time-tooltip"
          variant="caption"
        >
          {formatTime(date, '-')}
        </SMSTypography>
      </SMSStack>
    </SMSBox>
  );

  const renderStatus = (isActive: boolean) => (
    <SMSChip
      label={isActive ? strings.TABLE.FILTERS.ACTIVE : strings.TABLE.FILTERS.INACTIVE}
      className={`master-data-list-status-chip ${isActive ? 'master-data-list-status-chip-active' : 'master-data-list-status-chip-inactive'}`}
    />
  );

  type DisplayRow = {
    __raw: T;
    __readOnly: boolean;
    short: string;
    long: string;
    status: boolean;
    createdBy: string;
    createdDate?: string | null;
    editedBy: string;
    editedDate?: string | null;
    [key: string]: any;
  };

  const tableRows = useMemo<DisplayRow[]>(() => {
    return filteredItems.map((r) => {
      const row: DisplayRow = {
        __raw: r,
        __readOnly: Boolean(isRowReadOnly?.(r)),
        short: String(getShort(r) ?? ''),
        long: String(getLong(r) ?? ''),
        status: Boolean(getStatus(r)),
        createdBy: String(getCreatedBy(r) ?? ''),
        createdDate: getCreatedDate(r),
        editedBy: String(getEditedBy(r) ?? ''),
        editedDate: getEditedDate(r),
      };

      // Populate extra column values by key from the raw item (when present)
      for (const c of extraColumns) {
        row[c.key] = (r as any)?.[c.key];
      }

      return row;
    });
  }, [
    filteredItems,
    getShort,
    getLong,
    getStatus,
    getCreatedBy,
    getCreatedDate,
    getEditedBy,
    getEditedDate,
    extraColumns,
    isRowReadOnly,
  ]);

  const searchableColumns = useMemo(() => {
    const columns = ['short', 'long', ...extraColumns.map((c) => c.key)] as Array<
      keyof DisplayRow | string
    >;
    if (showAuditColumns) {
      columns.push('createdBy', 'editedBy');
    }
    return columns;
  }, [extraColumns, showAuditColumns]);

  const tableColumns = [
    {
      key: 'short',
      label: strings.TABLE.COLUMNS.TITLE,
      render: (value: unknown, row: DisplayRow) => mutedText(String(value ?? ''), row.__readOnly),
    },
    {
      key: 'long',
      label: strings.TABLE.COLUMNS.DESCRIPTION,
      render: (value: unknown, row: DisplayRow) => mutedText(String(value ?? ''), row.__readOnly),
    },
    ...extraColumns.map((c) => ({
      key: c.key,
      label: c.label,
        render: (value: any, row: DisplayRow) => {
        const node = c.render ? c.render(value, row.__raw) : mutedText(String(value ?? ''));
        return isInactiveView && c.mutedWhenInactive ? (
          <SMSTypography variant="body2" className="master-data-list-muted-text-inactive">
            {node}
          </SMSTypography>
        ) : (
          node
        );
      },
    })),
    ...(showStatusColumn
      ? [{
          key: 'status',
          label: strings.TABLE.COLUMNS.STATUS,
          render: (value: unknown) => renderStatus(Boolean(value)),
        }]
      : []),
    ...(showAuditColumns ? [
      {
        key: 'createdBy',
        label: strings.TABLE.COLUMNS.CREATED_BY,
        render: (_value: unknown, row: DisplayRow) => renderUserStamp(row.createdBy, row.createdDate),
      },
      {
        key: 'editedBy',
        label: strings.TABLE.COLUMNS.EDITED_BY,
        render: (_value: unknown, row: DisplayRow) => renderUserStamp(row.editedBy, row.editedDate),
      },
    ] : []),
    ...(!readOnly
      ? [
          {
            key: 'action',
            label: strings.TABLE.COLUMNS.ACTION,
            render: (_value: unknown, row: DisplayRow) => {
              const isRowActive = row.status;
              const rowReadOnly = row.__readOnly;
              const showArrows = !useDragReorder && isActiveView && isRowActive && onMoveUp && onMoveDown && getId && !rowReadOnly;
              const currentIndex = filteredItems.findIndex((item) => item === row.__raw);
              const canMoveUp = showArrows && currentIndex > 0;
              const canMoveDown = showArrows && currentIndex < filteredItems.length - 1;

              return (
                <SMSStack direction="row" spacing={1} alignItems="center" className="master-data-list-action-group">
                  {showArrows && (
                    <>
                      <SMSIconButton
                        size="small"
                        tone="default"
                        onClick={() => handleMoveUp(row.__raw, currentIndex)}
                        title="Move up"
                        aria-label="Move up"
                        disabled={!canMoveUp}
                        className="master-data-list-action-button"
                      >
                        <SMSIcon name="arrow-up" size="sm" />
                      </SMSIconButton>
                      <SMSIconButton
                        size="small"
                        tone="default"
                        onClick={() => handleMoveDown(row.__raw, currentIndex)}
                        title="Move down"
                        aria-label="Move down"
                        disabled={!canMoveDown}
                        className="master-data-list-action-button"
                      >
                        <SMSIcon name="arrow-down" size="sm" />
                      </SMSIconButton>
                    </>
                  )}
                  <SMSStack direction="row" alignItems="center" className="master-data-list-action-buttons">
                    <SMSIconButton
                      size="small"
                      tone="primary"
                      onClick={() => handleEditClick(row.__raw)}
                      title={strings.BUTTON.EDIT}
                      aria-label={strings.BUTTON.EDIT}
                      disabled={rowReadOnly}
                      className="master-data-list-action-button"
                    >
                      <SMSIcon name="edit" size="sm" />
                    </SMSIconButton>
                    {onDeleteProp && deleteConfirm && (
                      <SMSIconButton
                        size="small"
                        tone="error"
                        onClick={() => handleDeleteClick(row.__raw)}
                        title={strings.BUTTON.DELETE}
                        aria-label={strings.BUTTON.DELETE}
                        disabled={rowReadOnly}
                        className="master-data-list-action-button"
                      >
                        <SMSIcon name="delete" size="sm" />
                      </SMSIconButton>
                    )}
                  </SMSStack>
                </SMSStack>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <SMSBox className={`master-data-list ${className}`}>
      <SMSStack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center" 
        spacing={2}
        className="master-data-list-header"
      >
        <SMSTypography 
          variant="h4" 
          component="h1"
          className="master-data-list-title"
        >
          {strings.TABLE.TITLE}
        </SMSTypography>
        {!readOnly && (
          <SMSButton 
            onClick={handleAddClick}
            startIcon={<SMSIcon name="plus" size="sm" />}
          >
            {strings.BUTTON.ADD_NEW}
          </SMSButton>
        )}
      </SMSStack>

      <SMSDataTableWrapper<DisplayRow>
        className="master-data-list__table-card"
        sx={{ width: '100%', overflow: 'hidden' }}
        renderEmptyAsTable
        columns={tableColumns as any}
        data={tableRows}
        emptyMessage={strings.TABLE.NO_DATA}
        loading={loading}
        showHeaderWhenEmpty
        tableClassName="master-data-list-table"
        searchable
        searchValue={searchValueProp}
        onSearchChange={onSearchChangeProp}
        searchableColumns={searchableColumns}
        sortableRowId={useDragReorder ? (r) => getId!(r.__raw) : undefined}
        onReorder={useDragReorder ? handleReorder : undefined}
        sortableDragDisabled={sortableDragDisabled}
        getRowClassName={(row) => (row.__readOnly ? 'master-data-list-row--readonly' : undefined)}
        maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
        responsiveMode="table"
        toolbar={
          enableStatusFilter ? (
            <SMSSegmentedStatusFilter
              className="master-data-list-toolbar"
              value={
                usesServerSideStatus
                  ? controlledStatusFilter === undefined
                    ? 'active'
                    : controlledStatusFilter
                  : internalStatusFilter
              }
              onChange={handleSegmentStatusChange}
              activeLabel={strings.TABLE.FILTERS.ACTIVE}
              inactiveLabel={strings.TABLE.FILTERS.INACTIVE}
              allowClear
              ariaLabel="Status filter"
            />
          ) : undefined
        }
        pagination={
          serverPagination
            ? {
                currentPage: serverPagination.currentPage,
                pageSize: serverPagination.pageSize,
                totalItems: clientStatusFilterOnServerGrid
                  ? filteredItems.length
                  : serverPagination.totalItems,
                serverSide: true,
                onPageChange: serverPagination.onPageChange,
                onPageSizeChange: serverPagination.onPageSizeChange,
              }
            : {
                currentPage: pagination.currentPage,
                pageSize: pagination.pageSize,
                totalItems: pagination.totalItems,
                onPageChange: (page) => pagination.goToPage(page),
                onPageSizeChange: (newPageSize) => {
                  pagination.setPageSize(newPageSize);
                  pagination.goToFirstPage();
                },
              }
        }
      />

      <SMSDialog
        open={isModalOpen}
        onClose={handleModalClose}
        maxWidth="md"
        fullWidth
      >
        <SMSStandardDialogHeader
          title={editingRow ? strings.EDIT_TITLE : strings.TITLE}
          onClose={handleModalClose}
        />
        <SMSDialogContent>
        <FormComponent
          key={editingRow ? (getId?.(editingRow) ?? 'edit') : 'add'}
          initialData={editingRow}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
        </SMSDialogContent>
      </SMSDialog>

      {onDeleteProp && deleteConfirm ? (
        <SMSConfirmDialog
          open={!!deletingRow}
          title={deleteConfirm.DELETE_TITLE}
          message={deleteConfirm.DELETE_MESSAGE}
          confirmText={deleteConfirm.DELETE_CONFIRM}
          cancelText={deleteConfirm.DELETE_CANCEL}
          onConfirm={handleDeleteConfirm}
          onClose={handleDeleteCancel}
          variant="error"
        />
      ) : null}
    </SMSBox>
  );
}


