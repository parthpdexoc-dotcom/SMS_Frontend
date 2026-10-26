import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  SMSButton,
  SMSCheckbox,
  SMSChip,
  SMSDatePicker,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
  SMSDropdown,
  SMSIcon,
  SMSTextField,
  SMSTypography,
  SMSStandardDialogHeader,
} from '@/components/smsatoms';
import { PaymentVoidReasonConfirmDialog } from '@/components/smsmolecules/PaymentVoidReasonConfirmDialog';
import { EditablePaymentSlate } from '@/components/smsmolecules/EditablePaymentSlate';
import { InvoiceAmountSummaryBox } from '@/components/smsmolecules/InvoiceAmountSummaryBox';
import {
  PaymentModalSlate,
  buildPaymentInfoMetaFields,
} from '@/components/smsmolecules/PaymentModalSlate';
import { formatPaymentCurrency } from '@/utils/paymentFormat';
import { SMSDataTableWrapper, type DataTableColumn } from '@/components/smsorganisms';
import { PAYMENT_GRID } from '@/constants/strings';
import type { SettlePendingInvoiceRow, SettlePendingInvoicesModalProps } from '@/types/payment';
import { formatDateShort } from '@/utils';
import './SettlePendingInvoicesModal.css';

const S = PAYMENT_GRID.SETTLE_PENDING_INVOICES;
const SLATE_STATS = PAYMENT_GRID.MODAL_SLATE_STATS;
const COL = PAYMENT_GRID.REQUESTER_PAYMENT_PAGE.TABLE.COLUMNS;
const FORM = PAYMENT_GRID.FORM;

const parseAmount = (value: string): number => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/** Balance due on unpaid invoices (pending settle). */
const invoiceBalanceDue = (row: SettlePendingInvoiceRow) => row.dueAmount ?? 0;

/** Readjust only: max new allocation = already allocated from this payment + remaining invoice balance. */
const readjustApplyCap = (row: SettlePendingInvoiceRow): number => {
  const allocated = row.dueAmount ?? row.paidAmount ?? 0;
  const balanceDue = row.balanceDue;
  if (balanceDue != null && Number.isFinite(balanceDue)) {
    const fullAmount = allocated + Math.max(0, balanceDue);
    const invoiceTotal = row.invoiceAmount;
    if (invoiceTotal != null && Number.isFinite(invoiceTotal) && invoiceTotal >= 0) {
      return Math.min(fullAmount, invoiceTotal);
    }
    return fullAmount;
  }
  const total = row.invoiceAmount;
  if (total != null && Number.isFinite(total) && total >= 0) return total;
  return allocated;
};

const rowApplyCap = (row: SettlePendingInvoiceRow, readjust: boolean): number =>
  readjust ? readjustApplyCap(row) : invoiceBalanceDue(row);

/** Full is checked when the row amount equals the applicable cap (balance due in readjust). */
const isFullBalancePayment = (
  row: SettlePendingInvoiceRow,
  amount: number,
  readjust: boolean
): boolean => Math.abs(amount - rowApplyCap(row, readjust)) <= 0.001;

const rowInvoiceId = (row: SettlePendingInvoiceRow) => row.invoiceId?.trim() ?? '';

const rowPaymentAllocationId = (row: SettlePendingInvoiceRow) =>
  row.paymentAllocationId?.trim() ?? '';

/** Readjust rows are keyed by allocation (same invoice may appear more than once). */
const rowKey = (row: SettlePendingInvoiceRow, readjust: boolean): string =>
  readjust ? rowPaymentAllocationId(row) || rowInvoiceId(row) : rowInvoiceId(row);

const getRowApplyAmountCapped = (
  row: SettleRowState,
  maxAvailable: number,
  readjust: boolean
): number => {
  const cap = Math.min(rowApplyCap(row, readjust), maxAvailable);
  if (row.fullPayment) return cap;
  return Math.min(parseAmount(row.customAmount), cap);
};

const sumReadjustRowAmounts = (inputRows: SettleRowState[]): number =>
  inputRows.reduce((total, row) => total + parseAmount(row.customAmount), 0);

/** New allocation minus current allocated amount (positive = applying more from escrow). */
const getReadjustAdjustDelta = (row: SettleRowState): number =>
  parseAmount(row.customAmount) - getReadjustOriginalAmount(row);

const getReadjustOriginalAmount = (row: SettleRowState): number =>
  row.dueAmount ?? row.paidAmount ?? 0;

const hasReadjustRowAmountChanges = (inputRows: SettleRowState[]): boolean =>
  inputRows.some(
    (row) => Math.abs(parseAmount(row.customAmount) - getReadjustOriginalAmount(row)) > 0.001
  );

/** True when the user edited a row and set the new allocation to zero (not allowed — use Void). */
const isReadjustInvalidZeroAmount = (row: SettleRowState): boolean => {
  const amount = parseAmount(row.customAmount);
  const original = getReadjustOriginalAmount(row);
  const edited = Math.abs(amount - original) > 0.001;
  return edited && amount <= 0.001;
};

const hasReadjustInvalidZeroAmounts = (inputRows: SettleRowState[]): boolean =>
  inputRows.some(isReadjustInvalidZeroAmount);

/** Apply mode: selected row with a $0 payment amount (including cleared input) is not allowed. */
const isApplyInvalidZeroAmount = (row: SettleRowState): boolean => {
  if (!row.selected) return false;
  return parseAmount(row.customAmount) <= 0.001;
};

const hasApplyInvalidZeroAmounts = (inputRows: SettleRowState[]): boolean =>
  inputRows.some(isApplyInvalidZeroAmount);

const getEscrowAvailableForRow = (
  target: SettleRowState,
  allRows: SettleRowState[],
  escrowTotal: number,
  readjust: boolean
): number => {
  let used = 0;
  for (const row of allRows) {
    if (rowKey(row, readjust) === rowKey(target, readjust)) continue;
    if (!readjust && !row.selected) continue;
    const available = Math.max(0, escrowTotal - used);
    used += getRowApplyAmountCapped(row, available, readjust);
  }
  return Math.max(0, escrowTotal - used);
};

