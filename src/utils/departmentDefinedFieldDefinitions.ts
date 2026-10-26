import type { DepartmentDefinedFieldsResponse } from '@/types/departmentDefinedFields';

const DEPARTMENT_DEFINED_FIELD_COUNT = 10;

export type DepartmentDefinedFieldBinding = {
  index: number;
  valueFieldName: string;
  label: string;
};

const REQUEST_LABEL_KEYS = Array.from(
  { length: DEPARTMENT_DEFINED_FIELD_COUNT },
  (_, i) => `requestDepartmentDefinedFieldInterfaceLabel${i + 1}` as keyof DepartmentDefinedFieldsResponse
);

const POST_LABEL_KEYS = Array.from(
  { length: DEPARTMENT_DEFINED_FIELD_COUNT },
  (_, i) => `postDepartmentDefinedFieldInterfaceLabel${i + 1}` as keyof DepartmentDefinedFieldsResponse
);

const REQUEST_VALUE_KEYS = Array.from(
  { length: DEPARTMENT_DEFINED_FIELD_COUNT },
  (_, i) => `departmentDefinedFieldValue${i + 1}`
);

const POST_VALUE_KEYS = Array.from(
  { length: DEPARTMENT_DEFINED_FIELD_COUNT },
  (_, i) => `postDepartmentDefinedValue${i + 1}`
);

export const getEmptyDepartmentDefinedFieldValues = (
  scope: 'request' | 'post'
): Record<string, string> => {
  const valueKeys = scope === 'request' ? REQUEST_VALUE_KEYS : POST_VALUE_KEYS;
  return Object.fromEntries(valueKeys.map((key) => [key, '']));
};

/** Maps department config to input labels only; values stay on the request/post entity. */
export const buildDepartmentDefinedFieldBindings = (
  scope: 'request' | 'post',
  config: DepartmentDefinedFieldsResponse | null | undefined,
  fallbackLabels: readonly string[]
): DepartmentDefinedFieldBinding[] => {
  const labelKeys = scope === 'request' ? REQUEST_LABEL_KEYS : POST_LABEL_KEYS;
  const valueKeys = scope === 'request' ? REQUEST_VALUE_KEYS : POST_VALUE_KEYS;

  return labelKeys.map((labelKey, index) => {
    const configuredLabel = String(config?.[labelKey] ?? '').trim();
    const fallback = fallbackLabels[index]?.trim();
    return {
      index: index + 1,
      valueFieldName: valueKeys[index],
      label: configuredLabel || fallback || `Dept Field ${index + 1}`,
    };
  });
};
