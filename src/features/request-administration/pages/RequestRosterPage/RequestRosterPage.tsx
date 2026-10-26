import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Divider, Stack, Typography } from '@mui/material';
import { SMSBox, SMSButton, SMSDatePicker, SMSDropdown, SMSLoader, type SMSDropdownOption } from '@/components/smsatoms';
import { SMSLoadingState, SMSPrintAction } from '@/components/smsmolecules';
import {
  SMSRosterSection,
  hasRosterContent,
  findRosterRowByPostPositionId,
  type SMSRosterEditableUnitConfig,
} from '@/components/smsorganisms';
import type { RosterInformation } from '@/types/roster';
import { MENU_ITEMS, POST_POSITION, REQUEST_ROSTER_PAGE } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearRoster,
  exportRosterExcelThunk,
  fetchRosterInformationByRequest,
} from '@/store/slices/rosterSlice';
import { showToast } from '@/store/slices/toastSlice';
import {
  updatePostPositionCallSign,
  POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME,
} from '@/services/postPositionService';
import { fetchAvailablePostCallSignsThunk } from '@/store/slices/postCallSignSlice';
import type { PostCallSign } from '@/types/postCallSign';
import { availablePostCallSignCacheKey } from '@/types/postCallSign';
import { getRequests } from '@/services/requestService';
import type { RequestResponse } from '@/types/request';
import '@/components/smsorganisms/SMSRosterPage/SMSRosterPage.css';
import '@/components/smsorganisms/SMSRoster/SMSRosterPrint.css';

function requestOptionLabel(req: RequestResponse): string {
  return (req.title ?? '').trim() || req.requestID || '-';
}

function toDateOnly(value: string): string {
  const t = value.trim();
  if (!t) return '';
  return t.includes('T') ? t.split('T')[0]! : t;
}

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

/** URL query keys for shareable Request Roster searches (match backend naming). */
const Q_REQUEST_ID = 'requestID';
const Q_DATE_OF_WORK = 'dateOfWork';

