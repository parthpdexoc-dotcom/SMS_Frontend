import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Typography } from '@mui/material';
import { SMSBox, SMSButton } from '@/components/smsatoms';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn } from '@/components/smsorganisms';
import {
  getTenureExpressInterestList,
  processTenureWaitingListForWaitingPost,
} from '@/services/tenureJobsDashboardService';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import { TenureMetricType } from '@/types/departmentPolicy';
import {
  formatTenureStatisticDisplay,
  sortTenureStatisticKeys,
  tenureStatisticKeyToColumnLabel,
  type TenureInterestedEmployeeRow,
} from '@/types/tenureJobsDashboard';
import './InterestedListModal.css';

const MODAL_TITLE = 'Waiting List';
const MODAL_SUBTITLE_WITH_ASSIGN =
  'Employees who expressed interest for this job. Use Assign to place an employee when ready.';
const MODAL_SUBTITLE_VIEW_ONLY = 'Employees who expressed interest for this job.';
const LOAD_FAILED = 'Could not load the interested list.';

/** Job fields shown on each interested-employee row (from parent grid row). */
export type TenureJobInterestContext = {
  postID: string;
  /** YYYY-MM-DD — date of work for the API */
  dateOfWork: string;
};

type InterestedEmployeeRow = {
  id: string;
  waitingPostPositionId: string;
  employee: string;
  employeeNumber: string;
  rank: string;
  /** Per-row metric for dynamic stat columns (from API `tenureType`). */
  tenureType: TenureMetricType | null;
  hasAppliedInTenure: boolean;
  action: string;
} & Record<string, string | number | boolean | null>;

const COL = {
  EMPLOYEE: 'Employee',
  EMPLOYEE_NUM: 'Employee #',
  RANK: 'Rank',
  ACTION: 'Action',
  ASSIGN: 'Assign',
} as const;

export interface InterestedListModalProps {
  open: boolean;
  onClose: () => void;
  job: TenureJobInterestContext | null;
  /** When true, highlight rows with `hasAppliedInTenure` (Open Jobs only). */
  highlightAppliedInTenure?: boolean;
  /** When false, hide the Assign action column (Open Jobs). Default true for Tenure Jobs. */
  showAssign?: boolean;
}