/** Re-cap selected row amounts so they do not exceed remaining escrow. */
const recapRowsEscrow = (
  inputRows: SettleRowState[],
  escrowTotal: number,
  readjust: boolean
): SettleRowState[] => {
  let used = 0;
  return inputRows.map((row) => {
    if (!readjust && !row.selected) return row;
    const available = Math.max(0, escrowTotal - used);
    const cap = Math.min(rowApplyCap(row, readjust), available);
    const apply = row.fullPayment
      ? cap
      : Math.min(parseAmount(row.customAmount), cap);
    used += apply;
    return {
      ...row,
      customAmount: apply.toFixed(2),
      fullPayment: isFullBalancePayment(row, apply, readjust),
    };
  });
};

const clampCustomAmountInput = (raw: string, maxAmount: number): string => {
  const parsed = parseAmount(raw);
  if (parsed > maxAmount) {
    return maxAmount.toFixed(2);
  }
  return raw;
};

type SettleRowState = SettlePendingInvoiceRow & {
  selected: boolean;
  fullPayment: boolean;
  customAmount: string;
};

const escrowBalanceValueTone = (balance: number): 'paid' | 'due' | 'default' => {
  if (balance < -0.001) return 'due';
  if (balance > 0.001) return 'paid';
  return 'default';
};

const buildRowsState = (rows: SettlePendingInvoiceRow[], readjust: boolean): SettleRowState[] =>
  rows.map((row) => ({
    ...row,
    selected: true,
    fullPayment: !readjust,
    customAmount: (readjust ? (row.dueAmount ?? row.paidAmount ?? 0) : invoiceBalanceDue(row)).toFixed(2),
  }));

