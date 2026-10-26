import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { SMSConfirmDialog } from '@/components/smsmolecules';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { RequesterManagerForm } from '@/components/smsmolecules/RequesterManagerForm';
import { RequesterEmployeeForm } from '@/components/smsmolecules/RequesterEmployeeForm';
import { SearchFilter } from '@/components/smsmolecules/SearchFilter';
import {
  fetchRequesterManagerList,
  createRequesterManagerThunk,
  updateRequesterManagerThunk,
  removeRequesterManager,
  clearError,
  setPagination,
} from '@/store/slices/requesterManagerSlice';
import {
  fetchRequesterEmployeesByManager,
  removeRequesterEmployee,
  clearError as clearRequesterEmployeeError,
  setError as setRequesterEmployeeError,
  setPagination as setEmployeePagination,
} from '@/store/slices/requesterEmployeeSlice';
import { fetchRequesterOptionsThunk } from '@/store/slices/requesterSlice';
import { fetchEmployees, fetchEmployeeByIdThunk } from '@/store/slices/employeeSlice';
import { getAvailableRequesterManagerEmployeeOptions } from '@/services/requesterManagerService';
import type { RequesterManager, RequesterManagerListProps, DisplayRequesterManager, RequestManagerResponseDto, ManagerOption } from '@/types/requesterManager';
import type { RequesterEmployee, RequestEmployeeResponseDto, RequesterEmployeeFormMode } from '@/types/requesterEmployee';
import { UserRoleType, hasRole } from '@/types/userRole';
import { REQUESTER_MANAGER, REQUESTER_EMPLOYEE, MESSAGES } from '@/constants/strings';
import { SMSButton, SMSIcon, SMSIconButton, SMSLoader, SMSPagination } from '@/components/smsatoms';
import { formatLastNameCommaFirstName } from '@/utils';
import './RequesterManagerList.css';

const getRequesterManagerIDFromRow = (row: RequesterManager | DisplayRequesterManager): string => {
  if (row.requesterManagerID && String(row.requesterManagerID).trim() !== '') {
    return String(row.requesterManagerID).trim();
  }
  const alt = (row as { privateJobManagerID?: string }).privateJobManagerID;
  if (alt != null && String(alt).trim() !== '') return String(alt).trim();
  return '';
};

