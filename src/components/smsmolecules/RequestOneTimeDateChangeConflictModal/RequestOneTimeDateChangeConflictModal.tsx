import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { SMSBox, SMSButton, SMSChip, SMSGrid, SMSLoader, SMSStack, SMSTypography } from '@/components/smsatoms';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn } from '@/components/smsorganisms';
import { REQUEST } from '@/constants/strings';
import type { RequestOneTimeDateChangeAssignmentDto } from '@/types/request';
import { formatDateShort, formatDuration } from '@/utils';
import './RequestOneTimeDateChangeConflictModal.css';

export interface RequestOneTimeDateChangeConflictModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
  assignedPostPositions: RequestOneTimeDateChangeAssignmentDto[];
  /** Request start date being saved; used when API row omits `newDateOfWork`. */
  newRequestStartDate?: string;
  onTransfer: (postPositionIds: string[], transferAll?: boolean) => void | Promise<void>;
  isTransferring?: boolean;
}

function getTransferRowKey(row: RequestOneTimeDateChangeAssignmentDto): string {
  return `${row.postPositionID}-${row.employeeID}-${row.dateOfWork}-${row.startTime}`;
}

function getPostPositionIdsFromRows(rows: RequestOneTimeDateChangeAssignmentDto[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row.postPositionID?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function formatAssignmentDate(value?: string | null): string {
  const raw = String(value ?? '').trim();
  return raw ? formatDateShort(raw) : '-';
}

function resolveNewDateOfWork(
  row: RequestOneTimeDateChangeAssignmentDto,
  newRequestStartDate?: string
): string {
  const fromRow = String(row.newDateOfWork ?? '').trim();
  if (fromRow) return formatAssignmentDate(fromRow);
  return formatAssignmentDate(newRequestStartDate);
}

export const RequestOneTimeDateChangeConflictModal: React.FC<
  RequestOneTimeDateChangeConflictModalProps
> = ({
  open,
  onClose,
  assignedPostPositions,
  newRequestStartDate,
  onTransfer,
  isTransferring = false,
}) => {
  const [transferSelectedIds, setTransferSelectedIds] = useState<Set<string>>(new Set());
  const [pendingTransferAction, setPendingTransferAction] = useState<'all' | 'selected' | null>(null);

  useEffect(() => {
    if (open) {
      setTransferSelectedIds(new Set());
      setPendingTransferAction(null);
    }
  }, [open]);

  useEffect(() => {
    if (!isTransferring) {
      setPendingTransferAction(null);
    }
  }, [isTransferring]);

  const toggleTransferRow = useCallback((row: RequestOneTimeDateChangeAssignmentDto, checked: boolean) => {
    const postPositionID = row.postPositionID?.trim();
    if (!postPositionID) return;
    setTransferSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(postPositionID);
      } else {
        next.delete(postPositionID);
      }
      return next;
    });
  }, []);

  const handleTransferAll = useCallback(() => {
    const allIds = getPostPositionIdsFromRows(assignedPostPositions);
    setTransferSelectedIds(new Set(allIds));
    setPendingTransferAction('all');
    void onTransfer(allIds, true);
  }, [assignedPostPositions, onTransfer]);

  const handleTransferSelected = useCallback(() => {
    setPendingTransferAction('selected');
    void onTransfer(Array.from(transferSelectedIds), false);
  }, [onTransfer, transferSelectedIds]);

  const handleClose = useCallback(() => {
    if (isTransferring) return;
    onClose();
  }, [isTransferring, onClose]);

  const columns = useMemo<DataTableColumn<RequestOneTimeDateChangeAssignmentDto>[]>(
    () => [
      {
        key: 'transfer',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.TRANSFER,
        render: (_value: unknown, row: RequestOneTimeDateChangeAssignmentDto) => {
          const postPositionID = row.postPositionID?.trim();
          return (
            <SMSBox className="request-one-time-date-change-conflict-modal__transfer-cell">
              <Checkbox
                checked={postPositionID ? transferSelectedIds.has(postPositionID) : false}
                disabled={!postPositionID || isTransferring}
                onChange={(event) => toggleTransferRow(row, event.target.checked)}
                inputProps={{
                  'aria-label': REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.TRANSFER,
                }}
                sx={{
                  color: 'var(--text-secondary)',
                  '&.Mui-checked': { color: 'var(--color-primary)' },
                  padding: 0,
                }}
              />
            </SMSBox>
          );
        },
      },
      {
        key: 'employeeName',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.EMPLOYEE_NAME,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'postTitle',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.POST_TITLE,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'dateOfWork',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.DATE_OF_WORK,
        render: (value: unknown) => formatAssignmentDate(String(value ?? '')),
      },
      {
        key: 'newDateOfWork',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.NEW_DATE_OF_WORK,
        render: (_value: unknown, row: RequestOneTimeDateChangeAssignmentDto) =>
          resolveNewDateOfWork(row, newRequestStartDate),
      },
      {
        key: 'startTime',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.START_TIME,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'endTime',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.END_TIME,
        render: (value: unknown) => String(value ?? '-'),
      },
      {
        key: 'duration',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.DURATION,
        render: (value: unknown) => {
          const minutes = Number(value);
          return Number.isFinite(minutes) && minutes > 0 ? formatDuration(minutes) : '-';
        },
      },
      {
        key: 'status',
        label: REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.COLUMNS.STATUS,
        render: (_value: unknown, row: RequestOneTimeDateChangeAssignmentDto) => (
          <SMSBox className="request-one-time-date-change-conflict-modal__status-cell">
            <SMSChip
              label={
                row.hasTimeConflict
                  ? REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.STATUS_TIME_CONFLICT
                  : REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.STATUS_READY
              }
              size="small"
              className={
                row.hasTimeConflict
                  ? 'request-one-time-date-change-conflict-modal__status-chip request-one-time-date-change-conflict-modal__status-chip--conflict'
                  : 'request-one-time-date-change-conflict-modal__status-chip request-one-time-date-change-conflict-modal__status-chip--ready'
              }
            />
          </SMSBox>
        ),
      },
    ],
    [isTransferring, newRequestStartDate, toggleTransferRow, transferSelectedIds]
  );

  return (
    <SMSModal
      open={open}
      onClose={handleClose}
      title={REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TITLE}
      size="large"
      actions={
        <SMSStack
          direction="row"
          spacing={1.5}
          justifyContent="flex-end"
          sx={{ width: '100%', flexWrap: 'wrap' }}
        >
          <SMSButton onClick={handleClose} disabled={isTransferring}>
            {REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.CANCEL}
          </SMSButton>
          <SMSButton
            onClick={handleTransferAll}
            disabled={isTransferring}
            loading={isTransferring && pendingTransferAction === 'all'}
          >
            {REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TRANSFER_ALL}
          </SMSButton>
          <SMSButton
            color="primary"
            onClick={handleTransferSelected}
            disabled={isTransferring}
            loading={isTransferring && pendingTransferAction === 'selected'}
          >
            {REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TRANSFER_SELECTED}
          </SMSButton>
        </SMSStack>
      }
    >
      <SMSGrid container spacing={2}>
        <SMSGrid item xs={12}>
          <SMSTypography variant="body1" color="error.main">
            {REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.MESSAGE}
          </SMSTypography>
          <SMSTypography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.EQUIPMENT_DATES_NOTE}
          </SMSTypography>
        </SMSGrid>
        <SMSGrid item xs={12}>
          <SMSBox className="request-one-time-date-change-conflict-modal__table">
            {isTransferring ? (
              <SMSStack
                alignItems="center"
                justifyContent="center"
                className="request-one-time-date-change-conflict-modal__loader"
              >
                <SMSLoader
                  size={28}
                  loadingText={REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TRANSFERRING}
                  aria-label={REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TRANSFERRING}
                />
              </SMSStack>
            ) : (
              <SMSDataTableWrapper<RequestOneTimeDateChangeAssignmentDto>
                data={assignedPostPositions}
                columns={columns}
                searchable={false}
                responsiveMode="table"
                maxBodyHeight="min(55vh, 440px)"
                getRowKey={getTransferRowKey}
              />
            )}
          </SMSBox>
        </SMSGrid>
      </SMSGrid>
    </SMSModal>
  );
};

export default RequestOneTimeDateChangeConflictModal;
