import { ReleaseAs } from './request';

export interface RequestFilterOption {
  id: string;
  title: string;
}

export interface SearchModel {
  startDate: string;
  numberOfDays: number;
  releaseAs: ReleaseAs;
  /** Selected requester id for available-post `SearchModel.Requester` (Guid). */
  requester?: string | null;
  payCode?: string | null;
  /**
   * @deprecated No longer used. Requester Managed area uses separate Managed and Preferred sub-tabs (one API each).
   * Kept for persisted URL/state compatibility; always treated as false.
   */
  managedGeneralIncludesPreferred?: boolean;
}

export interface AssignToMeRequest {
  postID: string;
  dateOfWork: string;
  startDate?: string;
  confirmConflict?: boolean;
  postPositionId?: string;
}
