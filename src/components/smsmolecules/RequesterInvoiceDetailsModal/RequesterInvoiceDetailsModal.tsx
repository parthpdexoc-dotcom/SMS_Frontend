import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSChip,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
  SMSIcon,
  SMSIconButton,
  SMSLoader,
  SMSStack,
  SMSStandardDialogHeader,
  SMSTypography,
} from '@/components/smsatoms';
import { InvoicePaymentModal } from '@/components/smsmolecules/InvoicePaymentModal/InvoicePaymentModal';
import { StatisticSlate } from '@/components/smsmolecules/StatisticSlate';
import { SMSStatusBadge } from '@/components/smsmolecules/SMSStatusBadge/SMSStatusBadge';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearRequesterInvoiceDetails,
  fetchRequesterInvoiceDetails,
  selectRequesterInvoiceDetailsState,
} from '@/store/slices/invoiceSlice';
import type { InvoiceDto } from '@/types/invoice';
import type {
  RequesterInvoiceDetailsModalProps,
  RequesterInvoiceSettlementStatus,
} from '@/types/requesterInvoiceDetails';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import './RequesterInvoiceDetailsModal.css';

const S = PAYMENT_GRID.REQUESTER_INVOICE_DETAILS;

const invoiceRemaining = (invoice: InvoiceDto): number => {
  if (invoice.balanceDue != null && !Number.isNaN(invoice.balanceDue)) {
    return Math.max(0, invoice.balanceDue);
  }
  const total = invoice.total ?? 0;
  const paid = invoice.paymentsApplied ?? 0;
  return Math.max(0, total - paid);
};

const invoiceSettlementStatus = (invoice: InvoiceDto): RequesterInvoiceSettlementStatus => {
  const remaining = invoiceRemaining(invoice);
  if (invoice.isPaid === true || remaining <= 0.001) return 'paid';
  return 'unpaid';
};

const statusBadge = (status: RequesterInvoiceSettlementStatus) =>
  status === 'paid' ? (
    <SMSStatusBadge label={S.INVOICE_STATUS.PAID} variant="success" size="small" />
  ) : (
    <SMSStatusBadge label={S.INVOICE_STATUS.UNPAID} variant="info" size="small" />
  );

