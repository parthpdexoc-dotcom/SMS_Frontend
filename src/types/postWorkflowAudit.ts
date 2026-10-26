import type { EmployeePostListingItem } from '@/types/employeePostListingItem';

export interface PostWorkflowAuditResult {
  data: EmployeePostListingItem[];
  totalRecords: number;
}
