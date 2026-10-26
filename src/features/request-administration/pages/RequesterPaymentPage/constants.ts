import { PAYMENT_GRID } from '@/constants/strings';
import { formatDateToYYYYMMDD, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';

export const S = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE;
export const PLACEHOLDER = PAYMENT_GRID.EMPTY_PLACEHOLDER;
export const REQUESTER_INVOICE_TABLE = PAYMENT_GRID.REQUESTER_INVOICE_DETAILS.TABLE;
export const PAYMENT_DETAIL_TABLE = PAYMENT_GRID.PAYMENT_DETAIL.TABLE;

const PAYMENT_DATE_RANGE_DAYS = 30;

export const getDefaultPaymentDateRange = (): { startDate: string; endDate: string } => {
  const endDate = getLocalTodayYyyyMmDd();
  const start = new Date();
  start.setDate(start.getDate() - PAYMENT_DATE_RANGE_DAYS);
  return { startDate: formatDateToYYYYMMDD(start), endDate };
};

export const emptyRequesterSummary = (requesterId: string) => ({
  requesterId: requesterId.trim(),
  totalAmount: 0,
  totalInvoiceDueAmount: 0,
  totalAppliedAmount: 0,
  totalRefundedAmount: 0,
  totalAvailableAmount: 0,
  requesterAvailableAmount: 0,
  totalRecords: 0,
  payments: [],
});

export const emptyRequesterRefundSummary = (requesterId: string) => ({
  requesterId: requesterId.trim(),
  totalAmount: 0,
  totalRecords: 0,
  refunds: [],
});
