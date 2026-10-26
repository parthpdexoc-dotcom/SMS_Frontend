import React from 'react';
import { SMSIcon } from '@/components/smsatoms';
import { MenuItem } from '@/types';
import { MENU_ITEMS, AVAILABLE_POST, DASHBOARD, EDIT_PROFILE } from '@/constants/strings';
import { HOLIDAY_DAY } from '@/constants/holidayDayStrings';
import type { UserInfo } from '@/store/slices/authSlice';
import { AdminTypeName, UserRoleType, hasRole } from '@/types/userRole';

type Strings = { MENU_ITEMS: typeof MENU_ITEMS; AVAILABLE_POST: typeof AVAILABLE_POST; HOLIDAY_DAY: typeof HOLIDAY_DAY };

function normalizeAdminTypeForMatch(adminType: string): string {
  return adminType.replace(/\s/g, '').toLowerCase();
}

function hasEligibleWatchCommanderAdminType(user: UserInfo | null | undefined): boolean {
  const values = user?.adminTypes ?? [];
  if (!values.length) return false;
  const allowed = new Set(
    Object.values(AdminTypeName).map((value) => normalizeAdminTypeForMatch(value))
  );
  return values.some((value) => allowed.has(normalizeAdminTypeForMatch(value)));
}

export function canAccessWatchCommanderReport(user: UserInfo | null | undefined): boolean {
  return hasRole(user?.roles, UserRoleType.DepartmentAdmin) || hasEligibleWatchCommanderAdminType(user);
}

/** Super user: the department Audit Log menu is hidden (see `App.tsx`). Email template audit is a separate item. */
export function isSuperUserSession(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  return user.isSuperUser === true || hasRole(user.roles, UserRoleType.SuperUser);
}

/**
 * Department Admin, IA Admin (IAR), Operator — used for menu contributions that include Audit Log items.
 * The live sidebar still hides the whole Audit Log section unless `usesDepartmentScopedAuditList(user)` (see `App.tsx`).
 */
export function hasFullAuditLogMenu(user: UserInfo | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return (
    hasRole(user.roles, UserRoleType.DepartmentAdmin) ||
    hasRole(user.roles, UserRoleType.IAAdmin) ||
    hasRole(user.roles, UserRoleType.Operator)
  );
}

/**
 * Audit list API: `GET .../getall/{table}` (department from token) for IA / Operator / Dept Admin.
 * Fiscal Admin always uses employee-scoped `GET .../getall/{table}/employee/{employeeId}` (even if combined with those roles).
 */
export function usesDepartmentScopedAuditList(user: UserInfo | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  if (hasRole(user.roles, UserRoleType.FiscalAdmin)) return false;
  return hasFullAuditLogMenu(user);
}

