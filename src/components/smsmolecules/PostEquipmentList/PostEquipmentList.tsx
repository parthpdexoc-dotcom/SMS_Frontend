import {
    SMSBox,
    SMSButton,
    SMSCheckbox,
    SMSDatePicker,
    SMSDropdown,
    SMSStack,
    SMSTextField,
    SMSTypography,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import {
  formatEquipmentEffectiveDate,
  toEquipmentDatePickerBound,
  validateEquipmentEffectiveDateRange,
} from '@/utils/equipmentEffectiveDates';
import { equipmentQuantityFieldProps } from '@/utils/equipmentQuantityRules';
import { POST_EQUIPMENT_LIST, REQUEST_EQUIPMENT_LIST } from '@/constants/strings';
import '@/components/smsmolecules/RequestEquipmentList/RequestEquipmentList.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SMSDataTableWrapper, SMSModal as Modal, SMSDataTableActions, type DataTableColumn } from '@/components/smsorganisms';
import { PostEquipmentDto } from '@/services/postEquipmentService';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentEquipmentOptions,
  fetchDepartmentVehicleOptions,
} from '@/store/slices/departmentEquipmentSlice';

export type PostEquipmentType = 'equipment' | 'vehicle';

export interface PostEquipmentListProps {
    items: PostEquipmentDto[];
    onItemsChange: (items: PostEquipmentDto[]) => void;
    departmentId?: string;
    disabled?: boolean;
    type?: PostEquipmentType; // Default to 'equipment'
    onSaveItem?: (item: PostEquipmentDto) => Promise<void> | void;
    onDeleteItem?: (item: PostEquipmentDto) => Promise<void> | void;
    /** Rows coming from parent request (or other locked source) should not be editable/removable. */
    isItemReadOnly?: (item: PostEquipmentDto) => boolean;
    /** When false, row can be edited but not removed (e.g. request-inherited on post form). */
    canDeleteItem?: (item: PostEquipmentDto) => boolean;
    /** Parent request period — effective dates selectable only within this range. */
    requestStartDate?: string;
    requestEndDate?: string;
    /** Total positions on the post; used for Per Shift vehicle quantity usage warnings. */
    totalPostPositions?: number;
}

