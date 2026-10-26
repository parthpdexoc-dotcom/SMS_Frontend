import React from 'react';
import { INVOICE_GRID } from '@/constants/strings';
import { formatMileageCharge } from '@/types/invoice';
import {
  buildInvoicePayableSplitSummary,
  getLineItemsForPayableSplit,
  InvoicePayableSplitVariant,
  type InvoiceDto,
  type InvoiceDetailDto,
  type InvoicePayableSplitSummaryResult,
  type InvoiceSummarySource,
} from '@/types/invoice';

const INVOICE_SUMMARY_ROWS: ReadonlyArray<{
  key: keyof InvoiceSummarySource;
  label: string;
  variant?: 'total' | 'balance';
}> = [
  { key: 'officerHourlyTotal', label: 'Officer Hourly Total' },
  { key: 'officerFeesTotal', label: 'Officer Fees Total' },
  { key: 'agencyFeesTotal', label: 'Agency Fees Total' },
  { key: 'vehicleFeesTotal', label: 'Vehicle Fees Total' },
  { key: 'equipmentFeesTotal', label: 'Equipment Fees Total' },
  { key: 'total', label: 'Total', variant: 'total' },
  { key: 'paymentsApplied', label: 'Payments Applied' },
  { key: 'balanceDue', label: 'Balance Due', variant: 'balance' },
];

const renderSummaryRow = (
  label: string,
  value: number | null | undefined,
  variant?: 'subtotal' | 'total' | 'balance',
  key?: string,
  formatValue: (amount: number | null | undefined) => string = (amount) =>
    formatMileageCharge(amount, '-')
) => (
  <div
    key={key ?? label}
    className={
      variant === 'total'
        ? 'invoice-document__summary-row invoice-document__summary-row--total'
        : variant === 'balance'
          ? 'invoice-document__summary-row invoice-document__summary-row--balance'
          : variant === 'subtotal'
            ? 'invoice-document__summary-row invoice-document__summary-row--subtotal'
            : 'invoice-document__summary-row'
    }
  >
    <span>{label}</span>
    <span className="invoice-document__summary-value">{formatValue(value)}</span>
  </div>
);

const renderPayableSplitFooter = (split: InvoicePayableSplitSummaryResult) => (
  <>
    {renderSummaryRow(INVOICE_GRID.PREVIEW.INVOICE_GRAND_TOTAL, split.grandTotal, 'total')}
    {renderSummaryRow('Payments Applied', split.paymentsApplied)}
    {renderSummaryRow('Balance Due', split.balanceDue, 'balance')}
  </>
);

const renderDirectPayableFeesSection = (split: InvoicePayableSplitSummaryResult) => (
  <>
    <div className="invoice-document__summary-section-title">
      {INVOICE_GRID.PREVIEW.PAYABLE_DIRECTLY_TO} {split.payableDirectlyTo || '-'}
    </div>
    {renderSummaryRow('Officer Fees Total', split.officerFeesTotal)}
    {renderSummaryRow('Agency Fees Total', split.agencyFeesTotal)}
    {renderSummaryRow(
      `${INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO} ${split.payableDirectlyTo || '-'}`,
      split.totalPayableDirectlyTo,
      'subtotal'
    )}
  </>
);

