import { Stack } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import { SMSButton, SMSCheckbox, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import type { DataTableColumn } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import {
  InvoiceSettlementStatus,
  type PaymentDetailInvoiceDto,
  type RefundPaymentAllocationDetailDto,
  type RequesterPaymentRowDto,
  type RequesterRefundPaymentRowDto,
} from '@/types/payment';
import { formatDateShort } from '@/utils';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import type { RequesterPaymentColumnHandlers } from '@/types/requesterPaymentPage';
import { PAYMENT_DETAIL_TABLE, PLACEHOLDER, REQUESTER_INVOICE_TABLE, S } from './constants';

const COL = S.TABLE.COLUMNS;

const resolveRowPaymentId = (row: RequesterPaymentRowDto): string =>
  row.paymentId?.trim() ?? '';

const paymentTypeLabel = (paymentTypeName?: string | null): string =>
  paymentTypeName?.trim() || '—';

const resolveProcessedBy = (row: {
  createdBy?: string | null;
  editedBy?: string | null;
}): string => {
  const value = (row.editedBy?.trim() ? row.editedBy : row.createdBy)?.trim();
  return value || PLACEHOLDER;
};

const processedByCell = (name: string) => {
  if (!name || name === PLACEHOLDER) {
    return PLACEHOLDER;
  }

  return (
    <Tooltip title={name} placement="top" arrow describeChild>
      <span className="requester-payment-page__processed-by">{name}</span>
    </Tooltip>
  );
};

const amountCell = (value: number) => (
  <span className="requester-payment-page__amount">{formatPaymentCurrency(value)}</span>
);

const paymentDataColumns: DataTableColumn<RequesterPaymentRowDto>[] = [
  {
    key: 'paymentNumber',
    label: COL.PAYMENT_NUMBER,
    render: (_v, row) =>
      row.paymentNumber != null && String(row.paymentNumber).trim() !== ''
        ? String(row.paymentNumber)
        : PLACEHOLDER,
  },
  {
    key: 'date',
    label: COL.DATE,
    render: (_v, row) => (row.paymentDate ? formatDateShort(row.paymentDate) : PLACEHOLDER),
  },
  {
    key: 'amountPaid',
    label: COL.AMOUNT_PAID,
    align: 'left',
    render: (_v, row) => amountCell(row.amount ?? 0),
  },
  {
    key: 'appliedAmount',
    label: COL.APPLIED_AMOUNT,
    align: 'left',
    render: (_v, row) => amountCell(row.appliedAmount ?? 0),
  },
  {
    key: 'refundedAmount',
    label: COL.REFUNDED_AMOUNT,
    align: 'left',
    render: (_v, row) => amountCell(row.refundedAmount ?? 0),
  },
  {
    key: 'availableAmount',
    label: COL.AVAILABLE_AMOUNT,
    align: 'left',
    render: (_v, row) => amountCell(row.availableAmount ?? 0),
  },
  {
    key: 'paymentType',
    label: COL.PAYMENT_TYPE,
    render: (_v, row) => paymentTypeLabel(row.paymentTypeName) || PLACEHOLDER,
  },
  {
    key: 'referenceNumber',
    label: COL.REFERENCE_NUMBER,
    align: 'left',
    render: (_v, row) => row.referenceNumber?.trim() || PLACEHOLDER,
  },
  {
    key: 'processedBy',
    label: COL.PROCESSED_BY,
    render: (_v, row) => processedByCell(resolveProcessedBy(row)),
  },
];

export const buildRequesterPaymentColumns = (
  handlers: RequesterPaymentColumnHandlers
): DataTableColumn<RequesterPaymentRowDto>[] => [
  ...paymentDataColumns,
  {
    key: 'action',
    label: COL.ACTION,
    noClamp: true,
    render: (_v, row) => (
      <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap>
        <SMSIconButton
          size="small"
          tone="primary"
          allowWhenSuspended
          onClick={(e) => {
            e.stopPropagation();
            handlers.onView(row);
          }}
          title={PAYMENT_GRID.TABLE.VIEW}
          aria-label={PAYMENT_GRID.TABLE.VIEW}
          sx={{ borderRadius: 1 }}
        >
          <SMSIcon name="eye" size="sm" />
        </SMSIconButton>
        <SMSIconButton
          size="small"
          tone="primary"
          allowWhenSuspended
          onClick={(e) => {
            e.stopPropagation();
            void handlers.onEdit(row);
          }}
          title={PAYMENT_GRID.TABLE.EDIT}
          aria-label={PAYMENT_GRID.TABLE.EDIT}
          sx={{ borderRadius: 1 }}
        >
          <SMSIcon name="edit" size="sm" />
        </SMSIconButton>
        <SMSButton
          size="small"
          variant="contained"
          onClick={(e) => {
            e.stopPropagation();
            handlers.onSettle(row);
          }}
          allowWhenSuspended
          disabled={row.allocationStatus === InvoiceSettlementStatus.Paid}
        >
          {S.TABLE.SETTLE}
        </SMSButton>
        <SMSIconButton
          size="small"
          tone="error"
          allowWhenSuspended
          onClick={(e) => {
            e.stopPropagation();
            handlers.onDelete(row);
          }}
          title={PAYMENT_GRID.TABLE.DELETE ?? 'Delete'}
          aria-label={PAYMENT_GRID.TABLE.DELETE ?? 'Delete'}
          sx={{ borderRadius: 1 }}
        >
          <SMSIcon name="delete" size="sm" />
        </SMSIconButton>
      </Stack>
    ),
  },
];

export const buildRefundablePaymentSelectColumns = (
  selectedPaymentIds: ReadonlySet<string>,
  onToggleRow: (row: RequesterPaymentRowDto, selected: boolean) => void,
  onToggleAllOnPage: (rows: RequesterPaymentRowDto[], selected: boolean) => void,
  pageRows: RequesterPaymentRowDto[] = []
): DataTableColumn<RequesterPaymentRowDto>[] => {
  const allSelected =
    pageRows.length > 0 &&
    pageRows.every((row) => {
      const paymentId = resolveRowPaymentId(row);
      return paymentId ? selectedPaymentIds.has(paymentId) : false;
    });
  const someSelected =
    pageRows.some((row) => selectedPaymentIds.has(resolveRowPaymentId(row))) && !allSelected;

  const selectColumn: DataTableColumn<RequesterPaymentRowDto> = {
    key: 'select',
    align: 'center',
    noClamp: true,
    label: (
      <span className="requester-payment-page__select-all-header">
        <SMSCheckbox
          label={PAYMENT_GRID.SETTLE_PENDING_INVOICES.TABLE.SELECT}
          checked={allSelected}
          indeterminate={someSelected}
          disabled={pageRows.length === 0}
          onChange={() => onToggleAllOnPage(pageRows, !allSelected)}
          className="requester-payment-page__table-checkbox requester-payment-page__table-checkbox--header"
        />
      </span>
    ),
    render: (_v, row) => {
      const paymentId = resolveRowPaymentId(row);
      if (!paymentId) {
        return <span className="requester-payment-page__select-cell" aria-hidden />;
      }
      return (
        <span className="requester-payment-page__select-cell">
          <SMSCheckbox
            label={PAYMENT_GRID.SETTLE_PENDING_INVOICES.TABLE.SELECT}
            checked={selectedPaymentIds.has(paymentId)}
            onChange={(checked) => onToggleRow(row, checked)}
            className="requester-payment-page__table-checkbox"
          />
        </span>
      );
    },
  };

  return [
    selectColumn,
    ...paymentDataColumns.map((column) =>
      column.key === 'paymentNumber' || column.key === 'processedBy' || column.key === 'date'
        ? { ...column, noClamp: true }
        : column
    ),
  ];
};

const resolveRefundPaymentId = (row: RequesterRefundPaymentRowDto): string =>
  row.refundPaymentId?.trim() ?? '';

export const buildRequesterRefundPaymentColumns = (
  onView: (row: RequesterRefundPaymentRowDto) => void,
  onDelete?: (row: RequesterRefundPaymentRowDto) => void
): DataTableColumn<RequesterRefundPaymentRowDto>[] => {
  const refundColumns = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.REFUND_TABLE.COLUMNS;

  return [
    {
      key: 'refundPaymentNumber',
      label: refundColumns.REFUND_NUMBER,
      render: (_v, row) =>
        row.refundPaymentNumber != null && String(row.refundPaymentNumber).trim() !== ''
          ? String(row.refundPaymentNumber)
          : PLACEHOLDER,
    },
    {
      key: 'date',
      label: refundColumns.DATE,
      render: (_v, row) => (row.paymentDate ? formatDateShort(row.paymentDate) : PLACEHOLDER),
    },
    {
      key: 'amount',
      label: refundColumns.AMOUNT,
      align: 'left',
      render: (_v, row) => amountCell(row.amount ?? 0),
    },
    {
      key: 'paymentType',
      label: refundColumns.PAYMENT_TYPE,
      render: (_v, row) => paymentTypeLabel(row.paymentTypeName) || PLACEHOLDER,
    },
    {
      key: 'referenceNumber',
      label: refundColumns.REFERENCE_NUMBER,
      align: 'left',
      render: (_v, row) => row.referenceNumber?.trim() || PLACEHOLDER,
    },
    {
      key: 'processedBy',
      label: refundColumns.PROCESSED_BY,
      render: (_v, row) => processedByCell(resolveProcessedBy(row)),
    },
    {
      key: 'action',
      label: refundColumns.ACTION,
      noClamp: true,
      render: (_v, row) => (
        <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap>
          <SMSIconButton
            size="small"
            tone="primary"
            allowWhenSuspended
            disabled={!resolveRefundPaymentId(row)}
            onClick={(e) => {
              e.stopPropagation();
              onView(row);
            }}
            title={PAYMENT_GRID.TABLE.VIEW}
            aria-label={PAYMENT_GRID.TABLE.VIEW}
            sx={{ borderRadius: 1 }}
          >
            <SMSIcon name="eye" size="sm" />
          </SMSIconButton>
          {onDelete && (
            <SMSIconButton
              size="small"
              tone="error"
              allowWhenSuspended
              disabled={!resolveRefundPaymentId(row)}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row);
              }}
              title={PAYMENT_GRID.TABLE.DELETE ?? 'Delete'}
              aria-label={PAYMENT_GRID.TABLE.DELETE ?? 'Delete'}
              sx={{ borderRadius: 1 }}
            >
              <SMSIcon name="delete" size="sm" />
            </SMSIconButton>
          )}
        </Stack>
      ),
    },
  ];
};

