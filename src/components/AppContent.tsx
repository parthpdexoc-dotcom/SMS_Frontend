import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { SMSLayout } from '@/components/smsorganisms';
import { AuditLogPage } from '@/features/employee-administration/pages/AuditLogPage';
import { JobPositionFlowAuditPage } from '@/features/employee-administration/pages/JobPositionFlowAuditPage';
import { SkillsList } from '@/features/department-administration/pages/SkillsList';
import { EquipmentTypeList } from '@/features/department-administration/pages/EquipmentTypeList';
import { BusinessTypeList } from '@/features/department-administration/pages/BusinessTypeList';
import { PaymentTypeList } from '@/features/department-administration/pages/PaymentTypeList';
import { PayCodeList } from '@/features/department-administration/pages/PayCodeList';
import { EmployeeStatusList } from '@/features/department-administration/pages/EmployeeStatusList';
import { EmployeeTypeList } from '@/features/department-administration/pages/EmployeeTypeList';
import { DepartmentDivisionList } from '@/features/department-administration/pages/DepartmentDivisionList';
import { DepartmentActivityTypeList } from '@/features/department-administration/pages/DepartmentActivityTypeList';
import { DepartmentEquipmentList } from '@/features/department-administration/pages/DepartmentEquipmentList';
import { DepartmentFeeList } from '@/features/department-administration/pages/DepartmentFeeList';
import { AdminTypeList } from '@/features/department-administration/pages/AdminTypeList';
import { DepartmentList } from '@/features/department-administration/pages/DepartmentList';
import { EmployeeList } from '@/features/employee-administration/pages/EmployeeList';
import { RequesterList } from '@/features/request-administration/pages/RequesterList';
import {
  EmployeeLocationListPage,
  EmployeeLocationPage,
} from '@/features/request-administration/pages/EmployeeLocation';
import { MasterMapPage } from '@/features/request-administration/pages/MasterMap';
import { ResponseAreaList } from '@/features/department-administration/pages/ResponseAreaList';
import { RoutingGroupList } from '@/features/department-administration/pages/RoutingGroupList';
import { BlockDateList } from '@/features/department-administration/pages/BlockDateList';
import { HolidayDayList } from '@/features/department-administration/pages/HolidayDayList';
import { DepartmentFormPage } from '@/features/department-administration/pages/DepartmentFormPage';
import { DepartmentConfigurationFormPage } from '@/features/department-administration/pages/DepartmentConfigurationFormPage';
import { DepartmentInvoiceConfigFormPage } from '@/features/department-administration/pages/DepartmentInvoiceConfigFormPage';
import { EmployeeFormPage } from '@/features/employee-administration/pages/EmployeeFormPage';
import { RequesterFormPage } from '@/features/request-administration/pages/RequesterFormPage';
import { VehicleApprovalPage } from '@/features/request-administration/pages/approvals/VehicleApprovalPage';
import { VehicleApprovalConfirmationPage } from '@/features/request-administration/pages/approvals/VehicleApprovalConfirmationPage';
import { SpecialEventApprovalPage } from '@/features/request-administration/pages/approvals/SpecialEventApprovalPage';
import { SpecialEventApprovalConfirmationPage } from '@/features/request-administration/pages/approvals/SpecialEventApprovalConfirmationPage';
import { RequestFormPage } from '@/features/request-administration/pages/RequestFormPage';
import { PostFormPage } from '@/features/request-administration/pages/PostFormPage';
import { PostPositionAssignmentsPage } from '@/features/request-administration/pages/PostPositionAssignmentsPage/PostPositionAssignmentsPage';
import { DepartmentDefinedFieldsList } from '@/features/department-administration/pages/DepartmentDefinedFieldsList';
import { DepartmentPolicyFormPage } from '@/features/department-administration/pages/DepartmentPolicyFormPage';
import { RequesterRestrictList } from '@/features/request-administration/pages/RequesterRestrictList';
import { RequesterManagerList } from '@/features/request-administration/pages/RequesterManagerList';
import { RequesterAuthorizedList } from '@/features/request-administration/pages/RequesterAuthorizedList';
import { InvoiceList } from '@/features/request-administration/pages/InvoiceList';
import { ReleaseSchedulePage } from '@/features/request-administration/pages/ReleaseSchedulePage';
import { RequestRosterPage } from '@/features/request-administration/pages/RequestRosterPage';
import { OpenJobsPage } from '@/features/request-administration/pages/OpenJobsPage';
import { TenureJobsPage, TenureJobsIndexRedirect } from '@/features/request-administration/pages/TenureJobsPage';
import {
  DailyWorkspaceListPage,
  DailyWorkspacePage,
  DailyWorkspaceFiltersProvider,
} from '@/features/request-administration/pages/DailyWorkspace';
import { ArchivedReportsPage } from '@/features/reports/pages/ArchivedReportsPage';
import { OffDutyReportPage } from '@/features/reports/pages/OffDutyReportPage';
import { WatchCommanderReportPage } from '@/features/reports/pages/WatchCommanderReportPage';
import { OfficerWorkingPage } from '@/features/reports/pages/OfficerWorkingPage';
import { RequesterPaymentPage } from '@/features/request-administration/pages/RequesterPaymentPage';
import { RequesterStatementPage } from '@/features/request-administration/pages/RequesterStatementPage';
import { RequesterEmployeeList } from '@/features/request-administration/pages/RequesterEmployeeList';
import { EmployeeDashboard } from '@/features/employee-administration/pages/EmployeeDashboard';
import { EmployeePostsPage } from '@/features/employee-administration/pages/EmployeePostsPage';
import { Settings } from '@/features/department-administration/pages/Settings';
import { SuperUserEditProfilePage } from '@/features/auth/pages/SuperUserEditProfile';
import { EmailTemplatesPage } from '@/features/department-administration/pages/EmailTemplatesPage';
import { EmailTemplateFormPage } from '@/features/department-administration/pages/EmailTemplateFormPage';
import { FormTemplatesPage } from '@/features/department-administration/pages/FormTemplatesPage';
import { ActivityFormPage } from '@/features/department-administration/pages/ActivityFormPage';
import { ForbiddenPage } from '@/features/errors/pages/ForbiddenPage';
import { MenuItem } from '@/types';
import { shouldHideSidebarOnFormPage } from '@/utils';
import { isSuspendedEmployeeActive } from '@/utils';
import { useAppSelector } from '@/store/hooks';
import { registerForbiddenCallback } from '@/utils/apiClient';
import { UserRoleType, hasRole } from '@/types/userRole';
import {
  AVAILABLE_JOBS_ROUTE_TAB_ID,
  buildAvailableJobsLandingPathWithQuery,
} from '@/constants/availableJobsRouteTabs';
import { canAccessWatchCommanderReport, usesDepartmentScopedAuditList } from '@/utils/roleMenuContributions';
import { getRequesterMenuItemIdForPath } from '@/utils/menuBuilder';

