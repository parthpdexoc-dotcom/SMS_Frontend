import type { DataTableColumn } from '@/components/smsorganisms';
import { S } from './constants';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { formatDateShort } from '@/utils';
import type { RequesterLedgerDto } from '@/types/requesterLedger';
import { RequesterLedgerTransactionType } from '@/types/requesterLedger';

const amountCell = (value?: number | null) =>
  value != null && value > 0 ? (
    <span className="requester-statement-page__amount">{formatPaymentCurrency(value)}</span>
  ) : (
    S.EMPTY_PLACEHOLDER
  );

const balanceCell = (value?: number | null) =>
  value != null ? (
    <span className="requester-statement-page__amount">{formatPaymentCurrency(value)}</span>
  ) : (
    S.EMPTY_PLACEHOLDER
  );

export const statementTableColumns: DataTableColumn<RequesterLedgerDto>[] = [
  {
    key: 'openingBalance',
    label: S.TABLE.COLUMNS.OPENING_BALANCE,
    render: (_value, row) => balanceCell(row.openingBalance),
  },
  {
    key: 'transactionDateTime',
    label: S.TABLE.COLUMNS.DATE,
    render: (_value, row) =>
      row.transactionDateTime ? formatDateShort(row.transactionDateTime) : S.EMPTY_PLACEHOLDER,
  },
  {
    key: 'description',
    label: S.TABLE.COLUMNS.DESCRIPTION,
    noClamp: true,
    render: (_value, row) => row.description?.trim() || S.EMPTY_PLACEHOLDER,
  },
  {
    key: 'amount',
    label: S.TABLE.COLUMNS.AMOUNT,
    render: (_value, row) =>
      row.transactionType === RequesterLedgerTransactionType.Debit
        ? amountCell(row.amount)
        : S.EMPTY_PLACEHOLDER,
  },
  {
    key: 'payment',
    label: S.TABLE.COLUMNS.PAYMENT,
    render: (_value, row) =>
      row.transactionType === RequesterLedgerTransactionType.Credit
        ? amountCell(row.amount)
        : S.EMPTY_PLACEHOLDER,
  },
  {
    key: 'balance',
    label: S.TABLE.COLUMNS.BALANCE,
    render: (_value, row) => balanceCell(row.balance),
  },
];
