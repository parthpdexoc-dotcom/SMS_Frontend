/**
 * PTAEO Code API Service
 * Fetches PTAEO codes for dropdown (ProjectNumber, TaskNumber, AwardNumber, FundNumber, OrganizationName)
 */

import { apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';
import { PtaeoCodeDto } from '@/types/ptaeoCode';
import type { SelectOptionDto } from '@/types/common';

export type PtaeoCodeOptionsParams = {
  searchTerm?: string;
  selectedId?: string;
};

export const getPtaeoCodeOptions = async (
  params?: PtaeoCodeOptionsParams
): Promise<SelectOptionDto[]> => {
  const body: Record<string, unknown> = {};
  const trimmedSearch = params?.searchTerm?.trim();
  if (trimmedSearch) body.searchTerm = trimmedSearch;
  const selectedId = params?.selectedId?.trim();
  if (selectedId) body.selectedId = selectedId;
  const response = await apiPost('/PtaeoCode/ptaeocodeoptions', body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const responseText = await expectOkReadText(response, 'Failed to fetch PTAEO code options');
  return parseJsonText<SelectOptionDto[]>(responseText);
};

export const getPtaeoCodeById = async (ptaeoCodeId: string): Promise<PtaeoCodeDto> => {
  const response = await apiGet(`/PtaeoCode/${ptaeoCodeId.trim()}`);
  const responseText = await expectOkReadText(response, 'Failed to fetch PTAEO code');
  return parseJsonText<PtaeoCodeDto>(responseText);
};

export const getPtaeoCodes = async (): Promise<PtaeoCodeDto[]> => {
  try {
    const response = await apiGet('/PtaeoCode');
    const responseText = await expectOkReadText(response, 'Failed to fetch PTAEO codes');

    const parsed = parseJsonText<unknown>(responseText);

    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as { data: unknown }).data)) {
      return (parsed as { data: PtaeoCodeDto[] }).data;
    }

    return parseJsonTextArray<PtaeoCodeDto>(responseText);
  } catch (error) {
    console.error('Error fetching PTAEO codes:', error);
    throw error;
  }
};
