import React from 'react';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import { REQUESTER, SEARCH } from '@/constants/strings';
import { SMSButton, SMSIcon, SMSBox } from '@/components/smsatoms';
import { RequesterResponse } from '@/types/requester';

export interface ManageRequesterProps {
  requesters: RequesterResponse[];
  columns: DataTableColumn<RequesterResponse>[];
  isLoading: boolean;
  viewOnlyRequesters: boolean;
  canAddRequester?: boolean;
  onAdd: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  /** When provided with onSearchChange, search is controlled and can be synced to URL. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export const ManageRequester: React.FC<ManageRequesterProps> = ({
  requesters,
  columns,
  isLoading,
  viewOnlyRequesters,
  canAddRequester = true,
  onAdd,
  onPageChange,
  onPageSizeChange,
  currentPage,
  pageSize,
  totalItems,
  searchValue,
  onSearchChange,
}) => {
  const hasControlledSearch = searchValue !== undefined && onSearchChange !== undefined;

  return (
    <>
      <SMSBox className="requester-list__header">
        <h2 className="requester-list__section-title">Manage Requesters</h2>
        {!viewOnlyRequesters && canAddRequester && (
          <SMSButton
            onClick={onAdd}
            disabled={isLoading}
            className="requester-list__add-button"
            leftIcon={<SMSIcon name="plus" size="sm" />}
          >
            {REQUESTER.BUTTON.ADD_NEW}
          </SMSButton>
        )}
      </SMSBox>

      <SMSBox
        className={`requester-list__table${!viewOnlyRequesters ? ' requester-list__table--with-actions' : ''}`}
      >
        {hasControlledSearch && (
          <div className="requester-list__manage-toolbar data-table__toolbar">
            <div className="data-table__search">
              <SearchFilter
                value={searchValue}
                onChange={onSearchChange}
                placeholder={SEARCH.PLACEHOLDER_TABLE}
              />
            </div>
          </div>
        )}

        <SMSDataTableWrapper<RequesterResponse>
          className="requester-list__sms-datatable"
          columns={columns}
          data={requesters}
          loading={isLoading}
          emptyMessage={REQUESTER.TABLE.NO_DATA}
          emptyTitle={REQUESTER.TABLE.TITLE}
          emptyIcon="list"
          showHeaderWhenEmpty
          maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
          getRowKey={(row) => row.requesterID}
          pagination={{
            currentPage,
            pageSize,
            totalItems,
            serverSide: true,
            onPageChange,
            onPageSizeChange,
          }}
        />
      </SMSBox>
    </>
  );
};
