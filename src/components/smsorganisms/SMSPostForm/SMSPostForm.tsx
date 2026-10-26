import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { Post, PostAssignmentWarningEmployee } from '@/types/post';
import type { PostCallSign } from '@/types/postCallSign';
import { FormMode } from '@/types/common';
import { POST, VALIDATION } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { RootState } from '@/store';
import {
    savePost,
    fetchPosts,
    clearError,
    isPostDecreasePositionsConflict,
} from '@/store/slices/postSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchSkillOptions } from '@/store/slices/skillSlice';
import { fetchEmployeeTypeById, fetchEmployeeTypeOptions } from '@/store/slices/employeeTypeSlice';
import { SMSAccordion, SMSBox, SMSButton, SMSCheckbox, SMSCurrencyInput, SMSDropdown, SMSGrid, SMSIcon, SMSLabel, SMSMultiSelectDropdown, SMSPaper, SMSStack, SMSTextArea, SMSTextField, SMSTimePicker, SMSTypography } from '@/components/smsatoms';
import { SMSDataDisplay as DataDisplay } from '@/components/smsmolecules';
import { FormViewSection } from '@/components/smsmolecules/FormViewSection/FormViewSection';
import { PostEquipmentList } from '@/components/smsmolecules/PostEquipmentList/PostEquipmentList';
import { PostEquipmentDto } from '@/services/postEquipmentService';
import { toEquipmentDatePickerBound } from '@/utils/equipmentEffectiveDates';
import {
    getRequestEquipment,
    normalizeRequestEquipmentRow,
    type RequestEquipmentDto,
} from '@/services/requestEquipmentService';
import type { PostCallSignDraft } from '@/types/postCallSign';
import {
    fetchPostEquipmentThunk,
    upsertPostEquipmentThunk,
    deletePostEquipmentThunk,
    clearPostEquipment
} from '@/store/slices/postEquipmentSlice';
import {
    fetchPostCallSignsThunk,
    bulkUpsertPostCallSignsThunk,
    clearPostCallSigns,
} from '@/store/slices/postCallSignSlice';
import type { PaginationParams } from '@/utils/paginationUtils';
import {
    isPostOwnedEquipment,
    mergeRequestAndPostEquipmentForPostForm,
} from '@/utils/postFormEquipmentMerge';
import { SMSContentTabs, SMSModal } from '@/components/smsorganisms';
import { fetchLatestPostNotes, upsertPostNoteThunk } from '@/store/slices/postNoteSlice';
import { fetchPayCodeOptions } from '@/store/slices/payCodeSlice';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { fetchDepartmentDefinedFieldsByDepartmentId } from '@/store/slices/departmentDefinedFieldsSlice';
import { buildDepartmentDefinedFieldBindings, getEmptyDepartmentDefinedFieldValues } from '@/utils/departmentDefinedFieldDefinitions';
import { fetchRequestById } from '@/store/slices/requestSlice';
import { fetchRequesterByIdThunk } from '@/store/slices/requesterSlice';
import { ptaeoCodeParts } from '@/types/ptaeoCode';
import { fetchPtaeoCodeById, fetchPtaeoCodeOptions } from '@/store/slices/ptaeoCodeSlice';
import { fetchDepartmentActivityTypeOptions } from '@/store/slices/departmentActivityTypeSlice';
import { fetchDepartmentResponseAreaOptions } from '@/store/slices/responseAreaSlice';
import { getSupervisorPosts, PostLookupDto } from '@/services/postService';
import {
    minutesToTimeString,
    timeStringToMinutes,
    formatTimeToHHmm,
    ensurePostEndTimeForPayload,
    durationMinutesClockToClock,
} from '@/utils/dateTimeUtils';
import { formatCurrency, formatDateShort, formatDuration, formatPhoneNumber, validateEmail } from '@/utils';
import './SMSPostForm.css';

interface SMSPostFormProps {
    post?: Post | null;
    requestID: string;
    onClose: () => void;
    onSaveSuccess: () => void;
    initialMode?: FormMode;
    /** Optional parent post ID to preselect when creating a child post from a supervisor post */
    parentPostIdForCreate?: string;
    /** Optional source post to clone from when creating a new post */
    cloneSourcePost?: Post;
    /** When true (e.g. after clone), highlight time fields and show a reminder to review them */
    highlightTimeFieldsFromClone?: boolean;
    /** When true (e.g. after clone), send isCloned on first post upsert */
    isCloned?: boolean;
    closeHandlerRef?: React.MutableRefObject<(() => void) | null>;
}

const EMPTY_ARRAY: any[] = [];

/** When true, Requires Document field is hidden from UI; data is still loaded/saved. */
const HIDE_REQUIRES_DOCUMENT_UI = true;

/** Keys for department-defined post values on Post (postDepartmentDefinedValue1..10) */
const POST_DEFINED_VALUE_KEYS = Array.from({ length: 10 }, (_, i) => `postDepartmentDefinedValue${i + 1}` as const);

const hasAnyNonEmpty = (obj: Record<string, unknown>, keys: readonly string[]): boolean =>
    keys.some((k) => {
        const v = obj[k];
        return v != null && String(v).trim() !== '';
    });

const normalizeDeptEquipmentId = (id: string | null | undefined): string =>
    String(id ?? '').trim().replace(/[{}()]/g, '').toLowerCase();

const postEquipmentLineKey = (item: PostEquipmentDto): string =>
    `${normalizeDeptEquipmentId(item.departmentEquipmentID)}|${item.isVehicle ? 'v' : 'e'}`;

/** Keep all rows from API; only pad when Total Positions needs more slots. Never drop loaded data. */
const padCallSignDrafts = (rows: PostCallSignDraft[], minCount: number): PostCallSignDraft[] => {
    const n = Math.max(1, Math.min(99, minCount || 1));
    if (rows.length >= n) return rows;
    return [
        ...rows,
        ...Array.from({ length: n - rows.length }, () => ({ callSign: '' })),
    ];
};

const rowsToCallSignDrafts = (
    rows: { postCallSignID?: string | null; callSign?: string | null }[],
    minCount: number
): PostCallSignDraft[] =>
    padCallSignDrafts(
        rows.map((row) => ({
            postCallSignID: row.postCallSignID ?? null,
            callSign: (row.callSign ?? '').trim(),
        })),
        minCount
    );

const POST_FORM_CALL_SIGN_LIST_PAGINATION: PaginationParams = {
    page: 1,
    pageSize: 5000,
    sortBy: 'CreatedDate',
    sortDirection: 'asc',
};

type PostContactFields = Pick<Post, 'firstName' | 'lastName' | 'primaryEmail' | 'primaryPhone' | 'cellPhone'>;

const getPostContactDefaultsFromRequest = (request: unknown): PostContactFields | null => {
    if (!request) return null;

    const req = (request ?? {}) as Record<string, unknown>;
    const isPostContactRaw = req.isPostContact ?? req.IsPostContact;
    const isPostContact =
        typeof isPostContactRaw === 'string'
            ? isPostContactRaw.trim().toLowerCase() === 'true'
            : Boolean(isPostContactRaw);

    if (!isPostContact) return null;

    return {
        firstName: String(req.firstName ?? req.FirstName ?? ''),
        lastName: String(req.lastName ?? req.LastName ?? ''),
        primaryEmail: String(req.primaryEmail ?? req.PrimaryEmail ?? ''),
        primaryPhone: formatPhoneNumber(String(req.primaryPhone ?? req.PrimaryPhone ?? '')),
        cellPhone: formatPhoneNumber(String(req.cellPhone ?? req.CellPhone ?? '')),
    };
};

const mergeRequestContactDefaults = (basePost: Post, requestContactDefaults: PostContactFields | null): Post => {
    if (!requestContactDefaults) return basePost;
    
    // Only merge request contact defaults if the post's contact fields are empty
    return {
        ...basePost,
        firstName: basePost.firstName || requestContactDefaults.firstName,
        lastName: basePost.lastName || requestContactDefaults.lastName,
        primaryEmail: basePost.primaryEmail || requestContactDefaults.primaryEmail,
        primaryPhone: basePost.primaryPhone || requestContactDefaults.primaryPhone,
        cellPhone: basePost.cellPhone || requestContactDefaults.cellPhone,
    };
};

/** Pay code UI: show title/value only */
const payCodeDisplayLabel = (
    payCodeValue: string | null | undefined
): string => {
    const value = (payCodeValue ?? '').trim();
    return value || '-';
};

const isPerJobEquipmentItem = (item: PostEquipmentDto): boolean =>
    !item.equipmentPerPostPosition;

const getPerJobPositionsGreaterThanQuantityMessage = (
    totalPositions: number,
    vehicles: PostEquipmentDto[]
): string | null => {
    const total = Math.floor(totalPositions);
    if (total <= 0) return null;

    // Per Shift vehicles only: extra positions will not receive a vehicle.
    // Per Shift equipment is not warned — the full quantity goes to one person.
    const vehicleHits = vehicles.filter(
        (item) =>
            isPerJobEquipmentItem(item) &&
            Number(item.equipmentQuantity) > 0 &&
            total > Number(item.equipmentQuantity)
    );
    if (vehicleHits.length === 0) return null;

    const details = vehicleHits
        .map((item) => {
            const name =
                item.equipmentName?.trim() ||
                item.equipmentTypeName?.trim() ||
                'Vehicle';
            return `${name}: ${item.equipmentQuantity}`;
        })
        .join(', ');

    return POST.FORM.PER_JOB_POSITIONS_GREATER_THAN_QUANTITY
        .replace('{positions}', String(total))
        .replace('{kind}', 'vehicle')
        .replace('{details}', details)
        .replace('{kindAssigned}', 'Vehicles');
};

