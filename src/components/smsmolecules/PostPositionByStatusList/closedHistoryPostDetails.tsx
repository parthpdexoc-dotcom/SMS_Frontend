import React, { useMemo } from 'react';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { SMSBox, SMSCard, SMSGrid, SMSIcon, SMSIconButton, SMSStack, SMSTypography } from '@/components/smsatoms';
import { SMSDataDisplay } from '@/components/smsmolecules/SMSDataDisplay';
import { POST_POSITION } from '@/constants/strings';
import { formatDateShort, formatDuration, formatTimeToHHmm } from '@/utils';
import { minutesToTimeString } from '@/utils/dateTimeUtils';
import { ClosedPostPositionStatus } from '@/types/closedPostPositionEquipment';
import { VehicleOwnedByType } from '@/types/invoice';
import type {
    ClosedHistoryPostTableRow,
    ClosedHistoryPostsDataGridProps,
    ClosedHistoryStatusDisplay,
    ClosedHistoryVehiclesEquipmentBodyProps,
    ClosedPostDetailsHistoryEntry,
    NormalizeClosedPostDetailsSingleFallback,
} from '@/types/closedPostHistoryDetails';

export type {
    ClosedPostDetailsHistoryEntry,
    ClosedHistoryPostTableRow,
    ClosedHistoryVehiclesEquipmentOpenPayload,
    NormalizeClosedPostDetailsSingleFallback,
} from '@/types/closedPostHistoryDetails';

const CLOSED_HIST_COL = POST_POSITION.BY_STATUS_LIST.CLOSED_HISTORY_TABLE;
const CF = POST_POSITION.CLOSE_FORM;

export const closedHistoryIsVehicleItem = (eq: Record<string, unknown>): boolean => {
    const flag = eq?.departmentEquipmentIsVehicle;
    if (flag === true) return true;
    if (flag === false) return false;
    const veh = eq?.vehNumber ?? eq?.VehNumber ?? eq?.vehicleNumber ?? eq?.VehicleNumber;
    const ownedBy = eq?.vehicleOwnedBy ?? eq?.VehicleOwnedBy;
    const start = eq?.startMileage ?? eq?.StartMileage;
    const end = eq?.endMileage ?? eq?.EndMileage;
    const total = eq?.totalMileage ?? eq?.TotalMileage;
    return !!veh || ownedBy != null || start != null || end != null || total != null;
};

const closedHistoryGetStatusKind = (closedPost: Record<string, unknown>): ClosedHistoryStatusDisplay => {
    // Prefer `status` then `Status` (PascalCase serializers). Use `in` so explicit `null` is not
    // merged with `??` (e.g. `status: null` must not pick up a sibling `Status` value).
    let v: unknown;
    if ('status' in closedPost) {
        v = closedPost.status;
    } else if ('Status' in closedPost) {
        v = closedPost.Status;
    } else {
        return { label: CLOSED_HIST_COL.STATUS_CLOSED, kind: 'closed' };
    }
    if (v == null) {
        return { label: '-', kind: 'none' };
    }
    const num = typeof v === 'number' ? v : Number(String(v));
    if (Number.isNaN(num)) {
        return { label: '-', kind: 'none' };
    }
    if (num === ClosedPostPositionStatus.Unclosed) {
        return { label: CLOSED_HIST_COL.STATUS_UNCLOSED, kind: 'unclosed' };
    }
    return { label: CLOSED_HIST_COL.STATUS_CLOSED, kind: 'closed' };
};

