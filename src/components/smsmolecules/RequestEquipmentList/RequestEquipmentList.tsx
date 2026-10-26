import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SMSBox,
  SMSButton,
  SMSCheckbox,
  SMSDropdown,
  SMSStack,
  SMSTextField,
  SMSTypography,
  SMSDatePicker,
} from '@/components/smsatoms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import {
  formatEquipmentEffectiveDate,
  toEquipmentDatePickerBound,
  validateEquipmentEffectiveDateRange,
} from '@/utils/equipmentEffectiveDates';
import {
  equipmentQuantityFieldProps,
} from '@/utils/equipmentQuantityRules';
import { SMSDataTableWrapper, SMSModal as Modal, SMSDataTableActions, type DataTableColumn } from '@/components/smsorganisms';
import { RequestEquipmentDto } from '@/services/requestEquipmentService';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDepartmentEquipmentOptions,
  fetchDepartmentVehicleOptions,
} from '@/store/slices/departmentEquipmentSlice';
import { REQUEST_EQUIPMENT_LIST } from '@/constants/strings';
import './RequestEquipmentList.css';

export type RequestEquipmentType = 'equipment' | 'vehicle';

export interface RequestEquipmentListProps {
    items: RequestEquipmentDto[];
    onItemsChange: (items: RequestEquipmentDto[]) => void;
    departmentId?: string;
    disabled?: boolean;
    type?: RequestEquipmentType; // Default to 'equipment' if not provided
    title?: string;
    onSaveItem?: (item: RequestEquipmentDto) => Promise<void> | void;
    onDeleteItem?: (item: RequestEquipmentDto) => Promise<void> | void;
    /** Called when user has selected an item and valid quantity (before clicking Add). Use to clear "Add data first" validation. */
    onDraftChange?: (hasDraft: boolean) => void;
    /** Request period — effective dates selectable only within this range. */
    requestStartDate?: string;
    requestEndDate?: string;
}

