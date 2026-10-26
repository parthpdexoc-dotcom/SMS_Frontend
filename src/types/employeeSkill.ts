export interface EmployeeSkillDto {
  employeeSkillId?: string;
  employeeID: string;
  skillId: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive?: boolean;
}