const SMSPostForm: React.FC<SMSPostFormProps> = ({
    post,
    requestID,
    onClose,
    onSaveSuccess,
    initialMode = FormMode.VIEW,
    parentPostIdForCreate,
    cloneSourcePost,
    highlightTimeFieldsFromClone = false,
    isCloned = false,
    closeHandlerRef,
}) => {
    const dispatch = useAppDispatch();
    const isClonedRef = useRef(isCloned);

    const withClonePostFlag = (postData: Post): Post => {
        const { isCloned: _omit, ...rest } = postData;
        return isClonedRef.current ? { ...rest, isCloned: true } : rest;
    };

    const defaultPost: Post = {
        requestID: requestID,
        postParentID: null,
        isParent: true,
        exemptHours: false,
        defineCallSign: false,
        totalPostPositions: 1,
        rankEligible: true,
        postTitle: '',
        postDescription: '',
        postStartTime: '',
        postEndTime: '',
        postLength: 0,
        postMinimumHoursRequired: null,
        postIsFlexible: false,
        postPayRate: 0,
        postPremiumRate: 0,
        postRequiresVehicle: false,
        postRequiresEquipment: false,
        isSkillsRequired: false,
        skillIDs: [],
        employeeTypeID: null,
        postNotes: '',
        postLocation: '',
        firstName: '',
        lastName: '',
        primaryEmail: '',
        primaryPhone: '',
        cellPhone: '',
        postResponseAreaId: null,
        level: '',
        isPostRequiredDocument: false,
        isSupervisorPost: false,
        isAlcoholServedOrConsumed: false,
        postDepartmentDefinedValue1: '',
        postApplyPremium: false,
        postPtaeoCodeId: null,
        postUniform: true,
        postDepartmentActivityTypeId: null,
        projectNumber: null,
        taskNumber: null,
        awardNumber: null,
        fundNumber: null,
        organizationNumber: null,
        payCode: null,
    };
    const [mode, setMode] = useState<FormMode>(initialMode);
    const initialFormDataRef = useRef<Post | null>(post || defaultPost);

    const { skillOptions: skillSelectOptions } = useAppSelector((state) => state.skill);
    const { employeeTypeOptions: employeeTypeSelectOptions, selectedEmployeeType } = useAppSelector((state) => state.employeeType);
    const { ptaeoCodeOptions: ptaeoCodeSelectOptions } = useAppSelector((state) => state.ptaeoCode);
    const { departmentActivityTypeOptions: departmentActivityTypeSelectOptions } = useAppSelector(
        (state) => state.departmentActivityType
    );
    const { responseAreaOptions: responseAreaSelectOptions } = useAppSelector((state) => state.responseArea);
    const posts = useAppSelector((state) => state.post.postsByRequestId[requestID] || EMPTY_ARRAY);
    const { departmentVehicleOptions, departmentEquipmentOptions } = useAppSelector((state) => state.departmentEquipment);
    const { payCodeOptions: payCodeSelectOptions } = useAppSelector((state) => state.payCode);
    const { postEquipment: reduxPostEquipment, isLoading: isPostEquipLoading } = useAppSelector((state) => state.postEquipment);
    const { latestNotes, isLoadingLatest: isLoadingNotes } = useAppSelector((state) => state.postNote);
    const user = useAppSelector((state: RootState) => state.auth.user);
    const requests = useAppSelector((state) => state.request.requests);
    const requestForForm = requestID ? requests.find((r) => r.requestID === requestID) : null;
    const requestContactDefaults = useMemo(
        () => getPostContactDefaultsFromRequest(requestForForm),
        [requestForForm]
    );
    const requestEquipmentPeriodStart = requestForForm?.startDate ?? '';
    const requestEquipmentPeriodEnd = requestForForm?.endDate ?? '';
    const requestDepartmentId = requestForForm?.departmentID ?? (requestForForm as { DepartmentID?: string })?.DepartmentID;
    const effectiveDepartmentId = user?.departmentID ?? requestDepartmentId ?? null;
    const departmentConfig = useAppSelector((state) =>
        effectiveDepartmentId ? state.departmentConfiguration.configByDepartmentId[effectiveDepartmentId] ?? null : null
    );
    const isRequestAlcoholPermitRequired = requestForForm?.alcoholPermitRequired === true;
    const isPremiumPaidEvent =
        post?.isPremiumPaidEvent === true || requestForForm?.isPremiumPaidEvent === true;
    /** Mirrors JWT UseAgencyDefinedFields (employee login); not loaded from department configuration API. */
    const canShowAdditionalFields = user?.useAgencyDefinedFields === true;
    const { selectedDepartmentDefinedFields, isLoading: departmentDefinedFieldsLoading } = useAppSelector(
        (state) => state.departmentDefinedFields
    );

    // Ensure request is available for department config and request-level skill locks.
    useEffect(() => {
        if (requestID && !requestForForm) {
            dispatch(fetchRequestById(requestID));
        }
    }, [dispatch, requestID, requestForForm]);

    useEffect(() => {
        const requestSkillIDs =
            requestForForm?.isSkillRequired === true
                ? (requestForForm.skillIDs ?? []).map(String)
                : [];
        setRequestLockedSkillIDs(requestSkillIDs);
    }, [requestForForm?.isSkillRequired, requestForForm?.skillIDs]);

    useEffect(() => {
        const requesterID = requestForForm?.requesterID;
        if (!requesterID) {
            setRequesterLockedSkillIDs([]);
            return;
        }

        dispatch(fetchRequesterByIdThunk(requesterID))
            .unwrap()
            .then((requester) => {
                const requesterSkillIDs =
                    requester?.isSkillsRequired === true
                        ? (requester.skillIDs ?? []).map(String)
                        : [];
                setRequesterLockedSkillIDs(requesterSkillIDs);
            })
            .catch(() => {
                setRequesterLockedSkillIDs([]);
            });
    }, [dispatch, requestForForm?.requesterID]);

    const [formData, setFormData] = useState<Post>(post || defaultPost);
    const [notes, setNotes] = useState<string>('');
    const [comments, setComments] = useState<string>('');

    // Separate state for Vehicles and Equipment (like RequestForm)
    const [vehicleItems, setVehicleItems] = useState<PostEquipmentDto[]>([]);
    const [equipmentItems, setEquipmentItems] = useState<PostEquipmentDto[]>([]);
    const [requestEquipmentRows, setRequestEquipmentRows] = useState<RequestEquipmentDto[]>([]);

    const [deletedEquipmentIds, setDeletedEquipmentIds] = useState<string[]>([]);
    const [callSignItems, setCallSignItems] = useState<PostCallSignDraft[]>([{ callSign: '' }]);
    const initialCallSignItemsRef = useRef<PostCallSignDraft[]>([{ callSign: '' }]);
    const [isCallSignAccordionExpanded, setIsCallSignAccordionExpanded] = useState<boolean>(false);

    const handleDefineCallSignToggle = (checked: boolean) => {
        handleChange({ name: 'defineCallSign', value: checked });
        if (checked) {
            setIsCallSignAccordionExpanded(true);
            const callSignErrors: Record<string, string> = {};
            visibleCallSignItems.forEach((item, index) => {
                if (!(item.callSign ?? '').trim()) {
                    callSignErrors[`postCallSign-${index}`] = POST.ERRORS.CALL_SIGN_REQUIRED;
                }
            });
            setFormValidationErrors((prev) => ({
                ...prev,
                ...callSignErrors,
            }));
        } else {
            setIsCallSignAccordionExpanded(false);
            setCallSignItems((prev) => prev.map((item) => ({ ...item, callSign: '' })));
            setFormValidationErrors((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                    if (k.startsWith('postCallSign-')) delete next[k];
                });
                return next;
            });
        }
    };


    // Delete Confirmation State
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        item: PostEquipmentDto | null;
        type: 'vehicle' | 'equipment';
    }>({ isOpen: false, item: null, type: 'vehicle' });
    const [assignmentWarningState, setAssignmentWarningState] = useState<{
        isOpen: boolean;
        message: string;
        employees: PostAssignmentWarningEmployee[];
        pendingPost: Post | null;
        pendingTargetId: string | null;
    }>({
        isOpen: false,
        message: '',
        employees: [],
        pendingPost: null,
        pendingTargetId: null,
    });
    const [perJobPositionsWarning, setPerJobPositionsWarning] = useState<{
        isOpen: boolean;
        message: string;
    }>({ isOpen: false, message: '' });
    const skipPerJobPositionsWarningRef = useRef(false);
    const [isConfirmingScheduleChanges, setIsConfirmingScheduleChanges] = useState(false);
    const [positionsDecreaseConflict, setPositionsDecreaseConflict] = useState<{
        isOpen: boolean;
        message: string;
        pendingPost: Post | null;
        pendingTargetId: string | null;
        confirmScheduleChanges?: boolean;
        callSigns: PostCallSign[];
        requiresHardDeletePostCallSign: boolean;
        selectedCallSignIds: string[];
    }>({
        isOpen: false,
        message: '',
        pendingPost: null,
        pendingTargetId: null,
        confirmScheduleChanges: undefined,
        callSigns: [],
        requiresHardDeletePostCallSign: false,
        selectedCallSignIds: [],
    });
    const [isConfirmingPositionsDecrease, setIsConfirmingPositionsDecrease] = useState(false);

    const [savedPostID, setSavedPostID] = useState<string | null>(post?.postId || null);
    const [, setStep1Error] = useState<string | null>(null);
    /** Per-field validation errors (e.g. Start Time required), shown like Close Post Form */
    const [formValidationErrors, setFormValidationErrors] = useState<Record<string, string>>({});
    /** Tracks whether user manually changed minimum hours, to stop auto-sync from start/end duration. */
    const [isMinimumHoursManuallyEdited, setIsMinimumHoursManuallyEdited] = useState(false);
    /** Clock end time (HH:mm) for UI; job length is derived from start + end. */
    const [endTime, setEndTime] = useState('');

    const [supervisorPosts, setSupervisorPosts] = useState<PostLookupDto[]>([]);
    const [loadingSupervisorPosts, setLoadingSupervisorPosts] = useState(false);

    // State for toggling additional fields visibility
    const [showAdditionalFields, setShowAdditionalFields] = useState(false);
    const [requestLockedSkillIDs, setRequestLockedSkillIDs] = useState<string[]>([]);
    const [requesterLockedSkillIDs, setRequesterLockedSkillIDs] = useState<string[]>([]);

    const postDeptFieldFallbackLabels = useMemo(
        () => Array.from({ length: 10 }, (_, index) => `Dept Field ${index + 1}`),
        []
    );

    const postDeptFieldBindings = useMemo(
        () => buildDepartmentDefinedFieldBindings('post', selectedDepartmentDefinedFields, postDeptFieldFallbackLabels),
        [selectedDepartmentDefinedFields, postDeptFieldFallbackLabels]
    );

    const shouldFetchDeptFieldLabels = canShowAdditionalFields &&!!effectiveDepartmentId &&
        (showAdditionalFields || hasAnyNonEmpty(formData as unknown as Record<string, unknown>, POST_DEFINED_VALUE_KEYS));

    useEffect(() => {
        if (!shouldFetchDeptFieldLabels || !effectiveDepartmentId) return;
        dispatch(fetchDepartmentDefinedFieldsByDepartmentId(effectiveDepartmentId));
    }, [dispatch, shouldFetchDeptFieldLabels, effectiveDepartmentId]);

    const isCreateMode = mode === FormMode.CREATE && !post;
    const isCreateFromSupervisor = isCreateMode && !!parentPostIdForCreate;
    const isCloneMode = isCreateMode && !!cloneSourcePost;
    const isFirstPostForRequest = isCreateMode && posts.length === 0;
    const postLockedSkillIDs = useMemo(
        () => Array.from(new Set([...requestLockedSkillIDs, ...requesterLockedSkillIDs])),
        [requestLockedSkillIDs, requesterLockedSkillIDs]
    );

    useEffect(() => {
        if (postLockedSkillIDs.length === 0) return;
        setFormData((prev) => ({
            ...prev,
            isSkillsRequired: true,
            skillIDs: Array.from(new Set([...(prev.skillIDs ?? []), ...postLockedSkillIDs])),
        }));
    }, [postLockedSkillIDs]);

    const ptaeoCodeOptions = useMemo(() => {
        const base = (ptaeoCodeSelectOptions ?? []).map((item) => ({
            label: item.label || '-',
            value: item.id != null ? String(item.id).trim() : '',
        }));
        const selected = formData.postPtaeoCodeId?.trim();
        if (!selected || base.some((o) => o.value === selected)) return base;
        return [...base, { value: selected, label: 'Loading...' }];
    }, [ptaeoCodeSelectOptions, formData.postPtaeoCodeId]);

    /** Dropdown options: value = departmentActivityTypeId, label = activityTypeShort */
    const departmentActivityTypeOptions = useMemo(() => {
        const base = (departmentActivityTypeSelectOptions ?? []).map((item) => ({
            label: (item.label ?? '').trim() || '-',
            value: item.id != null ? String(item.id).trim() : '',
        }));
        const selected = formData.postDepartmentActivityTypeId != null
            ? String(formData.postDepartmentActivityTypeId).trim()
            : '';
        if (!selected || base.some((o) => o.value === selected)) return base;
        return [
            ...base,
            {
                value: selected,
                label: (formData.postDepartmentActivityTypeName ?? '').trim() || 'Loading...',
            },
        ];
    }, [
        departmentActivityTypeSelectOptions,
        formData.postDepartmentActivityTypeId,
        formData.postDepartmentActivityTypeName,
    ]);

    const payCodeOptions = useMemo(
        () =>
            (payCodeSelectOptions ?? []).map((item) => ({
                label: item.label || '-',
                value: item.id != null ? String(item.id).trim() : '',
            })),
        [payCodeSelectOptions]
    );

    const selectedPayCodeIdRef = useRef(formData.payCode ?? '');
    selectedPayCodeIdRef.current = formData.payCode ?? '';

    const handlePayCodeSearchInputChange = useCallback(
        (value: string) => {
            const selectedId = selectedPayCodeIdRef.current.trim() || undefined;
            return dispatch(fetchPayCodeOptions({ searchTerm: value, selectedId }))
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch]
    );

    const selectedEmployeeTypeIdRef = useRef(formData.employeeTypeID ?? '');
    selectedEmployeeTypeIdRef.current = formData.employeeTypeID ?? '';
    const isSupervisorPostRef = useRef(formData.isSupervisorPost);
    isSupervisorPostRef.current = formData.isSupervisorPost;

    const handleEmployeeTypeSearchInputChange = useCallback(
        (value: string) => {
            const selectedId = selectedEmployeeTypeIdRef.current.trim() || undefined;
            return dispatch(
                fetchEmployeeTypeOptions({
                    searchTerm: value,
                    selectedId,
                    isSupervisorPost: isSupervisorPostRef.current,
                })
            )
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch]
    );

    const selectedDeptActivityTypeIdRef = useRef(
        formData.postDepartmentActivityTypeId != null ? String(formData.postDepartmentActivityTypeId) : ''
    );
    selectedDeptActivityTypeIdRef.current =
        formData.postDepartmentActivityTypeId != null ? String(formData.postDepartmentActivityTypeId) : '';

    const handleDepartmentActivityTypeSearchInputChange = useCallback(
        (value: string) => {
            const selectedId = selectedDeptActivityTypeIdRef.current.trim() || undefined;
            return dispatch(fetchDepartmentActivityTypeOptions({ searchTerm: value, selectedId }))
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch]
    );

    const selectedResponseAreaIdRef = useRef(
        formData.postResponseAreaId != null ? String(formData.postResponseAreaId) : ''
    );
    selectedResponseAreaIdRef.current =
        formData.postResponseAreaId != null ? String(formData.postResponseAreaId) : '';

    const handleResponseAreaSearchInputChange = useCallback(
        (value: string) => {
            const selectedId = selectedResponseAreaIdRef.current.trim() || undefined;
            return dispatch(fetchDepartmentResponseAreaOptions({ searchTerm: value, selectedId }))
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch]
    );

    const selectedPtaeoCodeIdRef = useRef(formData.postPtaeoCodeId ?? '');
    selectedPtaeoCodeIdRef.current = formData.postPtaeoCodeId ?? '';

    const handlePtaeoCodeSearchInputChange = useCallback(
        (value: string) => {
            const selectedId = selectedPtaeoCodeIdRef.current.trim() || undefined;
            return dispatch(fetchPtaeoCodeOptions({ searchTerm: value, selectedId }))
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch]
    );

    // Post equipment options are loaded by SMSPostForm when vehicle/equipment is required.
    // We'll keep it here and REMOVE from PostEquipmentList to have a single source of truth for the form.

    const hasFetchedPostSkillsRef = useRef(false);
    useEffect(() => {
        if (!departmentConfig?.skills || !effectiveDepartmentId) {
            hasFetchedPostSkillsRef.current = false;
            return;
        }
        if (hasFetchedPostSkillsRef.current) return;
        hasFetchedPostSkillsRef.current = true;
        dispatch(fetchSkillOptions());
    }, [dispatch, departmentConfig?.skills, effectiveDepartmentId]);

    useEffect(() => {
        dispatch(
            fetchEmployeeTypeOptions({
                ...(formData.employeeTypeID?.trim() ? { selectedId: formData.employeeTypeID.trim() } : {}),
                isSupervisorPost: formData.isSupervisorPost,
            })
        );
    }, [dispatch, formData.employeeTypeID, formData.isSupervisorPost]);

    useEffect(() => {
        const selectedId = formData.employeeTypeID?.trim();
        if (!selectedId) return;
        void dispatch(fetchEmployeeTypeById(selectedId)).catch(() => undefined);
    }, [dispatch, formData.employeeTypeID]);

    useEffect(() => {
        const selectedId = formData.postDepartmentActivityTypeId
            ? String(formData.postDepartmentActivityTypeId).trim()
            : '';
        if (!selectedId) return;
        dispatch(fetchDepartmentActivityTypeOptions({ selectedId }));
    }, [dispatch, formData.postDepartmentActivityTypeId]);

    useEffect(() => {
        const selectedId = formData.postResponseAreaId ? String(formData.postResponseAreaId).trim() : '';
        if (!selectedId) return;
        dispatch(fetchDepartmentResponseAreaOptions({ selectedId }));
    }, [dispatch, formData.postResponseAreaId]);

    useEffect(() => {
        const selectedId = formData.postPtaeoCodeId?.trim();
        if (!selectedId) return;
        dispatch(fetchPtaeoCodeOptions({ selectedId }));
    }, [dispatch, formData.postPtaeoCodeId]);

    // Create mode only: lightweight list check for "first post on request" (edit/view loads post via GET /Post/{id} in PostFormPage)
    useEffect(() => {
        if (isCreateMode && requestID && posts.length === 0) {
            dispatch(fetchPosts({ requestID }));
        }
    }, [dispatch, requestID, posts.length, isCreateMode]);

    useEffect(() => {
        if (effectiveDepartmentId) {
            dispatch(fetchDepartmentConfigByDepartmentId(effectiveDepartmentId));
        }
    }, [dispatch, effectiveDepartmentId]);

    useEffect(() => {
        const loadSupervisorPosts = async () => {
            try {
                setLoadingSupervisorPosts(true);
                const data = await getSupervisorPosts(requestID || undefined);
                setSupervisorPosts(data);
            } catch (error) {
                console.error(error);
                dispatch(showToast('Failed to load supervisor jobs', 'error'));
            } finally {
                setLoadingSupervisorPosts(false);
            }
        };

        loadSupervisorPosts();
    }, [dispatch, requestID]);

    // When creating a new post and there are no supervisor posts (dropdown is empty),
    // keep "Is Parent" checked by default.
    // Note: we no longer need a separate auto-set ref; initial create-state
    // is derived from whether there are existing posts for this request.

    // When opening the form from a supervisor post's "Create Post" action,
    // preselect that supervisor as the parent post.
    useEffect(() => {
        if (
            isCreateFromSupervisor &&
            supervisorPosts.length > 0 &&
            !formData.postParentID
        ) {
            const exists = supervisorPosts.some((p) => p.postId === parentPostIdForCreate);
            if (!exists) {
                return;
            }

            setFormData((prev) => ({
                ...prev,
                isParent: false,
                postParentID: parentPostIdForCreate,
            }));
        }
    }, [isCreateFromSupervisor, parentPostIdForCreate, supervisorPosts, formData.postParentID]);

    // State for initial data comparison
    const initialVehicleItemsRef = useRef<PostEquipmentDto[]>([]);
    const initialEquipmentItemsRef = useRef<PostEquipmentDto[]>([]);
    const requestRequiresAutoSetDoneRef = useRef(false);
    const excludedRequestTemplateKeysRef = useRef<Set<string>>(new Set());

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            dispatch(clearPostEquipment());
        };
    }, [dispatch]);

    useEffect(() => {
        let cancelled = false;

        const resolvePtaeoCodeId = async (source: {
            projectNumber?: string | null;
            taskNumber?: string | null;
            awardNumber?: string | null;
            fundNumber?: string | null;
            organizationNumber?: string | null;
            postPtaeoCodeId?: string | null;
        }): Promise<string | null> => {
            const existingId = source.postPtaeoCodeId?.trim();
            if (existingId) return existingId;

            const searchTerm = [
                source.projectNumber,
                source.taskNumber,
                source.awardNumber,
                source.fundNumber,
                source.organizationNumber,
            ]
                .map((part) => (part ?? '').trim())
                .filter(Boolean)
                .join('.');
            if (!searchTerm) return null;

            try {
                const options = await dispatch(fetchPtaeoCodeOptions({ searchTerm })).unwrap();
                const match = options.find(
                    (o) => (o.label ?? '').trim().toLowerCase() === searchTerm.toLowerCase()
                );
                return match?.id != null ? String(match.id).trim() : null;
            } catch {
                return null;
            }
        };

        const applyPostInit = async () => {
            if (post) {
                const hasPtaeoFields = !!(
                    (post.projectNumber ?? '').trim() ||
                    (post.taskNumber ?? '').trim() ||
                    (post.awardNumber ?? '').trim() ||
                    (post.fundNumber ?? '').trim() ||
                    (post.organizationNumber ?? '').trim()
                );
                const matchedPtaeoId = await resolvePtaeoCodeId({
                    ...post,
                    postPtaeoCodeId: post.postPtaeoCodeId,
                });

                if (cancelled) return;

            const normalizedPostFromDb: Post = {
                ...post,
                primaryPhone: formatPhoneNumber(post.primaryPhone ?? ''),
                cellPhone: formatPhoneNumber(post.cellPhone ?? ''),
                employeeTypeID: post.employeeTypeID ?? null,
                projectNumber: post.projectNumber ?? null,
                taskNumber: post.taskNumber ?? null,
                awardNumber: post.awardNumber ?? null,
                fundNumber: post.fundNumber ?? null,
                organizationNumber: post.organizationNumber ?? null,
                postPtaeoCodeId: matchedPtaeoId,
                postApplyPremium: post.postApplyPremium ?? hasPtaeoFields,
                isParent: post.isParent ?? !!post.postParentID,
                defineCallSign: post.defineCallSign ?? false,
                postStartTime: formatTimeToHHmm(post.postStartTime) ?? '',
            };
            const initializedPost = mergeRequestContactDefaults(normalizedPostFromDb, requestContactDefaults);
            setFormData(initializedPost);
            if (initializedPost.defineCallSign) {
                setIsCallSignAccordionExpanded(true);
            }
            setEndTime(formatTimeToHHmm(initializedPost.postEndTime) ?? '');
            initialFormDataRef.current = initializedPost;
            setSavedPostID(post.postId || null);
            setShowAdditionalFields(hasAnyNonEmpty(post as unknown as Record<string, unknown>, POST_DEFINED_VALUE_KEYS));
            if (post.postId) {
                dispatch(fetchPostEquipmentThunk(post.postId));
                dispatch(fetchPostCallSignsThunk({ postId: post.postId, pagination: POST_FORM_CALL_SIGN_LIST_PAGINATION }))
                    .unwrap()
                    .then((rows) => {
                        const drafts = rowsToCallSignDrafts(
                            rows,
                            post.isSupervisorPost ? 1 : post.totalPostPositions || 1
                        );
                        setCallSignItems(drafts);
                        initialCallSignItemsRef.current = drafts;
                        const hasCallSigns = rows.some((r) => (r.callSign ?? '').trim() !== '');
                        if (post.defineCallSign == null && hasCallSigns) {
                            setFormData((prev) => ({ ...prev, defineCallSign: true }));
                            initialFormDataRef.current = {
                                ...(initialFormDataRef.current ?? initializedPost),
                                defineCallSign: true,
                            };
                            setIsCallSignAccordionExpanded(true);
                        } else if (post.defineCallSign || hasCallSigns) {
                            setIsCallSignAccordionExpanded(true);
                        }
                    })
                    .catch(() => {
                        const drafts = rowsToCallSignDrafts(
                            [],
                            post.isSupervisorPost ? 1 : post.totalPostPositions || 1
                        );
                        setCallSignItems(drafts);
                        initialCallSignItemsRef.current = drafts;
                    });
                    if (mode === FormMode.EDIT) {
                        dispatch(fetchLatestPostNotes(post.postId));
                    }
                }
            } else if (cloneSourcePost && isCloneMode) {
                const source = cloneSourcePost;
                const hasPtaeoFields = !!(
                    (source.projectNumber ?? '').trim() ||
                    (source.taskNumber ?? '').trim() ||
                    (source.awardNumber ?? '').trim() ||
                    (source.fundNumber ?? '').trim() ||
                    (source.organizationNumber ?? '').trim()
                );
                const matchedPtaeoId = await resolvePtaeoCodeId(source);

                if (cancelled) return;

            const initializedClone = mergeRequestContactDefaults({
                ...defaultPost,
                ...source,
                primaryPhone: formatPhoneNumber(source.primaryPhone ?? ''),
                cellPhone: formatPhoneNumber(source.cellPhone ?? ''),
                postId: null,
                requestID,
                employeeTypeID: source.employeeTypeID ?? null,
                projectNumber: source.projectNumber ?? null,
                taskNumber: source.taskNumber ?? null,
                awardNumber: source.awardNumber ?? null,
                fundNumber: source.fundNumber ?? null,
                organizationNumber: source.organizationNumber ?? null,
                postPtaeoCodeId: matchedPtaeoId,
                postApplyPremium: source.postApplyPremium ?? hasPtaeoFields,
                isParent: source.isParent ?? !!source.postParentID,
                defineCallSign: source.defineCallSign ?? false,
                postStartTime: formatTimeToHHmm(source.postStartTime) ?? '',
                createdDate: undefined,
                createdUserID: undefined,
                createdBy: undefined,
                editedDate: null,
                editedUserID: null,
                editedBy: null,
            }, requestContactDefaults);

                setFormData(initializedClone);
                setEndTime(formatTimeToHHmm(initializedClone.postEndTime) ?? '');
                initialFormDataRef.current = initializedClone;
                setSavedPostID(null);
                setShowAdditionalFields(hasAnyNonEmpty(source as unknown as Record<string, unknown>, POST_DEFINED_VALUE_KEYS));
                setVehicleItems([]);
                setEquipmentItems([]);
                initialVehicleItemsRef.current = [];
                initialEquipmentItemsRef.current = [];
                requestRequiresAutoSetDoneRef.current = false;
                excludedRequestTemplateKeysRef.current = new Set();
                setDeletedEquipmentIds([]);
                setNotes('');
                setComments('');

                if (source.postId) {
                    dispatch(fetchPostEquipmentThunk(source.postId));
                    dispatch(fetchPostCallSignsThunk({ postId: source.postId, pagination: POST_FORM_CALL_SIGN_LIST_PAGINATION }))
                    .unwrap()
                    .then((rows) => {
                        const drafts = rowsToCallSignDrafts(
                            rows,
                            source.isSupervisorPost ? 1 : source.totalPostPositions || 1
                        ).map((d) => ({ callSign: d.callSign }));
                        setCallSignItems(drafts);
                        initialCallSignItemsRef.current = drafts;
                    })
                    .catch(() => {
                        const drafts = rowsToCallSignDrafts(
                            [],
                            source.isSupervisorPost ? 1 : source.totalPostPositions || 1
                        );
                        setCallSignItems(drafts);
                        initialCallSignItemsRef.current = drafts;
                    });
            }
            } else {
                const basePost = mergeRequestContactDefaults({
                    ...defaultPost,
                    isParent: true,
                    postParentID: null,
                }, requestContactDefaults);

                setFormData(basePost);
                setEndTime('');
                initialFormDataRef.current = basePost;
                setVehicleItems([]);
                setEquipmentItems([]);
                initialVehicleItemsRef.current = [];
                initialEquipmentItemsRef.current = [];
                requestRequiresAutoSetDoneRef.current = false;
                excludedRequestTemplateKeysRef.current = new Set();
                setSavedPostID(null);
                dispatch(clearPostEquipment());
                dispatch(clearPostCallSigns());
            setNotes('');
                setComments('');
                setShowAdditionalFields(false);
                const emptyCallSigns = rowsToCallSignDrafts([], 1);
            setCallSignItems(emptyCallSigns);
            initialCallSignItemsRef.current = emptyCallSigns;
        }
        };

        void applyPostInit();
        return () => {
            cancelled = true;
        };
    }, [post, requestID, dispatch, mode, cloneSourcePost, isCloneMode, posts.length, requestContactDefaults]);

    // When Is Supervisor Post is true, keep Total Positions at 1 (e.g. when loading an existing supervisor post)
    useEffect(() => {
        if (formData.isSupervisorPost && formData.totalPostPositions !== 1) {
            setFormData((prev) => ({ ...prev, totalPostPositions: 1 }));
        }
    }, [formData.isSupervisorPost]);

    // Grow call-sign slots when Total Positions increases; never drop loaded/edited values when it decreases.
    useEffect(() => {
        const count = formData.isSupervisorPost ? 1 : Math.max(1, formData.totalPostPositions || 1);
        setCallSignItems((prev) => padCallSignDrafts(prev, count));
    }, [formData.totalPostPositions, formData.isSupervisorPost]);

    const visibleCallSignCount = formData.isSupervisorPost
        ? 1
        : Math.max(1, formData.totalPostPositions || 1);
    const visibleCallSignItems = useMemo(
        () => callSignItems.slice(0, visibleCallSignCount),
        [callSignItems, visibleCallSignCount]
    );

    useEffect(() => {
        if (!requestID) {
            setRequestEquipmentRows([]);
            return;
        }
        let cancelled = false;
        const embedded = requestForForm?.requestEquipment;
        if (embedded && embedded.length > 0) {
            setRequestEquipmentRows(embedded.map(normalizeRequestEquipmentRow));
            return;
        }
        void getRequestEquipment(requestID).then((rows) => {
            if (!cancelled) setRequestEquipmentRows(rows);
        });
        return () => {
            cancelled = true;
        };
    }, [requestID, requestForForm?.requestEquipment]);

    useEffect(() => {
        const postOnlyRows: PostEquipmentDto[] = [];
        reduxPostEquipment.forEach((item) => {
            const deptId = normalizeDeptEquipmentId(item.departmentEquipmentID);
            if (!deptId) return;
            const baseItem: PostEquipmentDto = isCloneMode
                ? {
                    ...item,
                    postEquipmentID: undefined,
                    postID: null,
                }
                : { ...item };
            postOnlyRows.push(baseItem);
        });

        const effectivePostId = String(formData.postId ?? post?.postId ?? '').trim();
        const requestVehicles = isCreateMode
            ? requestEquipmentRows.filter((r) => r.isVehicle)
            : [];
        const requestEquipment = isCreateMode
            ? requestEquipmentRows.filter((r) => !r.isVehicle)
            : [];
        const postVehicles = postOnlyRows.filter((r) => r.isVehicle);
        const postEquipmentOnly = postOnlyRows.filter((r) => !r.isVehicle);

        const mergedVehicles = mergeRequestAndPostEquipmentForPostForm(
            requestVehicles,
            postVehicles,
            effectivePostId
        );
        const mergedEquipment = mergeRequestAndPostEquipmentForPostForm(
            requestEquipment,
            postEquipmentOnly,
            effectivePostId
        );

        if (isCreateMode && !requestRequiresAutoSetDoneRef.current && (mergedVehicles.length > 0 || mergedEquipment.length > 0)) {
            requestRequiresAutoSetDoneRef.current = true;
            setFormData((prev) => ({
                ...prev,
                postRequiresVehicle: mergedVehicles.length > 0 ? true : prev.postRequiresVehicle,
                postRequiresEquipment: mergedEquipment.length > 0 ? true : prev.postRequiresEquipment,
            }));
        }

        const withoutExcludedTemplates = (items: PostEquipmentDto[]) =>
            items.filter((i) => !excludedRequestTemplateKeysRef.current.has(postEquipmentLineKey(i)));

        const displayVehicles = formData.postRequiresVehicle
            ? withoutExcludedTemplates(mergedVehicles)
            : [];
        const displayEquipment = formData.postRequiresEquipment
            ? withoutExcludedTemplates(mergedEquipment)
            : [];

        const mergeWithPending = (
            fromDisplay: PostEquipmentDto[],
            prev: PostEquipmentDto[]
        ): PostEquipmentDto[] => {
            const pending = prev.filter((i) => {
                if (i.postEquipmentID) return false;
                const key = postEquipmentLineKey(i);
                const inDisplay = fromDisplay.some((d) => postEquipmentLineKey(d) === key);
                return !inDisplay;
            });
            const displayKeys = new Set(fromDisplay.map(postEquipmentLineKey));
            return [
                ...fromDisplay,
                ...pending.filter((p) => !displayKeys.has(postEquipmentLineKey(p))),
            ];
        };

        if (formData.postRequiresVehicle) {
            setVehicleItems((prev) => mergeWithPending(displayVehicles, prev));
        } else {
            setVehicleItems([]);
        }
        if (formData.postRequiresEquipment) {
            setEquipmentItems((prev) => mergeWithPending(displayEquipment, prev));
        } else {
            setEquipmentItems([]);
        }
        initialVehicleItemsRef.current = displayVehicles;
        initialEquipmentItemsRef.current = displayEquipment;
    }, [reduxPostEquipment, requestEquipmentRows, isCloneMode, isCreateMode, formData.postId, formData.postRequiresVehicle, formData.postRequiresEquipment, post?.postId]);

    // ... (keep skillOptions and parentPostOptions logic)
    const skillOptions = useMemo(() => {
        return (skillSelectOptions ?? []).map((s) => ({
            label: s.label || 'Unknown Skill',
            value: s.id != null ? String(s.id) : '',
        }));
    }, [skillSelectOptions]);

    const employeeTypeOptions = useMemo(() => {
        const base = (employeeTypeSelectOptions ?? []).map((e) => ({
            label: (e.label ?? '').trim() || 'Unknown Employee Type',
            value: e.id != null ? String(e.id).trim() : '',
        })).filter((o) => o.value);

        const selected = formData.employeeTypeID != null ? String(formData.employeeTypeID).trim() : '';
        if (!selected || base.some((o) => o.value === selected)) return base;

        const typeName =
            selectedEmployeeType &&
            String(selectedEmployeeType.employeeTypeID).trim() === selected
                ? (selectedEmployeeType.employeeTypeShort?.trim() ||
                  selectedEmployeeType.employeeTypeLong?.trim() ||
                  '')
                : '';

        return [{ value: selected, label: typeName || 'Loading...' }, ...base];
    }, [employeeTypeSelectOptions, formData.employeeTypeID, selectedEmployeeType]);

    const parentPostOptions = useMemo(() => {
        return posts
            .filter(p => p.postId !== formData.postId && p.isSupervisorPost === true)
            .map(p => ({
                label: p.postTitle,
                value: p.postId!
            }));
    }, [posts, formData.postId]);

    const responseAreaOptions = useMemo(() => {
        const base = (responseAreaSelectOptions ?? []).map((r) => ({
            label: r.label || '-',
            value: r.id != null ? String(r.id) : '',
        }));
        const selected = formData.postResponseAreaId != null ? String(formData.postResponseAreaId).trim() : '';
        if (!selected || base.some((o) => o.value === selected)) return base;
        return [
            ...base,
            {
                value: selected,
                label: (formData.postResponseAreaName ?? '').trim() || 'Loading...',
            },
        ];
    }, [responseAreaSelectOptions, formData.postResponseAreaId, formData.postResponseAreaName]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { name: string, value: any }) => {
        let name: string;
        let value: any;

        if ('target' in e) {
            name = e.target.name;
            value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
            // Format time values to HH:mm (remove seconds if present)
            if (name === 'postStartTime' && typeof value === 'string') {
                value = formatTimeToHHmm(value);
            }
        } else {
            name = e.name;
            value = e.value;
            // Format time values to HH:mm (remove seconds if present)
            if (name === 'postStartTime' && typeof value === 'string') {
                value = formatTimeToHHmm(value);
            }
        }

        // Clear validation error for the field being changed
        if (['postTitle', 'postDescription', 'totalPostPositions', 'postStartTime', 'postEndTime', 'postLength', 'postMinimumHoursRequired', 'postLocation', 'postPayRate', 'postPremiumRate', 'employeeTypeID', 'firstName', 'lastName', 'primaryEmail', 'primaryPhone'].includes(name)) {
            setFormValidationErrors((prev) => ({ ...prev, [name]: '' }));
        }
        if (['projectNumber', 'taskNumber', 'awardNumber', 'fundNumber', 'organizationNumber'].includes(name)) {
            setFormValidationErrors((prev) => ({ ...prev, postPtaeoCodeId: '' }));
        }
        if (name === 'defineCallSign' && value === false) {
            setFormValidationErrors((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                    if (k.startsWith('postCallSign-')) delete next[k];
                });
                return next;
            });
        }
        if (name === 'isSupervisorPost') {
            setFormValidationErrors((prev) => ({ ...prev, employeeTypeID: '' }));
        }

        // When "Requires Vehicle" is unchecked, mark current vehicles for deletion (delete API called on Save)
        if (name === 'postRequiresVehicle' && value === false) {
            const vehicleIdsToDelete = vehicleItems
                .filter((i): i is PostEquipmentDto & { postEquipmentID: string } => !!i.postEquipmentID)
                .map((i) => i.postEquipmentID);
            if (vehicleIdsToDelete.length > 0) {
                setDeletedEquipmentIds((prev) => [...prev, ...vehicleIdsToDelete]);
            }
            setVehicleItems([]);
            setFormValidationErrors((prev) => ({ ...prev, vehicles: '' }));
        }

        // When "Requires Equipment" is unchecked, mark current equipment items for deletion.
        if (name === 'postRequiresEquipment' && value === false) {
            const equipmentIdsToDelete = equipmentItems
                .filter((i): i is PostEquipmentDto & { postEquipmentID: string } => !!i.postEquipmentID)
                .map((i) => i.postEquipmentID);
            if (equipmentIdsToDelete.length > 0) {
                setDeletedEquipmentIds((prev) => [...prev, ...equipmentIdsToDelete]);
            }
            setEquipmentItems([]);
            setFormValidationErrors((prev) => ({ ...prev, equipment: '' }));
        }

        setFormData((prev) => {
            const updated: Post = {
                ...prev,
                [name]: value,
            };

            // Clear skillIDs when isSkillsRequired is unchecked
            if (name === 'isSkillsRequired' && value === false) {
                if (postLockedSkillIDs.length > 0) {
                    updated.isSkillsRequired = true;
                    return updated;
                }
                updated.skillIDs = [];
            }
            // Clear postParentID when this post is marked as parent
            if (name === 'isParent' && value === true) {
                updated.postParentID = null;
            }
            // When Is Supervisor Post is true, set Total Positions to 1
            if (name === 'isSupervisorPost') {
                if (value === true) {
                    updated.totalPostPositions = 1;
                }
                if (updated.employeeTypeID) {
                    updated.employeeTypeID = null;
                    updated.postPayRate = 0;
                    updated.postPremiumRate = 0;
                }
            }

            return updated;
        });
    };

    const handleParentChange = (value: string) => {
        setFormValidationErrors((prev) => ({ ...prev, postParentID: '' }));
        setFormData(prev => ({ ...prev, postParentID: value }));
    };

    // Parent post required when: Is Supervisor Post NOT selected AND department has isSupervisorRequired AND total positions > numberOfPositionsPerSupervisor
    const isParentPostRequiredByConfig = useMemo(() => {
        // Top-level parent posts should never require their own parent
        if (formData.isParent) return false;
        if (formData.isSupervisorPost) return false;
        if (!departmentConfig?.isSupervisorRequired) return false;
        const total = formData.totalPostPositions ?? 0;
        const maxPerSupervisor = departmentConfig?.numberOfPositionsPerSupervisor ?? 0;
        return total > maxPerSupervisor;
    }, [
        formData.isParent,
        formData.isSupervisorPost,
        formData.totalPostPositions,
        departmentConfig?.isSupervisorRequired,
        departmentConfig?.numberOfPositionsPerSupervisor,
    ]);

    const buildPostEquipmentUpsertPayload = (
        item: PostEquipmentDto,
        postId: string
    ): PostEquipmentDto => ({
        postEquipmentID: item.postEquipmentID,
        postID: postId,
        departmentEquipmentID: item.departmentEquipmentID,
        equipmentPerPostPosition: item.equipmentPerPostPosition,
        equipmentQuantity: item.equipmentQuantity,
        isVehicle: item.isVehicle,
        startDate:
            toEquipmentDatePickerBound(item.startDate) ??
            toEquipmentDatePickerBound(requestEquipmentPeriodStart) ??
            null,
        endDate:
            toEquipmentDatePickerBound(item.endDate) ??
            toEquipmentDatePickerBound(requestEquipmentPeriodEnd) ??
            null,
    });

    const shouldUpsertPostEquipmentItem = (
        item: PostEquipmentDto,
        initialItems: PostEquipmentDto[]
    ): boolean => {
        if (isCreateMode && !isPostOwnedEquipment(item)) return true;
        const initial = initialItems.find(
            (i) => postEquipmentLineKey(i) === postEquipmentLineKey(item)
        );
        if (!initial) return true;
        return JSON.stringify(item) !== JSON.stringify(initial);
    };

    // Save vehicles and equipment
    const saveConnectedItems = async (postId: string) => {
        const promises: Promise<any>[] = [];

        // 1. Handle Deletions
        if (deletedEquipmentIds.length > 0) {
            deletedEquipmentIds.forEach(id => {
                promises.push(dispatch(deletePostEquipmentThunk(id)).unwrap());
            });
        }

        // 2. Handle Upserts (Vehicles)
        if (vehicleItems.length > 0 && (formData.postRequiresVehicle || isCreateMode)) {
            vehicleItems.forEach((item) => {
                if (!shouldUpsertPostEquipmentItem(item, initialVehicleItemsRef.current)) return;
                promises.push(
                    dispatch(
                        upsertPostEquipmentThunk(buildPostEquipmentUpsertPayload(item, postId))
                    ).unwrap()
                );
            });
        }

        // 3. Handle Upserts (Equipment)
        if (equipmentItems.length > 0 && (formData.postRequiresEquipment || isCreateMode)) {
            equipmentItems.forEach((item) => {
                if (!shouldUpsertPostEquipmentItem(item, initialEquipmentItemsRef.current)) return;
                promises.push(
                    dispatch(
                        upsertPostEquipmentThunk(buildPostEquipmentUpsertPayload(item, postId))
                    ).unwrap()
                );
            });
        }

        await Promise.all(promises);
        setDeletedEquipmentIds([]); // Clear deleted list after successful save
    }

    // Dirty Checking Logic
    const isPostDirty = useMemo(() => {
        if (!initialFormDataRef.current) return true;
        return JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    }, [formData]);

    const isEquipmentDirty = useMemo(() => {
        // For create mode, any equipment/vehicles means we need to save
        if (isCreateMode && (vehicleItems.length > 0 || equipmentItems.length > 0)) {
            return true;
        }

        const vehiclesChanged = JSON.stringify(vehicleItems) !== JSON.stringify(initialVehicleItemsRef.current);
        const equipmentChanged = JSON.stringify(equipmentItems) !== JSON.stringify(initialEquipmentItemsRef.current);
        if (deletedEquipmentIds.length > 0) return true;

        return vehiclesChanged || equipmentChanged;
    }, [vehicleItems, equipmentItems, deletedEquipmentIds, isCreateMode]);

    const isCallSignsDirty = useMemo(() => {
        const initialVisible = initialCallSignItemsRef.current.slice(0, visibleCallSignCount);
        const visibleChanged =
            JSON.stringify(visibleCallSignItems) !== JSON.stringify(initialVisible);
        const removedWithIds = callSignItems
            .slice(visibleCallSignCount)
            .some((item) => !!item.postCallSignID);
        const initialHadMore =
            initialCallSignItemsRef.current.length > visibleCallSignCount &&
            initialCallSignItemsRef.current
                .slice(visibleCallSignCount)
                .some((item) => !!item.postCallSignID);
        return visibleChanged || (removedWithIds && initialHadMore);
    }, [callSignItems, visibleCallSignItems, visibleCallSignCount]);

    const saveCallSigns = async (postId: string, isNewPost: boolean) => {
        const count = formData.isSupervisorPost ? 1 : Math.max(1, formData.totalPostPositions || 1);
        if (isNewPost) {
            // Create path: CallSigns were sent on Post upsert; refresh IDs from API.
            const rows = await dispatch(
                fetchPostCallSignsThunk({ postId, pagination: POST_FORM_CALL_SIGN_LIST_PAGINATION })
            ).unwrap();
            const drafts = rowsToCallSignDrafts(rows, count);
            setCallSignItems(drafts);
            initialCallSignItemsRef.current = drafts;
            return;
        }

        const visible = callSignItems.slice(0, count);

        const results = await dispatch(
            bulkUpsertPostCallSignsThunk(
                visible.map((item) =>
                    item.postCallSignID
                        ? {
                              postCallSignID: item.postCallSignID,
                              postID: postId,
                              callSign: item.callSign,
                          }
                        : {
                              postID: postId,
                              callSign: item.callSign,
                          }
                )
            )
        ).unwrap();

        // Prefer request order from bulk response; fall back to refetch if empty.
        const drafts = rowsToCallSignDrafts(
            results.length > 0
                ? results
                : await dispatch(
                      fetchPostCallSignsThunk({ postId, pagination: POST_FORM_CALL_SIGN_LIST_PAGINATION })
                  ).unwrap(),
            count
        );
        setCallSignItems(drafts);
        initialCallSignItemsRef.current = drafts;
    };

    const finalizeSaveAfterPost = async (targetId: string, options?: { isNewPost?: boolean }) => {
        // Save notes for create flow
        const notesToSave = notes?.trim();
        const commentsToSave = comments?.trim();
        if (mode === FormMode.CREATE && (notesToSave || commentsToSave)) {
            try {
                await dispatch(upsertPostNoteThunk({
                    postID: targetId,
                    notes: notesToSave || '',
                    comments: commentsToSave || '',
                })).unwrap();
            } catch (error) {
                console.error('SMSPostForm: Error saving post note:', error);
            }
        }

        if (isEquipmentDirty) {
            await saveConnectedItems(targetId);
            initialVehicleItemsRef.current = vehicleItems;
            initialEquipmentItemsRef.current = equipmentItems;
        }

        if (isCallSignsDirty || options?.isNewPost) {
            try {
                await saveCallSigns(targetId, options?.isNewPost === true);
            } catch (error) {
                console.error('SMSPostForm: Error saving post call signs:', error);
            }
        }

        dispatch(fetchPostEquipmentThunk(targetId));
        onSaveSuccess();
    };

    const handleContinueScheduleChanges = async () => {
        const pendingPost = assignmentWarningState.pendingPost;
        if (!pendingPost) return;
        setIsConfirmingScheduleChanges(true);
        dispatch(clearError());
        try {
            const resultPost = await dispatch(
                savePost({ post: withClonePostFlag(pendingPost), confirmScheduleChanges: true })
            ).unwrap();
            const targetId = resultPost?.postId ?? assignmentWarningState.pendingTargetId;
            if (!targetId) return;
            if (isClonedRef.current) isClonedRef.current = false;
            setSavedPostID(targetId);
            setFormData((prev) => ({ ...prev, postId: targetId }));
            initialFormDataRef.current = resultPost;
            setAssignmentWarningState({
                isOpen: false,
                message: '',
                employees: [],
                pendingPost: null,
                pendingTargetId: null,
            });
            await finalizeSaveAfterPost(targetId);
        } catch (error) {
            if (isPostDecreasePositionsConflict(error)) {
                setAssignmentWarningState({
                    isOpen: false,
                    message: '',
                    employees: [],
                    pendingPost: null,
                    pendingTargetId: null,
                });
                setPositionsDecreaseConflict({
                    isOpen: true,
                    message: error.message,
                    pendingPost,
                    pendingTargetId: assignmentWarningState.pendingTargetId,
                    confirmScheduleChanges: true,
                    callSigns: error.callSigns ?? [],
                    requiresHardDeletePostCallSign: error.requiresHardDeletePostCallSign === true,
                    selectedCallSignIds: [],
                });
                return;
            }
            console.error(POST.ERRORS.SAVE_FAILED, error);
        } finally {
            setIsConfirmingScheduleChanges(false);
        }
    };

    const closePositionsDecreaseConflict = () => {
        if (isConfirmingPositionsDecrease) return;
        setPositionsDecreaseConflict({
            isOpen: false,
            message: '',
            pendingPost: null,
            pendingTargetId: null,
            confirmScheduleChanges: undefined,
            callSigns: [],
            requiresHardDeletePostCallSign: false,
            selectedCallSignIds: [],
        });
    };

    const requiredHardDeleteCallSignCount = useMemo(() => {
        if (!positionsDecreaseConflict.requiresHardDeletePostCallSign) return 0;
        const nextTotal = Math.max(0, positionsDecreaseConflict.pendingPost?.totalPostPositions ?? 0);
        return Math.max(0, positionsDecreaseConflict.callSigns.length - nextTotal);
    }, [
        positionsDecreaseConflict.requiresHardDeletePostCallSign,
        positionsDecreaseConflict.callSigns.length,
        positionsDecreaseConflict.pendingPost?.totalPostPositions,
    ]);

    const togglePositionsDecreaseCallSign = (postCallSignID: string) => {
        setPositionsDecreaseConflict((prev) => {
            const selected = new Set(prev.selectedCallSignIds);
            if (selected.has(postCallSignID)) {
                selected.delete(postCallSignID);
            } else {
                if (
                    requiredHardDeleteCallSignCount > 0 &&
                    selected.size >= requiredHardDeleteCallSignCount
                ) {
                    return prev;
                }
                selected.add(postCallSignID);
            }
            return { ...prev, selectedCallSignIds: Array.from(selected) };
        });
    };

    const handleContinuePositionsDecrease = async () => {
        const pendingPost = positionsDecreaseConflict.pendingPost;
        if (!pendingPost) return;
        if (
            positionsDecreaseConflict.requiresHardDeletePostCallSign &&
            positionsDecreaseConflict.selectedCallSignIds.length < requiredHardDeleteCallSignCount
        ) {
            return;
        }
        setIsConfirmingPositionsDecrease(true);
        dispatch(clearError());
        try {
            const resultPost = await dispatch(
                savePost({
                    post: withClonePostFlag(pendingPost),
                    confirmHardDeletePostCallSign: true,
                    hardDeletePostCallSignIDs: positionsDecreaseConflict.selectedCallSignIds,
                    ...(typeof positionsDecreaseConflict.confirmScheduleChanges === 'boolean'
                        ? { confirmScheduleChanges: positionsDecreaseConflict.confirmScheduleChanges }
                        : {}),
                })
            ).unwrap();
            if (isClonedRef.current) isClonedRef.current = false;
            if (resultPost?.hasAssignmentWarning === true) {
                setPositionsDecreaseConflict({
                    isOpen: false,
                    message: '',
                    pendingPost: null,
                    pendingTargetId: null,
                    confirmScheduleChanges: undefined,
                    callSigns: [],
                    requiresHardDeletePostCallSign: false,
                    selectedCallSignIds: [],
                });
                setAssignmentWarningState({
                    isOpen: true,
                    message:
                        resultPost.assignmentWarningMessage ||
                        'Scheduled assignments are affected by these changes.',
                    employees: resultPost.assignmentWarningEmployees || [],
                    pendingPost,
                    pendingTargetId: positionsDecreaseConflict.pendingTargetId,
                });
                return;
            }
            const targetId = resultPost?.postId ?? positionsDecreaseConflict.pendingTargetId;
            if (!targetId) return;
            setSavedPostID(targetId);
            setFormData((prev) => ({ ...prev, postId: targetId }));
            initialFormDataRef.current = resultPost;
            setPositionsDecreaseConflict({
                isOpen: false,
                message: '',
                pendingPost: null,
                pendingTargetId: null,
                confirmScheduleChanges: undefined,
                callSigns: [],
                requiresHardDeletePostCallSign: false,
                selectedCallSignIds: [],
            });
            await finalizeSaveAfterPost(targetId);
        } catch (error) {
            console.error(POST.ERRORS.SAVE_FAILED, error);
        } finally {
            setIsConfirmingPositionsDecrease(false);
        }
    };

    const getVehicleEquipmentErrors = useCallback((): Record<string, string> => {
        const errors: Record<string, string> = {};
        if (formData.postRequiresVehicle && vehicleItems.length === 0) {
            errors.vehicles = POST.ERRORS.VEHICLE_REQUIRED;
        }
        if (departmentConfig?.equipment && formData.postRequiresEquipment && equipmentItems.length === 0) {
            errors.equipment = POST.ERRORS.EQUIPMENT_REQUIRED;
        }
        return errors;
    }, [
        formData.postRequiresVehicle,
        formData.postRequiresEquipment,
        vehicleItems,
        equipmentItems,
        departmentConfig?.equipment,
    ]);

    const handleBack = useCallback(() => {
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!closeHandlerRef) return;
        closeHandlerRef.current = handleBack;
        return () => {
            closeHandlerRef.current = null;
        };
    }, [closeHandlerRef, handleBack]);

    const [isSavingPost, setIsSavingPost] = useState(false);

    const handleSave = async () => {
        if (isSavingPost) return;
        setStep1Error(null);
        setFormValidationErrors({});

        // Collect all validation errors with specific messages per field
        const errors: Record<string, string> = {};

        if (!formData.postTitle?.trim()) errors.postTitle = POST.ERRORS.TITLE_REQUIRED;
        const totalPos = formData.totalPostPositions ?? 0;
        if (totalPos < 1) errors.totalPostPositions = POST.ERRORS.TOTAL_POSITIONS_REQUIRED;
        if (!formData.employeeTypeID) errors.employeeTypeID = POST.ERRORS.ELIGIBLE_EMPLOYEE_TYPE_REQUIRED;
        if (!(formData.postStartTime ?? '').trim()) errors.postStartTime = POST.ERRORS.START_TIME_REQUIRED;
        const endTrim = (formatTimeToHHmm(endTime) ?? '').trim();
        const startTrim = (formatTimeToHHmm(formData.postStartTime) ?? '').trim();
        if (!endTrim) errors.postEndTime = POST.ERRORS.END_TIME_REQUIRED;
        else if (startTrim && endTrim === startTrim) {
            errors.postEndTime = POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START;
        }
        const isDurationInvalid = formData.postLength == null || Number(formData.postLength) === 0;
        if (isDurationInvalid) errors.postLength = POST.ERRORS.DURATION_REQUIRED;
        if (!(formData.postLocation ?? '').trim()) errors.postLocation = POST.ERRORS.LOCATION_REQUIRED;
        if (!(formData.firstName ?? '').trim()) errors.firstName = POST.ERRORS.FIRST_NAME_REQUIRED;
        if (!(formData.lastName ?? '').trim()) errors.lastName = POST.ERRORS.LAST_NAME_REQUIRED;
        const primaryEmailTrim = (formData.primaryEmail ?? '').trim();
        if (!primaryEmailTrim) {
            errors.primaryEmail = POST.ERRORS.PRIMARY_EMAIL_REQUIRED;
        } else if (!validateEmail(primaryEmailTrim)) {
            errors.primaryEmail = VALIDATION.EMAIL_INVALID;
        }
        if (!(formData.primaryPhone ?? '').trim()) errors.primaryPhone = POST.ERRORS.PRIMARY_PHONE_REQUIRED;
        const payRate = Number(formData.postPayRate);
        if (payRate < 0) errors.postPayRate = POST.ERRORS.PAY_RATE_REQUIRED;
        if (!(formData.postDepartmentActivityTypeId ?? '').toString().trim()) errors.postDepartmentActivityTypeId = POST.ERRORS.DEPARTMENT_ACTIVITY_TYPE_REQUIRED;
        if (!(formData.postResponseAreaId ?? '').toString().trim()) errors.postResponseAreaId = POST.ERRORS.RESPONSE_AREA_REQUIRED;
        const parentRequired = !formData.isParent || isParentPostRequiredByConfig;
        if (parentRequired && !(formData.postParentID ?? '').trim()) errors.postParentID = POST.ERRORS.PARENT_REQUIRED;

        if (departmentConfig?.showPtaeoCode && formData.postApplyPremium) {
            if (!(formData.postPtaeoCodeId && String(formData.postPtaeoCodeId).trim())) {
                errors.postPtaeoCodeId = POST.ERRORS.PTAEO_CODE_REQUIRED;
            }
        }

        if (departmentConfig?.showPayCode && !(formData.payCode ?? '').toString().trim()) {
            errors.payCode = POST.ERRORS.PAYCODE_REQUIRED;
        }
        
        if (departmentConfig?.skills && formData.isSkillsRequired && (!formData.skillIDs || formData.skillIDs.length === 0)) {
            errors.skillIDs = POST.ERRORS.SKILL_REQUIRED;
        }

        if (formData.defineCallSign) {
            visibleCallSignItems.forEach((item, index) => {
                if (!(item.callSign ?? '').trim()) {
                    errors[`postCallSign-${index}`] = POST.ERRORS.CALL_SIGN_REQUIRED;
                }
            });
        }

        Object.assign(errors, getVehicleEquipmentErrors());

        if (Object.keys(errors).length > 0) {
            setFormValidationErrors(errors);
            return;
        }

        if (
            savedPostID &&
            !isClonedRef.current &&
            !isPostDirty &&
            !isEquipmentDirty &&
            !isCallSignsDirty
        ) {
            dispatch(showToast(POST.SUCCESS.NO_CHANGES, 'info', 5000));
            return;
        }

        if (savedPostID && !skipPerJobPositionsWarningRef.current) {
            const perJobWarning = getPerJobPositionsGreaterThanQuantityMessage(
                formData.isSupervisorPost ? 1 : Number(formData.totalPostPositions ?? 0),
                vehicleItems
            );
            if (perJobWarning) {
                setPerJobPositionsWarning({ isOpen: true, message: perJobWarning });
                return;
            }
        }
        setIsSavingPost(true);
        try {
            let targetId = savedPostID;

            const endNormalized =
                (formatTimeToHHmm(endTime) ?? '').trim() || (formatTimeToHHmm(formData.postEndTime) ?? '').trim();
            const postEndTimeResolved = ensurePostEndTimeForPayload(
                formData.postStartTime,
                formData.postLength,
                endNormalized || formData.postEndTime
            );
            let dataToSave: Post = {
                ...formData,
                postEndTime:
                    postEndTimeResolved != null ? formatTimeToHHmm(postEndTimeResolved) ?? '' : '',
                callSigns: visibleCallSignItems.map((item) => {
                    const trimmed = item.callSign.trim();
                    return trimmed ? trimmed : null;
                }),
            };
            if (vehicleItems.length > 0) dataToSave.postRequiresVehicle = true;
            if (equipmentItems.length > 0) dataToSave.postRequiresEquipment = true;
            dataToSave.rankEligible = !!dataToSave.employeeTypeID;
            const originalPost = initialFormDataRef.current;
            const normalizeTime = (v: string | null | undefined): string =>
                (formatTimeToHHmm(v ?? '') ?? '').trim();
            const hasScheduleSensitiveChanges = Boolean(
                originalPost?.postId &&
                (
                    normalizeTime(originalPost?.postStartTime) !== normalizeTime(dataToSave.postStartTime) ||
                    normalizeTime(originalPost?.postEndTime) !== normalizeTime(dataToSave.postEndTime) ||
                    Number(originalPost?.postMinimumHoursRequired ?? 0) !== Number(dataToSave.postMinimumHoursRequired ?? 0)
                )
            );

        // 1. Save/Update Post if dirty or new (or if we need an ID for equipment)
        // If we have equipment changes but no Post ID (new post), we MUST save post first.
        const wasNewPost = !targetId;
        if (isPostDirty || !targetId || isClonedRef.current) {
            try {
                const resultPost = await dispatch(
                    savePost({
                        post: withClonePostFlag(dataToSave as Post),
                        confirmScheduleChanges: hasScheduleSensitiveChanges ? false : undefined,
                    })
                ).unwrap();
                if (hasScheduleSensitiveChanges && resultPost?.hasAssignmentWarning === true) {
                    setAssignmentWarningState({
                        isOpen: true,
                        message: resultPost.assignmentWarningMessage || 'Scheduled assignments are affected by these changes.',
                        employees: resultPost.assignmentWarningEmployees || [],
                        pendingPost: dataToSave,
                        pendingTargetId: targetId,
                    });
                    return;
                }
                if (resultPost?.postId) {
                    setSavedPostID(resultPost.postId);
                    targetId = resultPost.postId;
                    setFormData(prev => ({ ...prev, postId: resultPost.postId }));
                    initialFormDataRef.current = resultPost;
                    if (isClonedRef.current) isClonedRef.current = false;
                } else {
                    return; // Failed to save post
                }
            } catch (err) {
                if (isPostDecreasePositionsConflict(err)) {
                    setPositionsDecreaseConflict({
                        isOpen: true,
                        message: err.message,
                        pendingPost: dataToSave,
                        pendingTargetId: targetId,
                        confirmScheduleChanges: hasScheduleSensitiveChanges ? false : undefined,
                        callSigns: err.callSigns ?? [],
                        requiresHardDeletePostCallSign: err.requiresHardDeletePostCallSign === true,
                        selectedCallSignIds: [],
                    });
                    return;
                }
                console.error(POST.ERRORS.SAVE_FAILED, err);
                return;
            }
        }

            if (targetId) {
                await finalizeSaveAfterPost(targetId, { isNewPost: wasNewPost });
            }
        } finally {
            setIsSavingPost(false);
        }
    };

    // Removed handleItemSave as items are now saved only on main form Save.

    // Trigger Delete Confirmation
    const handleItemDelete = React.useCallback((item: PostEquipmentDto, type: 'vehicle' | 'equipment' = 'vehicle') => {
        setDeleteConfirmation({ isOpen: true, item, type });
    }, []);

    // Confirm Delete
    const confirmDelete = async () => {
        const { item, type } = deleteConfirmation;
        if (!item) return;

        if (!isPostOwnedEquipment(item) && !isCreateMode) {
            setDeleteConfirmation({ isOpen: false, item: null, type: 'vehicle' });
            return;
        }

        if (isPostOwnedEquipment(item) && item.postEquipmentID) {
            try {
                await dispatch(deletePostEquipmentThunk(item.postEquipmentID)).unwrap();
            } catch (err) {
                console.error("Failed to delete post equipment:", err);
            }
        }

        if (isCreateMode && !isPostOwnedEquipment(item)) {
            excludedRequestTemplateKeysRef.current.add(postEquipmentLineKey(item));
        }

        const isLastVehicle = type === 'vehicle' && vehicleItems.length === 1;
        const isLastEquipment = type === 'equipment' && equipmentItems.length === 1;

        if (type === 'vehicle') {
            setVehicleItems((prev) => prev.filter((p) => p !== item));
            if (isLastVehicle && formData.postRequiresVehicle) {
                setFormValidationErrors((prev) => ({ ...prev, vehicles: POST.ERRORS.VEHICLE_REQUIRED }));
            }
        } else {
            setEquipmentItems((prev) => prev.filter((p) => p !== item));
            if (isLastEquipment && formData.postRequiresEquipment) {
                setFormValidationErrors((prev) => ({ ...prev, equipment: POST.ERRORS.EQUIPMENT_REQUIRED }));
            }
        }

        setDeleteConfirmation({ isOpen: false, item: null, type: 'vehicle' });
    };

    const isViewMode = mode === FormMode.VIEW;

    // Job length and default minimum hours come only from start + end clock times (overnight supported).
    useEffect(() => {
        if (isViewMode) return;
        const start = formatTimeToHHmm(formData.postStartTime) ?? '';
        const end = formatTimeToHHmm(endTime) ?? '';

        if (!start || !end) {
            setFormData((prev) => {
                if (prev.postLength === 0) return prev;
                const next: Post = { ...prev, postLength: 0 };
                if (!isMinimumHoursManuallyEdited) next.postMinimumHoursRequired = null;
                return next;
            });
            setFormValidationErrors((prev) => (prev.postLength ? { ...prev, postLength: '' } : prev));
            return;
        }
        const mins = durationMinutesClockToClock(start, end);
        if (mins == null || mins <= 0) {
            setFormData((prev) => {
                if (prev.postLength === 0) return prev;
                const next: Post = { ...prev, postLength: 0 };
                if (!isMinimumHoursManuallyEdited) next.postMinimumHoursRequired = null;
                return next;
            });
            if (start === end) {
                setFormValidationErrors((prev) => ({
                    ...prev,
                    postEndTime: POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START,
                }));
            }
            return;
        }
        setFormData((prev) => {
            const needMinSync = !isMinimumHoursManuallyEdited;
            if (prev.postLength === mins && (!needMinSync || prev.postMinimumHoursRequired === mins)) {
                return prev;
            }
            const next: Post = { ...prev, postLength: mins };
            if (needMinSync) next.postMinimumHoursRequired = mins;
            return next;
        });
        setFormValidationErrors((prev) => ({
            ...prev,
            postLength: '',
            ...(prev.postEndTime === POST.ERRORS.END_TIME_MUST_DIFFER_FROM_START ? { postEndTime: '' } : {}),
        }));
    }, [isViewMode, endTime, formData.postStartTime, isMinimumHoursManuallyEdited]);

    // const [isDeletePostDialogOpen, setIsDeletePostDialogOpen] = useState(false);

    // Helper to get skill label
    const getSkillName = (id: string) => {
        const skill = skillOptions.find(o => o.value === id);
        return skill ? skill.label : id;
    };

    const getEmployeeTypeName = (id: string) => {
        const type = employeeTypeOptions.find((o) => o.value === String(id).trim());
        return type ? type.label : id;
    };

    // View Mode specific getters
    const getEquipmentName = (id?: string | null) => {
        if (!id) return 'Unknown';
        const fromRow = [...vehicleItems, ...equipmentItems].find(
            (item) => String(item.departmentEquipmentID ?? '').toLowerCase() === String(id).toLowerCase()
        );
        const apiName = fromRow?.equipmentName?.trim() || fromRow?.equipmentTypeName?.trim();
        if (apiName) return apiName;
        const option =
            departmentVehicleOptions.find((x) => x.id === id) ??
            departmentEquipmentOptions.find((x) => x.id === id);
        if (option?.label) return option.label.replace(/\s*\([^)]*\)\s*$/, '').trim() || option.label;
        return 'Unknown';
    };

    const renderViewMode = () => (
        <SMSBox className="post-form__full-width">
            <SMSStack spacing={0.5} className="post-form__full-width">
                <FormViewSection>
                    <DataDisplay label={POST.FORM.LABEL_IS_SUPERVISOR_POST} value={formData.isSupervisorPost ? 'Yes' : 'No'} />
                    <DataDisplay label={POST.FORM.LABEL_POST_TITLE} value={formData.postTitle} />
                    <DataDisplay label={POST.FORM.LABEL_TOTAL_POSITIONS} value={String(formData.totalPostPositions)} />
                    {visibleCallSignItems.some((item) => item.callSign.trim()) && (
                        <DataDisplay
                            label={POST.FORM.LABEL_POST_CALL_SIGNS}
                            value={visibleCallSignItems
                                .map((item, index) =>
                                    item.callSign.trim()
                                        ? `${POST.FORM.LABEL_POST_N_CALL_SIGN.replace('{n}', String(index + 1))}: ${item.callSign.trim()}`
                                        : null
                                )
                                .filter(Boolean)
                                .join(', ')}
                        />
                    )}
                    <DataDisplay label={POST.FORM.LABEL_IS_CHILD_POST} value={formData.isParent ? 'Yes' : 'No'} />
                    {departmentConfig?.enableExemptRequestsJobsFromHoursRules && (
                        <DataDisplay label={POST.FORM.LABEL_EXEMPT_HOURS} value={formData.exemptHours ? 'Yes' : 'No'} />
                    )}
                    <DataDisplay label={POST.FORM.LABEL_DEFINE_CALL_SIGN} value={formData.defineCallSign ? 'Yes' : 'No'} />
                    {!formData.isParent && (
                        <DataDisplay
                            label={POST.FORM.LABEL_PARENT_POST}
                            value={supervisorPosts.find((p) => p.postId === formData.postParentID)?.postTitle || parentPostOptions.find(o => o.value === formData.postParentID)?.label || formData.postParentID || '-'}
                        />
                    )}
                </FormViewSection>

                <FormViewSection>
                    <DataDisplay label={POST.FORM.LABEL_START_TIME} value={formatTimeToHHmm(formData.postStartTime)} />
                    <DataDisplay
                        label={POST.FORM.LABEL_END_TIME}
                        value={formatTimeToHHmm(formData.postEndTime) || '-'}
                    />
                    <DataDisplay label={POST.FORM.LABEL_LENGTH} value={formData.postLength != null ? `${Math.floor(formData.postLength / 60)}h ${formData.postLength % 60}m` : '0m'} />
                    <DataDisplay label={POST.FORM.LABEL_MINIMUM_HOURS_REQUIRED} value={formData.postMinimumHoursRequired != null ? `${Math.floor(formData.postMinimumHoursRequired / 60)}h ${formData.postMinimumHoursRequired % 60}m` : '-'} />
                    <DataDisplay
                        label={POST.FORM.LABEL_RESPONSE_AREA}
                        value={responseAreaOptions.find((o) => o.value === formData.postResponseAreaId)?.label ?? '-'}
                    />
                    <DataDisplay label={POST.FORM.LABEL_LOCATION} value={formData.postLocation} />
                    <DataDisplay label={POST.FORM.LABEL_DESCRIPTION} value={formData.postDescription?.trim() ? formData.postDescription : '-'} />
                    <DataDisplay label={POST.FORM.LABEL_FIRST_NAME} value={formData.firstName ?? ''} />
                    <DataDisplay label={POST.FORM.LABEL_LAST_NAME} value={formData.lastName ?? ''} />
                    <DataDisplay label={POST.FORM.LABEL_PRIMARY_EMAIL} value={formData.primaryEmail ?? ''} />
                    <DataDisplay label={POST.FORM.LABEL_PRIMARY_PHONE} value={formData.primaryPhone ?? ''} />
                    <DataDisplay label={POST.FORM.LABEL_CELL_PHONE} value={formData.cellPhone ?? ''} />
                </FormViewSection>

                <FormViewSection>
                    <SMSGrid container spacing={2} className="post-form__grid-mb-1">
                        <SMSGrid item xs={12} sm>
                            <DataDisplay label={POST.FORM.LABEL_PAY_RATE} value={formatCurrency(formData.postPayRate)} />
                        </SMSGrid>
                        <SMSBox component="div" className="post-form__hidden" aria-hidden="true">
                            <DataDisplay label={POST.FORM.LABEL_PREMIUM_RATE} value={formatCurrency(formData.postPremiumRate)} />
                        </SMSBox>
                        <SMSGrid item xs={12} sm>
                            <DataDisplay label={POST.FORM.LABEL_APPLY_PREMIUM} value={formData.postApplyPremium ? 'Yes' : 'No'} />
                        </SMSGrid>
                    </SMSGrid>
                    {formData.postPtaeoCodeId && (
                        <DataDisplay
                            label={POST.FORM.LABEL_PTAEO_CODE}
                            value={
                                ptaeoCodeOptions.find((o) => o.value === formData.postPtaeoCodeId)?.label ?? '-'
                            }
                        />
                    )}
                    {formData.payCode && (
                        <DataDisplay
                            label={POST.FORM.LABEL_PAYCODE}
                            value={
                                (() => {
                                    const match = payCodeSelectOptions?.find((p) => p.id === formData.payCode);
                                    return match
                                        ? payCodeDisplayLabel(match.label)
                                        : formData.payCode;
                                })()
                            }
                        />
                    )}
                    <DataDisplay label={POST.FORM.LABEL_UNIFORM} value={formData.postUniform ? 'Yes' : 'No'} />
                </FormViewSection>

                <FormViewSection>
                    {formData.employeeTypeID && (
                        <DataDisplay
                            label={POST.FORM.LABEL_ELIGIBLE_EMPLOYEE_TYPES}
                            value={getEmployeeTypeName(formData.employeeTypeID)}
                        />
                    )}
                    <DataDisplay label={POST.FORM.LABEL_FLEXIBLE} value={formData.postIsFlexible ? 'Yes' : 'No'} />
                    {!HIDE_REQUIRES_DOCUMENT_UI && (
                        <DataDisplay label={POST.FORM.LABEL_REQUIRED_DOCUMENT} value={formData.isPostRequiredDocument ? 'Yes' : 'No'} />
                    )}
                    <DataDisplay label={POST.FORM.LABEL_REQUIRES_VEHICLE} value={formData.postRequiresVehicle ? 'Yes' : 'No'} />
                    {departmentConfig?.equipment && (
                        <DataDisplay label={POST.FORM.LABEL_REQUIRES_EQUIPMENT} value={formData.postRequiresEquipment ? 'Yes' : 'No'} />
                    )}
                    {isRequestAlcoholPermitRequired && (
                        <DataDisplay
                            label={POST.FORM.LABEL_IS_ALCOHOL_SERVED_OR_CONSUMED}
                            value={formData.isAlcoholServedOrConsumed ? 'Yes' : 'No'}
                        />
                    )}
                    {departmentConfig?.skills && (
                        <>
                            <DataDisplay label={POST.FORM.LABEL_SKILLS_REQUIRED} value={formData.isSkillsRequired ? 'Yes' : 'No'} />
                            {formData.isSkillsRequired && formData.skillIDs && formData.skillIDs.length > 0 && (
                                <SMSBox component="div" className="post-form__selected-skills post-form__full-width">
                                    <SMSLabel className="post-form__selected-skills-label">{POST.FORM.LABEL_SELECTED_SKILLS}</SMSLabel>
                                    <SMSBox component="div" className="post-form__skill-chips">
                                        {formData.skillIDs.map(id => (
                                            <span key={id} className="post-form__skill-chip">
                                                {getSkillName(id)}
                                            </span>
                                        ))}
                                    </SMSBox>
                                </SMSBox>
                            )}
                        </>
                    )}
                </FormViewSection>

                {(formData.postRequiresVehicle || (departmentConfig?.equipment && formData.postRequiresEquipment)) && (
                    <FormViewSection>
                        {formData.postRequiresVehicle && (
                            <SMSBox component="div" className="post-form__vehicle-list-wrap">
                                <ul className="post-form__list">
                                    {vehicleItems.length > 0 ? vehicleItems.map(v => (
                                        <li key={v.departmentEquipmentID || v.postEquipmentID}>
                                            {getEquipmentName(v.departmentEquipmentID)} (Quantity: {v.equipmentQuantity})
                                        </li>
                                    )) : <li>No {POST.STEPS.VEHICLES.toLowerCase()} selected</li>}
                                </ul>
                            </SMSBox>
                        )}
                        {departmentConfig?.equipment && formData.postRequiresEquipment && (
                            <SMSBox component="div" className="post-form__equipment-list-wrap">
                                <ul className="post-form__list">
                                    {equipmentItems.length > 0 ? equipmentItems.map(e => (
                                        <li key={e.departmentEquipmentID || e.postEquipmentID}>
                                            {getEquipmentName(e.departmentEquipmentID)} (Quantity: {e.equipmentQuantity})
                                        </li>
                                    )) : <li>No {POST.STEPS.EQUIPMENT.toLowerCase()} selected</li>}
                                </ul>
                            </SMSBox>
                        )}
                    </FormViewSection>
                )}

                <FormViewSection>
                    {postDeptFieldBindings.map((field) => (
                        <DataDisplay
                            key={field.valueFieldName}
                            label={field.label}
                            value={(formData as unknown as Record<string, string | undefined>)[field.valueFieldName]}
                        />
                    ))}
                </FormViewSection>

                {/* Audit History */}
                {(formData.createdBy || formData.editedBy) && (
                    <SMSBox className="post-form__audit-footer">
                        {formData.createdBy && (
                            <span>{POST.FORM.AUDIT_CREATED_BY} <strong>{formData.createdBy}</strong> {formData.createdDate && new Date(formData.createdDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        )}
                        {formData.createdBy && formData.editedBy && <SMSBox component="span" className="post-form__audit-separator">|</SMSBox>}
                        {formData.editedBy && (
                            <span>{POST.FORM.AUDIT_EDITED_BY} <strong>{formData.editedBy}</strong> {formData.editedDate && new Date(formData.editedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        )}
                    </SMSBox>
                )}

                {/* Footer Actions */}
                <SMSStack direction="row" spacing={1} justifyContent="flex-end" className="post-form__view-actions">
                    <SMSButton editIcon onClick={() => setMode(FormMode.EDIT)}>
                        {POST.FORM.BUTTON_EDIT}
                    </SMSButton>
                    <SMSButton onClick={onClose}>{POST.FORM.BUTTON_CLOSE}</SMSButton>
                </SMSStack>
            </SMSStack>
        </SMSBox>
    );

    if (isViewMode) {
        return renderViewMode();
    }

    return (
        <SMSBox className="post-form post-form__full-width">
            <SMSStack spacing={1} className="post-form__full-width">
                <SMSPaper variant="outlined" className="post-form__section-paper">
                    <SMSGrid container rowSpacing={1} columnSpacing={0.75}>
                        <SMSGrid item xs={12}>
                            <SMSStack direction="row" flexWrap="wrap" alignItems="center" gap={1} className="post-form__field-row">
                                <SMSBox className="post-form__checkbox-row">
                                    <SMSCheckbox
                                        id="isSupervisorPost"
                                        label={POST.FORM.LABEL_IS_SUPERVISOR_POST}
                                        checked={formData.isSupervisorPost}
                                        onChange={(checked) =>
                                            handleChange({ name: 'isSupervisorPost', value: checked })
                                        }
                                        disabled={isViewMode}
                                        className="app-form__checkbox-label"
                                    />
                                </SMSBox>
                                {!isCreateFromSupervisor &&(
                                    <SMSBox className="post-form__checkbox-row">
                                        <SMSCheckbox
                                            id="isParent"
                                            label={POST.FORM.LABEL_IS_PARENT_POST}
                                            checked={formData.isParent}
                                            onChange={(checked) => handleChange({ name: 'isParent', value: checked })}
                                            disabled={isViewMode || isFirstPostForRequest}
                                            className='app-form__checkbox-label'
                                        />
                                    </SMSBox>
                                )}
                                {departmentConfig?.enableExemptRequestsJobsFromHoursRules && (
                                    <SMSBox className="post-form__checkbox-row">
                                        <SMSCheckbox
                                            id="exemptHours"
                                            label={POST.FORM.LABEL_EXEMPT_HOURS}
                                            checked={formData.exemptHours ?? false}
                                            onChange={(checked) => handleChange({ name: 'exemptHours', value: checked })}
                                            disabled={isViewMode}
                                            className="app-form__checkbox-label"
                                        />
                                    </SMSBox>
                                )}
                                {!formData.isParent && (
                                    <SMSBox className="post-form__parent-dropdown-wrap">
                                        <SMSDropdown
                                            label={POST.FORM.LABEL_SELECT_PARENT}
                                            options={supervisorPosts
                                                .filter((p) => p.postId !== post?.postId)
                                                .map((p) => ({ label: p.postTitle, value: p.postId }))}
                                            value={formData.postParentID || ''}
                                            onChange={(e) => handleParentChange(e.target.value as string)}
                                            placeholder={POST.FORM.LABEL_SELECT_PARENT}
                                            disabled={isViewMode || loadingSupervisorPosts || isCreateFromSupervisor}
                                            id="postParentID"
                                            required={isParentPostRequiredByConfig || !formData.isParent}
                                            helperText={formValidationErrors.postParentID}
                                            error={Boolean(formValidationErrors.postParentID)}
                                        />
                                    </SMSBox>
                                )}
                            </SMSStack>
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={8} md={6.15} className="post-form__post-title-field">
                            <SMSTextField
                                id="postTitle"
                                name="postTitle"
                                label={POST.FORM.LABEL_POST_TITLE}
                                value={formData.postTitle}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.postTitle}
                                error={Boolean(formValidationErrors.postTitle)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12}>
                            <SMSBox className="post-form__flex-row">
                                <SMSBox className="post-form__checkbox-small post-form__checkbox-shrink post-form__checkbox-align-top">
                                    <SMSCheckbox
                                        id="postIsFlexible"
                                        label={POST.FORM.LABEL_FLEXIBLE}
                                        checked={formData.postIsFlexible}
                                        onChange={(checked) => handleChange({ name: 'postIsFlexible', value: checked })}
                                        disabled={isViewMode}
                                        className="app-form__checkbox-label"
                                    />
                                </SMSBox>
                                <SMSBox className="post-form__employee-type-wrap">
                                    <SMSDropdown
                                        label={POST.FORM.LABEL_ELIGIBLE_EMPLOYEE_TYPES}
                                        options={employeeTypeOptions}
                                        value={formData.employeeTypeID != null ? String(formData.employeeTypeID).trim() : ''}
                                        onChange={(e) => {
                                            const value = e.target.value as string;
                                            const newEmployeeTypeID = value && String(value).trim() ? String(value) : null;
                                            if (!newEmployeeTypeID) {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    employeeTypeID: null,
                                                    postPayRate: 0,
                                                    postPremiumRate: 0,
                                                }));
                                                setFormValidationErrors((prev) => ({ ...prev, employeeTypeID: '' }));
                                                return;
                                            }
                                            void dispatch(fetchEmployeeTypeById(newEmployeeTypeID))
                                                .unwrap()
                                                .then((selected) => {
                                                    const payRate = selected?.payRate != null ? Number(selected.payRate) : 0;
                                                    const premiumPayRate = selected?.premiumPayRate != null ? Number(selected.premiumPayRate) : 0;
                                                    const boundPayRate = isPremiumPaidEvent ? premiumPayRate : payRate;
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        employeeTypeID: newEmployeeTypeID,
                                                        postPayRate: boundPayRate,
                                                        postPremiumRate: premiumPayRate,
                                                    }));
                                                    setFormValidationErrors((prev) => ({
                                                        ...prev,
                                                        employeeTypeID: '',
                                                        ...(boundPayRate > 0 ? { postPayRate: '' } : {}),
                                                    }));
                                                })
                                                .catch(() => undefined);
                                        }}
                                        placeholder="Select Eligible Employee Type"
                                        disabled={isViewMode}
                                        required
                                        helperText={formValidationErrors.employeeTypeID}
                                        error={Boolean(formValidationErrors.employeeTypeID)}
                                        id="employeeTypeID"
                                        name="employeeTypeID"
                                        serverSideSearch
                                        clearable
                                        onSearchInputChange={handleEmployeeTypeSearchInputChange}
                                        noOptionsText="No employee types found"
                                    />
                                </SMSBox>
                                <SMSBox className="post-form__pay-rate-wrap">
                                    <SMSCurrencyInput
                                        id="postPayRate"
                                        name="postPayRate"
                                        className="post-form__total-positions-field"
                                        label={POST.FORM.LABEL_PAY_RATE}
                                        value={formData.postPayRate}
                                        onChange={(value) =>
                                            handleChange({
                                                name: 'postPayRate',
                                                value: value ?? 0,
                                            })
                                        }
                                        emptyWhenZero={false}
                                        disabled={isViewMode || isPremiumPaidEvent}
                                        required
                                        helperText={formValidationErrors.postPayRate}
                                        error={Boolean(formValidationErrors.postPayRate)}
                                        fullWidth
                                    />
                                </SMSBox>
                            </SMSBox>
                        </SMSGrid>
                        {departmentConfig?.skills && (
                            <SMSGrid item xs={12}>
                                <SMSGrid container spacing={1} alignItems="flex-start" className="post-form__field-row">
                                    <SMSGrid item xs={12} md="auto" className="post-form__checkbox-row">
                                        <SMSBox className="post-form__checkbox-small post-form__checkbox-align-top">
                                            <SMSCheckbox
                                                id="isSkillsRequired"
                                                label={POST.FORM.LABEL_SKILLS_REQUIRED}
                                                checked={formData.isSkillsRequired}
                                                onChange={(checked) => handleChange({ name: 'isSkillsRequired', value: checked })}
                                                disabled={isViewMode || postLockedSkillIDs.length > 0}
                                                className="app-form__checkbox-label"
                                            />
                                        </SMSBox>
                                    </SMSGrid>
                                    <SMSGrid item xs={12} md={4.7} className="post-form__min-w-0 post-form__skills-dropdown-col">
                                        <SMSMultiSelectDropdown
                                            options={skillOptions}
                                            value={formData.skillIDs || []}
                                            onChange={(value) => {
                                                const skillIDs = value.map(String);
                                                setFormData((prev) => ({ ...prev, skillIDs }));
                                                if (skillIDs.length) setFormValidationErrors((prev) => ({ ...prev, skillIDs: '' }));
                                            }}
                                            lockedValues={postLockedSkillIDs}
                                            disabled={isViewMode || !formData.isSkillsRequired}
                                            name="skillIDs"
                                            id="skillIDs"
                                            required={formData.isSkillsRequired}
                                            error={Boolean(formValidationErrors.skillIDs)}
                                            helperText={formValidationErrors.skillIDs || undefined}
                                        />
                                    </SMSGrid>
                                </SMSGrid>
                            </SMSGrid>
                        )}
                        <SMSGrid item  md={6.2}>
                            <SMSGrid container spacing={1} alignItems="flex-start">
                                <SMSGrid item xs={12} md={5}>
                                    <SMSDropdown
                                        id="postDepartmentActivityTypeId"
                                        label={POST.FORM.LABEL_DEPARTMENT_ACTIVITY_TYPE}
                                        options={departmentActivityTypeOptions}
                                        value={formData.postDepartmentActivityTypeId != null ? String(formData.postDepartmentActivityTypeId).trim() : ''}
                                        onChange={(e) => {
                                            const value = e.target.value as string;
                                            const next = value && String(value).trim();
                                            setFormValidationErrors((prev) => ({ ...prev, postDepartmentActivityTypeId: '' }));
                                            setFormData((prev) => ({
                                                ...prev,
                                                postDepartmentActivityTypeId: next || null,
                                            }));
                                        }}
                                        placeholder="Select Department Activity Type"
                                        disabled={isViewMode}
                                        required
                                        helperText={formValidationErrors.postDepartmentActivityTypeId}
                                        error={Boolean(formValidationErrors.postDepartmentActivityTypeId)}
                                        serverSideSearch
                                        clearable
                                        onSearchInputChange={handleDepartmentActivityTypeSearchInputChange}
                                        noOptionsText="No department activity types found"
                                    />
                                </SMSGrid>
                                <SMSGrid item xs={12} md={5} className="post-form__total-positions-cell">
                                    <SMSTextField
                                        type="number"
                                        id="totalPostPositions"
                                        name="totalPostPositions"
                                        label={POST.FORM.LABEL_TOTAL_POSITIONS}
                                        className="post-form__total-positions-field"
                                        value={String(formData.isSupervisorPost ? 1 : formData.totalPostPositions)}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            if (inputValue === '') {
                                                handleChange({ name: 'totalPostPositions', value: 0 });
                                                return;
                                            }
                                            const value = parseInt(inputValue, 10);
                                            if (!isNaN(value)) {
                                                if (value >= 1 && value <= 99) {
                                                    handleChange({ name: 'totalPostPositions', value });
                                                } else if (value > 99) {
                                                    handleChange({ name: 'totalPostPositions', value: 99 });
                                                }
                                            }
                                        }}
                                        inputProps={{ min: 1, max: 99 }}
                                        disabled={isViewMode || formData.isSupervisorPost}
                                        required
                                        helperText={
                                            !formData.isParent && !formData.isSupervisorPost && departmentConfig?.isSupervisorRequired && isParentPostRequiredByConfig && !formData.postParentID
                                                ? `${POST.FORM.PARENT_POST_REQUIRED_WHEN_POSITIONS_EXCEED.replace('{max}', String(departmentConfig?.numberOfPositionsPerSupervisor ?? 0))} (Required)`
                                                : formValidationErrors.totalPostPositions
                                        }
                                        error={Boolean(formValidationErrors.totalPostPositions) || Boolean(!formData.isParent && !formData.isSupervisorPost && departmentConfig?.isSupervisorRequired && isParentPostRequiredByConfig && !formData.postParentID)}
                                        fullWidth
                                    />
                                </SMSGrid>
                            </SMSGrid>
                        </SMSGrid>
                        <SMSGrid item xs={12} className="post-form__call-signs-cell">
                            <SMSAccordion
                                title={
                                    <SMSStack direction="row" alignItems="center" spacing={2} onClick={(e) => e.stopPropagation()}>
                                        <SMSTypography variant="subtitle2" component="span" sx={{ fontWeight: 700 }}>
                                            {POST.FORM.LABEL_POST_CALL_SIGNS}
                                        </SMSTypography>
                                        <SMSBox onClick={(e) => e.stopPropagation()}>
                                            <SMSCheckbox
                                                id="defineCallSign"
                                                label={POST.FORM.LABEL_DEFINE_CALL_SIGN}
                                                checked={formData.defineCallSign ?? false}
                                                onChange={(checked) => handleDefineCallSignToggle(checked)}
                                                disabled={isViewMode}
                                                className="app-form__checkbox-label"
                                            />
                                        </SMSBox>
                                    </SMSStack>
                                }
                                expanded={Boolean(formData.defineCallSign && isCallSignAccordionExpanded)}
                                onChange={(_, expanded) => {
                                    if (formData.defineCallSign) setIsCallSignAccordionExpanded(expanded);
                                }}
                                className="post-form__call-signs-accordion"
                            >
                                <SMSBox className="post-form__call-signs-panel">
                                    <SMSGrid container spacing={1} className="post-form__full-width">
                                        {visibleCallSignItems.map((item, index) => (
                                            <SMSGrid item xs={12} sm={6} md={2.4} key={item.postCallSignID ?? `call-sign-${index}`}>
                                                <SMSTextField
                                                    id={`postCallSign-${index}`}
                                                    name={`postCallSign-${index}`}
                                                    label={POST.FORM.LABEL_POST_N_CALL_SIGN.replace('{n}', String(index + 1))}
                                                    value={item.callSign}
                                                    onChange={(e) => {
                                                        const value = e.target.value.slice(0, 50);
                                                        setFormValidationErrors((prev) => ({ ...prev, [`postCallSign-${index}`]: '' }));
                                                        setCallSignItems((prev) =>
                                                            prev.map((row, i) =>
                                                                i === index ? { ...row, callSign: value } : row
                                                            )
                                                        );
                                                    }}
                                                    disabled={isViewMode}
                                                    required={formData.defineCallSign ?? false}
                                                    helperText={formValidationErrors[`postCallSign-${index}`]}
                                                    error={Boolean(formValidationErrors[`postCallSign-${index}`])}
                                                    inputProps={{ maxLength: 50 }}
                                                    fullWidth
                                                />
                                            </SMSGrid>
                                        ))}
                                    </SMSGrid>
                                </SMSBox>
                            </SMSAccordion>
                        </SMSGrid>
                        <SMSGrid item xs={12} className="post-form__time-section">
                                {highlightTimeFieldsFromClone && (
                                    <SMSStack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        className="post-form__clone-time-warning"
                                        role="alert"
                                        aria-live="polite"
                                    >
                                        <SMSIcon
                                            name="warning"
                                            size="md"
                                            className="post-form__clone-time-warning-icon"
                                        />
                                        <SMSTypography variant="body2" component="span">
                                            {POST.FORM.CLONE_TIME_FIELDS_REMINDER}
                                        </SMSTypography>
                                    </SMSStack>
                                )}
                                <SMSStack direction="row" flexWrap="wrap" alignItems="flex-start" className="post-form__field-row post-form__time-row">
                                <SMSTimePicker
                                    id="postStartTime"
                                    name="postStartTime"
                                    label={POST.FORM.LABEL_START_TIME}
                                    className="post-form__time-start"
                                    highlighted={highlightTimeFieldsFromClone}
                                    value={formatTimeToHHmm(formData.postStartTime)}
                                    onChange={(v) => handleChange({ name: 'postStartTime', value: v })}
                                    disabled={isViewMode}
                                    required
                                    error={formValidationErrors.postStartTime}
                                    fullWidth
                                />
                                <SMSTimePicker
                                    id="postEndTime"
                                    name="postEndTime"
                                    label={POST.FORM.LABEL_END_TIME}
                                    className="post-form__time-end"
                                    highlighted={highlightTimeFieldsFromClone}
                                    excludeClockTime={(formatTimeToHHmm(formData.postStartTime) ?? '').trim() || undefined}
                                    value={formatTimeToHHmm(endTime) ?? ''}
                                    onChange={(v) => {
                                        const t = v && String(v).trim() ? (formatTimeToHHmm(String(v)) ?? '') : '';
                                        setEndTime(t);
                                        setFormData((prev) => ({ ...prev, postEndTime: t }));
                                        setFormValidationErrors((prev) => ({
                                            ...prev,
                                            ...(t ? { postLength: '', postEndTime: '' } : {}),
                                        }));
                                    }}
                                    disabled={isViewMode}
                                    required
                                    error={formValidationErrors.postEndTime}
                                    fullWidth
                                />
                                <SMSTimePicker
                                    id="postLength"
                                    name="postLength"
                                    label={POST.FORM.LABEL_LENGTH}
                                    className="post-form__time-duration"
                                    durationMode
                                    value={minutesToTimeString(formData.postLength ?? 0)}
                                    onChange={() => undefined}
                                    disabled
                                    required
                                    error={formValidationErrors.postLength}
                                    fullWidth
                                />
                                <SMSTimePicker
                                    id="postMinimumHoursRequired"
                                    name="postMinimumHoursRequired"
                                    label={POST.FORM.LABEL_MINIMUM_HOURS_REQUIRED}
                                    className="post-form__time-min-hours"
                                    highlighted={highlightTimeFieldsFromClone}
                                    durationMode
                                    value={formData.postMinimumHoursRequired != null ? minutesToTimeString(formData.postMinimumHoursRequired) : ''}
                                    onChange={(v) => {
                                        setIsMinimumHoursManuallyEdited(true);
                                        if (!v || !v.trim()) {
                                            handleChange({ name: 'postMinimumHoursRequired', value: null });
                                            return;
                                        }
                                        handleChange({ name: 'postMinimumHoursRequired', value: timeStringToMinutes(v) });
                                    }}
                                    disabled={isViewMode}
                                    error={formValidationErrors.postMinimumHoursRequired}
                                    fullWidth
                                />
                            </SMSStack>
                        </SMSGrid>
                        <SMSGrid item xs={6.1}>
                                <SMSDropdown
                                id="postResponseAreaId"
                                label={POST.FORM.LABEL_RESPONSE_AREA}
                                options={responseAreaOptions}
                                value={formData.postResponseAreaId != null ? String(formData.postResponseAreaId).trim() : ''}
                                onChange={(e) => {
                                    const value = e.target.value as string;
                                    const next = value && String(value).trim();
                                    setFormValidationErrors((prev) => ({ ...prev, postResponseAreaId: '' }));
                                    setFormData((prev) => ({
                                        ...prev,
                                        postResponseAreaId: next || null,
                                    }));
                                }}
                                placeholder="Select Response Area"
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.postResponseAreaId}
                                error={Boolean(formValidationErrors.postResponseAreaId)}
                                serverSideSearch
                                clearable
                                onSearchInputChange={handleResponseAreaSearchInputChange}
                                noOptionsText="No response areas found"
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} md={12}>
                            <SMSTextField
                                id="postLocation"
                                name="postLocation"
                                label={POST.FORM.LABEL_LOCATION}
                                value={formData.postLocation}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.postLocation}
                                error={Boolean(formValidationErrors.postLocation)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} md={12}>
                            <SMSTextArea
                                id="postDescription"
                                name="postDescription"
                                label={POST.FORM.LABEL_DESCRIPTION}
                                value={formData.postDescription}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                minRows={3}
                                fullWidth
                                helperText={formValidationErrors.postDescription}
                                error={Boolean(formValidationErrors.postDescription)}
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={2.4}>
                            <SMSTextField
                                id="firstName"
                                name="firstName"
                                label={POST.FORM.LABEL_FIRST_NAME}
                                value={formData.firstName ?? ''}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.firstName}
                                error={Boolean(formValidationErrors.firstName)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={2.4}>
                            <SMSTextField
                                id="lastName"
                                name="lastName"
                                label={POST.FORM.LABEL_LAST_NAME}
                                value={formData.lastName ?? ''}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.lastName}
                                error={Boolean(formValidationErrors.lastName)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={2.4}>
                            <SMSTextField
                                type="email"
                                id="primaryEmail"
                                name="primaryEmail"
                                label={POST.FORM.LABEL_PRIMARY_EMAIL}
                                value={formData.primaryEmail ?? ''}
                                onChange={(e) => handleChange(e)}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.primaryEmail}
                                error={Boolean(formValidationErrors.primaryEmail)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={2.4}>
                            <SMSTextField
                                type="tel"
                                id="primaryPhone"
                                name="primaryPhone"
                                label={POST.FORM.LABEL_PRIMARY_PHONE}
                                value={formData.primaryPhone ?? ''}
                                onChange={(e) => handleChange({ name: 'primaryPhone', value: formatPhoneNumber(e.target.value) })}
                                disabled={isViewMode}
                                required
                                helperText={formValidationErrors.primaryPhone}
                                error={Boolean(formValidationErrors.primaryPhone)}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={2.4}>
                            <SMSTextField
                                type="tel"
                                id="cellPhone"
                                name="cellPhone"
                                label={POST.FORM.LABEL_CELL_PHONE}
                                value={formData.cellPhone ?? ''}
                                onChange={(e) => handleChange({ name: 'cellPhone', value: formatPhoneNumber(e.target.value) })}
                                disabled={isViewMode}
                                fullWidth
                            />
                        </SMSGrid>
                        <SMSGrid item xs={12}>
                                <SMSStack direction="row" flexWrap="wrap" alignItems="flex-end" gap={1} className="post-form__field-row post-form__flex-align-end">
                                <SMSBox className="post-form__hidden" aria-hidden="true">
                                    <SMSCurrencyInput
                                        id="postPremiumRate"
                                        name="postPremiumRate"
                                        label={POST.FORM.LABEL_PREMIUM_RATE}
                                        value={formData.postPremiumRate}
                                        onChange={(value) =>
                                            handleChange({
                                                name: 'postPremiumRate',
                                                value: value ?? 0,
                                            })
                                        }
                                        disabled={isViewMode}
                                        className="post-form__rate-field"
                                        helperText={formValidationErrors.postPremiumRate}
                                        error={Boolean(formValidationErrors.postPremiumRate)}
                                        fullWidth
                                    />
                                </SMSBox>
                                <SMSStack direction="row" flexWrap="nowrap" alignItems="flex-start" gap={1}>
                                    {departmentConfig?.showPtaeoCode && (
                                        <>
                                            <SMSBox className="post-form__apply-premium-wrap">
                                                <SMSCheckbox
                                                    id="postApplyPremium"
                                                    label=""
                                                    checked={formData.postApplyPremium ?? false}
                                                    onChange={(checked) => {
                                                        handleChange({ name: 'postApplyPremium', value: checked });
                                                        if (!checked) {
                                                            setFormValidationErrors((prev) => ({ ...prev, postPtaeoCodeId: '' }));
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                postPtaeoCodeId: null,
                                                                projectNumber: null,
                                                                taskNumber: null,
                                                                awardNumber: null,
                                                                fundNumber: null,
                                                                organizationNumber: null,
                                                            }));
                                                        }
                                                    }}
                                                    disabled={isViewMode}
                                                    className="app-form__checkbox-label post-form__checkbox-align-top"
                                                />
                                            </SMSBox>
                                            <SMSBox className="post-form__ptaeo-wrap">
                                                <SMSDropdown
                                                    id="postPtaeoCodeId"
                                                    label={POST.FORM.LABEL_PTAEO_CODE}
                                                    options={ptaeoCodeOptions}
                                                    value={formData.postPtaeoCodeId ?? ''}
                                                    required={formData.postApplyPremium ?? false}
                                                    onChange={(e) => {
                                                        const value = e.target.value as string;
                                                        if (!value || !value.trim()) {
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                postPtaeoCodeId: null,
                                                                projectNumber: null,
                                                                taskNumber: null,
                                                                awardNumber: null,
                                                                fundNumber: null,
                                                                organizationName: null,
                                                                organizationNumber: null,
                                                            }));
                                                            return;
                                                        }
                                                        void dispatch(fetchPtaeoCodeById(value))
                                                            .unwrap()
                                                            .then((selected) => {
                                                                setFormValidationErrors((prev) => ({ ...prev, postPtaeoCodeId: '' }));
                                                                const parts = ptaeoCodeParts(selected);
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    postPtaeoCodeId: value,
                                                                    projectNumber: parts.projectNumber || null,
                                                                    taskNumber: parts.taskNumber || null,
                                                                    awardNumber: parts.awardNumber || null,
                                                                    fundNumber: parts.fundNumber || null,
                                                                    organizationNumber: parts.organizationNumber || null,
                                                                }));
                                                            })
                                                            .catch(() => undefined);
                                                    }}
                                                    placeholder="Select PTAEO Code"
                                                    disabled={isViewMode || !(formData.postApplyPremium ?? false)}
                                                    helperText={formValidationErrors.postPtaeoCodeId}
                                                    error={Boolean(formValidationErrors.postPtaeoCodeId)}
                                                    serverSideSearch
                                                    clearable
                                                    onSearchInputChange={handlePtaeoCodeSearchInputChange}
                                                    noOptionsText="No PTAEO codes found"
                                                />
                                            </SMSBox>
                                        </>
                                    )}
                                    {departmentConfig?.showPayCode && (
                                        <SMSBox
                                            className="post-form__paycode-wrap"
                                            sx={{ minWidth: 180 }}
                                        >
                                            <SMSDropdown
                                                id="payCode"
                                                name="payCode"
                                                label={POST.FORM.LABEL_PAYCODE}
                                                options={payCodeOptions}
                                                value={formData.payCode ?? ''}
                                                onChange={(e) => {
                                                    const value = (e.target.value as string) || '';
                                                    setFormValidationErrors((prev) => ({ ...prev, payCode: '' }));
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        // Store PayCodeID (GUID) in form state; backend expects PayCodeID
                                                        payCode: value || null,
                                                    }));
                                                }}
                                                disabled={isViewMode}
                                                required
                                                fullWidth
                                                placeholder="Select Paycode"
                                                helperText={formValidationErrors.payCode}
                                                error={Boolean(formValidationErrors.payCode)}
                                                serverSideSearch
                                                clearable
                                                onSearchInputChange={handlePayCodeSearchInputChange}
                                                noOptionsText="No pay codes found"
                                            />
                                        </SMSBox>
                                    )}
                                    <SMSBox className="post-form__uniform-checkbox-wrap">
                                        <SMSCheckbox
                                            id="postUniform"
                                            label={POST.FORM.LABEL_UNIFORM}
                                            checked={formData.postUniform ?? false}
                                            onChange={(checked) => handleChange({ name: 'postUniform', value: checked })}
                                            disabled={isViewMode}
                                            className="app-form__checkbox-label post-form__checkbox-align-top"
                                        />
                                    </SMSBox>
                                </SMSStack>
                            </SMSStack>
                        </SMSGrid>
                    </SMSGrid>
                    <SMSStack direction={{ xs: 'column', md: 'row' }} spacing={0.75} className="post-form__full-width post-form__align-start post-form__mt-1">
                        <SMSBox className="post-form__vehicle-col">
                            <SMSStack direction="column" spacing={0} className="post-form__checkbox-stack">
                                <SMSBox className="post-form__checkbox-row">
                                    <SMSCheckbox
                                        id="postRequiresVehicle"
                                        label={POST.FORM.LABEL_REQUIRES_VEHICLE}
                                        checked={formData.postRequiresVehicle}
                                        onChange={(checked) => handleChange({ name: 'postRequiresVehicle', value: checked })}
                                        disabled={isViewMode}
                                        className='app-form__checkbox-label'
                                    />
                                </SMSBox>
                                {!HIDE_REQUIRES_DOCUMENT_UI && (
                                    <SMSBox className="post-form__checkbox-row">
                                        <SMSCheckbox
                                            id="isPostRequiredDocument"
                                            label={POST.FORM.LABEL_REQUIRED_DOCUMENT}
                                            checked={formData.isPostRequiredDocument}
                                            onChange={(checked) => handleChange({ name: 'isPostRequiredDocument', value: checked })}
                                            disabled={isViewMode}
                                            className='app-form__checkbox-label'
                                        />
                                    </SMSBox>
                                )}
                                <SMSBox className="post-form__checkbox-row">
                                    <SMSCheckbox
                                        id="postRequiresEquipment"
                                        label={POST.FORM.LABEL_REQUIRES_EQUIPMENT}
                                        checked={formData.postRequiresEquipment}
                                        onChange={(checked) => handleChange({ name: 'postRequiresEquipment', value: checked })}
                                        disabled={isViewMode || !departmentConfig?.equipment}
                                        className='app-form__checkbox-label'
                                    />
                                </SMSBox>
                                {isRequestAlcoholPermitRequired && (
                                    <SMSBox className="post-form__checkbox-row">
                                        <SMSCheckbox
                                            id="isAlcoholServedOrConsumed"
                                            label={POST.FORM.LABEL_IS_ALCOHOL_SERVED_OR_CONSUMED}
                                            checked={formData.isAlcoholServedOrConsumed ?? false}
                                            onChange={(checked) =>
                                                handleChange({ name: 'isAlcoholServedOrConsumed', value: checked })
                                            }
                                            disabled={isViewMode}
                                            className="app-form__checkbox-label"
                                        />
                                    </SMSBox>
                                )}
                            </SMSStack>
                        </SMSBox>

                        {/* Right Panel: Tabs */}
                        {(formData.postRequiresVehicle || (departmentConfig?.equipment && formData.postRequiresEquipment)) && (
                            <SMSPaper variant="outlined" className="post-form__equipment-panel">
                                <SMSContentTabs
                                    keepMounted
                                    tabs={[
                                        ...(formData.postRequiresVehicle ? [{
                                            id: 'vehicles',
                                            label: 'Vehicles',
                                            hasError: Boolean(formValidationErrors.vehicles),
                                            content: (
                                                <SMSBox className="post-form__tab-content">
                                                    {formValidationErrors.vehicles && (
                                                        <SMSTypography
                                                            component="div"
                                                            className="app-form__error-message"
                                                            sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}
                                                        >
                                                            {formValidationErrors.vehicles}
                                                        </SMSTypography>
                                                    )}
                                                    <PostEquipmentList
                                                        key="post-vehicles"
                                                        items={vehicleItems}
                                                        onItemsChange={(items) => {
                                                            setVehicleItems(items);
                                                            if (items.length > 0) {
                                                                setFormValidationErrors((prev) => ({ ...prev, vehicles: '' }));
                                                            }
                                                        }}
                                                        onDeleteItem={(item) => handleItemDelete(item, 'vehicle')}
                                                        canDeleteItem={() => !isViewMode}
                                                        requestStartDate={requestEquipmentPeriodStart}
                                                        requestEndDate={requestEquipmentPeriodEnd}
                                                        totalPostPositions={Number(formData.totalPostPositions ?? 0)}
                                                        departmentId={user?.departmentID}
                                                        type="vehicle"
                                                        disabled={isPostEquipLoading || isViewMode}
                                                    />
                                                </SMSBox>
                                            )
                                        }] : []),
                                        ...(departmentConfig?.equipment && formData.postRequiresEquipment ? [{
                                            id: 'equipment',
                                            label: 'Equipment',
                                            hasError: Boolean(formValidationErrors.equipment),
                                            content: (
                                                <SMSBox className="post-form__tab-content">
                                                    {formValidationErrors.equipment && (
                                                        <SMSTypography
                                                            component="div"
                                                            className="app-form__error-message"
                                                            sx={{ color: 'var(--error-color, #c00)', marginBottom: '0.5rem' }}
                                                        >
                                                            {formValidationErrors.equipment}
                                                        </SMSTypography>
                                                    )}
                                                    <PostEquipmentList
                                                        key="post-equipment"
                                                        items={equipmentItems}
                                                        onItemsChange={(items) => {
                                                            setEquipmentItems(items);
                                                            if (items.length > 0) {
                                                                setFormValidationErrors((prev) => ({ ...prev, equipment: '' }));
                                                            }
                                                        }}
                                                        onDeleteItem={(item) => handleItemDelete(item, 'equipment')}
                                                        canDeleteItem={() => !isViewMode}
                                                        requestStartDate={requestEquipmentPeriodStart}
                                                        requestEndDate={requestEquipmentPeriodEnd}
                                                        totalPostPositions={Number(formData.totalPostPositions ?? 0)}
                                                        departmentId={user?.departmentID}
                                                        type="equipment"
                                                        disabled={isPostEquipLoading || isViewMode}
                                                    />
                                                </SMSBox>
                                            )
                                        }] : [])
                                    ]}
                                />
                            </SMSPaper>
                        )}
                    </SMSStack>
                    {canShowAdditionalFields && (
                        <SMSBox className="post-form__show-fields-wrap">
                            <SMSCheckbox
                                id="showAdditionalFields"
                                label="Show Additional Fields"
                                checked={showAdditionalFields}
                                onChange={(checked) => {
                                    setShowAdditionalFields(checked);
                                    if (!checked) {
                                        setFormData((prev) => ({
                                            ...prev,
                                            ...getEmptyDepartmentDefinedFieldValues('post'),
                                        }));
                                    }
                                }}
                                disabled={isViewMode}
                                className="app-form__checkbox-label"
                            />
                        </SMSBox>
                    )}

                    {canShowAdditionalFields && showAdditionalFields && (
                        <SMSGrid container spacing={1} className="post-form__full-width">
                            {postDeptFieldBindings.map((field) => (
                                <SMSGrid key={field.valueFieldName} item xs={12} sm={6} md={2.4}>
                                    <SMSTextField
                                        label={field.label}
                                        id={field.valueFieldName}
                                        name={field.valueFieldName}
                                        value={String(formData[field.valueFieldName as keyof Post] ?? '')}
                                        onChange={(e) => handleChange(e)}
                                        disabled={isViewMode || departmentDefinedFieldsLoading}
                                        fullWidth
                                    />
                                </SMSGrid>
                            ))}
                        </SMSGrid>
                    )}
                    {mode === FormMode.CREATE && (
                        <SMSGrid container spacing={1}>
                            <SMSGrid item xs={12} md={6}>
                                <SMSTextField
                                    label="Notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Enter any additional notes about this job..."
                                    name="notes"
                                    id="notes"
                                    fullWidth
                                />
                            </SMSGrid>
                            <SMSGrid item xs={12} md={6}>
                                <SMSTextField
                                    label="Comments"
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    placeholder="Enter any comments about this job..."
                                    name="comments"
                                    id="comments"
                                    fullWidth
                                />
                            </SMSGrid>
                        </SMSGrid>
                    )}

                    {/* Notes section is currently hidden from the UI but kept in code for future use */}
                    {mode === FormMode.EDIT && false && (
                        <SMSBox className="post-form__notes-section">
                            {isLoadingNotes ? (
                                <SMSLabel className="post-form__loading-notes">Loading notes...</SMSLabel>
                            ) : latestNotes ? (
                                <SMSGrid container spacing={2} className="post-form__full-width post-form__notes-display">
                                    <SMSGrid item xs={12} md={6}>
                                        <DataDisplay label="Latest Note" value={latestNotes?.notes ?? ''} />
                                    </SMSGrid>
                                    <SMSGrid item xs={12} md={6}>
                                        <DataDisplay label="Note Comments" value={latestNotes?.comments ?? ''} />
                                    </SMSGrid>
                                </SMSGrid>
                            ) : (
                                <SMSLabel className="post-form__empty-notes">No notes available</SMSLabel>
                            )}
                        </SMSBox>
                    )}

                </SMSPaper>

                {/* Audit History (Read Only) */}
                {(formData.createdBy || formData.editedBy) && (
                    <SMSBox className="post-form__audit-footer">
                        {formData.createdBy && (
                            <span>{POST.FORM.AUDIT_CREATED_BY} <strong>{formData.createdBy}</strong> {formData.createdDate && new Date(formData.createdDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        )}
                        {formData.createdBy && formData.editedBy && <SMSBox component="span" className="post-form__audit-separator">|</SMSBox>}
                        {formData.editedBy && (
                            <span>{POST.FORM.AUDIT_EDITED_BY} <strong>{formData.editedBy}</strong> {formData.editedDate && new Date(formData.editedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        )}
                    </SMSBox>
                )}

                {/* Error Message */}

                {/* Footer Actions */}
                <SMSStack direction="row" spacing={1} justifyContent="flex-end" className="post-form__actions-footer">
                    <SMSButton onClick={onClose} disabled={isPostEquipLoading}>
                        {POST.FORM.BUTTON_CANCEL}
                    </SMSButton>
                    <SMSButton
                        onClick={handleSave}
                        loading={isSavingPost}
                        disabled={isSavingPost || isPostEquipLoading}
                    >
                        {savedPostID ? POST.FORM.BUTTON_UPDATE : POST.FORM.BUTTON_SAVE}
                    </SMSButton>
                </SMSStack>
            </SMSStack>

            {/* Delete Confirmation */}
            <SMSConfirmDialog
                open={deleteConfirmation.isOpen}
                title="Confirm Deletion"
                message={`Are you sure you want to remove this ${deleteConfirmation.type}?`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
                variant="error"
            />
            <SMSConfirmDialog
                open={perJobPositionsWarning.isOpen}
                title={POST.FORM.PER_JOB_POSITIONS_GREATER_THAN_QUANTITY_TITLE}
                message={perJobPositionsWarning.message}
                confirmText={POST.CONFLICT.CONFIRM}
                cancelText={POST.CONFLICT.CANCEL}
                onConfirm={() => {
                    skipPerJobPositionsWarningRef.current = true;
                    setPerJobPositionsWarning({ isOpen: false, message: '' });
                    void handleSave();
                }}
                onClose={() => {
                    skipPerJobPositionsWarningRef.current = false;
                    setPerJobPositionsWarning({ isOpen: false, message: '' });
                }}
                variant="warning"
                confirmButtonColor="primary"
            />
            <SMSConfirmDialog
                open={positionsDecreaseConflict.isOpen}
                title={POST.CONFLICT.TITLE}
                message=""
                confirmText={POST.CONFLICT.CONFIRM}
                cancelText={POST.CONFLICT.CANCEL}
                onConfirm={() => void handleContinuePositionsDecrease()}
                onClose={closePositionsDecreaseConflict}
                variant="warning"
                confirmButtonColor="primary"
                loading={isConfirmingPositionsDecrease}
                confirmDisabled={
                    positionsDecreaseConflict.requiresHardDeletePostCallSign &&
                    positionsDecreaseConflict.selectedCallSignIds.length < requiredHardDeleteCallSignCount
                }
            >
                <SMSStack spacing={2.25}>
                    {positionsDecreaseConflict.message ? (
                        <SMSBox
                            sx={{
                                bgcolor: 'warning.50',
                                border: '1px solid',
                                borderColor: 'warning.light',
                                borderRadius: 1,
                                px: 1.75,
                                py: 1.5,
                            }}
                        >
                            <SMSTypography
                                variant="body1"
                                sx={{
                                    lineHeight: 1.55,
                                    fontSize: '0.9375rem',
                                    color: 'text.primary',
                                    letterSpacing: '0.01em',
                                }}
                            >
                                {positionsDecreaseConflict.message}
                            </SMSTypography>
                        </SMSBox>
                    ) : null}

                    {positionsDecreaseConflict.requiresHardDeletePostCallSign &&
                        positionsDecreaseConflict.callSigns.length > 0 && (
                            <SMSStack spacing={1.25}>
                                <SMSBox>
                                    <SMSTypography
                                        variant="subtitle1"
                                        sx={{
                                            fontWeight: 600,
                                            fontSize: '0.95rem',
                                            color: 'text.primary',
                                            letterSpacing: '0.01em',
                                        }}
                                    >
                                        {POST.CONFLICT.SELECT_CALL_SIGNS}
                                    </SMSTypography>
                                    {requiredHardDeleteCallSignCount > 0 && (
                                        <SMSTypography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                display: 'block',
                                                mt: 0.75,
                                                fontSize: '0.8125rem',
                                                lineHeight: 1.45,
                                            }}
                                        >
                                            {POST.CONFLICT.SELECT_CALL_SIGNS_HINT.replace(
                                                '{count}',
                                                String(requiredHardDeleteCallSignCount)
                                            )}
                                        </SMSTypography>
                                    )}
                                    {requiredHardDeleteCallSignCount > 0 && (
                                        <SMSTypography
                                            variant="body2"
                                            sx={{
                                                display: 'block',
                                                mt: 0.5,
                                                fontWeight: 600,
                                                fontSize: '0.8125rem',
                                                color: 'primary.main',
                                            }}
                                        >
                                            {POST.CONFLICT.SELECTED_COUNT.replace(
                                                '{selected}',
                                                String(positionsDecreaseConflict.selectedCallSignIds.length)
                                            ).replace(
                                                '{required}',
                                                String(requiredHardDeleteCallSignCount)
                                            )}
                                        </SMSTypography>
                                    )}
                                </SMSBox>

                                <SMSBox
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        maxHeight: 280,
                                        overflow: 'auto',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <SMSStack spacing={0}>
                                        {positionsDecreaseConflict.callSigns.map((row, index) => {
                                            const id = String(row.postCallSignID ?? '');
                                            if (!id) return null;
                                            const checked =
                                                positionsDecreaseConflict.selectedCallSignIds.includes(id);
                                            const callSignValue =
                                                row.callSign?.trim() || POST.CONFLICT.EMPTY_CALL_SIGN;
                                            const rowLabel = POST.FORM.LABEL_POST_N_CALL_SIGN.replace(
                                                '{n}',
                                                String(index + 1)
                                            );
                                            return (
                                                <SMSBox
                                                    key={id}
                                                    sx={{
                                                        px: 1.25,
                                                        py: 0.35,
                                                        borderBottom:
                                                            index <
                                                            positionsDecreaseConflict.callSigns.length - 1
                                                                ? '1px solid'
                                                                : 'none',
                                                        borderColor: 'divider',
                                                        bgcolor: checked ? 'action.selected' : 'transparent',
                                                        '& .MuiFormControlLabel-label': {
                                                            fontSize: '0.875rem',
                                                            fontWeight: checked ? 600 : 500,
                                                            color: 'text.primary',
                                                            letterSpacing: '0.01em',
                                                        },
                                                    }}
                                                >
                                                    <SMSCheckbox
                                                        checked={checked}
                                                        onChange={() => togglePositionsDecreaseCallSign(id)}
                                                        label={`${rowLabel}: ${callSignValue}`}
                                                        disabled={isConfirmingPositionsDecrease}
                                                    />
                                                </SMSBox>
                                            );
                                        })}
                                    </SMSStack>
                                </SMSBox>
                            </SMSStack>
                        )}
                </SMSStack>
            </SMSConfirmDialog>
            <SMSModal
                isOpen={assignmentWarningState.isOpen}
                showCloseButton={!isConfirmingScheduleChanges}
                onClose={() => {
                    if (isConfirmingScheduleChanges) return;
                    setAssignmentWarningState({
                        isOpen: false,
                        message: '',
                        employees: [],
                        pendingPost: null,
                        pendingTargetId: null,
                    });
                }}
                title="Assignment Warning"
                size="lg"
            >
                <SMSStack spacing={1}>
                    <SMSTypography variant="body2">
                        {assignmentWarningState.message}
                    </SMSTypography>
                    <SMSBox
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            maxHeight: 280,
                            overflow: 'auto',
                            p: 0.5,
                        }}
                    >
                        <SMSBox
                            sx={{
                                display: 'grid',
                                gridTemplateColumns:
                                  'minmax(88px, 1fr) minmax(72px, 0.8fr) minmax(72px, 0.8fr) minmax(72px, 0.8fr) minmax(120px, 1.1fr) minmax(180px, 1.6fr) minmax(120px, 1.1fr)',
                                columnGap: 0.75,
                                rowGap: 0.25,
                                alignItems: 'center',
                            }}
                        >
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Date Of Work</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Start Time</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>End Time</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Duration</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Employee</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Email</SMSTypography>
                            <SMSTypography variant="caption" sx={{ fontWeight: 600 }}>Contact Number</SMSTypography>

                            {assignmentWarningState.employees.map((e) => (
                                <React.Fragment key={`${e.postPositionID}-${e.employeeID}`}>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {e.dateOfWork ? formatDateShort(e.dateOfWork) : '-'}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {e.startTime ? formatTimeToHHmm(e.startTime) || e.startTime : '-'}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {e.endTime ? formatTimeToHHmm(e.endTime) || e.endTime : '-'}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {(() => {
                                            const durationValue = String(e.duration ?? '').trim();
                                            if (!durationValue) return '-';
                                            const asNumber = Number(durationValue);
                                            return Number.isNaN(asNumber) ? durationValue : formatDuration(asNumber);
                                        })()}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {e.employeeName || '-'}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ overflowWrap: 'anywhere', lineHeight: 1.25 }}>
                                        {e.primaryEmail || '-'}
                                    </SMSTypography>
                                    <SMSTypography variant="body2" sx={{ lineHeight: 1.25 }}>
                                        {e.primaryPhone ? formatPhoneNumber(e.primaryPhone) : '-'}
                                    </SMSTypography>
                                </React.Fragment>
                            ))}
                        </SMSBox>
                    </SMSBox>
                    <SMSStack direction="row" justifyContent="flex-end" spacing={1}>
                        <SMSButton
                            onClick={() => setAssignmentWarningState({
                                isOpen: false,
                                message: '',
                                employees: [],
                                pendingPost: null,
                                pendingTargetId: null,
                            })}
                            disabled={isConfirmingScheduleChanges}
                        >
                            Cancel
                        </SMSButton>
                        <SMSButton onClick={handleContinueScheduleChanges} loading={isConfirmingScheduleChanges}>
                            Continue and update scheduled jobs
                        </SMSButton>
                    </SMSStack>
                </SMSStack>
            </SMSModal>
        </SMSBox>
    );
};

export default SMSPostForm;