export const RequesterInvoiceDetailsModal: React.FC<RequesterInvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  requesterId,
  requesterName,
}) => {
  const dispatch = useAppDispatch();
  const { view: viewData, loading, error: detailsError } = useAppSelector(selectRequesterInvoiceDetailsState);
  const [viewPaymentInvoiceId, setViewPaymentInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setViewPaymentInvoiceId(null);
    dispatch(clearRequesterInvoiceDetails());
  }, [dispatch, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmedId = requesterId?.trim();
    if (!trimmedId) {
      dispatch(clearRequesterInvoiceDetails());
      return;
    }
    void dispatch(
      fetchRequesterInvoiceDetails({
        requesterId: trimmedId,
        requesterName,
      })
    );
  }, [dispatch, isOpen, requesterId, requesterName]);

  const loadError = !requesterId?.trim() && isOpen
    ? S.ERRORS.REQUESTER_REQUIRED
    : detailsError;

  const apiSummary = viewData?.summary;
  const displayName =
    (apiSummary?.requesterName ?? '').trim() || requesterName?.trim() || 'Requester';
  const summary = {
    totalInvoices: apiSummary?.totalInvoices ?? 0,
    totalInvoiceAmount: apiSummary?.totalInvoiceAmount ?? 0,
    totalPaid: apiSummary?.totalPaid ?? 0,
    totalRemaining: apiSummary?.totalRemaining ?? 0,
    availablePaymentBalance: apiSummary?.availableBalance ?? 0,
  };

  const visibleRows = viewData?.invoices.data ?? [];

  const paymentInvoiceHeader = useMemo(() => {
    if (!viewPaymentInvoiceId) return undefined;
    const invoice = visibleRows.find((row) => String(row.invoicesID) === viewPaymentInvoiceId);
    if (!invoice) return undefined;
    return {
      invoiceNo: invoice.invoiceNo,
      billingToName: invoice.billingToName,
      dateCreated: invoice.dateCreated,
      dueDate: invoice.dueDate,
    };
  }, [viewPaymentInvoiceId, visibleRows]);

  const handleViewAllocations = useCallback((invoicesId: string) => {
    setViewPaymentInvoiceId(invoicesId);
  }, []);

  const invoiceColumns: DataTableColumn<InvoiceDto>[] = useMemo(
    () => [
      {
        key: 'invoiceNo',
        label: S.TABLE.INVOICE_NO,
        render: (_value, row) => (
          <SMSChip
            label={(row.invoiceNo ?? '').trim() || '—'}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        ),
      },
      {
        key: 'invoiceDate',
        label: S.TABLE.INVOICE_DATE,
        render: (_value, row) =>
          row.dateCreated ? formatDateShort(row.dateCreated) : '—',
      },
      {
        key: 'invoiceAmount',
        label: S.TABLE.INVOICE_AMOUNT,
        render: (_value, row) => formatPaymentCurrency(row.total ?? 0),
      },
      {
        key: 'paid',
        label: S.TABLE.PAID,
        render: (_value, row) => formatPaymentCurrency(row.paymentsApplied ?? 0),
      },
      {
        key: 'remaining',
        label: S.TABLE.REMAINING,
        render: (_value, row) => formatPaymentCurrency(invoiceRemaining(row)),
      },
      {
        key: 'invoiceState',
        label: S.TABLE.STATUS,
        noClamp: true,
        render: (_value, row) => statusBadge(invoiceSettlementStatus(row)),
      },
      {
        key: 'rowAction',
        label: S.TABLE.ACTION,
        noClamp: true,
        align: 'center',
        render: (_value, row) => (
          <SMSIconButton
            size="small"
            tone="primary"
            allowWhenSuspended
            onClick={(e) => {
              e.stopPropagation();
              handleViewAllocations(String(row.invoicesID));
            }}
            title={S.VIEW_BUTTON}
            aria-label={S.VIEW_BUTTON}
            sx={{ borderRadius: 1 }}
          >
            <SMSIcon name="eye" size="sm" />
          </SMSIconButton>
        ),
      },
    ],
    [handleViewAllocations]
  );

  return (
    <SMSDialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      className="requester-invoice-details-modal"
    >
      <SMSStandardDialogHeader title={S.TITLE} onClose={onClose} showCloseButton />
      <SMSDialogContent sx={{ pt: 1 }}>
        <SMSTypography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{displayName}</span>
        </SMSTypography>

        {loading ? (
          <SMSBox sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 192 }}>
            <SMSLoader loadingText={S.LOADING} aria-label={S.LOADING} />
          </SMSBox>
        ) : loadError ? (
          <SMSTypography color="error" role="alert">
            {loadError}
          </SMSTypography>
        ) : (
          <SMSStack spacing={2}>
            <StatisticSlate
              gridTemplateColumns={{
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(5, 1fr)',
              }}
              items={[
                { key: 'totalInvoices', label: S.SUMMARY.TOTAL_INVOICES, value: summary.totalInvoices },
                {
                  key: 'totalInvoiceAmount',
                  label: S.SUMMARY.TOTAL_INVOICE_AMOUNT,
                  value: formatPaymentCurrency(summary.totalInvoiceAmount),
                },
                {
                  key: 'totalPaid',
                  label: S.SUMMARY.TOTAL_PAID,
                  value: formatPaymentCurrency(summary.totalPaid),
                  valueTone: 'paid',
                },
                {
                  key: 'totalRemaining',
                  label: S.SUMMARY.TOTAL_REMAINING,
                  value: formatPaymentCurrency(summary.totalRemaining),
                  valueTone: 'remaining',
                },
                {
                  key: 'availableBalance',
                  label: S.SUMMARY.AVAILABLE_PAYMENT_BALANCE,
                  value: formatPaymentCurrency(summary.availablePaymentBalance),
                },
              ]}
            />

            <SMSTypography variant="subtitle1" fontWeight={600}>
              {S.INVOICES_TITLE}
            </SMSTypography>

            <SMSDataTableWrapper<InvoiceDto>
              embedded
              columns={invoiceColumns}
              data={visibleRows}
              loading={false}
              emptyMessage={S.TABLE.NO_INVOICES}
              showHeaderWhenEmpty
              renderEmptyAsTable
              tableClassName="requester-invoice-details-modal__data-table"
              getRowKey={(row) => String(row.invoicesID)}
              maxBodyHeight="min(360px, 50vh)"
            />
          </SMSStack>
        )}
      </SMSDialogContent>
      <SMSDialogActions sx={{ justifyContent: 'flex-end', px: 3, pb: 2 }}>
        <SMSButton variant="outlined" onClick={onClose} allowWhenSuspended>
          {S.CLOSE}
        </SMSButton>
      </SMSDialogActions>

      <InvoicePaymentModal
        isOpen={viewPaymentInvoiceId != null}
        invoicesId={viewPaymentInvoiceId}
        invoiceHeader={paymentInvoiceHeader}
        readOnly
        title={S.ALLOCATION_MODAL_TITLE}
        onClose={() => setViewPaymentInvoiceId(null)}
      />
    </SMSDialog>
  );
};
