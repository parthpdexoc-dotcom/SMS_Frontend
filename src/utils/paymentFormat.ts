import { PAYMENT_GRID } from '@/constants/strings';

/** USD display for payment grids and modals. */
export const formatPaymentCurrency = (value?: number | null): string => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return PAYMENT_GRID.EMPTY_PLACEHOLDER;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return String(amount);
  }
};
