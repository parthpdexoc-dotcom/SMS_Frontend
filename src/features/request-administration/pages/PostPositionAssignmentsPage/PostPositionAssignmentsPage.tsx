import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import {
  SMSButton,
  SMSDatePicker,
  SMSDropdown,
  SMSIcon,
  SMSBox,
  SMSTabs,
  type SMSDropdownOption,
} from '@/components/smsatoms';
import { EmployeeCard } from '@/components/smsmolecules/EmployeeCard';
import { SMSLoadingState } from '@/components/smsmolecules';
import { POST_POSITION } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchAssignmentsAndWaitingListForPostDate } from '@/store/slices/postPositionSlice';
import { getAssignmentsAndWaitingListCacheKey } from '@/services/postPositionService';
import { PostPositionStatus, type PostPositionResponse } from '@/types/postPosition';
import { formatDateShort } from '@/utils';
import { renderPostPositionStatusPill, readPostPositionStatusValue } from '@/utils/postPositionStatusPill';
import { resolveWorkspaceReturnPath } from '@/utils/dailyWorkspaceSessionState';

const LOADING_MSG = POST_POSITION.TABLE.LOADING;
const S = POST_POSITION.ASSIGNMENTS_AND_WAITING;
const NUMBER_OF_DAYS_CHOICES = [15, 30, 45, 60] as const;
const DEFAULT_NUMBER_OF_DAYS = 30;

const TAB_APPLIED = 'applied';
const TAB_WAITING = 'waiting';

type LocationState = {
  returnPath?: string;
  requesterId?: string;
  tab?: string;
  postTitle?: string;
} | null;

function parseNumberOfDaysParam(raw: string | null | undefined, fallback = DEFAULT_NUMBER_OF_DAYS): number {
  if (!raw?.trim()) return fallback;
  const n = parseInt(raw, 10);
  return NUMBER_OF_DAYS_CHOICES.includes(n as (typeof NUMBER_OF_DAYS_CHOICES)[number]) ? n : fallback;
}

