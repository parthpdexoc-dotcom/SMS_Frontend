/**
 * PTAEO Code DTO - matches backend PtaeoCodeDto
 * API may return ptaeoCodeID (capital ID) or ptaeoCodeId (camelCase)
 */
export interface PtaeoCodeDto {
  ptaeoCodeId?: string;
  /** API response uses ptaeoCodeID (capital ID) */
  ptaeoCodeID?: string;
  projectNumber?: string;
  taskNumber?: string;
  awardNumber?: string;
  fundNumber?: string;
  organizationName?: string;
  organizationNumber?: string;
}

/** Item may come from API as camelCase or PascalCase */
function getStr(item: PtaeoCodeDto, camel: keyof PtaeoCodeDto, pascal: string): string {
  const val = item[camel];
  if (val != null && val !== '') return String(val);
  return (item as Record<string, unknown>)[pascal] != null
    ? String((item as Record<string, unknown>)[pascal])
    : '';
}

/** Get unique value for dropdown - the PTAEO code id (used as value and sent in save payload) */
export function ptaeoCodeValue(item: PtaeoCodeDto): string {
  const raw = item as Record<string, unknown>;
  const id =
    item.ptaeoCodeId ??
    item.ptaeoCodeID ??
    raw['PtaeoCodeId'] ??
    raw['PtaeoCodeID'];
  if (id != null && id !== '') return String(id);
  return ptaeoCodeDisplayLabel(item);
}

/**
 * Build display label by concatenating ProjectNumber, TaskNumber, AwardNumber, FundNumber (organizationName not displayed)
 */
export function ptaeoCodeDisplayLabel(item: PtaeoCodeDto): string {
  const parts = [
    getStr(item, 'projectNumber', 'ProjectNumber'),
    getStr(item, 'taskNumber', 'TaskNumber'),
    getStr(item, 'awardNumber', 'AwardNumber'),
    getStr(item, 'fundNumber', 'FundNumber'),
    getStr(item, 'organizationNumber', 'OrganizationNumber'),
  ].filter(Boolean);
  return parts.join('.') || '.';
}

/** Build display label from PTAEO parts (e.g. when post has five fields but no matching dropdown item). organizationName is not displayed. */
export function ptaeoCodeLabelFromParts(
  projectNumber?: string | null,
  taskNumber?: string | null,
  awardNumber?: string | null,
  fundNumber?: string | null,
  _organizationName?: string | null,
  organizationNumber?: string | null
): string {
  const parts = [
    projectNumber,
    taskNumber,
    awardNumber,
    fundNumber,
    organizationNumber,
  ]
    .filter((s) => s != null && String(s).trim() !== '')
    .map((s) => String(s).trim());
  return parts.join('.') || '.';
}

/** Five PTAEO parts from a PtaeoCodeDto (for matching post to dropdown item) */
export function ptaeoCodeParts(item: PtaeoCodeDto): {
  projectNumber: string;
  taskNumber: string;
  awardNumber: string;
  fundNumber: string;
  organizationName: string;
  organizationNumber: string;
} {
  return {
    projectNumber: getStr(item, 'projectNumber', 'ProjectNumber'),
    taskNumber: getStr(item, 'taskNumber', 'TaskNumber'),
    awardNumber: getStr(item, 'awardNumber', 'AwardNumber'),
    fundNumber: getStr(item, 'fundNumber', 'FundNumber'),
    organizationName: getStr(item, 'organizationName', 'OrganizationName'),
    organizationNumber: getStr(item, 'organizationNumber', 'OrganizationNumber'),
  };
}
