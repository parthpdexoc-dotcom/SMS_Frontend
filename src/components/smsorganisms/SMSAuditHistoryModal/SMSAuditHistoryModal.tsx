import React, { useMemo, useState } from 'react';
import { SMSButton, SMSBox, SMSGrid, SMSDatePicker, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { SMSDataTableWrapper, SMSModal, type DataTableColumn, type PaginationProps } from '@/components/smsorganisms';
import { REQUESTER } from '@/constants/strings';
import type { AuditChangedField, AuditHistoryRow } from '@/utils/auditHistoryUtils';
import {
  formatAuditActionLabel,
  formatAuditCellValue,
  formatAuditChangedOn,
  getAuditDisplayName,
} from '@/utils/auditHistoryUtils';

export interface SMSAuditHistoryModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: AuditHistoryRow[];
  loading?: boolean;
  emptyMessage?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApplyFilter: () => void;
  pagination?: PaginationProps;
}

export const SMSAuditHistoryModal: React.FC<SMSAuditHistoryModalProps> = ({
  open,
  onClose,
  title,
  rows,
  loading = false,
  emptyMessage = REQUESTER.TABLE.NO_DATA,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyFilter,
  pagination,
}) => {
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesFields, setChangesFields] = useState<AuditChangedField[]>([]);

  const viewHistoryColumns: DataTableColumn<AuditHistoryRow>[] = useMemo(
    () => [
      {
        key: 'auditDisplayName',
        label: REQUESTER.AUDIT.COLUMN_REQUEST_NAME,
        render: (_value, row) => getAuditDisplayName(row),
      },
      {
        key: 'ChangedOn',
        label: 'Changed On',
        render: (value) => formatAuditChangedOn(value),
      },
      {
        key: 'Action',
        label: 'Action',
        render: (value) => {
          const label = formatAuditActionLabel(value);
          const normalized = label.toUpperCase();
          const toneSx =
            normalized === 'INSERT'
              ? { bgcolor: 'success.50', color: 'success.dark', borderColor: 'success.200' }
              : normalized === 'UPDATE'
                ? { bgcolor: '#fff7e6', color: '#b45309', borderColor: '#f7d9a2' }
                : normalized === 'DELETE'
                  ? { bgcolor: 'error.50', color: 'error.dark', borderColor: 'error.200' }
                  : { bgcolor: 'grey.100', color: 'text.secondary', borderColor: 'grey.300' };

          return (
            <SMSBox
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 76,
                px: 1.25,
                py: 0.25,
                borderRadius: 999,
                border: '1px solid',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                lineHeight: 1.3,
                ...toneSx,
              }}
            >
              {label}
            </SMSBox>
          );
        },
      },
      {
        key: 'auditChangedFields',
        label: REQUESTER.AUDIT.COLUMN_CHANGES,
        render: (_value, row) => (
          <div className="sms-myhistory-style-actions">
            <SMSIconButton
              size="small"
              tone="primary"
              allowWhenSuspended
              title={REQUESTER.AUDIT.VIEW_CHANGES}
              aria-label={REQUESTER.AUDIT.VIEW_CHANGES}
              onClick={(e) => {
                e.stopPropagation();
                setChangesFields(row.ChangedFields);
                setChangesModalOpen(true);
              }}
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
          </div>
        ),
      },
    ],
    []
  );

  const changesColumns: DataTableColumn<AuditChangedField>[] = useMemo(
    () => [
      {
        key: 'property',
        label: REQUESTER.AUDIT.COLUMN_FIELD_NAME,
        render: (value) => (value != null && String(value) !== '' ? String(value) : '-'),
      },
      {
        key: 'old',
        label: REQUESTER.AUDIT.COLUMN_OLD_VALUES,
        render: (_value, row) => formatAuditCellValue(row.old, row.property),
      },
      {
        key: 'new',
        label: REQUESTER.AUDIT.COLUMN_NEW_VALUES,
        render: (_value, row) => formatAuditCellValue(row.new, row.property),
      },
    ],
    []
  );

  return (
    <>
      <SMSModal open={open} onClose={onClose} title={title} size="large">
        <SMSGrid container spacing={2}>
          <SMSGrid item xs={12}>
            <SMSBox className="requester-list__audit-modal-filters">
              <SMSBox sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 2 }}>
                <SMSBox className="requester-list__audit-modal-filters__field">
                  <SMSDatePicker
                    label={REQUESTER.AUDIT.START_DATE}
                    id="audit-history-start-date"
                    value={startDate}
                    onChange={onStartDateChange}
                  />
                </SMSBox>
                <SMSBox className="requester-list__audit-modal-filters__field">
                  <SMSDatePicker
                    label={REQUESTER.AUDIT.END_DATE}
                    id="audit-history-end-date"
                    value={endDate}
                    onChange={onEndDateChange}
                  />
                </SMSBox>
                <SMSButton onClick={onApplyFilter}>
                  {REQUESTER.AUDIT.APPLY_FILTER}
                </SMSButton>
              </SMSBox>
            </SMSBox>
          </SMSGrid>
          <SMSGrid item xs={12}>
            <SMSBox className="requester-list__audit-modal-datatable">
              <SMSDataTableWrapper<AuditHistoryRow>
                data={rows}
                columns={viewHistoryColumns}
                loading={loading}
                getRowKey={(row) =>
                  `${row.EntityId}-${row.Action}-${row.ChangedOn}-${row.CorrelationId}-${getAuditDisplayName(row)}`
                }
                searchable={false}
                responsiveMode="table"
                maxBodyHeight="min(60vh, 480px)"
                emptyMessage={emptyMessage}
                pagination={pagination}
              />
            </SMSBox>
          </SMSGrid>
        </SMSGrid>
      </SMSModal>

      <SMSModal
        open={changesModalOpen}
        onClose={() => {
          setChangesModalOpen(false);
          setChangesFields([]);
        }}
        title={REQUESTER.AUDIT.CHANGES_MODAL_TITLE}
        size="large"
      >
        <SMSGrid container spacing={2}>
          <SMSGrid item xs={12}>
            <SMSBox className="requester-list__audit-modal-datatable">
              <SMSDataTableWrapper<AuditChangedField>
                data={changesFields}
                columns={changesColumns}
                searchable={false}
                responsiveMode="table"
                maxBodyHeight="min(55vh, 440px)"
                emptyMessage={emptyMessage}
              />
            </SMSBox>
          </SMSGrid>
        </SMSGrid>
      </SMSModal>
    </>
  );
};

export default SMSAuditHistoryModal;

