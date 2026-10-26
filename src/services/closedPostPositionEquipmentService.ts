/**
 * ClosedPostPositionEquipment API Service
 */

import { apiPost, apiPut, apiGet } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOkOrInvoiceRefund } from '@/services/textPlainJson';
import {
  ClosedPostPositionEquipmentSplitResponse,
  SplitRequest,
  CloseOrSplitPayload,
  ClosedPostPositionEquipmentDetail,
} from '@/types/closedPostPositionEquipment';
import type { ClosedPostQuestionnaireSubmission } from '@/types/closedPostHistoryDetails';
import { PostCloseFormData, EquipmentDetail, VehicleDetail, QuestionnaireSubmission } from '@/types/postCloseForm';
import { VehicleOwnedByType } from '@/types/invoice';
import { parseMileageForPayload, totalMileageFromStartEnd } from '@/utils/mileagePayloadUtils';

export type ClosedPostPositionDetailsResponse = {
  closedPostPosition: Record<string, unknown> | null;
  equipments: ClosedPostPositionEquipmentDetail[] | null;
} | null;

export type ClosedPostPositionDetailsListResponse = Array<{
  closedPostPosition: Record<string, unknown> | null;
  equipments: ClosedPostPositionEquipmentDetail[] | null;
  questionnaireSubmissions?: ClosedPostQuestionnaireSubmission[];
}>;

/**
 * Map questionnaire submissions to camelCase payload shape (shared for close/split).
 */
const mapQuestionnaireSubmissionsPayload = (
  submissions: QuestionnaireSubmission[] | undefined
): { questionnaireId: string; answers: { questionId: string; answer: string }[] }[] | undefined => {
  if (!submissions?.length) return undefined;
  return submissions.map((s) => ({
    questionnaireId: s.questionnaireId,
    answers: (s.answers || []).map((a) => ({ questionId: a.questionId, answer: a.answer ?? '' })),
  }));
};

/** Normalize vehicle owned-by for API (VehicleOwnedByType enum as number: City=1, Employee=2, Other=3). */
const toVehicleOwnedBy = (ownedBy: string | undefined): number | undefined => {
  if (!ownedBy?.trim()) return undefined;
  const lower = ownedBy.toLowerCase();
  if (lower.includes('city')) return VehicleOwnedByType.City;
  if (lower.includes('employee')) return VehicleOwnedByType.Employee;
  // Any other non-empty value maps to "Other"
  return VehicleOwnedByType.Other;
};

/** Parse string number for API (usedEquipmentQuantity / equipmentUsedHours); supports 0, avoids NaN. */
const parseNumericField = (raw: string | undefined | null): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

/** Backend: 0 = Per Hour, 1 = Per Item. Vehicles default to Per Hour when type is missing. */
const CHARGED_TYPE_PER_ITEM = 1;

const isPerHourVehicle = (chargedType: number | undefined): boolean =>
  chargedType !== CHARGED_TYPE_PER_ITEM;

/**
 * Build equipment details array for close/split payload (only fields accepted by API).
 */
const buildEquipmentDetails = (
  _data: PostCloseFormData,
  equipmentDetails: EquipmentDetail[],
  vehicleDetails: VehicleDetail[]
): ClosedPostPositionEquipmentDetail[] => {
  const mapItem = (deptId: string, opts: {
    isWorked?: boolean;
    noWorkReason?: string | null;
    isUnPaidBreakTime?: boolean;
    breakTime?: number | null;
    usedEquipmentQuantity?: number | null;
    equipmentUsedHours?: number | null;
    vehicleQuantity?: number | null;
    vehicleUsedHours?: number | null;
    vehicleOwnedBy?: number | null;
    vehNumber?: string | null;
    startMileage?: number | null;
    endMileage?: number | null;
    totalMileage?: number | null;
  }): ClosedPostPositionEquipmentDetail => ({
    departmentEquipmentID: deptId,
    isWorked: opts.isWorked ?? true,
    noWorkReason: opts.noWorkReason ?? null,
    isUnPaidBreakTime: opts.isUnPaidBreakTime ?? false,
    breakTime: opts.breakTime ?? null,
    usedEquipmentQuantity: opts.usedEquipmentQuantity ?? null,
    equipmentUsedHours: opts.equipmentUsedHours ?? null,
    vehicleQuantity: opts.vehicleQuantity ?? null,
    vehicleUsedHours: opts.vehicleUsedHours ?? null,
    vehicleOwnedBy: opts.vehicleOwnedBy ?? null,
    vehNumber: opts.vehNumber ?? null,
    startMileage: opts.startMileage ?? null,
    endMileage: opts.endMileage ?? null,
    totalMileage: opts.totalMileage ?? null,
  });

  const fromEquipment = equipmentDetails.map((eq) => {
    const v = vehicleDetails.find((x) => x.departmentEquipment === eq.departmentEquipment);
    const totalMileage = v ? totalMileageFromStartEnd(v.startMileage, v.endMileage) : null;
    const qty =
      parseNumericField(v?.usedEquipmentQuantity) ?? parseNumericField(eq.usedEquipmentQuantity);
    return mapItem(eq.departmentEquipment, {
      isWorked: eq.isWorked,
      noWorkReason: eq.noWorkReason?.trim() || null,
      isUnPaidBreakTime: eq.isUnPaidBreakTime,
      breakTime: eq.breakTime ? parseFloat(eq.breakTime) : null,
      usedEquipmentQuantity: qty,
      // Per-item equipment is billed quantity × charge. Do not send officer hours.
      equipmentUsedHours: null,
      vehicleQuantity: v ? qty : null,
      vehicleUsedHours: null,
      vehicleOwnedBy: v ? toVehicleOwnedBy(v.vehicleOwnedBy) ?? null : null,
      vehNumber: v?.vehNumber ?? null,
      startMileage: v ? parseMileageForPayload(v.startMileage) : null,
      endMileage: v ? parseMileageForPayload(v.endMileage) : null,
      totalMileage: totalMileage ?? null,
    });
  });

  const vehicleOnly = vehicleDetails
    .filter((vd) => !equipmentDetails.some((eq) => eq.departmentEquipment === vd.departmentEquipment))
    .map((vd) => {
      const totalMileage = totalMileageFromStartEnd(vd.startMileage, vd.endMileage);
      const qtyV = parseNumericField(vd.usedEquipmentQuantity);
      const sendHours = isPerHourVehicle(vd.chargedType);
      const hrsV = sendHours ? parseNumericField(vd.equipmentUsedHours) : null;
      return mapItem(vd.departmentEquipment, {
        usedEquipmentQuantity: qtyV,
        equipmentUsedHours: null,
        vehicleQuantity: qtyV,
        vehicleUsedHours: hrsV,
        vehicleOwnedBy: toVehicleOwnedBy(vd.vehicleOwnedBy) ?? null,
        vehNumber: vd.vehNumber ?? null,
        startMileage: parseMileageForPayload(vd.startMileage),
        endMileage: parseMileageForPayload(vd.endMileage),
        totalMileage,
      });
    });

  return [...fromEquipment, ...vehicleOnly];
};

