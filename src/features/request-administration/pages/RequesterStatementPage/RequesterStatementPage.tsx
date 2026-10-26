import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SMSBox,
  SMSButton,
  SMSDatePicker,
  SMSIcon,
  SMSStack,
  SMSTypography,
} from '@/components/smsatoms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { navigateAdminBack } from '@/utils/requesterAdminNavigation';
import { usePagination } from '@/hooks/usePagination';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearRequesterLedgerStatement,
  fetchRequesterLedgerStatement,
  selectRequesterLedgerStatementState,
} from '@/store/slices/requesterLedgerSlice';
import type { RequesterStatementPageProps } from '@/types/requesterLedger';
import { RequesterStatementSummaryGrid } from './RequesterStatementSummaryGrid';
import { statementTableColumns } from './statementTableColumns';
import { S } from './constants';
import './RequesterStatementPage.css';

const toStartDateTime = (date: string) => `${date}T00:00:00`;
const toEndDateTime = (date: string) => `${date}T23:59:59`;

export const RequesterStatementPage: React.FC<RequesterStatementPageProps> = ({
  requesterId,
  requesterName,
  returnPath,
  returnState,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const pagination = usePagination();
  const { statement, isLoading, error } = useAppSelector(selectRequesterLedgerStatementState);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePickerKey, setDatePickerKey] = useState(0);

  const displayName = requesterName?.trim() || S.REQUESTER_FALLBACK;

  const statementQuery = useMemo(
    () => ({
      requesterId: requesterId.trim(),
      startDateTime: startDate ? toStartDateTime(startDate) : null,
      endDateTime: endDate ? toEndDateTime(endDate) : null,
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
    }),
    [requesterId, startDate, endDate, pagination.currentPage, pagination.pageSize]
  );

  useEffect(() => {
    void dispatch(fetchRequesterLedgerStatement(statementQuery));
  }, [dispatch, statementQuery]);

  useEffect(
    () => () => {
      dispatch(clearRequesterLedgerStatement());
    },
    [dispatch]
  );

  useEffect(() => {
    pagination.setTotalItems(statement?.totalRecords ?? 0);
  }, [statement?.totalRecords]);

  const clearDateFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setDatePickerKey((key) => key + 1);
    pagination.goToFirstPage();
  }, [pagination]);

  const handleBack = useCallback(() => {
    navigateAdminBack(navigate, returnPath, S.REQUESTER_LIST_PATH, returnState);
  }, [navigate, returnPath, returnState]);

  const entries = statement?.entries ?? [];

  return (
    <SMSBox component="main" className="requester-statement-page requester-list">
      <SMSStack
        direction="row"
        alignItems="center"
        className="requester-list__header requester-statement-page__header"
        useFlexGap
      >
        <SMSButton
          type="button"
          variant="outlined"
          color="inherit"
          onClick={handleBack}
          className="form-page__back-button"
          aria-label={S.BACK_BUTTON_ARIA_LABEL}
          allowWhenSuspended
          leftIcon={<SMSIcon name="arrowLeft" size="md" />}
        />

        <h1 className="requester-statement-page__title">
          {displayName} - {S.PAGE_TITLE_PREFIX}
        </h1>
      </SMSStack>

      <RequesterStatementSummaryGrid
        openingBalance={statement?.openingBalance}
        totalInvoices={statement?.totalInvoices}
        totalPayment={statement?.totalPayment}
        outstandingInvoices={statement?.outstandingInvoices}
      />

      <div className="requester-statement-page__filters" role="search" aria-label={S.FILTERS.ARIA_LABEL}>
        <SMSDatePicker
          key={`requester-statement-start-${datePickerKey}`}
          label={S.FILTERS.START_DATE}
          value={startDate || undefined}
          onChange={(value) => {
            setStartDate(value);
            pagination.goToFirstPage();
          }}
          maxDate={endDate || undefined}
          className="requester-statement-page__filter-field"
          valueFormat="YYYY-MM-DD"
          format="MM/DD/YYYY"
        />
        <SMSDatePicker
          key={`requester-statement-end-${datePickerKey}`}
          label={S.FILTERS.END_DATE}
          value={endDate || undefined}
          onChange={(value) => {
            setEndDate(value);
            pagination.goToFirstPage();
          }}
          minDate={startDate || undefined}
          className="requester-statement-page__filter-field"
          valueFormat="YYYY-MM-DD"
          format="MM/DD/YYYY"
        />
        <SMSButton
          variant="outlined"
          size="small"
          onClick={clearDateFilters}
          allowWhenSuspended
          sx={{ alignSelf: 'flex-end' }}
        >
          {S.FILTERS.CLEAR}
        </SMSButton>
      </div>

      <section
        className="requester-statement-page__table-section"
        aria-labelledby="requester-statement-table-title"
      >
        <h2
          id="requester-statement-table-title"
          className="requester-statement-page__title requester-statement-page__title--section"
        >
          {S.TABLE.TITLE}
        </h2>

        <SMSBox className="requester-list__table">
          <SMSDataTableWrapper
            columns={statementTableColumns}
            data={entries}
            getRowKey={(row) =>
              row.requesterLedgerID?.trim() ||
              `${row.transactionDateTime ?? ''}-${row.description ?? ''}-${row.amount ?? 0}`
            }
            tableClassName="requester-statement-page__data-table"
            emptyMessage={S.TABLE.NO_DATA}
            loading={isLoading}
            showHeaderWhenEmpty
            renderEmptyAsTable
            maxBodyHeight="min(420px, 50vh)"
            pagination={{
              serverSide: true,
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
              onPageChange: (nextPage) => pagination.goToPage(nextPage),
              onPageSizeChange: (newPageSize) => {
                pagination.setPageSize(newPageSize);
                pagination.goToFirstPage();
              },
            }}
          />
        </SMSBox>
      </section>

      {error ? (
        <SMSTypography color="error" variant="body2" sx={{ mt: 1 }}>
          {error}
        </SMSTypography>
      ) : null}
    </SMSBox>
  );
};
