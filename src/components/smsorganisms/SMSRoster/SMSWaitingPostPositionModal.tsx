import React from 'react';
import { SMSBox, SMSTypography, SMSPaper } from '@/components/smsatoms';
import { SMSAlert, SMSLoadingState, SMSEmptyState } from '@/components/smsmolecules';
import { SMSModal } from '@/components/smsorganisms/SMSModal';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import type { EmployeeResponse } from '@/types/employee';
import { ROSTER_WAITING_JOB_POSITION_MODAL } from '@/constants/strings';

const W = ROSTER_WAITING_JOB_POSITION_MODAL;

export interface SMSWaitingPostPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  dateOfWork: string;
  /** When omitted, defaults to an empty list via the component parameter default. */
  rows?: EmployeeResponse[];
}

const getEmployeeName = (row: EmployeeResponse): string => {
  const firstName = row.firstName ?? '';
  const lastName = row.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || '-';
};

export const SMSWaitingPostPositionModal: React.FC<SMSWaitingPostPositionModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  error,
  dateOfWork,
  rows = [],
}) => {
  const formattedDateOfWork = dateOfWork || '-';
  const columns: DataTableColumn<EmployeeResponse>[] = React.useMemo(
    () => [
      {
        key: 'employee',
        label: 'Employee',
        render: (_value, row) => getEmployeeName(row),
      },
      {
        key: 'badgeNumber',
        label: 'Badge',
      },
      {
        key: 'primaryPhone',
        label: 'Phone',
      },
      {
        key: 'primaryEmail',
        label: 'Email',
      },
    ],
    []
  );

  return (
    <SMSModal open={isOpen} onClose={onClose} title={W.TITLE} size="md" fullWidth>
      <SMSBox sx={{ mb: 2 }}>
        <SMSTypography variant="body2" color="text.secondary">
          Date of Work: {formattedDateOfWork}
        </SMSTypography>
      </SMSBox>

      {error && (
        <SMSBox sx={{ mb: 2 }}>
          <SMSAlert variant="error" message={error} />
        </SMSBox>
      )}

      {isLoading && (
        <SMSLoadingState message={W.LOADING} />
      )}

      {!isLoading && !error && rows.length === 0 && (
        <SMSEmptyState
          icon="list"
          title={W.EMPTY_TITLE}
          message={W.EMPTY_MESSAGE}
          maxWidth={500}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <SMSPaper elevation={0}>
          <SMSDataTableWrapper<EmployeeResponse>
            columns={columns}
            data={rows}
            loading={false}
            error={null}
            emptyTitle={W.EMPTY_TITLE}
            emptyMessage={W.EMPTY_MESSAGE}
            emptyIcon="list"
            showHeaderWhenEmpty={true}
          />
        </SMSPaper>
      )}
    </SMSModal>
  );
};
