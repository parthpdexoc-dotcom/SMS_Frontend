/**
 * RequestNote API Service
 * Handles all API calls related to Request Notes
 */

import { apiPost, apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';

export interface RequestNotesDto {
  requestNoteID?: string | null;
  requestID: string;
  notes: string;
  comments?: string;
}

/**
 * Get the latest notes for a request
 * @param requestId - The ID of the request
 * @returns Promise<RequestNotesDto>
 */
export const getLatestRequestNotes = async (requestId: string): Promise<RequestNotesDto> => {
  try {
    const response = await apiGet(`/RequestNotes/${requestId}/latest-notes`);
    const responseText = await expectOkReadText(response, 'Failed to fetch request notes');
    return parseJsonText<RequestNotesDto>(responseText);
  } catch (error) {
    console.error('Error fetching request notes:', error);
    throw error;
  }
};

/**
 * Get all notes for a request ordered by created date
 * @param requestId - The ID of the request
 * @returns Promise<RequestNotesDto[]>
 */
export const getAllRequestNotes = async (requestId: string): Promise<RequestNotesDto[]> => {
  try {
    const response = await apiGet(`/RequestNotes/${requestId}/notes`);
    const responseText = await expectOkReadText(response, 'Failed to fetch all request notes');
    return parseJsonTextArray<RequestNotesDto>(responseText);
  } catch (error) {
    console.error('Error fetching all request notes:', error);
    throw error;
  }
};

/**
 * Create or update a request note (upsert operation)
 * @param noteData - The request note data
 * @returns Promise<RequestNotesDto>
 */
export const upsertRequestNote = async (noteData: RequestNotesDto): Promise<RequestNotesDto> => {
  try {
    const response = await apiPost('/RequestNotes', noteData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await expectOkReadText(response, 'Failed to save request note');
    return parseJsonText<RequestNotesDto>(responseText);
  } catch (error) {
    console.error('Error saving request note:', error);
    throw error;
  }
};