export const InterestedListModal: React.FC<InterestedListModalProps> = ({
  open,
  onClose,
  job,
  highlightAppliedInTenure = false,
  showAssign = true,
}) => {
  const dispatch = useAppDispatch();
  const fetchGen = useRef(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [apiRows, setApiRows] = useState<TenureInterestedEmployeeRow[]>([]);
  const [assigningWaitingPostId, setAssigningWaitingPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !job?.postID?.trim() || !job?.dateOfWork?.trim()) {
      setApiRows([]);
      setListError(null);
      setListLoading(false);
      return;
    }

    const gen = ++fetchGen.current;
    setListLoading(true);
    setListError(null);
    setApiRows([]);

    void getTenureExpressInterestList(job.postID, job.dateOfWork)
      .then((rows) => {
        if (fetchGen.current !== gen) return;
        setApiRows(rows);
      })
      .catch((err: unknown) => {
        if (fetchGen.current !== gen) return;
        const msg = err instanceof Error ? err.message : LOAD_FAILED;
        setListError(msg);
      })
      .finally(() => {
        if (fetchGen.current !== gen) return;
        setListLoading(false);
      });
  }, [open, job?.postID, job?.dateOfWork]);

  const handleAssign = useCallback(
    async (waitingPostPositionId: string) => {
      const wpp = waitingPostPositionId.trim();
      if (!wpp) {
        dispatch(showToast('Cannot assign: missing waiting list row.', 'error'));
        return;
      }
      const postId = job?.postID?.trim();
      const dow = job?.dateOfWork?.trim();
      setAssigningWaitingPostId(wpp);
      try {
        await processTenureWaitingListForWaitingPost(wpp);
        dispatch(showToast('Employee assigned successfully.', 'success'));
        if (postId && dow) {
          const rows = await getTenureExpressInterestList(postId, dow);
          setApiRows(rows);
        }
      } catch (err: unknown) {
        dispatch(
          showToast(err instanceof Error ? err.message : 'Failed to assign employee.', 'error')
        );
      } finally {
        setAssigningWaitingPostId(null);
      }
    },
    [dispatch, job?.postID, job?.dateOfWork]
  );

  const statisticKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of apiRows) {
      for (const k of Object.keys(r.statisticsByLabel)) s.add(k);
    }
    return sortTenureStatisticKeys([...s]);
  }, [apiRows]);

  const tableRows: InterestedEmployeeRow[] = useMemo(() => {
    if (!job) return [];
    return apiRows.map((r) => ({
      id: r.id,
      waitingPostPositionId: r.waitingPostPositionId,
      employee: r.employeeName || '—',
      employeeNumber: r.employeeNumber || '—',
      rank: r.rank || '—',
      tenureType: r.tenureType,
      hasAppliedInTenure: Boolean(r.hasAppliedInTenure),
      action: '',
      ...r.statisticsByLabel,
    }));
  }, [job, apiRows]);

  const getRowClassName = useCallback(
    (row: InterestedEmployeeRow & Record<string, unknown>) => {
      if (!highlightAppliedInTenure || !row.hasAppliedInTenure) return undefined;
      return 'interested-list-modal__row--applied-in-tenure';
    },
    [highlightAppliedInTenure]
  );

  const columns: DataTableColumn<InterestedEmployeeRow & Record<string, unknown>>[] = useMemo(() => {
    const statColumns: DataTableColumn<InterestedEmployeeRow & Record<string, unknown>>[] =
      statisticKeys.map((statKey) => ({
        key: statKey,
        label: tenureStatisticKeyToColumnLabel(statKey),
        align: 'center',
        render: (_v, row) => {
          const r = row as InterestedEmployeeRow;
          const raw = (row as Record<string, unknown>)[statKey];
          const n = typeof raw === 'number' ? raw : Number(raw);
          return formatTenureStatisticDisplay(n, r.tenureType);
        },
      }));

    const cols: DataTableColumn<InterestedEmployeeRow & Record<string, unknown>>[] = [
      { key: 'employee', label: COL.EMPLOYEE },
      { key: 'employeeNumber', label: COL.EMPLOYEE_NUM, align: 'center' },
      { key: 'rank', label: COL.RANK },
      ...statColumns,
    ];

    if (showAssign) {
      cols.push({
        key: 'action',
        label: COL.ACTION,
        align: 'center',
        render: (_v, row) => {
          const r = row as InterestedEmployeeRow;
          const wpp = r.waitingPostPositionId?.trim() ?? '';
          const submitting = assigningWaitingPostId !== null;
          const isThisRow = Boolean(wpp && assigningWaitingPostId === wpp);
          return (
            <SMSBox sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <SMSButton
                type="button"
                size="small"
                variant="outlined"
                allowWhenSuspended
                aria-label={COL.ASSIGN}
                loading={isThisRow}
                disabled={!wpp || (submitting && !isThisRow)}
                onClick={() => void handleAssign(wpp)}
              >
                {COL.ASSIGN}
              </SMSButton>
            </SMSBox>
          );
        },
      });
    }

    return cols;
  }, [statisticKeys, assigningWaitingPostId, handleAssign, showAssign]);

  return (
    <SMSModal
      open={open}
      onClose={onClose}
      title={MODAL_TITLE}
      size="xl"
      fullWidth
      disablePaperScroll
      contentClassName="interested-list-modal__content"
    >
      <SMSBox className="interested-list-modal__body">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: '48rem', lineHeight: 1.55 }}>
          {showAssign ? MODAL_SUBTITLE_WITH_ASSIGN : MODAL_SUBTITLE_VIEW_ONLY}
        </Typography>
        {listError ? (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {listError}
          </Alert>
        ) : null}
        <SMSBox className="interested-list-modal__table-shell">
          <SMSDataTableWrapper<InterestedEmployeeRow & Record<string, unknown>>
            columns={columns}
            data={tableRows}
            loading={listLoading}
            error={null}
            emptyMessage="No employees on the interested list."
            searchable={false}
            maxBodyHeight="min(55vh, 480px)"
            getRowKey={(row) => row.id}
            getRowClassName={getRowClassName}
            tableClassName="interested-list-modal__data-table"
            embedded
          />
        </SMSBox>
      </SMSBox>
    </SMSModal>
  );
};
