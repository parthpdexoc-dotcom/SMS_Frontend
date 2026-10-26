import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  SMSBox,
  SMSButton,
  SMSCheckbox,
  SMSDatePicker,
  SMSDropdown,
  SMSGrid,
  SMSLoader,
  SMSMultiSelectDropdown,
  SMSSegmentedStatusFilter,
  SMSCurrencyInput,
  SMSLabel,
  SMSStack,
  SMSTextField,
  SMSTimePicker,
  SMSTypography,
} from '@/components/smsatoms';

import { DAILY_ADMINISTRATION, REQUEST, FIELD_NAMES, REQUEST_EQUIPMENT_LIST, REQUEST_FORM, DEPARTMENT_FEE } from '@/constants/strings';
import { REQUEST_SCHEDULE_PAGE_SIZE } from '@/constants/tablePagination';
import {
  toEquipmentDatePickerBound,
  isEquipmentEffectiveRangeWithinRequestPeriod,
  applyRequestPeriodToAllEquipment,
  hasRequestDatesChanged,
  resolveRequestEquipmentDates,
} from '@/utils/equipmentEffectiveDates';
import {
  RequestResponse,
  CreateRequestRequest,
  UpdateRequestRequest,
  RequestStatus,
  ReleaseAs,
  type RequestScheduleDto,
  type RequestOneTimeDateChangeAssignmentDto,
} from '@/types/request';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

import { upsertRequestThunk, clearError, clearConflictMessage, parseRequestOneTimeDateChangeRejection } from '@/store/slices/requestSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchSkillOptions } from '@/store/slices/skillSlice';
import { fetchRequesterOptionsThunk, fetchRequesterByIdThunk } from '@/store/slices/requesterSlice';
import {
  fetchRequesterAuthorizedOptions,
  fetchRequesterAuthorizedById,
} from '@/store/slices/requesterAuthorizedSlice';
import { formatDate, formatDateShort, formatTime, formatPhoneNumber, unformatPhoneNumber, isDeepEqual, validateEmail } from '@/utils';
import { formatTimeToHHmm, formatDateToYYYYMMDD, formatHhMmToApiTimeOnly } from '@/utils/dateTimeUtils';
import { RequestEquipmentList } from '@/components/smsmolecules/RequestEquipmentList/RequestEquipmentList';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { RequestOneTimeDateChangeConflictModal } from '@/components/smsmolecules/RequestOneTimeDateChangeConflictModal';

import { RequestEquipmentDto, normalizeRequestEquipmentRow } from '@/services/requestEquipmentService';
import {
  deleteRequestEquipmentThunk,
  upsertRequestEquipmentThunk,
  fetchRequestEquipmentThunk
} from '@/store/slices/requestEquipmentSlice';
import { fetchLatestRequestNotes, upsertRequestNoteThunk } from '@/store/slices/requestNoteSlice';
import { SMSDataTableWrapper, SMSDataTableActions, SMSContentTabs, type DataTableColumn } from '@/components/smsorganisms';
import {
  fetchRequestSchedulesByRequestIdThunk,
  upsertRequestScheduleThunk,
  deleteRequestScheduleThunk,
  clearRequestScheduleState,
  generateRequestSchedulesThunk,
} from '@/store/slices/requestScheduleSlice';
import { fetchDepartmentResponseAreaOptions } from '@/store/slices/responseAreaSlice';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { getByDepartmentId, isGenerateRequestScheduleEnabled } from '@/services/departmentConfigurationService';
import { getRequestScheduleGenerationByRequestId } from '@/services/requestScheduleService';
import { fetchDepartmentDefinedFieldsByDepartmentId } from '@/store/slices/departmentDefinedFieldsSlice';
import { buildDepartmentDefinedFieldBindings, getEmptyDepartmentDefinedFieldValues } from '@/utils/departmentDefinedFieldDefinitions';
import { getRequestSelectionFees } from '@/services/departmentFeeService';
import { RequestSelectionFeeDto, FeeType, ReimburseTo } from '@/types/departmentFeeType';
import '@/styles/forms.css'; // Common form styles
import './SMSRequestForm.css'; // Specific overrides (checkmarks, calendar)
import { RecurrenceRule, InitialRecurrenceRule, RecurrenceUnit, MonthlyMode } from '@/types/recurrence';

import { mapBackendToRecurrence, mapRecurrenceToBackend, validateRecurrenceRule } from '@/utils/recurrenceUtils';

import { CustomRecurrenceModal } from './Recurrence/CustomRecurrenceModal';
import { RecurrenceOptions } from './Recurrence/RecurrenceOptions';
import {
  SMSRequestScheduleModal,
  emptyRequestScheduleModalDraft,
  shouldDefaultPreserveOnRegenerate,
  readScheduleReleaseHoursFromDto,
  RELEASE_AS_OPTIONS,
  REQUEST_SCHEDULE_STATUS_OPTIONS,
  requiresScheduleReleaseHours,
  scheduleReleaseHoursLabel,
  type RequestScheduleSavePayload,
} from './SMSRequestScheduleModal';
import {
  GenerateRequestScheduleModal,
  type GenerateRequestSchedulePayload,
} from '@/components/smsorganisms/GenerateRequestScheduleModal/GenerateRequestScheduleModal';

import { RequestFormData } from '@/types/requestForm';
import type { RequesterResponse } from '@/types/requester';
import { UserRoleType, hasRole } from '@/types/userRole';
import {
  fetchRequesterManagerOptions,
  fetchRequesterManagerByRequesterAndEmployeeThunk,
} from '@/store/slices/requesterManagerSlice';

export interface RequestFormProps {
  initialData?: RequestResponse | null;
  requesterId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  isCloned?: boolean;
}

interface LocalRequestSchedule extends RequestScheduleDto {
  localId: string;
}

const RECURRENCE_TYPE_OPTIONS = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAY', label: 'Every day' },
  { value: 'WEEK', label: 'Every week' },
  { value: 'MONTH', label: 'Every month' },
  { value: 'CUSTOM', label: 'Custom...' },
];

const requiresProcessFields = (releaseAs: ReleaseAs | null | undefined): boolean =>
  releaseAs === ReleaseAs.TenureBased || releaseAs === ReleaseAs.Preferred;

/**
 * First `YYYY-MM-DD` in the string (or full trim) for string compares — no `Date` parsing;
 * if the value starts with `YYYY-MM-DD` (e.g. ISO from API) we use that prefix as the key.
 */
const leadingYyyyMmDdKey = (value?: string | null): string => {
  const t = value?.trim() ?? '';
  if (!t) return '';
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1]! : t;
};

/** `leadingYyyyMmDdKey` is exactly `YYYY-MM-DD` (compare request/schedule without `Date(ISO string)`). */
const isYyyyMmDdKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Local midnight for a calendar `YYYY-MM-DD` — never `new Date(isoString)` for form picks. */
const localDateFromYyyyMmDd = (ymd: string): Date | null => {
  if (!isYyyyMmDdKey(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseScheduleDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const t = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = parseInt(m[1]!, 10);
    const mo = parseInt(m[2]!, 10) - 1;
    const d = parseInt(m[3]!, 10);
    if (![y, mo, d].some((n) => Number.isNaN(n))) {
      const date = new Date(y, mo, d);
      if (!Number.isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0);
        return date;
      }
    }
  }
  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Calendar day key for comparing request end date to schedule end dates. */
const scheduleEndDateKey = (value?: string | null): string => leadingYyyyMmDdKey(value);

const LOCAL_SCHEDULE_ID_PREFIX = 'local-schedule-';

function mergeRequestScheduleDataSource(
  savedRequestID: string | null,
  requestSchedules: RequestScheduleDto[] | undefined,
  localRequestSchedules: LocalRequestSchedule[],
  pendingScheduleEdits: Record<string, RequestScheduleSavePayload>
): Array<RequestScheduleDto | LocalRequestSchedule> {
  if (!savedRequestID) {
    return localRequestSchedules;
  }
  const edits = pendingScheduleEdits;
  const merged = (requestSchedules || []).map((s) => {
    const id = s.requestScheduleID;
    return id && edits[id] ? ({ ...s, ...edits[id] } as RequestScheduleDto) : s;
  });
  return [...merged, ...localRequestSchedules];
}

/** Single pass: latest schedule end + whether any row ends on the same calendar day as the request. */
function computeScheduleAggregates(
  rows: Array<RequestScheduleDto | LocalRequestSchedule>,
  requestEndDate: string
): {
  latestScheduleEndDate: Date | null;
  latestScheduleEndYmdKey: string | null;
  hasScheduleMatchingRequestEndDate: boolean;
} {
  const reqKey = scheduleEndDateKey(requestEndDate);
  let latestYmd: string | null = null;
  let hasMatchingEnd = false;
  for (const s of rows) {
    const end = s.endDate;
    if (end) {
      const ymd = leadingYyyyMmDdKey(end);
      if (isYyyyMmDdKey(ymd) && (!latestYmd || ymd > latestYmd)) {
        latestYmd = ymd;
      }
    }
    if (reqKey && scheduleEndDateKey(end) === reqKey) {
      hasMatchingEnd = true;
    }
  }
  return {
    latestScheduleEndDate: latestYmd ? localDateFromYyyyMmDd(latestYmd) : null,
    latestScheduleEndYmdKey: latestYmd,
    hasScheduleMatchingRequestEndDate: Boolean(reqKey && hasMatchingEnd),
  };
}

function getRequestScheduleRowId(s: RequestScheduleDto | LocalRequestSchedule): string {
  if ('localId' in s && s.localId) return String(s.localId);
  if (typeof s.requestScheduleID === 'string' && s.requestScheduleID) return s.requestScheduleID;
  return '';
}

/** Normalize any schedule date string to YYYY-MM-DD for comparisons. */
function scheduleRangeKey(value?: string | null): string {
  return leadingYyyyMmDdKey(value);
}

/** Past / spans today / not yet started — from schedule start–end vs local calendar "today". */
type ScheduleTimeBand = 'old' | 'ongoing' | 'future';

function classifyScheduleTimeBand(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
  todayYmd: string
): ScheduleTimeBand | null {
  const s = scheduleRangeKey(startStr);
  const e = scheduleRangeKey(endStr);
  if (!isYyyyMmDdKey(s) || !isYyyyMmDdKey(e)) return null;
  if (e < todayYmd) return 'old';
  if (s > todayYmd) return 'future';
  return 'ongoing';
}

/** Schedule period overlaps the request window [requestStart, requestEnd] (inclusive YYYY-MM-DD keys). */
/**
 * Does-not-repeat: when the request start date is moved forward past a schedule's start date,
 * that schedule must be updated before save. Earlier request dates do not require this check.
 */
function findScheduleRowIdsStaleAfterRequestStart(
  requestStartStr: string | undefined | null,
  activeRows: Array<{ requestScheduleID: string; raw?: { startDate?: string | null } }>
): Set<string> {
  const stale = new Set<string>();
  const requestStartKey = leadingYyyyMmDdKey(requestStartStr);
  if (!isYyyyMmDdKey(requestStartKey)) return stale;

  for (const row of activeRows) {
    const scheduleStartKey = scheduleRangeKey(row.raw?.startDate);
    if (isYyyyMmDdKey(scheduleStartKey) && requestStartKey > scheduleStartKey) {
      stale.add(row.requestScheduleID);
    }
  }
  return stale;
}

/** Latest end for a start: the day before the same date three months later (a 3-month window). */
function scheduleFilterMaxEnd(startYmd: string): string {
  const start = localDateFromYyyyMmDd(startYmd);
  if (!start) return startYmd;
  const limit = new Date(start.getFullYear(), start.getMonth() + 3, start.getDate());
  limit.setDate(limit.getDate() - 1);
  return formatDateToYYYYMMDD(limit);
}

/** Earliest start for an end: the day after the same date three months earlier. */
function scheduleFilterMinStart(endYmd: string): string {
  const end = localDateFromYyyyMmDd(endYmd);
  if (!end) return endYmd;
  const limit = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
  limit.setDate(limit.getDate() + 1);
  return formatDateToYYYYMMDD(limit);
}

/** This month's 1st through the last day of next month. */
function defaultScheduleFilterRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  return { start: formatDateToYYYYMMDD(start), end: formatDateToYYYYMMDD(end) };
}

/** Keeps end on or after start, and the selected span inside a 3-month window. */
function clampScheduleFilterRange(
  start: string,
  end: string,
  edited: 'start' | 'end'
): { start: string; end: string } {
  if (!isYyyyMmDdKey(start) || !isYyyyMmDdKey(end)) return { start, end };
  let nextStart = start;
  let nextEnd = end;
  if (nextEnd < nextStart) {
    if (edited === 'start') nextEnd = nextStart;
    else nextStart = nextEnd;
  }
  if (nextEnd > scheduleFilterMaxEnd(nextStart)) {
    if (edited === 'start') nextEnd = scheduleFilterMaxEnd(nextStart);
    else nextStart = scheduleFilterMinStart(nextEnd);
  }
  return { start: nextStart, end: nextEnd };
}

function scheduleOverlapsExtendedRequestWindow(
  scheduleStart: string | null | undefined,
  scheduleEnd: string | null | undefined,
  requestStartStr: string,
  requestEndStr: string
): boolean {
  const s = scheduleRangeKey(scheduleStart);
  const e = scheduleRangeKey(scheduleEnd);
  const rs = scheduleRangeKey(requestStartStr);
  const re = scheduleRangeKey(requestEndStr);
  if (!s || !e || !rs || !re) return false;
  return s <= re && e >= rs;
}

function isSavedScheduleInactive(
  s: RequestScheduleDto | LocalRequestSchedule,
  requestStartStr: string,
  requestEndStr: string,
  todayDate: Date
): boolean {
  const endDateValue = parseScheduleDate(s.endDate);
  const calendarEnded = endDateValue ? endDateValue.getTime() < todayDate.getTime() : false;
  const isLocalDraft = 'localId' in s;
  const inRequestScheduleWindow = scheduleOverlapsExtendedRequestWindow(
    s.startDate,
    s.endDate,
    requestStartStr,
    requestEndStr
  );
  return calendarEnded && !isLocalDraft && !inRequestScheduleWindow;
}