/**
 * Build close/split payload (only fields accepted by API).
 * Endpoint (/close vs /split) distinguishes the operation.
 */
const buildCloseOrSplitPayload = (
  data: PostCloseFormData,
  equipmentDetails: EquipmentDetail[],
  vehicleDetails: VehicleDetail[],
  questionnaireSubmissions: QuestionnaireSubmission[] | undefined,
  isSplitRequest: boolean,
  options?: { confirmConflict?: boolean }
): CloseOrSplitPayload => {
  const equipmentPayload = buildEquipmentDetails(data, equipmentDetails, vehicleDetails);

  // For split we want ONLY the Date of Work chosen in the Split section (splitStartDate).
  const effectiveDateOfWork = isSplitRequest
    ? (data.splitStartDate?.trim() || null)
    : (data.requestedStartDate?.trim() || null);

  const payload: CloseOrSplitPayload = {
    postPositionID: data.postPositionId ?? '',
    // Edit-close flow requirements:
    // - send closedPostPositionID as null
    // - send parentClosedPostPositionID as existing closed record id
    closedPostPositionID: data.closedPostPositionID ?? undefined,
    parentClosedPostPositionID: data.parentClosedPostPositionID ?? undefined,
    // Only send splitEmployeeID for split requests; omit for close so backend Guid? binder is not given an empty string
    splitEmployeeID: isSplitRequest ? data.splitEmployeeID : undefined,
    // When splitting "with myself", flag this so backend can ignore splitEmployeeID and take the employee ID from the token.
    // We infer self-split when the chosen split employee matches the current employee.
    isSplitWithSelf: isSplitRequest && data.splitEmployeeID === data.employeeID,
    workStartDate: data.workStartDate || null,
    workStartTime: data.workStartTime || null,
    workEndTime: data.workEndTime?.trim() ? data.workEndTime.trim() : null,
    hoursWorked: data.hoursWorked ? parseFloat(data.hoursWorked) : 0,
    workedOnDuty: data.workedOnDuty,
    comment: data.comment?.trim() || null,
    isMinimumDue: data.isMinimumDue ?? false,
    minimumHoursDue: data.isMinimumDue && data.minimumHoursDue
      ? parseFloat(data.minimumHoursDue)
      : null,
    dateOfWork: effectiveDateOfWork,
    startTime: isSplitRequest
      ? (data.splitStartTime?.trim() || null)
      : (data.requestedStartTime || null),
    endTime: isSplitRequest
      ? (data.splitEndTime?.trim() ? data.splitEndTime.trim() : null)
      : null,
    requestedEndTime: isSplitRequest
      ? (data.splitEndTime?.trim() ? data.splitEndTime.trim() : null)
      : undefined,
    equipmentDetails: equipmentPayload,
    questionnaireSubmissions: mapQuestionnaireSubmissionsPayload(questionnaireSubmissions),
  };

  if (data.editedByDepartmentAdministrator === true) {
    payload.editedByDepartmentAdministrator = true;
  }

  // Split only: always send explicit boolean so Newtonsoft binds reliably (same as bulk assign / take job).
  if (isSplitRequest) {
    payload.confirmConflict = options?.confirmConflict === true;
  }

  return payload;
};

