import { Post, PostFilter } from '@/types/post';
import { ensurePostEndTimeForPayload } from '@/utils/dateTimeUtils';
import { apiGetAll, apiPost, apiGet, apiDelete } from '@/utils/apiClient';
import {
    ApiResponseError,
    expectOkReadText,
    getErrorMessageFromErrorResponse,
    parseJsonText,
    parseJsonTextArray,
    parsePagedListDto,
    readResponseOk,
} from '@/services/textPlainJson';
import { PagedResponse } from '@/types/common';
import { EmployeeResponse } from '@/types/employee';
import { normalizeEmployee } from '@/utils/normalizers';
import type { PostPositionEmployeeLocationDto } from '@/types/employeePostLocation';

export interface PostLookupDto {
    postId: string;
    postTitle: string;
    /** Level from BuildRecursive (e.g. "1", "1-1", "1-2"); used for hierarchy indentation. */
    level?: string;
}

export const getSupervisorPosts = async (requestId?: string): Promise<PostLookupDto[]> => {
    const query = requestId?.trim() ? `?requestId=${encodeURIComponent(requestId.trim())}` : '';
    const response = await apiGet(`/Post/supervisor-posts${query}`);
    const text = await expectOkReadText(response, 'Failed to fetch supervisor jobs');
    const raw = parseJsonTextArray<Record<string, unknown>>(text);
    return raw.map((item) => ({
        postId: String(item.postId ?? item['PostId'] ?? ''),
        postTitle: String(item.postTitle ?? item['PostTitle'] ?? ''),
        level: item.level != null ? String(item.level) : item['Level'] != null ? String(item['Level']) : undefined,
    }));
};

function getStrFromObj(obj: Record<string, unknown>, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = obj[k];
        if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
}

