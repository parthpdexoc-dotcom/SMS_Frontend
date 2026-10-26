import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Tooltip from '@mui/material/Tooltip';
import {
  SMSButton,
  SMSTextField,
  SMSCheckbox,
  SMSDropdown,
  SMSDatePicker,
  SMSTimePicker,
  SMSCard,
  SMSBox,
  SMSStack,
  SMSTypography,
  SMSGrid,
  SMSIcon,
  SMSChip,
  SMSRadio,
  SMSForm,
  SMSLoader,
} from '@/components/smsatoms';
import { SMSDataDisplay } from '@/components/smsmolecules';
import { PostDetailsDisplay } from '@/components/smsmolecules/PostDetailsDisplay';
import {
  PostCloseFormData,
  EquipmentDetail,
  VehicleDetail,
  QuestionnaireSubmission,
  CloseFormSubmitDeferredError,
} from '@/types/postCloseForm';
import { PostPositionResponse } from '@/types/postPosition';
import { ACTIVITY_FORM, POST, POST_POSITION } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { readPostIsFlexibleFromUnknown } from '@/services/postPositionService';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import { getActivityForm } from '@/services/activityFormService';
import {
  mapClosedDetailsAnswerToQuestionnaireValue,
  mapQuestionnaireFormToActivityFormData,
} from '@/utils/activityFormUtils';
import { ActivityFormData, QuestionTypeEnum } from '@/types/activityForm';
import { showToast } from '@/store/slices/toastSlice';
import {
  clearEmployeeByNumberLookup,
  fetchEmployeeByNumberThunk,
} from '@/store/slices/employeeSlice';
import type { EmployeeByNumberLookup } from '@/types/employee';
import { durationMinutesClockToClock, formatTimeToHHmm, timeStringToMinutes } from '@/utils/dateTimeUtils';
import { formatCurrency } from '@/utils/formatters';
import { formatMileageCharge } from '@/types/invoice';
import { subMonths, startOfDay, format as formatDateFns } from 'date-fns';
import {
  formatBool,
  isNegativeNumberInput,
  sanitizeMileageInput,
  formatMileageTwoDecimals,
  getTotalMileageDisplay,
  normalizeMileageFromApi,
} from './utils';
import {
  getDefaultFormData,
  coalescePostPositionId,
  closeFormWorkDateString,
  closeFormScheduledStartTime,
  WORK_START_PICKER_DAY_FORMAT,
  parseDayOnlyLocal,
  minutesToHHmm,
  splitEndTimeFromWorkStartAndDuration,
} from './closeFormRowUtils';
import { fetchCloseFormBootstrap } from './closeFormBootstrap';
import { CloseFormCard, CloseFormStepper } from './CloseFormChrome';
import type { SMSCloseFormProps } from './SMSCloseForm.types';
import type { QuestionnaireStepData } from './types';

import { QuestionnaireLoadingStep } from './steps';
import './SMSCloseForm.css';

const CF = POST_POSITION.CLOSE_FORM;

/** Backend: 0 = Per Hour, 1 = Per Item */
const CHARGED_TYPE_PER_ITEM = 1;

function isPerItemChargeLine(line: PostEquipmentDto): boolean {
  if (line.chargedType === CHARGED_TYPE_PER_ITEM) return true;
  if (line.chargedType === 0) return false;
  return line.isVehicle === false;
}

function incomingEquipmentQuantity(line: Pick<PostEquipmentDto, 'equipmentQuantity'>): string {
  const qty = line.equipmentQuantity;
  return qty != null && qty > 0 ? String(qty) : '';
}

function initialUsedEquipmentQuantity(
  line: PostEquipmentDto,
  prior?: string,
  closedRow?: Record<string, unknown>
): string {
  const incoming = incomingEquipmentQuantity(line);
  if (incoming) return incoming;
  const fromPrior = prior?.trim();
  if (fromPrior) return fromPrior;
  if (closedRow) {
    const fromClosed = String(
      closedRow.usedEquipmentQuantity ?? closedRow.UsedEquipmentQuantity ?? ''
    ).trim();
    if (fromClosed) return fromClosed;
  }
  return '';
}

/** View-details / merged post lines include charge, type, chargedType — no DepartmentEquipment list call. */
function closeFormCatalogFromPostLine(
  line: PostEquipmentDto,
  unknownTypeLabel: string
) {
  return {
    departmentEquipmentID: String(line.departmentEquipmentID ?? ''),
    equipmentType:
      line.equipmentTypeName != null && String(line.equipmentTypeName).trim() !== ''
        ? String(line.equipmentTypeName).trim()
        : unknownTypeLabel,
    chargedType:
      line.chargedType ?? (line.isVehicle === false ? CHARGED_TYPE_PER_ITEM : 0),
    charge: line.charge ?? 0,
    chargeMileage: line.chargeMileage === true,
    mileageCharge: line.mileageCharge ?? 0,
    requiresApproval: line.requiresApproval ?? false,
    requiresUtilizationRecorded: line.requiresUtilizationRecorded === true,
    equipmentStatus: line.equipmentStatus ?? true,
  };
}

const STEP_1 = 1;

