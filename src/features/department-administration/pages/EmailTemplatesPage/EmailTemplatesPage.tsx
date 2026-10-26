import { SMSButton, SMSIcon, SMSIconButton, SMSBox } from '@/components/smsatoms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import type { DataTableColumn } from '@/components/smsorganisms';
import { EMAIL_TEMPLATES } from '@/constants/strings';
import { EmailTemplateDto } from '@/types/emailTemplate';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmailTemplates, searchEmailTemplatesThunk } from '@/store/slices/emailTemplateSlice';
import { usePagination } from '@/hooks/usePagination';
import { DEFAULT_TABLE_PAGE_SIZE, PAGE_GRID_MAX_BODY_HEIGHT } from '@/constants/tablePagination';
import './EmailTemplatesPage.css';

export const EmailTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    emailTemplates: list,
    totalRecords,
    isLoading: listLoading,
    error: listError,
  } = useAppSelector((state) => state.emailTemplate);
  const [emailTemplateUrlFilters, , setEmailTemplateFilters] = useUrlFilters(['search']);
  const emailTemplateSearchFromUrl = emailTemplateUrlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(emailTemplateSearchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const pagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  const refetch = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const hasSearchFilters = searchTerm.length > 0;

    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(searchTerm ? { searchTerm } : {}),
    };

    if (hasSearchFilters) {
      dispatch(searchEmailTemplatesThunk(params));
    } else {
      dispatch(fetchEmailTemplates(params));
    }
  }, [dispatch, debouncedSearch, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);


  useEffect(() => {
    pagination.setTotalItems(totalRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRecords]);

  useEffect(() => {
    setLocalSearch(emailTemplateSearchFromUrl);
  }, [emailTemplateSearchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== emailTemplateSearchFromUrl) {
      pagination.goToFirstPage();
      setEmailTemplateFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, emailTemplateSearchFromUrl, pagination, setEmailTemplateFilters]);


  const handleAdd = () => navigate('/email-templates/add');

  const handleEdit = useCallback((row: EmailTemplateDto) => {
    const id = row.emailTemplateID?.trim();
    if (!id) return;
    navigate(`/email-templates/edit/${id}`);
  }, [navigate]);

  const columns: DataTableColumn<EmailTemplateDto>[] = useMemo(
    () => [
      {
        key: 'name',
        label: EMAIL_TEMPLATES.TABLE.COLUMNS.NAME,
        render: (_value, row) => row.name ?? '-',
      },
      {
        key: 'subject',
        label: EMAIL_TEMPLATES.TABLE.COLUMNS.SUBJECT,
        render: (_value, row) => row.subject ?? '-',
      },
      {
        key: 'actions',
        label: EMAIL_TEMPLATES.TABLE.COLUMNS.ACTION,
        render: (_value, row) => (
          <div className="email-templates-page__actions">
            <SMSIconButton
              size="small"
              tone="primary"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              title={EMAIL_TEMPLATES.BUTTON.EDIT}
              aria-label={EMAIL_TEMPLATES.BUTTON.EDIT}
              className="email-templates-page__edit-btn"
            >
              <SMSIcon name="edit" size="sm" />
            </SMSIconButton>
          </div>
        ),
      },
    ],
    [handleEdit]
  );

  return (
    <div className="email-templates-page">
      <div className="email-templates-page__header">
        <div>
          <h1 className="email-templates-page__title">{EMAIL_TEMPLATES.TITLE}</h1>
          <p className="email-templates-page__subtitle">{EMAIL_TEMPLATES.SUBTITLE}</p>
        </div>
        <SMSButton
          onClick={handleAdd}
          disabled={listLoading}
          className="email-templates-page__add-btn"
          leftIcon={<SMSIcon name="add" size="sm" />}
        >
          {EMAIL_TEMPLATES.BUTTON.ADD_NEW}
        </SMSButton>
      </div>

      <SMSBox className="email-templates-page__table">
        {listError && list.length > 0 && (
          <div className="email-templates-page__error" role="alert">
            {listError}
          </div>
        )}

        <div className="email-templates-page__toolbar data-table__toolbar">
          <div className="data-table__search email-templates-page__search">
            <SearchFilter
              value={localSearch}
              onChange={setLocalSearch}
              placeholder="Search templates..."
            />
          </div>
        </div>

        <SMSDataTableWrapper<EmailTemplateDto>
          className="email-templates-page__sms-datatable"
          columns={columns}
          data={list}
          loading={listLoading}
          error={listError && list.length === 0 ? listError : null}
          onRetry={list.length === 0 ? refetch : undefined}
          emptyMessage={EMAIL_TEMPLATES.TABLE.NO_DATA}
          emptyTitle={EMAIL_TEMPLATES.TABLE.TITLE}
          emptyIcon="list"
          showHeaderWhenEmpty
          maxBodyHeight={PAGE_GRID_MAX_BODY_HEIGHT}
          responsiveMode="table"
          getRowKey={(row) => row.emailTemplateID ?? `row-${row.name ?? ''}-${row.subject ?? ''}`}
          pagination={{
            serverSide: true,
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalItems: pagination.totalItems,
            onPageChange: (page) => pagination.goToPage(page),
            onPageSizeChange: (size) => {
              pagination.setPageSize(size);
              pagination.goToFirstPage();
            },
          }}
        />
      </SMSBox>
    </div>
  );
};
