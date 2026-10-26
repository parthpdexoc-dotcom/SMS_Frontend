import { apiDelete, apiGetAll, apiPost } from '@/utils/apiClient';
import {
  CreatePaymentTypeRequest,
  PaymentTypePaginationParams,
  PaymentTypeResponse,
  UpdatePaymentTypeRequest,
} from '@/types/paymentType';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';

const mapRow = (row: Record<string, unknown>) => row as unknown as PaymentTypeResponse;

export const getPaymentTypes = async (
  pagination?: PaymentTypePaginationParams
): Promise<{ data: PaymentTypeResponse[]; totalRecords: number }> => {
  const response = await apiGetAll('/PaymentType', pagination);
  const responseText = await expectOkReadText(response, 'Failed to fetch payment types');
  return parsePagedListJson(responseText, mapRow);
};

export const createPaymentType = async (
  data: CreatePaymentTypeRequest
): Promise<PaymentTypeResponse> => {
  const response = await apiPost('/PaymentType', data, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to create payment type');
  return parseJsonText<PaymentTypeResponse>(responseText);
};

export const updatePaymentType = async (
  data: UpdatePaymentTypeRequest
): Promise<PaymentTypeResponse> => {
  const response = await apiPost('/PaymentType', data, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await readResponseOk(response, 'Failed to update payment type');
  return parseJsonText<PaymentTypeResponse>(responseText);
};

export const deletePaymentType = async (paymentTypeId: string): Promise<void> => {
  const response = await apiDelete(`/PaymentType/${paymentTypeId}`, {
    headers: { accept: '*/*' },
  });
  await readResponseOk(response, 'Failed to delete payment type');
};