const hasNonZeroFeeTotal = (value: number | null | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value !== 0;

const shouldShowEquipmentFeesInDirectSection = (
  split: InvoicePayableSplitSummaryResult
): boolean => !split.hideVehicleAndEquipmentFees || hasNonZeroFeeTotal(split.equipmentFeesTotal);

const renderDirectPayableSection = (
  split: InvoicePayableSplitSummaryResult,
  options?: { includeOfficerHourly?: boolean }
) => (
  <>
    <div className="invoice-document__summary-section-title">
      {INVOICE_GRID.PREVIEW.PAYABLE_DIRECTLY_TO} {split.payableDirectlyTo || '-'}
    </div>
    {options?.includeOfficerHourly &&
      renderSummaryRow('Officer Hourly Total', split.officerHourlyTotal)}
    {!split.hideVehicleAndEquipmentFees &&
      renderSummaryRow('Vehicle Fees Total', split.vehicleFeesTotal)}
    {renderSummaryRow('Officer Fees Total', split.officerFeesTotal)}
    {renderSummaryRow('Agency Fees Total', split.agencyFeesTotal)}
    {shouldShowEquipmentFeesInDirectSection(split) &&
      renderSummaryRow('Equipment Fees Total', split.equipmentFeesTotal)}
    {renderSummaryRow(
      `${INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO} ${split.payableDirectlyTo || '-'}`,
      split.totalPayableDirectlyTo,
      'subtotal'
    )}
  </>
);

const renderOfficerPayableSection = (split: InvoicePayableSplitSummaryResult) => (
  <>
    <div className="invoice-document__summary-section-title">
      {INVOICE_GRID.PREVIEW.PAYABLE_TO_OFFICER}
    </div>
    {renderSummaryRow('Officer Hourly Total', split.officerHourlyTotal)}
    {renderSummaryRow(
      INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO_OFFICER,
      split.totalPayableToOfficer,
      'subtotal'
    )}
  </>
);

const SPLIT_SUMMARY_RENDERERS: Record<
  InvoicePayableSplitVariant,
  (split: InvoicePayableSplitSummaryResult) => React.ReactNode
> = {
  [InvoicePayableSplitVariant.Employee]: (split) => (
    <>
      <div className="invoice-document__summary-section-title">
        {INVOICE_GRID.PREVIEW.PAYABLE_TO_OFFICER}
      </div>
      {renderSummaryRow('Officer Hourly Total', split.officerHourlyTotal)}
      {renderSummaryRow('Vehicle Fees Total', split.vehicleFeesTotal)}
      {renderSummaryRow('Equipment Fees Total', split.equipmentFeesTotal)}
      {renderSummaryRow(
        INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO_OFFICER,
        split.totalPayableToOfficer,
        'subtotal'
      )}
      {renderDirectPayableFeesSection(split)}
      {renderPayableSplitFooter(split)}
    </>
  ),
  [InvoicePayableSplitVariant.City]: (split) => (
    <>
      {renderOfficerPayableSection(split)}
      {renderDirectPayableSection(split)}
      {renderPayableSplitFooter(split)}
    </>
  ),
  [InvoicePayableSplitVariant.CityDirect]: (split) => (
    <>
      {renderDirectPayableSection(split, { includeOfficerHourly: true })}
      {renderPayableSplitFooter(split)}
    </>
  ),
  [InvoicePayableSplitVariant.Mixed]: (split) => (
    <>
      <div className="invoice-document__summary-section-title">
        {INVOICE_GRID.PREVIEW.PAYABLE_TO_OFFICER}
      </div>
      {renderSummaryRow('Officer Hourly Total', split.officerHourlyTotal)}
      {renderSummaryRow('Vehicle Fees Total', split.employeeVehicleFeesTotal ?? 0)}
      {renderSummaryRow(
        INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO_OFFICER,
        split.totalPayableToOfficer,
        'subtotal'
      )}
      <div className="invoice-document__summary-section-title">
        {INVOICE_GRID.PREVIEW.PAYABLE_DIRECTLY_TO} {split.payableDirectlyTo || '-'}
      </div>
      {renderSummaryRow('Vehicle Fees Total', split.cityVehicleFeesTotal ?? 0)}
      {renderSummaryRow('Officer Fees Total', split.officerFeesTotal)}
      {renderSummaryRow('Agency Fees Total', split.agencyFeesTotal)}
      {renderSummaryRow('Equipment Fees Total', split.equipmentFeesTotal)}
      {renderSummaryRow(
        `${INVOICE_GRID.PREVIEW.TOTAL_PAYABLE_TO} ${split.payableDirectlyTo || '-'}`,
        split.totalPayableDirectlyTo,
        'subtotal'
      )}
      {renderPayableSplitFooter(split)}
    </>
  ),
};

export interface InvoiceDocumentSummaryProps {
  invoice: InvoiceDto;
  /** Line items currently shown in the table (display / edit). */
  displayLineItems: InvoiceDetailDto[];
  /** Line items with payable fields — invoice detail API or request-data. */
  payableLineItems?: InvoiceDetailDto[];
  summarySource: InvoiceSummarySource | null;
}

export const InvoiceDocumentSummary: React.FC<InvoiceDocumentSummaryProps> = ({
  invoice,
  displayLineItems,
  payableLineItems,
  summarySource,
}) => {
  const lineItemsForPayableSplit = React.useMemo(
    () => getLineItemsForPayableSplit(displayLineItems, payableLineItems),
    [displayLineItems, payableLineItems]
  );

  const payableSplitSummary = React.useMemo(() => {
    if (!summarySource) return null;
    return buildInvoicePayableSplitSummary(invoice, lineItemsForPayableSplit, summarySource);
  }, [invoice, lineItemsForPayableSplit, summarySource]);

  const renderContent = () => {
    if (payableSplitSummary) {
      return SPLIT_SUMMARY_RENDERERS[payableSplitSummary.variant](payableSplitSummary);
    }

    return INVOICE_SUMMARY_ROWS.map(({ key, label, variant }) =>
      renderSummaryRow(label, summarySource?.[key] ?? null, variant, key)
    );
  };

  return (
    <div className="invoice-document__summary">
      <div
        className={`invoice-document__summary-box${
          payableSplitSummary ? ' invoice-document__summary-box--split' : ''
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
};
