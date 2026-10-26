import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { addDays, isValid, parseISO } from 'date-fns';
import { SMSBox, SMSButton, SMSDatePicker, SMSDropdown, SMSStack, SMSSwitch, SMSTabs, SMSTypography } from '@/components/smsatoms';
import type { SMSDropdownOption } from '@/components/smsatoms';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { AVAILABLE_POST } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  applyFilter,
  clearWaitingList,
  fetchDashboardRequesterFilterOptions,
  setShowWaitingPosts,
} from '@/store/slices/availablePostSlice';
import { fetchPayCodeOptions } from '@/store/slices/payCodeSlice';
import type { SearchModel } from '@/types/availablePost';
import { ReleaseAs } from '@/types/request';
import {
  getFallbackReleaseAs,
  isManagedGroupReleaseAs,
  MANAGED_RELEASE_GROUP_ID,
  resolveAvailablePostReleaseAccessFromJwt,
  type AvailablePostReleaseAccess,
} from '@/utils/availablePostReleaseTabs';
import { formatDateToYYYYMMDD, getLocalTodayYyyyMmDd } from '@/utils/dateTimeUtils';

const URL_FILTER_KEYS = ['startDate', 'numberOfDays', 'releaseAs'] as const;

function getMaxStartDate(today: string): string {
  const key = today.trim().slice(0, 10);
  const base = parseISO(key);
  if (!isValid(base)) return today;
  return formatDateToYYYYMMDD(addDays(base, 59)); // Today + 59 days = 60-day window inclusive
}

function searchModelFromUrlParams(params: Record<string, string>, today: string): SearchModel {
  const maxStartDate = getMaxStartDate(today);
  let startDate = params.startDate && params.startDate >= today ? params.startDate : today;
  if (startDate > maxStartDate) startDate = maxStartDate;
  const numberOfDaysRaw = params.numberOfDays ? parseInt(params.numberOfDays, 10) : 30;
  const numberOfDays = [15, 30, 45, 60].includes(numberOfDaysRaw) ? numberOfDaysRaw : 30;
  const releaseAsRaw = params.releaseAs ? parseInt(params.releaseAs, 10) : ReleaseAs.Open;
  const releaseAs = [
    ReleaseAs.Open,
    ReleaseAs.TenureBased,
    ReleaseAs.Managed,
    ReleaseAs.Preferred,
    ReleaseAs.Cancelled,
  ].includes(releaseAsRaw)
    ? releaseAsRaw
    : ReleaseAs.Open;
  return { startDate, numberOfDays, releaseAs, managedGeneralIncludesPreferred: false };
}

const baseReleaseAsTabOptions = [
  { id: String(ReleaseAs.Open), label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.OPEN },
  { id: String(ReleaseAs.Cancelled), label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.CANCELLED_POSTS },
  { id: String(ReleaseAs.TenureBased), label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.TENURE_BASED },
  { id: String(ReleaseAs.Managed), label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.MANAGED },
  { id: String(ReleaseAs.Preferred), label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.PREFERRED },
];

/** All release tabs using the same Managed group layout as the employee dashboard.
 * Used by supervisor Employee Jobs where the JWT `ReleaseAsTabTier` belongs to the
 * logged-in admin, not the selected employee. */
const ALL_RELEASE_TABS_ACCESS: AvailablePostReleaseAccess = {
  hasTenureAccess: true,
  hasPreferredAccess: true,
  showManagedGroup: true,
  managedSubTabValues: [
    ReleaseAs.TenureBased,
    ReleaseAs.Managed,
    ReleaseAs.Preferred,
  ],
  topLevelTabValues: [
    ReleaseAs.Open,
    ReleaseAs.Cancelled,
    ReleaseAs.Managed,
  ],
  requesterEmployeeManagedUX: true,
};

export interface SMSAvailablePostFilterProps {
  className?: string;
  /** Show every release tab regardless of the logged-in user's ReleaseAsTabTier claim. */
  showAllReleaseTabs?: boolean;
}

