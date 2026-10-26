/**
 * BlockDate DTOs and Types
 */

import { PaginationParams } from '@/utils/paginationUtils';

export interface CreateBlockDateRequest {
  requestID?: string | null;
  postID?: string | null;
  startDateTime: string; // ISO datetime
  endDateTime: string;   // ISO datetime
}

export interface UpdateBlockDateRequest extends CreateBlockDateRequest {
  blockDateId: string; // GUID (primary key)
}

export interface BlockDateResponse {
  blockDateId: string;
  requestID: string | null;
  postID: string | null;
  startDateTime: string;
  endDateTime: string;
  createdDate: string | null;
  createdUserID: string | null;
  createdBy: string | null;
  editedDate: string | null;
  editedUserID: string | null;
  editedBy: string | null;
}

export interface BlockDatePaginationParams extends PaginationParams {
  postId?: string;
}

export interface BlockDateSearchParams extends BlockDatePaginationParams {
  searchTerm?: string;
}

export interface BlockDateFormProps {
  initialData?: BlockDateResponse | null;
  onSuccess?: (data: BlockDateResponse) => void;
  onCancel?: () => void;
  className?: string;
  disableRequest?: boolean;
  disablePost?: boolean;
}

export interface BlockDateFormData {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  requestID: string;
  postID: string;
}

export interface BlockDateFormErrors {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  endAfterStart?: string;
  requestID?: string;
  postID?: string;
}

export interface BlockDateListProps {
  className?: string;
}