export const RequesterManagerList: React.FC<RequesterManagerListProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { list: items, isLoading, error, totalItems, currentPage, pageSize } = useAppSelector((state) => state.requesterManager);
  const { byManagerID, loadingManagerID, currentPage: employeeCurrentPage, pageSize: employeePageSize } = useAppSelector(
    (state) => state.requesterEmployee
  );
  const rawRequesterOptions = useAppSelector((state) => state.requester.requesterOptions);
  const { employees } = useAppSelector((state) => state.employee);
  const { user } = useAppSelector((state) => state.auth);
  const canAddRequesterManager = hasRole(user?.roles, UserRoleType.DepartmentAdmin);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [managerFormMode, setManagerFormMode] =
    useState<'create' | 'edit'>('create');
  const [addFormInitialData, setAddFormInitialData] = useState<RequesterManager | null>(null);
  const [deletingRow, setDeletingRow] = useState<RequesterManager | null>(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeModalManager, setEmployeeModalManager] = useState<{
    requesterManagerID: string;
    managerID: string;
    managerName?: string;
  } | null>(null);
  const [employeeFormMode, setEmployeeFormMode] =
    useState<RequesterEmployeeFormMode>('create');
  const [employeeFormInitialData, setEmployeeFormInitialData] =
    useState<RequesterEmployee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<RequesterEmployee | null>(null);
  const [managerNameCache, setManagerNameCache] = useState<Record<string, string>>({});
  const requestedManagerIdsRef = useRef<Set<string>>(new Set());
  const [employeeOptions, setEmployeeOptions] = useState<ManagerOption[]>([]);
  const [isLoadingEmployeeOptions, setIsLoadingEmployeeOptions] = useState(false);

  const loadEmployeeOptions = async (requesterId: string) => {
    if (!requesterId.trim()) {
      setEmployeeOptions([]);
      return;
    }
    setIsLoadingEmployeeOptions(true);
    try {
      const options = await getAvailableRequesterManagerEmployeeOptions({ requesterId });
      setEmployeeOptions(
        options.map((opt) => ({ value: String(opt.id), label: opt.label }))
      );
    } catch {
      setEmployeeOptions([]);
    } finally {
      setIsLoadingEmployeeOptions(false);
    }
  };

  const requesterID =
    (location.state as { requesterId?: string } | null)?.requesterId ?? null;

  const requesterOptions = useMemo(
    () =>
      rawRequesterOptions.map((opt) => ({
        value: String(opt.id),
        label: opt.label || String(opt.id),
      })),
    [rawRequesterOptions]
  );

  const requesterName = useMemo(() => {
    if (!requesterID) return undefined;
    return requesterOptions.find((o) => o.value === requesterID)?.label;
  }, [requesterID, requesterOptions]);

  useEffect(() => {
    dispatch(fetchRequesterManagerList(requesterID ? { requesterId: requesterID, page: currentPage, pageSize } : { page: currentPage, pageSize }));
    dispatch(fetchEmployees({ page: 1, pageSize: 5000 }));
  }, [dispatch, requesterID, currentPage, pageSize]);

  useEffect(() => {
    dispatch(fetchRequesterOptionsThunk({}));
  }, [dispatch]);

  const employeeIdToName = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.employeeID) {
        const name = formatLastNameCommaFirstName(e.firstName, e.lastName);
        if (name) map.set(e.employeeID, name);
      }
    });
    return map;
  }, [employees]);

  const employeeIdToBadge = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.employeeID && e.badgeNumber) {
        map.set(e.employeeID, e.badgeNumber);
      }
    });
    return map;
  }, [employees]);

  const employeeIdToType = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => {
      if (e.employeeID && e.employeeType) {
        map.set(e.employeeID, e.employeeType);
      }
    });
    return map;
  }, [employees]);

  const itemsWithNames = useMemo<DisplayRequesterManager[]>(() => {
    return items.map((r: RequesterManager | RequestManagerResponseDto) => {
      const dto = r as RequestManagerResponseDto;
      const managerName =
        dto.employeeName?.trim() ||
        (r.employeeID ? employeeIdToName.get(r.employeeID) : undefined) ||
        (r.employeeID ? managerNameCache[r.employeeID] : undefined);
      return {
        ...r,
        isShared: Boolean(r.isRequestShared || r.isEmployeeShared || r.isShared),
        requesterName: requesterOptions.find((o) => o.value === r.requesterID)?.label || r.requesterID,
        employeeName: managerName || '',
        badgeNumber: (r.employeeID && employeeIdToBadge.get(r.employeeID)) || '',
        employeeType: (r.employeeID && employeeIdToType.get(r.employeeID)) || '',
      };
    });
  }, [items, requesterOptions, employeeIdToName, employeeIdToBadge, employeeIdToType, managerNameCache]);

  // On-demand fetch manager names for rows that only have employeeID (avoids loading 10k employees and fixes missing names)
  useEffect(() => {
    const missing = items.filter((r) => {
      const dto = r as RequestManagerResponseDto;
      const hasName = dto.employeeName?.trim() || (r.employeeID && employeeIdToName.get(r.employeeID)) || (r.employeeID && managerNameCache[r.employeeID]);
      return r.employeeID && !hasName && !requestedManagerIdsRef.current.has(r.employeeID);
    });
    if (missing.length === 0) return;
    const ids = [...new Set(missing.map((r) => r.employeeID))];
    ids.forEach((id) => requestedManagerIdsRef.current.add(id));
    Promise.all(ids.map((id) => dispatch(fetchEmployeeByIdThunk(id)).unwrap()))
      .then((emps) => {
        setManagerNameCache((prev) => {
          const next = { ...prev };
          emps.forEach((e) => {
            const name = formatLastNameCommaFirstName(e.firstName, e.lastName);
            if (e.employeeID) next[e.employeeID] = name || '';
          });
          return next;
        });
      })
      .catch(() => {});
  }, [items, employeeIdToName, managerNameCache, dispatch]);

  const handleGridPageChange = (page: number) => {
    dispatch(setPagination({ page }));
    setExpandedIndex(null);
  };

  const handleGridPageSizeChange = (newPageSize: number) => {
    dispatch(setPagination({ pageSize: newPageSize, page: 1 }));
    setExpandedIndex(null);
  };

  useEffect(() => {
    if (searchTerm) {
      // For search functionality, we'll need to implement server-side search
      // For now, reset to first page when searching
      dispatch(setPagination({ page: 1 }));
    }
  }, [searchTerm, dispatch]);

  const handleAddClick = () => {
    if (!canAddRequesterManager) return;
    dispatch(clearError());
    if (requesterID) {
      setAddFormInitialData({
        requesterManagerID: '',
        requesterID,
        employeeID: '',
        isShared: false,
        isRequestShared: false,
        isEmployeeShared: false,
        requesterEmployees: [],
        createdBy: null,
        editedBy: null,
        createdDate: null,
        editedDate: null,
      });
    } else {
      setAddFormInitialData(null);
    }
    setManagerFormMode('create');
    setIsModalOpen(true);
    if (requesterID) {
      void loadEmployeeOptions(requesterID);
    } else {
      setEmployeeOptions([]);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setAddFormInitialData(null);
    setEmployeeOptions([]);
    dispatch(clearError());
  };

  const handleFormSuccess = async (data: RequesterManager) => {
    try {
      dispatch(clearError());
      if (managerFormMode === 'create') {
        await dispatch(
          createRequesterManagerThunk({
            requesterID: data.requesterID,
            employeeID: data.employeeID || '',
            isRequestShared: data.isShared ? !!data.isRequestShared : false,
            isEmployeeShared: data.isShared ? !!data.isEmployeeShared : false,
          })
        ).unwrap();
      } else {
        await dispatch(
          updateRequesterManagerThunk({
            requesterManagerID: data.requesterManagerID,
            requesterID: data.requesterID,
            employeeID: data.employeeID || '',
            isRequestShared: data.isShared ? !!data.isRequestShared : false,
            isEmployeeShared: data.isShared ? !!data.isEmployeeShared : false,
          })
        ).unwrap();
      }
      dispatch(fetchRequesterManagerList(requesterID ? { requesterId: requesterID, page: currentPage, pageSize } : { page: currentPage, pageSize }));
      setIsModalOpen(false);
      setAddFormInitialData(null);
    } catch (error) {
      // Error is stored in Redux state and will be displayed in the form
      // Don't close modal so user can see the error
    }
  };

  const handleDeleteClick = (row: RequesterManager) => setDeletingRow(row);
  const handleDeleteConfirm = async () => {
    if (!deletingRow) return;
    try {
      await dispatch(removeRequesterManager(deletingRow.requesterManagerID)).unwrap();
      setDeletingRow(null);
    } catch {
      // Error in slice
    }
  };
  const handleDeleteCancel = () => setDeletingRow(null);

  const toggleExpand = useCallback(
    (rowIndex: number, row: RequesterManager) => {
      const requesterManagerID = getRequesterManagerIDFromRow(row);
      if (!requesterManagerID) {
        return;
      }
      const isOpening = expandedIndex !== rowIndex;
      setExpandedIndex((prev) => (prev === rowIndex ? null : rowIndex));
      if (isOpening) {
        dispatch(setPagination({ page: 1 }));
      }
      const cached = byManagerID[requesterManagerID];
      if (cached === undefined) {
        dispatch(fetchRequesterEmployeesByManager(requesterManagerID));
      }
    },
    [byManagerID, dispatch, expandedIndex]
  );

  const employeesForManager = useCallback(
    (row: RequesterManager): RequesterEmployee[] => {
      const requesterManagerID = getRequesterManagerIDFromRow(row);
      return requesterManagerID ? (byManagerID[requesterManagerID] ?? []) : [];
    },
    [byManagerID]
  );

  const handleAccordionPaginationChange = (payload: { page?: number; pageSize?: number }) => {
    dispatch(setEmployeePagination(payload));
  };

  const handleAddEmployeeClick = (row: DisplayRequesterManager) => {
    // requesterManagerID = link record ID (used by RequesterEmployee API)
    const requesterManagerID = getRequesterManagerIDFromRow(row);
    // employeeID = actual manager (employee) ID
    const employeeID = String(row.employeeID ?? '').trim();
    // Always open modal. If data is incomplete, show error inside modal.
    dispatch(clearRequesterEmployeeError());

    setEmployeeModalManager({
      requesterManagerID: requesterManagerID || '',
      managerID: employeeID || '',
      managerName: (row.employeeName ?? employeeID) || undefined,
    });
    setEmployeeFormMode('create');
    setEmployeeFormInitialData(null);
    setIsEmployeeModalOpen(true);

    if (!requesterManagerID) {
      dispatch(
        setRequesterEmployeeError(REQUESTER_MANAGER.ERRORS.REQUESTER_MANAGER_ID_MISSING)
      );
      return;
    }
    if (!employeeID) {
      dispatch(
        setRequesterEmployeeError(REQUESTER_MANAGER.ERRORS.EMPLOYEE_ID_MISSING)
      );
      return;
    }
  };

  const handleEditEmployeeClick = (emp: RequesterEmployee) => {
    const requesterManagerID = emp.requesterManagerID;
    const employeeID = String(emp.employeeID ?? '').trim();

    dispatch(clearRequesterEmployeeError());

    setEmployeeModalManager({
      requesterManagerID: requesterManagerID || '',
      managerID: employeeID || '',
      managerName: undefined,
    });
    setEmployeeFormMode('edit');
    setEmployeeFormInitialData(emp);

    setIsEmployeeModalOpen(true);
  };

  const handleEmployeeModalClose = () => {
    setIsEmployeeModalOpen(false);
    setEmployeeModalManager(null);
    setEmployeeFormInitialData(null);
    dispatch(clearRequesterEmployeeError());
  };

  const handleEmployeeFormSuccess = async () => {
    if (!employeeModalManager?.requesterManagerID) return;
    try {
      await dispatch(
        fetchRequesterEmployeesByManager(employeeModalManager.requesterManagerID)
      );
      setIsEmployeeModalOpen(false);
      setEmployeeModalManager(null);
      setEmployeeFormInitialData(null);
    } catch {
      // Error in slice
    }
  };

  const handleDeleteEmployeeClick = (emp: RequesterEmployee) => setDeletingEmployee(emp);
  const handleEditManagerClick = (row: DisplayRequesterManager) => {
    dispatch(clearError());
    setManagerFormMode('edit');
    setAddFormInitialData(row);
    setIsModalOpen(true);
  };
  const handleDeleteEmployeeConfirm = async () => {
    if (!deletingEmployee) return;
    try {
      await dispatch(removeRequesterEmployee(deletingEmployee.requesterEmployeeID)).unwrap();
      if (deletingEmployee.requesterManagerID) {
        await dispatch(fetchRequesterEmployeesByManager(deletingEmployee.requesterManagerID));
      }
      setDeletingEmployee(null);
    } catch {
      // Error in slice
    }
  };
  const handleDeleteEmployeeCancel = () => setDeletingEmployee(null);

  return (
    <div className={`requester-manager-list requester-manager-list--page ${className}`}>
      <div className="requester-manager-list__header">
        <button
          type="button"
          onClick={() => navigate(REQUESTER_MANAGER.REQUESTER_LIST_PATH)}
          className="requester-manager-list__back-button"
          aria-label="Back to Requester List"
        >
          <SMSIcon name="arrowLeft" size="md" />
        </button>
        <h1 className="requester-manager-list__title">{requesterName ? requesterName + ' - ' + REQUESTER_MANAGER.TABLE.TITLE : REQUESTER_MANAGER.TABLE.TITLE}</h1>
        {canAddRequesterManager && (
          <SMSButton
            onClick={handleAddClick}
            className="requester-manager-list__add-button"
          >
            <SMSIcon name="plus" size="sm" />
            {REQUESTER_MANAGER.BUTTON.ADD_NEW}
          </SMSButton>
        )}
      </div>

      <div className="requester-manager-list__search data-table__toolbar">
        <div className="data-table__search" style={{ maxWidth: '320px' }}>
          <SearchFilter
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={REQUESTER_MANAGER.SEARCH_PLACEHOLDER}
          />
        </div>
      </div>

      <div className="requester-manager-list__accordion">
        {isLoading ? (
          <div className="requester-manager-list__loading">
            <SMSLoader />
          </div>
        ) : items.length === 0 ? (
          <div className="requester-manager-list__empty">{REQUESTER_MANAGER.TABLE.NO_DATA}</div>
        ) : (
          itemsWithNames.map((row, index) => {
            const requesterManagerID = getRequesterManagerIDFromRow(row);
            const rowKey = requesterManagerID || `requester-manager-row-${index}`;
            const isExpanded = expandedIndex === index;
            const employees = employeesForManager(row);
            const isLoadingEmployees = loadingManagerID === requesterManagerID;
            return (
              <div key={rowKey} className="requester-manager-list__group" data-expanded={isExpanded}>
                <div className="requester-manager-list__row requester-manager-list__row--data">
                  <div
                    className="requester-manager-list__expand-btn"
                    onClick={() => toggleExpand(index, row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(index, row);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded
                        ? REQUESTER_MANAGER.COLLAPSE_EMPLOYEES
                        : REQUESTER_MANAGER.EXPAND_EMPLOYEES
                    }
                  >
                    <SMSIcon
                      name={isExpanded ? 'expand_more' : 'navigate_next'}
                      size="sm"
                    />
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--manager requester-manager-list__field">
                    <span className="level-2-request__data-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.MANAGER}
                    </span>
                    <span className="level-2-request__data-value">
                      {row.employeeName || row.employeeID || '-'}
                    </span>
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--badge requester-manager-list__field">
                    <span className="level-2-request__data-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.BADGE_NUMBER}
                    </span>
                    <span className="level-2-request__data-value">
                      {row.badgeNumber || '-'}
                    </span>
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--type requester-manager-list__field">
                    <span className="level-2-request__data-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.EMPLOYEE_TYPE}
                    </span>
                    <span className="level-2-request__data-value">
                      {row.employeeType || '-'}
                    </span>
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--shared requester-manager-list__field">
                    <span className="level-2-request__data-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.IS_EMPLOYEE_SHARED}
                    </span>
                    <span className="level-2-request__data-value">
                      {row.isEmployeeShared ? MESSAGES.YES : MESSAGES.NO}
                    </span>
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--shared requester-manager-list__field">
                    <span className="level-2-request__data-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.IS_REQUEST_SHARED}
                    </span>
                    <span className="level-2-request__data-value">
                      {row.isRequestShared ? MESSAGES.YES : MESSAGES.NO}
                    </span>
                  </div>
                  <div className="requester-manager-list__cell requester-manager-list__cell--actions requester-manager-list__field">
                    <span className="level-2-request__data-label requester-manager-list__actions-label">
                      {REQUESTER_MANAGER.TABLE.COLUMNS.ACTION}
                    </span>
                    <div className="requester-manager-list__actions">
                      <SMSIconButton
                        size="small"
                        tone="primary"
                        onClick={() => handleAddEmployeeClick(row)}
                        className="requester-manager-list__add-employee-button"
                        title={REQUESTER_EMPLOYEE.BUTTON.ADD_NEW}
                        aria-label={REQUESTER_EMPLOYEE.BUTTON.ADD_NEW}
                      >
                        <SMSIcon name="add" size="sm" />
                      </SMSIconButton>
                      <SMSIconButton
                        size="small"
                        tone="primary"
                        onClick={() => handleEditManagerClick(row)}
                        className="requester-manager-list__edit-button"
                        title={REQUESTER_MANAGER.BUTTON.EDIT}
                        aria-label={REQUESTER_MANAGER.BUTTON.EDIT}
                      >
                        <SMSIcon name="edit" size="sm" />
                      </SMSIconButton>
                      <SMSIconButton
                        size="small"
                        tone="error"
                        onClick={() => handleDeleteClick(row)}
                        className="requester-manager-list__delete-button"
                        title={REQUESTER_MANAGER.BUTTON.REMOVE}
                        aria-label={REQUESTER_MANAGER.BUTTON.REMOVE}
                      >
                        <SMSIcon name="delete" size="sm" />
                      </SMSIconButton>
                    </div>
                  </div>
                </div>
                <div className="requester-manager-list__employees">
                  {isExpanded && (
                    <>
                      {isLoadingEmployees ? (
                        <div className="requester-manager-list__employees-loading">
                          {REQUESTER_MANAGER.LOADING_EMPLOYEES}
                        </div>
                      ) : employees.length === 0 ? (
                        <div className="requester-manager-list__employees-empty">
                          {REQUESTER_EMPLOYEE.TABLE.NO_DATA}
                        </div>
                      ) : (
                        <>
                          <div className="requester-manager-list__employees-table">
                            <div className="requester-manager-list__employees-header">
                              <span className="requester-manager-list__employees-th requester-manager-list__employees-th--employee">
                                {REQUESTER_EMPLOYEE.TABLE.COLUMNS.EMPLOYEE_NAME}
                              </span>
                              <span className="requester-manager-list__employees-th requester-manager-list__employees-th--badge">
                                {REQUESTER_EMPLOYEE.TABLE.COLUMNS.BADGE_NUMBER}
                              </span>
                              <span className="requester-manager-list__employees-th requester-manager-list__employees-th--type">
                                {REQUESTER_EMPLOYEE.TABLE.COLUMNS.EMPLOYEE_TYPE}
                              </span>
                              <span className="requester-manager-list__employees-th requester-manager-list__employees-th--preferred">
                                {REQUESTER_EMPLOYEE.TABLE.COLUMNS.PREFERRED}
                              </span>
                              <span className="requester-manager-list__employees-th requester-manager-list__employees-th--action">
                                {REQUESTER_EMPLOYEE.TABLE.COLUMNS.ACTION}
                              </span>
                            </div>
                            {employees
                              .slice((employeeCurrentPage - 1) * employeePageSize, employeeCurrentPage * employeePageSize)
                              .map((emp, empIndex) => {
                                const dto = emp as RequestEmployeeResponseDto;
                                const displayName =
                                  dto.employeeName?.trim() || emp.employeeID?.trim() || '-';
                                const badge =
                                  (emp.employeeID && employeeIdToBadge.get(emp.employeeID)) || '';
                                const empType =
                                  (emp.employeeID && employeeIdToType.get(emp.employeeID)) || '';
                                const offset = (employeeCurrentPage - 1) * employeePageSize;
                                return (
                                  <div key={emp.requesterEmployeeID || `${rowKey}-employee-${offset + empIndex}`} className="requester-manager-list__employee-row">
                                    <span className="requester-manager-list__employees-td requester-manager-list__employees-td--employee">
                                      {displayName}
                                    </span>
                                    <span className="requester-manager-list__employees-td requester-manager-list__employees-td--badge">
                                      {badge || '-'}
                                    </span>
                                    <span className="requester-manager-list__employees-td requester-manager-list__employees-td--type">
                                      {empType || '-'}
                                    </span>
                                    <span className="requester-manager-list__employees-td requester-manager-list__employees-td--preferred">
                                      {emp.isPreferred ? MESSAGES.YES : MESSAGES.NO}
                                    </span>
                                    <div className="requester-manager-list__employees-td requester-manager-list__employees-td--action">
                                      <SMSIconButton
                                        size="small"
                                        tone="primary"
                                        onClick={() => handleEditEmployeeClick(emp)}
                                        className="requester-manager-list__edit-button"
                                        title={REQUESTER_EMPLOYEE.BUTTON.EDIT}
                                        aria-label={REQUESTER_EMPLOYEE.BUTTON.EDIT}
                                      >
                                        <SMSIcon name="edit" size="sm" />
                                      </SMSIconButton>
                                      <SMSIconButton
                                        size="small"
                                        tone="error"
                                        onClick={() => handleDeleteEmployeeClick(emp)}
                                        className="requester-manager-list__delete-button"
                                        title={REQUESTER_EMPLOYEE.BUTTON.REMOVE}
                                        aria-label={REQUESTER_EMPLOYEE.BUTTON.REMOVE}
                                      >
                                        <SMSIcon name="delete" size="sm" />
                                      </SMSIconButton>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                          {employees.length > 0 && (
                            <SMSPagination
                              className="requester-manager-list__employees-pagination sms-pagination"
                              variant="compact"
                              currentPage={employeeCurrentPage}
                              pageSize={employeePageSize}
                              totalItems={employees.length}
                              onPageChange={(page) => handleAccordionPaginationChange({ page })}
                              onPageSizeChange={(ps) => handleAccordionPaginationChange({ pageSize: ps })}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {items.length > 0 && (
        <SMSPagination
          className="requester-manager-list__grid-pagination sms-pagination"
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handleGridPageChange}
          onPageSizeChange={handleGridPageSizeChange}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title={managerFormMode === 'create' ? REQUESTER_MANAGER.TITLE : REQUESTER_MANAGER.EDIT_TITLE}
        size="large"
      >
        {error && (
          <div className="requester-manager-list__error" role="alert" style={{ marginBottom: '1rem', color: 'red' }}>
            {error}
          </div>
        )}
        <RequesterManagerForm
          mode={managerFormMode}
          initialData={addFormInitialData}
          requesterOptions={requesterOptions}
          employeeOptions={employeeOptions}
          isLoadingEmployeeOptions={isLoadingEmployeeOptions}
          onRequesterIdChange={loadEmployeeOptions}
          requesterID={requesterID ?? undefined}
          requesterName={requesterName}
          onSuccess={handleFormSuccess}
          onCancel={handleModalClose}
        />
      </Modal>

      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={handleEmployeeModalClose}
        title={REQUESTER_EMPLOYEE.TITLE}
        size="small"
      >
        {employeeModalManager?.requesterManagerID && employeeModalManager.managerID && (
          <RequesterEmployeeForm
            mode={employeeFormMode}
            initialData={employeeFormInitialData}
            managerID={employeeModalManager.managerID}
            managerName={employeeModalManager.managerName}
            requesterManagerID={employeeModalManager.requesterManagerID}
            onSuccess={handleEmployeeFormSuccess}
            onCancel={handleEmployeeModalClose}
          />
        )}
      </Modal>

      <SMSConfirmDialog
        open={!!deletingRow}
        title={REQUESTER_MANAGER.CONFIRM.DELETE_TITLE}
        message={REQUESTER_MANAGER.CONFIRM.DELETE_MESSAGE}
        confirmText={REQUESTER_MANAGER.CONFIRM.DELETE_CONFIRM}
        cancelText={REQUESTER_MANAGER.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteCancel}
        variant="error"
        loading={false}
      />

      <SMSConfirmDialog
        open={!!deletingEmployee}
        title={REQUESTER_EMPLOYEE.CONFIRM.DELETE_TITLE}
        message={REQUESTER_EMPLOYEE.CONFIRM.DELETE_MESSAGE}
        confirmText={REQUESTER_EMPLOYEE.CONFIRM.DELETE_CONFIRM}
        cancelText={REQUESTER_EMPLOYEE.CONFIRM.DELETE_CANCEL}
        onConfirm={handleDeleteEmployeeConfirm}
        onClose={handleDeleteEmployeeCancel}
        variant="error"
        loading={false}
      />
    </div>
  );
};
