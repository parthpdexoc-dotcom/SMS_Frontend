import { SMSPagination } from '@/components/smsatoms';
import type { SMSPaginationProps } from '@/components/smsatoms';
import type { CardProps } from '@mui/material/Card';
import type { ReactNode } from 'react';
import React, { useState, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import { SMSCard, SMSIcon, SMSLoader } from '@/components/smsatoms';
import { SMSEmptyState, SMSLoadingState, SMSErrorState } from '@/components/smsmolecules';
import { BaseComponentProps } from '@/types';
import { MESSAGES, SEARCH } from '@/constants/strings';
import './SMSDataTable.css';

/** Below this width, `responsiveMode="auto"` uses stacked cards (phones + tablets). */
const AUTO_CARDS_MAX_WIDTH_PX = 900;

// --- Shared types (column definitions, pagination) ---------------------------------------------

export type DataTableColumnAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<T = any> {
  key: keyof T | string;
  label: React.ReactNode;
  render?: (value: any, row: T) => React.ReactNode;
  /**
   * Header + body alignment. When omitted, alignment is inferred from the column key
   * (`status`, `created`, or `edited` substrings default to center). Keys `action` / `actions`
   * are always centered; `align` cannot override those.
   */
  align?: DataTableColumnAlign;
  /** When true, cell content is not line-clamped (e.g. status pills in horizontally scrollable tables). */
  noClamp?: boolean;
}

/** Resolved alignment for a column (explicit `align` or key-based default). */
export function resolveDataTableColumnAlign(column: DataTableColumn<any>): DataTableColumnAlign {
  const keyStr = String(column.key).toLowerCase();
  /** App-wide: Action / Actions columns stay visually centered (header + cell). */
  if (keyStr === 'action' || keyStr === 'actions') {
    return 'center';
  }
  const a = column.align;
  if (a === 'left' || a === 'center' || a === 'right') {
    return a;
  }
  const centerByKey =
    keyStr.includes('status') || keyStr.includes('created') || keyStr.includes('edited');
  return centerByKey ? 'center' : 'left';
}

function dataTableAlignClass(kind: 'th' | 'td' | 'cell', align: DataTableColumnAlign): string {
  return `data-table__${kind}--align-${align}`;
}

export type PaginationProps = Pick<
  SMSPaginationProps,
  'currentPage' | 'pageSize' | 'totalItems' | 'onPageChange' | 'onPageSizeChange'
> & {
  serverSide?: boolean;
};

/** Core table UI props (toolbar, search, pagination, drag reorder). */
export interface SMSDataTableInnerProps<T = any> extends BaseComponentProps {
  columns: DataTableColumn<T>[];
  data: T[];
  title?: string | React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  /**
   * When true with `loading`, keep the table header (and pagination chrome) mounted
   * and only replace the body with a loading indicator.
   */
  preserveStructureWhileLoading?: boolean;
  pagination?: PaginationProps;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchableColumns?: (keyof T | string)[];
  toolbar?: React.ReactNode;
  maxBodyHeight?: number | string;
  /**
   * - `auto`: card vs table from viewport or container width (see `responsiveAutoMeasure`).
   * - `table`: always table.
   * - `cards`: always stacked cards.
   */
  responsiveMode?: 'auto' | 'table' | 'cards';
  /** Used when `responsiveMode` is `auto`. Default 900 (see `AUTO_CARDS_MAX_WIDTH_PX`). */
  responsiveAutoMaxWidthPx?: number;
  /**
   * When `auto`, choose how width is measured:
   * - `viewport`: matchMedia on window width (legacy behavior).
   * - `container`: ResizeObserver on the table root — use when the grid sits in a narrow main column.
   */
  responsiveAutoMeasure?: 'viewport' | 'container';
  showHeaderWhenEmpty?: boolean;
  sortableRowId?: (row: T) => string;
  useCardWrapper?: boolean;
  /** Optional `fromId` / `toId` match `sortableRowId` and map to the full `data` list even when search filters rows. */
  onReorder?: (fromIndex: number, toIndex: number, fromId?: string, toId?: string) => void;
  /** When true with sortable columns, drag handles stay visible but are non-interactive (e.g. suspended user). */
  sortableDragDisabled?: boolean;
  getRowKey?: (row: T) => string | number;
  /** Appends extra class names to each body row (table) or card (responsive cards layout). */
  getRowClassName?: (row: T) => string | undefined;
  /** Called when a body row is clicked (not fired for header/empty rows). */
  onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  searchAppliedOnServer?: boolean;
}

/** @deprecated Use `SMSDataTableInnerProps` — kept for legacy `DataTable` imports */
export type DataTableProps<T = any> = SMSDataTableInnerProps<T>;

// --- Sortable row -------------------------------------------------------------------------------

function SortableTableRow<T extends Record<string, any>>({
  id,
  row,
  columns,
  getValue,
  dragDisabled,
  rowClassName,
}: {
  id: string;
  row: T;
  columns: DataTableColumn<T>[];
  getValue: (row: T, key: keyof T | string) => any;
  dragDisabled?: boolean;
  rowClassName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: Boolean(dragDisabled),
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <tr
      ref={setNodeRef}
      className={['data-table__tr', rowClassName].filter(Boolean).join(' ')}
      style={style}
    >
      <td className="data-table__td data-table__drag-cell">
        <span
          className={
            dragDisabled
              ? 'data-table__drag-handle data-table__drag-handle--disabled'
              : 'data-table__drag-handle'
          }
          {...(dragDisabled ? {} : listeners)}
          {...(dragDisabled ? {} : attributes)}
          role={dragDisabled ? undefined : 'button'}
          tabIndex={dragDisabled ? undefined : 0}
          aria-label={dragDisabled ? 'Reorder unavailable' : 'Drag to reorder'}
          aria-disabled={dragDisabled ? true : undefined}
        >
          <SMSIcon name="drag_indicator" size="sm" />
        </span>
      </td>
      {columns.map((column) => {
        const value = getValue(row, column.key);
        const keyStr = String(column.key).toLowerCase();
        const keyClass = `data-table__col--${keyStr.replace(/[^a-z0-9_-]/g, '-')}`;
        const align = resolveDataTableColumnAlign(column);
        // "postPositionStatus" contains "status" but uses a wrapping pill — do not use no-clamp (overflow: visible) or it overlaps the next column.
        const noClamp =
          column.noClamp === true ||
          keyStr.includes('action') ||
          (keyStr.includes('status') && keyStr !== 'postpositionstatus') ||
          keyStr.includes('created') ||
          keyStr.includes('edited');
        const isNarrow = keyStr === 'rank' || keyStr === 'status';
        const tooltip =
          !noClamp && (typeof value === 'string' || typeof value === 'number')
            ? String(value)
            : undefined;
        return (
          <td
            key={String(column.key)}
            className={`data-table__td ${dataTableAlignClass('td', align)} ${
              isNarrow ? 'data-table__td--narrow' : ''
            } ${keyClass}`}
          >
            <div
              className={`data-table__cell ${dataTableAlignClass('cell', align)} ${
                noClamp ? 'data-table__cell--no-clamp' : ''
              }`}
              title={tooltip}
            >
              {column.render
                ? column.render(value, row)
                : value !== null && value !== undefined
                  ? String(value)
                  : '-'}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

// --- Core table (formerly `DataTable`) ----------------------------------------------------------

export const SMSDataTableInner = <T extends Record<string, any>>({
  columns,
  data,
  title,
  emptyMessage = 'No data available',
  loading = false,
  preserveStructureWhileLoading = false,
  pagination,
  searchable = false,
  searchPlaceholder = SEARCH.PLACEHOLDER_TABLE,
  searchValue: controlledSearchValue,
  onSearchChange: onSearchChangeProp,
  searchableColumns,
  toolbar,
  maxBodyHeight,
  responsiveMode = 'auto',
  showHeaderWhenEmpty = false,
  sortableRowId,
  onReorder,
  sortableDragDisabled = false,
  getRowKey,
  getRowClassName,
  onRowClick,
  useCardWrapper = true,
  className = '',
  searchAppliedOnServer = false,
  responsiveAutoMaxWidthPx,
  responsiveAutoMeasure = 'viewport',
}: SMSDataTableInnerProps<T>) => {
  const isScrollable = maxBodyHeight !== undefined;
  const [internalSearch, setInternalSearch] = useState('');
  const isControlledSearch = controlledSearchValue !== undefined && onSearchChangeProp !== undefined;
  const searchQuery = isControlledSearch ? (controlledSearchValue ?? '') : internalSearch;
  const setSearchQuery = isControlledSearch
    ? (v: string) => onSearchChangeProp?.(v)
    : setInternalSearch;
  /** When true and `responsiveMode` is `auto`, render card rows instead of a wide table. */
  const [useAutoCardLayout, setUseAutoCardLayout] = useState(false);
  const autoLayoutRootRef = useRef<HTMLDivElement | null>(null);
  const autoMaxPx = responsiveAutoMaxWidthPx ?? AUTO_CARDS_MAX_WIDTH_PX;

  useEffect(() => {
    if (responsiveMode !== 'auto' || responsiveAutoMeasure !== 'viewport') {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${autoMaxPx}px)`);
    const update = () => setUseAutoCardLayout(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [responsiveMode, responsiveAutoMeasure, autoMaxPx]);

  useLayoutEffect(() => {
    if (responsiveMode !== 'auto' || responsiveAutoMeasure !== 'container') {
      return;
    }
    const el = autoLayoutRootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const apply = (width: number) => {
      if (width <= 0) {
        return;
      }
      setUseAutoCardLayout(width <= autoMaxPx);
    };
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      apply(w);
    });
    ro.observe(el);
    apply(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [responsiveMode, responsiveAutoMeasure, autoMaxPx]);

  React.useEffect(() => {
    if (searchable && !isControlledSearch && searchQuery.trim() && pagination && pagination.currentPage > 1) {
      pagination.onPageChange(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isControlledSearch]);

  const getValue = (row: T, key: keyof T | string): any => {
    if (typeof key === 'string' && key.includes('.')) {
      return key.split('.').reduce((obj, k) => obj?.[k], row as any);
    }
    return row[key as keyof T];
  };

  const filteredData = useMemo(() => {
    // Controlled search with server-side pagination (or explicit server search) is API-driven;
    // avoid client-side filtering to prevent double filtering.
    const skipClientTextFilter =
      !searchQuery.trim() ||
      (isControlledSearch &&
        (Boolean(pagination?.serverSide) || Boolean(searchAppliedOnServer)));
    if (!searchable || skipClientTextFilter) {
      return data;
    }

    const query = searchQuery.toLowerCase().trim();
    const columnsToSearch = searchableColumns || columns.map((col) => col.key);

    return data.filter((row) => {
      return columnsToSearch.some((columnKey) => {
        const value = getValue(row, columnKey);
        if (value === null || value === undefined) {
          return false;
        }
        const stringValue = String(value).toLowerCase();
        return stringValue.includes(query);
      });
    });
  }, [data, searchQuery, searchable, searchableColumns, columns, isControlledSearch, pagination?.serverSide, searchAppliedOnServer]);

  const effectiveTotalItems = pagination ? pagination.totalItems : filteredData.length;

  const paginatedData = useMemo(() => {
    if (!pagination) {
      return filteredData;
    }
    if (pagination.serverSide) {
      return filteredData;
    }
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, pagination]);

  const displayData = pagination ? paginatedData : filteredData;

  const effectiveResponsiveMode =
    responsiveMode === 'auto' ? (useAutoCardLayout ? 'cards' : 'table') : responsiveMode;

  const isSortable = Boolean(sortableRowId && onReorder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (sortableDragDisabled) return;
      const { active, over } = event;
      if (!onReorder || !over || active.id === over.id) return;
      const fromIndex = displayData.findIndex((row) => sortableRowId!(row) === active.id);
      const toIndex = displayData.findIndex((row) => sortableRowId!(row) === over.id);
      if (fromIndex === -1 || toIndex === -1) return;
      onReorder(fromIndex, toIndex, String(active.id), String(over.id));
    },
    [displayData, onReorder, sortableRowId, sortableDragDisabled]
  );

  const tableVerticalScrollStyle: React.CSSProperties | undefined =
    maxBodyHeight !== undefined
      ? {
          maxHeight: typeof maxBodyHeight === 'number' ? `${maxBodyHeight}px` : maxBodyHeight,
          overflowY: 'auto',
        }
      : undefined;

  const content = (
    <>
      {title && <h3 className="data-table__title">{title}</h3>}

      {(searchable || toolbar) && (
        <div className="data-table__toolbar">
          {searchable && (
            <div className="data-table__search">
              <SearchFilter
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {toolbar && <div className="data-table__toolbar-right">{toolbar}</div>}
        </div>
      )}

      {loading && !preserveStructureWhileLoading ? (
        <div className="data-table__loading">
          <SMSLoader loadingText={MESSAGES.LOADING} aria-label={MESSAGES.LOADING} />
        </div>
      ) : displayData.length === 0 && !showHeaderWhenEmpty && !(loading && preserveStructureWhileLoading) ? (
        <div className="data-table__empty">
          {searchQuery.trim() ? SEARCH.NO_RESULTS : emptyMessage}
        </div>
      ) : (
        <>
          {effectiveResponsiveMode === 'cards' && displayData.length > 0 && !(loading && preserveStructureWhileLoading) ? (
            <div className="data-table__cards" style={tableVerticalScrollStyle}>
              {displayData.map((row, rowIndex) => (
                <div
                  key={getRowKey != null ? String(getRowKey(row)) : rowIndex}
                  className={['data-table__card', getRowClassName?.(row)].filter(Boolean).join(' ')}
                >
                  {columns.map((column) => {
                    const value = getValue(row, column.key);
                    const rendered = column.render
                      ? column.render(value, row)
                      : value !== null && value !== undefined
                        ? String(value)
                        : '-';

                    return (
                      <div key={String(column.key)} className="data-table__card-row">
                        <div className="data-table__card-label">{column.label}</div>
                        <div className="data-table__card-value">{rendered}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const tableSection = isSortable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <table className="data-table__table">
                    <thead className="data-table__thead">
                      <tr className="data-table__tr">
                        <th className="data-table__th data-table__th--drag" aria-label="Reorder" />
                        {columns.map((column) => {
                          const keyStr = String(column.key).toLowerCase();
                          const keyClass = `data-table__col--${keyStr.replace(/[^a-z0-9_-]/g, '-')}`;
                          const align = resolveDataTableColumnAlign(column);
                          const isNarrow = keyStr === 'rank' || keyStr === 'status';
                          return (
                            <th
                              key={String(column.key)}
                              className={`data-table__th ${dataTableAlignClass('th', align)} ${
                                isNarrow ? 'data-table__th--narrow' : ''
                              } ${keyClass}`}
                            >
                              <span className="data-table__th-label">{column.label}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="data-table__tbody">
                      {displayData.length === 0 && showHeaderWhenEmpty ? (
                        <tr className="data-table__tr">
                          <td className="data-table__td data-table__empty-cell" />
                          <td
                            colSpan={columns.length}
                            className="data-table__td data-table__empty-cell"
                          >
                            {searchQuery.trim() ? SEARCH.NO_RESULTS : emptyMessage}
                          </td>
                        </tr>
                      ) : (
                        <SortableContext
                          items={displayData.map((row) => sortableRowId!(row))}
                          strategy={verticalListSortingStrategy}
                        >
                          {displayData.map((row) => (
                            <SortableTableRow
                              key={sortableRowId!(row)}
                              id={sortableRowId!(row)}
                              row={row}
                              columns={columns}
                              getValue={getValue}
                              dragDisabled={sortableDragDisabled}
                              rowClassName={getRowClassName?.(row)}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </tbody>
                  </table>
                </DndContext>
              ) : (
                <table className="data-table__table">
                  <thead className="data-table__thead">
                    <tr className="data-table__tr">
                      {columns.map((column) => {
                        const keyStr = String(column.key).toLowerCase();
                        const keyClass = `data-table__col--${keyStr.replace(/[^a-z0-9_-]/g, '-')}`;
                        const align = resolveDataTableColumnAlign(column);
                        const isNarrow = keyStr === 'rank' || keyStr === 'status';
                        return (
                          <th
                            key={String(column.key)}
                            className={`data-table__th ${dataTableAlignClass('th', align)} ${
                              isNarrow ? 'data-table__th--narrow' : ''
                            } ${keyClass}`}
                          >
                            <span className="data-table__th-label">{column.label}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="data-table__tbody">
                    {loading && preserveStructureWhileLoading ? (
                      <tr className="data-table__tr">
                        <td
                          colSpan={columns.length}
                          className="data-table__td data-table__loading-cell"
                        >
                          <div className="data-table__loading data-table__loading--inline">
                            <SMSLoader loadingText={MESSAGES.LOADING} aria-label={MESSAGES.LOADING} />
                          </div>
                        </td>
                      </tr>
                    ) : displayData.length === 0 && showHeaderWhenEmpty ? (
                      <tr className="data-table__tr">
                        <td
                          colSpan={columns.length}
                          className="data-table__td data-table__empty-cell"
                        >
                          {searchQuery.trim() ? SEARCH.NO_RESULTS : emptyMessage}
                        </td>
                      </tr>
                    ) : (
                      displayData.map((row, rowIndex) => (
                        <tr
                          key={getRowKey != null ? String(getRowKey(row)) : rowIndex}
                          className={['data-table__tr', getRowClassName?.(row)].filter(Boolean).join(' ')}
                          onClick={
                            onRowClick
                              ? (event) => {
                                  onRowClick(row, event);
                                }
                              : undefined
                          }
                        >
                          {columns.map((column) => {
                            const value = getValue(row, column.key);
                            const keyStr = String(column.key).toLowerCase();
                            const keyClass = `data-table__col--${keyStr.replace(/[^a-z0-9_-]/g, '-')}`;
                            const align = resolveDataTableColumnAlign(column);
                            const noClamp =
                              column.noClamp === true ||
                              keyStr.includes('action') ||
                              (keyStr.includes('status') && keyStr !== 'postpositionstatus') ||
                              keyStr.includes('created') ||
                              keyStr.includes('edited');
                            const isNarrow = keyStr === 'rank' || keyStr === 'status';
                            const tooltip =
                              !noClamp && (typeof value === 'string' || typeof value === 'number')
                                ? String(value)
                                : undefined;
                            return (
                              <td
                                key={String(column.key)}
                                className={`data-table__td ${dataTableAlignClass('td', align)} ${
                                  isNarrow ? 'data-table__td--narrow' : ''
                                } ${keyClass}`}
                              >
                                <div
                                  className={`data-table__cell ${dataTableAlignClass('cell', align)} ${
                                    noClamp ? 'data-table__cell--no-clamp' : ''
                                  }`}
                                  title={tooltip}
                                >
                                  {column.render
                                    ? column.render(value, row)
                                    : value !== null && value !== undefined
                                      ? String(value)
                                      : '-'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              );

              return (
                <div
                  className={['data-table__container', isScrollable ? 'data-table__container--scroll-split' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {isScrollable ? (
                    <div className="data-table__scroll-x">
                      <div className="data-table__scroll-y" style={tableVerticalScrollStyle}>
                        {tableSection}
                      </div>
                    </div>
                  ) : (
                    tableSection
                  )}
                </div>
              );
            })()
          )}

          {pagination &&
            (effectiveTotalItems > 0 || (loading && preserveStructureWhileLoading)) && (
            <SMSPagination
              className="sms-pagination"
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              totalItems={effectiveTotalItems}
              onPageChange={pagination.onPageChange}
              onPageSizeChange={pagination.onPageSizeChange}
              loading={loading}
              variant="full"
            />
          )}
        </>
      )}
    </>
  );

  const wrapperClassName = [
    'data-table',
    isScrollable ? 'data-table--scrollable' : '',
    `data-table--mode-${effectiveResponsiveMode}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (!useCardWrapper) {
    return (
      <div
        ref={
          responsiveMode === 'auto' && responsiveAutoMeasure === 'container'
            ? autoLayoutRootRef
            : undefined
        }
        className={wrapperClassName}
        data-sms-table-layout={effectiveResponsiveMode}
      >
        {content}
      </div>
    );
  }

  return (
    <SMSCard className={wrapperClassName} padding="lg">
      {content}
    </SMSCard>
  );
};

/** @deprecated Prefer `SMSDataTableInner` — legacy name */
export const DataTable = SMSDataTableInner;

// --- SMS shell: card + loading / empty / error --------------------------------------------------

export interface SMSDataTableWrapperProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  /**
   * When true with `loading`, keep table headers mounted and only replace the body.
   */
  preserveStructureWhileLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyIcon?: string;
  /** Override color for the empty-state message text (e.g. 'error.main'). */
  emptyMessageColor?: string;
  onRetry?: () => void;
  showHeaderWhenEmpty?: boolean;
  maxBodyHeight?: string | number;
  pagination?: PaginationProps;
  getRowKey?: (row: T) => string | number;
  getRowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  responsiveMode?: 'auto' | 'table' | 'cards';
  responsiveAutoMaxWidthPx?: number;
  responsiveAutoMeasure?: 'viewport' | 'container';
  className?: string;
  sx?: CardProps['sx'];
  renderEmptyAsTable?: boolean;
  title?: string | ReactNode;
  toolbar?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchableColumns?: (keyof T | string)[];
  sortableRowId?: (row: T) => string;
  onReorder?: (fromIndex: number, toIndex: number, fromId?: string, toId?: string) => void;
  sortableDragDisabled?: boolean;
  tableClassName?: string;
  embedded?: boolean;
  searchAppliedOnServer?: boolean;
}

export const SMSDataTableWrapper = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  preserveStructureWhileLoading = false,
  error,
  emptyMessage = 'No data available',
  emptyTitle = '',
  emptyIcon = 'calendar',
  emptyMessageColor,
  onRetry,
  showHeaderWhenEmpty = true,
  maxBodyHeight,
  pagination,
  getRowKey,
  getRowClassName,
  onRowClick,
  responsiveMode = 'auto',
  responsiveAutoMaxWidthPx,
  responsiveAutoMeasure,
  className,
  sx,
  renderEmptyAsTable = false,
  title,
  toolbar,
  searchable,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchableColumns,
  sortableRowId,
  onReorder,
  sortableDragDisabled,
  tableClassName,
  embedded = false,
  searchAppliedOnServer,
}: SMSDataTableWrapperProps<T>) => {
  if (embedded) {
    return (
      <SMSDataTableInner<T>
        columns={columns}
        data={data}
        title={title}
        toolbar={toolbar}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchableColumns={searchableColumns}
        sortableRowId={sortableRowId}
        onReorder={onReorder}
        sortableDragDisabled={sortableDragDisabled}
        searchAppliedOnServer={searchAppliedOnServer}
        useCardWrapper={false}
        emptyMessage={emptyMessage}
        loading={loading}
        preserveStructureWhileLoading={preserveStructureWhileLoading}
        showHeaderWhenEmpty={showHeaderWhenEmpty}
        maxBodyHeight={maxBodyHeight}
        pagination={pagination}
        getRowKey={getRowKey}
        getRowClassName={getRowClassName}
        onRowClick={onRowClick}
        responsiveMode={responsiveMode}
        responsiveAutoMaxWidthPx={responsiveAutoMaxWidthPx}
        responsiveAutoMeasure={responsiveAutoMeasure}
        className={tableClassName ?? className ?? ''}
      />
    );
  }

  if (error) {
    return (
      <SMSCard className={className} sx={sx}>
        <SMSErrorState message={error} onRetry={onRetry} />
      </SMSCard>
    );
  }

  const useTableShell = renderEmptyAsTable === true;

  if (!useTableShell && loading) {
    return (
      <SMSCard className={className} sx={sx}>
        <SMSLoadingState />
      </SMSCard>
    );
  }

  const cardSxWithOverflow: CardProps['sx'] =
    sx !== undefined ? ([{ overflow: 'hidden' }, sx] as CardProps['sx']) : { overflow: 'hidden' };

  if (!useTableShell && data.length === 0) {
    return (
      <SMSCard className={className} sx={cardSxWithOverflow}>
        <SMSEmptyState
          icon={emptyIcon}
          title={emptyTitle}
          message={emptyMessage}
          messageColor={emptyMessageColor}
        />
      </SMSCard>
    );
  }

  return (
    <SMSCard className={className} sx={cardSxWithOverflow}>
      <SMSDataTableInner<T>
        columns={columns}
        data={data}
        title={title}
        toolbar={toolbar}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchableColumns={searchableColumns}
        sortableRowId={sortableRowId}
        onReorder={onReorder}
        sortableDragDisabled={sortableDragDisabled}
        searchAppliedOnServer={searchAppliedOnServer}
        useCardWrapper={false}
        emptyMessage={emptyMessage}
        loading={loading}
        preserveStructureWhileLoading={preserveStructureWhileLoading}
        showHeaderWhenEmpty={showHeaderWhenEmpty}
        maxBodyHeight={maxBodyHeight}
        pagination={pagination}
        getRowKey={getRowKey}
        getRowClassName={getRowClassName}
        onRowClick={onRowClick}
        responsiveMode={responsiveMode}
        responsiveAutoMaxWidthPx={responsiveAutoMaxWidthPx}
        responsiveAutoMeasure={responsiveAutoMeasure}
        className={tableClassName ?? ''}
      />
    </SMSCard>
  );
};

export default SMSDataTableWrapper;