/** Full Audit Log section (Dept Admin / IA Admin / Operator). Shown in sidebar only when `usesDepartmentScopedAuditList` in `App.tsx`. */
function buildAuditLogSection(
  icon: (name: React.ComponentProps<typeof SMSIcon>['name']) => React.ReactElement
): MenuItem {
  const AL = DASHBOARD.AUDIT_LOG;
  const children: MenuItem[] = [
    { id: 'audit-requester', label: AL.REQUESTER_LOG, icon: icon('user'), path: '/audit-log/requester' } as MenuItem,
    { id: 'audit-request', label: AL.REQUEST_LOG, icon: icon('document'), path: '/audit-log/request' } as MenuItem,
    {
      id: 'audit-request-schedule',
      label: AL.REQUEST_SCHEDULE_LOG,
      icon: icon('event_note'),
      path: '/audit-log/request-schedule',
    } as MenuItem,
    { id: 'audit-post', label: AL.POST_LOG, icon: icon('briefcase'), path: '/audit-log/job' } as MenuItem,
    {
      id: 'audit-post-position',
      label: AL.POST_POSITION_LOG,
      icon: icon('schedule'),
      path: '/audit-log/job-position',
    } as MenuItem,
    {
      id: 'audit-job-position-flow',
      label: AL.JOB_POSITION_FLOW_LOG,
      icon: icon('account_tree'),
      path: '/audit-log/job-position-flow',
    } as MenuItem,
    { id: 'audit-employee', label: AL.EMPLOYEE_LOG, icon: icon('group'), path: '/audit-log/employee' } as MenuItem,
    {
      id: 'audit-placeholder',
      label: AL.PLACEHOLDER_LOG,
      icon: icon('badge'),
      path: '/audit-log/placeholder',
    } as MenuItem,
    {
      id: 'audit-closed-post-position',
      label: AL.CLOSED_POST_POSITION_LOG,
      icon: icon('event_busy'),
      path: '/audit-log/closed-job-position',
    } as MenuItem,
    {
      id: 'audit-closed-post-position-equipment',
      label: AL.CLOSED_POST_POSITION_EQUIPMENT_LOG,
      icon: icon('precision_manufacturing'),
      path: '/audit-log/closed-job-position-equipment',
    } as MenuItem,
    {
      id: 'audit-payment',
      label: AL.PAYMENT_LOG,
      icon: icon('payments'),
      path: '/audit-log/payment',
    } as MenuItem,
    {
      id: 'audit-payment-type',
      label: AL.PAYMENT_TYPE_LOG,
      icon: icon('payments'),
      path: '/audit-log/payment-type',
    } as MenuItem,
    {
      id: 'audit-payment-allocation',
      label: AL.PAYMENT_ALLOCATION_LOG,
      icon: icon('account_balance_wallet'),
      path: '/audit-log/payment-allocation',
    } as MenuItem,
    {
      id: 'audit-invoice',
      label: AL.INVOICE_LOG,
      icon: icon('receipt'),
      path: '/audit-log/invoice',
    } as MenuItem,
    {
      id: 'audit-invoice-detail',
      label: AL.INVOICE_DETAIL_LOG,
      icon: icon('list_alt'),
      path: '/audit-log/invoice-detail',
    } as MenuItem,
    {
      id: 'audit-requester-ledger',
      label: AL.REQUESTER_LEDGER_LOG,
      icon: icon('account_balance'),
      path: '/audit-log/requester-ledger',
    } as MenuItem,
  ];

  return {
    id: 'audit-log-section',
    label: MENU_ITEMS.AUDIT_LOG,
    icon: icon('history'),
    path: '/audit-log/request',
    children,
  };
}

/** Super user sidebar: Email Templates audit only. Separate id so the department Audit Log filter does not remove it. */
function buildSuperUserEmailTemplateAuditSection(
  icon: (name: React.ComponentProps<typeof SMSIcon>['name']) => React.ReactElement
): MenuItem {
  const AL = DASHBOARD.AUDIT_LOG;
  return {
    id: 'super-user-audit-log',
    label: MENU_ITEMS.AUDIT_LOG,
    icon: icon('history'),
    path: '/audit-log/email-template',
    children: [
      {
        id: 'audit-email-template',
        label: AL.EMAIL_TEMPLATE_LOG,
        icon: icon('email'),
        path: '/audit-log/email-template',
      } as MenuItem,
    ],
  };
}

function buildReportsSection(
  icon: (name: React.ComponentProps<typeof SMSIcon>['name']) => React.ReactElement,
  user: UserInfo | null | undefined
): MenuItem {
  const children: MenuItem[] = [
    {
      id: 'reports-archived',
      label: MENU_ITEMS.ARCHIVED_REPORTS,
      icon: icon('archive'),
      path: '/reports/archived-reports',
    } as MenuItem,
    {
      id: 'reports-off-duty',
      label: MENU_ITEMS.OFF_DUTY_REPORT,
      icon: icon('event_available'),
      path: '/reports/off-duty-report',
    } as MenuItem,
    ...(canAccessWatchCommanderReport(user)
      ? [
          {
            id: 'reports-watch-commander',
            label: MENU_ITEMS.WATCH_COMMANDER_REPORT,
            icon: icon('shield_person'),
            path: '/reports/watch-commander-report',
          } as MenuItem,
        ]
      : []),
  ];

  return {
    id: 'reports-section',
    label: MENU_ITEMS.REPORTS,
    icon: icon('assessment'),
    path: '/reports/archived-reports',
    children,
  };
}

