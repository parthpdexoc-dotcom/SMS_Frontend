import type { EmployeePostListingItem } from '@/types/employeePostListingItem';

/**
 * One answer row from GET .../ClosedPostPositionEquipment/post-position/{id}/list.
 * `answer` may be: JSON array of option ids (legacy), plain text (short/paragraph), or comma-separated option labels (choice questions).
 * `optionText` / `selectedOptionIds` are optional when the API resolves a single display value.
 */
export interface ClosedPostQuestionnaireAnswer {
    questionId?: string;
    questionText?: string;
    answer?: string;
    selectedOptionIds?: string[] | null;
    optionText?: string | null;
}

/** Questionnaire slice attached to a closed-post history entry (list API includes title + display text per answer). */
export interface ClosedPostQuestionnaireSubmission {
    questionnaireId?: string;
    questionnaireTitle?: string;
    answers?: ClosedPostQuestionnaireAnswer[];
}

/**
 * One row of closed-post history from list or single-detail API (normalized).
 */
export interface ClosedPostDetailsHistoryEntry {
    closedPostPosition: Record<string, unknown> | null;
    ClosedPostPosition?: Record<string, unknown> | null;
    equipments: Record<string, unknown>[] | null;
    questionnaireSubmissions?: ClosedPostQuestionnaireSubmission[];
}

export type ClosedHistoryStatusKind = 'closed' | 'unclosed' | 'none';

export interface ClosedHistoryStatusDisplay {
    label: string;
    kind: ClosedHistoryStatusKind;
}

/**
 * Internal row shape for the My History closed-post records DataTable.
 */
export interface ClosedHistoryPostTableRow {
    rowKey: string;
    dateOfWork: string;
    startTime: string;
    hoursWorked: string;
    workedOnDuty: string;
    workStartDate: string;
    workStartTime: string;
    workEndTime: string;
    createdBy: string;
    editedBy: string;
    /** Resolved display for `closedPostPosition.status` (Closed / Unclosed / -). Key `closedPostStatus` avoids SMSDataTable’s 4.5rem `status` column width. */
    closedPostStatus: string;
    statusKind: ClosedHistoryStatusKind;
    action: string;
    _entryLabel: string;
    _vehicleItems: Record<string, unknown>[];
    _equipmentItems: Record<string, unknown>[];
}

/** Payload when opening the vehicles & equipment modal from a grid row. */
export interface ClosedHistoryVehiclesEquipmentOpenPayload {
    entryLabel: string;
    vehicleItems: Record<string, unknown>[];
    equipmentItems: Record<string, unknown>[];
}

/** Payload for building `normalizeClosedPostDetailsList` when the list API is empty. */
export interface NormalizeClosedPostDetailsSingleFallback {
    closedPostPosition: Record<string, unknown> | null;
    equipments: unknown;
    questionnaireSubmissions?: ClosedPostDetailsHistoryEntry['questionnaireSubmissions'];
}

export type ClosedHistoryPostsDataGridProps = {
    entries: ClosedPostDetailsHistoryEntry[];
    selectedPost: EmployeePostListingItem;
    onOpenVehiclesEquipment: (p: ClosedHistoryVehiclesEquipmentOpenPayload) => void;
};

export type ClosedHistoryVehiclesEquipmentBodyProps = {
    entryLabel: string;
    vehicleItems: Record<string, unknown>[];
    equipmentItems: Record<string, unknown>[];
};
