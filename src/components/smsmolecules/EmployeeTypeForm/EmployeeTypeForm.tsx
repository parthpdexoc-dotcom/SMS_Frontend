import React, { useEffect, useMemo, useState } from 'react';
import { EMPLOYEE_TYPE, VALIDATION } from '@/constants/strings';
import { EmployeeTypeResponse } from '@/types/employeeType';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchEmployeeTypes, upsertEmployeeTypeThunk } from '@/store/slices/employeeTypeSlice';
import { ShortLongStatusForm } from '@/components/smsmolecules/ShortLongStatusForm';
import { SMSBox, SMSMultiSelectDropdown, SMSTypography } from '@/components/smsatoms';
import { getEmployeeTypes } from '@/services/employeeTypeService';

export interface EmployeeTypeFormProps {
  initialData?: EmployeeTypeResponse | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const EmployeeTypeForm: React.FC<EmployeeTypeFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
}) => {
  const isEditMode = Boolean(initialData?.employeeTypeID);
  const dispatch = useAppDispatch();
  const { isLoading, error: reduxError, employeeTypes: employeeTypesFromStore } = useAppSelector(
    (state) => state.employeeType
  );

  const [rankedEmployeeTypes, setRankedEmployeeTypes] = useState<EmployeeTypeResponse[]>([]);
  const [sameRankIds, setSameRankIds] = useState<string[]>([]);

  useEffect(() => {
    if (isEditMode && employeeTypesFromStore.length === 0) {
      dispatch(fetchEmployeeTypes({ page: 1, pageSize: 1000 }));
    }
  }, [dispatch, isEditMode, employeeTypesFromStore.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: list } = await getEmployeeTypes({
          page: 1,
          pageSize: 1000,
          sortBy: 'rank',
          sortDirection: 'asc',
        });
        if (!cancelled) setRankedEmployeeTypes(list);
      } catch {
        if (!cancelled) setRankedEmployeeTypes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allTypesForSameRank = useMemo(() => {
    const byKey = new Map<string, EmployeeTypeResponse>();
    const add = (t: EmployeeTypeResponse) => {
      if (t.employeeTypeID) byKey.set(String(t.employeeTypeID).toLowerCase(), t);
    };
    employeeTypesFromStore.forEach(add);
    rankedEmployeeTypes.forEach(add);
    return Array.from(byKey.values());
  }, [employeeTypesFromStore, rankedEmployeeTypes]);

  const sameRankKey = useMemo(() => (initialData?.sameRankIds ?? []).slice().sort().join('|'), [initialData?.sameRankIds]);

  useEffect(() => {
    if (!initialData?.employeeTypeID) {
      setSameRankIds([]);
      return;
    }
    const ids = initialData.sameRankIds ?? [];
    const self = initialData.employeeTypeID;
    setSameRankIds(ids.filter((id) => id && id !== self));
  }, [initialData?.employeeTypeID, sameRankKey]);

  /** IDs already tied to another employee type via that row's sameRankIds (not this form). */
  const idsClaimedByOtherTypes = useMemo(() => {
    const editingId = initialData?.employeeTypeID?.toLowerCase() ?? '';
    const claimed = new Set<string>();
    for (const t of allTypesForSameRank) {
      const pid = String(t.employeeTypeID ?? '').toLowerCase();
      if (!pid || pid === editingId) continue;
      for (const sid of t.sameRankIds ?? []) {
        if (sid) claimed.add(String(sid).toLowerCase());
      }
    }
    return claimed;
  }, [allTypesForSameRank, initialData?.employeeTypeID]);

  const sameRankOptions = useMemo(() => {
    const selfLower = initialData?.employeeTypeID?.toLowerCase() ?? '';
    const selectedLower = new Set(sameRankIds.map((id) => String(id).toLowerCase()));
    return allTypesForSameRank
      .filter((t) => {
        const tid = String(t.employeeTypeID ?? '').toLowerCase();
        if (!t.employeeTypeID || tid === selfLower) return false;
        if (selectedLower.has(tid)) return true;
        if (idsClaimedByOtherTypes.has(tid)) return false;
        return true;
      })
      .map((t) => ({
        value: t.employeeTypeID,
        label: t.employeeTypeShort || t.employeeTypeLong || String(t.employeeTypeID),
      }));
  }, [
    allTypesForSameRank,
    initialData?.employeeTypeID,
    idsClaimedByOtherTypes,
    sameRankIds,
  ]);

  const initialValues = useMemo(() => {
    return initialData
      ? {
          short: initialData.employeeTypeShort || '',
          long: initialData.employeeTypeLong || '',
          isActive: initialData.employeeTypeActive ?? true,
          extras: {
            payRate: initialData.payRate ?? 0,
            premiumPayRate: initialData.premiumPayRate ?? 0,
            isSupervisor: initialData.isSupervisor ?? false,
            isEligible: initialData.isEligible ?? false,
          },
        }
      : {
          short: '',
          long: '',
          isActive: true,
          extras: {
            payRate: 0,
            premiumPayRate: 0,
            isSupervisor: false,
            isEligible: false,
          },
        };
  }, [
    initialData?.employeeTypeShort,
    initialData?.employeeTypeLong,
    initialData?.employeeTypeActive,
    initialData?.payRate,
    initialData?.premiumPayRate,
    initialData?.isSupervisor,
    initialData?.isEligible,
  ]);

  const handleSameRankChange = (values: (string | number)[]) => {
    setSameRankIds(values.map(String));
  };

  const employeeSameRankDropdown =
    isEditMode && initialData?.employeeTypeID ? (
      <SMSBox sx={{ width: '100%' }}>
        <SMSMultiSelectDropdown
          label={EMPLOYEE_TYPE.FORM.EMPLOYEE_SAME_RANK}
          placeholder={EMPLOYEE_TYPE.FORM.EMPLOYEE_SAME_RANK_PLACEHOLDER}
          options={sameRankOptions}
          value={sameRankIds}
          onChange={handleSameRankChange}
          fullWidth
        />
        <SMSTypography
          variant="caption"
          component="p"
          sx={{
            mt: 0.75,
            mb: 0,
            color: 'text.secondary',
            lineHeight: 1.4,
          }}
        >
          {EMPLOYEE_TYPE.FORM.EMPLOYEE_SAME_RANK_NOTE}
        </SMSTypography>
      </SMSBox>
    ) : null;

  return (
    <ShortLongStatusForm
      className={`form-modal--employee-type ${className}`.trim()}
      isEditMode={isEditMode}
      isLoading={isLoading}
      reduxError={reduxError}
      contentAfterDescription={employeeSameRankDropdown}
      extraCheckboxes={[
        {
          key: 'isSupervisor',
          label: EMPLOYEE_TYPE.FORM.IS_SUPERVISOR,
        },
        {
          key: 'isEligible',
          label: EMPLOYEE_TYPE.FORM.IS_ELIGIBLE,
        },
      ]}
      extraFields={[
        {
          key: 'payRate',
          label: EMPLOYEE_TYPE.FORM.PAY_RATE,
          type: 'text',
          required: true,
          placeholder: EMPLOYEE_TYPE.FORM.PAY_RATE_PLACEHOLDER,
          layout: 'half',
          labelInline: true,
          formatType: 'currency',
          onChangeTransform: (v) => (typeof v === 'number' ? v : 0),
          customValidate: (v) => (Number(v) <= 0 ? VALIDATION.MUST_BE_GREATER_THAN_ZERO : undefined),
        },
        {
          key: 'premiumPayRate',
          label: EMPLOYEE_TYPE.FORM.PREMIUM_PAY_RATE,
          type: 'text',
          required: true,
          placeholder: EMPLOYEE_TYPE.FORM.PREMIUM_PAY_RATE_PLACEHOLDER,
          layout: 'half',
          labelInline: true,
          formatType: 'currency',
          onChangeTransform: (v) => (typeof v === 'number' ? v : 0),
          customValidate: (v) => (Number(v) <= 0 ? VALIDATION.MUST_BE_GREATER_THAN_ZERO : undefined),
        },
      ]}
      strings={{
        FORM: {
          TITLE: EMPLOYEE_TYPE.FORM.TITLE,
          TITLE_PLACEHOLDER: EMPLOYEE_TYPE.FORM.TITLE_PLACEHOLDER,
          DESCRIPTION: EMPLOYEE_TYPE.FORM.DESCRIPTION,
          DESCRIPTION_PLACEHOLDER: EMPLOYEE_TYPE.FORM.DESCRIPTION_PLACEHOLDER,
          IS_ACTIVE: EMPLOYEE_TYPE.FORM.IS_ACTIVE,
          CANCEL_BUTTON: EMPLOYEE_TYPE.FORM.CANCEL_BUTTON,
          SUBMIT_BUTTON: EMPLOYEE_TYPE.FORM.SUBMIT_BUTTON,
          SUBMITTING: EMPLOYEE_TYPE.FORM.SUBMITTING,
        },
        ERRORS: {
          TITLE_REQUIRED: EMPLOYEE_TYPE.ERRORS.TITLE_REQUIRED,
          DESCRIPTION_REQUIRED: EMPLOYEE_TYPE.ERRORS.DESCRIPTION_REQUIRED,
        },
        SUCCESS: {
          ADDED: EMPLOYEE_TYPE.SUCCESS.ADDED,
          UPDATED: EMPLOYEE_TYPE.SUCCESS.UPDATED,
        },
        BUTTON: {
          UPDATE: EMPLOYEE_TYPE.BUTTON.UPDATE,
          UPDATING: EMPLOYEE_TYPE.BUTTON.UPDATING,
        },
      }}
      initialValues={initialValues}
      onSubmit={async (values) => {
        const payRate = Number(values.extras?.payRate) || 0;
        const premiumPayRate = Number(values.extras?.premiumPayRate) || 0;
        const isSupervisor = Boolean(values.extras?.isSupervisor);
        const isEligible = Boolean(values.extras?.isEligible);
        if (payRate <= 0) {
          throw new Error(VALIDATION.MUST_BE_GREATER_THAN_ZERO);
        }
        if (premiumPayRate <= 0) {
          throw new Error(VALIDATION.MUST_BE_GREATER_THAN_ZERO);
        }

        const employeeTypeID = initialData?.employeeTypeID;
        const payload = {
          employeeTypeShort: values.short,
          employeeTypeLong: values.long,
          employeeTypeActive: values.isActive,
          payRate,
          premiumPayRate,
          isSupervisor,
          isEligible,
        };

        if (isEditMode && employeeTypeID) {
          await dispatch(
            upsertEmployeeTypeThunk({
              employeeTypeID,
              ...payload,
              sameRankIds,
            })
          ).unwrap();
          return;
        }

        await dispatch(upsertEmployeeTypeThunk(payload)).unwrap();
      }}
      onSuccess={onSuccess}
      onCancel={onCancel}
      showAuditInfo={true}
      auditData={
        initialData
          ? {
              createdBy: initialData.createdBy || undefined,
              createdDate: initialData.createdDate || undefined,
              editedBy: initialData.editedBy || undefined,
              editedDate: initialData.editedDate || undefined,
            }
          : undefined
      }
    />
  );
};
