import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import { SMSButton, SMSDatePicker, SMSIcon, SMSTabs } from '@/components/smsatoms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import { navigateAdminBack } from '@/utils/requesterAdminNavigation';
import type { RequesterPaymentRowDto, RequesterRefundPaymentRowDto } from '@/types/payment';
import type { RequesterPaymentPageProps } from '@/types/requesterPaymentPage';
import { RequesterPaymentPageModals } from './RequesterPaymentPageModals';
import { RequesterPaymentSummaryGrid } from './RequesterPaymentSummaryGrid';
import { S } from './constants';
import { useRequesterPaymentPage } from './useRequesterPaymentPage';
import './RequesterPaymentPage.css';

const HISTORY_TABS = [
  { id: 'payment', label: S.TABS.PAYMENT },
  { id: 'refund', label: S.TABS.REFUND },
] as const;

export const RequesterPaymentPage: React.FC<RequesterPaymentPageProps> = ({
  requesterId,
  requesterName,
  returnPath,
  returnState,
}) => {
  const navigate = useNavigate();

  const page = useRequesterPaymentPage({ requesterId, requesterName });

  const isPaymentTab = page.historyTab === 'payment';

  const handleBack = () => {
    navigateAdminBack(navigate, returnPath, PAYMENT_GRID.REQUESTER_LIST_PATH, returnState);
  };

  return (
    <Box component="main" className="requester-payment-page requester-list">
      <Stack
        direction="row"
        alignItems="center"
        className="requester-list__header requester-payment-page__header"
        useFlexGap
      >
        <SMSButton
          type="button"
          variant="outlined"
          color="inherit"
          onClick={handleBack}
          className="form-page__back-button"
          aria-label={PAYMENT_GRID.BACK_BUTTON_ARIA_LABEL}
          allowWhenSuspended
          leftIcon={<SMSIcon name="arrowLeft" size="md" />}
        />

        <h1 className="requester-payment-page__title">
          {page.displayName} - {S.PAGE_TITLE_PREFIX}
        </h1>

        <Stack direction="row" spacing={1} useFlexGap className="requester-payment-page__header-actions">
          {isPaymentTab ? (
            <SMSButton
              className="requester-payment-page__add-button"
              onClick={page.handleOpenRecordPayment}
              allowWhenSuspended
              leftIcon={<SMSIcon name="add" size="sm" />}
            >
              {S.BUTTON.RECORD_PAYMENT}
            </SMSButton>
          ) : (
            <SMSButton
              className="requester-payment-page__add-button"
              onClick={page.handleOpenRecordRefund}
              allowWhenSuspended
              leftIcon={<SMSIcon name="add" size="sm" />}
            >
              {S.BUTTON.RECORD_REFUND}
            </SMSButton>
          )}
        </Stack>
      </Stack>

      <RequesterPaymentSummaryGrid {...page.summary} />

      <div className="requester-payment-page__filters" role="search" aria-label={S.FILTERS.ARIA_LABEL}>
        <SMSDatePicker
          key={`requester-payment-start-${page.datePickerKey}`}
          label={S.FILTERS.START_DATE}
          value={page.startDate || undefined}
          onChange={page.setStartDate}
          maxDate={page.endDate || undefined}
          className="requester-payment-page__filter-field"
          valueFormat="YYYY-MM-DD"
          format="MM/DD/YYYY"
        />
        <SMSDatePicker
          key={`requester-payment-end-${page.datePickerKey}`}
          label={S.FILTERS.END_DATE}
          value={page.endDate || undefined}
          onChange={page.setEndDate}
          minDate={page.startDate || undefined}
          className="requester-payment-page__filter-field"
          valueFormat="YYYY-MM-DD"
          format="MM/DD/YYYY"
        />
        <SMSButton
          variant="outlined"
          size="small"
          onClick={page.clearDateFilters}
          allowWhenSuspended
          sx={{ alignSelf: 'flex-end' }}
        >
          {S.FILTERS.CLEAR}
        </SMSButton>
      </div>

      <section className="requester-payment-page__table-section" aria-labelledby="requester-payments-table-title">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          className="requester-payment-page__table-header"
          useFlexGap
        >
          <Stack spacing={1} useFlexGap className="requester-payment-page__table-heading">
            <h2
              id="requester-payments-table-title"
              className="requester-payment-page__title requester-payment-page__title--section"
            >
              {isPaymentTab ? S.PAYMENTS_TITLE : S.REFUNDS_TITLE}
            </h2>
            <SMSTabs
              options={[...HISTORY_TABS]}
              value={page.historyTab}
              onChange={page.onHistoryTabChange}
              size="small"
              distribution="content"
              className="requester-payment-page__history-tabs"
            />
          </Stack>
        </Stack>

        {isPaymentTab ? (
          <Box className="requester-list__table">
            <SMSDataTableWrapper<RequesterPaymentRowDto>
              columns={page.columns}
              data={page.payments}
              getRowKey={(row) => row.paymentId?.trim() || String(row.paymentNumber ?? '')}
              tableClassName="requester-payment-page__data-table"
              emptyMessage={S.TABLE.NO_DATA}
              loading={page.loading}
              showHeaderWhenEmpty
              renderEmptyAsTable
              maxBodyHeight="min(320px, 40vh)"
              pagination={{
                serverSide: true,
                currentPage: page.pagination.currentPage,
                pageSize: page.pagination.pageSize,
                totalItems: page.pagination.totalItems,
                onPageChange: (nextPage) => page.pagination.goToPage(nextPage),
                onPageSizeChange: (newPageSize) => {
                  page.pagination.setPageSize(newPageSize);
                  page.pagination.goToFirstPage();
                },
              }}
            />
          </Box>
        ) : (
          <Box className="requester-list__table">
            <SMSDataTableWrapper<RequesterRefundPaymentRowDto>
              columns={page.refundColumns}
              data={page.refunds}
              getRowKey={(row) =>
                row.refundPaymentId?.trim() || String(row.refundPaymentNumber ?? '')
              }
              tableClassName="requester-payment-page__data-table requester-payment-page__data-table--refunds"
              emptyMessage={S.REFUND_TABLE.NO_DATA}
              loading={page.refundLoading}
              showHeaderWhenEmpty
              renderEmptyAsTable
              maxBodyHeight="min(320px, 40vh)"
              pagination={{
                serverSide: true,
                currentPage: page.refundPagination.currentPage,
                pageSize: page.refundPagination.pageSize,
                totalItems: page.refundPagination.totalItems,
                onPageChange: (nextPage) => page.refundPagination.goToPage(nextPage),
                onPageSizeChange: (newPageSize) => {
                  page.refundPagination.setPageSize(newPageSize);
                  page.refundPagination.goToFirstPage();
                },
              }}
            />
          </Box>
        )}
      </section>

      <RequesterPaymentPageModals {...page.modalsProps} requesterId={requesterId} />

      {page.error && isPaymentTab ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {page.error}
        </Typography>
      ) : null}
      {page.refundError && !isPaymentTab ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {page.refundError}
        </Typography>
      ) : null}
    </Box>
  );
};
