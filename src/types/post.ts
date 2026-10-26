export interface Post {
    postId?: string | null;
    requestID?: string | null;
    postParentID?: string | null;
    /** Mirrors PostDto.IsParent */
    isParent: boolean;
    /** Mirrors API response field isExemptHours */
    exemptHours?: boolean;
    /** Mirrors PostDto.TotalPostPositions */
    totalPostPositions: number;
    /** Mirrors PostDto.RankEligible */
    rankEligible: boolean;
    /** Mirrors PostDto.PostTitle */
    postTitle: string;
    /** Mirrors PostDto.PostDescription */
    postDescription: string;
    /** TimeOnly serialized as string "HH:mm:ss" (PostDto.PostStartTime) */
    postStartTime: string;
    /** TimeOnly serialized as string "HH:mm:ss" (PostDto.PostEndTime) */
    postEndTime: string;
    /** Formatted time range from API: "StartTime - EndTime" (e.g. "15:00 - 23:00") (PostDto.PostTime) */
    postTime?: string;
    /** Mirrors PostDto.PostLength (minutes) */
    postLength: number;
    /** Minimum hours required (e.g. for shift) */
    postMinimumHoursRequired?: number | null;
    /** Mirrors PostDto.PostIsFlexible */
    postIsFlexible: boolean;
    /** Mirrors PostDto.PostPayRate */
    postPayRate: number;
    /** Mirrors PostDto.PostPremiumRate */
    postPremiumRate: number;
    /** Mirrors PostDto.PostRequiresVehicle */
    postRequiresVehicle: boolean;
    /** Mirrors PostDto.PostRequiresEquipment */
    postRequiresEquipment: boolean;
    /** Mirrors PostDto.IsSkillsRequired */
    isSkillsRequired: boolean;
    /** Mirrors PostDto.SkillIDs (Guid[]) */
    skillIDs: string[];
    /** Mirrors PostDto.EmployeeTypeID (single Guid) */
    employeeTypeID?: string | null;
    /** Read-only rank calculated on backend (PostDto.EmployeeRank) */
    employeeRank?: number | null;
    /** Mirrors PostDto.PostNotes */
    postNotes: string;
    /** Mirrors PostDto.PostLocation */
    postLocation: string;
    /** Mirrors PostDto.FirstName */
    firstName?: string;
    /** Mirrors PostDto.LastName */
    lastName?: string;
    /** Mirrors PostDto.PrimaryEmail */
    primaryEmail?: string;
    /** Mirrors PostDto.PrimaryPhone */
    primaryPhone?: string;
    /** Mirrors PostDto.CellPhone */
    cellPhone?: string;
    /** Response area ID from DepartmentResponseArea (dropdown) */
    postResponseAreaId?: string | null;
    /** Mirrors PostDto.Level */
    level: string;
    postCallSign?: string;
    /** Mirrors PostDto.DefineCallSign */
    defineCallSign?: boolean | null;
    /**
     * Optional call signs for each post slot (index aligned with totalPostPositions).
     * Sent on create; backend persists them as PostCallSign rows.
     */
    callSigns?: (string | null)[];
    /** Checkbox beside Premium Rate */
    postApplyPremium?: boolean;
    /** Selected PTAEO Code id (for dropdown display only; save uses the five fields below) */
    postPtaeoCodeId?: string | null;
    /** Uniform checkbox (same row as PTAEO Code) */
    postUniform?: boolean;
    /** Selected Department Activity Type (from GetAllActiveDepartmentActivityType dropdown) */
    postDepartmentActivityTypeId?: string | null;
    /** Optional display text returned by backend for selected Department Activity Type */
    postDepartmentActivityTypeName?: string | null;
    /** Optional display text returned by backend for selected Response Area */
    postResponseAreaName?: string | null;
    /** PTAEO components stored on post (replaces legacy PtaeoCodeID) */
    projectNumber?: string | null;
    taskNumber?: string | null;
    awardNumber?: string | null;
    fundNumber?: string | null;
    organizationNumber?: string | null;
    /** Mirrors PostDto.PayCode */
    payCode?: string | null;
    /** Display value returned by view-details for the selected pay code. */
    payCodeValue?: string | null;
    /** Description returned by view-details for the selected pay code. */
    payCodeDescription?: string | null;
    isPostRequiredDocument: boolean;
    isSupervisorPost: boolean;
    /** Mirrors PostDto.IsAlcoholServedOrConsumed */
    isAlcoholServedOrConsumed?: boolean;
    postDepartmentDefinedValue1: string;
    postDepartmentDefinedValue2?: string;
    postDepartmentDefinedValue3?: string;
    postDepartmentDefinedValue4?: string;
    postDepartmentDefinedValue5?: string;
    postDepartmentDefinedValue6?: string;
    postDepartmentDefinedValue7?: string;
    postDepartmentDefinedValue8?: string;
    postDepartmentDefinedValue9?: string;
    postDepartmentDefinedValue10?: string;
    createdDate?: string;
    createdUserID?: string;
    createdBy?: string;
  editedDate?: string | null;
  editedUserID?: string | null;
  editedBy?: string | null;
  /** Backend PostDto.PostPositions; kept loose as it is managed separately but required in payload */
  postPositions?: any[];
  /** Total assigned employees across all positions for this post (from Post/by-request API) */
  assignedEmployeeCount?: number;
    /** Assigned post positions count from Post/by-request API. */
    assignedPostPositionCount?: number;
    /** Cancelled post positions count from Post/by-request API. */
    cancelledPostPositionCount?: number;
  /** From parent request when returned on Post GET (RequestDto.IsPremiumPaidEvent) */
  isPremiumPaidEvent?: boolean;
  /** Backend Upsert guard: when true, apply schedule-impacting updates to assigned scheduled post positions. */
  confirmScheduleChanges?: boolean;
  /**
   * Backend Upsert guard: when true, confirm hard-delete of selected PostCallSign rows
   * after a TotalPostPositions decrease 409 (requiresHardDeletePostCallSign).
   */
  confirmHardDeletePostCallSign?: boolean;
  /** Call-sign row IDs to hard-delete when confirming a TotalPostPositions decrease. */
  hardDeletePostCallSignIDs?: string[];
  /** Backend warning flag when schedule-impacting fields changed and confirmation is required. */
  hasAssignmentWarning?: boolean;
  assignmentWarningMessage?: string | null;
  assignmentWarningEmployees?: PostAssignmentWarningEmployee[];
  /** Set to true on first save after cloning a post (maps to `IsCloned` on upsert). */
  isCloned?: boolean;
}

export interface PostAssignmentWarningEmployee {
  employeeID: string;
  postPositionID: string;
  dateOfWork: string;
  startTime: string;
  endTime?: string;
  duration?: string;
  employeeName: string;
  primaryEmail?: string;
  primaryPhone?: string;
}

/**
 * Prepare a post object to be used as the basis for creating a cloned post.
 * Clears identifiers and audit fields and ensures it is associated with the given requestID.
 */
export const prepareClonedPostForCreate = (source: Post, requestID: string): Post => ({
    ...source,
    postId: null,
    requestID,
    createdDate: undefined,
    createdUserID: undefined,
    createdBy: undefined,
    editedDate: null,
    editedUserID: null,
    editedBy: null,
});

export interface PostFilter {
    requestID?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
}
export type PostListParams = PostFilter;
