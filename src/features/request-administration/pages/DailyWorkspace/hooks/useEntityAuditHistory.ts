import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuditHistoryTable, getAuditHistory } from '@/services/auditHistoryService';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import type { AuditHistoryRow } from '@/utils/auditHistoryUtils';
import { REQUESTER } from '@/constants/strings';

export interface AuditHistorySelection {
  entityId: string;
  snapshotName: string;
}

export interface UseEntityAuditHistoryOptions {
  table: AuditHistoryTable;
  errorMessage: string;
}

export function useEntityAuditHistory({ table, errorMessage }: UseEntityAuditHistoryOptions) {
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<AuditHistorySelection | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<AuditHistoryRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const open = useCallback((entityId: string, snapshotName: string) => {
    setSelection({ entityId, snapshotName });
    setStartDate('');
    setEndDate('');
    setPage(1);
    setPageSize(10);
    setTotalItems(0);
    setRefreshToken(0);
  }, []);

  const close = useCallback(() => {
    setSelection(null);
    setStartDate('');
    setEndDate('');
    setPage(1);
    setPageSize(10);
    setTotalItems(0);
    setRows([]);
    setRefreshToken(0);
  }, []);

  useEffect(() => {
    const entityId = selection?.entityId?.trim();
    if (!entityId) {
      setRows([]);
      setTotalItems(0);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    void getAuditHistory(table, entityId, {
      page,
      pageSize,
      sortBy: 'ChangedOn',
      sortDirection: 'desc',
      ...(startDate.trim() ? { startDate: startDate.trim() } : {}),
      ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
    })
      .then((result) => {
        if (!mounted) return;
        setRows(result.data ?? []);
        setTotalItems(result.totalRecords ?? 0);
      })
      .catch(() => {
        if (!mounted) return;
        setRows([]);
        setTotalItems(0);
        dispatch(showToast(errorMessage, 'error'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // Dates only apply when refreshToken bumps (Apply) or selection/page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.entityId, page, pageSize, refreshToken, table, dispatch, errorMessage]);

  const modalTitle = useMemo(() => {
    if (!selection) return REQUESTER.BUTTON.VIEW_HISTORY;
    const display = selection.snapshotName.trim();
    return display
      ? `${REQUESTER.BUTTON.VIEW_HISTORY} — ${display}`
      : REQUESTER.BUTTON.VIEW_HISTORY;
  }, [selection]);

  const pagination = useMemo(
    () => ({
      currentPage: page,
      pageSize,
      totalItems,
      serverSide: true as const,
      onPageChange: (nextPage: number) => setPage(nextPage),
      onPageSizeChange: (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
      },
    }),
    [page, pageSize, totalItems]
  );

  const applyFilter = useCallback(() => {
    const start = startDate.trim();
    const end = endDate.trim();
    if (start && end && start > end) {
      dispatch(showToast(REQUESTER.AUDIT.DATE_RANGE_INVALID, 'error'));
      return;
    }
    setPage(1);
    setRefreshToken((token) => token + 1);
  }, [startDate, endDate, dispatch]);

  return {
    selection,
    open,
    close,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    rows,
    loading,
    modalTitle,
    pagination,
    applyFilter,
    isOpen: selection !== null,
  };
}
