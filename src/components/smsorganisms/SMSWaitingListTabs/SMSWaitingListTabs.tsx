import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AVAILABLE_POST, WAITING_LIST } from '@/constants/strings';
import { SMSCheckbox } from '@/components/smsatoms';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchMyTenureWaitingPositions,
  setPagination,
  setViewWLHistory,
  waitingListTabKeyFromReleaseAs,
} from '@/store/slices/tenureWaitingPositionSlice';
import { ReleaseAs } from '@/types/request';
import { isWaitingListSubTab, WaitingListSubTab } from '@/types/waitingListSubTab';
import { SMSTenureWaitingListTable } from './SMSTenureWaitingListTable';
import '@/components/smsmolecules/PostPositionByStatusList/PostPositionByStatusList.css';
import './SMSWaitingListTabs.css';
import SMSTabs, { SMSTabOption } from '@/components/smsatoms/SMSTabs';

const SUB_TAB_ITEMS: SMSTabOption[] = [
  { id: WaitingListSubTab.TenureBased, label: WAITING_LIST.SUB_TABS.TENURE },
  { id: WaitingListSubTab.General, label: WAITING_LIST.SUB_TABS.GENERAL },
];

export const SMSWaitingListTabs: React.FC = () => {
  const dispatch = useAppDispatch();
  const [activeSubTab, setActiveSubTab] = useState<WaitingListSubTab>(WaitingListSubTab.TenureBased);
  const prevSubTabRef = useRef<WaitingListSubTab | null>(null);

  const listReleaseAs =
    activeSubTab === WaitingListSubTab.TenureBased ? ReleaseAs.TenureBased : ReleaseAs.General;
  const tabKey = waitingListTabKeyFromReleaseAs(listReleaseAs);
  const { pagination, isViewWLHistory } = useAppSelector((s) => s.tenureWaitingPosition.byTab[tabKey]);

  /**
   * Fetch only for the **active** sub-tab (POST body: tenure `[TenureBased]`, general multiple `ReleaseAs`).
   * Pagination is stored per tab in Redux; duplicate identical dispatches are skipped (thunk `condition`).
   */
  useEffect(() => {
    void dispatch(
      fetchMyTenureWaitingPositions({
        releaseAs: listReleaseAs,
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
        sortBy: 'dateOfWork',
        sortDirection: 'asc',
        isViewWLHistory,
      })
    );
  }, [dispatch, listReleaseAs, pagination.currentPage, pagination.pageSize, isViewWLHistory]);

  /**
   * Reset list page when switching Tenure based ↔ General only.
   * Must not run from the sub-tab click handler together with `setActiveSubTab` in a way that updates
   * pagination while the previous table is still mounted — that caused an extra fetch with the old `releaseAs`.
   */
  useLayoutEffect(() => {
    const prev = prevSubTabRef.current;
    prevSubTabRef.current = activeSubTab;
    if (prev !== null && prev !== activeSubTab) {
      const releaseAs =
        activeSubTab === WaitingListSubTab.TenureBased ? ReleaseAs.TenureBased : ReleaseAs.General;
      dispatch(setPagination({ releaseAs, currentPage: 1 }));
    }
  }, [activeSubTab, dispatch]);

  const handleSubTabChange = useCallback((id: string) => {
    if (isWaitingListSubTab(id)) {
      setActiveSubTab(id);
    }
  }, []);

  const handleWithHistoryChange = useCallback(
    (checked: boolean) => {
      dispatch(
        setViewWLHistory({
          releaseAs: listReleaseAs,
          isViewWLHistory: checked,
        })
      );
    },
    [dispatch, listReleaseAs]
  );

  const withHistoryControl = (
    <SMSCheckbox
      className="waiting-list-tabs__with-history"
      label={WAITING_LIST.WITH_HISTORY}
      checked={isViewWLHistory}
      onChange={handleWithHistoryChange}
    />
  );

  return (
    <div className="post-position-by-status-list">
      <div className="post-position-by-status-list__header waiting-list-tabs__header">
        <h2 className="post-position-by-status-list__title">
          {AVAILABLE_POST.TAB_TITLES.WAITING_LIST}
        </h2>
        <div className="waiting-list-tabs__toolbar">
          <div className="waiting-list-tabs__toolbar-start">
            <SMSTabs
              options={SUB_TAB_ITEMS}
              value={activeSubTab}
              onChange={handleSubTabChange}
              distribution="content"
            />
          </div>
          <div className="waiting-list-tabs__toolbar-end">{withHistoryControl}</div>
        </div>
      </div>
      {activeSubTab === WaitingListSubTab.TenureBased ? (
        <SMSTenureWaitingListTable tab={WaitingListSubTab.TenureBased} />
      ) : (
        <SMSTenureWaitingListTable tab={WaitingListSubTab.General} />
      )}
    </div>
  );
};
