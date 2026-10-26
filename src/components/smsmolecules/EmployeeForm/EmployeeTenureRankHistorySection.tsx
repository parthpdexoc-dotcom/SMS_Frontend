import React, { useEffect, useMemo } from 'react';
import { SMSBox, SMSCard, SMSLoader, SMSStack, SMSTypography } from '@/components/smsatoms';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { EMPLOYEE } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearEmployeeTenureState,
  fetchEmployeeTenureByEmployeeThunk,
} from '@/store/slices/employeeTenureSlice';
import type { EmployeeTenureResponse } from '@/types/employeeTenure';
import {
  formatTenureDateDisplay,
} from '@/utils/employeeTenureDisplay';

const RH = EMPLOYEE.RANK_HISTORY;

export interface EmployeeTenureRankHistorySectionProps {
  employeeId?: string | null;
  /** When true, show create hint only (no API call). */
  isCreateMode: boolean;
}

function buildTenureColumns(): DataTableColumn<EmployeeTenureResponse>[] {
  return [
    {
      key: 'employeeTypeShort',
      label: RH.COLUMNS.EMPLOYEE_TYPE,
      render: (_v, row) => row.employeeTypeShort?.trim() || '-',
    },
    {
      key: 'rank',
      label: RH.COLUMNS.RANK,
      render: (_v, row) =>
        row.rank != null && Number.isFinite(Number(row.rank)) ? String(row.rank) : '-',
    },
    {
      key: 'dateOfHire',
      label: RH.COLUMNS.DATE_OF_HIRE,
      render: (_v, row) => formatTenureDateDisplay(row.dateOfHire),
    },
    {
      key: 'dateOfPromotion',
      label: RH.COLUMNS.DATE_OF_PROMOTION,
      render: (_v, row) => formatTenureDateDisplay(row.dateOfPromotion),
    },
    {
      key: 'isCurrent',
      label: RH.COLUMNS.IS_CURRENT,
      render: (_v, row) => {
        if (row.isCurrent === true) return RH.IS_CURRENT_YES;
        if (row.isCurrent === false) return RH.IS_CURRENT_NO;
        return '-';
      },
    },
  ];
}

export const EmployeeTenureRankHistorySection: React.FC<EmployeeTenureRankHistorySectionProps> = ({
  employeeId,
  isCreateMode,
}) => {
  const dispatch = useAppDispatch();
  const { rows, isLoading, error } = useAppSelector((state) => state.employeeTenure);

  const columns = useMemo(() => buildTenureColumns(), []);

  useEffect(() => {
    if (isCreateMode || !employeeId?.trim()) {
      dispatch(clearEmployeeTenureState());
      return;
    }
    dispatch(fetchEmployeeTenureByEmployeeThunk(employeeId.trim()));
  }, [dispatch, isCreateMode, employeeId]);

  if (isCreateMode) {
    return (
      <SMSBox className="app-form__full-width">
        <SMSTypography variant="body2" color="text.secondary">
          {RH.CREATE_HINT}
        </SMSTypography>
      </SMSBox>
    );
  }

  return (
    <SMSBox className="app-form__full-width">
      <SMSStack spacing={1.5}>
        {isLoading ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <SMSLoader loadingText={RH.LOADING} aria-label={RH.LOADING} />
          </SMSBox>
        ) : error ? (
          <SMSTypography variant="body2" color="error" role="alert">
            {error}
          </SMSTypography>
        ) : rows.length === 0 ? (
          <SMSCard variant="outlined" sx={{ py: 2, px: 2, textAlign: 'center' }}>
            <SMSTypography variant="body2" color="text.secondary">
              {RH.EMPTY}
            </SMSTypography>
          </SMSCard>
        ) : (
          <SMSBox className="employee-form__skills-list">
            <SMSDataTableWrapper<EmployeeTenureResponse>
              columns={columns}
              data={rows}
              searchable={false}
              pagination={undefined}
            />
          </SMSBox>
        )}
      </SMSStack>
    </SMSBox>
  );
};
