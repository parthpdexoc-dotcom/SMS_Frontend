/**
 * Department Configuration entity - matches backend SMS.Generic.Entities.Entities.DepartmentConfiguration
 */

export interface DepartmentConfigurationResponse {
  deptConfigID?: string;
  departmentID: string;

  defaultPayRate?: number | null;
  adminFeeRate?: number | null;
  defaultVehicleRate?: number | null;
  onDutyStartDayOfWeek?: number | null;
  tenure?: boolean | null;
  tenureWindow?: number | null;
  reimburse?: boolean | null;
  invoicing?: boolean | null;
  allowEmployeeTransfers?: boolean | null;
  twentyFourHourBasedOnTimeOfDay?: boolean | null;
  canEmployeeSubmitForm?: boolean | null;
  allowableNonClosedDays?: number | null;
  enableActivityTypes?: boolean | null;
  standardOffset?: number | null;
  passwordChangedPeriod?: number | null;
  isDefinePost?: boolean | null;
  isSupervisorOverride?: boolean | null;
  supervisorOverrideHour?: number | null;
  sendNotificationsToAllOnTransfer?: boolean | null;
  reservesAllowedHoursPerWeek?: number | null;
  skills?: boolean | null;
  equipment?: boolean | null;
  cancellationSettings?: boolean | null;
  overrideSettings?: boolean | null;
  notificationSettings?: boolean | null;
  closeRequestSettings?: boolean | null;
  enableRequesterEmployeeRestrictedList?: boolean | null;
  enablePreEmploymentPaperworkRequired?: boolean | null;
  enableRequesterSpecificConfigurations?: boolean | null;
  enablePayrollConfigurations?: boolean | null;
  enablePolicyManagement?: boolean | null;
  manageSchedulePriority?: boolean | null;
  manageSchedulePriorityList?: boolean | null;
  manageSchedulePriorityReleasedList?: boolean | null;
  schedulePrioritySnapshot?: boolean | null;
  departmentSchedulingPriority?: boolean | null;
  requesterSchedulingPriority?: boolean | null;
  coordinatedRequestSchedulingPriority?: boolean | null;
  allowEmployeeCancellation?: boolean | null;
  selfCancellationAllowedWithin?: boolean | null;
  uploadPreEmploymentPaperwork?: boolean | null;
  manageCommunications?: boolean | null;
  requesterPage?: boolean | null;
  skillManagement?: boolean | null;
  employeeVehicleReimbursement?: boolean | null;
  employeeMileageReimbursement?: boolean | null;
  enableTenureBasedPost24HourLimit?: boolean | null;
  enableTenureBasedPost24Allowed?: boolean | null;
  enableTenureBasedPostPosition?: boolean | null;
  tenureSelfCancel?: boolean | null;
  considerTenureWaitListOnCancellation?: boolean | null;
  enableSeniorityBasedonPrivateJobs?: boolean | null;
  considerOpenWaitListOnCancellation?: boolean | null;
  enableOpenAgencyWaitLists?: boolean | null;
  enablePrivateJobWaitLists?: boolean | null;
  enableEmployeeSubmittingRequestsForApproval?: boolean | null;
  enableEmployeeSplittingPosts?: boolean | null;
  enableReportingHoursWorkedAsOnOrOffDuty?: boolean | null;
  isSupervisorRequired?: boolean | null;
  numberOfPositionsPerSupervisor?: number | null;
  enableAutomaticSuspensionOfEmployeeForPolicyViolations?: boolean | null;
  enableDepartmentExemptions?: boolean | null;
  requesterSpecificSkills?: boolean | null;
  requesterApprovalProcessRequired?: boolean | null;
  sharedSchedulingPriorityPools?: boolean | null;
  useAgencyDefinedFields?: boolean | null;
  enableLiquorLicenseTracking?: boolean | null;
  enableAttachFilesToRequests?: boolean | null;
  enableOverlapJobConflictConfirmation?: boolean | null;
  enablePayrollCronJob?: boolean | null;
  enableSupervisorsViewingLowerEmpTypeJobs?: boolean | null;
  enableEmployeeEditStartEndTimesAfterPostBegins?: boolean | null;
  enableDepartmentEditEmployeesClosedAssignments?: boolean | null;
  enableExemptRequestsJobsFromHoursRules?: boolean | null;
  enableGeneralPolicy?: boolean | null;
  enableTenurePolicy?: boolean | null;
  showPtaeoCode?: boolean | null;
  showPayCode?: boolean | null;
  /** When true, employees in this department can see the location map. */
  enableEmployeeLocation?: boolean | null;
  /** Address or descriptive label for the department's home location (selected via Photon geocoder). */
  departmentHomeLocation?: string | null;
  /** Latitude of the department's home location for default map centering. */
  departmentHomeLatitude?: number | null;
  /** Longitude of the department's home location for default map centering. */
  departmentHomeLongitude?: number | null;
  /** When true, normal employees in this department are limited to one web session. */
  enableNormalEmployeeOneSession?: boolean | null;
  /** When true, Department Policy shows Restrict Web Login For Normal Employee. */
  showRestrictWebLoginForNormalEmployee?: boolean | null;
  enableGenerateRequestSchedule?: boolean | null;
}

export const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;