export const RequestEquipmentList: React.FC<RequestEquipmentListProps> = ({
    items,
    onItemsChange,
    departmentId: _departmentId,
    disabled = false,
    type = 'equipment',
    title,
    onSaveItem,
    onDeleteItem,
    onDraftChange,
    requestStartDate,
    requestEndDate,
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
    const STRINGS = isVehicle ? REQUEST_EQUIPMENT_LIST.VEHICLE : REQUEST_EQUIPMENT_LIST.EQUIPMENT;
    // Use passed title or fallback to STRINGS.TITLE
    const displayTitle = title || STRINGS.TITLE;

    const normalizeId = (value: unknown): string =>
        String(value ?? '')
            .trim()
            .replace(/[{}()]/g, '')
            .toLowerCase();
    const looksLikeGuid = (value: string): boolean =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeId(value));

    const [selectedId, setSelectedId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('1');
    const [isPerRequest, setIsPerRequest] = useState<boolean>(false);
    const [isPerPost, setIsPerPost] = useState<boolean>(false);
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

    const effectiveDatePickerProps = {
      start: {
        minDate: requestPeriodMin,
        maxDate: requestPeriodMax,
      },
      end: {
        minDate: effectiveEndMin,
        maxDate: requestPeriodMax,
      },
    } as const;

    const [addError, setAddError] = useState<string | null>(null);
    const [allocationError, setAllocationError] = useState<string | null>(null);
    const [quantityAdjustDialogOpen, setQuantityAdjustDialogOpen] = useState(false);
    const [quantityAdjustDialogMessage, setQuantityAdjustDialogMessage] = useState('');
    const [pendingItem, setPendingItem] = useState<RequestEquipmentDto | null>(null);
    const [effectiveStartError, setEffectiveStartError] = useState<string | undefined>();
    const [effectiveEndError, setEffectiveEndError] = useState<string | undefined>();

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
        setIsPerRequest(false);
        setIsPerPost(false);
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
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingItem, setEditingItem] = useState<RequestEquipmentDto | null>(null);

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

    const handleOptionsSearchInputChange = useCallback(
        (value: string) => {
            const selectedIds =
                persistedSelectedIdsRef.current.length > 0 ? persistedSelectedIdsRef.current : undefined;
            return dispatch(
                isVehicle
                    ? fetchDepartmentVehicleOptions({ searchTerm: value, selectedIds })
                    : fetchDepartmentEquipmentOptions({ searchTerm: value, selectedIds })
            )
                .unwrap()
                .catch(() => undefined);
        },
        [dispatch, isVehicle]
    );

    const hasAppliedInitialDefaultRef = useRef(false);

    const prevItemCountRef = useRef(items.length);
    useEffect(() => {
        if (prevItemCountRef.current > 0 && items.length === 0 && !editingItem && !isModalOpen) {
            resetAllocationFields();
        }
        prevItemCountRef.current = items.length;
    }, [items.length, editingItem, isModalOpen, resetAllocationFields]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const getOptionLabelForId = useCallback(
        (equipmentId: string): string =>
            catalogOptions.find((option) => normalizeId(option.id) === normalizeId(equipmentId))?.label ??
            REQUEST_EQUIPMENT_LIST.COMMON.UNKNOWN_TYPE,
        [catalogOptions]
    );

    const resolveDefaultSelectedId = (): string => {
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
    };

    useEffect(() => {
        if (hasAppliedInitialDefaultRef.current || editingItem || items.length > 0 || selectedId) return;
        if (catalogOptions.length === 0) return;
        const defaultId = resolveDefaultSelectedId();
        if (!defaultId) return;
        hasAppliedInitialDefaultRef.current = true;
        setSelectedId(defaultId);
    }, [catalogOptions, editingItem, items.length, selectedId]);

    // Notify parent when user has a valid draft (selected item + quantity) so validation error can be cleared
    useEffect(() => {
        if (!onDraftChange || items.length > 0) return;
        const qty = parseInt(quantity, 10);
        const hasDraft = !!selectedId && !isNaN(qty) && qty > 0;
        onDraftChange(hasDraft);
    }, [onDraftChange, items.length, selectedId, quantity]);

    const hasAllocationSelected = isPerRequest || isPerPost;

    useEffect(() => {
        if (hasAllocationSelected) {
            setAllocationError(null);
        }
    }, [hasAllocationSelected]);

    const showAllocationError = Boolean(allocationError) && !hasAllocationSelected;

    const perAllocationRequiredMessage =
        STRINGS.ERRORS.PER_ALLOCATION_REQUIRED ?? REQUEST_EQUIPMENT_LIST.COMMON.PER_ALLOCATION_REQUIRED;

    const perPositionQuantityWarning = isVehicle
        ? 'The maximum allowed quantity is 1 Vehicle per position.'
        : '';

    const quantityField = equipmentQuantityFieldProps(
        isVehicle && isPerPost,
        addError,
        STRINGS.ERRORS.QUANTITY_INVALID,
        perPositionQuantityWarning
    );

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
        if (!isPerRequest && !isPerPost) {
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

        // Check for duplicates (only if adding new or changing ID)
        const isIdChanged = editingItem && editingItem.departmentEquipmentID !== selectedId;
        const existing = items.find(i => i.departmentEquipmentID === selectedId);
        if ((!editingItem || isIdChanged) && existing) {
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

        const newItem: RequestEquipmentDto = {
            departmentEquipmentID: selectedId,
            equipmentPerPost: isPerRequest,
            equipmentQuantity: qty,
            isVehicle,
            equipmentName: displayName,
            equipmentTypeName: displayName,
            requestEquipmentID: editingItem
                ? (editingItem.requestEquipmentID || (editingItem as any).RequestEquipmentID)
                : undefined,
            requestID: editingItem?.requestID,
            startDate: startKey!,
            endDate: endKey!,
        };

        if (isVehicle && isPerPost && qty > 1) {
            setPendingItem({
                ...newItem,
                equipmentQuantity: 1,
            });
            setQuantityAdjustDialogMessage(perPositionQuantityWarning);
            setQuantityAdjustDialogOpen(true);
            return;
        }

        await persistItem(newItem);
    };

    const persistItem = async (newItem: RequestEquipmentDto) => {
        if (onSaveItem) {
            try {
                await onSaveItem(newItem);
            } catch (e) {
                setAddError("Failed to save item. Please check your network or inputs.");
                return;
            }
        } else {
            if (editingItem) {
                const index = items.findIndex(i => i === editingItem);
                if (index !== -1) {
                    const newItems = [...items];
                    newItems[index] = newItem;
                    onItemsChange(newItems);
                }
            } else {
                onItemsChange([...items, newItem]);
            }
        }

        handleCloseModal();
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setAddError(null);
        setAllocationError(null);
        setQuantityAdjustDialogOpen(false);
        setQuantityAdjustDialogMessage('');
        setPendingItem(null);
        setSelectedId(resolveDefaultSelectedId());
        setQuantity('1');
        resetAllocationFields();
        prefillEffectiveDatesFromRequest();
        setEffectiveStartError(undefined);
        setEffectiveEndError(undefined);
        setEditingItem(null);
    };

    const handlePerRequestChange = (checked: boolean) => {
        setIsPerRequest(checked);
        if (checked) setIsPerPost(false);
    };

    const handlePerPostChange = (checked: boolean) => {
        setIsPerPost(checked);
        if (checked) setIsPerRequest(false);
    };

    const perRequestLabel = isVehicle ? STRINGS.PER_REQUEST : REQUEST_EQUIPMENT_LIST.EQUIPMENT.PER_REQUEST;
    const perPostLabel = isVehicle ? STRINGS.PER_POST : REQUEST_EQUIPMENT_LIST.EQUIPMENT.PER_POST;

    const effectiveStartDateField = (
        <SMSBox component="div" sx={{ width: '100%', minWidth: 0 }}>
            <SMSDatePicker
                label={REQUEST_EQUIPMENT_LIST.COMMON.EFFECTIVE_START_DATE}
                id={`request-equipment-effective-start-${type}`}
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
                minDate={effectiveDatePickerProps.start.minDate}
                maxDate={effectiveDatePickerProps.start.maxDate}
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
                id={`request-equipment-effective-end-${type}`}
                value={effectiveEndDate}
                onChange={(value) => {
                    setEffectiveEndDate(value);
                    setEffectiveEndError(undefined);
                }}
                minDate={effectiveDatePickerProps.end.minDate}
                maxDate={effectiveDatePickerProps.end.maxDate}
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
                label={perRequestLabel}
                checked={isPerRequest}
                onChange={handlePerRequestChange}
                disabled={disabled || isLoading || isPerPost}
            />
            <SMSCheckbox
                label={perPostLabel}
                checked={isPerPost}
                onChange={handlePerPostChange}
                disabled={disabled || isLoading || isPerRequest}
            />
        </SMSStack>
    );

    /** equipmentPerPost true = Per Job; false = Per Job Position */
    const formatPerJobAllocation = (equipmentPerPost: boolean) =>
        equipmentPerPost
            ? REQUEST_EQUIPMENT_LIST.COMMON.PER_REQUEST_VALUE
            : isVehicle
              ? REQUEST_EQUIPMENT_LIST.VEHICLE.PER_JOB_VALUE
              : REQUEST_EQUIPMENT_LIST.COMMON.PER_POST_VALUE;

    const handleEdit = (item: RequestEquipmentDto) => {
        setEditingItem(item);
        setSelectedId(item.departmentEquipmentID || '');
        setQuantity(item.equipmentQuantity.toString());
        const perJob = Boolean(item.equipmentPerPost);
        setIsPerRequest(perJob);
        setIsPerPost(!perJob);
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

    const handleRemove = async (index: number) => {
        const itemToRemove = items[index];
        if (onDeleteItem && itemToRemove) {
            await onDeleteItem(itemToRemove);
        } else {
            const newItems = items.filter(i => i !== itemToRemove);
            onItemsChange(newItems);
        }
    };

    const getRowDisplayName = (item: RequestEquipmentDto): string => {
        const apiName = item.equipmentName?.trim() || item.equipmentTypeName?.trim();
        if (apiName && !looksLikeGuid(apiName)) return apiName;
        if (!item.departmentEquipmentID) return REQUEST_EQUIPMENT_LIST.COMMON.UNKNOWN_NAME;
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
        const fallbackLabel =
            editingItem?.equipmentName?.trim() ||
            editingItem?.equipmentTypeName?.trim();
        if (!fallbackLabel) return dropdownOptions;
        return [{ value: selected, label: fallbackLabel }, ...dropdownOptions];
    }, [dropdownOptions, selectedId, editingItem?.equipmentName, editingItem?.equipmentTypeName]);

    const filteredOptions = useMemo(() => {
        const assignedDeptIds = new Set(
            items
                .map((item) => normalizeId(item.departmentEquipmentID))
                .filter((id) => id.length > 0)
        );
        const editingId = normalizeId(editingItem?.departmentEquipmentID);
        return options.filter((option) => {
            const id = normalizeId(option.value);
            if (!id) return false;
            if (editingId && id === editingId) return true;
            return !assignedDeptIds.has(id);
        });
    }, [options, items, editingItem?.departmentEquipmentID]);

    useEffect(() => {
        if (editingItem || !selectedId) return;
        const stillAvailable = filteredOptions.some(
            (option) => normalizeId(option.value) === normalizeId(selectedId)
        );
        if (!stillAvailable) {
            setSelectedId('');
        }
    }, [filteredOptions, selectedId, editingItem]);

    const columns: DataTableColumn<RequestEquipmentDto>[] = [
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
            key: 'equipmentPerPost',
            label: REQUEST_EQUIPMENT_LIST.COMMON.PER_JOB_POSITION_LABEL,
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
            render: (_, row) => (
                <SMSDataTableActions
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleRemove(items.indexOf(row))}
                    editLabel="Edit"
                    deleteLabel="Delete"
                    deleteDisabled={disabled}
                    className="request-equipment-list__actions"
                />
            ),
        },
    ];

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
            type="button"
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
            }}
            title="Quantity Adjusted"
            message={quantityAdjustDialogMessage}
            variant="warning"
            confirmText="Use Adjusted Quantity"
            cancelText="Cancel"
        />
    );

    // Render Empty State (Inline Form)
    if (items.length === 0) {
        return (
            <SMSBox component="div" className={`request-equipment-list request-equipment-list--${type}`} sx={{ width: '100%' }}>
                <SMSBox component="div" className="request-equipment-list__empty-state">
                    <SMSBox
                        component="div"
                        className="request-equipment-list__empty-state-field request-equipment-list__empty-state-field--vehicle"
                    >
                        <SMSDropdown
                            label={STRINGS.LABEL}
                            options={filteredOptions}
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value as string)}
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
        <SMSBox component="div" className={`request-equipment-list request-equipment-list--${type}`} sx={{ width: '100%' }}>
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={(editingItem ? "Edit " : STRINGS.ADD_BUTTON + ' ') + STRINGS.LABEL}
                size="small"
                className="add-equipment-modal"
            >
                <SMSStack direction="column" spacing={1.5} className="request-equipment-list__form-column">
                    <SMSBox component="div">
                        <SMSDropdown
                            label={STRINGS.LABEL}
                            options={filteredOptions}
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value as string)}
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
                        <SMSButton
                            variant="outlined"
                            onClick={handleCloseModal}
                            type="button"
                        >
                            Cancel
                        </SMSButton>
                        <SMSButton
                            onClick={handleAdd}
                            disabled={disabled || isLoading || !selectedId}
                            type="button"
                        >
                            {editingItem ? 'Update' : 'Add'}
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
