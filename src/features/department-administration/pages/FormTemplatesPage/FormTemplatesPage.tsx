import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import { SMSButton, SMSDropdown, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import type { DataTableColumn } from '@/components/smsorganisms';
import { SMSDataTableWrapper } from '@/components/smsorganisms';
import { ACTIVITY_FORM } from '@/constants/strings';
import { QuestionnaireResponse } from '@/types/questionnaire';
import {
  getQuestionnairesByDepartment,
  getQuestionnairesByAdmin,
  getAllQuestionnairesByAdmin,
  searchQuestionnairesByAdmin,
  searchQuestionnairesByDepartment,
} from '@/services/questionnaireService';
import { deleteActivityForm } from '@/services/activityFormService';
import { usePagination } from '@/hooks/usePagination';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import './FormTemplatesPage.css';

export const FormTemplatesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const userType = useAppSelector((state) => state.auth.user?.userType);
  const isEmployee = userType === 'Employee';
  const [activityFormUrlFilters, , setActivityFormFilters] = useUrlFilters(['search']);
  const activityFormSearchFromUrl = activityFormUrlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(activityFormSearchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const [questionnaires, setQuestionnaires] = useState<QuestionnaireResponse[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [templateQuestionnaires, setTemplateQuestionnaires] = useState<QuestionnaireResponse[]>([]);
  const [templateListLoading, setTemplateListLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createChoice, setCreateChoice] = useState<'template' | 'new'>('new');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [deletingQuestionnaire, setDeletingQuestionnaire] = useState<QuestionnaireResponse | null>(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const listPagination = usePagination({
    initialPage: 1,
    initialPageSize: DEFAULT_TABLE_PAGE_SIZE,
    totalItems: 0,
  });

  useEffect(() => {
    if (!userType) return;
    setListError(null);
    setListLoading(true);
    const run = async () => {
      try {
        const searchTerm = debouncedSearch.trim();
        if (userType === 'Admin') {
          const fetcher = searchTerm ? searchQuestionnairesByAdmin : getQuestionnairesByAdmin;
          const { data, totalRecords } = await fetcher({
            page: listPagination.currentPage,
            pageSize: listPagination.pageSize,
            ...(searchTerm ? { searchTerm } : {}),
          });
          setQuestionnaires(data);
          listPagination.setTotalItems(totalRecords);
        } else {
          if (searchTerm) {
            const { data, totalRecords } = await searchQuestionnairesByDepartment({
              page: 1,
              pageSize: 5000,
              searchTerm,
            });
            setQuestionnaires(data);
            listPagination.setTotalItems(totalRecords);
          } else {
            const rows = await getQuestionnairesByDepartment();
            setQuestionnaires(rows);
          }
        }
      } catch (err) {
        setListError(err instanceof Error ? err.message : 'Failed to load questionnaires');
      } finally {
        setListLoading(false);
      }
    };
    void run();
  }, [userType, listPagination.currentPage, listPagination.pageSize, debouncedSearch, listRefreshKey]);

  useEffect(() => {
    if (userType === 'Admin') return;
    listPagination.setTotalItems(questionnaires.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, questionnaires.length]);

  useEffect(() => {
    setLocalSearch(activityFormSearchFromUrl);
  }, [activityFormSearchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== activityFormSearchFromUrl) {
      listPagination.goToFirstPage();
      setActivityFormFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, activityFormSearchFromUrl, listPagination, setActivityFormFilters]);

  // Load template options when user selects "Use template" in the modal
  useEffect(() => {
    if (!createModalOpen || createChoice !== 'template') return;
    setTemplateListLoading(true);
    getAllQuestionnairesByAdmin()
      .then(setTemplateQuestionnaires)
      .catch(() => setTemplateQuestionnaires([]))
      .finally(() => setTemplateListLoading(false));
  }, [createModalOpen, createChoice]);

  const handleAddClick = () => {
    if (isEmployee) {
      setCreateModalOpen(true);
      setCreateChoice('new');
      setSelectedTemplateId(''); // ensure dropdown shows placeholder when "Use template" is selected
    } else {
      navigate('/activity-form/add');
    }
  };

  const handleCreateChoiceTemplate = () => {
    setCreateChoice('template');
    setSelectedTemplateId(''); // reset so dropdown shows default "no selection" when switching to Use template
  };

  const handleUseTemplateContinue = useCallback(() => {
    if (createChoice === 'new') {
      setCreateModalOpen(false);
      navigate('/activity-form/add');
      return;
    }
    if (!selectedTemplateId) return;
    setCreateModalOpen(false);
    setSelectedTemplateId('');
    // Open edit page for that template; on save we will set QuestionnaireId null and SourceQuestionnaireId = template id
    navigate(`/activity-form/edit/${selectedTemplateId}`, {
      state: { saveAsFromTemplate: true },
    });
  }, [createChoice, selectedTemplateId, navigate]);

  const templateOptions = useMemo(
    () =>
      templateQuestionnaires.map((q) => ({
        value: q.questionnaireId,
        label: q.title ?? q.questionnaireId,
      })),
    [templateQuestionnaires]
  );

  const handleEditQuestionnaire = useCallback((row: QuestionnaireResponse) => {
    navigate(`/activity-form/edit/${row.questionnaireId}`);
  }, [navigate]);

  const handlePreviewQuestionnaire = useCallback((row: QuestionnaireResponse) => {
    navigate(`/activity-form/preview/${row.questionnaireId}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((row: QuestionnaireResponse) => {
    setDeletingQuestionnaire(row);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingQuestionnaire?.questionnaireId) {
      setDeletingQuestionnaire(null);
      return;
    }
    const id = deletingQuestionnaire.questionnaireId;
    try {
      await deleteActivityForm(id);
      dispatch(showToast(ACTIVITY_FORM.SUCCESS.FORM_DELETED, 'success'));
      setListRefreshKey((k) => k + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete activity form';
      dispatch(showToast(message, 'error'));
    }
    setDeletingQuestionnaire(null);
  }, [deletingQuestionnaire, dispatch]);

  const listColumns: DataTableColumn<QuestionnaireResponse>[] = useMemo(
    () => [
      {
        key: 'title',
        label: ACTIVITY_FORM.TABLE.FORM_NAME,
        render: (_value, row) => row.title ?? '-',
      },
      {
        key: 'actions',
        label: ACTIVITY_FORM.TABLE.ACTION,
        render: (_value, row) => (
          <div className="form-templates-page__actions data-table__cell--no-clamp">
            <SMSIconButton
              tone="info"
              size="small"
              allowWhenSuspended
              onClick={(e) => {
                e.stopPropagation();
                handlePreviewQuestionnaire(row);
              }}
              title={ACTIVITY_FORM.TABLE.PREVIEW}
              aria-label={ACTIVITY_FORM.TABLE.PREVIEW}
              className="form-templates-page__icon-btn"
            >
              <SMSIcon name="eye" size="sm" />
            </SMSIconButton>
            <SMSIconButton
              tone="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleEditQuestionnaire(row);
              }}
              title={ACTIVITY_FORM.TABLE.EDIT}
              aria-label={ACTIVITY_FORM.TABLE.EDIT}
              className="form-templates-page__icon-btn"
            >
              <SMSIcon name="edit" size="sm" />
            </SMSIconButton>
            <SMSIconButton
              tone="error"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(row);
              }}
              title={ACTIVITY_FORM.BUTTON.DELETE}
              aria-label={ACTIVITY_FORM.BUTTON.DELETE}
              className="form-templates-page__icon-btn"
            >
              <SMSIcon name="delete" size="sm" />
            </SMSIconButton>
          </div>
        ),
      },
    ],
    [handleDeleteClick, handleEditQuestionnaire, handlePreviewQuestionnaire]
  );

  return (
    <div className="form-templates-page">
      <div className="form-templates-page__header">
        <h1 className="form-templates-page__title">{ACTIVITY_FORM.TABLE.TITLE}</h1>
        <SMSButton
          onClick={handleAddClick}
          disabled={listLoading}
          className="form-templates-page__add-button"
          startIcon={<SMSIcon name="plus" size="sm" />}
        >
          {ACTIVITY_FORM.BUTTON.ADD_NEW}
        </SMSButton>
      </div>

      <div className="form-templates-page__table">
        {listError && (
          <div className="form-templates-page__error">{listError}</div>
        )}
        <SMSDataTableWrapper<QuestionnaireResponse>
          data={questionnaires}
          columns={listColumns}
          loading={listLoading}
          emptyMessage={ACTIVITY_FORM.TABLE.NO_DATA}
          searchable
          searchValue={localSearch}
          onSearchChange={setLocalSearch}
          searchAppliedOnServer
          searchPlaceholder="Search activity forms..."
          maxBodyHeight="max(320px, calc(100vh - 360px))"
          responsiveMode="table"
          showHeaderWhenEmpty
          renderEmptyAsTable
          pagination={{
            serverSide: userType === 'Admin',
            currentPage: listPagination.currentPage,
            pageSize: listPagination.pageSize,
            totalItems: listPagination.totalItems,
            onPageChange: (page) => listPagination.goToPage(page),
            onPageSizeChange: (newPageSize) => {
              listPagination.setPageSize(newPageSize);
              listPagination.goToFirstPage();
            },
          }}
        />
      </div>

      <SMSConfirmDialog
        open={!!deletingQuestionnaire}
        title={ACTIVITY_FORM.CONFIRM.DELETE_TITLE}
        message={ACTIVITY_FORM.CONFIRM.DELETE_MESSAGE}
        confirmText={ACTIVITY_FORM.CONFIRM.DELETE_CONFIRM}
        cancelText={ACTIVITY_FORM.CONFIRM.DELETE_CANCEL}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingQuestionnaire(null)}
        variant="error"
      />

      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={ACTIVITY_FORM.CREATE_OPTIONS.TITLE}
        size="small"
      >
        <div className="form-templates-page__create-options">
          <div className="form-templates-page__create-choices">
            <label className="form-templates-page__create-choice">
              <input
                type="radio"
                name="createOption"
                checked={createChoice === 'new'}
                onChange={() => setCreateChoice('new')}
              />
              <span>{ACTIVITY_FORM.CREATE_OPTIONS.CREATE_NEW_TEMPLATE}</span>
            </label>
            <label className="form-templates-page__create-choice">
              <input
                type="radio"
                name="createOption"
                checked={createChoice === 'template'}
                onChange={handleCreateChoiceTemplate}
              />
              <span>{ACTIVITY_FORM.CREATE_OPTIONS.USE_TEMPLATE}</span>
            </label>
          </div>
          {createChoice === 'template' && (
            <div className="form-templates-page__template-dropdown">
              <SMSDropdown
                label={ACTIVITY_FORM.CREATE_OPTIONS.SELECT_TEMPLATE}
                placeholder={
                  templateListLoading
                    ? 'Loading templates...'
                    : ACTIVITY_FORM.CREATE_OPTIONS.SELECT_TEMPLATE_PLACEHOLDER
                }
                options={templateOptions}
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(String(e.target.value || ''))}
                disabled={templateListLoading}
              />
              {templateQuestionnaires.length === 0 && !templateListLoading && (
                <p className="form-templates-page__no-templates">
                  {ACTIVITY_FORM.CREATE_OPTIONS.NO_TEMPLATES}
                </p>
              )}
            </div>
          )}
          <div className="form-templates-page__create-actions">
            <SMSButton onClick={() => setCreateModalOpen(false)}>
              {ACTIVITY_FORM.FORM.CANCEL_BUTTON}
            </SMSButton>
            <SMSButton
              onClick={handleUseTemplateContinue}
              disabled={createChoice === 'template' && !selectedTemplateId}
            >
              {ACTIVITY_FORM.CREATE_OPTIONS.CONTINUE}
            </SMSButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