export const PostEquipmentList: React.FC<PostEquipmentListProps> = ({
    items,
    onItemsChange,
    departmentId: _departmentId,
    disabled = false,
    type = 'equipment',
    onSaveItem,
    onDeleteItem,
    isItemReadOnly,
    canDeleteItem,
    requestStartDate,
    requestEndDate,
    totalPostPositions,
}) => {
    const dispatch = useAppDispatch();
    const isVehicle = type === 'vehicle';
    const catalogOptions = useAppSelector((state) =>
        isVehicle
            ? state.departmentEquipment.departmentVehicleOptions
            : state.departmentEquipment.departmentEquipmentOptions
    );
    const isLoading = useAppSelector((state) =>
        isVehicle
            ? state.departmentEquipment.isLoadingVehicleOptions
            : state.departmentEquipment.isLoadingEquipmentOptions
    );

    const normalizeId = (value: unknown): string =>
        String(value ?? '')
            .trim()
            .replace(/[{}()]/g, '')
            .toLowerCase();
    const looksLikeGuid = (value: string): boolean =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeId(value));

    const [selectedId, setSelectedId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('1');
    const [isPerJob, setIsPerJob] = useState<boolean>(false);
    const [isPerJobPosition, setIsPerJobPosition] = useState<boolean>(false);
    const [allocationError, setAllocationError] = useState<string | null>(null);
    const [effectiveStartDate, setEffectiveStartDate] = useState<string>('');
    const [effectiveEndDate, setEffectiveEndDate] = useState<string>('');
    const requestPeriodMin = useMemo(
        () => toEquipmentDatePickerBound(requestStartDate),
        [requestStartDate]
    );
    const requestPeriodMax = useMemo(
        () => toEquipmentDatePickerBound(requestEndDate),
        [requestEndDate]
    );
    const effectiveEndMin = useMemo(() => {
        const start = toEquipmentDatePickerBound(effectiveStartDate);
        return start ?? requestPeriodMin;
    }, [effectiveStartDate, requestPeriodMin]);
    const [addError, setAddError] = useState<string | null>(null);
    const [effectiveStartError, setEffectiveStartError] = useState<string | undefined>();
    const [effectiveEndError, setEffectiveEndError] = useState<string | undefined>();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [quantityAdjustDialogOpen, setQuantityAdjustDialogOpen] = useState<boolean>(false);
    const [quantityAdjustDialogMessage, setQuantityAdjustDialogMessage] = useState<string>('');
    const [quantityDialogIsWarningOnly, setQuantityDialogIsWarningOnly] = useState<boolean>(false);
    const [pendingItem, setPendingItem] = useState<PostEquipmentDto | null>(null);

    const effectiveDateMessages = useMemo(
        () => ({
            startRequired: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_START_DATE_REQUIRED,
            endRequired: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_END_DATE_REQUIRED,
            requestPeriodRequired:
                REQUEST_EQUIPMENT_LIST.COMMON.REQUEST_PERIOD_REQUIRED_FOR_EFFECTIVE_DATES,
            startOutOfRange: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_START_OUT_OF_REQUEST_RANGE,
            endOutOfRange: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_END_OUT_OF_REQUEST_RANGE,
            endBeforeStart: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_END_BEFORE_START,
        }),
        []
    );

    const prefillEffectiveDatesFromRequest = useCallback(() => {
        if (requestPeriodMin) setEffectiveStartDate(requestPeriodMin);
        if (requestPeriodMax) setEffectiveEndDate(requestPeriodMax);
    }, [requestPeriodMin, requestPeriodMax]);

    const resetAllocationFields = useCallback(() => {
        setIsPerJob(false);
        setIsPerJobPosition(false);
        setAllocationError(null);
    }, []);

    const prevRequestPeriodKeyRef = useRef('');

    useEffect(() => {
        if (!requestPeriodMin || !requestPeriodMax) return;
        const periodKey = `${requestPeriodMin}|${requestPeriodMax}`;
        const periodChanged =
            prevRequestPeriodKeyRef.current !== '' && prevRequestPeriodKeyRef.current !== periodKey;
        prevRequestPeriodKeyRef.current = periodKey;

        if (periodChanged) {
            setEffectiveStartDate(requestPeriodMin);
            setEffectiveEndDate(requestPeriodMax);
            setEffectiveStartError(undefined);
            setEffectiveEndError(undefined);
            return;
        }
        if (!effectiveStartDate && !effectiveEndDate) {
            setEffectiveStartDate(requestPeriodMin);
            setEffectiveEndDate(requestPeriodMax);
        }
    }, [requestPeriodMin, requestPeriodMax, effectiveStartDate, effectiveEndDate]);

    const [editingItem, setEditingItem] = useState<PostEquipmentDto | null>(null);

    const persistedSelectedIds = useMemo(
        () =>
            Array.from(
                new Set(
                    [...items.map((item) => item.departmentEquipmentID), editingItem?.departmentEquipmentID]
                        .map((id) => String(id ?? '').trim())
                        .filter(Boolean)
                )
            ),
        [items, editingItem?.departmentEquipmentID]
    );
    const persistedSelectedIdsRef = useRef(persistedSelectedIds);
    persistedSelectedIdsRef.current = persistedSelectedIds;
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;

    const handleOptionsSearchInputChange = useCallback(
        (value: string) => {
            const selectedIds = Array.from(
                new Set(
                    [...persistedSelectedIdsRef.current, selectedIdRef.current]
                        .map((id) => String(id ?? '').trim())
                        .filter(Boolean)
                )
            );
            return dispatch(
                isVehicle
                    ? fetchDepartmentVehicleOptions({
                          searchTerm: value,
                          selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
                      })
                    : fetchDepartmentEquipmentOptions({
                          searchTerm: value,
                          selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
                      })
            )
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch, isVehicle]
    );

    const prevItemCountRef = useRef(items.length);
    const hasAppliedInitialDefaultRef = useRef(false);

    useEffect(() => {
        if (prevItemCountRef.current > 0 && items.length === 0 && !editingItem && !isModalOpen) {
            resetAllocationFields();
        }
        prevItemCountRef.current = items.length;
    }, [items.length, editingItem, isModalOpen, resetAllocationFields]);

    const STRINGS = isVehicle ? REQUEST_EQUIPMENT_LIST.VEHICLE : REQUEST_EQUIPMENT_LIST.EQUIPMENT;
    const displayTitle = STRINGS.TITLE;
    const perPositionQuantityWarning = isVehicle
        ? 'The maximum allowed quantity is 1 Vehicle per position.'
        : '';

    const getOptionLabelForId = useCallback(
        (equipmentId: string): string =>
            catalogOptions.find((option) => normalizeId(option.id) === normalizeId(equipmentId))?.label ??
            'Unknown',
        [catalogOptions]
    );

    const resolveDefaultSelectedId = useCallback((): string => {
        const excludeIds = new Set(
            items
                .map((item) => normalizeId(item.departmentEquipmentID))
                .filter((id) => id.length > 0)
        );
        const defaultOption = catalogOptions.find(
            (option) =>
                option.isDefault &&
                option.id &&
                !excludeIds.has(normalizeId(option.id))
        );
        return defaultOption?.id ? String(defaultOption.id).trim() : '';
    }, [catalogOptions, items]);

    useEffect(() => {
        if (hasAppliedInitialDefaultRef.current || editingItem || items.length > 0 || selectedId) return;
        if (catalogOptions.length === 0) return;
        const defaultId = resolveDefaultSelectedId();
        if (!defaultId) return;
        hasAppliedInitialDefaultRef.current = true;
        setSelectedId(defaultId);
    }, [catalogOptions, editingItem, items.length, selectedId, resolveDefaultSelectedId]);

    const hasAllocationSelected = isPerJob || isPerJobPosition;

    useEffect(() => {
        if (hasAllocationSelected) {
            setAllocationError(null);
        }
    }, [hasAllocationSelected]);

    const showAllocationError = Boolean(allocationError) && !hasAllocationSelected;

    const perAllocationRequiredMessage = POST_EQUIPMENT_LIST.PER_ALLOCATION_REQUIRED;

    const quantityField = useMemo(() => equipmentQuantityFieldProps(
        isVehicle && isPerJobPosition,
        addError,
        STRINGS.ERRORS.QUANTITY_INVALID,
        perPositionQuantityWarning
    ), [isVehicle, isPerJobPosition, addError, STRINGS.ERRORS.QUANTITY_INVALID, perPositionQuantityWarning]);

    const handlePerJobChange = (checked: boolean) => {
        setIsPerJob(checked);
        if (checked) setIsPerJobPosition(false);
    };

    const handlePerJobPositionChange = (checked: boolean) => {
        setIsPerJobPosition(checked);
        if (checked) setIsPerJob(false);
    };

    const perJobLabel = POST_EQUIPMENT_LIST.PER_REQUEST;
    const perJobPositionLabel = POST_EQUIPMENT_LIST.PER_POST;

    const allocationCheckboxes = (
        <SMSStack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="nowrap"
            className="equipment-allocation-checkboxes"
            sx={{
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                '& > div': { width: 'auto', flex: '0 0 auto' },
            }}
        >
            <SMSCheckbox
                label={perJobLabel}
                checked={isPerJob}
                onChange={handlePerJobChange}
                disabled={disabled || isLoading}
            />
            <SMSCheckbox
                label={perJobPositionLabel}
                checked={isPerJobPosition}
                onChange={handlePerJobPositionChange}
                disabled={disabled || isLoading}
            />
        </SMSStack>
    );

    const formatPerJobAllocation = (perJobPosition: boolean) =>
        perJobPosition
            ? POST_EQUIPMENT_LIST.PER_POST_VALUE
            : POST_EQUIPMENT_LIST.PER_REQUEST_VALUE;

    const effectiveStartDateField = (
        <SMSBox component="div" sx={{ width: '100%', minWidth: 0 }}>
            <SMSDatePicker
                label={REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_START_DATE}
                id={`post-equipment-effective-start-${type}`}
                value={effectiveStartDate}
                onChange={(value) => {
                    setEffectiveStartDate(value);
                    setEffectiveStartError(undefined);
                    const endKey = toEquipmentDatePickerBound(effectiveEndDate);
                    const startKey = toEquipmentDatePickerBound(value);
                    if (endKey && startKey && endKey < startKey) {
                        setEffectiveEndDate('');
                    }
                }}
                minDate={requestPeriodMin}
                maxDate={requestPeriodMax}
                required
                error={effectiveStartError}
                disabled
            />
        </SMSBox>
    );

    const effectiveEndDateField = (
        <SMSBox component="div" sx={{ width: '100%', minWidth: 0 }}>
            <SMSDatePicker
                label={REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_END_DATE}
                id={`post-equipment-effective-end-${type}`}
                value={effectiveEndDate}
                onChange={(value) => {
                    setEffectiveEndDate(value);
                    setEffectiveEndError(undefined);
                }}
                minDate={effectiveEndMin}
                maxDate={requestPeriodMax}
                required
                error={effectiveEndError}
                disabled
            />
        </SMSBox>
    );

    const effectiveDateFields = (
        <>
            {effectiveStartDateField}
            {effectiveEndDateField}
        </>
    );

    const persistItem = async (newItem: PostEquipmentDto) => {
        if (onSaveItem) {
            try {
                await onSaveItem(newItem);
            } catch (_e) {
                setAddError("Failed to save item.");
                return;
            }
        } else {
            if (editingItem) {
                const newItems = items.map(i => i === editingItem ? newItem : i);
                onItemsChange(newItems);
            } else {
                onItemsChange([...items, newItem]);
            }
        }

        handleCloseModal();
    };

    const handleAdd = async () => {
        setAddError(null);
        setAllocationError(null);
        if (!selectedId) {
            setAddError(STRINGS.ERRORS.SELECT_REQUIRED);
            return;
        }
        const qty = parseInt(quantity);
        if (isNaN(qty) || qty <= 0) {
            setAddError(STRINGS.ERRORS.QUANTITY_INVALID);
            return;
        }
        if (!isPerJob && !isPerJobPosition) {
            setAllocationError(perAllocationRequiredMessage);
            return;
        }

        const startKey =
            toEquipmentDatePickerBound(effectiveStartDate) ??
            toEquipmentDatePickerBound(requestStartDate);
        const endKey =
            toEquipmentDatePickerBound(effectiveEndDate) ??
            toEquipmentDatePickerBound(requestEndDate);

        const dateValidation = validateEquipmentEffectiveDateRange(
            startKey ?? '',
            endKey ?? '',
            requestStartDate,
            requestEndDate,
            effectiveDateMessages
        );
        setEffectiveStartError(dateValidation.effectiveStartError);
        setEffectiveEndError(dateValidation.effectiveEndError);
        if (dateValidation.effectiveStartError || dateValidation.effectiveEndError) {
            return;
        }

        // Check for duplicates
        const existing = items.find(i => i.departmentEquipmentID === selectedId);
        if (existing && (!editingItem || editingItem.departmentEquipmentID !== selectedId)) {
            setAddError(STRINGS.ERRORS.ALREADY_ADDED);
            return;
        }

        const selectedOption = catalogOptions.find(
            (option) => normalizeId(option.id) === normalizeId(selectedId)
        );
        const displayName =
            (selectedOption?.label?.trim() || null) ??
            editingItem?.equipmentName?.trim() ??
            editingItem?.equipmentTypeName?.trim() ??
            null;

        const newItem: PostEquipmentDto = {
            departmentEquipmentID: selectedId,
            equipmentPerPostPosition: isPerJobPosition,
            equipmentQuantity: qty,
            isVehicle,
            equipmentName: displayName,
            equipmentTypeName: displayName,
            postEquipmentID: editingItem ? editingItem.postEquipmentID : undefined,
            postID: editingItem ? editingItem.postID : undefined,
            startDate: startKey!,
            endDate: endKey!,
        };

        const normalizedTotalPositions =
            typeof totalPostPositions === 'number' && totalPostPositions > 0
                ? Math.floor(totalPostPositions)
                : 0;
        // Per Shift vehicles: each eligible person gets 1, so extra quantity cannot be used.
        // Per Shift equipment: the full quantity goes to one person, so do not warn.
        if (isVehicle && isPerJob && normalizedTotalPositions > 0 && qty > normalizedTotalPositions) {
            const itemLabel = normalizedTotalPositions === 1 ? 'Vehicle' : 'Vehicles';
            const positionWord = normalizedTotalPositions === 1 ? 'position' : 'positions';
            const copula = normalizedTotalPositions === 1 ? 'is' : 'are';
            setPendingItem(newItem);
            setQuantityDialogIsWarningOnly(true);
            setQuantityAdjustDialogMessage(
                `Only ${normalizedTotalPositions} ${itemLabel} will be used because there ${copula} only ${normalizedTotalPositions} ${positionWord}.`
            );
            setQuantityAdjustDialogOpen(true);
            return;
        }

        if (isVehicle && isPerJobPosition && qty > 1) {
            setPendingItem({
                ...newItem,
                equipmentQuantity: 1,
            });
            setQuantityAdjustDialogMessage(
                perPositionQuantityWarning
            );
            setQuantityAdjustDialogOpen(true);
            return;
        }

        await persistItem(newItem);
    };

    const handleEdit = (item: PostEquipmentDto) => {
        setEditingItem(item);
        setSelectedId(item.departmentEquipmentID || '');
        setQuantity(item.equipmentQuantity.toString());
        const perJobPosition = Boolean(item.equipmentPerPostPosition);
        setIsPerJobPosition(perJobPosition);
        setIsPerJob(!perJobPosition);
        const start = toEquipmentDatePickerBound(item.startDate) ?? '';
        const end = toEquipmentDatePickerBound(item.endDate) ?? '';
        setEffectiveStartDate(start || requestPeriodMin || '');
        setEffectiveEndDate(end || requestPeriodMax || '');
        setEffectiveStartError(undefined);
        setEffectiveEndError(undefined);
        setAddError(null);
        setAllocationError(null);
        setIsModalOpen(true);
    };

    const handleRemove = async (item: PostEquipmentDto) => {
        if (onDeleteItem) {
            await onDeleteItem(item);
        } else {
            const newItems = items.filter(i => i !== item);
            onItemsChange(newItems);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setAddError(null);
        setSelectedId(resolveDefaultSelectedId());
        setQuantity('1');
        resetAllocationFields();
        prefillEffectiveDatesFromRequest();
        setEffectiveStartError(undefined);
        setEffectiveEndError(undefined);
        setEditingItem(null);
    };

    const getRowDisplayName = (item: PostEquipmentDto): string => {
        const apiName = item.equipmentName?.trim() || item.equipmentTypeName?.trim();
        if (apiName && !looksLikeGuid(apiName)) return apiName;
        if (!item.departmentEquipmentID) return 'Unknown';
        return getOptionLabelForId(item.departmentEquipmentID);
    };

    const dropdownOptions = useMemo(
        () => catalogOptions.map((option) => ({ value: option.id, label: option.label })),
        [catalogOptions]
    );

    const options = useMemo(() => {
        const selected = String(selectedId ?? '').trim();
        if (!selected) return dropdownOptions;
        const hasSelected = dropdownOptions.some(
            (o) => normalizeId(o.value) === normalizeId(selected)
        );
        if (hasSelected) return dropdownOptions;
        const catalogLabel = catalogOptions.find(
            (option) => normalizeId(option.id) === normalizeId(selected)
        )?.label;
        const fallbackLabel =
            catalogLabel?.trim() ||
            editingItem?.equipmentName?.trim() ||
            editingItem?.equipmentTypeName?.trim() ||
            'Loading...';
        return [{ value: selected, label: fallbackLabel }, ...dropdownOptions];
    }, [
        dropdownOptions,
        selectedId,
        catalogOptions,
        editingItem?.equipmentName,
        editingItem?.equipmentTypeName,
    ]);

    const assignedDeptIds = new Set(
        items
            .map((i) => normalizeId(i.departmentEquipmentID))
            .filter((id) => id.length > 0)
    );
    const editingId = normalizeId(editingItem?.departmentEquipmentID);
    const filteredOptions = options.filter((o) => {
        const id = normalizeId(o.value);
        if (!id) return false;
        if (editingId && id === editingId) return true;
        return !assignedDeptIds.has(id);
    });

    const columns: DataTableColumn<PostEquipmentDto>[] = [
        {
            key: 'departmentEquipmentID',
            label: STRINGS.LABEL,
            render: (_, row) => getRowDisplayName(row),
        },
        {
            key: 'equipmentQuantity',
            label: REQUEST_EQUIPMENT_LIST.COMMON.QUANTITY,
        },
        {
            key: 'equipmentPerPostPosition',
            label: POST_EQUIPMENT_LIST.PER_JOB_POSITION_LABEL,
            render: (val: boolean) => formatPerJobAllocation(val),
        },
        {
            key: 'startDate',
            label: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_START_DATE,
            render: (_val, row) => formatEquipmentEffectiveDate(row.startDate),
        },
        {
            key: 'endDate',
            label: REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_END_DATE,
            render: (_val, row) => formatEquipmentEffectiveDate(row.endDate),
        },
        {
            key: 'action',
            label: REQUEST_EQUIPMENT_LIST.COMMON.ACTION,
            render: (_, row) => {
                const readOnly = Boolean(isItemReadOnly?.(row));
                if (readOnly) return '-';
                const allowDelete = canDeleteItem ? canDeleteItem(row) : true;
                return (
                    <SMSDataTableActions
                        onEdit={() => handleEdit(row)}
                        onDelete={() => handleRemove(row)}
                        deleteDisabled={!allowDelete}
                        editLabel="Edit"
                        deleteLabel="Delete"
                    />
                );
            },
        },
    ];

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const paginationConfig = {
        currentPage,
        pageSize,
        totalItems: items.length,
        onPageChange: setCurrentPage,
        onPageSizeChange: setPageSize
    };

    const addButton = (
        <SMSButton
            onClick={() => {
                setAddError(null);
                setEffectiveStartError(undefined);
                setEffectiveEndError(undefined);
                setEditingItem(null);
                resetAllocationFields();
                setSelectedId(resolveDefaultSelectedId());
                prefillEffectiveDatesFromRequest();
                setIsModalOpen(true);
            }}
            disabled={disabled || isLoading}
        >
            {STRINGS.ADD_BUTTON}
        </SMSButton>
    );

    const customTitle = (
        <SMSStack direction="row" justifyContent="space-between" alignItems="center">
            <span>{displayTitle}</span>
            {addButton}
        </SMSStack>
    );

    const quantityWarningDialog = (
        <SMSConfirmDialog
            open={quantityAdjustDialogOpen}
            onClose={() => {
                setQuantityAdjustDialogOpen(false);
                setPendingItem(null);
                setQuantityAdjustDialogMessage('');
                setQuantityDialogIsWarningOnly(false);
            }}
            onConfirm={async () => {
                if (!pendingItem) {
                    setQuantityAdjustDialogOpen(false);
                    return;
                }
                await persistItem(pendingItem);
                setQuantityAdjustDialogOpen(false);
                setPendingItem(null);
                setQuantityAdjustDialogMessage('');
                setQuantityDialogIsWarningOnly(false);
            }}
            title={quantityDialogIsWarningOnly ? 'Quantity Warning' : 'Quantity Adjusted'}
            message={quantityAdjustDialogMessage}
            variant="warning"
            confirmText={quantityDialogIsWarningOnly ? 'OK' : 'Use Adjusted Quantity'}
            cancelText="Cancel"
        />
    );

    // Render Empty State (Inline Form)
    if (items.length === 0) {
        return (
            <SMSBox
                component="div"
                className={`post-equipment-list post-equipment-list--${type} request-equipment-list request-equipment-list--${type}`}
                sx={{ width: '100%' }}
            >
                <SMSBox component="div" className="request-equipment-list__empty-state">
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--vehicle"
                    >
                        <SMSDropdown
                            label={STRINGS.LABEL}
                            options={filteredOptions}
                            value={selectedId}
                            onChange={(e) => setSelectedId(String(e.target.value))}
                            placeholder={STRINGS.PLACEHOLDER}
                            disabled={disabled}
                            clearable
                            serverSideSearch
                            onSearchInputChange={handleOptionsSearchInputChange}
                            noOptionsText="No options"
                            helperText={addError === STRINGS.ERRORS.SELECT_REQUIRED ? addError : undefined}
                            error={addError === STRINGS.ERRORS.SELECT_REQUIRED}
                            fullWidth
                        />
                    </SMSBox>
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--quantity"
                    >
                        <SMSTextField
                            type="number"
                            label={REQUEST_EQUIPMENT_LIST.COMMON.QUANTITY}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            inputProps={{ min: 1 }}
                            disabled={disabled || isLoading}
                            helperText={quantityField.error ? quantityField.helperText : undefined}
                            error={quantityField.error}
                            fullWidth
                        />
                    </SMSBox>
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--allocation"
                    >
                        {allocationCheckboxes}
                    </SMSBox>
                    {!quantityField.error && quantityField.helperText ? (
                        <SMSBox
                            component="div"
                            className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--quantity-hint"
                        >
                            <SMSTypography component="p" className="request-equipment-list__quantity-hint">
                                {quantityField.helperText}
                            </SMSTypography>
                        </SMSBox>
                    ) : null}
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--start"
                    >
                        {effectiveStartDateField}
                    </SMSBox>
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--end"
                    >
                        {effectiveEndDateField}
                    </SMSBox>
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--add"
                    >
                        <SMSButton
                            onClick={handleAdd}
                            disabled={
                                disabled ||
                                isLoading ||
                                !selectedId ||
                                !requestPeriodMin ||
                                !requestPeriodMax
                            }
                            type="button"
                        >
                            {STRINGS.ADD_BUTTON}
                        </SMSButton>
                    </SMSBox>
                </SMSBox>
                {(showAllocationError || addError || effectiveStartError || effectiveEndError) && (
                    <SMSTypography component="div" sx={{ color: 'red', marginTop: '0.5rem' }}>
                        {showAllocationError
                            ? allocationError
                            : effectiveStartError || effectiveEndError || addError}
                    </SMSTypography>
                )}
                {quantityWarningDialog}
            </SMSBox>
        );
    }

    return (
        <SMSBox
            component="div"
            className={`post-equipment-list post-equipment-list--${type} request-equipment-list request-equipment-list--${type}`}
            sx={{ width: '100%' }}
        >
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={(editingItem ? 'Edit ' : STRINGS.ADD_BUTTON + ' ') + STRINGS.LABEL}
                size="small"
                className="add-equipment-modal"
            >
                <SMSStack direction="column" spacing={1.5} className="request-equipment-list__form-column">
                    <SMSBox component="div">
                        <SMSDropdown
                            label={STRINGS.LABEL}
                            options={filteredOptions}
                            value={selectedId}
                            onChange={(e) => setSelectedId(String(e.target.value))}
                            placeholder={STRINGS.PLACEHOLDER}
                            disabled={disabled}
                            clearable
                            serverSideSearch
                            onSearchInputChange={handleOptionsSearchInputChange}
                            noOptionsText="No options"
                            helperText={addError === STRINGS.ERRORS.SELECT_REQUIRED ? addError : undefined}
                            error={Boolean(addError === STRINGS.ERRORS.SELECT_REQUIRED)}
                            fullWidth
                        />
                    </SMSBox>
                    <SMSBox component="div">
                        <SMSTextField
                            type="number"
                            label={REQUEST_EQUIPMENT_LIST.COMMON.QUANTITY}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            inputProps={{ min: 1 }}
                            disabled={disabled || isLoading}
                            helperText={quantityField.helperText}
                            error={quantityField.error}
                            fullWidth
                        />
                    </SMSBox>
                    <SMSBox component="div">{allocationCheckboxes}</SMSBox>
                    {effectiveDateFields}
                    {showAllocationError && (
                        <SMSTypography component="div" sx={{ color: 'red' }}>
                            {allocationError}
                        </SMSTypography>
                    )}
                    {addError && (
                        <SMSTypography component="div" sx={{ color: 'red' }}>
                            {addError}
                        </SMSTypography>
                    )}
                    <SMSStack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ marginTop: '1rem' }}>
                        <SMSButton variant="outlined" onClick={handleCloseModal} type="button">
                            Cancel
                        </SMSButton>
                        <SMSButton
                            onClick={handleAdd}
                            disabled={disabled || isLoading || !selectedId}
                            type="button"
                        >
                            {editingItem ? 'Update' : STRINGS.ADD_BUTTON}
                        </SMSButton>
                    </SMSStack>
                </SMSStack>
            </Modal>

            <SMSDataTableWrapper
                columns={columns}
                data={items}
                title={customTitle}
                searchable={false}
                pagination={paginationConfig}
            />
            {quantityWarningDialog}
        </SMSBox>
    );
};
