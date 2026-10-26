import { apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText } from '@/services/textPlainJson';

export interface PayrollDataRecordDto {
  employeeNumber: string;
  startDateTime: string;
  endDateTime: string;
  duration: number;
  payCode: string;
  project?: string | null;
  task?: string | null;
  award?: string | null;
  fund?: string | null;
}

export interface PayrollProcessingResultDto {
  isSuccess: boolean;
  generatedDocumentPath?: string | null;
  websiteDocumentPath?: string | null;
  payrollDataRecords: PayrollDataRecordDto[];
  warnings: string[];
  errors: string[];
  startTime: string;
  endTime?: string;
  dateRange: string;
}

export const generatePayroll = async (startDate: string,endDate: string, departmentId?: string, customFileName?: string ): Promise<PayrollProcessingResultDto> => {
  const queryParams = new URLSearchParams();

  queryParams.set('startDate', startDate.trim());
  queryParams.set('endDate', endDate.trim());

  if (departmentId?.trim()) {
    queryParams.set('departmentId', departmentId.trim());
  }

  if (customFileName?.trim()) {
    queryParams.set('customFileName', customFileName.trim());
  }

  const response = await apiPost(`/PayrollExport/Generate?${queryParams.toString()}`,null,
    {
      headers: {
        accept: 'application/json',
      },
    }
  );

  const text = await expectOkReadText(response,'Failed to generate payroll export.');
  return parseJsonText<PayrollProcessingResultDto>(text);
};