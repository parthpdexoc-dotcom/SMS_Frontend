/**
 * Close form data for closing a post position (two-step form).
 * Aligns with ClosedPostPosition schema.
 */
export interface PostCloseFormData {
  postPositionId: string;
  /** For edit-close flow: always send null so API creates/updates via parent reference. */
  closedPostPositionID?: string | null;
  /** For edit-close flow: existing closed post position ID being edited. */
  parentClosedPostPositionID?: string | null;
  employeeID: string;
  employeeName: string;
  postID: string;
  postTitle: string;
  workStartDate: string;
  workStartTime: string;
  /** Clock time when work ended (maps to ClosedPostPosition.WorkEndTime). */
  workEndTime: string;
  hoursWorked: string;
  /** Hours worked on duty (WorkedOnDuty) */
  workedOnDuty: boolean;
  comment: string;
  /** Requested start date (from schema) */
  requestedStartDate: string;
  /** Requested start time (from schema) */
  requestedStartTime: string;
  closeBy: string;
  closeDateTime: string;
  /** If true, use MinimumHoursDue in payroll when HoursWorked < MinimumHoursDue */
  isMinimumDue: boolean;
  minimumHoursDue: string;
  reimburseStatus: string;
  payRate: string;
  reimbursePayRate: string;

  departmentEquipment: string;
  isWorked: boolean;
  noWorkReason: string;
  isUnPaidBreakTime: boolean;
  breakTime: string;
  /** When true, show vehicle fields: VehicleOwnedBy, VehNumber, StartMileage, EndMileage, TotalMileage */
  equipmentUsedIsVehicle: boolean;
  /** City | Employee | Other - capture only when equipmentUsedIsVehicle is true */
  vehicleOwnedBy: string;
  vehNumber: string;
  startMileage: string;
  endMileage: string;
  usedEquipmentQuantity: string;
  equipmentUsedHours: string;
  paidHours: string;

  /** Split mode only: employee GUID to split task with (from search) */
  splitEmployeeID?: string;
  /** Split mode only: employee display name from search */
  splitEmployeeName?: string;
  /** Split mode only: date of work for the new split post (YYYY-MM-DD). Required. */
  splitStartDate?: string;
  /** Split mode only: start time for the new split post (HH:mm). Required. */
  splitStartTime?: string;
  /** Split mode only: requested end time for the new segment (API: endTime + requestedEndTime → ClosedPostPosition.RequestedEndTime). */
  splitEndTime?: string;
  /**
   * When true (Close Assignments admin edit + dept setting enabled), backend should attribute
   * the change to the acting administrator rather than the employee.
   */
  editedByDepartmentAdministrator?: boolean;
}

export interface EquipmentDetail {
  id: string;
  departmentEquipment: string;
  isWorked: boolean;
  noWorkReason: string;
  isUnPaidBreakTime: boolean;
  breakTime: string;
  usedEquipmentQuantity: string;
  equipmentUsedHours: string;
  paidHours: string;
  equipmentUsedIsVehicle: boolean;
  reimburseStatus: string;
  payRate: string;
  reimbursePayRate: string;
}

export interface VehicleDetail {
  id: string;
  departmentEquipment: string;
  equipmentUsedIsVehicle: boolean;
  vehicleOwnedBy: string;
  vehNumber: string;
  startMileage: string;
  endMileage: string;
  usedEquipmentQuantity: string;
  equipmentUsedHours: string;
  /** ViewDetailsEquipmentLine.ChargeType (JSON: chargeType). 0 = Per Hour, 1 = Per Item. */
  chargedType?: number;
}

export interface QuestionnaireAnswerSubmission {
  questionId: string;
  answer: string;
}

export interface QuestionnaireSubmission {
  questionnaireId: string;
  answers: QuestionnaireAnswerSubmission[];
}

/**
 * Thrown from `SMSCloseForm` `onSubmit` when the parent opens a follow-up modal (e.g. split time conflict).
 * The form treats this as a non-error and leaves the modal open.
 */
export class CloseFormSubmitDeferredError extends Error {
  constructor() {
    super('CloseFormSubmitDeferred');
    this.name = 'CloseFormSubmitDeferredError';
  }
}