export const SMSAvailablePostFilter: React.FC<SMSAvailablePostFilterProps> = ({
  className,
  showAllReleaseTabs = false,
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const {
    searchModel: currentModel,
    showWaitingPosts,
    filterAppliedAt,
    requesterFilterOptions,
  } = useAppSelector((state) => state.availablePost);
  const { payCodeOptions: payCodeSelectOptions } = useAppSelector((state) => state.payCode);
  const [urlFilters, , setUrlFilters] = useUrlFilters([...URL_FILTER_KEYS]);

  const today = getLocalTodayYyyyMmDd();
  const maxStartDate = getMaxStartDate(today);

  const [localModel, setLocalModel] = useState<SearchModel>(() => {
    const hasUrlParams = urlFilters.startDate || urlFilters.numberOfDays || urlFilters.releaseAs;
    if (!hasUrlParams) {
      return {
        startDate: today,
        numberOfDays: 30,
        releaseAs: ReleaseAs.Open,
        requester: null,
        payCode: null,
        managedGeneralIncludesPreferred: false,
      };
    }
    return {
      ...searchModelFromUrlParams(urlFilters, today),
      requester: null,
      payCode: null,
    };
  });
  const enableOpenAgencyWaitLists = user?.enableOpenAgencyWaitLists === true;

  const syncLocalModelFromRedux = (model: SearchModel) => {
    const modelStartDate = model.startDate || today;
    const validStartDate =
      modelStartDate < today ? today : modelStartDate > maxStartDate ? maxStartDate : modelStartDate;
    setLocalModel({
      ...model,
      startDate: validStartDate,
      releaseAs: model.releaseAs ?? ReleaseAs.Open,
      requester: model.requester ?? null,
      payCode: model.payCode ?? null,
      managedGeneralIncludesPreferred: model.managedGeneralIncludesPreferred ?? false,
    });
  };

  useEffect(() => {
    syncLocalModelFromRedux(currentModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAppliedAt]);

  const releaseAccess = useMemo(
    () =>
      showAllReleaseTabs
        ? ALL_RELEASE_TABS_ACCESS
        : resolveAvailablePostReleaseAccessFromJwt(user?.releaseAsTabTier),
    [showAllReleaseTabs, user?.releaseAsTabTier]
  );

  const releaseAsTabOptions = useMemo(
    () =>
      baseReleaseAsTabOptions
        .filter((option) => releaseAccess.topLevelTabValues.includes(Number(option.id) as ReleaseAs))
        .map((option) => ({
          ...option,
          id:
            Number(option.id) === ReleaseAs.Managed && releaseAccess.managedSubTabValues.length > 0
              ? MANAGED_RELEASE_GROUP_ID
              : option.id,
        })),
    [releaseAccess.managedSubTabValues.length, releaseAccess.topLevelTabValues]
  );

  const managedSubTabOptions = useMemo(() => {
    const filtered = baseReleaseAsTabOptions.filter((option) =>
      releaseAccess.managedSubTabValues.includes(Number(option.id) as ReleaseAs)
    );
    if (!releaseAccess.requesterEmployeeManagedUX) return filtered;
    return filtered.map((o) => {
      const v = Number(o.id) as ReleaseAs;
      if (v === ReleaseAs.TenureBased) {
        return { ...o, label: AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.MANAGED_SUB_TENURE };
      }
      return o;
    });
  }, [releaseAccess.managedSubTabValues, releaseAccess.requesterEmployeeManagedUX]);

  const daysOptions = useMemo(
    () => [
      { value: 15, label: AVAILABLE_POST.FILTER.DAYS_OPTIONS.NEXT_15 },
      { value: 30, label: AVAILABLE_POST.FILTER.DAYS_OPTIONS.NEXT_30 },
      { value: 45, label: AVAILABLE_POST.FILTER.DAYS_OPTIONS.NEXT_45 },
      { value: 60, label: AVAILABLE_POST.FILTER.DAYS_OPTIONS.NEXT_60 },
    ],
    []
  );

  const requesterOptions = useMemo<SMSDropdownOption[]>(
    () =>
      (requesterFilterOptions ?? [])
        .map((req) => ({
          value: req.id,
          label: req.title || req.id,
        }))
        .filter((o) => String(o.value ?? '').trim()),
    [requesterFilterOptions]
  );

  useEffect(() => {
    if (!localModel.startDate || !localModel.numberOfDays) return;
    dispatch(
      fetchDashboardRequesterFilterOptions({
        startDate: localModel.startDate,
        numberOfDays: localModel.numberOfDays,
      })
    );
  }, [dispatch, localModel.startDate, localModel.numberOfDays]);

  const handleRequesterSearchInputChange = useCallback(
    (value: string) =>
      dispatch(
        fetchDashboardRequesterFilterOptions({
          startDate: localModel.startDate,
          numberOfDays: localModel.numberOfDays,
          searchTerm: value,
        })
      )
        .unwrap()
        .catch(() => undefined),
    [dispatch, localModel.startDate, localModel.numberOfDays]
  );

  const payCodeOptions = useMemo<SMSDropdownOption[]>(
    () =>
      (payCodeSelectOptions ?? [])
        .map((item) => ({
          value: item.id,
          label: item.label || item.id,
        }))
        .filter((o) => String(o.value ?? '').trim()),
    [payCodeSelectOptions]
  );

  const selectedPayCodeIdRef = React.useRef(localModel.payCode ?? '');
  selectedPayCodeIdRef.current = localModel.payCode ?? '';

  const handlePayCodeSearchInputChange = useCallback(
    (value: string) => {
      const selectedId = selectedPayCodeIdRef.current.trim() || undefined;
      return dispatch(fetchPayCodeOptions({ searchTerm: value, selectedId }))
        .unwrap()
        .catch(() => undefined);
    },
    [dispatch]
  );

  // Layout (not passive) so Redux matches URL before the list's fetch effect runs.
  useLayoutEffect(() => {
    const hasUrlParams = urlFilters.startDate || urlFilters.numberOfDays || urlFilters.releaseAs;
    if (!hasUrlParams) return;
    const model = searchModelFromUrlParams(urlFilters, today);
    if (
      currentModel.startDate === model.startDate &&
      currentModel.numberOfDays === model.numberOfDays &&
      currentModel.releaseAs === model.releaseAs
    ) {
      return;
    }
    const nextModel: SearchModel = {
      ...currentModel,
      startDate: model.startDate,
      numberOfDays: model.numberOfDays,
      releaseAs: model.releaseAs,
      managedGeneralIncludesPreferred: false,
    };
    setLocalModel((prev) => ({
      ...prev,
      startDate: nextModel.startDate,
      numberOfDays: nextModel.numberOfDays,
      releaseAs: nextModel.releaseAs,
      managedGeneralIncludesPreferred: false,
    }));
    dispatch(applyFilter(nextModel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilters.startDate, urlFilters.numberOfDays, urlFilters.releaseAs]);

  const canShowWaitingList = useMemo(() => {
    const waitingListSupported = new Set<ReleaseAs>([ReleaseAs.Open, ReleaseAs.Managed, ReleaseAs.Preferred]);
    if (!waitingListSupported.has(localModel.releaseAs)) return false;
    if (localModel.releaseAs === ReleaseAs.Open) return enableOpenAgencyWaitLists;
    return true;
  }, [localModel.releaseAs, enableOpenAgencyWaitLists]);

  useEffect(() => {
    if (canShowWaitingList) return;
    if (!showWaitingPosts) return;
    dispatch(setShowWaitingPosts(false));
    dispatch(clearWaitingList());
  }, [canShowWaitingList, dispatch, showWaitingPosts]);
  
  const handleWaitingListToggle = (checked: boolean) => {
    dispatch(setShowWaitingPosts(checked));
    if (!checked) dispatch(clearWaitingList());
  };

  const applyAndSync = (model: SearchModel) => {
    const clampedStartDate =
      model.startDate < today ? today : model.startDate > maxStartDate ? maxStartDate : model.startDate;
    const nextModel: SearchModel = {
      ...model,
      startDate: clampedStartDate,
    };
    dispatch(applyFilter(nextModel));
    setUrlFilters({
      startDate: nextModel.startDate,
      numberOfDays: String(nextModel.numberOfDays),
      releaseAs: String(nextModel.releaseAs),
    });
  };

  const handleApply = () => {
    applyAndSync(localModel);
  };

  const updateRequesterFilter = (value: string) => {
    const nextModel: SearchModel = {
      ...localModel,
      requester: value.trim() || null,
    };
    setLocalModel(nextModel);
    applyAndSync(nextModel);
  };

  const updatePayCodeFilter = (value: string) => {
    const nextModel: SearchModel = {
      ...localModel,
      payCode: value.trim() || null,
    };
    setLocalModel(nextModel);
    applyAndSync(nextModel);
  };

  useEffect(() => {
    const nextReleaseAs = getFallbackReleaseAs(localModel.releaseAs, releaseAccess);
    const mustClearMergedFlag = localModel.managedGeneralIncludesPreferred === true;
    if (nextReleaseAs === localModel.releaseAs && !mustClearMergedFlag) {
      return;
    }

    const nextModel: SearchModel = {
      ...localModel,
      releaseAs: nextReleaseAs,
      managedGeneralIncludesPreferred: false,
      requester: null,
      payCode: null,
    };
    setLocalModel(nextModel);
    applyAndSync(nextModel);
  }, [localModel, releaseAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateReleaseAs = (nextReleaseAs: ReleaseAs) => {
    const releaseAsChanged = nextReleaseAs !== localModel.releaseAs;
    const nextModel: SearchModel = {
      ...localModel,
      releaseAs: nextReleaseAs,
      managedGeneralIncludesPreferred: false,
      ...(releaseAsChanged ? { requester: null, payCode: null } : {}),
    };
    setLocalModel(nextModel);

    const waitingListSupported = new Set<ReleaseAs>([ReleaseAs.Open, ReleaseAs.Managed, ReleaseAs.Preferred]);
    const nextCanShowWaitingList = waitingListSupported.has(nextReleaseAs);
    if (!nextCanShowWaitingList && showWaitingPosts) {
      dispatch(setShowWaitingPosts(false));
      dispatch(clearWaitingList());
    }

    // Auto-apply when switching Release As tabs
    applyAndSync(nextModel);
  };

  const handleReleaseAsChange = (id: string) => {
    if (id === MANAGED_RELEASE_GROUP_ID) {
      if (releaseAccess.requesterEmployeeManagedUX) {
        const subs = releaseAccess.managedSubTabValues;
        const current = localModel.releaseAs;
        updateReleaseAs(subs.includes(current) ? current : subs[0] ?? ReleaseAs.TenureBased);
        return;
      }
      updateReleaseAs(
        localModel.releaseAs === ReleaseAs.Preferred && releaseAccess.hasPreferredAccess
          ? ReleaseAs.Preferred
          : ReleaseAs.Managed
      );
      return;
    }

    updateReleaseAs(Number(id) as ReleaseAs);
  };

  const hasManagedSubTabs = managedSubTabOptions.length > 0;
  const activeTopLevelTab =
    hasManagedSubTabs && isManagedGroupReleaseAs(localModel.releaseAs, releaseAccess)
      ? MANAGED_RELEASE_GROUP_ID
      : String(localModel.releaseAs);

  const showReleaseAsTabs = releaseAsTabOptions.length > 0;

  return (
    <SMSBox className={className} sx={{ maxWidth: '100%', overflow: 'hidden' }}>
      <SMSStack spacing={2}>
        {showReleaseAsTabs && (
          <>
            <SMSStack spacing={1}>
              <SMSTypography variant="body2" color="text.secondary">
                {AVAILABLE_POST.FILTER.RELEASE_AS.LABEL}
              </SMSTypography>
              <SMSBox sx={{ maxWidth: 380 }}>
                <SMSTabs
                  options={releaseAsTabOptions}
                  value={activeTopLevelTab}
                  onChange={handleReleaseAsChange}
                  activePillColor={
                    activeTopLevelTab === String(ReleaseAs.Cancelled) ? '#b22222' : undefined
                  }
                />
              </SMSBox>
            </SMSStack>

            {activeTopLevelTab === MANAGED_RELEASE_GROUP_ID && managedSubTabOptions.length > 0 && (
              <SMSStack spacing={1}>
                <SMSTypography variant="body2" color="text.secondary">
                  {AVAILABLE_POST.FILTER.RELEASE_AS.OPTIONS.MANAGED}
                </SMSTypography>
                <SMSBox sx={{ maxWidth: 380 }}>
                  <SMSTabs
                    distribution="content"
                    options={managedSubTabOptions}
                    value={String(localModel.releaseAs)}
                    onChange={(id) => updateReleaseAs(Number(id) as ReleaseAs)}
                  />
                </SMSBox>
              </SMSStack>
            )}
          </>
        )}

        <SMSStack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'flex-end' }}
          sx={{ flexWrap: 'wrap', rowGap: 1.5 }}
        >
          <SMSBox
            sx={{
              flex: { xs: '1 1 100%', md: '0 1 180px' },
              minWidth: { md: 180 },
              maxWidth: { md: 180 },
              '--sms-input-height': '32px',
            }}
          >
            <SMSDatePicker
              label={AVAILABLE_POST.FILTER.START_DATE}
              value={localModel.startDate}
              onChange={(v) => setLocalModel((p) => ({ ...p, startDate: v }))}
              valueFormat="YYYY-MM-DD"
              minDate={today}
              maxDate={maxStartDate}
            />
          </SMSBox>

          <SMSBox
            sx={{
              flex: { xs: '1 1 100%', md: '0 1 180px' },
              minWidth: { md: 180 },
              maxWidth: { md: 180 },
              '--sms-input-height': '32px',
            }}
          >
            <SMSDropdown
              label={AVAILABLE_POST.FILTER.NUMBER_OF_DAYS}
              value={localModel.numberOfDays}
              onChange={(e) => setLocalModel((p) => ({ ...p, numberOfDays: Number(e.target.value) }))}
              options={daysOptions}
            />
          </SMSBox>

          <SMSBox
            sx={{
              flex: { xs: '1 1 100%', md: '0 1 180px' },
              minWidth: { md: 180 },
              maxWidth: { md: 180 },
              '--sms-input-height': '32px',
            }}
          >
            <SMSDropdown
              label={AVAILABLE_POST.FILTER.REQUESTER}
              value={localModel.requester ?? ''}
              onChange={(e) => updateRequesterFilter(String(e.target.value))}
              options={requesterOptions}
              placeholder={AVAILABLE_POST.FILTER.REQUESTER_PLACEHOLDER}
              clearable
              serverSideSearch
              onSearchInputChange={handleRequesterSearchInputChange}
            />
          </SMSBox>

          <SMSBox
            sx={{
              flex: { xs: '1 1 100%', md: '0 1 180px' },
              minWidth: { md: 180 },
              maxWidth: { md: 180 },
              '--sms-input-height': '32px',
            }}
          >
            <SMSDropdown
              label={AVAILABLE_POST.FILTER.PAY_CODE}
              value={localModel.payCode ?? ''}
              onChange={(e) => updatePayCodeFilter(String(e.target.value))}
              options={payCodeOptions}
              placeholder={AVAILABLE_POST.FILTER.PAY_CODE_PLACEHOLDER}
              clearable
              serverSideSearch
              onSearchInputChange={handlePayCodeSearchInputChange}
            />
          </SMSBox>

          <SMSStack
            direction="row"
            spacing={1.5}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ flex: { xs: '1 1 100%', md: '0 0 auto' }, flexShrink: 0 }}
          >
            <SMSButton onClick={handleApply} sx={{ minWidth: 110, px: 1.5 }}>
              {AVAILABLE_POST.FILTER.APPLY_BUTTON}
            </SMSButton>
            {canShowWaitingList && (
              <SMSSwitch
                label={AVAILABLE_POST.FILTER.SHOW_WAITING_LIST}
                checked={showWaitingPosts}
                onChange={(e) => handleWaitingListToggle(e.target.checked)}
              />
            )}
          </SMSStack>
        </SMSStack>
      </SMSStack>
    </SMSBox>
  );
};

export default SMSAvailablePostFilter;