export const SettlePendingInvoicesModal: React.FC<SettlePendingInvoicesModalProps> = ({
  isOpen,
  onClose,
  title,
  mode = 'pending',
  totalPayment = 0,
  paymentUsedBefore = 0,
  paymentRefundedBefore = 0,
  oldPaymentAmount,
  invoiceRows,
  loading = false,
  error = null,
  submitting = false,
  onSubmit,
  pagination,
  paymentInfo,
  createPhase = null,
  paymentEntry,
  onPaymentEntryChange,
  paymentEntryErrors,
  onSaveNewPayment,
  paymentTypeOptions = [],
  paymentTypesLoading = false,
  readjustAppliedAmount = 0,
  readjustAdjustAmount = '',
  readjustPaymentFields,
  onReadjustPaymentFieldsChange,
  readjustHasPaymentDetailsEdit = false,
  isEditingReadjustAmount = false,
  onReadjustAdjustAmountChange,
  onToggleReadjustAmountEdit,
  onVoidAllocation,
  voidingPaymentAllocationId = null,
  skippedAllocationIds = [],
  submitError = null,
  onClearSubmitError,
  enableAllocationEditing = false,
}) => {
  const isReadjust = mode === 'readjust';
  const isCreateEntry = createPhase === 'entry';
  const showApplySection = !isCreateEntry;
  const sourceRows = invoiceRows ?? [];
  const rowsFromSource = useMemo(
    () => buildRowsState(sourceRows, isReadjust),
    [isReadjust, sourceRows]
  );
  const skippedAllocationIdSet = useMemo(
    () => new Set(skippedAllocationIds.map((id) => id.trim()).filter(Boolean)),
    [skippedAllocationIds]
  );
  const [rows, setRows] = useState<SettleRowState[]>(rowsFromSource);
  const [voidConfirmAllocationId, setVoidConfirmAllocationId] = useState<string | null>(null);
  const editSignatureRef = React.useRef('');

  useEffect(() => {
    const paymentFieldsSignature = readjustPaymentFields
      ? `${readjustPaymentFields.paymentDate}|${readjustPaymentFields.paymentTypeId}|${readjustPaymentFields.referenceNumber}`
      : '';
    const signature = `${readjustAdjustAmount}|${paymentFieldsSignature}|${rows.map((row) => row.customAmount).join('|')}`;
    if (editSignatureRef.current && editSignatureRef.current !== signature && submitError) {
      onClearSubmitError?.();
    }
    editSignatureRef.current = signature;
  }, [onClearSubmitError, readjustAdjustAmount, readjustPaymentFields, rows, submitError]);

  const readjustOriginalAmount = oldPaymentAmount ?? totalPayment;
  const readjustParsedAdjustAmount = parseAmount(readjustAdjustAmount);

  /** Cap for row totals: adjusted draft amount when editing payment, otherwise saved amount. */
  const readjustCapAmount = useMemo(() => {
    if (!isReadjust) return readjustOriginalAmount;
    if (
      readjustParsedAdjustAmount > 0.001 &&
      Math.abs(readjustParsedAdjustAmount - readjustOriginalAmount) > 0.001
    ) {
      return readjustParsedAdjustAmount;
    }
    return readjustOriginalAmount;
  }, [isReadjust, readjustOriginalAmount, readjustParsedAdjustAmount]);

  /** Max total allocatable to invoices after subtracting amounts already refunded. */
  const readjustMaxAllocatable = useMemo(
    () => Math.max(0, readjustCapAmount - paymentRefundedBefore),
    [paymentRefundedBefore, readjustCapAmount]
  );

  /** Saved payment pool — row initial values stay at allocated amounts; do not shrink when adjust amount changes. */
  const escrowForTable = useMemo(
    () =>
      isReadjust
        ? Math.max(0, readjustOriginalAmount - paymentUsedBefore - paymentRefundedBefore)
        : Math.max(0, totalPayment - paymentUsedBefore - paymentRefundedBefore),
    [isReadjust, paymentRefundedBefore, paymentUsedBefore, readjustOriginalAmount, totalPayment]
  );

  const mergeReadjustRowEdits = useCallback(
    (prev: SettleRowState[], rebuilt: SettleRowState[]): SettleRowState[] => {
      const prevByKey = new Map(prev.map((row) => [rowKey(row, true), row]));
      return rebuilt.map((row) => {
        const existing = prevByKey.get(rowKey(row, true));
        if (!existing) return row;
        return {
          ...row,
          customAmount: existing.customAmount,
          fullPayment: existing.fullPayment,
        };
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (!isOpen) return;

    if (isReadjust) {
      setRows((prev) => {
        // After partial submit, show saved server amounts for all rows (updated + skipped).
        if (skippedAllocationIdSet.size > 0) {
          return rowsFromSource;
        }
        return mergeReadjustRowEdits(prev, rowsFromSource);
      });
      return;
    }

    setRows(recapRowsEscrow(rowsFromSource, isReadjust ? readjustCapAmount : escrowForTable, isReadjust));
  }, [
    escrowForTable,
    isOpen,
    isReadjust,
    mergeReadjustRowEdits,
    readjustCapAmount,
    rowsFromSource,
    skippedAllocationIdSet,
  ]);

  const updateRow = useCallback(
    (key: string, patch: Partial<SettleRowState>) => {
      setRows((prev) =>
        prev.map((row) => (rowKey(row, isReadjust) === key ? { ...row, ...patch } : row))
      );
    },
    [isReadjust]
  );

  const allRowsSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => row.selected),
    [rows]
  );

  const someRowsSelected = useMemo(
    () => rows.some((row) => row.selected) && !allRowsSelected,
    [allRowsSelected, rows]
  );

  const handleToggleSelectAllPending = useCallback(() => {
    setRows((prev) => {
      const shouldSelectAll = !(prev.length > 0 && prev.every((row) => row.selected));
      const next = prev.map((row) => {
        if (shouldSelectAll) {
          return { ...row, selected: true };
        }
        return { ...row, selected: false };
      });
      return recapRowsEscrow(next, escrowForTable, isReadjust);
    });
  }, [escrowForTable, isReadjust]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);

  const selectedDue = useMemo(
    () => selectedRows.reduce((sum, row) => sum + invoiceBalanceDue(row), 0),
    [selectedRows]
  );

  const amountToApply = useMemo(() => {
    if (isReadjust) {
      return sumReadjustRowAmounts(rows);
    }
    let used = 0;
    return selectedRows.reduce((total, row) => {
      const available = Math.max(0, escrowForTable - used);
      const apply = getRowApplyAmountCapped(row, available, false);
      used += apply;
      return total + apply;
    }, 0);
  }, [escrowForTable, isReadjust, rows, selectedRows]);

  const readjustOverLimit =
    showApplySection && isReadjust && amountToApply > readjustMaxAllocatable + 0.001;

  const readjustOverLimitMessage = useMemo(() => {
    if (!readjustOverLimit) return '';
    return S.READJUST_OVER_LIMIT_DETAIL.replace(
      '{adjusted}',
      formatPaymentCurrency(readjustMaxAllocatable)
    ).replace('{total}', formatPaymentCurrency(amountToApply));
  }, [amountToApply, readjustMaxAllocatable, readjustOverLimit]);

  const readjustHasAllocationEdits = useMemo(
    () => isReadjust && hasReadjustRowAmountChanges(rows),
    [isReadjust, rows]
  );

  const readjustHasPaymentAmountEdit = useMemo(
    () =>
      isReadjust &&
      readjustParsedAdjustAmount > 0.001 &&
      Math.abs(readjustParsedAdjustAmount - readjustOriginalAmount) > 0.001,
    [isReadjust, readjustOriginalAmount, readjustParsedAdjustAmount]
  );

  const readjustAmountBelowRefunded = useMemo(
    () =>
      isReadjust &&
      readjustHasPaymentAmountEdit &&
      paymentRefundedBefore > 0.001 &&
      readjustParsedAdjustAmount + 0.001 < paymentRefundedBefore,
    [isReadjust, paymentRefundedBefore, readjustHasPaymentAmountEdit, readjustParsedAdjustAmount]
  );

  const readjustAmountBelowRefundedMessage = useMemo(() => {
    if (!readjustAmountBelowRefunded) return '';
    return S.READJUST_STATS.AMOUNT_BELOW_REFUNDED_BANNER.replace(
      '{amount}',
      formatPaymentCurrency(paymentRefundedBefore)
    );
  }, [paymentRefundedBefore, readjustAmountBelowRefunded]);

  /** Readjust rows store absolute allocation totals — cap against available balance after refunds. */
  const readjustRowEditCap = useMemo(() => {
    if (!isReadjust) return escrowForTable;
    return readjustMaxAllocatable;
  }, [escrowForTable, isReadjust, readjustMaxAllocatable]);

  const readjustHasInvalidZeroPaymentAmount = useMemo(
    () => isReadjust && isEditingReadjustAmount && readjustParsedAdjustAmount <= 0.001,
    [isEditingReadjustAmount, isReadjust, readjustParsedAdjustAmount]
  );

  const readjustHasInvalidZeroAmounts = useMemo(
    () => isReadjust && hasReadjustInvalidZeroAmounts(rows),
    [isReadjust, rows]
  );

  const applyHasInvalidZeroAmounts = useMemo(
    () => !isReadjust && hasApplyInvalidZeroAmounts(rows),
    [isReadjust, rows]
  );

  const voidConfirmRow = useMemo(() => {
    const allocationId = voidConfirmAllocationId?.trim();
    if (!allocationId) return null;
    return rows.find((row) => rowPaymentAllocationId(row) === allocationId) ?? null;
  }, [rows, voidConfirmAllocationId]);

  const voidConfirmMessage = useMemo(() => {
    if (!voidConfirmRow) return S.VOID_ALLOCATION.CONFIRM.MESSAGE_FALLBACK;
    const amount = formatPaymentCurrency(getReadjustOriginalAmount(voidConfirmRow));
    return S.VOID_ALLOCATION.CONFIRM.MESSAGE.replace('{amount}', amount);
  }, [voidConfirmRow]);

  const parseEntryAmount = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const entryAmount = paymentEntry ? parseEntryAmount(paymentEntry.amount) : null;
  const canSaveNewPayment =
    isCreateEntry &&
    !submitting &&
    Boolean(paymentEntry?.paymentDate.trim()) &&
    entryAmount != null &&
    entryAmount > 0;

  const invoiceDueTotal = useMemo(
    () => rows.reduce((sum, row) => sum + invoiceBalanceDue(row), 0),
    [rows]
  );

  const totalPaymentUsed = useMemo(
    () => paymentUsedBefore + amountToApply,
    [amountToApply, paymentUsedBefore]
  );

  const remainingAvailableBalance = useMemo(
    () => Math.max(0, escrowForTable - amountToApply),
    [amountToApply, escrowForTable]
  );

  const selectAllTooltip = allRowsSelected ? S.UNSELECT_ALL : S.SELECT_ALL;

  const getSkippedRowClassName = useCallback(
    (row: SettleRowState) => {
      const allocationId = rowPaymentAllocationId(row);
      if (!allocationId || !skippedAllocationIdSet.has(allocationId)) return undefined;
      return 'settle-pending-invoices-modal__row--skipped';
    },
    [skippedAllocationIdSet]
  );

  const slateMetaFields = useMemo(() => {
    if (!paymentInfo) return undefined;

    if (isReadjust && readjustPaymentFields && onReadjustPaymentFieldsChange) {
      const paymentNumber =
        paymentInfo.paymentNumber != null && String(paymentInfo.paymentNumber).trim() !== ''
          ? String(paymentInfo.paymentNumber)
          : PAYMENT_GRID.EMPTY_PLACEHOLDER;

      return [
        {
          key: 'paymentNumber',
          label: COL.PAYMENT_NUMBER,
          value: paymentNumber,
          sub: paymentInfo.requesterName?.trim() || undefined,
        },
        {
          key: 'paymentDate',
          label: COL.DATE,
          value: (
            <SMSDatePicker
              label=""
              value={readjustPaymentFields.paymentDate}
              onChange={(next) => onReadjustPaymentFieldsChange({ paymentDate: next })}
              required
              disabled={submitting}
              valueFormat="YYYY-MM-DD"
              format="MM/DD/YYYY"
            />
          ),
        },
        {
          key: 'paymentType',
          label: COL.PAYMENT_TYPE,
          value: (
            <SMSDropdown
              label=""
              options={paymentTypeOptions}
              value={readjustPaymentFields.paymentTypeId}
              onChange={(e) =>
                onReadjustPaymentFieldsChange({
                  paymentTypeId: String(e.target.value),
                })
              }
              disabled={submitting || paymentTypesLoading}
              searchable={false}
              fullWidth
            />
          ),
        },
        {
          key: 'referenceNumber',
          label: COL.REFERENCE_NUMBER,
          value: (
            <SMSTextField
              label=""
              value={readjustPaymentFields.referenceNumber}
              onChange={(e) =>
                onReadjustPaymentFieldsChange({ referenceNumber: e.target.value })
              }
              placeholder={FORM.REFERENCE_PLACEHOLDER}
              disabled={submitting}
              fullWidth
            />
          ),
        },
      ];
    }

    return buildPaymentInfoMetaFields(paymentInfo);
  }, [
    isReadjust,
    onReadjustPaymentFieldsChange,
    paymentInfo,
    paymentTypeOptions,
    paymentTypesLoading,
    readjustPaymentFields,
    submitting,
  ]);

  const readjustUsesLiveAllocationTotals = useMemo(
    () => isReadjust && readjustHasAllocationEdits,
    [isReadjust, readjustHasAllocationEdits]
  );

  const readjustDisplayPaid = useMemo(() => {
    if (!isReadjust) return 0;
    return readjustUsesLiveAllocationTotals ? amountToApply : readjustAppliedAmount;
  }, [amountToApply, isReadjust, readjustAppliedAmount, readjustUsesLiveAllocationTotals]);

  /** Top slate row: always original payment received minus paid and refunded (not adjusted payment). */
  const readjustOriginalEscrow = useMemo(
    () => Math.max(0, readjustOriginalAmount - readjustDisplayPaid - paymentRefundedBefore),
    [paymentRefundedBefore, readjustDisplayPaid, readjustOriginalAmount]
  );

  const readjustAdjustedEscrow = useMemo(
    () => readjustParsedAdjustAmount - amountToApply - paymentRefundedBefore,
    [amountToApply, paymentRefundedBefore, readjustParsedAdjustAmount]
  );

  /** Review summary only: projected balance after save (negative when over-allocated). */
  const readjustRemainingEscrowAfterSave = useMemo(() => {
    if (!isReadjust) return 0;
    return readjustMaxAllocatable - amountToApply;
  }, [amountToApply, isReadjust, readjustMaxAllocatable]);
  const showReadjustAdjustedRow = isReadjust && (isEditingReadjustAmount || readjustHasPaymentAmountEdit);

  const handleConfirmVoidAllocation = useCallback(
    async (reason: string) => {
      const allocationId = voidConfirmAllocationId?.trim();
      if (!allocationId || !onVoidAllocation) return;
      try {
        await onVoidAllocation(allocationId, reason);
        setVoidConfirmAllocationId(null);
      } catch {
        // Toast handled in thunk; keep dialog open for retry.
      }
    },
    [onVoidAllocation, voidConfirmAllocationId]
  );

  const slateStats = useMemo(() => {
    if (isReadjust) {
      return [
        {
          key: 'totalPayment',
          label: SLATE_STATS.TOTAL_PAYMENT,
          labelTooltip: SLATE_STATS.TOTAL_PAYMENT_TOOLTIP,
          value: formatPaymentCurrency(readjustOriginalAmount),
          showEditIcon: true,
          onEditClick: onToggleReadjustAmountEdit,
          editAriaLabel: S.READJUST_STATS.EDIT_AMOUNT_ARIA,
        },
        {
          key: 'totalPaymentUsed',
          label: SLATE_STATS.TOTAL_PAID,
          labelTooltip: SLATE_STATS.TOTAL_PAID_TOOLTIP,
          value: formatPaymentCurrency(readjustDisplayPaid),
          valueTone: 'due' as const,
        },
        {
          key: 'refundedAmount',
          label: SLATE_STATS.TOTAL_REFUNDED,
          labelTooltip: SLATE_STATS.TOTAL_REFUNDED_TOOLTIP,
          value: formatPaymentCurrency(paymentRefundedBefore),
          valueTone: paymentRefundedBefore > 0.001 ? ('due' as const) : ('default' as const),
        },
        {
          key: 'availableBalance',
          label: SLATE_STATS.AVAILABLE_BALANCE,
          labelTooltip: S.READJUST_STATS.ESCROWED_BALANCE_TOOLTIP,
          value: formatPaymentCurrency(readjustOriginalEscrow),
          valueTone: escrowBalanceValueTone(readjustOriginalEscrow),
        },
      ];
    }
    return [
      {
        key: 'totalPayment',
        label: SLATE_STATS.TOTAL_PAYMENT,
        labelTooltip: SLATE_STATS.TOTAL_PAYMENT_TOOLTIP,
        value: formatPaymentCurrency(totalPayment),
      },
      {
        key: 'totalPaymentUsed',
        label: SLATE_STATS.TOTAL_PAID,
        labelTooltip: SLATE_STATS.TOTAL_PAID_TOOLTIP,
        value: formatPaymentCurrency(totalPaymentUsed),
        valueTone: 'due' as const,
      },
      {
        key: 'refundedAmount',
        label: SLATE_STATS.TOTAL_REFUNDED,
        labelTooltip: SLATE_STATS.TOTAL_REFUNDED_TOOLTIP,
        value: formatPaymentCurrency(paymentRefundedBefore),
        valueTone: paymentRefundedBefore > 0.001 ? ('due' as const) : ('default' as const),
      },
      {
        key: 'availableBalance',
        label: SLATE_STATS.AVAILABLE_BALANCE,
        labelTooltip: SLATE_STATS.AVAILABLE_BALANCE_TOOLTIP,
        value: formatPaymentCurrency(remainingAvailableBalance),
        valueTone: remainingAvailableBalance > 0 ? ('paid' as const) : ('default' as const),
      },
    ];
  }, [
    invoiceDueTotal,
    isReadjust,
    onToggleReadjustAmountEdit,
    paymentRefundedBefore,
    readjustDisplayPaid,
    readjustOriginalEscrow,
    readjustOriginalAmount,
    remainingAvailableBalance,
    totalPayment,
    totalPaymentUsed,
  ]);

  const readjustSecondaryStats = useMemo(() => {
    if (!isReadjust || !showReadjustAdjustedRow) return undefined;
    return [
      {
        key: 'adjustPaymentAmount',
        label: S.READJUST_STATS.ADJUST_PAYMENT_AMOUNT,
        labelTooltip: S.READJUST_STATS.ADJUST_PAYMENT_AMOUNT_TOOLTIP,
        value: (
          <SMSTextField
            className="settle-pending-invoices-modal__adjust-amount"
            size="small"
            type="number"
            value={readjustAdjustAmount}
            error={readjustHasInvalidZeroPaymentAmount}
            onChange={(e) => onReadjustAdjustAmountChange?.(e.target.value)}
            disabled={submitting}
            placeholder="0.00"
            inputProps={{ min: 0, step: '0.01', inputMode: 'decimal', 'aria-label': S.READJUST_STATS.ADJUST_PAYMENT_AMOUNT }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" className="settle-pending-invoices-modal__amount-adornment">
                  $
                </InputAdornment>
              ),
            }}
            sx={{ marginTop: 0 }}
          />
        ),
      },
      {
        key: 'adjustPaid',
        label: SLATE_STATS.TOTAL_PAID,
        labelTooltip: SLATE_STATS.TOTAL_PAID_TOOLTIP,
        value: formatPaymentCurrency(readjustDisplayPaid),
        valueTone: 'due' as const,
      },
      {
        key: 'adjustRefunded',
        label: SLATE_STATS.TOTAL_REFUNDED,
        labelTooltip: SLATE_STATS.TOTAL_REFUNDED_TOOLTIP,
        value: formatPaymentCurrency(paymentRefundedBefore),
        valueTone: paymentRefundedBefore > 0.001 ? ('due' as const) : ('default' as const),
      },
      {
        key: 'adjustEscrow',
        label: S.READJUST_STATS.ADJUSTED_ESCROW,
        labelTooltip: S.READJUST_STATS.ADJUSTED_ESCROW_TOOLTIP,
        value: formatPaymentCurrency(readjustAdjustedEscrow),
        valueTone: escrowBalanceValueTone(readjustAdjustedEscrow),
      },
    ];
  }, [
    amountToApply,
    isReadjust,
    onReadjustAdjustAmountChange,
    paymentRefundedBefore,
    readjustAdjustAmount,
    readjustAdjustedEscrow,
    readjustDisplayPaid,
    readjustHasInvalidZeroPaymentAmount,
    showReadjustAdjustedRow,
    submitting,
  ]);

  const allocationDateColumn: DataTableColumn<SettleRowState> = useMemo(
    () => ({
      key: 'allocationDate',
      label: S.READJUST_TABLE.ALLOCATION_DATE,
      render: (_v, row) =>
        row.allocationDate
          ? formatDateShort(row.allocationDate)
          : PAYMENT_GRID.EMPTY_PLACEHOLDER,
    }),
    []
  );

  const balanceDueColumn: DataTableColumn<SettleRowState> = useMemo(
    () => ({
      key: 'balanceDue',
      label: S.TABLE.BALANCE_DUE,
      align: 'left',
      render: (_v, row) => formatPaymentCurrency(row.balanceDue ?? 0),
    }),
    []
  );

  const adjustAmountColumn: DataTableColumn<SettleRowState> = useMemo(
    () => ({
      key: 'adjustAmount',
      label: (
        <Tooltip title={S.READJUST_TABLE.ADJUST_AMOUNT_TOOLTIP} placement="top">
          <span>{S.READJUST_TABLE.ADJUST_AMOUNT}</span>
        </Tooltip>
      ),
      align: 'left',
      render: (_v, row) => {
        const delta = getReadjustAdjustDelta(row);
        if (Math.abs(delta) < 0.001) {
          return (
            <span className="settle-pending-invoices-modal__adjust-amount-value settle-pending-invoices-modal__adjust-amount-value--neutral">
              {formatPaymentCurrency(0)}
            </span>
          );
        }
        const toneClass =
          delta > 0
            ? 'settle-pending-invoices-modal__adjust-amount-value--warning'
            : 'settle-pending-invoices-modal__adjust-amount-value--positive';
        const displayValue =
          delta > 0
            ? `+${formatPaymentCurrency(delta)}`
            : formatPaymentCurrency(Math.abs(delta));
        return (
          <span className={`settle-pending-invoices-modal__adjust-amount-value ${toneClass}`}>
            {displayValue}
          </span>
        );
      },
    }),
    [rows]
  );

  const selectColumn: DataTableColumn<SettleRowState> = useMemo(
    () => ({
      key: 'select',
      align: 'center',
      noClamp: true,
      label: (
        <Tooltip title={selectAllTooltip} placement="top">
          <span className="settle-pending-invoices-modal__select-all-header">
            <SMSCheckbox
              label={S.TABLE.SELECT}
              checked={allRowsSelected}
              indeterminate={someRowsSelected}
              disabled={rows.length === 0}
              onChange={() => handleToggleSelectAllPending()}
              className="settle-pending-invoices-modal__table-checkbox settle-pending-invoices-modal__table-checkbox--select settle-pending-invoices-modal__table-checkbox--header"
            />
          </span>
        </Tooltip>
      ),
      render: (_v, row) => (
        <span className="settle-pending-invoices-modal__select-cell">
          <SMSCheckbox
            label={S.TABLE.SELECT}
            checked={row.selected}
            onChange={(checked) => {
              setRows((prev) => {
                const key = rowKey(row, isReadjust);
                const next = prev.map((r) =>
                  rowKey(r, isReadjust) === key ? { ...r, selected: checked } : r
                );
                return recapRowsEscrow(next, escrowForTable, isReadjust);
              });
            }}
            className="settle-pending-invoices-modal__table-checkbox settle-pending-invoices-modal__table-checkbox--select"
          />
        </span>
      ),
    }),
    [
      allRowsSelected,
      handleToggleSelectAllPending,
      escrowForTable,
      isReadjust,
      rows.length,
      selectAllTooltip,
      someRowsSelected,
    ]
  );

  const columns: DataTableColumn<SettleRowState>[] = useMemo(
    () => [
      ...(!isReadjust ? [selectColumn] : []),
      {
        key: 'invoiceNo',
        label: S.TABLE.INVOICE_NO,
        noClamp: true,
        render: (_v, row) => (
          <SMSChip
            label={row.invoiceNo?.trim() || PAYMENT_GRID.EMPTY_PLACEHOLDER}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        ),
      },
      {
        key: 'invoiceDate',
        label: S.TABLE.INVOICE_DATE,
        render: (_v, row) =>
          row.invoiceDate ? formatDateShort(row.invoiceDate) : PAYMENT_GRID.EMPTY_PLACEHOLDER,
      },
      {
        key: 'dueDate',
        label: S.TABLE.DUE_DATE,
        render: (_v, row) => (
          <span className="settle-pending-invoices-modal__due-date">
            {row.dueDate ? formatDateShort(row.dueDate) : PAYMENT_GRID.EMPTY_PLACEHOLDER}
          </span>
        ),
      },
      ...(isReadjust ? [allocationDateColumn] : []),
      {
        key: 'invoiceAmount',
        label: S.TABLE.INVOICE_TOTAL,
        align: 'left',
        render: (_v, row) => formatPaymentCurrency(row.invoiceAmount),
      },
      ...(isReadjust ? [balanceDueColumn] : []),
      {
        key: 'invoiceDue',
        label: isReadjust ? S.READJUST_TABLE.ALLOCATED_AMOUNT : S.TABLE.BALANCE_DUE,
        align: 'left',
        render: (_v, row) => formatPaymentCurrency(invoiceBalanceDue(row)),
      },
      ...(isReadjust ? [adjustAmountColumn] : []),
      {
        key: 'fullPayment',
        label: isReadjust ? S.READJUST_TABLE.NEW_PAYMENT_AMOUNT : S.TABLE.PAYMENT_AMOUNT,
        align: 'left',
        noClamp: true,
        render: (_v, row) => {
          const rowEscrowPool = isReadjust ? readjustRowEditCap : escrowForTable;
          const allocationId = rowPaymentAllocationId(row);

          return (
            <div className="settle-pending-invoices-modal__settlement-cell">
              <div className="settle-pending-invoices-modal__full-toggle">
                <SMSTypography variant="body2" className="settle-pending-invoices-modal__full-label">
                  {S.TABLE.FULL}
                </SMSTypography>
                <SMSCheckbox
                  label=""
                  checked={row.fullPayment}
                  disabled={!isReadjust && !row.selected}
                  inputProps={{ 'aria-label': S.TABLE.FULL }}
                  onChange={(checked) => {
                    const key = rowKey(row, isReadjust);
                    setRows((prev) => {
                      const escrowPool = isReadjust ? rowEscrowPool : escrowForTable;
                      const available = getEscrowAvailableForRow(
                        row,
                        prev,
                        escrowPool,
                        isReadjust
                      );
                      const balanceDue = rowApplyCap(row, isReadjust);
                      const capped = Math.min(balanceDue, available);
                      const next = prev.map((r) =>
                        rowKey(r, isReadjust) === key
                          ? {
                              ...r,
                              fullPayment:
                                checked && isFullBalancePayment(row, capped, isReadjust),
                              customAmount: checked ? capped.toFixed(2) : '0',
                            }
                          : r
                      );
                      return recapRowsEscrow(next, escrowPool, isReadjust);
                    });
                  }}
                  className="settle-pending-invoices-modal__table-checkbox settle-pending-invoices-modal__full-checkbox"
                />
              </div>
              <div className="settle-pending-invoices-modal__amount-input-wrap">
                <SMSTextField
                  className="settle-pending-invoices-modal__custom-amount"
                  size="small"
                  type="number"
                  value={row.customAmount}
                  error={
                    isReadjust
                      ? isReadjustInvalidZeroAmount(row)
                      : isApplyInvalidZeroAmount(row)
                  }
                  onChange={(e) => {
                    const available = getEscrowAvailableForRow(
                      row,
                      rows,
                      rowEscrowPool,
                      isReadjust
                    );
                    const balanceDue = rowApplyCap(row, isReadjust);
                    const maxAmount = Math.min(balanceDue, available);
                    const customAmount = clampCustomAmountInput(e.target.value, maxAmount);
                    const parsed = parseAmount(customAmount);
                    updateRow(rowKey(row, isReadjust), {
                      customAmount,
                      fullPayment: isFullBalancePayment(row, parsed, isReadjust),
                    });
                  }}
                  disabled={(!isReadjust && !row.selected) || row.fullPayment}
                  placeholder="0.00"
                  inputProps={{ min: 0, step: '0.01', inputMode: 'decimal', 'aria-label': S.TABLE.CUSTOM_AMOUNT }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" className="settle-pending-invoices-modal__amount-adornment">
                        $
                      </InputAdornment>
                    ),
                  }}
                  sx={{ marginTop: 0 }}
                />
              </div>
              {isReadjust && onVoidAllocation && allocationId ? (
                <Tooltip title={S.VOID_ALLOCATION.CONFIRM.TITLE} placement="top">
                  <span>
                    <IconButton
                      type="button"
                      size="small"
                      className="settle-pending-invoices-modal__void-allocation-btn"
                      onClick={() => setVoidConfirmAllocationId(allocationId)}
                      disabled={submitting || Boolean(voidingPaymentAllocationId)}
                      aria-label={S.READJUST_TABLE.VOID_ALLOCATION_ARIA}
                    >
                      <SMSIcon
                        name="delete"
                        size="sm"
                        color={voidingPaymentAllocationId === allocationId ? undefined : '#c62828'}
                      />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
    ],
    [
      adjustAmountColumn,
      allocationDateColumn,
      balanceDueColumn,
      escrowForTable,
      isReadjust,
      onVoidAllocation,
      readjustRowEditCap,
      rows,
      selectColumn,
      submitting,
      updateRow,
      voidingPaymentAllocationId,
    ]
  );

  const handleSubmit = useCallback(async () => {
    if (!onSubmit) {
      onClose();
      return;
    }
    if (isReadjust && readjustHasInvalidZeroPaymentAmount) return;
    if (isReadjust && readjustAmountBelowRefunded) return;
    if (isReadjust && hasReadjustInvalidZeroAmounts(rows)) return;
    if (!isReadjust && hasApplyInvalidZeroAmounts(rows)) return;
    let escrowUsed = 0;
    const rowsForSubmit = isReadjust ? rows : selectedRows;
    const invoices = rowsForSubmit
      .map((row) => {
        const invoiceId = rowInvoiceId(row);
        const paymentAllocationId = row.paymentAllocationId?.trim();
        if (isReadjust) {
          if (!paymentAllocationId) return null;
        } else if (!invoiceId) {
          return null;
        }

        const amount = isReadjust
          ? parseAmount(row.customAmount)
          : getRowApplyAmountCapped(row, Math.max(0, escrowForTable - escrowUsed), isReadjust);
        if (isReadjust) {
          const originalAmount = getReadjustOriginalAmount(row);
          if (Math.abs(amount - originalAmount) <= 0.001) return null;
        }
        if (!isReadjust) escrowUsed += amount;

        const cap = rowApplyCap(row, isReadjust);
        const applyFullAmount =
          (isReadjust || row.selected) && row.fullPayment && amount + 0.001 >= cap;
        return {
          invoiceId: invoiceId || paymentAllocationId || '',
          applyFullAmount,
          amount,
          ...(paymentAllocationId ? { paymentAllocationId } : {}),
        };
      })
      .filter(
        (
          row
        ): row is {
          invoiceId: string;
          applyFullAmount: boolean;
          amount: number;
          paymentAllocationId?: string;
        } => row != null
      );
    const boundAllocationDate =
      rows.find((row) => row.allocationDate?.trim())?.allocationDate?.trim() ??
      new Date().toISOString();

    const ok = await onSubmit({
      invoices,
      allocationDate: boundAllocationDate,
      ...(isReadjust
        ? {
            paymentAmountEdited: readjustHasPaymentAmountEdit,
            paymentDetailsEdited: readjustHasPaymentDetailsEdit,
            allocationAmountEdited: readjustHasAllocationEdits,
          }
        : {}),
    });
    if (ok) onClose();
  }, [
    escrowForTable,
    isReadjust,
    onClose,
    onSubmit,
    readjustHasAllocationEdits,
    readjustAmountBelowRefunded,
    readjustHasInvalidZeroPaymentAmount,
    readjustHasPaymentAmountEdit,
    readjustHasPaymentDetailsEdit,
    rows,
    selectedRows,
  ]);

  return (
    <SMSDialog
      open={isOpen}
      onClose={onClose}
      maxWidth={false}
      scroll={createPhase === 'entry' ? 'body' : 'paper'}
      fullWidth={createPhase !== 'entry'}
      className={
        createPhase === 'entry'
          ? 'settle-pending-invoices-modal settle-pending-invoices-modal--create'
          : `settle-pending-invoices-modal settle-pending-invoices-modal--settle${
              isReadjust
                ? ' settle-pending-invoices-modal--readjust'
                : ' settle-pending-invoices-modal--apply'
            }`
      }
    >
      <SMSStandardDialogHeader title={title ?? S.TITLE} onClose={onClose} showCloseButton />
      <SMSDialogContent className="settle-pending-invoices-modal__content">
        {isCreateEntry && paymentEntry && onPaymentEntryChange ? (
          <EditablePaymentSlate
            requesterName={paymentInfo?.requesterName ?? ''}
            value={paymentEntry}
            onChange={onPaymentEntryChange}
            errors={paymentEntryErrors}
            disabled={submitting}
            paymentTypeOptions={paymentTypeOptions}
            paymentTypesLoading={paymentTypesLoading}
          />
        ) : (
          <PaymentModalSlate
            metaFields={slateMetaFields}
            stats={slateStats}
            secondaryStats={readjustSecondaryStats}
          />
        )}

        {showApplySection && error ? (
          <SMSTypography color="error" variant="body2" role="alert">
            {error}
          </SMSTypography>
        ) : null}

        {showApplySection ? (
          <SMSTypography variant="body2" color="text.secondary" className="settle-pending-invoices-modal__hint">
            {isReadjust ? S.READJUST_HINT : S.HINT}
          </SMSTypography>
        ) : (
          <SMSTypography variant="body2" color="text.secondary" className="settle-pending-invoices-modal__hint">
            {S.CREATE_ENTRY_HINT}
          </SMSTypography>
        )}

        {readjustHasInvalidZeroPaymentAmount ? (
          <SMSTypography
            color="error"
            variant="body2"
            role="alert"
            className="settle-pending-invoices-modal__validation-banner"
          >
            {S.READJUST_STATS.ZERO_PAYMENT_AMOUNT_BANNER}
          </SMSTypography>
        ) : null}

        {readjustAmountBelowRefunded ? (
          <SMSTypography
            color="error"
            variant="body2"
            role="alert"
            className="settle-pending-invoices-modal__validation-banner"
          >
            {readjustAmountBelowRefundedMessage}
          </SMSTypography>
        ) : null}

        {readjustHasInvalidZeroAmounts || applyHasInvalidZeroAmounts ? (
          <SMSTypography
            color="error"
            variant="body2"
            role="alert"
            className="settle-pending-invoices-modal__validation-banner"
          >
            {isReadjust ? S.READJUST_TABLE.ZERO_AMOUNT_BANNER : S.TABLE.ZERO_AMOUNT_BANNER}
          </SMSTypography>
        ) : null}

        {readjustOverLimit ? (
          <SMSTypography
            color="error"
            variant="body2"
            role="alert"
            className="settle-pending-invoices-modal__validation-banner"
          >
            {readjustOverLimitMessage || S.READJUST_OVER_LIMIT}
          </SMSTypography>
        ) : null}

        {submitError ? (
          <SMSTypography
            color="error"
            variant="body2"
            role="alert"
            className="settle-pending-invoices-modal__validation-banner"
          >
            {submitError}
          </SMSTypography>
        ) : null}

        {showApplySection ? (
          <>
            <div className="settle-pending-invoices-modal__table-wrap">
              <SMSDataTableWrapper<SettleRowState>
                embedded
                columns={columns}
                data={loading ? [] : rows}
                loading={loading}
                getRowKey={(row) => rowKey(row, isReadjust) || row.invoiceNo || ''}
                tableClassName="settle-pending-invoices-modal__data-table"
                showHeaderWhenEmpty
                renderEmptyAsTable
                emptyMessage={isReadjust ? S.READJUST_TABLE.NO_INVOICES : S.TABLE.NO_INVOICES}
                pagination={pagination}
                getRowClassName={isReadjust ? getSkippedRowClassName : undefined}
                responsiveMode="auto"
                responsiveAutoMeasure="container"
                maxBodyHeight="var(--settle-table-body-height, 17.5rem)"
              />
            </div>

            <div className="settle-pending-invoices-modal__footer-panel">
              <div className="settle-pending-invoices-modal__summary">
                <InvoiceAmountSummaryBox
                  title={S.SUMMARY.TITLE}
                  rows={
                    isReadjust
                      ? [
                          {
                            key: 'saved-payment',
                            label: S.READJUST_SUMMARY.SAVED_PAYMENT_AMOUNT,
                            value: formatPaymentCurrency(readjustOriginalAmount),
                          },
                          ...(readjustHasPaymentAmountEdit
                            ? [
                                {
                                  key: 'adjust-payment',
                                  label: S.READJUST_SUMMARY.ADJUST_PAYMENT_AMOUNT,
                                  value: formatPaymentCurrency(readjustParsedAdjustAmount),
                                },
                              ]
                            : []),
                          {
                            key: 'saved-allocation',
                            label: S.READJUST_SUMMARY.SAVED_ALLOCATION_TOTAL,
                            value: formatPaymentCurrency(readjustAppliedAmount),
                          },
                          {
                            key: 'total-new',
                            label: S.READJUST_SUMMARY.TOTAL_NEW_ALLOCATION,
                            value: formatPaymentCurrency(amountToApply),
                          },
                          {
                            key: 'remaining-escrow',
                            label: S.READJUST_SUMMARY.UNALLOCATED_BALANCE,
                            value: formatPaymentCurrency(readjustRemainingEscrowAfterSave),
                            variant:
                              readjustRemainingEscrowAfterSave < -0.001
                                ? ('error' as const)
                                : ('total' as const),
                          },
                        ]
                      : [
                          {
                            key: 'selected-count',
                            label: S.SUMMARY.SELECTED_INVOICES,
                            value: String(selectedRows.length),
                          },
                          {
                            key: 'selected-due',
                            label: S.SUMMARY.SELECTED_DUE,
                            value: formatPaymentCurrency(selectedDue),
                          },
                          {
                            key: 'amount-to-apply',
                            label: S.SUMMARY.AMOUNT_TO_APPLY,
                            value: formatPaymentCurrency(amountToApply),
                            variant: 'total',
                          },
                        ]
                  }
                />
              </div>
            </div>
          </>
        ) : null}
      </SMSDialogContent>

      <PaymentVoidReasonConfirmDialog
        open={voidConfirmAllocationId != null}
        title={S.VOID_ALLOCATION.CONFIRM.TITLE}
        message={voidConfirmMessage}
        confirmText={S.VOID_ALLOCATION.CONFIRM.CONFIRM}
        cancelText={S.VOID_ALLOCATION.CONFIRM.CANCEL}
        onConfirm={handleConfirmVoidAllocation}
        onClose={() => setVoidConfirmAllocationId(null)}
        variant="warning"
        loading={Boolean(voidingPaymentAllocationId)}
      />

      <SMSDialogActions className="settle-pending-invoices-modal__actions">
        <SMSButton variant="outlined" onClick={onClose} allowWhenSuspended>
          {S.CANCEL}
        </SMSButton>
        {isCreateEntry ? (
          <SMSButton
            color="success"
            onClick={() => void onSaveNewPayment?.()}
            disabled={!canSaveNewPayment}
            allowWhenSuspended
          >
            {S.CREATE_SAVE}
          </SMSButton>
        ) : (
          <SMSButton
            color="success"
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              readjustOverLimit ||
              (isReadjust
                ? (!readjustHasPaymentAmountEdit &&
                    !readjustHasPaymentDetailsEdit &&
                    !readjustHasAllocationEdits) ||
                  (enableAllocationEditing && !readjustHasAllocationEdits) ||
                  readjustHasInvalidZeroPaymentAmount ||
                  readjustAmountBelowRefunded ||
                  readjustHasInvalidZeroAmounts ||
                  (readjustHasAllocationEdits && amountToApply <= 0) ||
                  amountToApply > readjustMaxAllocatable + 0.001
                : selectedRows.length === 0 ||
                  applyHasInvalidZeroAmounts ||
                  amountToApply <= 0 ||
                  amountToApply > escrowForTable)
            }
            allowWhenSuspended
          >
            {isReadjust ? S.READJUST_SUBMIT : S.SUBMIT}
          </SMSButton>
        )}
      </SMSDialogActions>
    </SMSDialog>
  );
};
