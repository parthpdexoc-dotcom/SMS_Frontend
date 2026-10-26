import React, { useEffect, useState } from 'react';
import { SMSButton, SMSDatePicker, SMSStack } from '@/components/smsatoms';
import { SMSModal } from '@/components/smsorganisms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearPayroll, generatePayrollThunk } from '@/store/slices/payrollSlice';
import type { PayrollProcessingResultDto } from '@/services/payrollExportService';
import { formatDateToYYYYMMDD, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';

export interface SMSGeneratePayrollModalProps {
  open: boolean;
  onClose: () => void;
  departmentId?: string;
  departmentName?: string;
  /** Optional callback fired when payroll is generated successfully */
  onSuccess?: (result: PayrollProcessingResultDto) => void;
}

export const SMSGeneratePayrollModal: React.FC<SMSGeneratePayrollModalProps> = ({
  open,
  onClose,
  departmentId,
  departmentName,
  onSuccess,
}) => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.payroll.loading);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      const endDate = getLocalTodayYyyyMmDd();
      const start = new Date();
      start.setDate(start.getDate() - 1);
      setEndDate(endDate);
      setStartDate(formatDateToYYYYMMDD(start));
    }
  }, [open]);

  const handleClose = () => {
    dispatch(clearPayroll());
    setStartDate('');
    setEndDate('');
    onClose();
  };

  const handleGenerate = async () => {
    if (!departmentId) return;

    try {
      const result = await dispatch(
        generatePayrollThunk({
          startDate,
          endDate,
          departmentId,
        })
      ).unwrap();

      handleClose();
      onSuccess?.(result);
    } catch (error) {
      console.error('Payroll generation error:', error);
    }
  };

  const title = departmentName || 'Generate Payroll';

  return (
    <SMSModal
      open={open}
      onClose={handleClose}
      title={title}
      size="small"
      actions={
        <>
          <SMSButton variant="outlined" onClick={handleClose} disabled={isLoading}>
            Cancel
          </SMSButton>
          <SMSButton onClick={handleGenerate} disabled={isLoading || !startDate || !endDate}>
            {isLoading ? 'Generating...' : 'Generate'}
          </SMSButton>
        </>
      }
    >
      <SMSStack spacing={2} sx={{ pt: 1 }}>
        <SMSDatePicker
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
        />
        <SMSDatePicker
          label="End Date"
          value={endDate}
          onChange={setEndDate}
          minDate={startDate}
        />
      </SMSStack>
    </SMSModal>
  );
};