export const SMSCloseForm: React.FC<SMSCloseFormProps> = ({
  postPosition,
  employeeName,
  employeeID,
  closedDetailsData,
  hideQuestionnaireIfNoClosedSubmission = false,
  disableQuestionnaire = false,
  isSplitMode = false,
  onSubmit,
  onCancel,
  allowWhenSuspended = false,
}) => {
  const suspendedBypassProps = allowWhenSuspended ? ({ allowWhenSuspended: true } as const) : {};
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [step, setStep] = useState(STEP_1);
  const [data, setData] = useState<PostCloseFormData>(() =>
    getDefaultFormData(postPosition, employeeName, employeeID)
  );
  const [equipmentDetails, setEquipmentDetails] = useState<EquipmentDetail[]>([]);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetail[]>([]);
  const [requestVehicles, setRequestVehicles] = useState<PostEquipmentDto[]>([]);
  const [requestEquipment, setRequestEquipment] = useState<PostEquipmentDto[]>([]);
  const [questionnaireSteps, setQuestionnaireSteps] = useState<QuestionnaireStepData[]>([]);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<
    Record<string, Record<string, string | string[]>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [splitEmployeeBadgeNumber, setSplitEmployeeBadgeNumber] = useState<string>('');
  const [isSelfSplit, setIsSelfSplit] = useState<boolean>(false);
  const [departmentIdForEquipment, setDepartmentIdForEquipment] = useState<string>('');
  /** Whether we've attempted to fetch request equipment/vehicles at least once */
  const [equipmentFetchAttempted, setEquipmentFetchAttempted] = useState(false);
  /** Validation errors for equipment step: detailId -> field -> message (e.g. "Please fill out this field.") */
  const [equipmentValidationErrors, setEquipmentValidationErrors] = useState<Record<string, Record<string, string>>>({});
  /** Validation errors for close details step (top card) */
  const [closeValidationErrors, setCloseValidationErrors] = useState<Record<string, string>>({});
  /** Validation errors for vehicle step: detailId -> field -> message */
  const [vehicleValidationErrors, setVehicleValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [questionnaireValidationErrors, setQuestionnaireValidationErrors] = useState<Record<string, string>>({});
  const [splitValidationErrors, setSplitValidationErrors] = useState<Record<string, string>>({});
  /** View-details post position; includes `postIsFlexible` from API `post` (see mapPostPositionListViewDetails). */
  const [postDetailsFromApi, setPostDetailsFromApi] = useState<PostPositionResponse | null>(null);
  /** When true, Work Start Date and Split Date of Work are editable (from view-details `post.postIsFlexible`). */
  const postIsFlexible = useMemo(
    () => readPostIsFlexibleFromUnknown(postDetailsFromApi) === true,
    [postDetailsFromApi]
  );
  /** Raw post equipment from view-details (split into requestVehicles / requestEquipment by isVehicle) */
  const [requestEquipmentRaw, setRequestEquipmentRaw] = useState<PostEquipmentDto[]>([]);
  /** When true, initial APIs (post details, request, equipment, questionnaires) are still loading; hide the form until ready. */
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  /** Guard to prefill work end time once from postEndTime when the field is still empty. */
  const hasPrefilledWorkEndRef = useRef(false);
  const effectiveDepartmentId = departmentIdForEquipment || user?.departmentID || '';
  const departmentConfig = useAppSelector((state) =>
    effectiveDepartmentId ? state.departmentConfiguration.configByDepartmentId[effectiveDepartmentId] ?? null : null
  );
  const hasDepartmentConfigEntry = useAppSelector((state) =>
    effectiveDepartmentId
      ? Object.prototype.hasOwnProperty.call(state.departmentConfiguration.configByDepartmentId, effectiveDepartmentId)
      : false
  );
  const canEditWorkStartTimeAfterPostBegins =
    departmentConfig?.enableEmployeeEditStartEndTimesAfterPostBegins === true ||
    (departmentConfig as unknown as Record<string, unknown> | null)?.EnableEmployeeEditStartEndTimesAfterPostBegins === true;
  const isClosedDetailsMode = useMemo(() => Boolean(closedDetailsData), [closedDetailsData]);
  const closedSubmissionQuestionnaireCount = useMemo(() => {
    const submissions = Array.isArray((closedDetailsData as any)?.questionnaireSubmissions)
      ? ((closedDetailsData as any).questionnaireSubmissions as Array<{ questionnaireId?: string }>)
      : [];
    return submissions.filter((s) => String(s?.questionnaireId ?? '').trim().length > 0).length;
  }, [closedDetailsData]);

  // Normalize IDs from list row (same rules as getDefaultFormData — include parent id fallbacks).
  const postPositionId = useMemo(() => {
    const raw = postPosition as unknown as Record<string, unknown>;
    return coalescePostPositionId(postPosition, raw);
  }, [postPosition]);
  const requestId = useMemo(() => {
    const raw = postPosition as unknown as Record<string, unknown>;
    const v = postPosition.requestID ?? raw?.RequestID ?? raw?.requestID ?? raw?.requestId;
    return (typeof v === 'string' ? v : (v != null ? String(v) : '')) as string;
  }, [postPosition]);

  const closeFormWorkDate = useMemo(() => closeFormWorkDateString(postPosition), [postPosition]);
  const closeFormRowStartTime = useMemo(() => closeFormScheduledStartTime(postPosition), [postPosition]);

  /** Split step: hug content widths — equal 1fr columns stretched the row and exaggerated gaps. */
  const splitJobToolbarGridColumnsSm = useMemo(() => {
    const cols = ['auto', 'auto', 'auto'];
    if (!isSelfSplit) {
      cols.push('minmax(9rem, 15rem)', 'auto');
    }
    cols.push('auto');
    return cols.join(' ');
  }, [isSelfSplit]);

  // Reset form and caches when post position changes (e.g. open form for different row)
  useEffect(() => {
    setData(getDefaultFormData(postPosition, employeeName, employeeID));
    setStep(STEP_1);
    setPostDetailsFromApi(null);
    setRequestEquipmentRaw([]);
    setEquipmentFetchAttempted(false);
    hasPrefilledWorkEndRef.current = false;
  }, [postPositionId, employeeName, employeeID, postPosition]);

  // Prefill from closed-post-position details API (used in Close Assignments edit flow).
  useEffect(() => {
    if (!closedDetailsData) return;
    const cp = (closedDetailsData as any)?.closedPostPosition ?? (closedDetailsData as any)?.ClosedPostPosition;
    const rawEquipments = Array.isArray((closedDetailsData as any)?.equipments)
      ? ((closedDetailsData as any).equipments as any[])
      : [];
    if (cp && typeof cp === 'object') {
      const existingClosedPostPositionId = String(
        cp.closedPostPositionID ??
          cp.closedPostPositionId ??
          cp.ClosedPostPositionID ??
          cp.ClosedPostPositionId ??
          ''
      ).trim();
      const workStartDateRaw = (cp.workStartDate ?? cp.WorkStartDate ?? cp.dateOfWork ?? cp.DateOfWork ?? '') as string;
      const workStartDate = workStartDateRaw ? String(workStartDateRaw).split('T')[0] : '';
      const workStartTime = formatTimeToHHmm(String(cp.workStartTime ?? cp.WorkStartTime ?? cp.startTime ?? cp.StartTime ?? '')) ?? '';
      const workEndTime =
        formatTimeToHHmm(String(cp.workEndTime ?? cp.WorkEndTime ?? '')) ?? '';
      const hoursWorkedRaw = cp.hoursWorked ?? cp.HoursWorked ?? '';
      const minimumHoursDueRaw = cp.minimumHoursDue ?? cp.MinimumHoursDue ?? '';
      const toHHmm = (v: unknown): string => {
        const s = String(v ?? '').trim();
        if (!s) return '';
        if (s.includes(':')) return formatTimeToHHmm(s) ?? s;
        const n = Number(s);
        if (Number.isNaN(n)) return s;
        const hh = String(Math.floor(n / 60)).padStart(2, '0');
        const mm = String(Math.floor(n % 60)).padStart(2, '0');
        return `${hh}:${mm}`;
      };

      setData((prev) => ({
        ...prev,
        closedPostPositionID: null,
        parentClosedPostPositionID: existingClosedPostPositionId || prev.parentClosedPostPositionID || null,
        workStartDate: workStartDate || prev.workStartDate,
        requestedStartDate: workStartDate || prev.requestedStartDate,
        workStartTime: workStartTime || prev.workStartTime,
        requestedStartTime: workStartTime || prev.requestedStartTime,
        workEndTime: workEndTime || prev.workEndTime,
        hoursWorked: toHHmm(hoursWorkedRaw) || prev.hoursWorked,
        workedOnDuty: Boolean(cp.workedOnDuty ?? cp.WorkedOnDuty ?? prev.workedOnDuty),
        comment: String(cp.comment ?? cp.Comment ?? prev.comment ?? ''),
        isMinimumDue: Boolean(cp.isMinimumDue ?? cp.IsMinimumDue ?? prev.isMinimumDue),
        minimumHoursDue: toHHmm(minimumHoursDueRaw) || prev.minimumHoursDue,
      }));
    }

    const isVehicleItem = (eq: any): boolean => {
      const flag = eq?.departmentEquipmentIsVehicle;
      if (flag === true) return true;
      if (flag === false) return false;
      return !!(eq?.vehNumber ?? eq?.VehNumber ?? eq?.vehicleOwnedBy ?? eq?.VehicleOwnedBy);
    };

    const equipmentItems = rawEquipments.filter((x) => !isVehicleItem(x));
    const vehicleItems = rawEquipments.filter((x) => isVehicleItem(x));

    setRequestEquipment(
      equipmentItems.map((eq, idx) => ({
        postEquipmentID: String(eq?.postEquipmentID ?? eq?.PostEquipmentID ?? `eq-${idx}`),
        postID: String(eq?.postID ?? eq?.PostID ?? postPosition.postID ?? ''),
        departmentEquipmentID: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? ''),
        equipmentName: String(eq?.departmentEquipmentName ?? eq?.DepartmentEquipmentName ?? '').trim() || null,
        equipmentTypeName: String(eq?.departmentEquipmentName ?? eq?.DepartmentEquipmentName ?? '').trim() || null,
        equipmentPerPostPosition: true,
        equipmentQuantity: Number(eq?.equipmentQuantity ?? eq?.EquipmentQuantity ?? eq?.usedEquipmentQuantity ?? eq?.UsedEquipmentQuantity ?? 1) || 1,
        isVehicle: false,
      }))
    );
    setRequestVehicles(
      vehicleItems.map((eq, idx) => ({
        postEquipmentID: String(eq?.postEquipmentID ?? eq?.PostEquipmentID ?? `veh-${idx}`),
        postID: String(eq?.postID ?? eq?.PostID ?? postPosition.postID ?? ''),
        departmentEquipmentID: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? ''),
        equipmentName: String(eq?.departmentEquipmentName ?? eq?.DepartmentEquipmentName ?? '').trim() || null,
        equipmentTypeName: String(eq?.departmentEquipmentName ?? eq?.DepartmentEquipmentName ?? '').trim() || null,
        equipmentPerPostPosition: true,
        equipmentQuantity: Number(eq?.equipmentQuantity ?? eq?.EquipmentQuantity ?? eq?.usedEquipmentQuantity ?? eq?.UsedEquipmentQuantity ?? 1) || 1,
        isVehicle: true,
        chargeMileage: Boolean(eq?.chargeMileage ?? eq?.ChargeMileage),
      }))
    );

    setEquipmentDetails(
      equipmentItems.map((eq, idx) => ({
        id: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? `eq-${idx}`),
        departmentEquipment: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? ''),
        isWorked: Boolean(eq?.isWorked ?? eq?.IsWorked ?? true),
        noWorkReason: String(eq?.noWorkReason ?? eq?.NoWorkReason ?? ''),
        isUnPaidBreakTime: Boolean(eq?.isUnPaidBreakTime ?? eq?.IsUnPaidBreakTime ?? false),
        breakTime: String(eq?.breakTime ?? eq?.BreakTime ?? ''),
        usedEquipmentQuantity: initialUsedEquipmentQuantity(
          {
            equipmentPerPostPosition: true,
            equipmentQuantity: Number(eq?.equipmentQuantity ?? eq?.EquipmentQuantity ?? 0) || 0,
            isVehicle: false,
            chargedType: CHARGED_TYPE_PER_ITEM,
          } as PostEquipmentDto,
          undefined,
          eq as Record<string, unknown>
        ),
        equipmentUsedHours: '',
        paidHours: '',
        equipmentUsedIsVehicle: false,
        reimburseStatus: '',
        payRate: String(eq?.payRate ?? eq?.PayRate ?? ''),
        reimbursePayRate: String(eq?.reimbursePayRate ?? eq?.ReimbursePayRate ?? ''),
      }))
    );

    setVehicleDetails(
      vehicleItems.map((eq, idx) => ({
        id: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? `veh-${idx}`),
        departmentEquipment: String(eq?.departmentEquipmentID ?? eq?.DepartmentEquipmentID ?? ''),
        equipmentUsedIsVehicle: true,
        vehicleOwnedBy: String(eq?.vehicleOwnedBy ?? eq?.VehicleOwnedBy ?? ''),
        vehNumber: String(eq?.vehNumber ?? eq?.VehNumber ?? ''),
        startMileage: normalizeMileageFromApi(eq?.startMileage ?? eq?.StartMileage ?? ''),
        endMileage: normalizeMileageFromApi(eq?.endMileage ?? eq?.EndMileage ?? ''),
            usedEquipmentQuantity: initialUsedEquipmentQuantity(
          {
            equipmentPerPostPosition: true,
            equipmentQuantity: Number(eq?.equipmentQuantity ?? eq?.EquipmentQuantity ?? 0) || 0,
            isVehicle: true,
          } as PostEquipmentDto,
          String(eq?.usedEquipmentQuantity ?? eq?.UsedEquipmentQuantity ?? ''),
          eq as Record<string, unknown>
        ),
        equipmentUsedHours: String(eq?.equipmentUsedHours ?? eq?.EquipmentUsedHours ?? ''),
      }))
    );
  }, [closedDetailsData]);

  // In closed-details mode, build questionnaire steps from closed questionnaire submissions only.
  useEffect(() => {
    if (!isClosedDetailsMode) return;
    const submissions = Array.isArray((closedDetailsData as any)?.questionnaireSubmissions)
      ? ((closedDetailsData as any).questionnaireSubmissions as Array<{ questionnaireId?: string }>)
      : [];
    const questionnaireIds = Array.from(
      new Set(
        submissions
          .map((s) => String(s.questionnaireId ?? '').trim())
          .filter((id) => id.length > 0)
      )
    );

    if (questionnaireIds.length === 0) {
      setQuestionnaireSteps([]);
      setQuestionnaireLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setQuestionnaireLoading(true);
      try {
        const formResponses = await Promise.all(
          questionnaireIds.map((id) =>
            getActivityForm(id).catch(() => null)
          )
        );
        if (cancelled) return;
        const steps = formResponses
          .filter((res): res is NonNullable<typeof res> => res !== null)
          .map((res) => ({
            questionnaireId: res.questionnaire.questionnaireId,
            title: res.questionnaire.title || CF.DEFAULT_QUESTIONNAIRE_TITLE,
            formData: mapQuestionnaireFormToActivityFormData(res),
          }));
        setQuestionnaireSteps(steps);
      } finally {
        if (!cancelled) setQuestionnaireLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isClosedDetailsMode, closedDetailsData]);

  // After questionnaire schemas load, map API answers (plain text / comma-separated labels or JSON ids) to option ids.
  useEffect(() => {
    if (!isClosedDetailsMode || !closedDetailsData || questionnaireSteps.length === 0) return;
    const questionnaireSubmissions = Array.isArray((closedDetailsData as any)?.questionnaireSubmissions)
      ? ((closedDetailsData as any).questionnaireSubmissions as Array<{
          questionnaireId?: string;
          answers?: Array<{ questionId?: string; answer?: string; optionText?: string | null }>;
        }>)
      : [];
    if (questionnaireSubmissions.length === 0) return;

    const mapped: Record<string, Record<string, string | string[]>> = {};
    questionnaireSteps.forEach((step) => {
      const sub = questionnaireSubmissions.find(
        (s) => String(s.questionnaireId ?? '').trim() === step.questionnaireId
      );
      if (!sub) return;
      const answerMap: Record<string, string | string[]> = {};
      step.formData.questions.forEach((q) => {
        const ans = sub.answers?.find((a) => String(a.questionId ?? '').trim() === q.id);
        if (!ans) return;
        const raw =
          ans.optionText != null && String(ans.optionText).trim() !== ''
            ? String(ans.optionText).trim()
            : String(ans.answer ?? '');
        if (raw === '') return;
        answerMap[q.id] = mapClosedDetailsAnswerToQuestionnaireValue(q, raw);
      });
      mapped[step.questionnaireId] = answerMap;
    });
    if (Object.keys(mapped).length > 0) {
      setQuestionnaireResponses((prev) => ({ ...prev, ...mapped }));
    }
  }, [isClosedDetailsMode, closedDetailsData, questionnaireSteps]);

  // Bootstrap: GET /Request/view-details (same as Employee Dashboard + Ready to Close "View Details"), then questionnaires.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const snap = await fetchCloseFormBootstrap({
        dispatch,
        postPosition,
        postPositionId,
        requestId,
        closeFormWorkDate,
        userDepartmentId: user?.departmentID,
        isClosedDetailsMode,
        cancelled: () => cancelled,
        setQuestionnaireLoading,
      });
      if (cancelled) return;
      if (snap.postDetailsFromApi !== undefined) {
        setPostDetailsFromApi(snap.postDetailsFromApi);
      }
      setDepartmentIdForEquipment(snap.departmentIdForEquipment);
      setRequestEquipmentRaw(snap.requestEquipmentRaw);
      if (snap.questionnaireSteps !== undefined) {
        setQuestionnaireSteps(snap.questionnaireSteps);
      }
    };

    run().finally(() => {
      if (!cancelled) {
        setBootstrapLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postPositionId, requestId, user?.departmentID, isClosedDetailsMode, closeFormWorkDate, postPosition, dispatch]);

  useEffect(() => {
    if (!effectiveDepartmentId || hasDepartmentConfigEntry) return;
    dispatch(fetchDepartmentConfigByDepartmentId(effectiveDepartmentId));
  }, [dispatch, effectiveDepartmentId, hasDepartmentConfigEntry]);

  // Split view-details equipment lines into vehicles vs non-vehicles (isVehicle + utilization flags on each line).
  useEffect(() => {
    if (isClosedDetailsMode) return;
    if (requestEquipmentRaw.length === 0) {
      setRequestVehicles([]);
      setRequestEquipment([]);
      setEquipmentFetchAttempted(true);
      return;
    }
    const skipUtil = (item: PostEquipmentDto) => item.requiresUtilizationRecorded === true;
    const vehicles = requestEquipmentRaw.filter((item) => item.isVehicle === true && !skipUtil(item));
    const explicitNonVehicles = requestEquipmentRaw.filter(
      (item) => item.isVehicle === false && !skipUtil(item)
    );
    const unknownKind = requestEquipmentRaw.filter(
      (item) => item.isVehicle !== true && item.isVehicle !== false && !skipUtil(item)
    );
    setRequestVehicles(vehicles);
    setRequestEquipment([...explicitNonVehicles, ...unknownKind]);
    setEquipmentFetchAttempted(true);
  }, [requestEquipmentRaw, isClosedDetailsMode]);

  // Edit-close: section details (charge, mileage, approval, status) come from view-details, not closed-post equipment.
  useEffect(() => {
    if (!isClosedDetailsMode || requestEquipmentRaw.length === 0) return;

    const catalogByDeptId = new Map(
      requestEquipmentRaw
        .filter((line) => line.departmentEquipmentID)
        .map((line) => [String(line.departmentEquipmentID), line])
    );
    if (catalogByDeptId.size === 0) return;

    const enrichFromViewDetails = (row: PostEquipmentDto): PostEquipmentDto => {
      const catalog = catalogByDeptId.get(String(row.departmentEquipmentID ?? ''));
      if (!catalog) return row;
      return {
        ...row,
        charge: catalog.charge,
        mileageCharge: catalog.mileageCharge,
        chargeMileage: catalog.chargeMileage,
        requiresApproval: catalog.requiresApproval,
        requiresUtilizationRecorded: catalog.requiresUtilizationRecorded,
        equipmentStatus: catalog.equipmentStatus,
        chargedType: catalog.chargedType,
        equipmentTypeName: catalog.equipmentTypeName ?? row.equipmentTypeName,
      };
    };

    setRequestVehicles((prev) => prev.map(enrichFromViewDetails));
    setRequestEquipment((prev) => prev.map(enrichFromViewDetails));
    setVehicleDetails((prev) =>
      prev.map((detail) => {
        const catalog = catalogByDeptId.get(detail.departmentEquipment);
        if (!catalog || catalog.chargedType === detail.chargedType) return detail;
        return { ...detail, chargedType: catalog.chargedType };
      })
    );
  }, [isClosedDetailsMode, requestEquipmentRaw]);

  // When post is not flexible, keep workStartDate in sync with Date of Work (details)
  useEffect(() => {
    if (!postIsFlexible && closeFormWorkDate) {
      const dateOfWork = closeFormWorkDate;
      setData((prev) =>
        prev.workStartDate === dateOfWork ? prev : { ...prev, workStartDate: dateOfWork }
      );
    }
  }, [postIsFlexible, closeFormWorkDate]);

  /** Flexible posts only: min = one month before date of work (no max - dates after scheduled work day are allowed). */
  const flexibleWorkStartDateBounds = useMemo(() => {
    const dOw = parseDayOnlyLocal(closeFormWorkDate);
    if (!dOw) return { min: undefined as string | undefined };
    const monthBefore = startOfDay(subMonths(dOw, 1));
    return {
      min: formatDateFns(monthBefore, WORK_START_PICKER_DAY_FORMAT),
    };
  }, [closeFormWorkDate]);

  useEffect(() => {
    if (!postIsFlexible) return;
    const { min } = flexibleWorkStartDateBounds;
    if (!min) return;
    setData((prev) => {
      const picked = parseDayOnlyLocal(prev.workStartDate);
      if (!picked) return prev;
      const minP = parseDayOnlyLocal(min)!;
      if (picked >= minP) return prev;
      return { ...prev, workStartDate: formatDateFns(minP, WORK_START_PICKER_DAY_FORMAT) };
    });
  }, [postIsFlexible, flexibleWorkStartDateBounds.min, postPositionId]);

  // Baseline date for split Date of Work: use flexible workStartDate when allowed, otherwise fixed DateOfWork
  const minSplitDate = React.useMemo(() => {
    const base = postIsFlexible
      ? (data.workStartDate || closeFormWorkDate || '')
      : closeFormWorkDate || '';
    return base ? String(base).split('T')[0] : '';
  }, [postIsFlexible, data.workStartDate, closeFormWorkDate]);

  const postDurationMinutes = useMemo(() => {
    const detailsRaw = (postDetailsFromApi as unknown as Record<string, unknown> | null) ?? null;
    const rowRaw = (postPosition as unknown as Record<string, unknown> | null) ?? null;
    const rawValue =
      postDetailsFromApi?.postLength ??
      postDetailsFromApi?.lengthOfWork ??
      postPosition.postLength ??
      ('lengthOfWork' in postPosition ? postPosition.lengthOfWork : undefined) ??
      detailsRaw?.PostLength ??
      detailsRaw?.LengthOfWork ??
      rowRaw?.PostLength ??
      rowRaw?.LengthOfWork;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }, [postDetailsFromApi, postPosition]);

  /** Post scheduled end from postEndTime (view-details API, then list row). */
  const postScheduledEndTime = useMemo(() => {
    const fromApi = postDetailsFromApi?.postEndTime;
    if (fromApi != null && String(fromApi).trim() !== '') {
      return formatTimeToHHmm(String(fromApi)) ?? '';
    }
    const rowRaw = (postPosition as unknown as Record<string, unknown> | null) ?? null;
    const rawEnd = rowRaw?.postEndTime ?? rowRaw?.PostEndTime;
    if (rawEnd != null && String(rawEnd).trim() !== '') {
      return formatTimeToHHmm(String(rawEnd)) ?? '';
    }
    return '';
  }, [postDetailsFromApi, postPosition]);

  /** Split step end time: postEndTime when present, else start + post length. */
  const postScheduledEndTimeForSplit = useMemo(() => {
    if (postScheduledEndTime) return postScheduledEndTime;
    const day = String(closeFormWorkDate || '').split('T')[0];
    const start = formatTimeToHHmm(closeFormRowStartTime ?? '') ?? '';
    if (postDurationMinutes != null && /^\d{4}-\d{2}-\d{2}$/.test(day) && start) {
      const computed = splitEndTimeFromWorkStartAndDuration(
        day,
        start,
        minutesToHHmm(postDurationMinutes)
      );
      return computed?.time ?? '';
    }
    return '';
  }, [
    postScheduledEndTime,
    closeFormWorkDate,
    closeFormRowStartTime,
    postDurationMinutes,
  ]);

  // Ensure splitStartDate is at least minSplitDate and defaults to that value
  useEffect(() => {
    if (!minSplitDate) return;
    setData((prev) => {
      const current = (prev.splitStartDate ?? '').split('T')[0];
      if (!current || current < minSplitDate) {
        return { ...prev, splitStartDate: minSplitDate };
      }
      return prev;
    });
  }, [minSplitDate]);

  // Split step: end time must differ from start time on the clock (same as job end vs start).
  useEffect(() => {
    const st = formatTimeToHHmm(data.splitStartTime) ?? '';
    const et = formatTimeToHHmm(data.splitEndTime) ?? '';
    if (st && et && st === et) {
      setSplitValidationErrors((prev) => ({
        ...prev,
        splitEndTime: POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START,
      }));
    } else {
      setSplitValidationErrors((prev) => {
        if (prev.splitEndTime !== POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START) return prev;
        return { ...prev, splitEndTime: '' };
      });
    }
  }, [data.splitStartTime, data.splitEndTime]);

  // When splitting, new position start = work start (step 1) + hours worked; prefill the split step.
  useEffect(() => {
    if (!isSplitMode) return;
    const baseDate = postIsFlexible
      ? (data.workStartDate || closeFormWorkDate || '')
      : (closeFormWorkDate || data.workStartDate || '');
    const d = String(baseDate).split('T')[0];
    const res = splitEndTimeFromWorkStartAndDuration(
      d,
      data.workStartTime,
      data.hoursWorked
    );
    if (!res) return;
    setData((prev) => {
      const startMatches =
        (prev.splitStartTime ?? '') === res.time &&
        (prev.splitStartDate ?? '').split('T')[0] === res.date;
      const shouldPrefillEnd =
        !formatTimeToHHmm(prev.splitEndTime) && Boolean(postScheduledEndTimeForSplit);
      if (startMatches && !shouldPrefillEnd) return prev;
      return {
        ...prev,
        ...(!startMatches ? { splitStartTime: res.time, splitStartDate: res.date } : {}),
        ...(shouldPrefillEnd ? { splitEndTime: postScheduledEndTimeForSplit } : {}),
      };
    });
  }, [
    isSplitMode,
    postIsFlexible,
    data.workStartDate,
    data.workStartTime,
    data.hoursWorked,
    closeFormWorkDate,
    postScheduledEndTimeForSplit,
  ]);

  // Hours worked = clock duration from Work Start Time to Work End Time (overnight supported), same as edit job form.
  // Same start/end is allowed in the close form and yields 00:00 hours worked.
  useEffect(() => {
    const start = formatTimeToHHmm(data.workStartTime) ?? '';
    const end = formatTimeToHHmm(data.workEndTime) ?? '';

    setData((prev) => {
      let nextHours = '';
      if (start && end) {
        if (start === end) {
          nextHours = '00:00';
        } else {
          const mins = durationMinutesClockToClock(start, end);
          if (mins != null && mins > 0) {
            nextHours = minutesToHHmm(mins);
          }
        }
      }
      const prevHours = formatTimeToHHmm(prev.hoursWorked) ?? '';
      if (prevHours === nextHours) return prev;
      return { ...prev, hoursWorked: nextHours };
    });

    setCloseValidationErrors((prev) => {
      const next = { ...prev };
      if (next.workEndTime === POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START) {
        next.workEndTime = '';
      }
      if (next.hoursWorked === CF.HOURS_WORKED_EXCEEDS_ALLOWED) {
        next.hoursWorked = '';
      }
      return next;
    });
  }, [data.workStartTime, data.workEndTime]);

  // Prefill Work End Time once from post scheduled end (postEndTime).
  useEffect(() => {
    if (isClosedDetailsMode) return;
    if (hasPrefilledWorkEndRef.current) return;
    if (!postScheduledEndTime) return;
    setData((prev) => {
      if (formatTimeToHHmm(prev.workEndTime)) {
        hasPrefilledWorkEndRef.current = true;
        return prev;
      }
      hasPrefilledWorkEndRef.current = true;
      return { ...prev, workEndTime: postScheduledEndTime };
    });
  }, [isClosedDetailsMode, postScheduledEndTime]);

  const update = useCallback((field: keyof PostCloseFormData, value: string | boolean) => {
    if (
      field === 'workStartTime' ||
      field === 'workEndTime' ||
      field === 'hoursWorked' ||
      field === 'splitStartTime' ||
      field === 'splitEndTime'
    ) {
      value = formatTimeToHHmm(value as string) ?? '';
    }
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateEquipmentDetail = useCallback((id: string, field: keyof EquipmentDetail, value: string | boolean) => {
    setEquipmentDetails((prev) =>
      prev.map((detail) =>
        detail.id === id ? { ...detail, [field]: value } : detail
      )
    );
  }, []);

  const updateVehicleDetail = useCallback(
    (id: string, field: keyof VehicleDetail, value: string | boolean) => {
    setVehicleDetails((prev) =>
      prev.map((detail) =>
        detail.id === id ? { ...detail, [field]: value } : detail
      )
    );
  }, []);

  useEffect(() => {
    if (isClosedDetailsMode) return;
    if (requestEquipment.length === 0) {
      if (equipmentDetails.length > 0) {
        setEquipmentDetails([]);
      }
      return;
    }

    // Create new details directly (not using functional update to ensure immediate update)
    const prevByDeptId = new Map(
      equipmentDetails
        .filter((detail) => detail.departmentEquipment)
        .map((detail) => [detail.departmentEquipment, detail])
    );

    const newDetails = requestEquipment
      .filter((item) => item.departmentEquipmentID)
      .map((item) => {
        const deptId = item.departmentEquipmentID as string;
        const prior = prevByDeptId.get(deptId);
        return {
          id: deptId,
          departmentEquipment: deptId,
          isWorked: prior?.isWorked ?? true,
          noWorkReason: prior?.noWorkReason ?? '',
          isUnPaidBreakTime: prior?.isUnPaidBreakTime ?? false,
          breakTime: prior?.breakTime ?? '',
          usedEquipmentQuantity: incomingEquipmentQuantity(item),
          equipmentUsedHours: '',
          paidHours: prior?.paidHours ?? '',
          equipmentUsedIsVehicle: prior?.equipmentUsedIsVehicle ?? false,
          reimburseStatus: prior?.reimburseStatus ?? '',
          // Bind payRate to view-details line charge (same source as equipment catalog).
          payRate: String(item.charge ?? ''),
          reimbursePayRate: prior?.reimbursePayRate ?? '',
        };
      });
    
    // Only update if the details have actually changed
    setEquipmentDetails((prev) => {
      const currentIds = new Set(prev.map(d => d.departmentEquipment));
      const newIds = new Set(newDetails.map(d => d.departmentEquipment));
      const idsMatch = currentIds.size === newIds.size && 
                       [...currentIds].every(id => newIds.has(id));
      
      if (!idsMatch || prev.length !== newDetails.length) {
        return newDetails;
      } else {
        return prev;
      }
    });
  }, [requestEquipment, isClosedDetailsMode]);

  useEffect(() => {
    if (isClosedDetailsMode) return;
    if (requestVehicles.length === 0) {
      setVehicleDetails([]);
      return;
    }

    setVehicleDetails((prev) => {
      const prevByDeptId = new Map(
        prev
          .filter((detail) => detail.departmentEquipment)
          .map((detail) => [detail.departmentEquipment, detail])
      );

      return requestVehicles
        .filter((item) => item.departmentEquipmentID)
        .map((item) => {
          const deptId = item.departmentEquipmentID as string;
          const prior = prevByDeptId.get(deptId);
          return {
            id: deptId,
            departmentEquipment: deptId,
            equipmentUsedIsVehicle: prior?.equipmentUsedIsVehicle ?? false,
            vehicleOwnedBy: prior?.vehicleOwnedBy?.trim() || '',
            vehNumber: prior?.vehNumber ?? '',
            startMileage: prior?.startMileage ?? '',
            endMileage: prior?.endMileage ?? '',
            usedEquipmentQuantity: initialUsedEquipmentQuantity(item, prior?.usedEquipmentQuantity),
            chargedType: item.chargedType ?? prior?.chargedType,
            equipmentUsedHours: prior?.equipmentUsedHours ?? '',
          };
        });
    });
  }, [requestVehicles, isClosedDetailsMode, postPosition]);

  // Per Hour vehicles: used hours mirror step 1 Hours worked. Per Item vehicles do not use hours.
  useEffect(() => {
    const hoursStr = formatTimeToHHmm(data.hoursWorked) ?? '';
    setVehicleDetails((prev) => {
      let changed = false;
      const next = prev.map((detail) => {
        const vehicle = requestVehicles.find(
          (v) => v.departmentEquipmentID === detail.departmentEquipment
        );
        if (!vehicle) return detail;
        const nextHours = isPerItemChargeLine(vehicle) ? '' : hoursStr;
        if (detail.equipmentUsedHours === nextHours) return detail;
        changed = true;
        return { ...detail, equipmentUsedHours: nextHours };
      });
      return changed ? next : prev;
    });
  }, [data.hoursWorked, requestVehicles]);

  const stepFlow = useMemo(() => {
    const steps: Array<
      | { kind: 'close' | 'equipment' | 'vehicles' | 'split'; title: string }
      | { kind: 'questionnaire-loading'; title: string }
      | { kind: 'questionnaire'; title: string; questionnaireId: string; formData: ActivityFormData }
    > = [{ kind: 'close', title: CF.STEP_1_TITLE }];

    const hasEquipmentForDept = requestEquipment.length > 0;
    const hasVehiclesForDept = requestVehicles.length > 0;

    const postRaw = postDetailsFromApi == null ? null : (postDetailsFromApi as unknown as Record<string, unknown>);
    const showVehicle = postRaw?.ShowVehicle === true || postRaw?.showVehicle === true;
    const showEquipment = postRaw?.ShowEquipment === true || postRaw?.showEquipment === true;

    // Only show equipment/vehicle steps when there is data for this department.
    // While equipment lines haven't been split yet, include both; then hide empty tabs.
    if (showEquipment && (!equipmentFetchAttempted || hasEquipmentForDept)) {
      steps.push({ kind: 'equipment', title: CF.STEP_2_TITLE });
    }
    if (showVehicle && (!equipmentFetchAttempted || hasVehiclesForDept)) {
      steps.push({ kind: 'vehicles', title: CF.STEP_3_TITLE });
    }

    const hideQuestionnaireSection =
      hideQuestionnaireIfNoClosedSubmission &&
      isClosedDetailsMode &&
      closedSubmissionQuestionnaireCount === 0;

    if (!hideQuestionnaireSection && questionnaireLoading && questionnaireSteps.length === 0) {
      steps.push({ kind: 'questionnaire-loading', title: CF.QUESTIONNAIRES_TITLE });
    }

    if (!hideQuestionnaireSection) {
      questionnaireSteps.forEach((step) => {
        steps.push({
          kind: 'questionnaire',
          title: step.title,
          questionnaireId: step.questionnaireId,
          formData: step.formData,
        });
      });
    }

    if (isSplitMode) {
      steps.push({ kind: 'split', title: CF.SPLIT_SECTION_TITLE });
    }

    return steps;
  }, [
    isSplitMode,
    questionnaireLoading,
    questionnaireSteps,
    requestEquipment.length,
    requestVehicles.length,
    equipmentFetchAttempted,
    postDetailsFromApi,
    hideQuestionnaireIfNoClosedSubmission,
    isClosedDetailsMode,
    closedSubmissionQuestionnaireCount,
  ]);

  const stepperItems = useMemo(
    () =>
      stepFlow.map((item, index) => ({
        key: `${item.kind}-${item.kind === 'questionnaire' ? item.questionnaireId : index}`,
        title: item.title,
      })),
    [stepFlow]
  );

  const lastStep = stepFlow.length;
  const currentStep = stepFlow[step - 1];
  const isLastStep = step === lastStep;

  useEffect(() => {
    if (lastStep === 0) return;
    if (step > lastStep) {
      setStep(lastStep);
    }
  }, [lastStep, step]);

  const handleNext = () => {
    if (step < lastStep) {
      setStep(step + 1);
    }
  };
  
  const handleBack = () => {
    if (step > STEP_1) {
      const prevStep = step - 1;
      setStep(prevStep);
    }
  };

  const isLoadingSplitEmployeeLookup = useAppSelector(
    (state) => state.employee.isLoadingEmployeeByNumber
  );

  const isSplitEmployeeVerified = useMemo(() => {
    const id = String(data.splitEmployeeID ?? '').trim();
    const name = String(data.splitEmployeeName ?? '').trim();
    return Boolean(id && name);
  }, [data.splitEmployeeID, data.splitEmployeeName]);

  const canSubmitSplitJob = useMemo(() => {
    if (!isSplitEmployeeVerified) {
      return false;
    }
    if (!data.splitStartDate || String(data.splitStartDate).trim() === '') {
      return false;
    }
    const startTime = formatTimeToHHmm(data.splitStartTime) ?? '';
    const endTime = formatTimeToHHmm(data.splitEndTime) ?? '';
    if (!startTime || !endTime) {
      return false;
    }
    if (startTime === endTime) {
      return false;
    }
    return true;
  }, [
    isSplitEmployeeVerified,
    data.splitStartDate,
    data.splitStartTime,
    data.splitEndTime,
  ]);

  const splitSubmitDisabledTooltip = useMemo(() => {
    if (canSubmitSplitJob || isSubmitting) {
      return '';
    }
    if (!isSplitEmployeeVerified && !isSelfSplit) {
      return CF.SPLIT_VERIFY_EMPLOYEE_HINT;
    }
    return '';
  }, [canSubmitSplitJob, isSubmitting, isSplitEmployeeVerified, isSelfSplit]);

  const applySplitEmployeeLookup = useCallback(
    (lookup: EmployeeByNumberLookup) => {
      update('splitEmployeeID', lookup.employeeID);
      update('splitEmployeeName', lookup.employeeName);
      setSplitValidationErrors((prev) => ({ ...prev, splitEmployeeNumber: '' }));
    },
    [update]
  );

  const clearSplitEmployeeLookup = useCallback(() => {
    update('splitEmployeeID', '');
    update('splitEmployeeName', '');
    dispatch(clearEmployeeByNumberLookup());
  }, [dispatch, update]);

  const handleSplitEmployeeSearch = useCallback(async () => {
    if (isSelfSplit) {
      return;
    }
    const employeeNumber = splitEmployeeBadgeNumber.trim();
    if (!employeeNumber) {
      dispatch(showToast(CF.VERIFY_EMPLOYEE_NUMBER_TOAST, 'error'));
      return;
    }
    try {
      const lookup = await dispatch(fetchEmployeeByNumberThunk(employeeNumber)).unwrap();
      applySplitEmployeeLookup(lookup);
    } catch {
      clearSplitEmployeeLookup();
    }
  }, [
    isSelfSplit,
    splitEmployeeBadgeNumber,
    dispatch,
    applySplitEmployeeLookup,
    clearSplitEmployeeLookup,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If we're on close details step (first step), either go to next step or submit if this is the only step
    if (currentStep?.kind === 'close') {
      const msg = CF.VALIDATION_REQUIRED_FIELD;
      const errors: Record<string, string> = {};
      if (!data.workStartDate || String(data.workStartDate).trim() === '') {
        errors.workStartDate = msg;
      } else if (postIsFlexible && flexibleWorkStartDateBounds.min) {
        const picked = parseDayOnlyLocal(data.workStartDate);
        const minP = parseDayOnlyLocal(flexibleWorkStartDateBounds.min);
        if (picked && minP && picked < minP) {
          errors.workStartDate = CF.VALIDATION_WORK_START_DATE_RANGE;
        }
      }
      if (!formatTimeToHHmm(data.workStartTime) || String(formatTimeToHHmm(data.workStartTime)).trim() === '') {
        errors.workStartTime = msg;
      }
      if (!formatTimeToHHmm(data.workEndTime) || String(formatTimeToHHmm(data.workEndTime)).trim() === '') {
        errors.workEndTime = msg;
      }
      // Same Work Start Time and Work End Time is allowed; Hours Worked auto-computes to 00:00.
      if (!data.hoursWorked || String(data.hoursWorked).trim() === '') {
        errors.hoursWorked = msg;
      }
      // workedOnDuty is a boolean checkbox — optional; do not require it to be true
      if (data.isMinimumDue && (!data.minimumHoursDue || String(data.minimumHoursDue).trim() === '')) {
        errors.minimumHoursDue = msg;
      }

      if (Object.keys(errors).length > 0) {
        setCloseValidationErrors(errors);
        return;
      }

      setCloseValidationErrors({});
      // If there are more steps after close, go to the next step.
      // If close is the only step (no equipment, vehicles, or questionnaires), fall through to final submission.
      if (!isLastStep) {
        handleNext();
        return;
      }
    }
    
    // If we're on equipment step, validate required fields then either go next or submit if this is the last step
    if (currentStep?.kind === 'equipment') {
      const msg = CF.VALIDATION_REQUIRED_FIELD;
      const errors: Record<string, Record<string, string>> = {};
      requestEquipment.forEach((equipment) => {
        const detail = equipmentDetails.find(
          (item) => item.departmentEquipment === equipment.departmentEquipmentID
        );
        if (!detail) return;
        const detailErrors: Record<string, string> = {};
        // Require No Work Reason when not worked
        if (!detail.isWorked) {
          if (!detail.noWorkReason || String(detail.noWorkReason).trim() === '') {
            detailErrors.noWorkReason = msg;
          }
        }
        // Require Break Time when unpaid break is checked
        if (detail.isUnPaidBreakTime) {
          if (!detail.breakTime || String(detail.breakTime).trim() === '') {
            detailErrors.breakTime = msg;
          }
        }
        if (Object.keys(detailErrors).length > 0) errors[detail.id] = detailErrors;
      });
      if (Object.keys(errors).length > 0) {
        setEquipmentValidationErrors(errors);
        return;
      }
      setEquipmentValidationErrors({});

      // If there are more steps after equipment, go to the next step.
      // If equipment is the last step, fall through so we hit the final submission logic below.
      if (!isLastStep) {
        handleNext();
        return;
      }
    }
    
    // If we're on vehicles step, validate required fields then either go next or submit if this is the last step
    if (currentStep?.kind === 'vehicles') {
      const msg = CF.VALIDATION_REQUIRED_FIELD;
      const errors: Record<string, Record<string, string>> = {};

      requestVehicles.forEach((vehicle) => {
        const deptVehicle = closeFormCatalogFromPostLine(vehicle, CF.UNKNOWN_VEHICLE);
        const detail = vehicleDetails.find(
          (item) => item.departmentEquipment === vehicle.departmentEquipmentID
        );
        if (!detail) return;

        const chargeMileage = deptVehicle.chargeMileage === true;
        const detailErrors: Record<string, string> = {};

        if (!chargeMileage) {
          return;
        }

        if (!detail.vehicleOwnedBy || String(detail.vehicleOwnedBy).trim() === '') {
          detailErrors.vehicleOwnedBy = msg;
        }
        if (!detail.vehNumber || String(detail.vehNumber).trim() === '') {
          detailErrors.vehNumber = msg;
        }
        if (!detail.startMileage || String(detail.startMileage).trim() === '') {
          detailErrors.startMileage = msg;
        }
        if (!detail.endMileage || String(detail.endMileage).trim() === '') {
          detailErrors.endMileage = msg;
        } else {
          const startNum = parseFloat(detail.startMileage);
          const endNum = parseFloat(detail.endMileage);
          if (!Number.isNaN(startNum) && !Number.isNaN(endNum) && endNum <= startNum) {
            detailErrors.endMileage = CF.END_MILEAGE_MUST_BE_HIGHER;
          }
        }

        if (Object.keys(detailErrors).length > 0) {
          errors[detail.id] = detailErrors;
        }
      });

      if (Object.keys(errors).length > 0) {
        setVehicleValidationErrors(errors);
        return;
      }

      setVehicleValidationErrors({});

      // If there are more steps after vehicles, go to the next step.
      // If vehicles is the last step (e.g., no questionnaires / no split), fall through to final submission.
      if (!isLastStep) {
        handleNext();
        return;
      }
    }

    // If we're on a questionnaire step, validate required questions before proceeding or submitting
    if (currentStep?.kind === 'questionnaire' && currentStep.formData?.questions) {
      if (disableQuestionnaire) {
        if (!isLastStep) {
          handleNext();
          return;
        }
      }
      const msg = CF.VALIDATION_REQUIRED_FIELD;
      const questionnaireId = currentStep.questionnaireId;
      const answersByQuestion = questionnaireResponses[questionnaireId] || {};
      const errors: Record<string, string> = {};

      currentStep.formData.questions.forEach((question) => {
        if (!question.required) return;
        const value = answersByQuestion[question.id];
        const isEmpty =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && String(value).trim() === '') ||
          (Array.isArray(value) && value.length === 0);
        if (isEmpty) {
          errors[question.id] = msg;
        }
      });

      if (Object.keys(errors).length > 0) {
        setQuestionnaireValidationErrors(errors);
        return;
      }

      setQuestionnaireValidationErrors({});

      // Questionnaire is valid. If not last step, go next; otherwise fall through to final submission.
      if (!isLastStep) {
        handleNext();
        return;
      }
    }

    // If we're on split step, validate Date of work, Start time and Employee (must search and select) before submitting
    if (currentStep?.kind === 'split') {
      const msg = CF.VALIDATION_REQUIRED_FIELD;
      const errors: Record<string, string> = {};
      if (!data.splitStartDate || String(data.splitStartDate).trim() === '') {
        errors.splitStartDate = msg;
      }
      if (!(data.splitStartTime) || String((data.splitStartTime)).trim() === '') {
        errors.splitStartTime = msg;
      }
      if (!formatTimeToHHmm(data.splitEndTime) || String(formatTimeToHHmm(data.splitEndTime)).trim() === '') {
        errors.splitEndTime = msg;
      } else {
        const stSplit = formatTimeToHHmm(data.splitStartTime) ?? '';
        const etSplit = formatTimeToHHmm(data.splitEndTime) ?? '';
        if (stSplit && etSplit && stSplit === etSplit) {
          errors.splitEndTime = POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START;
        }
      }
      if (Object.keys(errors).length > 0) {
        setSplitValidationErrors(errors);
        return;
      }

      if (!isSplitEmployeeVerified) {
        if (isSelfSplit) {
          setSplitValidationErrors({ splitEmployeeNumber: msg });
        } else if (!splitEmployeeBadgeNumber.trim()) {
          setSplitValidationErrors({ splitEmployeeNumber: msg });
        } else {
          setSplitValidationErrors({ splitEmployeeNumber: CF.VERIFY_EMPLOYEE_BEFORE_SUBMIT });
        }
        return;
      }
      setSplitValidationErrors({});
    }

    // For final submission
    if (!onSubmit) return;
    
    setIsSubmitting(true);
    try {
      // Derive top-level reimburse / pay fields from the first equipment row when present
      const primaryEquipment = equipmentDetails[0];

      // Convert hoursWorked from time string (HH:mm or HH:mm:ss) to minutes (string)
      const hoursWorkedInMinutes = data.hoursWorked
        ? String(timeStringToMinutes(formatTimeToHHmm(data.hoursWorked) || data.hoursWorked))
        : '';

      // Convert minimumHoursDue from time string (HH:mm or HH:mm:ss) to minutes (string)
      const minimumHoursDueInMinutes = data.minimumHoursDue
        ? String(timeStringToMinutes(formatTimeToHHmm(data.minimumHoursDue) || data.minimumHoursDue))
        : '';

      // Equipment is billed per piece (quantity × charge). Do not send hours.
      const convertedEquipmentDetails = equipmentDetails.map((eq) => {
        const incoming = requestEquipment.find(
          (item) => item.departmentEquipmentID === eq.departmentEquipment
        );
        return {
          ...eq,
          usedEquipmentQuantity:
            (incoming ? incomingEquipmentQuantity(incoming) : '') || eq.usedEquipmentQuantity,
          equipmentUsedHours: '',
          breakTime: eq.breakTime
            ? String(timeStringToMinutes(formatTimeToHHmm(eq.breakTime) || eq.breakTime))
            : '',
        };
      });

      const convertedVehicleDetails = vehicleDetails.map((v) => {
        const vehicle = requestVehicles.find(
          (item) => item.departmentEquipmentID === v.departmentEquipment
        );
        const sendHoursWorked = !vehicle || !isPerItemChargeLine(vehicle);
        return {
          ...v,
          chargedType: v.chargedType ?? vehicle?.chargedType,
          equipmentUsedHours: sendHoursWorked ? hoursWorkedInMinutes : '',
        };
      });

      let enrichedData: PostCloseFormData = {
        ...data,
        // When post is not flexible, use Date of Work as Work Start Date (from details)
        workStartDate: postIsFlexible ? data.workStartDate : (closeFormWorkDate || data.workStartDate),
        hoursWorked: hoursWorkedInMinutes,
        minimumHoursDue: minimumHoursDueInMinutes,
        reimburseStatus: primaryEquipment?.reimburseStatus || data.reimburseStatus,
        payRate: primaryEquipment?.payRate || data.payRate,
        reimbursePayRate: primaryEquipment?.reimbursePayRate || data.reimbursePayRate,
      };

      const questionnaireSubmissions = getQuestionnaireSubmissions();
      await onSubmit(enrichedData, convertedEquipmentDetails, convertedVehicleDetails, questionnaireSubmissions);
    } catch (error) {
      if (error instanceof CloseFormSubmitDeferredError) {
        return;
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const setQuestionnaireResponse = useCallback(
    (questionnaireId: string, questionId: string, value: string | string[]) => {
      setQuestionnaireResponses((prev) => ({
        ...prev,
        [questionnaireId]: {
          ...(prev[questionnaireId] || {}),
          [questionId]: value,
        },
      }));
    },
    []
  );

  const getQuestionnaireSubmissions = useCallback((): QuestionnaireSubmission[] => {
    return questionnaireSteps
      .map((step) => {
        const answersByQuestion = questionnaireResponses[step.questionnaireId] || {};
        const answers = Object.entries(answersByQuestion)
          .filter(([_, raw]) => {
            if (Array.isArray(raw)) return raw.length > 0;
            return String(raw ?? '').trim() !== '';
          })
          .map(([questionId, raw]) => ({
            questionId,
            answer: Array.isArray(raw) ? JSON.stringify(raw) : String(raw),
          }));

        return {
          questionnaireId: step.questionnaireId,
          answers,
        };
      })
      .filter((submission) => submission.answers.length > 0);
  }, [questionnaireResponses, questionnaireSteps]);



  const vehicleOwnedByOptions = useMemo(
    () => [
      { value: CF.VEHICLE_OWNED_BY_OPTION_CITY, label: CF.VEHICLE_OWNED_BY_OPTION_CITY },
      { value: CF.VEHICLE_OWNED_BY_OPTION_EMPLOYEE, label: CF.VEHICLE_OWNED_BY_OPTION_EMPLOYEE },
      { value: CF.VEHICLE_OWNED_BY_OPTION_OTHER, label: CF.VEHICLE_OWNED_BY_OPTION_OTHER },
    ],
    []
  );

  /** Post details card: "Post details : {title}" when title is available from with-post or list row */
  const postDetailsSectionTitle = useMemo(() => {
    const source = postDetailsFromApi ?? postPosition;
    const raw = source as unknown as Record<string, unknown>;
    const title = String(source.postTitle ?? raw.PostTitle ?? raw.postTitle ?? '').trim();
    return title ? `${CF.POST_DETAILS_TITLE} : ${title}` : CF.POST_DETAILS_TITLE;
  }, [postDetailsFromApi, postPosition]);

  if (bootstrapLoading) {
    return (
      <SMSBox className="form-modal close-form" sx={{ width: 1 }}>
        <SMSCard variant="outlined" sx={{ p: 2 }}>
          <SMSBox sx={{ display: 'flex', justifyContent: 'center' }}>
            <SMSLoader loadingText="Loading close form..." aria-label="Loading close form..." />
          </SMSBox>
        </SMSCard>
      </SMSBox>
    );
  }

  return (
    <SMSBox className="form-modal close-form" sx={{ width: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <SMSForm noValidate onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <CloseFormStepper items={stepperItems} activeIndex1Based={step} />
      {currentStep?.kind === 'close' && (
        <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CloseFormCard title={postDetailsSectionTitle}>
            <SMSBox className="close-form__details-container">
                <PostDetailsDisplay
                  postData={postDetailsFromApi}
                  fallbackPost={postPosition}
                  layoutClassName="post-details-display__grid post-details-display--form-inline"
                  fieldClassName="close-form__details-field"
                  valueClassName="close-form__details-value"
                />
                <SMSDataDisplay
                  variant="inline"
                  className="close-form__details-field"
                  valueClassName="close-form__details-value"
                  labelFontWeight={600}
                  label={CF.CLOSE_BY}
                  value={data.closeBy || '-'}
                  icon="person"
                />
                <SMSDataDisplay
                  variant="inline"
                  className="close-form__details-field"
                  valueClassName="close-form__details-value"
                  labelFontWeight={600}
                  label={CF.CLOSE_DATE_TIME}
                  value={data.closeDateTime || '-'}
                  icon="schedule"
                />
            </SMSBox>
          </CloseFormCard>

          <CloseFormCard
            title={CF.STEP_1_TITLE}
            footer={
              <>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={onCancel}>
                  {CF.CANCEL}
                </SMSButton>
                <SMSButton {...suspendedBypassProps} type="submit" loading={isSubmitting}>
                  {isLastStep ? CF.SUBMIT : CF.NEXT}
                </SMSButton>
              </>
            }
          >
            <SMSGrid container spacing={2}>
              <SMSGrid item xs={12} sm={6} md={3}>
                  <SMSDatePicker
                    label={CF.WORK_START_DATE}
                    value={postIsFlexible ? data.workStartDate : (closeFormWorkDate || data.workStartDate)}
                    onChange={(value) => {
                      update('workStartDate', value);
                      setCloseValidationErrors((prev) => ({ ...prev, workStartDate: '' }));
                    }}
                    name="workStartDate"
                    id="workStartDate"
                    minDate={
                      postIsFlexible
                        ? flexibleWorkStartDateBounds.min
                        : closeFormWorkDate || undefined
                    }
                    required
                    disabled={!postIsFlexible}
                    error={closeValidationErrors.workStartDate}
                  />
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} md={3}>
                  <SMSTimePicker
                    label={CF.WORK_START_TIME}
                    value={formatTimeToHHmm(data.workStartTime)}
                    onChange={(selectedTime) => {
                      update('workStartTime', selectedTime);
                      setCloseValidationErrors((prev) => ({ ...prev, workStartTime: '' }));
                    }}
                    name="workStartTime"
                    required
                    disabled={!canEditWorkStartTimeAfterPostBegins}
                    error={closeValidationErrors.workStartTime}
                  />
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} md={3}>
                <SMSTimePicker
                  label={CF.WORK_END_TIME}
                  value={formatTimeToHHmm(data.workEndTime)}
                  onChange={(v) => {
                    update('workEndTime', v);
                    setCloseValidationErrors((prev) => ({ ...prev, workEndTime: '' }));
                  }}
                  name="workEndTime"
                  id="workEndTime"
                  required
                  disabled={!canEditWorkStartTimeAfterPostBegins}
                  error={closeValidationErrors.workEndTime}
                />
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} md={3}>
                <SMSTimePicker
                  label={`${CF.HOURS_WORKED}`}
                  value={formatTimeToHHmm(data.hoursWorked)}
                  name="hoursWorked"
                  id="hoursWorked"
                  required
                  disabled
                  error={closeValidationErrors.hoursWorked}
                />
              </SMSGrid>
              <SMSGrid item xs={12} sm={6} lg={4}>
                <SMSCheckbox
                    label={CF.WORKED_ON_DUTY}
                    checked={data.workedOnDuty}
                    onChange={(checked) => update('workedOnDuty', checked)}
                  />
              </SMSGrid>
              <SMSGrid item xs={12}>
                <SMSTextField
                  label={CF.COMMENT}
                  multiline
                  minRows={4}
                  maxRows={8}
                  value={data.comment}
                  onChange={(e) => update('comment', e.target.value)}
                  name="comment"
                  placeholder={CF.COMMENT_PLACEHOLDER}
                  fullWidth
                />
              </SMSGrid>
            </SMSGrid>
          </CloseFormCard>
        </SMSBox>
      )}

      {currentStep?.kind === 'split' && (
        <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CloseFormCard
            title={CF.SPLIT_SECTION_TITLE}
            footer={
              <>
                <SMSButton
                  {...suspendedBypassProps}
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  {CF.BACK}
                </SMSButton>
                <SMSButton
                  {...suspendedBypassProps}
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  {CF.CANCEL}
                </SMSButton>
                <Tooltip
                  title={splitSubmitDisabledTooltip}
                  placement="top"
                  disableHoverListener={!splitSubmitDisabledTooltip}
                  disableFocusListener={!splitSubmitDisabledTooltip}
                  disableInteractive
                  slotProps={{
                    tooltip: {
                      sx: {
                        bgcolor: 'grey.900',
                        color: 'common.white',
                        fontSize: '0.8125rem',
                        maxWidth: 280,
                        boxShadow: 2,
                      },
                    },
                  }}
                >
                  <span className="sms-close-form__submit-tooltip-wrap">
                    <SMSButton
                      {...suspendedBypassProps}
                      type="submit"
                      loading={isSubmitting}
                      disabled={isSubmitting || !canSubmitSplitJob}
                    >
                      {CF.SUBMIT_SPLIT}
                    </SMSButton>
                  </span>
                </Tooltip>
              </>
            }
          >
            <SMSStack spacing={1.5} sx={{ width: 1 }}>
            <SMSTypography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              {CF.SPLIT_JOB_START_FROM_WORK_HINT}
            </SMSTypography>
            <SMSBox
              sx={{
                display: 'grid',
                width: { xs: 1, sm: 'fit-content' },
                maxWidth: '100%',
                gap: { xs: 2, sm: 1 },
                /* start: end would dock short columns (e.g. employee w/o helper) to the row bottom and sit under end-time errors */
                alignItems: 'start',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: splitJobToolbarGridColumnsSm,
                },
                overflowX: { sm: 'auto' },
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                <SMSDatePicker
                  label={CF.DATE_OF_WORK}
                  value={
                    postIsFlexible
                      ? (data.splitStartDate ?? minSplitDate ?? '')
                      : (() => {
                          const s = (data.splitStartDate ?? '').split('T')[0];
                          if (s && minSplitDate && s >= minSplitDate) return s;
                          return closeFormWorkDate ? String(closeFormWorkDate).split('T')[0] : '';
                        })()
                  }
                  onChange={(value) => {
                    update('splitStartDate', value);
                    setSplitValidationErrors((prev) => ({ ...prev, splitStartDate: '' }));
                  }}
                  name="splitStartDate"
                  id="splitStartDate"
                  minDate={minSplitDate || undefined}
                  required
                  disabled={!postIsFlexible}
                  error={splitValidationErrors.splitStartDate}
                />
              </SMSBox>
              <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                <SMSTimePicker
                  label={CF.POSITION_START_TIME}
                  value={(data.splitStartTime ?? '')}
                  onChange={(v) => {
                    update('splitStartTime', formatTimeToHHmm(v) ?? '');
                    setSplitValidationErrors((prev) => ({ ...prev, splitStartTime: '' }));
                  }}
                  name="splitStartTime"
                  required
                  error={splitValidationErrors.splitStartTime}
                />
              </SMSBox>
              <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                <SMSTimePicker
                  label={CF.POSITION_END_TIME}
                  value={formatTimeToHHmm(data.splitEndTime) ?? ''}
                  onChange={(v) => {
                    update('splitEndTime', v);
                    setSplitValidationErrors((prev) => ({ ...prev, splitEndTime: '' }));
                  }}
                  name="splitEndTime"
                  id="splitEndTime"
                  required
                  excludeClockTime={formatTimeToHHmm(data.splitStartTime) ?? undefined}
                  error={splitValidationErrors.splitEndTime}
                />
              </SMSBox>
              {!isSelfSplit && (
                <>
                  <SMSBox sx={{ minWidth: 0, width: '100%' }}>
                    <SMSTextField
                      label={CF.EMPLOYEE_NUMBER_LABEL}
                      value={splitEmployeeBadgeNumber}
                      onChange={(e) => {
                        setSplitEmployeeBadgeNumber(e.target.value);
                        clearSplitEmployeeLookup();
                        setSplitValidationErrors((prev) => ({ ...prev, splitEmployeeNumber: '' }));
                      }}
                      name="splitEmployeeNumber"
                      placeholder={CF.SEARCH_EMPLOYEE_PLACEHOLDER}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSplitEmployeeSearch();
                        }
                      }}
                      required
                      error={!!splitValidationErrors.splitEmployeeNumber}
                      helperText={splitValidationErrors.splitEmployeeNumber || undefined}
                      fullWidth
                    />
                  </SMSBox>
                  <SMSBox sx={{ minWidth: 0, justifySelf: 'stretch', mt: 1 }}>
                    <SMSButton
                      {...suspendedBypassProps}
                      type="button"
                      variant="contained"
                      color="primary"
                      onClick={handleSplitEmployeeSearch}
                      loading={isLoadingSplitEmployeeLookup}
                      disabled={isLoadingSplitEmployeeLookup || !splitEmployeeBadgeNumber.trim()}
                      fullWidth
                      sx={{
                        height: 'var(--sms-input-height, 36px)',
                        minHeight: 'var(--sms-input-height, 36px)',
                        minWidth: { xs: '100%', sm: 120 },
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {CF.VERIFY_EMPLOYEE_BUTTON}
                    </SMSButton>
                  </SMSBox>
                </>
              )}
              <SMSBox sx={{ minWidth: 0, width: '100%', justifySelf: 'start', mt: 1 }}>
                <SMSCheckbox
                  label={CF.ALLOW_SELF_SPLIT}
                  checked={isSelfSplit}
                  onChange={(checked) => {
                    setIsSelfSplit(checked);
                    if (checked) {
                      setSplitEmployeeBadgeNumber('');
                      update('splitEmployeeID', employeeID);
                      update('splitEmployeeName', employeeName);
                      setSplitValidationErrors((prev) => ({ ...prev, splitEmployeeNumber: '' }));
                    } else {
                      clearSplitEmployeeLookup();
                    }
                  }}
                />
              </SMSBox>
            </SMSBox>
            {isSplitEmployeeVerified && data.splitEmployeeName ? (
              <SMSBox sx={{ width: 1, minWidth: 0 }}>
                <SMSStack spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0, maxWidth: '100%' }}>
                  <SMSTypography variant="body2" color="text.secondary" fontWeight={600}>
                    {CF.EMPLOYEE_NAME_LABEL}
                  </SMSTypography>
                  <SMSChip
                    size="small"
                    icon={<SMSIcon name="person" size="sm" />}
                    label={data.splitEmployeeName}
                    color="success"
                    variant="outlined"
                    sx={{
                      width: 'fit-content',
                      maxWidth: '100%',
                      '& .MuiChip-label': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  />
                </SMSStack>
              </SMSBox>
            ) : null}
            </SMSStack>
          </CloseFormCard>
        </SMSBox>
      )}

      {currentStep?.kind === 'equipment' && (
        <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CloseFormCard
            title={CF.STEP_2_TITLE}
            footer={
              <>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={handleBack} disabled={isSubmitting}>
                  {CF.BACK}
                </SMSButton>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={onCancel} disabled={isSubmitting}>
                  {CF.CANCEL}
                </SMSButton>
                <SMSButton
                  {...suspendedBypassProps}
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isLastStep ? CF.SUBMIT : CF.NEXT}
                </SMSButton>
              </>
            }
          >
                {(isClosedDetailsMode
                  ? requestEquipment.length > 0
                  : requestEquipment.length > 0) ? (
                  <SMSStack spacing={2}>
                    {requestEquipment.map((equipment) => {
                      const deptEquipment = closeFormCatalogFromPostLine(equipment, CF.UNKNOWN_EQUIPMENT);
                      const detail = equipmentDetails.find(
                        (item) => item.departmentEquipment === equipment.departmentEquipmentID
                      );
                      
                      if (!detail) {
                        return null;
                      }
                      return (
                        <SMSCard key={equipment.postEquipmentID} variant="outlined" sx={{ p: 2 }}>
                          <SMSStack spacing={2}>
                          <SMSStack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" spacing={1}>
                            <SMSTypography variant="subtitle1" fontWeight={700}>
                              {deptEquipment?.equipmentType || CF.UNKNOWN_EQUIPMENT}
                            </SMSTypography>
                            <SMSTypography variant="body2" color="text.secondary">
                            Quantity: {equipment.equipmentQuantity}
                            </SMSTypography>
                          </SMSStack>
                          <SMSGrid container spacing={1}>
                            <SMSGrid item xs={12} sm={6} md={4}>
                              <SMSDataDisplay variant="inline" label="Charge" value={formatCurrency(deptEquipment?.charge)} labelFontWeight={600} />
                            </SMSGrid>
                            <SMSGrid item xs={12} sm={6} md={4}>
                              <SMSDataDisplay variant="inline" label="Requires Approval" value={formatBool(deptEquipment?.requiresApproval)} labelFontWeight={600} />
                            </SMSGrid>
                            {deptEquipment?.requiresUtilizationRecorded && (
                              <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSDataDisplay variant="inline" label="Utilization Recorded" value={formatBool(deptEquipment?.requiresUtilizationRecorded)} labelFontWeight={600} />
                              </SMSGrid>
                            )}
                            <SMSGrid item xs={12} sm={6} md={4}>
                              <SMSDataDisplay variant="inline" label="Status" value={formatBool(deptEquipment?.equipmentStatus)} labelFontWeight={600} />
                            </SMSGrid>
                          </SMSGrid>
                          <SMSBox sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                            <SMSGrid container spacing={2}>
                              <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSCheckbox
                                  label={CF.IS_WORKED}
                                  checked={detail.isWorked}
                                  onChange={(checked) =>
                                    updateEquipmentDetail(detail.id, 'isWorked', checked)
                                  }
                                />
                              </SMSGrid>
                              {!detail.isWorked && (
                                <SMSGrid item xs={12} sm={6} md={6}>
                                <SMSTextField
                                  label={CF.NO_WORK_REASON}
                                  value={detail.noWorkReason}
                                  onChange={(e) => {
                                    updateEquipmentDetail(detail.id, 'noWorkReason', e.target.value);
                                    setEquipmentValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: { ...(prev[detail.id] || {}), noWorkReason: '' },
                                    }));
                                  }}
                                  name={`noWorkReason_${detail.id}`}
                                  required
                                  error={!!equipmentValidationErrors[detail.id]?.noWorkReason}
                                  helperText={equipmentValidationErrors[detail.id]?.noWorkReason}
                                  fullWidth
                                />
                                </SMSGrid>
                              )}
                              <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSCheckbox
                                  label={CF.IS_UNPAID_BREAK_TIME}
                                  checked={detail.isUnPaidBreakTime}
                                  onChange={(checked) =>
                                    updateEquipmentDetail(detail.id, 'isUnPaidBreakTime', checked)
                                  }
                                />
                              </SMSGrid>
                              {detail.isUnPaidBreakTime && (
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTimePicker
                                  label={CF.BREAK_TIME}
                                  value={detail.breakTime}
                                  onChange={(v) => {
                                    updateEquipmentDetail(detail.id, 'breakTime', v);
                                    setEquipmentValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: { ...(prev[detail.id] || {}), breakTime: '' },
                                    }));
                                  }}
                                  name={`breakTime_${detail.id}`}
                                  required
                                  error={equipmentValidationErrors[detail.id]?.breakTime}
                                />
                                </SMSGrid>
                              )}
                              <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTextField
                                  label={CF.USED_EQUIPMENT_QUANTITY}
                                  type="number"
                                  value={incomingEquipmentQuantity(equipment) || detail.usedEquipmentQuantity}
                                  name={`usedEquipmentQuantity_${detail.id}`}
                                  inputProps={{ min: 0, readOnly: true }}
                                  disabled
                                  fullWidth
                                />
                              </SMSGrid>
                            </SMSGrid>
                          </SMSBox>
                          </SMSStack>
                        </SMSCard>
                      );
                    })}
                  </SMSStack>
                ) : (
                  <SMSTypography variant="body2" color="text.secondary">
                    No equipment assigned to this request.
                  </SMSTypography>
                )}
          </CloseFormCard>
        </SMSBox>
      )}

      {currentStep?.kind === 'questionnaire-loading' && (
        <QuestionnaireLoadingStep
          onBack={handleBack}
          onCancel={onCancel ?? (() => {})}
          nextLabel={CF.NEXT}
          backLabel={CF.BACK}
          cancelLabel={CF.CANCEL}
          title={CF.QUESTIONNAIRES_TITLE}
          loadingMessage={CF.LOADING_QUESTIONNAIRES}
        />
      )}

      {currentStep?.kind === 'questionnaire' && (
        <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CloseFormCard
            title={currentStep.title}
            footer={
              <>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={handleBack} disabled={isSubmitting}>
                  {CF.BACK}
                </SMSButton>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={onCancel} disabled={isSubmitting}>
                  {CF.CANCEL}
                </SMSButton>
                <SMSButton
                  {...suspendedBypassProps}
                  type="submit"
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isLastStep ? CF.SUBMIT : CF.NEXT}
                </SMSButton>
              </>
            }
          >
              {questionnaireLoading ? (
                <SMSBox sx={{ display: 'flex', justifyContent: 'center' }}>
                  <SMSLoader loadingText="Loading questionnaire..." aria-label="Loading questionnaire..." />
                </SMSBox>
              ) : (
                <SMSStack spacing={3}>
                    {currentStep.formData.questions.map((question, index) => {
                      const value =
                        questionnaireResponses[currentStep.questionnaireId]?.[question.id];
                      return (
                        <SMSStack key={question.id} spacing={1.5}>
                          <SMSTypography variant="subtitle2" component="div" fontWeight={600}>
                            {index + 1}. {question.text || 'Question'}
                            {question.required && (
                              <SMSTypography component="span" color="error.main" fontWeight={600}>
                                {' '}
                                *
                              </SMSTypography>
                            )}
                          </SMSTypography>

                          {question.type === QuestionTypeEnum.ShortAnswer && (
                            <SMSTextField
                              value={typeof value === 'string' ? value : ''}
                              onChange={(e) => {
                                if (disableQuestionnaire) return;
                                setQuestionnaireResponse(
                                  currentStep.questionnaireId,
                                  question.id,
                                  e.target.value
                                );
                                setQuestionnaireValidationErrors((prev) => ({ ...prev, [question.id]: '' }));
                              }}
                              placeholder={ACTIVITY_FORM.PREVIEW.SHORT_ANSWER_PLACEHOLDER}
                              error={!!questionnaireValidationErrors[question.id]}
                              helperText={questionnaireValidationErrors[question.id] || undefined}
                              disabled={disableQuestionnaire}
                              fullWidth
                              size="small"
                            />
                          )}

                          {question.type === QuestionTypeEnum.Paragraph && (
                            <SMSTextField
                              multiline
                              minRows={3}
                              value={typeof value === 'string' ? value : ''}
                              onChange={(e) => {
                                if (disableQuestionnaire) return;
                                setQuestionnaireResponse(
                                  currentStep.questionnaireId,
                                  question.id,
                                  e.target.value
                                );
                                setQuestionnaireValidationErrors((prev) => ({ ...prev, [question.id]: '' }));
                              }}
                              placeholder={ACTIVITY_FORM.PREVIEW.PARAGRAPH_PLACEHOLDER}
                              error={!!questionnaireValidationErrors[question.id]}
                              helperText={questionnaireValidationErrors[question.id] || undefined}
                              disabled={disableQuestionnaire}
                              fullWidth
                              size="small"
                            />
                          )}

                          {question.type === QuestionTypeEnum.Radio && (
                            <SMSStack spacing={0.5} role="radiogroup" aria-label={question.text || 'Question'}>
                                {(question.options ?? []).map((opt) => (
                                  <SMSRadio
                                    key={opt.id}
                                    name={`q-${currentStep.questionnaireId}-${question.id}`}
                                    value={opt.id}
                                    checked={value === opt.id}
                                    label={opt.text || 'Option'}
                                    disabled={disableQuestionnaire}
                                    onChange={() => {
                                      if (disableQuestionnaire) return;
                                      setQuestionnaireResponse(
                                        currentStep.questionnaireId,
                                        question.id,
                                        opt.id
                                      );
                                      setQuestionnaireValidationErrors((prev) => ({ ...prev, [question.id]: '' }));
                                    }}
                                  />
                                ))}
                              {questionnaireValidationErrors[question.id] && (
                                <SMSTypography
                                  variant="caption"
                                  color="error"
                                  component="p"
                                  sx={{ m: 0, mt: 0.5, mx: 0 }}
                                >
                                  {questionnaireValidationErrors[question.id]}
                                </SMSTypography>
                              )}
                            </SMSStack>
                          )}

                          {question.type === QuestionTypeEnum.MultiChoice && (
                            <SMSStack spacing={0.5} role="group" aria-label={question.text || 'Question'}>
                                {(question.options ?? []).map((opt) => {
                                  const selected = Array.isArray(value) ? value.includes(opt.id) : false;
                                  return (
                                    <SMSCheckbox
                                      key={opt.id}
                                      label={opt.text || 'Option'}
                                      checked={selected}
                                      disabled={disableQuestionnaire}
                                      onChange={(checked) => {
                                        if (disableQuestionnaire) return;
                                        const arr = Array.isArray(value) ? [...value] : [];
                                        if (checked) {
                                          setQuestionnaireResponse(
                                            currentStep.questionnaireId,
                                            question.id,
                                            [...arr, opt.id]
                                          );
                                        } else {
                                          setQuestionnaireResponse(
                                            currentStep.questionnaireId,
                                            question.id,
                                            arr.filter((id) => id !== opt.id)
                                          );
                                        }
                                        setQuestionnaireValidationErrors((prev) => ({ ...prev, [question.id]: '' }));
                                      }}
                                    />
                                  );
                                })}
                              {questionnaireValidationErrors[question.id] && (
                                <SMSTypography
                                  variant="caption"
                                  color="error"
                                  component="p"
                                  sx={{ m: 0, mt: 0.5, mx: 0 }}
                                >
                                  {questionnaireValidationErrors[question.id]}
                                </SMSTypography>
                              )}
                            </SMSStack>
                          )}
                        </SMSStack>
                      );
                    })}
                </SMSStack>
              )}
          </CloseFormCard>
        </SMSBox>
      )}

      {currentStep?.kind === 'vehicles' && (
        <SMSBox component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CloseFormCard
            title={CF.VEHICLES_SECTION_TITLE}
            footer={
              <>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={handleBack} disabled={isSubmitting}>
                  {CF.BACK}
                </SMSButton>
                <SMSButton {...suspendedBypassProps} type="button"  onClick={onCancel} disabled={isSubmitting}>
                  {CF.CANCEL}
                </SMSButton>
                {isLastStep && !isSplitMode ? (
                  <SMSButton
                    {...suspendedBypassProps}
                    type="submit"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    {CF.SUBMIT}
                  </SMSButton>
                ) : (
                  <SMSButton
                    {...suspendedBypassProps}
                    type="submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    {CF.NEXT}
                  </SMSButton>
                )}
              </>
            }
          >
              {(isClosedDetailsMode
                ? requestVehicles.length > 0
                : requestVehicles.length > 0) ? (
                <SMSStack spacing={2}>
                  {requestVehicles.map((vehicle) => {
                    const deptVehicle = closeFormCatalogFromPostLine(vehicle, CF.UNKNOWN_VEHICLE);
                    const detail = vehicleDetails.find(
                      (item) => item.departmentEquipment === vehicle.departmentEquipmentID
                    );
                    if (!detail) return null;
                    const perItemCharge = isPerItemChargeLine(vehicle);
                    const chargesMileage = vehicle.chargeMileage === true;
                    const vehicleUsedHoursFromStep1 =
                      formatTimeToHHmm(data.hoursWorked) ?? detail.equipmentUsedHours ?? '';
                    const vehicleUsageField = perItemCharge ? (
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTextField
                          label={CF.USED_VEHICLE_QUANTITY}
                          type="number"
                          value={incomingEquipmentQuantity(vehicle) || detail.usedEquipmentQuantity}
                          name={`usedEquipmentQuantity_${detail.id}`}
                          inputProps={{ min: 0, readOnly: true }}
                          disabled
                          fullWidth
                        />
                      </SMSGrid>
                    ) : (
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTimePicker
                          label={CF.VEHICLE_USED_HOURS}
                          value={vehicleUsedHoursFromStep1}
                          disabled
                          required={false}
                          name={`equipmentUsedHours_${detail.id}`}
                          fullWidth
                        />
                      </SMSGrid>
                    );
                    return (
                      <SMSCard key={vehicle.postEquipmentID} variant="outlined" sx={{ p: 2 }}>
                        <SMSStack spacing={2}>
                        <SMSStack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" spacing={1}>
                          <SMSTypography variant="subtitle1" fontWeight={700}>
                            {deptVehicle?.equipmentType || CF.UNKNOWN_VEHICLE}
                          </SMSTypography>
                          <SMSTypography variant="body2" color="text.secondary">
                          Quantity: {vehicle.equipmentQuantity}
                          </SMSTypography>
                        </SMSStack>
                        <SMSGrid container spacing={1}>
                          <SMSGrid item xs={12} sm={6} md={4}>
                            <SMSDataDisplay variant="inline" label="Charge" value={formatCurrency(deptVehicle?.charge)} labelFontWeight={600} />
                          </SMSGrid>
                          <SMSGrid item xs={12} sm={6} md={4}>
                            <SMSDataDisplay variant="inline" label="Mileage Charge" value={formatMileageCharge(deptVehicle?.mileageCharge, '-')} labelFontWeight={600} />
                          </SMSGrid>
                          <SMSGrid item xs={12} sm={6} md={4}>
                            <SMSDataDisplay variant="inline" label="Charge Mileage" value={formatBool(deptVehicle?.chargeMileage)} labelFontWeight={600} />
                          </SMSGrid>
                          <SMSGrid item xs={12} sm={6} md={4}>
                            <SMSDataDisplay variant="inline" label="Requires Approval" value={formatBool(deptVehicle?.requiresApproval)} labelFontWeight={600} />
                          </SMSGrid>
                          {deptVehicle?.requiresUtilizationRecorded && (
                            <SMSGrid item xs={12} sm={6} md={4}>
                              <SMSDataDisplay variant="inline" label="Utilization Recorded" value={formatBool(deptVehicle?.requiresUtilizationRecorded)} labelFontWeight={600} />
                            </SMSGrid>
                          )}
                          <SMSGrid item xs={12} sm={6} md={4}>
                            <SMSDataDisplay variant="inline" label="Status" value={formatBool(deptVehicle?.equipmentStatus)} labelFontWeight={600} />
                          </SMSGrid>
                        </SMSGrid>
                        <SMSBox sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                          {chargesMileage ? (
                          <SMSGrid container spacing={2}>
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSDropdown
                                  label={CF.VEHICLE_OWNED_BY}
                                  options={vehicleOwnedByOptions}
                                  value={detail.vehicleOwnedBy}
                                  onChange={(e) => {
                                    updateVehicleDetail(detail.id, 'vehicleOwnedBy', String(e.target.value));
                                    setVehicleValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: { ...(prev[detail.id] || {}), vehicleOwnedBy: '' },
                                    }));
                                  }}
                                  placeholder={`Select (${CF.VEHICLE_OWNED_BY_OPTION_CITY}/${CF.VEHICLE_OWNED_BY_OPTION_EMPLOYEE}/${CF.VEHICLE_OWNED_BY_OPTION_OTHER})`}
                                  name={`vehicleOwnedBy_${detail.id}`}
                                  id={`vehicleOwnedBy_${detail.id}`}
                                  required
                                  error={!!vehicleValidationErrors[detail.id]?.vehicleOwnedBy}
                                  helperText={vehicleValidationErrors[detail.id]?.vehicleOwnedBy}
                                />
                                </SMSGrid>
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTextField
                                  label={CF.VEH_NUMBER}
                                  value={detail.vehNumber}
                                  onChange={(e) => {
                                    updateVehicleDetail(detail.id, 'vehNumber', e.target.value);
                                    setVehicleValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: { ...(prev[detail.id] || {}), vehNumber: '' },
                                    }));
                                  }}
                                  name={`vehNumber_${detail.id}`}
                                  required
                                  error={!!vehicleValidationErrors[detail.id]?.vehNumber}
                                  helperText={vehicleValidationErrors[detail.id]?.vehNumber}
                                  fullWidth
                                />
                                </SMSGrid>
                                {vehicleUsageField}
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTextField
                                  label={CF.START_MILEAGE}
                                  type="text"
                                  inputMode="decimal"
                                  value={detail.startMileage}
                                  onChange={(e) => {
                                    const nextValue = sanitizeMileageInput(e.target.value);
                                    if (isNegativeNumberInput(nextValue)) return;
                                    updateVehicleDetail(detail.id, 'startMileage', nextValue);
                                    const startNum = parseFloat(nextValue);
                                    const endNum = parseFloat(detail.endMileage);
                                    const endError =
                                      detail.endMileage.trim() !== '' &&
                                      !Number.isNaN(startNum) &&
                                      !Number.isNaN(endNum) &&
                                      endNum <= startNum
                                        ? CF.END_MILEAGE_MUST_BE_HIGHER
                                        : '';
                                    setVehicleValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: {
                                        ...(prev[detail.id] || {}),
                                        startMileage: '',
                                        endMileage: endError,
                                      },
                                    }));
                                  }}
                                  onBlur={() => {
                                    const formatted = formatMileageTwoDecimals(detail.startMileage);
                                    if (formatted === detail.startMileage) return;
                                    updateVehicleDetail(detail.id, 'startMileage', formatted);
                                  }}
                                  name={`startMileage_${detail.id}`}
                                  inputProps={{ min: 0, step: 0.01 }}
                                  required
                                  error={!!vehicleValidationErrors[detail.id]?.startMileage}
                                  helperText={vehicleValidationErrors[detail.id]?.startMileage}
                                  fullWidth
                                />
                                </SMSGrid>
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTextField
                                  label={CF.END_MILEAGE}
                                  type="text"
                                  inputMode="decimal"
                                  value={detail.endMileage}
                                  onChange={(e) => {
                                    const nextValue = sanitizeMileageInput(e.target.value);
                                    if (isNegativeNumberInput(nextValue)) return;
                                    updateVehicleDetail(detail.id, 'endMileage', nextValue);
                                    const startNum = parseFloat(detail.startMileage);
                                    const nextNum = parseFloat(nextValue);
                                    const endError =
                                      detail.startMileage.trim() !== '' &&
                                      !Number.isNaN(startNum) &&
                                      !Number.isNaN(nextNum) &&
                                      nextNum <= startNum
                                        ? CF.END_MILEAGE_MUST_BE_HIGHER
                                        : '';
                                    setVehicleValidationErrors((prev) => ({
                                      ...prev,
                                      [detail.id]: {
                                        ...(prev[detail.id] || {}),
                                        endMileage: endError,
                                      },
                                    }));
                                  }}
                                  onBlur={() => {
                                    const formatted = formatMileageTwoDecimals(detail.endMileage);
                                    if (formatted === detail.endMileage) return;
                                    updateVehicleDetail(detail.id, 'endMileage', formatted);
                                  }}
                                  name={`endMileage_${detail.id}`}
                                  inputProps={{
                                    min: (() => {
                                      const m = parseFloat(detail.startMileage);
                                      return Number.isNaN(m) ? 0 : m;
                                    })(),
                                    step: 0.01,
                                  }}
                                  required
                                  error={!!vehicleValidationErrors[detail.id]?.endMileage}
                                  helperText={vehicleValidationErrors[detail.id]?.endMileage}
                                  fullWidth
                                />
                                </SMSGrid>
                                <SMSGrid item xs={12} sm={6} md={4}>
                                <SMSTextField
                                  label={CF.TOTAL_MILEAGE}
                                  type="text"
                                  inputMode="decimal"
                                  value={getTotalMileageDisplay(detail)}
                                  disabled
                                  name={`totalMileage_${detail.id}`}
                                  fullWidth
                                />
                                </SMSGrid>
                            </SMSGrid>
                          ) : (
                            <SMSGrid container spacing={2}>
                              {vehicleUsageField}
                            </SMSGrid>
                          )}
                          </SMSBox>
                        </SMSStack>
                      </SMSCard>
                    );
                  })}
                </SMSStack>
              ) : (
                <SMSTypography variant="body2" color="text.secondary">
                  {CF.NO_VEHICLES_MESSAGE}
                </SMSTypography>
              )}
          </CloseFormCard>
        </SMSBox>
      )}
      </SMSForm>
    </SMSBox>
  );
};