export const buildRefundPaymentDetailColumns = (
  onVoid?: (row: RefundPaymentAllocationDetailDto) => void
): DataTableColumn<RefundPaymentAllocationDetailDto>[] => {
  const detailColumns = PAYMENT_GRID.REFUND_DETAIL.TABLE;

  const columns: DataTableColumn<RefundPaymentAllocationDetailDto>[] = [
    {
      key: 'paymentNumber',
      label: detailColumns.PAYMENT_NUMBER,
      render: (_v, row) => row.paymentNumber?.trim() || PLACEHOLDER,
    },
    {
      key: 'paymentDate',
      label: detailColumns.DATE,
      render: (_v, row) => (row.paymentDate ? formatDateShort(row.paymentDate) : PLACEHOLDER),
    },
    {
      key: 'amountApplied',
      label: detailColumns.REFUND_AMOUNT,
      align: 'left',
      render: (_v, row) => formatPaymentCurrency(row.amountApplied ?? 0),
    },
    {
      key: 'paymentType',
      label: detailColumns.PAYMENT_TYPE,
      render: (_v, row) => paymentTypeLabel(row.paymentTypeName) || PLACEHOLDER,
    },
    {
      key: 'referenceNumber',
      label: detailColumns.REFERENCE_NUMBER,
      align: 'left',
      render: (_v, row) => row.referenceNumber?.trim() || PLACEHOLDER,
    },
  ];

  if (onVoid) {
    columns.push({
      key: 'actions',
      label: '',
      align: 'right',
      render: (_v, row) => (
        <SMSIconButton
          size="small"
          tone="error"
          allowWhenSuspended
          disabled={!row.refundPaymentAllocationID?.trim()}
          onClick={(e) => {
            e.stopPropagation();
            onVoid(row);
          }}
          title={PAYMENT_GRID.TABLE.DELETE ?? 'Void'}
          aria-label={PAYMENT_GRID.TABLE.DELETE ?? 'Void'}
          sx={{ borderRadius: 1 }}
        >
          <SMSIcon name="delete" size="sm" />
        </SMSIconButton>
      ),
    });
  }

  return columns;
};

