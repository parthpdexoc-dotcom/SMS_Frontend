import { apiDelete, apiGet, apiPost } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parseJsonTextArray, readResponseOk } from '@/services/textPlainJson';
import { EmployeeSkillDto } from '@/types/employeeSkill';
import { getUserFromToken } from '@/utils/jwtDecoder';
import { getToken } from '@/utils/token';
import { hasRole, UserRoleType } from '@/types/userRole';
import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

const BASE_PATH = '/EmployeeSkill';

function isCurrentSessionSuperUser(): boolean {
  const token = getToken();
  if (!token) return false;
  const user = getUserFromToken(token);
  if (!user) return false;
  return user.isSuperUser === true || hasRole(user.roles, UserRoleType.SuperUser);
}

export const upsertEmployeeSkill = async (
  payload: EmployeeSkillDto
): Promise<EmployeeSkillDto> => {
  const response = await apiPost(BASE_PATH, payload, {
    headers: {
      'Content-Type': 'application/json',
      isSuperUser: isCurrentSessionSuperUser() ? 'true' : 'false',
    },
  });

  const text = await readResponseOk(response, 'Failed to save employee skill');
  return parseJsonText<EmployeeSkillDto>(text);
};

const skillBulkHeaders = () => ({
  'Content-Type': 'application/json',
  isSuperUser: isCurrentSessionSuperUser() ? 'true' : 'false',
});

export const bulkUpsertEmployeeSkills = async (
  dtos: EmployeeSkillDto[]
): Promise<EmployeeSkillDto[]> => {
  const response = await apiPost(`${BASE_PATH}/bulk`, dtos, {
    headers: skillBulkHeaders(),
  });

  const text = await readResponseOk(response, 'Failed to save employee skills');
  return parseJsonTextArray<EmployeeSkillDto>(text);
};

export const getEmployeeSkills = async (
  employeeID: string
): Promise<EmployeeSkillDto[]> =>
  coalesceKeyedRequest('getEmployeeSkills', employeeID, async () => {
    const response = await apiGet(`${BASE_PATH}/employee/${encodeURIComponent(employeeID)}`);
    const text = await expectOkReadText(response, 'Failed to fetch employee skills');
    return parseJsonTextArray<EmployeeSkillDto>(text);
  });

export const deleteEmployeeSkill = async (employeeSkillId: string): Promise<void> => {
  const response = await apiDelete(`${BASE_PATH}/${encodeURIComponent(employeeSkillId)}`, {
    headers: { accept: '*/*' },
  });
  await readResponseOk(response, 'Failed to delete employee skill');
};