/** Builds the menu contribution for each role. Call from App with SMSIcon and constants; then merge contributions for every role the user has. */
export function createRoleMenus(
  IconComponent: typeof SMSIcon,
  strings: Strings,
  user: UserInfo | null | undefined
) {
  const M = strings.MENU_ITEMS;
  const A = strings.AVAILABLE_POST;
  const H = strings.HOLIDAY_DAY;
  const icon = (name: React.ComponentProps<typeof SMSIcon>['name']) => <IconComponent name={name} size="sm" />;
  const auditLogSection = buildAuditLogSection(icon);
  const superUserEmailTemplateAudit = buildSuperUserEmailTemplateAuditSection(icon);
  const reportsSection = buildReportsSection(icon, user);
  const mappingSection = (): MenuItem => ({
    id: 'mapping',
    label: M.MAPPING,
    icon: icon('location_on'),
    path: '/personnel/master-map',
    children: [
      {
        id: 'master-map',
        label: M.MASTER_MAP,
        icon: icon('map'),
        path: '/personnel/master-map',
      } as MenuItem,
      {
        id: 'employee-location',
        label: M.EMPLOYEE_LOCATION,
        icon: icon('location_on'),
        path: '/personnel/employee-location',
      } as MenuItem,
    ],
  });

  const superUser = (): MenuItem[] => [
    {
      id: 'admin',
      label: M.ADMIN_CONTROL,
      icon: icon('admin'),
      path: '/admin',
      children: [
        { id: 'admin-type', label: M.ADMIN_TYPE, icon: icon('admin'), path: '/admin/admin-type' } as MenuItem,
        { id: 'department', label: M.DEPARTMENT, icon: icon('department_division'), path: '/admin/department' } as MenuItem,
      ],
    },
    {
      id: 'settings',
      label: M.SETTINGS,
      icon: icon('settings'),
      path: '/settings',
      children: [
        { id: 'form-builder', label: M.ACTIVITY_FORM, icon: icon('document'), path: '/activity-form' } as MenuItem,
        {
          id: 'edit-admin-profile',
          label: EDIT_PROFILE.PROFILE_MENU_LABEL,
          icon: icon('user'),
          path: '/settings/edit-admin-profile',
        } as MenuItem,
        { id: 'email-templates', label: M.EMAIL_TEMPLATES, icon: icon('email'), path: '/email-templates' } as MenuItem,
      ],
    },
    superUserEmailTemplateAudit,
  ];

  const operator = (): MenuItem[] => [
    {
      id: 'request-admin',
      label: M.REQUEST_ADMIN,
      icon: icon('document'),
      path: '/request-admin',
      children: [
        { id: 'requester', label: M.REQUESTER, icon: icon('user'), path: '/personnel/requester' } as MenuItem,
        {
          id: 'daily-workspace',
          label: M.DAILY_WORKSPACE,
          icon: icon('dashboard'),
          path: '/personnel/daily-workspace',
        } as MenuItem,
        mappingSection(),
        {
          id: 'release-schedule',
          label: M.RELEASE_SCHEDULE,
          icon: icon('calendar'),
          path: '/admin/release-schedule',
        } as MenuItem,
        { id: 'requester-invoice', label: M.REQUESTER_INVOICE, icon: icon('document'), path: '/admin/requester-invoice' } as MenuItem,
        { id: 'open-jobs', label: M.OPEN_JOBS, icon: icon('briefcase'), path: '/admin/open-jobs' } as MenuItem,
        { id: 'tenure-jobs', label: M.TENURE_JOBS, icon: icon('schedule'), path: '/admin/tenure-jobs' } as MenuItem,
        // { id: 'request-roster', label: M.REQUEST_ROSTER, icon: icon('group'), path: '/admin/request-roster' } as MenuItem,
      ],
    },
    {
      id: 'personnel',
      label: M.PERSONNEL_ADMIN,
      icon: icon('employee'),
      path: '/personnel',
      children: [
        { id: 'employee', label: M.EMPLOYEE, icon: icon('user'), path: '/personnel/employee' } as MenuItem,
        { id: 'employee-posts', label: M.EMPLOYEE_POSTS, icon: icon('briefcase'), path: '/personnel/employee-jobs' } as MenuItem,
      ],
    },
    reportsSection,
    auditLogSection,
  ];

  const requesterManager = (): MenuItem[] => [
    {
      id: 'request-admin',
      label: M.REQUEST_ADMIN,
      icon: icon('document'),
      path: '/request-admin',
      children: [
        { id: 'requester', label: M.REQUESTER, icon: icon('user'), path: '/personnel/requester' } as MenuItem,
        {
          id: 'daily-workspace',
          label: M.DAILY_WORKSPACE,
          icon: icon('dashboard'),
          path: '/personnel/daily-workspace',
        } as MenuItem,
        mappingSection(),
        {
          id: 'release-schedule',
          label: M.RELEASE_SCHEDULE,
          icon: icon('calendar'),
          path: '/admin/release-schedule',
        } as MenuItem,
      ],
    },
  ];

  const hrAdmin = (): MenuItem[] => [
    {
      id: 'personnel',
      label: M.PERSONNEL_ADMIN,
      icon: icon('employee'),
      path: '/personnel',
      children: [
        { id: 'employee', label: M.EMPLOYEE, icon: icon('user'), path: '/personnel/employee' } as MenuItem,
        { id: 'employee-posts', label: M.EMPLOYEE_POSTS, icon: icon('briefcase'), path: '/personnel/employee-jobs' } as MenuItem,
      ],
    },
    {
      id: 'hr-reference',
      label: 'Employee reference data',
      icon: icon('badge'),
      path: '/admin',
      children: [
        { id: 'employee-type', label: M.EMPLOYEE_TYPE, icon: icon('employee_type'), path: '/employee/employee-type' } as MenuItem,
        { id: 'department-division', label: M.DEPARTMENT_DIVISION, icon: icon('department_division'), path: '/employee/department-division' } as MenuItem,
        { id: 'employee-status', label: M.EMPLOYEE_STATUS, icon: icon('employee_status'), path: '/admin/employee-status' } as MenuItem,
      ],
    },
  ];

  const iaAdmin = (): MenuItem[] => [
    {
      id: 'request-admin',
      label: M.REQUEST_ADMIN,
      icon: icon('document'),
      path: '/request-admin',
      children: [
        { id: 'requester', label: M.REQUESTER, icon: icon('user'), path: '/personnel/requester' } as MenuItem,
        {
          id: 'daily-workspace',
          label: M.DAILY_WORKSPACE,
          icon: icon('dashboard'),
          path: '/personnel/daily-workspace',
        } as MenuItem,
        mappingSection(),
        {
          id: 'release-schedule',
          label: M.RELEASE_SCHEDULE,
          icon: icon('calendar'),
          path: '/admin/release-schedule',
        } as MenuItem,
      ],
    },
    {
      id: 'personnel',
      label: M.PERSONNEL_ADMIN,
      icon: icon('employee'),
      path: '/personnel',
      children: [{ id: 'employee', label: M.EMPLOYEE, icon: icon('user'), path: '/personnel/employee' } as MenuItem],
    },
    auditLogSection,
  ];

  const departmentAdmin = (opts: { showEmployeeOnly: boolean; isRegularEmployee: boolean }): MenuItem[] => [
    ...(opts.showEmployeeOnly || opts.isRegularEmployee
      ? [{ id: 'available-jobs', label: A.TITLE, icon: icon('dashboard'), path: '/available-jobs' } as MenuItem]
      : []),
    {
      id: 'request-admin',
      label: M.REQUEST_ADMIN,
      icon: icon('document'),
      path: '/request-admin',
      children: [
        { id: 'requester', label: M.REQUESTER, icon: icon('user'), path: '/personnel/requester' } as MenuItem,
        {
          id: 'daily-workspace',
          label: M.DAILY_WORKSPACE,
          icon: icon('dashboard'),
          path: '/personnel/daily-workspace',
        } as MenuItem,
        mappingSection(),
        {
          id: 'release-schedule',
          label: M.RELEASE_SCHEDULE,
          icon: icon('calendar'),
          path: '/admin/release-schedule',
        } as MenuItem,
        { id: 'requester-invoice', label: M.REQUESTER_INVOICE, icon: icon('document'), path: '/admin/requester-invoice' } as MenuItem,
        { id: 'open-jobs', label: M.OPEN_JOBS, icon: icon('briefcase'), path: '/admin/open-jobs' } as MenuItem,
        { id: 'tenure-jobs', label: M.TENURE_JOBS, icon: icon('schedule'), path: '/admin/tenure-jobs' } as MenuItem,
        // { id: 'request-roster', label: M.REQUEST_ROSTER, icon: icon('group'), path: '/admin/request-roster' } as MenuItem,
      ],
    },
    {
      id: 'personnel',
      label: M.PERSONNEL_ADMIN,
      icon: icon('employee'),
      path: '/personnel',
      children: [
        { id: 'employee', label: M.EMPLOYEE, icon: icon('user'), path: '/personnel/employee' } as MenuItem,
        { id: 'employee-posts', label: M.EMPLOYEE_POSTS, icon: icon('briefcase'), path: '/personnel/employee-jobs' } as MenuItem,
      ],
    },
    reportsSection,
    {
      id: 'admin',
      label: M.ADMIN_CONTROL,
      icon: icon('admin'),
      path: '/admin',
      children: [
        { id: 'add-skill', label: M.ADD_SKILL, icon: icon('skill'), path: '/admin/skills' } as MenuItem,
        { id: 'business-type', label: M.BUSINESS_TYPE, icon: icon('business_type'), path: '/admin/business-type' } as MenuItem,
        { id: 'payment-type', label: M.PAYMENT_TYPE, icon: icon('payments'), path: '/admin/payment-type' } as MenuItem,
        { id: 'employee-status', label: M.EMPLOYEE_STATUS, icon: icon('employee_status'), path: '/admin/employee-status' } as MenuItem,
        { id: 'response-area', label: M.RESPONSE_AREA, icon: icon('response_area'), path: '/employee/response-area' } as MenuItem,
        { id: 'routing-group', label: M.ROUTING_GROUP, icon: icon('group'), path: '/admin/routing-group' } as MenuItem,
        { id: 'holiday-day', label: H.TABLE.TITLE, icon: icon('calendar'), path: '/admin/holiday-day' } as MenuItem,
        { id: 'employee-type', label: M.EMPLOYEE_TYPE, icon: icon('employee_type'), path: '/employee/employee-type' } as MenuItem,
        { id: 'department-division', label: M.DEPARTMENT_DIVISION, icon: icon('department_division'), path: '/employee/department-division' } as MenuItem,
        { id: 'department-activity-type', label: M.DEPARTMENT_ACTIVITY_TYPE, icon: icon('department_activity_type'), path: '/employee/department-activity-type' } as MenuItem,
        {
          id: 'equipment',
          label: M.EQUIPMENT,
          icon: icon('equipment_type'),
          path: '/admin/equipment',
          children: [
            { id: 'equipment-type', label: M.EQUIPMENT_TYPE, icon: icon('equipment_type'), path: '/admin/equipment-type' } as MenuItem,
            { id: 'department-equipment', label: M.DEPARTMENT_EQUIPMENT, icon: icon('equipment_type'), path: '/employee/department-equipment' } as MenuItem,
          ],
        } as MenuItem,
        { id: 'department-fee', label: M.DEPARTMENT_FEE, icon: icon('department_division'), path: '/employee/department-fee' } as MenuItem,
        { id: 'pay-code', label: M.PAY_CODES, icon: icon('business_type'), path: '/employee/pay-code' } as MenuItem,
      ],
    },
    auditLogSection,
    {
      id: 'settings',
      label: M.SETTINGS,
      icon: icon('settings'),
      path: '/settings',
      children: [
        { id: 'form-builder', label: M.ACTIVITY_FORM, icon: icon('document'), path: '/activity-form' } as MenuItem,
        { id: 'edit-profile', label: M.EDIT_PROFILE, icon: icon('user'), path: '/settings/edit-profile' } as MenuItem,
        { id: 'department-defined-fields', label: M.DEPARTMENT_DEFINED_FIELDS, icon: icon('document'), path: '/admin/department-defined-fields' } as MenuItem,
        { id: 'department-policy', label: M.DEPARTMENT_POLICY, icon: icon('document'), path: '/admin/department-policy' } as MenuItem,
        { id: 'department-invoice-config', label: M.INVOICE_CONFIG, icon: icon('document'), path: '/admin/department-invoice-config' } as MenuItem,
      ],
    },
  ];

  const regularEmployee = (): MenuItem[] => [
    { id: 'available-jobs', label: A.TITLE, icon: icon('dashboard'), path: '/available-jobs' } as MenuItem,
  ];

  const defaultMenu = (opts: { showEmployeeOnly: boolean }): MenuItem[] => [
    ...(opts.showEmployeeOnly
      ? [{ id: 'available-jobs', label: A.TITLE, icon: icon('dashboard'), path: '/available-jobs' } as MenuItem]
      : []),
    {
      id: 'request-admin',
      label: M.REQUEST_ADMIN,
      icon: icon('document'),
      path: '/request-admin',
      children: [
        { id: 'requester', label: M.REQUESTER, icon: icon('user'), path: '/personnel/requester' } as MenuItem,
        {
          id: 'daily-workspace',
          label: M.DAILY_WORKSPACE,
          icon: icon('dashboard'),
          path: '/personnel/daily-workspace',
        } as MenuItem,
        mappingSection(),
        {
          id: 'release-schedule',
          label: M.RELEASE_SCHEDULE,
          icon: icon('calendar'),
          path: '/admin/release-schedule',
        } as MenuItem,
      ],
    },
    {
      id: 'personnel',
      label: M.PERSONNEL_ADMIN,
      icon: icon('employee'),
      path: '/personnel',
      children: [
        { id: 'employee', label: M.EMPLOYEE, icon: icon('user'), path: '/personnel/employee' } as MenuItem,
        { id: 'employee-posts', label: M.EMPLOYEE_POSTS, icon: icon('briefcase'), path: '/personnel/employee-jobs' } as MenuItem,
      ],
    },
    reportsSection,
    {
      id: 'admin',
      label: M.ADMIN_CONTROL,
      icon: icon('admin'),
      path: '/admin',
      children: [
        { id: 'add-skill', label: M.ADD_SKILL, icon: icon('skill'), path: '/admin/skills' } as MenuItem,
        { id: 'business-type', label: M.BUSINESS_TYPE, icon: icon('business_type'), path: '/admin/business-type' } as MenuItem,
        { id: 'payment-type', label: M.PAYMENT_TYPE, icon: icon('payments'), path: '/admin/payment-type' } as MenuItem,
        { id: 'employee-status', label: M.EMPLOYEE_STATUS, icon: icon('employee_status'), path: '/admin/employee-status' } as MenuItem,
        { id: 'response-area', label: M.RESPONSE_AREA, icon: icon('response_area'), path: '/employee/response-area' } as MenuItem,
        { id: 'routing-group', label: M.ROUTING_GROUP, icon: icon('group'), path: '/admin/routing-group' } as MenuItem,
        { id: 'holiday-day', label: H.TABLE.TITLE, icon: icon('calendar'), path: '/admin/holiday-day' } as MenuItem,
        { id: 'employee-type', label: M.EMPLOYEE_TYPE, icon: icon('employee_type'), path: '/employee/employee-type' } as MenuItem,
        { id: 'department-division', label: M.DEPARTMENT_DIVISION, icon: icon('department_division'), path: '/employee/department-division' } as MenuItem,
        { id: 'department-activity-type', label: M.DEPARTMENT_ACTIVITY_TYPE, icon: icon('department_activity_type'), path: '/employee/department-activity-type' } as MenuItem,
        {
          id: 'equipment',
          label: M.EQUIPMENT,
          icon: icon('equipment_type'),
          path: '/admin/equipment',
          children: [
            { id: 'equipment-type', label: M.EQUIPMENT_TYPE, icon: icon('equipment_type'), path: '/admin/equipment-type' } as MenuItem,
            { id: 'department-equipment', label: M.DEPARTMENT_EQUIPMENT, icon: icon('equipment_type'), path: '/employee/department-equipment' } as MenuItem,
          ],
        } as MenuItem,
        { id: 'department-fee', label: M.DEPARTMENT_FEE, icon: icon('department_division'), path: '/employee/department-fee' } as MenuItem,
        { id: 'pay-code', label: M.PAY_CODES, icon: icon('business_type'), path: '/employee/pay-code' } as MenuItem,
      ],
    },
    {
      id: 'settings',
      label: M.SETTINGS,
      icon: icon('settings'),
      path: '/settings',
      children: [{ id: 'form-builder', label: M.ACTIVITY_FORM, icon: icon('document'), path: '/activity-form' } as MenuItem],
    },
  ];

  return {
    superUser,
    operator,
    requesterManager,
    hrAdmin,
    iaAdmin,
    departmentAdmin,
    regularEmployee,
    defaultMenu,
  };
}
