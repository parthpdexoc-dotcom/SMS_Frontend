import { SMSButton, SMSDatePicker, SMSBox, SMSLoader, type SMSDropdownOption } from '@/components/smsatoms';
import { SMSPrintAction } from '@/components/smsmolecules';
import { SMSModal } from '@/components/smsorganisms/SMSModal';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Box,
  Alert,
  Typography,
  Divider,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchRosterInformation,
  fetchRosterInformationByRequest,
  fetchRosterDates,
  exportRosterExcelThunk,
  clearRoster,
  clearWaitingList,
  fetchWaitingListEmployees,
} from '@/store/slices/rosterSlice';
import { showToast } from '@/store/slices/toastSlice';
import {
  updatePostPositionCallSign,
  POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME,
} from '@/services/postPositionService';
import { fetchAvailablePostCallSignsThunk } from '@/store/slices/postCallSignSlice';
import { POST_POSITION, ROSTER_VIEW_MODAL } from '@/constants/strings';
import type { PostCallSign } from '@/types/postCallSign';
import { availablePostCallSignCacheKey } from '@/types/postCallSign';
import { SMSRosterSection } from './SMSRosterSection';
import { SMSWaitingPostPositionModal } from './SMSWaitingPostPositionModal';
import { hasRosterContent, findRosterRowByPostPositionId, flattenRosterRows } from './smsRosterUtils';
import type { SMSRosterEditableUnitConfig } from './smsRosterTypes';
import type { RosterInformation } from '@/types/roster';
import './SMSRosterModal.css';
import './SMSRosterPrint.css';

const toDateOnly = (value?: string | null): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
};

function getRosterPostPositionIdForCallSign(row: RosterInformation): string {
  return row.postPositionID?.trim() || '';
}

const readRosterPostCallSignId = (row: RosterInformation): string => {
  const raw = row as unknown as Record<string, unknown>;
  return String(raw.postCallSignID ?? raw.PostCallSignID ?? '').trim();
};

const resolveRosterPostCallSignId = (
  row: RosterInformation,
  availableCallSigns: PostCallSign[]
): string => {
  const fromRow = readRosterPostCallSignId(row);
  if (fromRow) return fromRow;
  const callSign = (row.callUnit ?? '').trim();
  if (!callSign) return '';
  const match = availableCallSigns.find((item) => (item.callSign ?? '').trim() === callSign);
  return String(match?.postCallSignID ?? '').trim();
};

export interface SMSRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId?: string;
  requestID?: string;
  /** Optional initial date for the date field (e.g. from the row that opened the modal). */
  dateOfWork?: string;
  /** Special-event preview mode: show draft watermark. */
  draftMode?: boolean;
  /** Disable print action (e.g. draft/preliminary roster). */
  disablePrint?: boolean;
  /** Hide date/search section and display provided date only. */
  hideSearchSection?: boolean;
  /** Called when the user picks a date (YYYY-MM-DD) — e.g. sync `?dateOfWork=` in the URL. */
  onDateOfWorkChange?: (dateYmd: string) => void;
  /** When true, call sign / unit is display-only (no inline edit or clear). */
  disableCallSignUpdate?: boolean;
  /** Called after a call sign is saved or cleared — e.g. refresh post positions in Daily Administration. */
  onCallSignUpdated?: (postId: string) => void;
}

