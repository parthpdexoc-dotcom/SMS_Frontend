/**
 * Shared types for SMS roster UI (modal, page, tables).
 */

import type { KeyboardEvent } from 'react';
import type { SMSDropdownOption } from '@/components/smsatoms';
import type { RosterInformation } from '@/types/roster';

export interface SMSRosterEditableUnitConfig {
  editingPostPositionId: string | null;
  editingValue: string;
  isSaving: boolean;
  callSignOptions: SMSDropdownOption[];
  isLoadingCallSignOptions: boolean;
  onEditPress: (row: RosterInformation) => void;
  onDeletePress: (row: RosterInformation) => void;
  onEditingChange: (value: string) => void;
  onEditingClose: () => void;
  onEditingKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

export interface SMSRosterItem {
  postId?: string | null;
  postPositionId?: string | null;
  level: string | null;
  postTitle: string | null;
  postDescription: string | null;
  callUnit: string | null;
  employeeName: string | null;
  employeeNumber: string | null;
  vehicleName: string | null;
  postLocation: string | null;
  payCode?: string | null;
  isSupervisorPost?: boolean | null;
  postPositionStatus?: number | null;
}

export interface SMSGroupedRosterSection {
  sectionTitle: string;
  description: string | null;
  rows: SMSRosterItem[];
}