export const ClosedHistoryPostsDataGrid: React.FC<ClosedHistoryPostsDataGridProps> = ({
    entries,
    selectedPost,
    onOpenVehiclesEquipment,
}) => {
    const toStr = (v: unknown): string => (v === null || v === undefined || v === '' ? '-' : String(v));
    const toFormattedDate = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '-';
        const formatted = formatDateShort(String(v).trim());
        return formatted || toStr(v);
    };
    const toFormattedTime = (v: unknown): string => {
        const s = toStr(v);
        return s === '-' ? s : (formatTimeToHHmm(s) || s);
    };
    const toFormattedDuration = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '-';
        const n = typeof v === 'number' ? v : Number(String(v));
        if (Number.isNaN(n)) return toStr(v);
        return formatDuration(n);
    };

    const tableRows = useMemo((): ClosedHistoryPostTableRow[] => {
        return entries.map((entry, entryIdx) => {
            const closedRaw = entry.closedPostPosition ?? entry.ClosedPostPosition ?? null;
            const cp = (closedRaw ?? {}) as Record<string, unknown>;
            const raw = entry.equipments;
            const rawEquipList: Record<string, unknown>[] = Array.isArray(raw)
                ? raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
                : [];
            const equipmentItems = rawEquipList.filter((x) => !closedHistoryIsVehicleItem(x));
            const vehicleItems = rawEquipList.filter((x) => closedHistoryIsVehicleItem(x));
            const status = closedHistoryGetStatusKind(cp);
            const entryTitleBase = `${CLOSED_HIST_COL.ENTRY_TITLE_PREFIX}${
                selectedPost?.postTitle ? `: ${selectedPost.postTitle}` : ''
            }${entries.length > 1 ? ` #${entryIdx + 1}` : ''}`;
            return {
                rowKey: `closed-entry-${entryIdx}`,
                dateOfWork: toFormattedDate(cp?.dateOfWork ?? cp?.DateOfWork ?? selectedPost?.startDate),
                startTime: toFormattedTime(cp?.startTime ?? cp?.StartTime ?? selectedPost?.startTime),
                hoursWorked: toFormattedDuration(cp?.hoursWorked ?? cp?.HoursWorked),
                workedOnDuty:
                    (cp?.workedOnDuty ?? cp?.WorkedOnDuty) === true
                        ? POST_POSITION.BY_STATUS_LIST.YES
                        : (cp?.workedOnDuty ?? cp?.WorkedOnDuty) === false
                          ? POST_POSITION.BY_STATUS_LIST.NO
                          : '-',
                workStartDate: toFormattedDate(cp?.workStartDate ?? cp?.WorkStartDate),
                workStartTime: toFormattedTime(cp?.workStartTime ?? cp?.WorkStartTime),
                workEndTime: toFormattedTime(cp?.workEndTime ?? cp?.WorkEndTime),
                createdBy: toStr(cp?.createdBy ?? cp?.CreatedBy ?? cp?.closeBy ?? cp?.CloseBy),
                editedBy: toStr(cp?.editedBy ?? cp?.EditedBy),
                closedPostStatus: status.label,
                statusKind: status.kind,
                action: '',
                _entryLabel: entryTitleBase,
                _vehicleItems: vehicleItems,
                _equipmentItems: equipmentItems,
            };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- formatters stable for display
    }, [entries, selectedPost]);

    const columns = useMemo<DataTableColumn<ClosedHistoryPostTableRow>[]>(
        () => [
            { key: 'dateOfWork', label: CLOSED_HIST_COL.DATE_OF_WORK },
            { key: 'startTime', label: CLOSED_HIST_COL.START_TIME },
            { key: 'hoursWorked', label: CLOSED_HIST_COL.HOURS_WORKED },
            { key: 'workedOnDuty', label: CLOSED_HIST_COL.WORKED_ON_DUTY },
            { key: 'workStartDate', label: CLOSED_HIST_COL.WORK_START_DATE },
            { key: 'workStartTime', label: CLOSED_HIST_COL.WORK_START_TIME },
            { key: 'workEndTime', label: CLOSED_HIST_COL.WORK_END_TIME },
            { key: 'createdBy', label: CLOSED_HIST_COL.CREATED_BY },
            { key: 'editedBy', label: CLOSED_HIST_COL.EDITED_BY },
            {
                /* Not `status`: shared DataTable treats key "status" as a 4.5rem narrow column and clips pills */
                key: 'closedPostStatus',
                label: CLOSED_HIST_COL.STATUS,
                render: (_v, row) =>
                    row.statusKind === 'none' ? (
                        <span>{row.closedPostStatus}</span>
                    ) : (
                        <span
                            className={`closed-history-posts-grid__status-badge closed-history-posts-grid__status-badge--${row.statusKind}`}
                            title={row.closedPostStatus}
                        >
                            {row.closedPostStatus}
                        </span>
                    ),
            },
            {
                key: 'action',
                label: CLOSED_HIST_COL.ACTION,
                render: (_v, row) => (
                    <div className="closed-history-posts-grid__actions data-table__cell--no-clamp">
                        <SMSIconButton
                            size="small"
                            tone="primary"
                            allowWhenSuspended
                            title={CLOSED_HIST_COL.VIEW_VEHICLES}
                            aria-label={CLOSED_HIST_COL.VIEW_VEHICLES}
                            onClick={() =>
                                onOpenVehiclesEquipment({
                                    entryLabel: row._entryLabel,
                                    vehicleItems: row._vehicleItems,
                                    equipmentItems: row._equipmentItems,
                                })
                            }
                        >
                            <SMSIcon name="directions_car" size="sm" />
                        </SMSIconButton>
                    </div>
                ),
            },
        ],
        [onOpenVehiclesEquipment]
    );

    if (entries.length === 0) {
        return (
            <SMSCard sx={{ p: 2 }}>
                <SMSTypography variant="body2" color="text.secondary">
                    {CLOSED_HIST_COL.NO_DATA}
                </SMSTypography>
            </SMSCard>
        );
    }

    return (
        <div className="closed-history-posts-grid">
            <SMSDataTableWrapper<ClosedHistoryPostTableRow>
                title={CLOSED_HIST_COL.TITLE}
                columns={columns}
                data={tableRows}
                emptyMessage={CLOSED_HIST_COL.NO_DATA}
                searchable={false}
                showHeaderWhenEmpty
                renderEmptyAsTable
                responsiveMode="table"
                tableClassName="closed-history-posts-grid__table"
                maxBodyHeight="max(280px, min(420px, 50vh))"
            />
        </div>
    );
};

export const ClosedHistoryVehiclesEquipmentBody: React.FC<ClosedHistoryVehiclesEquipmentBodyProps> = ({
    entryLabel,
    vehicleItems,
    equipmentItems,
}) => {
    const toStr = (v: unknown): string => (v === null || v === undefined || v === '' ? '-' : String(v));
    const formatVehicleOwnedBy = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '-';
        const n = typeof v === 'number' ? v : Number(String(v));
        if (!Number.isNaN(n)) {
            if (n === VehicleOwnedByType.City) return CLOSED_HIST_COL.VEHICLE_OWNED_BY_CITY;
            if (n === VehicleOwnedByType.Employee) return CLOSED_HIST_COL.VEHICLE_OWNED_BY_EMPLOYEE;
            if (n === VehicleOwnedByType.Other) return CLOSED_HIST_COL.VEHICLE_OWNED_BY_OTHER;
        }
        const s = String(v).toLowerCase();
        if (s.includes('city')) return CLOSED_HIST_COL.VEHICLE_OWNED_BY_CITY;
        if (s.includes('employee')) return CLOSED_HIST_COL.VEHICLE_OWNED_BY_EMPLOYEE;
        return toStr(v);
    };
    const toFormattedDuration = (v: unknown): string => {
        if (v === null || v === undefined || v === '') return '-';
        const n = typeof v === 'number' ? v : Number(String(v));
        if (Number.isNaN(n)) return toStr(v);
        return formatDuration(n);
    };
    const StatusYesNo = (v: boolean): string =>
        v ? POST_POSITION.BY_STATUS_LIST.YES : POST_POSITION.BY_STATUS_LIST.NO;
    const formatOptionalBool = (v: boolean | null): string => (v === null ? '-' : StatusYesNo(v));
    const getEquipmentIsWorked = (eq: Record<string, unknown>): boolean | null => {
        const v = eq?.isWorked ?? eq?.IsWorked;
        if (v === undefined || v === null) return null;
        return Boolean(v);
    };
    const getEquipmentIsUnpaidBreak = (eq: Record<string, unknown>): boolean | null => {
        const v = eq?.isUnPaidBreakTime ?? eq?.IsUnPaidBreakTime;
        if (v === undefined || v === null) return null;
        return Boolean(v);
    };
    const formatEquipmentBreakTime = (eq: Record<string, unknown>): string => {
        const raw = eq?.breakTime ?? eq?.BreakTime;
        if (raw === null || raw === undefined || raw === '') return '-';
        if (typeof raw === 'number' && !Number.isNaN(raw)) return minutesToTimeString(raw);
        const s = String(raw);
        return formatTimeToHHmm(s) || s;
    };

    return (
        <SMSStack spacing={2}>
            <SMSTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {entryLabel}
            </SMSTypography>
            <SMSBox
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                    alignItems: 'stretch',
                }}
            >
                <SMSBox sx={{ display: 'flex', minWidth: 0 }}>
                    <SMSCard variant="outlined" sx={{ p: 1.5, width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <SMSStack spacing={1.5} sx={{ flex: 1 }}>
                            <SMSTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {CLOSED_HIST_COL.VEHICLE_SECTION_TITLE}
                            </SMSTypography>
                            {vehicleItems.length === 0 ? (
                                <SMSTypography variant="body2" color="text.secondary">
                                    {CLOSED_HIST_COL.NO_VEHICLE_RECORDED}
                                </SMSTypography>
                            ) : (
                                <SMSStack spacing={1.5}>
                                    {vehicleItems.map((eq, idx: number) => (
                                        <SMSCard variant="outlined" sx={{ p: 1.5 }} key={`veh-modal-${idx}`}>
                                            <SMSStack spacing={1}>
                                                <SMSTypography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                    {toStr(eq?.departmentEquipmentName ?? CLOSED_HIST_COL.DEFAULT_VEHICLE_NAME)}
                                                </SMSTypography>
                                                <SMSGrid container spacing={1}>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.VEHICLE_NUMBER}
                                                            value={toStr(eq?.vehNumber ?? eq?.VehNumber)}
                                                            icon="directions_car"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.OWNED_BY}
                                                            value={formatVehicleOwnedBy(eq?.vehicleOwnedBy ?? eq?.VehicleOwnedBy)}
                                                            icon="badge"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.START_MILEAGE}
                                                            value={toStr(eq?.startMileage ?? eq?.StartMileage)}
                                                            icon="speed"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.END_MILEAGE}
                                                            value={toStr(eq?.endMileage ?? eq?.EndMileage)}
                                                            icon="speed"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.TOTAL_MILEAGE}
                                                            value={toStr(eq?.totalMileage ?? eq?.TotalMileage)}
                                                            icon="speed"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                </SMSGrid>
                                            </SMSStack>
                                        </SMSCard>
                                    ))}
                                </SMSStack>
                            )}
                        </SMSStack>
                    </SMSCard>
                </SMSBox>
                <SMSBox sx={{ display: 'flex', minWidth: 0 }}>
                    <SMSCard variant="outlined" sx={{ p: 1.5, width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <SMSStack spacing={1.5} sx={{ flex: 1 }}>
                            <SMSTypography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {CLOSED_HIST_COL.EQUIPMENT_SECTION_TITLE}
                            </SMSTypography>
                            {equipmentItems.length === 0 ? (
                                <SMSTypography variant="body2" color="text.secondary">
                                    {CLOSED_HIST_COL.NO_EQUIPMENT_RECORDED}
                                </SMSTypography>
                            ) : (
                                <SMSStack spacing={1.5}>
                                    {equipmentItems.map((eq, idx: number) => (
                                        <SMSCard variant="outlined" sx={{ p: 1.5 }} key={`eq-modal-${idx}`}>
                                            <SMSStack spacing={1}>
                                                <SMSTypography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                    {toStr(eq?.departmentEquipmentName ?? '-')}
                                                </SMSTypography>
                                                <SMSGrid container spacing={1.5}>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CF.IS_WORKED}
                                                            value={formatOptionalBool(getEquipmentIsWorked(eq))}
                                                            icon="task_alt"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CF.IS_UNPAID_BREAK_TIME}
                                                            value={formatOptionalBool(getEquipmentIsUnpaidBreak(eq))}
                                                            icon="free_breakfast"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CF.BREAK_TIME}
                                                            value={formatEquipmentBreakTime(eq)}
                                                            icon="schedule"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12} sm={6}>
                                                        <SMSDataDisplay
                                                            label={CLOSED_HIST_COL.EQUIPMENT_HOURS_WORKED}
                                                            value={toFormattedDuration(
                                                                eq?.equipmentUsedHours ??
                                                                    eq?.EquipmentUsedHours
                                                            )}
                                                            icon="schedule"
                                                            variant="inline"
                                                        />
                                                    </SMSGrid>
                                                    <SMSGrid item xs={12}>
                                                        <SMSStack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                                            <SMSBox sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', pt: '2px' }}>
                                                                <SMSIcon name="notes" size="sm" />
                                                            </SMSBox>
                                                            <SMSStack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                                                                <SMSTypography variant="body2" color="text.secondary" component="div">
                                                                    {CF.NO_WORK_REASON}
                                                                </SMSTypography>
                                                                <SMSTypography
                                                                    variant="body1"
                                                                    component="div"
                                                                    sx={{
                                                                        whiteSpace: 'normal',
                                                                        wordBreak: 'break-word',
                                                                        overflowWrap: 'anywhere',
                                                                    }}
                                                                >
                                                                    {toStr(eq?.noWorkReason ?? eq?.NoWorkReason)}
                                                                </SMSTypography>
                                                            </SMSStack>
                                                        </SMSStack>
                                                    </SMSGrid>
                                                </SMSGrid>
                                            </SMSStack>
                                        </SMSCard>
                                    ))}
                                </SMSStack>
                            )}
                        </SMSStack>
                    </SMSCard>
                </SMSBox>
            </SMSBox>
        </SMSStack>
    );
};

/** Normalize API list / single detail into grid entries. */
export function normalizeClosedPostDetailsList(
    list: ClosedPostDetailsHistoryEntry[],
    singleFallback: NormalizeClosedPostDetailsSingleFallback | null
): ClosedPostDetailsHistoryEntry[] {
    if (list.length > 0) {
        return list.map((entry) => {
            const eq = entry.equipments;
            const equipments: Record<string, unknown>[] | null = Array.isArray(eq)
                ? eq.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
                : null;
            const cp = entry.closedPostPosition ?? entry.ClosedPostPosition ?? null;
            return {
                closedPostPosition: cp,
                ClosedPostPosition: entry.ClosedPostPosition,
                equipments,
                questionnaireSubmissions: entry.questionnaireSubmissions,
            };
        });
    }
    if (singleFallback?.closedPostPosition || (singleFallback?.equipments && Array.isArray(singleFallback.equipments))) {
        const eq = singleFallback.equipments;
        const equipments: Record<string, unknown>[] | null = Array.isArray(eq)
            ? eq.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
            : null;
        return [
            {
                closedPostPosition: singleFallback.closedPostPosition,
                equipments,
                questionnaireSubmissions: singleFallback.questionnaireSubmissions,
            },
        ];
    }
    return [];
}