function addDaysToCalendarDate(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function mergeScheduleIntervalsForGaps(
  rows: Array<{ startDate?: string | null; endDate?: string | null }>
): { start: Date; end: Date }[] {
  const intervals = rows
    .map((s) => {
      const sk = scheduleRangeKey(s.startDate);
      const ek = scheduleRangeKey(s.endDate);
      if (!sk || !ek) return null;
      const start = new Date(sk);
      const end = new Date(ek);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (start.getTime() > end.getTime()) return null;
      return { start, end };
    })
    .filter((x): x is { start: Date; end: Date } => x != null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date }[] = [];
  for (const iv of intervals) {
    if (!merged.length) {
      merged.push({ start: new Date(iv.start), end: new Date(iv.end) });
      continue;
    }
    const last = merged[merged.length - 1]!;
    const dayAfterLast = addDaysToCalendarDate(last.end, 1);
    if (iv.start.getTime() > dayAfterLast.getTime()) {
      merged.push({ start: new Date(iv.start), end: new Date(iv.end) });
    } else if (iv.end.getTime() > last.end.getTime()) {
      last.end = new Date(iv.end);
    }
  }
  return merged;
}

function clipIntervalToWindow(
  iv: { start: Date; end: Date },
  winStart: Date,
  winEnd: Date
): { start: Date; end: Date } | null {
  const s = new Date(Math.max(iv.start.getTime(), winStart.getTime()));
  const e = new Date(Math.min(iv.end.getTime(), winEnd.getTime()));
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  if (s.getTime() > e.getTime()) return null;
  return { start: s, end: e };
}

/**
 * First free day when adding a schedule, searching [requestStart, requestEnd].
 */
function findFirstScheduleGapDefault(
  requestStartStr: string,
  requestEndStr: string,
  schedules: Array<{ startDate?: string | null; endDate?: string | null }>
): { start: string; end: string } {
  const rs = scheduleRangeKey(requestStartStr);
  const re = scheduleRangeKey(requestEndStr);
  if (!rs || !re) {
    return { start: requestStartStr?.trim() || '', end: requestEndStr?.trim() || '' };
  }

  const rsDate = new Date(rs);
  const reDate = new Date(re);
  rsDate.setHours(0, 0, 0, 0);
  reDate.setHours(0, 0, 0, 0);

  const windowStart = new Date(rsDate);

  const merged = mergeScheduleIntervalsForGaps(schedules);
  if (merged.length === 0) {
    return { start: rs, end: rs };
  }

  const clipped = merged
    .map((iv) => clipIntervalToWindow(iv, windowStart, reDate))
    .filter((x): x is { start: Date; end: Date } => x != null);

  const mergedInWindow = mergeScheduleIntervalsForGaps(
    clipped.map((c) => ({
      startDate: formatDateToYYYYMMDD(c.start),
      endDate: formatDateToYYYYMMDD(c.end),
    }))
  );

  let cursor = new Date(windowStart);
  for (const iv of mergedInWindow) {
    const ivStart = new Date(iv.start);
    const ivEnd = new Date(iv.end);
    ivStart.setHours(0, 0, 0, 0);
    ivEnd.setHours(0, 0, 0, 0);

    if (cursor.getTime() < ivStart.getTime()) {
      const gapEnd = addDaysToCalendarDate(ivStart, -1);
      gapEnd.setHours(0, 0, 0, 0);
      if (gapEnd.getTime() >= cursor.getTime()) {
        return { start: formatDateToYYYYMMDD(cursor), end: formatDateToYYYYMMDD(cursor) };
      }
    }
    const next = addDaysToCalendarDate(ivEnd, 1);
    next.setHours(0, 0, 0, 0);
    if (next.getTime() > cursor.getTime()) cursor = next;
  }

  if (cursor.getTime() <= reDate.getTime()) {
    return { start: formatDateToYYYYMMDD(cursor), end: formatDateToYYYYMMDD(cursor) };
  }

  if (mergedInWindow.length > 0) {
    const last = mergedInWindow[mergedInWindow.length - 1]!;
    const afterLast = addDaysToCalendarDate(last.end, 1);
    afterLast.setHours(0, 0, 0, 0);
    if (afterLast.getTime() <= reDate.getTime()) {
      return { start: formatDateToYYYYMMDD(afterLast), end: formatDateToYYYYMMDD(afterLast) };
    }
  }
  return { start: rs, end: rs };
}

function removePendingScheduleEdit(
  prev: Record<string, RequestScheduleSavePayload>,
  serverId: string
): Record<string, RequestScheduleSavePayload> {
  if (!prev[serverId]) {
    return prev;
  }
  const next = { ...prev };
  delete next[serverId];
  return next;
}

type MainRecurrenceType = 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

interface RequestFormErrors {
  firstName?: string;
  lastName?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  location?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  requestType?: string;
  requesterID?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  scheduleDate?: string;
  scheduledTime?: string;
  skillIDs?: string;
  routingGroupIDs?: string;
  permitNumber?: string;
  liquorLicenseNumber?: string;
  specialRate?: string;
  vehicles?: string;
  equipment?: string;
  selectedDepartmentFeeIds?: string;
  processDate?: string;
  processTime?: string;
  requestSchedules?: string;
  releaseHours?: string;
  [key: string]: string | undefined;
}

const DEFAULT_SPECIAL_RATE = 10;

const resolveSpecialRate = (value?: number | null): number => {
  const numeric = Number(value);
  return value != null && !Number.isNaN(numeric) && numeric > 0 ? numeric : DEFAULT_SPECIAL_RATE;
};

const getDefaultFormData = (): RequestFormData => ({
  requesterID: '',
  requesterManagerID: null,
  requesterAuthorizedID: null,
  enableWaitingList: true,
  firstName: '',
  lastName: '',
  primaryPhone: '',
  cellPhone: '',
  secondaryPhone: '',
  alternateCellPhone: '',
  primaryEmail: '',
  secondaryEmail: '',
  isPostContact: true,
  startDate: '',
  endDate: '',
  title: '',
  location: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  postLocationsAreStationary: false,
  requiresPermit: false,
  isSpecialEvent: false,
  isPremiumPaidEvent: false,
  specialEventApproved: false,
  requiresLiquorLicense: false,
  alcoholPermitRequired: false,
  specialRate: DEFAULT_SPECIAL_RATE,
  requiresVehicle: false,
  requiresVehicleAtEveryPost: false,
  numberOfVehicles: undefined,
  vehicleApproved: false,
  requiresEquipment: false,
  requiresEquipmentAtEachPost: false,
  numberOfEquipment: undefined,
  isSkillRequired: false,
  skillIDs: [],
  departmentDefinedFieldValue1: '',
  departmentDefinedFieldValue2: '',
  departmentDefinedFieldValue3: '',
  departmentDefinedFieldValue4: '',
  departmentDefinedFieldValue5: '',
  departmentDefinedFieldValue6: '',
  departmentDefinedFieldValue7: '',
  departmentDefinedFieldValue8: '',
  departmentDefinedFieldValue9: '',
  departmentDefinedFieldValue10: '',
  requestHasBeenUpdated: false,
  DepartmentResponseAreaId: null,
  // Legacy Recurrence fields removed
  permitNumber: '',
  liquorLicenseNumber: '',
  requestStatus: RequestStatus.Pending,
  releaseAs: ReleaseAs.Open,
  scheduleDate: '',
  scheduledTime: '',
  processDate: '',
  processTime: '',
  notes: '',
  comments: '',
  posts: [],
  enableFees: true,
  selectedDepartmentFeeIds: [],
});

// Request type options based on enum


export const RequestForm: React.FC<RequestFormProps> = ({
  initialData,
  requesterId,
  onSuccess,
  onCancel,
  className = '',
  isCloned = false,
}) => {
  const dispatch = useAppDispatch();
  const isClonedRef = useRef(isCloned);
  const {
    schedules: pagedRequestSchedules,
    totalRecords: scheduleServerTotal,
    isLoading: requestSchedulesLoading,
  } = useAppSelector((state) => state.requestSchedule);
  const [requestSchedules, setRequestSchedules] = useState<RequestScheduleDto[]>([]);
  const [scheduleListVersion, setScheduleListVersion] = useState(0);
  const [formData, setFormData] = useState<RequestFormData>(getDefaultFormData());
  // Single checkbox: show all secondary fields when checked
  const [showSecondaryContactInfo, setShowSecondaryContactInfo] = useState(false);
  const { latestNotes, isLoadingLatest: isLoadingNotes } = useAppSelector((state) => state.requestNote);

  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(InitialRecurrenceRule);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isRequestScheduleModalOpen, setIsRequestScheduleModalOpen] = useState(false);
  const [isGenerateScheduleModalOpen, setIsGenerateScheduleModalOpen] = useState(false);
  const [editingRequestScheduleId, setEditingRequestScheduleId] = useState<string | null>(null);
  const [localRequestSchedules, setLocalRequestSchedules] = useState<LocalRequestSchedule[]>([]);
  /** Staged edits to existing (server) schedule rows; flushed on main request Save/Update. */
  const [pendingScheduleEdits, setPendingScheduleEdits] = useState<Record<string, RequestScheduleSavePayload>>({});
  /** Staged generate-schedule options; flushed via generate API on request Save/Update. */
  const [pendingGeneratePayload, setPendingGeneratePayload] = useState<GenerateRequestSchedulePayload | null>(null);
  const [scheduleModalInitialDraft, setScheduleModalInitialDraft] = useState(emptyRequestScheduleModalDraft);

  // Request Schedule grid pagination
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(REQUEST_SCHEDULE_PAGE_SIZE);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'active' | 'inactive'>('active');
  const [scheduleFilter, setScheduleFilter] = useState(defaultScheduleFilterRange);
  const [schedulePendingDelete, setSchedulePendingDelete] = useState<{ id: string; isLocal: boolean } | null>(null);
  const [outdatedScheduleRowIds, setOutdatedScheduleRowIds] = useState<Set<string>>(() => new Set());
  const localScheduleIdRef = useRef(0);
  // Track the saved request ID (either from initialData or after creating a new one in Step 1)
  const [savedRequestID, setSavedRequestID] = useState<string | null>(initialData?.requestID || null);
  
  // Department fees state — all from single request-selection API call
  const [allSelectionFees, setAllSelectionFees] = useState<RequestSelectionFeeDto[]>([]);
  const [selectedFees, setSelectedFees] = useState<RequestSelectionFeeDto[]>([]);
  const [isLoadingFees, setIsLoadingFees] = useState(false);
  // Guard: only auto-select on the very first load
  const hasInitializedFeesRef = useRef(false);
  
  const schedulesForRows = useMemo(() => {
    if (pagedRequestSchedules.length === 0) return requestSchedules;
    const knownIds = new Set(requestSchedules.map((schedule) => schedule.requestScheduleID));
    const missingPageRows = pagedRequestSchedules.filter(
      (schedule) => schedule.requestScheduleID && !knownIds.has(schedule.requestScheduleID)
    );
    return missingPageRows.length > 0 ? [...requestSchedules, ...missingPageRows] : requestSchedules;
  }, [pagedRequestSchedules, requestSchedules]);

  const { scheduleDataSource, latestScheduleEndYmdKey, hasScheduleMatchingRequestEndDate, hasActiveRequestSchedules } =
    useMemo(() => {
      const rows = mergeRequestScheduleDataSource(
        savedRequestID,
        schedulesForRows,
        localRequestSchedules,
        pendingScheduleEdits
      );
      const isOneTimeRequest = recurrenceRule.repeatUnit === RecurrenceUnit.NONE;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const activeRows = rows.filter(
        (s) => !isSavedScheduleInactive(s, formData.startDate, formData.endDate, todayDate)
      );
      const rowsForAggregates = isOneTimeRequest ? activeRows : rows;
      return {
        scheduleDataSource: rows,
        hasActiveRequestSchedules: activeRows.length > 0,
        ...computeScheduleAggregates(rowsForAggregates, formData.endDate),
      };
    }, [
      savedRequestID,
      schedulesForRows,
      localRequestSchedules,
      pendingScheduleEdits,
      formData.endDate,
      formData.startDate,
      recurrenceRule.repeatUnit,
    ]);

  /** When the request window has already ended, allow schedule filter + add despite a row ending on the request end date. */
  const isRequestEndDateInThePast = useMemo(() => {
    const endKey = scheduleEndDateKey(formData.endDate);
    if (!endKey) return false;
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return endKey < formatDateToYYYYMMDD(t);
  }, [formData.endDate]);

  const hasRequestSchedules =
    recurrenceRule.repeatUnit === RecurrenceUnit.NONE
      ? hasActiveRequestSchedules
      : scheduleDataSource.length > 0;

  // Today's date for minDate constraints
  const today = useMemo(() => new Date(), []);

  /** Calendar cutoff: dates before this day are disabled (one calendar month before today, local). */
  const mainFormStartMinDate = useMemo(() => {
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    t.setMonth(t.getMonth() - 1);
    return formatDateToYYYYMMDD(t);
  }, [today]);

  const disableStartDateBeforeOneMonth = useCallback(
    (day: Date) => formatDateToYYYYMMDD(day) < mainFormStartMinDate,
    [mainFormStartMinDate]
  );

  /**
   * Main End Date picker: with schedules, disallow dates before today, before start, and before the
   * latest schedule end (request end cannot move earlier than existing schedule coverage).
   * With no schedules, only enforce end >= start so past calendar dates remain selectable.
   */
  const mainFormEndMinDate = useMemo(() => {
    if (!hasRequestSchedules) {
      if (!formData.startDate?.trim()) return undefined;
      const s = parseScheduleDate(formData.startDate);
      return s ? s : undefined;
    }
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    let minMs = t.getTime();
    if (formData.startDate?.trim()) {
      const s = parseScheduleDate(formData.startDate);
      if (s && s.getTime() > minMs) {
        minMs = s.getTime();
      }
    }
    if (latestScheduleEndYmdKey) {
      const le = localDateFromYyyyMmDd(latestScheduleEndYmdKey);
      if (le && le.getTime() > minMs) {
        minMs = le.getTime();
      }
    }
    return new Date(minMs);
  }, [today, formData.startDate, hasRequestSchedules, latestScheduleEndYmdKey]);
  
  /** Earliest selectable process date (main form + schedule modal): local calendar start of today, not request start. */
  const minProcessDate = useMemo(() => {
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [today]);

  // Load fees from request-selection API — called once on mount / when enableFees toggles on
  const loadSelectionFees = useCallback(async () => {
    setIsLoadingFees(true);
    try {
      const fees = await getRequestSelectionFees(savedRequestID || undefined);
      setAllSelectionFees(fees);

      if (!hasInitializedFeesRef.current) {
        // Trust isSelected from the API for initial pre-selection (both create and edit)
        const preSelected = fees.filter((f) => f.isSelected);
        setSelectedFees(preSelected);
        setFormData((prev) => ({
          ...prev,
          selectedDepartmentFeeIds: preSelected.map((f) => f.departmentFeeId),
        }));
        if (preSelected.length > 0) {
          setErrors((prev) => ({ ...prev, selectedDepartmentFeeIds: undefined }));
        }
        hasInitializedFeesRef.current = true;
      }
    } catch (error) {
      console.error('Error loading request selection fees:', error);
      setAllSelectionFees([]);
      setSelectedFees([]);
    } finally {
      setIsLoadingFees(false);
    }
  }, [savedRequestID]);

  // Trigger fee load when enableFees is on; clear when off
  useEffect(() => {
    if (formData.enableFees) {
      loadSelectionFees();
    } else {
      hasInitializedFeesRef.current = false;
      setAllSelectionFees([]);
      setSelectedFees([]);
      setFormData((prev) => ({ ...prev, selectedDepartmentFeeIds: [] }));
      setErrors((prev) => ({ ...prev, selectedDepartmentFeeIds: undefined }));
    }
  }, [formData.enableFees, loadSelectionFees]);

  // Handle multi-select fee changes from the dropdown
  const handleFeeSelect = useCallback((feeIds: string[]) => {
    const newSelectedFees = allSelectionFees.filter((f) => feeIds.includes(f.departmentFeeId));
    setSelectedFees(newSelectedFees);
    setFormData((prev) => ({
      ...prev,
      selectedDepartmentFeeIds: feeIds,
    }));
    if (feeIds.length > 0) {
      setErrors((prev) => ({ ...prev, selectedDepartmentFeeIds: undefined }));
    }
  }, [allSelectionFees]);

  // Remove a fee from the grid
  const handleFeeRemove = useCallback((feeId: string) => {
    setSelectedFees((prev) => prev.filter((f) => f.departmentFeeId !== feeId));
    setFormData((prev) => ({
      ...prev,
      selectedDepartmentFeeIds: (prev.selectedDepartmentFeeIds || []).filter((id) => id !== feeId),
    }));
  }, []);

  // Fee type display label
  const getFeeTypeLabel = (feeType: FeeType): string => {
    switch (feeType) {
      case FeeType.PerRequest: return 'Per Request';
      case FeeType.PerPost:    return 'Per Job';
      case FeeType.PerOfficer: return 'Per Officer';
      default:                 return 'Unknown';
    }
  };

  const getReimburseToLabel = (reimburseTo: ReimburseTo): string => {
    const reimburseOption = DEPARTMENT_FEE.ENUMS.REIMBURSE_TO.find(
      (opt) => opt.value === String(reimburseTo)
    );
    return reimburseOption?.label ?? `Option ${reimburseTo}`;
  };

  // All fees as multi-select options (selection shown via checkboxes)
  const departmentFeeOptions = useMemo(() =>
    allSelectionFees.map((fee) => ({
      value: fee.departmentFeeId,
      label: `${fee.title} - ${getFeeTypeLabel(fee.feeType)}`,
    })),
  [allSelectionFees]);
  // Determine the high-level selected type for the UI
  const getSelectedType = (): MainRecurrenceType => {
    if (recurrenceRule.repeatUnit === RecurrenceUnit.NONE) return 'NONE';
    // Removed: if (recurrenceRule.interval > 1) return 'CUSTOM'; 
    if (recurrenceRule.repeatUnit === RecurrenceUnit.DAY) return 'DAY';
    if (recurrenceRule.repeatUnit === RecurrenceUnit.WEEK) return 'WEEK';
    if (recurrenceRule.repeatUnit === RecurrenceUnit.MONTH) return 'MONTH';
    return 'CUSTOM';
  };

  const selectedType = getSelectedType();

  const addScheduleDateDefaults = useMemo(
    () =>
      findFirstScheduleGapDefault(
        formData.startDate || '',
        formData.endDate || '',
        scheduleDataSource
      ),
    [formData.startDate, formData.endDate, scheduleDataSource]
  );

  const addScheduleStartDateDefault = addScheduleDateDefaults.start;
  const addScheduleEndDateDefault = addScheduleDateDefaults.end;

  /** Earliest schedule period start: same calendar day as request start (cannot begin before the request). */
  const addScheduleStartMinDate = useMemo(() => {
    const key = scheduleRangeKey(formData.startDate);
    return key || undefined;
  }, [formData.startDate]);

  const otherScheduleRangesForOverlap = useMemo(() => {
    return scheduleDataSource
      .filter((s) => {
        if (!editingRequestScheduleId) return true;
        return getRequestScheduleRowId(s) !== editingRequestScheduleId;
      })
      .map((s) => {
        const start = scheduleRangeKey(s.startDate);
        const end = scheduleRangeKey(s.endDate);
        return start && end ? { start, end } : null;
      })
      .filter((x): x is { start: string; end: string } => x != null);
  }, [scheduleDataSource, editingRequestScheduleId]);

  const requestScheduleRows = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayYmd = formatDateToYYYYMMDD(todayDate);
    const currentMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const currentMonthEnd = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);

    return scheduleDataSource.map((s: RequestScheduleDto | LocalRequestSchedule) => {
      const releaseStatusLabel =
        REQUEST_SCHEDULE_STATUS_OPTIONS.find((o) => o.value === String(s.requestStatus))?.label ?? '-';
      const releaseAsLabel =
        RELEASE_AS_OPTIONS.find((o) => o.value === String(s.releaseAs))?.label ?? '-';
      const startDateValue = parseScheduleDate(s.startDate);
      const endDateValue = parseScheduleDate(s.endDate);
      /** Inactive = ended on the calendar and not a local draft and outside the request's schedule envelope (so pre-request API rows still show on Active). */
      const isInactive = isSavedScheduleInactive(s, formData.startDate, formData.endDate, todayDate);
      const isCurrentMonth =
        Boolean(startDateValue && endDateValue) &&
        startDateValue!.getTime() <= currentMonthEnd.getTime() &&
        endDateValue!.getTime() >= currentMonthStart.getTime();
      const localId = 'localId' in s ? String(s.localId) : '';
      const rowId: string =
        typeof s.requestScheduleID === 'string' && s.requestScheduleID
          ? s.requestScheduleID
          : localId;

      return {
        id: rowId,
        requestScheduleID: rowId,
        isLocal: 'localId' in s,
        isInactive,
        isCurrentMonth,
        statusLabel: isInactive ? REQUEST.FORM.INACTIVE : REQUEST.FORM.ACTIVE,
        startDate: s.startDate ? formatDateShort(s.startDate) : '-',
        endDate: s.endDate ? formatDateShort(s.endDate) : '-',
        releaseStatus: releaseStatusLabel,
        scheduleDate: s.scheduleDate ? formatDateShort(s.scheduleDate) : '-',
        scheduleTime: s.scheduledTime ? formatTimeToHHmm(s.scheduledTime) : '-',
        releaseAs: releaseAsLabel,
        processDate: s.processDate ? formatDateShort(s.processDate) : '-',
        processTime: s.processTime ? String(s.processTime) : '-',
        releaseHours: requiresScheduleReleaseHours(s.requestStatus, s.releaseAs)
          ? scheduleReleaseHoursLabel(readScheduleReleaseHoursFromDto(s))
          : '-',
        scheduleTimeBand: classifyScheduleTimeBand(s.startDate, s.endDate, todayYmd),
        raw: s,
      };
    });
  }, [scheduleDataSource, formData.startDate, formData.endDate]);

  const handleOpenAddRequestScheduleModal = useCallback(() => {
    const nextReleaseAs = formData.releaseAs ?? ReleaseAs.Open;
    setEditingRequestScheduleId(null);
    setIsGenerateScheduleModalOpen(false);
    setErrors((prev) => ({
      ...prev,
      scheduleDate: undefined,
      scheduledTime: undefined,
    }));
    const addScheduleRequestStatus = formData.requestStatus ?? RequestStatus.Pending;
    setScheduleModalInitialDraft({
      startDate: addScheduleStartDateDefault,
      endDate: addScheduleEndDateDefault,
      isActive: true,
      releaseAs: nextReleaseAs,
      requestStatus: addScheduleRequestStatus,
      scheduleAfter: '',
      scheduleDate: formData.scheduleDate || '',
      scheduledTime: formData.scheduledTime || '',
      processDate: formData.processDate || '',
      processTime: formData.processTime || '',
      releaseHours: null,
      releaseForMode: '',
      preserveOnRegenerate: shouldDefaultPreserveOnRegenerate(addScheduleRequestStatus, nextReleaseAs),
    });
    setErrors((prev) => ({
      ...prev,
      ...(selectedType !== 'NONE' ? { processDate: undefined, processTime: undefined } : {}),
      releaseHours: undefined,
    }));
    setIsRequestScheduleModalOpen(true);
  }, [
    addScheduleStartDateDefault,
    addScheduleEndDateDefault,
    formData.processDate,
    formData.processTime,
    formData.releaseAs,
    formData.requestStatus,
    formData.scheduleDate,
    formData.scheduledTime,
    selectedType,
  ]);

  const handleOpenGenerateRequestScheduleModal = useCallback(() => {
    if (
      recurrenceRule.repeatUnit === RecurrenceUnit.DAY ||
      recurrenceRule.repeatUnit === RecurrenceUnit.NONE
    ) {
      return;
    }
    setEditingRequestScheduleId(null);
    setIsRequestScheduleModalOpen(false);
    setIsGenerateScheduleModalOpen(true);
  }, [recurrenceRule.repeatUnit]);

  const closeRequestScheduleModal = useCallback(() => {
    setIsRequestScheduleModalOpen(false);
    setEditingRequestScheduleId(null);
  }, []);

  const closeGenerateRequestScheduleModal = useCallback(() => {
    setIsGenerateScheduleModalOpen(false);
  }, []);

  const persistRequestSchedule = useCallback(
    (schedulePayload: RequestScheduleSavePayload) => {
      if (editingRequestScheduleId) {
        if (editingRequestScheduleId.startsWith(LOCAL_SCHEDULE_ID_PREFIX)) {
          setLocalRequestSchedules((prev) =>
            prev.map((schedule) => {
              if (schedule.localId !== editingRequestScheduleId) return schedule;
              return {
                ...schedule,
                ...schedulePayload,
              } as LocalRequestSchedule;
            })
          );
        } else if (savedRequestID) {
          setPendingScheduleEdits((prev) => ({ ...prev, [editingRequestScheduleId]: schedulePayload }));
        }
      } else {
        localScheduleIdRef.current += 1;
        setLocalRequestSchedules((prev) => [
          ...prev,
          {
            localId: `${LOCAL_SCHEDULE_ID_PREFIX}${localScheduleIdRef.current}`,
            ...schedulePayload,
          } as LocalRequestSchedule,
        ]);
      }
      closeRequestScheduleModal();
      setOutdatedScheduleRowIds(new Set());
      setErrors((prev) => ({ ...prev, requestSchedules: undefined }));
    },
    [closeRequestScheduleModal, editingRequestScheduleId, savedRequestID]
  );

  const handleGenerateSchedules = useCallback(
    async (payload: GenerateRequestSchedulePayload) => {
      // Stage for flush on request Save/Update (works for create and edit).
      setPendingGeneratePayload(payload);
      setIsGenerateScheduleModalOpen(false);
      setErrors((prev) => ({ ...prev, requestSchedules: undefined }));
      dispatch(
        showToast('Generate schedule is ready. It will run when you save the request.', 'success')
      );
    },
    [dispatch]
  );

  const activeRequestScheduleRows = useMemo(
    () => requestScheduleRows.filter((row) => !row.isInactive),
    [requestScheduleRows]
  );

  const inactiveRequestScheduleRows = useMemo(
    () => requestScheduleRows.filter((row) => row.isInactive),
    [requestScheduleRows]
  );

  const filteredRequestScheduleRows = useMemo(() => {
    const statusRows =
      scheduleStatusFilter === 'active' ? activeRequestScheduleRows : inactiveRequestScheduleRows;
    return statusRows.filter((row) =>
      scheduleOverlapsExtendedRequestWindow(
        row.raw?.startDate,
        row.raw?.endDate,
        scheduleFilter.start,
        scheduleFilter.end
      )
    );
  }, [
    activeRequestScheduleRows,
    inactiveRequestScheduleRows,
    scheduleFilter.end,
    scheduleFilter.start,
    scheduleStatusFilter,
  ]);

  const serverScheduleRows = useMemo(() => {
    const byId = new Map(requestScheduleRows.map((row) => [row.requestScheduleID, row]));
    const pageRows = pagedRequestSchedules.flatMap((schedule) => {
      const row = byId.get(schedule.requestScheduleID ?? '');
      if (!row) return [];
      if (scheduleStatusFilter === 'active' ? row.isInactive : !row.isInactive) return [];
      return [row];
    });
    const localRows =
      schedulePage === 1 ? filteredRequestScheduleRows.filter((row) => row.isLocal) : [];
    return [...pageRows, ...localRows];
  }, [filteredRequestScheduleRows, pagedRequestSchedules, requestScheduleRows, schedulePage, scheduleStatusFilter]);

  type RequestScheduleRow = (typeof requestScheduleRows)[number];

  const getRequestScheduleRowClassName = useCallback((row: RequestScheduleRow) => {
    const classes: string[] = [];
    if (row.scheduleTimeBand) {
      classes.push(`request-form__schedule-row--${row.scheduleTimeBand}`);
    }
    if (outdatedScheduleRowIds.has(row.requestScheduleID)) {
      classes.push('request-form__schedule-row--outdated');
    }
    return classes.length > 0 ? classes.join(' ') : undefined;
  }, [outdatedScheduleRowIds]);

  const renderRequestScheduleCell = (value: React.ReactNode, isInactive = false) => (
    <SMSBox
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        width: '100%',
        opacity: isInactive ? 0.45 : 1,
        color: isInactive ? 'text.disabled' : 'text.primary',
      }}
    >
      {value}
    </SMSBox>
  );

  const requestScheduleColumns: DataTableColumn<RequestScheduleRow>[] = useMemo(
    () => [
      {
        key: 'startDate',
        label: REQUEST.FORM.START_DATE,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'endDate',
        label: REQUEST.FORM.END_DATE,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'releaseStatus',
        label: REQUEST.FORM.RELEASE_STATUS,
        align: 'left',
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'scheduleDate',
        label: REQUEST.FORM.SCHEDULE_DATE,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'scheduleTime',
        label: REQUEST.FORM.SCHEDULE_TIME,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'releaseHours',
        label: REQUEST.FORM.RELEASE_FOR,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'releaseAs',
        label: REQUEST.FORM.RELEASE_AS,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'processDate',
        label: REQUEST.FORM.TENURE_START_DATE,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'processTime',
        label: REQUEST.FORM.TENURE_START_TIME,
        render: (value: unknown, row: RequestScheduleRow) => renderRequestScheduleCell(String(value ?? '-'), row.isInactive),
      },
      {
        key: 'action',
        label: REQUEST.FORM.ACTION,
        render: (_: unknown, row: RequestScheduleRow) =>
          !row.isInactive ? (
            <SMSDataTableActions
              onEdit={() => {
                setEditingRequestScheduleId(row.requestScheduleID || null);
                const r = row.raw;
                const nextReleaseAs = r.releaseAs ?? ReleaseAs.Open;
                setScheduleModalInitialDraft({
                  startDate: r.startDate ?? '',
                  endDate: r.endDate ?? '',
                  isActive: r.isActive !== false,
                  releaseAs: nextReleaseAs,
                  requestStatus: r.requestStatus ?? RequestStatus.Pending,
                  scheduleAfter:
                    (r.requestStatus ?? RequestStatus.Pending) === RequestStatus.ReleasedOn &&
                    Boolean((r.scheduleDate ?? '').trim() || (r.scheduledTime ?? '').trim())
                      ? 'custom'
                      : '',
                  scheduleDate: r.scheduleDate ?? '',
                  scheduledTime: r.scheduledTime ?? '',
                  processDate: r.processDate ?? '',
                  processTime: r.processTime ?? '',
                  releaseHours: requiresScheduleReleaseHours(r.requestStatus, r.releaseAs)
                    ? readScheduleReleaseHoursFromDto(r)
                    : null,
                  releaseForMode: '',
                  preserveOnRegenerate: r.preserveOnRegenerate === true,
                });
                setErrors((prev) => ({
                  ...prev,
                  ...(selectedType !== 'NONE' ? { processDate: undefined, processTime: undefined } : {}),
                  releaseHours: undefined,
                }));
                setIsRequestScheduleModalOpen(true);
              }}
              onDelete={
                row.requestScheduleID
                  ? () => setSchedulePendingDelete({ id: row.requestScheduleID!, isLocal: Boolean(row.isLocal) })
                  : undefined
              }
            />
          ) : null,
      },
    ],
    [selectedType]
  );

  const handleTypeChange = (newType: string) => {
    const type = newType as MainRecurrenceType;
    clearFieldError('requestType');

    if (type === 'CUSTOM') {
      setIsCustomModalOpen(true);
      return;
    }

    const defaults: Partial<RecurrenceRule> = {
      interval: 1,
    };

    if (type === 'NONE') defaults.repeatUnit = RecurrenceUnit.NONE;
    if (type === 'DAY') defaults.repeatUnit = RecurrenceUnit.DAY;
    if (type === 'WEEK') defaults.repeatUnit = RecurrenceUnit.WEEK;
    if (type === 'MONTH') defaults.repeatUnit = RecurrenceUnit.MONTH;

    if (type === 'WEEK') {
      const day = formData.startDate ? new Date(formData.startDate).getDay() : new Date().getDay();
      defaults.weekDays = [day];
    }

    if (type === 'MONTH') {
      defaults.monthlyMode = MonthlyMode.BY_DATE;
      defaults.monthDays = [formData.startDate ? new Date(formData.startDate).getDate() : 1];
    }

    setRecurrenceRule(prev => ({ ...prev, ...defaults }));

    if (type === 'NONE') {
      const start = formData.startDate?.trim();
      if (start) {
        setFormData((prev) => ({ ...prev, endDate: start }));
        setErrors((prev) => ({ ...prev, endDate: undefined }));
      }
    }
    
    // Auto-set process date when "Does not repeat" is selected and releaseAs requires process fields
    // Use the minimum date (max of today and start date) instead of just today
    if (type === 'NONE' && requiresProcessFields(formData.releaseAs)) {
      // Calculate min date on the fly
      const todayDate = new Date();
      const startDate = formData.startDate ? new Date(formData.startDate) : null;
      const minDate = startDate && startDate > todayDate ? startDate : todayDate;
      const minDateStr = formatDateToYYYYMMDD(minDate);
      
      setFormData(prev => {
        // Only update if not set or if current value is before minimum date
        if (!prev.processDate) {
          return { ...prev, processDate: minDateStr };
        }
        // Validate current date is not before minimum
        const currentDate = new Date(prev.processDate);
        if (isNaN(currentDate.getTime()) || currentDate < minDate) {
          return { ...prev, processDate: minDateStr };
        }
        return prev;
      });
    }
  };

  const applyRequesterContactToForm = (requester: RequesterResponse | null) => {
    if (!requester) return;

    const primaryContact = (requester.primaryContact || '').trim();
    let firstName = '';
    let lastName = '';

    if (primaryContact) {
      const parts = primaryContact.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ');
    }

    setFormData((prev) => ({
      ...prev,
      firstName: firstName || prev.firstName,
      lastName: lastName || prev.lastName,
      primaryPhone: requester.phone || '',
      primaryEmail: requester.email || '',
      cellPhone: '',
    }));
  };

  useEffect(() => {
    dispatch(clearError());
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // To track deleted equipment IDs for batch deletion
  const [pendingDeletedRequestEquipmentIds, setPendingDeletedRequestEquipmentIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialData) {
      const resolvedRequesterID =
        initialData.requesterID;
      const resolvedRequesterManagerID =
        initialData.requesterManagerID;

      setFormData((prev) => ({
        requesterID: resolvedRequesterID,
        requesterManagerID: resolvedRequesterManagerID,
        requesterAuthorizedID: initialData.requesterAuthorizedID || null,
        enableWaitingList: initialData.enableWaitingList,
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        primaryPhone: initialData.primaryPhone || '',
        cellPhone: initialData.cellPhone || '',
        secondaryPhone: initialData.secondaryPhone || '',
        alternateCellPhone: initialData.alternateCellPhone || '',
        primaryEmail: initialData.primaryEmail || '',
        secondaryEmail: initialData.secondaryEmail || '',
        isPostContact: initialData.isPostContact,
        startDate: initialData.startDate || '',
        endDate: initialData.endDate || '',
        title: initialData.title || '',
        location: initialData.location || '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        zip: String(initialData.zip ?? '').replace(/\D/g, ''),
        postLocationsAreStationary: initialData.postLocationsAreStationary,
        requiresPermit: initialData.requiresPermit,
        permitNumber: initialData.permitNumber || '',
        isSpecialEvent: initialData.isSpecialEvent,
        isPremiumPaidEvent: initialData.isPremiumPaidEvent ?? false,
        specialEventApproved: initialData.specialEventApproved || false,
        requiresLiquorLicense: initialData.requiresLiquorLicense,
        liquorLicenseNumber: initialData.liquorLicenseNumber || '',
        alcoholPermitRequired: initialData.alcoholPermitRequired ?? false,
        specialRate: resolveSpecialRate(initialData.specialRate),
        requiresVehicle: initialData.requiresVehicle,
        requiresVehicleAtEveryPost: initialData.requiresVehicleAtEveryPost,
        numberOfVehicles: initialData.numberOfVehicles,
        vehicleApproved: initialData.vehicleApproved || false,
        requiresEquipment: initialData.requiresEquipment,
        requiresEquipmentAtEachPost: initialData.requiresEquipmentAtEachPost,
        numberOfEquipment: initialData.numberOfEquipment,
        isSkillRequired: initialData.isSkillRequired,
        skillIDs: initialData.skillIDs || [],
        departmentDefinedFieldValue1: initialData.departmentDefinedFieldValue1 || '',
        departmentDefinedFieldValue2: initialData.departmentDefinedFieldValue2 || '',
        departmentDefinedFieldValue3: initialData.departmentDefinedFieldValue3 || '',
        departmentDefinedFieldValue4: initialData.departmentDefinedFieldValue4 || '',
        departmentDefinedFieldValue5: initialData.departmentDefinedFieldValue5 || '',
        departmentDefinedFieldValue6: initialData.departmentDefinedFieldValue6 || '',
        departmentDefinedFieldValue7: initialData.departmentDefinedFieldValue7 || '',
        departmentDefinedFieldValue8: initialData.departmentDefinedFieldValue8 || '',
        departmentDefinedFieldValue9: initialData.departmentDefinedFieldValue9 || '',
        departmentDefinedFieldValue10: initialData.departmentDefinedFieldValue10 || '',
        requestHasBeenUpdated: initialData.requestHasBeenUpdated,
        DepartmentResponseAreaId: initialData.DepartmentResponseAreaId || initialData.departmentResponseAreaID || null,
        // Legacy recurrence fields removed from form state, handled by recurrenceRule
        requestStatus: initialData.requestSchedule?.requestStatus ?? RequestStatus.Pending,
        releaseAs: initialData.releaseAs ?? initialData.requestSchedule?.releaseAs ?? ReleaseAs.Open,
        scheduleDate: initialData.requestSchedule?.scheduleDate ?? '',
        scheduledTime: formatTimeToHHmm(initialData.requestSchedule?.scheduledTime),
        processDate: initialData.requestSchedule?.processDate ?? '',
        processTime: initialData.requestSchedule?.processTime ?? '',
        posts: initialData.posts || [],
        enableFees: initialData.enableFees ?? true,
        selectedDepartmentFeeIds: initialData.selectedDepartmentFeeIds?.length
          ? initialData.selectedDepartmentFeeIds
          : (prev.selectedDepartmentFeeIds ?? []),
      }));

      hasInitializedFeesRef.current = false;
      if (initialData.enableFees ?? true) {
        void loadSelectionFees();
      }

      if (resolvedRequesterID) {
        dispatch(fetchRequesterByIdThunk(resolvedRequesterID)).catch(() => {
          // Keep form usable even if requester lookup fails.
        });
      }

      // Map existing backend data to recurrence rule
      setRecurrenceRule(mapBackendToRecurrence(initialData));
      // When editing, show secondary contact info checkbox if any of the fields have data
      const hasSecondaryContactInfo = Boolean(
        (initialData.secondaryEmail && initialData.secondaryEmail.trim()) ||
        (initialData.secondaryPhone && initialData.secondaryPhone.trim()) ||
        (initialData.alternateCellPhone && initialData.alternateCellPhone.trim())
      );
      setShowSecondaryContactInfo(hasSecondaryContactInfo);

      const hasAdditionalFieldsData = [
        initialData.departmentDefinedFieldValue1,
        initialData.departmentDefinedFieldValue2,
        initialData.departmentDefinedFieldValue3,
        initialData.departmentDefinedFieldValue4,
        initialData.departmentDefinedFieldValue5,
        initialData.departmentDefinedFieldValue6,
        initialData.departmentDefinedFieldValue7,
        initialData.departmentDefinedFieldValue8,
        initialData.departmentDefinedFieldValue9,
        initialData.departmentDefinedFieldValue10,
      ].some((v) => v && String(v).trim());
      setShowAdditionalFields(!!hasAdditionalFieldsData);

      // Fetch latest notes for the request
      if (initialData.requestID) {
        dispatch(fetchLatestRequestNotes(initialData.requestID));
      }
      // When GET Request response includes requestEquipment, use it so vehicles/equipment show without waiting for separate API
      if (
        initialData.requestEquipment &&
        initialData.requestEquipment.length > 0 &&
        requestEquipmentHydratedForIdRef.current !== initialData.requestID
      ) {
        requestEquipmentHydratedForIdRef.current = initialData.requestID ?? null;
        setFetchedEquipment(initialData.requestEquipment.map(normalizeRequestEquipmentRow));
      }
      if (initialData.requesterID) {
        dispatch(fetchRequesterByIdThunk(initialData.requesterID))
          .unwrap()
          .then((requester) => {
            applyRequesterSkillsToForm(requester);
          })
          .catch(() => {
            setRequesterLockedSkillIDs([]);
          });
      } else {
        setRequesterLockedSkillIDs([]);
      }
    } else {
      const newFormData = {
        ...getDefaultFormData(),
        requesterID: requesterId || '',
      };
      setFormData(newFormData);
      setRecurrenceRule(InitialRecurrenceRule);
      setShowSecondaryContactInfo(false);
      setShowAdditionalFields(false);
      if (requesterId) {
        dispatch(fetchRequesterByIdThunk(requesterId))
          .unwrap()
          .then((requester) => {
            applyRequesterContactToForm(requester);
            applyRequesterSkillsToForm(requester);
          })
          .catch(() => {
            // Ignore failures; user can fill contact info manually
            setRequesterLockedSkillIDs([]);
          });
      } else {
        setRequesterLockedSkillIDs([]);
      }
    }
  }, [initialData, requesterId, dispatch]);
  
  // Auto-set process date to minimum (today) when "Does not repeat" is selected; clamp if process date is before today
  useEffect(() => {
    if (requiresProcessFields(formData.releaseAs)) {
      const minDateStr = formatDateToYYYYMMDD(minProcessDate);
      setFormData(prev => {
        // If "Does not repeat" is selected and no date set, auto-set to minimum
        if (selectedType === 'NONE' && !prev.processDate) {
          return { ...prev, processDate: minDateStr };
        }
        // Always validate current date is not before minimum (handles start date changes)
        if (prev.processDate) {
          const currentDate = new Date(prev.processDate);
          const minDate = minProcessDate;
          if (isNaN(currentDate.getTime()) || currentDate < minDate) {
            return { ...prev, processDate: minDateStr };
          }
        }
        return prev;
      });
    }
  }, [selectedType, formData.releaseAs, minProcessDate]);

  const { requesterOptions: requesterOptionList, selectedRequester } = useAppSelector((state) => state.requester);
  const { requesterAuthorizedOptions: requesterAuthorizedSelectOptions } =
    useAppSelector((state) => state.requesterAuthorized);

  const showRequesterAuthorizedDropdown = useMemo(() => {
    if (!formData.requesterID) return false;
    return selectedRequester != null &&
      String(selectedRequester.requesterID) === String(formData.requesterID) &&
      selectedRequester.isRequesterAuthorized === true;
  }, [formData.requesterID, selectedRequester]);

  const handleRequesterSearchInputChange = useCallback(
    (value: string) => dispatch(fetchRequesterOptionsThunk({ searchTerm: value })).unwrap(),
    [dispatch]
  );

  const requesterOptions = useMemo(() => {
    const options = requesterOptionList.map((req) => ({
      label: req.label || 'Unknown Requester',
      value: req.id,
    }));
    const committedRequesterId = formData.requesterID?.trim();
    if (
      committedRequesterId &&
      selectedRequester?.requesterID &&
      String(selectedRequester.requesterID) === committedRequesterId &&
      !options.some((opt) => String(opt.value) === committedRequesterId)
    ) {
      options.push({
        label: selectedRequester.name || 'Unknown Requester',
        value: selectedRequester.requesterID,
      });
    }
    return options;
  }, [requesterOptionList, selectedRequester, formData.requesterID]);

  // Fetch requester authorized options when requesterID changes
  const prevRequesterIDForAuthorizedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!formData.requesterID) {
      prevRequesterIDForAuthorizedRef.current = null;
      return;
    }
    if (!showRequesterAuthorizedDropdown) return;
    if (prevRequesterIDForAuthorizedRef.current === formData.requesterID) return;

    prevRequesterIDForAuthorizedRef.current = formData.requesterID;

    const selectedId = formData.requesterAuthorizedID
      ? String(formData.requesterAuthorizedID).trim()
      : undefined;

    dispatch(
      fetchRequesterAuthorizedOptions({
        requesterId: formData.requesterID,
        selectedId,
      })
    );
  }, [dispatch, formData.requesterID, showRequesterAuthorizedDropdown]);

  const handleRequesterAuthorizedSearchInputChange = useCallback(
    (value: string) => {
      if (!formData.requesterID) return Promise.resolve();
      const selectedId = formData.requesterAuthorizedID
        ? String(formData.requesterAuthorizedID).trim()
        : undefined;
      return dispatch(
        fetchRequesterAuthorizedOptions({
          searchTerm: value,
          requesterId: formData.requesterID,
          selectedId,
        })
      )
        .unwrap()
        .catch(() => undefined);
    },
    [dispatch, formData.requesterID, formData.requesterAuthorizedID]
  );

  const requesterAuthorizedOptions = useMemo(() => {
    const options = [{ label: 'Select Authorized Requester', value: '' }];
    if (!formData.requesterID) {
      return options;
    }
    const authorizedOptions = (requesterAuthorizedSelectOptions ?? []).map((auth) => ({
      label: auth.label || '-',
      value: auth.id != null ? String(auth.id) : '',
    }));
    return options.concat(authorizedOptions);
  }, [requesterAuthorizedSelectOptions, formData.requesterID]);

  const clearFieldError = (field: keyof RequestFormErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleRequesterAuthorizedChange = (requesterAuthorizedID: string | null) => {
    handleChange(FIELD_NAMES.REQUESTER_AUTHORIZED_ID, requesterAuthorizedID);

    if (requesterAuthorizedID) {
      void dispatch(fetchRequesterAuthorizedById(requesterAuthorizedID))
        .unwrap()
        .then((selectedAuthorized) => {
          setFormData((prev) => ({
            ...prev,
            firstName: selectedAuthorized.firstName || '',
            lastName: selectedAuthorized.lastName || '',
            primaryEmail: selectedAuthorized.primaryEmail || '',
            primaryPhone: selectedAuthorized.primaryPhone || '',
            cellPhone: '',
          }));
        })
        .catch(() => undefined);
    } else {
      if (initialData) {
        setFormData((prev) => ({
          ...prev,
          firstName: initialData.firstName || '',
          lastName: initialData.lastName || '',
          primaryEmail: initialData.primaryEmail || '',
          primaryPhone: initialData.primaryPhone || '',
          cellPhone: initialData.cellPhone || '',
        }));
      } else {
        const defaultData = getDefaultFormData();
        setFormData((prev) => ({
          ...prev,
          firstName: defaultData.firstName,
          lastName: defaultData.lastName,
          primaryEmail: defaultData.primaryEmail,
          primaryPhone: defaultData.primaryPhone,
          cellPhone: defaultData.cellPhone,
        }));
      }
    }
  };

  function applyRequesterSkillsToForm(requester: RequesterResponse | null) {
    if (!requester) {
      setRequesterLockedSkillIDs([]);
      return;
    }

    const requesterSkillIDs = (requester.skillIDs ?? []).map(String);
    const requesterRequiresSkills = requester.isSkillsRequired === true;
    setRequesterLockedSkillIDs(requesterRequiresSkills ? requesterSkillIDs : []);

    if (!requesterRequiresSkills) return;

    setFormData((prev) => ({
      ...prev,
      isSkillRequired: true,
      skillIDs: Array.from(new Set([...(prev.skillIDs ?? []), ...requesterSkillIDs])),
    }));
  }

  const handleRequesterSelect = (selectedId: string) => {
    setFormData(prev => ({ ...prev, requesterID: selectedId, requesterManagerID: null }));
    clearFieldError('requesterID');
    dispatch(fetchRequesterByIdThunk(selectedId))
      .unwrap()
      .then((requester) => {
        applyRequesterContactToForm(requester);
        applyRequesterSkillsToForm(requester);
      })
      .catch(() => {
        // Ignore failures; user can fill contact info manually
        setRequesterLockedSkillIDs([]);
      });
  };

  const handleRequesterChange = (selectedId: string) => {
    if (!selectedId) {
      setFormData((prev) => ({
        ...prev,
        requesterID: '',
        requesterManagerID: null,
        requesterAuthorizedID: null,
      }));
      setRequesterLockedSkillIDs([]);
      clearFieldError('requesterID');
      return;
    }
    handleRequesterSelect(selectedId);
  };
  const {
    isLoading: requestsLoading,
    error: requestError,
    isSendingApprovalEmails,
    conflictMessage,
  } = useAppSelector((state) => state.request);
  const { user } = useAppSelector((state) => state.auth);
  const departmentConfig = useAppSelector((state) =>
    user?.departmentID ? state.departmentConfiguration.configByDepartmentId[user.departmentID] ?? null : null
  );
  const { requesterManagerOptions: requesterManagerSelectOptions } =
    useAppSelector((state) => state.requesterManager);
  const { isLoading: requestEquipmentLoading } = useAppSelector((state) => state.requestEquipment);
  const isLoading = requestsLoading || requestEquipmentLoading;
  const isDepartmentEquipmentEnabled = departmentConfig?.equipment === true;
  const isLiquorLicenseTrackingEnabled = departmentConfig?.enableLiquorLicenseTracking === true;
  /** Active/Inactive filter: off while a live schedule still ends on the request end day (and request window not over). */
  const isRequestScheduleStatusFilterDisabled =
    isLoading ||
    (hasScheduleMatchingRequestEndDate && !isRequestEndDateInThePast) ||
    !formData.startDate?.trim() ||
    !formData.endDate?.trim();
  /** Add Schedule: same disabled rules as the schedule status filter (not tied to request end date vs today). */
  const isRequestScheduleAddDisabled = isRequestScheduleStatusFilterDisabled;
  const [showGenerateSchedule, setShowGenerateSchedule] = useState(false);
  /** Mirrors JWT UseAgencyDefinedFields (employee login); not from department configuration API. */
  const canShowAdditionalFields = user?.useAgencyDefinedFields === true;
  const { selectedDepartmentDefinedFields, isLoading: departmentDefinedFieldsLoading } = useAppSelector(
    (state) => state.departmentDefinedFields
  );
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const isRequesterManager = hasRole(user?.roles, UserRoleType.RequesterManager);
  const { skillOptions: skillSelectOptions } = useAppSelector((state) => state.skill);
  const { responseAreaOptions } = useAppSelector((state) => state.responseArea);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [requesterLockedSkillIDs, setRequesterLockedSkillIDs] = useState<string[]>([]);

  useEffect(() => {
    const scheduleCountForRequiredCheck =
      selectedType === 'NONE' ? activeRequestScheduleRows.length : requestScheduleRows.length;
    if (
      scheduleCountForRequiredCheck > 0 &&
      errors.requestSchedules === REQUEST.ERRORS.REQUEST_SCHEDULE_REQUIRED
    ) {
      setErrors((prev) => ({ ...prev, requestSchedules: undefined }));
    }
  }, [errors.requestSchedules, selectedType, activeRequestScheduleRows.length, requestScheduleRows.length]);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stepParam = searchParams.get('step');
  const modeParam = searchParams.get('mode');
  const isSingleMode = modeParam === 'single';

  // Update savedRequestID if initialData changes (e.g. when loading an existing request)
  useEffect(() => {
    setSavedRequestID(initialData?.requestID || null);
  }, [initialData]);

  useEffect(() => {
    setSchedulePage(1);
    setScheduleFilter(defaultScheduleFilterRange());
    if (initialData?.requestID) {
      setLocalRequestSchedules([]);
      setPendingScheduleEdits({});
    }
  }, [initialData?.requestID]);

  // Load RequestSchedule rows when we have a saved request id
  useEffect(() => {
    if (!savedRequestID) {
      setRequestSchedules([]);
      dispatch(clearRequestScheduleState());
      return;
    }

    let cancelled = false;
    void dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId: savedRequestID,
        updateState: false,
        pagination: { page: 1, pageSize: 1000, sortBy: 'startDate', sortDirection: 'asc' },
      })
    )
      .unwrap()
      .then((page) => {
        if (!cancelled) setRequestSchedules(page.data);
      })
      .catch(() => {
        if (!cancelled) setRequestSchedules([]);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, savedRequestID, scheduleListVersion]);

  useEffect(() => {
    return () => {
      dispatch(clearRequestScheduleState());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!savedRequestID) return;
    void dispatch(
      fetchRequestSchedulesByRequestIdThunk({
        requestId: savedRequestID,
        startDate: scheduleFilter.start,
        endDate: scheduleFilter.end,
        pagination: {
          page: schedulePage,
          pageSize: schedulePageSize,
          sortBy: 'startDate',
          sortDirection: 'desc',
        },
      })
    );
  }, [
    dispatch,
    savedRequestID,
    schedulePage,
    schedulePageSize,
    scheduleListVersion,
    scheduleFilter.start,
    scheduleFilter.end,
  ]);

  const STEPS = {
    DETAILS: 1,
    VEHICLES: 2,
    EQUIPMENT: 3,
  };

  const getInitialStep = () => {
    if (stepParam) {
      const s = parseInt(stepParam);
      if (!isNaN(s) && [1, 2, 3].includes(s)) return s;
    }
    return 1;
  };

  const [currentStep, setCurrentStep] = useState<number>(getInitialStep());
  const isEditMode = Boolean(initialData?.requestID);

  // Department Admin can use Managed/Preferred only when a Requester Manager is selected.
  const releaseAsDropdownOptions = useMemo(() => {
    if (!isDepartmentAdmin || isRequesterManager) return RELEASE_AS_OPTIONS;
    if (formData.requesterManagerID) return RELEASE_AS_OPTIONS;

    const defaultAllowed = new Set<string>([
      ReleaseAs.Open.toString(),
      ReleaseAs.TenureBased.toString(),
    ]);

    return RELEASE_AS_OPTIONS.filter((opt) => defaultAllowed.has(opt.value));
  }, [
    formData.requesterManagerID,
    isDepartmentAdmin,
    isRequesterManager,
  ]);

  useEffect(() => {
    if (releaseAsDropdownOptions.length === 0) return;
    const allowed = new Set(releaseAsDropdownOptions.map((opt) => opt.value));
    const currentReleaseAs = String(formData.releaseAs ?? ReleaseAs.Open);
    if (!allowed.has(currentReleaseAs)) {
      const firstAllowed = parseInt(releaseAsDropdownOptions[0].value, 10) as ReleaseAs;
      setFormData((prev) => ({ ...prev, releaseAs: firstAllowed }));
    }
  }, [formData.releaseAs, releaseAsDropdownOptions]);

  // Effect to update step if URL param changes while component is mounted (rare but good practice)
  useEffect(() => {
    const s = getInitialStep();
    if (s !== currentStep && stepParam) {
      setCurrentStep(s);
    }
  }, [stepParam]);

  // Lists for equipment/vehicles
  const [equipmentItems, setEquipmentItems] = useState<RequestEquipmentDto[]>([]);
  const [vehicleItems, setVehicleItems] = useState<RequestEquipmentDto[]>([]);
  const [fetchedEquipment, setFetchedEquipment] = useState<RequestEquipmentDto[]>([]);
  const requestEquipmentHydratedForIdRef = useRef<string | null>(null);

  const requestEquipmentLineKey = (item: RequestEquipmentDto): string =>
    `${String(item.departmentEquipmentID ?? '')
      .trim()
      .replace(/[{}()]/g, '')
      .toLowerCase()}|${item.isVehicle ? 'v' : 'e'}`;

  // State for toggling additional fields visibility
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);

  useEffect(() => {
    const departmentId = user?.departmentID?.trim();
    if (!departmentId) {
      setShowGenerateSchedule(false);
      return;
    }
    let active = true;
    void getByDepartmentId(departmentId)
      .then((config) => {
        if (active) setShowGenerateSchedule(isGenerateRequestScheduleEnabled(config));
      })
      .catch(() => {
        if (active) setShowGenerateSchedule(false);
      });
    return () => {
      active = false;
    };
  }, [user?.departmentID]);

  useEffect(() => {
    if (user?.departmentID) {
      dispatch(fetchDepartmentConfigByDepartmentId(user.departmentID));
    }
  }, [dispatch, user?.departmentID]);

  useEffect(() => {
    if (!canShowAdditionalFields && showAdditionalFields) {
      setShowAdditionalFields(false);
    }
  }, [canShowAdditionalFields, showAdditionalFields]);

  useEffect(() => {
    if (!showAdditionalFields || !user?.departmentID) return;
    dispatch(fetchDepartmentDefinedFieldsByDepartmentId(user.departmentID));
  }, [dispatch, showAdditionalFields, user?.departmentID]);

  const requestDeptFieldBindings = useMemo(
    () =>
      buildDepartmentDefinedFieldBindings('request', selectedDepartmentDefinedFields, [
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE1,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE2,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE3,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE4,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE5,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE6,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE7,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE8,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE9,
        REQUEST.FORM.DEPARTMENT_DEFINED_FIELD_VALUE10,
      ]),
    [selectedDepartmentDefinedFields]
  );

  // Response area options load via SMSDropdown serverSideSearch; keep selected value in results.
  useEffect(() => {
    const selectedId = formData.DepartmentResponseAreaId
      ? String(formData.DepartmentResponseAreaId).trim()
      : undefined;
    if (!selectedId) return;
    dispatch(fetchDepartmentResponseAreaOptions({ selectedId }));
  }, [dispatch, formData.DepartmentResponseAreaId]);

  const handleDepartmentResponseAreaSearchInputChange = useCallback(
    (value: string) => {
      const selectedId = formData.DepartmentResponseAreaId
        ? String(formData.DepartmentResponseAreaId).trim()
        : undefined;
      return dispatch(fetchDepartmentResponseAreaOptions({ searchTerm: value, selectedId }))
        .unwrap()
        .catch(() => undefined);
    },
    [dispatch, formData.DepartmentResponseAreaId]
  );

  const departmentResponseAreaDropdownOptions = useMemo(
    () =>
      (responseAreaOptions ?? []).map((area) => ({
        value: area.id,
        label: area.label,
      })),
    [responseAreaOptions]
  );

  // Fetch existing Request Equipment once per request (avoid late response wiping local adds).
  useEffect(() => {
    if (!savedRequestID) {
      requestEquipmentHydratedForIdRef.current = null;
      return;
    }
    if (requestEquipmentHydratedForIdRef.current === savedRequestID) return;

    let cancelled = false;
    dispatch(fetchRequestEquipmentThunk(savedRequestID))
      .unwrap()
      .then((equipment) => {
        if (cancelled) return;
        requestEquipmentHydratedForIdRef.current = savedRequestID;
        if (equipment.length > 0) setFetchedEquipment(equipment);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [savedRequestID, dispatch]);

  // Merge API equipment into lists; keep unsaved local rows (no requestEquipmentID).
  useEffect(() => {
    if (fetchedEquipment.length === 0) return;

    const apiVehicles = fetchedEquipment.filter((item) => item.isVehicle);
    const apiEquipment = fetchedEquipment.filter((item) => !item.isVehicle);

    const mergeWithPending = (
      fromApi: RequestEquipmentDto[],
      prev: RequestEquipmentDto[]
    ): RequestEquipmentDto[] => {
      const pending = prev.filter((i) => !i.requestEquipmentID);
      const apiKeys = new Set(fromApi.map(requestEquipmentLineKey));
      return [...fromApi, ...pending.filter((p) => !apiKeys.has(requestEquipmentLineKey(p)))];
    };

    const datesChanged = hasRequestDatesChanged(
      initialData?.startDate,
      initialData?.endDate,
      formData.startDate,
      formData.endDate
    );

    const resolveDates = (merged: RequestEquipmentDto[]) =>
      resolveRequestEquipmentDates(merged, formData.startDate, formData.endDate, datesChanged);

    setVehicleItems((prev) => {
      const merged = mergeWithPending(apiVehicles, prev);
      setOriginalVehicles(JSON.parse(JSON.stringify(merged)));
      return resolveDates(merged);
    });
    setEquipmentItems((prev) => {
      const merged = mergeWithPending(apiEquipment, prev);
      setOriginalEquipment(JSON.parse(JSON.stringify(merged)));
      return resolveDates(merged);
    });
    setFetchedEquipment([]);
  }, [fetchedEquipment, formData.startDate, formData.endDate, initialData?.startDate, initialData?.endDate]);

  const refreshRequestEquipmentFromApi = useCallback(
    async (requestId: string) => {
      const refreshed = await dispatch(fetchRequestEquipmentThunk(requestId)).unwrap();
      const apiVehicles = refreshed.filter((item) => item.isVehicle);
      const apiEquipment = refreshed.filter((item) => !item.isVehicle);
      setVehicleItems(apiVehicles);
      setEquipmentItems(apiEquipment);
      setOriginalVehicles(JSON.parse(JSON.stringify(apiVehicles)));
      setOriginalEquipment(JSON.parse(JSON.stringify(apiEquipment)));
      requestEquipmentHydratedForIdRef.current = requestId;
    },
    [dispatch]
  );

  useEffect(() => {
    if (!isDepartmentAdmin || !formData.requesterID) return;
    dispatch(
      fetchRequesterManagerOptions({
        requesterId: formData.requesterID,
        selectedId: formData.requesterManagerID || undefined,
      })
    );
  }, [dispatch, formData.requesterID, formData.requesterManagerID, isDepartmentAdmin]);

  const handleRequesterManagerSearchInputChange = useCallback(
    (value: string) => {
      if (!formData.requesterID) return Promise.resolve();
      return dispatch(
        fetchRequesterManagerOptions({
          searchTerm: value,
          requesterId: formData.requesterID,
          selectedId: formData.requesterManagerID || undefined,
        })
      )
        .unwrap()
        .catch(() => undefined);
    },
    [dispatch, formData.requesterID, formData.requesterManagerID]
  );

  // Fetch skills only when skill requirement is enabled (not on every skill add/remove)
  const hasFetchedSkillsRef = useRef(false);
  useEffect(() => {
    if (!formData.isSkillRequired) {
      hasFetchedSkillsRef.current = false;
      return;
    }
    if (hasFetchedSkillsRef.current) return;

    hasFetchedSkillsRef.current = true;
    dispatch(fetchSkillOptions());
  }, [dispatch, formData.isSkillRequired]);

  const skillOptions = (skillSelectOptions ?? []).map((skill) => ({
    value: skill.id,
    label: skill.label,
  }));
  const requesterManagerOptions = useMemo(
    () =>
      (requesterManagerSelectOptions ?? []).map((rm) => ({
        value: rm.id != null ? String(rm.id) : '',
        label: rm.label || '-',
      })),
    [requesterManagerSelectOptions]
  );
  const showRequesterManagerDropdown = isDepartmentAdmin && !isRequesterManager && !!formData.requesterID;

  // For Requester Manager users: auto-resolve RequesterManagerID by (requesterID, employeeID),
  // and do not show manual dropdown.
  useEffect(() => {
    const employeeId = user?.employeeID;
    if (!isRequesterManager) return;
    if (!formData.requesterID || !employeeId) {
      setFormData((prev) => ({ ...prev, requesterManagerID: null }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const manager = await dispatch(
          fetchRequesterManagerByRequesterAndEmployeeThunk({
            requesterID: formData.requesterID,
            employeeID: employeeId,
          })
        ).unwrap();
        if (!cancelled) {
          setFormData((prev) => ({
            ...prev,
            requesterManagerID: manager?.requesterManagerID || null,
          }));
        }
      } catch {
        if (!cancelled) {
          setFormData((prev) => ({ ...prev, requesterManagerID: null }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.requesterID, isRequesterManager, user?.employeeID]);

  const handleChange = (field: keyof RequestFormData, value: string | number | boolean | string[] | number[] | null | undefined) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === FIELD_NAMES.START_DATE && selectedType === 'NONE') {
        const startVal = typeof value === 'string' ? value.trim() : '';
        newData.endDate = startVal;
      }
      if (field === FIELD_NAMES.IS_SPECIAL_EVENT && !value) {
        newData.specialEventApproved = false;
      }
      if (field === FIELD_NAMES.IS_SKILL_REQUIRED && !value) {
        if (requesterLockedSkillIDs.length > 0) {
          newData.isSkillRequired = true;
          return newData;
        }
        newData.skillIDs = [];
      }
      // When unchecking, clear only that field's value (no other fields)
      if (field === FIELD_NAMES.REQUIRES_PERMIT && !value) {
        newData.permitNumber = '';
      }
      if (field === FIELD_NAMES.REQUIRES_LIQUOR_LICENSE && !value) {
        newData.liquorLicenseNumber = '';
        newData.alcoholPermitRequired = false;
        newData.specialRate = DEFAULT_SPECIAL_RATE;
      }
      if (field === FIELD_NAMES.ALCOHOL_PERMIT_REQUIRED) {
        if (value) {
          if (newData.specialRate == null || Number(newData.specialRate) <= 0) {
            newData.specialRate = DEFAULT_SPECIAL_RATE;
          }
        } else {
          newData.specialRate = DEFAULT_SPECIAL_RATE;
        }
      }
      if (field === FIELD_NAMES.RELEASE_STATUS) {
        const numericStatus = typeof value === 'string' ? parseInt(value, 10) : (value as number);
        // When not "Released On", clear schedule fields so they stay empty/disabled and save as null.
        if (numericStatus !== RequestStatus.ReleasedOn) {
          newData.scheduleDate = '';
          newData.scheduledTime = '';
          setErrors((prev) => ({ ...prev, scheduleDate: undefined, scheduledTime: undefined }));
        }
      }
      // Clear processDate and processTime when ReleaseAs does not require process fields.
      if (
        field === FIELD_NAMES.RELEASE_AS &&
        !requiresProcessFields(value as ReleaseAs)
      ) {
        newData.processDate = '';
        newData.processTime = '';
      }
      // Release As ≠ Release Status: the requester list shows schedule `requestStatus`. Managed/Preferred
      // requests are published to those pools, so default Release Status to Release Now when user picks them.
      if (field === FIELD_NAMES.RELEASE_AS) {
        const ra = value as ReleaseAs;
        if (ra === ReleaseAs.Managed || ra === ReleaseAs.Preferred) {
          newData.requestStatus = RequestStatus.ReleaseNow;
        }
      }
      return newData;
    });
    clearFieldError(field as keyof RequestFormErrors);
    if (field === 'enableFees') {
      setErrors((prev) => ({ ...prev, selectedDepartmentFeeIds: undefined }));
    }
    if (field === FIELD_NAMES.START_DATE && selectedType === 'NONE') {
      setErrors((prev) => ({ ...prev, endDate: undefined, requestSchedules: undefined }));
      setOutdatedScheduleRowIds(new Set());
    }
    // Clear processDate and processTime errors when ReleaseAs does not require process fields.
    if (
      field === FIELD_NAMES.RELEASE_AS &&
      !requiresProcessFields(value as ReleaseAs)
    ) {
      setErrors((prev) => ({ ...prev, processDate: undefined, processTime: undefined }));
    }
    // Do not rewrite localRequestSchedules when main-form Release As changes.
    // Each schedule row has its own releaseAs / requestStatus from the modal; bulk-updating status to
    // Released for Managed/Preferred on the request broke upsert payloads (wrong status vs row release type).
    // New rows still inherit form defaults via handleOpenAddRequestScheduleModal.
    // When unchecking, reset only that field's related state and error (never touch other sections)
    if (value === false) {
      if (field === FIELD_NAMES.REQUIRES_PERMIT) {
        setErrors((prev) => ({ ...prev, permitNumber: undefined }));
      } else if (field === FIELD_NAMES.REQUIRES_LIQUOR_LICENSE) {
        setErrors((prev) => ({ ...prev, liquorLicenseNumber: undefined, specialRate: undefined }));
      } else if (field === FIELD_NAMES.REQUIRES_VEHICLE) {
        setVehicleItems([]);
        setErrors((prev) => ({ ...prev, vehicles: undefined }));
      } else if (field === FIELD_NAMES.REQUIRES_EQUIPMENT) {
        setEquipmentItems([]);
        setErrors((prev) => ({ ...prev, equipment: undefined }));
      } else if (field === FIELD_NAMES.IS_SKILL_REQUIRED) {
        if (requesterLockedSkillIDs.length === 0) {
          setErrors((prev) => ({ ...prev, skillIDs: undefined }));
        }
      } else if (field === FIELD_NAMES.APPROVAL_REQUIRED) {
        setErrors((prev) => ({ ...prev, routingGroupIDs: undefined }));
      } else if (field === FIELD_NAMES.ALCOHOL_PERMIT_REQUIRED) {
        setErrors((prev) => ({ ...prev, specialRate: undefined }));
      }
    }
  };


  const initialRecurrenceRule = useMemo(() => {
    return initialData ? mapBackendToRecurrence(initialData) : InitialRecurrenceRule;
  }, [initialData]);

  const isRecurrenceDirty = useMemo(() => {
    return !isDeepEqual(recurrenceRule, initialRecurrenceRule);
  }, [recurrenceRule, initialRecurrenceRule]);

  const isRequestDirty = useMemo(() => {
    if (!initialData) return true;
    const initialFormData: RequestFormData = {
      requesterID: initialData.requesterID,
      requesterManagerID: initialData.requesterManagerID || null,
      enableWaitingList: initialData.enableWaitingList,
      firstName: initialData.firstName || '',
      lastName: initialData.lastName || '',
      primaryPhone: initialData.primaryPhone || '',
      cellPhone: initialData.cellPhone || '',
      secondaryPhone: initialData.secondaryPhone || '',
      alternateCellPhone: initialData.alternateCellPhone || '',
      primaryEmail: initialData.primaryEmail || '',
      secondaryEmail: initialData.secondaryEmail || '',
      isPostContact: initialData.isPostContact,
      startDate: initialData.startDate || '',
      endDate: initialData.endDate || '',
      title: initialData.title || '',
      location: initialData.location || '',
      address: initialData.address || '',
      city: initialData.city || '',
      state: initialData.state || '',
      zip: String(initialData.zip ?? '').replace(/\D/g, ''),
      postLocationsAreStationary: initialData.postLocationsAreStationary,
      requiresPermit: initialData.requiresPermit,
      permitNumber: initialData.permitNumber || '',
      isSpecialEvent: initialData.isSpecialEvent,
      isPremiumPaidEvent: initialData.isPremiumPaidEvent ?? false,
      specialEventApproved: initialData.specialEventApproved || false,
      requiresLiquorLicense: initialData.requiresLiquorLicense,
      liquorLicenseNumber: initialData.liquorLicenseNumber || '',
      alcoholPermitRequired: initialData.alcoholPermitRequired ?? false,
      specialRate: resolveSpecialRate(initialData.specialRate),
      requiresVehicle: initialData.requiresVehicle,
      requiresVehicleAtEveryPost: initialData.requiresVehicleAtEveryPost,
      numberOfVehicles: initialData.numberOfVehicles,
      vehicleApproved: initialData.vehicleApproved || false,
      requiresEquipment: initialData.requiresEquipment,
      requiresEquipmentAtEachPost: initialData.requiresEquipmentAtEachPost,
      numberOfEquipment: initialData.numberOfEquipment,
      isSkillRequired: initialData.isSkillRequired,
      skillIDs: initialData.skillIDs || [],
      departmentDefinedFieldValue1: initialData.departmentDefinedFieldValue1 || '',
      departmentDefinedFieldValue2: initialData.departmentDefinedFieldValue2 || '',
      departmentDefinedFieldValue3: initialData.departmentDefinedFieldValue3 || '',
      departmentDefinedFieldValue4: initialData.departmentDefinedFieldValue4 || '',
      departmentDefinedFieldValue5: initialData.departmentDefinedFieldValue5 || '',
      departmentDefinedFieldValue6: initialData.departmentDefinedFieldValue6 || '',
      departmentDefinedFieldValue7: initialData.departmentDefinedFieldValue7 || '',
      departmentDefinedFieldValue8: initialData.departmentDefinedFieldValue8 || '',
      departmentDefinedFieldValue9: initialData.departmentDefinedFieldValue9 || '',
      departmentDefinedFieldValue10: initialData.departmentDefinedFieldValue10 || '',
      requestHasBeenUpdated: initialData.requestHasBeenUpdated,
      // Legacy recurrence fields removed
      requestStatus: initialData.requestSchedule?.requestStatus ?? RequestStatus.Pending,
      releaseAs: initialData.releaseAs ?? initialData.requestSchedule?.releaseAs ?? ReleaseAs.Open,
      scheduleDate: initialData.requestSchedule?.scheduleDate ?? '',
      scheduledTime: formatTimeToHHmm(initialData.requestSchedule?.scheduledTime),
      posts: initialData.posts || [],
      enableFees: initialData.enableFees ?? true,
      selectedDepartmentFeeIds: initialData.selectedDepartmentFeeIds || [],
    };
    return !isDeepEqual(formData, initialFormData);
  }, [formData, initialData]);

  const requestPeriodStartKey = toEquipmentDatePickerBound(formData.startDate);
  const requestPeriodEndKey = toEquipmentDatePickerBound(formData.endDate);
  const prevRequestPeriodKeyRef = useRef('');

  // Request start/end changed → update all vehicle & equipment rows in the table.
  useEffect(() => {
    if (!requestPeriodStartKey || !requestPeriodEndKey) return;
    const periodKey = `${requestPeriodStartKey}|${requestPeriodEndKey}`;
    const periodChanged =
      prevRequestPeriodKeyRef.current !== '' && prevRequestPeriodKeyRef.current !== periodKey;
    prevRequestPeriodKeyRef.current = periodKey;
    if (!periodChanged) return;

    setVehicleItems((prev) =>
      applyRequestPeriodToAllEquipment(prev, formData.startDate, formData.endDate)
    );
    setEquipmentItems((prev) =>
      applyRequestPeriodToAllEquipment(prev, formData.startDate, formData.endDate)
    );
  }, [requestPeriodStartKey, requestPeriodEndKey, formData.startDate, formData.endDate]);

  const [originalVehicles, setOriginalVehicles] = useState<RequestEquipmentDto[]>([]);
  const [originalEquipment, setOriginalEquipment] = useState<RequestEquipmentDto[]>([]);

  const areVehiclesDirty = useMemo(() => {
    return !isDeepEqual(vehicleItems, originalVehicles);
  }, [vehicleItems, originalVehicles]);

  const areEquipmentDirty = useMemo(() => {
    return !isDeepEqual(equipmentItems, originalEquipment);
  }, [equipmentItems, originalEquipment]);

  const isFormDirty =
    isRequestDirty ||
    areVehiclesDirty ||
    areEquipmentDirty ||
    pendingDeletedRequestEquipmentIds.length > 0 ||
    isRecurrenceDirty ||
    localRequestSchedules.length > 0 ||
    Object.keys(pendingScheduleEdits).length > 0 ||
    pendingGeneratePayload != null;

  // Check if approval is required but no routing groups are selected
  // Approval Group tab removed from right side; no longer require routing groups when approval required
  const isApprovalRequiredButNoGroups = false;

  const requesterError = errors.requesterID ?? (requestError && !formData.requesterID ? REQUEST.ERRORS.REQUESTER_REQUIRED : undefined);

  // Handle local deletion for batch save
  const handleLocalDelete = (item: RequestEquipmentDto) => {
    if (item.requestEquipmentID) {
      setPendingDeletedRequestEquipmentIds((prev) => {
        const id = item.requestEquipmentID!;
        return prev.includes(id) ? prev : [...prev, id];
      });
    }
    // Remove from local lists
    if (vehicleItems.some(i => i === item)) {
      setVehicleItems(prev => prev.filter(i => i !== item));
    } else if (equipmentItems.some(i => i === item)) {
      setEquipmentItems(prev => prev.filter(i => i !== item));
    }
  };

  const recurrenceValidationError = validateRecurrenceRule(recurrenceRule, formData.startDate);

  const renderButtons = () => (
    <SMSStack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ marginTop: '1rem' }}>
      <SMSButton onClick={onCancel} type="button">
        {REQUEST.FORM.CANCEL_BUTTON}
      </SMSButton>
      <SMSButton
        onClick={handleSave}
        disabled={
          isLoading ||
          isSendingApprovalEmails ||
          (initialData ? !isFormDirty : false) ||
          !!recurrenceValidationError ||
          isApprovalRequiredButNoGroups
        }
        type="button"
      >
        {isSendingApprovalEmails
          ? 'Sending email...'
          : isLoading
            ? REQUEST.FORM.SUBMITTING
            : (initialData ? REQUEST.BUTTON.UPDATE : 'Save')}
      </SMSButton>
    </SMSStack>
  );

  const renderSingleModeButtons = () => (
    <SMSStack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ marginTop: '2rem' }}>
      <SMSButton onClick={onCancel || (() => navigate(-1))} type="button">
        {REQUEST.FORM.CANCEL_BUTTON}
      </SMSButton>
      <SMSButton
        onClick={handleSave}
        disabled={
          isLoading ||
          isSendingApprovalEmails ||
          (initialData ? !isFormDirty : false) ||
          isApprovalRequiredButNoGroups
        }
        type="button"
      >
        {isSendingApprovalEmails
          ? 'Sending email...'
          : isLoading
            ? REQUEST.FORM.SUBMITTING
            : (initialData ? REQUEST.BUTTON.UPDATE : 'Save')}
      </SMSButton>
    </SMSStack>
  );

  const validateForm = (): boolean => {
    const newErrors: RequestFormErrors = {};

    // Requester is required in add mode when no requesterId is pre-filled
    if (!initialData?.requestID && !requesterId && !formData.requesterID?.trim()) {
      newErrors.requesterID = REQUEST.ERRORS.REQUESTER_REQUIRED;
    }

    if (!formData.firstName.trim()) newErrors.firstName = REQUEST.ERRORS.FIRST_NAME_REQUIRED;
    if (formData.firstName.length > 50) newErrors.firstName = REQUEST.ERRORS.FIRST_NAME_LENGTH;

    if (!formData.lastName.trim()) newErrors.lastName = REQUEST.ERRORS.LAST_NAME_REQUIRED;
    if (formData.lastName.length > 50) newErrors.lastName = REQUEST.ERRORS.LAST_NAME_LENGTH;

    if (!formData.startDate.trim()) newErrors.startDate = REQUEST.ERRORS.START_DATE_REQUIRED;
    if (!formData.endDate.trim()) newErrors.endDate = REQUEST.ERRORS.END_DATE_REQUIRED;
    if (!formData.title.trim()) newErrors.title = REQUEST.ERRORS.TITLE_REQUIRED;
    if (formData.title.length > 200) newErrors.title = REQUEST.ERRORS.TITLE_LENGTH;

    if (!formData.location.trim()) newErrors.location = REQUEST.ERRORS.LOCATION_REQUIRED;
    if (formData.location.length > 50) newErrors.location = REQUEST.ERRORS.LOCATION_LENGTH;

    if (!formData.address.trim()) newErrors.address = REQUEST.ERRORS.REQUIRED;
    if (!formData.city.trim()) newErrors.city = REQUEST.ERRORS.REQUIRED;
    if (!formData.state.trim()) newErrors.state = REQUEST.ERRORS.REQUIRED;
    const zipTrimmed = formData.zip.trim();
    if (!zipTrimmed) {
      newErrors.zip = REQUEST.ERRORS.REQUIRED;
    } else if (!/^\d+$/.test(zipTrimmed)) {
      newErrors.zip = REQUEST.ERRORS.ZIP_NUMBERS_ONLY;
    }

    if (!formData.primaryEmail?.trim()) {
      newErrors.primaryEmail = REQUEST.ERRORS.PRIMARY_EMAIL_REQUIRED;
    } else if (formData.primaryEmail) {
      if (!validateEmail(formData.primaryEmail)) {
        newErrors.primaryEmail = REQUEST.ERRORS.EMAIL_INVALID;
      } else if (formData.primaryEmail.length > 50) {
        newErrors.primaryEmail = REQUEST.ERRORS.EMAIL_LENGTH;
      }
    }

    if (formData.secondaryEmail?.trim() && !validateEmail(formData.secondaryEmail)) {
      newErrors.secondaryEmail = REQUEST.ERRORS.EMAIL_INVALID;
    }

    if (!formData.primaryPhone?.trim()) {
      newErrors.primaryPhone = REQUEST.ERRORS.PRIMARY_PHONE_REQUIRED;
    } else if (formData.primaryPhone.length > 50) {
      newErrors.primaryPhone = REQUEST.ERRORS.PHONE_LENGTH;
    }

    if (formData.requestStatus === RequestStatus.ReleasedOn) {
      if (!formData.scheduleDate?.trim()) {
        newErrors.scheduleDate = REQUEST.ERRORS.SCHEDULE_DATE_REQUIRED;
      }
      if (!formData.scheduledTime?.trim()) {
        newErrors.scheduledTime = REQUEST.ERRORS.SCHEDULE_TIME_REQUIRED;
      }
    }

    // Process Date required when Release As is Tenure Based or Preferred — only on the main form when the request
    // does not repeat. For DAY/WEEK/MONTH/CUSTOM, process date/time lives on each Request Schedule row.
    if (requiresProcessFields(formData.releaseAs) && selectedType === 'NONE') {
      if (!formData.processDate?.trim()) {
        newErrors.processDate = REQUEST.ERRORS.PROCESS_DATE_REQUIRED;
      }
    }

    // Weekly Recurrence Validation: Minimum X weeks gap (calendar from `YYYY-MM-DD` prefix, not `new Date(ISO)`).
    if (recurrenceRule.repeatUnit === RecurrenceUnit.WEEK && formData.startDate && formData.endDate) {
      const start = parseScheduleDate(formData.startDate);
      const end = parseScheduleDate(formData.endDate);
      if (start && end) {
        const interval = recurrenceRule.interval || 1;
        const minEnd = new Date(start);
        minEnd.setDate(minEnd.getDate() + (interval * 7));

        if (end < minEnd) {
          newErrors.endDate = `Minimum ${interval} week${interval > 1 ? 's' : ''} gap is required between Start Date and End Date.`;
        }
      }
    }

    // Monthly Recurrence Validation: Minimum X months gap
    if (recurrenceRule.repeatUnit === RecurrenceUnit.MONTH && formData.startDate && formData.endDate) {
      const start = parseScheduleDate(formData.startDate);
      const end = parseScheduleDate(formData.endDate);
      if (start && end) {
        const interval = recurrenceRule.interval || 1;
        const minEnd = new Date(start);
        minEnd.setMonth(minEnd.getMonth() + interval);

        if (end < minEnd) {
          newErrors.endDate = `Minimum ${interval} month${interval > 1 ? 's' : ''} gap is required between Start Date and End Date.`;
        }
      }
    }

    const startKey = leadingYyyyMmDdKey(formData.startDate);
    const endKey = leadingYyyyMmDdKey(formData.endDate);
    if (isYyyyMmDdKey(startKey) && isYyyyMmDdKey(endKey)) {
      if (endKey < startKey) {
        newErrors.endDate = REQUEST.ERRORS.END_DATE_INVALID;
      }
    } else {
      const startD = parseScheduleDate(formData.startDate);
      const endD = parseScheduleDate(formData.endDate);
      if (startD && endD && endD < startD) {
        newErrors.endDate = REQUEST.ERRORS.END_DATE_INVALID;
      }
    }

    if (
      hasRequestSchedules &&
      latestScheduleEndYmdKey &&
      formData.endDate?.trim() &&
      !newErrors.endDate
    ) {
      const reqKey = leadingYyyyMmDdKey(formData.endDate);
      if (isYyyyMmDdKey(reqKey) && reqKey < latestScheduleEndYmdKey) {
        newErrors.endDate = REQUEST.ERRORS.END_DATE_BEFORE_LATEST_SCHEDULE;
      }
    }

    // New Recurrence Validation
    // We pass startDate to validation to check against end date
    const recurrenceError = validateRecurrenceRule(recurrenceRule, formData.startDate);
    if (recurrenceError) {
      // Apply error to a generic field or specific one. 
      // Since we don't have a single field for recurrence, we might need a way to show it.
      // For now, map it to 'requestType' or 'endDate' if it's related.
      // Or just a general error. 
      // The UI for RequestRecurrence assumes it handles its own internal validation mostly, 
      // but 'validateForm' blocks submission.
      // We'll attach it to 'requestType' which is close enough.
      newErrors.requestType = recurrenceError;
    }

    if (formData.isSkillRequired && (!formData.skillIDs || formData.skillIDs.length === 0)) {
      newErrors.skillIDs = REQUEST.ERRORS.SKILL_REQUIRED;
    }

    if (formData.requiresPermit && !formData.permitNumber?.trim()) {
      newErrors.permitNumber = 'Permit Number is required';
    }

    if (formData.requiresLiquorLicense && !formData.liquorLicenseNumber?.trim()) {
      newErrors.liquorLicenseNumber = 'Liquor License Number is required';
    }

    if (
      isLiquorLicenseTrackingEnabled &&
      formData.requiresLiquorLicense &&
      formData.alcoholPermitRequired &&
      (!Number.isFinite(Number(formData.specialRate)) || Number(formData.specialRate) <= 0)
    ) {
      newErrors.specialRate = REQUEST.ERRORS.SPECIAL_RATE_GREATER_THAN_ZERO;
    }

    if (formData.requiresVehicle && vehicleItems.length === 0) {
      newErrors.vehicles = REQUEST.ERRORS.VEHICLE_REQUIRED;
    } else if (
      formData.requiresVehicle &&
      vehicleItems.some(
        (item) =>
          !isEquipmentEffectiveRangeWithinRequestPeriod(
            item.startDate,
            item.endDate,
            formData.startDate,
            formData.endDate
          )
      )
    ) {
      newErrors.vehicles = REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_DATES_MISSING_ON_ROW;
    }

    const resolvedSelectedFeeIds =
      formData.selectedDepartmentFeeIds?.length
        ? formData.selectedDepartmentFeeIds
        : selectedFees.map((f) => f.departmentFeeId);
    if ((formData.enableFees ?? true) && resolvedSelectedFeeIds.length === 0) {
      newErrors.selectedDepartmentFeeIds = REQUEST_FORM.ERRORS.SELECT_FEE_REQUIRED;
    }

    if (isDepartmentEquipmentEnabled && formData.requiresEquipment && equipmentItems.length === 0) {
      newErrors.equipment = REQUEST.ERRORS.EQUIPMENT_REQUIRED;
    } else if (
      isDepartmentEquipmentEnabled &&
      formData.requiresEquipment &&
      equipmentItems.some(
        (item) =>
          !isEquipmentEffectiveRangeWithinRequestPeriod(
            item.startDate,
            item.endDate,
            formData.startDate,
            formData.endDate
          )
      )
    ) {
      newErrors.equipment = REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_DATES_MISSING_ON_ROW;
    }

    const hasRequiredSchedules =
      selectedType === 'NONE'
        ? activeRequestScheduleRows.length > 0
        : requestScheduleRows.length > 0 || pendingGeneratePayload != null;
    if (!hasRequiredSchedules) {
      newErrors.requestSchedules = REQUEST.ERRORS.REQUEST_SCHEDULE_REQUIRED;
    }

    let staleScheduleRowIds = new Set<string>();
    if (
      selectedType === 'NONE' &&
      !newErrors.requestSchedules &&
      formData.startDate?.trim()
    ) {
      staleScheduleRowIds = findScheduleRowIdsStaleAfterRequestStart(
        formData.startDate,
        activeRequestScheduleRows
      );
      if (staleScheduleRowIds.size > 0) {
        newErrors.requestSchedules = REQUEST.ERRORS.REQUEST_SCHEDULE_OUTDATED_AFTER_START_DATE;
      }
    }

    setOutdatedScheduleRowIds(staleScheduleRowIds);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  const handleSave = async (e?: React.FormEvent, confirmConflict = false) => {
    e?.preventDefault();
    setHasAttemptedSubmit(true);
    dispatch(clearError());
    setErrors((prev) => ({ ...prev, _form: undefined }));

    if (!validateForm()) return;
    if (initialData && !isFormDirty) {
      if (onSuccess) onSuccess(); else if (isSingleMode) navigate(-1);
      return;
    }

    try {
      let requestId = savedRequestID || initialData?.requestID;

      const openDateChangeConflict = (
        error: unknown,
        payload: CreateRequestRequest | UpdateRequestRequest
      ): boolean => {
        const conflict = parseRequestOneTimeDateChangeRejection(error);
        if (!conflict) return false;
        setPendingConflictUpsertPayload(payload);
        setDateChangeConflictMessage(conflict.message);
        setDateChangeConflictRows(conflict.assignedPostPositions);
        setDateChangeConflictOpen(true);
        return true;
      };

      // 1. Upsert Request

      const preparePayload = (data: RequestFormData) => {
        // Map recurrence rule to backend fields, including processDate and processTime
        // Include processDate/processTime only for ReleaseAs values that require them.
        const shouldIncludeProcessFields = requiresProcessFields(data.releaseAs);

        // If process time is empty for process-date/time release modes, default to "00:00"
        const effectiveProcessTime =
          shouldIncludeProcessFields && (!data.processTime || !data.processTime.trim())
            ? '00:00'
            : (data.processTime || null);

        const recurrenceUpdates = mapRecurrenceToBackend(
          recurrenceRule,
          shouldIncludeProcessFields ? (data.processDate || null) : null,
          shouldIncludeProcessFields ? effectiveProcessTime : null
        );

        const payload = {
          ...data,
          requiresEquipment: isDepartmentEquipmentEnabled ? data.requiresEquipment : false,
          requiresEquipmentAtEachPost:
            isDepartmentEquipmentEnabled && data.requiresEquipment
              ? data.requiresEquipmentAtEachPost
              : false,
          numberOfEquipment:
            isDepartmentEquipmentEnabled && data.requiresEquipment
              ? data.numberOfEquipment
              : undefined,
          ...recurrenceUpdates,
          requestType: recurrenceUpdates.requestType, // Set the new requestType object
          // Only persist schedule date/time when status is "Released On"; otherwise store null.
          scheduleDate: data.requestStatus === RequestStatus.ReleasedOn
            ? (data.scheduleDate || null)
            : null,
          scheduledTime: data.requestStatus === RequestStatus.ReleasedOn
            ? (data.scheduledTime || null)
            : null,
          requestStatus: data.requestStatus, // Backend property: RequestStatus
          releaseAs: data.releaseAs, // Backend property: ReleaseAs
          DepartmentResponseAreaId: data.DepartmentResponseAreaId || null,
          requesterAuthorizedID: data.requesterAuthorizedID || null,
          primaryPhone: unformatPhoneNumber(data.primaryPhone),
          cellPhone: unformatPhoneNumber(data.cellPhone || ''),
          // Only include secondary contact fields if checkbox is checked
          ...(showSecondaryContactInfo ? {
            secondaryEmail: data.secondaryEmail || undefined,
            secondaryPhone: unformatPhoneNumber(data.secondaryPhone || ''),
            alternateCellPhone: unformatPhoneNumber(data.alternateCellPhone || ''),
          } : {
            secondaryEmail: undefined,
            secondaryPhone: undefined,
            alternateCellPhone: undefined,
          }),
          posts: data.posts || [],
          enableFees: data.enableFees ?? true,
          selectedDepartmentFeeIds: (data.enableFees ?? true)
            ? (data.selectedDepartmentFeeIds?.length
                ? data.selectedDepartmentFeeIds
                : selectedFees.map((f) => f.departmentFeeId))
            : undefined,
        };

        // Debug log: see exactly what we send to API
        // eslint-disable-next-line no-console
        console.log('[RequestForm] Upsert payload', {
          requestID: requestId,
          requestType: payload.requestType,
        });

        return payload;
      };

      if (requestId) {
        if (isRequestDirty || isRecurrenceDirty) {
          const payload: UpdateRequestRequest = {
            requestID: requestId,
            ...preparePayload(formData),
            confirmConflict: confirmConflict === true ? true : undefined,
          };
          try {
            await dispatch(upsertRequestThunk(payload)).unwrap();
          } catch (error) {
            if (openDateChangeConflict(error, payload)) return;
            if (
              error &&
              typeof error === 'object' &&
              (error as { status?: number }).status === 409 &&
              (error as { requiresConfirmation?: boolean }).requiresConfirmation === true
            ) {
              return;
            }
            throw error;
          }
        }
      } else {
        const payload: CreateRequestRequest = {
          ...preparePayload(formData)
        };
        try {
          const result = await dispatch(
            upsertRequestThunk({
              request: payload,
            })
          ).unwrap();
          requestId = result.requestID;
          setSavedRequestID(requestId);
        } catch (error) {
          if (openDateChangeConflict(error, payload)) return;
          if (
            error &&
            typeof error === 'object' &&
            (error as { status?: number }).status === 409 &&
            (error as { requiresConfirmation?: boolean }).requiresConfirmation === true
          ) {
            return;
          }
          throw error;
        }
      }

      if (!requestId) throw new Error("Failed to get Request ID");

      await finishRequestSaveRef.current(requestId);
    } catch {
      // Save failed (date-change conflicts open the transfer modal inline on request upsert).
    }
  };

  const handleConflictConfirm = useCallback(() => {
    dispatch(clearConflictMessage());
    void handleSave(undefined, true);
  }, [dispatch, handleSave]);

  const finishRequestSaveRef = useRef<(requestId: string) => Promise<void>>(async () => {});

  const [itemToDelete, setItemToDelete] = useState<RequestEquipmentDto | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dateChangeConflictOpen, setDateChangeConflictOpen] = useState(false);
  const [dateChangeConflictMessage, setDateChangeConflictMessage] = useState('');
  const [dateChangeConflictRows, setDateChangeConflictRows] = useState<
    RequestOneTimeDateChangeAssignmentDto[]
  >([]);
  const [pendingConflictUpsertPayload, setPendingConflictUpsertPayload] = useState<
    CreateRequestRequest | UpdateRequestRequest | null
  >(null);
  const [isConflictTransferring, setIsConflictTransferring] = useState(false);

  const finishRequestSave = useCallback(
    async (requestId: string) => {
      const isCloneSave = isClonedRef.current;
      const pendingEdits = Object.entries(pendingScheduleEdits);
      const hasLocalOrPendingSchedules =
        localRequestSchedules.length > 0 || pendingEdits.length > 0;

      const scheduleUpsertPayloads: RequestScheduleDto[] = [];

      const scheduleWithoutCloneFlag = ({ isCloned: _omit, ...schedule }: RequestScheduleDto) => schedule;

      if (hasLocalOrPendingSchedules) {
        for (const { localId: _ignored, ...schedule } of localRequestSchedules) {
          scheduleUpsertPayloads.push({
            ...scheduleWithoutCloneFlag(schedule),
            requestScheduleID: schedule.requestScheduleID || undefined,
            requestId,
            ...(isCloneSave ? { isCloned: true } : {}),
          });
        }
        for (const [requestScheduleID, schedule] of pendingEdits) {
          scheduleUpsertPayloads.push({
            ...scheduleWithoutCloneFlag(schedule as RequestScheduleDto),
            requestScheduleID,
            requestId,
            ...(isCloneSave ? { isCloned: true } : {}),
          });
        }
      } else if (isCloneSave) {
        for (const schedule of requestSchedules) {
          scheduleUpsertPayloads.push({
            ...scheduleWithoutCloneFlag(schedule),
            requestId,
            isCloned: true,
          });
        }
      }

      const startDateChanged =
        !!initialData?.startDate &&
        scheduleRangeKey(formData.startDate) !== scheduleRangeKey(initialData.startDate);
      const savedGeneration = !pendingGeneratePayload && startDateChanged
        ? await getRequestScheduleGenerationByRequestId(requestId).catch(() => null)
        : null;

      if (pendingGeneratePayload || savedGeneration) {
        await dispatch(
          generateRequestSchedulesThunk({
            requestId,
            endDate: formData.endDate,
            requestType: recurrenceRule.repeatUnit,
            daysOfWeek: pendingGeneratePayload?.daysOfWeek,
            daysOfMonth: pendingGeneratePayload?.daysOfMonth,
            monthlyMode: pendingGeneratePayload?.monthlyMode,
            weekIndex: pendingGeneratePayload?.weekIndex,
            scheduledTime: formatHhMmToApiTimeOnly(pendingGeneratePayload?.scheduledTime),
            releaseHours: pendingGeneratePayload?.releaseHours,
          })
        ).unwrap();
        setPendingGeneratePayload(null);
        setLocalRequestSchedules([]);
        setPendingScheduleEdits({});
        setSchedulePage(1);
        setScheduleListVersion((version) => version + 1);
        if (isCloneSave) {
          isClonedRef.current = false;
        }
      } else if (scheduleUpsertPayloads.length > 0) {
        await Promise.all(
          scheduleUpsertPayloads.map((payload) =>
            dispatch(upsertRequestScheduleThunk(payload)).unwrap()
          )
        );
        if (hasLocalOrPendingSchedules) {
          setLocalRequestSchedules([]);
          setPendingScheduleEdits({});
        }
        setScheduleListVersion((version) => version + 1);
        if (isCloneSave) {
          isClonedRef.current = false;
        }
      }

      const notesToSave = formData.notes?.trim();
      const commentsToSave = formData.comments?.trim();
      if (!isEditMode && (notesToSave || commentsToSave)) {
        try {
          await dispatch(upsertRequestNoteThunk({
            requestID: requestId,
            notes: notesToSave || '',
            comments: commentsToSave || '',
          })).unwrap();
        } catch {
          // Don't fail the entire save if note fails
        }
      }

      const vehiclesToUpsert = vehicleItems.filter((item) => {
        if (!item.requestEquipmentID) return true;
        const original = originalVehicles.find((ov) => ov.requestEquipmentID === item.requestEquipmentID);
        return !original || !isDeepEqual(item, original);
      });
      const equipmentToUpsert = equipmentItems.filter((item) => {
        if (!item.requestEquipmentID) return true;
        const original = originalEquipment.find((oe) => oe.requestEquipmentID === item.requestEquipmentID);
        return !original || !isDeepEqual(item, original);
      });

      const deleteRequestEquipmentPromises = pendingDeletedRequestEquipmentIds.map((id) =>
        dispatch(deleteRequestEquipmentThunk(id)).unwrap()
      );

      const requestDatesChanged =
        !!initialData &&
        (String(formData.startDate ?? '') !== String(initialData.startDate ?? '') ||
          String(formData.endDate ?? '') !== String(initialData.endDate ?? ''));
      const equipmentEffectiveStart =
        (requestDatesChanged
          ? toEquipmentDatePickerBound(formData.startDate)
          : null) ??
        toEquipmentDatePickerBound(formData.startDate);
      const equipmentEffectiveEnd =
        (requestDatesChanged
          ? toEquipmentDatePickerBound(formData.endDate)
          : null) ??
        toEquipmentDatePickerBound(formData.endDate);

      await Promise.all([
        Promise.all(
          vehiclesToUpsert.map((item) =>
            dispatch(
              upsertRequestEquipmentThunk({
                ...item,
                requestID: requestId,
                isVehicle: true,
                requestEquipmentID: item.requestEquipmentID || undefined,
                startDate: requestDatesChanged
                  ? equipmentEffectiveStart ?? null
                  : toEquipmentDatePickerBound(item.startDate) ?? equipmentEffectiveStart ?? null,
                endDate: requestDatesChanged
                  ? equipmentEffectiveEnd ?? null
                  : toEquipmentDatePickerBound(item.endDate) ?? equipmentEffectiveEnd ?? null,
              })
            ).unwrap()
          )
        ),
        Promise.all(
          equipmentToUpsert.map((item) =>
            dispatch(
              upsertRequestEquipmentThunk({
                ...item,
                requestID: requestId,
                isVehicle: false,
                requestEquipmentID: item.requestEquipmentID || undefined,
                startDate: requestDatesChanged
                  ? equipmentEffectiveStart ?? null
                  : toEquipmentDatePickerBound(item.startDate) ?? equipmentEffectiveStart ?? null,
                endDate: requestDatesChanged
                  ? equipmentEffectiveEnd ?? null
                  : toEquipmentDatePickerBound(item.endDate) ?? equipmentEffectiveEnd ?? null,
              })
            ).unwrap()
          )
        ),
        Promise.all(deleteRequestEquipmentPromises),
      ]);

      const hadEquipmentMutations =
        vehiclesToUpsert.length > 0 ||
        equipmentToUpsert.length > 0 ||
        pendingDeletedRequestEquipmentIds.length > 0;

      const shouldRefreshEquipmentAfterDateChange =
        requestDatesChanged && (vehicleItems.length > 0 || equipmentItems.length > 0);

      if (hadEquipmentMutations || shouldRefreshEquipmentAfterDateChange) {
        if (hadEquipmentMutations) {
          setPendingDeletedRequestEquipmentIds([]);
        }
        try {
          await refreshRequestEquipmentFromApi(requestId);
        } catch {
          // Equipment saved; refresh from GET /RequestEquipment/by-request failed.
        }
      }

      if (onSuccess) {
        onSuccess();
      } else if (isSingleMode) {
        navigate(-1);
      }
    },
    [
      dispatch,
      pendingScheduleEdits,
      pendingGeneratePayload,
      localRequestSchedules,
      requestSchedules,
      formData.notes,
      formData.comments,
      formData.startDate,
      formData.endDate,
      recurrenceRule.repeatUnit,
      isEditMode,
      initialData,
      vehicleItems,
      originalVehicles,
      equipmentItems,
      originalEquipment,
      pendingDeletedRequestEquipmentIds,
      onSuccess,
      isSingleMode,
      navigate,
      refreshRequestEquipmentFromApi,
    ]
  );

  finishRequestSaveRef.current = finishRequestSave;

  const handleConflictTransfer = useCallback(
    async (postPositionIds: string[], transferAll = false) => {
      const selectedIds = postPositionIds.map((id) => id.trim()).filter(Boolean);
      const allRowIds = (() => {
        const ids: string[] = [];
        const seen = new Set<string>();
        for (const row of dateChangeConflictRows) {
          const id = row.postPositionID?.trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          ids.push(id);
        }
        return ids;
      })();
      const ids = transferAll ? allRowIds : selectedIds;
      if (!pendingConflictUpsertPayload) return;
      if (ids.length === 0) {
        dispatch(showToast(REQUEST.ONE_TIME_DATE_CHANGE_CONFLICT.TRANSFER_SELECT_REQUIRED, 'error'));
        return;
      }

      setIsConflictTransferring(true);
      try {
        const payload = {
          ...pendingConflictUpsertPayload,
          transferWithConflictPostPositionIds: ids,
        };
        let requestId =
          'requestID' in payload && payload.requestID
            ? payload.requestID
            : savedRequestID || initialData?.requestID;

        if ('requestID' in payload && payload.requestID) {
          await dispatch(upsertRequestThunk(payload)).unwrap();
        } else {
          const result = await dispatch(
            upsertRequestThunk({ request: payload as CreateRequestRequest })
          ).unwrap();
          requestId = result.requestID;
          setSavedRequestID(requestId);
        }

        if (!requestId) throw new Error('Failed to get Request ID');

        setDateChangeConflictOpen(false);
        setPendingConflictUpsertPayload(null);
        setDateChangeConflictRows([]);
        await finishRequestSaveRef.current(requestId);
      } catch (error) {
        const conflict = parseRequestOneTimeDateChangeRejection(error);
        if (conflict) {
          setDateChangeConflictMessage(conflict.message);
          setDateChangeConflictRows(conflict.assignedPostPositions);
          return;
        }
      } finally {
        setIsConflictTransferring(false);
      }
    },
    [dispatch, dateChangeConflictRows, pendingConflictUpsertPayload, savedRequestID, initialData?.requestID]
  );

  const initDelete = (item: RequestEquipmentDto) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSchedule = async () => {
    if (!schedulePendingDelete) return;
    if (schedulePendingDelete.isLocal) {
      setLocalRequestSchedules((prev) => prev.filter((schedule) => schedule.localId !== schedulePendingDelete.id));
      setSchedulePendingDelete(null);
      return;
    }
    const deletedId = schedulePendingDelete.id;
    const lastRowOnLaterPage = pagedRequestSchedules.length <= 1 && schedulePage > 1;
    try {
      await dispatch(deleteRequestScheduleThunk(deletedId)).unwrap();
      setPendingScheduleEdits((prev) => removePendingScheduleEdit(prev, deletedId));
      setRequestSchedules((current) => current.filter((schedule) => schedule.requestScheduleID !== deletedId));
      if (lastRowOnLaterPage) setSchedulePage((page) => Math.max(1, page - 1));
      setScheduleListVersion((version) => version + 1);
    } catch {
      // Toast handled in thunk.
    }
    setSchedulePendingDelete(null);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      if (itemToDelete.requestEquipmentID) {
        try {
          await dispatch(deleteRequestEquipmentThunk(itemToDelete.requestEquipmentID)).unwrap();
        } catch (error) {
          console.error("Failed to delete request equipment:", error);
        }
      }
      handleLocalDelete(itemToDelete);
    }
    setItemToDelete(null);
    setIsDeleteModalOpen(false);
  };

  return (
    <SMSBox component="div" className={`app-form request-form ${className}`.trim()}>
      {currentStep === STEPS.VEHICLES && ' - Vehicles'}
      {currentStep === STEPS.EQUIPMENT && ' - Equipment'}

      {
        currentStep === STEPS.DETAILS && (
          <SMSBox component="div" className="request-form__step-1">
            {/* Step 1: Basic Information & Request Details */}
            <SMSBox component="div" className="app-form__section">
              <SMSBox component="div" className="app-form__row">
                <SMSTextField
                  label={REQUEST.FORM.TITLE}
                  value={formData.title}
                  onChange={(e) => handleChange(FIELD_NAMES.TITLE, e.target.value)}
                  placeholder={REQUEST.FORM.TITLE_PLACEHOLDER}
                  helperText={errors.title}
                  error={Boolean(errors.title)}
                  name={FIELD_NAMES.TITLE}
                  id={FIELD_NAMES.TITLE}
                  disabled={isLoading}
                  required
                  fullWidth
                />
              </SMSBox>
              {isEditMode ? (
                <SMSBox component="div" className="app-form__row">
                  <SMSTextField
                    label="Project Number"
                    value={initialData?.projectNumber ?? ''}
                    placeholder="-"
                    name="projectNumber"
                    id="projectNumber"
                    disabled
                    fullWidth
                  />
                </SMSBox>
              ) : null}
              {/* First Row: Requester, Is Tenure Based Request, Is Post Contact, Link to Parent - same padding-top for alignment */}
              <SMSBox component="div" className="app-form__row request-form__row-requester-checkboxes">
                <SMSBox component="div" className="app-form__row">
                  {(isEditMode || !requesterId) ? (
                    <SMSBox component="div">
                      <SMSDropdown
                        label={REQUEST.FORM.REQUESTER}
                        options={requesterOptions}
                        value={formData.requesterID}
                        onChange={isEditMode ? () => {} : (e) => handleRequesterChange(e.target.value as string)}
                        placeholder="Select a Requester"
                        id="requester-select"
                        disabled={isEditMode || isLoading}
                        clearable
                        serverSideSearch
                        onSearchInputChange={handleRequesterSearchInputChange}
                        noOptionsText="No requesters found"
                        helperText={requesterError}
                        error={Boolean(requesterError)}
                        required={!isEditMode}
                        fullWidth
                      />
                    </SMSBox>
                  ) : null}
                  <SMSStack
                    direction="row"
                    spacing={1}
                    className="app-form__field request-form__requester-cell"
                    sx={{ alignSelf: 'center', flexWrap: 'wrap' }}
                  >
                    <SMSCheckbox
                      id={FIELD_NAMES.ENABLE_WAITING_LIST}
                      label={REQUEST.FORM.ENABLE_WAITING_LIST}
                      checked={formData.enableWaitingList}
                      onChange={(checked) => handleChange(FIELD_NAMES.ENABLE_WAITING_LIST, checked)}
                      disabled={isLoading}
                      className="app-form__checkbox-label"
                    />
                    <SMSCheckbox
                      id={FIELD_NAMES.IS_POST_CONTACT}
                      label={REQUEST.FORM.IS_POST_CONTACT}
                      checked={formData.isPostContact}
                      onChange={(checked) => handleChange(FIELD_NAMES.IS_POST_CONTACT, checked)}
                      disabled={isLoading}
                      className="app-form__checkbox-label"
                    />
                  </SMSStack>
                  {showRequesterManagerDropdown ? (
                    <SMSDropdown
                      label={REQUEST.FORM.REQUESTER_MANAGER}
                      options={requesterManagerOptions}
                      value={formData.requesterManagerID || ''}
                      onChange={(e) =>
                        handleChange(
                          FIELD_NAMES.REQUESTER_MANAGER_ID,
                          (e.target.value as string) || null
                        )
                      }
                      placeholder={REQUEST.FORM.REQUESTER_MANAGER_PLACEHOLDER}
                      disabled={isLoading}
                      name={FIELD_NAMES.REQUESTER_MANAGER_ID}
                      id={FIELD_NAMES.REQUESTER_MANAGER_ID}
                      fullWidth
                      serverSideSearch
                      clearable
                      onSearchInputChange={handleRequesterManagerSearchInputChange}
                      noOptionsText="No requester managers found"
                    />
                  ) : null}
                  {showRequesterAuthorizedDropdown ? (
                    <SMSDropdown
                      label="Requester Authorized"
                      options={requesterAuthorizedOptions}
                      value={formData.requesterAuthorizedID || ''}
                      onChange={(e) => handleRequesterAuthorizedChange((e.target.value as string) || null)}
                      placeholder="Select Authorized Requester"
                      id="requester-authorized-select"
                      disabled={isLoading}
                      fullWidth
                      serverSideSearch
                      clearable
                      onSearchInputChange={handleRequesterAuthorizedSearchInputChange}
                      noOptionsText="No authorized requesters found"
                    />
                  ) : null}
                </SMSBox>

                {/* Second Row: Department Response Area, Post Locations Are Stationary (checkbox), Location */}
                <SMSDropdown
                  label="Department Response Area"
                  options={departmentResponseAreaDropdownOptions}
                  value={formData.DepartmentResponseAreaId || ''}
                  onChange={(e) => {
                    const value = e.target.value as string;
                    const selectedValue = value && value.trim() !== '' ? value : null;
                    handleChange('DepartmentResponseAreaId', selectedValue);
                  }}
                  placeholder={REQUEST.FORM.DEPARTMENT_RESPONSE_AREA_PLACEHOLDER}
                  disabled={isLoading}
                  name="DepartmentResponseAreaId"
                  id="DepartmentResponseAreaId"
                  fullWidth
                  serverSideSearch
                  clearable
                  onSearchInputChange={handleDepartmentResponseAreaSearchInputChange}
                  noOptionsText="No response areas found"
                />
                <SMSBox component="div" className="app-form__field" sx={{ alignSelf: 'center' }}>
                  <SMSCheckbox
                    id={FIELD_NAMES.POST_LOCATIONS_ARE_STATIONARY}
                    label={REQUEST.FORM.POST_LOCATIONS_ARE_STATIONARY}
                    checked={formData.postLocationsAreStationary}
                    onChange={(checked) => handleChange(FIELD_NAMES.POST_LOCATIONS_ARE_STATIONARY, checked)}
                    disabled={isLoading}
                    className="app-form__checkbox-label"
                  />
                </SMSBox>
                <SMSTextField
                  label={REQUEST.FORM.LOCATION}
                  value={formData.location}
                  onChange={(e) => handleChange(FIELD_NAMES.LOCATION, e.target.value)}
                  placeholder={REQUEST.FORM.LOCATION_PLACEHOLDER}
                  helperText={errors.location}
                  error={Boolean(errors.location)}
                  name={FIELD_NAMES.LOCATION}
                  id={FIELD_NAMES.LOCATION}
                  disabled={isLoading}
                  required
                  fullWidth
                />
              </SMSBox>
              <SMSBox component="div" className="app-form__row app-form__row--compact">
                <SMSTextField
                  label={REQUEST.FORM.ADDRESS}
                  value={formData.address}
                  onChange={(e) => handleChange(FIELD_NAMES.ADDRESS, e.target.value)}
                  placeholder={REQUEST.FORM.ADDRESS_PLACEHOLDER}
                  helperText={errors.address}
                  error={Boolean(errors.address)}
                  name={FIELD_NAMES.ADDRESS}
                  id={FIELD_NAMES.ADDRESS}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  label={REQUEST.FORM.CITY}
                  value={formData.city}
                  onChange={(e) => handleChange(FIELD_NAMES.CITY, e.target.value)}
                  placeholder={REQUEST.FORM.CITY_PLACEHOLDER}
                  helperText={errors.city}
                  error={Boolean(errors.city)}
                  name={FIELD_NAMES.CITY}
                  id={FIELD_NAMES.CITY}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  label={REQUEST.FORM.STATE}
                  value={formData.state}
                  onChange={(e) => handleChange(FIELD_NAMES.STATE, e.target.value)}
                  placeholder={REQUEST.FORM.STATE_PLACEHOLDER}
                  helperText={errors.state}
                  error={Boolean(errors.state)}
                  name={FIELD_NAMES.STATE}
                  id={FIELD_NAMES.STATE}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  label={REQUEST.FORM.ZIP}
                  value={formData.zip}
                  onChange={(e) =>
                    handleChange(FIELD_NAMES.ZIP, e.target.value.replace(/\D/g, ''))
                  }
                  placeholder={REQUEST.FORM.ZIP_PLACEHOLDER}
                  helperText={errors.zip}
                  error={Boolean(errors.zip)}
                  name={FIELD_NAMES.ZIP}
                  id={FIELD_NAMES.ZIP}
                  disabled={isLoading}
                  required
                  fullWidth
                  inputProps={{ inputMode: 'numeric', maxLength: 10, pattern: '[0-9]*' }}
                />
              </SMSBox>
              <SMSBox component="div" className="app-form__row app-form__row--compact">
                {/* Single row: Request Type + Start + End + Release As + empty slot */}
                <SMSBox component="div" className="request-form__request-type-dates-row">
                  <SMSBox component="div" className="app-form__field request-form__request-type">
                    <SMSDropdown
                      label={REQUEST.FORM.REQUEST_TYPE}
                      options={RECURRENCE_TYPE_OPTIONS}
                      value={selectedType}
                      onChange={(e) => handleTypeChange(e.target.value as string)}
                      placeholder={REQUEST.FORM.REQUEST_TYPE_PLACEHOLDER}
                      disabled={isLoading}
                      helperText={errors.requestType}
                      error={Boolean(errors.requestType)}
                      name={FIELD_NAMES.REQUEST_TYPE}
                      id={FIELD_NAMES.REQUEST_TYPE}
                      required
                      fullWidth
                    />
                  </SMSBox>
                  <SMSBox component="div" className="app-form__field request-form__start-date-field">
                    <SMSDatePicker
                      label={REQUEST.FORM.START_DATE}
                      id={FIELD_NAMES.START_DATE}
                      value={formData.startDate}
                      onChange={(value) => handleChange(FIELD_NAMES.START_DATE, value)}
                      placeholder={REQUEST.FORM.START_DATE}
                      error={errors.startDate}
                      disabled={isLoading}
                      required
                      shouldDisableDate={disableStartDateBeforeOneMonth}
                    />
                  </SMSBox>
                  <SMSBox component="div" className="app-form__field">
                    <SMSDatePicker
                      label={REQUEST.FORM.END_DATE}
                      id={FIELD_NAMES.END_DATE}
                      value={formData.endDate}
                      onChange={(value) => handleChange(FIELD_NAMES.END_DATE, value)}
                      placeholder={REQUEST.FORM.END_DATE}
                      error={errors.endDate}
                      disabled={isLoading || selectedType === 'NONE'}
                      required
                      minDate={mainFormEndMinDate}
                    />
                  </SMSBox>
                  <SMSBox component="div" className="app-form__field">
                    <SMSDropdown
                      label={REQUEST.FORM.RELEASE_AS}
                      options={releaseAsDropdownOptions}
                      value={String(formData.releaseAs ?? ReleaseAs.Open)}
                      onChange={(e) => handleChange(FIELD_NAMES.RELEASE_AS, parseInt(e.target.value as string, 10) as ReleaseAs)}
                      placeholder={REQUEST.FORM.RELEASE_AS}
                      disabled={isLoading}
                      name={FIELD_NAMES.RELEASE_AS}
                      id={FIELD_NAMES.RELEASE_AS}
                      fullWidth
                    />
                  </SMSBox>
                  <SMSBox
                    component="div"
                    className="app-form__field request-form__generate-schedule-field"
                  >
                    {showGenerateSchedule && (
                      <SMSButton
                        onClick={handleOpenGenerateRequestScheduleModal}
                        disabled={
                          recurrenceRule.repeatUnit === RecurrenceUnit.DAY ||
                          recurrenceRule.repeatUnit === RecurrenceUnit.NONE
                        }
                      >
                        {REQUEST.FORM.GENERATE_REQUEST_SCHEDULE}
                      </SMSButton>
                    )}
                  </SMSBox>
                </SMSBox>
                {/* Recurrence Options */}
                {(selectedType === 'WEEK' || selectedType === 'MONTH') && (
                  <RecurrenceOptions
                    rule={recurrenceRule}
                    onChange={(updates) => setRecurrenceRule(prev => ({ ...prev, ...updates }))}
                  />
                )}
              </SMSBox>
              {/* app-form__row is display: contents; use explicit full-width grid item wrapper */}
              <SMSBox component="div" sx={{ gridColumn: '1 / -1', width: '100%', mt: 1 }}>
                <SMSBox
                  sx={{
                    width: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <SMSBox
                    sx={{
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      flexWrap: 'nowrap',
                      alignItems: 'flex-end',
                      gap: 1.5,
                      width: '100%',
                      overflowX: 'auto',
                    }}
                  >
                    <SMSBox component="span" sx={{ fontWeight: 700, flexShrink: 0, pb: 1 }}>
                      {REQUEST.FORM.REQUEST_SCHEDULE}
                    </SMSBox>
                    <SMSBox sx={{ width: 168, flexShrink: 0, '& > .MuiBox-root': { marginTop: 0 } }}>
                      <SMSDatePicker
                        label={REQUEST.FORM.START_DATE}
                        id="schedule-filter-start"
                        value={scheduleFilter.start}
                        minDate={scheduleFilterMinStart(scheduleFilter.end)}
                        maxDate={scheduleFilter.end}
                        onChange={(value) => {
                          if (!isYyyyMmDdKey(value)) return;
                          setScheduleFilter((current) =>
                            clampScheduleFilterRange(value, current.end, 'start')
                          );
                          setSchedulePage(1);
                        }}
                      />
                    </SMSBox>
                    <SMSBox sx={{ width: 168, flexShrink: 0, '& > .MuiBox-root': { marginTop: 0 } }}>
                      <SMSDatePicker
                        label={REQUEST.FORM.END_DATE}
                        id="schedule-filter-end"
                        value={scheduleFilter.end}
                        minDate={scheduleFilter.start}
                        maxDate={scheduleFilterMaxEnd(scheduleFilter.start)}
                        onChange={(value) => {
                          if (!isYyyyMmDdKey(value)) return;
                          setScheduleFilter((current) =>
                            clampScheduleFilterRange(current.start, value, 'end')
                          );
                          setSchedulePage(1);
                        }}
                      />
                    </SMSBox>
                    <SMSBox
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        columnGap: 1.5,
                        flexShrink: 0,
                        marginLeft: 'auto',
                        pb: 1,
                      }}
                      aria-label="Schedule row color legend"
                    >
                      {(
                        [
                          {
                            label: REQUEST.FORM.SCHEDULE_ROW_COLOR_OLD,
                            sx: { bgcolor: '#f3d6dc' },
                          },
                          {
                            label: REQUEST.FORM.SCHEDULE_ROW_COLOR_ONGOING,
                            sx: { bgcolor: '#f3d7b0' },
                          },
                          {
                            label: REQUEST.FORM.SCHEDULE_ROW_COLOR_FUTURE,
                            sx: { bgcolor: '#d9efd4' },
                          },
                        ] as const
                      ).map(({ label, sx: swatchSx }) => (
                        <SMSBox
                          key={label}
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
                        >
                          <SMSBox
                            component="span"
                            aria-hidden
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '3px',
                              flexShrink: 0,
                              ...swatchSx,
                            }}
                          />
                          <SMSTypography
                            component="span"
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.2, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
                          >
                            {label}
                          </SMSTypography>
                        </SMSBox>
                      ))}
                    </SMSBox>
                    <SMSBox
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flexShrink: 0,
                        pb: 0.25,
                      }}
                    >
                      <SMSSegmentedStatusFilter
                        value={scheduleStatusFilter}
                        onChange={(v) => {
                          if (v === 'active' || v === 'inactive') {
                            setScheduleStatusFilter(v);
                            setSchedulePage(1);
                          }
                        }}
                        activeLabel={REQUEST.FORM.ACTIVE}
                        inactiveLabel={REQUEST.FORM.INACTIVE}
                        allowClear={false}
                        disabled={isRequestScheduleStatusFilterDisabled}
                        ariaLabel="Request schedule status filter"
                      />
                      <SMSButton
                        onClick={handleOpenAddRequestScheduleModal}
                        disabled={isRequestScheduleAddDisabled}
                      >
                        {`+ ${REQUEST.FORM.ADD_REQUEST_SCHEDULE}`}
                      </SMSButton>
                    </SMSBox>
                  </SMSBox>
                  <SMSBox sx={{ width: '100%' }}>
                    <SMSDataTableWrapper
                      embedded
                      tableClassName="request-form__schedule-table"
                      columns={requestScheduleColumns}
                      data={savedRequestID ? serverScheduleRows : filteredRequestScheduleRows}
                      getRowClassName={getRequestScheduleRowClassName}
                      showHeaderWhenEmpty
                      pagination={{
                        serverSide: Boolean(savedRequestID),
                        currentPage: schedulePage,
                        pageSize: schedulePageSize,
                        totalItems: savedRequestID ? scheduleServerTotal : filteredRequestScheduleRows.length,
                        onPageChange: setSchedulePage,
                        onPageSizeChange: (size) => {
                          setSchedulePageSize(size);
                          setSchedulePage(1);
                        },
                      }}
                    />
                    {errors.requestSchedules && (
                      <SMSTypography
                        component="div"
                        variant="caption"
                        sx={{ color: 'error.main', mt: 1, fontWeight: 500 }}
                      >
                        {errors.requestSchedules}
                      </SMSTypography>
                    )}
                  </SMSBox>
                </SMSBox>
              </SMSBox>

              <SMSRequestScheduleModal
                key={
                  isRequestScheduleModalOpen
                    ? `${editingRequestScheduleId ?? 'new'}|${scheduleModalInitialDraft.startDate}|${scheduleModalInitialDraft.endDate}`
                    : 'closed'
                }
                open={isRequestScheduleModalOpen}
                onClose={closeRequestScheduleModal}
                onSave={persistRequestSchedule}
                initialDraft={scheduleModalInitialDraft}
                selectedType={selectedType}
                boundStartDate={formData.startDate}
                boundEndDate={formData.endDate}
                addScheduleStartMinDate={addScheduleStartMinDate}
                otherScheduleRanges={otherScheduleRangesForOverlap}
                today={today}
                minProcessDate={minProcessDate}
                isLoading={isLoading}
                requestSchedulesLoading={requestSchedulesLoading}
                releaseAsDropdownOptions={releaseAsDropdownOptions}
                parentFieldErrors={{ startDate: errors.startDate, endDate: errors.endDate }}
                isEditing={Boolean(editingRequestScheduleId)}
              />

              <GenerateRequestScheduleModal
                open={isGenerateScheduleModalOpen}
                onClose={closeGenerateRequestScheduleModal}
                onGenerate={handleGenerateSchedules}
                requestType={selectedType}
                releaseAs={formData.releaseAs ?? ReleaseAs.Open}
                startDate={formData.startDate}
                endDate={formData.endDate}
                initialDaysOfWeek={recurrenceRule.weekDays ?? []}
                initialDaysOfMonth={recurrenceRule.monthDays ?? []}
                initialMonthlyMode={recurrenceRule.monthlyMode ?? MonthlyMode.BY_DATE}
                initialWeekIndex={recurrenceRule.weekIndex ?? 1}
                requestId={savedRequestID}
                workDaysOfWeek={recurrenceRule.weekDays ?? []}
                weekStartsOn={departmentConfig?.onDutyStartDayOfWeek ?? 0}
                isLoading={isLoading || requestSchedulesLoading}
              />

              {/* Contact row: name, email, phones */}
              <SMSBox component="div" className="app-form__row app-form__row--compact request-form__contact-row">
                <SMSTextField
                  label={REQUEST.FORM.FIRST_NAME}
                  value={formData.firstName}
                  onChange={(e) => handleChange(FIELD_NAMES.FIRST_NAME, e.target.value)}
                  placeholder={REQUEST.FORM.FIRST_NAME_PLACEHOLDER}
                  helperText={errors.firstName}
                  error={Boolean(errors.firstName)}
                  name={FIELD_NAMES.FIRST_NAME}
                  id={FIELD_NAMES.FIRST_NAME}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  label={REQUEST.FORM.LAST_NAME}
                  value={formData.lastName}
                  onChange={(e) => handleChange(FIELD_NAMES.LAST_NAME, e.target.value)}
                  placeholder={REQUEST.FORM.LAST_NAME_PLACEHOLDER}
                  helperText={errors.lastName}
                  error={Boolean(errors.lastName)}
                  name={FIELD_NAMES.LAST_NAME}
                  id={FIELD_NAMES.LAST_NAME}
                  disabled={isLoading}
                  required
                  fullWidth
                />

                <SMSTextField
                  type="email"
                  label={REQUEST.FORM.PRIMARY_EMAIL}
                  value={formData.primaryEmail || ''}
                  onChange={(e) => handleChange(FIELD_NAMES.PRIMARY_EMAIL, e.target.value)}
                  placeholder={REQUEST.FORM.PRIMARY_EMAIL_PLACEHOLDER}
                  helperText={errors.primaryEmail}
                  error={Boolean(errors.primaryEmail)}
                  name={FIELD_NAMES.PRIMARY_EMAIL}
                  id={FIELD_NAMES.PRIMARY_EMAIL}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  type="tel"
                  label={REQUEST.FORM.PRIMARY_PHONE}
                  value={formData.primaryPhone}
                  onChange={(e) => handleChange(FIELD_NAMES.PRIMARY_PHONE, formatPhoneNumber(e.target.value))}
                  placeholder={REQUEST.FORM.PRIMARY_PHONE_PLACEHOLDER}
                  helperText={errors.primaryPhone}
                  error={Boolean(errors.primaryPhone)}
                  name={FIELD_NAMES.PRIMARY_PHONE}
                  id={FIELD_NAMES.PRIMARY_PHONE}
                  disabled={isLoading}
                  required
                  fullWidth
                />
                <SMSTextField
                  type="tel"
                  label={REQUEST.FORM.CELL_PHONE}
                  value={formData.cellPhone || ''}
                  onChange={(e) => handleChange(FIELD_NAMES.CELL_PHONE, formatPhoneNumber(e.target.value))}
                  placeholder={REQUEST.FORM.CELL_PHONE_PLACEHOLDER}
                  name={FIELD_NAMES.CELL_PHONE}
                  id={FIELD_NAMES.CELL_PHONE}
                  disabled={isLoading}
                  fullWidth
                />
              </SMSBox>
              {/* Secondary Contact Info - Single checkbox to show/hide secondary fields and control whether they are sent in request */}
              <SMSStack direction="row" spacing={2} className="app-form__row">
                <SMSBox component="div" className="app-form__field">
                  <SMSCheckbox
                    label={REQUEST.FORM.ADD_SECONDARY_CONTACT_INFO}
                    checked={showSecondaryContactInfo}
                    onChange={(checked) => {
                      setShowSecondaryContactInfo(checked);
                    }}
                    disabled={isLoading}
                    className="app-form__checkbox-label"
                  />
                </SMSBox>
              </SMSStack>
              {showSecondaryContactInfo && (
                <SMSStack direction="row" spacing={2} className="app-form__row request-form__row-3col" sx={{ flexWrap: 'wrap' }}>
                  <SMSTextField
                    type="email"
                    label={REQUEST.FORM.SECONDARY_EMAIL}
                    value={formData.secondaryEmail || ''}
                    onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_EMAIL, e.target.value)}
                    placeholder={REQUEST.FORM.SECONDARY_EMAIL_PLACEHOLDER}
                    helperText={errors.secondaryEmail}
                    error={Boolean(errors.secondaryEmail)}
                    name={FIELD_NAMES.SECONDARY_EMAIL}
                    id={FIELD_NAMES.SECONDARY_EMAIL}
                    disabled={isLoading}
                    fullWidth
                  />
                  <SMSTextField
                    type="tel"
                    label={REQUEST.FORM.SECONDARY_PHONE}
                    value={formData.secondaryPhone || ''}
                    onChange={(e) => handleChange(FIELD_NAMES.SECONDARY_PHONE, formatPhoneNumber(e.target.value))}
                    placeholder={REQUEST.FORM.SECONDARY_PHONE_PLACEHOLDER}
                    name={FIELD_NAMES.SECONDARY_PHONE}
                    id={FIELD_NAMES.SECONDARY_PHONE}
                    disabled={isLoading}
                    fullWidth
                  />
                  <SMSTextField
                    type="tel"
                    label={REQUEST.FORM.ALTERNATE_CELL_PHONE}
                    value={formData.alternateCellPhone || ''}
                    onChange={(e) => handleChange(FIELD_NAMES.ALTERNATE_CELL_PHONE, formatPhoneNumber(e.target.value))}
                    placeholder={REQUEST.FORM.ALTERNATE_CELL_PHONE_PLACEHOLDER}
                    name={FIELD_NAMES.ALTERNATE_CELL_PHONE}
                    id={FIELD_NAMES.ALTERNATE_CELL_PHONE}
                    disabled={isLoading}
                    fullWidth
                  />
                </SMSStack>
              )}
            </SMSBox>

            {/* Requirements Section */}
            <SMSBox component="div" className="app-form__section">
              <SMSTypography variant="subtitle1" component="div" className="app-form__section-title">{REQUEST.SECTIONS.REQUIREMENTS}</SMSTypography>

              <SMSBox component="div" className="request-form__split-container">
                {/* Left Panel: Checkboxes */}
                <SMSBox component="div" className="request-form__left-panel">
                  <SMSStack direction="column" spacing={0} className="request-form__checkboxes--vertical">
                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.IS_SPECIAL_EVENT}
                        label={REQUEST.FORM.IS_SPECIAL_EVENT}
                        checked={formData.isSpecialEvent}
                        onChange={(checked) => handleChange(FIELD_NAMES.IS_SPECIAL_EVENT, checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>
                    {formData.isSpecialEvent && (
                      <SMSBox component="div" className="app-form__form-checkbox" sx={{ marginLeft: '1.5rem' }}>
                        <SMSCheckbox
                          id={FIELD_NAMES.APPROVAL_REQUIRED}
                          label={REQUEST.FORM.APPROVAL_REQUIRED}
                          checked={formData.specialEventApproved}
                          onChange={(checked) => handleChange(FIELD_NAMES.APPROVAL_REQUIRED, checked)}
                          disabled={isLoading}
                          className="app-form__checkbox-label"
                        />
                      </SMSBox>
                    )}

                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.REQUIRES_VEHICLE}
                        label={REQUEST.FORM.REQUIRES_VEHICLE}
                        checked={formData.requiresVehicle}
                        onChange={(checked) => handleChange(FIELD_NAMES.REQUIRES_VEHICLE, checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>

                    {isDepartmentEquipmentEnabled && (
                      <SMSBox component="div" className="app-form__form-checkbox">
                        <SMSCheckbox
                          id={FIELD_NAMES.REQUIRES_EQUIPMENT}
                          label={REQUEST.FORM.REQUIRES_EQUIPMENT}
                          checked={formData.requiresEquipment}
                          onChange={(checked) => handleChange(FIELD_NAMES.REQUIRES_EQUIPMENT, checked)}
                          disabled={isLoading}
                          className="app-form__checkbox-label"
                        />
                      </SMSBox>
                    )}
                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.IS_SKILL_REQUIRED}
                        label={REQUEST.FORM.IS_SKILL_REQUIRED}
                        checked={formData.isSkillRequired}
                        onChange={(checked) => handleChange(FIELD_NAMES.IS_SKILL_REQUIRED, checked)}
                        disabled={isLoading || requesterLockedSkillIDs.length > 0}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>
                                        <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.REQUIRES_PERMIT}
                        label={REQUEST.FORM.REQUIRES_PERMIT}
                        checked={formData.requiresPermit}
                        onChange={(checked) => handleChange(FIELD_NAMES.REQUIRES_PERMIT, checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>

                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.REQUIRES_LIQUOR_LICENSE}
                        label={REQUEST.FORM.REQUIRES_LIQUOR_LICENSE}
                        checked={formData.requiresLiquorLicense}
                        onChange={(checked) => handleChange(FIELD_NAMES.REQUIRES_LIQUOR_LICENSE, checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>
                    {isLiquorLicenseTrackingEnabled && formData.requiresLiquorLicense && (
                      <SMSBox component="div" className="app-form__form-checkbox" sx={{ marginLeft: '1.5rem' }}>
                        <SMSCheckbox
                          id={FIELD_NAMES.ALCOHOL_PERMIT_REQUIRED}
                          label={REQUEST.FORM.ALCOHOL_PERMIT_REQUIRED}
                          checked={formData.alcoholPermitRequired ?? false}
                          onChange={(checked) => handleChange(FIELD_NAMES.ALCOHOL_PERMIT_REQUIRED, checked)}
                          disabled={isLoading}
                          className="app-form__checkbox-label"
                        />
                      </SMSBox>
                    )}

                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id={FIELD_NAMES.IS_PREMIUM_PAID_EVENT}
                        label={REQUEST.FORM.IS_PREMIUM_PAID_EVENT}
                        checked={formData.isPremiumPaidEvent}
                        onChange={(checked) => handleChange(FIELD_NAMES.IS_PREMIUM_PAID_EVENT, checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>

                    <SMSBox component="div" className="app-form__form-checkbox">
                      <SMSCheckbox
                        id="enableFees"
                        label={REQUEST_FORM.FORM.ENABLE_FEES}
                        checked={formData.enableFees ?? true}
                        onChange={(checked) => handleChange('enableFees', checked)}
                        disabled={isLoading}
                        className="app-form__checkbox-label"
                      />
                    </SMSBox>

                  </SMSStack>
                </SMSBox>

                {/* Schedule Date and Time fields - show when request status is ReleasedOn */}
                {formData.requestStatus === RequestStatus.ReleasedOn && (
                  <SMSBox component="div" className="app-form__row app-form__row--compact">
                    <SMSBox component="div" className="app-form__field">
                      <SMSDatePicker
                        label={REQUEST.FORM.SCHEDULE_DATE}
                        id={FIELD_NAMES.SCHEDULE_DATE}
                        value={formData.scheduleDate}
                        onChange={(value) => handleChange(FIELD_NAMES.SCHEDULE_DATE, value)}
                        placeholder={REQUEST.FORM.SCHEDULE_DATE}
                        disabled={isLoading}
                        required={formData.requestStatus === RequestStatus.ReleasedOn}
                        name={FIELD_NAMES.SCHEDULE_DATE}
                        error={errors.scheduleDate}
                        minDate={today}
                      />
                    </SMSBox>
                    <SMSBox component="div" className="app-form__field">
                      <SMSTimePicker
                        label={REQUEST.FORM.SCHEDULE_TIME}
                        value={formatTimeToHHmm(formData.scheduledTime)}
                        onChange={(value) => {
                          handleChange(FIELD_NAMES.SCHEDULE_TIME, value);
                          if (value && errors.scheduledTime) {
                            setErrors((prev) => ({ ...prev, scheduledTime: undefined }));
                          }
                        }}
                        placeholder={REQUEST.FORM.SCHEDULE_TIME}
                        disabled={isLoading}
                        required={formData.requestStatus === RequestStatus.ReleasedOn}
                        name={FIELD_NAMES.SCHEDULE_TIME}
                        id={FIELD_NAMES.SCHEDULE_TIME}
                        error={errors.scheduledTime}
                        fullWidth
                      />
                    </SMSBox>
                  </SMSBox>
                )}

                {/* Right Panel: Tabs (no longer shown for Special Event approval alone) */}
                {(formData.requiresVehicle || (isDepartmentEquipmentEnabled && formData.requiresEquipment) || formData.requiresPermit || formData.requiresLiquorLicense || formData.isSkillRequired || formData.enableFees) && (
                  <SMSBox component="div" className="request-form__right-panel">
                    <SMSContentTabs
                      keepMounted
                      tabs={[
                        ...(formData.requiresPermit ? [{
                          id: 'permit',
                          label: 'Permit',
                          hasError: hasAttemptedSubmit && !!(errors as any).permitNumber,
                          content: (
                            <SMSBox component="div" className="request-form__tab-content">
                              <SMSStack direction="row" spacing={2} className="app-form__row" sx={{ flexWrap: 'wrap' }}>
                                <SMSTextField
                                  label="Permit Number"
                                  value={formData.permitNumber || ''}
                                  onChange={(e) => handleChange(FIELD_NAMES.PERMIT_NUMBER, e.target.value)}
                                  placeholder="Enter Permit Number"
                                  disabled={isLoading}
                                  name={FIELD_NAMES.PERMIT_NUMBER}
                                  id={FIELD_NAMES.PERMIT_NUMBER}
                                  helperText={errors.permitNumber}
                                  error={Boolean(errors.permitNumber)}
                                  required
                                  fullWidth
                                />
                              </SMSStack>
                            </SMSBox>
                          )
                        }] : []),
                        ...(formData.requiresLiquorLicense ? [{
                          id: 'liquorLicense',
                          label: 'Liquor License',
                          hasError:
                            hasAttemptedSubmit &&
                            (!!(errors as any).liquorLicenseNumber || !!(errors as any).specialRate),
                          content: (
                            <SMSBox component="div" className="request-form__tab-content" sx={{ width: '100%' }}>
                              <SMSStack direction="column" spacing={2} sx={{ width: '100%' }}>
                                <SMSTextField
                                  label="Liquor License Number"
                                  value={formData.liquorLicenseNumber || ''}
                                  onChange={(e) => handleChange(FIELD_NAMES.LIQUOR_LICENSE_NUMBER, e.target.value)}
                                  placeholder="Enter Liquor License Number"
                                  disabled={isLoading}
                                  name={FIELD_NAMES.LIQUOR_LICENSE_NUMBER}
                                  id={FIELD_NAMES.LIQUOR_LICENSE_NUMBER}
                                  helperText={errors.liquorLicenseNumber}
                                  error={Boolean(errors.liquorLicenseNumber)}
                                  required
                                  fullWidth
                                />
                                {isLiquorLicenseTrackingEnabled && formData.alcoholPermitRequired && (
                                  <SMSCurrencyInput
                                    label={REQUEST.FORM.LIQUOR_LICENSE_RATE}
                                    value={formData.specialRate ?? DEFAULT_SPECIAL_RATE}
                                    onChange={(value) => handleChange(FIELD_NAMES.SPECIAL_RATE, value ?? 0)}
                                    placeholder={REQUEST.FORM.LIQUOR_LICENSE_RATE_PLACEHOLDER}
                                    disabled={isLoading}
                                    name={FIELD_NAMES.SPECIAL_RATE}
                                    id={FIELD_NAMES.SPECIAL_RATE}
                                    helperText={errors.specialRate}
                                    error={Boolean(errors.specialRate)}
                                    required
                                    fullWidth
                                  />
                                )}
                              </SMSStack>
                            </SMSBox>
                          )
                        }] : []),
                        ...(formData.requiresVehicle ? [{
                          id: 'vehicle',
                          label: 'Vehicles',
                          hasError: hasAttemptedSubmit && !!(errors as any).vehicles,
                          content: (
                            <SMSBox component="div" className="request-form__tab-content" sx={{ width: '100%' }}>
                              <SMSStack direction="row" spacing={2} className="app-form__row" sx={{ flexWrap: 'wrap', width: '100%' }}>
                                {errors.vehicles && (
                                  <SMSTypography component="div" className="app-form__error-message" sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}>
                                    {errors.vehicles}
                                  </SMSTypography>
                                )}
                                <RequestEquipmentList
                                key="request-vehicles"
                                items={vehicleItems}
                                onItemsChange={(items) => {
                                  setVehicleItems(items);
                                  if (items.length > 0 && errors.vehicles) {
                                    setErrors(prev => ({ ...prev, vehicles: undefined }));
                                  }
                                }}
                                departmentId={user?.departmentID}
                                disabled={isLoading}
                                type='vehicle'
                                title="Vehicles"
                                requestStartDate={formData.startDate}
                                requestEndDate={formData.endDate}
                                onSaveItem={undefined} // Local state only
                                onDeleteItem={initDelete}
                                />
                              </SMSStack>
                            </SMSBox>
                          )
                        }] : []),
                        ...(isDepartmentEquipmentEnabled && formData.requiresEquipment ? [{
                          id: 'equipment',
                          label: 'Equipment',
                          hasError: hasAttemptedSubmit && !!(errors as any).equipment,
                          content: (
                            <SMSBox component="div" className="request-form__tab-content" sx={{ width: '100%' }}>
                              <SMSStack direction="row" spacing={2} className="app-form__row" sx={{ flexWrap: 'wrap', width: '100%' }}>
                                {errors.equipment && (
                                  <SMSTypography component="div" className="app-form__error-message" sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}>
                                    {errors.equipment}
                                  </SMSTypography>
                                )}
                                <RequestEquipmentList
                                key="request-equipment"
                                items={equipmentItems}
                                onItemsChange={(items) => {
                                  setEquipmentItems(items);
                                  if (items.length > 0 && errors.equipment) {
                                    setErrors(prev => ({ ...prev, equipment: undefined }));
                                  }
                                }}
                                departmentId={user?.departmentID}
                                disabled={isLoading}
                                type='equipment'
                                title="Equipment"
                                requestStartDate={formData.startDate}
                                requestEndDate={formData.endDate}
                                onSaveItem={undefined} // Local state only
                                onDeleteItem={initDelete}
                                />
                              </SMSStack>
                            </SMSBox>
                          )
                        }] : []),
                        ...(formData.isSkillRequired ? [{
                          id: 'skills',
                          label: 'Skills',
                          hasError: hasAttemptedSubmit && !!(errors as any).skillIDs,
                          content: (
                            <SMSBox component="div" className="request-form__tab-content" sx={{ width: '100%' }}>
                              <SMSStack direction="row" spacing={2} className="app-form__row" sx={{ flexWrap: 'wrap', width: '100%' }}>
                                {errors.skillIDs && (
                                  <SMSTypography component="div" className="app-form__error-message" sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}>
                                    {errors.skillIDs}
                                  </SMSTypography>
                                )}
                                <SMSMultiSelectDropdown
                                  id="skillDropdown"
                                  label={REQUEST.FORM.SKILL_IDS}
                                  options={skillOptions}
                                  value={formData.skillIDs || []}
                                  onChange={(selectedValues) => {
                                    const skillIds = selectedValues.map(String);
                                    handleChange(FIELD_NAMES.SKILL_IDS, skillIds);
                                    if (selectedValues.length > 0 && errors.skillIDs) {
                                      setErrors((prev) => ({ ...prev, skillIDs: undefined }));
                                    }
                                  }}
                                  lockedValues={requesterLockedSkillIDs}
                                  disabled={isLoading}
                                  required={formData.isSkillRequired}
                                  error={Boolean(errors.skillIDs)}
                                  helperText={errors.skillIDs}
                                  fullWidth
                                />
                              </SMSStack>
                            </SMSBox>
                          )
                        }] : []),
                        ...(formData.enableFees ? [{
                          id: 'fees',
                          label: REQUEST_FORM.FORM.SELECT_FEE,
                          hasError: hasAttemptedSubmit && !!errors.selectedDepartmentFeeIds,
                          content: (
                            <SMSBox component="div" className="request-form__tab-content" sx={{ width: '100%' }}>
                              {errors.selectedDepartmentFeeIds && (
                                <SMSTypography component="div" className="app-form__error-message" sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}>
                                  {errors.selectedDepartmentFeeIds}
                                </SMSTypography>
                              )}
                              <SMSMultiSelectDropdown
                                id="feeDropdown"
                                label={REQUEST_FORM.FORM.SELECT_FEE}
                                placeholder={REQUEST_FORM.FORM.SELECT_FEE_PLACEHOLDER}
                                options={departmentFeeOptions}
                                value={selectedFees.map((f) => f.departmentFeeId)}
                                onChange={(feeIds) => {
                                  handleFeeSelect(feeIds.map(String));
                                }}
                                disabled={isLoading || isLoadingFees}
                                required
                                error={Boolean(errors.selectedDepartmentFeeIds)}
                                helperText={errors.selectedDepartmentFeeIds}
                                fullWidth
                                showSelectedChips={false}
                              />
                              {selectedFees.length > 0 && (
                              <SMSDataTableWrapper
                                embedded
                                maxBodyHeight={280}
                                responsiveMode="table"
                                tableClassName="request-form__fees-table"
                                columns={[
                                  { key: 'title', label: 'Fee Name' },
                                  { key: 'feeType', label: 'Type', render: (_, row) => getFeeTypeLabel((row as RequestSelectionFeeDto).feeType) },
                                  { key: 'defaultFee', label: 'Default Fee', render: (_, row) => `$${(row as RequestSelectionFeeDto).defaultFee.toFixed(2)}` },
                                  { key: 'additionalFee', label: 'Additional Fee', render: (_, row) => `$${(row as RequestSelectionFeeDto).additionalFee.toFixed(2)}` },
                                  { key: 'reimburseTo', label: REQUEST_FORM.TABLE.FEES_COLUMNS.REIMBURSE_TO, render: (_, row) => getReimburseToLabel((row as RequestSelectionFeeDto).reimburseTo) },
                                  {
                                    key: 'action',
                                    label: 'Action',
                                    render: (_, row) => (
                                      <SMSDataTableActions
                                        onDelete={() => handleFeeRemove((row as RequestSelectionFeeDto).departmentFeeId)}
                                      />
                                    ),
                                  },
                                ]}
                                data={selectedFees}
                                showHeaderWhenEmpty
                              />
                              )}
                            </SMSBox>
                          )
                        }] : []),
                      ]}
                    />
                  </SMSBox>
                )}
              </SMSBox>

              {/* Additional Info (Department Fields) */}
              {canShowAdditionalFields && (
                <SMSBox component="div" className="app-form__full-width">
                  <SMSCheckbox
                    id="showAdditionalFields"
                    label="Show Additional Fields"
                    checked={showAdditionalFields}
                    onChange={(checked) => {
                      setShowAdditionalFields(checked);
                      if (!checked) {
                        setFormData((prev) => ({
                          ...prev,
                          ...getEmptyDepartmentDefinedFieldValues('request'),
                        }));
                      }
                    }}
                    disabled={isLoading}
                    className="app-form__checkbox-label request-form__additional-fields-checkbox"
                  />
                </SMSBox>
              )}

              {
                canShowAdditionalFields && showAdditionalFields && (
                  <SMSBox
                    component="div"
                    className="request-form__form-row request-form__form-row--5-columns"
                    sx={{ width: '100%' }}
                  >
                    {requestDeptFieldBindings.map((field) => (
                      <SMSTextField
                        key={field.valueFieldName}
                        label={field.label}
                        value={String(formData[field.valueFieldName as keyof RequestFormData] ?? '')}
                        onChange={(e) =>
                          handleChange(field.valueFieldName as keyof RequestFormData, e.target.value)
                        }
                        disabled={isLoading || departmentDefinedFieldsLoading}
                        fullWidth
                      />
                    ))}
                  </SMSBox>
                )
              }

              {/* Notes and Comments Fields - Only for Add Mode */}
              {!isEditMode && (
                <SMSGrid container spacing={3} className="app-form__full-width" sx={{ marginTop: '1rem' }}>
                  <SMSGrid item xs={12} md={6}>
                    <SMSBox component="div" className="app-form__field">
                      <SMSTextField
                        multiline
                        minRows={3}
                        label="Notes"
                        value={formData.notes || ''}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder="Enter any additional notes about this request..."
                        disabled={isLoading}
                        name="notes"
                        id="notes"
                        fullWidth
                      />
                    </SMSBox>
                  </SMSGrid>
                  <SMSGrid item xs={12} md={6}>
                    <SMSBox component="div" className="app-form__field">
                      <SMSTextField
                        multiline
                        minRows={3}
                        label="Comments"
                        value={formData.comments || ''}
                        onChange={(e) => handleChange('comments', e.target.value)}
                        placeholder="Enter any comments about this request..."
                        disabled={isLoading}
                        name="comments"
                        id="comments"
                        fullWidth
                      />
                    </SMSBox>
                  </SMSGrid>
                </SMSGrid>
              )}

              {/* Latest Notes and Comments Display - Only for Edit Mode */}
              {isEditMode && (
                <SMSGrid container className="app-form__full-width" sx={{ marginTop: '0.5rem' }}>
                  {isLoadingNotes ? (
                    <SMSGrid item xs={12}>
                      <SMSBox sx={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                        <SMSLoader loadingText="Loading notes..." aria-label="Loading notes..." />
                      </SMSBox>
                    </SMSGrid>
                  ) : latestNotes ? (
                    <SMSGrid item xs={12}>
                      <SMSGrid container spacing={3}>
                        <SMSGrid item xs={12} md={6}>
                          <SMSBox component="div" className="app-form__field">
                            <SMSLabel>Latest Note</SMSLabel>
                            <SMSBox component="div" sx={{
                              padding: '0.25rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                              minHeight: '10px',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word'
                            }}>
                              {latestNotes.notes || '-'}
                            </SMSBox>
                          </SMSBox>
                        </SMSGrid>
                        <SMSGrid item xs={12} md={6}>
                          <SMSBox component="div" className="app-form__field">
                            <SMSLabel>Note Comments</SMSLabel>
                            <SMSBox component="div" sx={{
                              padding: '0.25rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                              minHeight: '10px',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word'
                            }}>
                              {latestNotes.comments || '-'}
                            </SMSBox>
                          </SMSBox>
                        </SMSGrid>
                      </SMSGrid>
                    </SMSGrid>
                  ) : (
                    <SMSGrid item xs={12}>
                      <SMSTypography component="div" sx={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No notes available
                      </SMSTypography>
                    </SMSGrid>
                  )}
                </SMSGrid>
              )}
            </SMSBox>

            {isEditMode && initialData && (
              <SMSBox component="div" className="app-form__audit-footer">
                <span>
                  {REQUEST.TABLE.COLUMNS.CREATED_BY}: <strong>{initialData.createdBy || ''}</strong>
                  {initialData.createdDate && ` (${formatDate(initialData.createdDate)} ${formatTime(initialData.createdDate)})`}
                </span>
              </SMSBox>
            )}
          </SMSBox>
        )
      }



      {/* These Views only appear if accessing via specific Step URL (Manage Buttons) */}
      {
        currentStep === STEPS.VEHICLES && (
          <SMSBox component="div" className="request-form__step-2">
            <RequestEquipmentList
              key="request-vehicles-step"
              items={vehicleItems}
              onItemsChange={setVehicleItems}
              departmentId={user?.departmentID}
              disabled={isLoading}
              type='vehicle'
              title="Vehicles"
              requestStartDate={formData.startDate}
              requestEndDate={formData.endDate}
              onSaveItem={undefined} // Batch save still
              onDeleteItem={initDelete}
            />
          </SMSBox>
        )
      }

      {
        currentStep === STEPS.EQUIPMENT && (
          <SMSBox component="div" className="request-form__step-3">
            <RequestEquipmentList
              key="request-equipment-step"
              items={equipmentItems}
              onItemsChange={setEquipmentItems}
              departmentId={user?.departmentID}
              disabled={isLoading}
              type='equipment'
              title="Equipment"
              requestStartDate={formData.startDate}
              requestEndDate={formData.endDate}
              onSaveItem={undefined} // Batch save still
              onDeleteItem={initDelete}
            />
          </SMSBox>
        )
      }

      {(errors as Record<string, string | undefined>)._form && (
        <SMSBox component="div" sx={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--error-bg, #fef2f2)', color: 'var(--error-text, #b91c1c)', borderRadius: 'var(--radius-sm)' }}>
          <span>{(errors as Record<string, string | undefined>)._form}</span>
        </SMSBox>
      )}
      {isSingleMode ? renderSingleModeButtons() : renderButtons()}

      <SMSConfirmDialog
        open={!!conflictMessage}
        onClose={() => dispatch(clearConflictMessage())}
        title={REQUEST.CONFLICT.TITLE}
        message={conflictMessage ?? ''}
        confirmText={REQUEST.CONFLICT.CONFIRM}
        cancelText={REQUEST.CONFLICT.CANCEL}
        onConfirm={handleConflictConfirm}
        variant="warning"
        confirmButtonColor="primary"
        loading={isLoading}
      />

      <SMSConfirmDialog
        open={schedulePendingDelete != null}
        onClose={() => setSchedulePendingDelete(null)}
        onConfirm={confirmDeleteSchedule}
        title={DAILY_ADMINISTRATION.DELETE_SCHEDULE_TITLE}
        message={DAILY_ADMINISTRATION.DELETE_SCHEDULE_MESSAGE}
        confirmText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CONFIRM}
        cancelText={DAILY_ADMINISTRATION.DELETE_SCHEDULE_CANCEL}
        variant="error"
      />

      <SMSConfirmDialog
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        message="Are you sure you want to delete this item?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="error"
      />

      <CustomRecurrenceModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={(rule) => {
          setRecurrenceRule(rule);
        }}
        initialRule={recurrenceRule}
        startDate={formData.startDate}
      />

      <RequestOneTimeDateChangeConflictModal
        open={dateChangeConflictOpen}
        onClose={() => {
          if (isConflictTransferring) return;
          setDateChangeConflictOpen(false);
          setPendingConflictUpsertPayload(null);
        }}
        message={dateChangeConflictMessage}
        assignedPostPositions={dateChangeConflictRows}
        newRequestStartDate={pendingConflictUpsertPayload?.startDate}
        onTransfer={handleConflictTransfer}
        isTransferring={isConflictTransferring}
      />
    </SMSBox>
  );
};