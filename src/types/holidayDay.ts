/**
 * HolidayDay DTOs and Types
 */

/** Full response shape (for list and form display). Hidden/read-only fields included. */
export interface HolidayDayResponse {
  holidayDayID: string;
  departmentID: string;
  name: string;
  date: string; // ISO date (YYYY-MM-DD) or date string
  isPremiumRate: boolean;
  isActive: boolean;
  payPremiumForEntireShift: boolean;
  recordAddedDateTimeStamp: string | null;
  addedByID: string;
  nameOfUserAddingRecord: string | null;
  userEditingID: string | null;
  userNameEditingRecord: string | null;
  editDate: string | null;
}

export interface HolidayDayFormProps {
  initialData?: HolidayDayResponse | null;
  onSuccess?: (saved?: HolidayDayResponse) => void;
  onCancel?: () => void;
  className?: string;
}

export interface HolidayDayFormData {
  name: string;
  date: string;
  isPremiumRate: boolean;
  isActive: boolean;
  payPremiumForEntireShift: boolean;
}

export interface HolidayDayFormErrors {
  name?: string;
  date?: string;
}

export interface HolidayDayListProps {
  className?: string;
}

/** Request type for creating a new holiday day */
export interface CreateHolidayDayRequest {
  name: string;
  date: string; // ISO date string (YYYY-MM-DD or full ISO datetime)
  isPremiumRate: boolean;
  isActive: boolean;
  payPremiumForEntireShift: boolean;
}

/** Request type for updating an existing holiday day */
export interface UpdateHolidayDayRequest extends CreateHolidayDayRequest {
  holidayDayID: string;
}

import { PaginationParams } from '@/utils/paginationUtils';

export interface HolidayDayPaginationParams extends PaginationParams {}

export interface HolidayDaySearchParams extends HolidayDayPaginationParams {
  searchTerm?: string;
}