/** Request Administration → Request Roster: `GET /Request` + Search → `GET .../roster-information-by-request`. */
export const RequestRosterPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    rosterTables,
    requesterName: rosterRequesterName,
    rosterDate: rosterDateFromApi,
    isLoading: rosterLoading,
    isExporting,
    error: rosterError,
    dateOfWork: rosterDateFromStore,
  } = useAppSelector((state) => state.roster);
  /** Prevents duplicate fetch when URL updates after manual Search. */
  const lastRosterUrlKeyRef = useRef<string | null>(null);

  const [requests, setRequests] = useState<RequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [dateOfWork, setDateOfWork] = useState<string>('');
  const [rosterViewActive, setRosterViewActive] = useState(false);
  const [editingUnitPostPositionId, setEditingUnitPostPositionId] = useState<string | null>(null);
  const [editingUnitValue, setEditingUnitValue] = useState('');
  const editingUnitValueRef = useRef('');
  const hasUserEditedCallSignRef = useRef(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  useEffect(() => {
    dispatch(clearRoster());
    setRosterViewActive(false);
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getRequests({
      page: 1,
      pageSize: 5000,
      sortBy: 'Title',
      sortDirection: 'asc',
    })
      .then((list) => {
        if (!cancelled) setRequests(Array.isArray(list) ? list : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : REQUEST_ROSTER_PAGE.LOAD_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      dispatch(clearRoster());
    },
    [dispatch]
  );

  const requestOptions: SMSDropdownOption[] = useMemo(
    () =>
      requests
        .map((req) => ({
          value: req.requestID,
          label: requestOptionLabel(req),
        }))
        .filter((o) => String(o.value ?? '').trim().length > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [requests]
  );

  const hasContent = hasRosterContent(rosterTables);

  const formattedRosterDate = rosterDateFromApi || rosterDateFromStore || dateOfWork || '';

  const requesterName = rosterRequesterName ?? '';

  const handleRequestChange = useCallback((e: SelectChangeEvent<unknown>) => {
    setSelectedRequestId(String(e.target.value ?? ''));
  }, []);

  const resetUnitEditing = useCallback(() => {
    editingUnitValueRef.current = '';
    hasUserEditedCallSignRef.current = false;
    setEditingUnitPostPositionId(null);
    setEditingUnitValue('');
  }, []);

  const resetUnitSelection = useCallback(() => {
    resetUnitEditing();
  }, [resetUnitEditing]);

  /** Deep link / bookmark: `?requestID=&dateOfWork=` (YYYY-MM-DD). */
  useEffect(() => {
    if (loading || requests.length === 0) return;
    const rid = searchParams.get(Q_REQUEST_ID)?.trim() ?? '';
    const d = toDateOnly(searchParams.get(Q_DATE_OF_WORK) ?? '');
    if (!rid || !d) {
      lastRosterUrlKeyRef.current = null;
      return;
    }
    if (!requests.some((r) => r.requestID === rid)) {
      lastRosterUrlKeyRef.current = null;
      return;
    }
    const key = `${rid}|${d}`;
    if (lastRosterUrlKeyRef.current === key) return;

    let cancelled = false;
    setSelectedRequestId(rid);
    setDateOfWork(d);
    resetUnitSelection();
    setRosterViewActive(false);
    void (async () => {
      try {
        await dispatch(fetchRosterInformationByRequest({ requestID: rid, dateOfWork: d })).unwrap();
        if (!cancelled) {
          lastRosterUrlKeyRef.current = key;
          setRosterViewActive(true);
        }
      } catch {
        if (!cancelled) {
          setRosterViewActive(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, requests, searchParams, dispatch, resetUnitSelection]);

  const refreshRoster = useCallback(async () => {
    const reqId = selectedRequestId.trim();
    const d = toDateOnly(rosterDateFromStore || dateOfWork);
    if (!reqId || !d) return;
    try {
      await dispatch(fetchRosterInformationByRequest({ requestID: reqId, dateOfWork: d })).unwrap();
    } catch {
      /* Error toast from thunk */
    }
  }, [dispatch, selectedRequestId, rosterDateFromStore, dateOfWork]);

  const handleUnitEditPress = useCallback(
    (row: RosterInformation) => {
      const pid = getRosterPostPositionIdForCallSign(row);
      if (!pid) return;
      const initialId = resolveRosterPostCallSignId(row, []);
      hasUserEditedCallSignRef.current = false;
      editingUnitValueRef.current = initialId;
      setEditingUnitPostPositionId(pid);
      setEditingUnitValue(initialId);
      const postIdForFetch = row.postID?.trim() || '';
      const workDate = toDateOnly(rosterDateFromStore || dateOfWork);
      if (postIdForFetch && workDate) {
        void dispatch(
          fetchAvailablePostCallSignsThunk({ postId: postIdForFetch, dateOfWork: workDate })
        );
      }
    },
    [dateOfWork, dispatch, rosterDateFromStore]
  );

  const editingUnitRow = useMemo(
    () =>
      editingUnitPostPositionId
        ? findRosterRowByPostPositionId(rosterTables, editingUnitPostPositionId)
        : null,
    [editingUnitPostPositionId, rosterTables]
  );

  const editingUnitDateOfWork = toDateOnly(rosterDateFromStore || dateOfWork);
  const editingUnitPostId = editingUnitRow?.postID?.trim() || '';
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
    setIsSavingUnit(true);
    try {
      await updatePostPositionCallSign(
        pid,
        trimmedId || '',
        POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME
      );
      dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
      resetUnitSelection();
      await refreshRoster();
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
    resetUnitSelection,
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
      try {
        await updatePostPositionCallSign(pid, '', POST_POSITION_POST_CALL_SIGN_ID_FIELD_NAME);
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATED, 'success'));
        resetUnitSelection();
        await refreshRoster();
      } catch (e) {
        console.error(e);
        dispatch(showToast(POST_POSITION.CALL_SIGN.UPDATE_FAILED, 'error'));
      } finally {
        setIsSavingUnit(false);
      }
    },
    [dispatch, isSavingUnit, refreshRoster, resetUnitSelection]
  );

  const editableUnitConfig: SMSRosterEditableUnitConfig | undefined = useMemo(() => {
    if (!rosterViewActive || !hasContent) return undefined;
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
    rosterViewActive,
    hasContent,
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

  const handleSearch = useCallback(async () => {
    const missingRequest = !String(selectedRequestId).trim();
    const dateStr = toDateOnly(dateOfWork);
    const missingDate = !dateStr;
    if (missingRequest || missingDate) return;
    resetUnitSelection();
    setRosterViewActive(false);
    try {
      await dispatch(
        fetchRosterInformationByRequest({ requestID: selectedRequestId.trim(), dateOfWork: dateStr })
      ).unwrap();
      setRosterViewActive(true);
      const key = `${selectedRequestId.trim()}|${dateStr}`;
      lastRosterUrlKeyRef.current = key;
      const next = new URLSearchParams(searchParams);
      next.set(Q_REQUEST_ID, selectedRequestId.trim());
      next.set(Q_DATE_OF_WORK, dateStr);
      setSearchParams(next, { replace: true });
    } catch {
      setRosterViewActive(false);
    }
  }, [dispatch, selectedRequestId, dateOfWork, resetUnitSelection, searchParams, setSearchParams]);

  const exportDateOfWork = toDateOnly(rosterDateFromStore || dateOfWork);

  const canExportRoster = Boolean(
    rosterViewActive && hasContent && selectedRequestId.trim() && exportDateOfWork && !rosterLoading
  );

  const handleExportRoster = useCallback(() => {
    const requestId = selectedRequestId.trim();
    if (!requestId || !exportDateOfWork || isExporting) return;

    const fallbackName = requesterName.trim() ? `${requesterName.trim()}.xlsx` : undefined;
    void dispatch(
      exportRosterExcelThunk({
        requestID: requestId,
        dateOfWork: exportDateOfWork,
        defaultFileName: fallbackName,
      })
    );
  }, [dispatch, selectedRequestId, exportDateOfWork, requesterName, isExporting]);

  const handleClear = useCallback(() => {
    lastRosterUrlKeyRef.current = null;
    dispatch(clearRoster());
    setSelectedRequestId('');
    setDateOfWork('');
    setRosterViewActive(false);
    resetUnitSelection();
    setSearchParams({}, { replace: true });
  }, [dispatch, resetUnitSelection, setSearchParams]);

  const searchBusy = loading || rosterLoading;

  return (
    <SMSBox
      className="request-roster-page requester-list"
      component="main"
      sx={{ p: 3, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
    >
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          {MENU_ITEMS.REQUEST_ROSTER}
        </Typography>

        {loading && <SMSLoadingState message={REQUEST_ROSTER_PAGE.LOADING} />}

        {!loading && error && (
          <Typography color="error" variant="body2" role="alert">
            {REQUEST_ROSTER_PAGE.LOAD_ERROR}
            {error ? ` ${error}` : ''}
          </Typography>
        )}

        {!loading && !error && requestOptions.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {REQUEST_ROSTER_PAGE.NO_REQUESTS}
          </Typography>
        )}

        {!loading && !error && requestOptions.length > 0 && (
          <Stack spacing={0} sx={{ flex: 1, minHeight: 0 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'flex-end' }}
              flexWrap="wrap"
              useFlexGap
              sx={{ width: '100%', maxWidth: '100%' }}
            >
              <SMSBox sx={{ width: { xs: '100%', sm: 280 }, maxWidth: '100%', flexShrink: 0 }}>
                <SMSDropdown
                  label={REQUEST_ROSTER_PAGE.SELECT_REQUEST}
                  options={requestOptions}
                  value={selectedRequestId}
                  onChange={handleRequestChange}
                  clearable={false}
                  fullWidth={false}
                  disabled={searchBusy}
                  sx={{ width: '100%', minWidth: 0, maxWidth: 280 }}
                />
              </SMSBox>
              <SMSBox sx={{ width: { xs: '100%', sm: 200 }, flexShrink: 0 }}>
                <SMSDatePicker
                  id="request-roster-date-of-work"
                  label={REQUEST_ROSTER_PAGE.DATE_OF_WORK}
                  value={dateOfWork}
                  onChange={setDateOfWork}
                  disabled={searchBusy}
                />
              </SMSBox>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
                <SMSButton variant="contained" onClick={() => void handleSearch()} disabled={searchBusy} allowWhenSuspended>
                  {REQUEST_ROSTER_PAGE.SEARCH}
                </SMSButton>
                <SMSButton variant="outlined" onClick={handleClear} disabled={searchBusy} allowWhenSuspended>
                  {REQUEST_ROSTER_PAGE.CLEAR}
                </SMSButton>
              </Stack>
            </Stack>

            {rosterLoading && (
              <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <SMSLoader loadingText={REQUEST_ROSTER_PAGE.ROSTER_LOADING} aria-label={REQUEST_ROSTER_PAGE.ROSTER_LOADING} />
              </SMSBox>
            )}

            {!rosterLoading && rosterError && (
              <Alert severity="error" sx={{ mt: 2 }} role="alert">
                {rosterError}
              </Alert>
            )}

            {!rosterLoading && !rosterError && !rosterViewActive && (
              <SMSBox
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flex: 1,
                  minHeight: { xs: 240, sm: 280 },
                  py: 6,
                  px: 2,
                }}
              >
                <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 520 }}>
                  {REQUEST_ROSTER_PAGE.SELECT_TO_VIEW_ROSTER}
                </Typography>
              </SMSBox>
            )}

            {!rosterLoading && rosterViewActive && !hasContent && !rosterError && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {REQUEST_ROSTER_PAGE.EMPTY_ROSTER}
              </Typography>
            )}

            {!rosterLoading && rosterViewActive && hasContent && (
              <Box className="roster-page request-roster-print-area roster-print-document" sx={{ mt: 2 }}>
                <Box className="roster-page__header">
                  <Box className="roster-page__header-left">
                    <Typography variant="h6" component="h2" className="roster-page__requester-name">
                      {requesterName || MENU_ITEMS.REQUEST_ROSTER}
                    </Typography>
                    <Box className="roster-page__date">{formattedRosterDate}</Box>
                  </Box>
                  <Box className="roster-page__header-actions">
                    <SMSButton
                      variant="outlined"
                      onClick={() => {
                        void handleExportRoster();
                      }}
                      disabled={!canExportRoster || isExporting}
                      loading={isExporting}
                      allowWhenSuspended
                    >
                      {REQUEST_ROSTER_PAGE.EXPORT}
                    </SMSButton>
                    <SMSPrintAction
                      targetSelector=".request-roster-print-area"
                      documentTitle={MENU_ITEMS.REQUEST_ROSTER}
                      label="Print Roster"
                    />
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box className="roster-page__content">
                  {rosterTables.map((table, index) => (
                    <SMSRosterSection
                      key={`request-roster-section-${index}`}
                      table={table}
                      showWaitingListIndicator={false}
                      editableUnit={editableUnitConfig}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    </SMSBox>
  );
};