export const SMSRosterModal: React.FC<SMSRosterModalProps> = ({
  isOpen,
  onClose,
  postId,
  requestID,
  dateOfWork: initialDateOfWork,
  draftMode = false,
  disablePrint = false,
  hideSearchSection = false,
  onDateOfWorkChange,
  disableCallSignUpdate = false,
  onCallSignUpdated,
}) => {
  const dispatch = useAppDispatch();
  const {
    rosterTables,
    requesterName: rosterRequesterName,
    rosterDate,
    rosterDates,
    rosterDatesRequestId,
    isLoading,
    isExporting,
    error,
    dateOfWork: rosterDateOfWork,
    waitingListData,
    isWaitingListLoading,
    waitingListError,
  } = useAppSelector((state) => state.roster);

  const [selectedDate, setSelectedDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [waitingModalOpen, setWaitingModalOpen] = useState(false);
  const [editingUnitPostPositionId, setEditingUnitPostPositionId] = useState<string | null>(null);
  const [editingUnitValue, setEditingUnitValue] = useState('');
  const editingUnitValueRef = useRef('');
  const hasUserEditedCallSignRef = useRef(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const isByRequest = Boolean(requestID?.trim());
  const isByPost = Boolean(postId?.trim() && !requestID?.trim());
  const reqId = requestID?.trim() ?? '';
  /** Only dates loaded for this request — ignore stale dates from another request under the same requester. */
  const enabledDates = useMemo(() => {
    if (!isByRequest || rosterDatesRequestId !== reqId) return [];
    return rosterDates.map((d) => toDateOnly(d)).filter(Boolean);
  }, [isByRequest, rosterDatesRequestId, reqId, rosterDates]);
  const pickerDates = enabledDates.length ? enabledDates : selectedDate ? [selectedDate] : [];
  const showLoader = isLoading || isPreparing;

  const resetUnitEditing = useCallback(() => {
    editingUnitValueRef.current = '';
    hasUserEditedCallSignRef.current = false;
    setEditingUnitPostPositionId(null);
    setEditingUnitValue('');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearRoster());
      dispatch(clearWaitingList());
      setSelectedDate('');
      setHasSearched(false);
      setIsPreparing(false);
      setWaitingModalOpen(false);
      resetUnitEditing();
      setIsSavingUnit(false);
    }
  }, [isOpen, dispatch, resetUnitEditing]);

  /** Show loader + request start date immediately on open (before network). */
  useLayoutEffect(() => {
    if (!isOpen || !isByRequest) return;
    setSelectedDate(toDateOnly(initialDateOfWork) || '');
    setHasSearched(true);
    setIsPreparing(true);
    resetUnitEditing();
    // Only re-run when opening / switching request — not when URL date syncs after dates load
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isOpen, isByRequest, reqId, resetUnitEditing]);

  /** Request roster: dates for this request first, then roster data. */
  useEffect(() => {
    if (!isOpen || !isByRequest || !reqId) return;
    let cancelled = false;
    void (async () => {
      try {
        const dates = ((await dispatch(fetchRosterDates(reqId)).unwrap()) ?? [])
          .map((d) => toDateOnly(d))
          .filter(Boolean);
        if (cancelled) return;
        if (!dates.length) {
          setSelectedDate('');
          setHasSearched(false);
          setIsPreparing(false);
          return;
        }
        const preferred = toDateOnly(initialDateOfWork);
        const next = preferred && dates.includes(preferred) ? preferred : dates[0];
        setSelectedDate(next);
        if (next !== preferred) onDateOfWorkChange?.(next);
        await dispatch(fetchRosterInformationByRequest({ requestID: reqId, dateOfWork: next }));
      } catch {
        if (!cancelled) setHasSearched(false);
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // initialDateOfWork captured on open/request change only
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [isOpen, isByRequest, reqId, dispatch]);

  /** Post roster: align picker + fetch. */
  useLayoutEffect(() => {
    if (!isOpen || isByRequest) return;
    setSelectedDate(toDateOnly(initialDateOfWork) || '');
  }, [isOpen, isByRequest, initialDateOfWork]);

  useEffect(() => {
    if (!isOpen || !isByPost) return;
    const pId = postId?.trim();
    const d = (toDateOnly(selectedDate) || toDateOnly(initialDateOfWork))?.trim();
    if (!pId || !d) {
      setHasSearched(false);
      return;
    }
    resetUnitEditing();
    setHasSearched(true);
    dispatch(fetchRosterInformation({ postId: pId, dateOfWork: d }));
  }, [isOpen, isByPost, postId, selectedDate, initialDateOfWork, dispatch, resetUnitEditing]);

  const refreshRoster = useCallback(async () => {
    const d = toDateOnly(rosterDateOfWork) || toDateOnly(selectedDate);
    if (!d) return;
    const requestId = requestID?.trim();
    const pId = postId?.trim();
    try {
      if (requestId) {
        await dispatch(fetchRosterInformationByRequest({ requestID: requestId, dateOfWork: d })).unwrap();
      } else if (pId) {
        await dispatch(fetchRosterInformation({ postId: pId, dateOfWork: d })).unwrap();
      }
    } catch {
      /* Error surfaced via roster slice / toast */
    }
  }, [dispatch, rosterDateOfWork, selectedDate, requestID, postId]);

  const handleSelectedDateChange = useCallback(
    (value: string) => {
      const d = toDateOnly(value) || '';
      if (isByRequest && enabledDates.length && d && !enabledDates.includes(d)) return;
      setSelectedDate(value);
      onDateOfWorkChange?.(d);
      if (isByRequest && reqId && d) {
        setHasSearched(true);
        resetUnitEditing();
        void dispatch(fetchRosterInformationByRequest({ requestID: reqId, dateOfWork: d }));
      }
    },
    [onDateOfWorkChange, isByRequest, reqId, enabledDates, dispatch, resetUnitEditing]
  );

  const handleUnitEditPress = useCallback(
    (row: RosterInformation) => {
      const pid = getRosterPostPositionIdForCallSign(row);
      if (!pid) return;
      const initialId = resolveRosterPostCallSignId(row, []);
      hasUserEditedCallSignRef.current = false;
      editingUnitValueRef.current = initialId;
      setEditingUnitPostPositionId(pid);
      setEditingUnitValue(initialId);
      const postIdForFetch = row.postID?.trim() || postId?.trim() || '';
      const workDate = toDateOnly(rosterDateOfWork) || toDateOnly(selectedDate) || toDateOnly(initialDateOfWork);
      if (postIdForFetch && workDate) {
        void dispatch(
          fetchAvailablePostCallSignsThunk({ postId: postIdForFetch, dateOfWork: workDate })
        );
      }
    },
    [dispatch, initialDateOfWork, postId, rosterDateOfWork, selectedDate]
  );

  const editingUnitRow = useMemo(
    () =>
      editingUnitPostPositionId
        ? findRosterRowByPostPositionId(rosterTables, editingUnitPostPositionId)
        : null,
    [editingUnitPostPositionId, rosterTables]
  );

  const editingUnitDateOfWork =
    toDateOnly(rosterDateOfWork) || toDateOnly(selectedDate) || toDateOnly(initialDateOfWork);
  const editingUnitPostId = editingUnitRow?.postID?.trim() || postId?.trim() || '';
  const availableCallSignsCacheKey =
    editingUnitPostPositionId && editingUnitPostId && editingUnitDateOfWork
      ? availablePostCallSignCacheKey(editingUnitPostId, editingUnitDateOfWork)
      : '';
  const availableCallSigns = useAppSelector((state) =>
    availableCallSignsCacheKey
      ? state.postCallSign.availableByKey[availableCallSignsCacheKey] ?? []
      : []
  );
  const isLoadingCallSignOptions = useAppSelector((state) =>
    availableCallSignsCacheKey
      ? state.postCallSign.availableLoadingByKey[availableCallSignsCacheKey] ?? false
      : false
  );

  const callSignDropdownOptions = useMemo((): SMSDropdownOption[] => {
    const seen = new Set<string>();
    const options: SMSDropdownOption[] = [
      { value: '', label: POST_POSITION.CALL_SIGN.EMPTY_OPTION },
    ];
    for (const item of availableCallSigns) {
      const postCallSignId = String(item.postCallSignID ?? '').trim();
      const callSign = (item.callSign ?? '').trim();
      if (!postCallSignId || !callSign || seen.has(postCallSignId)) continue;
      seen.add(postCallSignId);
      options.push({ value: postCallSignId, label: callSign });
    }
    const currentId = editingUnitValue.trim();
    if (currentId && !seen.has(currentId)) {
      const label =
        availableCallSigns.find(
          (item) => String(item.postCallSignID ?? '').trim() === currentId
        )?.callSign?.trim() ||
        editingUnitRow?.callUnit?.trim() ||
        currentId;
      options.push({ value: currentId, label });
    }
    return options;
  }, [availableCallSigns, editingUnitRow, editingUnitValue]);

  useEffect(() => {
    if (!editingUnitPostPositionId || !editingUnitRow || hasUserEditedCallSignRef.current) return;
    const resolvedId = resolveRosterPostCallSignId(editingUnitRow, availableCallSigns);
    if (!resolvedId || editingUnitValueRef.current === resolvedId) return;
    if (editingUnitValueRef.current === editingUnitValue) {
      editingUnitValueRef.current = resolvedId;
      setEditingUnitValue(resolvedId);
    }
  }, [availableCallSigns, editingUnitPostPositionId, editingUnitRow, editingUnitValue]);

  const commitUnitEdit = useCallback(async () => {
    const pid = editingUnitPostPositionId?.trim();
    if (!pid || isSavingUnit) return;
    const row = findRosterRowByPostPositionId(rosterTables, pid);
    if (!row) return;
    const trimmedId = editingUnitValueRef.current.trim();
    const prevId = resolveRosterPostCallSignId(row, availableCallSigns);
    const hadCallSign = Boolean((row.callUnit ?? '').trim()) || Boolean(prevId);
    const clearingCallSign = trimmedId === '' && hadCallSign;
    if (trimmedId === prevId && !clearingCallSign) {
      resetUnitEditing();
      return;
    }
    const postIdForRefresh = row.postID?.trim();
    setIsSavingUnit(true);
    try {
      await updatePostPositionCallSign(
        pid,
        trimmedId || '',
        POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME
      );
      dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
      resetUnitEditing();
      await refreshRoster();
      if (postIdForRefresh) onCallSignUpdated?.(postIdForRefresh);
    } catch (e) {
      console.error(e);
      dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATE_FAILED, 'error'));
    } finally {
      setIsSavingUnit(false);
    }
  }, [
    availableCallSigns,
    dispatch,
    editingUnitPostPositionId,
    isSavingUnit,
    refreshRoster,
    rosterTables,
    resetUnitEditing,
    onCallSignUpdated,
  ]);

  const handleUnitEditingChange = useCallback(
    (value: string) => {
      editingUnitValueRef.current = value;
      hasUserEditedCallSignRef.current = true;
      setEditingUnitValue(value);
      if (value === '' && editingUnitPostPositionId && !isSavingUnit) {
        void commitUnitEdit();
      }
    },
    [commitUnitEdit, editingUnitPostPositionId, isSavingUnit]
  );

  const handleUnitEditingClose = useCallback(() => {
    if (isSavingUnit || !editingUnitPostPositionId) return;
    void commitUnitEdit();
  }, [commitUnitEdit, editingUnitPostPositionId, isSavingUnit]);

  const handleUnitEditingKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resetUnitEditing();
      }
    },
    [resetUnitEditing]
  );

  const handleUnitDeletePress = useCallback(
    async (row: RosterInformation) => {
      const pid = getRosterPostPositionIdForCallSign(row);
      if (!pid || isSavingUnit) return;
      setIsSavingUnit(true);
      const postIdForRefresh = row.postID?.trim();
      try {
        await updatePostPositionCallSign(pid, '', POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME);
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
        resetUnitEditing();
        await refreshRoster();
        if (postIdForRefresh) onCallSignUpdated?.(postIdForRefresh);
      } catch (e) {
        console.error(e);
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATE_FAILED, 'error'));
      } finally {
        setIsSavingUnit(false);
      }
    },
    [dispatch, isSavingUnit, refreshRoster, resetUnitEditing, onCallSignUpdated]
  );

  const editableUnitConfig: SMSRosterEditableUnitConfig | undefined = useMemo(() => {
    if (draftMode || disableCallSignUpdate || !hasRosterContent(rosterTables)) return undefined;
    return {
      editingPostPositionId: editingUnitPostPositionId,
      editingValue: editingUnitValue,
      isSaving: isSavingUnit,
      callSignOptions: callSignDropdownOptions,
      isLoadingCallSignOptions,
      onEditPress: handleUnitEditPress,
      onDeletePress: handleUnitDeletePress,
      onEditingChange: handleUnitEditingChange,
      onEditingClose: handleUnitEditingClose,
      onEditingKeyDown: handleUnitEditingKeyDown,
    };
  }, [
    callSignDropdownOptions,
    draftMode,
    disableCallSignUpdate,
    rosterTables,
    editingUnitPostPositionId,
    editingUnitValue,
    isLoadingCallSignOptions,
    isSavingUnit,
    handleUnitEditPress,
    handleUnitDeletePress,
    handleUnitEditingChange,
    handleUnitEditingClose,
    handleUnitEditingKeyDown,
  ]);

  const hasContent = hasRosterContent(rosterTables);

  const formattedDate = rosterDate || rosterDateOfWork || selectedDate || '';
  const requesterName = rosterRequesterName;

  const exportPostId = useMemo(() => {
    if (isByRequest) return '';
    const fromProp = postId?.trim();
    if (fromProp) return fromProp;
    const fromRow = flattenRosterRows(rosterTables).find((r) => r.postID?.trim())?.postID?.trim();
    return fromRow ?? '';
  }, [isByRequest, postId, rosterTables]);

  const exportRequestId = useMemo(() => (isByRequest ? requestID?.trim() ?? '' : ''), [isByRequest, requestID]);

  const exportDateOfWork = useMemo(
    () => toDateOnly(rosterDateOfWork) || toDateOnly(selectedDate) || toDateOnly(initialDateOfWork) || '',
    [rosterDateOfWork, selectedDate, initialDateOfWork]
  );

  const canExportRoster = Boolean(
    exportDateOfWork &&
      (isByRequest ? exportRequestId : exportPostId) &&
      hasSearched &&
      !showLoader &&
      hasContent
  );

  const handleExportRoster = useCallback(() => {
    if (!exportDateOfWork || isExporting) return;
    if (isByRequest && !exportRequestId) return;
    if (!isByRequest && !exportPostId) return;

    const fallbackName = requesterName?.trim() ? `${requesterName.trim()}.xlsx` : undefined;
    void dispatch(
      exportRosterExcelThunk({
        requestID: isByRequest ? exportRequestId : undefined,
        postId: isByRequest ? undefined : exportPostId,
        dateOfWork: exportDateOfWork,
        defaultFileName: fallbackName,
      })
    );
  }, [dispatch, isByRequest, exportRequestId, exportPostId, exportDateOfWork, requesterName, isExporting]);

  const handleCancellationPendingClick = (row: RosterInformation) => {
    const rowPostId = row.postID?.trim();
    const dateForWaitingList = toDateOnly(rosterDateOfWork) || toDateOnly(selectedDate);
    if (!rowPostId || !dateForWaitingList) return;
    setWaitingModalOpen(true);
    dispatch(fetchWaitingListEmployees({ postId: rowPostId, dateOfWork: dateForWaitingList }));
  };

  return (
    <SMSModal
      open={isOpen}
      onClose={onClose}
      title="Roster View"
      size="large"
      fullWidth
      className="rosterModal__paper"
      contentClassName="rosterContent roster-print-document"
      headerActions={
        disablePrint ? undefined : (
          <>
            <SMSButton
              variant="outlined"
              onClick={() => {
                void handleExportRoster();
              }}
              disabled={!canExportRoster || isExporting}
              loading={isExporting}
            >
              {ROSTER_VIEW_MODAL.EXPORT}
            </SMSButton>
            <SMSPrintAction
              targetSelector=".rosterContent"
              documentTitle="Roster View"
              label="Print Roster"
              excludeSelectors={['.roster-waiting-icon', '.sms-roster-unit-actions']}
            />
          </>
        )
      }
    >
      {draftMode && <div className="rosterDraftWatermark">Draft</div>}

      {isByRequest && !hideSearchSection && (
        <Box className="rosterModal__searchSection">
          <Box className="rosterModal__searchRow">
            <SMSDatePicker
              className="rosterModal__date-inline"
              label="Date"
              value={selectedDate}
              onChange={handleSelectedDateChange}
              valueFormat="YYYY-MM-DD"
              onlyDates={pickerDates}
            />
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ marginBottom: 2 }}>
          {error}
        </Alert>
      )}

      {showLoader && (
        <SMSBox sx={{ display: 'flex', justifyContent: 'center', padding: '4rem 2rem', minHeight: '120px' }}>
          <SMSLoader loadingText="Loading roster information..." aria-label="Loading roster information..." />
        </SMSBox>
      )}

      {isByRequest && !showLoader && !error && !hasSearched && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          Select a date to view roster information.
        </Typography>
      )}

      {!showLoader && !error && hasSearched && !hasContent && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', minHeight: '200px' }}>
          <Typography variant="h6" sx={{ marginBottom: 1 }}>
            No Roster Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No roster information available for this date.
          </Typography>
        </Box>
      )}

      {!showLoader && !error && hasContent && (
        <>
          <Box className="rosterHeaderRow">
            <Typography className="rosterHeaderLeft">{requesterName || ''}</Typography>
            <Box className="rosterHeaderSpacer" />
            <Box className="rosterHeaderRight">
              <Typography className="rosterHeaderDate">{formattedDate}</Typography>
            </Box>
          </Box>

          <Divider className="rosterDivider" />

          <Box className="sectionsWrap">
            {rosterTables.map((table, index) => (
              <SMSRosterSection
                key={`section-${index}`}
                table={table}
                onCancellationPendingClick={handleCancellationPendingClick}
                stickySectionHeaders={false}
                editableUnit={editableUnitConfig}
              />
            ))}
          </Box>
        </>
      )}
      <SMSWaitingPostPositionModal
        isOpen={waitingModalOpen}
        onClose={() => setWaitingModalOpen(false)}
        isLoading={isWaitingListLoading}
        error={waitingListError}
        dateOfWork={formattedDate}
        rows={waitingListData}
      />
    </SMSModal>
  );
};