interface AppContentProps {
  menuItems: MenuItem[];
  onSignOut: () => void;
}

// Deep-link handler for Vehicle Approval routes (path-only, no query param names in URL):
// - Current: /sms/VehicleApproval/:requestId/:routingGroupId
// Redirects to the canonical /admin/vehicle-approval path with segment IDs only.
const VehicleApprovalRedirect: React.FC = () => {
  const { requestId, routingGroupId } = useParams<{
    requestId: string;
    routingGroupId: string;
  }>();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (requestId && routingGroupId) {
      navigate(`/admin/vehicle-approval/${requestId}/${routingGroupId}`, {
        replace: true,
      });
    } else {
      navigate('/admin/vehicle-approval', { replace: true });
    }
  }, [navigate, requestId, routingGroupId]);

  return null;
};

// Deep-link handler for Special Event Approval routes of the form:
// /sms/SpecialEventApproval/:requestId/:routingGroupId
// It captures the params, then redirects to the canonical
// /admin/special-event-approval route without exposing the IDs in the URL.
const SpecialEventApprovalRedirect: React.FC = () => {
  const { requestId, routingGroupId } = useParams<{
    requestId: string;
    routingGroupId: string;
  }>();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (requestId && routingGroupId) {
      navigate('/admin/special-event-approval', {
        replace: true,
        state: { requestId, routingGroupId },
      });
    } else {
      navigate('/admin/special-event-approval', { replace: true });
    }
  }, [navigate, requestId, routingGroupId]);

  return null;
};

const RequesterPaymentRoute: React.FC = () => {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const state = (location.state ?? {}) as {
    requesterId?: string;
    requesterName?: string | null;
    returnPath?: string;
    returnState?: unknown;
  };
  const requesterId = (state.requesterId ?? search.get('requesterId') ?? '').trim();
  const requesterName = state.requesterName ?? undefined;
  const returnPath = state.returnPath;
  const returnState = state.returnState;

  if (!requesterId) {
    return <Navigate to="/personnel/requester" replace />;
  }

  return (
    <RequesterPaymentPage
      requesterId={requesterId}
      requesterName={requesterName}
      returnPath={returnPath}
      returnState={returnState}
    />
  );
};

const RequesterStatementRoute: React.FC = () => {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const state = (location.state ?? {}) as {
    requesterId?: string;
    requesterName?: string | null;
    returnPath?: string;
    returnState?: unknown;
  };
  const requesterId = (state.requesterId ?? search.get('requesterId') ?? '').trim();
  const requesterName = state.requesterName ?? undefined;
  const returnPath = state.returnPath;
  const returnState = state.returnState;

  if (!requesterId) {
    return <Navigate to="/personnel/requester" replace />;
  }

  return (
    <RequesterStatementPage
      requesterId={requesterId}
      requesterName={requesterName}
      returnPath={returnPath}
      returnState={returnState}
    />
  );
};

// Deep link: /sms/PermitApproval/:requestId/:routingGroupId → /admin/permit-approval/:requestId/:routingGroupId
const PermitApprovalRedirect: React.FC = () => {
  const { requestId, routingGroupId } = useParams<{
    requestId: string;
    routingGroupId: string;
  }>();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (requestId && routingGroupId) {
      navigate(`/admin/permit-approval/${requestId}/${routingGroupId}`, {
        replace: true,
      });
    } else {
      navigate('/admin/permit-approval', { replace: true });
    }
  }, [navigate, requestId, routingGroupId]);

  return null;
};

