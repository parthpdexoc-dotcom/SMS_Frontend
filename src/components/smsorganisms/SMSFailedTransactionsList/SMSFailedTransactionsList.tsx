import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn } from '@/components/smsorganisms';
import { POST_POSITION } from '@/constants/strings';
import { formatDateWithDayOfWeek } from '@/utils';
import { getPostWorkflowAudits } from '@/services/auditHistoryService';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { SMSBox, SMSIconButton, SMSIcon, SMSTypography } from '@/components/smsatoms';
import { renderPostPositionStatusPill } from '@/utils/postPositionStatusPill';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import './SMSFailedTransactionsList.css';

export interface SMSFailedTransactionsListProps {
  /** Optional scoped employee filter for My History view. */
  employeeId?: string;
}

export const SMSFailedTransactionsList: React.FC<SMSFailedTransactionsListProps> = ({ employeeId }) => {
  const [rows, setRows] = useState<EmployeePostListingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE, totalItems: 0 });
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('-');

  const loadRows = useCallback(async (page: number, pageSize: number) => {
    setLoading(true);
    try {
      const result = await getPostWorkflowAudits({ page, pageSize }, '1', employeeId);
      setRows(result.data);
      setPagination((prev) => ({ ...prev, currentPage: page, pageSize, totalItems: result.totalRecords }));
    } catch {
      setRows([]);
      setPagination((prev) => ({ ...prev, currentPage: page, pageSize, totalItems: 0 }));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadRows(pagination.currentPage, pagination.pageSize);
  }, [loadRows, pagination.currentPage, pagination.pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, currentPage: 1 }));
  }, []);

  const columns: DataTableColumn<EmployeePostListingItem>[] = useMemo(
    () => [
      {
        key: 'startDate',
        label: 'Recorded Date',
        render: (_value, row) => {
          const raw = row.startDate;
          if (!raw) return '-';
          return (
            <SMSBox sx={{ whiteSpace: 'pre-line', lineHeight: 1.2 }}>
              {formatDateWithDayOfWeek(String(raw), row.dayOfWeek)}
            </SMSBox>
          );
        },
      },
      {
        key: 'startTime',
        label: 'Recorded Time',
        render: (_value, row) => {
          const raw = row.startTime;
          if (!raw) return '-';
          return String(raw);
        },
      },
      {
        key: 'postPositionStatus',
        label: 'Action',
        render: (value) => {
          return (
            <SMSBox sx={{ width: '100%', textAlign: 'center' }}>
              {renderPostPositionStatusPill(value)}
            </SMSBox>
          );
        },
      },
      {
        key: 'postTitle',
        label: 'Post',
        render: (_value, row) => {
          const value = row.postTitle?.trim() || row.postID || '-';
          return <SMSBox title={String(value)}>{String(value)}</SMSBox>;
        },
      },
      {
        key: 'requestTitle',
        label: 'Request',
        render: (_value, row) => {
          const value = row.requestTitle?.trim() || '-';
          return <SMSBox title={String(value)}>{String(value)}</SMSBox>;
        },
      },
      {
        key: 'failureReason',
        label: 'Reason',
        render: (_value, row) => {
          const reason = row.failureReason;
          const value = reason && String(reason).trim() ? String(reason) : '-';

          return (
            <SMSIconButton
              size="small"
              tone="primary"
              allowWhenSuspended
              title="View"
              aria-label="View failure reason"
              onClick={() => {
                setSelectedReason(value);
                setIsReasonModalOpen(true);
              }}
            >
              <SMSIcon name="visibility" size="sm" />
            </SMSIconButton>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      <div className="post-position-by-status-list">
        <div className="post-position-by-status-list__table" data-post-cols={columns.length}>
          <SMSDataTableWrapper
            className="failed-transactions-table"
            columns={columns}
            data={rows}
            loading={loading}
            emptyMessage={POST_POSITION.TABLE.NO_DATA}
            maxBodyHeight="calc(100vh - 360px)"
            pagination={{
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              serverSide: true,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange,
            }}
          />
        </div>
      </div>
      <SMSModal
        open={isReasonModalOpen}
        onClose={() => {
          setIsReasonModalOpen(false);
          setSelectedReason('-');
        }}
        title="Failure Reason"
        size="small"
      >
        <SMSBox sx={{ p: 1 }}>
          <SMSTypography variant="body1">{selectedReason}</SMSTypography>
        </SMSBox>
      </SMSModal>
    </>
  );
};
