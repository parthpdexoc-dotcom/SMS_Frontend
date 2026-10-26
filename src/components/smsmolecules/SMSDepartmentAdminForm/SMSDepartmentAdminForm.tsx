import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SMSBox, SMSButton, SMSDropdown, SMSLoader, SMSMultiSelectDropdown } from '@/components/smsatoms';
import { DEPARTMENT, DEPARTMENT_ADMIN } from '@/constants/strings';
import type { DepartmentAdminFormProps } from '@/types/departmentAdmin';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearDepartmentAdminEmployeeIds,
  fetchDepartmentAdminEmployeeIds,
  fetchDepartmentAdmins,
  removeDepartmentAdmin,
  upsertDepartmentAdminThunk,
} from '@/store/slices/departmentAdminSlice';
import { fetchAdminTypes } from '@/store/slices/adminTypeSlice';
import { fetchEmployees } from '@/store/slices/employeeSlice';
import { formatLastNameCommaFirstName, personNameMatchesStoredDisplay } from '@/utils';
import './SMSDepartmentAdminForm.css';

export const SMSDepartmentAdminForm: React.FC<DepartmentAdminFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  className = '',
  departmentId: departmentIdProp,
  fixedAdminTypeShort,
  disableAdminType = false,
  fixedEmployeeID,
  disableEmployee = false,
  adminTypeMultiSelect = false,
}) => {
  const isEditMode = Boolean(initialData?.departmentAdminID) && !adminTypeMultiSelect;
  const dispatch = useAppDispatch();

  const departmentAdminState = useAppSelector((state) => state.departmentAdmin);
  const departmentAdmins = departmentAdminState?.departmentAdmins ?? [];
  const departmentAdminEmployeeIds = departmentAdminState?.departmentAdminEmployeeIds ?? [];
  const isDeptAdminLoading = departmentAdminState?.isLoading ?? false;
  const employeeIdsLoading = departmentAdminState?.employeeIdsLoading ?? false;
  const reduxError = departmentAdminState?.error ?? null;

  const adminTypeState = useAppSelector((state) => state.adminType);
  const adminTypes = adminTypeState?.adminTypes ?? [];
  const isAdminTypesLoading = adminTypeState?.isLoading ?? false;

  const employeeState = useAppSelector((state) => state.employee);
  const employees = employeeState?.employees ?? [];
  const isEmployeesLoading = employeeState?.isLoading ?? false;

  const { user } = useAppSelector((state) => state.auth);

  // When opened from Departments grid, use departmentId prop or initialData.departmentID; from Employee grid use employee's department
  const loginDepartmentID =
    departmentIdProp ?? initialData?.departmentID ?? user?.departmentID;

  const [adminTypeID, setAdminTypeID] = useState<string>('');
  const [selectedAdminTypeIDs, setSelectedAdminTypeIDs] = useState<string[]>([]);
  const [employeeID, setEmployeeID] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    adminTypeID?: string;
    employeeID?: string;
  }>({});
  const [, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When fixedAdminTypeShort is set (e.g. 'IA Admin'), resolve that admin type's ID (must be before effects that use it)
  const fixedAdminTypeID = useMemo(() => {
    if (!fixedAdminTypeShort || !adminTypes.length) return '';
    const match = adminTypes.find(
      (t) =>
        (t.adminTypeShort || '').trim().toLowerCase() ===
        fixedAdminTypeShort.trim().toLowerCase()
    );
    return match?.adminTypeID ?? '';
  }, [fixedAdminTypeShort, adminTypes]);

  // Load dropdown data: when modal opens from employee grid (adminTypeMultiSelect), always refetch admin types for fresh dropdown; otherwise fetch only if empty
  useEffect(() => {
    if (adminTypeMultiSelect) {
      dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 }));
    }
  }, [adminTypeMultiSelect, dispatch]);

  useEffect(() => {
    if (!adminTypeMultiSelect && !adminTypes.length) {
      dispatch(fetchAdminTypes({ page: 1, pageSize: 1000 }));
    }
  }, [adminTypeMultiSelect, adminTypes.length, dispatch]);

  useEffect(() => {
    if (!employees.length) {
      const selectedId = fixedEmployeeID || initialData?.employeeID || undefined;
      dispatch(fetchEmployees({ page: 1, pageSize: 1000, selectedId }));
    }
  }, [employees.length, dispatch, fixedEmployeeID, initialData?.employeeID]);

  // When opened from Employee grid with multi-select, fetch department admins to load existing assignments
  useEffect(() => {
    if (adminTypeMultiSelect && (initialData?.employeeID || fixedEmployeeID) && loginDepartmentID) {
      dispatch(fetchDepartmentAdmins({ page: 1, pageSize: 5000 }));
    }
  }, [adminTypeMultiSelect, initialData?.employeeID, fixedEmployeeID, loginDepartmentID, dispatch]);

  // When opened from Department list (fixed admin type, single employee): fetch employee IDs to bind and fetch admins for delete-on-change
  useEffect(() => {
    if (
      !adminTypeMultiSelect &&
      fixedAdminTypeShort &&
      loginDepartmentID &&
      fixedAdminTypeID
    ) {
      dispatch(fetchDepartmentAdmins({ page: 1, pageSize: 5000 }));
      dispatch(
        fetchDepartmentAdminEmployeeIds({
          departmentId: loginDepartmentID,
          adminTypeId: fixedAdminTypeID,
        })
      );
    }
  }, [
    adminTypeMultiSelect,
    fixedAdminTypeShort,
    loginDepartmentID,
    fixedAdminTypeID,
    dispatch,
  ]);

  // Bind employee dropdown from API when we have department+adminType employee IDs (Department popup)
  useEffect(() => {
    if (
      adminTypeMultiSelect ||
      !fixedAdminTypeShort ||
      !departmentAdminEmployeeIds.length
    )
      return;
    setEmployeeID((prev) => (prev ? prev : departmentAdminEmployeeIds[0]));
  }, [adminTypeMultiSelect, fixedAdminTypeShort, departmentAdminEmployeeIds]);

  // Clear employee IDs when modal closes so next open refetches
  useEffect(() => {
    return () => {
      dispatch(clearDepartmentAdminEmployeeIds());
    };
  }, [dispatch]);

  const effectiveEmployeeID = fixedEmployeeID || employeeID;

  const existingDepartmentAdmins = useMemo(() => {
    if (!adminTypeMultiSelect || !effectiveEmployeeID || !loginDepartmentID) return [];
    const empId = effectiveEmployeeID.trim().toLowerCase();
    const deptId = loginDepartmentID.trim().toLowerCase();
    return departmentAdmins.filter(
      (d) =>
        (d.employeeID || '').trim().toLowerCase() === empId &&
        (d.departmentID || '').trim().toLowerCase() === deptId
    );
  }, [
    adminTypeMultiSelect,
    effectiveEmployeeID,
    loginDepartmentID,
    departmentAdmins,
  ]);

  const existingAdminTypeIDsKey = useMemo(
    () => existingDepartmentAdmins.map((a) => a.adminTypeID).filter(Boolean).sort().join(','),
    [existingDepartmentAdmins]
  );

  useEffect(() => {
    if (adminTypeMultiSelect) {
      setSelectedAdminTypeIDs(existingDepartmentAdmins.map((a) => a.adminTypeID).filter((id): id is string => Boolean(id)));
    }
  }, [adminTypeMultiSelect, existingAdminTypeIDsKey]);

  const adminTypeOptions = useMemo(() => {
    const list = Array.isArray(adminTypes) ? adminTypes : [];
    return list
      .filter((t) => t?.adminTypeStatus)
      .map((t) => ({
        value: t.adminTypeID ?? '',
        label: t.adminTypeShort || t.adminTypeLong || '',
      }));
  }, [adminTypes]);

  const employeesList = Array.isArray(employees) ? employees : [];
  const departmentEmployees = useMemo(() => {
    if (!loginDepartmentID || String(loginDepartmentID).trim() === '') {
      return employeesList;
    }
    const deptId = String(loginDepartmentID).trim().toLowerCase();
    return employeesList.filter(
      (e) => (e.departmentID || '').trim().toLowerCase() === deptId
    );
  }, [employeesList, loginDepartmentID]);

  const employeeOptions = useMemo(() => {
    const list =
      disableEmployee && fixedEmployeeID
        ? employeesList.filter(
            (e) => (e.employeeID || '').trim().toLowerCase() === (fixedEmployeeID || '').trim().toLowerCase()
          )
        : departmentEmployees;
    const opts = (Array.isArray(list) ? list : []).map((e) => ({
      value: e.employeeID ?? '',
      label:
        formatLastNameCommaFirstName(e.firstName, e.lastName) ||
        e.username ||
        e.badgeNumber ||
        '',
    }));
    // When opened from Department list (fixed IA Admin), add empty option so user can remove the IA Admin assignment
    if (!adminTypeMultiSelect && fixedAdminTypeShort) {
      return [{ value: '', label: 'Select Employee' }, ...opts];
    }
    return opts;
  }, [departmentEmployees, employeesList, disableEmployee, fixedEmployeeID, adminTypeMultiSelect, fixedAdminTypeShort]);

  // Resolve initial dropdown selections when editing
  const resolvedAdminTypeID = useMemo(() => {
    if (fixedAdminTypeID) return fixedAdminTypeID;
    if (initialData?.adminTypeID) {
      return initialData.adminTypeID;
    }

    if (initialData?.departmentAdminShort) {
      const match = adminTypeOptions.find(
        (opt) =>
          opt.label.toLowerCase() ===
          initialData.departmentAdminShort?.toLowerCase()
      );
      if (match) return match.value;
    }

    return '';
  }, [fixedAdminTypeID, initialData?.adminTypeID, initialData?.departmentAdminShort, adminTypeOptions]);

  const resolvedEmployeeID = useMemo(() => {
    if (fixedEmployeeID) {
      return fixedEmployeeID;
    }
    if (initialData?.employeeID) {
      return initialData.employeeID;
    }

    if (initialData?.employeeName) {
      const match = departmentEmployees.find((e) =>
        personNameMatchesStoredDisplay(e.firstName, e.lastName, initialData.employeeName)
      );
      if (match) return match.employeeID;
    }

    if (initialData?.departmentAdminLong) {
      const target = initialData.departmentAdminLong.toLowerCase();
      const match = departmentEmployees.find((e) => {
        const display = formatLastNameCommaFirstName(e.firstName, e.lastName).toLowerCase();
        const legacy = [e.firstName, e.lastName].filter(Boolean).join(' ').trim().toLowerCase();
        return (
          display === target ||
          legacy === target ||
          e.username?.toLowerCase() === target ||
          e.badgeNumber?.toLowerCase() === target
        );
      });
      if (match) return match.employeeID;
    }

    return '';
  }, [
    fixedEmployeeID,
    initialData?.employeeID,
    initialData?.employeeName,
    initialData?.departmentAdminLong,
    departmentEmployees,
  ]);

  // Keep local state in sync with resolved IDs (fixed type takes precedence when set)
  useEffect(() => {
    setAdminTypeID(resolvedAdminTypeID || fixedAdminTypeID || '');
  }, [resolvedAdminTypeID, fixedAdminTypeID]);

  useEffect(() => {
    setEmployeeID(resolvedEmployeeID || '');
  }, [resolvedEmployeeID]);

  const isLoading =
    isDeptAdminLoading ||
    isAdminTypesLoading ||
    isEmployeesLoading ||
    employeeIdsLoading ||
    isSubmitting ||
    (adminTypeMultiSelect && isDeptAdminLoading);

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (adminTypeMultiSelect) {
      if (!effectiveEmployeeID) {
        errors.employeeID = `${DEPARTMENT_ADMIN.TABLE.COLUMNS.DESCRIPTION} is required`;
      }
      // Allow zero or more admin types in multi-select
    } else {
      if (!adminTypeID) {
        errors.adminTypeID = `${DEPARTMENT_ADMIN.TABLE.COLUMNS.TITLE} is required`;
      }
      // When fixedAdminTypeShort (Department list popup), empty employee is allowed to remove IA Admin
      if (!fixedAdminTypeShort && !employeeID) {
        errors.employeeID = `${DEPARTMENT_ADMIN.TABLE.COLUMNS.DESCRIPTION} is required`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitMultiSelect = useCallback(async () => {
    const selectedSet = new Set(selectedAdminTypeIDs.map((id) => id.toLowerCase()));
    const toAdd = selectedAdminTypeIDs.filter(
      (id) =>
        !existingDepartmentAdmins.some(
          (a) => (a.adminTypeID || '').toLowerCase() === id.toLowerCase()
        )
    );
    const toRemove = existingDepartmentAdmins.filter(
      (a) => !selectedSet.has((a.adminTypeID || '').toLowerCase())
    );

    const selectedEmployee = employees.find(
      (e) => (e.employeeID || '').toLowerCase() === (effectiveEmployeeID || '').toLowerCase()
    );
    const derivedLong =
      selectedEmployee
        ? formatLastNameCommaFirstName(selectedEmployee.firstName, selectedEmployee.lastName) ||
          selectedEmployee.username ||
          selectedEmployee.badgeNumber ||
          ''
        : '';

    for (const rec of toRemove) {
      await dispatch(removeDepartmentAdmin(rec.departmentAdminID)).unwrap();
    }
    for (const adminTypeIDVal of toAdd) {
      const selectedAdminType = adminTypes.find((t) => t.adminTypeID === adminTypeIDVal);
      const derivedShort =
        selectedAdminType?.adminTypeShort ||
        selectedAdminType?.adminTypeLong ||
        '';
      await dispatch(
        upsertDepartmentAdminThunk({
          departmentAdminShort: derivedShort,
          departmentAdminLong: derivedLong,
          departmentAdminStatus: true,
          adminTypeID: adminTypeIDVal,
          employeeID: effectiveEmployeeID!,
          departmentID: user?.isSuperUser ? undefined : loginDepartmentID!,
        })
      ).unwrap();
    }
  }, [
    selectedAdminTypeIDs,
    existingDepartmentAdmins,
    effectiveEmployeeID,
    loginDepartmentID,
    user?.isSuperUser,
    employees,
    adminTypes,
    dispatch,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (adminTypeMultiSelect) {
        await handleSubmitMultiSelect();
        onSuccess?.();
        return;
      }

      // When opened from Department list with fixed IA Admin and user selected "Select Employee" (empty) -> remove the IA Admin assignment
      if (fixedAdminTypeShort && (!employeeID || employeeID.trim() === '')) {
        const deptId = (loginDepartmentID || '').trim().toLowerCase();
        const typeId = (fixedAdminTypeID || '').trim().toLowerCase();
        const existing = departmentAdmins.find(
          (d) =>
            (d.departmentID || '').trim().toLowerCase() === deptId &&
            (d.adminTypeID || '').trim().toLowerCase() === typeId
        );
        if (existing?.departmentAdminID) {
          await dispatch(removeDepartmentAdmin(existing.departmentAdminID)).unwrap();
        }
        onSuccess?.();
        return;
      }

      const selectedAdminType = adminTypes.find((t) => t.adminTypeID === adminTypeID);
      const selectedEmployee = employees.find((e) => e.employeeID === employeeID);

      const derivedShort =
        selectedAdminType?.adminTypeShort ||
        selectedAdminType?.adminTypeLong ||
        initialData?.departmentAdminShort ||
        '';

      const derivedLong =
        (selectedEmployee
          ? formatLastNameCommaFirstName(selectedEmployee.firstName, selectedEmployee.lastName) ||
            selectedEmployee.username ||
            selectedEmployee.badgeNumber
          : initialData?.departmentAdminLong || '') || '';

      // Use departmentId prop (from Department list row) or initialData/loginDepartmentID so payload always includes departmentID when not superuser
      const departmentIDForPayload = user?.isSuperUser
        ? undefined
        : (departmentIdProp ?? initialData?.departmentID ?? loginDepartmentID ?? undefined);
      const payload = {
        departmentAdminShort: derivedShort,
        departmentAdminLong: derivedLong,
        departmentAdminStatus: initialData?.departmentAdminStatus ?? true,
        adminTypeID: adminTypeID || undefined,
        employeeID: employeeID || undefined,
        departmentID: departmentIDForPayload ?? loginDepartmentID ?? undefined,
      };

      if (isEditMode && initialData?.departmentAdminID) {
        await dispatch(
          upsertDepartmentAdminThunk({
            departmentAdminID: initialData.departmentAdminID,
            ...payload,
          })
        ).unwrap();
      } else {
        await dispatch(upsertDepartmentAdminThunk(payload)).unwrap();
      }

      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : reduxError || 'Failed to save department admin';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const employeeDropdownValue = effectiveEmployeeID || employeeID;

  const dataLoading = isAdminTypesLoading || isEmployeesLoading;

  const handleEmployeeChange = useCallback(
    (value: string) => {
      const previousEmployeeID = employeeID;
      if (
        !adminTypeMultiSelect &&
        fixedAdminTypeShort &&
        loginDepartmentID &&
        fixedAdminTypeID &&
        previousEmployeeID &&
        value !== previousEmployeeID
      ) {
        const deptId = (loginDepartmentID || '').trim().toLowerCase();
        const typeId = (fixedAdminTypeID || '').trim().toLowerCase();
        const prevEmpId = (previousEmployeeID || '').trim().toLowerCase();
        const record = departmentAdmins.find(
          (d) =>
            (d.departmentID || '').trim().toLowerCase() === deptId &&
            (d.adminTypeID || '').trim().toLowerCase() === typeId &&
            (d.employeeID || '').trim().toLowerCase() === prevEmpId
        );
        if (record?.departmentAdminID) {
          dispatch(removeDepartmentAdmin(record.departmentAdminID));
        }
      }
      setEmployeeID(value);
      setFieldErrors((prev) => (prev.employeeID ? { ...prev, employeeID: undefined } : prev));
    },
    [
      adminTypeMultiSelect,
      fixedAdminTypeShort,
      loginDepartmentID,
      fixedAdminTypeID,
      employeeID,
      departmentAdmins,
      dispatch,
    ]
  );

  const employeeField = (
    <SMSDropdown
      label={DEPARTMENT_ADMIN.TABLE.COLUMNS.DESCRIPTION}
      placeholder={`Select ${DEPARTMENT_ADMIN.TABLE.COLUMNS.DESCRIPTION.toLowerCase()}`}
      options={employeeOptions}
      value={employeeDropdownValue}
      onChange={(e) => handleEmployeeChange(String(e.target.value))}
      name="employeeID"
      required={!fixedAdminTypeShort}
      disabled={isLoading || (disableEmployee && !!fixedEmployeeID)}
      error={Boolean(fieldErrors.employeeID)}
      helperText={fieldErrors.employeeID}
    />
  );

  const adminTypeField = adminTypeMultiSelect ? (
    <SMSMultiSelectDropdown
      label={DEPARTMENT_ADMIN.TABLE.COLUMNS.TITLE}
      placeholder={`Select ${DEPARTMENT_ADMIN.TABLE.COLUMNS.TITLE.toLowerCase()}`}
      options={adminTypeOptions}
      value={selectedAdminTypeIDs}
      onChange={(values) => setSelectedAdminTypeIDs(values.map(String))}
      disabled={isLoading}
    />
  ) : (
    <SMSDropdown
      label={DEPARTMENT_ADMIN.TABLE.COLUMNS.TITLE}
      placeholder={`Select ${DEPARTMENT_ADMIN.TABLE.COLUMNS.TITLE.toLowerCase()}`}
      options={adminTypeOptions}
      value={adminTypeID}
      onChange={(e) => {
        setAdminTypeID(String(e.target.value));
        if (fieldErrors.adminTypeID) {
          setFieldErrors((prev) => ({ ...prev, adminTypeID: undefined }));
        }
      }}
      name="adminTypeID"
      required
      disabled={isLoading || (disableAdminType && !!fixedAdminTypeShort)}
      error={Boolean(fieldErrors.adminTypeID)}
      helperText={fieldErrors.adminTypeID}
    />
  );

  return (
    <form
      className={`department-admin-form ${className}`}
      onSubmit={handleSubmit}
      noValidate
    >
      {dataLoading && (
        <SMSBox className="department-admin-form__loading" sx={{ display: 'flex', justifyContent: 'center' }} aria-live="polite">
          <SMSLoader loadingText="Loading options..." aria-label="Loading options..." />
        </SMSBox>
      )}
      <div className="department-admin-form__grid">
        {adminTypeMultiSelect ? (
          <>
            {employeeField}
            {adminTypeField}
          </>
        ) : (
          <>
            {adminTypeField}
            {employeeField}
          </>
        )}
      </div>

      <div className="department-admin-form__actions">
        <SMSButton
          type="button"
          onClick={onCancel}
          disabled={isLoading}
        >
          {DEPARTMENT.FORM.CANCEL_BUTTON}
        </SMSButton>
        <SMSButton type="submit" disabled={isLoading} loading={isLoading}>
          {isEditMode ? DEPARTMENT.BUTTON.UPDATE : DEPARTMENT.FORM.SUBMIT_BUTTON}
        </SMSButton>
      </div>
    </form>
  );
};

