import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { PaymentAddModal, RequesterInvoiceDetailsModal } from '@/components/smsmolecules';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { usePagination } from '@/hooks/usePagination';
import { PAYMENT_GRID } from '@/constants/strings';
import type {
  CreateRequesterPaymentPayload,
  PaymentFormRequesterOption,
  PaymentGridRow,
} from '@/types/payment';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  createRequesterPaymentThunk,
  fetchPayments,
  selectPaymentGridRows,
  selectPaymentsListState,
} from '@/store/slices/paymentSlice';
import { fetchRequesters } from '@/store/slices/requesterSlice';
import { showToast } from '@/store/slices/toastSlice';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import './PaymentList.css';

export const PaymentList: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { requesters } = useAppSelector((state) => state.requester);
  const { loading, saving } = useAppSelector(selectPaymentsListState);
  const rows = useAppSelector(selectPaymentGridRows);
  const [formResetToken, setFormResetToken] = useState(0);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [invoiceDetailsOpen, setInvoiceDetailsOpen] = useState(false);
  const [viewRequester, setViewRequester] = useState<{ id: string; name: string } | null>(null);

  const pagination = usePagination({ initialPage: 1, totalItems: 0 });

  useEffect(() => {
    void dispatch(fetchRequesters({ page: 1, pageSize: 10000, sortBy: 'name', sortDirection: 'asc' }));
  }, [dispatch]);

  const requesterSelectOptions: PaymentFormRequesterOption[] = useMemo(
    () =>
      requesters.map((r) => ({
        value: String(r.requesterID),
        label: r.name ?? String(r.requesterID) ?? '',
      })),
    [requesters]
  );

  useEffect(() => {
    void dispatch(fetchPayments());
  }, [dispatch]);

  useEffect(() => {
    pagination.setTotalItems(rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const handleViewRequesterInvoices = useCallback((row: PaymentGridRow) => {
    if (!row.requesterId?.trim()) {
      dispatch(showToast(PAYMENT_GRID.ERRORS.REQUESTER_REQUIRED, 'error'));
      return;
    }
    setViewRequester({
      id: row.requesterId,
      name: row.requesterName || PAYMENT_GRID.EMPTY_PLACEHOLDER,
    });
    setInvoiceDetailsOpen(true);
  }, [dispatch]);

  const handleSavePayment = useCallback(
    async (payload: CreateRequesterPaymentPayload): Promise<boolean> => {
      if (!payload.requesterID) {
        dispatch(showToast(PAYMENT_GRID.ERRORS.REQUESTER_REQUIRED, 'error'));
        return false;
      }
      if (!payload.paymentDate.trim()) {
        dispatch(showToast(PAYMENT_GRID.ERRORS.DATE_REQUIRED, 'error'));
        return false;
      }
      if (!payload.amount || payload.amount <= 0) {
        dispatch(showToast(PAYMENT_GRID.ERRORS.AMOUNT_INVALID, 'error'));
        return false;
      }

      try {
        await dispatch(
          createRequesterPaymentThunk({
            requesterID: payload.requesterID,
            amount: payload.amount,
            paymentDate: payload.paymentDate,
            paymentTypeId: payload.paymentTypeId,
            referenceNumber: payload.referenceNumber,
          })
        ).unwrap();
        setFormResetToken((t) => t + 1);
        return true;
      } catch {
        return false;
      }
    },
    [dispatch]
  );

  const columns: DataTableColumn<PaymentGridRow>[] = useMemo(
    () => [
      {
        key: 'requesterName',
        label: PAYMENT_GRID.TABLE.COLUMNS.REQUESTER,
        render: (_value, row) => row.requesterName || PAYMENT_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'date',
        label: PAYMENT_GRID.TABLE.COLUMNS.DATE,
        render: (_value, row) => row.date || PAYMENT_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'amountPaid',
        label: PAYMENT_GRID.TABLE.COLUMNS.AMOUNT_PAID,
        align: 'right',
        render: (_value, row) => (
          <span className="payment-list__amount">{formatPaymentCurrency(row.amountPaid)}</span>
        ),
      },
      {
        key: 'paymentType',
        label: PAYMENT_GRID.TABLE.COLUMNS.PAYMENT_TYPE,
        render: (_value, row) => row.paymentTypeLabel || PAYMENT_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'referenceNumber',
        label: PAYMENT_GRID.TABLE.COLUMNS.REFERENCE_NUMBER,
        render: (_value, row) => row.referenceNumber || PAYMENT_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'action',
        label: PAYMENT_GRID.TABLE.COLUMNS.ACTION,
        render: (_value, row) => (
          <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap>
            <SMSIconButton
              size="small"
              tone="primary"
              allowWhenSuspended
              onClick={(e) => {
                e.stopPropagation();
                handleViewRequesterInvoices(row);
              }}
              title={PAYMENT_GRID.TABLE.VIEW}
              aria-label={PAYMENT_GRID.TABLE.VIEW}
              sx={{ borderRadius: 1 }}
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
          </Stack>
        ),
      },
    ],
    [handleViewRequesterInvoices]
  );

  return (
    <Box component="main" className="payment-list requester-list">
      <Stack
        direction="row"
        alignItems="center"
        className="requester-list__header payment-list__header"
        useFlexGap
      >
        <button
          type="button"
          onClick={() => navigate(PAYMENT_GRID.REQUESTER_LIST_PATH)}
          className="form-page__back-button"
          aria-label={PAYMENT_GRID.BACK_BUTTON_ARIA_LABEL}
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <Typography variant="h4" component="h1" className="requester-list__title payment-list__title">
          {PAYMENT_GRID.TITLE}
        </Typography>
        <SMSButton
          className="payment-list__add-button"
          onClick={() => setAddPaymentModalOpen(true)}
          allowWhenSuspended
          leftIcon={<SMSIcon name="add" size="sm" />}
        >
          {PAYMENT_GRID.BUTTON.ADD_PAYMENT}
        </SMSButton>
      </Stack>

      <Box className="requester-list__table">
        <SMSDataTableWrapper<PaymentGridRow>
          columns={columns}
          data={rows}
          tableClassName="payment-list__data-table"
          emptyMessage={PAYMENT_GRID.TABLE.NO_DATA}
          loading={loading}
          showHeaderWhenEmpty
          renderEmptyAsTable
          maxBodyHeight="calc(100vh - 360px)"
          pagination={{
            serverSide: false,
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
            onPageChange: (page) => pagination.goToPage(page),
            onPageSizeChange: (newPageSize) => {
              pagination.setPageSize(newPageSize);
              pagination.goToFirstPage();
            },
          }}
        />
      </Box>

      <PaymentAddModal
        isOpen={addPaymentModalOpen}
        onClose={() => setAddPaymentModalOpen(false)}
        formResetToken={formResetToken}
        requesterOptions={requesterSelectOptions}
        requestersLoading={requesters.length === 0}
        saving={saving}
        onSave={handleSavePayment}
      />

      <RequesterInvoiceDetailsModal
        isOpen={invoiceDetailsOpen}
        onClose={() => {
          setInvoiceDetailsOpen(false);
          setViewRequester(null);
        }}
        requesterId={viewRequester?.id}
        requesterName={viewRequester?.name}
      />
    </Box>
  );
};