/** Legacy `/personnel/post/*` → `/personnel/job/*` */
const RedirectLegacyPersonnelPostCreate: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  return requestId ? (
    <Navigate to={`/personnel/job/create/${requestId}`} replace />
  ) : (
    <Navigate to="/personnel/requester/manage" replace />
  );
};

const RedirectLegacyPersonnelPostEdit: React.FC = () => {
  const { requestId, postId } = useParams<{ requestId: string; postId: string }>();
  const { search, hash } = useLocation();
  return requestId && postId ? (
    <Navigate to={`/personnel/job/${requestId}/${postId}${search}${hash}`} replace />
  ) : (
    <Navigate to="/personnel/requester/manage" replace />
  );
};

const RedirectLegacyPostPositionAssignments: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const { search, hash } = useLocation();
  return postId ? (
    <Navigate to={`/personnel/job-position/${postId}/assignments-waiting-list${search}${hash}`} replace />
  ) : (
    <PostLoginDefaultRedirect />
  );
};

const RedirectLegacyEmployeePostsDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  return employeeId ? (
    <Navigate to={`/personnel/employee-jobs/${employeeId}`} replace />
  ) : (
    <Navigate to="/personnel/employee-jobs" replace />
  );
};

const NavigateToDepartmentDefinedFieldsRequest: React.FC = () => {
  const { departmentId } = useParams<{ departmentId: string }>();
  return <Navigate to={`/admin/department-defined-fields/${departmentId}/request`} replace />;
};

/** Redirects department admin from Settings to their department's defined fields (no :departmentId in URL). */
const NavigateToDepartmentDefinedFieldsForDeptAdmin: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID;
  if (departmentId) {
    return <Navigate to={`/admin/department-defined-fields/${departmentId}/request`} replace />;
  }
  return <Navigate to="/forbidden" replace />;
};

/** Redirects department admin from Settings to their department's invoice config (no :departmentId in URL). */
const NavigateToDepartmentInvoiceConfigForDeptAdmin: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const departmentId = user?.departmentID;
  if (departmentId) {
    return <Navigate to={`/admin/department-invoice-config/${departmentId}`} replace />;
  }
  return <Navigate to="/forbidden" replace />;
};

/** SuperUser → department list; everyone else → Available Jobs (default query). */
const PostLoginDefaultRedirect: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const isSuperUserSession =
    user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const to = isSuperUserSession ? '/admin/department' : buildAvailableJobsLandingPathWithQuery();
  return <Navigate to={to} replace />;
};

