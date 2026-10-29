import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '@/features/auth/pages/Login';
import { EmployeeAutoLoginPage } from '@/features/auth/pages/EmployeeAutoLoginPage';
import { AppContent } from '@/components/AppContent';
import { SMSToastContainer } from '@/components/smsorganisms';
import { SMSIcon, SMSBox, SMSLoader } from '@/components/smsatoms';
import { MenuItem } from '@/types';
import { UserRoleType, hasRole } from '@/types/userRole';
import { MENU_ITEMS, AVAILABLE_POST, LOGIN } from '@/constants/strings';
import { HOLIDAY_DAY } from '@/constants/holidayDayStrings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  accessTokenRenewed,
  logout as logoutThunk,
  initializeAuth,
} from '@/store/slices/authSlice';
import { fetchDepartmentConfigByDepartmentId } from '@/store/slices/departmentConfigurationSlice';
import { registerAccessTokenRenewedCallback, registerUnauthorizedCallback } from '@/utils/apiClient';
import { SessionMonitorManager } from '@/components/smsmolecules/SessionTimeoutModal';
import { mergeMenuItems, filterMenuItemsById, normalizeAuditLogSectionChildOrder } from '@/utils/menuBuilder';
import {
  canAccessWatchCommanderReport,
  createRoleMenus,
  usesDepartmentScopedAuditList,
} from '@/utils/roleMenuContributions';
import './App.css';