export const buildPaymentDetailColumns = (
  onViewInvoice: (invoiceId: string) => void
): DataTableColumn<PaymentDetailInvoiceDto>[] => [
  {
    key: 'invoiceNo',
    label: REQUESTER_INVOICE_TABLE.INVOICE_NO,
    render: (_v, row) => row.invoiceNo?.trim() || PLACEHOLDER,
  },
  {
    key: 'invoiceDate',
    label: REQUESTER_INVOICE_TABLE.INVOICE_DATE,
    render: (_v, row) => (row.invoiceDate ? formatDateShort(row.invoiceDate) : PLACEHOLDER),
  },
  {
    key: 'invoiceAmount',
    label: PAYMENT_DETAIL_TABLE.INVOICE_TOTAL,
    align: 'left',
    render: (_v, row) => formatPaymentCurrency(row.invoiceAmount ?? 0),
  },
  {
    key: 'paidAmount',
    label: PAYMENT_DETAIL_TABLE.AMOUNT_PAID,
    align: 'left',
    render: (_v, row) => formatPaymentCurrency(row.paidAmount ?? 0),
  },
  {
    key: 'dueAmount',
    label: PAYMENT_DETAIL_TABLE.BALANCE_DUE,
    align: 'left',
    render: (_v, row) => formatPaymentCurrency(row.dueAmount ?? 0),
  },
  {
    key: 'status',
    label: REQUESTER_INVOICE_TABLE.STATUS,
    align: 'left',
    render: (_v, row) =>
      (row.dueAmount ?? 0) <= 0.001 ? PAYMENT_GRID.STATUS.PAID : PAYMENT_GRID.STATUS.PARTIAL,
  },
  {
    key: 'action',
    label: REQUESTER_INVOICE_TABLE.ACTION,
    noClamp: true,
    render: (_v, row) => {
      const invoiceId = row.invoiceId?.trim();
      return (
        <SMSIconButton
          size="small"
          tone="primary"
          allowWhenSuspended
          disabled={!invoiceId}
          onClick={(e) => {
            e.stopPropagation();
            if (invoiceId) onViewInvoice(invoiceId);
          }}
          title={PAYMENT_GRID.TABLE.VIEW}
          aria-label={PAYMENT_GRID.TABLE.VIEW}
          sx={{ borderRadius: 1 }}
        >
          <SMSIcon name="eye" size="sm" />
        </SMSIconButton>
      );
    },
  },
];