export const PostPositionAssignmentsPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = (location.state as LocationState) || null;
  const [persistedPostTitle] = useState<string>(() => state?.postTitle?.trim() || '');

  const [draftDate, setDraftDate] = useState('');
  const [draftNumberOfDays, setDraftNumberOfDays] = useState('');
  const [activeTab, setActiveTab] = useState(TAB_APPLIED);

  const urlStartDate = useMemo(() => {
    return searchParams.get('startDate')?.trim() || searchParams.get('dateOfWork')?.trim() || '';
  }, [searchParams]);

  const urlNumberOfDays = useMemo(() => searchParams.get('numberOfDays')?.trim() || '', [searchParams]);

  useEffect(() => {
    if (urlStartDate) {
      setDraftDate(urlStartDate);
      setDraftNumberOfDays(
        urlNumberOfDays
          ? String(parseNumberOfDaysParam(urlNumberOfDays, DEFAULT_NUMBER_OF_DAYS))
          : String(DEFAULT_NUMBER_OF_DAYS)
      );
    } else {
      setDraftDate('');
      setDraftNumberOfDays('');
    }
  }, [urlStartDate, urlNumberOfDays]);

  const appliedNumberForApi = useMemo((): number | undefined => {
    if (!urlStartDate) return undefined;
    return parseNumberOfDaysParam(
      urlNumberOfDays && urlNumberOfDays.length > 0 ? urlNumberOfDays : String(DEFAULT_NUMBER_OF_DAYS),
      DEFAULT_NUMBER_OF_DAYS
    );
  }, [urlStartDate, urlNumberOfDays]);

  const cacheKey = useMemo(() => {
    if (!postId?.trim()) return '';
    return getAssignmentsAndWaitingListCacheKey(
      postId,
      urlStartDate || null,
      urlStartDate ? appliedNumberForApi ?? null : null
    );
  }, [postId, urlStartDate, appliedNumberForApi]);

  const cached = useAppSelector((s) =>
    cacheKey ? s.postPosition.assignmentsWaitingCache[cacheKey] : undefined
  );
  const loading = useAppSelector((s) =>
    cacheKey ? Boolean(s.postPosition.assignmentsWaitingLoadingKeys[cacheKey]) : false
  );
  const error = useAppSelector((s) =>
    cacheKey ? s.postPosition.assignmentsWaitingErrorsByKey[cacheKey] ?? null : null
  );

  useEffect(() => {
    if (!postId?.trim()) return;
    if (!urlStartDate) {
      void dispatch(
        fetchAssignmentsAndWaitingListForPostDate({
          postId: postId.trim(),
        })
      );
      return;
    }
    void dispatch(
      fetchAssignmentsAndWaitingListForPostDate({
        postId: postId.trim(),
        startDate: urlStartDate,
        numberOfDays: appliedNumberForApi,
      })
    );
  }, [dispatch, postId, urlStartDate, appliedNumberForApi]);

  const handleDraftDateChange = useCallback((v: string) => {
    const t = (v || '').trim();
    setDraftDate(t);
    if (!t) {
      setDraftNumberOfDays('');
    } else {
      setDraftNumberOfDays((prev) => prev || String(DEFAULT_NUMBER_OF_DAYS));
    }
  }, []);

  const handleBack = useCallback(() => {
    const resolvedReturn = resolveWorkspaceReturnPath(state);
    if (resolvedReturn) {
      navigate(resolvedReturn);
      return;
    }
    navigate(-1);
  }, [navigate, state]);

  const handleSearch = useCallback(() => {
    if (!draftDate.trim()) {
      setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }
    const n = parseNumberOfDaysParam(draftNumberOfDays, DEFAULT_NUMBER_OF_DAYS);
    const next = new URLSearchParams();
    next.set('startDate', draftDate.trim());
    next.set('numberOfDays', String(n));
    setSearchParams(next, { replace: true });
  }, [draftDate, draftNumberOfDays, setSearchParams]);

  const handleClear = useCallback(() => {
    setDraftDate('');
    setDraftNumberOfDays('');
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const hasDateForControls = Boolean(draftDate.trim());

  const numberOfDaysOptions: SMSDropdownOption[] = useMemo(
    () =>
      NUMBER_OF_DAYS_CHOICES.map((n) => ({
        value: String(n),
        label: String(n),
      })),
    []
  );

  const emptyNumberOfDaysOptions: SMSDropdownOption[] = useMemo(
    () => [{ value: '', label: '\u00a0' }],
    []
  );

  const tabItems = useMemo(
    () => [
      { id: TAB_APPLIED, label: S.TAB_APPLIED, icon: 'group' as const },
      { id: TAB_WAITING, label: S.TAB_WAITING, icon: 'hourglass_empty' as const },
    ],
    []
  );

  const appliedRows = cached?.assignments ?? [];
  const waitingRows = cached?.waitingList ?? [];

  const positionKey = (p: PostPositionResponse, index: number) =>
    p.postPositionId?.trim() || `idx-${index}`;

  const renderCardGrid = (rows: PostPositionResponse[]) => (
    <SMSBox
      className="post-position-assignments__cards"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {rows.map((position, index) => (
        <SMSBox
          key={positionKey(position, index)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            /** Match `EmployeeCard` width so status pill gets a real line-length cap (flex min-width defaults otherwise expand the column). */
            width: 120,
            maxWidth: 120,
            minWidth: 0,
            flex: '0 0 auto',
          }}
        >
          <EmployeeCard
            position={position}
            statusAssigned={readPostPositionStatusValue(position) === PostPositionStatus.Assigned}
          />
          <SMSBox
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 0.5,
              width: '100%',
              minWidth: 0,
            }}
          >
            {renderPostPositionStatusPill(readPostPositionStatusValue(position))}
            {position.dateOfWork ? (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.3 }}>
                {formatDateShort(String(position.dateOfWork))}
              </Typography>
            ) : null}
          </SMSBox>
        </SMSBox>
      ))}
    </SMSBox>
  );

  const titleSuffix = persistedPostTitle ? ` - ${persistedPostTitle}` : '';

  return (
    <Box component="main" className="post-position-assignments-page requester-list">
      <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={1.5} sx={{ justifyContent: 'flex-start', mb: 1 }}>
        <button
          type="button"
          onClick={handleBack}
          className="form-page__back-button"
          aria-label={S.BACK}
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <Typography variant="h4" component="h1" sx={{ margin: 0 }}>
          {S.PAGE_TITLE}
          {titleSuffix}
        </Typography>
      </Stack>

      <Box
        sx={{
          mb: 2,
          maxWidth: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 2,
            width: '100%',
            maxWidth: 720,
          }}
        >
          <Box sx={{ flex: '0 0 auto', minWidth: 0, maxWidth: 280, width: '100%' }}>
            <SMSDatePicker
              label={S.START_DATE}
              value={draftDate || undefined}
              onChange={handleDraftDateChange}
              id="post-position-assignments-start-date"
            />
          </Box>
          <Box sx={{ flex: '0 0 auto', minWidth: 0, maxWidth: 200, width: '100%' }}>
            <SMSDropdown
              id="post-position-assignments-number-of-days"
              label={S.NUMBER_OF_DAYS}
              options={hasDateForControls ? numberOfDaysOptions : emptyNumberOfDaysOptions}
              value={hasDateForControls ? draftNumberOfDays : ''}
              onChange={(e) => setDraftNumberOfDays(String((e.target as HTMLInputElement).value))}
              disabled={!hasDateForControls}
              displayEmpty
            />
          </Box>
          <SMSButton variant="contained" onClick={handleSearch} allowWhenSuspended sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {S.SEARCH}
          </SMSButton>
          <SMSButton variant="outlined" onClick={handleClear} allowWhenSuspended sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {S.CLEAR}
          </SMSButton>
        </Box>
      </Box>

      <Box sx={{ mb: 2, maxWidth: 400 }}>
        <SMSTabs options={tabItems} value={activeTab} onChange={setActiveTab} distribution="content" />
      </Box>

      {error ? (
        <Typography color="error" role="alert">
          {error || S.LOAD_ERROR}
        </Typography>
      ) : loading ? (
        <SMSLoadingState message={LOADING_MSG} />
      ) : activeTab === TAB_APPLIED ? (
        appliedRows.length === 0 ? (
          <Typography color="text.secondary">{S.NO_APPLIED}</Typography>
        ) : (
          renderCardGrid(appliedRows)
        )
      ) : waitingRows.length === 0 ? (
        <Typography color="text.secondary">{S.NO_WAITING}</Typography>
      ) : (
        renderCardGrid(waitingRows)
      )}
    </Box>
  );
};