function App() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, isInitialized, user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID ?? '';
  const departmentConfig = useAppSelector((state) =>
    departmentId ? state.departmentConfiguration.configByDepartmentId[departmentId] : null
  );
  const [loginType, setLoginType] = useState<'employee' | 'admin'>('employee');

  const showEmployeeOnly = user?.userType === 'Employee';
  const isSupervisorEmployeeType = user?.isSupervisor === true;
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const isOperator = hasRole(user?.roles, UserRoleType.Operator);
  const isRequesterManager = hasRole(user?.roles, UserRoleType.RequesterManager);
  const isHRAdmin = hasRole(user?.roles, UserRoleType.HRAdmin);
  const isIAAdmin = hasRole(user?.roles, UserRoleType.IAAdmin);
  const isRegularEmployee = hasRole(user?.roles, UserRoleType.RegularEmployee);
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);

  // Menu = union of every role the user has (merge by section id). Merge order: restricted roles first so
  // Employee Administration and Employee reference data appear before Request Administration for multi-role users.
  const roleMenus = createRoleMenus(SMSIcon, { MENU_ITEMS, AVAILABLE_POST, HOLIDAY_DAY }, user);
  let menuItems: MenuItem[] = [];
  if (isRegularEmployee) menuItems = mergeMenuItems(menuItems, roleMenus.regularEmployee());
  if (isHRAdmin) menuItems = mergeMenuItems(menuItems, roleMenus.hrAdmin());
  if (isIAAdmin) menuItems = mergeMenuItems(menuItems, roleMenus.iaAdmin());
  if (isDepartmentAdmin) menuItems = mergeMenuItems(menuItems, roleMenus.departmentAdmin({ showEmployeeOnly, isRegularEmployee }));
  if (isRequesterManager) menuItems = mergeMenuItems(menuItems, roleMenus.requesterManager());
  if (isOperator) menuItems = mergeMenuItems(menuItems, roleMenus.operator());
  if (isSuperUser) menuItems = mergeMenuItems(menuItems, roleMenus.superUser());
  if (menuItems.length === 0) menuItems = roleMenus.defaultMenu({ showEmployeeOnly });

  // Some sessions (e.g., regular-employee role with Comm Center admin type) do not get
  // a role menu that contributes Reports. Ensure Watch Commander appears when allowed.
  if (canAccessWatchCommanderReport(user)) {
    menuItems = mergeMenuItems(menuItems, [
      {
        id: 'reports-section',
        label: MENU_ITEMS.REPORTS,
        icon: <SMSIcon name="assessment" size="sm" />,
        path: '/reports/watch-commander-report',
        children: [
          {
            id: 'reports-watch-commander',
            label: MENU_ITEMS.WATCH_COMMANDER_REPORT,
            icon: <SMSIcon name="shield_person" size="sm" />,
            path: '/reports/watch-commander-report',
          } as MenuItem,
        ],
      } as MenuItem,
    ]);
  }

  // if (!isSuperUser) {
  //   menuItems = mergeMenuItems(menuItems, [
  //     {
  //       id: 'officer-working',
  //       label: MENU_ITEMS.OFFICER_WORKING,
  //       icon: <SMSIcon name="schedule" size="sm" />,
  //       path: '/reports/officer-working',
  //     } as MenuItem,
  //   ]);
  // }

  if (isSupervisorEmployeeType) {
    menuItems = mergeMenuItems(menuItems, [
      {
        id: 'personnel',
        label: MENU_ITEMS.PERSONNEL_ADMIN,
        icon: <SMSIcon name="employee" size="sm" />,
        path: '/personnel',
        children: [
          {
            id: 'employee-posts',
            label: MENU_ITEMS.EMPLOYEE_POSTS,
            icon: <SMSIcon name="briefcase" size="sm" />,
            path: '/personnel/employee-jobs',
          } as MenuItem,
        ],
      } as MenuItem,
    ]);
  }

  // Super users do not get the department Audit Log (including when merged with other roles).
  if (isSuperUser) {
    menuItems = filterMenuItemsById(menuItems, 'audit-log-section');
  }

  // Audit Log: only Dept Admin / IA Admin / Operator (department-scoped), not employee-kind or Fiscal.
  if (!usesDepartmentScopedAuditList(user)) {
    menuItems = filterMenuItemsById(menuItems, 'audit-log-section');
  }

  // Multi-role merge appends new Audit children at the end; keep Requester/Request first when present.
  menuItems = normalizeAuditLogSectionChildOrder(menuItems);

  // Hide "Department Policy" for plain employees when JWT EnablePolicyManagement is false.
  // Super User menu omits it (matches AppContent: super users cannot open /admin/department-policy).
  if (
    user?.userType === 'Employee' &&
    user?.enablePolicyManagement === false &&
    !isSuperUser &&
    !isDepartmentAdmin
  ) {
    menuItems = filterMenuItemsById(menuItems, 'department-policy');
  }

  // Department Defined Fields: show when JWT UseAgencyDefinedFields is true (employee login),
  // or when logging in via Admin portal as Department Admin — admin tokens omit that claim but
  // the page is still allowed; route guard uses department config when needed.
  const showDepartmentDefinedFieldsMenu =
    user?.useAgencyDefinedFields === true ||
    (user?.userType === 'Admin' && isDepartmentAdmin && user?.isSuperUser !== true);
  if (!showDepartmentDefinedFieldsMenu) {
    menuItems = filterMenuItemsById(menuItems, 'department-defined-fields');
  }

  // Employee Jobs: same gate as AppContent — supervisor employee type or Department Admin role.
  if (!isSupervisorEmployeeType && !isDepartmentAdmin) {
    menuItems = filterMenuItemsById(menuItems, 'employee-posts');
  }

  if (departmentConfig?.enableEmployeeLocation !== true) {
    menuItems = filterMenuItemsById(menuItems, 'mapping');
  }

  // Request Administration first in left panel whenever it is present
  const requestAdminIndex = menuItems.findIndex((item) => item.id === 'request-admin');
  if (requestAdminIndex > 0) {
    const [requestAdmin] = menuItems.splice(requestAdminIndex, 1);
    menuItems = [requestAdmin, ...menuItems];
  }

  // Dashboard (available-jobs) pinned at the very top whenever it is present
  const availableJobsIndex = menuItems.findIndex((item) => item.id === 'available-jobs');
  if (availableJobsIndex > 0) {
    const [availableJobs] = menuItems.splice(availableJobsIndex, 1);
    menuItems = [availableJobs, ...menuItems];
  }

  useEffect(() => {
    if (isAuthenticated && departmentId) dispatch(fetchDepartmentConfigByDepartmentId(departmentId));
  }, [dispatch, isAuthenticated, departmentId]);

  useEffect(() => {
    dispatch(initializeAuth());
    registerUnauthorizedCallback((reason) => {
      console.warn('Unauthorized access detected. Logging out...');
      dispatch(logoutThunk(reason === 'SESSION_REPLACED' ? LOGIN.SESSION_REPLACED : undefined));
    });
    registerAccessTokenRenewedCallback((session) => {
      dispatch(accessTokenRenewed(session));
    });

    return () => {
      registerUnauthorizedCallback(null);
      registerAccessTokenRenewedCallback(null);
    };
  }, [dispatch]);

  const handleLogin = () => {
    console.log('Login successful');
  };

  const handleSignOut = () => {
    dispatch(logoutThunk());
  };

  if (!isInitialized && isLoading) {
    return (
      <SMSBox
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <SMSLoader />
      </SMSBox>
    );
  }

  if (!isAuthenticated) {
    // Dedicated bootstrap page for superuser impersonation handoff.
    if (window.location.pathname.endsWith('/employee-auto-login')) {
      return <EmployeeAutoLoginPage />;
    }
    return (
      <Login
        onLogin={handleLogin}
        loginType={loginType}
        onLoginTypeChange={setLoginType}
      />
    );
  }

  return (
    <BrowserRouter basename="/sms/">
      <AppContent
        menuItems={menuItems}
        // onSignOut={handleSignOut}
      />
      <SMSToastContainer />
      <SessionMonitorManager />
    </BrowserRouter>
  );
}


export default App;


// Dev build trigger