export const AppContent: React.FC<AppContentProps> = ({
  menuItems,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenuItemId, setActiveMenuItemId] = useState('personnel');
  const { user } = useAppSelector((state) => state.auth);
  const departmentConfig = useAppSelector((state) =>
    user?.departmentID ? state.departmentConfiguration.configByDepartmentId[user.departmentID] : null
  );
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const isOperator = hasRole(user?.roles, UserRoleType.Operator);
  const isRequesterManager = hasRole(user?.roles, UserRoleType.RequesterManager);
  const isHRAdmin = hasRole(user?.roles, UserRoleType.HRAdmin);
  const isIAAdmin = hasRole(user?.roles, UserRoleType.IAAdmin);
  const isRegularEmployee = hasRole(user?.roles, UserRoleType.RegularEmployee);
  const isDepartmentAdmin = hasRole(user?.roles, UserRoleType.DepartmentAdmin);
  const isSupervisorEmployeeType = user?.isSupervisor === true;
  const isRequesterManagerOnly =
    isRequesterManager && !isOperator && !isDepartmentAdmin && !isSuperUser && !isHRAdmin && !isIAAdmin;
  const isSuspendedActive = isSuspendedEmployeeActive(user);

  /** Operator may only access: dashboard, personnel (employees, requesters, requests, jobs), block date, requester restrict/manager, forbidden */
  const isOperatorAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (pathname.startsWith('/personnel/employee')) return true;
    if (pathname.startsWith('/personnel/requester')) return true;
    if (pathname.startsWith('/personnel/daily-workspace')) return true;
    if (pathname.startsWith('/personnel/employee-location')) return true;
    if (pathname.startsWith('/personnel/master-map')) return true;
    if (pathname.startsWith('/personnel/request')) return true;
    if (
      pathname.startsWith('/personnel/job') ||
      pathname.startsWith('/personnel/job-position') ||
      pathname.startsWith('/personnel/post') ||
      pathname.startsWith('/personnel/post-position')
    )
      return true;
    if (pathname === '/admin/block-date') return true;
    if (pathname === '/admin/requester-restrict') return true;
    if (pathname === '/admin/requester-manager') return true;
    if (pathname.startsWith('/admin/requester-invoice')) return true;
    if (pathname.startsWith('/admin/release-schedule')) return true;
    if (pathname.startsWith('/admin/requester-statement')) return true;
    if (pathname.startsWith('/admin/request-roster')) return true;
    if (pathname.startsWith('/admin/open-jobs')) return true;
    if (pathname.startsWith('/admin/tenure-jobs')) return true;
    if (pathname.startsWith('/reports')) return true;
    return false;
  };
  /** Requester Manager may only access: dashboard, requester (manage/close/daily tabs), request, job flows, block date, requester restrict/manager, forbidden */
  const isRequesterManagerAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (isRequesterManagerOnly && pathname === '/personnel/requester/add') return false;
    if (isRequesterManagerOnly && pathname.startsWith('/personnel/requester/edit/')) return false;
    if (isRequesterManagerOnly && pathname === '/admin/requester-restrict') return false;
    if (isRequesterManagerOnly && pathname.startsWith('/admin/requester-invoice')) return false;
    if (isRequesterManagerOnly && pathname.startsWith('/admin/requester-statement')) return false;
    if (isRequesterManagerOnly && pathname.startsWith('/admin/request-roster')) return false;
    if (pathname.startsWith('/personnel/requester')) return true;
    if (pathname.startsWith('/personnel/daily-workspace')) return true;
    if (pathname.startsWith('/personnel/employee-location')) return true;
    if (pathname.startsWith('/personnel/master-map')) return true;
    if (pathname.startsWith('/personnel/request')) return true;
    if (
      pathname.startsWith('/personnel/job') ||
      pathname.startsWith('/personnel/job-position') ||
      pathname.startsWith('/personnel/post') ||
      pathname.startsWith('/personnel/post-position')
    )
      return true;
    if (pathname === '/admin/block-date') return true;
    if (pathname === '/admin/requester-restrict') return true;
    if (pathname === '/admin/requester-manager') return true;
    if (pathname.startsWith('/admin/requester-invoice')) return true;
    if (pathname.startsWith('/admin/release-schedule')) return true;
    if (pathname.startsWith('/admin/requester-statement')) return true;
    if (pathname.startsWith('/admin/request-roster')) return true;
    return false;
  };
  /** HR Admin may only access: dashboard, employees, employee reference lists (type, division, status), forbidden */
  const isHRAdminAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (pathname.startsWith('/personnel/employee')) return true;
    // Allow HR Admin to access list + add/edit routes for employee reference data.
    if (pathname.startsWith('/employee/employee-type')) return true;
    if (pathname.startsWith('/employee/department-division')) return true;
    if (pathname.startsWith('/admin/employee-status')) return true;
    return false;
  };
  /** IA Admin: view-only; only list pages /personnel/employee and /personnel/requester (no add/edit/view form routes) */
  const isIAAdminAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (pathname === '/personnel/employee') return true;
    if (pathname.startsWith('/personnel/requester')) return true;
    if (pathname.startsWith('/personnel/daily-workspace')) return true;
    if (pathname.startsWith('/personnel/employee-location')) return true;
    if (pathname.startsWith('/personnel/master-map')) return true;
    if (pathname.startsWith('/admin/release-schedule')) return true;
    return false;
  };
  /** Regular Employee: only Employee Administration Dashboard (available posts) */
  const isRegularEmployeeAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (pathname.startsWith('/audit-log') || pathname === '/personnel/audit-log') return true;
    // Allow /available-jobs routes.
    if (
      pathname === '/available-jobs' ||
      pathname.startsWith('/available-jobs/')
    ) {
      return true;
    }
    // Allow regular employees to open their employee edit screen.
    if (pathname.startsWith('/personnel/employee/edit/')) return true;
    // Allow profile entry route from header menu.
    if (pathname === '/settings/edit-profile') return true;
    return false;
  };
  /** SuperUser: Admin Types, Departments (list/config only), Settings, Email Templates. No department-defined-fields, -policy, -invoice-config. */
  const isSuperUserAllowedPath = (pathname: string): boolean => {
    if (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/available-jobs') ||
      pathname === '/forbidden'
    )
      return true;
    if (pathname === '/admin/admin-type') return true;
    if (pathname.startsWith('/admin/department-defined-fields')) return false;
    if (pathname.startsWith('/admin/department-policy')) return false;
    if (pathname.startsWith('/admin/department-invoice-config')) return false;
    if (pathname.startsWith('/admin/department')) return true;
    if (pathname === '/personnel/employee') return true;
    if (pathname.startsWith('/personnel/employee/add')) return true;
    if (pathname.startsWith('/personnel/employee/edit/')) return true;
    if (pathname.startsWith('/settings')) return true;
    if (pathname.startsWith('/activity-form')) return true;
    if (pathname.startsWith('/email-templates')) return true;
    return false;
  };
  /** Department Admin (default): allow department-defined-fields, -policy, -invoice-config; block department list and email-templates */
  const isDefaultAllowedPath = (pathname: string): boolean => {
    if (pathname === '/admin/admin-type') return false;
    if (pathname.startsWith('/email-templates')) return false;
    if (pathname.startsWith('/admin/department-defined-fields')) {
      if (departmentConfig && departmentConfig.useAgencyDefinedFields === false) return false;
      return true;
    }
    if (pathname.startsWith('/admin/department-policy')) return true;
    if (pathname.startsWith('/admin/department-invoice-config')) return true;
    if (pathname.startsWith('/admin/department')) return false;
    if (pathname.startsWith('/admin/open-jobs') || pathname.startsWith('/admin/tenure-jobs')) {
      return isDepartmentAdmin;
    }
    return true;
  };
  /** Path allowed if ANY of the user's roles allow it (supports multiple roles) */
  const userHasRestrictedRole = isOperator || isRequesterManager || isHRAdmin || isIAAdmin || isRegularEmployee;
  const isPathAllowedForUser = (pathname: string): boolean => {
    if (
      (pathname.startsWith('/personnel/master-map') || pathname.startsWith('/personnel/employee-location')) &&
      departmentConfig !== undefined &&
      departmentConfig?.enableEmployeeLocation !== true
    ) {
      return false;
    }
    if (pathname.startsWith('/reports/officer-working')) {
      return !isSuperUser;
    }
    if (pathname.startsWith('/reports/watch-commander-report')) {
      return canAccessWatchCommanderReport(user);
    }
    if (
      pathname === '/personnel/employee-jobs' ||
      pathname.startsWith('/personnel/employee-jobs/') ||
      pathname === '/personnel/employee-posts' ||
      pathname.startsWith('/personnel/employee-posts/')
    ) {
      return isSupervisorEmployeeType || isDepartmentAdmin;
    }
    if (pathname.startsWith('/audit-log') || pathname === '/personnel/audit-log') {
      if (isSuperUser) return pathname === '/audit-log/email-template';
      return usesDepartmentScopedAuditList(user);
    }
    return (
      (isSuperUser && isSuperUserAllowedPath(pathname)) ||
      (isOperator && isOperatorAllowedPath(pathname)) ||
      (isRequesterManager && isRequesterManagerAllowedPath(pathname)) ||
      (isHRAdmin && isHRAdminAllowedPath(pathname)) ||
      (isIAAdmin && isIAAdminAllowedPath(pathname)) ||
      (isRegularEmployee && isRegularEmployeeAllowedPath(pathname)) ||
      ((isDepartmentAdmin || (!userHasRestrictedRole && !isSuperUser)) && isDefaultAllowedPath(pathname))
    );
  };

  /**
   * For deep-linked VehicleApproval routes (internal pathname "/VehicleApproval/:requestId/:routingGroupId"
   * when Router basename is "/sms"), evaluate permissions against the canonical admin route
   * "/admin/vehicle-approval". This keeps role-based access checks consistent whether the user
   * navigates via the menu or via an emailed deep link.
   */
  const effectivePathnameForRoleCheck =
    location.pathname.startsWith('/VehicleApproval/')
      ? '/admin/vehicle-approval'
      : location.pathname.startsWith('/SpecialEventApproval/')
      ? '/admin/special-event-approval'
      : location.pathname.startsWith('/PermitApproval/')
      ? '/admin/permit-approval'
      : location.pathname;

  // Vehicle/Special Event Approval pages are accessible to all roles (no restrictions)
  const bypassRoleCheck =
    effectivePathnameForRoleCheck === '/admin/vehicle-approval' ||
    effectivePathnameForRoleCheck === '/admin/special-event-approval' ||
    effectivePathnameForRoleCheck === '/admin/permit-approval' ||
    effectivePathnameForRoleCheck.startsWith(
      '/admin/vehicle-approval/confirmation'
    ) ||
    /^\/admin\/vehicle-approval\/[^/]+\/[^/]+$/.test(effectivePathnameForRoleCheck) ||
    effectivePathnameForRoleCheck.startsWith(
      '/admin/special-event-approval/confirmation'
    ) ||
    effectivePathnameForRoleCheck.startsWith('/admin/permit-approval/confirmation') ||
    /^\/admin\/permit-approval\/[^/]+\/[^/]+$/.test(effectivePathnameForRoleCheck);

  const showForbidden = bypassRoleCheck
    ? false
    : !isPathAllowedForUser(effectivePathnameForRoleCheck); 

  const handleMenuItemClick = (item: MenuItem) => {
    setActiveMenuItemId(item.id);
    if (item.path) {
      // Clear stale route state so list pages (e.g. requester invoice) do not keep
      // context from a prior drill-in navigation on the same path.
      navigate(item.path, { state: null });
    }
  };

  // Check if current route is a form page (should hide sidebar)
  // Form pages are routes that end with /add or match /edit/:id pattern
  // But NOT list pages like /admin/skills
  // Also keep sidebar visible for department and requester form pages
  const isFormPage = shouldHideSidebarOnFormPage(location.pathname);

  // When any API returns 403 Forbidden, navigate to the forbidden page
  React.useEffect(() => {
    registerForbiddenCallback(() => {
      navigate('/forbidden');
    });
  }, [navigate]);

  // Update active menu item based on current route (pathname + search for tab query)
  React.useEffect(() => {
    const currentPath = location.pathname + (location.search || '');
    const pathnameOnly = currentPath.split('?')[0];

    const requesterMenuId = getRequesterMenuItemIdForPath(pathnameOnly);
    if (requesterMenuId) {
      setActiveMenuItemId(requesterMenuId);
      return;
    }

    const findMenuItemByPath = (items: MenuItem[], path: string): string | null => {
      const pathBase = path.split('?')[0];

      // Routes whose URL does not match a menu path (e.g. payment history under /admin).
      if (pathnameOnly === '/admin/requester-payment') return 'requester';
      if (pathnameOnly === '/admin/requester-statement') return 'requester';
      if (pathnameOnly === '/admin/requester-invoice') return 'requester-invoice';

      // First, check children (nested routes) - prioritize child matches
      for (const item of items) {
        if (item.children) {
          const childMatch = findMenuItemByPath(item.children, path);
          if (childMatch) {
            return childMatch;
          }
        }
      }

      // Exact path match (supports paths e.g. /personnel/requester/manage, /personnel/requester/daily)
      for (const item of items) {
        if (item.path === path) {
          return item.id;
        }
      }

      // Exact base-path match ignoring query string
      for (const item of items) {
        if (!item.path) continue;
        const itemPathBase = item.path.split('?')[0];
        if (itemPathBase === pathBase) {
          return item.id;
        }
      }

      // Partial matches for form pages under a menu item (skip bare /admin — too broad)
      for (const item of items) {
        const itemPathBase = item.path?.split('?')[0];
        if (item.path && pathBase.startsWith(itemPathBase + '/')) {
          return item.id;
        }
      }

      return null;
    };

    const activeId = findMenuItemByPath(menuItems, currentPath);
    if (activeId) {
      setActiveMenuItemId(activeId);
    }
  }, [location.pathname, location.search, menuItems]);

  return (
    <SMSLayout
      menuItems={menuItems}
      activeMenuItemId={activeMenuItemId}
      onMenuItemClick={handleMenuItemClick}
      onSignOut={onSignOut}
      hideSidebar={isFormPage}
      disableSidebar={isSuspendedActive}
    >
      {showForbidden ? (
        <ForbiddenPage />
      ) : (
      <Routes>
        <Route path="/dashboard" element={<PostLoginDefaultRedirect />} />
        <Route path="/admin/skills" element={<SkillsList />} />
        <Route path="/admin/skills/add" element={<SkillsList />} />
        <Route path="/admin/skills/edit/:id" element={<SkillsList />} />
        <Route path="/admin/equipment-type" element={<EquipmentTypeList />} />
        <Route path="/admin/equipment-type/add" element={<EquipmentTypeList />} />
        <Route path="/admin/equipment-type/edit/:id" element={<EquipmentTypeList />} />
        <Route path="/admin/business-type" element={<BusinessTypeList />} />
        <Route path="/admin/business-type/add" element={<BusinessTypeList />} />
        <Route path="/admin/business-type/edit/:id" element={<BusinessTypeList />} />
        <Route path="/admin/payment-type" element={<PaymentTypeList />} />
        <Route path="/admin/payment-type/add" element={<PaymentTypeList />} />
        <Route path="/admin/payment-type/edit/:id" element={<PaymentTypeList />} />
        <Route path="/employee/pay-code" element={<PayCodeList />} />
        <Route path="/employee/pay-code/add" element={<PayCodeList />} />
        <Route path="/employee/pay-code/edit/:id" element={<PayCodeList />} />
        <Route path="/admin/employee-status" element={<EmployeeStatusList />} />
        <Route path="/admin/employee-status/add" element={<EmployeeStatusList />} />
        <Route path="/admin/employee-status/edit/:id" element={<EmployeeStatusList />} />
        <Route
          path="/personnel/employee"
          element={<EmployeeList />}
        />
        <Route path="/personnel/employee-jobs" element={<EmployeePostsPage />} />
        <Route path="/personnel/employee-jobs/:employeeId" element={<EmployeePostsPage />} />
        <Route path="/personnel/employee-posts" element={<Navigate to="/personnel/employee-jobs" replace />} />
        <Route path="/personnel/employee-posts/:employeeId" element={<RedirectLegacyEmployeePostsDetail />} />
        <Route path="/personnel/audit-log" element={<Navigate to="/audit-log/request" replace />} />
        <Route path="/audit-log" element={<Navigate to="/audit-log/request" replace />} />
        <Route path="/audit-log/job-position-flow" element={<JobPositionFlowAuditPage />} />
        <Route path="/audit-log/:auditTable" element={<AuditLogPage />} />
        <Route path="/employee/response-area" element={<ResponseAreaList />} />
        <Route path="/employee/response-area/add" element={<ResponseAreaList />} />
        <Route path="/employee/response-area/edit/:id" element={<ResponseAreaList />} />
        <Route path="/employee/employee-type" element={<EmployeeTypeList />} />
        <Route path="/employee/employee-type/add" element={<EmployeeTypeList />} />
        <Route path="/employee/employee-type/edit/:id" element={<EmployeeTypeList />} />
        <Route path="/employee/department-division" element={<DepartmentDivisionList />} />
        <Route path="/employee/department-division/add" element={<DepartmentDivisionList />} />
        <Route path="/employee/department-division/edit/:id" element={<DepartmentDivisionList />} />
        <Route path="/employee/department-activity-type" element={<DepartmentActivityTypeList />} />
        <Route path="/employee/department-activity-type/add" element={<DepartmentActivityTypeList />} />
        <Route path="/employee/department-activity-type/edit/:id" element={<DepartmentActivityTypeList />} />
        <Route path="/employee/department-equipment" element={<DepartmentEquipmentList />} />
        <Route path="/employee/department-equipment/add" element={<DepartmentEquipmentList />} />
        <Route path="/employee/department-equipment/edit/:id" element={<DepartmentEquipmentList />} />
        <Route path="/employee/department-fee" element={<DepartmentFeeList />} />
        <Route path="/employee/department-fee/add" element={<DepartmentFeeList />} />
        <Route path="/employee/department-fee/edit/:id" element={<DepartmentFeeList />} />
        <Route
          path="/admin/admin-type"
          element={isSuperUser ? <AdminTypeList /> : <ForbiddenPage />}
        />
        <Route
          path="/admin/department"
          element={isSuperUser ? <DepartmentList /> : <ForbiddenPage />}
        />
        <Route
          path="/admin/department/add"
          element={isSuperUser ? <DepartmentFormPage /> : <ForbiddenPage />}
        />
        <Route
          path="/admin/department/edit/:id"
          element={isSuperUser ? <DepartmentFormPage /> : <ForbiddenPage />}
        />
        <Route
          path="/admin/department-configuration"
          element={<Navigate to="/admin/department-configuration/add" replace />}
        />
        <Route
          path="/admin/department-configuration/add"
          element={<DepartmentConfigurationFormPage />}
        />
        <Route
          path="/admin/department-configuration/edit/:id"
          element={<DepartmentConfigurationFormPage />}
        />
        <Route
          path="/admin/department-configuration/:departmentId"
          element={<DepartmentConfigurationFormPage />}
        />
        <Route
          path="/admin/department-invoice-config"
          element={<NavigateToDepartmentInvoiceConfigForDeptAdmin />}
        />
        <Route
          path="/admin/department-invoice-config/:departmentId"
          element={<DepartmentInvoiceConfigFormPage />}
        />
        <Route
          path="/admin/department-policy"
          element={<DepartmentPolicyFormPage />}
        />
        <Route
          path="/admin/department-policy/:departmentId"
          element={<DepartmentPolicyFormPage />}
        />
        <Route
          path="/admin/department-defined-fields"
          element={<NavigateToDepartmentDefinedFieldsForDeptAdmin />}
        />
        <Route path="/admin/department-defined-fields/:departmentId" element={<NavigateToDepartmentDefinedFieldsRequest />} />
        <Route path="/admin/department-defined-fields/:departmentId/:tab" element={<DepartmentDefinedFieldsList />} />
        <Route
          path="/admin/requester-restrict"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequesterRestrictList />}
        />
        <Route
          path="/admin/requester-manager"
          element={<RequesterManagerList />}
        />
        <Route
          path="/admin/requester-authorized"
          element={<RequesterAuthorizedList />}
        />
        <Route
          path="/admin/requester-invoice"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <InvoiceList />}
        />
        <Route path="/admin/release-schedule" element={<ReleaseSchedulePage />} />
        <Route
          path="/admin/request-roster"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequestRosterPage />}
        />
        <Route
          path="/admin/requester-payment"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequesterPaymentRoute />}
        />
        <Route
          path="/admin/requester-statement"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequesterStatementRoute />}
        />
        <Route path="/admin/open-jobs" element={<OpenJobsPage />} />
        <Route path="/admin/tenure-jobs/:startDate/:endDate" element={<TenureJobsPage />} />
        <Route path="/admin/tenure-jobs" element={<TenureJobsIndexRedirect />} />
        <Route path="/reports/archived-reports" element={<ArchivedReportsPage />} />
        <Route path="/reports/off-duty-report" element={<OffDutyReportPage />} />
        <Route path="/reports/watch-commander-report" element={<WatchCommanderReportPage />} />
        <Route path="/reports/officer-working" element={<OfficerWorkingPage />} />
        <Route
          path="/admin/requester-employee"
          element={<RequesterEmployeeList />}
        />
        <Route
          path="/personnel/employee/add"
          element={<EmployeeFormPage />}
        />
        <Route
          path="/personnel/employee/edit/:id"
          element={<EmployeeFormPage />}
        />
        <Route path="/personnel/daily-workspace" element={<DailyWorkspaceFiltersProvider />}>
          <Route index element={<DailyWorkspaceListPage />} />
          <Route path=":requesterId/*" element={<DailyWorkspacePage />} />
        </Route>
        <Route path="/personnel/master-map" element={<MasterMapPage />} />
        <Route path="/personnel/employee-location" element={<DailyWorkspaceFiltersProvider />}>
          <Route index element={<EmployeeLocationListPage />} />
          <Route path=":requesterId" element={<EmployeeLocationPage />} />
        </Route>
        <Route path="/personnel/requester" element={<Navigate to="/personnel/requester/manage" replace />} />
        <Route
          path="/personnel/requester/add"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequesterFormPage />}
        />
        <Route path="/personnel/requester/view/:id" element={<RequesterFormPage />} />
        <Route
          path="/personnel/requester/edit/:id"
          element={isRequesterManagerOnly ? <ForbiddenPage /> : <RequesterFormPage />}
        />
        <Route
          path="/personnel/requester/:tab/:requesterId/request/:requestId/roster"
          element={<RequesterList />}
        />
        {/* The merged "Closed/Unclosed Assignment" tab keeps its inner pill in the URL path
            (e.g. /personnel/requester/close-unclosed/closed) so deep links survive refresh. */}
        <Route path="/personnel/requester/close-unclosed/:subtab" element={<RequesterList />} />
        <Route path="/personnel/requester/:tab" element={<RequesterList />} />
        <Route
          path="/personnel/request/add/:requesterId?"
          element={<RequestFormPage />}
        />
        <Route
          path="/personnel/request/edit/:id"
          element={<RequestFormPage />}
        />
        <Route path="/personnel/job/create/:requestId" element={<PostFormPage />} />
        <Route path="/personnel/job/:requestId/:postId" element={<PostFormPage />} />
        <Route
          path="/personnel/job-position/:postId/assignments-waiting-list"
          element={<PostPositionAssignmentsPage />}
        />
        <Route path="/personnel/post/create/:requestId" element={<RedirectLegacyPersonnelPostCreate />} />
        <Route path="/personnel/post/:requestId/:postId" element={<RedirectLegacyPersonnelPostEdit />} />
        <Route
          path="/personnel/post-position/:postId/assignments-waiting-list"
          element={<RedirectLegacyPostPositionAssignments />}
        />
        <Route path="/admin/routing-group" element={<RoutingGroupList />} />
        <Route path="/admin/routing-group/add" element={<RoutingGroupList />} />
        <Route path="/admin/routing-group/edit/:id" element={<RoutingGroupList />} />
        <Route
          path="/admin/block-date"
          element={<BlockDateList />}
        />
        <Route path="/admin/holiday-day" element={<HolidayDayList />} />
        <Route path="/admin/holiday-day/add" element={<HolidayDayList />} />
        <Route path="/admin/holiday-day/edit/:id" element={<HolidayDayList />} />
        <Route
          path="/admin/vehicle-approval"
          element={<VehicleApprovalPage />}
        />
        <Route
          path="/admin/vehicle-approval/:requestId/:routingGroupId"
          element={<VehicleApprovalPage />}
        />
        <Route
          path="/admin/vehicle-approval/confirmation"
          element={<VehicleApprovalConfirmationPage />}
        />
        <Route
          path="/admin/permit-approval"
          element={<VehicleApprovalPage />}
        />
        <Route
          path="/admin/permit-approval/:requestId/:routingGroupId"
          element={<VehicleApprovalPage />}
        />
        <Route
          path="/admin/permit-approval/confirmation"
          element={<VehicleApprovalConfirmationPage />}
        />
        <Route
          path="/admin/special-event-approval"
          element={<SpecialEventApprovalPage />}
        />
        <Route
          path="/admin/special-event-approval/confirmation"
          element={<SpecialEventApprovalConfirmationPage />}
        />
        {/* Deep link: /sms/VehicleApproval/<requestId>/<routingGroupId> */}
        <Route
          path="/VehicleApproval/:requestId/:routingGroupId"
          element={<VehicleApprovalRedirect />}
        />
        {/* Deep link: /sms/SpecialEventApproval/<requestId>/<routingGroupId>
            When using a Router basename of "/sms", the internal path
            is "/SpecialEventApproval/:requestId/:routingGroupId". */}
        <Route
          path="/SpecialEventApproval/:requestId/:routingGroupId"
          element={<SpecialEventApprovalRedirect />}
        />
        <Route
          path="/PermitApproval/:requestId/:routingGroupId"
          element={<PermitApprovalRedirect />}
        />
        <Route
          path="/activity-form"
          element={<FormTemplatesPage />}
        />
        <Route
          path="/activity-form/add"
          element={<ActivityFormPage />}
        />
        <Route
          path="/activity-form/edit/:id"
          element={<ActivityFormPage />}
        />
        <Route
          path="/activity-form/preview/:id"
          element={<ActivityFormPage />}
        />
        <Route
          path="/settings"
          element={isDepartmentAdmin ? <Navigate to="/settings/edit-profile" replace /> : <Settings />}
        />
        <Route
          path="/settings/edit-profile"
          element={
            isDepartmentAdmin ? (
              <DepartmentFormPage />
            ) : isRegularEmployee ? (
              user?.employeeID ? (
                <Navigate to={`/personnel/employee/edit/${user.employeeID}`} replace />
              ) : (
                <ForbiddenPage />
              )
            ) : (
              <ForbiddenPage />
            )
          }
        />
        <Route
          path="/settings/edit-admin-profile"
          element={isSuperUser ? <SuperUserEditProfilePage /> : <ForbiddenPage />}
        />
        <Route
          path="/email-templates"
          element={isSuperUser ? <EmailTemplatesPage /> : <ForbiddenPage />}
        />
        <Route
          path="/email-templates/add"
          element={isSuperUser ? <EmailTemplateFormPage /> : <ForbiddenPage />}
        />
        <Route
          path="/email-templates/edit"
          element={<Navigate to="/email-templates" replace />}
        />
        <Route
          path="/email-templates/edit/:id"
          element={isSuperUser ? <EmailTemplateFormPage /> : <ForbiddenPage />}
        />
        <Route
          path="/available-jobs"
          element={
            <Navigate to={`/available-jobs/${AVAILABLE_JOBS_ROUTE_TAB_ID.AVAILABLE_JOB}`} replace />
          }
        />
        <Route path="/available-jobs/:tab" element={<EmployeeDashboard />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/" element={<PostLoginDefaultRedirect />} />
        <Route path="*" element={<PostLoginDefaultRedirect />} />
      </Routes>
      )}
    </SMSLayout>
  );
};

