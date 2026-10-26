import { CreateDepartmentRequest } from '@/types/department';
import { EmployeeFormData } from '@/types/employee';

const PENDING_WIZARD_DEPARTMENT_KEY = 'sems-pending-wizard-department-id';
const PENDING_WIZARD_EMPLOYEE_KEY = 'sems-pending-wizard-employee';
const PENDING_WIZARD_DEPARTMENT_DRAFT_KEY = 'sems-pending-wizard-department-draft';

export type WizardEmployeeResume = {
  form: EmployeeFormData;
  skillStartDateOverrides: Record<string, string | null>;
  skillEndDateOverrides: Record<string, string | null>;
};

export function saveWizardEmployee(resume: WizardEmployeeResume): void {
  sessionStorage.setItem(PENDING_WIZARD_EMPLOYEE_KEY, JSON.stringify(resume));
}

export function readPendingWizardEmployee(): WizardEmployeeResume | null {
  const raw = sessionStorage.getItem(PENDING_WIZARD_EMPLOYEE_KEY);
  if (!raw) return null;
  try {
    const employee = JSON.parse(raw) as WizardEmployeeResume;
    return employee?.form?.username && employee.form.password ? employee : null;
  } catch {
    return null;
  }
}

export function clearWizardEmployee(): void {
  sessionStorage.removeItem(PENDING_WIZARD_EMPLOYEE_KEY);
}

export function saveWizardDepartmentDraft(payload: CreateDepartmentRequest): void {
  sessionStorage.setItem(PENDING_WIZARD_DEPARTMENT_DRAFT_KEY, JSON.stringify(payload));
}

export function readWizardDepartmentDraft(): CreateDepartmentRequest | null {
  const raw = sessionStorage.getItem(PENDING_WIZARD_DEPARTMENT_DRAFT_KEY);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CreateDepartmentRequest;
    return payload?.departmentCode?.trim() ? payload : null;
  } catch {
    return null;
  }
}

export function pendingWizardDepartmentId(): string {
  return (sessionStorage.getItem(PENDING_WIZARD_DEPARTMENT_KEY) || '').trim();
}

export function rememberWizardDepartment(departmentId: string): void {
  sessionStorage.setItem(PENDING_WIZARD_DEPARTMENT_KEY, departmentId);
}

export function clearWizardResume(): void {
  sessionStorage.removeItem(PENDING_WIZARD_DEPARTMENT_KEY);
  sessionStorage.removeItem(PENDING_WIZARD_EMPLOYEE_KEY);
  sessionStorage.removeItem(PENDING_WIZARD_DEPARTMENT_DRAFT_KEY);
}
