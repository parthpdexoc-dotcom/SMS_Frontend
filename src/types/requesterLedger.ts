/** Mirrors backend `RequesterLedgerTransactionType` enum. */
export enum RequesterLedgerTransactionType {
  Debit = 1,
  Credit = 2,
}

/** Mirrors backend `RequesterLedgerSourceType` enum. */
export enum RequesterLedgerSourceType {
  Invoice = 1,
  Payment = 2,
  Refund = 3,
}

/** Mirrors backend `RequesterLedgerDto`. */
export interface RequesterLedgerDto {
  requesterLedgerID?: string | null;
  requesterID?: string | null;
  departmentID?: string | null;
  description?: string | null;
  transactionDateTime?: string | null;
  openingBalance?: number | null;
  amount?: number | null;
  transactionType?: RequesterLedgerTransactionType | null;
  balance?: number | null;
  sourceType?: RequesterLedgerSourceType | null;
  sourceID?: string | null;
  sourceNumber?: string | null;
  requesterName?: string | null;
}

/** Mirrors backend `RequesterLedgerStatementDto`. */
export interface RequesterLedgerStatementDto {
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number | null;
  totalInvoices?: number | null;
  totalPayment?: number | null;
  outstandingInvoices?: number | null;
  entries?: RequesterLedgerDto[] | {
    data?: RequesterLedgerDto[] | null;
    Data?: RequesterLedgerDto[] | null;
    totalRecords?: number;
    TotalRecords?: number;
  } | null;
}

export interface RequesterStatementPageProps {
  requesterId: string;
  requesterName?: string;
  returnPath?: string;
  returnState?: unknown;
}

export interface FetchRequesterLedgerStatementArgs {
  requesterId: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
  page: number;
  pageSize: number;
}
