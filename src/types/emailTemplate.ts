/**
 * Email template DTO (numeric values align with API SMS.Generic.Enums.EmailType; names are frontend-only)
 * Normalized from API: emailTemplateId, title, subject, content, emailType
 */

export enum EmailTypeEnum {
  Cancelled = 0,
  CloseJob = 1,
  Approval = 2,
  EquipmentApproval = 3,
  AssignJob = 4,
  /** Split job; body may still use [Post] / *Post* placeholders from the server. */
  SplitJob = 5,
  JobTaken = 6,
  JobAssignmentAccepted = 7,
  JobAssignmentRejected = 8,
  JobSplitConfirmation = 9,
  ForgotPasswordOtp = 10,
  EmployeePasswordResetByAdmin = 11,
  JobTransfer = 12,
  PostScheduleUpdated = 13,
  CancelledJobRefilled = 14,
  PostTransferRolledBack = 15,
  EmployeeEmailUnavailable = 16,
  JobsPosted = 17,
  JobStartingIn24Hours = 18,
  JobStartingIn1Hour = 19,
  RequestReleasedEmail = 20,
  PostVehicleEquipmentUpdated = 25,
  /**
   * Sent when another employee takes a slot tied to a cancelled / cancellation-pending post position row.
   * Recipient: previous holder; assign-style placeholders ([AssignedEmployeeName], etc.) describe the new assignee.
   */
}

export interface EmailTemplateDto {
  emailTemplateID: string;
  name: string;
  subject: string;
  body: string;
  smsBody?: string;
  emailType?: EmailTypeEnum;
}

/** API EmailTypeOptionDto: enum value + display label (GET …/email-types). */
export interface EmailTypeOptionDto {
  value: number;
  label: string;
}