/**
 * Split a post position with equipment details. Uses same payload as close; isSplitRequest: true.
 */
export const splitPostPositionWithEquipment = async (
  data: PostCloseFormData,
  equipmentDetails: EquipmentDetail[],
  vehicleDetails: VehicleDetail[],
  questionnaireSubmissions?: QuestionnaireSubmission[],
  options?: { confirmConflict?: boolean }
): Promise<ClosedPostPositionEquipmentSplitResponse> => {
  const postPositionId = data.postPositionId?.trim() || '';
  const splitEmployeeID = String(data.splitEmployeeID ?? '').trim();
  if (!splitEmployeeID) {
    throw new Error('Please search and select an employee before submitting the split request');
  }
  if (!postPositionId) {
    throw new Error('PostPositionID is required for split operation');
  }

  const payload = buildCloseOrSplitPayload(
    { ...data, postPositionId, splitEmployeeID },
    equipmentDetails || [],
    vehicleDetails || [],
    questionnaireSubmissions,
    true,
    options
  );

  const response = await apiPost('/ClosedPostPositionEquipment/split', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const responseText = await expectOkReadText(response, 'Failed to split job position');
  if (!responseText || responseText.trim() === '') {
    return { message: 'Split request submitted successfully' };
  }
  return parseJsonText<ClosedPostPositionEquipmentSplitResponse>(responseText);
};

/**
 * Close a post position with equipment details. Uses same payload as split; isSplitRequest: false.
 */
export const closePostPositionWithEquipment = async (
  data: PostCloseFormData,
  equipmentDetails: EquipmentDetail[],
  vehicleDetails: VehicleDetail[],
  questionnaireSubmissions?: QuestionnaireSubmission[]
): Promise<void> => {
  const payload = buildCloseOrSplitPayload(
    data,
    equipmentDetails || [],
    vehicleDetails || [],
    questionnaireSubmissions,
    false
  );

  const response = await apiPost('/ClosedPostPositionEquipment/close', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  await readResponseOkOrInvoiceRefund(response, 'Failed to close post position with equipment');
};

/**
 * Accept a split request
 * @param closedPostPositionID - The closed post position ID
 * @returns Promise<void>
 */
export const acceptSplitRequest = async (closedPostPositionID: string): Promise<void> => {
  const endpoint = `/ClosedPostPositionEquipment/${closedPostPositionID}/accept`;
  const response = await apiPut(endpoint);
  await expectOkReadText(response, 'Failed to accept split request');
};

/**
 * Fetch pending split requests for the current employee
 * @returns Promise<SplitRequest[]>
 */
export const getPendingSplitRequests = async (): Promise<SplitRequest[]> => {
  const endpoint = '/ClosedPostPositionEquipment/pending';
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch pending split requests');
  
  if (!responseText || responseText.trim() === '') {
    return [];
  }
  
  return parseJsonTextArray<SplitRequest>(responseText);
};

/**
 * Fetch closed post position details + equipment details for View Details (History → Closed).
 *
 * Backend endpoint naming varies across environments, so this tries a couple of common routes.
 * Returns `null` if none succeed.
 */
export const getClosedPostPositionDetails = async (
  postPositionId: string
): Promise<ClosedPostPositionDetailsResponse> => {
  const trimmed = (postPositionId || '').trim();
  if (!trimmed) return null;

  // Swagger: GET /api/ClosedPostPositionEquipment/post-position/{postPositionId}
  // Our api client already prefixes the base API path, so we omit `/api` here.
  const endpoint = `/ClosedPostPositionEquipment/post-position/${encodeURIComponent(trimmed)}`;
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch closed job position details');
  if (!responseText || responseText.trim() === '') return null;
  return parseJsonText<ClosedPostPositionDetailsResponse>(responseText);
};

/**
 * Fetch closed post position details list by postPositionId.
 * Swagger: GET /ClosedPostPositionEquipment/post-position/{postPositionId}/list
 */
export const getClosedPostPositionDetailsList = async (
  postPositionId: string
): Promise<ClosedPostPositionDetailsListResponse> => {
  const trimmed = (postPositionId || '').trim();
  if (!trimmed) return [];

  const endpoint = `/ClosedPostPositionEquipment/post-position/${encodeURIComponent(trimmed)}/list`;
  const response = await apiGet(endpoint);
  const responseText = await expectOkReadText(response, 'Failed to fetch closed job position details list');
  if (!responseText || responseText.trim() === '') return [];
  return parseJsonTextArray<ClosedPostPositionDetailsListResponse[number]>(responseText);
};

/**
 * Decline a split request
 * @param postPositionId - The post position ID
 * @returns Promise<void>
 */
export const declineSplitRequest = async (postPositionId: string): Promise<void> => {
  const endpoint = `/PostPosition/${postPositionId}/decline-split`;
  const response = await apiPost(endpoint);
  await expectOkReadText(response, 'Failed to decline split request');
};


