/**
 * PostNote API Service
 * Handles all API calls related to Post Notes
 */

import { apiPost, apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray } from '@/services/textPlainJson';

export interface PostNotesDto {
  postNoteID?: string | null;
  postID: string;
  notes: string;
  comments?: string;
}

/**
 * Get the latest notes for a post
 * @param postId - The ID of the post
 * @returns Promise<PostNotesDto | null> - Returns null if no notes exist (404)
 */
export const getLatestPostNotes = async (postId: string): Promise<PostNotesDto | null> => {
  try {
    const response = await apiGet(`/PostNotes/${postId}/latest-notes`);
    
    // Handle 404 gracefully - it means no notes exist yet, which is valid
    if (!response.ok && response.status === 404) {
      return null;
    }
    
    const responseText = await expectOkReadText(response, 'Failed to fetch job notes');
    return parseJsonText<PostNotesDto>(responseText);
  } catch (error) {
    // If it's a 404 error, return null instead of throwing (don't log as error)
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    // Only log non-404 errors
    console.error('Error fetching post notes:', error);
    throw error;
  }
};

/**
 * Get all notes for a post ordered by created date
 * @param postId - The ID of the post
 * @returns Promise<PostNotesDto[]>
 */
export const getAllPostNotes = async (postId: string): Promise<PostNotesDto[]> => {
  try {
    const response = await apiGet(`/PostNotes/${postId}/notes`);
    const responseText = await expectOkReadText(response, 'Failed to fetch all job notes');
    return parseJsonTextArray<PostNotesDto>(responseText);
  } catch (error) {
    console.error('Error fetching all post notes:', error);
    throw error;
  }
};

/**
 * Create or update a post note (upsert operation)
 * @param noteData - The post note data
 * @returns Promise<PostNotesDto>
 */
export const upsertPostNote = async (noteData: PostNotesDto): Promise<PostNotesDto> => {
  try {
    const response = await apiPost('/PostNotes', noteData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await expectOkReadText(response, 'Failed to save job note');
    return parseJsonText<PostNotesDto>(responseText);
  } catch (error) {
    console.error('Error saving post note:', error);
    throw error;
  }
};
