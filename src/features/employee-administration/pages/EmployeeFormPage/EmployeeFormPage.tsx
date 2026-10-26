import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { SMSBox, SMSLoader } from '@/components/smsatoms';
import { SMSFormPage } from '@/components/smsorganisms';
import { EmployeeForm } from '@/components/smsmolecules/EmployeeForm';
import { buildAvailableJobsLandingPathWithQuery } from '@/constants/availableJobsRouteTabs';
import { EMPLOYEE } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { bumpProfilePhotoRefresh } from '@/store/slices/authSlice';
import { fetchEmployees, fetchEmployeeByIdThunk, clearSelectedEmployee } from '@/store/slices/employeeSlice';
import { DEFAULT_TABLE_PAGE_SIZE } from '@/constants/tablePagination';
import { UserRoleType, hasRole } from '@/types/userRole';

function employeeIdsMatch(a: string | undefined, b: string | undefined): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return Boolean(x && y && x === y);
}

export const EmployeeFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const dispatch = useAppDispatch();
  
  // Get return path from location state or browser back
  const getReturnPath = (): string | number => {
    const state = location.state as { returnPath?: string } | null;
    if (state?.returnPath) return state.returnPath;
    return -1;
  };

  // Use Redux state
  const { selectedEmployee } = useAppSelector((state) => state.employee);
  const { user } = useAppSelector((state) => state.auth);
  const isEditMode = Boolean(id);
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const isOwnProfileEdit = Boolean(id && user?.employeeID && employeeIdsMatch(id, user.employeeID));
  const pageTitle =
    isEditMode && isDepartmentAdmin && isOwnProfileEdit
      ? EMPLOYEE.EDIT_DEPARTMENT_ADMIN_PROFILE_TITLE
      : isEditMode
      ? EMPLOYEE.EDIT_TITLE
      : EMPLOYEE.TITLE;

  useEffect(() => {
    if (!isEditMode || !id) {
      dispatch(clearSelectedEmployee());
      return;
    }
    dispatch(fetchEmployeeByIdThunk(id));
  }, [dispatch, isEditMode, id]);

  const handleSuccess = () => {
    if (user?.isLogo && id && employeeIdsMatch(id, user.employeeID)) {
      dispatch(bumpProfilePhotoRefresh());
    }
    // Refresh employees list (for when user goes back to list)
    dispatch(fetchEmployees({ page: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE }));
    const returnPath = getReturnPath();
    if (typeof returnPath === 'string') {
      navigate(returnPath);
      return;
    }

    // If we don't have an explicit return path, go to the main dashboard after
    // self-service profile edit; otherwise the employee list.
    if (returnPath === -1) {
      if (isOwnProfileEdit) {
        navigate(buildAvailableJobsLandingPathWithQuery(), { replace: true });
      } else {
        navigate('/personnel/employee');
      }
    } else {
      navigate(returnPath);
    }
  };

  const handleCancel = () => {
    const returnPath = getReturnPath();
    if (typeof returnPath === 'string') navigate(returnPath);
    else navigate(returnPath);
  };

  const editEmployeeReady =
    Boolean(id && selectedEmployee && employeeIdsMatch(selectedEmployee.employeeID, id));

  if (isEditMode && id && !editEmployeeReady) {
    return (
      <SMSFormPage title={pageTitle} onCancel={handleCancel}>
        <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <SMSLoader loadingText="Loading employee data..." aria-label="Loading employee data..." />
        </SMSBox>
      </SMSFormPage>
    );
  }

  try {

    try {
      return (
        <SMSFormPage
          title={pageTitle}
          subtitle={isEditMode ? undefined : EMPLOYEE.SUBTITLE}
          onCancel={handleCancel}
        >
          <EmployeeForm
            key={id ?? 'new'}
            initialData={selectedEmployee || null}
            departmentID={selectedEmployee?.departmentID}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </SMSFormPage>
      );
    } catch (error) {
      console.error('EmployeeFormPage: Error during render:', error);
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
          <h2>Error Loading Employee Form</h2>
          <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onClick={() => { const p = getReturnPath(); if (typeof p === 'string') navigate(p); else navigate(p); }}>Go Back</button>
        </div>
      );
    }
  } catch (error) {
    console.error('EmployeeFormPage: Error during render:', error);
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Error Loading Employee Form</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onClick={() => { const p = getReturnPath(); if (typeof p === 'string') navigate(p); else navigate(p); }}>Back to Employee List</button>
      </div>
    );
  }
};
