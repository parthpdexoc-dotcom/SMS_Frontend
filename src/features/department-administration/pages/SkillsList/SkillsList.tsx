import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { usePagination } from '@/hooks/usePagination';
import { useMasterDataListStatusPagedParams } from '@/hooks/useMasterDataListStatusPagedParams';
import { useDebounce } from '@/hooks/useDebounceSearch';
import { ADD_SKILL } from '@/constants/strings';
import { SkillResponse } from '@/types/skill';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSkills, searchSkillsThunk } from '@/store/slices/skillSlice';
import { SkillForm } from '@/components/smsmolecules/SkillForm';
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';

const SKILLS_BASE = '/admin/skills';

export interface SkillsListProps {
  className?: string;
}

export const SkillsList: React.FC<SkillsListProps> = ({ className = '' }) => {
  const dispatch = useAppDispatch();
  const { skills, isLoading: isLoadingSkills, totalItems: totalItemsFromStore } = useAppSelector((state) => state.skill);
  const location = useLocation();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [urlFilters, , setSearchFilters] = useUrlFilters(['search']);
  const searchFromUrl = urlFilters.search ?? '';
  const [localSearch, setLocalSearch] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(localSearch, 500);

  const pagination = usePagination();
  const { statusFilter, handleStatusFilterChange, isActiveParam } = useMasterDataListStatusPagedParams(pagination);

  const refetchList = useCallback(() => {
    const searchTerm = debouncedSearch.trim();
    const params = {
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      ...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
      ...(searchTerm ? { searchTerm } : {}),
    };

    if (searchTerm.length > 0) {
      dispatch(searchSkillsThunk(params));
    } else {
      dispatch(fetchSkills(params));
    }
  }, [dispatch, pagination.currentPage, pagination.pageSize, isActiveParam, debouncedSearch]);

  useEffect(() => {
    refetchList();
  }, [refetchList]);

  useEffect(() => {
    pagination.setTotalItems(totalItemsFromStore);
  }, [totalItemsFromStore, pagination.setTotalItems]);

  useEffect(() => {
    setLocalSearch(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    if (debouncedSearch !== searchFromUrl) {
      pagination.goToFirstPage();
      setSearchFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, searchFromUrl, pagination, setSearchFilters]);

  const openModal = useMemo((): 'add' | string | null => {
    const pathname = location.pathname;
    if (pathname === `${SKILLS_BASE}/add`) return 'add';
    if (editId && pathname.startsWith(`${SKILLS_BASE}/edit/`)) return editId;
    return null;
  }, [location.pathname, editId]);

  const handleOpenAdd = () => navigate(`${SKILLS_BASE}/add`);
  const handleOpenEdit = (id: string) => navigate(`${SKILLS_BASE}/edit/${id}`);
  const handleModalClose = () => navigate(SKILLS_BASE);

  return (
    <SMSMasterDataShortLongStatusList<SkillResponse>
      className={className}
      getId={(r) => r.skillId}
      openModal={openModal}
      onOpenAdd={handleOpenAdd}
      onOpenEdit={handleOpenEdit}
      onModalClose={handleModalClose}
      strings={{
        TITLE: ADD_SKILL.TITLE,
        EDIT_TITLE: ADD_SKILL.EDIT_TITLE,
        TABLE: {
          TITLE: ADD_SKILL.TABLE.TITLE,
          NO_DATA: ADD_SKILL.TABLE.NO_DATA,
          FILTERS: ADD_SKILL.TABLE.FILTERS,
          COLUMNS: {
            TITLE: ADD_SKILL.TABLE.COLUMNS.TITLE,
            DESCRIPTION: ADD_SKILL.TABLE.COLUMNS.DESCRIPTION,
            STATUS: ADD_SKILL.TABLE.COLUMNS.STATUS,
            CREATED_BY: ADD_SKILL.TABLE.COLUMNS.CREATED_BY,
            EDITED_BY: ADD_SKILL.TABLE.COLUMNS.EDITED_BY,
            ACTION: ADD_SKILL.TABLE.COLUMNS.ACTION,
          },
        },
        BUTTON: {
          ADD_NEW: ADD_SKILL.BUTTON.ADD_NEW,
          EDIT: ADD_SKILL.BUTTON.EDIT,
        },
      }}
      controlledStatusFilter={statusFilter}
      onControlledStatusFilterChange={handleStatusFilterChange}
      items={skills}
      loading={isLoadingSkills}
      onRefresh={refetchList}
      serverPagination={{
        totalItems: pagination.totalItems,
        currentPage: pagination.currentPage,
        pageSize: pagination.pageSize,
        onPageChange: (page) => pagination.goToPage(page),
        onPageSizeChange: (newPageSize) => {
          pagination.setPageSize(newPageSize);
          pagination.goToFirstPage();
        },
      }}
      FormComponent={SkillForm}
      getShort={(r) => r.skillShort}
      getLong={(r) => r.skillLong}
      getStatus={(r) => Boolean(r.skillStatus)}
      getCreatedBy={(r) => r.createdBy}
      getCreatedDate={(r) => r.createdDate}
      getEditedBy={(r) => r.editedBy}
      getEditedDate={(r) => r.editedDate}
      showAuditColumns={false}
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
    />
  );
};