function toTrimmedOrNull(value: unknown): string | null {
    if (value == null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

export function normalizePost(raw: unknown): Post {
    const obj = (raw ?? {}) as Record<string, unknown>;

    const normalized: Post = obj as unknown as Post;

    // PTAEO: backend now uses five separate fields (ProjectNumber, TaskNumber, AwardNumber, FundNumber, OrganizationName/Number)
    normalized.projectNumber = getStrFromObj(obj, 'projectNumber', 'ProjectNumber');
    normalized.taskNumber = getStrFromObj(obj, 'taskNumber', 'TaskNumber');
    normalized.awardNumber = getStrFromObj(obj, 'awardNumber', 'AwardNumber');
    normalized.fundNumber = getStrFromObj(obj, 'fundNumber', 'FundNumber');
    normalized.organizationNumber = getStrFromObj(obj, 'organizationNumber', 'OrganizationNumber');

    const hasPtaeoFields =
        !!(normalized.projectNumber ??
           normalized.taskNumber ??
           normalized.awardNumber ??
           normalized.fundNumber ??
           normalized.organizationNumber);

    const ptaeoId =
        (obj['postPtaeoCodeId'] as string | null | undefined) ??
        (obj['postPtaeoCodeID'] as string | null | undefined) ??
        (obj['ptaeoCodeId'] as string | null | undefined) ??
        (obj['ptaeoCodeID'] as string | null | undefined) ??
        (obj['PtaeoCodeId'] as string | null | undefined) ??
        (obj['PtaeoCodeID'] as string | null | undefined);

    const deptActivityTypeId =
        (obj['postDepartmentActivityTypeId'] as string | null | undefined) ??
        (obj['departmentActivityTypeId'] as string | null | undefined) ??
        (obj['DepartmentActivityTypeId'] as string | null | undefined);

    // PayCodeID (FK to PayCode table). Backend may send payCodeID / PayCodeID / payCodeId / PayCodeId.
    // Do NOT fall back to string PayCode value; this field strictly stores the GUID.
    normalized.payCode =
        getStrFromObj(
            obj,
            'payCodeID',
            'PayCodeID',
            'payCodeId',
            'PayCodeId'
        );
    normalized.payCodeValue = getStrFromObj(obj, 'payCodeValue', 'PayCodeValue');
    normalized.payCodeDescription = getStrFromObj(obj, 'payCodeDescription', 'PayCodeDescription');

    // Ensure our UI field is populated regardless of backend casing
    normalized.postPtaeoCodeId = ptaeoId && String(ptaeoId).trim() ? String(ptaeoId) : null;
    normalized.postDepartmentActivityTypeId = deptActivityTypeId && String(deptActivityTypeId).trim() ? String(deptActivityTypeId) : null;
    normalized.postDepartmentActivityTypeName =
        getStrFromObj(
            obj,
            'postDepartmentActivityType',
            'PostDepartmentActivityType',
            'departmentActivityType',
            'DepartmentActivityType',
            'activityTypeShort',
            'ActivityTypeShort'
        ) ?? null;
    normalized.firstName = getStrFromObj(obj, 'firstName', 'FirstName') ?? '';
    normalized.lastName = getStrFromObj(obj, 'lastName', 'LastName') ?? '';
    normalized.primaryEmail = getStrFromObj(obj, 'primaryEmail', 'PrimaryEmail') ?? '';
    normalized.primaryPhone = getStrFromObj(obj, 'primaryPhone', 'PrimaryPhone') ?? '';
    normalized.cellPhone = getStrFromObj(obj, 'cellPhone', 'CellPhone') ?? '';

    if ('postDescription' in obj || 'PostDescription' in obj) {
        const v = obj['postDescription'] ?? obj['PostDescription'];
        normalized.postDescription = v == null ? '' : String(v);
    }

    normalized.postApplyPremium =
        (obj['postApplyPremium'] as boolean | undefined) ?? hasPtaeoFields;

    // Employee type: backend now uses a single EmployeeTypeID (Guid?) instead of EmployeeTypeIDs
    const employeeTypeIdRaw =
        (obj['employeeTypeID'] as string | null | undefined) ??
        (obj['employeeTypeId'] as string | null | undefined) ??
        (obj['EmployeeTypeID'] as string | null | undefined) ??
        // Legacy support for older payloads that might still send EmployeeTypeIDs: string[]
        (() => {
            const arr =
                (obj['employeeTypeIDs'] as string[] | null | undefined) ??
                (obj['EmployeeTypeIDs'] as string[] | null | undefined);
            return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
        })();

    normalized.employeeTypeID = employeeTypeIdRaw && String(employeeTypeIdRaw).trim()
        ? String(employeeTypeIdRaw)
        : null;

    // Minimum Hours Required (backend may send PostMinimumHoursRequired or postMinimumHoursRequired)
    const minHoursRaw =
        (obj['postMinimumHoursRequired'] as number | null | undefined) ??
        (obj['PostMinimumHoursRequired'] as number | null | undefined);
    normalized.postMinimumHoursRequired = minHoursRaw != null ? Number(minHoursRaw) : null;

    // Response Area: store by id (backend may send PostResponseAreaId or postResponseAreaId or responseAreaID)
    const responseAreaIdRaw =
        (obj['postResponseAreaId'] as string | null | undefined) ??
        (obj['PostResponseAreaId'] as string | null | undefined) ??
        (obj['responseAreaId'] as string | null | undefined) ??
        (obj['responseAreaID'] as string | null | undefined);
    normalized.postResponseAreaId = responseAreaIdRaw != null && String(responseAreaIdRaw).trim() ? String(responseAreaIdRaw).trim() : null;
    normalized.postResponseAreaName =
        getStrFromObj(
            obj,
            'postResponseArea',
            'PostResponseArea',
            'departmentResponseArea',
            'DepartmentResponseArea',
            'responseAreaShort',
            'ResponseAreaShort'
        ) ?? null;

    // Uniform (backend may send PostUniform or postUniform)
    const uniformRaw =
        (obj['postUniform'] as boolean | null | undefined) ?? (obj['PostUniform'] as boolean | null | undefined);
    normalized.postUniform = uniformRaw ?? false;

    // Skills: ensure array of ids (backend may send SkillIDs or skillIDs)
    const skillIdsRaw =
        (obj['skillIDs'] as string[] | null | undefined) ?? (obj['SkillIDs'] as string[] | null | undefined);
    const skillIdsArr = Array.isArray(skillIdsRaw) ? skillIdsRaw : [];
    normalized.skillIDs = skillIdsArr.map((id) => (id != null ? String(id).trim() : '')).filter(Boolean);

    // Normalize IsParent flag from backend casing variants
    const isParentRaw =
        (obj['isParent'] as boolean | null | undefined) ??
        (obj['IsParent'] as boolean | null | undefined);
    normalized.isParent = isParentRaw ?? false;

    normalized.exemptHours = obj['isExemptHours'] === true;

    // Normalize IsSupervisorPost (list/detail APIs may use PascalCase)
    const isSupervisorRaw =
        (obj['isSupervisorPost'] as boolean | null | undefined) ??
        (obj['IsSupervisorPost'] as boolean | null | undefined);
    normalized.isSupervisorPost = isSupervisorRaw === true;

    const defineCallSignRaw =
        (obj['defineCallSign'] as boolean | null | undefined) ??
        (obj['DefineCallSign'] as boolean | null | undefined);
    normalized.defineCallSign = defineCallSignRaw === true;

    const isAlcoholServedOrConsumedRaw =
        (obj['isAlcoholServedOrConsumed'] as boolean | null | undefined) ??
        (obj['IsAlcoholServedOrConsumed'] as boolean | null | undefined);
    normalized.isAlcoholServedOrConsumed = isAlcoholServedOrConsumedRaw === true;

    // Assigned employees count (from Post/by-request API)
    const assignedCountRaw =
        (obj['assignedEmployeeCount'] as number | null | undefined) ??
        (obj['AssignedEmployeeCount'] as number | null | undefined) ??
        (obj['assignedemployeecount'] as number | null | undefined);
    if (assignedCountRaw != null && !Number.isNaN(Number(assignedCountRaw))) {
        normalized.assignedEmployeeCount = Number(assignedCountRaw);
    }

    const assignedPostPositionCountRaw =
        (obj['assignedPostPositionCount'] as number | null | undefined) ??
        (obj['AssignedPostPositionCount'] as number | null | undefined);
    if (assignedPostPositionCountRaw != null && !Number.isNaN(Number(assignedPostPositionCountRaw))) {
        normalized.assignedPostPositionCount = Number(assignedPostPositionCountRaw);
    }

    const cancelledPostPositionCountRaw =
        (obj['cancelledPostPositionCount'] as number | null | undefined) ??
        (obj['CancelledPostPositionCount'] as number | null | undefined);
    if (cancelledPostPositionCountRaw != null && !Number.isNaN(Number(cancelledPostPositionCountRaw))) {
        normalized.cancelledPostPositionCount = Number(cancelledPostPositionCountRaw);
    }

    const postEndFromApi = getStrFromObj(obj, 'postEndTime', 'PostEndTime');
    if (postEndFromApi) {
        (normalized as Post).postEndTime = postEndFromApi;
    }

    const hasAssignmentWarningRaw =
        (obj['hasAssignmentWarning'] as boolean | null | undefined) ??
        (obj['HasAssignmentWarning'] as boolean | null | undefined);
    normalized.hasAssignmentWarning = hasAssignmentWarningRaw === true;
    normalized.assignmentWarningMessage =
        getStrFromObj(obj, 'assignmentWarningMessage', 'AssignmentWarningMessage') ?? null;
    const warningEmployeesRaw =
        (obj['assignmentWarningEmployees'] as unknown[] | undefined) ??
        (obj['AssignmentWarningEmployees'] as unknown[] | undefined);
    normalized.assignmentWarningEmployees = Array.isArray(warningEmployeesRaw)
        ? warningEmployeesRaw.map((entry) => {
            const row = (entry ?? {}) as Record<string, unknown>;
            return {
                employeeID: String(row.employeeID ?? row.EmployeeID ?? ''),
                postPositionID: String(row.postPositionID ?? row.PostPositionID ?? ''),
                dateOfWork: String(row.dateOfWork ?? row.DateOfWork ?? ''),
                startTime: String(row.startTime ?? row.StartTime ?? ''),
                endTime: String(row.endTime ?? row.EndTime ?? ''),
                duration: String(
                    row.duration ??
                    row.Duration ??
                    row.lengthOfWork ??
                    row.LengthOfWork ??
                    ''
                ),
                employeeName: String(row.employeeName ?? row.EmployeeName ?? ''),
                primaryEmail: String(
                    row.primaryEmail ??
                    row.PrimaryEmail ??
                    row.email ??
                    row.Email ??
                    ''
                ),
                primaryPhone: String(
                    row.primaryPhone ??
                    row.PrimaryPhone ??
                    row.phoneNumber ??
                    row.PhoneNumber ??
                    row.phone ??
                    row.Phone ??
                    ''
                ),
            };
        })
        : [];

    return normalized;
}

/**
 * Get all posts
 * @param filters - Optional filters
 * @returns Promise<PagedResponse<Post>>
 */
export const getPosts = async (filters?: PostFilter): Promise<PagedResponse<Post>> => {
    try {
        let endpoint = '/Post';

        if (filters?.requestID) {
            endpoint = `/Post/by-request/${filters.requestID}`;
        }

        const response = await apiGetAll(endpoint, filters);
        const responseText = await expectOkReadText(response, 'Failed to fetch jobs');

        const parsed = parseJsonText<unknown>(responseText);

        // Handle paginated response with data array
        if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray((parsed as any).data)) {
            const paged = parsed as PagedResponse<unknown>;
            return {
                ...paged,
                data: (paged.data ?? []).map(normalizePost),
            } as PagedResponse<Post>;
        }

        // Fallback to wrapping array in PagedResponse
        const data = parseJsonTextArray<unknown>(responseText).map(normalizePost);
        return {
            data,
            totalRecords: data.length
        };
    } catch (error) {
        console.error('Error fetching posts:', error);
        throw error;
    }
};

/**
 * Create or update a post (upsert operation)
 * @param postData - The post data
 * @returns Promise<Post>
 */
export const upsertPost = async (postData: Post): Promise<Post> => {
    try {
        const postEndTimeForApi = ensurePostEndTimeForPayload(
            postData.postStartTime,
            postData.postLength,
            postData.postEndTime
        );

        // Clean the data to match backend PostDto structure
        // Remove fields that don't exist in the backend
        const cleanedData: any = {
            postId: postData.postId || undefined,
            requestID: postData.requestID,
            postParentID: postData.postParentID || null,
            isParent: postData.isParent ?? false,
            exemptHours: postData.exemptHours ?? false,
            defineCallSign: postData.defineCallSign ?? false,
            totalPostPositions: postData.totalPostPositions,
            rankEligible: postData.rankEligible,
            postTitle: postData.postTitle,
            postDescription: postData.postDescription || null,
            postStartTime: postData.postStartTime || null,
            postEndTime: postEndTimeForApi,
            postLength: postData.postLength || null,
            postMinimumHoursRequired: postData.postMinimumHoursRequired != null ? postData.postMinimumHoursRequired : null,
            postIsFlexible: postData.postIsFlexible,
            postPayRate: postData.postPayRate ?? null,
            postPremiumRate: postData.postPremiumRate || null,
            postRequiresVehicle: postData.postRequiresVehicle,
            postRequiresEquipment: postData.postRequiresEquipment,
            isSkillsRequired: postData.isSkillsRequired || false,
            skillIDs: postData.isSkillsRequired && postData.skillIDs && postData.skillIDs.length > 0 ? postData.skillIDs : null,
            employeeTypeID: postData.employeeTypeID && String(postData.employeeTypeID).trim()
                ? postData.employeeTypeID
                : null,
            postNotes: postData.postNotes || null,
            postLocation: postData.postLocation || null,
            firstName: toTrimmedOrNull(postData.firstName),
            lastName: toTrimmedOrNull(postData.lastName),
            primaryEmail: toTrimmedOrNull(postData.primaryEmail),
            primaryPhone: toTrimmedOrNull(postData.primaryPhone),
            cellPhone: toTrimmedOrNull(postData.cellPhone),
            postResponseAreaId: postData.postResponseAreaId && String(postData.postResponseAreaId).trim() ? postData.postResponseAreaId : null,
            isPostRequiredDocument: postData.isPostRequiredDocument,
            isSupervisorPost: postData.isSupervisorPost ?? false,
            isAlcoholServedOrConsumed: postData.isAlcoholServedOrConsumed ?? false,
            postDepartmentDefinedValue1: postData.postDepartmentDefinedValue1 || null,
            postDepartmentDefinedValue2: postData.postDepartmentDefinedValue2 || null,
            postDepartmentDefinedValue3: postData.postDepartmentDefinedValue3 || null,
            postDepartmentDefinedValue4: postData.postDepartmentDefinedValue4 || null,
            postDepartmentDefinedValue5: postData.postDepartmentDefinedValue5 || null,
            postDepartmentDefinedValue6: postData.postDepartmentDefinedValue6 || null,
            postDepartmentDefinedValue7: postData.postDepartmentDefinedValue7 || null,
            postDepartmentDefinedValue8: postData.postDepartmentDefinedValue8 || null,
            postDepartmentDefinedValue9: postData.postDepartmentDefinedValue9 || null,
            postDepartmentDefinedValue10: postData.postDepartmentDefinedValue10 || null,
            postApplyPremium: postData.postApplyPremium ?? false,
            // Store selected PayCodeID (Guid) from dropdown; null if not selected
            payCode: postData.payCode && String(postData.payCode).trim() ? postData.payCode : null,
            projectNumber: postData.projectNumber && String(postData.projectNumber).trim() ? postData.projectNumber : null,
            taskNumber: postData.taskNumber && String(postData.taskNumber).trim() ? postData.taskNumber : null,
            awardNumber: postData.awardNumber && String(postData.awardNumber).trim() ? postData.awardNumber : null,
            fundNumber: postData.fundNumber && String(postData.fundNumber).trim() ? postData.fundNumber : null,
            organizationNumber: postData.organizationNumber && String(postData.organizationNumber).trim() ? postData.organizationNumber : null,
            // organizationName not stored on save; kept on GET only
            // Selected Department Activity Type id from dropdown (stored in Post as DepartmentActivityTypeID)
            postDepartmentActivityTypeId: postData.postDepartmentActivityTypeId && String(postData.postDepartmentActivityTypeId).trim() ? postData.postDepartmentActivityTypeId : null,
            postUniform: postData.postUniform ?? false,
            postPositions: postData.postPositions || [], // Always include, even if empty array
            confirmScheduleChanges: postData.confirmScheduleChanges,
            confirmHardDeletePostCallSign:
                postData.confirmHardDeletePostCallSign === true ? true : undefined,
            hardDeletePostCallSignIDs:
                Array.isArray(postData.hardDeletePostCallSignIDs) &&
                postData.hardDeletePostCallSignIDs.length > 0
                    ? postData.hardDeletePostCallSignIDs
                    : undefined,
            // Create-only on backend; included when provided so new posts get PostCallSign rows.
            callSigns: Array.isArray(postData.callSigns) ? postData.callSigns : undefined,
        };

        // Transform to backend PascalCase format (backend post table has five PTAEO columns, no PtaeoCodeID)
        const transformedData: any = {
            PostID: cleanedData.postId || undefined,
            RequestID: cleanedData.requestID,
            PostParentID: cleanedData.postParentID || undefined,
            IsParent: cleanedData.isParent ?? false,
            IsExemptHours: cleanedData.exemptHours ?? false,
            DefineCallSign: cleanedData.defineCallSign ?? false,
            IsSupervisorPost: cleanedData.isSupervisorPost ?? false,
            IsAlcoholServedOrConsumed: cleanedData.isAlcoholServedOrConsumed ?? false,
            TotalPostPositions: cleanedData.totalPostPositions,
            RankEligible: cleanedData.rankEligible,
            RequiredRank: (cleanedData as any).requiredRank ?? 0,
            PostTitle: cleanedData.postTitle,
            PostDescription: (cleanedData.postDescription ?? '').toString(),
            PostStartTime:
                cleanedData.postStartTime != null && String(cleanedData.postStartTime).trim() !== ''
                    ? cleanedData.postStartTime
                    : undefined,
            PostEndTime:
                cleanedData.postEndTime != null && String(cleanedData.postEndTime).trim() !== ''
                    ? cleanedData.postEndTime
                    : undefined,
            PostLength: cleanedData.postLength || undefined,
            PostMinimumHoursRequired: cleanedData.postMinimumHoursRequired != null ? cleanedData.postMinimumHoursRequired : undefined,
            PostIsFlexible: cleanedData.postIsFlexible,
            PostPayRate: cleanedData.postPayRate ?? undefined,
            PostPremiumRate: cleanedData.postPremiumRate || undefined,
            PostRequiresVehicle: cleanedData.postRequiresVehicle,
            PostRequiresEquipment: cleanedData.postRequiresEquipment,
            IsSkillsRequired: cleanedData.isSkillsRequired || false,
            SkillIDs: cleanedData.isSkillsRequired && cleanedData.skillIDs && cleanedData.skillIDs.length > 0 ? cleanedData.skillIDs : undefined,
            EmployeeTypeID: cleanedData.employeeTypeID || undefined,
            PostNotes: cleanedData.postNotes || undefined,
            PostLocation: cleanedData.postLocation || undefined,
            FirstName: cleanedData.firstName || undefined,
            LastName: cleanedData.lastName || undefined,
            PrimaryEmail: cleanedData.primaryEmail || undefined,
            PrimaryPhone: cleanedData.primaryPhone || undefined,
            CellPhone: cleanedData.cellPhone || undefined,
            PostResponseAreaId: cleanedData.postResponseAreaId && String(cleanedData.postResponseAreaId).trim() ? cleanedData.postResponseAreaId : undefined,
            IsPostRequiredDocument: cleanedData.isPostRequiredDocument,
            PostDepartmentDefinedValue1: cleanedData.postDepartmentDefinedValue1 || undefined,
            PostDepartmentDefinedValue2: cleanedData.postDepartmentDefinedValue2 || undefined,
            PostDepartmentDefinedValue3: cleanedData.postDepartmentDefinedValue3 || undefined,
            PostDepartmentDefinedValue4: cleanedData.postDepartmentDefinedValue4 || undefined,
            PostDepartmentDefinedValue5: cleanedData.postDepartmentDefinedValue5 || undefined,
            PostDepartmentDefinedValue6: cleanedData.postDepartmentDefinedValue6 || undefined,
            PostDepartmentDefinedValue7: cleanedData.postDepartmentDefinedValue7 || undefined,
            PostDepartmentDefinedValue8: cleanedData.postDepartmentDefinedValue8 || undefined,
            PostDepartmentDefinedValue9: cleanedData.postDepartmentDefinedValue9 || undefined,
            PostDepartmentDefinedValue10: cleanedData.postDepartmentDefinedValue10 || undefined,
            ProjectNumber: cleanedData.projectNumber || undefined,
            TaskNumber: cleanedData.taskNumber || undefined,
            AwardNumber: cleanedData.awardNumber || undefined,
            FundNumber: cleanedData.fundNumber || undefined,
            OrganizationNumber: cleanedData.organizationNumber || undefined,
            // Backend now expects PayCodeID (Guid FK)
            PayCodeID: cleanedData.payCode || undefined,
            DepartmentActivityTypeId: cleanedData.postDepartmentActivityTypeId && String(cleanedData.postDepartmentActivityTypeId).trim() ? cleanedData.postDepartmentActivityTypeId : undefined,
            PostUniform: cleanedData.postUniform ?? false,
            PostPositions: cleanedData.postPositions || [], // Always include, even if empty array
            ConfirmScheduleChanges:
                typeof cleanedData.confirmScheduleChanges === 'boolean'
                    ? cleanedData.confirmScheduleChanges
                    : undefined,
            ConfirmHardDeletePostCallSign:
                cleanedData.confirmHardDeletePostCallSign === true ? true : undefined,
            HardDeletePostCallSignIDs:
                Array.isArray(cleanedData.hardDeletePostCallSignIDs) &&
                cleanedData.hardDeletePostCallSignIDs.length > 0
                    ? cleanedData.hardDeletePostCallSignIDs
                    : undefined,
            // Backend only persists CallSigns when creating a new post.
            ...(cleanedData.postId
                ? {}
                : { CallSigns: cleanedData.callSigns }),
            ...(postData.isCloned === true ? { IsCloned: true } : {}),
        };
        
        // Remove undefined values to keep payload clean
        Object.keys(transformedData).forEach(key => {
            if (transformedData[key] === undefined) {
                delete transformedData[key];
            }
        });
        
        const response = await apiPost('/Post', transformedData, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const responseText = await response.text();
        if (response.status === 409) {
            throw {
                status: 409 as const,
                ...parseJsonText<Record<string, unknown>>(responseText),
            };
        }
        if (!response.ok) {
            throw new ApiResponseError(
                getErrorMessageFromErrorResponse(responseText, 'Failed to save job'),
                {},
                response.status
            );
        }
        return normalizePost(parseJsonText<unknown>(responseText));
    } catch (error) {
        console.error('Error saving post:', error);
        throw error;
    }
};

/**
 * Get a single post by ID
 * @param postId - The ID of the post to fetch
 * @returns Promise<Post>
 */
export const getPostById = async (postId: string): Promise<Post> => {
    try {
        const response = await apiGet(`/Post/${postId}`);
        const responseText = await expectOkReadText(response, 'Failed to fetch job');
        return normalizePost(parseJsonText<unknown>(responseText));
    } catch (error) {
        console.error('Error fetching post by ID:', error);
        throw error;
    }
};

/**
 * Get eligible employees for a post
 * @param postId - The ID of the post
 * @returns Promise<EmployeeResponse[]>
 */
export const getEligibleEmployeesByPostId = async (postId: string): Promise<EmployeeResponse[]> => {
    try {
        const response = await apiGet(`/Post/${postId}/eligible-employees`);
        const responseText = await expectOkReadText(response, 'Failed to fetch eligible employees');
        const parsedData = parseJsonTextArray<Record<string, unknown>>(responseText);
        return parsedData.map(normalizeEmployee);
    } catch (error) {
        console.error('Error fetching eligible employees:', error);
        throw error;
    }
};

/**
 * Delete a post by ID
 * @param postId - The ID of the post to delete
 * @returns Promise<void>
 */
export const deletePost = async (postId: string): Promise<void> => {
    try {
        const response = await apiDelete(`/Post/${postId}`, {
            headers: {
                accept: '*/*',
            },
        });
        await readResponseOk(response, 'Failed to delete job');
    } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
    }
};

/**
 * Clone a post by ID
 * @param postId - The source post ID
 * @returns Promise<Post>
 */
export const clonePost = async (postId: string): Promise<Post> => {
    try {
        const response = await apiPost(`/Post/clone-post?postId=${encodeURIComponent(postId)}`, undefined, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const responseText = await readResponseOk(response, 'Failed to clone job');
        return normalizePost(parseJsonText<unknown>(responseText));
    } catch (error) {
        console.error('Error cloning post:', error);
        throw error;
    }
};

/** GET `/Post/post-employees-with-locations?postId=` */
export const getPostEmployeesWithLocations = async (
    postId: string
): Promise<PagedResponse<PostPositionEmployeeLocationDto>> => {
    const id = postId.trim();
    const response = await apiGet(
        `/Post/post-employees-with-locations?postId=${encodeURIComponent(id)}`
    );
    const responseText = await expectOkReadText(response, 'Failed to fetch post employee locations');
    const dto = parseJsonText<PagedResponse<PostPositionEmployeeLocationDto>>(responseText);
    const paged = parsePagedListDto<PostPositionEmployeeLocationDto>(responseText);
    return {
        ...dto,
        data: paged.data,
        totalRecords: paged.totalRecords,
    };
};
