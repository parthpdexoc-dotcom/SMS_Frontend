/**
 * Map GET /Request/view-details JSON into shapes used by Available Post and Post-by-status modals.
 */
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import type { Post } from '@/types/post';
import type { RequestResponse } from '@/types/request';
import type { RequesterResponse } from '@/types/requester';
import type { FileUploadDto } from '@/types/fileUpload';
import type { PostPositionResponse } from '@/types/postPosition';
import { normalizePost } from '@/services/postService';
import { normalizeRequester } from '@/utils/normalizers';
import { parseJsonText } from '@/services/textPlainJson';
import type { RequestEquipmentDto } from '@/services/requestEquipmentService';
import { normalizeRequestEquipmentRow } from '@/services/requestEquipmentService';
import { normalizePostEquipmentRow } from '@/services/postEquipmentService';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import { mergeRequestAndPostEquipmentForClose } from '@/utils/postPositionEquipmentMerge';
import { resolvePostEndTimeForPayload } from '@/utils/dateTimeUtils';
import { readPostIsFlexibleFromUnknown } from '@/services/postPositionService';

function toIsoDateOnly(v: unknown): string {
  if (v == null) return '';
  const s = String(v).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Map {@link ViewDetailsRequestInfo} (or camelCase JSON) → {@link RequestResponse} for the details modal. */
function mapViewDetailsRequestToRequestResponse(
  raw: Record<string, unknown>,
  rootDto: Record<string, unknown>
): RequestResponse | null {
  const requestID = String(raw.requestId ?? raw.RequestId ?? raw.requestID ?? raw.RequestID ?? '').trim();
  if (!requestID) return null;

  const requesterID = String(
    raw.requesterId ?? raw.RequesterId ?? raw.requesterID ?? raw.RequesterID ?? ''
  ).trim();

  const stationaryRaw = raw.postLocationsAreStationary ?? raw.PostLocationsAreStationary;
  const postLocationsAreStationary = stationaryRaw === true;

  const isSpecialEvent =
    rootDto.isSpecialEvent === true ||
    rootDto.IsSpecialEvent === true ||
    raw.isSpecialEvent === true ||
    raw.IsSpecialEvent === true;

  const departmentIDRaw =
    raw.departmentID ??
    raw.DepartmentID ??
    raw.departmentId ??
    raw.DepartmentId ??
    null;
  const departmentID =
    departmentIDRaw != null && String(departmentIDRaw).trim() !== ''
      ? String(departmentIDRaw).trim()
      : null;

  return {
    requestID,
    requesterID,
    departmentID,
    enableWaitingList: false,
    firstName: String(raw.firstName ?? raw.FirstName ?? ''),
    lastName: String(raw.lastName ?? raw.LastName ?? ''),
    primaryPhone: String(raw.primaryPhone ?? raw.PrimaryPhone ?? ''),
    primaryEmail: String(raw.primaryEmail ?? raw.PrimaryEmail ?? ''),
    isPostContact: false,
    startDate: toIsoDateOnly(raw.startDate ?? raw.StartDate),
    endDate: toIsoDateOnly(raw.endDate ?? raw.EndDate),
    title: String(raw.title ?? raw.Title ?? ''),
    location: String(raw.location ?? raw.Location ?? ''),
    postLocationsAreStationary,
    requiresPermit: false,
    isSpecialEvent: Boolean(isSpecialEvent),
    requiresLiquorLicense: false,
    requiresVehicle: false,
    requiresVehicleAtEveryPost: false,
    requiresEquipment: false,
    requiresEquipmentAtEachPost: false,
    isSkillRequired: false,
    requestHasBeenUpdated: false,
    createdDate: '',
  };
}

function pickRecord(dto: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | null {
  for (const k of keys) {
    const v = dto[k];
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return null;
}

function pickArray(dto: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) {
    const v = dto[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function pickBool(dto: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = dto[k];
    if (v === true || v === false) return v;
  }
  return false;
}

/** Root {@link ViewDetailsDto} numeric fields (camelCase or PascalCase JSON). */
function pickNullableNumber(dto: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = dto[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function pickOptionalTrimmedString(dto: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = dto[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return null;
}

/** {@link ViewDetailsDto.LatestPostNote} — camelCase or PascalCase JSON. */
export type ViewDetailsLatestPostNoteMapped = {
  postNoteID: string | null;
  notes: string;
};

function pickLatestPostNoteFromDto(dto: Record<string, unknown>): ViewDetailsLatestPostNoteMapped | null {
  const raw = dto.latestPostNote ?? dto.LatestPostNote;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const notes = String(r.notes ?? r.Notes ?? '').trim();
  const idRaw = r.postNoteID ?? r.PostNoteID ?? r.postNoteId ?? r.PostNoteId;
  const postNoteID = idRaw != null && String(idRaw).trim() ? String(idRaw).trim() : null;
  if (!notes && !postNoteID) return null;
  return { postNoteID, notes };
}

function mapFilesFromDto(dto: Record<string, unknown>): FileUploadDto[] {
  const raw = pickArray(dto, 'files', 'Files');
  return raw.map((f) => {
    const r = (f ?? {}) as Record<string, unknown>;
    return {
      fileName: String(r.fileName ?? r.FileName ?? ''),
      typeOfFile: String(r.typeOfFile ?? r.TypeOfFile ?? ''),
      requestID: String(r.requestID ?? r.RequestId ?? r.RequestID ?? r.requestId ?? ''),
      fileUploadedId: String(r.fileUploadedId ?? r.FileUploadedID ?? r.FileUploadedId ?? ''),
      fileSize:
        typeof r.fileSize === 'number'
          ? r.fileSize
          : typeof r.FileSize === 'number'
            ? (r.FileSize as number)
            : null,
    };
  });
}

function mapRequestEquipmentList(raw: unknown[]): RequestEquipmentDto[] {
  return raw.map(normalizeRequestEquipmentRow);
}

function mapPostEquipmentList(raw: unknown[]): PostEquipmentDto[] {
  return raw.map(normalizePostEquipmentRow);
}

/** Map PostPositionDto (view-details) → PostPositionResponse used by PostPositionByStatusList modal. */
export function mapPostPositionDtoToPostPositionResponse(raw: unknown): PostPositionResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pid = o.postPositionID ?? o.postPositionId ?? o.PostPositionID ?? o.PostPositionId;
  if (pid == null || String(pid).trim() === '') return null;

  const emp = (o.employee ?? o.Employee) as Record<string, unknown> | undefined;
  const firstFromFlat = String(o.employeeFirstName ?? o.EmployeeFirstName ?? '').trim();
  const lastFromFlat = String(o.employeeLastName ?? o.EmployeeLastName ?? '').trim();
  const dateVal = o.dateOfWork ?? o.DateOfWork;
  const dateStr = dateVal != null ? String(dateVal).slice(0, 10) : '';
  const pst = o.postStartTime ?? o.PostStartTime ?? o.postStarttime ?? o.PostStarttime;
  const postStartStr = pst != null ? String(pst) : '';
  const pet = o.postEndTime ?? o.PostEndTime ?? o.postEndtime ?? o.PostEndtime;
  const postEndStr = pet != null && String(pet).trim() !== '' ? String(pet) : '';
  const lenRaw =
    o.lengthOfWork ??
    o.LengthOfWork ??
    o.lengthofWork ??
    o.lengthofwork ??
    o.postLength ??
    o.PostLength;
  const lengthOfWork = typeof lenRaw === 'number' && !Number.isNaN(lenRaw) ? lenRaw : Number(lenRaw) || 0;
  const statusRaw = o.postPositionStatus ?? o.PostPositionStatus;
  const postPositionStatus =
    typeof statusRaw === 'number' && !Number.isNaN(statusRaw) ? statusRaw : Number(statusRaw) || 0;

  return {
    postPositionId: String(pid),
    postID: String(o.postID ?? o.PostID ?? o.postId ?? ''),
    employeeID: emp ? String(emp.employeeID ?? emp.EmployeeID ?? '') : undefined,
    employeeFirstName: firstFromFlat || undefined,
    employeeLastName: lastFromFlat || undefined,
    requestID: String(o.requestID ?? o.RequestID ?? o.requestId ?? '') || undefined,
    postTitle: String(o.postTitle ?? o.PostTitle ?? '') || undefined,
    badgeNumber: emp ? String(emp.badgeNumber ?? emp.BadgeNumber ?? '') || undefined : undefined,
    firstName: emp
      ? String(emp.firstName ?? emp.FirstName ?? '').trim() || undefined
      : firstFromFlat || undefined,
    lastName: emp
      ? String(emp.lastName ?? emp.LastName ?? '').trim() || undefined
      : lastFromFlat || undefined,
    employeeTypeName: emp
      ? String(emp.employeeType ?? emp.EmployeeType ?? emp.employeeTypeName ?? emp.EmployeeTypeName ?? '') ||
        undefined
      : undefined,
    primaryPhone: emp ? String(emp.primaryPhone ?? emp.PrimaryPhone ?? '') || undefined : undefined,
    dateOfWork: dateStr,
    startDate: dateStr || undefined,
    postStartTime: postStartStr || undefined,
    postEndTime: postEndStr || undefined,
    lengthOfWork,
    postLength: lengthOfWork,
    equipmentRequired: Boolean(o.equipmentRequired ?? o.EquipmentRequired),
    requiresEquipment: Boolean(o.equipmentRequired ?? o.EquipmentRequired),
    postRequiresVehicle: Boolean(o.postRequiresVehicle ?? o.PostRequiresVehicle),
    requiresVehicle: Boolean(o.postRequiresVehicle ?? o.PostRequiresVehicle),
    vehicleRequired: Boolean(o.postRequiresVehicle ?? o.PostRequiresVehicle),
    callSign: String(o.callSign ?? o.CallSign ?? o.callSing ?? o.CallSing ?? '') || undefined,
    postPositionStatus,
    postLocation: String(o.postLocation ?? o.PostLocation ?? '') || undefined,
    postDescription: String(o.postDescription ?? o.PostDescription ?? '') || undefined,
    postNotes: String(o.postNotes ?? o.PostNotes ?? '') || undefined,
    postPayRate:
      typeof o.postPayRate === 'number'
        ? o.postPayRate
        : typeof o.PostPayRate === 'number'
          ? (o.PostPayRate as number)
          : undefined,
    postPositionPayRate:
      typeof o.postPositionPayRate === 'number'
        ? o.postPositionPayRate
        : typeof o.PostPositionPayRate === 'number'
          ? (o.PostPositionPayRate as number)
          : undefined,
    isPremiumPaidEvent:
      o.isPremiumPaidEvent === true || o.IsPremiumPaidEvent === true
        ? true
        : o.isPremiumPaidEvent === false || o.IsPremiumPaidEvent === false
          ? false
          : undefined,
    postPremiumRate:
      typeof o.postPremiumRate === 'number'
        ? o.postPremiumRate
        : typeof o.PostPremiumRate === 'number'
          ? (o.PostPremiumRate as number)
          : undefined,
    postIsFlexible: Boolean(o.postIsFlexible ?? o.PostIsFlexible),
    postRequiresEquipment: Boolean(o.postRequiresEquipment ?? o.PostRequiresEquipment),
    isSkillsRequired: Boolean(o.isSkillsRequired ?? o.IsSkillsRequired),
    rankEligible: Boolean(o.rankEligible ?? o.RankEligible),
    isPostRequiredDocument: Boolean(o.isPostRequiredDocument ?? o.IsPostRequiredDocument),
    totalPostPositions:
      typeof o.totalPostPositions === 'number'
        ? o.totalPostPositions
        : typeof o.TotalPostPositions === 'number'
          ? (o.TotalPostPositions as number)
          : undefined,
    postDepartmentDefinedFieldValue1: String(o.postDepartmentDefinedFieldValue1 ?? '') || undefined,
    postDepartmentDefinedFieldValue2: String(o.postDepartmentDefinedFieldValue2 ?? '') || undefined,
    postDepartmentDefinedFieldValue3: String(o.postDepartmentDefinedFieldValue3 ?? '') || undefined,
    postDepartmentDefinedFieldValue4: String(o.postDepartmentDefinedFieldValue4 ?? '') || undefined,
    postDepartmentDefinedFieldValue5: String(o.postDepartmentDefinedFieldValue5 ?? '') || undefined,
    postDepartmentDefinedFieldValue6: String(o.postDepartmentDefinedFieldValue6 ?? '') || undefined,
    postDepartmentDefinedFieldValue7: String(o.postDepartmentDefinedFieldValue7 ?? '') || undefined,
    postDepartmentDefinedFieldValue8: String(o.postDepartmentDefinedFieldValue8 ?? '') || undefined,
    postDepartmentDefinedFieldValue9: String(o.postDepartmentDefinedFieldValue9 ?? '') || undefined,
    postDepartmentDefinedFieldValue10: String(o.postDepartmentDefinedFieldValue10 ?? '') || undefined,
    parentPostPositionId: (o.parentPostPositionId ?? o.ParentPostPositionId) as string | null | undefined,
    splitPostPositionID: (o.splitPostPositionID ?? o.SplitPostPositionID) as string | null | undefined,
    isSplit: Boolean(o.isSplit ?? o.IsSplit),
    closedPostPositionID: (o.closedPostPositionID ?? o.ClosedPostPositionID) as string | null | undefined,
    isUncloseDisabled: Boolean(o.isUncloseDisabled ?? o.IsUncloseDisabled),
    wasUnclosed: Boolean(o.wasUnclosed ?? o.WasUnclosed),
    isUniquePerPosition:
      o.isUniquePerPosition === true || o.IsUniquePerPosition === true,
  };
}

/** Build Post for modal from with-post-like / PostPosition fields when full Post DTO is absent. */
export function buildPostFromPostPositionRow(
  listRow: EmployeePostListingItem,
  pp: PostPositionResponse,
  raw: Record<string, unknown>
): Post {
  const postLength = (raw?.postLength ?? raw?.PostLength ?? raw?.lengthOfWork ?? raw?.LengthOfWork) as
    | number
    | undefined;
  const postPayRate = (raw?.postPayRate ?? raw?.PostPayRate) as number | undefined;
  const postPremiumRate = (raw?.postPremiumRate ?? raw?.PostPremiumRate) as number | undefined;
  const postRequiresVehicle = Boolean(raw?.showVehicle ?? raw?.ShowVehicle);
  const postRequiresEquipment = Boolean(raw?.showEquipment ?? raw?.ShowEquipment);
  return {
    postId: listRow.postID,
    requestID: pp.requestID ?? listRow.requestID ?? '',
    postParentID: null,
    isParent: false,
    totalPostPositions: pp.totalPostPositions ?? 0,
    rankEligible: pp.rankEligible ?? false,
    postTitle: pp.postTitle ?? '',
    postDescription: pp.postDescription ?? '',
    postStartTime: pp.postStartTime ?? '',
    postEndTime: resolvePostEndTimeForPayload(
      pp.postStartTime ?? '',
      typeof postLength === 'number' ? postLength : 0,
      null
    ),
    postLength: typeof postLength === 'number' ? postLength : 0,
    postCallSign: pp.callSign ?? '',
    postIsFlexible: pp.postIsFlexible ?? false,
    postPayRate: typeof postPayRate === 'number' ? postPayRate : 0,
    postPremiumRate: typeof postPremiumRate === 'number' ? postPremiumRate : 0,
    postRequiresVehicle,
    postRequiresEquipment,
    isSkillsRequired: pp.isSkillsRequired ?? false,
    skillIDs: [],
    postNotes: '',
    postLocation: pp.postLocation ?? '',
    payCodeValue: (raw?.payCodeValue ?? raw?.PayCodeValue) as string | null | undefined,
    payCodeDescription: (raw?.payCodeDescription ?? raw?.PayCodeDescription) as string | null | undefined,
    level: '',
    isPostRequiredDocument: pp.isPostRequiredDocument ?? false,
    isSupervisorPost: false,
    defineCallSign: Boolean(raw?.defineCallSign ?? raw?.DefineCallSign ?? (pp as any)?.defineCallSign ?? false),
    postDepartmentDefinedValue1: '',
    employeeTypeID: null,
  } as Post;
}

export type EmployeeListingViewDetailsMapped = {
  postData: Post | null;
  requestData: RequestResponse | null;
  requesterData: RequesterResponse | null;
  files: FileUploadDto[];
  /** From {@link ViewDetailsDto.AvailablePositions} when the API sends it (e.g. "X out of Y"). */
  viewDetailsAvailablePositions: number | null;
  /** From {@link ViewDetailsDto.TotalPostPositions} when the API sends it (denominator for available line). */
  viewDetailsTotalPostPositions: number | null;
  /** From {@link ViewDetailsDto.SpecialEventJobDetailsMessage} when {@link ViewDetailsDto.IsSpecialEvent} is true. */
  specialEventJobDetailsMessage: string | null;
  /** From {@link ViewDetailsDto.LatestPostNote}; replaces `GET /PostNotes/{id}/latest-notes` for the details modal. */
  latestPostNote: ViewDetailsLatestPostNoteMapped | null;
  detailModalEquipmentRaw: PostEquipmentDto[];
  viewDetailsShowVehicle: boolean;
  viewDetailsShowEquipment: boolean;
};

export type PostPositionListViewDetailsMapped = {
  postDetailsFromApi: PostPositionResponse | null;
  postData: Post | null;
  requestData: RequestResponse | null;
  requesterData: RequesterResponse | null;
  files: FileUploadDto[];
  detailModalEquipmentRaw: PostEquipmentDto[];
  specialEventJobDetailsMessage: string | null;
  viewDetailsAvailablePositions: number | null;
  viewDetailsTotalPostPositions: number | null;
  /** Root ViewDetailsDto flags (modal + department catalog use these). */
  viewDetailsShowVehicle: boolean;
  viewDetailsShowEquipment: boolean;
  latestPostNote: ViewDetailsLatestPostNoteMapped | null;
};

/** Merge list-row requester fields when view-details omits them (available-post list API). */
export function enrichEmployeeListingViewDetailsFromRow(
  mapped: EmployeeListingViewDetailsMapped,
  listRow: EmployeePostListingItem
): EmployeeListingViewDetailsMapped {
  const requesterID = listRow.requesterID?.trim() || '';
  const requesterTitle = listRow.requesterTitle?.trim() || '';
  if (!requesterID && !requesterTitle) return mapped;

  let requestData = mapped.requestData;
  let requesterData = mapped.requesterData;

  if (requesterID) {
    if (requestData && !requestData.requesterID?.trim()) {
      requestData = { ...requestData, requesterID };
    }
    if (!requesterData) {
      requesterData = {
        requesterID,
        name: requesterTitle || undefined,
      };
    } else if (requesterTitle && !requesterData.name?.trim()) {
      requesterData = { ...requesterData, name: requesterTitle };
    }
  } else if (requesterTitle && requesterData && !requesterData.name?.trim()) {
    requesterData = { ...requesterData, name: requesterTitle };
  }

  return { ...mapped, requestData, requesterData };
}

export function mapEmployeeListingViewDetails(
  _post: EmployeePostListingItem,
  dto: Record<string, unknown>
): EmployeeListingViewDetailsMapped {
  const postRaw = pickRecord(dto, 'post', 'Post');
  let postData = postRaw ? normalizePost(postRaw) : null;
  const rootTotalPostPositions = pickNullableNumber(dto, 'totalPostPositions', 'TotalPostPositions');
  if (postData != null && rootTotalPostPositions != null) {
    postData = { ...postData, totalPostPositions: rootTotalPostPositions };
  }

  const ppRawForCallSign = pickRecord(dto, 'postPosition', 'PostPosition');
  if (postData != null && ppRawForCallSign) {
    const positionCallSign = String(ppRawForCallSign.callSign ?? ppRawForCallSign.CallSign ?? ppRawForCallSign.callSing ?? ppRawForCallSign.CallSing ?? '').trim();
    if (positionCallSign) {
      postData = { ...postData, postCallSign: positionCallSign };
    }
  }

  const requestRaw = pickRecord(dto, 'request', 'Request');
  let requestData: RequestResponse | null = null;
  if (requestRaw && Object.keys(requestRaw).length > 0) {
    requestData = mapViewDetailsRequestToRequestResponse(requestRaw, dto);
    if (!requestData) {
      try {
        requestData = parseJsonText<RequestResponse>(JSON.stringify(requestRaw));
      } catch {
        requestData = requestRaw as unknown as RequestResponse;
      }
    }
  }

  const requesterRaw = pickRecord(dto, 'requester', 'Requester');
  const requesterData = requesterRaw ? normalizeRequester(requesterRaw) : null;

  const files = mapFilesFromDto(dto);

  const viewDetailsAvailablePositions = pickNullableNumber(dto, 'availablePositions', 'AvailablePositions');
  const viewDetailsTotalPostPositions = rootTotalPostPositions;
  const specialEventJobDetailsMessage = pickOptionalTrimmedString(
    dto,
    'specialEventJobDetailsMessage',
    'SpecialEventJobDetailsMessage'
  );

  const latestPostNote = pickLatestPostNoteFromDto(dto);
  if (postData != null && latestPostNote?.notes && !String(postData.postNotes ?? '').trim()) {
    postData = { ...postData, postNotes: latestPostNote.notes };
  }

  const viewDetailsShowVehicle = pickBool(dto, 'showVehicle', 'ShowVehicle');
  const viewDetailsShowEquipment = pickBool(dto, 'showEquipment', 'ShowEquipment');
  const reqEq = mapRequestEquipmentList(pickArray(dto, 'requestEquipments', 'RequestEquipments'));
  const postEq = mapPostEquipmentList(pickArray(dto, 'equipments', 'Equipments'));
  const postIdFromDto = String(
    (postRaw?.postId ?? postRaw?.PostId ?? postRaw?.postID ?? postRaw?.PostID ?? postData?.postId ?? '') as string
  ).trim();
  const hasEquipmentLines = reqEq.length > 0 || postEq.length > 0;
  let detailModalEquipmentRaw: PostEquipmentDto[] = [];
  if (hasEquipmentLines || viewDetailsShowVehicle || viewDetailsShowEquipment) {
    detailModalEquipmentRaw = mergeRequestAndPostEquipmentForClose(reqEq, postEq, postIdFromDto);
  }

  return {
    postData,
    requestData,
    requesterData,
    files,
    viewDetailsAvailablePositions,
    viewDetailsTotalPostPositions,
    specialEventJobDetailsMessage,
    latestPostNote,
    detailModalEquipmentRaw,
    viewDetailsShowVehicle,
    viewDetailsShowEquipment,
  };
}

export function mapPostPositionListViewDetails(
  listRow: EmployeePostListingItem,
  dto: Record<string, unknown>
): PostPositionListViewDetailsMapped {
  const ppRaw = dto.postPosition ?? dto.PostPosition;
  let postDetailsFromApi = ppRaw ? mapPostPositionDtoToPostPositionResponse(ppRaw) : null;

  const postDto = pickRecord(dto, 'post', 'Post');
  if (postDetailsFromApi && postDto) {
    const pTitle = postDto.postTitle ?? postDto.PostTitle;
    if (pTitle != null && String(pTitle).trim() && !postDetailsFromApi.postTitle) {
      postDetailsFromApi = { ...postDetailsFromApi, postTitle: String(pTitle).trim() };
    }
    const pLoc = postDto.postLocation ?? postDto.PostLocation;
    if (pLoc != null && String(pLoc).trim() && !postDetailsFromApi.postLocation) {
      postDetailsFromApi = { ...postDetailsFromApi, postLocation: String(pLoc).trim() };
    }
    const pDesc = postDto.postDescription ?? postDto.PostDescription;
    if (pDesc != null && String(pDesc).trim() && !postDetailsFromApi.postDescription) {
      postDetailsFromApi = { ...postDetailsFromApi, postDescription: String(pDesc).trim() };
    }
    const reqFromPost = postDto.requestId ?? postDto.RequestId;
    if (reqFromPost != null && String(reqFromPost).trim() && !postDetailsFromApi.requestID) {
      postDetailsFromApi = { ...postDetailsFromApi, requestID: String(reqFromPost).trim() };
    }
    const flexFromPost = readPostIsFlexibleFromUnknown(postDto);
    if (flexFromPost !== undefined) {
      postDetailsFromApi = { ...postDetailsFromApi, postIsFlexible: flexFromPost };
    }
  }

  const rootTotalPostPositions = pickNullableNumber(dto, 'totalPostPositions', 'TotalPostPositions');
  if (postDetailsFromApi != null && rootTotalPostPositions != null) {
    postDetailsFromApi = { ...postDetailsFromApi, totalPostPositions: rootTotalPostPositions };
  }

  let postData: Post | null = null;
  if (postDto) {
    postData = normalizePost(postDto);
  } else if (postDetailsFromApi) {
    const raw = postDetailsFromApi as unknown as Record<string, unknown>;
    postData = buildPostFromPostPositionRow(listRow, postDetailsFromApi, {
      ...raw,
      showVehicle: pickBool(dto, 'showVehicle', 'ShowVehicle'),
      showEquipment: pickBool(dto, 'showEquipment', 'ShowEquipment'),
    });
  }
  if (postData != null && rootTotalPostPositions != null) {
    postData = { ...postData, totalPostPositions: rootTotalPostPositions };
  }

  const positionCallSign = postDetailsFromApi?.callSign?.trim();
  if (postData != null && positionCallSign) {
    postData = { ...postData, postCallSign: positionCallSign };
  }

  const positionPayRate =
    postDetailsFromApi?.postPositionPayRate ??
    (ppRaw && typeof ppRaw === 'object'
      ? pickNullableNumber(ppRaw as Record<string, unknown>, 'postPositionPayRate', 'PostPositionPayRate')
      : null);
  if (postData != null && ppRaw) {
    postData = {
      ...postData,
      postPayRate: positionPayRate != null ? positionPayRate : (undefined as unknown as number),
      isPremiumPaidEvent: postDetailsFromApi?.isPremiumPaidEvent,
    };
  }

  const requestRaw = pickRecord(dto, 'request', 'Request');
  let requestData: RequestResponse | null = null;
  if (requestRaw && Object.keys(requestRaw).length > 0) {
    requestData = mapViewDetailsRequestToRequestResponse(requestRaw, dto);
    if (!requestData) {
      try {
        requestData = parseJsonText<RequestResponse>(JSON.stringify(requestRaw));
      } catch {
        requestData = requestRaw as unknown as RequestResponse;
      }
    }
  }

  const requesterRaw = pickRecord(dto, 'requester', 'Requester');
  const requesterData = requesterRaw ? normalizeRequester(requesterRaw) : null;

  const files = mapFilesFromDto(dto);

  const viewDetailsShowVehicle = pickBool(dto, 'showVehicle', 'ShowVehicle');
  const viewDetailsShowEquipment = pickBool(dto, 'showEquipment', 'ShowEquipment');
  const reqEq = mapRequestEquipmentList(pickArray(dto, 'requestEquipments', 'RequestEquipments'));
  const postEq = mapPostEquipmentList(pickArray(dto, 'equipments', 'Equipments'));

  const postRowRaw = listRow as unknown as Record<string, unknown>;
  const effectivePostId = String(
    listRow.postID ??
      postRowRaw.PostID ??
      postDetailsFromApi?.postID ??
      (postDetailsFromApi as unknown as Record<string, unknown> | undefined)?.PostID ??
      ''
  );

  const hasEquipmentLines = reqEq.length > 0 || postEq.length > 0;
  let detailModalEquipmentRaw: PostEquipmentDto[] = [];
  if (hasEquipmentLines || viewDetailsShowVehicle || viewDetailsShowEquipment) {
    detailModalEquipmentRaw = mergeRequestAndPostEquipmentForClose(reqEq, postEq, effectivePostId);
  }

  if (postDetailsFromApi != null && (viewDetailsShowVehicle || viewDetailsShowEquipment)) {
    const showV = viewDetailsShowVehicle || Boolean(postDetailsFromApi.postRequiresVehicle);
    const showE =
      viewDetailsShowEquipment ||
      Boolean(postDetailsFromApi.postRequiresEquipment || postDetailsFromApi.equipmentRequired);
    postDetailsFromApi = {
      ...postDetailsFromApi,
      postRequiresVehicle: Boolean(postDetailsFromApi.postRequiresVehicle || viewDetailsShowVehicle),
      vehicleRequired: Boolean(postDetailsFromApi.vehicleRequired || viewDetailsShowVehicle),
      requiresVehicle: Boolean(postDetailsFromApi.requiresVehicle || viewDetailsShowVehicle),
      postRequiresEquipment: Boolean(
        postDetailsFromApi.postRequiresEquipment || postDetailsFromApi.equipmentRequired || viewDetailsShowEquipment
      ),
      equipmentRequired: Boolean(postDetailsFromApi.equipmentRequired || viewDetailsShowEquipment),
      requiresEquipment: Boolean(postDetailsFromApi.requiresEquipment || viewDetailsShowEquipment),
    };
    const ext = postDetailsFromApi as unknown as Record<string, unknown>;
    ext.showVehicle = showV;
    ext.ShowVehicle = showV;
    ext.showEquipment = showE;
    ext.ShowEquipment = showE;
  }

  const specialEventJobDetailsMessage = pickOptionalTrimmedString(
    dto,
    'specialEventJobDetailsMessage',
    'SpecialEventJobDetailsMessage'
  );

  const viewDetailsAvailablePositions = pickNullableNumber(dto, 'availablePositions', 'AvailablePositions');
  const viewDetailsTotalPostPositions = rootTotalPostPositions;
  const latestPostNote = pickLatestPostNoteFromDto(dto);
  if (postData != null && latestPostNote?.notes && !String(postData.postNotes ?? '').trim()) {
    postData = { ...postData, postNotes: latestPostNote.notes };
  }

  return {
    postDetailsFromApi,
    postData,
    requestData,
    requesterData,
    files,
    detailModalEquipmentRaw,
    specialEventJobDetailsMessage,
    viewDetailsAvailablePositions,
    viewDetailsTotalPostPositions,
    viewDetailsShowVehicle,
    viewDetailsShowEquipment,
    latestPostNote,
  };
}
